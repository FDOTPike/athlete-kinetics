// Android walk 2026-11-03 (a11y-5), system font size 2.0:
// - the header label "WORKOUT" wrapped to "WORKOU / T" and the "PROGRESS"
//   tab ran off the screen edge;
// - the "i" of every info button was clipped inside its fixed 18 dp circle;
// - in Profile, a long heading pushed its info button off the screen.
import React from 'react';
import fs from 'fs';
import path from 'path';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 412, height: 915, scale: 3, fontScale: mockFontScale }),
}));

const InfoTip = require('../../src/components/InfoTip').default;

describe('info button glyph grows with the system font size', () => {
  test.each([[1, 18], [2, 36], [1.3, 23]])('font scale %s gives a %s dp circle', (scale, size) => {
    mockFontScale = scale;
    render(<InfoTip term="HRV" />);
    const icon = StyleSheet.flatten(screen.getByTestId('info-tip-icon').props.style);
    expect(icon.width).toBe(size);
    expect(icon.height).toBe(size);
    expect(icon.borderRadius).toBe(size / 2);
  });
});

describe('profile headings shrink before they push an info button off screen', () => {
  test('the field label may shrink inside its row', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../src/screens/ProfileScreen.tsx'), 'utf8');
    const block = source.match(/\n  fieldLabel: \{([^}]*)\}/);
    expect(block).not.toBeNull();
    expect(block[1]).toMatch(/flexShrink:\s*1\b/);
  });
});
