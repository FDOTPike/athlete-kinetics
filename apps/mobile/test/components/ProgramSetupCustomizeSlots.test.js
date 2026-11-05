/**
 * Issue #216 (Android walk I, finding I-11): in "5. Customize generated week"
 * each slot was headed by a raw pattern code ("PUSH H") and listed every
 * allowed movement as a chip, 20 or more per slot, with the current choice
 * somewhere in the middle. Slots now have plain titles, start with the current
 * choice and a few alternatives, and "Show all (N)" opens the rest. Which
 * movements are allowed is unchanged.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import ProgramSetupScreen from '../../src/screens/ProgramSetupScreen';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  useStore: (selector) => selector(mockState),
}));

const SQUATS = ['Competition Squat', 'Bodyweight Squat', 'Box Squat', 'Double Kettlebell Front Squat',
  'Dumbbell Squat', 'Front Squat', 'Goblet Squat', 'Safety Bar Squat']
  .map((name, i) => ({ movement_id: 100 + i, name, pattern: 'squat' }));
const PUSHES = [{ movement_id: 200, name: 'Push-up', pattern: 'push_h' }];
const CURRENT_SQUAT = SQUATS[6]; // Goblet Squat: past the collapsed count in library order

beforeEach(() => {
  mockState = {
    today: '2026-08-03', error: null, program: null, niggles: [],
    movements: [...SQUATS, ...PUSHES],
    profile: {
      objective: 'strength', training_age: 'intermediate', weekly_frequency: 1,
      equipment_inventory: [], base_rpe_cap: 9, session_duration_cap_min: 75,
    },
    activePriorExperienceMovementIds: [],
    movementAvailabilityRevision: 0,
    previewTrainingProgram: jest.fn(() => ({
      objective: 'strength', startDate: '2026-08-03', requestedReviewDate: null,
      plannedEndDate: '2026-08-31', plannedBlockCount: 1, schemaType: 'LINEAR',
      days: [{ dayIndex: 1, focus: 'full' }],
      plan: {
        objective: 'strength', start_date: '2026-08-03', weeks: 4, schemaType: 'LINEAR',
        macroBlockIndex: 1, macroPhase: 'gpp', peakShifted: false,
        sessions: [{
          week_index: 1, day_index: 1, focus: 'full',
          slots: [
            { slot_index: 1, movement_id: CURRENT_SQUAT.movement_id, sets: 3, reps: 5, target_rpe: 8 },
            { slot_index: 2, movement_id: 200, sets: 3, reps: 8, target_rpe: 8 },
          ],
        }],
        warnings: [], recovery: false, autopilotAdjusted: [],
      },
    })),
    createTrainingProgram: jest.fn(),
    updateProgramPreferences: jest.fn(),
    confirmMovementPriorExperience: jest.fn(),
    getMovementAvailabilityVerdicts: jest.fn(() => [...SQUATS, ...PUSHES].map((m) => ({
      movementId: m.movement_id, state: 'available', reasons: [],
    }))),
  };
});

const openCustomize = () => {
  render(<ProgramSetupScreen />);
  fireEvent.press(screen.getByLabelText('Fine-tune your program (optional)'));
  fireEvent.press(screen.getByText('Customize'));
  return screen.getByTestId('customize-slot-1-1');
};
const chipNames = (slot) => within(slot).queryAllByRole('button')
  .map((node) => node.props.accessibilityLabel)
  .filter((label) => SQUATS.some((m) => m.name === label));

test('a push_h slot has a plain title, not the raw pattern code', () => {
  openCustomize();
  const pushSlot = screen.getByTestId('customize-slot-1-2');
  expect(within(pushSlot).getByText(/^Horizontal push/)).toBeOnTheScreen();
  expect(within(pushSlot).queryByText(/push h/i)).toBeNull();
  expect(within(screen.getByTestId('customize-slot-1-1')).getByText('Squat')).toBeOnTheScreen();
});

test('a long slot starts with the current choice and offers "Show all"', () => {
  const slot = openCustomize();
  const names = chipNames(slot);
  expect(names[0]).toBe(CURRENT_SQUAT.name);
  expect(names.length).toBeLessThan(SQUATS.length);
  expect(within(slot).getByText(`Show all (${SQUATS.length})`)).toBeOnTheScreen();
});

test('"Show all" lists every candidate, and the choice still works', () => {
  const slot = openCustomize();
  fireEvent.press(within(slot).getByText(`Show all (${SQUATS.length})`));
  const names = chipNames(slot);
  expect(new Set(names)).toEqual(new Set(SQUATS.map((m) => m.name)));
  expect(names).toHaveLength(SQUATS.length);

  fireEvent.press(within(slot).getByLabelText('Safety Bar Squat'));
  fireEvent.press(screen.getByText('Create program'));
  expect(mockState.createTrainingProgram.mock.calls[0][0].movementPreferences).toEqual([
    { dayIndex: 1, slotIndex: 1, pattern: 'squat', movementId: SQUATS[7].movement_id },
  ]);
});
