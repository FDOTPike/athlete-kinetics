/**
 * MOV-A04 — Hinges and the posterior chain (288, 61, 210, 271, 94, 35, 23, 202, 244).
 *
 * Source-text-bound and physics-bound tests across every 33 ms tick of each
 * movement's cycle, written before authoring the drawings.
 */
import * as rig from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = rig.CANONICAL_BODY_PARAMETERS;
const IDS = [288, 61, 210, 271, 94, 35, 23, 202, 244];

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

const trunkDegFromHorizontal2D = (j) =>
  (Math.atan2(j.hp[1] - j.nk[1], Math.abs(j.nk[0] - j.hp[0])) * 180) / Math.PI;

const armDegFromVertical2D = (shoulder, wrist) =>
  (Math.abs(Math.atan2(shoulder[0] - wrist[0], wrist[1] - shoulder[1])) * 180) / Math.PI;

describe('MOV-A04 hinges and posterior chain: physics, joint angles, contacts, and family distinctions', () => {
  test.each(IDS)('movement %i is authored as pending with at least 5 frames and renders more than 20 primitives across every 33 ms tick', (id) => {
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

  test('288 Stiff-Legged Barbell Deadlift starts standing, keeps the slight knee angle fixed throughout, pushes hips back over the base of support, and lowers the bar on plumb arms toward the top of the feet', () => {
    // Quotes:
    // "Stand tall holding a barbell with an overhand grip, feet shoulder-width apart or a little narrower and the knees slightly bent."
    // "Keeping the knees at that angle and the back straight, push the hips back to lower the bar toward the top of the feet until you feel a stretch in the hamstrings."
    const e = entryFor(288);
    const slug = slugOf(e);
    const start = rig.chainGeometry(slug, 0, BODY);
    const bottom = rig.chainGeometry(slug, 1, BODY);

    // Starts standing (not from the floor): trunk upright and bar well above the floor
    expect(trunkDegFromHorizontal2D(start.joints)).toBeGreaterThan(80);
    expect(start.world.near.hold[1]).toBeGreaterThan(38);

    // Knees slightly bent (145..165 deg included angle) and KEPT at that angle across every 33 ms tick
    const startKneeDeg = deg3D(start.world.near.hipJoint, start.world.near.knee, start.world.near.ankle);
    expect(startKneeDeg).toBeGreaterThanOrEqual(148);
    expect(startKneeDeg).toBeLessThanOrEqual(166);

    const ds = e.segmentDurationsMs;
    const total = ds.reduce((a, b) => a + b, 0);
    const poses = e.frames.map((f) => f.joints);
    for (let t = 0; t <= total; t += 33) {
      const p = rig.poseAtTime(poses, t, ds);
      const g = rig.chainGeometry(slug, p.ph, BODY);
      const kneeDeg = deg3D(g.world.near.hipJoint, g.world.near.knee, g.world.near.ankle);
      expect(Math.abs(kneeDeg - startKneeDeg)).toBeLessThan(0.05);
      // Back stays straight (no spinal curl)
      expect(g.curled).toBe(false);
      // Planted feet do not drift
      expect(Math.hypot(g.world.near.ankle[0] - start.world.near.ankle[0], g.world.near.ankle[1] - start.world.near.ankle[1])).toBeLessThan(0.01);
      // Bar hangs on straight arms within 10 deg of vertical below the shoulder
      expect(armDegFromVertical2D(g.joints.nArm, g.joints.wr)).toBeLessThanOrEqual(10);
    }

    // Hips travel back and bar lowers below the knees toward the top of the feet, over the foot base of support
    expect(bottom.world.hip[0]).toBeLessThan(start.world.hip[0] - 12);
    expect(bottom.world.near.hold[1]).toBeLessThan(bottom.world.near.knee[1] - 3);
    expect(bottom.world.near.hold[0]).toBeGreaterThanOrEqual(bottom.world.near.ankle[0]);
    expect(bottom.world.near.hold[0]).toBeLessThanOrEqual(bottom.world.near.toe[0] + 1.5);
  });

  test('61 Good Morning, 210 Good Morning off Pins, and 271 Seated Good Mornings each satisfy their setup, rack/pin contact, and hip-hinge bounds', () => {
    // 61 Good Morning:
    // "Set the bar across the upper back as for a squat."
    // "Soften the knees and send the hips back until the hamstrings are loaded while the trunk stays long."
    const e61 = entryFor(61);
    const s61 = slugOf(e61);
    const gmStart = rig.chainGeometry(s61, 0, BODY);
    const gmBottom = rig.chainGeometry(s61, 1, BODY);
    expect(trunkDegFromHorizontal2D(gmStart.joints)).toBeGreaterThan(80);
    expect(trunkDegFromHorizontal2D(gmBottom.joints)).toBeLessThan(25);
    expect(gmBottom.world.hip[0]).toBeLessThan(gmStart.world.hip[0] - 12);
    expect(gmBottom.curled).toBe(false);
    // Mass-weighted centre of mass of the figure + barbell (and unweighted hip/bar midpoint) stays strictly over the planted foot [ankleX, toeX]
    const weightedComX = (fig, barMassRatio = 0.5) => {
      const w = fig.world;
      const midX = (a, b) => (a[0] + b[0]) / 2;
      const bodyX =
        0.029 * midX(w.near.ankle, w.near.toe) +
        0.093 * midX(w.near.ankle, w.near.knee) +
        0.200 * midX(w.near.knee, w.near.hipJoint) +
        0.497 * midX(w.hip, w.neck) +
        0.081 * midX(w.neck, w.head) +
        0.056 * midX(w.near.shoulder, w.near.elbow) +
        0.044 * midX(w.near.elbow, w.near.wrist);
      const barX = (w.near.hold[0] + w.far.hold[0]) / 2;
      return (bodyX + barMassRatio * barX) / (1 + barMassRatio);
    };
    for (const fig of [gmStart, gmBottom]) {
      const comX = weightedComX(fig);
      const midHipBarX = (fig.world.hip[0] + fig.world.near.hold[0]) / 2;
      expect(comX).toBeGreaterThanOrEqual(fig.world.near.ankle[0]);
      expect(comX).toBeLessThanOrEqual(fig.world.near.toe[0]);
      expect(midHipBarX).toBeGreaterThanOrEqual(fig.world.near.ankle[0]);
      expect(midHipBarX).toBeLessThanOrEqual(fig.world.near.toe[0]);
    }

    // 210 Good Morning off Pins:
    // "Set the bar on the pins at about stomach height, bend over under it so it sits across the back of the shoulders, with the torso near level with the floor, the back tight and the knees slightly bent."
    // "Push the hips back to lower the bar slowly to the pins and let it settle before the next repetition."
    const e210 = entryFor(210);
    const s210 = slugOf(e210);
    const pinStart = rig.chainGeometry(s210, 0, BODY);
    const pinTop = rig.chainGeometry(s210, 1, BODY);
    // Starts bent UNDER the bar on stomach-height pins (torso near level, <= 15 deg from horizontal)
    expect(trunkDegFromHorizontal2D(pinStart.joints)).toBeLessThanOrEqual(15);
    expect(trunkDegFromHorizontal2D(pinTop.joints)).toBeGreaterThan(80);
    expect(pinTop.world.hip[0]).toBeGreaterThan(pinStart.world.hip[0] + 12);
    // Safety pins must be drawn at stomach height (Y between 42 and 48) and the bar rests on them at ph = 0
    const pinShapes210 = (pinStart.movement.equipment ?? []).filter(
      (sh) => sh.kind === 'frame' && Math.abs(sh.a[1] - sh.b[1]) < 0.01 && sh.a[1] >= 40 && sh.a[1] <= 50,
    );
    expect(pinShapes210.length).toBeGreaterThanOrEqual(2);
    const pinHeight210 = pinShapes210[0].a[1];
    expect(Math.abs(pinStart.world.near.hold[1] - pinHeight210)).toBeLessThanOrEqual(2.0);
    // Lowering is slower than standing up, and there is a settle pause on the pins
    expect(e210.segmentDurationsMs[2]).toBeGreaterThan(e210.segmentDurationsMs[0]);
    expect(e210.segmentDurationsMs[3]).toBeGreaterThanOrEqual(650);

    // 271 Seated Good Mornings:
    // "Set a bench inside a power rack and set the pins at the depth you intend to reach."
    // "Pause just above the pins and reverse the motion until the torso is upright."
    const e271 = entryFor(271);
    const s271 = slugOf(e271);
    const seatStart = rig.chainGeometry(s271, 0, BODY);
    const seatBottom = rig.chainGeometry(s271, 1, BODY);
    expect(trunkDegFromHorizontal2D(seatStart.joints)).toBeGreaterThan(80);
    expect(trunkDegFromHorizontal2D(seatBottom.joints)).toBeLessThan(35);
    // Seated throughout: hip and ankles do not move across the cycle
    expect(Math.hypot(seatBottom.world.hip[0] - seatStart.world.hip[0], seatBottom.world.hip[1] - seatStart.world.hip[1])).toBeLessThan(0.01);
    expect(Math.hypot(seatBottom.world.near.ankle[0] - seatStart.world.near.ankle[0], seatBottom.world.near.ankle[1] - seatStart.world.near.ankle[1])).toBeLessThan(0.01);
    // Pins are drawn below the bottom bar position so both the bar shaft and the plate clear them (bar gap 4.5..6.5 units, plate edge gap >= 1.0) without resting on them
    const pinShapes271 = (seatBottom.movement.equipment ?? []).filter(
      (sh) => sh.kind === 'frame' && Math.abs(sh.a[1] - sh.b[1]) < 0.01 && sh.a[1] >= 25 && sh.a[1] <= 38,
    );
    expect(pinShapes271.length).toBeGreaterThanOrEqual(2);
    const pinHeight271 = pinShapes271[0].a[1];
    const gapAbovePins = seatBottom.world.near.hold[1] - pinHeight271;
    expect(gapAbovePins).toBeGreaterThanOrEqual(4.5);
    expect(gapAbovePins).toBeLessThanOrEqual(6.5);
    expect(gapAbovePins - 4.2).toBeGreaterThanOrEqual(1.0);
    expect(e271.segmentDurationsMs[1]).toBeGreaterThanOrEqual(550);
  });

  test('94 Single-Leg Romanian Deadlift holds the kettlebell opposite the standing leg, hangs the bell plumb under the shoulder, keeps hips square, and extends the free leg straight back to near parallel', () => {
    // Quotes:
    // "Hold a kettlebell in one hand and stand on the opposite leg."
    // "Hinge forward, letting the free leg travel straight back as a counterweight, until your torso and back leg are near parallel with the floor."
    // "Hips stay square, back leg reaches long. Bell hangs plumb under the shoulder."
    const e = entryFor(94);
    const slug = slugOf(e);
    const start = rig.chainGeometry(slug, 0, BODY);
    const bottom = rig.chainGeometry(slug, 1, BODY);

    // Kettlebell is in the near hand (+Z) while the planted standing leg is the opposite (far) leg (-Z)
    expect(start.movement.implement).toBe('kettlebell');
    expect(start.world.near.hold[2]).toBeGreaterThan(0);
    expect(start.world.far.ankle[2]).toBeLessThan(0);

    // Standing (far) foot stays planted on the floor throughout, while the free (near) leg travels straight back
    expect(Math.hypot(bottom.world.far.ankle[0] - start.world.far.ankle[0], bottom.world.far.ankle[1] - start.world.far.ankle[1])).toBeLessThan(0.01);
    expect(bottom.world.near.ankle[0]).toBeLessThan(bottom.world.hip[0] - 40);
    expect(bottom.world.near.ankle[1]).toBeGreaterThan(34);

    // Torso and back leg are near parallel with the floor (within 15 deg of horizontal)
    expect(trunkDegFromHorizontal2D(bottom.joints)).toBeLessThanOrEqual(15);
    const backLegDeg = (Math.atan2(Math.abs(bottom.world.hip[1] - bottom.world.near.ankle[1]), Math.abs(bottom.world.hip[0] - bottom.world.near.ankle[0])) * 180) / Math.PI;
    expect(backLegDeg).toBeLessThanOrEqual(15);

    // Hips stay square (roll === 0) and bell hangs plumb under the shoulder (<= 5 deg from vertical)
    expect(bottom.angles.roll).toBe(0);
    expect(armDegFromVertical2D(bottom.joints.nArm, bottom.joints.wr)).toBeLessThanOrEqual(5);
  });

  test('35 Barbell Hip Thrust pivots the upper back on the bench, carries a padded bar over the hips, and finishes in a level tabletop with vertical shins and a full-beat pause', () => {
    // Quotes:
    // "Sit on the floor with your upper back against a bench and a padded bar over your hips."
    // "Drive through your heels until your thighs and torso are level with the floor — finish flat like a tabletop, because any height past neutral comes from the lower back, not the glutes."
    // "Tuck the pelvis and pause a full beat at the top. One straight line knee-to-shoulder, core braced in neutral. Drive through the heels, shins vertical."
    const e = entryFor(35);
    const slug = slugOf(e);
    const bottom = rig.chainGeometry(slug, 0, BODY);
    const top = rig.chainGeometry(slug, 1, BODY);

    expect(top.movement.barPad).toBe(true);
    // Upper back stays supported at bench height and feet stay planted
    expect(Math.abs(top.world.neck[1] - bottom.world.neck[1])).toBeLessThan(0.05);
    expect(Math.hypot(top.world.near.ankle[0] - bottom.world.near.ankle[0], top.world.near.ankle[1] - bottom.world.near.ankle[1])).toBeLessThan(0.01);

    // At the bottom: hips are lowered below the bench under control while staying above the floor
    expect(bottom.world.hip[1]).toBeLessThan(bottom.world.neck[1] - 10);
    expect(bottom.world.hip[1]).toBeGreaterThan(8);

    // At the top: thighs and torso are level with the floor (one straight line knee-to-shoulder) and shins are vertical
    expect(Math.abs(top.world.neck[1] - top.world.hip[1])).toBeLessThan(0.05);
    expect(Math.abs(top.world.hip[1] - top.world.near.knee[1])).toBeLessThan(0.05);
    expect(Math.abs(top.world.near.knee[0] - top.world.near.ankle[0])).toBeLessThan(0.05);

    // Padded bar rests over the hips at both bottom and top
    expect(Math.abs(bottom.world.near.hold[0] - bottom.world.hip[0])).toBeLessThan(3.5);
    expect(bottom.world.near.hold[1]).toBeGreaterThan(bottom.world.hip[1]);
    expect(Math.abs(top.world.near.hold[0] - top.world.hip[0])).toBeLessThan(3.5);
    expect(top.world.near.hold[1]).toBeGreaterThan(top.world.hip[1]);

    // Full-beat pause at the top (>= 900 ms)
    expect(e.segmentDurationsMs[1]).toBeGreaterThanOrEqual(900);
  });

  test('23 Nordic Curl, 202 Floor Glute-Ham Raise, and 244 Natural Glute Ham Raise hold one straight knee-to-shoulder line, lower more than twice as slowly as they return, and show their distinct equipment, depth, and catch mechanics', () => {
    // Quotes:
    // 23: "Kneel on a soft pad and secure the ankles beneath an anchor that cannot move. Hold one line from knees to head with the hips extended, then lower that line as slowly as possible."
    // 202: "Kneel tall in a Nordic bench with the ankles locked under the foot pads, hips and shoulders in one line. Lower yourself forward by extending at the knees, keeping the hips straight rather than folding."
    // 244: "Set up in a Nordic bench with the ankles locked under the foot pads and a band anchored to assist the return. Start upright with good posture, then lower yourself under control until the knees are almost straight."
    const e23 = entryFor(23);
    const e202 = entryFor(202);
    const e244 = entryFor(244);

    // MOV-S1-R3: the catch caption keeps to the text ("Catch with the hands and use only enough push to return"):
    // no push-up position and no "when you can no longer hold".
    for (const f of e23.frames) {
      expect(f.caption.toLowerCase()).not.toContain('push-up position');
      expect(f.caption.toLowerCase()).not.toContain('no longer hold');
    }

    for (const e of [e23, e202, e244]) {
      const slug = slugOf(e);
      const start = rig.chainGeometry(slug, 0, BODY);
      const ds = e.segmentDurationsMs;
      // Lowering phase is clearly longer (>= 2x) than the return phase
      expect(ds[0]).toBeGreaterThanOrEqual(ds[2] * 2);
      const total = ds.reduce((a, b) => a + b, 0);
      const poses = e.frames.map((f) => f.joints);
      for (let t = 0; t <= total; t += 33) {
        const p = rig.poseAtTime(poses, t, ds);
        const g = rig.chainGeometry(slug, p.ph, BODY);
        // Knees and anchored ankles stay fixed
        expect(Math.hypot(g.world.near.knee[0] - start.world.near.knee[0], g.world.near.knee[1] - start.world.near.knee[1])).toBeLessThan(0.01);
        expect(Math.hypot(g.world.near.ankle[0] - start.world.near.ankle[0], g.world.near.ankle[1] - start.world.near.ankle[1])).toBeLessThan(0.01);
        // Hips stay extended in one straight line from knee to hip to shoulder (180 deg +/- 1 deg)
        const hipLineDeg = deg3D(
          [g.world.near.knee[0], g.world.near.knee[1], 0],
          g.world.hip,
          g.world.neck,
        );
        expect(hipLineDeg).toBeGreaterThanOrEqual(179);
      }
    }

    const t23 = rig.chainGeometry(slugOf(e23), 0, BODY);
    const b23 = rig.chainGeometry(slugOf(e23), 1, BODY);
    const t202 = rig.chainGeometry(slugOf(e202), 0, BODY);
    const b202 = rig.chainGeometry(slugOf(e202), 1, BODY);
    const t244 = rig.chainGeometry(slugOf(e244), 0, BODY);
    const b244 = rig.chainGeometry(slugOf(e244), 1, BODY);

    // 23 kneels on a low floor pad with an ankle roller anchor, whereas 202 and 244 kneel higher in an elevated Nordic bench with foot pads
    expect(b202.world.near.knee[1]).toBeGreaterThan(b23.world.near.knee[1] + 3);
    expect(b244.world.near.knee[1]).toBeCloseTo(b202.world.near.knee[1], 2);
    expect((b202.movement.equipment ?? []).filter((sh) => sh.kind === 'roller').length).toBeGreaterThan(
      (b23.movement.equipment ?? []).filter((sh) => sh.kind === 'roller').length,
    );

    // 244 lowers until the knees are almost straight (>= 172 deg) while holding an anchored band with natural elbow flexion (>= 25 deg, never folding to 0 deg)
    const knee244 = deg3D(b244.world.near.hipJoint, b244.world.near.knee, b244.world.near.ankle);
    expect(knee244).toBeGreaterThanOrEqual(172);
    expect(b244.world.near.wrist[1]).toBeGreaterThan(4);
    expect((b244.movement.lines ?? []).length).toBeGreaterThanOrEqual(1);
    for (const fig244 of [t244, b244]) {
      expect(deg3D(fig244.world.near.shoulder, fig244.world.near.elbow, fig244.world.near.wrist)).toBeGreaterThanOrEqual(25);
      expect(deg3D(fig244.world.far.shoulder, fig244.world.far.elbow, fig244.world.far.wrist)).toBeGreaterThanOrEqual(25);
    }

    // 23 and 202 catch on the floor at the bottom (ph=1) in painted hand contact, keep both hands planted on the floor across every 33 ms tick of the push (3100..3600 ms, ph=1..2) while the elbows extend, and only then leave the floor to return upright (ph=0) without further elbow extension.
    const p23 = rig.chainGeometry(slugOf(e23), 2, BODY);
    const p202 = rig.chainGeometry(slugOf(e202), 2, BODY);
    const handRadius = BODY.lw * 0.44;
    for (const [entry, topFig, botFig, pushFig] of [[e23, t23, b23, p23], [e202, t202, b202, p202]]) {
      const slug = slugOf(entry);
      const botGap = botFig.world.near.wrist[1] - handRadius;
      const pushGap = pushFig.world.near.wrist[1] - handRadius;
      expect(botGap).toBeGreaterThanOrEqual(0);
      expect(botGap).toBeLessThanOrEqual(0.05);
      expect(pushGap).toBeGreaterThanOrEqual(0);
      expect(pushGap).toBeLessThanOrEqual(0.2);
      expect(Math.abs(pushFig.world.near.wrist[0] - botFig.world.near.wrist[0])).toBeLessThanOrEqual(0.3);
      expect(pushFig.world.neck[1]).toBeGreaterThan(botFig.world.neck[1] + 4.0);
      const elbowBottom = deg3D(botFig.world.near.shoulder, botFig.world.near.elbow, botFig.world.near.wrist);
      const elbowPush = deg3D(pushFig.world.near.shoulder, pushFig.world.near.elbow, pushFig.world.near.wrist);
      const elbowTop = deg3D(topFig.world.near.shoulder, topFig.world.near.elbow, topFig.world.near.wrist);
      expect(elbowBottom).toBeGreaterThanOrEqual(80);
      expect(elbowBottom).toBeLessThanOrEqual(115);
      expect(elbowPush - elbowBottom).toBeGreaterThanOrEqual(30);
      expect(elbowTop).toBeLessThanOrEqual(elbowPush);
      expect(topFig.world.near.wrist[1]).toBeGreaterThan(30);

      // Every 33 ms tick during the push phase (t = 3100..3600 ms, ph = 1 -> 2):
      const ds = entry.segmentDurationsMs;
      const poses = entry.frames.map((f) => f.joints);
      const pushStartMs = ds[0] + ds[1];
      const pushEndMs = pushStartMs + ds[2];
      let prevElbow = elbowBottom;
      for (let t = pushStartMs; t <= pushEndMs; t += 33) {
        const pt = rig.poseAtTime(poses, t, ds);
        const gt = rig.chainGeometry(slug, pt.ph, BODY);
        for (const side of ['near', 'far']) {
          const gap = gt.world[side].wrist[1] - handRadius;
          const drift = Math.abs(gt.world[side].wrist[0] - botFig.world[side].wrist[0]);
          expect(gap).toBeGreaterThanOrEqual(0);
          expect(gap).toBeLessThanOrEqual(0.2);
          expect(drift).toBeLessThanOrEqual(0.3);
        }
        const curElbow = deg3D(gt.world.near.shoulder, gt.world.near.elbow, gt.world.near.wrist);
        expect(curElbow).toBeGreaterThanOrEqual(prevElbow - 1e-6);
        prevElbow = curElbow;
      }
    }
  });
});
