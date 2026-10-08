// Nine more older drawings were partly against their own catalogue text and
// were redrawn on 9 October 2026 at the owner's request. Each block opens with
// the thing the old drawing got wrong, then holds the rest of the text.
// Measured on the 3D model: x forward, y up from the floor, z across the body
// toward the viewer.
import {
  BAND_CALF_RAISE_TILT,
  CANONICAL_BODY_PARAMETERS,
  CHAIN_ANKLE_HEIGHT,
  CHAIN_FOREFOOT_HEIGHT,
  CHAIN_MOVEMENTS,
  FACE_PULL_PULLEY,
  GOOD_MORNING_KNEE_SOFT,
  LONG_BAR,
  NECK_ROW_PULLEY,
  REAR_DELT_ROW_GRIP_HALF,
  ROW_STATION_PULLEY,
  V_HANDLE_HALF,
  chainGeometry,
  layoutCanonicalFigure,
  poseAtTime,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = CANONICAL_BODY_PARAMETERS;
const THIGH_HALF = (BODY.lw * 1.18) / 2;
const TRUNK = 24;
const deg = (rad) => (rad * 180) / Math.PI;
/** Straight-line distance between two points, over as many dimensions as both have. */
const distance = (a, b) => Math.hypot(...a.slice(0, Math.min(a.length, b.length)).map((v, i) => v - b[i]));
const flat = (p) => [p[0], p[1]];
const minus = (a, b) => a.map((v, i) => v - b[i]);
/** The direction of a segment in the side plane, 0 to 360: 0 forward, 90 straight up, 180 back. */
const direction = (from, to) => (deg(Math.atan2(to[1] - from[1], to[0] - from[0])) + 360) % 360;
const between = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
/** The angle at a middle joint, in 3D: 180 is straight. */
const angleAt = (from, mid, to) => {
  const a = minus(from, mid), b = minus(to, mid);
  return deg(Math.acos(Math.max(-1, Math.min(1, a.reduce((sum, v, i) => sum + v * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b))))));
};
const elbowOf = (side) => angleAt(side.shoulder, side.elbow, side.wrist);
const kneeOf = (side) => angleAt(side.hipJoint, side.knee, side.ankle);
/** How far the spine is curled forward, in the side plane. */
const curlOf = (world) => between(direction(world.spine[0], world.spine[1]), direction(world.spine.at(-2), world.spine.at(-1)));
/** Where a point is against a straight trunk, in the side plane: how far up the spine from the hip, and how far out in front of it. */
function onTrunk(world, point) {
  const ux = (world.neck[0] - world.hip[0]) / TRUNK, uy = (world.neck[1] - world.hip[1]) / TRUNK;
  const dx = point[0] - world.hip[0], dy = point[1] - world.hip[1];
  return { along: dx * ux + dy * uy, front: dx * uy - dy * ux };
}
const entryOf = (id) => previewManifest.entries.find((e) => e.movementId === id);
const slugOf = (entry) => entry.assetKey.split('/')[1];
function ticksOf(entry) {
  const total = entry.segmentDurationsMs.reduce((a, b) => a + b, 0);
  return [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];
}
function figureAt(entry, t) {
  const pose = poseAtTime(entry.frames.map((f) => f.joints), t, entry.segmentDurationsMs);
  const figure = chainGeometry(slugOf(entry), pose.ph, BODY, pose.tw ?? 0);
  return { ...figure, prims: layoutCanonicalFigure(pose, { ...entry, body: BODY }) };
}
const linesOf = (figure) => figure.prims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4);
const lengthOf = (bone) => Math.hypot(bone.x2 - bone.x1, bone.y2 - bone.y1);
// A cable or band is drawn 1.4 units wide. An arm that swings on its joints
// does not carry the hand along a perfectly straight line, so a line can give
// back a few hundredths of a unit as the limb settles. A tenth of a unit, a
// fourteenth of the line's own width, is the most it may ever give back.
const SLACK = 0.1;
/** A series of lengths that only grows, and grows by at least `gain`. */
function expectOnlyGrows(lengths, gain) {
  let longest = lengths[0];
  for (const now of lengths) {
    expect(now).toBeGreaterThanOrEqual(longest - SLACK);
    longest = Math.max(longest, now);
  }
  expect(lengths.at(-1)).toBeGreaterThan(lengths[0] + gain);
}
/** A cable from a fixed pulley that only lengthens between two times and is never shorter than at `from`. */
function expectCableOnlyLengthens(entry, pulley, from, to) {
  const fixed = pulley.length === 3 ? pulley : [...pulley, 0];
  const length = (t) => distance(fixed, figureAt(entry, t).world.near.hold);
  expectOnlyGrows(ticksOf(entry).filter((t) => t >= from && t <= to).map(length), 1);
  for (const t of ticksOf(entry)) expect(length(t)).toBeGreaterThanOrEqual(length(from) - SLACK);
}
/** Joints that must not move at all through the cycle. */
function expectStill(entry, keys) {
  const start = figureAt(entry, 0).joints;
  for (const t of ticksOf(entry)) {
    const now = figureAt(entry, t).joints;
    for (const key of keys) expect(distance(now[key], start[key])).toBeLessThan(1e-9);
  }
}
const BODY_STILL = ['hd', 'nk', 'hp', 'kn', 'an', 'kf', 'af'];

const IDS = [142, 110, 144, 287, 22, 266, 59, 118, 174];

test.each(IDS.map((id) => [entryOf(id).name, entryOf(id)]))('%s is a pending redraw that keeps its older draft id and says why it was redrawn', (_name, entry) => {
  expect(entry.status).toBe('pending');
  expect(CHAIN_MOVEMENTS[slugOf(entry)]).toBeDefined();
  expect(entry.previewId).toBe(slugOf(entry).replaceAll('-', '_'));
  expect(entry.reason).toContain('Redrawn on 9 October 2026');
  expect(entry.frames).toHaveLength(5);
  expect(entry.frames[0].joints.ph).toBe(entry.frames.at(-1).joints.ph);
});

describe('Bent Over Barbell Row (142)', () => {
  const entry = entryOf(142);
  const [up, pause, down] = entry.segmentDurationsMs;

  test('was held about 40 degrees above level: "until the torso is almost level with the floor and the bar hangs under the shoulders"', () => {
    for (const t of ticksOf(entry)) {
      const figure = figureAt(entry, t);
      expect(direction(figure.world.hip, figure.world.neck)).toBeLessThanOrEqual(20);
      expect(figure.curled).toBe(false); // "with the back straight"
    }
    const { world } = figureAt(entry, 0);
    expect(Math.abs(world.near.hold[0] - world.near.shoulder[0])).toBeLessThanOrEqual(1.5);
    expect(elbowOf(world.near)).toBeGreaterThanOrEqual(170);
    expect(kneeOf(world.near)).toBeGreaterThanOrEqual(140); // "bend the knees slightly"
    expect(kneeOf(world.near)).toBeLessThan(175);
  });

  test('"Keeping the torso still and the elbows close to the body, pull the bar up to the body"', () => {
    expectStill(entry, BODY_STILL);
    const start = figureAt(entry, 0).world, top = figureAt(entry, up).world;
    expect(top.near.hold[1] - start.near.hold[1]).toBeGreaterThanOrEqual(10);
    // To the body: the hands finish against the front of the trunk, between the hips and the chest.
    const touch = onTrunk(top, top.near.hold);
    expect(touch.front).toBeLessThanOrEqual(8);
    expect(touch.front).toBeGreaterThan(5);
    expect(touch.along).toBeGreaterThan(4);
    expect(touch.along).toBeLessThan(18);
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      // Close to the body: each arm works in its own shoulder's plane, never flaring out.
      expect(world.near.elbow[2]).toBeCloseTo(world.near.shoulder[2], 9);
      expect(world.far.elbow[2]).toBeCloseTo(world.far.shoulder[2], 9);
    }
    expect(top.near.elbow[1]).toBeGreaterThan(top.near.wrist[1] + 8); // "Lead with the elbows"
  });

  test('"Squeeze the back, then lower the bar slowly to a full hang"', () => {
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(down).toBeGreaterThanOrEqual(1.5 * up);
    expect(elbowOf(figureAt(entry, up + pause + down).world.near)).toBeGreaterThanOrEqual(170);
  });
});

describe('Barbell Rear Delt Row (110)', () => {
  const entry = entryOf(110);
  const [up, hold, down] = entry.segmentDurationsMs;

  test('began standing and finished near the stomach: "hinge until the bar hangs beneath a braced torso ... row the bar toward the upper chest"', () => {
    const start = figureAt(entry, 0).world, top = figureAt(entry, up).world;
    expect(direction(start.hip, start.neck)).toBeLessThanOrEqual(35); // hinged from the first frame
    expect(Math.abs(start.near.hold[0] - start.near.shoulder[0])).toBeLessThanOrEqual(1.5);
    expect(elbowOf(start.near)).toBeGreaterThanOrEqual(170);
    // The upper chest is the top third of the trunk; the stomach, which the text names as the fault, is below half-way.
    const touch = onTrunk(top, top.near.hold);
    expect(touch.along).toBeGreaterThanOrEqual((2 / 3) * TRUNK);
    expect(touch.front).toBeLessThanOrEqual(8.5);
  });

  test('"Take a wide overhand grip ... Drive the elbows wide"', () => {
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      // One bar: the hands stay the same distance apart, well outside the shoulders.
      expect(world.near.hold[2]).toBeCloseTo(REAR_DELT_ROW_GRIP_HALF, 9);
      expect(world.far.hold[2]).toBeCloseTo(-REAR_DELT_ROW_GRIP_HALF, 9);
      expect(world.near.hold[1]).toBeCloseTo(world.far.hold[1], 9);
    }
    expect(REAR_DELT_ROW_GRIP_HALF).toBeGreaterThanOrEqual(1.4 * figureAt(entry, 0).world.near.shoulder[2]);
    const top = figureAt(entry, up).world;
    for (const [side, sign] of [[top.near, 1], [top.far, -1]]) {
      expect(sign * (side.elbow[2] - side.shoulder[2])).toBeGreaterThanOrEqual(8); // out to the side,
      expect(sign * side.elbow[2]).toBeGreaterThan(sign * side.wrist[2]); // wider than the hands,
      expect(side.elbow[1]).toBeGreaterThanOrEqual(side.shoulder[1] - 1); // not tucked down beside the ribs
    }
    expect(entry.view).toBe('oblique');
  });

  test('"holding long enough to feel the rear shoulders finish. Lower to long arms without rising"', () => {
    expect(hold).toBeGreaterThanOrEqual(600);
    expect(down).toBeGreaterThanOrEqual(1.4 * up);
    expectStill(entry, BODY_STILL);
    expect(elbowOf(figureAt(entry, up + hold + down).world.near)).toBeGreaterThanOrEqual(170);
  });
});

describe('Bent Over One-Arm Long Bar Row (144)', () => {
  const entry = entryOf(144);
  const [up, pause, down] = entry.segmentDurationsMs;
  const anchor = [...LONG_BAR.anchor, 0];
  /** The drawn bar and its two plates. */
  function barOf(figure) {
    const from = figure.project(anchor);
    const shaft = figure.prims.filter((p) => p.kind === 'bone' && p.color === 'textHi' && p.w === 1.6 && p.x1 === from[0] && p.y1 === from[1]);
    const plates = figure.prims.filter((p) => p.kind === 'bone' && p.w === 2.4 && p.stroke === 'ink1');
    return { from, shaft, plates };
  }
  const centreOf = (bone) => [(bone.x1 + bone.x2) / 2, (bone.y1 + bone.y2) / 2];

  test('had no bar or plates: "Load one end of a barbell and brace the other end in a corner"', () => {
    const start = figureAt(entry, 0).world;
    expect(LONG_BAR.anchor[1]).toBeLessThanOrEqual(3); // braced on the floor,
    expect(LONG_BAR.anchor[0]).toBeLessThan(start.near.ankle[0] - 20); // behind the athlete
    for (const t of ticksOf(entry)) {
      const figure = figureAt(entry, t);
      const { from, shaft, plates } = barOf(figure);
      expect(shaft).toHaveLength(1);
      expect(lengthOf(shaft[0])).toBeCloseTo(LONG_BAR.length, 6); // one rigid bar
      expect(plates).toHaveLength(2);
      // "grip the bar just behind the plates": the hand is on the shaft, and the plates are just beyond it.
      const hand = figure.hold.near;
      expect(Math.abs(distance(hand, from) - LONG_BAR.grip)).toBeLessThanOrEqual(0.7);
      const cross = (shaft[0].x2 - from[0]) * (hand[1] - from[1]) - (shaft[0].y2 - from[1]) * (hand[0] - from[0]);
      expect(Math.abs(cross) / LONG_BAR.length).toBeLessThan(1e-6);
      for (const plate of plates) {
        expect(distance(centreOf(plate), from)).toBeGreaterThan(distance(hand, from) + 2);
        expect(distance(centreOf(plate), hand)).toBeLessThanOrEqual(8);
      }
    }
  });

  test('"hinge forward with the knees slightly bent ... rest the other hand on the knee"', () => {
    const start = figureAt(entry, 0).world;
    expect(direction(start.hip, start.neck)).toBeLessThanOrEqual(30);
    expect(kneeOf(start.near)).toBeGreaterThanOrEqual(140);
    expect(kneeOf(start.near)).toBeLessThan(175);
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      expect(world.far.wrist).toEqual(start.far.wrist); // resting: it does not move
      expect(distance(flat(world.far.wrist), flat(world.far.knee))).toBeLessThanOrEqual(7);
      expect(world.far.wrist[1]).toBeGreaterThan(world.far.knee[1]); // on top of it
    }
  });

  test('"Keeping the torso still and the elbow in, pull the bar straight up until the plates reach the lower chest"', () => {
    expectStill(entry, BODY_STILL);
    const start = figureAt(entry, 0), top = figureAt(entry, up);
    expect(top.world.near.hold[1] - start.world.near.hold[1]).toBeGreaterThanOrEqual(10);
    expect(elbowOf(start.world.near)).toBeGreaterThanOrEqual(165); // from a long arm
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      expect(world.near.elbow[2]).toBeCloseTo(world.near.shoulder[2], 9); // the elbow in
    }
    // The lower chest: the plates finish against the front of the trunk, above half-way up it and below the shoulders.
    const { plates } = barOf(top);
    const inner = plates.map(centreOf).sort((a, b) => distance(a, top.hold.near) - distance(b, top.hold.near))[0];
    const world = [inner[0], top.project([0, 0, 0])[1] - inner[1]]; // a side view: screen x is world x, and the floor is a fixed line
    const touch = onTrunk(top.world, world);
    expect(touch.along).toBeGreaterThanOrEqual(TRUNK / 2);
    expect(touch.along).toBeLessThanOrEqual(0.85 * TRUNK);
    expect(touch.front).toBeLessThanOrEqual(9);
  });

  test('"Squeeze, then lower slowly without letting the plates rest on the floor"', () => {
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(down).toBeGreaterThanOrEqual(1.5 * up);
    for (const t of ticksOf(entry)) {
      const figure = figureAt(entry, t);
      const floor = figure.project([0, 0, 0])[1];
      for (const plate of barOf(figure).plates) expect(Math.max(plate.y1, plate.y2)).toBeLessThan(floor - 2);
    }
    expect(entry.frames.at(-1).caption).toContain('change arms');
  });
});

describe('Stiff Leg Barbell Good Morning (287)', () => {
  const entry = entryOf(287);
  const [down, turn, up] = entry.segmentDurationsMs;

  test('bent the knees a good deal and stopped short of level: "Keeping the legs still, push the hips back and lower the torso until it is about level with the floor"', () => {
    const start = figureAt(entry, 0).world, low = figureAt(entry, down).world;
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      // Legs still: the knee keeps exactly the one soft bend it starts with, and the feet do not move.
      expect(kneeOf(world.near)).toBeCloseTo(180 - 2 * GOOD_MORNING_KNEE_SOFT, 6);
      expect(distance(world.near.ankle, start.near.ankle)).toBeLessThan(1e-9);
      expect(world.near.knee[0]).toBeLessThanOrEqual(start.near.knee[0] + 1e-9); // the knees never travel forward
    }
    expect(start.hip[0] - low.hip[0]).toBeGreaterThanOrEqual(8); // hips back
    expect(direction(low.hip, low.neck)).toBeLessThanOrEqual(12); // about level
  });

  test('"the bar ... across the back of the shoulders ... back straight and head up"', () => {
    for (const t of ticksOf(entry)) {
      const figure = figureAt(entry, t);
      const bar = onTrunk(figure.world, figure.world.near.hold);
      expect(Math.abs(bar.along - TRUNK)).toBeLessThanOrEqual(4); // at the shoulders,
      expect(bar.front).toBeLessThan(-3); // on the back of them,
      expect(bar.front).toBeGreaterThan(-8);
      expect(figure.curled).toBe(false); // back straight
    }
    const low = figureAt(entry, down).world;
    expect(direction(low.neck, low.head) - direction(low.hip, low.neck)).toBeGreaterThanOrEqual(15); // head up
  });

  test('"Bring the hips forward to stand tall again", over the feet the whole way', () => {
    const start = figureAt(entry, 0).world, low = figureAt(entry, down).world, end = figureAt(entry, down + turn + up).world;
    expect(direction(start.hip, start.neck)).toBeCloseTo(90, 6);
    expect(distance(end.hip, start.hip)).toBeLessThan(1e-9);
    expect(direction(end.hip, end.neck)).toBeCloseTo(90, 6);
    // Hips behind the heels, shoulders in front of the toes: the weight stays over the feet.
    expect(low.hip[0]).toBeLessThan(low.near.ankle[0]);
    expect(low.neck[0]).toBeGreaterThan(low.near.toe[0]);
  });
});

describe('Cable Row (22)', () => {
  const entry = entryOf(22);
  const [pull, pause, back] = entry.segmentDurationsMs;

  test('sat on a chair with the cable coming up from the floor: "Sit at the cable row with the feet planted and the handle held in long arms"', () => {
    const { world } = figureAt(entry, 0);
    const slab = CHAIN_MOVEMENTS['cable-row'].equipment.find((s) => s.kind === 'slab');
    expect(slab.a[1] + 2).toBeCloseTo(world.hip[1] - THIGH_HALF, 6); // on the seat,
    expect(world.hip[1]).toBeLessThan(20); // a low one
    expect(world.near.ankle[0]).toBeGreaterThan(world.hip[0] + 30); // legs out in front,
    expect(world.near.toe[1]).toBeGreaterThan(world.near.ankle[1] + 4); // the soles against the plate
    expect(ROW_STATION_PULLEY[0]).toBeGreaterThan(world.near.toe[0] + 10); // the pulley beyond the feet
    // The cable runs close to level, not steeply up from the floor.
    expect(between(direction(world.near.hold, ROW_STATION_PULLEY), 0)).toBeLessThanOrEqual(25);
    expect(elbowOf(world.near)).toBeGreaterThanOrEqual(170); // long arms
  });

  test('"Drive the elbows toward the back pockets"', () => {
    const start = figureAt(entry, 0).world, end = figureAt(entry, pull).world;
    expect(end.near.elbow[0]).toBeLessThan(end.hip[0]); // behind the body,
    expect(start.near.elbow[0] - end.near.elbow[0]).toBeGreaterThanOrEqual(15);
    expect(start.near.elbow[1] - end.near.elbow[1]).toBeGreaterThanOrEqual(4); // and down
    expect(end.near.elbow[1]).toBeLessThan(end.near.shoulder[1] - 8);
    // The handle finishes at the lower ribs, against the body.
    expect(end.near.hold[1]).toBeGreaterThan(end.hip[1] + 8);
    expect(end.near.hold[1]).toBeLessThan(end.hip[1] + 16);
    expect(end.near.hold[0] - end.hip[0]).toBeLessThanOrEqual(7);
  });

  test('"keeping the torso tall ... then return slowly"; the cable only lengthens on the pull', () => {
    expectStill(entry, BODY_STILL);
    const { world } = figureAt(entry, pull);
    expect(direction(world.hip, world.neck)).toBeCloseTo(90, 6);
    expect(back).toBeGreaterThanOrEqual(1.5 * pull);
    expect(pause).toBeGreaterThan(0);
    expect(linesOf(figureAt(entry, 0))).toHaveLength(1);
    expectCableOnlyLengthens(entry, ROW_STATION_PULLEY, 0, pull);
  });
});

describe('Seated Cable Rows (266)', () => {
  const entry = entryOf(266);
  const [pull, pause, back] = entry.segmentDurationsMs;

  test('had no seat and the legs ran steeply down: "Sit at a low cable row station with the feet on the foot plate and the knees slightly bent"', () => {
    const { world } = figureAt(entry, 0);
    const slab = CHAIN_MOVEMENTS['seated-cable-rows'].equipment.find((s) => s.kind === 'slab');
    expect(slab.a[1] + 2).toBeCloseTo(world.hip[1] - THIGH_HALF, 6); // on the seat
    for (const side of [world.near, world.far]) {
      expect(Math.abs(side.ankle[1] - side.hipJoint[1])).toBeLessThanOrEqual(4); // legs out level, not steeply down
      expect(side.ankle[0]).toBeGreaterThan(world.hip[0] + 30);
      expect(kneeOf(side)).toBeGreaterThanOrEqual(140);
      expect(kneeOf(side)).toBeLessThan(178);
    }
    expect(direction(world.hip, world.neck)).toBeCloseTo(90, 6); // "sit upright"
  });

  test('"hold the V-handle ... Keeping the torso still and the arms close to the body, pull the handle to the stomach"', () => {
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      // Both hands on the one handle, for the whole rep.
      expect(distance(world.near.hold, world.far.hold)).toBeCloseTo(2 * V_HANDLE_HALF, 9);
    }
    const start = figureAt(entry, 0).world, end = figureAt(entry, pull).world;
    expect(elbowOf(start.near)).toBeGreaterThanOrEqual(165); // "the arms straight"
    // The stomach: against the front of the body, around the middle of the trunk, below the chest.
    const touch = onTrunk(end, end.near.hold);
    expect(touch.front).toBeLessThanOrEqual(8);
    expect(touch.along).toBeGreaterThanOrEqual(8);
    expect(touch.along).toBeLessThanOrEqual(15);
    for (const [side, sign] of [[end.near, 1], [end.far, -1]]) {
      expect(Math.abs(side.elbow[2] - side.shoulder[2])).toBeLessThanOrEqual(3); // close to the body
      expect(sign * side.elbow[2]).toBeGreaterThan(0);
      expect(side.elbow[0]).toBeLessThan(end.hip[0]); // "Drive the elbows back past the ribs"
    }
    expectStill(entry, BODY_STILL);
  });

  test('"Squeeze the back, then let the handle return slowly until the arms are straight"', () => {
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(back).toBeGreaterThanOrEqual(1.5 * pull);
    expect(elbowOf(figureAt(entry, pull + pause + back).world.near)).toBeGreaterThanOrEqual(165);
    expect(linesOf(figureAt(entry, 0))).toHaveLength(2);
    expectCableOnlyLengthens(entry, NECK_ROW_PULLEY, 0, pull);
  });
});

describe('Face Pull (59)', () => {
  const entry = entryOf(59);
  const [pull, squeeze] = entry.segmentDurationsMs;

  test('was anchored low: "Set the rope at upper-chest height"', () => {
    const { world } = figureAt(entry, 0);
    expect(FACE_PULL_PULLEY[1]).toBeLessThanOrEqual(world.near.shoulder[1]);
    expect(FACE_PULL_PULLEY[1]).toBeGreaterThanOrEqual(world.near.shoulder[1] - 8);
    expect(FACE_PULL_PULLEY[0]).toBeGreaterThan(world.near.hold[0] + 10); // in front, a step away
    expect(elbowOf(world.near)).toBeGreaterThanOrEqual(155); // arms long toward it
    // The two ends of the rope start close together, inside the shoulders.
    expect(Math.abs(world.near.hold[2])).toBeLessThanOrEqual(4);
    expect(Math.abs(world.far.hold[2])).toBeLessThanOrEqual(4);
  });

  test('"Pull the rope to the bridge of your nose while splitting your hands past your ears, letting the shoulders rotate back at the end"', () => {
    const { world } = figureAt(entry, pull);
    for (const [side, sign] of [[world.near, 1], [world.far, -1]]) {
      expect(Math.abs(side.wrist[1] - world.head[1])).toBeLessThanOrEqual(BODY.hr); // at the height of the face,
      expect(sign * side.wrist[2]).toBeGreaterThan(BODY.hr); // outside the head,
      expect(side.wrist[0]).toBeLessThanOrEqual(world.head[0] + 2); // back as far as the ears
      expect(sign * (side.elbow[2] - side.shoulder[2])).toBeGreaterThanOrEqual(8); // elbows wide,
      expect(side.elbow[1]).toBeGreaterThanOrEqual(side.shoulder[1]); // and high
      // Rotated back: the forearm points up and back from the elbow.
      expect(side.wrist[1]).toBeGreaterThan(side.elbow[1] + 5);
      expect(side.wrist[0]).toBeLessThan(side.elbow[0]);
    }
    expect(distance(world.near.wrist, world.far.wrist)).toBeGreaterThanOrEqual(2 * BODY.hr + 4); // split
    expect(linesOf(figureAt(entry, pull))).toHaveLength(2);
  });

  test('"hold a one-second squeeze"; nothing but the arms moves, and the cable only lengthens on the pull', () => {
    expect(squeeze).toBeGreaterThanOrEqual(1000);
    expectStill(entry, BODY_STILL);
    expectCableOnlyLengthens(entry, FACE_PULL_PULLEY, 0, pull);
  });
});

describe('Calf Raises - With Bands (118)', () => {
  const entry = entryOf(118);
  const [up, pause, down] = entry.segmentDurationsMs;

  test('held the hands at waist height: "the handles held at shoulder height ... the hands stay quiet beside the shoulders"', () => {
    const start = figureAt(entry, 0).world;
    const offset = minus(start.near.hold, start.near.shoulder);
    expect(Math.abs(offset[1])).toBeLessThanOrEqual(3); // at shoulder height,
    expect(Math.abs(offset[0])).toBeLessThanOrEqual(8); // beside them
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      // Quiet: the hand does not move against its shoulder at all.
      expect(distance(minus(world.near.hold, world.near.shoulder), offset)).toBeLessThan(1e-9);
    }
  });

  test('"Root the forefeet and rise as high as the ankles allow"', () => {
    const start = figureAt(entry, 0).world, top = figureAt(entry, up).world;
    expect(start.near.toe[1]).toBeCloseTo(CHAIN_FOREFOOT_HEIGHT, 9);
    expect(start.near.ankle[1]).toBeCloseTo(start.near.toe[1], 9); // flat to begin with
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      expect(distance(world.near.toe, start.near.toe)).toBeLessThan(1e-9); // the forefoot is planted
      expect(kneeOf(world.near)).toBeCloseTo(180, 4); // the calves do the work: straight legs,
      expect(direction(world.hip, world.neck)).toBeCloseTo(90, 6); // tall
      expect(world.hip[1] - start.hip[1]).toBeCloseTo(world.near.ankle[1] - start.near.ankle[1], 9); // the whole body rises with the heel
    }
    expect(top.near.ankle[1] - start.near.ankle[1]).toBeGreaterThanOrEqual(3);
    expect(BAND_CALF_RAISE_TILT).toBeGreaterThanOrEqual(35);
    expect(BAND_CALF_RAISE_TILT).toBeLessThanOrEqual(50); // as far as an ankle goes, no further
  });

  test('"Pause, then lower into an owned stretch"; the band only stretches as the body rises', () => {
    expect(pause).toBeGreaterThanOrEqual(500);
    expect(down).toBeGreaterThanOrEqual(1.4 * up);
    const band = (t) => {
      const lines = linesOf(figureAt(entry, t));
      expect(lines).toHaveLength(1);
      return lengthOf(lines[0]);
    };
    expectOnlyGrows(ticksOf(entry).filter((t) => t <= up).map(band), 2);
  });
});

describe('Crunch - Hands Overhead (174)', () => {
  const entry = entryOf(174);
  const [up, pause, down] = entry.segmentDurationsMs;

  test('lifted the trunk as one stiff piece: "curl the upper body up until the shoulder blades are just off the floor"', () => {
    const start = figureAt(entry, 0).world;
    for (const t of ticksOf(entry)) {
      const figure = figureAt(entry, t);
      expect(figure.world.hip).toEqual(start.hip);
      // The lower back stays on the floor: the lower third of the spine does not move.
      for (let i = 0; i <= 12; i++) expect(figure.world.spine[i]).toEqual(start.spine[i]);
      // Wherever the shoulders are off the floor, it is by curling.
      if (figure.world.neck[1] - start.neck[1] > 1) expect(curlOf(figure.world)).toBeGreaterThan(8);
    }
    const top = figureAt(entry, up);
    expect(top.curled).toBe(true);
    expect(curlOf(top.world)).toBeGreaterThanOrEqual(30);
    // Just off the floor: the shoulders lift a little, well short of sitting up.
    expect(top.world.neck[1] - start.neck[1]).toBeGreaterThanOrEqual(3);
    expect(top.world.neck[1] - start.neck[1]).toBeLessThanOrEqual(10);
  });

  test('"Lie on your back with the knees bent and the feet flat, arms stretched overhead"', () => {
    const { world } = figureAt(entry, 0);
    expect(world.neck[1]).toBeCloseTo(world.hip[1], 9);
    for (const side of [world.near, world.far]) {
      expect(kneeOf(side)).toBeLessThan(120);
      expect(side.ankle[1]).toBeCloseTo(CHAIN_ANKLE_HEIGHT, 9);
      expect(elbowOf(side)).toBeCloseTo(180, 4);
      // Overhead: the hands are beyond the top of the head.
      expect(Math.abs(side.wrist[0] - world.hip[0])).toBeGreaterThan(Math.abs(world.head[0] - world.hip[0]) + BODY.hr);
    }
  });

  test('"Keeping the arms in line with the head"', () => {
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      expect(between(direction(world.near.shoulder, world.near.wrist), direction(world.neck, world.head))).toBeLessThanOrEqual(8);
    }
  });

  test('"Pause, then lower slowly to the start"', () => {
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(down).toBeGreaterThanOrEqual(1.5 * up);
    expect(curlOf(figureAt(entry, up + pause + down).world)).toBeCloseTo(0, 6);
  });
});
