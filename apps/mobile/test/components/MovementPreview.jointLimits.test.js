/**
 * Joint-limit invariants across every 33 ms tick of every chain movement in
 * stream 2's batches (MOV-A06, MOV-A09, MOV-A12, MOV-A15):
 * - Internal 3D knee angle (hipJoint, knee, ankle) >= 35 degrees on both near and far legs
 * - Internal 3D elbow angle (shoulder, elbow, wrist) >= 30 degrees on both near and far arms
 * - Forearm-to-upper-arm painted clearance >= upper-arm radius + forearm radius (3.84) on both arms
 */
import * as rig from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = rig.CANONICAL_BODY_PARAMETERS;
const FOREARM_UPPER_ARM_PAINTED_RADII = (BODY.lw * 0.88) / 2 + (BODY.lw * 0.72) / 2;

const STREAM_2_BATCH_IDS = [
  // MOV-A06
  4, 31, 41, 129, 189, 228, 230,
  // MOV-A09
  93, 188, 195, 241, 243, 265, 296,
  // MOV-A12
  47, 91, 166, 170, 177, 215, 233, 242,
  // MOV-A15
  145, 153, 165, 205, 250,
];

const deg3D = (a, b, c) => {
  const ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2];
  const vx = c[0] - b[0], vy = c[1] - b[1], vz = c[2] - b[2];
  const n = Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz) || 1;
  return (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / n))) * 180) / Math.PI;
};

const segDist3D = (a, b, p) => {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const lenSq = ux * ux + uy * uy + uz * uz || 1;
  const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * ux + (p[1] - a[1]) * uy + (p[2] - a[2]) * uz) / lenSq));
  return Math.hypot(p[0] - (a[0] + ux * k), p[1] - (a[1] + uy * k), p[2] - (a[2] + uz * k));
};

describe('MovementPreview joint limits across stream 2 batches (A06, A09, A12, A15)', () => {
  test.each(STREAM_2_BATCH_IDS)(
    'movement %i keeps internal knee angle >= 35 deg, internal elbow angle >= 30 deg, and forearm-to-upper-arm painted clearance >= 3.84 at every 33 ms tick',
    (id) => {
      const entry = previewManifest.entries.find((e) => e.movementId === id);
      expect(entry).toBeDefined();
      const slug = entry.assetKey.split('/')[1];
      expect(rig.CHAIN_MOVEMENTS[slug]).toBeDefined();

      const ds = entry.segmentDurationsMs;
      const total = ds.reduce((a, b) => a + b, 0);
      const poses = entry.frames.map((f) => f.joints);
      const ticks = [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];

      let minNearKnee = Infinity;
      let minFarKnee = Infinity;
      let minNearElbow = Infinity;
      let minFarElbow = Infinity;
      let minNearForearmClear = Infinity;
      let minFarForearmClear = Infinity;

      for (const t of ticks) {
        const p = rig.poseAtTime(poses, t, ds);
        const w = rig.chainGeometry(slug, p.ph, BODY, p.tw ?? 0).world;
        minNearKnee = Math.min(minNearKnee, deg3D(w.near.hipJoint, w.near.knee, w.near.ankle));
        minFarKnee = Math.min(minFarKnee, deg3D(w.far.hipJoint, w.far.knee, w.far.ankle));
        minNearElbow = Math.min(minNearElbow, deg3D(w.near.shoulder, w.near.elbow, w.near.wrist));
        minFarElbow = Math.min(minFarElbow, deg3D(w.far.shoulder, w.far.elbow, w.far.wrist));
        minNearForearmClear = Math.min(minNearForearmClear, segDist3D(w.near.shoulder, w.near.elbow, w.near.wrist));
        minFarForearmClear = Math.min(minFarForearmClear, segDist3D(w.far.shoulder, w.far.elbow, w.far.wrist));
      }

      expect(minNearKnee).toBeGreaterThanOrEqual(35);
      expect(minFarKnee).toBeGreaterThanOrEqual(35);
      expect(minNearElbow).toBeGreaterThanOrEqual(30);
      expect(minFarElbow).toBeGreaterThanOrEqual(30);
      expect(minNearForearmClear).toBeGreaterThanOrEqual(FOREARM_UPPER_ARM_PAINTED_RADII);
      expect(minFarForearmClear).toBeGreaterThanOrEqual(FOREARM_UPPER_ARM_PAINTED_RADII);
    },
  );
});
