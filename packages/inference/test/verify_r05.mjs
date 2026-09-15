import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { DEFAULT_PROFILE, TRAINING_AGES, OBJECTIVES, SCHEMA_TYPES, MOVEMENT_PATTERNS } = require('./.build/types.js');
const { ROUTINE_FAMILY_STRESS_BUDGETS } = require('./.build/routineMicrocycle.js');

// R05: compare identical executable activity and limits, varying only tier.
// Beginner safeguards are the explicit D02 exception, checked independently.
// Compare full outputs, not just totals: an added set must not hide a lost slot.
export function verifyR05Blocks(reports = [undefined]) {
  const { generateBlock } = require('./.build/blockGenerator.js');
  assert.equal(OBJECTIVES.length, 8, 'R05 coverage: every objective');
  assert.equal(SCHEMA_TYPES.length, 4, 'R05 coverage: every schema');
  const movements = MOVEMENT_PATTERNS.map((pattern, index) => ({
    movement_id: index + 1, name: `R05 ${pattern}`, pattern, is_compound: true,
    required: [], difficulty: 'Beginner', beginner_ok: false, sportTracking: false,
    capability_available_weight_room: true, capability_available_sport_conditioning: true,
  }));
  let cases = 0;
  for (const objective of OBJECTIVES) for (const schemaType of SCHEMA_TYPES)
    for (const macroBlockIndex of [1, 3, 5, 7]) for (const minutes of [15, 90])
      for (const plannedImplement of ['Barbell', 'Bodyweight']) for (const flawReport of reports)
        for (const schedule of ['automatic', 'explicit']) {
        const input = {
          profile: { ...DEFAULT_PROFILE, objective, training_age: 'intermediate',
            weekly_frequency: 3, session_duration_cap_min: minutes, base_rpe_cap: 8 },
          movements: movements.map((m) => ({ ...m, plannedImplement })),
          startDate: '2026-09-14', schemaType, macroBlockIndex, flawReport,
          ...(schedule === 'explicit' ? { programDays: [
            { day_index: 1, focus: 'lower' }, { day_index: 3, focus: 'upper' },
            { day_index: 6, focus: 'conditioning' },
          ] } : {}),
        };
        const baseline = generateBlock(input);
        assert.equal(baseline.sessions.length, 12, 'R05 non-vacuity: all scheduled sessions execute');
        assert.ok(baseline.sessions.every((s) => s.slots.length > 0), 'R05 non-vacuity: every session has work');
        for (const training_age of TRAINING_AGES.filter((age) => age !== 'beginner')) {
          const actual = generateBlock({ ...input, profile: { ...input.profile, training_age } });
          assert.deepEqual(actual, baseline,
            `R05 block tier-only dose: ${objective}/${schemaType}/${macroBlockIndex}/${minutes}/${plannedImplement}/${training_age}`);
          cases += 1;
        }
        const beginner = generateBlock({ ...input, profile: { ...input.profile, training_age: 'beginner' } });
        assert.equal(beginner.sessions.length, baseline.sessions.length);
        beginner.sessions.forEach((session, i) => session.slots.forEach((slot, j) => {
          assert.ok(slot.sets <= baseline.sessions[i].slots[j].sets,
            'R05 beginner set protection must not add work');
        }));
      }
  assert.equal(cases, OBJECTIVES.length * SCHEMA_TYPES.length * 4 * 2 * 2 * reports.length * 2 * 3,
    'R05 non-vacuity: the full block matrix executed');
  // A known unsaturated prescription pins the permitted beginner reduction.
  const dose = (training_age) => generateBlock({ profile: { ...DEFAULT_PROFILE,
    objective: 'strength', training_age }, movements, startDate: '2026-09-14' })
    .sessions[0].slots[0].sets;
  assert.equal(dose('beginner'), dose('intermediate') - 1, 'R05 preserve beginner reduction');
  console.log(`  PASS  R05 block counterfactual: ${cases} tier comparisons, plus beginner safety`);
}

// Tier law (AGENT_WORKFLOW.md section 6), restated independently of
// tierPolicy.ts. D02 leaves eligibility unchanged: a beginner receives only
// Beginner rows or whitelisted Intermediate staples in a weight-room context;
// an intermediate never receives Advanced rows; sport contexts and untagged
// legacy rows carry no difficulty ceiling.
const ratifiedTierLaw = (trainingAge, difficulty, beginnerOk, accessContext, sportTracking) => {
  const context = accessContext === 'library'
    ? (sportTracking ? 'sport_conditioning' : 'weight_room')
    : accessContext;
  if (sportTracking || context === 'sport_conditioning' || difficulty === undefined) return true;
  if (trainingAge === 'beginner') return difficulty === 'Beginner' || (difficulty === 'Intermediate' && beginnerOk);
  if (trainingAge === 'intermediate') return difficulty !== 'Advanced';
  return true;
};

export function verifyR05Eligibility() {
  const { isDifficultyAllowed } = require('./.build/tierPolicy.js');
  const { generateBlock, accessContextForBlockFocus } = require('./.build/blockGenerator.js');
  let rows = 0;
  const allowedByTier = new Map(TRAINING_AGES.map((age) => [age, 0]));
  for (const trainingAge of TRAINING_AGES)
    for (const difficulty of ['Beginner', 'Intermediate', 'Advanced', undefined])
      for (const beginnerOk of [false, true])
        for (const accessContext of ['library', 'weight_room', 'sport_conditioning'])
          for (const sportTracking of [false, true]) {
            const expected = ratifiedTierLaw(trainingAge, difficulty, beginnerOk, accessContext, sportTracking);
            assert.equal(isDifficultyAllowed(trainingAge, difficulty, beginnerOk, accessContext, sportTracking), expected,
              `R05 eligibility: ${trainingAge}/${difficulty}/beginnerOk=${beginnerOk}/${accessContext}/sport=${sportTracking}`);
            if (expected) allowedByTier.set(trainingAge, allowedByTier.get(trainingAge) + 1);
            rows += 1;
          }
  assert.equal(rows, 192, 'R05 eligibility non-vacuity: full tier-law table');
  assert.ok(allowedByTier.get('beginner') < allowedByTier.get('intermediate')
    && allowedByTier.get('intermediate') < allowedByTier.get('advanced')
    && allowedByTier.get('advanced') === allowedByTier.get('elite'),
  'R05 eligibility: tier ceilings stay strictly progressive through advanced');

  // Block-level: each weight-room slot a tier receives must be eligible for it.
  const byId = new Map();
  // Each fixture owns a disjoint id range, so one id never names two movements.
  const fixture = (idBase, difficulties) => MOVEMENT_PATTERNS.flatMap((pattern, index) =>
    difficulties.map(([difficulty, beginnerOk], offset) => {
      const movement = { movement_id: idBase + (index + 1) * 10 + offset, name: `R05E ${pattern} ${difficulty}${beginnerOk ? ' WL' : ''}`,
        pattern, is_compound: true, required: [], difficulty, beginner_ok: beginnerOk, sportTracking: false,
        capability_available_weight_room: true, capability_available_sport_conditioning: true, plannedImplement: 'Barbell' };
      byId.set(movement.movement_id, movement);
      return movement;
    }));
  const generate = (movements, training_age) => generateBlock({
    profile: { ...DEFAULT_PROFILE, objective: 'strength', training_age, weekly_frequency: 3,
      session_duration_cap_min: 90, base_rpe_cap: 8 },
    movements, startDate: '2026-09-14',
    programDays: [{ day_index: 1, focus: 'lower' }, { day_index: 3, focus: 'upper' }, { day_index: 6, focus: 'full' }],
  });
  const weightRoomSlots = (plan) => plan.sessions
    .filter((session) => accessContextForBlockFocus(session.focus) === 'weight_room')
    .flatMap((session) => session.slots);
  const assertEligible = (plan, training_age, label) => {
    const slots = weightRoomSlots(plan);
    for (const slot of slots) {
      const movement = byId.get(slot.movement_id);
      assert.ok(movement && ratifiedTierLaw(training_age, movement.difficulty, movement.beginner_ok, 'weight_room', false),
        `R05 eligibility: ${label} ${training_age} received ineligible movement ${slot.movement_id}`);
    }
    return slots;
  };
  const mixed = fixture(1000, [['Beginner', false], ['Intermediate', true], ['Intermediate', false], ['Advanced', false]]);
  const noBeginnerRows = fixture(2000, [['Intermediate', true], ['Intermediate', false], ['Advanced', false]]);
  const advancedOnly = fixture(3000, [['Advanced', false]]);
  assert.equal(byId.size, mixed.length + noBeginnerRows.length + advancedOnly.length, 'R05 eligibility: fixture ids are unique');

  assert.ok(assertEligible(generate(mixed, 'beginner'), 'beginner', 'mixed').length > 0,
    'R05 eligibility non-vacuity: beginner receives weight-room work');
  const staples = assertEligible(generate(noBeginnerRows, 'beginner'), 'beginner', 'whitelist');
  assert.ok(staples.length > 0 && staples.every((slot) => byId.get(slot.movement_id).beginner_ok),
    'R05 eligibility: beginner receives only whitelisted Intermediate staples when no Beginner row exists');
  assert.ok(assertEligible(generate(mixed, 'intermediate'), 'intermediate', 'mixed').length > 0,
    'R05 eligibility non-vacuity: intermediate receives weight-room work');
  assert.equal(weightRoomSlots(generate(advancedOnly, 'beginner')).length, 0,
    'R05 eligibility: beginner Advanced rows are dropped, never filled upward');
  assert.equal(weightRoomSlots(generate(advancedOnly, 'intermediate')).length, 0,
    'R05 eligibility: intermediate Advanced rows are dropped, never filled upward');
  const advanced = generate(advancedOnly, 'advanced');
  assert.ok(weightRoomSlots(advanced).length > 0, 'R05 eligibility non-vacuity: Advanced rows execute for advanced');
  assert.deepEqual(generate(advancedOnly, 'elite'), advanced,
    'R05 eligibility: elite receives exactly the advanced prescription for identical eligible movements');
  assert.deepEqual(generate(mixed, 'elite'), generate(mixed, 'advanced'),
    'R05 eligibility: elite receives exactly the advanced prescription on the mixed fixture');
  console.log(`  PASS  R05 eligibility: ${rows} tier-law rows, beginner whitelist and drop, advanced/elite identity`);
}

export function verifyR05Routines(compose, liftFamilies) {
  const families = [...new Set(liftFamilies.map((row) => row.family))].sort();
  assert.equal(families.length, 7, 'R05 covers every curated major family');
  let cases = 0;
  for (const family of families) for (const schemaType of SCHEMA_TYPES)
    for (const objective of OBJECTIVES) for (const durationCapMin of [15, 120])
      for (const authored of [false, true]) for (const freeze of [false, true]) {
        const movementId = liftFamilies.find((row) => row.family === family).movementId;
        const selections = [1, 3, 5].map((dayIndex) => ({ dayIndex, slotIndex: 1,
          movementId, role: 'major', ...(authored ? { sets: 10, reps: 12, targetRpe: 9 } : {}) }));
        const input = { schemaType, objective, durationCapMin, trainingAge: 'intermediate',
          baseRpeCap: freeze ? 7 : 9, ...(freeze ? { rpeCapBehavior: 'clamp',
            executionGateDayIndices: new Set([1]) } : {}) };
        const baseline = compose(selections, input);
        assert.deepEqual(baseline.blockers, [], `R05 non-vacuity: ${family} must execute`);
        assert.equal(baseline.prescriptions.length, 3, `R05 non-vacuity: every routine prescription executes (${family})`);
        assert.ok(baseline.prescriptions.every((row) => row.included && row.sets >= 1),
          `R05 non-vacuity: every routine prescription is included with work (${family})`);
        for (const trainingAge of ['advanced', 'elite']) {
          assert.deepEqual(compose(selections, { ...input, trainingAge }), baseline,
            `R05 routine tier-only dose: ${family}/${schemaType}/${objective}/${durationCapMin}/authored=${authored}/freeze=${freeze}/${trainingAge}`);
          cases += 1;
        }
        const beginner = compose(selections, { ...input, trainingAge: 'beginner' });
        assert.deepEqual(beginner.prescriptions, [], 'R05 beginner standalone eligibility stays closed');
        assert.ok(beginner.blockers.some((row) => row.includes('Beginner stage')),
          'R05 beginner standalone eligibility stays closed: blocker present');
      }
  assert.equal(cases, families.length * SCHEMA_TYPES.length * OBJECTIVES.length * 2 * 2 * 2 * 2,
    'R05 non-vacuity: the full routine matrix executed');
  for (const trainingAge of ['advanced', 'elite']) {
    assert.deepEqual(ROUTINE_FAMILY_STRESS_BUDGETS[trainingAge], ROUTINE_FAMILY_STRESS_BUDGETS.intermediate,
      'R05 no experience-only fatigue allowance, even when prescriptions do not saturate it');
  }
  assert.deepEqual(ROUTINE_FAMILY_STRESS_BUDGETS.beginner, { session: 0, week: 0 });
  console.log(`  PASS  R05 routine counterfactual: ${cases} tier comparisons across seven families, builder/save and freeze`);
}

export function verifyR05Legacy(compose) {
  let cases = 0;
  const roles = ['major', 'supplementary', 'accessory', 'conditional'];
  for (const schemaType of SCHEMA_TYPES) for (const objective of OBJECTIVES)
    for (const durationCapMin of [15, 120]) for (const baseRpeCap of [6, 9]) {
      const input = { selections: roles.map((role, index) => ({ movementId: index + 1, role })),
        schemaType, objective, durationCapMin, baseRpeCap, trainingAge: 'intermediate',
        availableMovementIds: new Set([1, 2, 3, 4]) };
      const baseline = compose(input);
      assert.ok(baseline.slots.length > 0, 'R05 legacy non-vacuity: executable work');
      if (durationCapMin === 120) assert.deepEqual(baseline.slots.map((row) => row.role), roles,
        'R05 legacy non-vacuity: all four default-dose roles exercised');
      for (const trainingAge of ['advanced', 'elite']) {
        assert.deepEqual(compose({ ...input, trainingAge }), baseline,
          `R05 legacy tier-only dose: ${schemaType}/${objective}/${durationCapMin}/${baseRpeCap}/${trainingAge}`);
        cases += 1;
      }
      const beginner = compose({ ...input, trainingAge: 'beginner' });
      assert.equal(beginner.slots.length, baseline.slots.length);
      beginner.slots.forEach((slot, index) => {
        assert.equal(slot.sets, baseline.slots[index].sets - 1, 'R05 legacy beginner reduction preserved');
        assert.equal(slot.reps, baseline.slots[index].reps);
        assert.equal(slot.targetRpe, baseline.slots[index].targetRpe);
      });
      const unavailable = compose({ ...input, availableMovementIds: new Set() });
      assert.deepEqual(unavailable.slots, [], 'R05 legacy availability stays closed');
    }
  assert.equal(cases, SCHEMA_TYPES.length * OBJECTIVES.length * 2 * 2 * 2,
    'R05 legacy non-vacuity: the full legacy matrix executed');
  console.log(`  PASS  R05 legacy counterfactual: ${cases} comparisons across all four roles, plus beginner safety and availability`);
}
