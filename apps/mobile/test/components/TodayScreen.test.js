/**
 * TodayScreen.test.js — Astra UX Phase 1 W1 contracts.
 *
 * Two things are pinned here, and the split matters.
 *
 * 1. `deriveTodayState` is exercised DIRECTLY as a pure function. The defect
 *    being replaced (`isRestDay = todayPlan === null && !halted && !hasLiveSession`)
 *    was invisible precisely because it lived inside a render body, where the
 *    only way to observe it was to look at pixels. These tests observe the
 *    decision itself, so a future regression fails on the state name rather
 *    than on some downstream string.
 *
 * 2. The screen's ACTION IDENTITY is pinned separately: which store call each
 *    primary button makes, with which arguments. "One primary tap starts the
 *    workout" is an acceptance criterion, and a test that only asserted the
 *    button's label would pass while the button navigated to Coach — which is
 *    exactly the bug.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import TodayScreen from '../../src/screens/TodayScreen';
import {
  deriveTodayState,
  describeAdjustment,
  durationCopy,
  durationEstimate,
  medianMinutes,
  missedSessions,
  nextSessionAfter,
} from '../../src/state/todayState';

let mockState;

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

const slot = (overrides = {}) => ({
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
  ...overrides,
});

const blockSession = (overrides = {}) => ({
  plannedSessionId: 1,
  weekIndex: 1,
  dayIndex: 1,
  focus: 'lower',
  phase: 'accumulation',
  sessionDate: TODAY,
  slotCount: 1,
  completionStatus: null,
  ...overrides,
});

const baseState = (overrides = {}) => ({
  status: 'ready',
  error: null,
  today: TODAY,
  profile: {
    objective: 'strength', training_age: 'intermediate', weekly_frequency: 4,
    equipment_inventory: ['barbell'], base_rpe_cap: 8.5, session_duration_cap_min: 60,
  },
  vector,
  session: null,
  todayPlan: {
    plannedSessionId: 1,
    focus: 'lower',
    phase: 'accumulation',
    slots: [slot()],
  },
  blockSessions: [blockSession()],
  block: { blockId: 1, startDate: '2026-07-13', objective: 'strength', createdAtMs: 1 },
  hasArchivedBlock: false,
  lastTriage: null,
  pendingAutopilotAdjustments: [],
  startSession: jest.fn(),
  refreshVector: jest.fn(),
  recordedDurationsForFocus: jest.fn(() => []),
  ...overrides,
});

beforeEach(() => { mockState = baseState(); });

// ---------------------------------------------------------------------------
// The pure derivation
// ---------------------------------------------------------------------------

const pureInput = (overrides = {}) => ({
  today: TODAY,
  hasActiveSession: false,
  halted: false,
  todayPlan: { plannedSessionId: 1, focus: 'lower', slotCount: 3 },
  blockSessions: [blockSession()],
  hasActiveBlock: true,
  hasArchivedBlock: false,
  ...overrides,
});

describe('deriveTodayState separates the four states the old rest-day boolean conflated', () => {
  test('a scheduled rest day inside an active block is scheduled_rest, and names the next session', () => {
    const state = deriveTodayState(pureInput({
      todayPlan: null,
      blockSessions: [
        blockSession({ plannedSessionId: 1, sessionDate: '2026-07-14', completionStatus: 'complete' }),
        blockSession({ plannedSessionId: 2, sessionDate: '2026-07-16', focus: 'upper', slotCount: 4 }),
      ],
    }));
    expect(state.kind).toBe('scheduled_rest');
    expect(state.next).toEqual({
      plannedSessionId: 2, focus: 'upper', sessionDate: '2026-07-16', slotCount: 4,
    });
  });

  test('no active block at all is unscheduled/no_program — NOT a rest day', () => {
    const state = deriveTodayState(pureInput({
      todayPlan: null, blockSessions: [], hasActiveBlock: false,
    }));
    expect(state.kind).toBe('unscheduled');
    expect(state.reason).toBe('no_program');
  });

  test('an athlete whose previous block was archived reads as between_blocks, not no_program', () => {
    const state = deriveTodayState(pureInput({
      todayPlan: null, blockSessions: [], hasActiveBlock: false, hasArchivedBlock: true,
    }));
    expect(state).toEqual({ kind: 'unscheduled', reason: 'between_blocks', next: null });
  });

  test('an unfinished earlier session outranks rest and reports the EARLIEST plus a count', () => {
    const state = deriveTodayState(pureInput({
      todayPlan: null,
      blockSessions: [
        blockSession({ plannedSessionId: 1, sessionDate: '2026-07-13' }),
        blockSession({ plannedSessionId: 2, sessionDate: '2026-07-14', focus: 'upper' }),
        blockSession({ plannedSessionId: 3, sessionDate: '2026-07-17', focus: 'full' }),
      ],
    }));
    expect(state.kind).toBe('overdue');
    expect(state.missedCount).toBe(2);
    expect(state.earliest.sessionDate).toBe('2026-07-13');
    expect(state.next.sessionDate).toBe('2026-07-17');
  });

  test('a stopped session counts as attempted, never as missed', () => {
    // 'halted' is a real finalized outcome. Reporting it as unfinished work
    // would tell an athlete who stopped on purpose that they skipped.
    // A future session keeps today INSIDE the block window, so the only thing
    // that can push this away from scheduled_rest is the halted row being
    // miscounted as missed.
    const state = deriveTodayState(pureInput({
      todayPlan: null,
      blockSessions: [
        blockSession({ plannedSessionId: 1, sessionDate: '2026-07-13', completionStatus: 'halted' }),
        blockSession({ plannedSessionId: 2, sessionDate: '2026-07-14', completionStatus: 'complete' }),
        blockSession({ plannedSessionId: 3, sessionDate: '2026-07-17', focus: 'upper' }),
      ],
    }));
    expect(state.kind).toBe('scheduled_rest');
    expect(missedSessions([
      blockSession({ plannedSessionId: 1, sessionDate: '2026-07-13', completionStatus: 'halted' }),
    ], TODAY)).toEqual([]);
  });

  test('a block whose last session is in the past is block_ended, with no fabricated next', () => {
    const state = deriveTodayState(pureInput({
      todayPlan: null,
      blockSessions: [
        blockSession({ plannedSessionId: 1, sessionDate: '2026-07-01', completionStatus: 'complete' }),
        blockSession({ plannedSessionId: 2, sessionDate: '2026-07-02', completionStatus: 'complete' }),
      ],
    }));
    expect(state).toEqual({ kind: 'unscheduled', reason: 'block_ended', next: null });
  });

  test('a block that has not started yet is not_started_yet', () => {
    const state = deriveTodayState(pureInput({
      todayPlan: null,
      blockSessions: [blockSession({ plannedSessionId: 9, sessionDate: '2026-07-20' })],
    }));
    expect(state.kind).toBe('unscheduled');
    expect(state.reason).toBe('not_started_yet');
    expect(state.next.sessionDate).toBe('2026-07-20');
  });
});

describe('deriveTodayState priority order', () => {
  test('a safety halt outranks every training state, including an open session', () => {
    expect(deriveTodayState(pureInput({ halted: true, hasActiveSession: true })).kind)
      .toBe('halted');
  });

  test('an open session outranks today\'s plan', () => {
    expect(deriveTodayState(pureInput({ hasActiveSession: true })).kind)
      .toBe('active_session');
  });

  test('today\'s own work outranks overdue work, which is reported but not acted on', () => {
    const state = deriveTodayState(pureInput({
      blockSessions: [
        blockSession({ plannedSessionId: 1, sessionDate: '2026-07-13' }),
        blockSession({ plannedSessionId: 2, sessionDate: TODAY }),
      ],
    }));
    expect(state.kind).toBe('planned');
    expect(state.overdue).toHaveLength(1);
    expect(state.overdue[0].sessionDate).toBe('2026-07-13');
  });

  test('a finalized session today is completed_today, so no start is offered', () => {
    const state = deriveTodayState(pureInput({
      blockSessions: [blockSession({ sessionDate: TODAY, completionStatus: 'complete' })],
    }));
    expect(state.kind).toBe('completed_today');
  });

  test('a session today that was STOPPED still counts as today\'s work, not as done', () => {
    // Only 'complete' closes the day. A halted session may legitimately be
    // resumed as a fresh attempt, and calling it "done" would hide that.
    const state = deriveTodayState(pureInput({
      blockSessions: [blockSession({ sessionDate: TODAY, completionStatus: 'halted' })],
    }));
    expect(state.kind).toBe('planned');
  });

  test('nextSessionAfter is strict: a session dated today is never "next"', () => {
    expect(nextSessionAfter([blockSession({ sessionDate: TODAY })], TODAY)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Honest duration
// ---------------------------------------------------------------------------

describe('duration is measured or declared, never invented', () => {
  test('with no recorded sessions it falls back to the athlete\'s OWN configured cap', () => {
    const estimate = durationEstimate([], 60);
    expect(estimate).toEqual({ kind: 'cap', minutes: 60 });
    expect(durationCopy(estimate)).toBe('Up to 60 min — the session length you set');
  });

  test('with recorded sessions it reports a median and says how many it came from', () => {
    const estimate = durationEstimate([52, 47, 61], 60);
    expect(estimate).toEqual({ kind: 'recorded', minutes: 50, sampleSize: 3 });
    expect(durationCopy(estimate))
      .toBe('About 50 min — your median over 3 recorded sessions like this');
  });

  test('median rounds to five minutes and never claims under five', () => {
    expect(medianMinutes([1])).toBe(5);
    expect(medianMinutes([42, 48])).toBe(45);
    expect(medianMinutes([])).toBeNull();
    expect(medianMinutes([0, -3])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Adjustments in ordinary language
// ---------------------------------------------------------------------------

describe('adjustments read as English and never overstate', () => {
  test('a set reduction and an eased effort target both read plainly', () => {
    expect(describeAdjustment({
      movementName: 'Back Squat', rpeDelta: -0.5, setDelta: -1, reason: 'r',
    })).toBe('Back Squat — 1 set fewer, effort target eased by 0.5');
  });

  test('an increase is described as an increase', () => {
    expect(describeAdjustment({
      movementName: 'Bench Press', rpeDelta: 0.5, setDelta: 2, reason: 'r',
    })).toBe('Bench Press — 2 sets more, effort target raised by 0.5');
  });

  test('a row with no movement in either delta says so instead of inventing a verb', () => {
    expect(describeAdjustment({
      movementName: 'Row', rpeDelta: 0, setDelta: 0, reason: 'r',
    })).toBe('Row — reviewed, unchanged');
  });
});

// ---------------------------------------------------------------------------
// Screen behaviour and ACTION IDENTITY
// ---------------------------------------------------------------------------

describe('Today starts the workout directly — no Coach detour', () => {
  test('a planned day offers ONE primary action that calls the production start path', () => {
    const onOpenSession = jest.fn();
    const onOpenPlan = jest.fn();
    render(<TodayScreen onOpenSession={onOpenSession} onOpenPlan={onOpenPlan} />);

    expect(screen.getByTestId('today-card-planned')).toBeOnTheScreen();
    expect(screen.getByText('Lower')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('today-primary-start'));

    // The production entry point, called with NO arguments: `repeatPlanned`
    // stays unreachable from this screen, so Today cannot create a second
    // session from one planned session.
    expect(mockState.startSession).toHaveBeenCalledTimes(1);
    expect(mockState.startSession).toHaveBeenCalledWith();
    expect(onOpenSession).toHaveBeenCalledTimes(1);
    // The whole point: starting never routes through Plan/Coach.
    expect(onOpenPlan).not.toHaveBeenCalled();
  });

  test('an active session offers Resume, and resuming never starts a second session', () => {
    mockState = baseState({ session: { sessionId: 7, date: TODAY, startedAtMs: 1, sets: [] } });
    const onOpenSession = jest.fn();
    render(<TodayScreen onOpenSession={onOpenSession} />);

    expect(screen.getByTestId('today-card-active')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('today-primary-resume'));

    expect(onOpenSession).toHaveBeenCalledTimes(1);
    expect(mockState.startSession).not.toHaveBeenCalled();
  });

  test('the planned card shows a compact preview and truncates honestly', () => {
    mockState = baseState({
      todayPlan: {
        plannedSessionId: 1,
        focus: 'lower',
        phase: 'accumulation',
        slots: [
          slot({ plannedSlotId: 1, movementName: 'Back Squat' }),
          slot({ plannedSlotId: 2, movementName: 'Romanian Deadlift' }),
          slot({ plannedSlotId: 3, movementName: 'Split Squat' }),
          slot({ plannedSlotId: 4, movementName: 'Calf Raise' }),
          slot({ plannedSlotId: 5, movementName: 'Plank', target: { kind: 'time', seconds: 45 } }),
        ],
      },
    });
    render(<TodayScreen />);
    expect(screen.getByText('Back Squat · 3×8')).toBeOnTheScreen();
    expect(screen.getByText('+1 more')).toBeOnTheScreen();
    expect(screen.queryByText('Plank · 3×45s')).toBeNull();
  });

  test('the duration line reports the cap when the athlete has no recorded sessions', () => {
    render(<TodayScreen />);
    expect(screen.getByTestId('today-duration'))
      .toHaveTextContent('Up to 60 min — the session length you set');
    expect(mockState.recordedDurationsForFocus).toHaveBeenCalledWith('lower');
  });

  test('the duration line reports measured history when it exists', () => {
    mockState = baseState({ recordedDurationsForFocus: jest.fn(() => [55, 50, 58]) });
    render(<TodayScreen />);
    expect(screen.getByTestId('today-duration'))
      .toHaveTextContent('About 55 min — your median over 3 recorded sessions like this');
  });
});

describe('Today distinguishes the states rather than calling them all rest', () => {
  test('a scheduled rest day says rest and offers only a quiet off-plan action', () => {
    mockState = baseState({
      todayPlan: null,
      blockSessions: [
        blockSession({ plannedSessionId: 1, sessionDate: '2026-07-14', completionStatus: 'complete' }),
        blockSession({ plannedSessionId: 2, sessionDate: '2026-07-16', focus: 'upper' }),
      ],
    });
    render(<TodayScreen />);
    expect(screen.getByTestId('today-card-rest')).toBeOnTheScreen();
    expect(screen.getByText('Rest day')).toBeOnTheScreen();
    expect(screen.queryByTestId('today-primary-start')).toBeNull();
    expect(screen.getByTestId('today-next')).toHaveTextContent(/Upper on 2026-07-16/);
  });

  test('an athlete with no program is NOT told to rest', () => {
    mockState = baseState({ todayPlan: null, blockSessions: [], block: null });
    render(<TodayScreen />);
    expect(screen.getByTestId('today-card-unscheduled')).toBeOnTheScreen();
    expect(screen.getByText('No plan yet')).toBeOnTheScreen();
    expect(screen.queryByText('Rest day')).toBeNull();
  });

  test('a missed session is named with its date, and the plan is explicitly not changed', () => {
    const onOpenPlan = jest.fn();
    mockState = baseState({
      todayPlan: null,
      blockSessions: [blockSession({ plannedSessionId: 1, sessionDate: '2026-07-13' })],
    });
    render(<TodayScreen onOpenPlan={onOpenPlan} />);

    expect(screen.getByTestId('today-card-overdue')).toBeOnTheScreen();
    expect(screen.getByText(/unfinished session/)).toBeOnTheScreen();
    expect(screen.getByText(/Your plan has not been changed/)).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('today-primary-plan'));
    expect(onOpenPlan).toHaveBeenCalledTimes(1);
    expect(mockState.startSession).not.toHaveBeenCalled();
  });

  test('a completed day offers no primary start, only a quiet extra session', () => {
    mockState = baseState({
      blockSessions: [blockSession({ sessionDate: TODAY, completionStatus: 'complete' })],
    });
    render(<TodayScreen />);
    expect(screen.getByTestId('today-card-completed')).toBeOnTheScreen();
    expect(screen.queryByTestId('today-primary-start')).toBeNull();
    expect(screen.getByTestId('today-extra-session')).toBeOnTheScreen();
  });

  test('a safety halt takes the screen and offers no way to start', () => {
    mockState = baseState({
      lastTriage: { kind: 'matched', directive: { halt: true, vector: { coaching_cue: 'stop' }, followUp: null } },
    });
    render(<TodayScreen />);
    expect(screen.getByTestId('today-card-halted')).toBeOnTheScreen();
    expect(screen.queryByTestId('today-primary-start')).toBeNull();
    expect(screen.queryByTestId('today-adhoc-session')).toBeNull();
  });
});

describe('Today never manufactures a coaching message', () => {
  test('with no pending adjustments, the section is ABSENT — not a "nothing changed" line', () => {
    render(<TodayScreen />);
    expect(screen.queryByTestId('today-adjustments')).toBeNull();
    expect(screen.queryByText(/no changes/i)).toBeNull();
    expect(screen.queryByText(/unchanged/i)).toBeNull();
  });

  test('a real adjustment is shown in plain language beside its recorded reason', () => {
    mockState = baseState({
      pendingAutopilotAdjustments: [{
        plannedSlotId: 10,
        movementId: 11,
        movementName: 'Back Squat',
        rpeDelta: -0.5,
        setDelta: -1,
        reason: 'Readiness below the planned band for two days.',
      }],
    });
    render(<TodayScreen />);
    expect(screen.getByTestId('today-adjustments')).toBeOnTheScreen();
    expect(screen.getByText('Back Squat — 1 set fewer, effort target eased by 0.5'))
      .toBeOnTheScreen();
    expect(screen.getByText('Readiness below the planned band for two days.'))
      .toBeOnTheScreen();
  });

  test('missing readiness is stated as missing, never filled in with a number', () => {
    mockState = baseState({ vector: null });
    render(<TodayScreen />);
    expect(screen.getByTestId('today-readiness-none')).toBeOnTheScreen();
    expect(screen.queryByText(/\/ 100/)).toBeNull();
  });
});
