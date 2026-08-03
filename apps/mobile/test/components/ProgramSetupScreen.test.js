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

  fireEvent.press(screen.getByText('Undulating'));
  expect(screen.getByText('Create program')).not.toBeDisabled();
});

