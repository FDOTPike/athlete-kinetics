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
  '023_phase17_session_foundation.sql',
  '024_phase17_equipment_fixes.sql',
  '025_movement_coaching_content.sql',
  '026_phase18_session_outcome.sql',
  '027_operational_safeguards.sql',
  '028_capability_graph.sql',
  '029_routine_history_analytics.sql',
  '030_readiness_import_integration.sql',
  '031_planned_session_method.sql',
  '032_capability_content.sql',
  '033_goal_program.sql',
  '034_autopilot_attribution.sql', '035_profile_load_preference.sql'];
const MIGRATIONS = FILES.map((f) => readFileSync(join(SCHEMA_DIR, f), 'utf-8'));
const MATERIALIZE_SQL = readFileSync(join(SCHEMA_DIR, '004_state_vector_materialize.sql'), 'utf-8');

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
const phase17Prefixes = (db) => Object.fromEntries(db.raw.prepare(`
  SELECT m.name, d.supported_prefixes
  FROM movement m JOIN movement_detail d USING(movement_id)
  WHERE m.name IN ('Dumbbell Bench Press', 'Dumbbell Shoulder Press', 'Pallof Press')
  ORDER BY m.name
`).all().map((row) => [row.name, row.supported_prefixes]));
const EXPECTED_PHASE17_PREFIXES = {
  'Dumbbell Bench Press': '["DB"]',
  'Dumbbell Shoulder Press': '["DB"]',
  'Pallof Press': '["Banded"]',
};
const phase17PrefixesHold = (db) => JSON.stringify(phase17Prefixes(db)) === JSON.stringify(EXPECTED_PHASE17_PREFIXES);
const coachingContentSummary = (db) => ({
  count: Number(db.raw.prepare(`
    SELECT COUNT(*) AS c
    FROM movement m
    JOIN movement_coaching_intent i USING(movement_id)
    JOIN movement_detail d USING(movement_id)
    WHERE trim(i.coaching_intent) <> ''
      AND trim(d.instructions) <> ''
      AND trim(d.cues) <> ''
      AND trim(d.video_placeholder_uri) <> ''
  `).get().c),
  feetElevatedUrl: db.raw.prepare(`
    SELECT d.video_placeholder_uri AS url
    FROM movement m JOIN movement_detail d USING(movement_id)
    WHERE m.name = 'Feet-Elevated Push-Up'
  `).get()?.url ?? null,
});
const coachingContentComplete = (db) => {
  const summary = coachingContentSummary(db);
  return summary.count === 124
    && summary.feetElevatedUrl === 'https://www.youtube.com/watch?v=J_mB4TjUf6c';
};

// --- 1. fresh install ---------------------------------------------------------
console.log('[1] fresh install');
const a = freshDb();
runMigrations(a, MIGRATIONS);
check(`user_version = ${MIGRATIONS.length}`, uv(a) === MIGRATIONS.length, String(uv(a)));
check('all sentinels present', sentinelsMissing(a).length === 0,
  `${SENTINELS.length} checked`);
check('024 fresh install applies all three ratified equipment-prefix corrections',
  phase17PrefixesHold(a), JSON.stringify(phase17Prefixes(a)));
check('025 fresh install applies all 124 attested coaching records and approved video replacement',
  coachingContentComplete(a), JSON.stringify(coachingContentSummary(a)));
a.raw.exec("INSERT INTO import_readiness_daily (date, tonnage_kg, updated_at_ms) VALUES ('2030-01-01', 2800, 1)");
a.raw.prepare(MATERIALIZE_SQL).run('2030-01-01');
const importedReadiness = a.raw.prepare("SELECT acute_load_kg, chronic_load_kg FROM state_vector WHERE date = '2030-01-01'").get();
check('030 consumes only materialized eligible import load in readiness',
  importedReadiness !== undefined && importedReadiness.acute_load_kg === 400 && importedReadiness.chronic_load_kg === 100,
  JSON.stringify(importedReadiness));
a.raw.exec(`
  INSERT INTO training_block (block_id, start_date, objective, created_at_ms)
  VALUES (31000, '2030-01-01', 'strength', 1);
  INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date)
  VALUES (31001, 31000, 1, 1, 'full', 'accumulation', '2030-01-01');
  INSERT INTO routine_template (routine_template_id, name, schema_type, created_at_ms, updated_at_ms)
  VALUES (31002, 'APRE snapshot', 'APRE', 1, 1);
  INSERT INTO planned_session_method
    (planned_session_id, schema_type, routine_template_id, template_name, frozen_at_ms)
  VALUES (31001, 'APRE', 31002, 'APRE snapshot', 1);
  DELETE FROM routine_template WHERE routine_template_id = 31002;
`);
const methodSnapshot = a.raw.prepare(
  'SELECT schema_type, routine_template_id, template_name FROM planned_session_method WHERE planned_session_id = 31001',
).get();
check('031 preserves the frozen method snapshot after template deletion',
  methodSnapshot?.schema_type === 'APRE'
    && methodSnapshot?.routine_template_id === null
    && methodSnapshot?.template_name === 'APRE snapshot',
  JSON.stringify(methodSnapshot));

a.raw.exec(`
  INSERT INTO training_program
    (objective, start_date, horizon_kind, requested_review_date, planned_end_date, planned_block_count,
     starting_macro_block_index, schema_type, status, created_at_ms, updated_at_ms)
  VALUES ('strength', '2030-01-01', 'weeks', NULL, '2030-01-29', 1, 1, 'LINEAR', 'active', 1, 1);
  INSERT INTO training_program_day (program_id, day_index, focus) VALUES (1, 1, 'full');
  INSERT INTO training_program_movement_preference (program_id, day_index, slot_index, pattern, movement_id)
  SELECT 1, 1, 1, pattern, movement_id FROM movement WHERE pattern = 'squat' ORDER BY movement_id LIMIT 1;
  INSERT INTO training_block_program (block_id, program_id, sequence_index) VALUES (31000, 1, 1);
`);
const programSidecars = a.raw.prepare(`
  SELECT
    (SELECT COUNT(*) FROM training_program_day WHERE program_id = 1) AS days,
    (SELECT COUNT(*) FROM training_program_movement_preference WHERE program_id = 1) AS preferences,
    (SELECT COUNT(*) FROM training_block_program WHERE program_id = 1) AS links
`).get();
check('033 stores goal-program days, movement preferences, and explicit block links',
  programSidecars.days === 1 && programSidecars.preferences === 1 && programSidecars.links === 1,
  JSON.stringify(programSidecars));
let secondCurrentRejected = false;
try {
  a.raw.exec(`INSERT INTO training_program
    (objective, start_date, horizon_kind, requested_review_date, planned_end_date, planned_block_count,
     starting_macro_block_index, schema_type, status, created_at_ms, updated_at_ms)
    VALUES ('gpp', '2030-01-01', 'weeks', NULL, '2030-01-29', 1, 1, 'LINEAR', 'review_due', 2, 2)`);
} catch { secondCurrentRejected = true; }
check('033 enforces only one active or review-due program', secondCurrentRejected);

runMigrations(a, MIGRATIONS); // second boot
check('re-boot is a no-op (idempotent)', uv(a) === MIGRATIONS.length);
check('024 corrections survive a normal no-op reboot',
  phase17PrefixesHold(a), JSON.stringify(phase17Prefixes(a)));
a.executeSync(`PRAGMA user_version = ${FILES.indexOf('024_phase17_equipment_fixes.sql')};`);
runMigrations(a, MIGRATIONS);
check('024 can be re-applied idempotently through the production runner',
  uv(a) === MIGRATIONS.length && phase17PrefixesHold(a),
  JSON.stringify(phase17Prefixes(a)));
a.executeSync(`PRAGMA user_version = ${FILES.indexOf('025_movement_coaching_content.sql')};`);
runMigrations(a, MIGRATIONS);
check('025 can be re-applied idempotently through the production runner',
  uv(a) === MIGRATIONS.length && coachingContentComplete(a),
  JSON.stringify(coachingContentSummary(a)));
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
check('full sentinel self-heal replays 024 equipment corrections',
  phase17PrefixesHold(b), JSON.stringify(phase17Prefixes(b)));
check('full sentinel self-heal replays 025 attested coaching content',
  coachingContentComplete(b), JSON.stringify(coachingContentSummary(b)));
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
// Regress user_version to the exact 022 boundary so 022 and later data
// migrations re-run through the production runner.
b5.executeSync(`PRAGMA user_version = ${FILES.indexOf('022_set_target.sql')};`);
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
// --- 2g. Phase 18 side-cars: poison heal, no backfill, reapply, rollback -----
console.log('[2g] 026 Phase 18 outcome side-cars');
const phase18File = '026_phase18_session_outcome.sql';
const phase18Index = FILES.indexOf(phase18File);

for (const table of ['set_dose_target', 'session_outcome']) {
  const poisoned = freshDb();
  runMigrations(poisoned, MIGRATIONS);
  poisoned.executeSync(`DROP TABLE ${table}`);
  check(`026 poison precondition: ${table} sentinel missing`, sentinelsMissing(poisoned).includes(table));
  runMigrations(poisoned, MIGRATIONS);
  check(`026 poison self-heal restores ${table} and its immutability triggers`,
    sentinelsMissing(poisoned).length === 0);
}

const triggerPoison = freshDb();
runMigrations(triggerPoison, MIGRATIONS);
const phase18Triggers = [
  'trg_set_dose_target_bi',
  'trg_set_dose_target_bu',
  'trg_set_dose_target_bd',
  'trg_session_outcome_bi',
  'trg_session_outcome_bu',
  'trg_session_outcome_bd',
];
for (const trigger of phase18Triggers) triggerPoison.executeSync(`DROP TRIGGER ${trigger}`);
const missingPhase18Triggers = sentinelsMissing(triggerPoison);
check('026 trigger poison precondition: all six immutability sentinels missing',
  phase18Triggers.every((name) => missingPhase18Triggers.includes(name)));
runMigrations(triggerPoison, MIGRATIONS);
check('026 trigger poison self-heal restores all immutability sentinels',
  sentinelsMissing(triggerPoison).length === 0);

const noBackfill = freshDb();
for (let i = 0; i < phase18Index; i += 1) noBackfill.executeSync(MIGRATIONS[i]);
noBackfill.executeSync(`PRAGMA user_version = ${phase18Index};`);
noBackfill.executeSync(`INSERT INTO session (session_id, session_date, started_at_ms) VALUES (2600, '2026-07-16', 1000)`);
noBackfill.executeSync(`INSERT INTO set_record
  (set_id, session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms)
  VALUES (2600, 2600, 1, 1, 5, 20, 8, 1100)`);
runMigrations(noBackfill, MIGRATIONS);
check('026 performs no historical dose or outcome backfill',
  Number(noBackfill.raw.prepare('SELECT COUNT(*) AS c FROM set_dose_target').get().c) === 0
    && Number(noBackfill.raw.prepare('SELECT COUNT(*) AS c FROM session_outcome').get().c) === 0);
noBackfill.executeSync(`INSERT INTO set_dose_target (set_id, target_kind, target_reps)
  VALUES (2600, 'reps', 5)`);
noBackfill.executeSync(`INSERT INTO session_outcome (
    session_id, outcome_kind, terminal_phase, halt_reason, origin_kind,
    session_mode, training_age, slot_count, planned_set_count, logged_set_count,
    exact_dose_count, under_dose_count, over_dose_count, unknown_dose_count,
    unmapped_set_count, missing_set_count, missing_unskipped_set_count,
    extra_set_count, adapted_slot_count, skipped_slot_count, off_plan_slot_count,
    finalized_at_ms, engine_version
  ) VALUES (
    2600, 'followed_plan', 'complete', NULL, 'planned',
    'guided', 'beginner', 1, 1, 1,
    1, 0, 0, 0,
    0, 0, 0,
    0, 0, 0, 0,
    1200, 1
  )`);
noBackfill.executeSync(`PRAGMA user_version = ${phase18Index};`);
runMigrations(noBackfill, MIGRATIONS);
check('026 reapply preserves immutable dose and outcome rows',
  noBackfill.raw.prepare('SELECT target_reps FROM set_dose_target WHERE set_id=2600').get()?.target_reps === 5
    && noBackfill.raw.prepare('SELECT outcome_kind FROM session_outcome WHERE session_id=2600').get()?.outcome_kind === 'followed_plan');

const phase18Rollback = freshDb();
for (let i = 0; i < phase18Index; i += 1) phase18Rollback.executeSync(MIGRATIONS[i]);
phase18Rollback.executeSync(`PRAGMA user_version = ${phase18Index};`);
const brokenPhase18 = [
  ...MIGRATIONS.slice(0, phase18Index),
  `${MIGRATIONS[phase18Index]}\nSELECT no_such_phase18_fn(1);`,
];
let phase18Threw = false;
try { runMigrations(phase18Rollback, brokenPhase18); } catch { phase18Threw = true; }
check('026 failure is thrown and user_version stays at its boundary',
  phase18Threw && uv(phase18Rollback) === phase18Index, String(uv(phase18Rollback)));
check('026 failure rolls both side-cars and all six triggers back atomically',
  ['set_dose_target', 'session_outcome',
    'trg_set_dose_target_bi', 'trg_set_dose_target_bu', 'trg_set_dose_target_bd',
    'trg_session_outcome_bi', 'trg_session_outcome_bu', 'trg_session_outcome_bd']
    .every((name) => phase18Rollback.raw.prepare('SELECT 1 FROM sqlite_master WHERE name=?').get(name) === undefined));
runMigrations(phase18Rollback, MIGRATIONS);
check('026 retry with the valid migration completes',
  uv(phase18Rollback) === MIGRATIONS.length && sentinelsMissing(phase18Rollback).length === 0);

// --- 2h. 034 autopilot attribution side-car: replay, exact rows, cascade ---
console.log('[2h] 034 autopilot attribution side-car');
const attributionDb = freshDb();
runMigrations(attributionDb, MIGRATIONS);
attributionDb.executeSync(`
  INSERT INTO training_block (block_id, start_date, objective, created_at_ms)
  VALUES (3300, '2030-02-01', 'strength', 1);
  INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date)
  VALUES (3301, 3300, 1, 1, 'lower', 'accumulation', '2030-02-01');
  INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe)
  VALUES (3301, 3301, 1, 1, 3, 5, 8.0), (3302, 3301, 2, 2, 3, 5, 8.0);
  INSERT INTO planned_slot_autopilot (planned_slot_id, rpe_delta, set_delta, reason)
  VALUES (3301, -0.5, -1, 'eased');
`);
const attributionRow = attributionDb.raw.prepare(
  'SELECT rpe_delta, set_delta, reason FROM planned_slot_autopilot WHERE planned_slot_id = 3301',
).get();
check('034 side-car round-trips the effective per-slot delta',
  attributionRow?.rpe_delta === -0.5 && attributionRow?.set_delta === -1 && attributionRow?.reason === 'eased',
  JSON.stringify(attributionRow));
check('034 untouched slot has no side-car row',
  Number(attributionDb.raw.prepare('SELECT COUNT(*) AS c FROM planned_slot_autopilot WHERE planned_slot_id = 3302').get().c) === 0);
let invalidAttributionRejected = 0;
for (const values of [
  "3302, 1.0, 0, 'raised'",
  "3302, 0.0, 2, 'raised'",
  "3302, 0.0, 0, 'unknown'",
]) {
  try {
    attributionDb.executeSync(`INSERT INTO planned_slot_autopilot (planned_slot_id, rpe_delta, set_delta, reason) VALUES (${values})`);
  } catch {
    invalidAttributionRejected += 1;
  }
}
check('034 rejects out-of-authority deltas and unknown reasons', invalidAttributionRejected === 3);
attributionDb.executeSync(`PRAGMA user_version = ${FILES.indexOf('034_autopilot_attribution.sql')};`);
runMigrations(attributionDb, MIGRATIONS);
check('034 replay preserves the attribution row and exact row count',
  Number(attributionDb.raw.prepare('SELECT COUNT(*) AS c FROM planned_slot_autopilot').get().c) === 1
    && attributionDb.raw.prepare('SELECT reason FROM planned_slot_autopilot WHERE planned_slot_id = 3301').get()?.reason === 'eased');
attributionDb.executeSync('DELETE FROM planned_slot WHERE planned_slot_id = 3301');
check('034 parent delete cascades the side-car and leaves no joined stale row',
  Number(attributionDb.raw.prepare('SELECT COUNT(*) AS c FROM planned_slot_autopilot').get().c) === 0
    && Number(attributionDb.raw.prepare('SELECT COUNT(*) AS c FROM planned_slot_autopilot pa JOIN planned_slot ps USING (planned_slot_id)').get().c) === 0);
attributionDb.executeSync('DROP TABLE planned_slot_autopilot');
check('034 poison precondition marks the side-car sentinel missing', sentinelsMissing(attributionDb).includes('planned_slot_autopilot'));
runMigrations(attributionDb, MIGRATIONS);
check('034 self-heal restores the side-car table',
  !sentinelsMissing(attributionDb).includes('planned_slot_autopilot')
    && uv(attributionDb) === MIGRATIONS.length);

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

// --- 2i. 035 profile load preference: seeding law, CHECK, cascade, replay ---
console.log('[2i] 035 profile load preference side-car');
const prefDb = freshDb();
runMigrations(prefDb, MIGRATIONS);
// 013 seeds 4 slots; the slot matching the live athlete_profile.training_age
// (DEFAULT_PROFILE = beginner) is active; the rest are inactive snapshots.
const prefRows = Object.fromEntries(prefDb.raw.prepare(
  `SELECT s.slot_id, s.is_active, json_extract(s.profile_json, '$.training_age') AS age, p.preference, p.is_explicit
   FROM profile_slot s JOIN profile_load_preference p ON p.profile_slot_id = s.slot_id ORDER BY s.slot_id`,
).all().map((r) => [r.slot_id, r]));
check('035 seeds one preference row per profile slot', Object.keys(prefRows).length === 4,
  JSON.stringify(Object.keys(prefRows)));
check('035 beginner + intermediate slots seed auto',
  prefRows[1]?.preference === 'auto' && prefRows[2]?.preference === 'auto',
  JSON.stringify([prefRows[1]?.preference, prefRows[2]?.preference]));
check('035 advanced + elite slots seed manual',
  prefRows[3]?.preference === 'manual' && prefRows[4]?.preference === 'manual',
  JSON.stringify([prefRows[3]?.preference, prefRows[4]?.preference]));
check('035 tier-derived seeds are marked non-explicit',
  Number(prefDb.raw.prepare('SELECT COUNT(*) AS c FROM profile_load_preference WHERE is_explicit <> 0').get()?.c) === 0);
// Active slot derives from the LIVE athlete_profile row, not the snapshot:
// mutate the live profile to elite, drop the side-car, self-heal, and the
// active slot must re-seed from the live row ('manual') even though its
// frozen profile_json still says beginner.
prefDb.executeSync(`UPDATE athlete_profile SET training_age = 'elite' WHERE profile_id = 1`);
prefDb.executeSync(`UPDATE profile_slot SET is_active = 1 WHERE slot_id = 1`);
prefDb.executeSync('DROP TABLE profile_load_preference');
check('035 poison precondition marks the side-car sentinel missing',
  sentinelsMissing(prefDb).includes('profile_load_preference'));
runMigrations(prefDb, MIGRATIONS);
check('035 self-heal restores the table and re-seeds the active slot from the LIVE profile',
  !sentinelsMissing(prefDb).includes('profile_load_preference')
    && prefDb.raw.prepare('SELECT preference FROM profile_load_preference WHERE profile_slot_id = 1').get()?.preference === 'manual'
    && uv(prefDb) === MIGRATIONS.length);
// Upgrade path: a 034-era DB gains the side-car without touching existing rows.
const upDb035 = freshDb();
const to034 = MIGRATIONS.slice(0, FILES.indexOf('035_profile_load_preference.sql'));
// Stage the 034-era state without the runner: the runner's sentinel list
// already knows 035, so a partial chain would (correctly) fail self-heal.
for (const m of to034) upDb035.executeSync(m);
upDb035.executeSync(`PRAGMA user_version = ${to034.length};`);
runMigrations(upDb035, MIGRATIONS); // the app update ships 035
upDb035.executeSync(`UPDATE profile_load_preference SET preference = 'manual', is_explicit = 1 WHERE profile_slot_id = 2`);
check('034 -> 035 upgrade preserves an explicit existing preference (OR IGNORE)',
  upDb035.raw.prepare('SELECT preference FROM profile_load_preference WHERE profile_slot_id = 2').get()?.preference === 'manual'
    && upDb035.raw.prepare('SELECT is_explicit FROM profile_load_preference WHERE profile_slot_id = 2').get()?.is_explicit === 1
    && Number(upDb035.raw.prepare('SELECT COUNT(*) AS c FROM profile_load_preference').get().c) === 4);
// Replay: re-running the full chain does not rewrite preferences.
runMigrations(upDb035, MIGRATIONS);
check('035 replay preserves stored preferences',
  upDb035.raw.prepare('SELECT preference FROM profile_load_preference WHERE profile_slot_id = 2').get()?.preference === 'manual'
    && upDb035.raw.prepare('SELECT is_explicit FROM profile_load_preference WHERE profile_slot_id = 2').get()?.is_explicit === 1);
// Poison + self-heal on the upgrade DB: a DROPPED table loses its stored
// rows, so the rebuild re-derives slot seeds from profile_json (the safe
// tier-default fallback the WO mandates for missing rows).
upDb035.executeSync('DROP TABLE profile_load_preference');
check('035 poison precondition marks the sentinel missing on the upgrade DB',
  sentinelsMissing(upDb035).includes('profile_load_preference'));
runMigrations(upDb035, MIGRATIONS);
check('035 poison/self-heal rebuilds the table (seeds re-derive to tier defaults)',
  !sentinelsMissing(upDb035).includes('profile_load_preference')
    && Number(upDb035.raw.prepare('SELECT COUNT(*) AS c FROM profile_load_preference').get().c) === 4
    && upDb035.raw.prepare('SELECT preference FROM profile_load_preference WHERE profile_slot_id = 2').get()?.preference === 'auto');
// CHECK rejection: prove the preference domain independently on an EXISTING
// slot (an unknown slot would only prove the foreign key).
let badPrefRejected = 0;
for (const bad of ["'guided'", "NULL", "''"]) {
  try {
    prefDb.executeSync(`UPDATE profile_load_preference SET preference = ${bad} WHERE profile_slot_id = 1`);
  } catch {
    badPrefRejected += 1;
  }
}
check('035 CHECK rejects non auto|manual on an existing profile slot', badPrefRejected === 3);
let badExplicitRejected = 0;
for (const bad of [-1, 2]) {
  try {
    prefDb.executeSync(`UPDATE profile_load_preference SET is_explicit = ${bad} WHERE profile_slot_id = 1`);
  } catch {
    badExplicitRejected += 1;
  }
}
check('035 CHECK constrains explicit-choice metadata to boolean 0|1', badExplicitRejected === 2);
let unknownSlotRejected = false;
try {
  prefDb.executeSync("INSERT INTO profile_load_preference (profile_slot_id, preference) VALUES (99, 'auto')");
} catch {
  unknownSlotRejected = true;
}
check('035 foreign key rejects an unknown profile slot', unknownSlotRejected);
// FK cascade: deleting a slot deletes its preference row.
prefDb.executeSync('DELETE FROM profile_slot WHERE slot_id = 4');
check('035 profile-slot delete cascades the preference row',
  prefDb.raw.prepare('SELECT preference FROM profile_load_preference WHERE profile_slot_id = 4').get() === undefined);

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
