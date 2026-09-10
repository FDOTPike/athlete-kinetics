/**
 * todayState.ts — the pure Today-state derivation (Astra UX Phase 1, W1).
 *
 * WHY THIS IS A SEPARATE, PURE MODULE
 * -----------------------------------
 * The defect this replaces was a single boolean in a screen file:
 *
 *   ReadinessScreen.tsx:219  isRestDay = todayPlan === null && !halted && !hasLiveSession
 *
 * That predicate calls FOUR materially different situations a rest day — a
 * genuinely scheduled recovery day, an athlete with no program at all, an
 * athlete whose block has ended, and an athlete who missed a planned session
 * and is now being told to rest. Work order §3.1 requires those to be
 * distinguished. Distinguishing them inside a render body would have hidden the
 * decision in JSX, so the decision lives here as a total function over plain
 * data with no React, no store and no database access.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * It proposes no schedule mutation. Nothing here moves, reschedules, skips or
 * regenerates a session — §2 defers `Move session` to Phase 2, and an overdue
 * session stays exactly where the block generator put it. The function reports
 * WHICH situation the athlete is in; choosing the action stays with the screen,
 * and every action the screen offers is one the app already had.
 *
 * It also never infers completion from a date. `completionStatus` is the
 * finalized `session_outcome.terminal_phase` that `refreshBlock` already
 * derives; a past session is "missed" only when that status is genuinely
 * `null`. A session that was started and stopped is `'halted'` — attempted, not
 * missed — and is never reported as overdue.
 */

/** The subset of `BlockSessionSummary` this derivation reads. */
export interface TodayBlockSession {
  plannedSessionId: number;
  weekIndex: number;
  dayIndex: number;
  focus: string;
  sessionDate: string;
  slotCount: number;
  completionStatus: 'complete' | 'halted' | null;
}

/** A pointer to another session in the block, for "what comes next". */
export interface SessionRef {
  plannedSessionId: number;
  focus: string;
  sessionDate: string;
  slotCount: number;
}

export interface TodayStateInput {
  /** Local ISO date (YYYY-MM-DD) — the store's `today`. */
  today: string;
  /** `session !== null`: a persisted session is open and resumable. */
  hasActiveSession: boolean;
  /** A matched safety directive set a halt for today. */
  halted: boolean;
  /** `todayPlan` reduced to what this derivation needs; null on a rest day. */
  todayPlan: { plannedSessionId: number; focus: string; slotCount: number } | null;
  /** Every planned session of the ACTIVE block, in (week, day) order. */
  blockSessions: readonly TodayBlockSession[];
  /** `block !== null`. */
  hasActiveBlock: boolean;
  /** At least one archived block exists (an athlete between blocks). */
  hasArchivedBlock: boolean;
}

export type TodayState =
  /** Safety supremacy: a halt outranks every training state. */
  | { kind: 'halted' }
  /** A persisted session is open. The only correct action is to return to it. */
  | { kind: 'active_session' }
  /** Today has a planned session that has not been finalized. */
  | {
      kind: 'planned';
      plannedSessionId: number;
      focus: string;
      slotCount: number;
      /** Earlier unfinished sessions, reported but never acted on for them. */
      overdue: SessionRef[];
    }
  /** Today's planned session is already finalized as complete. */
  | { kind: 'completed_today'; focus: string; next: SessionRef | null }
  /** No session today, and at least one earlier planned session is unfinished. */
  | { kind: 'overdue'; earliest: SessionRef; missedCount: number; next: SessionRef | null }
  /** An active block covers today and deliberately schedules no session. */
  | { kind: 'scheduled_rest'; next: SessionRef | null }
  /** No active block, or today lies outside the active block's window. */
  | {
      kind: 'unscheduled';
      reason: 'no_program' | 'between_blocks' | 'block_ended' | 'not_started_yet';
      next: SessionRef | null;
    };

export type TodayStateKind = TodayState['kind'];

const refOf = (session: TodayBlockSession): SessionRef => ({
  plannedSessionId: session.plannedSessionId,
  focus: session.focus,
  sessionDate: session.sessionDate,
  slotCount: session.slotCount,
});

/**
 * Sessions are ordered by (week, day) rather than by date string, because that
 * is the order `refreshBlock` returns and the order the block generator
 * assigned. Dates are compared only against `today`, never used to re-sort.
 */
const byDate = (sessions: readonly TodayBlockSession[]): TodayBlockSession[] =>
  [...sessions].sort((a, b) => (a.sessionDate < b.sessionDate ? -1 : a.sessionDate > b.sessionDate ? 1 : 0));

/** Planned sessions strictly before today that were never finalized at all. */
export const missedSessions = (
  sessions: readonly TodayBlockSession[],
  today: string,
): TodayBlockSession[] =>
  byDate(sessions).filter((s) => s.sessionDate < today && s.completionStatus === null);

/** The first planned session strictly after today, if the block still has one. */
export const nextSessionAfter = (
  sessions: readonly TodayBlockSession[],
  today: string,
): SessionRef | null => {
  const upcoming = byDate(sessions).find((s) => s.sessionDate > today);
  return upcoming === undefined ? null : refOf(upcoming);
};

/**
 * Total derivation of the Today state.
 *
 * The branch order is the priority order and is deliberate:
 *
 *   1. halted          — safety outranks everything, matching the store, which
 *                        refuses `startSession` outright while a halt stands
 *                        (useStore.ts:4730).
 *   2. active_session  — an open session outranks any plan; resuming it is the
 *                        only action that cannot lose logged work.
 *   3. planned         — today's own work comes before anything historical, so
 *                        an overdue session is REPORTED here, not acted on.
 *   4. completed_today — today's session is finalized; no start is offered,
 *                        because offering one would invite a duplicate.
 *   5. overdue         — nothing today, but real unfinished work exists.
 *   6. scheduled_rest  — the plan genuinely schedules rest today.
 *   7. unscheduled     — there is no plan covering today at all.
 */
export function deriveTodayState(input: TodayStateInput): TodayState {
  const { today, blockSessions, todayPlan } = input;

  if (input.halted) return { kind: 'halted' };
  if (input.hasActiveSession) return { kind: 'active_session' };

  const next = nextSessionAfter(blockSessions, today);
  const missed = missedSessions(blockSessions, today);

  // `todayPlan` is refreshBlock's own find on sessionDate === today, so the
  // matching summary row is the authority for whether it is already finalized.
  const todayRow = blockSessions.find((s) => s.sessionDate === today) ?? null;

  if (todayPlan !== null && todayRow?.completionStatus !== 'complete') {
    return {
      kind: 'planned',
      plannedSessionId: todayPlan.plannedSessionId,
      focus: todayPlan.focus,
      slotCount: todayPlan.slotCount,
      overdue: missed.map(refOf),
    };
  }

  if (todayPlan !== null) {
    return { kind: 'completed_today', focus: todayPlan.focus, next };
  }

  if (missed.length > 0) {
    return {
      kind: 'overdue',
      earliest: refOf(missed[0]!),
      missedCount: missed.length,
      next,
    };
  }

  // No session today and nothing outstanding. Whether that is a SCHEDULED rest
  // day or simply an absence of any plan is decided by the block window, not by
  // the absence itself — which is precisely the distinction the old
  // `isRestDay` boolean could not make.
  if (input.hasActiveBlock && blockSessions.length > 0) {
    const dates = byDate(blockSessions);
    const first = dates[0]!.sessionDate;
    const last = dates[dates.length - 1]!.sessionDate;
    if (today < first) return { kind: 'unscheduled', reason: 'not_started_yet', next };
    if (today > last) return { kind: 'unscheduled', reason: 'block_ended', next: null };
    return { kind: 'scheduled_rest', next };
  }

  return {
    kind: 'unscheduled',
    reason: input.hasArchivedBlock ? 'between_blocks' : 'no_program',
    next,
  };
}

// ---------------------------------------------------------------------------
// Honest duration presentation
// ---------------------------------------------------------------------------

/**
 * What the Today card is allowed to say about how long the session takes.
 *
 * `recorded` is a median of the athlete's OWN finalized `session.duration_min`
 * values for the same focus. `cap` is the athlete's own configured session
 * ceiling. There is no third option on purpose: the work order asks for "an
 * honest duration estimate or existing duration value", and any formula that
 * multiplied planned sets by an assumed work-time-per-set would be neither —
 * it would be a number this app has never measured, presented as if it had.
 */
export type DurationEstimate =
  | { kind: 'recorded'; minutes: number; sampleSize: number }
  | { kind: 'cap'; minutes: number };

/** Median, rounded to the nearest 5 minutes. Empty input yields null. */
export const medianMinutes = (samples: readonly number[]): number | null => {
  const usable = samples.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (usable.length === 0) return null;
  const mid = Math.floor(usable.length / 2);
  const median = usable.length % 2 === 1
    ? usable[mid]!
    : (usable[mid - 1]! + usable[mid]!) / 2;
  return Math.max(5, Math.round(median / 5) * 5);
};

export const durationEstimate = (
  recordedSamples: readonly number[],
  sessionDurationCapMin: number,
): DurationEstimate => {
  const median = medianMinutes(recordedSamples);
  if (median === null) return { kind: 'cap', minutes: sessionDurationCapMin };
  return { kind: 'recorded', minutes: median, sampleSize: recordedSamples.length };
};

/** Athlete-facing sentence for a duration estimate. Never invents precision. */
export const durationCopy = (estimate: DurationEstimate): string =>
  estimate.kind === 'recorded'
    ? `About ${estimate.minutes} min — your median over ${estimate.sampleSize} recorded session${estimate.sampleSize === 1 ? '' : 's'} like this`
    : `Up to ${estimate.minutes} min — the session length you set`;

// ---------------------------------------------------------------------------
// Adjustments, in ordinary language
// ---------------------------------------------------------------------------

export interface TodayAdjustment {
  movementName: string;
  rpeDelta: number;
  setDelta: number;
  reason: string;
}

/**
 * Plain-language read of ONE real, persisted autopilot adjustment.
 *
 * Callers must not invoke this speculatively: §3.1 says that when nothing
 * changed, no adjustment message may be manufactured. `describeAdjustments`
 * below returns an empty array for empty input, and the screen renders the
 * whole section only when that array is non-empty — so "no change" is
 * represented by the absence of the section, not by a sentence claiming
 * stability.
 */
export const describeAdjustment = (adjustment: TodayAdjustment): string => {
  const parts: string[] = [];
  if (adjustment.setDelta < 0) {
    const n = Math.abs(adjustment.setDelta);
    parts.push(`${n} set${n === 1 ? '' : 's'} fewer`);
  } else if (adjustment.setDelta > 0) {
    parts.push(`${adjustment.setDelta} set${adjustment.setDelta === 1 ? '' : 's'} more`);
  }
  if (adjustment.rpeDelta < 0) {
    parts.push(`effort target eased by ${Math.abs(adjustment.rpeDelta)}`);
  } else if (adjustment.rpeDelta > 0) {
    parts.push(`effort target raised by ${adjustment.rpeDelta}`);
  }
  // A row with both deltas at zero carries no change to report. Naming the
  // movement and stopping is more honest than inventing a verb for it.
  if (parts.length === 0) return `${adjustment.movementName} — reviewed, unchanged`;
  return `${adjustment.movementName} — ${parts.join(', ')}`;
};

export const describeAdjustments = (
  adjustments: readonly TodayAdjustment[],
): string[] => adjustments.map(describeAdjustment);
