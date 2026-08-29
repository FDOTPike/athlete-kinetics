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
  useStore: (selector) => selector(mockState),
}));

describe('NextBlockPanel (Work Order C)', () => {
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
      plannedSessionId: 1,
      weekIndex: 1,
      dayIndex: 1,
      focus: 'lower',
      phase: 'accumulation',
      sessionDate: '2026-08-01',
      slotCount: 3,
      completionStatus: 'complete',
    },
    {
      plannedSessionId: 2,
      weekIndex: 4,
      dayIndex: 5,
      focus: 'upper',
      phase: 'deload',
      sessionDate: '2026-08-28',
      slotCount: 3,
      completionStatus: null,
    },
  ];

  test('renders heading, intro, and FIXED UNTIL badge on current block', () => {
    mockState = {
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
      pendingAutopilotAdjustments: [],
      getPendingAutopilotAdjustments: jest.fn(() => []),
    };

    render(<BlockScreen onSessionStarted={jest.fn()} />);

    // Check FIXED UNTIL badge
    expect(screen.getByText('FIXED UNTIL 2026-08-28')).toBeOnTheScreen();

    // Check Next Block panel heading & intro
    expect(screen.getByText('What changes next block')).toBeOnTheScreen();
    expect(screen.getByText('Your current block is fixed. These adjustments apply when the next one is built.')).toBeOnTheScreen();

    // Check empty state
    expect(screen.getByText('Nothing queued. Your next block will follow the plan as written.')).toBeOnTheScreen();
  });

  test('renders one row per pending adjustment with verbatim reason', () => {
    const mockAdjustments = [
      {
        plannedSlotId: 501,
        movementId: 10,
        movementName: 'Overhead Barbell Press',
        rpeDelta: -0.5,
        setDelta: -1,
        reason: 'eased due to shoulder niggle reported on Monday',
      },
      {
        plannedSlotId: 502,
        movementId: 12,
        movementName: 'Barbell Deadlift',
        rpeDelta: 0.5,
        setDelta: 1,
        reason: 'raised after consistent low RPE',
      },
    ];

    mockState = {
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
      pendingAutopilotAdjustments: mockAdjustments,
      getPendingAutopilotAdjustments: jest.fn(() => mockAdjustments),
    };

    render(<BlockScreen onSessionStarted={jest.fn()} />);

    expect(screen.getByText('What changes next block')).toBeOnTheScreen();
    expect(screen.getByText('Overhead Barbell Press: eased due to shoulder niggle reported on Monday')).toBeOnTheScreen();
    expect(screen.getByText('Barbell Deadlift: raised after consistent low RPE')).toBeOnTheScreen();
  });

  test('rendering the panel does not invoke write actions on the store', () => {
    const generateNewBlockMock = jest.fn();
    const continueProgramMock = jest.fn();

    mockState = {
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
      generateNewBlock: generateNewBlockMock,
      loadSessionSlots: jest.fn(),
      reportSubjective: jest.fn(),
      program: null,
      suspension: null,
      previewNextProgramBlock: jest.fn(),
      continueTrainingProgram: continueProgramMock,
      archiveTrainingProgram: jest.fn(),
      startSession: jest.fn(),
      routineTemplates: [],
      freezeRoutineTemplateToPlannedSession: jest.fn(),
      deleteRoutineTemplate: jest.fn(),
      pendingAutopilotAdjustments: [],
      getPendingAutopilotAdjustments: jest.fn(() => []),
    };

    render(<BlockScreen onSessionStarted={jest.fn()} />);

    expect(generateNewBlockMock).not.toHaveBeenCalled();
    expect(continueProgramMock).not.toHaveBeenCalled();
  });
});
