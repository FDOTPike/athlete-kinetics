/**
 * SessionSummary.test.js — Astra UX Phase 1 W3 contracts, reworked under
 * Audit R1 remediation decisions D1–D6 + D8.
 *
 * The laws pinned here:
 *
 * 1. HISTORY-MATCH LAW (D3) — a previous-session comparison exists only when
 *    movement identity matches, ALL current sets share one implement class,
 *    the historical sets share that class, and the facts come from ONE
 *    identifiable prior session (the latest eligible). Set ordering can never
 *    change the result; maxima are never combined across sessions.
 * 2. D1 — no historical time exists or is claimed; today's own time is
 *    "longest recorded time", never "best", and never under a "previous" label.
 * 3. D2 — independent maxima with plain labels: "most reps in one set",
 *    "heaviest load used". No composed "best set N reps at X kg".
 * 4. D4 — the no-next-session copy is the ratified universal fallback.
 * 5. D6 — typed lines carry stable movement-based keys; duplicate visible
 *    text cannot create duplicate React keys.
 * 6. D5/D8/D9 — screen level: unknown outcome truth, Back to Today dismissing
 *    exactly once, no writes during render, plain RPE wording.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SessionScreen from '../../src/screens/SessionScreen';
import {
  buildSessionSummary,
  exerciseClassOf,
  groupSummaryExercises,
  implementClassOf,
  matchPreviousFacts,
  NO_NEXT_SESSION_TEXT,
} from '../../src/state/sessionSummary';

jest.mock('../../src/state/useStore', () => {
  const useStoreImpl = (selector) => selector(mockState);
  useStoreImpl.getState = () => mockState;
  useStoreImpl.setState = () => {};
  return {
    palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
    useStore: useStoreImpl,
    formatTeachingOnlyReason: jest.fn(() => ''),
  };
});

jest.mock('@ak/inference', () => ({
  ...jest.requireActual('@ak/inference'),
  isDifficultyAllowed: jest.fn(() => true),
  effortCue: jest.fn(() => null),
  mapRirToRpe: jest.fn(() => 8),
}));

const exercise = (overrides = {}) => ({
  movementId: 11,
  movementName: 'Goblet Squat',
  plannedSets: 3,
  sets: [{ reps: 8, loadKg: 24, timeS: null }, { reps: 8, loadKg: 24, timeS: null }],
  ...overrides,
});

// ---------------------------------------------------------------------------
// 1. The history-match law (D3)
// ---------------------------------------------------------------------------

describe('matchPreviousFacts requires movement, one class, and one prior session', () => {
  test('same movement, same class: matched from one prior session', () => {
    const facts = matchPreviousFacts(
      exercise(),
      [{ movementId: 11, reps: 10, loadKg: 20, sessionId: 3 }],
    );
    expect(facts).not.toBeNull();
    expect(facts.mostRepsInOneSet).toBe(10);
    expect(facts.heaviestLoadKg).toBe(20);
    expect(facts.sourceSessionId).toBe(3);
    expect(facts.implementClass).toBe('loaded');
  });

  test('different movement: never matched', () => {
    expect(matchPreviousFacts(
      exercise(),
      [{ movementId: 99, reps: 8, loadKg: 24, sessionId: 3 }],
    )).toBeNull();
  });

  test('same movement, different implement class: never matched (both directions)', () => {
    expect(matchPreviousFacts(
      exercise(),
      [{ movementId: 11, reps: 8, loadKg: 0, sessionId: 3 }],
    )).toBeNull();
    expect(matchPreviousFacts(
      exercise({ sets: [{ reps: 8, loadKg: 0, timeS: null }] }),
      [{ movementId: 11, reps: 8, loadKg: 24, sessionId: 3 }],
    )).toBeNull();
  });

  test('today with no sets: no match', () => {
    expect(matchPreviousFacts(
      exercise({ sets: [] }),
      [{ movementId: 11, reps: 8, loadKg: 24, sessionId: 3 }],
    )).toBeNull();
  });

  test('implementClassOf derives the class from the set’s own load evidence', () => {
    expect(implementClassOf(0)).toBe('bodyweight');
    expect(implementClassOf(2.5)).toBe('loaded');
  });

  test('D3(2): mixed bodyweight/loaded current sets have NO single class', () => {
    expect(exerciseClassOf(exercise({
      sets: [
        { reps: 8, loadKg: 0, timeS: null },
        { reps: 5, loadKg: 20, timeS: null },
      ],
    }))).toBeNull();
  });

  test('D3(2): set ordering can never change the class result', () => {
    const mixed = [
      { reps: 8, loadKg: 0, timeS: null },
      { reps: 5, loadKg: 20, timeS: null },
    ];
    expect(exerciseClassOf(exercise({ sets: mixed }))).toBeNull();
    expect(exerciseClassOf(exercise({ sets: [...mixed].reverse() }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. D1/D2/D3 summary-level red tests
// ---------------------------------------------------------------------------

describe('summary copy obeys D1, D2, and D3', () => {
  const base = { previousSets: [], durationMin: null, blockSessions: [], today: '2026-09-10' };

  test('D1: today 60 s with a prior 40 s session claims NO historical 60-second time', () => {
    const view = buildSessionSummary({
      ...base,
      exercises: [exercise({ movementName: ' plank Hold', sets: [{ reps: 0, loadKg: 0, timeS: 60 }] })],
      previousSets: [{ movementId: 11, reps: 0, loadKg: 0, sessionId: 3 }],
    });
    const all = [
      ...view.exerciseLines.map((l) => l.text),
      ...view.comparisonLines.map((l) => l.text),
    ].join(' ');
    expect(all).not.toContain('previous');
    expect(all).not.toContain('last time');
    expect(all).not.toMatch(/\b60\s*s\b.*last|last.*60\s*s/i);
    expect(all).not.toMatch(/best/i);
    expect(all).toContain('longest recorded time 60 s');
  });

  test('D1: today 25 s with a prior 40 s session claims NO historical 25-second time', () => {
    const view = buildSessionSummary({
      ...base,
      exercises: [exercise({ sets: [{ reps: 0, loadKg: 0, timeS: 25 }] })],
      previousSets: [{ movementId: 11, reps: 0, loadKg: 0, sessionId: 3 }],
    });
    const all = [...view.exerciseLines.map((l) => l.text), ...view.comparisonLines.map((l) => l.text)].join(' ');
    expect(all).not.toMatch(/last time|previous/i);
    // Today's own time appears exactly once, under the ratified label.
    expect(all.match(/25 s/g)).toHaveLength(1);
    expect(all).toContain('longest recorded time 25 s');
  });

  test('D2: 8 bodyweight reps + 5 reps at 20 kg never compose "8 reps at 20 kg"', () => {
    const view = buildSessionSummary({
      ...base,
      exercises: [exercise({
        sets: [
          { reps: 8, loadKg: 0, timeS: null },
          { reps: 5, loadKg: 20, timeS: null },
        ],
      })],
    });
    const all = [...view.exerciseLines.map((l) => l.text)].join(' ');
    // The forbidden form composes ONE set from two maxima. The allowed form
    // states them as independent labelled facts.
    expect(all).not.toMatch(/best set 8 reps · at 20 kg/);
    expect(all).toContain('most reps in one set 8');
    expect(all).toContain('heaviest load used 20 kg');
    // The class is mixed, so no previous comparison may exist either.
    expect(view.comparisonLines).toEqual([]);
  });

  test('D3(2): reversing the mixed set order produces identical output', () => {
    const sets = [
      { reps: 8, loadKg: 0, timeS: null },
      { reps: 5, loadKg: 20, timeS: null },
      { reps: 6, loadKg: 0, timeS: null },
      { reps: 4, loadKg: 20, timeS: null },
    ];
    const a = buildSessionSummary({ ...base, exercises: [exercise({ sets })] });
    const b = buildSessionSummary({ ...base, exercises: [exercise({ sets: [...sets].reverse() })] });
    expect(a.exerciseLines).toEqual(b.exerciseLines);
    expect(a.comparisonLines).toEqual(b.comparisonLines);
  });

  test('D3(2): mixed bodyweight/loaded current sets produce NO previous comparison', () => {
    const view = buildSessionSummary({
      ...base,
      exercises: [exercise({
        sets: [
          { reps: 8, loadKg: 0, timeS: null },
          { reps: 5, loadKg: 20, timeS: null },
        ],
      })],
      previousSets: [
        { movementId: 11, reps: 12, loadKg: 20, sessionId: 2 },
        { movementId: 11, reps: 15, loadKg: 0, sessionId: 4 },
      ],
    });
    expect(view.comparisonLines).toEqual([]);
  });

  test('D3(4): uniform loaded sets compare ONLY with the latest eligible prior session', () => {
    const view = buildSessionSummary({
      ...base,
      exercises: [exercise({ sets: [{ reps: 6, loadKg: 30, timeS: null }] })],
      previousSets: [
        { movementId: 11, reps: 4, loadKg: 20, sessionId: 2 },
        { movementId: 11, reps: 10, loadKg: 25, sessionId: 7 },
      ],
    });
    expect(view.comparisonLines).toHaveLength(1);
    expect(view.comparisonLines[0].text).toContain('most reps in one set 10');
    expect(view.comparisonLines[0].text).toContain('heaviest load used 25 kg');
    expect(view.comparisonLines[0].text).not.toContain('4');
    expect(view.comparisonLines[0].text).not.toContain('20 kg');
  });

  test('D3(4): maxima from two prior sessions are NOT combined', () => {
    const view = buildSessionSummary({
      ...base,
      exercises: [exercise({ sets: [{ reps: 6, loadKg: 30, timeS: null }] })],
      previousSets: [
        { movementId: 11, reps: 12, loadKg: 15, sessionId: 5 },
        { movementId: 11, reps: 6, loadKg: 40, sessionId: 9 },
      ],
    });
    expect(view.comparisonLines).toHaveLength(1);
    // Session 9 only: reps 6, load 40. Session 5's 12 reps must NOT appear.
    expect(view.comparisonLines[0].text).toContain('most reps in one set 6');
    expect(view.comparisonLines[0].text).toContain('heaviest load used 40 kg');
    expect(view.comparisonLines[0].text).not.toContain('12');
    expect(view.comparisonLines[0].text).not.toContain('15 kg');
  });

  test('D3: a timed zero-rep movement with no historical time omits the comparison', () => {
    const view = buildSessionSummary({
      ...base,
      exercises: [exercise({ sets: [{ reps: 0, loadKg: 0, timeS: 60 }] })],
      previousSets: [{ movementId: 11, reps: 0, loadKg: 0, sessionId: 3 }],
    });
    expect(view.comparisonLines).toEqual([]);
  });

  test('D2: a timed zero-rep movement does not render "best set 0 reps"', () => {
    const view = buildSessionSummary({
      ...base,
      exercises: [exercise({ sets: [{ reps: 0, loadKg: 0, timeS: 45 }] })],
    });
    const all = view.exerciseLines.map((l) => l.text).join(' ');
    expect(all).not.toMatch(/best set 0 reps|most reps in one set 0/);
    expect(all).toContain('longest recorded time 45 s');
  });

  test('D2: extra work renders honestly — "5 sets logged · 4 planned"', () => {
    const view = buildSessionSummary({
      ...base,
      exercises: [exercise({
        plannedSets: 4,
        sets: Array.from({ length: 5 }, (_, i) => ({ reps: 8, loadKg: 24, timeS: null })),
      })],
    });
    expect(view.exerciseLines[0].text).toContain('5 sets logged · 4 planned');
    expect(view.exerciseLines[0].text).not.toContain('5 of 4');
  });

  test('D4: no-plan/ad-hoc completion renders the ratified fallback', () => {
    const view = buildSessionSummary({ ...base, exercises: [] });
    expect(view.nextLine).toBeNull();
    expect(NO_NEXT_SESSION_TEXT).toBe('No next session is scheduled yet.');
  });

  test('D4: a next session still names it; a session dated today is never next', () => {
    const sessions = (dates) => dates.map((d, i) => ({
      plannedSessionId: i + 1, weekIndex: 1, dayIndex: i + 1, focus: 'upper',
      sessionDate: d, slotCount: 4, completionStatus: null,
    }));
    const base = { exercises: [], previousSets: [], durationMin: null };
    const view = buildSessionSummary({
      ...base,
      blockSessions: sessions(['2026-09-09', '2026-09-12']),
      today: '2026-09-10',
    });
    expect(view.nextLine).toContain('2026-09-12');
    const strict = buildSessionSummary({ ...base, blockSessions: sessions(['2026-09-10']), today: '2026-09-10' });
    expect(strict.nextLine).toBeNull();
  });

  test('D1: no PR/improvement copy even when today far exceeds history', () => {
    const view = buildSessionSummary({
      ...base,
      exercises: [exercise({ sets: [{ reps: 15, loadKg: 60, timeS: null }] })],
      previousSets: [{ movementId: 11, reps: 5, loadKg: 20, sessionId: 3 }],
    });
    const all = [
      ...view.exerciseLines.map((l) => l.text),
      ...view.comparisonLines.map((l) => l.text),
    ].join(' ');
    expect(all).not.toMatch(/\bpr\b|personal best|record|improve|improved|better|new best|up from|progress/i);
  });
});

// ---------------------------------------------------------------------------
// 3. Screen laws: D5, D6, D8, D9
// ---------------------------------------------------------------------------

const movement = (id, name) => ({
  movement_id: id, name, pattern: 'squat', difficulty: 'Beginner', beginnerOk: true,
  supportedPrefixes: ['Barbell'], joint_stress: {}, movement_id_is_bodyweight: undefined,
  targetMuscles: [], coachingIntent: '', timePolicy: null,
  media: { assetKey: `movement/test-${id}/demo/v1`, status: 'external_fallback', revision: 1, fallbackUrl: 'https://www.youtube.com/watch?v=test' },
});

const baseState = (overrides = {}) => {
  const summaryFacts = overrides.loadSessionSummaryFacts ?? (() => ({
    durationMin: 38,
    exercises: [exercise()],
    previousSets: [],
  }));
  const base = {
    movements: [movement(11, 'Goblet Squat'), movement(12, 'Later movement')],
    session: null,
    sessionPlan: [],
    activeSessionPlanSlotId: null,
    profile: { training_age: 'beginner', equipment_inventory: [], session_duration_cap_min: 60 },
    movementAvailabilityRevision: 0,
    activeSessionAccessContext: 'weight_room',
    niggles: [],
    oneRepMaxes: {},
    lastLoggedLoads: {},
    lastTriage: null,
    substitution: null,
    runner: null,
    sessionMode: null,
    uiPreferences: { sessionModeOverride: null, readinessDetail: 'summary', restTimerEnabled: true, textScale: 'system' },
    bandLadder: [],
    lastEndedSessionId: 42,
    loadSessionOutcome: jest.fn(() => ({ outcomeKind: 'followed_plan', finalizedAtMs: 1_757_000_000_000 })),
    loadSessionSummaryFacts: jest.fn(summaryFacts),
    blockSessions: [{
      plannedSessionId: 2, weekIndex: 1, dayIndex: 2, focus: 'upper',
      sessionDate: '2026-09-12', slotCount: 4, completionStatus: null,
    }],
    today: '2026-09-10',
    startSession: jest.fn(),
    selectMovementSlot: jest.fn(),
    setMovementPreference: jest.fn(),
    openSubstitution: jest.fn(),
    closeSubstitution: jest.fn(),
    applyRegression: jest.fn(),
    applyDaySwap: jest.fn(),
    reportNiggle: jest.fn(),
    logSet: jest.fn(),
    editSet: jest.fn(),
    endSession: jest.fn(),
    dismissOutcome: jest.fn(),
    advanceRunnerRest: jest.fn(),
    skipRunnerRest: jest.fn(),
    setRunnerRestOverride: jest.fn(),
    runnerThumbsDown: jest.fn(),
    runnerHalt: jest.fn(),
    getMovementAvailabilityVerdicts: () => [],
    ...overrides,
  };
  return base;
};

describe('screen laws: D5, D6, D8, D9', () => {
  test('render performs no endSession / plan / progression / log call (D8 guard)', () => {
    mockState = baseState();
    render(<SessionScreen />);
    expect(screen.getByTestId('session-summary')).toBeOnTheScreen();
    expect(mockState.endSession).not.toHaveBeenCalled();
    expect(mockState.startSession).not.toHaveBeenCalled();
    expect(mockState.logSet).not.toHaveBeenCalled();
    expect(mockState.loadSessionSummaryFacts).toHaveBeenCalledTimes(1);
    expect(mockState.loadSessionSummaryFacts).toHaveBeenCalledWith(42);
  });

  test('D8: "Back to Today" dismisses exactly once and performs no other write', () => {
    mockState = baseState();
    render(<SessionScreen />);
    fireEvent.press(screen.getByLabelText('Back to Today'));
    expect(mockState.dismissOutcome).toHaveBeenCalledTimes(1);
    expect(mockState.endSession).not.toHaveBeenCalled();
    expect(mockState.loadSessionSummaryFacts).toHaveBeenCalledTimes(1);
  });

  test('D6: two movements with identical rendered text still produce distinct keys', () => {
    const view = buildSessionSummary({
      exercises: [
        exercise({ movementId: 11, movementName: 'Goblet Squat', sets: [{ reps: 8, loadKg: 24, timeS: null }] }),
        exercise({ movementId: 12, movementName: 'Goblet Squat', sets: [{ reps: 8, loadKg: 24, timeS: null }] }),
      ],
      previousSets: [],
      durationMin: null,
      blockSessions: [],
      today: '2026-09-10',
    });
    expect(view.exerciseLines[0].text).toBe(view.exerciseLines[1].text);
    expect(view.exerciseLines[0].key).not.toBe(view.exerciseLines[1].key);
  });

  test('D6: comparison lines are keyed per movement, not per text', () => {
    const view = buildSessionSummary({
      exercises: [
        exercise({ movementId: 11, movementName: 'Goblet Squat', sets: [{ reps: 6, loadKg: 30, timeS: null }] }),
        exercise({ movementId: 12, movementName: 'Later movement', sets: [{ reps: 6, loadKg: 30, timeS: null }] }),
      ],
      previousSets: [
        { movementId: 11, reps: 5, loadKg: 20, sessionId: 3 },
        { movementId: 12, reps: 5, loadKg: 20, sessionId: 3 },
      ],
      durationMin: null,
      blockSessions: [],
      today: '2026-09-10',
    });
    expect(view.comparisonLines).toHaveLength(2);
    expect(new Set(view.comparisonLines.map((l) => l.key)).size).toBe(2);
  });

  test('facts render including duration and next session', () => {
    mockState = baseState({
      loadSessionSummaryFacts: () => ({
        durationMin: 38,
        exercises: [exercise()],
        previousSets: [{ movementId: 11, reps: 6, loadKg: 20, sessionId: 3 }],
      }),
    });
    render(<SessionScreen />);
    expect(screen.getByText(/Goblet Squat — 2 sets logged · 3 planned · most reps in one set 8 · heaviest load used 24 kg/)).toBeOnTheScreen();
    expect(screen.getByText('Saved duration: 38 min')).toBeOnTheScreen();
    expect(screen.getByText(/Goblet Squat — last time:/)).toBeOnTheScreen();
    expect(screen.getByText(/Upper session on 2026-09-12/)).toBeOnTheScreen();
  });

  test('D5: an unknown outcome kind renders "Outcome unavailable", not a recorded claim', () => {
    mockState = baseState({
      loadSessionOutcome: jest.fn(() => ({ outcomeKind: 'something_new', finalizedAtMs: 1_757_000_000_000 })),
    });
    render(<SessionScreen />);
    expect(screen.getByText('Outcome unavailable')).toBeOnTheScreen();
    // D5: the status line must not be relabelled as a recorded session. The
    // date line below is persisted fact and may still say the session saved.
    expect(screen.queryByText(/^Session recorded\.$/)).toBeNull();
    expect(screen.queryByText('Session recorded.')).toBeNull();
  });

  test('no history: no comparison line is manufactured', () => {
    mockState = baseState();
    render(<SessionScreen />);
    expect(screen.queryByText(/last time:/)).toBeNull();
    expect(screen.getByTestId('session-summary')).toBeOnTheScreen();
  });

  test('D4: no next session renders the ratified fallback on screen', () => {
    mockState = baseState({ blockSessions: [] });
    render(<SessionScreen />);
    expect(screen.getByTestId('summary-next-none')).toBeOnTheScreen();
    expect(screen.getByText('No next session is scheduled yet.')).toBeOnTheScreen();
  });

  test('unavailable summary facts stay unknown without blocking the status line', () => {
    mockState = baseState({ loadSessionSummaryFacts: () => { throw new Error('db gone'); } });
    render(<SessionScreen />);
    expect(screen.queryByTestId('session-summary')).toBeNull();
    expect(screen.getByText("You followed today's plan. Recover well.")).toBeOnTheScreen();
  });

  test('R3: the completion date includes the year, including a prior year', () => {
    // A completion from November 2024 must render its year, not masquerade as
    // recent. new Date(ms) is local-time, so assert on the year fragment only.
    const priorYear = new Date('2024-11-03T12:00:00Z').getTime();
    mockState = baseState({
      loadSessionOutcome: jest.fn(() => ({ outcomeKind: 'followed_plan', finalizedAtMs: priorYear })),
    });
    render(<SessionScreen />);
    expect(screen.getByText(/2024/)).toBeOnTheScreen();
    expect(screen.getByText(/Session saved · .*2024/)).toBeOnTheScreen();
  });

  test('D9: the plain RPE wording appears and the Coach-evidence wording does not', () => {
    mockState = baseState({
      session: { sessionId: 10, date: '2026-07-15', startedAtMs: Date.now(), sets: [] },
      sessionPlan: [{
        sessionPlanSlotId: 1, movementId: 11, plannedSets: 3, plannedReps: 8,
        target: { kind: 'reps', reps: 8 }, provenanceKind: 'planned', targetRpe: 8,
        sourcePlannedSlotId: null, originalMovementId: null, originalSessionDate: null,
        overrideLoadKg: null, overrideReason: null,
      }],
      activeSessionPlanSlotId: 1,
      loadSessionSummaryFacts: () => ({ durationMin: null, exercises: [], previousSets: [] }),
      blockSessions: [],
      resolveSlotLoad: jest.fn(() => ({ initialLoadKg: null, kind: 'history', evidenceLine: '', suggestionLabel: null })),
      resolveSlotLoadCalls: [],
    });
    render(<SessionScreen />);
    expect(screen.getByText(/This effort rating will be saved with the set\.|Effort rating is optional; leave it blank if you are unsure\./)).toBeOnTheScreen();
    expect(screen.queryByText(/Coach evidence/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Sol R4 F4 — the planned-set denominator belongs to the SLOT
// ---------------------------------------------------------------------------

describe('F4: groupSummaryExercises never duplicates a slot denominator', () => {
  const row = (movementId, movementName, sessionPlanSlotId, plannedSets, reps = 5, loadKg = 20) => ({
    movementId, movementName, reps, loadKg, timeS: null, sessionPlanSlotId, plannedSets,
  });
  const lines = (exercises) => buildSessionSummary({
    exercises, previousSets: [], durationMin: null, blockSessions: [], today: '2026-09-11',
  }).exerciseLines.map((l) => l.text);

  test('(a) one four-set slot: 1 set of A, then substituted to B for 3 — neither claims the 4', () => {
    const exercises = groupSummaryExercises([
      row(1, 'Back Squat', 50, 4),
      row(2, 'Goblet Squat', 50, 4),
      row(2, 'Goblet Squat', 50, 4),
      row(2, 'Goblet Squat', 50, 4),
    ]);
    expect(exercises.map((e) => e.plannedSets)).toEqual([null, null]);
    const text = lines(exercises);
    expect(text).toEqual(['Back Squat — 1 set · most reps in one set 5 · heaviest load used 20 kg',
      'Goblet Squat — 3 sets · most reps in one set 5 · heaviest load used 20 kg']);
    for (const t of text) {
      expect(t).not.toMatch(/planned/);
      expect(t).not.toMatch(/of 4/);
    }
  });

  test('(a) is order-independent: interleaved rows give the same result', () => {
    const exercises = groupSummaryExercises([
      row(2, 'Goblet Squat', 50, 4),
      row(1, 'Back Squat', 50, 4),
      row(2, 'Goblet Squat', 50, 4),
    ]);
    expect(exercises.every((e) => e.plannedSets === null)).toBe(true);
  });

  test('(b) the same movement filling two exclusive 3-set slots sums them: "6 of 6 sets"', () => {
    const rows = [...Array(3)].map(() => row(1, 'Row', 60, 3))
      .concat([...Array(3)].map(() => row(1, 'Row', 61, 3)));
    const exercises = groupSummaryExercises(rows);
    expect(exercises).toHaveLength(1);
    expect(exercises[0].plannedSets).toBe(6);
    expect(lines(exercises)[0]).toMatch(/^Row — 6 of 6 sets/);
  });

  test('(c) a single-movement slot is unchanged: "3 sets logged · 4 planned"', () => {
    const exercises = groupSummaryExercises([row(1, 'Row', 70, 4), row(1, 'Row', 70, 4), row(1, 'Row', 70, 4)]);
    expect(exercises[0].plannedSets).toBe(4);
    expect(lines(exercises)[0]).toMatch(/^Row — 3 sets logged · 4 planned/);
  });

  test('(d) a set with no planned slot has no denominator', () => {
    const exercises = groupSummaryExercises([row(1, 'Row', null, null), row(1, 'Row', null, null)]);
    expect(exercises[0].plannedSets).toBeNull();
    expect(lines(exercises)[0]).toMatch(/^Row — 2 sets ·/);
  });

  test('a movement sharing ONE slot loses its fraction even if it also owns another slot', () => {
    const exercises = groupSummaryExercises([
      row(1, 'Back Squat', 80, 3), row(1, 'Back Squat', 81, 3), row(2, 'Goblet Squat', 81, 3),
    ]);
    expect(exercises.find((e) => e.movementId === 1).plannedSets).toBeNull();
    expect(exercises.find((e) => e.movementId === 2).plannedSets).toBeNull();
  });
});
