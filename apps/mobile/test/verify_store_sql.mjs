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
  '024_phase17_equipment_fixes.sql']) {
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
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
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
for (const needle of ['derivePrescription(', 'rolloverDay', 'localToday()',
  // Phase 13 Step 4: the store must route block generation through the autopilot
  // (flaw detection + window projection), or the wiring is silently dead.
  'detectFlaws(', 'buildPatternWindow(', 'flawReport']) {
  const ok = src.includes(needle);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  store references ${needle}`);
  if (!ok) fail += 1;
}

// --- [Phase 13 Step 4] autopilot projection SQL: EXECUTED against seeded rows ----
// PREPARE only proves columns/syntax; the ΔE join + reciprocal attenuation are the
// signal the whole autopilot consumes, so run the EXACT store SQL on known data.
const a = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
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
if (resetTables.length >= 15) {
  const MAT = readFileSync(join(SCHEMA_DIR, '004_state_vector_materialize.sql'), 'utf-8').replace(/^--.*$/gm, '');
  db.exec('BEGIN');
  db.exec("INSERT INTO session (session_id,session_date,started_at_ms) VALUES (701,'2026-06-10',0)");
  db.exec("INSERT INTO set_record (set_id,session_id,movement_id,set_index,reps,load_kg,rpe,logged_at_ms) VALUES (701,701,1,1,5,100,8,0)");
  db.exec("INSERT INTO set_prefix (set_id,applied_prefixes,cns_load_modifier,stability_requirement_modifier,difficulty_modifier,effective_load_kg) VALUES (701,'[]',1,1,1,100)");
  db.exec("INSERT INTO niggle (id,region,severity,reported_at_ms) VALUES ('rn1','knee',5,1000)");
  db.exec("INSERT INTO one_rep_max (movement_id,load_kg,updated_at_ms) VALUES (1,100,0)");
  db.exec("INSERT INTO training_block (block_id,start_date,objective,created_at_ms) VALUES (701,'2026-06-01','strength',0)");
  db.exec("INSERT INTO planned_session (planned_session_id,block_id,week_index,day_index,focus,phase,session_date) VALUES (701,701,1,1,'lower','accumulation','2026-06-10')");
  db.exec("INSERT INTO planned_slot (planned_slot_id,planned_session_id,slot_index,movement_id,sets,reps,target_rpe) VALUES (701,701,1,1,4,5,8.0)");
  db.prepare(MAT).run('2026-06-10'); // materializes a state_vector row (mech_daily already filled by trigger)
  const cnt = (t) => Number(db.prepare(`SELECT count(*) c FROM ${t}`).get().c);
  const seeded = ['session', 'set_record', 'set_prefix', 'niggle', 'one_rep_max', 'training_block', 'planned_session', 'planned_slot', 'mech_daily', 'state_vector'];
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
    '024_phase17_equipment_fixes.sql'
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

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} STATEMENT(S) FAILED`}`);
process.exit(fail ? 1 : 0);
