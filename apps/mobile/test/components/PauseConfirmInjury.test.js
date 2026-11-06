/**
 * Issue #188: every pause asks first; the injury pause has its own text with
 * no "keep training" and a link that opens "Something feels off". What a
 * pause does is unchanged.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import BlockScreen, { pausedHeldText } from '../../src/screens/BlockScreen';
import TodayScreen from '../../src/screens/TodayScreen';

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
  lastTriage: null,
  uiPreferences: { sessionModeOverride: null, readinessDetail: 'summary', restTimerEnabled: true, textScale: 'system' },
  boot: jest.fn(),
  refreshVector: jest.fn(),
  loadDemoAthlete: jest.fn(),
  resetTrainingData: jest.fn(),
  prescription: { forDate: TODAY, source: 'policy', vector: { load_modifier: 1, set_modifier: 0, rpe_cap: 8.5 } },
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

const program = { status: 'active', currentSequenceIndex: 1, plannedBlockCount: 3, plannedEndDate: '2026-09-30' };

beforeEach(() => { mockState = baseState({ program }); });

test.each(['injury', 'illness', 'life'])('the %s pause asks first and pauses only on confirm', (reason) => {
  render(<BlockScreen />);
  fireEvent.press(screen.getByTestId(`suspension-begin-${reason}`));
  expect(mockState.beginSuspension).not.toHaveBeenCalled();
  const label = { injury: 'an injury', illness: 'illness', life: 'life events' }[reason];
  expect(screen.getByText(`Pause your programme (${label})?`)).toBeOnTheScreen();
  fireEvent.press(screen.getByTestId('suspension-confirm'));
  expect(mockState.beginSuspension).toHaveBeenCalledTimes(1);
  expect(mockState.beginSuspension).toHaveBeenCalledWith(reason, expect.any(Number));
});

test('cancelling the question pauses nothing and brings the choices back', () => {
  render(<BlockScreen />);
  fireEvent.press(screen.getByTestId('suspension-begin-illness'));
  fireEvent.press(screen.getByTestId('suspension-cancel'));
  expect(mockState.beginSuspension).not.toHaveBeenCalled();
  expect(screen.getByTestId('suspension-begin-injury')).toBeOnTheScreen();
  expect(screen.queryByText(/Pause your programme \(/)).toBeNull();
});

test('the injury pause has its own text with no "keep training", and links to "Something feels off"', () => {
  mockState = baseState({ program, suspension: { reason: 'injury', frozen_macro_index: 1, started_at_ms: 1 } });
  render(<BlockScreen />);
  expect(screen.getByText(/Paused for an injury/)).toBeOnTheScreen();
  expect(screen.queryByText(/keep training/i)).toBeNull();
  expect(screen.queryByText(/training you do now/i)).toBeNull();
  expect(screen.queryByLabelText('Describe how your body feels today')).toBeNull();
  fireEvent.press(screen.getByTestId('suspension-injury-report'));
  expect(screen.getByLabelText('Describe how your body feels today')).toBeOnTheScreen();
});

test('the other pause reasons keep their text', () => {
  mockState = baseState({ program, suspension: { reason: 'illness', frozen_macro_index: 1, started_at_ms: 1 } });
  render(<BlockScreen />);
  expect(screen.getByText(/Keep training if you can/)).toBeOnTheScreen();
  expect(screen.queryByTestId('suspension-injury-report')).toBeNull();
});

test('pausedHeldText: injury has no "keep training"; other reasons are unchanged', () => {
  const injury = pausedHeldText('an injury', { currentSequenceIndex: 1, plannedBlockCount: 3 }, 'injury');
  expect(injury).toContain('You are held at block 1 of 3');
  expect(injury).not.toMatch(/keep training/i);
  expect(injury).toContain('Something feels off');
  expect(pausedHeldText('illness', null, 'illness')).toContain('Keep training if you can');
});

test('TODAY: an injury pause does not say "you can still train"', () => {
  mockState = baseState({ program, suspension: { reason: 'injury', frozen_macro_index: 1, started_at_ms: 1 } });
  const { unmount } = render(<TodayScreen />);
  expect(screen.getByTestId('today-paused')).toBeOnTheScreen();
  expect(screen.queryByText(/still train/i)).toBeNull();
  unmount();
  mockState = baseState({ program, suspension: { reason: 'life', frozen_macro_index: 1, started_at_ms: 1 } });
  render(<TodayScreen />);
  expect(screen.getByText(/You can still train/)).toBeOnTheScreen();
});
