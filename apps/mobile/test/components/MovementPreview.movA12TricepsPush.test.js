/**
 * MOV-A12 — Lying/incline/decline/kneeling triceps extensions, parallel-bar dip,
 * close-grip push-up off an end-standing dumbbell, and clock push-up
 * (91, 242, 215, 233, 177, 47, 170, 166).
 *
 * Source-text-bound and physics-bound tests across every 33 ms tick of each
 * movement's cycle, written before authoring the drawings.
 */
import * as rig from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = rig.CANONICAL_BODY_PARAMETERS;
const BACK_HALF = BODY.sw * 0.58;
const HAND_HALF = BODY.lw * 0.44 + 0.1;
const IDS = [91, 242, 215, 233, 177, 47, 170, 166];
const BAR_EXTENSION_IDS = [242, 215, 233, 177];

const entryFor = (id) => {
  const e = previewManifest.entries.find((x) => x.movementId === id);
  expect(e).toBeDefined();
  return e;
};

const slugOf = (e) => e.assetKey.split('/')[1];

const dist = (a, b) =>
  Math.hypot(...a.slice(0, Math.min(a.length, b.length)).map((v, i) => v - b[i]));

const deg3D = (a, b, c) => {
  const ux = a[0] - b[0], uy = a[1] - b[1], uz = (a[2] ?? 0) - (b[2] ?? 0);
  const vx = c[0] - b[0], vy = c[1] - b[1], vz = (c[2] ?? 0) - (b[2] ?? 0);
  const n = Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz) || 1;
  return (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / n))) * 180) / Math.PI;
};

const direction2D = (from, to) =>
  (((Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI) + 360) % 360;

const segDist3D = (a, b, c) => {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = (b[2] ?? 0) - (a[2] ?? 0);
  const lenSq = ux * ux + uy * uy + uz * uz || 1;
  const k = Math.max(0, Math.min(1, ((c[0] - a[0]) * ux + (c[1] - a[1]) * uy + ((c[2] ?? 0) - (a[2] ?? 0)) * uz) / lenSq));
  return Math.hypot(c[0] - (a[0] + ux * k), c[1] - (a[1] + uy * k), (c[2] ?? 0) - ((a[2] ?? 0) + uz * k));
};

const segDist2D = (a, b, c) => {
  const ux = b[0] - a[0], uy = b[1] - a[1];
  const lenSq = ux * ux + uy * uy || 1;
  const k = Math.max(0, Math.min(1, ((c[0] - a[0]) * ux + (c[1] - a[1]) * uy) / lenSq));
  return Math.hypot(c[0] - (a[0] + ux * k), c[1] - (a[1] + uy * k));
};

const offPad = (pad, point) => {
  const ux = pad.b[0] - pad.a[0], uy = pad.b[1] - pad.a[1];
  return Math.abs((point[0] - pad.a[0]) * uy - (point[1] - pad.a[1]) * ux) / Math.hypot(ux, uy);
};

const forehead = (world) => {
  const along = ((direction2D(world.neck, world.head) - 45) * Math.PI) / 180;
  return [world.head[0] + BODY.hr * Math.cos(along), world.head[1] + BODY.hr * Math.sin(along)];
};

const ticksOf = (e) => {
  const total = e.segmentDurationsMs.reduce((a, b) => a + b, 0);
  return [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];
};

// Fore-aft position of the whole system's centre of mass: the body from the
// world joints with Winter's segment mass fractions and centre positions
// (head and neck 0.081 at the head; trunk 0.497 half-way up the spine; upper
// arm 0.028 at 0.436, forearm 0.016 at 0.430, hand 0.006 at the wrist; thigh
// 0.100 at 0.433, shank 0.0465 at 0.433, foot 0.0145 half-way along), plus a
// load of `loadPerHand` body masses at each hand's hold.
const lerp3 = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const systemComX = (w, loadPerHand) => {
  const parts = [[0.081, w.head], [0.497, lerp3(w.hip, w.neck, 0.5)]];
  for (const s of [w.near, w.far]) {
    parts.push(
      [0.028, lerp3(s.shoulder, s.elbow, 0.436)], [0.016, lerp3(s.elbow, s.wrist, 0.43)], [0.006, s.wrist],
      [0.1, lerp3(s.hipJoint, s.knee, 0.433)], [0.0465, lerp3(s.knee, s.ankle, 0.433)], [0.0145, lerp3(s.ankle, s.toe ?? s.ankle, 0.5)],
      [loadPerHand, s.hold],
    );
  }
  const mass = parts.reduce((sum, [m]) => sum + m, 0);
  return parts.reduce((sum, [m, p]) => sum + m * p[0], 0) / mass;
};

describe('MOV-A12 triceps extensions, dip, and push-ups: universal physics, rigid bar grip, and head clearance', () => {
  test.each(IDS)('movement %i is authored as pending with >= 5 frames, uncurled spine, and valid primitive layout at every 33 ms tick', (id) => {
    const e = entryFor(id);
    expect(e.status).toBe('pending');
    expect(e.frames.length).toBeGreaterThanOrEqual(5);
    const slug = slugOf(e);
    const poses = e.frames.map((f) => f.joints);
    const ds = e.segmentDurationsMs;

    for (const t of ticksOf(e)) {
      const p = rig.poseAtTime(poses, t, ds);
      const g = rig.chainGeometry(slug, p.ph, BODY);
      const prims = rig.layoutCanonicalFigure(p, { view: e.view, assetKey: e.assetKey, body: BODY });
      expect(prims.length).toBeGreaterThan(20);
      expect(g.curled).toBe(false);
    }
  });

  test.each(BAR_EXTENSION_IDS)('bar triceps movement %i keeps a rigid fixed grip span and clears the head by at least head radius + bar radius in 3D and 2D at every 33 ms tick', (id) => {
    const e = entryFor(id);
    const slug = slugOf(e);
    const start = rig.chainGeometry(slug, e.frames[0].joints.ph, BODY);
    const startSpan = dist(start.world.near.wrist, start.world.far.wrist);
    const barRadius = 0.8;
    const poses = e.frames.map((f) => f.joints);
    const ds = e.segmentDurationsMs;

    let maxSpanDrift = 0;
    let minClear3D = Infinity;
    let minClear2D = Infinity;
    for (const t of ticksOf(e)) {
      const p = rig.poseAtTime(poses, t, ds);
      const g = rig.chainGeometry(slug, p.ph, BODY);
      const span = dist(g.world.near.wrist, g.world.far.wrist);
      maxSpanDrift = Math.max(maxSpanDrift, Math.abs(span - startSpan));
      expect(Math.abs(g.world.near.hold[1] - g.world.far.hold[1])).toBeLessThan(0.01);
      minClear3D = Math.min(minClear3D, segDist3D(g.world.near.hold, g.world.far.hold, g.world.head));
      minClear2D = Math.min(minClear2D, segDist2D(g.hold.near, g.hold.far, g.joints.hd));
    }
    expect(maxSpanDrift).toBeLessThanOrEqual(0.5);
    expect(minClear3D).toBeGreaterThanOrEqual(BODY.hr + barRadius);
    expect(minClear2D).toBeGreaterThanOrEqual(BODY.hr + barRadius);
  });

  test('91 Lying Dumbbell Triceps Extension lies on a flat bench with palms facing each other, upper arms frozen and angled slightly back over the head, lowering the dumbbells beside the ears and pressing back to long arms', () => {
    // Quotes:
    // "Lie on a bench with dumbbells pressed over your chest, palms facing each other. Keeping your upper arms still and angled slightly back over your head, bend the elbows and lower the dumbbells beside your ears. Press back to long arms along the same path. Upper arms are the hinge pin — they point at one spot on the ceiling for the whole set."
    // "Upper arms frozen, angled just past vertical. Lower to the ears, deep and controlled. Elbows point at the ceiling, always."
    const e = entryFor(91);
    const slug = slugOf(e);
    const start = rig.chainGeometry(slug, 0, BODY);
    const bottom = rig.chainGeometry(slug, 1, BODY);
    const pad = rig.CHAIN_MOVEMENTS[slug].equipment.find((s) => s.kind === 'slab');

    expect(start.movement.implement).toBe('hammer');
    expect(pad).toBeDefined();
    expect(start.world.neck[1]).toBeCloseTo(start.world.hip[1], 6);
    expect(pad.a[1] + 2).toBeCloseTo(start.world.hip[1] - BACK_HALF, 6);
    expect(start.world.near.ankle[1]).toBeCloseTo(rig.CHAIN_ANKLE_HEIGHT, 6);
    expect(start.world.near.ankle[0]).toBeGreaterThan(Math.max(pad.a[0], pad.b[0]) + 5);

    // Long arms at start, upper arms angled slightly back over the head (10..20 deg past vertical 90 toward -x)
    expect(deg3D(start.world.near.shoulder, start.world.near.elbow, start.world.near.wrist)).toBeGreaterThanOrEqual(172);
    expect(deg3D(start.world.far.shoulder, start.world.far.elbow, start.world.far.wrist)).toBeGreaterThanOrEqual(172);
    const upperDir = direction2D(start.world.near.shoulder, start.world.near.elbow);
    expect(upperDir).toBeGreaterThanOrEqual(98);
    expect(upperDir).toBeLessThanOrEqual(112);

    // Upper arms are frozen for the whole set, and each dumbbell is seen along its length square to its forearm
    const poses = e.frames.map((f) => f.joints);
    const ds = e.segmentDurationsMs;
    for (const t of ticksOf(e)) {
      const p = rig.poseAtTime(poses, t, ds);
      const g = rig.chainGeometry(slug, p.ph, BODY);
      const prims = rig.layoutCanonicalFigure(p, { view: e.view, assetKey: e.assetKey, body: BODY });
      expect(dist(g.world.near.elbow, start.world.near.elbow)).toBeLessThan(0.01);
      expect(dist(g.world.far.elbow, start.world.far.elbow)).toBeLessThan(0.01);
      expect(dist(g.world.near.hold, g.world.head)).toBeGreaterThanOrEqual(BODY.hr + 2.5);
      expect(dist(g.world.far.hold, g.world.head)).toBeGreaterThanOrEqual(BODY.hr + 2.5);
      for (const [hand, elbow] of [[g.joints.wr, g.joints.el], [g.joints.wf, g.joints.ef]]) {
        const shaft = prims.find(
          (pr) => pr.kind === 'bone' && pr.w === 2.2
            && Math.abs((pr.x1 + pr.x2) / 2 - hand[0]) < 1e-6
            && Math.abs((pr.y1 + pr.y2) / 2 - hand[1]) < 1e-6,
        );
        expect(shaft).toBeDefined();
        const along = (shaft.x2 - shaft.x1) * (hand[0] - elbow[0]) + (shaft.y2 - shaft.y1) * (hand[1] - elbow[1]);
        expect(Math.abs(along)).toBeLessThan(1e-6);
      }
    }

    // Bottom pose lowers the dumbbells beside the ears in the side plane while staying laterally outside the head in Z
    expect(deg3D(bottom.world.near.shoulder, bottom.world.near.elbow, bottom.world.near.wrist)).toBeLessThanOrEqual(75);
    expect(Math.abs(bottom.world.near.wrist[0] - bottom.world.head[0])).toBeLessThanOrEqual(BODY.hr);
    expect(Math.abs(bottom.world.near.wrist[1] - bottom.world.head[1])).toBeLessThanOrEqual(BODY.hr);
    expect(Math.abs(bottom.world.near.wrist[2])).toBeGreaterThan(BODY.hr + 2.5);

    // Controlled lowering takes longer than the press up, with no invented hold
    expect(poses.map((j) => j.ph)).toEqual([0, 0.5, 1, 0.5, 0]);
    const downMs = ds[0] + ds[1];
    const upMs = ds[2] + ds[3];
    expect(downMs).toBeGreaterThanOrEqual(1.35 * upMs);
  });

  test('242 Lying Triceps Press lies on a flat bench with arms straight above the chest, keeps upper arms and tucked elbows still, and lowers the bar slowly until just above the forehead', () => {
    // Quotes:
    // "Lie on a flat bench holding an EZ bar or a straight bar with a medium overhand grip, arms straight above the chest and elbows tucked in. Keeping the upper arms and elbows still, bend the elbows to lower the bar until it is just above the forehead. Straighten the elbows to return the bar above the chest."
    // "Upper arms stay still. Elbows tucked in. Lower slowly toward the forehead."
    const e = entryFor(242);
    const slug = slugOf(e);
    const start = rig.chainGeometry(slug, 0, BODY);
    const bottom = rig.chainGeometry(slug, 1, BODY);
    const bottom91 = rig.chainGeometry(slugOf(entryFor(91)), 1, BODY);
    const pad = rig.CHAIN_MOVEMENTS[slug].equipment.find((s) => s.kind === 'slab');

    expect(['ez', 'bar']).toContain(start.movement.implement);
    expect(pad).toBeDefined();
    expect(start.world.neck[1]).toBeCloseTo(start.world.hip[1], 6);
    expect(pad.a[1] + 2).toBeCloseTo(start.world.hip[1] - BACK_HALF, 6);

    // Medium grip with elbows tucked in and arms straight above the chest at start
    const gripSpan = dist(start.world.near.wrist, start.world.far.wrist);
    expect(gripSpan).toBeGreaterThanOrEqual(14);
    expect(gripSpan).toBeLessThanOrEqual(20);
    expect(deg3D(start.world.near.shoulder, start.world.near.elbow, start.world.near.wrist)).toBeGreaterThanOrEqual(172);
    expect(direction2D(start.world.near.shoulder, start.world.near.elbow)).toBeCloseTo(90, 5);
    expect(Math.abs(start.world.near.wrist[0] - start.world.near.shoulder[0])).toBeLessThanOrEqual(1.5);

    // Upper arms and tucked elbows stay still at every 33 ms tick
    const poses = e.frames.map((f) => f.joints);
    const ds = e.segmentDurationsMs;
    for (const t of ticksOf(e)) {
      const p = rig.poseAtTime(poses, t, ds);
      const g = rig.chainGeometry(slug, p.ph, BODY);
      expect(dist(g.world.near.elbow, start.world.near.elbow)).toBeLessThan(0.01);
      expect(dist(g.world.far.elbow, start.world.far.elbow)).toBeLessThan(0.01);
      expect(Math.abs(g.world.near.elbow[2] - g.world.near.shoulder[2])).toBeLessThan(0.01);
    }

    // Bottom stops just above the forehead, clearly higher than the beside-the-ears dumbbell extension (91)
    const fh = forehead(bottom.world);
    expect(Math.hypot(bottom.world.near.wrist[0] - fh[0], bottom.world.near.wrist[1] - fh[1])).toBeLessThanOrEqual(5.5);
    expect(bottom.world.near.wrist[1]).toBeGreaterThan(bottom.world.head[1] + BODY.hr + 2.0);
    expect(bottom.world.near.wrist[1]).toBeGreaterThan(bottom91.world.near.wrist[1] + 6.0);

    // Lower slowly toward the forehead, with no invented hold
    expect(poses.map((j) => j.ph)).toEqual([0, 0.5, 1, 0.5, 0]);
    const downMs = ds[0] + ds[1];
    const upMs = ds[2] + ds[3];
    expect(downMs).toBeGreaterThanOrEqual(1.35 * upMs);
  });

  test('215 Incline Barbell Triceps Extension reclines on an incline bench with a narrower-than-shoulders grip and arms in line with the torso, lowers the bar slowly behind the head with only the forearms moving, and pauses overhead', () => {
    // Quotes:
    // "Lie back on an incline bench holding a barbell overhead with an overhand grip slightly narrower than the shoulders, arms straight and in line with the torso. Keeping the upper arms still and close to the head, bend the elbows to lower the bar behind the head. Straighten the elbows to return the bar overhead and pause."
    // "Upper arms close to the head. Only the forearms move. Lower slowly behind the head."
    const e = entryFor(215);
    const slug = slugOf(e);
    const start = rig.chainGeometry(slug, 0, BODY);
    const bottom = rig.chainGeometry(slug, 1, BODY);
    const equipment = rig.CHAIN_MOVEMENTS[slug].equipment;
    const backPad = equipment.find((s) => s.kind === 'slab' && Math.abs(s.a[1] - s.b[1]) > 5);
    const seatPad = equipment.find((s) => s.kind === 'slab' && s !== backPad);

    expect(start.movement.implement).toBe('bar');
    expect(backPad).toBeDefined();
    expect(seatPad).toBeDefined();
    // Backrest slab matches the incline trunk angle and supports the back
    expect(direction2D(backPad.a, backPad.b)).toBeCloseTo(direction2D(start.world.hip, start.world.neck), 6);
    expect(offPad(backPad, start.world.hip) - 2).toBeCloseTo(BACK_HALF, 5);
    expect(offPad(backPad, start.world.neck) - 2).toBeCloseTo(BACK_HALF, 5);

    // Grip slightly narrower than the shoulders
    const shoulderWidth = 2 * BODY.sw * 0.92;
    const gripSpan = dist(start.world.near.wrist, start.world.far.wrist);
    expect(gripSpan).toBeGreaterThanOrEqual(12);
    expect(gripSpan).toBeLessThan(shoulderWidth - 2.0);

    // Arms straight and in line with the torso at lockout, upper arms close to the head
    expect(deg3D(start.world.near.shoulder, start.world.near.elbow, start.world.near.wrist)).toBeGreaterThanOrEqual(172);
    expect(Math.abs(direction2D(start.world.near.shoulder, start.world.near.elbow) - direction2D(start.world.hip, start.world.neck))).toBeLessThanOrEqual(3);
    expect(Math.hypot(start.world.near.elbow[0] - start.world.head[0], start.world.near.elbow[1] - start.world.head[1])).toBeLessThanOrEqual(6.5);

    // Only the forearms move across every 33 ms tick
    const poses = e.frames.map((f) => f.joints);
    const ds = e.segmentDurationsMs;
    for (const t of ticksOf(e)) {
      const p = rig.poseAtTime(poses, t, ds);
      const g = rig.chainGeometry(slug, p.ph, BODY);
      expect(dist(g.world.near.elbow, start.world.near.elbow)).toBeLessThan(0.01);
      expect(dist(g.world.far.elbow, start.world.far.elbow)).toBeLessThan(0.01);
      expect(dist(g.world.hip, start.world.hip)).toBeLessThan(0.01);
      expect(dist(g.world.neck, start.world.neck)).toBeLessThan(0.01);
    }

    // Bottom lowers the bar behind the head (-x of the head)
    expect(deg3D(bottom.world.near.shoulder, bottom.world.near.elbow, bottom.world.near.wrist)).toBeLessThanOrEqual(95);
    expect(bottom.world.near.wrist[0]).toBeLessThan(bottom.world.head[0] - BODY.hr - 5);

    // Lower slowly behind the head, straighten to return overhead, and pause
    expect(poses.map((j) => j.ph)).toEqual([0, 0.5, 1, 0, 0]);
    const downMs = ds[0] + ds[1];
    const upMs = ds[2];
    const pauseMs = ds[3];
    expect(downMs).toBeGreaterThanOrEqual(1.4 * upMs);
    expect(pauseMs).toBeGreaterThanOrEqual(500);
  });

  test('233 Kneeling Cable Triceps Extension kneels facing away from a high pulley with head and upper arms resting on a bench, extends the straight bar to level with the floor, pauses, and returns slowly', () => {
    // Quotes:
    // "Place a bench sideways in front of a high pulley, kneel facing away from the machine and rest the head and the backs of the upper arms on the bench, holding the straight bar with a narrow overhand grip and the elbows bent. Keeping the upper arms on the bench and close to the head, straighten the elbows until the arms are level with the floor. Pause, then let the elbows bend slowly back to the start."
    // "Upper arms stay on the bench. Elbows in. Squeeze the triceps at full extension."
    const e = entryFor(233);
    const slug = slugOf(e);
    const start = rig.chainGeometry(slug, 0, BODY);
    const ext = rig.chainGeometry(slug, 1, BODY);
    const equipment = rig.CHAIN_MOVEMENTS[slug].equipment;
    const pulley = equipment.find((s) => s.kind === 'pulley');
    const pad = equipment.find((s) => s.kind === 'slab');

    expect(start.movement.implement).toBe('cableBar');
    expect(pulley).toBeDefined();
    expect(pad).toBeDefined();

    // High pulley behind the kneeling athlete, bench in front supporting the head and backs of the upper arms
    expect(pulley.at[0]).toBeLessThan(start.world.near.ankle[0]);
    expect(pulley.at[1]).toBeGreaterThanOrEqual(68);
    expect(start.world.near.knee[1]).toBeLessThanOrEqual((BODY.lw * 1.18) / 2 + 0.5);
    const benchTop = pad.a[1] + 2;
    const armRadius = (BODY.lw * 0.88) / 2;
    expect(Math.abs((start.world.near.shoulder[1] - armRadius) - benchTop)).toBeLessThanOrEqual(0.5);
    expect(Math.abs((start.world.near.elbow[1] - armRadius) - benchTop)).toBeLessThanOrEqual(0.5);
    // The head rests on the pad too: the painted underside of the head ring (its
    // radius plus half its stroke) sits on the pad's top, within 0.5 and never
    // below it, over the pad, at every 33 ms tick
    for (const t of ticksOf(e)) {
      const p = rig.poseAtTime(e.frames.map((f) => f.joints), t, e.segmentDurationsMs);
      const g = rig.chainGeometry(slug, p.ph, BODY);
      const prims = rig.layoutCanonicalFigure(p, { view: e.view, assetKey: e.assetKey, body: BODY });
      const head = prims.find((pr) => pr.kind === 'circle' && pr.stroke === 'textHi' && pr.r >= 5.5);
      expect(head).toBeDefined();
      const headUnderside = g.world.head[1] - (head.r + head.strokeWidth / 2);
      expect(headUnderside).toBeGreaterThanOrEqual(benchTop);
      expect(headUnderside).toBeLessThanOrEqual(benchTop + 0.5);
      expect(g.world.head[0]).toBeGreaterThanOrEqual(Math.min(pad.a[0], pad.b[0]));
      expect(g.world.head[0]).toBeLessThanOrEqual(Math.max(pad.a[0], pad.b[0]));
    }
    expect(start.world.near.elbow[0]).toBeGreaterThanOrEqual(Math.min(pad.a[0], pad.b[0]));
    expect(start.world.near.elbow[0]).toBeLessThanOrEqual(Math.max(pad.a[0], pad.b[0]));

    // Narrow overhand grip on the straight bar
    const gripSpan = dist(start.world.near.wrist, start.world.far.wrist);
    expect(gripSpan).toBeGreaterThanOrEqual(10);
    expect(gripSpan).toBeLessThan(2 * BODY.sw * 0.92 - 4);

    // Starts with elbows bent, straightens until arms are level with the floor (0 deg)
    expect(deg3D(start.world.near.shoulder, start.world.near.elbow, start.world.near.wrist)).toBeLessThanOrEqual(85);
    expect(deg3D(ext.world.near.shoulder, ext.world.near.elbow, ext.world.near.wrist)).toBeGreaterThanOrEqual(172);
    expect(Math.abs(ext.world.near.wrist[1] - ext.world.near.shoulder[1])).toBeLessThanOrEqual(0.5);

    // Upper arms stay on the bench and cable lengthens monotonically during extension
    const poses = e.frames.map((f) => f.joints);
    const ds = e.segmentDurationsMs;
    const cableLengths = [];
    for (const t of ticksOf(e)) {
      const p = rig.poseAtTime(poses, t, ds);
      const g = rig.chainGeometry(slug, p.ph, BODY);
      expect(dist(g.world.near.elbow, start.world.near.elbow)).toBeLessThan(0.01);
      expect(dist(g.world.far.elbow, start.world.far.elbow)).toBeLessThan(0.01);
      const midHold = [
        (g.world.near.hold[0] + g.world.far.hold[0]) / 2,
        (g.world.near.hold[1] + g.world.far.hold[1]) / 2,
      ];
      expect(segDist2D(pulley.at, midHold, [g.world.head[0], g.world.head[1]])).toBeGreaterThan(BODY.hr + 0.7);
      if (t <= ds[0]) cableLengths.push(Math.hypot(midHold[0] - pulley.at[0], midHold[1] - pulley.at[1]));
    }
    for (let i = 1; i < cableLengths.length; i++) {
      expect(cableLengths[i]).toBeGreaterThanOrEqual(cableLengths[i - 1] - 1e-6);
    }
    expect(cableLengths.at(-1) - cableLengths[0]).toBeGreaterThan(8);

    // Pause at full extension, then let the elbows bend slowly back to the start
    expect(poses.map((j) => j.ph)).toEqual([0, 1, 1, 0.5, 0]);
    const extendMs = ds[0];
    const pauseMs = ds[1];
    const returnMs = ds[2] + ds[3];
    expect(pauseMs).toBeGreaterThanOrEqual(500);
    expect(returnMs).toBeGreaterThanOrEqual(1.4 * extendMs);
  });

  test.each([242, 215, 233])('%i shows its overhand grip in a hand close-up at every 33 ms tick: the palm faces away from the face, so the panel (seen from in front of the hands) shows a light palm behind the bar with four fingers wrapped over it', (id) => {
    // 242: "holding an EZ bar or a straight bar with a medium overhand grip"
    // 215: "holding a barbell overhead with an overhand grip slightly narrower than the shoulders"
    // 233: "holding the straight bar with a narrow overhand grip and the elbows bent"
    const e = entryFor(id);
    const slug = slugOf(e);
    const poses = e.frames.map((f) => f.joints);
    for (const t of ticksOf(e)) {
      const p = rig.poseAtTime(poses, t, e.segmentDurationsMs);
      const g = rig.chainGeometry(slug, p.ph, BODY);
      const panel = rig.handCloseUp(g);
      expect(panel).not.toBeNull();
      expect(panel.palmYaw).toBe(0);
      expect(panel.palmFacingViewer).toBe(true);
      const prims = rig.layoutCanonicalFigure(p, { view: e.view, assetKey: e.assetKey, body: BODY });
      const discIdx = prims.findIndex((pr) => pr.kind === 'circle' && pr.fill === 'ink1' && pr.stroke === 'textLow'
        && Math.abs(pr.cx - panel.centre[0]) < 1e-6 && Math.abs(pr.cy - panel.centre[1]) < 1e-6);
      expect(discIdx).toBeGreaterThanOrEqual(0);
      const after = prims.slice(discIdx + 1).map((pr, i) => ({ pr, i }));
      const bar = after.find(({ pr }) => pr.kind === 'bone' && pr.color === 'textMid' && Math.abs(pr.w - 2.2) < 1e-6);
      const palm = after.find(({ pr }) => pr.kind === 'bone' && pr.color === 'textHi' && Math.abs(pr.w - 7.0) < 1e-6);
      expect(bar).toBeDefined();
      expect(palm).toBeDefined();
      // The bar runs across the panel (seen along its length), behind the fingers and in front of the palm
      expect(Math.abs(bar.pr.x2 - bar.pr.x1) / 2).toBeGreaterThan(6);
      expect(palm.i).toBeLessThan(bar.i);
      const wrapped = after.filter(({ pr, i }) => pr.kind === 'bone' && i > bar.i && Math.abs(pr.w - 1.7) < 1e-6
        && Math.min(pr.y1, pr.y2) - pr.w / 2 < bar.pr.y1 - bar.pr.w / 2 && Math.max(pr.y1, pr.y2) + pr.w / 2 > bar.pr.y1 + bar.pr.w / 2);
      expect(wrapped).toHaveLength(4);
    }
  });

  test('177 Decline Close-Grip Bench To Skull Crusher secures the legs on a decline bench and alternates one close-grip press to the lower chest with one stationary-upper-arm skull crusher toward the forehead', () => {
    // Quotes:
    // "Secure the legs on a decline bench, lie back and hold the bar over the chest with a grip slightly narrower than shoulder width and the arms straight. Lower the bar to the lower chest with the elbows in and press it back up. Then, keeping the upper arms still, bend the elbows to lower the bar toward the forehead and straighten them again. Alternate one press and one extension for the set."
    // "Elbows in on the press. Upper arms still on the extension. Lower slowly each time."
    const e = entryFor(177);
    const slug = slugOf(e);
    const pressBottom = rig.chainGeometry(slug, 0, BODY);
    const lockout = rig.chainGeometry(slug, 1, BODY);
    const skullBottom = rig.chainGeometry(slug, 2, BODY);
    const equipment = rig.CHAIN_MOVEMENTS[slug].equipment;
    const pad = equipment.find((s) => s.kind === 'slab');
    const roller = equipment.find((s) => s.kind === 'roller');

    expect(lockout.movement.implement).toBe('bar');
    expect(pad).toBeDefined();
    expect(roller).toBeDefined();
    // Decline bench and ankle roller contact
    expect(direction2D(lockout.world.neck, lockout.world.hip)).toBeCloseTo(rig.DECLINE_EXTENSION_DEG, 6);
    expect(offPad(pad, lockout.world.hip) - 2).toBeCloseTo(BACK_HALF, 5);
    expect(offPad(pad, lockout.world.neck) - 2).toBeCloseTo(BACK_HALF, 5);
    expect(roller.at[0]).toBeGreaterThan(lockout.world.near.ankle[0]);
    expect(Math.hypot(roller.at[0] - lockout.world.near.ankle[0], roller.at[1] - lockout.world.near.ankle[1])).toBeLessThanOrEqual((BODY.lw * 0.9) / 2 + 2.6 + 1);

    // Close grip slightly narrower than shoulder width, straight arms at lockout (ph = 1)
    const gripSpan = dist(lockout.world.near.wrist, lockout.world.far.wrist);
    expect(gripSpan).toBeGreaterThanOrEqual(12);
    expect(gripSpan).toBeLessThan(2 * BODY.sw * 0.92 - 2);
    expect(deg3D(lockout.world.near.shoulder, lockout.world.near.elbow, lockout.world.near.wrist)).toBeGreaterThanOrEqual(172);

    // Press bottom (ph = 0): elbows move down and back beside the torso to lower the bar to the lower chest
    expect(dist(pressBottom.world.near.elbow, lockout.world.near.elbow)).toBeGreaterThan(10);
    expect(pressBottom.world.near.hold[0]).toBeGreaterThan(lockout.world.near.hold[0] + 6);
    expect(pressBottom.world.near.hold[1]).toBeLessThan(lockout.world.near.hold[1] - 12);

    // Skull crusher bottom (ph = 2): upper arms stay frozen while the bar lowers toward the forehead
    expect(dist(skullBottom.world.near.elbow, lockout.world.near.elbow)).toBeLessThan(0.01);
    expect(skullBottom.world.near.hold[0]).toBeLessThan(lockout.world.near.hold[0] - 5);
    expect(skullBottom.world.near.hold[1]).toBeLessThan(lockout.world.near.hold[1] - 18);
    const fh = forehead(skullBottom.world);
    expect(Math.hypot(skullBottom.world.near.wrist[0] - fh[0], skullBottom.world.near.wrist[1] - fh[1])).toBeLessThanOrEqual(6.0);

    // Alternates one press (1 -> 0 -> 1) and one extension (1 -> 2 -> 1), with slower lowering on both and stationary upper arms throughout the extension half
    const poses = e.frames.map((f) => f.joints);
    const ds = e.segmentDurationsMs;
    expect(poses.map((j) => j.ph)).toEqual([1, 0, 1, 2, 1]);
    expect(ds[0]).toBeGreaterThanOrEqual(1.35 * ds[1]);
    expect(ds[2]).toBeGreaterThanOrEqual(1.35 * ds[3]);
    const extStartMs = ds[0] + ds[1];
    for (const t of ticksOf(e)) {
      if (t >= extStartMs) {
        const p = rig.poseAtTime(poses, t, ds);
        const g = rig.chainGeometry(slug, p.ph, BODY);
        expect(dist(g.world.near.elbow, lockout.world.near.elbow)).toBeLessThan(0.01);
        expect(dist(g.world.far.elbow, lockout.world.far.elbow)).toBeLessThan(0.01);
      }
    }
  });

  test('47 Dip supports the body on parallel bars with straight arms, lowers until the upper arms are parallel to the floor, and presses back up to straight arms', () => {
    // Quotes:
    // "Support yourself on parallel bars with arms straight. Bend your elbows and lower your body until your upper arms are about parallel to the floor. Press back up to straight arms. Lean slightly forward for more chest, stay upright for more triceps."
    // "Shoulders down, away from the ears. Lower to a stretch you can press out of. Lock out tall, shoulders packed."
    const e = entryFor(47);
    const slug = slugOf(e);
    const top = rig.chainGeometry(slug, 0, BODY);
    const bottom = rig.chainGeometry(slug, 1, BODY);
    const bars = rig.CHAIN_MOVEMENTS[slug].equipment.filter((s) => s.kind === 'slab');

    // Two parallel bars at the hands' Z coordinates and height
    expect(bars.length).toBeGreaterThanOrEqual(2);
    const barTop = bars[0].a[1] + 2;
    expect(Math.abs((top.world.near.wrist[1] - HAND_HALF) - barTop)).toBeLessThanOrEqual(0.5);

    // Top lockout has straight arms (>= 172 deg) and shoulders packed down
    expect(deg3D(top.world.near.shoulder, top.world.near.elbow, top.world.near.wrist)).toBeGreaterThanOrEqual(172);
    expect(deg3D(top.world.far.shoulder, top.world.far.elbow, top.world.far.wrist)).toBeGreaterThanOrEqual(172);

    // Bottom has upper arms parallel to the floor (within 2 deg of horizontal) and body lowered
    expect(top.world.hip[1] - bottom.world.hip[1]).toBeGreaterThanOrEqual(10);
    expect(Math.abs(bottom.world.near.shoulder[1] - bottom.world.near.elbow[1])).toBeLessThanOrEqual(0.5);
    expect(deg3D(bottom.world.near.shoulder, bottom.world.near.elbow, bottom.world.near.wrist)).toBeLessThanOrEqual(100);

    // Hands stay planted on the bars and feet stay suspended off the floor across every 33 ms tick
    const poses = e.frames.map((f) => f.joints);
    const ds = e.segmentDurationsMs;
    expect(poses.map((j) => j.ph)).toEqual([0, 0.5, 1, 0.5, 0]);
    for (const t of ticksOf(e)) {
      const p = rig.poseAtTime(poses, t, ds);
      const g = rig.chainGeometry(slug, p.ph, BODY);
      expect(dist(g.world.near.wrist, top.world.near.wrist)).toBeLessThan(0.01);
      expect(dist(g.world.far.wrist, top.world.far.wrist)).toBeLessThan(0.01);
      expect(g.world.near.ankle[1]).toBeGreaterThan(10);
      expect(g.world.near.toe[1]).toBeGreaterThan(8);
      // Only the hands hold the body up, so its centre of mass (head, trunk, arms
      // and legs) stays within 2 units of them fore and aft: a trunk that leans
      // forward is balanced by the hips and legs swinging back
      expect(Math.abs(systemComX(g.world, 0) - g.world.near.wrist[0])).toBeLessThanOrEqual(2.0);
    }
  });

  test('170 Close-Grip Push-Up off of a Dumbbell places both hands on top of an end-standing dumbbell with a rigid straight body line, lowers the chest with elbows close to the ribs, and presses back to straight arms', () => {
    // Quotes:
    // "Stand a dumbbell on its end, place both hands on the top of it and set a push-up position on the toes with the arms straight and the body rigid. Bend the elbows, keeping them close to the body, to lower the chest toward the hands. Press back up until the arms are straight."
    // "Elbows brush the ribs. Hips level with the shoulders. Press the dumbbell into the floor."
    const e = entryFor(170);
    const slug = slugOf(e);
    const top = rig.chainGeometry(slug, 0, BODY);
    const bottom = rig.chainGeometry(slug, 1, BODY);
    const equipment = rig.CHAIN_MOVEMENTS[slug].equipment;
    const slabs = equipment.filter((s) => s.kind === 'slab');
    const shaft = equipment.find((s) => s.kind === 'box');

    // End-standing dumbbell on the floor under both hands
    expect(slabs.length).toBeGreaterThanOrEqual(2);
    expect(shaft).toBeDefined();
    const topPlate = slabs.reduce((hi, s) => (s.a[1] > hi.a[1] ? s : hi), slabs[0]);
    const dbTopY = topPlate.a[1] + 2;
    const dbCenterX = (topPlate.a[0] + topPlate.b[0]) / 2;

    // Close grip on top of the standing dumbbell, straight arms at top
    expect(dist(top.world.near.wrist, top.world.far.wrist)).toBeLessThanOrEqual(5.0);
    expect(Math.abs(top.world.near.wrist[0] - dbCenterX)).toBeLessThanOrEqual(2.0);
    expect(Math.abs((top.world.near.wrist[1] - HAND_HALF) - dbTopY)).toBeLessThanOrEqual(0.5);
    expect(deg3D(top.world.near.shoulder, top.world.near.elbow, top.world.near.wrist)).toBeGreaterThanOrEqual(172);
    expect(deg3D(top.world.far.shoulder, top.world.far.elbow, top.world.far.wrist)).toBeGreaterThanOrEqual(172);

    // Bottom lowers the chest toward the hands with elbows close to the body
    expect(top.world.neck[1] - bottom.world.neck[1]).toBeGreaterThanOrEqual(10);
    expect(deg3D(bottom.world.near.shoulder, bottom.world.near.elbow, bottom.world.near.wrist)).toBeLessThanOrEqual(105);
    expect(Math.abs(bottom.world.near.elbow[2])).toBeLessThanOrEqual(BODY.sw * 0.92 + 1.5);

    // Rigid straight body line from ankles through knees and hips to neck on every 33 ms tick, hands and toes stationary
    const poses = e.frames.map((f) => f.joints);
    const ds = e.segmentDurationsMs;
    expect(poses.map((j) => j.ph)).toEqual([0, 0.5, 1, 0.5, 0]);
    for (const t of ticksOf(e)) {
      const p = rig.poseAtTime(poses, t, ds);
      const g = rig.chainGeometry(slug, p.ph, BODY);
      expect(deg3D(g.world.near.ankle, g.world.near.knee, g.world.near.hipJoint)).toBeGreaterThanOrEqual(176);
      const spineFromNearHip = [
        g.world.near.hipJoint[0] + (g.world.neck[0] - g.world.hip[0]),
        g.world.near.hipJoint[1] + (g.world.neck[1] - g.world.hip[1]),
        g.world.near.hipJoint[2] + (g.world.neck[2] - g.world.hip[2]),
      ];
      expect(deg3D(g.world.near.knee, g.world.near.hipJoint, spineFromNearHip)).toBeGreaterThanOrEqual(176);
      expect(dist(g.world.near.wrist, top.world.near.wrist)).toBeLessThan(0.01);
      expect(dist(g.world.far.wrist, top.world.far.wrist)).toBeLessThan(0.01);
      expect(dist(g.world.near.toe, top.world.near.toe)).toBeLessThan(0.01);
    }
  });

  test('166 Clock Push-Up keeps the body in one straight line, lowers the chest, pushes up fast so both hands leave the floor, lands a short step to one side turning the body slightly with soft elbows, and resets to straight arms', () => {
    // Quotes:
    // "Start in a push-up position with the hands about shoulder-width apart and the body in a straight line. Lower the chest toward the floor, then push up fast enough for the hands to leave the floor and land a short step to one side, turning the body slightly. Land with soft elbows, reset the straight body line and repeat, working around the circle until you are back where you started."
    // "Body in one straight line. Push the floor away fast. Land softly with bent elbows."
    const e = entryFor(166);
    const slug = slugOf(e);
    const start = rig.chainGeometry(slug, 0, BODY);
    const bottom = rig.chainGeometry(slug, 1, BODY);
    const flight = rig.chainGeometry(slug, 2, BODY);
    const land = rig.chainGeometry(slug, 3, BODY);
    const reset = rig.chainGeometry(slug, 4, BODY);

    // Start (ph = 0): hands on the floor about shoulder-width apart, straight arms
    const gripSpan = dist(start.world.near.wrist, start.world.far.wrist);
    expect(gripSpan).toBeGreaterThanOrEqual(15);
    expect(gripSpan).toBeLessThanOrEqual(23);
    expect(start.world.near.wrist[1]).toBeLessThanOrEqual(2.5);
    expect(deg3D(start.world.near.shoulder, start.world.near.elbow, start.world.near.wrist)).toBeGreaterThanOrEqual(172);

    // Bottom (ph = 1): chest lowered toward the floor, hands still on the floor
    expect(start.world.neck[1] - bottom.world.neck[1]).toBeGreaterThanOrEqual(8);
    expect(deg3D(bottom.world.near.shoulder, bottom.world.near.elbow, bottom.world.near.wrist)).toBeLessThanOrEqual(105);
    expect(bottom.world.near.wrist[1]).toBeLessThanOrEqual(2.5);

    // Flight (ph = 2): push up fast enough for both hands to leave the floor,
    // high enough to read as a flight (7.5 units, about 15 cm, clear of the floor)
    expect(flight.world.near.wrist[1]).toBeGreaterThan(start.world.near.wrist[1] + 7.5);
    expect(flight.world.far.wrist[1]).toBeGreaterThan(start.world.far.wrist[1] + 7.5);

    // The hop goes one way round: the body's turn never runs backward from the
    // start to the reset, there is exactly one flight in the loop (the loop
    // closes with a reset on the floor, not a hop back), and no caption sends
    // the athlete back the way they came
    const yawOf = (g) => (Math.atan2(g.world.neck[2] - g.world.hip[2], g.world.neck[0] - g.world.hip[0]) * 180) / Math.PI;
    const resetMs = e.segmentDurationsMs.slice(0, 4).reduce((a, b) => a + b, 0);
    let prevYaw = -Infinity, flights = 0, airborne = false;
    for (const t of ticksOf(e)) {
      const g = rig.chainGeometry(slug, rig.poseAtTime(e.frames.map((f) => f.joints), t, e.segmentDurationsMs).ph, BODY);
      if (t <= resetMs) {
        expect(yawOf(g)).toBeGreaterThanOrEqual(prevYaw - 1e-6);
        prevYaw = yawOf(g);
      }
      const off = g.world.near.wrist[1] > 2.5 && g.world.far.wrist[1] > 2.5;
      if (off && !airborne) flights += 1;
      airborne = off;
    }
    expect(flights).toBe(1);
    for (const frame of e.frames) expect(frame.caption).not.toMatch(/travel back|hop back|go back|way it came/i);

    // Soft landing (ph = 3): hands land a short step to one side, turning the body slightly, with soft bent elbows
    expect(land.world.near.wrist[1]).toBeLessThanOrEqual(2.5);
    expect(dist(land.world.near.wrist, start.world.near.wrist)).toBeGreaterThanOrEqual(6);
    const startYaw = (Math.atan2(start.world.neck[2] - start.world.hip[2], start.world.neck[0] - start.world.hip[0]) * 180) / Math.PI;
    const landYaw = (Math.atan2(land.world.neck[2] - land.world.hip[2], land.world.neck[0] - land.world.hip[0]) * 180) / Math.PI;
    expect(Math.abs(landYaw - startYaw)).toBeGreaterThanOrEqual(12);
    const landElbow = deg3D(land.world.near.shoulder, land.world.near.elbow, land.world.near.wrist);
    expect(landElbow).toBeGreaterThanOrEqual(115);
    expect(landElbow).toBeLessThanOrEqual(158);

    // Reset (ph = 4): resets to straight arms at the stepped clock position
    expect(deg3D(reset.world.near.shoulder, reset.world.near.elbow, reset.world.near.wrist)).toBeGreaterThanOrEqual(172);
    expect(Math.abs(reset.world.near.wrist[2] - land.world.near.wrist[2])).toBeLessThan(0.5);

    // Straight body line on every 33 ms tick, and fast explosive push-up (ds[1] < ds[0])
    const poses = e.frames.map((f) => f.joints);
    const ds = e.segmentDurationsMs;
    expect(ds[1]).toBeLessThanOrEqual(400);
    expect(ds[0]).toBeGreaterThanOrEqual(1.4 * ds[1]);
    for (const t of ticksOf(e)) {
      const p = rig.poseAtTime(poses, t, ds);
      const g = rig.chainGeometry(slug, p.ph, BODY);
      expect(deg3D(g.world.near.ankle, g.world.near.knee, g.world.near.hipJoint)).toBeGreaterThanOrEqual(175);
      const spineFromNearHip = [
        g.world.near.hipJoint[0] + (g.world.neck[0] - g.world.hip[0]),
        g.world.near.hipJoint[1] + (g.world.neck[1] - g.world.hip[1]),
        g.world.near.hipJoint[2] + (g.world.neck[2] - g.world.hip[2]),
      ];
      expect(deg3D(g.world.near.knee, g.world.near.hipJoint, spineFromNearHip)).toBeGreaterThanOrEqual(175);
    }
  });
});
