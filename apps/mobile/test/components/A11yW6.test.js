// Android walk 2026-11-03, W6 (accessibility).
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import InfoTip from '../../src/components/InfoTip';

// W6-5: the "i" card's full-screen backdrop was a focusable, unlabelled stop.
test('the info card backdrop is not focusable and not exposed to accessibility', () => {
  render(<InfoTip term="RPE" />);
  fireEvent.press(screen.getByLabelText('What does RPE mean?'));
  const backdrop = screen.getByTestId('info-tip-backdrop');
  expect(backdrop.props.focusable).toBe(false);
  expect(backdrop.props.accessible).toBe(false);
  expect(backdrop.props.importantForAccessibility).toBe('no');
});
