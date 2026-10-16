/**
 * MOV-A02: 8 other squats (IDs 140, 192, 81, 98, 120, 235, 105, 48)
 * and the chain-kit additions (barAt: 'elbows' | 'behind', implement: 'kettlebells').
 */
import {
  CANONICAL_BODY_PARAMETERS,
  CHAIN_FLOOR_PLATE,
  CHAIN_MOVEMENTS,
  chainGeometry,
  layoutCanonicalFigure,
  poseAtTime,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';
import catalogue from '../../../../docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json';

const BODY = CANONICAL_BODY_PARAMETERS;
const MOV_A02_IDS = [140, 192, 81, 98, 120, 235, 105, 48];

const entryFor = (id) => previewManifest.entries.find((e) => e.movementId === id);
const rowFor = (id) => catalogue.movements.find((m) => m.id === id);
const slugFor = (id) => entryFor(id).assetKey.split('/')[1];

const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const FLOOR = 96.9;

const elbowAngleDeg = (side) => {
  const u = [side.shoulder[0] - side.elbow[0], side.shoulder[1] - side.elbow[1], side.shoulder[2] - side.elbow[2]];
  const v = [side.wrist[0] - side.elbow[0], side.wrist[1] - side.elbow[1], side.wrist[2] - side.elbow[2]];
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const mag = Math.hypot(...u) * Math.hypot(...v);
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
};

const segPointDist2D = (x1, y1, x2, y2, px, py) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
};

const primBounds = (p) => {
  if (p.kind === 'circle') {
    const pad = p.r + (p.strokeWidth ?? 0) / 2;
    return { minX: p.cx - pad, minY: p.cy - pad, maxX: p.cx + pad, maxY: p.cy + pad };
  }
  const pad = (p.w ?? 0) / 2 + (p.strokeWidth ?? 0) / 2;
  return {
    minX: Math.min(p.x1, p.x2) - pad,
    minY: Math.min(p.y1, p.y2) - pad,
    maxX: Math.max(p.x1, p.x2) + pad,
    maxY: Math.max(p.y1, p.y2) + pad,
  };
};

const boxesOverlap = (a, b) =>
  a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;

const barMidWorld = (fig) => [
  (fig.world.near.hold[0] + fig.world.far.hold[0]) / 2,
  (fig.world.near.hold[1] + fig.world.far.hold[1]) / 2,
  (fig.world.near.hold[2] + fig.world.far.hold[2]) / 2,
];

describe('MOV-A02 chain kit additions: barAt, plateRadius, and double kettlebells', () => {
  test('barAt: "elbows" cradles the barbell in the elbow crooks while omitting barAt keeps the bar in the hands', () => {
    const zercher = chainGeometry('zercher-squat', 0.5, BODY);
    const comp = chainGeometry('competition-squat', 0.5, BODY);

    // Zercher Squat places near and far hold points at the elbowCrook, distinct from the clasped wrists.
    expect(dist3(zercher.world.near.hold, zercher.world.near.elbowCrook)).toBeLessThan(1e-6);
    expect(dist3(zercher.world.far.hold, zercher.world.far.elbowCrook)).toBeLessThan(1e-6);
    expect(dist3(zercher.world.near.hold, zercher.world.near.wrist)).toBeGreaterThan(8.0);

    // Omitting barAt on Competition Squat preserves hand-grip placement at the wrists.
    expect(dist3(comp.world.near.hold, comp.world.near.wrist)).toBeLessThan(1e-6);
    expect(dist3(comp.world.near.hold, comp.world.near.elbowCrook)).toBeGreaterThan(9.0);
  });

  test('barAt: "behind" routes the barbell shaft and far plate behind the far and near leg bones', () => {
    const hackEntry = entryFor(98);
    const compEntry = entryFor(1);
    const hackPrims = layoutCanonicalFigure(hackEntry.frames[0].joints, { ...hackEntry, body: BODY });
    const compPrims = layoutCanonicalFigure(compEntry.frames[0].joints, { ...compEntry, body: BODY });

    const farPlateIdx = (prims) =>
      prims.findIndex((p) => p.kind === 'bone' && p.color === 'textLow' && Math.abs(p.w - 2.4) < 1e-6 && p.stroke === 'ink1');
    const farThighIdx = (prims) =>
      prims.findIndex((p) => p.kind === 'bone' && p.color === 'textLow' && Math.abs(p.w - BODY.lw * 1.18) < 1e-6);

    // On Barbell Hack Squat (barAt: 'behind'), the far plate is painted in groups.behind, strictly before the far thigh.
    expect(farPlateIdx(hackPrims)).toBeGreaterThanOrEqual(0);
    expect(farThighIdx(hackPrims)).toBeGreaterThan(farPlateIdx(hackPrims));

    // On Competition Squat (barAt omitted), the far plate is painted in the far implement group, after the far thigh.
    expect(farPlateIdx(compPrims)).toBeGreaterThan(farThighIdx(compPrims));
  });

  test('plateRadius sizes floor-starting barbell plates to CHAIN_FLOOR_PLATE while omitting plateRadius keeps 4.2', () => {
    const hackEntry = entryFor(98);
    const compEntry = entryFor(1);
    const hackPrims = layoutCanonicalFigure(hackEntry.frames[0].joints, { ...hackEntry, body: BODY });
    const compPrims = layoutCanonicalFigure(compEntry.frames[0].joints, { ...compEntry, body: BODY });

    const plateHalfLen = (prims) => {
      const p = prims.find((pr) => pr.kind === 'bone' && pr.color === 'textHi' && Math.abs(pr.w - 2.4) < 1e-6 && pr.stroke === 'ink1');
      return Math.hypot(p.x2 - p.x1, p.y2 - p.y1) / 2;
    };
    expect(plateHalfLen(hackPrims)).toBeCloseTo(CHAIN_FLOOR_PLATE, 6);
    expect(plateHalfLen(compPrims)).toBeCloseTo(4.2, 6);
  });

  test('implement: "kettlebells" draws both near and far kettlebell bodies and handles', () => {
    const singleEntry = entryFor(105);
    const doubleEntry = entryFor(48);

    const singlePrims = layoutCanonicalFigure(singleEntry.frames[0].joints, { ...singleEntry, body: BODY });
    const doublePrims = layoutCanonicalFigure(doubleEntry.frames[0].joints, { ...doubleEntry, body: BODY });

    const countBellCircles = (prims) =>
      prims.filter((p) => p.kind === 'circle' && Math.abs(p.r - 4.6) < 1e-6 && p.stroke === 'ink1').length;
    expect(countBellCircles(singlePrims)).toBe(1);
    expect(countBellCircles(doublePrims)).toBe(2);
  });
});

describe('MOV-A02 universal invariants across all 8 other squats', () => {
  test.each(MOV_A02_IDS)('movement %i has pending status, oblique view, family yaw, and exact bone lengths on every 33ms tick', (id) => {
    const entry = entryFor(id);
    const slug = slugFor(id);
    const def = CHAIN_MOVEMENTS[slug];
    expect(entry).toBeDefined();
    expect(entry.status).toBe('pending');
    expect(entry.view).toBe('oblique');
    expect(def.view).toBe('oblique');

    const expectedYaw =
      [140, 192, 235].includes(id) ? 10 :
      id === 98 ? 26 :
      28;
    expect(def.yawDeg).toBe(expectedYaw);
    expect(entry.reason).toContain(`turned ${expectedYaw} degrees`);
    expect(entry.frames.length).toBeGreaterThanOrEqual(5);

    const total = entry.segmentDurationsMs.reduce((a, b) => a + b, 0);
    const [vx, vy, vw, vh] = entry.viewBox;
    const pose0 = chainGeometry(slug, 0, BODY, entry.frames[0].joints.tw ?? 0);

    for (let t = 0; t <= total; t += 33) {
      const p = poseAtTime(entry.frames.map((f) => f.joints), t, entry.segmentDurationsMs);
      const fig = chainGeometry(slug, p.ph, BODY, p.tw ?? 0);
      const w = fig.world;

      // Exact 3D bone lengths on every tick.
      expect(dist3(w.hip, w.neck)).toBeCloseTo(24, 5);
      expect(dist3(w.neck, w.head)).toBeCloseTo(9, 5);
      for (const side of [w.near, w.far]) {
        expect(dist3(side.shoulder, side.elbow)).toBeCloseTo(12.5, 5);
        expect(dist3(side.elbow, side.wrist)).toBeCloseTo(12.0, 5);
        expect(dist3(side.hipJoint, side.knee)).toBeCloseTo(22.25, 5);
        expect(dist3(side.knee, side.ankle)).toBeCloseTo(22.25, 5);
      }

      // Anchor contacts remain planted throughout the rep.
      expect(dist3(w.near.ankle, pose0.world.near.ankle)).toBeLessThan(1e-6);
      expect(dist3(w.far.ankle, pose0.world.far.ankle)).toBeLessThan(1e-6);
      if (id === 235) {
        expect(dist3(w.near.knee, pose0.world.near.knee)).toBeLessThan(1e-6);
        expect(dist3(w.far.knee, pose0.world.far.knee)).toBeLessThan(1e-6);
      }

      // Every primitive is finite and inside the entry's viewBox.
      const prims = layoutCanonicalFigure(p, { ...entry, body: BODY });
      expect(prims.length).toBeGreaterThan(20);
      for (const prim of prims) {
        if (prim.kind === 'circle') {
          expect(Number.isFinite(prim.cx) && Number.isFinite(prim.cy) && Number.isFinite(prim.r)).toBe(true);
          expect(prim.cx - prim.r).toBeGreaterThanOrEqual(vx);
          expect(prim.cy - prim.r).toBeGreaterThanOrEqual(vy);
          expect(prim.cx + prim.r).toBeLessThanOrEqual(vx + vw);
          expect(prim.cy + prim.r).toBeLessThanOrEqual(vy + vh);
        } else if (prim.kind === 'rect') {
          expect(Number.isFinite(prim.x) && Number.isFinite(prim.y) && Number.isFinite(prim.w) && Number.isFinite(prim.h)).toBe(true);
          expect(prim.x).toBeGreaterThanOrEqual(vx);
          expect(prim.y).toBeGreaterThanOrEqual(vy);
          expect(prim.x + prim.w).toBeLessThanOrEqual(vx + vw);
          expect(prim.y + prim.h).toBeLessThanOrEqual(vy + vh);
        } else {
          expect(Number.isFinite(prim.x1) && Number.isFinite(prim.y1) && Number.isFinite(prim.x2) && Number.isFinite(prim.y2)).toBe(true);
          const pad = prim.w / 2;
          expect(Math.min(prim.x1, prim.x2) - pad).toBeGreaterThanOrEqual(vx);
          expect(Math.min(prim.y1, prim.y2) - pad).toBeGreaterThanOrEqual(vy);
          expect(Math.max(prim.x1, prim.x2) + pad).toBeLessThanOrEqual(vx + vw);
          expect(Math.max(prim.y1, prim.y2) + pad).toBeLessThanOrEqual(vy + vh);
        }
      }
    }
  });
});

describe('MOV-A02 per-movement source-bound biomechanics', () => {
  test('140 Barbell Squat To A Bench: bar on upper back, bench behind, hips lightly touch bench and stand without resting', () => {
    const row = rowFor(140);
    expect(row.source.instructions).toContain('until you lightly touch the bench');
    expect(row.source.instructions).toContain('without resting on the bench');

    const entry = entryFor(140);
    const boxEntry = entryFor(38);
    const bottom = chainGeometry('barbell-squat-to-a-bench', 1, BODY);

    // Hips lightly touch the bench top (y = 22) at the bottom.
    expect(Math.abs(bottom.world.hip[1] - 22)).toBeLessThanOrEqual(1.2);
    expect(bottom.world.hip[0]).toBeLessThanOrEqual(-12);

    // Bar sits across the upper back at every phase.
    for (const ph of [0, 0.5, 1]) {
      const fig = chainGeometry('barbell-squat-to-a-bench', ph, BODY);
      const bar = barMidWorld(fig);
      expect(Math.hypot(bar[0] - fig.world.neck[0], bar[1] - fig.world.neck[1])).toBeLessThanOrEqual(3.5);
    }

    // Unlike Box Squat (38), which has two consecutive ph=1 frames to sit and pause, 140 touches once and stands immediately.
    const bottomFrames140 = entry.frames.filter((f) => f.joints.ph === 1);
    const bottomFrames38 = boxEntry.frames.filter((f) => f.joints.ph === 1);
    expect(bottomFrames140).toHaveLength(1);
    expect(bottomFrames38).toHaveLength(2);
  });

  test('192 Dumbbell Squat To A Bench: dumbbells held at the sides with arms long, hips lightly touch bench without resting', () => {
    const row = rowFor(192);
    expect(row.source.instructions).toContain('with a dumbbell in each hand at your sides');
    expect(row.source.instructions).toContain('until you lightly touch the bench');
    expect(row.source.instructions).toContain('without resting on the bench');

    const entry = entryFor(192);
    const top = chainGeometry('dumbbell-squat-to-a-bench', 0, BODY);
    const bottom = chainGeometry('dumbbell-squat-to-a-bench', 1, BODY);

    // Arms hang long at the sides (wrists well below elbows and shoulders, and at/below hip height).
    for (const fig of [top, bottom]) {
      expect(fig.world.near.wrist[1]).toBeLessThan(fig.world.near.shoulder[1] - 22);
      expect(fig.world.near.wrist[1]).toBeLessThanOrEqual(fig.world.hip[1] + 0.5);
    }

    // Hips lightly touch the bench top (y = 22) and reverse immediately (single ph=1 turnaround frame).
    expect(Math.abs(bottom.world.hip[1] - 22)).toBeLessThanOrEqual(1.2);
    expect(entry.frames.filter((f) => f.joints.ph === 1)).toHaveLength(1);
  });

  test('81 Zercher Squat: bar cradled in elbow crooks, hands clasped at chest, elbows ride inside knees at bottom', () => {
    const row = rowFor(81);
    expect(row.source.instructions).toContain('Cradle the bar in the crooks of the elbows, clasp the hands');
    expect(row.source.cues).toContain('Elbows ride inside the knees at the bottom');

    const top = chainGeometry('zercher-squat', 0, BODY);
    const bottom = chainGeometry('zercher-squat', 1, BODY);

    for (const fig of [top, bottom]) {
      // Bar sits in the elbow crooks, never rolling down toward the wrists.
      const bar = barMidWorld(fig);
      const crookMid = [
        (fig.world.near.elbowCrook[0] + fig.world.far.elbowCrook[0]) / 2,
        (fig.world.near.elbowCrook[1] + fig.world.far.elbowCrook[1]) / 2,
        (fig.world.near.elbowCrook[2] + fig.world.far.elbowCrook[2]) / 2,
      ];
      expect(dist3(bar, crookMid)).toBeLessThan(1e-5);
      // Forearms angled up and inward so clasped hands sit above the elbows in front of the chest.
      expect(fig.world.near.wrist[1]).toBeGreaterThan(fig.world.near.elbow[1] + 8);
      expect(dist3(fig.world.near.wrist, fig.world.far.wrist)).toBeLessThan(dist3(fig.world.near.elbow, fig.world.far.elbow) - 6.5);
      expect(dist2(fig.grip.near, fig.grip.far)).toBeLessThan(5.0);
    }

    // Elbows ride inside the knees at the bottom (smaller lateral |Z| than the abducted knees).
    expect(Math.abs(bottom.world.near.elbow[2])).toBeLessThan(Math.abs(bottom.world.near.knee[2]) - 3.5);
  });

  test('98 Barbell Hack Squat: starts from the floor with bar behind the calves and skims up behind the legs to standing', () => {
    const row = rowFor(98);
    expect(row.source.instructions).toContain('Set a bar on the floor behind your calves');
    expect(row.source.instructions).toContain('letting the bar skim up behind the legs');
    expect(row.source.cues).toContain('Keep the bar close behind the legs');

    const entry = entryFor(98);
    const floor = chainGeometry('barbell-hack-squat', 0, BODY);
    const mid = chainGeometry('barbell-hack-squat', 0.5, BODY);
    const top = chainGeometry('barbell-hack-squat', 1, BODY);

    // Starts in a deep squat with the barbell behind the calves at ph=0, and stands tall at ph=1.
    expect(floor.world.hip[1]).toBeLessThan(25);
    expect(barMidWorld(floor)[1]).toBeLessThan(23.5);
    expect(top.world.hip[1]).toBeGreaterThan(42);
    expect(barMidWorld(top)[1]).toBeGreaterThan(43);

    // At the bottom keyframe (ph=0), the barbell plates rest on the floor line (FLOOR = 96.9)
    // and the hands hold the bar with straight elbows (180 degrees, full 24.5 reach).
    const floorPrims = layoutCanonicalFigure(entry.frames[0].joints, { ...entry, body: BODY });
    const floorPlates = floorPrims.filter((p) => p.kind === 'bone' && Math.abs(p.w - 2.4) < 1e-6 && p.stroke === 'ink1');
    expect(floorPlates).toHaveLength(2);
    for (const plate of floorPlates) {
      const plateBottom = Math.max(plate.y1, plate.y2) + plate.w / 2;
      expect(plateBottom).toBeCloseTo(FLOOR, 5);
    }
    expect(dist3(floor.world.near.wrist, floor.world.near.hold)).toBeLessThan(1e-6);
    expect(dist3(floor.world.far.wrist, floor.world.far.hold)).toBeLessThan(1e-6);
    expect(elbowAngleDeg(floor.world.near)).toBeCloseTo(180, 5);
    expect(elbowAngleDeg(floor.world.far)).toBeCloseTo(180, 5);
    expect(dist3(floor.world.near.shoulder, floor.world.near.wrist)).toBeCloseTo(24.5, 5);

    // Across the entire pull, the bar stays strictly behind the calves and knees, with arms long.
    for (const fig of [floor, mid, top]) {
      const bar = barMidWorld(fig);
      expect(bar[0]).toBeLessThan(fig.world.near.ankle[0] - 1.0);
      expect(bar[0]).toBeLessThan(fig.world.near.knee[0] - 2.0);
      expect(fig.world.near.wrist[1]).toBeLessThan(fig.world.near.shoulder[1] - 21);
      expect(elbowAngleDeg(fig.world.near)).toBeCloseTo(180, 5);
    }
  });

  test('120 Jefferson Squats: straddling the bar with one hand in front and one behind, bar travels straight up between the legs', () => {
    const row = rowFor(120);
    expect(row.source.instructions).toContain('Straddle the bar with the feet angled comfortably');
    expect(row.source.instructions).toContain('take one hand in front of the body and one behind at equal distances');
    expect(row.source.instructions).toContain('with the bar travelling between the legs');

    const entry = entryFor(120);
    const bottom = chainGeometry('jefferson-squats', 0, BODY);
    const top = chainGeometry('jefferson-squats', 1, BODY);

    // At the bottom keyframe (ph=0), the barbell plates rest on the floor line (FLOOR = 96.9)
    // and both hands hold the bar with straight elbows (180 degrees, full 24.5 reach).
    const bottomPrims = layoutCanonicalFigure(entry.frames[0].joints, { ...entry, body: BODY });
    const bottomPlates = bottomPrims.filter((p) => p.kind === 'bone' && Math.abs(p.w - 2.4) < 1e-6 && p.stroke === 'ink1');
    expect(bottomPlates).toHaveLength(2);
    for (const plate of bottomPlates) {
      const plateBottom = Math.max(plate.y1, plate.y2) + plate.w / 2;
      expect(plateBottom).toBeCloseTo(FLOOR, 5);
    }
    expect(dist3(bottom.world.near.wrist, bottom.world.near.hold)).toBeLessThan(1e-6);
    expect(dist3(bottom.world.far.wrist, bottom.world.far.hold)).toBeLessThan(1e-6);
    expect(elbowAngleDeg(bottom.world.near)).toBeCloseTo(180, 5);
    expect(elbowAngleDeg(bottom.world.far)).toBeCloseTo(180, 5);
    expect(dist3(bottom.world.near.shoulder, bottom.world.near.wrist)).toBeCloseTo(24.5, 5);
    expect(dist3(bottom.world.far.shoulder, bottom.world.far.wrist)).toBeCloseTo(24.5, 5);

    // Straddle stance: near foot steps behind the bar (X < 0) and far foot steps in front of the bar (X > 0), wide across Z.
    expect(top.world.near.ankle[0]).toBeLessThan(-4);
    expect(top.world.far.ankle[0]).toBeGreaterThan(4);
    expect(top.world.near.ankle[2] - top.world.far.ankle[2]).toBeGreaterThan(30);

    // Mixed straddle grip: near hand reaches in front of the bar (+X), far hand reaches behind the bar (-X),
    // and in 2D screen space both hands sit well outside the trunk on opposite sides so neither hand is hidden.
    for (const fig of [top, bottom]) {
      const bar = barMidWorld(fig);
      expect(fig.world.near.wrist[0]).toBeGreaterThan(bar[0] + 4);
      expect(fig.world.far.wrist[0]).toBeLessThan(bar[0] - 4);
      expect(fig.joints.wr[0]).toBeGreaterThan(fig.joints.hp[0] + 8);
      expect(fig.joints.wf[0]).toBeLessThan(fig.joints.hp[0] - 8);
      // Bar stays between the legs (below the pelvis crease).
      expect(bar[1]).toBeLessThan(fig.world.hip[1] - 1.5);
    }

    // Bar travels straight up and down along a vertical line between the legs.
    expect(Math.abs(barMidWorld(top)[0] - barMidWorld(bottom)[0])).toBeLessThan(0.5);
    expect(barMidWorld(top)[1] - barMidWorld(bottom)[1]).toBeGreaterThan(18);
  });

  test('235 Kneeling Squat: knees and shins stay on the floor while hips sit back toward the heels and drive to tall kneeling', () => {
    const row = rowFor(235);
    expect(row.source.instructions).toContain('Kneel tall in a rack with the bar on the back');
    expect(row.source.instructions).toContain('Sit the hips back toward the heels');
    expect(row.source.instructions).toContain('Drive the hips forward to return to tall kneeling');

    const tall = chainGeometry('kneeling-squat', 0, BODY);
    const back = chainGeometry('kneeling-squat', 1, BODY);

    // Both knees and ankles remain on the floor (y = CHAIN_KNEELING_KNEE ≈ 2.842) separated by the exact 22.25 shin length.
    for (const fig of [tall, back]) {
      expect(fig.world.near.knee[1]).toBeCloseTo(2.842, 3);
      expect(fig.world.near.ankle[1]).toBeCloseTo(2.842, 3);
      expect(fig.world.near.knee[0] - fig.world.near.ankle[0]).toBeCloseTo(22.25, 5);
    }

    // Tall kneeling stacks hips over the knees; sitting back shifts hips > 15 units toward the heels.
    expect(Math.abs(tall.world.hip[0] - tall.world.near.knee[0])).toBeLessThanOrEqual(2.0);
    expect(tall.world.hip[1]).toBeGreaterThan(24);
    expect(back.world.hip[0]).toBeLessThan(tall.world.hip[0] - 15);
    expect(dist2([back.world.hip[0], back.world.hip[1]], [back.world.near.ankle[0], back.world.near.ankle[1]])).toBeLessThan(15);
  });

  test('105 One-Arm Overhead Kettlebell Squat: one kettlebell locked overhead stacked over shoulder, free arm forward, pause at bottom, head clear of arm', () => {
    const row = rowFor(105);
    expect(row.source.instructions).toContain('Clean and press one kettlebell overhead, lock the elbow');
    expect(row.source.instructions).toContain('Pause at the deepest owned position');
    expect(row.source.instructions).toContain('use the free arm forward as a counterbalance');

    const entry = entryFor(105);
    const total = entry.segmentDurationsMs.reduce((a, b) => a + b, 0);

    for (let t = 0; t <= total; t += 33) {
      const p = poseAtTime(entry.frames.map((f) => f.joints), t, entry.segmentDurationsMs);
      const fig = chainGeometry('one-arm-overhead-kettlebell-squat', p.ph, BODY);
      const w = fig.world;

      // Near arm stays locked out overhead, stacked over the near shoulder.
      expect(w.near.wrist[1] - w.near.shoulder[1]).toBeGreaterThan(23.5);
      expect(Math.hypot(w.near.wrist[0] - w.near.shoulder[0], w.near.wrist[2] - w.near.shoulder[2])).toBeLessThan(5.0);

      // Far arm reaches forward as a counterbalance.
      expect(w.far.wrist[0] - w.far.shoulder[0]).toBeGreaterThan(18);

      // Neither the near upper arm nor the near forearm overlaps the head ring or its painted bounds.
      const prims = layoutCanonicalFigure(p, { ...entry, body: BODY });
      const j = fig.joints;
      const head = prims.find((pr) => pr.kind === 'circle' && Math.abs(pr.cx - j.hd[0]) < 1e-4 && Math.abs(pr.cy - j.hd[1]) < 1e-4);
      const upperArmBone = prims.find((pr) => pr.kind === 'bone' && Math.abs(pr.x1 - j.nArm[0]) < 1e-4 && Math.abs(pr.y1 - j.nArm[1]) < 1e-4 && Math.abs(pr.x2 - j.el[0]) < 1e-4 && Math.abs(pr.y2 - j.el[1]) < 1e-4);
      const forearmBone = prims.find((pr) => pr.kind === 'bone' && Math.abs(pr.x1 - j.el[0]) < 1e-4 && Math.abs(pr.y1 - j.el[1]) < 1e-4 && Math.abs(pr.x2 - j.wr[0]) < 1e-4 && Math.abs(pr.y2 - j.wr[1]) < 1e-4);
      expect(head).toBeDefined();
      expect(upperArmBone).toBeDefined();
      expect(forearmBone).toBeDefined();

      const headOuterR = head.r + (head.strokeWidth ?? 0) / 2;
      for (const bone of [upperArmBone, forearmBone]) {
        const centerDist = segPointDist2D(bone.x1, bone.y1, bone.x2, bone.y2, head.cx, head.cy);
        const clearance = centerDist - bone.w / 2 - headOuterR;
        expect(clearance).toBeGreaterThan(0);
        expect(boxesOverlap(primBounds(bone), primBounds(head))).toBe(false);
      }
    }

    // Pause in the deepest position (two consecutive ph=1 frames).
    expect(entry.frames.filter((f) => f.joints.ph === 1)).toHaveLength(2);
  });

  test('48 Double Kettlebell Front Squat: two kettlebells racked on forearms at chest, elbows in, knees pushed out', () => {
    const row = rowFor(48);
    expect(row.source.instructions).toContain('Clean two kettlebells into the rack position, resting on your forearms at your chest');
    expect(row.source.cues).toContain('Elbows in, bells resting on the forearms');
    expect(row.source.cues).toContain('Full foot planted, knees out');

    const top = chainGeometry('double-kettlebell-front-squat', 0, BODY);
    const bottom = chainGeometry('double-kettlebell-front-squat', 1, BODY);

    for (const fig of [top, bottom]) {
      // Both hands sit in the front rack at chest/shoulder height, forearms angled up from tucked elbows.
      expect(dist3(fig.world.near.wrist, fig.world.near.shoulder)).toBeLessThan(9.5);
      expect(dist3(fig.world.far.wrist, fig.world.far.shoulder)).toBeLessThan(9.5);
      expect(fig.world.near.wrist[1]).toBeGreaterThan(fig.world.near.elbow[1] + 8);
      expect(Math.abs(fig.world.near.elbow[2])).toBeLessThan(Math.abs(fig.world.near.shoulder[2]) + 4.0);
    }

    // Knees track out wider than the ankles at the bottom.
    expect(Math.abs(bottom.world.near.knee[2])).toBeGreaterThan(Math.abs(bottom.world.near.ankle[2]) + 2.5);
  });
});
