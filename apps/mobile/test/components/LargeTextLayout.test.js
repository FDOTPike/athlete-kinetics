// Android walk 2026-11-03 (issue 158, font scale 2.0 set before launch).
// The rendered checks for the workout buttons, the timeline name and gap, the
// outcome footer and the athlete row sit next to their screens' own tests:
// SessionScreen.test.js ("large text at font scale 2.0"), SessionFeel.test.js
// and LargeTextChrome.test.js.
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Chip } from '../../src/components/ui/Chip';
import { theme } from '../../src/theme/theme';

describe('wrapped chips keep their vertical padding at large text', () => {
  test('a wrapped chip label has at least theme.space[2] of padding above and below', () => {
    render(<Chip label="I PLAY OR COMPETE IN A SPORT" selected={false} onPress={() => {}} wrap />);
    const style = StyleSheet.flatten(screen.getByRole('button').props.style);
    expect(style.paddingVertical).toBeGreaterThanOrEqual(theme.space[2]);
  });
});
