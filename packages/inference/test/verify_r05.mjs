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
  // A known unsaturated prescription pins the permitted beginner reduction.
  const dose = (training_age) => generateBlock({ profile: { ...DEFAULT_PROFILE,
    objective: 'strength', training_age }, movements, startDate: '2026-09-14' })
    .sessions[0].slots[0].sets;
  assert.equal(dose('beginner'), dose('intermediate') - 1, 'R05 preserve beginner reduction');
  console.log(`  PASS  R05 block counterfactual: ${cases} tier comparisons, plus beginner safety`);
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
        assert.equal(baseline.prescriptions.length, 3);
        assert.ok(baseline.prescriptions.every((row) => row.included && row.sets >= 1));
        for (const trainingAge of ['advanced', 'elite']) {
          assert.deepEqual(compose(selections, { ...input, trainingAge }), baseline,
            `R05 routine tier-only dose: ${family}/${schemaType}/${objective}/${durationCapMin}/authored=${authored}/freeze=${freeze}/${trainingAge}`);
          cases += 1;
        }
        const beginner = compose(selections, { ...input, trainingAge: 'beginner' });
        assert.deepEqual(beginner.prescriptions, [], 'R05 beginner standalone eligibility stays closed');
        assert.ok(beginner.blockers.some((row) => row.includes('Beginner stage')));
      }
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
  console.log(`  PASS  R05 legacy counterfactual: ${cases} comparisons across all four roles, plus beginner safety and availability`);
}
