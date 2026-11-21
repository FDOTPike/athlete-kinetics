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
    effectiveRpeCeiling: actual.effectiveRpeCeiling,
  };
});

jest.mock('../../src/state/useStore', () => {
  const storeFunc = (selector) => selector({ getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }), ...mockState });
  storeFunc.setState = jest.fn((updates) => { Object.assign(mockState, updates); });
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
  pattern: 'squat',
  is_compound: true,
  beginnerOk: true,
  loggingMode: 'reps',
  required: [],
  baseName: name,
  supportedPrefixes: ['Barbell'],
  difficulty: 'Beginner',
  preference: 0,
  sportTracking: false,
  scope: null,
  instructions: 'Brace trunk',
  cues: 'Drive up',
  media: { assetKey: `movement/test-${id}/demo/v1`, status: 'external_fallback', revision: 1, fallbackUrl: 'https://www.youtube.com/watch?v=test' },
  targetMuscles: ['quads'],
  coachingIntent: 'Build lower-body strength.',
  timePolicy: null,
});

const slot = (id, movementId, reps = 8, overrides = {}) => ({
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
  ...overrides,
});

describe('SessionScreen carries previous logged set load within the same slot (#231)', () => {
  test('1RM-seeded slot (suggestion 185.0): after logging set 1 at 190.0, set 2 starts at 190.0 while suggestion still shows 185.0, and slot 2 set 1 starts at its own suggestion', () => {
    const sets = [];
    mockState = {
      movements: [
        movement(1, 'Competition Squat'),
        movement(2, 'Competition Bench'),
      ],
      session: { sessionId: 10, date: '2026-12-18', startedAtMs: Date.now(), sets },
      sessionPlan: [
        slot(1, 1, 8, { overrideLoadKg: 185 }),
        slot(2, 2, 8, { overrideLoadKg: 125 }),
      ],
      activeSessionPlanSlotId: 1,
      profile: { training_age: 'intermediate', equipment_inventory: ['barbell'], session_duration_cap_min: 60 },
      getMovementAvailabilityVerdicts: () => [
        { movementId: 1, state: 'available', reasons: [], effectiveContext: 'weight_room', capabilitySource: 'not_required', blockingPrerequisiteMovementIds: [], confirmationWouldClear: false, separateAttestationRequired: false },
        { movementId: 2, state: 'available', reasons: [], effectiveContext: 'weight_room', capabilitySource: 'not_required', blockingPrerequisiteMovementIds: [], confirmationWouldClear: false, separateAttestationRequired: false },
      ],
      movementAvailabilityRevision: 0,
      activeSessionAccessContext: 'weight_room',
      niggles: [],
      oneRepMaxes: { 1: 250, 2: 165 },
      lastLoggedLoads: {},
      lastTriage: null,
      substitution: null,
      loadPreference: 'auto',
      loadPreferenceExplicit: false,
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
          { sessionPlanSlotId: 1, movementId: 1, movementName: 'Competition Squat', sets: 3, target: { kind: 'reps', reps: 8 }, targetRpe: 8 },
          { sessionPlanSlotId: 2, movementId: 2, movementName: 'Competition Bench', sets: 3, target: { kind: 'reps', reps: 8 }, targetRpe: 8 },
        ],
        slotIndex: 0,
        setIndex: 1,
        phase: 'working',
        restSecondsTarget: 0,
        restStartedAtMs: null,
        restRpe: null,
        restSecondsOverride: null,
        slotSetCounts: [0, 0],
        loggedSets: 0,
        substitutionOfferedForSessionPlanSlotId: null,
        haltReason: null,
        skippedSessionPlanSlotIds: [],
        updatedAtMs: Date.now(),
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
      resolveSlotLoad: jest.fn((input) => {
        // 1RM-derived slot (overrideLoadKg: null in resolver so source is 1RM-derived 185.0 for squat, 125.0 for bench)
        const derivedKg = input.movementId === 1 ? 185.0 : 125.0;
        return {
          source: 'derived',
          initialLoadKg: derivedKg,
          advisoryKg: null,
          advisoryKind: null,
        };
      }),
    };
    // Make slots pure 1RM-derived (no APRE override)
    mockState.sessionPlan[0].overrideLoadKg = null;
    mockState.sessionPlan[1].overrideLoadKg = null;

    const view = render(<SessionScreen />);

    // Set 1 of Slot 1 starts at today's 1RM-derived seed (185.0)
    expect(screen.getByTestId('session-load-input').props.value).toBe('185.0');

    // Athlete enters 190.0 and logs Set 1
    fireEvent.changeText(screen.getByTestId('session-load-input'), '190.0');
    fireEvent.press(screen.getByLabelText('Log set 1 for Competition Squat'));
    expect(mockState.logSet).toHaveBeenCalledTimes(1);
    expect(mockState.logSet.mock.calls[0][2]).toBe(190);
    expect(mockState.logSet.mock.calls[0][9]).toEqual({
      source: 'derived',
      shownLoadKg: 185,
      advisoryKg: null,
      advisoryKind: null,
    });

    // Simulate Set 1 committed into session.sets and runner advancing to Set 2 of Slot 1
    sets.push({
      set_id: 1,
      movement_id: 1,
      movement_name: 'Competition Squat',
      set_index: 1,
      reps: 8,
      load_kg: 190,
      rpe: 8,
      tonnage_kg: 1520,
      session_plan_slot_id: 1,
      timeS: null,
      bandLevel: null,
    });
    mockState.runner = {
      ...mockState.runner,
      setIndex: 2,
      slotSetCounts: [1, 0],
      loggedSets: 1,
    };
    view.rerender(<SessionScreen />);

    // Set 2 of Slot 1 starts at 190.0 (the load just logged) while suggestion text still says 185.0
    expect(screen.getByTestId('session-load-input').props.value).toBe('190.0');
    expect(screen.getByTestId('session-load-source-line').props.children).toMatch(/185\.0/);

    // Logging Set 2 records loadShownRef with the value the field actually showed (190)
    fireEvent.press(screen.getByLabelText('Log set 2 for Competition Squat'));
    expect(mockState.logSet).toHaveBeenCalledTimes(2);
    expect(mockState.logSet.mock.calls[1][2]).toBe(190);
    expect(mockState.logSet.mock.calls[1][9]).toEqual({
      source: 'derived',
      shownLoadKg: 190,
      advisoryKg: null,
      advisoryKind: null,
    });

    // Advance to Set 1 of Slot 2 (Competition Bench, suggestion 125.0)
    mockState.activeSessionPlanSlotId = 2;
    mockState.runner = {
      ...mockState.runner,
      slotIndex: 1,
      setIndex: 1,
      slotSetCounts: [3, 0],
      loggedSets: 3,
    };
    view.rerender(<SessionScreen />);

    // Set 1 of the next slot still starts at its own suggestion (125.0)
    expect(screen.getByTestId('session-load-input').props.value).toBe('125.0');
  });
});
