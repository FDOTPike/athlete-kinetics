import React from 'react';
import { render, screen } from '@testing-library/react-native';
import TodayScreen from '../../src/screens/TodayScreen';
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

test('TodayScreen does not display "Ready to train" under READINESS while a safety halt is active', () => {
  mockState = baseState({
    lastTriage: {
      kind: 'matched',
      directive: {
        ruleId: 'RED_FLAG_SYSTEMIC',
        similarity: 1,
        matchedAnchor: 'dizziness',
        halt: true,
        followUp: 'Are the symptoms easing at complete rest right now?',
        vector: {
          load_modifier: 0,
          set_modifier: -99,
          rpe_cap: 0,
          coaching_cue: 'Systemic symptom reported. Stop the session and rest.',
        },
      },
    },
  });

  const { unmount } = render(<ReadinessScreen />);
  expect(screen.getByText("Resolve today's safety report")).toBeOnTheScreen();
  unmount();

  render(<TodayScreen />);

  expect(screen.getByTestId('today-card-halted')).toBeOnTheScreen();
  expect(screen.getByText('Training is paused')).toBeOnTheScreen();
  expect(screen.getByText("Resolve today's safety report")).toBeOnTheScreen();
  expect(screen.queryByText('Ready to train')).toBeNull();
});
