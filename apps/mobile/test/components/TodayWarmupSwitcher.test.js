/**
 * TodayWarmupSwitcher.test.js — WP-21 & WP-22 quick warm-up switcher on TodayScreen.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { WARMUP_COPY } from '@ak/inference';
import TodayScreen from '../../src/screens/TodayScreen';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  useStore: (selector) => selector({ getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }), ...mockState }),
}));

const TODAY = '2026-07-15';

const samplePresets = [
  {
    presetId: 1,
    name: 'Lower Prehab',
    purpose: 'prehab',
    weaknessTarget: 'knee_patellar',
    includeRampSets: true,
    createdAtMs: 1000,
    updatedAtMs: 1000,
    items: [],
  },
  {
    presetId: 2,
    name: 'Upper GPP',
    purpose: 'gpp',
    weaknessTarget: null,
    includeRampSets: true,
    createdAtMs: 1000,
    updatedAtMs: 1000,
    items: [],
  },
];

const baseState = (overrides = {}) => ({
  status: 'ready',
  error: null,
  today: TODAY,
  profile: {
    objective: 'strength',
    training_age: 'intermediate',
    weekly_frequency: 4,
    equipment_inventory: ['barbell'],
    base_rpe_cap: 8.5,
    session_duration_cap_min: 60,
  },
  vector: null,
  session: null,
  todayPlan: {
    plannedSessionId: 10,
    focus: 'lower',
    phase: 'accumulation',
    slots: [{
      slotIndex: 0,
      plannedSlotId: 101,
      movementId: 1,
      movementName: 'Competition Squat',
      sets: 3,
      reps: 5,
      target: { kind: 'reps', reps: 5 },
      targetRpe: 8,
      overrideLoadKg: null,
      overrideReason: null,
    }],
  },
  blockSessions: [{
    plannedSessionId: 10,
    weekIndex: 1,
    dayIndex: 1,
    focus: 'lower',
    phase: 'accumulation',
    sessionDate: TODAY,
    slotCount: 1,
    completionStatus: null,
  }],
  block: { blockId: 1, startDate: '2026-07-13', objective: 'strength', createdAtMs: 1 },
  hasArchivedBlock: false,
  lastTriage: null,
  pendingAutopilotAdjustments: [],
  warmupPresets: [],
  warmupSessionTypeAssignments: {},
  plannedSessionWarmupOverrides: {},
  freeFormWarmupOverride: null,
  setPlannedSessionWarmupOverride: jest.fn(),
  setFreeFormWarmupOverride: jest.fn(),
  startSession: jest.fn(),
  refreshVector: jest.fn(),
  recordedDurationsForFocus: jest.fn(() => []),
  ...overrides,
});

beforeEach(() => {
  mockState = baseState();
});

describe('TodayScreen quick warm-up switcher (WP-21 & WP-22)', () => {
  test('hides the warm-up switcher when no presets exist', () => {
    render(<TodayScreen />);
    expect(screen.queryByTestId('today-warmup-summary')).toBeNull();
    expect(screen.queryByTestId('today-warmup-change')).toBeNull();
  });

  test('renders resolved preset and updates planned-session override on today-card-planned', () => {
    mockState = baseState({
      warmupPresets: samplePresets,
      warmupSessionTypeAssignments: { lower: 1 },
    });
    render(<TodayScreen />);

    expect(screen.getByTestId('today-warmup-summary')).toHaveTextContent(WARMUP_COPY['WP-21']('Lower Prehab'));
    expect(screen.getByTestId('today-warmup-change')).toHaveTextContent(WARMUP_COPY['WP-22']);

    act(() => { fireEvent.press(screen.getByTestId('today-warmup-change')); });
    expect(screen.getByTestId('today-warmup-picker')).toBeOnTheScreen();

    act(() => { fireEvent.press(screen.getByTestId('today-warmup-option-2')); });
    expect(mockState.setPlannedSessionWarmupOverride).toHaveBeenCalledWith(10, { mode: 'preset', presetId: 2 });

    act(() => { fireEvent.press(screen.getByTestId('today-warmup-change')); });
    act(() => { fireEvent.press(screen.getByTestId('today-warmup-option-auto')); });
    expect(mockState.setPlannedSessionWarmupOverride).toHaveBeenCalledWith(10, { mode: 'standard_auto', presetId: null });
  });

  test('renders and updates free-form warm-up override inside unplanned start card', () => {
    mockState = baseState({
      todayPlan: null,
      block: null,
      blockSessions: [],
      warmupPresets: samplePresets,
      warmupSessionTypeAssignments: { free_form: 2 },
    });
    render(<TodayScreen />);

    expect(screen.getByTestId('today-card-unscheduled')).toBeOnTheScreen();
    expect(screen.getByTestId('today-warmup-summary')).toHaveTextContent(WARMUP_COPY['WP-21']('Upper GPP'));

    act(() => { fireEvent.press(screen.getByTestId('today-warmup-change')); });
    act(() => { fireEvent.press(screen.getByTestId('today-warmup-option-1')); });
    expect(mockState.setFreeFormWarmupOverride).toHaveBeenCalledWith({ mode: 'preset', presetId: 1 });

    act(() => { fireEvent.press(screen.getByTestId('today-warmup-change')); });
    act(() => { fireEvent.press(screen.getByTestId('today-warmup-option-auto')); });
    expect(mockState.setFreeFormWarmupOverride).toHaveBeenCalledWith({ mode: 'standard_auto', presetId: null });
  });
});
