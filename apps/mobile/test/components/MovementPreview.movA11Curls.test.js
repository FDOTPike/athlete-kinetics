/**
 * MOV-A11: curls (184, 281, 109, 190, 213, 240, 259).
 *
 * Source-bound biomechanical and rendering invariants across every 33 ms tick:
 * - 184 Drag Curl: bar against the thighs, shoulder-width underhand grip; bar
 *   dragged straight up the torso touching it at every tick while elbows travel
 *   back behind the ribs; lowered along the same contact path.
 * - 281 Standing Dumbbell Reverse Curl: palms facing down throughout; upper arms
 *   still; curl to shoulder height; pause; slow lower to straight arms (>= 172 deg).
 * - 109 Zottman Curl: neutral grip at the bottom; curl up with palms turning up;
 *   at the top rotate to palms down with the elbows closed; lower slowly through
 *   the overhand grip; turn back to neutral only at the bottom.
 * - 190 Dumbbell Prone Incline Curl: face down on an incline bench, chest on the
 *   pad, shoulders near the top, arms hanging straight down, palms forward;
 *   upper arms still; curl until elbows are fully bent; slow lower to straight.
 * - 213 High Cable Curls: standing between two high pulleys, handle in each hand,
 *   upper arms out to the sides level with the floor, palms facing you; curl
 *   hands in toward the ears; upper arms still; both cables shown.
 * - 240 Lying Cable Curl: lying on the back facing a low pulley, feet braced
 *   against the machine base, legs straight (>= 172 deg); bar in a shoulder-width
 *   underhand grip; upper arms still, elbows close to the body; curl toward the
 *   chest; slow lower to straight arms (>= 172 deg).
 * - 259 Reverse Barbell Preacher Curls: EZ bar, shoulder-width palms-down grip;
 *   upper arms resting on the preacher pad in painted contact, arms extended
 *   (>= 172 deg); curl to shoulder height; slow lower.
 */
import * as rig from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = rig.CANONICAL_BODY_PARAMETERS;
const BACK_HALF = BODY.sw * 0.58;
const UPPER_ARM_HALF = (BODY.lw * 0.88) / 2;
const SHOULDER_HALF = BODY.sw * 0.92;

const entryById = (id) => {
  const e = previewManifest.entries.find((x) => x.movementId === id);
  if (!e) throw new Error(`Missing manifest entry for movementId ${id}`);
  return e;
};

const slugOf = (e) => e.assetKey.split('/')[1];

const dist2D = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const dist3D = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] ?? 0) - (b[2] ?? 0));

const deg3D = (a, b, c) => {
  const ux = a[0] - b[0];
  const uy = a[1] - b[1];
  const uz = (a[2] ?? 0) - (b[2] ?? 0);
  const vx = c[0] - b[0];
  const vy = c[1] - b[1];
  const vz = (c[2] ?? 0) - (b[2] ?? 0);
  const du = Math.hypot(ux, uy, uz);
  const dv = Math.hypot(vx, vy, vz);
  if (du === 0 || dv === 0) return 180;
  const cos = Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / (du * dv)));
  return (Math.acos(cos) * 180) / Math.PI;
};

const dir2D = (from, to) => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

const ticksOf = (entry) => {
  const total = entry.segmentDurationsMs.reduce((a, b) => a + b, 0);
  const out = [];
  for (let t = 0; t <= total; t += 33) out.push(t);
  if (out[out.length - 1] !== total) out.push(total);
  return out;
};

const figureAt = (entry, t) => {
  const pose = rig.poseAtTime(entry.frames.map((f) => f.joints), t, entry.segmentDurationsMs);
  const g = rig.chainGeometry(slugOf(entry), pose.ph ?? 0, BODY, pose.tw ?? 0);
  const prims = rig.layoutCanonicalFigure(pose, { ...entry, body: BODY });
  return { pose, g, prims };
};

const MOV_A11_IDS = [184, 281, 109, 190, 213, 240, 259];

// MOV-S1-R3: painted widths for contact, and the grip shown in a close-up of
// the near hand (the palm's side is where the fingers close round the bar).
const THIGH_HALF = (BODY.lw * 1.18) / 2;
const BAR_HALF = 0.8;
const TRUNK_SLICE_HALF = ((24 / 32) * 1.6) / 2;
// The trunk's painted front tapers from the chest half-depth at the shoulders to
// the hips' (BODY.hw * 0.58) at the hip.
const trunkFrontAt = (along) => BODY.hw * 0.58 + (BACK_HALF - BODY.hw * 0.58) * Math.max(0, Math.min(1, along / 24));
const expectClosedGripPanel = (g) => {
  const panel = rig.handCloseUp(g);
  expect(panel).not.toBeNull();
  expect(panel.zoom).toBe(1);
  expect(panel.open).toBe(0);
  return panel;
};

describe('MOV-A11 curls invariants across every 33 ms tick', () => {
  test.each(MOV_A11_IDS)(
    'movement %i is a pending draft that closes its loop and lowers slower than it curls',
    (id) => {
      const entry = entryById(id);
      expect(entry.status).toBe('pending');
      expect(entry.frames.length).toBeGreaterThanOrEqual(5);
      expect(entry.frames[0].joints).toEqual(entry.frames.at(-1).joints);
      const ds = entry.segmentDurationsMs;
      const up = ds[0];
      const down = ds[2];
      expect(down).toBeGreaterThanOrEqual(1.5 * up);
    },
  );

  test('184 Drag Curl: bar against thighs in shoulder-width underhand grip, dragged straight up torso touching it at every tick while elbows travel behind ribs, lowered along same contact path', () => {
    const entry = entryById(184);
    const ticks = ticksOf(entry);
    const ds = entry.segmentDurationsMs;
    const f0 = figureAt(entry, 0);
    const fTop = figureAt(entry, ds[0]);

    // Standing tall, shoulder-width underhand grip on a rigid barbell.
    expect(f0.g.movement.implement).toBe('bar');
    expect(f0.g.movement.palm).toBe('up');
    expect(f0.g.forearmRotation).toBe(90);
    expect(deg3D(f0.g.world.near.hipJoint, f0.g.world.near.knee, f0.g.world.near.ankle)).toBeGreaterThanOrEqual(175);
    expect(deg3D(f0.g.world.near.shoulder, f0.g.world.near.elbow, f0.g.world.near.wrist)).toBeGreaterThanOrEqual(172);
    expect(deg3D(f0.g.world.far.shoulder, f0.g.world.far.elbow, f0.g.world.far.wrist)).toBeGreaterThanOrEqual(172);

    const startSpan = dist3D(f0.g.world.near.wrist, f0.g.world.far.wrist);
    expect(startSpan).toBeCloseTo(2 * SHOULDER_HALF, 4);

    // MOV-S1-R3: the bar starts against the front of the thighs ("holding a barbell against the front of the
    // thighs"): below the trunk's painted bottom edge, its painted edge on the thighs' painted front.
    expect(f0.g.world.near.wrist[1]).toBeLessThanOrEqual(f0.g.world.hip[1] - TRUNK_SLICE_HALF - BAR_HALF);
    expect(Math.abs(f0.g.world.near.wrist[0] - (f0.g.world.near.hipJoint[0] + THIGH_HALF + BAR_HALF))).toBeLessThanOrEqual(0.05);

    // At every 33 ms tick the bar touches the body ("Keep the bar touching the torso"): the thighs' front below
    // the trunk, the trunk's painted front above its bottom edge, never inside either and never more than 0.3 off.
    for (const t of ticks) {
      const { g } = figureAt(entry, t);
      expect(dist3D(g.world.near.wrist, g.world.far.wrist)).toBeCloseTo(startSpan, 5);
      for (const side of ['near', 'far']) {
        const bar = g.world[side].wrist;
        const along = bar[1] - g.world.hip[1];
        const surface = along >= TRUNK_SLICE_HALF + BAR_HALF
          ? g.world.hip[0] + trunkFrontAt(along)
          : along <= -(TRUNK_SLICE_HALF + BAR_HALF)
            ? g.world[side].hipJoint[0] + THIGH_HALF
            : null;
        if (surface === null) {
          // Crossing the hip crease: in front of both the thigh and the trunk's bottom edge.
          expect(bar[0] - g.world.hip[0]).toBeGreaterThanOrEqual(THIGH_HALF + BAR_HALF - 0.05);
          continue;
        }
        expect(bar[0] - (surface + BAR_HALF)).toBeGreaterThanOrEqual(-0.05);
        expect(bar[0] - (surface + BAR_HALF)).toBeLessThanOrEqual(0.3);
      }
    }

    // Bar rises straight up the torso while elbows travel BACK behind the ribs.
    expect(fTop.g.world.near.wrist[1] - f0.g.world.near.wrist[1]).toBeGreaterThanOrEqual(13);
    const ribsBackX = f0.g.world.hip[0] - BACK_HALF;
    expect(fTop.g.world.near.elbow[0]).toBeLessThan(ribsBackX - 0.1);
    expect(fTop.g.world.far.elbow[0]).toBeLessThan(ribsBackX - 0.1);

    // Underhand palm wrap is drawn at the hands.
    expect(f0.prims.some((p) => p.kind === 'bone' && p.w === 2.2 && p.color === 'textHi')).toBe(true);

    // MOV-S1-R3: the underhand grip is shown in a close-up: with the arm hanging, the palm faces forward.
    const panel = expectClosedGripPanel(f0.g);
    expect(panel.palmSide[0]).toBeGreaterThan(0.9);
  });

  test('281 Standing Dumbbell Reverse Curl: palms facing down throughout, upper arms still, curl to shoulder height, pause, slow lower to straight arms (>= 172 deg)', () => {
    const entry = entryById(281);
    const ticks = ticksOf(entry);
    const [up, pause, down] = entry.segmentDurationsMs;
    const f0 = figureAt(entry, 0);
    const fTop = figureAt(entry, up);
    const fEnd = figureAt(entry, up + pause + down);

    expect(f0.g.movement.implement).toBe('bells');
    expect(f0.g.movement.palm).toBe('down');
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(down).toBeGreaterThanOrEqual(1.5 * up);

    // Straight arms at start and end (>= 172 deg).
    for (const f of [f0, fEnd]) {
      expect(deg3D(f.g.world.near.shoulder, f.g.world.near.elbow, f.g.world.near.wrist)).toBeGreaterThanOrEqual(172);
      expect(deg3D(f.g.world.far.shoulder, f.g.world.far.elbow, f.g.world.far.wrist)).toBeGreaterThanOrEqual(172);
    }

    // Curl to shoulder height at top.
    expect(Math.abs(fTop.g.world.near.wrist[1] - fTop.g.world.near.shoulder[1])).toBeLessThanOrEqual(4);
    expect(Math.abs(fTop.g.world.far.wrist[1] - fTop.g.world.far.shoulder[1])).toBeLessThanOrEqual(4);

    // Palms facing DOWN throughout and upper arms 100% still across every tick.
    for (const t of ticks) {
      const { g, prims } = figureAt(entry, t);
      expect(g.forearmRotation).toBe(-90);
      expect(g.peakTilt).toBe(0);
      expect(g.world.near.hold[1]).toBeLessThan(g.world.near.wrist[1] - 1.0);
      expect(g.world.far.hold[1]).toBeLessThan(g.world.far.wrist[1] - 1.0);
      expect(g.world.near.elbow).toEqual(f0.g.world.near.elbow);
      expect(g.world.far.elbow).toEqual(f0.g.world.far.elbow);
      // Overhand knuckle bar is drawn above the dumbbell handle.
      expect(prims.filter((p) => p.kind === 'bone' && p.w === 2.0 && p.color === 'ink1').length).toBeGreaterThanOrEqual(2);
    }
  });

  test('109 Zottman Curl: neutral at bottom, curl up with palms turning up, rotate at top to palms down with elbows closed, slow overhand lower, turn back to neutral only at bottom', () => {
    const entry = entryById(109);
    const [up, topRotate, down, bottomRotate] = entry.segmentDurationsMs;
    const t0 = 0;
    const t1 = up;
    const t2 = up + topRotate;
    const t3 = up + topRotate + down;
    const t4 = up + topRotate + down + bottomRotate;

    expect(down).toBeGreaterThanOrEqual(1.6 * up);
    expect(topRotate).toBeGreaterThanOrEqual(500);
    expect(bottomRotate).toBeGreaterThanOrEqual(500);

    const f0 = figureAt(entry, t0);
    const f1 = figureAt(entry, t1);
    const f2 = figureAt(entry, t2);
    const f3 = figureAt(entry, t3);
    const f4 = figureAt(entry, t4);

    // Upper arms stay quiet beside the ribs across every 33 ms tick.
    for (const t of ticksOf(entry)) {
      const { g } = figureAt(entry, t);
      expect(g.world.near.elbow).toEqual(f0.g.world.near.elbow);
      expect(g.world.far.elbow).toEqual(f0.g.world.far.elbow);
    }

    // 1. Start at bottom: straight arms (>= 172 deg), neutral grip (0 deg).
    expect(deg3D(f0.g.world.near.shoulder, f0.g.world.near.elbow, f0.g.world.near.wrist)).toBeGreaterThanOrEqual(172);
    expect(f0.g.forearmRotation).toBeCloseTo(0, 5);
    expect(f0.g.world.near.hold[1]).toBeCloseTo(f0.g.world.near.wrist[1], 5);

    // 2. Ascent (t0 -> t1): palms turn UP from 0 to +90 deg as elbows flex.
    let prevRot = f0.g.forearmRotation;
    for (let t = 33; t <= t1; t += 33) {
      const { g } = figureAt(entry, t);
      expect(g.forearmRotation).toBeGreaterThanOrEqual(prevRot - 1e-6);
      prevRot = g.forearmRotation;
    }
    expect(f1.g.forearmRotation).toBeCloseTo(90, 5);
    expect(deg3D(f1.g.world.near.shoulder, f1.g.world.near.elbow, f1.g.world.near.wrist)).toBeLessThanOrEqual(35);
    expect(f1.g.world.near.hold[1]).toBeGreaterThan(f1.g.world.near.wrist[1] + 1.0);

    // 3. Top rotation (t1 -> t2): elbows stay closed while forearms rotate from +90 (palms-up) to -90 (palms-down).
    for (let t = t1; t <= t2; t += 33) {
      const { g } = figureAt(entry, t);
      expect(deg3D(g.world.near.shoulder, g.world.near.elbow, g.world.near.wrist)).toBeCloseTo(
        deg3D(f1.g.world.near.shoulder, f1.g.world.near.elbow, f1.g.world.near.wrist),
        5,
      );
    }
    expect(f2.g.forearmRotation).toBeCloseTo(-90, 5);
    expect(f2.g.world.near.hold[1]).toBeLessThan(f2.g.world.near.wrist[1] - 1.0);

    // 4. Slow overhand descent (t2 -> t3): forearm stays palms-down (-90 deg) all the way to straight arms (>= 172 deg).
    for (let t = t2; t <= t3; t += 33) {
      const { g } = figureAt(entry, t);
      expect(g.forearmRotation).toBeCloseTo(-90, 5);
      expect(g.world.near.hold[1]).toBeLessThan(g.world.near.wrist[1] - 1.0);
    }
    expect(deg3D(f3.g.world.near.shoulder, f3.g.world.near.elbow, f3.g.world.near.wrist)).toBeGreaterThanOrEqual(172);
    expect(f3.g.forearmRotation).toBeCloseTo(-90, 5);

    // 5. Bottom reset (t3 -> t4): arms stay straight at the bottom while forearm turns from -90 back to 0 (neutral).
    for (let t = t3; t <= t4; t += 33) {
      const { g } = figureAt(entry, t);
      expect(deg3D(g.world.near.shoulder, g.world.near.elbow, g.world.near.wrist)).toBeGreaterThanOrEqual(172);
    }
    expect(f4.g.forearmRotation).toBeCloseTo(0, 5);

    // Visual distinction at card size across the 4 distinct grip/pose states (f0, f1, f2, f3).
    const states = [f0, f1, f2, f3].map((f) => JSON.stringify(f.prims));
    expect(new Set(states).size).toBe(4);
  });

  test('190 Dumbbell Prone Incline Curl: face down on incline bench, chest on pad, shoulders near top, arms hanging straight down (>= 172 deg), palms forward, upper arms still, curl to full bend, slow lower', () => {
    const entry = entryById(190);
    const ticks = ticksOf(entry);
    const [up, pause, down] = entry.segmentDurationsMs;
    const f0 = figureAt(entry, 0);
    const fTop = figureAt(entry, up);
    const fEnd = figureAt(entry, up + pause + down);

    expect(f0.g.movement.implement).toBe('bells');
    expect(f0.g.movement.palm).toBe('up');
    expect(f0.g.forearmRotation).toBe(90);
    expect(down).toBeGreaterThanOrEqual(1.5 * up);

    // Face down on an incline bench: trunk inclined 30..45 deg, chest resting on pad, shoulders near top edge.
    const trunkDeg = dir2D(f0.g.world.hip, f0.g.world.neck);
    expect(trunkDeg).toBeGreaterThanOrEqual(30);
    expect(trunkDeg).toBeLessThanOrEqual(45);
    const pad = f0.g.movement.equipment.find((s) => s.kind === 'slab');
    expect(pad).toBeDefined();
    expect(dir2D(pad.a, pad.b)).toBeCloseTo(trunkDeg, 5);
    const ux = pad.b[0] - pad.a[0];
    const uy = pad.b[1] - pad.a[1];
    const len = Math.hypot(ux, uy);
    const offHip = Math.abs((f0.g.world.hip[0] - pad.a[0]) * uy - (f0.g.world.hip[1] - pad.a[1]) * ux) / len;
    expect(offHip - 2).toBeCloseTo(BACK_HALF, 5);
    // Shoulders near top of pad, and hanging arms clear of pad top edge.
    expect(f0.g.world.neck[0]).toBeGreaterThan(pad.b[0]);
    expect(f0.g.world.neck[0] - pad.b[0]).toBeLessThanOrEqual(4);

    // Arms hanging straight down at start and end (>= 172 deg), upper arms still and vertical throughout.
    for (const f of [f0, fEnd]) {
      expect(dir2D(f.g.world.near.shoulder, f.g.world.near.elbow)).toBeCloseTo(-90, 6);
      expect(dir2D(f.g.world.near.elbow, f.g.world.near.wrist)).toBeCloseTo(-90, 6);
      expect(deg3D(f.g.world.near.shoulder, f.g.world.near.elbow, f.g.world.near.wrist)).toBeGreaterThanOrEqual(172);
    }
    for (const t of ticks) {
      const { g } = figureAt(entry, t);
      expect(g.world.near.elbow).toEqual(f0.g.world.near.elbow);
      expect(g.world.far.elbow).toEqual(f0.g.world.far.elbow);
      expect(dir2D(g.world.near.shoulder, g.world.near.elbow)).toBeCloseTo(-90, 6);
    }

    // Elbows fully bent at top.
    expect(deg3D(fTop.g.world.near.shoulder, fTop.g.world.near.elbow, fTop.g.world.near.wrist)).toBeLessThanOrEqual(40);
  });

  test('213 High Cable Curls: standing between two high pulleys, handle in each hand, upper arms out to sides level with floor and still, palms facing you, curl hands in toward ears, both cables shown', () => {
    const entry = entryById(213);
    const ticks = ticksOf(entry);
    const [up, pause, down] = entry.segmentDurationsMs;
    const f0 = figureAt(entry, 0);
    const fTop = figureAt(entry, up);
    const fEnd = figureAt(entry, up + pause + down);

    expect(entry.view).toBe('front');
    expect(f0.g.movement.implement).toBe('handles');
    expect(f0.g.movement.palm).toBe('up');
    expect(f0.g.forearmRotation).toBe(90);
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(down).toBeGreaterThanOrEqual(1.5 * up);

    // Two high pulleys on either side above shoulder/head height, and both cables shown on every tick.
    const pulleys = f0.g.movement.equipment.filter((s) => s.kind === 'pulley');
    expect(pulleys).toHaveLength(2);
    expect(pulleys[0].at[1]).toBeGreaterThan(f0.g.world.head[1]);
    expect(pulleys[1].at[1]).toBeGreaterThan(f0.g.world.head[1]);
    expect(pulleys[0].at[2]).toBeGreaterThan(35);
    expect(pulleys[1].at[2]).toBeLessThan(-35);

    // Arms extended toward high pulleys at start and end (>= 172 deg).
    for (const f of [f0, fEnd]) {
      expect(deg3D(f.g.world.near.shoulder, f.g.world.near.elbow, f.g.world.near.wrist)).toBeGreaterThanOrEqual(172);
      expect(deg3D(f.g.world.far.shoulder, f.g.world.far.elbow, f.g.world.far.wrist)).toBeGreaterThanOrEqual(172);
    }

    // Upper arms out to the sides LEVEL with the floor and still across every tick, and both cables drawn.
    for (const t of ticks) {
      const { g, prims } = figureAt(entry, t);
      expect(g.world.near.elbow[1]).toBeCloseTo(g.world.near.shoulder[1], 6);
      expect(g.world.far.elbow[1]).toBeCloseTo(g.world.far.shoulder[1], 6);
      expect(g.world.near.elbow[2]).toBeGreaterThan(g.world.near.shoulder[2] + 12);
      expect(g.world.far.elbow[2]).toBeLessThan(g.world.far.shoulder[2] - 12);
      expect(g.world.near.elbow).toEqual(f0.g.world.near.elbow);
      expect(g.world.far.elbow).toEqual(f0.g.world.far.elbow);
      const cables = prims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4);
      expect(cables).toHaveLength(2);
    }

    // Hands curl in toward the ears at top.
    expect(Math.abs(fTop.g.world.near.wrist[2])).toBeLessThanOrEqual(SHOULDER_HALF + 4);
    expect(Math.abs(fTop.g.world.far.wrist[2])).toBeLessThanOrEqual(SHOULDER_HALF + 4);
    expect(Math.abs(fTop.g.world.near.wrist[1] - fTop.g.world.head[1])).toBeLessThanOrEqual(3.5);
    expect(deg3D(fTop.g.world.near.shoulder, fTop.g.world.near.elbow, fTop.g.world.near.wrist)).toBeLessThanOrEqual(45);

    // MOV-S1-R3: "palms facing you" is shown in a close-up of the near hand: palm up with the arm reaching out to
    // the pulley, and facing the head at the top of the curl.
    const panel0 = expectClosedGripPanel(f0.g);
    expect(panel0.palmSide[1]).toBeLessThan(-0.9);
    const panelTop = expectClosedGripPanel(fTop.g);
    const toHead = [fTop.g.joints.hd[0] - fTop.g.grip.near[0], fTop.g.joints.hd[1] - fTop.g.grip.near[1]];
    const toHeadLen = Math.hypot(...toHead);
    expect((panelTop.palmSide[0] * toHead[0] + panelTop.palmSide[1] * toHead[1]) / toHeadLen).toBeGreaterThan(0.5);
  });

  test('240 Lying Cable Curl: lying on back facing low pulley, feet braced against machine base, legs straight (>= 172 deg), shoulder-width underhand bar grip, upper arms still & elbows close to body, curl toward chest, slow lower', () => {
    const entry = entryById(240);
    const ticks = ticksOf(entry);
    const [up, pause, down] = entry.segmentDurationsMs;
    const f0 = figureAt(entry, 0);
    const fTop = figureAt(entry, up);
    const fEnd = figureAt(entry, up + pause + down);

    expect(f0.g.movement.implement).toBe('cableBar');
    expect(f0.g.movement.palm).toBe('up');
    expect(f0.g.forearmRotation).toBe(90);
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(down).toBeGreaterThanOrEqual(1.5 * up);

    // Lying on back on the floor, legs straight (>= 172 deg), feet braced against machine base with low pulley.
    expect(f0.g.world.hip[1]).toBeCloseTo(rig.CHAIN_LYING_HEIGHT, 5);
    expect(f0.g.world.neck[1]).toBeCloseTo(rig.CHAIN_LYING_HEIGHT, 5);
    const pulley = f0.g.movement.equipment.find((s) => s.kind === 'pulley');
    expect(pulley).toBeDefined();
    expect(pulley.at[1]).toBeLessThanOrEqual(12);
    expect(Math.abs(f0.g.world.near.toe[0] - pulley.at[0])).toBeLessThanOrEqual(3);

    // Arms extended at start and end (>= 172 deg).
    for (const f of [f0, fEnd]) {
      expect(deg3D(f.g.world.near.shoulder, f.g.world.near.elbow, f.g.world.near.wrist)).toBeGreaterThanOrEqual(172);
      expect(deg3D(f.g.world.far.shoulder, f.g.world.far.elbow, f.g.world.far.wrist)).toBeGreaterThanOrEqual(172);
    }

    const startSpan = dist3D(f0.g.world.near.wrist, f0.g.world.far.wrist);
    expect(startSpan).toBeCloseTo(2 * SHOULDER_HALF, 4);

    // Across every tick: legs straight (>= 172 deg), upper arms still, elbows close to body, rigid bar, taut cable.
    for (const t of ticks) {
      const { g, prims } = figureAt(entry, t);
      expect(deg3D(g.world.near.hipJoint, g.world.near.knee, g.world.near.ankle)).toBeGreaterThanOrEqual(172);
      expect(deg3D(g.world.far.hipJoint, g.world.far.knee, g.world.far.ankle)).toBeGreaterThanOrEqual(172);
      expect(g.world.near.elbow).toEqual(f0.g.world.near.elbow);
      expect(g.world.far.elbow).toEqual(f0.g.world.far.elbow);
      expect(Math.abs(g.world.near.elbow[2] - SHOULDER_HALF)).toBeLessThan(1e-6);
      expect(dist3D(g.world.near.wrist, g.world.far.wrist)).toBeCloseTo(startSpan, 5);
      expect(prims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4)).toHaveLength(1);
    }

    // Curled toward the chest at top.
    expect(deg3D(fTop.g.world.near.shoulder, fTop.g.world.near.elbow, fTop.g.world.near.wrist)).toBeLessThanOrEqual(50);
    expect(Math.abs(fTop.g.world.near.wrist[0] - fTop.g.world.neck[0])).toBeLessThanOrEqual(6);

    // MOV-S1-R3: the underhand grip is shown in a close-up of the near hand: lying with the arms reaching toward
    // the pulley, the palm faces up.
    const panel = expectClosedGripPanel(f0.g);
    expect(panel.palmSide[1]).toBeLessThan(-0.9);
  });

  test('259 Reverse Barbell Preacher Curls: EZ bar in shoulder-width palms-down grip, upper arms on preacher pad in painted contact, arms extended (>= 172 deg), curl to shoulder height, slow lower', () => {
    const entry = entryById(259);
    const ticks = ticksOf(entry);
    const [up, pause, down] = entry.segmentDurationsMs;
    const f0 = figureAt(entry, 0);
    const fTop = figureAt(entry, up);
    const fEnd = figureAt(entry, up + pause + down);

    expect(f0.g.movement.implement).toBe('ez');
    expect(f0.g.movement.palm).toBe('down');
    expect(f0.g.forearmRotation).toBe(-90);
    expect(pause).toBeGreaterThanOrEqual(400);
    expect(down).toBeGreaterThanOrEqual(1.5 * up);

    // Extended arms at start and end (>= 172 deg), curled to shoulder height at top.
    for (const f of [f0, fEnd]) {
      expect(deg3D(f.g.world.near.shoulder, f.g.world.near.elbow, f.g.world.near.wrist)).toBeGreaterThanOrEqual(172);
      expect(deg3D(f.g.world.far.shoulder, f.g.world.far.elbow, f.g.world.far.wrist)).toBeGreaterThanOrEqual(172);
    }
    expect(Math.abs(fTop.g.world.near.wrist[1] - fTop.g.world.near.shoulder[1])).toBeLessThanOrEqual(3);
    expect(deg3D(fTop.g.world.near.shoulder, fTop.g.world.near.elbow, fTop.g.world.near.wrist)).toBeLessThanOrEqual(75);

    const startSpan = dist3D(f0.g.world.near.wrist, f0.g.world.far.wrist);
    expect(startSpan).toBeCloseTo(2 * SHOULDER_HALF, 4);

    // Preacher pad drawn and upper arms stay on it in painted contact at every tick.
    const pad = f0.g.movement.equipment.find((s) => s.kind === 'slab' && s.layer === 'front');
    expect(pad).toBeDefined();
    const padA = f0.g.project(pad.a);
    const padB = f0.g.project(pad.b);
    const ux = padB[0] - padA[0];
    const uy = padB[1] - padA[1];
    const len = Math.hypot(ux, uy);

    for (const t of ticks) {
      const { g, prims } = figureAt(entry, t);
      expect(g.world.near.elbow).toEqual(f0.g.world.near.elbow);
      expect(g.world.far.elbow).toEqual(f0.g.world.far.elbow);
      expect(dist3D(g.world.near.wrist, g.world.far.wrist)).toBeCloseTo(startSpan, 5);
      // Painted contact between the drawn near upper arm and the drawn preacher pad slab.
      expect(dir2D(g.joints.nArm, g.joints.el)).toBeCloseTo(dir2D(padA, padB), 5);
      const off = Math.abs((g.joints.el[0] - padA[0]) * uy - (g.joints.el[1] - padA[1]) * ux) / len;
      expect(off - 2).toBeCloseTo(UPPER_ARM_HALF, 4);
      const along = ((g.joints.el[0] - padA[0]) * ux + (g.joints.el[1] - padA[1]) * uy) / len;
      expect(along).toBeGreaterThanOrEqual(3);
      expect(along).toBeLessThan(len);
      // EZ camber segments and overhand knuckle wrap are drawn.
      expect(prims.filter((p) => p.kind === 'bone' && p.w === 2.0 && p.color === 'ink1').length).toBeGreaterThanOrEqual(2);
    }
  });
});
