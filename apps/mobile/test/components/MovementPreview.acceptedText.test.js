// The movements whose catalogue text was only a placeholder on a source hold.
// On 9 October 2026 a description was written for each from the public-domain
// reference entry and its photographs, checked by a separate auditor, and
// accepted by the owner, who asked for each to be redrawn from it. Each block
// opens with what the old drawing got wrong, then holds the accepted text line
// by line. Measured on the 3D model: x forward, y up from the floor, z across
// the body toward the viewer.
import {
  BAND_GOOD_MORNING_ANCHOR,
  BAND_KICKBACK_ANCHOR,
  BAND_KICKBACK_DEG,
  BAND_KICKBACK_POST,
  BAND_PRESS_ANCHORS,
  BAND_PRESS_ELBOW_OUT,
  BENCH_ROW_FINISH,
  BENCH_ROW_TOP,
  BENCH_CRUNCH_BENCH_TOP,
  CABLE_SHRUG_PULLEY,
  CANONICAL_BODY_PARAMETERS,
  CHAIN_ANKLE_HEIGHT,
  CHAIN_MOVEMENTS,
  EXTERNAL_ROTATION_ANCHOR,
  GOOD_MORNING_KNEE_SOFT,
  INCLINE_PRESS_BENCH_DEG,
  INCLINE_PRESS_PULLEYS,
  KB_PRESS_ROLL,
  KB_PRESS_SHOULDER,
  KETTLEBELL_RADIUS,
  KNEELING_ROW_PULLEY,
  OBLIQUE_CRUNCH_FAR_HAND,
  OBLIQUE_CRUNCH_TWIST,
  ONE_ARM_PUSHDOWN_PULLEY,
  PREACHER_TRUNK,
  PREACHER_UPPER_ARM,
  ROPE_CRUNCH_PULLEY,
  ROPE_CRUNCH_UPRIGHT,
  SHOTGUN_PULLEY,
  SHOTGUN_RIBS,
  SHOTGUN_TRUNK,
  SHRUG_LIFT,
  SIDE_LYING_BENCH_TOP,
  SIDE_LYING_SHORT_OF_UPRIGHT,
  THREE_QUARTER_ANCHOR,
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
/** When each keyframe is reached. */
const keyTimes = (entry) => entry.segmentDurationsMs.reduce((times, d) => [...times, times.at(-1) + d], [0]);
const linesOf = (figure) => figure.prims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4);
const SIDES = [['near', 1], ['far', -1]];
// A cable or band is drawn 1.4 units wide. A limb that swings on its joints
// does not carry its end along a perfectly straight line, so a line can give
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
/** A line from a fixed point to `end(world)` that only lengthens between two times and is never shorter than at `from`. */
function expectLineOnlyLengthens(entry, anchor, end, from, to, gain = 1) {
  const fixed = anchor.length === 3 ? anchor : [...anchor, 0];
  const length = (t) => distance(fixed, end(figureAt(entry, t).world));
  expectOnlyGrows(ticksOf(entry).filter((t) => t >= from && t <= to).map(length), gain);
  for (const t of ticksOf(entry)) expect(length(t)).toBeGreaterThanOrEqual(length(from) - SLACK);
}
const nearHold = (world) => world.near.hold;
/** Joints that must not move at all through the cycle. */
function expectStill(entry, keys) {
  const start = figureAt(entry, 0).joints;
  for (const t of ticksOf(entry)) {
    const now = figureAt(entry, t).joints;
    for (const key of keys) expect(distance(now[key], start[key])).toBeLessThan(1e-9);
  }
}
const LEGS = ['kn', 'an', 'kf', 'af'];
const BODY_STILL = ['hd', 'nk', 'hp', ...LEGS];

const IDS = [125, 175, 263, 132, 214, 138, 163, 157, 193, 253, 198, 273, 234, 216, 245, 141, 196, 197, 247];

test.each(IDS.map((id) => [entryOf(id).name, entryOf(id)]))('%s is a pending redraw from the accepted description, and keeps its older draft id', (_name, entry) => {
  expect(entry.status).toBe('pending');
  expect(CHAIN_MOVEMENTS[slugOf(entry)]).toBeDefined();
  expect(entry.previewId).toBe(slugOf(entry).replaceAll('-', '_'));
  expect(entry.reason).toContain('Redrawn on 9 October 2026');
  expect(entry.reason).toContain('from the description accepted that day');
  // The placeholder that kept it on hold is gone from the entry.
  expect(entry.instructions).not.toMatch(/choose a load or range you can/);
  expect(entry.cues).not.toMatch(/Own the return without momentum|Own the pause before lowering/);
  expect(entry.frames[0].joints.ph).toBe(entry.frames.at(-1).joints.ph);
});

describe('3/4 Sit-Up (125)', () => {
  const entry = entryOf(125);
  // Keyframes: lying, upright, three quarters down, upright, three quarters down, lying, rest.
  const [lying, upright, lowered, uprightAgain, loweredAgain, back] = keyTimes(entry);

  test('lifted a stiff trunk and never showed the three-quarter lowering: "lower under control only three quarters of the way back down, so the shoulders stop short of the floor"', () => {
    const floor = figureAt(entry, lying).world, top = figureAt(entry, upright).world, part = figureAt(entry, lowered).world;
    const rise = (world) => world.neck[1] - floor.neck[1];
    expect(rise(top)).toBeGreaterThanOrEqual(15);
    // Three quarters of the way down leaves about a quarter of the height.
    expect(rise(part) / rise(top)).toBeGreaterThanOrEqual(0.15);
    expect(rise(part) / rise(top)).toBeLessThanOrEqual(0.4);
    expect(rise(part)).toBeGreaterThanOrEqual(4); // the shoulders are clear of the floor
    // "Start each following repetition from there": between the first sit-up and the end of the set the shoulders never go lower.
    for (const t of ticksOf(entry).filter((tick) => tick >= upright && tick <= loweredAgain)) {
      expect(rise(figureAt(entry, t).world)).toBeGreaterThanOrEqual(rise(part) - 1e-6);
    }
    expect(distance(figureAt(entry, loweredAgain).world.neck, part.neck)).toBeLessThan(1e-9);
    // "the shoulders return to the floor only when the set is over"
    expect(rise(figureAt(entry, back).world)).toBeCloseTo(0, 6);
  });

  test('"Bending at the hips and spine, sit up until the torso is upright"', () => {
    const top = figureAt(entry, upright);
    expect(between(direction(top.world.hip, top.world.neck), 90)).toBeLessThanOrEqual(15); // upright
    expect(distance(figureAt(entry, uprightAgain).world.neck, top.world.neck)).toBeLessThan(1e-9);
    const floor = figureAt(entry, lying).world;
    for (const t of ticksOf(entry)) {
      const figure = figureAt(entry, t);
      // Bending at the spine: wherever the shoulders are off the floor, the trunk is curled, not levered up stiff.
      if (figure.world.neck[1] - floor.neck[1] > 1) {
        expect(figure.curled).toBe(true);
        expect(curlOf(figure.world)).toBeGreaterThan(4);
      }
    }
  });

  test('"knees bent and the feet secured, hands resting lightly behind or beside your head"', () => {
    const start = figureAt(entry, lying).world;
    expect(start.neck[1]).toBeCloseTo(start.hip[1], 9); // lying on the back
    const roller = CHAIN_MOVEMENTS['3-4-sit-up'].equipment.find((s) => s.kind === 'roller');
    expect(roller.at).toEqual(THREE_QUARTER_ANCHOR);
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      expect(world.hip).toEqual(start.hip);
      for (const [name] of SIDES) {
        expect(kneeOf(world[name])).toBeLessThan(120);
        expect(world[name].ankle[1]).toBeCloseTo(CHAIN_ANKLE_HEIGHT, 9); // the feet never leave the floor
        expect(distance(flat(world[name].ankle), flat(start[name].ankle))).toBeLessThan(1e-9);
      }
      expect(distance(flat(world.near.wrist), flat(world.head))).toBeLessThanOrEqual(BODY.hr + 4);
    }
    // Secured: the bar sits over the feet, just above them.
    expect(Math.abs(roller.at[0] - start.near.ankle[0])).toBeLessThanOrEqual(5.4);
    expect(roller.at[1] - start.near.ankle[1]).toBeLessThanOrEqual(6);
    expect(roller.at[1]).toBeGreaterThan(start.near.ankle[1]);
  });
});

describe('Crunches (175)', () => {
  const entry = entryOf(175);
  const [up, hold, down] = entry.segmentDurationsMs;

  test('lifted a stiff trunk, with no bench: "the lower legs resting on a bench and the knees bent to ninety degrees"', () => {
    const { world } = figureAt(entry, 0);
    expect(world.neck[1]).toBeCloseTo(world.hip[1], 9); // lying on the floor
    const slab = CHAIN_MOVEMENTS.crunches.equipment.find((s) => s.kind === 'slab');
    expect(slab.a[1] + 2).toBeCloseTo(BENCH_CRUNCH_BENCH_TOP, 9);
    for (const [name] of SIDES) {
      const side = world[name];
      expect(kneeOf(side)).toBeCloseTo(90, 6);
      expect(side.knee[0]).toBeCloseTo(side.hipJoint[0], 9); // the thigh is upright: hips at ninety degrees too
      expect(side.ankle[1]).toBeCloseTo(side.knee[1], 9); // the shin is level,
      expect(side.ankle[1] - CHAIN_ANKLE_HEIGHT).toBeCloseTo(BENCH_CRUNCH_BENCH_TOP, 9); // resting on the bench,
      expect(slab.a[0]).toBeLessThan(side.knee[0] + 6);
      expect(slab.b[0]).toBeGreaterThan(side.ankle[0]); // which is under the whole of it
    }
  });

  test('"Press the lower back into the floor and curl the shoulders about ten centimetres off it, then hold for a second"', () => {
    const start = figureAt(entry, 0).world, top = figureAt(entry, up);
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      expect(world.hip).toEqual(start.hip);
      // "the lower back stays on the floor throughout": the lower third of the spine does not move.
      for (let i = 0; i <= 12; i++) expect(world.spine[i]).toEqual(start.spine[i]);
      for (const key of ['kn', 'an', 'kf', 'af']) expect(figureAt(entry, t).joints[key]).toEqual(figureAt(entry, 0).joints[key]);
      expect(distance(flat(world.near.wrist), flat(world.head))).toBeLessThanOrEqual(BODY.hr + 4); // hands beside the head
    }
    expect(top.curled).toBe(true);
    // Ten centimetres on a figure 86 units tall for 175 cm is about five units.
    expect(top.world.neck[1] - start.neck[1]).toBeGreaterThanOrEqual(3.5);
    expect(top.world.neck[1] - start.neck[1]).toBeLessThanOrEqual(6.5);
    expect(hold).toBeGreaterThanOrEqual(1000);
  });

  test('"Lower slowly to the start"', () => {
    expect(down).toBeGreaterThanOrEqual(1.4 * up);
    expect(curlOf(figureAt(entry, up + hold + down).world)).toBeCloseTo(0, 6);
  });
});

describe('Rope Crunch (263)', () => {
  const entry = entryOf(263);
  const [down, pause, up] = entry.segmentDurationsMs;

  test('showed nothing of where the hands are: "take a rope end in each hand, then draw the hands down beside your head ... Keeping the hands by your head"', () => {
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      expect(distance(flat(world.near.wrist), flat(world.head))).toBeLessThanOrEqual(BODY.hr + 4);
    }
    expect(linesOf(figureAt(entry, 0))).toHaveLength(1);
  });

  test('"Kneel facing a high pulley with a rope attached, about 30 to 60 centimetres from it ... with the torso upright"', () => {
    const { world } = figureAt(entry, 0);
    expect(world.near.knee[1]).toBeLessThanOrEqual(THIGH_HALF + 0.5); // knees on the floor
    expect(world.near.ankle[0]).toBeLessThan(world.near.knee[0] - 20); // shins along the floor behind
    expect(direction(world.hip, world.neck)).toBeCloseTo(90, 6);
    expect(world.near.knee[0]).toBeCloseTo(world.near.hipJoint[0], 6); // kneeling tall
    expect(ROPE_CRUNCH_PULLEY[1]).toBeGreaterThan(world.head[1] + BODY.hr + 10); // high,
    // and 30 to 60 centimetres in front, at about two centimetres to the unit.
    expect(ROPE_CRUNCH_PULLEY[0] - world.near.knee[0]).toBeGreaterThanOrEqual(14);
    expect(ROPE_CRUNCH_PULLEY[0] - world.near.knee[0]).toBeLessThanOrEqual(30);
  });

  test('"the hips still, curl the spine to bring the rib cage toward the thighs. Pause at the bottom, then return slowly to upright"', () => {
    expectStill(entry, ['hp', ...LEGS]);
    const start = figureAt(entry, 0).world, low = figureAt(entry, down);
    expect(low.curled).toBe(true);
    expect(curlOf(low.world)).toBeGreaterThanOrEqual(65);
    expect(start.neck[1] - low.world.neck[1]).toBeGreaterThanOrEqual(6);
    expect(low.world.neck[0]).toBeGreaterThan(start.neck[0] + 8); // toward the thighs, in front
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(up).toBeGreaterThanOrEqual(1.4 * down);
  });

  test('the cable: it gives back under a unit as the hands first travel forward beneath the pulley, then only lengthens', () => {
    // With the hips still, curling the spine carries the hands forward before it
    // carries them down, and the text puts the pulley in front. So at this
    // distance the cable first gives back a little. That is the geometry of the
    // accepted set-up, stated here rather than hidden: under one unit (about two
    // centimetres), against fifteen of lengthening.
    const length = (t) => distance([...ROPE_CRUNCH_PULLEY, 0], figureAt(entry, t).world.near.hold);
    const lengths = ticksOf(entry).filter((t) => t <= down).map(length);
    const shortest = Math.min(...lengths), turn = lengths.indexOf(shortest);
    expect(lengths[0] - shortest).toBeLessThan(1);
    expect(lengths.at(-1) - lengths[0]).toBeGreaterThanOrEqual(12);
    expectOnlyGrows(lengths.slice(turn), 12);
    // The hands pass under the pulley and nothing is in their way: the upright is well beyond them.
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      expect(ROPE_CRUNCH_UPRIGHT - Math.max(world.head[0] + BODY.hr, world.near.hold[0])).toBeGreaterThanOrEqual(6);
      expect(ROPE_CRUNCH_PULLEY[1] - world.near.hold[1]).toBeGreaterThanOrEqual(40); // and the pulley is always well overhead
    }
  });

  test('is not Cable Crunch drawn again: it starts upright, where Cable Crunch starts leaning toward its pulley', () => {
    const cableCrunch = entryOf(39);
    const here = figureAt(entry, 0).world, there = figureAt(cableCrunch, 0).world;
    expect(direction(here.hip, here.neck) - direction(there.hip, there.neck)).toBeGreaterThanOrEqual(15);
  });
});

describe('Band Good Morning (Pull Through) (132)', () => {
  const entry = entryOf(132);
  const [down, turn, up] = entry.segmentDurationsMs;

  test('showed a pull-through between the legs: "Loop a band around the base of a post, face the post and put the other end over your head so it rests low on the back of your neck, holding it there with both hands"', () => {
    const start = figureAt(entry, 0).world;
    expect(BAND_GOOD_MORNING_ANCHOR[1]).toBeLessThanOrEqual(5); // the base of the post,
    expect(BAND_GOOD_MORNING_ANCHOR[0]).toBeGreaterThan(start.near.toe[0] + 20); // in front: the athlete faces it
    for (const t of ticksOf(entry)) {
      const figure = figureAt(entry, t);
      // The band runs to the hands, which hold it at the base of the neck for the whole rep.
      expect(distance(flat(figure.world.near.hold), flat(figure.world.neck))).toBeLessThanOrEqual(6);
      expect(linesOf(figure)).toHaveLength(1);
    }
  });

  test('"with the knees slightly bent and the back flat push the hips back and fold forward until the torso is near level with the floor"', () => {
    const start = figureAt(entry, 0).world, low = figureAt(entry, down);
    expect(direction(start.hip, start.neck)).toBeCloseTo(90, 6);
    expect(direction(low.world.hip, low.world.neck)).toBeLessThanOrEqual(15); // near level
    expect(start.hip[0] - low.world.hip[0]).toBeGreaterThanOrEqual(7); // hips back
    for (const t of ticksOf(entry)) {
      const figure = figureAt(entry, t);
      expect(figure.curled).toBe(false); // back flat
      expect(kneeOf(figure.world.near)).toBeCloseTo(180 - 2 * GOOD_MORNING_KNEE_SOFT, 6); // one slight bend, kept
      expect(distance(figure.world.near.ankle, start.near.ankle)).toBeLessThan(1e-9);
    }
    // Over the feet: hips behind the heels, shoulders in front of the toes.
    expect(low.world.hip[0]).toBeLessThan(low.world.near.ankle[0]);
    expect(low.world.neck[0]).toBeGreaterThan(low.world.near.toe[0]);
  });

  test('"Drive the hips forward to stand tall again": the band only lengthens as the athlete stands', () => {
    const end = figureAt(entry, down + turn + up).world;
    expect(direction(end.hip, end.neck)).toBeCloseTo(90, 6);
    expectLineOnlyLengthens(entry, BAND_GOOD_MORNING_ANCHOR, nearHold, down + turn, down + turn + up, 10);
  });
});

describe('Hip Extension with Bands (214)', () => {
  const entry = entryOf(214);
  const [back, hold, forward] = entry.segmentDurationsMs;

  test('showed a two-legged hinge: "Standing tall with the chest up and the banded knee straight ... take that leg straight back ... without the lower back arching or the trunk tipping forward"', () => {
    const start = figureAt(entry, 0).world, far = figureAt(entry, back).world;
    for (const t of ticksOf(entry)) {
      const figure = figureAt(entry, t);
      const { world } = figure;
      expect(direction(world.hip, world.neck)).toBeCloseTo(90, 6); // standing tall: the trunk never tips
      expect(figure.curled).toBe(false); // and the back never arches
      expect(world.hip).toEqual(start.hip);
      expect(kneeOf(world.near)).toBeCloseTo(180, 4); // the banded knee stays straight
      // One leg works. The other stands still under the hip, straight, foot flat.
      expect(world.far.knee).toEqual(start.far.knee);
      expect(world.far.ankle).toEqual(start.far.ankle);
      expect(kneeOf(world.far)).toBeCloseTo(180, 4);
      expect(world.far.toe[1]).toBeCloseTo(world.far.ankle[1], 9);
    }
    expect(start.near.ankle[0] - far.near.ankle[0]).toBeGreaterThanOrEqual(14); // straight back
    expect(far.near.ankle[1] - start.near.ankle[1]).toBeGreaterThanOrEqual(2); // off the floor
    expect(BAND_KICKBACK_DEG).toBeGreaterThanOrEqual(15);
    expect(BAND_KICKBACK_DEG).toBeLessThanOrEqual(30); // as far as a hip extends before the back has to arch
  });

  test('"Fix one end of a band low on a post and the other around one ankle, then face the post, hold it for balance"', () => {
    const start = figureAt(entry, 0);
    expect(BAND_KICKBACK_POST).toBeGreaterThan(start.world.near.toe[0]); // in front
    expect(BAND_KICKBACK_ANCHOR[1]).toBeLessThanOrEqual(8); // low on it
    for (const t of ticksOf(entry)) {
      const figure = figureAt(entry, t);
      for (const [name] of SIDES) expect(figure.world[name].wrist[0]).toBeCloseTo(BAND_KICKBACK_POST, 9); // both hands on the post
      const band = linesOf(figure);
      expect(band).toHaveLength(1);
      expect(distance([band[0].x2, band[0].y2], figure.joints.an)).toBeLessThan(1e-9); // the band ends at the near ankle
    }
  });

  test('"Return the leg slowly to the start"; the band only lengthens as the leg goes back', () => {
    expect(hold).toBeGreaterThan(0);
    expect(forward).toBeGreaterThanOrEqual(1.4 * back);
    expectLineOnlyLengthens(entry, BAND_KICKBACK_ANCHOR, (world) => world.near.ankle, 0, back, 10);
    expect(entry.frames.at(-1).caption).toContain('change legs');
  });
});

describe.each([
  ['Barbell Shrug Behind The Back', entryOf(138)],
  ['Cable Shrugs', entryOf(163)],
])('%s', (_name, entry) => {
  const [up, hold, down] = entry.segmentDurationsMs;

  test('"Keeping the arms straight ... lift the shoulders ... as high as they go and hold for a second"', () => {
    const start = figureAt(entry, 0).world, top = figureAt(entry, up).world;
    for (const [name] of SIDES) {
      expect(top[name].shoulder[1] - start[name].shoulder[1]).toBeCloseTo(SHRUG_LIFT, 9);
      expect(top[name].shoulder[0]).toBeCloseTo(start[name].shoulder[0], 9); // straight up: no rolling forward or back
      expect(top[name].hold[1] - start[name].hold[1]).toBeCloseTo(SHRUG_LIFT, 9); // the bar rises exactly as far
    }
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      for (const [name] of SIDES) expect(elbowOf(world[name])).toBeCloseTo(180, 4); // arms stay long
    }
    expectStill(entry, BODY_STILL); // only the shoulders move
    expect(SHRUG_LIFT).toBe(4.5); // the lift Dumbbell Shrug and Barbell Shrug are drawn with
    expect(hold).toBeGreaterThanOrEqual(1000);
    expect(down).toBeGreaterThanOrEqual(1.5 * up);
  });

  test('the lifted shoulder is drawn joined to the neck, and only while it is lifted', () => {
    const trap = (t) => {
      const figure = figureAt(entry, t);
      return figure.prims.filter((p) => p.kind === 'bone' && p.color === 'textHi' && p.x1 === figure.joints.nk[0] && p.y1 === figure.joints.nk[1]
        && p.x2 === figure.joints.nArm[0] && p.y2 === figure.joints.nArm[1]);
    };
    expect(trap(0)).toHaveLength(0);
    expect(trap(up)).toHaveLength(1);
  });
});

describe('Barbell Shrug Behind The Back (138)', () => {
  const entry = entryOf(138);
  test('held the bar in front: "a barbell hanging at arm\'s length behind you"', () => {
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      expect(world.near.hold[0]).toBeLessThan(world.hip[0] - 2); // behind the body,
      expect(world.near.shoulder[1] - world.near.hold[1]).toBeGreaterThanOrEqual(22); // at arm's length,
      expect(world.hip[0] - world.near.hold[0]).toBeLessThanOrEqual(8); // close to it
    }
    expect(CHAIN_MOVEMENTS['barbell-shrug-behind-the-back'].implement).toBe('bar');
  });
});

describe('Cable Shrugs (163)', () => {
  const entry = entryOf(163);
  test('showed neither cable nor bar: "Stand facing a low pulley, close to it ... the arms hanging straight down in front of you"', () => {
    const start = figureAt(entry, 0);
    expect(CABLE_SHRUG_PULLEY[1]).toBeLessThanOrEqual(8); // low,
    expect(CABLE_SHRUG_PULLEY[0]).toBeGreaterThan(start.world.near.toe[0]); // in front,
    expect(CABLE_SHRUG_PULLEY[0] - start.world.near.toe[0]).toBeLessThanOrEqual(10); // and close
    expect(start.world.near.hold[0]).toBeGreaterThan(start.world.hip[0]); // the bar hangs in front of the body
    expect(linesOf(start)).toHaveLength(1);
    expect(CHAIN_MOVEMENTS['cable-shrugs'].implement).toBe('cableBar');
    expectLineOnlyLengthens(entry, CABLE_SHRUG_PULLEY, nearHold, 0, entry.segmentDurationsMs[0], 2);
  });
});

describe('Cable One Arm Tricep Extension (157)', () => {
  const entry = entryOf(157);
  const [down, squeeze, back] = entry.segmentDurationsMs;

  test('showed an overhead extension: "pull it down until the upper arm is locked against your side ... straighten the arm down beside you"', () => {
    const start = figureAt(entry, 0).world, end = figureAt(entry, down).world;
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      // Locked against the side: the upper arm hangs straight down from the shoulder and the elbow never moves.
      expect(world.near.elbow).toEqual(start.near.elbow);
      expect(world.near.elbow[0]).toBeCloseTo(world.near.shoulder[0], 9);
      expect(world.near.elbow[1]).toBeLessThan(world.near.shoulder[1] - 12);
      expect(world.near.wrist[1]).toBeLessThan(world.head[1] - BODY.hr); // never overhead
    }
    expect(elbowOf(start.near)).toBeLessThan(90); // "the elbow bent tighter than a right angle"
    expect(elbowOf(start.near)).toBeGreaterThanOrEqual(45);
    expect(elbowOf(end.near)).toBeGreaterThanOrEqual(175); // straight,
    expect(Math.abs(end.near.wrist[0] - end.hip[0])).toBeLessThanOrEqual(3); // down beside the body
  });

  test('"Stand facing a high pulley and take a single handle in one hand"; the other arm hangs', () => {
    const start = figureAt(entry, 0);
    expect(ONE_ARM_PUSHDOWN_PULLEY[0]).toBeGreaterThan(start.world.near.toe[0] + 5); // in front
    expect(ONE_ARM_PUSHDOWN_PULLEY[1]).toBeGreaterThan(start.world.head[1] + BODY.hr); // high
    expect(linesOf(start)).toHaveLength(1);
    expect(CHAIN_MOVEMENTS['cable-one-arm-tricep-extension'].implement).toBe('handle');
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      expect(world.far.wrist).toEqual(start.world.far.wrist); // the free arm does nothing
      expect(world.far.wrist[1]).toBeLessThan(world.far.shoulder[1] - 20);
    }
    expectStill(entry, BODY_STILL);
  });

  test('"squeeze the triceps for a second. Return slowly to the start"; the cable only lengthens as the arm straightens', () => {
    expect(squeeze).toBeGreaterThanOrEqual(1000);
    expect(back).toBeGreaterThanOrEqual(1.5 * down);
    expectLineOnlyLengthens(entry, ONE_ARM_PUSHDOWN_PULLEY, nearHold, 0, down, 10);
    expect(entry.frames.at(-1).caption).toContain('change arms');
  });
});

describe('Dumbbell Tricep Extension -Pronated Grip (193)', () => {
  const entry = entryOf(193);
  const [down, turn, up] = entry.segmentDurationsMs;

  test('showed a standing overhead extension: "Lie on a flat bench holding two dumbbells directly above the shoulders with the arms straight"', () => {
    const { world } = figureAt(entry, 0);
    expect(world.neck[1]).toBeCloseTo(world.hip[1], 9); // lying
    const slab = CHAIN_MOVEMENTS['dumbbell-tricep-extension-pronated-grip'].equipment.find((s) => s.kind === 'slab');
    expect(slab.a[1] + 2).toBeCloseTo(world.hip[1] - BODY.sw * 0.58, 6); // on the bench
    for (const [name] of SIDES) {
      expect(elbowOf(world[name])).toBeCloseTo(180, 4);
      expect(world[name].wrist[0]).toBeCloseTo(world[name].shoulder[0], 9); // directly above the shoulders
      expect(world[name].wrist[1]).toBeGreaterThan(world[name].shoulder[1] + 20);
      expect(world[name].ankle[1]).toBeCloseTo(CHAIN_ANKLE_HEIGHT, 9); // feet on the floor
    }
  });

  test('"Keeping the upper arms still ... bend the elbows to lower the dumbbells slowly until they are beside your ears"', () => {
    const start = figureAt(entry, 0).world, low = figureAt(entry, down).world;
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      for (const [name] of SIDES) {
        expect(world[name].elbow).toEqual(start[name].elbow); // upper arms stay vertical
        expect(world[name].elbow[2]).toBeCloseTo(world[name].shoulder[2], 9); // elbows tucked in
        expect(world[name].wrist[2]).toBeCloseTo(world[name].shoulder[2], 9);
      }
    }
    // Beside the ears: at the height of the head, alongside it.
    expect(Math.abs(low.near.wrist[1] - low.head[1])).toBeLessThanOrEqual(BODY.hr);
    expect(Math.abs(low.near.wrist[0] - low.head[0])).toBeLessThanOrEqual(BODY.hr);
    expect(elbowOf(low.near)).toBeGreaterThanOrEqual(35); // no tighter than an elbow folds
    expect(down).toBeGreaterThanOrEqual(1.4 * up); // slowly
    expect(turn).toBeGreaterThan(0);
  });

  test('"palms facing toward your feet ... the grip unchanged": each dumbbell reads end-on, the same on every tick', () => {
    for (const t of ticksOf(entry)) {
      const figure = figureAt(entry, t);
      const ends = figure.prims.filter((p) => p.kind === 'rect' && p.w === 5.6 && p.h === 5.6);
      expect(ends).toHaveLength(2);
    }
    expect(CHAIN_MOVEMENTS['dumbbell-tricep-extension-pronated-grip'].bellAxis).toBeUndefined(); // across the body
  });
});

describe('Preacher Hammer Dumbbell Curl (253)', () => {
  const entry = entryOf(253);
  const [down, turn, up, squeeze] = entry.segmentDurationsMs;
  const armHalf = (BODY.lw * 0.88) / 2;

  test('could not show the pad or how far the arms straighten: "rest the backs of both upper arms on the pad"', () => {
    expect(entry.view).toBe('side');
    const { world } = figureAt(entry, 0);
    const equipment = CHAIN_MOVEMENTS['preacher-hammer-dumbbell-curl'].equipment;
    const pad = equipment.find((s) => s.kind === 'slab' && Math.abs(s.a[1] - s.b[1]) > 1);
    const seat = equipment.find((s) => s.kind === 'slab' && s !== pad);
    expect(seat.a[1] + 2).toBeCloseTo(world.hip[1] - THIGH_HALF, 6); // "Sit at a preacher bench"
    // The pad slopes the way the upper arm lies, and its face is just under the arm.
    expect(direction(pad.a, pad.b)).toBeCloseTo(360 + PREACHER_UPPER_ARM, 6);
    expect(direction(world.near.shoulder, world.near.elbow)).toBeCloseTo(360 + PREACHER_UPPER_ARM, 6);
    const off = (point) => {
      const a = (PREACHER_UPPER_ARM * Math.PI) / 180;
      return (point[0] - world.near.shoulder[0]) * Math.sin(a) - (point[1] - world.near.shoulder[1]) * Math.cos(a);
    };
    expect(off(pad.a)).toBeCloseTo(armHalf + 2, 6); // the slab is 4 thick: its top face touches the underside of the arm
    expect(off(pad.b)).toBeCloseTo(armHalf + 2, 6);
    // It carries the elbow: the pad runs on past it.
    expect(distance(pad.b, world.near.shoulder)).toBeGreaterThan(distance(world.near.elbow, world.near.shoulder) + 4);
    expect(PREACHER_TRUNK).toBeLessThan(90); // leaning onto it
  });

  test('"Lower the dumbbells slowly until the arms are almost straight ... without bouncing at the bottom"', () => {
    const start = figureAt(entry, 0).world, low = figureAt(entry, down).world;
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      for (const [name] of SIDES) expect(world[name].elbow).toEqual(start[name].elbow); // "Upper arms stay on the pad"
      expect(world.hip).toEqual(start.hip);
      expect(world.neck).toEqual(start.neck);
    }
    expect(elbowOf(low.near)).toBeGreaterThanOrEqual(160); // almost straight,
    expect(elbowOf(low.near)).toBeLessThanOrEqual(172); // not locked out
    expect(down).toBeGreaterThanOrEqual(1.5 * up); // slowly
    expect(turn).toBeGreaterThanOrEqual(250); // a turn, not a bounce
    // The forearm never goes past the line of the upper arm.
    for (const t of ticksOf(entry)) {
      const { near } = figureAt(entry, t).world;
      const past = ((direction(near.elbow, near.wrist) - PREACHER_UPPER_ARM + 540) % 360) - 180;
      expect(past).toBeGreaterThan(0);
    }
  });

  test('"Curl both back up to shoulder height with the palms still facing each other, and squeeze for a second"', () => {
    const top = figureAt(entry, down + turn + up);
    for (const [name] of SIDES) expect(Math.abs(top.world[name].wrist[1] - top.world[name].shoulder[1])).toBeLessThanOrEqual(3);
    expect(top.world.near.wrist[1]).toBeCloseTo(top.world.far.wrist[1], 9); // both together
    expect(squeeze).toBeGreaterThanOrEqual(1000);
    // Palms facing each other: each dumbbell is held like a hammer, square to its forearm, on every tick.
    for (const t of ticksOf(entry)) {
      const figure = figureAt(entry, t);
      const handles = figure.prims.filter((p) => p.kind === 'bone' && p.w === 2.2);
      expect(handles).toHaveLength(2);
      const grip = figure.grip.near, elbow = figure.joints.el;
      const handle = handles.find((p) => Math.abs((p.x1 + p.x2) / 2 - grip[0]) < 1e-9 && Math.abs((p.y1 + p.y2) / 2 - grip[1]) < 1e-9);
      expect(Math.abs((handle.x2 - handle.x1) * (grip[0] - elbow[0]) + (handle.y2 - handle.y1) * (grip[1] - elbow[1]))).toBeLessThan(1e-6);
    }
  });
});

describe('External Rotation with Cable (198)', () => {
  const entry = entryOf(198);
  const [out, pause, back] = entry.segmentDurationsMs;

  test('did not show which hand holds the cable: "holding the handle in the hand farther from the cable"', () => {
    const start = figureAt(entry, 0);
    const { world } = start;
    // The cable is out to one side and the working shoulder is the one on the other side of the body from it.
    expect(Math.sign(EXTERNAL_ROTATION_ANCHOR[2])).toBe(-Math.sign(world.near.shoulder[2]));
    expect(Math.abs(EXTERNAL_ROTATION_ANCHOR[2])).toBeGreaterThanOrEqual(20); // "about half a metre away": 25 units, from the body's side
    expect(Math.abs(EXTERNAL_ROTATION_ANCHOR[2]) - Math.abs(world.far.shoulder[2])).toBeLessThanOrEqual(35);
    const cable = linesOf(start);
    expect(cable).toHaveLength(1);
    expect(distance([cable[0].x2, cable[0].y2], start.hold.near)).toBeLessThan(1e-9); // it runs to the working hand
    for (const t of ticksOf(entry)) {
      const now = figureAt(entry, t).world;
      expect(now.far.elbow).toEqual(world.far.elbow); // the arm nearer the cable hangs and does nothing
      expect(now.far.wrist).toEqual(world.far.wrist);
    }
  });

  test('"that elbow pressed to your side and bent to ninety degrees, forearm across the front of your body"', () => {
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      expect(elbowOf(world.near)).toBeCloseTo(90, 6);
      expect(world.near.elbow[2]).toBeCloseTo(world.near.shoulder[2], 9); // at the side
      expect(world.near.wrist[1]).toBeCloseTo(world.near.elbow[1], 9); // the forearm stays level
      expect(Math.abs(EXTERNAL_ROTATION_ANCHOR[1] - world.near.elbow[1])).toBeLessThanOrEqual(1); // "a cable ... at elbow height"
    }
    const start = figureAt(entry, 0).world.near;
    // Across the front: the hand starts on the cable's side of its own elbow, in front of the body.
    expect(Math.sign(EXTERNAL_ROTATION_ANCHOR[2]) * (start.wrist[2] - start.elbow[2])).toBeGreaterThanOrEqual(8);
    expect(start.wrist[0]).toBeGreaterThan(0);
  });

  test('"turn the forearm outward, away from the cable, like a backhand ... Return slowly"', () => {
    const start = figureAt(entry, 0).world.near, end = figureAt(entry, out).world.near;
    expect(-Math.sign(EXTERNAL_ROTATION_ANCHOR[2]) * (end.wrist[2] - end.elbow[2])).toBeGreaterThanOrEqual(6); // away from the cable
    expect(end.wrist[0]).toBeGreaterThan(end.elbow[0]); // and still in front: as far as it goes comfortably, not behind the body
    expect(end.elbow).toEqual(start.elbow); // "Keeping the elbow in place"
    expectStill(entry, BODY_STILL); // "and the body still"
    expect(pause).toBeGreaterThan(0);
    expect(back).toBeGreaterThanOrEqual(1.4 * out);
    expectLineOnlyLengthens(entry, EXTERNAL_ROTATION_ANCHOR, nearHold, 0, out, 10);
    expect(entry.frames.at(-1).caption).toContain('change arms');
  });
});

describe('Shotgun Row (273)', () => {
  const entry = entryOf(273);
  const [pull, pause, back] = entry.segmentDurationsMs;

  test('showed an upright two-handed row: "a wide split stance with the leg opposite the working arm in front; lean forward from the hips with a flat back, rest the free hand on the front thigh"', () => {
    const start = figureAt(entry, 0);
    const { world } = start;
    expect(direction(world.hip, world.neck)).toBeCloseTo(SHOTGUN_TRUNK, 6);
    expect(SHOTGUN_TRUNK).toBeGreaterThanOrEqual(30);
    expect(SHOTGUN_TRUNK).toBeLessThanOrEqual(60); // leaning well forward, not upright and not level
    expect(start.curled).toBe(false); // flat back
    // Split: the far foot is in front and the near foot behind, well apart, both flat on the floor.
    expect(world.far.ankle[0] - world.near.ankle[0]).toBeGreaterThanOrEqual(35);
    expect(world.far.ankle[0]).toBeGreaterThan(world.hip[0]);
    expect(world.near.ankle[0]).toBeLessThan(world.hip[0]);
    for (const [name] of SIDES) expect(world[name].ankle[1]).toBeCloseTo(CHAIN_ANKLE_HEIGHT, 9);
    // The working arm is the near one; the leg in front is the far one, the opposite side.
    expect(linesOf(start)).toHaveLength(1);
    // The free hand rests on the front thigh and stays there.
    for (const t of ticksOf(entry)) {
      const now = figureAt(entry, t).world;
      expect(now.far.wrist).toEqual(world.far.wrist);
      const along = now.far.knee.map((v, i) => v - now.far.hipJoint[i]);
      const k = Math.max(0, Math.min(1, ((now.far.wrist[0] - now.far.hipJoint[0]) * along[0] + (now.far.wrist[1] - now.far.hipJoint[1]) * along[1]) / (along[0] ** 2 + along[1] ** 2)));
      const onThigh = [now.far.hipJoint[0] + along[0] * k, now.far.hipJoint[1] + along[1] * k];
      expect(distance(flat(now.far.wrist), onThigh)).toBeLessThanOrEqual(THIGH_HALF + 3);
    }
  });

  test('"hold the handle ... with the arm straight and the shoulder reaching toward the pulley"', () => {
    const { world } = figureAt(entry, 0);
    expect(elbowOf(world.near)).toBeGreaterThanOrEqual(170);
    expect(SHOTGUN_PULLEY[1]).toBeLessThan(20); // a low pulley,
    expect(SHOTGUN_PULLEY[0]).toBeGreaterThan(world.far.toe[0] + 15); // in front, far enough that the cable is taut
    // Reaching toward it: the arm lies along the cable's own line.
    expect(between(direction(world.near.shoulder, world.near.wrist), direction(world.near.wrist, SHOTGUN_PULLEY))).toBeLessThanOrEqual(3);
  });

  test('"Draw the shoulder blade back and bend the elbow to row the handle to the side of your lower ribs"', () => {
    const end = figureAt(entry, pull).world;
    const ribs = onTrunk(end, end.near.hold);
    expect(ribs.along).toBeCloseTo(SHOTGUN_RIBS, 6);
    expect(SHOTGUN_RIBS).toBeGreaterThanOrEqual(TRUNK * 0.4); // the lower ribs: above the waist,
    expect(SHOTGUN_RIBS).toBeLessThanOrEqual(TRUNK * 0.65); // below the chest
    expect(Math.abs(ribs.front)).toBeLessThanOrEqual(4); // at the side of the trunk, not out in front of it
    // "elbow past your side": the elbow finishes behind the line of the back.
    expect(onTrunk(end, end.near.elbow).front).toBeLessThan(-(BODY.sw * 0.58));
    expectStill(entry, BODY_STILL); // no twisting, no rising
  });

  test('"Pause briefly, then return under control to the reach"; the cable only lengthens on the pull', () => {
    expect(pause).toBeGreaterThanOrEqual(300);
    expect(back).toBeGreaterThanOrEqual(1.4 * pull);
    expectLineOnlyLengthens(entry, SHOTGUN_PULLEY, nearHold, 0, pull, 10);
    expect(entry.frames.at(-1).caption).toContain('change sides');
  });
});

describe('Kneeling High Pulley Row (234)', () => {
  const entry = entryOf(234);
  const [pull, pause, back] = entry.segmentDurationsMs;

  test('did not show both knees down or the rope: "kneel on both knees facing it about half a metre back, holding one rope end in each hand ... the arms straight, reaching up toward the pulley"', () => {
    const start = figureAt(entry, 0);
    const { world } = start;
    for (const [name] of SIDES) {
      expect(world[name].knee[1]).toBeLessThanOrEqual(THIGH_HALF + 0.5); // both knees on the floor
      expect(world[name].knee[0]).toBeCloseTo(world[name].hipJoint[0], 6); // kneeling tall
      expect(elbowOf(world[name])).toBeGreaterThanOrEqual(170);
      expect(world[name].wrist[1]).toBeGreaterThan(world.head[1] + BODY.hr); // reaching up
      expect(between(direction(world[name].shoulder, world[name].wrist), direction(world[name].wrist, KNEELING_ROW_PULLEY))).toBeLessThanOrEqual(12); // toward the pulley
    }
    expect(KNEELING_ROW_PULLEY[1]).toBeGreaterThan(world.head[1] + BODY.hr + 20); // "well above your head"
    // About half a metre back, at about two centimetres to the unit.
    expect(KNEELING_ROW_PULLEY[0] - world.near.knee[0]).toBeGreaterThanOrEqual(20);
    expect(KNEELING_ROW_PULLEY[0] - world.near.knee[0]).toBeLessThanOrEqual(30);
    expect(linesOf(start)).toHaveLength(2); // one rope end in each hand
    expect(distance(world.near.hold, world.far.hold)).toBeLessThanOrEqual(8);
    expect(entry.view).toBe('oblique');
  });

  test('"bend the elbows out to the sides until the rope ends reach either side of your upper chest"', () => {
    const end = figureAt(entry, pull).world;
    for (const [name, sign] of SIDES) {
      const side = end[name];
      expect(sign * (side.elbow[2] - side.shoulder[2])).toBeGreaterThanOrEqual(8); // elbows out
      expect(Math.abs(side.elbow[1] - side.shoulder[1])).toBeLessThanOrEqual(5); // about level with the shoulders
      // Either side of the upper chest: just below shoulder height, outside the chest's own half-width, close in front.
      expect(side.shoulder[1] - side.wrist[1]).toBeGreaterThanOrEqual(0);
      expect(side.shoulder[1] - side.wrist[1]).toBeLessThanOrEqual(6);
      expect(sign * side.wrist[2]).toBeGreaterThanOrEqual(BODY.sw * 0.92);
      expect(side.wrist[0]).toBeLessThanOrEqual(BODY.sw * 0.58 + 2);
    }
  });

  test('"Keeping the torso upright and still ... Pause briefly, then let the arms straighten slowly"', () => {
    expectStill(entry, BODY_STILL);
    const { world } = figureAt(entry, pull);
    expect(direction(world.hip, world.neck)).toBeCloseTo(90, 6); // "do not lean back"
    expect(pause).toBeGreaterThanOrEqual(300);
    expect(back).toBeGreaterThanOrEqual(1.5 * pull);
    expectLineOnlyLengthens(entry, KNEELING_ROW_PULLEY, nearHold, 0, pull, 15);
  });
});

describe('Incline Cable Chest Press (216)', () => {
  const entry = entryOf(216);
  const [press, pause, lower] = entry.segmentDurationsMs;

  test('showed neither the two low pulleys nor the handles coming together: "an incline bench ... between two pulleys at their lowest setting"', () => {
    const start = figureAt(entry, 0);
    expect(entry.view).toBe('oblique');
    expect(linesOf(start)).toHaveLength(2);
    for (const [name, sign, pulley] of [['near', 1, INCLINE_PRESS_PULLEYS[0]], ['far', -1, INCLINE_PRESS_PULLEYS[1]]]) {
      expect(pulley[1]).toBeLessThanOrEqual(8); // lowest setting
      expect(sign * pulley[2]).toBeGreaterThanOrEqual(25); // one each side
      expect(pulley[0]).toBeLessThanOrEqual(start.world[name].shoulder[0]); // beside or just behind the shoulders
      const length = (t) => distance(pulley, figureAt(entry, t).world[name].hold);
      expectOnlyGrows(ticksOf(entry).filter((t) => t <= press).map(length), 8); // "keeping tension on the cables"
      for (const t of ticksOf(entry)) expect(length(t)).toBeGreaterThanOrEqual(length(0) - SLACK);
    }
  });

  test('"Set an incline bench to about 30 to 45 degrees ... lie back with your head, shoulders and hips on the pad and feet flat on the floor"', () => {
    expect(INCLINE_PRESS_BENCH_DEG).toBeGreaterThanOrEqual(30);
    expect(INCLINE_PRESS_BENCH_DEG).toBeLessThanOrEqual(45);
    const { world } = figureAt(entry, 0);
    expect(direction(world.hip, world.neck)).toBeCloseTo(180 - INCLINE_PRESS_BENCH_DEG, 6);
    expect(direction(world.neck, world.head)).toBeCloseTo(180 - INCLINE_PRESS_BENCH_DEG, 6); // the head lies back in line, on the pad
    const pad = CHAIN_MOVEMENTS['incline-cable-chest-press'].equipment.find((s) => s.kind === 'slab' && Math.abs(s.a[1] - s.b[1]) > 1);
    for (const end of [pad.a, pad.b]) expect(onTrunk(world, end).front).toBeCloseTo(-(BODY.sw * 0.58 + 2), 6); // the pad lies along the back
    for (const [name] of SIDES) expect(world[name].ankle[1]).toBeCloseTo(CHAIN_ANKLE_HEIGHT, 9);
    expectStill(entry, BODY_STILL);
  });

  test('"upper arms about forty-five degrees from your sides and elbows bent to about ninety degrees"', () => {
    const { world } = figureAt(entry, 0);
    const down = [world.hip[0] - world.neck[0], world.hip[1] - world.neck[1], 0].map((v) => v / TRUNK);
    for (const [name] of SIDES) {
      const side = world[name];
      expect(Math.abs(elbowOf(side) - 90)).toBeLessThanOrEqual(10);
      const upper = minus(side.elbow, side.shoulder);
      const fromSide = deg(Math.acos(upper.reduce((sum, v, i) => sum + v * down[i], 0) / Math.hypot(...upper)));
      expect(Math.abs(fromSide - 45)).toBeLessThanOrEqual(8);
    }
  });

  test('"press the handles up and together above the upper chest until the arms are straight. Pause, then lower slowly"', () => {
    const start = figureAt(entry, 0).world, top = figureAt(entry, press).world;
    for (const [name] of SIDES) {
      expect(elbowOf(top[name])).toBeGreaterThanOrEqual(165);
      // Up: square to the bench, out from the chest.
      const out = onTrunk(top, top[name].hold);
      expect(out.front).toBeGreaterThanOrEqual(18);
      expect(out.along).toBeGreaterThanOrEqual(TRUNK * 0.7); // above the upper chest, not the stomach
      expect(out.along).toBeLessThanOrEqual(TRUNK + 6);
    }
    expect(distance(top.near.hold, top.far.hold)).toBeLessThanOrEqual(8); // together
    expect(distance(start.near.hold, start.far.hold) - distance(top.near.hold, top.far.hold)).toBeGreaterThanOrEqual(20);
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(lower).toBeGreaterThanOrEqual(1.5 * press);
  });
});

describe('Oblique Crunches (245)', () => {
  const entry = entryOf(245);
  const [up, pause, down] = entry.segmentDurationsMs;
  const HAND = BODY.lw * 0.44;

  test('lifted a stiff trunk with no bench and no turn: "lift the shoulder on the same side as the hand at your head and curl up and across, bringing that elbow toward the opposite knee"', () => {
    const start = figureAt(entry, 0).world, top = figureAt(entry, up).world;
    expect(curlOf(start)).toBeCloseTo(0, 6);
    expect(curlOf(top)).toBeGreaterThanOrEqual(25); // the spine curls; the trunk is not lifted stiff
    // The shoulder on the side of the raised hand is the one that lifts; the other stays down.
    expect(top.near.shoulder[1] - start.near.shoulder[1]).toBeGreaterThanOrEqual(6);
    expect(Math.abs(top.far.shoulder[1] - start.far.shoulder[1])).toBeLessThanOrEqual(1);
    expect(OBLIQUE_CRUNCH_TWIST).toBeGreaterThanOrEqual(20);
    // Across: the raised elbow travels toward the far side of the body and toward the far knee.
    expect(start.near.elbow[2] - top.near.elbow[2]).toBeGreaterThanOrEqual(5);
    expect(distance(start.near.elbow, start.far.knee) - distance(top.near.elbow, top.far.knee)).toBeGreaterThanOrEqual(10);
    // "touching it only if the lower back stays down": drawn short of touching.
    expect(distance(top.near.elbow, top.far.knee)).toBeGreaterThan(8);
    expect(entry.view).toBe('oblique');
  });

  test('"the lower legs resting on a bench so the hips and knees are bent to about ninety degrees ... Keeping the legs still"', () => {
    const { world } = figureAt(entry, 0);
    for (const [name] of SIDES) {
      const side = world[name];
      expect(kneeOf(side)).toBeCloseTo(90, 6);
      expect(direction(side.hipJoint, side.knee)).toBeCloseTo(90, 6); // the thigh upright: the hip at a right angle to a level trunk
      expect(side.ankle[1] - CHAIN_ANKLE_HEIGHT).toBeCloseTo(BENCH_CRUNCH_BENCH_TOP, 6); // the calf rests on the bench
    }
    expect(world.neck[1]).toBeCloseTo(world.hip[1], 9); // lying flat
    expectStill(entry, ['hp', ...LEGS]);
    // "the lower back pressed down": the hip end of the spine stays level on the floor while the upper part curls.
    const top = figureAt(entry, up).world;
    expect(top.spine[1][1]).toBeCloseTo(top.spine[0][1], 6);
  });

  test('"one hand beside your head and the other arm on the floor out to the side"', () => {
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      expect(distance(world.near.wrist, world.head)).toBeLessThanOrEqual(BODY.hr + 4); // beside the head, on every tick
      expect(distance(world.far.wrist, OBLIQUE_CRUNCH_FAR_HAND)).toBeLessThan(1e-6); // the other hand does not leave its place,
      expect(world.far.wrist[1]).toBeLessThanOrEqual(HAND + 0.2); // which is on the floor,
      expect(world.far.elbow[1]).toBeGreaterThanOrEqual(HAND - 0.5); // with the elbow not sunk into it,
    }
    // and out to the side: far beyond the shoulder's own width.
    expect(Math.abs(OBLIQUE_CRUNCH_FAR_HAND[2])).toBeGreaterThanOrEqual(BODY.sw * 0.92 + 15);
  });

  test('"Lower under control to the start ... then swap arms and do the same on the other side"', () => {
    expect(pause).toBeGreaterThan(0);
    expect(down).toBeGreaterThanOrEqual(1.3 * up);
    expect(entry.frames.at(-1).caption).toContain('swap arms');
  });
});

describe('Bench Press - With Bands (141)', () => {
  const entry = entryOf(141);
  const [lower, turn, press, squeeze] = entry.segmentDurationsMs;
  const movement = CHAIN_MOVEMENTS['bench-press-with-bands'];

  test('showed a barbell, where the text has none: "Trap the middle of a band with handles under the head-end leg of a flat bench ... take a handle in each hand"', () => {
    const start = figureAt(entry, 0);
    expect(movement.implement).toBe('handles');
    // No bar or plates: nothing drawn at barbell or plate width.
    expect(start.prims.filter((p) => p.kind === 'bone' && (p.w === 1.6 || p.w === 2.4) && p.color === 'textHi')).toHaveLength(0);
    const posts = movement.equipment.filter((shape) => shape.kind === 'post').map((shape) => shape.at[0]);
    const headEnd = Math.min(...posts), footEnd = Math.max(...posts);
    expect(Math.abs(headEnd - start.world.head[0])).toBeLessThan(Math.abs(footEnd - start.world.head[0])); // the head-end leg
    for (const anchor of BAND_PRESS_ANCHORS) {
      expect(anchor[0]).toBeCloseTo(headEnd, 6); // under that leg,
      expect(anchor[1]).toBeLessThanOrEqual(1); // on the floor
    }
    expect(linesOf(start).length + start.prims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4).length).toBeGreaterThanOrEqual(2);
    expect(entry.view).toBe('oblique');
  });

  test('"lie back with the arms straight above the chest, hands shoulder-width apart"', () => {
    const { world } = figureAt(entry, 0);
    expect(world.neck[1]).toBeCloseTo(world.hip[1], 9); // lying on the bench
    const slab = movement.equipment.find((shape) => shape.kind === 'slab');
    expect(slab.a[1] + 2).toBeCloseTo(world.hip[1] - BODY.sw * 0.58, 6);
    for (const [name] of SIDES) {
      const side = world[name];
      expect(elbowOf(side)).toBeGreaterThanOrEqual(170);
      expect(side.wrist[0]).toBeCloseTo(side.shoulder[0], 6); // straight above,
      expect(side.wrist[2]).toBeCloseTo(side.shoulder[2], 6); // each hand over its own shoulder: shoulder-width
      expect(side.ankle[1]).toBeCloseTo(CHAIN_ANKLE_HEIGHT, 6);
    }
  });

  test('"Lower the handles slowly until the elbows are bent to ninety degrees"', () => {
    const low = figureAt(entry, lower).world;
    const toFeet = [1, 0, 0];
    for (const [name] of SIDES) {
      const side = low[name];
      expect(elbowOf(side)).toBeCloseTo(90, 4);
      expect(side.elbow[1]).toBeCloseTo(side.shoulder[1], 4); // the upper arm level with the chest: no lower than the bench allows
      // The upper arm's angle out from the side of the body.
      const upper = minus(side.elbow, side.shoulder);
      const fromSide = deg(Math.acos(upper.reduce((sum, v, i) => sum + v * toFeet[i], 0) / Math.hypot(...upper)));
      expect(fromSide).toBeCloseTo(BAND_PRESS_ELBOW_OUT, 4);
      expect(direction(side.elbow, side.wrist)).toBeCloseTo(90, 4); // forearm upright under the handle
    }
    for (const t of ticksOf(entry)) expect(elbowOf(figureAt(entry, t).world.near)).toBeGreaterThanOrEqual(90 - 0.1); // never deeper
    expectStill(entry, BODY_STILL);
  });

  test('"Press back up to straight arms, squeeze the chest for a second, and take at least twice as long to lower as to press"', () => {
    expect(lower).toBeGreaterThanOrEqual(2 * press);
    expect(squeeze).toBeGreaterThanOrEqual(1000);
    expect(turn).toBeGreaterThan(0);
    // The band only stretches on the press, and is never shorter than at the bottom.
    for (const [name, anchor] of [['near', BAND_PRESS_ANCHORS[0]], ['far', BAND_PRESS_ANCHORS[1]]]) {
      const length = (t) => distance(anchor, figureAt(entry, t).world[name].hold);
      expectOnlyGrows(ticksOf(entry).filter((t) => t >= lower + turn && t <= lower + turn + press).map(length), 4);
      for (const t of ticksOf(entry)) expect(length(t)).toBeGreaterThanOrEqual(length(lower) - SLACK);
    }
  });
});

describe('Extended Range One-Arm Kettlebell Floor Press (196)', () => {
  const entry = entryOf(196);
  const [press, pause, lower] = entry.segmentDurationsMs;
  const ARM_HALF = (BODY.lw * 0.88) / 2;
  // The way the rolled chest faces, and how far round from it the upper arm is: 90 is level with the chest, more is behind it.
  const chestFront = [0, Math.cos((KB_PRESS_ROLL * Math.PI) / 180), -Math.sin((KB_PRESS_ROLL * Math.PI) / 180)];
  const fromChest = (side) => {
    const upper = minus(side.elbow, side.shoulder);
    return deg(Math.acos(upper.reduce((sum, v, i) => sum + v * chestFront[i], 0) / Math.hypot(...upper)));
  };

  test('showed a flat floor press: "take the knee across your body so the hips and trunk roll toward the other side and the pressing shoulder lifts off the floor"', () => {
    for (const t of ticksOf(entry)) {
      const figure = figureAt(entry, t);
      const { world } = figure;
      expect(figure.angles.roll).toBe(KB_PRESS_ROLL);
      // The pressing (near) shoulder and hip are lifted; the other shoulder is down by the floor.
      expect(world.near.shoulder[1] - world.far.shoulder[1]).toBeGreaterThanOrEqual(8);
      expect(world.near.hipJoint[1] - world.far.hipJoint[1]).toBeGreaterThanOrEqual(5);
      expect(world.far.shoulder[1]).toBeLessThanOrEqual(ARM_HALF + 1);
      expect(world.far.shoulder[1]).toBeGreaterThanOrEqual(ARM_HALF); // on the floor, not in it
      // The knee is across: beyond the far hip, on the far side of the body's midline.
      expect(world.near.knee[2]).toBeLessThan(world.far.hipJoint[2]);
      expect(kneeOf(world.near)).toBeLessThanOrEqual(110); // bent,
      expect(world.near.ankle[1]).toBeCloseTo(CHAIN_ANKLE_HEIGHT, 6); // its foot on the floor
      expect(kneeOf(world.far)).toBeGreaterThanOrEqual(175); // the other leg long
    }
    expect(KB_PRESS_ROLL).toBeGreaterThanOrEqual(25);
    expect(KB_PRESS_ROLL).toBeLessThanOrEqual(45);
    expect(figureAt(entry, 0).world.near.shoulder.map((v) => Math.round(v * 1e6))).toEqual(KB_PRESS_SHOULDER.map((v) => Math.round(v * 1e6)));
  });

  test('"Lie on your back holding a kettlebell by the handle at one shoulder ... with the free arm out on the floor for support"', () => {
    const start = figureAt(entry, 0);
    const { world } = start;
    expect(world.neck[1]).toBeCloseTo(world.hip[1], 9); // lying
    expect(CHAIN_MOVEMENTS['extended-range-one-arm-kettlebell-floor-press'].implement).toBe('kettlebell');
    const bells = start.prims.filter((p) => p.kind === 'circle' && p.r === KETTLEBELL_RADIUS);
    expect(bells).toHaveLength(1); // one kettlebell, in the pressing hand
    expect(distance([bells[0].cx, bells[0].cy], start.hold.near)).toBeLessThanOrEqual(KETTLEBELL_RADIUS + 1.5);
    // At the shoulder: the hand is beside it, no higher than a forearm above it.
    expect(distance(world.near.wrist, world.near.shoulder)).toBeLessThanOrEqual(14);
    for (const t of ticksOf(entry)) {
      const now = figureAt(entry, t).world;
      expect(now.far.wrist).toEqual(world.far.wrist); // the free hand stays put,
      expect(now.far.wrist[1]).toBeLessThanOrEqual(BODY.lw * 0.44 + 0.2); // on the floor,
      expect(now.far.elbow[1]).toBeGreaterThanOrEqual(1.5);
      expect(Math.abs(now.far.wrist[2] - now.far.shoulder[2])).toBeGreaterThanOrEqual(20); // out to its side
    }
  });

  test('"Press the kettlebell up until the arm is straight and vertical, drawing the upper arm in toward the chest as it rises"', () => {
    const start = figureAt(entry, 0).world.near, top = figureAt(entry, press).world.near;
    expect(elbowOf(top)).toBeGreaterThanOrEqual(170);
    expect(distance([top.wrist[0], top.wrist[2]], [top.shoulder[0], top.shoulder[2]])).toBeLessThan(1e-6); // vertical: straight above the shoulder
    expect(top.wrist[1]).toBeGreaterThan(top.shoulder[1] + 23);
    // In toward the chest: the elbow starts well out to the side and finishes in line with the shoulder.
    expect(start.elbow[2] - start.shoulder[2]).toBeGreaterThanOrEqual(7);
    expect(Math.abs(top.elbow[2] - top.shoulder[2])).toBeLessThanOrEqual(1);
    // Measured against the chest itself: the upper arm only ever closes toward the chest's front as the kettlebell rises.
    const round = ticksOf(entry).filter((t) => t <= press).map((t) => fromChest(figureAt(entry, t).world.near));
    for (let i = 1; i < round.length; i++) expect(round[i]).toBeLessThanOrEqual(round[i - 1] + 1e-6);
    expect(round[0] - round.at(-1)).toBeGreaterThanOrEqual(80);
  });

  test('"Lower under control, letting the elbow sink behind the line of the chest only as far as the shoulder is comfortable"', () => {
    const low = figureAt(entry, press + pause + lower).world.near;
    // Behind the line of the chest: the elbow ends below its own, lifted, shoulder. That is the extended range.
    expect(low.shoulder[1] - low.elbow[1]).toBeGreaterThanOrEqual(3);
    expect(low.shoulder[1] - low.elbow[1]).toBeLessThanOrEqual(8); // and no further
    // Against the rolled chest the upper arm is well past level: a press lying flat stops at ninety.
    expect(fromChest(low)).toBeGreaterThanOrEqual(120);
    expect(fromChest(low)).toBeLessThanOrEqual(150);
    expect(low.elbow[1]).toBeGreaterThanOrEqual(ARM_HALF); // it does not go into the floor
    expect(direction(low.elbow, low.wrist)).toBeCloseTo(90, 4); // the forearm upright under the kettlebell
    expect(pause).toBeGreaterThan(0);
    expect(lower).toBeGreaterThanOrEqual(1.5 * press);
    expectStill(entry, BODY_STILL);
    expect(entry.frames.at(-1).caption).toContain('change sides');
  });
});

describe('External Rotation (197)', () => {
  const entry = entryOf(197);
  const [up, hold, down] = entry.segmentDurationsMs;
  const movement = CHAIN_MOVEMENTS['external-rotation'];

  test('showed a standing athlete: "Lie on your side on a flat bench with your head resting on the bottom arm"', () => {
    const start = figureAt(entry, 0);
    const { world } = start;
    expect(world.neck[1]).toBeCloseTo(world.hip[1], 9); // lying,
    // on one side: one shoulder straight above the other, and one hip above the other.
    expect(world.near.shoulder[1] - world.far.shoulder[1]).toBeCloseTo(2 * BODY.sw * 0.92, 6);
    expect(world.near.shoulder[2]).toBeCloseTo(world.far.shoulder[2], 6);
    expect(world.near.hipJoint[1]).toBeGreaterThan(world.far.hipJoint[1] + 10);
    // On the bench: the bottom shoulder rests on its top.
    const slab = movement.equipment.find((shape) => shape.kind === 'slab');
    expect(slab.a[1] + 2).toBeCloseTo(SIDE_LYING_BENCH_TOP, 6);
    expect(world.far.shoulder[1] - BODY.lw * 0.44).toBeCloseTo(SIDE_LYING_BENCH_TOP, 6);
    expect(slab.a[1]).toBeCloseTo(slab.b[1], 9); // a flat bench
    // The head rests on the bottom arm: it is lowered toward the bench, and the bottom forearm passes under it.
    expect(world.head[1]).toBeLessThan(world.neck[1] - 2);
    const lowArm = [world.far.elbow, world.far.wrist];
    const under = Math.min(...[0, 0.25, 0.5, 0.75, 1].map((k) => Math.hypot(
      lowArm[0][0] + (lowArm[1][0] - lowArm[0][0]) * k - world.head[0], lowArm[0][2] + (lowArm[1][2] - lowArm[0][2]) * k - world.head[2])));
    expect(under).toBeLessThanOrEqual(BODY.hr);
    expect(world.head[1] - BODY.hr - (world.far.wrist[1] + BODY.lw * 0.44)).toBeLessThanOrEqual(1.5);
    expect(entry.view).toBe('oblique');
  });

  test('"a light dumbbell in the top hand with that elbow tucked against your side and bent to ninety degrees, so the forearm points straight ahead, level with the floor"', () => {
    const start = figureAt(entry, 0);
    const top = start.world.near;
    expect(movement.implement).toBe('bell'); // one dumbbell, in the top (near) hand
    // Tucked against the side: the upper arm lies along the top side of the trunk, toward the hips.
    expect(top.elbow[1]).toBeCloseTo(top.shoulder[1], 6);
    expect(top.elbow[2]).toBeCloseTo(top.shoulder[2], 6);
    expect(top.elbow[0]).toBeLessThan(top.shoulder[0] - 12);
    for (const t of ticksOf(entry)) {
      const now = figureAt(entry, t).world.near;
      expect(elbowOf(now)).toBeCloseTo(90, 6); // "Elbow stays at ninety degrees"
      expect(now.elbow).toEqual(top.elbow); // "Elbow stays tucked to your side"
    }
    // Straight ahead and level: the forearm points out of the front of the body, which faces the viewer.
    expect(top.wrist[1]).toBeCloseTo(top.elbow[1], 6);
    expect(top.wrist[0]).toBeCloseTo(top.elbow[0], 6);
    expect(top.wrist[2] - top.elbow[2]).toBeGreaterThan(11);
    // The knees are bent forward the same way, so "ahead" is the way the body faces.
    expect(start.world.near.knee[2]).toBeGreaterThan(start.world.near.hipJoint[2] + 5);
  });

  test('"turn the forearm up toward the ceiling as far as it goes comfortably, no further than upright, and hold for a second"', () => {
    const start = figureAt(entry, 0).world.near, end = figureAt(entry, up).world.near;
    expect(end.wrist[1] - end.elbow[1]).toBeGreaterThanOrEqual(10); // up toward the ceiling
    const tilt = (side) => deg(Math.atan2(side.wrist[2] - side.elbow[2], side.wrist[1] - side.elbow[1])); // 0 is upright, 90 level ahead
    expect(tilt(start)).toBeCloseTo(90, 6);
    expect(tilt(end)).toBeCloseTo(SIDE_LYING_SHORT_OF_UPRIGHT, 6);
    expect(SIDE_LYING_SHORT_OF_UPRIGHT).toBeGreaterThanOrEqual(0); // no further than upright
    for (const t of ticksOf(entry)) {
      const now = figureAt(entry, t).world.near;
      expect(tilt(now)).toBeGreaterThanOrEqual(SIDE_LYING_SHORT_OF_UPRIGHT - 1e-6);
      expect(tilt(now)).toBeLessThanOrEqual(90 + 1e-6);
      expect(now.wrist[0]).toBeCloseTo(now.elbow[0], 6); // it turns about the upper arm, and goes nowhere else
    }
    expect(hold).toBeGreaterThanOrEqual(1000);
  });

  test('"Lower slowly to the start without letting your body roll back, complete the repetitions, then change sides"', () => {
    expect(down).toBeGreaterThanOrEqual(1.5 * up);
    expectStill(entry, [...BODY_STILL, 'ef', 'wf']); // nothing but the top forearm moves
    for (const t of ticksOf(entry)) expect(figureAt(entry, t).angles.roll).toBe(-90);
    expect(entry.frames.at(-1).caption).toContain('change sides');
  });
});

describe('One-Arm Dumbbell Row (247)', () => {
  const entry = entryOf(247);
  const [pull, squeeze, lower] = entry.segmentDurationsMs;
  const movement = CHAIN_MOVEMENTS['one-arm-dumbbell-row'];

  test('borrowed a row that finishes at the hip: "pull the dumbbell straight up to the side of the chest"', () => {
    expect(entry.derivesFrom).toBeUndefined(); // its own drawing now
    expect(entry.frames).toHaveLength(5);
    const start = figureAt(entry, 0).world, top = figureAt(entry, pull).world;
    const hand = onTrunk(top, top.near.hold);
    // Beside the chest: in the chest half of the trunk, nearer the shoulder than the hip, and within the trunk's own depth.
    expect(hand.along).toBeGreaterThanOrEqual(TRUNK * 0.7);
    expect(hand.along).toBeLessThanOrEqual(TRUNK);
    expect(Math.abs(hand.front)).toBeLessThanOrEqual(BODY.sw * 0.58);
    expect(TRUNK - hand.along).toBeCloseTo(BENCH_ROW_FINISH[0], 6);
    // Straight up: the hand rises far more than it drifts.
    const rise = top.near.hold[1] - start.near.hold[1], drift = Math.abs(top.near.hold[0] - start.near.hold[0]);
    expect(rise).toBeGreaterThanOrEqual(15);
    expect(drift).toBeLessThanOrEqual(rise / 3);
    // The elbow leads up past the back.
    expect(top.near.elbow[1]).toBeGreaterThan(top.neck[1] + 3);
  });

  test('"Place one knee and the same-side hand on a flat bench with the other foot flat on the floor"', () => {
    const { world } = figureAt(entry, 0);
    const slab = movement.equipment.find((shape) => shape.kind === 'slab');
    expect(slab.a[1] + 2).toBeCloseTo(BENCH_ROW_TOP, 6);
    expect(slab.a[1]).toBeCloseTo(slab.b[1], 9);
    // The far knee and the far hand rest on the bench top; they are the same side.
    expect(world.far.knee[1] - THIGH_HALF).toBeCloseTo(BENCH_ROW_TOP, 6);
    expect(world.far.wrist[1] - BODY.lw * 0.44).toBeCloseTo(BENCH_ROW_TOP + 0.1, 6);
    expect(world.far.ankle[1]).toBeCloseTo(world.far.knee[1], 6); // the shin lies along the bench
    for (const point of [world.far.knee, world.far.wrist, world.far.ankle]) {
      expect(point[0]).toBeGreaterThanOrEqual(Math.min(slab.a[0], slab.b[0]));
      expect(point[0]).toBeLessThanOrEqual(Math.max(slab.a[0], slab.b[0]));
    }
    // The other (near) foot is flat on the floor.
    expect(world.near.ankle[1]).toBeCloseTo(CHAIN_ANKLE_HEIGHT, 6);
    expect(world.near.toe[1]).toBeCloseTo(world.near.ankle[1], 6);
    expect(kneeOf(world.near)).toBeGreaterThanOrEqual(150); // a standing leg, a little soft
  });

  test('"bend forward until your torso is level with the floor and your back is flat ... the arm hanging straight ... Keeping the torso still and the upper arm close to your side"', () => {
    const start = figureAt(entry, 0);
    expect(start.world.neck[1]).toBeCloseTo(start.world.hip[1], 9); // level
    expect(start.curled).toBe(false); // flat
    expect(elbowOf(start.world.near)).toBeGreaterThanOrEqual(170);
    expect(start.world.near.wrist[0]).toBeCloseTo(start.world.near.shoulder[0], 6); // hanging straight down under the shoulder
    expect(movement.implement).toBe('bell'); // a dumbbell in the free hand only
    expect(movement.bellAxis).toEqual([1, 0, 0]); // "the palm facing in": the handle runs the way the body does
    for (const t of ticksOf(entry)) {
      const { near } = figureAt(entry, t).world;
      expect(near.elbow[2]).toBeCloseTo(near.shoulder[2], 6); // close to the side
      expect(near.wrist[2]).toBeCloseTo(near.shoulder[2], 6);
    }
    expectStill(entry, [...BODY_STILL, 'ef', 'wf']);
  });

  test('"squeeze the back. Lower it straight down to a long arm, complete the repetitions, then change sides"', () => {
    expect(squeeze).toBeGreaterThanOrEqual(500);
    expect(lower).toBeGreaterThanOrEqual(1.5 * pull);
    const end = figureAt(entry, pull + squeeze + lower).world.near;
    expect(elbowOf(end)).toBeGreaterThanOrEqual(170);
    expect(entry.frames.at(-1).caption).toContain('change sides');
  });
});
