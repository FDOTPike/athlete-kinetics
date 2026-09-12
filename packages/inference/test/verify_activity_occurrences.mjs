import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  indexExplicitActivitySources,
  summarizeCompletedActivities,
} = require('./.build/activityOccurrences.js');
const { ACTIVITY_KIND_IDS } = require('./.build/accessibleCoachContract.js');

const occurrence = (occurrenceId, state = 'planned') => ({
  occurrenceId,
  activityId: 'activity-1',
  seriesId: null,
  originalRecurrenceKey: null,
  originKind: 'manual',
  originIdentity: `manual:${occurrenceId}`,
  originSessionId: null,
  revision: 1,
  localDate: '2026-09-13',
  localStartMinute: null,
  timezoneId: 'Australia/Sydney',
  resolutionState: 'unresolved',
  resolvedStartAtMs: null,
  resolvedEndAtMs: null,
  resolverVersion: null,
  state,
  timing: 'flexible',
  expectedDurationMin: null,
  expectedEffort: null,
});

const completion = (occurrenceId, duration, effort) => ({
  occurrenceId,
  state: 'completed',
  actualStartAtMs: null,
  actualEndAtMs: null,
  actualDurationMin: duration,
  actualEffort: effort,
  effortScaleId: effort === null ? null : 'whole_session_effort_1_10',
  effortScaleVersion: effort === null ? null : 1,
  effortReportedAtMs: effort === null ? null : 1000,
  recordedAtMs: 1000,
  provenance: 'user_reported',
});

assert.deepEqual(ACTIVITY_KIND_IDS, [
  'walking', 'running', 'swimming', 'cycling', 'strength_training',
  'basketball', 'soccer', 'netball', 'rugby', 'cricket', 'field_hockey',
  'volleyball', 'wheelchair_mobility', 'wheelchair_sport', 'custom',
]);

const summary = summarizeCompletedActivities({
  occurrences: [
    occurrence('walk', 'completed'),
    occurrence('swim', 'completed'),
    occurrence('cancelled', 'cancelled'),
    occurrence('missing-report', 'missed'),
    occurrence('future', 'planned'),
  ],
  completions: [completion('walk', 35, null), completion('swim', null, 7)],
});
assert.deepEqual(summary, {
  completedOccurrenceCount: 2,
  knownDurationMin: 35,
  unknownDurationCount: 1,
  knownEffortCount: 1,
  excludedOccurrenceCount: 3,
});

assert.deepEqual(
  summarizeCompletedActivities({
    occurrences: [occurrence('reported-complete', 'completed')],
    completions: [],
  }),
  {
    completedOccurrenceCount: 1,
    knownDurationMin: 0,
    unknownDurationCount: 1,
    knownEffortCount: 0,
    excludedOccurrenceCount: 0,
  },
  'missing completion detail stays unknown rather than becoming rest or zero-duration work',
);

assert.throws(
  () => summarizeCompletedActivities({
    occurrences: [occurrence('same'), occurrence('same')],
    completions: [],
  }),
  /duplicate activity occurrence/,
);
assert.throws(
  () => summarizeCompletedActivities({ occurrences: [], completions: [completion('orphan', 20, 4)] }),
  /has no occurrence/,
);

const sources = indexExplicitActivitySources([
  { occurrenceId: 'basketball-friday', sourceKind: 'manual', sourceIdentity: 'manual-1' },
  { occurrenceId: 'basketball-friday', sourceKind: 'imported', sourceIdentity: 'vendor-7' },
]);
assert.equal(sources.size, 2);
assert.equal(sources.get('manual:manual-1'), 'basketball-friday');
assert.equal(sources.get('imported:vendor-7'), 'basketball-friday');
assert.throws(
  () => indexExplicitActivitySources([
    { occurrenceId: 'first', sourceKind: 'imported', sourceIdentity: 'vendor-7' },
    { occurrenceId: 'second', sourceKind: 'imported', sourceIdentity: 'vendor-7' },
  ]),
  /activity source already linked/,
  'the same source can never be fuzzily or accidentally assigned to two occurrences',
);

console.log('verify_activity_occurrences PASS — 15-kind log-only taxonomy, nullable effort, explicit identity, one-count accounting');
