import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';

const require = createRequire(import.meta.url);
const backup = require('../.build/backup/index.js');
const work = mkdtempSync(join(tmpdir(), 'ak-encrypted-backup-'));
const schemaDirectory = join(import.meta.dirname, '..', '..', 'src', 'schema');

const cryptoProvider = {
  randomBytes(length) { return new Uint8Array(randomBytes(length)); },
  deriveScryptKey(password, salt, parameters) {
    return new Promise((resolve, reject) => scrypt(password, salt, parameters.dkLen, {
      N: parameters.N, r: parameters.r, p: parameters.p, maxmem: 80 * 1024 * 1024,
    }, (error, key) => error ? reject(error) : resolve(new Uint8Array(key))));
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

const runnerSource = readFileSync(join(import.meta.dirname, '..', '..', 'src', 'migrationRunner.ts'), 'utf8');
const sentinelTables = [...runnerSource.matchAll(/type: 'table', name: '([^']+)'/g)].map((match) => match[1]);
const tableNames = [...new Set([...sentinelTables, 'routine_template_contract_cutoff'])].sort();
assert.equal(tableNames.length, 104, 'live durable inventory must still contain exactly 104 tables');

function makeDatabase(file, label) {
  const db = new DatabaseSync(file);
  for (const name of readdirSync(schemaDirectory).filter((name) => /^0\d\d_.*\.sql$/.test(name) && !name.startsWith('004_')).sort()) {
    db.exec(readFileSync(join(schemaDirectory, name), 'utf8'));
  }
  db.prepare(`INSERT INTO activity_definition
    (activity_id,kind_id,display_name,demand_class,demand_source,provenance,created_at_ms,updated_at_ms)
    VALUES (?,?,?,?,?,?,?,?)`).run(`swim-${label}`, 'swimming', `Swimming ${label}`, 'unknown', 'user_reported', 'user_reported', 1, 1);
  db.prepare(`INSERT INTO activity_occurrence
    (occurrence_id,activity_id,origin_kind,origin_identity,revision,local_date,timezone_id,time_resolution_state,
     occurrence_state,timing_commitment,modality_id,purpose_id,created_at_ms,updated_at_ms)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      `friday-${label}`, `swim-${label}`, 'manual', `manual-${label}`, 1, '2026-09-11', 'Australia/Sydney',
      'unresolved', 'planned', 'flexible', 'unknown', 'unknown', 1, 1,
    );
  db.prepare(`INSERT INTO health_support_note
    (note_id,revision,note_kind,body_text,provenance,recorded_at_ms,updated_at_ms)
    VALUES (?,?,?,?,?,?,?)`).run(`note-${label}`, 1, 'general', `private-support-fixture:${label}`, 'user_reported', 1, 1);
  db.exec('PRAGMA user_version=63');
  assert.equal(db.prepare('PRAGMA quick_check').get().quick_check, 'ok');
  const schemaObjects = db.prepare("SELECT type,name,tbl_name,coalesce(sql,'') AS sql FROM sqlite_master WHERE type IN ('table','index','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type,name").all()
    .map((object) => [object.type, object.name, object.tbl_name, object.sql, object.type === 'table'
      ? db.prepare(`PRAGMA table_info("${object.name.replaceAll('"', '""')}")`).all()
        .map((column) => [column.cid, column.name, column.type, column.notnull, column.dflt_value, column.pk]) : []]);
  assert.equal(backup.isCurrentBackupSchema(schemaObjects, cryptoProvider), true,
    'the exhaustive schema fingerprint must match a database built by the real migration chain');
  const mutatedSchema = schemaObjects.map((object, index) => index === 0 ? [...object.slice(0, 3), `${object[3]} -- mutation`, object[4]] : object);
  assert.equal(backup.isCurrentBackupSchema(mutatedSchema, cryptoProvider), false,
    'a one-byte schema mutation must fail the exhaustive contract');
  db.close();
  return new Uint8Array(readFileSync(file));
}

function snapshot(athleteId, dbName, bytes) {
  return {
    athleteId, dbName, byteLength: bytes.length, sha256Hex: cryptoProvider.sha256Hex(bytes),
    userVersion: 63, tableCount: 104, databaseBase64: backup.bytesToBase64(bytes),
  };
}

const defaultBytes = makeDatabase(join(work, 'default.db'), 'default');
const alexBytes = makeDatabase(join(work, 'alex.db'), 'alex');

// Exercise the exact SQLite snapshot facility used on device. A separate
// thread writes WAL commits while VACUUM INTO runs; the resulting database
// must be a complete, integrity-valid point-in-time snapshot.
const livePath = join(work, 'live.db');
const liveSnapshotPath = join(work, 'live-snapshot.db');
const live = new DatabaseSync(livePath);
live.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE events(id INTEGER PRIMARY KEY, value TEXT);');
for (let id = 1; id <= 2000; id += 1) live.prepare('INSERT INTO events VALUES (?,?)').run(id, `before-${id}`);
live.close();
const stop = new SharedArrayBuffer(4);
const writer = new Worker(`
  const { parentPort, workerData } = require('node:worker_threads');
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(workerData.path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  let id = 2001;
  parentPort.postMessage('ready');
  const write = () => {
    if (Atomics.load(new Int32Array(workerData.stop), 0) !== 0) { db.close(); parentPort.postMessage(id); return; }
    try { for (let n = 0; n < 20; n += 1) db.prepare('INSERT INTO events VALUES (?,?)').run(id, 'during-' + id++); } catch {}
    setImmediate(write);
  };
  write();
`, { eval: true, workerData: { path: livePath, stop } });
await new Promise((resolve, reject) => { writer.once('message', resolve); writer.once('error', reject); });
const snapshotSource = new DatabaseSync(livePath);
snapshotSource.exec(`VACUUM INTO '${liveSnapshotPath.replaceAll("'", "''")}'`);
snapshotSource.close();
const writerFinished = new Promise((resolve, reject) => { writer.once('message', resolve); writer.once('error', reject); });
Atomics.store(new Int32Array(stop), 0, 1);
await writerFinished;
await writer.terminate();
const liveSnapshot = new DatabaseSync(liveSnapshotPath, { readOnly: true });
assert.equal(liveSnapshot.prepare('PRAGMA quick_check').get().quick_check, 'ok');
const snapshotCount = liveSnapshot.prepare('SELECT COUNT(*) AS count FROM events').get().count;
assert.ok(snapshotCount >= 2000, 'snapshot must contain every commit that preceded the snapshot');
assert.equal(liveSnapshot.prepare("SELECT COUNT(*) AS count FROM events WHERE value IS NULL OR value = ''").get().count, 0,
  'snapshot must not expose partial concurrent rows');
liveSnapshot.close();
const archive = {
  archiveVersion: 1,
  backupId: '00112233445566778899aabbccddeeff',
  createdAt: '2026-09-13T05:00:00.000Z',
  sourceAppVersion: '0.1.0',
  sourceSchemaVersion: 63,
  sourceMigrationSlot: 64,
  scope: 'all-athletes',
  restorePolicy: 'replace',
  registry: {
    version: 1, activeId: 'default', advancedToolsUnlocked: false,
    athletes: [
      { id: 'default', name: 'Athlete 1', dbName: 'athlete_kinetics.db', createdAtMs: 0 },
      { id: 'a123', name: 'Alex', dbName: 'ak_athlete_a123.db', createdAtMs: 123 },
    ],
  },
  databases: [snapshot('default', 'athlete_kinetics.db', defaultBytes), snapshot('a123', 'ak_athlete_a123.db', alexBytes)],
  previousSuccessfulBackupAt: null,
};

try {
  const password = 'correct horse battery staple';
  const sealed = await backup.sealBackup(archive, password, cryptoProvider);
  assert.doesNotMatch(sealed, /Athlete 1|private-support-fixture|"name":"Alex"|Swimming default/,
    'private athlete and support data must not appear outside ciphertext');
  const opened = await backup.openBackup(sealed, password, cryptoProvider);
  assert.equal(opened.ok, true);
  assert.deepEqual(opened.archive, archive, 'all-athlete encrypted round trip must preserve the complete physical snapshots');
  assert.deepEqual(backup.base64ToBytes(opened.archive.databases[0].databaseBase64), defaultBytes,
    'fresh-install restore bytes must exactly match the snapshotted database bytes');
  assert.deepEqual(backup.base64ToBytes(opened.archive.databases[1].databaseBase64), alexBytes);

  assert.equal((await backup.openBackup(sealed, 'wrong password value', cryptoProvider)).code, 'authentication_failed');
  const outer = JSON.parse(sealed);
  const tamperedCiphertext = `${outer.ciphertextBase64.slice(0, -8)}AAAAAAAA`;
  const tampered = backup.canonicalJson({ ...outer, ciphertextBase64: tamperedCiphertext });
  assert.equal((await backup.openBackup(tampered, password, cryptoProvider)).code, 'authentication_failed');
  assert.equal((await backup.openBackup(sealed.slice(0, -20), password, cryptoProvider)).code, 'invalid_container');
  assert.equal((await backup.openBackup(backup.canonicalJson({ ...outer, formatVersion: 2 }), password, cryptoProvider)).code, 'newer_version');

  let hostileKdfCalled = false;
  const hostileProvider = { ...cryptoProvider, deriveScryptKey: async () => { hostileKdfCalled = true; throw new Error('must not run'); } };
  const hostile = backup.canonicalJson({ ...outer, kdf: { ...outer.kdf, N: 2 ** 30 } });
  assert.equal((await backup.openBackup(hostile, password, hostileProvider)).code, 'resource_limit');
  assert.equal(hostileKdfCalled, false, 'hostile KDF parameters must be rejected before any allocation');
  assert.equal((await backup.openBackup('x'.repeat(backup.MAX_BACKUP_TEXT_BYTES + 1), password, hostileProvider)).code, 'resource_limit');
  assert.equal(hostileKdfCalled, false, 'oversized portable files must be rejected before KDF work');
  assert.equal((await backup.openBackup(sealed, 'x'.repeat(backup.MAX_BACKUP_PASSWORD_CHARACTERS + 1), hostileProvider)).code, 'resource_limit');
  assert.equal(hostileKdfCalled, false, 'oversized password input must be rejected before KDF work');

  const sealedAgain = await backup.sealBackup(archive, password, cryptoProvider);
  assert.notEqual(JSON.parse(sealedAgain).cipher.nonceBase64, outer.cipher.nonceBase64, 'CSPRNG nonce must be fresh per encryption');
  assert.notEqual(sealedAgain, sealed);

  await assert.rejects(
    () => backup.sealBackup({ ...archive, registry: { ...archive.registry, athletes: [...archive.registry.athletes, archive.registry.athletes[1]] }, databases: [...archive.databases, archive.databases[1]] }, password, cryptoProvider),
    (error) => error.code === 'duplicate_identity',
  );
  await assert.rejects(() => backup.sealBackup(archive, 'too-short', cryptoProvider), /at least 12/);

  const compatible = { readerSchemaVersion: 63, supportedSourceSchemaVersions: [63], readerMigrationSlot: 64, supportedSourceMigrationSlots: [64] };
  assert.equal(backup.decideRestore('merge', opened.archive, compatible).code, 'merge_not_supported');
  assert.equal(backup.decideRestore('replace', opened.archive, compatible).recoveryCopyRequired, true);
  assert.equal(backup.decideRestore('replace', opened.archive, { ...compatible, readerSchemaVersion: 62 }).code, 'newer_schema');
  assert.equal(backup.decideRestore('replace', opened.archive, { ...compatible, supportedSourceSchemaVersions: [64] }).code, 'schema_adapter_unavailable');
  assert.equal(backup.decideRestore('replace', { ...opened.archive, sourceMigrationSlot: 65 }, compatible).code, 'newer_schema');

  let state = backup.initialRestoreState();
  state = backup.transitionRestore(state, { type: 'VALIDATE', backupId: archive.backupId });
  assert.equal(backup.transitionRestore(state, { type: 'LOW_STORAGE' }).phase, 'blocked_low_storage');
  state = backup.transitionRestore(state, { type: 'RECOVERY_VERIFIED' });
  state = backup.transitionRestore(state, { type: 'PREPARE' });
  state = backup.transitionRestore(state, { type: 'BEGIN_REPLACE' });
  state = backup.transitionRestore(state, { type: 'FAIL' });
  assert.equal(state.phase, 'rollback_required');
  state = backup.transitionRestore(state, { type: 'ROLLBACK_CONFIRMED' });
  assert.equal(state.phase, 'rolled_back');
  assert.throws(() => backup.transitionRestore(backup.initialRestoreState(), { type: 'BEGIN_REPLACE' }), /invalid restore transition/);

  const journal = {
    version: 1, operationId: '00112233445566778899aabbccddeeff',
    entries: [{
      targetPath: '/db/athlete_kinetics.db',
      stagedPath: '/db/.ak-incoming-00112233445566778899aabbccddeeff-0.db',
      rollbackPath: '/db/.ak-rollback-00112233445566778899aabbccddeeff-0.db',
      existedBefore: true,
    }],
    registryTargetPath: '/doc/coach_athletes.json', registryStagedPath: '/doc/.ak-registry-00112233445566778899aabbccddeeff.new',
    registryRollbackPath: '/doc/.ak-registry-00112233445566778899aabbccddeeff.old', registryExistedBefore: true,
  };
  assert.deepEqual(backup.validateRestoreJournal(journal, { documentDirectory: '/doc', databaseDirectory: '/db' }), journal);
  assert.equal(backup.validateRestoreJournal({ ...journal, entries: [{ ...journal.entries[0], targetPath: '/outside/data.db' }] }, { documentDirectory: '/doc', databaseDirectory: '/db' }), null,
    'hostile journal paths must fail closed outside app-private roots');
  assert.equal(backup.validateRestoreJournal({ ...journal, entries: [{ ...journal.entries[0], targetPath: '/db/unrelated.db' }] }, { documentDirectory: '/doc', databaseDirectory: '/db' }), null,
    'hostile in-root targets must fail closed');
  assert.equal(backup.validateRestoreJournal({ ...journal, entries: [{ ...journal.entries[0], targetPath: '/db/nested/athlete_kinetics.db' }] }, { documentDirectory: '/doc', databaseDirectory: '/db' }), null,
    'a valid basename in a nested database directory must fail closed');
  assert.equal(backup.validateRestoreJournal({ ...journal, registryTargetPath: '/doc/nested/coach_athletes.json' }, { documentDirectory: '/doc', databaseDirectory: '/db' }), null,
    'a valid registry basename in a nested document directory must fail closed');
  assert.equal(backup.validateRestoreJournal({ ...journal, entries: [{ ...journal.entries[0], stagedPath: '/db/.ak-incoming-other-0.db' }] }, { documentDirectory: '/doc', databaseDirectory: '/db' }), null,
    'staging paths must be derived from the journal operation');
  assert.equal(backup.validateRestoreJournal({ ...journal, registryStagedPath: journal.registryTargetPath }, { documentDirectory: '/doc', databaseDirectory: '/db' }), null,
    'registry paths must be disjoint and role-specific');

  assert.equal(backup.interruptedRestoreAction(journal.operationId, journal.operationId, journal.operationId), 'cleanup_committed');
  assert.equal(backup.interruptedRestoreAction(journal.operationId, journal.operationId, null), 'rollback',
    'an interrupted pre-commit replacement must roll back');
  assert.equal(backup.interruptedRestoreAction(journal.operationId, journal.operationId, 'ffffffffffffffffffffffffffffffff'), 'rollback',
    'a stale commit marker must never suppress rollback');
  assert.equal(backup.interruptedRestoreAction(journal.operationId, null, null), 'cleanup_preparation');
  assert.equal(backup.interruptedRestoreAction(journal.operationId, null, 'ffffffffffffffffffffffffffffffff'), 'preserve_invalid');
  const recoveryCalls = [];
  assert.equal(await backup.executeInterruptedRestoreRecovery(
    journal, journal.operationId, 'ffffffffffffffffffffffffffffffff',
    null,
    async () => { recoveryCalls.push('rollback'); }, async () => { recoveryCalls.push('cleanup'); },
  ), true);
  assert.deepEqual(recoveryCalls, ['rollback', 'cleanup']);
  let cleanedAfterRollbackFailure = false;
  await assert.rejects(() => backup.executeInterruptedRestoreRecovery(
    journal, journal.operationId, null, null, async () => { throw new Error('rollback IO failed'); },
    async () => { cleanedAfterRollbackFailure = true; },
  ), /rollback IO failed/);
  assert.equal(cleanedAfterRollbackFailure, false, 'failed rollback must preserve recovery files and journal');
  await assert.rejects(() => backup.executeInterruptedRestoreRecovery(
    journal, null, 'ffffffffffffffffffffffffffffffff', null, async () => {}, async () => {},
  ), /markers are invalid/);
  assert.equal(backup.interruptedRestoreAction(journal.operationId, journal.operationId, null, journal.operationId), 'cleanup_rolled_back');
  let rollbackRetried = false;
  let cleanupRetried = false;
  assert.equal(await backup.executeInterruptedRestoreRecovery(
    journal, journal.operationId, null, journal.operationId,
    async () => { rollbackRetried = true; }, async () => { cleanupRetried = true; },
  ), false);
  assert.equal(rollbackRetried, false, 'matching rollback-complete marker must not consume partially cleaned rollback copies again');
  assert.equal(cleanupRetried, true);
  await assert.rejects(() => backup.executeInterruptedRestoreRecovery(
    journal, journal.operationId, null, journal.operationId,
    async () => { throw new Error('must not rollback'); }, async () => { throw new Error('marker deletion failed'); },
  ), /marker deletion failed/, 'cleanup/marker deletion failure must preserve the rollback-complete phase for the next cold start');

  const files = new Map([
    ['/db/athlete_kinetics.db', 'partially-installed'],
    [journal.entries[0].rollbackPath, 'original-database'],
    ['/doc/coach_athletes.json', 'partially-installed-registry'],
    [journal.registryRollbackPath, 'original-registry'],
  ]);
  const memoryIo = {
    async exists(path) { return files.has(path); },
    async remove(path) { files.delete(path); },
    async copy(source, destination) {
      if (!files.has(source)) throw new Error('missing source');
      files.set(destination, files.get(source));
    },
  };
  await backup.rollbackRestoreFiles(journal, memoryIo);
  assert.equal(files.get('/db/athlete_kinetics.db'), 'original-database');
  assert.equal(files.get('/doc/coach_athletes.json'), 'original-registry');
  await backup.cleanupRestoreFiles(journal, memoryIo);
  assert.equal(files.has(journal.entries[0].rollbackPath), false);
  assert.equal(files.has(journal.registryRollbackPath), false);

  const missingRollbackFiles = new Map([['/db/athlete_kinetics.db', 'incoming']]);
  await assert.rejects(() => backup.rollbackRestoreFiles(journal, {
    async exists(path) { return missingRollbackFiles.has(path); },
    async remove(path) { missingRollbackFiles.delete(path); },
    async copy(source, destination) { missingRollbackFiles.set(destination, missingRollbackFiles.get(source)); },
  }), /rollback copy is missing/, 'missing recovery material must fail closed');
  assert.equal(missingRollbackFiles.get('/db/athlete_kinetics.db'), 'incoming', 'missing rollback copy must leave the current target untouched');
  assert.equal(missingRollbackFiles.has(journal.entries[0].rollbackPath), false, 'rollback helper must never fabricate a recovery copy');

  const falseCopyFiles = new Map([['source', 'original']]);
  await assert.rejects(() => backup.copyFileConfirmed(async () => false, 'source', 'copy'), /not confirmed/,
    'a native false copy result must block replacement preparation');
  assert.equal(falseCopyFiles.has('copy'), false);

  assert.equal(backup.replacementStorageRequirement(1), 32 * 1024 * 1024);
  assert.equal(backup.replacementStorageRequirement(20 * 1024 * 1024), 60 * 1024 * 1024);
  assert.equal(backup.hasRequiredStorage(59 * 1024 * 1024, 60 * 1024 * 1024), false);
  assert.equal(backup.hasRequiredStorage(60 * 1024 * 1024, 60 * 1024 * 1024), true);
  assert.equal(backup.hasRequiredStorage(null, 60 * 1024 * 1024), false, 'unknown storage must fail closed');
  assert.throws(() => backup.replacementStorageRequirement(Number.MAX_SAFE_INTEGER), /overflow/);
  assert.equal(backup.validatePortableBackupFileSize('1024'), 1024);
  assert.equal(backup.validatePortableBackupFileSize(backup.MAX_BACKUP_TEXT_BYTES), backup.MAX_BACKUP_TEXT_BYTES);
  assert.throws(() => backup.validatePortableBackupFileSize(undefined), /could not be verified/);
  assert.throws(() => backup.validatePortableBackupFileSize(backup.MAX_BACKUP_TEXT_BYTES + 1), /too large/);
  assert.equal(backup.validateAggregateDatabaseBytes([backup.MAX_AGGREGATE_DATABASE_BYTES]), backup.MAX_AGGREGATE_DATABASE_BYTES);
  assert.throws(() => backup.validateAggregateDatabaseBytes([backup.MAX_AGGREGATE_DATABASE_BYTES, 1]), /too large/);
  assert.throws(() => backup.validateAggregateDatabaseBytes([undefined]), /could not be verified/);
  const deceptivelySmallLiveStats = [3 * 1024 * 1024, 3 * 1024 * 1024];
  assert.doesNotThrow(() => backup.validateAggregateDatabaseBytes(deceptivelySmallLiveStats));
  const largerVacuumSnapshots = [5 * 1024 * 1024, 4 * 1024 * 1024];
  assert.doesNotThrow(() => backup.validateAggregateDatabaseBytes(largerVacuumSnapshots.slice(0, 1)));
  assert.throws(() => backup.validateAggregateDatabaseBytes(largerVacuumSnapshots), /too large/,
    'running VACUUM output total must be checked even when live-file stat preflight was below the limit');
  const readSnapshots = [];
  await assert.rejects(() => backup.collectBoundedSnapshots(
    ['first', 'second'], async (_source, index) => deceptivelySmallLiveStats[index],
    async (_source, index) => ({ byteLength: largerVacuumSnapshots[index] }),
    async (_pending, index) => { readSnapshots.push(index); return index; },
  ), /too large/);
  assert.deepEqual(readSnapshots, [0], 'second oversized VACUUM snapshot must be rejected before its base64 read');
  let removedSourceRead = false;
  await assert.rejects(() => backup.collectBoundedSnapshots(
    ['present', 'removed'], async () => 1024,
    async (source) => {
      if (source === 'removed') throw new Error('source removed between snapshots');
      return { byteLength: 1024 };
    },
    async () => { removedSourceRead = true; return 'read'; },
  ), /source removed/);
  assert.equal(removedSourceRead, true, 'the first source may be read, while removed later sources fail before creation/read');

  const abandoned = ['ak-backup-00112233445566778899aabbccddeeff', 'ak-backup-not-an-operation', 'user-cache'];
  const removed = [];
  assert.deepEqual(await backup.cleanupAbandonedBackupDirectories(abandoned, async (name) => { removed.push(name); }), [abandoned[0]]);
  assert.deepEqual(removed, [abandoned[0]], 'restart cleanup must only sweep narrowly named private snapshot directories');
  await assert.rejects(() => backup.cleanupAbandonedBackupDirectories([abandoned[0]], async () => {
    throw new Error('cleanup failed');
  }), /cleanup failed/, 'failed abandoned-plaintext cleanup must propagate and keep normal boot gated');

  const inventory = readFileSync(join(import.meta.dirname, '..', '..', '..', '..', 'docs', 'audits', 'accessible-coach', 'WO03_DURABLE_DATA_INVENTORY.md'), 'utf8');
  for (const tableName of tableNames) assert.ok(inventory.includes(`\`${tableName}\``), `inventory must list ${tableName}`);
  assert.match(inventory, /Final live durable tables: 104/);
  console.log('verify:backup PASS — AES-GCM+scrypt all-athlete physical round trip, 104 tables including activity/support, wrong-password/tamper/truncation/KDF cap/nonce/duplicate/compatibility/journal rollback');
} finally {
  rmSync(work, { recursive: true, force: true });
}
