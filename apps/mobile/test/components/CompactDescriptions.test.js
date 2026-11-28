import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { EMPTY_SPORT_FIELDS, SportEditor } from '../../src/components/SportFields';
import { theme } from '../../src/theme/theme';

let mockDescriptionMode = 'compact';
jest.mock('../../src/state/useStore', () => ({
  useStore: (select) => select({ uiPreferences: { descriptionMode: mockDescriptionMode } }),
}));

const fields = {
  ...EMPTY_SPORT_FIELDS,
  family: 'court',
  sportId: 'basketball',
  outcomeId: 'jump_higher',
};
const editor = (onChange) => <SportEditor fields={fields} onChange={onChange} today="2026-11-23" />;
const descriptionButton = () => screen.getByRole('button', { name: /details for research basis/i });

// The chevron rotation is a 160 ms Animated.timing driven by jest's frame
// timers. Fake timers, drained inside act() after each test, let it finish
// within React's test boundary instead of firing later outside act.
beforeEach(() => {
  mockDescriptionMode = 'compact';
  jest.useFakeTimers();
});
afterEach(() => {
  act(() => { jest.runAllTimers(); });
  jest.useRealTimers();
});

test('compact mode hides citations while the plan and evidence limits stay visible', () => {
  render(editor(jest.fn()));
  expect(screen.getByTestId('sport-emphasis-summary')).toBeOnTheScreen();
  expect(screen.getAllByTestId('sport-emphasis-limit').length).toBeGreaterThan(0);
  expect(screen.queryByTestId('sport-emphasis-basis')).toBeNull();
});

test('the independent chevron gives citations a 56 dp toggle without changing the selection', () => {
  const change = jest.fn();
  render(editor(change));
  const target = StyleSheet.flatten(descriptionButton().props.style);
  expect(target.minWidth).toBeGreaterThanOrEqual(56);
  expect(target.minHeight).toBeGreaterThanOrEqual(56);
  expect(target).toEqual(expect.objectContaining({
    minWidth: theme.touch.min,
    minHeight: theme.touch.min,
  }));
  expect(descriptionButton().props.accessibilityState.expanded).toBe(false);
  fireEvent.press(descriptionButton());
  expect(descriptionButton().props.accessibilityState.expanded).toBe(true);
  expect(screen.getByTestId('sport-emphasis-basis')).toHaveTextContent(/Suchomel.*Markovic/);
  fireEvent.press(descriptionButton());
  expect(descriptionButton().props.accessibilityState.expanded).toBe(false);
  expect(screen.queryByTestId('sport-emphasis-basis')).toBeNull();
  expect(change).not.toHaveBeenCalled();
});

test('Show all reveals descriptions and Compact collapses them when the preference changes', () => {
  const change = jest.fn();
  const view = render(editor(change));
  mockDescriptionMode = 'expanded';
  view.rerender(editor(change));
  expect(descriptionButton().props.accessibilityState.expanded).toBe(true);
  expect(screen.getByTestId('sport-emphasis-basis')).toBeOnTheScreen();
  mockDescriptionMode = 'compact';
  view.rerender(editor(change));
  expect(screen.queryByTestId('sport-emphasis-basis')).toBeNull();
});
