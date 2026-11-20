import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import BlockScreen from '../../src/screens/BlockScreen';
import TodayScreen from '../../src/screens/TodayScreen';

let mockState;

jest.mock('../../src/state/useStore', () => ({
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
  useStore: (selector) =>
    selector({
      getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }),
      ...mockState,
    }),
}));

const TODAY = '2026-07-13';

const slot = {
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

const baseState = (overrides = {}) => ({
  status: 'ready',
  error: null,
  today: TODAY,
  activeAthleteId: 'default',
  profile: {
    objective: 'strength',
    training_age: 'intermediate',
    weekly_frequency: 3,
    equipment_inventory: ['barbell', 'dumbbell'],
    base_rpe_cap: 8.5,
    session_duration_cap_min: 60,
  },
  vector: null,
  prescription: null,
  profileNotes: [],
  triageReady: true,
  triaging: false,
  lastTriage: null,
  session: null,
  todayPlan: null,
  block: { blockId: 1, startDate: TODAY, objective: 'strength', createdAtMs: 1 },
  blockMeta: { schemaType: 'LINEAR', macroBlockIndex: 1, macroPhase: 'accumulation', peakShifted: false },
  blockEmphasis: null,
  hasArchivedBlock: false,
  oneRepMaxes: { 11: 100 },
  blockSessions: [
    {
      plannedSessionId: 1,
      weekIndex: 1,
      dayIndex: 1,
      focus: 'lower',
      phase: 'accumulation',
      sessionDate: TODAY,
      slotCount: 1,
      completionStatus: null,
    },
  ],
  program: null,
  routineTemplates: [],
  pendingAutopilotAdjustments: [],
  activityLedger: { series: [], completions: [], exceptions: [] },
  movements: [],
  niggles: [],
  getMovementAvailabilityVerdicts: jest.fn(() => []),
  generateNewBlock: jest.fn(),
  loadSessionSlots: jest.fn(() => [slot]),
  reportSubjective: jest.fn(() => Promise.resolve()),
  startSession: jest.fn(),
  previewTrainingProgram: jest.fn(() => ({
    plan: {
      schemaType: 'LINEAR',
      macroPhase: 'accumulation',
      warnings: [],
      sessions: [{ week_index: 1, day_index: 1, focus: 'lower', phase: 'accumulation', session_date: TODAY, slots: [] }],
    },
    plannedBlockCount: 1,
    plannedEndDate: '2026-08-09',
  })),
  startTrainingProgram: jest.fn(),
  previewNextProgramBlock: jest.fn(() => null),
  continueTrainingProgram: jest.fn(),
  archiveTrainingProgram: jest.fn(),
  ...overrides,
});

describe('Issue #130 — Plan works before readiness exists', () => {
  test('BlockScreen with an active block and vector === null renders Four-week trajectory and lets the athlete tap a planned day to preview its movements', () => {
    mockState = baseState({ vector: null });
    render(<BlockScreen />);

    expect(screen.getByText('Four-week trajectory')).toBeOnTheScreen();
    expect(screen.getByText('Readiness is needed first')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText(`Week 1, lower session on ${TODAY}`));
    expect(mockState.loadSessionSlots).toHaveBeenCalledWith(1);
    expect(screen.getByText('Goblet Squat')).toBeOnTheScreen();
  });

  test('BlockScreen with block === null and vector === null renders Build your first block with Start a new block and opens NewBlockChooserScreen', () => {
    mockState = baseState({
      vector: null,
      block: null,
      blockMeta: null,
      blockSessions: [],
      hasArchivedBlock: false,
    });
    render(<BlockScreen />);

    expect(screen.getByText('Build your first block')).toBeOnTheScreen();
    expect(screen.getByText('Readiness is needed first')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Start a new block' }));
    expect(screen.getByTestId('new-block-chooser-screen')).toBeOnTheScreen();
    expect(screen.getByText('Pick how much you want the coach to decide.')).toBeOnTheScreen();
  });

  test('after initial ProgramSetupScreen is dismissed without a block, Today Open your plan -> Plan Start a new block reopens program setup', () => {
    mockState = baseState({
      vector: null,
      block: null,
      blockMeta: null,
      blockSessions: [],
      hasArchivedBlock: false,
    });
    const onOpenPlan = jest.fn();
    const { unmount } = render(<TodayScreen onOpenPlan={onOpenPlan} />);
    fireEvent.press(screen.getByRole('button', { name: 'Open your plan' }));
    expect(onOpenPlan).toHaveBeenCalledTimes(1);
    unmount();

    render(<BlockScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Start a new block' }));
    fireEvent.press(screen.getByText('Auto'));
    expect(screen.getByText('BUILD YOUR PROGRAM')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Create program' })).toBeOnTheScreen();
  });
});
