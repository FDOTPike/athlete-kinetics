import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

// WO-03B recovery-retention regressions through the real backup store, real
// migration-chain SQLite databases and real AES-GCM containers: retained-recovery
// provenance (W1), crash-safe recovery publication (W2), the synchronous action
// guard (W3) and exact startup cache cleanup (W4).

jest.setTimeout(900_000);

let mockRoot;
let mockDocumentDir;
let mockCacheDir;
let mockLibraryDir;
let mockSelectedBackupPath;
let mockSelectedSize;
let mockFailIncomingMove = false;
let mockFailRollbackCopy = false;
let mockReplacementPreflightStorageLow = false;
let mockCorruptStagedDatabase = false;
let mockCorruptRecoveryPromotion = false;
let mockIgnoredUnlink = null;
let mockKdfCalls = 0;
let mockKdfGate = null;
let mockDeathBeforeMutation = null;
let mockTornDeath = false;
let mockMutations = [];
let mockProcessDead = false;
let mockFileOps = [];

const mockPick = jest.fn(async () => [{ uri: mockSelectedBackupPath, name: 'selected.pmbak', size: mockSelectedSize }]);
const mockKeepLocalCopy = jest.fn(async () => {
  const localPath = `${mockCacheDir}/selected-local.pmbak`;
  require('node:fs').copyFileSync(mockSelectedBackupPath, localPath);
  return [{ status: 'success', localUri: localPath }];
});
const mockSaveDocuments = jest.fn(async () => [{ error: null, uri: 'content://saved/backup' }]);
const mockCloseStore = jest.fn();
const mockRestartStore = jest.fn();
const mockHashFile = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

function mockAlive() {
  if (mockProcessDead) throw new Error('simulated process is dead');
}

/** Records one file mutation; returns true when the simulated process dies at it. */
function mockDiesAt(kind, path) {
  mockAlive();
  mockMutations.push([kind, path]);
  if (mockMutations.length - 1 !== mockDeathBeforeMutation) return false;
  mockProcessDead = true;
  return true;
}

const mockFs = {
  dirs: { DocumentDir: '', CacheDir: '', LibraryDir: '' },
  async exists(path) { mockAlive(); return existsSync(path); },
  async readFile(path, encoding) {
    mockAlive();
    return encoding === 'base64' ? readFileSync(path).toString('base64') : readFileSync(path, 'utf8');
  },
  async writeFile(path, data, encoding) {
    const dies = mockDiesAt('write', path);
    const bytes = encoding === 'base64' ? Buffer.from(data, 'base64') : Buffer.from(data, 'utf8');
    if (mockCorruptStagedDatabase && encoding === 'base64' && path.includes('.ak-incoming-')) bytes[bytes.length - 1] ^= 0xff;
    if (dies) {
      if (mockTornDeath) writeFileSync(path, bytes.subarray(0, Math.floor(bytes.length / 2)));
      throw new Error(`simulated process death during write ${path}`);
    }
    mockFileOps.push(['write', path]);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
  },
  async unlink(path) {
    if (mockDiesAt('unlink', path)) throw new Error(`simulated process death before unlink ${path}`);
    if (mockIgnoredUnlink !== null && mockIgnoredUnlink(path)) return;
    mockFileOps.push(['unlink', path]);
    rmSync(path, { recursive: true, force: true });
  },
  async mkdir(path) {
    if (mockDiesAt('mkdir', path)) throw new Error(`simulated process death before mkdir ${path}`);
    mkdirSync(path, { recursive: true });
  },
  async ls(path) { mockAlive(); return existsSync(path) ? readdirSync(path) : []; },
  async cp(path, destination) {
    if (mockDiesAt('copy', path)) {
      if (mockTornDeath) writeFileSync(destination, readFileSync(path).subarray(0, Math.floor(statSync(path).size / 2)));
      throw new Error(`simulated process death during copy ${path}`);
    }
    if (mockFailRollbackCopy && path.includes('.ak-rollback-')) return false;
    copyFileSync(path, destination);
    return undefined;
  },
  async mv(path, destination) {
    if (mockDiesAt('move', path)) throw new Error(`simulated process death before move ${path}`);
    if (mockFailIncomingMove && path.includes('.ak-incoming-')) return false;
    mockFileOps.push(['move', path, destination]);
    renameSync(path, destination);
    if (mockCorruptRecoveryPromotion && path.endsWith('pikeMethods-recovery-current.pmbak.new')) {
      const promoted = readFileSync(destination);
      promoted[Math.floor(promoted.length / 2)] ^= 0x01;
      writeFileSync(destination, promoted);
    }
    return undefined;
  },
  async stat(path) { mockAlive(); return { size: statSync(path).size }; },
  async hash(path) { mockAlive(); return mockHashFile(path); },
  async df() {
    mockAlive();
    // Snapshot preflight runs while its private ak-backup work directory
    // exists; replacement preflight runs only after that plaintext is gone.
    // Keying the fault to the latter reaches replacement whether or not a
    // recovery snapshot is created first.
    const snapshotWorkPresent = readdirSync(mockCacheDir).some((name) => /^ak-backup-[a-f0-9]{32}$/.test(name));
    return { internal_free: mockReplacementPreflightStorageLow && !snapshotWorkPresent ? 1024 : 1024 * 1024 * 1024 };
  },
};

const mockCryptoProvider = {
  randomBytes(length) { return new Uint8Array(randomBytes(length)); },
  async deriveScryptKey(password, salt) {
    mockKdfCalls += 1;
    const gate = mockKdfGate;
    if (gate !== null) {
      mockKdfGate = null;
      await gate;
    }
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

function mockOpenDatabase(options) {
  mockAlive();
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
  pick: (...args) => mockPick(...args),
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
  openBackup,
  sealBackup,
} from '@ak/core-db';
import { serializeRegistry } from '../../src/state/athleteRegistryCore';
import {
  athleteDataBootAllowed,
  authorizeAthleteDataBoot,
  resetDataMaintenanceLockForTests,
} from '../../src/state/dataMaintenanceLock';
import { useBackupStore } from '../../src/state/backupStore';

const schemaDirectory = join(__dirname, '..', '..', '..', '..', 'packages', 'core-db', 'src', 'schema');
const RECOVERY_PASSWORD = 'recovery-password';
const PORTABLE_PASSWORD = 'portable-password';
const RECOVERY_FILE = 'pikeMethods-recovery-current.pmbak';
const ATHLETE_DATABASE = /^(?:athlete_kinetics|ak_athlete_[a-z0-9]+)\.db$/;
const RESTORE_DEBRIS = /^\.ak-(?:incoming|rollback|registry)|^\.ak_restore_|^ak-backup-|^ak-portable-|\.pmbak\.(?:new|previous)$/;

// Current data B has three athletes; the retained recovery A and the portable
// backup P each have two, so every outcome is distinguishable on disk.
const CURRENT_B = {
  version: 1,
  activeId: 'cb2',
  advancedToolsUnlocked: false,
  athletes: [
    { id: 'default', name: 'Current B1', dbName: 'athlete_kinetics.db', createdAtMs: 0 },
    { id: 'cb2', name: 'Current B2', dbName: 'ak_athlete_cb2.db', createdAtMs: 2 },
    { id: 'cb3', name: 'Current B3', dbName: 'ak_athlete_cb3.db', createdAtMs: 3 },
  ],
};
const RECOVERY_A = {
  version: 1,
  activeId: 'ra2',
  advancedToolsUnlocked: true,
  athletes: [
    { id: 'default', name: 'Recovery A1', dbName: 'athlete_kinetics.db', createdAtMs: 10 },
    { id: 'ra2', name: 'Recovery A2', dbName: 'ak_athlete_ra2.db', createdAtMs: 20 },
  ],
};
const PORTABLE_P = {
  version: 1,
  activeId: 'pp2',
  advancedToolsUnlocked: false,
  athletes: [
    { id: 'default', name: 'Portable P1', dbName: 'athlete_kinetics.db', createdAtMs: 30 },
    { id: 'pp2', name: 'Portable P2', dbName: 'ak_athlete_pp2.db', createdAtMs: 40 },
  ],
};

const templateDatabases = new Map();

/** A real migration-chain database, built once per application id. */
function databaseBytes(applicationId) {
  let bytes = templateDatabases.get(applicationId);
  if (bytes === undefined) {
    const templateDirectory = mkdtempSync(join(tmpdir(), 'ak-retention-template-'));
    const templatePath = join(templateDirectory, 'template.db');
    const db = new DatabaseSync(templatePath);
    for (const name of readdirSync(schemaDirectory).filter((item) => /^0\d\d_.*\.sql$/.test(item) && !item.startsWith('004_')).sort()) {
      db.exec(readFileSync(join(schemaDirectory, name), 'utf8'));
    }
    db.exec(`PRAGMA user_version=${BACKUP_SCHEMA_USER_VERSION}; PRAGMA application_id=${applicationId};`);
    assert.equal(db.prepare('PRAGMA quick_check').get().quick_check, 'ok');
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().count,
      BACKUP_SCHEMA_TABLE_COUNT);
    db.close();
    bytes = new Uint8Array(readFileSync(templatePath));
    rmSync(templateDirectory, { recursive: true, force: true });
    templateDatabases.set(applicationId, bytes);
  }
  return bytes;
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

function archive(backupId, createdAt, registry, databases) {
  return {
    archiveVersion: 1,
    backupId,
    createdAt,
    sourceAppVersion: '0.1.0',
    sourceSchemaVersion: BACKUP_SCHEMA_USER_VERSION,
    sourceMigrationSlot: BACKUP_SCHEMA_MIGRATION_SLOT,
    scope: 'all-athletes',
    restorePolicy: 'replace',
    registry,
    databases,
    previousSuccessfulBackupAt: null,
  };
}

const athleteNames = (registry) => registry.athletes.map((athlete) => athlete.name);

function semanticRegistry(raw) {
  const registry = JSON.parse(raw);
  return {
    version: registry.version,
    activeId: registry.activeId,
    advancedToolsUnlocked: registry.advancedToolsUnlocked,
    athletes: [...registry.athletes].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
      .map(({ id, name, dbName, createdAtMs }) => ({ id, name, dbName, createdAtMs })),
  };
}

function liveData() {
  return {
    registry: readFileSync(join(mockDocumentDir, 'coach_athletes.json'), 'utf8'),
    databases: Object.fromEntries(readdirSync(mockLibraryDir).filter((name) => ATHLETE_DATABASE.test(name)).sort()
      .map((name) => [name, mockHashFile(join(mockLibraryDir, name))])),
  };
}

let fixture;

function classifyLive() {
  const live = liveData();
  if (isDeepStrictEqual(live, fixture.currentB)) return 'current B';
  const registry = semanticRegistry(live.registry);
  for (const [label, expected] of [['recovery A', fixture.recoveryA], ['portable P', fixture.portableP]]) {
    if (isDeepStrictEqual(registry, expected.registry) && isDeepStrictEqual(live.databases, expected.databases)) return label;
  }
  return 'mixed';
}

async function retainedRecovery(password = RECOVERY_PASSWORD) {
  const path = join(mockDocumentDir, RECOVERY_FILE);
  if (!existsSync(path)) return { sha256: null, athletes: 'absent' };
  const opened = await openBackup(readFileSync(path, 'utf8'), password, mockCryptoProvider);
  return { sha256: mockHashFile(path), athletes: opened.ok ? athleteNames(opened.archive.registry) : `unopenable:${opened.code}` };
}

function artifactNames() {
  return [...readdirSync(mockDocumentDir), ...readdirSync(mockLibraryDir), ...readdirSync(mockCacheDir)];
}

const restoreDebris = () => artifactNames().filter((name) => RESTORE_DEBRIS.test(name));

async function installFixture() {
  writeFileSync(join(mockDocumentDir, 'coach_athletes.json'), serializeRegistry(CURRENT_B));
  CURRENT_B.athletes.forEach((athlete, index) => writeFileSync(join(mockLibraryDir, athlete.dbName), databaseBytes(401 + index)));

  const recoveryDatabases = RECOVERY_A.athletes.map((athlete, index) => snapshot(athlete.id, athlete.dbName, databaseBytes(301 + index)));
  writeFileSync(join(mockDocumentDir, RECOVERY_FILE), await sealBackup(
    archive('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '2026-09-12T05:00:00.000Z', RECOVERY_A, recoveryDatabases),
    RECOVERY_PASSWORD,
    mockCryptoProvider,
  ));

  const portableDatabases = PORTABLE_P.athletes.map((athlete, index) => snapshot(athlete.id, athlete.dbName, databaseBytes(501 + index)));
  mockSelectedBackupPath = join(mockRoot, 'selected.pmbak');
  writeFileSync(mockSelectedBackupPath, await sealBackup(
    archive('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '2026-09-13T05:00:00.000Z', PORTABLE_P, portableDatabases),
    PORTABLE_PASSWORD,
    mockCryptoProvider,
  ));
  mockSelectedSize = statSync(mockSelectedBackupPath).size;

  const recovery = await retainedRecovery();
  assert.deepEqual(recovery.athletes, athleteNames(RECOVERY_A));
  const expectation = (registry, databases) => ({
    registry: semanticRegistry(serializeRegistry(registry)),
    databases: Object.fromEntries(databases.map((database) => [database.dbName, database.sha256Hex])),
  });
  return {
    currentB: liveData(),
    recovery,
    recoveryA: expectation(RECOVERY_A, recoveryDatabases),
    portableP: expectation(PORTABLE_P, portableDatabases),
  };
}

function snapshotDirectories() {
  const files = new Map();
  for (const directory of [mockDocumentDir, mockLibraryDir, mockCacheDir]) {
    for (const name of readdirSync(directory)) files.set(`${directory}/${name}`, readFileSync(`${directory}/${name}`));
  }
  return files;
}

function restoreDirectories(files) {
  for (const directory of [mockDocumentDir, mockLibraryDir, mockCacheDir]) {
    rmSync(directory, { recursive: true, force: true });
    mkdirSync(directory, { recursive: true });
  }
  for (const [path, bytes] of files) writeFileSync(path, bytes);
}

function armProcessDeath(dieAt, torn) {
  mockMutations = [];
  mockDeathBeforeMutation = dieAt;
  mockTornDeath = torn;
}

/** A cold start after process death: fresh lock state, startup recovery, then boot authorization. */
async function restartApp() {
  mockProcessDead = false;
  mockDeathBeforeMutation = null;
  mockTornDeath = false;
  resetDataMaintenanceLockForTests();
  const recovered = await useBackupStore.getState().initialize();
  if (recovered) authorizeAthleteDataBoot();
  return recovered;
}

function deathCases(mutations) {
  const cases = [];
  for (let dieAt = 0; dieAt <= mutations.length; dieAt += 1) {
    const [kind, path] = mutations[dieAt] ?? ['complete', ''];
    const shown = path === '' ? 'after the last mutation' : path.slice(mockRoot.length);
    cases.push({ dieAt, torn: false, label: `#${dieAt} before ${kind} ${shown}` });
    if (kind === 'write' || kind === 'copy') cases.push({ dieAt, torn: true, label: `#${dieAt} torn ${kind} ${shown}` });
  }
  return cases;
}

async function resetForIteration(files) {
  restoreDirectories(files);
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  useBackupStore.setState({ status: 'idle', startupSafe: true, message: null, preview: null, recoveryAvailable: true });
}

beforeEach(async () => {
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  mockFailIncomingMove = false;
  mockFailRollbackCopy = false;
  mockReplacementPreflightStorageLow = false;
  mockCorruptStagedDatabase = false;
  mockCorruptRecoveryPromotion = false;
  mockIgnoredUnlink = null;
  mockKdfGate = null;
  mockDeathBeforeMutation = null;
  mockTornDeath = false;
  mockProcessDead = false;
  mockRoot = mkdtempSync(join(tmpdir(), 'ak-recovery-retention-'));
  mockDocumentDir = join(mockRoot, 'Documents').replaceAll('\\', '/');
  mockCacheDir = join(mockRoot, 'Cache').replaceAll('\\', '/');
  mockLibraryDir = join(mockRoot, 'Library').replaceAll('\\', '/');
  for (const path of [mockDocumentDir, mockCacheDir, mockLibraryDir]) mkdirSync(path, { recursive: true });
  Object.assign(mockFs.dirs, { DocumentDir: mockDocumentDir, CacheDir: mockCacheDir, LibraryDir: mockLibraryDir });
  fixture = await installFixture();
  useBackupStore.getState().cancelRestore();
  useBackupStore.setState({
    status: 'idle', startupSafe: true, message: null, preview: null, lastSuccessfulBackupAt: null, recoveryAvailable: true,
  });
  mockKdfCalls = 0;
  mockMutations = [];
  mockFileOps = [];
  mockPick.mockClear();
  mockKeepLocalCopy.mockClear();
  mockSaveDocuments.mockClear();
  mockCloseStore.mockClear();
  mockRestartStore.mockClear();
});

afterEach(() => rmSync(mockRoot, { recursive: true, force: true }));

async function reviewRecoveryA() {
  await useBackupStore.getState().reviewRecovery(RECOVERY_PASSWORD);
  expect(useBackupStore.getState().status).toBe('preview');
  expect(useBackupStore.getState().preview).toMatchObject({
    source: 'retained_recovery', athleteNames: athleteNames(RECOVERY_A), databaseCount: 2,
  });
}

async function previewPortableP() {
  await useBackupStore.getState().chooseRestore(PORTABLE_PASSWORD);
  expect(useBackupStore.getState().status).toBe('preview');
  expect(useBackupStore.getState().preview).toMatchObject({
    source: 'portable_backup', athleteNames: athleteNames(PORTABLE_P), databaseCount: 2,
  });
}

const journalPublications = () => mockFileOps.filter((entry) => entry[0] === 'move'
  && entry[2] === `${mockDocumentDir}/.ak_restore_journal.json`).length;

describe('W1 retained previous-data recovery confirmation', () => {
  test.each([
    ['low storage at the replacement preflight', () => { mockReplacementPreflightStorageLow = true; }, /Not enough free storage/],
    ['a staged database hash mismatch', () => { mockCorruptStagedDatabase = true; }, /staged database did not match the authenticated backup/],
  ])('%s leaves current data B unchanged and recovery A byte-identical and decryptable', async (_label, injectFault, message) => {
    await reviewRecoveryA();
    injectFault();

    await useBackupStore.getState().confirmRestore(RECOVERY_PASSWORD);

    expect(useBackupStore.getState()).toMatchObject({ status: 'error', preview: null, startupSafe: true });
    expect(useBackupStore.getState().message).toMatch(message);
    expect(liveData()).toEqual(fixture.currentB);
    expect(await retainedRecovery()).toEqual(fixture.recovery);
    expect(restoreDebris()).toEqual([]);
  });

  test('confirmation installs A, keeps the same encrypted recovery, and creates no other undo point', async () => {
    await reviewRecoveryA();
    const kdfCallsBeforeConfirm = mockKdfCalls;
    mockFileOps = [];

    await useBackupStore.getState().confirmRestore(RECOVERY_PASSWORD);
    const kdfCallsDuringConfirm = mockKdfCalls - kdfCallsBeforeConfirm;

    expect(useBackupStore.getState()).toMatchObject({ status: 'success', preview: null, recoveryAvailable: true });
    expect(await retainedRecovery()).toEqual(fixture.recovery);
    expect(kdfCallsDuringConfirm).toBe(0);
    expect(mockFileOps.filter((entry) => entry.slice(1).some((path) => path.includes(RECOVERY_FILE)))).toEqual([]);
    expect(classifyLive()).toBe('recovery A');
    expect(restoreDebris()).toEqual([]);
    expect(mockRestartStore).toHaveBeenCalledTimes(1);
    expect(athleteDataBootAllowed()).toBe(true);
  });

  test('provenance comes from the action that authenticated the archive, never from its backup ID', async () => {
    copyFileSync(join(mockDocumentDir, RECOVERY_FILE), mockSelectedBackupPath);
    mockSelectedSize = statSync(mockSelectedBackupPath).size;

    await useBackupStore.getState().chooseRestore(RECOVERY_PASSWORD);
    expect(useBackupStore.getState().preview)
      .toMatchObject({ source: 'portable_backup', backupId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });
    await useBackupStore.getState().confirmRestore(RECOVERY_PASSWORD);

    expect(useBackupStore.getState().status).toBe('success');
    expect(classifyLive()).toBe('recovery A');
    expect((await retainedRecovery()).athletes).toEqual(athleteNames(CURRENT_B));
  });

  test('unresolved replacement keeps athlete-data boot closed until startup recovery, preserving A throughout', async () => {
    await reviewRecoveryA();
    mockFailIncomingMove = true;
    mockFailRollbackCopy = true;

    await useBackupStore.getState().confirmRestore(RECOVERY_PASSWORD);

    expect(useBackupStore.getState()).toMatchObject({ status: 'error', startupSafe: false });
    expect(athleteDataBootAllowed()).toBe(false);
    expect(mockRestartStore).not.toHaveBeenCalled();
    expect(existsSync(join(mockDocumentDir, '.ak_restore_journal.json'))).toBe(true);
    expect(await retainedRecovery()).toEqual(fixture.recovery);

    await useBackupStore.getState().reviewRecovery(RECOVERY_PASSWORD);
    expect(useBackupStore.getState()).toMatchObject({ status: 'error', preview: null });
    expect(useBackupStore.getState().message).toMatch(/Data recovery must finish/);
    await expect(useBackupStore.getState().initialize()).resolves.toBe(false);
    expect(athleteDataBootAllowed()).toBe(false);
    expect(await retainedRecovery()).toEqual(fixture.recovery);

    mockFailIncomingMove = false;
    mockFailRollbackCopy = false;
    await expect(useBackupStore.getState().initialize()).resolves.toBe(true);
    expect(athleteDataBootAllowed()).toBe(false);
    expect(liveData()).toEqual(fixture.currentB);
    expect(await retainedRecovery()).toEqual(fixture.recovery);
    expect(restoreDebris()).toEqual([]);
  });

  test('pending restore state is cleared by cancellation and by a blocked confirmation', async () => {
    await reviewRecoveryA();
    useBackupStore.getState().cancelRestore();
    useBackupStore.setState({ status: 'preview' });
    mockFileOps = [];
    await useBackupStore.getState().confirmRestore(RECOVERY_PASSWORD);
    expect(mockFileOps).toEqual([]);
    expect(mockCloseStore).not.toHaveBeenCalled();

    await reviewRecoveryA();
    useBackupStore.setState({ startupSafe: false });
    await useBackupStore.getState().confirmRestore(RECOVERY_PASSWORD);
    expect(useBackupStore.getState()).toMatchObject({ status: 'error', preview: null });
    useBackupStore.setState({ startupSafe: true, status: 'preview' });
    mockFileOps = [];
    await useBackupStore.getState().confirmRestore(RECOVERY_PASSWORD);
    expect(mockFileOps).toEqual([]);
    expect(mockCloseStore).not.toHaveBeenCalled();
    expect(liveData()).toEqual(fixture.currentB);
    expect(await retainedRecovery()).toEqual(fixture.recovery);
  });

  test('process death at every file boundary leaves recovery A byte-identical and athlete data atomic', async () => {
    const initialFiles = snapshotDirectories();
    await reviewRecoveryA();
    armProcessDeath(null, false);
    await useBackupStore.getState().confirmRestore(RECOVERY_PASSWORD);
    expect(useBackupStore.getState().status).toBe('success');
    const mutations = [...mockMutations];
    expect(mutations.filter(([, path]) => path.includes(RECOVERY_FILE))).toEqual([]);

    const outcomes = [];
    for (const { dieAt, torn, label } of deathCases(mutations)) {
      await resetForIteration(initialFiles);
      await reviewRecoveryA();
      armProcessDeath(dieAt, torn);
      await useBackupStore.getState().confirmRestore(RECOVERY_PASSWORD).catch(() => undefined);
      const recovered = await restartApp();
      outcomes.push({
        label,
        recovered,
        recoveryByteIdentical: isDeepStrictEqual(await retainedRecovery(), fixture.recovery),
        live: classifyLive(),
        debris: restoreDebris(),
      });
    }

    expect(outcomes.filter((outcome) => !outcome.recovered || !outcome.recoveryByteIdentical
      || !['current B', 'recovery A'].includes(outcome.live) || outcome.debris.length > 0)).toEqual([]);
    expect(new Set(outcomes.map((outcome) => outcome.live))).toEqual(new Set(['current B', 'recovery A']));
    expect(outcomes.length).toBeGreaterThan(mutations.length);
  });
});

describe('W2 crash-safe recovery publication for portable restores', () => {
  test('the older recovery is renamed aside and superseded only after the new recovery authenticates, before replacement', async () => {
    await previewPortableP();
    mockFileOps = [];

    await useBackupStore.getState().confirmRestore(PORTABLE_PASSWORD);

    expect(useBackupStore.getState()).toMatchObject({ status: 'success', recoveryAvailable: true });
    expect(classifyLive()).toBe('portable P');
    expect((await retainedRecovery(PORTABLE_PASSWORD)).athletes).toEqual(athleteNames(CURRENT_B));
    expect(restoreDebris()).toEqual([]);
    const recoveryPath = `${mockDocumentDir}/${RECOVERY_FILE}`;
    const position = (kind, source, destination) => mockFileOps.findIndex((entry) => entry[0] === kind
      && entry[1] === source && (destination === undefined || entry[2] === destination));
    const rotatedAside = position('move', recoveryPath, `${recoveryPath}.previous`);
    const promoted = position('move', `${recoveryPath}.new`, recoveryPath);
    const superseded = position('unlink', `${recoveryPath}.previous`);
    const replacementJournal = mockFileOps.findIndex((entry) => entry[0] === 'move'
      && entry[2] === `${mockDocumentDir}/.ak_restore_journal.json`);
    expect({
      rotatedAside: rotatedAside >= 0,
      promotedAfterRotation: promoted > rotatedAside,
      supersededAfterPromotion: superseded > promoted,
      replacementAfterSupersession: replacementJournal > superseded,
      retainedRecoveryEverDeletedInPlace: mockFileOps.some((entry) => entry[0] === 'unlink' && entry[1] === recoveryPath),
    }).toEqual({
      rotatedAside: true,
      promotedAfterRotation: true,
      supersededAfterPromotion: true,
      replacementAfterSupersession: true,
      retainedRecoveryEverDeletedInPlace: false,
    });
  });

  test('a promoted recovery that fails authentication at its durable path restores the older recovery and never starts replacement', async () => {
    await previewPortableP();
    mockCorruptRecoveryPromotion = true;
    mockFileOps = [];

    await useBackupStore.getState().confirmRestore(PORTABLE_PASSWORD);

    expect(useBackupStore.getState()).toMatchObject({ status: 'error', startupSafe: true, preview: null });
    expect(useBackupStore.getState().message).toMatch(/retained recovery backup could not be verified/);
    expect(liveData()).toEqual(fixture.currentB);
    expect(await retainedRecovery()).toEqual(fixture.recovery);
    expect(restoreDebris()).toEqual([]);
    expect(journalPublications()).toBe(0);
  });

  test('startup restores a recovery left mid-rotation, promotes a sole complete candidate, and preserves rotation files beside a journal', async () => {
    const recoveryPath = join(mockDocumentDir, RECOVERY_FILE);

    renameSync(recoveryPath, `${recoveryPath}.previous`);
    writeFileSync(recoveryPath, readFileSync(mockSelectedBackupPath, 'utf8'));
    await expect(restartApp()).resolves.toBe(true);
    expect(await retainedRecovery()).toEqual(fixture.recovery);
    expect(restoreDebris()).toEqual([]);

    renameSync(recoveryPath, `${recoveryPath}.new`);
    await expect(restartApp()).resolves.toBe(true);
    expect(await retainedRecovery()).toEqual(fixture.recovery);
    expect(useBackupStore.getState().recoveryAvailable).toBe(true);
    expect(restoreDebris()).toEqual([]);

    renameSync(recoveryPath, `${recoveryPath}.previous`);
    writeFileSync(join(mockDocumentDir, '.ak_restore_journal.json'), '{}');
    const before = snapshotDirectories();
    await expect(restartApp()).resolves.toBe(false);
    expect(useBackupStore.getState().startupSafe).toBe(false);
    expect(snapshotDirectories()).toEqual(before);
  });

  test('process death at every file boundary always leaves an authenticated undo point for the data that survives', async () => {
    const initialFiles = snapshotDirectories();
    await previewPortableP();
    armProcessDeath(null, false);
    await useBackupStore.getState().confirmRestore(PORTABLE_PASSWORD);
    expect(useBackupStore.getState().status).toBe('success');
    const mutations = [...mockMutations];
    // The older recovery may be superseded only by removing its rotated
    // .previous copy, and only before replacement publishes its journal.
    const supersededAt = mutations.findIndex(([kind, path]) => kind === 'unlink' && path.endsWith(`${RECOVERY_FILE}.previous`));
    const replacementJournalAt = mutations.findIndex(([kind, path]) => kind === 'move' && path.includes('/.ak_restore_journal-'));
    expect({ supersessionObserved: supersededAt >= 0, supersededBeforeReplacement: supersededAt < replacementJournalAt })
      .toEqual({ supersessionObserved: true, supersededBeforeReplacement: true });

    const recoveryCandidatesOnDisk = async () => {
      const found = [];
      for (const suffix of ['', '.new', '.previous']) {
        const path = join(mockDocumentDir, `${RECOVERY_FILE}${suffix}`);
        if (!existsSync(path)) continue;
        const text = readFileSync(path, 'utf8');
        if ((await openBackup(text, RECOVERY_PASSWORD, mockCryptoProvider)).ok) {
          found.push(`older recovery A${suffix}`);
          continue;
        }
        const opened = await openBackup(text, PORTABLE_PASSWORD, mockCryptoProvider);
        if (opened.ok && isDeepStrictEqual(athleteNames(opened.archive.registry), athleteNames(CURRENT_B))) {
          found.push(`recovery of B${suffix}`);
        }
      }
      return found;
    };
    const undoPoint = async () => {
      if (isDeepStrictEqual(await retainedRecovery(), fixture.recovery)) return 'older recovery A';
      const recoveryOfB = await retainedRecovery(PORTABLE_PASSWORD);
      return isDeepStrictEqual(recoveryOfB.athletes, athleteNames(CURRENT_B)) ? 'verified recovery of B' : 'missing';
    };

    const outcomes = [];
    for (const { dieAt, torn, label } of deathCases(mutations)) {
      await resetForIteration(initialFiles);
      await previewPortableP();
      armProcessDeath(dieAt, torn);
      await useBackupStore.getState().confirmRestore(PORTABLE_PASSWORD).catch(() => undefined);
      const candidatesAtDeath = await recoveryCandidatesOnDisk();
      const recovered = await restartApp();
      outcomes.push({
        label, dieAt, candidatesAtDeath, recovered, live: classifyLive(), undoPoint: await undoPoint(), debris: restoreDebris(),
      });
    }

    // Until supersession the older recovery A must survive every death and be
    // the undo point after startup; afterwards the verified recovery of B is.
    expect(outcomes.filter((outcome) => {
      const beforeSupersession = outcome.dieAt <= supersededAt;
      return !outcome.recovered
        || outcome.candidatesAtDeath.length === 0
        || outcome.debris.length > 0
        || (beforeSupersession && !outcome.candidatesAtDeath.some((found) => found.startsWith('older recovery A')))
        || outcome.undoPoint !== (beforeSupersession ? 'older recovery A' : 'verified recovery of B')
        || !(beforeSupersession ? ['current B'] : ['current B', 'portable P']).includes(outcome.live);
    })).toEqual([]);
    expect(new Set(outcomes.map((outcome) => outcome.live))).toEqual(new Set(['current B', 'portable P']));
    expect(new Set(outcomes.map((outcome) => outcome.undoPoint))).toEqual(new Set(['older recovery A', 'verified recovery of B']));
  });
});

describe('W3 synchronous action guard', () => {
  test.each(['createBackup', 'chooseRestore', 'reviewRecovery'])('%s: a concurrent second call starts nothing and changes nothing', async (action) => {
    const password = action === 'reviewRecovery' ? RECOVERY_PASSWORD : PORTABLE_PASSWORD;
    let releaseFirstKdf;
    mockKdfGate = new Promise((resolve) => { releaseFirstKdf = resolve; });

    const first = useBackupStore.getState()[action](password);
    const claimed = { status: useBackupStore.getState().status, message: useBackupStore.getState().message };
    await useBackupStore.getState()[action](password);
    const afterSecond = { status: useBackupStore.getState().status, message: useBackupStore.getState().message };
    const beforeRelease = { kdf: mockKdfCalls, pickers: mockPick.mock.calls.length, saves: mockSaveDocuments.mock.calls.length };
    releaseFirstKdf();
    await first;

    expect({
      claimedSynchronously: claimed.status === 'working',
      secondCallLeftStateUnchanged: isDeepStrictEqual(afterSecond, claimed),
      atMostOneKdfBeforeRelease: beforeRelease.kdf <= 1,
      atMostOnePickerBeforeRelease: beforeRelease.pickers <= 1,
      noSaveBeforeRelease: beforeRelease.saves === 0,
      finalStatus: useBackupStore.getState().status,
      kdfCalls: mockKdfCalls,
      pickerCalls: mockPick.mock.calls.length,
      saveCalls: mockSaveDocuments.mock.calls.length,
    }).toEqual({
      claimedSynchronously: true,
      secondCallLeftStateUnchanged: true,
      atMostOneKdfBeforeRelease: true,
      atMostOnePickerBeforeRelease: true,
      noSaveBeforeRelease: true,
      finalStatus: action === 'createBackup' ? 'success' : 'preview',
      kdfCalls: 1,
      pickerCalls: action === 'chooseRestore' ? 1 : 0,
      saveCalls: action === 'createBackup' ? 1 : 0,
    });
  });

  test('confirmRestore: a concurrent second call cannot start another KDF or replacement', async () => {
    await previewPortableP();
    const kdfBeforeConfirm = mockKdfCalls;
    mockCloseStore.mockClear();
    mockFileOps = [];
    let releaseFirstKdf;
    mockKdfGate = new Promise((resolve) => { releaseFirstKdf = resolve; });

    const first = useBackupStore.getState().confirmRestore(PORTABLE_PASSWORD);
    const claimed = { status: useBackupStore.getState().status, message: useBackupStore.getState().message };
    await useBackupStore.getState().confirmRestore(PORTABLE_PASSWORD);
    const afterSecond = { status: useBackupStore.getState().status, message: useBackupStore.getState().message };
    const beforeRelease = { kdf: mockKdfCalls - kdfBeforeConfirm, journals: journalPublications() };
    releaseFirstKdf();
    await first;

    expect({
      claimedSynchronously: claimed.status === 'working',
      secondCallLeftStateUnchanged: isDeepStrictEqual(afterSecond, claimed),
      atMostOneKdfBeforeRelease: beforeRelease.kdf <= 1,
      noReplacementBeforeRelease: beforeRelease.journals === 0,
      finalStatus: useBackupStore.getState().status,
      kdfCalls: mockKdfCalls - kdfBeforeConfirm,
      replacementJournals: journalPublications(),
      storeCloses: mockCloseStore.mock.calls.length,
    }).toEqual({
      claimedSynchronously: true,
      secondCallLeftStateUnchanged: true,
      atMostOneKdfBeforeRelease: true,
      noReplacementBeforeRelease: true,
      finalStatus: 'success',
      kdfCalls: 3,
      replacementJournals: 1,
      storeCloses: 2,
    });
    expect(classifyLive()).toBe('portable P');
  });

  test('cancelling while a confirmation is in flight changes nothing', async () => {
    await previewPortableP();
    let releaseFirstKdf;
    mockKdfGate = new Promise((resolve) => { releaseFirstKdf = resolve; });

    const confirmation = useBackupStore.getState().confirmRestore(PORTABLE_PASSWORD);
    const claimed = { status: useBackupStore.getState().status, message: useBackupStore.getState().message };
    useBackupStore.getState().cancelRestore();
    const afterCancel = { status: useBackupStore.getState().status, message: useBackupStore.getState().message };
    releaseFirstKdf();
    await confirmation;

    expect(afterCancel).toEqual(claimed);
    expect(claimed.status).toBe('working');
    expect(useBackupStore.getState().status).toBe('success');
    expect(classifyLive()).toBe('portable P');
  });
});

describe('W4 startup cache cleanup', () => {
  test('startup removes only exact abandoned backup cache entries and inspects only the cache directory', async () => {
    const hex = '0123456789abcdef0123456789abcdef';
    const other = 'fedcba9876543210fedcba9876543210';
    writeFileSync(`${mockCacheDir}/ak-portable-${hex}.pmbak`, 'abandoned ciphertext');
    mkdirSync(`${mockCacheDir}/ak-backup-${other}`);
    writeFileSync(`${mockCacheDir}/ak-backup-${other}/snapshot-0.db`, 'abandoned plaintext');
    const retained = [
      'user-backup.pmbak', 'selected-local.pmbak', 'user-cache.txt',
      `ak-portable-${'A'.repeat(32)}.pmbak`, `ak-portable-${other.slice(1)}.pmbak`, `ak-portable-${other}0.pmbak`,
      `ak-portable-${other}.pmbak.new`, `xak-portable-${other}.pmbak`, `ak-portable-${other}pmbak`,
      `ak-portable-${other}.pmbak.txt`, `ak-backup-${hex}.pmbak`, `ak-backup-${other.slice(1)}`,
    ];
    for (const name of retained) writeFileSync(`${mockCacheDir}/${name}`, name);
    writeFileSync(`${mockDocumentDir}/ak-portable-${hex}.pmbak`, 'outside the cache directory');

    await expect(restartApp()).resolves.toBe(true);

    expect(readdirSync(mockCacheDir).sort()).toEqual([...retained].sort());
    for (const name of retained) expect(readFileSync(`${mockCacheDir}/${name}`, 'utf8')).toBe(name);
    expect(readFileSync(`${mockDocumentDir}/ak-portable-${hex}.pmbak`, 'utf8')).toBe('outside the cache directory');
  });

  test('an unconfirmed encrypted cache removal is reported as itself and keeps athlete data closed', async () => {
    const abandoned = `${mockCacheDir}/ak-portable-0123456789abcdef0123456789abcdef.pmbak`;
    writeFileSync(abandoned, 'abandoned ciphertext');
    mockIgnoredUnlink = (path) => path === abandoned;

    await expect(restartApp()).resolves.toBe(false);

    expect(useBackupStore.getState()).toMatchObject({
      startupSafe: false,
      status: 'error',
      message: 'Temporary backup files could not be removed safely. Athlete data stays closed.',
    });
    expect(athleteDataBootAllowed()).toBe(false);
    expect(existsSync(abandoned)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PR #18 review (P1): startup cannot prove authenticity without the password,
// so a complete recovery candidate that is not selected is preserved under its
// SHA-256 instead of being deleted. Review decides authenticity with the
// password, and a portable restore supersedes preserved candidates only after
// its new recovery is durable.
// ---------------------------------------------------------------------------

describe('PR #18 review: ambiguous recovery candidates are preserved, not deleted', () => {
  const ALTERNATE_NAME = /^pikeMethods-recovery-current\.pmbak\.alternate-[a-f0-9]{64}$/;
  const alternateNames = () => readdirSync(mockDocumentDir).filter((name) => ALTERNATE_NAME.test(name)).sort();
  const digestOf = (text) => createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');

  test('startup keeps the older retained recovery selected and preserves the other complete candidate under its content hash', async () => {
    const recoveryPath = join(mockDocumentDir, RECOVERY_FILE);
    const otherCandidate = readFileSync(mockSelectedBackupPath, 'utf8');
    renameSync(recoveryPath, `${recoveryPath}.previous`);
    writeFileSync(recoveryPath, otherCandidate);

    await expect(restartApp()).resolves.toBe(true);

    expect(await retainedRecovery()).toEqual(fixture.recovery);
    expect(alternateNames()).toEqual([`${RECOVERY_FILE}.alternate-${digestOf(otherCandidate)}`]);
    expect(readFileSync(join(mockDocumentDir, alternateNames()[0]), 'utf8')).toBe(otherCandidate);
    expect(restoreDebris()).toEqual([]);
    expect(useBackupStore.getState().recoveryAvailable).toBe(true);
  });

  test('review falls back to a preserved candidate when the selected recovery does not authenticate, and changes no recovery file', async () => {
    const recoveryPath = join(mockDocumentDir, RECOVERY_FILE);
    const pristine = readFileSync(recoveryPath, 'utf8');
    const alternatePath = join(mockDocumentDir, `${RECOVERY_FILE}.alternate-${digestOf(pristine)}`);
    writeFileSync(alternatePath, pristine);
    // Flip one ciphertext character: still a complete container, no longer authentic.
    const container = JSON.parse(pristine);
    const at = 128;
    const flipped = `${container.ciphertextBase64.slice(0, at)}${container.ciphertextBase64[at] === 'A' ? 'B' : 'A'}${container.ciphertextBase64.slice(at + 1)}`;
    writeFileSync(recoveryPath, JSON.stringify({ ...container, ciphertextBase64: flipped }));
    const before = { selected: mockHashFile(recoveryPath), preserved: mockHashFile(alternatePath) };

    await useBackupStore.getState().reviewRecovery(RECOVERY_PASSWORD);
    expect(useBackupStore.getState().status).toBe('preview');
    expect(useBackupStore.getState().preview).toMatchObject({
      source: 'retained_recovery', athleteNames: athleteNames(RECOVERY_A), databaseCount: 2,
    });

    await useBackupStore.getState().confirmRestore(RECOVERY_PASSWORD);
    expect(useBackupStore.getState().status).toBe('success');
    expect(classifyLive()).toBe('recovery A');
    expect({ selected: mockHashFile(recoveryPath), preserved: mockHashFile(alternatePath) }).toEqual(before);
    expect(restoreDebris()).toEqual([]);
  });

  test('a wrong password tries every candidate and changes nothing', async () => {
    const recoveryPath = join(mockDocumentDir, RECOVERY_FILE);
    const pristine = readFileSync(recoveryPath, 'utf8');
    const alternatePath = join(mockDocumentDir, `${RECOVERY_FILE}.alternate-${digestOf(pristine)}`);
    writeFileSync(alternatePath, pristine);
    const before = snapshotDirectories();
    const kdfBefore = mockKdfCalls;

    await useBackupStore.getState().reviewRecovery('not-the-recovery-password');

    expect(useBackupStore.getState()).toMatchObject({ status: 'error', preview: null });
    expect(useBackupStore.getState().message).toMatch(/could not be opened/);
    expect(mockKdfCalls - kdfBefore).toBe(2);
    expect(snapshotDirectories()).toEqual(before);
  });

  test('a portable restore supersedes preserved candidates only after its new recovery is durable and before replacement', async () => {
    const recoveryPath = join(mockDocumentDir, RECOVERY_FILE);
    const preservedText = readFileSync(recoveryPath, 'utf8');
    const alternatePath = join(mockDocumentDir, `${RECOVERY_FILE}.alternate-${digestOf(preservedText)}`).replaceAll('\\', '/');
    writeFileSync(alternatePath, preservedText);
    await previewPortableP();
    mockFileOps = [];

    await useBackupStore.getState().confirmRestore(PORTABLE_PASSWORD);

    expect(useBackupStore.getState().status).toBe('success');
    expect(classifyLive()).toBe('portable P');
    expect(alternateNames()).toEqual([]);
    const finalPath = `${mockDocumentDir}/${RECOVERY_FILE}`;
    const promoted = mockFileOps.findIndex((entry) => entry[0] === 'move' && entry[1] === `${finalPath}.new` && entry[2] === finalPath);
    const supersededPreserved = mockFileOps.findIndex((entry) => entry[0] === 'unlink' && entry[1] === alternatePath);
    const replacementJournal = mockFileOps.findIndex((entry) => entry[0] === 'move' && entry[2] === `${mockDocumentDir}/.ak_restore_journal.json`);
    expect({ promoted: promoted >= 0, afterPromotion: supersededPreserved > promoted, beforeReplacement: supersededPreserved < replacementJournal })
      .toEqual({ promoted: true, afterPromotion: true, beforeReplacement: true });
  });
});
