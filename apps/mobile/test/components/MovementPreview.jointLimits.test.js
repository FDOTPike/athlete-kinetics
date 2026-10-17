/**
 * Joint-limit invariants across every 33 ms tick of every chain movement in
 * stream 3's batches (MOV-A07, MOV-A10, MOV-A13, MOV-A14):
 * - Internal 3D knee angle (hipJoint, knee, ankle) >= 35 degrees on both near and far legs
 * - Internal 3D elbow angle (shoulder, elbow, wrist) >= 30 degrees on both near and far arms
 */
import * as rig from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = rig.CANONICAL_BODY_PARAMETERS;

const STREAM_3_BATCH_IDS = [
  // MOV-A07
  229, 85, 112, 101, 58, 63, 69,
  // MOV-A10
  6, 13, 71, 108, 209, 77, 211, 64,
  // MOV-A13
  18, 36, 56, 136, 194, 239, 67, 96,
  // MOV-A14
  33, 137, 119, 204, 149, 289, 148, 201, 217, 121, 231,
];

const deg3D = (a, b, c) => {
  const ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2];
  const vx = c[0] - b[0], vy = c[1] - b[1], vz = c[2] - b[2];
  const n = Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz) || 1;
  return (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / n))) * 180) / Math.PI;
};

describe('MovementPreview joint limits across stream 3 batches (A07, A10, A13, A14)', () => {
  test.each(STREAM_3_BATCH_IDS)(
    'movement %i keeps internal knee angle >= 35 deg and internal elbow angle >= 30 deg at every 33 ms tick',
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

      for (const t of ticks) {
        const p = rig.poseAtTime(poses, t, ds);
        const w = rig.chainGeometry(slug, p.ph, BODY, p.tw ?? 0).world;
        minNearKnee = Math.min(minNearKnee, deg3D(w.near.hipJoint, w.near.knee, w.near.ankle));
        minFarKnee = Math.min(minFarKnee, deg3D(w.far.hipJoint, w.far.knee, w.far.ankle));
        minNearElbow = Math.min(minNearElbow, deg3D(w.near.shoulder, w.near.elbow, w.near.wrist));
        minFarElbow = Math.min(minFarElbow, deg3D(w.far.shoulder, w.far.elbow, w.far.wrist));
      }

      expect(minNearKnee).toBeGreaterThanOrEqual(35);
      expect(minFarKnee).toBeGreaterThanOrEqual(35);
      expect(minNearElbow).toBeGreaterThanOrEqual(30);
      expect(minFarElbow).toBeGreaterThanOrEqual(30);
    },
  );
});
