import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { resolveLoadSelection as actualResolveLoadSelection } from '../../../../packages/inference/src/loadSelection';
import { isDifficultyAllowed as actualIsDifficultyAllowed } from '../../../../packages/inference/src/tierPolicy';
import SessionScreen from '../../src/screens/SessionScreen';

let mockState;

jest.mock('@ak/inference', () => {
  const actual = jest.requireActual('@ak/inference');
  const actualTierPolicy = jest.requireActual('../../../../packages/inference/src/tierPolicy');
  return {
    ...actual,
    JOINTS: ['shoulder', 'knee'],
    isDifficultyAllowed: actualTierPolicy.isDifficultyAllowed,
  };
});

jest.mock('../../src/state/useStore', () => {
  const storeFunc = (selector) => selector({ getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }), ...mockState });
  storeFunc.setState = jest.fn((updates) => {
    Object.assign(mockState, updates);
  });
  storeFunc.getState = jest.fn(() => mockState);
  return {
    formatTeachingOnlyReason: () => 'Teaching only',
    freeFormStartIsEmpty: () => false,
    useStore: storeFunc,
  };
});

const movement = (id, name, overrides = {}) => ({
  movement_id: id,
  name,
  pattern: 'push_h',
  is_compound: true,
  beginnerOk: true,
  loggingMode: 'reps',
  required: [],
  baseName: name,
  supportedPrefixes: ['Bodyweight'],
  difficulty: 'Beginner',
  preference: 0,
  sportTracking: false,
  scope: null,
  instructions: 'Plant your feet',
  cues: 'Push the floor away',
  media: null,
  targetMuscles: ['chest'],
  coachingIntent: 'Build a pressing pattern.',
  timePolicy: null,
  ...overrides,
});

const slot = (id, movementId, plannedSets = 3, reps = 5, overrides = {}) => ({
  sessionPlanSlotId: id,
  movementId,
  plannedSets,
  plannedReps: reps,
  target: { kind: 'reps', reps },
  provenanceKind: 'planned',
  targetRpe: 8,
  sourcePlannedSlotId: null,
  originalMovementId: null,
  originalSessionDate: null,
  overrideLoadKg: null,
  overrideReason: null,
  replacedBySessionPlanSlotId: null,
  ...overrides,
});

const loggedSet = (setId, movementId, movementName, setIndex, sessionPlanSlotId) => ({
  set_id: setId,
  movement_id: movementId,
  movement_name: movementName,
  set_index: setIndex,
  reps: 5,
  load_kg: 0,
  rpe: 8,
  tonnage_kg: 0,
  session_plan_slot_id: sessionPlanSlotId,
  timeS: null,
  bandLevel: null,
});

const makeState = ({ plannedSets = 3, loggedSets = [] } = {}) => {
  const movements = [
    movement(1, 'Push-up'),
    movement(2, 'Incline Push-Up'),
    movement(3, 'Knee Push-Up'),
    movement(4, 'Barbell Row'),
  ];
  const base = {
    movements,
    session: { sessionId: 10, date: '2026-10-31', startedAtMs: 1_000, sets: loggedSets },
    sessionPlan: [slot(1, 1, plannedSets, 5), slot(2, 4, 3, 8)],
    activeSessionPlanSlotId: 1,
    profile: { training_age: 'intermediate', equipment_inventory: [], session_duration_cap_min: 60 },
    movementAvailabilityRevision: 0,
    activeSessionAccessContext: 'weight_room',
    niggles: [],
    oneRepMaxes: {},
    lastLoggedLoads: {},
    lastTriage: null,
    substitution: {
      targetId: 1,
      result: {
        haltAdvised: false,
        layer1Regression: {
          options: [
            { movement_id: 3, name: 'Knee Push-Up', rationale: 'Lighter variation.' },
          ],
        },
        layer2DaySwap: {
          options: [
            {
              plannedSlotId: 501,
              fromDayIndex: 2,
              movement_id: 2,
              name: 'Incline Push-Up',
              pattern: 'push_h',
              setsConserved: 2,
              color: 'green',
              rationale: 'Swap from later day.',
            },
          ],
        },
      },
    },
    startSession: jest.fn(),
    selectMovementSlot: jest.fn(),
    setMovementPreference: jest.fn(),
    openSubstitution: jest.fn(),
    closeSubstitution: jest.fn(),
    applyRegression: jest.fn(),
    applyDaySwap: jest.fn(),
    reportNiggle: jest.fn(() => true),
    logSet: jest.fn(),
    editSet: jest.fn(),
    endSession: jest.fn(),
    runner: {
      tier: 'intermediate',
      slots: [
        { sessionPlanSlotId: 1, movementId: 1, movementName: 'Push-up', sets: plannedSets, target: { kind: 'reps', reps: 5 }, targetRpe: 8 },
        { sessionPlanSlotId: 2, movementId: 4, movementName: 'Barbell Row', sets: 3, target: { kind: 'reps', reps: 8 }, targetRpe: 8 },
      ],
      slotIndex: 0,
      setIndex: loggedSets.length + 1,
      phase: 'working',
      restSecondsTarget: 0,
      restStartedAtMs: null,
      restRpe: null,
      restSecondsOverride: null,
      slotSetCounts: [loggedSets.length, 0],
      loggedSets: loggedSets.length,
      substitutionOfferedForSessionPlanSlotId: 1,
      haltReason: null,
      skippedSessionPlanSlotIds: [],
      updatedAtMs: 1_000,
    },
    sessionMode: 'self_directed',
    uiPreferences: { sessionModeOverride: null, readinessDetail: 'full', restTimerEnabled: true, textScale: 'system' },
    bandLadder: [],
    advanceRunnerRest: jest.fn(),
    skipRunnerRest: jest.fn(),
    setRunnerRestOverride: jest.fn(),
    runnerThumbsDown: jest.fn(),
    runnerHalt: jest.fn(),
    loadSessionOutcome: jest.fn(() => null),
    dismissOutcome: jest.fn(),
    loadPreference: 'auto',
    loadPreferenceExplicit: false,
  };
  base.getMovementAvailabilityVerdicts = () =>
    base.movements.map((item) => ({
      movementId: item.movement_id,
      state: actualIsDifficultyAllowed(base.profile.training_age, item.difficulty, item.beginnerOk, 'weight_room', item.sportTracking)
        ? 'available'
        : 'teaching_only',
      reasons: [],
      effectiveContext: 'weight_room',
      capabilitySource: 'not_required',
      blockingPrerequisiteMovementIds: [],
      confirmationWouldClear: false,
      separateAttestationRequired: false,
    }));
  base.resolveSlotLoad = (input) =>
    actualResolveLoadSelection({
      trainingAge: base.profile.training_age,
      loadPreference: 'auto',
      bodyweightMode: input.bodyweightMode,
      targetReps: input.targetReps,
      targetRpe: input.targetRpe,
      oneRepMaxKg: null,
      overrideLoadKg: input.overrideLoadKg,
      currentSessionLoadKg: null,
      historyLoadKg: null,
    });
  return base;
};
const loggedWith = (overrides) => ({ ...loggedSet(101, 1, 'Push-up', 1, 1), reps: 8, load_kg: 80, rpe: 8, tonnage_kg: 640, ...overrides });

// A barbell movement, so the load field exists; its pre-fill follows the latest logged load of this session.
const barbellState = ({ loggedSets = [loggedWith({})] } = {}) => {
  mockState = makeState({ plannedSets: 3, loggedSets });
  mockState.substitution = null;
  mockState.movements = mockState.movements.map((item) => (item.movement_id === 1 ? { ...item, supportedPrefixes: ['Barbell'] } : item));
  mockState.resolveSlotLoad = (input) => actualResolveLoadSelection({
    trainingAge: 'intermediate',
    loadPreference: 'auto',
    bodyweightMode: input.bodyweightMode,
    targetReps: input.targetReps,
    targetRpe: input.targetRpe,
    oneRepMaxKg: null,
    overrideLoadKg: input.overrideLoadKg,
    currentSessionLoadKg: mockState.session.sets[0]?.load_kg ?? null,
    historyLoadKg: null,
  });
  // The store rewrites the set; the screen re-renders from it.
  mockState.editSet = jest.fn((setId, reps, loadKg) => {
    mockState.session = {
      ...mockState.session,
      sets: mockState.session.sets.map((item) => (item.set_id === setId ? { ...item, reps, load_kg: loadKg } : item)),
    };
  });
};

test('the last logged set can be corrected: reps and a load typed on the quarter-kilogram grid go through editSet', () => {
  barbellState();
  render(<SessionScreen />);

  fireEvent.press(screen.getByLabelText('Correct set 1'));
  fireEvent.press(screen.getByLabelText('Increase Corrected reps'));
  fireEvent.changeText(screen.getByTestId('correction-load-input'), '77.25');
  fireEvent.press(screen.getByLabelText('Save correction'));

  expect(mockState.editSet).toHaveBeenCalledTimes(1);
  expect(mockState.editSet).toHaveBeenCalledWith(101, 9, 77.25, 8);
});

test('a correction load off the grid is rejected with the same sentence Log set shows, and Save stays disabled', () => {
  barbellState();
  render(<SessionScreen />);

  fireEvent.press(screen.getByLabelText('Correct set 1'));
  fireEvent.changeText(screen.getByTestId('correction-load-input'), '77.1');

  expect(screen.getByText('Enter a load from 0 to 500 in 0.25 kg steps.')).toBeOnTheScreen();
  expect(screen.getByLabelText('Save correction').props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByLabelText('Save correction'));
  expect(mockState.editSet).not.toHaveBeenCalled();
});

test('a band-only movement corrects reps only and saves 0 kg, as Log set does', () => {
  barbellState();
  mockState.movements = mockState.movements.map((item) => (item.movement_id === 1 ? { ...item, supportedPrefixes: ['Banded'] } : item));
  render(<SessionScreen />);

  fireEvent.press(screen.getByLabelText('Correct set 1'));
  expect(screen.queryByTestId('correction-load-input')).toBeNull();
  fireEvent.press(screen.getByLabelText('Increase Corrected reps'));
  fireEvent.press(screen.getByLabelText('Save correction'));

  expect(mockState.editSet).toHaveBeenCalledWith(101, 9, 0, 8);
});

test('no correction is offered when the current exercise has no logged set', () => {
  barbellState({ loggedSets: [] });
  render(<SessionScreen />);
  expect(screen.queryByLabelText(/Correct set/)).toBeNull();
});

test('no correction is offered for a time-target slot', () => {
  barbellState();
  mockState.sessionPlan = [{ ...mockState.sessionPlan[0], target: { kind: 'time', seconds: 30 } }, mockState.sessionPlan[1]];
  render(<SessionScreen />);
  expect(screen.queryByLabelText(/Correct set/)).toBeNull();
});

test('no correction is offered in a halted session', () => {
  barbellState();
  mockState.runner = { ...mockState.runner, phase: 'halted' };
  render(<SessionScreen />);
  expect(screen.queryByLabelText(/Correct set/)).toBeNull();
});

test('no correction is offered for a set of another exercise', () => {
  barbellState({ loggedSets: [loggedWith({ set_id: 102, movement_id: 4, movement_name: 'Barbell Row', session_plan_slot_id: 2 })] });
  render(<SessionScreen />);
  expect(screen.queryByLabelText(/Correct set/)).toBeNull();
});

test('cancelling a correction leaves the logged set untouched', () => {
  barbellState();
  render(<SessionScreen />);
  fireEvent.press(screen.getByLabelText('Correct set 1'));
  fireEvent.press(screen.getByLabelText('Increase Corrected reps'));
  fireEvent.press(screen.getByLabelText('Cancel correction'));
  expect(mockState.editSet).not.toHaveBeenCalled();
});

test('after a correction the next set pre-fills the corrected load', () => {
  barbellState();
  const { rerender } = render(<SessionScreen />);
  expect(screen.getByTestId('session-load-input').props.value).toBe('80.0');

  fireEvent.press(screen.getByLabelText('Correct set 1'));
  fireEvent.changeText(screen.getByTestId('correction-load-input'), '77.5');
  fireEvent.press(screen.getByLabelText('Save correction'));
  rerender(<SessionScreen />);

  expect(screen.getByTestId('session-load-input').props.value).toBe('77.5');
});

test('a load the athlete is typing for the next set is not overwritten by a correction', () => {
  barbellState();
  const { rerender } = render(<SessionScreen />);
  fireEvent.changeText(screen.getByTestId('session-load-input'), '60');

  fireEvent.press(screen.getByLabelText('Correct set 1'));
  fireEvent.changeText(screen.getByTestId('correction-load-input'), '77.5');
  fireEvent.press(screen.getByLabelText('Save correction'));
  rerender(<SessionScreen />);

  expect(screen.getByTestId('session-load-input').props.value).toBe('60');
});
