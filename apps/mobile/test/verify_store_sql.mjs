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
  '018_logging_modes.sql', '019_movement_batch.sql']) {
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
  const rows = db.prepare(setAggSql).all('2026-06-01', '2026-06-15');
  const sq = rows.find((r) => r.pattern === 'squat');
  a('set-aggregate returns ONE (date,pattern) row for the seeded squat sets',
    rows.length === 1 && Boolean(sq) && Number(sq.set_count) === 2);
  a('ΔE join (by date+movement): sum_delta_rpe=(9−8)+(8−8)=1.0, delta_count=2',
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
  !/(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(session|set_record|set_prefix|mech_daily|niggle|state_vector)\b/i.test(gnb));
a('the ONLY write targets are training_block / block_meta / planned_session / planned_slot',
  [...gnb.matchAll(/(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+([a-z_]+)/gi)]
    .every((m) => ['training_block', 'block_meta', 'planned_session', 'planned_slot'].includes(m[1])));
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
    cnt('athlete_profile') === profBefore && profBefore === 1 && cnt('movement') === movBefore && movBefore === 109, // 30 shipped + 51 (016) + 15 (017) + 13 (019)
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

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} STATEMENT(S) FAILED`}`);
process.exit(fail ? 1 : 0);
