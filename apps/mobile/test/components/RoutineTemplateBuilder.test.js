import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { RoutineTemplateBuilder } from '../../src/components/RoutineTemplateBuilder';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  useStore: (selector) => selector(mockState),
}));

const movements = [
  { movement_id: 1, name: 'Competition Squat' },
  { movement_id: 2, name: 'Dumbbell Row' },
  { movement_id: 3, name: 'Advanced Skill' },
];

const available = (movementId) => ({ movementId, state: 'available', reasons: [] });

describe('RoutineTemplateBuilder', () => {
  let saveRoutineTemplate;

  beforeEach(() => {
    saveRoutineTemplate = jest.fn((input) => ({
      routineTemplateId: 10,
      name: input.name,
      schemaType: input.schemaType,
      createdAtMs: 1,
      updatedAtMs: 1,
      slots: input.slots.map((slot, index) => ({
        routineTemplateSlotId: index + 1,
        routineTemplateId: 10,
        movementName: movements.find((movement) => movement.movement_id === slot.movementId).name,
        sets: 3,
        reps: 5,
        targetRpe: 8,
        ...slot,
      })),
    }));
    mockState = {
      profile: {
        objective: 'strength',
        training_age: 'intermediate',
        session_duration_cap_min: 60,
        base_rpe_cap: 9,
      },
      movements,
      niggles: [],
      saveRoutineTemplate,
      getMovementAvailabilityVerdicts: () => [
        available(1),
        available(2),
        { movementId: 3, state: 'teaching_only', reasons: ['capability'] },
      ],
      getRoutineRoleEligibleMovementIds: () => ({
        major: [1],
        supplementary: [1, 2, 3],
        conditional: [],
      }),
    };
  });

  test('shows only the four implemented methods and three safe default slots', () => {
    render(<RoutineTemplateBuilder />);
    expect(screen.getByText('Linear')).toBeOnTheScreen();
    expect(screen.getByText('Undulating')).toBeOnTheScreen();
    expect(screen.getByText('Step Loading')).toBeOnTheScreen();
    expect(screen.getByText('Autoregulated')).toBeOnTheScreen();
    expect(screen.queryByText(/Conjugate/i)).toBeNull();
    expect(screen.getByText('Ordered Movements (3/6)')).toBeOnTheScreen();
  });

  test('keeps role-ineligible and capability-blocked movements teaching-only', () => {
    render(<RoutineTemplateBuilder />);
    fireEvent.press(screen.getByLabelText('Select movement for slot 1'));
    expect(screen.getByText('Teaching only (not ratified for major)')).toBeOnTheScreen();
    expect(screen.getByText('Teaching only (capability, not ratified for major)')).toBeOnTheScreen();
  });

  test('renders every seeded movement in a bounded picker list', () => {
    render(<RoutineTemplateBuilder />);
    fireEvent.press(screen.getByLabelText('Select movement for slot 1'));

    expect(StyleSheet.flatten(screen.getByTestId('movement-picker-card').props.style)).toMatchObject({
      height: '80%',
    });
    expect(screen.getByTestId('movement-picker-list')).toBeOnTheScreen();
    movements.forEach((movement) => {
      expect(screen.getByTestId(`movement-picker-row-${movement.movement_id}`)).toBeOnTheScreen();
      expect(screen.getByLabelText(`Choose ${movement.name}`)).toBeOnTheScreen();
    });
  });

  test('shows an honest empty state instead of a blank picker', () => {
    mockState.movements = [];
    mockState.getMovementAvailabilityVerdicts = () => [];
    mockState.getRoutineRoleEligibleMovementIds = () => ({
      major: [],
      supplementary: [],
      conditional: [],
    });

    render(<RoutineTemplateBuilder />);
    fireEvent.press(screen.getByLabelText('Select movement for slot 1'));

    expect(screen.getByText('No movements are available.')).toBeOnTheScreen();
  });

  test('preserves athlete-authored ordering when saving', () => {
    const onSaved = jest.fn();
    render(<RoutineTemplateBuilder onSaved={onSaved} />);
    fireEvent.changeText(screen.getByLabelText('Routine template name'), 'Ordered day');

    fireEvent.press(screen.getByLabelText('Select movement for slot 1'));
    fireEvent.press(screen.getByText('Competition Squat'));
    fireEvent.changeText(screen.getByLabelText('Sets for slot 1'), '6');
    fireEvent.changeText(screen.getByLabelText('Reps for slot 1'), '4');
    fireEvent.changeText(screen.getByLabelText('Target RPE for slot 1'), '8.5');
    expect(screen.getByText('6 sets x 4 reps @ RPE 8.5')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Select movement for slot 2'));
    fireEvent.press(screen.getByText('Dumbbell Row'));
    fireEvent.press(screen.getByLabelText('Remove slot 3'));
    fireEvent.press(screen.getByLabelText('Move slot 1 down'));
    fireEvent.press(screen.getByLabelText('Save routine template'));

    expect(saveRoutineTemplate).toHaveBeenCalledTimes(1);
    expect(saveRoutineTemplate.mock.calls[0][0].slots.map((slot) => slot.movementId)).toEqual([2, 1]);
    expect(saveRoutineTemplate.mock.calls[0][0].slots.map((slot) => slot.slotIndex)).toEqual([1, 2]);
    expect(saveRoutineTemplate.mock.calls[0][0].slots[1]).toMatchObject({ sets: 6, reps: 4, targetRpe: 8.5 });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  test('enforces role maxima and disables + Cond chip when conditional role has zero ratified movements', () => {
    render(<RoutineTemplateBuilder />);

    // In default mockState:
    // conditional has 0 ratified movements -> roleMaxima.conditional is 0 -> + Cond chip is disabled
    expect(screen.getByLabelText('+ Cond').props.accessibilityState?.disabled).toBe(true);

    // major has 1 ratified movement -> roleMaxima.major is 1 (1/1 slots filled) -> + Major chip is disabled
    expect(screen.getByLabelText('+ Major').props.accessibilityState?.disabled).toBe(true);

    // supplementary has 2/2 slots filled -> + Supp chip is disabled
    expect(screen.getByLabelText('+ Supp').props.accessibilityState?.disabled).toBe(true);
  });
});