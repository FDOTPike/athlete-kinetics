/**
 * TodaySpine.test.js — R8 Phase 3 §2.1 trajectory-spine assertions.
 *
 * The trajectory derives every cell's calendar date from the block start
 * (addDaysIso(startDate, (week−1)*7 + dayIndex)) — the SAME formula the block
 * generator uses for session_date. These tests pin the four behaviours the
 * work order mandates:
 *
 *   1. A scheduled session landing on today keeps the chalk spine (selected)
 *      and renders exactly one today-marker — including mid-block, not only
 *      week 1 day 1.
 *   2. A recovery/rest cell landing on today renders EXACTLY ONE today-marker:
 *      chalk left spine, accessible label "Today — recovery day", text 'Today'
 *      instead of the rest dash.
 *   3. Past missed, past completed, halted, ordinary rest and future cells
 *      never receive chalk or a marker.
 *   4. When today lies outside the 28-cell window, ZERO today markers render.
 *
 * Fixtures keep blockSessions[].sessionDate CONSISTENT with the derivation
 * formula (start + (week−1)*7 + (dayIndex−1)) — the generator contract the
 * screen must trust.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import BlockScreen from '../../src/screens/BlockScreen';
import { theme } from '../../src/theme/theme';

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
  useStore: (selector) => selector(mockState),
}));

// Block starts Monday 2026-07-13; every scenario lives inside week 1, so
// cellDate(dayIndex) = 2026-07-(12 + dayIndex).
const BLOCK_START = '2026-07-13';
const CHALK_SPINE = { borderLeftColor: theme.color.chalk, borderLeftWidth: 4 };

const session = (overrides = {}) => ({
  plannedSessionId: 1,
  weekIndex: 1,
  dayIndex: 1,
  focus: 'lower',
  phase: 'accumulation',
  sessionDate: BLOCK_START,
  slotCount: 1,
  completionStatus: null,
  ...overrides,
});

const baseState = (overrides = {}) => ({
  status: 'ready',
  error: null,
  today: BLOCK_START,
  profile: {
    objective: 'strength', training_age: 'intermediate', weekly_frequency: 3,
    equipment_inventory: ['barbell'], base_rpe_cap: 8.5, session_duration_cap_min: 60,
  },
  // BlockScreen returns its "Readiness is needed first" fallback while the
  // vector is null, so the trajectory (and the spine) requires readiness data.
  vector: {
    date: BLOCK_START,
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
  },
  trend: [],
  session: null,
  todayPlan: null,
  lastTriage: null,
  uiPreferences: { sessionModeOverride: null, readinessDetail: 'summary', restTimerEnabled: true, textScale: 'system' },
  boot: jest.fn(),
  refreshVector: jest.fn(),
  loadDemoAthlete: jest.fn(() => 'loaded'),
  resetTrainingData: jest.fn(),
  prescription: null,
  profileNotes: [],
  triageReady: true,
  triaging: false,
  block: { blockId: 1, startDate: BLOCK_START, objective: 'strength', createdAtMs: 1 },
  blockMeta: { schemaType: 'LINEAR', macroBlockIndex: 1, macroPhase: 'gpp', peakShifted: false },
  hasArchivedBlock: false,
  oneRepMaxes: {},
  blockSessions: [],
  generateNewBlock: jest.fn(),
  loadSessionSlots: jest.fn(() => []),
  reportSubjective: jest.fn(() => Promise.resolve()),
  startSession: jest.fn(),
  returnCheckin: null,
  confirmReturnCheckin: jest.fn(),
  dismissReturnCheckin: jest.fn(),
  getMovementAvailabilityVerdicts: jest.fn(() => []),
  previewTrainingProgram: jest.fn(() => ({ plan: { sessions: [] } })),
  previewNextProgramBlock: jest.fn(() => null),
  continueTrainingProgram: jest.fn(),
  archiveTrainingProgram: jest.fn(),
  updateProgramPreferences: jest.fn(),
  movements: [],
  niggles: [],
  ...overrides,
});

const notChalked = (element) => {
  const flat = StyleSheet.flatten(element.props.style);
  expect(
    flat.borderLeftWidth === 4 && flat.borderLeftColor === theme.color.chalk,
  ).toBe(false);
  if (element.props.accessibilityState !== undefined) {
    expect(element.props.accessibilityState.selected).toBe(false);
  }
};

beforeEach(() => {
  mockState = baseState();
});

test('a scheduled session on today keeps the chalk spine mid-block, not only on day one', () => {
  // Session on dayIndex 2 → cellDate = start + 1 = Tue 2026-07-14 = today.
  mockState = baseState({
    today: '2026-07-14',
    blockSessions: [session({
      plannedSessionId: 2, dayIndex: 2, sessionDate: '2026-07-14',
    })],
  });
  render(<BlockScreen />);

  expect(screen.queryAllByTestId('today-marker')).toHaveLength(1);
  const pressable = screen.getByLabelText('Week 1, lower session on 2026-07-14');
  expect(pressable.props.accessibilityState.selected).toBe(true);
  expect(StyleSheet.flatten(pressable.props.style)).toMatchObject(CHALK_SPINE);

  // The other 27 cells of the 28-cell window (all rest) keep the plain dash
  // and no marker; nothing else in the rail claims today.
  const restDashes = screen.getAllByText('-');
  expect(restDashes).toHaveLength(27);
});

test('a recovery day landing on today renders exactly one today-marker with chalk spine, accessible label, and Today text', () => {
  // Training Mon / Wed / Fri; today Tue 2026-07-14 → dayIndex 2 is REST.
  mockState = baseState({
    today: '2026-07-14',
    blockSessions: [
      session({ plannedSessionId: 1, dayIndex: 1, sessionDate: '2026-07-13' }),
      session({ plannedSessionId: 2, dayIndex: 3, sessionDate: '2026-07-15', focus: 'upper' }),
      session({ plannedSessionId: 3, dayIndex: 5, sessionDate: '2026-07-17', focus: 'full' }),
    ],
  });
  render(<BlockScreen />);

  const markers = screen.queryAllByTestId('today-marker');
  expect(markers).toHaveLength(1);

  const recoveryMarker = screen.getByLabelText('Today — recovery day');
  expect(recoveryMarker).toBeOnTheScreen();
  expect(recoveryMarker.props.accessibilityRole).toBe('text');
  // Chalk left spine on the recovery cell itself.
  const flat = StyleSheet.flatten(recoveryMarker.props.style);
  expect(flat.borderLeftWidth).toBe(4);
  expect(flat.borderLeftColor).toBe(theme.color.chalk);

  // 'Today' replaces the ordinary rest dash in that cell; the dash survives
  // nowhere in this week because every other position is either a session or
  // a weekend rest cell (which keeps its own dash).
  expect(screen.getByText('Today')).toBeOnTheScreen();

  // Scheduled neighbours stay unchalked.
  notChalked(screen.getByLabelText('Week 1, upper session on 2026-07-15'));
  notChalked(screen.getByLabelText('Week 1, full session on 2026-07-17'));
});

test('past missed, past completed, halted, ordinary rest and future cells never receive chalk or a marker', () => {
  // Today = Thu 2026-07-16 (dayIndex 4): the ONLY cell allowed chalk.
  mockState = baseState({
    today: '2026-07-16',
    blockSessions: [
      // Past missed: was scheduled, never completed.
      session({ plannedSessionId: 1, dayIndex: 1, sessionDate: '2026-07-13' }),
      // Past completed.
      session({ plannedSessionId: 2, dayIndex: 2, sessionDate: '2026-07-14', completionStatus: 'complete' }),
      // Past halted.
      session({ plannedSessionId: 3, dayIndex: 3, sessionDate: '2026-07-15', completionStatus: 'halted', focus: 'upper' }),
      // Today, scheduled.
      session({ plannedSessionId: 4, dayIndex: 4, sessionDate: '2026-07-16' }),
      // Future scheduled (Fri).
      session({ plannedSessionId: 5, dayIndex: 5, sessionDate: '2026-07-17', focus: 'full' }),
    ],
  });
  render(<BlockScreen />);

  expect(screen.queryAllByTestId('today-marker')).toHaveLength(1);
  const todayCell = screen.getByLabelText('Week 1, lower session on 2026-07-16');
  expect(todayCell.props.accessibilityState.selected).toBe(true);
  expect(StyleSheet.flatten(todayCell.props.style)).toMatchObject(CHALK_SPINE);

  notChalked(screen.getByLabelText('Week 1, lower session on 2026-07-13'));
  notChalked(screen.getByLabelText('Week 1, lower session on 2026-07-14, completed'));
  notChalked(screen.getByLabelText('Week 1, upper session on 2026-07-15, stopped'));
  notChalked(screen.getByLabelText('Week 1, full session on 2026-07-17'));

  // Ordinary rest cells (weekend of week 1 and all of weeks 2–4) render the
  // plain dash and never a marker.
  expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(9);
  expect(screen.queryByLabelText('Today — recovery day')).toBeNull();
});

test('when today lies outside the block, zero today markers render anywhere in the trajectory', () => {
  mockState = baseState({
    today: '2026-08-20', // three weeks after the 28-day window closed
    blockSessions: [
      session({ plannedSessionId: 1, dayIndex: 1, sessionDate: '2026-07-13' }),
      session({ plannedSessionId: 2, dayIndex: 3, sessionDate: '2026-07-15', focus: 'upper' }),
    ],
  });
  render(<BlockScreen />);

  expect(screen.queryAllByTestId('today-marker')).toHaveLength(0);
  expect(screen.queryByLabelText('Today — recovery day')).toBeNull();
  // Rest cells fall back to the plain dash; no cell claims selected state.
  const restDashes = screen.queryAllByText('-');
  expect(restDashes.length).toBeGreaterThanOrEqual(20);
  notChalked(screen.getByLabelText('Week 1, lower session on 2026-07-13'));
  notChalked(screen.getByLabelText('Week 1, upper session on 2026-07-15'));
});
