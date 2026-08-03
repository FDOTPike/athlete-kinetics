'use strict';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { resolveMovementAvailability } = require('./.build/capabilityResolver.js');
const { parseHistoryImport, HISTORY_IMPORT_EXAMPLE } = require('./.build/historyImport.js');
const { composeRoutine } = require('./.build/routineComposer.js');
const { projectChainsFromGraph } = require('./.build/chainProjection.js');
let pass = 0;
const check = (name, fn) => { try { fn(); console.log(`  PASS ${name}`); pass += 1; } catch (error) { console.error(`  FAIL ${name}: ${error.message}`); process.exitCode = 1; } };
const movements = [
  { movementId: 1, difficulty: 'Beginner', beginnerOk: false, requiredEquipment: [] },
  { movementId: 2, difficulty: 'Intermediate', beginnerOk: true, requiredEquipment: [] },
  { movementId: 3, difficulty: 'Advanced', beginnerOk: false, requiredEquipment: ['Barbell'] },
  { movementId: 4, difficulty: 'Beginner', beginnerOk: false, requiredEquipment: [] },
];
const edge = { prerequisiteMovementId: 1, movementId: 2, relationship: 'prerequisite', minSessions: 2, minSetsPerSession: 3, minValue: 5, valueKind: 'reps', maxRpe: 8, requiresAttestation: true };
const evidence = [
  { movementId: 1, sessionId: 10, qualifyingSets: 3, minimumValue: 5, maximumRpe: 8, verified: true },
  { movementId: 1, sessionId: 11, qualifyingSets: 3, minimumValue: 5, maximumRpe: 7.5, verified: true },
];
const resolve = (over = {}) => resolveMovementAvailability({ movements, edges: [edge], evidence, attestedEdgeKeys: new Set(['1:2']), trainingAge: 'beginner', equipment: new Set(), safetyExcludedMovementIds: new Set(), ...over });
check('resolver is deterministic and ordered', () => assert.deepEqual(resolve(), resolve()));
check('tier, equipment, and safety remain outer gates', () => {
  const result = resolve({ safetyExcludedMovementIds: new Set([4]) });
  assert.deepEqual(result.find((row) => row.movementId === 3).reasons, ['tier', 'equipment']);
  assert.deepEqual(result.find((row) => row.movementId === 4).reasons, ['safety']);
});
check('verified distinct sessions and attestation clear a prerequisite', () => assert.equal(resolve().find((row) => row.movementId === 2).state, 'available'));
check('unverified evidence cannot advance capability', () => assert.equal(resolve({ evidence: evidence.map((row) => ({ ...row, verified: false })) }).find((row) => row.movementId === 2).state, 'teaching_only'));
check('RPE ceiling and attestation are enforced', () => {
  assert.equal(resolve({ attestedEdgeKeys: new Set() }).find((row) => row.movementId === 2).state, 'teaching_only');
  assert.equal(resolve({ evidence: evidence.map((row) => ({ ...row, maximumRpe: 9 })) }).find((row) => row.movementId === 2).state, 'teaching_only');
  assert.equal(resolve({ attestedEdgeKeys: new Set(['1:2']) }).find((row) => row.movementId === 2).state, 'available');
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
console.log(`pipeline verification: ${pass}/13 checks passed`);
if (process.exitCode) process.exit(process.exitCode);


