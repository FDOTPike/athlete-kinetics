import {
  CANONICAL_BODY_PARAMETERS,
  CHAIN_ANKLE_HEIGHT,
  CHAIN_FLOOR_BAR_HEIGHT,
  CHAIN_FLOOR_PLATE,
  CHAIN_MOVEMENTS,
  chainGeometry,
  layoutCanonicalFigure,
  poseAtTime,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = CANONICAL_BODY_PARAMETERS;
const FLOOR = 96.9;
const BATCH_IDS = [2, 46, 176, 257, 78, 258, 290];
const CONVENTIONAL_IDS = [2, 46, 176, 257];
const SUMO_IDS = [78, 258, 290];

const entryById = (id) => previewManifest.entries.find((e) => e.movementId === id);
const slugOf = (entry) => entry.assetKey.split('/')[1];
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

function pointToSegmentDist2D(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function includedAngleDeg(a, vertex, c) {
  const u = [a[0] - vertex[0], a[1] - vertex[1], a[2] - vertex[2]];
  const v = [c[0] - vertex[0], c[1] - vertex[1], c[2] - vertex[2]];
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const mag = Math.hypot(...u) * Math.hypot(...v);
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

describe('MOV-A03 floor and sumo deadlifts: batch-wide floor plates, straight arms, head clearance, and family views', () => {
  test.each(BATCH_IDS)('movement %i starts and finishes with floor-sized plates touching the floor line, straight arms, and zero head overlap', (id) => {
    const entry = entryById(id);
    expect(entry).toBeDefined();
    expect(entry.status).toBe('pending');
    expect(entry.frames.length).toBeGreaterThanOrEqual(5);
    expect(entry.frames[0].joints.ph).toBe(0);
    expect(entry.frames.some((f) => f.joints.ph === 1)).toBe(true);
    expect(entry.frames.at(-1).joints.ph).toBe(0);

    const slug = slugOf(entry);
    const movement = CHAIN_MOVEMENTS[slug];
    expect(movement).toBeDefined();
    expect(movement.view).toBe('oblique');
    expect(movement.implement).toBe('bar');
    expect(movement.plateRadius).toBe(CHAIN_FLOOR_PLATE);

    const floorFig = chainGeometry(slug, 0, BODY);
    const barFloorY = (floorFig.world.near.hold[1] + floorFig.world.far.hold[1]) / 2;
    expect(barFloorY).toBeCloseTo(CHAIN_FLOOR_BAR_HEIGHT, 5);

    const floorPrims = layoutCanonicalFigure(entry.frames[0].joints, { ...entry, body: BODY });
    const plates = floorPrims.filter((p) => p.kind === 'bone' && p.w === 2.4 && p.stroke === 'ink1');
    expect(plates.length).toBe(2);
    for (const plate of plates) {
      const paintedBottom = Math.max(plate.y1, plate.y2) + plate.w / 2;
      expect(paintedBottom).toBeCloseTo(FLOOR, 5);
    }

    for (const ph of [0, 0.25, 0.5, 0.75, 1]) {
      const fig = chainGeometry(slug, ph, BODY);
      expect(dist(fig.world.near.shoulder, fig.world.near.wrist)).toBeCloseTo(24.5, 4);
      expect(dist(fig.world.far.shoulder, fig.world.far.wrist)).toBeCloseTo(24.5, 4);
      expect(includedAngleDeg(fig.world.near.shoulder, fig.world.near.elbow, fig.world.near.wrist)).toBeCloseTo(180, 3);
      expect(includedAngleDeg(fig.world.far.shoulder, fig.world.far.elbow, fig.world.far.wrist)).toBeCloseTo(180, 3);
    }

    const total = entry.segmentDurationsMs.reduce((a, b) => a + b, 0);
    for (let t = 0; t <= total; t += 33) {
      const pose = poseAtTime(entry.frames.map((f) => f.joints), t, entry.segmentDurationsMs);
      const fig = chainGeometry(slug, pose.ph, BODY, pose.tw ?? 0);
      const j = fig.joints;
      const headOuterR = BODY.hr + 0.7;
      for (const [segA, segB, halfW] of [
        [j.nArm, j.el, BODY.lw * 0.44],
        [j.el, j.wr, BODY.lw * 0.36],
        [j.fArm, j.ef, BODY.lw * 0.44],
        [j.ef, j.wf, BODY.lw * 0.36],
      ]) {
        const d = pointToSegmentDist2D(j.hd, segA, segB) - halfW - headOuterR;
        expect(d).toBeGreaterThan(0);
      }
    }
  });

  test('conventional floor deadlifts share one oblique view (24 deg) and sumo floor deadlifts share one front-plus-side oblique view (46 deg)', () => {
    for (const id of CONVENTIONAL_IDS) {
      const entry = entryById(id);
      expect(entry).toBeDefined();
      expect(CHAIN_MOVEMENTS[slugOf(entry)].yawDeg).toBe(24);
      expect(entry.reason).toContain('turned 24 degrees');
    }
    for (const id of SUMO_IDS) {
      const entry = entryById(id);
      expect(entry).toBeDefined();
      expect(CHAIN_MOVEMENTS[slugOf(entry)].yawDeg).toBe(46);
      expect(entry.reason).toContain('turned 46 degrees');
    }
  });
});

describe('MOV-A03 per-movement source-bound geometry', () => {
  test('2 Deadlift: bar over mid-foot, shins brought to the bar, flat braced back, bar stays close to legs to standing tall', () => {
    const entry = entryById(2);
    expect(entry).toBeDefined();
    const slug = slugOf(entry);

    const floor = chainGeometry(slug, 0, BODY);
    const top = chainGeometry(slug, 1, BODY);
    const midFootX = (floor.world.near.ankle[0] + floor.world.near.toe[0]) / 2;
    const barFloor = [
      (floor.world.near.hold[0] + floor.world.far.hold[0]) / 2,
      (floor.world.near.hold[1] + floor.world.far.hold[1]) / 2,
    ];
    expect(Math.abs(barFloor[0] - midFootX)).toBeLessThanOrEqual(1.0);

    // Shins brought to the bar at bar height (Y = 9.5), and hips sit between knees and shoulders.
    const shinFrac = (CHAIN_FLOOR_BAR_HEIGHT - floor.world.near.ankle[1]) / (floor.world.near.knee[1] - floor.world.near.ankle[1]);
    const shinXAtBar = floor.world.near.ankle[0] + shinFrac * (floor.world.near.knee[0] - floor.world.near.ankle[0]);
    expect(barFloor[0] - shinXAtBar).toBeGreaterThan(0);
    expect(barFloor[0] - shinXAtBar).toBeLessThanOrEqual(2.5);
    expect(floor.world.hip[1]).toBeGreaterThan(floor.world.near.knee[1] + 1.0);
    expect(floor.world.neck[1]).toBeGreaterThan(floor.world.hip[1] + 10.0);

    // Bar travels straight up close to the legs to standing lockout.
    for (const ph of [0, 0.25, 0.5, 0.75, 1]) {
      const fig = chainGeometry(slug, ph, BODY);
      const barX = (fig.world.near.hold[0] + fig.world.far.hold[0]) / 2;
      expect(Math.abs(barX - midFootX)).toBeLessThanOrEqual(1.0);
      expect(fig.curled).toBe(false);
    }
    const barTop = [
      (top.world.near.hold[0] + top.world.far.hold[0]) / 2,
      (top.world.near.hold[1] + top.world.far.hold[1]) / 2,
    ];
    expect(barTop[1] - barFloor[1]).toBeGreaterThan(34);
    expect(top.angles.trunk[0]).toBeGreaterThanOrEqual(86);
    expect(barTop[0] - top.world.hip[0]).toBeLessThanOrEqual(3.5);
  });

  test('46 Deficit Deadlift: standing on a low platform with more knee and hip bend, flat back, and longer pull range than Deadlift', () => {
    const dlEntry = entryById(2);
    const defEntry = entryById(46);
    expect(dlEntry).toBeDefined();
    expect(defEntry).toBeDefined();
    const dlSlug = slugOf(dlEntry);
    const defSlug = slugOf(defEntry);
    const defMov = CHAIN_MOVEMENTS[defSlug];

    // Low platform (1-3 inches) drawn under the feet.
    const boxes = (defMov.equipment ?? []).filter((e) => e.kind === 'box');
    expect(boxes.length).toBeGreaterThanOrEqual(1);
    const floorPrims = layoutCanonicalFigure(defEntry.frames[0].joints, { ...defEntry, body: BODY });
    const platformRect = floorPrims.find((p) => p.kind === 'rect');
    expect(platformRect).toBeDefined();
    expect(platformRect.h).toBeGreaterThanOrEqual(1.5);
    expect(platformRect.h).toBeLessThanOrEqual(3.5);

    const dlFloor = chainGeometry(dlSlug, 0, BODY);
    const defFloor = chainGeometry(defSlug, 0, BODY);
    const dlTop = chainGeometry(dlSlug, 1, BODY);
    const defTop = chainGeometry(defSlug, 1, BODY);

    // Feet stand higher on the platform while the bar still starts at CHAIN_FLOOR_BAR_HEIGHT on the floor.
    expect(defFloor.world.near.ankle[1]).toBeGreaterThan(dlFloor.world.near.ankle[1] + 2.0);
    const dlBarRelFoot = dlFloor.world.near.hold[1] - dlFloor.world.near.ankle[1];
    const defBarRelFoot = defFloor.world.near.hold[1] - defFloor.world.near.ankle[1];
    expect(defBarRelFoot).toBeLessThan(dlBarRelFoot - 2.0);

    // More knee bend and more hip bend at the start, with a flat back.
    const dlKneeAngle = includedAngleDeg(dlFloor.world.near.hipJoint, dlFloor.world.near.knee, dlFloor.world.near.ankle);
    const defKneeAngle = includedAngleDeg(defFloor.world.near.hipJoint, defFloor.world.near.knee, defFloor.world.near.ankle);
    expect(defKneeAngle).toBeLessThan(dlKneeAngle - 4.0);

    const dlHipAngle = includedAngleDeg(dlFloor.world.neck, dlFloor.world.hip, dlFloor.world.near.knee);
    const defHipAngle = includedAngleDeg(defFloor.world.neck, defFloor.world.hip, defFloor.world.near.knee);
    expect(defHipAngle).toBeLessThan(dlHipAngle - 4.0);
    expect(defFloor.angles.trunk[0]).toBeLessThan(dlFloor.angles.trunk[0] - 4.0);
    expect(defFloor.curled).toBe(false);

    // Longer bottom-to-top pull range of motion.
    const dlRange = dlTop.world.near.hold[1] - dlFloor.world.near.hold[1];
    const defRange = defTop.world.near.hold[1] - defFloor.world.near.hold[1];
    expect(defRange).toBeGreaterThan(dlRange + 2.0);
  });

  test('176 Deadlift with Bands: bands looped over bar ends and anchored under the feet, grip outside legs, stretching to lockout', () => {
    const entry = entryById(176);
    expect(entry).toBeDefined();
    const slug = slugOf(entry);
    const mov = CHAIN_MOVEMENTS[slug];

    expect(mov.lines).toEqual([
      { from: 'nearFoot', to: 'nearBarEnd' },
      { from: 'farFoot', to: 'farBarEnd', depth: 'far' },
    ]);

    const floor = chainGeometry(slug, 0, BODY);
    const top = chainGeometry(slug, 1, BODY);
    const ankleSpanZ = Math.abs(floor.world.near.ankle[2] - floor.world.far.ankle[2]);
    const wristSpanZ = Math.abs(floor.world.near.wrist[2] - floor.world.far.wrist[2]);
    expect(wristSpanZ).toBeGreaterThan(ankleSpanZ + 6);

    const floorPrims = layoutCanonicalFigure(entry.frames[0].joints, { ...entry, body: BODY });
    const topFrame = entry.frames.find((f) => f.joints.ph === 1);
    const topPrims = layoutCanonicalFigure(topFrame.joints, { ...entry, body: BODY });
    const floorBands = floorPrims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4);
    const topBands = topPrims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4);
    expect(floorBands.length).toBe(2);
    expect(topBands.length).toBe(2);
    for (let i = 0; i < 2; i++) {
      const lenFloor = Math.hypot(floorBands[i].x2 - floorBands[i].x1, floorBands[i].y2 - floorBands[i].y1);
      const lenTop = Math.hypot(topBands[i].x2 - topBands[i].x1, topBands[i].y2 - topBands[i].y1);
      expect(lenTop).toBeGreaterThan(lenFloor + 28);
    }
    expect(top.world.hip[0] - floor.world.hip[0]).toBeGreaterThan(12);
  });

  test('257 Reverse Band Deadlift: inside a rack with bands hung from the top to the bar ends, hip-width stance and shoulder-width grip', () => {
    const entry = entryById(257);
    expect(entry).toBeDefined();
    const slug = slugOf(entry);
    const mov = CHAIN_MOVEMENTS[slug];

    const frames = (mov.equipment ?? []).filter((e) => e.kind === 'frame');
    expect(frames.length).toBeGreaterThanOrEqual(4);
    expect(mov.lines?.length).toBe(2);
    for (const line of mov.lines) {
      expect(Array.isArray(line.from)).toBe(true);
      expect(line.from[1]).toBeGreaterThanOrEqual(80);
    }

    const floor = chainGeometry(slug, 0, BODY);
    const ankleSpanZ = Math.abs(floor.world.near.ankle[2] - floor.world.far.ankle[2]);
    const wristSpanZ = Math.abs(floor.world.near.wrist[2] - floor.world.far.wrist[2]);
    expect(ankleSpanZ).toBeGreaterThanOrEqual(11);
    expect(ankleSpanZ).toBeLessThanOrEqual(15);
    expect(wristSpanZ).toBeGreaterThan(ankleSpanZ + 6);

    const floorPrims = layoutCanonicalFigure(entry.frames[0].joints, { ...entry, body: BODY });
    const topFrame = entry.frames.find((f) => f.joints.ph === 1);
    const topPrims = layoutCanonicalFigure(topFrame.joints, { ...entry, body: BODY });
    const floorBands = floorPrims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4);
    const topBands = topPrims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4);
    expect(floorBands.length).toBe(2);
    expect(topBands.length).toBe(2);
    for (let i = 0; i < 2; i++) {
      const lenFloor = Math.hypot(floorBands[i].x2 - floorBands[i].x1, floorBands[i].y2 - floorBands[i].y1);
      const lenTop = Math.hypot(topBands[i].x2 - topBands[i].x1, topBands[i].y2 - topBands[i].y1);
      expect(lenFloor).toBeGreaterThan(lenTop + 28);
    }
  });

  test('78 Sumo Deadlift: wide stance with toes pointed out, straight arms gripping inside the knees in 3D and 2D, bar over mid-foot', () => {
    const dlEntry = entryById(2);
    const sumoEntry = entryById(78);
    expect(dlEntry).toBeDefined();
    expect(sumoEntry).toBeDefined();
    const dlFloor = chainGeometry(slugOf(dlEntry), 0, BODY);
    const floor = chainGeometry(slugOf(sumoEntry), 0, BODY);
    const top = chainGeometry(slugOf(sumoEntry), 1, BODY);

    const dlAnkleSpanZ = Math.abs(dlFloor.world.near.ankle[2] - dlFloor.world.far.ankle[2]);
    const sumoAnkleSpanZ = Math.abs(floor.world.near.ankle[2] - floor.world.far.ankle[2]);
    expect(sumoAnkleSpanZ).toBeGreaterThan(dlAnkleSpanZ * 2);
    expect(floor.angles.foot[1]).toBeGreaterThanOrEqual(32);

    // Arms grip INSIDE the knees both in 3D world Z and in 2D projected X.
    const wristSpanZ = Math.abs(floor.world.near.wrist[2] - floor.world.far.wrist[2]);
    const kneeSpanZ = Math.abs(floor.world.near.knee[2] - floor.world.far.knee[2]);
    expect(wristSpanZ).toBeLessThan(kneeSpanZ - 14);
    expect(floor.joints.kn[0]).toBeLessThan(floor.joints.wr[0] - 4);
    expect(floor.joints.wr[0]).toBeLessThan(floor.joints.wf[0] - 4);
    expect(floor.joints.wf[0]).toBeLessThan(floor.joints.kf[0] - 4);

    // Bar over mid-foot and rises straight up against the legs to lockout.
    const midFootX = (floor.world.near.ankle[0] + floor.world.near.toe[0]) / 2;
    const barFloorX = (floor.world.near.hold[0] + floor.world.far.hold[0]) / 2;
    const barTopX = (top.world.near.hold[0] + top.world.far.hold[0]) / 2;
    expect(Math.abs(barFloorX - midFootX)).toBeLessThanOrEqual(1.0);
    expect(Math.abs(barTopX - midFootX)).toBeLessThanOrEqual(1.0);
    expect(top.world.near.hold[1] - floor.world.near.hold[1]).toBeGreaterThan(32);
    expect(top.angles.trunk[0]).toBeGreaterThanOrEqual(86);
  });

  test('258 Reverse Band Sumo Deadlift: sumo wide stance and inside-knee grip inside a rack with bands hung from the top', () => {
    const entry = entryById(258);
    expect(entry).toBeDefined();
    const slug = slugOf(entry);
    const mov = CHAIN_MOVEMENTS[slug];

    const frames = (mov.equipment ?? []).filter((e) => e.kind === 'frame');
    expect(frames.length).toBeGreaterThanOrEqual(4);
    expect(mov.lines?.length).toBe(2);
    for (const line of mov.lines) {
      expect(Array.isArray(line.from)).toBe(true);
      expect(line.from[1]).toBeGreaterThanOrEqual(80);
    }

    const floor = chainGeometry(slug, 0, BODY);
    const top = chainGeometry(slug, 1, BODY);
    const ankleSpanZ = Math.abs(floor.world.near.ankle[2] - floor.world.far.ankle[2]);
    const wristSpanZ = Math.abs(floor.world.near.wrist[2] - floor.world.far.wrist[2]);
    const kneeSpanZ = Math.abs(floor.world.near.knee[2] - floor.world.far.knee[2]);
    expect(ankleSpanZ).toBeGreaterThanOrEqual(30);
    expect(wristSpanZ).toBeLessThan(kneeSpanZ - 14);
    expect(floor.joints.kn[0]).toBeLessThan(floor.joints.wr[0] - 4);
    expect(floor.joints.wf[0]).toBeLessThan(floor.joints.kf[0] - 4);
    expect(top.world.hip[0] - floor.world.hip[0]).toBeGreaterThan(10);

    const floorPrims = layoutCanonicalFigure(entry.frames[0].joints, { ...entry, body: BODY });
    const topFrame = entry.frames.find((f) => f.joints.ph === 1);
    const topPrims = layoutCanonicalFigure(topFrame.joints, { ...entry, body: BODY });
    const floorBands = floorPrims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4);
    const topBands = topPrims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4);
    expect(floorBands.length).toBe(2);
    expect(topBands.length).toBe(2);
    for (let i = 0; i < 2; i++) {
      const lenFloor = Math.hypot(floorBands[i].x2 - floorBands[i].x1, floorBands[i].y2 - floorBands[i].y1);
      const lenTop = Math.hypot(topBands[i].x2 - topBands[i].x1, topBands[i].y2 - topBands[i].y1);
      expect(lenFloor).toBeGreaterThan(lenTop + 28);
    }
  });

  test('290 Sumo Deadlift with Bands: short bands anchored under wide sumo feet, arms inside legs, stretching to lockout', () => {
    const entry = entryById(290);
    expect(entry).toBeDefined();
    const slug = slugOf(entry);
    const mov = CHAIN_MOVEMENTS[slug];

    expect(mov.lines).toEqual([
      { from: 'nearFoot', to: 'nearBarEnd' },
      { from: 'farFoot', to: 'farBarEnd', depth: 'far' },
    ]);

    const floor = chainGeometry(slug, 0, BODY);
    const top = chainGeometry(slug, 1, BODY);
    const ankleSpanZ = Math.abs(floor.world.near.ankle[2] - floor.world.far.ankle[2]);
    const wristSpanZ = Math.abs(floor.world.near.wrist[2] - floor.world.far.wrist[2]);
    const kneeSpanZ = Math.abs(floor.world.near.knee[2] - floor.world.far.knee[2]);
    expect(ankleSpanZ).toBeGreaterThanOrEqual(30);
    expect(wristSpanZ).toBeLessThan(kneeSpanZ - 14);
    expect(floor.joints.kn[0]).toBeLessThan(floor.joints.wr[0] - 4);
    expect(floor.joints.wf[0]).toBeLessThan(floor.joints.kf[0] - 4);

    const floorPrims = layoutCanonicalFigure(entry.frames[0].joints, { ...entry, body: BODY });
    const topFrame = entry.frames.find((f) => f.joints.ph === 1);
    const topPrims = layoutCanonicalFigure(topFrame.joints, { ...entry, body: BODY });
    const floorBands = floorPrims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4);
    const topBands = topPrims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4);
    expect(floorBands.length).toBe(2);
    expect(topBands.length).toBe(2);
    for (let i = 0; i < 2; i++) {
      const lenFloor = Math.hypot(floorBands[i].x2 - floorBands[i].x1, floorBands[i].y2 - floorBands[i].y1);
      const lenTop = Math.hypot(topBands[i].x2 - topBands[i].x1, topBands[i].y2 - topBands[i].y1);
      expect(lenTop).toBeGreaterThan(lenFloor + 28);
    }
    expect(top.world.hip[0] - floor.world.hip[0]).toBeGreaterThan(10);
  });
});
