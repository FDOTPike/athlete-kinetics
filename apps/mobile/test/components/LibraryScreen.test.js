import React from 'react';
import { Linking, StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import LibraryScreen from '../../src/screens/LibraryScreen';
import { theme } from '../../src/theme/theme';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  localToday: () => '2026-06-01',
  formatTeachingOnlyReason: (reasons) => reasons.length === 0 ? 'Teaching only' : `Teaching only — ${reasons.map((r) => r === 'capability' ? 'build the movement below it first' : r).join('; ')}`,
  useStore: (selector) => selector(mockState),
}));

const sampleMovements = [
  {
    movement_id: 1,
    name: 'Goblet Squat',
    pattern: 'squat',
    is_compound: true,
    beginnerOk: true,
    loggingMode: 'reps',
    instructions: 'Keep chest up and squat down smoothly.',
    cues: 'Spread the floor with your feet.',
    videoUrl: 'https://example.com/video1',
    coachingIntent: 'Learn squat pattern',
    timePolicy: null,
    required: ['dumbbell'],
    baseName: 'Goblet Squat',
    supportedPrefixes: [],
    difficulty: 'Beginner',
    preference: 0,
    progressionGroup: 'squat-skill',
    progressionRank: 0,
  },
  {
    movement_id: 2,
    name: 'Barbell Back Squat',
    pattern: 'squat',
    is_compound: true,
    beginnerOk: false,
    loggingMode: 'reps',
    instructions: 'Bar on upper traps. Descend under control.',
    cues: 'Big air, drive through mid-foot.',
    videoUrl: 'https://example.com/video2',
    coachingIntent: 'Build heavy leg strength',
    timePolicy: null,
    required: ['barbell'],
    baseName: 'Back Squat',
    supportedPrefixes: [],
    difficulty: 'Intermediate',
    preference: 0,
    progressionGroup: 'squat-skill',
    progressionRank: 1,
  },
  {
    movement_id: 3,
    name: 'Dumbbell Bench Press',
    pattern: 'push_h',
    is_compound: true,
    beginnerOk: true,
    loggingMode: 'reps',
    instructions: 'Press dumbbells vertically over chest.',
    cues: 'Keep shoulder blades retracted.',
    videoUrl: '',
    coachingIntent: 'Build chest pressing strength',
    timePolicy: null,
    required: ['dumbbell'],
    baseName: 'Bench Press',
    supportedPrefixes: [],
    difficulty: 'Beginner',
    preference: 0,
    progressionGroup: null,
    progressionRank: null,
  },
];

describe('LibraryScreen', () => {
  beforeEach(() => {
    mockState = {
      movements: sampleMovements,
      profile: { equipmentInventory: ['barbell', 'dumbbell'] },
      getMovementAvailabilityVerdicts: () => [],
      resolveGoalRung: () => ({
        active: { movementName: 'Goblet Squat', progressionGroup: 'squat-skill', progressionRank: 0 },
        passed: [],
        next: { movementName: 'Barbell Back Squat', progressionGroup: 'squat-skill', progressionRank: 1 },
      }),
    };
  });

  test('renders header, search input, and pattern groups', () => {
    render(<LibraryScreen />);

    expect(screen.getByText('Movement Library')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Search 120+ movements...')).toBeOnTheScreen();
    expect(screen.getByText('Squat Pattern')).toBeOnTheScreen();
    expect(screen.getByText('Horizontal Press')).toBeOnTheScreen();
  });

  test('filters movements by search query', () => {
    render(<LibraryScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Search 120+ movements...'), 'Bench');

    expect(screen.getByText('Dumbbell Bench Press')).toBeOnTheScreen();
    expect(screen.queryByText('Goblet Squat')).not.toBeOnTheScreen();
  });

  test('filters movements by equipment chip', () => {
    render(<LibraryScreen />);

    fireEvent.press(screen.getByLabelText('Filter by Barbell'));

    expect(screen.getByText('Barbell Back Squat')).toBeOnTheScreen();
    expect(screen.queryByText('Dumbbell Bench Press')).not.toBeOnTheScreen();
  });

  test('narrows movements by tier and equipment filters', () => {
    render(<LibraryScreen />);

    fireEvent.press(screen.getByLabelText('Filter by Beginner'));
    expect(screen.getByText('Goblet Squat')).toBeOnTheScreen();
    expect(screen.getByText('Dumbbell Bench Press')).toBeOnTheScreen();
    expect(screen.queryByText('Barbell Back Squat')).not.toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('Filter by Dumbbell'));
    expect(screen.getByText('Goblet Squat')).toBeOnTheScreen();
    expect(screen.getByText('Dumbbell Bench Press')).toBeOnTheScreen();
    expect(screen.queryByText('Barbell Back Squat')).not.toBeOnTheScreen();
  });

  test('opens movement detail card and displays cues, instructions, and progression ladder', () => {
    render(<LibraryScreen />);

    fireEvent.press(screen.getByLabelText('View Barbell Back Squat'));

    expect(screen.getAllByText('Barbell Back Squat').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Big air, drive through mid-foot.')).toBeOnTheScreen();
    expect(screen.getByText('Bar on upper traps. Descend under control.')).toBeOnTheScreen();
    expect(screen.getByText('Progression Ladder')).toBeOnTheScreen();
    expect(screen.getByText('Rung 1 of 2')).toBeOnTheScreen();
    expect(screen.getByText('Rung 2 of 2')).toBeOnTheScreen();
    expect(screen.getByLabelText('Select Goblet Squat from progression ladder').props.accessibilityState).toEqual({ selected: true });

    // Back to list
    fireEvent.press(screen.getByLabelText('Back to movement list'));
    expect(screen.getByText('Movement Library')).toBeOnTheScreen();
  });

  test('highlights the active rung with chalk spine in progression ladder', () => {
    render(<LibraryScreen initialMovementId={2} />);

    expect(screen.getByText('Progression Ladder')).toBeOnTheScreen();
    const activeRung = screen.getByLabelText('Select Goblet Squat from progression ladder');
    const inactiveRung = screen.getByLabelText('Select Barbell Back Squat from progression ladder');

    expect(activeRung.props.accessibilityState.selected).toBe(true);
    expect(inactiveRung.props.accessibilityState.selected).toBe(false);
    expect(StyleSheet.flatten(activeRung.props.style)).toMatchObject({
      borderLeftColor: theme.color.chalk,
      borderLeftWidth: 4,
    });
    expect(StyleSheet.flatten(inactiveRung.props.style)).not.toMatchObject({
      borderLeftColor: theme.color.chalk,
      borderLeftWidth: 4,
    });

    fireEvent.press(inactiveRung);
    expect(screen.getAllByText('Barbell Back Squat').length).toBeGreaterThanOrEqual(1);
  });

  test('triggers video link-out through Linking.openURL when watch video button is pressed', () => {
    const openUrlSpy = jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve());
    render(<LibraryScreen initialMovementId={1} />);

    const videoBtn = screen.getByLabelText('Watch movement demonstration video');
    expect(videoBtn).toBeOnTheScreen();
    fireEvent.press(videoBtn);

    expect(openUrlSpy).toHaveBeenCalledWith('https://example.com/video1');
    openUrlSpy.mockRestore();
  });

  test('hides the ladder for a movement with no authored chain', () => {
    render(<LibraryScreen />);

    fireEvent.press(screen.getByLabelText('View Dumbbell Bench Press'));

    expect(screen.queryByText('Progression Ladder')).not.toBeOnTheScreen();
  });

  test('surfaces teaching-only human reason for capability-restricted movement', () => {
    mockState.getMovementAvailabilityVerdicts = () => [
      { movementId: 2, state: 'teaching_only', reasons: ['capability'] },
    ];
    render(<LibraryScreen initialMovementId={2} />);
    expect(screen.getByText('Teaching only — build the movement below it first')).toBeOnTheScreen();
  });

  test('renders empty state when search returns no matching movements and clears search on press', () => {
    render(<LibraryScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Search 120+ movements...'), 'NonExistentMovement123');

    expect(screen.getByText('No matching movements')).toBeOnTheScreen();
    expect(screen.getByText('Try clearing your search query or choosing a different equipment filter.')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('Clear search and filters'));

    expect(screen.getByText('Squat Pattern')).toBeOnTheScreen();
    expect(screen.getByText('Goblet Squat')).toBeOnTheScreen();
  });
});
