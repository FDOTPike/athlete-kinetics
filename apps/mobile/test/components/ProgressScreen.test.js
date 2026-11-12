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
  const at = (iso) => new SpyDate(iso).getTime();
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
        { sessionId: 12, outcomeKind: 'session_recorded', finalizedAtMs: at('2026-11-03T18:05:00Z') },
        { sessionId: 11, outcomeKind: 'session_recorded', finalizedAtMs: at('2026-11-03T09:40:00Z') },
      ]),
      loadSessionSummaryFacts: jest.fn(facts),
    });
  });

  test('two sessions on one day are told apart by their time', () => {
    render(<ProgressScreen />);
    const labels = screen.getAllByLabelText(/Show what was logged.$/).map((node) => node.props.accessibilityLabel);
    expect(labels).toHaveLength(2);
    expect(labels[0]).not.toBe(labels[1]);
    expect(labels[0]).toMatch(/2026 · \d{1,2}:\d{2}/);
    expect(labels[1]).toMatch(/2026 · \d{1,2}:\d{2}/);
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
