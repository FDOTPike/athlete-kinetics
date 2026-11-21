/**
 * Issue #186: with a non-halting report shaping today, Today, READY, Plan and
 * the workout each name the report and the change actually applied (the
 * gated, scaled figures), never the cue's figure; READY does not say the
 * recovery signals support the planned work.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ReadinessScreen from '../../src/screens/ReadinessScreen';
import BlockScreen from '../../src/screens/BlockScreen';
import TodayScreen from '../../src/screens/TodayScreen';
import { operativeReportLine } from '../../src/state/operativeReportLine';

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
const PAIN_CUE = 'Pain language detected: load drops 40% and effort caps at RPE 6 until you can localize it.';
const REPORT_TEXT = 'sharp pain in my knee when I squat';
const EXPECTED_LINE = `Load reduced by 46%, one set fewer and effort capped at RPE 6 today, because of your report: “${REPORT_TEXT}”.`;
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
const reducedVector = { load_modifier: 0.54, set_modifier: -1, rpe_cap: 6, coaching_cue: PAIN_CUE };
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
  lastTriage: {
    kind: 'matched',
    directive: { halt: false, followUp: null, matchedCue: 'pain red flag keyword override', similarity: 1, vector: reducedVector },
  },
  uiPreferences: { sessionModeOverride: null, readinessDetail: 'summary', restTimerEnabled: true, textScale: 'system' },
  boot: jest.fn(),
  refreshVector: jest.fn(),
  loadDemoAthlete: jest.fn(),
  resetTrainingData: jest.fn(),
  prescription: {
    forDate: TODAY,
    source: 'guardrail',
    vector: reducedVector,
    report: {
      text: REPORT_TEXT,
      entryId: 'red-flag-pain',
      effect: { halt: false, loadReductionPct: 46, setDelta: -1, rpeCap: 6 },
    },
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

beforeEach(() => { mockState = baseState(); });

test('the line names the report and the applied figures, not the cue\'s', () => {
  expect(operativeReportLine(mockState.prescription.report)).toBe(EXPECTED_LINE);
  expect(operativeReportLine({ text: 'sore legs', effect: { halt: false, loadReductionPct: 0, setDelta: 0, rpeCap: null } }))
    .toBe('Your report “sore legs” did not change today\'s plan.');
});

test('TODAY names the report and the applied change', () => {
  render(<TodayScreen />);
  expect(screen.getByTestId('today-report-line')).toHaveTextContent(EXPECTED_LINE);
  expect(screen.queryByText(/40%/)).toBeNull();
});

test('READY names the report and does not say the signals support the planned work', () => {
  render(<ReadinessScreen onOpenCoach={jest.fn()} />);
  expect(screen.getByTestId('readiness-report-line')).toHaveTextContent(EXPECTED_LINE);
  fireEvent.press(screen.getByText('Why this recommendation'));
  expect(screen.queryByText('Your recovery signals support the planned work.')).toBeNull();
  expect(screen.getByText('Your recovery signals are good, but a report you saved today changed the plan.')).toBeOnTheScreen();
  expect(screen.queryByText(/40%/)).toBeNull();
});

test('PLAN names the report and the applied change on the Today card', () => {
  render(<BlockScreen />);
  expect(screen.getByTestId('plan-report-line')).toHaveTextContent(EXPECTED_LINE);
});

test('without a report, no line shows and READY keeps its signals sentence', () => {
  mockState = baseState({
    lastTriage: null,
    prescription: { forDate: TODAY, source: 'policy', vector: { load_modifier: 1, set_modifier: 0, rpe_cap: 8.5 }, report: null },
  });
  const { unmount } = render(<TodayScreen />);
  expect(screen.queryByTestId('today-report-line')).toBeNull();
  unmount();
  render(<ReadinessScreen onOpenCoach={jest.fn()} />);
  expect(screen.queryByTestId('readiness-report-line')).toBeNull();
  fireEvent.press(screen.getByText('Why this recommendation'));
  expect(screen.getByText('Your recovery signals support the planned work.')).toBeOnTheScreen();
});

test('a report on another day\'s prescription is not shown', () => {
  mockState = baseState({ prescription: { ...baseState().prescription, forDate: '2026-07-14' } });
  render(<TodayScreen />);
  expect(screen.queryByTestId('today-report-line')).toBeNull();
});
