import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import LibraryScreenV2 from '../../src/screens/LibraryScreenV2';

let mockState;

jest.mock('../../src/state/useStore', () => {
  const actual = jest.requireActual('../../src/state/useStore');
  return {
    ...actual,
    useStore: (selector) => selector(mockState),
  };
});

const movement = {
  movement_id: 1,
  name: 'Barbell Back Squat',
  baseName: 'Back Squat',
  pattern: 'squat',
  is_compound: true,
  beginnerOk: true,
  loggingMode: 'reps',
  instructions: 'Stand with barbell on upper back and squat to depth.',
  cues: 'Chest up, knees out.',
  media: null,
  targetMuscles: ['quads', 'glutes'],
  coachingIntent: null,
  timePolicy: null,
  required: ['barbell', 'squat_rack'],
  supportedPrefixes: ['BB'],
  difficulty: 'Intermediate',
  preference: 0,
  progressionGroup: null,
  progressionRank: null,
  scope: 'full_body',
  sportTracking: false,
  implement: 'barbell',
};

test('plan-5: LibraryScreenV2 movement detail metadata badges are not exposed as interactive unselected buttons', () => {
  mockState = {
    movements: [movement],
    profile: {
      objective: 'strength',
      training_age: 'intermediate',
      weekly_frequency: 3,
      session_duration_cap_min: 60,
      base_rpe_cap: 8.5,
      equipment_inventory: ['barbell', 'squat_rack'],
    },
    niggles: [],
    today: '2026-07-15',
    activePriorExperienceMovementIds: [],
    movementAvailabilityRevision: 0,
    resolveGoalRung: jest.fn(() => null),
    getMovementAvailabilityVerdicts: jest.fn(() => [
      {
        movementId: 1,
        state: 'available',
        reasons: [],
        missingPrerequisites: [],
        priorExperienceConfirmed: false,
        confirmationWouldClear: false,
        separateAttestationRequired: false,
      },
    ]),
    confirmMovementPriorExperience: jest.fn(() => true),
    revokeMovementPriorExperience: jest.fn(() => true),
    loadIntents: {},
    saveMovementLoadIntent: jest.fn(() => true),
    error: null,
  };

  render(<LibraryScreenV2 />);

  fireEvent.press(screen.getByRole('button', { name: /Barbell Back Squat/i }));

  // Read-only metadata tags (COMPOUND, REPS, BARBELL, etc.) in the detail view must not be
  // announced as interactive toggle buttons with accessibilityRole="button".
  expect(screen.queryByRole('button', { name: 'COMPOUND' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'REPS' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'BARBELL' })).toBeNull();
});
