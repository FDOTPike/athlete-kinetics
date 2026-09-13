import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

let mockRoot;
let mockDocumentDir;
let mockCacheDir;
let mockLibraryDir;
let mockSelectedBackupPath;
let mockSelectedSize;
let mockRegistryStageMode = 'reorder';
let mockFailIncomingMove = false;
let mockFailRollbackCopy = false;
let mockFileOps = [];
const mockKeepLocalCopy = jest.fn(async () => {
  const localPath = `${mockCacheDir}/selected-local.pmbak`;
  require('node:fs').copyFileSync(mockSelectedBackupPath, localPath);
  return [{ status: 'success', localUri: localPath }];
});
const mockSaveDocuments = jest.fn(async ({ sourceUris }) => {
  expect(sourceUris[0]).toMatch(/\/ak-portable-[a-f0-9]{32}\.pmbak$/);
  expect(readdirSync(mockCacheDir).filter((name) => /^ak-backup-/.test(name))).toEqual([]);
  return [{ error: null, uri: 'content://saved/backup' }];
});

const mockHashFile = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const mockFs = {
  dirs: { DocumentDir: '', CacheDir: '', LibraryDir: '' },
  async exists(path) { return existsSync(path); },
  async readFile(path, encoding) {
    return encoding === 'base64' ? readFileSync(path).toString('base64') : readFileSync(path, 'utf8');
  },
  async writeFile(path, data, encoding) {
    mockFileOps.push(['write', path]);
    mkdirSync(dirname(path), { recursive: true });
    let output = data;
    if (path.includes('.ak-registry-') && path.endsWith('.new')) {
      const registry = JSON.parse(data);
      if (mockRegistryStageMode === 'reorder') {
        output = JSON.stringify({
          advancedToolsUnlocked: registry.advancedToolsUnlocked,
          athletes: [...registry.athletes].reverse().map((entry) => ({
            createdAtMs: entry.createdAtMs, dbName: entry.dbName, name: entry.name, id: entry.id,
          })),
          activeId: registry.activeId,
          version: registry.version,
        });
      } else if (mockRegistryStageMode === 'sanitize') {
        output = JSON.stringify({ ...registry, athletes: registry.athletes.map((entry, index) =>
          index === 0 ? { ...entry, name: ` ${entry.name} ` } : entry) });
      }
    }
    writeFileSync(path, encoding === 'base64' ? Buffer.from(output, 'base64') : output);
  },
  async unlink(path) { mockFileOps.push(['unlink', path]); rmSync(path, { recursive: true, force: true }); },
  async mkdir(path) { mkdirSync(path, { recursive: true }); },
  async ls(path) { return existsSync(path) ? readdirSync(path) : []; },
  async cp(path, destination) {
    if (mockFailRollbackCopy && path.includes('.ak-rollback-')) return false;
    copyFileSync(path, destination); return true;
  },
  async mv(path, destination) {
    if (mockFailIncomingMove && path.includes('.ak-incoming-')) return false;
    mockFileOps.push(['move', path, destination]);
    renameSync(path, destination); return true;
  },
  async stat(path) { return { size: statSync(path).size }; },
  async hash(path) { return mockHashFile(path); },
  async df() { return { internal_free: 1024 * 1024 * 1024 }; },
};

const mockCryptoProvider = {
  randomBytes(length) { return new Uint8Array(randomBytes(length)); },
  async deriveScryptKey(password, salt) {
    return new Uint8Array(createHash('sha256').update(password).update(salt).digest());
  },
  async encryptAes256Gcm(key, nonce, plaintext, aad) {
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(aad);
    return new Uint8Array(Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]));
  },
  async decryptAes256Gcm(key, nonce, encrypted, aad) {
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAAD(aad);
    decipher.setAuthTag(encrypted.subarray(encrypted.length - 16));
    return new Uint8Array(Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]));
  },
  sha256Hex(bytes) { return createHash('sha256').update(bytes).digest('hex'); },
  utf8Encode(text) { return new Uint8Array(Buffer.from(text, 'utf8')); },
  utf8Decode(bytes) { return Buffer.from(bytes).toString('utf8'); },
};

const mockCloseStore = jest.fn();
const mockRestartStore = jest.fn();

function mockOpenDatabase(options) {
  const path = `${options.location ?? mockLibraryDir}/${options.name}`;
  const raw = new DatabaseSync(path);
  return {
    executeSync(sql) {
      const statement = sql.trim();
      if (/^(?:SELECT|PRAGMA\s+(?![^;=]+\s*=))/i.test(statement)) return { rows: raw.prepare(statement).all() };
      raw.exec(statement);
      return { rows: [] };
    },
    close() { raw.close(); },
  };
}

jest.mock('react-native-blob-util', () => ({ default: { fs: mockFs } }));
jest.mock('@op-engineering/op-sqlite', () => ({ open: (options) => mockOpenDatabase(options) }));
jest.mock('../../src/state/backupCrypto', () => ({
  mobileBackupCrypto: {
    randomBytes: (...args) => mockCryptoProvider.randomBytes(...args),
    deriveScryptKey: (...args) => mockCryptoProvider.deriveScryptKey(...args),
    encryptAes256Gcm: (...args) => mockCryptoProvider.encryptAes256Gcm(...args),
    decryptAes256Gcm: (...args) => mockCryptoProvider.decryptAes256Gcm(...args),
    sha256Hex: (...args) => mockCryptoProvider.sha256Hex(...args),
    utf8Encode: (...args) => mockCryptoProvider.utf8Encode(...args),
    utf8Decode: (...args) => mockCryptoProvider.utf8Decode(...args),
  },
}));
jest.mock('../../src/state/useStore', () => ({
  closeStoreDatabaseForRestore: (...args) => mockCloseStore(...args),
  restartStoreAfterRestore: (...args) => mockRestartStore(...args),
}));
jest.mock('@react-native-documents/picker', () => ({
  pick: async () => [{ uri: mockSelectedBackupPath, name: 'selected.pmbak', size: mockSelectedSize }],
  keepLocalCopy: (...args) => mockKeepLocalCopy(...args),
  saveDocuments: (...args) => mockSaveDocuments(...args),
  isErrorWithCode: () => false,
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
}));

import {
  BACKUP_SCHEMA_MIGRATION_SLOT,
  BACKUP_SCHEMA_TABLE_COUNT,
  BACKUP_SCHEMA_USER_VERSION,
  bytesToBase64,
  sealBackup,
} from '@ak/core-db';
import { serializeRegistry } from '../../src/state/athleteRegistryCore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import { recoverInterruptedRestore, useBackupStore } from '../../src/state/backupStore';

const schemaDirectory = join(__dirname, '..', '..', '..', '..', 'packages', 'core-db', 'src', 'schema');

function makeDatabase(path, applicationId) {
  const db = new DatabaseSync(path);
  for (const name of readdirSync(schemaDirectory).filter((item) => /^0\d\d_.*\.sql$/.test(item) && !item.startsWith('004_')).sort()) {
    db.exec(readFileSync(join(schemaDirectory, name), 'utf8'));
  }
  db.exec(`PRAGMA user_version=${BACKUP_SCHEMA_USER_VERSION}; PRAGMA application_id=${applicationId};`);
  assert.equal(db.prepare('PRAGMA quick_check').get().quick_check, 'ok');
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().count,
    BACKUP_SCHEMA_TABLE_COUNT);
  db.close();
  return new Uint8Array(readFileSync(path));
}

function snapshot(athleteId, dbName, bytes) {
  return {
    athleteId,
    dbName,
    byteLength: bytes.length,
    sha256Hex: mockCryptoProvider.sha256Hex(bytes),
    userVersion: BACKUP_SCHEMA_USER_VERSION,
    tableCount: BACKUP_SCHEMA_TABLE_COUNT,
    databaseBase64: bytesToBase64(bytes),
  };
}

function artifactNames() {
  return [...readdirSync(mockDocumentDir), ...readdirSync(mockLibraryDir), ...readdirSync(mockCacheDir)];
}

let currentRegistry;
let incomingRegistry;
let currentHashes;
let incomingHashes;

beforeEach(async () => {
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  mockCloseStore.mockClear();
  mockRestartStore.mockClear();
  mockRegistryStageMode = 'reorder';
  mockFailIncomingMove = false;
  mockFailRollbackCopy = false;
  mockFileOps = [];
  mockKeepLocalCopy.mockClear();
  mockSaveDocuments.mockClear();
  mockRoot = mkdtempSync(join(tmpdir(), 'ak-backup-store-'));
  mockDocumentDir = join(mockRoot, 'Documents').replaceAll('\\', '/');
  mockCacheDir = join(mockRoot, 'Cache').replaceAll('\\', '/');
  mockLibraryDir = join(mockRoot, 'Library').replaceAll('\\', '/');
  for (const path of [mockDocumentDir, mockCacheDir, mockLibraryDir]) mkdirSync(path, { recursive: true });
  Object.assign(mockFs.dirs, { DocumentDir: mockDocumentDir, CacheDir: mockCacheDir, LibraryDir: mockLibraryDir });

  currentRegistry = {
    version: 1,
    activeId: 'default',
    advancedToolsUnlocked: false,
    athletes: [
      { id: 'default', name: 'Current', dbName: 'athlete_kinetics.db', createdAtMs: 0 },
      { id: 'old1', name: 'Obsolete', dbName: 'ak_athlete_old1.db', createdAtMs: 1 },
    ],
  };
  incomingRegistry = {
    version: 1,
    activeId: 'a123',
    advancedToolsUnlocked: true,
    athletes: [
      { id: 'default', name: 'Restored default', dbName: 'athlete_kinetics.db', createdAtMs: 0 },
      { id: 'a123', name: 'Alex', dbName: 'ak_athlete_a123.db', createdAtMs: 123 },
    ],
  };
  writeFileSync(join(mockDocumentDir, 'coach_athletes.json'), serializeRegistry(currentRegistry));
  const currentDefault = makeDatabase(join(mockLibraryDir, 'athlete_kinetics.db'), 101);
  const currentObsolete = makeDatabase(join(mockLibraryDir, 'ak_athlete_old1.db'), 102);
  currentHashes = {
    default: mockCryptoProvider.sha256Hex(currentDefault),
    obsolete: mockCryptoProvider.sha256Hex(currentObsolete),
  };
  const incomingDirectory = join(mockRoot, 'Incoming');
  mkdirSync(incomingDirectory);
  const incomingDefault = makeDatabase(join(incomingDirectory, 'athlete_kinetics.db'), 201);
  const incomingAlex = makeDatabase(join(incomingDirectory, 'ak_athlete_a123.db'), 202);
  incomingHashes = {
    default: mockCryptoProvider.sha256Hex(incomingDefault),
    alex: mockCryptoProvider.sha256Hex(incomingAlex),
  };
  const archive = {
    archiveVersion: 1,
    backupId: '00112233445566778899aabbccddeeff',
    createdAt: '2026-09-13T05:00:00.000Z',
    sourceAppVersion: '0.1.0',
    sourceSchemaVersion: BACKUP_SCHEMA_USER_VERSION,
    sourceMigrationSlot: BACKUP_SCHEMA_MIGRATION_SLOT,
    scope: 'all-athletes',
    restorePolicy: 'replace',
    registry: incomingRegistry,
    databases: [
      snapshot('default', 'athlete_kinetics.db', incomingDefault),
      snapshot('a123', 'ak_athlete_a123.db', incomingAlex),
    ],
    previousSuccessfulBackupAt: null,
  };
  mockSelectedBackupPath = join(mockRoot, 'selected.pmbak');
  writeFileSync(mockSelectedBackupPath, await sealBackup(archive, 'restore-password', mockCryptoProvider));
  mockSelectedSize = statSync(mockSelectedBackupPath).size;
  useBackupStore.getState().cancelRestore();
  useBackupStore.setState({ status: 'idle', startupSafe: true, message: null, preview: null, lastSuccessfulBackupAt: null });
});

afterEach(() => rmSync(mockRoot, { recursive: true, force: true }));

test('real backup store restores exact databases and semantic registry regardless of staged array/key order', async () => {
  await useBackupStore.getState().chooseRestore('restore-password');
  expect(useBackupStore.getState().status).toBe('preview');
  expect(useBackupStore.getState().preview).toMatchObject({ databaseCount: 2, replaceOnly: true });

  await useBackupStore.getState().confirmRestore('restore-password');
  expect(useBackupStore.getState().status).toBe('success');
  expect(mockHashFile(join(mockLibraryDir, 'athlete_kinetics.db'))).toBe(incomingHashes.default);
  expect(mockHashFile(join(mockLibraryDir, 'ak_athlete_a123.db'))).toBe(incomingHashes.alex);
  expect(mockHashFile(join(mockLibraryDir, 'athlete_kinetics.db'))).not.toBe(currentHashes.default);
  expect(existsSync(join(mockLibraryDir, 'ak_athlete_old1.db'))).toBe(false);

  const rawRegistry = readFileSync(join(mockDocumentDir, 'coach_athletes.json'), 'utf8');
  const installed = JSON.parse(rawRegistry);
  expect(installed.activeId).toBe(incomingRegistry.activeId);
  expect(installed.advancedToolsUnlocked).toBe(incomingRegistry.advancedToolsUnlocked);
  expect([...installed.athletes].sort((a, b) => a.id.localeCompare(b.id)))
    .toEqual([...incomingRegistry.athletes].sort((a, b) => a.id.localeCompare(b.id)));
  expect(rawRegistry).not.toBe(serializeRegistry(incomingRegistry));

  expect(artifactNames().filter((name) => /^\.ak-(?:incoming|rollback|registry)|^\.ak_restore_|^ak-backup-/.test(name))).toEqual([]);
  expect(existsSync(join(mockDocumentDir, 'pikeMethods-recovery-current.pmbak'))).toBe(true);
  expect(mockRestartStore).toHaveBeenCalledTimes(1);

  const journalPath = `${mockDocumentDir}/.ak_restore_journal.json`;
  const journalTempWrite = mockFileOps.findIndex(([kind, path]) => kind === 'write'
    && /^.*\/\.ak_restore_journal-[a-f0-9]{32}\.new$/.test(path));
  const journalMove = mockFileOps.findIndex(([kind, source, destination]) => kind === 'move'
    && /^.*\/\.ak_restore_journal-[a-f0-9]{32}\.new$/.test(source) && destination === journalPath);
  expect(journalTempWrite).toBeGreaterThanOrEqual(0);
  expect(journalMove).toBeGreaterThan(journalTempWrite);
  expect(mockFileOps.some(([kind, path]) => kind === 'write' && path === journalPath)).toBe(false);

  const markerTempWrites = mockFileOps.filter(([kind, path]) => kind === 'write'
    && /^.*\/\.ak_restore_(?:applying|committed)-[a-f0-9]{32}\.new$/.test(path));
  const markerPublishes = mockFileOps.filter(([kind, source, destination]) => kind === 'move'
    && /^.*\/\.ak_restore_(?:applying|committed)-[a-f0-9]{32}\.new$/.test(source)
    && /^.*\/\.ak_restore_(?:applying|committed)-[a-f0-9]{32}$/.test(destination));
  expect(markerTempWrites).toHaveLength(2);
  expect(markerPublishes).toHaveLength(2);

  const markerCleanupIndices = mockFileOps
    .map(([kind, path], index) => kind === 'unlink'
      && /^.*\/\.ak_restore_(?:applying|committed)-[a-f0-9]{32}$/.test(path) ? index : -1)
    .filter((index) => index >= 0);
  const journalCleanupIndex = mockFileOps.findIndex(([kind, path]) => kind === 'unlink' && path === journalPath);
  expect(markerCleanupIndices).toHaveLength(2);
  const committedCleanupIndex = mockFileOps.findIndex(([kind, path]) => kind === 'unlink'
    && /^.*\/\.ak_restore_committed-[a-f0-9]{32}$/.test(path));
  const applyingCleanupIndex = mockFileOps.findIndex(([kind, path]) => kind === 'unlink'
    && /^.*\/\.ak_restore_applying-[a-f0-9]{32}$/.test(path));
  expect(committedCleanupIndex).toBeLessThan(applyingCleanupIndex);
  expect(journalCleanupIndex).toBeGreaterThan(Math.max(...markerCleanupIndices));
});

test('staged registry validation rejects content that only matches after boot-time sanitization', async () => {
  mockRegistryStageMode = 'sanitize';
  await useBackupStore.getState().chooseRestore('restore-password');
  await useBackupStore.getState().confirmRestore('restore-password');

  expect(useBackupStore.getState().status).toBe('error');
  expect(useBackupStore.getState().message).toMatch(/registry failed validation/);
  expect(mockHashFile(join(mockLibraryDir, 'athlete_kinetics.db'))).toBe(currentHashes.default);
  expect(mockHashFile(join(mockLibraryDir, 'ak_athlete_old1.db'))).toBe(currentHashes.obsolete);
  expect(existsSync(join(mockLibraryDir, 'ak_athlete_a123.db'))).toBe(false);
  expect(readFileSync(join(mockDocumentDir, 'coach_athletes.json'), 'utf8')).toBe(serializeRegistry(currentRegistry));
  expect(artifactNames().filter((name) => /^\.ak-(?:incoming|rollback|registry)|^\.ak_restore_|^ak-backup-/.test(name))).toEqual([]);
});

test.each([null, 16 * 1024 * 1024 + 1])('unknown or oversized picker metadata %p is rejected before native copy', async (size) => {
  mockSelectedSize = size;
  await useBackupStore.getState().chooseRestore('restore-password');
  expect(useBackupStore.getState().status).toBe('error');
  expect(mockKeepLocalCopy).not.toHaveBeenCalled();
});

test('backup removes and confirms plaintext snapshots before opening the OS save flow', async () => {
  await useBackupStore.getState().createBackup('restore-password');
  expect(useBackupStore.getState().status).toBe('success');
  expect(mockSaveDocuments).toHaveBeenCalledTimes(1);
  expect(readdirSync(mockCacheDir).filter((name) => /^ak-backup-|^ak-portable-/.test(name))).toEqual([]);
});

test('previous recovery is absent or wrong-password fail-closed without exposing a path', async () => {
  await useBackupStore.getState().reviewRecovery('restore-password');
  expect(useBackupStore.getState().message).toBe('No previous data recovery is available.');
  expect(useBackupStore.getState().recoveryAvailable).toBe(false);

  copyFileSync(mockSelectedBackupPath, join(mockDocumentDir, 'pikeMethods-recovery-current.pmbak'));
  useBackupStore.setState({ status: 'idle', recoveryAvailable: true, message: null });
  await useBackupStore.getState().reviewRecovery('wrong-password');
  expect(useBackupStore.getState().message)
    .toBe('Previous data recovery could not be opened. Check the password from the previous restore.');
  expect(useBackupStore.getState().message).not.toContain(mockDocumentDir);
  expect(existsSync(join(mockDocumentDir, 'pikeMethods-recovery-current.pmbak'))).toBe(true);
});

test('previous recovery uses the same preview and confirmed replace path', async () => {
  copyFileSync(mockSelectedBackupPath, join(mockDocumentDir, 'pikeMethods-recovery-current.pmbak'));
  useBackupStore.setState({ status: 'idle', recoveryAvailable: true, message: null });
  await useBackupStore.getState().reviewRecovery('restore-password');
  expect(useBackupStore.getState()).toMatchObject({ status: 'preview', recoveryAvailable: true });
  expect(useBackupStore.getState().preview).toMatchObject({ databaseCount: 2, replaceOnly: true });

  await useBackupStore.getState().confirmRestore('restore-password');
  expect(useBackupStore.getState()).toMatchObject({ status: 'success', recoveryAvailable: true });
  expect(mockHashFile(join(mockLibraryDir, 'athlete_kinetics.db'))).toBe(incomingHashes.default);
  expect(mockHashFile(join(mockLibraryDir, 'ak_athlete_a123.db'))).toBe(incomingHashes.alex);
  expect(existsSync(join(mockLibraryDir, 'ak_athlete_old1.db'))).toBe(false);
  expect(artifactNames().filter((name) => /^\.ak-(?:incoming|rollback|registry)|^\.ak_restore_|^ak-backup-/.test(name))).toEqual([]);
});

test('rollback failure latches recovery, rejects retries, and initialize heals before reauthorization', async () => {
  await useBackupStore.getState().chooseRestore('restore-password');
  expect(useBackupStore.getState().status).toBe('preview');
  mockFailIncomingMove = true;
  mockFailRollbackCopy = true;
  await useBackupStore.getState().confirmRestore('restore-password');

  expect(useBackupStore.getState().startupSafe).toBe(false);
  expect(useBackupStore.getState().status).toBe('error');
  expect(mockRestartStore).not.toHaveBeenCalled();
  expect(existsSync(join(mockDocumentDir, '.ak_restore_journal.json'))).toBe(true);
  const frozenArtifacts = artifactNames().sort();

  await useBackupStore.getState().createBackup('restore-password');
  await useBackupStore.getState().chooseRestore('restore-password');
  await useBackupStore.getState().reviewRecovery('restore-password');
  await useBackupStore.getState().confirmRestore('restore-password');
  useBackupStore.getState().cancelRestore();
  expect(useBackupStore.getState().startupSafe).toBe(false);
  expect(useBackupStore.getState().message).toMatch(/Data recovery must finish/);
  expect(artifactNames().sort()).toEqual(frozenArtifacts);
  expect(mockRestartStore).not.toHaveBeenCalled();

  mockFailIncomingMove = false;
  mockFailRollbackCopy = false;
  await expect(useBackupStore.getState().initialize()).resolves.toBe(true);
  expect(useBackupStore.getState().startupSafe).toBe(true);
  expect(mockHashFile(join(mockLibraryDir, 'athlete_kinetics.db'))).toBe(currentHashes.default);
  expect(mockHashFile(join(mockLibraryDir, 'ak_athlete_old1.db'))).toBe(currentHashes.obsolete);
  expect(existsSync(join(mockDocumentDir, '.ak_restore_journal.json'))).toBe(false);

  authorizeAthleteDataBoot();
  await useBackupStore.getState().chooseRestore('restore-password');
  expect(useBackupStore.getState().status).toBe('preview');
});

test('a stale legacy marker cannot poison a newer preparation journal', async () => {
  const operationId = '0123456789abcdef0123456789abcdef';
  writeFileSync(join(mockDocumentDir, '.ak_restore_applying'), 'ffffffffffffffffffffffffffffffff');
  writeFileSync(join(mockDocumentDir, '.ak_restore_journal.json'), JSON.stringify({
    version: 1,
    operationId,
    entries: [],
    registryTargetPath: `${mockDocumentDir}/coach_athletes.json`,
    registryStagedPath: `${mockDocumentDir}/.ak-registry-${operationId}.new`,
    registryRollbackPath: `${mockDocumentDir}/.ak-registry-${operationId}.old`,
    registryExistedBefore: true,
  }));
  const registryHashBefore = mockHashFile(join(mockDocumentDir, 'coach_athletes.json'));
  await expect(recoverInterruptedRestore()).resolves.toBe(false);
  expect(existsSync(join(mockDocumentDir, '.ak_restore_journal.json'))).toBe(false);
  expect(existsSync(join(mockDocumentDir, '.ak_restore_applying'))).toBe(false);
  expect(mockHashFile(join(mockDocumentDir, 'coach_athletes.json'))).toBe(registryHashBefore);
});
