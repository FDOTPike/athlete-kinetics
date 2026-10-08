// Eleven older drawings contradicted their own catalogue text and were redrawn
// on 8 October 2026 at the owner's request. Each block opens with the thing the
// old drawing got wrong, then holds the rest of the text. Measured on the 3D
// model: x forward, y up from the floor, z across the body toward the viewer.
import {
  CABLE_CRUNCH_PULLEY,
  CANONICAL_BODY_PARAMETERS,
  CHAIN_ANKLE_HEIGHT,
  CHAIN_MOVEMENTS,
  INTERNAL_ROTATION_ANCHOR,
  NECK_ROW_PULLEY,
  PALLOF_BAND_ANCHOR,
  PALLOF_PULLEY,
  PULL_THROUGH_PULLEY,
  SEATED_CRUNCH_PULLEY,
  STEP_BOX,
  chainGeometry,
  layoutCanonicalFigure,
  poseAtTime,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = CANONICAL_BODY_PARAMETERS;
const THIGH_HALF = (BODY.lw * 1.18) / 2;
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
/** How far point `c` is from the segment `p` to `q`, in the side plane. */
function segmentDistance(p, q, c) {
  const ux = q[0] - p[0], uy = q[1] - p[1];
  const k = Math.max(0, Math.min(1, ((c[0] - p[0]) * ux + (c[1] - p[1]) * uy) / (ux * ux + uy * uy)));
  return Math.hypot(c[0] - (p[0] + ux * k), c[1] - (p[1] + uy * k));
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
/** When each keyframe is reached. */
const keyTimes = (entry) => entry.segmentDurationsMs.reduce((times, d) => [...times, times.at(-1) + d], [0]);
const linesOf = (figure) => figure.prims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4);
// A cable or band is drawn 1.4 units wide. An arm that swings on its joints
// does not carry the hand along a perfectly straight line, so a line can give
// back a few hundredths of a unit as the limb settles. A tenth of a unit, a
// fourteenth of the line's own width, is the most it may ever give back.
const SLACK = 0.1;
/** A cable or band that only lengthens between two times and is never shorter than at `from`. */
function expectOnlyLengthens(entry, anchor, from, to) {
  const fixed = anchor.length === 3 ? anchor : [...anchor, 0];
  const length = (t) => distance(fixed, figureAt(entry, t).world.near.hold);
  const lengths = ticksOf(entry).filter((t) => t >= from && t <= to).map(length);
  let longest = lengths[0];
  for (const now of lengths) {
    expect(now).toBeGreaterThanOrEqual(longest - SLACK);
    longest = Math.max(longest, now);
  }
  expect(lengths.at(-1)).toBeGreaterThan(lengths[0] + 1);
  for (const t of ticksOf(entry)) expect(length(t)).toBeGreaterThanOrEqual(lengths[0] - SLACK);
}
/** Joints that must not move at all through the cycle. */
function expectStill(entry, keys) {
  const start = figureAt(entry, 0).joints;
  for (const t of ticksOf(entry)) {
    const now = figureAt(entry, t).joints;
    for (const key of keys) expect(distance(now[key], start[key])).toBeLessThan(1e-9);
  }
}

const IDS = [161, 39, 173, 226, 25, 251, 40, 286, 115, 224, 238];

test.each(IDS.map((id) => [entryOf(id).name, entryOf(id)]))('%s is a pending redraw that keeps its older draft id and says why it was redrawn', (_name, entry) => {
  expect(entry.status).toBe('pending');
  expect(CHAIN_MOVEMENTS[slugOf(entry)]).toBeDefined();
  expect(entry.previewId).toBe(slugOf(entry).replaceAll('-', '_'));
  expect(entry.reason).toContain('Redrawn on 8 October 2026');
  expect(entry.frames[0].joints.ph).toBe(entry.frames.at(-1).joints.ph);
});

describe('Cable Seated Crunch (161)', () => {
  const entry = entryOf(161);
  const [down, pause, up] = entry.segmentDurationsMs;

  test('was drawn lying on the floor: "Sit on a flat bench with your back to a high pulley"', () => {
    const { world } = figureAt(entry, 0);
    expect(direction(world.hip, world.neck)).toBeCloseTo(90, 6); // sitting tall, not lying
    for (const side of [world.near, world.far]) {
      expect(side.knee[1]).toBeCloseTo(side.hipJoint[1], 9);
      expect(side.ankle[1]).toBeCloseTo(CHAIN_ANKLE_HEIGHT, 9);
    }
    const slab = CHAIN_MOVEMENTS['cable-seated-crunch'].equipment.find((s) => s.kind === 'slab');
    expect(slab.a[1] + 2).toBeCloseTo(world.hip[1] - THIGH_HALF, 6); // on the bench
    expect(SEATED_CRUNCH_PULLEY[0]).toBeLessThan(world.hip[0] - 20); // the pulley is behind the back
    expect(SEATED_CRUNCH_PULLEY[1]).toBeGreaterThan(world.head[1] + BODY.hr); // and high
  });

  test('"Keeping the hips still, curl the torso forward so the elbows travel toward the hips"', () => {
    expectStill(entry, ['hp', 'kn', 'an', 'kf', 'af']);
    const start = figureAt(entry, 0).world, bottom = figureAt(entry, down).world;
    expect(curlOf(bottom)).toBeGreaterThanOrEqual(55);
    // Seated, the hips are the crease of the lap. The elbows come down toward it,
    // and finish nearer the hip joint than they began, not swung back behind the ribs.
    const aboveLap = (world) => world.near.elbow[1] - world.near.hipJoint[1];
    expect(aboveLap(start) - aboveLap(bottom)).toBeGreaterThanOrEqual(4);
    expect(distance(flat(bottom.near.elbow), flat(bottom.hip))).toBeLessThan(distance(flat(start.near.elbow), flat(start.hip)));
    expect(bottom.near.elbow[0]).toBeGreaterThan(start.near.elbow[0]); // forward with the trunk
    expect(direction(bottom.near.shoulder, bottom.near.elbow)).toBeGreaterThan(240); // hanging down,
    expect(direction(bottom.near.shoulder, bottom.near.elbow)).toBeLessThan(290); // not held out or back
    // "hold the rope ends over the shoulders against the upper chest", for the whole rep.
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      expect(distance(flat(world.near.wrist), flat(world.neck))).toBeLessThanOrEqual(5);
    }
  });

  test('"Pause, then return slowly to sitting tall", with the cable only lengthening on the way down', () => {
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(up).toBeGreaterThanOrEqual(1.5 * down);
    expect(curlOf(figureAt(entry, down + pause + up).world)).toBeCloseTo(0, 6);
    expectOnlyLengthens(entry, SEATED_CRUNCH_PULLEY, 0, down);
  });
});

describe('Cable Crunch (39)', () => {
  const entry = entryOf(39);
  const [down, , up] = entry.segmentDurationsMs;

  test('was a stiff hinge at the hips: "rounding your upper spine ... while your hips stay frozen"', () => {
    const start = figureAt(entry, 0).world;
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      expect(world.hip).toEqual(start.hip);
      // Frozen: the lower third of the spine does not move at all. Only the upper spine rounds.
      for (let i = 0; i <= 12; i++) expect(world.spine[i]).toEqual(start.spine[i]);
    }
    const bottom = figureAt(entry, down);
    expect(curlOf(bottom.world)).toBeGreaterThanOrEqual(70);
    expect(bottom.curled).toBe(true);
  });

  test('"Kneel" with the "rope held to your collarbones", "driving your elbows towards your thighs"', () => {
    const start = figureAt(entry, 0).world, bottom = figureAt(entry, down).world;
    expect(start.near.knee[1]).toBeLessThanOrEqual(THIGH_HALF + 0.5); // knees on the floor
    expect(start.near.ankle[0]).toBeLessThan(start.near.knee[0] - 20); // shins along the floor behind
    // At the collarbones: within a hand of the top of the chest, for the whole rep.
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      expect(distance(flat(world.near.wrist), flat(world.neck))).toBeLessThanOrEqual(5);
    }
    // Toward the thighs: the elbows come down, finish nearer the thigh than they
    // began, and point down at it instead of swinging back behind the ribs.
    const toThigh = (world) => segmentDistance(world.near.hipJoint, world.near.knee, world.near.elbow);
    expect(toThigh(start) - toThigh(bottom)).toBeGreaterThanOrEqual(2);
    expect(start.near.elbow[1] - bottom.near.elbow[1]).toBeGreaterThanOrEqual(5);
    expect(direction(bottom.near.shoulder, bottom.near.elbow)).toBeGreaterThan(225);
    expect(direction(bottom.near.shoulder, bottom.near.elbow)).toBeLessThan(270);
  });

  test('"far enough from the stack that the cable stays loaded", "Unroll slowly"', () => {
    expect(up).toBeGreaterThanOrEqual(1.5 * down);
    expectOnlyLengthens(entry, CABLE_CRUNCH_PULLEY, 0, down);
  });
});

describe('Cross-Body Crunch (173)', () => {
  const entry = entryOf(173);
  const times = keyTimes(entry);
  // Keyframes: lying, one side, one side held, lying, other side, other side held, lying.
  const [rest, oneWay, , , otherWay] = times;

  test('was drawn with straight legs: "knees bent and the feet flat"', () => {
    const { world } = figureAt(entry, rest);
    for (const side of [world.near, world.far]) {
      expect(kneeOf(side)).toBeLessThan(120);
      expect(side.ankle[1]).toBeCloseTo(CHAIN_ANKLE_HEIGHT, 9);
      expect(side.knee[1]).toBeGreaterThan(world.hip[1] + 10);
    }
    expect(world.neck[1]).toBeCloseTo(world.hip[1], 9); // lying on the back
  });

  test('had no knee coming in: "one elbow and shoulder travel across the body while the opposite knee comes in to meet them"', () => {
    const lying = figureAt(entry, rest), a = figureAt(entry, oneWay), b = figureAt(entry, otherWay);
    // One side: the near shoulder leads across, the far knee comes in, the near foot stays down.
    expect(a.angles.twist).toBeGreaterThanOrEqual(25);
    expect(curlOf(a.world)).toBeGreaterThanOrEqual(35);
    expect(a.world.near.ankle).toEqual(lying.world.near.ankle);
    expect(a.world.far.ankle[1]).toBeGreaterThan(CHAIN_ANKLE_HEIGHT + 10);
    expect(distance(lying.world.near.elbow, lying.world.far.knee) - distance(a.world.near.elbow, a.world.far.knee)).toBeGreaterThanOrEqual(10);
    // "then repeat to the other side": the mirror of it.
    expect(b.angles.twist).toBeLessThanOrEqual(-25);
    expect(b.world.far.ankle).toEqual(lying.world.far.ankle);
    expect(b.world.near.ankle[1]).toBeGreaterThan(CHAIN_ANKLE_HEIGHT + 10);
    expect(distance(lying.world.far.elbow, lying.world.near.knee) - distance(b.world.far.elbow, b.world.near.knee)).toBeGreaterThanOrEqual(10);
  });

  test('"Lower slowly to the start"; the hips stay on the floor and the hands by the head', () => {
    const [up, , down] = entry.segmentDurationsMs;
    expect(down).toBeGreaterThanOrEqual(1.5 * up);
    const hip = figureAt(entry, 0).world.hip;
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      expect(world.hip).toEqual(hip);
      expect(distance(flat(world.near.wrist), flat(world.head))).toBeLessThanOrEqual(BODY.hr + 4);
    }
  });
});

describe('Janda Sit-Up (226)', () => {
  const entry = entryOf(226);
  const [up, , down] = entry.segmentDurationsMs;

  test('was drawn with straight legs: "knees bent to about ninety degrees and the feet flat on the floor"', () => {
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      for (const side of [world.near, world.far]) {
        expect(kneeOf(side)).toBeCloseTo(90, 6);
        expect(side.ankle[1]).toBeCloseTo(CHAIN_ANKLE_HEIGHT, 9);
      }
    }
  });

  test('"curl the trunk up over a slow three to six second count ... across a matching count"', () => {
    expect(up).toBeGreaterThanOrEqual(3000);
    expect(up).toBeLessThanOrEqual(6000);
    expect(down).toBe(up);
    const start = figureAt(entry, 0).world, top = figureAt(entry, up).world;
    expect(top.neck[1]).toBeGreaterThan(start.neck[1] + 15);
    expect(curlOf(top)).toBeGreaterThanOrEqual(40); // curled, not levered up stiff
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      if (world.neck[1] - start.neck[1] > 5) expect(curlOf(world)).toBeGreaterThan(20);
      expect(world.hip).toEqual(start.hip);
    }
  });
});

describe.each([
  ['Pallof Press', entryOf(25), PALLOF_BAND_ANCHOR],
  ['Pallof Press With Rotation', entryOf(251), PALLOF_PULLEY],
])('%s', (_name, entry, anchor) => {
  const times = keyTimes(entry);

  test('was anchored behind the back: "Stand side-on" to the anchor', () => {
    const { world } = figureAt(entry, 0);
    // Out to the athlete's side: neither in front of the hips nor behind them.
    expect(Math.abs(anchor[0] - world.hip[0])).toBeLessThanOrEqual(3);
    expect(Math.abs(anchor[2])).toBeGreaterThanOrEqual(30);
    expect(entry.view).toBe('oblique');
    const lines = linesOf(figureAt(entry, 0));
    expect(lines).toHaveLength(1);
  });

  test('"hold it at" the chest, then press "straight" out to long arms', () => {
    const start = figureAt(entry, 0).world, pressed = figureAt(entry, times[1]).world;
    for (const side of [start.near, start.far]) {
      expect(Math.abs(side.wrist[2])).toBeLessThanOrEqual(5); // at the centre
      expect(side.wrist[0]).toBeLessThanOrEqual(8); // against the chest
      expect(side.shoulder[1] - side.wrist[1]).toBeGreaterThan(3);
    }
    for (const side of [pressed.near, pressed.far]) {
      expect(elbowOf(side)).toBeGreaterThanOrEqual(170);
      expect(side.wrist[0]).toBeGreaterThanOrEqual(20); // straight out in front
      expect(Math.abs(side.wrist[2])).toBeLessThanOrEqual(3); // not drifting to either side
    }
    expect(pressed.near.wrist[0] - start.near.wrist[0]).toBeGreaterThanOrEqual(14);
  });

  test('the hips and legs do not move', () => {
    expectStill(entry, ['hp', 'kn', 'an', 'kf', 'af', 'nk', 'hd']);
  });
});

describe('Pallof Press (25)', () => {
  const entry = entryOf(25);
  test('"while the shoulders and hips stay square. Pause before returning to the chest"', () => {
    const [out, pause] = entry.segmentDurationsMs;
    expect(pause).toBeGreaterThanOrEqual(1000);
    for (const t of ticksOf(entry)) expect(figureAt(entry, t).angles.twist).toBe(0);
    const held = [0, pause / 2, pause].map((dt) => figureAt(entry, out + dt).world.near.wrist);
    expect(held[1]).toEqual(held[0]);
    expect(held[2]).toEqual(held[0]);
    expectOnlyLengthens(entry, PALLOF_BAND_ANCHOR, 0, out);
  });
});

describe('Pallof Press With Rotation (251)', () => {
  const entry = entryOf(251);
  const times = keyTimes(entry);
  // Keyframes: at the chest, pressed, turned, turned and held, pressed, at the chest.
  test('"Set the pulley at shoulder height ... an arm\'s length away"', () => {
    const { world } = figureAt(entry, 0);
    expect(Math.abs(PALLOF_PULLEY[1] - world.near.shoulder[1])).toBeLessThanOrEqual(1);
    expect(Math.abs(PALLOF_PULLEY[2])).toBeGreaterThanOrEqual(20);
    expect(Math.abs(PALLOF_PULLEY[2])).toBeLessThanOrEqual(40);
  });

  test('"keeping the hips still and the arms straight, turn the torso away from the pulley through a quarter turn"', () => {
    const pressed = figureAt(entry, times[1]), turned = figureAt(entry, times[2]);
    expect(pressed.angles.twist).toBeCloseTo(0, 9);
    expect(turned.angles.twist).toBeCloseTo(90, 9);
    const line = (world) => minus(world.near.shoulder, world.far.shoulder);
    const a = line(pressed.world), b = line(turned.world);
    expect(deg(Math.acos((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b))))).toBeCloseTo(90, 4);
    // Away from the pulley: the hands finish on the other side of the body from it.
    expect(Math.sign(turned.world.near.wrist[2])).toBe(-Math.sign(PALLOF_PULLEY[2]));
    expect(Math.abs(turned.world.near.wrist[2])).toBeGreaterThanOrEqual(18);
    // Arms straight for the whole turn, both ways.
    for (const t of ticksOf(entry).filter((tick) => tick >= times[1] && tick <= times[4])) {
      const { world } = figureAt(entry, t);
      expect(elbowOf(world.near)).toBeGreaterThanOrEqual(170);
      expect(elbowOf(world.far)).toBeGreaterThanOrEqual(170);
    }
  });

  test('"Return slowly to face forward and bring the handle back to the chest"', () => {
    const [, turn, , back] = entry.segmentDurationsMs;
    expect(back).toBeGreaterThanOrEqual(1.4 * turn);
    expectOnlyLengthens(entry, PALLOF_PULLEY, 0, times[2]);
    expect(entry.frames.at(-1).caption).toContain('face the other way');
  });
});

describe('Cable Pull-Through (40)', () => {
  const entry = entryOf(40);
  const [down, turn, up] = entry.segmentDurationsMs;

  test('had the cable in front: "Face away from a low cable with a rope between your legs"', () => {
    const figure = figureAt(entry, 0);
    const { world } = figure;
    expect(world.near.toe[0]).toBeGreaterThan(world.near.ankle[0]); // facing +x
    expect(PULL_THROUGH_PULLEY[0]).toBeLessThan(world.near.ankle[0] - 20); // the pulley is behind
    expect(PULL_THROUGH_PULLEY[1]).toBeLessThan(10); // and low
    // Between the legs: the cable is painted before the near thigh, so the near leg covers it.
    const cable = figure.prims.findIndex((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4);
    const nearThigh = figure.prims.findIndex((p) => p.kind === 'bone' && p.x1 === figure.joints.nLeg[0] && p.y1 === figure.joints.nLeg[1] && p.color === 'textHi');
    expect(cable).toBeGreaterThanOrEqual(0);
    expect(cable).toBeLessThan(nearThigh);
    expect(Math.abs(world.near.wrist[1] - world.hip[1])).toBeLessThanOrEqual(3); // "held at your hips"
  });

  test('"push your hips back and hinge forward with a flat back", feet planted', () => {
    const start = figureAt(entry, 0), bottom = figureAt(entry, down);
    expect(start.world.hip[0] - bottom.world.hip[0]).toBeGreaterThanOrEqual(6); // hips back
    expect(direction(bottom.world.hip, bottom.world.neck)).toBeLessThanOrEqual(35); // hinged well forward
    for (const t of ticksOf(entry)) {
      const now = figureAt(entry, t);
      expect(now.curled).toBe(false); // flat back
      expect(now.world.near.ankle).toEqual(start.world.near.ankle);
      expect(kneeOf(now.world.near)).toBeGreaterThanOrEqual(140); // a hinge over soft knees, not a squat
    }
  });

  test('"Drive your hips forward to stand tall": the cable only lengthens as the athlete stands', () => {
    const end = figureAt(entry, down + turn + up).world;
    expect(direction(end.hip, end.neck)).toBeCloseTo(90, 6);
    expectOnlyLengthens(entry, PULL_THROUGH_PULLEY, down + turn, down + turn + up);
  });
});

describe('Step-up with Knee Raise (286)', () => {
  const entry = entryOf(286);
  const times = keyTimes(entry);
  // Keyframes: on the floor, foot on the box, tall with the knee up, held, foot on the box, on the floor, rest.
  const [floor, placed, tall] = times;

  test('"Stand facing a box ... feet together"', () => {
    const { world } = figureAt(entry, floor);
    expect(world.near.ankle[0]).toBeCloseTo(world.far.ankle[0], 9);
    expect(world.near.ankle[1]).toBeCloseTo(CHAIN_ANKLE_HEIGHT, 9);
    expect(STEP_BOX.front).toBeGreaterThan(world.near.toe[0]); // the box is in front of the toes
  });

  test('"placing one whole foot on the top": flat, on the box, and it stays there', () => {
    for (const t of ticksOf(entry).filter((tick) => tick >= placed && tick <= times[4])) {
      const { world } = figureAt(entry, t);
      expect(world.near.ankle[1]).toBeCloseTo(STEP_BOX.top + CHAIN_ANKLE_HEIGHT, 6);
      expect(world.near.toe[1]).toBeCloseTo(world.near.ankle[1], 6);
      expect(world.near.ankle[0]).toBeGreaterThan(STEP_BOX.front);
      expect(world.near.toe[0]).toBeLessThan(STEP_BOX.back);
    }
    // The floor foot does not jump: it is still planted when the lead foot lands.
    const start = figureAt(entry, floor).world;
    for (const t of ticksOf(entry).filter((tick) => tick <= placed)) expect(figureAt(entry, t).world.far.ankle).toEqual(start.far.ankle);
  });

  test('never stood tall, and kicked the free leg back: "stand tall ... drive the opposite knee up as high as you can"', () => {
    const { world } = figureAt(entry, tall);
    // Tall: the standing leg is straight and the hips are over the foot on the box.
    expect(kneeOf(world.near)).toBeGreaterThanOrEqual(165);
    expect(Math.abs(world.hip[0] - world.near.ankle[0])).toBeLessThanOrEqual(2);
    expect(direction(world.hip, world.neck)).toBeCloseTo(90, 6);
    // The knee drives UP, in front: at or above hip height, ahead of the hips, the foot hanging below it.
    expect(world.far.knee[1]).toBeGreaterThanOrEqual(world.far.hipJoint[1]);
    expect(world.far.knee[0]).toBeGreaterThan(world.hip[0] + 15);
    expect(world.far.ankle[1]).toBeLessThan(world.far.knee[1] - 15);
    // At no point on the box does the free leg trail out behind.
    for (const t of ticksOf(entry).filter((tick) => tick >= times[2] && tick <= times[3])) {
      expect(figureAt(entry, t).world.far.ankle[0]).toBeGreaterThan(figureAt(entry, t).world.hip[0]);
    }
  });

  test('"Reverse the motion to step down, then repeat on the other leg"', () => {
    const end = figureAt(entry, times[5]).world, start = figureAt(entry, floor).world;
    expect(distance(end.near.ankle, start.near.ankle)).toBeLessThan(1e-9);
    expect(distance(end.far.ankle, start.far.ankle)).toBeLessThan(1e-9);
    expect(entry.frames.at(-1).caption).toContain('other leg');
  });
});

describe.each([
  ['Cable Internal Rotation', entryOf(115)],
  ['Internal Rotation with Band', entryOf(224)],
])('%s', (_name, entry) => {
  const [turn, pause, back] = entry.segmentDurationsMs;

  test('had the free arm mirroring the working one: only the working forearm moves', () => {
    const start = figureAt(entry, 0);
    for (const t of ticksOf(entry)) {
      const now = figureAt(entry, t);
      expect(now.world.far.elbow).toEqual(start.world.far.elbow);
      expect(now.world.far.wrist).toEqual(start.world.far.wrist);
      expect(now.world.near.elbow).toEqual(start.world.near.elbow); // "the upper arm stays quiet" / "Elbow stays pinned"
      for (const key of ['hd', 'nk', 'hp', 'kn', 'an', 'kf', 'af']) expect(now.joints[key]).toEqual(start.joints[key]);
    }
    // The free arm hangs at the side.
    expect(start.world.far.wrist[1]).toBeLessThan(start.world.far.shoulder[1] - 20);
  });

  test('side-on to an anchor at elbow height, the elbow at a right angle beside the ribs', () => {
    expect(entry.view).toBe('front');
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      expect(elbowOf(world.near)).toBeCloseTo(90, 6);
      expect(world.near.wrist[1]).toBeCloseTo(world.near.elbow[1], 9); // forearm level
      expect(world.near.elbow[2]).toBeCloseTo(world.near.shoulder[2], 9); // upper arm straight down the side
      expect(Math.abs(INTERNAL_ROTATION_ANCHOR[1] - world.near.elbow[1])).toBeLessThanOrEqual(1);
    }
    expect(Math.sign(INTERNAL_ROTATION_ANCHOR[2])).toBe(Math.sign(figureAt(entry, 0).world.near.shoulder[2])); // on the working side
  });

  test('the forearm starts pointing at the anchor and turns in across the body; the line only lengthens', () => {
    const start = figureAt(entry, 0).world.near, end = figureAt(entry, turn).world.near;
    expect(start.wrist[2] - start.elbow[2]).toBeGreaterThanOrEqual(10); // out toward the anchor
    expect(end.wrist[2]).toBeLessThan(start.elbow[2] - 5); // in across the body
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(back).toBeGreaterThan(turn);
    expectOnlyLengthens(entry, INTERNAL_ROTATION_ANCHOR, 0, turn);
  });
});

test('Cable Internal Rotation stops "when the hand reaches the centreline"; the band version goes "in across the body as far as you can"', () => {
  const cable = figureAt(entryOf(115), entryOf(115).segmentDurationsMs[0]).world.near.wrist;
  const band = figureAt(entryOf(224), entryOf(224).segmentDurationsMs[0]).world.near.wrist;
  expect(Math.abs(cable[2])).toBeLessThanOrEqual(1.5);
  expect(band[2]).toBeLessThan(cable[2] - 1); // past the centreline
  expect(entryOf(224).frames.at(-1).caption).toContain('change sides');
});

describe('Low Pulley Row To Neck (238)', () => {
  const entry = entryOf(238);
  const [pull, pause, back] = entry.segmentDurationsMs;

  test('was drawn standing: "Sit at a low cable row station ... back upright, knees slightly bent"', () => {
    const { world } = figureAt(entry, 0);
    expect(world.hip[1]).toBeLessThan(25); // on a low seat, not standing
    const slab = CHAIN_MOVEMENTS['low-pulley-row-to-neck'].equipment.find((s) => s.kind === 'slab');
    expect(slab.a[1] + 2).toBeCloseTo(world.hip[1] - THIGH_HALF, 6);
    expect(world.near.ankle[0]).toBeGreaterThan(world.hip[0] + 30); // legs out in front to the plate
    expect(kneeOf(world.near)).toBeGreaterThanOrEqual(140);
    expect(kneeOf(world.near)).toBeLessThan(178); // slightly bent
    expect(direction(world.hip, world.neck)).toBeCloseTo(90, 6);
    expect(NECK_ROW_PULLEY[0]).toBeGreaterThan(world.near.ankle[0] + 10); // the pulley is beyond the feet,
    expect(NECK_ROW_PULLEY[1]).toBeLessThan(world.near.shoulder[1] - 15); // and low
  });

  test('"arms straight in front", then "the hands are beside the ears and the upper arms are level with the floor"', () => {
    const start = figureAt(entry, 0).world.near, top = figureAt(entry, pull).world;
    expect(elbowOf(start)).toBeGreaterThanOrEqual(175);
    expect(start.wrist[0]).toBeGreaterThan(start.shoulder[0] + 15);
    expect(Math.abs(top.near.elbow[1] - top.near.shoulder[1])).toBeLessThanOrEqual(0.5); // level
    expect(top.near.elbow[2] - top.near.shoulder[2]).toBeGreaterThanOrEqual(8); // "Elbows high and wide"
    // Beside the ears: at head height, out to the side of the head, close to it.
    expect(Math.abs(top.near.wrist[1] - top.head[1])).toBeLessThanOrEqual(BODY.hr);
    expect(top.near.wrist[2]).toBeGreaterThan(BODY.hr);
    expect(distance(top.near.wrist, top.head)).toBeLessThanOrEqual(BODY.hr + 6);
  });

  test('"Keeping the torso still ... Pause, then return slowly", a rope end in each hand', () => {
    expectStill(entry, ['hd', 'nk', 'hp', 'kn', 'an', 'kf', 'af']);
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(back).toBeGreaterThanOrEqual(1.5 * pull);
    expect(linesOf(figureAt(entry, 0))).toHaveLength(2);
    expectOnlyLengthens(entry, NECK_ROW_PULLEY, 0, pull);
  });
});
