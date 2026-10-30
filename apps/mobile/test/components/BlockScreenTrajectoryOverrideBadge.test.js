import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import BlockScreen from '../../src/screens/BlockScreen';

let mockState;

jest.mock('@ak/inference', () => {
  const actual = jest.requireActual('@ak/inference');
  return {
    ...actual,
    SCHEMA_TYPES: ['LINEAR', 'WAVE', 'STEP', 'APRE'],
    targetLoadKg: jest.fn(() => 100),
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
const apreSlot = {
  slotIndex: 0,
  plannedSlotId: 10,
  movementId: 1,
  movementName: 'Barbell Back Squat',
  sets: 3,
  reps: 6,
  target: { kind: 'reps', reps: 6 },
  targetRpe: 8.0,
  overrideLoadKg: 105.0,
  overrideReason: 'APRE: +5 kg, beat the 6-rep target by 3 last week',
};

const buildState = (slotOverrides = {}) => {
  const slot = { ...apreSlot, ...slotOverrides };
  return {
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
      objective: 'strength', training_age: 'intermediate', weekly_frequency: 4,
      equipment_inventory: ['barbell', 'bench'], base_rpe_cap: 8.5,
      session_duration_cap_min: 60,
    },
    vector: {
      date: TODAY, readiness_score: 82, hrv_component: 84, load_component: 80,
      sleep_component: 79, spo2_component: 90, acwr: 1.02, acute_load_kg: 4200,
      chronic_load_kg: 4100, ln_rmssd: 4.2, hrv_z: 0.4, sleep_efficiency_pct: 88,
      spo2_night_mean: 97, computed_at_ms: 1,
    },
    trend: [{ date: '2026-07-14', readiness_score: 76 }],
    session: null,
    todayPlan: {
      plannedSessionId: 1,
      focus: 'lower',
      phase: 'accumulation',
      slots: [slot],
      routineStress: null,
    },
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
    blockMeta: { schemaType: 'APRE', macroBlockIndex: 1, macroPhase: 'gpp', peakShifted: false },
    hasArchivedBlock: false,
    oneRepMaxes: { 1: 140 },
    blockSessions: [{
      plannedSessionId: 1,
      weekIndex: 2,
      dayIndex: 1,
      focus: 'lower',
      phase: 'accumulation',
      sessionDate: TODAY,
      slotCount: 1,
      completionStatus: null,
    }],
    program: null,
    routineTemplates: [],
    pendingAutopilotAdjustments: [],
    generateNewBlock: jest.fn(),
    loadSessionSlots: jest.fn(() => [slot]),
    reportSubjective: jest.fn(() => Promise.resolve()),
    startSession: jest.fn(),
    returnCheckin: null,
    confirmReturnCheckin: jest.fn(),
    dismissReturnCheckin: jest.fn(),
    getMovementAvailabilityVerdicts: jest.fn(() => []),
    movements: [],
    niggles: [],
  };
};

test('plan-2: an untouched planned slot with an APRE slot_override load adjustment shows its APRE reason verbatim and is not mislabelled SUBSTITUTED', () => {
  mockState = buildState();

  render(<BlockScreen />);

  // Open "Preview today's session" to confirm it displays the APRE overridden load (105.0 kg)
  fireEvent.press(screen.getByRole('button', { name: /Preview today's session/i }));
  expect(screen.getByText('3 x 6 at RPE 8.0, 105.0 kg')).toBeOnTheScreen();

  // Tap the trajectory cell for the exact same session
  fireEvent.press(screen.getByLabelText(`Week 2, lower session on ${TODAY}`));

  // The movement was never substituted; its overrideLoadKg is an APRE load progression adjustment
  expect(screen.queryByText('SUBSTITUTED')).toBeNull();
  expect(screen.getByText('APRE: +5 kg, beat the 6-rep target by 3 last week')).toBeOnTheScreen();
});

test.each([null, ''])('plan-2: renders no override badge when overrideReason is %p', (overrideReason) => {
  mockState = buildState({ overrideReason });

  render(<BlockScreen />);

  fireEvent.press(screen.getByLabelText(`Week 2, lower session on ${TODAY}`));

  expect(screen.getByText('Barbell Back Squat')).toBeOnTheScreen();
  expect(screen.queryByText('SUBSTITUTED')).toBeNull();
  expect(screen.queryByText(/APRE:/i)).toBeNull();
});
