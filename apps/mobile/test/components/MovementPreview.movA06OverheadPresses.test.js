/**
 * MOV-A06 — Standing overhead presses (4, 31, 41, 129, 189, 228, 230).
 *
 * Source-text-bound and physics-bound tests across every 33 ms tick of each
 * movement's cycle, written before authoring the drawings.
 */
import * as rig from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = rig.CANONICAL_BODY_PARAMETERS;
const FLOOR = 96.9;
const IDS = [4, 31, 41, 129, 189, 228, 230];

const entryFor = (id) => {
  const e = previewManifest.entries.find((x) => x.movementId === id);
  expect(e).toBeDefined();
  return e;
};

const slugOf = (e) => e.assetKey.split('/')[1];

const dist = (a, b) => Math.hypot(...a.slice(0, Math.min(a.length, b.length)).map((v, i) => v - b[i]));

const deg3D = (a, b, c) => {
  const ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2];
  const vx = c[0] - b[0], vy = c[1] - b[1], vz = c[2] - b[2];
  const n = Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz) || 1;
  return (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / n))) * 180) / Math.PI;
};

const offVertical3D = (from, to) => {
  const dy = to[1] - from[1];
  const len = dist(from, to) || 1;
  return (Math.acos(Math.max(-1, Math.min(1, dy / len))) * 180) / Math.PI;
};

const trunkDegFromHorizontal2D = (j) =>
  (Math.atan2(j.hp[1] - j.nk[1], Math.abs(j.nk[0] - j.hp[0])) * 180) / Math.PI;

const ticksOf = (e) => {
  const total = e.segmentDurationsMs.reduce((a, b) => a + b, 0);
  return [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];
};

const keyTimesOf = (e) =>
  e.segmentDurationsMs.reduce((times, d) => [...times, times.at(-1) + d], [0]);

describe('MOV-A06 standing overhead presses: universal physics, painted floor contact, mid-foot balance, upright trunk, and depth order', () => {
  test.each(IDS)('movement %i is authored as pending with >= 5 frames, planted painted floor contact, upright braced trunk, load over mid-foot, and back-to-front depth order at every 33 ms tick', (id) => {
    const e = entryFor(id);
    expect(e.status).toBe('pending');
    expect(e.frames.length).toBeGreaterThanOrEqual(5);
    const slug = slugOf(e);
    const start = rig.chainGeometry(slug, e.frames[0].joints.ph, BODY);
    const midFootX = (start.world.near.ankle[0] + start.world.near.toe[0]) / 2;
    const poses = e.frames.map((f) => f.joints);
    const ds = e.segmentDurationsMs;

    for (const t of ticksOf(e)) {
      const p = rig.poseAtTime(poses, t, ds);
      const g = rig.chainGeometry(slug, p.ph, BODY);
      const prims = rig.layoutCanonicalFigure(p, { view: e.view, assetKey: e.assetKey, body: BODY });
      expect(prims.length).toBeGreaterThan(20);

      // Upright braced trunk: no lean-back arch and no spinal curl at any tick
      expect(trunkDegFromHorizontal2D(g.joints)).toBeGreaterThanOrEqual(87);
      expect(Math.abs(g.world.neck[0] - g.world.hip[0])).toBeLessThanOrEqual(0.5);
      expect(g.curled).toBe(false);

      // Planted feet: zero ankle or toe drift, and painted underside of both feet sits on FLOOR (96.9)
      expect(dist(g.world.near.ankle, start.world.near.ankle)).toBeLessThan(0.01);
      expect(dist(g.world.far.ankle, start.world.far.ankle)).toBeLessThan(0.01);
      for (const [an, toe] of [[g.joints.an, g.toe.near], [g.joints.af, g.toe.far]]) {
        const footBone = prims.find(
          (pr) => pr.kind === 'bone' && pr.x1 === an[0] && pr.y1 === an[1] && pr.x2 === toe[0] && pr.y2 === toe[1],
        );
        expect(footBone).toBeDefined();
        const paintedSoleY = Math.max(footBone.y1, footBone.y2) + footBone.w / 2;
        expect(paintedSoleY).toBeCloseTo(FLOOR, 5);
      }

      // Bar or bells stay over the foot base at every 33 ms tick, and elbows stay below wrists
      expect(Math.abs(g.world.near.hold[0] - midFootX)).toBeLessThanOrEqual(2.0);
      expect(g.world.near.hold[0]).toBeGreaterThanOrEqual(g.world.near.ankle[0]);
      expect(g.world.near.hold[0]).toBeLessThanOrEqual(g.world.near.toe[0]);
      expect(g.world.near.elbow[1]).toBeLessThanOrEqual(g.world.near.wrist[1] - 6);
      expect(g.joints.el[1]).toBeGreaterThanOrEqual(g.joints.wr[1] + 6);
      if ([4, 31, 129, 230].includes(id)) {
        expect(Math.abs(g.world.far.hold[0] - midFootX)).toBeLessThanOrEqual(2.0);
        expect(g.world.far.hold[0]).toBeGreaterThanOrEqual(g.world.far.ankle[0]);
        expect(g.world.far.hold[0]).toBeLessThanOrEqual(g.world.far.toe[0]);
        expect(g.world.far.elbow[1]).toBeLessThanOrEqual(g.world.far.wrist[1] - 6);
        expect(g.joints.ef[1]).toBeGreaterThanOrEqual(g.joints.wf[1] + 6);
      }

      // Depth order: far leg before torso, far arm before head, head before near arm
      const farThighIdx = prims.findIndex(
        (pr) => pr.kind === 'bone' && pr.x1 === g.joints.fLeg[0] && pr.y1 === g.joints.fLeg[1] && Math.abs(pr.w - BODY.lw * 1.18) < 1e-6,
      );
      const farUpperArmIdx = prims.findIndex(
        (pr) => pr.kind === 'bone' && pr.x1 === g.joints.fArm[0] && pr.y1 === g.joints.fArm[1] && Math.abs(pr.w - BODY.lw * 0.88) < 1e-6,
      );
      const headIdx = prims.findIndex((pr) => pr.kind === 'circle' && pr.stroke === 'textHi' && pr.r >= 5.5);
      const nearUpperArmIdx = prims.findIndex(
        (pr) => pr.kind === 'bone' && pr.x1 === g.joints.nArm[0] && pr.y1 === g.joints.nArm[1] && Math.abs(pr.w - BODY.lw * 0.88) < 1e-6,
      );
      expect(farThighIdx).toBeGreaterThanOrEqual(0);
      expect(farUpperArmIdx).toBeGreaterThan(farThighIdx);
      expect(headIdx).toBeGreaterThan(farUpperArmIdx);
      expect(nearUpperArmIdx).toBeGreaterThan(headIdx);
    }
  });

  test('4 Overhead Press sets the bar across the front shoulders with a full grip and near-vertical forearms, presses close past the face, and moves the head through to a tall stacked lockout', () => {
    // Quotes:
    // "Set the bar across the front shoulders with a full grip and the forearms close to vertical. Stand with balanced feet and brace before the bar leaves the shoulders."
    // "Press close past the face, move the head through to a tall lockout, and lower along the same path. If the torso leans into an incline press, reduce the load until the finish stays stacked."
    const e = entryFor(4);
    const slug = slugOf(e);
    const start = rig.chainGeometry(slug, 0, BODY);
    const top = rig.chainGeometry(slug, 1, BODY);
    const midFootX = (start.world.near.ankle[0] + start.world.near.toe[0]) / 2;

    expect(start.movement.implement).toBe('bar');
    // Full grip on the bar (not a clean-grip fingertip closeUp)
    expect(start.angles.hand).toBeUndefined();
    expect(rig.handCloseUp(start)).toBeNull();

    // Bar starts across the front shoulders with forearms close to vertical (<= 10 deg off vertical)
    expect(start.world.near.hold[0]).toBeGreaterThan(start.world.neck[0] + 0.5);
    expect(start.world.near.hold[0]).toBeLessThanOrEqual(start.world.neck[0] + 2.0);
    expect(Math.abs(start.world.near.hold[1] - start.world.neck[1])).toBeLessThanOrEqual(1.5);
    expect(offVertical3D(start.world.near.elbow, start.world.near.wrist)).toBeLessThanOrEqual(10);
    expect(offVertical3D(start.world.far.elbow, start.world.far.wrist)).toBeLessThanOrEqual(10);

    // Head starts slightly back so the bar presses close past the face, then moves through to a stacked lockout
    expect(start.world.head[0]).toBeLessThan(start.world.neck[0] - 0.8);
    expect(Math.abs(top.world.head[0] - top.world.neck[0])).toBeLessThan(0.1);
    expect(top.world.head[0]).toBeGreaterThan(start.world.head[0] + 0.8);

    // Tall, stacked lockout overhead with straight elbows and zero torso lean
    expect(deg3D(top.world.near.shoulder, top.world.near.elbow, top.world.near.wrist)).toBeGreaterThanOrEqual(176);
    expect(deg3D(top.world.far.shoulder, top.world.far.elbow, top.world.far.wrist)).toBeGreaterThanOrEqual(176);
    expect(top.world.near.hold[1]).toBeGreaterThan(top.world.head[1] + BODY.hr + 8);
    expect(Math.abs(top.world.near.hold[0] - midFootX)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(top.world.neck[0] - top.world.hip[0])).toBeLessThan(0.05);
  });

  test('31 Arnold Press starts with dumbbells at shoulder height, elbows tight in front, and palms facing the athlete, then rotates the palms 180 degrees to face forward at lockout', () => {
    // Quotes:
    // "Sit or stand holding dumbbells at shoulder height with palms facing you. Press up while rotating your palms to face forward at the top. Reverse the rotation on the way back down to the start."
    // "Stay tall and braced the whole press — the lean-back arch is the classic cheat, and it quietly turns this into a sloppy incline press."
    // "Chest open, lats in the back pocket. Elbows tight, core tension. Rotate smooth all the way to lockout."
    const e = entryFor(31);
    const slug = slugOf(e);
    const start = rig.chainGeometry(slug, 0, BODY);
    const mid = rig.chainGeometry(slug, 0.5, BODY);
    const top = rig.chainGeometry(slug, 1, BODY);

    expect(start.movement.implement).toBe('bells');
    // At start: dumbbells at shoulder height, elbows tucked tight in front of the shoulders, palms facing the athlete (palmYaw = 180, palmDir = [-1, 0, 0])
    expect(Math.abs(start.world.near.hold[1] - start.world.near.shoulder[1])).toBeLessThanOrEqual(2.0);
    expect(start.world.near.elbow[0]).toBeGreaterThan(start.world.near.shoulder[0] + 5.0);
    expect(start.world.far.elbow[0]).toBeGreaterThan(start.world.far.shoulder[0] + 5.0);
    expect(start.angles.palmYaw).toBe(180);
    expect(start.angles.farPalmYaw).toBe(180);
    expect(start.world.near.palmDir[0]).toBeCloseTo(-1, 5);
    expect(start.world.far.palmDir[0]).toBeCloseTo(-1, 5);

    // Mid-press (ph = 0.5): palms pass through 90 degrees (facing in) so the dumbbell handles turn fore-aft along X
    expect(mid.angles.palmYaw).toBeCloseTo(90, 5);
    expect(mid.world.near.handleAxis[0]).toBeCloseTo(1, 5);
    expect(mid.world.near.elbow[2]).toBeGreaterThan(start.world.near.elbow[2] + 2.0);

    // At top lockout (ph = 1): palms have rotated 180 degrees to face forward (palmYaw = 0, palmDir = [1, 0, 0]) with straight arms
    expect(top.angles.palmYaw).toBe(0);
    expect(top.angles.farPalmYaw).toBe(0);
    expect(top.world.near.palmDir[0]).toBeCloseTo(1, 5);
    expect(top.world.far.palmDir[0]).toBeCloseTo(1, 5);
    expect(deg3D(top.world.near.shoulder, top.world.near.elbow, top.world.near.wrist)).toBeGreaterThanOrEqual(176);
    expect(top.world.near.hold[1]).toBeGreaterThan(top.world.head[1] + BODY.hr + 8);

    // Painted knuckle wrap order flips between palms-facing-you (ph = 0) and palms-facing-forward (ph = 1)
    const startPrims = rig.layoutCanonicalFigure({ ...e.frames[0].joints, ph: 0 }, { ...e, body: BODY });
    const topPrims = rig.layoutCanonicalFigure({ ...e.frames[1].joints, ph: 1 }, { ...e, body: BODY });
    const shaftIdx = (prims) => prims.findIndex((pr) => pr.kind === 'bone' && pr.color === 'textHi' && Math.abs(pr.w - 1.8) < 1e-6);
    const knuckleIdx = (prims) => prims.findIndex((pr) => pr.kind === 'bone' && pr.color === 'textHi' && Math.abs(pr.w - 2.2) < 1e-6 && pr.stroke === 'ink1');
    expect(knuckleIdx(startPrims)).toBeGreaterThan(shaftIdx(startPrims));
    expect(shaftIdx(topPrims)).toBeGreaterThan(knuckleIdx(topPrims));
  });

  test('41 Cable Shoulder Press presses one handle from shoulder height to overhead lockout against a low pulley that drags forward and down throughout, with the free hand quiet', () => {
    // Quotes:
    // "Set a low pulley and bring the handle to shoulder height, standing tall. Press to lockout overhead against the cable's pull, which drags forward and down the entire rep — that constant tension is the point, there is no rest at the top."
    // "Lower under control back to the shoulder. Usually run one arm at a time; the free hand tells you when you are leaning."
    const e = entryFor(41);
    const slug = slugOf(e);
    const start = rig.chainGeometry(slug, 0, BODY);
    const top = rig.chainGeometry(slug, 1, BODY);

    expect(start.movement.implement).toBe('handle');
    const pulleyShape = (start.movement.equipment ?? []).find((sh) => sh.kind === 'pulley');
    expect(pulleyShape).toBeDefined();
    const pulley = pulleyShape.at;
    expect(pulley[1]).toBeLessThanOrEqual(12);

    // Starts at shoulder height and presses to straight-arm lockout overhead
    expect(Math.abs(start.world.near.hold[1] - start.world.near.shoulder[1])).toBeLessThanOrEqual(2.0);
    expect(deg3D(top.world.near.shoulder, top.world.near.elbow, top.world.near.wrist)).toBeGreaterThanOrEqual(176);
    expect(top.world.near.hold[1]).toBeGreaterThan(top.world.head[1] + BODY.hr + 8);

    // Cable drags forward (pulley X > hand X) and down (pulley Y < hand Y) at every 33 ms tick, and only lengthens on the press
    const poses = e.frames.map((f) => f.joints);
    const ds = e.segmentDurationsMs;
    const pressEnd = ds[0];
    let prevLen = 0;
    for (const t of ticksOf(e)) {
      const p = rig.poseAtTime(poses, t, ds);
      const g = rig.chainGeometry(slug, p.ph, BODY);
      expect(pulley[0] - g.world.near.hold[0]).toBeGreaterThan(10);
      expect(pulley[1] - g.world.near.hold[1]).toBeLessThan(-55);
      // Free far hand stays completely still at the side
      expect(dist(g.world.far.wrist, start.world.far.wrist)).toBeLessThan(1e-6);
      const len = dist(pulley, g.world.near.hold);
      if (t <= pressEnd) {
        expect(len).toBeGreaterThanOrEqual(prevLen - 1e-6);
        prevLen = len;
      }
    }
    expect(dist(pulley, top.world.near.hold) - dist(pulley, start.world.near.hold)).toBeGreaterThan(20);
  });

  test('129 Alternating Kettlebell Press vs 230 Kettlebell Seesaw Press: 129 keeps one bell waiting at the shoulder while turning the pressing palm from in to forward, whereas 230 moves one bell up as the other comes down', () => {
    // 129 Quotes:
    // "Clean two kettlebells to the shoulders and stand tall with the palms facing in. Press one kettlebell straight overhead until the arm is straight, turning the palm to face forward as it rises, while the other stays at the shoulder. Lower it under control back to the shoulder, then press the other side."
    // "Stand tall and squeeze the glutes. One bell moves, the other waits at the shoulder. Finish with the arm straight beside the ear."
    // 230 Quotes:
    // "Clean two kettlebells to the shoulders and stand tall. Press one kettlebell overhead until the arm is straight. As you lower it to the shoulder, press the other kettlebell up, and keep alternating for the same number of repetitions on each side."
    // "Stand tall and squeeze the glutes. One up as one comes down. Finish each press with a straight arm."
    const e129 = entryFor(129);
    const s129 = slugOf(e129);
    const times129 = keyTimesOf(e129);
    const rack129 = rig.chainGeometry(s129, 1, BODY);
    const nearTop129 = rig.chainGeometry(s129, 0, BODY);
    const farTop129 = rig.chainGeometry(s129, 2, BODY);

    expect(rack129.movement.implement).toBe('kettlebells');
    // At the rack (ph = 1): both kettlebells at the shoulders with palms facing in (palmYaw = 90)
    expect(Math.abs(rack129.world.near.hold[1] - rack129.world.near.shoulder[1])).toBeLessThanOrEqual(2.0);
    expect(Math.abs(rack129.world.far.hold[1] - rack129.world.far.shoulder[1])).toBeLessThanOrEqual(2.0);
    expect(rack129.angles.palmYaw).toBe(90);
    expect(rack129.angles.farPalmYaw).toBe(90);
    expect(rack129.world.near.palmDir[2]).toBeCloseTo(-1, 5);
    expect(rack129.world.far.palmDir[2]).toBeCloseTo(1, 5);

    // Near press top (ph = 0): near arm is straight overhead with palm forward (palmYaw = 0), while far bell waits at shoulder with palm in (farPalmYaw = 90)
    expect(deg3D(nearTop129.world.near.shoulder, nearTop129.world.near.elbow, nearTop129.world.near.wrist)).toBeGreaterThanOrEqual(176);
    expect(nearTop129.angles.palmYaw).toBe(0);
    expect(nearTop129.world.near.palmDir[0]).toBeCloseTo(1, 5);
    expect(dist(nearTop129.world.far.hold, rack129.world.far.hold)).toBeLessThan(1e-6);
    expect(nearTop129.angles.farPalmYaw).toBe(90);

    // Far press top (ph = 2): far arm is straight overhead with palm forward (farPalmYaw = 0), while near bell waits at shoulder with palm in (palmYaw = 90)
    expect(deg3D(farTop129.world.far.shoulder, farTop129.world.far.elbow, farTop129.world.far.wrist)).toBeGreaterThanOrEqual(176);
    expect(farTop129.angles.farPalmYaw).toBe(0);
    expect(farTop129.world.far.palmDir[0]).toBeCloseTo(1, 5);
    expect(dist(farTop129.world.near.hold, rack129.world.near.hold)).toBeLessThan(1e-6);
    expect(farTop129.angles.palmYaw).toBe(90);

    // Across every 33 ms tick of 129, one bell ALWAYS waits stationary at the shoulder while the other works
    const poses129 = e129.frames.map((f) => f.joints);
    for (const t of ticksOf(e129)) {
      const p = rig.poseAtTime(poses129, t, e129.segmentDurationsMs);
      const g = rig.chainGeometry(s129, p.ph, BODY);
      if (t <= times129[3]) {
        expect(dist(g.world.far.hold, rack129.world.far.hold)).toBeLessThan(1e-6);
      }
      if (t >= times129[3]) {
        expect(dist(g.world.near.hold, rack129.world.near.hold)).toBeLessThan(1e-6);
      }
    }

    // 230 Kettlebell Seesaw Press: simultaneous opposing motion between ph = 1 and ph = 2
    const e230 = entryFor(230);
    const s230 = slugOf(e230);
    const times230 = keyTimesOf(e230);
    const rack230 = rig.chainGeometry(s230, 0, BODY);
    const nearTop230 = rig.chainGeometry(s230, 1, BODY);
    const cross230 = rig.chainGeometry(s230, 1.5, BODY);
    const farTop230 = rig.chainGeometry(s230, 2, BODY);

    expect(rack230.movement.implement).toBe('kettlebells');
    expect(deg3D(nearTop230.world.near.shoulder, nearTop230.world.near.elbow, nearTop230.world.near.wrist)).toBeGreaterThanOrEqual(176);
    expect(deg3D(farTop230.world.far.shoulder, farTop230.world.far.elbow, farTop230.world.far.wrist)).toBeGreaterThanOrEqual(176);

    // At the midpoint of the seesaw (ph = 1.5), BOTH bells are in mid-air at the exact same height, passing each other
    expect(cross230.world.near.hold[1]).toBeGreaterThan(rack230.world.near.shoulder[1] + 10);
    expect(cross230.world.far.hold[1]).toBeGreaterThan(rack230.world.far.shoulder[1] + 10);
    expect(Math.abs(cross230.world.near.hold[1] - cross230.world.far.hold[1])).toBeLessThan(0.05);

    // During segment 1 (times230[1]..times230[2], ph: 1 -> 2), nearY strictly falls while farY strictly rises at the same time
    const poses230 = e230.frames.map((f) => f.joints);
    const seesawTicks = ticksOf(e230).filter((t) => t >= times230[1] && t <= times230[2]);
    for (let i = 1; i < seesawTicks.length; i++) {
      const prev = rig.chainGeometry(s230, rig.poseAtTime(poses230, seesawTicks[i - 1], e230.segmentDurationsMs).ph, BODY);
      const curr = rig.chainGeometry(s230, rig.poseAtTime(poses230, seesawTicks[i], e230.segmentDurationsMs).ph, BODY);
      expect(curr.world.near.hold[1]).toBeLessThanOrEqual(prev.world.near.hold[1] + 1e-6);
      expect(curr.world.far.hold[1]).toBeGreaterThanOrEqual(prev.world.far.hold[1] - 1e-6);
    }
  });

  test('189 Dumbbell One-Arm Shoulder Press and 228 Kettlebell Arnold Press show their distinct implement, wrist rotation (palm-forward throughout vs palm-in to palm-forward), top pause, and slow lowering', () => {
    // 189 Quotes:
    // "Sit on a bench with back support or stand tall, and bring one dumbbell to shoulder height with the palm facing forward and the other hand at your side or on a fixed support. Press the dumbbell straight up until the arm is straight. Pause, then lower it slowly to shoulder height."
    // "Ribs down, trunk tall. Press straight up. Lower slowly to the shoulder."
    // 228 Quotes:
    // "Clean a kettlebell to the shoulder and stand tall with the palm facing in. Press the kettlebell up and overhead, turning the wrist so the palm faces forward at the top. Lower it to the shoulder, turning the palm back to face in."
    // "Stand tall, eyes forward. Turn the palm as you press. Finish with the arm straight."
    const e189 = entryFor(189);
    const s189 = slugOf(e189);
    const start189 = rig.chainGeometry(s189, 0, BODY);
    const top189 = rig.chainGeometry(s189, 1, BODY);

    expect(start189.movement.implement).toBe('bell');
    // 189 keeps the palm facing forward (palmYaw = 0) from shoulder height all the way to lockout
    expect(start189.angles.palmYaw).toBe(0);
    expect(top189.angles.palmYaw).toBe(0);
    expect(start189.world.near.palmDir[0]).toBeCloseTo(1, 5);
    expect(top189.world.near.palmDir[0]).toBeCloseTo(1, 5);
    expect(Math.abs(start189.world.near.hold[1] - start189.world.near.shoulder[1])).toBeLessThanOrEqual(2.0);
    expect(deg3D(top189.world.near.shoulder, top189.world.near.elbow, top189.world.near.wrist)).toBeGreaterThanOrEqual(176);
    expect(Math.abs(top189.world.near.hold[0] - start189.world.near.hold[0])).toBeLessThanOrEqual(0.5);
    // Pause at the top and lower slowly
    expect(e189.segmentDurationsMs[1]).toBeGreaterThanOrEqual(550);
    expect(e189.segmentDurationsMs[2]).toBeGreaterThanOrEqual(e189.segmentDurationsMs[0] * 1.45);

    // 228 Kettlebell Arnold Press: single kettlebell, palm facing in (90 deg) at the shoulder, rotating to palm forward (0 deg) at lockout
    const e228 = entryFor(228);
    const s228 = slugOf(e228);
    const start228 = rig.chainGeometry(s228, 0, BODY);
    const top228 = rig.chainGeometry(s228, 1, BODY);

    expect(start228.movement.implement).toBe('kettlebell');
    expect(Math.abs(start228.world.near.hold[1] - start228.world.near.shoulder[1])).toBeLessThanOrEqual(2.0);
    expect(start228.angles.palmYaw).toBe(90);
    expect(start228.world.near.palmDir[2]).toBeCloseTo(-1, 5);
    expect(start228.world.near.handleAxis[0]).toBeCloseTo(1, 5);

    expect(deg3D(top228.world.near.shoulder, top228.world.near.elbow, top228.world.near.wrist)).toBeGreaterThanOrEqual(176);
    expect(top228.angles.palmYaw).toBe(0);
    expect(top228.world.near.palmDir[0]).toBeCloseTo(1, 5);
    expect(top228.world.near.handleAxis[2]).toBeCloseTo(1, 5);

    // Both 189 and 228 keep the free far hand quiet at the side across every tick
    for (const [e, slug, start] of [[e189, s189, start189], [e228, s228, start228]]) {
      const poses = e.frames.map((f) => f.joints);
      for (const t of ticksOf(e)) {
        const p = rig.poseAtTime(poses, t, e.segmentDurationsMs);
        const g = rig.chainGeometry(slug, p.ph, BODY);
        expect(dist(g.world.far.wrist, start.world.far.wrist)).toBeLessThan(1e-6);
      }
    }
  });
});
