import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ReadinessScreen from '../../src/screens/ReadinessScreen';
import BlockScreen from '../../src/screens/BlockScreen';

let mockState;

jest.mock('@ak/inference', () => ({
  SCHEMA_TYPES: ['LINEAR', 'WAVE', 'STEP', 'APRE'],
  targetLoadKg: jest.fn(() => 42.5),
}));
jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
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
  prescription: {
    forDate: TODAY,
    source: 'policy',
    vector: { load_modifier: 0.9, set_modifier: -1, rpe_cap: 7.5 },
  },
  profileNotes: ['Keep the lower-body volume controlled.'],
  triageReady: true,
  triaging: false,
  block: { blockId: 1, startDate: '2026-07-01', objective: 'strength', createdAtMs: 1 },
  blockMeta: { schemaType: 'LINEAR', macroBlockIndex: 1, macroPhase: 'gpp', peakShifted: false },
  oneRepMaxes: {},
  blockSessions: [{
    plannedSessionId: 1,
    weekIndex: 1,
    dayIndex: 1,
    focus: 'lower',
    phase: 'accumulation',
    sessionDate: TODAY,
    slotCount: 1,
    trained: false,
  }],
  generateNewBlock: jest.fn(),
  loadSessionSlots: jest.fn(() => [todaySlot]),
  reportSubjective: jest.fn(() => Promise.resolve()),
  startSession: jest.fn(),
  ...overrides,
});

beforeEach(() => { mockState = baseState(); });

test('READY keeps one direct action and hides raw metrics until the relevant disclosure opens', () => {
  const openCoach = jest.fn();
  render(<ReadinessScreen onOpenCoach={openCoach} />);

  expect(screen.getByText('Ready to train')).toBeOnTheScreen();
  expect(screen.getByText("Follow today's plan at the effort it prescribes.")).toBeOnTheScreen();
  expect(screen.getByLabelText("Review today's plan")).toBeOnTheScreen();
  expect(screen.queryByText('Your recent training load and recovery signals support the planned work.')).toBeNull();
  expect(screen.queryByText('Acute to chronic load')).toBeNull();

  fireEvent.press(screen.getByLabelText('Why this recommendation'));
  expect(screen.getByText('Your recent training load and recovery signals support the planned work.')).toBeOnTheScreen();
  expect(screen.queryByText('Acute to chronic load')).toBeNull();
  fireEvent.press(screen.getByLabelText("Review today's plan"));
  expect(openCoach).toHaveBeenCalledTimes(1);
});

test('READY renders the full vector only for profiles that explicitly request it', () => {
  mockState = baseState({
    uiPreferences: { sessionModeOverride: null, readinessDetail: 'full', restTimerEnabled: true, textScale: 'system' },
  });
  render(<ReadinessScreen />);

  fireEvent.press(screen.getByLabelText('Why this recommendation'));
  expect(screen.queryByText('Readiness score')).toBeNull();
  fireEvent.press(screen.getByLabelText('Full readiness metrics'));
  expect(screen.getByText('Readiness score')).toBeOnTheScreen();
  expect(screen.getByText('82 / 100')).toBeOnTheScreen();
});

test('READY keeps a safety halt visible and routes its single action to Coach', () => {
  const openCoach = jest.fn();
  mockState = baseState({
    lastTriage: {
      kind: 'matched',
      directive: { halt: true, vector: { coaching_cue: 'Stop and recover today.' } },
    },
  });
  render(<ReadinessScreen onOpenCoach={openCoach} />);

  expect(screen.getByText('Resolve today\'s safety report')).toBeOnTheScreen();
  expect(screen.getByText('Training is paused for today. Review the report before doing more work.')).toBeOnTheScreen();
  fireEvent.press(screen.getByLabelText('Review safety report'));
  expect(openCoach).toHaveBeenCalledTimes(1);
});

test('COACH keeps the trajectory compact and expands a session only when its day is requested', () => {
  render(<BlockScreen />);

  expect(screen.getByText('Today: Lower')).toBeOnTheScreen();
  expect(screen.getByText('Four-week trajectory')).toBeOnTheScreen();
  expect(screen.queryByText('Goblet Squat')).toBeNull();
  expect(screen.queryByText('Choose a loading structure')).toBeNull();

  fireEvent.press(screen.getByLabelText(`Week 1, lower session on ${TODAY}`));
  expect(mockState.loadSessionSlots).toHaveBeenCalledWith(1);
  expect(screen.getByText('Goblet Squat')).toBeOnTheScreen();
  expect(screen.getByText('3 x 8')).toBeOnTheScreen();

  fireEvent.press(screen.getByLabelText('Why today changed'));
  expect(screen.getByText('Source')).toBeOnTheScreen();
  expect(screen.getByText('policy')).toBeOnTheScreen();

  fireEvent.press(screen.getByLabelText('Manage block'));
  expect(screen.getByText('Choose a loading structure')).toBeOnTheScreen();
});

test('COACH leaves the safety form behind its explicit action even during a halt', () => {
  mockState = baseState({
    lastTriage: {
      kind: 'matched',
      directive: {
        halt: true,
        followUp: 'Rest and reassess tomorrow.',
        vector: { coaching_cue: 'Stop training and recover today.' },
      },
    },
  });
  render(<BlockScreen />);

  expect(screen.getByText('Stop training today')).toBeOnTheScreen();
  expect(screen.queryByLabelText('Describe how your body feels today')).toBeNull();
  fireEvent.press(screen.getByLabelText('Review safety report'));
  expect(screen.getByLabelText('Describe how your body feels today')).toBeOnTheScreen();
});