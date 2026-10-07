// Physical action regressions for Batch B3b: Fixed-bar body motions (66 Inverted Row & 152 Body Tricep Press).
// Inverted Row: horizontal pulling under fixed bar with heels planted and rigid body plank.
// Body Tricep Press: elbow extension pressing body away from fixed chest-height bar on planted toes.
import {
  CANONICAL_BODY_PARAMETERS,
  invertedRowGeometry,
  bodyTricepPressGeometry,
  poseAtTime,
  resolveFigureJoints,
  layoutCanonicalFigure,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const entry66 = previewManifest.entries.find(e => e.movementId === 66);
const entry152 = previewManifest.entries.find(e => e.movementId === 152);

// Dynamically derive standing hip and chest references from the rig's standing movement (Goblet Squat #14)
const standingRef = previewManifest.entries.find(e => e.movementId === 14);
const standingHipHeight = 96.9 - standingRef.frames[0].joints.hp[1]; // 44.1 dp
const standingNeckHeight = 96.9 - standingRef.frames[0].joints.nk[1]; // 68.1 dp
const standingChestHeight = 96.9 - (standingRef.frames[0].joints.nk[1] + (standingRef.frames[0].joints.hp[1] - standingRef.frames[0].joints.nk[1]) * 0.5); // 56.1 dp

describe('Batch B3b: Fixed-Bar Body Motion', () => {
  test('Entries 66 and 152 exist in manifest with pending status and correct equipment', () => {
    expect(entry66).toBeDefined();
    expect(entry66.status).toBe('pending');
    expect(entry66.view).toBe('side');
    expect(entry66.equipment).toBe('barbell');

    expect(entry152).toBeDefined();
    expect(entry152.status).toBe('pending');
    expect(entry152.view).toBe('side');
    expect(entry152.equipment).toBe('squat_rack');
  });

  test('66 maintains rigid body plank, fixed heel contact, constant bar grip, chest-to-bar pull, and loop closure', () => {
    const body = CANONICAL_BODY_PARAMETERS;
    const opts = { ...entry66, body };
    const total = entry66.segmentDurationsMs.reduce((a, b) => a + b, 0);
    const ticks = [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];

    for (const t of ticks) {
      const pose = poseAtTime(entry66.frames.map(f => f.joints), t, entry66.segmentDurationsMs);
      const g = invertedRowGeometry(pose.ir, body);
      const f = resolveFigureJoints(pose, opts);
      const prims = layoutCanonicalFigure(f, opts);

      // 1. Fixed bar anchor: bar position is pinned at [54.70, 52.8] in rack at hip height
      expect(g.bar[0]).toBeCloseTo(54.70, 2);
      expect(g.bar[1]).toBeCloseTo(52.8, 2);
      expect(g.barHeightAboveFloor).toBeCloseTo(standingHipHeight, 1);
      expect(g.barHeightAboveFloor).toBeGreaterThanOrEqual(40);
      expect(g.barHeightAboveFloor).toBeLessThanOrEqual(48);

      // 2. Wrists stay on bar: tolerance 1e-5 dp guarantees continuous grip
      expect(distance(f.wr, g.bar)).toBeLessThan(1e-5);
      expect(distance(f.wf, g.bar)).toBeLessThan(1e-5);

      // Drawn bar exists at [54.70, 52.8] in canonical apparatus primitives
      const drawnBar = prims.find(p => p.kind === 'circle' && Math.abs(p.cx - 54.70) < 1e-2 && Math.abs(p.cy - 52.8) < 1e-2);
      expect(drawnBar).toBeDefined();

      // 3. Planted heels on floor: tolerance 0.1 dp against ground line 96.9, anchor x within 1e-4 dp (no sliding)
      const footBottom = f.an[1] + g.footWidth / 2;
      expect(footBottom).toBeCloseTo(96.9, 1);
      expect(f.an[0]).toBeCloseTo(g.heelAnchor[0], 4);

      // 4. Rigid body plank: ankle, knee, hip, neck lie on the same straight line (tolerance 1e-5 rad, no sag/pike)
      const plankAngle = Math.atan2(f.nk[1] - f.an[1], f.nk[0] - f.an[0]);
      const hipAngle = Math.atan2(f.hp[1] - f.an[1], f.hp[0] - f.an[0]);
      const kneeAngle = Math.atan2(f.kn[1] - f.an[1], f.kn[0] - f.an[0]);
      expect(Math.abs(hipAngle - plankAngle)).toBeLessThan(1e-5);
      expect(Math.abs(kneeAngle - plankAngle)).toBeLessThan(1e-5);

      // 5. Exact segment lengths preserved: tolerance 1e-5 dp preserves rigid anatomy
      expect(distance(f.an, f.kn)).toBeCloseTo(22.25, 5);
      expect(distance(f.kn, f.hp)).toBeCloseTo(22.25, 5);
      expect(distance(f.hp, f.nk)).toBeCloseTo(24.0, 5);
      expect(distance(f.nk, f.hd)).toBeCloseTo(9.0, 5);
      expect(distance(f.nk, f.el)).toBeCloseTo(12.5, 5);
      expect(distance(f.el, f.wr)).toBeCloseTo(12.0, 5);

      // 6. Bar never overlaps head: distance >= headRadius (6.2) + barRadius (2.6) + 1.0 dp = 9.8 dp at every tick
      expect(distance(f.hd, g.bar)).toBeGreaterThanOrEqual(9.8);
    }

    // Long-arm position. With the heels as the pivot, the bar at hip height and
    // the chest (not the shoulder) as the touch point, how far the arm leans is
    // not a free choice: it follows from those three, which are each asserted
    // above and below. So there is no bound on the lean itself. What the source
    // does fix is "long arms" and being under the bar: the hands are above the
    // shoulders, on the feet side, and the elbows are close to straight.
    const bottomPose = poseAtTime(entry66.frames.map(f => f.joints), 0, entry66.segmentDurationsMs);
    const bottomFig = resolveFigureJoints(bottomPose, opts);
    const armDx = bottomFig.wr[0] - bottomFig.nk[0];
    const armDy = bottomFig.wr[1] - bottomFig.nk[1];
    expect(armDy).toBeLessThan(0); // hands above shoulders in canvas coordinates
    expect(armDx).toBeLessThan(0); // arm leans toward feet
    const reach = distance(bottomFig.nk, bottomFig.wr);
    const longArmFlexionDeg = 180 - Math.acos((12.5 ** 2 + 12.0 ** 2 - reach ** 2) / (2 * 12.5 * 12.0)) * 180 / Math.PI;
    expect(longArmFlexionDeg).toBeLessThanOrEqual(20); // "fully long arms": a soft elbow, not a bent one

    // Concentric action: chest reaches within 1.0 dp of bar at peak (ir = 1.0)
    // The touch point is on the chest: on the neck-to-hip line, between 20 and 35 percent
    // of the way from the neck to the hip, on the side of the trunk that faces the bar.
    const bottom = invertedRowGeometry(0, body);
    const top = invertedRowGeometry(1, body);
    const uTrunkDown = [(top.joints.hp[0] - top.joints.nk[0]) / 24, (top.joints.hp[1] - top.joints.nk[1]) / 24];
    const chestFraction = 0.25; // 25% down trunk from neck to hip (between 20% and 35%)
    expect(chestFraction).toBeGreaterThanOrEqual(0.20);
    expect(chestFraction).toBeLessThanOrEqual(0.35);
    const chestSpine = [top.joints.nk[0] + uTrunkDown[0] * 24 * chestFraction, top.joints.nk[1] + uTrunkDown[1] * 24 * chestFraction];
    const chestNorm = [-uTrunkDown[1], uTrunkDown[0]]; // normal pointing toward the bar
    const sw = body.sw * 0.58;
    const hw = Math.min(body.hw * 0.92, sw * 0.9);
    const halfThick = sw + (hw - sw) * chestFraction;
    const chestSurface = [chestSpine[0] + chestNorm[0] * halfThick, chestSpine[1] + chestNorm[1] * halfThick];
    expect(distance(chestSurface, top.bar)).toBeLessThanOrEqual(1.0);
    expect(distance(chestSpine, top.bar)).toBeLessThanOrEqual(halfThick + 1.0);
    expect(top.joints.hd[0]).toBeGreaterThan(top.bar[0]); // head is beyond the bar at the top
    expect(distance(top.joints.nk, top.bar)).toBeLessThan(distance(bottom.joints.nk, bottom.bar));
    expect(top.plankAngleDeg).toBeGreaterThan(bottom.plankAngleDeg);

    // Elbows lead and finish behind the line of the trunk
    const uTrunkUp = [(top.joints.nk[0] - top.joints.hp[0]) / 24, (top.joints.nk[1] - top.joints.hp[1]) / 24];
    const vEl = [top.joints.el[0] - top.joints.nk[0], top.joints.el[1] - top.joints.nk[1]];
    const elbowBehindTrunkCross = uTrunkUp[0] * vEl[1] - uTrunkUp[1] * vEl[0];
    expect(elbowBehindTrunkCross).toBeGreaterThan(0);

    // Loop closure: first and last keyframe joints must be byte-for-byte identical
    expect(entry66.frames[0].joints).toEqual(entry66.frames.at(-1).joints);
  });

  test('152 isolates elbow extension against fixed bar with quiet body plank, bounded drift, bottom pause, and loop closure', () => {
    const body = CANONICAL_BODY_PARAMETERS;
    const opts = { ...entry152, body };
    const total = entry152.segmentDurationsMs.reduce((a, b) => a + b, 0);
    const ticks = [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];

    let minRelAngle = 180;
    let maxRelAngle = -180;
    let prevRelAngle = null;

    for (const t of ticks) {
      const pose = poseAtTime(entry152.frames.map(f => f.joints), t, entry152.segmentDurationsMs);
      const g = bodyTricepPressGeometry(pose.tp, body);
      const f = resolveFigureJoints(pose, opts);
      const prims = layoutCanonicalFigure(f, opts);

      // 1. Fixed bar anchor: bar position is pinned at [75.0, 39.9] in rack at chest height
      expect(g.bar[0]).toBeCloseTo(75.0, 2);
      expect(g.bar[1]).toBeCloseTo(39.9, 2);
      expect(g.barHeightAboveFloor).toBeGreaterThanOrEqual(55);
      expect(g.barHeightAboveFloor).toBeLessThanOrEqual(65);
      expect(g.barHeightAboveFloor).toBeGreaterThan(standingHipHeight);
      expect(g.barHeightAboveFloor).toBeLessThan(standingNeckHeight);

      // 2. Hands grip bar: tolerance 1e-5 dp guarantees continuous grip
      expect(distance(f.wr, g.bar)).toBeLessThan(1e-5);
      expect(distance(f.wf, g.bar)).toBeLessThan(1e-5);

      // Drawn bar exists at [75.0, 39.9] in canonical apparatus primitives
      const drawnBar = prims.find(p => p.kind === 'circle' && Math.abs(p.cx - 75.0) < 1e-2 && Math.abs(p.cy - 39.9) < 1e-2);
      expect(drawnBar).toBeDefined();

      // 3. Planted toes on floor: tolerance 0.1 dp against ground line 96.9, anchor x within 1e-4 dp (no sliding)
      const footBottom = f.an[1] + g.footWidth / 2;
      expect(footBottom).toBeCloseTo(96.9, 1);
      expect(f.an[0]).toBeCloseTo(g.heelAnchor[0], 4);

      // 4. Rigid body plank: tolerance 1e-5 rad collinearity
      const plankAngle = Math.atan2(f.nk[1] - f.an[1], f.nk[0] - f.an[0]);
      const hipAngle = Math.atan2(f.hp[1] - f.an[1], f.hp[0] - f.an[0]);
      const kneeAngle = Math.atan2(f.kn[1] - f.an[1], f.kn[0] - f.an[0]);
      expect(Math.abs(hipAngle - plankAngle)).toBeLessThan(1e-5);
      expect(Math.abs(kneeAngle - plankAngle)).toBeLessThan(1e-5);

      // 5. Segment lengths preserved: tolerance 1e-5 dp
      expect(distance(f.an, f.kn)).toBeCloseTo(22.25, 5);
      expect(distance(f.kn, f.hp)).toBeCloseTo(22.25, 5);
      expect(distance(f.hp, f.nk)).toBeCloseTo(24.0, 5);
      expect(distance(f.nk, f.hd)).toBeCloseTo(9.0, 5);
      expect(distance(f.nk, f.el)).toBeCloseTo(12.5, 5);
      expect(distance(f.el, f.wr)).toBeCloseTo(12.0, 5);

      // Track upper-arm angle relative to trunk
      const armAngle = Math.atan2(-(f.el[1] - f.nk[1]), f.el[0] - f.nk[0]);
      let rel = (armAngle - g.plankAngleDeg * Math.PI / 180) * 180 / Math.PI;
      while (rel < -180) rel += 360;
      while (rel > 180) rel -= 360;
      minRelAngle = Math.min(minRelAngle, rel);
      maxRelAngle = Math.max(maxRelAngle, rel);

      // Track tick-by-tick drift: upper-arm-to-trunk change of at most 10 degrees over every 33 ms tick
      if (prevRelAngle !== null) {
        let tickDiff = Math.abs(rel - prevRelAngle);
        while (tickDiff > 180) tickDiff = Math.abs(tickDiff - 360);
        expect(tickDiff).toBeLessThanOrEqual(10.0);
      }
      prevRelAngle = rel;
    }

    // Biomechanical distinction: 152 flexes elbow to lower head towards bar
    const lockout = bodyTricepPressGeometry(0, body);
    const flexed = bodyTricepPressGeometry(1, body);
    expect(distance(flexed.joints.hd, flexed.bar)).toBeLessThan(distance(lockout.joints.hd, lockout.bar));

    // Elbow angle range: nearly straight arms at lockout (< 10 deg tolerance), deep elbow flexion at bottom (> 70 deg tolerance)
    expect(lockout.elbowFlexionDeg).toBeLessThan(10);
    expect(flexed.elbowFlexionDeg).toBeGreaterThan(70);

    // Upper-arm-to-trunk angle drift bound: <= 10 deg tolerance across whole cycle proves isolated triceps extension
    const drift = maxRelAngle - minRelAngle;
    expect(drift).toBeLessThanOrEqual(10);

    // Visible pause at bottom: segment duration for bottom hold (frame 3 to 4) is at least 400 ms (tolerance >= 400 ms)
    expect(entry152.segmentDurationsMs[2]).toBeGreaterThanOrEqual(400);

    // Loop closure: first and last keyframe joints must be byte-for-byte identical
    expect(entry152.frames[0].joints).toEqual(entry152.frames.at(-1).joints);
  });
});
