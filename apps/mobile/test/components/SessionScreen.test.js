import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SessionScreen from '../../src/screens/SessionScreen';

let mockState;

jest.mock('@ak/inference', () => ({
  JOINTS: ['shoulder', 'knee'],
  nextUp: jest.fn((runner) => {
    const current = runner.slots[runner.slotIndex];
    const completed = runner.slotSetCounts[runner.slotIndex] ?? 0;
    const nextSetIndex = runner.phase === 'working' ? completed + 2 : completed + 1;
    return nextSetIndex <= current.sets ? { slot: current, setIndex: nextSetIndex } : { slot: runner.slots[1], setIndex: 1 };
  }),
  targetLoadKg: jest.fn(() => 42.5),
}));
jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  useStore: (selector) => selector(mockState),
}));

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
  oneRepMaxes: {}, lastLoggedLoads: {}, lastTriage: null, substitution: null,
  startSession: jest.fn(), selectMovementSlot: jest.fn(), setMovementPreference: jest.fn(),
  openSubstitution: jest.fn(), closeSubstitution: jest.fn(), applyRegression: jest.fn(), applyDaySwap: jest.fn(),
  reportNiggle: jest.fn(), logSet: jest.fn(), editSet: jest.fn(), endSession: jest.fn(),
  runner: runner(), sessionMode: 'guided',
  uiPreferences: { sessionModeOverride: null, readinessDetail: 'summary', restTimerEnabled: true, textScale: 'system' },
  bandLadder: [], advanceRunnerRest: jest.fn(), skipRunnerRest: jest.fn(), runnerThumbsDown: jest.fn(), runnerHalt: jest.fn(),
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