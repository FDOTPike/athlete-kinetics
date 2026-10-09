// The last two beginner movements that had no drawing, both drawn on 9 October
// 2026. Neither text has been accepted by the owner yet, and each entry says so.
// Cable Incline Pushdown: the catalogue text, with the one sentence that put it
// on a source hold corrected as a separate auditor proposed. Standing Cable
// Chest Press: a description written from the public-domain reference and
// corrected by that auditor. Measured on the 3D model: x forward, y up from the
// floor, z across the body toward the viewer.
import {
  CANONICAL_BODY_PARAMETERS,
  CHAIN_ANKLE_HEIGHT,
  CHAIN_MOVEMENTS,
  INCLINE_PUSHDOWN_BENCH_DEG,
  INCLINE_PUSHDOWN_ELBOW_SOFT,
  INCLINE_PUSHDOWN_HIGH,
  INCLINE_PUSHDOWN_PULLEY,
  STANDING_PRESS_PULLEYS,
  chainGeometry,
  layoutCanonicalFigure,
  poseAtTime,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = CANONICAL_BODY_PARAMETERS;
const THIGH_HALF = (BODY.lw * 1.18) / 2;
const TRUNK = 24;
const SLACK = 0.1; // a fourteenth of a cable's drawn width
const deg = (rad) => (rad * 180) / Math.PI;
const distance = (a, b) => Math.hypot(...a.slice(0, Math.min(a.length, b.length)).map((v, i) => v - b[i]));
const minus = (a, b) => a.map((v, i) => v - b[i]);
/** The direction of a segment in the side plane, 0 to 360: 0 forward, 90 straight up, 180 back. */
const direction = (from, to) => (deg(Math.atan2(to[1] - from[1], to[0] - from[0])) + 360) % 360;
const angleAt = (from, mid, to) => {
  const a = minus(from, mid), b = minus(to, mid);
  return deg(Math.acos(Math.max(-1, Math.min(1, a.reduce((sum, v, i) => sum + v * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b))))));
};
const elbowOf = (side) => angleAt(side.shoulder, side.elbow, side.wrist);
const kneeOf = (side) => angleAt(side.hipJoint, side.knee, side.ankle);
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
function expectOnlyGrows(lengths, gain) {
  let longest = lengths[0];
  for (const now of lengths) {
    expect(now).toBeGreaterThanOrEqual(longest - SLACK);
    longest = Math.max(longest, now);
  }
  expect(lengths.at(-1)).toBeGreaterThan(lengths[0] + gain);
}
function expectStill(entry, keys) {
  const start = figureAt(entry, 0).joints;
  for (const t of ticksOf(entry)) {
    const now = figureAt(entry, t).joints;
    for (const key of keys) expect(distance(now[key], start[key])).toBeLessThan(1e-9);
  }
}
const BODY_STILL = ['hd', 'nk', 'hp', 'kn', 'an', 'kf', 'af'];
const SIDES = [['near', 1], ['far', -1]];

test.each([154, 279].map((id) => [entryOf(id).name, entryOf(id)]))('%s is a pending first drawing whose text the owner has not yet accepted, and says so', (_name, entry) => {
  expect(entry.status).toBe('pending');
  expect(CHAIN_MOVEMENTS[slugOf(entry)]).toBeDefined();
  expect(entry.reason).toContain('First drawing of this movement, made on 9 October 2026');
  expect(entry.reason).toMatch(/the owner has not yet accepted that (description|correction)/);
  expect(entry.instructions).not.toMatch(/choose a load or range you can/);
  expect(entry.frames[0].joints.ph).toBe(entry.frames.at(-1).joints.ph);
});

describe('Cable Incline Pushdown (154)', () => {
  const entry = entryOf(154);
  const [back, turn, pull, hold] = entry.segmentDurationsMs;
  const movement = CHAIN_MOVEMENTS['cable-incline-pushdown'];
  const along = (world) => direction(world.hip, world.neck);

  test('the sentence that put it on hold is the one corrected, and the drawing follows the correction: "Keeping the elbows fixed and nearly straight ... moving only at the shoulders"', () => {
    expect(entry.instructions).not.toContain('upper arms stationary');
    expect(entry.cues).not.toContain('upper arms stationary');
    expect(entry.reason).toContain('"Keeping the upper arms stationary"'); // it says what it changed
    const start = figureAt(entry, 0).world;
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      for (const [name] of SIDES) {
        expect(elbowOf(world[name])).toBeCloseTo(180 - INCLINE_PUSHDOWN_ELBOW_SOFT, 6); // fixed, on every tick,
        expect(world[name].shoulder).toEqual(start[name].shoulder);
      }
    }
    expect(INCLINE_PUSHDOWN_ELBOW_SOFT).toBeGreaterThan(0); // nearly straight: soft, not locked,
    expect(INCLINE_PUSHDOWN_ELBOW_SOFT).toBeLessThanOrEqual(15);
    // and it is the shoulder that moves: the upper arm swings through well over a right angle.
    const low = figureAt(entry, 0).world.near, high = figureAt(entry, back).world.near;
    expect(direction(high.shoulder, high.elbow) - (direction(low.shoulder, low.elbow) - 360)).toBeGreaterThanOrEqual(120);
    expectStill(entry, BODY_STILL);
  });

  test('"Lie back on an incline bench set in front of a high pulley, facing away from the machine"', () => {
    const { world } = figureAt(entry, 0);
    expect(along(world)).toBeCloseTo(180 - INCLINE_PUSHDOWN_BENCH_DEG, 6);
    expect(INCLINE_PUSHDOWN_BENCH_DEG).toBeGreaterThanOrEqual(30);
    expect(INCLINE_PUSHDOWN_BENCH_DEG).toBeLessThanOrEqual(60);
    // Facing away: the pulley is behind the head, and high: well above it.
    expect(INCLINE_PUSHDOWN_PULLEY[0]).toBeLessThan(world.head[0] - 15);
    expect(INCLINE_PUSHDOWN_PULLEY[1]).toBeGreaterThan(world.head[1] + BODY.hr + 25);
    expect(world.near.knee[0]).toBeGreaterThan(world.hip[0]); // the legs point away from it
    const pad = movement.equipment.find((shape) => shape.kind === 'slab' && Math.abs(shape.a[1] - shape.b[1]) > 1);
    expect(direction(pad.a, pad.b)).toBeCloseTo(180 - INCLINE_PUSHDOWN_BENCH_DEG, 6); // the pad lies the way the back does
    for (const [name] of SIDES) expect(world[name].ankle[1]).toBeCloseTo(CHAIN_ANKLE_HEIGHT, 6);
    expect(movement.implement).toBe('cableBar'); // "a straight bar"
    expect(linesOf(figureAt(entry, 0))).toHaveLength(1);
  });

  test('"bring the arms down so the bar sits just above the thighs"', () => {
    const { world } = figureAt(entry, 0);
    const thighTop = world.near.hipJoint[1] + THIGH_HALF;
    const gap = world.near.hold[1] - BODY.lw * 0.44 - thighTop; // from the underside of the hand to the top of the thigh
    expect(gap).toBeGreaterThanOrEqual(0.5); // above,
    expect(gap).toBeLessThanOrEqual(4); // by a few centimetres
    // Over the upper thigh: between the hip and the middle of the thigh.
    expect(world.near.hold[0]).toBeGreaterThan(world.near.hipJoint[0]);
    expect(world.near.hold[0]).toBeLessThan((world.near.hipJoint[0] + world.near.knee[0]) / 2);
  });

  test('"let the bar travel back overhead in a semicircle": one arc in front of the body, stopping short of the line of the body', () => {
    const start = figureAt(entry, 0).world.near;
    const reach = distance(start.hold, start.shoulder);
    let last = -Infinity;
    for (const t of ticksOf(entry).filter((tick) => tick <= back)) {
      const { near, hip, neck } = figureAt(entry, t).world;
      expect(distance(near.hold, near.shoulder)).toBeCloseTo(reach, 6); // an arc about the shoulder
      const swept = ((direction(near.shoulder, near.hold) + 180) % 360) - 180; // -180 to 180, rising all the way
      expect(swept).toBeGreaterThanOrEqual(last - 1e-6);
      last = swept;
      // In front of the body: never behind the line of the trunk.
      const ux = (neck[0] - hip[0]) / TRUNK, uy = (neck[1] - hip[1]) / TRUNK;
      expect((near.hold[0] - near.shoulder[0]) * uy - (near.hold[1] - near.shoulder[1]) * ux).toBeGreaterThanOrEqual(-1e-6);
    }
    const top = figureAt(entry, back).world;
    expect(top.near.hold[1]).toBeGreaterThan(top.head[1] + BODY.hr); // overhead
    expect(INCLINE_PUSHDOWN_HIGH).toBeLessThan(180 - INCLINE_PUSHDOWN_BENCH_DEG); // short of the body's own line
    expect(180 - INCLINE_PUSHDOWN_BENCH_DEG - INCLINE_PUSHDOWN_HIGH).toBeLessThanOrEqual(20);
  });

  test('"Pull it back down to the thighs with the lats and hold the contraction"; the cable only lengthens on the pull', () => {
    expect(hold).toBeGreaterThanOrEqual(800);
    expect(turn).toBeGreaterThan(0);
    const length = (t) => distance([...INCLINE_PUSHDOWN_PULLEY, 0], [figureAt(entry, t).world.near.hold[0], figureAt(entry, t).world.near.hold[1], 0]);
    expectOnlyGrows(ticksOf(entry).filter((t) => t >= back + turn && t <= back + turn + pull).map(length), 30);
    for (const t of ticksOf(entry)) expect(length(t)).toBeGreaterThanOrEqual(length(back) - SLACK);
    // It never crosses the head: the cable clears it at the bottom, where it runs lowest.
    const { world } = figureAt(entry, 0);
    const k = (world.head[0] - INCLINE_PUSHDOWN_PULLEY[0]) / (world.near.hold[0] - INCLINE_PUSHDOWN_PULLEY[0]);
    const cableAtHead = INCLINE_PUSHDOWN_PULLEY[1] + (world.near.hold[1] - INCLINE_PUSHDOWN_PULLEY[1]) * k;
    expect(cableAtHead - world.head[1]).toBeGreaterThan(BODY.hr + 2);
  });
});

describe('Standing Cable Chest Press (279)', () => {
  const entry = entryOf(279);
  const [press, pause, back] = entry.segmentDurationsMs;
  const movement = CHAIN_MOVEMENTS['standing-cable-chest-press'];

  test('"Set both pulleys to chest height ... stand a short step in front of the machine, facing away from it, far enough that the cables are taut"', () => {
    const start = figureAt(entry, 0);
    const { world } = start;
    expect(entry.view).toBe('oblique');
    expect(movement.implement).toBe('handles');
    expect(start.prims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4).length + start.prims.filter((p) => p.kind === 'bone' && p.w === 1.4 && p.color !== 'textMid').length).toBeGreaterThanOrEqual(2);
    for (const [name, sign, pulley] of [['near', 1, STANDING_PRESS_PULLEYS[0]], ['far', -1, STANDING_PRESS_PULLEYS[1]]]) {
      // Chest height: below the shoulders, above the bottom of the ribs.
      expect(pulley[1]).toBeLessThan(world[name].shoulder[1]);
      expect(pulley[1]).toBeGreaterThan(world.hip[1] + TRUNK * 0.55);
      expect(sign * pulley[2]).toBeGreaterThan(Math.abs(world[name].shoulder[2])); // one each side,
      // behind the athlete by a short step: 40 to 70 centimetres at about two centimetres to the unit.
      expect(world.hip[0] - pulley[0]).toBeGreaterThanOrEqual(20);
      expect(world.hip[0] - pulley[0]).toBeLessThanOrEqual(35);
      // Taut: the cable is never shorter than at the start, and only lengthens on the press.
      const length = (t) => distance(pulley, figureAt(entry, t).world[name].hold);
      expectOnlyGrows(ticksOf(entry).filter((t) => t <= press).map(length), 10);
      for (const t of ticksOf(entry)) expect(length(t)).toBeGreaterThanOrEqual(length(0) - SLACK);
    }
    expect(direction(world.hip, world.neck)).toBeCloseTo(90, 6); // standing upright
  });

  test('"Put one foot ahead of the other for balance ... Holding that posture"', () => {
    const { world } = figureAt(entry, 0);
    expect(Math.abs(world.far.ankle[0] - world.near.ankle[0])).toBeGreaterThanOrEqual(15);
    expect(Math.sign(world.far.ankle[0] - world.hip[0])).toBe(-Math.sign(world.near.ankle[0] - world.hip[0])); // one ahead of the hips, one behind
    for (const [name] of SIDES) {
      expect(world[name].ankle[1]).toBeCloseTo(CHAIN_ANKLE_HEIGHT, 6);
      expect(kneeOf(world[name])).toBeGreaterThanOrEqual(160); // standing legs
    }
    expectStill(entry, BODY_STILL); // "do not rock or twist to help"
  });

  test('"bring the elbows out to the sides just below shoulder height, bent to about ninety degrees, with the forearms pointing forward along the cables and the handles beside the chest"', () => {
    const { world } = figureAt(entry, 0);
    for (const [name, sign, pulley] of [['near', 1, STANDING_PRESS_PULLEYS[0]], ['far', -1, STANDING_PRESS_PULLEYS[1]]]) {
      const side = world[name];
      expect(sign * (side.elbow[2] - side.shoulder[2])).toBeGreaterThanOrEqual(9); // out to the side,
      expect(side.shoulder[1] - side.elbow[1]).toBeGreaterThan(0); // just below shoulder height
      expect(side.shoulder[1] - side.elbow[1]).toBeLessThanOrEqual(6);
      expect(Math.abs(elbowOf(side) - 90)).toBeLessThanOrEqual(12);
      // The forearm points forward, and along its cable: within a few degrees of the cable's own line.
      const forearm = minus(side.wrist, side.elbow), cable = minus(side.wrist, pulley);
      expect(forearm[0] / Math.hypot(...forearm)).toBeGreaterThanOrEqual(0.95);
      expect(deg(Math.acos(forearm.reduce((sum, v, i) => sum + v * cable[i], 0) / (Math.hypot(...forearm) * Math.hypot(...cable))))).toBeLessThanOrEqual(15);
      // Beside the chest: level with it, outside it, and not behind it.
      expect(side.shoulder[1] - side.wrist[1]).toBeLessThanOrEqual(8);
      expect(sign * side.wrist[2]).toBeGreaterThan(BODY.sw * 0.92);
      expect(side.wrist[0]).toBeGreaterThanOrEqual(world.neck[0]);
    }
  });

  test('"press the handles forward and towards each other until the arms are straight but not snapped locked, hands close together in front of the chest"', () => {
    const start = figureAt(entry, 0).world, top = figureAt(entry, press).world;
    for (const [name] of SIDES) {
      expect(elbowOf(top[name])).toBeGreaterThanOrEqual(165); // straight,
      expect(elbowOf(top[name])).toBeLessThanOrEqual(175); // not locked
      expect(top[name].wrist[0] - top[name].shoulder[0]).toBeGreaterThanOrEqual(20); // forward
      expect(top[name].shoulder[1] - top[name].wrist[1]).toBeGreaterThanOrEqual(0); // in front of the chest, not the face
      expect(top[name].shoulder[1] - top[name].wrist[1]).toBeLessThanOrEqual(8);
    }
    const apart = (world) => distance(world.near.hold, world.far.hold);
    expect(apart(top)).toBeLessThanOrEqual(6); // close together,
    expect(apart(top)).toBeGreaterThanOrEqual(3); // not touching
    expect(apart(start) - apart(top)).toBeGreaterThanOrEqual(30);
    const gaps = ticksOf(entry).filter((t) => t <= press).map((t) => apart(figureAt(entry, t).world));
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeLessThanOrEqual(gaps[i - 1] + 1e-6); // towards each other all the way
  });

  test('"Pause, then return under control until the handles are beside the chest again"', () => {
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(back).toBeGreaterThanOrEqual(1.5 * press);
    const start = figureAt(entry, 0).world, end = figureAt(entry, press + pause + back).world;
    for (const [name] of SIDES) {
      expect(distance(end[name].wrist, start[name].wrist)).toBeLessThan(1e-6);
      // Never behind the chest on the way back.
      for (const t of ticksOf(entry)) expect(figureAt(entry, t).world[name].wrist[0]).toBeGreaterThanOrEqual(start.neck[0]);
    }
  });
});
