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

// Migration 064 forbids a targeted scope without its identifier, but this is an
// exported boundary: a malformed scope must hold, never be silently skipped.
for (const target of [
  { targetKind: 'activity_definition', activityId: 'walk' },
  { targetKind: 'activity_series', seriesId: 'friday' },
  { targetKind: 'activity_occurrence', occurrenceId: 'friday-2026-09-18' },
  { targetKind: 'movement', movementId: 7 },
]) {
  assert.equal(evaluateTrainingSupport({
    contractAvailable: true,
    target,
    holds: [hold('malformed', 'instruction_unreviewed', [scope('sx', target.targetKind)])],
  }).status, 'held', `a ${target.targetKind} scope missing its identifier fails closed`);
}
assert.equal(evaluateTrainingSupport({
  contractAvailable: true,
  target: { targetKind: 'movement', movementId: 7 },
  holds: [hold('malformed', 'instruction_unreviewed', [scope('sx', 'activity_definition')])],
}).status, 'held', 'a malformed scope is unresolved, so it holds athlete-wide rather than only its own kind');

console.log('verify_training_support PASS — unavailable fails closed, scopes are exact, unresolved is athlete-wide, withdrawal is explicit');

