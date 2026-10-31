import React from 'react';
import { render, screen } from '@testing-library/react-native';
import BlockScreen from '../../src/screens/BlockScreen';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  localToday: () => '2026-08-11',
  palette: {
    bg: '#000',
    surface: '#15151A',
    line: '#26262E',
    text: '#F4F4F6',
    dim: '#86868F',
    green: '#2EE6A8',
    amber: '#FFB454',
    red: '#FF5D5D',
  },
  useStore: (selector) => selector({ getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }), ...mockState }),
}));

// The first BlockScreen render in a jest worker can take several seconds.
jest.setTimeout(30000);

// The panel lists the autopilot changes stored when the ACTIVE block was
// built (planned_slot_autopilot rows, one per planned slot). It used to be
// headed "What changes next block" and print the raw reason token.
describe('Changed in this block panel', () => {
  const baseProfile = {
    training_age: 'intermediate',
    equipment: ['barbell'],
    specialistEquipment: [],
    primary_goal: 'strength',
    objective: 'strength',
    schedule_days: [1, 3, 5],
  };

  const sampleBlock = {
    blockId: 101,
    startDate: '2026-08-01',
    objective: 'strength',
    createdAtMs: 1770000000000,
  };

  const sampleSessions = [
    {
      plannedSessionId: 1, weekIndex: 1, dayIndex: 1, focus: 'lower', phase: 'accumulation',
      sessionDate: '2026-08-01', slotCount: 3, completionStatus: 'complete',
    },
    {
      plannedSessionId: 2, weekIndex: 4, dayIndex: 5, focus: 'upper', phase: 'deload',
      sessionDate: '2026-08-28', slotCount: 3, completionStatus: null,
    },
  ];

  const stateWith = (adjustments, overrides = {}) => ({
    vector: { date: '2026-08-11', readiness_score: 75, sleep_score: 80, strain_score: 50 },
    today: '2026-08-11',
    profile: baseProfile,
    prescription: null,
    profileNotes: [],
    triageReady: true,
    triaging: false,
    lastTriage: null,
    block: sampleBlock,
    blockMeta: { schemaType: 'LINEAR', macroBlockIndex: 1, macroPhase: 'BUILD', peakShifted: false },
    oneRepMaxes: {},
    blockSessions: sampleSessions,
    todayPlan: null,
    hasArchivedBlock: false,
    session: null,
    generateNewBlock: jest.fn(),
    loadSessionSlots: jest.fn(),
    reportSubjective: jest.fn(),
    program: null,
    suspension: null,
    previewNextProgramBlock: jest.fn(),
    continueTrainingProgram: jest.fn(),
    archiveTrainingProgram: jest.fn(),
    startSession: jest.fn(),
    routineTemplates: [],
    freezeRoutineTemplateToPlannedSession: jest.fn(),
    deleteRoutineTemplate: jest.fn(),
    pendingAutopilotAdjustments: adjustments,
    getPendingAutopilotAdjustments: jest.fn(() => adjustments),
    ...overrides,
  });

  const row = (plannedSlotId, movementId, movementName, reason, rpeDelta = -0.5, setDelta = -1) => ({
    plannedSlotId, movementId, movementName, rpeDelta, setDelta, reason,
  });

  const EASED = 'Eased off — your recent sets felt harder than planned.';
  const RAISED = 'Nudged up — your recent sets felt easier than planned.';
  const SAFETY = 'Eased for safety — a recent safety signal lowered this target.';

  test('shows the heading, the intro and plain reason wording, never the stored token', () => {
    mockState = stateWith([
      row(501, 10, 'Overhead Barbell Press', 'held_safety'),
      row(502, 12, 'Barbell Deadlift', 'raised', 0.5, 1),
    ]);
    render(<BlockScreen onSessionStarted={jest.fn()} />);

    expect(screen.getByText('FIXED UNTIL 2026-08-28')).toBeOnTheScreen();
    expect(screen.getByTestId('block-adjustments-panel')).toBeOnTheScreen();
    expect(screen.getByText('Changed in this block')).toBeOnTheScreen();
    expect(screen.getByText('These adjustments were applied when this block was built.')).toBeOnTheScreen();
    expect(screen.getByText(`Overhead Barbell Press: ${SAFETY}`)).toBeOnTheScreen();
    expect(screen.getByText(`Barbell Deadlift: ${RAISED}`)).toBeOnTheScreen();
    expect(screen.queryByText(/held_safety/)).toBeNull();
    expect(screen.queryByText('What changes next block')).toBeNull();
    expect(screen.queryByText(/next one is built/)).toBeNull();
  });

  test('lists a movement once although it has a row for every planned slot', () => {
    mockState = stateWith([
      row(601, 20, 'Back Squat', 'eased'),
      row(602, 20, 'Back Squat', 'eased'),
      row(603, 20, 'Back Squat', 'eased'),
    ]);
    render(<BlockScreen onSessionStarted={jest.fn()} />);

    expect(screen.getAllByText(`Back Squat: ${EASED}`)).toHaveLength(1);
  });

  test('keeps distinct reasons for the same movement', () => {
    mockState = stateWith([
      row(701, 30, 'Bench Press', 'eased'),
      row(702, 30, 'Bench Press', 'held_safety'),
    ]);
    render(<BlockScreen onSessionStarted={jest.fn()} />);

    expect(screen.getByText(`Bench Press: ${EASED}`)).toBeOnTheScreen();
    expect(screen.getByText(`Bench Press: ${SAFETY}`)).toBeOnTheScreen();
  });

  test('leaves out a reason with no plain wording and hides the panel when nothing is left', () => {
    mockState = stateWith([row(801, 40, 'Barbell Row', 'something_else')]);
    render(<BlockScreen onSessionStarted={jest.fn()} />);

    expect(screen.queryByTestId('block-adjustments-panel')).toBeNull();
    expect(screen.queryByText(/something_else/)).toBeNull();
  });

  test('hides the panel when the block has no stored changes', () => {
    mockState = stateWith([]);
    render(<BlockScreen onSessionStarted={jest.fn()} />);

    expect(screen.queryByTestId('block-adjustments-panel')).toBeNull();
    expect(screen.queryByText('Changed in this block')).toBeNull();
    expect(screen.queryByText(/Nothing queued/)).toBeNull();
  });

  test('hides the panel when there is no active block', () => {
    mockState = stateWith([row(901, 50, 'Back Squat', 'eased')], { block: null, blockMeta: null, blockSessions: [] });
    render(<BlockScreen onSessionStarted={jest.fn()} />);

    expect(screen.queryByTestId('block-adjustments-panel')).toBeNull();
  });

  test('rendering the panel does not invoke write actions on the store', () => {
    mockState = stateWith([row(1001, 60, 'Back Squat', 'eased')]);
    render(<BlockScreen onSessionStarted={jest.fn()} />);

    expect(screen.getByTestId('block-adjustments-panel')).toBeOnTheScreen();
    expect(mockState.generateNewBlock).not.toHaveBeenCalled();
    expect(mockState.continueTrainingProgram).not.toHaveBeenCalled();
    expect(mockState.startSession).not.toHaveBeenCalled();
  });
});
