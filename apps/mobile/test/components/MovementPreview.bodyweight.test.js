// Bodyweight movements, side view: Floor Back Extension (89), Bench Dip (37),
// Decline Push-Up (182) and Road Run (27). Every bound below comes from the
// movement's own catalogue text, quoted beside it. Measured on the model:
// x forward, y up from the floor.
import {
  BACK_EXTENSION_ARCH,
  BENCH_DIP_BENCH,
  CANONICAL_BODY_PARAMETERS,
  CHAIN_ANKLE_HEIGHT,
  CHAIN_LYING_HEIGHT,
  CHAIN_MOVEMENTS,
  DECLINE_PUSH_UP_BENCH_TOP,
  chainGeometry,
  layoutCanonicalFigure,
  poseAtTime,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = CANONICAL_BODY_PARAMETERS;
const BACK_HALF = BODY.sw * 0.58;
const THIGH_HALF = (BODY.lw * 1.18) / 2;
const FREE_FOOT_HALF = (BODY.lw * 0.82) / 2;
const HAND = BODY.lw * 0.44;
const deg = (rad) => (rad * 180) / Math.PI;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** The direction of a segment in the side plane, 0 to 360: 0 forward, 90 straight up, 180 back. */
const direction = (from, to) => (deg(Math.atan2(to[1] - from[1], to[0] - from[0])) + 360) % 360;
/** The smallest angle between two directions. */
const between = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
/** The angle at a middle joint: 180 is straight. */
const angleAt = (from, mid, to) => between(direction(mid, from), direction(mid, to));
const elbowOf = (side) => angleAt(side.shoulder, side.elbow, side.wrist);
const kneeOf = (side) => angleAt(side.hipJoint, side.knee, side.ankle);
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

const entry89 = entryOf(89);
const entry37 = entryOf(37);
const entry182 = entryOf(182);
const entry27 = entryOf(27);

describe.each([
  ['Floor Back Extension', entry89],
  ['Bench Dip', entry37],
  ['Decline Push-Up', entry182],
])('%s: one unbroken motion each way', (_name, entry) => {
  test('the figure never stops between its two end positions', () => {
    const [first, hold, second] = entry.segmentDurationsMs;
    expect(entry.frames.map((f) => f.joints.ph)).toEqual([0, 1, 1, 0, 0]);
    const moving = (from, to) => {
      for (let t = from + 33; t < to - 66; t += 33) {
        const now = figureAt(entry, t).joints, next = figureAt(entry, t + 33).joints;
        expect(Math.max(...['nk', 'hp', 'el', 'wr', 'kn'].map((key) => distance(now[key], next[key])))).toBeGreaterThan(0.003);
      }
    };
    moving(0, first);
    moving(first + hold, first + hold + second);
  });
});

describe('Floor Back Extension (89)', () => {
  const [up, hold, down] = entry89.segmentDurationsMs;
  // "A few inches": more than a finger's width and less than a hand's length, in box units.
  const FEW_INCHES = [2, 8];

  test('"Lie face-down with your arms reaching ahead": long on the floor', () => {
    const { world } = figureAt(entry89, 0);
    expect(world.neck[1]).toBeCloseTo(CHAIN_LYING_HEIGHT, 9);
    expect(world.hip[1]).toBeCloseTo(CHAIN_LYING_HEIGHT, 9);
    expect(world.head[0]).toBeGreaterThan(world.neck[0]); // the head leads, the legs trail
    expect(world.near.knee[0]).toBeLessThan(world.hip[0] - 20);
    expect(world.near.wrist[0]).toBeGreaterThan(world.head[0] + BODY.hr); // reaching ahead, past the head
    expect(world.near.wrist[1] - HAND).toBeLessThanOrEqual(0.2); // hands on the floor
    expect(world.near.knee[1] - THIGH_HALF).toBeLessThanOrEqual(0.1); // knees and ankles on the floor
    expect(world.near.ankle[1]).toBeLessThanOrEqual(CHAIN_ANKLE_HEIGHT + 0.1);
  });

  test('"Lift your chest, arms, and legs a few inches off the floor"', () => {
    const start = figureAt(entry89, 0).world;
    const top = figureAt(entry89, up).world;
    for (const rise of [
      top.neck[1] - start.neck[1],
      top.near.wrist[1] - start.near.wrist[1],
      top.near.knee[1] - start.near.knee[1],
      top.near.ankle[1] - start.near.ankle[1],
    ]) {
      expect(rise).toBeGreaterThanOrEqual(FEW_INCHES[0]);
      expect(rise).toBeLessThanOrEqual(FEW_INCHES[1]);
    }
  });

  test('"Height is not the goal": a small arch through the spine, pelvis down, never a stiff launch', () => {
    expect(BACK_EXTENSION_ARCH).toBeLessThanOrEqual(25);
    const start = figureAt(entry89, 0).world;
    for (const t of ticksOf(entry89)) {
      const { world } = figureAt(entry89, t);
      expect(world.hip).toEqual(start.hip); // the pelvis stays on the floor
      // The spine leaves the pelvis level and turns upward along its length.
      expect(between(direction(world.spine[0], world.spine[1]), 0)).toBeLessThanOrEqual(1);
      for (let i = 1; i < world.spine.length; i++) expect(world.spine[i][1]).toBeGreaterThanOrEqual(world.spine[i - 1][1] - 1e-9);
    }
    const top = figureAt(entry89, up);
    expect(top.curled).toBe(true);
    expect(between(direction(top.world.spine.at(-2), top.world.spine.at(-1)), 0)).toBeGreaterThan(BACK_EXTENSION_ARCH - 2);
  });

  test('"Reach LONG through fingers and toes": arms and legs stay straight for the whole rep', () => {
    for (const t of ticksOf(entry89)) {
      const { world } = figureAt(entry89, t);
      expect(elbowOf(world.near)).toBeGreaterThanOrEqual(179.9);
      expect(kneeOf(world.near)).toBeGreaterThanOrEqual(170);
      expect(between(direction(world.near.ankle, world.near.toe), 180)).toBeLessThanOrEqual(1); // toes pointing back
    }
  });

  test('"hold a beat, then lower with control"', () => {
    expect(hold).toBeGreaterThanOrEqual(400);
    expect(down).toBeGreaterThanOrEqual(1.4 * up);
  });
});

describe('Bench Dip (37)', () => {
  const [down, turn, up] = entry37.segmentDurationsMs;
  /** Half the drawn depth of the trunk at the hips. */
  const HIP_HALF = Math.min(BODY.hw * 0.92, BODY.sw * 0.58 * 0.9);

  test('"Grip the edge of a stable bench behind you": the hands are on the bench top at its edge, and stay there', () => {
    const start = figureAt(entry37, 0).world;
    expect(start.near.wrist[1] - HAND).toBeGreaterThanOrEqual(BENCH_DIP_BENCH.top);
    expect(start.near.wrist[1] - HAND).toBeLessThanOrEqual(BENCH_DIP_BENCH.top + 0.3);
    expect(BENCH_DIP_BENCH.edge - start.near.wrist[0]).toBeGreaterThan(0);
    expect(BENCH_DIP_BENCH.edge - start.near.wrist[0]).toBeLessThanOrEqual(4);
    expect(start.near.wrist[0]).toBeLessThan(start.hip[0] - 4); // behind the hips
    const slab = CHAIN_MOVEMENTS['bench-dip'].equipment.find((s) => s.kind === 'slab');
    expect(Math.max(slab.a[0], slab.b[0])).toBe(BENCH_DIP_BENCH.edge);
    expect(slab.a[1] + 2).toBe(BENCH_DIP_BENCH.top);
    for (const t of ticksOf(entry37)) expect(figureAt(entry37, t).world.near.wrist).toEqual(start.near.wrist);
  });

  test('"bend the knees" with the feet flat and still', () => {
    const start = figureAt(entry37, 0).world;
    for (const t of ticksOf(entry37)) {
      const { world } = figureAt(entry37, t);
      expect(kneeOf(world.near)).toBeLessThan(150);
      expect(world.near.ankle).toEqual(start.near.ankle);
      expect(world.near.ankle[1]).toBeCloseTo(CHAIN_ANKLE_HEIGHT, 9);
    }
  });

  test('"keep the hips just clear of the edge" / "Hips graze the bench the whole way"', () => {
    const xs = [];
    for (const t of ticksOf(entry37)) {
      const { world } = figureAt(entry37, t);
      const clear = world.hip[0] - HIP_HALF - BENCH_DIP_BENCH.edge;
      expect(clear).toBeGreaterThan(0);
      expect(clear).toBeLessThanOrEqual(2);
      xs.push(world.hip[0]);
    }
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(1); // straight down and up
  });

  test('"Bend the elbows straight back and lower only through the range the shoulders can hold comfortably"', () => {
    const bottom = figureAt(entry37, down).world;
    expect(bottom.near.elbow[0]).toBeLessThan(bottom.near.shoulder[0] - 5); // straight back
    expect(bottom.near.elbow[2]).toBeCloseTo(bottom.near.shoulder[2], 9); // not flared out to the side
    const bend = elbowOf(bottom.near);
    expect(bend).toBeGreaterThanOrEqual(85); // about a right angle and no deeper
    expect(bend).toBeLessThanOrEqual(110);
    for (const t of ticksOf(entry37)) {
      const { world } = figureAt(entry37, t);
      expect(elbowOf(world.near)).toBeGreaterThanOrEqual(bend - 1e-6);
      expect(world.near.shoulder[1]).toBeGreaterThan(world.near.elbow[1]); // the shoulders never sink below the elbows
    }
    expect(figureAt(entry37, 0).world.hip[1] - bottom.hip[1]).toBeGreaterThanOrEqual(5);
  });

  test('"Press to long arms"', () => {
    for (const t of [0, down + turn + up]) expect(elbowOf(figureAt(entry37, t).world.near)).toBeGreaterThanOrEqual(160);
    expect(down).toBeGreaterThanOrEqual(1.2 * up);
  });
});

describe('Decline Push-Up (182)', () => {
  const [down, turn, up] = entry182.segmentDurationsMs;

  test('"the feet up on a bench": the toes are on the bench top and the feet stay put', () => {
    const start = figureAt(entry182, 0).world;
    expect(start.near.toe[1] - FREE_FOOT_HALF).toBeCloseTo(DECLINE_PUSH_UP_BENCH_TOP, 6);
    const slab = CHAIN_MOVEMENTS['decline-push-up'].equipment.find((s) => s.kind === 'slab');
    expect(slab.a[1] + 2).toBe(DECLINE_PUSH_UP_BENCH_TOP);
    expect(start.near.toe[0]).toBeGreaterThan(Math.min(slab.a[0], slab.b[0]));
    expect(start.near.toe[0]).toBeLessThan(Math.max(slab.a[0], slab.b[0]));
    for (const t of ticksOf(entry182)) {
      const { world } = figureAt(entry182, t);
      expect(distance(world.near.ankle, start.near.ankle)).toBeLessThan(1e-9);
      expect(distance(world.near.toe, start.near.toe)).toBeLessThan(1e-9);
    }
  });

  test('"Place the hands on the floor": on it, and they do not move', () => {
    const start = figureAt(entry182, 0).world;
    expect(start.near.wrist[1] - HAND).toBeGreaterThanOrEqual(0);
    expect(start.near.wrist[1] - HAND).toBeLessThanOrEqual(0.2);
    expect(start.near.ankle[1]).toBeGreaterThan(start.near.wrist[1] + 15); // a decline: the feet are well above the hands
    for (const t of ticksOf(entry182)) expect(figureAt(entry182, t).world.near.wrist).toEqual(start.near.wrist);
  });

  test('"arms straight and the body in one line": one line from ankles to neck on every tick', () => {
    expect(elbowOf(figureAt(entry182, 0).world.near)).toBeGreaterThanOrEqual(165);
    for (const t of ticksOf(entry182)) {
      const { world } = figureAt(entry182, t);
      expect(kneeOf(world.near)).toBeCloseTo(180, 6);
      expect(angleAt(world.near.knee, world.hip, world.neck)).toBeCloseTo(180, 6);
      expect(distance(world.near.ankle, world.neck)).toBeCloseTo(22.25 + 22.25 + 24, 6);
    }
  });

  test('"Bend the elbows to lower the chest until it is just above the floor"', () => {
    const start = figureAt(entry182, 0).world;
    const bottom = figureAt(entry182, down).world;
    const chest = bottom.neck[1] - BACK_HALF;
    expect(chest).toBeGreaterThan(1); // above the floor
    expect(chest).toBeLessThanOrEqual(7); // and only just
    expect(bottom.head[1] - BODY.hr).toBeGreaterThan(0);
    expect(elbowOf(bottom.near)).toBeLessThan(elbowOf(start.near) - 60);
    expect(start.neck[1] - bottom.neck[1]).toBeGreaterThanOrEqual(10);
  });

  test('"Press back up until the arms are straight"', () => {
    expect(elbowOf(figureAt(entry182, down + turn + up).world.near)).toBeGreaterThanOrEqual(165);
  });
});

describe('Road Run (27)', () => {
  const total = entry27.segmentDurationsMs.reduce((a, b) => a + b, 0);
  const half = total / 2;
  /** The lowest point of a foot above the floor. */
  const sole = (side) => Math.min(side.ankle[1], side.toe[1]) - FREE_FOOT_HALF;
  const samples = Array.from({ length: 61 }, (_, i) => (total * i) / 60);

  test('a stride that loops: six positions, the last keyframe running on to the first again', () => {
    expect(CHAIN_MOVEMENTS['road-run'].cycle).toBe(true);
    expect(CHAIN_MOVEMENTS['road-run'].poses).toHaveLength(6);
    expect(entry27.frames.map((f) => f.joints.ph)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    const first = figureAt(entry27, 0).joints, end = figureAt(entry27, total).joints;
    for (const key of Object.keys(first)) expect(distance(first[key], end[key])).toBeLessThan(1e-9);
  });

  test('"Settle into a pace you can hold": the stride runs at an even pace, with no hesitation at any keyframe', () => {
    // Evenly spaced keyframes, and between them the figure is a quarter of the way at a quarter of the time.
    expect(new Set(entry27.segmentDurationsMs).size).toBe(1);
    const gap = entry27.segmentDurationsMs[0];
    const thigh = (t) => figureAt(entry27, t).angles.thigh[0];
    for (let k = 0; k < 6; k++) {
      const from = thigh(gap * k), to = k === 5 ? thigh(0) : thigh(gap * (k + 1));
      expect(thigh(gap * (k + 0.25))).toBeCloseTo(from + (to - from) * 0.25, 6);
    }
    // And something is always moving.
    for (let i = 1; i < samples.length; i++) {
      const before = figureAt(entry27, samples[i - 1]).joints, now = figureAt(entry27, samples[i]).joints;
      expect(Math.max(...['kn', 'an', 'kf', 'af'].map((key) => distance(before[key], now[key])))).toBeGreaterThan(0.3);
    }
  });

  test('"Begin tall with the shoulders relaxed and a small whole-body lean from the ankles"', () => {
    for (const t of samples) {
      const { world } = figureAt(entry27, t);
      const lean = 90 - direction(world.hip, world.neck);
      expect(lean).toBeGreaterThanOrEqual(2); // a lean,
      expect(lean).toBeLessThanOrEqual(10); // and a small one
      expect(world.hip[0]).toBeCloseTo(50, 9); // run on the spot
      // Relaxed arms: elbows held near a right angle, never locked or folded.
      for (const side of [world.near, world.far]) {
        expect(elbowOf(side)).toBeGreaterThanOrEqual(85);
        expect(elbowOf(side)).toBeLessThanOrEqual(115);
      }
    }
  });

  test('"letting each foot land quietly beneath the body"', () => {
    // The near foot lands at the start of the cycle, the far foot half a stride later.
    for (const [t, pick] of [[0, 'near'], [half, 'far']]) {
      const { world } = figureAt(entry27, t);
      const foot = world[pick];
      expect(sole(foot)).toBeLessThanOrEqual(0.8); // on the ground
      expect(Math.abs(foot.ankle[0] - world.hip[0])).toBeLessThanOrEqual(5); // beneath the body, not out in front
      expect(Math.abs(foot.toe[1] - foot.ankle[1])).toBeLessThanOrEqual(1); // flat, not heel-first
    }
  });

  test('stance and flight are both there: each foot has its turn on the ground, and between them both are in the air', () => {
    const state = samples.slice(0, -1).map((t) => {
      const { world } = figureAt(entry27, t);
      // On the ground: the sole within a finger's width of the floor.
      return { near: sole(world.near) <= 1, far: sole(world.far) <= 1 };
    });
    expect(state.some((s) => s.near && !s.far)).toBe(true);
    expect(state.some((s) => s.far && !s.near)).toBe(true);
    expect(state.some((s) => !s.near && !s.far)).toBe(true); // flight
    expect(state.some((s) => s.near && s.far)).toBe(false); // a run, not a walk: never both down
    // Two flights per stride: one after each push-off.
    let flights = 0;
    for (let i = 0; i < state.length; i++) {
      const now = !state[i].near && !state[i].far;
      const before = !state[(i + state.length - 1) % state.length].near && !state[(i + state.length - 1) % state.length].far;
      if (now && !before) flights += 1;
    }
    expect(flights).toBe(2);
  });

  test('the two legs do the same thing half a stride apart, and each arm swings opposite its own leg', () => {
    for (const t of samples.filter((s) => s < half)) {
      const now = figureAt(entry27, t), later = figureAt(entry27, t + half);
      expect(now.angles.farThigh[0]).toBeCloseTo(later.angles.thigh[0], 6);
      expect(now.angles.farShin[0]).toBeCloseTo(later.angles.shin[0], 6);
      expect(now.angles.farUpperArm[0]).toBeCloseTo(later.angles.upperArm[0], 6);
    }
    // When the near knee is furthest forward, the near hand is behind the far hand.
    const forward = samples.slice(0, -1).reduce((best, t) => (figureAt(entry27, t).world.near.knee[0] > figureAt(entry27, best).world.near.knee[0] ? t : best), 0);
    const { world } = figureAt(entry27, forward);
    expect(world.near.wrist[0]).toBeLessThan(world.far.wrist[0] - 5);
  });
});
