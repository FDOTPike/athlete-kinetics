// Android walk 2026-11-03 (issue 158, font scale 2.0 set before launch):
// words broke mid-word in the workout buttons, timeline names ran into
// "Choose", wrapped chips had no vertical padding, and the completion lines
// touched. The layout rules below are checked against the source, the same way
// TouchTargets56.test.js checks the 56 dp floor; device behaviour is not checked.
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

describe('wrapped chips keep their vertical padding at large text', () => {
  test('a wrapped chip label has at least theme.space[2] of padding above and below', () => {
    render(<Chip label="I PLAY OR COMPETE IN A SPORT" selected={false} onPress={() => {}} wrap />);
    const style = StyleSheet.flatten(screen.getByRole('button').props.style);
    expect(style.paddingVertical).toBeGreaterThanOrEqual(theme.space[2]);
  });
});

describe('workout screen layout at large text', () => {
  const session = src('screens/SessionScreen.tsx');

  test('the two half-width workout buttons stack when the font scale is 1.3 or more', () => {
    expect(session).toMatch(/const \{ fontScale \} = useWindowDimensions\(\);/);
    expect(styleBlock(session, 'quickRowStacked')).toMatch(/flexDirection:\s*'column'/);
    expect(session).toMatch(/styles\.quickRow,\s*fontScale >= 1\.3 && styles\.quickRowStacked/);
  });

  test('an upcoming exercise name wraps at word boundaries instead of being cut to one line', () => {
    expect(session).not.toMatch(/styles\.upcomingName\} numberOfLines=\{1\}/);
  });

  test('the Choose label has a gap from the exercise name', () => {
    expect(styleBlock(session, 'choose')).toMatch(/marginLeft:\s*theme\.space\[[2-4]\]/);
  });

  test('the completion line after the outcome has a gap above it', () => {
    expect(styleBlock(session, 'completionGap')).toMatch(/marginTop:\s*theme\.space\[[2-4]\]/);
    expect(session).toMatch(/style=\{\[styles\.summaryLine, styles\.completionGap\]\}\s*testID="session-feel-ask"/);
  });
});

describe('profile athlete rows at large text', () => {
  test('the athlete name gets a full row when the buttons would share it, so the name is not cut inside a word', () => {
    const profile = src('screens/ProfileScreen.tsx');
    expect(profile).toMatch(/const \{ fontScale \} = useWindowDimensions\(\);/);
    expect(styleBlock(profile, 'athleteRowStacked')).toMatch(/flexDirection:\s*'column'/);
    expect(profile).toMatch(/styles\.athleteRow,\s*fontScale >= 1\.3 && styles\.athleteRowStacked/);
  });
});
