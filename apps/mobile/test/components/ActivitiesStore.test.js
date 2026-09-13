import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  completeActivityOccurrence,
  endActivitySeries,
  readActivityLedger,
  saveOneOffActivity,
  saveWeeklyActivity,
  setActivityOccurrenceState,
} from '../../src/state/activityStore';

const schema = readFileSync(
  join(__dirname, '..', '..', '..', '..', 'packages', 'core-db', 'src', 'schema', '064_accessible_coach_support.sql'),
  'utf8',
);

const database = () => {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys=ON');
  raw.exec('CREATE TABLE session (session_id INTEGER PRIMARY KEY) STRICT');
  raw.exec('CREATE TABLE movement (movement_id INTEGER PRIMARY KEY) STRICT');
  raw.exec(schema);
  return {
    raw,
    executeSync(sql, params = []) {
      if (/^\s*(SELECT|PRAGMA)/i.test(sql)) {
        return { rows: raw.prepare(sql).all(...params) };
      }
      raw.prepare(sql).run(...params);
      return { rows: [] };
    },
  };
};

const base = {
  kindId: 'swimming',
  displayName: 'Friday swim',
  demand: 'unknown',
  facilityCode: 'pool',
  equipmentCode: null,
};

describe('WO-05 activity store adapter', () => {
  test('saves and edits a fixed weekly commitment without materialising or inferring work', () => {
    const db = database();
    const seriesId = saveWeeklyActivity(db, {
      ...base,
      localWeekday: 5,
      localStartMinute: 17 * 60,
      timezoneId: 'Australia/Sydney',
      timing: 'fixed',
      expectedDurationMin: 60,
      expectedEffort: null,
      effectiveStartDate: '2026-09-13',
    }, 1000);

    let facts = readActivityLedger(db, '2026-09-13');
    expect(facts.definitions).toEqual([expect.objectContaining({
      kindId: 'swimming', displayName: 'Friday swim', facilities: ['pool'], equipment: [],
    })]);
    expect(facts.series).toEqual([expect.objectContaining({
      seriesId, localWeekday: 5, localStartMinute: 1020, timing: 'fixed', revision: 1,
    })]);
    expect(facts.occurrences).toHaveLength(0);
    expect(facts.scheduledKnownMinutesPerWeek).toBe(60);

    const activityId = facts.definitions[0].activityId;
    saveWeeklyActivity(db, {
      ...base,
      activityId,
      seriesId,
      displayName: 'Friday pool session',
      localWeekday: 5,
      localStartMinute: 17 * 60,
      timezoneId: 'Australia/Sydney',
      timing: 'fixed',
      expectedDurationMin: 75,
      expectedEffort: 6.5,
      effectiveStartDate: '2026-09-13',
    }, 2000);
    facts = readActivityLedger(db, '2026-09-13');
    expect(facts.series[0]).toEqual(expect.objectContaining({
      revision: 2, expectedDurationMin: 75, expectedEffort: 6.5,
    }));
    expect(facts.definitions[0].displayName).toBe('Friday pool session');
    expect(facts.scheduledKnownMinutesPerWeek).toBe(75);

    saveOneOffActivity(db, {
      ...base,
      activityId,
      displayName: 'Friday pool session',
      localDate: '2026-09-13',
      localStartMinute: null,
      timezoneId: 'Australia/Sydney',
      timing: 'flexible',
      state: 'completed',
      modalityId: 'unknown',
      purposeId: 'practice',
      expectedDurationMin: null,
      expectedEffort: null,
      actualDurationMin: 40,
      actualEffort: null,
    }, 2500, '2026-09-13');
    facts = readActivityLedger(db, '2026-09-13');
    expect(facts.definitions).toHaveLength(1);
    expect(facts.definitions[0].facilities).toEqual(['pool']);
    expect(facts.occurrences).toHaveLength(1);
    expect(() => saveOneOffActivity(db, {
      ...base,
      activityId,
      kindId: 'running',
      localDate: '2026-09-13',
      localStartMinute: null,
      timezoneId: 'Australia/Sydney',
      timing: 'flexible',
      state: 'completed',
      modalityId: 'unknown',
      purposeId: 'recreation',
      expectedDurationMin: null,
      expectedEffort: null,
      actualDurationMin: 10,
      actualEffort: null,
    }, 2600, '2026-09-13')).toThrow('cannot be relabelled');
  });

  test('records a custom completion once and preserves unknown effort', () => {
    const db = database();
    const occurrenceId = saveOneOffActivity(db, {
      kindId: 'custom',
      displayName: 'Hobby horsing',
      demand: 'unknown',
      facilityCode: null,
      equipmentCode: null,
      localDate: '2026-09-13',
      localStartMinute: null,
      timezoneId: 'Australia/Sydney',
      timing: 'flexible',
      state: 'completed',
      modalityId: 'unknown',
      purposeId: 'recreation',
      expectedDurationMin: null,
      expectedEffort: null,
      actualDurationMin: 35,
      actualEffort: null,
    }, 3000, '2026-09-13');

    const facts = readActivityLedger(db, '2026-09-13');
    expect(facts.occurrences).toEqual([expect.objectContaining({
      occurrenceId,
      displayName: 'Hobby horsing',
      state: 'completed',
      actualDurationMin: 35,
      actualEffort: null,
      purposeId: 'recreation',
    })]);
    expect(facts.completedLast28Days).toBe(1);
    expect(facts.knownMinutesLast28Days).toBe(35);
    expect(facts.completedWithUnknownDuration).toBe(0);
  });

  test('rejects future completed or missed facts against an explicit current local day', () => {
    const db = database();
    const oneOff = (state, localDate, atMs) => saveOneOffActivity(db, {
      ...base,
      localDate,
      localStartMinute: null,
      timezoneId: 'Australia/Sydney',
      timing: 'flexible',
      state,
      modalityId: 'unknown',
      purposeId: 'recreation',
      expectedDurationMin: state === 'completed' ? null : 30,
      expectedEffort: null,
      actualDurationMin: state === 'completed' ? 30 : null,
      actualEffort: null,
    }, atMs, '2026-09-13');

    // atMs is deliberately unrelated to the asserted local day: the adapter
    // must use the explicit athlete-local boundary rather than fixture prose
    // or an epoch timestamp that happens to be convenient.
    expect(() => oneOff('completed', '2026-09-14', 1)).toThrow(/future/i);
    expect(() => oneOff('missed', '2026-09-14', 2)).toThrow(/future/i);
    expect(readActivityLedger(db, '2026-09-13').occurrences).toHaveLength(0);

    expect(() => oneOff('completed', '2026-09-13', 3)).not.toThrow();
    expect(() => oneOff('missed', '2026-09-13', 4)).not.toThrow();
    expect(() => oneOff('planned', '2026-09-14', 5)).not.toThrow();
  });

  test('preserves exact optional effort values and the accepted endpoints', () => {
    const db = database();
    const seriesId = saveWeeklyActivity(db, {
      ...base,
      localWeekday: 5,
      localStartMinute: null,
      timezoneId: 'Australia/Sydney',
      timing: 'flexible',
      expectedDurationMin: null,
      expectedEffort: 6.37,
      effectiveStartDate: '2026-09-13',
    }, 3100);
    const activityId = readActivityLedger(db, '2026-09-13').definitions[0].activityId;
    const exactId = saveOneOffActivity(db, {
      ...base,
      activityId,
      localDate: '2026-09-13',
      localStartMinute: null,
      timezoneId: 'Australia/Sydney',
      timing: 'flexible',
      state: 'completed',
      modalityId: 'unknown',
      purposeId: 'recreation',
      expectedDurationMin: null,
      expectedEffort: null,
      actualDurationMin: null,
      actualEffort: 7.125,
    }, 3200, '2026-09-13');
    const lowId = saveOneOffActivity(db, {
      ...base,
      activityId,
      localDate: '2026-09-13',
      localStartMinute: null,
      timezoneId: 'Australia/Sydney',
      timing: 'flexible',
      state: 'completed',
      modalityId: 'unknown',
      purposeId: 'recreation',
      expectedDurationMin: null,
      expectedEffort: null,
      actualDurationMin: null,
      actualEffort: 1,
    }, 3201, '2026-09-13');
    const highId = saveOneOffActivity(db, {
      ...base,
      activityId,
      localDate: '2026-09-13',
      localStartMinute: null,
      timezoneId: 'Australia/Sydney',
      timing: 'flexible',
      state: 'completed',
      modalityId: 'unknown',
      purposeId: 'recreation',
      expectedDurationMin: null,
      expectedEffort: null,
      actualDurationMin: null,
      actualEffort: 10,
    }, 3202, '2026-09-13');

    const facts = readActivityLedger(db, '2026-09-13');
    expect(facts.series.find((row) => row.seriesId === seriesId)?.expectedEffort).toBe(6.37);
    expect(facts.occurrences.find((row) => row.occurrenceId === exactId)?.actualEffort).toBe(7.125);
    expect(facts.occurrences.find((row) => row.occurrenceId === lowId)?.actualEffort).toBe(1);
    expect(facts.occurrences.find((row) => row.occurrenceId === highId)?.actualEffort).toBe(10);
  });

  test('changes a planned occurrence through explicit completed, missed, and cancelled paths', () => {
    const db = database();
    const planned = (name, atMs) => saveOneOffActivity(db, {
      kindId: 'walking', displayName: name, demand: 'low', facilityCode: null, equipmentCode: null,
      localDate: '2026-09-13', localStartMinute: null, timezoneId: 'Australia/Sydney',
      timing: 'flexible', state: 'planned', modalityId: 'unknown', purposeId: 'recreation',
      expectedDurationMin: 30, expectedEffort: null, actualDurationMin: null, actualEffort: null,
    }, atMs, '2026-09-13');

    const completedId = planned('Walk', 4000);
    const missedId = planned('Missed walk', 4001);
    const cancelledId = planned('Cancelled walk', 4002);
    completeActivityOccurrence(db, { occurrenceId: completedId, actualDurationMin: null, actualEffort: 4 }, 5000);
    setActivityOccurrenceState(db, missedId, 'missed', 5001);
    setActivityOccurrenceState(db, cancelledId, 'cancelled', 5002);

    const facts = readActivityLedger(db, '2026-09-13');
    expect(facts.occurrences.map((row) => [row.displayName, row.state])).toEqual(expect.arrayContaining([
      ['Walk', 'completed'], ['Missed walk', 'missed'], ['Cancelled walk', 'cancelled'],
    ]));
    expect(facts.completedLast28Days).toBe(1);
    expect(facts.knownMinutesLast28Days).toBe(0);
    expect(facts.completedWithUnknownDuration).toBe(1);
    expect(() => setActivityOccurrenceState(db, completedId, 'cancelled', 6000))
      .toThrow('Only a planned activity can be changed.');
  });

  test('ends a weekly schedule without deleting its facts and fails closed on invalid inputs', () => {
    const db = database();
    const seriesId = saveWeeklyActivity(db, {
      ...base, localWeekday: 5, localStartMinute: 1020, timezoneId: 'Australia/Sydney',
      timing: 'fixed', expectedDurationMin: null, expectedEffort: null,
      effectiveStartDate: '2026-09-01',
    }, 7000);
    endActivitySeries(db, seriesId, '2026-09-13', 8000);
    expect(readActivityLedger(db, '2026-09-13').series[0].effectiveEndDate).toBe('2026-09-13');
    expect(() => saveWeeklyActivity(db, {
      ...base, localWeekday: 5, localStartMinute: null, timezoneId: 'Australia/Sydney',
      timing: 'fixed', expectedDurationMin: null, expectedEffort: null,
      effectiveStartDate: '2026-09-13',
    }, 9000)).toThrow('A fixed weekly activity needs a start time.');
    expect(() => saveOneOffActivity(db, {
      ...base, localDate: '2026-13-01', localStartMinute: null, timezoneId: 'Australia/Sydney',
      timing: 'flexible', state: 'completed', modalityId: 'unknown', purposeId: 'unknown',
      expectedDurationMin: null, expectedEffort: null, actualDurationMin: 30, actualEffort: null,
    }, 9001, '2026-09-13')).toThrow('Enter a real calendar date.');
    expect(() => saveOneOffActivity(db, {
      ...base, localDate: '2026-09-13', localStartMinute: 1020, timezoneId: 'UTC',
      timing: 'fixed', state: 'planned', modalityId: 'unknown', purposeId: 'unknown',
      expectedDurationMin: null, expectedEffort: null, actualDurationMin: null, actualEffort: null,
    }, 9002, '2026-09-13')).toThrow('needs a duration so its end time is not guessed');
  });

  test('editing a weekly schedule keeps the date the commitment actually began', () => {
    const db = database();
    const seriesId = saveWeeklyActivity(db, {
      ...base, localWeekday: 5, localStartMinute: 1020, timezoneId: 'Australia/Sydney',
      timing: 'fixed', expectedDurationMin: 60, expectedEffort: null,
      effectiveStartDate: '2026-09-01',
    }, 10000);
    const activityId = readActivityLedger(db, '2026-09-13').definitions[0].activityId;
    saveWeeklyActivity(db, {
      ...base, activityId, seriesId, displayName: 'Friday pool session',
      localWeekday: 5, localStartMinute: 1080, timezoneId: 'Australia/Sydney',
      timing: 'fixed', expectedDurationMin: 60, expectedEffort: null,
      effectiveStartDate: '2026-09-13',
    }, 11000);

    expect(readActivityLedger(db, '2026-09-13').series[0]).toEqual(expect.objectContaining({
      seriesId, revision: 2, localStartMinute: 1080, effectiveStartDate: '2026-09-01',
    }));
  });

  test('editing fails atomically when the weekly series does not exist', () => {
    const db = database();
    saveWeeklyActivity(db, {
      ...base, localWeekday: 5, localStartMinute: 1020, timezoneId: 'Australia/Sydney',
      timing: 'fixed', expectedDurationMin: 60, expectedEffort: null,
      effectiveStartDate: '2026-09-01',
    }, 12000);
    const original = readActivityLedger(db, '2026-09-13');
    const activityId = original.definitions[0].activityId;

    expect(() => saveWeeklyActivity(db, {
      ...base, activityId, seriesId: 'series-that-does-not-exist', displayName: 'Changed by failed edit',
      localWeekday: 6, localStartMinute: 1080, timezoneId: 'Australia/Sydney',
      timing: 'fixed', expectedDurationMin: 90, expectedEffort: 8,
      effectiveStartDate: '2026-09-13',
    }, 13000)).toThrow('Weekly activity was not found.');
    expect(readActivityLedger(db, '2026-09-13')).toEqual(original);
  });

  test('editing an ended weekly series fails and never reopens it', () => {
    const db = database();
    const seriesId = saveWeeklyActivity(db, {
      ...base, localWeekday: 5, localStartMinute: 1020, timezoneId: 'Australia/Sydney',
      timing: 'fixed', expectedDurationMin: 60, expectedEffort: null,
      effectiveStartDate: '2026-09-01',
    }, 14000);
    const activityId = readActivityLedger(db, '2026-09-13').definitions[0].activityId;
    endActivitySeries(db, seriesId, '2026-09-13', 15000);
    const ended = readActivityLedger(db, '2026-09-13');

    expect(() => saveWeeklyActivity(db, {
      ...base, activityId, seriesId, displayName: 'Changed by ended edit',
      localWeekday: 6, localStartMinute: 1080, timezoneId: 'Australia/Sydney',
      timing: 'fixed', expectedDurationMin: 90, expectedEffort: 8,
      effectiveStartDate: '2026-09-13',
    }, 16000)).toThrow('Weekly activity was not found.');
    expect(readActivityLedger(db, '2026-09-13')).toEqual(ended);
    expect(readActivityLedger(db, '2026-09-13').series[0].effectiveEndDate).toBe('2026-09-13');
  });
});
