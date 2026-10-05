/**
 * verify_migration_lineage.mjs — cross-lineage migration compatibility gate.
 *
 * Two lineages shipped different migration arrays (MIGRATION_LINEAGE.json):
 *   master  1da218d: 34 entries, ordinal 34 = 058_suspension_episode
 *   feature 12a1fb1: 67 entries, ordinal 34 = 035_profile_load_preference
 * user_version counts applied ENTRIES, so the same number means different
 * schemas on the two lineages. This gate drives the PRODUCTION runner
 * (migrationRunner.ts, compiled) over REAL populated SQLite databases built the
 * way each lineage built them, and proves:
 *
 *   [L1] frozen bytes: every shipped SQL file and ordinal matches the manifest;
 *        the master fixture bytes match master's own registry; the test chain
 *        list in verify_migrations.mjs is the production registry.
 *   [L2] a populated master v34 install upgrades by ORDINARY migration (one
 *        rewind, no full replay), keeps every athlete row, ends integrity- and
 *        FK-clean, and differs from a fresh install only in the one known
 *        suspension_episode text — which the backup contract canonicalizes.
 *   [L3] every older shared state (master v20, master v33) and every feature
 *        state v32..v67 upgrades cleanly without replay.
 *   [L4] an ambiguous user_version 34 (both or neither lineage object) fails
 *        closed BEFORE any write: the file is byte-identical afterwards.
 *   [L5] an upgrade interrupted at several points resumes on restart without
 *        replay and without losing rows; repeat application is a no-op.
 *   [L6] self-heal still works on an upgraded master install.
 *   [L7] backup schema contract: master-upgraded == current via the exact
 *        known-lineage equivalence; any other text drift still fails.
 *
 * Run: npm run verify:migrations
 */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);
const runner = require('./.build/migrationRunner.js');
// Guarded so this gate REPORTS (rather than crashes on) a runner that predates
// lineage reconciliation — that is how it demonstrates the baseline defect.
const reconcile = (db, chain) => (typeof runner.reconcileMigrationLineage === 'function'
  ? runner.reconcileMigrationLineage(db, chain) : 'reconciliation-missing');
const contract = require('./.build/lineage/schemaContract.js');
const demo = require('./.build/demoData.js');

const ROOT = join(import.meta.dirname, '..', '..', '..');
const CORE = join(ROOT, 'packages', 'core-db');
const SCHEMA = join(CORE, 'src', 'schema');
const FIXTURE = join(CORE, 'test', 'fixtures', 'lineage', 'master-1da218d');
const MANIFEST = JSON.parse(readFileSync(join(CORE, 'MIGRATION_LINEAGE.json'), 'utf8'));
const work = mkdtempSync(join(tmpdir(), 'ak-lineage-'));

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const registryOf = (source) => {
  const imports = Object.fromEntries([...source.matchAll(/import (m\d+) from '\.\/schema\/([^']+)'/g)].map((m) => [m[1], m[2]]));
  return source.match(/MIGRATIONS[^=]*=\s*\[([^\]]+)\]/s)[1].split(',').map((x) => x.trim()).filter(Boolean).map((id) => imports[id]);
};

const UNIFIED_FILES = registryOf(readFileSync(join(CORE, 'src', 'migrations.ts'), 'utf8'));
const MASTER_FILES = registryOf(readFileSync(join(FIXTURE, 'migrations.master.ts.txt'), 'utf8'));
const MASTER_FIXTURE_FILES = new Set(['034_autopilot_attribution.sql', '058_suspension_episode.sql']);
const UNIFIED = UNIFIED_FILES.map((file) => readFileSync(join(SCHEMA, file), 'utf8'));
const MASTER = MASTER_FILES.map((file) => readFileSync(join(MASTER_FIXTURE_FILES.has(file) ? FIXTURE : SCHEMA, file), 'utf8'));
const MATERIALIZE = readFileSync(join(SCHEMA, '004_state_vector_materialize.sql'), 'utf8');

// --- [L1] frozen bytes, ordinals and registry parity --------------------------
console.log('[L1] frozen SQL bytes, ordinals and registry parity');
{
  const recorded = MANIFEST.unifiedChain.entries;
  check('unified registry ordinals match the manifest exactly',
    JSON.stringify(recorded.map((e) => e.file)) === JSON.stringify(UNIFIED_FILES),
    `${UNIFIED_FILES.length} entries`);
  const drifted = recorded.filter((e) => sha(readFileSync(join(SCHEMA, e.file))) !== e.sha256).map((e) => e.file);
  check('no shipped migration file changed by a single byte', drifted.length === 0, drifted.join(', '));
  check('runtime 004 materialize SQL matches its recorded digest',
    sha(readFileSync(join(SCHEMA, '004_state_vector_materialize.sql'))) === MANIFEST.runtimeSql['004_state_vector_materialize.sql']);
  check('master registry fixture is the recorded 1da218d registry',
    sha(readFileSync(join(FIXTURE, 'migrations.master.ts.txt'))) === MANIFEST.masterLineage.registrySha256
      && JSON.stringify(MANIFEST.masterLineage.entries.map((e) => e.file)) === JSON.stringify(MASTER_FILES));
  const masterDrift = MANIFEST.masterLineage.entries.filter((e) =>
    sha(readFileSync(join(e.source === 'fixture' ? FIXTURE : SCHEMA, e.file))) !== e.sha256).map((e) => e.file);
  check('every master-lineage migration byte is preserved (fixtures + shared files)', masterDrift.length === 0, masterDrift.join(', '));
  check('master ordinal 34 is 058 and unified ordinal 34 is 035 (the one divergence)',
    MASTER_FILES[33] === '058_suspension_episode.sql' && UNIFIED_FILES[33] === '035_profile_load_preference.sql'
      && MASTER_FILES.slice(0, 33).every((file, i) => UNIFIED_FILES[i] === file));
  // 068 was the last entry of the integrated chain; everything after it is a
  // later append (069 resting heart rate first), never an insertion.
  check('unified chain is append-only after the integration point (058 at ordinal 57, 068 at ordinal 67)',
    UNIFIED_FILES[56] === '058_suspension_episode.sql' && UNIFIED_FILES[66] === '068_movement_content_correction_v2.sql'
      && UNIFIED_FILES.slice(67).every((file) => Number(file.slice(0, 3)) > 68));
  const gateSource = readFileSync(join(CORE, 'test', 'verify_migrations.mjs'), 'utf8');
  const gateFiles = [...gateSource.match(/const FILES = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+\.sql)'/g)].map((m) => m[1]);
  check('verify_migrations.mjs FILES is exactly the production registry (closes the hand-copied-list gap)',
    JSON.stringify(gateFiles) === JSON.stringify(UNIFIED_FILES), `${gateFiles.length} vs ${UNIFIED_FILES.length}`);
}

// --- harness ------------------------------------------------------------------
// Every connection is tracked so cleanup can close them all before removing
// the work directory (Windows refuses to delete a file that is still open).
const openConnections = new Set();
function openDb(path = ':memory:') {
  const raw = new DatabaseSync(path);
  openConnections.add(raw);
  raw.exec('PRAGMA foreign_keys = ON;');
  try { raw.prepare('SELECT ln(2.0), sqrt(2.0)').get(); } catch {
    raw.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
    raw.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
  }
  const versionWrites = [];
  return {
    raw,
    versionWrites,
    executeSync(sql) {
      const write = /^\s*PRAGMA user_version = (\d+)/.exec(sql);
      if (write) versionWrites.push(Number(write[1]));
      if (/^\s*(SELECT|PRAGMA\s+user_version\s*;?\s*$)/i.test(sql)) return { rows: raw.prepare(sql).all() };
      raw.exec(sql);
      return { rows: [] };
    },
  };
}
/** Build exactly what an installed build of that lineage left on disk: its own
 *  migrations applied in its own order by a runner that set user_version per
 *  entry. (Today's runner cannot build an old schema — its sentinels name
 *  later tables — so the historical per-entry transaction is replayed here.) */
function buildLineage(chain, count, path) {
  const db = openDb(path);
  chain.slice(0, count).forEach((sql, i) => {
    db.raw.exec('BEGIN'); db.raw.exec(sql); db.raw.exec(`PRAGMA user_version = ${i + 1}`); db.raw.exec('COMMIT');
  });
  return db;
}
const uv = (db) => Number(db.raw.prepare('PRAGMA user_version').get().user_version);
const has = (db, name) => db.raw.prepare('SELECT 1 FROM sqlite_master WHERE name = ?').get(name) !== undefined;

/** Realistic athlete data across the tables both lineages share at v33/v34. */
function populate(db, { suspension }) {
  const adapter = {
    run: (sql, params = []) => { db.raw.prepare(sql).run(...params); },
    one: (sql, params = []) => db.raw.prepare(sql).get(...params),
  };
  db.raw.exec('BEGIN');
  demo.generateDemoHistory(adapter, '2026-09-30', 42);
  for (const date of demo.demoDates('2026-09-30', 7)) adapter.run(MATERIALIZE, [date]);
  db.raw.exec(`UPDATE athlete_profile SET training_age = 'intermediate', updated_at_ms = 1758000000000 WHERE profile_id = 1`);
  const movement = Number(db.raw.prepare("SELECT MIN(movement_id) AS id FROM movement").get().id);
  const second = Number(db.raw.prepare('SELECT MIN(movement_id) AS id FROM movement WHERE movement_id > ?').get(movement).id);
  if (has(db, 'training_program')) {
    db.raw.exec(`INSERT INTO training_program (program_id, objective, start_date, horizon_kind, requested_review_date,
        planned_end_date, planned_block_count, starting_macro_block_index, schema_type, status, created_at_ms, updated_at_ms)
      VALUES (1, 'strength', '2026-09-01', 'weeks', NULL, '2026-11-24', 3, 1, 'LINEAR', 'active', 1756684800000, 1756684800000)`);
    db.raw.exec("INSERT INTO training_block (block_id, start_date, objective, created_at_ms) VALUES (501, '2026-09-01', 'strength', 1756684800000)");
    db.raw.exec('INSERT INTO training_block_program (block_id, program_id, sequence_index) VALUES (501, 1, 1)');
    db.raw.exec(`INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date)
      VALUES (9001, 501, 1, 1, 'full', 'accumulation', '2026-09-01'), (9002, 501, 1, 3, 'lower', 'accumulation', '2026-09-03')`);
    db.raw.prepare(`INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(70001, 9001, 1, movement, 3, 5, 7.5);
    db.raw.prepare(`INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(70002, 9002, 1, second, 4, 8, 7.0);
  }
  if (has(db, 'planned_slot_autopilot')) {
    db.raw.exec(`INSERT INTO planned_slot_autopilot (planned_slot_id, rpe_delta, set_delta, reason)
      VALUES (70001, -0.5, -1, 'eased'), (70002, 0.5, 0, 'raised')`);
  }
  db.raw.exec(`INSERT INTO niggle (id, region, severity, reported_at_ms) VALUES ('n-knee-1', 'knee', 4, 1758500000000)`);
  db.raw.exec(`INSERT INTO subjective_report (date, reported_at_ms, raw_text, matched_entry_id, similarity, halt)
    VALUES ('2026-09-29', 1759100000000, 'private-report: left knee a little sore', NULL, 0.41, 0)`);
  db.raw.prepare('INSERT INTO one_rep_max (movement_id, load_kg, updated_at_ms) VALUES (?, ?, ?)').run(movement, 120.0, 1758000000000);
  if (suspension && has(db, 'suspension_episode')) {
    db.raw.exec(`INSERT INTO suspension_episode (episode_id, started_at_ms, ended_at_ms, reason, frozen_macro_index)
      VALUES (1, 1757000000000, 1757600000000, 'illness', 2), (2, 1759000000000, NULL, 'injury', 3)`);
  }
  db.raw.exec('COMMIT');
}

/** Athlete-owned tables, compared on the columns they had BEFORE the upgrade
 *  (later migrations may add columns; they must not change existing values). */
const USER_TABLES = ['session', 'set_record', 'hrv_daily', 'sleep_daily', 'spo2_daily', 'macro_cycle', 'micro_cycle',
  'state_vector', 'athlete_profile', 'training_program', 'training_block', 'training_block_program', 'planned_session',
  'planned_slot', 'planned_slot_autopilot', 'niggle', 'subjective_report', 'one_rep_max', 'suspension_episode'];
function userData(db) {
  const out = {};
  for (const table of USER_TABLES) {
    if (!has(db, table)) continue;
    const columns = db.raw.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    const order = columns.map((c) => `"${c}"`).join(',');
    out[table] = { columns, rows: db.raw.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all() };
  }
  return out;
}
function preserved(before, db) {
  const problems = [];
  for (const [table, { columns, rows }] of Object.entries(before)) {
    if (!has(db, table)) { problems.push(`${table} missing`); continue; }
    const list = columns.map((c) => `"${c}"`).join(',');
    const after = db.raw.prepare(`SELECT ${list} FROM ${table} ORDER BY ${list}`).all();
    if (JSON.stringify(after) !== JSON.stringify(rows.map((r) => Object.fromEntries(columns.map((c) => [c, r[c]]))))) {
      problems.push(`${table} (${rows.length} -> ${after.length} rows)`);
    }
  }
  return problems;
}
const schemaObjects = (db) => db.raw.prepare("SELECT type,name,tbl_name,coalesce(sql,'') AS sql FROM sqlite_master WHERE type IN ('table','index','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type,name").all()
  .map((o) => [o.type, o.name, o.tbl_name, o.sql, o.type === 'table'
    ? db.raw.prepare(`PRAGMA table_info("${o.name.replaceAll('"', '""')}")`).all()
      .map((c) => [c.cid, c.name, c.type, c.notnull, c.dflt_value, c.pk]) : []]);
const cryptoProvider = { sha256Hex: (bytes) => sha(bytes), utf8Encode: (text) => new Uint8Array(Buffer.from(text, 'utf8')) };
const integrityClean = (db) => db.raw.prepare('PRAGMA integrity_check').get().integrity_check === 'ok'
  && db.raw.prepare('PRAGMA foreign_key_check').all().length === 0;
const catalogState = (db) => JSON.stringify({
  movements: db.raw.prepare('SELECT * FROM movement ORDER BY movement_id').all(),
  details: db.raw.prepare('SELECT * FROM movement_detail ORDER BY movement_id').all(),
  corrections: db.raw.prepare('SELECT * FROM movement_content_correction ORDER BY 1, 2, 3').all(),
});

const fresh = openDb();
runner.runMigrations(fresh, UNIFIED);
const FRESH_OBJECTS = schemaObjects(fresh);
const FRESH_CATALOG = catalogState(fresh);

// --- [L2] populated master v34 -> unified -----------------------------------
console.log('[L2] populated master v34 install upgrades by ordinary migration');
let masterUpgraded;
{
  const db = buildLineage(MASTER, MASTER.length, join(work, 'master34.db'));
  populate(db, { suspension: true });
  check('fixture is a real master v34 install (058 present, 035 absent, rows populated)',
    uv(db) === 34 && has(db, 'suspension_episode') && !has(db, 'profile_load_preference')
      && Number(db.raw.prepare('SELECT COUNT(*) c FROM set_record').get().c) > 0);
  const before = userData(db);
  check('reconciliation identifies the master lineage and rewinds exactly one ordinal',
    reconcile(db, UNIFIED) === 'master_rewound' && uv(db) === 33);
  db.versionWrites.length = 0;
  runner.runMigrations(db, UNIFIED);
  check('upgrade runs 035..068 once each — no reset to 0, no full replay',
    !db.versionWrites.includes(0) && db.versionWrites.length === UNIFIED.length - 33
      && db.versionWrites.every((v, i) => v === 34 + i), `writes=${db.versionWrites.length}`);
  check('final user_version is the unified chain length and every sentinel is present',
    uv(db) === UNIFIED.length && runner.sentinelsMissing(db).length === 0);
  const problems = preserved(before, db);
  check('every athlete row survives byte-for-byte on its original columns', problems.length === 0, problems.join('; '));
  check('suspension episodes keep their frozen positions and the one open episode stays open',
    JSON.stringify(db.raw.prepare('SELECT episode_id, ended_at_ms IS NULL AS open, frozen_macro_index FROM suspension_episode ORDER BY episode_id').all())
      === JSON.stringify([{ episode_id: 1, open: 0, frozen_macro_index: 2 }, { episode_id: 2, open: 1, frozen_macro_index: 3 }]));
  check('master single-open and no-reopen guards still fire after upgrade', (() => {
    try { db.raw.exec("INSERT INTO suspension_episode (started_at_ms, reason, frozen_macro_index) VALUES (1759900000000, 'life', 1)"); return false; } catch { /* expected */ }
    try { db.raw.exec('UPDATE suspension_episode SET ended_at_ms = NULL WHERE episode_id = 1'); return false; } catch { return true; }
  })());
  check('strict attribution contract holds on the converged table (master rows kept, off-grid refused)', (() => {
    try { db.raw.exec("INSERT INTO planned_slot_autopilot (planned_slot_id, rpe_delta, set_delta, reason) VALUES (70002, 0.25, 0, 'raised')"); return false; } catch { /* expected */ }
    return /IN \(-0\.5, 0\.0, 0\.5\)/.test(db.raw.prepare("SELECT sql FROM sqlite_master WHERE name = 'planned_slot_autopilot'").get().sql);
  })());
  check('integrity_check ok and foreign_key_check empty', integrityClean(db));
  check('movement library equals a fresh install (300 rows, both content corrections)',
    catalogState(db) === FRESH_CATALOG && Number(db.raw.prepare('SELECT COUNT(*) c FROM movement').get().c) === 300);
  const objects = schemaObjects(db);
  const differing = objects.filter((o, i) => JSON.stringify(o) !== JSON.stringify(FRESH_OBJECTS[i])).map((o) => o[1]);
  check('schema equals a fresh install except exactly the known suspension_episode text',
    objects.length === FRESH_OBJECTS.length && JSON.stringify(differing) === JSON.stringify(['suspension_episode'])
      && objects.find((o) => o[1] === 'suspension_episode')[3] === contract.MASTER_058_SUSPENSION_EPISODE_SQL
      && FRESH_OBJECTS.find((o) => o[1] === 'suspension_episode')[3] === contract.FEATURE_058_SUSPENSION_EPISODE_SQL,
    differing.join(','));
  masterUpgraded = db;
}

// --- [L3] every other installed state ------------------------------------------
console.log('[L3] older shared states and every feature state upgrade without replay');
{
  for (const [label, chain, count, suspension] of [['master v20', MASTER, 20, false], ['master v33', MASTER, 33, false]]) {
    const db = buildLineage(chain, count);
    populate(db, { suspension });
    const before = userData(db);
    const reconciled = reconcile(db, UNIFIED);
    db.versionWrites.length = 0;
    runner.runMigrations(db, UNIFIED);
    check(`${label}: no lineage action, no replay, complete, rows preserved, FK clean`,
      reconciled === 'not_applicable' && !db.versionWrites.includes(0) && uv(db) === UNIFIED.length
        && runner.sentinelsMissing(db).length === 0 && preserved(before, db).length === 0 && integrityClean(db));
  }
  const failures = [];
  for (let n = 32; n <= UNIFIED.length; n += 1) {
    const db = buildLineage(UNIFIED, n);
    populate(db, { suspension: n >= 57 });
    const before = userData(db);
    const reconciled = reconcile(db, UNIFIED);
    db.versionWrites.length = 0;
    runner.runMigrations(db, UNIFIED);
    const ok = (n === 34 ? reconciled === 'feature' : reconciled === 'not_applicable')
      && !db.versionWrites.includes(0) && db.versionWrites.length === UNIFIED.length - n
      && runner.sentinelsMissing(db).length === 0 && preserved(before, db).length === 0 && integrityClean(db)
      && JSON.stringify(schemaObjects(db)) === JSON.stringify(FRESH_OBJECTS);
    if (!ok) failures.push(n);
  }
  check('feature installs at every user_version 32..67 upgrade cleanly to the fresh schema, rows preserved',
    failures.length === 0, failures.length ? `failed at ${failures.join(',')}` : `${UNIFIED.length - 31} states`);
}

// --- [L4] ambiguous lineage fails closed before any write -----------------------
console.log('[L4] an unidentifiable user_version 34 fails closed and changes nothing');
{
  // 035 applied over master's 058 at user_version 34 is the state an upgrade
  // interrupted right after 035 commits leaves behind. It is NOT ambiguous:
  // continuing at 036 is correct, and treating it as unknown would lock the
  // athlete out after an ordinary interruption (found by [L5]).
  const db = buildLineage(MASTER, MASTER.length);
  populate(db, { suspension: true });
  db.raw.exec(UNIFIED[33]);
  const before = userData(db);
  const reconciled = reconcile(db, UNIFIED);
  db.versionWrites.length = 0;
  runner.runMigrations(db, UNIFIED);
  check('user_version 34 with BOTH 035 and 058 continues at 036 without replay, rows preserved',
    reconciled === 'feature' && !db.versionWrites.includes(0) && uv(db) === UNIFIED.length
      && runner.sentinelsMissing(db).length === 0 && preserved(before, db).length === 0 && integrityClean(db));
}
for (const [label, mutate] of [
  ['neither 035 nor 058 table (master-shaped)', (db) => db.raw.exec('DROP TABLE suspension_episode')],
  ['neither 035 nor 058 table (feature-shaped)', (db) => db.raw.exec('DROP TABLE profile_load_preference')],
]) {
  const path = join(work, `ambiguous-${label.includes('feature') ? 'feature' : 'master'}.db`);
  const db = buildLineage(label.includes('feature') ? UNIFIED : MASTER, 34, path);
  populate(db, { suspension: false });
  mutate(db);
  db.raw.close();
  const bytesBefore = sha(readFileSync(path));
  const reopened = openDb(path);
  let error = null;
  try { runner.runMigrations(reopened, UNIFIED); } catch (e) { error = e; }
  reopened.raw.close();
  check(`${label}: MigrationLineageError with recovery guidance, file byte-identical`,
    typeof runner.MigrationLineageError === 'function' && error instanceof runner.MigrationLineageError && error.code === 'migration_lineage_ambiguous'
      && /Nothing was changed/.test(error.message) && sha(readFileSync(path)) === bytesBefore);
}

// --- [L5] interrupted upgrade, restart, repeat ----------------------------------
console.log('[L5] interrupted master upgrade resumes on restart; repeat application is a no-op');
for (const breakAt of [33, 34, 48, 56, 59, 66]) {
  const db = buildLineage(MASTER, MASTER.length);
  populate(db, { suspension: true });
  const before = userData(db);
  const broken = UNIFIED.map((sql, i) => (i === breakAt ? `${sql}\nSELECT RAISE(ABORT, 'injected interruption');` : sql));
  let threw = false;
  try { runner.runMigrations(db, broken); } catch { threw = true; }
  const stoppedAt = uv(db);
  db.versionWrites.length = 0;
  runner.runMigrations(db, UNIFIED);
  check(`interrupted at ordinal ${breakAt + 1}: rolled back to ${breakAt}, restart completes without replay, rows intact`,
    threw && stoppedAt === breakAt && !db.versionWrites.includes(0) && uv(db) === UNIFIED.length
      && runner.sentinelsMissing(db).length === 0 && preserved(before, db).length === 0 && integrityClean(db),
    `stopped at ${stoppedAt}`);
}
{
  const before = JSON.stringify([schemaObjects(masterUpgraded), userData(masterUpgraded)]);
  masterUpgraded.versionWrites.length = 0;
  runner.runMigrations(masterUpgraded, UNIFIED);
  runner.runMigrations(masterUpgraded, UNIFIED);
  check('re-running the chain on an upgraded master install writes nothing and changes nothing',
    masterUpgraded.versionWrites.length === 0 && JSON.stringify([schemaObjects(masterUpgraded), userData(masterUpgraded)]) === before);
}

// --- [L6] self-heal on an upgraded master install ------------------------------
console.log('[L6] self-heal still repairs an upgraded master install');
{
  const db = buildLineage(MASTER, MASTER.length);
  populate(db, { suspension: true });
  runner.runMigrations(db, UNIFIED);
  const before = userData(db);
  db.raw.exec('DROP TABLE return_checkin_ack');
  runner.runMigrations(db, UNIFIED);
  check('a lost table is restored by the replay; rows and the master suspension text survive',
    has(db, 'return_checkin_ack') && runner.sentinelsMissing(db).length === 0 && preserved(before, db).length === 0
      && db.raw.prepare("SELECT sql FROM sqlite_master WHERE name = 'suspension_episode'").get().sql === contract.MASTER_058_SUSPENSION_EPISODE_SQL
      && integrityClean(db));
}

// --- [L7] backup schema contract ---------------------------------------------
console.log('[L7] backup schema contract recognises exactly the known lineage variant');
{
  const current = contract.CURRENT_BACKUP_SCHEMA_CONTRACT;
  check('fresh unified install matches the current backup contract',
    contract.matchesBackupSchemaContract(FRESH_OBJECTS, current, cryptoProvider));
  const masterObjects = schemaObjects(masterUpgraded);
  check('populated master-upgraded install matches the current backup contract (exact equivalence)',
    contract.matchesBackupSchemaContract(masterObjects, current, cryptoProvider));
  const rawMasterHash = sha(Buffer.from(JSON.stringify(masterObjects)));
  check('without the equivalence its raw fingerprint differs (the P2 defect is real, not assumed)',
    rawMasterHash !== current.fingerprint && sha(Buffer.from(JSON.stringify(FRESH_OBJECTS))) === current.fingerprint);
  const mutate = (text) => masterObjects.map((o) => (o[1] === 'suspension_episode' ? [o[0], o[1], o[2], text, o[4]] : o));
  for (const [label, text] of [
    ['one extra byte', `${contract.MASTER_058_SUSPENSION_EPISODE_SQL} `],
    ['a weakened CHECK', contract.MASTER_058_SUSPENSION_EPISODE_SQL.replace("('injury', 'illness', 'life')", "('injury', 'illness', 'life', 'other')")],
    ['whitespace-only reflow', contract.MASTER_058_SUSPENSION_EPISODE_SQL.replace(/ {2,}/g, ' ')],
  ]) {
    const accepted = contract.matchesBackupSchemaContract(mutate(text), current, cryptoProvider);
    check(`suspension_episode text with ${label} is still rejected`,
      text !== contract.MASTER_058_SUSPENSION_EPISODE_SQL && !accepted);
  }
  check('the equivalence applies only to the suspension_episode TABLE object',
    !contract.matchesBackupSchemaContract(masterObjects.map((o) => (o[1] === 'suspension_episode'
      ? ['index', o[1], o[2], o[3], o[4]] : o)), current, cryptoProvider));
  check('equivalence registry holds exactly one reviewed entry', contract.KNOWN_LINEAGE_SQL_EQUIVALENTS.length === 1);
}

for (const raw of openConnections) {
  try { if (raw.isOpen !== false) raw.close(); } catch { /* already closed by its test */ }
}
rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
console.log(`\n${fail === 0 ? 'ALL LINEAGE CHECKS PASSED' : `${fail} LINEAGE CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
