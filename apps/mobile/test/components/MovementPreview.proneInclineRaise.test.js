// Chest-supported incline shoulder raises: Barbell Incline Shoulder Raise (135)
// and Dumbbell Incline Shoulder Raise (187), redrawn to the owner's correction
// of 2026-10-07. Each bound below is one of the owner's instructions, quoted
// beside it. Lengths and angles are measured on the 3D model, not on the
// foreshortened drawing.
import {
  CANONICAL_BODY_PARAMETERS,
  PRONE_INCLINE_RAISE,
  layoutCanonicalFigure,
  poseAtTime,
  proneInclineRaiseGeometry,
  resolveFigureJoints,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = CANONICAL_BODY_PARAMETERS;
const deg = (rad) => (rad * 180) / Math.PI;
/** Straight-line distance between two points of any dimension. */
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
/** The angle at `mid` between the segments to `a` and to `b`, in degrees. */
function angleAt(mid, a, b) {
  const u = a.map((v, i) => v - mid[i]);
  const w = b.map((v, i) => v - mid[i]);
  const dot = u.reduce((sum, v, i) => sum + v * w[i], 0);
  return deg(Math.acos(dot / (Math.hypot(...u) * Math.hypot(...w))));
}

const entry135 = previewManifest.entries.find((e) => e.movementId === 135);
const entry187 = previewManifest.entries.find((e) => e.movementId === 187);

/** Every 33 ms tick of the cycle, plus its exact end. */
function ticksOf(entry) {
  const total = entry.segmentDurationsMs.reduce((a, b) => a + b, 0);
  return [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];
}

/** The interpolated pose, the 3D model behind it and the drawn primitives at time `t`. */
function figureAt(entry, barbell, t) {
  const pose = poseAtTime(entry.frames.map((f) => f.joints), t, entry.segmentDurationsMs);
  const opts = { ...entry, body: BODY };
  return {
    pose,
    model: proneInclineRaiseGeometry(pose.pi, BODY, barbell),
    joints: resolveFigureJoints(pose, opts),
    prims: layoutCanonicalFigure(pose, opts),
  };
}
const topTime = (entry) => entry.segmentDurationsMs[0];

describe.each([
  ['Barbell Incline Shoulder Raise', entry135, true],
  ['Dumbbell Incline Shoulder Raise', entry187, false],
])('%s: the owner\'s set-up', (_name, entry, barbell) => {
  test('is a pending oblique draft that closes its loop', () => {
    expect(entry.status).toBe('pending');
    expect(entry.view).toBe('oblique');
    expect(entry.frames.length).toBeGreaterThanOrEqual(5);
    expect(entry.frames[0].joints).toEqual(entry.frames.at(-1).joints);
  });

  test('"the angle of the bench at 45 degree incline, with the chest facing the bench"', () => {
    const { model } = figureAt(entry, barbell, 0);
    const { hip, neck, trunk, anterior } = model.world;
    // The trunk lies along a 45 degree incline, head end up.
    expect(deg(Math.atan2(neck[1] - hip[1], neck[0] - hip[0]))).toBeCloseTo(45, 9);
    expect(PRONE_INCLINE_RAISE.inclineDeg).toBe(45);
    // Chest down: the front of the body points forward and toward the floor.
    expect(anterior[1]).toBeLessThan(0);
    expect(anterior[0] * trunk[0] + anterior[1] * trunk[1]).toBeCloseTo(0, 12);
    // The drawn pad runs parallel to the drawn trunk, on its chest side.
    const padAlong = [model.pad[1][0] - model.pad[0][0], model.pad[1][1] - model.pad[0][1]];
    const drawnTrunk = [model.joints.nk[0] - model.joints.hp[0], model.joints.nk[1] - model.joints.hp[1]];
    expect(padAlong[0] * drawnTrunk[1] - padAlong[1] * drawnTrunk[0]).toBeCloseTo(0, 9);
    const toPad = [model.pad[0][0] - model.joints.hp[0], model.pad[0][1] - model.joints.hp[1]];
    expect(toPad[0] * model.chestSide[0] + toPad[1] * model.chestSide[1]).toBeGreaterThan(BODY.sw * 0.58);
    // The pad stops short of the shoulders, so the arms hang clear of it.
    expect(PRONE_INCLINE_RAISE.padSpan[1]).toBeLessThan(0.75);
  });

  test('"their legs wider support their base a bit along with the bench": feet planted, wider than the hips', () => {
    const start = figureAt(entry, barbell, 0).model;
    const hipHalfWidth = Math.abs(start.nearLeg.world.root[2]);
    const stanceHalfWidth = Math.abs(start.nearLeg.world.ankle[2]);
    expect(stanceHalfWidth).toBeGreaterThanOrEqual(hipHalfWidth * 1.5);
    expect(start.nearLeg.world.ankle[2]).toBeCloseTo(-start.farLeg.world.ankle[2], 12);
    for (const leg of [start.nearLeg, start.farLeg]) {
      // Thigh and shin keep their real lengths with the foot on the floor.
      expect(distance(leg.world.root, leg.world.knee)).toBeCloseTo(22.25, 9);
      expect(distance(leg.world.knee, leg.world.ankle)).toBeCloseTo(22.25, 9);
      expect(leg.projected.ankle[1] + (BODY.lw * 0.9) / 2).toBeCloseTo(96.9, 9);
    }
    // "the center of the person should be over the center of their mass": the
    // middle of the trunk sits between the feet behind and the bench foot in front.
    const midTrunk = start.project([12 * start.world.trunk[0], 12 * start.world.trunk[1], 0]);
    const feetX = Math.max(start.nearLeg.projected.ankle[0], start.farLeg.projected.ankle[0]);
    expect(midTrunk[0]).toBeGreaterThan(feetX);
    expect(midTrunk[0]).toBeLessThan(start.base[1][0]);
    expect(midTrunk[0]).toBeGreaterThan(start.base[0][0] - 12);
  });

  test('only the arms move, and every arm bone keeps its real length on every tick', () => {
    const start = figureAt(entry, barbell, 0).joints;
    for (const t of ticksOf(entry)) {
      const { model, joints } = figureAt(entry, barbell, t);
      for (const key of ['hd', 'nk', 'hp', 'kn', 'an', 'kf', 'af', 'nArm', 'fArm', 'nLeg', 'fLeg']) {
        expect(joints[key]).toEqual(start[key]);
      }
      for (const arm of [model.near, model.far]) {
        expect(distance(arm.world.shoulder, arm.world.elbow)).toBeCloseTo(12.5, 9);
        expect(distance(arm.world.elbow, arm.world.wrist)).toBeCloseTo(12.0, 9);
      }
      // The two arms mirror across the body.
      expect(model.near.world.elbow[1]).toBeCloseTo(model.far.world.elbow[1], 12);
      expect(model.near.world.elbow[2]).toBeCloseTo(-model.far.world.elbow[2], 12);
      expect(model.near.world.wrist[2]).toBeCloseTo(-model.far.world.wrist[2], 12);
    }
  });

  test('"show the arms raise up, elbows leading first"', () => {
    const elbowHeights = [];
    for (const t of ticksOf(entry)) {
      const { model } = figureAt(entry, barbell, t);
      const { shoulder, elbow, wrist } = model.near.world;
      // The elbow is always above the hand, and outside the shoulder.
      expect(elbow[1]).toBeGreaterThan(wrist[1]);
      expect(elbow[2]).toBeGreaterThan(shoulder[2]);
      elbowHeights.push(elbow[1] - shoulder[1]);
    }
    const top = figureAt(entry, barbell, topTime(entry)).model.near.world;
    // At the top the elbow is up at the shoulder line and well out to the side.
    // The dumbbell arm reaches it exactly. The bar's narrower grip, with the
    // elbow angle kept above 100 degrees, leaves the elbow just under it.
    expect(Math.abs(top.elbow[1] - top.shoulder[1])).toBeLessThanOrEqual(barbell ? 4.5 : 1);
    expect(top.elbow[2] - top.shoulder[2]).toBeGreaterThanOrEqual(10);
    expect(Math.max(...elbowHeights)).toBeCloseTo(top.elbow[1] - top.shoulder[1], 9);
    // "elbows leading first": through the first half of the raise the elbow
    // climbs further than the hand does.
    const bottom = figureAt(entry, barbell, 0).model.near.world;
    const half = figureAt(entry, barbell, entry.segmentDurationsMs[0] / 2).model.near.world;
    expect(half.elbow[1] - bottom.elbow[1]).toBeGreaterThanOrEqual(2);
    expect(half.elbow[1] - bottom.elbow[1]).toBeGreaterThan(half.wrist[1] - bottom.wrist[1]);
  });

  test('"elbow to wrist angle ... greater than 100 degrees", with "a gradual transition"', () => {
    const angles = ticksOf(entry).map((t) => {
      const { shoulder, elbow, wrist } = figureAt(entry, barbell, t).model.near.world;
      return angleAt(elbow, shoulder, wrist);
    });
    for (const angle of angles) expect(angle).toBeGreaterThan(100);
    // Gradual: the change is spread over the rep. No single 33 ms tick carries
    // more than 8 percent of the whole change in elbow angle.
    const whole = Math.max(...angles) - Math.min(...angles);
    expect(whole).toBeGreaterThan(30);
    for (let i = 1; i < angles.length; i++) {
      expect(Math.abs(angles[i] - angles[i - 1])).toBeLessThanOrEqual(0.08 * whole);
    }
  });

  test('the stored keyframe joints are the drawn projection', () => {
    for (const frame of entry.frames) {
      const f = resolveFigureJoints(frame.joints, { ...entry, body: BODY });
      for (const key of ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'an', 'kf', 'af']) {
        expect(distance(frame.joints[key], f[key])).toBeLessThan(0.01);
      }
    }
  });
});

describe('Dumbbell Incline Shoulder Raise (187)', () => {
  test('"straighten the arms a bit more towards the end range ... elbow to wrist joints almost parallel with the floor"', () => {
    // "the start position looks good": the start is the first draft's, unchanged.
    const start = figureAt(entry187, false, 0).model.near.world;
    expect(angleAt(start.elbow, start.shoulder, start.wrist)).toBeCloseTo(105, 9);
    // The arm only ever straightens on the way up, and only ever bends on the way down.
    const up = [];
    for (let t = 0; t <= topTime(entry187); t += 33) {
      const { shoulder, elbow, wrist } = figureAt(entry187, false, t).model.near.world;
      up.push(angleAt(elbow, shoulder, wrist));
    }
    for (let i = 1; i < up.length; i++) expect(up[i]).toBeGreaterThanOrEqual(up[i - 1] - 1e-9);
    // At the top the forearm is within 10 degrees of level, and the arm is nearly straight.
    const top = figureAt(entry187, false, topTime(entry187)).model.near.world;
    const forearm = top.wrist.map((v, i) => v - top.elbow[i]);
    const belowLevel = deg(Math.atan2(-forearm[1], Math.hypot(forearm[0], forearm[2])));
    expect(belowLevel).toBeGreaterThanOrEqual(0); // the hand is not above the elbow
    expect(belowLevel).toBeLessThanOrEqual(10);
    expect(angleAt(top.elbow, top.shoulder, top.wrist)).toBeGreaterThanOrEqual(165);
    // It is a raise out to the sides, not an upright row: the hand finishes
    // far outside the elbow, not hanging under it.
    expect(top.wrist[2] - top.elbow[2]).toBeGreaterThanOrEqual(10);
  });

  test('the bells start together under the chest', () => {
    const bottom = figureAt(entry187, false, 0).model;
    expect(bottom.near.world.wrist[2]).toBeLessThan(bottom.near.world.shoulder[2]); // hands inside the shoulders
    expect(bottom.near.world.wrist[2]).toBeGreaterThan(0); // and not crossed over the midline
    expect(bottom.near.world.wrist[1]).toBeLessThan(bottom.near.world.shoulder[1] - 15); // hanging well below
  });

  test('draws a dumbbell in each hand and no bar', () => {
    for (const t of ticksOf(entry187)) {
      const { joints, prims } = figureAt(entry187, false, t);
      const handles = prims.filter((p) => p.kind === 'bone' && p.w === 1.8);
      const heads = prims.filter((p) => p.kind === 'bone' && p.w === 2.6);
      expect(handles).toHaveLength(2);
      expect(heads).toHaveLength(4);
      for (const hand of [joints.wr, joints.wf]) {
        expect(handles.some((h) => Math.abs((h.x1 + h.x2) / 2 - hand[0]) < 1e-9 && Math.abs(h.y1 - hand[1]) < 1e-9)).toBe(true);
      }
      expect(prims.filter((p) => p.kind === 'bone' && p.w === 1.6 && p.color === 'textHi')).toHaveLength(0);
    }
  });
});

describe('Barbell Incline Shoulder Raise (135)', () => {
  test('both hands stay on one level bar at one grip width while it rises', () => {
    const heights = [];
    for (const t of ticksOf(entry135)) {
      const { model } = figureAt(entry135, true, t);
      expect(model.near.world.wrist[1]).toBeCloseTo(model.far.world.wrist[1], 12); // level
      expect(model.near.world.wrist[2]).toBeCloseTo(PRONE_INCLINE_RAISE.barbellGripHalfWidth, 12); // fixed grip
      expect(model.near.world.wrist[0]).toBeCloseTo(model.near.world.shoulder[0], 12); // straight up under the shoulders
      heights.push(model.near.world.wrist[1]);
    }
    const top = figureAt(entry135, true, topTime(entry135)).model.near.world.wrist[1];
    expect(Math.max(...heights)).toBeCloseTo(top, 9);
    expect(top - heights[0]).toBeGreaterThan(4); // the bar visibly rises
    // The hands are well outside the shoulders, and "in by one wrist width"
    // from the first draft's 24: the drawn forearm is 3.5 wide.
    expect(PRONE_INCLINE_RAISE.barbellGripHalfWidth).toBeGreaterThan(BODY.sw * 0.92 * 2);
    expect(PRONE_INCLINE_RAISE.barbellGripHalfWidth).toBeCloseTo(24 - BODY.lw * 0.72, 1);
  });

  test('"it should be more like an upright row": elbows out and up, with the elbow angle a little over 100 degrees at the top', () => {
    const top = figureAt(entry135, true, topTime(entry135)).model.near.world;
    const atTop = angleAt(top.elbow, top.shoulder, top.wrist);
    expect(atTop).toBeGreaterThan(100);
    expect(atTop).toBeLessThanOrEqual(110);
    // The hand hangs under the elbow, as in a row, not out beyond it.
    expect(top.elbow[1] - top.wrist[1]).toBeGreaterThanOrEqual(8);
    expect(Math.abs(top.wrist[2] - top.elbow[2])).toBeLessThanOrEqual(3);
  });

  test('draws one bar through both hands and no dumbbells', () => {
    for (const t of ticksOf(entry135)) {
      const { joints, prims } = figureAt(entry135, true, t);
      const shafts = prims.filter((p) => p.kind === 'bone' && p.w === 1.6 && (p.color === 'textHi' || (p.color === 'textLow' && p.opacity === 0.9)));
      expect(shafts).toHaveLength(2); // near half and far half
      for (const shaft of shafts) expect(shaft.y1).toBeCloseTo(shaft.y2, 9);
      const [nearHalf] = shafts.filter((p) => p.color === 'textHi');
      const [farHalf] = shafts.filter((p) => p.color === 'textLow');
      // The halves meet, and each passes through its hand.
      expect([nearHalf.x1, nearHalf.y1]).toEqual([farHalf.x1, farHalf.y1]);
      expect(nearHalf.y1).toBeCloseTo(joints.wr[1], 9);
      expect(Math.min(nearHalf.x1, nearHalf.x2)).toBeLessThan(joints.wr[0]);
      expect(Math.max(farHalf.x1, farHalf.x2)).toBeGreaterThan(joints.wf[0]);
      expect(prims.filter((p) => p.kind === 'bone' && p.w === 1.8)).toHaveLength(0);
    }
  });
});

test('the two incline raises are different drawings, not one drawing with new captions', () => {
  const top135 = figureAt(entry135, true, topTime(entry135)).model.near.world;
  const top187 = figureAt(entry187, false, topTime(entry187)).model.near.world;
  expect(distance(top135.wrist, top187.wrist)).toBeGreaterThan(1);
  const bottom135 = figureAt(entry135, true, 0).model.near.world;
  const bottom187 = figureAt(entry187, false, 0).model.near.world;
  expect(distance(bottom135.wrist, bottom187.wrist)).toBeGreaterThan(15); // wide on the bar against together under the chest
  expect(entry135.frames.map((f) => f.caption)).not.toEqual(entry187.frames.map((f) => f.caption));
});
