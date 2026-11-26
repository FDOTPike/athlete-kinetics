/**
 * ProgressScreen.test.js — Audit R1 R2 contracts (D5) for the Progress surface.
 *
 * Pinned here:
 * 1. An unknown outcome kind renders "Outcome unavailable" — never relabelled
 *    as a recorded session (D5).
 * 2. Recent-session dates include the year (D5) — a prior-year date must show
 *    its year, so an old session cannot masquerade as recent.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ProgressScreen from '../../src/screens/ProgressScreen';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  useStore: (selector) => selector(mockState),
}));

// Deterministic locale so the year assertion is stable.
const SpyDate = Date;
const REAL_TZ_OFFSET = new SpyDate('2026-09-10T00:00:00Z').getTimezoneOffset();

const state = (overrides = {}) => ({
  session: null,
  loadRecentOutcomes: jest.fn(() => []),
  loadMeasuredHistory: jest.fn(() => []),
  ...overrides,
});

beforeEach(() => { mockState = state(); });

describe('Progress truth (D5)', () => {
  test('an unknown outcome kind renders "Outcome unavailable"', () => {
    mockState = state({
      loadRecentOutcomes: jest.fn(() => [
        { outcomeKind: 'mystery_kind', finalizedAtMs: new SpyDate('2026-08-01T12:00:00Z').getTime() },
      ]),
    });
    render(<ProgressScreen />);
    expect(screen.getByText('Outcome unavailable')).toBeOnTheScreen();
    expect(screen.queryByText('Session recorded')).toBeNull();
  });

  test('a date from a prior year includes the year', () => {
    const priorYear = new SpyDate('2024-11-03T12:00:00Z').getTime();
    mockState = state({
      loadRecentOutcomes: jest.fn(() => [
        { outcomeKind: 'followed_plan', finalizedAtMs: priorYear },
      ]),
    });
    render(<ProgressScreen />);
    const detail = screen.getByText(/2024/);
    expect(detail).toBeOnTheScreen();
    expect(detail.props.children).toContain('2024');
  });

  test('known kinds keep their labels and render with year-ful dates', () => {
    mockState = state({
      loadRecentOutcomes: jest.fn(() => [
        { outcomeKind: 'followed_plan', finalizedAtMs: new SpyDate('2025-03-09T12:00:00Z').getTime() },
      ]),
    });
    render(<ProgressScreen />);
    expect(screen.getByText('Plan followed')).toBeOnTheScreen();
    expect(screen.getByText(/2025/)).toBeOnTheScreen();
  });
});

// Android walk 2026-11-03 (W2-9): a recent session was a label and a date that
// could not be opened, and two sessions on one day looked identical.
describe('Recent sessions open to what was logged', () => {
  const facts = (sessionId) => ({
    durationMin: 31,
    exercises: [{ movementId: 1, movementName: sessionId === 11 ? 'Goblet Squat' : 'Push-up', plannedSets: 3, sets: [
      { reps: 10, loadKg: 16, timeS: null }, { reps: 10, loadKg: 16, timeS: null }, { reps: 8, loadKg: 16, timeS: null },
    ] }],
    previousSets: [],
    skippedExercises: sessionId === 11 ? [{ name: 'Walking Lunge', plannedSets: 2, loggedSets: 0, loggedAs: [] }] : [],
  });

  beforeEach(() => {
    mockState = state({
      loadRecentOutcomes: jest.fn(() => [
        { sessionId: 12, outcomeKind: 'adapted_session', finalizedAtMs: new SpyDate(2026, 10, 3, 18, 5).getTime() },
        { sessionId: 11, outcomeKind: 'session_recorded', finalizedAtMs: new SpyDate(2026, 10, 3, 9, 40).getTime() },
      ]),
      loadSessionSummaryFacts: jest.fn(facts),
    });
  });

  test('two sessions on one day are told apart by their time', () => {
    render(<ProgressScreen />);
    const labels = screen.getAllByLabelText(/Show what was logged.$/).map((node) => node.props.accessibilityLabel);
    expect(labels).toHaveLength(2);
    expect(labels[0]).not.toBe(labels[1]);
    // Check independent mid-month anchors so month, time prefix/separator, and day period adapt to any runtime locale.
    const novMonth = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new SpyDate(2026, 10, 15));
    const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
    const pmPeriod = timeFmt.formatToParts(new SpyDate(2026, 10, 15, 18, 30)).find((p) => p.type === 'dayPeriod')?.value;
    const amPeriod = timeFmt.formatToParts(new SpyDate(2026, 10, 15, 9, 15)).find((p) => p.type === 'dayPeriod')?.value;
    const timeField = (label) => label.split(' · ').pop().replace(/\. Show what was logged\.$/, '');
    expect(labels[0]).toContain('Session adapted');
    expect(labels[0]).toContain(novMonth);
    expect(labels[0]).toMatch(/\b0?3\b/);
    expect(labels[0]).toContain('2026');
    if (pmPeriod) {
      expect(labels[0]).toMatch(/ · [^·\d]*?(?:18|0?6)[:.]05/);
      expect(timeField(labels[0])).toContain(pmPeriod);
    } else {
      expect(labels[0]).toMatch(/ · [^·\d]*?18[:.]05/);
    }
    expect(labels[1]).toContain('Session recorded');
    expect(labels[1]).toContain(novMonth);
    expect(labels[1]).toMatch(/\b0?3\b/);
    expect(labels[1]).toContain('2026');
    expect(labels[1]).toMatch(/ · [^·\d]*?0?9[:.]40/);
    if (amPeriod) {
      expect(timeField(labels[1])).toContain(amPeriod);
    }
  });

  test('tapping a session shows its logged exercises and skips, and tapping again hides them', () => {
    render(<ProgressScreen />);
    expect(screen.queryByTestId('progress-session-11-summary')).toBeNull();
    fireEvent.press(screen.getByTestId('progress-session-11'));
    expect(mockState.loadSessionSummaryFacts).toHaveBeenCalledWith(11);
    const summary = screen.getByTestId('progress-session-11-summary');
    expect(summary).toBeOnTheScreen();
    expect(screen.getByText(/Goblet Squat/)).toBeOnTheScreen();
    expect(screen.getByText('Skipped: Walking Lunge · no sets logged')).toBeOnTheScreen();
    expect(screen.queryByText(/^Next:|No next session/)).toBeNull();
    fireEvent.press(screen.getByTestId('progress-session-11'));
    expect(screen.queryByTestId('progress-session-11-summary')).toBeNull();
  });

  // Review (PR 292): a past summary states dumbbell loads per dumbbell, as the
  // completion summary does (issue #218).
  test('a past dumbbell session states its heaviest load per dumbbell', () => {
    mockState.movements = [{ movement_id: 1, name: 'Goblet Squat', supportedPrefixes: ['DB'] }];
    render(<ProgressScreen />);
    fireEvent.press(screen.getByTestId('progress-session-11'));
    expect(screen.getByText(/heaviest load used 16 kg per dumbbell/)).toBeOnTheScreen();
  });

  test('a past session of a lift with no dumbbell has no per-dumbbell wording', () => {
    mockState.movements = [{ movement_id: 1, name: 'Goblet Squat', supportedPrefixes: ['DB', 'KB'] }];
    mockState.loadIntents = { 1: 'KB' };
    render(<ProgressScreen />);
    fireEvent.press(screen.getByTestId('progress-session-11'));
    expect(screen.getByText(/heaviest load used 16 kg/)).toBeOnTheScreen();
    expect(screen.queryByText(/per dumbbell/)).toBeNull();
  });

  // Review (PR 194): a read that fails is not an empty session.
  test('a summary that cannot be read does not say that no sets were logged', () => {
    mockState.loadSessionSummaryFacts = jest.fn(() => { throw new Error('synthetic read failure'); });
    render(<ProgressScreen />);
    fireEvent.press(screen.getByTestId('progress-session-11'));
    expect(screen.getByText("This session's summary could not be read.")).toBeOnTheScreen();
    expect(screen.queryByText('No sets were logged in this session.')).toBeNull();
  });

  test('a session read with nothing in it still says that no sets were logged', () => {
    mockState.loadSessionSummaryFacts = jest.fn(() => ({ durationMin: null, exercises: [], previousSets: [], skippedExercises: [] }));
    render(<ProgressScreen />);
    fireEvent.press(screen.getByTestId('progress-session-11'));
    expect(screen.getByText('No sets were logged in this session.')).toBeOnTheScreen();
    expect(screen.queryByText("This session's summary could not be read.")).toBeNull();
  });
});

describe('recent session rows (#201)', () => {
  test('sessions on one day are told apart by focus, exercise and set counts, with the outcome on each row', () => {
    const sameDay = new SpyDate('2026-11-04T10:30:00').getTime();
    mockState = state({
      loadRecentOutcomes: jest.fn(() => [
        { sessionId: 3, outcomeKind: 'followed_plan', finalizedAtMs: sameDay + 7200000, focus: 'upper', originKind: 'planned', exerciseCount: 3, loggedSetCount: 9 },
        { sessionId: 2, outcomeKind: 'session_recorded', finalizedAtMs: sameDay + 3600000, focus: null, originKind: 'free_form', exerciseCount: 1, loggedSetCount: 4 },
        { sessionId: 1, outcomeKind: 'followed_plan', finalizedAtMs: sameDay, focus: 'lower', originKind: 'planned', exerciseCount: 2, loggedSetCount: 6 },
      ]),
    });
    render(<ProgressScreen />);
    expect(screen.getByText(/^Upper · 3 exercises · 9 sets/)).toBeOnTheScreen();
    expect(screen.getByText(/^Extra session · 1 exercise · 4 sets/)).toBeOnTheScreen();
    expect(screen.getByText(/^Lower · 2 exercises · 6 sets/)).toBeOnTheScreen();
    expect(screen.getAllByText('Plan followed')).toHaveLength(2);
    expect(screen.getByText('Session recorded')).toBeOnTheScreen();
  });
});

test('renders TRAINING FOCUS weekly muscle completion and GOALS on the primary Progress tab (S1-022)', () => {
  mockState = state({
    today: '2026-11-04',
    focus: { bundleId: 'beach_muscles', muscles: ['upper_chest', 'biceps'], customised: true, movementControl: false },
    blockSessions: [{
      plannedSessionId: 1,
      weekIndex: 1,
      dayIndex: 1,
      focus: 'upper',
      phase: 'accumulation',
      sessionDate: '2026-11-04',
      slotCount: 1,
      completionStatus: 'complete',
    }],
    loadRecentOutcomes: jest.fn(() => [{
      sessionId: 20,
      outcomeKind: 'followed_plan',
      finalizedAtMs: new SpyDate('2026-11-04T10:30:00').getTime(),
      focus: 'upper',
      originKind: 'planned',
      exerciseCount: 1,
      loggedSetCount: 3,
    }]),
    loadSessionSummaryFacts: jest.fn(() => ({
      durationMin: 28,
      exercises: [{
        movementId: 10,
        movementName: 'Incline Dumbbell Press',
        plannedSets: 3,
        sets: [
          { reps: 8, loadKg: 20, timeS: null },
          { reps: 8, loadKg: 20, timeS: null },
          { reps: 8, loadKg: 20, timeS: null },
        ],
      }],
      previousSets: [],
      skippedExercises: [],
    })),
    loadSessionSlots: jest.fn(() => [{
      slotIndex: 0,
      plannedSlotId: 1,
      movementId: 10,
      movementName: 'Incline Dumbbell Press',
      sets: 3,
      reps: 8,
      target: { kind: 'reps', reps: 8 },
      targetRpe: 8,
      overrideLoadKg: null,
      overrideReason: null,
    }]),
    movements: [{ movement_id: 10, name: 'Incline Dumbbell Press', targetMuscles: ['upper_chest'] }],
    goals: [{
      goalId: 'g1',
      status: 'active',
      revision: 1,
      goal: {
        specificOutcome: 'Goblet squat 40 kg for 10',
        metricId: 'load_kg',
        unit: 'kg',
        measurementMethod: 'Goblet squat, 10 reps',
        baselineKnown: true,
        baselineValue: 24,
        targetValue: 40,
        reason: 'Stronger legs',
        requestedDeadline: '2026-12-01',
      },
      observations: [{ observationId: 'o1', observedOn: '2026-11-01', value: 32, unit: 'kg', metricId: 'load_kg' }],
    }],
  });

  render(<ProgressScreen />);

  expect(screen.getByTestId('progress-focus-summary')).toHaveTextContent('Beach muscles (edited): upper chest, biceps');
  expect(screen.getByTestId('progress-focus-muscle-upper_chest')).toHaveTextContent(
    'Upper chest · 3 of 3 planned sets completed this week',
  );
  expect(screen.getByTestId('progress-focus-muscle-biceps')).toHaveTextContent(
    'Biceps · 0 of 0 planned sets completed this week',
  );
  expect(screen.getByTestId('progress-goal-g1')).toBeOnTheScreen();
  expect(screen.getByText(/Goblet squat 40 kg for 10/)).toBeOnTheScreen();
  expect(screen.getByText(/About 50% of the way/)).toBeOnTheScreen();
});

test('WO03-SOL-01: finalized planned session whose focus exercise was skipped reports 0 of 3 planned sets completed', () => {
  mockState = state({
    today: '2026-11-04',
    focus: { bundleId: 'beach_muscles', muscles: ['upper_chest'], customised: false, movementControl: false },
    blockSessions: [{
      plannedSessionId: 1,
      weekIndex: 1,
      dayIndex: 1,
      focus: 'upper',
      phase: 'accumulation',
      sessionDate: '2026-11-04',
      slotCount: 1,
      completionStatus: 'complete',
    }],
    loadRecentOutcomes: jest.fn(() => [{
      sessionId: 21,
      outcomeKind: 'adapted_session',
      finalizedAtMs: new SpyDate('2026-11-04T10:30:00').getTime(),
      focus: 'upper',
      originKind: 'planned',
      exerciseCount: 0,
      loggedSetCount: 0,
    }]),
    loadSessionSummaryFacts: jest.fn(() => ({
      durationMin: 6,
      exercises: [],
      previousSets: [],
      skippedExercises: [{ name: 'Incline Dumbbell Press', plannedSets: 3, loggedSets: 0, loggedAs: [] }],
    })),
    loadSessionSlots: jest.fn(() => [{
      slotIndex: 0,
      plannedSlotId: 1,
      movementId: 10,
      movementName: 'Incline Dumbbell Press',
      sets: 3,
      reps: 8,
      target: { kind: 'reps', reps: 8 },
      targetRpe: 8,
      overrideLoadKg: null,
      overrideReason: null,
    }]),
    movements: [{ movement_id: 10, name: 'Incline Dumbbell Press', targetMuscles: ['upper_chest'] }],
    goals: [],
  });

  render(<ProgressScreen />);
  expect(screen.getByTestId('progress-focus-muscle-upper_chest')).toHaveTextContent(
    'Upper chest · 0 of 3 planned sets completed this week',
  );
});

test('WO03-SOL-R2a: a finalized workout from an archived block on the replacement block start date never credits the replacement block', () => {
  const sameDayMs = new SpyDate('2026-11-04T09:00:00').getTime();
  mockState = state({
    today: '2026-11-04',
    block: {
      blockId: 2,
      startDate: '2026-11-04',
      objective: 'hypertrophy',
      createdAtMs: sameDayMs + 3600000,
    },
    focus: { bundleId: 'beach_muscles', muscles: ['upper_chest'], customised: false, movementControl: false },
    blockSessions: [{
      plannedSessionId: 101,
      weekIndex: 1,
      dayIndex: 1,
      focus: 'upper',
      phase: 'accumulation',
      sessionDate: '2026-11-04',
      slotCount: 1,
      completionStatus: null,
    }],
    loadRecentOutcomes: jest.fn(() => [{
      sessionId: 19,
      outcomeKind: 'followed_plan',
      finalizedAtMs: sameDayMs,
      focus: 'upper',
      originKind: 'planned',
      exerciseCount: 1,
      loggedSetCount: 3,
    }]),
    loadSessionSummaryFacts: jest.fn(() => ({
      durationMin: 30,
      exercises: [{
        movementId: 10,
        movementName: 'Incline Dumbbell Press',
        plannedSets: 3,
        sets: [
          { reps: 8, loadKg: 20, timeS: null },
          { reps: 8, loadKg: 20, timeS: null },
          { reps: 8, loadKg: 20, timeS: null },
        ],
      }],
      previousSets: [],
      skippedExercises: [],
    })),
    loadSessionSlots: jest.fn(() => [{
      slotIndex: 0,
      plannedSlotId: 1010,
      movementId: 10,
      movementName: 'Incline Dumbbell Press',
      sets: 3,
      reps: 8,
      target: { kind: 'reps', reps: 8 },
      targetRpe: 8,
      overrideLoadKg: null,
      overrideReason: null,
    }]),
    movements: [{ movement_id: 10, name: 'Incline Dumbbell Press', targetMuscles: ['upper_chest'] }],
    goals: [],
  });

  render(<ProgressScreen />);
  expect(screen.getByTestId('progress-focus-muscle-upper_chest')).toHaveTextContent(
    'Upper chest · 0 of 3 planned sets completed this week',
  );
});

test('WO03-SOL-R2b: twenty-five newer extra sessions do not hide a finalized planned workout from the active week counter', () => {
  const baseMs = new SpyDate('2026-11-02T09:00:00').getTime();
  const extraRows = Array.from({ length: 25 }, (_v, i) => ({
    sessionId: 200 - i,
    outcomeKind: 'session_recorded',
    finalizedAtMs: baseMs + (26 - i) * 3600000,
    focus: null,
    originKind: 'free_form',
    exerciseCount: 1,
    loggedSetCount: 2,
  }));
  const allRows = [
    ...extraRows,
    {
      sessionId: 50,
      outcomeKind: 'followed_plan',
      finalizedAtMs: baseMs,
      focus: 'upper',
      originKind: 'planned',
      exerciseCount: 1,
      loggedSetCount: 3,
    },
  ];
  mockState = state({
    today: '2026-11-04',
    block: {
      blockId: 1,
      startDate: '2026-11-02',
      objective: 'hypertrophy',
      createdAtMs: baseMs - 60000,
    },
    focus: { bundleId: 'beach_muscles', muscles: ['upper_chest'], customised: false, movementControl: false },
    blockSessions: [{
      plannedSessionId: 1,
      weekIndex: 1,
      dayIndex: 1,
      focus: 'upper',
      phase: 'accumulation',
      sessionDate: '2026-11-02',
      slotCount: 1,
      completionStatus: 'complete',
    }],
    loadRecentOutcomes: jest.fn((limit = 20) => allRows.slice(0, limit)),
    loadSessionSummaryFacts: jest.fn((sessionId) => (
      sessionId === 50
        ? {
            durationMin: 32,
            exercises: [{
              movementId: 10,
              movementName: 'Incline Dumbbell Press',
              plannedSets: 3,
              sets: [
                { reps: 8, loadKg: 20, timeS: null },
                { reps: 8, loadKg: 20, timeS: null },
                { reps: 8, loadKg: 20, timeS: null },
              ],
            }],
            previousSets: [],
            skippedExercises: [],
          }
        : { durationMin: 15, exercises: [], previousSets: [], skippedExercises: [] }
    )),
    loadSessionSlots: jest.fn(() => [{
      slotIndex: 0,
      plannedSlotId: 1,
      movementId: 10,
      movementName: 'Incline Dumbbell Press',
      sets: 3,
      reps: 8,
      target: { kind: 'reps', reps: 8 },
      targetRpe: 8,
      overrideLoadKg: null,
      overrideReason: null,
    }]),
    movements: [{ movement_id: 10, name: 'Incline Dumbbell Press', targetMuscles: ['upper_chest'] }],
    goals: [],
  });

  render(<ProgressScreen />);
  expect(screen.getByTestId('progress-focus-muscle-upper_chest')).toHaveTextContent(
    'Upper chest · 3 of 3 planned sets completed this week',
  );
  // Recent sessions display remains bounded to the 20 most recent rows
  expect(screen.queryByTestId('progress-session-50')).toBeNull();
});
