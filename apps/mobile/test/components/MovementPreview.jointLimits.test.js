/**
 * Joint limits for the parallel streams' batches, at every 33 ms tick of each
 * chain movement's cycle, near and far side.
 *
 * Stream 1 (MOV-A01 to MOV-A05, MOV-A08, MOV-A11): a knee does not close past
 * 35 degrees and an elbow past 30 degrees (the internal angle between the two
 * bones that meet there): beyond that the calf is drawn through the thigh, or
 * the forearm through the upper arm.
 *
 * Stream 2 (MOV-A06, MOV-A09, MOV-A12, MOV-A15): the same knee and elbow
 * limits, and the forearm-to-upper-arm painted clearance stays at least the
 * upper-arm radius plus the forearm radius (3.84) on both arms.
 */
import * as rig from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = rig.CANONICAL_BODY_PARAMETERS;

const MIN_KNEE_DEG = 35;
const MIN_ELBOW_DEG = 30;

// The movement ids of each batch file (orders MOV-A01 to MOV-A05, MOV-A08, MOV-A11).
const BATCHES = {
  'MOV-A01': [1, 123, 277, 299, 8, 208, 38, 256, 275],
  'MOV-A02': [140, 192, 81, 98, 120, 235, 105, 48],
  'MOV-A03': [2, 46, 176, 257, 78, 258, 290],
  'MOV-A04': [288, 61, 210, 271, 94, 35, 23, 202, 244],
  'MOV-A05': [3, 43, 45, 102, 65, 151, 252, 203, 249, 83],
  'MOV-A08': [5, 104, 107, 293, 79, 130],
  'MOV-A11': [184, 281, 109, 190, 213, 240, 259],
};
const IDS = Object.values(BATCHES).flat();

const internalDeg = (a, b, c) => {
  const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
  const n = Math.hypot(u[0], u[1], u[2]) * Math.hypot(v[0], v[1], v[2]);
  return (Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / n))) * 180) / Math.PI;
};

const entryFor = (id) => previewManifest.entries.find((e) => e.movementId === id);

describe('stream 1 joint limits: knees at least 35 degrees, elbows at least 30 degrees, at every 33 ms tick', () => {
  test('every batch id has a chain-drawn manifest entry', () => {
    expect(IDS).toHaveLength(56);
    expect(new Set(IDS).size).toBe(IDS.length);
    for (const id of IDS) {
      const e = entryFor(id);
      expect(e).toBeDefined();
      expect(rig.CHAIN_MOVEMENTS[e.assetKey.split('/')[1]]).toBeDefined();
    }
  });

  test.each(IDS)('movement %i keeps every knee >= 35 deg and every elbow >= 30 deg', (id) => {
    const e = entryFor(id);
    const slug = e.assetKey.split('/')[1];
    const ds = e.segmentDurationsMs;
    const total = ds.reduce((a, b) => a + b, 0);
    const poses = e.frames.map((f) => f.joints);
    let minKnee = { deg: 360 };
    let minElbow = { deg: 360 };
    for (let t = 0; t <= total; t += 33) {
      const p = rig.poseAtTime(poses, t, ds);
      const g = rig.chainGeometry(slug, p.ph, BODY, p.tw ?? 0);
      for (const side of ['near', 'far']) {
        const w = g.world[side];
        const knee = internalDeg(w.hipJoint, w.knee, w.ankle);
        const elbow = internalDeg(w.shoulder, w.elbow, w.wrist);
        if (knee < minKnee.deg) minKnee = { deg: knee, t, side };
        if (elbow < minElbow.deg) minElbow = { deg: elbow, t, side };
      }
    }
    expect({ id, knee: minKnee.deg >= MIN_KNEE_DEG ? 'ok' : minKnee }).toEqual({ id, knee: 'ok' });
    expect({ id, elbow: minElbow.deg >= MIN_ELBOW_DEG ? 'ok' : minElbow }).toEqual({ id, elbow: 'ok' });
  });
});

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
