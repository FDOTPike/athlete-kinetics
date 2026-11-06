/**
 * Issue #221: after a goal-program block ends, a new day has no state_vector
 * row until a session ends, so Plan showed only "Readiness is needed first"
 * and "Review next block" was never rendered. The program could not move on.
 *
 * The review control must not depend on today's readiness. The safety card
 * and halt rules stay as they were.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import BlockScreen from '../../src/screens/BlockScreen';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  useStore: (selector) => selector({ getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }), ...mockState }),
}));

// Block started 2026-12-14; day 28 is 2027-01-10, so 2027-01-11 is past it.
const TODAY = '2027-01-11';

const nextBlockPlan = {
  schemaType: 'LINEAR',
  macroPhase: 'build',
  warnings: [],
  sessions: [
    { week_index: 1, day_index: 1 },
    { week_index: 1, day_index: 3 },
    { week_index: 2, day_index: 1 },
  ],
};

const baseState = (overrides = {}) => ({
  status: 'ready',
  error: null,
  today: TODAY,
  activeAthleteId: 'default',
  profile: {
    objective: 'strength', training_age: 'advanced', weekly_frequency: 2,
    equipment_inventory: ['barbell'], base_rpe_cap: 8.5, session_duration_cap_min: 60,
  },
  // No state_vector row for today and no prescription for today.
  vector: null,
  prescription: null,
  profileNotes: [],
  triageReady: true,
  triaging: false,
  lastTriage: null,
  session: null,
  todayPlan: null,
  block: { blockId: 1, startDate: '2026-12-14', objective: 'strength', createdAtMs: 1 },
  blockMeta: { schemaType: 'LINEAR', macroBlockIndex: 1, macroPhase: 'gpp', peakShifted: false },
  hasArchivedBlock: false,
  oneRepMaxes: {},
  blockSessions: [{
    plannedSessionId: 1, weekIndex: 4, dayIndex: 5, focus: 'lower', phase: 'deload',
    sessionDate: '2027-01-08', slotCount: 1, completionStatus: null,
  }],
  program: {
    programId: 1, objective: 'strength', startDate: '2026-12-14', horizonKind: 'weeks',
    requestedReviewDate: null, plannedEndDate: '2027-03-08', plannedBlockCount: 3,
    startingMacroBlockIndex: 1, schemaType: 'LINEAR', status: 'active', currentSequenceIndex: 1,
    days: [{ dayIndex: 1, focus: 'lower' }, { dayIndex: 3, focus: 'upper' }],
    movementPreferences: [],
  },
  routineTemplates: [],
  pendingAutopilotAdjustments: [],
  generateNewBlock: jest.fn(),
  loadSessionSlots: jest.fn(() => []),
  reportSubjective: jest.fn(() => Promise.resolve()),
  startSession: jest.fn(),
  previewNextProgramBlock: jest.fn(() => nextBlockPlan),
  continueTrainingProgram: jest.fn(),
  archiveTrainingProgram: jest.fn(),
  movements: [],
  niggles: [],
  ...overrides,
});

const haltTriage = {
  kind: 'matched',
  directive: {
    ruleId: 'RED_FLAG_SYSTEMIC',
    similarity: 1,
    matchedAnchor: 'dizziness',
    halt: true,
    followUp: null,
    vector: { load_modifier: 0, set_modifier: -99, rpe_cap: 0, coaching_cue: 'Systemic symptom reported. Stop the session and rest.' },
  },
};

test('#221: expired block with no readiness today still offers "Review next block", and pressing it previews the next block', () => {
  mockState = baseState();
  render(<BlockScreen />);

  expect(screen.getByText('Readiness is needed first')).toBeOnTheScreen();
  expect(screen.getByText('Your block has ended')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Review program continuation' }));

  expect(mockState.previewNextProgramBlock).toHaveBeenCalledTimes(1);
  expect(mockState.continueTrainingProgram).not.toHaveBeenCalled();
  expect(screen.getByText('NEXT BLOCK PREVIEW')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Confirm and start next program block' }));
  expect(mockState.continueTrainingProgram).toHaveBeenCalledTimes(1);
});

test('#221: the control reads "Review next block" before the last block and "Review goal" on it', () => {
  mockState = baseState();
  const { unmount } = render(<BlockScreen />);
  expect(screen.getByText('Review next block')).toBeOnTheScreen();
  unmount();

  mockState = baseState({
    previewNextProgramBlock: jest.fn(() => null),
    program: { ...baseState().program, currentSequenceIndex: 3 },
  });
  render(<BlockScreen />);
  fireEvent.press(screen.getByText('Review goal'));
  expect(mockState.continueTrainingProgram).toHaveBeenCalledTimes(1);
});

test('#221: after the last block, the goal reassessment is reachable without readiness', () => {
  mockState = baseState({ program: { ...baseState().program, status: 'review_due', currentSequenceIndex: 3 } });
  render(<BlockScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Archive completed program and reassess goal' }));
  expect(mockState.archiveTrainingProgram).toHaveBeenCalledTimes(1);
});

test('#221: a block still inside its four weeks shows no review control on the readiness gate', () => {
  mockState = baseState({ today: '2027-01-10' });
  render(<BlockScreen />);
  expect(screen.getByText('Readiness is needed first')).toBeOnTheScreen();
  expect(screen.queryByText('Your block has ended')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Review program continuation' })).toBeNull();
});

test('#221: a safety halt keeps its card, and the review control stays hidden as on the full Plan screen', () => {
  mockState = baseState({ lastTriage: haltTriage });
  render(<BlockScreen />);
  expect(screen.getByText('Stop training today')).toBeOnTheScreen();
  expect(screen.getByText('Systemic symptom reported. Stop the session and rest.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Review program continuation' })).toBeNull();
});
