// Standing lateral raises, front view: Dumbbell Lateral Raise (50) and
// Lateral Raise - With Bands (236). Every bound below comes from the
// movement's own catalogue text, quoted beside it, not from the drawing.
import {
  CANONICAL_BODY_PARAMETERS,
  LATERAL_RAISE_ELBOW_DEG,
  layoutCanonicalFigure,
  poseAtTime,
  resolveFigureJoints,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const deg = (rad) => (rad * 180) / Math.PI;
const MIDLINE = 50;
const FLOOR = 96.4;
const UPPER_ARM = 13.26;
const FOREARM = 11.2;

const entry50 = previewManifest.entries.find((e) => e.movementId === 50);
const entry236 = previewManifest.entries.find((e) => e.movementId === 236);

/** Every 33 ms tick of the cycle, plus its exact end. */
function ticksOf(entry) {
  const total = entry.segmentDurationsMs.reduce((a, b) => a + b, 0);
  return [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];
}

function figureAt(entry, t) {
  const pose = poseAtTime(entry.frames.map((f) => f.joints), t, entry.segmentDurationsMs);
  const opts = { ...entry, body: CANONICAL_BODY_PARAMETERS };
  return { pose, joints: resolveFigureJoints(pose, opts), prims: layoutCanonicalFigure(pose, opts) };
}

/**
 * Angle of a near-side (screen-left) limb segment away from hanging straight
 * down, in degrees. Positive opens outward, away from the body; negative
 * points in toward the midline.
 */
const fromHanging = (from, to) => deg(Math.atan2(from[0] - to[0], to[1] - from[1]));

describe.each([
  ['Dumbbell Lateral Raise', entry50, 'dumbbell-lateral-raise'],
  ['Lateral Raise - With Bands', entry236, 'lateral-raise-with-bands'],
])('%s: shared lateral-raise mechanics', (_name, entry, slug) => {
  test('is a pending front-view draft that closes its loop', () => {
    expect(entry).toBeDefined();
    expect(entry.status).toBe('pending');
    expect(entry.view).toBe('front');
    expect(entry.assetKey).toBe(`movement/${slug}/demo/v1`);
    expect(entry.frames[0].joints).toEqual(entry.frames.at(-1).joints);
  });

  test('only the arms move, they mirror, and the elbow bend is fixed on every tick', () => {
    const start = figureAt(entry, 0).joints;
    for (const t of ticksOf(entry)) {
      const { joints: f } = figureAt(entry, t);
      // "Torso stays still" / "If the torso has to swing, reduce the load".
      for (const key of ['hd', 'nk', 'hp', 'kn', 'an', 'kf', 'af', 'nArm', 'fArm']) {
        expect(f[key]).toEqual(start[key]);
      }
      // Bone lengths are exact: the arc never cuts a chord.
      expect(distance(f.nArm, f.el)).toBeCloseTo(UPPER_ARM, 6);
      expect(distance(f.el, f.wr)).toBeCloseTo(FOREARM, 6);
      expect(distance(f.fArm, f.ef)).toBeCloseTo(UPPER_ARM, 6);
      expect(distance(f.ef, f.wf)).toBeCloseTo(FOREARM, 6);
      // Left and right arms mirror about the midline.
      expect(f.el[0] + f.ef[0]).toBeCloseTo(2 * MIDLINE, 6);
      expect(f.wr[0] + f.wf[0]).toBeCloseTo(2 * MIDLINE, 6);
      expect(f.el[1]).toBeCloseTo(f.ef[1], 6);
      expect(f.wr[1]).toBeCloseTo(f.wf[1], 6);
      // "soft elbows" / "a slight, fixed bend in the elbows": one bend, held.
      const bend = fromHanging(f.nArm, f.el) - fromHanging(f.el, f.wr);
      expect(bend).toBeCloseTo(LATERAL_RAISE_ELBOW_DEG[slug], 4);
      // The arms open outward, away from the body, never across it.
      expect(f.el[0]).toBeLessThan(f.nArm[0]);
      expect(f.ef[0]).toBeGreaterThan(f.fArm[0]);
    }
  });

  test('the stored keyframe joints are the drawn geometry', () => {
    for (const frame of entry.frames) {
      const f = resolveFigureJoints(frame.joints, { ...entry, body: CANONICAL_BODY_PARAMETERS });
      for (const key of ['el', 'wr', 'ef', 'wf']) {
        expect(distance(frame.joints[key], f[key])).toBeLessThan(0.01); // stored to two decimals
      }
    }
  });
});

describe('Dumbbell Lateral Raise (50)', () => {
  const bottom = () => figureAt(entry50, 0);
  const top = () => figureAt(entry50, entry50.segmentDurationsMs[0] + entry50.segmentDurationsMs[1]);

  test('"the dumbbells hanging just off the thighs": arms hang near the sides, clear of the legs', () => {
    const { joints: f } = bottom();
    expect(fromHanging(f.nArm, f.el)).toBeLessThanOrEqual(20);
    const thighOuterEdge = f.nLeg[0] - (CANONICAL_BODY_PARAMETERS.lw * 1.18) / 2;
    const bellInnerEdge = f.wr[0] + 2.8;
    expect(bellInnerEdge).toBeLessThanOrEqual(thighOuterEdge);
    expect(thighOuterEdge - bellInnerEdge).toBeLessThanOrEqual(2); // "just off", not held wide
  });

  test('"until the elbows reach shoulder height" with "hands stay below them"', () => {
    const { joints: f } = top();
    expect(Math.abs(f.el[1] - f.nArm[1])).toBeLessThanOrEqual(1); // elbow level with the shoulder
    expect(f.wr[1]).toBeGreaterThan(f.el[1] + 1); // hand visibly lower than the elbow
    expect(f.wr[1]).toBeGreaterThan(f.nArm[1]); // and not above the shoulder
  });

  test('"Three seconds down": the lowering takes three seconds and is the slow half', () => {
    const [upA, upB, hold, down] = entry50.segmentDurationsMs;
    const up = upA + upB;
    expect(down).toBeGreaterThanOrEqual(3000);
    expect(down).toBeGreaterThan(2 * up);
    expect(hold).toBeLessThan(up);
    // The elbow rises through the raise and falls through the lowering.
    const ys = ticksOf(entry50).map((t) => figureAt(entry50, t).joints.el[1]);
    const peakIndex = ys.indexOf(Math.min(...ys));
    for (let i = 1; i <= peakIndex; i++) expect(ys[i]).toBeLessThanOrEqual(ys[i - 1] + 1e-9);
    for (let i = ys.lastIndexOf(Math.min(...ys)) + 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1] - 1e-9);
  });

  test('draws one end-on dumbbell in each hand and no band', () => {
    for (const t of ticksOf(entry50)) {
      const { joints: f, prims } = figureAt(entry50, t);
      const bells = prims.filter((p) => p.kind === 'rect' && p.w === 5.6 && p.h === 5.6);
      expect(bells).toHaveLength(2);
      for (const hand of [f.wr, f.wf]) {
        expect(bells.some((b) => Math.abs(b.x + 2.8 - hand[0]) < 1e-9 && Math.abs(b.y + 2.8 - hand[1]) < 1e-9)).toBe(true);
      }
      expect(prims.filter((p) => p.kind === 'bone' && p.color === 'textMid')).toHaveLength(0);
    }
  });
});

describe('Lateral Raise - With Bands (236)', () => {
  const bottom = () => figureAt(entry236, 0);
  const top = () => figureAt(entry236, entry236.segmentDurationsMs[0] + entry236.segmentDurationsMs[1]);

  test('"at the sides of the thighs, arms almost straight"', () => {
    const { joints: f } = bottom();
    expect(fromHanging(f.nArm, f.el)).toBeLessThanOrEqual(12);
    expect(LATERAL_RAISE_ELBOW_DEG['lateral-raise-with-bands']).toBeLessThanOrEqual(15);
    const thighOuterEdge = f.nLeg[0] - (CANONICAL_BODY_PARAMETERS.lw * 1.18) / 2;
    expect(Math.abs(f.wr[0] - thighOuterEdge)).toBeLessThanOrEqual(3); // hand beside the thigh
  });

  test('"until they are just above level with the floor"', () => {
    const { joints: f } = top();
    // Level is the shoulder line. The hand finishes above it, but only just.
    expect(f.wr[1]).toBeLessThan(f.nArm[1]);
    expect(f.nArm[1] - f.wr[1]).toBeLessThanOrEqual(3);
    expect(f.el[1]).toBeLessThan(f.nArm[1]); // "Lead with the elbows"
  });

  test('"Pause, then lower slowly": a real pause, and a lowering slower than the raise', () => {
    const [upA, upB, pause, down] = entry236.segmentDurationsMs;
    const up = upA + upB;
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(down).toBeGreaterThan(up);
    const held = [0, pause / 2, pause].map((dt) => figureAt(entry236, up + dt).joints.wr);
    expect(held[1]).toEqual(held[0]);
    expect(held[2]).toEqual(held[0]);
  });

  test('"Stand on the middle of a band": fixed anchors under the feet, an end to each hand, no dumbbells', () => {
    const lengths = [];
    for (const t of ticksOf(entry236)) {
      const { joints: f, prims } = figureAt(entry236, t);
      const band = prims.filter((p) => p.kind === 'bone' && p.color === 'textMid');
      expect(band).toHaveLength(3);
      const [underFeet, toNear, toFar] = band;
      // The middle of the band lies on the floor between the two feet.
      expect([underFeet.x1, underFeet.y1, underFeet.x2, underFeet.y2]).toEqual([f.an[0], FLOOR, f.af[0], FLOOR]);
      // Each end runs from under a foot to the hand on that side.
      expect([toNear.x1, toNear.y1]).toEqual([f.an[0], FLOOR]);
      expect([toNear.x2, toNear.y2]).toEqual([f.wr[0], f.wr[1]]);
      expect([toFar.x1, toFar.y1]).toEqual([f.af[0], FLOOR]);
      expect([toFar.x2, toFar.y2]).toEqual([f.wf[0], f.wf[1]]);
      lengths.push(distance([toNear.x1, toNear.y1], [toNear.x2, toNear.y2]));
      expect(prims.filter((p) => p.kind === 'rect' && p.w === 5.6)).toHaveLength(0);
    }
    // The band is longest at the top of the raise and shortest at the start.
    const topLength = distance([top().joints.an[0], FLOOR], top().joints.wr);
    expect(Math.max(...lengths)).toBeCloseTo(topLength, 6);
    expect(Math.min(...lengths)).toBeCloseTo(lengths[0], 6);
    expect(topLength).toBeGreaterThan(lengths[0] * 1.3);
  });
});

test('the two lateral raises are different drawings, not one drawing with new captions', () => {
  const top50 = figureAt(entry50, entry50.segmentDurationsMs[0] + entry50.segmentDurationsMs[1]).joints;
  const top236 = figureAt(entry236, entry236.segmentDurationsMs[0] + entry236.segmentDurationsMs[1]).joints;
  expect(distance(top50.wr, top236.wr)).toBeGreaterThan(3); // different finish height
  expect(entry50.segmentDurationsMs).not.toEqual(entry236.segmentDurationsMs); // different tempo
  expect(LATERAL_RAISE_ELBOW_DEG['dumbbell-lateral-raise']).not.toBe(LATERAL_RAISE_ELBOW_DEG['lateral-raise-with-bands']);
});
