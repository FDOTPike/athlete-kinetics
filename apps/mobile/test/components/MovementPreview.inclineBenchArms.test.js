// Arm work sitting back on an incline bench, side view: Incline Dumbbell Curl
// (219), Incline Hammer Curls (221), Front Incline Dumbbell Raise (207) and
// Cable Incline Triceps Extension (155). Every bound below comes from the
// movement's own catalogue text, quoted beside it. Angles and lengths are
// measured on the model, where the figure faces +x and heights are above the floor.
import {
  CANONICAL_BODY_PARAMETERS,
  CHAIN_MOVEMENTS,
  INCLINE_EXTENSION_PULLEY,
  chainGeometry,
  layoutCanonicalFigure,
  poseAtTime,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = CANONICAL_BODY_PARAMETERS;
const deg = (rad) => (rad * 180) / Math.PI;
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
/** The direction of a segment in the side plane: 0 forward, 90 straight up, -90 straight down. */
const direction = (from, to) => deg(Math.atan2(to[1] - from[1], to[0] - from[0]));
/** The angle at the elbow: 180 is a straight arm. */
const elbowAngle = (arm) => {
  const a = [arm.shoulder[0] - arm.elbow[0], arm.shoulder[1] - arm.elbow[1]];
  const b = [arm.wrist[0] - arm.elbow[0], arm.wrist[1] - arm.elbow[1]];
  return deg(Math.acos((a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b))));
};
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
  const figure = chainGeometry(slugOf(entry), pose.ph, BODY);
  return { ...figure, prims: layoutCanonicalFigure(pose, { ...entry, body: BODY }) };
}
const topTime = (entry) => entry.segmentDurationsMs[0] + entry.segmentDurationsMs[1];
/** The back pad of the bench: the long slab that is not level. */
const backPad = (slug) => CHAIN_MOVEMENTS[slug].equipment.find((s) => s.kind === 'slab' && Math.abs(s.a[1] - s.b[1]) > 1);
const seatPad = (slug) => CHAIN_MOVEMENTS[slug].equipment.find((s) => s.kind === 'slab' && Math.abs(s.a[1] - s.b[1]) < 1e-9);
/** How far a point is from the line through a slab, and how far along the slab it sits (0 to 1). */
function againstPad(pad, point) {
  const ux = pad.b[0] - pad.a[0], uy = pad.b[1] - pad.a[1];
  const length = Math.hypot(ux, uy);
  const px = point[0] - pad.a[0], py = point[1] - pad.a[1];
  return { off: Math.abs(px * uy - py * ux) / length, along: (px * ux + py * uy) / (length * length) };
}

const entry219 = entryOf(219);
const entry221 = entryOf(221);
const entry207 = entryOf(207);
const entry155 = entryOf(155);

describe.each([
  ['Incline Dumbbell Curl', entry219],
  ['Incline Hammer Curls', entry221],
  ['Front Incline Dumbbell Raise', entry207],
  ['Cable Incline Triceps Extension', entry155],
])('%s: sitting back on an incline bench', (_name, entry) => {
  const slug = slugOf(entry);

  test('the athlete sits on the seat with level thighs and feet flat, leaning back against the pad', () => {
    const { world } = figureAt(entry, 0);
    // Reclined: the trunk leans back from upright, and is nowhere near lying flat.
    const trunk = direction(world.hip, world.neck);
    expect(trunk).toBeGreaterThanOrEqual(115);
    expect(trunk).toBeLessThanOrEqual(150);
    for (const side of [world.near, world.far]) {
      expect(side.knee[1]).toBeCloseTo(side.hipJoint[1], 9);
      expect(side.knee[0]).toBeGreaterThan(side.hipJoint[0] + 20);
      expect(side.ankle[0]).toBeCloseTo(side.knee[0], 9);
    }
    // The back pad lies along the back: parallel to the trunk, touching it, and long enough for the head.
    const pad = backPad(slug);
    expect(direction(pad.a, pad.b)).toBeCloseTo(trunk, 6);
    const backHalf = BODY.sw * 0.58;
    for (const point of [world.hip, world.neck]) {
      expect(againstPad(pad, point).off - 2).toBeCloseTo(backHalf, 6); // the pad's face is on the back
    }
    const head = againstPad(pad, world.head);
    expect(head.along).toBeGreaterThan(0);
    expect(head.along).toBeLessThan(1);
    // The seat is just under the thighs.
    const seat = seatPad(slug);
    const thighUnderside = world.hip[1] - (BODY.lw * 1.18) / 2;
    expect(seat.a[1] + 2).toBeCloseTo(thighUnderside, 6);
  });

  test('the back, head and legs do not move; only the arms do', () => {
    const start = figureAt(entry, 0).joints;
    for (const t of ticksOf(entry)) {
      const { joints } = figureAt(entry, t);
      for (const key of ['hd', 'nk', 'hp', 'kn', 'an', 'kf', 'af', 'nArm', 'fArm']) expect(joints[key]).toEqual(start[key]);
    }
  });

  test('both arms do the same thing', () => {
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      for (const key of ['elbow', 'wrist']) {
        expect(world.far[key][0]).toBeCloseTo(world.near[key][0], 9);
        expect(world.far[key][1]).toBeCloseTo(world.near[key][1], 9);
      }
    }
  });
});

describe('Incline Dumbbell Curl (219)', () => {
  test('"arms hanging straight down" at the start, and again at the end', () => {
    for (const t of [0, ticksOf(entry219).at(-1)]) {
      const { world } = figureAt(entry219, t);
      expect(direction(world.near.shoulder, world.near.elbow)).toBeCloseTo(-90, 9);
      expect(direction(world.near.elbow, world.near.wrist)).toBeCloseTo(-90, 9);
    }
  });

  test('"Keeping the upper arms still, curl the dumbbells up to shoulder height"', () => {
    const start = figureAt(entry219, 0).world.near;
    for (const t of ticksOf(entry219)) {
      expect(figureAt(entry219, t).world.near.elbow).toEqual(start.elbow);
    }
    const top = figureAt(entry219, topTime(entry219)).world.near;
    // The bell is 2.8 either side of the hand: at the top it reaches the shoulder line.
    expect(top.shoulder[1] - top.wrist[1]).toBeGreaterThanOrEqual(0);
    expect(top.shoulder[1] - top.wrist[1]).toBeLessThanOrEqual(2.8);
    expect(top.wrist[0]).toBeGreaterThan(top.shoulder[0]); // in front of the shoulder, not folded onto it
  });

  test('"Pause, then lower slowly until the arms are straight"', () => {
    const [upA, upB, pause, down] = entry219.segmentDurationsMs;
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(down).toBeGreaterThanOrEqual(1.5 * (upA + upB));
    const held = [0, pause / 2, pause].map((dt) => figureAt(entry219, upA + upB + dt).world.near.wrist);
    expect(held[1]).toEqual(held[0]);
    expect(held[2]).toEqual(held[0]);
    expect(elbowAngle(figureAt(entry219, upA + upB + pause + down).world.near)).toBeCloseTo(180, 4);
  });

  test('"palms facing forward": a dumbbell in each hand, read end-on', () => {
    for (const t of ticksOf(entry219)) {
      const { joints, prims } = figureAt(entry219, t);
      const bells = prims.filter((p) => p.kind === 'rect' && p.w === 5.6 && p.h === 5.6);
      expect(bells).toHaveLength(2);
      for (const hand of [joints.wr, joints.wf]) {
        expect(bells.some((b) => Math.abs(b.x + 2.8 - hand[0]) < 1e-9 && Math.abs(b.y + 2.8 - hand[1]) < 1e-9)).toBe(true);
      }
    }
  });
});

describe('Incline Hammer Curls (221)', () => {
  test('"arms hanging straight down" and "Keeping the upper arms still"', () => {
    const start = figureAt(entry221, 0).world.near;
    expect(direction(start.shoulder, start.elbow)).toBeCloseTo(-90, 9);
    expect(direction(start.elbow, start.wrist)).toBeCloseTo(-90, 9);
    for (const t of ticksOf(entry221)) expect(figureAt(entry221, t).world.near.elbow).toEqual(start.elbow);
  });

  test('"bend the elbows to curl the dumbbells up": the hands finish above the elbows, in front of the shoulders', () => {
    const top = figureAt(entry221, topTime(entry221)).world.near;
    expect(elbowAngle(top)).toBeLessThanOrEqual(50);
    expect(top.wrist[1]).toBeGreaterThan(top.elbow[1] + 6);
    expect(top.wrist[0]).toBeGreaterThan(top.shoulder[0]);
  });

  test('"palms facing each other" for the whole rep: each bell is seen along its length, square to its forearm', () => {
    for (const t of ticksOf(entry221)) {
      const { joints, prims } = figureAt(entry221, t);
      expect(prims.filter((p) => p.kind === 'rect' && p.w === 5.6)).toHaveLength(0); // never end-on
      for (const [hand, elbow] of [[joints.wr, joints.el], [joints.wf, joints.ef]]) {
        const shaft = prims.find((p) => p.kind === 'bone' && p.w === 2.2
          && Math.abs((p.x1 + p.x2) / 2 - hand[0]) < 1e-9 && Math.abs((p.y1 + p.y2) / 2 - hand[1]) < 1e-9);
        expect(shaft).toBeDefined();
        const along = (shaft.x2 - shaft.x1) * (hand[0] - elbow[0]) + (shaft.y2 - shaft.y1) * (hand[1] - elbow[1]);
        expect(Math.abs(along)).toBeLessThan(1e-9);
      }
    }
  });

  test('"Pause at the top, then lower slowly until the arms are straight"', () => {
    const [upA, upB, pause, down] = entry221.segmentDurationsMs;
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(down).toBeGreaterThanOrEqual(1.5 * (upA + upB));
    expect(elbowAngle(figureAt(entry221, upA + upB + pause + down).world.near)).toBeCloseTo(180, 4);
  });
});

describe('Front Incline Dumbbell Raise (207)', () => {
  test('"an incline bench set between thirty and sixty degrees"', () => {
    const { world } = figureAt(entry207, 0);
    const incline = 180 - direction(world.hip, world.neck);
    expect(incline).toBeGreaterThanOrEqual(30);
    expect(incline).toBeLessThanOrEqual(60);
  });

  test('"Extend the arms straight in front of you ... dumbbells just above the thighs"', () => {
    const { world } = figureAt(entry207, 0);
    const thighTop = world.near.hipJoint[1] + (BODY.lw * 1.18) / 2;
    const bellUnderside = world.near.wrist[1] - 2.8;
    expect(bellUnderside).toBeGreaterThan(thighTop);
    expect(bellUnderside - thighTop).toBeLessThanOrEqual(3);
    expect(world.near.wrist[0]).toBeGreaterThan(world.near.hipJoint[0]); // over the thighs
    expect(world.near.wrist[0]).toBeLessThan(world.near.knee[0]);
  });

  test('"Keeping the elbows locked" on every tick', () => {
    for (const t of ticksOf(entry207)) {
      const arm = figureAt(entry207, t).world.near;
      // Locked: the forearm carries straight on from the upper arm.
      expect(direction(arm.elbow, arm.wrist)).toBeCloseTo(direction(arm.shoulder, arm.elbow), 9);
    }
  });

  test('"raise the dumbbells straight up until they are slightly above shoulder height"', () => {
    const top = figureAt(entry207, topTime(entry207)).world.near;
    expect(top.wrist[1]).toBeGreaterThan(top.shoulder[1]);
    expect(top.wrist[1] - top.shoulder[1]).toBeLessThanOrEqual(5);
    // The hands only rise on the way up.
    const heights = ticksOf(entry207).filter((t) => t <= topTime(entry207)).map((t) => figureAt(entry207, t).world.near.wrist[1]);
    for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1] - 1e-9);
  });

  test('"Squeeze for a second, then lower back to the start"', () => {
    const [upA, upB, hold] = entry207.segmentDurationsMs;
    expect(hold).toBeGreaterThanOrEqual(1000);
    const held = [0, hold / 2, hold].map((dt) => figureAt(entry207, upA + upB + dt).world.near.wrist);
    expect(held[1]).toEqual(held[0]);
    expect(held[2]).toEqual(held[0]);
  });

  test('"Keep the head resting on the bench": the back of the head meets the pad', () => {
    const { world } = figureAt(entry207, topTime(entry207));
    const padFace = againstPad(backPad('front-incline-dumbbell-raise'), world.head).off - 2;
    expect(padFace).toBeLessThanOrEqual(BODY.hr);
    expect(padFace).toBeGreaterThan(BODY.hr - 1);
  });

  test('"palms facing down": a dumbbell in each hand, read end-on', () => {
    for (const t of ticksOf(entry207)) {
      expect(figureAt(entry207, t).prims.filter((p) => p.kind === 'rect' && p.w === 5.6 && p.h === 5.6)).toHaveLength(2);
    }
  });
});

describe('Cable Incline Triceps Extension (155)', () => {
  test('"facing away from a high pulley": the pulley is behind the athlete and above the head', () => {
    const { world } = figureAt(entry155, 0);
    expect(INCLINE_EXTENSION_PULLEY[0]).toBeLessThan(world.head[0] - 15);
    expect(INCLINE_EXTENSION_PULLEY[1]).toBeGreaterThan(world.head[1] + BODY.hr + 10);
    // The athlete faces +x: the toes point away from the pulley.
    expect(world.near.toe[0]).toBeGreaterThan(world.near.ankle[0]);
  });

  test('"take the straight bar overhead ... elbows bent": the hands start above the head with the elbows at a right angle', () => {
    const { world } = figureAt(entry155, 0);
    expect(world.near.wrist[1]).toBeGreaterThan(world.head[1] + BODY.hr);
    expect(elbowAngle(world.near)).toBeCloseTo(90, 6);
  });

  test('"Keeping the upper arms still": the elbows stay up beside the head for the whole rep', () => {
    const start = figureAt(entry155, 0).world;
    // Up beside the head: the elbow is at head height, the upper arm within 35 degrees of vertical.
    expect(start.near.elbow[1]).toBeGreaterThan(start.head[1] - BODY.hr);
    expect(start.near.elbow[1]).toBeLessThan(start.head[1] + BODY.hr);
    expect(Math.abs(90 - direction(start.near.shoulder, start.near.elbow))).toBeLessThanOrEqual(35);
    for (const t of ticksOf(entry155)) expect(figureAt(entry155, t).world.near.elbow).toEqual(start.near.elbow);
  });

  test('"straighten the elbows until the arms are fully extended"', () => {
    expect(elbowAngle(figureAt(entry155, topTime(entry155)).world.near)).toBeCloseTo(180, 4);
  });

  test('"Pause, then let the bar return slowly until the elbows are bent again"', () => {
    const [upA, upB, pause, down] = entry155.segmentDurationsMs;
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(down).toBeGreaterThanOrEqual(1.5 * (upA + upB));
    expect(elbowAngle(figureAt(entry155, upA + upB + pause + down).world.near)).toBeCloseTo(90, 5);
  });

  test('one cable runs from the pulley to the bar, and extending the arms only ever lengthens it', () => {
    const lengths = [];
    for (const t of ticksOf(entry155)) {
      const { joints, prims, project } = figureAt(entry155, t);
      const cables = prims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4);
      expect(cables).toHaveLength(1);
      const pulley = project([INCLINE_EXTENSION_PULLEY[0], INCLINE_EXTENSION_PULLEY[1], 0]);
      expect([cables[0].x1, cables[0].y1]).toEqual(pulley);
      expect([cables[0].x2, cables[0].y2]).toEqual(joints.wr);
      if (t <= topTime(entry155)) lengths.push(distance(pulley, joints.wr));
    }
    for (let i = 1; i < lengths.length; i++) expect(lengths[i]).toBeGreaterThanOrEqual(lengths[i - 1] - 1e-9);
    expect(lengths.at(-1) - lengths[0]).toBeGreaterThan(5);
  });
});

test('the four incline movements are four drawings, not one drawing with new captions', () => {
  const tops = [entry219, entry221, entry207, entry155].map((e) => figureAt(e, topTime(e)));
  for (let i = 0; i < tops.length; i++) {
    for (let k = i + 1; k < tops.length; k++) {
      const same = ['hd', 'nk', 'hp', 'el', 'wr'].every((key) => distance(tops[i].joints[key], tops[k].joints[key]) < 1e-6);
      expect(same).toBe(false);
    }
  }
  // The two curls share a bench and a start; they differ in the grip and at the top.
  expect(distance(tops[0].joints.wr, tops[1].joints.wr)).toBeGreaterThan(1.5);
  expect(entry219.segmentDurationsMs).not.toEqual(entry221.segmentDurationsMs);
});
