'use strict';
/**
 * verify_longitudinal_autopilot.mjs — deterministic verification for the V1
 * 9-month longitudinal coaching-engine overlay (WO-LONG-ENGINE-01).
 *
 * Exercises compiled production exports from packages/inference/test/.build:
 *   1. Exact export surface & purity (no module-level threshold defaults,
 *      no clock/RNG/I/O/SQL/any).
 *   2. Fail-closed neutral overlay when policy is null or invalid.
 *   3. Mechanism 1: cross-block 073 swap + joint-discomfort memory promoting
 *      derivedPreference[m] = -1 (Avoid) + Layer 1 green regression
 *      (selectSubstitution) at kTrigger across trailing swapWindowBlocks,
 *      trailing-window expiry, duplicate-row idempotence, beginner tier gate,
 *      halt supremacy, and ZERO Avoid promotions for cause === "equipment_busy"
 *      and matched_phrase_entry_id === "equipment-improvised".
 *   4. Mechanism 2: bounded per-pattern MRV_p in [1, 10] and -1 Week-3
 *      working-set trim after mCadence consecutive Week-3 overreach blocks,
 *      stepping back up by +1 only after mClean consecutive clean blocks with
 *      flawClass === "latent_headroom", leaving Week 4 deload untouched.
 *   5. Beginner upward-load clamp (dLoad_p <= 1.0, non-vacuous against
 *      intermediate 1.05) + macrocycle cumulative RPE raise ceiling (<= 2.5
 *      across blocks 1..8, 0.0 in 6..8, 0.0 while suspended, clean rollover
 *      at block 9 / macrocycle 2 block 1).
 *   6. Three mandatory poisoning invariants: byte-identical outputs under
 *      poisoned ACWR (999.9), poisoned 072_question_log, and poisoned
 *      KineStrike ks_* descriptive fields, plus deep-freeze immutability.
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const longitudinalMod = require('./.build/longitudinalAutopilot.js');
const {
  EQUIPMENT_NON_PATHOLOGICAL_CAUSES,
  EQUIPMENT_NON_PATHOLOGICAL_PHRASE_IDS,
  LONGITUDINAL_MRV_MAX_SETS,
  LONGITUDINAL_MRV_MIN_SETS,
  applyLongitudinalOverlayToBlockPlan,
  evaluateLongitudinalAutopilot,
  isValidLongitudinalAutopilotPolicy,
  selectSubstitution,
} = longitudinalMod;
const {
  DEFAULT_PROFILE,
  MOVEMENT_PATTERNS,
  MOVEMENT_PREFERENCE,
  STANDARD_EQUIPMENT_ITEMS,
} = require('./.build/types.js');
const {
  addDaysIso,
  generateBlock,
  macroPhaseOf,
} = require('./.build/blockGenerator.js');

const ROOT = join(import.meta.dirname, '..', '..', '..');
const SOURCE_PATH = join(
  ROOT,
  'packages',
  'inference',
  'src',
  'longitudinalAutopilot.ts',
);

let okCount = 0;
let failCount = 0;

const check = (label, fn) => {
  try {
    fn();
    console.log(`  [OK]   ${label}`);
    okCount += 1;
  } catch (error) {
    console.error(`  [FAIL] ${label}: ${error.message}`);
    failCount += 1;
  }
};

const clone = (value) => {
  if (value instanceof Set) return new Set([...value].map(clone));
  if (value instanceof Map) {
    return new Map([...value].map(([k, v]) => [clone(k), clone(v)]));
  }
  if (value !== null && typeof value === 'object') {
    if (Array.isArray(value)) return value.map(clone);
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, clone(v)]),
    );
  }
  return value;
};

const freezeGuard = () => {
  throw new TypeError('frozen input mutation');
};

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object') {
    if (value instanceof Set) {
      for (const item of value) deepFreeze(item);
      value.add = freezeGuard;
      value.delete = freezeGuard;
      value.clear = freezeGuard;
      return Object.freeze(value);
    }
    if (value instanceof Map) {
      for (const [k, v] of value) {
        deepFreeze(k);
        deepFreeze(v);
      }
      value.set = freezeGuard;
      value.delete = freezeGuard;
      value.clear = freezeGuard;
      return Object.freeze(value);
    }
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

// ---------------------------------------------------------------------------
// Deterministic fixtures
// ---------------------------------------------------------------------------

/** Explicit caller-supplied test policy (never embedded as a module default). */
const EXPLICIT_POLICY = Object.freeze({
  kTrigger: 2,
  swapWindowBlocks: 3,
  mCadence: 2,
  mClean: 2,
  completionPolicy: Object.freeze({
    minObservationDays: 5,
    deficitThreshold: 0.2,
    strongThreshold: 0.5,
  }),
});

const makeWindowDates = (startIso, length = 21) =>
  Array.from({ length }, (_, idx) => addDaysIso(startIso, idx));

const makeStateVectors = (dates, acwr = 1.05) =>
  dates.map((date, idx) => ({
    date,
    readiness_score: 0.82,
    hrv_component: 0.8,
    load_component: 0.85,
    sleep_component: 0.84,
    spo2_component: 0.96,
    acwr,
    acute_load_kg: 4200,
    chronic_load_kg: 4000,
    ln_rmssd: 4.1,
    hrv_z: 0.2,
    sleep_efficiency_pct: 89,
    spo2_night_mean: 97,
    computed_at_ms: 1780000000000 + idx * 86400000,
  }));

/** Build active set-days across the 21-day window so S_max normalization reflects sustained signal. */
const makePatternSetRows = (dates, pattern, deltaRpe, setCount = 4) =>
  dates.map((date) => ({
    date,
    pattern,
    setCount,
    sumDeltaRpe: deltaRpe * setCount,
    deltaCount: setCount,
    sumAttenuation: setCount,
  }));

/** Build Week-3-concentrated overreach rows that cross both Week-3 and full-window capacity_deficit thresholds. */
const makeWeek3OverreachSetRows = (dates, pattern, week2Delta = 0.8, week3Delta = 2.0) => {
  const rows = [];
  for (const idx of [1, 3, 5]) {
    const d = week2Delta + (idx - 1) * 0.15;
    rows.push({
      date: dates[idx],
      pattern,
      setCount: 4,
      sumDeltaRpe: d * 4,
      deltaCount: 4,
      sumAttenuation: 4,
    });
  }
  for (const idx of [7, 9, 11, 13]) {
    const d = week3Delta + (idx - 7) * 0.15;
    rows.push({
      date: dates[idx],
      pattern,
      setCount: 5,
      sumDeltaRpe: d * 5,
      deltaCount: 5,
      sumAttenuation: 5,
    });
  }
  for (const idx of [15, 17, 19]) {
    const d = 0.9 + (idx - 15) * 0.15;
    rows.push({
      date: dates[idx],
      pattern,
      setCount: 3,
      sumDeltaRpe: d * 3,
      deltaCount: 3,
      sumAttenuation: 3,
    });
  }
  return rows;
};

const TEST_LIBRARY = Object.freeze([
  {
    movement_id: 101,
    name: 'Competition Squat',
    pattern: 'squat',
    is_compound: true,
    difficulty: 'Advanced',
    beginnerOk: false,
    capabilityAvailable: true,
    sportTracking: false,
    family: 'Squat',
    required: ['barbell', 'squat_rack'],
    preference: MOVEMENT_PREFERENCE.NEUTRAL,
    joints: ['knee', 'hip'],
  },
  {
    movement_id: 102,
    name: 'Front Squat',
    pattern: 'squat',
    is_compound: true,
    difficulty: 'Intermediate',
    beginnerOk: true,
    capabilityAvailable: true,
    sportTracking: false,
    family: 'Squat',
    required: ['barbell', 'squat_rack'],
    preference: MOVEMENT_PREFERENCE.NEUTRAL,
    joints: ['knee', 'hip'],
  },
  {
    movement_id: 103,
    name: 'Goblet Squat',
    pattern: 'squat',
    is_compound: true,
    difficulty: 'Beginner',
    beginnerOk: true,
    capabilityAvailable: true,
    sportTracking: false,
    family: 'Squat',
    required: ['dumbbells'],
    preference: MOVEMENT_PREFERENCE.NEUTRAL,
    joints: ['knee', 'hip'],
  },
  {
    movement_id: 201,
    name: 'Barbell Bench Press',
    pattern: 'push_h',
    is_compound: true,
    difficulty: 'Intermediate',
    beginnerOk: true,
    capabilityAvailable: true,
    sportTracking: false,
    family: 'Bench Press',
    required: ['barbell', 'bench'],
    preference: MOVEMENT_PREFERENCE.NEUTRAL,
    joints: ['shoulder', 'elbow'],
  },
  {
    movement_id: 202,
    name: 'Dumbbell Bench Press',
    pattern: 'push_h',
    is_compound: true,
    difficulty: 'Beginner',
    beginnerOk: true,
    capabilityAvailable: true,
    sportTracking: false,
    family: 'Bench Press',
    required: ['dumbbells', 'bench'],
    preference: MOVEMENT_PREFERENCE.NEUTRAL,
    joints: ['shoulder', 'elbow'],
  },
  {
    movement_id: 203,
    name: 'Push-up',
    pattern: 'push_h',
    is_compound: true,
    difficulty: 'Beginner',
    beginnerOk: true,
    capabilityAvailable: true,
    sportTracking: false,
    family: 'Push-up',
    required: [],
    preference: MOVEMENT_PREFERENCE.PRIORITIZE,
    joints: ['elbow'],
  },
  {
    movement_id: 204,
    name: 'Board Press',
    pattern: 'push_h',
    is_compound: true,
    difficulty: 'Advanced',
    beginnerOk: false,
    capabilityAvailable: true,
    sportTracking: false,
    family: 'Bench Press',
    required: ['barbell', 'bench'],
    preference: MOVEMENT_PREFERENCE.PRIORITIZE,
    joints: ['shoulder', 'elbow'],
  },
  {
    movement_id: 301,
    name: 'Romanian Deadlift',
    pattern: 'hinge',
    is_compound: true,
    difficulty: 'Intermediate',
    beginnerOk: true,
    capabilityAvailable: true,
    sportTracking: false,
    family: 'Hinge',
    required: ['barbell'],
    preference: MOVEMENT_PREFERENCE.NEUTRAL,
    joints: ['hip', 'lower_back'],
  },
  {
    movement_id: 302,
    name: 'Kettlebell Deadlift',
    pattern: 'hinge',
    is_compound: true,
    difficulty: 'Beginner',
    beginnerOk: true,
    capabilityAvailable: true,
    sportTracking: false,
    family: 'Hinge',
    required: ['kettlebell'],
    preference: MOVEMENT_PREFERENCE.NEUTRAL,
    joints: ['hip'],
  },
  {
    movement_id: 401,
    name: 'Chest-Supported Row',
    pattern: 'pull_h',
    is_compound: true,
    difficulty: 'Beginner',
    beginnerOk: true,
    capabilityAvailable: true,
    sportTracking: false,
    family: 'Row',
    required: ['dumbbells', 'bench'],
    preference: MOVEMENT_PREFERENCE.NEUTRAL,
    joints: ['shoulder', 'elbow'],
  },
  {
    movement_id: 501,
    name: 'Cable Face Pull',
    pattern: 'isolation',
    is_compound: false,
    difficulty: 'Beginner',
    beginnerOk: true,
    capabilityAvailable: true,
    sportTracking: false,
    family: 'Rear Delt',
    required: ['cable_machine'],
    preference: MOVEMENT_PREFERENCE.PRIORITIZE,
    joints: [],
  },
]);

const GENERATOR_LIBRARY = Object.freeze([
  {
    movement_id: 102,
    name: 'Front Squat',
    pattern: 'squat',
    is_compound: true,
    difficulty: 'Intermediate',
    beginner_ok: true,
    sportTracking: false,
    capability_available_weight_room: true,
    capability_available_sport_conditioning: true,
    required: ['barbell', 'squat_rack'],
  },
  {
    movement_id: 103,
    name: 'Goblet Squat',
    pattern: 'squat',
    is_compound: true,
    difficulty: 'Beginner',
    beginner_ok: true,
    sportTracking: false,
    capability_available_weight_room: true,
    capability_available_sport_conditioning: true,
    required: ['dumbbells'],
  },
  {
    movement_id: 201,
    name: 'Barbell Bench Press',
    pattern: 'push_h',
    is_compound: true,
    difficulty: 'Intermediate',
    beginner_ok: true,
    sportTracking: false,
    capability_available_weight_room: true,
    capability_available_sport_conditioning: true,
    required: ['barbell', 'bench'],
  },
  {
    movement_id: 203,
    name: 'Push-up',
    pattern: 'push_h',
    is_compound: true,
    difficulty: 'Beginner',
    beginner_ok: true,
    sportTracking: false,
    capability_available_weight_room: true,
    capability_available_sport_conditioning: true,
    required: [],
  },
  {
    movement_id: 301,
    name: 'Romanian Deadlift',
    pattern: 'hinge',
    is_compound: true,
    difficulty: 'Intermediate',
    beginner_ok: true,
    sportTracking: false,
    capability_available_weight_room: true,
    capability_available_sport_conditioning: true,
    required: ['barbell'],
  },
  {
    movement_id: 401,
    name: 'Chest-Supported Row',
    pattern: 'pull_h',
    is_compound: true,
    difficulty: 'Beginner',
    beginner_ok: true,
    sportTracking: false,
    capability_available_weight_room: true,
    capability_available_sport_conditioning: true,
    required: ['dumbbells', 'bench'],
  },
  {
    movement_id: 402,
    name: 'Overhead Press',
    pattern: 'push_v',
    is_compound: true,
    difficulty: 'Intermediate',
    beginner_ok: true,
    sportTracking: false,
    capability_available_weight_room: true,
    capability_available_sport_conditioning: true,
    required: ['barbell'],
  },
  {
    movement_id: 403,
    name: 'Chin-up',
    pattern: 'pull_v',
    is_compound: true,
    difficulty: 'Intermediate',
    beginner_ok: true,
    sportTracking: false,
    capability_available_weight_room: true,
    capability_available_sport_conditioning: true,
    required: ['pullup_bar'],
  },
  {
    movement_id: 404,
    name: 'Walking Lunge',
    pattern: 'lunge',
    is_compound: true,
    difficulty: 'Beginner',
    beginner_ok: true,
    sportTracking: false,
    capability_available_weight_room: true,
    capability_available_sport_conditioning: true,
    required: ['dumbbells'],
  },
  {
    movement_id: 405,
    name: 'Suitcase Carry',
    pattern: 'carry',
    is_compound: false,
    difficulty: 'Beginner',
    beginner_ok: true,
    sportTracking: false,
    capability_available_weight_room: true,
    capability_available_sport_conditioning: true,
    required: ['kettlebell'],
  },
  {
    movement_id: 501,
    name: 'Cable Face Pull',
    pattern: 'isolation',
    is_compound: false,
    difficulty: 'Beginner',
    beginner_ok: true,
    sportTracking: false,
    capability_available_weight_room: true,
    capability_available_sport_conditioning: true,
    required: ['cable_machine'],
  },
]);

const makeBlockRecord = ({
  blockSequence,
  macroBlockIndex,
  startDate,
  setRows = [],
  niggleRows = [],
  completionRows = [],
  swapRecords = [],
  globalGuardrail = null,
  isSuspended = false,
  peakPrescribedSetsByPattern = undefined,
}) => {
  const windowDates = makeWindowDates(startDate, 21);
  return {
    blockSequence,
    macroBlockIndex,
    windowDates,
    stateVectors: makeStateVectors(windowDates),
    setRows,
    niggleRows,
    completionRows,
    swapRecords,
    globalGuardrail,
    isSuspended,
    ...(peakPrescribedSetsByPattern !== undefined
      ? { peakPrescribedSetsByPattern }
      : {}),
  };
};

// ===========================================================================
// [1] Export surface & negative source invariants
// ===========================================================================
console.log('\n[longitudinal 1] export surface & negative source invariants');

const EXPECTED_EXPORTS = [
  'EQUIPMENT_NON_PATHOLOGICAL_CAUSES',
  'EQUIPMENT_NON_PATHOLOGICAL_PHRASE_IDS',
  'LONGITUDINAL_MRV_MAX_SETS',
  'LONGITUDINAL_MRV_MIN_SETS',
  'applyLongitudinalOverlayToBlockPlan',
  'evaluateLongitudinalAutopilot',
  'isValidLongitudinalAutopilotPolicy',
  'selectSubstitution',
].sort();

check('exported runtime surface is exact (no unratified default policy constants)', () => {
  assert.deepEqual(Object.keys(longitudinalMod).sort(), EXPECTED_EXPORTS);
  assert.equal(LONGITUDINAL_MRV_MIN_SETS, 1);
  assert.equal(LONGITUDINAL_MRV_MAX_SETS, 10);
  assert.deepEqual([...EQUIPMENT_NON_PATHOLOGICAL_CAUSES], ['equipment_busy']);
  assert.deepEqual([...EQUIPMENT_NON_PATHOLOGICAL_PHRASE_IDS], ['equipment-improvised']);
});

check('source file contains zero clock, RNG, network, SQL, or any-escape tokens', () => {
  const src = readFileSync(SOURCE_PATH, 'utf8');
  const forbiddenPatterns = [
    /\bDate\.now\s*\(/,
    /\bnew\s+Date\s*\(/,
    /\bMath\.random\s*\(/,
    /\bfetch\s*\(/,
    /:\s*any\b/,
    /\bas\s+any\b/,
    /\bSELECT\s+.+\s+FROM\b/i,
    /\bINSERT\s+INTO\b/i,
    /\bUPDATE\s+\w+\s+SET\b/i,
    /\bDELETE\s+FROM\b/i,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.equal(
      pattern.test(src),
      false,
      `forbidden token matched in longitudinalAutopilot.ts: ${pattern}`,
    );
  }
});

// ===========================================================================
// [2] Fail-closed policy gate (null / invalid policy)
// ===========================================================================
console.log('\n[longitudinal 2] fail-closed policy validation');

check('null or malformed policy fails closed to neutral overlay', () => {
  const dates = makeWindowDates('2026-01-05', 21);
  const hotBlock = makeBlockRecord({
    blockSequence: 1,
    macroBlockIndex: 1,
    startDate: '2026-01-05',
    setRows: makeWeek3OverreachSetRows(dates, 'squat', 0.8, 1.4),
    niggleRows: [{ date: dates[9], region: 'shoulder', severity: 5 }],
    swapRecords: [
      {
        sessionDate: dates[9],
        sessionPlanSlotId: 10,
        replacedBySessionPlanSlotId: 11,
        originalMovementId: 201,
        replacementMovementId: 203,
        pattern: 'push_h',
        cause: 'joint_discomfort',
      },
    ],
  });

  const baseInput = {
    profile: { ...DEFAULT_PROFILE },
    library: TEST_LIBRARY,
    inventory: STANDARD_EQUIPMENT_ITEMS,
    blocks: [hotBlock, { ...hotBlock, blockSequence: 2, macroBlockIndex: 2 }],
    upcomingMacroBlockIndex: 3,
    upcomingMacroPhase: 'hypertrophy',
  };

  for (const badPolicy of [
    null,
    { kTrigger: 0, swapWindowBlocks: 3, mCadence: 2, mClean: 2, completionPolicy: null },
    { kTrigger: 2, swapWindowBlocks: 0, mCadence: 2, mClean: 2, completionPolicy: null },
    { kTrigger: 2, swapWindowBlocks: 3, mCadence: -1, mClean: 2, completionPolicy: null },
    { kTrigger: 2, swapWindowBlocks: 3, mCadence: 2, mClean: Number.NaN, completionPolicy: null },
    {
      kTrigger: 2,
      swapWindowBlocks: 3,
      mCadence: 2,
      mClean: 2,
      completionPolicy: { minObservationDays: 0, deficitThreshold: 0, strongThreshold: Number.NaN },
    },
  ]) {
    assert.equal(isValidLongitudinalAutopilotPolicy(badPolicy), false);
    const out = evaluateLongitudinalAutopilot({ ...baseInput, policy: badPolicy });
    assert.equal(out.policyApplied, false);
    assert.deepEqual(out.derivedPreferences, {});
    assert.deepEqual(out.substitutions, {});
    for (const p of MOVEMENT_PATTERNS) {
      assert.equal(out.patternMrvSets[p], 10);
      assert.equal(out.week3SetTrimByPattern[p], 0);
      assert.deepEqual(out.controlAction.corrections[p], {
        dLoad_p: 1,
        dSet_p: 0,
        dRpe_p: 0,
        prefBias_p: 0,
      });
    }
  }
});

// ===========================================================================
// [3] Mechanism 1: Cross-block 073 swap + joint-discomfort memory
// ===========================================================================
console.log('\n[longitudinal 3] Mechanism 1 — 073 swap + joint-discomfort memory');

check('below kTrigger joint-coupled swaps does NOT promote Avoid', () => {
  const b1Dates = makeWindowDates('2026-01-05', 21);
  const b1 = makeBlockRecord({
    blockSequence: 1,
    macroBlockIndex: 1,
    startDate: '2026-01-05',
    niggleRows: [{ date: b1Dates[8], region: 'shoulder', severity: 5 }],
    swapRecords: [
      {
        sessionDate: b1Dates[8],
        sessionPlanSlotId: 1,
        replacedBySessionPlanSlotId: 2,
        originalMovementId: 201,
        replacementMovementId: 203,
        pattern: 'push_h',
        cause: 'joint_discomfort',
      },
      // Duplicate of the same slot replacement must be deduplicated, not counted twice.
      {
        sessionDate: b1Dates[8],
        sessionPlanSlotId: 1,
        replacedBySessionPlanSlotId: 2,
        originalMovementId: 201,
        replacementMovementId: 203,
        pattern: 'push_h',
        cause: 'joint_discomfort',
      },
    ],
  });

  const out = evaluateLongitudinalAutopilot({
    profile: { ...DEFAULT_PROFILE, training_age: 'intermediate' },
    library: TEST_LIBRARY,
    inventory: STANDARD_EQUIPMENT_ITEMS,
    blocks: [b1],
    upcomingMacroBlockIndex: 2,
    upcomingMacroPhase: 'gpp',
    policy: EXPLICIT_POLICY,
  });

  assert.equal(out.policyApplied, true);
  assert.equal(out.swapTriggerCounts[201] ?? 0, 1);
  assert.equal(out.derivedPreferences[201], undefined);
  assert.equal(out.substitutions[201], undefined);
});

check('reaching kTrigger across trailing 3-block window promotes Avoid (-1) + Layer 1 green regression', () => {
  const b1Dates = makeWindowDates('2026-01-05', 21);
  const b2Dates = makeWindowDates('2026-02-02', 21);
  const b3Dates = makeWindowDates('2026-03-02', 21);

  const b1 = makeBlockRecord({
    blockSequence: 1,
    macroBlockIndex: 1,
    startDate: '2026-01-05',
    niggleRows: [{ date: b1Dates[5], region: 'shoulder', severity: 4 }],
    swapRecords: [
      {
        sessionDate: b1Dates[5],
        sessionPlanSlotId: 10,
        replacedBySessionPlanSlotId: 11,
        originalMovementId: 201,
        replacementMovementId: 202,
        pattern: 'push_h',
        cause: 'joint_discomfort',
      },
    ],
  });
  const b2 = makeBlockRecord({
    blockSequence: 2,
    macroBlockIndex: 2,
    startDate: '2026-02-02',
  });
  const b3 = makeBlockRecord({
    blockSequence: 3,
    macroBlockIndex: 3,
    startDate: '2026-03-02',
    niggleRows: [{ date: b3Dates[10], region: 'shoulder', severity: 5 }],
    swapRecords: [
      {
        sessionDate: b3Dates[10],
        sessionPlanSlotId: 20,
        replacedBySessionPlanSlotId: 21,
        originalMovementId: 201,
        replacementMovementId: 203,
        pattern: 'push_h',
        sessionFeelReasonPain: 1,
      },
    ],
  });

  const out = evaluateLongitudinalAutopilot({
    profile: { ...DEFAULT_PROFILE, training_age: 'intermediate' },
    library: TEST_LIBRARY,
    inventory: STANDARD_EQUIPMENT_ITEMS,
    blocks: [b1, b2, b3],
    upcomingMacroBlockIndex: 4,
    upcomingMacroPhase: 'hypertrophy',
    policy: EXPLICIT_POLICY,
  });

  assert.equal(out.swapTriggerCounts[201], 2);
  assert.equal(out.derivedPreferences[201], MOVEMENT_PREFERENCE.AVOID);
  const sub = out.substitutions[201];
  assert.ok(sub !== undefined, 'expected substitution record for movement 201');
  assert.equal(sub.kind, 'layer1_regression');
  assert.equal(sub.color, 'green');
  // Push-up (203) is Beginner + Prioritize (+1) vs DB Bench (202) Beginner + Neutral (0).
  // Board Press (204) is Advanced (> Intermediate target 201) so Layer 1 bars it.
  assert.equal(sub.replacement.movement_id, 203);
  assert.equal(
    sub.substitutionResult.layer1Regression.options.some((o) => o.movement_id === 204),
    false,
  );
  assert.equal(
    sub.substitutionResult.layer1Regression.options.some((o) => o.movement_id === 201),
    false,
  );
});

check('trailing 3-block window expires swap memory once triggers age past swapWindowBlocks', () => {
  const mkSwapBlock = (seq, startIso, withSwap) => {
    const d = makeWindowDates(startIso, 21);
    return makeBlockRecord({
      blockSequence: seq,
      macroBlockIndex: seq,
      startDate: startIso,
      niggleRows: withSwap ? [{ date: d[6], region: 'shoulder', severity: 5 }] : [],
      swapRecords: withSwap
        ? [
            {
              sessionDate: d[6],
              sessionPlanSlotId: seq * 10,
              replacedBySessionPlanSlotId: seq * 10 + 1,
              originalMovementId: 201,
              replacementMovementId: 203,
              pattern: 'push_h',
              cause: 'joint_discomfort',
            },
          ]
        : [],
    });
  };

  const b1 = mkSwapBlock(1, '2026-01-05', true);
  const b2 = mkSwapBlock(2, '2026-02-02', true);
  const b3 = mkSwapBlock(3, '2026-03-02', false);
  const b4 = mkSwapBlock(4, '2026-03-30', false);
  const b5 = mkSwapBlock(5, '2026-04-27', false);

  // At end of b3, trailing 3 blocks are [b1, b2, b3] => 2 triggers => Avoid active.
  const atB3 = evaluateLongitudinalAutopilot({
    profile: { ...DEFAULT_PROFILE, training_age: 'intermediate' },
    library: TEST_LIBRARY,
    inventory: STANDARD_EQUIPMENT_ITEMS,
    blocks: [b1, b2, b3],
    upcomingMacroBlockIndex: 4,
    upcomingMacroPhase: 'hypertrophy',
    policy: EXPLICIT_POLICY,
  });
  assert.equal(atB3.derivedPreferences[201], MOVEMENT_PREFERENCE.AVOID);

  // At end of b4, trailing 3 blocks are [b2, b3, b4] => 1 trigger (< 2) => Avoid expired!
  const atB4 = evaluateLongitudinalAutopilot({
    profile: { ...DEFAULT_PROFILE, training_age: 'intermediate' },
    library: TEST_LIBRARY,
    inventory: STANDARD_EQUIPMENT_ITEMS,
    blocks: [b1, b2, b3, b4],
    upcomingMacroBlockIndex: 5,
    upcomingMacroPhase: 'volume',
    policy: EXPLICIT_POLICY,
  });
  assert.equal(atB4.swapTriggerCounts[201] ?? 0, 1);
  assert.equal(atB4.derivedPreferences[201], undefined);

  // At end of b5, trailing 3 blocks are [b3, b4, b5] => 0 triggers.
  const atB5 = evaluateLongitudinalAutopilot({
    profile: { ...DEFAULT_PROFILE, training_age: 'intermediate' },
    library: TEST_LIBRARY,
    inventory: STANDARD_EQUIPMENT_ITEMS,
    blocks: [b1, b2, b3, b4, b5],
    upcomingMacroBlockIndex: 6,
    upcomingMacroPhase: 'volume',
    policy: EXPLICIT_POLICY,
  });
  assert.equal(atB5.swapTriggerCounts[201] ?? 0, 0);
  assert.equal(atB5.derivedPreferences[201], undefined);
});

check('NEGATIVE INVARIANT: cause === "equipment_busy" and matched_phrase_entry_id === "equipment-improvised" produce ZERO Avoid promotions even alongside operative niggles', () => {
  const blocks = [0, 1, 2].map((idx) => {
    const startIso = addDaysIso('2026-01-05', idx * 28);
    const d = makeWindowDates(startIso, 21);
    return makeBlockRecord({
      blockSequence: idx + 1,
      macroBlockIndex: idx + 1,
      startDate: startIso,
      // Co-occurring operative niggles on BOTH shoulder and knee!
      niggleRows: [
        { date: d[3], region: 'shoulder', severity: 6 },
        { date: d[10], region: 'knee', severity: 6 },
      ],
      swapRecords: [
        {
          sessionDate: d[3],
          sessionPlanSlotId: 100 + idx * 10,
          replacedBySessionPlanSlotId: 101 + idx * 10,
          originalMovementId: 201,
          replacementMovementId: 202,
          pattern: 'push_h',
          cause: 'equipment_busy',
          sessionFeelReasonEquipment: 1,
        },
        {
          sessionDate: d[10],
          sessionPlanSlotId: 200 + idx * 10,
          replacedBySessionPlanSlotId: 201 + idx * 10,
          originalMovementId: 102,
          replacementMovementId: 103,
          pattern: 'squat',
          matched_phrase_entry_id: 'equipment-improvised',
        },
        {
          sessionDate: d[11],
          sessionPlanSlotId: 300 + idx * 10,
          replacedBySessionPlanSlotId: 301 + idx * 10,
          originalMovementId: 301,
          replacementMovementId: 302,
          pattern: 'hinge',
          matchedPhraseEntryId: 'equipment-improvised',
        },
      ],
    });
  });

  const out = evaluateLongitudinalAutopilot({
    profile: { ...DEFAULT_PROFILE, training_age: 'intermediate' },
    library: TEST_LIBRARY,
    inventory: STANDARD_EQUIPMENT_ITEMS,
    blocks,
    upcomingMacroBlockIndex: 4,
    upcomingMacroPhase: 'hypertrophy',
    policy: EXPLICIT_POLICY,
  });

  assert.deepEqual(out.derivedPreferences, {});
  assert.deepEqual(out.substitutions, {});
  assert.equal(out.swapTriggerCounts[201] ?? 0, 0);
  assert.equal(out.swapTriggerCounts[102] ?? 0, 0);
  assert.equal(out.swapTriggerCounts[301] ?? 0, 0);
});

check('selectSubstitution honours Avoid map and halt supremacy on acute upcoming niggles', () => {
  // If Push-up (203) is ALSO Avoided (-1), selectSubstitution must skip 203 and pick DB Bench (202).
  const subSkipAvoid = selectSubstitution({
    targetMovementId: 201,
    library: TEST_LIBRARY,
    derivedPreferences: { 201: -1, 203: -1 },
    inventory: STANDARD_EQUIPMENT_ITEMS,
    trainingAge: 'intermediate',
    upcomingBlockNiggles: [],
  });
  assert.equal(subSkipAvoid.kind, 'layer1_regression');
  assert.equal(subSkipAvoid.replacement.movement_id, 202);

  // Acute halt-level niggle (severity 8 >= intermediate haltMin 8) triggers halt_advised.
  const subHalt = selectSubstitution({
    targetMovementId: 201,
    library: TEST_LIBRARY,
    derivedPreferences: { 201: -1 },
    inventory: STANDARD_EQUIPMENT_ITEMS,
    trainingAge: 'intermediate',
    upcomingBlockNiggles: [{ region: 'shoulder', severity: 8 }],
  });
  assert.equal(subHalt.kind, 'halt_advised');
  assert.equal(subHalt.replacement, null);
});

// ===========================================================================
// [4] Mechanism 2: Bounded per-pattern MRV_p in [1, 10] & Week-3 Cadence Modulator
// ===========================================================================
console.log('\n[longitudinal 4] Mechanism 2 — MRV_p in [1, 10] & Week-3 cadence modulator');

check('per-pattern MRV_p stays strictly inside [1, 10] across extreme deficit and headroom streaks', () => {
  const deficitBlocks = Array.from({ length: 14 }, (_, idx) => {
    const startIso = addDaysIso('2026-01-05', idx * 28);
    const d = makeWindowDates(startIso, 21);
    return makeBlockRecord({
      blockSequence: idx + 1,
      macroBlockIndex: (idx % 8) + 1,
      startDate: startIso,
      setRows: makeWeek3OverreachSetRows(d, 'squat', 0.9, 1.5),
    });
  });

  const lowOut = evaluateLongitudinalAutopilot({
    profile: { ...DEFAULT_PROFILE, training_age: 'intermediate' },
    library: TEST_LIBRARY,
    inventory: STANDARD_EQUIPMENT_ITEMS,
    blocks: deficitBlocks,
    initialPatternMrvSets: { squat: 0, push_h: 999 },
    upcomingMacroBlockIndex: 7,
    upcomingMacroPhase: 'peak',
    policy: EXPLICIT_POLICY,
  });

  assert.equal(lowOut.patternMrvSets.squat, LONGITUDINAL_MRV_MIN_SETS);
  assert.equal(lowOut.patternMrvSets.push_h, LONGITUDINAL_MRV_MAX_SETS);
  for (const p of MOVEMENT_PATTERNS) {
    assert.equal(Number.isInteger(lowOut.patternMrvSets[p]), true);
    assert.equal(lowOut.patternMrvSets[p] >= 1 && lowOut.patternMrvSets[p] <= 10, true);
  }

  const headroomBlocks = Array.from({ length: 14 }, (_, idx) => {
    const startIso = addDaysIso('2026-01-05', idx * 28);
    const d = makeWindowDates(startIso, 21);
    return makeBlockRecord({
      blockSequence: idx + 1,
      macroBlockIndex: (idx % 8) + 1,
      startDate: startIso,
      setRows: makePatternSetRows(d, 'squat', -1.5, 4),
    });
  });

  const highOut = evaluateLongitudinalAutopilot({
    profile: { ...DEFAULT_PROFILE, training_age: 'intermediate' },
    library: TEST_LIBRARY,
    inventory: STANDARD_EQUIPMENT_ITEMS,
    blocks: headroomBlocks,
    initialPatternMrvSets: { squat: 9 },
    upcomingMacroBlockIndex: 7,
    upcomingMacroPhase: 'peak',
    policy: EXPLICIT_POLICY,
  });

  assert.equal(highOut.patternMrvSets.squat, LONGITUDINAL_MRV_MAX_SETS);
});

check('Week-3 cadence trim (-1) engages at mCadence consecutive overreach blocks, holds across neutral/interrupted blocks, and releases only after mClean consecutive clean latent_headroom blocks', () => {
  const mkOverreach = (seq, startIso) => {
    const d = makeWindowDates(startIso, 21);
    return makeBlockRecord({
      blockSequence: seq,
      macroBlockIndex: ((seq - 1) % 8) + 1,
      startDate: startIso,
      setRows: makeWeek3OverreachSetRows(d, 'squat', 0.4, 1.2),
      peakPrescribedSetsByPattern: { squat: 6 },
    });
  };
  const mkNeutral = (seq, startIso) => {
    const d = makeWindowDates(startIso, 21);
    return makeBlockRecord({
      blockSequence: seq,
      macroBlockIndex: ((seq - 1) % 8) + 1,
      startDate: startIso,
      setRows: makePatternSetRows(d, 'squat', 0.0, 4),
    });
  };
  const mkCleanHeadroom = (seq, startIso) => {
    const d = makeWindowDates(startIso, 21);
    return makeBlockRecord({
      blockSequence: seq,
      macroBlockIndex: ((seq - 1) % 8) + 1,
      startDate: startIso,
      setRows: makePatternSetRows(d, 'squat', -1.5, 4),
    });
  };
  const mkCautionHeadroom = (seq, startIso) => {
    const d = makeWindowDates(startIso, 21);
    return makeBlockRecord({
      blockSequence: seq,
      macroBlockIndex: ((seq - 1) % 8) + 1,
      startDate: startIso,
      setRows: makePatternSetRows(d, 'squat', -1.5, 4),
      // Operative knee niggle turns flawClass into 'caution' — NOT clean latent_headroom!
      niggleRows: [{ date: d[10], region: 'knee', severity: 5 }],
    });
  };

  const b1 = mkOverreach(1, '2026-01-05');
  const b2 = mkOverreach(2, '2026-02-02');
  const b3 = mkNeutral(3, '2026-03-02');
  const b4 = mkCleanHeadroom(4, '2026-03-30');
  const b5Interrupt = mkCautionHeadroom(5, '2026-04-27');
  const b6 = mkCleanHeadroom(6, '2026-05-25');
  const b7 = mkCleanHeadroom(7, '2026-06-22');

  const evalSeq = (blocks) =>
    evaluateLongitudinalAutopilot({
      profile: { ...DEFAULT_PROFILE, training_age: 'intermediate' },
      library: TEST_LIBRARY,
      inventory: STANDARD_EQUIPMENT_ITEMS,
      blocks,
      initialPatternMrvSets: { squat: 6 },
      upcomingMacroBlockIndex: (blocks.length % 8) + 1,
      upcomingMacroPhase: macroPhaseOf((blocks.length % 8) + 1),
      policy: EXPLICIT_POLICY,
    });

  // After 1 overreach block (< mCadence=2): MRV contracted to 5, Week-3 trim still 0.
  const r1 = evalSeq([b1]);
  assert.equal(r1.week3SetTrimByPattern.squat, 0);
  assert.equal(r1.patternMrvSets.squat, 5);

  // After 2 consecutive overreach blocks (=== mCadence=2): Week-3 trim engages (-1)!
  const r2 = evalSeq([b1, b2]);
  assert.equal(r2.week3SetTrimByPattern.squat, -1);

  // After neutral b3: Week-3 trim holds at -1.
  const r3 = evalSeq([b1, b2, b3]);
  assert.equal(r3.week3SetTrimByPattern.squat, -1);

  // After 1 clean headroom block b4 (< mClean=2): Week-3 trim still -1.
  const r4 = evalSeq([b1, b2, b3, b4]);
  assert.equal(r4.week3SetTrimByPattern.squat, -1);

  // Caution block b5 interrupts the clean streak -> b6 is only clean #1 -> trim STILL -1!
  const r6 = evalSeq([b1, b2, b3, b4, b5Interrupt, b6]);
  assert.equal(r6.week3SetTrimByPattern.squat, -1);

  // Two consecutive clean latent_headroom blocks (b6, b7 === mClean=2):
  // Week-3 trim steps back up +1 (-1 -> 0) and squat MRV steps up +1!
  const r7 = evalSeq([b1, b2, b3, b4, b5Interrupt, b6, b7]);
  assert.equal(r7.week3SetTrimByPattern.squat, 0);
  assert.equal(r7.patternMrvSets.squat, r6.patternMrvSets.squat + 1);
});

check('applyLongitudinalOverlayToBlockPlan trims Week 3 by -1, enforces MRV_p, substitutes Avoided movements, and preserves Week 4 deload', () => {
  const b1Dates = makeWindowDates('2026-01-05', 21);
  const b2Dates = makeWindowDates('2026-02-02', 21);

  const b1 = makeBlockRecord({
    blockSequence: 1,
    macroBlockIndex: 1,
    startDate: '2026-01-05',
    setRows: makeWeek3OverreachSetRows(b1Dates, 'squat', 0.4, 1.1),
    niggleRows: [{ date: b1Dates[8], region: 'shoulder', severity: 5 }],
    swapRecords: [
      {
        sessionDate: b1Dates[8],
        sessionPlanSlotId: 1,
        replacedBySessionPlanSlotId: 2,
        originalMovementId: 201,
        replacementMovementId: 203,
        pattern: 'push_h',
        cause: 'joint_discomfort',
      },
    ],
  });
  const b2 = makeBlockRecord({
    blockSequence: 2,
    macroBlockIndex: 2,
    startDate: '2026-02-02',
    setRows: makeWeek3OverreachSetRows(b2Dates, 'squat', 0.4, 1.2),
    niggleRows: [{ date: b2Dates[8], region: 'shoulder', severity: 5 }],
    swapRecords: [
      {
        sessionDate: b2Dates[8],
        sessionPlanSlotId: 3,
        replacedBySessionPlanSlotId: 4,
        originalMovementId: 201,
        replacementMovementId: 203,
        pattern: 'push_h',
        cause: 'joint_discomfort',
      },
    ],
  });

  const overlay = evaluateLongitudinalAutopilot({
    profile: { ...DEFAULT_PROFILE, objective: 'strength', training_age: 'intermediate' },
    library: TEST_LIBRARY,
    inventory: STANDARD_EQUIPMENT_ITEMS,
    blocks: [b1, b2],
    initialPatternMrvSets: { hinge: 3 },
    upcomingMacroBlockIndex: 3,
    upcomingMacroPhase: 'hypertrophy',
    policy: EXPLICIT_POLICY,
  });

  const rawPlan = generateBlock({
    profile: { ...DEFAULT_PROFILE, objective: 'strength', training_age: 'intermediate' },
    movements: GENERATOR_LIBRARY,
    startDate: '2026-03-02',
    macroBlockIndex: 3,
  });
  const patternById = new Map(GENERATOR_LIBRARY.map((m) => [m.movement_id, m.pattern]));
  const rawSnapshot = clone(rawPlan);

  const projected = applyLongitudinalOverlayToBlockPlan(rawPlan, patternById, overlay);

  // Input BlockPlan was not mutated.
  assert.deepEqual(rawPlan, rawSnapshot);

  let sawWeek3SquatTrim = false;
  let sawWeek4DeloadUnchanged = false;
  let sawBenchSubstituted = false;

  for (let sIdx = 0; sIdx < rawPlan.sessions.length; sIdx += 1) {
    const beforeSession = rawPlan.sessions[sIdx];
    const afterSession = projected.sessions[sIdx];
    for (let k = 0; k < beforeSession.slots.length; k += 1) {
      const beforeSlot = beforeSession.slots[k];
      const afterSlot = afterSession.slots[k];
      const pattern = patternById.get(afterSlot.movement_id);

      assert.equal(afterSlot.sets >= 1 && afterSlot.sets <= 10, true);

      if (beforeSlot.movement_id === 201 && beforeSession.phase !== 'deload') {
        assert.equal(afterSlot.movement_id, 203);
        sawBenchSubstituted = true;
      }
      if (pattern === 'hinge' && beforeSession.phase !== 'deload') {
        assert.equal(afterSlot.sets <= 3, true);
      }
      if (
        pattern === 'squat' &&
        beforeSession.week_index === 3 &&
        beforeSession.phase !== 'deload' &&
        beforeSlot.sets > 1
      ) {
        const cappedBefore = Math.min(beforeSlot.sets, overlay.patternMrvSets.squat);
        assert.equal(afterSlot.sets, Math.max(1, cappedBefore - 1));
        sawWeek3SquatTrim = true;
      }
      if (beforeSession.phase === 'deload' && pattern === 'squat') {
        assert.equal(afterSlot.sets, Math.min(beforeSlot.sets, overlay.patternMrvSets.squat));
        sawWeek4DeloadUnchanged = true;
      }
    }
  }

  assert.equal(sawWeek3SquatTrim, true, 'expected at least one Week-3 squat slot trimmed');
  assert.equal(sawWeek4DeloadUnchanged, true, 'expected Week-4 deload squat slot preserved');
  assert.equal(sawBenchSubstituted, true, 'expected Avoided Bench (201) replaced by Push-up (203)');
});

// ===========================================================================
// [5] Beginner dLoad_p <= 1.0 clamp & 9-month macrocycle RPE raise envelope
// ===========================================================================
console.log('\n[longitudinal 5] Beginner upward-load clamp & 9-month macrocycle RPE envelope');

check('NON-VACUOUS beginner clamp: identical strong headroom grants dLoad_p = 1.05 to intermediate and clamps beginner to 1.0', () => {
  const d = makeWindowDates('2026-01-05', 21);
  const strongHeadroomBlock = makeBlockRecord({
    blockSequence: 1,
    macroBlockIndex: 1,
    startDate: '2026-01-05',
    setRows: makePatternSetRows(d, 'squat', -1.8, 4),
    completionRows: d.slice(0, 7).map((date) => ({
      date,
      pattern: 'squat',
      evidenceCount: 4,
      sumShortfall: 0,
    })),
  });

  const intermediateOut = evaluateLongitudinalAutopilot({
    profile: { ...DEFAULT_PROFILE, training_age: 'intermediate' },
    library: TEST_LIBRARY,
    inventory: STANDARD_EQUIPMENT_ITEMS,
    blocks: [strongHeadroomBlock],
    upcomingMacroBlockIndex: 2,
    upcomingMacroPhase: 'gpp',
    policy: EXPLICIT_POLICY,
  });

  const beginnerOut = evaluateLongitudinalAutopilot({
    profile: { ...DEFAULT_PROFILE, training_age: 'beginner' },
    library: TEST_LIBRARY,
    inventory: STANDARD_EQUIPMENT_ITEMS,
    blocks: [strongHeadroomBlock],
    upcomingMacroBlockIndex: 2,
    upcomingMacroPhase: 'gpp',
    policy: EXPLICIT_POLICY,
  });

  assert.equal(intermediateOut.controlAction.corrections.squat.dLoad_p, 1.05);
  for (const p of MOVEMENT_PATTERNS) {
    assert.equal(
      beginnerOut.controlAction.corrections[p].dLoad_p <= 1.0,
      true,
      `beginner pattern ${p} exceeded 1.0 load modifier`,
    );
  }
  assert.equal(beginnerOut.controlAction.corrections.squat.dLoad_p, 1.0);
});

check('completion shortfall reduction overrides positive RPE headroom fieldwise', () => {
  const d = makeWindowDates('2026-01-05', 21);
  const mismatchBlock = makeBlockRecord({
    blockSequence: 1,
    macroBlockIndex: 1,
    startDate: '2026-01-05',
    setRows: makePatternSetRows(d, 'squat', -1.5, 4),
    completionRows: d.slice(14, 21).map((date) => ({
      date,
      pattern: 'squat',
      evidenceCount: 4,
      sumShortfall: 2.4, // 0.6 shortfall >= strongThreshold 0.5
    })),
  });

  const out = evaluateLongitudinalAutopilot({
    profile: { ...DEFAULT_PROFILE, training_age: 'intermediate' },
    library: TEST_LIBRARY,
    inventory: STANDARD_EQUIPMENT_ITEMS,
    blocks: [mismatchBlock],
    upcomingMacroBlockIndex: 2,
    upcomingMacroPhase: 'gpp',
    policy: EXPLICIT_POLICY,
  });

  assert.deepEqual(out.controlAction.corrections.squat, {
    dLoad_p: 0.95,
    dSet_p: -1,
    dRpe_p: -0.5,
    prefBias_p: -1,
  });
});

check('9-month (9-block) trajectory enforces cumulative RPE raise <= 2.5 in blocks 1..8, 0.0 in 6..8, 0.0 under suspension, and clean Macrocycle 2 rollover at block 9', () => {
  const blocks = [];
  const blockGrants = [];

  for (let seq = 1; seq <= 9; seq += 1) {
    const macroIdx = ((seq - 1) % 8) + 1;
    const startIso = addDaysIso('2026-01-05', (seq - 1) * 28);
    const d = makeWindowDates(startIso, 21);
    blocks.push(
      makeBlockRecord({
        blockSequence: seq,
        macroBlockIndex: macroIdx,
        startDate: startIso,
        setRows: makePatternSetRows(d, 'squat', -1.5, 4),
      }),
    );

    const out = evaluateLongitudinalAutopilot({
      profile: { ...DEFAULT_PROFILE, training_age: 'intermediate' },
      library: TEST_LIBRARY,
      inventory: STANDARD_EQUIPMENT_ITEMS,
      blocks: blocks.slice(0, seq),
      // Note: evaluate upcoming block = macroIdx (1..8 of macrocycle 1, then 1 of macrocycle 2)
      upcomingMacroBlockIndex: macroIdx,
      upcomingMacroPhase: macroPhaseOf(macroIdx),
      policy: EXPLICIT_POLICY,
    });
    blockGrants.push({
      seq,
      macroIdx,
      blockAddedRpe: out.controlAction.blockAddedRpe,
      cumulativeMacrocycleRpe: out.cumulativeMacrocycleRpeGranted,
    });
  }

  // Blocks 1..5 grant +0.5 each => sum = 2.5.
  const sum1To8 = blockGrants
    .slice(0, 8)
    .reduce((acc, row) => acc + row.blockAddedRpe, 0);
  const sum6To8 = blockGrants
    .slice(5, 8)
    .reduce((acc, row) => acc + row.blockAddedRpe, 0);

  assert.equal(sum1To8 <= 2.5, true);
  assert.equal(sum1To8, 2.5);
  assert.equal(sum6To8, 0.0);
  assert.equal(blockGrants[5].blockAddedRpe, 0);
  assert.equal(blockGrants[6].blockAddedRpe, 0);
  assert.equal(blockGrants[7].blockAddedRpe, 0);
  // Block 9 rolls into Macrocycle 2 Block 1 => resets cumulative cap and grants +0.5.
  assert.equal(blockGrants[8].macroIdx, 1);
  assert.equal(blockGrants[8].blockAddedRpe, 0.5);
  assert.equal(blockGrants[8].cumulativeMacrocycleRpe, 0.5);

  // Suspension withholding check at macroBlockIndex = 3:
  const suspendedOut = evaluateLongitudinalAutopilot({
    profile: { ...DEFAULT_PROFILE, training_age: 'intermediate' },
    library: TEST_LIBRARY,
    inventory: STANDARD_EQUIPMENT_ITEMS,
    blocks: blocks.slice(0, 2),
    upcomingMacroBlockIndex: 3,
    upcomingMacroPhase: 'hypertrophy',
    upcomingBlockSuspended: true,
    policy: EXPLICIT_POLICY,
  });
  assert.equal(suspendedOut.controlAction.blockAddedRpe, 0);
});

// ===========================================================================
// [6] Three Mandatory Poisoning Invariants (§5) & Frozen-Input Immutability
// ===========================================================================
console.log('\n[longitudinal 6] Three mandatory poisoning invariants & deep-freeze immutability');

const buildRichNineBlockInput = () => {
  const blocks = Array.from({ length: 9 }, (_, idx) => {
    const seq = idx + 1;
    const macroIdx = (idx % 8) + 1;
    const startIso = addDaysIso('2026-01-05', idx * 28);
    const d = makeWindowDates(startIso, 21);
    const setRows = idx < 2
      ? makeWeek3OverreachSetRows(d, 'squat', 0.3, 1.1)
      : makePatternSetRows(d, 'squat', -0.9, 4);
    const swapRecords = idx === 1 || idx === 2
      ? [
          {
            sessionDate: d[8],
            sessionPlanSlotId: seq * 100,
            replacedBySessionPlanSlotId: seq * 100 + 1,
            originalMovementId: 201,
            replacementMovementId: 203,
            pattern: 'push_h',
            cause: 'joint_discomfort',
          },
        ]
      : [];
    const niggleRows = idx === 1 || idx === 2
      ? [{ date: d[8], region: 'shoulder', severity: 5 }]
      : [];
    return makeBlockRecord({
      blockSequence: seq,
      macroBlockIndex: macroIdx,
      startDate: startIso,
      setRows,
      niggleRows,
      swapRecords,
    });
  });

  return {
    profile: { ...DEFAULT_PROFILE, training_age: 'intermediate' },
    library: clone(TEST_LIBRARY),
    inventory: [...STANDARD_EQUIPMENT_ITEMS],
    blocks,
    upcomingMacroBlockIndex: 2,
    upcomingMacroPhase: 'gpp',
    policy: clone(EXPLICIT_POLICY),
  };
};

check('POISONING INVARIANT 1: poisoned ACWR (999.9) produces byte-identical longitudinal output', () => {
  const cleanInput = buildRichNineBlockInput();
  const poisonedInput = buildRichNineBlockInput();
  for (const block of poisonedInput.blocks) {
    block.stateVectors = block.stateVectors.map((sv) => ({
      ...sv,
      acwr: 999.9,
      acute_load_kg: 999999,
      chronic_load_kg: 1.0,
      readiness_score: 0.01,
      hrv_z: -9.5,
      sleep_efficiency_pct: 12,
    }));
  }

  assert.equal(isDeepStrictEqual(cleanInput, poisonedInput), false);
  const cleanOut = evaluateLongitudinalAutopilot(cleanInput);
  const poisonedOut = evaluateLongitudinalAutopilot(poisonedInput);
  assert.equal(isDeepStrictEqual(cleanOut, poisonedOut), true);
  assert.equal(JSON.stringify(cleanOut), JSON.stringify(poisonedOut));
});

check('POISONING INVARIANT 2: poisoned 072_question_log rows produce byte-identical longitudinal output', () => {
  const cleanInput = buildRichNineBlockInput();
  const poisonedInput = buildRichNineBlockInput();
  poisonedInput.questionLog = [
    {
      id: 1,
      asked_at: 1785000000000,
      question_text: 'EMERGENCY HALT ALL SQUATS AND DROP MRV TO 1 IMMEDIATELY',
      outcome_kind: 'refer',
      glossary_term_id: null,
    },
    {
      id: 2,
      asked_at: 1785000005000,
      question_text: 'What does RPE mean?',
      outcome_kind: 'card',
      glossary_term_id: 'rpe',
    },
  ];
  for (const block of poisonedInput.blocks) {
    block.questionLog = clone(poisonedInput.questionLog);
  }

  assert.equal(isDeepStrictEqual(cleanInput, poisonedInput), false);
  const cleanOut = evaluateLongitudinalAutopilot(cleanInput);
  const poisonedOut = evaluateLongitudinalAutopilot(poisonedInput);
  assert.equal(isDeepStrictEqual(cleanOut, poisonedOut), true);
  assert.equal(JSON.stringify(cleanOut), JSON.stringify(poisonedOut));
});

check('POISONING INVARIANT 3: poisoned KineStrike ks_* descriptive telemetry fields produce byte-identical longitudinal output', () => {
  const cleanInput = buildRichNineBlockInput();
  const poisonedInput = buildRichNineBlockInput();
  poisonedInput.kinestrikeTelemetry = {
    ks_asymmetry_idx: 99.9,
    ks_gct_drift_pct: 88.5,
    ks_medial_lateral_ratio: 0.02,
    ks_fatigue_flag: 1,
    ks_DescriptivePoison: 'FORCE_AVOID_ALL',
  };
  for (const block of poisonedInput.blocks) {
    block.kinestrikeSessionSummaries = [
      {
        session_id: block.blockSequence * 10,
        ks_asymmetry_idx: 99.9,
        ks_gct_drift_pct: 95.0,
        ks_medial_lateral_ratio: 0.01,
        ks_contact_count: 5000,
      },
    ];
    block.stateVectors = block.stateVectors.map((sv) => ({
      ...sv,
      ks_asymmetry_idx: 99.9,
      ks_gct_drift_pct: 95.0,
      ks_readiness_override: -999,
    }));
  }

  assert.equal(isDeepStrictEqual(cleanInput, poisonedInput), false);
  const cleanOut = evaluateLongitudinalAutopilot(cleanInput);
  const poisonedOut = evaluateLongitudinalAutopilot(poisonedInput);
  assert.equal(isDeepStrictEqual(cleanOut, poisonedOut), true);
  assert.equal(JSON.stringify(cleanOut), JSON.stringify(poisonedOut));
});

check('deeply frozen inputs execute twice without mutation and yield deep-equal outputs', () => {
  const frozenA = deepFreeze(buildRichNineBlockInput());
  const frozenB = deepFreeze(buildRichNineBlockInput());
  const outA = evaluateLongitudinalAutopilot(frozenA);
  const outB = evaluateLongitudinalAutopilot(frozenB);
  assert.equal(isDeepStrictEqual(outA, outB), true);
});

if (failCount > 0) {
  console.error(`\n${failCount} LONGITUDINAL AUTOPILOT CHECK(S) FAILED`);
  process.exit(1);
}
console.log(`\nALL ${okCount} LONGITUDINAL AUTOPILOT CHECKS VERIFIED`);
