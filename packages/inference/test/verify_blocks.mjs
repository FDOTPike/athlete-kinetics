/**
 * verify_blocks.mjs — boundary invariants of the deterministic block engine.
 *
 * The generator was written to satisfy THESE laws, not vice versa:
 *   [1] Determinism bound — double-run deep-equality, no RNG.
 *   [2] Structural bound — exactly 4 weeks ending in deload; planned_slot
 *       CHECK domains; target RPE strictly within base_rpe_cap (rehab <= 7);
 *       deload volume strictly below week 1; duration cap bounds slots.
 *   [3] Equipment strictness bound — across ALL 1024 inventory subsets x all
 *       8 objectives, no emitted movement's required set escapes the
 *       inventory (subset law, no upward substitution).
 *   [4] Hybrid balance bound — every hybrid frequency contains bjj sessions
 *       AND carries strictly less raw strength set volume than the pure
 *       strength block.
 *   [5] SQL contract — 007's inventory default / preset bundles / item CHECK
 *       are byte-equal to the TS constants (one source of truth, verified).
 *   [6] Persistence — the plan round-trips through the real 007 tables with
 *       the store's literal SQL; cascade delete leaves no orphans.
 *
 * Run:  npm run verify:blocks
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);
const { generateBlock, addDaysIso } = require('./.build/blockGenerator.js');
const { DEFAULT_PROFILE, EQUIPMENT_ITEMS, EQUIPMENT_PRESETS, OBJECTIVES } =
  require('./.build/types.js');

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
  '005_subjective_report.sql', '006_user_profile.sql', '007_program_engine.sql']) {
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
check('required ⊆ inventory for every emitted slot', violations === 0,
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
db.prepare('DELETE FROM training_block WHERE block_id = ?').run(blockId);
const orphans = Number(db.prepare(
  'SELECT (SELECT count(*) FROM planned_session) + (SELECT count(*) FROM planned_slot) AS c').get().c);
check('block delete cascades sessions + slots (no orphans)', orphans === 0, String(orphans));

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
