// Raises and flyes out to the sides, drawn from the 3D model turned so both
// arms show: Cable Seated Lateral Raise (162), Reverse Flyes (261) and Back
// Flyes - With Bands (131). Every bound below comes from the movement's own
// catalogue text, quoted beside it. Measured on the model: x forward, y up
// from the floor, z across the body toward the viewer.
import {
  BACK_FLYE_ANCHOR,
  CANONICAL_BODY_PARAMETERS,
  CHAIN_MOVEMENTS,
  REVERSE_FLYE_INCLINE,
  SEATED_CABLE_RAISE_LEAN,
  SEATED_CABLE_RAISE_PULLEYS,
  SIDE_RAISE_ELBOW_BEND,
  chainGeometry,
  layoutCanonicalFigure,
  poseAtTime,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = CANONICAL_BODY_PARAMETERS;
const BACK_HALF = BODY.sw * 0.58;
const THIGH_HALF = (BODY.lw * 1.18) / 2;
const deg = (rad) => (rad * 180) / Math.PI;
/** Straight-line distance between two points of any dimension. */
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const minus = (a, b) => a.map((v, i) => v - b[i]);
/** The angle between two 3D vectors. */
const angle3 = (a, b) => deg(Math.acos(Math.max(-1, Math.min(1, a.reduce((sum, v, i) => sum + v * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b))))));
/** How far the elbow is bent from straight. */
const bendOf = (arm) => angle3(minus(arm.elbow, arm.shoulder), minus(arm.wrist, arm.elbow));
const entryOf = (id) => previewManifest.entries.find((e) => e.movementId === id);
const slugOf = (entry) => entry.assetKey.split('/')[1];

/** Every 33 ms tick of the cycle, plus its exact end. */
function ticksOf(entry) {
  const total = entry.segmentDurationsMs.reduce((a, b) => a + b, 0);
  return [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];
}
/** The 3D model and the drawn primitives at time `t`. */
function figureAt(entry, t) {
  const pose = poseAtTime(entry.frames.map((f) => f.joints), t, entry.segmentDurationsMs);
  const figure = chainGeometry(slugOf(entry), pose.ph, BODY, pose.tw ?? 0);
  return { ...figure, prims: layoutCanonicalFigure(pose, { ...entry, body: BODY }) };
}
/** Keyframes are start, top, top after the pause, start, start. */
const topTime = (entry) => entry.segmentDurationsMs[0];
/** The cables or bands painted at time `t`, as pairs of screen points. */
const linesOf = (figure) => figure.prims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4)
  .map((p) => [[p.x1, p.y1], [p.x2, p.y2]]);

const entry162 = entryOf(162);
const entry261 = entryOf(261);
const entry131 = entryOf(131);
const ALL = [
  ['Cable Seated Lateral Raise', entry162],
  ['Reverse Flyes', entry261],
  ['Back Flyes - With Bands', entry131],
];

describe.each(ALL)('%s: shared mechanics', (_name, entry) => {
  const [up, pause, down] = entry.segmentDurationsMs;

  test('is drawn turned, and only the arms move, mirrored', () => {
    expect(entry.view).toBe('oblique');
    const start = figureAt(entry, 0);
    for (const t of ticksOf(entry)) {
      const now = figureAt(entry, t);
      for (const key of ['hd', 'nk', 'hp', 'kn', 'an', 'kf', 'af', 'nArm', 'fArm']) expect(now.joints[key]).toEqual(start.joints[key]);
      for (const part of ['elbow', 'wrist']) {
        expect(now.world.far[part][0]).toBeCloseTo(now.world.near[part][0], 9);
        expect(now.world.far[part][1]).toBeCloseTo(now.world.near[part][1], 9);
        expect(now.world.far[part][2]).toBeCloseTo(-now.world.near[part][2], 9);
      }
    }
  });

  test('the raise and the lowering are each one unbroken motion, with a pause between and the lowering the slower', () => {
    expect(entry.frames.map((f) => f.joints.ph)).toEqual([0, 1, 1, 0, 0]);
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(down).toBeGreaterThanOrEqual(1.3 * up);
    const moving = (from, to) => {
      for (let t = from + 33; t < to - 66; t += 33) {
        expect(distance(figureAt(entry, t).world.near.wrist, figureAt(entry, t + 33).world.near.wrist)).toBeGreaterThan(0.01);
      }
    };
    moving(0, up);
    moving(up + pause, up + pause + down);
    const held = [0, pause / 2, pause].map((dt) => figureAt(entry, up + dt).world.near.wrist);
    expect(held[1]).toEqual(held[0]);
    expect(held[2]).toEqual(held[0]);
  });
});

describe('Cable Seated Lateral Raise (162)', () => {
  const [near, far] = SEATED_CABLE_RAISE_PULLEYS;

  test('"Sit on the end of a flat bench between two low pulleys"', () => {
    const { world } = figureAt(entry162, 0);
    for (const side of [world.near, world.far]) {
      expect(side.knee[1]).toBeCloseTo(side.hipJoint[1], 9); // thighs level: seated
      expect(side.ankle[0]).toBeCloseTo(side.knee[0], 9); // shins down to feet flat on the floor
    }
    const slab = CHAIN_MOVEMENTS['cable-seated-lateral-raise'].equipment.find((s) => s.kind === 'slab');
    expect(slab.a[1] + 2).toBeCloseTo(world.hip[1] - THIGH_HALF, 6);
    expect(Math.max(slab.a[0], slab.b[0])).toBeGreaterThan(world.hip[0]); // under the hips,
    expect(Math.max(slab.a[0], slab.b[0])).toBeLessThan(world.near.knee[0]); // ending short of the knees: the end of the bench
    // One pulley each side, both low.
    expect(near[2]).toBeGreaterThanOrEqual(30);
    expect(far[2]).toBeLessThanOrEqual(-30);
    expect(near[1]).toBeLessThanOrEqual(10);
    expect(far[1]).toBeLessThanOrEqual(10);
  });

  test('"lean forward so the chest rests toward the thighs with the back flat"', () => {
    const top = figureAt(entry162, topTime(entry162));
    const lean = deg(Math.atan2(top.world.neck[1] - top.world.hip[1], top.world.neck[0] - top.world.hip[0]));
    expect(lean).toBeCloseTo(SEATED_CABLE_RAISE_LEAN, 6);
    expect(lean).toBeGreaterThanOrEqual(15); // well forward,
    expect(lean).toBeLessThanOrEqual(40); // the chest toward the thighs without lying on them
    expect(top.curled).toBe(false); // back flat
    expect(distance(top.world.hip, top.world.neck)).toBeCloseTo(24, 9);
  });

  test('"hold the left handle in the right hand and the right handle in the left": the cables cross', () => {
    for (const t of ticksOf(entry162)) {
      const figure = figureAt(entry162, t);
      const lines = linesOf(figure);
      expect(lines).toHaveLength(2);
      const toNear = lines.find((line) => distance(line[1], figure.hold.near) < 1e-9);
      const toFar = lines.find((line) => distance(line[1], figure.hold.far) < 1e-9);
      // Each hand's cable comes from the pulley on the other side.
      expect(toNear[0]).toEqual(figure.project([far[0], far[1], far[2]]));
      expect(toFar[0]).toEqual(figure.project([near[0], near[1], near[2]]));
    }
  });

  test('"With a slight, fixed bend in the elbows"', () => {
    const bend = SIDE_RAISE_ELBOW_BEND['cable-seated-lateral-raise'];
    expect(bend).toBeGreaterThan(0);
    expect(bend).toBeLessThanOrEqual(15);
    for (const t of ticksOf(entry162)) expect(bendOf(figureAt(entry162, t).world.near)).toBeCloseTo(bend, 6);
  });

  test('"raise the upper arms out to the sides until they are level with the shoulders"', () => {
    const start = figureAt(entry162, 0).world.near;
    expect(start.shoulder[1] - start.elbow[1]).toBeGreaterThanOrEqual(11); // hanging
    const top = figureAt(entry162, topTime(entry162)).world.near;
    expect(Math.abs(top.elbow[1] - top.shoulder[1])).toBeLessThanOrEqual(0.5); // level with the shoulders
    expect(top.elbow[2] - top.shoulder[2]).toBeGreaterThanOrEqual(12); // out to the side
    for (const t of ticksOf(entry162)) {
      const arm = figureAt(entry162, t).world.near;
      expect(arm.elbow[0]).toBeCloseTo(arm.shoulder[0], 9); // to the side only, never forward or back
    }
  });

  test('each cable only lengthens as its arm rises', () => {
    const lengths = ticksOf(entry162).filter((t) => t <= topTime(entry162)).map((t) => distance(far, figureAt(entry162, t).world.near.hold));
    for (let i = 1; i < lengths.length; i++) expect(lengths[i]).toBeGreaterThanOrEqual(lengths[i - 1] - 1e-9);
    expect(lengths.at(-1) - lengths[0]).toBeGreaterThan(10);
  });
});

describe('Reverse Flyes (261)', () => {
  const trunkOf = (world) => minus(world.neck, world.hip);

  test('"Lie chest-down on an incline bench": the chest is on the pad, the feet on the floor', () => {
    const { world } = figureAt(entry261, 0);
    const incline = deg(Math.atan2(world.neck[1] - world.hip[1], world.neck[0] - world.hip[0]));
    expect(incline).toBeCloseTo(REVERSE_FLYE_INCLINE, 6);
    expect(incline).toBeGreaterThanOrEqual(30);
    expect(incline).toBeLessThanOrEqual(60);
    const pad = CHAIN_MOVEMENTS['reverse-flyes'].equipment.find((s) => s.kind === 'slab');
    const ux = pad.b[0] - pad.a[0], uy = pad.b[1] - pad.a[1];
    expect(deg(Math.atan2(uy, ux))).toBeCloseTo(incline, 6); // the pad runs along the trunk
    // On the front of the body: below-forward of the spine, its face on the chest.
    const off = ((world.neck[0] - pad.a[0]) * uy - (world.neck[1] - pad.a[1]) * ux) / Math.hypot(ux, uy);
    expect(off + 2).toBeCloseTo(-BACK_HALF, 6);
    expect(world.near.ankle[0]).toBeLessThan(world.hip[0] - 10); // feet on the floor behind
  });

  test('"Extend the arms so they hang perpendicular to the bench angle"', () => {
    const { world } = figureAt(entry261, 0);
    // Square to the trunk, pointing down and forward off the chest, the hands close together.
    expect(angle3(minus(world.near.elbow, world.near.shoulder), trunkOf(world))).toBeCloseTo(90, 6);
    expect(world.near.elbow[1]).toBeLessThan(world.near.shoulder[1]);
    expect(world.near.wrist[2] - world.far.wrist[2]).toBeLessThanOrEqual(world.near.shoulder[2] - world.far.shoulder[2] + 3);
  });

  test('"Holding a slight bend at the elbows"', () => {
    const bend = SIDE_RAISE_ELBOW_BEND['reverse-flyes'];
    expect(bend).toBeGreaterThan(0);
    expect(bend).toBeLessThanOrEqual(15);
    for (const t of ticksOf(entry261)) expect(bendOf(figureAt(entry261, t).world.near)).toBeCloseTo(bend, 6);
  });

  test('"move the weights out and away from each other in an arc until the arms are parallel to the floor"', () => {
    const start = figureAt(entry261, 0).world;
    const top = figureAt(entry261, topTime(entry261)).world;
    expect(Math.abs(top.near.elbow[1] - top.near.shoulder[1])).toBeLessThanOrEqual(0.6); // parallel to the floor
    expect(top.near.wrist[2] - top.far.wrist[2]).toBeGreaterThanOrEqual(start.near.wrist[2] - start.far.wrist[2] + 35); // apart
    // An arc: the upper arm stays square to the trunk and the hand the same distance from the shoulder all the way.
    const reach = distance(start.near.shoulder, start.near.wrist);
    const spreads = [];
    for (const t of ticksOf(entry261).filter((tick) => tick <= topTime(entry261))) {
      const { world } = figureAt(entry261, t);
      expect(angle3(minus(world.near.elbow, world.near.shoulder), trunkOf(world))).toBeCloseTo(90, 6);
      expect(distance(world.near.shoulder, world.near.wrist)).toBeCloseTo(reach, 9);
      spreads.push(world.near.wrist[2]);
    }
    for (let i = 1; i < spreads.length; i++) expect(spreads[i]).toBeGreaterThanOrEqual(spreads[i - 1] - 1e-9);
  });

  test('"a dumbbell in each hand, palms facing each other": each bell is seen along its length, lying along the body', () => {
    for (const t of ticksOf(entry261)) {
      const figure = figureAt(entry261, t);
      const handles = figure.prims.filter((p) => p.kind === 'bone' && p.w === 1.8);
      expect(handles).toHaveLength(2);
      const trunk = minus(figure.joints.nk, figure.joints.hp);
      for (const hand of [figure.hold.near, figure.hold.far]) {
        const handle = handles.find((p) => Math.abs((p.x1 + p.x2) / 2 - hand[0]) < 1e-9 && Math.abs((p.y1 + p.y2) / 2 - hand[1]) < 1e-9);
        expect(handle).toBeDefined();
        // On screen the handle runs the way the trunk does.
        const cross = (handle.x2 - handle.x1) * trunk[1] - (handle.y2 - handle.y1) * trunk[0];
        expect(Math.abs(cross)).toBeLessThan(1e-6);
      }
    }
  });
});

describe('Back Flyes - With Bands (131)', () => {
  const anchor = [BACK_FLYE_ANCHOR[0], BACK_FLYE_ANCHOR[1], 0];

  test('"Loop a band around a rack upright ... arms straight in front at shoulder height"', () => {
    const figure = figureAt(entry131, 0);
    const { world } = figure;
    expect(world.neck[0]).toBeCloseTo(world.hip[0], 9); // standing tall
    for (const side of [world.near, world.far]) {
      expect(side.elbow[1]).toBeCloseTo(side.shoulder[1], 9);
      expect(side.wrist[1]).toBeCloseTo(side.shoulder[1], 9);
      expect(side.wrist[0] - side.shoulder[0]).toBeCloseTo(24.5, 9); // straight out in front
      expect(side.wrist[2]).toBeCloseTo(side.shoulder[2], 9);
    }
    // The upright is in front, the band looped round it at shoulder height.
    expect(anchor[0]).toBeGreaterThan(world.near.wrist[0] + 10);
    expect(Math.abs(anchor[1] - world.near.shoulder[1])).toBeLessThanOrEqual(1);
    const upright = CHAIN_MOVEMENTS['back-flyes-with-bands'].equipment.find((s) => s.kind === 'frame' && s.a[0] === s.b[0]);
    expect(upright.a[0]).toBe(anchor[0]);
    expect(Math.min(upright.a[1], upright.b[1])).toBeLessThan(2); // from the floor
    expect(Math.max(upright.a[1], upright.b[1])).toBeGreaterThan(anchor[1] + 10); // to above the shoulders
  });

  test('"take an end in each hand and step back until the band is taut": an end of the band from the upright to each hand', () => {
    for (const t of ticksOf(entry131)) {
      const figure = figureAt(entry131, t);
      const lines = linesOf(figure);
      expect(lines).toHaveLength(2);
      for (const line of lines) expect(line[0]).toEqual(figure.project(anchor));
      expect(lines.some((line) => distance(line[1], figure.hold.near) < 1e-9)).toBe(true);
      expect(lines.some((line) => distance(line[1], figure.hold.far) < 1e-9)).toBe(true);
    }
    expect(distance(anchor, figureAt(entry131, 0).world.near.hold)).toBeGreaterThan(20); // stepped back
  });

  test('"Keeping the arms straight and level with the floor", on every tick', () => {
    for (const t of ticksOf(entry131)) {
      const { world } = figureAt(entry131, t);
      for (const side of [world.near, world.far]) {
        expect(bendOf(side)).toBeLessThan(1e-4);
        expect(side.elbow[1]).toBeCloseTo(side.shoulder[1], 9);
        expect(side.wrist[1]).toBeCloseTo(side.shoulder[1], 9);
      }
    }
  });

  test('"pull the hands apart and back until the arms are out to the sides"', () => {
    const start = figureAt(entry131, 0).world;
    const top = figureAt(entry131, topTime(entry131)).world;
    expect(top.near.wrist[0]).toBeCloseTo(top.near.shoulder[0], 6); // back, level with the shoulders
    expect(top.near.wrist[2] - top.near.shoulder[2]).toBeCloseTo(24.5, 6); // out to the side
    expect(top.near.wrist[2] - top.far.wrist[2]).toBeGreaterThan(start.near.wrist[2] - start.far.wrist[2] + 45); // apart
  });

  test('"let the hands return slowly to the front": the band stretches on the way out and never goes slack', () => {
    const length = (t) => distance(anchor, figureAt(entry131, t).world.near.hold);
    const out = ticksOf(entry131).filter((t) => t <= topTime(entry131)).map(length);
    for (let i = 1; i < out.length; i++) expect(out[i]).toBeGreaterThanOrEqual(out[i - 1] - 1e-9);
    expect(out.at(-1) - out[0]).toBeGreaterThan(20);
    for (const t of ticksOf(entry131)) expect(length(t)).toBeGreaterThanOrEqual(out[0] - 1e-9);
  });
});

test('the three are three drawings: seated and leaning, lying on an incline, and standing', () => {
  const [seated, incline, standing] = ALL.map(([, e]) => figureAt(e, 0).world);
  const lean = (world) => deg(Math.atan2(world.neck[1] - world.hip[1], world.neck[0] - world.hip[0]));
  expect(lean(standing)).toBeCloseTo(90, 6);
  expect(lean(incline)).toBeGreaterThan(lean(seated) + 10);
  expect(lean(standing)).toBeGreaterThan(lean(incline) + 30);
  expect(seated.near.knee[1]).toBeCloseTo(seated.near.hipJoint[1], 9); // only the first is sitting
  expect(incline.near.knee[1]).toBeLessThan(incline.near.hipJoint[1] - 10);
});
