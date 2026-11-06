/**
 * Issue #200: after today's planned session was finished, Today said
 * "Lower — done" but READY still said "Lower session planned today." and Plan
 * still said "Today: Lower / N movements are planned" with "Start session".
 * Plan and READY now read the same `deriveTodayState` result as Today.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ReadinessScreen from '../../src/screens/ReadinessScreen';
import BlockScreen from '../../src/screens/BlockScreen';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  useStore: (selector) => selector(mockState),
}));

const TODAY = '2026-11-04';

const vector = {
  date: TODAY, readiness_score: 82, hrv_component: 84, load_component: 80, sleep_component: 79,
  spo2_component: 90, acwr: 1.02, acute_load_kg: 4200, chronic_load_kg: 4100, ln_rmssd: 4.2,
  hrv_z: 0.4, sleep_efficiency_pct: 88, spo2_night_mean: 97, computed_at_ms: 1,
};

const todaySlot = (slotIndex) => ({
  slotIndex, plannedSlotId: 10 + slotIndex, movementId: 11 + slotIndex, movementName: `Move ${slotIndex}`,
  sets: 3, reps: 8, target: { kind: 'reps', reps: 8 }, targetRpe: 7.5, overrideLoadKg: null, overrideReason: null,
});

const baseState = (completionStatus, overrides = {}) => ({
  status: 'ready',
  error: null,
  today: TODAY,
  activeAthleteId: 'default',
  profile: {
    objective: 'strength', training_age: 'beginner', weekly_frequency: 3,
    equipment_inventory: ['barbell'], base_rpe_cap: 8.5, session_duration_cap_min: 60,
  },
  vector,
  trend: [],
  prescription: {
    forDate: TODAY, state: 'OPTIMAL', source: 'policy', halt: false,
    vector: { load_modifier: 1.0, set_modifier: 0, rpe_cap: 8.5, coaching_cue: 'Execute.', profileNotes: [] },
  },
  lastTriage: null,
  profileNotes: [],
  triageReady: true,
  triaging: false,
  niggles: [],
  movements: [],
  session: null,
  uiPreferences: { sessionModeOverride: null, readinessDetail: 'headline', restTimerEnabled: true, textScale: 'system' },
  oneRepMaxes: {},
  block: { blockId: 1, startDate: '2026-11-02', objective: 'strength', createdAtMs: 1 },
  blockMeta: { schemaType: 'LINEAR', macroBlockIndex: 1, macroPhase: 'accumulation', peakShifted: false },
  hasArchivedBlock: false,
  blockSessions: [
    {
      plannedSessionId: 1, weekIndex: 1, dayIndex: 3, focus: 'lower', phase: 'accumulation',
      sessionDate: TODAY, slotCount: 2, completionStatus,
    },
    {
      plannedSessionId: 2, weekIndex: 1, dayIndex: 5, focus: 'upper', phase: 'accumulation',
      sessionDate: '2026-11-06', slotCount: 2, completionStatus: null,
    },
  ],
  todayPlan: { plannedSessionId: 1, focus: 'lower', phase: 'accumulation', slots: [todaySlot(0), todaySlot(1)] },
  pendingAutopilotAdjustments: [],
  returnCheckin: null,
  suspension: null,
  program: null,
  routineTemplates: [],
  getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }),
  refreshVector: jest.fn(),
  boot: jest.fn(),
  loadDemoAthlete: jest.fn(),
  resetTrainingData: jest.fn(),
  reportSubjective: jest.fn(),
  startSession: jest.fn(),
  generateNewBlock: jest.fn(),
  loadSessionSlots: jest.fn(() => []),
  confirmReturnCheckin: jest.fn(),
  dismissReturnCheckin: jest.fn(),
  beginSuspension: jest.fn(),
  endSuspension: jest.fn(),
  ...overrides,
});

describe('#200: today\'s planned session is finalized as complete', () => {
  beforeEach(() => { mockState = baseState('complete'); });

  test('Plan says it is done and offers no "Start session"', () => {
    render(<BlockScreen />);
    expect(screen.getByText('Today: Lower — done')).toBeOnTheScreen();
    expect(screen.queryByText(/movements are planned/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start session' })).toBeNull();
  });

  test('READY says the session is recorded, not "planned today"', () => {
    render(<ReadinessScreen />);
    expect(screen.getByText("Today's Lower session is recorded.")).toBeOnTheScreen();
    expect(screen.queryByText(/planned today/)).toBeNull();
  });
});

describe('#200: no session yet today, both screens still say it is planned', () => {
  beforeEach(() => { mockState = baseState(null); });

  test('Plan', () => {
    render(<BlockScreen />);
    expect(screen.getByText('Today: Lower')).toBeOnTheScreen();
    expect(screen.getByText('2 movements are planned. Start when you are ready.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Start session' })).toBeOnTheScreen();
  });

  test('READY', () => {
    render(<ReadinessScreen />);
    expect(screen.getByText('Lower session planned today.')).toBeOnTheScreen();
    expect(screen.queryByText(/is recorded/)).toBeNull();
  });
});
