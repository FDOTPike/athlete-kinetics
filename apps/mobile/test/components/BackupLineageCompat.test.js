/**
 * BackupLineageCompat.test.js — encrypted backup and restore for installs that
 * reached this build from the MASTER lineage (1da218d), not only the feature
 * lineage the backup contracts were measured on.
 *
 * A master install holds master's exact 058 text for suspension_episode
 * (CREATE TABLE IF NOT EXISTS never rewrites it), so its upgraded schema
 * differs from a fresh install by that one string. These tests run the REAL
 * backup store, the REAL production `migrate` (with its lineage
 * reconciliation) and real AES-GCM over real SQLite files, and pin:
 *
 *   - a populated master-upgraded athlete backs up, and the archive restores
 *     every row byte-for-byte, through the exact known-lineage equivalence;
 *   - a coached athlete still at master v34 (not opened since the update) is
 *     backed up by forward-migrating an isolated copy; the live file is untouched;
 *   - any OTHER suspension_episode text — local or inside an archive — still
 *     fails the schema contract with live data byte-identical;
 *   - an unidentifiable user_version 34 file fails closed and changes nothing.
 *
 * The file-system, crypto and SQLite stand-ins are BackupForwardRestore's.
 */
import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

let mockRoot;
let mockDocumentDir;
let mockCacheDir;
let mockLibraryDir;
let mockSelectedBackupPath;
let mockSelectedSize;
let mockRegistryStageMode = 'reorder';
let mockFailIncomingMove = false;
let mockFailRollbackCopy = false;
let mockDropRecoveryMove = false;
let mockFileOps = [];
const mockKeepLocalCopy = jest.fn(async () => {
  const localPath = `${mockCacheDir}/selected-local.pmbak`;
  require('node:fs').copyFileSync(mockSelectedBackupPath, localPath);
  return [{ status: 'success', localUri: localPath }];
});
let mockSavedBackupPath;
// The OS "save" flow: keep the encrypted file the app handed over so a test
// can restore from the exact backup that was just created.
const mockSaveDocuments = jest.fn(async ({ sourceUris }) => {
  expect(sourceUris[0]).toMatch(/\/ak-portable-[a-f0-9]{32}\/pikeMethods-\d{4}-\d{2}-\d{2}\.pmbak$/);
  expect(readdirSync(mockCacheDir).filter((name) => /^ak-backup-/.test(name))).toEqual([]);
  mockSavedBackupPath = `${mockRoot}/saved.pmbak`;
  require('node:fs').copyFileSync(sourceUris[0].slice('file://'.length), mockSavedBackupPath);
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
    copyFileSync(path, destination); return undefined;
  },
  async mv(path, destination) {
    if (mockFailIncomingMove && path.includes('.ak-incoming-')) return false;
    if (mockDropRecoveryMove && path.endsWith('pikeMethods-recovery-current.pmbak.new')) return undefined;
    mockFileOps.push(['move', path, destination]);
    renameSync(path, destination); return undefined;
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
  types: { allFiles: 'public.item' }, // the installed library's iOS all-files identifier
  pick: async () => [{ uri: mockSelectedBackupPath, name: 'selected.pmbak', size: mockSelectedSize }],
  keepLocalCopy: (...args) => mockKeepLocalCopy(...args),
  saveDocuments: (...args) => mockSaveDocuments(...args),
  isErrorWithCode: () => false,
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
}));

// Forward-migration failure injection: the staged-copy migration is the
// production `migrate`; a test can make it throw to prove nothing live changes.
let mockMigrateFailure = null;
jest.mock('@ak/core-db', () => {
  const actual = jest.requireActual('@ak/core-db');
  return {
    ...actual,
    migrate: (db) => {
      if (mockMigrateFailure !== null) throw new Error(mockMigrateFailure);
      return actual.migrate(db);
    },
  };
});

import {
  CURRENT_BACKUP_SCHEMA_CONTRACT,
  FEATURE_058_SUSPENSION_EPISODE_SQL,
  MASTER_058_SUSPENSION_EPISODE_SQL,
  bytesToBase64,
  base64ToBytes,
  matchesBackupSchemaContract,
  migrate,
  openBackup,
  sealBackup,
} from '@ak/core-db';
import { serializeRegistry } from '../../src/state/athleteRegistryCore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import { useBackupStore } from '../../src/state/backupStore';

// BackupRecoveryRetention shows what a cold first run of this harness costs.
jest.setTimeout(180_000);

const CURRENT = CURRENT_BACKUP_SCHEMA_CONTRACT;
const PASSWORD = 'lineage-password';
const coreDb = join(__dirname, '..', '..', '..', '..', 'packages', 'core-db');
const schemaDirectory = join(coreDb, 'src', 'schema');
const masterFixture = join(coreDb, 'test', 'fixtures', 'lineage', 'master-1da218d');
const registryFiles = (source) => {
  const imports = Object.fromEntries([...source.matchAll(/import (m\d+) from '\.\/schema\/([^']+)'/g)].map((m) => [m[1], m[2]]));
  return source.match(/MIGRATIONS[^=]*=\s*\[([^\]]+)\]/s)[1].split(',').map((x) => x.trim()).filter(Boolean).map((id) => imports[id]);
};
const MASTER_FILES = registryFiles(readFileSync(join(masterFixture, 'migrations.master.ts.txt'), 'utf8'));
const masterSql = (file) => readFileSync(join(
  ['034_autopilot_attribution.sql', '058_suspension_episode.sql'].includes(file) ? masterFixture : schemaDirectory, file), 'utf8');

/** Exactly what a master 1da218d install leaves on disk, with athlete rows. */
function makeMasterDatabase(path, label) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  MASTER_FILES.forEach((file, index) => {
    db.exec('BEGIN'); db.exec(masterSql(file)); db.exec(`PRAGMA user_version = ${index + 1}`); db.exec('COMMIT');
  });
  db.prepare("INSERT INTO session (session_id, micro_cycle_id, session_date, started_at_ms, duration_min, session_rpe) VALUES (?, NULL, '2026-09-01', 1000, 42.5, 7.5)").run(label.length);
  const movementId = Number(db.prepare('SELECT MIN(movement_id) AS id FROM movement').get().id);
  for (let set = 1; set <= 3; set += 1) {
    db.prepare('INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (?, ?, ?, 5, ?, 8, ?)')
      .run(label.length, movementId, set, 40 + set * 2.5, 2000 + set);
  }
  db.exec(`INSERT INTO training_program (program_id, objective, start_date, horizon_kind, requested_review_date, planned_end_date,
      planned_block_count, starting_macro_block_index, schema_type, status, created_at_ms, updated_at_ms)
    VALUES (1, 'strength', '2026-09-01', 'weeks', NULL, '2026-11-24', 3, 1, 'LINEAR', 'active', 10, 10)`);
  db.exec("INSERT INTO training_block (block_id, start_date, objective, created_at_ms) VALUES (501, '2026-09-01', 'strength', 10)");
  db.exec('INSERT INTO training_block_program (block_id, program_id, sequence_index) VALUES (501, 1, 1)');
  db.exec("INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (9001, 501, 1, 1, 'full', 'accumulation', '2026-09-01')");
  db.prepare('INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (70001, 9001, 1, ?, 3, 5, 7.5)').run(movementId);
  db.exec("INSERT INTO planned_slot_autopilot (planned_slot_id, rpe_delta, set_delta, reason) VALUES (70001, -0.5, -1, 'eased')");
  db.exec(`INSERT INTO suspension_episode (episode_id, started_at_ms, ended_at_ms, reason, frozen_macro_index)
    VALUES (1, 100, 200, 'illness', 2), (2, 300, NULL, 'injury', 3)`);
  expect(Number(db.prepare('PRAGMA user_version').get().user_version)).toBe(34);
  db.close();
}

/** Boot this build on that file: the production `migrate` (lineage-aware). */
function bootUpgrade(path) {
  const handle = mockOpenDatabase({ name: basename(path), location: dirname(path) });
  try { migrate(handle); } finally { handle.close(); }
}

const open = (path) => new DatabaseSync(path);
const schemaObjects = (db) => db.prepare("SELECT type,name,tbl_name,coalesce(sql,'') AS sql FROM sqlite_master WHERE type IN ('table','index','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type,name").all()
  .map((object) => [object.type, object.name, object.tbl_name, object.sql, object.type === 'table'
    ? db.prepare(`PRAGMA table_info("${object.name.replaceAll('"', '""')}")`).all()
      .map((column) => [column.cid, column.name, column.type, column.notnull, column.dflt_value, column.pk]) : []]);
const describe_ = (path) => {
  const db = open(path);
  try {
    return {
      userVersion: Number(db.prepare('PRAGMA user_version').get().user_version),
      current: matchesBackupSchemaContract(schemaObjects(db), CURRENT, mockCryptoProvider),
      suspensionText: db.prepare("SELECT sql FROM sqlite_master WHERE name = 'suspension_episode'").get()?.sql ?? null,
      quickCheck: db.prepare('PRAGMA quick_check').get().quick_check,
      foreignKeyProblems: db.prepare('PRAGMA foreign_key_check').all().length,
    };
  } finally { db.close(); }
};
const athleteData = (path) => {
  const db = open(path);
  try {
    return JSON.stringify({
      sessions: db.prepare('SELECT * FROM session ORDER BY session_id').all(),
      sets: db.prepare('SELECT * FROM set_record ORDER BY set_id').all(),
      programs: db.prepare('SELECT * FROM training_program ORDER BY program_id').all(),
      blocks: db.prepare('SELECT * FROM training_block_program ORDER BY block_id').all(),
      slots: db.prepare('SELECT * FROM planned_slot ORDER BY planned_slot_id').all(),
      autopilot: db.prepare('SELECT * FROM planned_slot_autopilot ORDER BY planned_slot_id').all(),
      suspension: db.prepare('SELECT * FROM suspension_episode ORDER BY episode_id').all(),
      profile: db.prepare('SELECT * FROM athlete_profile').all(),
    });
  } finally { db.close(); }
};
const tamperSuspensionText = (path, text) => {
  // Defensive mode (node:sqlite's default) forbids writable_schema; a hostile
  // or corrupted file is exactly what this simulates, so it is lifted here only.
  const db = new DatabaseSync(path, { defensive: false });
  try {
    db.exec('PRAGMA writable_schema = ON');
    db.prepare("UPDATE sqlite_master SET sql = ? WHERE type = 'table' AND name = 'suspension_episode'").run(text);
    db.exec('PRAGMA writable_schema = OFF');
  } finally { db.close(); }
};
const artifacts = () => [...readdirSync(mockDocumentDir), ...readdirSync(mockLibraryDir), ...readdirSync(mockCacheDir)]
  .filter((name) => /^\.ak-(?:incoming|rollback|registry)|^\.ak_restore_|^ak-backup-|-wal$|-shm$|-journal$/.test(name));
const writeRegistry = (athletes, activeId = 'default') => writeFileSync(join(mockDocumentDir, 'coach_athletes.json'),
  serializeRegistry({ version: 1, activeId, advancedToolsUnlocked: false, athletes }));
const DEFAULT_ENTRY = { id: 'default', name: 'Master athlete', dbName: 'athlete_kinetics.db', createdAtMs: 0 };
const COACHED_ENTRY = { id: 'm2', name: 'Coached', dbName: 'ak_athlete_m2.db', createdAtMs: 1 };

beforeEach(() => {
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  mockMigrateFailure = null;
  mockCloseStore.mockClear();
  mockRestartStore.mockClear();
  mockRegistryStageMode = 'plain';
  mockFailIncomingMove = false;
  mockFailRollbackCopy = false;
  mockDropRecoveryMove = false;
  mockFileOps = [];
  mockRoot = mkdtempSync(join(tmpdir(), 'ak-lineage-backup-'));
  mockDocumentDir = join(mockRoot, 'Documents').replaceAll('\\', '/');
  mockCacheDir = join(mockRoot, 'Cache').replaceAll('\\', '/');
  mockLibraryDir = join(mockRoot, 'Library').replaceAll('\\', '/');
  for (const path of [mockDocumentDir, mockCacheDir, mockLibraryDir]) mkdirSync(path, { recursive: true });
  Object.assign(mockFs.dirs, { DocumentDir: mockDocumentDir, CacheDir: mockCacheDir, LibraryDir: mockLibraryDir });
  writeRegistry([DEFAULT_ENTRY]);
  mockSelectedBackupPath = join(mockRoot, 'selected.pmbak');
  useBackupStore.getState().cancelRestore();
  useBackupStore.setState({ status: 'idle', startupSafe: true, message: null, preview: null, lastSuccessfulBackupAt: null, recoveryAvailable: false });
});

afterEach(() => rmSync(mockRoot, { recursive: true, force: true }));

test('a populated master-lineage athlete opened by this build backs up and restores every row exactly', async () => {
  const livePath = join(mockLibraryDir, 'athlete_kinetics.db');
  makeMasterDatabase(livePath, 'master-live');
  bootUpgrade(livePath);
  // Upgraded by ordinary migration: current version, master's 058 text kept,
  // and the exact known-lineage equivalence makes it the current contract.
  expect(describe_(livePath)).toEqual({
    userVersion: CURRENT.userVersion, current: true, suspensionText: MASTER_058_SUSPENSION_EPISODE_SQL,
    quickCheck: 'ok', foreignKeyProblems: 0,
  });
  const before = athleteData(livePath);

  await useBackupStore.getState().createBackup(PASSWORD);
  expect(useBackupStore.getState()).toMatchObject({ status: 'success' });
  const opened = await openBackup(readFileSync(mockSavedBackupPath, 'utf8'), PASSWORD, mockCryptoProvider);
  expect(opened.ok).toBe(true);
  expect(opened.archive.databases.map((d) => [d.userVersion, d.tableCount])).toEqual([[CURRENT.userVersion, CURRENT.tableCount]]);
  const extracted = join(mockRoot, 'extracted.db');
  writeFileSync(extracted, Buffer.from(base64ToBytes(opened.archive.databases[0].databaseBase64)));
  expect(describe_(extracted)).toMatchObject({ current: true, suspensionText: MASTER_058_SUSPENSION_EPISODE_SQL });
  expect(athleteData(extracted)).toBe(before);

  // Lose the data, then restore it from that encrypted archive.
  const wipe = open(livePath);
  wipe.exec('DELETE FROM planned_slot_autopilot; DELETE FROM set_record; DELETE FROM session; DELETE FROM suspension_episode WHERE ended_at_ms IS NULL');
  wipe.close();
  expect(athleteData(livePath)).not.toBe(before);
  copyFileSync(mockSavedBackupPath, mockSelectedBackupPath);
  mockSelectedSize = statSync(mockSelectedBackupPath).size;
  useBackupStore.setState({ status: 'idle', message: null, preview: null });
  await useBackupStore.getState().chooseRestore(PASSWORD);
  expect(useBackupStore.getState().status).toBe('preview');
  await useBackupStore.getState().confirmRestore(PASSWORD);
  expect(useBackupStore.getState()).toMatchObject({ status: 'success' });
  expect(athleteData(livePath)).toBe(before);
  expect(describe_(livePath)).toMatchObject({ userVersion: CURRENT.userVersion, current: true, quickCheck: 'ok', foreignKeyProblems: 0 });
  expect(artifacts()).toEqual([]);
});

test('a feature-native athlete and a master-upgraded athlete back up and restore together', async () => {
  const featurePath = join(mockLibraryDir, 'athlete_kinetics.db');
  const featureDb = mockOpenDatabase({ name: 'athlete_kinetics.db' });
  migrate(featureDb); featureDb.close();
  const masterPath = join(mockLibraryDir, COACHED_ENTRY.dbName);
  makeMasterDatabase(masterPath, 'master-coached');
  bootUpgrade(masterPath);
  writeRegistry([DEFAULT_ENTRY, COACHED_ENTRY]);
  expect(describe_(featurePath)).toMatchObject({ current: true, suspensionText: FEATURE_058_SUSPENSION_EPISODE_SQL });
  const before = { feature: athleteData(featurePath), master: athleteData(masterPath) };

  await useBackupStore.getState().createBackup(PASSWORD);
  expect(useBackupStore.getState()).toMatchObject({ status: 'success' });
  for (const path of [featurePath, masterPath]) {
    const wipe = open(path);
    wipe.exec('DELETE FROM set_record; DELETE FROM session; DELETE FROM planned_slot_autopilot');
    wipe.close();
  }
  copyFileSync(mockSavedBackupPath, mockSelectedBackupPath);
  mockSelectedSize = statSync(mockSelectedBackupPath).size;
  useBackupStore.setState({ status: 'idle', message: null, preview: null });
  await useBackupStore.getState().chooseRestore(PASSWORD);
  await useBackupStore.getState().confirmRestore(PASSWORD);
  expect(useBackupStore.getState()).toMatchObject({ status: 'success' });
  expect(athleteData(featurePath)).toBe(before.feature);
  expect(athleteData(masterPath)).toBe(before.master);
  expect(describe_(masterPath)).toMatchObject({ current: true, suspensionText: MASTER_058_SUSPENSION_EPISODE_SQL });
  expect(artifacts()).toEqual([]);
});

test('a coached athlete still at master v34 is backed up from an isolated forward-migrated copy; the live file is untouched', async () => {
  const livePath = join(mockLibraryDir, 'athlete_kinetics.db');
  const live = mockOpenDatabase({ name: 'athlete_kinetics.db' });
  migrate(live); live.close();
  const stalePath = join(mockLibraryDir, COACHED_ENTRY.dbName);
  makeMasterDatabase(stalePath, 'not-opened-since-update');
  writeRegistry([DEFAULT_ENTRY, COACHED_ENTRY]);
  const staleHash = mockHashFile(stalePath);
  const staleData = athleteData(stalePath);

  await useBackupStore.getState().createBackup(PASSWORD);
  // Before this change: "A database uses an unsupported schema. Update the app before backing up."
  expect(useBackupStore.getState()).toMatchObject({ status: 'success' });
  expect(mockHashFile(stalePath)).toBe(staleHash);
  expect(describe_(stalePath).userVersion).toBe(34);
  const opened = await openBackup(readFileSync(mockSavedBackupPath, 'utf8'), PASSWORD, mockCryptoProvider);
  const stale = opened.archive.databases.find((database) => database.athleteId === COACHED_ENTRY.id);
  const extracted = join(mockRoot, 'extracted-stale.db');
  writeFileSync(extracted, Buffer.from(base64ToBytes(stale.databaseBase64)));
  expect(describe_(extracted)).toEqual({
    userVersion: CURRENT.userVersion, current: true, suspensionText: MASTER_058_SUSPENSION_EPISODE_SQL,
    quickCheck: 'ok', foreignKeyProblems: 0,
  });
  expect(athleteData(extracted)).toBe(staleData);
  expect(artifacts()).toEqual([]);
});

test.each([
  ['a reflowed master text', MASTER_058_SUSPENSION_EPISODE_SQL.replace(/ {2,}/g, ' ')],
  ['a weakened reason CHECK', MASTER_058_SUSPENSION_EPISODE_SQL.replace("('injury', 'illness', 'life')", "('injury', 'illness', 'life', 'x')")],
])('a local master-upgraded file with %s is refused and nothing is saved', async (_label, text) => {
  const livePath = join(mockLibraryDir, 'athlete_kinetics.db');
  makeMasterDatabase(livePath, 'tampered-local');
  bootUpgrade(livePath);
  tamperSuspensionText(livePath, text);
  const hash = mockHashFile(livePath);
  await useBackupStore.getState().createBackup(PASSWORD);
  expect(useBackupStore.getState().status).toBe('error');
  expect(useBackupStore.getState().message).toMatch(/does not match the verified app schema/);
  expect(mockHashFile(livePath)).toBe(hash);
  expect(mockSaveDocuments).not.toHaveBeenCalledWith(expect.anything(), expect.anything());
  expect(artifacts()).toEqual([]);
});

test('an archive carrying a master-upgraded database with drifted suspension text is refused; live data is unchanged', async () => {
  const livePath = join(mockLibraryDir, 'athlete_kinetics.db');
  const live = mockOpenDatabase({ name: 'athlete_kinetics.db' });
  migrate(live); live.close();
  const liveHash = mockHashFile(livePath);
  const incomingPath = join(mockRoot, 'incoming.db');
  makeMasterDatabase(incomingPath, 'incoming');
  bootUpgrade(incomingPath);
  tamperSuspensionText(incomingPath, `${MASTER_058_SUSPENSION_EPISODE_SQL} `);
  const bytes = new Uint8Array(readFileSync(incomingPath));
  const archive = {
    archiveVersion: 1, backupId: '0123456789abcdef0123456789abcdef', createdAt: '2026-10-04T05:00:00.000Z',
    sourceAppVersion: '0.1.0', sourceSchemaVersion: CURRENT.userVersion, sourceMigrationSlot: CURRENT.migrationSlot,
    scope: 'all-athletes', restorePolicy: 'replace',
    registry: { version: 1, activeId: 'default', advancedToolsUnlocked: false, athletes: [DEFAULT_ENTRY] },
    databases: [{ athleteId: 'default', dbName: 'athlete_kinetics.db', byteLength: bytes.length,
      sha256Hex: mockCryptoProvider.sha256Hex(bytes), userVersion: CURRENT.userVersion, tableCount: CURRENT.tableCount,
      databaseBase64: bytesToBase64(bytes) }],
    previousSuccessfulBackupAt: null,
  };
  writeFileSync(mockSelectedBackupPath, await sealBackup(archive, PASSWORD, mockCryptoProvider));
  mockSelectedSize = statSync(mockSelectedBackupPath).size;
  await useBackupStore.getState().chooseRestore(PASSWORD);
  if (useBackupStore.getState().status === 'preview') await useBackupStore.getState().confirmRestore(PASSWORD);
  expect(useBackupStore.getState().status).toBe('error');
  expect(useBackupStore.getState().message).toMatch(/does not match the verified app schema|failed validation/);
  expect(mockHashFile(livePath)).toBe(liveHash);
  expect(artifacts()).toEqual([]);
});

test('an unidentifiable user_version 34 athlete file fails closed: no backup, file unchanged', async () => {
  const livePath = join(mockLibraryDir, 'athlete_kinetics.db');
  const live = mockOpenDatabase({ name: 'athlete_kinetics.db' });
  migrate(live); live.close();
  const oddPath = join(mockLibraryDir, COACHED_ENTRY.dbName);
  makeMasterDatabase(oddPath, 'unidentifiable');
  const odd = open(oddPath); odd.exec('DROP TABLE suspension_episode'); odd.close();
  writeRegistry([DEFAULT_ENTRY, COACHED_ENTRY]);
  const hash = mockHashFile(oddPath);
  await useBackupStore.getState().createBackup(PASSWORD);
  expect(useBackupStore.getState().status).toBe('error');
  expect(mockHashFile(oddPath)).toBe(hash);
  expect(artifacts()).toEqual([]);
});
