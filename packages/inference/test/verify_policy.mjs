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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
// ACWR observational invariance (Calibration Policy v1):
// Across any ACWR value in {null, 0.1, 0.79, 1.0, 1.31, 1.5, 1.51, 2.5, 9.9},
// evaluatePolicy output (including coaching_cue) must be strictly identical for fixed non-ACWR inputs.
let acwrInvariant = true;
let acwrMismatch = null;
const acwrValues = [null, 0.1, 0.79, 1.0, 1.31, 1.5, 1.51, 2.5, 9.9];
for (const r of [20, 38.2, 45, 60, 75, 85, 90, 100]) {
  for (const hrvz of [null, -2.0, -1.0, 0, 0.5, 1.5]) {
    for (const slp of [null, 65, 85, 95]) {
      const baseline = policy.evaluatePolicy(row(r, null, hrvz, slp));
      for (const acwr of acwrValues) {
        const current = policy.evaluatePolicy(row(r, acwr, hrvz, slp));
        if (JSON.stringify(current) !== JSON.stringify(baseline)) {
          acwrInvariant = false;
          if (acwrMismatch === null) {
            acwrMismatch = { r, hrvz, slp, acwr, baseline, current };
          }
        }
      }
    }
  }
}
check('ACWR observational invariance: evaluatePolicy output deep-equal across ACWR values (incl cue)',
  acwrInvariant, acwrMismatch ? JSON.stringify(acwrMismatch).slice(0, 120) : 'all sweep states equal');
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

// --- 5. experience-weighted triage scaling -------------------------------------
console.log('[5] scaleGuardrailForExperience');
const { scaleGuardrailForExperience } = limits;
const { applyGuardrail } = require('./.build/semantic/triage.js');
const AGES = ['beginner', 'intermediate', 'advanced', 'elite'];
const painFloor = { load_multiplier: 0.6, set_delta: -1, rpe_cap_max: 6.0, halt: false, follow_up: null };
const fatigue = { load_multiplier: 0.9, set_delta: -1, rpe_cap_max: 7.5, halt: false, follow_up: null };
const haltG = { load_multiplier: 0, set_delta: -2, rpe_cap_max: 0, halt: true, follow_up: 'Stop now.' };
const noopG = { load_multiplier: 1.0, set_delta: 0, rpe_cap_max: 10.0, halt: false, follow_up: null };

check('intermediate is the identity on a restrictive guardrail',
  JSON.stringify(scaleGuardrailForExperience(painFloor, 'intermediate')) === JSON.stringify(painFloor));
const scaledPain = AGES.map((a) => scaleGuardrailForExperience(painFloor, a));
// DOMS-vs-structural (Step 5): damping is now strictly DECREASING in experience
// — a beginner's complaint is relaxed (benign DOMS), an elite's is tightened.
check('severity strictly monotone with experience (load multiplier, decreasing)',
  scaledPain[0].load_multiplier > scaledPain[1].load_multiplier &&
  scaledPain[1].load_multiplier > scaledPain[2].load_multiplier &&
  scaledPain[2].load_multiplier > scaledPain[3].load_multiplier,
  scaledPain.map((g) => g.load_multiplier).join(' > '));
check('severity monotone with experience (RPE cap, decreasing)',
  scaledPain[0].rpe_cap_max > scaledPain[1].rpe_cap_max &&
  scaledPain[1].rpe_cap_max > scaledPain[2].rpe_cap_max &&
  scaledPain[2].rpe_cap_max > scaledPain[3].rpe_cap_max,
  scaledPain.map((g) => g.rpe_cap_max).join(' > '));
check('beginner pain: mild/DOMS (load 0.72, set -1, cap 8.0)',
  scaledPain[0].load_multiplier === 0.72 && scaledPain[0].set_delta === -1 &&
  scaledPain[0].rpe_cap_max === 8.0);
check('elite pain: structural/severe (load 0.48, extra set cut, cap 5.0)',
  scaledPain[3].load_multiplier === 0.48 && scaledPain[3].set_delta === -2 &&
  scaledPain[3].rpe_cap_max === 5.0);
const beginnerFatigue = scaleGuardrailForExperience(fatigue, 'beginner');
check('flagged RPE ceiling 8.0 binds (beginner fatigue 7.5+2.0 -> 8.0)',
  beginnerFatigue.rpe_cap_max === 8.0);
check('load multiplier never exceeds 1.0 (beginner fatigue 0.9x1.2 -> 1.0)',
  beginnerFatigue.load_multiplier === 1.0);
check('halt guardrails are untouched at every age',
  AGES.every((a) => JSON.stringify(scaleGuardrailForExperience(haltG, a)) === JSON.stringify(haltG)));
check('no-op (positive) guardrails are untouched at every age',
  AGES.every((a) => JSON.stringify(scaleGuardrailForExperience(noopG, a)) === JSON.stringify(noopG)));
// Composition law: scaled guardrails stay monotone conservative vs the base.
let composedRaise = null;
for (const a of AGES) {
  for (const g of [painFloor, fatigue, haltG, noopG]) {
    const entry = { id: 'scale-test', category: 'pain', text: 't', aliases: [],
      cue: 'Scaling composition check cue.', guardrail: scaleGuardrailForExperience(g, a) };
    const dirv = applyGuardrail(boostV, entry, 1);
    if (dirv.vector.load_modifier > boostV.load_modifier + 1e-9 ||
        dirv.vector.set_modifier > boostV.set_modifier ||
        dirv.vector.rpe_cap > boostV.rpe_cap + 1e-9) composedRaise = { a, g };
  }
}
check('composed with applyGuardrail: never above the base at any age',
  composedRaise === null, composedRaise ? JSON.stringify(composedRaise) : '16 combos');
// The REAL codebase, not synthetic shapes: weak monotonicity (the 8.0
// ceiling / 5.0 floor may bind for adjacent ages) + hard bounds.
const cbJson = JSON.parse(readFileSync(
  join(import.meta.dirname, '..', 'assets', 'phrase-codebase.json'), 'utf-8'));
const restrictiveEntries = cbJson.entries.filter((e) => !e.guardrail.halt &&
  (e.guardrail.load_multiplier < 1 || e.guardrail.set_delta < 0 || e.guardrail.rpe_cap_max < 10));
let realViol = null;
for (const e of restrictiveEntries) {
  const seq = AGES.map((a) => scaleGuardrailForExperience(e.guardrail, a));
  for (let i = 1; i < seq.length; i++) {
    // Weakly DECREASING in experience now (beginner relaxed, elite tightened).
    if (seq[i].load_multiplier > seq[i - 1].load_multiplier + 1e-9 ||
        seq[i].rpe_cap_max > seq[i - 1].rpe_cap_max + 1e-9 ||
        seq[i].set_delta > seq[i - 1].set_delta) realViol = { id: e.id, at: i, why: 'monotone' };
  }
  for (const g of seq) {
    if (g.load_multiplier > 1 || g.set_delta > 0 ||
        g.rpe_cap_max > 8.0 || g.rpe_cap_max < 5.0) realViol = { id: e.id, why: 'bounds' };
  }
}
check('every restrictive REAL codebase entry: weakly monotone (decreasing) + bounded across ages',
  realViol === null, realViol ? JSON.stringify(realViol) : `${restrictiveEntries.length} entries x 4 ages`);

// --- 6. derivePrescription: the full layer-3 chain over the REAL codebase -------
console.log('[6] derivePrescription (rows -> most-conservative -> scaling -> guardrail)');
const { derivePrescription } = require('./.build/derivePrescription.js');
const entryOf = (id) => {
  const e = cbJson.entries.find((x) => x.id === id);
  if (e === undefined) throw new Error(`codebase entry missing: ${id}`);
  return e;
};
const boostRow = row(90, 1.0, 0.5, 90);
const ctx0 = { sessionsToday: 0, trainedDaysLast7: 0 };
// Reports are passed as bare entries; wrap them in the ReportInput shape with
// severity=null (legacy/no-severity -> matched guardrail used as-is). Severity-
// gated cases pass {entry, severity} objects through directly.
const dp = (reports, over = {}) => derivePrescription({
  vector: boostRow, profile: { ...DEFAULT_PROFILE, ...over }, ctx: ctx0,
  reports: reports.map((r) => (r.entry !== undefined ? r : { entry: r, severity: null })),
});

const tieA1 = dp([entryOf('positive-strong'), entryOf('equipment-improvised')]);
const tieA2 = dp([entryOf('equipment-improvised'), entryOf('positive-strong')]);
check('tie pair (positive-strong vs equipment-improvised) is order-independent, restrictive wins',
  JSON.stringify(tieA1.vector) === JSON.stringify(tieA2.vector) && tieA1.vector.rpe_cap <= 8.0,
  `cap ${tieA1.vector.rpe_cap}`);
const tieB1 = dp([entryOf('soreness-doms'), entryOf('technique-breakdown')]);
const tieB2 = dp([entryOf('technique-breakdown'), entryOf('soreness-doms')]);
check('tie pair (soreness-doms vs technique-breakdown) picks the 7.5 cap either order',
  JSON.stringify(tieB1.vector) === JSON.stringify(tieB2.vector) && tieB1.vector.rpe_cap <= 7.5,
  `cap ${tieB1.vector.rpe_cap}`);

const haltMix1 = dp([entryOf('pain-mild'), entryOf('pain-sharp')]);
const haltMix2 = dp([entryOf('pain-sharp'), entryOf('pain-mild')]);
check('a halt row halts regardless of order; re-derivation is restart-stable',
  haltMix1.directive !== null && haltMix1.directive.halt &&
  JSON.stringify(haltMix1) === JSON.stringify(haltMix2) &&
  JSON.stringify(haltMix1) === JSON.stringify(dp([entryOf('pain-mild'), entryOf('pain-sharp')])));
check('halt survives every training-age edit (profile cannot resurrect the session)',
  AGES.every((a) => {
    const r = dp([entryOf('pain-sharp')], { training_age: a });
    return r.directive !== null && r.directive.halt && r.vector.load_modifier === 0;
  }));

const begiPain = dp([entryOf('pain-mild')], { training_age: 'beginner' });
const elitPain = dp([entryOf('pain-mild')], { training_age: 'elite' });
check('training-age flip: beginner relaxed (DOMS), elite tightened, within bounds',
  begiPain.vector.load_modifier > elitPain.vector.load_modifier &&
  begiPain.vector.rpe_cap > elitPain.vector.rpe_cap &&
  begiPain.vector.rpe_cap <= 8.0 &&
  begiPain.vector.load_modifier <= 1.05,
  `beginner ${begiPain.vector.load_modifier}/${begiPain.vector.rpe_cap} > elite ${elitPain.vector.load_modifier}/${elitPain.vector.rpe_cap}`);
check('experience scaling is INSIDE the derivation (elite stricter than intermediate)',
  elitPain.vector.rpe_cap < dp([entryOf('pain-mild')]).vector.rpe_cap);
const noReports = dp([]);
check('no reports: no directive, source stays policy/profile',
  noReports.directive === null && noReports.source !== 'guardrail');
// Positive identity pass-through: "it felt good" must be a no-op, never a
// guardrail; and it must never mask a restrictive report from the same day.
const positiveOnly = dp([entryOf('positive-strong')]);
check('positive sentiment is identity pass-through (no guardrail, base unchanged)',
  positiveOnly.directive === null && positiveOnly.source !== 'guardrail' &&
  JSON.stringify(positiveOnly.vector) === JSON.stringify(noReports.vector));
const mixedPositive = dp([entryOf('positive-strong'), entryOf('soreness-doms')]);
check('a positive report never masks a restrictive one',
  mixedPositive.directive !== null && mixedPositive.source === 'guardrail' &&
  mixedPositive.vector.rpe_cap <= 8.0, `cap ${mixedPositive.vector.rpe_cap}`);

// --- 7. non-compounding floor + experience-weighted severity gating (Step 5) ---
console.log('[7] most-severe floor + severity gating');
const SET_FLOOR = out.SET_MODIFIER_FLOOR;
check('SET_MODIFIER_FLOOR is -3', SET_FLOOR === -3, String(SET_FLOOR));
const clampedWorst = out.clampAdjustment(
  { load_modifier: -5, set_modifier: -9, rpe_cap: 99, coaching_cue: 'x'.repeat(20) });
check('clampAdjustment floors set>=-3, load>=0, rpe<=10',
  clampedWorst.set_modifier === -3 && clampedWorst.load_modifier === 0 && clampedWorst.rpe_cap === 10);
// Non-compounding: stacking EVERY restrictive report never drops set_modifier
// below the single-step floor, and Math.max(0, plannedSets + mod) stays >= 0.
let floorViol = null;
const worstCtx = { sessionsToday: 3, trainedDaysLast7: 7 };
for (const age of AGES) {
  for (const anyRow of [row(30, 1.7, -2, 78), boostRow]) {
    const reports = restrictiveEntries.map((e) => ({ entry: e, severity: null }));
    const d = derivePrescription({ vector: anyRow,
      profile: { ...DEFAULT_PROFILE, training_age: age }, ctx: worstCtx, reports });
    if (d.vector.set_modifier < SET_FLOOR) floorViol = { age, sm: d.vector.set_modifier };
    for (let planned = 1; planned <= 6; planned++) {
      if (Math.max(0, planned + d.vector.set_modifier) < 0) floorViol = { age, planned };
    }
  }
}
check('stacking ALL restrictive reports never breaches the -3 floor (no compounding)',
  floorViol === null, floorViol ? JSON.stringify(floorViol) : `${AGES.length} ages x 2 days`);
// Experience-weighted severity gating (DOMS-vs-structural) on a non-halt entry.
const sevEntry = entryOf('soreness-doms');
const sev = (s, age) => derivePrescription({ vector: boostRow,
  profile: { ...DEFAULT_PROFILE, training_age: age }, ctx: ctx0,
  reports: [{ entry: sevEntry, severity: s }] });
check('beginner severity 4 is benign (DOMS) -> no directive', sev(4, 'beginner').directive === null);
check('beginner severity 5 is operative', sev(5, 'beginner').directive !== null);
check('elite severity 3 is operative (structural)', sev(3, 'elite').directive !== null);
check('elite severity 6 forces a halt',
  sev(6, 'elite').directive?.halt === true && sev(6, 'elite').vector.load_modifier === 0);
check('beginner severity 8 forces a halt', sev(8, 'beginner').directive?.halt === true);
check('severity null leaves the matched guardrail unchanged',
  JSON.stringify(sev(null, 'intermediate').vector) ===
  JSON.stringify(dp([entryOf('soreness-doms')]).vector));
// Recorded-halt floor: a halt, once recorded (subjective_report.halt), is a fact
// re-derivation must honor at EVERY training age — toggling age can never relax
// a halt. (An elite at sev 6 escalates 'soreness-doms' to halt; switching to a
// beginner whose haltMin is higher must NOT un-halt the recorded session.)
const recordedHalt = (age) => derivePrescription({ vector: boostRow,
  profile: { ...DEFAULT_PROFILE, training_age: age }, ctx: ctx0,
  reports: [{ entry: entryOf('soreness-doms'), severity: 4, wasHalt: true }] });
check('a recorded halt survives every training-age change (never relaxed)',
  AGES.every((a) => { const r = recordedHalt(a); return r.directive?.halt === true && r.vector.load_modifier === 0; }));
check('control: the same report WITHOUT the recorded-halt flag does not halt a tolerant age',
  derivePrescription({ vector: boostRow, profile: { ...DEFAULT_PROFILE, training_age: 'beginner' },
    ctx: ctx0, reports: [{ entry: entryOf('soreness-doms'), severity: 4, wasHalt: false }] }).directive === null);

// --- [8] Calibration Policy v1: Retrospective signal invariants -----------------
console.log('[8] Calibration Policy v1: Retrospective signal invariants');
const prospectivePlannerFiles = [
  'blockGenerator.ts',
  'routineComposer.ts',
  'routineMicrocycle.ts',
  'derivePrescription.ts',
  'profileLimits.ts',
  'policyReference.ts',
];
let retrospectiveSourceLeak = null;
for (const pf of prospectivePlannerFiles) {
  const code = readFileSync(join(import.meta.dirname, '..', 'src', pf), 'utf-8');
  if (/\bhard_sets\b/.test(code) || /\bsession_rpe\b/.test(code)) {
    retrospectiveSourceLeak = pf;
  }
}
check('source tripwire: hard_sets and session_rpe appear in NO prospective planner',
  retrospectiveSourceLeak === null, retrospectiveSourceLeak ? `leaked in ${retrospectiveSourceLeak}` : '6 files clean');

const cleanPolicyResult = policy.evaluatePolicy(boostRow);
const poisonedPolicyResult = policy.evaluatePolicy({ ...boostRow, hard_sets: 9999, session_rpe: 10.0 });
check('policy evaluation is invariant to poisoned retrospective signals (pure function of StateVectorRow)',
  JSON.stringify(cleanPolicyResult) === JSON.stringify(poisonedPolicyResult));

const cleanPrescription = derivePrescription({ vector: boostRow, profile: DEFAULT_PROFILE, ctx: ctx0, reports: [] });
const poisonedPrescription = derivePrescription({
  vector: { ...boostRow, hard_sets: 9999, session_rpe: 10.0 },
  profile: { ...DEFAULT_PROFILE, hard_sets: 9999, session_rpe: 10.0 },
  ctx: { ...ctx0, hard_sets: 9999, session_rpe: 10.0 },
  reports: [],
});
check('derivePrescription output is byte-identical when retrospective signals are poisoned',
  JSON.stringify(cleanPrescription) === JSON.stringify(poisonedPrescription));

// --- [9] Calibration Policy v1: 21-day return check-in evaluation ---------------
console.log('[9] Calibration Policy v1: 21-day return check-in evaluation');
const returnMod = require('./.build/returnFromLayoff.js');
const { evaluateReturn, LAYOFF_GAP_DAYS, RETURN_OPTIONS } = returnMod;
check('LAYOFF_GAP_DAYS is 21', LAYOFF_GAP_DAYS === 21);
check('evaluateReturn(0) is not a layoff', evaluateReturn(0).isLayoff === false);
check('evaluateReturn(20) is not a layoff', evaluateReturn(20).isLayoff === false);
check('evaluateReturn(21) is a layoff', evaluateReturn(21).isLayoff === true);
check('evaluateReturn(45) is a layoff', evaluateReturn(45).isLayoff === true);
check('a missing/NaN gap is never a layoff (missingness stays missing)',
  evaluateReturn(Number.NaN).isLayoff === false);
check('options are the two ratified actions',
  JSON.stringify(RETURN_OPTIONS) === JSON.stringify(['continue_plan', 'review_first_session']) &&
  JSON.stringify(evaluateReturn(21).options) === JSON.stringify(RETURN_OPTIONS));
// Numerical return modifiers are DEFERRED under Calibration Policy v1 section 4/5.
// The engine must expose no dose value at all, and no field beyond the three below.
check('the return engine exports NO dose modifier of any kind',
  !('FRESH_BLOCK_MODIFIER' in returnMod) &&
  Object.keys(returnMod).sort().join(',') === 'LAYOFF_GAP_DAYS,RETURN_OPTIONS,evaluateReturn');
check('a return evaluation carries no load/RPE/dose field',
  Object.keys(evaluateReturn(30)).sort().join(',') === 'daysSinceLastTrained,isLayoff,options');
const returnSrc = readFileSync(join(import.meta.dirname, '..', 'src', 'returnFromLayoff.ts'), 'utf-8');
check('source tripwire: no multiplier/cap/dose vocabulary in returnFromLayoff.ts',
  !/[Mm]ultiplier|[Rr]peCap|week1|generateBlock|slot_override/.test(returnSrc));

// --- [10] Calibration Policy v1: Coefficient Governance & Invariant Pinning -----
console.log('[10] Calibration Policy v1: Coefficient Governance & Invariant Pinning');
const autopilot = require('./.build/kinematicAutopilot.js');
check('FLAW_DETECTION_CONSTANTS.LAMBDA is 0.88', autopilot.FLAW_DETECTION_CONSTANTS.LAMBDA === 0.88);
check('FLAW_DETECTION_CONSTANTS.E_MAX is 3.0', autopilot.FLAW_DETECTION_CONSTANTS.E_MAX === 3.0);
check('FLAW_DETECTION_CONSTANTS.J_MAX is 10', autopilot.FLAW_DETECTION_CONSTANTS.J_MAX === 10);
check('FLAW_DETECTION_CONSTANTS.DELTA is 0.15', autopilot.FLAW_DETECTION_CONSTANTS.DELTA === 0.15);
check('FLAW_DETECTION_CONSTANTS.W_BASE is 0.7', autopilot.FLAW_DETECTION_CONSTANTS.W_BASE === 0.7);
check('FLAW_DETECTION_CONSTANTS.W_TREND is 0.3', autopilot.FLAW_DETECTION_CONSTANTS.W_TREND === 0.3);
check('FLAW_DETECTION_CONSTANTS.MIN_OBSERVATIONS is 5', autopilot.FLAW_DETECTION_CONSTANTS.MIN_OBSERVATIONS === 5);
check('FLAW_DETECTION_CONSTANTS.THETA_DEFICIT is 0.3', autopilot.FLAW_DETECTION_CONSTANTS.THETA_DEFICIT === 0.3);
check('FLAW_DETECTION_CONSTANTS.THETA_HEADROOM is 0.3', autopilot.FLAW_DETECTION_CONSTANTS.THETA_HEADROOM === 0.3);

check('CONTROL_AUTHORITY.MAX_ADDED_SETS is 2', autopilot.CONTROL_AUTHORITY.MAX_ADDED_SETS === 2);
check('CONTROL_AUTHORITY.LOAD_STEP is 0.05', autopilot.CONTROL_AUTHORITY.LOAD_STEP === 0.05);
check('CONTROL_AUTHORITY.RPE_STEP is 0.5', autopilot.CONTROL_AUTHORITY.RPE_STEP === 0.5);
check('CONTROL_AUTHORITY.MAX_MACROCYCLE_RPE_RAISE is 2.5', autopilot.CONTROL_AUTHORITY.MAX_MACROCYCLE_RPE_RAISE === 2.5);
check('CONTROL_AUTHORITY.SET_STEP is 1', autopilot.CONTROL_AUTHORITY.SET_STEP === 1);
check('CONTROL_AUTHORITY.DEADBAND is 0.15', autopilot.CONTROL_AUTHORITY.DEADBAND === 0.15);
check('CONTROL_AUTHORITY.STRONG_THRESHOLD is 0.4', autopilot.CONTROL_AUTHORITY.STRONG_THRESHOLD === 0.4);

// Readiness schema weights verification from 004_state_vector_materialize.sql
const schema004 = readFileSync(join(import.meta.dirname, '..', '..', 'core-db', 'src', 'schema', '004_state_vector_materialize.sql'), 'utf-8');
check('004 schema readiness weights contain 0.35 HRV and 0.25 sleep',
  schema004.includes('0.35 * hrv_component') &&
  schema004.includes('0.25 * sleep_component') &&
  schema004.includes('0.35') && schema004.includes('0.25'));
const readinessCase = schema004.slice(schema004.indexOf('round(CASE'), schema004.indexOf('END, 1)'));
check('004 schema readiness excludes load component from readiness_score calculation',
  !readinessCase.includes('load_component'));

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
