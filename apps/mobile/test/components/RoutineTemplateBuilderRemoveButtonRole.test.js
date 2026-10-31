import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RoutineTemplateBuilder } from '../../src/components/RoutineTemplateBuilder';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  useStore: (selector) => selector(mockState),
}));

test('plan-4: RoutineTemplateBuilder slot remove control exposes accessibilityRole="button"', () => {
  mockState = {
    movements: [],
    profile: {
      objective: 'strength',
      training_age: 'intermediate',
      weekly_frequency: 3,
      session_duration_cap_min: 60,
      base_rpe_cap: 9.0,
      equipment_inventory: ['barbell'],
    },
    niggles: [],
    activePriorExperienceMovementIds: [],
    movementAvailabilityRevision: 0,
    saveRoutineTemplate: jest.fn(),
    getMovementAvailabilityVerdicts: jest.fn(() => []),
    getRoutineRoleEligibleMovementIds: jest.fn(() => ({
      major: [],
      supplementary: [],
      accessory: [],
      conditional: [],
    })),
    getRoutinePlanningContract: jest.fn(() => ({
      liftFamilies: [],
      assistance: [],
    })),
    confirmMovementPriorExperience: jest.fn(() => true),
    revokeMovementPriorExperience: jest.fn(() => true),
    getTrainingSupportDecision: jest.fn(() => ({ status: 'available', holdIds: [] })),
  };

  render(<RoutineTemplateBuilder />);

  expect(screen.getByRole('button', { name: 'Remove day 1 slot 1' })).toBeOnTheScreen();
});
