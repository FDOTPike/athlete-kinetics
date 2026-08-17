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

  test('movement picker renders three implement tiers, exact caption, tier-specific difficulty ordering, usable-over-locked hierarchy, and major slot demotions', () => {
    const tierMovements = [
      // Tier 1 (barbell)
      { movement_id: 101, name: 'Barbell Back Squat', baseName: 'Squat', pattern: 'squat', cues: 'Brace', targetMuscles: ['quadriceps'], difficulty: 'Intermediate', implement: 'barbell' },
      { movement_id: 102, name: 'Barbell Overhead Squat', baseName: 'Squat', pattern: 'squat', cues: 'Overhead', targetMuscles: ['quadriceps'], difficulty: 'Advanced', implement: 'barbell' },
      { movement_id: 103, name: 'Barbell Box Squat', baseName: 'Squat', pattern: 'squat', cues: 'Box', targetMuscles: ['quadriceps'], difficulty: 'Beginner', implement: 'barbell' },
      { movement_id: 104, name: 'Locked Barbell Snatch', baseName: 'Snatch', pattern: 'squat', cues: 'Snatch', targetMuscles: ['full_body'], difficulty: 'Advanced', implement: 'barbell' },

      // Tier 2 (dumbbell, kettlebell, bodyweight, band)
      { movement_id: 201, name: 'Dumbbell Bench Press', baseName: 'Bench Press', pattern: 'push_h', cues: 'Press', targetMuscles: ['chest'], difficulty: 'Intermediate', implement: 'dumbbell' },
      { movement_id: 202, name: 'Goblet Squat', baseName: 'Squat', pattern: 'squat', cues: 'Hold KB', targetMuscles: ['quadriceps'], difficulty: 'Beginner', implement: 'kettlebell' },
      { movement_id: 203, name: 'Single-Leg RDL', baseName: 'Deadlift', pattern: 'hinge', cues: 'Balance', targetMuscles: ['hamstrings'], difficulty: 'Advanced', implement: 'dumbbell' },
      { movement_id: 204, name: 'Locked DB Clean', baseName: 'Clean', pattern: 'hinge', cues: 'Clean', targetMuscles: ['full_body'], difficulty: 'Beginner', implement: 'dumbbell' },

      // Tier 3 (cable, machine, other)
      { movement_id: 301, name: 'Cable Lat Pulldown', baseName: 'Pulldown', pattern: 'pull_v', cues: 'Pull', targetMuscles: ['lats'], difficulty: 'Beginner', implement: 'cable' },
      { movement_id: 302, name: 'Cable Fly', baseName: 'Fly', pattern: 'push_h', cues: 'Squeeze', targetMuscles: ['chest'], difficulty: 'Intermediate', implement: 'cable' },

      // Demoted patterns (isolation, rotation, carry)
      { movement_id: 401, name: 'Dumbbell Bicep Curl', baseName: 'Curl', pattern: 'isolation', cues: 'Curl', targetMuscles: ['biceps'], difficulty: 'Beginner', implement: 'dumbbell' },
      { movement_id: 402, name: 'Cable Woodchopper', baseName: 'Chop', pattern: 'rotation', cues: 'Rotate', targetMuscles: ['core'], difficulty: 'Intermediate', implement: 'cable' },
      { movement_id: 403, name: 'Farmer Carry', baseName: 'Carry', pattern: 'carry', cues: 'Walk', targetMuscles: ['traps', 'grip'], difficulty: 'Intermediate', implement: 'dumbbell' },
    ];

    mockState.movements = tierMovements;
    mockState.getMovementAvailabilityVerdicts = () => [
      available(101),
      available(102),
      available(103),
      { ...available(104), state: 'teaching_only', reasons: ['capability'] },
      available(201),
      available(202),
      available(203),
      { ...available(204), state: 'teaching_only', reasons: ['capability'] },
      available(301),
      available(302),
      available(401),
      available(402),
      available(403),
    ];
    mockState.getRoutineRoleEligibleMovementIds = () => ({
      major: tierMovements.map((m) => m.movement_id),
      supplementary: tierMovements.map((m) => m.movement_id),
      accessory: [],
      conditional: [],
    });
    mockState.getRoutinePlanningContract = () => planningContract(tierMovements);

    render(<RoutineTemplateBuilder />);

    // 1. Open picker for Day 1 Slot 1 (role: 'major')
    fireEvent.press(screen.getByLabelText('Select movement for day 1 slot 1'));

    // Verify all three tier headers render with their counts
    expect(screen.getByTestId('picker-tier-1-header')).toHaveTextContent(/MAIN LIFTS \(3\)/);
    expect(screen.getByTestId('picker-tier-2-header')).toHaveTextContent(/DUMBBELL, KETTLEBELL & BODYWEIGHT \(3\)/);
    expect(screen.getByTestId('picker-tier-3-header')).toHaveTextContent(/CABLE & ASSISTED \(2\)/);


    // Verify Tier 3 caption is present
    expect(screen.getByText(
      'Assisted and cable variations to maintain training stimulus when injury or equipment restricts free weight movement.',
    )).toBeOnTheScreen();

    // 2. Verify major slot demotions (isolation, rotation, carry are excluded)
    expect(screen.queryByText('Dumbbell Bicep Curl')).toBeNull();
    expect(screen.queryByText('Cable Woodchopper')).toBeNull();
    expect(screen.queryByText('Farmer Carry')).toBeNull();

    const majorRows = screen.getByTestId('movement-picker-list').props.data;
    expect(majorRows.some((r) => ['isolation', 'rotation', 'carry'].includes(r.movement.pattern))).toBe(false);

    // 3. Verify Tier 1 rendered order: barbell, difficulty DESC (Advanced > Intermediate > Beginner), name ASC
    const t1Rendered = majorRows.filter((r) => r.tier === 1).map((r) => r.movement.name);
    expect(t1Rendered).toEqual(['Barbell Overhead Squat', 'Barbell Back Squat', 'Barbell Box Squat']);

    // 4. Verify Tier 2 rendered order: dumbbell/kettlebell/etc., difficulty ASC (Beginner > Intermediate > Advanced), name ASC
    const t2Rendered = majorRows.filter((r) => r.tier === 2).map((r) => r.movement.name);
    expect(t2Rendered).toEqual(['Goblet Squat', 'Dumbbell Bench Press', 'Single-Leg RDL']);

    // 5. Verify Tier 3 rendered order: cable/machine/other, difficulty ASC (Beginner > Intermediate > Advanced), name ASC
    const t3Rendered = majorRows.filter((r) => r.tier === 3).map((r) => r.movement.name);
    expect(t3Rendered).toEqual(['Cable Lat Pulldown', 'Cable Fly']);

    // 6. Switch to 'All / Learn' view and verify locked movements sort BELOW all usable ones within every tier
    fireEvent.press(screen.getByText(/All \/ Learn/));
    const allRows = screen.getByTestId('movement-picker-list').props.data;

    // In Tier 1: Box Squat (Beginner, usable) must sort ABOVE Locked Snatch (Advanced, locked)
    const t1All = allRows.filter((r) => r.tier === 1).map((r) => r.movement.name);
    expect(t1All).toEqual(['Barbell Overhead Squat', 'Barbell Back Squat', 'Barbell Box Squat', 'Locked Barbell Snatch']);

    // In Tier 2: Single-Leg RDL (Advanced, usable) must sort ABOVE Locked Clean (Beginner, locked)
    const t2All = allRows.filter((r) => r.tier === 2).map((r) => r.movement.name);
    expect(t2All).toEqual(['Goblet Squat', 'Dumbbell Bench Press', 'Single-Leg RDL', 'Locked DB Clean']);

    // 7. Select a major for slot 1 so that contextual supplementary roles are active
    fireEvent.press(screen.getByText('Barbell Back Squat'));

    // 8. Open picker for Day 1 Slot 2 (role: 'supplementary')
    fireEvent.press(screen.getByLabelText('Select movement for day 1 slot 2'));

    // Verify supplementary slot STILL renders isolation, rotation, and carry
    expect(screen.getByText('Dumbbell Bicep Curl')).toBeOnTheScreen();
    expect(screen.getByText('Cable Woodchopper')).toBeOnTheScreen();
    expect(screen.getByText('Farmer Carry')).toBeOnTheScreen();

    const suppRows = screen.getByTestId('movement-picker-list').props.data;
    expect(suppRows.some((r) => r.movement.name === 'Dumbbell Bicep Curl')).toBe(true);
    expect(suppRows.some((r) => r.movement.name === 'Cable Woodchopper')).toBe(true);
    expect(suppRows.some((r) => r.movement.name === 'Farmer Carry')).toBe(true);
  });
});
