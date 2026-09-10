/**
 * sessionSummary.ts — the pure post-completion summary (Astra UX Phase 1, W3;
 * reworked under Audit R1 remediation decisions D1–D6).
 *
 * WHY THIS IS PURE
 * ----------------
 * The completion summary speaks about the athlete's past. Any past-facing
 * sentence that is not a persisted fact is a fabrication risk, so the shaping
 * lives here as a total function over plain data: no React, no store, no
 * database access. `useStore.loadSessionSummaryFacts` reads the rows; this
 * module decides what may be SAID about them.
 *
 * THE HISTORY-MATCH LAW (D3)
 * --------------------------
 * A previous-session comparison is allowed only when ALL of these hold:
 *   1. the same movement identity (`movementId`);
 *   2. ALL of today's sets for that movement belong to exactly ONE implement
 *      class (a logged load > 0 kg is `loaded`, otherwise `bodyweight`);
 *   3. the historical sets belong to that SAME class;
 *   4. the facts come from ONE identifiable prior session — the LATEST
 *      eligible one. Maxima are never combined across sessions, and set
 *      ordering can never change the result.
 * If no useful metric survives in the chosen prior session (e.g. a timed
 * bodyweight movement with zero reps and no historical time), the comparison
 * is omitted entirely.
 *
 * D1 — NO HISTORICAL TIME: the database reader does not load prior time
 * values, so no previous-session time claim can exist. Today's own time may
 * appear, labelled "longest recorded time" (a larger time is not universally
 * better), never "best".
 *
 * D2 — NEVER COMPOSE A SET: today's line and the previous line each state
 * INDEPENDENT maxima with plain labels — "most reps in one set", "heaviest
 * load used", "longest recorded time". No combined "best set N reps at X kg"
 * form exists, because that reads as one set that never occurred.
 *
 * D4 — the no-next-session copy is the universal fallback text; D6 — summary
 * lines carry stable movement-based keys, never rendered text or indexes.
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
 * The independent maxima of ONE movement in ONE prior session. Every field is
 * a plain maximum over that session's matched persisted sets — a fact, not a
 * verdict, and never a composite of another session's numbers.
 */
export interface PreviousFacts {
  movementId: number;
  implementClass: ImplementClass;
  sourceSessionId: number;
  mostRepsInOneSet: number | null;
  heaviestLoadKg: number | null;
}

/**
 * The single implement class of an exercise. D3(2): null unless ALL sets
 * belong to the same class. Ordering can never change the outcome because the
 * check is over the whole set.
 */
export const exerciseClassOf = (exercise: SummaryExercise): ImplementClass | null => {
  if (exercise.sets.length === 0) return null;
  const first = implementClassOf(exercise.sets[0]!.loadKg);
  for (const set of exercise.sets) {
    if (implementClassOf(set.loadKg) !== first) return null;
  }
  return first;
};

/**
 * THE history-match law (D3). Requires the same movement, a single today-side
 * class, and history from ONE prior session of that same class. The prior
 * session is the LATEST eligible one (highest sessionId; the store orders by
 * persisted chronology and this tiebreaker is deterministic). Set ordering in
 * either session cannot change the result: the filter is order-independent and
 * the maxima are pure maxima.
 */
export const matchPreviousFacts = (
  exercise: SummaryExercise,
  previousSets: readonly PreviousSetFact[],
): PreviousFacts | null => {
  const todayClass = exerciseClassOf(exercise);
  if (todayClass === null) return null;
  const matched = previousSets.filter(
    (p) => p.movementId === exercise.movementId && implementClassOf(p.loadKg) === todayClass,
  );
  if (matched.length === 0) return null;
  // One identifiable prior session: the latest that has ANY set of this class.
  const sourceSessionId = Math.max(...matched.map((p) => p.sessionId));
  const fromSource = matched.filter((p) => p.sessionId === sourceSessionId);
  let mostRepsInOneSet: number | null = null;
  let heaviestLoadKg: number | null = null;
  for (const set of fromSource) {
    if (mostRepsInOneSet === null || set.reps > mostRepsInOneSet) mostRepsInOneSet = set.reps;
    if (todayClass === 'loaded' && (heaviestLoadKg === null || set.loadKg > heaviestLoadKg)) {
      heaviestLoadKg = set.loadKg;
    }
  }
  return {
    movementId: exercise.movementId,
    implementClass: todayClass,
    sourceSessionId,
    mostRepsInOneSet,
    heaviestLoadKg,
  };
};

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

const loadCopy = (loadKg: number): string => {
  const rounded = Math.round(loadKg * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} kg`;
};

/**
 * D6: a summary line is a typed structure with a stable movement-based key —
 * never rendered text, never an array index.
 */
export interface SummaryLine {
  key: string;
  text: string;
}

/**
 * Today's own line (D2): independent maxima with plain labels. Extra work is
 * stated honestly — "5 sets logged · 4 planned" — and a timed movement reports
 * "longest recorded time", never "best" (D1).
 */
const exerciseLine = (exercise: SummaryExercise): SummaryLine => {
  const logged = exercise.sets.length;
  const count = exercise.plannedSets === null
    ? plural(logged, 'set')
    : logged === exercise.plannedSets
      ? `${logged} of ${exercise.plannedSets} sets`
      : `${plural(logged, 'set')} logged · ${exercise.plannedSets} planned`;
  const reps = exercise.sets.filter((s) => s.reps > 0);
  const timed = exercise.sets.filter((s) => s.timeS !== null && s.timeS! > 0);
  const loaded = exercise.sets.filter((s) => implementClassOf(s.loadKg) === 'loaded');
  const parts: string[] = [`${exercise.movementName} — ${count}`];
  if (reps.length > 0) {
    parts.push(`most reps in one set ${Math.max(...reps.map((s) => s.reps))}`);
  }
  if (loaded.length > 0) {
    parts.push(`heaviest load used ${loadCopy(Math.max(...loaded.map((s) => s.loadKg)))}`);
  }
  if (timed.length > 0) {
    parts.push(`longest recorded time ${Math.max(...timed.map((s) => s.timeS!))} s`);
  }
  return { key: `exercise-${exercise.movementId}`, text: parts.join(' · ') };
};

/**
 * The previous-session line (D2 + D3). Facts come ONLY from the one eligible
 * prior session; today's numbers never appear here. A line is emitted only
 * when at least one useful metric exists.
 */
const comparisonLine = (exercise: SummaryExercise, facts: PreviousFacts): SummaryLine | null => {
  const parts: string[] = [];
  if (facts.mostRepsInOneSet !== null && facts.mostRepsInOneSet > 0) {
    parts.push(`most reps in one set ${facts.mostRepsInOneSet}`);
  }
  if (facts.implementClass === 'loaded' && facts.heaviestLoadKg !== null && facts.heaviestLoadKg > 0) {
    parts.push(`heaviest load used ${loadCopy(facts.heaviestLoadKg)}`);
  }
  if (parts.length === 0) return null;
  return {
    key: `previous-${exercise.movementId}`,
    text: `${exercise.movementName} — last time: ${parts.join(' · ')}`,
  };
};

export interface SessionSummaryView {
  exerciseLines: SummaryLine[];
  comparisonLines: SummaryLine[];
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
  const comparisonLines: SummaryLine[] = [];
  for (const exercise of input.exercises) {
    const facts = matchPreviousFacts(exercise, input.previousSets);
    if (facts !== null) {
      const line = comparisonLine(exercise, facts);
      if (line !== null) comparisonLines.push(line);
    }
  }
  const durationLine = input.durationMin !== null && Number.isFinite(input.durationMin) && input.durationMin > 0
    ? `Saved duration: ${Math.max(1, Math.round(input.durationMin))} min`
    : null;
  // D4: the absence copy is the universal fallback — never an assertion that
  // a block exists merely because the collection is empty. The ratified text
  // is exported as NO_NEXT_SESSION_TEXT (the single source of truth; the
  // screen renders it directly).
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

/** D4: exported so the screen renders the exact ratified fallback text. */
export const NO_NEXT_SESSION_TEXT = 'No next session is scheduled yet.';
