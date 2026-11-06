/**
 * Issue #211 (Android walk I, finding I-1): after "I have trained Competition
 * Squat before" the anchor row flipped to "ready", but "Your first week" kept
 * the plan drawn before the declaration. The preview memo did not depend on
 * the store's prior-experience list or availability revision, so it never
 * asked the store for a new plan.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import ProgramSetupScreen from '../../src/screens/ProgramSetupScreen';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  useStore: (selector) => selector(mockState),
}));

const SQUAT_ID = 11;
const BOX_SQUAT_ID = 12;

const planWith = (movementId) => ({
  objective: 'strength', startDate: '2026-08-03', requestedReviewDate: null,
  plannedEndDate: '2026-08-31', plannedBlockCount: 1, schemaType: 'LINEAR',
  days: [{ dayIndex: 1, focus: 'lower' }],
  plan: {
    objective: 'strength', start_date: '2026-08-03', weeks: 4, schemaType: 'LINEAR',
    macroBlockIndex: 1, macroPhase: 'gpp', peakShifted: false,
    sessions: [{
      week_index: 1, day_index: 1, focus: 'lower',
      slots: [{ slot_index: 1, movement_id: movementId, sets: 3, reps: 5, target_rpe: 8 }],
    }],
    warnings: [], recovery: false, autopilotAdjusted: [],
  },
});

beforeEach(() => {
  mockState = {
    today: '2026-08-03', error: null, program: null, niggles: [],
    movements: [
      { movement_id: SQUAT_ID, name: 'Competition Squat', pattern: 'squat' },
      { movement_id: BOX_SQUAT_ID, name: 'Box Squat', pattern: 'squat' },
    ],
    profile: {
      objective: 'strength', training_age: 'intermediate', weekly_frequency: 1,
      equipment_inventory: [], base_rpe_cap: 9, session_duration_cap_min: 75,
    },
    activePriorExperienceMovementIds: [],
    movementAvailabilityRevision: 0,
    // Like the real store: the plan is read from the store at call time.
    previewTrainingProgram: jest.fn(() => planWith(
      mockState.activePriorExperienceMovementIds.includes(SQUAT_ID) ? SQUAT_ID : BOX_SQUAT_ID,
    )),
    createTrainingProgram: jest.fn(),
    updateProgramPreferences: jest.fn(),
    // Competition Squat is blocked by capability only, and a declaration clears it.
    getMovementAvailabilityVerdicts: jest.fn(() => [{
      movementId: SQUAT_ID, state: 'teaching_only', reasons: ['capability'],
      confirmationWouldClear: true, separateAttestationRequired: false,
    }]),
    confirmMovementPriorExperience: jest.fn((movementId) => {
      mockState = {
        ...mockState,
        activePriorExperienceMovementIds: [...mockState.activePriorExperienceMovementIds, movementId],
        movementAvailabilityRevision: mockState.movementAvailabilityRevision + 1,
      };
      return true;
    }),
  };
});

test('declaring prior experience redraws "Your first week" from a new preview', () => {
  const { rerender } = render(<ProgramSetupScreen />);
  const week = () => within(screen.getByTestId('recommended-week-card'));
  expect(week().getByText('Box Squat — 3×5')).toBeOnTheScreen();
  const callsBefore = mockState.previewTrainingProgram.mock.calls.length;

  fireEvent.press(screen.getByTestId(`anchor-confirm-${SQUAT_ID}`));
  expect(mockState.confirmMovementPriorExperience).toHaveBeenCalledWith(SQUAT_ID, 'weight_room');
  // The mocked store has no subscription; re-render as the store update would.
  rerender(<ProgramSetupScreen />);

  expect(screen.getByText('Competition Squat: ready')).toBeOnTheScreen();
  expect(mockState.previewTrainingProgram.mock.calls.length).toBeGreaterThan(callsBefore);
  expect(week().getByText('Competition Squat — 3×5')).toBeOnTheScreen();
  expect(week().queryByText('Box Squat — 3×5')).toBeNull();
});
