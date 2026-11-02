// Android walk 2026-11-03 (a11y-3, a11y-4): chips measured 44-53 dp wide,
// below the app's own minimum (theme.touch.min, 56). Height was already 56.
import React from 'react';
import fs from 'fs';
import path from 'path';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Chip } from '../../src/components/ui/Chip';
import { theme } from '../../src/theme/theme';

const src = (rel) => fs.readFileSync(path.resolve(__dirname, '../../src', rel), 'utf8');
const styleBlock = (source, name) => {
  const match = source.match(new RegExp(`\\n  ${name}: \\{([^}]*)\\}`));
  if (!match) throw new Error(`style ${name} not found`);
  return match[1];
};

describe('tap targets meet theme.touch.min in both directions', () => {
  test('every Chip is at least 56 wide, so one-character chips (1-6, 0-4+, bjj, hip) are too', () => {
    render(<Chip label="1" selected={false} onPress={() => {}} accessibilityLabel="one" />);
    const style = StyleSheet.flatten(screen.getByLabelText('one').props.style);
    expect(style.minWidth).toBeGreaterThanOrEqual(theme.touch.min);
    expect(style.minHeight).toBeGreaterThanOrEqual(theme.touch.min);
  });

  test('the session chips no longer lower the Chip minimum to 48', () => {
    expect(styleBlock(src('screens/SessionScreen.tsx'), 'rirChip')).not.toMatch(/minWidth:\s*48/);
  });

  test('the "Something feels off" severity chips are 56 wide, not a fixed 44', () => {
    const block = styleBlock(src('screens/BlockScreen.tsx'), 'severityChip');
    expect(block).not.toMatch(/\bwidth:\s*44/);
    expect(block).toMatch(/minWidth:\s*theme\.touch\.min/);
  });
});
