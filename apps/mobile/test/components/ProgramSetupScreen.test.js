import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ProgramSetupScreen from '../../src/screens/ProgramSetupScreen';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  useStore: (selector) => selector(mockState),
}));

const preview = {
  objective: 'strength', startDate: '2026-08-03', requestedReviewDate: null,
  plannedEndDate: '2026-08-31', plannedBlockCount: 1, schemaType: 'LINEAR',
  days: [{ dayIndex: 1, focus: 'full' }],
  plan: {
    objective: 'strength', start_date: '2026-08-03', weeks: 4, schemaType: 'LINEAR',
    macroBlockIndex: 1, macroPhase: 'gpp', peakShifted: false, sessions: [],
    warnings: [], recovery: false, autopilotAdjusted: [],
  },
};

const stateFor = (trainingAge) => ({
  today: '2026-08-03', error: null, program: null, movements: [],
  profile: {
    objective: 'strength', training_age: trainingAge, weekly_frequency: 1,
    equipment_inventory: [], base_rpe_cap: 9, session_duration_cap_min: 60,
  },
  previewTrainingProgram: jest.fn(() => preview),
  createTrainingProgram: jest.fn(),
  updateProgramPreferences: jest.fn(),
  getMovementAvailabilityVerdicts: jest.fn(() => []),
});

test('beginner sees an editable Linear recommendation and must choose a horizon', () => {
  mockState = stateFor('beginner');
  render(<ProgramSetupScreen />);

  expect(screen.getByText(/Linear is recommended/)).toBeOnTheScreen();
  expect(screen.getByText('Linear')).toBeOnTheScreen();
  expect(screen.getByText('Create program')).toBeDisabled();

  fireEvent.press(screen.getByText('Coach build'));
  fireEvent.press(screen.getByText('Duration'));
  fireEvent.press(screen.getByText('4 wk'));
  fireEvent.press(screen.getByText('Create program'));

  expect(mockState.createTrainingProgram).toHaveBeenCalledTimes(1);
  expect(mockState.createTrainingProgram.mock.calls[0][0]).toMatchObject({
    horizon: { kind: 'weeks', blockCount: 1 }, schemaType: 'LINEAR', dayIndices: [1],
  });
});

test('intermediate athlete cannot continue until a method is chosen', () => {
  mockState = stateFor('intermediate');
  render(<ProgramSetupScreen />);

  fireEvent.press(screen.getByText('Coach build'));
  fireEvent.press(screen.getByText('Duration'));
  fireEvent.press(screen.getByText('4 wk'));
  expect(screen.getByText('Create program')).toBeDisabled();

  // STEP is retired from selection (product simplification).
  expect(screen.queryByText('Step loading')).toBeNull();

  fireEvent.press(screen.getByText('Undulating'));
  expect(screen.getByText('Create program')).not.toBeDisabled();
});

test('rehab profile renders the approved rehab explainer and footer', () => {
  mockState = stateFor('intermediate');
  mockState.profile.objective = 'rehab';
  mockState.profile.weekly_frequency = 5;
  render(<ProgramSetupScreen />);

  expect(screen.getByText(
    'Every day is full-body and effort is capped at RPE 7. Rehab keeps volume low and frequency steady rather than loading any one pattern hard.',
  )).toBeOnTheScreen();
  expect(screen.getByText('You can change any day below.')).toBeOnTheScreen();
});

test('editing a day row changes the focus passed to block generation / program creation', () => {
  mockState = stateFor('intermediate');
  mockState.profile.objective = 'strength';
  mockState.profile.weekly_frequency = 2; // day 1 (Today) and day 4
  render(<ProgramSetupScreen />);

  fireEvent.press(screen.getByText('Coach build'));
  fireEvent.press(screen.getByText('Duration'));
  fireEvent.press(screen.getByText('4 wk'));
  fireEvent.press(screen.getByText('Linear'));

  // Day 1 default for strength 2-day is 'lower'. Change it to 'conditioning'.
  // Find conditioning chip for day 1
  const conditioningChips = screen.getAllByText('conditioning');
  fireEvent.press(conditioningChips[0]);

  fireEvent.press(screen.getByText('Create program'));

  expect(mockState.createTrainingProgram).toHaveBeenCalledTimes(1);
  const calledInput = mockState.createTrainingProgram.mock.calls[0][0];
  expect(calledInput.days).toBeDefined();
  expect(calledInput.days.find((d) => d.dayIndex === 1)?.focus).toBe('conditioning');
});

