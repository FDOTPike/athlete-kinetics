/**
 * SessionSummary.test.js — Astra UX Phase 1 W3 contracts.
 *
 * Three laws are pinned here:
 *
 * 1. THE HISTORY-MATCH LAW — a previous-performance comparison exists only when
 *    movement identity AND implement/load class both match. Class comes from
 *    the set's own logged load (> 0 kg = loaded, else bodyweight), so a
 *    bodyweight set can never be compared with a weighted rendition of the
 *    same movement.
 * 2. NO PR/IMPROVEMENT CLAIM — `buildSessionSummary` never receives a verdict
 *    channel: comparisons are stated facts about the PAST only. This test
 *    asserts no comparative or superlative copy can appear even when today's
 *    result is dramatically better or worse than history.
 * 3. THE NO-SECOND-WRITE LAW — rendering the summary and pressing dismiss
 *    never calls endSession, never creates a plan, and never persists a
 *    second completion.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SessionScreen from '../../src/screens/SessionScreen';
import {
  buildSessionSummary,
  implementClassOf,
  matchPreviousBest,
} from '../../src/state/sessionSummary';

jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  useStore: (selector) => selector(mockState),
}));

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
// 1. The history-match law (pure)
// ---------------------------------------------------------------------------

describe('matchPreviousBest requires movement AND implement class', () => {
  test('same movement, same class: matched', () => {
    const best = matchPreviousBest(
      exercise(),
      [{ movementId: 11, reps: 10, loadKg: 20, sessionId: 3 }],
    );
    expect(best).not.toBeNull();
    expect(best.bestReps).toBe(10);
    expect(best.bestLoadKg).toBe(20);
    expect(best.implementClass).toBe('loaded');
  });

  test('different movement: never matched, even with identical numbers', () => {
    expect(matchPreviousBest(
      exercise(),
      [{ movementId: 99, reps: 8, loadKg: 24, sessionId: 3 }],
    )).toBeNull();
  });

  test('same movement, different implement class: never matched', () => {
    // Today's sets are loaded (24 kg). A bodyweight rendition of the SAME
    // movement is a different implement class and must not produce a match.
    expect(matchPreviousBest(
      exercise(),
      [{ movementId: 11, reps: 8, loadKg: 0, sessionId: 3 }],
    )).toBeNull();
    // And the reverse: today bodyweight, history loaded.
    expect(matchPreviousBest(
      exercise({ sets: [{ reps: 8, loadKg: 0, timeS: null }] }),
      [{ movementId: 11, reps: 8, loadKg: 24, sessionId: 3 }],
    )).toBeNull();
  });

  test('today with no sets: no match — there is nothing to compare', () => {
    expect(matchPreviousBest(
      exercise({ sets: [] }),
      [{ movementId: 11, reps: 8, loadKg: 24, sessionId: 3 }],
    )).toBeNull();
  });

  test('implementClassOf derives the class from the set’s own load evidence', () => {
    expect(implementClassOf(0)).toBe('bodyweight');
    expect(implementClassOf(2.5)).toBe('loaded');
  });
});

// ---------------------------------------------------------------------------
// 2. Facts, never PRs
// ---------------------------------------------------------------------------

describe('the summary states facts and never infers a PR or improvement', () => {
  test('today far exceeds history: copy stays a statement of the past', () => {
    const view = buildSessionSummary({
      exercises: [exercise({ sets: [{ reps: 15, loadKg: 60, timeS: null }] })],
      previousSets: [{ movementId: 11, reps: 5, loadKg: 20, sessionId: 3 }],
      durationMin: 42,
      blockSessions: [],
      today: '2026-09-10',
    });
    const all = [...view.exerciseLines, ...view.comparisonLines, view.durationLine, view.nextLine ?? ''].join(' ');
    expect(all).not.toMatch(/pr\b|personal best|record|improve|improved|better|new best|up from|progress/i);
  });

  test('today far under history: identical restraint', () => {
    const view = buildSessionSummary({
      exercises: [exercise({ sets: [{ reps: 2, loadKg: 5, timeS: null }] })],
      previousSets: [{ movementId: 11, reps: 12, loadKg: 60, sessionId: 3 }],
      durationMin: null,
      blockSessions: [],
      today: '2026-09-10',
    });
    const all = [...view.exerciseLines, ...view.comparisonLines].join(' ');
    expect(all).not.toMatch(/pr\b|personal best|record|improve|improved|better|worse|down from|regress/i);
    // But the matched history fact is stated.
    expect(view.comparisonLines[0]).toContain('previous');
  });

  test('no matching history renders no comparison line at all', () => {
    const view = buildSessionSummary({
      exercises: [exercise()],
      previousSets: [],
      durationMin: null,
      blockSessions: [],
      today: '2026-09-10',
    });
    expect(view.comparisonLines).toEqual([]);
  });

  test('duration renders only when persisted and positive', () => {
    const base = { exercises: [exercise()], previousSets: [], blockSessions: [], today: '2026-09-10' };
    expect(buildSessionSummary({ ...base, durationMin: 41.4 }).durationLine).toBe('Saved duration: 41 min');
    expect(buildSessionSummary({ ...base, durationMin: null }).durationLine).toBeNull();
    expect(buildSessionSummary({ ...base, durationMin: 0 }).durationLine).toBeNull();
    expect(buildSessionSummary({ ...base, durationMin: -5 }).durationLine).toBeNull();
  });

  test('the next session comes from the correct future ordering, and its absence is honest', () => {
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
    // A session dated today is never "next" (strict future).
    const strict = buildSessionSummary({
      ...base,
      blockSessions: sessions(['2026-09-10']),
      today: '2026-09-10',
    });
    expect(strict.nextLine).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Screen laws: no second write, honest no-history, honest no-next
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

describe('rendering and dismissing the summary never writes', () => {
  test('render performs no endSession / plan / progression / log call', () => {
    mockState = baseState();
    render(<SessionScreen />);
    expect(screen.getByTestId('session-summary')).toBeOnTheScreen();
    expect(mockState.endSession).not.toHaveBeenCalled();
    expect(mockState.startSession).not.toHaveBeenCalled();
    expect(mockState.logSet).not.toHaveBeenCalled();
    // Reads are the only store activity: exactly one fact read per mount.
    expect(mockState.loadSessionSummaryFacts).toHaveBeenCalledTimes(1);
    expect(mockState.loadSessionSummaryFacts).toHaveBeenCalledWith(42);
  });

  test('dismissal calls only dismissOutcome — never a second completion write', () => {
    mockState = baseState();
    render(<SessionScreen />);
    fireEvent.press(screen.getByLabelText('Back to Ready'));
    expect(mockState.dismissOutcome).toHaveBeenCalledTimes(1);
    expect(mockState.endSession).not.toHaveBeenCalled();
    expect(mockState.loadSessionSummaryFacts).toHaveBeenCalledTimes(1);
  });

  test('summary facts render, including duration and the next session', () => {
    mockState = baseState({
      loadSessionSummaryFacts: () => ({
        durationMin: 38,
        exercises: [exercise()],
        previousSets: [{ movementId: 11, reps: 6, loadKg: 20, sessionId: 3 }],
      }),
    });
    render(<SessionScreen />);
    expect(screen.getByText(/Goblet Squat — 2 of 3 sets logged/)).toBeOnTheScreen();
    expect(screen.getByText('Saved duration: 38 min')).toBeOnTheScreen();
    expect(screen.getByText(/Goblet Squat — previous:/)).toBeOnTheScreen();
    expect(screen.getByText(/Upper session on 2026-09-12/)).toBeOnTheScreen();
  });

  test('no history: no comparison line is manufactured', () => {
    mockState = baseState();
    render(<SessionScreen />);
    expect(screen.queryByText(/previous:/)).toBeNull();
    expect(screen.getByTestId('session-summary')).toBeOnTheScreen();
  });

  test('no next session: the absence is stated, not padded', () => {
    mockState = baseState({ blockSessions: [] });
    render(<SessionScreen />);
    expect(screen.getByTestId('summary-next-none')).toBeOnTheScreen();
  });

  test('unavailable summary facts stay unknown without blocking the status line', () => {
    mockState = baseState({ loadSessionSummaryFacts: () => { throw new Error('db gone'); } });
    render(<SessionScreen />);
    expect(screen.queryByTestId('session-summary')).toBeNull();
    expect(screen.getByText("You followed today's plan. Recover well.")).toBeOnTheScreen();
  });
});
