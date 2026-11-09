/**
 * Issue #227: on Plan's four-week trajectory, a planned day before today that
 * was never trained looked exactly like a future day. Today already counts
 * those days as unfinished, so the two screens disagreed. Plan marks them
 * "Missed" without changing any plan data.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import BlockScreen from '../../src/screens/BlockScreen';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  useStore: (selector) => selector({ getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }), ...mockState }),
}));

const TODAY = '2026-12-12';

const vector = {
  date: TODAY, readiness_score: 82, hrv_component: 84, load_component: 80, sleep_component: 79,
  spo2_component: 90, acwr: 1.02, acute_load_kg: 4200, chronic_load_kg: 4100, ln_rmssd: 4.2,
  hrv_z: 0.4, sleep_efficiency_pct: 88, spo2_night_mean: 97, computed_at_ms: 1,
};

// Block starts Mon 2026-11-23, so week 3 runs 2026-12-07 .. 2026-12-13.
const planned = (plannedSessionId, dayIndex, focus, sessionDate, completionStatus) => ({
  plannedSessionId, weekIndex: 3, dayIndex, focus, phase: 'accumulation',
  sessionDate, slotCount: 1, completionStatus,
});

const baseState = (overrides = {}) => ({
  status: 'ready',
  error: null,
  today: TODAY,
  activeAthleteId: 'default',
  profile: {
    objective: 'strength', training_age: 'advanced', weekly_frequency: 4,
    equipment_inventory: ['barbell'], base_rpe_cap: 8.5, session_duration_cap_min: 60,
  },
  vector,
  prescription: { forDate: TODAY, source: 'policy', vector: { load_modifier: 1.0, set_modifier: 0, rpe_cap: 8.5 } },
  profileNotes: [],
  triageReady: true,
  triaging: false,
  lastTriage: null,
  session: null,
  todayPlan: null,
  block: { blockId: 1, startDate: '2026-11-23', objective: 'strength', createdAtMs: 1 },
  blockMeta: { schemaType: 'LINEAR', macroBlockIndex: 1, macroPhase: 'gpp', peakShifted: false },
  hasArchivedBlock: false,
  oneRepMaxes: {},
  blockSessions: [
    planned(1, 1, 'upper', '2026-12-07', 'complete'),
    planned(2, 2, 'lower', '2026-12-08', null),
    planned(3, 3, 'upper', '2026-12-09', 'halted'),
    planned(4, 7, 'lower', '2026-12-13', null),
  ],
  program: null,
  routineTemplates: [],
  pendingAutopilotAdjustments: [],
  generateNewBlock: jest.fn(),
  loadSessionSlots: jest.fn(() => []),
  reportSubjective: jest.fn(() => Promise.resolve()),
  startSession: jest.fn(),
  previewNextProgramBlock: jest.fn(() => null),
  continueTrainingProgram: jest.fn(),
  archiveTrainingProgram: jest.fn(),
  movements: [],
  niggles: [],
  ...overrides,
});

beforeEach(() => { mockState = baseState(); });

test('#227: a past planned day never trained shows "Missed" and its label ends ", not done"', () => {
  render(<BlockScreen />);
  const missed = screen.getByLabelText('Week 3, lower session on 2026-12-08, not done');
  expect(missed).toHaveTextContent('Missed');
});

test('#227: a future planned day still shows its focus', () => {
  render(<BlockScreen />);
  const future = screen.getByLabelText('Week 3, lower session on 2026-12-13');
  expect(future).toHaveTextContent('LWR');
});

test('#227: finished and stopped days keep their own marks', () => {
  render(<BlockScreen />);
  expect(screen.getByLabelText('Week 3, upper session on 2026-12-07, completed')).toHaveTextContent('Done');
  expect(screen.getByLabelText('Week 3, upper session on 2026-12-09, stopped')).toHaveTextContent('Stopped');
});

test('#227: the planned-day detail title says the missed day was not done', () => {
  render(<BlockScreen />);
  fireEvent.press(screen.getByLabelText('Week 3, lower session on 2026-12-08, not done'));
  expect(screen.getByText('2026-12-08 - Lower - not done')).toBeOnTheScreen();
});
