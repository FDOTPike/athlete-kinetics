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

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
