import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SessionScreen from '../../src/screens/SessionScreen';

let mockState;

jest.mock('@ak/inference', () => ({
  JOINTS: ['shoulder', 'knee'],
  nextUp: jest.fn((runner) => {
    const current = runner.slots[runner.slotIndex];
    if (current === undefined) return null;
    const completed = runner.slotSetCounts[runner.slotIndex] ?? 0;
    const nextSetIndex = runner.phase === 'working' ? completed + 2 : completed + 1;
    if (nextSetIndex <= current.sets) return { slot: current, setIndex: nextSetIndex };
    const next = runner.slots.find((_, index) => index > runner.slotIndex);
    return next === undefined ? null : { slot: next, setIndex: 1 };
  }),
  targetLoadKg: jest.fn(() => 42.5),
}));
jest.mock('../../src/state/useStore', () => {
  const storeFunc = (selector) => selector(mockState);
  storeFunc.setState = jest.fn((updates) => {
    Object.assign(mockState, updates);
  });
  storeFunc.getState = jest.fn(() => mockState);

  return {
    palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
    formatTeachingOnlyReason: (reasons) => reasons.length === 0 ? 'Teaching only' : `Teaching only — ${reasons.map((r) => r === 'capability' ? 'build the movement below it first' : r).join('; ')}`,
    useStore: storeFunc,
  };
});

const movement = (id, name, overrides = {}) => ({
  movement_id: id, name, pattern: 'push_h', is_compound: true, beginnerOk: true,
  loggingMode: 'reps', required: [], baseName: name, supportedPrefixes: ['Bodyweight'],
  difficulty: 'Beginner', preference: 0,
  instructions: 'Plant your feet\nBrace your trunk', cues: 'Push the floor away\nKeep ribs down',
  videoUrl: 'https://www.youtube.com/watch?v=test', coachingIntent: 'Build a simple, repeatable pressing pattern.', timePolicy: null,
  ...overrides,
});
const slot = (id, movementId, reps = 5, overrides = {}) => ({
  sessionPlanSlotId: id, movementId, plannedSets: 3, plannedReps: reps,
  target: { kind: 'reps', reps }, provenanceKind: 'planned', targetRpe: 8,
  sourcePlannedSlotId: null, originalMovementId: null, originalSessionDate: null,
  overrideLoadKg: null, overrideReason: null,
  ...overrides,
});
const runner = (overrides = {}) => ({
  tier: 'beginner',
  slots: [
    { sessionPlanSlotId: 1, movementId: 1, movementName: 'First movement', sets: 3, target: { kind: 'reps', reps: 5 }, targetRpe: 8 },
    { sessionPlanSlotId: 2, movementId: 2, movementName: 'Later movement', sets: 3, target: { kind: 'reps', reps: 8 }, targetRpe: 8 },
  ],
  slotIndex: 0, setIndex: 1, phase: 'working', restSecondsTarget: 0, restStartedAtMs: null,
  restRpe: null, slotSetCounts: [0, 0], loggedSets: 0,
  substitutionOfferedForSessionPlanSlotId: null, haltReason: null, skippedSessionPlanSlotIds: [], updatedAtMs: Date.now(),
  ...overrides,
});
const state = (overrides = {}) => ({
  movements: [movement(1, 'First movement'), movement(2, 'Later movement')],
  session: { sessionId: 10, date: '2026-07-15', startedAtMs: Date.now(), sets: [] },
  sessionPlan: [slot(1, 1), slot(2, 2, 8)], activeSessionPlanSlotId: 1,
  profile: { training_age: 'beginner', equipment_inventory: [], session_duration_cap_min: 60 },
  getMovementAvailabilityVerdicts: () => [],
  oneRepMaxes: {}, lastLoggedLoads: {}, lastTriage: null, substitution: null,
  startSession: jest.fn(), selectMovementSlot: jest.fn(), setMovementPreference: jest.fn(),
  openSubstitution: jest.fn(), closeSubstitution: jest.fn(), applyRegression: jest.fn(), applyDaySwap: jest.fn(),
  reportNiggle: jest.fn(), logSet: jest.fn(), editSet: jest.fn(), endSession: jest.fn(),
  runner: runner(), sessionMode: 'guided',
  uiPreferences: { sessionModeOverride: null, readinessDetail: 'summary', restTimerEnabled: true, textScale: 'system' },
  bandLadder: [], advanceRunnerRest: jest.fn(), skipRunnerRest: jest.fn(), runnerThumbsDown: jest.fn(), runnerHalt: jest.fn(),
  loadSessionOutcome: jest.fn(() => null),
  dismissOutcome: jest.fn(function() {
    mockState.lastEndedSessionId = null;
  }),
  ...overrides,
});

beforeEach(() => { mockState = state(); });

test('guided mode keeps only the current movement expanded and future work unavailable', () => {
  render(<SessionScreen />);
  expect(screen.getByText('First movement')).toBeOnTheScreen();
  const future = screen.getByLabelText('Later movement, upcoming, 3 × 8');
  expect(future.props.accessibilityState.disabled).toBe(true);
  expect(screen.getByLabelText('Log set 1 for First movement')).toBeOnTheScreen();
});

test('a current session keeps its frozen guided mode after a preference change', () => {
  mockState = state({ uiPreferences: { sessionModeOverride: 'self_directed', readinessDetail: 'full', restTimerEnabled: true, textScale: 'system' }, sessionMode: 'guided' });
  render(<SessionScreen />);
  expect(screen.getByText('GUIDED SESSION')).toBeOnTheScreen();
  expect(screen.getByLabelText('Later movement, upcoming, 3 × 8').props.accessibilityState.disabled).toBe(true);
});

test('self-directed mode allows an incomplete future movement to become current', () => {
  mockState = state({ sessionMode: 'self_directed' });
  render(<SessionScreen />);
  fireEvent.press(screen.getByLabelText('Choose Later movement as the current exercise'));
  expect(mockState.selectMovementSlot).toHaveBeenCalledWith(2);
});

test('How and why is collapsed until explicitly opened', () => {
  render(<SessionScreen />);
  expect(screen.queryByText('Build a simple, repeatable pressing pattern.')).not.toBeOnTheScreen();
  fireEvent.press(screen.getByLabelText('How and why, collapsed'));
  expect(screen.getByText('Build a simple, repeatable pressing pattern.')).toBeOnTheScreen();
  expect(screen.getByText('1. Plant your feet')).toBeOnTheScreen();
  expect(screen.getByText('• Push the floor away')).toBeOnTheScreen();
  expect(screen.getByLabelText('Open video for First movement in your browser')).toBeOnTheScreen();
});

test('rest is silent, previews the next deterministic set, and can end early', () => {
  mockState = state({ runner: runner({ phase: 'resting', setIndex: 1, restSecondsTarget: 90, restStartedAtMs: Date.now(), restRpe: 8, slotSetCounts: [1, 0], loggedSets: 1 }) });
  render(<SessionScreen />);
  expect(screen.getByText('REST')).toBeOnTheScreen();
  expect(screen.getByText('Next up: First movement · set 2 of 3')).toBeOnTheScreen();
  fireEvent.press(screen.getByLabelText('Ready now, skip the rest timer'));
  expect(mockState.skipRunnerRest).toHaveBeenCalledTimes(1);
});

test('thumbs-down delegates the durable Avoid plus substitution transition to the runner store action', () => {
  render(<SessionScreen />);
  fireEvent.press(screen.getByLabelText('Avoid First movement and find a substitution'));
  expect(mockState.runnerThumbsDown).toHaveBeenCalledTimes(1);
  expect(mockState.setMovementPreference).not.toHaveBeenCalled();
  expect(mockState.openSubstitution).not.toHaveBeenCalled();
});

test('stop uses the runner’s valid manual halt reason', () => {
  render(<SessionScreen />);
  fireEvent.press(screen.getByLabelText('Stop this session'));
  expect(mockState.runnerHalt).toHaveBeenCalledWith('manual');
});

test('a beginner never renders a legacy plan containing an advanced movement', () => {
  mockState = state({
    movements: [movement(1, 'First movement'), movement(2, 'Advanced movement', { difficulty: 'Advanced', beginnerOk: false })],
  });
  render(<SessionScreen />);
  expect(screen.getByText('This plan needs Coach review.')).toBeOnTheScreen();
  expect(screen.queryByText('Advanced movement')).toBeNull();
  fireEvent.press(screen.getByLabelText('Finish the blocked session'));
  expect(mockState.runnerHalt).toHaveBeenCalledWith('safety');
  expect(mockState.endSession).toHaveBeenCalledTimes(1);
  expect(mockState.runnerHalt.mock.invocationCallOrder[0]).toBeLessThan(
    mockState.endSession.mock.invocationCallOrder[0],
  );
});

test('a triage halt on a live runner persists safety before ending the session', () => {
  mockState = state({
    lastTriage: {
      kind: 'matched',
      directive: { halt: true, vector: { coaching_cue: 'Stop and reassess this symptom.' } },
    },
  });
  render(<SessionScreen />);
  fireEvent.press(screen.getByLabelText('Finish the halted session'));
  expect(mockState.runnerHalt).toHaveBeenCalledWith('safety');
  expect(mockState.endSession).toHaveBeenCalledTimes(1);
  expect(mockState.runnerHalt.mock.invocationCallOrder[0]).toBeLessThan(
    mockState.endSession.mock.invocationCallOrder[0],
  );
});

test('a completed runner takes precedence over a later triage halt', () => {
  mockState = state({
    runner: runner({ phase: 'complete', slotIndex: 1, setIndex: 0, slotSetCounts: [3, 3], loggedSets: 6 }),
    lastTriage: {
      kind: 'matched',
      directive: { halt: true, vector: { coaching_cue: 'A later report should not rewrite the terminal runner.' } },
    },
  });
  render(<SessionScreen />);
  expect(screen.getByLabelText('Finish completed session')).toBeOnTheScreen();
  expect(screen.queryByLabelText('Finish the halted session')).toBeNull();
  fireEvent.press(screen.getByLabelText('Finish completed session'));
  expect(mockState.runnerHalt).not.toHaveBeenCalled();
  expect(mockState.endSession).toHaveBeenCalledTimes(1);
});

test('an empty complete runner remains disposable instead of showing completion recognition', () => {
  mockState = state({
    sessionPlan: [],
    activeSessionPlanSlotId: null,
    runner: runner({
      slots: [],
      slotIndex: 0,
      setIndex: 0,
      phase: 'complete',
      slotSetCounts: [],
      loggedSets: 0,
    }),
  });
  render(<SessionScreen />);
  expect(screen.getByLabelText('Finish empty session')).toBeOnTheScreen();
  expect(screen.queryByLabelText('Finish completed session')).toBeNull();
  fireEvent.press(screen.getByLabelText('Finish empty session'));
  expect(mockState.runnerHalt).not.toHaveBeenCalled();
  expect(mockState.endSession).toHaveBeenCalledTimes(1);
});

test('completed timed and band metrics are disclosed and edit through the store', () => {
  mockState = state({
    movements: [movement(1, 'First movement', { supportedPrefixes: ['Banded'] }), movement(2, 'Later movement')],
    session: {
      sessionId: 10,
      date: '2026-07-15',
      startedAtMs: Date.now(),
      sets: [{ set_id: 77, movement_id: 1, movement_name: 'First movement', set_index: 1, reps: 1, load_kg: 0, rpe: 8, tonnage_kg: 0, session_plan_slot_id: 1, timeS: 30, bandLevel: 1 }],
    },
    sessionPlan: [slot(1, 1, 1, { plannedSets: 1 }), slot(2, 2, 8)],
    activeSessionPlanSlotId: 2,
    runner: runner({ slotIndex: 1, slotSetCounts: [1, 0], loggedSets: 1 }),
    bandLadder: [{ level: 1, label: 'Light' }, { level: 2, label: 'Heavy' }],
  });
  render(<SessionScreen />);
  expect(screen.queryByLabelText('Decrease logged duration for set 1')).toBeNull();
  fireEvent.press(screen.getByLabelText('Review logged details, collapsed'));
  fireEvent.press(screen.getByLabelText('Decrease logged duration for set 1'));
  expect(mockState.editSet).toHaveBeenCalledWith(77, 1, 0, 8, { timeS: 25 });
  fireEvent.press(screen.getByLabelText('Set 1 band Heavy'));
  expect(mockState.editSet).toHaveBeenLastCalledWith(77, 1, 0, 8, { bandLevel: 2 });
});

test('idle state has one focused start action', () => {
  mockState = state({ session: null, sessionPlan: [], activeSessionPlanSlotId: null, runner: null, sessionMode: null });
  render(<SessionScreen />);
  expect(screen.getByLabelText('Start a new workout session')).toBeOnTheScreen();
});

test('runner substitution offer: thumbs-down after an earlier set uses runner path and not the legacy preference path', () => {
  // After completing one set, thumbs-down should route through the runner store
  // action (not the legacy setMovementPreference + openSubstitution pair).
  // The runner state has 1 completed set for slot 1 to simulate a mid-session offer.
  mockState = state({
    runner: runner({ slotSetCounts: [1, 0], loggedSets: 1, setIndex: 2 }),
    session: {
      sessionId: 10,
      date: '2026-07-15',
      startedAtMs: Date.now(),
      sets: [{ set_id: 1, movement_id: 1, movement_name: 'First movement', set_index: 1, reps: 5, load_kg: 0, rpe: 8, tonnage_kg: 0, session_plan_slot_id: 1, timeS: null, bandLevel: null }],
    },
  });
  render(<SessionScreen />);
  fireEvent.press(screen.getByLabelText('Avoid First movement and find a substitution'));
  expect(mockState.runnerThumbsDown).toHaveBeenCalledTimes(1);
  // Must NOT touch the legacy paths
  expect(mockState.setMovementPreference).not.toHaveBeenCalled();
  expect(mockState.openSubstitution).not.toHaveBeenCalled();
});

test('session complete phase shows a summary with no active slot controls', () => {
  mockState = state({
    runner: runner({
      phase: 'complete',
      slotIndex: 1,
      setIndex: 0,
      loggedSets: 3,
      slotSetCounts: [2, 1],
    }),
  });
  render(<SessionScreen />);
  // No "log set" action should be present
  expect(screen.queryByLabelText('Log set 1 for First movement')).toBeNull();
  // A session-complete finish action must be visible
  expect(screen.getByLabelText('Finish completed session')).toBeOnTheScreen();
});

test('beginner never renders more than three cues even when the movement detail has more', () => {
  // The 3-cue rendering limit is a Phase 17 plan law for Beginners.
  // If the movement detail supplies more than 3 cue lines, only 3 may appear.
  const fourCueMovement = movement(1, 'First movement', {
    cues: 'Cue one\nCue two\nCue three\nCue four',
    difficulty: 'Beginner',
  });
  mockState = state({ movements: [fourCueMovement, movement(2, 'Later movement')] });
  render(<SessionScreen />);
  fireEvent.press(screen.getByLabelText('How and why, collapsed'));
  // Three cues visible is the maximum
  expect(screen.getByText('• Cue one')).toBeOnTheScreen();
  expect(screen.getByText('• Cue two')).toBeOnTheScreen();
  expect(screen.getByText('• Cue three')).toBeOnTheScreen();
  // The fourth cue must never appear for a Beginner
  expect(screen.queryByText('• Cue four')).not.toBeOnTheScreen();
});

test('relaunch recovery: a runner in resting phase displays correct next-set preview on cold mount', () => {
  // When the app relaunches mid-rest, the SessionScreen must reconstruct the
  // exact runner state from the serialized checkpoint and immediately show the
  // correct "next set" preview without requiring any user action.
  mockState = state({
    runner: runner({
      phase: 'resting',
      setIndex: 2,
      restSecondsTarget: 120,
      restStartedAtMs: Date.now() - 30000,
      restRpe: 8,
      slotSetCounts: [2, 0],
      loggedSets: 2,
    }),
  });
  render(<SessionScreen />);
  // Must show rest UI immediately
  expect(screen.getByText('REST')).toBeOnTheScreen();
  // Must correctly compute next-up from the serialized state
  expect(screen.getByText('Next up: First movement · set 3 of 3')).toBeOnTheScreen();
  // The skip action must remain available (rest timer can still be skipped)
  expect(screen.getByLabelText('Ready now, skip the rest timer')).toBeOnTheScreen();
});

test('post-session Outcome view displays correct copy for all mappings (beginner & non-beginner) and formats date correctly', () => {
  // Test beginner mappings
  const testTimestamp = new Date('2026-07-21T12:00:00Z').getTime(); // Tuesday, 21 July

  const beginnerOutcomes = [
    { kind: 'followed_plan', expected: "You followed today's plan. Recover well." },
    { kind: 'adapted_session', expected: "You adjusted the session and kept the work appropriate." },
    { kind: 'stopped_safely', expected: "Stopping was the right call. Recovery is part of the plan." },
    { kind: 'session_recorded', expected: "Your session is saved. Continue from here next time." },
  ];

  for (const { kind, expected } of beginnerOutcomes) {
    const loadSessionOutcome = jest.fn(() => ({
      outcomeKind: kind,
      finalizedAtMs: testTimestamp,
    }));
    mockState = state({
      session: null,
      lastEndedSessionId: 42,
      profile: { training_age: 'beginner', equipment_inventory: [], session_duration_cap_min: 60 },
      loadSessionOutcome,
    });

    const { unmount } = render(<SessionScreen />);
    expect(screen.getByText(expected)).toBeOnTheScreen();
    expect(screen.getByText('Session saved · Tuesday 21 July')).toBeOnTheScreen();
    unmount();
  }

  // Test non-beginner mappings
  const nonBeginnerOutcomes = [
    { kind: 'followed_plan', expected: "Plan followed." },
    { kind: 'adapted_session', expected: "Session adapted." },
    { kind: 'stopped_safely', expected: "Session stopped safely." },
    { kind: 'session_recorded', expected: "Session recorded." },
  ];

  for (const { kind, expected } of nonBeginnerOutcomes) {
    const loadSessionOutcome = jest.fn(() => ({
      outcomeKind: kind,
      finalizedAtMs: testTimestamp,
    }));
    mockState = state({
      session: null,
      lastEndedSessionId: 42,
      profile: { training_age: 'intermediate', equipment_inventory: [], session_duration_cap_min: 60 },
      loadSessionOutcome,
    });

    const { unmount } = render(<SessionScreen />);
    expect(screen.getByText(expected)).toBeOnTheScreen();
    unmount();
  }

  // Test fallback/neutral mapping (S3: when db returns null)
  mockState = state({
    session: null,
    lastEndedSessionId: 42,
    profile: { training_age: 'beginner', equipment_inventory: [], session_duration_cap_min: 60 },
    loadSessionOutcome: jest.fn(() => null),
  });

  const { unmount } = render(<SessionScreen />);
  expect(screen.getByText("Your session is saved. Continue from here next time.")).toBeOnTheScreen();
  expect(screen.getByText('Session saved')).toBeOnTheScreen();
  
  // Test dismissing the outcome screen (S2)
  expect(screen.getByLabelText("Back to Ready")).toBeOnTheScreen();
  fireEvent.press(screen.getByLabelText("Back to Ready"));
  expect(mockState.dismissOutcome).toHaveBeenCalled();
  unmount();
});