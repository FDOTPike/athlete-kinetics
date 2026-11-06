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
const scrollerOf = () => {
  const { ScrollView } = require('react-native');
  return screen.UNSAFE_getAllByType(ScrollView)
    .map((node) => node.instance)
    .find((instance) => instance && typeof instance.scrollTo === 'function');
};

test('after Log set, the workout scrolls the current card (which holds the rest timer) into view', () => {
  const { theme } = require('../../src/theme/theme');
  mockState = makeState({ plannedSets: 3, loggedSets: [] });
  mockState.substitution = null;
  render(<SessionScreen />);
  const scrollTo = jest.spyOn(scrollerOf(), 'scrollTo');

  fireEvent(screen.getByTestId('session-timeline'), 'layout', { nativeEvent: { layout: { x: 0, y: 100, width: 300, height: 500 } } });
  fireEvent(screen.getByTestId('session-current-row'), 'layout', { nativeEvent: { layout: { x: 0, y: 200, width: 300, height: 300 } } });
  expect(scrollTo).not.toHaveBeenCalled();

  fireEvent.press(screen.getByLabelText('Log set 1 for Push-up'));
  fireEvent(screen.getByTestId('session-current-row'), 'layout', { nativeEvent: { layout: { x: 0, y: 200, width: 300, height: 360 } } });
  expect(scrollTo).toHaveBeenCalledTimes(1);
  expect(scrollTo).toHaveBeenCalledWith({ y: 100 + 200 - theme.space[4], animated: true });
});

test('a disabled Log set shows its reason as visible text under the button', () => {
  mockState = makeState({ plannedSets: 3, loggedSets: [] });
  mockState.substitution = null;
  mockState.movements = mockState.movements.map((item) => (item.movement_id === 1 ? { ...item, supportedPrefixes: ['Barbell'] } : item));
  render(<SessionScreen />);
  expect(screen.getByTestId('session-load-input').props.value).toBe('');
  expect(screen.getByLabelText(/Log set 1 for Push-up, unavailable — enter a load first/).props.accessibilityState.disabled).toBe(true);

  // Tree order: the visible reason must come after the Log set button, not above it.
  const order = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    const label = node.props && node.props.accessibilityLabel;
    if (typeof label === 'string' && label.startsWith('Log set 1 for Push-up')) order.push('button');
    if (node.props && node.props.testID === 'session-load-hint') order.push('hint');
    (node.children || []).forEach(walk);
  };
  walk(screen.toJSON());
  expect(order).toContain('hint');
  expect(order.indexOf('hint')).toBeGreaterThan(order.indexOf('button'));
});
