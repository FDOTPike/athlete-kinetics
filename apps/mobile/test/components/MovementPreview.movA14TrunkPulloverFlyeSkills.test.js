import {
  CANONICAL_BODY_PARAMETERS,
  CHAIN_ANKLE_HEIGHT,
  CHAIN_LYING_HEIGHT,
  CHAIN_MOVEMENTS,
  EQUIPMENT_BY_SLUG,
  chainGeometry,
  layoutCanonicalFigure,
  poseAtTime,
  resolveFigureJoints,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';
import catalogue from '../../../../docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json';

const BODY = CANONICAL_BODY_PARAMETERS;
const FLOOR = 96.9;

const MOV_A14_IDS = [33, 137, 119, 204, 149, 289, 148, 201, 217, 121, 231];

const entryById = (id) => previewManifest.entries.find((e) => e.movementId === id);
const catById = (id) => catalogue.movements.find((e) => e.id === id);
const slugOf = (entry) => entry.assetKey.split('/')[1];
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

function jointAngleDeg(a, b, c) {
  const ux = a[0] - b[0], uy = a[1] - b[1], uz = (a[2] ?? 0) - (b[2] ?? 0);
  const vx = c[0] - b[0], vy = c[1] - b[1], vz = (c[2] ?? 0) - (b[2] ?? 0);
  const nu = Math.hypot(ux, uy, uz) || 1;
  const nv = Math.hypot(vx, vy, vz) || 1;
  const cos = Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / (nu * nv)));
  return Math.acos(cos) * 180 / Math.PI;
}

function sampleEntry(id) {
  const entry = entryById(id);
  expect(entry).toBeDefined();
  const slug = slugOf(entry);
  const movement = CHAIN_MOVEMENTS[slug];
  expect(movement).toBeDefined();
  const opts = { ...entry, body: BODY };
  const total = entry.segmentDurationsMs.reduce((a, b) => a + b, 0);
  const ticks = [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];
  const at = (t) => {
    const pose = poseAtTime(entry.frames.map((f) => f.joints), t, entry.segmentDurationsMs);
    return {
      t,
      pose,
      figure: chainGeometry(slug, pose.ph, BODY, pose.tw ?? 0),
      joints: resolveFigureJoints(pose, opts),
      prims: layoutCanonicalFigure(pose, opts),
    };
  };
  const atPhase = (ph) => ({
    ph,
    figure: chainGeometry(slug, ph, BODY, 0),
    joints: resolveFigureJoints({ ph }, opts),
    prims: layoutCanonicalFigure({ ph }, opts),
  });
  return { entry, slug, movement, total, ticks, at, atPhase };
}

describe('MOV-A14 trunk, pullovers, flyes and kettlebell skills (33, 137, 119, 204, 149, 289, 148, 201, 217, 121, 231)', () => {
  test('all 11 MOV-A14 movements are authored as pending drafts with source-bound captions and registered equipment', () => {
    for (const id of MOV_A14_IDS) {
      const { entry, slug } = sampleEntry(id);
      const cat = catById(id);
      expect(cat).toBeDefined();
      expect(entry.status).toBe('pending');
      expect(entry.frames.length).toBeGreaterThanOrEqual(id === 231 ? 7 : 5);
      expect(EQUIPMENT_BY_SLUG[slug]).toBeDefined();
      for (const frame of entry.frames) {
        expect(typeof frame.caption).toBe('string');
        expect(frame.caption.trim().length).toBeGreaterThan(10);
      }
    }
  });

  test('every barbell movement in MOV-A14 (33, 137, 148) keeps a rigid bar with constant 3D hand-to-hand distance across every tick', () => {
    for (const id of [33, 137, 148]) {
      const { ticks, at } = sampleEntry(id);
      const spans = ticks.map((t) => {
        const w = at(t).figure.world;
        return dist(w.near.wrist, w.far.wrist);
      });
      const first = spans[0];
      expect(first).toBeGreaterThan(15);
      for (const s of spans) {
        expect(Math.abs(s - first)).toBeLessThan(1e-6);
      }
    }
  });

  test('33 Barbell Ab Rollout: knees stay on the floor, small-plate bar rolls forward on the floor with straight arms, and hips never sag below the knee-to-shoulder line', () => {
    const { ticks, at, atPhase } = sampleEntry(33);
    const start = atPhase(0);
    const out = atPhase(4);

    // Roll forward a long distance on the floor
    expect(out.figure.world.near.wrist[0] - start.figure.world.near.wrist[0]).toBeGreaterThan(26);

    for (const t of ticks) {
      const { figure, prims } = at(t);
      const w = figure.world;
      // Knees stay on the floor
      expect(w.near.knee[1]).toBeCloseTo(2.842, 2);
      expect(w.far.knee[1]).toBeCloseTo(2.842, 2);
      expect(w.near.knee[0]).toBeCloseTo(start.figure.world.near.knee[0], 5);

      // Bar plates roll on the floor at every tick
      expect(w.near.wrist[1]).toBeCloseTo(5.45, 1);
      expect(w.far.wrist[1]).toBeCloseTo(5.45, 1);
      const plateBottoms = prims
        .filter((p) => p.kind === 'bone' && p.stroke === 'ink1')
        .map((p) => Math.max(p.y1, p.y2) + p.w / 2);
      expect(plateBottoms.length).toBe(2);
      expect(Math.max(...plateBottoms)).toBeCloseTo(FLOOR, 0);

      // Arms stay straight (>= 172 deg)
      expect(jointAngleDeg(w.near.shoulder, w.near.elbow, w.near.wrist)).toBeGreaterThanOrEqual(172);
      expect(jointAngleDeg(w.far.shoulder, w.far.elbow, w.far.wrist)).toBeGreaterThanOrEqual(172);

      // Hips never sag: hip Y stays strictly above the straight line from knee to neck, and spine stays tucked (curl > 0)
      const knee = w.near.knee;
      const neck = w.neck;
      const u = (w.hip[0] - knee[0]) / ((neck[0] - knee[0]) || 1);
      const lineY = knee[1] + (neck[1] - knee[1]) * u;
      expect(w.hip[1]).toBeGreaterThanOrEqual(lineY + 1.0);
      expect(figure.angles.curl).toBeGreaterThanOrEqual(10);
    }
  });

  test('137 Barbell Rollout from Bench: differs from 33 by kneeling on an elevated bench while the bar rolls on the floor below the bench end with straight arms', () => {
    const rollFloor = sampleEntry(33);
    const rollBench = sampleEntry(137);
    const start = rollBench.atPhase(0);
    const out = rollBench.atPhase(4);

    // Knees in 137 are elevated on the bench (9 units higher than 33's floor-kneeling knees)
    expect(start.figure.world.near.knee[1] - rollFloor.atPhase(0).figure.world.near.knee[1]).toBeGreaterThanOrEqual(8.5);
    // Hips extend as the bar rolls forward until arms reach overhead
    expect(out.figure.world.near.wrist[0] - start.figure.world.near.wrist[0]).toBeGreaterThan(22);
    expect(jointAngleDeg(out.figure.world.near.knee, out.figure.world.hip, out.figure.world.neck)).toBeGreaterThan(
      jointAngleDeg(start.figure.world.near.knee, start.figure.world.hip, start.figure.world.neck) + 25,
    );

    for (const t of rollBench.ticks) {
      const { figure, prims } = rollBench.at(t);
      const w = figure.world;
      // Knees stay on the bench at y = 11.842 (bench top y = 9.0)
      expect(w.near.knee[1]).toBeCloseTo(11.842, 2);
      expect(w.far.knee[1]).toBeCloseTo(11.842, 2);
      // Bar stays on the floor ahead of the bench end (x > -10)
      expect(w.near.wrist[0]).toBeGreaterThan(-6);
      expect(w.near.wrist[1]).toBeCloseTo(5.45, 1);
      expect(w.far.wrist[1]).toBeCloseTo(5.45, 1);
      const plateBottoms = prims
        .filter((p) => p.kind === 'bone' && p.stroke === 'ink1')
        .map((p) => Math.max(p.y1, p.y2) + p.w / 2);
      expect(Math.max(...plateBottoms)).toBeCloseTo(FLOOR, 0);

      // Arms stay straight (>= 172 deg)
      expect(jointAngleDeg(w.near.shoulder, w.near.elbow, w.near.wrist)).toBeGreaterThanOrEqual(172);
      expect(jointAngleDeg(w.far.shoulder, w.far.elbow, w.far.wrist)).toBeGreaterThanOrEqual(172);

      // Hips never sag below the knee-to-shoulder line
      const knee = w.near.knee;
      const neck = w.neck;
      const u = (w.hip[0] - knee[0]) / ((neck[0] - knee[0]) || 1);
      const lineY = knee[1] + (neck[1] - knee[1]) * u;
      expect(w.hip[1]).toBeGreaterThanOrEqual(lineY + 0.5);
    }
  });

  test('119 Decline Crunch: legs secured on decline bench, lower back stays pressed to the pad across every tick while upper spine curls ribs toward pelvis and holds', () => {
    const { entry, movement, ticks, at, atPhase } = sampleEntry(119);
    expect(movement.spine).toBe('upper');
    const bottom = atPhase(0);
    const top = atPhase(1);

    // Upper spine curls shoulder blades up, bringing ribs/neck toward pelvis without sitting tall
    expect(top.figure.angles.curl).toBeGreaterThanOrEqual(40);
    expect(top.figure.world.neck[1] - bottom.figure.world.neck[1]).toBeGreaterThan(6);
    expect(dist(top.figure.world.neck, top.figure.world.hip)).toBeLessThan(
      dist(bottom.figure.world.neck, bottom.figure.world.hip) - 1.2,
    );

    // Top hold and slow unroll
    expect(entry.frames[1].joints.ph).toBe(1);
    expect(entry.frames[2].joints.ph).toBe(1);
    expect(entry.segmentDurationsMs[2]).toBeGreaterThan(entry.segmentDurationsMs[0]);

    // Lower back (first 40% of spine, indices 0..12) stays pressed to the decline pad at identical coordinates on every tick
    const baseLowerSpine = bottom.figure.world.spine.slice(0, 13);
    for (const t of ticks) {
      const w = at(t).figure.world;
      for (let i = 0; i <= 12; i++) {
        expect(dist(w.spine[i], baseLowerSpine[i])).toBeLessThan(1e-6);
      }
      // Fingertips stay lightly beside the temples (near head)
      expect(dist(w.near.grip, w.head)).toBeLessThan(9.6);
    }
  });

  test('204 Frog Sit-Ups: soles of the feet together with knees dropped wide out to the sides, lower back flat on the floor, short upper-spine curl with pause and slow lower', () => {
    const { entry, movement, ticks, at, atPhase } = sampleEntry(204);
    expect(movement.view).toBe('oblique');
    expect(movement.spine).toBe('upper');

    const bottom = atPhase(0);
    const top = atPhase(1);
    // Short curl (not a full sit-up)
    expect(top.figure.angles.curl).toBeGreaterThanOrEqual(32);
    expect(top.figure.angles.curl).toBeLessThanOrEqual(45);
    expect(top.figure.world.neck[1] - bottom.figure.world.neck[1]).toBeGreaterThan(4.5);
    expect(top.figure.world.neck[1] - bottom.figure.world.neck[1]).toBeLessThan(14.0);

    // Pause at top, lower slowly
    expect(entry.frames[1].joints.ph).toBe(1);
    expect(entry.frames[2].joints.ph).toBe(1);
    expect(entry.segmentDurationsMs[2]).toBeGreaterThan(entry.segmentDurationsMs[0]);

    const baseLowerSpine = bottom.figure.world.spine.slice(0, 13);
    for (const t of ticks) {
      const { figure, joints } = at(t);
      const w = figure.world;
      // Lower back stays flat on the floor across every tick
      for (let i = 0; i <= 12; i++) {
        expect(dist(w.spine[i], baseLowerSpine[i])).toBeLessThan(1e-6);
        expect(w.spine[i][1]).toBeCloseTo(CHAIN_LYING_HEIGHT, 5);
      }
      // Soles of the feet together at the midline while knees drop wide out to the sides
      expect(Math.abs(w.near.ankle[2] - w.far.ankle[2])).toBeLessThanOrEqual(3.6);
      expect(Math.abs(w.near.toe[2] - w.far.toe[2])).toBeLessThanOrEqual(1.5);
      expect(w.near.knee[2] - w.far.knee[2]).toBeGreaterThan(30);
      // Projected frog knees are visibly separated in the oblique view
      expect(Math.abs(joints.kn[0] - joints.kf[0])).toBeGreaterThan(15);
    }
  });

  test('149 Bent-Arm Dumbbell Pullover & 289 Straight-Arm Dumbbell Pullover: both lie across the bench with only shoulders supported and hips low; 149 holds fixed bent elbows while 289 holds straight arms (>= 172 deg) through a wider arc', () => {
    const bent = sampleEntry(149);
    const straight = sampleEntry(289);

    for (const s of [bent, straight]) {
      expect(s.movement.implement).toBe('bell');
      for (const t of s.ticks) {
        const w = s.at(t).figure.world;
        // Only shoulders on the perpendicular bench [-24, -10]; hips hang low ahead of the bench (x > 0, y < neck[1] - 5)
        expect(w.neck[0]).toBeGreaterThanOrEqual(-22);
        expect(w.neck[0]).toBeLessThanOrEqual(-12);
        expect(w.hip[0]).toBeGreaterThan(2);
        expect(w.hip[1]).toBeLessThan(w.neck[1] - 5);
        // Feet flat on the floor
        expect(w.near.ankle[1]).toBeCloseTo(CHAIN_ANKLE_HEIGHT, 5);
        expect(w.far.ankle[1]).toBeCloseTo(CHAIN_ANKLE_HEIGHT, 5);
        // Both hands together under the single dumbbell
        expect(dist(w.near.hold, w.far.hold)).toBeLessThan(3.5);
      }
    }

    // 149 keeps a fixed bent elbow (~132.6 deg) across every tick
    const bentAngles = bent.ticks.map((t) => {
      const w = bent.at(t).figure.world;
      return jointAngleDeg(w.near.shoulder, w.near.elbow, w.near.wrist);
    });
    expect(bentAngles[0]).toBeLessThan(145);
    expect(bentAngles[0]).toBeGreaterThan(115);
    for (const a of bentAngles) {
      expect(Math.abs(a - bentAngles[0])).toBeLessThan(0.05);
    }

    // 289 keeps straight elbows (>= 172 deg) across every tick and reaches a wider arc behind the head
    for (const t of straight.ticks) {
      const w = straight.at(t).figure.world;
      expect(jointAngleDeg(w.near.shoulder, w.near.elbow, w.near.wrist)).toBeGreaterThanOrEqual(172);
      expect(jointAngleDeg(w.far.shoulder, w.far.elbow, w.far.wrist)).toBeGreaterThanOrEqual(172);
    }
    const bentStretch = bent.atPhase(1).figure.world.near.wrist;
    const straightStretch = straight.atPhase(1).figure.world.near.wrist;
    expect(straightStretch[0]).toBeLessThan(bentStretch[0] - 2.5);
  });

  test('148 Bent-Arm Barbell Pullover: differs from 149 by lying ALONG the flat bench with hips supported on the pad and holding a shoulder-width barbell with fixed bent elbows and a pause over the chest', () => {
    const dbCross = sampleEntry(149);
    const bbAlong = sampleEntry(148);
    expect(bbAlong.movement.implement).toBe('bar');

    // In 148, hips and shoulders lie level along the bench (hip[1] == neck[1]), unlike 149's dropped hips
    const w0 = bbAlong.atPhase(0).figure.world;
    expect(w0.hip[1]).toBeCloseTo(w0.neck[1], 5);
    expect(w0.hip[1] - dbCross.atPhase(0).figure.world.hip[1]).toBeGreaterThan(5);

    // Shoulder-width barbell grip is wider than 149's palms-together single-dumbbell grip
    expect(dist(w0.near.wrist, w0.far.wrist)).toBeGreaterThan(15);

    // Pause over the chest at the finish
    expect(bbAlong.entry.frames[2].joints.ph).toBe(0);
    expect(bbAlong.entry.frames[3].joints.ph).toBe(0);

    // Fixed bent elbows across every tick, and bar arcs behind the head at ph = 1 without intersecting the head
    const elbow0 = jointAngleDeg(w0.near.shoulder, w0.near.elbow, w0.near.wrist);
    expect(elbow0).toBeLessThan(150);
    expect(elbow0).toBeGreaterThan(115);
    const stretch = bbAlong.atPhase(1).figure.world;
    expect(stretch.near.wrist[0]).toBeLessThan(stretch.head[0] - 6);
    for (const t of bbAlong.ticks) {
      const w = bbAlong.at(t).figure.world;
      expect(Math.abs(jointAngleDeg(w.near.shoulder, w.near.elbow, w.near.wrist) - elbow0)).toBeLessThan(0.05);
      // Midpoint of the bar shaft never passes through the head sphere (radius 4.5)
      const barMid = [(w.near.hold[0] + w.far.hold[0]) / 2, (w.near.hold[1] + w.far.hold[1]) / 2, 0];
      expect(dist(barMid, w.head)).toBeGreaterThan(5.5);
    }
  });

  test('201 Flat Bench Cable Flyes: flat bench between two chest-aligned low pulleys, fixed soft elbow bend, hands sweep from wide stretch to meet above the chest with a pause, and each cable strictly lengthens on the working half', () => {
    const { entry, movement, ticks, at, atPhase } = sampleEntry(201);
    expect(movement.implement).toBe('handles');
    expect(movement.lines.length).toBe(2);

    const open = atPhase(0).figure;
    const closed = atPhase(1).figure;
    // Flat bench: hip and neck level
    expect(open.world.hip[1]).toBeCloseTo(open.world.neck[1], 5);
    // Open wide at start, hands meet above the chest at peak
    expect(open.world.near.grip[2] - open.world.far.grip[2]).toBeGreaterThan(55);
    expect(closed.world.near.grip[2] - closed.world.far.grip[2]).toBeLessThan(8);
    expect(closed.world.near.grip[1] - closed.world.neck[1]).toBeGreaterThan(22);

    // Pause above the chest (frames 1 -> 2 both at ph = 1) and slow open (segment 2 > segment 0)
    expect(entry.frames[1].joints.ph).toBe(1);
    expect(entry.frames[2].joints.ph).toBe(1);
    expect(entry.segmentDurationsMs[2]).toBeGreaterThan(entry.segmentDurationsMs[0]);

    // Fixed slight elbow bend (~156 deg) across every tick
    const elbow0 = jointAngleDeg(open.world.near.shoulder, open.world.near.elbow, open.world.near.wrist);
    expect(elbow0).toBeGreaterThanOrEqual(150);
    expect(elbow0).toBeLessThanOrEqual(168);
    for (const t of ticks) {
      const w = at(t).figure.world;
      expect(Math.abs(jointAngleDeg(w.near.shoulder, w.near.elbow, w.near.wrist) - elbow0)).toBeLessThan(0.05);
      expect(Math.abs(jointAngleDeg(w.far.shoulder, w.far.elbow, w.far.wrist) - elbow0)).toBeLessThan(0.05);
    }

    // Each cable strictly lengthens on the working half (ph: 0 -> 1, t from 0 to segmentDurationsMs[0])
    const closeEnd = entry.segmentDurationsMs[0];
    const closeTicks = ticks.filter((t) => t <= closeEnd);
    const nearP = movement.lines[0].from;
    const farP = movement.lines[1].from;
    let prevNear3D = -Infinity, prevFar3D = -Infinity;
    for (const t of closeTicks) {
      const w = at(t).figure.world;
      const dNear = dist(nearP, w.near.hold);
      const dFar = dist(farP, w.far.hold);
      expect(dNear).toBeGreaterThanOrEqual(prevNear3D - 1e-6);
      expect(dFar).toBeGreaterThanOrEqual(prevFar3D - 1e-6);
      prevNear3D = dNear;
      prevFar3D = dFar;
    }
    expect(prevNear3D - dist(nearP, open.world.near.hold)).toBeGreaterThan(20);
  });

  test('217 Incline Cable Flye: incline bench between two low pulleys, starts with hands together above the face, opens wide slowly with fixed soft elbows, closes along the same arc and pauses, with cables lengthening on the closing half', () => {
    const { entry, movement, ticks, at, atPhase } = sampleEntry(217);
    expect(movement.implement).toBe('handles');
    expect(movement.lines.length).toBe(2);

    const startClosed = atPhase(0).figure;
    const openStretch = atPhase(1).figure;
    // Incline bench: neck is elevated above hip (35 deg incline)
    expect(startClosed.world.neck[1] - startClosed.world.hip[1]).toBeGreaterThan(12);
    // Starts with hands together above the face/upper chest, opens wide at ph = 1
    expect(startClosed.world.near.grip[2] - startClosed.world.far.grip[2]).toBeLessThan(8);
    expect(startClosed.world.near.grip[1] - startClosed.world.head[1]).toBeGreaterThan(15);
    expect(openStretch.world.near.grip[2] - openStretch.world.far.grip[2]).toBeGreaterThan(55);

    // Open slowly (segment 0 > segment 1) and pause at top after closing (frames 2 -> 3 at ph = 0)
    expect(entry.frames[0].joints.ph).toBe(0);
    expect(entry.frames[1].joints.ph).toBe(1);
    expect(entry.frames[2].joints.ph).toBe(0);
    expect(entry.frames[3].joints.ph).toBe(0);
    expect(entry.segmentDurationsMs[0]).toBeGreaterThan(entry.segmentDurationsMs[1]);

    // Fixed slight elbow bend across every tick
    const elbow0 = jointAngleDeg(startClosed.world.near.shoulder, startClosed.world.near.elbow, startClosed.world.near.wrist);
    expect(elbow0).toBeGreaterThanOrEqual(150);
    expect(elbow0).toBeLessThanOrEqual(168);
    for (const t of ticks) {
      const w = at(t).figure.world;
      expect(Math.abs(jointAngleDeg(w.near.shoulder, w.near.elbow, w.near.wrist) - elbow0)).toBeLessThan(0.05);
    }

    // Cables strictly lengthen on the working closing half (segment 1: from t = seg[0] to seg[0] + seg[1])
    const tOpen = entry.segmentDurationsMs[0];
    const tClosed = tOpen + entry.segmentDurationsMs[1];
    const closingTicks = ticks.filter((t) => t >= tOpen && t <= tClosed);
    const nearP = movement.lines[0].from;
    const farP = movement.lines[1].from;
    let prevNear = -Infinity, prevFar = -Infinity;
    for (const t of closingTicks) {
      const w = at(t).figure.world;
      const dNear = dist(nearP, w.near.hold);
      const dFar = dist(farP, w.far.hold);
      expect(dNear).toBeGreaterThanOrEqual(prevNear - 1e-6);
      expect(dFar).toBeGreaterThanOrEqual(prevFar - 1e-6);
      prevNear = dNear;
      prevFar = dFar;
    }
    expect(prevNear - dist(nearP, openStretch.world.near.hold)).toBeGreaterThan(20);
  });

  test('121 Kettlebell Dead Clean: bell starts on the floor between the feet with shoulder packed over it, zips close up the body as hips extend into a tucked-elbow rack, and reverses to the floor', () => {
    const { ticks, at, atPhase } = sampleEntry(121);
    const floorPose = atPhase(0).figure.world;
    const midPull = atPhase(1).figure.world;
    const rackPose = atPhase(2).figure.world;

    // Bell between the feet on the floor at ph = 0, shoulder packed over the bell
    expect(floorPose.kettlebell.body[1]).toBeLessThan(5.0);
    expect(floorPose.kettlebell.body[0]).toBeGreaterThanOrEqual(floorPose.near.ankle[0] - 2);
    expect(floorPose.kettlebell.body[0]).toBeLessThanOrEqual(floorPose.near.toe[0] + 2);
    expect(Math.abs(floorPose.near.shoulder[0] - floorPose.kettlebell.grip[0])).toBeLessThan(2.5);

    // Rack finish: standing tall (knees >= 172 deg) with elbow tucked below and close to the wrist/bell, and rack elbow >= 30 deg
    expect(jointAngleDeg(rackPose.near.hipJoint, rackPose.near.knee, rackPose.near.ankle)).toBeGreaterThanOrEqual(172);
    expect(jointAngleDeg(rackPose.near.shoulder, rackPose.near.elbow, rackPose.near.wrist)).toBeGreaterThanOrEqual(30);
    expect(rackPose.near.elbow[1]).toBeLessThan(rackPose.near.wrist[1] - 8);
    expect(rackPose.kettlebell.body[1] - floorPose.kettlebell.body[1]).toBeGreaterThan(50);

    // Mid-pull and full trajectory keep the bell close to the body (never swinging out ahead)
    expect(midPull.kettlebell.body[1]).toBeGreaterThan(floorPose.kettlebell.body[1] + 20);
    for (const t of ticks) {
      const w = at(t).figure.world;
      expect(jointAngleDeg(w.near.shoulder, w.near.elbow, w.near.wrist)).toBeGreaterThanOrEqual(30);
      expect(Math.abs(w.kettlebell.body[0] - floorPose.kettlebell.body[0])).toBeLessThan(3.5);
    }
  });

  test('231 Kettlebell Turkish Get-Up (Lunge style): 7 keyframes from supine -> seated -> one knee -> standing and reverse, with the bell arm locked (>= 172 deg) and vertical over the shoulder and both knees >= 35 deg on every tick', () => {
    const { entry, ticks, at, atPhase } = sampleEntry(231);
    expect(entry.frames.length).toBe(7);
    expect(entry.frames.map((f) => f.joints.ph)).toEqual([0, 1, 2, 4, 2, 1, 0]);

    const supine = atPhase(0).figure.world;
    const seated = atPhase(1).figure.world;
    const kneeling = atPhase(2).figure.world;
    const standing = atPhase(4).figure.world;

    // Progressive rise of the torso and shoulder from supine -> seated -> one knee -> standing
    expect(supine.hip[1]).toBeCloseTo(CHAIN_LYING_HEIGHT, 2);
    expect(seated.neck[1]).toBeGreaterThan(supine.neck[1] + 12);
    expect(kneeling.hip[1]).toBeGreaterThan(seated.hip[1] + 15);
    expect(kneeling.far.knee[1]).toBeLessThan(4.0);
    expect(standing.hip[1]).toBeGreaterThan(kneeling.hip[1] + 18);
    expect(jointAngleDeg(standing.near.hipJoint, standing.near.knee, standing.near.ankle)).toBeGreaterThanOrEqual(172);
    expect(jointAngleDeg(standing.far.hipJoint, standing.far.knee, standing.far.ankle)).toBeGreaterThanOrEqual(172);

    // Across every 33 ms tick, the working kettlebell arm stays locked (>= 172 deg) and vertical over the shoulder, and neither knee ever closes past 35 deg in transit
    for (const t of ticks) {
      const w = at(t).figure.world;
      expect(jointAngleDeg(w.near.shoulder, w.near.elbow, w.near.wrist)).toBeGreaterThanOrEqual(172);
      expect(jointAngleDeg(w.near.hipJoint, w.near.knee, w.near.ankle)).toBeGreaterThanOrEqual(35);
      expect(jointAngleDeg(w.far.hipJoint, w.far.knee, w.far.ankle)).toBeGreaterThanOrEqual(35);
      expect(Math.abs(w.near.wrist[0] - w.near.shoulder[0])).toBeLessThan(0.05);
      expect(Math.abs(w.near.wrist[2] - w.near.shoulder[2])).toBeLessThan(0.05);
      expect(w.near.wrist[1] - w.near.shoulder[1]).toBeCloseTo(24.5, 2);
      expect(Math.abs(w.kettlebell.grip[0] - w.near.shoulder[0])).toBeLessThan(0.05);
    }
  });
});
