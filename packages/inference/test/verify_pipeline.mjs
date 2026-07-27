'use strict';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { resolveMovementAvailability } = require('./.build/capabilityResolver.js');
const { parseHistoryImport, HISTORY_IMPORT_EXAMPLE } = require('./.build/historyImport.js');
const { composeRoutine } = require('./.build/routineComposer.js');
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
check('four method strategies are deterministic and distinct', () => {
  const base = { selections: [{ movementId: 1, role: 'major' }], objective: 'strength', trainingAge: 'intermediate', durationCapMin: 60, baseRpeCap: 9, availableMovementIds: new Set([1]) };
  const signatures = ['LINEAR', 'WAVE', 'STEP', 'APRE'].map((schemaType) => JSON.stringify(composeRoutine({ ...base, schemaType }).slots));
  assert.equal(new Set(signatures).size, 4);
  assert.deepEqual(composeRoutine({ ...base, schemaType: 'APRE' }), composeRoutine({ ...base, schemaType: 'APRE' }));
});
console.log(`pipeline verification: ${pass}/9 checks passed`);
if (process.exitCode) process.exit(process.exitCode);