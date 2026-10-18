/**
 * Joint limits for stream 1's batches (MOV-A01 to MOV-A05, MOV-A08, MOV-A11).
 *
 * A knee does not close past 35 degrees and an elbow past 30 degrees (the
 * internal angle between the two bones that meet there): beyond that the
 * calf is drawn through the thigh, or the forearm through the upper arm.
 * Measured from the world joints of every chain movement in these batches,
 * near and far side, at every 33 ms tick of its cycle.
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
