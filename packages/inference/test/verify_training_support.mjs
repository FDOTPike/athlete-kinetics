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

assert.equal(evaluateTrainingSupport({ contractAvailable: true,
  target: { targetKind: 'activity_occurrence', occurrenceId: 'friday', activityId: 'swim' },
  holds: [hold('definition', 'instruction_unreviewed', [scope('s', 'activity_definition', { activityId: 'swim' })])],
}).status, 'held', 'definition scope follows its explicitly identified occurrence');
assert.equal(evaluateTrainingSupport({ contractAvailable: true,
  target: { targetKind: 'activity_occurrence', occurrenceId: 'friday', activityId: 'swim' },
  holds: [hold('definition', 'instruction_unreviewed', [scope('s', 'activity_definition', { activityId: 'walk' })])],
}).status, 'available', 'explicitly different definition proves disjointness');
assert.equal(evaluateTrainingSupport({ contractAvailable: true,
  target: { targetKind: 'activity_occurrence', occurrenceId: 'friday' },
  holds: [hold('definition', 'instruction_unreviewed', [scope('s', 'activity_definition', { activityId: 'swim' })])],
}).status, 'held', 'unknown parent identity cannot prove disjointness');

assert.deepEqual(evaluateTrainingSupport({ contractAvailable: true, target: { targetKind: 'all_prescription' },
  holds: ['z', 'ä', 'a', 'A'].map((id) => hold(id, 'review_requested', [])),
}).holdIds, ['A', 'a', 'z', 'ä'], 'decision identity ordering uses fixed code-unit order, not the device locale');

// Owner ruling on PR #17: explicit target-kind compatibility. A definition scope
// reaches its series and occurrences, a series scope its occurrences, an
// occurrence scope only itself, a movement scope only movements; other kind
// pairs are disjoint. The fail-closed rules above still come first.
const statusFor = (target, scopes) => evaluateTrainingSupport({
  contractAvailable: true,
  target,
  holds: [hold('h', 'instruction_unreviewed', scopes)],
}).status;
const definitionSwim = scope('s', 'activity_definition', { activityId: 'swim' });
const seriesFriday = scope('s', 'activity_series', { seriesId: 'friday' });
const occurrenceOne = scope('s', 'activity_occurrence', { occurrenceId: 'o1' });
const movementFive = scope('s', 'movement', { movementId: 5 });

// Compatible kinds with the same identity hold.
for (const [target, scopes, why] of [
  [{ targetKind: 'activity_definition', activityId: 'swim' }, [definitionSwim], 'definition -> definition'],
  [{ targetKind: 'activity_series', seriesId: 'friday', activityId: 'swim' }, [definitionSwim], 'definition -> series'],
  [{ targetKind: 'activity_occurrence', occurrenceId: 'o1', activityId: 'swim' }, [definitionSwim], 'definition -> occurrence'],
  [{ targetKind: 'activity_series', seriesId: 'friday' }, [seriesFriday], 'series -> series'],
  [{ targetKind: 'activity_occurrence', occurrenceId: 'o1', seriesId: 'friday' }, [seriesFriday], 'series -> occurrence'],
  [{ targetKind: 'activity_occurrence', occurrenceId: 'o1' }, [occurrenceOne], 'occurrence -> occurrence'],
  [{ targetKind: 'movement', movementId: 5 }, [movementFive], 'movement -> movement'],
]) assert.equal(statusFor(target, scopes), 'held', `compatible match holds: ${why}`);

// Compatible kinds with an explicitly different identity are disjoint.
for (const [target, scopes, why] of [
  [{ targetKind: 'activity_definition', activityId: 'walk' }, [definitionSwim], 'definition -> other definition'],
  [{ targetKind: 'activity_series', seriesId: 'friday', activityId: 'walk' }, [definitionSwim], 'definition -> series of another definition'],
  [{ targetKind: 'activity_series', seriesId: 'monday' }, [seriesFriday], 'series -> other series'],
  [{ targetKind: 'activity_occurrence', occurrenceId: 'o1', seriesId: 'monday' }, [seriesFriday], 'series -> occurrence of another series'],
  [{ targetKind: 'activity_occurrence', occurrenceId: 'o2' }, [occurrenceOne], 'occurrence -> other occurrence'],
  [{ targetKind: 'movement', movementId: 6 }, [movementFive], 'movement -> other movement'],
]) assert.equal(statusFor(target, scopes), 'available', `explicit mismatch is disjoint: ${why}`);

// Incompatible kinds are disjoint even when the target omits the scope's identifier.
for (const [target, scopes, why] of [
  [{ targetKind: 'movement', movementId: 5 }, [definitionSwim], 'definition -> movement'],
  [{ targetKind: 'movement', movementId: 5 }, [seriesFriday], 'series -> movement'],
  [{ targetKind: 'movement', movementId: 5 }, [occurrenceOne], 'occurrence -> movement'],
  [{ targetKind: 'activity_definition', activityId: 'swim' }, [movementFive], 'movement -> definition'],
  [{ targetKind: 'activity_series', seriesId: 'friday' }, [movementFive], 'movement -> series'],
  [{ targetKind: 'activity_occurrence', occurrenceId: 'o1' }, [movementFive], 'movement -> occurrence'],
  [{ targetKind: 'activity_definition', activityId: 'swim' }, [seriesFriday], 'series -> definition (parent)'],
  [{ targetKind: 'activity_definition', activityId: 'swim' }, [occurrenceOne], 'occurrence -> definition (parent)'],
  [{ targetKind: 'activity_series', seriesId: 'friday' }, [occurrenceOne], 'occurrence -> series (parent)'],
]) assert.equal(statusFor(target, scopes), 'available', `cross-kind scope is disjoint: ${why}`);

// Within a compatible hierarchy a missing parent identity cannot prove disjointness.
for (const [target, scopes, why] of [
  [{ targetKind: 'activity_series', seriesId: 'friday' }, [definitionSwim], 'series without its definition'],
  [{ targetKind: 'activity_occurrence', occurrenceId: 'o1' }, [seriesFriday], 'occurrence without its series'],
  [{ targetKind: 'activity_occurrence', occurrenceId: 'o1' }, [definitionSwim], 'occurrence without its definition'],
  [{ targetKind: 'movement' }, [movementFive], 'movement target without its identity'],
]) assert.equal(statusFor(target, scopes), 'held', `missing parent identity fails closed: ${why}`);

// Preserved safety rules: broad scopes and broad targets hold, and a malformed
// scope holds even against an otherwise incompatible target.
for (const [target, scopes, why] of [
  [{ targetKind: 'movement', movementId: 5 }, [scope('s', 'all_prescription')], 'all_prescription scope'],
  [{ targetKind: 'activity_occurrence', occurrenceId: 'o1' }, [scope('s', 'unresolved')], 'unresolved scope'],
  [{ targetKind: 'all_prescription' }, [movementFive], 'all_prescription target vs movement scope'],
  [{ targetKind: 'all_prescription' }, [occurrenceOne], 'all_prescription target vs occurrence scope'],
  [{ targetKind: 'activity_definition', activityId: 'swim' }, [scope('s', 'movement')], 'malformed movement scope vs definition'],
  [{ targetKind: 'movement', movementId: 5 }, [scope('s', 'activity_series')], 'malformed series scope vs movement'],
]) assert.equal(statusFor(target, scopes), 'held', `preserved fail-closed rule: ${why}`);

console.log('verify_training_support PASS — unavailable fails closed, scopes follow identity, unresolved is athlete-wide, withdrawal is explicit, incompatible target kinds are disjoint');
