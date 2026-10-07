// Standing movements seen from the front: Upright Barbell Row (295), Upright
// Row - With Bands (297) and Barbell Side Split Squat (139). Every bound below
// comes from the movement's own catalogue text, quoted beside it. Measured on
// the 3D model: x forward (toward the viewer's eye in this view), y up from
// the floor, z across the body.
import {
  CANONICAL_BODY_PARAMETERS,
  SIDE_SPLIT_SQUAT,
  UPRIGHT_ROW,
  chainGeometry,
  layoutCanonicalFigure,
  poseAtTime,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = CANONICAL_BODY_PARAMETERS;
const THIGH_HALF = (BODY.lw * 1.18) / 2;
const deg = (rad) => (rad * 180) / Math.PI;
/** Straight-line distance between two points of any dimension. */
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const minus = (a, b) => a.map((v, i) => v - b[i]);
/** The angle at a middle joint, in 3D: 180 is straight. */
const angleAt = (from, mid, to) => {
  const a = minus(from, mid), b = minus(to, mid);
  return deg(Math.acos(Math.max(-1, Math.min(1, a.reduce((sum, v, i) => sum + v * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b))))));
};
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
/** Keyframes are start, far end, far end after the pause, start, start. */
const turnTime = (entry) => entry.segmentDurationsMs[0];

const entry295 = entryOf(295);
const entry297 = entryOf(297);
const entry139 = entryOf(139);

describe.each([
  ['Upright Barbell Row', entry295],
  ['Upright Row - With Bands', entry297],
  ['Barbell Side Split Squat', entry139],
])('%s: front view, one unbroken motion each way', (_name, entry) => {
  test('is drawn from the front and never stops between its two end positions', () => {
    expect(entry.view).toBe('front');
    const [first, hold, second] = entry.segmentDurationsMs;
    expect(entry.frames.map((f) => f.joints.ph)).toEqual([0, 1, 1, 0, 0]);
    const moving = (from, to) => {
      for (let t = from + 33; t < to - 66; t += 33) {
        const now = figureAt(entry, t).joints, next = figureAt(entry, t + 33).joints;
        expect(Math.max(...['hp', 'el', 'wr', 'kn'].map((key) => distance(now[key], next[key])))).toBeGreaterThan(0.003);
      }
    };
    moving(0, first);
    moving(first + hold, first + hold + second);
  });
});

describe.each([
  ['Upright Barbell Row', entry295],
  ['Upright Row - With Bands', entry297],
])('%s: the upright row', (_name, entry) => {
  const [up, pause, down] = entry.segmentDurationsMs;
  const spec = UPRIGHT_ROW[slugOf(entry)];

  test('"Stand tall": upright on straight legs, and nothing but the arms moves', () => {
    const start = figureAt(entry, 0);
    expect(start.world.neck[0]).toBeCloseTo(start.world.hip[0], 9);
    expect(start.world.neck[2]).toBeCloseTo(start.world.hip[2], 9);
    expect(kneeOf(start.world.near)).toBeCloseTo(180, 4);
    for (const t of ticksOf(entry)) {
      const now = figureAt(entry, t);
      for (const key of ['hd', 'nk', 'hp', 'kn', 'an', 'kf', 'af', 'nArm', 'fArm']) expect(now.joints[key]).toEqual(start.joints[key]);
    }
  });

  test('the hands start against the thighs, in front of them', () => {
    const { world } = figureAt(entry, 0);
    for (const side of [world.near, world.far]) {
      expect(Math.abs(side.wrist[1] - world.hip[1])).toBeLessThanOrEqual(2); // at the top of the thighs
      expect(side.wrist[0]).toBeGreaterThan(THIGH_HALF); // in front of them
      expect(side.wrist[0]).toBeLessThanOrEqual(THIGH_HALF + 3); // and against them
    }
  });

  test('"Keeping the bar" (or the hands) "close to the body": straight up the front, the same distance apart all the way', () => {
    for (const t of ticksOf(entry)) {
      const { world } = figureAt(entry, t);
      for (const side of [world.near, world.far]) {
        // Never further forward than a hand's width from the front of the chest.
        expect(side.wrist[0]).toBeLessThanOrEqual(BODY.sw * 0.58 + 2);
        expect(side.wrist[0]).toBeGreaterThan(0);
      }
      expect(world.near.wrist[2]).toBeCloseTo(spec.gripHalf, 9);
      expect(world.far.wrist[2]).toBeCloseTo(-spec.gripHalf, 9);
      expect(world.near.wrist[1]).toBeCloseTo(world.far.wrist[1], 9); // level
    }
  });

  test('"lift it toward the chin by raising the elbows up and out to the sides, elbows higher than the hands"', () => {
    const { world } = figureAt(entry, up);
    const chin = world.head[1] - BODY.hr;
    for (const [side, sign] of [[world.near, 1], [world.far, -1]]) {
      // Toward the chin: at the top of the chest, below the chin.
      expect(side.wrist[1]).toBeLessThan(chin);
      expect(chin - side.wrist[1]).toBeLessThanOrEqual(7);
      // Up: the elbow finishes above the shoulder line. Out: well outside the shoulder.
      expect(side.elbow[1]).toBeGreaterThan(side.shoulder[1]);
      expect(sign * (side.elbow[2] - side.shoulder[2])).toBeGreaterThanOrEqual(5);
      // Higher than the hands.
      expect(side.elbow[1] - side.wrist[1]).toBeGreaterThanOrEqual(2);
    }
    // "Elbows lead and stay above the hands", on every tick.
    for (const t of ticksOf(entry)) {
      const now = figureAt(entry, t).world;
      expect(now.near.elbow[1]).toBeGreaterThan(now.near.wrist[1]);
      expect(now.far.elbow[1]).toBeGreaterThan(now.far.wrist[1]);
      // The two arms mirror each other.
      expect(now.far.elbow[2]).toBeCloseTo(-now.near.elbow[2], 9);
      expect(now.far.elbow[1]).toBeCloseTo(now.near.elbow[1], 9);
    }
  });

  test('"Pause, then lower" ... "slowly to the thighs"', () => {
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(down).toBeGreaterThanOrEqual(1.5 * up);
    const held = [0, pause / 2, pause].map((dt) => figureAt(entry, up + dt).world.near.wrist);
    expect(held[1]).toEqual(held[0]);
    expect(held[2]).toEqual(held[0]);
    const end = figureAt(entry, up + pause + down).world;
    expect(Math.abs(end.near.wrist[1] - end.hip[1])).toBeLessThanOrEqual(2);
  });
});

describe('Upright Barbell Row (295)', () => {
  test('"an overhand grip slightly narrower than the shoulders"', () => {
    const { world } = figureAt(entry295, 0);
    const hands = world.near.wrist[2] - world.far.wrist[2];
    const shoulders = world.near.shoulder[2] - world.far.shoulder[2];
    expect(hands).toBeLessThan(shoulders);
    expect(hands).toBeGreaterThanOrEqual(0.7 * shoulders);
  });

  test('"holding a barbell": one level bar through both hands, with a plate outside each hand', () => {
    for (const t of ticksOf(entry295)) {
      const { hold, prims } = figureAt(entry295, t);
      const shaft = prims.filter((p) => p.kind === 'bone' && p.w === 1.6 && p.color === 'textHi' && Math.abs(p.y1 - hold.near[1]) < 1e-9 && Math.abs(p.y2 - hold.near[1]) < 1e-9);
      expect(shaft).toHaveLength(2); // the two halves of one bar
      const xs = shaft.flatMap((p) => [p.x1, p.x2]);
      expect(Math.min(...xs)).toBeLessThan(Math.min(hold.near[0], hold.far[0]) - 5);
      expect(Math.max(...xs)).toBeGreaterThan(Math.max(hold.near[0], hold.far[0]) + 5);
      expect(prims.filter((p) => p.kind === 'bone' && p.w === 2.4 && p.stroke === 'ink1')).toHaveLength(2);
      expect(prims.filter((p) => p.kind === 'bone' && p.color === 'textMid')).toHaveLength(0); // no band
    }
  });
});

describe('Upright Row - With Bands (297)', () => {
  test('"Stand on the middle of a band and hold an end in each hand": a band from under each foot to the hand above it', () => {
    const lengths = [];
    for (const t of ticksOf(entry297)) {
      const { joints, hold, prims } = figureAt(entry297, t);
      const bands = prims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4);
      expect(bands).toHaveLength(2);
      for (const [ankle, hand] of [[joints.an, hold.near], [joints.af, hold.far]]) {
        const band = bands.find((p) => p.x1 === ankle[0] && p.x2 === hand[0] && p.y2 === hand[1]);
        expect(band).toBeDefined();
        expect(band.y1).toBeGreaterThan(ankle[1]); // from the floor under the foot
      }
      if (t <= turnTime(entry297)) lengths.push(distance([bands[0].x1, bands[0].y1], [bands[0].x2, bands[0].y2]));
      // An end in each hand, and no bar joining them.
      expect(prims.filter((p) => p.kind === 'circle' && p.r === 2.6)).toHaveLength(2);
      expect(prims.filter((p) => p.kind === 'bone' && p.w === 2.4 && p.stroke === 'ink1')).toHaveLength(0);
    }
    // The band stretches as the hands rise.
    for (let i = 1; i < lengths.length; i++) expect(lengths[i]).toBeGreaterThanOrEqual(lengths[i - 1] - 1e-9);
    expect(lengths.at(-1) - lengths[0]).toBeGreaterThan(15);
  });

  test('it is its own drawing: wider hands than the bar allows, a lower finish, a slower rep', () => {
    expect(UPRIGHT_ROW['upright-row-with-bands'].gripHalf).toBeGreaterThan(UPRIGHT_ROW['upright-barbell-row'].gripHalf);
    const bar = figureAt(entry295, turnTime(entry295)).world.near.wrist;
    const band = figureAt(entry297, turnTime(entry297)).world.near.wrist;
    expect(band[1]).toBeLessThan(bar[1] - 1);
    expect(entry297.segmentDurationsMs).not.toEqual(entry295.segmentDurationsMs);
  });
});

describe('Barbell Side Split Squat (139)', () => {
  const [down, turn, up] = entry139.segmentDurationsMs;

  test('"Stand tall with a barbell across the back of the shoulders": a level bar at shoulder height through both hands', () => {
    for (const t of ticksOf(entry139)) {
      const { world, hold, prims } = figureAt(entry139, t);
      for (const [side, sign] of [[world.near, 1], [world.far, -1]]) {
        expect(Math.abs(side.wrist[1] - side.shoulder[1])).toBeLessThanOrEqual(2);
        expect(sign * (side.wrist[2] - side.shoulder[2])).toBeGreaterThan(3); // hands outside the shoulders
      }
      expect(world.near.wrist[1]).toBeCloseTo(world.far.wrist[1], 9);
      const shaft = prims.filter((p) => p.kind === 'bone' && p.w === 1.6 && p.color === 'textHi' && Math.abs(p.y1 - hold.near[1]) < 1e-9 && Math.abs(p.y2 - hold.near[1]) < 1e-9);
      expect(shaft).toHaveLength(2);
      // Upright: the bar stays over the hips.
      expect(world.neck[2]).toBeCloseTo(world.hip[2], 9);
      expect(world.neck[0]).toBeCloseTo(world.hip[0], 9);
    }
    expect(kneeOf(figureAt(entry139, 0).world.near)).toBeGreaterThanOrEqual(160); // tall
  });

  test('"the feet placed wide apart", and they stay planted', () => {
    const start = figureAt(entry139, 0).world;
    const feet = start.near.ankle[2] - start.far.ankle[2];
    expect(feet).toBeCloseTo(2 * SIDE_SPLIT_SQUAT.footOut, 9);
    expect(feet).toBeGreaterThanOrEqual(2.5 * (start.near.hipJoint[2] - start.far.hipJoint[2]));
    for (const t of ticksOf(entry139)) {
      const { world } = figureAt(entry139, t);
      expect(world.near.ankle).toEqual(start.near.ankle);
      expect(world.far.ankle).toEqual(start.far.ankle);
    }
  });

  test('"Bend the knee and hip of the lead leg to lower toward that side"', () => {
    const start = figureAt(entry139, 0).world;
    const bottom = figureAt(entry139, down).world;
    expect(start.hip[1] - bottom.hip[1]).toBeGreaterThanOrEqual(6); // lower
    expect(bottom.hip[2] - start.hip[2]).toBeGreaterThanOrEqual(10); // toward the lead side
    expect(kneeOf(bottom.near)).toBeLessThanOrEqual(110);
    // The lead knee bends forward over its own foot: it does not fall in or out.
    expect(Math.abs(bottom.near.knee[2] - bottom.near.ankle[2])).toBeLessThanOrEqual(6);
    expect(bottom.near.knee[0]).toBeGreaterThan(bottom.near.ankle[0] + 5);
    // The hips end up over the lead foot, not past it.
    expect(bottom.near.hipJoint[2]).toBeLessThanOrEqual(bottom.near.ankle[2]);
  });

  test('"keeping the trailing leg only slightly bent"', () => {
    for (const t of ticksOf(entry139)) expect(kneeOf(figureAt(entry139, t).world.far)).toBeGreaterThanOrEqual(150);
    expect(kneeOf(figureAt(entry139, down).world.far)).toBeLessThan(175); // slightly bent, not locked
  });

  test('"Return by extending the hip and knee of the lead leg. Complete the reps on one side, then work the other."', () => {
    const end = figureAt(entry139, down + turn + up).world;
    expect(kneeOf(end.near)).toBeGreaterThanOrEqual(160);
    expect(end.hip[2]).toBeCloseTo(0, 9);
    expect(entry139.frames.at(-1).caption).toContain('work the other');
  });
});
