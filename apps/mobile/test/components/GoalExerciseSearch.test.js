// Android walk 2026-11-03 (ux-5): the target screen's own example, "back
// squat", found nothing, because the library calls it "Competition Squat"
// (base name "Back Squat"), and a broad search silently stopped at six.
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { GoalExerciseField } from '../../src/components/FocusGoalFields';

const squats = [
  { movement_id: 1, name: 'Competition Squat', baseName: 'Back Squat' },
  { movement_id: 2, name: 'Front Squat', baseName: 'Front Squat' },
  { movement_id: 3, name: 'Goblet Squat', baseName: 'Goblet Squat' },
  { movement_id: 4, name: 'Box Squat', baseName: 'Box Squat' },
  { movement_id: 5, name: 'Bodyweight Squat', baseName: 'Bodyweight Squat' },
  { movement_id: 6, name: 'Bulgarian Split Squat', baseName: 'Split Squat' },
  { movement_id: 7, name: 'Dumbbell Squat', baseName: 'Dumbbell Squat' },
  { movement_id: 8, name: 'Kneeling Squat', baseName: 'Kneeling Squat' },
];
const search = (text) => fireEvent.changeText(screen.getByTestId('goal-exercise-search'), text);

test('the base name is searched too, so "back squat" finds Competition Squat', () => {
  render(<GoalExerciseField movements={squats} movementId={null} onChange={() => {}} />);
  search('back squat');
  expect(screen.getByTestId('goal-exercise-option-1')).toBeOnTheScreen();
  expect(screen.queryByTestId('goal-exercise-none')).toBeNull();
});

test('a search with more than six matches says so', () => {
  render(<GoalExerciseField movements={squats} movementId={null} onChange={() => {}} />);
  search('squat');
  expect(screen.getAllByTestId(/^goal-exercise-option-/)).toHaveLength(6);
  expect(screen.getByTestId('goal-exercise-more').props.children)
    .toBe('Showing 6 of 8. Type more of the name to narrow the list.');
});

test('six or fewer matches show no "more" line', () => {
  render(<GoalExerciseField movements={squats} movementId={null} onChange={() => {}} />);
  search('goblet');
  expect(screen.queryByTestId('goal-exercise-more')).toBeNull();
});

test('options without a base name are still searched by name', () => {
  render(<GoalExerciseField movements={[{ movement_id: 9, name: 'Push-up' }]} movementId={null} onChange={() => {}} />);
  search('push');
  expect(screen.getByTestId('goal-exercise-option-9')).toBeOnTheScreen();
});

// Android walk 2026-11-03 (W1-7): "pull up" and "pullups" found nothing,
// "pull" listed the plain Pull-Up below five others, and RDL / OHP found nothing.
describe('the goal search forgives spacing, plurals and short forms', () => {
  const { goalExerciseMatches } = require('../../src/components/FocusGoalFields');
  const pulls = [
    { movement_id: 21, name: 'Weighted Pull-Up' },
    { movement_id: 22, name: 'Chin-Up' },
    { movement_id: 23, name: 'Lat Pulldown' },
    { movement_id: 24, name: 'Band Pull-Apart' },
    { movement_id: 25, name: 'Cable Pull-Through' },
    { movement_id: 26, name: 'Face Pull' },
    { movement_id: 27, name: 'Pull-Up' },
    { movement_id: 28, name: 'V-Bar Pullup' },
    { movement_id: 29, name: 'Romanian Deadlift' },
    { movement_id: 30, name: 'Overhead Press' },
    { movement_id: 31, name: 'Scapular Pull-Up' },
  ];
  const ids = (query) => goalExerciseMatches(pulls, query).map((m) => m.movement_id);

  test.each(['pull up', 'pullup', 'Pull-Up', 'pullups', 'PULL UPS'])('"%s" finds every pull-up, the plain one first', (query) => {
    expect(ids(query)).toEqual([27, 28, 21, 31]);
  });

  test('"pull" puts the plain Pull-Up in the first six', () => {
    expect(ids('pull').slice(0, 6)).toContain(27);
    expect(ids('pull')[0]).toBe(27);
  });

  test.each([['RDL', 29], ['rdls', 29], ['ohp', 30]])('the short form "%s" finds its exercise', (query, id) => {
    expect(ids(query)).toContain(id);
  });

  test('one letter, spaces and punctuation alone find nothing', () => {
    expect(ids('p')).toEqual([]);
    expect(ids('  ')).toEqual([]);
    expect(ids('--')).toEqual([]);
  });

  test('on screen, "pull up" lists Pull-Up and no "nothing found" line', () => {
    render(<GoalExerciseField movements={pulls} movementId={null} onChange={() => {}} />);
    search('pull up');
    expect(screen.getByTestId('goal-exercise-option-27')).toBeOnTheScreen();
    expect(screen.queryByTestId('goal-exercise-none')).toBeNull();
  });
});
