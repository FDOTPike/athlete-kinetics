/**
 * offPlanStart — which planned session "Start a session anyway / now" opens
 * (#228). An off-plan start on a day with no session of its own takes the
 * athlete's plan forward instead of inventing a generic session:
 *
 *   1. the earliest session of the block that is dated before today and has
 *      not been finished (a missed session is caught up first);
 *   2. otherwise the next planned session after today;
 *   3. otherwise nothing: the caller keeps its free-form start.
 *
 * Pure: it reads the block's session summaries only. The session itself is
 * started by the store, through the same checks as any planned start.
 */
export interface OffPlanSessionSummary {
  readonly plannedSessionId: number;
  readonly focus: string;
  readonly sessionDate: string;
  readonly completionStatus: 'complete' | 'halted' | null;
}

export interface OffPlanStartTarget<T extends OffPlanSessionSummary = OffPlanSessionSummary> {
  readonly session: T;
  readonly kind: 'earliest_unfinished' | 'next_planned';
}

export function offPlanStartTarget<T extends OffPlanSessionSummary>(
  blockSessions: readonly T[],
  today: string,
): OffPlanStartTarget<T> | null {
  const open = [...blockSessions]
    .filter((session) => session.completionStatus === null && session.sessionDate !== today)
    .sort((a, b) => (a.sessionDate === b.sessionDate ? a.plannedSessionId - b.plannedSessionId
      : a.sessionDate < b.sessionDate ? -1 : 1));
  const missed = open.find((session) => session.sessionDate < today);
  if (missed !== undefined) return { session: missed, kind: 'earliest_unfinished' };
  const next = open.find((session) => session.sessionDate > today);
  return next === undefined ? null : { session: next, kind: 'next_planned' };
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const FOCUS_WORD: Readonly<Record<string, string>> = {
  lower: 'lower-body', upper: 'upper-body', full: 'full-body', conditioning: 'conditioning', bjj: 'BJJ',
};

/** "Thursday's upper-body session", for the control and its caption. */
export const offPlanSessionName = (session: OffPlanSessionSummary): string => {
  const ms = Date.parse(`${session.sessionDate}T00:00:00Z`);
  const day = Number.isFinite(ms) ? WEEKDAY[new Date(ms).getUTCDay()] : session.sessionDate;
  return `${day}'s ${FOCUS_WORD[session.focus] ?? session.focus} session`;
};

/** What the control says it will start. */
export const offPlanStartCaption = (target: OffPlanStartTarget): string =>
  target.kind === 'earliest_unfinished'
    ? `This starts ${offPlanSessionName(target.session)} (${target.session.sessionDate}), the earliest one you have not finished.`
    : `This starts ${offPlanSessionName(target.session)} (${target.session.sessionDate}), your next planned session.`;
