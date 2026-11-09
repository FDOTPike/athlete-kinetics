/**
 * Issue #221: on the morning after a goal-program block ends, Today counted
 * the block's unfinished sessions and sent the athlete to Plan to "see where
 * you are". Nothing said the block had ended. Today must say so and offer the
 * review of the next block instead.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import TodayScreen from '../../src/screens/TodayScreen';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  useStore: (selector) => selector({ getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }), ...mockState }),
}));

const TODAY = '2026-12-18';

const program = {
  programId: 1, objective: 'strength', startDate: '2026-11-20', horizonKind: 'weeks',
  requestedReviewDate: null, plannedEndDate: '2027-02-13', plannedBlockCount: 3,
  startingMacroBlockIndex: 1, schemaType: 'LINEAR', status: 'active', currentSequenceIndex: 1,
  days: [{ dayIndex: 1, focus: 'lower' }, { dayIndex: 3, focus: 'upper' }],
  movementPreferences: [],
};

const session = (id, sessionDate, completionStatus, focus = 'lower') => ({
  plannedSessionId: id, weekIndex: 3, dayIndex: 1, focus, phase: 'accumulation',
  sessionDate, slotCount: 3, completionStatus,
});

const baseState = (overrides = {}) => ({
  status: 'ready',
  error: null,
  today: TODAY,
  profile: {
    objective: 'strength', training_age: 'advanced', weekly_frequency: 2,
    equipment_inventory: ['barbell'], base_rpe_cap: 8.5, session_duration_cap_min: 60,
  },
  vector: null,
  prescription: null,
  session: null,
  todayPlan: null,
  // Block started 2026-11-20; day 28 is 2026-12-17.
  block: { blockId: 1, startDate: '2026-11-20', objective: 'strength', createdAtMs: 1 },
  blockSessions: [
    session(1, '2026-12-01', 'complete'),
    session(2, '2026-12-08', null),
    session(3, '2026-12-15', null, 'upper'),
  ],
  program,
  hasArchivedBlock: false,
  lastTriage: null,
  pendingAutopilotAdjustments: [],
  startSession: jest.fn(),
  refreshVector: jest.fn(),
  recordedDurationsForFocus: jest.fn(() => []),
  ...overrides,
});

test('#221: an ended program block shows the block-ended message and review action, not the unfinished-sessions card', () => {
  mockState = baseState();
  const onOpenPlan = jest.fn();
  render(<TodayScreen onOpenPlan={onOpenPlan} />);

  expect(screen.getByTestId('today-card-block-ended')).toBeOnTheScreen();
  expect(screen.getByText('Your block has ended')).toBeOnTheScreen();
  expect(screen.queryByTestId('today-card-overdue')).toBeNull();
  expect(screen.queryByText(/unfinished session/)).toBeNull();
  expect(screen.queryByLabelText('Open your plan to see unfinished sessions')).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Review the next block on your plan' }));
  expect(onOpenPlan).toHaveBeenCalledTimes(1);
});

test('#221: on the last block the action reads "Review goal"', () => {
  mockState = baseState({ program: { ...program, currentSequenceIndex: 3 } });
  render(<TodayScreen onOpenPlan={jest.fn()} />);
  expect(screen.getByText('Review goal')).toBeOnTheScreen();
});

test('#221: with every session done, the ended program block still gets the review action', () => {
  mockState = baseState({
    blockSessions: [session(1, '2026-12-01', 'complete'), session(2, '2026-12-15', 'complete')],
  });
  render(<TodayScreen onOpenPlan={jest.fn()} />);
  expect(screen.getByTestId('today-card-block-ended')).toBeOnTheScreen();
  expect(screen.queryByTestId('today-card-unscheduled')).toBeNull();
});

test('#221: inside the block\'s four weeks the overdue card is unchanged', () => {
  mockState = baseState({ today: '2026-12-17' });
  render(<TodayScreen onOpenPlan={jest.fn()} />);
  expect(screen.getByTestId('today-card-overdue')).toBeOnTheScreen();
  expect(screen.queryByTestId('today-card-block-ended')).toBeNull();
});

test('#221: without a goal program the overdue card is unchanged', () => {
  mockState = baseState({ program: null });
  render(<TodayScreen onOpenPlan={jest.fn()} />);
  expect(screen.getByTestId('today-card-overdue')).toBeOnTheScreen();
  expect(screen.queryByTestId('today-card-block-ended')).toBeNull();
});
