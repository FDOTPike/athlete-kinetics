/**
 * TodayScreenEquipmentConflict.test.js — issue 149.
 *
 * After an equipment change, a planned workout can hold a movement the new
 * equipment does not cover. Start refuses that session, so Today must say so
 * BEFORE the Start button, and offer "Update today's workout" behind a
 * confirmation. These tests pin the screen's side of that contract: what is
 * shown, where, and which store call the confirmed control makes. The store
 * side (what the rebuild writes) is pinned by the real-store test
 * TodayUpdateWorkoutStore.test.js.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import TodayScreen from '../../src/screens/TodayScreen';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  useStore: (selector) => selector({ getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }), ...mockState }),
}));

/** Every rendered text string, in tree order. Walks children only: the host props hold circular references. */
const textsInOrder = (node, out = []) => {
  if (node === null || node === undefined) return out;
  if (typeof node === 'string') { out.push(node); return out; }
  (node.children ?? []).forEach((child) => textsInOrder(child, out));
  return out;
};

const TODAY = '2026-11-07';

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
  profile: {
    objective: 'strength', training_age: 'beginner', weekly_frequency: 3,
    equipment_inventory: ['kettlebell'], base_rpe_cap: 8.5, session_duration_cap_min: 60,
  },
  vector,
  prescription: null,
  session: null,
  todayPlan: {
    plannedSessionId: 1,
    focus: 'full',
    phase: 'accumulation',
    slots: [
      {
        slotIndex: 1, plannedSlotId: 10, movementId: 11, movementName: 'Double Kettlebell Front Squat',
        sets: 3, reps: 8, target: { kind: 'reps', reps: 8 }, targetRpe: 7.5,
        overrideLoadKg: null, overrideReason: null,
      },
    ],
  },
  blockSessions: [{
    plannedSessionId: 1, weekIndex: 1, dayIndex: 1, focus: 'full', phase: 'accumulation',
    sessionDate: TODAY, slotCount: 1, completionStatus: null,
  }],
  block: { blockId: 1, startDate: TODAY, objective: 'strength', createdAtMs: 1 },
  hasArchivedBlock: false,
  lastTriage: null,
  pendingAutopilotAdjustments: [],
  startSession: jest.fn(),
  refreshVector: jest.fn(),
  recordedDurationsForFocus: jest.fn(() => []),
  todayPlanEquipmentConflict: jest.fn(() => true),
  updateTodayPlannedWorkout: jest.fn(() => true),
  ...overrides,
});

beforeEach(() => {
  mockState = baseState();
});

test('the equipment conflict is shown before the Start button', () => {
  render(<TodayScreen />);

  const notice = screen.getByTestId('today-equipment-conflict-text');
  expect(notice).toHaveTextContent(/Your equipment has changed/);
  expect(screen.getByTestId('today-update-workout')).toBeOnTheScreen();

  // Order in the rendered tree: the explanation comes before Start.
  const texts = textsInOrder(screen.toJSON());
  const noticeAt = texts.findIndex((t) => t.startsWith('Your equipment has changed'));
  const startAt = texts.indexOf('Start workout');
  expect(noticeAt).toBeGreaterThan(-1);
  expect(startAt).toBeGreaterThan(-1);
  expect(noticeAt).toBeLessThan(startAt);
});

test('no conflict means no notice and no update control', () => {
  mockState = baseState({ todayPlanEquipmentConflict: jest.fn(() => false) });
  render(<TodayScreen />);

  expect(screen.queryByTestId('today-equipment-conflict')).toBeNull();
  expect(screen.queryByTestId('today-update-workout')).toBeNull();
  expect(screen.getByTestId('today-primary-start')).toBeOnTheScreen();
});

test('Update asks for confirmation, and only the confirmed tap changes the workout', () => {
  render(<TodayScreen />);

  fireEvent.press(screen.getByTestId('today-update-workout'));
  expect(mockState.updateTodayPlannedWorkout).not.toHaveBeenCalled();
  expect(screen.getByTestId('today-update-confirm')).toBeOnTheScreen();

  fireEvent.press(screen.getByTestId('today-update-confirm-yes'));
  expect(mockState.updateTodayPlannedWorkout).toHaveBeenCalledTimes(1);
});

test('Cancel at the confirmation changes nothing', () => {
  render(<TodayScreen />);

  fireEvent.press(screen.getByTestId('today-update-workout'));
  fireEvent.press(screen.getByTestId('today-update-confirm-no'));

  expect(mockState.updateTodayPlannedWorkout).not.toHaveBeenCalled();
  expect(screen.queryByTestId('today-update-confirm')).toBeNull();
  expect(screen.getByTestId('today-update-workout')).toBeOnTheScreen();
});

test('the notice and update control work with no readiness vector', () => {
  mockState = baseState({ vector: null, prescription: null });
  render(<TodayScreen />);

  expect(screen.getByTestId('today-equipment-conflict-text')).toBeOnTheScreen();
  fireEvent.press(screen.getByTestId('today-update-workout'));
  fireEvent.press(screen.getByTestId('today-update-confirm-yes'));
  expect(mockState.updateTodayPlannedWorkout).toHaveBeenCalledTimes(1);
});

test('a refusal from the store is shown on Today', () => {
  mockState = baseState({
    error: "Today's workout has already started, so it is not changed.",
  });
  render(<TodayScreen />);

  expect(screen.getByTestId('today-error')).toHaveTextContent(/Today.s workout has already started/);
});
