// Trunk flexion lying down, side view: Sit-Up (95), Tuck Crunch (124), Reverse
// Crunch (72), Cable Reverse Crunch (99), Bent-Knee Hip Raise (150) and Decline
// Reverse Crunch (183). Every bound below comes from the movement's own
// catalogue text, quoted beside it. These figures have a spine that curls; it
// is measured on the model as the run of points from the hip to the neck.
import {
  CABLE_REVERSE_CRUNCH_PULLEY,
  CANONICAL_BODY_PARAMETERS,
  CHAIN_LYING_HEIGHT,
  CHAIN_MOVEMENTS,
  DECLINE_REVERSE_CRUNCH_DEG,
  chainGeometry,
  layoutCanonicalFigure,
  poseAtTime,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = CANONICAL_BODY_PARAMETERS;
const BACK_HALF = BODY.sw * 0.58;
const THIGH_HALF = (BODY.lw * 1.18) / 2;
const deg = (rad) => (rad * 180) / Math.PI;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** The direction of a segment in the side plane, 0 to 360: 0 forward, 90 straight up, 180 back. */
const direction = (from, to) => (deg(Math.atan2(to[1] - from[1], to[0] - from[0])) + 360) % 360;
/** The smallest angle between two directions. */
const between = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
/** The angle at a middle joint: 180 is straight. */
const angleAt = (from, mid, to) => between(direction(mid, from), direction(mid, to));
/** How far the spine is curled: the turn between its first step and its last. */
const curlOf = (world) => between(direction(world.spine[0], world.spine[1]), direction(world.spine.at(-2), world.spine.at(-1)));
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
/** Keyframes are start, top, top after the hold, start, start. */
const topTime = (entry) => entry.segmentDurationsMs[0];

const entry95 = entryOf(95);
const entry124 = entryOf(124);
const entry72 = entryOf(72);
const entry99 = entryOf(99);
const entry150 = entryOf(150);
const entry183 = entryOf(183);
const ALL = [
  ['Sit-Up', entry95],
  ['Tuck Crunch', entry124],
  ['Reverse Crunch', entry72],
  ['Cable Reverse Crunch', entry99],
  ['Bent-Knee Hip Raise', entry150],
  ['Decline Reverse Crunch', entry183],
];
const PELVIS_ROLLS = [
  ['Reverse Crunch', entry72],
  ['Cable Reverse Crunch', entry99],
  ['Bent-Knee Hip Raise', entry150],
  ['Decline Reverse Crunch', entry183],
];

describe.each(ALL)('%s: a spine that curls', (_name, entry) => {
  test('the trunk starts and ends straight, curls in between, and is drawn along the curled spine', () => {
    expect(curlOf(figureAt(entry, 0).world)).toBeCloseTo(0, 6);
    expect(curlOf(figureAt(entry, ticksOf(entry).at(-1)).world)).toBeCloseTo(0, 6);
    const top = figureAt(entry, topTime(entry));
    expect(curlOf(top.world)).toBeGreaterThanOrEqual(35);
    expect(top.curled).toBe(true);
    // Drawn along it: a trunk slice is centred on every point of the spine.
    for (const point of top.spine) {
      expect(top.prims.some((p) => p.kind === 'bone' && p.color === 'textLow' && p.opacity === 1
        && Math.hypot((p.x1 + p.x2) / 2 - point[0], (p.y1 + p.y2) / 2 - point[1]) < 1e-9)).toBe(true);
    }
  });

  test('going and coming back are each one unbroken motion', () => {
    const [up, hold, down] = entry.segmentDurationsMs;
    const phases = entry.frames.map((f) => f.joints.ph);
    expect(phases[0]).toBe(0);
    expect(phases.slice(3)).toEqual([0, 0]);
    expect(phases[1]).toBe(phases[2]);
    const moving = (from, to) => {
      for (let t = from + 33; t < to - 66; t += 33) {
        const now = figureAt(entry, t).joints, next = figureAt(entry, t + 33).joints;
        expect(Math.max(...['nk', 'hp', 'kn', 'an'].map((key) => distance(now[key], next[key])))).toBeGreaterThan(0.005);
      }
    };
    moving(0, up);
    moving(up + hold, up + hold + down);
  });
});

describe('Sit-Up (95)', () => {
  test('"Lie on your back with knees bent, feet flat"', () => {
    const { world } = figureAt(entry95, 0);
    expect(world.neck[1]).toBeCloseTo(CHAIN_LYING_HEIGHT, 9);
    expect(world.hip[1]).toBeCloseTo(CHAIN_LYING_HEIGHT, 9);
    expect(world.neck[0]).toBeLessThan(world.hip[0]);
    expect(world.near.knee[1]).toBeGreaterThan(world.hip[1] + 10);
    expect(angleAt(world.near.hipJoint, world.near.knee, world.near.ankle)).toBeLessThan(120);
  });

  test('"hands crossed on your chest": they stay there, travelling with the top of the trunk', () => {
    const local = (world) => {
      // The hand's place measured along and across the top of the spine.
      const along = direction(world.neck, world.head) * Math.PI / 180;
      const dx = world.near.wrist[0] - world.neck[0], dy = world.near.wrist[1] - world.neck[1];
      return [dx * Math.cos(along) + dy * Math.sin(along), -dx * Math.sin(along) + dy * Math.cos(along)];
    };
    const start = local(figureAt(entry95, 0).world);
    // On the upper chest: within the trunk's depth of the spine, just below the neck.
    expect(Math.abs(start[1])).toBeLessThanOrEqual(BACK_HALF);
    expect(Math.abs(start[0])).toBeLessThanOrEqual(6);
    for (const t of ticksOf(entry95)) {
      const now = local(figureAt(entry95, t).world);
      expect(now[0]).toBeCloseTo(start[0], 6);
      expect(now[1]).toBeCloseTo(start[1], 6);
    }
  });

  test('"Curl your torso up one segment at a time": the top of the spine leaves the floor while the bottom is still down', () => {
    const [up] = entry95.segmentDurationsMs;
    let checked = 0;
    for (const t of ticksOf(entry95).filter((tick) => tick <= up)) {
      const { world } = figureAt(entry95, t);
      const rise = world.neck[1] - CHAIN_LYING_HEIGHT;
      if (rise < 6 || rise > 8) continue;
      checked += 1;
      // The quarter of the spine nearest the hips has not lifted.
      for (const point of world.spine.slice(0, 9)) expect(point[1] - CHAIN_LYING_HEIGHT).toBeLessThan(0.6);
      expect(curlOf(world)).toBeGreaterThan(25);
    }
    expect(checked).toBeGreaterThan(0);
    // And it is never a flat-backed lever: once the shoulders are up, the trunk is curled.
    for (const t of ticksOf(entry95)) {
      const { world } = figureAt(entry95, t);
      if (world.neck[1] - CHAIN_LYING_HEIGHT > 5) expect(curlOf(world)).toBeGreaterThan(20);
    }
    // The hips stay where they are.
    const hip = figureAt(entry95, 0).world.hip;
    for (const t of ticksOf(entry95)) expect(figureAt(entry95, t).world.hip).toEqual(hip);
  });

  test('"until your chest meets your thighs"', () => {
    const { world } = figureAt(entry95, topTime(entry95));
    // The front of the chest, three quarters of the way up the spine.
    const at = world.spine[24], next = world.spine[25];
    const forward = (direction(at, next) - 90) * Math.PI / 180;
    const chest = [at[0] + BACK_HALF * Math.cos(forward), at[1] + BACK_HALF * Math.sin(forward)];
    expect(segmentDistance(world.near.hipJoint, world.near.knee, chest)).toBeLessThanOrEqual(THIGH_HALF + 1);
  });

  test('"then roll back down the same way" / "Roll down as slowly as you rose"', () => {
    const [up, hold, down] = entry95.segmentDurationsMs;
    expect(down).toBe(up);
    for (const k of [0.2, 0.4, 0.6, 0.8]) {
      const rising = figureAt(entry95, up * k).joints;
      const falling = figureAt(entry95, up + hold + down * (1 - k)).joints;
      for (const key of ['hd', 'nk', 'el', 'wr']) expect(distance(rising[key], falling[key])).toBeLessThan(1e-6);
    }
  });
});

describe('Tuck Crunch (124)', () => {
  test('"with the hips and knees bent and the arms reaching toward the feet"', () => {
    const { world } = figureAt(entry124, 0);
    expect(between(direction(world.near.hipJoint, world.near.knee), 90)).toBeLessThanOrEqual(5);
    expect(angleAt(world.near.hipJoint, world.near.knee, world.near.ankle)).toBeCloseTo(90, 6);
    // Reaching toward the feet: straight arms, close to level, pointing the way the legs are.
    expect(between(direction(world.near.shoulder, world.near.wrist), 0)).toBeLessThanOrEqual(15);
    expect(angleAt(world.near.shoulder, world.near.elbow, world.near.wrist)).toBeGreaterThan(170);
  });

  test('"curling the shoulders up as the knees travel slightly toward the chest"', () => {
    const start = figureAt(entry124, 0).world;
    const top = figureAt(entry124, topTime(entry124)).world;
    expect(top.neck[1] - start.neck[1]).toBeGreaterThanOrEqual(4);
    // The lower back stays on the floor: the curl is in the upper spine.
    for (let i = 0; i <= 12; i++) expect(top.spine[i]).toEqual(start.spine[i]);
    // Slightly: the knees come a little toward the head, with the knees still bent as they were.
    const travel = start.near.knee[0] - top.near.knee[0];
    expect(travel).toBeGreaterThanOrEqual(3);
    expect(travel).toBeLessThanOrEqual(10);
    for (const t of ticksOf(entry124)) {
      const { world } = figureAt(entry124, t);
      const knee = angleAt(world.near.hipJoint, world.near.knee, world.near.ankle);
      expect(knee).toBeGreaterThanOrEqual(80); // a bent-knee tuck, never a straight-leg jackknife
      expect(knee).toBeLessThanOrEqual(100);
    }
  });

  test('"Reach past the hips at the top"', () => {
    const { world } = figureAt(entry124, topTime(entry124));
    expect(world.near.wrist[0]).toBeGreaterThan(world.hip[0]);
  });

  test('"Pause with the abdominals shortened, then lower both ends slowly"', () => {
    const [up, pause, down] = entry124.segmentDurationsMs;
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(down).toBeGreaterThanOrEqual(1.5 * up);
  });
});

describe.each(PELVIS_ROLLS)('%s: the pelvis rolls, the shoulders stay', (_name, entry) => {
  test('the shoulders and upper back do not move; the hips lift at the top', () => {
    const start = figureAt(entry, 0).world;
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      expect(distance(world.neck, start.neck)).toBeLessThan(1e-9);
      // The curl is in the lower spine: the upper 40 percent of it never moves.
      for (let i = 20; i <= 32; i++) expect(distance(world.spine[i], start.spine[i])).toBeLessThan(1e-9);
    }
    const top = figureAt(entry, topTime(entry)).world;
    // Lifted: the hips are further from the surface they were lying on.
    const surface = direction(start.neck, start.hip);
    const lift = (top.hip[0] - start.hip[0]) * -Math.sin(surface * Math.PI / 180) + (top.hip[1] - start.hip[1]) * Math.cos(surface * Math.PI / 180);
    expect(lift).toBeGreaterThanOrEqual(3);
  });

  test('the hands do not move, and the lowering is slower than the lift', () => {
    const start = figureAt(entry, 0).world;
    for (const t of ticksOf(entry)) expect(distance(figureAt(entry, t).world.near.wrist, start.near.wrist)).toBeLessThan(1e-9);
    const [up, , down] = entry.segmentDurationsMs;
    expect(down).toBeGreaterThanOrEqual(1.4 * up);
  });
});

describe('Reverse Crunch (72)', () => {
  test('"knees bent over your hips, hands flat beside you"', () => {
    const { world } = figureAt(entry72, 0);
    expect(world.near.knee[0]).toBeCloseTo(world.near.hipJoint[0], 9);
    expect(world.near.knee[1]).toBeGreaterThan(world.near.hipJoint[1] + 20);
    expect(angleAt(world.near.hipJoint, world.near.knee, world.near.ankle)).toBeCloseTo(90, 6);
    expect(world.near.wrist[1]).toBeLessThanOrEqual(3); // on the floor
    expect(Math.abs(world.near.wrist[0] - world.hip[0])).toBeLessThanOrEqual(4); // beside the hips
  });

  test('"the movement is the pelvis rolling up, not the legs swinging": the legs ride on the pelvis and keep their shape', () => {
    const start = figureAt(entry72, 0).world;
    const hipToThigh = (world) => between(direction(world.spine[1], world.spine[0]), direction(world.near.hipJoint, world.near.knee));
    for (const t of ticksOf(entry72)) {
      const { world } = figureAt(entry72, t);
      // Within the two degrees the spine's own first step turns through.
      expect(Math.abs(hipToThigh(world) - hipToThigh(start))).toBeLessThanOrEqual(2);
      expect(angleAt(world.near.hipJoint, world.near.knee, world.near.ankle)).toBeCloseTo(90, 6);
    }
  });

  test('"bringing the knees towards your ribs"', () => {
    const ribs = (world) => world.spine[20];
    const start = figureAt(entry72, 0).world;
    const top = figureAt(entry72, topTime(entry72)).world;
    expect(distance(start.near.knee, ribs(start)) - distance(top.near.knee, ribs(top))).toBeGreaterThanOrEqual(5);
  });

  test('"without letting the feet touch between reps"', () => {
    for (const t of ticksOf(entry72)) {
      const { world } = figureAt(entry72, t);
      expect(world.near.ankle[1]).toBeGreaterThan(10);
      expect(world.near.toe[1]).toBeGreaterThan(10);
    }
  });
});

describe('Cable Reverse Crunch (99)', () => {
  test('"Attach both ankles to a low cable, lie facing away from the stack"', () => {
    const { world, joints, prims, project } = figureAt(entry99, 0);
    expect(CABLE_REVERSE_CRUNCH_PULLEY[0]).toBeGreaterThan(world.near.ankle[0] + 15); // the stack is beyond the feet
    expect(CABLE_REVERSE_CRUNCH_PULLEY[1]).toBeLessThan(10);
    expect(world.head[0]).toBeLessThan(world.hip[0]); // the head is at the far end from it
    const cables = prims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4);
    expect(cables).toHaveLength(1);
    expect([cables[0].x1, cables[0].y1]).toEqual(project([CABLE_REVERSE_CRUNCH_PULLEY[0], CABLE_REVERSE_CRUNCH_PULLEY[1], 0]));
    expect([cables[0].x2, cables[0].y2]).toEqual(joints.an);
  });

  test('"set the hips and knees near 90 degrees"', () => {
    const { world } = figureAt(entry99, 0);
    expect(between(direction(world.hip, world.neck), direction(world.near.hipJoint, world.near.knee))).toBeCloseTo(90, 6);
    expect(angleAt(world.near.hipJoint, world.near.knee, world.near.ankle)).toBeCloseTo(90, 6);
  });

  test('"Tuck the pelvis first, then curl the knees toward the ribs until the tailbone lifts without throwing the legs"', () => {
    const start = figureAt(entry99, 0).world;
    const [up] = entry99.segmentDurationsMs;
    const hipToThigh = (world) => between(direction(world.spine[1], world.spine[0]), direction(world.near.hipJoint, world.near.knee));
    for (const t of ticksOf(entry99)) {
      const { world } = figureAt(entry99, t);
      // Not thrown: the thighs never get more than a few degrees ahead of the pelvis.
      expect(Math.abs(hipToThigh(world) - hipToThigh(start))).toBeLessThanOrEqual(5);
      // The pelvis leads: whenever the knees have moved, the lower spine has already curled.
      if (t <= up && distance(world.near.knee, start.near.knee) > 2) expect(curlOf(world)).toBeGreaterThan(3);
    }
  });

  test('"while keeping cable tension": the cable is never shorter than at the start and only lengthens on the way up', () => {
    const [up] = entry99.segmentDurationsMs;
    const length = (t) => distance(CABLE_REVERSE_CRUNCH_PULLEY, figureAt(entry99, t).world.near.ankle);
    const lengths = ticksOf(entry99).filter((t) => t <= up).map(length);
    for (let i = 1; i < lengths.length; i++) expect(lengths[i]).toBeGreaterThanOrEqual(lengths[i - 1] - 1e-9);
    for (const t of ticksOf(entry99)) expect(length(t)).toBeGreaterThanOrEqual(lengths[0] - 1e-9);
  });
});

describe('Bent-Knee Hip Raise (150)', () => {
  const kneeBend = (world) => 180 - angleAt(world.near.hipJoint, world.near.knee, world.near.ankle);

  test('"Lie flat on the floor with the arms beside you, knees bent to about seventy-five degrees and the feet a couple of inches up"', () => {
    const { world } = figureAt(entry150, 0);
    expect(world.neck[1]).toBeCloseTo(world.hip[1], 9);
    expect(kneeBend(world)).toBeCloseTo(75, 6);
    // A couple of inches: the underside of the heel is clear of the floor, by less than a hand's width.
    const heel = world.near.ankle[1] - (BODY.lw * 0.9) / 2;
    expect(heel).toBeGreaterThan(1);
    expect(heel).toBeLessThanOrEqual(5);
    expect(world.near.wrist[1]).toBeLessThanOrEqual(3);
  });

  test('"Draw the knees toward the chest, holding that knee angle": the knee angle never changes', () => {
    for (const t of ticksOf(entry150)) expect(kneeBend(figureAt(entry150, t).world)).toBeCloseTo(75, 6);
  });

  test('"until the pelvis rolls back and the hips leave the floor": the knees come in first, then the hips lift', () => {
    const start = figureAt(entry150, 0).world;
    for (const t of ticksOf(entry150)) {
      const { world } = figureAt(entry150, t);
      // While the knees are still out in front of the hips, the hips are on the floor.
      if (world.near.knee[0] > world.near.hipJoint[0] + 1) expect(distance(world.hip, start.hip)).toBeLessThan(1e-9);
    }
    const top = figureAt(entry150, topTime(entry150)).world;
    expect(top.near.knee[0]).toBeLessThan(top.near.hipJoint[0]);
  });

  test('"Squeeze at the top for a second"', () => {
    const [up, squeeze] = entry150.segmentDurationsMs;
    expect(squeeze).toBeGreaterThanOrEqual(1000);
    const held = [0, squeeze / 2, squeeze].map((dt) => figureAt(entry150, up + dt).joints.kn);
    expect(held[1]).toEqual(held[0]);
    expect(held[2]).toEqual(held[0]);
  });
});

describe('Decline Reverse Crunch (183)', () => {
  const board = CHAIN_MOVEMENTS['decline-reverse-crunch'].equipment.find((s) => s.kind === 'slab');
  const offBoard = (point) => {
    const ux = board.b[0] - board.a[0], uy = board.b[1] - board.a[1];
    return Math.abs((point[0] - board.a[0]) * uy - (point[1] - board.a[1]) * ux) / Math.hypot(ux, uy);
  };

  test('"Lie on a decline bench with the head at the high end"', () => {
    const { world } = figureAt(entry183, 0);
    expect(direction(world.hip, world.neck)).toBeCloseTo(180 - DECLINE_REVERSE_CRUNCH_DEG, 6);
    expect(DECLINE_REVERSE_CRUNCH_DEG).toBeGreaterThanOrEqual(10);
    expect(DECLINE_REVERSE_CRUNCH_DEG).toBeLessThanOrEqual(30);
    expect(world.head[1]).toBeGreaterThan(world.hip[1] + 8);
    // The board lies under the back, parallel to it, and runs past both the head and the hips.
    expect(between(direction(board.b, board.a), direction(world.hip, world.neck))).toBeCloseTo(0, 6);
    for (const point of [world.hip, world.neck]) expect(offBoard(point) - 2).toBeCloseTo(BACK_HALF, 6);
    expect(Math.min(board.a[0], board.b[0])).toBeLessThan(world.head[0] - BODY.hr);
    expect(Math.max(board.a[0], board.b[0])).toBeGreaterThan(world.hip[0]);
  });

  test('"hold the top of the bench": the hands are on the board beyond the head, and stay there', () => {
    const { world } = figureAt(entry183, 0);
    expect(world.near.wrist[0]).toBeLessThan(world.head[0] - BODY.hr); // beyond the head, at the high end
    expect(world.near.wrist[1]).toBeGreaterThan(world.neck[1]);
    expect(offBoard(world.near.wrist) - 2).toBeLessThanOrEqual(2.5); // on the board's upper face
  });

  test('"raise the legs, knees slightly bent, until they are level with the floor": the start position', () => {
    const { world } = figureAt(entry183, 0);
    expect(between(direction(world.near.hipJoint, world.near.knee), 0)).toBeLessThanOrEqual(10);
    expect(between(direction(world.near.knee, world.near.ankle), 0)).toBeLessThanOrEqual(10);
    const knee = angleAt(world.near.hipJoint, world.near.knee, world.near.ankle);
    expect(knee).toBeGreaterThanOrEqual(155);
    expect(knee).toBeLessThan(180);
  });

  test('"Draw the knees toward the chest and roll the pelvis so the hips lift off the bench"', () => {
    const start = figureAt(entry183, 0).world;
    const top = figureAt(entry183, topTime(entry183)).world;
    expect(offBoard(top.hip) - offBoard(start.hip)).toBeGreaterThanOrEqual(3);
    expect(distance(top.near.knee, top.spine[20])).toBeLessThan(distance(start.near.knee, start.spine[20]) - 10);
    // The knees come in before the hips lift.
    for (const t of ticksOf(entry183)) {
      const { world } = figureAt(entry183, t);
      if (between(direction(world.near.hipJoint, world.near.knee), 0) < 60) expect(distance(world.hip, start.hip)).toBeLessThan(1e-9);
    }
  });

  test('"Pause, then lower the hips and return the legs slowly to the start"', () => {
    const [, pause] = entry183.segmentDurationsMs;
    expect(pause).toBeGreaterThanOrEqual(400);
  });
});

test('the six are six drawings, not one drawing with new captions', () => {
  const ends = ALL.map(([, e]) => [figureAt(e, 0), figureAt(e, topTime(e))]);
  for (let i = 0; i < ends.length; i++) {
    for (let k = i + 1; k < ends.length; k++) {
      // Compared with the two figures laid over each other at the hip.
      const same = ends[i].every((figure, at) => ['nk', 'kn', 'an', 'wr'].every((key) => {
        const other = ends[k][at];
        const a = [figure.joints[key][0] - figure.joints.hp[0], figure.joints[key][1] - figure.joints.hp[1]];
        const b = [other.joints[key][0] - other.joints.hp[0], other.joints[key][1] - other.joints.hp[1]];
        return distance(a, b) < 0.5;
      }));
      const sameEquipment = JSON.stringify(CHAIN_MOVEMENTS[slugOf(ALL[i][1])].lines ?? null) === JSON.stringify(CHAIN_MOVEMENTS[slugOf(ALL[k][1])].lines ?? null);
      expect(same && sameEquipment).toBe(false);
    }
  }
});
