// Standing front raises, side view: Dumbbell Front Raise (87) and Front Cable
// Raise (206). Every bound below comes from the movement's own catalogue text,
// quoted beside it, not from the drawing.
import {
  CANONICAL_BODY_PARAMETERS,
  FRONT_CABLE_RAISE_PULLEY,
  FRONT_RAISE,
  FRONT_RAISE_FREE_ARM_DEG,
  layoutCanonicalFigure,
  poseAtTime,
  resolveFigureJoints,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

/** Straight-line distance between two 2D points. */
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const deg = (rad) => (rad * 180) / Math.PI;
const UPPER_ARM = 12.5;
const FOREARM = 12.0;
/** The far side's side-view perspective offset (FAROFF_DEFAULT). */
const FAR_OFFSET = [-4.8, 0];

const entry87 = previewManifest.entries.find((e) => e.movementId === 87);
const entry206 = previewManifest.entries.find((e) => e.movementId === 206);

/** Every 33 ms tick of the cycle, plus its exact end. */
function ticksOf(entry) {
  const total = entry.segmentDurationsMs.reduce((a, b) => a + b, 0);
  return [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];
}

/** The interpolated pose, the joints it resolves to and the drawn primitives at time `t`. */
function figureAt(entry, t) {
  const pose = poseAtTime(entry.frames.map((f) => f.joints), t, entry.segmentDurationsMs);
  const opts = { ...entry, body: CANONICAL_BODY_PARAMETERS };
  return { pose, joints: resolveFigureJoints(pose, opts), prims: layoutCanonicalFigure(pose, opts) };
}

/** Flexion of a segment: degrees forward (toward +x, the way the figure faces) from hanging straight down. */
const flexion = (from, to) => deg(Math.atan2(to[0] - from[0], to[1] - from[1]));
const topTime = (entry) => entry.segmentDurationsMs[0];

describe.each([
  ['Dumbbell Front Raise', entry87, 'dumbbell-front-raise'],
  ['Front Cable Raise', entry206, 'front-cable-raise'],
])('%s: shared front-raise mechanics', (_name, entry, slug) => {
  test('is a pending side-view draft that closes its loop', () => {
    expect(entry).toBeDefined();
    expect(entry.status).toBe('pending');
    expect(entry.view).toBe('side');
    expect(entry.assetKey).toBe(`movement/${slug}/demo/v1`);
    expect(entry.frames[0].joints).toEqual(entry.frames.at(-1).joints);
  });

  test('only the arms move and every bone keeps its length on every tick', () => {
    const start = figureAt(entry, 0).joints;
    for (const t of ticksOf(entry)) {
      const { joints: f } = figureAt(entry, t);
      // "Torso a pillar" / "Keeping the torso still".
      for (const key of ['hd', 'nk', 'hp', 'kn', 'an', 'kf', 'af', 'nArm', 'fArm']) {
        expect(f[key]).toEqual(start[key]);
      }
      expect(distance(f.nArm, f.el)).toBeCloseTo(UPPER_ARM, 6);
      expect(distance(f.el, f.wr)).toBeCloseTo(FOREARM, 6);
      expect(distance(f.fArm, f.ef)).toBeCloseTo(UPPER_ARM, 6);
      expect(distance(f.ef, f.wf)).toBeCloseTo(FOREARM, 6);
      // The far shoulder sits at its perspective offset for the whole rep.
      expect(f.fArm[0] - f.nArm[0]).toBeCloseTo(FAR_OFFSET[0], 9);
      expect(f.fArm[1] - f.nArm[1]).toBeCloseTo(FAR_OFFSET[1], 9);
      // The working arm travels forward of the body, never behind it.
      expect(f.wr[0]).toBeGreaterThan(f.nArm[0]);
      // "soft elbow" / "a slight bend in the elbow": never more than the declared bend.
      const bend = flexion(f.el, f.wr) - flexion(f.nArm, f.el);
      expect(Math.abs(bend)).toBeLessThanOrEqual(FRONT_RAISE[slug].softElbowDeg + 1e-9);
    }
    expect(FRONT_RAISE[slug].softElbowDeg).toBeGreaterThan(0);
    expect(FRONT_RAISE[slug].softElbowDeg).toBeLessThanOrEqual(15);
  });

  test('the stored keyframe joints are the drawn geometry, before the far-side offset', () => {
    for (const frame of entry.frames) {
      const f = resolveFigureJoints(frame.joints, { ...entry, body: CANONICAL_BODY_PARAMETERS });
      expect(distance(frame.joints.el, f.el)).toBeLessThan(0.01);
      expect(distance(frame.joints.wr, f.wr)).toBeLessThan(0.01);
      expect(distance(frame.joints.ef, [f.ef[0] - FAR_OFFSET[0], f.ef[1] - FAR_OFFSET[1]])).toBeLessThan(0.01);
      expect(distance(frame.joints.wf, [f.wf[0] - FAR_OFFSET[0], f.wf[1] - FAR_OFFSET[1]])).toBeLessThan(0.01);
    }
  });
});

describe('Dumbbell Front Raise (87)', () => {
  test('"holding dumbbells in front of your thighs": the bells start against the front of the thigh', () => {
    const { joints: f } = figureAt(entry87, 0);
    expect(flexion(f.nArm, f.el)).toBeLessThanOrEqual(10);
    const thighFront = f.nLeg[0] + (CANONICAL_BODY_PARAMETERS.lw * 1.18) / 2;
    expect(f.wr[0]).toBeGreaterThan(thighFront); // the hand is in front of the thigh
    expect(f.wr[0] - 2.8).toBeLessThanOrEqual(thighFront + 1); // and the bell rests at it, not held out
  });

  test('"Raise one or both arms straight ahead to shoulder height": both arms, to the shoulder line', () => {
    expect(FRONT_RAISE['dumbbell-front-raise'].bothArms).toBe(true);
    for (const t of ticksOf(entry87)) {
      const { joints: f } = figureAt(entry87, t);
      // Both arms do the same thing: the far arm is the near arm at its offset.
      expect(f.ef[0] - f.el[0]).toBeCloseTo(FAR_OFFSET[0], 9);
      expect(f.wf[0] - f.wr[0]).toBeCloseTo(FAR_OFFSET[0], 9);
      expect(f.wf[1]).toBeCloseTo(f.wr[1], 9);
    }
    const { joints: top } = figureAt(entry87, topTime(entry87));
    expect(Math.abs(top.wr[1] - top.nArm[1])).toBeLessThanOrEqual(1); // hand level with the shoulder
    expect(flexion(top.nArm, top.el)).toBeCloseTo(90, 6); // straight ahead
  });

  test('"Slower down than up": the lowering is one unbroken phase, longer than the raise', () => {
    const [up, hold, down] = entry87.segmentDurationsMs;
    expect(down).toBeGreaterThanOrEqual(1.5 * (up));
    expect(hold).toBeLessThan(up);
  });

  test('draws one end-on dumbbell in each hand and no cable', () => {
    for (const t of ticksOf(entry87)) {
      const { joints: f, prims } = figureAt(entry87, t);
      const bells = prims.filter((p) => p.kind === 'rect' && p.w === 5.6 && p.h === 5.6);
      expect(bells).toHaveLength(2);
      for (const hand of [f.wr, f.wf]) {
        expect(bells.some((b) => Math.abs(b.x + 2.8 - hand[0]) < 1e-9 && Math.abs(b.y + 2.8 - hand[1]) < 1e-9)).toBe(true);
      }
      // The near bell is painted over the far one.
      expect(bells[1].fill).toBe('textHi');
      expect(prims.filter((p) => p.kind === 'bone' && p.color === 'textMid')).toHaveLength(0);
    }
  });
});

describe('Front Cable Raise (206)', () => {
  test('"holding the single handle in one hand": one arm works, the other hangs still', () => {
    expect(FRONT_RAISE['front-cable-raise'].bothArms).toBe(false);
    const start = figureAt(entry206, 0).joints;
    for (const t of ticksOf(entry206)) {
      const { joints: f } = figureAt(entry206, t);
      expect(f.ef).toEqual(start.ef);
      expect(f.wf).toEqual(start.wf);
      expect(flexion(f.fArm, f.ef)).toBeCloseTo(FRONT_RAISE_FREE_ARM_DEG, 6);
    }
  });

  test('"in front of the thigh" at the start and "just above level with the floor" at the top', () => {
    const { joints: bottom } = figureAt(entry206, 0);
    const thighFront = bottom.nLeg[0] + (CANONICAL_BODY_PARAMETERS.lw * 1.18) / 2;
    expect(bottom.wr[0]).toBeGreaterThan(thighFront);
    expect(bottom.wr[0] - thighFront).toBeLessThanOrEqual(4);
    const { joints: top } = figureAt(entry206, topTime(entry206));
    // Level is the shoulder line. The hand finishes above it, but only just.
    expect(top.wr[1]).toBeLessThan(top.nArm[1]);
    expect(top.nArm[1] - top.wr[1]).toBeLessThanOrEqual(4);
  });

  test('"Pause, then lower slowly": a real pause, and a lowering slower than the raise', () => {
    const [up, pause, down] = entry206.segmentDurationsMs;
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(down).toBeGreaterThan(up);
    const held = [0, pause / 2, pause].map((dt) => figureAt(entry206, up + dt).joints.wr);
    expect(held[1]).toEqual(held[0]);
    expect(held[2]).toEqual(held[0]);
  });

  test('"Stand facing away from a low pulley": a fixed low pulley behind, one cable to the working hand', () => {
    const lengths = [];
    for (const t of ticksOf(entry206)) {
      const { joints: f, prims } = figureAt(entry206, t);
      const cables = prims.filter((p) => p.kind === 'bone' && p.color === 'textMid');
      expect(cables).toHaveLength(1);
      const [cable] = cables;
      expect([cable.x1, cable.y1]).toEqual([...FRONT_CABLE_RAISE_PULLEY]);
      expect([cable.x2, cable.y2]).toEqual([f.wr[0], f.wr[1]]);
      lengths.push(distance(FRONT_CABLE_RAISE_PULLEY, f.wr));
      // No dumbbells, and the free hand holds nothing.
      expect(prims.filter((p) => p.kind === 'rect' && p.w === 5.6)).toHaveLength(0);
    }
    const { joints: f } = figureAt(entry206, 0);
    // Behind: the figure faces +x (its toes point that way), the pulley is on the other side.
    expect(FRONT_CABLE_RAISE_PULLEY[0]).toBeLessThan(f.af[0] + FAR_OFFSET[0] - 10);
    // Low: within knee height of the floor.
    expect(FRONT_CABLE_RAISE_PULLEY[1]).toBeGreaterThan(f.kn[1]);
    // The cable is shortest at the start and longest at the top.
    expect(Math.min(...lengths)).toBeCloseTo(lengths[0], 6);
    expect(Math.max(...lengths)).toBeCloseTo(distance(FRONT_CABLE_RAISE_PULLEY, figureAt(entry206, topTime(entry206)).joints.wr), 6);
  });
});

test('the two front raises are different drawings, not one drawing with new captions', () => {
  const top87 = figureAt(entry87, topTime(entry87));
  const top206 = figureAt(entry206, topTime(entry206));
  expect(distance(top87.joints.wf, top206.joints.wf)).toBeGreaterThan(10); // both arms up against one arm up
  expect(top206.joints.wr[1]).toBeLessThan(top87.joints.wr[1]); // the cable raise finishes higher
  expect(entry87.segmentDurationsMs).not.toEqual(entry206.segmentDurationsMs);
  expect(entry87.viewBox).not.toEqual(entry206.viewBox);
});
