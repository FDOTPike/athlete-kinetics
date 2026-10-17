/**
 * Rigid-bar grip-width invariant across every chain movement that holds a bar
 * in both hands (`bar`, `ez`, `cableBar`, excluding `barAt === 'elbows'`).
 *
 * A rigid bar cannot stretch or shrink during a repetition, and a lifter's
 * hands do not slide along the knurling mid-rep. Across every 33 ms tick of
 * each movement's cycle, the 3D wrist-to-wrist distance must stay within
 * 0.5 units of its starting grip width.
 */
import * as rig from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = rig.CANONICAL_BODY_PARAMETERS;
const TWO_HAND_BAR_IMPLEMENTS = new Set(['bar', 'ez', 'cableBar']);

const dist3D = (a, b) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const barEntries = previewManifest.entries
  .filter((e) => {
    const slug = (e.assetKey || '').split('/')[1];
    const m = rig.CHAIN_MOVEMENTS[slug];
    return Boolean(m && TWO_HAND_BAR_IMPLEMENTS.has(m.implement) && m.barAt !== 'elbows');
  })
  .map((e) => [e.movementId, e.assetKey.split('/')[1], e]);

describe('Rigid-bar 3D wrist-to-wrist grip width stays fixed across every 33 ms tick', () => {
  test('discovers at least 30 two-hand bar movements in previewManifest', () => {
    expect(barEntries.length).toBeGreaterThanOrEqual(30);
  });

  test.each(barEntries)(
    'movement %i (%s) keeps 3D wrist-to-wrist distance within 0.5 units across every 33 ms tick',
    (_id, slug, entry) => {
      const ds = entry.segmentDurationsMs;
      const total = ds.reduce((a, b) => a + b, 0);
      const poses = entry.frames.map((f) => f.joints);

      const p0 = rig.poseAtTime(poses, 0, ds);
      const g0 = rig.chainGeometry(slug, p0.ph ?? 0, BODY);
      const startSpan = dist3D(g0.world.near.wrist, g0.world.far.wrist);
      expect(startSpan).toBeGreaterThan(5);

      let maxDrift = 0;
      for (let t = 0; t <= total; t += 33) {
        const pt = rig.poseAtTime(poses, t, ds);
        const gt = rig.chainGeometry(slug, pt.ph ?? 0, BODY);
        const span = dist3D(gt.world.near.wrist, gt.world.far.wrist);
        const drift = Math.abs(span - startSpan);
        if (drift > maxDrift) maxDrift = drift;
      }

      expect(maxDrift).toBeLessThanOrEqual(0.5);
    },
  );
});
