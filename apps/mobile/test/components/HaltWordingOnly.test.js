/**
 * Issue #178: while today's safety report has set a halt, every card shows the
 * halt sentences (stop today, what to do next) and never the matched entry's
 * adjustment cue; READY does not say a session is planned or ready to resume;
 * the programme pause cards do not say "you can still train".
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ReadinessScreen from '../../src/screens/ReadinessScreen';
import BlockScreen from '../../src/screens/BlockScreen';
import TodayScreen from '../../src/screens/TodayScreen';
import { HALT_NEXT_TEXT, HALT_TODAY_TEXT } from '../../src/state/haltCopy';

jest.setTimeout(30000);

let mockState;

jest.mock('@ak/inference', () => {
  const actual = jest.requireActual('@ak/inference');
  return {
    ...actual,
    SCHEMA_TYPES: ['LINEAR', 'WAVE', 'STEP', 'APRE'],
    targetLoadKg: jest.fn(() => 42.5),
    addDaysIso: jest.fn((iso, days) => {
      const date = new Date(`${iso}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    }),
  };
});
jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  useStore: (selector) => selector({ getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }), ...mockState }),
}));

const TODAY = '2026-07-15';
// The non-halt pain cue, escalated to a halt by severity (walk W5-1).
const PAIN_CUE = 'Pain language detected: load drops 40% and effort caps at RPE 6 until you can localize it.';
const vector = {
  date: TODAY, readiness_score: 82, hrv_component: 84, load_component: 80, sleep_component: 79,
  spo2_component: 90, acwr: 1.02, acute_load_kg: 4200, chronic_load_kg: 4100, ln_rmssd: 4.2,
  hrv_z: 0.4, sleep_efficiency_pct: 88, spo2_night_mean: 97, computed_at_ms: 1,
};
const todaySlot = {
  slotIndex: 0, plannedSlotId: 10, movementId: 11, movementName: 'Goblet Squat', sets: 3, reps: 8,
  target: { kind: 'reps', reps: 8 }, targetRpe: 7.5, overrideLoadKg: null, overrideReason: null,
};
const todayPlan = { plannedSessionId: 1, focus: 'lower', phase: 'accumulation', slots: [todaySlot] };
const haltTriage = {
  kind: 'matched',
  directive: {
    halt: true,
    followUp: 'Where exactly is it, and does it change during the movement?',
    matchedCue: 'pain red flag keyword override',
    similarity: 1,
    vector: { load_modifier: 0, set_modifier: -2, rpe_cap: 0, coaching_cue: PAIN_CUE },
  },
};
const baseState = (overrides = {}) => ({
  status: 'ready',
  error: null,
  today: TODAY,
  activityLedger: {
    definitions: [], series: [], occurrences: [], completedLast28Days: 0,
    knownMinutesLast28Days: 0, completedWithUnknownDuration: 0,
    scheduledKnownMinutesPerWeek: 0, scheduledWithUnknownDuration: 0,
  },
  profile: {
    objective: 'strength', training_age: 'intermediate', weekly_frequency: 4,
    equipment_inventory: ['barbell', 'dumbbells', 'bench'], base_rpe_cap: 8.5,
    session_duration_cap_min: 60,
  },
  vector,
  trend: [{ date: '2026-07-14', readiness_score: 76 }],
  session: null,
  todayPlan,
  lastTriage: haltTriage,
  uiPreferences: { sessionModeOverride: null, readinessDetail: 'summary', restTimerEnabled: true, textScale: 'system' },
  boot: jest.fn(),
  refreshVector: jest.fn(),
  loadDemoAthlete: jest.fn(),
  resetTrainingData: jest.fn(),
  prescription: {
    forDate: TODAY,
    source: 'guardrail',
    vector: { load_modifier: 0, set_modifier: -2, rpe_cap: 0, coaching_cue: PAIN_CUE },
  },
  profileNotes: [],
  triageReady: true,
  triaging: false,
  block: { blockId: 1, startDate: '2026-07-01', objective: 'strength', createdAtMs: 1 },
  blockMeta: { schemaType: 'LINEAR', macroBlockIndex: 1, macroPhase: 'gpp', peakShifted: false },
  hasArchivedBlock: false,
  oneRepMaxes: {},
  blockSessions: [{
    plannedSessionId: 1, weekIndex: 1, dayIndex: 1, focus: 'lower', phase: 'accumulation',
    sessionDate: TODAY, slotCount: 1, completionStatus: null,
  }],
  generateNewBlock: jest.fn(),
  loadSessionSlots: jest.fn(() => [todaySlot]),
  reportSubjective: jest.fn(() => Promise.resolve()),
  startSession: jest.fn(),
  returnCheckin: null,
  confirmReturnCheckin: jest.fn(),
  dismissReturnCheckin: jest.fn(),
  getMovementAvailabilityVerdicts: jest.fn(() => []),
  previewTrainingProgram: jest.fn(() => ({ plan: { sessions: [] } })),
  recordedDurationsForFocus: jest.fn(() => []),
  beginSuspension: jest.fn(),
  endSuspension: jest.fn(),
  suspension: null,
  program: null,
  movements: [],
  niggles: [],
  ...overrides,
});

const expectHaltOnly = () => {
  expect(screen.queryByText(PAIN_CUE)).toBeNull();
  expect(screen.queryByText(/load drops 40%/)).toBeNull();
  expect(screen.getAllByText(HALT_NEXT_TEXT).length).toBeGreaterThan(0);
};

beforeEach(() => { mockState = baseState(); });

test('PLAN halt card shows the halt sentences and never the adjustment cue', () => {
  render(<BlockScreen />);
  expect(screen.getByText('Stop training today')).toBeOnTheScreen();
  expect(screen.getByText(HALT_TODAY_TEXT)).toBeOnTheScreen();
  expectHaltOnly();
});

test('PLAN halt card without readiness shows the halt sentences and never the adjustment cue', () => {
  mockState = baseState({ vector: null });
  render(<BlockScreen />);
  expect(screen.getByText(HALT_TODAY_TEXT)).toBeOnTheScreen();
  expectHaltOnly();
});

test('PLAN pause card does not say "you can still train" while a halt is active', () => {
  render(<BlockScreen />);
  expect(screen.queryByText(/still train/i)).toBeNull();
  expect(screen.getByText(/stopped training for today/)).toBeOnTheScreen();
});

test('PLAN pause card keeps "you can still train" when there is no halt', () => {
  mockState = baseState({ lastTriage: null });
  render(<BlockScreen />);
  expect(screen.getByText(/still train while paused/)).toBeOnTheScreen();
});

test('PLAN programme-paused card does not say "keep training" while a halt is active', () => {
  mockState = baseState({ suspension: { reason: 'injury', frozen_macro_index: 1, started_at_ms: 1 } });
  render(<BlockScreen />);
  expect(screen.queryByText(/keep training/i)).toBeNull();
  expect(screen.queryByText(/training you do now/i)).toBeNull();
});

test('READY hides "planned today" while halted and shows the halt sentence instead', () => {
  render(<ReadinessScreen onOpenCoach={jest.fn()} />);
  expect(screen.queryByText(/session planned today/)).toBeNull();
  expectHaltOnly();
});

test('READY hides "ready to resume" while halted with an open workout', () => {
  mockState = baseState({ session: { sessionId: 10, date: TODAY, startedAtMs: 1, sets: [] } });
  render(<ReadinessScreen onOpenSession={jest.fn()} />);
  expect(screen.queryByText('Your active workout is ready to resume.')).toBeNull();
  expect(screen.queryByText(/session planned today/)).toBeNull();
  expectHaltOnly();
});

test('READY without readiness hides "planned today" while halted', () => {
  mockState = baseState({ vector: null });
  render(<ReadinessScreen onOpenCoach={jest.fn()} />);
  expect(screen.queryByText(/session planned today/)).toBeNull();
});

test('READY held by a support hold shows the halt sentence, not the cue', () => {
  mockState = baseState({ getTrainingSupportDecision: () => ({ status: 'held', holdIds: [1] }) });
  render(<ReadinessScreen />);
  expect(screen.getByTestId('held-screen-halt-card')).toBeOnTheScreen();
  expectHaltOnly();
});

test('READY still names the planned session when there is no halt', () => {
  mockState = baseState({ lastTriage: null });
  render(<ReadinessScreen onOpenCoach={jest.fn()} />);
  expect(screen.getByText('Lower session planned today.')).toBeOnTheScreen();
});

test('TODAY halt card says what to do next, and its pause card does not say "you can still train"', () => {
  mockState = baseState({ suspension: { reason: 'illness', frozen_macro_index: 1, started_at_ms: 1 } });
  render(<TodayScreen />);
  expect(screen.getByTestId('today-card-halted')).toBeOnTheScreen();
  expect(screen.queryByText(/still train/i)).toBeNull();
  expectHaltOnly();
});
