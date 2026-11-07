/**
 * Theme text contrast (issue #136).
 *
 * The secondary and low-emphasis text colours are used on primary content
 * (exercise lists, input placeholders, nav labels), so each must meet WCAG
 * AA for normal text, at least 4.5:1, on both surfaces they sit on: the app
 * background (ink0) and the raised surface (ink1).
 */
const { theme } = require('../../src/theme/theme');

function channel(c8) {
  const c = c8 / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`not a #RRGGBB colour: ${hex}`);
  const [r, g, b] = m.slice(1).map(h => channel(parseInt(h, 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('theme text contrast (WCAG AA, 4.5:1)', () => {
  it('computes known reference ratios', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });

  for (const fg of ['textMid', 'textLow']) {
    for (const bg of ['ink0', 'ink1']) {
      it(`${fg} on ${bg} is at least 4.5:1`, () => {
        const ratio = contrast(theme.color[fg], theme.color[bg]);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('textLow stays darker than textMid', () => {
    expect(luminance(theme.color.textLow)).toBeLessThan(luminance(theme.color.textMid));
  });
});
