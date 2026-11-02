// Android walk 2026-11-03 (ux-5): onboarding option chips cut their own
// sentences short at the default font size ("…No extra emphasis. Train ev…",
// "…a number and a date…"), because every Chip was limited to one line.
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Chip } from '../../src/components/ui/Chip';

const labelOf = (testID) => screen.getByTestId(testID).findByType(Text);

test('a Chip stays on one line by default', () => {
  render(<Chip testID="c" label="SHORT" selected={false} onPress={() => {}} />);
  expect(labelOf('c').props.numberOfLines).toBe(1);
});

test('a Chip asked to wrap shows its whole label, centred', () => {
  render(<Chip testID="c" wrap label="BALANCED WHOLE BODY — No extra emphasis. Train everything evenly." selected={false} onPress={() => {}} />);
  const label = labelOf('c');
  expect(label.props.numberOfLines).toBeUndefined();
  expect(label.props.children).toBe('BALANCED WHOLE BODY — No extra emphasis. Train everything evenly.');
  expect(StyleSheet.flatten(label.props.style).textAlign).toBe('center');
});
