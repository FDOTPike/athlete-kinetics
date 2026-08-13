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
  '034_autopilot_attribution.sql', '035_profile_load_preference.sql',
  '036_movement_media.sql',
  '037_movement_library_v2_batch.sql', '038_movement_library_v2_batch.sql',
  '039_movement_library_v2_batch.sql', '040_movement_library_v2_batch.sql',
  '041_movement_library_v2_batch.sql', '042_movement_library_v2_batch.sql',
  '043_movement_library_v2_batch.sql', '044_movement_library_v2_batch.sql',
  '045_movement_library_v2_batch.sql', '046_movement_library_v2_batch.sql',
  '047_movement_library_v2_batch.sql', '048_movement_library_v2_batch.sql',
  '049_movement_content_correction_v1.sql',
  '050_movement_role_convergence.sql',
  '051_routine_access_context.sql',
  '052_bounded_microcycle_roles.sql',
  '053_routine_role_compatibility.sql'];
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
const phase2aLibrarySummary = (db) => db.raw.prepare(`
  SELECT
    (SELECT COUNT(*) FROM movement) AS movements,
    (SELECT COUNT(*) FROM movement_coaching_intent) AS coaching,
    (SELECT COUNT(*) FROM movement_media) AS media,
    (SELECT COUNT(*) FROM movement_media WHERE status = 'external_fallback') AS fallback,
    (SELECT COUNT(*) FROM movement_media WHERE status = 'planned') AS planned,
    (SELECT COUNT(*) FROM movement_media WHERE status = 'ready') AS ready
`).get();
const phase2aLibraryComplete = (db) => {
  const summary = phase2aLibrarySummary(db);
  return summary.movements === 300 && summary.coaching === 300 && summary.media === 300
    && summary.fallback === 124 && summary.planned === 176 && summary.ready === 0;
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
check('036-048 fresh install yields the exact 300-row media/content corpus',
  phase2aLibraryComplete(a), JSON.stringify(phase2aLibrarySummary(a)));
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
check('all movement seed batches arrive after sentinel self-heal: 300 movements',
  Number(b2.raw.prepare('SELECT COUNT(*) c FROM movement').get().c) === 300);

// --- 2c. partial-018 damage: set_metric survives, siblings dropped (audit B4) --
console.log('[2c] partial 018 damage: movement_logging_mode dropped post-apply');
const b3 = freshDb();
runMigrations(b3, MIGRATIONS);
b3.executeSync('DROP TABLE movement_logging_mode');
check('precondition: movement_logging_mode missing, set_metric present',
  sentinelsMissing(b3).includes('movement_logging_mode') && !sentinelsMissing(b3).includes('set_metric'));
runMigrations(b3, MIGRATIONS);
check('self-heal restored the dropped 018 sibling', sentinelsMissing(b3).length === 0);
check('time-mode seeds healed back (6 rows including Trail Running/Walking)',
  Number(b3.raw.prepare('SELECT COUNT(*) c FROM movement_logging_mode').get().c) === 6);

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
  'Trail Running/Walking': '1/1200',
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
// Verify 035 created the table and seeded four tier-derived rows.
const seededPrefs = upDb035.raw.prepare(
  'SELECT profile_slot_id, preference, is_explicit FROM profile_load_preference ORDER BY profile_slot_id',
).all();
check('034 -> 035 upgrade creates the side-car and seeds four tier-derived rows (non-explicit)',
  seededPrefs.length === 4
    && seededPrefs.every((r) => r.is_explicit === 0)
    && seededPrefs[0].preference === 'auto'   // beginner
    && seededPrefs[1].preference === 'auto'   // intermediate
    && seededPrefs[2].preference === 'manual' // advanced
    && seededPrefs[3].preference === 'manual' // elite
);
// Make an explicit user update AFTER 035 has run.
upDb035.executeSync(`UPDATE profile_load_preference SET preference = 'manual', is_explicit = 1 WHERE profile_slot_id = 2`);
// Replay: re-running the full chain must preserve the explicit update (INSERT OR IGNORE).
runMigrations(upDb035, MIGRATIONS);
check('035 replay preserves an explicit user update (INSERT OR IGNORE does not overwrite)',
  upDb035.raw.prepare('SELECT preference FROM profile_load_preference WHERE profile_slot_id = 2').get()?.preference === 'manual'
    && upDb035.raw.prepare('SELECT is_explicit FROM profile_load_preference WHERE profile_slot_id = 2').get()?.is_explicit === 1
    && Number(upDb035.raw.prepare('SELECT COUNT(*) AS c FROM profile_load_preference').get().c) === 4);
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

// --- 2j. 036-048 movement media + v2 catalogue: upgrade, poison, replay ---
console.log('[2j] 036-048 Phase 2a movement library');
const phase2aDb = freshDb();
const mediaIndex = FILES.indexOf('036_movement_media.sql');
for (let i = 0; i < mediaIndex; i += 1) phase2aDb.executeSync(MIGRATIONS[i]);
phase2aDb.executeSync(`PRAGMA user_version = ${mediaIndex};`);
check('035-era upgrade precondition has 124 movements and no media table',
  Number(phase2aDb.raw.prepare('SELECT COUNT(*) AS c FROM movement').get().c) === 124
    && phase2aDb.raw.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='movement_media'").get() === undefined);
runMigrations(phase2aDb, MIGRATIONS);
check('clean 035 -> 048 upgrade yields the exact 300-row corpus',
  phase2aLibraryComplete(phase2aDb), JSON.stringify(phase2aLibrarySummary(phase2aDb)));

phase2aDb.executeSync('DROP TABLE movement_media');
check('036 poison precondition marks movement_media missing',
  sentinelsMissing(phase2aDb).includes('movement_media'));
runMigrations(phase2aDb, MIGRATIONS);
check('036 poison self-heal restores all 300 media rows and statuses',
  sentinelsMissing(phase2aDb).length === 0 && phase2aLibraryComplete(phase2aDb),
  JSON.stringify(phase2aLibrarySummary(phase2aDb)));

let replayedBatches = 0;
for (const file of FILES.filter((name) => /^0(?:3[7-9]|4[0-8])_movement_library_v2_batch\.sql$/.test(name))) {
  phase2aDb.executeSync(`PRAGMA user_version = ${FILES.indexOf(file)};`);
  runMigrations(phase2aDb, MIGRATIONS);
  if (phase2aLibraryComplete(phase2aDb)) replayedBatches += 1;
}
check('all twelve v2 batch boundaries replay idempotently', replayedBatches === 12,
  `${replayedBatches}/12`);

// --- 2k. 049 pre-release content correction: upgrade, replay, poison, rebuild ---
console.log('[2k] 049 Phase 2a pre-release content correction');
const correctionIndex = FILES.indexOf('049_movement_content_correction_v1.sql');
const CORRECTED_EQUIPMENT = ['Board Press', 'Floor Glute-Ham Raise', 'Natural Glute Ham Raise', 'Seated Good Mornings'];
const equipmentRows = (db) => db.raw.prepare(`
  SELECT m.name, e.item FROM movement_equipment e JOIN movement m USING(movement_id)
  ORDER BY m.name, e.item
`).all().map((r) => `${r.name}|${r.item}`);
const untouchedEquipment = (db) =>
  equipmentRows(db).filter((row) => !CORRECTED_EQUIPMENT.includes(row.split('|')[0]));
const correctionSummary = (db) => db.raw.prepare(`
  SELECT
    (SELECT COUNT(*) FROM movement_content_correction) AS corrections,
    (SELECT COUNT(*) FROM movement_content_correction WHERE correction_version = 1) AS v1,
    (SELECT COUNT(*) FROM movement_scope WHERE scope = 'full_body') AS scoped,
    (SELECT COUNT(*) FROM movement_equipment WHERE item = 'boards') AS boards,
    (SELECT m.pattern FROM movement m WHERE m.name = 'Kettlebell Turkish Get-Up (Lunge style)') AS tguPattern,
    (SELECT t.category FROM movement_taxonomy t JOIN movement m USING(movement_id)
      WHERE m.name = 'Kettlebell Turkish Get-Up (Lunge style)') AS tguCategory,
    (SELECT d.video_placeholder_uri FROM movement_detail d JOIN movement m USING(movement_id)
      WHERE m.name = 'Kettlebell Turkish Get-Up') AS canonicalTguUrl
`).get();
const correctionComplete = (db) => {
  const s = correctionSummary(db);
  return s.corrections === 32 && s.v1 === 32 && s.scoped === 2 && s.boards === 1
    && s.tguPattern === 'rotation' && s.tguCategory === 'core'
    && s.canonicalTguUrl === 'https://www.youtube.com/watch?v=lpltjWHd0ek';
};

// (1) clean 048 -> current upgrade: 049 applies the correction, then 050
// converges supplementary-role eligibility.
const correctionDb = freshDb();
for (let i = 0; i < correctionIndex; i += 1) correctionDb.executeSync(MIGRATIONS[i]);
correctionDb.executeSync(`PRAGMA user_version = ${correctionIndex};`);
check('048-era upgrade precondition: user_version 47, no correction tables',
  uv(correctionDb) === 47 && correctionIndex === 47
    && correctionDb.raw.prepare("SELECT 1 FROM sqlite_master WHERE name='movement_scope'").get() === undefined,
  String(uv(correctionDb)));
const equipmentBefore = untouchedEquipment(correctionDb);
runMigrations(correctionDb, MIGRATIONS);
check('clean 048 -> current upgrade lands every correction and reaches the latest user_version',
  uv(correctionDb) === MIGRATIONS.length && correctionComplete(correctionDb),
  JSON.stringify(correctionSummary(correctionDb)));
check('the movement_equipment rebuild preserves every untouched row, content for content',
  JSON.stringify(untouchedEquipment(correctionDb)) === JSON.stringify(equipmentBefore),
  `${equipmentBefore.length} rows`);
check('049 moves no media: the 300-row media corpus is untouched',
  phase2aLibraryComplete(correctionDb), JSON.stringify(phase2aLibrarySummary(correctionDb)));

// (2) explicit replay from the 049 boundary.
correctionDb.executeSync(`PRAGMA user_version = ${correctionIndex};`);
runMigrations(correctionDb, MIGRATIONS);
check('049 replays idempotently from its own boundary (no duplicate provenance rows)',
  uv(correctionDb) === MIGRATIONS.length && correctionComplete(correctionDb)
    && JSON.stringify(untouchedEquipment(correctionDb)) === JSON.stringify(equipmentBefore),
  JSON.stringify(correctionSummary(correctionDb)));

// (3) full re-apply from zero: 037-048 rewrite the originals, 049 re-asserts last.
correctionDb.executeSync('PRAGMA user_version = 0;');
runMigrations(correctionDb, MIGRATIONS);
check('full re-apply from 0 leaves the corrections asserted last, not the originals',
  correctionComplete(correctionDb) && phase2aLibraryComplete(correctionDb),
  JSON.stringify(correctionSummary(correctionDb)));

// (4) poisoned user_version claims the latest chain while 049 never applied.
const poisonedCorrection = freshDb();
for (let i = 0; i < correctionIndex; i += 1) poisonedCorrection.executeSync(MIGRATIONS[i]);
poisonedCorrection.executeSync(`PRAGMA user_version = ${MIGRATIONS.length};`);
check('049 poison precondition: user_version claims latest but both sentinels are absent',
  sentinelsMissing(poisonedCorrection).includes('movement_scope')
    && sentinelsMissing(poisonedCorrection).includes('movement_content_correction'));
runMigrations(poisonedCorrection, MIGRATIONS);
check('049 poison self-heal re-applies the whole chain and restores both sentinels',
  sentinelsMissing(poisonedCorrection).length === 0 && correctionComplete(poisonedCorrection),
  JSON.stringify(correctionSummary(poisonedCorrection)));

// Constraint surface of the two new tables + the widened equipment domain.
const scopeMovementId = Number(correctionDb.raw.prepare(
  "SELECT movement_id FROM movement WHERE name = 'Kettlebell Turkish Get-Up'").get().movement_id);
let scopeRejections = 0;
for (const sql of [
  `INSERT INTO movement_scope (movement_id, scope) VALUES (${scopeMovementId}, 'upper_body')`,
  `INSERT INTO movement_scope (movement_id, scope) VALUES (${scopeMovementId}, 'full_body')`,
  "INSERT INTO movement_scope (movement_id, scope) VALUES (999999, 'full_body')",
  `INSERT INTO movement_content_correction (movement_id, correction_version, correction_sha256, applied_at_ms) VALUES (${scopeMovementId}, 0, 'x', 1)`,
]) {
  try { correctionDb.executeSync(sql); } catch { scopeRejections += 1; }
}
check('049 CHECK/PK/FK surface rejects a bad scope, a duplicate, an unknown movement, and version 0',
  scopeRejections === 4, `${scopeRejections}/4`);
const boardPressId = Number(correctionDb.raw.prepare(
  "SELECT movement_id FROM movement WHERE name = 'Board Press'").get().movement_id);
let equipmentRejected = false;
try {
  correctionDb.executeSync(`INSERT INTO movement_equipment (movement_id, item) VALUES (${boardPressId}, 'sled')`);
} catch { equipmentRejected = true; }
check('the widened domain accepts boards (already stored) and still rejects a bogus item',
  equipmentRejected
    && Number(correctionDb.raw.prepare(
      'SELECT COUNT(*) AS c FROM movement_equipment WHERE movement_id = ? AND item = ?',
    ).get(boardPressId, 'boards').c) === 1);
correctionDb.executeSync(`DELETE FROM movement WHERE movement_id = ${scopeMovementId}`);
check('movement delete cascades both 049 side-cars',
  Number(correctionDb.raw.prepare('SELECT COUNT(*) AS c FROM movement_scope WHERE movement_id = ?').get(scopeMovementId).c) === 0
    && Number(correctionDb.raw.prepare('SELECT COUNT(*) AS c FROM movement_content_correction WHERE movement_id = ?').get(scopeMovementId).c) === 0
    && Number(correctionDb.raw.prepare('SELECT COUNT(*) AS c FROM movement_equipment WHERE movement_id = ?').get(scopeMovementId).c) === 0);

const mediaCascadeId = Number(phase2aDb.raw.prepare(
  "SELECT movement_id FROM movement WHERE name = '3/4 Sit-Up'",
).get().movement_id);
phase2aDb.executeSync(`DELETE FROM movement WHERE movement_id = ${mediaCascadeId}`);
check('movement delete cascades its media side-car',
  phase2aDb.raw.prepare('SELECT 1 FROM movement_media WHERE movement_id = ?').get(mediaCascadeId) === undefined);

// --- 2l. 050 movement-role convergence --------------------------------------
console.log('[2l] 050 supplementary-role convergence');
const roleIndex = FILES.indexOf('050_movement_role_convergence.sql');
const roleDb = freshDb();
for (let i = 0; i < roleIndex; i += 1) roleDb.executeSync(MIGRATIONS[i]);
roleDb.executeSync(`PRAGMA user_version = ${roleIndex};`);
const roleCounts = (database) => database.raw.prepare(`
  SELECT
    (SELECT COUNT(*) FROM movement) AS movements,
    (SELECT COUNT(*) FROM movement_role_eligibility WHERE role = 'supplementary') AS supplementary,
    (SELECT COUNT(*) FROM movement_role_eligibility WHERE role = 'major') AS major,
    (SELECT COUNT(*) FROM movement_role_eligibility WHERE role = 'accessory') AS accessory,
    (SELECT COUNT(*) FROM movement_role_eligibility WHERE role = 'conditional') AS conditional
`).get();
check('049-era precondition exposes the fresh/poison divergence: 300 movements but 124 supplementary',
  roleCounts(roleDb).movements === 300 && roleCounts(roleDb).supplementary === 124,
  JSON.stringify(roleCounts(roleDb)));
roleDb.executeSync(MIGRATIONS[roleIndex]);
roleDb.executeSync(`PRAGMA user_version = ${roleIndex + 1};`);
check('clean 049 -> historical 050 boundary converges every live movement without widening explicit roles',
  uv(roleDb) === roleIndex + 1
    && roleCounts(roleDb).supplementary === roleCounts(roleDb).movements
    && roleCounts(roleDb).major === 8 && roleCounts(roleDb).accessory === 0
    && roleCounts(roleDb).conditional === 12,
  JSON.stringify(roleCounts(roleDb)));

roleDb.executeSync(MIGRATIONS[roleIndex]);
check('historical 050 replay is idempotent and duplicate-free',
  roleCounts(roleDb).supplementary === 300
    && Number(roleDb.raw.prepare(`
      SELECT COUNT(*) AS c FROM (
        SELECT movement_id, role, COUNT(*) AS n FROM movement_role_eligibility
        GROUP BY movement_id, role HAVING n > 1
      )
    `).get().c) === 0);

const poisonedRole = freshDb();
for (let i = 0; i < roleIndex; i += 1) poisonedRole.executeSync(MIGRATIONS[i]);
poisonedRole.executeSync(MIGRATIONS[FILES.indexOf('028_capability_graph.sql')]);
poisonedRole.executeSync(`PRAGMA user_version = ${roleIndex + 1};`);
check('poison precondition has widened data but lacks the 050 trigger sentinel',
  roleCounts(poisonedRole).supplementary === 300
    && poisonedRole.raw.prepare("SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='trg_movement_supplementary_ai'").get() === undefined);
poisonedRole.executeSync(MIGRATIONS[roleIndex]);
check('historical 050 repair and clean upgrade converge byte-for-byte on role counts',
  poisonedRole.raw.prepare("SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='trg_movement_supplementary_ai'").get() !== undefined
    && JSON.stringify(roleCounts(poisonedRole)) === JSON.stringify(roleCounts(roleDb)),
  JSON.stringify(roleCounts(poisonedRole)));

roleDb.executeSync("INSERT INTO movement (name, pattern, is_compound) VALUES ('050 Future Movement', 'isolation', 0)");
const futureMovementId = Number(roleDb.raw.prepare(
  "SELECT movement_id FROM movement WHERE name = '050 Future Movement'",
).get().movement_id);
check('historical 050 trigger gives a future live movement supplementary eligibility exactly once',
  Number(roleDb.raw.prepare(
    "SELECT COUNT(*) AS c FROM movement_role_eligibility WHERE movement_id = ? AND role = 'supplementary'",
  ).get(futureMovementId).c) === 1);

// --- 2m. 051 routine access context ----------------------------------------
console.log('[2m] 051 routine access context');
const accessIndex = FILES.indexOf('051_routine_access_context.sql');
const accessDb = freshDb();
for (let i = 0; i < accessIndex; i += 1) accessDb.executeSync(MIGRATIONS[i]);
accessDb.executeSync(`PRAGMA user_version = ${accessIndex};`);
const roleFingerprint = (database) => database.raw.prepare(`
  SELECT group_concat(movement_id || ':' || role, '|') AS value
  FROM (SELECT movement_id, role FROM movement_role_eligibility ORDER BY movement_id, role)
`).get().value;
const rolesBefore051 = roleFingerprint(accessDb);
const accessSummary = (database) => ({
  sport: database.raw.prepare(`
    SELECT group_concat(name, '|') AS names FROM (
      SELECT m.name FROM movement_sport_tracking st
      JOIN movement m USING (movement_id) ORDER BY m.name
    )
  `).get().names,
  nonCardio: Number(database.raw.prepare(`
    SELECT COUNT(*) AS c FROM movement_sport_tracking st
    JOIN movement_taxonomy mt USING (movement_id) WHERE mt.category <> 'cardio'
  `).get().c),
  taxonomyRows: Number(database.raw.prepare(`
    SELECT COUNT(*) AS c FROM movement_sport_tracking st
    JOIN movement_taxonomy mt USING (movement_id)
  `).get().c),
  edgeEndpoints: Number(database.raw.prepare(`
    SELECT COUNT(*) AS c FROM movement_capability_edge edge
    WHERE edge.prerequisite_movement_id IN (SELECT movement_id FROM movement_sport_tracking)
       OR edge.movement_id IN (SELECT movement_id FROM movement_sport_tracking)
  `).get().c),
  movements: Number(database.raw.prepare('SELECT COUNT(*) AS c FROM movement').get().c),
  media: Number(database.raw.prepare('SELECT COUNT(*) AS c FROM movement_media').get().c),
  corrections: Number(database.raw.prepare('SELECT COUNT(*) AS c FROM movement_content_correction').get().c),
  roleFingerprint: roleFingerprint(database),
});
accessDb.executeSync(MIGRATIONS[accessIndex]);
accessDb.executeSync(`PRAGMA user_version = ${accessIndex + 1};`);
const cleanAccessSummary = accessSummary(accessDb);
check('clean 050 -> historical 051 boundary seeds the exact cardio-only sport set without role or content drift',
  uv(accessDb) === accessIndex + 1
    && cleanAccessSummary.sport === 'BJJ Sparring Round|Road Run|Trail Running/Walking'
    && cleanAccessSummary.nonCardio === 0
    && cleanAccessSummary.taxonomyRows === 3
    && cleanAccessSummary.edgeEndpoints === 0
    && cleanAccessSummary.movements === 300
    && cleanAccessSummary.media === 300
    && cleanAccessSummary.corrections === 32
    && cleanAccessSummary.roleFingerprint === rolesBefore051,
  JSON.stringify(cleanAccessSummary));

const roadRunId = Number(accessDb.raw.prepare(
  "SELECT movement_id FROM movement WHERE name = 'Road Run'",
).get().movement_id);
accessDb.raw.prepare(`INSERT INTO movement_prior_experience
  (movement_id, confirmed_at_ms, revoked_at_ms, basis) VALUES (?, 100, NULL, 'local_user_confirmation')`).run(roadRunId);
accessDb.executeSync(MIGRATIONS[accessIndex]);
check('historical 051 replay is idempotent and preserves athlete declarations',
  Number(accessDb.raw.prepare('SELECT COUNT(*) AS c FROM movement_sport_tracking').get().c) === 3
    && Number(accessDb.raw.prepare(
      'SELECT confirmed_at_ms FROM movement_prior_experience WHERE movement_id = ?',
    ).get(roadRunId).confirmed_at_ms) === 100);

let accessConstraintRejections = 0;
for (const sql of [
  `INSERT INTO movement_prior_experience (movement_id, confirmed_at_ms, basis) VALUES (${roadRunId}, 1, 'other')`,
  `INSERT INTO movement_prior_experience (movement_id, confirmed_at_ms, revoked_at_ms) VALUES (${roadRunId + 1}, 10, 9)`,
  `INSERT INTO movement_prior_experience (movement_id, confirmed_at_ms) VALUES (999999, 1)`,
  `INSERT INTO movement_sport_tracking (movement_id) VALUES (999999)`,
]) {
  try { accessDb.executeSync(sql); } catch { accessConstraintRejections += 1; }
}
check('051 STRICT/CHECK/PK/FK surface rejects invalid basis, time ordering, and unknown movements',
  accessConstraintRejections === 4, `${accessConstraintRejections}/4`);

const poisonedAccess = freshDb();
for (let i = 0; i < accessIndex; i += 1) poisonedAccess.executeSync(MIGRATIONS[i]);
poisonedAccess.executeSync(`PRAGMA user_version = ${MIGRATIONS.length};`);
check('051 poison precondition claims completion while both access sentinels are absent',
  sentinelsMissing(poisonedAccess).includes('movement_prior_experience')
    && sentinelsMissing(poisonedAccess).includes('movement_sport_tracking'));
runMigrations(poisonedAccess, MIGRATIONS);
check('051 poison repair converges on the current exact state through 052',
  sentinelsMissing(poisonedAccess).length === 0
    && JSON.stringify(accessSummary(poisonedAccess)) === JSON.stringify(accessSummary(a)),
  JSON.stringify(accessSummary(poisonedAccess)));

// --- 2n. 052 bounded microcycle roles ---------------------------------------
console.log('[2n] 052 bounded microcycle roles');
const boundedIndex = FILES.indexOf('052_bounded_microcycle_roles.sql');
const boundedDb = freshDb();
for (let i = 0; i < boundedIndex; i += 1) boundedDb.executeSync(MIGRATIONS[i]);
boundedDb.executeSync(`PRAGMA user_version = ${boundedIndex};`);
boundedDb.executeSync("INSERT INTO routine_template (name, schema_type, created_at_ms, updated_at_ms) VALUES ('052 preserved', 'LINEAR', 1, 1)");
const preservedTemplateId = Number(boundedDb.raw.prepare('SELECT last_insert_rowid() AS id').get().id);
const competitionBenchId = Number(boundedDb.raw.prepare(
  "SELECT movement_id FROM movement WHERE name = 'Competition Bench'",
).get().movement_id);
const boardPress052Id = Number(boundedDb.raw.prepare(
  "SELECT movement_id FROM movement WHERE name = 'Board Press'",
).get().movement_id);
const hammerCurlId = Number(boundedDb.raw.prepare(
  "SELECT movement_id FROM movement WHERE name = 'Hammer Curl'",
).get().movement_id);
boundedDb.raw.prepare(`INSERT INTO routine_template_slot
  (routine_template_id, day_index, slot_index, role, movement_id, sets, reps, target_rpe)
  VALUES (?, 1, 1, 'major', ?, 3, 7, 8.5)`).run(preservedTemplateId, competitionBenchId);
const preservedRoutineSlotId = Number(boundedDb.raw.prepare('SELECT last_insert_rowid() AS id').get().id);

runMigrations(boundedDb, MIGRATIONS);
const boundedSummary = (database) => ({
  liftFamilies: Number(database.raw.prepare('SELECT COUNT(*) AS c FROM movement_lift_family').get().c),
  namedFamilies: Number(database.raw.prepare('SELECT COUNT(DISTINCT family) AS c FROM movement_lift_family').get().c),
  assistance: Number(database.raw.prepare('SELECT COUNT(*) AS c FROM movement_assistance_relationship').get().c),
  roles: roleCounts(database),
  oldAutoTrigger: database.raw.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='trg_movement_supplementary_ai'",
  ).get() !== undefined,
});
check('clean 051 -> 052 upgrade installs the exact curated family/relationship and multi-role surface',
  uv(boundedDb) === MIGRATIONS.length
    && boundedSummary(boundedDb).liftFamilies === 79
    && boundedSummary(boundedDb).namedFamilies === 7
    && boundedSummary(boundedDb).assistance === 54
    && boundedSummary(boundedDb).roles.supplementary === 84
    && boundedSummary(boundedDb).roles.major === 79
    && boundedSummary(boundedDb).roles.accessory === 14
    && boundedSummary(boundedDb).roles.conditional === 12
    && !boundedSummary(boundedDb).oldAutoTrigger,
  JSON.stringify(boundedSummary(boundedDb)));

const benchCoefficients = boundedDb.raw.prepare(`
  SELECT group_concat(name || ':' || printf('%.2f', stress_coefficient), '|') AS value
  FROM (
    SELECT m.name, lf.stress_coefficient FROM movement_lift_family lf
    JOIN movement m USING (movement_id)
    WHERE m.name IN ('Competition Bench', 'Board Press') ORDER BY m.name
  )
`).get().value;
check('052 ratifies weighted same-family bench variations without using the capability graph',
  benchCoefficients === 'Board Press:0.90|Competition Bench:1.00', String(benchCoefficients));
const hammerContext = boundedDb.raw.prepare(`
  SELECT group_concat(major_family || ':' || distance, '|') AS value FROM (
    SELECT ar.major_family, ar.distance FROM movement_assistance_relationship ar
    WHERE ar.movement_id = ? ORDER BY ar.major_family
  )
`).get(hammerCurlId).value;
check('052 classifies Hammer Curl contextually: direct after pulls, accessory after other major families',
  hammerContext === 'bench_press:2|deadlift:2|horizontal_pull:1|overhead_press:2|power_clean:2|squat:2|vertical_pull:1',
  String(hammerContext));
check('052 table rebuild preserves existing routine slot identity and authored dose',
  JSON.stringify(boundedDb.raw.prepare(`
    SELECT routine_template_slot_id, role, movement_id, sets, reps, target_rpe
    FROM routine_template_slot WHERE routine_template_slot_id = ?
  `).get(preservedRoutineSlotId)) === JSON.stringify({
    routine_template_slot_id: preservedRoutineSlotId, role: 'major', movement_id: competitionBenchId,
    sets: 3, reps: 7, target_rpe: 8.5,
  }));

boundedDb.raw.prepare(`INSERT INTO routine_template_slot
  (routine_template_id, day_index, slot_index, role, movement_id, sets, reps, target_rpe)
  VALUES (?, 1, 7, 'major', ?, 2, 6, 8.0)`).run(preservedTemplateId, boardPress052Id);
boundedDb.raw.prepare(`INSERT INTO routine_template_slot
  (routine_template_id, day_index, slot_index, role, movement_id, sets, reps, target_rpe)
  VALUES (?, 1, 8, 'accessory', ?, 2, 12, 6.5)`).run(preservedTemplateId, hammerCurlId);
check('052 routine slots accept multiple same-day majors and positions beyond the old six-slot ceiling',
  Number(boundedDb.raw.prepare(`
    SELECT COUNT(*) AS c FROM routine_template_slot
    WHERE routine_template_id = ? AND day_index = 1 AND role = 'major'
  `).get(preservedTemplateId).c) === 2
    && Number(boundedDb.raw.prepare(`
      SELECT MAX(slot_index) AS n FROM routine_template_slot WHERE routine_template_id = ?
    `).get(preservedTemplateId).n) === 8);

boundedDb.executeSync("INSERT INTO training_block (start_date, objective, created_at_ms) VALUES ('2035-01-01', 'strength', 1)");
const boundedBlockId = Number(boundedDb.raw.prepare('SELECT last_insert_rowid() AS id').get().id);
boundedDb.raw.prepare(`INSERT INTO planned_session
  (block_id, week_index, day_index, focus, phase, session_date)
  VALUES (?, 1, 1, 'full', 'accumulation', '2035-01-01')`).run(boundedBlockId);
const boundedSessionId = Number(boundedDb.raw.prepare('SELECT last_insert_rowid() AS id').get().id);
boundedDb.raw.prepare(`INSERT INTO planned_slot
  (planned_session_id, slot_index, movement_id, sets, reps, target_rpe)
  VALUES (?, 1, ?, 2, 6, 8.0)`).run(boundedSessionId, boardPress052Id);
const boundedPlannedSlotId = Number(boundedDb.raw.prepare('SELECT last_insert_rowid() AS id').get().id);
const boundedFamilyDecisionJson = JSON.stringify([{
  family: 'bench_press', exposureCount: 1, variationCount: 1,
  equivalentVolume: 10.8, initialStress: 9.5, finalStress: 9.5,
  weeklyBudget: 100, level: 'low', purposes: ['heavy'], adaptations: [],
  sessions: [{
    dayIndex: 1, exposureCount: 1, variationCount: 1,
    equivalentVolume: 10.8, initialStress: 9.5, finalStress: 9.5,
    budget: 48, level: 'low',
  }],
}]);
boundedDb.raw.prepare(`INSERT INTO planned_session_routine_context
  (planned_session_id, routine_day_index, family_decisions_json, warnings_json,
   recommendations_json, adaptations_json) VALUES (?, 1, ?, '[]', '[]', '[]')`
).run(boundedSessionId, boundedFamilyDecisionJson);
boundedDb.raw.prepare(`INSERT INTO planned_slot_routine_decision
  (planned_slot_id, role, lift_family, stress_purpose, stress_coefficient,
   equivalent_volume, stress_dose, adaptations_json)
  VALUES (?, 'major', 'bench_press', 'heavy', 0.9, 10.8, 9.5, '[]')`).run(boundedPlannedSlotId);
check('052 frozen session and slot stress decisions round-trip as athlete-local side-cars',
  boundedDb.raw.prepare(`
    SELECT routine_day_index FROM planned_session_routine_context WHERE planned_session_id = ?
  `).get(boundedSessionId).routine_day_index === 1
    && boundedDb.raw.prepare(`
      SELECT lift_family, stress_coefficient, equivalent_volume
      FROM planned_slot_routine_decision WHERE planned_slot_id = ?
    `).get(boundedPlannedSlotId).lift_family === 'bench_press');

let boundedConstraintRejections = 0;
for (const sql of [
  `UPDATE movement_lift_family SET stress_coefficient = 2 WHERE movement_id = ${boardPress052Id}`,
  `UPDATE movement_assistance_relationship SET distance = 4 WHERE movement_id = ${hammerCurlId} AND major_family = 'bench_press'`,
  `UPDATE routine_template_slot SET role = 'other' WHERE routine_template_slot_id = ${preservedRoutineSlotId}`,
  `UPDATE planned_session_routine_context SET warnings_json = 'not-json' WHERE planned_session_id = ${boundedSessionId}`,
  `UPDATE planned_session_routine_context SET warnings_json = '{}' WHERE planned_session_id = ${boundedSessionId}`,
  `UPDATE planned_session_routine_context SET family_decisions_json = '[]' WHERE planned_session_id = ${boundedSessionId}`,
  `UPDATE planned_slot_routine_decision SET role = 'supplementary' WHERE planned_slot_id = ${boundedPlannedSlotId}`,
  "INSERT INTO movement_lift_family (movement_id, family, stress_coefficient) VALUES (999999, 'squat', 1)",
]) {
  try { boundedDb.executeSync(sql); } catch { boundedConstraintRejections += 1; }
}
check('052 STRICT/CHECK/FK surface rejects invalid stress, distance, roles, JSON shape, decision shape, and movement FK',
  boundedConstraintRejections === 8, `${boundedConstraintRejections}/8`);

boundedDb.executeSync("INSERT INTO movement (name, pattern, is_compound) VALUES ('052 Future Movement', 'isolation', 0)");
const future052Id = Number(boundedDb.raw.prepare('SELECT last_insert_rowid() AS id').get().id);
check('052 fails future movement roles closed until a curator adds a relationship',
  Number(boundedDb.raw.prepare(
    'SELECT COUNT(*) AS c FROM movement_role_eligibility WHERE movement_id = ?',
  ).get(future052Id).c) === 0);
boundedDb.executeSync(`PRAGMA user_version = ${boundedIndex};`);
runMigrations(boundedDb, MIGRATIONS);
check('052 replay is idempotent and preserves routine and frozen stress data',
  uv(boundedDb) === MIGRATIONS.length
    && Number(boundedDb.raw.prepare(
      'SELECT COUNT(*) AS c FROM routine_template_slot WHERE routine_template_id = ?',
    ).get(preservedTemplateId).c) === 3
    && Number(boundedDb.raw.prepare(
      'SELECT COUNT(*) AS c FROM planned_slot_routine_decision WHERE planned_slot_id = ?',
    ).get(boundedPlannedSlotId).c) === 1);

const poisonedBounded = freshDb();
for (let i = 0; i < boundedIndex; i += 1) poisonedBounded.executeSync(MIGRATIONS[i]);
poisonedBounded.executeSync(`PRAGMA user_version = ${MIGRATIONS.length};`);
check('052 poison precondition claims completion while all four current sentinels are absent',
  ['movement_lift_family', 'movement_assistance_relationship',
    'planned_session_routine_context', 'planned_slot_routine_decision']
    .every((name) => sentinelsMissing(poisonedBounded).includes(name)));
runMigrations(poisonedBounded, MIGRATIONS);
check('052 poison repair converges on the curated structural contract',
  sentinelsMissing(poisonedBounded).length === 0
    && JSON.stringify(boundedSummary(poisonedBounded)) === JSON.stringify(boundedSummary(a)),
  JSON.stringify(boundedSummary(poisonedBounded)));

// --- 2o. 053 exact legacy routine-role compatibility -----------------------
console.log('[2o] 053 exact legacy routine-role compatibility');
const compatibilityIndex = FILES.indexOf('053_routine_role_compatibility.sql');
const compatibilityDb = freshDb();
for (let i = 0; i < boundedIndex; i += 1) compatibilityDb.executeSync(MIGRATIONS[i]);
compatibilityDb.executeSync("INSERT INTO routine_template (name, schema_type, created_at_ms, updated_at_ms) VALUES ('pre-052 compatibility', 'LINEAR', 1, 1)");
const compatibilityTemplateId = Number(
  compatibilityDb.raw.prepare('SELECT last_insert_rowid() AS id').get().id,
);
const compatibilityMovementId = (name) => Number(compatibilityDb.raw.prepare(
  'SELECT movement_id FROM movement WHERE name = ?',
).get(name).movement_id);
const compatibilityBenchId = compatibilityMovementId('Competition Bench');
const compatibilitySitUpId = compatibilityMovementId('3/4 Sit-Up');
const compatibilityDbBenchId = compatibilityMovementId('Dumbbell Bench Press');
for (const slot of [
  [1, 'major', compatibilityBenchId, 3, 5, 8],
  [2, 'supplementary', compatibilitySitUpId, 2, 10, 6],
  [3, 'supplementary', compatibilityDbBenchId, 3, 8, 7],
]) {
  compatibilityDb.raw.prepare(`INSERT INTO routine_template_slot
    (routine_template_id, day_index, slot_index, role, movement_id, sets, reps, target_rpe)
    VALUES (?, 1, ?, ?, ?, ?, ?, ?)`
  ).run(compatibilityTemplateId, ...slot);
}

// Apply 052, then create an already-frozen reviewed session before 053. The
// append-only migration must snapshot the exact compatibility marker in-place.
compatibilityDb.executeSync(MIGRATIONS[boundedIndex]);
compatibilityDb.executeSync(`PRAGMA user_version = ${compatibilityIndex};`);
compatibilityDb.executeSync("INSERT INTO training_block (start_date, objective, created_at_ms) VALUES ('2036-01-01', 'strength', 1)");
const compatibilityBlockId = Number(
  compatibilityDb.raw.prepare('SELECT last_insert_rowid() AS id').get().id,
);
compatibilityDb.raw.prepare(`INSERT INTO planned_session
  (block_id, week_index, day_index, focus, phase, session_date)
  VALUES (?, 1, 1, 'full', 'accumulation', '2036-01-01')`).run(compatibilityBlockId);
const compatibilitySessionId = Number(
  compatibilityDb.raw.prepare('SELECT last_insert_rowid() AS id').get().id,
);
compatibilityDb.raw.prepare(`INSERT INTO planned_session_method
  (planned_session_id, schema_type, routine_template_id, template_name, frozen_at_ms)
  VALUES (?, 'LINEAR', ?, 'pre-052 compatibility', 1)`
).run(compatibilitySessionId, compatibilityTemplateId);
compatibilityDb.raw.prepare(`INSERT INTO planned_session_routine_context
  (planned_session_id, routine_day_index, family_decisions_json, warnings_json,
   recommendations_json, adaptations_json) VALUES (?, 1, ?, '[]', '[]', '[]')`
).run(compatibilitySessionId, boundedFamilyDecisionJson);
compatibilityDb.raw.prepare(`INSERT INTO planned_slot
  (planned_session_id, slot_index, movement_id, sets, reps, target_rpe)
  VALUES (?, 1, ?, 3, 5, 8)`).run(compatibilitySessionId, compatibilityBenchId);
const compatibilityMajorSlotId = Number(
  compatibilityDb.raw.prepare('SELECT last_insert_rowid() AS id').get().id,
);
compatibilityDb.raw.prepare(`INSERT INTO planned_slot_routine_decision
  (planned_slot_id, role, lift_family, stress_purpose, stress_coefficient,
   equivalent_volume, stress_dose, adaptations_json)
  VALUES (?, 'major', 'bench_press', 'heavy', 1, 15, 14.2, '[]')`
).run(compatibilityMajorSlotId);
compatibilityDb.raw.prepare(`INSERT INTO planned_slot
  (planned_session_id, slot_index, movement_id, sets, reps, target_rpe)
  VALUES (?, 2, ?, 2, 10, 6)`).run(compatibilitySessionId, compatibilitySitUpId);
const compatibilitySupportSlotId = Number(
  compatibilityDb.raw.prepare('SELECT last_insert_rowid() AS id').get().id,
);
compatibilityDb.raw.prepare(`INSERT INTO planned_slot_routine_decision
  (planned_slot_id, role, lift_family, stress_purpose, stress_coefficient,
   equivalent_volume, stress_dose, adaptations_json)
  VALUES (?, 'supplementary', NULL, NULL, 0, 0, 0, '[]')`
).run(compatibilitySupportSlotId);

runMigrations(compatibilityDb, MIGRATIONS);
const compatibilityAllowanceRows = compatibilityDb.raw.prepare(`
  SELECT day_index, movement_id, role
  FROM routine_template_legacy_role_allowance
  WHERE routine_template_id = ? ORDER BY day_index, movement_id
`).all(compatibilityTemplateId);
check('053 upgrade backfills only the exact unrelated supplementary slot',
  JSON.stringify(compatibilityAllowanceRows) === JSON.stringify([{
    day_index: 1, movement_id: compatibilitySitUpId, role: 'supplementary',
  }])
    && Number(compatibilityDb.raw.prepare(
      'SELECT COUNT(*) AS c FROM routine_template_slot WHERE routine_template_id = ?',
    ).get(compatibilityTemplateId).c) === 3,
  JSON.stringify(compatibilityAllowanceRows));
check('053 does not broaden global roles or grandfather current same-family work',
  JSON.stringify(roleCounts(compatibilityDb)) === JSON.stringify(roleCounts(a))
    && Number(compatibilityDb.raw.prepare(
      'SELECT COUNT(*) AS c FROM movement_role_eligibility WHERE movement_id = ?',
    ).get(compatibilitySitUpId).c) === 0
    && !compatibilityAllowanceRows.some((row) => Number(row.movement_id) === compatibilityDbBenchId),
  JSON.stringify(roleCounts(compatibilityDb)));
check('053 snapshots an existing frozen legacy slot during upgrade',
  compatibilityDb.raw.prepare(`
    SELECT role FROM planned_slot_legacy_role_allowance WHERE planned_slot_id = ?
  `).get(compatibilitySupportSlotId)?.role === 'supplementary');

let compatibilityConstraintRejections = 0;
for (const [sql, params] of [
  [`INSERT INTO routine_template_legacy_role_allowance
      (routine_template_id, day_index, movement_id, role) VALUES (?, 1, ?, 'major')`,
    [compatibilityTemplateId, compatibilitySitUpId]],
  [`INSERT INTO routine_template_legacy_role_allowance
      (routine_template_id, day_index, movement_id, role) VALUES (?, 8, ?, 'supplementary')`,
    [compatibilityTemplateId, compatibilitySitUpId]],
  [`INSERT INTO routine_template_legacy_role_allowance
      (routine_template_id, day_index, movement_id, role) VALUES (?, 1, 999999, 'supplementary')`,
    [compatibilityTemplateId]],
  [`INSERT INTO planned_slot_legacy_role_allowance (planned_slot_id, role) VALUES (?, 'major')`,
    [compatibilityMajorSlotId]],
  [`INSERT INTO planned_slot_legacy_role_allowance (planned_slot_id, role) VALUES (999999, 'supplementary')`,
    []],
]) {
  try { compatibilityDb.raw.prepare(sql).run(...params); } catch { compatibilityConstraintRejections += 1; }
}
const compatibilityStrict = compatibilityDb.raw.prepare(`
  SELECT name, strict FROM pragma_table_list
  WHERE name IN ('routine_template_legacy_role_allowance', 'planned_slot_legacy_role_allowance')
  ORDER BY name
`).all();
check('053 tables are STRICT and reject wrong roles, days, and foreign keys',
  compatibilityConstraintRejections === 5
    && compatibilityStrict.length === 2
    && compatibilityStrict.every((row) => Number(row.strict) === 1),
  `${compatibilityConstraintRejections}/5 ${JSON.stringify(compatibilityStrict)}`);

compatibilityDb.executeSync(`PRAGMA user_version = ${compatibilityIndex};`);
runMigrations(compatibilityDb, MIGRATIONS);
check('053 replay is idempotent and preserves exact template and frozen allowances',
  Number(compatibilityDb.raw.prepare(
    'SELECT COUNT(*) AS c FROM routine_template_legacy_role_allowance WHERE routine_template_id = ?',
  ).get(compatibilityTemplateId).c) === 1
    && Number(compatibilityDb.raw.prepare(
      'SELECT COUNT(*) AS c FROM planned_slot_legacy_role_allowance WHERE planned_slot_id = ?',
    ).get(compatibilitySupportSlotId).c) === 1);

compatibilityDb.raw.prepare('DELETE FROM routine_template WHERE routine_template_id = ?')
  .run(compatibilityTemplateId);
check('053 frozen allowance survives source-template deletion',
  compatibilityDb.raw.prepare(`
    SELECT role FROM planned_slot_legacy_role_allowance WHERE planned_slot_id = ?
  `).get(compatibilitySupportSlotId)?.role === 'supplementary'
    && compatibilityDb.raw.prepare(`
      SELECT routine_template_id FROM planned_session_method WHERE planned_session_id = ?
    `).get(compatibilitySessionId)?.routine_template_id === null);

const poisonedCompatibility = freshDb();
runMigrations(poisonedCompatibility, MIGRATIONS);
poisonedCompatibility.executeSync('DROP TABLE planned_slot_legacy_role_allowance');
poisonedCompatibility.executeSync('DROP TABLE routine_template_legacy_role_allowance');
poisonedCompatibility.executeSync(`PRAGMA user_version = ${MIGRATIONS.length};`);
check('053 poison precondition claims completion while both compatibility sentinels are absent',
  ['routine_template_legacy_role_allowance', 'planned_slot_legacy_role_allowance']
    .every((name) => sentinelsMissing(poisonedCompatibility).includes(name)));
runMigrations(poisonedCompatibility, MIGRATIONS);
check('053 poison repair restores both exact compatibility tables',
  sentinelsMissing(poisonedCompatibility).length === 0
    && poisonedCompatibility.raw.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'routine_template_legacy_role_allowance'",
    ).get() !== undefined
    && poisonedCompatibility.raw.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'planned_slot_legacy_role_allowance'",
    ).get() !== undefined);

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
