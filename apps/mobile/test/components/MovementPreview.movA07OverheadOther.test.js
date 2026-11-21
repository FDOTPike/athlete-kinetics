/**
 * MOV-A07 — Other overhead work (229, 85, 112, 101, 58, 63, 69).
 *
 * Source-text-bound and physics-bound tests across every 33 ms tick of each
 * movement's cycle, written before authoring the drawings.
 */
import * as rig from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';
import catalogue from '../../../../docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json';

const BODY = rig.CANONICAL_BODY_PARAMETERS;
const IDS = [229, 85, 112, 101, 58, 63, 69];
const FLOOR = 96.9;

const entryFor = (id) => {
  const e = previewManifest.entries.find((x) => x.movementId === id);
  expect(e).toBeDefined();
  return e;
};

const rowFor = (id) => catalogue.movements.find((m) => m.id === id);
const slugOf = (e) => e.assetKey.split('/')[1];

const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const deg3D = (a, b, c) => {
  const ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2];
  const vx = c[0] - b[0], vy = c[1] - b[1], vz = c[2] - b[2];
  const n = Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz) || 1;
  return (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / n))) * 180) / Math.PI;
};

const trunkDegFromHorizontal2D = (j) =>
  (Math.atan2(j.hp[1] - j.nk[1], Math.abs(j.nk[0] - j.hp[0])) * 180) / Math.PI;

const segPointDist2D = (x1, y1, x2, y2, px, py) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
};

describe('MOV-A07 other overhead work: physics, joint angles, painted contacts, timings, and family distinctions', () => {
  test.each(IDS)('movement %i is authored as pending with at least 5 frames and valid primitives inside viewBox on every 33 ms tick', (id) => {
    const e = entryFor(id);
    expect(e.status).toBe('pending');
    expect(e.frames.length).toBeGreaterThanOrEqual(5);
    const ds = e.segmentDurationsMs;
    const total = ds.reduce((a, b) => a + b, 0);
    const poses = e.frames.map((f) => f.joints);
    const [vx, vy, vw, vh] = e.viewBox;
    for (let t = 0; t <= total; t += 33) {
      const p = rig.poseAtTime(poses, t, ds);
      const prims = rig.layoutCanonicalFigure(p, { view: e.view, assetKey: e.assetKey, body: BODY });
      expect(prims.length).toBeGreaterThan(20);
      for (const prim of prims) {
        if (prim.kind === 'circle') {
          expect(prim.cx - prim.r).toBeGreaterThanOrEqual(vx);
          expect(prim.cy - prim.r).toBeGreaterThanOrEqual(vy);
          expect(prim.cx + prim.r).toBeLessThanOrEqual(vx + vw);
          expect(prim.cy + prim.r).toBeLessThanOrEqual(vy + vh);
        }
      }
    }
  });

  test('229 Kettlebell Seated Press sits directly on the floor with legs spread wide, cleans one bell to the forearm rack, and presses up and out to overhead lockout', () => {
    // Quotes:
    // "Sit on the floor with the legs spread comfortably wide for a stable base. Clean one kettlebell to the shoulder so the bell rests on the forearm."
    // "Press up and out until the arm locks out overhead, then return to the shoulder under control."
    // "Keep the legs wide and settled. Finish with the elbow locked overhead. Lower back to the rack position with intent."
    const row = rowFor(229);
    expect(row.source.instructions).toContain('Sit on the floor with the legs spread comfortably wide for a stable base.');
    expect(row.source.instructions).toContain('Press up and out until the arm locks out overhead, then return to the shoulder under control.');
    expect(row.source.cues).toContain('Keep the legs wide and settled. Finish with the elbow locked overhead.');

    const e = entryFor(229);
    const slug = slugOf(e);
    const start = rig.chainGeometry(slug, 0, BODY);
    const top = rig.chainGeometry(slug, 1, BODY);

    // Seated directly on the floor (no bench equipment), with painted underside of both thighs and heels resting on FLOOR = 96.9
    expect(start.movement.implement).toBe('kettlebell');
    expect((start.movement.equipment ?? []).length).toBe(0);
    const startPrims = rig.layoutCanonicalFigure(e.frames[0].joints, { view: e.view, assetKey: e.assetKey, body: BODY });
    const nearThigh = startPrims.find((p) => p.kind === 'bone' && p.color === 'textHi' && Math.abs(p.w - BODY.lw * 1.18) < 1e-6);
    const farThigh = startPrims.find((p) => p.kind === 'bone' && p.color === 'textLow' && Math.abs(p.w - BODY.lw * 1.18) < 1e-6);
    const nearShin = startPrims.find((p) => p.kind === 'bone' && p.color === 'textHi' && Math.abs(p.w - BODY.lw * 0.9) < 1e-6);
    for (const bone of [nearThigh, farThigh, nearShin]) {
      const underside = Math.max(bone.y1, bone.y2) + bone.w / 2;
      expect(FLOOR - underside).toBeGreaterThanOrEqual(0);
      expect(FLOOR - underside).toBeLessThanOrEqual(0.5);
    }

    // Legs spread comfortably wide across Z and in the 2D card projection, with straight knees (>= 172 deg), kept settled throughout
    expect(start.world.near.ankle[2] - start.world.far.ankle[2]).toBeGreaterThanOrEqual(60);
    expect(deg3D(start.world.near.hipJoint, start.world.near.knee, start.world.near.ankle)).toBeGreaterThanOrEqual(172);
    expect(deg3D(start.world.far.hipJoint, start.world.far.knee, start.world.far.ankle)).toBeGreaterThanOrEqual(172);
    expect(start.joints.an[0]).toBeLessThan(start.joints.nLeg[0] - 10);
    expect(start.joints.af[0]).toBeGreaterThan(start.joints.fLeg[0] + 25);
    expect(start.joints.af[0] - start.joints.an[0]).toBeGreaterThanOrEqual(55);
    const ds = e.segmentDurationsMs;
    const total = ds.reduce((a, b) => a + b, 0);
    const poses = e.frames.map((f) => f.joints);
    for (let t = 0; t <= total; t += 33) {
      const p = rig.poseAtTime(poses, t, ds);
      const g = rig.chainGeometry(slug, p.ph, BODY);
      expect(dist3(g.world.hip, start.world.hip)).toBeLessThan(0.01);
      expect(dist3(g.world.near.ankle, start.world.near.ankle)).toBeLessThan(0.01);
      expect(dist3(g.world.far.ankle, start.world.far.ankle)).toBeLessThan(0.01);
      expect(trunkDegFromHorizontal2D(g.joints)).toBeGreaterThanOrEqual(85);

      // Near arm never overlaps the head circle
      const prims = rig.layoutCanonicalFigure(p, { view: e.view, assetKey: e.assetKey, body: BODY });
      const j = g.joints;
      const head = prims.find((pr) => pr.kind === 'circle' && Math.abs(pr.cx - j.hd[0]) < 1e-4 && Math.abs(pr.cy - j.hd[1]) < 1e-4);
      const upperArmBone = prims.find((pr) => pr.kind === 'bone' && Math.abs(pr.x1 - j.nArm[0]) < 1e-4 && Math.abs(pr.y1 - j.nArm[1]) < 1e-4 && Math.abs(pr.x2 - j.el[0]) < 1e-4 && Math.abs(pr.y2 - j.el[1]) < 1e-4);
      const headOuterR = head.r + (head.strokeWidth ?? 0) / 2;
      const clearance = segPointDist2D(upperArmBone.x1, upperArmBone.y1, upperArmBone.x2, upperArmBone.y2, head.cx, head.cy) - upperArmBone.w / 2 - headOuterR;
      expect(clearance).toBeGreaterThan(0);
    }

    // Rack start at shoulder on forearm -> press UP and OUT to locked elbow overhead
    const rackElbowDeg = deg3D(start.world.near.shoulder, start.world.near.elbow, start.world.near.wrist);
    const lockElbowDeg = deg3D(top.world.near.shoulder, top.world.near.elbow, top.world.near.wrist);
    expect(rackElbowDeg).toBeGreaterThanOrEqual(30);
    expect(rackElbowDeg).toBeLessThanOrEqual(75);
    expect(dist3(start.world.near.wrist, start.world.near.shoulder)).toBeLessThanOrEqual(9.5);
    expect(lockElbowDeg).toBeGreaterThanOrEqual(176);
    expect(top.world.near.wrist[1]).toBeGreaterThan(start.world.near.wrist[1] + 20);
    expect(top.world.near.wrist[2]).toBeGreaterThan(start.world.near.wrist[2] + 1.5);
  });

  test('85 Double Kettlebell Push Press dips shallow and fast with a vertical torso, then drives the legs before finishing with both arms locked overhead', () => {
    // Quotes:
    // "Clean two kettlebells to the rack position. Dip a few inches by bending the knees with a vertical torso, then drive the legs hard and let that force carry both bells to locked-out arms overhead."
    // "The legs start the press and the arms finish it — a shallow, snappy dip beats a deep slow one every time."
    // "Dip shallow, drive fast. Legs throw it, arms catch the lockout. Rack, reset, breathe between reps."
    const row = rowFor(85);
    expect(row.source.instructions).toContain('Dip a few inches by bending the knees with a vertical torso, then drive the legs hard and let that force carry both bells to locked-out arms overhead.');
    expect(row.source.instructions).toContain('The legs start the press and the arms finish it — a shallow, snappy dip beats a deep slow one every time.');
    expect(row.source.cues).toContain('Dip shallow, drive fast. Legs throw it, arms catch the lockout. Rack, reset, breathe between reps.');

    const e = entryFor(85);
    const slug = slugOf(e);
    const dip = rig.chainGeometry(slug, 0, BODY);
    const rack = rig.chainGeometry(slug, 1, BODY);
    const lockout = rig.chainGeometry(slug, 2, BODY);

    expect(rack.movement.implement).toBe('kettlebells');
    expect(e.frames.map((f) => f.joints.ph)).toEqual([1, 0, 2, 2, 1, 1]);

    // Shallow dip of a few inches (4.0..8.0 units hip drop) with a strictly vertical torso and bells held in the rack
    const hipDip = rack.world.hip[1] - dip.world.hip[1];
    expect(hipDip).toBeGreaterThanOrEqual(4.0);
    expect(hipDip).toBeLessThanOrEqual(8.0);
    const rackKneeDeg = deg3D(rack.world.near.hipJoint, rack.world.near.knee, rack.world.near.ankle);
    const dipKneeDeg = deg3D(dip.world.near.hipJoint, dip.world.near.knee, dip.world.near.ankle);
    const lockKneeDeg = deg3D(lockout.world.near.hipJoint, lockout.world.near.knee, lockout.world.near.ankle);
    expect(rackKneeDeg).toBeGreaterThanOrEqual(175);
    expect(dipKneeDeg).toBeGreaterThanOrEqual(125);
    expect(dipKneeDeg).toBeLessThanOrEqual(148);
    expect(lockKneeDeg).toBeGreaterThanOrEqual(175);

    expect(trunkDegFromHorizontal2D(rack.joints)).toBeGreaterThanOrEqual(88);
    expect(trunkDegFromHorizontal2D(dip.joints)).toBeGreaterThanOrEqual(88);
    expect(trunkDegFromHorizontal2D(lockout.joints)).toBeGreaterThanOrEqual(88);

    // Bells stay racked during the dip (ph=1 -> ph=0), then legs extend (ph=0 -> ph=1) and arms finish overhead (ph=1 -> ph=2)
    expect(deg3D(rack.world.near.shoulder, rack.world.near.elbow, rack.world.near.wrist)).toBeGreaterThanOrEqual(30);
    expect(deg3D(dip.world.near.shoulder, dip.world.near.elbow, dip.world.near.wrist)).toBeGreaterThanOrEqual(30);
    expect(dist3(rack.world.near.wrist, rack.world.near.shoulder)).toBeLessThanOrEqual(9.5);
    expect(dist3(dip.world.near.wrist, dip.world.near.shoulder)).toBeLessThanOrEqual(9.5);
    expect(deg3D(lockout.world.near.shoulder, lockout.world.near.elbow, lockout.world.near.wrist)).toBeGreaterThanOrEqual(176);
    expect(deg3D(lockout.world.far.shoulder, lockout.world.far.elbow, lockout.world.far.wrist)).toBeGreaterThanOrEqual(176);
    expect(lockout.world.near.wrist[1]).toBeGreaterThan(lockout.world.near.shoulder[1] + 22);
    expect(lockout.world.far.wrist[1]).toBeGreaterThan(lockout.world.far.shoulder[1] + 22);

    // Dip is quick against the drive, and the cycle finishes with a rack reset/breathe pause
    expect(e.segmentDurationsMs[0]).toBeLessThanOrEqual(400);
    expect(e.segmentDurationsMs[0] * 2).toBeLessThanOrEqual(e.segmentDurationsMs[1]);
    expect(e.segmentDurationsMs[4]).toBeGreaterThanOrEqual(400);
  });

  test('112 Bent Press sends the hips away and wedges the torso under the kettlebell until the arm locks, then stands tall without the bell travelling sideways', () => {
    // Quotes:
    // "Clean one kettlebell to the shoulder, set the feet wider than the hips, and turn them slightly away from the loaded side."
    // "Send the hips away and wedge the torso under the bell, straightening the arm as the body descends while the eyes stay on the handle."
    // "Once the elbow is locked, drive the feet through the floor to stand tall; if the bell travels sideways instead of staying over its base, the range is too deep or the setup was rushed."
    const row = rowFor(112);
    expect(row.source.instructions).toContain('Clean one kettlebell to the shoulder, set the feet wider than the hips, and turn them slightly away from the loaded side.');
    expect(row.source.instructions).toContain('Send the hips away and wedge the torso under the bell, straightening the arm as the body descends while the eyes stay on the handle.');
    expect(row.source.instructions).toContain('Once the elbow is locked, drive the feet through the floor to stand tall; if the bell travels sideways instead of staying over its base, the range is too deep or the setup was rushed.');

    const e = entryFor(112);
    const slug = slugOf(e);
    const setup = rig.chainGeometry(slug, 0, BODY);
    const wedge = rig.chainGeometry(slug, 1, BODY);
    const stand = rig.chainGeometry(slug, 2, BODY);

    // One bell at shoulder, feet wider than the hips and turned slightly away from the loaded near side, standing tall (>= 172 deg knees)
    expect(setup.movement.implement).toBe('kettlebell');
    expect(setup.world.near.ankle[2] - setup.world.far.ankle[2]).toBeGreaterThanOrEqual(22);
    expect(setup.angles.foot[1]).toBeLessThanOrEqual(-12);
    expect(deg3D(setup.world.near.hipJoint, setup.world.near.knee, setup.world.near.ankle)).toBeGreaterThanOrEqual(172);
    expect(deg3D(setup.world.far.hipJoint, setup.world.far.knee, setup.world.far.ankle)).toBeGreaterThanOrEqual(172);

    // Setup -> Wedge: hips shift away and descend, torso wedges under the bell while the arm straightens to lockout and head turns toward the handle
    expect(deg3D(setup.world.near.shoulder, setup.world.near.elbow, setup.world.near.wrist)).toBeGreaterThanOrEqual(30);
    expect(deg3D(setup.world.near.shoulder, setup.world.near.elbow, setup.world.near.wrist)).toBeLessThanOrEqual(65);
    expect(wedge.world.hip[0]).toBeLessThan(setup.world.hip[0] - 6);
    expect(wedge.world.hip[1]).toBeLessThan(setup.world.hip[1] - 4);
    expect(trunkDegFromHorizontal2D(wedge.joints)).toBeLessThanOrEqual(55);
    expect(wedge.world.near.shoulder[1]).toBeLessThan(setup.world.near.shoulder[1] - 14);
    expect(deg3D(wedge.world.near.shoulder, wedge.world.near.elbow, wedge.world.near.wrist)).toBeGreaterThanOrEqual(176);
    expect(wedge.world.head[1]).toBeGreaterThan(wedge.world.neck[1] + 5);
    expect(deg3D(wedge.world.head, wedge.world.neck, wedge.world.near.hold)).toBeLessThanOrEqual(5);
    expect(wedge.joints.hd[0]).toBeLessThan(wedge.joints.nk[0]);

    // Wedge -> Stand tall: arm stays locked overhead while feet drive through the floor to stand tall (knees >= 172 deg)
    expect(deg3D(stand.world.near.shoulder, stand.world.near.elbow, stand.world.near.wrist)).toBeGreaterThanOrEqual(176);
    expect(deg3D(stand.world.near.hipJoint, stand.world.near.knee, stand.world.near.ankle)).toBeGreaterThanOrEqual(172);
    expect(deg3D(stand.world.far.hipJoint, stand.world.far.knee, stand.world.far.ankle)).toBeGreaterThanOrEqual(172);
    expect(trunkDegFromHorizontal2D(stand.joints)).toBeGreaterThanOrEqual(85);
    expect(stand.world.near.hold[1]).toBeGreaterThan(wedge.world.near.hold[1] + 14);

    // No second wedge caption, and after ph = 2 is reached the return stays standing tall (trunk >= 85 deg, knees >= 172 deg)
    for (const f of e.frames.slice(3)) {
      expect(f.caption.toLowerCase()).not.toContain('wedge');
    }
    const ds = e.segmentDurationsMs;
    const total = ds.reduce((a, b) => a + b, 0);
    const poses = e.frames.map((f) => f.joints);
    const standTime = ds[0] + ds[1];
    for (let t = 0; t <= total; t += 33) {
      const p = rig.poseAtTime(poses, t, ds);
      const g = rig.chainGeometry(slug, p.ph, BODY);
      expect(Math.abs(g.world.near.hold[0] - setup.world.near.hold[0])).toBeLessThanOrEqual(1.2);
      expect(Math.abs(g.world.near.hold[2] - setup.world.near.hold[2])).toBeLessThanOrEqual(1.2);
      expect(Math.abs(g.hold.near[0] - setup.hold.near[0])).toBeLessThanOrEqual(1.2);
      expect(dist3(g.world.near.ankle, setup.world.near.ankle)).toBeLessThan(0.01);
      expect(dist3(g.world.far.ankle, setup.world.far.ankle)).toBeLessThan(0.01);
      if (t >= standTime) {
        expect(trunkDegFromHorizontal2D(g.joints)).toBeGreaterThanOrEqual(85);
        expect(deg3D(g.world.near.hipJoint, g.world.near.knee, g.world.near.ankle)).toBeGreaterThanOrEqual(172);
        expect(deg3D(g.world.far.hipJoint, g.world.far.knee, g.world.far.ankle)).toBeGreaterThanOrEqual(172);
      }
    }
  });

  test('101 Cuban Press shows three distinct stages — high-elbow row with hanging forearms, external rotation around fixed upper arms, and overhead press — and reverses each stage', () => {
    // Quotes:
    // "Stand with very light dumbbells and raise the elbows wide to shoulder height, forearms hanging below them."
    // "Keep the upper arms fixed while rotating the forearms until the wrists stack directly over the elbows, then press to a tall overhead finish."
    // "Reverse every stage under control; if the hips have to help, the bells are too heavy for the rotation you are training."
    const row = rowFor(101);
    expect(row.source.instructions).toContain('Stand with very light dumbbells and raise the elbows wide to shoulder height, forearms hanging below them.');
    expect(row.source.instructions).toContain('Keep the upper arms fixed while rotating the forearms until the wrists stack directly over the elbows, then press to a tall overhead finish.');
    expect(row.source.instructions).toContain('Reverse every stage under control; if the hips have to help, the bells are too heavy for the rotation you are training.');

    const e = entryFor(101);
    const slug = slugOf(e);
    expect(e.frames.map((f) => f.joints.ph)).toEqual([0, 1, 2, 3, 3, 2, 1, 0]);

    const start = rig.chainGeometry(slug, 0, BODY);
    const stage1 = rig.chainGeometry(slug, 1, BODY);
    const stage2 = rig.chainGeometry(slug, 2, BODY);
    const stage3 = rig.chainGeometry(slug, 3, BODY);

    expect(start.movement.implement).toBe('bells');
    expect(start.world.near.wrist[1]).toBeLessThan(start.world.near.shoulder[1] - 20);

    // Stage 1: elbows raised wide to shoulder height, forearms hanging vertically below them
    expect(Math.abs(stage1.world.near.elbow[1] - stage1.world.near.shoulder[1])).toBeLessThanOrEqual(1.0);
    expect(stage1.world.near.elbow[2] - stage1.world.near.shoulder[2]).toBeGreaterThanOrEqual(11.5);
    expect(stage1.world.near.wrist[1]).toBeLessThan(stage1.world.near.elbow[1] - 11.5);
    expect(Math.hypot(stage1.world.near.wrist[0] - stage1.world.near.elbow[0], stage1.world.near.wrist[2] - stage1.world.near.elbow[2])).toBeLessThanOrEqual(1.0);

    // Stage 2: upper arms stay fixed while forearms rotate 180 deg forward and up until wrists stack directly over elbows
    for (let u = 0; u <= 1.0001; u += 0.1) {
      const g = rig.chainGeometry(slug, 1 + u, BODY);
      expect(dist3(g.world.near.elbow, stage1.world.near.elbow)).toBeLessThan(0.05);
      expect(dist3(g.world.far.elbow, stage1.world.far.elbow)).toBeLessThan(0.05);
      expect(deg3D(g.world.near.shoulder, g.world.near.elbow, g.world.near.wrist)).toBeCloseTo(90, 2);
    }
    expect(stage2.world.near.wrist[1]).toBeGreaterThan(stage2.world.near.elbow[1] + 11.5);
    expect(Math.hypot(stage2.world.near.wrist[0] - stage2.world.near.elbow[0], stage2.world.near.wrist[2] - stage2.world.near.elbow[2])).toBeLessThanOrEqual(1.0);

    // Stage 3: press to a tall overhead finish
    expect(deg3D(stage3.world.near.shoulder, stage3.world.near.elbow, stage3.world.near.wrist)).toBeGreaterThanOrEqual(175);
    expect(deg3D(stage3.world.far.shoulder, stage3.world.far.elbow, stage3.world.far.wrist)).toBeGreaterThanOrEqual(175);
    expect(stage3.world.near.wrist[1]).toBeGreaterThan(stage3.world.near.shoulder[1] + 22);

    // Hips and feet stay quiet throughout every 33 ms tick
    const ds = e.segmentDurationsMs;
    const total = ds.reduce((a, b) => a + b, 0);
    const poses = e.frames.map((f) => f.joints);
    for (let t = 0; t <= total; t += 33) {
      const p = rig.poseAtTime(poses, t, ds);
      const g = rig.chainGeometry(slug, p.ph, BODY);
      expect(dist3(g.world.hip, start.world.hip)).toBeLessThan(0.01);
      expect(dist3(g.world.near.ankle, start.world.near.ankle)).toBeLessThan(0.01);
    }
  });

  test('58 Eccentric Wall Handstand Push-Up and 63 Handstand Push-Up draw the wall, pad, and floor hands, maintain painted wall and pad contacts, and differ by the 5-second eccentric-only exit to the floor and kick-up versus full press', () => {
    // Quotes:
    // 58: "Clear the floor, place a firm padded target beneath the head, and kick to the wall with the hands just outside shoulder width."
    // 58: "Brace into a vertical line and lower for up to five seconds until the head meets the pad softly. Exit through the rehearsed clear side, reset, and kick back up; the controlled lowering is the full rep."
    // 63: "Brace into one vertical line and lower until the head meets the pad softly. Press back to straight arms, then exit through a rehearsed clear side."
    const row58 = rowFor(58);
    const row63 = rowFor(63);
    expect(row58.source.instructions).toContain('Brace into a vertical line and lower for up to five seconds until the head meets the pad softly.');
    expect(row58.source.instructions).toContain('Exit through the rehearsed clear side, reset, and kick back up; the controlled lowering is the full rep.');
    expect(row63.source.instructions).toContain('Brace into one vertical line and lower until the head meets the pad softly. Press back to straight arms, then exit through a rehearsed clear side.');

    const e58 = entryFor(58);
    const e63 = entryFor(63);

    for (const e of [e58, e63]) {
      const slug = slugOf(e);
      const top = rig.chainGeometry(slug, 0, BODY);
      const bottom = rig.chainGeometry(slug, 1, BODY);

      // Upside-down vertical line at ph=0 and ph=1, hands just outside shoulder width, straight arms at top (>= 172 deg)
      expect(top.world.near.ankle[1]).toBeGreaterThan(top.world.hip[1] + 40);
      expect(top.world.hip[1]).toBeGreaterThan(top.world.neck[1] + 22);
      expect(top.world.neck[1]).toBeGreaterThan(top.world.head[1] + 8);
      expect(top.world.near.wrist[2] - top.world.far.wrist[2]).toBeGreaterThan(top.world.near.shoulder[2] - top.world.far.shoulder[2] + 2.0);
      expect(deg3D(top.world.near.shoulder, top.world.near.elbow, top.world.near.wrist)).toBeGreaterThanOrEqual(172);
      expect(deg3D(bottom.world.near.shoulder, bottom.world.near.elbow, bottom.world.near.wrist)).toBeLessThanOrEqual(98);

      // Painted head-to-pad contact at bottom (ph=1)
      const bottomFrame = e.frames.find((f) => f.joints.ph === 1);
      const bottomPrims = rig.layoutCanonicalFigure(bottomFrame.joints, { view: e.view, assetKey: e.assetKey, body: BODY });
      const slabs = bottomPrims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && Math.abs(p.w - 4) < 1e-6);
      // Horizontal floor pad beneath the head and vertical wall slab
      const padSlab = slabs.find((s) => Math.abs(s.y1 - s.y2) < 1e-4);
      const wallSlab = slabs.find((s) => Math.abs(s.x1 - s.x2) < 1e-4);
      expect(padSlab).toBeDefined();
      expect(wallSlab).toBeDefined();

      const padTopY = padSlab.y1 - padSlab.w / 2;
      const headCircle = bottomPrims.find((p) => p.kind === 'circle' && Math.abs(p.cx - bottom.joints.hd[0]) < 1e-4 && Math.abs(p.cy - bottom.joints.hd[1]) < 1e-4);
      expect(headCircle).toBeDefined();
      const headBottomY = headCircle.cy + headCircle.r;
      const headPadGap = padTopY - headBottomY;
      expect(headPadGap).toBeGreaterThanOrEqual(0);
      expect(headPadGap).toBeLessThanOrEqual(0.5);

      // Across every 33 ms tick: painted hands rest on FLOOR = 96.9; while on the wall (all ticks for 63, eccentric lowering for 58), painted near heel contacts the painted wall face
      const wallRightFaceX = wallSlab.x1 + wallSlab.w / 2;
      const ds = e.segmentDurationsMs;
      const total = ds.reduce((a, b) => a + b, 0);
      const wallPhaseEnd = e.movementId === 58 ? ds[0] : total;
      const poses = e.frames.map((f) => f.joints);
      for (let t = 0; t <= total; t += 33) {
        const p = rig.poseAtTime(poses, t, ds);
        const g = rig.chainGeometry(slug, p.ph, BODY);
        const prims = rig.layoutCanonicalFigure(p, { view: e.view, assetKey: e.assetKey, body: BODY });
        const nearHand = prims.find((pr) => pr.kind === 'circle' && Math.abs(pr.cx - g.grip.near[0]) < 1e-4 && Math.abs(pr.cy - g.grip.near[1]) < 1e-4);
        const farHand = prims.find((pr) => pr.kind === 'circle' && Math.abs(pr.cx - g.grip.far[0]) < 1e-4 && Math.abs(pr.cy - g.grip.far[1]) < 1e-4);
        expect(FLOOR - (nearHand.cy + nearHand.r)).toBeGreaterThanOrEqual(0);
        expect(FLOOR - (nearHand.cy + nearHand.r)).toBeLessThanOrEqual(0.5);
        expect(FLOOR - (farHand.cy + farHand.r)).toBeGreaterThanOrEqual(0);
        expect(FLOOR - (farHand.cy + farHand.r)).toBeLessThanOrEqual(0.5);

        if (t <= wallPhaseEnd) {
          const nearShin = prims.find((pr) => pr.kind === 'bone' && pr.color === 'textHi' && Math.abs(pr.w - BODY.lw * 0.9) < 1e-6);
          const heelLeftEdgeX = Math.min(nearShin.x1, nearShin.x2) - nearShin.w / 2;
          const wallGap = heelLeftEdgeX - wallRightFaceX;
          expect(wallGap).toBeGreaterThanOrEqual(0);
          expect(wallGap).toBeLessThanOrEqual(0.6);
        }
      }
    }

    // 58 lowers for up to five seconds (4000..5000 ms), then exits to the floor on the clear side without extending the arms while inverted, resets, and kicks back up;
    // 63 lowers at normal tempo (< 2000 ms), presses straight back to locked arms (phases [0, 1, 1, 0, 0]), and instructs the post-set exit in the last caption.
    expect(e58.segmentDurationsMs[0]).toBeGreaterThanOrEqual(4000);
    expect(e58.segmentDurationsMs[0]).toBeLessThanOrEqual(5000);
    expect(e63.segmentDurationsMs[0]).toBeLessThanOrEqual(2000);
    expect(e58.segmentDurationsMs[0]).toBeGreaterThanOrEqual(e63.segmentDurationsMs[0] * 2.5);

    expect(e63.frames.map((f) => f.joints.ph)).toEqual([0, 1, 1, 0, 0]);
    expect(e63.frames.at(-1).caption).toContain('exit through');
    expect(e63.frames.at(-1).caption).not.toContain(' or ');

    const slug58 = slugOf(e58);
    const ds58 = e58.segmentDurationsMs;
    const total58 = ds58.reduce((a, b) => a + b, 0);
    const poses58 = e58.frames.map((f) => f.joints);
    let prevElbow58 = null;
    let minAnkleY58 = Infinity;
    let maxAnkleClearX58 = -Infinity;
    for (let t = 0; t <= total58; t += 33) {
      const p = rig.poseAtTime(poses58, t, ds58);
      const g = rig.chainGeometry(slug58, p.ph, BODY);
      const elbow = deg3D(g.world.near.shoulder, g.world.near.elbow, g.world.near.wrist);
      const feetAboveHands = g.world.near.ankle[1] > g.world.near.wrist[1] + 5 && g.world.far.ankle[1] > g.world.far.wrist[1] + 5;
      if (t > ds58[0] && prevElbow58 !== null && feetAboveHands) {
        expect(elbow).toBeLessThanOrEqual(prevElbow58 + 1e-4);
      }
      prevElbow58 = elbow;
      if (t > ds58[0]) {
        minAnkleY58 = Math.min(minAnkleY58, g.world.near.ankle[1], g.world.far.ankle[1]);
        maxAnkleClearX58 = Math.max(maxAnkleClearX58, g.world.near.ankle[0]);
      }
    }
    // Both feet reach the floor on the clear side during the exit
    const exitLanding = rig.chainGeometry(slug58, 3, BODY);
    expect(exitLanding.world.near.ankle[1]).toBeLessThanOrEqual(2.5);
    expect(exitLanding.world.far.ankle[1]).toBeLessThanOrEqual(2.5);
    expect(minAnkleY58).toBeLessThanOrEqual(2.5);
    expect(maxAnkleClearX58).toBeGreaterThan(25);
  });

  test('69 Pike Push-Up holds high hips in an inverted V, tracks elbows at about 45 degrees to lower the head just ahead of the hands, and presses back without the hips drifting forward', () => {
    // Quotes:
    // "Start in a push-up position, then walk your feet in and lift your hips high so your torso points at the floor like an inverted V."
    // "Bend your elbows and lower the top of your head towards the floor between your hands. Press back to long arms without the hips drifting forward."
    // "Hips stacked high the whole rep. Head travels to a spot just ahead of the hands. Elbows track at about 45 degrees."
    const row = rowFor(69);
    expect(row.source.instructions).toContain('Start in a push-up position, then walk your feet in and lift your hips high so your torso points at the floor like an inverted V.');
    expect(row.source.instructions).toContain('Bend your elbows and lower the top of your head towards the floor between your hands. Press back to long arms without the hips drifting forward.');
    expect(row.source.cues).toContain('Hips stacked high the whole rep. Head travels to a spot just ahead of the hands. Elbows track at about 45 degrees.');

    const e = entryFor(69);
    const slug = slugOf(e);
    const top = rig.chainGeometry(slug, 0, BODY);
    const bottom = rig.chainGeometry(slug, 1, BODY);

    // Inverted V: hips stacked high above both shoulders and ankles, included hip angle <= 105 deg
    expect(top.world.hip[1]).toBeGreaterThan(top.world.neck[1] + 14);
    expect(bottom.world.hip[1]).toBeGreaterThan(bottom.world.neck[1] + 16);
    expect(deg3D(top.world.neck, top.world.hip, top.world.near.ankle)).toBeLessThanOrEqual(105);
    expect(deg3D(bottom.world.neck, bottom.world.hip, bottom.world.near.ankle)).toBeLessThanOrEqual(105);

    // Head lowers toward a spot just ahead of the hands, while elbows bend from straight arms (>= 172 deg) and track at ~45 degrees
    expect(deg3D(top.world.near.shoulder, top.world.near.elbow, top.world.near.wrist)).toBeGreaterThanOrEqual(172);
    expect(deg3D(bottom.world.near.shoulder, bottom.world.near.elbow, bottom.world.near.wrist)).toBeLessThanOrEqual(95);
    expect(e.frames[1].caption).toContain('track back at about 45 degrees');
    expect(bottom.world.head[1]).toBeLessThanOrEqual(9.5);
    expect(bottom.world.head[0]).toBeGreaterThan(bottom.world.near.wrist[0] + 2.0);
    expect(bottom.world.head[0]).toBeLessThan(bottom.world.near.wrist[0] + 7.5);
    const elbowVecX = bottom.world.near.elbow[0] - bottom.world.near.shoulder[0];
    const elbowVecZ = bottom.world.near.elbow[2] - bottom.world.near.shoulder[2];
    const elbowTrackDeg = (Math.atan2(Math.abs(elbowVecZ), Math.abs(elbowVecX)) * 180) / Math.PI;
    expect(elbowTrackDeg).toBeGreaterThanOrEqual(30);
    expect(elbowTrackDeg).toBeLessThanOrEqual(60);

    // Hips never drift forward, and both hands and feet stay planted on the floor across every 33 ms tick
    const ds = e.segmentDurationsMs;
    const total = ds.reduce((a, b) => a + b, 0);
    const poses = e.frames.map((f) => f.joints);
    for (let t = 0; t <= total; t += 33) {
      const p = rig.poseAtTime(poses, t, ds);
      const g = rig.chainGeometry(slug, p.ph, BODY);
      expect(g.world.hip[0]).toBeLessThanOrEqual(top.world.hip[0] + 0.05);
      expect(Math.abs(g.world.hip[0] - top.world.hip[0])).toBeLessThanOrEqual(0.5);
      expect(dist3(g.world.near.wrist, top.world.near.wrist)).toBeLessThan(0.01);
      expect(dist3(g.world.far.wrist, top.world.far.wrist)).toBeLessThan(0.01);
      expect(dist3(g.world.near.ankle, top.world.near.ankle)).toBeLessThan(0.01);
      expect(dist3(g.world.far.ankle, top.world.far.ankle)).toBeLessThan(0.01);
    }
  });
});
