/**
 * Issue #214: Plan's planned-day detail showed sets, reps and RPE but no
 * kilograms, although the athlete had a 1RM for the movement and the workout
 * that day showed a load. The detail now shows the planned load from the same
 * calculation as today's preview, without today's readiness modifier.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { targetLoadKg } from '@ak/inference';
import BlockScreen from '../../src/screens/BlockScreen';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  useStore: (selector) => selector({ getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }), ...mockState }),
}));

const TODAY = '2026-11-18';

const vector = {
  date: TODAY, readiness_score: 82, hrv_component: 84, load_component: 80, sleep_component: 79,
  spo2_component: 90, acwr: 1.02, acute_load_kg: 4200, chronic_load_kg: 4100, ln_rmssd: 4.2,
  hrv_z: 0.4, sleep_efficiency_pct: 88, spo2_night_mean: 97, computed_at_ms: 1,
};

const slot = (overrides = {}) => ({
  slotIndex: 0,
  plannedSlotId: 10,
  movementId: 11,
  movementName: 'Competition Squat',
  sets: 4,
  reps: 8,
  target: { kind: 'reps', reps: 8 },
  targetRpe: 8,
  overrideLoadKg: null,
  overrideReason: null,
  ...overrides,
});

const baseState = (overrides = {}) => ({
  status: 'ready',
  error: null,
  today: TODAY,
  activeAthleteId: 'default',
  profile: {
    objective: 'strength', training_age: 'intermediate', weekly_frequency: 3,
    equipment_inventory: ['barbell'], base_rpe_cap: 8.5, session_duration_cap_min: 60,
  },
  vector,
  // Today's readiness reduces load. The planned-day detail must not use it.
  prescription: { forDate: TODAY, source: 'policy', vector: { load_modifier: 0.8, set_modifier: 0, rpe_cap: 8.5 } },
  profileNotes: [],
  triageReady: true,
  triaging: false,
  lastTriage: null,
  session: null,
  todayPlan: null,
  // Block starts 2026-11-09, so week 2 day 5 is 2026-11-21 (in the future).
  block: { blockId: 1, startDate: '2026-11-09', objective: 'strength', createdAtMs: 1 },
  blockMeta: { schemaType: 'LINEAR', macroBlockIndex: 1, macroPhase: 'gpp', peakShifted: false },
  hasArchivedBlock: false,
  oneRepMaxes: { 11: 120 },
  blockSessions: [{
    plannedSessionId: 7, weekIndex: 2, dayIndex: 5, focus: 'lower', phase: 'accumulation',
    sessionDate: '2026-11-21', slotCount: 3, completionStatus: null,
  }],
  program: null,
  routineTemplates: [],
  pendingAutopilotAdjustments: [],
  generateNewBlock: jest.fn(),
  loadSessionSlots: jest.fn(() => [
    slot(),
    slot({ slotIndex: 1, plannedSlotId: 11, movementId: 12, movementName: 'Walking Lunge', reps: 7, target: { kind: 'reps', reps: 7 } }),
    slot({ slotIndex: 2, plannedSlotId: 12, movementId: 13, movementName: 'Deadlift', overrideLoadKg: 140 }),
  ]),
  reportSubjective: jest.fn(() => Promise.resolve()),
  startSession: jest.fn(),
  previewNextProgramBlock: jest.fn(() => null),
  continueTrainingProgram: jest.fn(),
  archiveTrainingProgram: jest.fn(),
  movements: [],
  niggles: [],
  ...overrides,
});

const openDay = () => fireEvent.press(screen.getByLabelText('Week 2, lower session on 2026-11-21'));

test('#214: a future planned day with a 1RM shows the planned kg from targetLoadKg', () => {
  mockState = baseState();
  render(<BlockScreen />);
  openDay();

  const expected = targetLoadKg(120, 8, 8);
  expect(expected).toBeGreaterThan(0);
  expect(screen.getByText(`about ${expected.toFixed(1)} kg`)).toBeOnTheScreen();
  // Sets, reps and RPE stay as they were.
  expect(screen.getAllByText('4 x 8').length).toBeGreaterThan(0);
});

test('#214: a slot with a load override shows that load', () => {
  mockState = baseState();
  render(<BlockScreen />);
  openDay();
  expect(screen.getByText('about 140.0 kg')).toBeOnTheScreen();
});

test('#214: a slot with no 1RM shows only sets, reps and RPE', () => {
  mockState = baseState({ oneRepMaxes: {} });
  render(<BlockScreen />);
  openDay();
  expect(screen.getByText('4 x 7')).toBeOnTheScreen();
  // Only the override slot has a load; the two 1RM-less slots show none.
  expect(screen.getAllByText(/ kg$/)).toHaveLength(1);
  expect(screen.getByText('about 140.0 kg')).toBeOnTheScreen();
});
