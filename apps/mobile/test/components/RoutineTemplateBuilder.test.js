import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { RoutineTemplateBuilder } from '../../src/components/RoutineTemplateBuilder';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  useStore: (selector) => selector(mockState),
  formatTeachingOnlyReason: (verdict) => verdict === undefined
    ? 'Access cannot be verified right now.'
    : verdict.reasons.includes('capability') ? 'Capability evidence is required.' : 'Teaching only.',
}));

const movements = [
  { movement_id: 1, name: 'Competition Squat', baseName: 'Squat', pattern: 'squat', cues: 'Brace', targetMuscles: ['quadriceps'], difficulty: 'Advanced' },
  { movement_id: 2, name: 'Dumbbell Row', baseName: 'Row', pattern: 'pull_h', cues: 'Pull', targetMuscles: ['lats'], difficulty: 'Intermediate' },
  { movement_id: 3, name: 'Advanced Skill', baseName: 'Skill', pattern: 'push_v', cues: 'Control', targetMuscles: ['shoulders'], difficulty: 'Intermediate' },
];

const available = (movementId) => ({
  movementId, state: 'available', reasons: [], effectiveContext: 'weight_room',
  capabilitySource: 'not_required', blockingPrerequisiteMovementIds: [],
  confirmationWouldClear: false, separateAttestationRequired: false,
});

const planningContract = (contractMovements) => ({
  liftFamilies: contractMovements.map((movement) => ({
    movementId: movement.movement_id,
    family: movement.name.includes('Squat') || movement.name.includes('Hip Thrust')
      ? 'squat'
      : movement.name.includes('Deadlift') ? 'deadlift'
        : movement.name.includes('Row') ? 'horizontal_pull' : 'overhead_press',
    stressCoefficient: 1,
    preferredPurpose: null,
  })),
  assistance: contractMovements.flatMap((movement) => [
    'squat', 'deadlift', 'horizontal_pull', 'overhead_press',
  ].map((family) => ({
    family,
    movementId: movement.movement_id,
    distance: 1,
    stressFactor: 0.4,
    fatigueCost: 2,
    reason: 'Test fixture direct assistance.',
  }))),
});

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
        { ...available(3), state: 'teaching_only', reasons: ['capability'],
          capabilitySource: 'blocked', blockingPrerequisiteMovementIds: [2], confirmationWouldClear: true },
      ],
      getRoutineRoleEligibleMovementIds: () => ({
        major: [1],
        supplementary: [1, 2, 3],
        accessory: [],
        conditional: [],
      }),
      getRoutinePlanningContract: () => planningContract(mockState.movements),
      movementAvailabilityRevision: 0,
      activePriorExperienceMovementIds: [],
      confirmMovementPriorExperience: jest.fn(() => true),
      revokeMovementPriorExperience: jest.fn(() => true),
    };
  });

  test('shows only the four implemented methods and three safe default slots', () => {
    render(<RoutineTemplateBuilder />);
    expect(screen.getByText('Linear')).toBeOnTheScreen();
    expect(screen.getByText('Undulating')).toBeOnTheScreen();
    expect(screen.getByText('Step Loading')).toBeOnTheScreen();
    expect(screen.getByText('Autoregulated')).toBeOnTheScreen();
    expect(screen.queryByText(/Conjugate/i)).toBeNull();
    expect(screen.getByText('Day 1 Ordered Movements (3)')).toBeOnTheScreen();
  });

  test('filters by role before rendering and shows capability education in All / Learn', () => {
    render(<RoutineTemplateBuilder />);
    fireEvent.press(screen.getByLabelText('Select movement for day 1 slot 1'));
    expect(screen.getByText('Competition Squat')).toBeOnTheScreen();
    expect(screen.queryByText('Dumbbell Row')).not.toBeOnTheScreen();
    expect(screen.queryByText('Advanced Skill')).not.toBeOnTheScreen();
    fireEvent.press(screen.getByText('Competition Squat'));
    fireEvent.press(screen.getByLabelText('Select movement for day 1 slot 2'));
    fireEvent.press(screen.getByLabelText('All / Learn (3)'));
    expect(screen.getByText('Capability evidence is required.')).toBeOnTheScreen();
  });

  test('renders every seeded movement in a bounded picker list', () => {
    render(<RoutineTemplateBuilder />);
    fireEvent.press(screen.getByLabelText('Select movement for day 1 slot 1'));

    expect(StyleSheet.flatten(screen.getByTestId('movement-picker-card').props.style)).toMatchObject({
      height: '80%',
    });
    expect(screen.getByTestId('movement-picker-list')).toBeOnTheScreen();
    expect(screen.getByTestId('movement-picker-list').props.initialNumToRender).toBe(14);
    expect(screen.getByTestId('movement-picker-row-1')).toBeOnTheScreen();
    expect(screen.queryByTestId('movement-picker-row-2')).toBeNull();
    expect(screen.queryByTestId('movement-picker-row-3')).toBeNull();
  });

  test('search and live role-filtered counts stay independent', () => {
    render(<RoutineTemplateBuilder />);
    fireEvent.press(screen.getByLabelText('Select movement for day 1 slot 1'));
    fireEvent.press(screen.getByText('Competition Squat'));
    fireEvent.press(screen.getByLabelText('Select movement for day 1 slot 2'));
    expect(screen.getByLabelText('Available (1)')).toBeOnTheScreen();
    expect(screen.getByLabelText('All / Learn (3)')).toBeOnTheScreen();
    fireEvent.changeText(screen.getByLabelText('Search routine movements'), 'lats');
    expect(screen.getByLabelText('Available (1)')).toBeOnTheScreen();
    expect(screen.getByLabelText('All / Learn (1)')).toBeOnTheScreen();
    expect(screen.getByText('Dumbbell Row')).toBeOnTheScreen();
    expect(within(screen.getByTestId('movement-picker-list')).queryByText('Competition Squat')).toBeNull();
  });

  test('prior experience uses a second confirmation and revision-driven revoke state', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { rerender } = render(<RoutineTemplateBuilder />);
    fireEvent.press(screen.getByLabelText('Select movement for day 1 slot 1'));
    fireEvent.press(screen.getByText('Competition Squat'));
    fireEvent.press(screen.getByLabelText('Select movement for day 1 slot 2'));
    fireEvent.press(screen.getByLabelText('All / Learn (3)'));
    fireEvent.press(screen.getByLabelText('Confirm prior experience for Advanced Skill'));
    const confirmButtons = alert.mock.calls[0][2];
    expect(confirmButtons.map((button) => button.text)).toEqual(['Cancel', 'Confirm']);
    confirmButtons.find((button) => button.text === 'Confirm').onPress();
    expect(mockState.confirmMovementPriorExperience).toHaveBeenCalledWith(3, 'weight_room');

    mockState.activePriorExperienceMovementIds = [3];
    mockState.movementAvailabilityRevision += 1;
    mockState.getMovementAvailabilityVerdicts = () => [available(1), available(2), available(3)];
    rerender(<RoutineTemplateBuilder />);
    fireEvent.press(screen.getByLabelText('Revoke prior experience for Advanced Skill'));
    const revokeButtons = alert.mock.calls[1][2];
    revokeButtons.find((button) => button.text === 'Revoke').onPress();
    expect(mockState.revokeMovementPriorExperience).toHaveBeenCalledWith(3);
    alert.mockRestore();
  });

  test('Beginner sees the deliberate standalone-routine lock', () => {
    mockState.profile = { ...mockState.profile, training_age: 'beginner' };
    render(<RoutineTemplateBuilder />);
    expect(screen.getByTestId('routine-builder-beginner-lock')).toBeOnTheScreen();
    expect(screen.getByText('Standalone routines are locked')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Routine template name')).toBeNull();
  });

  test('shows an honest empty state instead of a blank picker', () => {
    mockState.movements = [];
    mockState.getMovementAvailabilityVerdicts = () => [];
    mockState.getRoutineRoleEligibleMovementIds = () => ({
      major: [],
      supplementary: [],
      accessory: [],
      conditional: [],
    });

    render(<RoutineTemplateBuilder />);
    fireEvent.press(screen.getByLabelText('Select movement for day 1 slot 1'));

    expect(screen.getByText('No currently available movements match this role and search.')).toBeOnTheScreen();
  });

  test('preserves athlete-authored ordering when saving', () => {
    const onSaved = jest.fn();
    render(<RoutineTemplateBuilder onSaved={onSaved} />);
    fireEvent.changeText(screen.getByLabelText('Routine template name'), 'Ordered day');

    fireEvent.press(screen.getByLabelText('Select movement for day 1 slot 1'));
    fireEvent.press(screen.getByText('Competition Squat'));
    fireEvent.changeText(screen.getByLabelText('Sets for slot 1'), '6');
    fireEvent.changeText(screen.getByLabelText('Reps for slot 1'), '4');
    fireEvent.changeText(screen.getByLabelText('Maximum RPE for slot 1'), '8.5');
    expect(screen.getByText(/6 sets x 4 reps @ RPE 6.0 start \/ 8.5 max/)).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Select movement for day 1 slot 2'));
    fireEvent.press(screen.getByText('Dumbbell Row'));
    fireEvent.press(screen.getByLabelText('Remove day 1 slot 3'));
    fireEvent.press(screen.getByLabelText('Move day 1 slot 1 down'));
    fireEvent.press(screen.getByLabelText('Save routine template'));

    expect(saveRoutineTemplate).toHaveBeenCalledTimes(1);
    expect(saveRoutineTemplate.mock.calls[0][0].slots.map((slot) => slot.movementId)).toEqual([2, 1]);
    expect(saveRoutineTemplate.mock.calls[0][0].slots.map((slot) => slot.slotIndex)).toEqual([1, 2]);
    expect(saveRoutineTemplate.mock.calls[0][0].slots[1]).toMatchObject({ sets: 6, reps: 4, targetRpe: 8.5 });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  test('projects separate start and max RPE columns for the major lift', () => {
    render(<RoutineTemplateBuilder />);
    fireEvent.press(screen.getByLabelText('Select movement for day 1 slot 1'));
    fireEvent.press(screen.getByText('Competition Squat'));

    expect(screen.getByLabelText('Projected starting RPE for day 1 slot 1: 5.5')).toBeOnTheScreen();
    expect(screen.getByLabelText('Maximum RPE for slot 1')).toHaveProp('value', '8');
    fireEvent.changeText(screen.getByLabelText('Maximum RPE for slot 1'), '8.5');
    expect(screen.getByLabelText('Projected starting RPE for day 1 slot 1: 6.0')).toBeOnTheScreen();
    expect(screen.getByTestId('major-rpe-projection-note-1').props.children.join('')).toContain(
      'Projected loading range: RPE 6.0 start to 8.5 max.',
    );
  });

  test('pins three available supplementary recommendations for the selected major', () => {
    mockState.movements = [
      { movement_id: 10, name: 'Deadlift', baseName: 'Deadlift', pattern: 'hinge', cues: 'Brace', targetMuscles: ['glutes', 'hamstrings'], difficulty: 'Intermediate', is_compound: true },
      { movement_id: 11, name: 'Barbell Hip Thrust', baseName: 'Hip Thrust', pattern: 'hinge', cues: 'Extend', targetMuscles: ['glutes'], difficulty: 'Intermediate', is_compound: true },
      { movement_id: 12, name: 'Bulgarian Split Squat', baseName: 'Split Squat', pattern: 'lunge', cues: 'Balance', targetMuscles: ['quadriceps', 'glutes'], difficulty: 'Intermediate', is_compound: true },
      { movement_id: 13, name: 'Back Extension', baseName: 'Back Extension', pattern: 'hinge', cues: 'Extend', targetMuscles: ['erectors', 'glutes'], difficulty: 'Intermediate', is_compound: true },
      { movement_id: 14, name: 'Romanian Deadlift', baseName: 'Romanian Deadlift', pattern: 'hinge', cues: 'Hinge', targetMuscles: ['hamstrings'], difficulty: 'Intermediate', is_compound: true },
    ];
    mockState.getRoutineRoleEligibleMovementIds = () => ({
      major: [10], supplementary: [11, 12, 13, 14], accessory: [], conditional: [],
    });
    // Hip thrust is deliberately unavailable: it must not be resurrected by
    // recommendation ranking, and the next compatible movement fills rank 3.
    mockState.getMovementAvailabilityVerdicts = () => [
      available(10), { ...available(11), state: 'teaching_only', reasons: ['equipment'] },
      available(12), available(13), available(14),
    ];

    render(<RoutineTemplateBuilder />);
    fireEvent.press(screen.getByLabelText('Select movement for day 1 slot 1'));
    fireEvent.press(screen.getByText('Deadlift'));
    fireEvent.press(screen.getByLabelText('Select movement for day 1 slot 2'));

    expect(screen.getByTestId('supplementary-recommendation-note')).toBeOnTheScreen();
    expect(screen.getByText('Top 3 for Deadlift')).toBeOnTheScreen();
    expect(screen.getByText('Ranked only from supplementary movements currently available to this athlete.')).toBeOnTheScreen();
    const rows = screen.getByTestId('movement-picker-list').props.data;
    expect(rows.slice(0, 3).map((row) => row.movement.name)).toEqual([
      'Bulgarian Split Squat', 'Back Extension', 'Romanian Deadlift',
    ]);
    expect(rows.slice(0, 3).map((row) => row.recommendation.rank)).toEqual([1, 2, 3]);
    expect(rows.some((row) => row.movement.name === 'Barbell Hip Thrust')).toBe(false);
  });

  test('normalizes stored RPE drift to the current cap and explains the edit', () => {
    mockState.profile = { ...mockState.profile, base_rpe_cap: 7.5 };
    const initialTemplate = {
      routineTemplateId: 20,
      name: 'Stored RPE drift',
      schemaType: 'LINEAR',
      createdAtMs: 1,
      updatedAtMs: 1,
      slots: [{
        routineTemplateSlotId: 1,
        routineTemplateId: 20,
        dayIndex: 1,
        slotIndex: 1,
        role: 'major',
        movementId: 1,
        movementName: 'Competition Squat',
        sets: 3,
        reps: 5,
        targetRpe: 9,
        legacyRoleAllowed: false,
      }],
    };

    render(<RoutineTemplateBuilder initialTemplate={initialTemplate} />);
    expect(screen.getByTestId('routine-rpe-normalization-notice')).toHaveTextContent(
      /1 stored routine RPE value exceeded the athlete's current cap/,
    );
    expect(screen.getByLabelText('Maximum RPE for slot 1')).toHaveProp('value', '7.5');
    fireEvent.press(screen.getByLabelText('Save routine template'));
    expect(saveRoutineTemplate).toHaveBeenCalledWith(expect.objectContaining({
      routineTemplateId: 20,
      slots: [expect.objectContaining({ targetRpe: 7.5 })],
    }));
  });

  test('rejects a newly entered RPE above the athlete cap before store mutation', () => {
    render(<RoutineTemplateBuilder />);
    fireEvent.changeText(screen.getByLabelText('Routine template name'), 'Above cap');
    fireEvent.press(screen.getByLabelText('Select movement for day 1 slot 1'));
    fireEvent.press(screen.getByText('Competition Squat'));
    fireEvent.changeText(screen.getByLabelText('Maximum RPE for slot 1'), '9.5');
    fireEvent.press(screen.getByLabelText('Save routine template'));

    expect(saveRoutineTemplate).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Competition Squat RPE must be between 5 and 9/).length).toBeGreaterThan(0);
  });

  test('shows and preserves an exact legacy role allowance through reordering', () => {
    const initialTemplate = {
      routineTemplateId: 21,
      name: 'Legacy support',
      schemaType: 'LINEAR',
      createdAtMs: 1,
      updatedAtMs: 1,
      slots: [
        {
          routineTemplateSlotId: 1, routineTemplateId: 21, dayIndex: 1, slotIndex: 1,
          role: 'major', movementId: 1, movementName: 'Competition Squat',
          sets: 3, reps: 5, targetRpe: 8, legacyRoleAllowed: false,
        },
        {
          routineTemplateSlotId: 2, routineTemplateId: 21, dayIndex: 1, slotIndex: 2,
          role: 'supplementary', movementId: 2, movementName: 'Dumbbell Row',
          sets: 2, reps: 10, targetRpe: 7, legacyRoleAllowed: true,
        },
      ],
    };

    render(<RoutineTemplateBuilder initialTemplate={initialTemplate} />);
    expect(screen.getByTestId('legacy-role-notice-2')).toHaveTextContent(
      /Preserved legacy supplementary selection/,
    );
    fireEvent.press(screen.getByLabelText('Move day 1 slot 2 up'));
    fireEvent.press(screen.getByLabelText('Save routine template'));

    const savedSlots = saveRoutineTemplate.mock.calls[0][0].slots;
    expect(savedSlots.map((slot) => slot.movementId)).toEqual([2, 1]);
    expect(savedSlots[0]).toMatchObject({
      dayIndex: 1,
      role: 'supplementary',
      preserveLegacyRoleAllowance: true,
    });
  });

  test('keeps major and supplementary selection uncapped while genuine role eligibility still fails closed', () => {
    render(<RoutineTemplateBuilder />);

    // Conditional has no eligible movements, so its genuine role gate remains closed.
    expect(screen.getByLabelText('+ Cond').props.accessibilityState?.disabled).toBe(true);

    // Movement counts do not disable major or supplementary slot creation.
    expect(screen.getByLabelText('+ Major').props.accessibilityState?.disabled).not.toBe(true);
    expect(screen.getByLabelText('+ Supp').props.accessibilityState?.disabled).not.toBe(true);
  });
});
