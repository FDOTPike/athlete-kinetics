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
const { runMigrations, sentinelsMissing, SENTINELS, DURABLE_TABLE_EXEMPTIONS } = require('./.build/migrationRunner.js');

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
  '053_routine_role_compatibility.sql',
  '054_contract_cutoff_provenance.sql',
  '055_return_checkin_ack.sql',
  '056_movement_taxonomy_backfill.sql',
  '057_block_meta_phase_invariant.sql',
  '058_suspension_episode.sql', '059_suspension_state_and_load_intent.sql',
  '060_program_goal_tier_alignment.sql',
  '061_autopilot_attribution_convergence.sql',
  '062_suspension_sidecar_immutability.sql',
  '063_movement_load_intent.sql'];
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

// W5 item 8: 004 is runtime SQL, not a version-gated migration. A latest-version
// install with an old ACWR-derived row must converge when boot materializes it.
const readRecovery = () => a.raw.prepare(
  "SELECT readiness_score, acwr, load_component FROM state_vector WHERE date = '2030-01-01'",
).get();
const freshRecovery = readRecovery();
check('runtime readiness keeps ACWR as context, with neutral recovery when HRV/sleep are absent',
  freshRecovery.readiness_score === 50 && freshRecovery.acwr === 4 && freshRecovery.load_component === 0,
  JSON.stringify(freshRecovery));
a.raw.exec("UPDATE state_vector SET readiness_score = 0 WHERE date = '2030-01-01'");
const versionBeforeRefresh = uv(a);
runMigrations(a, MIGRATIONS); // already latest: no migration runs
check('a no-op migration boot does not itself rewrite an old readiness snapshot',
  uv(a) === versionBeforeRefresh && readRecovery().readiness_score === 0);
a.raw.prepare(MATERIALIZE_SQL).run('2030-01-01'); // same runtime upsert as boot
check('existing and fresh installs converge without advancing user_version',
  uv(a) === versionBeforeRefresh && JSON.stringify(readRecovery()) === JSON.stringify(freshRecovery),
  JSON.stringify(readRecovery()));
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

// --- 2p. 054 exact contract-cutoff provenance ---------------------------------
// Migration 053 is shipped and its backfill re-derives from LIVE family and
// assistance rows on every self-heal. 054 bounds that re-derivation to
// templates authored before the contract (the first-run watermark), so a
// future curation change that removes or re-parents a relationship row can
// never grandfather a post-contract template. This block pins the required
// adversarial coverage: (1) exact 053 allowances survive upgrade + replay,
// (2) a post-contract template does NOT become legacy after its relationship
// is removed and the full chain self-heals, (3) poisoned provenance (a
// missing or over-reached marker) fails closed and grants nothing.
console.log('[2p] 054 exact contract-cutoff provenance');
const cutoffIndex = FILES.indexOf('054_contract_cutoff_provenance.sql');
const cutoffDb = freshDb();
// Land the contract the way the eventual release does: an install that never
// saw 053 upgrades through 053 + 054 in one batch.
for (let i = 0; i < boundedIndex; i += 1) cutoffDb.executeSync(MIGRATIONS[i]);
cutoffDb.executeSync(MIGRATIONS[boundedIndex]); // 052: curated families, assistance, frozen-decision side-cars
const cutoffMovementId = (name) => Number(cutoffDb.raw.prepare(
  'SELECT movement_id FROM movement WHERE name = ?',
).get(name).movement_id);
const cutoffBenchId = cutoffMovementId('Competition Bench');
const cutoffSitUpId = cutoffMovementId('3/4 Sit-Up');
const cutoffDbBenchId = cutoffMovementId('Dumbbell Bench Press');

// A pre-contract template: one unrelated supplementary slot (053 grandfathers
// it) plus one same-family supplementary slot (valid today, never marked).
cutoffDb.raw.prepare(`INSERT INTO routine_template
  (name, schema_type, created_at_ms, updated_at_ms) VALUES ('pre-contract cutoff', 'LINEAR', 1, 1)`).run();
const cutoffPreTemplateId = Number(cutoffDb.raw.prepare('SELECT last_insert_rowid() AS id').get().id);
for (const slot of [
  [1, 'major', cutoffBenchId, 3, 5, 8],
  [2, 'supplementary', cutoffSitUpId, 2, 10, 6],
  [3, 'supplementary', cutoffDbBenchId, 3, 8, 7],
]) {
  cutoffDb.raw.prepare(`INSERT INTO routine_template_slot
    (routine_template_id, day_index, slot_index, role, movement_id, sets, reps, target_rpe)
    VALUES (?, 1, ?, ?, ?, ?, ?, ?)`).run(cutoffPreTemplateId, ...slot);
}
cutoffDb.executeSync(MIGRATIONS[compatibilityIndex]); // 053 backfills the Sit-Up allowance
cutoffDb.executeSync(MIGRATIONS[cutoffIndex]);        // 054 captures the watermark, prunes nothing
const cutoffWatermark = () => Number(cutoffDb.raw.prepare(
  'SELECT cutoff_template_id FROM routine_template_contract_cutoff WHERE capture_epoch = 1',
).get().cutoff_template_id);
const cutoffPreAllowances = (templateId) => cutoffDb.raw.prepare(
  'SELECT day_index, movement_id, role FROM routine_template_legacy_role_allowance WHERE routine_template_id = ? ORDER BY movement_id',
).all(templateId);
check('054 upgrade captures the pre-contract watermark exactly',
  cutoffWatermark() === cutoffPreTemplateId, String(cutoffWatermark()));
check('054 preserves every exact 053 allowance on the upgrade path',
  JSON.stringify(cutoffPreAllowances(cutoffPreTemplateId)) === JSON.stringify([
    { day_index: 1, movement_id: cutoffSitUpId, role: 'supplementary' },
  ]), JSON.stringify(cutoffPreAllowances(cutoffPreTemplateId)));

// A template authored AFTER the contract (id above the watermark).
cutoffDb.raw.prepare(`INSERT INTO routine_template
  (name, schema_type, created_at_ms, updated_at_ms) VALUES ('post-contract cutoff', 'LINEAR', 1, 1)`).run();
const cutoffPostTemplateId = Number(cutoffDb.raw.prepare('SELECT last_insert_rowid() AS id').get().id);
for (const slot of [
  [1, 'major', cutoffBenchId, 3, 5, 8],
  [2, 'supplementary', cutoffDbBenchId, 3, 8, 7],
]) {
  cutoffDb.raw.prepare(`INSERT INTO routine_template_slot
    (routine_template_id, day_index, slot_index, role, movement_id, sets, reps, target_rpe)
    VALUES (?, 1, ?, ?, ?, ?, ?, ?)`).run(cutoffPostTemplateId, ...slot);
}
check('the post-contract supplementary slot is justified under the contract and carries no allowance',
  Number(cutoffDb.raw.prepare(
    'SELECT COUNT(*) AS c FROM routine_template_legacy_role_allowance WHERE routine_template_id = ?',
  ).get(cutoffPostTemplateId).c) === 0);

// Freeze an executable day from each template BEFORE the heal, exactly as the
// store would, so a full self-heal has frozen slots it could contaminate.
const cutoffFrozenSession = (templateId) => {
  cutoffDb.executeSync("INSERT INTO training_block (start_date, objective, created_at_ms) VALUES ('2037-01-01', 'strength', 1)");
  const blockId = Number(cutoffDb.raw.prepare('SELECT last_insert_rowid() AS id').get().id);
  cutoffDb.raw.prepare(`INSERT INTO planned_session
    (block_id, week_index, day_index, focus, phase, session_date)
    VALUES (?, 1, 1, 'full', 'accumulation', '2037-01-01')`).run(blockId);
  const sessionId = Number(cutoffDb.raw.prepare('SELECT last_insert_rowid() AS id').get().id);
  cutoffDb.raw.prepare(`INSERT INTO planned_session_method
    (planned_session_id, schema_type, routine_template_id, template_name, frozen_at_ms)
    VALUES (?, 'LINEAR', ?, 'cutoff freeze', 1)`).run(sessionId, templateId);
  cutoffDb.raw.prepare(`INSERT INTO planned_session_routine_context
    (planned_session_id, routine_day_index, family_decisions_json, warnings_json,
     recommendations_json, adaptations_json)
    VALUES (?, 1, ?, '[]', '[]', '[]')`).run(sessionId, boundedFamilyDecisionJson);
  const slotIds = [];
  for (const [slotIndex, movementId] of [[1, cutoffBenchId], [2, cutoffSitUpId], [2, cutoffDbBenchId]]) {
    if (slotIndex === 2 && movementId === cutoffSitUpId && templateId !== cutoffPreTemplateId) continue;
    if (slotIndex === 2 && movementId === cutoffDbBenchId && templateId !== cutoffPostTemplateId) continue;
    cutoffDb.raw.prepare(`INSERT INTO planned_slot
      (planned_session_id, slot_index, movement_id, sets, reps, target_rpe)
      VALUES (?, ?, ?, 3, 5, 8)`).run(sessionId, slotIndex, movementId);
    const plannedSlotId = Number(cutoffDb.raw.prepare('SELECT last_insert_rowid() AS id').get().id);
    const isMajor = movementId === cutoffBenchId;
    cutoffDb.raw.prepare(`INSERT INTO planned_slot_routine_decision
      (planned_slot_id, role, lift_family, stress_purpose, stress_coefficient,
       equivalent_volume, stress_dose, adaptations_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        plannedSlotId, isMajor ? 'major' : 'supplementary',
        isMajor ? 'bench_press' : null,
        isMajor ? 'heavy' : null,
        isMajor ? 1 : 0,
        isMajor ? 15 : 0,
        isMajor ? 14.2 : 0,
        '[]');
    slotIds.push({ plannedSlotId, movementId });
  }
  return { sessionId, slotIds };
};
cutoffFrozenSession(cutoffPreTemplateId);   // Sit-Up supplementary slot
cutoffFrozenSession(cutoffPostTemplateId);  // Dumbbell Bench Press supplementary slot
check('pre-heal: no frozen legacy marker exists for either frozen day',
  Number(cutoffDb.raw.prepare('SELECT COUNT(*) AS c FROM planned_slot_legacy_role_allowance').get().c) === 0);

// A future curation migration re-parents Dumbbell Bench Press out of the bench
// family. Re-parenting via UPDATE survives a full heal (052's INSERT OR IGNORE
// seed never overwrites the existing row), so 053's next backfill sees the
// db-bench slot as unjustified and re-derives an allowance for BOTH templates;
// 054 must keep the pre-contract one (authored before the contract) and prune
// the post-contract one.
cutoffDb.raw.prepare("UPDATE movement_lift_family SET family = 'deadlift' WHERE movement_id = ?").run(cutoffDbBenchId);
check('precondition: re-parenting removes the bench-family membership of the db-bench movement',
  Number(cutoffDb.raw.prepare(
    "SELECT COUNT(*) AS c FROM movement_lift_family WHERE movement_id = ? AND family = 'bench_press'",
  ).get(cutoffDbBenchId).c) === 0
    && Number(cutoffDb.raw.prepare(
      "SELECT COUNT(*) AS c FROM movement_lift_family WHERE movement_id = ? AND family = 'deadlift'",
    ).get(cutoffDbBenchId).c) === 1);
cutoffDb.executeSync('DROP TABLE planned_slot_legacy_role_allowance');
cutoffDb.executeSync('DROP TABLE routine_template_legacy_role_allowance');
check('precondition: full self-heal is armed by missing 053 sentinels',
  sentinelsMissing(cutoffDb).includes('routine_template_legacy_role_allowance')
    && sentinelsMissing(cutoffDb).includes('planned_slot_legacy_role_allowance'));
runMigrations(cutoffDb, MIGRATIONS);

check('full self-heal restores every sentinel and preserves the original watermark',
  sentinelsMissing(cutoffDb).length === 0
    && cutoffWatermark() === cutoffPreTemplateId, String(cutoffWatermark()));
check('pre-contract allowances survive a narrowed contract + full self-heal, including the newly re-derived slot',
  JSON.stringify(cutoffPreAllowances(cutoffPreTemplateId)) === JSON.stringify([
    { day_index: 1, movement_id: cutoffDbBenchId, role: 'supplementary' },
    { day_index: 1, movement_id: cutoffSitUpId, role: 'supplementary' },
  ]), JSON.stringify(cutoffPreAllowances(cutoffPreTemplateId)));
check('the post-contract template does NOT become legacy after its relationship is removed + full self-heal',
  Number(cutoffDb.raw.prepare(
    'SELECT COUNT(*) AS c FROM routine_template_legacy_role_allowance WHERE routine_template_id = ?',
  ).get(cutoffPostTemplateId).c) === 0);
check('the pre-contract frozen legacy marker is reconstructed and survives the heal',
  Number(cutoffDb.raw.prepare(`SELECT COUNT(*) AS c FROM planned_slot_legacy_role_allowance pla
    JOIN planned_slot ps USING (planned_slot_id)
    JOIN planned_session_method psm USING (planned_session_id)
    WHERE psm.routine_template_id = ?`).get(cutoffPreTemplateId).c) === 1);
check('the post-contract frozen marker reconstructed by the heal is pruned (poisoned provenance grants nothing)',
  Number(cutoffDb.raw.prepare(`SELECT COUNT(*) AS c FROM planned_slot_legacy_role_allowance pla
    JOIN planned_slot ps USING (planned_slot_id)
    JOIN planned_session_method psm USING (planned_session_id)
    WHERE psm.routine_template_id = ?`).get(cutoffPostTemplateId).c) === 0);
check('role counts and eligibility are untouched by the 054 prune',
  JSON.stringify(roleCounts(cutoffDb)) === JSON.stringify(roleCounts(a))
    && cutoffDb.raw.prepare(
      'SELECT COUNT(*) AS c FROM movement_role_eligibility WHERE movement_id = ? AND role = ?',
    ).get(cutoffDbBenchId, 'major').c === 1);

cutoffDb.executeSync(`PRAGMA user_version = ${cutoffIndex};`);
runMigrations(cutoffDb, MIGRATIONS);
check('054 replay is idempotent: watermark, allowances, and prunes are stable',
  cutoffWatermark() === cutoffPreTemplateId
    && cutoffPreAllowances(cutoffPreTemplateId).length === 2
    && Number(cutoffDb.raw.prepare(
      'SELECT COUNT(*) AS c FROM routine_template_legacy_role_allowance WHERE routine_template_id = ?',
    ).get(cutoffPostTemplateId).c) === 0
    && cutoffDb.raw.prepare(`SELECT COUNT(*) AS c FROM planned_slot_legacy_role_allowance pla
      JOIN planned_slot ps USING (planned_slot_id)
      JOIN planned_session_method psm USING (planned_session_id)
      WHERE psm.routine_template_id = ?`).get(cutoffPostTemplateId).c === 0,
  String(cutoffWatermark()));

let cutoffConstraintRejections = 0;
for (const sql of [
  'INSERT INTO routine_template_contract_cutoff (cutoff_template_id, capture_epoch) VALUES (1, 1)',
  'INSERT INTO routine_template_contract_cutoff (cutoff_template_id, capture_epoch) VALUES (-5, 2)',
  'INSERT INTO routine_template_contract_cutoff (cutoff_template_id, capture_epoch) VALUES (1.5, 1)',
  'UPDATE routine_template_contract_cutoff SET cutoff_template_id = 99 WHERE capture_epoch = 1',
  'DELETE FROM routine_template_contract_cutoff WHERE capture_epoch = 1',
]) {
  try { cutoffDb.executeSync(sql); } catch { cutoffConstraintRejections += 1; }
}
const cutoffTable = cutoffDb.raw.prepare(`
  SELECT strict, wr FROM pragma_table_list WHERE name = 'routine_template_contract_cutoff'
`).get();
check('054 cutoff is STRICT, WITHOUT ROWID, immutable, and rejects re-capture and bad watermarks',
  cutoffConstraintRejections === 5 && cutoffTable?.strict === 1 && cutoffTable?.wr === 1,
  `${cutoffConstraintRejections}/5 ${JSON.stringify(cutoffTable)}`);

// Poison of the cutoff marker itself must fail closed. A post-contract
// template already exists BEFORE the marker is lost; recapturing MAX(id)
// would silently classify it as pre-contract. The production runner instead
// commits cutoff zero before replay, including when an earlier replayed
// migration fails and the next boot must retry from that boundary.
console.log('[2p-b] 054 cutoff sentinel poison');
const cutoffPoison = freshDb();
runMigrations(cutoffPoison, MIGRATIONS);
check('fresh-install watermark is zero (no pre-contract templates exist)',
  Number(cutoffPoison.raw.prepare(
    'SELECT cutoff_template_id FROM routine_template_contract_cutoff WHERE capture_epoch = 1',
).get().cutoff_template_id) === 0);
const cutoffPoisonMovementId = (name) => Number(cutoffPoison.raw.prepare(
  'SELECT movement_id FROM movement WHERE name = ?',
).get(name).movement_id);
const cutoffPoisonBenchId = cutoffPoisonMovementId('Competition Bench');
const cutoffPoisonDbBenchId = cutoffPoisonMovementId('Dumbbell Bench Press');
cutoffPoison.raw.prepare(`INSERT INTO routine_template
  (name, schema_type, created_at_ms, updated_at_ms) VALUES ('pre-poison post-contract', 'LINEAR', 1, 1)`).run();
const cutoffPoisonTemplateId = Number(cutoffPoison.raw.prepare('SELECT last_insert_rowid() AS id').get().id);
for (const slot of [
  [1, 'major', cutoffPoisonBenchId, 3, 5, 8],
  [2, 'supplementary', cutoffPoisonDbBenchId, 3, 8, 7],
]) {
  cutoffPoison.raw.prepare(`INSERT INTO routine_template_slot
    (routine_template_id, day_index, slot_index, role, movement_id, sets, reps, target_rpe)
    VALUES (?, 1, ?, ?, ?, ?, ?, ?)`).run(cutoffPoisonTemplateId, ...slot);
}
cutoffPoison.raw.prepare("UPDATE movement_lift_family SET family = 'deadlift' WHERE movement_id = ?")
  .run(cutoffPoisonDbBenchId);
cutoffPoison.executeSync('DROP TABLE routine_template_contract_cutoff');
check('precondition: the cutoff sentinel is missing',
  sentinelsMissing(cutoffPoison).includes('routine_template_contract_cutoff'));
const brokenCutoffReplay = [
  `${MIGRATIONS[0]}\nSELECT no_such_cutoff_repair_fn(1);`,
  ...MIGRATIONS.slice(1),
];
let cutoffReplayThrew = false;
try { runMigrations(cutoffPoison, brokenCutoffReplay); } catch { cutoffReplayThrew = true; }
check('cutoff loss is persisted as zero before a failing full replay',
  cutoffReplayThrew
    && uv(cutoffPoison) === 0
    && Number(cutoffPoison.raw.prepare(
      'SELECT cutoff_template_id FROM routine_template_contract_cutoff WHERE capture_epoch = 1',
    ).get().cutoff_template_id) === 0);
runMigrations(cutoffPoison, MIGRATIONS);
check('cutoff poison retry restores every sentinel without recapturing MAX(id)',
  sentinelsMissing(cutoffPoison).length === 0
    && Number(cutoffPoison.raw.prepare(
      'SELECT cutoff_template_id FROM routine_template_contract_cutoff WHERE capture_epoch = 1',
    ).get().cutoff_template_id) === 0);
check('a template that existed before cutoff loss cannot become legacy after replay',
  Number(cutoffPoison.raw.prepare(
    'SELECT COUNT(*) AS c FROM routine_template_legacy_role_allowance WHERE routine_template_id = ?',
  ).get(cutoffPoisonTemplateId).c) === 0);

// The sentinel is row-aware as well as table-aware. Losing only the singleton
// row takes the same conservative repair path and cannot retain a fabricated
// post-contract allowance.
cutoffPoison.raw.prepare(`INSERT INTO routine_template_legacy_role_allowance
  (routine_template_id, day_index, movement_id, role) VALUES (?, 1, ?, 'supplementary')`)
  .run(cutoffPoisonTemplateId, cutoffPoisonDbBenchId);
cutoffPoison.executeSync('DROP TRIGGER trg_routine_template_contract_cutoff_bd');
cutoffPoison.executeSync('DELETE FROM routine_template_contract_cutoff');
check('precondition: a missing cutoff row is detected even while its table exists',
  sentinelsMissing(cutoffPoison).includes('routine_template_contract_cutoff'));
runMigrations(cutoffPoison, MIGRATIONS);
check('missing-row poison also restores cutoff zero and prunes fabricated access',
  sentinelsMissing(cutoffPoison).length === 0
    && Number(cutoffPoison.raw.prepare(
      'SELECT cutoff_template_id FROM routine_template_contract_cutoff WHERE capture_epoch = 1',
    ).get().cutoff_template_id) === 0
    && Number(cutoffPoison.raw.prepare(
      'SELECT COUNT(*) AS c FROM routine_template_legacy_role_allowance WHERE routine_template_id = ?',
    ).get(cutoffPoisonTemplateId).c) === 0);

// Losing an immutability guard is itself compromised provenance: the value may
// have been widened before boot. The runner conservatively resets it to zero.
cutoffPoison.executeSync('DROP TRIGGER trg_routine_template_contract_cutoff_bu');
cutoffPoison.executeSync(`UPDATE routine_template_contract_cutoff
  SET cutoff_template_id = ${cutoffPoisonTemplateId} WHERE capture_epoch = 1`);
cutoffPoison.raw.prepare(`INSERT INTO routine_template_legacy_role_allowance
  (routine_template_id, day_index, movement_id, role) VALUES (?, 1, ?, 'supplementary')`)
  .run(cutoffPoisonTemplateId, cutoffPoisonDbBenchId);
check('precondition: a missing update guard leaves detectably widened provenance',
  sentinelsMissing(cutoffPoison).includes('trg_routine_template_contract_cutoff_bu')
    && Number(cutoffPoison.raw.prepare(
      'SELECT cutoff_template_id FROM routine_template_contract_cutoff WHERE capture_epoch = 1',
    ).get().cutoff_template_id) === cutoffPoisonTemplateId);
runMigrations(cutoffPoison, MIGRATIONS);
check('guard poison resets cutoff zero, restores both guards, and prunes fabricated access',
  sentinelsMissing(cutoffPoison).length === 0
    && Number(cutoffPoison.raw.prepare(
      'SELECT cutoff_template_id FROM routine_template_contract_cutoff WHERE capture_epoch = 1',
    ).get().cutoff_template_id) === 0
    && Number(cutoffPoison.raw.prepare(
      'SELECT COUNT(*) AS c FROM routine_template_legacy_role_allowance WHERE routine_template_id = ?',
    ).get(cutoffPoisonTemplateId).c) === 0);

// --- 2q. 055 return_checkin_ack: poison heal, constraints, replay -------------
console.log('[2q] 055 return_checkin_ack');
{
  const ackPoison = freshDb();
  runMigrations(ackPoison, MIGRATIONS);
  ackPoison.executeSync('DROP TABLE return_checkin_ack');
  check('055 poison precondition: return_checkin_ack sentinel missing',
    sentinelsMissing(ackPoison).includes('return_checkin_ack'));
  runMigrations(ackPoison, MIGRATIONS);
  check('055 poison self-heal restores return_checkin_ack sentinel',
    sentinelsMissing(ackPoison).length === 0);

  // Check valid insertion and primary key deduplication
  ackPoison.raw.prepare(`
    INSERT INTO return_checkin_ack (last_qualifying_date, acknowledged_action, acknowledged_at_ms)
    VALUES ('2026-07-01', 'continue_plan', 1000)
  `).run();
  ackPoison.raw.prepare(`
    INSERT OR IGNORE INTO return_checkin_ack (last_qualifying_date, acknowledged_action, acknowledged_at_ms)
    VALUES ('2026-07-01', 'review_first_session', 2000)
  `).run();
  const row055 = ackPoison.raw.prepare("SELECT * FROM return_checkin_ack WHERE last_qualifying_date = '2026-07-01'").get();
  check('055 persists acknowledged_action correctly', row055.acknowledged_action === 'continue_plan');

  // Check CHECK constraints
  let invalidActionThrew = false;
  try {
    ackPoison.raw.prepare(`
      INSERT INTO return_checkin_ack (last_qualifying_date, acknowledged_action, acknowledged_at_ms)
      VALUES ('2026-07-02', 'unauthorized_dose_modifier', 3000)
    `).run();
  } catch {
    invalidActionThrew = true;
  }
  check('055 schema rejects unauthorized action values', invalidActionThrew);

  let invalidDateThrew = false;
  try {
    ackPoison.raw.prepare(`
      INSERT INTO return_checkin_ack (last_qualifying_date, acknowledged_action, acknowledged_at_ms)
      VALUES ('2026/07/02', 'continue_plan', 3000)
    `).run();
  } catch {
    invalidDateThrew = true;
  }
  check('055 schema rejects invalid date GLOB format', invalidDateThrew);
}

// --- 2r. 056 movement_taxonomy_backfill: coverage assertion ----------------
console.log('[2r] 056 movement_taxonomy_backfill');
{
  const db056 = freshDb();
  runMigrations(db056, MIGRATIONS);
  const missingTaxonomy = db056.raw.prepare(`
    SELECT COUNT(*) AS c
    FROM movement m
    LEFT JOIN movement_taxonomy t ON m.movement_id = t.movement_id
    WHERE t.movement_id IS NULL
  `).get().c;
  check('every row in movement has exactly one movement_taxonomy row (missing count is 0)',
    Number(missingTaxonomy) === 0, `${missingTaxonomy} missing`);
}

// --- 2s. R1: durable-object drift guard + per-table self-heal matrix --------
// The registry used to carry ~one representative object per migration, which
// detects "a migration never applied" but NOT "one table was lost while
// user_version still reads latest". This guard fails when a durable table is
// introduced without recovery coverage, so the defect cannot recur at 057.
console.log('[2s] R1 durable-object drift guard');
{
  const dbDrift = freshDb();
  runMigrations(dbDrift, MIGRATIONS);
  const registered = new Set(SENTINELS.map((s) => s.name));
  const exempt = new Map(DURABLE_TABLE_EXEMPTIONS.map((e) => [e.name, e.reason]));
  const durable = dbDrift.raw.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  ).all().map((r) => r.name);
  const uncovered = durable.filter((t) => !registered.has(t) && !exempt.has(t));
  check('every durable table is a sentinel or a justified exemption',
    uncovered.length === 0,
    uncovered.length === 0 ? `${durable.length} tables covered` : `UNCOVERED: ${uncovered.join(', ')}`);
  check('every exemption names a table that does NOT exist at latest user_version',
    DURABLE_TABLE_EXEMPTIONS.every((e) => !durable.includes(e.name)),
    DURABLE_TABLE_EXEMPTIONS.map((e) => e.name).join(', ') || 'none');
  check('every exemption carries a reason',
    DURABLE_TABLE_EXEMPTIONS.every((e) => typeof e.reason === 'string' && e.reason.length > 20));
}

// Per-table recovery matrix: drop each table at latest user_version, boot the
// PRODUCTION runner, and prove detection + restoration + unrelated-data safety.
console.log('[2t] R1 missing-table self-heal matrix (production runner)');
for (const target of ['movement_capability_family', 'movement_capability_attestation',
  'routine_template_slot', 'history_import_session', 'history_import_set',
  'history_import_capability_evidence']) {
  const db = freshDb();
  runMigrations(db, MIGRATIONS);
  const before = uv(db);
  db.raw.exec(`INSERT INTO movement_taxonomy (movement_id, category, implement)
    SELECT movement_id, 'squat', 'barbell' FROM movement LIMIT 0`);
  const unrelatedBefore = db.raw.prepare('SELECT COUNT(*) AS c FROM movement').get().c;
  db.raw.exec(`DROP TABLE ${target}`);
  db.raw.exec(`PRAGMA user_version = ${before}`);
  // sentinelsMissing already returns names, not sentinel objects.
  const detected = sentinelsMissing(db).includes(target);
  runMigrations(db, MIGRATIONS);
  const restored = db.raw.prepare(
    `SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name = ?`,
  ).get(target).c === 1;
  const unrelatedAfter = db.raw.prepare('SELECT COUNT(*) AS c FROM movement').get().c;
  runMigrations(db, MIGRATIONS);
  const idempotent = uv(db) === before && db.raw.prepare(
    `SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name = ?`,
  ).get(target).c === 1;
  check(`${target}: loss detected, restored, unrelated data intact, replay idempotent`,
    detected && restored && idempotent && unrelatedAfter === unrelatedBefore,
    `detected=${detected} restored=${restored} idempotent=${idempotent} `
    + `movement ${unrelatedBefore}->${unrelatedAfter} uv=${uv(db)}`);
}

// --- [2u] 057 block_meta phase/index invariant (DB-BLOCK-META-DRIFT) ---------
// Field capture held (block_id=2, macro_block_index=3, macro_phase='volume');
// the production mapping requires index 3 -> 'hypertrophy'. 057 repairs every
// persisted mismatch from macro_block_index and installs fail-closed triggers
// so the drift cannot be re-inserted at the database boundary.
console.log('[2u] 057 block_meta phase/index repair + enforcement');
{
  // Canonical index->phase mapping mirrored from macroPhaseOf (verify:blocks
  // machine-checks the TS side; this is the SQL side of the same contract).
  const phaseOf = (i) =>
    i <= 2 ? 'gpp' : i <= 4 ? 'hypertrophy' : i <= 6 ? 'volume' : 'peak';

  // Seed a training_block + block_meta row. The UPDATE-of-phase helper keeps
  // each scenario explicit about which mismatch it plants.
  const seedBlock = (db, blockId, idx) => {
    db.raw.prepare(
      `INSERT INTO training_block (block_id, start_date, objective, weeks, status, created_at_ms)
       VALUES (?, '2026-01-05', 'strength', 4, 'archived', 1000)`,
    ).run(blockId);
    db.raw.prepare(
      `INSERT INTO block_meta (block_id, macro_block_index, macro_phase, schema_type, peak_shifted)
       VALUES (?, ?, ?, 'WAVE', 0)`,
    ).run(blockId, idx, phaseOf(idx));
  };
  const setPhase = (db, blockId, phase) => {
    // Directly plant a drifted phase, bypassing nothing: before 057 there is
    // no trigger, so this is exactly how the field row came to exist.
    db.raw.prepare('UPDATE block_meta SET macro_phase = ? WHERE block_id = ?').run(phase, blockId);
  };

  // --- fresh install reaches user_version 60 with the invariant enforced ---
  {
    const db = freshDb();
    runMigrations(db, MIGRATIONS);
    // Slot 004 is the parameterized materialize script, never a migration:
    // 62 files (slots 001-063, no 004) -> user_version 62. This count is
    // pinned deliberately so adding a migration is a conscious act, not a
    // silent one. Re-pinned for 063 (OW-001 athlete load-intent declaration).
    check('fresh install reaches user_version 62 (62 files, no slot 004)',
      uv(db) === MIGRATIONS.length && MIGRATIONS.length === 62,
      String(uv(db)));
    const trig = db.raw.prepare(
      `SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'trigger'
       AND name IN ('trg_block_meta_phase_bi', 'trg_block_meta_phase_bu')`,
    ).get().c;
    check('fresh install carries both 057 enforcement triggers', trig === 2);
    let insertRejected = false;
    try {
      db.raw.prepare(
        `INSERT INTO training_block (block_id, start_date, objective, weeks, status, created_at_ms)
         VALUES (9001, '2026-01-05', 'strength', 4, 'active', 1)`,
      ).run();
      db.raw.prepare(
        `INSERT INTO block_meta (block_id, macro_block_index, macro_phase, schema_type, peak_shifted)
         VALUES (9001, 3, 'volume', 'WAVE', 0)`,
      ).run();
    } catch (e) {
      insertRejected = /macro_phase does not match/i.test(String(e.message));
    }
    check('invalid INSERT (3, volume) rejected at the boundary', insertRejected);
    // Every valid pair must pass the same boundary.
    let allValidAccepted = true;
    for (let i = 1; i <= 8; i += 1) {
      try {
        db.raw.prepare(
          `INSERT INTO training_block (block_id, start_date, objective, weeks, status, created_at_ms)
           VALUES (?, '2026-01-05', 'strength', 4, 'active', 1)`,
        ).run(9100 + i);
        db.raw.prepare(
          `INSERT INTO block_meta (block_id, macro_block_index, macro_phase, schema_type, peak_shifted)
           VALUES (?, ?, ?, 'LINEAR', 0)`,
        ).run(9100 + i, i, phaseOf(i));
      } catch {
        allValidAccepted = false;
      }
    }
    check('every valid index/phase pair accepted (all 8)', allValidAccepted);
  }

  // --- version-56 DB containing EVERY possible mismatch is repaired ----------
  {
    const db = freshDb();
    const v56 = FILES.indexOf('057_block_meta_phase_invariant.sql'); // = 56 migrations applied
    for (let i = 0; i < v56; i += 1) db.executeSync(MIGRATIONS[i]);
    db.executeSync(`PRAGMA user_version = ${v56};`);
    check('precondition: version-56 database built', uv(db) === v56);
    // One row per macro index; plant the WRONG phase for every index.
    for (let i = 1; i <= 8; i += 1) {
      seedBlock(db, i, i);
      const wrong = phaseOf(i === 8 ? 7 : i + 1); // always a different VALID phase value
      setPhase(db, i, wrong);
    }
    runMigrations(db, MIGRATIONS);
    const rows = db.raw.prepare(
      'SELECT block_id, macro_block_index, macro_phase, schema_type, peak_shifted FROM block_meta ORDER BY block_id',
    ).all();
    const allRepaired = rows.length === 8 && rows.every((r) => r.macro_phase === phaseOf(r.macro_block_index));
    check('version-56 DB with all 8 indexes drifted: every phase repaired deterministically', allRepaired,
      JSON.stringify(rows.map((r) => [r.macro_block_index, r.macro_phase])));
    // Repair preserves everything except the derived phase.
    const preserved = rows.every((r) => r.schema_type === 'WAVE' && r.peak_shifted === 0);
    check('repair preserves schema_type/peak_shifted/block ids', preserved);
  }

  // --- the exact captured case: (3,'volume') -> (3,'hypertrophy') ------------
  {
    const db = freshDb();
    const v56 = FILES.indexOf('057_block_meta_phase_invariant.sql');
    for (let i = 0; i < v56; i += 1) db.executeSync(MIGRATIONS[i]);
    db.executeSync(`PRAGMA user_version = ${v56};`);
    seedBlock(db, 2, 3);
    setPhase(db, 2, 'volume'); // the captured field row
    runMigrations(db, MIGRATIONS);
    const row = db.raw.prepare(
      'SELECT macro_block_index, macro_phase FROM block_meta WHERE block_id = 2',
    ).get();
    check('captured field row (block_id=2, index=3, volume) becomes (3, hypertrophy)',
      row && row.macro_block_index === 3 && row.macro_phase === 'hypertrophy',
      JSON.stringify(row));
  }

  // --- valid rows survive replay byte/logically unchanged --------------------
  {
    const db = freshDb();
    const v56 = FILES.indexOf('057_block_meta_phase_invariant.sql');
    for (let i = 0; i < v56; i += 1) db.executeSync(MIGRATIONS[i]);
    db.executeSync(`PRAGMA user_version = ${v56};`);
    for (let i = 1; i <= 8; i += 1) seedBlock(db, i, i);
    const before = JSON.stringify(db.raw.prepare(
      'SELECT * FROM block_meta ORDER BY block_id',
    ).all());
    runMigrations(db, MIGRATIONS);
    const after = JSON.stringify(db.raw.prepare(
      'SELECT * FROM block_meta ORDER BY block_id',
    ).all());
    check('valid index/phase pairs survive migration logically unchanged', before === after);
    runMigrations(db, MIGRATIONS); // full replay/self-heal path
    const afterReplay = JSON.stringify(db.raw.prepare(
      'SELECT * FROM block_meta ORDER BY block_id',
    ).all());
    check('replay/idempotency leaves correct rows unchanged', afterReplay === after);
  }

  // --- invalid UPDATE rejected; FK cascade intact; rollback atomicity --------
  {
    const db = freshDb();
    runMigrations(db, MIGRATIONS);
    seedBlock(db, 50, 3);
    let updateRejected = false;
    try { setPhase(db, 50, 'volume'); } catch (e) {
      updateRejected = /macro_phase does not match/i.test(String(e.message));
    }
    const stillHypertrophy = db.raw.prepare(
      "SELECT macro_phase FROM block_meta WHERE block_id = 50",
    ).get().macro_phase;
    check('invalid UPDATE of phase rejected at the boundary, row untouched',
      updateRejected && stillHypertrophy === 'hypertrophy');

    // Dependent planned_session data survives; parent delete still cascades.
    db.raw.prepare(
      `INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date)
       VALUES (5001, 50, 1, 1, 'lower', 'accumulation', '2026-01-06')`,
    ).run();
    const depBefore = db.raw.prepare(
      'SELECT COUNT(*) AS c FROM planned_session WHERE block_id = 50',
    ).get().c;
    db.raw.prepare('DELETE FROM training_block WHERE block_id = 50').run();
    const depAfter = db.raw.prepare(
      'SELECT COUNT(*) AS c FROM planned_session WHERE block_id = 50',
    ).get().c;
    const metaAfter = db.raw.prepare(
      'SELECT COUNT(*) AS c FROM block_meta WHERE block_id = 50',
    ).get().c;
    check('dependent planned data present pre-delete, FK cascade intact post-delete',
      depBefore === 1 && depAfter === 0 && metaAfter === 0);

    // Transactional atomicity: an aborted statement leaves no partial repair.
    // Plant a multi-row "repair" where one row violates the invariant inside a
    // transaction; the violating statement aborts and the earlier one rolls back.
    seedBlock(db, 60, 5);   // volume
    seedBlock(db, 61, 6);   // volume
    let txAborted = false;
    try {
      db.raw.exec('BEGIN');
      db.raw.prepare("UPDATE block_meta SET macro_phase = 'gpp' WHERE block_id = 60").run(); // valid
      db.raw.prepare("UPDATE block_meta SET macro_phase = 'bogus' WHERE block_id = 61").run(); // CHECK rejects
      db.raw.exec('COMMIT');
    } catch {
      txAborted = true;
      try { db.raw.exec('ROLLBACK'); } catch { /* already rolled back */ }
    }
    const r60 = db.raw.prepare('SELECT macro_phase FROM block_meta WHERE block_id = 60').get().macro_phase;
    const r61 = db.raw.prepare('SELECT macro_phase FROM block_meta WHERE block_id = 61').get().macro_phase;
    check('transaction failure rolls back without partial repair',
      txAborted && r60 === 'volume' && r61 === 'volume',
      `r60=${r60} r61=${r61}`);
  }

  // --- both production block-creation paths keep passing ---------------------
  {
    const db = freshDb();
    runMigrations(db, MIGRATIONS);
    // Path 1: continuation via nextMacroPosition semantics — next index wraps 8->1.
    db.raw.prepare(
      `INSERT INTO training_block (block_id, start_date, objective, weeks, status, created_at_ms)
       VALUES (70, '2026-01-05', 'strength', 4, 'archived', 1000),
              (71, '2026-02-02', 'hypertrophy', 4, 'active', 2000)`,
    ).run();
    db.raw.prepare(
      `INSERT INTO block_meta (block_id, macro_block_index, macro_phase, schema_type, peak_shifted)
       VALUES (70, 8, 'peak', 'WAVE', 0), (71, 1, 'gpp', 'LINEAR', 0)`,
    ).run();
    // Path 2: goal-program minting at a mid-cycle anchor (programMacroIndex), e.g. 6,7,8,1.
    db.raw.prepare(
      `INSERT INTO training_block (block_id, start_date, objective, weeks, status, created_at_ms)
       VALUES (72, '2026-03-02', 'power', 4, 'active', 3000),
              (73, '2026-03-30', 'power', 4, 'active', 4000),
              (74, '2026-04-27', 'strength', 4, 'active', 5000),
              (75, '2026-05-25', 'strength', 4, 'active', 6000)`,
    ).run();
    for (const [bid, idx] of [[72, 6], [73, 7], [74, 8], [75, 1]]) {
      db.raw.prepare(
        `INSERT INTO block_meta (block_id, macro_block_index, macro_phase, schema_type, peak_shifted)
         VALUES (?, ?, ?, 'APRE', 0)`,
      ).run(bid, idx, phaseOf(idx));
    }
    const count = db.raw.prepare('SELECT COUNT(*) AS c FROM block_meta').get().c;
    check('both block-creation paths (continuation + program anchor) accept mapped phases', count === 6,
      String(count));
  }

  // --- self-heal coverage: dropped 057 trigger is detected and restored ------
  {
    const db = freshDb();
    runMigrations(db, MIGRATIONS);
    db.raw.exec('DROP TRIGGER trg_block_meta_phase_bi');
    check('dropped 057 trigger is detected as missing sentinel',
      sentinelsMissing(db).includes('trg_block_meta_phase_bi'));
    runMigrations(db, MIGRATIONS);
    const restoredTrig = db.raw.prepare(
      `SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_block_meta_phase_bi'`,
    ).get().c;
    check('self-heal restores dropped 057 trigger', restoredTrig === 1);
  }
}

// --- [058] suspension episodes (RR-02) ---------------------------------------
console.log('\n[058] suspension episode invariants');
{
  const db = freshDb();
  runMigrations(db, MIGRATIONS);
  const open = () => db.raw.prepare(
    'SELECT episode_id, frozen_macro_index FROM suspension_episode WHERE ended_at_ms IS NULL').all();
  const INS = 'INSERT INTO suspension_episode (started_at_ms, ended_at_ms, reason, frozen_macro_index) VALUES (?, ?, ?, ?)';
  const begin = (startedAt, reason, frozen) => db.raw.prepare(INS).run(startedAt, null, reason, frozen);
  const rejects = (args) => { try { db.raw.prepare(INS).run(...args); return false; } catch { return true; } };

  check('fresh install carries the suspension_episode table',
    db.raw.prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name='suspension_episode'").get().c === 1);
  check('fresh install carries both 058 enforcement triggers',
    db.raw.prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type='trigger' AND name IN ('trg_suspension_episode_single_open_bi','trg_suspension_episode_no_reopen_bu')").get().c === 2);
  check('fresh install carries the single-open partial unique index',
    db.raw.prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type='index' AND name='ux_suspension_episode_single_open'").get().c === 1);
  check('no episode is open on a fresh install (never suspended by default)', open().length === 0);

  begin(1000, 'injury', 5);
  check('an episode opens and freezes the macro position',
    open().length === 1 && open()[0].frozen_macro_index === 5);

  let secondRejected = false;
  try { begin(2000, 'illness', 3); } catch (e) { secondRejected = /already open/i.test(String(e.message)); }
  check('a SECOND open episode is rejected (single-open invariant)', secondRejected);

  let closedAccepted = true;
  try { db.raw.prepare(INS).run(400, 900, 'life', 2); } catch { closedAccepted = false; }
  check('a closed historical episode coexists with an open one', closedAccepted);

  db.raw.prepare('UPDATE suspension_episode SET ended_at_ms = ? WHERE ended_at_ms IS NULL').run(3000);
  check('closing the open episode leaves none open', open().length === 0);

  let reopenRejected = false;
  try { db.raw.prepare('UPDATE suspension_episode SET ended_at_ms = NULL WHERE episode_id = 1').run(); }
  catch (e) { reopenRejected = /cannot be reopened/i.test(String(e.message)); }
  check('a closed episode cannot be reopened (the audit trail is durable)', reopenRejected);

  let reBegun = true;
  try { begin(5000, 'injury', 7); } catch { reBegun = false; }
  check('a NEW episode may open after the previous one closed', reBegun && open().length === 1);

  check('reason outside injury|illness|life is rejected', rejects([6000, 6100, 'sprain', 3]));
  check('frozen_macro_index outside 1..8 is rejected', rejects([6000, 6100, 'injury', 9]));
  check('ended_at_ms before started_at_ms is rejected', rejects([6000, 5000, 'injury', 3]));
  check('every valid reason is accepted', ['injury', 'illness', 'life'].every((r, i) =>
    !rejects([7000 + i, 7100 + i, r, (i % 8) + 1])));

  db.raw.exec('DROP TRIGGER trg_suspension_episode_single_open_bi');
  check('dropped 058 trigger is detected as a missing sentinel',
    sentinelsMissing(db).includes('trg_suspension_episode_single_open_bi'));
  runMigrations(db, MIGRATIONS);
  check('self-heal restores the dropped 058 trigger',
    db.raw.prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type='trigger' AND name='trg_suspension_episode_single_open_bi'").get().c === 1);

  db.raw.exec('DROP TABLE suspension_episode');
  check('a dropped suspension_episode TABLE is detected as a missing sentinel',
    sentinelsMissing(db).includes('suspension_episode'));
  runMigrations(db, MIGRATIONS);
  check('self-heal restores the dropped suspension_episode table',
    db.raw.prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name='suspension_episode'").get().c === 1);
}

// --- 2z. 060 program-goal tier alignment: exact three rows, idempotent, fail-closed ---
console.log('[2z] 060 program-goal tier alignment (WO §2.3)');
{
const difficultyRows = (db) => db.raw.prepare(`
    SELECT m.name, d.difficulty_rating
    FROM movement m JOIN movement_detail d USING(movement_id)
    WHERE m.name IN ('Competition Squat','Competition Bench','Deadlift')
    ORDER BY m.name`).all();
  const alignmentRows = (db) => db.raw.prepare(
    'SELECT movement_id, movement_name, previous_difficulty, aligned_difficulty FROM movement_tier_alignment ORDER BY movement_name',
  ).all();

  // (1) The fresh-install chain lands the correction exactly.
  const a60 = freshDb();
  runMigrations(a60, MIGRATIONS);
  check('060 fresh install: exactly the three big-lift rows are Intermediate after the chain',
    JSON.stringify(difficultyRows(a60)) === JSON.stringify([
      { name: 'Competition Bench', difficulty_rating: 'Intermediate' },
      { name: 'Competition Squat', difficulty_rating: 'Intermediate' },
      { name: 'Deadlift', difficulty_rating: 'Intermediate' },
    ]) && uv(a60) === MIGRATIONS.length,
    JSON.stringify(difficultyRows(a60)));
  check('060 provenance records exactly three Advanced -> Intermediate rows',
    JSON.stringify(alignmentRows(a60)) === JSON.stringify([
      { movement_id: 3, movement_name: 'Competition Bench', previous_difficulty: 'Advanced', aligned_difficulty: 'Intermediate' },
      { movement_id: 1, movement_name: 'Competition Squat', previous_difficulty: 'Advanced', aligned_difficulty: 'Intermediate' },
      { movement_id: 2, movement_name: 'Deadlift', previous_difficulty: 'Advanced', aligned_difficulty: 'Intermediate' },
    ]),
    JSON.stringify(alignmentRows(a60)));
  const allAdvancedAfter = a60.raw.prepare(
    "SELECT m.name FROM movement m JOIN movement_detail d USING(movement_id) WHERE d.difficulty_rating = 'Advanced' ORDER BY m.name",
  ).all().map((r) => r.name);
  check('060 did not widen the correction beyond the three named rows',
    !allAdvancedAfter.includes('Competition Squat')
    && !allAdvancedAfter.includes('Competition Bench')
    && !allAdvancedAfter.includes('Deadlift')
    && allAdvancedAfter.length === a60.raw.prepare(
      "SELECT COUNT(*) AS c FROM movement m JOIN movement_detail d USING(movement_id) WHERE d.difficulty_rating = 'Advanced'").get().c,
    `${allAdvancedAfter.length} Advanced rows remain`);

  // (2) Replay from the 059 boundary: idempotent, zero re-correction.
  const r60 = freshDb();
  const idx060 = FILES.indexOf('060_program_goal_tier_alignment.sql');
  for (let i = 0; i < idx060; i += 1) r60.executeSync(MIGRATIONS[i]);
  r60.executeSync(`PRAGMA user_version = ${idx060};`);
  const pre60 = difficultyRows(r60);
  check('060 precondition: the three rows are still Advanced at the 059 boundary',
    JSON.stringify(pre60) === JSON.stringify([
      { name: 'Competition Bench', difficulty_rating: 'Advanced' },
      { name: 'Competition Squat', difficulty_rating: 'Advanced' },
      { name: 'Deadlift', difficulty_rating: 'Advanced' },
    ]), JSON.stringify(pre60));
  runMigrations(r60, MIGRATIONS);
  check('060 upgrade from 059 flips exactly the three rows',
    difficultyRows(r60).every((r) => r.difficulty_rating === 'Intermediate'));
  r60.executeSync(`PRAGMA user_version = ${idx060};`);
  const alignmentSnapshot = JSON.stringify(alignmentRows(r60));
  runMigrations(r60, MIGRATIONS);
  check('060 replays idempotently from its own boundary (provenance rows unchanged)',
    uv(r60) === MIGRATIONS.length && JSON.stringify(alignmentRows(r60)) === alignmentSnapshot);

  // (3) Poisoned DB: user_version claims latest, the sentinel side-table is absent.
  const p60 = freshDb();
  for (let i = 0; i < idx060; i += 1) p60.executeSync(MIGRATIONS[i]);
  p60.executeSync(`PRAGMA user_version = ${MIGRATIONS.length};`);
  check('060 poison precondition: user_version claims latest but the alignment sentinel is absent',
    sentinelsMissing(p60).includes('movement_tier_alignment'));
  runMigrations(p60, MIGRATIONS);
  check('060 poison self-heal re-applies the chain, restores the sentinel and lands the correction',
    sentinelsMissing(p60).length === 0
    && difficultyRows(p60).every((r) => r.difficulty_rating === 'Intermediate'));

  // (4) Full re-apply from zero (the row-healing path the runner supports —
  // the same shape the 049 section proves): 037-059 rebuild the library, then
  // 060 re-asserts the correction and its provenance last.
  const d60 = freshDb();
  runMigrations(d60, MIGRATIONS);
  d60.raw.prepare("UPDATE movement_detail SET difficulty_rating = 'Advanced' WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Deadlift')").run();
  d60.raw.exec('DELETE FROM movement_tier_alignment');
  d60.raw.exec('PRAGMA user_version = 0;');
  runMigrations(d60, MIGRATIONS);
  check('060 full re-apply from zero restores the corrected difficulty row AND its provenance row',
    d60.raw.prepare("SELECT difficulty_rating AS d FROM movement_detail WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Deadlift')").get().d === 'Intermediate'
    && alignmentRows(d60).length === 3);

  // (5) Dropped sentinel table self-heals.
  d60.raw.exec('DROP TABLE movement_tier_alignment');
  check('060 a dropped alignment table is detected as a missing sentinel',
    sentinelsMissing(d60).includes('movement_tier_alignment'));
  runMigrations(d60, MIGRATIONS);
  check('060 self-heal restores the dropped alignment table with its three provenance rows',
    alignmentRows(d60).length === 3);

  // (6) CHECK-rejection and FK-cascade surface of the new table.
  const c60 = freshDb();
  runMigrations(c60, MIGRATIONS);
  let alignmentFkRejected = false;
  try {
    c60.raw.prepare("INSERT INTO movement_tier_alignment (movement_id, movement_name, previous_difficulty, aligned_difficulty) VALUES (99999, 'Ghost Lift', 'Advanced', 'Intermediate')").run();
  } catch { alignmentFkRejected = true; }
  check('060 alignment table rejects an unknown movement (FK fail-closed)', alignmentFkRejected);
  c60.raw.exec("DELETE FROM movement WHERE name = 'Deadlift'");
  check('060 alignment rows cascade on movement delete (FK surface)',
    c60.raw.prepare("SELECT COUNT(*) AS c FROM movement_tier_alignment WHERE movement_name = 'Deadlift'").get().c === 0);
}

// --- 2aa. 061 converges the two shipped 034 schemas onto the strict contract ---
// 034 exists on two lineages with DIFFERENT CHECKs (relaxed: rpe_delta BETWEEN
// -0.5 AND 0.5; strict: rpe_delta IN (-0.5,0.0,0.5) plus a no-all-zero and a
// reason/sign CHECK). Because migrations are CREATE TABLE IF NOT EXISTS, a
// device keeps whichever it first saw. 061 must land BOTH on the strict shape,
// preserve every valid row byte-identically, and refuse to converge rather than
// coerce a row it cannot explain.
console.log('[2aa] 061 autopilot attribution convergence (two shipped 034 schemas)');

const IDX_034 = FILES.indexOf('034_autopilot_attribution.sql');
const IDX_058 = FILES.indexOf('058_suspension_episode.sql');
const IDX_061 = FILES.indexOf('061_autopilot_attribution_convergence.sql');

// The master lineage's 034, verbatim, as a FIXTURE. It is deliberately not a
// file in src/schema: 034 is shipped and may never be edited or duplicated.
const STRICT_034_FIXTURE = `
CREATE TABLE IF NOT EXISTS planned_slot_autopilot (
  planned_slot_id INTEGER PRIMARY KEY REFERENCES planned_slot ON DELETE CASCADE,
  rpe_delta REAL NOT NULL CHECK (rpe_delta IN (-0.5, 0.0, 0.5)),
  set_delta INTEGER NOT NULL CHECK (set_delta BETWEEN -1 AND 1),
  reason TEXT NOT NULL CHECK (reason IN ('eased','raised','held_safety')),
  CHECK (rpe_delta <> 0.0 OR set_delta <> 0),
  CHECK (
    (reason = 'raised' AND rpe_delta >= 0.0 AND set_delta >= 0)
    OR
    (reason IN ('eased','held_safety') AND rpe_delta <= 0.0 AND set_delta <= 0)
  )
) STRICT;`;

// Minimal FK-satisfying parent chain for planned_slot rows.
// Slots baseId+1..+3 carry attribution rows; baseId+9 is a permanently EMPTY
// spare reserved for constraint probes, so a probe can never be rejected for a
// missing FK parent or a PRIMARY KEY clash instead of the CHECK under test.
const seedSlots = (db, baseId) => db.executeSync(`
  INSERT INTO training_block (block_id, start_date, objective, created_at_ms)
  VALUES (${baseId}, '2030-05-01', 'strength', 1);
  INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date)
  VALUES (${baseId + 1}, ${baseId}, 1, 1, 'lower', 'accumulation', '2030-05-01');
  INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe)
  VALUES (${baseId + 1}, ${baseId + 1}, 1, 1, 3, 5, 8.0),
         (${baseId + 2}, ${baseId + 1}, 2, 2, 3, 5, 8.0),
         (${baseId + 3}, ${baseId + 1}, 3, 3, 3, 5, 8.0),
         (${baseId + 9}, ${baseId + 1}, 9, 4, 3, 5, 8.0);
`);
const PROBE = (baseId) => baseId + 9;
// Apply a PREFIX of the chain the way the runner would, WITHOUT runMigrations'
// sentinel self-heal — that guard sees a short chain as a poisoned DB and
// re-applies from zero, which cannot reproduce a mid-chain device.
const applyRaw = (db, migrations, from, to) => {
  for (let v = from; v < to; v++) db.executeSync(migrations[v]);
  db.executeSync(`PRAGMA user_version = ${to};`);
};
const autopilotRows = (db) => db.raw.prepare(
  'SELECT planned_slot_id, rpe_delta, set_delta, reason FROM planned_slot_autopilot ORDER BY planned_slot_id',
).all();
// The strict-only violations: each PASSES the relaxed CHECKs and FAILS the
// strict ones, so each isolates exactly what convergence buys.
const STRICT_ONLY_VIOLATIONS = [
  { label: 'off-grid rpe_delta (0.25)', values: "0.25, 0, 'raised'" },
  { label: 'all-zero attribution row', values: "0.0, 0, 'eased'" },
  { label: "mixed-sign 'raised'", values: "0.5, -1, 'raised'" },
  { label: "positive 'held_safety'", values: "0.5, 1, 'held_safety'" },
];
// Returns -1 unless the probe slot is genuinely insertable first: without that
// guard every rejection below could be a missing FK parent rather than the
// CHECK under test, and the assertion would pass for the wrong reason.
const strictRejections = (db, baseId) => {
  const slotId = PROBE(baseId);
  try {
    db.executeSync(`INSERT INTO planned_slot_autopilot (planned_slot_id, rpe_delta, set_delta, reason) VALUES (${slotId}, -0.5, -1, 'eased')`);
    db.executeSync(`DELETE FROM planned_slot_autopilot WHERE planned_slot_id = ${slotId}`);
  } catch { return -1; }
  let rejected = 0;
  for (const v of STRICT_ONLY_VIOLATIONS) {
    try {
      db.executeSync(`INSERT INTO planned_slot_autopilot (planned_slot_id, rpe_delta, set_delta, reason) VALUES (${slotId}, ${v.values})`);
      db.executeSync(`DELETE FROM planned_slot_autopilot WHERE planned_slot_id = ${slotId}`);
    } catch { rejected += 1; }
  }
  return rejected;
};
const ALL = STRICT_ONLY_VIOLATIONS.length;

// (1) FRESH INSTALL -- the chain ends on the strict contract.
const fresh61 = freshDb();
runMigrations(fresh61, MIGRATIONS);
check('061 fresh install completes the chain',
  uv(fresh61) === MIGRATIONS.length && sentinelsMissing(fresh61).length === 0);
seedSlots(fresh61, 6100);
fresh61.executeSync("INSERT INTO planned_slot_autopilot (planned_slot_id, rpe_delta, set_delta, reason) VALUES (6101, -0.5, -1, 'eased')");
check('061 fresh install still accepts a valid attribution row', autopilotRows(fresh61).length === 1);
check('061 fresh install enforces all four strict-only contracts',
  strictRejections(fresh61, 6100) === ALL);

// (2) RELAXED 034 DEVICE -- upgrades and preserves every valid row EXACTLY.
const relaxed61 = freshDb();
applyRaw(relaxed61, MIGRATIONS, 0, IDX_061); // pre-061 device
check('061 relaxed-034 precondition: device sits one migration short', uv(relaxed61) === IDX_061);
seedSlots(relaxed61, 6200);
relaxed61.executeSync(`
  INSERT INTO planned_slot_autopilot (planned_slot_id, rpe_delta, set_delta, reason) VALUES
    (6201, -0.5, -1, 'eased'),
    (6202,  0.5,  1, 'raised'),
    (6203, -0.5,  0, 'held_safety');
`);
const relaxedAcceptsOffGrid = (() => {
  try {
    relaxed61.executeSync("INSERT INTO planned_slot_autopilot (planned_slot_id, rpe_delta, set_delta, reason) VALUES (6209, 0.25, 0, 'raised')");
    relaxed61.executeSync('DELETE FROM planned_slot_autopilot WHERE planned_slot_id = 6209');
    return true;
  } catch { return false; }
})();
check('061 relaxed-034 precondition: the old schema really did accept an off-grid delta', relaxedAcceptsOffGrid);
const beforeRelaxed = autopilotRows(relaxed61);
runMigrations(relaxed61, MIGRATIONS);
const afterRelaxed = autopilotRows(relaxed61);
check('061 relaxed-034 device reaches the end of the chain',
  uv(relaxed61) === MIGRATIONS.length && sentinelsMissing(relaxed61).length === 0);
check('061 relaxed-034 upgrade preserves all three valid rows EXACTLY',
  JSON.stringify(beforeRelaxed) === JSON.stringify(afterRelaxed) && afterRelaxed.length === 3,
  JSON.stringify(afterRelaxed));
check('061 relaxed-034 upgrade keeps rpe_delta a REAL, uncoerced',
  afterRelaxed.every((r) => typeof r.rpe_delta === 'number') && afterRelaxed[0].rpe_delta === -0.5);
check('061 relaxed-034 upgrade now enforces all four strict-only contracts',
  strictRejections(relaxed61, 6200) === ALL);
relaxed61.executeSync('DELETE FROM planned_slot WHERE planned_slot_id = 6201');
check('061 converged table keeps 034 FK cascade on parent delete',
  autopilotRows(relaxed61).length === 2);

// (3) STRICT 034 DEVICE AT user_version = 34 -- the master-lineage install.
// That build shipped a 34-entry array (m001-m034 then m058), so the device sits
// at 34 while THIS array has m035 at index 33. Resuming positionally would skip
// m035; the sentinel self-heal is what rescues it.
const strict61 = freshDb();
applyRaw(strict61, MIGRATIONS, 0, IDX_034); // m001..m033
strict61.executeSync(STRICT_034_FIXTURE);              // strict 034, not the relaxed file
strict61.executeSync(MIGRATIONS[IDX_058]);             // master appended 058 straight after 034
strict61.executeSync('PRAGMA user_version = 34;');
check('061 strict-034 precondition: device reports the master-lineage user_version', uv(strict61) === 34);
seedSlots(strict61, 6300);
strict61.executeSync(`
  INSERT INTO planned_slot_autopilot (planned_slot_id, rpe_delta, set_delta, reason) VALUES
    (6301, -0.5, -1, 'eased'),
    (6302,  0.5,  1, 'raised');
`);
const strictRejectsBefore = strictRejections(strict61, 6300);
check('061 strict-034 precondition: the device already enforces the strict contract',
  strictRejectsBefore === ALL, `${strictRejectsBefore}/${ALL}`);
const beforeStrict = autopilotRows(strict61);
runMigrations(strict61, MIGRATIONS);
const afterStrict = autopilotRows(strict61);
check('061 strict-034 device reaches the end of the chain',
  uv(strict61) === MIGRATIONS.length && sentinelsMissing(strict61).length === 0,
  `uv=${uv(strict61)} missing=${sentinelsMissing(strict61).join(',')}`);
check('061 strict-034 upgrade preserves both valid rows EXACTLY',
  JSON.stringify(beforeStrict) === JSON.stringify(afterStrict) && afterStrict.length === 2,
  JSON.stringify(afterStrict));
check('061 strict-034 upgrade still enforces all four strict-only contracts',
  strictRejections(strict61, 6300) === ALL);
// The positional skew is real: m035 sits at an index the device has already
// passed, so only the self-heal re-apply lands it. Assert the OUTCOME.
const loadPrefCount = () => Number(strict61.raw.prepare('SELECT COUNT(*) AS c FROM profile_load_preference').get().c);
check('061 strict-034 upgrade still lands the positionally-skipped m035',
  loadPrefCount() === 4, String(loadPrefCount()));

// (4) FAIL CLOSED -- an unexplained row stops convergence and changes nothing.
for (const violation of STRICT_ONLY_VIOLATIONS) {
  const poison = freshDb();
  applyRaw(poison, MIGRATIONS, 0, IDX_061);
  seedSlots(poison, 6400);
  poison.executeSync("INSERT INTO planned_slot_autopilot (planned_slot_id, rpe_delta, set_delta, reason) VALUES (6401, -0.5, -1, 'eased')");
  poison.executeSync(`INSERT INTO planned_slot_autopilot (planned_slot_id, rpe_delta, set_delta, reason) VALUES (6402, ${violation.values})`);
  const beforePoison = autopilotRows(poison);
  let poisonThrew = false;
  try { runMigrations(poison, MIGRATIONS); } catch { poisonThrew = true; }
  check(`061 fails closed on an unexplained row -- ${violation.label}`, poisonThrew);
  // IDX_061 is the ARRAY INDEX of this migration (59 of 60), not the number
  // 61: a rollback leaves user_version exactly where it was before the attempt.
  check(`061 fail-closed leaves user_version unchanged at index ${IDX_061} -- ${violation.label}`,
    uv(poison) === IDX_061, String(uv(poison)));
  check(`061 fail-closed leaves the original rows untouched -- ${violation.label}`,
    JSON.stringify(autopilotRows(poison)) === JSON.stringify(beforePoison)
      && autopilotRows(poison).length === 2);
  check(`061 fail-closed leaves no staging table behind -- ${violation.label}`,
    poison.raw.prepare("SELECT 1 FROM sqlite_master WHERE name='planned_slot_autopilot_061'").get() === undefined);
}

// (5) IDEMPOTENCE -- re-applying 061 over an already-converged table is a no-op.
const replay61 = freshDb();
runMigrations(replay61, MIGRATIONS);
seedSlots(replay61, 6500);
replay61.executeSync("INSERT INTO planned_slot_autopilot (planned_slot_id, rpe_delta, set_delta, reason) VALUES (6501, -0.5, -1, 'eased')");
const beforeReplay = autopilotRows(replay61);
replay61.executeSync(`PRAGMA user_version = ${IDX_061};`);
runMigrations(replay61, MIGRATIONS);
check('061 replay over an already-strict table preserves the row exactly',
  JSON.stringify(autopilotRows(replay61)) === JSON.stringify(beforeReplay) && autopilotRows(replay61).length === 1);
replay61.executeSync('DROP TABLE planned_slot_autopilot');
check('061 poison precondition marks the side-car sentinel missing',
  sentinelsMissing(replay61).includes('planned_slot_autopilot'));
runMigrations(replay61, MIGRATIONS);
check('061 self-heal restores the side-car ON THE STRICT CONTRACT',
  !sentinelsMissing(replay61).includes('planned_slot_autopilot')
    && uv(replay61) === MIGRATIONS.length
    && strictRejections(replay61, 6500) === ALL);


// --- 2ab. 062 completes the 059 side-car immutability contract --------------
// 059 protected the base episode fully, and its own frozen-program side-car
// against UPDATE only. Probed against the real chain, three mutations were
// still ALLOWED: DELETE suspension_episode_program, and BOTH update and delete
// of block_suspension_origin. block_suspension_origin is the sharp one: the
// position readers work by ABSENCE, excluding attributed blocks rather than
// storing a second copy of the position, so removing or re-pointing one row
// silently returns a suspension-era block to consuming a macro position — the
// exact S6(b) defect the ruling was raised to close.
//
// This section also carries the FIRST behavioural coverage of 059's own four
// triggers. Sentinel registration proves an object is present and restorable,
// not that it refuses anything, and nothing asserted a refusal before.
console.log('[2ab] 062 suspension side-car immutability (completes 059)');

const IDX_062 = FILES.indexOf('062_suspension_sidecar_immutability.sql');
const TRG_062 = [
  'trg_suspension_episode_program_no_delete_bd',
  'trg_block_suspension_origin_immutable_bu',
  'trg_block_suspension_origin_no_delete_bd',
  'trg_planned_slot_load_intent_no_repoint_bu',
];
const triggerPresent = (db, name) => db.raw
  .prepare("SELECT 1 AS x FROM sqlite_master WHERE type='trigger' AND name=?").get(name) !== undefined;

// One CLOSED episode carrying a full set of 059 side-cars, plus a SPARE block
// and a SPARE slot that carry none. The spares exist so an INSERT probe can
// never be rejected for a missing FK parent or a PRIMARY KEY clash instead of
// the trigger under test. training_program.status is 'archived' because 033's
// idx_training_program_one_current allows only one active/review_due row.
const seed062 = (db, b) => db.executeSync(`
  INSERT INTO training_block (block_id, start_date, objective, created_at_ms)
  VALUES (${b}, '2030-06-01', 'strength', 1), (${b + 9}, '2030-07-01', 'strength', 2);
  INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date)
  VALUES (${b}, ${b}, 1, 1, 'lower', 'accumulation', '2030-06-01');
  INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe)
  VALUES (${b}, ${b}, 1, 1, 3, 5, 8.0), (${b + 9}, ${b}, 9, 2, 3, 5, 8.0);
  INSERT INTO training_program (program_id, objective, start_date, horizon_kind, planned_end_date,
                                planned_block_count, starting_macro_block_index, schema_type, status,
                                created_at_ms, updated_at_ms)
  VALUES (${b}, 'strength', '2030-06-01', 'weeks', '2030-08-01', 4, 1, 'LINEAR', 'archived', 1, 1);
  INSERT INTO suspension_episode (episode_id, started_at_ms, ended_at_ms, reason, frozen_macro_index)
  VALUES (${b}, 1000, 2000, 'injury', 3), (${b + 8}, 3000, 4000, 'illness', 5);
  INSERT INTO suspension_episode_program (episode_id, program_id, frozen_sequence_index)
  VALUES (${b}, ${b}, 2);
  INSERT INTO block_suspension_origin (block_id, episode_id) VALUES (${b}, ${b});
  INSERT INTO planned_slot_load_intent (planned_slot_id, planned_implement) VALUES (${b}, 'BB');
`);
// true when the statement was REFUSED. A trigger RAISE(ABORT) surfaces as a
// throw, and nothing else in these probes should throw.
const refused = (db, sql) => { try { db.executeSync(sql); return false; } catch { return true; } };
const sidecars = (db) => JSON.stringify({
  program: db.raw.prepare('SELECT episode_id, program_id, frozen_sequence_index FROM suspension_episode_program ORDER BY episode_id').all(),
  origin: db.raw.prepare('SELECT block_id, episode_id FROM block_suspension_origin ORDER BY block_id').all(),
  intent: db.raw.prepare('SELECT planned_slot_id, planned_implement FROM planned_slot_load_intent ORDER BY planned_slot_id').all(),
});
// The mutations 062 must refuse, plus the one 059 already refused. The same
// list drives the fresh-install assertions, the post-upgrade assertions and the
// per-trigger self-heal assertions, so a gate cannot hold in one place and be
// quietly missing in another.
const PROHIBITED_062 = (b) => [
  ['059 UPDATE suspension_episode_program.frozen_sequence_index',
    `UPDATE suspension_episode_program SET frozen_sequence_index = 7 WHERE episode_id = ${b}`],
  ['062 direct DELETE suspension_episode_program',
    `DELETE FROM suspension_episode_program WHERE episode_id = ${b}`],
  ['062 UPDATE block_suspension_origin.episode_id (re-point onto the other episode)',
    `UPDATE block_suspension_origin SET episode_id = ${b + 8} WHERE block_id = ${b}`],
  ['062 direct DELETE block_suspension_origin',
    `DELETE FROM block_suspension_origin WHERE block_id = ${b}`],
  ['062 UPDATE planned_slot_load_intent.planned_slot_id (move a declared intent)',
    `UPDATE planned_slot_load_intent SET planned_slot_id = ${b + 9} WHERE planned_slot_id = ${b}`],
];

// (1) FRESH INSTALL -- the chain ends with the contract enforced.
{
  const B = 6600;
  const fresh62 = freshDb();
  runMigrations(fresh62, MIGRATIONS);
  check('062 fresh install completes the chain',
    uv(fresh62) === MIGRATIONS.length && sentinelsMissing(fresh62).length === 0,
    `uv=${uv(fresh62)} missing=${sentinelsMissing(fresh62).join(',')}`);
  check('062 installs all four triggers on a fresh install',
    TRG_062.every((t) => triggerPresent(fresh62, t)),
    TRG_062.filter((t) => !triggerPresent(fresh62, t)).join(',') || 'all present');
  seed062(fresh62, B);
  const before = sidecars(fresh62);
  for (const [label, sql] of PROHIBITED_062(B)) {
    check(`062 fresh install REFUSES ${label}`, refused(fresh62, sql));
  }
  // A refused statement must change nothing -- an ABORT that had already
  // written would be worse than no trigger at all.
  check('062 every refused mutation left the original rows byte-identical',
    sidecars(fresh62) === before, sidecars(fresh62));

  // Legitimate INSERTs stay available: none of these tables is insert-gated,
  // and the spare block/slot exist precisely so this cannot pass vacuously.
  check('062 INSERT block_suspension_origin remains available',
    !refused(fresh62, `INSERT INTO block_suspension_origin (block_id, episode_id) VALUES (${B + 9}, ${B})`));
  check('062 INSERT planned_slot_load_intent remains available',
    !refused(fresh62, `INSERT INTO planned_slot_load_intent (planned_slot_id, planned_implement) VALUES (${B + 9}, 'DB')`));
  // planned_implement revision on its OWN slot is deliberately still open:
  // OW-001's athlete-facing implement selection is unimplemented, and no source
  // document makes a declared intent immutable. Only re-pointing is refused.
  check('062 revising planned_implement on its OWN slot stays permitted (OW-001 is still open)',
    !refused(fresh62, `UPDATE planned_slot_load_intent SET planned_implement = 'KB' WHERE planned_slot_id = ${B}`));
  check('062 deleting a load intent stays permitted (absence is the conservative loaded path)',
    !refused(fresh62, `DELETE FROM planned_slot_load_intent WHERE planned_slot_id = ${B + 9}`));

  // 059's own four triggers -- the refusal surface nothing exercised before.
  check('059 REFUSES UPDATE suspension_episode.frozen_macro_index',
    refused(fresh62, `UPDATE suspension_episode SET frozen_macro_index = 5 WHERE episode_id = ${B}`));
  check('059 REFUSES UPDATE suspension_episode.started_at_ms',
    refused(fresh62, `UPDATE suspension_episode SET started_at_ms = 900 WHERE episode_id = ${B}`));
  check('059 REFUSES UPDATE suspension_episode.reason',
    refused(fresh62, `UPDATE suspension_episode SET reason = 'life' WHERE episode_id = ${B}`));
  check('059 REFUSES moving a recorded close time',
    refused(fresh62, `UPDATE suspension_episode SET ended_at_ms = 3000 WHERE episode_id = ${B}`));
  check('059 REFUSES deleting a CLOSED episode',
    refused(fresh62, `DELETE FROM suspension_episode WHERE episode_id = ${B}`));
  // The two deliberate permissions. The open-episode delete is what
  // resetTrainingData depends on, so it is asserted, never assumed.
  fresh62.executeSync(`INSERT INTO suspension_episode (episode_id, started_at_ms, ended_at_ms, reason, frozen_macro_index) VALUES (${B + 1}, 4000, NULL, 'illness', 4)`);
  check('059 PERMITS the athlete resume (ended_at_ms NULL -> non-NULL, once)',
    !refused(fresh62, `UPDATE suspension_episode SET ended_at_ms = 5000 WHERE episode_id = ${B + 1}`));
  fresh62.executeSync(`INSERT INTO suspension_episode (episode_id, started_at_ms, ended_at_ms, reason, frozen_macro_index) VALUES (${B + 2}, 6000, NULL, 'life', 2)`);
  check('059 PERMITS deleting an OPEN episode (the reset path depends on this)',
    !refused(fresh62, `DELETE FROM suspension_episode WHERE episode_id = ${B + 2}`));
}

// (2) UPGRADE FROM THE CURRENTLY SHIPPED PRE-062 STATE.
// The precondition half matters as much as the outcome: it proves the gap was
// real on the shipped chain rather than taking the audit's word for it.
{
  const B = 6700;
  const up62 = freshDb();
  applyRaw(up62, MIGRATIONS, 0, IDX_062);
  check('062 upgrade precondition: device sits one migration short',
    uv(up62) === IDX_062, String(uv(up62)));
  seed062(up62, B);
  // Every 062-prohibited mutation succeeds at pre-062 -- then the rows are put
  // back, so the upgrade below runs against exactly what the seed created.
  //
  // The re-point is checked separately and by its EFFECT. A statement that
  // assigns a column the value it already holds is accepted on ANY schema, so
  // "not refused" would prove nothing about the S6(b) hole; the row has to
  // actually land on the other episode. This is why seed062 creates two.
  const repointSql = PROHIBITED_062(B).find(([label]) => label.includes('re-point'))[1];
  const repointAccepted = !refused(up62, repointSql);
  const landedOn = up62.raw
    .prepare(`SELECT episode_id FROM block_suspension_origin WHERE block_id = ${B}`).get();
  check('062 upgrade precondition: the pre-062 chain really did permit MOVING the attribution',
    repointAccepted && Number(landedOn?.episode_id) === B + 8,
    `accepted=${repointAccepted} episode_id=${landedOn?.episode_id ?? 'row gone'}`);
  up62.executeSync(`UPDATE block_suspension_origin SET episode_id = ${B} WHERE block_id = ${B}`);

  const gapWasReal = PROHIBITED_062(B)
    .filter(([label]) => label.startsWith('062') && !label.includes('re-point'))
    .every(([, sql]) => !refused(up62, sql));
  check('062 upgrade precondition: the pre-062 chain permitted the other three too', gapWasReal);
  up62.executeSync(`DELETE FROM suspension_episode_program WHERE episode_id = ${B}`);
  up62.executeSync(`DELETE FROM block_suspension_origin WHERE block_id = ${B}`);
  up62.executeSync(`DELETE FROM planned_slot_load_intent WHERE planned_slot_id IN (${B}, ${B + 9})`);
  up62.executeSync(`
    INSERT INTO suspension_episode_program (episode_id, program_id, frozen_sequence_index) VALUES (${B}, ${B}, 2);
    INSERT INTO block_suspension_origin (block_id, episode_id) VALUES (${B}, ${B});
    INSERT INTO planned_slot_load_intent (planned_slot_id, planned_implement) VALUES (${B}, 'BB');
  `);
  const beforeUpgrade = sidecars(up62);
  runMigrations(up62, MIGRATIONS);
  check('062 upgraded device reaches the end of the chain',
    uv(up62) === MIGRATIONS.length && sentinelsMissing(up62).length === 0,
    `uv=${uv(up62)} missing=${sentinelsMissing(up62).join(',')}`);
  check('062 upgrade preserves every existing side-car row EXACTLY',
    sidecars(up62) === beforeUpgrade, sidecars(up62));
  for (const [label, sql] of PROHIBITED_062(B)) {
    check(`062 upgraded device now REFUSES ${label}`, refused(up62, sql));
  }
  check('062 upgrade: the refused mutations left the rows byte-identical',
    sidecars(up62) === beforeUpgrade, sidecars(up62));
}

// (3) THE DELETE GUARDS ARE PARENT-SCOPED, AND THE REPLAY SURVIVES THEM.
//
// Measured, not assumed: an FK ON DELETE CASCADE action DOES fire the child's
// BEFORE DELETE trigger, whatever recursive_triggers says. An unconditional
// guard would therefore make every parent undeletable and abort the reset, so
// the guard must be `WHEN EXISTS (<parent>)` -- 026's shape. The price is that
// naming another table makes ALTER TABLE ... RENAME fail while that table is
// absent, and 049/052/061 each rename. migrationRunner drops these two
// triggers before a full re-apply for exactly that reason; both halves are
// asserted here, because either one alone is a broken database.
{
  const B = 6800;

  // (3a) A direct delete is refused while the parents live; a cascade from
  // EITHER parent still carries the row away.
  const casc = freshDb();
  runMigrations(casc, MIGRATIONS);
  seed062(casc, B);
  check('062 a direct delete is refused while both parents are present',
    refused(casc, `DELETE FROM block_suspension_origin WHERE block_id = ${B}`)
      && casc.raw.prepare('SELECT COUNT(*) AS c FROM block_suspension_origin').get().c === 1);
  casc.executeSync(`DELETE FROM training_block WHERE block_id = ${B}`);
  check('062 block deletion still CASCADES its attribution away',
    casc.raw.prepare('SELECT COUNT(*) AS c FROM block_suspension_origin').get().c === 0);
  casc.executeSync(`DELETE FROM training_program WHERE program_id = ${B}`);
  check('062 program deletion still CASCADES the frozen program state away',
    casc.raw.prepare('SELECT COUNT(*) AS c FROM suspension_episode_program').get().c === 0);

  // (3b) The OTHER parent: the reset deletes the open episode first, so that
  // episode's attribution must leave with it and no other episode's may.
  const epi = freshDb();
  runMigrations(epi, MIGRATIONS);
  seed062(epi, B);
  epi.executeSync(`INSERT INTO suspension_episode (episode_id, started_at_ms, ended_at_ms, reason, frozen_macro_index) VALUES (${B + 1}, 8000, NULL, 'injury', 5)`);
  epi.executeSync(`INSERT INTO block_suspension_origin (block_id, episode_id) VALUES (${B + 9}, ${B + 1})`);
  check("062 the reset's open-episode delete CASCADES only THAT episode's attribution",
    !refused(epi, 'DELETE FROM suspension_episode WHERE ended_at_ms IS NULL')
      && epi.raw.prepare(`SELECT COUNT(*) AS c FROM block_suspension_origin WHERE episode_id = ${B + 1}`).get().c === 0
      && epi.raw.prepare(`SELECT COUNT(*) AS c FROM block_suspension_origin WHERE episode_id = ${B}`).get().c === 1);

  // (3c) resetTrainingData's parentless cleanup, FKs OFF: the rows survive
  // their parents and must then be deletable, or a reused block rowid would
  // inherit a stale attribution and vanish from nextMacroPosition.
  const off = freshDb();
  off.raw.exec('PRAGMA foreign_keys = OFF;');
  runMigrations(off, MIGRATIONS);
  seed062(off, B);
  off.executeSync(`DELETE FROM training_program WHERE program_id = ${B}`);
  off.executeSync(`DELETE FROM training_block WHERE block_id = ${B}`);
  check('062 FK-OFF precondition: the side-car rows are parentless, not cascaded',
    off.raw.prepare('SELECT COUNT(*) AS c FROM suspension_episode_program').get().c === 1
      && off.raw.prepare('SELECT COUNT(*) AS c FROM block_suspension_origin').get().c === 1);
  check("062 PERMITS the reset's parentless cleanup once the parents are gone",
    !refused(off, 'DELETE FROM suspension_episode_program')
      && !refused(off, 'DELETE FROM block_suspension_origin'));

  // (3d) THE TRAP. Drop a named parent and prove the poisoned DB still heals.
  // Without REPLAY_BLOCKING_TRIGGERS this aborts inside 049's ALTER TABLE
  // RENAME -- nine migrations before 058 could recreate suspension_episode --
  // and the database is unrecoverable. Reproduced before the guard was added.
  for (const parent of ['suspension_episode', 'training_block', 'training_program']) {
    const heal = freshDb();
    runMigrations(heal, MIGRATIONS);
    seed062(heal, B);
    heal.raw.exec(`DROP TABLE ${parent}`);
    check(`062 precondition: dropped ${parent} is seen as a missing sentinel`,
      sentinelsMissing(heal).includes(parent));
    let threw = null;
    try { runMigrations(heal, MIGRATIONS); } catch (e) { threw = String(e.message).split('\n')[0]; }
    check(`062 self-heal replays the whole chain with ${parent} missing`,
      threw === null && sentinelsMissing(heal).length === 0 && uv(heal) === MIGRATIONS.length,
      threw ?? `missing=${sentinelsMissing(heal).join(',')}`);
    // Recovery must restore the CONTRACT, not merely the objects.
    seed062(heal, B + 100);
    check(`062 self-heal after losing ${parent} restores the refusals too`,
      PROHIBITED_062(B + 100).every(([, sql]) => refused(heal, sql)));
  }

  // (3d-ii) THE OTHER SIDE OF THE RULE, so the distinction is proven and not
  // just asserted in a comment. 026's trg_set_dose_target_bd and
  // trg_session_outcome_bd have exactly the same cross-table WHEN EXISTS shape,
  // and they are NOT replay-blocking, because set_record and session are created
  // by 001 -- position 1, long before the earliest rename at position 48. The
  // replay has recreated them by the time 049 rewrites the schema. If that ever
  // stops being true, this fails and the runner's list needs a new entry.
  for (const parent of ['set_record', 'session']) {
    const early = freshDb();
    runMigrations(early, MIGRATIONS);
    early.raw.exec(`DROP TABLE ${parent}`);
    check(`062 precondition: dropped ${parent} is seen as a missing sentinel`,
      sentinelsMissing(early).includes(parent));
    let threw = null;
    try { runMigrations(early, MIGRATIONS); } catch (e) { threw = String(e.message).split('\n')[0]; }
    check(`062 rule: a 026 trigger naming ${parent} (001) needs no replay-blocking entry`,
      threw === null && sentinelsMissing(early).length === 0 && uv(early) === MIGRATIONS.length,
      threw ?? `missing=${sentinelsMissing(early).join(',')}`);
    // Recovery must restore 026's refusal too, not merely the table.
    early.executeSync("INSERT INTO session (session_id, session_date, started_at_ms) VALUES (7701, '2030-06-01', 1)");
    early.executeSync('INSERT INTO set_record (set_id, session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (7701, 7701, 1, 1, 5, 100, 8, 2)');
    early.executeSync("INSERT INTO set_dose_target (set_id, target_kind, target_reps) VALUES (7701, 'reps', 5)");
    check(`062 rule: 026's own immutability is restored after losing ${parent}`,
      refused(early, 'DELETE FROM set_dose_target WHERE set_id = 7701')
        && refused(early, 'UPDATE set_dose_target SET target_reps = 9 WHERE set_id = 7701'));
  }

  // (3e) The structural rule, asserted against migrationRunner's own list so a
  // future cross-table trigger cannot be added without joining it. Comments are
  // stripped first: prose says "from" too.
  const sql062Bare = MIGRATIONS[IDX_062].replace(/^\s*--.*$/gm, '');
  const named = [...sql062Bare.matchAll(/\bFROM\s+(\w+)/gi)].map((m) => m[1]);
  const runnerSrc = readFileSync(join(import.meta.dirname, '..', 'src', 'migrationRunner.ts'), 'utf-8');
  check('062 every cross-table trigger it adds is on REPLAY_BLOCKING_TRIGGERS',
    named.length > 0
      && TRG_062.filter((t) => runnerSrc.includes(`'${t}',`) && runnerSrc.indexOf(`'${t}',`) > runnerSrc.indexOf('REPLAY_BLOCKING_TRIGGERS'))
        .length === 2,
    `tables named: ${[...new Set(named)].join(',')}`);
}

// (4) IDEMPOTENCE AND SELF-HEAL, PER TRIGGER.
// Restoration is asserted through BEHAVIOUR, not presence: a trigger that is
// back in sqlite_master but semantically wrong would pass a presence check.
{
  const B = 6900;
  const heal = freshDb();
  runMigrations(heal, MIGRATIONS);
  seed062(heal, B);
  const beforeHeal = sidecars(heal);
  heal.executeSync(`PRAGMA user_version = ${IDX_062};`);
  runMigrations(heal, MIGRATIONS);
  check('062 replay over an already-protected chain is a no-op',
    sidecars(heal) === beforeHeal && uv(heal) === MIGRATIONS.length);

  const prohibited = PROHIBITED_062(B);
  for (const name of TRG_062) {
    heal.raw.exec(`DROP TRIGGER ${name}`);
    check(`062 a dropped ${name} is detected as a missing sentinel`,
      sentinelsMissing(heal).includes(name), sentinelsMissing(heal).join(',') || 'none');
    runMigrations(heal, MIGRATIONS);
    check(`062 self-heal restores ${name} AND its refusal`,
      !sentinelsMissing(heal).includes(name)
        && uv(heal) === MIGRATIONS.length
        && prohibited.every(([, sql]) => refused(heal, sql)));
  }
  check('062 self-heal left every side-car row untouched',
    sidecars(heal) === beforeHeal, sidecars(heal));
}

// (5) ARRAY INDEX AND user_version. 062 is the 61st entry, so it APPLIES at
// index 60 and leaves user_version 61 -- the file number and the array index
// are not the same thing, and the runner uses the index.
check(`062 is appended at array index ${IDX_062}, never spliced`,
  IDX_062 === 60, `index=${IDX_062} length=${MIGRATIONS.length}`);


// --- 2ac. 063 the athlete's own load-intent declaration (OW-001) -------------
// 059 gave the per-slot RECORD and the fail-closed read; it never gave the
// athlete a way to declare anything, so the 17 ambiguous movements on the
// shipped corpus were permanently undeclared and permanently loaded. 063 is the
// declaration. It adds no number and defaults nothing on the athlete's behalf.
console.log('[2ac] 063 movement load intent (OW-001)');

const IDX_063 = FILES.indexOf('063_movement_load_intent.sql');
const TRG_063 = [
  'trg_movement_load_intent_supported_bi',
  'trg_movement_load_intent_supported_bu',
];
// A real ambiguous movement from the shipped library, and a real unambiguous
// one, both looked up rather than assumed so a library correction cannot make
// this pass for the wrong reason.
const pickMovements = (db) => {
  const rows = db.raw.prepare(`
    SELECT m.movement_id AS id, m.name, d.supported_prefixes AS p
      FROM movement m JOIN movement_detail d USING(movement_id)
     ORDER BY m.movement_id
  `).all().map((r) => ({ id: Number(r.id), name: r.name, prefixes: JSON.parse(r.p ?? '[]') }));
  return {
    ambiguous: rows.find((r) => r.prefixes.length > 1 && r.prefixes.includes('Bodyweight')),
    sole: rows.find((r) => r.prefixes.length === 1),
  };
};
const intents = (db) => db.raw
  .prepare('SELECT movement_id, planned_implement FROM movement_load_intent ORDER BY movement_id')
  .all();

// (1) FRESH INSTALL.
{
  const fresh63 = freshDb();
  runMigrations(fresh63, MIGRATIONS);
  check('063 fresh install completes the chain',
    uv(fresh63) === MIGRATIONS.length && sentinelsMissing(fresh63).length === 0,
    `uv=${uv(fresh63)} missing=${sentinelsMissing(fresh63).join(',')}`);
  check('063 installs the table and both supported-implement triggers',
    fresh63.raw.prepare("SELECT 1 AS x FROM sqlite_master WHERE type='table' AND name='movement_load_intent'").get() !== undefined
      && TRG_063.every((t) => triggerPresent(fresh63, t)));
  check('063 declares NOTHING on a fresh install — every movement starts undeclared',
    intents(fresh63).length === 0);

  const { ambiguous, sole } = pickMovements(fresh63);
  check('063 precondition: the shipped library really carries an ambiguous movement',
    ambiguous !== undefined && sole !== undefined,
    ambiguous ? `${ambiguous.name} ${JSON.stringify(ambiguous.prefixes)}` : 'none found');

  check('063 accepts a declaration the movement actually supports',
    !refused(fresh63, `INSERT INTO movement_load_intent (movement_id, planned_implement, declared_at_ms) VALUES (${ambiguous.id}, 'Bodyweight', 1000)`)
      && intents(fresh63).length === 1);
  // The pairing guard: vocabulary alone cannot catch this, only the trigger can.
  const unsupported = ['DB', 'BB', 'KB', 'Cable', 'Chains'].find((p) => !ambiguous.prefixes.includes(p));
  check(`063 REFUSES an implement the movement does not support (${unsupported})`,
    refused(fresh63, `INSERT INTO movement_load_intent (movement_id, planned_implement, declared_at_ms) VALUES (${sole.id}, '${unsupported}', 1000)`));
  check('063 REFUSES revising a declaration onto an unsupported implement',
    refused(fresh63, `UPDATE movement_load_intent SET planned_implement = '${unsupported}' WHERE movement_id = ${ambiguous.id}`));
  check('063 the refused mutations left the declaration untouched',
    JSON.stringify(intents(fresh63)) === JSON.stringify([{ movement_id: ambiguous.id, planned_implement: 'Bodyweight' }]),
    JSON.stringify(intents(fresh63)));
  // Revising to another SUPPORTED implement is allowed: a declaration is
  // prospective, so changing your mind rewrites nothing already planned.
  const otherSupported = ambiguous.prefixes.find((p) => p !== 'Bodyweight');
  check(`063 PERMITS revising onto another supported implement (${otherSupported})`,
    !refused(fresh63, `UPDATE movement_load_intent SET planned_implement = '${otherSupported}' WHERE movement_id = ${ambiguous.id}`));
  check('063 PERMITS withdrawing a declaration entirely (back to undeclared)',
    !refused(fresh63, `DELETE FROM movement_load_intent WHERE movement_id = ${ambiguous.id}`)
      && intents(fresh63).length === 0);
  check('063 the vocabulary CHECK still rejects a non-canonical implement',
    refused(fresh63, `INSERT INTO movement_load_intent (movement_id, planned_implement, declared_at_ms) VALUES (${ambiguous.id}, 'Kettlebell', 1000)`));
  check('063 declared_at_ms must be a real stamp',
    refused(fresh63, `INSERT INTO movement_load_intent (movement_id, planned_implement, declared_at_ms) VALUES (${ambiguous.id}, 'Bodyweight', 0)`));
  // A declaration belongs to its movement and goes when the movement goes.
  fresh63.executeSync(`INSERT INTO movement_load_intent (movement_id, planned_implement, declared_at_ms) VALUES (${ambiguous.id}, 'Bodyweight', 1000)`);
  fresh63.executeSync(`DELETE FROM movement WHERE movement_id = ${ambiguous.id}`);
  check('063 a declaration cascades away with its movement', intents(fresh63).length === 0);
}

// (2) UPGRADE FROM THE SHIPPED PRE-063 STATE, preserving existing rows.
{
  const up63 = freshDb();
  applyRaw(up63, MIGRATIONS, 0, IDX_063);
  check('063 upgrade precondition: device sits one migration short',
    uv(up63) === IDX_063, String(uv(up63)));
  check('063 upgrade precondition: the table does not exist yet',
    up63.raw.prepare("SELECT 1 AS x FROM sqlite_master WHERE type='table' AND name='movement_load_intent'").get() === undefined);
  const { ambiguous } = pickMovements(up63);
  // Real athlete data that must survive the upgrade untouched.
  up63.executeSync(`INSERT INTO movement_preference (movement_id, preference, updated_at_ms) VALUES (${ambiguous.id}, 1, 5) ON CONFLICT(movement_id) DO UPDATE SET preference = 1`);
  runMigrations(up63, MIGRATIONS);
  check('063 upgraded device reaches the end of the chain',
    uv(up63) === MIGRATIONS.length && sentinelsMissing(up63).length === 0,
    `uv=${uv(up63)} missing=${sentinelsMissing(up63).join(',')}`);
  check('063 upgrade declares nothing retroactively — an upgraded athlete is still undeclared',
    intents(up63).length === 0);
  check('063 upgrade leaves unrelated athlete preferences intact',
    Number(up63.raw.prepare(`SELECT preference FROM movement_preference WHERE movement_id = ${ambiguous.id}`).get().preference) === 1);
  check('063 upgraded device now enforces the pairing guard',
    refused(up63, `INSERT INTO movement_load_intent (movement_id, planned_implement, declared_at_ms) VALUES (${ambiguous.id}, 'Cable', 1000)`)
      || ambiguous.prefixes.includes('Cable'));
}

// (3) IDEMPOTENCE AND SELF-HEAL, asserted through behaviour.
{
  const heal63 = freshDb();
  runMigrations(heal63, MIGRATIONS);
  const { ambiguous, sole } = pickMovements(heal63);
  heal63.executeSync(`INSERT INTO movement_load_intent (movement_id, planned_implement, declared_at_ms) VALUES (${ambiguous.id}, 'Bodyweight', 1000)`);
  const before = JSON.stringify(intents(heal63));
  heal63.executeSync(`PRAGMA user_version = ${IDX_063};`);
  runMigrations(heal63, MIGRATIONS);
  check('063 replay preserves the athlete declaration exactly',
    JSON.stringify(intents(heal63)) === before && uv(heal63) === MIGRATIONS.length);

  const unsupported = ['DB', 'BB', 'KB', 'Cable', 'Chains'].find((p) => !ambiguous.prefixes.includes(p));
  for (const name of TRG_063) {
    heal63.raw.exec(`DROP TRIGGER ${name}`);
    check(`063 a dropped ${name} is detected as a missing sentinel`,
      sentinelsMissing(heal63).includes(name), sentinelsMissing(heal63).join(',') || 'none');
    runMigrations(heal63, MIGRATIONS);
    check(`063 self-heal restores ${name} AND its refusal`,
      !sentinelsMissing(heal63).includes(name)
        && uv(heal63) === MIGRATIONS.length
        && refused(heal63, `INSERT INTO movement_load_intent (movement_id, planned_implement, declared_at_ms) VALUES (${sole.id}, '${unsupported}', 1)`));
  }
  heal63.raw.exec('DROP TABLE movement_load_intent');
  check('063 a dropped declaration TABLE is detected as a missing sentinel',
    sentinelsMissing(heal63).includes('movement_load_intent'));
  runMigrations(heal63, MIGRATIONS);
  check('063 self-heal restores the table (declarations are athlete data, not derivable)',
    !sentinelsMissing(heal63).includes('movement_load_intent') && uv(heal63) === MIGRATIONS.length);
}

// (4) ARRAY INDEX AND user_version.
check(`063 is appended at array index ${IDX_063}, never spliced`,
  IDX_063 === MIGRATIONS.length - 1 && IDX_063 === 61, `index=${IDX_063} length=${MIGRATIONS.length}`);

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
