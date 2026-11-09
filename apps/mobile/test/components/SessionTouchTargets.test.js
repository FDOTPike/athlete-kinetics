import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { resolveLoadSelection as actualResolveLoadSelection } from '../../../../packages/inference/src/loadSelection';
import { isDifficultyAllowed as actualIsDifficultyAllowed } from '../../../../packages/inference/src/tierPolicy';
import { resolveMovementAvailability as actualResolveMovementAvailability } from '../../../../packages/inference/src/capabilityResolver';
import { JOINTS as ACTUAL_JOINTS, PATTERN_JOINTS } from '../../../../packages/inference/src/substitution';
import { EXPERIENCE_SEVERITY } from '../../../../packages/inference/src/types';
import SessionScreen from '../../src/screens/SessionScreen';
import { RestTimerCard } from '../../src/components/ui/RestTimerCard';
import { advance as advanceRunner, restSecondsFor as runnerRestSecondsFor } from '../../../../packages/inference/src/sessionRunner';

let mockState;

jest.mock('@ak/inference', () => {
  const actual = jest.requireActual('@ak/inference');
  const actualTierPolicy = jest.requireActual('../../../../packages/inference/src/tierPolicy');
  return {
    effectiveRpeCeiling: actual.effectiveRpeCeiling,
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
    targetLoadKg: actual.targetLoadKg,
    resolveLoadSelection: actual.resolveLoadSelection,
    isDifficultyAllowed: actualTierPolicy.isDifficultyAllowed,
    // W5 effort cues: the screen imports them through the alias; the REAL
    // copy is what the cues tests must assert against.
    EFFORT_STOP_GUIDANCE: actual.EFFORT_STOP_GUIDANCE,
    EFFORT_BREATHING_NOTE: actual.EFFORT_BREATHING_NOTE,
    effortCue: actual.effortCue,
    mapRirToRpe: actual.mapRirToRpe,
    RIR_CHOICES: actual.RIR_CHOICES,
    RIR_OPTIONS: actual.RIR_OPTIONS,
  };
});
const resolveLoadSelectionSpy = jest.fn((input) => actualResolveLoadSelection(input));
jest.mock('../../src/state/useStore', () => {
  const storeFunc = (selector) => selector({ getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }), ...mockState });
  storeFunc.setState = jest.fn((updates) => {
    Object.assign(mockState, updates);
  });
  storeFunc.getState = jest.fn(() => mockState);

  return {
    palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
    formatTeachingOnlyReason: (verdict) => verdict?.reasons.length === 0 ? 'Teaching only' : `Teaching only — ${(verdict?.reasons ?? []).map((r) => r === 'capability' ? 'build the movement below it first' : r).join('; ')}`,
    useStore: storeFunc,
  };
});

const movement = (id, name, overrides = {}) => ({
  movement_id: id, name, pattern: 'push_h', is_compound: true, beginnerOk: true,
  loggingMode: 'reps', required: [], baseName: name, supportedPrefixes: ['Bodyweight'],
  difficulty: 'Beginner', preference: 0, sportTracking: false, scope: null,
  instructions: 'Plant your feet\nBrace your trunk', cues: 'Push the floor away\nKeep ribs down',
  media: { assetKey: `movement/test-${id}/demo/v1`, status: 'external_fallback', revision: 1, fallbackUrl: 'https://www.youtube.com/watch?v=test' },
  targetMuscles: ['chest'], coachingIntent: 'Build a simple, repeatable pressing pattern.', timePolicy: null,
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
  restRpe: null, restSecondsOverride: null, slotSetCounts: [0, 0], loggedSets: 0,
  substitutionOfferedForSessionPlanSlotId: null, haltReason: null, skippedSessionPlanSlotIds: [], updatedAtMs: Date.now(),
  ...overrides,
});
const state = (overrides = {}) => {
  const base = {
    movements: [movement(1, 'First movement'), movement(2, 'Later movement')],
    session: { sessionId: 10, date: '2026-07-15', startedAtMs: Date.now(), sets: [] },
    sessionPlan: [slot(1, 1), slot(2, 2, 8)], activeSessionPlanSlotId: 1,
    profile: { training_age: 'beginner', equipment_inventory: [], session_duration_cap_min: 60 },
    getMovementAvailabilityVerdicts: undefined,
    movementAvailabilityRevision: 0, activeSessionAccessContext: 'weight_room', niggles: [],
    oneRepMaxes: {}, lastLoggedLoads: {}, lastTriage: null, substitution: null,
    startSession: jest.fn(), selectMovementSlot: jest.fn(), setMovementPreference: jest.fn(),
    openSubstitution: jest.fn(), closeSubstitution: jest.fn(), applyRegression: jest.fn(), applyDaySwap: jest.fn(),
    reportNiggle: jest.fn(() => true), logSet: jest.fn(), editSet: jest.fn(), endSession: jest.fn(),
    runner: runner(), sessionMode: 'guided',
    uiPreferences: { sessionModeOverride: null, readinessDetail: 'summary', restTimerEnabled: true, textScale: 'system' },
    bandLadder: [], advanceRunnerRest: jest.fn(), skipRunnerRest: jest.fn(), setRunnerRestOverride: jest.fn(), runnerThumbsDown: jest.fn(), runnerHalt: jest.fn(),
    loadSessionOutcome: jest.fn(() => null),
    dismissOutcome: jest.fn(function() {
      mockState.lastEndedSessionId = null;
    }),
    ...overrides,
  };
  base.getMovementAvailabilityVerdicts = overrides.getMovementAvailabilityVerdicts ?? (() =>
    base.movements.map((item) => {
      const effectiveContext = base.activeSessionAccessContext ?? 'weight_room';
      const tierAllowed = actualIsDifficultyAllowed(
        base.profile.training_age,
        item.difficulty,
        item.beginnerOk,
        effectiveContext,
        item.sportTracking,
      );
      return {
        movementId: item.movement_id,
        state: tierAllowed ? 'available' : 'teaching_only',
        reasons: tierAllowed ? [] : ['tier'],
        effectiveContext,
        capabilitySource: 'not_required',
        blockingPrerequisiteMovementIds: [],
        confirmationWouldClear: false,
        separateAttestationRequired: false,
      };
    }));
  // P2-1 (Opus audit): delegate to the REAL exported resolveLoadSelection.
  // The test adapter gathers store inputs and selects the highest-set_id
  // current-session load, but does NOT reimplement precedence, honesty,
  // advisory, timed, beginner, or bodyweight rules.
  base.loadPreference = base.loadPreference ?? 'auto';
  base.loadPreferenceExplicit = base.loadPreferenceExplicit ?? false;
  base.resolveSlotLoad = jest.fn((input) => {
    const age = base.profile.training_age;
    const pref = base.loadPreference;
    const oneRm = base.oneRepMaxes[input.movementId] ?? null;
    const history = Object.prototype.hasOwnProperty.call(base.lastLoggedLoads, input.movementId)
      ? base.lastLoggedLoads[input.movementId]
      : null;
    const logged = (base.session?.sets ?? []).filter((s) => s.movement_id === input.movementId);
    const latestLogged = logged.reduce((latest, candidate) => latest === null || candidate.set_id > latest.set_id ? candidate : latest, null);
    const currentSessionLoad = latestLogged?.load_kg ?? null;
    return resolveLoadSelectionSpy({
      trainingAge: age,
      preference: pref,
      bodyweightMode: input.bodyweightMode,
      targetReps: input.targetReps,
      targetRpe: input.targetRpe,
      oneRepMaxKg: oneRm,
      overrideLoadKg: input.overrideLoadKg,
      lastLoggedLoadKg: history,
      currentSessionLoadKg: currentSessionLoad,
      isFirstSet: logged.length === 0,
    });
  });
  return base;
};

beforeEach(() => { mockState = state(); });

import { theme } from '../../src/theme/theme';

const minimumSize = (control, axis) => {
  const style = StyleSheet.flatten(control.props.style);
  const hitSlop = control.props.hitSlop ?? 0;
  const extra = typeof hitSlop === 'number' ? 2 * hitSlop : (hitSlop[axis === 'width' ? 'left' : 'top'] ?? 0) + (hitSlop[axis === 'width' ? 'right' : 'bottom'] ?? 0);
  return Math.max(style[axis] ?? 0, style[axis === 'width' ? 'minWidth' : 'minHeight'] ?? 0) + extra;
};

test('both substitution sheet close controls meet the minimum touch size', () => {
  mockState = state({
    session: { sessionId: 10, date: '2026-07-15', startedAtMs: Date.now(), sets: [{ set_id: 1, movement_id: 1, session_plan_slot_id: 1, set_index: 1, reps: 5, load_kg: 0 }] },
    substitution: { targetId: 1, result: { haltAdvised: false, layer1Regression: { options: [{ movement_id: 2, name: 'Later movement', rationale: 'Lighter option.' }] }, layer2DaySwap: { options: [] } } },
  });
  render(<SessionScreen />);
  const checkClose = () => {
    const close = screen.getByLabelText('Close substitution options');
    expect(minimumSize(close, 'width')).toBeGreaterThanOrEqual(theme.touch.min);
    expect(minimumSize(close, 'height')).toBeGreaterThanOrEqual(theme.touch.min);
  };
  checkClose();
  fireEvent.press(screen.getByLabelText('Use Later movement instead'));
  expect(screen.getByText('Sets of Later movement')).toBeOnTheScreen();
  checkClose();
});

test('direct effort entry meets the minimum touch height', () => {
  render(<SessionScreen />);
  expect(minimumSize(screen.getByLabelText('Enter Effort directly'), 'height')).toBeGreaterThanOrEqual(theme.touch.min);
});
