// Triceps extensions lying on a bench, side view: Decline Dumbbell Triceps
// Extension (179), Decline EZ Bar Triceps Extension (180), Cable Lying Triceps
// Extension (156) and Low Cable Triceps Extension (237). Every bound below
// comes from the movement's own catalogue text, quoted beside it. Angles and
// lengths are measured on the model: the athlete lies face up with the head
// toward -x, and heights are above the floor.
import {
  CABLE_LYING_EXTENSION_PULLEY,
  CANONICAL_BODY_PARAMETERS,
  CHAIN_MOVEMENTS,
  DECLINE_EXTENSION_DEG,
  LOW_CABLE_EXTENSION_PULLEY,
  chainGeometry,
  layoutCanonicalFigure,
  poseAtTime,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = CANONICAL_BODY_PARAMETERS;
const BACK_HALF = BODY.sw * 0.58;
const deg = (rad) => (rad * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** The direction of a segment in the side plane, 0 to 360: 0 forward, 90 straight up, 180 back, 270 straight down. */
const direction = (from, to) => (deg(Math.atan2(to[1] - from[1], to[0] - from[0])) + 360) % 360;
/** The angle at the elbow: 180 is a straight arm. */
const elbowAngle = (arm) => {
  const a = [arm.shoulder[0] - arm.elbow[0], arm.shoulder[1] - arm.elbow[1]];
  const b = [arm.wrist[0] - arm.elbow[0], arm.wrist[1] - arm.elbow[1]];
  return deg(Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b))))));
};
/** The forehead: the point on the head's outline half-way between the crown and the front of the face. */
const forehead = (world) => {
  const along = rad(direction(world.neck, world.head) - 45);
  return [world.head[0] + BODY.hr * Math.cos(along), world.head[1] + BODY.hr * Math.sin(along)];
};
/** How far point `c` is from the segment `p` to `q`. */
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
  const figure = chainGeometry(slugOf(entry), pose.ph, BODY);
  return { ...figure, prims: layoutCanonicalFigure(pose, { ...entry, body: BODY }) };
}
/** Keyframes are first pose, second pose, second pose again, first pose, first pose. */
const turnTime = (entry) => entry.segmentDurationsMs[0];
const padOf = (slug) => CHAIN_MOVEMENTS[slug].equipment.find((s) => s.kind === 'slab');
/** How far a point is from the line through a slab. */
function offPad(pad, point) {
  const ux = pad.b[0] - pad.a[0], uy = pad.b[1] - pad.a[1];
  return Math.abs((point[0] - pad.a[0]) * uy - (point[1] - pad.a[1]) * ux) / Math.hypot(ux, uy);
}

const entry179 = entryOf(179);
const entry180 = entryOf(180);
const entry156 = entryOf(156);
const entry237 = entryOf(237);
const ALL = [
  ['Decline Dumbbell Triceps Extension', entry179],
  ['Decline EZ Bar Triceps Extension', entry180],
  ['Cable Lying Triceps Extension', entry156],
  ['Low Cable Triceps Extension', entry237],
];

describe.each(ALL)('%s: shared mechanics', (_name, entry) => {
  test('"Keeping the upper arms still": the elbows do not move, and nothing but the forearms does', () => {
    const start = figureAt(entry, 0);
    for (const t of ticksOf(entry)) {
      const now = figureAt(entry, t);
      expect(now.world.near.elbow).toEqual(start.world.near.elbow);
      expect(now.world.far.elbow).toEqual(start.world.far.elbow);
      for (const key of ['hd', 'nk', 'hp', 'kn', 'an', 'kf', 'af', 'el', 'ef']) expect(now.joints[key]).toEqual(start.joints[key]);
    }
  });

  test('the athlete lies face up with the back on the pad', () => {
    const { world } = figureAt(entry, 0);
    // Head toward -x, and the front of the body toward the ceiling.
    expect(world.neck[0]).toBeLessThan(world.hip[0] - 20);
    const pad = padOf(slugOf(entry));
    for (const point of [world.hip, world.neck]) expect(offPad(pad, point) - 2).toBeCloseTo(BACK_HALF, 6);
    expect(direction(pad.b, pad.a)).toBeCloseTo(direction(world.hip, world.neck), 6);
  });

  test('each way is one unbroken motion: the hands never stop between the two end positions', () => {
    const [first, turn, second] = entry.segmentDurationsMs;
    expect(entry.frames.map((f) => f.joints.ph)).toEqual([0, 1, 1, 0, 0]);
    const moving = (from, to) => {
      for (let t = from + 33; t < to - 66; t += 33) {
        expect(distance(figureAt(entry, t).joints.wr, figureAt(entry, t + 33).joints.wr)).toBeGreaterThan(0.01);
      }
    };
    moving(0, first);
    moving(first + turn, first + turn + second);
  });
});

describe.each([
  ['Decline Dumbbell Triceps Extension', entry179],
  ['Decline EZ Bar Triceps Extension', entry180],
])('%s: the decline bench', (_name, entry) => {
  test('"Secure the legs on a decline bench, lie back": head at the low end, knees over the high end, ankles under a roller', () => {
    const { world } = figureAt(entry, 0);
    expect(direction(world.neck, world.hip)).toBeCloseTo(DECLINE_EXTENSION_DEG, 6);
    expect(DECLINE_EXTENSION_DEG).toBeGreaterThanOrEqual(10);
    expect(DECLINE_EXTENSION_DEG).toBeLessThanOrEqual(30);
    expect(world.head[1]).toBeLessThan(world.hip[1] - 5);
    for (const side of [world.near, world.far]) {
      expect(side.knee[1]).toBeGreaterThan(side.hipJoint[1]); // the knee is the high point
      expect(side.ankle[1]).toBeLessThan(side.knee[1] - 15); // and the shin hangs down past the end of the bench
      expect(side.ankle[1]).toBeGreaterThan(8); // clear of the floor: the legs are held, not standing
    }
    const equipment = CHAIN_MOVEMENTS[slugOf(entry)].equipment;
    const roller = equipment.find((s) => s.kind === 'roller');
    // The roller sits against the front of the ankles, joined to the bench.
    expect(roller.at[0]).toBeGreaterThan(world.near.ankle[0]);
    expect(distance(roller.at, world.near.ankle)).toBeLessThanOrEqual(BODY.lw * 0.9 / 2 + 2.6 + 1);
    expect(equipment.some((s) => s.kind === 'frame' && distance(s.b, roller.at) < 1e-9)).toBe(true);
    // The board ends behind the knees.
    const pad = padOf(slugOf(entry));
    expect(Math.max(pad.a[0], pad.b[0])).toBeGreaterThan(world.hip[0] + 15);
    expect(Math.max(pad.a[0], pad.b[0])).toBeLessThan(world.near.knee[0] + 2);
  });

  test('"above the chest ... arms straight" at the start and the end, with the upper arms pointing at the ceiling', () => {
    for (const t of [0, ticksOf(entry).at(-1)]) {
      const { world } = figureAt(entry, t);
      expect(elbowAngle(world.near)).toBeCloseTo(180, 4);
      // Up from the shoulder, square to the lying chest, within 20 degrees of plumb.
      expect(Math.abs(direction(world.near.shoulder, world.near.elbow) - 90)).toBeLessThanOrEqual(20);
      expect(world.near.wrist[1]).toBeGreaterThan(world.neck[1] + 20);
    }
  });

  test('"Lower slowly": the lowering takes longer than the return', () => {
    const [down, , up] = entry.segmentDurationsMs;
    expect(down).toBeGreaterThanOrEqual(1.4 * up);
  });
});

describe('Decline Dumbbell Triceps Extension (179)', () => {
  test('"bend the elbows to lower the dumbbells beside the ears"', () => {
    const { world } = figureAt(entry179, turnTime(entry179));
    // Beside the ears: from the side, the hands are level with the head and overlap it.
    expect(distance(world.near.wrist, world.head)).toBeLessThanOrEqual(BODY.hr);
    expect(distance(world.near.wrist, world.head)).toBeGreaterThanOrEqual(BODY.hr - 3);
  });

  test('"palms facing each other": a dumbbell in each hand, seen along its length and square to its forearm', () => {
    for (const t of ticksOf(entry179)) {
      const { joints, prims } = figureAt(entry179, t);
      for (const [hand, elbow] of [[joints.wr, joints.el], [joints.wf, joints.ef]]) {
        const shaft = prims.find((p) => p.kind === 'bone' && p.w === 2.2
          && Math.abs((p.x1 + p.x2) / 2 - hand[0]) < 1e-9 && Math.abs((p.y1 + p.y2) / 2 - hand[1]) < 1e-9);
        expect(shaft).toBeDefined();
        const along = (shaft.x2 - shaft.x1) * (hand[0] - elbow[0]) + (shaft.y2 - shaft.y1) * (hand[1] - elbow[1]);
        expect(Math.abs(along)).toBeLessThan(1e-9);
      }
    }
  });
});

describe('Decline EZ Bar Triceps Extension (180)', () => {
  test('"bend the elbows to lower the bar toward the forehead": it stops just above the forehead, not beside the head', () => {
    const { world } = figureAt(entry180, turnTime(entry180));
    expect(distance(world.near.wrist, forehead(world))).toBeLessThanOrEqual(5);
    expect(distance(world.near.wrist, world.head)).toBeGreaterThan(BODY.hr + 1);
    // And that is as close as the bar ever gets.
    for (const t of ticksOf(entry180)) {
      const now = figureAt(entry180, t).world;
      expect(distance(now.near.wrist, forehead(now))).toBeGreaterThanOrEqual(distance(world.near.wrist, forehead(world)) - 1e-9);
    }
  });

  test('"hold the EZ bar": one cambered bar through both hands, read end-on', () => {
    for (const t of ticksOf(entry180)) {
      const { joints, prims } = figureAt(entry180, t);
      const plates = prims.filter((p) => p.kind === 'circle' && p.r === 6.6);
      expect(plates).toHaveLength(1);
      expect([plates[0].cx, plates[0].cy]).toEqual(joints.wr);
      // The camber: two shaft pieces leaving the hub at an angle.
      expect(prims.filter((p) => p.kind === 'bone' && p.w === 2.4 && p.x1 === joints.wr[0] && p.y1 === joints.wr[1])).toHaveLength(2);
    }
  });
});

describe.each([
  ['Cable Lying Triceps Extension', entry156, CABLE_LYING_EXTENSION_PULLEY],
  ['Low Cable Triceps Extension', entry237, LOW_CABLE_EXTENSION_PULLEY],
])('%s: flat bench and low pulley', (_name, entry, pulley) => {
  test('"head toward" a low pulley: the trunk is level, the pulley is beyond the head and below the athlete', () => {
    const { world } = figureAt(entry, 0);
    expect(world.neck[1]).toBeCloseTo(world.hip[1], 9);
    expect(pulley[0]).toBeLessThan(world.head[0] - BODY.hr - 5);
    expect(pulley[1]).toBeLessThan(world.hip[1]);
    // Feet flat on the floor past the end of the bench.
    const pad = padOf(slugOf(entry));
    expect(world.near.ankle[0]).toBeGreaterThan(Math.max(pad.a[0], pad.b[0]) + 5);
  });

  test('"Upper arms point at the ceiling"', () => {
    const { world } = figureAt(entry, 0);
    expect(direction(world.near.shoulder, world.near.elbow)).toBeCloseTo(90, 9);
  });

  test('one cable from the pulley to the hands: it clears the bench and the head, and straightening the arms only lengthens it', () => {
    const pad = padOf(slugOf(entry));
    const benchEnd = Math.min(pad.a[0], pad.b[0]);
    const benchTop = pad.a[1] + 2;
    const straightening = entry === entry156
      ? [entry.segmentDurationsMs[0] + entry.segmentDurationsMs[1], entry.segmentDurationsMs[0] + entry.segmentDurationsMs[1] + entry.segmentDurationsMs[2]]
      : [0, entry.segmentDurationsMs[0]];
    const lengths = [];
    for (const t of ticksOf(entry)) {
      const { world, joints, prims, project } = figureAt(entry, t);
      const cables = prims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4);
      expect(cables).toHaveLength(1);
      const from = project([pulley[0], pulley[1], 0]);
      expect([cables[0].x1, cables[0].y1]).toEqual(from);
      expect([cables[0].x2, cables[0].y2]).toEqual(joints.wr);
      // Clear of the head by more than the cable's own half-width.
      expect(segmentDistance(pulley, world.near.wrist, world.head)).toBeGreaterThan(BODY.hr + 0.7);
      // Past the end of the bench it is already above the pad.
      const k = (benchEnd - pulley[0]) / (world.near.wrist[0] - pulley[0]);
      expect(pulley[1] + (world.near.wrist[1] - pulley[1]) * k).toBeGreaterThan(benchTop + 0.7);
      if (t >= straightening[0] && t <= straightening[1]) lengths.push(distance(pulley, world.near.wrist));
    }
    for (let i = 1; i < lengths.length; i++) expect(lengths[i]).toBeGreaterThanOrEqual(lengths[i - 1] - 1e-9);
    expect(lengths.at(-1) - lengths[0]).toBeGreaterThan(5);
  });
});

describe('Cable Lying Triceps Extension (156)', () => {
  test('"arms straight above the chest" at the start', () => {
    const { world } = figureAt(entry156, 0);
    expect(elbowAngle(world.near)).toBeCloseTo(180, 4);
    expect(world.near.wrist[0]).toBeCloseTo(world.near.shoulder[0], 9);
  });

  test('"lower the bar until it is just above the forehead"', () => {
    const { world } = figureAt(entry156, turnTime(entry156));
    expect(distance(world.near.wrist, forehead(world))).toBeLessThanOrEqual(5);
    expect(distance(world.near.wrist, world.head)).toBeGreaterThan(BODY.hr + 1);
  });

  test('"Straighten the elbows to return the bar above the chest and pause"', () => {
    const [down, turn, up, pause] = entry156.segmentDurationsMs;
    expect(pause).toBeGreaterThanOrEqual(500);
    expect(down).toBeGreaterThanOrEqual(1.4 * up); // "Lower slowly to the forehead line."
    const held = [0, pause / 2, pause].map((dt) => figureAt(entry156, down + turn + up + dt).world.near);
    for (const arm of held) expect(elbowAngle(arm)).toBeCloseTo(180, 4);
  });

  test('a straight bar, read end-on at the hands', () => {
    const { joints, prims } = figureAt(entry156, 0);
    const bar = prims.filter((p) => p.kind === 'circle' && p.r === 2.4 && p.cx === joints.wr[0] && p.cy === joints.wr[1]);
    expect(bar).toHaveLength(1);
  });
});

describe('Low Cable Triceps Extension (237)', () => {
  test('"upper arms pointing at the ceiling and elbows bent to a right angle" at the start, hands toward the pulley', () => {
    const { world } = figureAt(entry237, 0);
    expect(elbowAngle(world.near)).toBeCloseTo(90, 6);
    expect(world.near.wrist[1]).toBeCloseTo(world.near.elbow[1], 9);
    expect(world.near.wrist[0]).toBeLessThan(world.near.elbow[0]);
  });

  test('"straighten the elbows until the forearms are vertical"', () => {
    const { world } = figureAt(entry237, turnTime(entry237));
    expect(direction(world.near.elbow, world.near.wrist)).toBeCloseTo(90, 6);
  });

  test('"Squeeze, then let the elbows bend slowly back to a right angle", and no further', () => {
    const [up, squeeze, down] = entry237.segmentDurationsMs;
    expect(squeeze).toBeGreaterThanOrEqual(400);
    expect(down).toBeGreaterThanOrEqual(1.5 * up);
    for (const t of ticksOf(entry237)) expect(elbowAngle(figureAt(entry237, t).world.near)).toBeGreaterThanOrEqual(90 - 1e-6);
  });

  test('"hold the rope ends": a rope end in each hand, no bar', () => {
    const { joints, prims } = figureAt(entry237, 0);
    expect(prims.filter((p) => p.kind === 'circle' && p.r === 2.2 && p.fill !== 'line')).toHaveLength(2);
    expect(prims.some((p) => p.kind === 'circle' && p.r === 2.2 && p.cx === joints.wr[0] && p.cy === joints.wr[1])).toBe(true);
    expect(prims.filter((p) => p.kind === 'circle' && (p.r === 2.4 || p.r === 6.6))).toHaveLength(0);
  });
});

test('the four lying extensions are four drawings, not one drawing with new captions', () => {
  const ends = ALL.map(([, e]) => [figureAt(e, 0), figureAt(e, turnTime(e))]);
  for (let i = 0; i < ends.length; i++) {
    for (let k = i + 1; k < ends.length; k++) {
      const same = ends[i].every((figure, at) => ['hd', 'hp', 'el', 'wr'].every((key) => distance(figure.joints[key], ends[k][at].joints[key]) < 1e-6));
      expect(same).toBe(false);
    }
  }
  // The two decline movements share a bench; the dumbbells go beside the head, the bar stops above the forehead.
  expect(distance(ends[0][1].joints.wr, ends[1][1].joints.wr)).toBeGreaterThan(2);
  // The two cable movements start at opposite ends of the range.
  expect(elbowAngle(ends[2][0].world.near)).toBeCloseTo(180, 4);
  expect(elbowAngle(ends[3][0].world.near)).toBeCloseTo(90, 4);
});
