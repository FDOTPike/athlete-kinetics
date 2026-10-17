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

    // Hinged torso and soft knees.
    expect(trunkDegOf(g0)).toBeGreaterThanOrEqual(18);
    expect(trunkDegOf(g0)).toBeLessThanOrEqual(30);
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
    expect(behindTrunkDist(g1.world.near.elbow, g1.world.hip, g1.angles.trunk)).toBeGreaterThanOrEqual(4.0);
    expect(behindTrunkDist(g1.world.far.elbow, g1.world.hip, g1.angles.trunk)).toBeGreaterThanOrEqual(4.0);
  });

  test('130 Alternating Kettlebell Row: standing over two bells on floor, one rows to lower ribs with elbow behind trunk while the other stays on the floor in a straight plumb arm (>= 172 deg)', () => {
    const entry = entryById(130);
    const slug = slugOf(entry);
    const g0 = rig.chainGeometry(slug, 0, BODY);
    const g1 = rig.chainGeometry(slug, 1, BODY);
    const g2 = rig.chainGeometry(slug, 2, BODY);

    // Flat back and standing over the two kettlebells.
    expect(trunkDegOf(g0)).toBeGreaterThanOrEqual(0);
    expect(trunkDegOf(g0)).toBeLessThanOrEqual(10);
    expect(g0.world.near.hold[0]).toBeGreaterThanOrEqual(g0.world.near.ankle[0] - 1);
    expect(g0.world.near.hold[0]).toBeLessThanOrEqual(g0.world.near.toe[0] + 1);

    const kbCircles = (ph) => {
      const prims = rig.layoutCanonicalFigure({ ...entry.frames[0].joints, ph }, { ...entry, body: BODY });
      return prims.filter((p) => p.kind === 'circle' && Math.abs(p.r - rig.KETTLEBELL_RADIUS) < 1e-6);
    };

    // Pose 0: both kettlebells on the floor in straight plumb arms (>= 172 deg).
    const c0 = kbCircles(0);
    expect(c0).toHaveLength(2);
    expect(c0[0].cy + c0[0].r).toBeCloseTo(FLOOR, 1);
    expect(c0[1].cy + c0[1].r).toBeCloseTo(FLOOR, 1);
    expect(Math.abs(g0.world.near.hold[0] - g0.world.near.shoulder[0])).toBeLessThanOrEqual(0.5);
    expect(Math.abs(g0.world.far.hold[0] - g0.world.far.shoulder[0])).toBeLessThanOrEqual(0.5);
    expect(deg3D(g0.world.near.shoulder, g0.world.near.elbow, g0.world.near.hold)).toBeGreaterThanOrEqual(172);
    expect(deg3D(g0.world.far.shoulder, g0.world.far.elbow, g0.world.far.hold)).toBeGreaterThanOrEqual(172);

    // Pose 1: near kettlebell rows toward lower ribs (elbow behind trunk) while far kettlebell stays on the floor in a straight arm.
    const c1 = kbCircles(1);
    const farCircle1 = c1.find((p) => p.fill !== 'textHi');
    const nearCircle1 = c1.find((p) => p.fill === 'textHi');
    expect(farCircle1.cy + farCircle1.r).toBeCloseTo(FLOOR, 1);
    expect(nearCircle1.cy + nearCircle1.r).toBeLessThan(FLOOR - 14);
    expect(deg3D(g1.world.far.shoulder, g1.world.far.elbow, g1.world.far.hold)).toBeGreaterThanOrEqual(172);
    expect(behindTrunkDist(g1.world.near.elbow, g1.world.hip, g1.angles.trunk)).toBeGreaterThanOrEqual(3.0);

    // Pose 2: far kettlebell rows toward lower ribs (elbow behind trunk) while near kettlebell stays on the floor in a straight arm.
    const c2 = kbCircles(2);
    const farCircle2 = c2.find((p) => p.fill !== 'textHi');
    const nearCircle2 = c2.find((p) => p.fill === 'textHi');
    expect(nearCircle2.cy + nearCircle2.r).toBeCloseTo(FLOOR, 1);
    expect(farCircle2.cy + farCircle2.r).toBeLessThan(FLOOR - 14);
    expect(deg3D(g2.world.near.shoulder, g2.world.near.elbow, g2.world.near.hold)).toBeGreaterThanOrEqual(172);
    expect(behindTrunkDist(g2.world.far.elbow, g2.world.hip, g2.angles.trunk)).toBeGreaterThanOrEqual(3.0);
  });
});
