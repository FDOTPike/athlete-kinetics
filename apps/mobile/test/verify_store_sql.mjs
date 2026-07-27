/**
 * verify_store_sql.mjs â€” extracts every SQL literal from useStore.ts and
 * PREPARES it against the real migrated schema. sqlite3_prepare validates
 * tables, columns, and syntax, so a typo'd column in the store's DAO layer
 * fails here instead of at runtime on a device.
 *
 * Run:  node apps/mobile/test/verify_store_sql.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const SCHEMA_DIR = join(ROOT, 'packages', 'core-db', 'src', 'schema');

const db = new DatabaseSync(':memory:');
try { db.prepare('SELECT ln(2.0), sqrt(2.0)').get(); } catch {
  db.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
  db.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
}
for (const f of ['001_mechanical_input.sql', '002_telemetry.sql', '003_state_vector.sql',
  '005_subjective_report.sql', '006_user_profile.sql', '007_program_engine.sql',
  '008_taxonomy.sql', '009_periodization.sql', '010_movement_library.sql',
  '011_niggle_tracking.sql', '012_report_severity.sql', '013_profile_slot.sql',
  '014_movement_prefixes.sql', '015_set_prefix.sql',
  '016_movement_library_seed.sql', '017_movement_batch.sql',
  '018_logging_modes.sql', '019_movement_batch.sql', '020_movement_batch.sql',
  '021_taxonomy_corrections.sql',
  '022_set_target.sql', '023_phase17_session_foundation.sql',
  '024_phase17_equipment_fixes.sql', '025_movement_coaching_content.sql',
  '026_phase18_session_outcome.sql', '027_operational_safeguards.sql',
  '028_capability_graph.sql', '029_routine_history_analytics.sql',
  '030_readiness_import_integration.sql', '031_planned_session_method.sql']) {
  db.exec(readFileSync(join(SCHEMA_DIR, f), 'utf-8'));
}

const src = readFileSync(join(ROOT, 'apps', 'mobile', 'src', 'state', 'useStore.ts'), 'utf-8');
const statements = [...src.matchAll(/executeSync\(\s*(?:'([^']+)'|`([^`]+)`|"([^"]+)")/g)]
  .map((m) => m[1] ?? m[2] ?? m[3]);
// The store also executes MATERIALIZE_STATE_VECTOR_SQL from @ak/core-db.
statements.push(
  readFileSync(join(SCHEMA_DIR, '004_state_vector_materialize.sql'), 'utf-8')
    .replace(/^--.*$/gm, ''),
);

let fail = 0;
let pass = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (ok) pass += 1; else fail += 1;
};
const phase17Prefixes = Object.fromEntries(db.prepare(`
  SELECT m.name, d.supported_prefixes
  FROM movement m JOIN movement_detail d USING(movement_id)
  WHERE m.name IN ('Dumbbell Bench Press', 'Dumbbell Shoulder Press', 'Pallof Press')
  ORDER BY m.name
`).all().map((row) => [row.name, row.supported_prefixes]));
const exactPhase17Prefixes =
  phase17Prefixes['Dumbbell Bench Press'] === '["DB"]'
  && phase17Prefixes['Dumbbell Shoulder Press'] === '["DB"]'
  && phase17Prefixes['Pallof Press'] === '["Banded"]';
check('store schema chain includes exact 024 equipment-prefix corrections',
  exactPhase17Prefixes,
  JSON.stringify(phase17Prefixes));
console.log(`[store DAO SQL] preparing ${statements.length} statements against live schema`);
for (const sql of statements) {
  const head = sql.replace(/\s+/g, ' ').trim().slice(0, 72);
  try {
    db.prepare(sql);
    console.log(`  PASS  ${head}`);
    pass += 1;
  } catch (e) {
    console.log(`  FAIL  ${head}\n        ${e instanceof Error ? e.message : e}`);
    fail += 1;
  }
}
// Wiring tripwires: mutation testing (2026-06-12) proved the layer-3 chain
// could be silently unwired with every gate green. The pure derivation is
// verified in verify:policy [6]; these assert the store actually routes
// through it and guards date rollover.
console.log('[store wiring]');
function need(needle, re) {
  const ok = re.test(src);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  store references ${needle}`);
  if (ok) pass += 1; else fail += 1;
}
need('derivePrescription(', /derivePrescription\(/);
need('rolloverDay', /rolloverDay/);
need('localToday()', /localToday\(\)/);
need('detectFlaws(', /detectFlaws\(/);
need('buildPatternWindow(', /buildPatternWindow\(/);
need('flawReport', /flawReport/);

// --- [Phase 13 Step 4] autopilot projection SQL: EXECUTED against seeded rows ----
// PREPARE only proves columns/syntax; the ΔE join + reciprocal attenuation are the
// signal the whole autopilot consumes, so run the EXACT store SQL on known data.
const a = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (ok) pass += 1; else fail += 1;
};
console.log('[autopilot projection — executed against seeded rows]');
const setAggSql = statements.find((s) => s.includes('sum_attenuation'));
const niggleWinSql = statements.find((s) => /SELECT region, severity, reported_at_ms\s+FROM niggle/.test(s));
const maxNigSql = statements.find((s) => /MAX\(severity\)[\s\S]*FROM niggle WHERE reported_at_ms >= \?/.test(s));
a('store exposes the set-aggregate, niggle-window, and max-niggle SQL literals',
  Boolean(setAggSql) && Boolean(niggleWinSql) && Boolean(maxNigSql));
if (setAggSql && niggleWinSql && maxNigSql) {
  db.exec('BEGIN');
  db.exec("INSERT INTO movement (movement_id,name,pattern,is_compound) VALUES (901,'AP Test Squat','squat',1)");
  db.exec("INSERT INTO training_block (block_id,start_date,objective,created_at_ms) VALUES (901,'2026-06-01','strength',0)");
  db.exec("INSERT INTO planned_session (planned_session_id,block_id,week_index,day_index,focus,phase,session_date) VALUES (901,901,1,1,'lower','accumulation','2026-06-10')");
  db.exec("INSERT INTO planned_slot (planned_slot_id,planned_session_id,slot_index,movement_id,sets,reps,target_rpe) VALUES (901,901,1,901,4,5,8.0)");
  db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (901,'2026-06-10',0)");
  db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (901,901,901,1,5,100,9.0,0)");
  db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (902,901,901,2,5,100,8.0,0)");
  // effective 80 / base 100 → ratio 0.8 → 1/max(1,0.8)=1.0 ; effective 120 → 1/1.2≈0.8333
  db.exec("INSERT INTO set_prefix (set_id,applied_prefixes,cns_load_modifier,stability_requirement_modifier,difficulty_modifier,effective_load_kg) VALUES (901,'[\"KB\"]',1.0,1.0,1.0,80.0)");
  db.exec("INSERT INTO set_prefix (set_id,applied_prefixes,cns_load_modifier,stability_requirement_modifier,difficulty_modifier,effective_load_kg) VALUES (902,'[]',1.0,1.0,1.0,120.0)");
  // Provenance snapshots (022): each set's target RPE pinned at log time.
  db.exec("INSERT INTO set_target (set_id,provenance_kind,target_rpe,source_planned_slot_id,created_at_ms) VALUES (901,'planned',8.0,901,0)");
  db.exec("INSERT INTO set_target (set_id,provenance_kind,target_rpe,source_planned_slot_id,created_at_ms) VALUES (902,'planned',8.0,901,0)");
  const rows = db.prepare(setAggSql).all('2026-06-01', '2026-06-15');
  const sq = rows.find((r) => r.pattern === 'squat');
  a('set-aggregate returns ONE (date,pattern) row for the seeded squat sets',
    rows.length === 1 && Boolean(sq) && Number(sq.set_count) === 2);
  a('ΔE via set_target snapshot: sum_delta_rpe=(9−8)+(8−8)=1.0, delta_count=2',
    Boolean(sq) && Number(sq.sum_delta_rpe) === 1.0 && Number(sq.delta_count) === 2, sq && `${sq.sum_delta_rpe}/${sq.delta_count}`);
  a('reciprocal attenuation: 1/max(1,0.8)=1.0 + 1/max(1,1.2)=0.8333 → 1.8333',
    Boolean(sq) && Math.abs(Number(sq.sum_attenuation) - (1.0 + 1 / 1.2)) < 1e-9, sq && String(sq.sum_attenuation));
  // a set with NO set_prefix coalesces to base load → attenuation 1.0; and a set
  // with no prescribed target contributes to set_count but NOT to delta_count.
  db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (902,'2026-06-11',0)");
  db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (903,902,901,1,5,100,7.0,0)");
  const sq2 = db.prepare(setAggSql).all('2026-06-11', '2026-06-11').find((r) => r.pattern === 'squat');
  a('no-set_prefix set coalesces to base load → attenuation 1.0', Boolean(sq2) && Math.abs(Number(sq2.sum_attenuation) - 1.0) < 1e-9, sq2 && String(sq2.sum_attenuation));
  a('ΔE excludes a set with no prescribed target (delta_count 0 on un-planned day)', Boolean(sq2) && Number(sq2.delta_count) === 0, sq2 && String(sq2.delta_count));
  // PROVENANCE (022): an overlapping ARCHIVED plan with a LOWER target must NOT
  // corrupt ΔE. The set_target snapshot pins each set at log time; the old
  // MIN(target_rpe)-by-(date,movement) join (no status filter) would have used
  // 6.0 -> a false +3.0 deficit. The snapshot keeps ΔE at (9-8)+(8-8)=1.0.
  db.exec("INSERT INTO training_block (block_id,start_date,objective,created_at_ms,status) VALUES (801,'2026-05-01','strength',0,'archived')");
  db.exec("INSERT INTO planned_session (planned_session_id,block_id,week_index,day_index,focus,phase,session_date) VALUES (801,801,1,1,'lower','accumulation','2026-06-10')");
  db.exec("INSERT INTO planned_slot (planned_slot_id,planned_session_id,slot_index,movement_id,sets,reps,target_rpe) VALUES (801,801,1,901,4,5,6.0)");
  const sqOv = db.prepare(setAggSql).all('2026-06-10', '2026-06-10').find((r) => r.pattern === 'squat');
  a('provenance: overlapping archived plan (target 6.0) does NOT corrupt ΔE — snapshot pins 8.0, sum_delta stays 1.0',
    Boolean(sqOv) && Number(sqOv.sum_delta_rpe) === 1.0 && Number(sqOv.delta_count) === 2, sqOv && `${sqOv.sum_delta_rpe}/${sqOv.delta_count}`);
  // niggle ms-window + max-severity (date bucketing itself is done in local JS).
  db.exec("INSERT INTO niggle (id,region,severity,reported_at_ms) VALUES ('apn1','knee',6,5000)");
  const nrows = db.prepare(niggleWinSql).all(0);
  a('niggle window select returns the seeded niggle by ms bound', nrows.length === 1 && nrows[0].region === 'knee' && Number(nrows[0].severity) === 6);
  a('max-niggle select returns the severity at/after the ms bound', Number(db.prepare(maxNigSql).all(0)[0].s) === 6);
  a('max-niggle select returns 0 when the bound is after the niggle (no false halt)', Number(db.prepare(maxNigSql).all(9999)[0].s) === 0);
  db.exec('ROLLBACK');
}

// --- [Phase 13 Step 4] immutability + bounded-read source invariants -------------
console.log('[autopilot wiring invariants]');
const stripComments = (s) => s.replace(/\/\/[^\n]*/g, '');
// Anchor on the IMPLEMENTATION (it has a default param) — not the interface decl.
const gnbRaw = (() => { const i = src.indexOf('generateNewBlock: (schemaType ='); const j = src.indexOf('refreshBlock:', i); return i >= 0 && j > i ? src.slice(i, j) : ''; })();
const gnb = stripComments(gnbRaw);
a('generateNewBlock body located', gnb.length > 0);
a('IMMUTABILITY: generateNewBlock writes NO past/raw table (session/set_record/set_prefix/mech_daily/niggle/state_vector)',
  !/(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(session|set_record|set_prefix|set_target|mech_daily|niggle|state_vector)\b/i.test(gnb));
a('the ONLY write targets are training_block / block_meta / planned_session / planned_slot / planned_slot_target',
  [...gnb.matchAll(/(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+([a-z_]+)/gi)]
    .every((m) => ['training_block', 'block_meta', 'planned_session', 'planned_slot', 'planned_slot_target'].includes(m[1])));
const hyd = stripComments((() => { const i = gnbRaw.indexOf('autopilot hydration'); const j = gnbRaw.indexOf('generateBlock({'); return i >= 0 && j > i ? gnbRaw.slice(i, j) : ''; })());
a('n+1-free: a SINGLE grouped per-(date,pattern) set-aggregate read', (hyd.match(/GROUP BY s\.session_date, m\.pattern/g) || []).length === 1);
a('bounded: the hydration issues a fixed, small number of reads (≤ 4 executeSync)', (() => { const n = (hyd.match(/executeSync/g) || []).length; return n >= 1 && n <= 4; })());
a('bounded: the set-aggregate carries a session_date window predicate', /WHERE s\.session_date >= \? AND s\.session_date <= \?/.test(hyd));
a('no executeSync inside a for/map/forEach in the hydration (n+1 guard)', !/(for\s*\(|\.forEach\s*\(|\.map\s*\()[^;{]*executeSync/.test(hyd));

// --- resetTrainingData: EXECUTE the store's wipe on seeded data -----------------
// Proves the reset clears ALL history (so the demo can re-load) while KEEPING the
// athlete_profile + movement library (the user's settings survive).
console.log('[resetTrainingData — executed against seeded rows]');
const resetBody = (() => {
  const i = src.indexOf('resetTrainingData: () => {');
  const j = src.indexOf('loadDemoAthlete: () => {', i);
  return i >= 0 && j > i ? src.slice(i, j) : '';
})();
const resetTables = [...resetBody.matchAll(/DELETE FROM (\w+)'/g)].map((m) => m[1]);
a('resetTrainingData body found with its unconditional DELETEs', resetTables.length >= 15, `${resetTables.length} tables`);
a('reset NEVER clears athlete_profile / movement / profile_slot (settings survive)',
  !['athlete_profile', 'movement', 'movement_detail', 'movement_preference', 'profile_slot'].some((t) => resetTables.includes(t)));
a('reset explicitly clears both immutable Phase 18 side-cars',
  ['set_dose_target', 'session_outcome'].every((table) => resetTables.includes(table)));
a('reset removes each immutable side-car only after its parent',
  resetTables.indexOf('set_record') >= 0
    && resetTables.indexOf('set_dose_target') > resetTables.indexOf('set_record')
    && resetTables.indexOf('session') >= 0
    && resetTables.indexOf('session_outcome') > resetTables.indexOf('session'));
if (resetTables.length >= 15) {
  const MAT = readFileSync(join(SCHEMA_DIR, '004_state_vector_materialize.sql'), 'utf-8').replace(/^--.*$/gm, '');
  db.exec('BEGIN');
  db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (701,'2026-06-10',0)");
  db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (701,701,1,1,5,100,8,0)");
  db.exec("INSERT INTO set_dose_target (set_id,target_kind,target_reps) VALUES (701,'reps',5)");
  db.exec(`INSERT INTO session_outcome (
    session_id,outcome_kind,terminal_phase,halt_reason,origin_kind,session_mode,training_age,
    slot_count,planned_set_count,logged_set_count,exact_dose_count,under_dose_count,
    over_dose_count,unknown_dose_count,unmapped_set_count,missing_set_count,
    missing_unskipped_set_count,extra_set_count,adapted_slot_count,skipped_slot_count,
    off_plan_slot_count,finalized_at_ms,engine_version
  ) VALUES (701,'followed_plan','complete',NULL,'planned','guided','beginner',
    1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1)`);
  db.exec("INSERT INTO set_prefix (set_id,applied_prefixes,cns_load_modifier,stability_requirement_modifier,difficulty_modifier,effective_load_kg) VALUES (701,'[]',1,1,1,100)");
  db.exec("INSERT INTO niggle (id,region,severity,reported_at_ms) VALUES ('rn1','knee',5,1000)");
  db.exec("INSERT INTO one_rep_max (movement_id,load_kg,updated_at_ms) VALUES (1,100,0)");
  db.exec("INSERT INTO training_block (block_id,start_date,objective,created_at_ms) VALUES (701,'2026-06-01','strength',0)");
  db.exec("INSERT INTO planned_session (planned_session_id,block_id,week_index,day_index,focus,phase,session_date) VALUES (701,701,1,1,'lower','accumulation','2026-06-10')");
  db.exec("INSERT INTO planned_session_method (planned_session_id,schema_type,routine_template_id,template_name,frozen_at_ms) VALUES (701,'APRE',NULL,'Reset probe',0)");
  db.exec("INSERT INTO planned_slot (planned_slot_id,planned_session_id,slot_index,movement_id,sets,reps,target_rpe) VALUES (701,701,1,1,4,5,8.0)");
  db.prepare(MAT).run('2026-06-10'); // materializes a state_vector row (mech_daily already filled by trigger)
  const cnt = (t) => Number(db.prepare(`SELECT count(*) c FROM ${t}`).get().c);
  const seeded = ['session', 'set_record', 'set_dose_target', 'session_outcome', 'set_prefix', 'niggle', 'one_rep_max', 'training_block', 'planned_session', 'planned_session_method', 'planned_slot', 'mech_daily', 'state_vector'];
  a('seed populated the history tables', seeded.every((t) => cnt(t) > 0));
  const profBefore = cnt('athlete_profile'); const movBefore = cnt('movement');
  for (const t of resetTables) db.prepare(`DELETE FROM ${t}`).run(); // the store's exact sequence
  a('reset cleared EVERY history table (demo can re-load)', resetTables.every((t) => cnt(t) === 0), seeded.map((t) => `${t}=${cnt(t)}`).filter((s) => !s.endsWith('=0')).join(',') || 'all empty');
  a('athlete_profile + movement library SURVIVE the reset',
    cnt('athlete_profile') === profBefore && profBefore === 1 && cnt('movement') === movBefore && movBefore === 124, // 30 shipped + 51 (016) + 15 (017) + 13 (019) + 15 (020)
    `profile ${cnt('athlete_profile')}/${profBefore}, movement ${cnt('movement')}/${movBefore}`);
  db.exec('ROLLBACK');
}

// --- wipe/reset behavior contracts (audit A2/A3/A4 + reset defect) -----------
{
  const src = readFileSync(join(import.meta.dirname, '..', 'src', 'state', 'useStore.ts'), 'utf-8');
  const wipeStart = src.indexOf('wipeActiveBlockState: () => {');
  const wipeBody = src.slice(wipeStart, src.indexOf('switchAthlete:', wipeStart));
  for (const key of ['prescription: null', 'substitution: null', 'sessionPlan: []', 'activeMovementId: null']) {
    const ok = wipeBody.includes(key);
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  wipe clears stale state: ${key}`);
    if (!ok) fail += 1;
  }
  const resetStart = src.indexOf('resetTrainingData: () => {');
  const resetBody = src.slice(resetStart, src.indexOf('loadDemoAthlete:', resetStart));
  for (const key of ['session: null', 'prescription: null', 'substitution: null', 'sessionPlan: []']) {
    const ok = resetBody.includes(key);
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  full reset clears in-memory state: ${key}`);
    if (!ok) fail += 1;
  }
  const guards = [
    ['generateNewBlock refuses during an active session', 'End the active session before generating a new block.'],
    ['switchProfile refuses during an active session', 'End the active session before switching profiles.'],
    ['startSession has a duplicate-start guard', 'double-start would orphan'],
    ['boot is single-flight', 'bootInFlight'],
    ['registry write failures surface to the athlete', 'registry write failed'],
    ['time-mode movements enforce seconds at the log boundary', 'is time-based'],
    ['boot resumes an unfinished session (crash recovery)', 'RESUMES it on restart'],
    ['missing readiness vector clears the stale prescription', "vector === null) { set({ prescription: null })"],
  ];
  for (const [label, needle] of guards) {
    const ok = src.includes(needle);
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
    if (!ok) fail += 1;
  }
  const screen = readFileSync(join(import.meta.dirname, '..', 'src', 'screens', 'ProfileScreen.tsx'), 'utf-8');
  const ok = screen.includes('End the active session before deleting the block');
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  destructive wipe blocked during an active session (UI)`);
  if (!ok) fail += 1;
}

// --- [Phase 13 Step 5] Upgrade, Constraints, and Store Lifecycle Tests -----------
{
  console.log('[022 upgrade, constraints, and store lifecycle simulation]');

  const FILES = [
    '001_mechanical_input.sql', '002_telemetry.sql', '003_state_vector.sql',
    '005_subjective_report.sql', '006_user_profile.sql', '007_program_engine.sql',
    '008_taxonomy.sql', '009_periodization.sql', '010_movement_library.sql',
    '011_niggle_tracking.sql', '012_report_severity.sql', '013_profile_slot.sql',
    '014_movement_prefixes.sql', '015_set_prefix.sql',
    '016_movement_library_seed.sql', '017_movement_batch.sql',
    '018_logging_modes.sql', '019_movement_batch.sql', '020_movement_batch.sql',
    '021_taxonomy_corrections.sql', '022_set_target.sql', '023_phase17_session_foundation.sql',
    '024_phase17_equipment_fixes.sql', '025_movement_coaching_content.sql',
    '026_phase18_session_outcome.sql', '027_operational_safeguards.sql',
    '028_capability_graph.sql', '029_routine_history_analytics.sql',
    '030_readiness_import_integration.sql', '031_planned_session_method.sql'
  ];

  // 1. Schema shape test: applying 022 on a fresh DB produces the correct set_target schema.
  // The old rename-copy upgrade pattern was removed (it destroyed session_plan_slot_id on
  // re-apply). Old-draft set_target was never shipped; the migration is now a pure
  // CREATE IF NOT EXISTS — a no-op when tables already exist.
  const upDb = new DatabaseSync(':memory:');
  for (let i = 0; i < FILES.indexOf('022_set_target.sql'); i++) {
    upDb.exec(readFileSync(join(SCHEMA_DIR, FILES[i]), 'utf-8'));
  }
  upDb.exec(readFileSync(join(SCHEMA_DIR, '022_set_target.sql'), 'utf-8'));

  const cols = upDb.prepare('PRAGMA table_info(set_target)').all();
  const hasCol = cols.some((c) => c.name === 'session_plan_slot_id');
  check('022 schema: set_target has session_plan_slot_id column on fresh apply', hasCol);
  if (!hasCol) fail += 1;

  // Insert a current-schema row and verify all columns round-trip correctly.
  upDb.exec(`INSERT INTO movement (movement_id, name, pattern, is_compound) VALUES (901, 'Squat', 'squat', 1)`);
  upDb.exec(`INSERT INTO session (session_id, session_date, started_at_ms) VALUES (1, '2026-07-15', 0)`);
  upDb.exec(`INSERT INTO session_plan_slot (session_plan_slot_id, session_id, slot_index, movement_id, planned_sets, provenance_kind, target_rpe, source_planned_slot_id) VALUES (1, 1, 0, 901, 3, 'planned', 8.0, 101)`);
  upDb.exec(`INSERT INTO set_record (set_id, session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (1, 1, 901, 1, 5, 100, 8.0, 0)`);
  upDb.exec(`INSERT INTO set_target (set_id, session_plan_slot_id, provenance_kind, target_rpe, source_planned_slot_id, created_at_ms) VALUES (1, 1, 'planned', 8.0, 101, 12345)`);
  const row = upDb.prepare('SELECT * FROM set_target WHERE set_id = 1').get();
  const dataSurvived = row !== undefined && row.session_plan_slot_id === 1 && row.target_rpe === 8.0 && row.created_at_ms === 12345;
  check('022 schema: set_target round-trips session_plan_slot_id, target_rpe, created_at_ms', dataSurvived);
  if (!dataSurvived) fail += 1;

  // 2. Schema Constraints Test
  // session_origin constraint: origin_kind = 'free_form' but source_planned_session_id is not null
  let originFailed = false;
  try {
    upDb.exec("INSERT INTO session_origin (session_id, origin_kind, source_planned_session_id) VALUES (1, 'free_form', 1);");
  } catch {
    originFailed = true;
  }
  check('schema constraint: session_origin rejects free_form with source planned session', originFailed);
  if (!originFailed) fail += 1;

  // session_plan_slot constraint: provenance_kind = 'free_form' but target_rpe is not null
  let slotFailed = false;
  try {
    upDb.exec(`
      INSERT INTO session_plan_slot (session_id, slot_index, movement_id, planned_sets, planned_reps, provenance_kind, target_rpe, source_planned_slot_id)
      VALUES (1, 1, 901, 3, 5, 'free_form', 8.0, null);
    `);
  } catch {
    slotFailed = true;
  }
  check('schema constraint: session_plan_slot rejects free_form with target RPE', slotFailed);
  if (!slotFailed) fail += 1;

  // 3. Store Lifecycle Simulation
  const lDb = new DatabaseSync(':memory:');
  for (const f of FILES) {
    lDb.exec(readFileSync(join(SCHEMA_DIR, f), 'utf-8'));
  }

  // Seed movements
  lDb.exec("INSERT INTO movement (movement_id, name, pattern, is_compound) VALUES (901, 'Squat', 'squat', 1);");
  lDb.exec("INSERT INTO movement (movement_id, name, pattern, is_compound) VALUES (902, 'Bench Press', 'push_h', 1);");
  lDb.exec("INSERT INTO training_block (block_id, start_date, objective, weeks, status, created_at_ms) VALUES (100, '2026-07-15', 'strength', 4, 'active', 0);");
  lDb.exec("INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (10, 100, 1, 1, 'lower', 'accumulation', '2026-07-15');");
  lDb.exec("INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (101, 10, 1, 901, 3, 5, 8.0);");
  lDb.exec("INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (102, 10, 2, 902, 3, 5, 9.0);");

  // A. Start session (planned origin)
  lDb.exec("INSERT INTO session (session_id, session_date, started_at_ms) VALUES (1, '2026-07-15', 1000000);");
  lDb.exec("INSERT INTO session_origin (session_id, origin_kind, source_planned_session_id) VALUES (1, 'planned', 10);");
  lDb.exec(`
    INSERT INTO session_plan_slot (session_plan_slot_id, session_id, slot_index, movement_id, planned_sets, planned_reps, provenance_kind, target_rpe, source_planned_slot_id, original_movement_id, original_session_date)
    VALUES (1, 1, 0, 901, 3, 5, 'planned', 8.0, 101, null, '2026-07-15');
  `);
  lDb.exec(`
    INSERT INTO session_plan_slot (session_plan_slot_id, session_id, slot_index, movement_id, planned_sets, planned_reps, provenance_kind, target_rpe, source_planned_slot_id, original_movement_id, original_session_date)
    VALUES (2, 1, 1, 902, 3, 5, 'planned', 9.0, 102, null, '2026-07-15');
  `);

  // Consumed planned_slot_disposition
  lDb.exec("INSERT INTO planned_slot_disposition (planned_slot_id, disposition, session_id) VALUES (101, 'consumed', 1);");
  lDb.exec("INSERT INTO planned_slot_disposition (planned_slot_id, disposition, session_id) VALUES (102, 'consumed', 1);");

  // B. Log set for planned slot 1 (Squat)
  lDb.exec("INSERT INTO set_record (set_id, session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (1, 1, 901, 1, 5, 100.0, 8.0, 1005000);");
  lDb.exec("INSERT INTO set_target (set_id, session_plan_slot_id, provenance_kind, target_rpe, source_planned_slot_id, created_at_ms) VALUES (1, 1, 'planned', 8.0, 101, 1005000);");

  // Verify planned logging
  const set1 = lDb.prepare("SELECT * FROM set_target WHERE set_id = 1;").get();
  check('lifecycle test: planned set logging recorded target and slot reference', set1 !== undefined && set1.session_plan_slot_id === 1 && set1.provenance_kind === 'planned');
  if (!(set1 !== undefined && set1.session_plan_slot_id === 1 && set1.provenance_kind === 'planned')) fail += 1;

  // C. Substitution (Swap Bench Press 902 for Squat 901 as a substituted slot)
  // Bench slot (slot 2) gets updated to Squat 901
  lDb.exec(`
    UPDATE session_plan_slot
    SET movement_id = 901, provenance_kind = 'substituted', original_movement_id = 902
    WHERE session_plan_slot_id = 2;
  `);
  // Log set for slot 2
  lDb.exec("INSERT INTO set_record (set_id, session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (2, 1, 901, 2, 5, 105.0, 9.0, 1010000);");
  lDb.exec("INSERT INTO set_target (set_id, session_plan_slot_id, provenance_kind, target_rpe, source_planned_slot_id, created_at_ms) VALUES (2, 2, 'substituted', 9.0, 102, 1010000);");

  const set2 = lDb.prepare("SELECT * FROM set_target WHERE set_id = 2;").get();
  check('lifecycle test: substituted logging maps target and tracks original movement', set2 !== undefined && set2.session_plan_slot_id === 2 && set2.provenance_kind === 'substituted');
  if (!(set2 !== undefined && set2.session_plan_slot_id === 2 && set2.provenance_kind === 'substituted')) fail += 1;

  // D. Day-Swap and transaction rollback simulation
  // Future planned slot
  lDb.exec("INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (11, 100, 1, 2, 'upper', 'accumulation', '2026-07-16');");
  lDb.exec("INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (103, 11, 1, 902, 3, 5, 7.5);");

  // Transaction: apply Day-Swap (Option)
  lDb.exec("BEGIN;");
  lDb.exec("INSERT INTO planned_slot_disposition (planned_slot_id, disposition, session_id) VALUES (103, 'swapped', 1);");
  // Update slot 2 to day_swapped
  lDb.exec(`
    UPDATE session_plan_slot
    SET movement_id = 902, provenance_kind = 'day_swapped', target_rpe = 7.5, source_planned_slot_id = 103, original_movement_id = 901, original_session_date = '2026-07-16'
    WHERE session_plan_slot_id = 2;
  `);
  lDb.exec("COMMIT;");

  const slot2 = lDb.prepare("SELECT * FROM session_plan_slot WHERE session_plan_slot_id = 2;").get();
  check('lifecycle test: day_swapped slot properties updated correctly', slot2 !== undefined && slot2.provenance_kind === 'day_swapped' && slot2.target_rpe === 7.5 && slot2.original_session_date === '2026-07-16');
  if (!(slot2 !== undefined && slot2.provenance_kind === 'day_swapped' && slot2.target_rpe === 7.5 && slot2.original_session_date === '2026-07-16')) fail += 1;

  // Verify rollback behavior: duplicate UNIQUE constraint failure (session_id, slot_index) rollback
  lDb.exec("BEGIN;");
  let transactionThrew = false;
  try {
    // Attempt insert that violates UNIQUE(session_id, slot_index)
    lDb.exec(`
      INSERT INTO session_plan_slot (session_id, slot_index, movement_id, planned_sets, planned_reps, provenance_kind, target_rpe, source_planned_slot_id)
      VALUES (1, 0, 902, 3, 5, 'free_form', null, null);
    `);
    lDb.exec("COMMIT;");
  } catch {
    transactionThrew = true;
    lDb.exec("ROLLBACK;");
  }
  check('lifecycle test: transaction rolls back on constraint violation', transactionThrew);
  if (!transactionThrew) fail += 1;

  // --- P1 #1 regression: training-block delete must not fail due to FK/CHECK clash --------
  // Reproduces the defect found by the auditor: delete a training_block that a session_origin
  // row references. With the old FK (ON DELETE SET NULL) this violated the CHECK constraint.
  // With the fixed schema (plain INTEGER, no FK) the delete must succeed.
  {
    const fkDb = new DatabaseSync(':memory:');
    fkDb.exec('PRAGMA foreign_keys = ON;');
    for (const f of FILES) fkDb.exec(readFileSync(join(SCHEMA_DIR, f), 'utf-8'));
    fkDb.exec(`INSERT INTO training_block (block_id, start_date, objective, weeks, status, created_at_ms) VALUES (200, '2026-07-15', 'strength', 4, 'active', 0)`);
    fkDb.exec(`INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (20, 200, 1, 1, 'lower', 'accumulation', '2026-07-15')`);
    fkDb.exec(`INSERT INTO session (session_id, session_date, started_at_ms) VALUES (2, '2026-07-15', 0)`);
    fkDb.exec(`INSERT INTO session_origin (session_id, origin_kind, source_planned_session_id) VALUES (2, 'planned', 20)`);
    let blockDeleteFailed = false;
    try {
      fkDb.exec('DELETE FROM training_block WHERE block_id = 200');
    } catch {
      blockDeleteFailed = true;
    }
    check('P1 #1 regression: training_block delete with planned session_origin succeeds (no FK/CHECK clash)', !blockDeleteFailed);
    if (blockDeleteFailed) fail += 1;
    // The snapshot value is retained even though the plan is gone (correct immutable provenance)
    const snap = fkDb.prepare('SELECT source_planned_session_id FROM session_origin WHERE session_id = 2').get();
    check('P1 #1: snapshot source_planned_session_id retained after block delete', snap !== undefined && snap.source_planned_session_id === 20);
    if (!(snap !== undefined && snap.source_planned_session_id === 20)) fail += 1;
  }

  // --- P2 regression: unknown explicit sessionPlanSlotId in logSet must error ----------------
  // The production guard is in TypeScript (useStore.ts logSet). We verify its presence in
  // source so the gate catches regressions at the text level (same pattern as the other guards).
  {
    const storeSrc = readFileSync(join(import.meta.dirname, '..', 'src', 'state', 'useStore.ts'), 'utf-8');
    const hasUnknownSlotGuard = storeSrc.includes('slot not found in the active session plan');
    check('P2: logSet errors on unknown explicit sessionPlanSlotId (no silent movement-fallback)', hasUnknownSlotGuard);
    if (!hasUnknownSlotGuard) fail += 1;
  }
  // --- Store-boundary halt enforcement (Phase 17 spec) ----------------------------------
  // When the runner is in a halted or complete phase, logSet must refuse at the store
  // boundary before it even attempts a DB write. The runner itself rejects LOG_SET
  // events from terminal states (check [12] in verify:runner), but the store must also
  // surface a user-visible error rather than silently no-op.
  // We verify the production guard is present in source (same approach as the P2 check).
  {
    const storeSrc = readFileSync(join(import.meta.dirname, '..', 'src', 'state', 'useStore.ts'), 'utf-8');
    const hasHaltGuard = storeSrc.includes('cannot be logged in the current session state');
    check('store-boundary: logSet surfaces a user-visible error when runner rejects LOG_SET (halted/complete guard)', hasHaltGuard);
    if (!hasHaltGuard) fail += 1;

    // Verify the runner checkpoint also enforces it structurally: the HALT event
    // transitions to a terminal phase, and every subsequent LOG_SET is a strict no-op
    // (the runner returns the identical reference). We test this via the source
    // assertion that the guard checks for an identity-equal runner after advance.
    const hasIdentityGuard = storeSrc.includes('nextRunner === state.runner') || storeSrc.includes('nextRunner === runner');
    check('store-boundary: store checks runner identity-equality to detect no-ops from terminal phase events', hasIdentityGuard);
    if (!hasIdentityGuard) fail += 1;
  }
}

// --- Phase 18: immutable dose snapshots + atomic outcome finalization --------
{
  console.log('[Phase 18 store persistence contracts]');
  const sliceBetween = (startNeedle, endNeedle) => {
    const start = src.indexOf(startNeedle);
    const end = src.indexOf(endNeedle, start + startNeedle.length);
    return start >= 0 && end > start ? src.slice(start, end) : '';
  };
  const ordered = (body, needles) => {
    let cursor = -1;
    for (const needle of needles) {
      cursor = body.indexOf(needle, cursor + 1);
      if (cursor < 0) return false;
    }
    return true;
  };

  const logSetBody = sliceBetween('logSet: (movementId, reps', 'editSet: (setId, reps');
  const editSetBody = sliceBetween('editSet: (setId, reps', 'endSession: () => {');
  const hydrateBody = sliceBetween('const hydrateSessionFinalization =', 'const persistSessionOutcome =');
  const persistOutcomeBody = sliceBetween('const persistSessionOutcome =', 'const applyApreFinalization =');
  const applyApreBody = sliceBetween('const applyApreFinalization =', 'const runnerSelection =');
  const endSessionBody = sliceBetween('endSession: () => {', 'computePrescription: (_patterns) => {');

  a('Phase 18 implementation bodies are located',
    [logSetBody, editSetBody, hydrateBody, persistOutcomeBody, applyApreBody, endSessionBody]
      .every((body) => body.length > 0));

  const logBegin = logSetBody.indexOf("d.executeSync('BEGIN')");
  const logCommit = logSetBody.indexOf("d.executeSync('COMMIT')", logBegin);
  const logTxn = logBegin >= 0 && logCommit > logBegin ? logSetBody.slice(logBegin, logCommit) : '';
  a('dose snapshot is written in the set transaction after record + provenance and before checkpoint/commit',
    ordered(logTxn, [
      'INSERT INTO set_record',
      'INSERT INTO set_target',
      'INSERT INTO set_dose_target',
      'persistRunnerCheckpoint(',
    ]));
  a('dose snapshot binds the frozen prescribed target, never the actual logged dose',
    logSetBody.includes('const prescribedDose = planSlot?.target ?? null')
      && logTxn.includes('if (prescribedDose !== null)')
      && logTxn.includes('prescribedDose.kind === \'reps\' ? prescribedDose.reps : null')
      && logTxn.includes('prescribedDose.kind === \'time\' ? prescribedDose.seconds : null'));
  a('set memory is updated only after the dose transaction commits',
    logCommit >= 0 && logSetBody.indexOf('const logged: LoggedSet', logCommit) > logCommit);
  a('editing actual work cannot rewrite its immutable prescribed-dose snapshot',
    !/(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+set_dose_target\b/i.test(editSetBody));

  a('finalization hydrates every set with an optional frozen dose and timed actual evidence',
    hydrateBody.includes('LEFT JOIN set_dose_target')
      && hydrateBody.includes("LEFT JOIN set_metric tm ON tm.set_id = sr.set_id AND tm.metric = 'time_s'")
      && !hydrateBody.includes('JOIN session_slot_target'));
  a('APRE attribution binds source planned-slot identity and performed movement identity',
    hydrateBody.includes('st.source_planned_slot_id')
      && hydrateBody.includes('sourcePlannedSlotId: row.source_planned_slot_id')
      && applyApreBody.includes('planned_slot_id')
      && applyApreBody.includes('loggedSet.sourcePlannedSlotId === slot.planned_slot_id')
      && applyApreBody.includes('loggedSet.movementId === slot.movement_id'));
  a('finalization classifies exactly once from the hydrated snapshot',
    (endSessionBody.match(/evaluateSessionOutcome\s*\(/g) ?? []).length === 1
      && endSessionBody.includes('sets: snapshot.sets')
      && endSessionBody.includes('persistSessionOutcome(')
      && endSessionBody.includes('outcomeDecision,'));

  const evidenceFields = [
    'slotCount', 'plannedSetCount', 'loggedSetCount', 'exactDoseCount',
    'underDoseCount', 'overDoseCount', 'unknownDoseCount', 'unmappedSetCount',
    'missingSetCount', 'missingUnskippedSetCount', 'extraSetCount',
    'adaptedSlotCount', 'skippedSlotCount', 'offPlanSlotCount',
  ];
  a('one classifier decision directly supplies all durable evidence fields',
    persistOutcomeBody.includes('const evidence = outcomeDecision.evidence')
      && evidenceFields.every((field) => persistOutcomeBody.includes(`evidence.${field}`))
      && ['kind', 'terminalPhase', 'haltReason', 'finalizedAtMs', 'engineVersion']
        .every((field) => persistOutcomeBody.includes(`outcomeDecision.${field}`)));

  const endBegin = endSessionBody.indexOf("d.executeSync('BEGIN')");
  const endCommit = endSessionBody.indexOf("d.executeSync('COMMIT')", endBegin);
  const endTxn = endBegin >= 0 && endCommit > endBegin ? endSessionBody.slice(endBegin, endCommit) : '';
  const checkpointDelete = endTxn.indexOf('DELETE FROM session_runner_checkpoint');
  const afterCheckpointDelete = checkpointDelete >= 0
    ? endTxn.slice(checkpointDelete + 'DELETE FROM session_runner_checkpoint'.length)
    : '';
  const catchReturn = endSessionBody.indexOf('return;', endCommit);
  const successClear = endSessionBody.indexOf('session: null', catchReturn);
  a('outcome, session finalization, and checkpoint delete share one transaction',
    (endSessionBody.match(/d\.executeSync\('BEGIN'\)/g) ?? []).length === 1
      && (endSessionBody.match(/d\.executeSync\('COMMIT'\)/g) ?? []).length === 1
      && ordered(endTxn, [
        'hydrateSessionFinalization(',
        'evaluateSessionOutcome(',
        'UPDATE session SET session_rpe = ?, duration_min = ?',
        'MATERIALIZE_STATE_VECTOR_SQL',
        'applyApreFinalization(',
        'persistSessionOutcome(',
        'DELETE FROM session_runner_checkpoint',
      ]));
  a('checkpoint deletion is the final database mutation before finalization commit',
    checkpointDelete >= 0 && !afterCheckpointDelete.includes('executeSync(')
      && !afterCheckpointDelete.includes('persistSessionOutcome(')
      && !afterCheckpointDelete.includes('applyApreFinalization('));
  a('finalization failure rolls back and returns without clearing resumable state',
    endSessionBody.slice(endCommit, catchReturn).includes("d.executeSync('ROLLBACK')")
      && catchReturn >= 0);
  a('successful finalization clears memory only after the durable commit',
    endCommit >= 0 && successClear > catchReturn
      && !endSessionBody.slice(catchReturn, successClear).includes('executeSync('));

  const hydrationSql = statements.find((sql) => sql.includes('LEFT JOIN set_dose_target'));
  a('the exact frozen-dose hydration SQL is exposed to the store gate', Boolean(hydrationSql));
  if (hydrationSql) {
    let hydrationRan = false;
    db.exec('BEGIN');
    try {
      db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (18300,'2099-12-28',1000)");
      db.exec("INSERT INTO session_plan_slot (session_plan_slot_id,session_id,slot_index,movement_id,planned_sets,planned_reps,provenance_kind,target_rpe,source_planned_slot_id) VALUES (18300,18300,0,1,3,8,'planned',8,18300)");
      db.exec("INSERT INTO session_slot_target (session_plan_slot_id,target_kind,target_reps) VALUES (18300,'reps',8)");
      for (const [setId, setIndex, reps] of [[18301, 1, 5], [18302, 2, 6], [18303, 3, 1]]) {
        db.prepare('INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (?,18300,1,?,?,20,8,1100)')
          .run(setId, setIndex, reps);
        db.prepare("INSERT INTO set_target (set_id,session_plan_slot_id,provenance_kind,target_rpe,source_planned_slot_id,created_at_ms) VALUES (?,18300,'planned',8,18300,1100)")
          .run(setId);
      }
      db.exec("INSERT INTO set_dose_target (set_id,target_kind,target_reps) VALUES (18301,'reps',5)");
      db.exec("INSERT INTO set_dose_target (set_id,target_kind,target_seconds) VALUES (18303,'time',30)");
      db.exec("INSERT INTO set_metric (set_id,metric,value) VALUES (18303,'time_s',25)");
      const beforeMutation = db.prepare(hydrationSql).all(18300);
      db.exec("UPDATE session_slot_target SET target_reps=9 WHERE session_plan_slot_id=18300");
      const afterMutation = db.prepare(hydrationSql).all(18300);
      const frozen = afterMutation.find((row) => Number(row.set_id) === 18301);
      const legacy = afterMutation.find((row) => Number(row.set_id) === 18302);
      const timed = afterMutation.find((row) => Number(row.set_id) === 18303);
      a('per-set target survives later session-slot mutation unchanged',
        Number(beforeMutation.find((row) => Number(row.set_id) === 18301)?.target_reps) === 5
          && Number(frozen?.target_reps) === 5);
      a('LEFT JOIN retains historical sets with honestly absent dose evidence',
        afterMutation.length === 3 && legacy?.target_kind === null);
      a('timed target and actual seconds hydrate from their immutable/metric side-cars',
        timed?.target_kind === 'time' && Number(timed.target_seconds) === 30 && Number(timed.time_s) === 25);
      hydrationRan = true;
    } finally {
      db.exec('ROLLBACK');
    }
    a('frozen-target hydration probe completed', hydrationRan);
  }

  const apreSourceSql = statements.find((sql) => sql.includes("COALESCE(psm.schema_type, bm.schema_type) = 'APRE'") && sql.includes('ps.week_index'));
  const apreSourceSlotsSql = statements.find((sql) => sql.includes('sl.planned_slot_id, sl.movement_id, sl.reps, orm.load_kg AS one_rm_kg'));
  const apreNextSlotSql = statements.find((sql) => sql.includes('SELECT sl.planned_slot_id, sl.reps, sl.target_rpe') && sql.includes('ps.week_index = ?'));
  const apreExistingOverrideSql = statements.find((sql) => sql.startsWith('SELECT target_load_kg FROM slot_override'));
  const apreUpsertSql = statements.find((sql) => sql.startsWith('INSERT INTO slot_override') && sql.includes('ON CONFLICT(planned_slot_id)'));
  a('exact production APRE read/write SQL is exposed to the attribution regression',
    Boolean(apreSourceSql) && Boolean(apreSourceSlotsSql) && Boolean(apreNextSlotSql)
      && Boolean(apreExistingOverrideSql) && Boolean(apreUpsertSql));
  if (
    hydrationSql && apreSourceSql && apreSourceSlotsSql && apreNextSlotSql
    && apreExistingOverrideSql && apreUpsertSql
  ) {
    const runApreContract = (sourcePlannedSessionId, loggedSets, finalizedAtMs) => {
      const source = db.prepare(apreSourceSql).get(sourcePlannedSessionId);
      if (source === undefined || Number(source.week_index) >= 4) return;
      const sourceSlots = db.prepare(apreSourceSlotsSql).all(sourcePlannedSessionId);
      for (const slot of sourceSlots) {
        if (slot.one_rm_kg === null) continue;
        const bestReps = loggedSets
          .filter((loggedSet) =>
            loggedSet.sourcePlannedSlotId === Number(slot.planned_slot_id)
              && loggedSet.movementId === Number(slot.movement_id))
          .reduce((best, loggedSet) => Math.max(best, loggedSet.reps), 0);
        const surplus = bestReps - Number(slot.reps);
        if (surplus <= 0) continue;
        const nextSlot = db.prepare(apreNextSlotSql).get(
          Number(source.block_id), Number(source.week_index) + 1, Number(slot.movement_id),
        );
        if (nextSlot === undefined) continue;
        const existing = db.prepare(apreExistingOverrideSql).get(Number(nextSlot.planned_slot_id));
        if (existing === undefined) throw new Error('APRE attribution fixture requires a baseline override');
        const deltaKg = Math.min(7.5, Math.ceil(surplus / 2) * 2.5);
        db.prepare(apreUpsertSql).run(
          Number(nextSlot.planned_slot_id),
          Number(existing.target_load_kg) + deltaKg,
          `APRE probe: +${deltaKg} kg from source slot ${slot.planned_slot_id}`,
          finalizedAtMs,
        );
      }
    };
    const loggedSetsFromHydration = (sessionId) => db.prepare(hydrationSql).all(sessionId).map((row) => ({
      sourcePlannedSlotId: row.source_planned_slot_id === null ? null : Number(row.source_planned_slot_id),
      movementId: Number(row.movement_id),
      reps: Number(row.reps),
    }));
    const overrideLoads = () => Object.fromEntries(db.prepare(
      'SELECT planned_slot_id,target_load_kg FROM slot_override WHERE planned_slot_id IN (18621,18622) ORDER BY planned_slot_id',
    ).all().map((row) => [Number(row.planned_slot_id), Number(row.target_load_kg)]));

    let apreCollisionRan = false;
    db.exec('BEGIN');
    try {
      db.exec("INSERT INTO movement (movement_id,name,pattern,is_compound) VALUES (18601,'APRE Collision A','squat',1)");
      db.exec("INSERT INTO movement (movement_id,name,pattern,is_compound) VALUES (18602,'APRE Collision B','hinge',1)");
      db.exec('INSERT INTO one_rep_max (movement_id,load_kg,updated_at_ms) VALUES (18601,100,0),(18602,100,0)');
      db.exec("INSERT INTO training_block (block_id,start_date,objective,created_at_ms) VALUES (18600,'2099-12-01','strength',0)");
      db.exec("INSERT INTO block_meta (block_id,macro_block_index,macro_phase,schema_type) VALUES (18600,1,'gpp','APRE')");
      db.exec("INSERT INTO planned_session (planned_session_id,block_id,week_index,day_index,focus,phase,session_date) VALUES (18610,18600,1,1,'lower','accumulation','2099-12-01')");
      db.exec("INSERT INTO planned_session (planned_session_id,block_id,week_index,day_index,focus,phase,session_date) VALUES (18620,18600,2,1,'lower','accumulation','2099-12-08')");
      db.exec("INSERT INTO planned_slot (planned_slot_id,planned_session_id,slot_index,movement_id,sets,reps,target_rpe) VALUES (18611,18610,1,18601,3,5,8),(18612,18610,2,18602,3,5,8)");
      db.exec("INSERT INTO planned_slot (planned_slot_id,planned_session_id,slot_index,movement_id,sets,reps,target_rpe) VALUES (18621,18620,1,18601,3,5,8),(18622,18620,2,18602,3,5,8)");
      db.exec("INSERT INTO slot_override (planned_slot_id,target_load_kg,reason,created_at_ms) VALUES (18621,100,'baseline A',0),(18622,100,'baseline B',0)");
      db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (18630,'2099-12-01',1000)");
      // Source slot B was substituted to movement A. Its 12 reps must not be
      // attributed to source slot A merely because the performed movement collides.
      db.exec("INSERT INTO session_plan_slot (session_plan_slot_id,session_id,slot_index,movement_id,planned_sets,planned_reps,provenance_kind,target_rpe,source_planned_slot_id,original_movement_id) VALUES (18631,18630,0,18601,1,5,'substituted',8,18612,18602)");
      db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (18631,18630,18601,1,12,100,8,1100)");
      db.exec("INSERT INTO set_target (set_id,session_plan_slot_id,provenance_kind,target_rpe,source_planned_slot_id,created_at_ms) VALUES (18631,18631,'substituted',8,18612,1100)");
      db.exec("INSERT INTO set_dose_target (set_id,target_kind,target_reps) VALUES (18631,'reps',5)");

      const collisionRows = db.prepare(hydrationSql).all(18630);
      const collisionLoggedSets = loggedSetsFromHydration(18630);
      runApreContract(18610, collisionLoggedSets, 2000);
      const afterCollision = overrideLoads();
      a('substituted collision retains source slot B + performed movement A identities',
        collisionRows.length === 1
          && Number(collisionRows[0].source_planned_slot_id) === 18612
          && Number(collisionRows[0].movement_id) === 18601);
      a('substituted reps cannot advance the wrong same-movement source slot',
        afterCollision[18621] === 100 && afterCollision[18622] === 100);

      // Positive control: a real movement-A set attributed to source slot A may
      // advance only movement A's next-week slot by the expected +2.5 kg.
      db.exec("INSERT INTO session_plan_slot (session_plan_slot_id,session_id,slot_index,movement_id,planned_sets,planned_reps,provenance_kind,target_rpe,source_planned_slot_id) VALUES (18632,18630,1,18601,1,5,'planned',8,18611)");
      db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (18632,18630,18601,2,7,100,8,1200)");
      db.exec("INSERT INTO set_target (set_id,session_plan_slot_id,provenance_kind,target_rpe,source_planned_slot_id,created_at_ms) VALUES (18632,18632,'planned',8,18611,1200)");
      db.exec("INSERT INTO set_dose_target (set_id,target_kind,target_reps) VALUES (18632,'reps',5)");
      runApreContract(18610, loggedSetsFromHydration(18630), 3000);
      const afterControl = overrideLoads();
      a('correctly attributed control set advances only its own future slot',
        afterControl[18621] === 102.5 && afterControl[18622] === 100);
      apreCollisionRan = true;
    } finally {
      db.exec('ROLLBACK');
    }
    a('APRE substitution-collision regression completed', apreCollisionRan);
  }
  const setRecordInsertSql = statements.find((sql) => sql.includes('INSERT INTO set_record (session_id, movement_id, set_index'));
  const setTargetInsertSql = statements.find((sql) => sql.includes('INSERT INTO set_target (set_id, session_plan_slot_id'));
  const doseInsertSql = statements.find((sql) => sql.includes('INSERT INTO set_dose_target (set_id, target_kind'));
  a('exact production SQL for all three atomic set rows is exposed',
    Boolean(setRecordInsertSql) && Boolean(setTargetInsertSql) && Boolean(doseInsertSql));
  if (setRecordInsertSql && setTargetInsertSql && doseInsertSql) {
    db.exec('DROP TRIGGER IF EXISTS wo183_poison_dose');
    db.exec("CREATE TEMP TRIGGER wo183_poison_dose BEFORE INSERT ON set_dose_target BEGIN SELECT RAISE(ABORT,'wo18.3 dose poison'); END");
    let dosePoisonThrew = false;
    let poisonedSetId = 0;
    db.exec('BEGIN');
    try {
      db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (18400,'2099-12-29',1000)");
      db.exec("INSERT INTO session_plan_slot (session_plan_slot_id,session_id,slot_index,movement_id,planned_sets,planned_reps,provenance_kind,target_rpe,source_planned_slot_id) VALUES (18400,18400,0,1,1,5,'planned',8,18400)");
      db.prepare(setRecordInsertSql).run(18400, 1, 1, 5, 20, 8, 1100);
      poisonedSetId = Number(db.prepare('SELECT last_insert_rowid() AS id').get().id);
      db.prepare(setTargetInsertSql).run(poisonedSetId, 18400, 'planned', 8, 18400, 1100);
      db.prepare(doseInsertSql).run(poisonedSetId, 'reps', 5, null);
      db.exec('COMMIT');
    } catch {
      dosePoisonThrew = true;
      db.exec('ROLLBACK');
    }
    db.exec('DROP TRIGGER wo183_poison_dose');
    const poisonedChildren = poisonedSetId === 0 ? 0 : Number(db.prepare(`
      SELECT (SELECT count(*) FROM set_record WHERE set_id=?)
           + (SELECT count(*) FROM set_target WHERE set_id=?)
           + (SELECT count(*) FROM set_dose_target WHERE set_id=?) AS c
    `).get(poisonedSetId, poisonedSetId, poisonedSetId).c);
    a('dose snapshot poison aborts the set record + both snapshots atomically',
      dosePoisonThrew && poisonedChildren === 0
        && Number(db.prepare('SELECT count(*) AS c FROM session WHERE session_id=18400').get().c) === 0);
  }

  const outcomeInsertSql = statements.find((sql) => sql.startsWith('INSERT INTO session_outcome'));
  const finalizeSessionSql = statements.find((sql) => sql.includes('UPDATE session SET session_rpe = ?, duration_min = ?'));
  const deleteCheckpointSql = statements.find((sql) => sql.includes('DELETE FROM session_runner_checkpoint WHERE session_id = ?'));
  const openSessionSql = statements.find((sql) => sql.includes('duration_min IS NULL AND started_at_ms IS NOT NULL'));
  a('exact production outcome/finalization/checkpoint SQL is exposed',
    Boolean(outcomeInsertSql) && Boolean(finalizeSessionSql)
      && Boolean(deleteCheckpointSql) && Boolean(openSessionSql));
  if (outcomeInsertSql && finalizeSessionSql && deleteCheckpointSql && openSessionSql) {
    const sessionId = 18500;
    const checkpointJson = '{"version":1,"probe":"wo18.3-exact-resume"}';
    const outcomeArgs = [
      sessionId, 'followed_plan', 'complete', null, 'planned', 'guided', 'beginner',
      1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5000, 1,
    ];
    db.exec('BEGIN');
    db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (18500,'2099-12-30',1000)");
    db.exec("INSERT INTO session_plan_slot (session_plan_slot_id,session_id,slot_index,movement_id,planned_sets,planned_reps,provenance_kind,target_rpe,source_planned_slot_id) VALUES (18500,18500,0,1,1,5,'planned',8,18500)");
    db.prepare(`INSERT INTO session_runner_checkpoint
      (session_id,session_mode,phase,current_session_plan_slot_id,current_set_index,
       rest_target_seconds,rest_started_at_ms,runner_state_json,updated_at_ms)
      VALUES (?,'guided','complete',NULL,NULL,0,NULL,?,4444)`).run(sessionId, checkpointJson);
    db.exec('COMMIT');

    const checkpointBefore = db.prepare('SELECT * FROM session_runner_checkpoint WHERE session_id=?').get(sessionId);
    db.exec('DROP TRIGGER IF EXISTS wo183_poison_checkpoint_delete');
    db.exec(`CREATE TEMP TRIGGER wo183_poison_checkpoint_delete
      BEFORE DELETE ON session_runner_checkpoint WHEN OLD.session_id=18500
      BEGIN SELECT RAISE(ABORT,'wo18.3 checkpoint poison'); END`);
    let finalizationPoisonThrew = false;
    db.exec('BEGIN');
    try {
      db.prepare(outcomeInsertSql).run(...outcomeArgs);
      db.prepare(finalizeSessionSql).run(8, 1.5, sessionId);
      db.prepare(deleteCheckpointSql).run(sessionId);
      db.exec('COMMIT');
    } catch {
      finalizationPoisonThrew = true;
      db.exec('ROLLBACK');
    }
    db.exec('DROP TRIGGER wo183_poison_checkpoint_delete');

    const checkpointAfter = db.prepare('SELECT * FROM session_runner_checkpoint WHERE session_id=?').get(sessionId);
    const sessionAfterRollback = db.prepare('SELECT session_rpe,duration_min FROM session WHERE session_id=?').get(sessionId);
    const resumable = db.prepare(openSessionSql).get('2099-12-30');
    a('late checkpoint-delete poison rolls outcome + session finalization back',
      finalizationPoisonThrew
        && db.prepare('SELECT 1 FROM session_outcome WHERE session_id=?').get(sessionId) === undefined
        && sessionAfterRollback?.session_rpe === null
        && sessionAfterRollback?.duration_min === null);
    a('rollback preserves the exact checkpoint and boot-visible unfinished session',
      JSON.stringify(checkpointAfter) === JSON.stringify(checkpointBefore)
        && checkpointAfter?.runner_state_json === checkpointJson
        && Number(resumable?.session_id) === sessionId);

    db.exec('BEGIN');
    db.prepare(outcomeInsertSql).run(...outcomeArgs);
    db.prepare(finalizeSessionSql).run(8, 1.5, sessionId);
    db.prepare(deleteCheckpointSql).run(sessionId);
    db.exec('COMMIT');
    const finalized = db.prepare('SELECT session_rpe,duration_min FROM session WHERE session_id=?').get(sessionId);
    a('same exact SQL succeeds atomically after the poison is removed',
      db.prepare('SELECT outcome_kind FROM session_outcome WHERE session_id=?').get(sessionId)?.outcome_kind === 'followed_plan'
        && Number(finalized?.session_rpe) === 8
        && Number(finalized?.duration_min) === 1.5
        && db.prepare('SELECT 1 FROM session_runner_checkpoint WHERE session_id=?').get(sessionId) === undefined);

    // FK-off cleanup follows the immutable parent-first rule used by resetTrainingData.
    db.exec('DELETE FROM session_plan_slot WHERE session_id=18500');
    db.exec('DELETE FROM session WHERE session_id=18500');
    db.exec('DELETE FROM session_outcome WHERE session_id=18500');
  }

  // --- [T2] latestLoadMap query plan & semantics check ---
  console.log('[latestLoadMap query plan & semantics]');
  const latestLoadSql = statements.find((s) => s.includes('FROM movement m') && s.includes('set_record'));
  a('store exposes latestLoadMap SQL literal', Boolean(latestLoadSql));
  if (latestLoadSql) {
    const eqp = db.prepare(`EXPLAIN QUERY PLAN ${latestLoadSql}`).all();
    const hasScanSetRecord = eqp.some((row) => row.detail && row.detail.includes('SCAN set_record'));
    a('latestLoadMap EXPLAIN QUERY PLAN contains no SCAN set_record', !hasScanSetRecord, JSON.stringify(eqp));

    db.exec('BEGIN');
    db.exec("INSERT INTO movement (movement_id,name,pattern,is_compound) VALUES (991,'No Set Movement','squat',1)");
    db.exec("INSERT INTO movement (movement_id,name,pattern,is_compound) VALUES (992,'BW Movement','squat',0)");
    db.exec("INSERT INTO movement (movement_id,name,pattern,is_compound) VALUES (993,'Weighted Movement','squat',1)");
    db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (991,'2026-06-01',0)");
    db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (991,991,992,1,10,0,7.0,0)");
    db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (992,991,993,1,5,80,7.0,0)");
    db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (993,991,993,2,5,85.5,8.0,0)");

    const rows = db.prepare(latestLoadSql).all();
    const map = Object.fromEntries(
      rows.filter((r) => r.load_kg !== null).map((r) => [r.movement_id, r.load_kg])
    );

    a('latestLoadMap: zero-set movement (991) is ABSENT', !(991 in map));
    a('latestLoadMap: last-set-was-0 movement (992) is PRESENT with 0', map[992] === 0, `got ${map[992]}`);
    a('latestLoadMap: weighted movement (993) has latest load_kg (85.5)', map[993] === 85.5, `got ${map[993]}`);
    db.exec('ROLLBACK');
  }

  // --- [T3] resolveGoalRung evidence window assertion ---
  console.log('[resolveGoalRung evidence window]');
  const goalRungSql = statements.find((s) => s.includes('WHERE p.progression_group = ? AND s.session_date >= date(?, ?)'));
  a('store exposes bounded resolveGoalRung SQL literal with bound date params', Boolean(goalRungSql));
  if (goalRungSql) {
    db.exec('BEGIN');
    db.exec("INSERT INTO movement (movement_id,name,pattern,is_compound) VALUES (981,'Window Test Pushup','push_h',0)");
    db.exec("INSERT INTO movement_progression (movement_id,progression_group,progression_rank) VALUES (981,'test_window_group',0)");

    // Session 981: inside 180-day window (today = 2026-06-01, session_date = 2026-05-01)
    db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (981,'2026-05-01',0)");
    db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (981,981,981,1,8,0,8.0,0)");
    db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (982,981,981,2,8,0,8.0,0)");
    db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (983,981,981,3,8,0,8.0,0)");

    // Session 982: outside 180-day window (today = 2026-06-01, session_date = 2025-10-01)
    db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (982,'2025-10-01',0)");
    db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (984,982,981,1,8,0,8.0,0)");
    db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (985,982,981,2,8,0,8.0,0)");
    db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (986,982,981,3,8,0,8.0,0)");

    const today = '2026-06-01';
    const windowParam = '-180 days';
    const rowsInside = db.prepare(goalRungSql).all('test_window_group', today, windowParam);
    a('qualifying session inside 180-day window returns sets', rowsInside.length === 3);

    // Delete session inside window and check session outside window
    db.exec("DELETE FROM set_record WHERE session_id = 981");
    db.exec("DELETE FROM session WHERE session_id = 981");
    const rowsOutside = db.prepare(goalRungSql).all('test_window_group', today, windowParam);
    a('byte-identical qualifying session dated outside 180-day window returns NO sets', rowsOutside.length === 0);

    db.exec('ROLLBACK');
  }

  // --- [T5] attestation writer SQL & FK integrity assertion ---
  console.log('[capability attestation SQL & FK integrity]');
  const attestInsertSql = statements.find((s) => s.includes('INSERT INTO movement_capability_attestation'));
  const attestDeleteSql = statements.find((s) => s.includes('DELETE FROM movement_capability_attestation WHERE prerequisite_movement_id'));
  a('store exposes exact attestation INSERT and DELETE SQL statements', Boolean(attestInsertSql) && Boolean(attestDeleteSql));
  if (attestInsertSql && attestDeleteSql) {
    db.exec('BEGIN');
    db.exec("INSERT INTO movement (movement_id,name,pattern,is_compound) VALUES (971,'Attest Prereq','push_h',0)");
    db.exec("INSERT INTO movement (movement_id,name,pattern,is_compound) VALUES (972,'Attest Target','push_h',0)");
    db.exec("INSERT INTO movement_capability_edge (prerequisite_movement_id,movement_id,relationship,requires_attestation) VALUES (971,972,'prerequisite',1)");

    db.prepare(attestInsertSql).run(971, 972, 1000);
    const row = db.prepare('SELECT * FROM movement_capability_attestation WHERE prerequisite_movement_id = 971 AND movement_id = 972').get();
    a('attestation row appears with FK integrity', Boolean(row) && Number(row.attested_at_ms) === 1000);

    db.prepare(attestDeleteSql).run(971, 972);
    const rowRevoked = db.prepare('SELECT * FROM movement_capability_attestation WHERE prerequisite_movement_id = 971 AND movement_id = 972').get();
    a('revoke SQL removes attestation row', rowRevoked === undefined);

    db.exec('ROLLBACK');
  }

  // --- [F3] Gate count & documentation drift assertion ---
  console.log('[documentation & CI gate count drift check]');
  const pkgJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
  const verifyAllScript = pkgJson.scripts['verify:all'] ?? '';
  const verifyInvocations = (verifyAllScript.match(/npm run verify:(?!all\b)[a-z0-9-]+/g) ?? []).length;

  const agentWorkflowContent = readFileSync(join(ROOT, 'AGENT_WORKFLOW.md'), 'utf-8');
  const ciYmlContent = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf-8');

  const workflowMatch = agentWorkflowContent.match(/npm run verify:all\s+#\s+(\d+)\s+gates/);
  const workflowGateCount = workflowMatch ? Number(workflowMatch[1]) : null;

  const ciMatches = Array.from(ciYmlContent.matchAll(/\((\d+)\s+gates/g));
  const ciGateCounts = ciMatches.map((m) => Number(m[1]));

  a('verify:all script invokes exactly 19 verify:* targets', verifyInvocations === 19, `got ${verifyInvocations}`);
  a('AGENT_WORKFLOW.md documents exact verify:all gate count', workflowGateCount === verifyInvocations, `documented ${workflowGateCount}, actual ${verifyInvocations}`);
  a('ci.yml documents exact verify:all gate count at all occurrences', ciGateCounts.length >= 1 && ciGateCounts.every((c) => c === verifyInvocations), `ci.yml counts: ${ciGateCounts.join(',')}`);

  // --- [T11] _chain_projection.sql.tpl equivalence check ---
  console.log('[SQL chain projection template equivalence check]');
  const tplPath = join(SCHEMA_DIR, '_chain_projection.sql.tpl');
  const tplSql = readFileSync(tplPath, 'utf-8');
  a('_chain_projection.sql.tpl contains WITH RECURSIVE walk', tplSql.includes('WITH RECURSIVE'));
  a('_chain_projection.sql.tpl deletes existing rows before insert', tplSql.includes('DELETE FROM movement_progression;'));

  db.exec(tplSql);
  const sqlProgressionRows = db.prepare('SELECT movement_id, progression_group, progression_rank FROM movement_progression ORDER BY progression_group, progression_rank').all();
  a('SQL chain projection template populates 10 movement_progression rows on 028 schema', sqlProgressionRows.length === 10, `got ${sqlProgressionRows.length}`);
}
console.log(`verify:store SQL — ${pass}/${pass + fail} checks green`);
process.exit(fail ? 1 : 0);
