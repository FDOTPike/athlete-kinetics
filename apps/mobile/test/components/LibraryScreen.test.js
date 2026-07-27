import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import LibraryScreen from '../../src/screens/LibraryScreen';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
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
  test('hides the ladder for a movement with no authored chain', () => {
    render(<LibraryScreen />);

    fireEvent.press(screen.getByLabelText('View Dumbbell Bench Press'));

    expect(screen.queryByText('Progression Ladder')).not.toBeOnTheScreen();
  });

});
