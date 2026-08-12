'use strict';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { resolveMovementAvailability } = require('./.build/capabilityResolver.js');
const { isDifficultyAllowed } = require('./.build/tierPolicy.js');
const { parseHistoryImport, HISTORY_IMPORT_EXAMPLE } = require('./.build/historyImport.js');
const { composeRoutine, isRoutineRoleSnapshotExecutable } = require('./.build/routineComposer.js');
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
console.log(`pipeline verification: ${pass} checks passed`);
if (process.exitCode) process.exit(process.exitCode);
