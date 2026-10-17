import fs from 'fs';
import path from 'path';
import * as rig from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const {
  CANONICAL_BODY_PARAMETERS,
  CHAIN_MOVEMENTS,
  V_HANDLE_HALF,
  chainGeometry,
  layoutCanonicalFigure,
} = rig;

const REPO_ROOT = path.resolve(__dirname, '../../../../');
const INDEX_PATH = path.join(
  REPO_ROOT,
  'apps/mobile/src/components/movementPreview/previewIndex.json',
);

const previewIndex = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
const byId = new Map(previewManifest.entries.map((entry) => [entry.movementId, entry]));

const BATCH_MOVEMENTS = [
  { id: 93, slug: 'renegade-row', name: 'Renegade Row' },
  { id: 195, slug: 'elevated-cable-rows', name: 'Elevated Cable Rows' },
  { id: 296, slug: 'upright-cable-row', name: 'Upright Cable Row' },
  { id: 243, slug: 'middle-back-shrug', name: 'Middle Back Shrug' },
  { id: 188, slug: 'dumbbell-lying-rear-lateral-raise', name: 'Dumbbell Lying Rear Lateral Raise' },
  { id: 241, slug: 'lying-rear-delt-raise', name: 'Lying Rear Delt Raise' },
  { id: 265, slug: 'seated-bent-over-rear-delt-raise', name: 'Seated Bent-Over Rear Delt Raise' },
];

const BODY = CANONICAL_BODY_PARAMETERS;
const SHOULDER_HALF = BODY.sw * 0.92;

function dist3D(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function deg3D(a, b, c) {
  const ux = a[0] - b[0];
  const uy = a[1] - b[1];
  const uz = a[2] - b[2];
  const vx = c[0] - b[0];
  const vy = c[1] - b[1];
  const vz = c[2] - b[2];
  const um = Math.hypot(ux, uy, uz) || 1;
  const vm = Math.hypot(vx, vy, vz) || 1;
  const cos = Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / (um * vm)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function sampleCycleGeometries(entry, stepMs = 33) {
  const totalMs = entry.segmentDurationsMs.reduce((acc, d) => acc + d, 0);
  const slug = entry.assetKey.split('/')[1];
  const poses = entry.frames.map((f) => f.joints);
  const samples = [];
  for (let t = 0; t <= totalMs; t += stepMs) {
    const pose = rig.poseAtTime(poses, t, entry.segmentDurationsMs);
    const geom = chainGeometry(slug, pose.ph ?? 0, BODY, pose.tw ?? 0);
    samples.push({ t, pose, geom });
  }
  return samples;
}

describe('MOV-A09 rows and rear raises: source-bound geometry & physics invariants', () => {
  test('all 7 movements are registered in CHAIN_MOVEMENTS, previewIndex.json, and movementPreviewManifest.json as pending', () => {
    for (const { id, slug } of BATCH_MOVEMENTS) {
      expect(CHAIN_MOVEMENTS[slug]).toBeDefined();
      expect(previewIndex.movementFamily[String(id)]).toBeDefined();
      const entry = byId.get(id);
      expect(entry).toBeDefined();
      expect(entry.status).toBe('pending');
      expect(entry.derivesFrom).toBeUndefined();
      expect(entry.assetKey).toBe(`movement/${slug}/demo/v1`);
      expect(entry.frames.length).toBeGreaterThanOrEqual(5);
      expect(entry.segmentDurationsMs.length).toBe(entry.frames.length - 1);
    }
  });

  test('every sampled 33ms tick across all 7 movements renders a single figure inside the [0..100] stage', () => {
    for (const { id, slug } of BATCH_MOVEMENTS) {
      const entry = byId.get(id);
      expect(entry).toBeDefined();
      const samples = sampleCycleGeometries(entry, 33);
      for (const { pose } of samples) {
        const prims = layoutCanonicalFigure(pose, {
          assetKey: `movement/${slug}/demo/v1`,
          view: entry.view,
          body: BODY,
        });
        const heads = prims.filter((p) => p.kind === 'circle' && Math.abs(p.r - BODY.hr) < 1e-6);
        expect(heads).toHaveLength(1);
        for (const p of prims) {
          if (p.kind === 'bone') {
            expect(Math.min(p.x1, p.x2)).toBeGreaterThanOrEqual(0);
            expect(Math.max(p.x1, p.x2)).toBeLessThanOrEqual(100);
            expect(Math.min(p.y1, p.y2)).toBeGreaterThanOrEqual(0);
            expect(Math.max(p.y1, p.y2)).toBeLessThanOrEqual(100);
          } else if (p.kind === 'circle') {
            expect(p.cx - p.r).toBeGreaterThanOrEqual(0);
            expect(p.cx + p.r).toBeLessThanOrEqual(100);
            expect(p.cy - p.r).toBeGreaterThanOrEqual(0);
            expect(p.cy + p.r).toBeLessThanOrEqual(100);
          } else if (p.kind === 'rect') {
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.x + p.w).toBeLessThanOrEqual(100);
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.y + p.h).toBeLessThanOrEqual(100);
          }
        }
      }
    }
  });

  test('93 Renegade Row: wide-foot push-up plank on two dumbbells, straight plank line (>=172 deg), alternating row to ribs with zero hip twist and unobstructed far-side top position', () => {
    const entry = byId.get(93);
    expect(entry).toBeDefined();
    // Text does not prescribe a pause at the top of the row: 5 frames [1, 0, 1, 2, 1], no duplicate hold keyframes
    expect(entry.frames.map((f) => f.joints.ph)).toEqual([1, 0, 1, 2, 1]);

    const plank = chainGeometry('renegade-row', 1, BODY);
    const rowNear = chainGeometry('renegade-row', 0, BODY);
    const rowFar = chainGeometry('renegade-row', 2, BODY);

    expect(plank.movement.implement).toBe('bells');
    // Feet wider than usual (wider than shoulder width)
    const footSpan = plank.world.near.ankle[2] - plank.world.far.ankle[2];
    expect(footSpan).toBeGreaterThanOrEqual(2 * SHOULDER_HALF + 6);

    // In the push-up plank (ph = 1), both supporting arms are straight (>= 172 deg) and dumbbells sit on the floor
    const nearPlankElbow = deg3D(plank.world.near.shoulder, plank.world.near.elbow, plank.world.near.wrist);
    const farPlankElbow = deg3D(plank.world.far.shoulder, plank.world.far.elbow, plank.world.far.wrist);
    expect(nearPlankElbow).toBeGreaterThanOrEqual(172);
    expect(farPlankElbow).toBeGreaterThanOrEqual(172);
    expect(plank.world.near.hold[1]).toBeLessThanOrEqual(4.5);
    expect(plank.world.far.hold[1]).toBeLessThanOrEqual(4.5);

    // Ribcage reference point along the spine (60% from hip to neck)
    const ribMid = [
      plank.world.hip[0] + 0.6 * (plank.world.neck[0] - plank.world.hip[0]),
      plank.world.hip[1] + 0.6 * (plank.world.neck[1] - plank.world.hip[1]),
      0,
    ];

    // At ph = 0, near dumbbell rows to the ribs while far dumbbell stays planted on the floor
    expect(rowNear.world.near.hold[1]).toBeGreaterThanOrEqual(18);
    expect(Math.abs(rowNear.world.near.hold[0] - ribMid[0])).toBeLessThanOrEqual(3.5);
    expect(Math.abs(rowNear.world.near.hold[1] - ribMid[1])).toBeLessThanOrEqual(3.5);
    expect(rowNear.world.near.elbow[1]).toBeGreaterThan(rowNear.world.neck[1]);
    expect(rowNear.world.far.hold[1]).toBeLessThanOrEqual(4.5);
    expect(deg3D(rowNear.world.far.shoulder, rowNear.world.far.elbow, rowNear.world.far.wrist)).toBeGreaterThanOrEqual(172);

    // At ph = 2, far dumbbell rows symmetrically to the ribs while near dumbbell stays planted on the floor
    expect(rowFar.world.far.hold[1]).toBeGreaterThanOrEqual(18);
    expect(Math.abs(rowFar.world.far.hold[0] - ribMid[0])).toBeLessThanOrEqual(3.5);
    expect(Math.abs(rowFar.world.far.hold[1] - ribMid[1])).toBeLessThanOrEqual(3.5);
    expect(rowFar.world.far.hold[0]).toBeCloseTo(rowNear.world.near.hold[0], 5);
    expect(rowFar.world.far.hold[1]).toBeCloseTo(rowNear.world.near.hold[1], 5);
    expect(rowFar.world.far.hold[2]).toBeCloseTo(-rowNear.world.near.hold[2], 5);
    expect(rowFar.world.far.elbow[1]).toBeGreaterThan(rowFar.world.neck[1]);
    expect(rowFar.world.near.hold[1]).toBeLessThanOrEqual(4.5);
    expect(deg3D(rowFar.world.near.shoulder, rowFar.world.near.elbow, rowFar.world.near.wrist)).toBeGreaterThanOrEqual(172);

    // Turned elevated view so BOTH rows (near at ph = 0 and far at ph = 2) sit outside the 2D painted torso silhouette
    const spineDx = plank.joints.nk[0] - plank.joints.hp[0];
    const spineDy = plank.joints.nk[1] - plank.joints.hp[1];
    const spineLen = Math.hypot(spineDx, spineDy);
    const perpFromSpine = (pt) =>
      Math.abs((pt[0] - plank.joints.hp[0]) * spineDy - (pt[1] - plank.joints.hp[1]) * spineDx) / spineLen;
    const trunkHalf = BODY.sw * 0.58;
    expect(perpFromSpine(rowNear.hold.near)).toBeGreaterThanOrEqual(trunkHalf + 2.0);
    expect(perpFromSpine(rowFar.hold.far)).toBeGreaterThanOrEqual(trunkHalf + 1.8);
    expect(perpFromSpine(rowFar.joints.ef)).toBeGreaterThanOrEqual(trunkHalf + 4.5);

    // Across every 33ms tick: straight knees (>= 172 deg), straight plank line (>= 172 deg), hips square (|roll| <= 1, |twist| <= 1), body stays a statue
    const samples = sampleCycleGeometries(entry, 33);
    for (const { geom } of samples) {
      expect(geom.curled).toBe(false);
      expect(Math.abs(geom.angles.roll)).toBeLessThanOrEqual(1);
      expect(Math.abs(geom.angles.twist)).toBeLessThanOrEqual(1);
      expect(dist3D(geom.world.hip, plank.world.hip)).toBeLessThan(0.1);
      expect(dist3D(geom.world.neck, plank.world.neck)).toBeLessThan(0.1);

      const nearKneeDeg = deg3D(geom.world.near.hipJoint, geom.world.near.knee, geom.world.near.ankle);
      const farKneeDeg = deg3D(geom.world.far.hipJoint, geom.world.far.knee, geom.world.far.ankle);
      expect(nearKneeDeg).toBeGreaterThanOrEqual(172);
      expect(farKneeDeg).toBeGreaterThanOrEqual(172);

      const ankleMid = [
        (geom.world.near.ankle[0] + geom.world.far.ankle[0]) / 2,
        (geom.world.near.ankle[1] + geom.world.far.ankle[1]) / 2,
        0,
      ];
      const plankLineDeg = deg3D(ankleMid, geom.world.hip, geom.world.neck);
      expect(plankLineDeg).toBeGreaterThanOrEqual(172);
    }
  });

  test('195 Elevated Cable Rows: seated on a low platform on the cable-row seat, painted foot-plate contact for both soles, single cable to a single rigid V-handle with palms facing, upright still torso, straight-arm reach (>=172 deg) to stomach and slow return', () => {
    const entry = byId.get(195);
    expect(entry).toBeDefined();
    const reach = chainGeometry('elevated-cable-rows', 0, BODY);
    const finish = chainGeometry('elevated-cable-rows', 1, BODY);
    const standardRow = chainGeometry('seated-cable-rows', 0, BODY);

    // Seated on a low platform placed on top of the cable-row seat: hips elevated above standard seated cable row
    const boxes = (reach.movement.equipment ?? []).filter((e) => e.kind === 'box');
    const slabs = (reach.movement.equipment ?? []).filter((e) => e.kind === 'slab');
    expect(boxes.length).toBeGreaterThanOrEqual(1);
    expect(slabs.length).toBeGreaterThanOrEqual(1);
    expect(reach.world.hip[1]).toBeGreaterThanOrEqual(standardRow.world.hip[1] + 4.5);

    // Knees slightly bent (both near and far legs)
    const nearKneeDeg = deg3D(reach.world.near.hipJoint, reach.world.near.knee, reach.world.near.ankle);
    const farKneeDeg = deg3D(reach.world.far.hipJoint, reach.world.far.knee, reach.world.far.ankle);
    expect(nearKneeDeg).toBeGreaterThanOrEqual(130);
    expect(nearKneeDeg).toBeLessThanOrEqual(168);
    expect(farKneeDeg).toBeGreaterThanOrEqual(130);
    expect(farKneeDeg).toBeLessThanOrEqual(168);

    // Single short rigid V-handle held by both hands (palms facing), connected to ONE cable from the pulley
    expect(reach.movement.implement).toBe('vHandle');
    expect(reach.angles.palmYaw).toBe(90);
    expect(reach.angles.farPalmYaw).toBe(90);
    expect(reach.world.near.palmDir[2]).toBeCloseTo(-1, 5);
    expect(reach.world.far.palmDir[2]).toBeCloseTo(1, 5);
    expect((reach.movement.lines ?? []).length).toBe(1);

    // Straight arms at full reach (>= 172 deg)
    expect(deg3D(reach.world.near.shoulder, reach.world.near.elbow, reach.world.near.wrist)).toBeGreaterThanOrEqual(172);
    expect(deg3D(reach.world.far.shoulder, reach.world.far.elbow, reach.world.far.wrist)).toBeGreaterThanOrEqual(172);

    // Pulled to the stomach with elbows close to the body and passing behind the spine
    expect(finish.world.near.hold[0]).toBeLessThanOrEqual(8.5);
    expect(finish.world.near.elbow[0]).toBeLessThan(finish.world.hip[0]);
    expect(finish.world.near.elbow[2]).toBeLessThanOrEqual(SHOULDER_HALF + 3.5);

    // Foot-plate rails at the near and far foot Z planes
    const frames = (reach.movement.equipment ?? []).filter((e) => e.kind === 'frame');
    const nearPlate = frames.find((f) => f.a[0] > 40 && f.a[0] < 46 && (f.a[2] ?? 0) > 0);
    const farPlate = frames.find((f) => f.a[0] > 40 && f.a[0] < 46 && (f.a[2] ?? 0) < 0);
    expect(nearPlate).toBeDefined();
    expect(farPlate).toBeDefined();

    const segDist2D = (a, b, p) => {
      const ux = b[0] - a[0], uy = b[1] - a[1];
      const lenSq = ux * ux + uy * uy || 1;
      const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * ux + (p[1] - a[1]) * uy) / lenSq));
      return Math.hypot(p[0] - (a[0] + ux * k), p[1] - (a[1] + uy * k));
    };
    const footRadius = reach.footWidth / 2;
    const plateRadius = 0.8;
    const contactSum = footRadius + plateRadius;
    const pulleyProj = reach.project([58, 14, 0]);

    // Across every 33ms tick: upright still torso, painted foot-plate contact for both soles, 1 cable line, and V-handle ends fixed at the hands
    const samples = sampleCycleGeometries(entry, 33);
    for (const { pose, geom } of samples) {
      expect(geom.curled).toBe(false);
      expect(geom.angles.trunk[0]).toBeCloseTo(90, 2);
      expect(dist3D(geom.world.hip, reach.world.hip)).toBeLessThan(0.1);
      expect(dist3D(geom.world.neck, reach.world.neck)).toBeLessThan(0.1);

      // 3D world contact of both soles (ankle and toe) against the foot plate
      expect(geom.world.near.ankle[2]).toBeCloseTo(nearPlate.a[2], 5);
      expect(geom.world.far.ankle[2]).toBeCloseTo(farPlate.a[2], 5);
      const nearAnkle3D = segDist2D(nearPlate.a, nearPlate.b, geom.world.near.ankle);
      const nearToe3D = segDist2D(nearPlate.a, nearPlate.b, geom.world.near.toe);
      const farAnkle3D = segDist2D(farPlate.a, farPlate.b, geom.world.far.ankle);
      const farToe3D = segDist2D(farPlate.a, farPlate.b, geom.world.far.toe);
      expect(nearAnkle3D).toBeGreaterThanOrEqual(contactSum - 0.35);
      expect(nearAnkle3D).toBeLessThanOrEqual(contactSum + 0.35);
      expect(nearToe3D).toBeGreaterThanOrEqual(contactSum - 0.35);
      expect(nearToe3D).toBeLessThanOrEqual(contactSum + 0.35);
      expect(farAnkle3D).toBeGreaterThanOrEqual(contactSum - 0.35);
      expect(farAnkle3D).toBeLessThanOrEqual(contactSum + 0.35);
      expect(farToe3D).toBeGreaterThanOrEqual(contactSum - 0.35);
      expect(farToe3D).toBeLessThanOrEqual(contactSum + 0.35);

      // 2D painted contact on the rendered canvas: sole outer surface touches/overlaps the foot-plate outer surface with 0 gap
      const nearPlateA = geom.project(nearPlate.a);
      const nearPlateB = geom.project(nearPlate.b);
      const farPlateA = geom.project(farPlate.a);
      const farPlateB = geom.project(farPlate.b);
      expect(segDist2D(nearPlateA, nearPlateB, geom.joints.an)).toBeLessThanOrEqual(contactSum + 0.05);
      expect(segDist2D(nearPlateA, nearPlateB, geom.toe.near)).toBeLessThanOrEqual(contactSum + 0.05);
      expect(segDist2D(farPlateA, farPlateB, geom.joints.af)).toBeLessThanOrEqual(contactSum + 0.05);
      expect(segDist2D(farPlateA, farPlateB, geom.toe.far)).toBeLessThanOrEqual(contactSum + 0.05);

      // Rigid V-handle span and single cable primitive in emitted layout
      expect(dist3D(geom.world.near.hold, geom.world.far.hold)).toBeCloseTo(2 * V_HANDLE_HALF, 5);
      const prims = layoutCanonicalFigure(pose, {
        assetKey: entry.assetKey,
        view: entry.view,
        body: BODY,
      });
      const cableLines = prims.filter((p) => p.kind === 'bone' && Math.abs(p.w - 1.4) < 1e-6 && p.color === 'textMid');
      expect(cableLines).toHaveLength(1);
      const cable = cableLines[0];
      expect(Math.hypot(cable.x1 - pulleyProj[0], cable.y1 - pulleyProj[1])).toBeLessThan(1e-5);

      const vBranches = prims.filter(
        (p) => p.kind === 'bone' && Math.abs(p.w - 2.0) < 1e-6 && p.color === 'textHi'
          && Math.hypot(p.x1 - cable.x2, p.y1 - cable.y2) < 1e-5,
      );
      expect(vBranches).toHaveLength(2);
      const endsAtHands = [geom.hold.near, geom.hold.far].every((h) =>
        vBranches.some((b) => Math.hypot(b.x2 - h[0], b.y2 - h[1]) < 1e-5),
      );
      expect(endsAtHands).toBe(true);
    }

    // Cable strictly lengthens on the pull and shortens on the slow return
    const pulley = [58, 14, 0];
    expect(dist3D(pulley, finish.world.near.hold)).toBeGreaterThan(dist3D(pulley, reach.world.near.hold) + 5);
    expect(entry.segmentDurationsMs[2]).toBeGreaterThan(entry.segmentDurationsMs[0]);
  });

  test('296 Upright Cable Row: standing tall facing low pulley, readable overhand grip (palmYaw = 180 + handCloseUp) slightly narrower than shoulders on straight bar at thighs (arms >=172 deg), lifted close to body toward chin with elbows higher than hands', () => {
    const entry = byId.get(296);
    expect(entry).toBeDefined();
    const bottom = chainGeometry('upright-cable-row', 0, BODY);
    const top = chainGeometry('upright-cable-row', 1, BODY);

    expect(bottom.movement.implement).toBe('cableBar');
    // Overhand grip slightly narrower than the shoulders, with readable palm close-up showing pronated overhand orientation
    const gripHalf = bottom.world.near.hold[2];
    expect(gripHalf).toBeGreaterThanOrEqual(SHOULDER_HALF * 0.55);
    expect(gripHalf).toBeLessThanOrEqual(SHOULDER_HALF * 0.85);
    expect(bottom.angles.palmYaw).toBe(180);
    expect(bottom.angles.farPalmYaw).toBe(180);
    expect(top.angles.palmYaw).toBe(180);
    expect(top.angles.farPalmYaw).toBe(180);
    expect(bottom.world.near.palmDir[0]).toBeCloseTo(-1, 5);
    const bottomPanel = rig.handCloseUp(bottom);
    const topPanel = rig.handCloseUp(top);
    expect(bottomPanel).not.toBeNull();
    expect(topPanel).not.toBeNull();
    expect(bottomPanel.palmYaw).toBe(180);
    expect(bottomPanel.palmFacingViewer).toBe(false);
    expect(topPanel.palmYaw).toBe(180);
    expect(topPanel.palmFacingViewer).toBe(false);

    // At the bottom against the thighs, arms are straight (>= 172 deg)
    expect(deg3D(bottom.world.near.shoulder, bottom.world.near.elbow, bottom.world.near.wrist)).toBeGreaterThanOrEqual(172);
    expect(deg3D(bottom.world.far.shoulder, bottom.world.far.elbow, bottom.world.far.wrist)).toBeGreaterThanOrEqual(172);

    // Lifted close to the body toward the chin, elbows up and out and higher than the hands
    expect(top.world.neck[1] - top.world.near.hold[1]).toBeLessThanOrEqual(2.0);
    expect(top.world.near.elbow[1]).toBeGreaterThan(top.world.near.wrist[1] + 4.0);
    expect(top.world.far.elbow[1]).toBeGreaterThan(top.world.far.wrist[1] + 4.0);
    expect(top.joints.el[1]).toBeLessThan(top.joints.wr[1] - 3.0);
    expect(top.joints.ef[1]).toBeLessThan(top.joints.wf[1] - 3.0);

    // Standing tall (knees >= 172 deg, trunk 90 deg), rigid grip span, and bar stays close to the body across every tick
    const startSpan = dist3D(bottom.world.near.hold, bottom.world.far.hold);
    const samples = sampleCycleGeometries(entry, 33);
    for (const { geom } of samples) {
      expect(geom.curled).toBe(false);
      expect(geom.angles.trunk[0]).toBeCloseTo(90, 2);
      expect(deg3D(geom.world.near.hipJoint, geom.world.near.knee, geom.world.near.ankle)).toBeGreaterThanOrEqual(172);
      expect(deg3D(geom.world.far.hipJoint, geom.world.far.knee, geom.world.far.ankle)).toBeGreaterThanOrEqual(172);
      expect(Math.abs(geom.world.near.hold[0] - geom.world.neck[0])).toBeLessThanOrEqual(7.0);
      expect(dist3D(geom.world.near.hold, geom.world.far.hold)).toBeCloseTo(startSpan, 5);
      const panel = rig.handCloseUp(geom);
      expect(panel).not.toBeNull();
      expect(panel.palmFacingViewer).toBe(false);
    }

    // Pause at top and slower lowering
    expect(entry.segmentDurationsMs[1]).toBeGreaterThanOrEqual(400);
    expect(entry.segmentDurationsMs[2]).toBeGreaterThan(entry.segmentDurationsMs[0]);
  });

  test('243 Middle Back Shrug: chest down on incline bench viewed from above/behind with upper-back close-up, dumbbells in straight hanging arms (>=172 deg at every tick), shoulder blades visibly pull back and together without bending elbows', () => {
    const entry = byId.get(243);
    expect(entry).toBeDefined();
    const bottom = chainGeometry('middle-back-shrug', 0, BODY);
    const top = chainGeometry('middle-back-shrug', 1, BODY);

    expect(bottom.movement.implement).toBe('bells');
    expect(bottom.angles.trunk[0]).toBeGreaterThanOrEqual(30);
    expect(bottom.angles.trunk[0]).toBeLessThanOrEqual(45);
    expect(bottom.movement.yawDeg).toBeGreaterThanOrEqual(48);

    // Shoulder blades pull back (dorsally up and back) and together (narrower span in both 3D world and 2D projected screen) while chest stays on bench
    expect(dist3D(top.world.hip, bottom.world.hip)).toBeLessThan(0.1);
    expect(dist3D(top.world.neck, bottom.world.neck)).toBeLessThan(0.1);
    expect(top.world.near.shoulder[1] - bottom.world.near.shoulder[1]).toBeGreaterThanOrEqual(3.0);
    expect(bottom.world.near.shoulder[0] - top.world.near.shoulder[0]).toBeGreaterThanOrEqual(2.0);
    expect(top.world.near.hold[1] - bottom.world.near.hold[1]).toBeGreaterThanOrEqual(3.0);
    const bottomShoulderSpan = bottom.world.near.shoulder[2] - bottom.world.far.shoulder[2];
    const topShoulderSpan = top.world.near.shoulder[2] - top.world.far.shoulder[2];
    expect(bottomShoulderSpan - topShoulderSpan).toBeGreaterThanOrEqual(2.5);

    const bottomScreenSpan = Math.hypot(
      bottom.joints.nArm[0] - bottom.joints.fArm[0],
      bottom.joints.nArm[1] - bottom.joints.fArm[1],
    );
    const topScreenSpan = Math.hypot(
      top.joints.nArm[0] - top.joints.fArm[0],
      top.joints.nArm[1] - top.joints.fArm[1],
    );
    expect(bottomScreenSpan - topScreenSpan).toBeGreaterThanOrEqual(3.5);

    // Upper-back close-up panel shows the two shoulder blades pinching together toward the spine
    const bottomBackPanel = rig.upperBackCloseUp(bottom);
    const topBackPanel = rig.upperBackCloseUp(top);
    expect(bottomBackPanel).not.toBeNull();
    expect(topBackPanel).not.toBeNull();
    expect(bottomBackPanel.bladeSpan - topBackPanel.bladeSpan).toBeGreaterThanOrEqual(6.0);

    // Arms stay straight (>= 172 deg) at every single 33ms tick without bending the elbows
    const samples = sampleCycleGeometries(entry, 33);
    const baseNearElbow = deg3D(bottom.world.near.shoulder, bottom.world.near.elbow, bottom.world.near.wrist);
    for (const { geom } of samples) {
      const nearElbow = deg3D(geom.world.near.shoulder, geom.world.near.elbow, geom.world.near.wrist);
      const farElbow = deg3D(geom.world.far.shoulder, geom.world.far.elbow, geom.world.far.wrist);
      expect(nearElbow).toBeGreaterThanOrEqual(172);
      expect(farElbow).toBeGreaterThanOrEqual(172);
      expect(Math.abs(nearElbow - baseNearElbow)).toBeLessThan(0.5);
    }

    // Pause at the top and controlled lower
    expect(entry.segmentDurationsMs[1]).toBeGreaterThanOrEqual(400);
    expect(entry.segmentDurationsMs[2]).toBeGreaterThan(entry.segmentDurationsMs[0]);
  });

  test('188 Dumbbell Lying Rear Lateral Raise & 241 Lying Rear Delt Raise: 15-deg shallow incline vs 0-deg flat bench, readable palms facing torso (palmYaw = 90 + handCloseUp), elbows slightly bent, raised to shoulder height and parallel to floor, 1s hold', () => {
    const entry188 = byId.get(188);
    const entry241 = byId.get(241);
    expect(entry188).toBeDefined();
    expect(entry241).toBeDefined();

    const low188 = chainGeometry('dumbbell-lying-rear-lateral-raise', 0, BODY);
    const top188 = chainGeometry('dumbbell-lying-rear-lateral-raise', 1, BODY);
    const low241 = chainGeometry('lying-rear-delt-raise', 0, BODY);
    const top241 = chainGeometry('lying-rear-delt-raise', 1, BODY);

    // 188 is set to a shallow incline of 15 degrees; 241 is on a flat bench (0 degrees)
    expect(low188.angles.trunk[0]).toBeCloseTo(15, 1);
    expect(low241.angles.trunk[0]).toBeCloseTo(0, 1);
    expect(low188.angles.trunk[0] - low241.angles.trunk[0]).toBeCloseTo(15, 1);

    const slab188 = (low188.movement.equipment ?? []).find((e) => e.kind === 'slab');
    const slab241 = (low241.movement.equipment ?? []).find((e) => e.kind === 'slab');
    expect(slab188).toBeDefined();
    expect(slab241).toBeDefined();
    const slabDeg188 = (Math.atan2(slab188.b[1] - slab188.a[1], slab188.b[0] - slab188.a[0]) * 180) / Math.PI;
    const slabDeg241 = (Math.atan2(slab241.b[1] - slab241.a[1], slab241.b[0] - slab241.a[0]) * 180) / Math.PI;
    expect(slabDeg188).toBeCloseTo(15, 1);
    expect(slabDeg241).toBeCloseTo(0, 1);

    for (const [entry, low, top] of [
      [entry188, low188, top188],
      [entry241, low241, top241],
    ]) {
      expect(low.movement.implement).toBe('bells');
      // Palms facing the torso (palmYaw = 90, farPalmYaw = 90) and readable handCloseUp panel
      expect(low.angles.palmYaw).toBe(90);
      expect(low.angles.farPalmYaw).toBe(90);
      expect(top.angles.palmYaw).toBe(90);
      expect(top.angles.farPalmYaw).toBe(90);
      expect(low.world.near.palmDir[2]).toBeCloseTo(-1, 5);
      expect(low.world.far.palmDir[2]).toBeCloseTo(1, 5);
      const lowPanel = rig.handCloseUp(low);
      const topPanel = rig.handCloseUp(top);
      expect(lowPanel).not.toBeNull();
      expect(topPanel).not.toBeNull();
      expect(lowPanel.palmYaw).toBe(90);
      expect(topPanel.palmYaw).toBe(90);

      // At the top, elbows reach shoulder height and arms are roughly parallel to the floor
      expect(Math.abs(top.world.near.elbow[1] - top.world.near.shoulder[1])).toBeLessThanOrEqual(1.0);
      expect(Math.abs(top.world.far.elbow[1] - top.world.far.shoulder[1])).toBeLessThanOrEqual(1.0);
      expect(Math.abs(top.world.near.wrist[1] - top.world.near.shoulder[1])).toBeLessThanOrEqual(2.5);
      expect(top.world.near.hold[2] - top.world.far.hold[2]).toBeGreaterThan(50);

      // One-second hold at the top and controlled lower
      expect(entry.segmentDurationsMs[1]).toBeGreaterThanOrEqual(900);
      expect(entry.segmentDurationsMs[1]).toBeLessThanOrEqual(1100);
      expect(entry.segmentDurationsMs[2]).toBeGreaterThan(entry.segmentDurationsMs[0]);

      // Fixed slight elbow bend, stationary chest on bench, and readable palm close-up across every 33ms tick
      const samples = sampleCycleGeometries(entry, 33);
      const baseElbow = deg3D(low.world.near.shoulder, low.world.near.elbow, low.world.near.wrist);
      expect(baseElbow).toBeGreaterThanOrEqual(162);
      expect(baseElbow).toBeLessThanOrEqual(172);
      for (const { geom } of samples) {
        expect(geom.curled).toBe(false);
        expect(dist3D(geom.world.hip, low.world.hip)).toBeLessThan(0.1);
        expect(dist3D(geom.world.neck, low.world.neck)).toBeLessThan(0.1);
        const elbow = deg3D(geom.world.near.shoulder, geom.world.near.elbow, geom.world.near.wrist);
        expect(Math.abs(elbow - baseElbow)).toBeLessThan(1.0);
        const panel = rig.handCloseUp(geom);
        expect(panel).not.toBeNull();
        expect(panel.palmYaw).toBe(90);
      }
    }
  });

  test('265 Seated Bent-Over Rear Delt Raise: seated on end of flat bench, feet together, bent forward with straight back, dumbbells behind calves with palms in, lifted out to sides until level with floor', () => {
    const entry = byId.get(265);
    expect(entry).toBeDefined();
    const bottom = chainGeometry('seated-bent-over-rear-delt-raise', 0, BODY);
    const top = chainGeometry('seated-bent-over-rear-delt-raise', 1, BODY);

    // Seated on the end of a flat bench with feet together
    const slabs = (bottom.movement.equipment ?? []).filter((e) => e.kind === 'slab');
    expect(slabs.length).toBeGreaterThanOrEqual(1);
    expect(bottom.world.near.ankle[2] - bottom.world.far.ankle[2]).toBeLessThanOrEqual(5.0);

    // Bent forward from the hips with the back straight
    expect(bottom.curled).toBe(false);
    expect(bottom.angles.trunk[0]).toBeGreaterThanOrEqual(20);
    expect(bottom.angles.trunk[0]).toBeLessThanOrEqual(32);

    // Dumbbells held behind the calves at the start, palms facing each other
    expect(bottom.movement.implement).toBe('bells');
    expect(bottom.angles.palmYaw).toBe(90);
    expect(bottom.angles.farPalmYaw).toBe(90);
    expect(bottom.world.near.hold[0]).toBeLessThan(bottom.world.near.ankle[0] - 2.5);
    expect(bottom.world.near.hold[0]).toBeLessThan(bottom.world.near.knee[0] - 2.5);
    expect(bottom.world.near.hold[1]).toBeGreaterThan(bottom.world.near.ankle[1]);
    expect(bottom.world.near.hold[1]).toBeLessThan(bottom.world.near.knee[1]);

    // Lifted straight out to the sides until the arms are level with the floor
    expect(Math.abs(top.world.near.elbow[1] - top.world.near.shoulder[1])).toBeLessThanOrEqual(1.0);
    expect(Math.abs(top.world.far.elbow[1] - top.world.far.shoulder[1])).toBeLessThanOrEqual(1.0);
    expect(Math.abs(top.world.near.wrist[1] - top.world.near.shoulder[1])).toBeLessThanOrEqual(2.5);
    expect(top.world.near.hold[2] - top.world.far.hold[2]).toBeGreaterThan(50);

    // Torso stays down and still and elbow bend stays slightly bent across every 33ms tick
    const samples = sampleCycleGeometries(entry, 33);
    const baseElbow = deg3D(bottom.world.near.shoulder, bottom.world.near.elbow, bottom.world.near.wrist);
    expect(baseElbow).toBeGreaterThanOrEqual(162);
    expect(baseElbow).toBeLessThanOrEqual(172);
    for (const { geom } of samples) {
      expect(geom.curled).toBe(false);
      expect(dist3D(geom.world.hip, bottom.world.hip)).toBeLessThan(0.1);
      expect(dist3D(geom.world.neck, bottom.world.neck)).toBeLessThan(0.1);
      const elbow = deg3D(geom.world.near.shoulder, geom.world.near.elbow, geom.world.near.wrist);
      expect(Math.abs(elbow - baseElbow)).toBeLessThan(1.0);
    }

    // Pause at the top and slow lower
    expect(entry.segmentDurationsMs[1]).toBeGreaterThanOrEqual(400);
    expect(entry.segmentDurationsMs[2]).toBeGreaterThan(entry.segmentDurationsMs[0]);
  });
});
