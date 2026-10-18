/**
 * MOV-A13 — Single-leg work (18, 36, 56, 136, 194, 239, 67, 96).
 *
 * Source-text-bound and physics-bound tests across every 33 ms tick of each
 * movement's cycle, written before authoring the drawings.
 */
import * as rig from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';
import catalogue from '../../../../docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json';

const BODY = rig.CANONICAL_BODY_PARAMETERS;
const IDS = [18, 36, 56, 136, 194, 239, 67, 96];
const BARBELL_IDS = [36, 136, 194, 96];
const FLOOR = 96.9;
const ANKLE_Y = rig.CHAIN_ANKLE_HEIGHT;
const THIGH_HALF = (BODY.lw * 1.18) / 2;
const KNEELING_KNEE_Y = THIGH_HALF + 0.01;

const entryFor = (id) => {
  const e = previewManifest.entries.find((x) => x.movementId === id);
  expect(e).toBeDefined();
  return e;
};

const rowFor = (id) => catalogue.movements.find((m) => m.id === id);
const slugOf = (e) => e.assetKey.split('/')[1];

const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] ?? 0) - (b[2] ?? 0));
const lerp3 = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  (a[2] ?? 0) + ((b[2] ?? 0) - (a[2] ?? 0)) * t,
];

const deg3D = (a, b, c) => {
  const ux = a[0] - b[0], uy = a[1] - b[1], uz = (a[2] ?? 0) - (b[2] ?? 0);
  const vx = c[0] - b[0], vy = c[1] - b[1], vz = (c[2] ?? 0) - (b[2] ?? 0);
  const n = Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz) || 1;
  return (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / n))) * 180) / Math.PI;
};

/**
 * Segmental 3D Centre of Mass (Winter anthropometric mass fractions).
 * Includes external load mass at `loadPoint` when `loadMass > 0`.
 */
function centreOfMass3D(world, loadPoint = null, loadMass = 0) {
  const spineMid = world.spine[16];
  const parts = [
    [world.head, 0.081],
    [spineMid, 0.497],
    [lerp3(world.near.shoulder, world.near.elbow, 0.436), 0.028],
    [lerp3(world.far.shoulder, world.far.elbow, 0.436), 0.028],
    [lerp3(world.near.elbow, world.near.wrist, 0.430), 0.016],
    [lerp3(world.far.elbow, world.far.wrist, 0.430), 0.016],
    [world.near.grip, 0.006],
    [world.far.grip, 0.006],
    [lerp3(world.near.hipJoint, world.near.knee, 0.433), 0.100],
    [lerp3(world.far.hipJoint, world.far.knee, 0.433), 0.100],
    [lerp3(world.near.knee, world.near.ankle, 0.433), 0.0465],
    [lerp3(world.far.knee, world.far.ankle, 0.433), 0.0465],
    [lerp3(world.near.ankle, world.near.toe ?? world.near.ankle, 0.5), 0.0145],
    [lerp3(world.far.ankle, world.far.toe ?? world.far.ankle, 0.5), 0.0145],
  ];
  if (loadPoint !== null && loadMass > 0) {
    parts.push([loadPoint, loadMass]);
  }
  let totalM = 0, cx = 0, cy = 0, cz = 0;
  for (const [p, m] of parts) {
    totalM += m;
    cx += p[0] * m;
    cy += p[1] * m;
    cz += (p[2] ?? 0) * m;
  }
  return [cx / totalM, cy / totalM, cz / totalM];
}

function sampleCycle(entry) {
  const slug = slugOf(entry);
  const opts = { ...entry, body: BODY };
  const total = entry.segmentDurationsMs.reduce((a, b) => a + b, 0);
  const ticks = [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];
  const at = (t) => {
    const pose = rig.poseAtTime(entry.frames.map((f) => f.joints), t, entry.segmentDurationsMs);
    return {
      t,
      pose,
      figure: rig.chainGeometry(slug, pose.ph, BODY, pose.tw ?? 0),
      joints: rig.resolveFigureJoints(pose, opts),
      prims: rig.layoutCanonicalFigure(pose, opts),
    };
  };
  return { slug, opts, total, ticks, at, samples: ticks.map(at) };
}

describe('MOV-A13 single-leg batch (18, 36, 56, 136, 194, 239, 67, 96)', () => {
  test.each(IDS)('movement %i is authored in CHAIN_MOVEMENTS and matches catalogue equipment', (id) => {
    const entry = entryFor(id);
    const row = rowFor(id);
    const slug = slugOf(entry);
    expect(row).toBeDefined();
    expect(rig.CHAIN_MOVEMENTS[slug]).toBeDefined();
    expect(rig.EQUIPMENT_BY_SLUG[slug]).toBe(entry.equipment);
    expect(entry.status).toBe('pending');
    expect(entry.frames.length).toBeGreaterThanOrEqual(5);
  });

  test.each(BARBELL_IDS)(
    'barbell movement %i keeps a rigid bar with constant 3D hand-to-hand distance across every 33 ms tick',
    (id) => {
      const entry = entryFor(id);
      const { samples } = sampleCycle(entry);
      const wristSpan0 = dist3(samples[0].figure.world.near.wrist, samples[0].figure.world.far.wrist);
      const holdSpan0 = dist3(samples[0].figure.world.near.hold, samples[0].figure.world.far.hold);
      expect(wristSpan0).toBeGreaterThan(12);
      for (const s of samples) {
        const wSpan = dist3(s.figure.world.near.wrist, s.figure.world.far.wrist);
        const hSpan = dist3(s.figure.world.near.hold, s.figure.world.far.hold);
        expect(wSpan).toBeCloseTo(wristSpan0, 6);
        expect(hSpan).toBeCloseTo(holdSpan0, 6);
      }
    },
  );

  test('18 Bulgarian Split Squat: front foot rooted flat on floor, rear foot top on bench, rear knee drops straight down', () => {
    const entry = entryFor(18);
    const { samples } = sampleCycle(entry);
    const top = rig.chainGeometry('bulgarian-split-squat', 0, BODY);
    const bot = rig.chainGeometry('bulgarian-split-squat', 2, BODY);

    // Standing pose has a straight front leg (>= 172 deg).
    const topFrontKnee = deg3D(top.world.near.hipJoint, top.world.near.knee, top.world.near.ankle);
    expect(topFrontKnee).toBeGreaterThanOrEqual(172);
    const botFrontKnee = deg3D(bot.world.near.hipJoint, bot.world.near.knee, bot.world.near.ankle);
    expect(botFrontKnee).toBeLessThan(85);

    // Rear foot rests its top on the bench behind the athlete (pointing backward, farFoot = 180).
    expect(top.world.far.ankle[0]).toBeLessThan(-15);
    expect(top.world.far.ankle[1]).toBeGreaterThan(12);
    expect(top.world.far.toe[0]).toBeLessThan(top.world.far.ankle[0] - 4);
    expect(top.world.far.toe[1]).toBeCloseTo(top.world.far.ankle[1], 6);

    // Rear knee drops straight down toward the floor (vertical drop > 18, horizontal drift < 0.5 between top and bottom).
    expect(top.world.far.knee[1] - bot.world.far.knee[1]).toBeGreaterThan(18);
    expect(bot.world.far.knee[1]).toBeLessThan(4.5);
    expect(Math.abs(bot.world.far.knee[0] - top.world.far.knee[0])).toBeLessThan(0.5);
    expect(Math.abs(bot.world.hip[0] - top.world.hip[0])).toBeLessThan(0.5);

    // Across every 33 ms tick: front foot stays planted on the floor with painted sole contact, and rear knee stays on its vertical line.
    for (const s of samples) {
      const w = s.figure.world;
      expect(dist3(w.near.ankle, top.world.near.ankle)).toBeLessThan(1e-6);
      expect(dist3(w.near.toe, top.world.near.toe)).toBeLessThan(1e-6);
      expect(w.near.ankle[1]).toBeCloseTo(ANKLE_Y, 6);
      expect(w.near.toe[1]).toBeCloseTo(ANKLE_Y, 6);
      expect(Math.abs(w.far.knee[0] - top.world.far.knee[0])).toBeLessThan(2.1);

      const nearFootBone = s.prims.find(
        (p) => p.kind === 'bone' && p.x1 === s.joints.an[0] && p.y1 === s.joints.an[1] && p.x2 === s.figure.toe.near[0] && p.y2 === s.figure.toe.near[1],
      );
      expect(nearFootBone).toBeDefined();
      expect(Math.max(nearFootBone.y1, nearFootBone.y2) + nearFootBone.w / 2).toBeCloseTo(FLOOR, 0);
    }
  });

  test.each([
    [36, 'barbell-step-up', 0.40],
    [56, 'dumbbell-step-up', 0.25],
  ])(
    '%i (%s): whole foot on box, thigh near parallel at start, floor toe touches at bottom, floor leg hangs, CoM with load over standing foot on every tick',
    (id, slug, loadMass) => {
      const entry = entryFor(id);
      const { samples } = sampleCycle(entry);
      const bot = rig.chainGeometry(slug, 0, BODY);
      const top = rig.chainGeometry(slug, 2, BODY);

      // Controlled lower count > drive count.
      expect(entry.segmentDurationsMs[2]).toBeGreaterThan(entry.segmentDurationsMs[0]);

      // At bottom (ph = 0), top thigh is near parallel to the floor (within 12 deg of horizontal).
      const thighDx = bot.world.near.knee[0] - bot.world.near.hipJoint[0];
      const thighDy = bot.world.near.knee[1] - bot.world.near.hipJoint[1];
      const thighAngleFromHoriz = Math.abs((Math.atan2(thighDy, thighDx) * 180) / Math.PI);
      expect(thighAngleFromHoriz).toBeLessThanOrEqual(12);

      // At bottom (ph = 0), floor toe touches the floor while floor ankle is above it.
      expect(bot.world.far.toe[1]).toBeCloseTo(ANKLE_Y, 2);
      expect(bot.world.far.ankle[1]).toBeGreaterThan(bot.world.far.toe[1] + 2.0);
      const botFarFoot = samples[0].prims.find(
        (p) => p.kind === 'bone' && p.x1 === samples[0].joints.af[0] && p.y1 === samples[0].joints.af[1],
      );
      expect(botFarFoot).toBeDefined();
      expect(Math.max(botFarFoot.y1, botFarFoot.y2) + botFarFoot.w / 2).toBeCloseTo(FLOOR, 0);

      // At top (ph = 2), athlete stands tall on the box with a straight knee (>= 172 deg) and hanging floor leg.
      const topKneeDeg = deg3D(top.world.near.hipJoint, top.world.near.knee, top.world.near.ankle);
      expect(topKneeDeg).toBeGreaterThanOrEqual(172);
      expect(top.world.far.toe[1]).toBeGreaterThan(18);
      expect(top.world.far.ankle[0]).toBeLessThan(top.world.near.ankle[0] - 5);

      // Box apparatus is drawn under the standing foot.
      const box = samples[0].prims.find((p) => p.kind === 'rect' && p.h > 15);
      expect(box).toBeDefined();

      // Across every 33 ms tick: whole standing foot stays planted on the box, and CoM (with load AND without) stays over the standing foot.
      for (const s of samples) {
        const w = s.figure.world;
        expect(dist3(w.near.ankle, bot.world.near.ankle)).toBeLessThan(1e-6);
        expect(dist3(w.near.toe, bot.world.near.toe)).toBeLessThan(1e-6);
        expect(w.near.ankle[1]).toBeCloseTo(20 + ANKLE_Y, 6);
        expect(w.near.toe[1]).toBeCloseTo(20 + ANKLE_Y, 6);

        const nearFootBone = s.prims.find(
          (p) => p.kind === 'bone' && p.x1 === s.joints.an[0] && p.y1 === s.joints.an[1] && p.x2 === s.figure.toe.near[0] && p.y2 === s.figure.toe.near[1],
        );
        expect(nearFootBone).toBeDefined();
        expect(Math.max(nearFootBone.y1, nearFootBone.y2) + nearFootBone.w / 2).toBeCloseTo(box.y, 0);

        const loadPt = lerp3(w.near.hold, w.far.hold, 0.5);
        const comWithLoad = centreOfMass3D(w, loadPt, loadMass);
        const comUnloaded = centreOfMass3D(w, null, 0);
        expect(comWithLoad[0]).toBeGreaterThanOrEqual(w.near.ankle[0]);
        expect(comWithLoad[0]).toBeLessThanOrEqual(w.near.toe[0]);
        expect(comUnloaded[0]).toBeGreaterThanOrEqual(w.near.ankle[0]);
        expect(comUnloaded[0]).toBeLessThanOrEqual(w.near.toe[0]);

        if (id === 56) {
          // Dumbbells hang quiet at the sides (vertical arms in world space).
          expect(s.figure.angles.upperArm[0]).toBeCloseTo(-90, 5);
          expect(s.figure.angles.forearm[0]).toBeCloseTo(-90, 5);
        }
      }
    },
  );

  test('136 Barbell Lunge: steps forward, lowers hips straight down with upright torso and front knee in line with toes, pushes back to standing', () => {
    const entry = entryFor(136);
    const { samples } = sampleCycle(entry);
    const stand = rig.chainGeometry('barbell-lunge', 0, BODY);
    const step = rig.chainGeometry('barbell-lunge', 1, BODY);
    const bot = rig.chainGeometry('barbell-lunge', 2, BODY);

    // Standing pose has both knees straight (>= 172 deg).
    expect(deg3D(stand.world.near.hipJoint, stand.world.near.knee, stand.world.near.ankle)).toBeGreaterThanOrEqual(172);
    expect(deg3D(stand.world.far.hipJoint, stand.world.far.knee, stand.world.far.ankle)).toBeGreaterThanOrEqual(172);

    // Step forward advances the front foot > 20 units; lowering from Pose 1 to Pose 2 drops the hips STRAIGHT DOWN.
    expect(step.world.near.ankle[0] - stand.world.near.ankle[0]).toBeGreaterThan(20);
    expect(Math.abs(bot.world.hip[0] - step.world.hip[0])).toBeLessThan(0.05);
    expect(step.world.hip[1] - bot.world.hip[1]).toBeGreaterThan(15);

    // At bottom, front knee is in line with the toes and front foot is flat on the floor.
    expect(Math.abs(bot.world.near.knee[0] - bot.world.near.toe[0])).toBeLessThan(1.0);
    expect(bot.world.near.ankle[1]).toBeCloseTo(ANKLE_Y, 6);
    expect(bot.world.near.toe[1]).toBeCloseTo(ANKLE_Y, 6);

    // Torso stays upright and eyes forward across every 33 ms tick.
    for (const s of samples) {
      expect(s.figure.angles.trunk[0]).toBeGreaterThanOrEqual(88);
      expect(s.figure.world.head[1] - s.figure.world.neck[1]).toBeCloseTo(9, 2);
    }

    // Post-set leg change is in the last caption only.
    expect(entry.frames.at(-1).caption.toLowerCase()).toContain('change legs');
    for (const f of entry.frames.slice(0, -1)) {
      expect(f.caption.toLowerCase()).not.toContain('change legs');
    }
  });

  test('194 Elevated Back Lunge: both feet on low platform, steps back off platform until back knee reaches floor (painted contact), alternates legs', () => {
    const entry = entryFor(194);
    const { samples, at } = sampleCycle(entry);
    const nearBack = rig.chainGeometry('elevated-back-lunge', 0, BODY);
    const stand = rig.chainGeometry('elevated-back-lunge', 1, BODY);
    const farBack = rig.chainGeometry('elevated-back-lunge', 2, BODY);

    // Standing on platform (ph = 1): both feet at platform height (6.0 + ANKLE_Y), both knees straight (>= 172 deg).
    expect(stand.world.near.ankle[1]).toBeCloseTo(6 + ANKLE_Y, 6);
    expect(stand.world.far.ankle[1]).toBeCloseTo(6 + ANKLE_Y, 6);
    expect(deg3D(stand.world.near.hipJoint, stand.world.near.knee, stand.world.near.ankle)).toBeGreaterThanOrEqual(172);
    expect(deg3D(stand.world.far.hipJoint, stand.world.far.knee, stand.world.far.ankle)).toBeGreaterThanOrEqual(172);

    // Pose 0 (near leg stepped back): near knee reaches the floor (CHAIN_KNEELING_KNEE) with painted contact at FLOOR = 96.9.
    expect(nearBack.world.near.ankle[0]).toBeLessThan(-15);
    expect(nearBack.world.far.ankle[1]).toBeCloseTo(6 + ANKLE_Y, 6);
    expect(nearBack.world.near.knee[1]).toBeCloseTo(KNEELING_KNEE_Y, 2);
    const tNearBot = entry.segmentDurationsMs[0];
    const sNearBot = at(tNearBot);
    const nearThighBone = sNearBot.prims.find(
      (p) => p.kind === 'bone' && p.x1 === sNearBot.joints.nLeg[0] && p.y1 === sNearBot.joints.nLeg[1] && p.x2 === sNearBot.joints.kn[0] && p.y2 === sNearBot.joints.kn[1],
    );
    expect(nearThighBone).toBeDefined();
    expect(Math.max(nearThighBone.y1, nearThighBone.y2) + nearThighBone.w / 2).toBeCloseTo(FLOOR, 1);

    // Pose 2 (far leg stepped back): far knee reaches the floor (CHAIN_KNEELING_KNEE) with painted contact at FLOOR = 96.9.
    expect(farBack.world.far.ankle[0]).toBeLessThan(-15);
    expect(farBack.world.near.ankle[1]).toBeCloseTo(6 + ANKLE_Y, 6);
    expect(farBack.world.far.knee[1]).toBeCloseTo(KNEELING_KNEE_Y, 2);
    const tFarBot = entry.segmentDurationsMs.slice(0, 3).reduce((a, b) => a + b, 0);
    const sFarBot = at(tFarBot);
    const farThighBone = sFarBot.prims.find(
      (p) => p.kind === 'bone' && p.x1 === sFarBot.joints.fLeg[0] && p.y1 === sFarBot.joints.fLeg[1] && p.x2 === sFarBot.joints.kf[0] && p.y2 === sFarBot.joints.kf[1],
    );
    expect(farThighBone).toBeDefined();
    expect(Math.max(farThighBone.y1, farThighBone.y2) + farThighBone.w / 2).toBeCloseTo(FLOOR, 1);

    // Platform box is drawn.
    const box = samples[0].prims.find((p) => p.kind === 'rect');
    expect(box).toBeDefined();
  });

  test('239 Lunge Pass Through: kettlebell in one hand, steps forward with opposite foot and passes bell under front thigh to other hand, repeats on other side', () => {
    const entry = entryFor(239);
    const { samples } = sampleCycle(entry);
    const p0 = rig.chainGeometry('lunge-pass-through', 0, BODY);
    const p1 = rig.chainGeometry('lunge-pass-through', 1, BODY);
    const p2 = rig.chainGeometry('lunge-pass-through', 2, BODY);
    const p3 = rig.chainGeometry('lunge-pass-through', 3, BODY);
    const p4 = rig.chainGeometry('lunge-pass-through', 4, BODY);
    const p5 = rig.chainGeometry('lunge-pass-through', 5, BODY);

    // Standing poses (ph = 0 and ph = 3) have straight knees (>= 172 deg) and bell in near hand (ph = 0) then far hand (ph = 3).
    expect(deg3D(p0.world.near.hipJoint, p0.world.near.knee, p0.world.near.ankle)).toBeGreaterThanOrEqual(172);
    expect(deg3D(p0.world.far.hipJoint, p0.world.far.knee, p0.world.far.ankle)).toBeGreaterThanOrEqual(172);
    expect(deg3D(p3.world.near.hipJoint, p3.world.near.knee, p3.world.near.ankle)).toBeGreaterThanOrEqual(172);
    expect(deg3D(p3.world.far.hipJoint, p3.world.far.knee, p3.world.far.ankle)).toBeGreaterThanOrEqual(172);
    expect(p0.world.kettlebell.side).toBeCloseTo(1, 6);
    expect(dist3(p0.world.kettlebell.grip, p0.world.near.hold)).toBeLessThan(1e-6);
    expect(p3.world.kettlebell.side).toBeCloseTo(-1, 6);
    expect(dist3(p3.world.kettlebell.grip, p3.world.far.hold)).toBeLessThan(1e-6);

    // First lunge (far foot forward, ph = 1 -> 2): bell passes under the front (far) thigh from near side (> 0) to far side (< 0).
    for (const fig of [p1, p2]) {
      const farThighMidY = (fig.world.far.hipJoint[1] + fig.world.far.knee[1]) / 2;
      expect(fig.world.far.ankle[0]).toBeGreaterThan(10);
      expect(fig.world.near.knee[1]).toBeLessThan(5);
      expect(fig.world.kettlebell.body[1]).toBeLessThan(farThighMidY - 3.0);
    }
    expect(p1.world.kettlebell.side).toBeGreaterThan(0);
    expect(p2.world.kettlebell.side).toBeLessThan(0);

    // Second lunge (near foot forward, ph = 4 -> 5): bell passes under the front (near) thigh from far side (< 0) to near side (> 0).
    for (const fig of [p4, p5]) {
      const nearThighMidY = (fig.world.near.hipJoint[1] + fig.world.near.knee[1]) / 2;
      expect(fig.world.near.ankle[0]).toBeGreaterThan(10);
      expect(fig.world.far.knee[1]).toBeLessThan(5);
      expect(fig.world.kettlebell.body[1]).toBeLessThan(nearThighMidY - 3.0);
    }
    expect(p4.world.kettlebell.side).toBeLessThan(0);
    expect(p5.world.kettlebell.side).toBeGreaterThan(0);

    // Torso stays upright across every 33 ms tick, and the painted kettlebell visibly changes side (textHi <-> textLow).
    let sawNearBell = false;
    let sawFarBell = false;
    for (const s of samples) {
      expect(s.figure.angles.trunk[0]).toBeGreaterThanOrEqual(75);
      const kbCircle = s.prims.find((p) => p.kind === 'circle' && Math.abs(p.r - 4.6) < 0.01);
      expect(kbCircle).toBeDefined();
      if (kbCircle.fill === 'textHi') sawNearBell = true;
      if (kbCircle.fill === 'textLow') sawFarBell = true;
    }
    expect(sawNearBell).toBe(true);
    expect(sawFarBell).toBe(true);
  });

  test('67 Kettlebell Pistol Squat: standing foot rooted flat on floor, free leg straight and off floor, CoM with load over standing foot on every tick', () => {
    const entry = entryFor(67);
    const { samples } = sampleCycle(entry);
    const top = rig.chainGeometry('kettlebell-pistol-squat', 0, BODY);
    const bot = rig.chainGeometry('kettlebell-pistol-squat', 2, BODY);

    // Lower slowly (1500 ms) and drive up strong (1100 ms).
    expect(entry.segmentDurationsMs[0]).toBeGreaterThan(entry.segmentDurationsMs[2]);

    // Standing leg is straight at top (>= 172 deg) and deeply flexed at bottom (< 60 deg).
    expect(deg3D(top.world.near.hipJoint, top.world.near.knee, top.world.near.ankle)).toBeGreaterThanOrEqual(172);
    expect(deg3D(bot.world.near.hipJoint, bot.world.near.knee, bot.world.near.ankle)).toBeLessThan(60);

    // Bell reaches forward as a counterbalance at the bottom.
    expect(bot.world.kettlebell.body[0] - top.world.kettlebell.body[0]).toBeGreaterThan(10);

    // Across every 33 ms tick: standing foot is rooted flat on the floor (painted contact), free foot stays off the floor, free leg stays straight (>= 172 deg), and CoM (with load AND without) stays over the standing foot.
    for (const s of samples) {
      const w = s.figure.world;
      expect(dist3(w.near.ankle, top.world.near.ankle)).toBeLessThan(1e-6);
      expect(dist3(w.near.toe, top.world.near.toe)).toBeLessThan(1e-6);
      expect(w.near.ankle[1]).toBeCloseTo(ANKLE_Y, 6);
      expect(w.near.toe[1]).toBeCloseTo(ANKLE_Y, 6);

      const nearFootBone = s.prims.find(
        (p) => p.kind === 'bone' && p.x1 === s.joints.an[0] && p.y1 === s.joints.an[1] && p.x2 === s.figure.toe.near[0] && p.y2 === s.figure.toe.near[1],
      );
      expect(nearFootBone).toBeDefined();
      expect(Math.max(nearFootBone.y1, nearFootBone.y2) + nearFootBone.w / 2).toBeCloseTo(FLOOR, 0);

      // Free leg reaches forward, stays straight (>= 172 deg), and stays well above the floor.
      expect(deg3D(w.far.hipJoint, w.far.knee, w.far.ankle)).toBeGreaterThanOrEqual(172);
      expect(w.far.ankle[1]).toBeGreaterThan(7.0);
      expect(w.far.toe[1]).toBeGreaterThan(9.0);
      expect(w.far.toe[0]).toBeGreaterThan(w.near.toe[0] + 10);

      const farFootBone = s.prims.find(
        (p) => p.kind === 'bone' && p.x1 === s.joints.af[0] && p.y1 === s.joints.af[1] && p.x2 === s.figure.toe.far[0] && p.y2 === s.figure.toe.far[1],
      );
      expect(farFootBone).toBeDefined();
      expect(Math.max(farFootBone.y1, farFootBone.y2) + farFootBone.w / 2).toBeLessThan(FLOOR - 5.0);

      // Single-leg balance: CoM with the kettlebell mass included (and without) stays strictly over [ankle[0], toe[0]].
      const comWithBell = centreOfMass3D(w, w.kettlebell.body, 0.20);
      const comUnloaded = centreOfMass3D(w, null, 0);
      expect(comWithBell[0]).toBeGreaterThanOrEqual(w.near.ankle[0]);
      expect(comWithBell[0]).toBeLessThanOrEqual(w.near.toe[0]);
      expect(comUnloaded[0]).toBeGreaterThanOrEqual(w.near.ankle[0]);
      expect(comUnloaded[0]).toBeLessThanOrEqual(w.near.toe[0]);
      expect(comWithBell[0]).toBeGreaterThan(comUnloaded[0]);
    }
  });

  test('96 Standing Barbell Calf Raise: balls of feet on low block, heel drops below block top at bottom stretch with pause, rises high with top pause, tall body', () => {
    const entry = entryFor(96);
    const { samples } = sampleCycle(entry);
    const neutral = rig.chainGeometry('standing-barbell-calf-raise', 0, BODY);
    const stretch = rig.chainGeometry('standing-barbell-calf-raise', 1, BODY);
    const peak = rig.chainGeometry('standing-barbell-calf-raise', 2, BODY);

    // Block is drawn under the forefeet (top at y = 6.0 in world space).
    const block = samples[0].prims.find((p) => p.kind === 'rect');
    expect(block).toBeDefined();
    const blockTopWorldY = FLOOR - block.y;
    expect(blockTopWorldY).toBeCloseTo(6.0, 2);

    // Forefeet stay planted on the block; at bottom stretch (ph = 1) the ankle/heel is below the block top.
    expect(neutral.world.near.toe[1]).toBeCloseTo(blockTopWorldY + ANKLE_Y, 6);
    expect(stretch.world.near.toe[1]).toBeCloseTo(blockTopWorldY + ANKLE_Y, 6);
    expect(peak.world.near.toe[1]).toBeCloseTo(blockTopWorldY + ANKLE_Y, 6);
    expect(stretch.world.near.ankle[1]).toBeLessThan(blockTopWorldY);
    expect(stretch.world.near.ankle[1] - BODY.lw * 0.41).toBeLessThan(blockTopWorldY - 2.0);
    expect(peak.world.near.ankle[1]).toBeGreaterThan(blockTopWorldY + 5.0);

    // Both pauses are present: bottom stretch pause (frames 1 -> 2) and top pause (frames 3 -> 4).
    expect(entry.frames[1].joints.ph).toBe(1);
    expect(entry.frames[2].joints.ph).toBe(1);
    expect(entry.segmentDurationsMs[1]).toBeGreaterThanOrEqual(450);
    expect(entry.frames[3].joints.ph).toBe(2);
    expect(entry.frames[4].joints.ph).toBe(2);
    expect(entry.segmentDurationsMs[3]).toBeGreaterThanOrEqual(400);

    // Tall body with straight knees (>= 172 deg) and balanced CoM across every 33 ms tick.
    for (const s of samples) {
      const w = s.figure.world;
      expect(deg3D(w.near.hipJoint, w.near.knee, w.near.ankle)).toBeGreaterThanOrEqual(172);
      expect(deg3D(w.far.hipJoint, w.far.knee, w.far.ankle)).toBeGreaterThanOrEqual(172);
      expect(s.figure.angles.trunk[0]).toBeGreaterThanOrEqual(88);
      // MOV-S3-R3: "place the balls of the feet on a stable low block with the heels free".
      // The only support is the part of the foot on the block, from the block's rear edge
      // to the ball of the foot; the loaded centre of mass (and the unloaded one) stays over it.
      const loadPt = lerp3(w.near.hold, w.far.hold, 0.5);
      const comWithBar = centreOfMass3D(w, loadPt, 0.40);
      const comUnloaded = centreOfMass3D(w, null, 0);
      for (const com of [comWithBar, comUnloaded]) {
        expect(com[0]).toBeGreaterThanOrEqual(BLOCK_96.rear);
        expect(com[0]).toBeLessThanOrEqual(Math.min(w.near.toe[0], w.far.toe[0], BLOCK_96.front));
      }
      // The heels are free: the ankles stay behind the block's rear edge by more than the heel's painted radius.
      expect(w.near.ankle[0]).toBeLessThan(BLOCK_96.rear - SHIN_HALF);
      expect(w.far.ankle[0]).toBeLessThan(BLOCK_96.rear - SHIN_HALF);
    }
  });
});

const SHIN_HALF = (BODY.lw * 0.9) / 2;
const FOOT_HALF = (BODY.lw * 0.82) / 2;
const FORE_HALF = (BODY.lw * 0.72) / 2;
const UPPER_HALF = (BODY.lw * 0.88) / 2;
const HAND_R = BODY.lw * 0.44;
const BELL_R = 4.6;
const BOX_STROKE_HALF = 0.6;
const BLOCK_96 = (() => {
  const box = rig.CHAIN_MOVEMENTS['standing-barbell-calf-raise'].equipment.find((s) => s.kind === 'box');
  return { rear: Math.min(box.a[0], box.b[0]), front: Math.max(box.a[0], box.b[0]), top: Math.max(box.a[1], box.b[1]) };
})();

/** Closest distance from point p to segment ab, in 3D. */
function pointSegment3(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], (b[2] ?? 0) - (a[2] ?? 0)];
  const ap = [p[0] - a[0], p[1] - a[1], (p[2] ?? 0) - (a[2] ?? 0)];
  const d = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2] || 1;
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / d));
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
}

/** Closest distance between segments ab and cd, in 3D (dense sampling of ab against exact point-segment distance). */
function segmentSegment3(a, b, c, d) {
  let best = Infinity;
  for (let i = 0; i <= 64; i++) {
    const s = i / 64;
    best = Math.min(best, pointSegment3(lerp3(a, b, s), c, d));
  }
  return best;
}

/** Closest distance in the side plane (x, y) from segment ab to an axis-aligned rectangle; 0 when they touch or cross. */
function segmentRect2(a, b, rect) {
  const inside = (p) => p[0] >= rect.x0 && p[0] <= rect.x1 && p[1] >= rect.y0 && p[1] <= rect.y1;
  let best = Infinity;
  for (let i = 0; i <= 200; i++) {
    const p = [a[0] + (b[0] - a[0]) * (i / 200), a[1] + (b[1] - a[1]) * (i / 200)];
    if (inside(p)) return 0;
    const dx = Math.max(rect.x0 - p[0], 0, p[0] - rect.x1);
    const dy = Math.max(rect.y0 - p[1], 0, p[1] - rect.y1);
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

const PAUSE_WORDS = /\b(pause|paused|pausing|briefly)\b|\bhold(?!\s+(a|one)\s)/i;

describe('MOV-S3-R3 repairs to MOV-A13 (194, 239, 96, 136; hold captions 18, 36, 136, 67, 194)', () => {
  test.each([18, 36, 136, 67, 194])(
    '%i: no caption adds a hold the text does not give, and no dwell inside the cycle lasts longer than 150 ms',
    (id) => {
      const entry = entryFor(id);
      const row = rowFor(id);
      expect(`${row.source.instructions} ${row.source.cues}`).not.toMatch(/\b(pause|briefly)\b/i);
      for (const f of entry.frames) expect(f.caption).not.toMatch(PAUSE_WORDS);
      const phs = entry.frames.map((f) => f.joints.ph);
      for (let i = 0; i < phs.length - 2; i++) {
        if (phs[i] === phs[i + 1]) expect(entry.segmentDurationsMs[i]).toBeLessThanOrEqual(150);
      }
    },
  );

  test('194 Elevated Back Lunge: "Step back off the platform with one leg" — no leg segment off the platform is drawn through it at any tick (painted radii against the platform\'s painted outline)', () => {
    const entry = entryFor(194);
    const { samples } = sampleCycle(entry);
    const box = rig.CHAIN_MOVEMENTS['elevated-back-lunge'].equipment.find((s) => s.kind === 'box');
    const rect = {
      x0: Math.min(box.a[0], box.b[0]) - BOX_STROKE_HALF,
      x1: Math.max(box.a[0], box.b[0]) + BOX_STROKE_HALF,
      y0: Math.min(box.a[1], box.b[1]) - BOX_STROKE_HALF,
      y1: Math.max(box.a[1], box.b[1]) + BOX_STROKE_HALF,
    };
    const top = Math.max(box.a[1], box.b[1]);
    // The platform itself, without its outline: a foot just lifting off its top may touch it but never sink into it.
    const solid = { x0: Math.min(box.a[0], box.b[0]), x1: Math.max(box.a[0], box.b[0]), y0: Math.min(box.a[1], box.b[1]), y1: top };
    let sawStepping = 0;
    for (const s of samples) {
      const w = s.figure.world;
      for (const side of ['near', 'far']) {
        const leg = w[side];
        const planted = Math.abs(leg.ankle[1] - (top + ANKLE_Y)) < 1e-6 && leg.ankle[0] > rect.x0 && leg.ankle[0] < rect.x1;
        // Thighs and knees never touch the platform's painted outline.
        expect(segmentRect2(leg.hipJoint, leg.knee, rect)).toBeGreaterThanOrEqual(THIGH_HALF);
        if (!planted) {
          sawStepping += 1;
          // Above the platform the stepping foot is lifted off its top; once the ankle is behind it, the shin and foot clear its painted outline.
          const over = leg.ankle[0] >= solid.x0;
          const against = over ? solid : rect;
          const give = over ? 0.05 : 0;
          expect(segmentRect2(leg.knee, leg.ankle, against)).toBeGreaterThanOrEqual(SHIN_HALF - give);
          expect(segmentRect2(leg.ankle, leg.toe, against)).toBeGreaterThanOrEqual(FOOT_HALF - give);
        }
      }
    }
    expect(sawStepping).toBeGreaterThan(samples.length / 2);
  });

  test('239 Lunge Pass Through: "Pass the bell under the front thigh" — the bell\'s painted outline clears both thighs and both shins at every tick, it is always in a hand, and it passes directly under the front thigh in each lunge', () => {
    const entry = entryFor(239);
    const { samples } = sampleCycle(entry);
    const ds = entry.segmentDurationsMs;
    const tStand2 = ds.slice(0, 3).reduce((a, b) => a + b, 0);
    let underFar = false;
    let underNear = false;
    for (const s of samples) {
      const w = s.figure.world;
      const bell = w.kettlebell.body;
      for (const side of ['near', 'far']) {
        const leg = w[side];
        expect(pointSegment3(bell, leg.hipJoint, leg.knee)).toBeGreaterThanOrEqual(BELL_R + THIGH_HALF);
        expect(pointSegment3(bell, leg.knee, leg.ankle)).toBeGreaterThanOrEqual(BELL_R + SHIN_HALF);
      }
      // The handle is in a hand: it never hangs between two hands that are apart.
      expect(Math.min(dist3(w.kettlebell.grip, w.near.hold), dist3(w.kettlebell.grip, w.far.hold))).toBeLessThan(1.0);
      // Directly under a thigh: within that thigh's forward span, on its axis across the body, and below it.
      const under = (leg) => {
        const lo = Math.min(leg.hipJoint[0], leg.knee[0]);
        const hi = Math.max(leg.hipJoint[0], leg.knee[0]);
        if (bell[0] < lo || bell[0] > hi) return false;
        const u = (bell[0] - leg.hipJoint[0]) / ((leg.knee[0] - leg.hipJoint[0]) || 1);
        const axis = lerp3(leg.hipJoint, leg.knee, u);
        return Math.abs(bell[2] - axis[2]) < 1.0 && bell[1] < axis[1];
      };
      if (s.t <= tStand2 && w.far.ankle[0] > w.near.ankle[0] + 20 && under(w.far)) underFar = true;
      if (s.t >= tStand2 && w.near.ankle[0] > w.far.ankle[0] + 20 && under(w.near)) underNear = true;
    }
    expect(underFar).toBe(true);
    expect(underNear).toBe(true);
  });

  test('239 Lunge Pass Through: "Step forward with the opposite foot" — the front foot steps forward while the rear foot stays planted (its toe within 0.5 of where it stood)', () => {
    const entry = entryFor(239);
    const { samples } = sampleCycle(entry);
    const ds = entry.segmentDurationsMs;
    const tStand2 = ds.slice(0, 3).reduce((a, b) => a + b, 0);
    const p0 = rig.chainGeometry('lunge-pass-through', 0, BODY).world;
    const p3 = rig.chainGeometry('lunge-pass-through', 3, BODY).world;
    expect(rig.chainGeometry('lunge-pass-through', 1, BODY).world.far.ankle[0] - p0.far.ankle[0]).toBeGreaterThan(20);
    expect(rig.chainGeometry('lunge-pass-through', 4, BODY).world.near.ankle[0] - p3.near.ankle[0]).toBeGreaterThan(20);
    for (const s of samples) {
      const w = s.figure.world;
      const rear = s.t <= tStand2 ? 'near' : 'far';
      const stood = s.t <= tStand2 ? p0[rear].toe : p3[rear].toe;
      expect(Math.abs(w[rear].toe[0] - stood[0])).toBeLessThanOrEqual(0.5);
      expect(Math.abs(w[rear].toe[1] - stood[1])).toBeLessThanOrEqual(0.5);
    }
  });

  test('136 Barbell Lunge: "Step forward with one leg" — the rear foot stays planted (its toe within 0.5 of where it stood) while the front foot steps', () => {
    const entry = entryFor(136);
    const { samples } = sampleCycle(entry);
    const stand = rig.chainGeometry('barbell-lunge', 0, BODY).world;
    for (const s of samples) {
      const w = s.figure.world;
      expect(Math.abs(w.far.toe[0] - stand.far.toe[0])).toBeLessThanOrEqual(0.5);
      expect(Math.abs(w.far.toe[1] - stand.far.toe[1])).toBeLessThanOrEqual(0.5);
    }
  });

  test('96 Standing Barbell Calf Raise: "Lower into an owned stretch, pause, then rise as high as balance allows" — the heel joint drops below the block top at the stretch, and a magnified close-up of the foot on the edge of the block makes the dip and the rise readable', () => {
    const slug = 'standing-barbell-calf-raise';
    const stretch = rig.chainGeometry(slug, 1, BODY);
    const peak = rig.chainGeometry(slug, 2, BODY);
    // World: the heel joint itself is below the surface the ball of the foot rests on.
    expect(stretch.world.near.ankle[1]).toBeLessThan(BLOCK_96.top);
    expect(peak.world.near.ankle[1] - SHIN_HALF).toBeGreaterThan(BLOCK_96.top);
    // The close-up: the foot and the block's rear top corner, magnified at least two times.
    const entry = entryFor(96);
    const { samples } = sampleCycle(entry);
    for (const s of samples) {
      const panel = rig.footCloseUp(s.figure);
      expect(panel).not.toBeNull();
      expect(panel.scale).toBeGreaterThanOrEqual(2);
      // It is the figure's own foot: every placed point is the world point, relative to the corner, times the scale (y up in the world, down on the page).
      const w = s.figure.world.near;
      for (const [placed, world] of [[panel.heel, w.ankle], [panel.ball, w.toe]]) {
        expect(placed[0]).toBeCloseTo(panel.corner[0] + (world[0] - BLOCK_96.rear) * panel.scale, 6);
        expect(placed[1]).toBeCloseTo(panel.corner[1] - (world[1] - BLOCK_96.top) * panel.scale, 6);
      }
      // Everything drawn in the panel stays inside its circle.
      for (const p of panel.prims) {
        const ends = p.kind === 'bone' ? [[p.x1, p.y1], [p.x2, p.y2]] : p.kind === 'rect' ? [[p.x, p.y], [p.x + p.w, p.y], [p.x, p.y + p.h], [p.x + p.w, p.y + p.h]] : [[p.cx, p.cy]];
        const reach = p.kind === 'bone' ? p.w / 2 : p.kind === 'circle' ? p.r : 0;
        for (const e of ends) expect(Math.hypot(e[0] - panel.centre[0], e[1] - panel.centre[1]) + reach).toBeLessThanOrEqual(panel.r + 1e-6);
      }
    }
    const low = rig.footCloseUp(stretch);
    const high = rig.footCloseUp(peak);
    // At the stretch the magnified heel's lowest point is at least 5 page units under the magnified block top; at the top it is above it.
    expect(low.heel[1] + low.heelR - low.corner[1]).toBeGreaterThanOrEqual(5.0);
    expect(high.heel[1] + high.heelR).toBeLessThan(high.corner[1]);
  });
});
