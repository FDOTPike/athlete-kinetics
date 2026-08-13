'use strict';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { resolveMovementAvailability } = require('./.build/capabilityResolver.js');
const { isDifficultyAllowed } = require('./.build/tierPolicy.js');
const { parseHistoryImport, HISTORY_IMPORT_EXAMPLE } = require('./.build/historyImport.js');
const {
  composeRoutine,
  groupRoutineTemplateDays,
  isRoutineRoleSnapshotExecutable,
  projectRoutineMajorRpe,
  rankRoutineSupplementaryRecommendations,
  routineMajorRpeForWeek,
} = require('./.build/routineComposer.js');
const {
  composeRoutineMicrocycle,
  contextualRoutineRoles,
  rankRoutineAccessoryRecommendations,
} = require('./.build/routineMicrocycle.js');
const { projectChainsFromGraph } = require('./.build/chainProjection.js');
let pass = 0;
const check = (name, fn) => { try { fn(); console.log(`  PASS ${name}`); pass += 1; } catch (error) { console.error(`  FAIL ${name}: ${error.message}`); process.exitCode = 1; } };
const movements = [
  { movementId: 1, difficulty: 'Beginner', beginnerOk: false, sportTracking: false, requiredEquipment: [] },
  { movementId: 2, difficulty: 'Intermediate', beginnerOk: true, sportTracking: false, requiredEquipment: [] },
  { movementId: 3, difficulty: 'Advanced', beginnerOk: false, sportTracking: false, requiredEquipment: ['Barbell'] },
  { movementId: 4, difficulty: 'Beginner', beginnerOk: false, sportTracking: false, requiredEquipment: [] },
  { movementId: 5, difficulty: 'Advanced', beginnerOk: false, sportTracking: true, requiredEquipment: [] },
];
const edge = { prerequisiteMovementId: 1, movementId: 2, relationship: 'prerequisite', minSessions: 2, minSetsPerSession: 3, minValue: 5, valueKind: 'reps', maxRpe: 8, requiresAttestation: true };
const evidence = [
  { movementId: 1, sessionId: 10, qualifyingSets: 3, minimumValue: 5, maximumRpe: 8, verified: true },
  { movementId: 1, sessionId: 11, qualifyingSets: 3, minimumValue: 5, maximumRpe: 7.5, verified: true },
];
const resolve = (over = {}) => resolveMovementAvailability({
  movements, edges: [edge], evidence, attestedEdgeKeys: new Set(['1:2']),
  priorExperienceMovementIds: new Set(), trainingAge: 'beginner', accessContext: 'weight_room',
  equipment: new Set(), safetyExcludedMovementIds: new Set(), ...over,
});
check('resolver fixtures carry explicit access context and sport status', () => {
  assert.ok(movements.every((movement) => typeof movement.sportTracking === 'boolean'));
  assert.ok(['weight_room', 'sport_conditioning'].includes('weight_room'));
});
check('frozen routine role validation fails closed after role drift or an unverifiable snapshot', () => {
  const eligible = {
    major: new Set([1]), supplementary: new Set([2]), accessory: new Set(), conditional: new Set([3]),
  };
  const source = [
    { movementId: 1, role: 'major' },
    { movementId: 2, role: 'supplementary' },
  ];
  assert.equal(isRoutineRoleSnapshotExecutable([1, 2], source, eligible), true);
  assert.equal(isRoutineRoleSnapshotExecutable(
    [1, 2], [...source, { movementId: 1, role: 'major' }], eligible,
  ), true, 'duplicate identical historical roles are redundant');
  assert.equal(isRoutineRoleSnapshotExecutable([1, 2], source, { ...eligible, major: new Set() }), false);
  assert.equal(isRoutineRoleSnapshotExecutable([1, 999], source, eligible), false);
  assert.equal(isRoutineRoleSnapshotExecutable([1], [...source, { movementId: 1, role: 'supplementary' }], eligible), false);
  assert.equal(isRoutineRoleSnapshotExecutable([2], source, eligible), false);
  assert.equal(isRoutineRoleSnapshotExecutable(
    [1, 2], [source[0], source[1], { ...source[1], legacyRoleAllowed: true }],
    { ...eligible, supplementary: new Set() },
  ), true, 'an exact legacy allowance survives a duplicate identical source row');
});
// --- bounded microcycle structural law ---------------------------------------
const placement = (dayIndex, slotIndex, movementId, role) => ({ dayIndex, slotIndex, movementId, role });
const twoDayTemplate = [
  placement(1, 1, 1, 'major'),
  placement(1, 2, 2, 'supplementary'),
  placement(2, 1, 3, 'major'),
  placement(2, 2, 4, 'supplementary'),
];
check('a multi-day template is grouped in day order', () => {
  const days = groupRoutineTemplateDays(twoDayTemplate);
  assert.deepEqual([...days.keys()], [1, 2]);
  assert.deepEqual([...days.get(1)].map((slot) => slot.movementId), [1, 2]);
  assert.deepEqual([...days.get(2)].map((slot) => slot.movementId), [3, 4]);
  assert.deepEqual([...days.get(2)].map((slot) => slot.role), ['major', 'supplementary']);
});
check('a populated day with no major is refused, naming the offending day', () => {
  assert.throws(
    () => groupRoutineTemplateDays([
      placement(1, 1, 1, 'major'),
      placement(2, 1, 3, 'supplementary'),
    ]),
    /Routine day 2 must contain at least one major movement\./,
  );
  assert.throws(
    () => groupRoutineTemplateDays([
      placement(1, 1, 1, 'supplementary'),
      placement(2, 1, 3, 'major'),
    ]),
    /Routine day 1 must contain at least one major movement\./,
  );
});
check('same-day major and support selection is uncapped', () => {
  assert.doesNotThrow(() => groupRoutineTemplateDays([
    placement(1, 1, 1, 'major'), placement(1, 2, 2, 'major'),
    placement(1, 3, 3, 'major'), placement(1, 4, 4, 'supplementary'),
    placement(1, 5, 5, 'supplementary'), placement(1, 6, 6, 'supplementary'),
    placement(1, 7, 7, 'accessory'), placement(1, 8, 8, 'conditional'),
  ]));
});
check('movement identity is unique per day but may repeat across weekly exposures', () => {
  assert.throws(() => groupRoutineTemplateDays([]), /at least one movement/);
  assert.doesNotThrow(() => groupRoutineTemplateDays([
    placement(1, 1, 1, 'major'), placement(2, 1, 1, 'major'),
    placement(3, 1, 1, 'major'), placement(4, 1, 1, 'major'), placement(5, 1, 1, 'major'),
  ]));
  assert.throws(() => groupRoutineTemplateDays([
    placement(1, 1, 1, 'major'), placement(1, 2, 1, 'major'),
  ]), /appears more than once on routine day 1/);
  assert.throws(
    () => groupRoutineTemplateDays([placement(1, 1, 1, 'major'), placement(1, 1, 2, 'supplementary')]),
    /Routine slot positions must be unique\./,
  );
  assert.throws(
    () => groupRoutineTemplateDays([placement(8, 1, 1, 'major')]),
    /days must be 1-7 and slot positions must be positive integers/,
  );
});
check('legacy single-session composition no longer rejects a selection count', () => {
  const days = groupRoutineTemplateDays(twoDayTemplate);
  const composedDays = [...days.values()].map((daySlots) => composeRoutine({
    selections: daySlots.map((slot) => ({ movementId: slot.movementId, role: slot.role })),
    schemaType: 'LINEAR', objective: 'strength', trainingAge: 'intermediate',
    durationCapMin: 66, baseRpeCap: 9, availableMovementIds: new Set([1, 2, 3, 4]),
  }));
  assert.deepEqual(composedDays.map((day) => day.slots.length), [2, 2]);
  assert.deepEqual(composedDays.flatMap((day) => day.warnings), []);
  // Slot indices restart per day, so a frozen day-2 session is slot 1..n.
  assert.deepEqual(composedDays[1].slots.map((slot) => slot.slotIndex), [1, 2]);
  const merged = composeRoutine({
    selections: twoDayTemplate.map((slot) => ({ movementId: slot.movementId, role: slot.role })),
    schemaType: 'LINEAR', objective: 'strength', trainingAge: 'intermediate',
    durationCapMin: 66, baseRpeCap: 9, availableMovementIds: new Set([1, 2, 3, 4]),
  });
  assert.equal(merged.slots.length, 4);
  assert.ok(!merged.warnings.some((warning) => warning.includes('Too many')));
});
check('starting day 2 revalidates only that day and still fails closed on role drift', () => {
  const sourceRows = twoDayTemplate.map((slot) => ({ movementId: slot.movementId, role: slot.role }));
  const eligible = {
    major: new Set([1, 3]), supplementary: new Set([2, 4]), accessory: new Set(), conditional: new Set(),
  };
  const dayOne = [1, 2];
  const dayTwo = [3, 4];
  assert.equal(isRoutineRoleSnapshotExecutable(dayTwo, sourceRows, eligible), true);
  assert.equal(isRoutineRoleSnapshotExecutable(
    dayTwo, [...sourceRows, { movementId: 3, role: 'major' }], eligible,
  ), true);
  assert.equal(isRoutineRoleSnapshotExecutable(dayOne, sourceRows, eligible), true);
  // Day 1 losing its major does not stop day 2 from starting, and vice versa.
  assert.equal(isRoutineRoleSnapshotExecutable(dayTwo, sourceRows, {
    ...eligible, major: new Set([3]),
  }), true);
  assert.equal(isRoutineRoleSnapshotExecutable(dayOne, sourceRows, {
    ...eligible, major: new Set([3]),
  }), false);
  // Role-policy drift on the day being started still fails closed.
  assert.equal(isRoutineRoleSnapshotExecutable(dayTwo, sourceRows, {
    ...eligible, major: new Set([1]),
  }), false);
  assert.equal(isRoutineRoleSnapshotExecutable(dayTwo, sourceRows, {
    ...eligible, supplementary: new Set([2]),
  }), false);
  // An ambiguous or missing source row remains unverifiable.
  assert.equal(isRoutineRoleSnapshotExecutable(
    dayTwo, [...sourceRows, { movementId: 3, role: 'supplementary' }], eligible,
  ), false);
  assert.equal(isRoutineRoleSnapshotExecutable([3, 999], sourceRows, eligible), false);
});

check('resolver is deterministic and ordered', () => assert.deepEqual(resolve(), resolve()));
check('tier, equipment, and safety remain outer gates', () => {
  const result = resolve({ safetyExcludedMovementIds: new Set([4]) });
  assert.deepEqual(result.find((row) => row.movementId === 3).reasons, ['tier', 'equipment']);
  assert.deepEqual(result.find((row) => row.movementId === 4).reasons, ['safety']);
});
check('progressive tier predicate gives Intermediate no Advanced access', () => {
  assert.equal(isDifficultyAllowed('beginner', 'Intermediate', true, 'weight_room', false), true);
  assert.equal(isDifficultyAllowed('beginner', 'Advanced', true, 'weight_room', false), false);
  assert.equal(isDifficultyAllowed('intermediate', 'Intermediate', false, 'weight_room', false), true);
  assert.equal(isDifficultyAllowed('intermediate', 'Advanced', false, 'weight_room', false), false);
  assert.equal(isDifficultyAllowed('advanced', 'Advanced', false, 'weight_room', false), true);
  assert.equal(isDifficultyAllowed('elite', 'Advanced', false, 'weight_room', false), true);
  assert.equal(isDifficultyAllowed('beginner', 'Advanced', false, 'sport_conditioning', false), true);
});
check('availability resolver applies the Intermediate ceiling and unlocks Advanced at Advanced', () => {
  const intermediate = resolve({ trainingAge: 'intermediate', equipment: new Set(['Barbell']) });
  assert.equal(intermediate.find((row) => row.movementId === 3).state, 'teaching_only');
  assert.deepEqual(intermediate.find((row) => row.movementId === 3).reasons, ['tier']);
  const advanced = resolve({ trainingAge: 'advanced', equipment: new Set(['Barbell']) });
  assert.equal(advanced.find((row) => row.movementId === 3).state, 'available');
});
check('verified distinct sessions and attestation clear a prerequisite', () => assert.equal(resolve().find((row) => row.movementId === 2).state, 'available'));
check('unverified evidence cannot advance capability', () => assert.equal(resolve({ evidence: evidence.map((row) => ({ ...row, verified: false })) }).find((row) => row.movementId === 2).state, 'teaching_only'));
check('RPE ceiling and attestation are enforced', () => {
  assert.equal(resolve({ attestedEdgeKeys: new Set() }).find((row) => row.movementId === 2).state, 'teaching_only');
  assert.equal(resolve({ evidence: evidence.map((row) => ({ ...row, maximumRpe: 9 })) }).find((row) => row.movementId === 2).state, 'teaching_only');
  assert.equal(resolve({ attestedEdgeKeys: new Set(['1:2']) }).find((row) => row.movementId === 2).state, 'available');
});
check('Intermediate prior experience clears ordinary evidence only in weight-room context', () => {
  const ordinaryEdge = { ...edge, requiresAttestation: false };
  const blocked = resolve({ trainingAge: 'intermediate', edges: [ordinaryEdge], evidence: [], attestedEdgeKeys: new Set() })
    .find((row) => row.movementId === 2);
  assert.equal(blocked.capabilitySource, 'blocked');
  assert.equal(blocked.confirmationWouldClear, true);
  const confirmed = resolve({
    trainingAge: 'intermediate', edges: [ordinaryEdge], evidence: [], attestedEdgeKeys: new Set(),
    priorExperienceMovementIds: new Set([2]),
  }).find((row) => row.movementId === 2);
  assert.equal(confirmed.state, 'available');
  assert.equal(confirmed.capabilitySource, 'prior_experience');
});
check('Beginner cannot confirm and Advanced bypass applies only to ordinary weight-room evidence', () => {
  const ordinaryEdge = { ...edge, requiresAttestation: false };
  const beginner = resolve({ edges: [ordinaryEdge], evidence: [], priorExperienceMovementIds: new Set([2]) })
    .find((row) => row.movementId === 2);
  assert.equal(beginner.capabilitySource, 'blocked');
  assert.equal(beginner.confirmationWouldClear, false);
  const advanced = resolve({ trainingAge: 'advanced', edges: [ordinaryEdge], evidence: [] })
    .find((row) => row.movementId === 2);
  assert.equal(advanced.capabilitySource, 'advanced_bypass');
  const attested = resolve({ trainingAge: 'advanced', edges: [edge], evidence: [], attestedEdgeKeys: new Set() })
    .find((row) => row.movementId === 2);
  assert.equal(attested.capabilitySource, 'blocked');
  assert.equal(attested.separateAttestationRequired, true);
});
check('confirmation never overrides tier, equipment, or safety outer gates', () => {
  const advancedEdge = { ...edge, movementId: 3, requiresAttestation: false };
  const verdict = resolve({
    trainingAge: 'intermediate', edges: [advancedEdge], evidence: [],
    priorExperienceMovementIds: new Set([3]), safetyExcludedMovementIds: new Set([3]),
  }).find((row) => row.movementId === 3);
  assert.equal(verdict.capabilitySource, 'prior_experience');
  assert.deepEqual(verdict.reasons, ['tier', 'equipment', 'safety']);
  assert.equal(verdict.state, 'teaching_only');
});
check('sport context is tier-free but never receives the Advanced evidence bypass', () => {
  const sportEdge = { ...edge, movementId: 3, requiresAttestation: false };
  const blocked = resolve({
    trainingAge: 'advanced', accessContext: 'sport_conditioning', edges: [sportEdge], evidence: [],
    equipment: new Set(['Barbell']),
  }).find((row) => row.movementId === 3);
  assert.equal(blocked.reasons.includes('tier'), false);
  assert.equal(blocked.capabilitySource, 'blocked');
  assert.equal(blocked.confirmationWouldClear, true);
  const confirmed = resolve({
    trainingAge: 'advanced', accessContext: 'sport_conditioning', edges: [sportEdge], evidence: [],
    equipment: new Set(['Barbell']), priorExperienceMovementIds: new Set([3]),
  }).find((row) => row.movementId === 3);
  assert.equal(confirmed.state, 'available');
  assert.equal(confirmed.capabilitySource, 'prior_experience');
});
check('library resolves sport-tracking rows tier-free and non-sport rows as weight-room work', () => {
  const rows = resolve({ trainingAge: 'beginner', accessContext: 'library' });
  assert.equal(rows.find((row) => row.movementId === 5).effectiveContext, 'sport_conditioning');
  assert.equal(rows.find((row) => row.movementId === 5).state, 'available');
  assert.equal(rows.find((row) => row.movementId === 3).effectiveContext, 'weight_room');
  assert.ok(rows.find((row) => row.movementId === 3).reasons.includes('tier'));
});
const library = [{ movementId: 1, name: 'Pull-Up' }, { movementId: 2, name: 'Deadlift' }];
check('history example parses without writes or errors', () => {
  const parsed = parseHistoryImport(HISTORY_IMPORT_EXAMPLE, library);
  assert.equal(parsed.errors.length, 0); assert.equal(parsed.sessions.length, 1); assert.equal(parsed.sessions[0].sets.length, 2);
});
check('history parser reports malformed, duplicate, and unknown records by line', () => {
  const malformed = parseHistoryImport('AK_HISTORY_V1\nSESSION|2026-02-30||\nEND_SESSION', library);
  assert.ok(malformed.errors.some((issue) => issue.line === 2));
  const parsed = parseHistoryImport('AK_HISTORY_V1\nSESSION|2026-02-20||\nSET|Mystery|1|5|0||\nEND_SESSION', library);
  assert.deepEqual(parsed.unknownMovementNames, ['Mystery']);
  const duplicate = parseHistoryImport('AK_HISTORY_V1\nSESSION|2026-02-20||\nSET|Pull-Up|1|5|0||\nSET|Pull-Up|1|5|0||\nEND_SESSION', library);
  assert.ok(duplicate.errors.some((issue) => issue.message.includes('Duplicate')));
});
check('legacy routine composer preserves selected majors while enforcing availability and RPE cap', () => {
  const result = composeRoutine({ selections: [{ movementId: 1, role: 'major' }, { movementId: 2, role: 'major' }, { movementId: 3, role: 'supplementary' }], schemaType: 'LINEAR', objective: 'strength', trainingAge: 'beginner', durationCapMin: 30, baseRpeCap: 7, availableMovementIds: new Set([1, 2]) });
  assert.equal(result.slots.length, 2); assert.ok(result.slots.every((slot) => slot.targetRpe <= 7)); assert.ok(result.warnings.length >= 2);
});
check('routine construction cannot retain an Advanced movement for Intermediate', () => {
  const availability = resolve({ trainingAge: 'intermediate', equipment: new Set(['Barbell']) });
  const availableMovementIds = new Set(
    availability.filter((row) => row.state === 'available').map((row) => row.movementId),
  );
  const result = composeRoutine({
    selections: [{ movementId: 1, role: 'major' }, { movementId: 3, role: 'supplementary' }],
    schemaType: 'LINEAR', objective: 'strength', trainingAge: 'intermediate',
    durationCapMin: 60, baseRpeCap: 9, availableMovementIds,
  });
  assert.deepEqual(result.slots.map((slot) => slot.movementId), [1]);
  assert.ok(result.warnings.some((warning) => warning.includes('teaching-only')));
});
check('routine composer preserves the athlete-authored slot order', () => {
  const selections = [
    { movementId: 4, role: 'conditional' },
    { movementId: 1, role: 'major' },
    { movementId: 2, role: 'supplementary' },
  ];
  const result = composeRoutine({
    selections,
    schemaType: 'LINEAR',
    objective: 'strength',
    trainingAge: 'intermediate',
    durationCapMin: 60,
    baseRpeCap: 9,
    availableMovementIds: new Set([1, 2, 4]),
  });
  assert.deepEqual(result.slots.map((slot) => slot.movementId), [4, 1, 2]);
  assert.deepEqual(result.slots.map((slot) => slot.slotIndex), [1, 2, 3]);
});
check('four method strategies are deterministic and distinct', () => {
  const base = { selections: [{ movementId: 1, role: 'major' }], objective: 'strength', trainingAge: 'intermediate', durationCapMin: 60, baseRpeCap: 9, availableMovementIds: new Set([1]) };
  const signatures = ['LINEAR', 'WAVE', 'STEP', 'APRE'].map((schemaType) => JSON.stringify(composeRoutine({ ...base, schemaType }).slots));
  assert.equal(new Set(signatures).size, 4);
  assert.deepEqual(composeRoutine({ ...base, schemaType: 'APRE' }), composeRoutine({ ...base, schemaType: 'APRE' }));
});
check('major RPE projection exposes start/max and freezes the correct target for every block week', () => {
  assert.deepEqual(projectRoutineMajorRpe(8.5, 'LINEAR', 9), {
    startRpe: 6,
    maxRpe: 8.5,
    weekTargets: [6, 7.5, 8.5, 5],
  });
  assert.deepEqual(projectRoutineMajorRpe(8.5, 'WAVE', 9).weekTargets, [6, 8.5, 7.5, 5]);
  assert.deepEqual(projectRoutineMajorRpe(8.5, 'STEP', 9).weekTargets, [6, 6, 8.5, 5]);
  assert.deepEqual(projectRoutineMajorRpe(8.5, 'APRE', 9).weekTargets, [7.5, 7.5, 8.5, 5]);
  assert.equal(routineMajorRpeForWeek(8.5, 'LINEAR', 3, 9), 8.5);
  assert.equal(routineMajorRpeForWeek(9.5, 'LINEAR', 3, 8), 8,
    'the athlete RPE cap must still bound the projected maximum');
  assert.deepEqual(projectRoutineMajorRpe(8.75, 'LINEAR', 9), {
    startRpe: 6.5,
    maxRpe: 8.75,
    weekTargets: [6.5, 7.5, 8.75, 5.5],
  });
  for (const authoredPeak of [5.25, 7.25, 8.75]) {
    for (const schemaType of ['LINEAR', 'WAVE', 'STEP', 'APRE']) {
      const projection = projectRoutineMajorRpe(authoredPeak, schemaType, 9);
      assert.ok(projection.maxRpe <= authoredPeak,
        `${schemaType} max ${projection.maxRpe} expanded authored ${authoredPeak}`);
      assert.ok(projection.weekTargets.every((target) => target <= authoredPeak),
        `${schemaType} projection expanded authored ${authoredPeak}: ${projection.weekTargets.join(',')}`);
      for (const weekIndex of [1, 2, 3, 4]) {
        assert.ok(routineMajorRpeForWeek(authoredPeak, schemaType, weekIndex, 9) <= authoredPeak,
          `${schemaType} week ${weekIndex} expanded authored ${authoredPeak}`);
      }
    }
  }
  assert.throws(() => routineMajorRpeForWeek(8.5, 'LINEAR', 5, 9), /integer from 1 to 4/);
});
check('supplementary recommendations preserve curated order and deterministically backfill unavailable choices', () => {
  const major = { movementId: 1, name: 'Deadlift', pattern: 'hinge', targetMuscles: ['glutes', 'hamstrings'], isCompound: true };
  const candidates = [
    { movementId: 11, name: 'Bulgarian Split Squat', pattern: 'lunge', targetMuscles: ['quadriceps', 'glutes'], isCompound: true },
    { movementId: 12, name: 'Chest-Supported Dumbbell Row', pattern: 'pull_h', targetMuscles: ['lats'], isCompound: true },
    { movementId: 10, name: 'Barbell Hip Thrust', pattern: 'hinge', targetMuscles: ['glutes'], isCompound: true },
    { movementId: 13, name: 'Romanian Deadlift', pattern: 'hinge', targetMuscles: ['hamstrings'], isCompound: true },
  ];
  const ranked = rankRoutineSupplementaryRecommendations(major, candidates);
  assert.deepEqual(ranked.map((row) => row.movementId), [10, 11, 12]);
  assert.deepEqual(ranked.map((row) => row.rank), [1, 2, 3]);
  assert.ok(ranked.every((row) => row.curated));

  const withoutHipThrust = rankRoutineSupplementaryRecommendations(
    major,
    candidates.filter((candidate) => candidate.movementId !== 10),
  );
  assert.deepEqual(withoutHipThrust.map((row) => row.movementId), [11, 12, 13]);
  assert.equal(withoutHipThrust[2].curated, false,
    'an unavailable curated choice is backfilled, never force-included');
});
check('chain projection throws on cycles and branching ambiguity', () => {
  const families = [{ movementId: 1, family: 'f' }, { movementId: 2, family: 'f' }, { movementId: 3, family: 'f' }];
  assert.throws(
    () => projectChainsFromGraph(families, [
      { prerequisiteMovementId: 1, movementId: 2, relationship: 'prerequisite' },
      { prerequisiteMovementId: 2, movementId: 1, relationship: 'prerequisite' },
    ]),
    /Disconnected components or cycle|Cycle detected/,
  );
  assert.throws(
    () => projectChainsFromGraph(families, [
      { prerequisiteMovementId: 1, movementId: 2, relationship: 'prerequisite' },
      { prerequisiteMovementId: 1, movementId: 3, relationship: 'prerequisite' },
    ]),
    /Branching ambiguity/,
  );
  assert.throws(
    () => projectChainsFromGraph(families, [
      { prerequisiteMovementId: 1, movementId: 3, relationship: 'prerequisite' },
      { prerequisiteMovementId: 2, movementId: 3, relationship: 'prerequisite' },
    ]),
    /Branching ambiguity/,
  );
});
check('agreement gate: chain projection over live 028 graph matches live movement_progression order', () => {
  const root = join(import.meta.dirname, '..', '..', '..');
  const schemaDir = join(root, 'packages', 'core-db', 'src', 'schema');
  const db = new DatabaseSync(':memory:');
  for (const f of ['001_mechanical_input.sql', '002_telemetry.sql', '003_state_vector.sql',
    '005_subjective_report.sql', '006_user_profile.sql', '007_program_engine.sql',
    '008_taxonomy.sql', '009_periodization.sql', '010_movement_library.sql',
    '011_niggle_tracking.sql', '012_report_severity.sql', '013_profile_slot.sql',
    '014_movement_prefixes.sql', '015_set_prefix.sql',
    '016_movement_library_seed.sql', '017_movement_batch.sql',
    '018_logging_modes.sql', '019_movement_batch.sql', '020_movement_batch.sql',
    '021_taxonomy_corrections.sql',
    '022_set_target.sql', '023_phase17_session_foundation.sql',
    '024_phase17_equipment_fixes.sql', '025_movement_coaching_content.sql',
    '026_phase18_session_outcome.sql', '027_operational_safeguards.sql',
    '028_capability_graph.sql', '029_routine_history_analytics.sql',
    '030_readiness_import_integration.sql', '031_planned_session_method.sql',
    '032_capability_content.sql', '033_goal_program.sql']) {
    db.exec(readFileSync(join(schemaDir, f), 'utf-8'));
  }

  const families = db.prepare('SELECT movement_id AS movementId, family FROM movement_capability_family').all();
  const edges = db.prepare('SELECT prerequisite_movement_id AS prerequisiteMovementId, movement_id AS movementId, relationship FROM movement_capability_edge').all();
  const projected = projectChainsFromGraph(families, edges);

  const legacyRows = db.prepare('SELECT movement_id AS movementId, progression_group AS progressionGroup, progression_rank AS progressionRank FROM movement_progression ORDER BY progression_group, progression_rank').all();

  const projByGroup = new Map();
  for (const r of projected) {
    if (!projByGroup.has(r.progressionGroup)) projByGroup.set(r.progressionGroup, []);
    projByGroup.get(r.progressionGroup).push(r.movementId);
  }
  const legacyByGroup = new Map();
  for (const r of legacyRows) {
    if (!legacyByGroup.has(r.progressionGroup)) legacyByGroup.set(r.progressionGroup, []);
    legacyByGroup.get(r.progressionGroup).push(r.movementId);
  }

  assert.equal(projByGroup.size, legacyByGroup.size);
  for (const [group, projMovements] of projByGroup.entries()) {
    const legacyMovements = legacyByGroup.get(group);
    assert.deepEqual(projMovements, legacyMovements, `Discrepancy in group ${group}`);
  }

  // Execute _chain_projection.sql.tpl template and assert exact match with TS projectChainsFromGraph
  const tplPath = join(schemaDir, '_chain_projection.sql.tpl');
  const tplSql = readFileSync(tplPath, 'utf-8');
  db.exec(tplSql);
  const sqlProjectedRows = db.prepare('SELECT movement_id AS movementId, progression_group AS progressionGroup, progression_rank AS progressionRank FROM movement_progression ORDER BY progression_group, progression_rank').all();

  assert.equal(sqlProjectedRows.length, projected.length, 'SQL projection row count must match TS projection');
  for (let i = 0; i < projected.length; i += 1) {
    assert.equal(sqlProjectedRows[i].movementId, projected[i].movementId);
    assert.equal(sqlProjectedRows[i].progressionGroup, projected[i].progressionGroup);
    assert.equal(sqlProjectedRows[i].progressionRank, projected[i].progressionRank);
  }
});
check('AK_HISTORY_V1.md template parses with zero errors', () => {
  const docPath = join(import.meta.dirname, '..', '..', '..', 'docs', 'AK_HISTORY_V1.md');
  const docContent = readFileSync(docPath, 'utf-8');
  const match = docContent.match(/```text\r?\n([\s\S]*?)\r?\n```/);
  assert.ok(match, 'Template code block not found in docs/AK_HISTORY_V1.md');
  const templateText = match[1];

  const root = join(import.meta.dirname, '..', '..', '..');
  const schemaDir = join(root, 'packages', 'core-db', 'src', 'schema');
  const db = new DatabaseSync(':memory:');
  for (const f of ['001_mechanical_input.sql', '002_telemetry.sql', '003_state_vector.sql',
    '005_subjective_report.sql', '006_user_profile.sql', '007_program_engine.sql',
    '008_taxonomy.sql', '009_periodization.sql', '010_movement_library.sql',
    '011_niggle_tracking.sql', '012_report_severity.sql', '013_profile_slot.sql',
    '014_movement_prefixes.sql', '015_set_prefix.sql',
    '016_movement_library_seed.sql', '017_movement_batch.sql',
    '018_logging_modes.sql', '019_movement_batch.sql', '020_movement_batch.sql',
    '021_taxonomy_corrections.sql',
    '022_set_target.sql', '023_phase17_session_foundation.sql',
    '024_phase17_equipment_fixes.sql', '025_movement_coaching_content.sql',
    '026_phase18_session_outcome.sql', '027_operational_safeguards.sql',
    '028_capability_graph.sql', '029_routine_history_analytics.sql',
    '030_readiness_import_integration.sql', '031_planned_session_method.sql',
    '032_capability_content.sql', '033_goal_program.sql']) {
    db.exec(readFileSync(join(schemaDir, f), 'utf-8'));
  }
  const library = db.prepare('SELECT movement_id AS movementId, name FROM movement').all();

  const parsed = parseHistoryImport(templateText, library);
  assert.equal(parsed.errors.length, 0, `Expected 0 errors, got: ${JSON.stringify(parsed.errors)}`);
  assert.equal(parsed.sessions.length, 3, `Expected 3 sessions, got ${parsed.sessions.length}`);
  assert.equal(parsed.unknownMovementNames.length, 0, `Unknown movements: ${parsed.unknownMovementNames.join(', ')}`);
});
// ---------------------------------------------------------------------------
// P2-4: named acceptance coverage against the REAL migration chain.
//
// Every check above runs on synthetic fixtures. This block builds the shipped
// library from migrations 001-054 and pins the ratified records BY NAME, so a
// future content batch that re-tiers a competition lift, moves a role row, or
// re-parents a capability edge fails here instead of in an athlete's hands.
//
// Fixtures are supplied deliberately: full barbell equipment (so equipment can
// never be the blocking reason), zero verified evidence and zero attestations
// (so capability is the only ordinary gate), and prior experience toggled one
// assertion at a time. Each check therefore isolates exactly one law.
// ---------------------------------------------------------------------------
{
  const root = join(import.meta.dirname, '..', '..', '..');
  const schemaDir = join(root, 'packages', 'core-db', 'src', 'schema');
  const fullChain = readdirSync(schemaDir)
    .filter((file) => /^\d{3}_.*\.sql$/.test(file) && !file.startsWith('004_'))
    .sort();
  const db = new DatabaseSync(':memory:');
  try { db.prepare('SELECT ln(2.0), sqrt(2.0)').get(); } catch {
    db.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
    db.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
  }
  for (const file of fullChain) db.exec(readFileSync(join(schemaDir, file), 'utf-8'));

  check('the acceptance database is the real 001-054 chain, not a trimmed subset', () => {
    assert.equal(fullChain[0], '001_mechanical_input.sql');
    assert.equal(fullChain[fullChain.length - 1], '054_contract_cutoff_provenance.sql');
    assert.equal(fullChain.length, 53, `applied ${fullChain.length} migrations`);
    assert.equal(Number(db.prepare('SELECT COUNT(*) AS c FROM movement').get().c), 300);
  });

  const idOf = (name) => {
    const row = db.prepare('SELECT movement_id FROM movement WHERE name = ?').get(name);
    assert.ok(row !== undefined, `library is missing the ratified movement "${name}"`);
    return Number(row.movement_id);
  };
  const CONFIRMABLE = ['Front Squat', 'Barbell Row', 'Overhead Press'];
  const COMPETITION = ['Competition Squat', 'Deadlift', 'Competition Bench'];
  const CONTROL = 'Sumo Deadlift';

  const libraryMovements = db.prepare(`
    SELECT m.movement_id AS movementId, md.difficulty_rating AS difficulty,
           CASE WHEN w.movement_id IS NULL THEN 0 ELSE 1 END AS beginnerOk,
           CASE WHEN st.movement_id IS NULL THEN 0 ELSE 1 END AS sportTracking
      FROM movement m
      LEFT JOIN movement_detail md USING(movement_id)
      LEFT JOIN movement_beginner_whitelist w ON w.movement_id = m.movement_id
      LEFT JOIN movement_sport_tracking st ON st.movement_id = m.movement_id
     ORDER BY m.movement_id`).all().map((row) => ({
    movementId: Number(row.movementId),
    difficulty: row.difficulty,
    beginnerOk: row.beginnerOk === 1,
    sportTracking: row.sportTracking === 1,
    // Equipment is supplied as satisfied below; an empty requirement list here
    // keeps every verdict free of an equipment reason by construction.
    requiredEquipment: [],
  }));
  const libraryEdges = db.prepare(`
    SELECT prerequisite_movement_id AS prerequisiteMovementId, movement_id AS movementId,
           relationship, min_sessions AS minSessions, min_sets_per_session AS minSetsPerSession,
           min_value AS minValue, value_kind AS valueKind, max_rpe AS maxRpe,
           requires_attestation AS requiresAttestation
      FROM movement_capability_edge
     ORDER BY prerequisite_movement_id, movement_id`).all().map((row) => ({
    ...row, requiresAttestation: row.requiresAttestation === 1,
  }));
  const libraryVerdicts = (over = {}) => {
    const rows = resolveMovementAvailability({
      movements: libraryMovements,
      edges: libraryEdges,
      evidence: [],
      attestedEdgeKeys: new Set(),
      priorExperienceMovementIds: new Set(),
      trainingAge: 'intermediate',
      accessContext: 'weight_room',
      equipment: new Set(),
      safetyExcludedMovementIds: new Set(),
      ...over,
    });
    return new Map(rows.map((row) => [row.movementId, row]));
  };

  check('named competition lifts are pinned to Advanced and their gateways to Intermediate', () => {
    for (const name of COMPETITION) {
      assert.equal(
        db.prepare('SELECT difficulty_rating AS d FROM movement_detail WHERE movement_id = ?').get(idOf(name)).d,
        'Advanced',
        `${name} must stay Advanced`,
      );
    }
    for (const name of [...CONFIRMABLE, CONTROL]) {
      assert.equal(
        db.prepare('SELECT difficulty_rating AS d FROM movement_detail WHERE movement_id = ?').get(idOf(name)).d,
        'Intermediate',
        `${name} must stay Intermediate`,
      );
    }
  });

  check('Sumo Deadlift is the already-available Intermediate control: no gate to clear', () => {
    const id = idOf(CONTROL);
    assert.equal(
      libraryEdges.filter((edge) => edge.movementId === id && edge.relationship === 'prerequisite').length,
      0,
      'the control must carry no prerequisite edge',
    );
    const verdict = libraryVerdicts().get(id);
    assert.equal(verdict.state, 'available');
    assert.deepEqual(verdict.reasons, []);
    assert.equal(verdict.capabilitySource, 'not_required');
    // It is already available, so confirmation is neither needed nor offered.
    assert.equal(verdict.confirmationWouldClear, false);
  });

  check('Intermediate confirmation clears the named Front Squat, Barbell Row and Overhead Press gates', () => {
    const ids = CONFIRMABLE.map(idOf);
    const blocked = libraryVerdicts();
    for (const [index, id] of ids.entries()) {
      const verdict = blocked.get(id);
      assert.equal(verdict.state, 'teaching_only', `${CONFIRMABLE[index]} should start gated`);
      assert.deepEqual(verdict.reasons, ['capability'], `${CONFIRMABLE[index]} must be gated ONLY by capability`);
      assert.equal(verdict.separateAttestationRequired, false);
      assert.equal(verdict.confirmationWouldClear, true);
    }
    const confirmed = libraryVerdicts({ priorExperienceMovementIds: new Set(ids) });
    for (const [index, id] of ids.entries()) {
      const verdict = confirmed.get(id);
      assert.equal(verdict.state, 'available', `${CONFIRMABLE[index]} should unlock on confirmation`);
      assert.equal(verdict.capabilitySource, 'prior_experience');
      assert.deepEqual(verdict.reasons, []);
    }
    // Confirming one gate must not unlock its siblings.
    const onlyFrontSquat = libraryVerdicts({ priorExperienceMovementIds: new Set([ids[0]]) });
    assert.equal(onlyFrontSquat.get(ids[0]).state, 'available');
    assert.equal(onlyFrontSquat.get(ids[1]).state, 'teaching_only');
    assert.equal(onlyFrontSquat.get(ids[2]).state, 'teaching_only');
  });

  check('confirmation can never unlock Competition Squat, Deadlift or Competition Bench for Intermediate', () => {
    const ids = COMPETITION.map(idOf);
    const confirmed = libraryVerdicts({
      // The maximally permissive fixture: every competition lift AND every
      // gateway declared, so only the tier ceiling can still refuse.
      priorExperienceMovementIds: new Set([...ids, ...CONFIRMABLE.map(idOf)]),
    });
    for (const [index, id] of ids.entries()) {
      const verdict = confirmed.get(id);
      assert.equal(verdict.state, 'teaching_only', `${COMPETITION[index]} must stay locked for Intermediate`);
      assert.ok(verdict.reasons.includes('tier'), `${COMPETITION[index]} must still report the tier ceiling`);
    }
    // The same declarations DO unlock them once the athlete is Advanced, which
    // proves the refusal above is the tier ceiling and not a broken fixture.
    const advanced = libraryVerdicts({
      trainingAge: 'advanced',
      priorExperienceMovementIds: new Set([...ids, ...CONFIRMABLE.map(idOf)]),
    });
    for (const [index, id] of ids.entries()) {
      assert.equal(advanced.get(id).state, 'available', `${COMPETITION[index]} should open at Advanced`);
    }
  });

  check('the DB-derived role sets expose the curated multi-role contract', () => {
    const counts = Object.fromEntries(db.prepare(
      'SELECT role, COUNT(*) AS c FROM movement_role_eligibility GROUP BY role',
    ).all().map((row) => [row.role, Number(row.c)]));
    assert.equal(counts.major, 79);
    assert.equal(counts.conditional, 12);
    assert.equal(counts.supplementary, 84);
    assert.equal(counts.accessory, 14);
    const majors = db.prepare(`SELECT m.name FROM movement_role_eligibility re
      JOIN movement m USING(movement_id) WHERE re.role = 'major' ORDER BY m.name`).all().map((row) => row.name);
    for (const name of [
      'Barbell Row', 'Competition Bench', 'Competition Squat', 'Deadlift',
      'Front Squat', 'Overhead Press', 'Power Clean', 'Sumo Deadlift',
    ]) assert.ok(majors.includes(name), `${name} must remain major-eligible`);
    const conditionals = db.prepare(`SELECT m.name FROM movement_role_eligibility re
      JOIN movement m USING(movement_id) WHERE re.role = 'conditional' ORDER BY m.name`).all().map((row) => row.name);
    assert.equal(conditionals.length, 12);
    assert.deepEqual(conditionals, [
      'Band External Rotation', 'Band Pull-Apart', 'BJJ Sparring Round',
      'Cable Internal Rotation', 'Dead Bug', 'Face Pull', 'Farmer Carry',
      'Kettlebell Turkish Get-Up', 'Pallof Press', 'Plank', 'Road Run',
      'Suitcase Carry',
    ]);
  });

  check('all eight live major lifts resolve to three curated, supplementary-eligible recommendations', () => {
    const recommendationRows = db.prepare(`
      SELECT m.movement_id, m.name, m.pattern, m.is_compound, md.target_muscles
        FROM movement_role_eligibility re
        JOIN movement m USING(movement_id)
        JOIN movement_detail md USING(movement_id)
       WHERE re.role = 'supplementary'
       ORDER BY m.movement_id`).all().map((row) => ({
      movementId: Number(row.movement_id),
      name: row.name,
      pattern: row.pattern,
      targetMuscles: JSON.parse(row.target_muscles),
      isCompound: row.is_compound === 1,
    }));
    const byName = new Map(recommendationRows.map((row) => [row.name, row]));
    const expected = {
      'Competition Squat': ['Romanian Deadlift', 'Bulgarian Split Squat', 'Barbell Hip Thrust'],
      'Front Squat': ['Romanian Deadlift', 'Bulgarian Split Squat', 'Barbell Hip Thrust'],
      Deadlift: ['Barbell Hip Thrust', 'Bulgarian Split Squat', 'Chest-Supported Dumbbell Row'],
      'Sumo Deadlift': ['Romanian Deadlift', 'Bulgarian Split Squat', 'Barbell Hip Thrust'],
      'Competition Bench': ['Incline Dumbbell Press', 'Barbell Row', 'Triceps Pushdown'],
      'Overhead Press': ['Pull-Up', 'Incline Dumbbell Press', 'Face Pull'],
      'Barbell Row': ['Pull-Up', 'Chest-Supported Dumbbell Row', 'Face Pull'],
      'Power Clean': ['Front Squat', 'Romanian Deadlift', 'Overhead Press'],
    };
    for (const [majorName, expectedNames] of Object.entries(expected)) {
      const major = byName.get(majorName);
      assert.ok(major, `${majorName} must remain supplementary-eligible as well as major-eligible`);
      const ranked = rankRoutineSupplementaryRecommendations(major, recommendationRows);
      assert.deepEqual(
        ranked.map((row) => byName.get(expectedNames[row.rank - 1])?.movementId),
        ranked.map((row) => row.movementId),
        `${majorName} recommendation order drifted`,
      );
      assert.equal(ranked.length, 3);
      assert.ok(ranked.every((row) => row.curated));
    }
  });

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
  const routineRoleEligibility = {
    major: roleSet('major'), supplementary: roleSet('supplementary'),
    accessory: roleSet('accessory'), conditional: roleSet('conditional'),
  };
  const liftFamilies = db.prepare(`
    SELECT movement_id, family, stress_coefficient, preferred_purpose
    FROM movement_lift_family ORDER BY family, movement_id
  `).all().map((row) => ({
    movementId: Number(row.movement_id), family: row.family,
    stressCoefficient: Number(row.stress_coefficient), preferredPurpose: row.preferred_purpose,
  }));
  const assistance = db.prepare(`
    SELECT major_family, movement_id, distance, stress_factor, fatigue_cost, reason
    FROM movement_assistance_relationship ORDER BY major_family, distance, movement_id
  `).all().map((row) => ({
    family: row.major_family, movementId: Number(row.movement_id), distance: Number(row.distance),
    stressFactor: Number(row.stress_factor), fatigueCost: Number(row.fatigue_cost), reason: row.reason,
  }));
  const allAvailable = new Set(routineMovements.map((movement) => movement.movementId));
  const composeReal = (selections, overrides = {}) => composeRoutineMicrocycle({
    selections, movements: routineMovements, liftFamilies, assistance,
    roleEligibility: routineRoleEligibility, schemaType: 'LINEAR', objective: 'strength',
    trainingAge: 'elite', durationCapMin: 120, baseRpeCap: 9,
    availableMovementIds: allAvailable, ...overrides,
  });

  check('same-day Board Press plus Competition Bench is one weighted family exposure across two locked variations', () => {
    const boardId = idOf('Board Press');
    const benchId = idOf('Competition Bench');
    const result = composeReal([
      { dayIndex: 1, slotIndex: 1, movementId: boardId, role: 'major', sets: 2, reps: 6, targetRpe: 8 },
      { dayIndex: 1, slotIndex: 2, movementId: benchId, role: 'major', sets: 3, reps: 7, targetRpe: 8 },
    ]);
    assert.deepEqual(result.blockers, []);
    assert.deepEqual(result.prescriptions.map((row) => [row.movementId, row.sets, row.reps]), [
      [boardId, 2, 6], [benchId, 3, 7],
    ]);
    assert.deepEqual(result.prescriptions.map((row) => [row.authoredSets, row.authoredReps]), [
      [2, 6], [3, 7],
    ]);
    const decision = result.familyDecisions.find((row) => row.family === 'bench_press');
    assert.ok(decision);
    assert.equal(decision.exposureCount, 1);
    assert.equal(decision.variationCount, 2);
    assert.equal(decision.sessions[0].exposureCount, 1);
    assert.equal(decision.sessions[0].variationCount, 2);
    assert.equal(decision.equivalentVolume, 31.8, '0.9*(2*6) + 1.0*(3*7)');
    assert.ok(result.warnings.some((warning) => warning.includes('form one major-family exposure')));
  });

  check('identical same-day bench variations keep authored volume and report the true purpose adaptation', () => {
    const boardId = idOf('Board Press');
    const pinId = idOf('Pin Presses');
    const result = composeReal([
      { dayIndex: 1, slotIndex: 1, movementId: boardId, role: 'major', sets: 3, reps: 5, targetRpe: 8 },
      { dayIndex: 1, slotIndex: 2, movementId: pinId, role: 'major', sets: 3, reps: 5, targetRpe: 8 },
    ]);
    assert.deepEqual(result.blockers, []);
    assert.deepEqual(result.prescriptions.map((row) => [
      row.authoredSets, row.authoredReps, row.authoredTargetRpe,
      row.sets, row.reps, row.targetRpe,
    ]), [
      [3, 5, 8, 3, 5, 8],
      [3, 5, 8, 3, 5, 7.5],
    ]);
    const decision = result.familyDecisions.find((row) => row.family === 'bench_press');
    assert.ok(decision);
    assert.equal(decision.initialStress, 24.4);
    assert.equal(decision.finalStress, 23.9);
    assert.equal(decision.equivalentVolume, 27,
      '0.9*(3*5) + 0.9*(3*5) remains the sum of two variations in one exposure');
    assert.ok(result.prescriptions[1].adaptations.some((row) => row.includes('Distinct volume exposure')));
  });

  check('weighted same-day variation accumulation applies to every curated major family', () => {
    const byFamily = new Map();
    for (const row of liftFamilies) {
      const familyRows = byFamily.get(row.family) ?? [];
      familyRows.push(row);
      byFamily.set(row.family, familyRows);
    }
    assert.equal(byFamily.size, 7);
    for (const [family, familyRows] of byFamily) {
      assert.ok(familyRows.length >= 2, `${family} needs at least two curated variations`);
      const chosen = familyRows.slice(0, 2);
      const result = composeReal(chosen.map((row, index) => ({
        dayIndex: 1, slotIndex: index + 1, movementId: row.movementId,
        role: 'major', sets: 2, reps: 3, targetRpe: 6,
      })));
      assert.deepEqual(result.blockers, [], family);
      assert.ok(result.prescriptions.every((row) => row.sets <= row.authoredSets
        && row.reps <= row.authoredReps && row.targetRpe <= row.authoredTargetRpe), family);
      assert.ok(result.prescriptions.every((row) => row.authoredSets === 2
        && row.authoredReps === 3 && row.authoredTargetRpe === 6), family);
      const decision = result.familyDecisions.find((row) => row.family === family);
      assert.equal(decision.exposureCount, 1, family);
      assert.equal(decision.variationCount, 2, family);
      assert.equal(decision.equivalentVolume,
        Math.round(result.prescriptions.reduce(
          (sum, row) => sum + row.stressCoefficient * row.sets * row.reps, 0,
        ) * 10) / 10,
        family);
      assert.ok(decision.initialStress >= decision.finalStress, family);
    }
  });

  check('Elite five-times-weekly bench-family plan is accepted and distributed across distinct stress purposes', () => {
    const benchId = idOf('Competition Bench');
    const result = composeReal([1, 2, 3, 4, 5].map((dayIndex) => ({
      dayIndex, slotIndex: 1, movementId: benchId, role: 'major', sets: 2, reps: 3, targetRpe: 6,
    })));
    assert.deepEqual(result.blockers, []);
    assert.equal(result.prescriptions.length, 5);
    assert.ok(result.prescriptions.every((row) => row.included && row.movementId === benchId));
    const decision = result.familyDecisions[0];
    assert.equal(decision.exposureCount, 5);
    assert.equal(decision.variationCount, 1);
    assert.equal(decision.sessions.length, 5);
    assert.equal(new Set(result.prescriptions.map((row) => row.purpose)).size, 5);
    assert.ok(result.prescriptions.every((row) => row.sets === 2 && row.reps === 3),
      'purpose assignment must not expand the repeated authored dose');
    assert.deepEqual(result.prescriptions.map((row) => row.authoredReps), [3, 3, 3, 3, 3]);
    assert.equal(decision.equivalentVolume, 30);
    assert.equal(decision.initialStress, 16.4);
    assert.equal(decision.finalStress, 16.2);
    assert.ok(decision.finalStress <= decision.weeklyBudget);
    assert.ok(result.recommendations.some((row) => row.includes('consecutive-day exposure is preserved')));
  });

  check('rising major-family stress reduces accessory and supplementary work before preserving bounded majors', () => {
    const boardId = idOf('Board Press');
    const benchId = idOf('Competition Bench');
    const tricepsId = idOf('Triceps Pushdown');
    const hammerId = idOf('Hammer Curl');
    const result = composeReal([
      { dayIndex: 1, slotIndex: 1, movementId: benchId, role: 'major', sets: 10, reps: 10, targetRpe: 9 },
      { dayIndex: 1, slotIndex: 2, movementId: boardId, role: 'major', sets: 10, reps: 10, targetRpe: 9 },
      { dayIndex: 1, slotIndex: 3, movementId: tricepsId, role: 'supplementary', sets: 5, reps: 20, targetRpe: 9 },
      { dayIndex: 1, slotIndex: 4, movementId: hammerId, role: 'accessory', sets: 5, reps: 20, targetRpe: 9 },
    ]);
    assert.deepEqual(result.blockers, []);
    const majors = result.prescriptions.filter((row) => row.role === 'major');
    const support = result.prescriptions.filter((row) => row.role !== 'major');
    assert.equal(majors.length, 2);
    assert.ok(majors.every((row) => row.included && row.sets >= 1 && row.reps >= 1));
    assert.ok(support.every((row) => !row.included));
    assert.ok(support.every((row) => row.adaptations.some(
      (text) => text.includes('before changing bench_press major exposure'),
    )));
    assert.ok(majors.some((row) => row.sets < 10 || row.reps < 10 || row.targetRpe < 9));
    assert.ok(majors.every((row) => row.authoredSets === 10
      && row.authoredReps === 10 && row.authoredTargetRpe === 9));
    assert.ok(result.familyDecisions[0].finalStress <= result.familyDecisions[0].weeklyBudget);
  });

  check('moderate family pressure sheds accessory work before direct supplementary work', () => {
    const benchId = idOf('Competition Bench');
    const tricepsId = idOf('Triceps Pushdown');
    const hammerId = idOf('Hammer Curl');
    const result = composeReal([
      { dayIndex: 1, slotIndex: 1, movementId: benchId, role: 'major', sets: 4, reps: 8, targetRpe: 9 },
      { dayIndex: 1, slotIndex: 2, movementId: tricepsId, role: 'supplementary', sets: 2, reps: 10, targetRpe: 7 },
      { dayIndex: 1, slotIndex: 3, movementId: hammerId, role: 'accessory', sets: 5, reps: 20, targetRpe: 9 },
    ], { trainingAge: 'intermediate' });
    assert.deepEqual(result.blockers, []);
    assert.equal(result.prescriptions.find((row) => row.movementId === hammerId).included, false);
    assert.equal(result.prescriptions.find((row) => row.movementId === tricepsId).included, true);
    assert.equal(result.prescriptions.find((row) => row.movementId === benchId).sets, 4);
  });

  check('freezing one day enforces its live access gates while retaining all-day weekly stress context', () => {
    const benchId = idOf('Competition Bench');
    const overheadId = idOf('Overhead Press');
    const selections = [
      { dayIndex: 1, slotIndex: 1, movementId: benchId, role: 'major', sets: 2, reps: 5, targetRpe: 7 },
      { dayIndex: 2, slotIndex: 1, movementId: overheadId, role: 'major', sets: 2, reps: 5, targetRpe: 7 },
    ];
    const dayTwoRoleDrift = {
      ...routineRoleEligibility,
      major: new Set([...routineRoleEligibility.major].filter((movementId) => movementId !== overheadId)),
    };
    const dayOneFreeze = composeReal(selections, {
      availableMovementIds: new Set([benchId]),
      roleEligibility: dayTwoRoleDrift,
      executionGateDayIndices: new Set([1]),
    });
    assert.deepEqual(dayOneFreeze.blockers, []);
    assert.equal(dayOneFreeze.prescriptions.length, 2);
    assert.deepEqual(dayOneFreeze.familyDecisions.map((decision) => decision.family).sort(), [
      'bench_press', 'overhead_press',
    ]);
    const dayTwoFreeze = composeReal(selections, {
      availableMovementIds: new Set([benchId]),
      roleEligibility: dayTwoRoleDrift,
      executionGateDayIndices: new Set([2]),
    });
    assert.ok(dayTwoFreeze.blockers.some((blocker) => blocker.includes('Overhead Press is unavailable')));
    assert.ok(dayTwoFreeze.blockers.some((blocker) => blocker.includes('not ratified for the major role')));
  });

  check('duration overflow blocks only the day being saved or frozen while every day remains analysed', () => {
    const representativeByFamily = new Map();
    for (const row of liftFamilies) {
      if (!representativeByFamily.has(row.family)) representativeByFamily.set(row.family, row.movementId);
    }
    const representatives = [...representativeByFamily.values()];
    assert.equal(representatives.length, 7);
    const selections = [
      { dayIndex: 1, slotIndex: 1, movementId: representatives[0], role: 'major', sets: 3, reps: 5, targetRpe: 8 },
      ...representatives.slice(1).map((movementId, index) => ({
        dayIndex: 2, slotIndex: index + 1, movementId, role: 'major', sets: 3, reps: 5, targetRpe: 8,
      })),
    ];
    const dayOneFreeze = composeReal(selections, {
      durationCapMin: 30,
      executionGateDayIndices: new Set([1]),
    });
    assert.deepEqual(dayOneFreeze.blockers, []);
    assert.ok(dayOneFreeze.warnings.some((warning) =>
      warning.includes('Day 2 cannot fit every selected major')
      && warning.includes('Edit that day before freezing it.')));
    assert.equal(dayOneFreeze.prescriptions.filter((row) => row.dayIndex === 2).length, 6,
      'the overflowing day remains in weekly stress decisions');

    const dayTwoFreeze = composeReal(selections, {
      durationCapMin: 30,
      executionGateDayIndices: new Set([2]),
    });
    assert.ok(dayTwoFreeze.blockers.some((blocker) =>
      blocker.includes('Day 2 cannot fit every selected major')));
    const wholeTemplateSave = composeReal(selections, { durationCapMin: 30 });
    assert.ok(wholeTemplateSave.blockers.some((blocker) =>
      blocker.includes('Day 2 cannot fit every selected major')));
  });

  check('new above-cap RPE is rejected while freeze normalizes stored drift across the microcycle', () => {
    const benchId = idOf('Competition Bench');
    const squatId = idOf('Competition Squat');
    const selections = [
      { dayIndex: 1, slotIndex: 1, movementId: benchId, role: 'major', sets: 3, reps: 5, targetRpe: 7 },
      { dayIndex: 2, slotIndex: 1, movementId: squatId, role: 'major', sets: 3, reps: 5, targetRpe: 8 },
    ];
    const authored = composeReal(selections, { baseRpeCap: 7.5 });
    assert.ok(authored.blockers.some((blocker) =>
      blocker.includes('Competition Squat RPE must be between 5 and 7.5')));

    const frozen = composeReal(selections, {
      baseRpeCap: 7.5,
      rpeCapBehavior: 'clamp',
      executionGateDayIndices: new Set([1]),
    });
    assert.deepEqual(frozen.blockers, []);
    const drifted = frozen.prescriptions.find((row) => row.movementId === squatId);
    assert.equal(drifted.authoredTargetRpe, 8);
    assert.equal(drifted.targetRpe, 7.5);
    assert.ok(drifted.adaptations.some((adaptation) => adaptation.includes('current limit')));
    const squatDecision = frozen.familyDecisions.find((row) => row.family === 'squat');
    assert.ok(squatDecision.initialStress > squatDecision.finalStress);
  });

  check('legacy support allowance is exact and never bypasses live availability', () => {
    const benchId = idOf('Competition Bench');
    const sitUpId = idOf('3/4 Sit-Up');
    assert.equal(routineRoleEligibility.supplementary.has(sitUpId), false);
    const selections = [
      { dayIndex: 1, slotIndex: 1, movementId: benchId, role: 'major', sets: 3, reps: 5, targetRpe: 7 },
      { dayIndex: 1, slotIndex: 2, movementId: sitUpId, role: 'supplementary', sets: 2, reps: 10, targetRpe: 6 },
    ];
    assert.ok(composeReal(selections).blockers.some((blocker) =>
      blocker.includes('3/4 Sit-Up is not ratified for the supplementary role')));
    assert.ok(composeReal(selections, {
      legacyRoleAllowances: [{ dayIndex: 2, movementId: sitUpId, role: 'supplementary' }],
    }).blockers.length > 0, 'a different day does not inherit the allowance');

    const preserved = composeReal(selections, {
      legacyRoleAllowances: [{ dayIndex: 1, movementId: sitUpId, role: 'supplementary' }],
    });
    assert.deepEqual(preserved.blockers, []);
    assert.ok(preserved.warnings.some((warning) => warning.includes('preserved only for its existing day 1 supplementary slot')));
    assert.equal(preserved.prescriptions.find((row) => row.movementId === sitUpId).included, true);

    const unavailable = composeReal(selections, {
      availableMovementIds: new Set([benchId]),
      legacyRoleAllowances: [{ dayIndex: 1, movementId: sitUpId, role: 'supplementary' }],
    });
    assert.ok(unavailable.blockers.some((blocker) => blocker.includes('3/4 Sit-Up is unavailable')));
  });

  check('Hammer Curl role is contextual and accessory ranking may correctly reduce to zero', () => {
    const hammerId = idOf('Hammer Curl');
    const rowId = idOf('Barbell Row');
    const benchId = idOf('Competition Bench');
    const afterPull = contextualRoutineRoles(
      hammerId, [rowId], liftFamilies, assistance, routineRoleEligibility,
    );
    const afterBench = contextualRoutineRoles(
      hammerId, [benchId], liftFamilies, assistance, routineRoleEligibility,
    );
    const mixedBenchAndPull = contextualRoutineRoles(
      hammerId, [benchId, rowId], liftFamilies, assistance, routineRoleEligibility,
    );
    assert.equal(afterPull.has('supplementary'), true);
    assert.equal(afterPull.has('accessory'), false);
    assert.equal(afterBench.has('supplementary'), false);
    assert.equal(afterBench.has('accessory'), true);
    assert.equal(mixedBenchAndPull.has('supplementary'), true);
    assert.equal(mixedBenchAndPull.has('accessory'), false,
      'the closest direct relationship wins in a mixed-family session');
    const accessoryCandidates = routineMovements.filter((movement) =>
      routineRoleEligibility.accessory.has(movement.movementId));
    assert.deepEqual(rankRoutineAccessoryRecommendations({
      majorMovementIds: [benchId], selectedMovementIds: [benchId], candidates: accessoryCandidates,
      allMovements: routineMovements, liftFamilies, assistance, objective: 'hypertrophy',
      remainingMinutes: 3, remainingFatigue: 5,
    }), []);
    const ranked = rankRoutineAccessoryRecommendations({
      majorMovementIds: [benchId], selectedMovementIds: [benchId], candidates: accessoryCandidates,
      allMovements: routineMovements, liftFamilies, assistance, objective: 'hypertrophy',
      remainingMinutes: 20, remainingFatigue: 5,
    });
    assert.ok(ranked.length > 0 && ranked.length <= 3);
    assert.ok(ranked.every((row) => row.distance >= 2));
    const mixedRanked = rankRoutineAccessoryRecommendations({
      majorMovementIds: [benchId, rowId], selectedMovementIds: [benchId, rowId],
      candidates: accessoryCandidates, allMovements: routineMovements,
      liftFamilies, assistance, objective: 'hypertrophy',
      remainingMinutes: 20, remainingFatigue: 5,
    });
    assert.equal(mixedRanked.some((row) => row.movementId === hammerId), false,
      'direct pull assistance must not be reintroduced as a bench accessory');
  });

  check('genuine Beginner, availability, contextual-role, and missing-family blockers remain fail closed', () => {
    const benchId = idOf('Competition Bench');
    const hammerId = idOf('Hammer Curl');
    const selection = [{
      dayIndex: 1, slotIndex: 1, movementId: benchId, role: 'major', sets: 3, reps: 5, targetRpe: 8,
    }];
    assert.ok(composeReal(selection, { trainingAge: 'beginner' }).blockers.some((row) => row.includes('Beginner stage')));
    assert.ok(composeReal(selection, { availableMovementIds: new Set() }).blockers.some((row) => row.includes('unavailable')));
    assert.ok(composeReal([...selection, {
      dayIndex: 1, slotIndex: 2, movementId: hammerId, role: 'supplementary', sets: 2, reps: 10, targetRpe: 7,
    }]).blockers.some((row) => row.includes('not supplementary-eligible')));
    assert.ok(composeReal(selection, { liftFamilies: [] }).blockers.some((row) => row.includes('no curated lift-family')));
  });

  check('the routine picker derives its role sets from the database, not hardcoded names', () => {
    const builder = readFileSync(
      join(root, 'apps', 'mobile', 'src', 'components', 'RoutineTemplateBuilder.tsx'), 'utf-8');
    const store = readFileSync(join(root, 'apps', 'mobile', 'src', 'state', 'useStore.ts'), 'utf-8');
    assert.ok(builder.includes('getRoutineRoleEligibleMovementIds()'),
      'the picker must read the DB-derived role sets');
    assert.ok(builder.includes("contextualRolesFor(movement.movement_id).has(pickerRole)"),
      'contextual role eligibility must be the picker\'s first predicate');
    assert.ok(builder.includes('getRoutinePlanningContract()'),
      'the picker must read the curated family and assistance-distance contract');
    assert.ok(store.includes("'SELECT movement_id, role FROM movement_role_eligibility ORDER BY role, movement_id'"),
      'the store must derive role eligibility from movement_role_eligibility');
    for (const name of [...CONFIRMABLE, ...COMPETITION, CONTROL, 'Power Clean']) {
      assert.ok(!builder.includes(name), `the picker must not hardcode "${name}"`);
    }
    // Nor may the picker hardcode the counts the database owns.
    assert.ok(!/\b(major|conditional)\s*:\s*(8|12)\b/.test(builder));
  });
}

console.log(`pipeline verification: ${pass} checks passed`);
if (process.exitCode) process.exit(process.exitCode);
