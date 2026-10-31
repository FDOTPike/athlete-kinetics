import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ReadinessScreen from '../../src/screens/ReadinessScreen';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  palette: {
    bg: '#000',
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

const TODAY = '2026-07-15';

const vector = {
  date: TODAY,
  readiness_score: 82,
  hrv_component: 84,
  load_component: 80,
  sleep_component: 79,
  spo2_component: 90,
  acwr: 1.02,
  acute_load_kg: 4200,
  chronic_load_kg: 4100,
  ln_rmssd: 4.2,
  hrv_z: 0.4,
  sleep_efficiency_pct: 88,
  spo2_night_mean: 97,
  computed_at_ms: 1,
};

const todaySlot = {
  slotIndex: 0,
  plannedSlotId: 10,
  movementId: 11,
  movementName: 'Goblet Squat',
  sets: 3,
  reps: 8,
  target: { kind: 'reps', reps: 8 },
  targetRpe: 7.5,
  overrideLoadKg: null,
  overrideReason: null,
};

const todayPlan = {
  plannedSessionId: 1,
  focus: 'lower',
  phase: 'accumulation',
  slots: [todaySlot],
};

const baseState = (overrides = {}) => ({
  status: 'ready',
  error: null,
  today: TODAY,
  profile: {
    objective: 'strength',
    training_age: 'intermediate',
    weekly_frequency: 4,
    equipment_inventory: ['barbell', 'dumbbell'],
    base_rpe_cap: 8.5,
    session_duration_cap_min: 60,
  },
  vector,
  prescription: {
    forDate: TODAY,
    state: 'OPTIMAL',
    source: 'policy',
    halt: false,
    vector: {
      load_modifier: 1.0,
      set_modifier: 0,
      rpe_cap: 8.5,
      coaching_cue: 'Readiness optimal — execute prescribed load.',
      profileNotes: [],
    },
  },
  lastTriage: null,
  profileNotes: [],
  niggles: [],
  movements: [
    {
      movement_id: 11,
      name: 'Goblet Squat',
      pattern: 'squat',
      primary_muscles: 'quads',
      equipment: 'dumbbell',
      fatigue_cost: 2,
      tier: 'beginner',
      is_bodyweight: 0,
      velocity_loss_pct: 20,
      preference: 0,
    },
  ],
  sessionPlan: [],
  activeMovementId: 11,
  activeSessionPlanSlotId: null,
  session: null,
  runner: null,
  sessionMode: null,
  uiPreferences: {
    sessionModeOverride: null,
    readinessDetail: 'headline',
    restTimerEnabled: true,
    textScale: 'system',
  },
  substitution: null,
  oneRepMaxes: { 11: 100 },
  apreOverrides: {},
  block: { blockId: 1, startDate: '2026-07-13', objective: 'strength', createdAtMs: 1 },
  blockMeta: { schemaType: 'LINEAR', macroBlockIndex: 1, macroPhase: 'accumulation', peakShifted: false },
  hasArchivedBlock: false,
  blockSessions: [
    {
      plannedSessionId: 1,
      weekIndex: 1,
      dayIndex: 3,
      focus: 'lower',
      phase: 'accumulation',
      sessionDate: TODAY,
      slotCount: 1,
      completionStatus: null,
    },
  ],
  todayPlan,
  pendingAutopilotAdjustments: [],
  returnCheckin: null,
  suspension: null,
  program: null,
  nextBlockPreview: null,
  healthSupportRevision: 0,
  getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }),
  refreshVector: jest.fn(),
  computePrescription: jest.fn(),
  reportSubjective: jest.fn(),
  startSession: jest.fn(),
  generateNewBlock: jest.fn(),
  loadSessionSlots: jest.fn(() => [todaySlot]),
  recordedDurationsForFocus: jest.fn(() => []),
  confirmReturnCheckin: jest.fn(),
  dismissReturnCheckin: jest.fn(),
  beginSuspension: jest.fn(),
  endSuspension: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  mockState = baseState();
});

test('ReadinessScreen enforces training-support hold and renders TrainingSupportNotice', () => {
  mockState = baseState({
    getTrainingSupportDecision: () => ({ status: 'held', holdIds: ['hold-1'] }),
  });
  render(<ReadinessScreen />);

  expect(screen.getByTestId('training-support-notice')).toBeOnTheScreen();
  expect(screen.queryByText('Ready to train')).toBeNull();
  expect(screen.queryByText("Follow today's plan at the effort it prescribes.")).toBeNull();
});

test('ReadinessScreen renders the boot error view with Retry before evaluating training support', () => {
  const boot = jest.fn();
  const getTrainingSupportDecision = jest.fn(() => ({ status: 'support_unavailable', holdIds: [] }));
  mockState = baseState({
    status: 'error',
    error: 'The database could not be opened.',
    boot,
    getTrainingSupportDecision,
  });
  render(<ReadinessScreen />);

  expect(getTrainingSupportDecision).not.toHaveBeenCalled();
  expect(screen.queryByTestId('training-support-notice')).toBeNull();
  expect(screen.getByText('Training data needs attention')).toBeOnTheScreen();
  expect(screen.getByText('The database could not be opened.')).toBeOnTheScreen();
  expect(screen.getByLabelText('Retry database boot')).toBeOnTheScreen();
});
