// Seated Side Lateral Raise (272). Every bound below comes from the movement's
// own catalogue text, quoted beside it. Lengths and angles are measured on the
// 3D model, not on the foreshortened drawing.
import {
  CANONICAL_BODY_PARAMETERS,
  LATERAL_RAISE_ELBOW_DEG,
  SEATED_LATERAL_RAISE,
  layoutCanonicalFigure,
  poseAtTime,
  resolveFigureJoints,
  seatedLateralRaiseGeometry,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = CANONICAL_BODY_PARAMETERS;
const deg = (rad) => (rad * 180) / Math.PI;
/** Straight-line distance between two points of any dimension. */
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
/** How far a segment is swung out to the side from hanging straight down, in degrees (across-body plane). */
const abduction = (from, to) => deg(Math.atan2(to[2] - from[2], from[1] - to[1]));

const entry = previewManifest.entries.find((e) => e.movementId === 272);
const [upA, upB, hold, down] = entry.segmentDurationsMs;
const TOP = upA + upB;

/** Every 33 ms tick of the cycle, plus its exact end. */
function ticks() {
  const total = entry.segmentDurationsMs.reduce((a, b) => a + b, 0);
  return [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];
}

/** The interpolated pose, the 3D model behind it and the drawn primitives at time `t`. */
function figureAt(t) {
  const pose = poseAtTime(entry.frames.map((f) => f.joints), t, entry.segmentDurationsMs);
  const opts = { ...entry, body: BODY };
  return {
    pose,
    model: seatedLateralRaiseGeometry(pose.la, BODY),
    joints: resolveFigureJoints(pose, opts),
    prims: layoutCanonicalFigure(pose, opts),
  };
}

test('is a pending oblique draft that closes its loop', () => {
  expect(entry.status).toBe('pending');
  expect(entry.view).toBe('oblique');
  expect(entry.assetKey).toBe(`movement/${SEATED_LATERAL_RAISE}/demo/v1`);
  expect(entry.frames.length).toBeGreaterThanOrEqual(5);
  expect(entry.frames[0].joints).toEqual(entry.frames.at(-1).joints);
});

test('"Sit at the end of a flat bench with the feet firmly on the floor"', () => {
  const { model } = figureAt(0);
  for (const leg of [model.nearLeg, model.farLeg]) {
    const { root, knee, ankle } = leg.world;
    // Seated: the thigh is level and points forward, the shin drops straight down.
    expect(knee[1]).toBeCloseTo(root[1], 12);
    expect(knee[0]).toBeGreaterThan(root[0] + 20);
    expect(ankle[0]).toBeCloseTo(knee[0], 12);
    expect(distance(root, knee)).toBeCloseTo(22.25, 9);
    expect(distance(knee, ankle)).toBeCloseTo(22.25, 9);
    // The foot is flat on the floor: the ankle sits half a foot-thickness above it.
    expect(leg.projected.ankle[1] + (BODY.lw * 0.9) / 2).toBeCloseTo(96.9, 9);
    expect(leg.world.toe[1]).toBeCloseTo(leg.world.ankle[1], 12); // level, pointing forward
    expect(leg.world.toe[0] - leg.world.ankle[0]).toBeCloseTo(5.4, 12);
  }
  // And it is PAINTED flat: each foot is a level capsule whose sole is on the
  // floor line and never below it.
  const { prims } = figureAt(0);
  const feet = prims.filter((p) => p.kind === 'bone' && Math.abs(p.w - model.footWidth) < 1e-12
    && [model.nearLeg, model.farLeg].some((leg) => Math.abs(p.x1 - leg.projected.ankle[0]) < 1e-9 && Math.abs(p.y1 - leg.projected.ankle[1]) < 1e-9));
  expect(feet).toHaveLength(2);
  for (const foot of feet) {
    expect(foot.y2).toBeCloseTo(foot.y1, 12);
    expect(foot.x2).toBeGreaterThan(foot.x1);
    expect(foot.y1 + foot.w / 2).toBeCloseTo(96.9, 9);
  }
  // The trunk is upright over the hips.
  expect(model.world.neck[0]).toBeCloseTo(model.world.hip[0], 12);
  expect(model.world.neck[1] - model.world.hip[1]).toBeCloseTo(24, 12);
  // The bench top is just under the thighs, and the athlete is at its front
  // END: it runs away behind the hips and stops short of the knees.
  const thighUnderside = model.world.hip[1] - (BODY.lw * 1.18) / 2;
  expect(model.seatY).toBeLessThan(thighUnderside);
  expect(thighUnderside - model.seatY).toBeLessThanOrEqual(3);
  const hipX = model.joints.hp[0];
  const [back, frontEnd] = [Math.min(model.slab[0][0], model.slab[1][0]), Math.max(model.slab[0][0], model.slab[1][0])];
  expect(back).toBeLessThan(hipX - 15);
  expect(frontEnd).toBeGreaterThan(hipX);
  expect(frontEnd).toBeLessThan(Math.min(model.nearLeg.projected.knee[0], model.farLeg.projected.knee[0]));
  for (const post of model.posts) expect(post[1][1]).toBeCloseTo(96.4, 9); // bench legs reach the floor
});

test('"Keeping the torso still": only the arms move, mirrored, with every bone at its real length', () => {
  const start = figureAt(0).joints;
  for (const t of ticks()) {
    const { model, joints } = figureAt(t);
    for (const key of ['hd', 'nk', 'hp', 'kn', 'an', 'kf', 'af', 'nArm', 'fArm', 'nLeg', 'fLeg']) {
      expect(joints[key]).toEqual(start[key]);
    }
    for (const arm of [model.near, model.far]) {
      expect(distance(arm.world.shoulder, arm.world.elbow)).toBeCloseTo(12.5, 9);
      expect(distance(arm.world.elbow, arm.world.wrist)).toBeCloseTo(12.0, 9);
      // Out to the side only: the arm never comes forward or back.
      expect(arm.world.elbow[0]).toBeCloseTo(arm.world.shoulder[0], 12);
      expect(arm.world.wrist[0]).toBeCloseTo(arm.world.shoulder[0], 12);
    }
    expect(model.near.world.wrist[1]).toBeCloseTo(model.far.world.wrist[1], 12);
    expect(model.near.world.wrist[2]).toBeCloseTo(-model.far.world.wrist[2], 12);
  }
});

test('"with a slight bend at the elbow": one small bend, held for the whole rep', () => {
  const bendDeg = LATERAL_RAISE_ELBOW_DEG[SEATED_LATERAL_RAISE];
  expect(bendDeg).toBeGreaterThan(0);
  expect(bendDeg).toBeLessThanOrEqual(15);
  for (const t of ticks()) {
    const { shoulder, elbow, wrist } = figureAt(t).model.near.world;
    expect(abduction(shoulder, elbow) - abduction(elbow, wrist)).toBeCloseTo(bendDeg, 9);
  }
});

test('"a dumbbell in each hand hanging by your sides" at the start', () => {
  const { shoulder, elbow, wrist } = figureAt(0).model.near.world;
  expect(abduction(shoulder, elbow)).toBeLessThanOrEqual(12);
  expect(wrist[1]).toBeLessThan(shoulder[1] - 20); // the hand hangs well below the shoulder
  expect(Math.abs(wrist[2] - shoulder[2])).toBeLessThanOrEqual(3); // beside the body, not held out
});

test('"Continue until the arms are parallel to the floor" / "Lift out to shoulder level"', () => {
  const { shoulder, elbow, wrist } = figureAt(TOP).model.near.world;
  // The hand finishes level with the shoulder, within one unit either way.
  expect(Math.abs(wrist[1] - shoulder[1])).toBeLessThanOrEqual(1);
  expect(Math.abs(elbow[1] - shoulder[1])).toBeLessThanOrEqual(1.5);
  expect(wrist[2] - shoulder[2]).toBeGreaterThanOrEqual(22); // fully out to the side
});

test('"pause for a second. Lower back down slowly"', () => {
  expect(hold).toBeGreaterThanOrEqual(1000);
  expect(down).toBeGreaterThanOrEqual(1.5 * (upA + upB));
  const held = [0, hold / 2, hold].map((dt) => figureAt(TOP + dt).model.near.world.wrist);
  expect(held[1]).toEqual(held[0]);
  expect(held[2]).toEqual(held[0]);
  // The hand only rises on the way up and only falls on the way down.
  const heights = ticks().map((t) => figureAt(t).model.near.world.wrist[1]);
  const peak = Math.max(...heights);
  for (let i = 1; i <= heights.indexOf(peak); i++) expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1] - 1e-9);
  for (let i = heights.lastIndexOf(peak) + 1; i < heights.length; i++) expect(heights[i]).toBeLessThanOrEqual(heights[i - 1] + 1e-9);
});

test('draws a dumbbell in each hand, the far one behind the trunk', () => {
  for (const t of ticks()) {
    const { joints, prims } = figureAt(t);
    const handles = prims.filter((p) => p.kind === 'bone' && p.w === 1.8);
    const heads = prims.filter((p) => p.kind === 'bone' && p.w === 2.6);
    expect(handles).toHaveLength(2);
    expect(heads).toHaveLength(4);
    for (const hand of [joints.wr, joints.wf]) {
      expect(handles.some((h) => Math.abs((h.x1 + h.x2) / 2 - hand[0]) < 1e-9 && Math.abs(h.y1 - hand[1]) < 1e-9)).toBe(true);
    }
    // Paint order: the far bell and far hand come before the trunk, the near ones after it.
    const firstTrunkSlice = prims.findIndex((p) => p.kind === 'bone' && p.color === 'textLow' && p.opacity === 1 && p.w < 2);
    const farHandle = prims.findIndex((p) => p.kind === 'bone' && p.w === 1.8 && p.color === 'textLow');
    const nearHandle = prims.findIndex((p) => p.kind === 'bone' && p.w === 1.8 && p.color === 'textHi');
    const farHand = prims.findIndex((p) => p.kind === 'circle' && Math.abs(p.cx - joints.wf[0]) < 1e-9 && Math.abs(p.cy - joints.wf[1]) < 1e-9);
    expect(farHandle).toBeGreaterThanOrEqual(0);
    expect(farHandle).toBeLessThan(firstTrunkSlice);
    expect(farHand).toBeLessThan(firstTrunkSlice);
    expect(nearHandle).toBeGreaterThan(firstTrunkSlice);
  }
});

test('the stored keyframe joints are the drawn projection', () => {
  for (const frame of entry.frames) {
    const f = resolveFigureJoints(frame.joints, { ...entry, body: BODY });
    for (const key of ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'an', 'kf', 'af']) {
      expect(distance(frame.joints[key], f[key])).toBeLessThan(0.01);
    }
  }
});

test('no caption asserts the "pouring water" hand tilt, which is flagged for technique review and not drawn', () => {
  for (const frame of entry.frames) expect(frame.caption.toLowerCase()).not.toContain('pour');
  expect(entry.reason.toLowerCase()).toContain('pouring water');
});
