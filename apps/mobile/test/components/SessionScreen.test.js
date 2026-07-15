import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SessionScreen from '../../src/screens/SessionScreen';

let mockState;

jest.mock('@ak/inference', () => {
  const conditionEngine = jest.requireActual(
    '../../../../packages/inference/src/conditionEngine',
  );
  return {
    JOINTS: ['shoulder'],
    PATTERN_TO_CATEGORY: { push_h: 'push' },
    TAXONOMY_CATEGORIES: ['push'],
    conditionApplies: conditionEngine.conditionApplies,
    calculateEffectiveLoad: conditionEngine.calculateEffectiveLoad,
    targetLoadKg: jest.fn(() => null),
  };
});

jest.mock('../../src/state/useStore', () => ({
  isMovementAvailable: (movement, inventory) =>
    movement.required.every((item) => inventory.includes(item)),
  palette: {
    bg: '#000000',
    surface: '#15151A',
    line: '#26262E',
    text: '#F4F4F6',
    dim: '#86868F',
    green: '#2EE6A8',
    amber: '#FFB454',
    red: '#FF5D5D',
  },
  useStore: (selector) => selector(mockState),
}));

const movement = (movementId, name, difficulty, beginnerOk, supportedPrefixes = ['Bodyweight']) => ({
  movement_id: movementId,
  name,
  pattern: 'push_h',
  is_compound: true,
  beginnerOk,
  loggingMode: 'reps',
  required: [],
  baseName: name,
  supportedPrefixes,
  difficulty,
  preference: 0,
});

const condition = (prefixName) => ({
  prefixName,
  cnsLoadModifier: 1,
  stabilityRequirementModifier: 1,
  difficultyModifier: 1,
});

const activeSessionState = (overrides = {}) => ({
  movements: [movement(1, 'Active Movement', 'Beginner', false)],
  session: {
    sessionId: 10,
    date: '2026-07-14',
    startedAtMs: Date.now(),
    sets: [],
  },
  sessionPlan: [{
    sessionPlanSlotId: 1,
    movementId: 1,
    plannedSets: 3,
    plannedReps: 5,
    provenanceKind: 'planned',
    targetRpe: 8.0,
    sourcePlannedSlotId: null,
    originalMovementId: null,
    originalSessionDate: null,
    overrideLoadKg: null,
    overrideReason: null,
  }],
  activeSessionPlanSlotId: 1,
  activeMovementId: 1,
  profile: {
    training_age: 'beginner',
    equipment_inventory: [],
    session_duration_cap_min: 60,
  },
  lastTriage: null,
  block: null,
  todayPlan: null,
  oneRepMaxes: {},
  lastEndedSessionId: null,
  substitution: null,
  niggles: [],
  movementPrefixes: [],
  saveSessionNote: jest.fn(),
  startSession: jest.fn(),
  selectMovement: jest.fn(),
  selectMovementSlot: jest.fn(),
  addPlanSlot: jest.fn(),
  swapMovement: jest.fn(),
  setMovementPreference: jest.fn(),
  openSubstitution: jest.fn(),
  closeSubstitution: jest.fn(),
  applyRegression: jest.fn(),
  applyDaySwap: jest.fn(),
  reportNiggle: jest.fn(),
  logSet: jest.fn(),
  deleteSet: jest.fn(),
  editSet: jest.fn(),
  endSession: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  jest.useFakeTimers();
  mockState = activeSessionState();
});

afterEach(() => {
  jest.useRealTimers();
});

test('a beginner picker offers only Beginner movements and whitelist members', () => {
  mockState = activeSessionState({
    movements: [
      movement(1, 'Active Movement', 'Beginner', false),
      movement(2, 'Beginner Foundation', 'Beginner', false),
      movement(3, 'Whitelisted Staple', 'Intermediate', true),
      movement(4, 'Unapproved Intermediate', 'Intermediate', false),
      movement(5, 'Advanced Specialist', 'Advanced', false),
    ],
  });

  render(<SessionScreen />);
  fireEvent.press(screen.getByLabelText('Add a movement to the plan'));

  const pushGroup = screen.getByLabelText('PUSH, 2 movements, collapsed');
  fireEvent.press(pushGroup);

  expect(screen.getByLabelText('Add Beginner Foundation')).toBeOnTheScreen();
  expect(screen.getByLabelText('Add Whitelisted Staple')).toBeOnTheScreen();
  expect(screen.queryByText('Unapproved Intermediate')).not.toBeOnTheScreen();
  expect(screen.queryByText('Advanced Specialist')).not.toBeOnTheScreen();
});

test('condition chips disappear when the selected implement cannot carry them', () => {
  mockState = activeSessionState({
    movements: [movement(1, 'Convertible Press', 'Beginner', false, ['BB', 'Bodyweight'])],
    movementPrefixes: [
      condition('Banded'),
      condition('Earthquake Bar'),
      condition('Chains'),
      condition('Bottom-Up'),
    ],
  });

  render(<SessionScreen />);

  expect(screen.getByLabelText('Condition Banded')).toBeOnTheScreen();
  expect(screen.getByLabelText('Condition Earthquake Bar')).toBeOnTheScreen();
  expect(screen.getByLabelText('Condition Chains')).toBeOnTheScreen();
  expect(screen.queryByLabelText('Condition Bottom-Up')).not.toBeOnTheScreen();

  fireEvent.press(screen.getByLabelText('Implement Bodyweight'));

  expect(screen.getByLabelText('Condition Banded')).toBeOnTheScreen();
  expect(screen.queryByLabelText('Condition Earthquake Bar')).not.toBeOnTheScreen();
  expect(screen.queryByLabelText('Condition Chains')).not.toBeOnTheScreen();
  expect(screen.queryByLabelText('Condition Bottom-Up')).not.toBeOnTheScreen();
});

test('SessionScreen renders its idle state without a snapshot', () => {
  mockState = activeSessionState({ session: null, sessionPlan: [], activeMovementId: null });

  render(<SessionScreen />);

  expect(screen.getByLabelText('Start a new workout session')).toBeOnTheScreen();
});