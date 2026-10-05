// Physical action regressions for Batch B3b: Fixed-bar body motions (66 Inverted Row & 152 Body Tricep Press).
// Inverted Row: horizontal pulling under fixed bar with heels planted and rigid body plank.
// Body Tricep Press: elbow extension pressing body away from fixed chest-height bar on planted toes.
import {
  DUAL_BODY_PARAMETERS,
  invertedRowGeometry,
  bodyTricepPressGeometry,
  poseAtTime,
  resolveFigureJoints,
  layoutCanonicalFigure,
} from '../../src/components/movementPreview/canonicalFigure';
import { buildPreviewEntry } from '../../src/components/movementPreview/manifest';
import { previewManifest } from './previewManifest';

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const entry66 = previewManifest.entries.find(e => e.movementId === 66);
const entry152 = previewManifest.entries.find(e => e.movementId === 152);

const suite = (entry66 && entry152) ? describe : describe.skip;

suite('Batch B3b: Fixed-Bar Body Motion', () => {
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

  test.each(Object.keys(DUAL_BODY_PARAMETERS))('66 maintains rigid body plank, fixed heel contact, and chest-to-bar pull (%s)', name => {
    const body = DUAL_BODY_PARAMETERS[name];
    const opts = { ...entry66, body };
    const total = entry66.segmentDurationsMs.reduce((a, b) => a + b, 0);
    const ticks = [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];

    for (const t of ticks) {
      const pose = poseAtTime(entry66.frames.map(f => f.joints), t, entry66.segmentDurationsMs);
      const g = invertedRowGeometry(pose.ir, body);
      const f = resolveFigureJoints(pose, opts);

      // 1. Fixed bar anchor
      expect(g.bar[0]).toBeCloseTo(48, 4);
      expect(g.bar[1]).toBeCloseTo(38, 4);

      // 2. Wrists stay on bar
      expect(distance(f.wr, g.bar)).toBeLessThan(1e-5);

      // 3. Planted heels on floor 96.9
      const footBottom = f.an[1] + g.footWidth / 2;
      expect(footBottom).toBeCloseTo(96.9, 1);
      expect(f.an[0]).toBeCloseTo(g.heelAnchor[0], 4);

      // 4. Rigid body plank: ankle, knee, hip, neck lie on the same straight line
      const plankAngle = Math.atan2(f.nk[1] - f.an[1], f.nk[0] - f.an[0]);
      const hipAngle = Math.atan2(f.hp[1] - f.an[1], f.hp[0] - f.an[0]);
      const kneeAngle = Math.atan2(f.kn[1] - f.an[1], f.kn[0] - f.an[0]);
      expect(Math.abs(hipAngle - plankAngle)).toBeLessThan(1e-5);
      expect(Math.abs(kneeAngle - plankAngle)).toBeLessThan(1e-5);

      // 5. Exact segment lengths preserved
      expect(distance(f.an, f.kn)).toBeCloseTo(22.25, 5);
      expect(distance(f.kn, f.hp)).toBeCloseTo(22.25, 5);
      expect(distance(f.hp, f.nk)).toBeCloseTo(24.0, 5);
      expect(distance(f.nk, f.hd)).toBeCloseTo(9.0, 5);
      expect(distance(f.nk, f.el)).toBeCloseTo(12.5, 5);
      expect(distance(f.el, f.wr)).toBeCloseTo(12.0, 5);
    }

    // Concentric action: chest moves close to bar at peak (ir = 1)
    const bottom = invertedRowGeometry(0, body);
    const top = invertedRowGeometry(1, body);
    expect(distance(top.joints.nk, top.bar)).toBeLessThan(distance(bottom.joints.nk, bottom.bar));
    expect(top.plankAngleDeg).toBeGreaterThan(bottom.plankAngleDeg);
  });

  test.each(Object.keys(DUAL_BODY_PARAMETERS))('152 isolates elbow extension against fixed bar with quiet body plank (%s)', name => {
    const body = DUAL_BODY_PARAMETERS[name];
    const opts = { ...entry152, body };
    const total = entry152.segmentDurationsMs.reduce((a, b) => a + b, 0);
    const ticks = [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];

    for (const t of ticks) {
      const pose = poseAtTime(entry152.frames.map(f => f.joints), t, entry152.segmentDurationsMs);
      const g = bodyTricepPressGeometry(pose.tp, body);
      const f = resolveFigureJoints(pose, opts);

      // 1. Fixed bar anchor
      expect(g.bar[0]).toBeCloseTo(60, 4);
      expect(g.bar[1]).toBeCloseTo(42, 4);

      // 2. Hands grip bar
      expect(distance(f.wr, g.bar)).toBeLessThan(1e-5);

      // 3. Planted toes on floor 96.9
      const footBottom = f.an[1] + g.footWidth / 2;
      expect(footBottom).toBeCloseTo(96.9, 1);

      // 4. Rigid body plank
      const plankAngle = Math.atan2(f.nk[1] - f.an[1], f.nk[0] - f.an[0]);
      const hipAngle = Math.atan2(f.hp[1] - f.an[1], f.hp[0] - f.an[0]);
      const kneeAngle = Math.atan2(f.kn[1] - f.an[1], f.kn[0] - f.an[0]);
      expect(Math.abs(hipAngle - plankAngle)).toBeLessThan(1e-5);
      expect(Math.abs(kneeAngle - plankAngle)).toBeLessThan(1e-5);

      // 5. Segment lengths preserved
      expect(distance(f.an, f.kn)).toBeCloseTo(22.25, 5);
      expect(distance(f.kn, f.hp)).toBeCloseTo(22.25, 5);
      expect(distance(f.hp, f.nk)).toBeCloseTo(24.0, 5);
      expect(distance(f.nk, f.hd)).toBeCloseTo(9.0, 5);
      expect(distance(f.nk, f.el)).toBeCloseTo(12.5, 5);
      expect(distance(f.el, f.wr)).toBeCloseTo(12.0, 5);
    }

    // Biomechanical distinction: 152 flexes elbow to lower head towards bar
    const lockout = bodyTricepPressGeometry(0, body);
    const flexed = bodyTricepPressGeometry(1, body);
    expect(distance(flexed.joints.hd, flexed.bar)).toBeLessThan(distance(lockout.joints.hd, lockout.bar));
    expect(lockout.elbowFlexionDeg).toBeLessThan(10); // Nearly straight at lockout
    expect(flexed.elbowFlexionDeg).toBeGreaterThan(70); // Deep elbow flexion
  });
});
