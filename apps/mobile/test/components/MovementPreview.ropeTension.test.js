// Static force geometry of a free bilateral rope junction, independent of
// the author's midpoint construction. This does not prove native dynamics.
import { DUAL_BODY_PARAMETERS, pushdownGeometry, straightArmPulldownGeometry } from '../../src/components/movementPreview/canonicalFigure';
const norm = v => Math.hypot(...v);
const minus = (a, b) => a.map((x, i) => x - b[i]);
const unit = v => v.map(x => x / norm(v));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

test.each(Object.keys(DUAL_BODY_PARAMETERS))('free rope junction balances the cable pull and stays forward of both hands (%s)', bodyName => {
  const body = DUAL_BODY_PARAMETERS[bodyName];
  const geometries = [
    ...Array.from({ length: 23 }, (_, i) => pushdownGeometry(i * 5, body, true)),
    ...Array.from({ length: 24 }, (_, i) => straightArmPulldownGeometry(-30 + i * 5, body)),
  ];
  for (const g of geometries) {
    const a = g.near.world.wrist, b = g.far.world.wrist, j = g.junction.world, p = g.pulley.world;
    const branchA = minus(a, j), branchB = minus(b, j);
    expect(norm(branchA)).toBeCloseTo(12, 8); expect(norm(branchB)).toBeCloseTo(12, 8);
    const ta = unit(branchA), tb = unit(branchB), main = unit(minus(p, j));
    const resultant = ta.map((v, i) => v + tb[i]);
    expect(norm(cross(resultant, main))).toBeLessThan(1e-10);
    expect(resultant.reduce((sum, v, i) => sum + v * main[i], 0)).toBeLessThan(0);
    expect(j[0]).toBeGreaterThan(a[0]); expect(j[0]).toBeLessThan(p[0]);
    expect(j[2]).toBeCloseTo(0, 8);
  }
});
