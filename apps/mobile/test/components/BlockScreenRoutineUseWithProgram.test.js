/**
 * Issue #223: "Use day N today" was offered on a saved routine while a goal
 * program was active, but the store always refuses that
 * (freezeRoutineTemplateToPlannedSession throws for an active program), so
 * the tap did nothing visible. The control is not offered then; an
 * explanation is shown once instead. When a routine may be used is unchanged.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import BlockScreen from '../../src/screens/BlockScreen';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  useStore: (selector) => selector({ getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }), ...mockState }),
}));

const TODAY = '2026-12-01';
const EXPLANATION = "Routines can't replace your goal program's sessions. Edit them here, and use them when no goal program is active.";

const vector = {
  date: TODAY, readiness_score: 82, hrv_component: 84, load_component: 80, sleep_component: 79,
  spo2_component: 90, acwr: 1.02, acute_load_kg: 4200, chronic_load_kg: 4100, ln_rmssd: 4.2,
  hrv_z: 0.4, sleep_efficiency_pct: 88, spo2_night_mean: 97, computed_at_ms: 1,
};

const template = {
  routineTemplateId: 5,
  name: 'Heavy Upper',
  schemaType: 'LINEAR',
  slots: [
    { dayIndex: 1, slotIndex: 0, movementId: 21, sets: 4, reps: 5, targetRpe: 8 },
    { dayIndex: 1, slotIndex: 1, movementId: 22, sets: 4, reps: 8, targetRpe: 8 },
  ],
};

const activeProgram = {
  programId: 1, objective: 'strength', startDate: '2026-11-21', horizonKind: 'weeks',
  requestedReviewDate: null, plannedEndDate: '2027-02-13', plannedBlockCount: 3,
  startingMacroBlockIndex: 1, schemaType: 'LINEAR', status: 'active', currentSequenceIndex: 1,
  days: [{ dayIndex: 1, focus: 'lower' }, { dayIndex: 3, focus: 'upper' }],
  movementPreferences: [],
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
  vector,
  prescription: { forDate: TODAY, source: 'policy', vector: { load_modifier: 1.0, set_modifier: 0, rpe_cap: 8.5 } },
  profileNotes: [],
  triageReady: true,
  triaging: false,
  lastTriage: null,
  session: null,
  todayPlan: null,
  block: { blockId: 1, startDate: '2026-11-21', objective: 'strength', createdAtMs: 1 },
  blockMeta: { schemaType: 'LINEAR', macroBlockIndex: 1, macroPhase: 'gpp', peakShifted: false },
  hasArchivedBlock: false,
  oneRepMaxes: {},
  blockSessions: [],
  program: activeProgram,
  routineTemplates: [template],
  pendingAutopilotAdjustments: [],
  generateNewBlock: jest.fn(),
  loadSessionSlots: jest.fn(() => []),
  reportSubjective: jest.fn(() => Promise.resolve()),
  startSession: jest.fn(),
  freezeRoutineTemplateToPlannedSession: jest.fn(() => ({ archivedPreviousBlock: false })),
  deleteRoutineTemplate: jest.fn(),
  previewNextProgramBlock: jest.fn(() => null),
  continueTrainingProgram: jest.fn(),
  archiveTrainingProgram: jest.fn(),
  movements: [],
  niggles: [],
  ...overrides,
});

const openTemplates = () => fireEvent.press(screen.getByText('Routine templates'));

test('#223: with an active goal program, "Use day 1 today" is not offered; the explanation, Edit and Delete are', () => {
  mockState = baseState();
  render(<BlockScreen />);
  openTemplates();

  expect(screen.getByText('Heavy Upper')).toBeOnTheScreen();
  expect(screen.queryByText('Use day 1 today')).toBeNull();
  expect(screen.getAllByText(EXPLANATION)).toHaveLength(1);
  expect(screen.getByText('Edit')).toBeOnTheScreen();
  expect(screen.getByText('Delete')).toBeOnTheScreen();
});

test('#223: with no active goal program, "Use day 1 today" is shown and used as before', () => {
  mockState = baseState({ program: null });
  render(<BlockScreen />);
  openTemplates();

  expect(screen.queryByText(EXPLANATION)).toBeNull();
  fireEvent.press(screen.getByText('Use day 1 today'));
  fireEvent.press(screen.getByText('Confirm day 1'));
  expect(mockState.freezeRoutineTemplateToPlannedSession).toHaveBeenCalledWith(5, undefined, 1);
});

test('#223 review: a pending "Use day" confirmation is cleared when a goal program becomes active', () => {
  const freeze = jest.fn(() => ({ archivedPreviousBlock: false }));
  mockState = baseState({ program: null, freezeRoutineTemplateToPlannedSession: freeze });
  render(<BlockScreen />);
  openTemplates();
  fireEvent.press(screen.getByText('Use day 1 today'));
  expect(screen.getByText('Confirm day 1')).toBeOnTheScreen();

  // The athlete starts a goal program elsewhere and comes back to Plan.
  mockState = baseState({ freezeRoutineTemplateToPlannedSession: freeze });
  screen.rerender(<BlockScreen />);

  expect(screen.queryByText('Confirm day 1')).toBeNull();
  expect(screen.getByText('Edit')).toBeOnTheScreen();
  expect(screen.getByText('Delete')).toBeOnTheScreen();
  expect(freeze).not.toHaveBeenCalled();
});
