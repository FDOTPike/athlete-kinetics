/**
 * MOV-A10 — Vertical pulls and hanging (6, 13, 71, 108, 209, 77, 211, 64).
 *
 * Source-text-bound and physics-bound tests across every 33 ms tick of each
 * movement's cycle, written before authoring the drawings.
 */
import * as rig from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';
import catalogue from '../../../../docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json';

const BODY = rig.CANONICAL_BODY_PARAMETERS;
const IDS = [6, 13, 71, 108, 209, 77, 211, 64];
const HANGING_IDS = [6, 13, 71, 211, 64];
const BAR_Y = 105;
const BAR_X = 0;
const THIGH_HALF = (BODY.lw * 1.18) / 2;
const TRUNK = 24;
const SLACK = 0.1;

const entryFor = (id) => {
  const e = previewManifest.entries.find((x) => x.movementId === id);
  expect(e).toBeDefined();
  return e;
};

const rowFor = (id) => catalogue.movements.find((m) => m.id === id);
const slugOf = (e) => e.assetKey.split('/')[1];

const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] ?? 0) - (b[2] ?? 0));

const deg3D = (a, b, c) => {
  const ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2];
  const vx = c[0] - b[0], vy = c[1] - b[1], vz = c[2] - b[2];
  const n = Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz) || 1;
  return (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / n))) * 180) / Math.PI;
};

const direction2D = (from, to) => ((Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI + 360) % 360;

const onTrunk = (world, point) => {
  const ux = (world.neck[0] - world.hip[0]) / TRUNK;
  const uy = (world.neck[1] - world.hip[1]) / TRUNK;
  const dx = point[0] - world.hip[0];
  const dy = point[1] - world.hip[1];
  return { along: dx * ux + dy * uy, front: dx * uy - dy * ux };
};

const segPointDist2D = (x1, y1, x2, y2, px, py) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
};

/**
 * Segmental 3D Centre of Mass (Winter anthropometric mass fractions).
 * When `extraLoadMass > 0` and `world.waistLoad` is present, returns the
 * combined system CoM (athlete + suspended external load).
 */
function centreOfMass3D(world, extraLoadMass = 0) {
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
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
  if (extraLoadMass > 0 && world.waistLoad) {
    parts.push([world.waistLoad, extraLoadMass]);
  }
  let totalM = 0, cx = 0, cy = 0, cz = 0;
  for (const [p, m] of parts) {
    totalM += m;
    cx += p[0] * m;
    cy += p[1] * m;
    cz += p[2] * m;
  }
  return [cx / totalM, cy / totalM, cz / totalM];
}

function expectOnlyGrows(lengths, minGain) {
  let longest = lengths[0];
  for (const now of lengths) {
    expect(now).toBeGreaterThanOrEqual(longest - SLACK);
    longest = Math.max(longest, now);
  }
  expect(lengths.at(-1)).toBeGreaterThan(lengths[0] + minGain);
}

describe('MOV-A10 vertical pulls and hanging: physics, CoM under grip, cable tension, and text bounds', () => {
  test.each(IDS)('movement %i is authored as pending with at least 5 frames, loop closure, and primitives inside viewBox on every 33 ms tick', (id) => {
    const e = entryFor(id);
    expect(e.status).toBe('pending');
    expect(e.frames.length).toBeGreaterThanOrEqual(5);
    expect(e.frames[0].joints.ph).toBe(0);
    expect(e.frames.at(-1).joints.ph).toBe(0);
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

  test.each(HANGING_IDS)('hanging movement %i keeps both hands locked on the overhead bar, feet off the floor, and centre of mass directly under the bar at every 33 ms tick', (id) => {
    const e = entryFor(id);
    const slug = slugOf(e);
    const ds = e.segmentDurationsMs;
    const total = ds.reduce((a, b) => a + b, 0);
    const poses = e.frames.map((f) => f.joints);
    for (let t = 0; t <= total; t += 33) {
      const p = rig.poseAtTime(poses, t, ds);
      const g = rig.chainGeometry(slug, p.ph, BODY);
      const w = g.world;
      // Both hands stay fixed on the overhead bar at [0, 105, ±gripHalf]
      expect(Math.hypot(w.near.grip[0] - BAR_X, w.near.grip[1] - BAR_Y)).toBeLessThan(0.05);
      expect(Math.hypot(w.far.grip[0] - BAR_X, w.far.grip[1] - BAR_Y)).toBeLessThan(0.05);
      // Feet hang well clear of the floor
      for (const side of [w.near, w.far]) {
        expect(Math.min(side.ankle[1], side.toe[1])).toBeGreaterThan(10);
      }
      // Centre of mass stays directly under the bar at every tick
      const com = centreOfMass3D(w, id === 6 ? 0.25 : 0);
      expect(Math.abs(com[0] - BAR_X)).toBeLessThanOrEqual(0.8);
      expect(Math.abs(com[2])).toBeLessThan(1e-6);
      expect(com[1]).toBeLessThan(BAR_Y - 15);
    }
  });

  test('6 Weighted Pull-up hangs an external load centrally clear of the floor and body, keeps the load quiet, pulls chest to the bar, and returns to long arms', () => {
    // Quotes (ALL_300_MOTION_MAP.json:1722-1723):
    // "Secure the external load so it hangs centrally and test that it stays clear of the floor and body. Take a controlled full hang with a firm grip and a quiet trunk. Drive the elbows down to bring the chest toward the bar, then lower to long arms; if range shortens or the load swings, use less weight."
    // "Drive the elbows toward the ribs. Keep the added load quiet. Own the full return to long arms."
    const row = rowFor(6);
    expect(row.source.instructions).toContain('Secure the external load so it hangs centrally and test that it stays clear of the floor and body.');
    expect(row.source.instructions).toContain('Drive the elbows down to bring the chest toward the bar, then lower to long arms; if range shortens or the load swings, use less weight.');
    expect(row.source.cues).toContain('Drive the elbows toward the ribs. Keep the added load quiet. Own the full return to long arms.');

    const e = entryFor(6);
    const slug = slugOf(e);
    const start = rig.chainGeometry(slug, 0, BODY);
    const top = rig.chainGeometry(slug, 1, BODY);

    // Controlled full hang at start -> elbows driven down at top to bring chest toward the bar
    expect(deg3D(start.world.near.shoulder, start.world.near.elbow, start.world.near.wrist)).toBeGreaterThanOrEqual(175);
    expect(top.world.near.elbow[1]).toBeLessThan(top.world.near.shoulder[1] - 9);
    expect(top.world.neck[1]).toBeGreaterThan(101.5);
    expect(top.world.head[1] - BODY.hr).toBeGreaterThan(BAR_Y);

    // External load hangs centrally, stays quiet, and stays clear of the floor and body on every tick
    expect(start.world.waistLoad).toBeDefined();
    expect(top.world.waistLoad[1] - start.world.waistLoad[1]).toBeGreaterThan(22);

    const ds = e.segmentDurationsMs;
    const total = ds.reduce((a, b) => a + b, 0);
    const poses = e.frames.map((f) => f.joints);
    for (let t = 0; t <= total; t += 33) {
      const p = rig.poseAtTime(poses, t, ds);
      const g = rig.chainGeometry(slug, p.ph, BODY);
      const w = g.world;
      expect(w.waistLoad).toBeDefined();
      // Hangs centrally under the hips (z = 0, x = hip[0]) and stays quiet (no horizontal swing)
      expect(w.waistLoad[2]).toBe(0);
      expect(Math.abs(w.waistLoad[0] - w.hip[0])).toBeLessThan(1e-6);
      expect(Math.abs(w.waistLoad[0] - start.world.waistLoad[0])).toBeLessThanOrEqual(1.2);
      // Clear of the floor (y > 35) and clear of the legs in 3D
      expect(w.waistLoad[1] - 3.7).toBeGreaterThan(35);
      expect(dist3(w.waistLoad, w.near.knee)).toBeGreaterThan(8);
      expect(dist3(w.waistLoad, w.far.knee)).toBeGreaterThan(8);

      // Clear of the painted near and far thighs in 2D projection
      const prims = rig.layoutCanonicalFigure(p, { view: e.view, assetKey: e.assetKey, body: BODY });
      const loadPt = g.project(w.waistLoad);
      const plateCircle = prims.find((pr) => pr.kind === 'circle' && Math.abs(pr.cx - loadPt[0]) < 1e-4 && Math.abs(pr.cy - loadPt[1]) < 1e-4 && pr.r >= 3);
      expect(plateCircle).toBeDefined();
      const j = g.joints;
      const rOuter = plateCircle.r + (plateCircle.strokeWidth ?? 0) / 2;
      const nearThighClearance = segPointDist2D(j.nLeg[0], j.nLeg[1], j.kn[0], j.kn[1], plateCircle.cx, plateCircle.cy) - rOuter - THIGH_HALF;
      const farThighClearance = segPointDist2D(j.fLeg[0], j.fLeg[1], j.kf[0], j.kf[1], plateCircle.cx, plateCircle.cy) - rOuter - THIGH_HALF;
      expect(nearThighClearance).toBeGreaterThan(1.0);
      expect(farThighClearance).toBeGreaterThan(1.0);
    }

    // Controlled return to long arms
    const pullMs = ds[0] + ds[1];
    const lowerMs = ds[3];
    expect(lowerMs).toBeGreaterThanOrEqual(1.3 * pullMs);
  });

  test('13 Chin-up and 71 Pull-Up satisfy their full-hang, chest-to-bar, and chin-without-reaching bounds while visibly distinguishing underhand shoulder-width vs overhand wider grip', () => {
    // 13 Chin-up quotes (ALL_300_MOTION_MAP.json:2204-2205):
    // "Take an underhand grip around shoulder width and begin from a controlled full hang. Drive the elbows down to bring the upper chest toward the bar without reaching with the chin. Lower to long arms; if the bottom range disappears, finish the set or use assistance."
    // "Drive the elbows toward the ribs. Bring the upper chest to the bar. Own the full return to long arms."
    const row13 = rowFor(13);
    expect(row13.source.instructions).toContain('Take an underhand grip around shoulder width and begin from a controlled full hang.');
    expect(row13.source.instructions).toContain('Drive the elbows down to bring the upper chest toward the bar without reaching with the chin.');
    expect(row13.source.cues).toContain('Drive the elbows toward the ribs. Bring the upper chest to the bar. Own the full return to long arms.');

    // 71 Pull-Up quotes (ALL_300_MOTION_MAP.json:6149-6150):
    // "Take an overhand grip just outside your shoulders and start from a dead hang. Pull your chest towards the bar, driving the elbows down and back, until your chin clears without reaching for it. Lower under full control back to the dead hang — cutting the bottom quietly steals the range that builds the back."
    // "Begin every rep from a controlled full hang. Drive the elbows down and back. Keep the body quiet from hang to bar."
    const row71 = rowFor(71);
    expect(row71.source.instructions).toContain('Take an overhand grip just outside your shoulders and start from a dead hang.');
    expect(row71.source.instructions).toContain('Pull your chest towards the bar, driving the elbows down and back, until your chin clears without reaching for it.');
    expect(row71.source.cues).toContain('Begin every rep from a controlled full hang. Drive the elbows down and back. Keep the body quiet from hang to bar.');

    const e13 = entryFor(13);
    const e71 = entryFor(71);
    const s13 = slugOf(e13);
    const s71 = slugOf(e71);
    const chin0 = rig.chainGeometry(s13, 0, BODY);
    const chin1 = rig.chainGeometry(s13, 1, BODY);
    const pull0 = rig.chainGeometry(s71, 0, BODY);
    const pull1 = rig.chainGeometry(s71, 1, BODY);

    // Both start from a full dead hang (elbow >= 175 deg) and pull upper chest to the bar with chin clearing the bar
    expect(deg3D(chin0.world.near.shoulder, chin0.world.near.elbow, chin0.world.near.wrist)).toBeGreaterThanOrEqual(175);
    expect(deg3D(pull0.world.near.shoulder, pull0.world.near.elbow, pull0.world.near.wrist)).toBeGreaterThanOrEqual(175);
    expect(chin1.world.neck[1]).toBeGreaterThan(101.5);
    expect(pull1.world.neck[1]).toBeGreaterThan(101.5);
    expect(chin1.world.head[1] - BODY.hr).toBeGreaterThan(BAR_Y);
    expect(pull1.world.head[1] - BODY.hr).toBeGreaterThan(BAR_Y);

    // Without reaching with the chin: neck-to-head stays aligned with hip-to-neck within 3 deg
    expect(Math.abs(direction2D(chin1.world.neck, chin1.world.head) - direction2D(chin1.world.hip, chin1.world.neck))).toBeLessThanOrEqual(3);
    expect(Math.abs(direction2D(pull1.world.neck, pull1.world.head) - direction2D(pull1.world.hip, pull1.world.neck))).toBeLessThanOrEqual(3);

    // Visible grip and elbow-path distinction between 13 Chin-up and 71 Pull-Up:
    // 1. Grip width: 13 is around shoulder width (|grip.z - shoulder.z| <= 1.0); 71 is outside shoulders (grip.z >= shoulder.z + 4.5)
    expect(Math.abs(chin0.world.near.grip[2] - chin0.world.near.shoulder[2])).toBeLessThanOrEqual(1.0);
    expect(pull0.world.near.grip[2] - pull0.world.near.shoulder[2]).toBeGreaterThanOrEqual(4.5);
    expect(pull0.world.near.grip[2] - chin0.world.near.grip[2]).toBeGreaterThanOrEqual(4.5);
    // 2. Underhand vs overhand wrist position relative to the bar at x = 0:
    expect(chin0.world.near.wrist[0]).toBeGreaterThan(BAR_X + 3.0);
    expect(pull0.world.near.wrist[0]).toBeLessThan(BAR_X - 3.0);
    // 3. Elbow path at the top: 13 drives elbows down in front toward ribs (x > 0); 71 drives elbows down, wider, and back (x < -3)
    expect(chin1.world.near.elbow[0]).toBeGreaterThan(0);
    expect(pull1.world.near.elbow[0]).toBeLessThan(-3);
    expect(pull1.world.near.elbow[2] - chin1.world.near.elbow[2]).toBeGreaterThanOrEqual(3.5);
  });

  test('108 V-Bar Pulldown locks thighs under the pad, holds a small tall-chest lean back, pulls the neutral V-bar to the upper chest, pauses, and returns to full overhead reach with monotonic cable lengthening', () => {
    // Quotes (ALL_300_MOTION_MAP.json:8623-8624):
    // "Lock the thighs under the pad, take the neutral V-bar, and lean back only enough to keep the chest tall beneath the cable. Pull the elbows down and back until the handle reaches the upper chest, then pause without turning the rep into a row. Return to a full overhead reach without letting the stack settle; if the biceps burn first, soften the hands and lead harder with the elbows."
    // "Show the chest to the handle. Drive the elbows down and back. Reach fully at the top."
    const row = rowFor(108);
    expect(row.source.instructions).toContain('Lock the thighs under the pad, take the neutral V-bar, and lean back only enough to keep the chest tall beneath the cable.');
    expect(row.source.instructions).toContain('Pull the elbows down and back until the handle reaches the upper chest, then pause without turning the rep into a row.');
    expect(row.source.cues).toContain('Show the chest to the handle. Drive the elbows down and back. Reach fully at the top.');

    const e = entryFor(108);
    const slug = slugOf(e);
    const start = rig.chainGeometry(slug, 0, BODY);
    const end = rig.chainGeometry(slug, 1, BODY);
    const eq = start.movement.equipment;

    // Seated with thighs locked under the roller pad and bench slab under the thighs
    expect(start.movement.implement).toBe('vBar');
    const pad = eq.find((s) => s.kind === 'roller');
    const slab = eq.find((s) => s.kind === 'slab');
    expect(pad).toBeDefined();
    expect(slab).toBeDefined();
    expect(pad.at[1] - (start.world.hip[1] + THIGH_HALF)).toBeGreaterThanOrEqual(2.5);
    expect(pad.at[1] - (start.world.hip[1] + THIGH_HALF)).toBeLessThanOrEqual(3.5);
    expect(pad.at[0]).toBeGreaterThan(start.world.hip[0] + 8);
    expect(pad.at[0]).toBeLessThan(start.world.near.knee[0]);
    expect(slab.a[1] + 2).toBeCloseTo(start.world.hip[1] - THIGH_HALF, 5);

    // Small lean back with chest tall (95..105 deg), not a row, held steady
    expect(direction2D(start.world.hip, start.world.neck)).toBeGreaterThanOrEqual(95);
    expect(direction2D(start.world.hip, start.world.neck)).toBeLessThanOrEqual(105);

    // Neutral close V-bar grip, full overhead reach at start, handle to upper chest at bottom with elbows down and back
    expect(start.world.near.hold[2]).toBeCloseTo(3, 5);
    expect(start.world.far.hold[2]).toBeCloseTo(-3, 5);
    expect(deg3D(start.world.near.shoulder, start.world.near.elbow, start.world.near.wrist)).toBeGreaterThanOrEqual(174);
    const touch = onTrunk(end.world, end.world.near.hold);
    expect(touch.along).toBeGreaterThanOrEqual((2 / 3) * TRUNK);
    expect(touch.along).toBeLessThanOrEqual(TRUNK);
    expect(touch.front).toBeLessThanOrEqual(8.5);
    expect(end.world.near.elbow[1]).toBeLessThan(end.world.near.shoulder[1] - 8);
    expect(onTrunk(end.world, end.world.near.elbow).front).toBeLessThanOrEqual(3);

    // Pause at chest and monotonic cable lengthening on the working half
    const ds = e.segmentDurationsMs;
    const pullMs = ds[0] + ds[1];
    const pauseMs = ds[2];
    const returnMs = ds[3];
    expect(pauseMs).toBeGreaterThanOrEqual(400);
    expect(returnMs).toBeGreaterThanOrEqual(1.3 * pullMs);

    const pulley = [...eq.find((s) => s.kind === 'pulley').at, 0];
    const poses = e.frames.map((f) => f.joints);
    const workingLengths = [];
    for (let t = 0; t <= pullMs; t += 33) {
      const p = rig.poseAtTime(poses, t, ds);
      const w = rig.chainGeometry(slug, p.ph, BODY).world;
      const mid = [(w.near.hold[0] + w.far.hold[0]) / 2, (w.near.hold[1] + w.far.hold[1]) / 2, 0];
      workingLengths.push(dist3(pulley, mid));
    }
    expectOnlyGrows(workingLengths, 20);
  });

  test('209 Full Range-Of-Motion Lat Pulldown sits between two high pulleys with arms crossed overhead, pulls down in a wide arc to the bottom, and returns slowly with monotonic cable lengthening on both cables', () => {
    // Quotes (ALL_300_MOTION_MAP.json:15440-15441):
    // "Sit on a high bench or stand between two high pulleys and take the opposite handle in each hand so the arms are crossed overhead with the palms facing forward. With the chest up, pull the handles down in an arc, turning the hands so the palms face each other at the bottom. Return slowly along the same arc until the arms are crossed overhead again."
    // "Chest up. Pull the elbows down and in. Return slowly to a full stretch."
    const row = rowFor(209);
    expect(row.source.instructions).toContain('Sit on a high bench or stand between two high pulleys and take the opposite handle in each hand so the arms are crossed overhead with the palms facing forward.');
    expect(row.source.instructions).toContain('With the chest up, pull the handles down in an arc, turning the hands so the palms face each other at the bottom.');
    expect(row.source.cues).toContain('Chest up. Pull the elbows down and in. Return slowly to a full stretch.');

    const e = entryFor(209);
    const slug = slugOf(e);
    const start = rig.chainGeometry(slug, 0, BODY);
    const mid = rig.chainGeometry(slug, 0.5, BODY);
    const bottom = rig.chainGeometry(slug, 1, BODY);

    // Seated on a high bench between two high pulleys
    const pulleys = start.movement.equipment.filter((s) => s.kind === 'pulley');
    expect(pulleys).toHaveLength(2);
    expect(pulleys[0].at[2] * pulleys[1].at[2]).toBeLessThan(0);
    expect(pulleys[0].at[1]).toBeGreaterThan(85);

    // Arms crossed overhead at start: near wrist crosses past midline to z < -1.5, far wrist crosses to z > +1.5
    expect(start.world.near.wrist[2]).toBeLessThan(-1.5);
    expect(start.world.far.wrist[2]).toBeGreaterThan(1.5);
    expect(start.world.near.wrist[1]).toBeGreaterThan(start.world.head[1] + BODY.hr);
    expect(deg3D(start.world.near.shoulder, start.world.near.elbow, start.world.near.wrist)).toBeGreaterThanOrEqual(175);

    // Sweeps out in a wide arc at mid-rep, then drives elbows down and in at the bottom
    expect(mid.world.near.wrist[2]).toBeGreaterThan(start.world.near.shoulder[2] + 10);
    expect(bottom.world.near.elbow[1]).toBeLessThan(bottom.world.near.shoulder[1] - 8);
    expect(bottom.world.near.elbow[2]).toBeLessThan(mid.world.near.wrist[2] - 5);

    // Both opposite cables monotonically lengthen on every tick of the working half
    const ds = e.segmentDurationsMs;
    const pullMs = ds[0] + ds[1];
    const returnMs = ds[3];
    expect(returnMs).toBeGreaterThanOrEqual(1.4 * pullMs);

    const poses = e.frames.map((f) => f.joints);
    const nearLengths = [];
    const farLengths = [];
    const nearPulley = start.movement.lines[0].from;
    const farPulley = start.movement.lines[1].from;
    // Opposite handle in each hand: near hand connected to far-side pulley (z < 0), far hand to near-side pulley (z > 0)
    expect(nearPulley[2]).toBeLessThan(-30);
    expect(farPulley[2]).toBeGreaterThan(30);
    for (let t = 0; t <= pullMs; t += 33) {
      const p = rig.poseAtTime(poses, t, ds);
      const w = rig.chainGeometry(slug, p.ph, BODY).world;
      nearLengths.push(dist3(nearPulley, w.near.hold));
      farLengths.push(dist3(farPulley, w.far.hold));
    }
    expectOnlyGrows(nearLengths, 30);
    expectOnlyGrows(farLengths, 30);
  });

  test('77 Straight-Arm Pulldown stands with a small braced hinge facing a high cable, starts with arms at shoulder height, keeps a fixed soft elbow angle throughout, and arcs down to the thighs', () => {
    // Quotes (ALL_300_MOTION_MAP.json:6545-6546):
    // "Stand facing a high cable with a straight bar or rope, arms extended in front of you at shoulder height. Keeping a slight elbow bend, pull the attachment down in an arc until your hands reach your thighs. Return under control to shoulder height."
    // "Keep the arms long with one soft elbow angle. Lead the arc with the elbows and let the hands stay quiet. Hold a small, braced hinge."
    const row = rowFor(77);
    expect(row.source.instructions).toContain('Stand facing a high cable with a straight bar or rope, arms extended in front of you at shoulder height.');
    expect(row.source.instructions).toContain('Keeping a slight elbow bend, pull the attachment down in an arc until your hands reach your thighs.');
    expect(row.source.cues).toContain('Keep the arms long with one soft elbow angle. Lead the arc with the elbows and let the hands stay quiet. Hold a small, braced hinge.');

    const e = entryFor(77);
    const slug = slugOf(e);
    const start = rig.chainGeometry(slug, 0, BODY);
    const end = rig.chainGeometry(slug, 1, BODY);

    // Small braced hinge held stationary throughout
    const trunkDeg = direction2D(start.world.hip, start.world.neck);
    expect(trunkDeg).toBeGreaterThanOrEqual(74);
    expect(trunkDeg).toBeLessThanOrEqual(84);

    // Starts with arms extended in front at shoulder height, arcs down until hands reach the thighs
    expect(Math.abs(start.world.near.wrist[1] - start.world.near.shoulder[1])).toBeLessThanOrEqual(2);
    expect(start.world.near.wrist[0]).toBeGreaterThan(start.world.near.shoulder[0] + 20);
    expect(end.world.near.wrist[1]).toBeLessThanOrEqual(end.world.hip[1]);
    expect(Math.hypot(end.world.near.wrist[0] - end.world.hip[0], end.world.near.wrist[1] - end.world.hip[1])).toBeLessThanOrEqual(9);
    // Not a pushdown: elbow itself travels through a large shoulder arc
    expect(dist3(start.world.near.elbow, end.world.near.elbow)).toBeGreaterThan(15);

    // One fixed soft elbow angle (165..172 deg) across every 33 ms tick, and monotonic cable lengthening
    const startElbowDeg = deg3D(start.world.near.shoulder, start.world.near.elbow, start.world.near.wrist);
    expect(startElbowDeg).toBeGreaterThanOrEqual(165);
    expect(startElbowDeg).toBeLessThanOrEqual(172);

    const ds = e.segmentDurationsMs;
    const pullMs = ds[0] + ds[1];
    const total = ds.reduce((a, b) => a + b, 0);
    const poses = e.frames.map((f) => f.joints);
    const pulley = [...start.movement.equipment.find((s) => s.kind === 'pulley').at, 0];
    const workingLengths = [];

    for (let t = 0; t <= total; t += 33) {
      const p = rig.poseAtTime(poses, t, ds);
      const w = rig.chainGeometry(slug, p.ph, BODY).world;
      const elbowDeg = deg3D(w.near.shoulder, w.near.elbow, w.near.wrist);
      expect(Math.abs(elbowDeg - startElbowDeg)).toBeLessThan(0.05);
      expect(dist3(w.hip, start.world.hip)).toBeLessThan(0.01);
      if (t <= pullMs) {
        const mid = [(w.near.hold[0] + w.far.hold[0]) / 2, (w.near.hold[1] + w.far.hold[1]) / 2, 0];
        workingLengths.push(dist3(pulley, mid));
      }
    }
    expectOnlyGrows(workingLengths, 25);
  });

  test('211 Gorilla Chin/Crunch hangs with an underhand grip and level shins, pulls up while drawing the knees up together, and finishes with knees at chest height and nose level with the bar', () => {
    // Quotes (ALL_300_MOTION_MAP.json:15576-15577):
    // "Hang from a bar with an underhand grip slightly wider than the shoulders and bend the knees so the shins are level with the floor. Pull yourself up while drawing the knees up, finishing with the knees at chest height and the nose level with the bar. Lower slowly to a full hang with the knees bent as at the start."
    // "Pull and crunch together. Knees to the chest. Lower slowly to a full hang."
    const row = rowFor(211);
    expect(row.source.instructions).toContain('Hang from a bar with an underhand grip slightly wider than the shoulders and bend the knees so the shins are level with the floor.');
    expect(row.source.instructions).toContain('Pull yourself up while drawing the knees up, finishing with the knees at chest height and the nose level with the bar.');
    expect(row.source.cues).toContain('Pull and crunch together. Knees to the chest. Lower slowly to a full hang.');

    const e = entryFor(211);
    const slug = slugOf(e);
    const start = rig.chainGeometry(slug, 0, BODY);
    const mid = rig.chainGeometry(slug, 1, BODY);
    const top = rig.chainGeometry(slug, 2, BODY);

    // Underhand grip slightly wider than shoulders, starting from a full hang with knees bent and shins level with the floor
    expect(start.world.near.wrist[0]).toBeGreaterThan(BAR_X + 3.0);
    expect(start.world.near.grip[2]).toBeGreaterThan(start.world.near.shoulder[2] + 1.5);
    expect(deg3D(start.world.near.shoulder, start.world.near.elbow, start.world.near.wrist)).toBeGreaterThanOrEqual(174);
    expect(Math.abs(start.world.near.ankle[1] - start.world.near.knee[1])).toBeLessThan(0.5);

    // Pull and crunch together: both hip height (pull) and knee height relative to hip (crunch) increase across both working segments
    expect(mid.world.hip[1]).toBeGreaterThan(start.world.hip[1] + 7);
    expect(top.world.hip[1]).toBeGreaterThan(mid.world.hip[1] + 7);
    expect(mid.world.near.knee[1] - mid.world.hip[1]).toBeGreaterThan(start.world.near.knee[1] - start.world.hip[1] + 10);
    expect(top.world.near.knee[1] - top.world.hip[1]).toBeGreaterThan(mid.world.near.knee[1] - mid.world.hip[1] + 10);

    // Finishes with knees at chest height and nose (head centre) level with the bar
    expect(top.world.near.knee[1]).toBeGreaterThan(top.world.hip[1] + 10);
    expect(top.world.near.knee[1]).toBeLessThan(top.world.neck[1]);
    expect(Math.abs(top.world.head[1] - BAR_Y)).toBeLessThanOrEqual(1.5);

    const ds = e.segmentDurationsMs;
    const pullMs = ds[0] + ds[1];
    const lowerMs = ds[3];
    expect(lowerMs).toBeGreaterThanOrEqual(1.3 * pullMs);
  });

  test('64 Hanging Leg Raise hangs with an overhand grip and straight arms and legs, curls the pelvis up to raise the legs above parallel, and lowers slowly to a dead-still hang', () => {
    // Quotes (ALL_300_MOTION_MAP.json:5666-5667):
    // "Hang from a pull-up bar with an overhand grip, arms and legs straight. Raise your legs until they are at least parallel to the floor, higher if you can keep control. Lower slowly back to a dead hang. Bend your knees to make it easier."
    // "Curl the pelvis up towards the ribs. Dead-still hang between reps. Slow on the way down."
    const row = rowFor(64);
    expect(row.source.instructions).toContain('Hang from a pull-up bar with an overhand grip, arms and legs straight.');
    expect(row.source.instructions).toContain('Raise your legs until they are at least parallel to the floor, higher if you can keep control.');
    expect(row.source.cues).toContain('Curl the pelvis up towards the ribs. Dead-still hang between reps. Slow on the way down.');

    const e = entryFor(64);
    const slug = slugOf(e);
    const start = rig.chainGeometry(slug, 0, BODY);
    const top = rig.chainGeometry(slug, rig.CHAIN_MOVEMENTS[slug].poses.length - 1, BODY);

    // Overhand grip, arms and legs kept straight across every 33 ms tick
    expect(start.world.near.wrist[0]).toBeLessThan(BAR_X - 3.0);
    const ds = e.segmentDurationsMs;
    const total = ds.reduce((a, b) => a + b, 0);
    const poses = e.frames.map((f) => f.joints);
    for (let t = 0; t <= total; t += 33) {
      const p = rig.poseAtTime(poses, t, ds);
      const w = rig.chainGeometry(slug, p.ph, BODY).world;
      expect(deg3D(w.near.shoulder, w.near.elbow, w.near.wrist)).toBeGreaterThanOrEqual(171);
      expect(deg3D(w.near.hipJoint, w.near.knee, w.near.ankle)).toBeGreaterThanOrEqual(178);
    }

    // Pelvis curls up toward the ribs and legs rise above parallel to the floor
    expect(top.movement.spine).toBe('lower');
    expect(top.angles.curl).toBeGreaterThanOrEqual(24);
    expect(top.world.near.ankle[1]).toBeGreaterThan(top.world.hip[1] + 10);

    // Slow lower and dead-still hang between reps
    const raiseMs = ds[0] + ds[1];
    const lowerMs = ds[3] + ds[4];
    const deadStillHangMs = ds[5];
    expect(lowerMs).toBeGreaterThanOrEqual(1.3 * raiseMs);
    expect(deadStillHangMs).toBeGreaterThanOrEqual(400);
  });
});
