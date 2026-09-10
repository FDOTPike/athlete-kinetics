/**
 * sessionSummary.ts — the pure post-completion summary (Astra UX Phase 1, W3).
 *
 * WHY THIS IS PURE
 * ----------------
 * The completion summary speaks about the athlete's past. Any past-facing
 * sentence that is not a persisted fact is a fabrication risk, so the shaping
 * lives here as a total function over plain data: no React, no store, no
 * database access. `useStore.loadSessionSummaryFacts` reads the rows; this
 * module decides what may be SAID about them.
 *
 * THE HISTORY-MATCH LAW
 * ---------------------
 * A previous-performance comparison is allowed only when BOTH hold:
 *   1. the same movement identity (`movementId`), and
 *   2. the same implement/load class, derived from the set's OWN evidence —
 *      a logged load > 0 kg is `loaded`, otherwise `bodyweight`.
 * Class (2) is what stops a bodyweight set from being quietly compared with a
 * weighted rendition of the same movement (added kg on a bodyweight movement
 * is a different implement class, not a bigger number of the same kind).
 * `matchPreviousBest` STATES the previous best as a fact. It never receives
 * today's result and never emits a comparative adjective, so no PR or
 * improvement claim can be produced by construction.
 *
 * WHAT IS NEVER INVENTED
 * ----------------------
 * - Duration: rendered only when `session.duration_min` was persisted and is
 *   positive; otherwise the line is absent, never estimated.
 * - Missing sets: a movement whose plan row is missing reports only the sets
 *   that exist; `plannedSets: null` renders no fraction.
 * - No history: no comparison line at all — not "no previous data" padding
 *   beyond the honest absence.
 */
import { nextSessionAfter, type SessionRef, type TodayBlockSession } from './todayState';

export type ImplementClass = 'bodyweight' | 'loaded';

/** A set's implement/load class comes from the set's own logged evidence. */
export const implementClassOf = (loadKg: number): ImplementClass =>
  loadKg > 0 ? 'loaded' : 'bodyweight';

/** One persisted set of the ended session. */
export interface SummarySetFact {
  reps: number;
  loadKg: number;
  timeS: number | null;
}

/** One movement of the ended session, with the sets actually recorded. */
export interface SummaryExercise {
  movementId: number;
  movementName: string;
  /** `session_plan_slot.planned_sets` for this movement, null when unmapped. */
  plannedSets: number | null;
  sets: SummarySetFact[];
}

/** One persisted set from an earlier session, a candidate for comparison. */
export interface PreviousSetFact {
  movementId: number;
  reps: number;
  loadKg: number;
  sessionId: number;
}

/**
 * The previous best of ONE movement at ONE implement class. Every field is a
 * plain maximum over matched persisted sets — a fact, not a verdict.
 */
export interface PreviousBest {
  movementId: number;
  implementClass: ImplementClass;
  bestReps: number | null;
  bestLoadKg: number | null;
  sourceSessionId: number;
}

/** The today-side class of an exercise, from its own logged evidence. */
const exerciseClassOf = (exercise: SummaryExercise): ImplementClass | null => {
  const first = exercise.sets[0];
  return first === undefined ? null : implementClassOf(first.loadKg);
};

/**
 * THE history-match law. Requires the same movement AND the same implement
 * class; without a match there is NO previous best, and without today-side
 * evidence there is nothing to match against.
 */
export const matchPreviousBest = (
  exercise: SummaryExercise,
  previousSets: readonly PreviousSetFact[],
): PreviousBest | null => {
  const todayClass = exerciseClassOf(exercise);
  if (todayClass === null) return null;
  const matched = previousSets.filter(
    (p) => p.movementId === exercise.movementId && implementClassOf(p.loadKg) === todayClass,
  );
  if (matched.length === 0) return null;
  let bestReps: number | null = null;
  let bestLoadKg: number | null = null;
  let sourceSessionId = matched[0]!.sessionId;
  for (const set of matched) {
    if (bestReps === null || set.reps > bestReps) bestReps = set.reps;
    if (todayClass === 'loaded' && (bestLoadKg === null || set.loadKg > bestLoadKg)) {
      bestLoadKg = set.loadKg;
    }
    if (set.sessionId > sourceSessionId) sourceSessionId = set.sessionId;
  }
  return { movementId: exercise.movementId, implementClass: todayClass, bestReps, bestLoadKg, sourceSessionId };
};

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

const loadCopy = (loadKg: number): string => {
  const rounded = Math.round(loadKg * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} kg`;
};

const exerciseLine = (exercise: SummaryExercise): string => {
  const logged = exercise.sets.length;
  const count = exercise.plannedSets === null
    ? plural(logged, 'set')
    : `${logged} of ${exercise.plannedSets} sets`;
  const timed = exercise.sets.filter((s) => s.timeS !== null);
  const reps = exercise.sets.filter((s) => s.reps > 0);
  const parts: string[] = [`${exercise.movementName} — ${count} logged`];
  if (reps.length > 0) {
    const bestReps = Math.max(...reps.map((s) => s.reps));
    parts.push(`best set ${plural(bestReps, 'rep')}`);
  }
  if (timed.length > 0) {
    const bestTime = Math.max(...timed.map((s) => s.timeS!));
    parts.push(`best ${bestTime} s`);
  }
  const loaded = exercise.sets.filter((s) => implementClassOf(s.loadKg) === 'loaded');
  if (loaded.length > 0) {
    parts.push(`at ${loadCopy(Math.max(...loaded.map((s) => s.loadKg)))}`);
  }
  return parts.join(' · ');
};

const comparisonLine = (exercise: SummaryExercise, best: PreviousBest): string => {
  const classWord = best.implementClass === 'loaded'
    ? `at ${loadCopy(best.bestLoadKg ?? 0)}`
    : 'unweighted';
  const repsPart = best.bestReps === null ? '' : `best set ${plural(best.bestReps, 'rep')}`;
  const timeFacts = exercise.sets.filter((s) => s.timeS !== null);
  const timePart = timeFacts.length === 0
    ? ''
    : ` · best ${Math.max(...timeFacts.map((s) => s.timeS!))} s`;
  const body = [repsPart, classWord].filter((p) => p.length > 0).join(' ');
  return `${exercise.movementName} — previous: ${body}${timePart}`;
};

export interface SessionSummaryView {
  exerciseLines: string[];
  comparisonLines: string[];
  durationLine: string | null;
  nextLine: string | null;
}

export interface BuildSummaryInput {
  exercises: readonly SummaryExercise[];
  previousSets: readonly PreviousSetFact[];
  /** Persisted `session.duration_min` — null when absent or unreliable. */
  durationMin: number | null;
  blockSessions: readonly TodayBlockSession[];
  today: string;
}

export const buildSessionSummary = (input: BuildSummaryInput): SessionSummaryView => {
  const exerciseLines = input.exercises.map(exerciseLine);
  const comparisonLines: string[] = [];
  for (const exercise of input.exercises) {
    const best = matchPreviousBest(exercise, input.previousSets);
    if (best !== null) comparisonLines.push(comparisonLine(exercise, best));
  }
  const durationLine = input.durationMin !== null && Number.isFinite(input.durationMin) && input.durationMin > 0
    ? `Saved duration: ${Math.max(1, Math.round(input.durationMin))} min`
    : null;
  const next: SessionRef | null = nextSessionAfter(input.blockSessions, input.today);
  return {
    exerciseLines,
    comparisonLines,
    durationLine,
    nextLine: next === null
      ? null
      : `Next: ${next.focus.charAt(0).toUpperCase()}${next.focus.slice(1).toLowerCase()} session on ${next.sessionDate} — ${plural(next.slotCount, 'movement')}.`,
  };
};
