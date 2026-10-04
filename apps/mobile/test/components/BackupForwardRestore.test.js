/**
 * BackupForwardRestore.test.js — restoring backups made BEFORE a schema upgrade.
 *
 * Until 065 the backup contract accepted exactly one schema, so the first new
 * migration would have made every existing backup and every retained recovery
 * copy unrestorable. These tests run the REAL backup store over real SQLite
 * files and pin the forward-restore policy:
 *
 *   - a supported pre-upgrade (v63) archive is validated against ITS OWN
 *     exact schema fingerprint, never a relaxed check;
 *   - it is staged as an isolated copy and brought forward by the production
 *     migration chain there, before any live database is touched;
 *   - the result must match the current schema exactly, with every athlete
 *     row preserved and no history invented;
 *   - any failure — a migration error, a drifted "v63" schema, a mislabelled
 *     archive, an unknown or future schema — fails closed with live data
 *     byte-identical;
 *   - new 065 data round-trips through backup and restore;
 *   - EVERY registered pre-upgrade schema restores, not only the first: a
 *     backup made between two app updates (v64, ...) keeps its newer data;
 *   - 066 focus, goals, goal revisions and measurements round-trip, and a
 *     forward migration seeds the muscle mapping without inventing a focus;
 *   - 067 sport profile, goal exercise link and frozen block explanations
 *     round-trip, and a forward migration invents none of them;
 *   - 069 resting heart rate (resting_hr_daily) round-trips, and a forward
 *     migration keeps the backup's HRV/resting-HR history as it was and
 *     invents no resting_hr_daily row;
 *   - 068 changes coaching text only (same schema fingerprint as v66): every
 *     forward restore ends with the corrected text, and athlete rows untouched;
 *   - an athlete file not opened since the update still backs up.
 *
 * The file-system, crypto and SQLite stand-ins are the same ones
 * BackupRestoreStore.test.js uses.
 */
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
  expect(sourceUris[0]).toMatch(/\/ak-portable-[a-f0-9]{32}\.pmbak$/);
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
  SUPPORTED_BACKUP_SCHEMA_CONTRACTS,
  bytesToBase64,
  base64ToBytes,
  matchesBackupSchemaContract,
  openBackup,
  sealBackup,
} from '@ak/core-db';
import { serializeRegistry } from '../../src/state/athleteRegistryCore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import { useBackupStore } from '../../src/state/backupStore';

// BackupRecoveryRetention shows what a cold first run of this harness costs.
jest.setTimeout(180_000);

const V63 = SUPPORTED_BACKUP_SCHEMA_CONTRACTS[0];
const CURRENT = CURRENT_BACKUP_SCHEMA_CONTRACT;
const PASSWORD = 'restore-password';
const schemaDirectory = join(__dirname, '..', '..', '..', '..', 'packages', 'core-db', 'src', 'schema');
const schemaFiles = readdirSync(schemaDirectory)
  .filter((item) => /^0\d\d_.*\.sql$/.test(item) && !item.startsWith('004_')).sort();

/** Build a database from the first `contract.userVersion` migrations — exactly
 * what a device at that schema holds — with real athlete rows in it. */
function makeDatabase(path, contract, label) {
  const db = new DatabaseSync(path);
  for (const name of schemaFiles.slice(0, contract.userVersion)) db.exec(readFileSync(join(schemaDirectory, name), 'utf8'));
  db.exec(`PRAGMA user_version=${contract.userVersion}`);
  db.prepare("INSERT INTO session (session_id, micro_cycle_id, session_date, started_at_ms, duration_min, session_rpe) VALUES (?, NULL, '2026-09-01', 1000, 42.5, 7.5)").run(label.length);
  const movementId = Number(db.prepare('SELECT MIN(movement_id) AS id FROM movement').get().id);
  for (let set = 1; set <= 3; set += 1) {
    db.prepare('INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (?, ?, ?, 5, ?, 8, ?)')
      .run(label.length, movementId, set, 40 + set * 2.5, 2000 + set);
  }
  db.prepare(`INSERT INTO health_support_note (note_id,revision,note_kind,body_text,provenance,recorded_at_ms,updated_at_ms)
    VALUES (?,1,'general',?,'user_reported',1,1)`).run(`note-${label}`, `private-note:${label}`);
  assert.equal(db.prepare('PRAGMA quick_check').get().quick_check, 'ok');
  db.close();
  return new Uint8Array(readFileSync(path));
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
      v63: matchesBackupSchemaContract(schemaObjects(db), V63, mockCryptoProvider),
      quickCheck: db.prepare('PRAGMA quick_check').get().quick_check,
    };
  } finally { db.close(); }
};
/** The athlete's own rows, for before/after equality. */
const athleteData = (path) => {
  const db = open(path);
  try {
    return JSON.stringify({
      sessions: db.prepare('SELECT * FROM session ORDER BY session_id').all(),
      sets: db.prepare('SELECT * FROM set_record ORDER BY set_id').all(),
      notes: db.prepare('SELECT * FROM health_support_note ORDER BY note_id').all(),
      movements: Number(db.prepare('SELECT COUNT(*) AS c FROM movement').get().c),
      profile: db.prepare('SELECT * FROM athlete_profile').all(),
    });
  } finally { db.close(); }
};
const preparationRows = (path) => {
  const db = open(path);
  try {
    // A v63 database has no preparation tables at all.
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'session_preparation'").get() === undefined) {
      return JSON.stringify({ preparation: [], items: [] });
    }
    return JSON.stringify({
      preparation: db.prepare('SELECT * FROM session_preparation ORDER BY session_id').all(),
      items: db.prepare('SELECT * FROM session_preparation_item ORDER BY session_id, item_index').all(),
    });
  } finally { db.close(); }
};
const hasTable = (db, name) => db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !== undefined;
const sportRows = (path) => {
  const db = open(path);
  try {
    if (!hasTable(db, 'athlete_sport_profile')) return NO_SPORT_OR_EMPHASIS;
    return JSON.stringify({
      sport: db.prepare('SELECT * FROM athlete_sport_profile').all(),
      links: db.prepare('SELECT * FROM athlete_goal_movement ORDER BY goal_id').all(),
      emphasis: db.prepare('SELECT * FROM block_emphasis ORDER BY block_id').all(),
    });
  } finally { db.close(); }
};
const NO_SPORT_OR_EMPHASIS = JSON.stringify({ sport: [], links: [], emphasis: [] });
/** Wearable telemetry: HRV (with its legacy resting_hr column) and, from 069,
 *  resting heart rate on its own. */
const telemetryRows = (path) => {
  const db = open(path);
  try {
    return JSON.stringify({
      hrv: db.prepare('SELECT * FROM hrv_daily ORDER BY date').all(),
      restingHr: hasTable(db, 'resting_hr_daily') ? db.prepare('SELECT * FROM resting_hr_daily ORDER BY date').all() : [],
    });
  } finally { db.close(); }
};
const seedLegacyHrv = (db) => db.exec("INSERT INTO hrv_daily (date, rmssd_ms, resting_hr, source) VALUES ('2026-09-02', 61.5, 52, 'health_connect')");
/** Coaching-text state of the library (068): how many movements carry a v2
 *  correction, and how many still read the shared "Set up <name> with" template. */
const coachingText = (path) => {
  const db = open(path);
  try {
    return {
      v2Corrections: Number(db.prepare('SELECT COUNT(*) AS c FROM movement_content_correction WHERE correction_version = 2').get().c),
      templateRows: Number(db.prepare("SELECT COUNT(*) AS c FROM movement m JOIN movement_detail d USING(movement_id) WHERE d.instructions LIKE 'Set up ' || m.name || ' with %'").get().c),
    };
  } finally { db.close(); }
};
/** A sport answer, a goal tied to an exercise, and one block with its frozen explanation (067). */
const seedSportAndEmphasis = (db) => {
  db.exec(`INSERT INTO athlete_sport_profile
    (sport_profile_id, sport_id, other_sport_name, outcome_id, experience_id, practice_sessions_per_week,
     matches_per_week, typical_session_min, competition_date, revision, updated_at_ms)
    VALUES (1, 'other', 'private-sport: Netball', 'general_support', '2_to_5_years', 2, NULL, 90, '2027-03-01', 3, 7000)`);
  db.exec("INSERT INTO athlete_goal_movement (goal_id, movement_id, linked_at_ms) VALUES ('goal-roundtrip-1', 1, 7100)");
  const blockId = Number(db.prepare("INSERT INTO training_block (start_date, objective, created_at_ms) VALUES ('2026-10-05', 'strength', 7200)").run().lastInsertRowid);
  db.prepare('INSERT INTO block_emphasis (block_id, emphasis_version, inputs_json, report_json, created_at_ms) VALUES (?, 1, ?, ?, 7300)')
    .run(blockId, JSON.stringify({ version: 1, focus: { description: 'Lower body' } }),
      JSON.stringify({ version: 1, applied: ['private-report: one thing changed.'], omitted: [] }));
};
const focusGoalRows = (path) => {
  const db = open(path);
  try {
    if (!hasTable(db, 'athlete_focus')) return NO_FOCUS_OR_GOALS;
    return JSON.stringify({
      focus: db.prepare('SELECT * FROM athlete_focus').all(),
      focusMuscles: db.prepare('SELECT * FROM athlete_focus_muscle ORDER BY muscle_group_id').all(),
      goals: db.prepare('SELECT * FROM athlete_goal ORDER BY goal_id').all(),
      revisions: db.prepare('SELECT * FROM athlete_goal_revision ORDER BY goal_id, revision').all(),
      observations: db.prepare('SELECT * FROM athlete_goal_observation ORDER BY observation_id').all(),
    });
  } finally { db.close(); }
};
const NO_FOCUS_OR_GOALS = JSON.stringify({ focus: [], focusMuscles: [], goals: [], revisions: [], observations: [] });
const seedCounts = (path) => {
  const db = open(path);
  try {
    return {
      muscleGroups: Number(db.prepare('SELECT COUNT(*) AS c FROM muscle_group').get().c),
      mappedMovements: Number(db.prepare('SELECT COUNT(DISTINCT movement_id) AS c FROM movement_muscle_role').get().c),
      roles: Number(db.prepare('SELECT COUNT(*) AS c FROM movement_muscle_role').get().c),
    };
  } finally { db.close(); }
};
/** A live session with a part-recorded preparation protocol (065). */
const seedPreparation = (db) => {
  db.exec("INSERT INTO session (session_id, micro_cycle_id, session_date, started_at_ms) VALUES (77, NULL, '2026-10-02', 5000)");
  db.prepare(`INSERT INTO session_preparation
    (session_id, instance_id, session_started_at_ms, policy_id, policy_revision, protocol_version,
     protocol_json, item_count, estimate_low_seconds, estimate_high_seconds, status, revision,
     created_at_ms, updated_at_ms, finished_at_ms)
    VALUES (77, 'prep-77-5000-roundtrip', 5000, 'ramp-general', 1, 1, ?, 2, 240, 330, 'pending', 1, 5000, 5000, NULL)`)
    .run(JSON.stringify({ version: 1, note: 'frozen protocol bytes' }));
  for (const [index, itemId] of [[0, 'raise.easy_movement'], [1, 'ramp.set_40']]) {
    db.prepare(`INSERT INTO session_preparation_item
      (session_id, item_index, item_id, item_revision, movement_id, prescribed_kind, prescribed_amount, per_side, status, updated_at_ms)
      VALUES (77, ?, ?, 1, NULL, ?, ?, 0, 'pending', 5000)`).run(index, itemId, index === 0 ? 'time' : 'ramp', index === 0 ? 240 : 6);
  }
  db.exec("UPDATE session_preparation SET status = 'in_progress', revision = 2, updated_at_ms = 5001 WHERE session_id = 77");
  db.exec("UPDATE session_preparation_item SET status = 'modified', performed_amount = 400, extra_work = 1, reason_code = 'athlete_choice', updated_at_ms = 5002 WHERE session_id = 77 AND item_index = 0");
};
/** An edited focus and a goal with two definitions and two measurements (066). */
const seedFocusAndGoals = (db) => {
  db.exec("INSERT INTO athlete_focus (focus_id, bundle_id, customised, movement_control, revision, updated_at_ms) VALUES (1, 'lower_body', 1, 0, 2, 6000)");
  for (const muscle of ['glutes', 'hamstrings', 'core']) {
    db.prepare('INSERT INTO athlete_focus_muscle (focus_id, muscle_group_id) VALUES (1, ?)').run(muscle);
  }
  db.exec("INSERT INTO athlete_goal (goal_id, status, current_revision, created_at_ms, updated_at_ms) VALUES ('goal-roundtrip-1', 'active', 1, 6000, 6000)");
  const revision = db.prepare(`INSERT INTO athlete_goal_revision
    (goal_id, revision, specific_outcome, metric_id, unit, measurement_method, baseline_known, baseline_value,
     target_value, reason, requested_deadline, recorded_at_ms)
    VALUES ('goal-roundtrip-1', ?, 'Squat 100 kg for 5 reps', 'load_kg', 'kg', 'Back squat, 5 reps to parallel', 1, 80, ?, 'private-reason: for football', ?, ?)`);
  revision.run(1, 100, '2027-01-08', 6000);
  const observation = db.prepare(`INSERT INTO athlete_goal_observation
    (observation_id, goal_id, goal_revision, observed_on, value, unit, source, recorded_at_ms)
    VALUES (?, 'goal-roundtrip-1', ?, ?, ?, 'kg', 'athlete_entered', ?)`);
  observation.run('obs-roundtrip-1', 1, '2026-09-20', 82.5, 6100);
  revision.run(2, 110, null, 6200);
  db.exec("UPDATE athlete_goal SET current_revision = 2, updated_at_ms = 6200 WHERE goal_id = 'goal-roundtrip-1'");
  observation.run('obs-roundtrip-2', 2, '2026-10-01', 87.5, 6300);
};
const snapshot = (athleteId, dbName, bytes, contract) => ({
  athleteId, dbName, byteLength: bytes.length, sha256Hex: mockCryptoProvider.sha256Hex(bytes),
  userVersion: contract.userVersion, tableCount: contract.tableCount, databaseBase64: bytesToBase64(bytes),
});
const archiveOf = (contract, registry, databases) => ({
  archiveVersion: 1,
  backupId: '00112233445566778899aabbccddeeff',
  createdAt: '2026-09-13T05:00:00.000Z',
  sourceAppVersion: '0.1.0',
  sourceSchemaVersion: contract.userVersion,
  sourceMigrationSlot: contract.migrationSlot,
  scope: 'all-athletes',
  restorePolicy: 'replace',
  registry,
  databases,
  previousSuccessfulBackupAt: null,
});
const libraryNames = () => readdirSync(mockLibraryDir).sort();
const artifacts = () => [...readdirSync(mockDocumentDir), ...readdirSync(mockLibraryDir), ...readdirSync(mockCacheDir)]
  .filter((name) => /^\.ak-(?:incoming|rollback|registry)|^\.ak_restore_|^ak-backup-|-wal$|-shm$|-journal$/.test(name));

const liveRegistry = {
  version: 1, activeId: 'default', advancedToolsUnlocked: false,
  athletes: [{ id: 'default', name: 'Current', dbName: 'athlete_kinetics.db', createdAtMs: 0 }],
};
const incomingRegistry = {
  version: 1, activeId: 'a123', advancedToolsUnlocked: true,
  athletes: [
    { id: 'default', name: 'Restored default', dbName: 'athlete_kinetics.db', createdAtMs: 0 },
    { id: 'a123', name: 'Alex', dbName: 'ak_athlete_a123.db', createdAtMs: 123 },
  ],
};
let liveHash;
let incomingDir;

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
  mockRoot = mkdtempSync(join(tmpdir(), 'ak-forward-restore-'));
  mockDocumentDir = join(mockRoot, 'Documents').replaceAll('\\', '/');
  mockCacheDir = join(mockRoot, 'Cache').replaceAll('\\', '/');
  mockLibraryDir = join(mockRoot, 'Library').replaceAll('\\', '/');
  incomingDir = join(mockRoot, 'Incoming');
  for (const path of [mockDocumentDir, mockCacheDir, mockLibraryDir, incomingDir]) mkdirSync(path, { recursive: true });
  Object.assign(mockFs.dirs, { DocumentDir: mockDocumentDir, CacheDir: mockCacheDir, LibraryDir: mockLibraryDir });
  writeFileSync(join(mockDocumentDir, 'coach_athletes.json'), serializeRegistry(liveRegistry));
  liveHash = mockCryptoProvider.sha256Hex(makeDatabase(join(mockLibraryDir, 'athlete_kinetics.db'), CURRENT, 'live'));
  mockSelectedBackupPath = join(mockRoot, 'selected.pmbak');
  useBackupStore.getState().cancelRestore();
  useBackupStore.setState({ status: 'idle', startupSafe: true, message: null, preview: null, lastSuccessfulBackupAt: null, recoveryAvailable: false });
});

afterEach(() => rmSync(mockRoot, { recursive: true, force: true }));

/** Seal a pre-upgrade archive (v63 unless told otherwise) of two athletes and
 * select it as the portable backup. */
async function selectLegacyBackup(mutate, contract = V63) {
  const defaultPath = join(incomingDir, 'athlete_kinetics.db');
  const alexPath = join(incomingDir, 'ak_athlete_a123.db');
  makeDatabase(defaultPath, contract, 'legacy-default');
  makeDatabase(alexPath, contract, 'legacy-alex');
  if (mutate !== undefined) mutate(defaultPath);
  const defaultBytes = new Uint8Array(readFileSync(defaultPath));
  const alexBytes = new Uint8Array(readFileSync(alexPath));
  const sealed = await sealBackup(archiveOf(contract, incomingRegistry, [
    snapshot('default', 'athlete_kinetics.db', defaultBytes, contract),
    snapshot('a123', 'ak_athlete_a123.db', alexBytes, contract),
  ]), PASSWORD, mockCryptoProvider);
  writeFileSync(mockSelectedBackupPath, sealed);
  mockSelectedSize = statSync(mockSelectedBackupPath).size;
  return {
    sealed,
    data: { default: athleteData(defaultPath), alex: athleteData(alexPath) },
    preparation: { default: preparationRows(defaultPath), alex: preparationRows(alexPath) },
    focusGoals: { default: focusGoalRows(defaultPath), alex: focusGoalRows(alexPath) },
    sport: { default: sportRows(defaultPath), alex: sportRows(alexPath) },
    telemetry: { default: telemetryRows(defaultPath), alex: telemetryRows(alexPath) },
    hashes: { default: mockCryptoProvider.sha256Hex(defaultBytes), alex: mockCryptoProvider.sha256Hex(alexBytes) },
  };
}

function expectForwardRestored(legacy) {
  for (const [name, key] of [['athlete_kinetics.db', 'default'], ['ak_athlete_a123.db', 'alex']]) {
    const path = join(mockLibraryDir, name);
    // Exactly the current schema — not "close", and no longer the v63 one.
    expect(describe_(path)).toEqual({ userVersion: CURRENT.userVersion, current: true, v63: false, quickCheck: 'ok' });
    // Every athlete row the backup held is still there, unchanged.
    expect(athleteData(path)).toBe(legacy.data[key]);
    // The migration added tables; it did not invent preparation history,
    // a focus or a goal — and it did seed the muscle mapping the planner reads.
    expect(preparationRows(path)).toBe(legacy.preparation[key]);
    // Focus and goals the backup held are kept; none are invented where it held none.
    expect(focusGoalRows(path)).toBe(legacy.focusGoals[key]);
    // A sport answer, goal exercise link and block explanation the backup held
    // are kept; none is invented where it held none.
    expect(sportRows(path)).toBe(legacy.sport[key]);
    // HRV history (and its legacy resting_hr) is kept byte-for-byte; 069 adds
    // an empty resting_hr_daily and copies or invents nothing into it.
    expect(telemetryRows(path)).toBe(legacy.telemetry[key]);
    expect(JSON.parse(telemetryRows(path)).restingHr).toEqual([]);
    // The forward migration brought the library text up to date: all 115 v2
    // corrections applied, only the deliberately held template rows remain.
    expect(coachingText(path)).toEqual({ v2Corrections: 115, templateRows: 29 });
    expect(seedCounts(path)).toEqual({ muscleGroups: 17, mappedMovements: 299, roles: 794 });
    // The installed file is the migrated copy, not the v63 bytes.
    expect(mockHashFile(path)).not.toBe(legacy.hashes[key]);
  }
  expect(libraryNames()).toEqual(['ak_athlete_a123.db', 'athlete_kinetics.db']);
  expect(artifacts()).toEqual([]);
}

test('the registry lists the shipped v63 schema as a supported pre-upgrade source', () => {
  expect(V63).toMatchObject({ userVersion: 63, migrationSlot: 64, tableCount: 104 });
  expect(CURRENT.userVersion).toBeGreaterThan(V63.userVersion);
  const path = join(incomingDir, 'probe.db');
  makeDatabase(path, V63, 'probe');
  expect(describe_(path)).toMatchObject({ userVersion: 63, v63: true, current: false });
});

test('a v63 portable backup restores: validated as v63, forward-migrated in isolation, installed at the current schema', async () => {
  const legacy = await selectLegacyBackup();
  await useBackupStore.getState().chooseRestore(PASSWORD);
  expect(useBackupStore.getState().status).toBe('preview');
  expect(useBackupStore.getState().preview).toMatchObject({ databaseCount: 2, replaceOnly: true, source: 'portable_backup' });
  // Nothing live changes at preview time.
  expect(mockHashFile(join(mockLibraryDir, 'athlete_kinetics.db'))).toBe(liveHash);

  await useBackupStore.getState().confirmRestore(PASSWORD);
  expect(useBackupStore.getState()).toMatchObject({ status: 'success' });
  expectForwardRestored(legacy);
  expect(JSON.parse(readFileSync(join(mockDocumentDir, 'coach_athletes.json'), 'utf8')).activeId).toBe('a123');
  // The undo point for the data that was replaced exists and is current-schema.
  const recovery = await openBackup(readFileSync(join(mockDocumentDir, 'pikeMethods-recovery-current.pmbak'), 'utf8'), PASSWORD, mockCryptoProvider);
  expect(recovery.ok).toBe(true);
  expect(recovery.archive.sourceSchemaVersion).toBe(CURRENT.userVersion);
  expect(mockRestartStore).toHaveBeenCalledTimes(1);

  // Order: the forward migration happens on staged copies BEFORE the applying
  // marker is published, i.e. before any live database is replaced.
  const firstLiveMove = mockFileOps.findIndex(([kind, source, destination]) => kind === 'move'
    && /\.ak-incoming-/.test(source) && /athlete_kinetics\.db$|ak_athlete_a123\.db$/.test(destination));
  const applyingMarker = mockFileOps.findIndex(([kind, source, destination]) => kind === 'move'
    && /\.ak_restore_applying-[a-f0-9]{32}\.new$/.test(source) && destination !== undefined);
  expect(applyingMarker).toBeGreaterThanOrEqual(0);
  expect(firstLiveMove).toBeGreaterThan(applyingMarker);
});

test('a retained recovery copy of pre-upgrade data restores the same way', async () => {
  const legacy = await selectLegacyBackup();
  copyFileSync(mockSelectedBackupPath, join(mockDocumentDir, 'pikeMethods-recovery-current.pmbak'));
  const recoveryBefore = mockHashFile(join(mockDocumentDir, 'pikeMethods-recovery-current.pmbak'));
  useBackupStore.setState({ status: 'idle', recoveryAvailable: true, message: null });

  await useBackupStore.getState().reviewRecovery(PASSWORD);
  expect(useBackupStore.getState()).toMatchObject({ status: 'preview' });
  expect(useBackupStore.getState().preview).toMatchObject({ source: 'retained_recovery', databaseCount: 2 });
  await useBackupStore.getState().confirmRestore(PASSWORD);
  expect(useBackupStore.getState()).toMatchObject({ status: 'success' });
  expectForwardRestored(legacy);
  // The retained recovery is the undo point being used: it is never rewritten.
  expect(mockHashFile(join(mockDocumentDir, 'pikeMethods-recovery-current.pmbak'))).toBe(recoveryBefore);
});

test('a failed forward migration changes no live database, registry or recovery state', async () => {
  await selectLegacyBackup();
  const registryBefore = readFileSync(join(mockDocumentDir, 'coach_athletes.json'), 'utf8');
  await useBackupStore.getState().chooseRestore(PASSWORD);
  expect(useBackupStore.getState().status).toBe('preview');
  mockMigrateFailure = 'injected migration failure';

  await useBackupStore.getState().confirmRestore(PASSWORD);
  expect(useBackupStore.getState().status).toBe('error');
  expect(useBackupStore.getState().message)
    .toBe('A restored database could not be brought up to the current app schema. Existing data is unchanged.');
  expect(useBackupStore.getState().message).not.toContain('injected');
  // Regression: the live database is byte-identical — nothing was overwritten before success.
  expect(mockHashFile(join(mockLibraryDir, 'athlete_kinetics.db'))).toBe(liveHash);
  expect(libraryNames()).toEqual(['athlete_kinetics.db']);
  expect(readFileSync(join(mockDocumentDir, 'coach_athletes.json'), 'utf8')).toBe(registryBefore);
  expect(artifacts()).toEqual([]);
  expect(mockFileOps.some(([kind, source]) => kind === 'move' && /\.ak_restore_applying-/.test(source))).toBe(false);
  expect(useBackupStore.getState().startupSafe).toBe(true);
});

test.each([
  ['a dropped index', (db) => db.exec('DROP INDEX idx_session_date')],
  ['an extra table', (db) => db.exec('CREATE TABLE smuggled (id INTEGER PRIMARY KEY) STRICT')],
  ['a weakened trigger', (db) => db.exec('DROP TRIGGER trg_session_date_guard_bu')],
])('a "v63" database with %s is not the v63 schema and fails closed before any migration', async (_label, damage) => {
  await selectLegacyBackup((path) => { const db = open(path); try { damage(db); } finally { db.close(); } });
  await useBackupStore.getState().chooseRestore(PASSWORD);
  if (useBackupStore.getState().status === 'preview') await useBackupStore.getState().confirmRestore(PASSWORD);
  expect(useBackupStore.getState().status).toBe('error');
  expect(useBackupStore.getState().message).toMatch(/failed validation|does not match the verified app schema|inventory is invalid/);
  expect(mockHashFile(join(mockLibraryDir, 'athlete_kinetics.db'))).toBe(liveHash);
  expect(libraryNames()).toEqual(['athlete_kinetics.db']);
  expect(artifacts()).toEqual([]);
});

test('a v63 archive that carries a current-schema database is refused (the declared schema must be the real one)', async () => {
  const path = join(incomingDir, 'athlete_kinetics.db');
  const bytes = makeDatabase(path, CURRENT, 'mislabelled');
  const mislabelled = { ...snapshot('default', 'athlete_kinetics.db', bytes, V63) };
  const registry = { ...liveRegistry };
  // Claiming v63 with the v63 table count over a 106-table database.
  writeFileSync(mockSelectedBackupPath, await sealBackup(archiveOf(V63, registry, [mislabelled]), PASSWORD, mockCryptoProvider));
  mockSelectedSize = statSync(mockSelectedBackupPath).size;
  await useBackupStore.getState().chooseRestore(PASSWORD);
  expect(useBackupStore.getState().status).toBe('preview');
  await useBackupStore.getState().confirmRestore(PASSWORD);
  expect(useBackupStore.getState().status).toBe('error');
  expect(useBackupStore.getState().message).toBe('A restored database failed validation. Existing data is unchanged.');
  expect(mockHashFile(join(mockLibraryDir, 'athlete_kinetics.db'))).toBe(liveHash);
  expect(artifacts()).toEqual([]);
});

test('future and unknown schemas cannot even be sealed or opened as a backup', async () => {
  const bytes = new Uint8Array(readFileSync(join(mockLibraryDir, 'athlete_kinetics.db')));
  const withSchema = (userVersion, migrationSlot, tableCount) => archiveOf(
    { userVersion, migrationSlot }, liveRegistry,
    [snapshot('default', 'athlete_kinetics.db', bytes, { userVersion, tableCount })],
  );
  await expect(sealBackup(withSchema(CURRENT.userVersion + 1, CURRENT.migrationSlot + 1, CURRENT.tableCount), PASSWORD, mockCryptoProvider))
    .rejects.toMatchObject({ code: 'newer_version' });
  await expect(sealBackup(withSchema(V63.userVersion, CURRENT.migrationSlot, V63.tableCount), PASSWORD, mockCryptoProvider))
    .rejects.toMatchObject({ code: 'unsupported_version' });
  await expect(sealBackup(withSchema(V63.userVersion - 1, V63.migrationSlot - 1, V63.tableCount), PASSWORD, mockCryptoProvider))
    .rejects.toMatchObject({ code: 'unsupported_version' });
});

test('backing up an athlete file that is still at v63 produces a current-schema archive and leaves that live file untouched', async () => {
  // A second athlete who has not been opened since the app update.
  const staleBytes = makeDatabase(join(mockLibraryDir, 'ak_athlete_old1.db'), V63, 'not-opened-since-update');
  const staleHash = mockCryptoProvider.sha256Hex(staleBytes);
  const staleData = athleteData(join(mockLibraryDir, 'ak_athlete_old1.db'));
  writeFileSync(join(mockDocumentDir, 'coach_athletes.json'), serializeRegistry({
    ...liveRegistry,
    athletes: [...liveRegistry.athletes, { id: 'old1', name: 'Stale', dbName: 'ak_athlete_old1.db', createdAtMs: 1 }],
  }));

  await useBackupStore.getState().createBackup(PASSWORD);
  // Regression: before forward-restore support this failed with "unsupported schema".
  expect(useBackupStore.getState()).toMatchObject({ status: 'success' });
  expect(mockHashFile(join(mockLibraryDir, 'ak_athlete_old1.db'))).toBe(staleHash); // live file untouched
  expect(describe_(join(mockLibraryDir, 'ak_athlete_old1.db'))).toMatchObject({ userVersion: 63, v63: true });

  const opened = await openBackup(readFileSync(mockSavedBackupPath, 'utf8'), PASSWORD, mockCryptoProvider);
  expect(opened.ok).toBe(true);
  expect(opened.archive.sourceSchemaVersion).toBe(CURRENT.userVersion);
  expect(opened.archive.databases.map((database) => [database.userVersion, database.tableCount]))
    .toEqual([[CURRENT.userVersion, CURRENT.tableCount], [CURRENT.userVersion, CURRENT.tableCount]]);
  const stale = opened.archive.databases.find((database) => database.athleteId === 'old1');
  const extracted = join(mockRoot, 'extracted-old1.db');
  writeFileSync(extracted, Buffer.from(base64ToBytes(stale.databaseBase64)));
  expect(describe_(extracted)).toEqual({ userVersion: CURRENT.userVersion, current: true, v63: false, quickCheck: 'ok' });
  expect(athleteData(extracted)).toBe(staleData);
  expect(artifacts()).toEqual([]);
});

test('round trip at the current schema: a live session, its preparation protocol and item records survive backup and restore', async () => {
  const livePath = join(mockLibraryDir, 'athlete_kinetics.db');
  const db = open(livePath);
  seedPreparation(db);
  db.close();
  const before = { athlete: athleteData(livePath), preparation: preparationRows(livePath) };
  expect(JSON.parse(before.preparation).items).toHaveLength(2);

  await useBackupStore.getState().createBackup(PASSWORD);
  expect(useBackupStore.getState()).toMatchObject({ status: 'success' });

  // Lose the data, then restore it from the backup just made.
  const wipe = open(livePath);
  wipe.exec('DELETE FROM session_preparation_item; DELETE FROM session_preparation; DELETE FROM set_record; DELETE FROM session');
  wipe.close();
  expect(preparationRows(livePath)).toBe(JSON.stringify({ preparation: [], items: [] }));
  copyFileSync(mockSavedBackupPath, mockSelectedBackupPath);
  mockSelectedSize = statSync(mockSelectedBackupPath).size;
  useBackupStore.setState({ status: 'idle', message: null, preview: null });
  await useBackupStore.getState().chooseRestore(PASSWORD);
  expect(useBackupStore.getState().status).toBe('preview');
  await useBackupStore.getState().confirmRestore(PASSWORD);
  expect(useBackupStore.getState()).toMatchObject({ status: 'success' });

  expect(athleteData(livePath)).toBe(before.athlete);
  expect(preparationRows(livePath)).toBe(before.preparation);
  expect(describe_(livePath)).toMatchObject({ userVersion: CURRENT.userVersion, current: true });
  expect(artifacts()).toEqual([]);
});

describe('every registered pre-upgrade schema restores, not only the first', () => {
  const PRE_UPGRADE = SUPPORTED_BACKUP_SCHEMA_CONTRACTS.slice(0, -1);

  test('the registry is a contiguous chain ending at the current schema', () => {
    expect(SUPPORTED_BACKUP_SCHEMA_CONTRACTS.map((contract) => contract.userVersion))
      .toEqual(SUPPORTED_BACKUP_SCHEMA_CONTRACTS.map((_, index) => V63.userVersion + index));
    expect(SUPPORTED_BACKUP_SCHEMA_CONTRACTS.map((contract) => contract.migrationSlot - contract.userVersion))
      .toEqual(SUPPORTED_BACKUP_SCHEMA_CONTRACTS.map(() => 1));
    expect(SUPPORTED_BACKUP_SCHEMA_CONTRACTS[SUPPORTED_BACKUP_SCHEMA_CONTRACTS.length - 1]).toBe(CURRENT);
    // 068 is text only: it shares the v66 schema fingerprint and is still its own contract.
    const v66 = SUPPORTED_BACKUP_SCHEMA_CONTRACTS.find((contract) => contract.userVersion === 66);
    const v67 = SUPPORTED_BACKUP_SCHEMA_CONTRACTS.find((contract) => contract.userVersion === 67);
    expect(v67.fingerprint).toBe(v66.fingerprint);
    expect([v67.migrationSlot, v66.migrationSlot]).toEqual([68, 67]);
    // 069 adds a table, so v68 has a fingerprint of its own.
    const v68 = SUPPORTED_BACKUP_SCHEMA_CONTRACTS.find((contract) => contract.userVersion === 68);
    expect(v68.fingerprint).not.toBe(v67.fingerprint);
    expect([v68.migrationSlot, v68.tableCount]).toEqual([69, v67.tableCount + 1]);
    expect(PRE_UPGRADE.length).toBeGreaterThanOrEqual(5);
  });

  test.each(PRE_UPGRADE.map((contract) => [contract.userVersion, contract]))(
    'a v%i portable backup is validated as itself and installed at the current schema with its data intact',
    async (_version, contract) => {
      // A backup made after 065 shipped carries preparation records; they must
      // survive the remaining forward migrations untouched.
      const hasPreparation = contract.userVersion >= 64;
      // A backup made after 066 shipped carries a focus and goals as well.
      const hasFocusGoals = contract.userVersion >= 65;
      // ... and after 067, a sport answer, a goal exercise and a block explanation.
      const hasSport = contract.userVersion >= 66;
      const legacy = await selectLegacyBackup((path) => {
        const db = open(path);
        try {
          // Every backup-capable schema has hrv_daily; resting HR there sits beside RMSSD.
          seedLegacyHrv(db);
          if (hasPreparation) seedPreparation(db);
          if (hasFocusGoals) seedFocusAndGoals(db);
          if (hasSport) seedSportAndEmphasis(db);
        } finally { db.close(); }
      }, contract);
      expect(JSON.parse(legacy.telemetry.default).hrv).toEqual([expect.objectContaining({ date: '2026-09-02', resting_hr: 52 })]);
      // Before the restore the backed-up library reads the template everywhere,
      // unless the backup was made after 068 shipped (v67 and later).
      expect(coachingText(join(incomingDir, 'athlete_kinetics.db'))).toEqual(contract.userVersion >= 67
        ? { v2Corrections: 115, templateRows: 29 } : { v2Corrections: 0, templateRows: 144 });
      if (hasSport) expect(JSON.parse(legacy.sport.default).emphasis).toHaveLength(1);
      if (hasPreparation) expect(JSON.parse(legacy.preparation.default).items).toHaveLength(2);
      if (hasFocusGoals) {
        expect(JSON.parse(legacy.focusGoals.default).revisions).toHaveLength(2);
        expect(legacy.focusGoals.alex).toBe(NO_FOCUS_OR_GOALS);
      }
      const built = open(join(incomingDir, 'athlete_kinetics.db'));
      try { expect(matchesBackupSchemaContract(schemaObjects(built), contract, mockCryptoProvider)).toBe(true); } finally { built.close(); }

      await useBackupStore.getState().chooseRestore(PASSWORD);
      expect(useBackupStore.getState().status).toBe('preview');
      expect(mockHashFile(join(mockLibraryDir, 'athlete_kinetics.db'))).toBe(liveHash);
      await useBackupStore.getState().confirmRestore(PASSWORD);
      expect(useBackupStore.getState()).toMatchObject({ status: 'success' });
      expectForwardRestored(legacy);
    },
  );

  test.each(PRE_UPGRADE.slice(1).map((contract) => [contract.userVersion, contract]))(
    'a v%i archive whose database is really one schema older is refused (or, where the two schemas are identical, healed to the current library)',
    async (_version, contract) => {
      const older = SUPPORTED_BACKUP_SCHEMA_CONTRACTS[SUPPORTED_BACKUP_SCHEMA_CONTRACTS.indexOf(contract) - 1];
      const path = join(incomingDir, 'athlete_kinetics.db');
      makeDatabase(path, older, 'mislabelled-older');
      // Declared at the newer schema; the bytes are the older one with the newer version stamped on.
      const stamped = open(path);
      stamped.exec(`PRAGMA user_version=${contract.userVersion}`);
      stamped.close();
      const stampedBytes = new Uint8Array(readFileSync(path));
      writeFileSync(mockSelectedBackupPath, await sealBackup(archiveOf(contract, liveRegistry,
        [{ ...snapshot('default', 'athlete_kinetics.db', stampedBytes, contract) }]), PASSWORD, mockCryptoProvider));
      mockSelectedSize = statSync(mockSelectedBackupPath).size;
      await useBackupStore.getState().chooseRestore(PASSWORD);
      if (useBackupStore.getState().status === 'preview') await useBackupStore.getState().confirmRestore(PASSWORD);
      if (older.fingerprint === contract.fingerprint) {
        // 068 changed coaching text only, so v66 and v67 are the same schema and
        // the mislabel cannot be seen in it. What protects the athlete is the 068
        // row sentinel: the forward migration detects the missing correction and
        // re-applies it, so the installed file is the full current library.
        expect(useBackupStore.getState().status).toBe('success');
        const installed = join(mockLibraryDir, 'athlete_kinetics.db');
        expect(describe_(installed)).toMatchObject({ userVersion: CURRENT.userVersion, current: true, quickCheck: 'ok' });
        expect(coachingText(installed)).toEqual({ v2Corrections: 115, templateRows: 29 });
        expect(artifacts()).toEqual([]);
        return;
      }
      expect(useBackupStore.getState().status).toBe('error');
      expect(mockHashFile(join(mockLibraryDir, 'athlete_kinetics.db'))).toBe(liveHash);
      expect(artifacts()).toEqual([]);
    },
  );
});

test('round trip at the current schema: focus, goals, every revision and measurement, the sport answer, goal exercise, block explanation and resting heart rate survive backup and restore', async () => {
  const livePath = join(mockLibraryDir, 'athlete_kinetics.db');
  const db = open(livePath);
  seedFocusAndGoals(db);
  seedSportAndEmphasis(db);
  seedLegacyHrv(db);
  // Resting HR with no HRV beside it, from each service (069).
  db.exec(`INSERT INTO resting_hr_daily (date, bpm, source, synced_at_ms) VALUES
    ('2026-09-03', 54.5, 'apple_health', 8000), ('2026-09-04', 49, 'health_connect', 8100)`);
  db.close();
  const before = {
    athlete: athleteData(livePath), focusGoals: focusGoalRows(livePath), seeds: seedCounts(livePath), sport: sportRows(livePath),
    telemetry: telemetryRows(livePath),
  };
  expect(JSON.parse(before.telemetry).restingHr).toHaveLength(2);
  expect(JSON.parse(before.sport)).toMatchObject({ sport: [{ sport_id: 'other', revision: 3 }], links: [{ movement_id: 1 }] });
  expect(JSON.parse(before.sport).emphasis).toHaveLength(1);
  expect(JSON.parse(before.focusGoals)).toMatchObject({ focus: [{ bundle_id: 'lower_body', revision: 2 }] });
  expect(JSON.parse(before.focusGoals).revisions).toHaveLength(2);
  expect(JSON.parse(before.focusGoals).observations).toHaveLength(2);

  await useBackupStore.getState().createBackup(PASSWORD);
  expect(useBackupStore.getState()).toMatchObject({ status: 'success' });
  // The athlete's own words are inside the encrypted archive, never in the clear.
  expect(readFileSync(mockSavedBackupPath, 'utf8')).not.toContain('private-reason');
  expect(readFileSync(mockSavedBackupPath, 'utf8')).not.toContain('private-sport');
  expect(readFileSync(mockSavedBackupPath, 'utf8')).not.toContain('private-report');

  // Lose the data, then restore. Deleting the goal is the one supported way
  // to remove its revisions and measurements (they cascade with it).
  const wipe = open(livePath);
  wipe.exec('PRAGMA foreign_keys = ON; DELETE FROM athlete_goal; DELETE FROM athlete_focus;'
    + ' DELETE FROM athlete_sport_profile; DELETE FROM training_block;'
    + ' DELETE FROM hrv_daily; DELETE FROM resting_hr_daily;');
  wipe.close();
  expect(JSON.parse(telemetryRows(livePath))).toEqual({ hrv: [], restingHr: [] });
  expect(focusGoalRows(livePath)).toBe(NO_FOCUS_OR_GOALS);
  // The goal link and the block explanation went with their parents.
  expect(sportRows(livePath)).toBe(NO_SPORT_OR_EMPHASIS);
  copyFileSync(mockSavedBackupPath, mockSelectedBackupPath);
  mockSelectedSize = statSync(mockSelectedBackupPath).size;
  useBackupStore.setState({ status: 'idle', message: null, preview: null });
  await useBackupStore.getState().chooseRestore(PASSWORD);
  expect(useBackupStore.getState().status).toBe('preview');
  await useBackupStore.getState().confirmRestore(PASSWORD);
  expect(useBackupStore.getState()).toMatchObject({ status: 'success' });

  expect(focusGoalRows(livePath)).toBe(before.focusGoals);
  expect(sportRows(livePath)).toBe(before.sport);
  expect(telemetryRows(livePath)).toBe(before.telemetry);
  expect(athleteData(livePath)).toBe(before.athlete);
  expect(seedCounts(livePath)).toEqual(before.seeds);
  // The restored file is the real current schema again, guards included.
  expect(describe_(livePath)).toMatchObject({ userVersion: CURRENT.userVersion, current: true });
  const restored = open(livePath);
  try {
    expect(() => restored.exec('UPDATE athlete_goal_revision SET target_value = 500')).toThrow(/immutable/);
    expect(() => restored.exec("UPDATE block_emphasis SET report_json = '{}'")).toThrow(/immutable/);
  } finally { restored.close(); }
  expect(artifacts()).toEqual([]);
});
