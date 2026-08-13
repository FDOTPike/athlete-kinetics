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
  ROUTINE_DAY_ROLE_MAXIMA,
  ROUTINE_TEMPLATE_MAX_SLOTS,
} = require('./.build/routineComposer.js');
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
    major: new Set([1]), supplementary: new Set([2]), conditional: new Set([3]),
  };
  const source = [
    { movementId: 1, role: 'major' },
    { movementId: 2, role: 'supplementary' },
  ];
  assert.equal(isRoutineRoleSnapshotExecutable([1, 2], source, eligible), true);
  assert.equal(isRoutineRoleSnapshotExecutable([1, 2], source, { ...eligible, major: new Set() }), false);
  assert.equal(isRoutineRoleSnapshotExecutable([1, 999], source, eligible), false);
  assert.equal(isRoutineRoleSnapshotExecutable([1], [...source, { movementId: 1, role: 'supplementary' }], eligible), false);
  assert.equal(isRoutineRoleSnapshotExecutable([2], source, eligible), false);
});
// --- P2-2: per-day routine role accounting -----------------------------------
// A routine template may hold several days; each populated day is one
// executable session. Role maxima and the sole-major law are therefore per
// day, while the slot ceiling and movement identity stay template-wide.
const placement = (dayIndex, slotIndex, movementId, role) => ({ dayIndex, slotIndex, movementId, role });
const twoDayTemplate = [
  placement(1, 1, 1, 'major'),
  placement(1, 2, 2, 'supplementary'),
  placement(2, 1, 3, 'major'),
  placement(2, 2, 4, 'supplementary'),
];
check('a two-day template with one major on each day is accepted and grouped in day order', () => {
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
    /Routine day 2 must contain exactly one major movement\./,
  );
  assert.throws(
    () => groupRoutineTemplateDays([
      placement(1, 1, 1, 'supplementary'),
      placement(2, 1, 3, 'major'),
    ]),
    /Routine day 1 must contain exactly one major movement\./,
  );
});
check('more than one major inside a single day is refused even across a valid sibling day', () => {
  assert.throws(
    () => groupRoutineTemplateDays([
      placement(1, 1, 1, 'major'),
      placement(2, 1, 3, 'major'),
      placement(2, 2, 4, 'major'),
    ]),
    /A routine day supports at most 1 major movement\./,
  );
  assert.equal(ROUTINE_DAY_ROLE_MAXIMA.major, 1);
  // The same budget is per day for the other roles too: three supplementary
  // slots across two days is fine, three inside one day is not.
  assert.doesNotThrow(() => groupRoutineTemplateDays([
    placement(1, 1, 1, 'major'), placement(1, 2, 2, 'supplementary'), placement(1, 3, 5, 'supplementary'),
    placement(2, 1, 3, 'major'), placement(2, 2, 4, 'supplementary'),
  ]));
  assert.throws(
    () => groupRoutineTemplateDays([
      placement(1, 1, 1, 'major'), placement(1, 2, 2, 'supplementary'),
      placement(1, 3, 5, 'supplementary'), placement(1, 4, 6, 'supplementary'),
    ]),
    /A routine day supports at most 2 supplementary movements\./,
  );
});
check('the template-wide slot ceiling and movement identity survive multi-day support', () => {
  assert.equal(ROUTINE_TEMPLATE_MAX_SLOTS, 6);
  assert.throws(() => groupRoutineTemplateDays([]), /between 1 and 6 movements/);
  assert.throws(
    () => groupRoutineTemplateDays([
      placement(1, 1, 1, 'major'), placement(1, 2, 2, 'supplementary'), placement(1, 3, 5, 'supplementary'),
      placement(2, 1, 3, 'major'), placement(2, 2, 4, 'supplementary'), placement(2, 3, 6, 'supplementary'),
      placement(3, 1, 7, 'major'),
    ]),
    /between 1 and 6 movements/,
  );
  // Identity is template-wide, NOT per day: the start-time snapshot carries no
  // day index, so one movement on two days would be unverifiable at start.
  assert.throws(
    () => groupRoutineTemplateDays([
      placement(1, 1, 1, 'major'),
      placement(2, 1, 1, 'major'),
    ]),
    /A movement can appear only once in a routine template\./,
  );
  assert.throws(
    () => groupRoutineTemplateDays([placement(1, 1, 1, 'major'), placement(1, 1, 2, 'supplementary')]),
    /Routine slot positions must be unique\./,
  );
  assert.throws(
    () => groupRoutineTemplateDays([placement(8, 1, 1, 'major')]),
    /supported 1-7 \/ 1-6 bounds/,
  );
});
check('each populated day composes independently against its own role budget', () => {
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
  // Composing both days as one selection list is exactly the defect P2-2
  // reports: the second major is dropped with a "too many" warning.
  const merged = composeRoutine({
    selections: twoDayTemplate.map((slot) => ({ movementId: slot.movementId, role: slot.role })),
    schemaType: 'LINEAR', objective: 'strength', trainingAge: 'intermediate',
    durationCapMin: 66, baseRpeCap: 9, availableMovementIds: new Set([1, 2, 3, 4]),
  });
  assert.ok(merged.warnings.some((warning) => warning.includes('Too many major')));
});
check('starting day 2 revalidates only that day and still fails closed on role drift', () => {
  const sourceRows = twoDayTemplate.map((slot) => ({ movementId: slot.movementId, role: slot.role }));
  const eligible = {
    major: new Set([1, 3]), supplementary: new Set([2, 4]), conditional: new Set(),
  };
  const dayOne = [1, 2];
  const dayTwo = [3, 4];
  assert.equal(isRoutineRoleSnapshotExecutable(dayTwo, sourceRows, eligible), true);
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
check('routine composer uses shared eligibility, role maxima, duration, and RPE cap', () => {
  const result = composeRoutine({ selections: [{ movementId: 1, role: 'major' }, { movementId: 2, role: 'major' }, { movementId: 3, role: 'supplementary' }], schemaType: 'LINEAR', objective: 'strength', trainingAge: 'beginner', durationCapMin: 30, baseRpeCap: 7, availableMovementIds: new Set([1, 2]) });
  assert.equal(result.slots.length, 1); assert.ok(result.slots.every((slot) => slot.targetRpe <= 7)); assert.ok(result.warnings.length >= 2);
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
// library from migrations 001-051 and pins the ratified records BY NAME, so a
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

  check('the acceptance database is the real 001-051 chain, not a trimmed subset', () => {
    assert.equal(fullChain[0], '001_mechanical_input.sql');
    assert.equal(fullChain[fullChain.length - 1], '051_routine_access_context.sql');
    assert.equal(fullChain.length, 50, `applied ${fullChain.length} migrations`);
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

  check('the DB-derived role sets hold exactly eight major and twelve conditional rows', () => {
    const counts = Object.fromEntries(db.prepare(
      'SELECT role, COUNT(*) AS c FROM movement_role_eligibility GROUP BY role',
    ).all().map((row) => [row.role, Number(row.c)]));
    assert.equal(counts.major, 8);
    assert.equal(counts.conditional, 12);
    assert.equal(counts.supplementary, 300);
    const majors = db.prepare(`SELECT m.name FROM movement_role_eligibility re
      JOIN movement m USING(movement_id) WHERE re.role = 'major' ORDER BY m.name`).all().map((row) => row.name);
    assert.deepEqual(majors, [
      'Barbell Row', 'Competition Bench', 'Competition Squat', 'Deadlift',
      'Front Squat', 'Overhead Press', 'Power Clean', 'Sumo Deadlift',
    ]);
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

  check('the routine picker derives its role sets from the database, not hardcoded names', () => {
    const builder = readFileSync(
      join(root, 'apps', 'mobile', 'src', 'components', 'RoutineTemplateBuilder.tsx'), 'utf-8');
    const store = readFileSync(join(root, 'apps', 'mobile', 'src', 'state', 'useStore.ts'), 'utf-8');
    assert.ok(builder.includes('getRoutineRoleEligibleMovementIds()'),
      'the picker must read the DB-derived role sets');
    assert.ok(builder.includes('roleEligibleSets[pickerRole].has(movement.movement_id)'),
      'role eligibility must be the picker\'s first predicate');
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
