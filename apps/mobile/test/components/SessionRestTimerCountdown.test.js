import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { resolveLoadSelection as actualResolveLoadSelection } from '../../../../packages/inference/src/loadSelection';
import { isDifficultyAllowed as actualIsDifficultyAllowed } from '../../../../packages/inference/src/tierPolicy';
import { RestTimerCard } from '../../src/components/ui/RestTimerCard';
import SessionScreen from '../../src/screens/SessionScreen';

let mockState;

jest.mock('@ak/inference', () => {
  const actual = jest.requireActual('@ak/inference');
  const actualTierPolicy = jest.requireActual('../../../../packages/inference/src/tierPolicy');
  return {
    effectiveRpeCeiling: actual.effectiveRpeCeiling,
    JOINTS: ['shoulder', 'knee'],
    nextUp: jest.fn(() => null),
    targetLoadKg: actual.targetLoadKg,
    resolveLoadSelection: actual.resolveLoadSelection,
    isDifficultyAllowed: actualTierPolicy.isDifficultyAllowed,
    EFFORT_STOP_GUIDANCE: actual.EFFORT_STOP_GUIDANCE,
    EFFORT_BREATHING_NOTE: actual.EFFORT_BREATHING_NOTE,
    effortCue: actual.effortCue,
    mapRirToRpe: actual.mapRirToRpe,
    RIR_CHOICES: actual.RIR_CHOICES,
    RIR_OPTIONS: actual.RIR_OPTIONS,
  };
});

jest.mock('../../src/state/useStore', () => {
  const storeFunc = (selector) => selector({
    getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }),
    ...mockState,
  });
  storeFunc.setState = jest.fn((updates) => Object.assign(mockState, updates));
  storeFunc.getState = jest.fn(() => mockState);
  return {
    palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
    formatTeachingOnlyReason: () => 'Teaching only',
    useStore: storeFunc,
  };
});

const movement = (id, name) => ({
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
  instructions: 'Plant your feet\nBrace your trunk',
  cues: 'Push the floor away\nKeep ribs down',
  media: null,
  targetMuscles: ['chest'],
  coachingIntent: 'Build a simple, repeatable pressing pattern.',
  timePolicy: null,
});

const slot = (id, movementId, reps = 5) => ({
  sessionPlanSlotId: id,
  movementId,
  plannedSets: 3,
  plannedReps: reps,
  target: { kind: 'reps', reps },
  provenanceKind: 'planned',
  targetRpe: 8,
  sourcePlannedSlotId: null,
  originalMovementId: null,
  originalSessionDate: null,
  overrideLoadKg: null,
  overrideReason: null,
});

test('SessionScreen rest timer starts at the full target duration (1:30) and counts down as time elapses', () => {
  const startedAtMs = 1_700_000_000_000;
  const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(startedAtMs);

  mockState = {
    movements: [movement(1, 'First movement')],
    session: {
      sessionId: 10,
      date: '2026-07-15',
      startedAtMs,
      sets: [{
        set_id: 1,
        movement_id: 1,
        movement_name: 'First movement',
        set_index: 1,
        reps: 5,
        load_kg: 0,
        rpe: 8,
        tonnage_kg: 0,
        session_plan_slot_id: 1,
        timeS: null,
        bandLevel: null,
      }],
    },
    sessionPlan: [slot(1, 1)],
    activeSessionPlanSlotId: 1,
    profile: { training_age: 'beginner', equipment_inventory: [], session_duration_cap_min: 60 },
    getMovementAvailabilityVerdicts: () => [{
      movementId: 1,
      state: 'available',
      reasons: [],
      effectiveContext: 'weight_room',
      capabilitySource: 'not_required',
      blockingPrerequisiteMovementIds: [],
      confirmationWouldClear: false,
      separateAttestationRequired: false,
    }],
    movementAvailabilityRevision: 0,
    activeSessionAccessContext: 'weight_room',
    niggles: [],
    oneRepMaxes: {},
    lastLoggedLoads: {},
    lastTriage: null,
    substitution: null,
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
    runner: {
      tier: 'beginner',
      slots: [{ sessionPlanSlotId: 1, movementId: 1, movementName: 'First movement', sets: 3, target: { kind: 'reps', reps: 5 }, targetRpe: 8 }],
      slotIndex: 0,
      setIndex: 1,
      phase: 'resting',
      restSecondsTarget: 90,
      restStartedAtMs: startedAtMs,
      restRpe: 8,
      restSecondsOverride: null,
      slotSetCounts: [1],
      loggedSets: 1,
      substitutionOfferedForSessionPlanSlotId: null,
      haltReason: null,
      skippedSessionPlanSlotIds: [],
      updatedAtMs: startedAtMs,
    },
    sessionMode: 'guided',
    uiPreferences: { sessionModeOverride: null, readinessDetail: 'summary', restTimerEnabled: true, textScale: 'system' },
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
    resolveSlotLoad: (input) => actualResolveLoadSelection({
      trainingAge: 'beginner',
      preference: 'auto',
      bodyweightMode: input.bodyweightMode,
      targetReps: input.targetReps,
      targetRpe: input.targetRpe,
      oneRepMaxKg: null,
      overrideLoadKg: input.overrideLoadKg,
      lastLoggedLoadKg: null,
      currentSessionLoadKg: 0,
      isFirstSet: false,
    }),
  };

  render(<SessionScreen />);

  // At t = 0s of a 90s rest, 1:30 remains (not 0s).
  expect(screen.getByLabelText('Rest timer: 1:30 remaining')).toBeOnTheScreen();
  dateSpy.mockRestore();
});

test('Issue #162: RestTimerCard updates visible numerals every second but throttles accessibilityLabel to 15s/10s/5s/0s boundaries and calls onComplete at 0s', () => {
  jest.useFakeTimers();
  const startedAtMs = 1_700_000_000_000;
  jest.setSystemTime(startedAtMs);
  const onComplete = jest.fn();

  render(
    <RestTimerCard
      totalSeconds={90}
      startedAtMs={startedAtMs}
      onComplete={onComplete}
    />,
  );

  expect(screen.getByText('1:30')).toBeOnTheScreen();
  expect(screen.getByLabelText('Rest timer: 1:30 remaining')).toBeOnTheScreen();

  // After 1 second (89s remaining), visible text is 1:29, but accessibilityLabel
  // stays at 1:30 so TalkBack / UIAutomator is not flooded every second.
  act(() => {
    jest.advanceTimersByTime(1_000);
  });
  expect(screen.getByText('1:29')).toBeOnTheScreen();
  expect(screen.getByLabelText('Rest timer: 1:30 remaining')).toBeOnTheScreen();
  expect(screen.queryByLabelText('Rest timer: 1:29 remaining')).toBeNull();

  // At 15 seconds elapsed (75s remaining), accessibilityLabel updates to 1:15.
  act(() => {
    jest.advanceTimersByTime(14_000);
  });
  expect(screen.getByText('1:15')).toBeOnTheScreen();
  expect(screen.getByLabelText('Rest timer: 1:15 remaining')).toBeOnTheScreen();

  // At 80 seconds elapsed (10s remaining), accessibilityLabel updates to 10s.
  act(() => {
    jest.advanceTimersByTime(65_000);
  });
  expect(screen.getByText('10s')).toBeOnTheScreen();
  expect(screen.getByLabelText('Rest timer: 10s remaining')).toBeOnTheScreen();

  // At 83 seconds elapsed (7s remaining), visible text is 7s, accessibilityLabel stays at 10s.
  act(() => {
    jest.advanceTimersByTime(3_000);
  });
  expect(screen.getByText('7s')).toBeOnTheScreen();
  expect(screen.getByLabelText('Rest timer: 10s remaining')).toBeOnTheScreen();

  // At 85 seconds elapsed (5s remaining), accessibilityLabel updates to 5s.
  act(() => {
    jest.advanceTimersByTime(2_000);
  });
  expect(screen.getByText('5s')).toBeOnTheScreen();
  expect(screen.getByLabelText('Rest timer: 5s remaining')).toBeOnTheScreen();

  // At 90 seconds elapsed (0s remaining), accessibilityLabel updates to 0s and onComplete fires once.
  act(() => {
    jest.advanceTimersByTime(5_000);
  });
  expect(screen.getByText('0s')).toBeOnTheScreen();
  expect(screen.getByLabelText('Rest timer: 0s remaining')).toBeOnTheScreen();
  expect(onComplete).toHaveBeenCalledTimes(1);

  jest.useRealTimers();
});
