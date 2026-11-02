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
// The effective width floor a style block sets: the smallest of its minWidth
// and any fixed width. Only a number or theme.touch.min can be resolved;
// anything else fails loudly rather than passing by accident.
const resolveWidth = (expr) => {
  if (/^\d+(\.\d+)?$/.test(expr)) return Number(expr);
  if (expr === 'theme.touch.min') return theme.touch.min;
  throw new Error(`cannot resolve width expression ${expr}`);
};
const widthFloor = (block) => {
  const values = [...block.matchAll(/\b(minWidth|width):\s*([\w.]+)/g)].map((m) => resolveWidth(m[2]));
  if (values.length === 0) throw new Error('style sets no width');
  return Math.min(...values);
};

describe('tap targets meet theme.touch.min in both directions', () => {
  test('every Chip is at least 56 wide, so one-character chips (1-6, 0-4+, bjj, hip) are too', () => {
    render(<Chip label="1" selected={false} onPress={() => {}} accessibilityLabel="one" />);
    const style = StyleSheet.flatten(screen.getByLabelText('one').props.style);
    expect(style.minWidth).toBeGreaterThanOrEqual(theme.touch.min);
    expect(style.minHeight).toBeGreaterThanOrEqual(theme.touch.min);
  });

  test('the session chips do not lower the Chip minimum below theme.touch.min', () => {
    expect(widthFloor(styleBlock(src('screens/SessionScreen.tsx'), 'rirChip')))
      .toBeGreaterThanOrEqual(theme.touch.min);
  });

  test('the "Something feels off" severity chips are at least theme.touch.min wide', () => {
    expect(widthFloor(styleBlock(src('screens/BlockScreen.tsx'), 'severityChip')))
      .toBeGreaterThanOrEqual(theme.touch.min);
  });
});
