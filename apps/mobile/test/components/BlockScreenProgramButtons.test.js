import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import BlockScreen from '../../src/screens/BlockScreen';

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

const TODAY = '2026-07-28';
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

const baseState = (overrides = {}) => ({
  status: 'ready',
  error: null,
  today: TODAY,
  activeAthleteId: 'default',
  activityLedger: {
    definitions: [], series: [], occurrences: [], completedLast28Days: 0,
    knownMinutesLast28Days: 0, completedWithUnknownDuration: 0,
    scheduledKnownMinutesPerWeek: 0, scheduledWithUnknownDuration: 0,
  },
  profile: {
    objective: 'strength', training_age: 'intermediate', weekly_frequency: 3,
    equipment_inventory: ['barbell', 'dumbbells', 'bench'], base_rpe_cap: 8.5,
    session_duration_cap_min: 60,
  },
  vector,
  trend: [{ date: '2026-07-27', readiness_score: 76 }],
  session: null,
  todayPlan: null,
  lastTriage: null,
  uiPreferences: { sessionModeOverride: null, readinessDetail: 'summary', restTimerEnabled: true, textScale: 'system' },
  boot: jest.fn(),
  refreshVector: jest.fn(),
  loadDemoAthlete: jest.fn(),
  resetTrainingData: jest.fn(),
  prescription: {
    forDate: TODAY,
    source: 'policy',
    vector: { load_modifier: 1.0, set_modifier: 0, rpe_cap: 8.5 },
  },
  profileNotes: [],
  triageReady: true,
  triaging: false,
  block: { blockId: 1, startDate: '2026-07-01', objective: 'strength', createdAtMs: 1 },
  blockMeta: { schemaType: 'LINEAR', macroBlockIndex: 1, macroPhase: 'gpp', peakShifted: false },
  hasArchivedBlock: false,
  oneRepMaxes: {},
  blockSessions: [{
    plannedSessionId: 1,
    weekIndex: 4,
    dayIndex: 5,
    focus: 'lower',
    phase: 'deload',
    sessionDate: '2026-07-26',
    slotCount: 1,
    completionStatus: 'complete',
  }],
  program: {
    programId: 1,
    objective: 'strength',
    startDate: '2026-07-01',
    horizonKind: 'weeks',
    requestedReviewDate: null,
    plannedEndDate: '2026-08-26',
    plannedBlockCount: 2,
    startingMacroBlockIndex: 1,
    schemaType: 'LINEAR',
    status: 'active',
    currentSequenceIndex: 1,
    days: [{ dayIndex: 1, focus: 'lower' }, { dayIndex: 3, focus: 'upper' }, { dayIndex: 5, focus: 'full' }],
    movementPreferences: [],
  },
  routineTemplates: [],
  pendingAutopilotAdjustments: [],
  generateNewBlock: jest.fn(),
  loadSessionSlots: jest.fn(() => []),
  reportSubjective: jest.fn(() => Promise.resolve()),
  startSession: jest.fn(),
  returnCheckin: null,
  confirmReturnCheckin: jest.fn(),
  dismissReturnCheckin: jest.fn(),
  getMovementAvailabilityVerdicts: jest.fn(() => []),
  previewTrainingProgram: jest.fn(() => ({
    objective: 'strength',
    startDate: TODAY,
    requestedReviewDate: null,
    plannedEndDate: '2026-08-26',
    plannedBlockCount: 2,
    schemaType: 'LINEAR',
    days: [{ dayIndex: 1, focus: 'lower' }, { dayIndex: 3, focus: 'upper' }, { dayIndex: 5, focus: 'full' }],
    plan: { sessions: [], warnings: [], timeBudget: { sessions: [], conflicts: [] } },
  })),
  previewNextProgramBlock: jest.fn(() => null),
  continueTrainingProgram: jest.fn(),
  archiveTrainingProgram: jest.fn(),
  movements: [],
  niggles: [],
  ...overrides,
});

test('plan-1: pressing "Plan the next block" on the Today card when a program is active and no future sessions remain opens a management surface', () => {
  mockState = baseState();
  render(<BlockScreen />);

  const cta = screen.getByRole('button', { name: 'Plan the next block' });
  fireEvent.press(cta);

  // When program !== null, pressing "Plan the next block" opens the program editor.
  expect(
    screen.queryByTestId('manage-block-section')
      ?? screen.queryByText('MANAGE PROGRAM')
      ?? screen.queryByText('Start a new block'),
  ).not.toBeNull();
  expect(screen.getByText('MANAGE PROGRAM')).toBeOnTheScreen();
});

test('plan-1: pressing "Set up a four-week block" on the Today card when block is null and a program exists opens the program editor', () => {
  mockState = baseState({ block: null, blockMeta: null, blockSessions: [] });
  render(<BlockScreen />);

  const cta = screen.getByRole('button', { name: 'Set up a four-week block' });
  fireEvent.press(cta);

  expect(screen.getByText('MANAGE PROGRAM')).toBeOnTheScreen();
});
