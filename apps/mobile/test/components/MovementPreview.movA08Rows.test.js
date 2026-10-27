/**
 * MOV-A08: bent-over rows (5, 104, 107, 293, 79, 130).
 *
 * Tests at every 33 ms tick:
 * - Torso angle constant within a stated bound (0.1 deg) across the entire cycle.
 * - Load under the shoulder at the bottom (straight arms >= 172 deg hanging plumb).
 * - Elbow travelling behind the trunk at the top of each pull.
 * - Movement-specific setup, grip, implement, and floor/floating constraints.
 */
import * as rig from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = rig.CANONICAL_BODY_PARAMETERS;
const FLOOR = 96.9;

const entryById = (id) => {
  const e = previewManifest.entries.find((x) => x.movementId === id);
  if (!e) throw new Error(`Missing manifest entry for movementId ${id}`);
  return e;
};

const slugOf = (e) => e.assetKey.split('/')[1];

const dist3D = (a, b) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const deg3D = (a, b, c) => {
  const ux = a[0] - b[0];
  const uy = a[1] - b[1];
  const uz = a[2] - b[2];
  const vx = c[0] - b[0];
  const vy = c[1] - b[1];
  const vz = c[2] - b[2];
  const du = Math.hypot(ux, uy, uz);
  const dv = Math.hypot(vx, vy, vz);
  if (du === 0 || dv === 0) return 180;
  const cos = Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / (du * dv)));
  return (Math.acos(cos) * 180) / Math.PI;
};

const trunkDegOf = (g) => (Array.isArray(g.angles.trunk) ? g.angles.trunk[0] : g.angles.trunk);

const behindTrunkDist = (pt, hip, trunk) => {
  const trunkDeg = Array.isArray(trunk) ? trunk[0] : trunk;
  const r = (trunkDeg * Math.PI) / 180;
  return (pt[0] - hip[0]) * -Math.sin(r) + (pt[1] - hip[1]) * Math.cos(r);
};

const ticksOf = (entry) => {
  const total = entry.segmentDurationsMs.reduce((a, b) => a + b, 0);
  const out = [];
  for (let t = 0; t <= total; t += 33) out.push(t);
  if (out[out.length - 1] !== total) out.push(total);
  return out;
};

const MOV_A08_IDS = [5, 104, 107, 293, 79, 130];

// MOV-S1-R3: balance and contact against the painted body.
// The foot is painted from the ankle to the toe with round ends of the foot's
// half-width (BODY.lw * 0.9 / 2), so it reaches that far behind the ankle and
// beyond the toe. The centre of mass uses the segment weights of the hinge
// tests (MOV-A04): body only, or body plus a held load at the hands.
const FOOT_CAP = (BODY.lw * 0.9) / 2;
const CHEST_HALF = BODY.sw * 0.58;
const THIGH_HALF = (BODY.lw * 1.18) / 2;
const SHIN_HALF = (BODY.lw * 0.9) / 2;
const HAND_RADIUS = BODY.lw * 0.44 + 0.1;
const midX = (a, b) => (a[0] + b[0]) / 2;
const comX = (g, load = 0, loadX = 0) => {
  const w = g.world;
  const bodyX =
    0.029 * midX(w.near.ankle, w.near.toe) +
    0.093 * midX(w.near.ankle, w.near.knee) +
    0.2 * midX(w.near.knee, w.near.hipJoint) +
    0.497 * midX(w.hip, w.neck) +
    0.081 * midX(w.neck, w.head) +
    0.056 * midX(w.near.shoulder, w.near.elbow) +
    0.044 * midX(w.near.elbow, w.near.wrist);
  return (bodyX + load * loadX) / (1 + load);
};
const footSpan = (g) => [
  Math.min(g.world.near.ankle[0], g.world.far.ankle[0]) - FOOT_CAP,
  Math.max(g.world.near.toe[0], g.world.far.toe[0]) + FOOT_CAP,
];
const expectOverPaintedFoot = (g, x) => {
  const [back, front] = footSpan(g);
  expect(x).toBeGreaterThanOrEqual(back);
  expect(x).toBeLessThanOrEqual(front);
};
const pointToSegment = (p, a, b) => {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2)));
  return dist3D(p, [a[0] + t * ab[0], a[1] + t * ab[1], a[2] + t * ab[2]]);
};
// Bar over the mid-foot at the bottom, and the loaded centre of mass over the painted foot at every tick.
const expectLoadedBalance = (id, load) => {
  const entry = entryById(id);
  const slug = slugOf(entry);
  const poses = entry.frames.map((f) => f.joints);
  for (const t of ticksOf(entry)) {
    const g = rig.chainGeometry(slug, rig.poseAtTime(poses, t, entry.segmentDurationsMs).ph ?? 0, BODY);
    const barX = (g.world.near.hold[0] + g.world.far.hold[0]) / 2;
    expectOverPaintedFoot(g, comX(g, load, barX));
  }
  const g0 = rig.chainGeometry(slug, 0, BODY);
  const bar0 = (g0.world.near.hold[0] + g0.world.far.hold[0]) / 2;
  expect(bar0).toBeGreaterThanOrEqual(g0.world.near.ankle[0]);
  expect(bar0).toBeLessThanOrEqual(g0.world.near.toe[0]);
  expect(Math.abs(bar0 - midX(g0.world.near.ankle, g0.world.near.toe))).toBeLessThanOrEqual(1.0);
};

describe('MOV-A08 bent-over rows invariants across every 33 ms tick', () => {
  test.each(MOV_A08_IDS)(
    'movement %i holds a constant torso angle (within 0.1 deg) across every 33 ms tick',
    (id) => {
      const entry = entryById(id);
      const slug = slugOf(entry);
      const ds = entry.segmentDurationsMs;
      const poses = entry.frames.map((f) => f.joints);
      const ticks = ticksOf(entry);

      const g0 = rig.chainGeometry(slug, rig.poseAtTime(poses, 0, ds).ph ?? 0, BODY);
      const startTrunk = trunkDegOf(g0);
      const startSpineDeg =
        (Math.atan2(g0.world.neck[1] - g0.world.hip[1], g0.world.neck[0] - g0.world.hip[0]) * 180) /
        Math.PI;

      for (const t of ticks) {
        const pt = rig.poseAtTime(poses, t, ds);
        const gt = rig.chainGeometry(slug, pt.ph ?? 0, BODY);
        const spineDeg =
          (Math.atan2(gt.world.neck[1] - gt.world.hip[1], gt.world.neck[0] - gt.world.hip[0]) * 180) /
          Math.PI;
        expect(Math.abs(trunkDegOf(gt) - startTrunk)).toBeLessThanOrEqual(0.1);
        expect(Math.abs(spineDeg - startSpineDeg)).toBeLessThanOrEqual(0.1);
      }
    },
  );

  test('5 Barbell Row: hinged over soft knees, bar hangs plumb under shoulders in straight arms (>= 172 deg), elbows drive behind trunk at top', () => {
    const entry = entryById(5);
    const slug = slugOf(entry);
    const g0 = rig.chainGeometry(slug, 0, BODY);
    const g1 = rig.chainGeometry(slug, 1, BODY);

    // Hinged torso and soft knees. The text sets no angle ("hinge until the torso is stable"): a hinge lies between
    // level and upright, and here the angle is what lets the bar hang over the mid-foot in balance (MOV-S1-R3).
    expect(trunkDegOf(g0)).toBeGreaterThanOrEqual(15);
    expect(trunkDegOf(g0)).toBeLessThanOrEqual(60);
    const kneeDeg = deg3D(g0.world.near.hipJoint, g0.world.near.knee, g0.world.near.ankle);
    expect(kneeDeg).toBeGreaterThanOrEqual(140);
    expect(kneeDeg).toBeLessThanOrEqual(165);

    // Hands hold bar just outside the legs, plumb beneath shoulders, straight arms >= 172 deg.
    expect(g0.world.near.hold[2]).toBeGreaterThan(g0.world.near.ankle[2] + 3);
    expect(Math.abs(g0.world.near.hold[0] - g0.world.near.shoulder[0])).toBeLessThanOrEqual(0.5);
    expect(Math.abs(g0.world.far.hold[0] - g0.world.far.shoulder[0])).toBeLessThanOrEqual(0.5);
    expect(deg3D(g0.world.near.shoulder, g0.world.near.elbow, g0.world.near.hold)).toBeGreaterThanOrEqual(172);
    expect(deg3D(g0.world.far.shoulder, g0.world.far.elbow, g0.world.far.hold)).toBeGreaterThanOrEqual(172);

    // Top of row: elbows travel behind the trunk and bar reaches lower ribs.
    expect(behindTrunkDist(g1.world.near.elbow, g1.world.hip, g1.angles.trunk)).toBeGreaterThanOrEqual(3.0);
    expect(behindTrunkDist(g1.world.far.elbow, g1.world.hip, g1.angles.trunk)).toBeGreaterThanOrEqual(3.0);
    expect(g1.world.near.elbow[0]).toBeLessThan(g1.world.near.shoulder[0] - 8);
    expect(deg3D(g1.world.near.shoulder, g1.world.near.elbow, g1.world.near.hold)).toBeLessThanOrEqual(105);

    // MOV-S1-R3: a loaded row keeps the bar over the mid-foot; with a bar of half the body's mass the centre of
    // mass stays over the painted foot at every tick.
    expectLoadedBalance(5, 0.5);
  });

  test('104 One-Arm Kettlebell Row: staggered stance, square torso/hips, scapular reach at bottom with straight plumb arm (>= 172 deg), elbow past ribs toward back pocket at top', () => {
    const entry = entryById(104);
    const slug = slugOf(entry);
    const g0 = rig.chainGeometry(slug, 0, BODY);
    const g1 = rig.chainGeometry(slug, 1, BODY);

    // Staggered stance and square torso/hips.
    expect(Math.abs(g0.world.near.ankle[0] - g0.world.far.ankle[0])).toBeGreaterThanOrEqual(18);
    expect(g0.angles.twist).toBe(0);
    expect(g1.angles.twist).toBe(0);
    expect(g0.angles.roll).toBe(0);
    expect(g1.angles.roll).toBe(0);

    // Bottom: shoulder blade reaches downward while bell hangs plumb in a straight arm >= 172 deg.
    expect(g0.world.near.shoulder[1]).toBeLessThan(g1.world.near.shoulder[1] - 1.5);
    expect(Math.abs(g0.world.near.hold[0] - g0.world.near.shoulder[0])).toBeLessThanOrEqual(0.5);
    expect(deg3D(g0.world.near.shoulder, g0.world.near.elbow, g0.world.near.hold)).toBeGreaterThanOrEqual(172);

    // Top: bell rowed back toward the back pocket (closer to hip than Barbell Row) and elbow past the ribs behind the trunk.
    const gBar1 = rig.chainGeometry('barbell-row', 1, BODY);
    expect(g1.world.near.hold[0] - g1.world.hip[0]).toBeLessThan(
      gBar1.world.near.hold[0] - gBar1.world.hip[0] - 3,
    );
    expect(behindTrunkDist(g1.world.near.elbow, g1.world.hip, g1.angles.trunk)).toBeGreaterThanOrEqual(3.0);
    expect(g1.world.near.elbow[0]).toBeLessThan(g1.world.near.shoulder[0] - 8);

    // MOV-S1-R3: the free hand rests on the far thigh's painted surface at every tick, not inside it.
    const poses104 = entry.frames.map((f) => f.joints);
    for (const t of ticksOf(entry)) {
      const g = rig.chainGeometry(slug, rig.poseAtTime(poses104, t, entry.segmentDurationsMs).ph ?? 0, BODY);
      const d = pointToSegment(g.world.far.wrist, g.world.far.hipJoint, g.world.far.knee);
      expect(Math.abs(d - (THIGH_HALF + HAND_RADIUS))).toBeLessThanOrEqual(0.05);
    }
  });

  test('107 Reverse Grip Bent-Over Rows: underhand grip just outside thighs with close-up panel, top hold, straight plumb arms at bottom, differs visibly from Barbell Row', () => {
    const entry = entryById(107);
    const barEntry = entryById(5);
    const slug = slugOf(entry);
    const g0 = rig.chainGeometry(slug, 0, BODY);
    const g1 = rig.chainGeometry(slug, 1, BODY);

    // Grip just outside thighs, narrower than Barbell Row.
    expect(g0.world.near.hold[2]).toBeGreaterThan(g0.world.near.hipJoint[2] + 2);
    expect(g0.world.near.hold[2]).toBeLessThan(
      rig.chainGeometry('barbell-row', 0, BODY).world.near.hold[2] - 1,
    );

    // Plumb straight arms at bottom (>= 172 deg) and elbows driven behind trunk at top.
    expect(Math.abs(g0.world.near.hold[0] - g0.world.near.shoulder[0])).toBeLessThanOrEqual(0.5);
    expect(Math.abs(g0.world.far.hold[0] - g0.world.far.shoulder[0])).toBeLessThanOrEqual(0.5);
    expect(deg3D(g0.world.near.shoulder, g0.world.near.elbow, g0.world.near.hold)).toBeGreaterThanOrEqual(172);
    expect(deg3D(g0.world.far.shoulder, g0.world.far.elbow, g0.world.far.hold)).toBeGreaterThanOrEqual(172);
    expect(behindTrunkDist(g1.world.near.elbow, g1.world.hip, g1.angles.trunk)).toBeGreaterThanOrEqual(3.0);
    expect(behindTrunkDist(g1.world.far.elbow, g1.world.hip, g1.angles.trunk)).toBeGreaterThanOrEqual(3.0);

    // Hold at the top is longer than Barbell Row's top transition.
    expect(entry.segmentDurationsMs[1]).toBeGreaterThanOrEqual(700);
    expect(entry.segmentDurationsMs[1]).toBeGreaterThan(barEntry.segmentDurationsMs[1]);

    // Close-up panel shows the closed palms-up (underhand) grip wrapped around the bar.
    const panel = rig.handCloseUp(g0);
    expect(panel).not.toBeNull();
    expect(panel.open).toBe(0);

    const prims107 = rig.layoutCanonicalFigure(entry.frames[0].joints, { ...entry, body: BODY });
    const prims5 = rig.layoutCanonicalFigure(barEntry.frames[0].joints, { ...barEntry, body: BODY });
    expect(JSON.stringify(prims107)).not.toBe(JSON.stringify(prims5));

    // MOV-S1-R3: the first caption says what the text says, the bar hangs straight below the shoulders over the
    // mid-foot, the loaded centre of mass stays over the foot, and the bar touches the lower ribs at the top
    // ("Touch the lower ribs").
    expect(entry.frames[0].caption).toBe(
      'Take an underhand grip just outside the thighs, soften the knees, and hinge until the bar hangs below them with the torso braced.',
    );
    expectLoadedBalance(107, 0.5);
    const barTop = [(g1.world.near.hold[0] + g1.world.far.hold[0]) / 2, (g1.world.near.hold[1] + g1.world.far.hold[1]) / 2];
    expect(Math.abs(-behindTrunkDist(barTop, g1.world.hip, g1.angles.trunk) - (CHEST_HALF + 0.8))).toBeLessThanOrEqual(0.1);
  });

  test('293 Two-Arm Kettlebell Row: standing over two bells, hips back, straight plumb arms at bottom (>= 172 deg), both pulled together toward stomach with elbows behind trunk', () => {
    const entry = entryById(293);
    const slug = slugOf(entry);
    const g0 = rig.chainGeometry(slug, 0, BODY);
    const g1 = rig.chainGeometry(slug, 1, BODY);

    // Standing over two bells with hips back and knees slightly bent.
    expect(g0.world.hip[0]).toBeLessThan(g0.world.near.ankle[0] - 12);
    expect(g0.world.near.hold[0]).toBeGreaterThanOrEqual(g0.world.near.ankle[0] - 1);
    expect(g0.world.near.hold[0]).toBeLessThanOrEqual(g0.world.near.toe[0] + 2);

    // Straight plumb arms at bottom (>= 172 deg).
    expect(Math.abs(g0.world.near.hold[0] - g0.world.near.shoulder[0])).toBeLessThanOrEqual(0.5);
    expect(Math.abs(g0.world.far.hold[0] - g0.world.far.shoulder[0])).toBeLessThanOrEqual(0.5);
    expect(deg3D(g0.world.near.shoulder, g0.world.near.elbow, g0.world.near.hold)).toBeGreaterThanOrEqual(172);
    expect(deg3D(g0.world.far.shoulder, g0.world.far.elbow, g0.world.far.hold)).toBeGreaterThanOrEqual(172);

    // Both pulled together toward stomach at top, elbows behind trunk.
    expect(Math.abs(g1.world.near.hold[0] - g1.world.far.hold[0])).toBeLessThan(1e-6);
    expect(Math.abs(g1.world.near.hold[1] - g1.world.far.hold[1])).toBeLessThan(1e-6);
    expect(behindTrunkDist(g1.world.near.elbow, g1.world.hip, g1.angles.trunk)).toBeGreaterThanOrEqual(3.0);
    expect(behindTrunkDist(g1.world.far.elbow, g1.world.hip, g1.angles.trunk)).toBeGreaterThanOrEqual(3.0);

    // Lowered under control.
    expect(entry.segmentDurationsMs[2]).toBeGreaterThan(entry.segmentDurationsMs[0]);
  });

  test('79 T-Bar Row: straddling anchored landmine bar, 45 deg hinge, neutral grip, plates off floor at bottom in straight plumb arms (>= 172 deg), pulled to chest with elbows behind trunk', () => {
    const entry = entryById(79);
    const slug = slugOf(entry);
    const g0 = rig.chainGeometry(slug, 0, BODY);
    const g1 = rig.chainGeometry(slug, 1, BODY);

    // Hinge about 45 degrees and straddling the bar (z = 0).
    expect(trunkDegOf(g0)).toBe(45);
    expect(trunkDegOf(g1)).toBe(45);
    expect(g0.world.near.ankle[2]).toBeGreaterThan(9);
    expect(g0.world.far.ankle[2]).toBeLessThan(-9);

    // Neutral grip on handle, rigid across ticks.
    expect(g0.world.near.hold[2]).toBeCloseTo(3.2, 5);
    expect(g0.world.far.hold[2]).toBeCloseTo(-3.2, 5);
    expect(dist3D(g0.world.near.wrist, g0.world.far.wrist)).toBeCloseTo(6.4, 5);
    expect(dist3D(g1.world.near.wrist, g1.world.far.wrist)).toBeCloseTo(6.4, 5);

    // Bottom stretch: plumb under shoulders, straight arms >= 172 deg, plates floating off floor.
    expect(Math.abs(g0.world.near.hold[0] - g0.world.near.shoulder[0])).toBeLessThanOrEqual(0.5);
    expect(Math.abs(g0.world.far.hold[0] - g0.world.far.shoulder[0])).toBeLessThanOrEqual(0.5);
    expect(deg3D(g0.world.near.shoulder, g0.world.near.elbow, g0.world.near.hold)).toBeGreaterThanOrEqual(172);
    expect(deg3D(g0.world.far.shoulder, g0.world.far.elbow, g0.world.far.hold)).toBeGreaterThanOrEqual(172);

    const prims0 = rig.layoutCanonicalFigure(entry.frames[0].joints, { ...entry, body: BODY });
    const plates0 = prims0.filter((p) => p.kind === 'bone' && p.w === 2.4 && p.stroke === 'ink1');
    expect(plates0.length).toBeGreaterThanOrEqual(2);
    for (const plate of plates0) {
      const bottom = Math.max(plate.y1, plate.y2) + plate.w / 2;
      expect(bottom).toBeLessThan(FLOOR - 15);
    }

    // Anchored bar and its landmine pivot are drawn, and handle stays on a constant radius from anchor.
    expect(g0.movement.barAnchor).toBeDefined();
    const anchor = g0.movement.barAnchor;
    const r0 = Math.hypot(g0.world.near.hold[0] - anchor[0], g0.world.near.hold[1] - anchor[1]);
    const r1 = Math.hypot(g1.world.near.hold[0] - anchor[0], g1.world.near.hold[1] - anchor[1]);
    expect(Math.abs(r1 - r0)).toBeLessThan(0.1);

    // Top: pulled to chest, elbows up and back behind trunk.
    expect(behindTrunkDist(g1.world.near.elbow, g1.world.hip, g1.angles.trunk)).toBeGreaterThanOrEqual(3.0);
    expect(behindTrunkDist(g1.world.far.elbow, g1.world.hip, g1.angles.trunk)).toBeGreaterThanOrEqual(3.0);

    // MOV-S1-R3: the handle and the plate hubs stop at the chest's painted surface at the top, not inside it.
    // The bar lies in the plane z = 0, so a painted point on it maps back to the world exactly.
    const yaw = (g1.movement.yawDeg * Math.PI) / 180;
    const toWorld = (q) => [(q[0] - g1.movement.originX) / Math.cos(yaw), FLOOR - q[1]];
    const handle = [(g1.world.near.hold[0] + g1.world.far.hold[0]) / 2, (g1.world.near.hold[1] + g1.world.far.hold[1]) / 2];
    const below = (q) => -behindTrunkDist(q, g1.world.hip, g1.angles.trunk);
    expect(below(handle)).toBeGreaterThanOrEqual(CHEST_HALF + 0.9);
    expect(below(handle)).toBeLessThanOrEqual(CHEST_HALF + 0.9 + 0.3);
    const prims1 = rig.layoutCanonicalFigure({ ...entry.frames[1].joints, ph: 1 }, { ...entry, body: BODY });
    const plates1 = prims1.filter((p) => p.kind === 'bone' && p.w === 2.4 && p.stroke === 'ink1');
    expect(plates1.length).toBeGreaterThanOrEqual(2);
    for (const plate of plates1) {
      const hub = toWorld([(plate.x1 + plate.x2) / 2, (plate.y1 + plate.y2) / 2]);
      expect(below(hub)).toBeGreaterThanOrEqual(CHEST_HALF + 1.2);
    }

    // The neutral grip is shown in a close-up of the near hand: the handle runs across the fist, square to the
    // forearm, instead of being seen end on.
    const panel = rig.handCloseUp(g0);
    expect(panel).not.toBeNull();
    expect(panel.grip).toBe('neutral');
    const fore = [g0.joints.wr[0] - g0.joints.el[0], g0.joints.wr[1] - g0.joints.el[1]];
    const handleDir = [panel.handle[1][0] - panel.handle[0][0], panel.handle[1][1] - panel.handle[0][1]];
    const cos = Math.abs(fore[0] * handleDir[0] + fore[1] * handleDir[1]) / (Math.hypot(...fore) * Math.hypot(...handleDir));
    expect(cos).toBeLessThanOrEqual(0.02);
  });

  test('130 Alternating Kettlebell Row: standing over two bells on floor, one rows to lower ribs with elbow behind trunk while the other stays on the floor in a straight plumb arm (>= 172 deg) across every tick', () => {
    const entry = entryById(130);
    const slug = slugOf(entry);
    const ds = entry.segmentDurationsMs;
    const poses = entry.frames.map((f) => f.joints);
    const ticks = ticksOf(entry);

    const atTime = (t) => {
      const pt = rig.poseAtTime(poses, t, ds);
      const g = rig.chainGeometry(slug, pt.ph ?? 0, BODY);
      const prims = rig.layoutCanonicalFigure(pt, { ...entry, body: BODY });
      const circles = prims.filter(
        (p) => p.kind === 'circle' && Math.abs(p.r - rig.KETTLEBELL_RADIUS) < 1e-6,
      );
      return {
        g,
        nearCircle: circles.find((p) => p.fill === 'textHi'),
        farCircle: circles.find((p) => p.fill !== 'textHi'),
      };
    };

    const start = atTime(0);
    const peakNear = atTime(ds[0]);
    const midFloor = atTime(ds[0] + ds[1]);
    const peakFar = atTime(ds[0] + ds[1] + ds[2]);

    // MOV-S1-R3: a flat back ("back flat", no spinal curl) with the chest square to the floor (trunk within 25
    // degrees of level), knees bent slightly (150 to 165 degrees), and the body's centre of mass over the painted
    // foot at every tick, alone and with the rowed bell (a fifth of the body's mass) in the hand.
    expect(start.g.angles.curl).toBe(0);
    expect(Math.abs(trunkDegOf(start.g))).toBeLessThanOrEqual(25);
    for (const t of ticks) {
      const s = atTime(t);
      for (const side of ['near', 'far']) {
        const knee = deg3D(s.g.world[side].hipJoint, s.g.world[side].knee, s.g.world[side].ankle);
        expect(knee).toBeGreaterThanOrEqual(150);
        expect(knee).toBeLessThanOrEqual(165);
      }
      expectOverPaintedFoot(s.g, comX(s.g));
      const rowed = s.g.world.near.hold[1] > s.g.world.far.hold[1] ? s.g.world.near.hold : s.g.world.far.hold;
      expectOverPaintedFoot(s.g, comX(s.g, 0.2, rowed[0]));
      // Each bell, hanging 6 below its handle, stays clear of both painted legs.
      for (const hand of ['near', 'far']) {
        const h = s.g.world[hand].hold;
        const bell = [h[0], h[1] - 6.0, h[2]];
        for (const leg of ['near', 'far']) {
          const L = s.g.world[leg];
          expect(pointToSegment(bell, L.hipJoint, L.knee)).toBeGreaterThanOrEqual(rig.KETTLEBELL_RADIUS + THIGH_HALF);
          expect(pointToSegment(bell, L.knee, L.ankle)).toBeGreaterThanOrEqual(rig.KETTLEBELL_RADIUS + SHIN_HALF);
        }
      }
    }

    // Start and midpoint: both kettlebells on the floor in straight plumb arms (>= 172 deg).
    for (const s of [start, midFloor]) {
      expect(s.nearCircle.cy + s.nearCircle.r).toBeCloseTo(FLOOR, 1);
      expect(s.farCircle.cy + s.farCircle.r).toBeCloseTo(FLOOR, 1);
      expect(Math.abs(s.g.world.near.hold[0] - s.g.world.near.shoulder[0])).toBeLessThanOrEqual(0.5);
      expect(Math.abs(s.g.world.far.hold[0] - s.g.world.far.shoulder[0])).toBeLessThanOrEqual(0.5);
      expect(deg3D(s.g.world.near.shoulder, s.g.world.near.elbow, s.g.world.near.hold)).toBeGreaterThanOrEqual(172);
      expect(deg3D(s.g.world.far.shoulder, s.g.world.far.elbow, s.g.world.far.hold)).toBeGreaterThanOrEqual(172);
    }

    // First pull peak: near kettlebell rows toward lower ribs (elbow behind trunk) while far kettlebell stays on the floor in a straight arm.
    expect(peakNear.farCircle.cy + peakNear.farCircle.r).toBeCloseTo(FLOOR, 1);
    expect(peakNear.nearCircle.cy + peakNear.nearCircle.r).toBeLessThan(FLOOR - 14);
    expect(deg3D(peakNear.g.world.far.shoulder, peakNear.g.world.far.elbow, peakNear.g.world.far.hold)).toBeGreaterThanOrEqual(172);
    expect(behindTrunkDist(peakNear.g.world.near.elbow, peakNear.g.world.hip, peakNear.g.angles.trunk)).toBeGreaterThanOrEqual(3.0);

    // MOV-S1-R3: the far-side row can be seen. At its peak the far bell's painted centre lies outside the painted
    // torso (its slices) and outside both painted legs.
    {
      const prims = rig.layoutCanonicalFigure(rig.poseAtTime(poses, ds[0] + ds[1] + ds[2], ds), { ...entry, body: BODY });
      const c = [peakFar.farCircle.cx, peakFar.farCircle.cy];
      const seg2 = (p, a, b) => {
        const abx = b[0] - a[0], aby = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / (abx * abx + aby * aby || 1)));
        return Math.hypot(p[0] - (a[0] + t * abx), p[1] - (a[1] + t * aby));
      };
      const slices = prims.filter((p) => p.kind === 'bone' && p.color === 'textLow' && p.opacity === 1 && p.w < 2.0);
      for (const sl of slices) expect(seg2(c, [sl.x1, sl.y1], [sl.x2, sl.y2])).toBeGreaterThan(sl.w / 2);
      const j = peakFar.g.joints;
      for (const [a, b, half] of [[j.nLeg, j.kn, THIGH_HALF], [j.kn, j.an, SHIN_HALF], [j.fLeg, j.kf, THIGH_HALF], [j.kf, j.af, SHIN_HALF]]) {
        expect(seg2(c, a, b)).toBeGreaterThan(half);
      }
    }

    // Second pull peak: far kettlebell rows toward lower ribs (elbow behind trunk) while near kettlebell stays on the floor in a straight arm.
    expect(peakFar.nearCircle.cy + peakFar.nearCircle.r).toBeCloseTo(FLOOR, 1);
    expect(peakFar.farCircle.cy + peakFar.farCircle.r).toBeLessThan(FLOOR - 14);
    expect(deg3D(peakFar.g.world.near.shoulder, peakFar.g.world.near.elbow, peakFar.g.world.near.hold)).toBeGreaterThanOrEqual(172);
    expect(behindTrunkDist(peakFar.g.world.far.elbow, peakFar.g.world.hip, peakFar.g.angles.trunk)).toBeGreaterThanOrEqual(3.0);

    // Every 33 ms tick: during the first half of the cycle the far kettlebell stays on the floor;
    // during the second half of the cycle the near kettlebell stays on the floor.
    const halfTime = ds[0] + ds[1];
    for (const t of ticks) {
      const s = atTime(t);
      if (t <= halfTime) {
        expect(s.farCircle.cy + s.farCircle.r).toBeCloseTo(FLOOR, 1);
        expect(deg3D(s.g.world.far.shoulder, s.g.world.far.elbow, s.g.world.far.hold)).toBeGreaterThanOrEqual(172);
      }
      if (t >= halfTime) {
        expect(s.nearCircle.cy + s.nearCircle.r).toBeCloseTo(FLOOR, 1);
        expect(deg3D(s.g.world.near.shoulder, s.g.world.near.elbow, s.g.world.near.hold)).toBeGreaterThanOrEqual(172);
      }
    }
  });
});
