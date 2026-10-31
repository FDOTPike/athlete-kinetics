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

test('picker appears only when the slot has logged sets; with 0 logged sets tapping an option applies immediately', () => {
  mockState = makeState({ plannedSets: 3, loggedSets: [] });
  render(<SessionScreen />);

  expect(screen.queryByText('Sets of Knee Push-Up')).toBeNull();
  fireEvent.press(screen.getByLabelText('Use Knee Push-Up instead'));
  expect(mockState.applyRegression).toHaveBeenCalledTimes(1);
  expect(mockState.applyRegression).toHaveBeenCalledWith(1, 3);
  expect(screen.queryByText('Sets of Knee Push-Up')).toBeNull();

  const daySwapOption = mockState.substitution.result.layer2DaySwap.options[0];
  fireEvent.press(screen.getByLabelText('Move Incline Push-Up forward into this session'));
  expect(mockState.applyDaySwap).toHaveBeenCalledTimes(1);
  expect(mockState.applyDaySwap).toHaveBeenCalledWith(1, daySwapOption);
});

test('with 1 logged set of 4 planned, choosing an option shows picker with singular caption and preselected chip 3, and confirm calls action with chosen count', () => {
  mockState = makeState({
    plannedSets: 4,
    loggedSets: [loggedSet(101, 1, 'Push-up', 1, 1)],
  });
  render(<SessionScreen />);

  fireEvent.press(screen.getByLabelText('Use Knee Push-Up instead'));
  expect(mockState.applyRegression).not.toHaveBeenCalled();

  expect(screen.getByText('Sets of Knee Push-Up')).toBeOnTheScreen();
  expect(screen.getByText('1 logged set of Push-up is kept.')).toBeOnTheScreen();

  const chip1 = screen.getByLabelText('1 set of Knee Push-Up');
  const chip2 = screen.getByLabelText('2 sets of Knee Push-Up');
  const chip3 = screen.getByLabelText('3 sets of Knee Push-Up');
  const chip4 = screen.getByLabelText('4 sets of Knee Push-Up');
  const chip5 = screen.getByLabelText('5 sets of Knee Push-Up');
  const chip6 = screen.getByLabelText('6 sets of Knee Push-Up');

  expect(chip1.props.accessibilityState.selected).toBe(false);
  expect(chip2.props.accessibilityState.selected).toBe(false);
  expect(chip3.props.accessibilityState.selected).toBe(true);
  expect(chip4.props.accessibilityState.selected).toBe(false);
  expect(chip5.props.accessibilityState.selected).toBe(false);
  expect(chip6.props.accessibilityState.selected).toBe(false);

  // Select chip 2 and confirm
  fireEvent.press(chip2);
  expect(screen.getByLabelText('2 sets of Knee Push-Up').props.accessibilityState.selected).toBe(true);

  fireEvent.press(screen.getByLabelText('Use Knee Push-Up instead'));
  expect(mockState.applyRegression).toHaveBeenCalledTimes(1);
  expect(mockState.applyRegression).toHaveBeenCalledWith(1, 3, 2);
});

test('with 2 logged sets and loggedSets >= plannedSets, preselected chip is clamped to 1..6 and plural caption is shown', () => {
  // Case A: plannedSets = 2, loggedSets = 2 -> clamp(2 - 2, 1, 6) = 1
  mockState = makeState({
    plannedSets: 2,
    loggedSets: [
      loggedSet(102, 1, 'Push-up', 2, 1),
      loggedSet(101, 1, 'Push-up', 1, 1),
    ],
  });
  // Keep slot incomplete on screen by setting plannedSets = 2 while testing loggedSets >= plannedSets (or 2 of 2 before slot completion)
  mockState.sessionPlan[0].plannedSets = 3;
  const view = render(<SessionScreen />);

  const daySwapOption = mockState.substitution.result.layer2DaySwap.options[0];
  fireEvent.press(screen.getByLabelText('Move Incline Push-Up forward into this session'));
  expect(mockState.applyDaySwap).not.toHaveBeenCalled();

  expect(screen.getByText('Sets of Incline Push-Up')).toBeOnTheScreen();
  expect(screen.getByText('2 logged sets of Push-up are kept.')).toBeOnTheScreen();
  expect(screen.getByLabelText('1 set of Incline Push-Up').props.accessibilityState.selected).toBe(true);

  // Also test when loggedSets >= plannedSets (e.g. 3 logged sets on a 2-set slot in runner working state)
  view.unmount();
  mockState = makeState({
    plannedSets: 2,
    loggedSets: [
      loggedSet(103, 1, 'Push-up', 3, 1),
      loggedSet(102, 1, 'Push-up', 2, 1),
      loggedSet(101, 1, 'Push-up', 1, 1),
    ],
  });
  // Keep a second incomplete slot so the session itself is not marked complete
  render(<SessionScreen />);
  fireEvent.press(screen.getByLabelText('Move Incline Push-Up forward into this session'));
  expect(screen.getByText('3 logged sets of Push-up are kept.')).toBeOnTheScreen();
  expect(screen.getByLabelText('1 set of Incline Push-Up').props.accessibilityState.selected).toBe(true);

  fireEvent.press(screen.getByLabelText('4 sets of Incline Push-Up'));
  fireEvent.press(screen.getByLabelText('Move Incline Push-Up forward into this session'));
  expect(mockState.applyDaySwap).toHaveBeenCalledTimes(1);
  expect(mockState.applyDaySwap).toHaveBeenCalledWith(1, daySwapOption, 4);
});

test('Cancel and Close return without changing anything', () => {
  mockState = makeState({
    plannedSets: 3,
    loggedSets: [loggedSet(101, 1, 'Push-up', 1, 1)],
  });
  render(<SessionScreen />);

  fireEvent.press(screen.getByLabelText('Use Knee Push-Up instead'));
  expect(screen.getByText('Sets of Knee Push-Up')).toBeOnTheScreen();

  // Press Cancel -> returns to the option list without calling applyRegression or applyDaySwap
  fireEvent.press(screen.getByLabelText('Cancel'));
  expect(mockState.applyRegression).not.toHaveBeenCalled();
  expect(mockState.applyDaySwap).not.toHaveBeenCalled();
  expect(screen.queryByText('Sets of Knee Push-Up')).toBeNull();
  expect(screen.getByText('Choose an alternative')).toBeOnTheScreen();

  // Open picker again and press Close substitution options (×) -> closes without calling applyRegression or applyDaySwap
  fireEvent.press(screen.getByLabelText('Move Incline Push-Up forward into this session'));
  expect(screen.getByText('Sets of Incline Push-Up')).toBeOnTheScreen();
  fireEvent.press(screen.getByLabelText('Close substitution options'));
  expect(mockState.applyRegression).not.toHaveBeenCalled();
  expect(mockState.applyDaySwap).not.toHaveBeenCalled();
  expect(mockState.closeSubstitution).toHaveBeenCalledTimes(1);
});
