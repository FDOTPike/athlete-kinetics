/**
 * Athlete-facing dates (issue #156): one format everywhere, in the device
 * locale, for example "Tue, Nov 3, 2026" in en-US or "Tue 3 Nov 2026" in en-GB.
 * ISO strings belong in files and logs, not on screen.
 */

export type AthleteDateInput = string | number | Date;

const DATE_FORMAT: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A YYYY-MM-DD string is a calendar day: read it as local midnight, never as UTC. */
const toDate = (value: AthleteDateInput): Date => {
  if (typeof value === 'string' && ISO_DAY.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year!, month! - 1, day!);
  }
  return value instanceof Date ? value : new Date(value);
};

/** "Tue, Nov 3, 2026" in the device locale; "—" when the value is not a date. */
export const formatAthleteDate = (value: AthleteDateInput, locale?: string): string => {
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(locale, DATE_FORMAT);
};

/** The same date, then the local time: "Tue, Nov 3, 2026, 1:52 AM". */
export const formatAthleteDateTime = (value: AthleteDateInput, locale?: string): string => {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString(locale, DATE_FORMAT)}, ${date.toLocaleTimeString(locale, TIME_FORMAT)}`;
};
