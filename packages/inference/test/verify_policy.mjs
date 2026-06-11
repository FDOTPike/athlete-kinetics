/**
 * verify_policy.mjs — proves the deterministic policy engine:
 *   1. canonical regression row produces the documented hard-cut output,
 *   2. across a dense sweep of the whole state space (incl. NA combinations)
 *      every output stays inside the canonical literal domains and the cue
 *      contract (validateAdjustment),
 *   3. rule-table invariants hold (monotonicity in R, ACWR hard-cut, NA
 *      neutrality, verified-good-day boost).
 *
 * Run AFTER tsc emits to test/.build (npm run verify:policy does both).
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const out = require('./.build/outputSchema.js');
const policy = require('./.build/policyReference.js');
const limits = require('./.build/profileLimits.js');
const { DEFAULT_PROFILE } = require('./.build/types.js');

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

const row = (r, acwr, hrvz, slp, spo2 = 96.5) => ({
  date: '2026-06-10',
  readiness_score: r,
  hrv_component: 50, load_component: 50, sleep_component: 50, spo2_component: 50,
  acwr, acute_load_kg: acwr === null ? null : acwr * 3000, chronic_load_kg: 3000,
  ln_rmssd: 4.2, hrv_z: hrvz, sleep_efficiency_pct: slp, spo2_night_mean: spo2,
  computed_at_ms: 0,
});

// --- 1. canonical hard-cut regression ----------------------------------------
console.log('[1] canonical overreach row (R=38.2, ACWR=1.69, HRVZ=-1.8)');
const ex = policy.evaluatePolicy(row(38.2, 1.69, -1.8, 78.1, 94.2));
check('load 0.85', ex.load_modifier === 0.85, String(ex.load_modifier));
check('sets -2', ex.set_modifier === -2, String(ex.set_modifier));
check('rpe 6.5', ex.rpe_cap === 6.5, String(ex.rpe_cap));
check('passes validateAdjustment', (() => {
  try { out.validateAdjustment(ex); return true; } catch { return false; }
})());

// --- 2. full state-space sweep -> domain membership ---------------------------
console.log('[2] dense sweep: every policy output satisfies the contract');
let n = 0;
let bad = null;
for (const r of [0, 5, 15, 25, 35, 39.9, 40, 45, 54.9, 55, 60, 69.9, 70, 80, 84.9, 85, 92, 100]) {
  for (const acwr of [null, 0.1, 0.5, 0.79, 0.8, 1.0, 1.29, 1.3, 1.31, 1.49, 1.5, 1.51, 1.8, 2.5]) {
    for (const hrvz of [null, -3, -1.51, -1.5, -0.5, 0, 0.5, 2]) {
      for (const slp of [null, 60, 84.9, 85, 95]) {
        const v = policy.evaluatePolicy(row(r, acwr, hrvz, slp));
        n += 1;
        try {
          out.validateAdjustment(v);
        } catch (e) {
          if (bad === null) bad = { r, acwr, hrvz, slp, err: String(e) };
        }
      }
    }
  }
}
check(`all ${n} sweep outputs inside the contract`, bad === null,
  bad === null ? `${n} rows` : JSON.stringify(bad).slice(0, 120));

// --- 3. rule-table invariants --------------------------------------------------
console.log('[3] policy invariants');
let mono = true;
for (const acwr of [null, 0.9, 1.2, 1.4]) {
  for (const hrvz of [null, -1, 0.5]) {
    let prev = -Infinity;
    for (const r of [0, 20, 39, 41, 50, 56, 65, 71, 80, 86, 95, 100]) {
      const lm = policy.evaluatePolicy(row(r, acwr, hrvz, 88)).load_modifier;
      if (lm < prev - 1e-9) mono = false;
      prev = lm;
    }
  }
}
check('load_modifier monotone non-decreasing in readiness', mono);
let hardCut = true;
for (const r of [0, 30, 50, 70, 90, 100]) {
  const v = policy.evaluatePolicy(row(r, 1.51, 1.5, 95));
  if (v.load_modifier !== 0.85 || v.set_modifier !== -2) hardCut = false;
}
check('ACWR > 1.5 always forces 0.85 load / -2 sets regardless of readiness', hardCut);
const naNeutral = policy.evaluatePolicy(row(90, null, null, null));
check('all-NA telemetry at R=90 -> hold (1.00 load, 0 sets), never boost',
  naNeutral.load_modifier === 1.0 && naNeutral.set_modifier === 0,
  `got ${naNeutral.load_modifier}/${naNeutral.set_modifier}`);
const boost = policy.evaluatePolicy(row(90, 1.0, 0.5, 90));
check('verified-good day -> 1.05 load, +1 set, RPE 9.5',
  boost.load_modifier === 1.05 && boost.set_modifier === 1 && boost.rpe_cap === 9.5);

// --- 4. profile limits: monotone conservative, rules pinned --------------------
console.log('[4] applyProfileLimits');
const baseVectors = [
  policy.evaluatePolicy(row(90, 1.0, 0.5, 90)),   // boost day 1.05/+1/9.5
  policy.evaluatePolicy(row(75, 1.0, 0, 88)),     // hold day
  policy.evaluatePolicy(row(30, 1.7, -2, 78)),    // hard-cut day
];
const profiles = [];
for (const base_rpe_cap of [6.0, 7.5, 9.0, 10.0])
  for (const training_age of ['beginner', 'intermediate', 'elite'])
    for (const objective of ['rehab', 'strength', 'gpp'])
      for (const max_sessions_per_day of [1, 2])
        for (const weekly_frequency of [2, 4, 7])
          profiles.push({ ...DEFAULT_PROFILE, base_rpe_cap, training_age, objective,
            max_sessions_per_day, weekly_frequency });
const contexts = [];
for (const sessionsToday of [0, 1, 2, 3])
  for (const trainedDaysLast7 of [0, 2, 4, 7])
    contexts.push({ sessionsToday, trainedDaysLast7 });
let raised = null;
let cueTouched = null;
let noteless = null;
let n4 = 0;
for (const v of baseVectors)
  for (const p of profiles)
    for (const c of contexts) {
      const r = limits.applyProfileLimits(v, p, c);
      n4 += 1;
      if (r.vector.load_modifier > v.load_modifier + 1e-9 ||
          r.vector.set_modifier > v.set_modifier ||
          r.vector.rpe_cap > v.rpe_cap + 1e-9) raised = { v, p, c, r };
      if (r.vector.coaching_cue !== v.coaching_cue) cueTouched = { p, c };
      const changed = r.vector.load_modifier !== v.load_modifier ||
        r.vector.set_modifier !== v.set_modifier || r.vector.rpe_cap !== v.rpe_cap;
      if (changed && r.notes.length === 0) noteless = { p, c };
    }
check(`never raises load/sets/RPE across ${n4} combinations`, raised === null,
  raised ? JSON.stringify(raised).slice(0, 100) : `${n4} cases`);
check('never touches the coaching cue', cueTouched === null);
check('every numeric change carries a note', noteless === null);
const boostV = baseVectors[0];
const capped = limits.applyProfileLimits(boostV, { ...DEFAULT_PROFILE, base_rpe_cap: 7.0 },
  { sessionsToday: 0, trainedDaysLast7: 0 });
check('base RPE ceiling is a hard min', capped.vector.rpe_cap === 7.0 &&
  capped.vector.load_modifier === boostV.load_modifier);
const overCap = limits.applyProfileLimits(boostV, DEFAULT_PROFILE,
  { sessionsToday: 1, trainedDaysLast7: 0 });
check('daily session cap damps extra-session work',
  overCap.vector.load_modifier === Math.round(boostV.load_modifier * 0.85 * 100) / 100 &&
  overCap.vector.set_modifier === boostV.set_modifier - 1 && overCap.vector.rpe_cap === 7.0);
const overWeek = limits.applyProfileLimits(boostV, DEFAULT_PROFILE,
  { sessionsToday: 0, trainedDaysLast7: 4 });
check('weekly frequency forces maintenance load',
  overWeek.vector.load_modifier === Math.round(boostV.load_modifier * 0.9 * 100) / 100 &&
  overWeek.vector.rpe_cap === 7.5);
const rehab = limits.applyProfileLimits(boostV, { ...DEFAULT_PROFILE, objective: 'rehab' },
  { sessionsToday: 0, trainedDaysLast7: 0 });
check('rehab objective caps RPE at 7.0', rehab.vector.rpe_cap === 7.0);
// Default ceiling (9.0) intentionally trims a 9.5 boost-day prescription —
// the "balanced PT" posture: pushing past 9 requires an explicit profile edit.
const trimmed = limits.applyProfileLimits(boostV, DEFAULT_PROFILE,
  { sessionsToday: 0, trainedDaysLast7: 0 });
check('default profile trims boost-day RPE 9.5 -> 9.0 (and only that)',
  trimmed.vector.rpe_cap === 9.0 && trimmed.vector.load_modifier === boostV.load_modifier &&
  trimmed.vector.set_modifier === boostV.set_modifier && trimmed.notes.length === 1);
const holdV = baseVectors[1]; // rpe 9.0 already within every default cap
const noop = limits.applyProfileLimits(holdV, DEFAULT_PROFILE,
  { sessionsToday: 0, trainedDaysLast7: 0 });
check('default profile on a hold day changes nothing',
  noop.notes.length === 0 && noop.vector.load_modifier === holdV.load_modifier &&
  noop.vector.rpe_cap === holdV.rpe_cap);

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
