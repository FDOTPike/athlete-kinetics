/**
 * Work order MOV-A15: the five movements whose catalogue text is on a source hold
 * (145 Bent Over Two-Arm Long Bar Row, 153 Box Squat with Bands, 165 Calf Raise
 * On A Dumbbell, 205 Front Barbell Squat To A Bench, 250 One-Arm Kettlebell Swings).
 *
 * Each movement is tested against its audited draft description in
 * docs/audits/accessible-coach/movement-completion/evidence/movement-45-held-text/DRAFT_TEXT.md
 * (written from the public-domain free-exercise-db entries and their photographs),
 * while the catalogue entries themselves remain unchanged and quotes.json records
 * the corresponding bound assertions.
 */
import fs from 'fs';
import path from 'path';
import {
  CANONICAL_BODY_PARAMETERS,
  CHAIN_MOVEMENTS,
  chainGeometry,
  layoutCanonicalFigure,
  poseAtTime,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = CANONICAL_BODY_PARAMETERS;
const FLOOR = 96.9;
const THIGH_HALF = (BODY.lw * 1.18) / 2;
const BACK_HALF = (BODY.sw * 0.58) / 2;
const FOOT_HALF = (BODY.lw * 0.82) / 2;
const HAND_R = BODY.lw * 0.44;

const DRAFT_PATH = path.resolve(
  __dirname,
  '../../../../docs/audits/accessible-coach/movement-completion/evidence/movement-45-held-text/DRAFT_TEXT.md',
);
const DRAFT_MD = fs.readFileSync(DRAFT_PATH, 'utf8');

const IDS = [145, 153, 165, 205, 250];

const distance = (a, b) => Math.hypot(...a.slice(0, Math.min(a.length, b.length)).map((v, i) => v - b[i]));

function jointAngleDeg(a, b, c) {
  const ux = a[0] - b[0], uy = a[1] - b[1], uz = (a[2] ?? 0) - (b[2] ?? 0);
  const vx = c[0] - b[0], vy = c[1] - b[1], vz = (c[2] ?? 0) - (b[2] ?? 0);
  const uLen = Math.hypot(ux, uy, uz) || 1;
  const vLen = Math.hypot(vx, vy, vz) || 1;
  const cos = Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / (uLen * vLen)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function pointToSegmentDist2D(p, a, b) {
  const ux = b[0] - a[0], uy = b[1] - a[1];
  const len2 = ux * ux + uy * uy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ux + (p[1] - a[1]) * uy) / len2));
  return Math.hypot(p[0] - (a[0] + ux * t), p[1] - (a[1] + uy * t));
}

function entryFor(id) {
  const entry = previewManifest.entries.find((e) => e.movementId === id);
  if (!entry) throw new Error(`Movement ${id} missing from previewManifest`);
  return entry;
}

function slugOf(entry) {
  return entry.assetKey.split('/')[1];
}

function samplerFor(id) {
  const entry = entryFor(id);
  const slug = slugOf(entry);
  const movement = CHAIN_MOVEMENTS[slug];
  const segments = entry.segmentDurationsMs;
  const total = segments.reduce((a, b) => a + b, 0);
  const ticks = [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];
  const keyframeTimes = segments.reduce((acc, d) => [...acc, acc.at(-1) + d], [0]);
  const at = (t) => {
    const pose = poseAtTime(entry.frames.map((f) => f.joints), t, segments);
    return {
      pose,
      figure: chainGeometry(slug, pose.ph, BODY, pose.tw ?? 0),
      prims: layoutCanonicalFigure(pose, { ...entry, body: BODY }),
    };
  };
  return { entry, slug, movement, segments, total, ticks, keyframeTimes, at };
}

describe('MOV-A15 held-text movements: shared draft-authority and anatomical invariants', () => {
  test.each(IDS)('movement %i is a pending oblique draft whose text comes from DRAFT_TEXT.md and states it awaits the owner', (id) => {
    const { entry, movement, ticks, at } = samplerFor(id);
    expect(entry.status).toBe('pending');
    expect(entry.view).toBe('oblique');
    expect(entry.frames.length).toBeGreaterThanOrEqual(5);
    expect(entry.instructions).not.toMatch(/choose a load or range you can control/);
    expect(DRAFT_MD).toContain(entry.instructions);
    expect(DRAFT_MD).toContain(entry.cues);
    expect(entry.reason).toMatch(/draft/i);
    expect(entry.reason).toMatch(/awaiting the owner/i);
    expect(entry.reason).toMatch(/source hold/i);
    const turned = /turned (\d+) degrees/.exec(entry.reason);
    expect(turned).not.toBeNull();
    expect(Number(turned[1])).toBe(Math.abs(movement.yawDeg ?? 35));

    // Every caption is grounded in the draft instructions or cues.
    const authority = `${entry.instructions} ${entry.cues}`.toLowerCase();
    for (const frame of entry.frames) {
      expect(frame.caption.length).toBeGreaterThanOrEqual(15);
      expect(frame.caption).toMatch(/[.!?]$/);
    }
    expect(authority.length).toBeGreaterThan(80);

    // Every tick respects floor and anatomical joint closure limits.
    for (const t of ticks) {
      const { figure, prims } = at(t);
      const w = figure.world;
      for (const side of [w.near, w.far]) {
        const kneeDeg = jointAngleDeg(side.hipJoint, side.knee, side.ankle);
        const elbowDeg = jointAngleDeg(side.shoulder, side.elbow, side.wrist);
        expect(kneeDeg).toBeGreaterThanOrEqual(35);
        expect(elbowDeg).toBeGreaterThanOrEqual(28);
      }
      for (const p of prims) {
        if (p.opacity === 0.75) continue;
        const bottom = p.kind === 'circle' ? p.cy + p.r : p.kind === 'rect' ? p.y + p.h : Math.max(p.y1, p.y2) + p.w / 2;
        expect(bottom).toBeLessThanOrEqual(FLOOR + 1e-6);
      }
    }
  });
});

describe('145 Bent Over Two-Arm Long Bar Row', () => {
  test('straddles a floor-anchored barbell with slightly bent knees, a flat near-parallel torso that stays still, and a two-hand double handle', () => {
    const { movement, ticks, keyframeTimes, segments, at } = samplerFor(145);
    expect(movement.implement).toBe('longBar');
    expect(movement.barAnchor).toBeDefined();
    expect(movement.barAnchor[1]).toBeLessThanOrEqual(2.5);

    const start = at(0);
    const gripSpan3D = distance(start.figure.world.near.hold, start.figure.world.far.hold);
    const gripSpan2D = distance(start.figure.hold.near, start.figure.hold.far);
    expect(gripSpan3D).toBeCloseTo(5.0, 5);
    expect(gripSpan2D).toBeGreaterThan(1.5);

    // Straddle stance wider than the hips around the bar on z = 0, knees slightly bent.
    const stanceZ = Math.abs(start.figure.world.near.ankle[2] - start.figure.world.far.ankle[2]);
    expect(stanceZ).toBeGreaterThan(BODY.hw * 1.8);
    expect(start.figure.world.near.ankle[2]).toBeGreaterThan(0);
    expect(start.figure.world.far.ankle[2]).toBeLessThan(0);

    for (const t of ticks) {
      const { figure } = at(t);
      const w = figure.world;
      // Flat back, torso near parallel to the floor and completely stationary.
      expect(figure.curled).toBe(false);
      expect(figure.angles.trunk[0]).toBeGreaterThanOrEqual(12);
      expect(figure.angles.trunk[0]).toBeLessThanOrEqual(24);
      expect(distance(w.hip, start.figure.world.hip)).toBeLessThan(1e-6);
      expect(distance(w.neck, start.figure.world.neck)).toBeLessThan(1e-6);
      // Slight fixed knee bend.
      const kneeDeg = jointAngleDeg(w.near.hipJoint, w.near.knee, w.near.ankle);
      expect(kneeDeg).toBeGreaterThanOrEqual(120);
      expect(kneeDeg).toBeLessThanOrEqual(155);
      // Palms facing each other on a rigid double handle.
      expect(figure.angles.palmYaw).toBe(90);
      expect(figure.angles.farPalmYaw).toBe(90);
      expect(distance(w.near.hold, w.far.hold)).toBeCloseTo(gripSpan3D, 6);
      expect(distance(figure.hold.near, figure.hold.far)).toBeCloseTo(gripSpan2D, 6);
    }

    // Bottom pose: straight arms (>= 172 deg) and plates clear of the floor.
    const bottomNearElbow = jointAngleDeg(
      start.figure.world.near.shoulder,
      start.figure.world.near.elbow,
      start.figure.world.near.wrist,
    );
    const bottomFarElbow = jointAngleDeg(
      start.figure.world.far.shoulder,
      start.figure.world.far.elbow,
      start.figure.world.far.wrist,
    );
    expect(bottomNearElbow).toBeGreaterThanOrEqual(172);
    expect(bottomFarElbow).toBeGreaterThanOrEqual(172);

    const bottomPlates = start.prims.filter((p) => p.kind === 'bone' && p.w === 2.4 && p.stroke === 'ink1');
    expect(bottomPlates.length).toBeGreaterThanOrEqual(2);
    for (const plate of bottomPlates) {
      const plateBottom = Math.max(plate.y1, plate.y2) + plate.w / 2;
      expect(plateBottom).toBeLessThan(FLOOR - 10);
    }

    // Top pose: elbows tucked in close to the sides, plates touch the lower chest, 1-second hold, slow lower.
    const top = at(keyframeTimes[1]);
    expect(top.figure.world.near.hold[1]).toBeGreaterThan(start.figure.world.near.hold[1] + 9.5);
    expect(Math.abs(top.figure.world.near.elbow[2]) - BODY.sw * 0.92).toBeLessThan(3.0);

    const topPlates = top.prims.filter((p) => p.kind === 'bone' && p.w === 2.4 && p.stroke === 'ink1');
    const chestLineDist = Math.min(
      ...topPlates.map((pl) =>
        Math.min(
          pointToSegmentDist2D([pl.x1, pl.y1], top.figure.joints.nk, top.figure.joints.hp),
          pointToSegmentDist2D([pl.x2, pl.y2], top.figure.joints.nk, top.figure.joints.hp),
        ),
      ),
    );
    expect(chestLineDist).toBeLessThanOrEqual(BACK_HALF + 2.2);

    // Hold for a second at the top, and lower slower than the pull.
    expect(segments[1]).toBeGreaterThanOrEqual(900);
    expect(segments[2]).toBeGreaterThan(segments[0]);
  });
});

describe('153 Box Squat with Bands', () => {
  test('squats inside a power rack with downward bands on the bar sleeves, sits back onto a parallel box with vertical shins and a seated pause, then drives up', () => {
    const { movement, ticks, keyframeTimes, segments, at } = samplerFor(153);
    expect(movement.implement).toBe('bar');
    expect(movement.lines).toHaveLength(2);

    const boxSpec = movement.equipment.find((e) => e.kind === 'box');
    expect(boxSpec).toBeDefined();
    const boxTopWorld = Math.max(boxSpec.a[1], boxSpec.b[1]);
    const boxMinX = Math.min(boxSpec.a[0], boxSpec.b[0]);
    const boxMaxX = Math.max(boxSpec.a[0], boxSpec.b[0]);

    const start = at(0);
    const gripSpan3D = distance(start.figure.world.near.hold, start.figure.world.far.hold);
    const gripSpan2D = distance(start.figure.hold.near, start.figure.hold.far);

    // Rigid bar across the shoulders, clear of the head on every tick.
    for (const t of ticks) {
      const { figure } = at(t);
      expect(distance(figure.world.near.hold, figure.world.far.hold)).toBeCloseTo(gripSpan3D, 6);
      expect(distance(figure.hold.near, figure.hold.far)).toBeCloseTo(gripSpan2D, 6);
      const barDistToHead = pointToSegmentDist2D(figure.joints.hd, figure.barEnd.far, figure.barEnd.near);
      expect(barDistToHead).toBeGreaterThan(BODY.hr + 0.8);
    }

    // Standing pose: legs straight (>= 172 deg), bands stretched from floor anchors to bar ends.
    const standKneeDeg = jointAngleDeg(
      start.figure.world.near.hipJoint,
      start.figure.world.near.knee,
      start.figure.world.near.ankle,
    );
    expect(standKneeDeg).toBeGreaterThanOrEqual(172);

    // Seated pose on the box (keyframes 2 and 3): hips sit back onto the box, thighs parallel, shins perpendicular.
    const seated1 = at(keyframeTimes[1]);
    const seated2 = at(keyframeTimes[2]);
    expect(seated1.figure.world.hip[0]).toBeLessThan(start.figure.world.hip[0] - 16);
    expect(seated1.figure.world.hip[0]).toBeGreaterThanOrEqual(boxMinX + 2);
    expect(seated1.figure.world.hip[0]).toBeLessThanOrEqual(boxMaxX - 2);
    // Painted contact of the glutes/thigh underside with the top of the box.
    expect(seated1.figure.world.hip[1] - THIGH_HALF).toBeCloseTo(boxTopWorld, 1);
    // Thighs parallel to the floor and shins vertical.
    expect(Math.abs(seated1.figure.world.near.knee[1] - seated1.figure.world.near.hipJoint[1])).toBeLessThan(3.0);
    expect(Math.abs(seated1.figure.world.near.knee[0] - seated1.figure.world.near.ankle[0])).toBeLessThan(3.5);
    // Knees pushed out wider at the bottom than at standing.
    expect(seated1.figure.angles.kneeOut).toBeGreaterThan(start.figure.angles.kneeOut);

    // Deliberate pause on the box without bouncing: keyframes 1 and 2 are identical and held >= 500 ms.
    expect(distance(seated1.figure.world.hip, seated2.figure.world.hip)).toBeLessThan(1e-9);
    expect(segments[1]).toBeGreaterThanOrEqual(500);

    // Downward bands attach near the floor and are longer at standing lockout than on the box.
    for (const lineSpec of movement.lines) {
      expect(lineSpec.from[1]).toBeLessThanOrEqual(2.0);
    }
    const bandLenStand = distance(start.figure.project(movement.lines[0].from), start.figure.barEnd.near);
    const bandLenBox = distance(seated1.figure.project(movement.lines[0].from), seated1.figure.barEnd.near);
    expect(bandLenStand).toBeGreaterThan(bandLenBox + 18);
  });
});

describe('165 Calf Raise On A Dumbbell', () => {
  test('stands with the ball of one foot on a floor dumbbell handle, the other foot lifted clear, both hands on a sturdy support, and rises from a heel stretch into full extension', () => {
    const { movement, ticks, keyframeTimes, segments, at } = samplerFor(165);
    // Dumbbell on the floor (handle + two plates) and sturdy support in front.
    const boxPlates = movement.equipment.filter((e) => e.kind === 'box');
    const handleSlabs = movement.equipment.filter((e) => e.kind === 'slab');
    expect(boxPlates.length).toBeGreaterThanOrEqual(2);
    expect(handleSlabs.length).toBeGreaterThanOrEqual(2);

    const start = at(0);
    const gripSpan3D = distance(start.figure.world.near.hold, start.figure.world.far.hold);

    for (const t of ticks) {
      const { figure } = at(t);
      const w = figure.world;
      // Working knee stays straight (>= 172 deg) throughout the cycle.
      const workingKneeDeg = jointAngleDeg(w.near.hipJoint, w.near.knee, w.near.ankle);
      expect(workingKneeDeg).toBeGreaterThanOrEqual(172);
      // Working forefoot stays planted on top of the dumbbell handle in painted contact.
      expect(distance(w.near.toe, start.figure.world.near.toe)).toBeLessThan(1e-6);
      expect(w.near.toe[1] - FOOT_HALF).toBeCloseTo(4.6, 1);
      // Non-working (far) foot stays lifted clear of the floor at every tick.
      expect(w.far.ankle[1]).toBeGreaterThan(9.0);
      expect(w.far.toe[1]).toBeGreaterThan(8.0);
      // Both hands hold the sturdy support bar in painted contact without sliding.
      expect(distance(w.near.wrist, start.figure.world.near.wrist)).toBeLessThan(1e-6);
      expect(distance(w.far.wrist, start.figure.world.far.wrist)).toBeLessThan(1e-6);
      expect(distance(w.near.hold, w.far.hold)).toBeCloseTo(gripSpan3D, 6);
    }

    // Bottom stretch (pose 0): working heel is lowered toward the floor below the forefoot on the handle.
    expect(start.figure.world.near.ankle[1]).toBeLessThan(start.figure.world.near.toe[1] - 0.8);
    expect(start.figure.world.near.ankle[1] - FOOT_HALF).toBeGreaterThan(0.4);

    // Top calf extension (pose 1): heel rises high above the handle and holds for a second.
    const top = at(keyframeTimes[1]);
    expect(top.figure.world.near.ankle[1]).toBeGreaterThan(top.figure.world.near.toe[1] + 2.8);
    expect(top.figure.world.near.ankle[1] - start.figure.world.near.ankle[1]).toBeGreaterThan(4.5);
    expect(top.figure.world.hip[1] - start.figure.world.hip[1]).toBeGreaterThan(4.5);
    expect(segments[1]).toBeGreaterThanOrEqual(900);
    expect(segments[2]).toBeGreaterThanOrEqual(1100);
  });
});

describe('205 Front Barbell Squat To A Bench', () => {
  test('holds the barbell on the front shoulders with crossed forearms and elbows high, lowers with a straight upright back and knees in line with the toes to a light touch on the bench, and stands right back up', () => {
    const { movement, ticks, keyframeTimes, at } = samplerFor(205);
    expect(movement.implement).toBe('bar');

    // Flat bench slab behind the lifter at parallel height.
    const benchSlab = movement.equipment.find((e) => e.kind === 'slab');
    expect(benchSlab).toBeDefined();
    const benchTopWorld = benchSlab.a[1] + 2;

    const start = at(0);
    const gripSpan3D = distance(start.figure.world.near.hold, start.figure.world.far.hold);
    const gripSpan2D = distance(start.figure.hold.near, start.figure.hold.far);

    // Standing leg is straight (>= 172 deg).
    const standKneeDeg = jointAngleDeg(
      start.figure.world.near.hipJoint,
      start.figure.world.near.knee,
      start.figure.world.near.ankle,
    );
    expect(standKneeDeg).toBeGreaterThanOrEqual(172);

    for (const t of ticks) {
      const { figure } = at(t);
      const w = figure.world;
      // Back stays straight (no spine curl) and upright (>= 68 deg), head facing up/forward.
      expect(figure.curled).toBe(false);
      expect(figure.angles.trunk[0]).toBeGreaterThanOrEqual(68);
      // Arms are crossed to grasp the bar on the opposite front shoulders.
      expect(w.near.elbow[2]).toBeGreaterThan(0);
      expect(w.far.elbow[2]).toBeLessThan(0);
      expect(w.near.hold[2]).toBeLessThan(0);
      expect(w.far.hold[2]).toBeGreaterThan(0);
      // Rigid bar span across every tick, clear of the head.
      expect(distance(w.near.hold, w.far.hold)).toBeCloseTo(gripSpan3D, 6);
      expect(distance(figure.hold.near, figure.hold.far)).toBeCloseTo(gripSpan2D, 6);
      const barDistToHead = pointToSegmentDist2D(figure.joints.hd, figure.barEnd.far, figure.barEnd.near);
      expect(barDistToHead).toBeGreaterThan(BODY.hr + 0.8);
      // Upper arms stay slightly above parallel to the floor throughout the squat.
      const upperDx = w.near.elbow[0] - w.near.shoulder[0];
      const upperDy = w.near.elbow[1] - w.near.shoulder[1];
      const upperPitchDeg = (Math.atan2(upperDy, upperDx) * 180) / Math.PI;
      expect(upperPitchDeg).toBeGreaterThan(1.5);
      expect(upperPitchDeg).toBeLessThan(18);
    }

    // Bottom touch on the bench (keyframe 3, ph = 1): glutes touch the bench, knees travel forward in line with toes, no seated pause.
    const bottom = at(keyframeTimes[2]);
    expect(bottom.pose.ph).toBe(1);
    expect(bottom.figure.world.hip[1] - THIGH_HALF).toBeCloseTo(benchTopWorld, 1);
    expect(bottom.figure.world.near.knee[0]).toBeGreaterThan(bottom.figure.world.near.ankle[0] + 5.0);
    // Touch-and-go turn: only one keyframe sits at ph === 1 (unlike 153 Box Squat with Bands).
    const bottomFrames = samplerFor(205).entry.frames.filter((f) => f.joints.ph === 1);
    expect(bottomFrames).toHaveLength(1);
  });
});

describe('250 One-Arm Kettlebell Swings', () => {
  test('hikes the kettlebell back between the upper thighs in a flat-backed hip hinge with the free arm back, snaps the hips to float the bell to shoulder height on a long straight arm, and hinges only as the bell drops back', () => {
    const { movement, ticks, keyframeTimes, segments, at } = samplerFor(250);
    expect(movement.implement).toBe('kettlebell');

    const hike = at(0);
    const passUp = at(keyframeTimes[1]);
    const floatTop = at(keyframeTimes[2]);
    const passDown = at(keyframeTimes[3]);

    // Working arm stays long and straight (>= 172 deg) and overhand (palmYaw 180) on every tick; back stays flat.
    for (const t of ticks) {
      const { figure } = at(t);
      const w = figure.world;
      expect(figure.curled).toBe(false);
      expect(figure.angles.palmYaw).toBe(180);
      const workingElbowDeg = jointAngleDeg(w.near.shoulder, w.near.elbow, w.near.wrist);
      expect(workingElbowDeg).toBeGreaterThanOrEqual(172);
    }

    // Hike start (pose 0): hip hinge (hips high above knees, softened knees), bell hiked behind the hips/upper thighs, free arm swung back beside the hip.
    const hikeKneeDeg = jointAngleDeg(
      hike.figure.world.near.hipJoint,
      hike.figure.world.near.knee,
      hike.figure.world.near.ankle,
    );
    expect(hikeKneeDeg).toBeGreaterThanOrEqual(120);
    expect(hikeKneeDeg).toBeLessThanOrEqual(155);
    expect(hike.figure.world.hip[1]).toBeGreaterThan(hike.figure.world.near.knee[1] + 12);
    expect(hike.figure.angles.trunk[0]).toBeGreaterThanOrEqual(26);
    expect(hike.figure.angles.trunk[0]).toBeLessThanOrEqual(40);
    expect(hike.figure.world.near.hold[0]).toBeLessThan(
      (hike.figure.world.near.hipJoint[0] + hike.figure.world.near.knee[0]) / 2,
    );
    expect(hike.figure.world.near.hold[1]).toBeLessThan(hike.figure.world.near.hipJoint[1]);
    expect(hike.figure.world.near.hold[1]).toBeGreaterThan(hike.figure.world.near.knee[1]);
    expect(hike.figure.world.far.wrist[0]).toBeLessThan(hike.figure.world.far.hipJoint[0]);

    // Ballistic hip snap (pose 1): hips have already driven nearly upright while the bell is passing the thighs.
    expect(passUp.figure.angles.trunk[0]).toBeGreaterThanOrEqual(74);
    expect(passUp.figure.world.near.hold[1]).toBeLessThan(floatTop.figure.world.near.hold[1] - 12);

    // Top float (pose 2): standing tall with straight legs (>= 172 deg), bell at chest/shoulder height, free arm counterbalancing forward.
    expect(floatTop.figure.angles.trunk[0]).toBeCloseTo(90, 5);
    const topKneeDeg = jointAngleDeg(
      floatTop.figure.world.near.hipJoint,
      floatTop.figure.world.near.knee,
      floatTop.figure.world.near.ankle,
    );
    expect(topKneeDeg).toBeGreaterThanOrEqual(172);
    expect(Math.abs(floatTop.figure.world.near.hold[1] - floatTop.figure.world.near.shoulder[1])).toBeLessThan(6.0);
    expect(floatTop.figure.world.near.hold[0]).toBeGreaterThan(floatTop.figure.world.near.shoulder[0] + 18);
    expect(floatTop.figure.world.far.wrist[0]).toBeGreaterThan(hike.figure.world.far.wrist[0] + 10);

    // Downswing timing: stays upright until the bell drops back to the thighs (passDown), then hinges quickly into the backswing.
    expect(passDown.figure.angles.trunk[0]).toBeGreaterThanOrEqual(74);
    expect(segments[0]).toBeLessThanOrEqual(500);
  });
});
