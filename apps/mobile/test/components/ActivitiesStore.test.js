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
    }, 2500);
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
    }, 2600)).toThrow('cannot be relabelled');
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
    }, 3000);

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

  test('changes a planned occurrence through explicit completed, missed, and cancelled paths', () => {
    const db = database();
    const planned = (name, atMs) => saveOneOffActivity(db, {
      kindId: 'walking', displayName: name, demand: 'low', facilityCode: null, equipmentCode: null,
      localDate: '2026-09-13', localStartMinute: null, timezoneId: 'Australia/Sydney',
      timing: 'flexible', state: 'planned', modalityId: 'unknown', purposeId: 'recreation',
      expectedDurationMin: 30, expectedEffort: null, actualDurationMin: null, actualEffort: null,
    }, atMs);

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
    }, 9001)).toThrow('Enter a real calendar date.');
    expect(() => saveOneOffActivity(db, {
      ...base, localDate: '2026-09-13', localStartMinute: 1020, timezoneId: 'UTC',
      timing: 'fixed', state: 'planned', modalityId: 'unknown', purposeId: 'unknown',
      expectedDurationMin: null, expectedEffort: null, actualDurationMin: null, actualEffort: null,
    }, 9002)).toThrow('needs a duration so its end time is not guessed');
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
});
