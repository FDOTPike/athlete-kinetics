/**
 * verify_migrations.mjs â€” runs the PRODUCTION migration runner
 * (migrationRunner.ts, compiled) against real SQLite in the three scenarios
 * that exist in the field:
 *   1. fresh install: all migrations apply synchronously, user_version
 *      correct, every sentinel object present, runner is idempotent on
 *      re-boot;
 *   2. poisoned DB (the 2026-06-11 device state): user_version=4 but
 *      migration 003's objects missing -> self-heal re-applies everything;
 *   3. failing migration: first failure rolls back, throws, user_version
 *      still points at the failed migration; fixing the migration and
 *      re-running completes the chain (the device "ln" scenario).
 *
 * Run:  npm run verify:migrations
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);
const { runMigrations, sentinelsMissing, SENTINELS } = require('./.build/migrationRunner.js');

const SCHEMA_DIR = join(import.meta.dirname, '..', 'src', 'schema');
const FILES = ['001_mechanical_input.sql', '002_telemetry.sql', '003_state_vector.sql',
  '005_subjective_report.sql', '006_user_profile.sql', '007_program_engine.sql',
  '008_taxonomy.sql', '009_periodization.sql', '010_movement_library.sql',
  '011_niggle_tracking.sql', '012_report_severity.sql', '013_profile_slot.sql',
  '014_movement_prefixes.sql', '015_set_prefix.sql', '016_movement_library_seed.sql', '017_movement_batch.sql',
  '018_logging_modes.sql', '019_movement_batch.sql', '020_movement_batch.sql',
  '021_taxonomy_corrections.sql',
  '022_set_target.sql',
  '023_phase17_session_foundation.sql'];
const MIGRATIONS = FILES.map((f) => readFileSync(join(SCHEMA_DIR, f), 'utf-8'));

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

// op-sqlite-shaped sync adapter; registers the math shims the device build
// now gets via SQLITE_ENABLE_MATH_FUNCTIONS.
function freshDb() {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON;');
  try { raw.prepare('SELECT ln(2.0), sqrt(2.0)').get(); } catch {
    raw.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
    raw.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
  }
  return {
    raw,
    executeSync(sql) {
      const isRead = /^\s*(SELECT|PRAGMA\s+user_version\s*;?\s*$)/i.test(sql);
      if (isRead) return { rows: raw.prepare(sql).all() };
      raw.exec(sql);
      return { rows: [] };
    },
  };
}
const uv = (db) => Number(db.raw.prepare('PRAGMA user_version').get().user_version);

// --- 1. fresh install ---------------------------------------------------------
console.log('[1] fresh install');
const a = freshDb();
runMigrations(a, MIGRATIONS);
check(`user_version = ${MIGRATIONS.length}`, uv(a) === MIGRATIONS.length, String(uv(a)));
check('all sentinels present', sentinelsMissing(a).length === 0,
  `${SENTINELS.length} checked`);
runMigrations(a, MIGRATIONS); // second boot
check('re-boot is a no-op (idempotent)', uv(a) === MIGRATIONS.length);
const taxonomyCorrections = Object.fromEntries(a.raw.prepare(`
  SELECT m.name, t.category FROM movement_taxonomy t JOIN movement m USING(movement_id)
  WHERE m.name IN ('Cable Rope Overhead Triceps Extension', 'Triceps Pushdown')
`).all().map((r) => [r.name, r.category]));
check('021 applies both ratified taxonomy corrections',
  Object.keys(taxonomyCorrections).length === 2 && Object.values(taxonomyCorrections).every((c) => c === 'accessory'),
  JSON.stringify(taxonomyCorrections));

// --- 2. poisoned field DB (user_version lies) ----------------------------------
console.log('[2] poisoned DB: user_version=4 but 003 never applied');
const b = freshDb();
b.executeSync(MIGRATIONS[0]);
b.executeSync(MIGRATIONS[1]);
b.executeSync(MIGRATIONS[3]); // skip 003, like the async-race field state
b.executeSync(`PRAGMA user_version = ${MIGRATIONS.length};`);
check('precondition: state_vector missing', sentinelsMissing(b).includes('state_vector'));
runMigrations(b, MIGRATIONS);
check('self-heal restored every sentinel', sentinelsMissing(b).length === 0);
check('materialize prepares against healed schema', (() => {
  const sql = readFileSync(join(SCHEMA_DIR, '004_state_vector_materialize.sql'), 'utf-8')
    .replace(/^--.*$/gm, '');
  try { b.raw.prepare(sql); return true; } catch { return false; }
})());

// --- 2b. poisoned v15: 016 tables missing while user_version claims complete ---
console.log('[2b] poisoned DB: user_version=15 but 016 never applied (audit A1)');
const b2 = freshDb();
const skip016 = FILES.indexOf('016_movement_library_seed.sql'); // stable vs appended migrations
  for (let i = 0; i < skip016; i += 1) b2.executeSync(MIGRATIONS[i]); // 016..end not yet applied
b2.executeSync(`PRAGMA user_version = ${MIGRATIONS.length};`);
check('precondition: movement_progression missing', sentinelsMissing(b2).includes('movement_progression'));
runMigrations(b2, MIGRATIONS);
check('self-heal applied 016 (progression + whitelist sentinels present)', sentinelsMissing(b2).length === 0);
check('016+017+019+020 seeds arrived: 124 movements', Number(b2.raw.prepare('SELECT COUNT(*) c FROM movement').get().c) === 124);

// --- 2c. partial-018 damage: set_metric survives, siblings dropped (audit B4) --
console.log('[2c] partial 018 damage: movement_logging_mode dropped post-apply');
const b3 = freshDb();
runMigrations(b3, MIGRATIONS);
b3.executeSync('DROP TABLE movement_logging_mode');
check('precondition: movement_logging_mode missing, set_metric present',
  sentinelsMissing(b3).includes('movement_logging_mode') && !sentinelsMissing(b3).includes('set_metric'));
runMigrations(b3, MIGRATIONS);
check('self-heal restored the dropped 018 sibling', sentinelsMissing(b3).length === 0);
check('time-mode seeds healed back (5 rows)',
  Number(b3.raw.prepare('SELECT COUNT(*) c FROM movement_logging_mode').get().c) === 5);

// --- 2d. set_target + 022 tables dropped post-apply (Fix-1 provenance side-car, 022) -------
console.log('[2d] 022 tables dropped post-apply (provenance self-heal)');
const b4 = freshDb();
runMigrations(b4, MIGRATIONS);
b4.executeSync('DROP TABLE set_target');
b4.executeSync('DROP TABLE session_origin');
b4.executeSync('DROP TABLE session_plan_slot');
b4.executeSync('DROP TABLE planned_slot_disposition');
check('precondition: set_target missing', sentinelsMissing(b4).includes('set_target'));
check('precondition: session_origin missing', sentinelsMissing(b4).includes('session_origin'));
check('precondition: session_plan_slot missing', sentinelsMissing(b4).includes('session_plan_slot'));
check('precondition: planned_slot_disposition missing', sentinelsMissing(b4).includes('planned_slot_disposition'));
runMigrations(b4, MIGRATIONS);
check('self-heal restored all 022 tables', sentinelsMissing(b4).length === 0);

// --- 2e. 022 re-application against current schema is a no-op (P1 #2 regression) ---------
console.log('[2e] 022 reapplication against current schema preserves session_plan_slot_id');
const b5 = freshDb();
runMigrations(b5, MIGRATIONS);
// Seed a row that exercises all 022 columns
b5.executeSync(`INSERT INTO session (session_id, session_date, started_at_ms) VALUES (1, '2026-01-01', 0)`);
b5.executeSync(`INSERT INTO movement (movement_id, name, pattern, is_compound) VALUES (999, 'Test', 'push_h', 0)`);
b5.executeSync(`INSERT INTO session_plan_slot (session_plan_slot_id, session_id, slot_index, movement_id, planned_sets, provenance_kind, target_rpe, source_planned_slot_id) VALUES (7, 1, 0, 999, 3, 'planned', 7.5, 42)`);
b5.executeSync(`INSERT INTO set_record (set_id, session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (5, 1, 999, 1, 5, 100.0, 7.5, 1000000)`);
b5.executeSync(`INSERT INTO set_target (set_id, session_plan_slot_id, provenance_kind, target_rpe, source_planned_slot_id, created_at_ms) VALUES (5, 7, 'planned', 7.5, 42, 1000000)`);
// Regress user_version so migration 022 re-runs
b5.executeSync(`PRAGMA user_version = ${MIGRATIONS.length - 1};`);
runMigrations(b5, MIGRATIONS);
const b5row = b5.raw.prepare('SELECT session_plan_slot_id, target_rpe, source_planned_slot_id FROM set_target WHERE set_id = 5').get();
check('022 re-apply is a true no-op: session_plan_slot_id preserved', b5row?.session_plan_slot_id === 7, String(b5row?.session_plan_slot_id));
check('022 re-apply: target_rpe preserved', b5row?.target_rpe === 7.5, String(b5row?.target_rpe));
check('022 re-apply: source_planned_slot_id preserved', b5row?.source_planned_slot_id === 42, String(b5row?.source_planned_slot_id));

// --- 2f. Phase 17 side-cars dropped post-apply (foundation self-heal) -------
console.log('[2f] 023 tables dropped post-apply (Phase 17 foundation self-heal)');
const b6 = freshDb();
runMigrations(b6, MIGRATIONS);
for (const table of [
  'movement_coaching_intent',
  'movement_time_policy',
  'planned_slot_target',
  'session_slot_target',
  'profile_ui_preference',
  'session_runner_checkpoint',
]) b6.executeSync(`DROP TABLE ${table}`);
check('precondition: every 023 sentinel is missing', [
  'movement_coaching_intent',
  'movement_time_policy',
  'planned_slot_target',
  'session_slot_target',
  'profile_ui_preference',
  'session_runner_checkpoint',
].every((name) => sentinelsMissing(b6).includes(name)));
runMigrations(b6, MIGRATIONS);
check('self-heal restored every 023 sentinel', sentinelsMissing(b6).length === 0);
const timePolicy = Object.fromEntries(b6.raw.prepare(`
  SELECT m.name, printf('%d/%d', p.default_sets, p.target_seconds) AS dose
  FROM movement_time_policy p JOIN movement m USING(movement_id)
`).all().map((row) => [row.name, row.dose]));
const expectedTimePolicy = {
  'BJJ Sparring Round': '5/300',
  'Farmer Carry': '3/40',
  'Plank': '3/30',
  'Road Run': '1/1200',
  'Suitcase Carry': '3/40',
};
check('023 restores ratified time-policy defaults',
  Object.keys(timePolicy).length === Object.keys(expectedTimePolicy).length
    && Object.entries(expectedTimePolicy).every(([name, dose]) => timePolicy[name] === dose),
  JSON.stringify(timePolicy));
const prefDefaults = b6.raw.prepare(`
  SELECT profile_slot_id, session_mode_override, readiness_detail, rest_timer_enabled, text_scale
  FROM profile_ui_preference ORDER BY profile_slot_id
`).all();
check('023 restores one UI-preference row per profile slot with tier defaults',
  JSON.stringify(prefDefaults) === JSON.stringify([
    { profile_slot_id: 1, session_mode_override: null, readiness_detail: 'summary', rest_timer_enabled: 1, text_scale: 'system' },
    { profile_slot_id: 2, session_mode_override: null, readiness_detail: 'full', rest_timer_enabled: 1, text_scale: 'system' },
    { profile_slot_id: 3, session_mode_override: null, readiness_detail: 'full', rest_timer_enabled: 1, text_scale: 'system' },
    { profile_slot_id: 4, session_mode_override: null, readiness_detail: 'full', rest_timer_enabled: 1, text_scale: 'system' },
  ]), JSON.stringify(prefDefaults));
// --- 3. failing migration: fail fast, recover on retry --------------------------
console.log('[3] failing migration mid-chain (the device "ln" scenario)');
const c = freshDb();
const broken = [...MIGRATIONS];
broken[2] = 'CREATE TABLE will_fail (x INTEGER); SELECT no_such_fn(1);';
let threw = false;
try { runMigrations(c, broken); } catch { threw = true; }
check('failure is thrown to the caller (boot shows it)', threw);
check('user_version stopped AT the failed migration', uv(c) === 2, String(uv(c)));
check('failed migration rolled back atomically', (() => {
  return c.raw.prepare("SELECT 1 FROM sqlite_master WHERE name='will_fail'").get() === undefined;
})());
runMigrations(c, MIGRATIONS); // "next app update ships the fixed migration"
check('retry with fixed migration completes the chain',
  uv(c) === MIGRATIONS.length && sentinelsMissing(c).length === 0);

// --- 4. 006 -> 007 upgrade: data lands in athlete_profile and SURVIVES self-heal -
console.log('[4] upgrade path: user_profile data -> athlete_profile (007)');
const d = freshDb();
// A device on the 006 build (raw exec: the current runner's SENTINELS already
// expect 007's tables, so the historical state must be staged without it).
for (let i = 0; i < 5; i++) d.executeSync(MIGRATIONS[i]);
d.executeSync('PRAGMA user_version = 5;');
d.executeSync(`UPDATE user_profile SET objective = 'strength', base_rpe_cap = 8.0,
  equipment_access = 'home_basic',
  injury_flags = '[{"region":"knee","note":"old MCL"}]' WHERE profile_id = 1`);
runMigrations(d, MIGRATIONS); // the app update ships 007
const migrated = d.raw.prepare('SELECT * FROM athlete_profile WHERE profile_id = 1').get();
check('customized row copied into athlete_profile',
  migrated.objective === 'strength' && migrated.base_rpe_cap === 8.0 &&
  migrated.injury_flags.includes('MCL'));
check('legacy equipment_access mapped to home inventory bundle',
  migrated.equipment_inventory === '["dumbbells","kettlebell","pullup_bar","bands","mats"]',
  migrated.equipment_inventory);
check('legacy user_profile dropped',
  d.raw.prepare("SELECT 1 FROM sqlite_master WHERE name='user_profile'").get() === undefined);
// Now the athlete sets 'hybrid' + a custom inventory, then the DB self-heals
// (sentinel missing) â€” the re-applied 006+007 must NOT reset either field.
d.executeSync(`UPDATE athlete_profile SET objective = 'hybrid',
  equipment_inventory = '["barbell","mats"]' WHERE profile_id = 1`);
d.executeSync('DROP VIEW v_readiness_inputs;'); // poison: forces full re-apply
runMigrations(d, MIGRATIONS);
const healed = d.raw.prepare('SELECT * FROM athlete_profile WHERE profile_id = 1').get();
check('self-heal re-apply preserves hybrid objective + custom inventory',
  healed.objective === 'hybrid' && healed.equipment_inventory === '["barbell","mats"]',
  `${healed.objective} / ${healed.equipment_inventory}`);
check('self-heal restored the dropped view',
  sentinelsMissing(d).length === 0 && uv(d) === MIGRATIONS.length);

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
