// Curls with the arm supported, and the wrist curls: Spider Curl (276),
// Concentration Curls (171), Seated Dumbbell Palms-Down Wrist Curl (268),
// Seated Dumbbell Palms-Up Wrist Curl (269) and Cable Wrist Curl (164). Every
// bound below comes from the movement's own catalogue text, quoted beside it.
// Angles and lengths are measured on the 3D model: x forward, y up from the
// floor, z across the body toward the viewer.
import {
  CABLE_WRIST_CURL_PULLEY,
  CANONICAL_BODY_PARAMETERS,
  CHAIN_MOVEMENTS,
  SPIDER_CURL_UPPER_ARM,
  chainGeometry,
  layoutCanonicalFigure,
  poseAtTime,
  spiderCurlPad,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = CANONICAL_BODY_PARAMETERS;
const THIGH_HALF = (BODY.lw * 1.18) / 2;
const UPPER_ARM_HALF = (BODY.lw * 0.88) / 2;
const FOREARM_HALF = (BODY.lw * 0.72) / 2;
const deg = (rad) => (rad * 180) / Math.PI;
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
/** The direction of a segment in the side plane: 0 forward, 90 straight up, -90 straight down. */
const direction = (from, to) => deg(Math.atan2(to[1] - from[1], to[0] - from[0]));
/** The angle at the elbow, in 3D: 180 is a straight arm. */
const elbowAngle = (arm) => {
  const a = arm.shoulder.map((v, i) => v - arm.elbow[i]);
  const b = arm.wrist.map((v, i) => v - arm.elbow[i]);
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  return deg(Math.acos(Math.max(-1, Math.min(1, dot / (Math.hypot(...a) * Math.hypot(...b))))));
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
/** Keyframes are start, top, top after the hold, start, start. */
const topTime = (entry) => entry.segmentDurationsMs[0];

const entry276 = entryOf(276);
const entry171 = entryOf(171);
const entry268 = entryOf(268);
const entry269 = entryOf(269);
const entry164 = entryOf(164);
const ALL = [
  ['Spider Curl', entry276],
  ['Concentration Curls', entry171],
  ['Seated Dumbbell Palms-Down Wrist Curl', entry268],
  ['Seated Dumbbell Palms-Up Wrist Curl', entry269],
  ['Cable Wrist Curl', entry164],
];

describe.each(ALL)('%s: shared mechanics', (_name, entry) => {
  test('the upper arm and elbow do not move, and neither does the body', () => {
    const start = figureAt(entry, 0);
    for (const t of ticksOf(entry)) {
      const now = figureAt(entry, t);
      expect(now.world.near.elbow).toEqual(start.world.near.elbow);
      expect(now.world.far.elbow).toEqual(start.world.far.elbow);
      for (const key of ['hd', 'nk', 'hp', 'kn', 'an', 'kf', 'af', 'el', 'ef']) expect(now.joints[key]).toEqual(start.joints[key]);
    }
  });

  test('the lift and the lowering are each one unbroken motion, and the lowering is the slower', () => {
    const [up, hold, down] = entry.segmentDurationsMs;
    expect(entry.frames.map((f) => f.joints.ph)).toEqual([0, 1, 1, 0, 0]);
    expect(down).toBeGreaterThanOrEqual(1.5 * up); // "lower slowly"
    const moving = (from, to) => {
      for (let t = from + 33; t < to - 66; t += 33) {
        expect(distance(figureAt(entry, t).hold.near, figureAt(entry, t + 33).hold.near)).toBeGreaterThan(0.005);
      }
    };
    moving(0, up);
    moving(up + hold, up + hold + down);
  });
});

describe('Spider Curl (276)', () => {
  const pad = spiderCurlPad();

  test('"Lie with the chest and stomach against the angled side of a preacher bench, feet on the floor"', () => {
    const { world } = figureAt(entry276, 0);
    const lean = direction(world.hip, world.neck);
    expect(lean).toBeGreaterThanOrEqual(30); // leaning well forward onto the pad, not standing and not lying flat
    expect(lean).toBeLessThanOrEqual(60);
    // The angled face runs along the front of the trunk and touches it.
    expect(direction(pad.angled[0], pad.angled[1])).toBeCloseTo(lean, 6);
    const ux = pad.angled[1][0] - pad.angled[0][0], uy = pad.angled[1][1] - pad.angled[0][1];
    const off = (point) => ((point[0] - pad.angled[0][0]) * uy - (point[1] - pad.angled[0][1]) * ux) / Math.hypot(ux, uy);
    expect(off(world.hip) + 2).toBeCloseTo(-(BODY.sw * 0.58), 6); // the pad's face is on the front of the body
    // Feet on the floor, behind the hips.
    expect(world.near.ankle[0]).toBeLessThan(world.hip[0] - 10);
  });

  test('"upper arms resting on the pad": they lie down its far side, backs against it', () => {
    // The two faces join at the top of the pad.
    expect(pad.rest[0]).toEqual(pad.angled[1]);
    const ux = pad.rest[1][0] - pad.rest[0][0], uy = pad.rest[1][1] - pad.rest[0][1];
    const length = Math.hypot(ux, uy);
    for (const t of ticksOf(entry276)) {
      const { world } = figureAt(entry276, t);
      const { shoulder, elbow } = world.near;
      // The upper arm runs parallel to the far face.
      expect(direction(shoulder, elbow)).toBeCloseTo(direction(pad.rest[0], pad.rest[1]), 6);
      expect(direction(shoulder, elbow)).toBeCloseTo(SPIDER_CURL_UPPER_ARM, 6);
      // Its back is on the face: one arm half-width off the pad's surface.
      const off = Math.abs((elbow[0] - pad.rest[0][0]) * uy - (elbow[1] - pad.rest[0][1]) * ux) / length;
      expect(off - 2).toBeCloseTo(UPPER_ARM_HALF, 6);
      // The elbow end of the upper arm lies on the pad, the pad carrying on past the elbow.
      const elbowAlong = ((elbow[0] - pad.rest[0][0]) * ux + (elbow[1] - pad.rest[0][1]) * uy) / length;
      expect(elbowAlong).toBeGreaterThanOrEqual(4);
      expect(elbowAlong).toBeLessThan(length);
    }
  });

  test('"arms straight" at the start and the end; "curl the bar up as far as you can" at the top', () => {
    for (const t of [0, ticksOf(entry276).at(-1)]) expect(elbowAngle(figureAt(entry276, t).world.near)).toBeCloseTo(180, 4);
    const top = figureAt(entry276, topTime(entry276)).world.near;
    expect(elbowAngle(top)).toBeLessThanOrEqual(75);
    expect(top.wrist[1]).toBeGreaterThan(top.elbow[1] + 5);
    expect(top.wrist[1]).toBeGreaterThan(top.shoulder[1]); // the bar finishes above the shoulders
  });

  test('"Squeeze, then lower slowly": a hold at the top', () => {
    const [up, squeeze] = entry276.segmentDurationsMs;
    expect(squeeze).toBeGreaterThanOrEqual(400);
    const held = [0, squeeze / 2, squeeze].map((dt) => figureAt(entry276, up + dt).world.near.wrist);
    expect(held[1]).toEqual(held[0]);
    expect(held[2]).toEqual(held[0]);
  });

  test('"the bar": one barbell through both hands, read end-on', () => {
    for (const t of ticksOf(entry276)) {
      const { joints, prims } = figureAt(entry276, t);
      const plates = prims.filter((p) => p.kind === 'circle' && p.r === 6.6);
      expect(plates).toHaveLength(1);
      expect([plates[0].cx, plates[0].cy]).toEqual(joints.wr);
    }
  });
});

describe('Concentration Curls (171)', () => {
  test('"Sit on a flat bench with the feet wide"', () => {
    const { world } = figureAt(entry171, 0);
    for (const side of [world.near, world.far]) expect(side.knee[1]).toBeCloseTo(side.hipJoint[1], 9); // thighs level: seated
    // Wide: the feet are much further apart than the hips.
    const hips = world.near.hipJoint[2] - world.far.hipJoint[2];
    const feet = world.near.ankle[2] - world.far.ankle[2];
    expect(feet).toBeGreaterThan(hips + 20);
    // The bench is under the hips.
    const slab = CHAIN_MOVEMENTS['concentration-curls'].equipment.find((s) => s.kind === 'slab');
    expect(slab.a[1] + 2).toBeCloseTo(world.hip[1] - THIGH_HALF, 6);
    expect(Math.min(slab.a[0], slab.b[0])).toBeLessThan(world.hip[0]);
    expect(Math.max(slab.a[0], slab.b[0])).toBeGreaterThan(world.hip[0]);
  });

  test('"rest the back of that upper arm against the inner thigh"', () => {
    const { world } = figureAt(entry171, 0);
    const { hipJoint, knee, elbow } = world.near;
    // Where the thigh's centre line is at the elbow's distance forward.
    const k = (elbow[0] - hipJoint[0]) / (knee[0] - hipJoint[0]);
    expect(k).toBeGreaterThan(0.5); // down toward the knee end of the thigh
    expect(k).toBeLessThan(1);
    const thighZ = hipJoint[2] + (knee[2] - hipJoint[2]) * k;
    // The arm is on the inside of the thigh and its surface meets the thigh's inner surface.
    expect(elbow[2]).toBeLessThan(thighZ);
    expect(Math.abs((thighZ - THIGH_HALF) - (elbow[2] + UPPER_ARM_HALF))).toBeLessThanOrEqual(2);
    // At thigh height.
    expect(Math.abs(elbow[1] - hipJoint[1])).toBeLessThanOrEqual(THIGH_HALF + UPPER_ARM_HALF + 1);
  });

  test('"with the arm straight" at the start, "curl the dumbbell up toward the shoulder" at the top', () => {
    const start = figureAt(entry171, 0).world.near;
    expect(elbowAngle(start)).toBeCloseTo(180, 4);
    const top = figureAt(entry171, topTime(entry171)).world.near;
    expect(distance(top.wrist, top.shoulder)).toBeLessThanOrEqual(8);
    expect(distance(top.wrist, top.shoulder)).toBeLessThan(distance(start.wrist, start.shoulder) / 3);
    expect(top.wrist[1]).toBeLessThan(top.shoulder[1]); // toward it, not past it
  });

  test('"hold one dumbbell": one bell, in the working hand; the other hand rests on the other knee', () => {
    for (const t of ticksOf(entry171)) {
      const { world, prims, hold } = figureAt(entry171, t);
      const handles = prims.filter((p) => p.kind === 'bone' && p.w === 1.8);
      expect(handles).toHaveLength(1);
      expect((handles[0].x1 + handles[0].x2) / 2).toBeCloseTo(hold.near[0], 9);
      expect((handles[0].y1 + handles[0].y2) / 2).toBeCloseTo(hold.near[1], 9);
      expect(distance(world.far.wrist, world.far.knee)).toBeLessThanOrEqual(THIGH_HALF + 5);
      expect(world.far.wrist[1]).toBeGreaterThan(world.far.knee[1]);
    }
  });

  test('"Squeeze, then lower slowly until the arm is straight. Complete the repetitions, then change arms."', () => {
    const [up, squeeze, down] = entry171.segmentDurationsMs;
    expect(squeeze).toBeGreaterThanOrEqual(400);
    expect(elbowAngle(figureAt(entry171, up + squeeze + down).world.near)).toBeCloseTo(180, 4);
    expect(entry171.frames.at(-1).caption).toContain('change arms');
  });
});

describe.each([
  ['Seated Dumbbell Palms-Down Wrist Curl', entry268],
  ['Seated Dumbbell Palms-Up Wrist Curl', entry269],
  ['Cable Wrist Curl', entry164],
])('%s: forearms on the thighs', (_name, entry) => {
  test('"Sit on" a bench "with the forearms resting on the thighs ... and the wrists just past the knees"', () => {
    const { world } = figureAt(entry, 0);
    for (const side of [world.near, world.far]) {
      expect(side.knee[1]).toBeCloseTo(side.hipJoint[1], 9); // thighs level: seated
      // The forearm is level and its underside is on the top of the thigh.
      expect(side.wrist[1]).toBeCloseTo(side.elbow[1], 9);
      expect(side.elbow[1] - FOREARM_HALF).toBeCloseTo(side.hipJoint[1] + THIGH_HALF, 9);
      expect(side.elbow[0]).toBeGreaterThan(side.hipJoint[0]);
      expect(side.elbow[0]).toBeLessThan(side.knee[0]);
      expect(side.wrist[0]).toBeGreaterThan(side.knee[0]);
      expect(side.wrist[0] - side.knee[0]).toBeLessThanOrEqual(6);
    }
    // The bench is under the hips and stops short of the knees: the athlete is on its edge.
    const slab = CHAIN_MOVEMENTS[slugOf(entry)].equipment.find((s) => s.kind === 'slab');
    expect(slab.a[1] + 2).toBeCloseTo(world.hip[1] - THIGH_HALF, 6);
    expect(Math.max(slab.a[0], slab.b[0])).toBeGreaterThan(world.hip[0]);
    expect(Math.max(slab.a[0], slab.b[0])).toBeLessThan(world.hip[0] + 10);
  });

  test('"Keeping the forearms still" / "without the elbows moving": only the hands move', () => {
    const start = figureAt(entry, 0);
    for (const t of ticksOf(entry)) {
      const now = figureAt(entry, t);
      expect(now.world.near.wrist).toEqual(start.world.near.wrist);
      expect(now.joints.wr).toEqual(start.joints.wr);
      expect(distance(now.world.near.wrist, now.world.near.grip)).toBeCloseTo(4, 9); // the hand keeps its length
    }
  });

  test('the hand starts below the line of the forearm and finishes above it, and is drawn as its own segment', () => {
    const bottom = figureAt(entry, 0);
    const top = figureAt(entry, topTime(entry));
    expect(bottom.world.near.grip[1]).toBeLessThan(bottom.world.near.wrist[1] - 1.5);
    expect(top.world.near.grip[1]).toBeGreaterThan(top.world.near.wrist[1] + 1.5);
    for (const figure of [bottom, top]) {
      expect(figure.prims.some((p) => p.kind === 'bone' && p.x1 === figure.joints.wr[0] && p.y1 === figure.joints.wr[1]
        && p.x2 === figure.grip.near[0] && p.y2 === figure.grip.near[1])).toBe(true);
    }
  });
});

describe('Seated Dumbbell Palms-Down Wrist Curl (268)', () => {
  test('"palms facing down": each dumbbell is held under the knuckles, on every tick', () => {
    for (const t of ticksOf(entry268)) {
      const { world, prims, hold } = figureAt(entry268, t);
      const hand = [world.near.grip[0] - world.near.wrist[0], world.near.grip[1] - world.near.wrist[1]];
      const toBell = [world.near.hold[0] - world.near.grip[0], world.near.hold[1] - world.near.grip[1]];
      expect(hand[0] * toBell[1] - hand[1] * toBell[0]).toBeLessThan(0); // on the underside of the hand
      const bells = prims.filter((p) => p.kind === 'rect' && p.w === 5.6 && p.h === 5.6);
      expect(bells).toHaveLength(2);
      expect(bells.some((b) => Math.abs(b.x + 2.8 - hold.near[0]) < 1e-9 && Math.abs(b.y + 2.8 - hold.near[1]) < 1e-9)).toBe(true);
    }
  });

  test('"Let the wrists drop, then lift the backs of the hands": the cycle starts dropped', () => {
    expect(entry268.frames[0].caption).toContain('Let the wrists drop');
    const { world } = figureAt(entry268, 0);
    expect(direction(world.near.wrist, world.near.grip)).toBeLessThan(-30);
  });
});

describe('Seated Dumbbell Palms-Up Wrist Curl (269)', () => {
  test('"palms facing up": each dumbbell rests on top of the hand, on every tick', () => {
    for (const t of ticksOf(entry269)) {
      const { world, prims } = figureAt(entry269, t);
      const hand = [world.near.grip[0] - world.near.wrist[0], world.near.grip[1] - world.near.wrist[1]];
      const toBell = [world.near.hold[0] - world.near.grip[0], world.near.hold[1] - world.near.grip[1]];
      expect(hand[0] * toBell[1] - hand[1] * toBell[0]).toBeGreaterThan(0); // on the upper side of the hand
      expect(prims.filter((p) => p.kind === 'rect' && p.w === 5.6 && p.h === 5.6)).toHaveLength(2);
    }
  });

  test('"Let the wrists open under the load, then curl the palms up": the cycle starts open', () => {
    expect(entry269.frames[0].caption).toContain('Let the wrists open under the load');
    const { world } = figureAt(entry269, 0);
    expect(direction(world.near.wrist, world.near.grip)).toBeLessThan(-30);
  });
});

describe('Cable Wrist Curl (164)', () => {
  test('"facing a low pulley": the pulley is in front of the knees and near the floor', () => {
    const { world } = figureAt(entry164, 0);
    expect(CABLE_WRIST_CURL_PULLEY[0]).toBeGreaterThan(world.near.knee[0] + 20);
    expect(CABLE_WRIST_CURL_PULLEY[1]).toBeLessThan(10);
    expect(world.near.toe[0]).toBeGreaterThan(world.near.ankle[0]); // the athlete faces it
  });

  test('"grip the straight bar palms-up": one bar on top of the hands, one cable to it that only lengthens as the wrists curl', () => {
    const lengths = [];
    for (const t of ticksOf(entry164)) {
      const { world, prims, hold, project } = figureAt(entry164, t);
      const hand = [world.near.grip[0] - world.near.wrist[0], world.near.grip[1] - world.near.wrist[1]];
      const toBar = [world.near.hold[0] - world.near.grip[0], world.near.hold[1] - world.near.grip[1]];
      expect(hand[0] * toBar[1] - hand[1] * toBar[0]).toBeGreaterThan(0);
      expect(prims.filter((p) => p.kind === 'circle' && p.r === 2.4 && p.cx === hold.near[0] && p.cy === hold.near[1])).toHaveLength(1);
      const cables = prims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4);
      expect(cables).toHaveLength(1);
      expect([cables[0].x1, cables[0].y1]).toEqual(project([CABLE_WRIST_CURL_PULLEY[0], CABLE_WRIST_CURL_PULLEY[1], 0]));
      expect([cables[0].x2, cables[0].y2]).toEqual(hold.near);
      expect(prims.filter((p) => p.kind === 'rect' && p.w === 5.6)).toHaveLength(0); // no dumbbells
      if (t <= topTime(entry164)) lengths.push(distance(CABLE_WRIST_CURL_PULLEY, world.near.hold));
    }
    for (let i = 1; i < lengths.length; i++) expect(lengths[i]).toBeGreaterThanOrEqual(lengths[i - 1] - 1e-9);
    expect(lengths.at(-1) - lengths[0]).toBeGreaterThan(2);
  });

  test('"Pause, then lower the bar slowly until the wrists are extended again"', () => {
    const [up, pause, down] = entry164.segmentDurationsMs;
    expect(pause).toBeGreaterThanOrEqual(400);
    const end = figureAt(entry164, up + pause + down).world.near;
    expect(end.grip[1]).toBeLessThan(end.wrist[1] - 1.5); // extended: the hand is below the forearm line again
  });
});

test('the three wrist curls are three drawings: grip side, range and equipment differ', () => {
  const tops = [entry268, entry269, entry164].map((e) => figureAt(e, topTime(e)));
  expect(distance(tops[0].hold.near, tops[1].hold.near)).toBeGreaterThan(2);
  expect(direction(tops[1].world.near.wrist, tops[1].world.near.grip))
    .toBeGreaterThan(direction(tops[0].world.near.wrist, tops[0].world.near.grip) + 10); // palms-up curls further
  expect(tops[2].prims.some((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4)).toBe(true);
  expect(tops[1].prims.some((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4)).toBe(false);
});
