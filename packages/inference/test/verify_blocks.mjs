/**
 * verify_blocks.mjs â€” boundary invariants of the deterministic block engine.
 *
 * The generator was written to satisfy THESE laws, not vice versa:
 *   [1] Determinism bound â€” double-run deep-equality, no RNG.
 *   [2] Structural bound â€” exactly 4 weeks ending in deload; planned_slot
 *       CHECK domains; target RPE strictly within base_rpe_cap (rehab <= 7);
 *       deload volume strictly below week 1; duration cap bounds slots.
 *   [3] Equipment strictness bound â€” across ALL 1024 inventory subsets x all
 *       8 objectives, no emitted movement's required set escapes the
 *       inventory (subset law, no upward substitution).
 *   [4] Hybrid balance bound â€” every hybrid frequency contains bjj sessions
 *       AND carries strictly less raw strength set volume than the pure
 *       strength block.
 *   [5] SQL contract â€” 007's inventory default / preset bundles / item CHECK
 *       are byte-equal to the TS constants (one source of truth, verified).
 *   [6] Persistence â€” the plan round-trips through the real 007 tables with
 *       the store's literal SQL; cascade delete leaves no orphans.
 *
 * Run:  npm run verify:blocks
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);
const { generateBlock, addDaysIso, macroPhaseOf, targetLoadKg, targetPct,
  SCHEMA_FATIGUE_COST, MACRO_TOTAL_WEEKS } = require('./.build/blockGenerator.js');
const { computeSubstitutions, JOINTS } = require('./.build/substitution.js');
const { calculateEffectiveLoad } = require('./.build/conditionEngine.js');
const { DEFAULT_PROFILE, EQUIPMENT_ITEMS, EQUIPMENT_PRESETS, OBJECTIVES,
  SCHEMA_TYPES, MACRO_PHASES, TAXONOMY_CATEGORIES, TAXONOMY_IMPLEMENTS,
  MOVEMENT_PATTERNS, MOVEMENT_PREFIXES, DIFFICULTY_RATINGS, MOVEMENT_PREFERENCE,
  PATTERN_TO_CATEGORY } = require('./.build/types.js');

const SCHEMA_DIR = join(import.meta.dirname, '..', '..', 'core-db', 'src', 'schema');
const START = '2026-06-15';

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

// --- live schema + the store's movement query --------------------------------
const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON;');
try { db.prepare('SELECT ln(2.0), sqrt(2.0)').get(); } catch {
  db.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
  db.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
}
for (const f of ['001_mechanical_input.sql', '002_telemetry.sql', '003_state_vector.sql',
  '005_subjective_report.sql', '006_user_profile.sql', '007_program_engine.sql',
  '008_taxonomy.sql', '009_periodization.sql', '010_movement_library.sql',
  '011_niggle_tracking.sql', '012_report_severity.sql', '013_profile_slot.sql',
  '014_movement_prefixes.sql', '015_set_prefix.sql']) {
  db.exec(readFileSync(join(SCHEMA_DIR, f), 'utf-8'));
}
const movements = db.prepare(
  `SELECT m.movement_id, m.name, m.pattern, m.is_compound,
          (SELECT json_group_array(me.item) FROM movement_equipment me
           WHERE me.movement_id = m.movement_id) AS required_json
   FROM movement m ORDER BY m.movement_id`,
).all().map((r) => ({
  movement_id: Number(r.movement_id),
  name: r.name,
  pattern: r.pattern,
  is_compound: Number(r.is_compound) === 1,
  required: JSON.parse(r.required_json ?? '[]'),
}));
const requiredById = new Map(movements.map((m) => [m.movement_id, m.required]));
const prof = (over = {}) => ({ ...DEFAULT_PROFILE, ...over });
const gen = (over = {}) => generateBlock({ profile: prof(over), movements, startDate: START });

// --- [1] determinism bound ----------------------------------------------------
console.log('[1] determinism bound');
let detOk = true;
for (const objective of OBJECTIVES) {
  for (let weekly_frequency = 1; weekly_frequency <= 7; weekly_frequency++) {
    const a = JSON.stringify(gen({ objective, weekly_frequency }));
    const b = JSON.stringify(gen({ objective, weekly_frequency }));
    if (a !== b) detOk = false;
  }
}
check('double-run deep-equality across all objectives x all 7 frequencies', detOk,
  `${OBJECTIVES.length * 7} pairs`);

// --- [2] structural bound -----------------------------------------------------
console.log('[2] structural bound');
let weeks4 = true, endsDeload = true, counts = true, domains = true, capped = true,
  dupFree = true, datesOk = true, indexed = true, warnFree = true, deloadAll = true;
let nPlans = 0;
for (const objective of OBJECTIVES) {
  for (let f = 1; f <= 7; f++) {
    const plan = gen({ objective, weekly_frequency: f });
    nPlans += 1;
    // Deload law holds for EVERY plan, not just the strength default.
    const weekSets = (w) => plan.sessions.filter((s) => s.week_index === w)
      .reduce((a, s) => a + s.slots.reduce((b, sl) => b + sl.sets, 0), 0);
    if (!(weekSets(4) < weekSets(1))) deloadAll = false;
    if (plan.weeks !== 4) weeks4 = false;
    if (plan.warnings.length !== 0) warnFree = false; // full inventory: nothing missing
    if (plan.sessions.length !== f * 4) counts = false;
    for (const s of plan.sessions) {
      if (s.week_index === 4 && s.phase !== 'deload') endsDeload = false;
      if (s.week_index < 4 && s.phase === 'deload') endsDeload = false;
      const expectDate = addDaysIso(START, (s.week_index - 1) * 7 + (s.day_index - 1));
      if (s.session_date !== expectDate || !/^\d{4}-\d{2}-\d{2}$/.test(s.session_date)) datesOk = false;
      const seen = new Set();
      s.slots.forEach((sl, i) => {
        if (sl.slot_index !== i + 1) indexed = false;
        if (!Number.isInteger(sl.sets) || sl.sets < 1 || sl.sets > 10) domains = false;
        if (!Number.isInteger(sl.reps) || sl.reps < 1 || sl.reps > 30) domains = false;
        if (sl.target_rpe < 5.0 || sl.target_rpe > 10.0) domains = false;
        if (sl.target_rpe > prof().base_rpe_cap) capped = false;
        if (seen.has(sl.movement_id)) dupFree = false;
        seen.add(sl.movement_id);
      });
    }
  }
}
check('exactly 4 weeks, phases end in deload (and only week 4)', weeks4 && endsDeload,
  `${nPlans} plans`);
check('session count = weekly_frequency x 4 at full inventory', counts);
check('no warnings at full inventory', warnFree);
check('planned_slot CHECK domains hold (sets 1-10, reps 1-30, rpe 5-10)', domains);
check('target RPE never exceeds base_rpe_cap (default 9.0)', capped);
check('slot_index consecutive, no duplicate movement within a session', dupFree && indexed);
check('session dates = start + (week-1)*7 + (day-1)', datesOk);

const lowCap = gen({ objective: 'strength', base_rpe_cap: 6.0 });
check('base_rpe_cap 6.0 binds every slot',
  lowCap.sessions.every((s) => s.slots.every((sl) => sl.target_rpe <= 6.0)));
const rehab = gen({ objective: 'rehab' });
check('rehab never exceeds RPE 7.0',
  rehab.sessions.every((s) => s.slots.every((sl) => sl.target_rpe <= 7.0)));
const shortCap = gen({ session_duration_cap_min: 15 });
check('15-min duration cap bounds sessions to 2 slots',
  shortCap.sessions.every((s) => s.slots.length <= 2));
const setsOf = (plan) =>
  plan.sessions.reduce((a, s) => a + s.slots.reduce((b, sl) => b + sl.sets, 0), 0);
const w1 = (plan) => plan.sessions.filter((s) => s.week_index === 1);
const w4 = (plan) => plan.sessions.filter((s) => s.week_index === 4);
const strengthPlan = gen({ objective: 'strength' });
check('deload volume strictly below week 1 (EVERY objective x frequency)', deloadAll,
  `${nPlans} plans`);
check('deload volume strictly below week 1 (strength pin)',
  setsOf({ sessions: w4(strengthPlan) }) < setsOf({ sessions: w1(strengthPlan) }),
  `${setsOf({ sessions: w4(strengthPlan) })} < ${setsOf({ sessions: w1(strengthPlan) })}`);
const floorCap = gen({ objective: 'strength', base_rpe_cap: 5.0 });
check('base_rpe_cap 5.0 (the CHECK floor): every slot exactly RPE 5.0',
  floorCap.sessions.every((s) => s.slots.every((sl) => sl.target_rpe === 5.0)));
const beginner = gen({ objective: 'strength', training_age: 'beginner' });
const elite = gen({ objective: 'strength', training_age: 'elite' });
check('beginner block carries strictly less volume than elite',
  setsOf(beginner) < setsOf(elite), `${setsOf(beginner)} < ${setsOf(elite)}`);

// --- [3] equipment strictness bound (ALL 1024 subsets x 8 objectives) ----------
console.log('[3] equipment strictness bound');
let violations = 0, sweepPlans = 0;
for (const objective of OBJECTIVES) {
  for (let mask = 0; mask < 1 << EQUIPMENT_ITEMS.length; mask++) {
    const inventory = EQUIPMENT_ITEMS.filter((_, i) => mask & (1 << i));
    const plan = generateBlock({
      profile: prof({ objective, equipment_inventory: inventory }),
      movements,
      startDate: START,
    });
    sweepPlans += 1;
    const inv = new Set(inventory);
    for (const s of plan.sessions) {
      for (const sl of s.slots) {
        const req = requiredById.get(sl.movement_id);
        if (req === undefined || !req.every((item) => inv.has(item))) violations += 1;
      }
    }
  }
}
check('required âŠ† inventory for every emitted slot', violations === 0,
  `${sweepPlans} plans, ${violations} violations`);
const bare = gen({ equipment_inventory: [] });
check('empty inventory still yields a bodyweight-only plan',
  bare.sessions.length > 0 &&
  bare.sessions.every((s) => s.slots.every((sl) => requiredById.get(sl.movement_id).length === 0)));

// --- [4] hybrid balance bound ---------------------------------------------------
console.log('[4] hybrid balance bound');
const STRENGTH_FOCI = new Set(['lower', 'upper', 'full']);
const strengthSets = (plan) =>
  plan.sessions.filter((s) => STRENGTH_FOCI.has(s.focus))
    .reduce((a, s) => a + s.slots.reduce((b, sl) => b + sl.sets, 0), 0);
let bjjAlways = true, damped = true;
for (let f = 1; f <= 7; f++) {
  const hybrid = gen({ objective: 'hybrid', weekly_frequency: f });
  const pure = gen({ objective: 'strength', weekly_frequency: f });
  if (!hybrid.sessions.some((s) => s.focus === 'bjj')) bjjAlways = false;
  if (!(strengthSets(hybrid) < strengthSets(pure))) damped = false;
}
check('every hybrid frequency contains bjj focus sessions', bjjAlways);
check('hybrid strength set volume strictly below pure strength (all freqs)', damped);
const noMats = gen({
  objective: 'hybrid',
  equipment_inventory: EQUIPMENT_ITEMS.filter((i) => i !== 'mats'),
});
const bjjRoundId = movements.find((m) => m.name === 'BJJ Sparring Round').movement_id;
check('mats removed: bjj days fall back without ever emitting BJJ Sparring Round',
  noMats.sessions.some((s) => s.focus === 'bjj') &&
  noMats.sessions.every((s) => s.slots.every((sl) => sl.movement_id !== bjjRoundId)));

// --- [5] SQL contract: 007 literals == TS constants -----------------------------
console.log('[5] SQL contract (007 <-> types.ts single source of truth)');
const sql007 = readFileSync(join(SCHEMA_DIR, '007_program_engine.sql'), 'utf-8');
const grab = (re) => { const m = sql007.match(re); return m === null ? null : m[1]; };
check('athlete_profile default inventory == EQUIPMENT_ITEMS',
  grab(/equipment_inventory\s+TEXT NOT NULL DEFAULT\s+'(\[[^']+\])'/) === JSON.stringify(EQUIPMENT_ITEMS));
check("legacy 'home_basic' bundle == EQUIPMENT_PRESETS.home_basic",
  grab(/WHEN 'home_basic' THEN '(\[[^']+\])'/) === JSON.stringify(EQUIPMENT_PRESETS.home_basic));
check("legacy 'minimal' bundle == EQUIPMENT_PRESETS.minimal",
  grab(/WHEN 'minimal'\s+THEN '(\[[^']+\])'/) === JSON.stringify(EQUIPMENT_PRESETS.minimal));
check("legacy 'full_gym' bundle == EQUIPMENT_ITEMS",
  grab(/ELSE '(\[[^']+\])'/) === JSON.stringify(EQUIPMENT_ITEMS));
const itemList = grab(/item\s+TEXT NOT NULL CHECK \(item IN\s*\(([\s\S]*?)\)\)/);
const sqlItems = itemList === null ? [] : [...itemList.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
check('movement_equipment item CHECK == EQUIPMENT_ITEMS (set equality)',
  sqlItems.length === EQUIPMENT_ITEMS.length &&
  EQUIPMENT_ITEMS.every((i) => sqlItems.includes(i)));
const sql008 = readFileSync(join(SCHEMA_DIR, '008_taxonomy.sql'), 'utf-8');
const grab008 = (re) => { const m = sql008.match(re); return m === null ? '' : m[1]; };
const sqlCats = [...grab008(/category\s+TEXT NOT NULL CHECK \(category IN\s*\(([\s\S]*?)\)\)/)
  .matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
check('008 taxonomy category CHECK == TAXONOMY_CATEGORIES (set equality)',
  sqlCats.length === TAXONOMY_CATEGORIES.length &&
  TAXONOMY_CATEGORIES.every((c) => sqlCats.includes(c)));
const sqlImps = [...grab008(/implement\s+TEXT NOT NULL DEFAULT 'bodyweight' CHECK \(implement IN\s*\(([\s\S]*?)\)\)/)
  .matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
check('008 taxonomy implement CHECK == TAXONOMY_IMPLEMENTS (set equality)',
  sqlImps.length === TAXONOMY_IMPLEMENTS.length &&
  TAXONOMY_IMPLEMENTS.every((i) => sqlImps.includes(i)));
check('taxonomy skeleton: one row per category in the live schema',
  (() => {
    const rows = db.prepare(
      'SELECT category, count(*) AS c FROM movement_taxonomy GROUP BY category').all();
    return rows.length === TAXONOMY_CATEGORIES.length && rows.every((r) => Number(r.c) === 1);
  })());

// --- [6] persistence round-trip with the store's literal SQL --------------------
console.log('[6] persistence round-trip (007 tables, FK cascade)');
const plan = gen({ objective: 'hybrid' });
db.exec('BEGIN');
db.prepare("UPDATE training_block SET status = 'archived' WHERE status = 'active'").run();
db.prepare('INSERT INTO training_block (start_date, objective, created_at_ms) VALUES (?, ?, ?)')
  .run(plan.start_date, plan.objective, 0);
const blockId = Number(db.prepare('SELECT last_insert_rowid() AS id').get().id);
const insSession = db.prepare(
  'INSERT INTO planned_session (block_id, week_index, day_index, focus, phase, session_date) VALUES (?, ?, ?, ?, ?, ?)');
const insSlot = db.prepare(
  'INSERT INTO planned_slot (planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (?, ?, ?, ?, ?, ?)');
for (const s of plan.sessions) {
  insSession.run(blockId, s.week_index, s.day_index, s.focus, s.phase, s.session_date);
  const sid = Number(db.prepare('SELECT last_insert_rowid() AS id').get().id);
  for (const sl of s.slots) insSlot.run(sid, sl.slot_index, sl.movement_id, sl.sets, sl.reps, sl.target_rpe);
}
db.exec('COMMIT');
const nSessions = Number(db.prepare(
  'SELECT count(*) c FROM planned_session WHERE block_id = ?').get(blockId).c);
const nSlots = Number(db.prepare(
  `SELECT count(*) c FROM planned_slot ps JOIN planned_session p USING (planned_session_id)
   WHERE p.block_id = ?`).get(blockId).c);
check('every session + slot persists through the 007 CHECKs',
  nSessions === plan.sessions.length &&
  nSlots === plan.sessions.reduce((a, s) => a + s.slots.length, 0),
  `${nSessions} sessions, ${nSlots} slots`);
const back = db.prepare(
  `SELECT p.week_index, p.day_index, sl.slot_index, sl.movement_id, sl.sets, sl.reps, sl.target_rpe
   FROM planned_slot sl JOIN planned_session p USING (planned_session_id)
   WHERE p.block_id = ? ORDER BY p.week_index, p.day_index, sl.slot_index`).all(blockId);
const flat = plan.sessions.flatMap((s) =>
  s.slots.map((sl) => [s.week_index, s.day_index, sl.slot_index, sl.movement_id, sl.sets, sl.reps, sl.target_rpe]));
check('read-back is value-identical to the generated plan',
  JSON.stringify(back.map((r) => [Number(r.week_index), Number(r.day_index), Number(r.slot_index),
    Number(r.movement_id), Number(r.sets), Number(r.reps), Number(r.target_rpe)])) === JSON.stringify(flat));
// block_meta rides along with the same literal SQL the store will use.
db.prepare(
  'INSERT INTO block_meta (block_id, macro_block_index, macro_phase, schema_type, peak_shifted) VALUES (?, ?, ?, ?, ?)')
  .run(blockId, plan.macroBlockIndex, plan.macroPhase, plan.schemaType, plan.peakShifted ? 1 : 0);
const metaBack = db.prepare('SELECT * FROM block_meta WHERE block_id = ?').get(blockId);
check('block_meta persists schema/macro position through the 009 CHECKs',
  metaBack.schema_type === plan.schemaType &&
  Number(metaBack.macro_block_index) === plan.macroBlockIndex &&
  metaBack.macro_phase === plan.macroPhase);
db.prepare('DELETE FROM training_block WHERE block_id = ?').run(blockId);
const orphans = Number(db.prepare(
  `SELECT (SELECT count(*) FROM planned_session) + (SELECT count(*) FROM planned_slot) +
          (SELECT count(*) FROM block_meta) AS c`).get().c);
check('block delete cascades sessions + slots + meta (no orphans)', orphans === 0, String(orphans));

// --- [7] multi-schema strategy bound --------------------------------------------
console.log('[7] multi-schema strategies (LINEAR / WAVE / STEP / APRE)');
// Weekly loading signature: (sets, reps, rpe) of the first strength slot for
// weeks 1..3. Distinct signatures => mathematically distinct progressions
// (and distinct target weights, since load = 1RM x pct(reps, rpe)).
const signatureOf = (plan) => [1, 2, 3].map((w) => {
  const s = plan.sessions.find((x) => x.week_index === w && x.focus !== 'bjj' && x.focus !== 'conditioning');
  const sl = s.slots[0];
  return `${sl.sets}x${sl.reps}@${sl.target_rpe}`;
}).join('|');
const sigs = SCHEMA_TYPES.map((schemaType) =>
  signatureOf(generateBlock({ profile: prof({ objective: 'strength' }), movements, startDate: START, schemaType })));
let distinct = true;
for (let i = 0; i < sigs.length; i++) {
  for (let j = i + 1; j < sigs.length; j++) if (sigs[i] === sigs[j]) distinct = false;
}
check('all four schema types yield pairwise-distinct load progressions', distinct,
  sigs.join('  vs  '));
let schemaLaws = true, schemaDet = true;
let nSchemaPlans = 0;
for (const schemaType of SCHEMA_TYPES) {
  for (let macroBlockIndex = 1; macroBlockIndex <= 8; macroBlockIndex++) {
    const mk = () => generateBlock({
      profile: prof({ objective: 'hybrid' }), movements, startDate: START,
      schemaType, macroBlockIndex,
    });
    const p = mk();
    nSchemaPlans += 1;
    if (JSON.stringify(p) !== JSON.stringify(mk())) schemaDet = false;
    if (p.macroPhase !== macroPhaseOf(macroBlockIndex)) schemaLaws = false;
    for (const s of p.sessions) {
      for (const sl of s.slots) {
        if (!Number.isInteger(sl.sets) || sl.sets < 1 || sl.sets > 10 ||
            !Number.isInteger(sl.reps) || sl.reps < 1 || sl.reps > 30 ||
            sl.target_rpe < 5.0 || sl.target_rpe > 10.0 ||
            sl.target_rpe > prof().base_rpe_cap) schemaLaws = false;
      }
    }
  }
}
check('every schema x macro block: deterministic + CHECK domains + rpe caps hold',
  schemaDet && schemaLaws, `${nSchemaPlans} plans`);
check('32-week macro = 8 blocks, two per phase (gpp,hypertrophy,volume,peak)',
  MACRO_TOTAL_WEEKS === 32 &&
  [1, 2, 3, 4, 5, 6, 7, 8].map(macroPhaseOf).join(',') ===
  'gpp,gpp,hypertrophy,hypertrophy,volume,volume,peak,peak');

// --- [8] 1RM translation matrix --------------------------------------------------
console.log('[8] RPE/rep -> %1RM translation (Epley)');
check('100 kg 1RM, 5 reps @ RPE 8.0 -> 80.0 kg', targetLoadKg(100, 5, 8.0) === 80.0,
  String(targetLoadKg(100, 5, 8.0)));
check('140 kg 1RM, 3 reps @ RPE 9.0 -> 122.5 kg', targetLoadKg(140, 3, 9.0) === 122.5,
  String(targetLoadKg(140, 3, 9.0)));
check('60 kg 1RM, 12 reps @ RPE 6.5 -> 40.0 kg', targetLoadKg(60, 12, 6.5) === 40.0,
  String(targetLoadKg(60, 12, 6.5)));
check('pct rises with RPE at fixed reps', targetPct(5, 9.0) > targetPct(5, 7.0));
check('pct falls as reps rise at fixed RPE', targetPct(3, 8.0) > targetPct(10, 8.0));
check('1 rep @ RPE 10 approaches the 1RM', targetPct(1, 10) > 0.95 && targetPct(1, 10) <= 1.0);

// --- [9] the hybrid tax -----------------------------------------------------------
console.log('[9] hybrid tax (schema fatigue cost matrix)');
const accessorySets = (plan) => plan.sessions
  .filter((s) => ['lower', 'upper', 'full'].includes(s.focus))
  .reduce((a, s) => a + s.slots.filter((sl) => sl.slot_index >= 3).reduce((b, sl) => b + sl.sets, 0), 0);
const hybridApre = generateBlock({
  profile: prof({ objective: 'hybrid' }), movements, startDate: START, schemaType: 'APRE' });
const hybridLinear = generateBlock({
  profile: prof({ objective: 'hybrid' }), movements, startDate: START, schemaType: 'LINEAR' });
check('hybrid APRE block has strictly fewer accessory sets than hybrid LINEAR',
  accessorySets(hybridApre) < accessorySets(hybridLinear),
  `${accessorySets(hybridApre)} < ${accessorySets(hybridLinear)}`);
const strengthApre = generateBlock({
  profile: prof({ objective: 'strength' }), movements, startDate: START, schemaType: 'APRE' });
const strengthLinear = generateBlock({
  profile: prof({ objective: 'strength' }), movements, startDate: START, schemaType: 'LINEAR' });
check('the tax fires ONLY for hybrid (strength APRE keeps its accessory sets)',
  accessorySets(strengthApre) === accessorySets(strengthLinear),
  `${accessorySets(strengthApre)} == ${accessorySets(strengthLinear)}`);
check('cost matrix: APRE outweighs LINEAR in every macro phase',
  MACRO_PHASES.every((p) => SCHEMA_FATIGUE_COST.APRE[p] > SCHEMA_FATIGUE_COST.LINEAR[p]));
check('hybrid APRE accessories never fall below one working set',
  hybridApre.sessions.every((s) => s.slots.every((sl) => sl.sets >= 1)));

// --- [10] deadlift auto-regulation (peak shift) -----------------------------------
console.log('[10] deadlift auto-regulation (ACWR gate on the peak block)');
const peakCalm = generateBlock({
  profile: prof({ objective: 'strength' }), movements, startDate: START,
  schemaType: 'LINEAR', macroBlockIndex: 7, recentAcwr: 1.0 });
const peakHot = generateBlock({
  profile: prof({ objective: 'strength' }), movements, startDate: START,
  schemaType: 'LINEAR', macroBlockIndex: 7, recentAcwr: 1.7 });
const gppHot = generateBlock({
  profile: prof({ objective: 'strength' }), movements, startDate: START,
  schemaType: 'LINEAR', macroBlockIndex: 1, recentAcwr: 1.7 });
check('calm ACWR: peak block keeps the normal shape (deload week 4)',
  !peakCalm.peakShifted &&
  peakCalm.sessions.filter((s) => s.week_index === 4).every((s) => s.phase === 'deload'));
check('overreached ACWR: deload inserted week 1, peak shifted to week 4',
  peakHot.peakShifted &&
  peakHot.sessions.filter((s) => s.week_index === 1).every((s) => s.phase === 'deload') &&
  peakHot.sessions.filter((s) => s.week_index === 4).every((s) => s.phase === 'realization'));
const wkSets = (plan, w) => plan.sessions.filter((s) => s.week_index === w)
  .reduce((a, s) => a + s.slots.reduce((b, sl) => b + sl.sets, 0), 0);
check('shifted block: week 1 (deload) volume strictly below week 2',
  wkSets(peakHot, 1) < wkSets(peakHot, 2), `${wkSets(peakHot, 1)} < ${wkSets(peakHot, 2)}`);
check('the gate only guards the peak phase (gpp ignores hot ACWR)',
  !gppHot.peakShifted &&
  gppHot.sessions.filter((s) => s.week_index === 4).every((s) => s.phase === 'deload'));
check('null ACWR (no telemetry) never shifts the peak',
  !generateBlock({ profile: prof({ objective: 'strength' }), movements, startDate: START,
    schemaType: 'LINEAR', macroBlockIndex: 7, recentAcwr: null }).peakShifted);

// --- [11] 010 movement library contract (types.ts <-> 010 SQL/seed) --------------
console.log('[11] 010 movement library contract (Phase 12)');
const sql010 = readFileSync(join(SCHEMA_DIR, '010_movement_library.sql'), 'utf-8');
const grab010 = (re) => { const m = sql010.match(re); return m === null ? '' : m[1]; };
const sqlDiff = [...grab010(/difficulty_rating[\s\S]*?CHECK \(difficulty_rating IN\s*\(([\s\S]*?)\)\)/)
  .matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]);
check('010 difficulty_rating CHECK == DIFFICULTY_RATINGS (set equality)',
  sqlDiff.length === DIFFICULTY_RATINGS.length &&
  DIFFICULTY_RATINGS.every((d) => sqlDiff.includes(d)), sqlDiff.join(','));
const sqlPref = [...grab010(/preference\s+INTEGER NOT NULL DEFAULT 0 CHECK \(preference IN\s*\(([\s\S]*?)\)\)/)
  .matchAll(/-?\d+/g)].map((m) => Number(m[0]));
const prefVals = Object.values(MOVEMENT_PREFERENCE);
check('010 preference CHECK == MOVEMENT_PREFERENCE domain (set equality)',
  sqlPref.length === prefVals.length && prefVals.every((v) => sqlPref.includes(v)),
  sqlPref.join(','));
const detailRows = db.prepare('SELECT supported_prefixes FROM movement_detail').all();
const prefixSet = new Set(MOVEMENT_PREFIXES);
const seenPrefixes = new Set();
let prefixOk = detailRows.length === 30;
for (const r of detailRows) {
  for (const p of JSON.parse(r.supported_prefixes)) {
    seenPrefixes.add(p);
    if (!prefixSet.has(p)) prefixOk = false;
  }
}
check('every seeded supported_prefixes token is a MOVEMENT_PREFIXES member',
  prefixOk, `${seenPrefixes.size} distinct tokens over ${detailRows.length} rows`);
check('movement_detail seeded for all 30 movements (base stored once per pattern)',
  Number(db.prepare('SELECT count(*) c FROM movement_detail').get().c) === 30 &&
  Number(db.prepare("SELECT count(DISTINCT base_name) c FROM movement_detail").get().c) < 30);
check('PATTERN_TO_CATEGORY total over MOVEMENT_PATTERNS -> TAXONOMY_CATEGORIES',
  Object.keys(PATTERN_TO_CATEGORY).length === MOVEMENT_PATTERNS.length &&
  MOVEMENT_PATTERNS.every((p) => TAXONOMY_CATEGORIES.includes(PATTERN_TO_CATEGORY[p])));

// --- [12] 3-tier substitution engine --------------------------------------------
console.log('[12] 3-tier substitution engine (regression / day-swap / triage)');
const detailById = new Map(db.prepare(
  'SELECT movement_id, base_name, difficulty_rating FROM movement_detail').all()
  .map((r) => [Number(r.movement_id), r]));
const subLib = movements.map((m) => ({
  movement_id: m.movement_id,
  name: m.name,
  pattern: m.pattern,
  is_compound: m.is_compound,
  difficulty: detailById.get(m.movement_id).difficulty_rating,
  family: detailById.get(m.movement_id).base_name,
  required: m.required,
  preference: 0,
}));
const byName = (n) => subLib.find((m) => m.name === n);
const idOf = (n) => byName(n).movement_id;
const RANK = { Beginner: 0, Intermediate: 1, Advanced: 2 };
const baseInput = {
  target: byName('Competition Squat'), library: subLib,
  inventory: [...EQUIPMENT_ITEMS], niggles: [], futureSlots: [], currentDayIndex: 1,
};

// determinism
check('substitution double-run deep-equality (no RNG, no clock)',
  JSON.stringify(computeSubstitutions(baseInput)) === JSON.stringify(computeSubstitutions(baseInput)));
let subDet = true;
const detFuture = [{ plannedSlotId: 77, dayIndex: 5, movement: byName('Cable Row'), sets: 4 }];
for (const m of subLib) {
  const inp = { target: m, library: subLib, inventory: [...EQUIPMENT_ITEMS],
    niggles: [{ region: 'knee', severity: 4 }], futureSlots: detFuture, currentDayIndex: 2 };
  if (JSON.stringify(computeSubstitutions(inp)) !== JSON.stringify(computeSubstitutions(inp))) subDet = false;
}
check('determinism across all 30 targets (niggle + future slots)', subDet, `${subLib.length} targets`);

// Layer 1 regression (green)
const squat = computeSubstitutions(baseInput).layer1Regression;
const squatNames = squat.options.map((o) => o.name);
check('Layer 1 colour is green', squat.color === 'green');
check('Competition Squat regresses to Front Squat AND Goblet Squat',
  squatNames.includes('Front Squat') && squatNames.includes('Goblet Squat'), squatNames.join(', '));
check('Layer 1 options are same-pattern (squat) and ordered easiest-first',
  squat.options.every((o) => byName(o.name).pattern === 'squat') &&
  squat.options.every((o, i) => i === 0 || RANK[squat.options[i - 1].difficulty] <= RANK[o.difficulty]));
const fsq = computeSubstitutions({ ...baseInput, target: byName('Front Squat') }).layer1Regression.options;
check('regression never offers a HARDER variant (Front Squat omits Competition Squat)',
  fsq.every((o) => o.difficulty !== 'Advanced') && !fsq.map((o) => o.name).includes('Competition Squat'),
  fsq.map((o) => `${o.name}:${o.difficulty}`).join(', '));
const bwOnly = computeSubstitutions({ ...baseInput, inventory: [] }).layer1Regression.options;
check('empty inventory: Layer 1 yields only no-equipment movements (strict subset law)',
  bwOnly.length > 0 && bwOnly.every((o) => byName(o.name).required.length === 0),
  bwOnly.map((o) => o.name).join(', '));

// injury guardrail + Layer 3 (orange)
const knee = computeSubstitutions({ ...baseInput, niggles: [{ region: 'left knee', severity: 4 }] });
check('knee niggle bars every knee-loading squat regression from Layer 1 (guardrail)',
  knee.layer1Regression.options.length === 0 &&
  knee.blockedByGuardrail.includes(idOf('Goblet Squat')) &&
  knee.blockedByGuardrail.includes(idOf('Front Squat')));
check('Layer 3 colour is orange and the niggle triggers a cluster',
  knee.layer3Triage.color === 'orange' && knee.layer3Triage.cluster !== null);
check('Layer 3 cluster is CNS-capped at 3 (ratio == cluster size)',
  knee.layer3Triage.cluster.movements.length <= 3 &&
  knee.layer3Triage.cluster.cnsTaxRatio === knee.layer3Triage.cluster.movements.length);
check('Layer 3 accessories are all non-compound and none guardrail-blocked',
  knee.layer3Triage.cluster.movements.every((mm) =>
    byName(mm.name).is_compound === false && !knee.blockedByGuardrail.includes(mm.movement_id)));
const calm = computeSubstitutions({ ...baseInput, target: byName('Competition Bench'),
  niggles: [{ region: 'knee', severity: 2 }] });
check('sub-threshold niggle (severity 2) does NOT trigger Layer 3', calm.layer3Triage.cluster === null);

// Layer 2 day-swap + conservation of volume (purple)
const futureSlots = [
  { plannedSlotId: 77, dayIndex: 5, movement: byName('Cable Row'), sets: 4 },              // row, later
  { plannedSlotId: 78, dayIndex: 5, movement: byName('Front Squat'), sets: 3 },            // wrong category
  { plannedSlotId: 79, dayIndex: 1, movement: byName('Single-Arm Dumbbell Row'), sets: 5 }, // row but not later
];
const ds = computeSubstitutions({ target: byName('Barbell Row'), library: subLib,
  inventory: [...EQUIPMENT_ITEMS], niggles: [], futureSlots, currentDayIndex: 2 }).layer2DaySwap;
check('Layer 2 colour is purple', ds.color === 'purple');
check('Layer 2 pulls only same-category, strictly-later slots',
  ds.options.length === 1 && ds.options[0].name === 'Cable Row' && ds.options[0].fromDayIndex === 5,
  ds.options.map((o) => `${o.name}@${o.fromDayIndex}`).join(', '));
check('conservation of volume: setsConserved == origin slot sets, origin slot identified',
  ds.options[0].setsConserved === 4 && ds.options[0].plannedSlotId === 77);

// sentiment routing
const avoidLib = subLib.map((m) => m.name === 'Goblet Squat' ? { ...m, preference: -1 } : m);
const avoid = computeSubstitutions({ ...baseInput, library: avoidLib }).layer1Regression.options.map((o) => o.name);
check('Avoid (-1) hard-excludes a movement from Layer 1', !avoid.includes('Goblet Squat'), avoid.join(', '));
const prioLib = subLib.map((m) => m.name === 'Bodyweight Squat' ? { ...m, preference: 1 } : m);
const prio = computeSubstitutions({ ...baseInput, library: prioLib }).layer1Regression.options.map((o) => o.name);
check('Prioritize (+1) outranks a neutral same-difficulty peer with a lower id',
  prio.indexOf('Bodyweight Squat') < prio.indexOf('Goblet Squat'), prio.join(', '));

// --- [13] 011 niggle region CHECK == JOINTS (engine severity source) -------------
console.log('[13] 011 niggle region contract (011 SQL <-> substitution.ts JOINTS)');
const sql011 = readFileSync(join(SCHEMA_DIR, '011_niggle_tracking.sql'), 'utf-8');
const regionMatch = sql011.match(/region\s+TEXT NOT NULL CHECK \(region IN\s*\(([\s\S]*?)\)\)/);
const sqlRegions = regionMatch === null ? []
  : [...regionMatch[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
check('011 region CHECK == JOINTS (set equality)',
  sqlRegions.length === JOINTS.length && JOINTS.every((j) => sqlRegions.includes(j)),
  sqlRegions.join(','));
// The engine actually routes a niggle stored under each JOINTS token: a
// severity-4 niggle on a knee-loading compound must trip the guardrail.
const kneeNiggle = computeSubstitutions({ ...baseInput,
  niggles: [{ region: 'knee', severity: 4 }] });
check('a niggle stored under a JOINTS token reaches the guardrail',
  kneeNiggle.blockedByGuardrail.length > 0);

// --- [14] experience-weighted niggle thresholds (Phase 12 Step 5) -------------
console.log('[14] experience-weighted niggle thresholds (DOMS-vs-structural)');
const sub = (severity, trainingAge) => computeSubstitutions({ ...baseInput,
  niggles: [{ region: 'knee', severity }], trainingAge });
// Beginner tolerates more (assume DOMS): severity 4 is inert; 5 trips both.
check('beginner severity 4: no triage, no guardrail, no halt (benign DOMS)',
  sub(4, 'beginner').layer3Triage.cluster === null &&
  sub(4, 'beginner').blockedByGuardrail.length === 0 &&
  sub(4, 'beginner').haltAdvised === false);
check('beginner severity 5: triage fires + guardrail bars the knee',
  sub(5, 'beginner').layer3Triage.cluster !== null &&
  sub(5, 'beginner').blockedByGuardrail.length > 0);
// Elite reacts sooner (assume structural): severity 3 trips; 6 is halt territory.
check('elite severity 3: triage fires (structural)',
  sub(3, 'elite').layer3Triage.cluster !== null &&
  sub(3, 'elite').blockedByGuardrail.length > 0);
check('elite severity 6: halt advised, no triage cluster, guardrail still bars',
  sub(6, 'elite').haltAdvised === true &&
  sub(6, 'elite').layer3Triage.cluster === null &&
  sub(6, 'elite').blockedByGuardrail.length > 0);
// Default (no trainingAge) == intermediate baseline: trips at 4, not at 3.
check('default trainingAge == intermediate (severity 4 trips, 3 does not)',
  computeSubstitutions({ ...baseInput, niggles: [{ region: 'knee', severity: 4 }] })
    .layer3Triage.cluster !== null &&
  computeSubstitutions({ ...baseInput, niggles: [{ region: 'knee', severity: 3 }] })
    .layer3Triage.cluster === null);

console.log('[15] condition multipliers (014 movement_prefix + conditionEngine)');
const r2 = (n) => Math.round(n * 100) / 100;
const r4 = (n) => Math.round(n * 10000) / 10000;
const prefRows = db.prepare('SELECT prefix_name, cns_load_modifier AS cns,'
  + ' stability_requirement_modifier AS stab, difficulty_modifier AS diff FROM movement_prefix').all();
check('movement_prefix seeded (5 baseline conditions)', prefRows.length === 5,
  prefRows.map((r) => r.prefix_name).join(','));
check('every movement_prefix.prefix_name is a MOVEMENT_PREFIXES member (unified vocabulary)',
  prefRows.every((r) => prefixSet.has(r.prefix_name)),
  prefRows.map((r) => r.prefix_name).join(','));
const cond = (r) => ({ prefixName: r.prefix_name, cnsLoadModifier: r.cns,
  stabilityRequirementModifier: r.stab, difficultyModifier: r.diff });
const idn = calculateEffectiveLoad(100, []);
check('calculateEffectiveLoad([]) is identity (100 / 100 / 1.0)',
  idn.baseLoad === 100 && idn.effectiveLoad === 100 && idn.cnsLoad === 100 && idn.stabilityDemand === 1,
  `${idn.effectiveLoad}/${idn.cnsLoad}/${idn.stabilityDemand}`);
const kb = prefRows.find((r) => r.prefix_name === 'KB');
const one = calculateEffectiveLoad(100, [cond(kb)]);
check('single KB prefix folds the seeded weights (cns/eff/stab)',
  one.cnsLoad === r2(100 * kb.cns) && one.effectiveLoad === r2(100 * kb.diff)
  && one.stabilityDemand === r4(kb.stab),
  `${one.cnsLoad}/${one.effectiveLoad}/${one.stabilityDemand}`);
const ch = prefRows.find((r) => r.prefix_name === 'Chains');
const ab = calculateEffectiveLoad(100, [cond(kb), cond(ch)]);
const ba = calculateEffectiveLoad(100, [cond(ch), cond(kb)]);
check('two prefixes compound multiplicatively and are order-independent',
  ab.cnsLoad === ba.cnsLoad && ab.effectiveLoad === ba.effectiveLoad
  && ab.stabilityDemand === ba.stabilityDemand
  && ab.cnsLoad === r2(100 * kb.cns * ch.cns)
  && ab.effectiveLoad === r2(100 * kb.diff * ch.diff)
  && ab.stabilityDemand === r4(kb.stab * ch.stab),
  `${ab.cnsLoad} == ${ba.cnsLoad}`);
check('non-positive / non-finite base load clamps to 0',
  calculateEffectiveLoad(-50, [cond(kb)]).effectiveLoad === 0
  && calculateEffectiveLoad(NaN, [cond(kb)]).cnsLoad === 0);

// --- [16] Phase 13 Step 4 — autopilot block wiring -------------------------------
console.log('[16] autopilot block wiring (Phase 13 Step 4)');
const MK_THRESH = 0.3;
const makeFlawReport = (phiByPattern = {}, { halt = false } = {}) => {
  const patterns = {};
  let maxAbs = 0; let crit = null;
  for (const p of MOVEMENT_PATTERNS) {
    const spec = phiByPattern[p] ?? { phi: 0 };
    const phi = Math.round(spec.phi * 1e4) / 1e4;
    const flawClass = spec.flawClass ?? (phi >= MK_THRESH ? 'capacity_deficit'
      : phi <= -MK_THRESH ? 'latent_headroom' : 'neutral');
    patterns[p] = { pattern: p, phi, flawClass, observations: spec.obs ?? 21, maxJointSev: spec.maxJointSev ?? 0 };
    if (Math.abs(phi) > maxAbs) { maxAbs = Math.abs(phi); crit = p; }
  }
  return {
    patterns,
    windowSummary: { dominantFlaw: crit === null ? 'neutral' : patterns[crit].flawClass, maxAbsPhi: Math.round(maxAbs * 1e4) / 1e4, criticalPattern: crit },
    globalGuardrail: halt ? { load_multiplier: 1, set_delta: 0, rpe_cap_max: 10, halt: true, follow_up: null } : null,
  };
};
const genFR = (over, flawReport) => generateBlock({ profile: prof(over), movements, startDate: START, flawReport });
const patternOf = (mid) => movements.find((m) => m.movement_id === mid).pattern;
const ndSlots = (plan, patt) => plan.sessions.filter((s) => s.phase !== 'deload')
  .flatMap((s) => s.slots.filter((sl) => patternOf(sl.movement_id) === patt));

const plain = gen({ objective: 'strength' });
check('no flawReport → recovery=false, autopilotAdjusted=[] (backward compatible)',
  plain.recovery === false && Array.isArray(plain.autopilotAdjusted) && plain.autopilotAdjusted.length === 0);
const frMix = makeFlawReport({ squat: { phi: 0.5 }, hinge: { phi: -0.5 } });
check('autopilot block is deterministic (double-run deep-equality)',
  JSON.stringify(genFR({ objective: 'strength' }, frMix)) === JSON.stringify(genFR({ objective: 'strength' }, frMix)));

// capacity_deficit lowers prescribed effort AND trims sets for the pattern.
const defPlan = genFR({ objective: 'strength' }, makeFlawReport({ squat: { phi: 0.5 } }));
const baseSq = ndSlots(plain, 'squat');
const defSq = ndSlots(defPlan, 'squat');
check('capacity_deficit lowers squat target_rpe vs baseline',
  defSq.length === baseSq.length && defSq.every((sl, i) => sl.target_rpe <= baseSq[i].target_rpe) && defSq.some((sl, i) => sl.target_rpe < baseSq[i].target_rpe));
check('capacity_deficit trims squat sets vs baseline',
  defSq.every((sl, i) => sl.sets <= baseSq[i].sets) && defSq.some((sl, i) => sl.sets < baseSq[i].sets));
check('the adjusted pattern is recorded in autopilotAdjusted', defPlan.autopilotAdjusted.includes('squat') && defPlan.recovery === false);

// latent_headroom raises prescribed effort (bounded by base_rpe_cap).
const upPlan = genFR({ objective: 'strength' }, makeFlawReport({ squat: { phi: -0.5 } }));
const upSq = ndSlots(upPlan, 'squat');
check('latent_headroom raises squat target_rpe vs baseline (≤ base_rpe_cap)',
  upSq.some((sl, i) => sl.target_rpe > baseSq[i].target_rpe) && upSq.every((sl) => sl.target_rpe <= prof().base_rpe_cap));

// halt supremacy: recovery template — every week deload, volume dropped, no corrections.
const haltPlan = genFR({ objective: 'strength' }, makeFlawReport({ squat: { phi: 0.5 }, hinge: { phi: -0.5 } }, { halt: true }));
check('halt → recovery=true and EVERY session phase is deload',
  haltPlan.recovery === true && haltPlan.sessions.every((s) => s.phase === 'deload'));
check('halt recovery drops total volume strictly below the normal block',
  setsOf(haltPlan) < setsOf(plain), `${setsOf(haltPlan)} < ${setsOf(plain)}`);
check('halt suppresses all per-pattern corrections (autopilotAdjusted empty)', haltPlan.autopilotAdjusted.length === 0);
// recovery must BYPASS progressive overload — every strength slot shares the
// SAME (deload) target_rpe, so there is no week-over-week effort ramp. (Volume
// alone is blind to this: overload is carried by RPE, not set count.)
const haltRpes = haltPlan.sessions.filter((s) => ['lower', 'upper', 'full'].includes(s.focus))
  .flatMap((s) => s.slots.map((sl) => sl.target_rpe));
check('halt recovery is FLAT: no week-over-week RPE ramp (overload bypassed)',
  haltRpes.length > 0 && Math.max(...haltRpes) === Math.min(...haltRpes), `rpe range ${Math.min(...haltRpes)}..${Math.max(...haltRpes)}`);
const normRpes = plain.sessions.filter((s) => s.week_index <= 3 && ['lower', 'upper', 'full'].includes(s.focus))
  .flatMap((s) => s.slots.map((sl) => sl.target_rpe));
check('halt recovery effort sits below the normal block (deloaded)',
  Math.max(...haltRpes) < Math.max(...normRpes), `${Math.max(...haltRpes)} < ${Math.max(...normRpes)}`);

// the deload week is SACRED — corrections never touch it.
const wk4 = (plan) => plan.sessions.filter((s) => s.week_index === 4)
  .flatMap((s) => s.slots.map((sl) => [sl.movement_id, sl.sets, sl.reps, sl.target_rpe]));
check('deload week (4) is byte-identical with vs without corrections',
  JSON.stringify(wk4(plain)) === JSON.stringify(wk4(genFR({ objective: 'strength' }, makeFlawReport({ squat: { phi: 0.5 }, hinge: { phi: -0.5 } })))));

// corrected slots still satisfy the planned_slot CHECK domains.
let corrDomains = true;
for (const s of defPlan.sessions) for (const sl of s.slots) {
  if (!Number.isInteger(sl.sets) || sl.sets < 1 || sl.sets > 10) corrDomains = false;
  if (sl.target_rpe < 5.0 || sl.target_rpe > 10.0 || sl.target_rpe > prof().base_rpe_cap) corrDomains = false;
}
check('corrected slots hold the planned_slot CHECK domains (sets 1-10, rpe ≤ cap)', corrDomains);

// anti-windup: across the whole block, at most MAX_ADDED_SETS (2) patterns gain a set.
const plainGpp = gen({ objective: 'gpp', weekly_frequency: 6 });
const allUp = genFR({ objective: 'gpp', weekly_frequency: 6 },
  makeFlawReport(Object.fromEntries(MOVEMENT_PATTERNS.map((p) => [p, { phi: -0.5 }]))));
const firstSets = (plan, patt) => { const s = ndSlots(plan, patt)[0]; return s ? s.sets : null; };
let gained = 0;
for (const p of MOVEMENT_PATTERNS) {
  const b = firstSets(plainGpp, p); const u = firstSets(allUp, p);
  if (b !== null && u !== null && u > b) gained += 1;
}
check('anti-windup: ≤ MAX_ADDED_SETS (2) patterns gain a set across the whole block', gained <= 2, `gained=${gained}`);
// stronger: the TOTAL non-deload set count added vs baseline is ≤ 2 — catches a
// mutant that applies +1 to EVERY occurrence of a budgeted pattern (not just once).
const ndTotalSets = (plan) => plan.sessions.filter((s) => s.phase !== 'deload')
  .reduce((a, s) => a + s.slots.reduce((b, sl) => b + sl.sets, 0), 0);
const setDelta = ndTotalSets(allUp) - ndTotalSets(plainGpp);
check('anti-windup: TOTAL block set additions ≤ MAX_ADDED_SETS (2)', setDelta >= 0 && setDelta <= 2, `delta=${setDelta}`);

// thin-data / injury safety propagates through the generator (Step-3 R2#1 fix).
const injuredThin = genFR({ objective: 'strength' },
  makeFlawReport({ squat: { phi: -0.6, flawClass: 'neutral', obs: 4, maxJointSev: 9 } }));
const injSq = ndSlots(injuredThin, 'squat');
check('thin-data severe-niggle headroom never raises squat in the block',
  injSq.every((sl, i) => sl.target_rpe <= baseSq[i].target_rpe && sl.sets <= baseSq[i].sets));

// --- [7] Phase 16: tier gating (plan law: Beginner + whitelisted Intermediate staples)
{
  const WL = new Set(['Romanian Deadlift', 'Dumbbell Shoulder Press']);
  const tagged = movements.map((m) => ({
    ...m,
    difficulty: (m.name === 'Competition Squat' || m.name === 'Deadlift') ? 'Advanced'
      : (WL.has(m.name) || m.name === 'Front Squat') ? 'Intermediate'
      : 'Beginner',
    beginner_ok: WL.has(m.name),
  }));
  const advIds = new Set(tagged.filter((m) => m.difficulty === 'Advanced').map((m) => m.movement_id));
  const unlistedInt = new Set(tagged.filter((m) => m.difficulty === 'Intermediate' && !m.beginner_ok).map((m) => m.movement_id));
  const wlIds = new Set(tagged.filter((m) => m.beginner_ok).map((m) => m.movement_id));
  const begPlan = generateBlock({ profile: prof({ training_age: 'beginner' }), movements: tagged, startDate: START });
  const begIds = new Set(begPlan.sessions.flatMap((s) => s.slots.map((sl) => sl.movement_id)));
  check('tier law: beginner block contains no Advanced movement', [...begIds].every((id) => !advIds.has(id)));
  check('tier law: beginner block contains no UNLISTED Intermediate movement', [...begIds].every((id) => !unlistedInt.has(id)));
  check('tier law: whitelisted Intermediate staples remain prescribable', [...wlIds].some((id) => begIds.has(id)));
  const intPlan = generateBlock({ profile: prof({ training_age: 'intermediate' }), movements: tagged, startDate: START });
  const intIds = new Set(intPlan.sessions.flatMap((s) => s.slots.map((sl) => sl.movement_id)));
  check('tier law: non-beginner keeps Advanced movements eligible', [...intIds].some((id) => advIds.has(id)));
  // The cap is HARD: an all-Advanced library prescribes a beginner NOTHING.
  const allAdv = movements.map((m) => ({ ...m, difficulty: 'Advanced' }));
  const begAll = generateBlock({ profile: prof({ training_age: 'beginner' }), movements: allAdv, startDate: START });
  const slotsAll = begAll.sessions.reduce((a, s) => a + s.slots.length, 0);
  check('tier law is HARD: all-Advanced library prescribes a beginner nothing', slotsAll === 0, `slots=${slotsAll}`);
  check('tier law: dropped patterns carry tier warnings',
    begAll.warnings.some((w) => w.includes('no tier-eligible movement')), begAll.warnings.slice(0, 2).join(' | '));
  // Substitution honors the same law through the PRODUCTION input (trainingAge),
  // in layer 1 and layer 3 (triage).
  const subMv = (id, name, difficulty, opts = {}) => ({
    movement_id: id, name, pattern: opts.pattern ?? 'squat', is_compound: opts.compound ?? true,
    difficulty, family: `f${id}`, required: [], preference: 0,
    ...(opts.beginnerOk !== undefined ? { beginnerOk: opts.beginnerOk } : {}),
  });
  const subLib = [
    subMv(1, 'Beginner Squat', 'Beginner'),
    subMv(2, 'Whitelisted Int Squat', 'Intermediate', { beginnerOk: true }),
    subMv(3, 'Unlisted Int Squat', 'Intermediate'),
    subMv(4, 'Advanced Squat', 'Advanced'),
    subMv(5, 'Beginner Iso', 'Beginner', { pattern: 'isolation', compound: false }),
    subMv(6, 'Advanced Iso', 'Advanced', { pattern: 'isolation', compound: false }),
  ];
  const subTarget = subMv(999, 'Target', 'Advanced');
  const gated = computeSubstitutions({
    target: subTarget, library: subLib, inventory: [], currentDayIndex: 0, trainingAge: 'beginner',
  });
  const offered = gated.layer1Regression.options.map((o) => o.name);
  check('substitution L1 (beginner): only Beginner + whitelisted staples offered',
    offered.length > 0 && offered.every((n) => n === 'Beginner Squat' || n === 'Whitelisted Int Squat'), offered.join(','));
  const { EXPERIENCE_SEVERITY } = require('./.build/types.js');
  const triage = computeSubstitutions({
    target: subTarget, library: subLib, inventory: [], currentDayIndex: 0, trainingAge: 'beginner',
    niggles: [{ region: 'general fatigue', severity: EXPERIENCE_SEVERITY.beginner.triageMin }],
  });
  const cluster = triage.layer3Triage.cluster;
  check('substitution L3 triage (beginner): Advanced accessories never selected',
    cluster !== null && cluster.movements.every((m) => m.name !== 'Advanced Iso'),
    cluster === null ? 'no cluster' : cluster.movements.map((m) => m.name).join(','));
  // Untagged libraries remain byte-identical (legacy back-compat).
  const u1 = gen({ training_age: 'beginner' });
  const u2 = generateBlock({ profile: prof({ training_age: 'beginner' }), movements, startDate: START });
  check('tier law: untagged library output unchanged (back-compat, deep-equal)',
    JSON.stringify(u1) === JSON.stringify(u2));
  // PRODUCTION wiring contract (audit R1): the live app passes the gate inputs.
  const storeSrc = readFileSync(join(import.meta.dirname, '..', '..', '..', 'apps', 'mobile', 'src', 'state', 'useStore.ts'), 'utf-8');
  check('production: store passes trainingAge into computeSubstitutions', storeSrc.includes('trainingAge: profile.training_age'));
  check('production: store maps beginner_ok into generator + substitution inputs',
    storeSrc.includes('beginner_ok: m.beginnerOk') && storeSrc.includes('beginnerOk: m.beginnerOk'));
  check('production: store movement query joins movement_beginner_whitelist', storeSrc.includes('movement_beginner_whitelist'));
  const screenSrc = readFileSync(join(import.meta.dirname, '..', '..', '..', 'apps', 'mobile', 'src', 'screens', 'SessionScreen.tsx'), 'utf-8');
  check('production: picker applies the beginner whitelist rule',
    storeSrc.includes("movement.difficulty === 'Beginner' || movement.beginnerOk")
    && storeSrc.includes('if (!permittedForProfile(movement, profile))')
    && screenSrc.includes('beginnerPlanViolation'));
}

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
