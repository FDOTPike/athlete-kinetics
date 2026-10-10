// Trunk work against a cable, and the twists: Standing Rope Crunch (285),
// Kneeling Cable Crunch With Alternating Oblique Twists (232), Decline Oblique
// Crunch (181), Cable Russian Twists (160) and One-Arm High-Pulley Cable Side
// Bends (248). Every bound below comes from the movement's own catalogue text,
// quoted beside it. Measured on the 3D model: x forward, y up from the floor,
// z across the body toward the viewer.
import {
  CANONICAL_BODY_PARAMETERS,
  CHAIN_MOVEMENTS,
  KNEELING_CRUNCH_PULLEY,
  KNEELING_CRUNCH_TURN,
  RUSSIAN_TWIST_BALL,
  RUSSIAN_TWIST_PULLEY,
  SIDE_BEND_DEG,
  SIDE_BEND_PULLEY,
  STANDING_ROPE_CRUNCH_PULLEY,
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
/** The direction of a segment in the side plane, 0 to 360: 0 forward, 90 straight up, 180 back. */
const direction = (from, to) => (deg(Math.atan2(to[1] - from[1], to[0] - from[0])) + 360) % 360;
/** The smallest angle between two directions. */
const between = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
/** The angle between two 3D vectors. */
const angle3 = (a, b) => deg(Math.acos(Math.max(-1, Math.min(1, a.reduce((sum, v, i) => sum + v * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b))))));
const minus = (a, b) => a.map((v, i) => v - b[i]);
/** How far the spine is curled forward: the turn between its first step and its last, in the side plane. */
const curlOf = (world) => between(direction(world.spine[0], world.spine[1]), direction(world.spine.at(-2), world.spine.at(-1)));
/** How far point `c` is from the segment `p` to `q`, in the side plane. */
function segmentDistance(p, q, c) {
  const ux = q[0] - p[0], uy = q[1] - p[1];
  const k = Math.max(0, Math.min(1, ((c[0] - p[0]) * ux + (c[1] - p[1]) * uy) / (ux * ux + uy * uy)));
  return Math.hypot(c[0] - (p[0] + ux * k), c[1] - (p[1] + uy * k));
}
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
/** When each keyframe is reached. */
const keyTimes = (entry) => entry.segmentDurationsMs.reduce((times, d) => [...times, times.at(-1) + d], [0]);
/** The one cable painted at time `t`: its two ends on screen. */
function cableOf(figure) {
  const cables = figure.prims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4);
  expect(cables).toHaveLength(1);
  return [[cables[0].x1, cables[0].y1], [cables[0].x2, cables[0].y2]];
}
/** A cable that only lengthens between two times, and is never shorter than at `from`. */
function expectCableOnlyLengthens(entry, pulley, from, to) {
  const length = (t) => distance(pulley.length === 3 ? pulley : [...pulley, 0], figureAt(entry, t).world.near.hold);
  const lengths = ticksOf(entry).filter((t) => t >= from && t <= to).map(length);
  for (let i = 1; i < lengths.length; i++) expect(lengths[i]).toBeGreaterThanOrEqual(lengths[i - 1] - 1e-9);
  expect(lengths.at(-1) - lengths[0]).toBeGreaterThan(2);
  for (const t of ticksOf(entry)) expect(length(t)).toBeGreaterThanOrEqual(lengths[0] - 1e-6);
}

const entry285 = entryOf(285);
const entry232 = entryOf(232);
const entry181 = entryOf(181);
const entry160 = entryOf(160);
const entry248 = entryOf(248);

describe('Standing Rope Crunch (285)', () => {
  const [down, pause, up] = entry285.segmentDurationsMs;
  /** The hand's place measured along and across the top of the spine. */
  const onChest = (world) => {
    const along = direction(world.neck, world.head) * Math.PI / 180;
    const dx = world.near.wrist[0] - world.neck[0], dy = world.near.wrist[1] - world.neck[1];
    return [dx * Math.cos(along) + dy * Math.sin(along), dx * Math.sin(along) - dy * Math.cos(along)];
  };

  test('"stand with your back to the machine": the high pulley is behind and above the head', () => {
    const { world } = figureAt(entry285, 0);
    expect(STANDING_ROPE_CRUNCH_PULLEY[0]).toBeLessThan(world.hip[0] - 20);
    expect(STANDING_ROPE_CRUNCH_PULLEY[1]).toBeGreaterThan(world.head[1] + BODY.hr);
    expect(world.near.toe[0]).toBeGreaterThan(world.near.ankle[0]); // facing away from it
    expect(direction(world.hip, world.neck)).toBeCloseTo(90, 6); // standing tall
  });

  test('"hold the rope ends over the shoulders against the upper chest": the hands stay there for the whole rep', () => {
    const start = onChest(figureAt(entry285, 0).world);
    // Against the front of the upper chest: on the trunk's front surface, within a hand of the top of it.
    expect(start[1]).toBeGreaterThan(BACK_HALF - 2.5);
    expect(start[1]).toBeLessThan(BACK_HALF + 2.5);
    expect(Math.abs(start[0])).toBeLessThanOrEqual(5);
    for (const t of ticksOf(entry285)) {
      const now = onChest(figureAt(entry285, t).world);
      expect(now[0]).toBeCloseTo(start[0], 6);
      expect(now[1]).toBeCloseTo(start[1], 6);
    }
    // Over the shoulders: where the cable passes the neck it is above the shoulder line.
    const figure = figureAt(entry285, 0);
    const k = (figure.world.neck[0] - STANDING_ROPE_CRUNCH_PULLEY[0]) / (figure.world.near.hold[0] - STANDING_ROPE_CRUNCH_PULLEY[0]);
    expect(STANDING_ROPE_CRUNCH_PULLEY[1] + (figure.world.near.hold[1] - STANDING_ROPE_CRUNCH_PULLEY[1]) * k).toBeGreaterThan(figure.world.neck[1]);
    expect(cableOf(figure)[1]).toEqual(figure.hold.near);
  });

  test('"Keeping the hips still, curl the spine to crunch the torso down"', () => {
    const start = figureAt(entry285, 0);
    for (const t of ticksOf(entry285)) {
      const now = figureAt(entry285, t);
      for (const key of ['hp', 'kn', 'an', 'kf', 'af']) expect(now.joints[key]).toEqual(start.joints[key]);
      // The bottom of the spine stays upright over the hips: this is a curl, not a bow from the hips.
      expect(between(direction(now.world.spine[0], now.world.spine[1]), 90)).toBeLessThanOrEqual(2);
    }
    const bottom = figureAt(entry285, down).world;
    expect(curlOf(bottom)).toBeGreaterThanOrEqual(60);
    expect(start.world.neck[1] - bottom.neck[1]).toBeGreaterThanOrEqual(4);
    expect(bottom.neck[0] - start.world.neck[0]).toBeGreaterThanOrEqual(8);
  });

  test('"Pause, then return slowly to standing tall"; the cable only lengthens on the way down', () => {
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(up).toBeGreaterThanOrEqual(1.5 * down);
    expect(curlOf(figureAt(entry285, down + pause + up).world)).toBeCloseTo(0, 6);
    expectCableOnlyLengthens(entry285, STANDING_ROPE_CRUNCH_PULLEY, 0, down);
  });
});

describe('Kneeling Cable Crunch With Alternating Oblique Twists (232)', () => {
  const times = keyTimes(entry232);
  // Keyframes: up, down, up | up, down, up | up, down, up | up. The three bottoms:
  const [plain, oneWay, otherWay] = [times[1], times[4], times[7]];

  test('"kneel facing it a short step back": knees on the floor, shins behind, the high pulley in front', () => {
    const { world } = figureAt(entry232, 0);
    for (const side of [world.near, world.far]) {
      expect(side.knee[1]).toBeLessThanOrEqual(THIGH_HALF + 0.5);
      expect(side.ankle[0]).toBeLessThan(side.knee[0] - 20);
      expect(side.ankle[1]).toBeLessThanOrEqual(4);
      expect(side.hipJoint[1]).toBeGreaterThan(side.knee[1] + 12);
    }
    // Facing it, a short step back: the pulley is in front of the knees, by less than a stride, and high overhead.
    expect(KNEELING_CRUNCH_PULLEY[0]).toBeGreaterThan(world.near.knee[0] + 5);
    expect(KNEELING_CRUNCH_PULLEY[0]).toBeLessThan(world.near.knee[0] + 30);
    expect(KNEELING_CRUNCH_PULLEY[1]).toBeGreaterThan(world.head[1] + 30);
    expect(world.near.knee[0]).toBeGreaterThan(world.near.ankle[0]); // the knees point at it
  });

  test('"Keeping the hands by the ears and the hips still", on every tick', () => {
    const hip = figureAt(entry232, 0).world.hip;
    for (const t of ticksOf(entry232)) {
      const { world, joints } = figureAt(entry232, t);
      expect(world.hip).toEqual(hip);
      expect(distance(world.near.wrist.slice(0, 2), world.head.slice(0, 2))).toBeLessThanOrEqual(BODY.hr + 3);
      expect(distance(world.far.wrist.slice(0, 2), world.head.slice(0, 2))).toBeLessThanOrEqual(BODY.hr + 3);
      expect(joints.kn).toEqual(figureAt(entry232, 0).joints.kn);
    }
  });

  test('"curl the torso down until the elbows reach the knees, then rise slowly"', () => {
    const { world } = figureAt(entry232, plain);
    expect(curlOf(world)).toBeGreaterThanOrEqual(80);
    expect(distance(world.near.elbow.slice(0, 2), world.near.knee.slice(0, 2))).toBeLessThanOrEqual(7);
    // The plain repetition is square: both elbows together.
    expect(world.near.elbow[0]).toBeCloseTo(world.far.elbow[0], 9);
    expect(world.near.elbow[1]).toBeCloseTo(world.far.elbow[1], 9);
    for (const rep of [0, 3, 6]) {
      expect(entry232.segmentDurationsMs[rep + 1]).toBeGreaterThanOrEqual(1.4 * entry232.segmentDurationsMs[rep]);
    }
  });

  test('"On the next repetition turn partway down so one elbow travels to the opposite knee ... then repeat to the other side"', () => {
    const square = figureAt(entry232, plain).world;
    const one = figureAt(entry232, oneWay);
    const other = figureAt(entry232, otherWay);
    expect(one.angles.twist).toBeCloseTo(KNEELING_CRUNCH_TURN, 6);
    expect(other.angles.twist).toBeCloseTo(-KNEELING_CRUNCH_TURN, 6);
    // One elbow comes closer to the opposite knee than a square crunch brings it; then the other does.
    expect(distance(one.world.near.elbow, one.world.far.knee)).toBeLessThan(distance(square.near.elbow, square.far.knee) - 2);
    expect(distance(other.world.far.elbow, other.world.near.knee)).toBeLessThan(distance(square.far.elbow, square.near.knee) - 2);
    // "partway down": the turn is not there at the top and builds as the trunk goes down.
    expect(figureAt(entry232, times[3]).angles.twist).toBeCloseTo(0, 9);
    const halfway = figureAt(entry232, (times[3] + times[4]) / 2).angles.twist;
    expect(halfway).toBeGreaterThan(5);
    expect(halfway).toBeLessThan(KNEELING_CRUNCH_TURN - 5);
    // The turn is from the ribs: the hips and knees are where they were.
    expect(one.world.near.knee).toEqual(square.near.knee);
    expect(one.world.hip).toEqual(square.hip);
  });

  test('changing sides at the top moves nothing', () => {
    for (const at of [2, 5, 8]) {
      const before = figureAt(entry232, times[at]).joints;
      const after = figureAt(entry232, times[at + 1]).joints;
      for (const key of ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf']) expect(distance(before[key], after[key])).toBeLessThan(1e-9);
    }
  });

  test('a rope end in each hand and one cable to them that only lengthens on the way down', () => {
    const figure = figureAt(entry232, 0);
    expect(figure.prims.filter((p) => p.kind === 'circle' && p.r === 2.2 && p.fill !== 'line')).toHaveLength(2);
    expect(cableOf(figure)[1]).toEqual(figure.hold.near);
    expectCableOnlyLengthens(entry232, KNEELING_CRUNCH_PULLEY, 0, plain);
  });
});

describe('Decline Oblique Crunch (181)', () => {
  const [up, pause, down] = entry181.segmentDurationsMs;
  const equipment = CHAIN_MOVEMENTS['decline-oblique-crunch'].equipment;

  test('"Secure the legs on a decline bench": knees over the high end, ankles under the roller, hips on the board', () => {
    const start = figureAt(entry181, 0).world;
    const roller = equipment.find((s) => s.kind === 'roller');
    expect(roller.at[0]).toBeGreaterThan(start.near.ankle[0]);
    expect(distance(roller.at, start.near.ankle.slice(0, 2))).toBeLessThanOrEqual((BODY.lw * 0.9) / 2 + 2.6 + 1);
    expect(start.near.knee[1]).toBeGreaterThan(start.hip[1]);
    const board = equipment.find((s) => s.kind === 'slab');
    expect(board.a[1]).toBeLessThan(board.b[1]); // it slopes down toward the head end
    for (const t of ticksOf(entry181)) {
      const { world } = figureAt(entry181, t);
      expect(world.hip).toEqual(start.hip);
      expect(world.near.ankle).toEqual(start.near.ankle);
    }
  });

  test('"lean back until the torso is partway down"', () => {
    const { world } = figureAt(entry181, 0);
    const lean = direction(world.hip, world.neck);
    // Leaning back past upright, and well short of lying on the board.
    expect(lean).toBeGreaterThanOrEqual(120);
    expect(lean).toBeLessThanOrEqual(160);
  });

  test('"one hand beside the head and the other on the thigh", on every tick', () => {
    for (const t of ticksOf(entry181)) {
      const { world } = figureAt(entry181, t);
      expect(distance(world.near.wrist.slice(0, 2), world.head.slice(0, 2))).toBeLessThanOrEqual(BODY.hr + 3.5);
      expect(segmentDistance(world.far.hipJoint, world.far.knee, world.far.wrist)).toBeLessThanOrEqual(THIGH_HALF + 3.5);
    }
  });

  test('"Curl the torso up while turning it so the raised elbow travels toward the opposite knee"', () => {
    const start = figureAt(entry181, 0);
    const top = figureAt(entry181, up);
    expect(curlOf(top.world) - curlOf(start.world)).toBeGreaterThanOrEqual(30);
    expect(direction(top.world.hip, top.world.neck)).toBeLessThan(direction(start.world.hip, start.world.neck) - 20); // up
    expect(top.angles.twist).toBeGreaterThanOrEqual(25); // turned, the raised arm's shoulder leading
    expect(distance(start.world.near.elbow, start.world.far.knee) - distance(top.world.near.elbow, top.world.far.knee)).toBeGreaterThanOrEqual(15);
    // The curl and the turn happen together, not one after the other.
    const half = figureAt(entry181, up / 2);
    expect(half.angles.twist).toBeGreaterThan(5);
    expect(curlOf(half.world)).toBeGreaterThan(curlOf(start.world) + 5);
  });

  test('"Pause, then lower slowly to the start. Complete the repetitions on one side, then change sides."', () => {
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(down).toBeGreaterThanOrEqual(1.5 * up);
    expect(entry181.frames.at(-1).caption).toContain('change sides');
  });
});

describe('Cable Russian Twists (160)', () => {
  const [out, pause, back] = entry160.segmentDurationsMs;
  const straight = (arm) => angle3(minus(arm.elbow, arm.shoulder), minus(arm.wrist, arm.elbow));

  test('"lie with the upper back on a stability ball ... and the hips raised"', () => {
    const { world } = figureAt(entry160, 0);
    const [ballX, ballY] = RUSSIAN_TWIST_BALL.at;
    // Under the upper back: between the hips and the neck, nearer the neck.
    expect(ballX).toBeGreaterThan(world.neck[0]);
    expect(ballX).toBeLessThan((world.neck[0] + world.hip[0]) / 2);
    const k = (ballX - world.hip[0]) / (world.neck[0] - world.hip[0]);
    const backUnderside = world.hip[1] + (world.neck[1] - world.hip[1]) * k - BACK_HALF;
    expect(Math.abs(backUnderside - (ballY + RUSSIAN_TWIST_BALL.r))).toBeLessThanOrEqual(1.5);
    expect(ballY - RUSSIAN_TWIST_BALL.r).toBeCloseTo(0, 9); // the ball is on the floor
    // Hips raised: level with the knees, feet flat under the knees.
    for (const side of [world.near, world.far]) {
      expect(side.knee[1]).toBeCloseTo(side.hipJoint[1], 9);
      expect(side.ankle[0]).toBeCloseTo(side.knee[0], 9);
    }
    expect(world.hip[1]).toBeGreaterThan(20);
  });

  test('"side-on to the cable", "Set the pulley at mid height"', () => {
    const { world } = figureAt(entry160, 0);
    expect(Math.abs(RUSSIAN_TWIST_PULLEY[2])).toBeGreaterThanOrEqual(40); // off to one side
    expect(RUSSIAN_TWIST_PULLEY[0]).toBeGreaterThan(world.head[0]); // beside the chest, not beyond the head or the feet
    expect(RUSSIAN_TWIST_PULLEY[0]).toBeLessThan(world.hip[0]);
    expect(RUSSIAN_TWIST_PULLEY[1]).toBeGreaterThan(30);
    expect(RUSSIAN_TWIST_PULLEY[1]).toBeLessThan(65);
  });

  test('"hold the handle in both hands with the arms straight above the chest"', () => {
    const { world } = figureAt(entry160, 0);
    expect(distance(world.near.wrist, world.far.wrist)).toBeLessThanOrEqual(1);
    expect(Math.abs(world.near.wrist[0] - world.neck[0])).toBeLessThanOrEqual(3);
    expect(Math.abs(world.near.wrist[2])).toBeLessThanOrEqual(1);
    expect(world.near.wrist[1]).toBeGreaterThan(world.neck[1] + 20);
  });

  test('"Keeping the hips up and the arms straight", on every tick', () => {
    const start = figureAt(entry160, 0);
    for (const t of ticksOf(entry160)) {
      const now = figureAt(entry160, t);
      expect(straight(now.world.near)).toBeLessThan(1e-4);
      expect(straight(now.world.far)).toBeLessThan(1e-4);
      for (const key of ['hp', 'kn', 'an', 'kf', 'af', 'nk']) expect(now.joints[key]).toEqual(start.joints[key]);
      // The hands stay together on the handle.
      expect(distance(now.world.near.wrist, now.world.far.wrist)).toBeLessThanOrEqual(3);
    }
  });

  test('"turn the torso away from the pulley through a quarter turn"', () => {
    const start = figureAt(entry160, 0);
    const top = figureAt(entry160, out);
    expect(Math.abs(top.angles.twist)).toBeCloseTo(90, 6);
    // The line of the shoulders has turned a quarter turn about the spine.
    const line = (world) => minus(world.near.shoulder, world.far.shoulder);
    expect(angle3(line(start.world), line(top.world))).toBeCloseTo(90, 4);
    // Away from the pulley: the hands finish on the other side of the body from it, level with the shoulders.
    expect(Math.sign(top.world.near.wrist[2])).toBe(-Math.sign(RUSSIAN_TWIST_PULLEY[2]));
    expect(Math.abs(top.world.near.wrist[2])).toBeGreaterThanOrEqual(20);
    expect(Math.abs(top.world.near.wrist[1] - top.world.neck[1])).toBeLessThanOrEqual(3);
  });

  test('"Pause, then return slowly to the start with tension still on the cable" ... "turn around and repeat on the other side"', () => {
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(back).toBeGreaterThanOrEqual(1.5 * out);
    expectCableOnlyLengthens(entry160, RUSSIAN_TWIST_PULLEY, 0, out);
    expect(entry160.frames.at(-1).caption).toContain('turn around');
  });
});

describe('One-Arm High-Pulley Cable Side Bends (248)', () => {
  const [down, turn, up] = entry248.segmentDurationsMs;
  const elbowAngle = (arm) => angle3(minus(arm.shoulder, arm.elbow), minus(arm.wrist, arm.elbow));

  test('"Stand side-on to a high pulley", seen from the front', () => {
    expect(entry248.view).toBe('front');
    const { world } = figureAt(entry248, 0);
    expect(Math.abs(SIDE_BEND_PULLEY[2])).toBeGreaterThanOrEqual(30);
    expect(SIDE_BEND_PULLEY[1]).toBeGreaterThan(world.head[1] + BODY.hr);
    expect(world.neck[2]).toBeCloseTo(0, 9); // upright
    expect(world.neck[0]).toBeCloseTo(world.hip[0], 9);
  });

  test('"the elbow touches your side and the handle is by the shoulder, feet hip-width apart and the free hand on the hip"', () => {
    const { world } = figureAt(entry248, 0);
    // The working arm is the one on the pulley's side.
    expect(Math.sign(world.near.shoulder[2])).toBe(Math.sign(SIDE_BEND_PULLEY[2]));
    expect(Math.abs(world.near.elbow[2] - world.near.shoulder[2])).toBeLessThanOrEqual(3); // down the side
    expect(world.near.elbow[1]).toBeLessThan(world.near.shoulder[1] - 10);
    expect(distance(world.near.wrist, world.near.shoulder)).toBeLessThanOrEqual(5); // by the shoulder
    expect(world.near.ankle[2] - world.far.ankle[2]).toBeCloseTo(world.near.hipJoint[2] - world.far.hipJoint[2], 9);
    // The free hand is on the side of the hip.
    expect(Math.abs(world.far.wrist[1] - world.hip[1])).toBeLessThanOrEqual(4);
    expect(Math.abs(Math.abs(world.far.wrist[2]) - BODY.hw)).toBeLessThanOrEqual(2);
  });

  test('"Keeping that arm fixed in place, bend sideways toward the cable side"', () => {
    const start = figureAt(entry248, 0);
    const shape = (world) => [
      elbowAngle(world.near),
      angle3(minus(world.near.elbow, world.near.shoulder), minus(world.head, world.neck)),
    ];
    for (const t of ticksOf(entry248)) {
      const now = figureAt(entry248, t);
      // The arm keeps its shape and its angle to the top of the trunk.
      expect(shape(now.world)[0]).toBeCloseTo(shape(start.world)[0], 6);
      expect(shape(now.world)[1]).toBeCloseTo(shape(start.world)[1], 6);
      // Sideways only, from the waist: no lean forward, hips and legs still.
      expect(now.world.neck[0]).toBeCloseTo(start.world.neck[0], 9);
      for (const key of ['hp', 'kn', 'an', 'kf', 'af']) expect(now.joints[key]).toEqual(start.joints[key]);
    }
    const bottom = figureAt(entry248, down);
    expect(bottom.angles.sideCurl).toBeCloseTo(SIDE_BEND_DEG, 6);
    expect(Math.sign(bottom.world.neck[2])).toBe(Math.sign(SIDE_BEND_PULLEY[2])); // toward the cable
    expect(Math.abs(bottom.world.neck[2])).toBeGreaterThanOrEqual(4);
    expect(bottom.curled).toBe(true);
  });

  test('"to pull the weight down" ... "Return slowly to upright, keeping tension on the cable"', () => {
    expect(up).toBeGreaterThanOrEqual(1.5 * down);
    expectCableOnlyLengthens(entry248, SIDE_BEND_PULLEY, 0, down);
    const figure = figureAt(entry248, down + turn);
    expect(cableOf(figure)[1]).toEqual(figure.hold.near);
    expect(entry248.frames.at(-1).caption).toContain('change sides');
  });
});
