'use strict';
/**
 * verify_longitudinal_bounds.mjs — longitudinal deterministic verification.
 *
 * Work order: HERMES_WORK_ORDER_LONGITUDINAL_VERIFICATION.md (2026-08-14).
 * Test-only phase. Exercises REAL compiled production exports from
 * packages/inference/test/.build; copies no production formula and implements
 * no parallel training engine.
 *
 * Laws verified (failed by: nondeterminism, input mutation, unbounded growth,
 * non-finite/out-of-domain dose, dose expansion across repeated family
 * exposure, support surviving ahead of selected major work, loss or
 * duplication of athlete-selected majors, sport-tier relief leaking into
 * weight-room days, date duplication/ordering across month/year/DST-adjacent
 * boundaries, stale state silently replacing a missing-input seam).
 *
 * Family A — ELITE-BENCH-16: 16 weeks (four 4-week segments) of the real
 *             Elite five-times-weekly bench-family routine, real DB-seeded
 *             contracts; one binding segment proves support yields before
 *             major dose reduction; segments 1,2,4 are byte-reproductions.
 * Family B — METAMORPHIC: five variants, one input dimension changed per
 *             variant, each run as a real 4-week repetition; monotone
 *             consequences; round-trip reproducibility.
 * Family C — MIXED-CONTEXT-16: four consecutive generateBlock blocks with an
 *             explicit schedule of weight-room + conditioning + BJJ days over
 *             month/year/Sydney-DST-adjacent date-only boundaries.
 * Family D — TELEMETRY-CONSERVATIVE: recentAcwr null / hot / cool over four
 *             peak blocks; per-block isolation; store gate cited for stale
 *             readiness (not representable in this pure seam).
 *
 * Determinism discipline: fixed ISO dates, fixed fixtures, no Date.now(), no
 * RNG, no network, no clock reads. Every scenario runs twice from freshly
 * constructed (deep-cloned), deeply frozen inputs; deep equality asserted;
 * no input mutation. Freezing stubs Set/Map mutators so availability and
 * role-eligibility Sets are genuinely protected, and cloning precedes
 * freezing so module-level defaults are never mutated process-wide.
 * Informational process.memoryUsage() only — never a pass/fail threshold and
 * never Android private-dirty evidence.
 *
 * Audit remediation 2026-08-14 (12da513 review): counterexample checks X1-X7
 * now invoke the SAME named predicates the family checks use (they can and
 * must fail on a locally mutated fixture/result); deepFreeze protects Sets;
 * Family B carries real 4-week structure (20 simulated weeks; 68 total).
 *
 * Run: npm run verify:autopilot (appended after the Autopilot checks)
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const {
  composeRoutineMicrocycle,
  ROUTINE_FAMILY_STRESS_BUDGETS,
} = require('./.build/routineMicrocycle.js');
const {
  generateBlock,
  addDaysIso,
  accessContextForBlockFocus,
} = require('./.build/blockGenerator.js');
const {
  DEFAULT_PROFILE,
  STANDARD_EQUIPMENT_ITEMS,
} = require('./.build/types.js');

const ROOT = join(import.meta.dirname, '..', '..', '..');
const SCHEMA_DIR = join(ROOT, 'packages', 'core-db', 'src', 'schema');
const MICROCYCLE_BUDGETS = ROUTINE_FAMILY_STRESS_BUDGETS;

let pass = 0;
let fail = 0;
const check = (label, fn) => {
  try {
    fn();
    console.log(`  PASS ${label}`);
    pass += 1;
  } catch (error) {
    console.error(`  FAIL ${label}: ${error.message}`);
    fail += 1;
  }
};
/** Deep equality that distinguishes undefined-keyed from absent and treats
 *  NaN/±Infinity exactly — stronger than JSON.stringify byte comparison. */
const eq = (a, b) => isDeepStrictEqual(a, b);

/** Freeze stub: mutation of a frozen input throws in strict mode. */
const FREEZE_MUTATION = 'frozen input mutation';
const freezeGuard = () => {
  throw new TypeError(FREEZE_MUTATION);
};
/** Deep-freeze inputs. Set/Map mutators are stubbed out (Object.freeze alone
 *  does not block Set.add). Content is recursed so nested values are frozen. */
const deepFreeze = (o) => {
  if (o && typeof o === 'object') {
    if (o instanceof Set) {
      for (const value of o) deepFreeze(value);
      o.add = freezeGuard;
      o.delete = freezeGuard;
      o.clear = freezeGuard;
      Object.freeze(o);
      return o;
    }
    if (o instanceof Map) {
      for (const [key, value] of o) {
        deepFreeze(key);
        deepFreeze(value);
      }
      o.set = freezeGuard;
      o.delete = freezeGuard;
      o.clear = freezeGuard;
      Object.freeze(o);
      return o;
    }
    for (const value of Object.values(o)) deepFreeze(value);
    Object.freeze(o);
  }
  return o;
};
/** Fresh clone (Set/Map-aware) so every run starts from brand-new values. */
const cloneInput = (o) => {
  if (o instanceof Set) return new Set([...o].map(cloneInput));
  if (o instanceof Map) return new Map([...o].map(([k, v]) => [cloneInput(k), cloneInput(v)]));
  if (o && typeof o === 'object') {
    const out = Array.isArray(o)
      ? o.map(cloneInput)
      : Object.fromEntries(Object.entries(o).map(([k, v]) => [k, cloneInput(v)]));
    return out;
  }
  return o;
};
/** Clone first, then freeze — freezing must never leak into production module
 *  objects shared by reference (e.g. DEFAULT_PROFILE.injury_flags). */
const freezeFresh = (makeInput) => deepFreeze(cloneInput(makeInput()));
/** Run fn twice on freshly constructed, deeply frozen inputs; assert the two
 *  outputs are deep-equal and the frozen input was not mutated. A thrown error
 *  is reported with its real message and classified as mutation only when it
 *  is a freeze-guard mutation. */
const runTwice = (label, makeInput, fn) => {
  const first = fn(freezeFresh(makeInput));
  const second = fn(freezeFresh(makeInput));
  check(`${label}: deterministic double-run is deep-equal`, () => {
    assert.equal(eq(first, second), true);
  });
  check(`${label}: frozen inputs are never mutated`, () => {
    const frozen = freezeFresh(makeInput);
    let error = null;
    try {
      fn(frozen);
    } catch (caught) {
      error = caught;
    }
    assert.equal(error, null, error !== null
      ? (error.message === FREEZE_MUTATION
        ? 'engine mutated its frozen input'
        : `unexpected error on frozen inputs: ${error.message}`)
      : '');
  });
};

// ===========================================================================
// Named detectors — the SAME predicates the family checks use are re-used by
// the counterexample checks, so a local fixture/result mutation can and must
// make them fail. There is no second, hand-shaped implementation.
// ===========================================================================
const prescriptionDomainViolation = (row, rpeCap) => {
  const finite = (v) => Number.isFinite(v);
  if (!finite(row.sets) || !finite(row.reps) || !finite(row.targetRpe)
      || !finite(row.equivalentVolume) || !finite(row.stressDose)) {
    return `${row.movementId} day ${row.dayIndex} produced a non-finite dose`;
  }
  if (!Number.isInteger(row.sets) || row.sets < 1 || row.sets > 10) {
    return `${row.movementId} day ${row.dayIndex} sets ${row.sets} outside 1..10`;
  }
  if (!Number.isInteger(row.reps) || row.reps < 1 || row.reps > 100) {
    return `${row.movementId} day ${row.dayIndex} reps ${row.reps} outside 1..100`;
  }
  if (row.targetRpe < 5 || row.targetRpe > rpeCap) {
    return `${row.movementId} day ${row.dayIndex} targetRpe ${row.targetRpe} outside 5..${rpeCap}`;
  }
  if (row.equivalentVolume < 0 || row.stressDose < 0) {
    return `${row.movementId} day ${row.dayIndex} negative volume/stress`;
  }
  if (row.sets > row.authoredSets || row.reps > row.authoredReps
      || row.targetRpe > row.authoredTargetRpe) {
    return `${row.movementId} day ${row.dayIndex} dose expanded authored ${row.authoredSets}x${row.authoredReps}@${row.authoredTargetRpe} -> ${row.sets}x${row.reps}@${row.targetRpe}`;
  }
  return null;
};
const doseViolations = (result, rpeCap) =>
  result.prescriptions
    .map((row) => prescriptionDomainViolation(row, rpeCap))
    .filter((text) => text !== null);
const planSlotDomainViolation = (slot, rpeCap) => {
  if (!Number.isInteger(slot.sets) || slot.sets < 1 || slot.sets > 10) {
    return `slot ${slot.movement_id} sets ${slot.sets} outside 1..10`;
  }
  if (!Number.isInteger(slot.reps) || slot.reps < 1 || slot.reps > 30) {
    return `slot ${slot.movement_id} reps ${slot.reps} outside 1..30`;
  }
  if (!Number.isFinite(slot.target_rpe) || slot.target_rpe < 5
      || slot.target_rpe > rpeCap) {
    return `slot ${slot.movement_id} target_rpe ${slot.target_rpe} outside 5..${rpeCap}`;
  }
  return null;
};
/** Support-yield-before-major law, binding-fixture form: while the binding
 *  fixture demonstrably reduces a selected major, NO support row may remain
 *  included ahead of it. */
const supportFullyOmittedViolations = (result) =>
  result.prescriptions
    .filter((row) => row.role !== 'major')
    .filter((row) => row.included)
    .map((row) => `${row.movementId} support still included while a major is under binding pressure`);
/** Sport-tier-leak law: an Advanced movement never appears on a weight-room
 *  (full/lower/upper) session in a composed block trace. */
const leakViolations = (blocks, byId) => {
  const weightFocuses = new Set(['full', 'lower', 'upper']);
  const out = [];
  for (const block of blocks) {
    for (const session of block.sessions) {
      if (!weightFocuses.has(session.focus)) continue;
      for (const slot of session.slots) {
        const movement = byId.get(slot.movement_id);
        if (movement !== undefined && movement.difficulty === 'Advanced') {
          out.push(`Advanced ${slot.movement_id} on weight-room ${session.focus} day ${session.session_date}`);
        }
      }
    }
  }
  return out;
};
/** Date law: across a composed block trace every session date is unique and
 *  strictly increasing. */
const dateOrderViolations = (blocks) => {
  const dates = blocks.flatMap((block) => block.sessions.map((s) => s.session_date));
  const out = [];
  for (let i = 1; i < dates.length; i += 1) {
    if (dates[i] <= dates[i - 1]) {
      out.push(`${dates[i - 1]} -> ${dates[i]}`);
    }
  }
  return out;
};
/** Fail-closed law: a blocker may never coexist with therapeutic output. */
const failClosedViolation = (result) => (
  result.blockers.length > 0 && result.prescriptions.length > 0
    ? `${result.prescriptions.length} prescriptions present beside ${result.blockers.length} blocker(s)`
    : null);

// ===========================================================================
// Real library contracts (001-054 chain), exactly as verify_pipeline.mjs
// derives them — the same seeded contracts family A/B are required to use.
// ===========================================================================
function loadRealContracts() {
  const db = new DatabaseSync(':memory:');
  try {
    db.prepare('SELECT ln(2.0), sqrt(2.0)').get();
  } catch {
    db.function('ln', { deterministic: true }, (x) =>
      (x !== null && x > 0 ? Math.log(x) : null));
    db.function('sqrt', { deterministic: true }, (x) =>
      (x !== null && x >= 0 ? Math.sqrt(x) : null));
  }
  const fullChain = readdirSync(SCHEMA_DIR)
    .filter((file) => /^\d{3}_.*\.sql$/.test(file) && !file.startsWith('004_'))
    .sort();
  for (const file of fullChain) db.exec(readFileSync(join(SCHEMA_DIR, file), 'utf-8'));

  const idOf = (name) => {
    const row = db.prepare('SELECT movement_id FROM movement WHERE name = ?').get(name);
    assert.ok(row !== undefined, `library is missing the ratified movement "${name}"`);
    return Number(row.movement_id);
  };
  const routineMovements = db.prepare(`
    SELECT m.movement_id, m.name, m.pattern, m.is_compound, md.target_muscles
    FROM movement m JOIN movement_detail md USING (movement_id) ORDER BY m.movement_id
  `).all().map((row) => ({
    movementId: Number(row.movement_id), name: row.name, pattern: row.pattern,
    targetMuscles: JSON.parse(row.target_muscles), isCompound: row.is_compound === 1,
  }));
  const roleSet = (role) => new Set(db.prepare(
    'SELECT movement_id FROM movement_role_eligibility WHERE role = ? ORDER BY movement_id',
  ).all(role).map((row) => Number(row.movement_id)));
  const roleEligibility = {
    major: roleSet('major'), supplementary: roleSet('supplementary'),
    accessory: roleSet('accessory'), conditional: roleSet('conditional'),
  };
  const liftFamilies = db.prepare(`
    SELECT movement_id, family, stress_coefficient, preferred_purpose
    FROM movement_lift_family ORDER BY family, movement_id
  `).all().map((row) => ({
    movementId: Number(row.movement_id), family: row.family,
    stressCoefficient: Number(row.stress_coefficient),
    preferredPurpose: row.preferred_purpose,
  }));
  const assistance = db.prepare(`
    SELECT major_family, movement_id, distance, stress_factor, fatigue_cost, reason
    FROM movement_assistance_relationship ORDER BY major_family, distance, movement_id
  `).all().map((row) => ({
    family: row.major_family, movementId: Number(row.movement_id),
    distance: Number(row.distance), stressFactor: Number(row.stress_factor),
    fatigueCost: Number(row.fatigue_cost), reason: row.reason,
  }));
  const allAvailable = new Set(routineMovements.map((movement) => movement.movementId));
  return {
    db, idOf, routineMovements, roleEligibility, liftFamilies, assistance, allAvailable,
  };
}

// ===========================================================================
// Fixture completeness — a required context/capability field may never be
// omitted silently. These checkers fail with the field named.
// ===========================================================================
const ROUTINE_INPUT_REQUIRED = [
  ['selections', 'selections'], ['movements', 'movements'],
  ['liftFamilies', 'liftFamilies'], ['assistance', 'assistance'],
  ['roleEligibility', 'roleEligibility'], ['schemaType', 'schemaType'],
  ['objective', 'objective'], ['trainingAge', 'trainingAge'],
  ['durationCapMin', 'durationCapMin'], ['baseRpeCap', 'baseRpeCap'],
  ['availableMovementIds', 'availableMovementIds'],
];
const GENERATOR_MOVEMENT_REQUIRED = [
  ['movement_id', 'movement_id'], ['difficulty', 'difficulty'],
  ['beginner_ok', 'beginner_ok'], ['sportTracking', 'sportTracking'],
  ['capability_available_weight_room', 'capability_available_weight_room'],
  ['capability_available_sport_conditioning', 'capability_available_sport_conditioning'],
  ['name', 'name'], ['pattern', 'pattern'], ['is_compound', 'is_compound'],
  ['required', 'required'],
];
function assertRoutineInputComplete(input) {
  for (const [key, label] of ROUTINE_INPUT_REQUIRED) {
    assert.ok(input[key] !== undefined && input[key] !== null,
      `routine fixture missing required field "${label}"`);
  }
  return input;
}
function assertGeneratorFixtureComplete(movements) {
  for (const m of movements) {
    for (const [key, label] of GENERATOR_MOVEMENT_REQUIRED) {
      assert.ok(m[key] !== undefined && m[key] !== null,
        `generator fixture movement ${m.movement_id ?? '<missing movement_id>'} missing required field "${label}"`);
    }
    assert.equal(typeof m.sportTracking, 'boolean', `movement ${m.movement_id} sportTracking must be boolean`);
    assert.equal(typeof m.capability_available_weight_room, 'boolean',
      `movement ${m.movement_id} capability_available_weight_room must be boolean`);
    assert.equal(typeof m.capability_available_sport_conditioning, 'boolean',
      `movement ${m.movement_id} capability_available_sport_conditioning must be boolean`);
  }
  return movements;
}
const composeReal = (input) => composeRoutineMicrocycle(
  assertRoutineInputComplete(cloneInput(input)),
);

// ===========================================================================
// FAMILY A — Elite five-day bench-family routine, 16 weeks (4 segments).
// Segment 3 binds the family/session stress budget with heavy support;
// segments 1, 2 and 4 are the identical pure five-day routine and must
// byte-reproduce each other (no hidden cross-week accumulation).
// ===========================================================================
function familyA(contracts) {
  console.log('[A] ELITE-BENCH-16 (elite five-day bench-family routine)');
  const {
    idOf, routineMovements, roleEligibility, liftFamilies, assistance, allAvailable,
  } = contracts;
  const benchId = idOf('Competition Bench');
  const boardId = idOf('Board Press');
  const tricepsId = idOf('Triceps Pushdown');
  const hammerId = idOf('Hammer Curl');
  const benchExposure = (dayIndex) => ({
    dayIndex, slotIndex: 1, movementId: benchId, role: 'major', sets: 2, reps: 3, targetRpe: 6,
  });
  const pureSelections = [1, 2, 3, 4, 5].map(benchExposure);
  // Heavy support large enough to bind the session/elite stress bounds.
  const boundSelections = [
    { dayIndex: 1, slotIndex: 1, movementId: benchId, role: 'major', sets: 10, reps: 10, targetRpe: 9 },
    { dayIndex: 1, slotIndex: 2, movementId: boardId, role: 'major', sets: 10, reps: 10, targetRpe: 9 },
    { dayIndex: 1, slotIndex: 3, movementId: tricepsId, role: 'supplementary', sets: 5, reps: 20, targetRpe: 9 },
    { dayIndex: 1, slotIndex: 4, movementId: hammerId, role: 'accessory', sets: 5, reps: 20, targetRpe: 9 },
  ];
  const baseInput = {
    selections: pureSelections,
    movements: routineMovements, liftFamilies, assistance, roleEligibility,
    schemaType: 'LINEAR', objective: 'strength', trainingAge: 'elite',
    durationCapMin: 120, baseRpeCap: 9, availableMovementIds: allAvailable,
  };
  const boundInput = { ...baseInput, selections: boundSelections };

  const weekOutputs = (input) => [1, 2, 3, 4].map(() => composeReal(input));
  const segments = {
    s1: weekOutputs(baseInput),
    s2: weekOutputs(baseInput),
    s3: weekOutputs(boundInput),
    s4: weekOutputs(baseInput),
  };
  const segmentInputs = { s1: baseInput, s2: baseInput, s3: boundInput, s4: baseInput };
  for (const [name, weeks] of Object.entries(segments)) {
    check(`[A-${name}] all four weeks of the segment are byte-identical (pure seam, no cross-week accumulation)`, () => {
      for (let w = 1; w < 4; w += 1) assert.equal(eq(weeks[0], weeks[w]), true);
    });
    check(`[A-${name}] exact trace cardinality: 4 weeks x ${weeks[0].prescriptions.length} prescriptions`, () => {
      assert.equal(weeks.length, 4);
      assert.equal(weeks[0].prescriptions.length, segmentInputs[name].selections.length);
    });
  }
  const s1 = segments.s1[0];
  check('[A-seg1] five athlete-selected bench-family majors are preserved, none lost or duplicated', () => {
    const majors = s1.prescriptions.filter((row) => row.role === 'major');
    assert.equal(majors.length, 5);
    assert.equal(majors.every((row) => row.included && row.movementId === benchId), true);
    assert.deepEqual([...new Set(majors.map((row) => row.dayIndex))], [1, 2, 3, 4, 5]);
  });
  check('[A-seg1] distinct purpose assignment is deterministic and never expands authored sets/reps/RPE', () => {
    const decision = s1.familyDecisions[0];
    assert.equal(decision.family, 'bench_press');
    assert.equal(decision.exposureCount, 5);
    assert.equal(decision.variationCount, 1);
    assert.equal(new Set(s1.prescriptions.map((row) => row.purpose)).size, 5);
    assert.equal(s1.prescriptions.every((row) =>
      row.sets === row.authoredSets && row.reps === row.authoredReps
      && row.targetRpe <= row.authoredTargetRpe), true);
  });
  check('[A-seg1] all numeric outputs finite, dose inside production domains, family stress bounded', () => {
    assert.deepEqual(doseViolations(s1, 9), []);
    for (const decision of s1.familyDecisions) {
      assert.equal(Number.isFinite(decision.initialStress) && Number.isFinite(decision.finalStress), true);
      assert.ok(decision.finalStress <= decision.weeklyBudget);
      assert.ok(decision.finalStress <= decision.initialStress + 1e-9);
      assert.ok(decision.finalStress >= 0);
    }
    assert.equal(s1.blockers.length, 0);
  });
  const s3 = segments.s3[0];
  check('[A-seg3 binding] support is reduced/omitted before major dose reduction', () => {
    assert.deepEqual(s3.blockers, []);
    assert.equal(s3.familyDecisions[0].family, 'bench_press');
    const support = s3.prescriptions.filter((row) => row.role !== 'major');
    const majors = s3.prescriptions.filter((row) => row.role === 'major');
    assert.equal(support.length, 2);
    assert.deepEqual(supportFullyOmittedViolations(s3), [],
      'binding pressure must strip the authored support first');
    assert.equal(support.every((row) => row.adaptations.some((text) =>
      text.includes('before changing bench_press major exposure'))), true,
      'omitted support must keep the production yield-before-major provenance text');
    assert.equal(majors.every((row) => row.included && row.sets >= 1
      && row.reps >= 1 && row.targetRpe >= 5), true);
    assert.equal(majors.every((row) => row.sets <= row.authoredSets
      && row.reps <= row.authoredReps && row.targetRpe <= row.authoredTargetRpe), true);
    assert.equal(majors.some((row) => row.sets < row.authoredSets
      || row.reps < row.authoredReps || row.targetRpe < row.authoredTargetRpe), true,
      'the binding fixture must actually push major dose down, else the law is vacuous');
    const decision = s3.familyDecisions[0];
    assert.ok(decision.finalStress <= decision.weeklyBudget);
    assert.ok(decision.sessions[0].finalStress <= MICROCYCLE_BUDGETS.elite.session);
  });
  check('[A] a later repeated segment reproduces the original result byte-for-byte', () => {
    assert.equal(eq(segments.s4[0], segments.s1[0]), true);
    assert.equal(eq(segments.s2[0], segments.s1[0]), true);
  });
  // No outer wrapper: runTwice already registers its own checks (M4).
  runTwice('[A-s1]', () => baseInput, (frozen) => composeRoutineMicrocycle(frozen));
  runTwice('[A-s3]', () => boundInput, (frozen) => composeRoutineMicrocycle(frozen));
  return { segments, benchId };
}

// ===========================================================================
// FAMILY B — metamorphic routine bounds. Five variants, one input dimension
// changed per variant, each with a genuine 4-week repetition; consequences
// are monotone; returning to the original input reproduces it exactly.
// ===========================================================================
function familyB(contracts) {
  console.log('[B] METAMORPHIC (one input dimension at a time, 4 weeks per variant)');
  const {
    idOf, routineMovements, roleEligibility, liftFamilies, assistance, allAvailable,
  } = contracts;
  const benchId = idOf('Competition Bench');
  const tricepsId = idOf('Triceps Pushdown');
  const hammerId = idOf('Hammer Curl');
  const baseSelections = [
    { dayIndex: 1, slotIndex: 1, movementId: benchId, role: 'major', sets: 3, reps: 5, targetRpe: 8 },
    { dayIndex: 1, slotIndex: 2, movementId: tricepsId, role: 'supplementary', sets: 2, reps: 10, targetRpe: 8 },
  ];
  const make = (over = {}) => ({
    selections: baseSelections,
    movements: routineMovements, liftFamilies, assistance, roleEligibility,
    schemaType: 'LINEAR', objective: 'strength', trainingAge: 'elite',
    durationCapMin: 120, baseRpeCap: 9, availableMovementIds: allAvailable,
    ...over,
  });
  const variants = {
    base: make(),
    addSupport: make({
      selections: [...baseSelections,
        { dayIndex: 1, slotIndex: 3, movementId: hammerId, role: 'accessory', sets: 2, reps: 12, targetRpe: 6.5 }],
    }),
    tightenDuration: make({ durationCapMin: 15 }),
    lowerRpeCap: make({ baseRpeCap: 7.5, rpeCapBehavior: 'clamp' }),
    availabilityLoss: make({
      availableMovementIds: new Set([...allAvailable].filter((id) => id !== benchId)),
    }),
  };
  const result = {};
  for (const [name, input] of Object.entries(variants)) {
    result[name] = composeReal(input);
    const weeks = [1, 2, 3, 4].map(() => composeReal(input));
    for (let w = 1; w < 4; w += 1) {
      check(`[B-${name}] week ${w + 1} byte-reproduces week 1 (pure seam)`, () =>
        assert.equal(eq(weeks[0], weeks[w]), true));
    }
    runTwice(`[B-${name}]`, () => input, (frozen) => composeRoutineMicrocycle(frozen));
  }
  const { base: baseResult, addSupport: addResult, tightenDuration: tightResult,
    lowerRpeCap: clampResult, availabilityLoss: lostResult } = result;

  check('[B-BASE] routine fixture completeness gate names every required field', () => {
    assertRoutineInputComplete(variants.base);
  });
  const benchDose = (res) => res.prescriptions
    .filter((row) => row.movementId === benchId && row.role === 'major')
    .map((row) => [row.sets, row.reps, row.targetRpe])[0];
  check('[B-BASE] exact cardinality and bounded domains', () => {
    assert.equal(baseResult.prescriptions.length, 2);
    assert.equal(baseResult.blockers.length, 0);
    assert.deepEqual(doseViolations(baseResult, 9), []);
    const decision = baseResult.familyDecisions[0];
    assert.equal(decision.family, 'bench_press');
    assert.equal(Number.isFinite(decision.initialStress) && Number.isFinite(decision.finalStress), true);
    assert.ok(decision.finalStress <= decision.weeklyBudget);
  });

  check('[B-ADD-SUPPORT] adding support cannot increase any selected major\'s final sets, reps or RPE', () => {
    const added = benchDose(addResult);
    const original = benchDose(baseResult);
    assert.ok(added !== undefined && original !== undefined);
    assert.ok(added[0] <= original[0] && added[1] <= original[1] && added[2] <= original[2],
      `major dose rose from ${original.join('/')} to ${added.join('/')}`);
    const triceps = (res) => res.prescriptions.find((row) => row.movementId === tricepsId);
    assert.ok(triceps(addResult).sets <= triceps(baseResult).sets);
    assert.ok(triceps(addResult).reps <= triceps(baseResult).reps);
    assert.ok(triceps(addResult).targetRpe <= triceps(baseResult).targetRpe);
    // Non-vacuity: the added accessory reached the engine (output differs) and
    // is present in the analysis (included or explicitly omitted, never gone).
    assert.equal(eq(addResult, baseResult), false,
      'adding the accessory changed nothing — metamorphic law not exercised');
    assert.ok(addResult.prescriptions.some((row) => row.movementId === hammerId),
      'the added accessory was silently discarded from the analysis');
  });

  check('[B-TIGHTEN-DURATION] tightening a cap cannot increase included work or final family stress', () => {
    assert.equal(tightResult.blockers.length, 0, JSON.stringify(tightResult.blockers));
    const includedCount = (res) => res.prescriptions.filter((row) => row.included).length;
    assert.ok(includedCount(tightResult) < includedCount(baseResult),
      `included work did not strictly drop (${includedCount(baseResult)} -> ${includedCount(tightResult)}) — law not exercised`);
    const stress = (res) => res.familyDecisions[0].finalStress;
    assert.ok(stress(tightResult) <= stress(baseResult) + 1e-9,
      `family stress rose from ${stress(baseResult)} to ${stress(tightResult)} after tightening`);
    const support = tightResult.prescriptions.filter((row) => row.role !== 'major');
    assert.ok(support.every((row) => !row.included
      || row.adaptations.some((text) => text.includes('duration cap'))),
      'support must yield to the duration cap before a major');
    const bench = benchDose(tightResult);
    assert.ok(bench !== undefined && bench[0] <= 3 && bench[1] <= 5 && bench[2] <= 8);
  });

  check('[B-LOWER-RPE-CAP] lowering the RPE cap cannot raise any final RPE', () => {
    assert.equal(clampResult.blockers.length, 0, JSON.stringify(clampResult.blockers));
    assert.ok(clampResult.prescriptions.every((row) => row.targetRpe <= 7.5));
    assert.ok(clampResult.prescriptions.every((row) => row.targetRpe <= row.authoredTargetRpe));
    const bench = benchDose(clampResult);
    assert.ok(bench !== undefined && bench[2] <= benchDose(baseResult)[2]);
    assert.equal(bench[2], 7.5);
    assert.ok(clampResult.prescriptions.some((row) => row.adaptations.some((text) =>
      text.includes('Target RPE capped'))));
    assert.deepEqual(doseViolations(clampResult, 7.5), []);
  });

  check('[B-AVAILABILITY-LOSS] availability loss fails closed and cannot silently substitute or discard provenance', () => {
    assert.ok(lostResult.blockers.length > 0, 'availability loss must block');
    assert.ok(lostResult.blockers.some((text) => text.includes('Competition Bench')
      && text.includes('unavailable')), JSON.stringify(lostResult.blockers));
    assert.equal(lostResult.prescriptions.length, 0,
      'an availability loss must not silently substitute another movement');
    assert.equal(lostResult.familyDecisions.length, 0);
    assert.equal(failClosedViolation(lostResult), null);
  });

  // B5 — returning to the original input reproduces the original output exactly.
  check('[B] returning to the original input reproduces the original output exactly', () => {
    const replay = composeReal(variants.base);
    assert.equal(eq(replay, baseResult), true);
  });
  return { baseResult, clampResult, lostResult };
}

// ===========================================================================
// FAMILY C — mixed focus / access-context generation across four consecutive
// blocks over month / year / Sydney-DST-adjacent date-only boundaries.
// ===========================================================================
function generatorFixture() {
  const mv = (movement_id, name, pattern, over = {}) => ({
    movement_id, name, pattern, is_compound: pattern !== 'isolation' && pattern !== 'locomotion',
    difficulty: 'Beginner', beginner_ok: false, sportTracking: false,
    capability_available_weight_room: true,
    capability_available_sport_conditioning: true,
    required: [],
    ...over,
  });
  return assertGeneratorFixtureComplete([
    mv(1, 'Bodyweight Squat', 'squat'),
    mv(2, 'Goblet Squat', 'squat', { difficulty: 'Intermediate' }),
    mv(3, 'Bench Press', 'push_h', { difficulty: 'Intermediate' }),
    mv(4, 'Push-Up', 'push_h'),
    mv(5, 'Romanian Deadlift', 'hinge', { difficulty: 'Intermediate' }),
    mv(6, 'Pull-Up', 'pull_h'),
    mv(7, 'Cable Row', 'pull_h', { difficulty: 'Intermediate' }),
    // Leak probe: Advanced carry, capability-open in BOTH contexts. The only
    // gate that may keep it off a weight-room day is the tier ceiling.
    mv(8, 'Advanced Carry', 'carry', { difficulty: 'Advanced' }),
    // Equipment probe: same-pattern Intermediate row that needs a kettlebell.
    mv(9, 'Kettlebell Carry', 'carry', { difficulty: 'Intermediate', required: ['kettlebell'] }),
    mv(10, 'Farmer Carry', 'carry', { difficulty: 'Intermediate' }),
    mv(11, 'Run', 'locomotion', { difficulty: 'Advanced' }),
    // Capability probe: Advanced rotation closed in BOTH contexts; even with
    // the tier ceiling open the sport tier relief must never resurrect it.
    mv(12, 'Advanced Rotation', 'rotation', {
      difficulty: 'Advanced', capability_available_sport_conditioning: false,
    }),
    mv(13, 'Cable Rotation', 'rotation', { difficulty: 'Intermediate' }),
    // Sport-only capability probe: Advanced isolation available only in
    // sport/conditioning context (weight-room capability closed).
    mv(14, 'Advanced Isolation', 'isolation', {
      difficulty: 'Advanced', capability_available_weight_room: false,
    }),
    mv(15, 'Plank', 'isolation'),
  ]);
}
function familyC() {
  console.log('[C] MIXED-CONTEXT-16 (weight-room + conditioning + BJJ across boundaries)');
  const movements = generatorFixture();
  const movementById = new Map(movements.map((m) => [m.movement_id, m]));
  const schedule = [
    { day_index: 2, focus: 'full' },          // weight-room context
    { day_index: 4, focus: 'conditioning' },  // sport/conditioning context
    { day_index: 6, focus: 'bjj' },           // sport/conditioning context
  ];
  const profileBase = {
    ...DEFAULT_PROFILE,
    objective: 'strength',
    training_age: 'intermediate',
    weekly_frequency: 3,
    session_duration_cap_min: 110,
    base_rpe_cap: 9,
    equipment_inventory: [...STANDARD_EQUIPMENT_ITEMS],
    injury_flags: [...DEFAULT_PROFILE.injury_flags],
    mobility_limits: [...DEFAULT_PROFILE.mobility_limits],
  };
  const startDates = ['2025-10-04', '2025-11-01', '2025-11-29', '2025-12-27'];
  // Advance each next block start with the production UTC date helper.
  const verifiedStarts = startDates.map((_, i) =>
    (i === 0 ? startDates[0] : addDaysIso(startDates[i - 1], 28)));
  check('[C] block starts advance with the production UTC date helper (28 days)', () => {
    assert.deepEqual(verifiedStarts, startDates);
  });
  const composeC = (profile) => verifiedStarts.map((startDate) =>
    generateBlock({ profile, movements, startDate, programDays: schedule }));
  const blocks = composeC(profileBase);
  check('[C] exact trace cardinality: 4 blocks x 4 weeks x 3 schedule days = 48 sessions', () => {
    assert.equal(blocks.length, 4);
    assert.equal(blocks.reduce((sum, block) => sum + block.sessions.length, 0), 48);
    for (const block of blocks) assert.equal(block.sessions.length, 12);
  });
  check('[C] all 48 session dates are unique and strictly ordered across month, year and Sydney-DST-adjacent boundaries', () => {
    assert.deepEqual(dateOrderViolations(blocks), []);
    const dates = blocks.flatMap((block) => block.sessions.map((s) => s.session_date));
    assert.equal(dates.length, 48);
    // The trace actually crosses a year boundary inside a block and touches the
    // Sydney DST-start weekend (DST began 2025-10-05) via date-only arithmetic.
    assert.ok(dates.some((date) => date.startsWith('2025-')));
    assert.ok(dates.some((date) => date.startsWith('2026-')));
    assert.equal(addDaysIso('2025-10-04', 1), '2025-10-05', 'DST-start adjacent date');
    assert.equal(addDaysIso('2025-11-30', 1), '2025-12-01', 'month boundary date');
    assert.equal(addDaysIso('2025-12-31', 1), '2026-01-01', 'year boundary date');
    assert.equal(addDaysIso('2026-04-04', 1), '2026-04-05', 'Sydney DST-end adjacent date');
    assert.equal(addDaysIso('2026-04-05', 1), '2026-04-06', 'day after Sydney DST end');
  });
  check('[C] every session date matches the production start + (week-1)*7 + (day_index-1) formula', () => {
    for (let b = 0; b < blocks.length; b += 1) {
      const start = blocks[b].start_date;
      for (const session of blocks[b].sessions) {
        assert.equal(session.session_date,
          addDaysIso(start, (session.week_index - 1) * 7 + (session.day_index - 1)));
      }
    }
  });
  check('[C] each day uses the access context derived from its own focus', () => {
    for (const block of blocks) {
      for (const session of block.sessions) {
        const context = accessContextForBlockFocus(session.focus);
        assert.equal(typeof context, 'string');
        for (const slot of session.slots) {
          const movement = movementById.get(slot.movement_id);
          assert.ok(movement !== undefined);
          const available = context === 'sport_conditioning'
            ? movement.capability_available_sport_conditioning
            : movement.capability_available_weight_room;
          assert.equal(available, true,
            `${movement.name} selected under the wrong context on a ${session.focus} day`);
          for (const item of movement.required) {
            assert.ok(profileBase.equipment_inventory.includes(item),
              `${movement.name} required ${item} not in inventory`);
          }
        }
      }
    }
  });
  check('[C] sport tier relief never carries an Advanced movement onto a weight-room day (leak law)', () => {
    assert.deepEqual(leakViolations(blocks, movementById), []);
  });
  check('[C] the sport-tier-relief probe appears on sport-context days and never on weight-room days', () => {
    const probe = 8;
    let onSport = 0;
    let onWeight = 0;
    for (const block of blocks) {
      for (const session of block.sessions) {
        const context = accessContextForBlockFocus(session.focus);
        const containsProbe = session.slots.some((slot) => slot.movement_id === probe);
        if (context === 'sport_conditioning') {
          if (containsProbe) onSport += 1;
        } else if (containsProbe) {
          onWeight += 1;
        }
      }
    }
    assert.ok(onSport > 0, 'probe must actually be drafted under sport tier relief (non-vacuous)');
    assert.equal(onWeight, 0, 'probe leaked onto a weight-room day');
  });
  check('[C] capability and equipment exclusions remain independent of tier (Advanced profile opens tier everywhere)', () => {
    const advancedProfile = { ...profileBase, training_age: 'advanced' };
    const advBlocks = composeC(advancedProfile);
    // With the tier ceiling open in BOTH contexts, only capability decides:
    // m12 (closed in both) must never appear; m14 (weight-closed, sport-open)
    // may appear only on sport-context days (bjj).
    for (const block of advBlocks) {
      for (const session of block.sessions) {
        for (const slot of session.slots) {
          assert.notEqual(slot.movement_id, 12,
            'a capability-closed movement must not appear even with the tier ceiling open');
          if (slot.movement_id === 14) {
            assert.equal(accessContextForBlockFocus(session.focus), 'sport_conditioning',
              'm14 (weight-closed capability) drafted on a weight-room day despite tier being open');
          }
        }
      }
    }
    const m14OnBjj = advBlocks.flatMap((block) => block.sessions
      .filter((s) => s.focus === 'bjj'))
      .flatMap((s) => s.slots)
      .some((slot) => slot.movement_id === 14);
    assert.ok(m14OnBjj, 'sport-open capability must actually draft m14 on a bjj day (non-vacuous)');
  });
  check('[C] equipment loss (no kettlebell) removes only the equipment-bound movement, never the tier leak', () => {
    const noKbProfile = {
      ...profileBase,
      equipment_inventory: STANDARD_EQUIPMENT_ITEMS.filter((item) => item !== 'kettlebell'),
    };
    const noKbBlocks = composeC(noKbProfile);
    for (const block of noKbBlocks) {
      for (const session of block.sessions) {
        for (const slot of session.slots) {
          assert.notEqual(slot.movement_id, 9,
            `kettlebell carry survived without a kettlebell on ${session.session_date}`);
        }
      }
    }
    // The weight-room tier bound still holds and the sport probe still appears.
    const fullCarryIds = noKbBlocks.flatMap((block) => block.sessions
      .filter((s) => s.focus === 'full')
      .flatMap((s) => s.slots.filter((slot) => {
        const movement = movementById.get(slot.movement_id);
        return movement !== undefined && movement.pattern === 'carry';
      }).map((slot) => slot.movement_id)));
    assert.ok(fullCarryIds.length > 0 && fullCarryIds.every((id) => id !== 8),
      'equipment loss must not reintroduce the Advanced probe on weight-room days');
  });
  // M5: the composed-trace determinism run freezes the WHOLE closure and
  // composes all four blocks (mirrors family D).
  runTwice('[C] composed four-block trace', () => ({
    profile: profileBase, movements, starts: verifiedStarts, programDays: schedule,
  }), (frozen) => frozen.starts.map((startDate) => generateBlock({
    profile: frozen.profile, movements: frozen.movements, startDate, programDays: frozen.programDays,
  })));
  check('[C] per-day slot domains hold across the composed trace', () => {
    for (const block of blocks) {
      for (const session of block.sessions) {
        for (const slot of session.slots) {
          const violation = planSlotDomainViolation(slot, 9);
          assert.equal(violation, null, violation);
        }
      }
    }
  });
  return { blocks, movements };
}

// ===========================================================================
// FAMILY D — missing / conservative telemetry paths over four peak blocks.
// recentAcwr null / hot / cool; peak-shift effect is per-block and isolated.
// Stale readiness is NOT representable in this pure seam — the store gate in
// apps/mobile/test/verify_store_sql.mjs ('missing readiness vector clears the
// stale prescription') owns that concept; it is cited, not re-invented here.
// ===========================================================================
function familyD(movements) {
  console.log('[D] TELEMETRY-CONSERVATIVE (recentAcwr null / hot / cool over peak blocks)');
  const profile = {
    ...DEFAULT_PROFILE,
    objective: 'strength',
    training_age: 'advanced',
    weekly_frequency: 3,
    session_duration_cap_min: 90,
    base_rpe_cap: 9,
    equipment_inventory: [...STANDARD_EQUIPMENT_ITEMS],
    injury_flags: [...DEFAULT_PROFILE.injury_flags],
    mobility_limits: [...DEFAULT_PROFILE.mobility_limits],
  };
  const startDates = ['2026-01-05', '2026-02-02', '2026-03-02', '2026-03-30'];
  const verifiedStarts = startDates.map((_, i) =>
    (i === 0 ? startDates[0] : addDaysIso(startDates[i - 1], 28)));
  const acwrSequence = [null, 1.7, null, 1.2];
  const blocks = verifiedStarts.map((startDate, i) => generateBlock({
    profile, movements, startDate, macroBlockIndex: 7 + (i % 2), recentAcwr: acwrSequence[i],
  }));
  check('[D] exact trace cardinality: 4 peak blocks x 12 sessions = 48 sessions', () => {
    assert.equal(blocks.length, 4);
    assert.equal(blocks.reduce((sum, block) => sum + block.sessions.length, 0), 48);
  });
  check('[D] all session dates unique and strictly ordered across the composed trace', () => {
    assert.deepEqual(dateOrderViolations(blocks), []);
  });
  check('[D] recentAcwr null never triggers the peak shift, even after a shifted neighbour', () => {
    assert.equal(blocks[0].peakShifted, false);
    assert.equal(blocks[2].peakShifted, false, 'hot neighbour must not leak into a later null block');
    assert.equal(blocks[3].peakShifted, false, 'cool (below OVERREACH_ACWR) ACWR must not shift');
  });
  check('[D] the existing hot peak input keeps the ratified peak-shift shape, scoped to its own block', () => {
    const hot = blocks[1];
    assert.equal(hot.peakShifted, true);
    const phaseOn = (block, week) => new Set(block.sessions
      .filter((s) => s.week_index === week).map((s) => s.phase));
    assert.deepEqual([...phaseOn(hot, 1)], ['deload']);
    assert.deepEqual([...phaseOn(hot, 2)], ['accumulation']);
    assert.deepEqual([...phaseOn(hot, 3)], ['intensification']);
    assert.deepEqual([...phaseOn(hot, 4)], ['realization']);
    // No spill-over into the following cool block's week-4 deload.
    assert.ok(blocks[2].sessions.filter((s) => s.week_index === 4).every((s) => s.phase === 'deload'));
    for (const block of [hot, blocks[2]]) {
      for (const session of block.sessions) {
        for (const slot of session.slots) {
          const violation = planSlotDomainViolation(slot, 9);
          assert.equal(violation, null, violation);
        }
      }
    }
  });
  check('[D] vol/reps/rpe finite across every peak block in the trace', () => {
    let slots = 0;
    for (const block of blocks) {
      for (const session of block.sessions) {
        for (const slot of session.slots) {
          slots += 1;
          assert.equal(Number.isFinite(slot.target_rpe) && Number.isInteger(slot.sets) && Number.isInteger(slot.reps), true);
        }
      }
    }
    assert.ok(slots > 0);
  });
  check('[D] each block is identical to its isolated recomputation (no cross-block state)', () => {
    for (let i = 0; i < blocks.length; i += 1) {
      const isolated = generateBlock({
        profile, movements, startDate: verifiedStarts[i],
        macroBlockIndex: 7 + (i % 2), recentAcwr: acwrSequence[i],
      });
      assert.equal(eq(isolated, blocks[i]), true, `block ${i} differs from isolated recomputation`);
    }
  });
  check('[D] omitted recentAcwr is identical to an explicit null (missing input seam)', () => {
    const omitted = generateBlock({
      profile, movements, startDate: '2026-05-25', macroBlockIndex: 7,
    });
    const explicitNull = generateBlock({
      profile, movements, startDate: '2026-05-25', macroBlockIndex: 7, recentAcwr: null,
    });
    assert.equal(eq(omitted, explicitNull), true);
    assert.equal(omitted.peakShifted, false);
  });
  runTwice('[D] composed telemetry trace',
    () => ({ profile, movements, starts: verifiedStarts, acwr: acwrSequence }),
    (frozen) => frozen.starts.map((startDate, i) => generateBlock({
      profile: frozen.profile, movements: frozen.movements, startDate,
      macroBlockIndex: 7 + (i % 2), recentAcwr: frozen.acwr[i],
    })));
  return { blocks };
}

// ===========================================================================
// Counterexample / mutation checks — every major invariant is demonstrated to
// fail for its intended reason on a LOCAL fixture/result mutation. Each check
// invokes the SAME named predicate the family checks use, first proving it is
// clean on the real output, then proving the mutated output triggers it.
// ===========================================================================
function counterexamples(aData, bData, cData) {
  console.log('[X] counterexample / mutation checks (invariants can fail for their intended reason)');

  check('[X1] dose-bound detector fires on an expanded authored dose', () => {
    const plan = cloneInput(aData.segments.s1[0]);
    assert.deepEqual(doseViolations(plan, 9), [], 'clean plan must be violation-free first');
    plan.prescriptions[0].sets = plan.prescriptions[0].authoredSets + 5;
    const violations = doseViolations(plan, 9);
    assert.ok(violations.some((text) => text.includes('expanded authored')),
      `expected a dose-expansion violation, got ${JSON.stringify(violations)}`);
  });

  check('[X2] RPE-cap detector fires on an out-of-cap target', () => {
    const plan = cloneInput(bData.clampResult);
    assert.deepEqual(doseViolations(plan, 7.5), [], 'clamped plan must be violation-free first');
    plan.prescriptions[0].targetRpe = 8.5;
    const violations = doseViolations(plan, 7.5);
    assert.ok(violations.some((text) => text.includes('outside 5..')),
      `expected a cap violation, got ${JSON.stringify(violations)}`);
  });

  check('[X3] support-before-major detector fires when a major is cut while support survives fully', () => {
    const plan = cloneInput(aData.segments.s3[0]);
    assert.deepEqual(supportFullyOmittedViolations(plan), [], 'binding plan must be clean first');
    const support = plan.prescriptions.find((row) => row.role !== 'major');
    const major = plan.prescriptions.find((row) => row.role === 'major');
    assert.ok(support !== undefined && major !== undefined);
    // Reintroduce the previously omitted support at a full dose behind a cut major.
    support.included = true;
    support.sets = support.authoredSets;
    support.reps = support.authoredReps;
    support.targetRpe = support.authoredTargetRpe;
    major.sets = 1;
    major.reps = 1;
    major.targetRpe = 5;
    const violations = supportFullyOmittedViolations(plan);
    assert.ok(violations.some((text) => text.includes('support still included')),
      `mutant support surviving ahead of a reduced major must be flagged, got ${JSON.stringify(violations)}`);
  });

  check('[X4] sport-tier-leak detector fires on a probe in a weight-room session', () => {
    const byId = new Map(cData.movements.map((m) => [m.movement_id, m]));
    const real = cData.blocks;
    assert.deepEqual(leakViolations(real, byId), [], 'real composed trace must be leak-free first');
    const mutated = cloneInput({ blocks: real });
    const fullDay = mutated.blocks[0].sessions.find((s) => s.focus === 'full');
    assert.ok(fullDay !== undefined, 'full session must exist in block 0');
    assert.ok(fullDay.slots.length > 0, 'full session must have at least one slot');
    fullDay.slots[fullDay.slots.length - 1].movement_id = 8; // Advanced carry probe
    const violations = leakViolations(mutated.blocks, byId);
    assert.ok(violations.some((text) => text.startsWith('Advanced 8 on weight-room')),
      `leak detector must observe the probe on a weight-room day, got ${JSON.stringify(violations)}`);
  });

  check('[X5] date detector fires on an out-of-order session date', () => {
    assert.deepEqual(dateOrderViolations(cData.blocks), [], 'real composed trace must be ordered first');
    const mutated = cloneInput({ blocks: cData.blocks });
    const dates = mutated.blocks.flatMap((block) => block.sessions);
    dates[5].session_date = addDaysIso(dates[5].session_date, -28); // duplicate an earlier date
    const violations = dateOrderViolations(mutated.blocks);
    assert.ok(violations.length > 0,
      `date detector must see the injected disorder, got ${JSON.stringify(violations)}`);
  });

  check('[X6] fail-closed detector fires when a prescription appears beside a blocker', () => {
    const real = bData.lostResult;
    assert.equal(failClosedViolation(real), null, 'real availability-loss result must be clean first');
    assert.equal(real.prescriptions.length, 0, 'real result must carry zero prescriptions to mutate from');
    const mutated = cloneInput(real);
    mutated.prescriptions.push({ dayIndex: 1, movementId: 999, role: 'major' });
    const violation = failClosedViolation(mutated);
    assert.ok(violation !== null && violation.includes('prescriptions present beside'),
      `fail-closed detector must flag the injected partial output, got ${String(violation)}`);
  });

  // X7 / X7b: fixture completeness fails clearly when a required field is omitted.
  check('[X7] generator fixture completeness fails clearly on an omitted capability field', () => {
    const movements = cloneInput(cData.movements);
    delete movements[7].capability_available_sport_conditioning;
    let threw = null;
    try {
      assertGeneratorFixtureComplete(movements);
    } catch (error) {
      threw = error.message;
    }
    assert.ok(threw !== null && threw.includes('capability_available_sport_conditioning'),
      `expected a named completeness failure, got ${String(threw)}`);
  });
  check('[X7b] routine fixture completeness fails clearly on an omitted role-eligibility field', () => {
    const input = {
      selections: [{ dayIndex: 1, slotIndex: 1, movementId: aData.benchId, role: 'major', sets: 2, reps: 3, targetRpe: 6 }],
      movements: cData.movements,
      liftFamilies: [],
      assistance: [],
      roleEligibility: { major: new Set([aData.benchId]), supplementary: new Set(), accessory: new Set(), conditional: new Set() },
      schemaType: 'LINEAR', objective: 'strength', trainingAge: 'elite',
      durationCapMin: 120, baseRpeCap: 9,
      availableMovementIds: new Set([aData.benchId]),
    };
    const broken = cloneInput(input);
    delete broken.roleEligibility;
    let threw = null;
    try {
      assertRoutineInputComplete(broken);
    } catch (error) {
      threw = error.message;
    }
    assert.ok(threw !== null && threw.includes('roleEligibility'),
      `expected a named completeness failure, got ${String(threw)}`);
    // The complete sibling still passes the gate.
    assertRoutineInputComplete(cloneInput(input));
  });
}

// ===========================================================================
// Deterministic in-memory summary + informational memory diagnostic.
// No timestamps, paths, machine names or timings in the summary.
// ===========================================================================
function summary(aData, cData, dData) {
  const summarizeSegments = (segments) => Object.fromEntries(Object.entries(segments).map(([name, weeks]) => {
    const first = weeks[0];
    return [name, {
      weeklyEvaluations: weeks.length,
      calendarAdvancing: false,
      prescriptions: first.prescriptions.length,
      included: first.prescriptions.filter((row) => row.included).length,
      blockers: first.blockers.length,
      warnings: first.warnings.length,
      purposes: new Set(first.prescriptions.map((row) => row.purpose)).size,
      finalStress: first.familyDecisions.map((decision) => decision.finalStress),
    }];
  }));
  const trace = {
    totalWeeklyEvaluations: 68,
    calendarAdvancingWeeks: 32,
    timeInvariantWeeklyEvaluations: 36,
    scenarios: {
      'A-ELITE-BENCH-16': { segments: 4, weeksPerSegment: 4, weeklyEvaluations: 16, calendarAdvancing: false, ...summarizeSegments(aData.segments) },
      'B-METAMORPHIC': { variants: 5, weeksPerVariant: 4, weeklyEvaluations: 20, calendarAdvancing: false },
      'C-MIXED-CONTEXT-16': {
        blocks: cData.blocks.length, weeksPerBlock: 4, weeklyEvaluations: cData.blocks.length * 4,
        calendarAdvancing: true, dateAdvancingWeeks: cData.blocks.length * 4,
        sessions: cData.blocks.reduce((sum, block) => sum + block.sessions.length, 0),
      },
      'D-TELEMETRY-CONSERVATIVE': {
        blocks: dData.blocks.length, weeksPerBlock: 4, weeklyEvaluations: dData.blocks.length * 4,
        calendarAdvancing: true, dateAdvancingWeeks: dData.blocks.length * 4,
        sessions: dData.blocks.reduce((sum, block) => sum + block.sessions.length, 0),
        peakShifted: dData.blocks.map((block) => block.peakShifted),
      },
    },
  };
  console.log(`\nlongitudinal-bounds summary: ${JSON.stringify(trace)}`);
  const mem = process.memoryUsage();
  console.log(`informational host diagnostics: rss=${mem.rss} heapUsed=${mem.heapUsed} heapTotal=${mem.heapTotal} external=${mem.external} (diagnostic only; not Android private-dirty evidence)`);
}

// ===========================================================================
// Run
// ===========================================================================
const contracts = loadRealContracts();
const aData = familyA(contracts);
const bData = familyB(contracts);
const cData = familyC();
const dData = familyD(cData.movements);
counterexamples(aData, bData, cData);
summary(aData, cData, dData);

console.log(`\nlongitudinal bounds verification: ${pass} checks passed, ${fail} failed`);
if (fail > 0) process.exit(1);
process.exit(0);
