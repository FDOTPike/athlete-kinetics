import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { resolveLoadSelection as actualResolveLoadSelection } from '../../../../packages/inference/src/loadSelection';
import { isDifficultyAllowed as actualIsDifficultyAllowed } from '../../../../packages/inference/src/tierPolicy';
import { resolveMovementAvailability as actualResolveMovementAvailability } from '../../../../packages/inference/src/capabilityResolver';
import { JOINTS as ACTUAL_JOINTS, PATTERN_JOINTS } from '../../../../packages/inference/src/substitution';
import { EXPERIENCE_SEVERITY } from '../../../../packages/inference/src/types';
import SessionScreen from '../../src/screens/SessionScreen';

let mockState;

jest.mock('@ak/inference', () => {
  const actual = jest.requireActual('@ak/inference');
  const actualTierPolicy = jest.requireActual('../../../../packages/inference/src/tierPolicy');
  return {
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
  };
});
const resolveLoadSelectionSpy = jest.fn((input) => actualResolveLoadSelection(input));
jest.mock('../../src/state/useStore', () => {
  const storeFunc = (selector) => selector(mockState);
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
    reportNiggle: jest.fn(), logSet: jest.fn(), editSet: jest.fn(), endSession: jest.fn(),
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

test('keeps all current-set values visible in a phone-width vertical stack', () => {
  render(<SessionScreen />);

  expect(StyleSheet.flatten(screen.getByTestId('current-set-steppers').props.style)).toMatchObject({
    flexDirection: 'column',
  });

  const usablePhoneWidth = 411 - 40;
  [
    ['current-reps-stepper', 'Reps', 'Reps 5', '5'],
    ['current-rpe-stepper', 'Actual RPE', 'Actual RPE 8.0', '8.0'],
  ].forEach(([testID, label, accessibilityLabel, expectedValue]) => {
    expect(StyleSheet.flatten(screen.getByTestId(testID).props.style)).toMatchObject({
      flex: 0,
      width: '100%',
    });
    const valueText = screen.getByLabelText(accessibilityLabel);
    expect(valueText.props.children).toBe(expectedValue);
    expect(expectedValue).not.toHaveLength(0);

    const valueStyle = StyleSheet.flatten(valueText.props.style);
    const decrementStyle = StyleSheet.flatten(screen.getByLabelText(`Decrease ${label}`).props.style);
    const incrementStyle = StyleSheet.flatten(screen.getByLabelText(`Increase ${label}`).props.style);
    expect(decrementStyle).toMatchObject({ width: 88, flexShrink: 0 });
    expect(incrementStyle).toMatchObject({ width: 88, flexShrink: 0 });
    expect(decrementStyle.width + valueStyle.minWidth + incrementStyle.width)
      .toBeLessThanOrEqual(usablePhoneWidth);
  });

  // Load is a direct-entry field with ±2.5 adjust controls (four-mode load
  // selection): label uppercase, adjust buttons at the Stepper's 88pt pads,
  // and the whole composition fits the phone-width stack.
  expect(screen.getByTestId('session-load-label').props.children).toBe('ADDED KG (0 = BODYWEIGHT)');
  const inputStyle = StyleSheet.flatten(screen.getByTestId('session-load-input').props.style);
  const decStyle = StyleSheet.flatten(screen.getByLabelText('Decrease load by 2.5 kilograms').props.style);
  const incStyle = StyleSheet.flatten(screen.getByLabelText('Increase load by 2.5 kilograms').props.style);
  expect(decStyle).toMatchObject({ width: 88, flexShrink: 0 });
  expect(incStyle).toMatchObject({ width: 88, flexShrink: 0 });
  expect(decStyle.width + inputStyle.minWidth + incStyle.width).toBeLessThanOrEqual(usablePhoneWidth);
});
test('bodyweight load is added weight and never a normal 1RM suggestion', () => {
  mockState = state({ oneRepMaxes: { 1: 100 } });

  render(<SessionScreen />);

  expect(screen.getByTestId('session-load-input').props.value).toBe('0.0');
  expect(screen.getByText('0 kg means bodyweight only. Add weight when you need it.')).toBeOnTheScreen();
});

test('externally loaded movement keeps its normal load and 1RM suggestion', () => {
  mockState = state({
    movements: [
      movement(1, 'First movement', { supportedPrefixes: ['Barbell'] }),
      movement(2, 'Later movement'),
    ],
    oneRepMaxes: { 1: 100 },
    profile: { training_age: 'intermediate', equipment_inventory: [], session_duration_cap_min: 60 },
  });

  render(<SessionScreen />);

  expect(screen.getByTestId('session-load-input').props.value).toBe('80.0');
  expect(screen.getByText('Based on your 100.0 kg 1RM')).toBeOnTheScreen();
});

test('seeded external load stays blank and cannot log until explicitly entered', () => {
  mockState = state({
    movements: [
      movement(1, 'First movement', { supportedPrefixes: ['Barbell'] }),
      movement(2, 'Later movement'),
    ],
    profile: { training_age: 'intermediate', equipment_inventory: [], session_duration_cap_min: 60 },
  });

  render(<SessionScreen />);

  expect(screen.getByTestId('session-load-input').props.value).toBe('');
  expect(screen.getByText('First time on this one — pick a weight you could lift about ten times.')).toBeOnTheScreen();
  expect(screen.getByText('Enter a load to log this set.')).toBeOnTheScreen();
  expect(screen.getByLabelText(/Log set 1 for First movement, unavailable/).props.accessibilityState.disabled).toBe(true);
});

test('history auto source prefills the exact latest logged load, including source accessibility copy', () => {
  mockState = state({
    movements: [
      movement(1, 'First movement', { supportedPrefixes: ['Barbell'] }),
      movement(2, 'Later movement'),
    ],
    profile: { training_age: 'intermediate', equipment_inventory: [], session_duration_cap_min: 60 },
    lastLoggedLoads: { 1: 37.5 },
  });

  render(<SessionScreen />);

  expect(screen.getByTestId('session-load-input').props.value).toBe('37.5');
  expect(screen.getByLabelText('Load source. Last logged 37.5 kg')).toBeOnTheScreen();
});

test('APRE auto source prefills the absolute prescription ahead of other evidence', () => {
  mockState = state({
    movements: [
      movement(1, 'First movement', { supportedPrefixes: ['Barbell'] }),
      movement(2, 'Later movement'),
    ],
    profile: { training_age: 'advanced', equipment_inventory: [], session_duration_cap_min: 60 },
    loadPreference: 'auto',
    oneRepMaxes: { 1: 100 },
    lastLoggedLoads: { 1: 37.5 },
    sessionPlan: [slot(1, 1, 5, { overrideLoadKg: 55 }), slot(2, 2, 8)],
  });

  render(<SessionScreen />);

  expect(screen.getByTestId('session-load-input').props.value).toBe('55.0');
  expect(screen.getByText('Prescribed 55.0 kg')).toBeOnTheScreen();
});

test('manual first set shows APRE as advice without prefilling authoritative entry', () => {
  mockState = state({
    movements: [
      movement(1, 'First movement', { supportedPrefixes: ['Barbell'] }),
      movement(2, 'Later movement'),
    ],
    profile: { training_age: 'advanced', equipment_inventory: [], session_duration_cap_min: 60 },
    loadPreference: 'manual',
    oneRepMaxes: { 1: 100 },
    lastLoggedLoads: { 1: 37.5 },
    sessionPlan: [slot(1, 1, 5, { overrideLoadKg: 55 }), slot(2, 2, 8)],
  });

  render(<SessionScreen />);

  expect(screen.getByTestId('session-load-input').props.value).toBe('');
  expect(screen.getByLabelText('Load source. Coach suggests 55.0 kg — your entry stands.')).toBeOnTheScreen();
  expect(screen.getByLabelText(/Log set 1 for First movement, unavailable/).props.accessibilityState.disabled).toBe(true);
});

test('manual bodyweight initializes identity load 0.0 and remains loggable', () => {
  mockState = state({
    profile: { training_age: 'intermediate', equipment_inventory: [], session_duration_cap_min: 60 },
    loadPreference: 'manual',
  });

  render(<SessionScreen />);

  expect(screen.getByTestId('session-load-input').props.value).toBe('0.0');
  fireEvent.press(screen.getByLabelText('Log set 1 for First movement'));
  expect(mockState.logSet).toHaveBeenCalledWith(
    1, 5, 0, null,
    undefined, undefined, undefined, undefined, 1,
  );
});

test('manual subsequent set carries the latest actual current-session load', () => {
  const loggedSets = [
    { set_id: 20, movement_id: 1, movement_name: 'First movement', set_index: 2, reps: 5, load_kg: 47.5, rpe: 8, tonnage_kg: 237.5, session_plan_slot_id: 1, timeS: null, bandLevel: null },
    { set_id: 10, movement_id: 1, movement_name: 'First movement', set_index: 1, reps: 5, load_kg: 40, rpe: 8, tonnage_kg: 200, session_plan_slot_id: 1, timeS: null, bandLevel: null },
  ];
  mockState = state({
    profile: { training_age: 'intermediate', equipment_inventory: [], session_duration_cap_min: 60 },
    loadPreference: 'manual',
    session: { sessionId: 10, date: '2026-07-15', startedAtMs: Date.now(), sets: loggedSets },
    runner: runner({ setIndex: 3, slotSetCounts: [2, 0], loggedSets: 2 }),
  });

  render(<SessionScreen />);

  expect(screen.getByTestId('session-load-input').props.value).toBe('47.5');
  expect(screen.getByText('Your call. The number you enter is what gets logged.')).toBeOnTheScreen();
});

test('timed work cannot derive from 1RM and uses interval-specific seeded copy', () => {
  mockState = state({
    movements: [
      movement(1, 'First movement', { supportedPrefixes: ['Barbell'], loggingMode: 'time' }),
      movement(2, 'Later movement'),
    ],
    profile: { training_age: 'intermediate', equipment_inventory: [], session_duration_cap_min: 60 },
    oneRepMaxes: { 1: 100 },
    sessionPlan: [
      slot(1, 1, 5, { target: { kind: 'time', seconds: 30 } }),
      slot(2, 2, 8),
    ],
  });

  render(<SessionScreen />);

  expect(screen.getByTestId('session-load-input').props.value).toBe('');
  expect(screen.getByText('First time on this one — choose a load you can control for the full interval.')).toBeOnTheScreen();
  expect(screen.queryByText(/Based on your 100\.0 kg 1RM/)).toBeNull();
});

test('invalid draft is distinct from blank, while explicit zero is valid and loggable', () => {
  mockState = state({
    movements: [
      movement(1, 'First movement', { supportedPrefixes: ['Barbell'] }),
      movement(2, 'Later movement'),
    ],
    profile: { training_age: 'intermediate', equipment_inventory: [], session_duration_cap_min: 60 },
  });
  render(<SessionScreen />);

  expect(screen.queryByTestId('session-load-validation')).toBeNull();
  fireEvent.changeText(screen.getByTestId('session-load-input'), '12kg');
  expect(screen.getByLabelText('Load validation. Enter a load from 0 to 500 in 2.5 kg increments.')).toBeOnTheScreen();
  fireEvent.changeText(screen.getByTestId('session-load-input'), '0');
  expect(screen.queryByTestId('session-load-validation')).toBeNull();
  fireEvent.press(screen.getByLabelText('Log set 1 for First movement'));
  expect(mockState.logSet).toHaveBeenCalledWith(
    1, 5, 0, null,
    undefined, undefined, undefined, undefined, 1,
  );
});

test('athlete-entered load survives a rerender and refreshed history evidence', () => {
  mockState = state({
    movements: [
      movement(1, 'First movement', { supportedPrefixes: ['Barbell'] }),
      movement(2, 'Later movement'),
    ],
    profile: { training_age: 'intermediate', equipment_inventory: [], session_duration_cap_min: 60 },
  });
  const view = render(<SessionScreen />);

  fireEvent.changeText(screen.getByTestId('session-load-input'), '32.5');
  mockState.lastLoggedLoads = { 1: 80 };
  view.rerender(<SessionScreen />);

  expect(screen.getByTestId('session-load-input').props.value).toBe('32.5');
});


test('guided mode keeps only the current movement expanded and future work unavailable', () => {
  render(<SessionScreen />);
  expect(screen.getByText('First movement')).toBeOnTheScreen();
  const future = screen.getByLabelText('Later movement, upcoming, 3 × 8');
  expect(future.props.accessibilityState.disabled).toBe(true);
  expect(screen.getByLabelText('Log set 1 for First movement')).toBeOnTheScreen();
});

test('untouched actual RPE logs null instead of fabricating target equality', () => {
  render(<SessionScreen />);

  expect(screen.getByText('Unanswered RPE is left out of Coach evidence.')).toBeOnTheScreen();
  fireEvent.press(screen.getByLabelText('Log set 1 for First movement'));

  expect(mockState.logSet).toHaveBeenCalledWith(
    1, 5, 0, null,
    undefined, undefined, undefined, undefined, 1,
  );
});

test('explicit confirmation records a genuine exact-target RPE', () => {
  render(<SessionScreen />);

  fireEvent.press(screen.getByLabelText('Confirm actual RPE 8.0'));
  expect(screen.getByText('This actual RPE will be used as Coach evidence.')).toBeOnTheScreen();
  fireEvent.press(screen.getByLabelText('Log set 1 for First movement'));

  expect(mockState.logSet).toHaveBeenCalledWith(
    1, 5, 0, 8,
    undefined, undefined, undefined, undefined, 1,
  );
});

test('adjusting actual RPE marks and records the changed answer', () => {
  render(<SessionScreen />);

  fireEvent.press(screen.getByLabelText('Increase Actual RPE'));
  expect(screen.getByLabelText('Actual RPE 8.5')).toBeOnTheScreen();
  fireEvent.press(screen.getByLabelText('Log set 1 for First movement'));

  expect(mockState.logSet).toHaveBeenCalledWith(
    1, 5, 0, 8.5,
    undefined, undefined, undefined, undefined, 1,
  );
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
test('session rest override changes by 15 seconds and persists through the runner action', () => {
  mockState = state({
    runner: runner({
      phase: 'resting',
      setIndex: 1,
      restSecondsTarget: 90,
      restStartedAtMs: Date.now(),
      restRpe: 8,
      restSecondsOverride: 90,
      slotSetCounts: [1, 0],
      loggedSets: 1,
    }),
  });

  render(<SessionScreen />);

  expect(screen.getByLabelText('Session rest seconds 90')).toBeOnTheScreen();
  expect(screen.getByText('Applies to this session.')).toBeOnTheScreen();
  fireEvent.press(screen.getByLabelText('Increase Session rest seconds'));
  expect(mockState.setRunnerRestOverride).toHaveBeenCalledWith(105);
  fireEvent.press(screen.getByLabelText('Decrease Session rest seconds'));
  expect(mockState.setRunnerRestOverride).toHaveBeenCalledWith(75);
});


test('final-set rest stays visible so the next movement can advance', () => {
  const completedSets = Array.from({ length: 3 }, (_, index) => ({
    set_id: index + 1,
    movement_id: 1,
    movement_name: 'First movement',
    set_index: index + 1,
    reps: 5,
    load_kg: 0,
    rpe: 8,
    tonnage_kg: 0,
    session_plan_slot_id: 1,
    timeS: null,
    bandLevel: null,
  }));
  mockState = state({
    session: { sessionId: 10, date: '2026-07-15', startedAtMs: Date.now(), sets: completedSets },
    runner: runner({
      phase: 'resting',
      setIndex: 3,
      restSecondsTarget: 120,
      restStartedAtMs: Date.now(),
      restRpe: 8,
      slotSetCounts: [3, 0],
      loggedSets: 3,
    }),
  });

  render(<SessionScreen />);

  expect(screen.getByText('1 of 2 exercises complete')).toBeOnTheScreen();
  expect(screen.getByText('REST')).toBeOnTheScreen();
  expect(screen.getByText(/^Next up: Later movement .* set 1 of 3$/)).toBeOnTheScreen();
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

test('an intermediate athlete never renders a plan containing an advanced movement', () => {
  mockState = state({
    profile: { training_age: 'intermediate', equipment_inventory: [], session_duration_cap_min: 60 },
    movements: [movement(1, 'First movement'), movement(2, 'Advanced movement', { difficulty: 'Advanced', beginnerOk: false })],
  });
  render(<SessionScreen />);
  expect(screen.getByText('This plan needs Coach review.')).toBeOnTheScreen();
  expect(screen.queryByText('Advanced movement')).toBeNull();
});

test('an active session with no frozen access context fails closed', () => {
  mockState = state({ activeSessionAccessContext: null });
  render(<SessionScreen />);
  expect(screen.getByText('This plan needs Coach review.')).toBeOnTheScreen();
  expect(screen.queryByText('First movement')).toBeNull();
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
      sets: [{ set_id: 77, movement_id: 1, movement_name: 'First movement', set_index: 1, reps: 1, load_kg: 0, rpe: null, tonnage_kg: 0, session_plan_slot_id: 1, timeS: 30, bandLevel: 1 }],
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
  expect(mockState.editSet).toHaveBeenCalledWith(77, 1, 0, null, { timeS: 25 });
  fireEvent.press(screen.getByLabelText('Set 1 band Heavy'));
  expect(mockState.editSet).toHaveBeenLastCalledWith(77, 1, 0, null, { bandLevel: 2 });
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

// --- P1-2: grid/range validation tests ---------------------------------------
test('off-grid load 1 shows validation, disables Log set, and never calls logSet', () => {
  render(<SessionScreen />);
  fireEvent.changeText(screen.getByTestId('session-load-input'), '1');
  expect(screen.getByTestId('session-load-validation')).toBeOnTheScreen();
  expect(screen.getByLabelText('Log set 1 for First movement, unavailable — enter a load first')).toBeOnTheScreen();
  fireEvent.press(screen.getByLabelText(/Log set 1 for First movement/));
  expect(mockState.logSet).not.toHaveBeenCalled();
});

test('off-grid load 61 shows validation and never calls logSet', () => {
  render(<SessionScreen />);
  fireEvent.changeText(screen.getByTestId('session-load-input'), '61');
  expect(screen.getByTestId('session-load-validation')).toBeOnTheScreen();
  fireEvent.press(screen.getByLabelText(/Log set 1 for First movement/));
  expect(mockState.logSet).not.toHaveBeenCalled();
});

test('out-of-range load 500.1 is rejected rather than becoming 500', () => {
  render(<SessionScreen />);
  fireEvent.changeText(screen.getByTestId('session-load-input'), '500.1');
  expect(screen.getByTestId('session-load-validation')).toBeOnTheScreen();
  fireEvent.press(screen.getByLabelText(/Log set 1 for First movement/));
  expect(mockState.logSet).not.toHaveBeenCalled();
});

test.each([
  ['0', 0],
  ['0.0', 0],
  ['2.5', 2.5],
  ['2,5', 2.5],
  ['60', 60],
  ['500', 500],
])('valid grid value %s is loggable and reaches logSet unchanged', (value, expected) => {
  render(<SessionScreen />);
  fireEvent.changeText(screen.getByTestId('session-load-input'), value);
  fireEvent.press(screen.getByLabelText('Log set 1 for First movement'));
  expect(mockState.logSet).toHaveBeenCalledWith(
    1, 5, expected, null, undefined, undefined, undefined, undefined, 1,
  );
});

// --- Sol P2-02: direct-entry syntax boundary matrix ---------------------------
test.each(['-2.5', '-0', '0x1F', 'NaN', 'Infinity', '1e2', '2.5.5'])(
  'non-decimal draft %s shows validation, retains the draft, and never calls logSet',
  (raw) => {
    render(<SessionScreen />);
    fireEvent.changeText(screen.getByTestId('session-load-input'), raw);
    expect(screen.getByTestId('session-load-validation')).toBeOnTheScreen();
    expect(screen.getByTestId('session-load-input').props.value).toBe(raw);
    expect(screen.getByLabelText('Log set 1 for First movement, unavailable — enter a load first')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText(/Log set 1 for First movement/));
    expect(mockState.logSet).not.toHaveBeenCalled();
  },
);

// --- Sol P2-01 falsifier: the adapter passes the persisted preference through -
test('beginner fixture with persisted manual preference reaches the real resolver unnormalized', () => {
  const fixture = () => state({
    movements: [
      movement(1, 'First movement', { supportedPrefixes: ['Barbell'] }),
      movement(2, 'Later movement'),
    ],
    oneRepMaxes: { 1: 100 },
  });
  mockState = fixture();
  mockState.loadPreference = 'manual';
  mockState.loadPreferenceExplicit = true;
  const first = render(<SessionScreen />);
  const manualInputs = resolveLoadSelectionSpy.mock.calls.map(([input]) => input);
  expect(manualInputs.length).toBeGreaterThan(0);
  expect(manualInputs.every((i) => i.trainingAge === 'beginner' && i.preference === 'manual')).toBe(true);
  const manualValue = screen.getByTestId('session-load-input').props.value;
  const manualSource = screen.getByTestId('session-load-source-line').props.children;
  first.unmount();
  const priorCallCount = resolveLoadSelectionSpy.mock.calls.length;
  mockState = fixture();
  render(<SessionScreen />);
  const autoInputs = resolveLoadSelectionSpy.mock.calls.slice(priorCallCount).map(([input]) => input);
  expect(autoInputs.length).toBeGreaterThan(0);
  expect(autoInputs.every((i) => i.preference === 'auto')).toBe(true);
  // Beginner authority lives in the resolver: identical output either way.
  expect(screen.getByTestId('session-load-input').props.value).toBe(manualValue);
  expect(screen.getByTestId('session-load-source-line').props.children).toBe(manualSource);
});

// --- P2-2: unknown implement fails toward blank ------------------------------
test('unknown implement (empty supportedPrefixes) is treated as external load', () => {
  mockState = state({
    movements: [
      movement(1, 'First movement', { supportedPrefixes: [] }),
      movement(2, 'Later movement'),
    ],
  });
  render(<SessionScreen />);
  expect(screen.getByTestId('session-load-label').props.children).toBe('LOAD KG');
  expect(screen.getByTestId('session-load-input').props.value).toBe('');
  expect(screen.getByLabelText('Log set 1 for First movement, unavailable — enter a load first')).toBeOnTheScreen();
});

// --- P2-4: stable target RPE for provenance ----------------------------------
test('nullable target RPE uses the same fallback for display and initialization', () => {
  mockState = state({
    profile: { training_age: 'intermediate', equipment_inventory: [], session_duration_cap_min: 60 },
    movements: [
      movement(1, 'First movement', { supportedPrefixes: ['Barbell'] }),
      movement(2, 'Later movement'),
    ],
    oneRepMaxes: { 1: 100 },
    sessionPlan: [slot(1, 1, 5, { targetRpe: null })],
  });
  render(<SessionScreen />);
  expect(screen.getByTestId('session-load-input').props.value).toBe('80.0');
  expect(screen.getByText('Based on your 100.0 kg 1RM')).toBeOnTheScreen();
  const initialResolverInputs = resolveLoadSelectionSpy.mock.calls.map(([input]) => input);
  expect(initialResolverInputs.length).toBeGreaterThanOrEqual(2);
  expect(initialResolverInputs.every((input) => input.targetRpe === 8)).toBe(true);
  expect(new Set(initialResolverInputs.map((input) => JSON.stringify(input))).size).toBe(1);

  const sourceBefore = screen.getByTestId('session-load-source-line').props.children;
  const draftBefore = screen.getByTestId('session-load-input').props.value;
  fireEvent.press(screen.getByLabelText('Increase Actual RPE'));
  expect(screen.getByTestId('session-load-source-line').props.children).toBe(sourceBefore);
  expect(screen.getByTestId('session-load-input').props.value).toBe(draftBefore);
  expect(resolveLoadSelectionSpy.mock.calls.every(([input]) => input.targetRpe === 8)).toBe(true);
});

// --- P2-1: invalid APRE regression via real resolver -------------------------
test('negative APRE override falls through exactly as production does', () => {
  mockState = state({
    profile: { training_age: 'intermediate', equipment_inventory: [], session_duration_cap_min: 60 },
    movements: [
      movement(1, 'First movement', { supportedPrefixes: ['Barbell'] }),
      movement(2, 'Later movement'),
    ],
    oneRepMaxes: { 1: 100 },
    sessionPlan: [slot(1, 1, 5, { overrideLoadKg: -5 })],
  });
  render(<SessionScreen />);
  // Invalid APRE falls through to 1RM derivation (real resolver behavior)
  expect(screen.getByTestId('session-load-input').props.value).toBe('80.0');
  expect(screen.getByText('Based on your 100.0 kg 1RM')).toBeOnTheScreen();
});

test('NaN APRE override falls through to 1RM derivation', () => {
  mockState = state({
    profile: { training_age: 'intermediate', equipment_inventory: [], session_duration_cap_min: 60 },
    movements: [
      movement(1, 'First movement', { supportedPrefixes: ['Barbell'] }),
      movement(2, 'Later movement'),
    ],
    oneRepMaxes: { 1: 100 },
    sessionPlan: [slot(1, 1, 5, { overrideLoadKg: NaN })],
  });
  render(<SessionScreen />);
  expect(screen.getByTestId('session-load-input').props.value).toBe('80.0');
  expect(screen.getByText('Based on your 100.0 kg 1RM')).toBeOnTheScreen();
});

test('infinite APRE override falls through to 1RM derivation', () => {
  mockState = state({
    profile: { training_age: 'intermediate', equipment_inventory: [], session_duration_cap_min: 60 },
    movements: [
      movement(1, 'First movement', { supportedPrefixes: ['Barbell'] }),
      movement(2, 'Later movement'),
    ],
    oneRepMaxes: { 1: 100 },
    sessionPlan: [slot(1, 1, 5, { overrideLoadKg: Infinity })],
  });
  render(<SessionScreen />);
  expect(screen.getByTestId('session-load-input').props.value).toBe('80.0');
  expect(screen.getByText('Based on your 100.0 kg 1RM')).toBeOnTheScreen();
});

// --- D1-A: bodyweight 1RM carve-out ------------------------------------------
test('D1-A: bodyweight + 1RM only in auto mode does not derive (seeded identity zero)', () => {
  mockState = state({
    profile: { training_age: 'intermediate', equipment_inventory: [], session_duration_cap_min: 60 },
    oneRepMaxes: { 1: 100 },
  });
  render(<SessionScreen />);
  // Bodyweight movement with 1RM: must NOT derive — identity zero
  expect(screen.getByTestId('session-load-input').props.value).toBe('0.0');
  expect(screen.getByText('0 kg means bodyweight only. Add weight when you need it.')).toBeOnTheScreen();
});

test('D1-A: bodyweight + valid APRE in auto mode derives (absolute prescription)', () => {
  mockState = state({
    profile: { training_age: 'intermediate', equipment_inventory: [], session_duration_cap_min: 60 },
    oneRepMaxes: { 1: 100 },
    sessionPlan: [slot(1, 1, 5, { overrideLoadKg: 10 })],
  });
  render(<SessionScreen />);
  expect(screen.getByTestId('session-load-input').props.value).toBe('10.0');
  expect(screen.getByText('Prescribed 10.0 kg added load')).toBeOnTheScreen();
});

// --- P1-1: a mid-session niggle must not blank the whole active session ------
// Counterexample from the movement-access audit. The session-wide early
// blocker used to fire on ANY non-available verdict, so the moment an
// intermediate athlete reported a knee niggle at their triage minimum the
// squat slot went safety-excluded and the entire session was replaced by the
// tier-review screen — destroying the substitution sheet that the same report
// had just opened. The blocker is tier-only now; safety stays a per-slot gate.
//
// Fixtures are deliberately narrow so only the safety law can move: no
// required equipment, no capability edges, no attestations, no prior
// experience. Tier is satisfied for every movement at the intermediate ceiling.
const realVerdictsFor = (context) => {
  const { movements, profile, niggles } = mockState;
  const triageMin = EXPERIENCE_SEVERITY[profile.training_age].triageMin;
  const injured = new Set(
    (niggles ?? [])
      .filter((niggle) => niggle.severity >= triageMin)
      .map((niggle) => niggle.region.trim().toLowerCase())
      .filter((region) => ACTUAL_JOINTS.includes(region)),
  );
  const safetyExcludedMovementIds = new Set(
    movements
      .filter((item) => (PATTERN_JOINTS[item.pattern] ?? []).some((joint) => injured.has(joint)))
      .map((item) => item.movement_id),
  );
  return actualResolveMovementAvailability({
    movements: movements.map((item) => ({
      movementId: item.movement_id,
      difficulty: item.difficulty,
      beginnerOk: item.beginnerOk,
      sportTracking: item.sportTracking,
      requiredEquipment: item.required,
    })),
    edges: [],
    evidence: [],
    attestedEdgeKeys: new Set(),
    priorExperienceMovementIds: new Set(),
    trainingAge: profile.training_age,
    accessContext: context,
    equipment: new Set(profile.equipment_inventory),
    safetyExcludedMovementIds,
  });
};

const niggleCounterexampleState = () => state({
  profile: { training_age: 'intermediate', equipment_inventory: [], session_duration_cap_min: 60 },
  movements: [
    movement(1, 'Front Squat', { pattern: 'squat', difficulty: 'Intermediate', beginnerOk: false }),
    movement(2, 'Later movement'),
    movement(3, 'Goblet Squat', { pattern: 'squat', difficulty: 'Beginner' }),
    movement(4, 'Hip Thrust', { pattern: 'hinge', difficulty: 'Beginner' }),
  ],
  runner: runner({
    slots: [
      { sessionPlanSlotId: 1, movementId: 1, movementName: 'Front Squat', sets: 3, target: { kind: 'reps', reps: 5 }, targetRpe: 8 },
      { sessionPlanSlotId: 2, movementId: 2, movementName: 'Later movement', sets: 3, target: { kind: 'reps', reps: 8 }, targetRpe: 8 },
    ],
  }),
  getMovementAvailabilityVerdicts: realVerdictsFor,
});

test('a non-halting knee niggle keeps the session and opens substitution instead of blanking it', () => {
  mockState = niggleCounterexampleState();
  const view = render(<SessionScreen />);

  // Baseline: nothing is blocked before the report.
  expect(screen.getByText('Front Squat')).toBeOnTheScreen();
  expect(screen.getByLabelText('Log set 1 for Front Squat')).toBeOnTheScreen();

  // Report knee discomfort at the intermediate triage minimum (default 4).
  fireEvent.press(screen.getByLabelText('Report discomfort'));
  fireEvent.press(screen.getByLabelText('knee'));
  expect(EXPERIENCE_SEVERITY.intermediate.triageMin).toBe(4);
  fireEvent.press(screen.getByLabelText('Save discomfort report'));
  expect(mockState.reportNiggle).toHaveBeenCalledWith('knee', 4);

  // What the store does next: records the niggle (below the intermediate halt
  // minimum of 8) and opens the substitution sheet for the current movement.
  mockState.niggles = [{ region: 'knee', severity: 4 }];
  mockState.substitution = {
    targetId: 1,
    result: {
      haltAdvised: false,
      layer1Regression: {
        options: [
          { movement_id: 3, name: 'Goblet Squat', rationale: 'Same pattern, lighter load.' },
          { movement_id: 4, name: 'Hip Thrust', rationale: 'Loads the hip without the knee.' },
        ],
      },
      layer2DaySwap: { options: [] },
    },
  };
  view.rerender(<SessionScreen />);

  // The session is still there and the substitution sheet rendered.
  expect(screen.queryByText('This plan needs Coach review.')).toBeNull();
  expect(screen.queryByLabelText('Finish the blocked session')).toBeNull();
  expect(screen.getByText('Front Squat')).toBeOnTheScreen();
  expect(screen.getByText('0 of 2 exercises complete')).toBeOnTheScreen();
  expect(screen.getByText('Choose an alternative')).toBeOnTheScreen();

  // The unsafe movement is still blocked from execution.
  const logSetButton = screen.getByLabelText(/^Log set 1 for Front Squat, unavailable — Teaching only/);
  expect(logSetButton.props.accessibilityState.disabled).toBe(true);
  expect(screen.getByTestId('session-slot-blocked')).toBeOnTheScreen();
  fireEvent.press(logSetButton);
  expect(mockState.logSet).not.toHaveBeenCalled();

  // ...and from substitution selection: the knee-loading alternative cannot be
  // chosen, while the alternative that spares the knee can.
  const unsafeOption = screen.getByLabelText('Use Goblet Squat instead');
  expect(unsafeOption.props.accessibilityState.disabled).toBe(true);
  fireEvent.press(unsafeOption);
  expect(mockState.applyRegression).not.toHaveBeenCalled();

  const safeOption = screen.getByLabelText('Use Hip Thrust instead');
  expect(safeOption.props.accessibilityState.disabled).toBe(false);
  fireEvent.press(safeOption);
  expect(mockState.applyRegression).toHaveBeenCalledWith(1, 4);
});

test('equipment, capability and attestation gaps also stay per-slot instead of blanking the session', () => {
  mockState = state({
    profile: { training_age: 'intermediate', equipment_inventory: [], session_duration_cap_min: 60 },
    movements: [
      // Barbell is absent from the inventory: equipment alone must not blank
      // the session the way a tier violation does.
      movement(1, 'First movement', { required: ['barbell'] }),
      movement(2, 'Later movement'),
    ],
    getMovementAvailabilityVerdicts: realVerdictsFor,
  });
  render(<SessionScreen />);

  expect(screen.queryByText('This plan needs Coach review.')).toBeNull();
  expect(screen.getByText('First movement')).toBeOnTheScreen();
  expect(screen.getByLabelText(/^Log set 1 for First movement, unavailable — Teaching only/)
    .props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByLabelText(/^Log set 1 for First movement, unavailable/));
  expect(mockState.logSet).not.toHaveBeenCalled();
});

test('an above-tier movement still blanks the session, and the copy matches that predicate', () => {
  mockState = state({
    profile: { training_age: 'intermediate', equipment_inventory: [], session_duration_cap_min: 60 },
    movements: [movement(1, 'First movement'), movement(2, 'Advanced movement', { difficulty: 'Advanced', beginnerOk: false })],
    getMovementAvailabilityVerdicts: realVerdictsFor,
  });
  render(<SessionScreen />);

  expect(screen.getByText('This plan needs Coach review.')).toBeOnTheScreen();
  expect(screen.getByText(
    'A planned movement sits above this athlete’s difficulty tier, or its tier could not be confirmed, so the session was blocked before it could be shown.',
  )).toBeOnTheScreen();
  expect(screen.queryByText('Advanced movement')).toBeNull();
});

test('a planned movement missing from the library fails the tier check closed', () => {
  mockState = state({
    profile: { training_age: 'intermediate', equipment_inventory: [], session_duration_cap_min: 60 },
    sessionPlan: [slot(1, 1), slot(2, 999, 8)],
    getMovementAvailabilityVerdicts: realVerdictsFor,
  });
  render(<SessionScreen />);

  expect(screen.getByText('This plan needs Coach review.')).toBeOnTheScreen();
  expect(screen.queryByText('First movement')).toBeNull();
});
