/**
 * MOV-A05 — Horizontal, incline, decline, floor, board, pin, and cable presses
 * (3, 43, 45, 102, 65, 151, 252, 203, 249, 83).
 *
 * Source-text-bound and physics-bound tests across every 33 ms tick of each
 * movement's cycle, written before authoring the drawings.
 */
import * as rig from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = rig.CANONICAL_BODY_PARAMETERS;
const SHOULDER_HALF = BODY.sw * 0.92; // 9.384
const IDS = [3, 43, 45, 102, 65, 151, 252, 203, 249, 83];

const entryFor = (id) => {
  const e = previewManifest.entries.find((x) => x.movementId === id);
  expect(e).toBeDefined();
  return e;
};

const slugOf = (e) => e.assetKey.split('/')[1];

const deg3D = (a, b, c) => {
  const ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2];
  const vx = c[0] - b[0], vy = c[1] - b[1], vz = c[2] - b[2];
  const n = Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz) || 1;
  return (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / n))) * 180) / Math.PI;
};

const forearmDegFromVertical3D = (elbow, wrist) => {
  const dx = wrist[0] - elbow[0];
  const dy = wrist[1] - elbow[1];
  const dz = wrist[2] - elbow[2];
  return (Math.atan2(Math.hypot(dx, dz), dy) * 180) / Math.PI;
};

const torsoSlicesOf = (prims) =>
  prims.filter((p) => p.kind === 'bone' && p.color === 'textLow' && p.opacity === 1 && p.w < 2.0);

describe('MOV-A05 horizontal, incline, decline, floor, board, pin, and cable presses: physics, joint angles, contacts, and family distinctions', () => {
  test.each(IDS)('movement %i is authored as pending with at least 5 frames and renders across every 33 ms tick', (id) => {
    const e = entryFor(id);
    expect(e.status).toBe('pending');
    expect(e.frames.length).toBeGreaterThanOrEqual(5);
    const ds = e.segmentDurationsMs;
    const total = ds.reduce((a, b) => a + b, 0);
    const poses = e.frames.map((f) => f.joints);
    for (let t = 0; t <= total; t += 33) {
      const p = rig.poseAtTime(poses, t, ds);
      const prims = rig.layoutCanonicalFigure(p, { view: e.view, assetKey: e.assetKey, body: BODY });
      expect(prims.length).toBeGreaterThan(20);
    }
  });

  test('3 Competition Bench and 43 Close-Grip Bench Press plant feet, pin upper back and hips to the bench, stack forearms vertically at the lower-chest touch, and separate competition grip + pause from shoulder-width close grip + tucked elbows', () => {
    // Quotes:
    // 3: "Plant the feet and pin the upper back to the bench before taking a secure competition-width grip. Unrack to straight arms, settle the bar, then lower to the same chest touch point with stacked forearms. Hold the competition pause before pressing back to lockout."
    // 43: "Lie on a bench and grip the bar at about shoulder width, not narrower. Unrack and lower the bar to your lower chest, elbows staying close to your sides. Press back up to straight arms."
    const e3 = entryFor(3);
    const e43 = entryFor(43);
    const s3 = slugOf(e3);
    const s43 = slugOf(e43);

    const top3 = rig.chainGeometry(s3, 0, BODY);
    const bot3 = rig.chainGeometry(s3, 1, BODY);
    const top43 = rig.chainGeometry(s43, 0, BODY);
    const bot43 = rig.chainGeometry(s43, 1, BODY);

    // Both plant feet on the floor (ankle Y == CHAIN_ANKLE_HEIGHT = 1.575) and keep upper back and hips on the flat bench (screen Y = 78.9)
    for (const [e, gTop, gBot] of [[e3, top3, bot3], [e43, top43, bot43]]) {
      expect(Math.abs(gTop.world.near.ankle[1] - rig.CHAIN_ANKLE_HEIGHT)).toBeLessThan(0.05);
      expect(Math.abs(gBot.world.near.ankle[1] - rig.CHAIN_ANKLE_HEIGHT)).toBeLessThan(0.05);
      expect(Math.hypot(gBot.world.near.ankle[0] - gTop.world.near.ankle[0], gBot.world.near.ankle[1] - gTop.world.near.ankle[1])).toBeLessThan(0.01);

      // Straight arms at lockout (>= 172 deg) and stacked vertical forearms at the chest touch (<= 1.0 deg from vertical)
      const lockoutElbowDeg = deg3D(gTop.world.near.shoulder, gTop.world.near.elbow, gTop.world.near.hold);
      expect(lockoutElbowDeg).toBeGreaterThanOrEqual(172);
      const bottomForearmDeg = forearmDegFromVertical3D(gBot.world.near.elbow, gBot.world.near.hold);
      expect(bottomForearmDeg).toBeLessThanOrEqual(1.0);

      // Painted upper back (slice 0) and hip/glute (slice 32) rest on the bench slab top (78.9)
      const primsBot = rig.layoutCanonicalFigure({ ...e.frames[1].joints, ph: 1 }, { view: e.view, assetKey: e.assetKey, body: BODY });
      const slices = torsoSlicesOf(primsBot);
      expect(slices.length).toBe(33);
      const t0BotY = Math.max(slices[0].y1, slices[0].y2) + slices[0].w / 2;
      const t32BotY = Math.max(slices[32].y1, slices[32].y2) + slices[32].w / 2;
      expect(Math.abs(t0BotY - 78.9)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(t32BotY - 78.9)).toBeLessThanOrEqual(0.05);
    }

    // Competition Bench uses a competition-width grip (z >= 13.5, well outside shoulderHalf = 9.384) and holds a competition pause at the chest (>= 800 ms),
    // while Close-Grip Bench Press grips at about shoulder width (within 0.5 of shoulderHalf = 9.384) with elbows staying close to the sides
    expect(bot3.world.near.hold[2]).toBeGreaterThanOrEqual(13.5);
    expect(Math.abs(bot43.world.near.hold[2] - SHOULDER_HALF)).toBeLessThanOrEqual(0.5);
    expect(bot3.world.near.hold[2] - bot43.world.near.hold[2]).toBeGreaterThanOrEqual(4.5);
    expect(bot43.world.near.elbow[2] - SHOULDER_HALF).toBeLessThanOrEqual(0.5);
    expect(bot3.world.near.elbow[2] - SHOULDER_HALF).toBeGreaterThanOrEqual(4.5);
    expect(e3.segmentDurationsMs[1]).toBeGreaterThanOrEqual(800);
    expect(e3.segmentDurationsMs[1]).toBeGreaterThan(e43.segmentDurationsMs[1] + 250);
  });

  test('45 Decline Bench Press and 102 Decline Dumbbell Bench Press hook legs into a head-lower decline bench with zero painted torso-to-pad and leg-to-roller gap, vertical forearms at bottom, and distinct barbell vs inward-converging dumbbell paths', () => {
    // Quotes:
    // 45: "Hook your legs into the decline bench and take the bar just wider than shoulder width. Lower to the lower line of your chest — the decline shortens the stroke, so expect to touch sooner than on flat. Press back to lockout over your eyes." / "Decline barbell bench press works the lower sternal head of the pectoralis major along with the anterior deltoids and triceps. Have a spotter for the unrack and keep the legs hooked securely on the decline pad throughout the set."
    // 102: "Secure the legs in a decline bench, sit with the dumbbells on the thighs, then lie back and bring the bells to the chest before pressing them into position. Lower toward the lower chest with the forearms vertical and the shoulder blades pinned into the pad. Press up and slightly inward"
    const e3 = entryFor(3);
    const e45 = entryFor(45);
    const e102 = entryFor(102);
    const top3 = rig.chainGeometry(slugOf(e3), 0, BODY);
    const top45 = rig.chainGeometry(slugOf(e45), 0, BODY);
    const bot45 = rig.chainGeometry(slugOf(e45), 1, BODY);
    const top102 = rig.chainGeometry(slugOf(e102), 0, BODY);
    const bot102 = rig.chainGeometry(slugOf(e102), 1, BODY);

    const pointToSegDist2D = (px, py, x1, y1, x2, y2) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
      return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    };

    for (const [e, gTop, gBot] of [[e45, top45, bot45], [e102, top102, bot102]]) {
      // Head/shoulders lower than hips on the decline bench, knees elevated over leg rollers, feet hooked above the floor
      expect(gTop.world.neck[1]).toBeLessThan(gTop.world.hip[1] - 6);
      expect(gTop.world.near.knee[1]).toBeGreaterThan(gTop.world.hip[1] + 6);
      expect(gTop.world.near.ankle[1]).toBeGreaterThan(15);
      // Forearms vertical at the bottom of the stroke (<= 1.0 deg from vertical)
      expect(forearmDegFromVertical3D(gBot.world.near.elbow, gBot.world.near.hold)).toBeLessThanOrEqual(1.0);

      // Apparatus-bound check on movement.equipment rollers (knee roller + ankle roller)
      const equipRollers = (gTop.movement.equipment ?? []).filter((sh) => sh.kind === 'roller');
      expect(equipRollers.length).toBe(2);
      const [kneeRoller3D, ankleRoller3D] = equipRollers;
      expect(Math.hypot(gTop.world.near.knee[0] - kneeRoller3D.at[0], gTop.world.near.knee[1] - kneeRoller3D.at[1])).toBeLessThanOrEqual(4.5);
      expect(Math.hypot(gTop.world.near.ankle[0] - ankleRoller3D.at[0], gTop.world.near.ankle[1] - ankleRoller3D.at[1])).toBeLessThanOrEqual(5.5);

      // Painted contact between the hooked legs and the two painted rollers, plus painted torso-to-pad contact
      const prims = rig.layoutCanonicalFigure({ ...e.frames[1].joints, ph: 1 }, { view: e.view, assetKey: e.assetKey, body: BODY });
      const paintedRollers = prims.filter((p) => p.kind === 'circle' && p.r === 2.6 && p.fill === 'textMid');
      expect(paintedRollers.length).toBe(2);
      const [kneeRollerPrim, ankleRollerPrim] = paintedRollers;
      const nearThigh = prims.find((p) => p.kind === 'bone' && p.color === 'textHi' && Math.abs(p.w - BODY.lw * 1.18) < 1e-6);
      const nearShin = prims.find((p) => p.kind === 'bone' && p.color === 'textHi' && Math.abs(p.w - BODY.lw * 0.9) < 1e-6);
      const nearFoot = prims.find((p) => p.kind === 'bone' && p.color === 'textHi' && Math.abs(p.w - gTop.footWidth) < 1e-6);
      expect(nearThigh).toBeDefined();
      expect(nearShin).toBeDefined();
      expect(nearFoot).toBeDefined();
      const kneeDist = Math.min(
        pointToSegDist2D(kneeRollerPrim.cx, kneeRollerPrim.cy, nearThigh.x1, nearThigh.y1, nearThigh.x2, nearThigh.y2) - nearThigh.w / 2 - kneeRollerPrim.r,
        pointToSegDist2D(kneeRollerPrim.cx, kneeRollerPrim.cy, nearShin.x1, nearShin.y1, nearShin.x2, nearShin.y2) - nearShin.w / 2 - kneeRollerPrim.r,
      );
      const ankleDist = pointToSegDist2D(ankleRollerPrim.cx, ankleRollerPrim.cy, nearFoot.x1, nearFoot.y1, nearFoot.x2, nearFoot.y2) - nearFoot.w / 2 - ankleRollerPrim.r;
      expect(kneeDist).toBeLessThanOrEqual(0);
      expect(ankleDist).toBeLessThanOrEqual(0);

      // Painted decline pad slab touches the back surface of both upper back (slice 0) and hip/glute (slice 32)
      const declinePadPrim = prims.find((p) => p.kind === 'bone' && p.color === 'textMid' && Math.abs(p.w - 4) < 1e-6 && Math.hypot(p.x2 - p.x1, p.y2 - p.y1) > 25);
      expect(declinePadPrim).toBeDefined();
      const slices = torsoSlicesOf(prims);
      for (const s of [slices[0], slices[32]]) {
        const d1 = pointToSegDist2D(s.x1, s.y1, declinePadPrim.x1, declinePadPrim.y1, declinePadPrim.x2, declinePadPrim.y2);
        const d2 = pointToSegDist2D(s.x2, s.y2, declinePadPrim.x1, declinePadPrim.y1, declinePadPrim.x2, declinePadPrim.y2);
        const gap = Math.min(d1, d2) - s.w / 2 - declinePadPrim.w / 2;
        expect(Math.abs(gap)).toBeLessThanOrEqual(0.05);
      }
    }

    // Source-faithful first captions for 45 and 102
    expect(e45.frames[0].caption).toBe(
      'Hook your legs into the decline bench, take the bar just wider than shoulder width, and have a spotter for the unrack to lockout over your eyes.',
    );
    expect(e102.frames[0].caption).toBe(
      'Secure the legs in a decline bench, sit with the dumbbells on the thighs, then lie back and bring the bells to the chest before pressing them into position.',
    );

    // 45: Barbell grip just wider than shoulder width (11.0..12.5), shorter stroke than flat Competition Bench, lockout over the eyes
    expect(top45.movement.implement).toBe('bar');
    expect(bot45.world.near.hold[2]).toBeGreaterThanOrEqual(11.0);
    expect(bot45.world.near.hold[2]).toBeLessThanOrEqual(12.5);
    const stroke45 = top45.world.near.hold[1] - bot45.world.near.hold[1];
    const stroke3 = top3.world.near.hold[1] - rig.chainGeometry(slugOf(e3), 1, BODY).world.near.hold[1];
    expect(stroke45).toBeLessThan(stroke3 - 2.0);
    expect(Math.abs(top45.world.near.hold[0] - top45.world.head[0])).toBeLessThanOrEqual(2.5);

    // 102: Dumbbells press up and slightly inward (top hold.z < bottom hold.z)
    expect(top102.movement.implement).toBe('bells');
    expect(top102.world.near.hold[2]).toBeLessThan(bot102.world.near.hold[2] - 4.0);
  });

  test('65 Incline Dumbbell Press sets the bench between 30 and 45 degrees with zero painted backrest gap, lowers to a deep stretch outside the chest with ~45-deg elbows, and presses up and slightly back to finish over the face', () => {
    // Quotes:
    // "Set the bench between 30 and 45 degrees — lower hits more chest, higher bleeds into shoulders. Kick the dumbbells up off your knees one at a time and start from the top. Lower to a deep stretch just outside your chest with your elbows about 45 degrees from your sides, then press up and slightly back so the dumbbells finish over your face, not your belly."
    const e = entryFor(65);
    const slug = slugOf(e);
    const top = rig.chainGeometry(slug, 0, BODY);
    const bot = rig.chainGeometry(slug, 1, BODY);

    // Bench angle between 30 and 45 degrees measured from both the torso and the inclined slab in movement.equipment
    const dx = top.world.hip[0] - top.world.neck[0];
    const dy = top.world.neck[1] - top.world.hip[1];
    const inclineDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    expect(inclineDeg).toBeGreaterThanOrEqual(30);
    expect(inclineDeg).toBeLessThanOrEqual(45);

    const inclinedSlabs = (top.movement.equipment ?? []).filter(
      (sh) => sh.kind === 'slab' && Math.abs(sh.a[1] - sh.b[1]) > 1,
    );
    expect(inclinedSlabs.length).toBe(1);
    const backrestSlab = inclinedSlabs[0];
    const slabAngleDeg =
      (Math.atan2(
        Math.abs(backrestSlab.b[1] - backrestSlab.a[1]),
        Math.abs(backrestSlab.b[0] - backrestSlab.a[0]),
      ) *
        180) /
      Math.PI;
    expect(slabAngleDeg).toBeGreaterThanOrEqual(30);
    expect(slabAngleDeg).toBeLessThanOrEqual(45);

    // Painted backrest slab angle in [30, 45] and zero-gap contact with painted torso slices 0 and 32
    const primsBot = rig.layoutCanonicalFigure({ ...e.frames[1].joints, ph: 1 }, { view: e.view, assetKey: e.assetKey, body: BODY });
    const backrestPrim = primsBot.find((p) => p.kind === 'bone' && p.color === 'textMid' && Math.abs(p.w - 4) < 1e-6 && Math.abs(p.y1 - p.y2) > 5);
    expect(backrestPrim).toBeDefined();
    const projBackrestDeg = (Math.atan2(Math.abs(backrestPrim.y2 - backrestPrim.y1), Math.abs(backrestPrim.x2 - backrestPrim.x1)) * 180) / Math.PI;
    expect(projBackrestDeg).toBeGreaterThanOrEqual(30);
    expect(projBackrestDeg).toBeLessThanOrEqual(45);
    const slices65 = torsoSlicesOf(primsBot);
    const segDist = (px, py) => {
      const bdx = backrestPrim.x2 - backrestPrim.x1;
      const bdy = backrestPrim.y2 - backrestPrim.y1;
      const bl2 = bdx * bdx + bdy * bdy || 1;
      const t = Math.max(0, Math.min(1, ((px - backrestPrim.x1) * bdx + (py - backrestPrim.y1) * bdy) / bl2));
      return Math.hypot(px - (backrestPrim.x1 + t * bdx), py - (backrestPrim.y1 + t * bdy));
    };
    for (const s of [slices65[0], slices65[32]]) {
      const dist = Math.min(segDist(s.x1, s.y1), segDist(s.x2, s.y2));
      expect(Math.abs(dist - (s.w / 2 + backrestPrim.w / 2))).toBeLessThanOrEqual(0.05);
    }

    // First caption includes the source's "kick the dumbbells up off your knees one at a time"
    expect(e.frames[0].caption).toBe(
      'Set the bench between 30 and 45 degrees, kick the dumbbells up off your knees one at a time, and start from the top.',
    );

    // Feet planted on the floor
    expect(Math.abs(top.world.near.ankle[1] - rig.CHAIN_ANKLE_HEIGHT)).toBeLessThan(0.05);
    expect(Math.abs(bot.world.near.ankle[1] - rig.CHAIN_ANKLE_HEIGHT)).toBeLessThan(0.05);

    // Starts from the top (lockout) with dumbbells over the face, not the belly
    expect(top.movement.implement).toBe('bells');
    expect(deg3D(top.world.near.shoulder, top.world.near.elbow, top.world.near.hold)).toBeGreaterThanOrEqual(172);
    expect(Math.abs(top.world.near.hold[0] - top.world.head[0])).toBeLessThanOrEqual(2.5);
    expect(Math.abs(top.world.near.hold[0] - top.world.hip[0])).toBeGreaterThan(15);

    // Bottom stretch is outside the chest (hold.z > shoulder.z + 5) with vertical forearms and ~45 deg elbow tuck
    expect(bot.world.near.hold[2]).toBeGreaterThan(bot.world.near.shoulder[2] + 5.0);
    expect(forearmDegFromVertical3D(bot.world.near.elbow, bot.world.near.hold)).toBeLessThanOrEqual(1.0);
    const elbowTuckDeg = (Math.atan2(bot.world.near.elbow[2] - bot.world.near.shoulder[2], bot.world.near.elbow[0] - bot.world.near.shoulder[0]) * 180) / Math.PI;
    expect(elbowTuckDeg).toBeGreaterThanOrEqual(42);
    expect(elbowTuckDeg).toBeLessThanOrEqual(48);

    // Presses up and slightly back (toward the face) and slightly inward
    expect(top.world.near.hold[0]).toBeLessThan(bot.world.near.hold[0] - 8.0);
    expect(top.world.near.hold[2]).toBeLessThan(bot.world.near.hold[2] - 6.0);
  });

  test('151 Board Press and 252 Pin Presses show their distinct partial-stroke stops: chest-banded boards vs rack safety pins', () => {
    // Quotes:
    // 151: "Lie on the bench and band the boards securely to the chest; confirm they remain fixed before unracking... Set the feet, arch the back, and retract the shoulder blades, then take the bar out of the rack without protracting the shoulders. Lower the bar under control until it settles on the boards. Drive the bar up with force, keeping the elbows tucked until lockout."
    // 252: "Set a bench inside a rack with the pins at the chosen height and the bar resting on them, then lie back with the bar above your usual touch point, shoulder blades pulled together and feet set. From a full pause on the pins, drive the bar up to straight arms, keeping the bar, wrists and elbows in line. Lower the bar back to the pins and let it settle before the next repetition."
    const e151 = entryFor(151);
    const e252 = entryFor(252);
    const top151 = rig.chainGeometry(slugOf(e151), 0, BODY);
    const bot151 = rig.chainGeometry(slugOf(e151), 1, BODY);
    const bot252 = rig.chainGeometry(slugOf(e252), 0, BODY);
    const top252 = rig.chainGeometry(slugOf(e252), 1, BODY);

    // 151 Board Press: starts at lockout (ph = 0), arches the back while keeping upper back and glutes on the bench,
    // bands the boards to the chest, and settles the bar on top of the boards at ph = 1.
    expect(top151.movement.chestBoard).toBeDefined();
    expect(deg3D(top151.world.near.shoulder, top151.world.near.elbow, top151.world.near.hold)).toBeGreaterThanOrEqual(172);
    expect(forearmDegFromVertical3D(bot151.world.near.elbow, bot151.world.near.hold)).toBeLessThanOrEqual(1.0);
    const prims151Bot = rig.layoutCanonicalFigure({ ...e151.frames[1].joints, ph: 1 }, { view: e151.view, assetKey: e151.assetKey, body: BODY });
    const slices151 = torsoSlicesOf(prims151Bot);
    // Upper back and hips touch the bench top (78.9), while mid-torso arches clearly above the bench
    expect(Math.abs(Math.max(slices151[0].y1, slices151[0].y2) + slices151[0].w / 2 - 78.9)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(Math.max(slices151[32].y1, slices151[32].y2) + slices151[32].w / 2 - 78.9)).toBeLessThanOrEqual(0.05);
    expect(78.9 - (Math.max(slices151[16].y1, slices151[16].y2) + slices151[16].w / 2)).toBeGreaterThanOrEqual(0.7);
    // Board bone (w == chestBoard.height) sits flush on the chest and meets the barbell bottom edge at ph = 1
    const board = prims151Bot.find((p) => p.kind === 'bone' && p.color === 'textMid' && Math.abs(p.w - top151.movement.chestBoard.height) < 1e-6);
    expect(board).toBeDefined();
    const boardTopY = (board.y1 + board.y2) / 2 - board.w / 2;
    const barMidY151 = 96.9 - bot151.world.near.hold[1];
    const barBotY151 = barMidY151 + 0.8;
    expect(Math.abs(barBotY151 - boardTopY)).toBeLessThanOrEqual(0.15);

    // 252 Pin Presses: starts at the bottom on the pins (ph = 0) above the chest, drives up to straight arms (ph = 1)
    // keeping bar, wrists, and elbows in line with a brief top turnaround (<= 200 ms, no lockout hold in caption),
    // and lowers back to settle on the pins (>= 800 ms pause on pins).
    expect(bot252.movement.chestBoard).toBeUndefined();
    expect(bot252.world.near.hold[1]).toBeLessThan(top252.world.near.hold[1] - 11.0);
    expect(deg3D(top252.world.near.shoulder, top252.world.near.elbow, top252.world.near.hold)).toBeGreaterThanOrEqual(172);
    expect(forearmDegFromVertical3D(bot252.world.near.elbow, bot252.world.near.hold)).toBeLessThanOrEqual(1.0);
    expect(e252.segmentDurationsMs[1]).toBeLessThanOrEqual(200);
    expect(e252.segmentDurationsMs[3]).toBeGreaterThanOrEqual(800);
    expect(e252.frames[2].caption).toBe('Reach straight arms at the top with the bar, wrists and elbows in line.');
    expect(e252.frames[2].caption.toLowerCase()).not.toContain('hold lockout');
    // Safety pins sit tangent to the bottom of the barbell (y = hold.y - 1.6 = 35.2) well above the chest
    const pins252 = (bot252.movement.equipment ?? []).filter(
      (sh) => sh.kind === 'frame' && Math.abs(sh.a[1] - sh.b[1]) < 0.01 && sh.a[1] >= 30 && sh.a[1] <= 40,
    );
    expect(pins252.length).toBeGreaterThanOrEqual(2);
    expect(Math.abs(bot252.world.near.hold[1] - pins252[0].a[1] - 1.6)).toBeLessThanOrEqual(0.1);
  });

  test('203 Floor Press and 249 One-Arm Kettlebell Floor Press lie directly on the floor, rest upper arms on the floor at the bottom with vertical forearms, and distinguish racked barbell from single-arm rotating kettlebell', () => {
    // Quotes:
    // 203: "Lie on the floor with your head inside a rack, the bar set on low hooks, shoulder blades pulled together, and lift the bar off with straight arms. Lower the bar toward the lower chest with the elbows tucked until the upper arms rest on the floor, and pause. Press the bar back up, keeping the bar, wrists and elbows in line."
    // 249: "Lie on the floor holding a kettlebell in one hand with that upper arm resting on the floor and the palm facing in. Press the kettlebell straight up until the arm is straight, letting the wrist turn as it rises. Lower it slowly until the upper arm rests on the floor again."
    const e203 = entryFor(203);
    const e249 = entryFor(249);
    const top203 = rig.chainGeometry(slugOf(e203), 0, BODY);
    const bot203 = rig.chainGeometry(slugOf(e203), 1, BODY);
    const bot249 = rig.chainGeometry(slugOf(e249), 0, BODY);
    const top249 = rig.chainGeometry(slugOf(e249), 1, BODY);

    // 203 Floor Press: starts at lockout (ph = 0), lowers until upper arms rest on the floor (ph = 1) with a pause
    expect(top203.movement.implement).toBe('bar');
    expect(deg3D(top203.world.near.shoulder, top203.world.near.elbow, top203.world.near.hold)).toBeGreaterThanOrEqual(172);
    expect(forearmDegFromVertical3D(bot203.world.near.elbow, bot203.world.near.hold)).toBeLessThanOrEqual(1.0);
    expect(e203.segmentDurationsMs[1]).toBeGreaterThanOrEqual(750);
    // Upper arm rests on the floor at ph = 1 (elbow Y == BODY.lw*0.88/2 = 2.112 so painted bottom edge touches y = 0 / screen 96.9)
    expect(Math.abs(bot203.world.near.elbow[1] - (BODY.lw * 0.88) / 2)).toBeLessThanOrEqual(0.05);
    const prims203Bot = rig.layoutCanonicalFigure({ ...e203.frames[1].joints, ph: 1 }, { view: e203.view, assetKey: e203.assetKey, body: BODY });
    const slices203 = torsoSlicesOf(prims203Bot);
    expect(Math.abs(Math.max(slices203[0].y1, slices203[0].y2) + slices203[0].w / 2 - 96.9)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(Math.max(slices203[32].y1, slices203[32].y2) + slices203[32].w / 2 - 96.9)).toBeLessThanOrEqual(0.05);

    // 249 One-Arm Kettlebell Floor Press: starts at the bottom (ph = 0) with upper arm resting on the floor angled out
    // from the trunk (>= 40 deg in the floor plane) and palm facing in, presses straight up (horizontal travel along
    // the trunk <= 3 units) to lockout over the shoulder while turning the wrist, and lowers slowly.
    expect(bot249.movement.implement).toBe('kettlebell');
    expect(bot249.movement.kettlebellTurn).toBe(true);
    expect(Math.abs(bot249.world.near.elbow[1] - (BODY.lw * 0.88) / 2)).toBeLessThanOrEqual(0.05);
    expect(forearmDegFromVertical3D(bot249.world.near.elbow, bot249.world.near.hold)).toBeLessThanOrEqual(1.0);
    const upperArmFloorAngleDeg =
      (Math.atan2(
        Math.abs(bot249.world.near.elbow[2] - bot249.world.near.shoulder[2]),
        Math.abs(bot249.world.near.elbow[0] - bot249.world.near.shoulder[0]),
      ) *
        180) /
      Math.PI;
    expect(upperArmFloorAngleDeg).toBeGreaterThanOrEqual(40);
    expect(upperArmFloorAngleDeg).toBeLessThanOrEqual(70);
    expect(deg3D(top249.world.near.shoulder, top249.world.near.elbow, top249.world.near.hold)).toBeGreaterThanOrEqual(172);
    expect(Math.abs(top249.world.near.hold[0] - top249.world.near.shoulder[0])).toBeLessThanOrEqual(2.0);
    expect(Math.abs(top249.world.near.hold[0] - bot249.world.near.hold[0])).toBeLessThanOrEqual(3.0);
    expect(e249.segmentDurationsMs[2]).toBeGreaterThan(e249.segmentDurationsMs[0] + 400);
  });

  test('83 Cable Chest Press stands in a staggered stance facing away from chest-height pulleys with both pulleys and cables visible in the projection, presses both handles forward until hands drift together at full reach, and returns slowly under cable tension', () => {
    // Quotes:
    // "Set two handles at chest height, face away, and take a staggered stance. Press both handles forward until your arms are long, letting them drift together at the end. Return under control — the cable pulls backward the entire rep, so the squeeze at lockout is real work here."
    // "Brace into the staggered stance. Press to a full reach, hands finishing together. Ride the cables back slow."
    const e = entryFor(83);
    const slug = slugOf(e);
    const start = rig.chainGeometry(slug, 0, BODY);
    const reach = rig.chainGeometry(slug, 1, BODY);

    // Staggered stance with both feet planted on the floor throughout
    expect(Math.abs(start.world.near.ankle[0] - start.world.far.ankle[0])).toBeGreaterThanOrEqual(18);
    expect(Math.abs(start.world.near.ankle[1] - rig.CHAIN_ANKLE_HEIGHT)).toBeLessThan(0.05);
    expect(Math.abs(start.world.far.ankle[1] - rig.CHAIN_ANKLE_HEIGHT)).toBeLessThan(0.05);
    expect(Math.hypot(reach.world.near.ankle[0] - start.world.near.ankle[0], reach.world.near.ankle[1] - start.world.near.ankle[1])).toBeLessThan(0.01);
    expect(Math.hypot(reach.world.far.ankle[0] - start.world.far.ankle[0], reach.world.far.ankle[1] - start.world.far.ankle[1])).toBeLessThan(0.01);

    // Dual cables from chest-height pulleys behind the lifter, both visible clear of the painted torso silhouette
    expect(start.movement.implement).toBe('handles');
    expect((start.movement.lines ?? []).length).toBe(2);
    const pulleys = (start.movement.equipment ?? []).filter((sh) => sh.kind === 'pulley');
    expect(pulleys.length).toBe(2);
    expect(pulleys[0].at[0]).toBeLessThan(start.world.neck[0] - 20);
    expect(pulleys[0].at[1]).toBeGreaterThanOrEqual(58);
    expect(pulleys[0].at[1]).toBeLessThanOrEqual(66);

    for (const ph of [0, 1]) {
      const prims = rig.layoutCanonicalFigure({ ...e.frames[0].joints, ph }, { view: e.view, assetKey: e.assetKey, body: BODY });
      const paintedPulleys = prims.filter((p) => p.kind === 'circle' && p.r === 2.2 && p.stroke === 'textLow');
      const paintedCables = prims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && Math.abs(p.w - 1.4) < 1e-6);
      const slices = torsoSlicesOf(prims);
      const torsoMinX = Math.min(...slices.map((s) => Math.min(s.x1, s.x2) - s.w / 2));
      expect(paintedPulleys.length).toBe(2);
      expect(paintedCables.length).toBe(2);
      expect(Math.max(paintedPulleys[0].cx, paintedPulleys[1].cx) + paintedPulleys[0].r).toBeLessThan(torsoMinX - 2.0);
    }

    // Presses forward to long arms with hands drifting together at full reach
    expect(reach.world.near.hold[0] - start.world.near.hold[0]).toBeGreaterThanOrEqual(12);
    expect(deg3D(reach.world.near.shoulder, reach.world.near.elbow, reach.world.near.hold)).toBeGreaterThanOrEqual(165);
    expect(reach.world.near.hold[2]).toBeLessThan(start.world.near.hold[2] - 15.0);
    expect(reach.world.near.hold[2]).toBeLessThanOrEqual(2.0);

    // Returns slowly under control (return duration > press duration)
    expect(e.segmentDurationsMs[2]).toBeGreaterThan(e.segmentDurationsMs[0] + 400);
  });

  test('every MOV-A05 press paints the far arm behind the torso and the near arm in front of the torso, and keeps elbows below/forward of the hands across the entire stroke', () => {
    for (const id of IDS) {
      const e = entryFor(id);
      const slug = slugOf(e);
      for (const ph of [0, 0.25, 0.5, 0.75, 1]) {
        const g = rig.chainGeometry(slug, ph, BODY);
        if (id === 83) {
          expect(g.world.near.elbow[0]).toBeLessThanOrEqual(g.world.near.hold[0] + 0.05);
        } else {
          expect(g.world.near.elbow[1]).toBeLessThanOrEqual(g.world.near.hold[1] + 0.05);
          expect(g.world.near.elbow[0]).toBeGreaterThanOrEqual(
            Math.min(g.world.near.shoulder[0], g.world.near.hold[0]) - 0.1,
          );
        }
      }
      const prims = rig.layoutCanonicalFigure(
        { ...e.frames[0].joints, ph: e.frames[0].joints.ph ?? 0 },
        { view: e.view, assetKey: e.assetKey, body: BODY },
      );
      const farForearmIdx = prims.findIndex(
        (p) => p.kind === 'bone' && p.color === 'textLow' && Math.abs(p.w - BODY.lw * 0.72) < 1e-6,
      );
      const firstTorsoIdx = prims.findIndex(
        (p) => p.kind === 'bone' && p.color === 'textLow' && p.opacity === 1 && p.w < 2.0,
      );
      const lastTorsoIdx = prims.reduce(
        (acc, p, idx) => (p.kind === 'bone' && p.color === 'textLow' && p.opacity === 1 && p.w < 2.0 ? idx : acc),
        -1,
      );
      const nearUpperArmIdx = prims.findIndex(
        (p) => p.kind === 'bone' && p.color === 'textHi' && Math.abs(p.w - BODY.lw * 0.88) < 1e-6,
      );
      expect(farForearmIdx).toBeGreaterThanOrEqual(0);
      expect(firstTorsoIdx).toBeGreaterThan(farForearmIdx);
      expect(nearUpperArmIdx).toBeGreaterThan(lastTorsoIdx);
    }
  });
});

