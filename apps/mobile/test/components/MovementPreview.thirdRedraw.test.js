// Nine more older drawings were partly against their own catalogue text and
// were redrawn on 9 October 2026 at the owner's request. Each block opens with
// the thing the old drawing got wrong, then holds the rest of the text.
// Measured on the 3D model: x forward, y up from the floor, z across the body
// toward the viewer.
import {
  CABLE_PRESS_PULLEYS,
  CANONICAL_BODY_PARAMETERS,
  CHAIN_MOVEMENTS,
  PULLDOWN,
  PUSH_UP_BOTTOM_DEG,
  PUSH_UP_TOP_DEG,
  SEATED_PRESS_BACK,
  SIDE_PLANK_DEG,
  SUMO_SQUAT,
  V_BAR,
  chainGeometry,
  layoutCanonicalFigure,
  poseAtTime,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = CANONICAL_BODY_PARAMETERS;
const THIGH_HALF = (BODY.lw * 1.18) / 2;
const BACK_HALF = BODY.sw * 0.58;
const TRUNK = 24;
const BELL = 8.4; // the length of a drawn dumbbell
const deg = (rad) => (rad * 180) / Math.PI;
/** Straight-line distance between two points, over as many dimensions as both have. */
const distance = (a, b) => Math.hypot(...a.slice(0, Math.min(a.length, b.length)).map((v, i) => v - b[i]));
const flat = (p) => [p[0], p[1]];
const minus = (a, b) => a.map((v, i) => v - b[i]);
/** The direction of a segment in the side plane, 0 to 360: 0 forward, 90 straight up, 180 back. */
const direction = (from, to) => (deg(Math.atan2(to[1] - from[1], to[0] - from[0])) + 360) % 360;
/** The angle at a middle joint, in 3D: 180 is straight. */
const angleAt = (from, mid, to) => {
  const a = minus(from, mid), b = minus(to, mid);
  return deg(Math.acos(Math.max(-1, Math.min(1, a.reduce((sum, v, i) => sum + v * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b))))));
};
const elbowOf = (side) => angleAt(side.shoulder, side.elbow, side.wrist);
const kneeOf = (side) => angleAt(side.hipJoint, side.knee, side.ankle);
/** How far a segment is from pointing straight up, in degrees. */
const offUpright = (from, to) => deg(Math.acos((to[1] - from[1]) / distance(from, to)));
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
/** When each keyframe is reached. */
const keyTimes = (entry) => entry.segmentDurationsMs.reduce((times, d) => [...times, times.at(-1) + d], [0]);
const linesOf = (figure) => figure.prims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4);
const SIDES = [['near', 1], ['far', -1]];
// A cable is drawn 1.4 units wide. An arm that swings on its joints does not
// carry the hand along a perfectly straight line, so a cable can give back a
// few hundredths of a unit as the limb settles. A tenth of a unit, a
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
/** Joints that must not move at all through the cycle. */
function expectStill(entry, keys) {
  const start = figureAt(entry, 0).joints;
  for (const t of ticksOf(entry)) {
    const now = figureAt(entry, t).joints;
    for (const key of keys) expect(distance(now[key], start[key])).toBeLessThan(1e-9);
  }
}
const BODY_STILL = ['hd', 'nk', 'hp', 'kn', 'an', 'kf', 'af'];

const IDS = [280, 270, 267, 294, 298, 126, 172, 57, 254];

test.each(IDS.map((id) => [entryOf(id).name, entryOf(id)]))('%s is a pending redraw that keeps its older draft id and says why it was redrawn', (_name, entry) => {
  expect(entry.status).toBe('pending');
  expect(CHAIN_MOVEMENTS[slugOf(entry)]).toBeDefined();
  expect(entry.previewId).toBe(slugOf(entry).replaceAll('-', '_'));
  expect(entry.reason).toContain('Redrawn on 9 October 2026');
  expect(entry.frames[0].joints.ph).toBe(entry.frames.at(-1).joints.ph);
});

describe('Standing Dumbbell Press (280)', () => {
  const entry = entryOf(280);
  const [press, pause, lower] = entry.segmentDurationsMs;

  test('held the arms forward at chest height and never straightened overhead: "raise the dumbbells to head height, elbows out at about ninety degrees ... until the arms finish straight"', () => {
    const start = figureAt(entry, 0).world, top = figureAt(entry, press).world;
    for (const [name, sign] of SIDES) {
      const a = start[name], b = top[name];
      expect(Math.abs(a.wrist[1] - start.head[1])).toBeLessThanOrEqual(BODY.hr); // head height
      expect(sign * (a.elbow[2] - a.shoulder[2])).toBeGreaterThanOrEqual(10); // elbows out to the sides,
      expect(Math.abs(a.elbow[0] - a.shoulder[0])).toBeLessThan(1e-6); // not held forward
      expect(Math.abs(elbowOf(a) - 90)).toBeLessThanOrEqual(15);
      expect(elbowOf(b)).toBeGreaterThanOrEqual(170); // "the arms finish straight"
      expect(b.wrist[1]).toBeGreaterThan(top.head[1] + BODY.hr); // overhead,
      expect(Math.abs(b.wrist[2] - b.shoulder[2])).toBeLessThanOrEqual(3); // over the shoulders
    }
    expect(entry.view).toBe('front');
  });

  test('"Stand with the feet shoulder width apart ... without leg drive or leaning back"', () => {
    const { world } = figureAt(entry, 0);
    for (const [name] of SIDES) {
      expect(world[name].ankle[2]).toBeCloseTo(world[name].shoulder[2], 6); // each foot under its shoulder
      expect(kneeOf(world[name])).toBeCloseTo(180, 4);
    }
    expect(direction(world.hip, world.neck)).toBeCloseTo(90, 6);
    expectStill(entry, BODY_STILL);
  });

  test('"Stack the wrists over the elbows"; "Pause, then lower to the start under control"', () => {
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      for (const [name] of SIDES) expect(offUpright(world[name].elbow, world[name].wrist)).toBeLessThan(1e-6);
    }
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(lower).toBeGreaterThanOrEqual(1.3 * press);
  });
});

describe('Seated Dumbbell Press (270)', () => {
  const entry = entryOf(270);
  const [press, pause, lower] = entry.segmentDurationsMs;

  test('had no back support and leaned forward: "Sit on a bench with a back support ... Keep the back on the bench"', () => {
    const { world } = figureAt(entry, 0);
    expect(direction(world.hip, world.neck)).toBeCloseTo(SEATED_PRESS_BACK, 6);
    expect(SEATED_PRESS_BACK).toBeGreaterThanOrEqual(90); // never forward of upright
    expect(SEATED_PRESS_BACK).toBeLessThanOrEqual(110);
    // The back support: a pad lying along the back of the trunk, just behind it.
    const slabs = CHAIN_MOVEMENTS['seated-dumbbell-press'].equipment.filter((s) => s.kind === 'slab');
    const back = slabs.find((s) => Math.abs(direction(s.a, s.b) - SEATED_PRESS_BACK) < 1);
    expect(back).toBeDefined();
    for (const end of [back.a, back.b]) expect(onTrunk(world, end).front).toBeCloseTo(-(BACK_HALF + 2), 6);
    expect(onTrunk(world, back.b).along).toBeGreaterThanOrEqual(TRUNK); // it reaches the shoulders
    const seat = slabs.find((s) => s !== back);
    expect(seat.a[1] + 2).toBeCloseTo(world.hip[1] - THIGH_HALF, 6);
    expectStill(entry, BODY_STILL); // the back does not come off it
  });

  test('"a dumbbell in each hand ... to shoulder height ... press both dumbbells overhead until they meet at the top"', () => {
    const start = figureAt(entry, 0).world, top = figureAt(entry, press).world;
    for (const [name, sign] of SIDES) {
      const a = start[name], b = top[name];
      expect(Math.abs(a.wrist[1] - a.shoulder[1])).toBeLessThanOrEqual(4); // shoulder height
      expect(sign * (a.elbow[2] - a.shoulder[2])).toBeGreaterThanOrEqual(6); // elbows out,
      expect(a.elbow[1]).toBeLessThan(a.shoulder[1] - 6); // and under the hands
      expect(b.wrist[1]).toBeGreaterThan(top.head[1] + BODY.hr);
      expect(elbowOf(b)).toBeGreaterThanOrEqual(165);
    }
    // They meet: the inner ends of the two dumbbells finish within two units, without crossing.
    const gap = distance(top.near.hold, top.far.hold) - BELL;
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(2);
    expect(distance(start.near.hold, start.far.hold) - BELL).toBeGreaterThan(20);
  });

  test('"Stack the wrists over the elbows"; "Pause, then lower to the shoulders under control"', () => {
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      for (const [name] of SIDES) expect(offUpright(world[name].elbow, world[name].wrist)).toBeLessThanOrEqual(15);
    }
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(lower).toBeGreaterThanOrEqual(1.3 * press);
  });
});

describe('Seated Cable Shoulder Press (267)', () => {
  const entry = entryOf(267);
  const [press, pause, lower] = entry.segmentDurationsMs;

  test('leaned forward: "Sit tall"', () => {
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      expect(direction(world.hip, world.neck)).toBeCloseTo(90, 6);
    }
    const { world } = figureAt(entry, 0);
    const slab = CHAIN_MOVEMENTS['seated-cable-shoulder-press'].equipment.find((s) => s.kind === 'slab');
    expect(slab.a[1] + 2).toBeCloseTo(world.hip[1] - THIGH_HALF, 6);
    expectStill(entry, BODY_STILL);
  });

  test('"a cable handle in each hand at shoulder height, upper arms out to the sides and elbows bent to about a right angle"', () => {
    const { world } = figureAt(entry, 0);
    for (const [name, sign] of SIDES) {
      const side = world[name];
      expect(sign * (side.elbow[2] - side.shoulder[2])).toBeGreaterThanOrEqual(10); // out to the sides,
      expect(Math.abs(side.elbow[0] - side.shoulder[0])).toBeLessThan(1e-6); // not forward
      expect(Math.abs(elbowOf(side) - 90)).toBeLessThanOrEqual(20);
      // By the shoulders: with the forearms upright the hands sit between the shoulders and the top of the head.
      expect(side.wrist[1]).toBeGreaterThanOrEqual(side.shoulder[1]);
      expect(side.wrist[1]).toBeLessThanOrEqual(world.head[1] + BODY.hr);
      expect(offUpright(side.elbow, side.wrist)).toBeLessThan(1e-6); // "Wrists stacked over the elbows"
    }
  });

  test('"Press the handles up and together overhead until the arms are straight"', () => {
    const start = figureAt(entry, 0).world, top = figureAt(entry, press).world;
    for (const [name] of SIDES) {
      expect(elbowOf(top[name])).toBeGreaterThanOrEqual(165);
      expect(top[name].wrist[1]).toBeGreaterThan(top.head[1] + BODY.hr);
    }
    expect(distance(top.near.hold, top.far.hold)).toBeLessThanOrEqual(10); // together
    expect(distance(start.near.hold, start.far.hold) - distance(top.near.hold, top.far.hold)).toBeGreaterThanOrEqual(20);
  });

  test('"Pause, then lower them slowly to shoulder height, keeping tension on the cables"', () => {
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(lower).toBeGreaterThanOrEqual(1.5 * press);
    expect(linesOf(figureAt(entry, 0))).toHaveLength(2);
    // A low pulley out to each side, and each cable only lengthens on the way up.
    const start = figureAt(entry, 0).world;
    for (const [name, sign, pulley] of [['near', 1, CABLE_PRESS_PULLEYS[0]], ['far', -1, CABLE_PRESS_PULLEYS[1]]]) {
      expect(sign * pulley[2]).toBeGreaterThan(sign * start[name].hold[2] + 10);
      expect(pulley[1]).toBeLessThan(10);
      const length = (t) => distance(pulley, figureAt(entry, t).world[name].hold);
      expectOnlyGrows(ticksOf(entry).filter((t) => t <= press).map(length), 10);
      for (const t of ticksOf(entry)) expect(length(t)).toBeGreaterThanOrEqual(length(0) - SLACK);
    }
  });
});

describe('Underhand Cable Pulldowns (294)', () => {
  const entry = entryOf(294);
  const [pull, squeeze, rise] = entry.segmentDurationsMs;
  const pulley = [...PULLDOWN.pulley, 0];

  test('had the hands wider than the shoulders: "the hands closer than shoulder width"', () => {
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      // One bar: the hands stay the same distance apart, inside the shoulders.
      expect(world.near.hold[2]).toBeCloseTo(PULLDOWN.gripHalf, 9);
      expect(world.far.hold[2]).toBeCloseTo(-PULLDOWN.gripHalf, 9);
      expect(distance(flat(world.near.hold), flat(world.far.hold))).toBeLessThan(1e-9);
      expect(PULLDOWN.gripHalf).toBeLessThan(world.near.shoulder[2] - 2);
    }
    expect(entry.view).toBe('oblique');
  });

  test('"Sit at a pulldown station with the knee pad snug ... lean back slightly with the chest up"', () => {
    const { world } = figureAt(entry, 0);
    const equipment = CHAIN_MOVEMENTS['underhand-cable-pulldowns'].equipment;
    const pad = equipment.find((s) => s.kind === 'roller');
    // Snug: the pad rests on top of the thigh, between the hip and the knee.
    expect(pad.at[1] - (world.hip[1] + THIGH_HALF)).toBeGreaterThanOrEqual(2.5);
    expect(pad.at[1] - (world.hip[1] + THIGH_HALF)).toBeLessThanOrEqual(3.5);
    expect(pad.at[0]).toBeGreaterThan(world.hip[0] + 8);
    expect(pad.at[0]).toBeLessThan(world.near.knee[0]);
    expect(equipment.find((s) => s.kind === 'slab').a[1] + 2).toBeCloseTo(world.hip[1] - THIGH_HALF, 6);
    expect(direction(world.hip, world.neck)).toBeGreaterThanOrEqual(95); // leaning back,
    expect(direction(world.hip, world.neck)).toBeLessThanOrEqual(110); // slightly
    expect(PULLDOWN.pulley[1]).toBeGreaterThan(world.near.hold[1] + 10); // the pulley is overhead
    expect(elbowOf(world.near)).toBeGreaterThanOrEqual(165);
  });

  test('"Keeping the elbows close to the body, draw the shoulders and upper arms down and back to pull the bar to the upper chest"', () => {
    const start = figureAt(entry, 0).world, end = figureAt(entry, pull).world;
    const touch = onTrunk(end, end.near.hold);
    expect(touch.along).toBeGreaterThanOrEqual((2 / 3) * TRUNK); // the upper chest,
    expect(touch.along).toBeLessThanOrEqual(TRUNK);
    expect(touch.front).toBeLessThanOrEqual(8.5); // against it
    for (const [name, sign] of SIDES) {
      const side = end[name];
      expect(Math.abs(side.elbow[2] - side.shoulder[2])).toBeLessThanOrEqual(3); // close to the body
      expect(sign * side.elbow[2]).toBeGreaterThan(0);
      expect(side.elbow[1]).toBeLessThan(side.shoulder[1] - 8); // down,
      expect(onTrunk(end, side.elbow).front).toBeLessThanOrEqual(3); // and back beside the ribs, not out in front
      expect(side.elbow[1]).toBeLessThan(start[name].elbow[1] - 15);
    }
    expectStill(entry, BODY_STILL);
  });

  test('"Squeeze the back, then let the bar rise slowly until the arms are straight"; one cable to the middle of the bar', () => {
    expect(squeeze).toBeGreaterThanOrEqual(400);
    expect(rise).toBeGreaterThanOrEqual(1.5 * pull);
    expect(elbowOf(figureAt(entry, pull + squeeze + rise).world.near)).toBeGreaterThanOrEqual(165);
    const middle = (world) => world.near.hold.map((v, i) => (v + world.far.hold[i]) / 2);
    const length = (t) => distance(pulley, middle(figureAt(entry, t).world));
    expectOnlyGrows(ticksOf(entry).filter((t) => t <= pull).map(length), 10);
    const figure = figureAt(entry, pull);
    const lines = linesOf(figure);
    expect(lines).toHaveLength(1);
    const centre = figure.project(middle(figure.world));
    expect(distance([lines[0].x2, lines[0].y2], centre)).toBeLessThan(1e-9);
  });
});

describe('V-Bar Pullup (298)', () => {
  const entry = entryOf(298);
  const [pull, pause, lower] = entry.segmentDurationsMs;

  test('had the hands apart on the bar: "Hang a V-handle over the middle of the pull-up bar, grip one side in each hand"', () => {
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      for (const [name, sign] of SIDES) {
        // Both hands on the one handle, either side of the middle, and they never move.
        expect(distance(flat(world[name].hold), V_BAR.grip)).toBeLessThan(1e-9);
        expect(world[name].hold[2]).toBeCloseTo(sign * V_BAR.half, 9);
      }
    }
    expect(V_BAR.half).toBeLessThanOrEqual(3);
    expect(V_BAR.grip[0]).toBe(V_BAR.bar[0]); // the handle hangs straight down from the bar,
    expect(V_BAR.bar[1] - V_BAR.grip[1]).toBeGreaterThanOrEqual(4); // just under it
    expect(V_BAR.bar[1] - V_BAR.grip[1]).toBeLessThanOrEqual(8);
  });

  test('"hang with the arms straight, chest up and leaning back slightly"', () => {
    const { world } = figureAt(entry, 0);
    expect(elbowOf(world.near)).toBeGreaterThanOrEqual(170);
    expect(direction(world.hip, world.neck)).toBeGreaterThanOrEqual(95);
    expect(direction(world.hip, world.neck)).toBeLessThanOrEqual(115);
    for (const t of ticksOf(entry)) {
      const now = figureAt(entry, t).world;
      for (const [name] of SIDES) expect(Math.min(now[name].ankle[1], now[name].toe[1])).toBeGreaterThan(10); // hanging: the feet are off the floor
      expect(Math.abs(now.hip[0] - V_BAR.grip[0])).toBeLessThanOrEqual(4); // the body hangs under the handle
    }
  });

  test('"Pull the body up, leaning the head back slightly to clear the bar, until the chest is close to the handle"', () => {
    const start = figureAt(entry, 0).world, top = figureAt(entry, pull).world;
    expect(top.hip[1] - start.hip[1]).toBeGreaterThanOrEqual(20);
    const chest = onTrunk(top, V_BAR.grip);
    expect(chest.along).toBeGreaterThanOrEqual((2 / 3) * TRUNK); // the chest, not the stomach,
    expect(chest.front).toBeLessThanOrEqual(10); // close to the handle
    expect(chest.front).toBeGreaterThan(BACK_HALF);
    // The head leans back further than at the hang, passes behind the bar and never touches it.
    expect(direction(top.neck, top.head)).toBeGreaterThan(direction(start.neck, start.head) + 10);
    expect(top.head[0]).toBeLessThan(V_BAR.bar[0] - BODY.hr);
    for (const t of ticksOf(entry)) expect(distance(flat(figureAt(entry, t).world.head), V_BAR.bar)).toBeGreaterThanOrEqual(BODY.hr + 2.6);
  });

  test('"Pause, then lower slowly to a full hang"', () => {
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(lower).toBeGreaterThanOrEqual(1.4 * pull);
    expect(elbowOf(figureAt(entry, pull + pause + lower).world.near)).toBeGreaterThanOrEqual(170);
  });
});

/** The handle of the dumbbell drawn at a hand. */
function hammerAt(figure, grip) {
  return figure.prims.find((p) => p.kind === 'bone' && p.w === 2.2 && Math.abs((p.x1 + p.x2) / 2 - grip[0]) < 1e-9 && Math.abs((p.y1 + p.y2) / 2 - grip[1]) < 1e-9);
}

describe.each([
  ['Alternate Hammer Curl', entryOf(126)],
  ['Cross Body Hammer Curl', entryOf(172)],
])('%s', (_name, entry) => {
  const times = keyTimes(entry);
  // Keyframes: both arms long, one side up, held, both long, the other side up, held, both long.

  test('laid the dumbbells across the body: the palms face in, so each dumbbell is held like a hammer, square to its forearm', () => {
    for (const t of ticksOf(entry)) {
      const figure = figureAt(entry, t);
      for (const [grip, elbow] of [[figure.grip.near, figure.joints.el], [figure.grip.far, figure.joints.ef]]) {
        const handle = hammerAt(figure, grip);
        expect(handle).toBeDefined();
        const along = (handle.x2 - handle.x1) * (grip[0] - elbow[0]) + (handle.y2 - handle.y1) * (grip[1] - elbow[1]);
        expect(Math.abs(along)).toBeLessThan(1e-6);
      }
    }
  });

  test('one arm at a time: "Lower it slowly ... then curl the other side"', () => {
    const rest = figureAt(entry, 0).world;
    for (const [name] of SIDES) expect(elbowOf(rest[name])).toBeGreaterThanOrEqual(175); // both arms long
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      // While one side works the other hangs exactly where it started.
      if (t <= times[3]) expect(world.far.wrist).toEqual(rest.far.wrist);
      if (t >= times[3]) expect(world.near.wrist).toEqual(rest.near.wrist);
    }
    expect(figureAt(entry, times[1]).world.near.wrist[1]).toBeGreaterThan(rest.near.wrist[1] + 12);
    expect(figureAt(entry, times[4]).world.far.wrist[1]).toBeGreaterThan(rest.far.wrist[1] + 12);
    const [up, , down] = entry.segmentDurationsMs;
    expect(down).toBeGreaterThanOrEqual(1.5 * up);
    expectStill(entry, BODY_STILL); // "Stand tall"
  });
});

describe('Alternate Hammer Curl (126)', () => {
  const entry = entryOf(126);
  const times = keyTimes(entry);

  test('swung the working arm out to the side: "Keeping the upper arm still and the palm facing in, curl one dumbbell up to shoulder height"', () => {
    const rest = figureAt(entry, 0).world;
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      for (const [name] of SIDES) {
        expect(world[name].elbow).toEqual(rest[name].elbow); // the upper arm does not move at all
        expect(Math.abs(world[name].wrist[2] - world[name].elbow[2])).toBeLessThanOrEqual(1); // the forearm stays in line, never out to the side
      }
    }
    for (const [name, at] of [['near', times[1]], ['far', times[4]]]) {
      const side = figureAt(entry, at).world[name];
      expect(Math.abs(side.wrist[1] - side.shoulder[1])).toBeLessThanOrEqual(4); // shoulder height
      expect(side.wrist[0]).toBeGreaterThan(side.elbow[0] + 4); // in front of the elbow
    }
  });
});

describe('Cross Body Hammer Curl (172)', () => {
  const entry = entryOf(172);
  const times = keyTimes(entry);

  test('swung the working arm out to the side: "curl one dumbbell across the body toward the opposite shoulder"', () => {
    const rest = figureAt(entry, 0).world;
    for (const [name, sign, at] of [['near', 1, times[1]], ['far', -1, times[4]]]) {
      const world = figureAt(entry, at).world, side = world[name];
      expect(sign * (rest[name].wrist[2] - side.wrist[2])).toBeGreaterThanOrEqual(7); // across,
      expect(Math.abs(side.wrist[2])).toBeLessThanOrEqual(3); // as far as the middle of the chest,
      expect(side.wrist[1]).toBeGreaterThanOrEqual(side.shoulder[1] - 8); // up toward shoulder height,
      expect(side.wrist[0]).toBeGreaterThanOrEqual(BACK_HALF + 2); // in front of the chest, not through it
      // Heading for the opposite shoulder: the hand finishes nearer to it than to its own.
      const other = name === 'near' ? world.far.shoulder : world.near.shoulder;
      expect(distance(side.wrist, other)).toBeLessThan(distance(rest[name].wrist, other) - 10);
    }
  });

  test('"Pause ... Upper arm stays close to the body"', () => {
    const rest = figureAt(entry, 0).world;
    expect(entry.segmentDurationsMs[1]).toBeGreaterThanOrEqual(400);
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      for (const [name] of SIDES) {
        expect(distance(world[name].elbow, rest[name].elbow)).toBeLessThanOrEqual(4);
        expect(Math.abs(world[name].elbow[2] - world[name].shoulder[2])).toBeLessThanOrEqual(2);
      }
    }
  });

  test('is not the Alternate Hammer Curl drawn again: its hand finishes across the chest, the other one in line with its own shoulder', () => {
    const alternate = entryOf(126);
    const across = figureAt(entry, times[1]).world.near.wrist;
    const straight = figureAt(alternate, keyTimes(alternate)[1]).world.near.wrist;
    expect(straight[2] - across[2]).toBeGreaterThanOrEqual(6);
  });
});

describe('Dumbbell Sumo Squat (57)', () => {
  const entry = entryOf(57);
  const [down, turn, up] = entry.segmentDurationsMs;

  test('was drawn from the side, which hides it: "Take a wide stance"', () => {
    expect(entry.view).toBe('front');
    const start = figureAt(entry, 0).world;
    for (const [name, sign] of SIDES) {
      expect(sign * start[name].ankle[2]).toBeCloseTo(SUMO_SQUAT.footOut, 9);
      expect(SUMO_SQUAT.footOut).toBeGreaterThanOrEqual(1.5 * start.near.shoulder[2]); // well outside the shoulders
    }
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      for (const [name] of SIDES) expect(world[name].ankle).toEqual(start[name].ankle); // the feet do not move
    }
  });

  test('"hold one dumbbell between the legs ... let the dumbbell hang"', () => {
    for (const t of ticksOf(entry)) {
      const figure = figureAt(entry, t);
      const { world } = figure;
      for (const [name, sign] of SIDES) {
        expect(Math.abs(world[name].hold[2])).toBeLessThanOrEqual(1.5); // both hands at the middle,
        expect(sign * world[name].knee[2]).toBeGreaterThan(Math.abs(world[name].hold[2]) + 4); // inside the knees
        expect(elbowOf(world[name])).toBeGreaterThanOrEqual(160); // on long arms
        expect(world[name].hold[1]).toBeLessThan(world[name].shoulder[1] - 20);
      }
      // One dumbbell, hanging upright from the hands, clear of the floor.
      const plates = figure.prims.filter((p) => p.kind === 'bone' && p.w === 2.6 && p.stroke === 'ink1');
      expect(plates).toHaveLength(2);
      const floor = figure.project([0, 0, 0])[1];
      for (const plate of plates) expect(Math.max(plate.y1, plate.y2)).toBeLessThan(floor - 5);
      expect(Math.abs(plates[0].y1 - plates[1].y1)).toBeGreaterThan(6); // one end above the other
    }
  });

  test('"Squat straight down between the knees while the torso stays tall ... the knees tracking over the toes"', () => {
    const start = figureAt(entry, 0).world, low = figureAt(entry, down).world;
    expect(start.hip[1] - low.hip[1]).toBeGreaterThanOrEqual(15);
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      expect(world.hip[0]).toBe(start.hip[0]); // straight down:
      expect(world.hip[2]).toBe(start.hip[2]); // not forward, not to one side
      expect(direction(world.hip, world.neck)).toBeCloseTo(90, 6); // torso tall
    }
    for (const [name, sign] of SIDES) {
      // Over the toes: each knee is out over its own foot, never caving in toward the middle.
      expect(sign * low[name].knee[2]).toBeGreaterThanOrEqual(SUMO_SQUAT.footOut);
      expect(sign * low[name].knee[2]).toBeLessThanOrEqual(SUMO_SQUAT.footOut + 6);
      expect(low[name].knee[0]).toBeGreaterThan(low[name].ankle[0]);
      expect(low.hip[1] - low[name].knee[1]).toBeLessThanOrEqual(10); // the thighs close to level
      expect(kneeOf(low[name])).toBeLessThan(110);
    }
  });

  test('"Drive through the whole foot": back up to where it started', () => {
    const start = figureAt(entry, 0).world, end = figureAt(entry, down + turn + up).world;
    expect(end.hip).toEqual(start.hip);
    expect(up).toBeGreaterThanOrEqual(1000);
  });
});

describe('Push Up to Side Plank (254)', () => {
  const entry = entryOf(254);
  const times = keyTimes(entry);
  // Keyframes: the top of the push-up, the bottom, the side plank, held, the top again, rest.
  const [top, bottom, plank, held, back] = times;
  const FREE_FOOT_HALF = (BODY.lw * 0.82) / 2;
  /** How far the hips are off the straight line from the planted ankle to the neck. */
  const sagOf = (world) => {
    const a = world.far.ankle, b = world.neck, h = world.hip;
    return Math.abs((b[0] - a[0]) * (h[1] - a[1]) - (b[1] - a[1]) * (h[0] - a[0])) / distance(flat(a), flat(b));
  };

  test('barely showed the turn or the reach: "shift onto one hand and turn the body, reaching the other arm to the ceiling"', () => {
    const start = figureAt(entry, top).world, turned = figureAt(entry, plank);
    const { world } = turned;
    expect(turned.angles.roll).toBeCloseTo(-90, 9); // a quarter turn onto the far side
    // Turned: the shoulders are stacked one above the other, and so are the hips.
    expect(Math.abs(world.near.shoulder[2] - world.far.shoulder[2])).toBeLessThan(1e-6);
    expect(world.near.shoulder[1] - world.far.shoulder[1]).toBeGreaterThanOrEqual(15);
    expect(Math.abs(world.near.hipJoint[2] - world.far.hipJoint[2])).toBeLessThan(1e-6);
    expect(world.near.hipJoint[1] - world.far.hipJoint[1]).toBeGreaterThanOrEqual(10);
    // On one hand: the lower arm is straight, upright, and its hand is where it was for the push-up.
    expect(distance(flat(world.far.wrist), flat(start.far.wrist))).toBeLessThan(1e-9);
    expect(elbowOf(world.far)).toBeGreaterThanOrEqual(170);
    expect(offUpright(world.far.wrist, world.far.shoulder)).toBeLessThanOrEqual(3);
    // To the ceiling: the upper arm is straight and points straight up from its shoulder.
    expect(elbowOf(world.near)).toBeGreaterThanOrEqual(170);
    expect(offUpright(world.near.shoulder, world.near.wrist)).toBeLessThanOrEqual(3);
    expect(world.near.wrist[1]).toBeGreaterThan(world.head[1] + BODY.hr + 10);
  });

  test('"Start in a push-up position on the toes ... Lower into a push-up with the body straight"', () => {
    const start = figureAt(entry, top).world, low = figureAt(entry, bottom).world;
    for (const [name] of SIDES) {
      expect(start[name].toe[1]).toBeCloseTo(FREE_FOOT_HALF, 6); // on the toes,
      expect(start[name].ankle[1]).toBeGreaterThan(start[name].toe[1] + 4); // heels up
      expect(start[name].wrist[1]).toBeLessThanOrEqual(2.5); // hands on the floor,
      expect(Math.abs(start[name].wrist[0] - start[name].shoulder[0])).toBeLessThanOrEqual(1); // under the shoulders
      expect(elbowOf(start[name])).toBeGreaterThanOrEqual(170);
      expect(elbowOf(low[name])).toBeLessThanOrEqual(100); // a real push-up
      expect(distance(low[name].wrist, start[name].wrist)).toBeLessThan(1e-9); // the hands do not move
    }
    expect(start.neck[1] - low.neck[1]).toBeGreaterThanOrEqual(12);
    expect(low.neck[1] - BACK_HALF).toBeGreaterThan(2); // the chest stops short of the floor
    expect(PUSH_UP_TOP_DEG - PUSH_UP_BOTTOM_DEG).toBeGreaterThanOrEqual(10);
  });

  test('"Body in one straight line", and the planted hand and foot never move', () => {
    const start = figureAt(entry, top).world;
    for (const t of ticksOf(entry)) {
      const figure = figureAt(entry, t);
      const { world } = figure;
      expect(sagOf(world)).toBeLessThanOrEqual(BODY.hw * 0.8 + 1e-6); // the hips never sag or pike off the line
      expect(figure.curled).toBe(false);
      // The lower leg is straight and in line with the trunk.
      expect(kneeOf(world.far)).toBeCloseTo(180, 4);
      expect(Math.abs(direction(world.far.ankle, world.far.hipJoint) - direction(world.hip, world.neck))).toBeLessThan(1e-6);
      expect(distance(flat(world.far.ankle), flat(start.far.ankle))).toBeLessThan(1e-9); // seen from the side, the planted foot stays put
      expect(distance(flat(world.far.wrist), flat(start.far.wrist))).toBeLessThan(1e-9);
      // The upper foot lifts and settles on the lower one; it never goes under the floor.
      expect(world.near.toe[1]).toBeGreaterThanOrEqual(FREE_FOOT_HALF - 1e-6);
    }
    const turned = figureAt(entry, plank).world;
    expect(turned.near.ankle[1] - turned.far.ankle[1]).toBeGreaterThanOrEqual(BODY.lw * 0.82); // resting on it,
    expect(turned.near.ankle[1] - turned.far.ankle[1]).toBeLessThanOrEqual(BODY.lw * 0.82 + 1); // not floating above it
    expect(SIDE_PLANK_DEG).toBeGreaterThan(PUSH_UP_TOP_DEG);
  });

  test('"Return the hand to the floor, do another push-up and turn to the other side"', () => {
    expect(held - plank).toBeGreaterThanOrEqual(600);
    const start = figureAt(entry, top).world, end = figureAt(entry, back).world;
    expect(distance(end.near.wrist, start.near.wrist)).toBeLessThan(1e-9);
    expect(figureAt(entry, back).angles.roll).toBeCloseTo(0, 9);
    expect(entry.frames.at(-1).caption).toContain('other side');
    // Pressing up runs straight on into the turn: there is no keyframe at the top between them.
    expect(entry.frames.map((f) => f.joints.ph)).toEqual([1, 0, 3, 3, 1, 1]);
  });
});
