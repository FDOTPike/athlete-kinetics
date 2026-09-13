import { create } from 'zustand';
import { Platform } from 'react-native';
import type { DB } from '@op-engineering/op-sqlite';
import {
  BACKUP_RESTORE_POLICY,
  BACKUP_SCHEMA_MIGRATION_SLOT,
  BACKUP_SCHEMA_TABLE_COUNT,
  BACKUP_SCHEMA_USER_VERSION,
  MAX_DATABASE_BYTES,
  base64ToBytes,
  bytesToBase64,
  cleanupRestoreFiles,
  cleanupAbandonedBackupDirectories,
  collectBoundedSnapshots,
  copyFileConfirmed,
  decideRestore,
  executeInterruptedRestoreRecovery,
  hasRequiredStorage,
  isCurrentBackupSchema,
  openBackup,
  replacementStorageRequirement,
  rollbackRestoreFiles,
  sealBackup,
  validatePortableBackupFileSize,
  validateAggregateDatabaseBytes,
  validateRestoreJournal,
  type BackupArchiveV1,
  type BackupDatabaseSnapshot,
  type BackupSchemaObject,
  type RestoreJournalEntry,
  type RestoreJournalV1,
} from '@ak/core-db';
import { REGISTRY_FILE, parseRegistry, serializeRegistry, type AthleteRegistry } from './athleteRegistryCore';
import { loadRegistry } from './athleteRegistry';
import { closeStoreDatabaseForRestore, restartStoreAfterRestore } from './useStore';
import { mobileBackupCrypto } from './backupCrypto';
import { acquireDataMaintenanceLock, authorizeAthleteDataBoot, revokeAthleteDataBoot } from './dataMaintenanceLock';

const APP_VERSION = '0.1.0';
const SCHEMA_VERSION = BACKUP_SCHEMA_USER_VERSION;
const MIGRATION_SLOT = BACKUP_SCHEMA_MIGRATION_SLOT;
const TABLE_COUNT = BACKUP_SCHEMA_TABLE_COUNT;
const BACKUP_SETTINGS_FILE = 'backup_preferences.json';
const JOURNAL_FILE = '.ak_restore_journal.json';
const APPLY_MARKER_FILE = '.ak_restore_applying';
const COMMIT_MARKER_FILE = '.ak_restore_committed';
const ROLLBACK_MARKER_FILE = '.ak_restore_rolled_back';
const RECOVERY_BACKUP_FILE = 'pikeMethods-recovery-current.pmbak';
const MIME = 'application/octet-stream';

interface BlobFs {
  dirs: { DocumentDir: string; CacheDir: string; LibraryDir?: string };
  exists(path: string): Promise<boolean>;
  readFile(path: string, encoding: 'utf8' | 'base64'): Promise<unknown>;
  writeFile(path: string, data: string, encoding: 'utf8' | 'base64'): Promise<void>;
  unlink(path: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  ls(path: string): Promise<string[]>;
  cp(path: string, destination: string): Promise<boolean>;
  mv(path: string, destination: string): Promise<boolean>;
  stat(path: string): Promise<{ size: string | number }>;
  hash(path: string, algorithm: 'sha256'): Promise<string>;
  df(): Promise<{ free?: number; internal_free?: string; external_free?: string }>;
}

function fs(): BlobFs {
  const module = require('react-native-blob-util') as { default: { fs: BlobFs } };
  return module.default.fs;
}

function sqlite(): { open(options: { name: string; location?: string }): DB } {
  return require('@op-engineering/op-sqlite') as typeof import('@op-engineering/op-sqlite');
}

const rows = <T>(result: unknown): T[] => {
  if (Array.isArray(result)) return result as T[];
  if (typeof result === 'object' && result !== null && 'rows' in result) {
    const value = (result as { rows: unknown }).rows;
    if (Array.isArray(value)) return value as T[];
    if (typeof value === 'object' && value !== null && '_array' in value && Array.isArray((value as { _array: unknown })._array)) {
      return (value as { _array: T[] })._array;
    }
  }
  return [];
};

const pathFromUri = (uri: string): string => decodeURIComponent(uri.replace(/^file:\/\//, ''));
const slash = (path: string): number => Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
const dirname = (path: string): string => path.slice(0, slash(path));
const basename = (path: string): string => path.slice(slash(path) + 1);
const escapeSql = (path: string): string => path.replace(/'/g, "''");
const asText = (value: unknown): string => typeof value === 'string' ? value : '';
const randomId = (): string => mobileBackupCrypto.sha256Hex(mobileBackupCrypto.randomBytes(32)).slice(0, 32);

async function removeIfPresent(path: string): Promise<void> {
  const io = fs();
  try { if (await io.exists(path)) await io.unlink(path); } catch { /* bounded cleanup is best effort */ }
}

async function sweepAbandonedSnapshots(): Promise<void> {
  const io = fs();
  const names = await io.ls(io.dirs.CacheDir);
  await cleanupAbandonedBackupDirectories(names, async (name) => {
    const path = `${io.dirs.CacheDir}/${name}`;
    if (await io.exists(path)) await io.unlink(path);
  });
}

function openDatabase(dbName: string, location?: string): DB {
  return sqlite().open(location === undefined ? { name: dbName } : { name: dbName, location });
}

function databaseDirectory(): string {
  const directories = fs().dirs;
  if (Platform.OS === 'ios' && typeof directories.LibraryDir === 'string' && directories.LibraryDir.length > 0) {
    return directories.LibraryDir.replace(/[\\/]$/, '');
  }
  if (Platform.OS === 'android') return `${dirname(directories.DocumentDir)}/databases`;
  throw new Error('Portable backup is not supported on this platform.');
}

function dbPath(dbName: string): string {
  return `${databaseDirectory()}/${dbName}`;
}

function oneNumber(handle: DB, sql: string, key: string): number {
  const row = rows<Record<string, unknown>>(handle.executeSync(sql))[0];
  const value = row?.[key];
  return typeof value === 'number' ? value : Number(value ?? -1);
}

function quickCheck(handle: DB): boolean {
  const row = rows<Record<string, unknown>>(handle.executeSync('PRAGMA quick_check'))[0];
  return row !== undefined && Object.values(row)[0] === 'ok';
}

function schemaContract(handle: DB): BackupSchemaObject[] {
  const objects = rows<{ type: string; name: string; tbl_name: string; sql: string }>(handle.executeSync(
    "SELECT type,name,tbl_name,coalesce(sql,'') AS sql FROM sqlite_master "
      + "WHERE type IN ('table','index','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type,name",
  ));
  return objects.map((object): BackupSchemaObject => {
    const columns = object.type !== 'table' ? [] : rows<{
      cid: number; name: string; type: string; notnull: number; dflt_value: string | null; pk: number;
    }>(handle.executeSync(`PRAGMA table_info("${object.name.replace(/"/g, '""')}")`))
      .map((column) => [column.cid, column.name, column.type, column.notnull, column.dflt_value, column.pk] as const);
    return [object.type, object.name, object.tbl_name, object.sql, columns];
  });
}

function requireCurrentSchema(handle: DB, message: string): void {
  if (!isCurrentBackupSchema(schemaContract(handle), mobileBackupCrypto)) throw new Error(message);
}

async function availableBytes(): Promise<number | null> {
  try {
    const value = await fs().df();
    const raw = value.internal_free ?? value.free ?? value.external_free;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  } catch { return null; }
}

async function requireWorkingSpace(bytes: number): Promise<void> {
  const available = await availableBytes();
  if (!hasRequiredStorage(available, bytes)) throw new Error(available === null
    ? 'Free storage could not be verified safely. Existing data is unchanged.'
    : 'Not enough free storage to complete this safely. Existing data is unchanged.');
}

async function readMarker(path: string): Promise<string | null> {
  const io = fs();
  return await io.exists(path) ? asText(await io.readFile(path, 'utf8')) : null;
}

async function writeMarkerConfirmed(path: string, operationId: string): Promise<void> {
  await fs().writeFile(path, operationId, 'utf8');
  if (await readMarker(path) !== operationId) throw new Error('Restore marker could not be confirmed. Existing data is unchanged.');
}

async function readLastSuccess(): Promise<string | null> {
  try {
    const io = fs();
    const path = `${io.dirs.DocumentDir}/${BACKUP_SETTINGS_FILE}`;
    if (!(await io.exists(path))) return null;
    const parsed = JSON.parse(asText(await io.readFile(path, 'utf8'))) as { lastSuccessfulBackupAt?: unknown };
    return typeof parsed.lastSuccessfulBackupAt === 'string' && !Number.isNaN(Date.parse(parsed.lastSuccessfulBackupAt))
      ? parsed.lastSuccessfulBackupAt : null;
  } catch { return null; }
}

async function writeLastSuccess(value: string): Promise<void> {
  await fs().writeFile(`${fs().dirs.DocumentDir}/${BACKUP_SETTINGS_FILE}`, JSON.stringify({ lastSuccessfulBackupAt: value }), 'utf8');
}

interface PreparedDatabaseSnapshot extends Omit<BackupDatabaseSnapshot, 'databaseBase64'> {
  readonly snapshotPath: string;
}

async function prepareDatabaseSnapshot(
  entry: AthleteRegistry['athletes'][number], workDirectory: string, index: number,
): Promise<PreparedDatabaseSnapshot> {
  const io = fs();
  const snapshotPath = `${workDirectory}/snapshot-${index}.db`;
  await removeIfPresent(snapshotPath);
  if (!(await io.exists(dbPath(entry.dbName)))) throw new Error('An athlete database changed during backup. No file was saved.');
  const handle = openDatabase(entry.dbName);
  try {
    if (!quickCheck(handle)) throw new Error('A local athlete database did not pass its integrity check. No backup was saved.');
    handle.executeSync(`VACUUM INTO '${escapeSql(snapshotPath)}'`);
  } finally { handle.close(); }
  const snapshotHandle = openDatabase(basename(snapshotPath), dirname(snapshotPath));
  let userVersion: number;
  let tableCount: number;
  try {
    if (!quickCheck(snapshotHandle)) throw new Error('A database snapshot did not pass its integrity check. No backup was saved.');
    userVersion = oneNumber(snapshotHandle, 'PRAGMA user_version', 'user_version');
    tableCount = oneNumber(snapshotHandle, "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", 'count');
    requireCurrentSchema(snapshotHandle, 'A database snapshot does not match the verified app schema. No backup was saved.');
  } finally { snapshotHandle.close(); }
  if (userVersion !== SCHEMA_VERSION || tableCount !== TABLE_COUNT) throw new Error('A database uses an unsupported schema. Update the app before backing up.');
  const stat = await io.stat(snapshotPath);
  const byteLength = Number(stat.size);
  if (!Number.isSafeInteger(byteLength) || byteLength < 100 || byteLength > MAX_DATABASE_BYTES) throw new Error('Backup is too large for this version. No file was saved; larger streaming backups are not supported yet.');
  const sha256Hex = await io.hash(snapshotPath, 'sha256');
  return { athleteId: entry.id, dbName: entry.dbName, byteLength, sha256Hex, userVersion, tableCount, snapshotPath };
}

async function readPreparedDatabaseSnapshot(prepared: PreparedDatabaseSnapshot): Promise<BackupDatabaseSnapshot> {
  const { snapshotPath, ...snapshot } = prepared;
  return { ...snapshot, databaseBase64: asText(await fs().readFile(snapshotPath, 'base64')) };
}

async function buildArchive(previousSuccessfulBackupAt: string | null): Promise<{ archive: BackupArchiveV1; workDirectory: string }> {
  const io = fs();
  const registry = await loadRegistry();
  const operationId = randomId();
  const workDirectory = `${io.dirs.CacheDir}/ak-backup-${operationId}`;
  await io.mkdir(workDirectory);
  try {
    const sourceSizes = await Promise.all(registry.athletes.map(async (athlete) => (await io.stat(dbPath(athlete.dbName))).size));
    let sourceBytes: number;
    try { sourceBytes = validateAggregateDatabaseBytes(sourceSizes); }
    catch { throw new Error('Backup is too large for this version. No file was saved; larger streaming backups are not supported yet.'); }
    await requireWorkingSpace(replacementStorageRequirement(sourceBytes));
    let databases: BackupDatabaseSnapshot[];
    try {
      databases = await collectBoundedSnapshots(
        registry.athletes,
        async (_athlete, index) => sourceSizes[index],
        (athlete, index) => prepareDatabaseSnapshot(athlete, workDirectory, index),
        (prepared) => readPreparedDatabaseSnapshot(prepared),
      );
    } catch (error) {
      if (error instanceof Error && /too large|sizes could not be verified/.test(error.message)) {
        throw new Error('Backup is too large for this version. No file was saved; larger streaming backups are not supported yet.');
      }
      throw error;
    }
    return {
      archive: {
        archiveVersion: 1,
        backupId: operationId,
        createdAt: new Date().toISOString(),
        sourceAppVersion: APP_VERSION,
        sourceSchemaVersion: SCHEMA_VERSION,
        sourceMigrationSlot: MIGRATION_SLOT,
        scope: 'all-athletes',
        restorePolicy: BACKUP_RESTORE_POLICY,
        registry,
        databases,
        previousSuccessfulBackupAt,
      },
      workDirectory,
    };
  } catch (error) {
    await removeIfPresent(workDirectory);
    throw error;
  }
}

async function createEncryptedBytes(password: string, previousSuccessfulBackupAt: string | null): Promise<{ text: string; workDirectory: string }> {
  const { archive, workDirectory } = await buildArchive(previousSuccessfulBackupAt);
  try { return { text: await sealBackup(archive, password, mobileBackupCrypto), workDirectory }; }
  catch (error) { await removeIfPresent(workDirectory); throw error; }
}

async function pickerSave(sourcePath: string, fileName: string): Promise<boolean> {
  const { saveDocuments } = require('@react-native-documents/picker') as typeof import('@react-native-documents/picker');
  const [saved] = await saveDocuments({ sourceUris: [`file://${sourcePath}`], fileName, mimeType: MIME, copy: true });
  return saved.error === null && saved.uri.length > 0;
}

async function pickerOpen(): Promise<string | null> {
  const picker = require('@react-native-documents/picker') as typeof import('@react-native-documents/picker');
  try {
    const [selected] = await picker.pick({ mode: 'import', type: MIME, allowMultiSelection: false, allowVirtualFiles: false });
    const [copy] = await picker.keepLocalCopy({
      files: [{ uri: selected.uri, fileName: selected.name ?? 'selected.pmbak' }], destination: 'cachesDirectory',
    });
    if (copy.status !== 'success') throw new Error('The selected backup could not be copied into private app storage.');
    return pathFromUri(copy.localUri);
  } catch (error) {
    if (picker.isErrorWithCode(error) && error.code === picker.errorCodes.OPERATION_CANCELED) return null;
    throw error;
  }
}

async function verifyStagedDatabase(path: string, expected: BackupDatabaseSnapshot): Promise<void> {
  const handle = openDatabase(basename(path), dirname(path));
  try {
    if (!quickCheck(handle)
      || oneNumber(handle, 'PRAGMA user_version', 'user_version') !== expected.userVersion
      || oneNumber(handle, "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", 'count') !== TABLE_COUNT) {
      throw new Error('A restored database failed validation. Existing data is unchanged.');
    }
    requireCurrentSchema(handle, 'A restored database does not match the verified app schema. Existing data is unchanged.');
  } finally { handle.close(); }
}

async function rollback(journal: RestoreJournalV1): Promise<void> {
  const io = fs();
  await rollbackRestoreFiles(journal, {
    exists: (path) => io.exists(path),
    remove: (path) => io.unlink(path),
    copy: async (source, destination) => {
      if (!(await io.cp(source, destination))) throw new Error('rollback copy failed');
    },
  });
  for (const entry of journal.entries) {
    if (entry.existedBefore && entry.rollbackPath !== null
      && await io.hash(entry.targetPath, 'sha256') !== await io.hash(entry.rollbackPath, 'sha256')) {
      throw new Error('database rollback verification failed');
    }
  }
  if (journal.registryExistedBefore && journal.registryRollbackPath !== null
    && await io.hash(journal.registryTargetPath, 'sha256') !== await io.hash(journal.registryRollbackPath, 'sha256')) {
    throw new Error('registry rollback verification failed');
  }
}

async function rollbackAndMark(journal: RestoreJournalV1): Promise<void> {
  await rollback(journal);
  await writeMarkerConfirmed(`${fs().dirs.DocumentDir}/${ROLLBACK_MARKER_FILE}`, journal.operationId);
}

async function cleanupJournal(journal: RestoreJournalV1): Promise<void> {
  const io = fs();
  await cleanupRestoreFiles(journal, {
    exists: (path) => io.exists(path),
    remove: (path) => io.unlink(path),
    copy: async (source, destination) => {
      if (!(await io.cp(source, destination))) throw new Error('cleanup copy failed');
    },
  });
  await removeIfPresent(`${fs().dirs.DocumentDir}/${JOURNAL_FILE}`);
  await removeIfPresent(`${fs().dirs.DocumentDir}/${APPLY_MARKER_FILE}`);
  await removeIfPresent(`${fs().dirs.DocumentDir}/${COMMIT_MARKER_FILE}`);
  await removeIfPresent(`${fs().dirs.DocumentDir}/${ROLLBACK_MARKER_FILE}`);
}

export async function recoverInterruptedRestore(): Promise<boolean> {
  const io = fs();
  const journalPath = `${io.dirs.DocumentDir}/${JOURNAL_FILE}`;
  if (!(await io.exists(journalPath))) return false;
  let raw: unknown;
  try { raw = JSON.parse(asText(await io.readFile(journalPath, 'utf8'))) as unknown; }
  catch { throw new Error('Restore recovery journal is unreadable. Existing files were not changed.'); }
  const trustedDatabaseDirectory = databaseDirectory();
  const journal = validateRestoreJournal(raw, { documentDirectory: io.dirs.DocumentDir, databaseDirectory: trustedDatabaseDirectory });
  if (journal === null) throw new Error('Restore recovery journal is invalid. Existing files were not changed.');
  try {
    return await executeInterruptedRestoreRecovery(
      journal,
    await readMarker(`${io.dirs.DocumentDir}/${APPLY_MARKER_FILE}`),
    await readMarker(`${io.dirs.DocumentDir}/${COMMIT_MARKER_FILE}`),
      await readMarker(`${io.dirs.DocumentDir}/${ROLLBACK_MARKER_FILE}`),
      rollbackAndMark,
      cleanupJournal,
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'restore recovery markers are invalid') {
      throw new Error('Restore recovery markers are invalid. Recovery files were preserved and no data was opened.');
    }
    throw error;
  }
}

async function replaceAllData(incoming: BackupArchiveV1): Promise<void> {
  const io = fs();
  const current = await loadRegistry();
  const trustedDatabaseDirectory = databaseDirectory();
  const operationId = randomId();
  const registryTargetPath = `${io.dirs.DocumentDir}/${REGISTRY_FILE}`;
  const registryStagedPath = `${io.dirs.DocumentDir}/.ak-registry-${operationId}.new`;
  const registryRollbackPath = `${io.dirs.DocumentDir}/.ak-registry-${operationId}.old`;
  const allNames = [...new Set([...current.athletes.map((entry) => entry.dbName), ...incoming.registry.athletes.map((entry) => entry.dbName)])].sort();
  const incomingByName = new Map(incoming.databases.map((database) => [database.dbName, database]));
  const entries: RestoreJournalEntry[] = [];
  const totalBytes = incoming.databases.reduce((sum, database) => sum + database.byteLength, 0);
  let registryExistedBefore = false;
  let journal: RestoreJournalV1 | null = null;
  let storeClosed = false;
  let committed = false;
  try {
    await requireWorkingSpace(replacementStorageRequirement(totalBytes));
    for (let index = 0; index < allNames.length; index += 1) {
      const name = allNames[index]!;
      const targetPath = `${trustedDatabaseDirectory}/${name}`;
      const stagedPath = incomingByName.has(name) ? `${trustedDatabaseDirectory}/.ak-incoming-${operationId}-${index}.db` : null;
      const rollbackPath = `${trustedDatabaseDirectory}/.ak-rollback-${operationId}-${index}.db`;
      const existedBefore = await io.exists(targetPath);
      entries.push({ targetPath, stagedPath, rollbackPath: existedBefore ? rollbackPath : null, existedBefore });
    }
    registryExistedBefore = await io.exists(registryTargetPath);
    journal = {
      version: 1, operationId, entries, registryTargetPath, registryStagedPath,
      registryRollbackPath: registryExistedBefore ? registryRollbackPath : null, registryExistedBefore,
    };
    const journalPath = `${io.dirs.DocumentDir}/${JOURNAL_FILE}`;
    await io.writeFile(journalPath, JSON.stringify(journal), 'utf8');
    const checked = validateRestoreJournal(JSON.parse(asText(await io.readFile(journalPath, 'utf8'))) as unknown,
      { documentDirectory: io.dirs.DocumentDir, databaseDirectory: trustedDatabaseDirectory });
    if (checked === null) throw new Error('Could not confirm the restore journal. Existing data is unchanged.');

    // The durable journal exists before any plaintext staging or rollback
    // copy, so a process death during preparation has a bounded cold-start
    // cleanup path and can never be mistaken for an in-progress replacement.
    for (const [index, entry] of entries.entries()) {
      if (entry.existedBefore && entry.rollbackPath !== null) {
        await copyFileConfirmed((source, destination) => io.cp(source, destination), entry.targetPath, entry.rollbackPath);
        if (await io.hash(entry.targetPath, 'sha256') !== await io.hash(entry.rollbackPath, 'sha256')) {
          throw new Error('A database recovery copy did not match its source. Existing data is unchanged.');
        }
      }
      const incomingSnapshot = incomingByName.get(allNames[index]!);
      if (entry.stagedPath !== null && incomingSnapshot !== undefined) {
        await io.writeFile(entry.stagedPath, incomingSnapshot.databaseBase64, 'base64');
        if ((await io.hash(entry.stagedPath, 'sha256')) !== incomingSnapshot.sha256Hex) throw new Error('A staged database did not match the authenticated backup. Existing data is unchanged.');
        await verifyStagedDatabase(entry.stagedPath, incomingSnapshot);
      }
    }
    if (registryExistedBefore) {
      await copyFileConfirmed((source, destination) => io.cp(source, destination), registryTargetPath, registryRollbackPath);
      if (await io.hash(registryTargetPath, 'sha256') !== await io.hash(registryRollbackPath, 'sha256')) {
        throw new Error('The registry recovery copy did not match its source. Existing data is unchanged.');
      }
    }
    const incomingRegistry: AthleteRegistry = {
      ...incoming.registry,
      athletes: incoming.registry.athletes.map((athlete) => ({ ...athlete })),
    };
    await io.writeFile(registryStagedPath, serializeRegistry(incomingRegistry), 'utf8');
    if (serializeRegistry(parseRegistry(asText(await io.readFile(registryStagedPath, 'utf8')))) !== serializeRegistry(incomingRegistry)) {
      throw new Error('The staged athlete registry failed validation. Existing data is unchanged.');
    }
    await writeMarkerConfirmed(`${io.dirs.DocumentDir}/${APPLY_MARKER_FILE}`, operationId);
    closeStoreDatabaseForRestore();
    storeClosed = true;
    for (const entry of entries) {
      await removeIfPresent(entry.targetPath);
      if (entry.stagedPath !== null && !(await io.mv(entry.stagedPath, entry.targetPath))) throw new Error('Database replacement did not complete.');
    }
    await removeIfPresent(registryTargetPath);
    if (!(await io.mv(registryStagedPath, registryTargetPath))) throw new Error('Athlete registry replacement did not complete.');
    await writeMarkerConfirmed(`${io.dirs.DocumentDir}/${COMMIT_MARKER_FILE}`, operationId);
    committed = true;
    await cleanupJournal(journal);
  } catch (error) {
    if (committed) {
      return;
    }
    if (journal !== null && storeClosed) {
      try {
        await rollbackAndMark(journal);
        await cleanupJournal(journal);
      } catch {
        // Preserve journal and rollback copies for deterministic cold-start
        // recovery. Deleting them here would turn an IO fault into data loss.
        throw new RestoreRecoveryRequiredError('Restore was interrupted. Restart pikeMethods to recover the earlier data.');
      }
    } else {
      for (const entry of entries) {
        if (entry.stagedPath !== null) await removeIfPresent(entry.stagedPath);
        if (entry.rollbackPath !== null) await removeIfPresent(entry.rollbackPath);
      }
      await removeIfPresent(registryStagedPath);
      if (registryExistedBefore) await removeIfPresent(registryRollbackPath);
      await removeIfPresent(`${io.dirs.DocumentDir}/${JOURNAL_FILE}`);
      await removeIfPresent(`${io.dirs.DocumentDir}/${APPLY_MARKER_FILE}`);
      await removeIfPresent(`${io.dirs.DocumentDir}/${COMMIT_MARKER_FILE}`);
      await removeIfPresent(`${io.dirs.DocumentDir}/${ROLLBACK_MARKER_FILE}`);
    }
    throw error;
  }
}

export interface RestorePreview {
  readonly backupId: string;
  readonly createdAt: string;
  readonly athleteNames: readonly string[];
  readonly databaseCount: number;
  readonly totalBytes: number;
  readonly replaceOnly: true;
}

interface BackupState {
  readonly status: 'idle' | 'working' | 'preview' | 'error' | 'success';
  readonly startupSafe: boolean | null;
  readonly message: string | null;
  readonly lastSuccessfulBackupAt: string | null;
  readonly preview: RestorePreview | null;
  initialize(): Promise<boolean>;
  createBackup(password: string): Promise<void>;
  chooseRestore(password: string): Promise<void>;
  confirmRestore(password: string): Promise<void>;
  cancelRestore(): void;
}

let pendingArchive: BackupArchiveV1 | null = null;

class RestoreRecoveryRequiredError extends Error {}

export const useBackupStore = create<BackupState>((set, get) => ({
  status: 'idle', startupSafe: null, message: null, lastSuccessfulBackupAt: null, preview: null,
  initialize: async () => {
    try {
      await sweepAbandonedSnapshots();
      const rolledBack = await recoverInterruptedRestore();
      set({ startupSafe: true, lastSuccessfulBackupAt: await readLastSuccess(), status: rolledBack ? 'success' : 'idle', message: rolledBack ? 'An interrupted restore was rolled back. Your earlier data is available.' : null });
      return true;
    } catch {
      set({ startupSafe: false, status: 'error', message: 'Restore recovery needs attention. Athlete data stays closed to protect the recovery files.' });
      return false;
    }
  },
  createBackup: async (password) => {
    if (get().status === 'working') return;
    set({ status: 'working', message: 'Creating an encrypted snapshot…', preview: null });
    pendingArchive = null;
    let workDirectory: string | null = null;
    let encryptedPath: string | null = null;
    let releaseMaintenance: (() => void) | null = null;
    try {
      releaseMaintenance = acquireDataMaintenanceLock('encrypted-backup');
      closeStoreDatabaseForRestore();
      const created = await createEncryptedBytes(password, get().lastSuccessfulBackupAt);
      workDirectory = created.workDirectory;
      encryptedPath = `${created.workDirectory}/pikeMethods-${new Date().toISOString().slice(0, 10)}.pmbak`;
      await fs().writeFile(encryptedPath, created.text, 'utf8');
      const saved = await pickerSave(encryptedPath, basename(encryptedPath));
      if (!saved) throw new Error('The system storage provider did not confirm the file was saved.');
      const completedAt = new Date().toISOString();
      await writeLastSuccess(completedAt);
      set({ status: 'success', message: 'Encrypted backup saved to the location you chose. Keep a copy off this phone.', lastSuccessfulBackupAt: completedAt });
    } catch (error) {
      const picker = require('@react-native-documents/picker') as typeof import('@react-native-documents/picker');
      const cancelled = picker.isErrorWithCode(error) && error.code === picker.errorCodes.OPERATION_CANCELED;
      set({ status: cancelled ? 'idle' : 'error', message: cancelled ? 'Backup cancelled. Nothing was saved.' : error instanceof Error ? error.message : 'Backup could not be created.' });
    } finally {
      if (encryptedPath !== null) await removeIfPresent(encryptedPath);
      if (workDirectory !== null) await removeIfPresent(workDirectory);
      if (releaseMaintenance !== null) {
        releaseMaintenance();
        restartStoreAfterRestore();
      }
    }
  },
  chooseRestore: async (password) => {
    if (get().status === 'working') return;
    pendingArchive = null;
    set({ status: 'working', message: 'Opening encrypted backup…', preview: null });
    let localPath: string | null = null;
    try {
      localPath = await pickerOpen();
      if (localPath === null) { set({ status: 'idle', message: 'Restore cancelled. Your data is unchanged.' }); return; }
      validatePortableBackupFileSize((await fs().stat(localPath)).size);
      const opened = await openBackup(asText(await fs().readFile(localPath, 'utf8')), password, mobileBackupCrypto);
      if (!opened.ok) throw new Error(opened.message);
      const decision = decideRestore('replace', opened.archive, {
        readerSchemaVersion: SCHEMA_VERSION,
        supportedSourceSchemaVersions: [SCHEMA_VERSION],
        readerMigrationSlot: MIGRATION_SLOT,
        supportedSourceMigrationSlots: [MIGRATION_SLOT],
      });
      if (!decision.ok) throw new Error(decision.message);
      pendingArchive = opened.archive;
      set({
        status: 'preview', message: 'Review this backup before replacing data.',
        preview: {
          backupId: opened.archive.backupId, createdAt: opened.archive.createdAt,
          athleteNames: opened.archive.registry.athletes.map((entry) => entry.name),
          databaseCount: opened.archive.databases.length,
          totalBytes: opened.archive.databases.reduce((sum, database) => sum + database.byteLength, 0),
          replaceOnly: true,
        },
      });
    } catch (error) {
      pendingArchive = null;
      set({ status: 'error', message: error instanceof Error ? error.message : 'Backup could not be opened.', preview: null });
    } finally { if (localPath !== null) await removeIfPresent(localPath); }
  },
  confirmRestore: async (password) => {
    const incoming = pendingArchive;
    if (incoming === null || get().status !== 'preview') return;
    set({ status: 'working', message: 'Creating and verifying a recovery backup…' });
    let recoveryWork: string | null = null;
    let temporaryRecoveryPath: string | null = null;
    let releaseMaintenance: (() => void) | null = null;
    let safeToRestart = true;
    try {
      releaseMaintenance = acquireDataMaintenanceLock('encrypted-restore');
      revokeAthleteDataBoot();
      closeStoreDatabaseForRestore();
      const recovery = await createEncryptedBytes(password, get().lastSuccessfulBackupAt);
      recoveryWork = recovery.workDirectory;
      const recoveryPath = `${fs().dirs.DocumentDir}/${RECOVERY_BACKUP_FILE}`;
      temporaryRecoveryPath = `${recoveryPath}.new`;
      await fs().writeFile(temporaryRecoveryPath, recovery.text, 'utf8');
      const verified = await openBackup(asText(await fs().readFile(temporaryRecoveryPath, 'utf8')), password, mobileBackupCrypto);
      if (!verified.ok) throw new Error('The recovery backup could not be verified. Existing data is unchanged.');
      await removeIfPresent(recoveryPath);
      if (!(await fs().mv(temporaryRecoveryPath, recoveryPath))) throw new Error('The verified recovery backup could not be retained. Existing data is unchanged.');
      validatePortableBackupFileSize((await fs().stat(recoveryPath)).size);
      const retained = await openBackup(asText(await fs().readFile(recoveryPath, 'utf8')), password, mobileBackupCrypto);
      if (!retained.ok || retained.archive.backupId !== verified.archive.backupId) {
        throw new Error('The retained recovery backup could not be verified. Existing data is unchanged.');
      }
      set({ status: 'working', message: 'Recovery backup verified. Replacing all athlete data…' });
      await replaceAllData(incoming);
      pendingArchive = null;
      set({ status: 'success', message: 'Restore complete. All athlete data was replaced from the backup.', preview: null });
    } catch (error) {
      safeToRestart = !(error instanceof RestoreRecoveryRequiredError);
      set({ status: 'error', message: error instanceof Error ? error.message : 'Restore failed. Earlier data was recovered.', preview: null });
    } finally {
      pendingArchive = null;
      if (recoveryWork !== null) await removeIfPresent(recoveryWork);
      if (temporaryRecoveryPath !== null) await removeIfPresent(temporaryRecoveryPath);
      if (releaseMaintenance !== null) releaseMaintenance();
      if (releaseMaintenance !== null && safeToRestart) {
        authorizeAthleteDataBoot();
        restartStoreAfterRestore();
      }
    }
  },
  cancelRestore: () => { pendingArchive = null; set({ status: 'idle', message: 'Restore cancelled. Your data is unchanged.', preview: null }); },
}));
