import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { evaluateTrainingSupport } = require('./.build/trainingSupport.js');

const scope = (scopeId, targetKind, ids = {}) => ({
  scopeId,
  targetKind,
  activityId: ids.activityId ?? null,
  seriesId: ids.seriesId ?? null,
  occurrenceId: ids.occurrenceId ?? null,
  movementId: ids.movementId ?? null,
});
const hold = (holdId, reasonCode, scopes, state = 'held') => ({
  holdId,
  revision: 1,
  origin: 'instruction_review',
  state,
  reasonCode,
  scopes,
});

assert.deepEqual(evaluateTrainingSupport({
  contractAvailable: false,
  target: { targetKind: 'all_prescription' },
  holds: [],
}), { status: 'support_unavailable', holdIds: [] });

assert.deepEqual(evaluateTrainingSupport({
  contractAvailable: true,
  target: { targetKind: 'movement', movementId: 10 },
  holds: [],
}), { status: 'available', holdIds: [] });

assert.deepEqual(evaluateTrainingSupport({
  contractAvailable: true,
  target: { targetKind: 'activity_occurrence', occurrenceId: 'friday-basketball' },
  holds: [
    hold('withdrawn', 'review_requested', [scope('sw', 'all_prescription')], 'withdrawn'),
    hold('other-sport', 'instruction_unreviewed', [scope('so', 'activity_occurrence', { occurrenceId: 'monday-swim' })]),
  ],
}), { status: 'available', holdIds: [] }, 'withdrawn and proven-disjoint holds do not block factual unrelated work');

assert.deepEqual(evaluateTrainingSupport({
  contractAvailable: true,
  target: { targetKind: 'activity_occurrence', occurrenceId: 'friday-basketball' },
  holds: [
    hold('z-hold', 'conflict_reported', [scope('s1', 'activity_occurrence', { occurrenceId: 'friday-basketball' })]),
    hold('a-hold', 'scope_unknown', [scope('s2', 'unresolved')]),
  ],
}), {
  status: 'held',
  holdIds: ['a-hold', 'z-hold'],
  reasonCodes: ['conflict_reported', 'scope_unknown'],
}, 'matching and unresolved scopes form a deterministic union');

assert.equal(evaluateTrainingSupport({
  contractAvailable: true,
  target: { targetKind: 'movement', movementId: 42 },
  holds: [hold('movement', 'instruction_unreviewed', [scope('sm', 'movement', { movementId: 42 })])],
}).status, 'held');
assert.equal(evaluateTrainingSupport({
  contractAvailable: true,
  target: { targetKind: 'movement', movementId: 43 },
  holds: [hold('movement', 'instruction_unreviewed', [scope('sm', 'movement', { movementId: 42 })])],
}).status, 'available');

assert.equal(evaluateTrainingSupport({
  contractAvailable: true,
  target: { targetKind: 'activity_definition', activityId: 'walk' },
  holds: [hold('missing-scope', 'scope_unknown', [])],
}).status, 'held', 'a hold without an explicit scope fails closed athlete-wide');

console.log('verify_training_support PASS — unavailable fails closed, scopes are exact, unresolved is athlete-wide, withdrawal is explicit');

