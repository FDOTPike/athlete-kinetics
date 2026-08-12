import React from 'react';
import { Linking, StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import LibraryScreen from '../../src/screens/LibraryScreen';
import { theme } from '../../src/theme/theme';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  localToday: () => '2026-06-01',
  formatTeachingOnlyReason: (verdict) => verdict === undefined
    ? 'Access cannot be verified right now.'
    : verdict.reasons.length === 0
      ? 'Teaching only'
      : `Teaching only — ${verdict.reasons.map((reason) => reason === 'capability' ? 'build the movement below it first' : reason).join('; ')}`,
  useStore: (selector) => selector(mockState),
}));

const sampleMovements = [
  {
    movement_id: 1,
    name: 'Goblet Squat',
    pattern: 'squat',
    is_compound: true,
    beginnerOk: false,
    loggingMode: 'reps',
    instructions: 'Hold the bell at chest height. Squat under control.',
    cues: 'Spread the floor with your feet.',
    media: {
      assetKey: 'movement/goblet-squat/demo/v1',
      status: 'external_fallback',
      revision: 1,
      fallbackUrl: 'https://example.com/video1',
    },
    targetMuscles: ['quadriceps', 'glutes'],
    coachingIntent: 'Learn the squat pattern.',
    timePolicy: null,
    required: ['dumbbells'],
    baseName: 'Goblet Squat',
    supportedPrefixes: ['DB'],
    difficulty: 'Beginner',
    preference: 0,
    progressionGroup: 'squat-skill',
    progressionRank: 0,
    sportTracking: false,
  },
  {
    movement_id: 2,
    name: 'Barbell Back Squat',
    pattern: 'squat',
    is_compound: true,
    beginnerOk: false,
    loggingMode: 'reps',
    instructions: 'Set the bar on the upper back. Descend under control.',
    cues: 'Brace, then drive through mid-foot.',
    media: {
      assetKey: 'movement/barbell-back-squat/demo/v1',
      status: 'external_fallback',
      revision: 1,
      fallbackUrl: 'https://example.com/video2',
    },
    targetMuscles: ['quadriceps', 'spinal_erectors'],
    coachingIntent: 'Build squat strength.',
    timePolicy: null,
    required: ['barbell', 'squat_rack'],
    baseName: 'Back Squat',
    supportedPrefixes: ['BB'],
    difficulty: 'Advanced',
    preference: 0,
    progressionGroup: 'squat-skill',
    progressionRank: 1,
    sportTracking: false,
  },
  {
    movement_id: 3,
    name: 'Dumbbell Bench Press',
    pattern: 'push_h',
    is_compound: true,
    beginnerOk: true,
    loggingMode: 'reps',
    instructions: 'Set the shoulders on the bench. Press over the chest.',
    cues: 'Keep the chest open.',
    media: {
      assetKey: 'movement/dumbbell-bench-press/demo/v1',
      status: 'planned',
      revision: 1,
      fallbackUrl: null,
    },
    targetMuscles: ['pectorals', 'triceps'],
    coachingIntent: 'Build horizontal pressing strength.',
    timePolicy: null,
    required: ['dumbbells', 'bench'],
    baseName: 'Bench Press',
    supportedPrefixes: ['DB'],
    difficulty: 'Intermediate',
    preference: 0,
    progressionGroup: null,
    progressionRank: null,
    sportTracking: false,
  },
];

const availableVerdicts = sampleMovements.map((movement) => ({
  movementId: movement.movement_id,
  state: 'available',
  reasons: [],
  effectiveContext: 'weight_room', capabilitySource: 'not_required',
  blockingPrerequisiteMovementIds: [], confirmationWouldClear: false,
  separateAttestationRequired: false,
}));

describe('LibraryScreen Phase 2a', () => {
  beforeEach(() => {
    mockState = {
      movements: sampleMovements,
      profile: { training_age: 'intermediate', equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench'] },
      getMovementAvailabilityVerdicts: () => availableVerdicts,
      movementAvailabilityRevision: 0,
      resolveGoalRung: () => ({
        active: { movementName: 'Goblet Squat', progressionGroup: 'squat-skill', progressionRank: 0 },
        passed: [],
        next: { movementName: 'Barbell Back Squat', progressionGroup: 'squat-skill', progressionRank: 1 },
      }),
    };
  });

  test('uses a virtualized SectionList and derives live totals', () => {
    render(<LibraryScreen />);
    const list = screen.getByTestId('library-list');
    expect(list.props.initialNumToRender).toBe(18);
    expect(screen.getByPlaceholderText('Search 3 movements...')).toBeOnTheScreen();
    expect(screen.getByText('3 of 3 movements')).toBeOnTheScreen();
  });

  test('searches target muscles as well as movement copy', () => {
    render(<LibraryScreen />);
    fireEvent.changeText(screen.getByLabelText('Search movements'), 'pectorals');
    expect(screen.getByText('Dumbbell Bench Press')).toBeOnTheScreen();
    expect(screen.queryByText('Goblet Squat')).not.toBeOnTheScreen();
  });

  test('uses canonical plural dumbbells equipment token', () => {
    render(<LibraryScreen />);
    fireEvent.press(screen.getByLabelText('Filter equipment by Dumbbells'));
    expect(screen.getByText('Goblet Squat')).toBeOnTheScreen();
    expect(screen.getByText('Dumbbell Bench Press')).toBeOnTheScreen();
    expect(screen.queryByText('Barbell Back Squat')).not.toBeOnTheScreen();
  });

  test('combines difficulty and equipment facets conjunctively', () => {
    render(<LibraryScreen />);
    fireEvent.press(screen.getByLabelText('Filter tier by Intermediate'));
    fireEvent.press(screen.getByLabelText('Filter equipment by Dumbbells'));
    expect(screen.getByText('Dumbbell Bench Press')).toBeOnTheScreen();
    expect(screen.queryByText('Goblet Squat')).not.toBeOnTheScreen();
    expect(screen.queryByText('Barbell Back Squat')).not.toBeOnTheScreen();
  });

  test('beginner defaults to Available and All / Learn reveals tier-restricted rows with a reason', () => {
    mockState.profile.training_age = 'beginner';
    mockState.getMovementAvailabilityVerdicts = () => [
      availableVerdicts[0],
      { ...availableVerdicts[1], state: 'teaching_only', reasons: ['tier'] },
      availableVerdicts[2],
    ];
    render(<LibraryScreen />);
    expect(screen.getByLabelText('Show available movements').props.accessibilityState.selected).toBe(true);
    expect(screen.queryByText('Barbell Back Squat')).not.toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Show all movements for learning'));
    expect(screen.getByText('Barbell Back Squat')).toBeOnTheScreen();
    expect(screen.getByText('Teaching only — tier')).toBeOnTheScreen();
  });

  test('renders actual difficulty labels instead of whitelist-derived labels', () => {
    render(<LibraryScreen />);
    expect(screen.getByText('Back Squat · Advanced')).toBeOnTheScreen();
    expect(screen.getByText('Bench Press · Intermediate')).toBeOnTheScreen();
  });

  test('a missing resolver verdict fails closed in list and detail views', () => {
    mockState.getMovementAvailabilityVerdicts = () => availableVerdicts.slice(0, 2);
    render(<LibraryScreen initialMovementId={3} />);
    expect(screen.getByText('Access cannot be verified right now.')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Back to movement list'));
    expect(screen.getByText('Access cannot be verified right now.')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Show available movements'));
    expect(screen.queryByText('Dumbbell Bench Press')).not.toBeOnTheScreen();
  });

  test('opens external fallback media through the OS handler', () => {
    const openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue();
    render(<LibraryScreen initialMovementId={1} />);
    fireEvent.press(screen.getByLabelText('Watch movement demonstration video'));
    expect(openUrlSpy).toHaveBeenCalledWith('https://example.com/video1');
    openUrlSpy.mockRestore();
  });

  test('planned media is honest and has no active watch action', () => {
    render(<LibraryScreen initialMovementId={3} />);
    expect(screen.getByText('Demonstration planned')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Watch movement demonstration video')).not.toBeOnTheScreen();
  });

  test('detail view retains target muscles, coaching, back navigation, and progression ladder', () => {
    render(<LibraryScreen initialMovementId={2} />);
    expect(screen.getByText('Targets: quadriceps, spinal erectors')).toBeOnTheScreen();
    expect(screen.getByText('Brace, then drive through mid-foot.')).toBeOnTheScreen();
    expect(screen.getByText('Rung 1 of 2')).toBeOnTheScreen();
    const activeRung = screen.getByLabelText('Select Goblet Squat from progression ladder');
    expect(StyleSheet.flatten(activeRung.props.style)).toMatchObject({
      borderLeftColor: theme.color.chalk,
      borderLeftWidth: 4,
    });
    fireEvent.press(screen.getByLabelText('Back to movement list'));
    expect(screen.getByText('Movement Library')).toBeOnTheScreen();
  });

  test('empty-state clear resets every facet', () => {
    render(<LibraryScreen />);
    fireEvent.changeText(screen.getByLabelText('Search movements'), 'not-a-movement');
    expect(screen.getByText('No matching movements')).toBeOnTheScreen();
    fireEvent.press(screen.getAllByLabelText('Clear search and filters')[0]);
    expect(screen.getByText('3 of 3 movements')).toBeOnTheScreen();
  });
});
