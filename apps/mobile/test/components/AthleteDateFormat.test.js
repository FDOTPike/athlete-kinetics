/**
 * Issue #156: athlete-facing dates use one format, in the device locale.
 * Locales are passed explicitly so the expected text does not depend on the PC.
 */
import { formatAthleteDate, formatAthleteDateTime } from '../../src/state/athleteDate';

test('a calendar day (YYYY-MM-DD) reads as that day, never shifted by the time zone', () => {
  expect(formatAthleteDate('2026-11-03', 'en-US')).toBe('Tue, Nov 3, 2026');
  expect(formatAthleteDate('2026-11-03', 'en-GB')).toContain('3 Nov 2026');
});

test('a timestamp reads as its local calendar day', () => {
  expect(formatAthleteDate(new Date(2026, 10, 3, 1, 52).getTime(), 'en-US')).toBe('Tue, Nov 3, 2026');
});

test('date and time share the same date text and add the local time', () => {
  expect(formatAthleteDateTime(new Date(2026, 10, 3, 1, 52, 43).getTime(), 'en-US')).toMatch(/^Tue, Nov 3, 2026, 1:52\s[AP]M$/);
});

test('a value that is not a date says so with a dash, never "Invalid Date"', () => {
  expect(formatAthleteDate('not a date', 'en-US')).toBe('—');
  expect(formatAthleteDateTime('not a date', 'en-US')).toBe('—');
});
