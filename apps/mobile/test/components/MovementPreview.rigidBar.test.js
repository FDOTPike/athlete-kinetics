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
    return Boolean(
      m &&
        (TWO_HAND_BAR_IMPLEMENTS.has(m.implement) || slug === 't-bar-row') &&
        m.barAt !== 'elbows',
    );
  })
  .map((e) => [e.movementId, e.assetKey.split('/')[1], e]);

const SHIN_HALF_WIDTH = (BODY.lw * 0.9) / 2; // 2.16
const THIGH_HALF_WIDTH = (BODY.lw * 1.18) / 2; // 2.832
const BAR_HALF_WIDTH = 1.6 / 2; // 0.8
const MIN_SHIN_AXIS_DIST = SHIN_HALF_WIDTH + BAR_HALF_WIDTH; // 2.96
const MIN_THIGH_AXIS_DIST = THIGH_HALF_WIDTH + BAR_HALF_WIDTH; // 3.632
const MAX_CLOSE_SURFACE_GAP = 1.5;
const CLOSE_TO_LEGS_IDS = new Set([2, 46, 176, 257, 78, 258, 290, 98]);

function segSegDist3D(p1, q1, p2, q2) {
  const d1 = [q1[0] - p1[0], q1[1] - p1[1], q1[2] - p1[2]];
  const d2 = [q2[0] - p2[0], q2[1] - p2[1], q2[2] - p2[2]];
  const r = [p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]];
  const a = d1[0] * d1[0] + d1[1] * d1[1] + d1[2] * d1[2];
  const e = d2[0] * d2[0] + d2[1] * d2[1] + d2[2] * d2[2];
  const f = d2[0] * r[0] + d2[1] * r[1] + d2[2] * r[2];
  let s = 0;
  let t = 0;
  if (a <= 1e-9 && e <= 1e-9) return Math.hypot(...r);
  if (a <= 1e-9) {
    t = Math.max(0, Math.min(1, f / e));
  } else {
    const c = d1[0] * r[0] + d1[1] * r[1] + d1[2] * r[2];
    if (e <= 1e-9) {
      s = Math.max(0, Math.min(1, -c / a));
    } else {
      const b = d1[0] * d2[0] + d1[1] * d2[1] + d1[2] * d2[2];
      const denom = a * e - b * b;
      if (denom !== 0) {
        s = Math.max(0, Math.min(1, (b * f - c * e) / denom));
      }
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = Math.max(0, Math.min(1, -c / a));
      } else if (t > 1) {
        t = 1;
        s = Math.max(0, Math.min(1, (b - c) / a));
      }
    }
  }
  const c1 = [p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s];
  const c2 = [p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t];
  return dist3D(c1, c2);
}

function fullBarEnds3D(nearHold, farHold, slug) {
  const dx = farHold[0] - nearHold[0];
  const dy = farHold[1] - nearHold[1];
  const dz = farHold[2] - nearHold[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const uz = dz / len;
  const overhang = slug === 'jefferson-squats' ? (rig.CHAIN_BAR_OVERHANG ?? 10) : 100;
  return [
    [nearHold[0] - ux * overhang, nearHold[1] - uy * overhang, nearHold[2] - uz * overhang],
    [farHold[0] + ux * overhang, farHold[1] + uy * overhang, farHold[2] + uz * overhang],
  ];
}

const barLegEntries = previewManifest.entries
  .filter((e) => {
    const slug = (e.assetKey || '').split('/')[1];
    const m = rig.CHAIN_MOVEMENTS[slug];
    return Boolean(
      m &&
        (m.implement === 'bar' || m.implement === 'ez') &&
        m.barAt !== 'elbows',
    );
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

describe('Rigid-bar 3D bar-axis-to-shin and bar-axis-to-thigh clearance across every 33 ms tick', () => {
  test.each(barLegEntries)(
    'movement %i (%s) clears both shins (>= 2.96) and both thighs (>= 3.632) at every 33 ms tick, and stays within 1.5 surface units where the text keeps the bar close to the legs',
    (id, slug, entry) => {
      const ds = entry.segmentDurationsMs;
      const total = ds.reduce((a, b) => a + b, 0);
      const poses = entry.frames.map((f) => f.joints);

      for (let t = 0; t <= total; t += 33) {
        const pt = rig.poseAtTime(poses, t, ds);
        const gt = rig.chainGeometry(slug, pt.ph ?? 0, BODY, pt.tw ?? 0);
        const [bNear, bFar] = fullBarEnds3D(gt.world.near.hold, gt.world.far.hold, slug);

        for (const side of ['near', 'far']) {
          const limb = gt.world[side];
          const dShin = segSegDist3D(bNear, bFar, limb.ankle, limb.knee);
          const dThigh = segSegDist3D(bNear, bFar, limb.knee, limb.hipJoint);

          expect(dShin).toBeGreaterThanOrEqual(MIN_SHIN_AXIS_DIST);
          expect(dThigh).toBeGreaterThanOrEqual(MIN_THIGH_AXIS_DIST);

          if (CLOSE_TO_LEGS_IDS.has(id)) {
            const barY = (gt.world.near.hold[1] + gt.world.far.hold[1]) / 2;
            const ankleY = limb.ankle[1];
            const kneeY = limb.knee[1];
            const hipY = limb.hipJoint[1];
            const shinSurfaceGap = dShin - MIN_SHIN_AXIS_DIST;
            const thighSurfaceGap = dThigh - MIN_THIGH_AXIS_DIST;

            if (id === 98) {
              // Barbell Hack Squat travels behind the concave back of the knee, transferring from calf to overhanging hamstring.
              if (barY >= ankleY && barY <= kneeY) {
                expect(Math.min(shinSurfaceGap, thighSurfaceGap)).toBeLessThanOrEqual(MAX_CLOSE_SURFACE_GAP);
              } else if (barY > kneeY && barY <= hipY) {
                expect(thighSurfaceGap).toBeLessThanOrEqual(MAX_CLOSE_SURFACE_GAP);
              }
            } else {
              if (barY >= ankleY && barY <= kneeY) {
                expect(shinSurfaceGap).toBeLessThanOrEqual(MAX_CLOSE_SURFACE_GAP);
              } else if (barY > kneeY && barY <= hipY) {
                expect(thighSurfaceGap).toBeLessThanOrEqual(MAX_CLOSE_SURFACE_GAP);
              }
            }
          }
        }
      }
    },
  );
});

