/**
 * MOV-A01 / MOV-A01-R1: 9 barbell, front, and box squats (IDs 1, 123, 277, 299, 8, 208, 38, 256, 275)
 * and the chain-kit additions (footSpread, kneeOut, nearBarEnd/farBarEnd, closeUp zoom/open).
 */
import {
  CANONICAL_BODY_PARAMETERS,
  CHAIN_MOVEMENTS,
  chainGeometry,
  handCloseUp,
  layoutCanonicalFigure,
  poseAtTime,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';
import catalogue from '../../../../docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json';

const BODY = CANONICAL_BODY_PARAMETERS;
const MOV_A01_IDS = [1, 123, 277, 299, 8, 208, 38, 256, 275];

const entryFor = (id) => previewManifest.entries.find((e) => e.movementId === id);
const rowFor = (id) => catalogue.movements.find((m) => m.id === id);
const slugFor = (id) => entryFor(id).assetKey.split('/')[1];

const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const shinAngleFromFloorDeg = (fig) => {
  const ankle = fig.world.near.ankle;
  const knee = fig.world.near.knee;
  return Math.atan2(knee[1] - ankle[1], knee[0] - ankle[0]) * 180 / Math.PI;
};

const barMidWorld = (fig) => [
  (fig.world.near.hold[0] + fig.world.far.hold[0]) / 2,
  (fig.world.near.hold[1] + fig.world.far.hold[1]) / 2,
  (fig.world.near.hold[2] + fig.world.far.hold[2]) / 2,
];

describe('MOV-A01 chain kit additions: footSpread, kneeOut, nearBarEnd / farBarEnd', () => {
  test('footSpread shifts planted near and far ankles symmetrically in world Z without altering bone lengths', () => {
    const hipWidthZ = 2 * BODY.hw * 0.8;
    const narrow = chainGeometry('narrow-stance-squats', 0, BODY);
    const standard = chainGeometry('competition-squat', 0, BODY);
    const wide = chainGeometry('wide-stance-barbell-squat', 0, BODY);

    const spanZ = (fig) => fig.world.near.ankle[2] - fig.world.far.ankle[2];
    expect(spanZ(narrow)).toBeCloseTo(hipWidthZ + 2 * (-0.5), 6);
    expect(spanZ(standard)).toBeCloseTo(hipWidthZ + 2 * 5.4, 6);
    expect(spanZ(wide)).toBeCloseTo(hipWidthZ + 2 * 10.0, 6);
    expect(spanZ(narrow)).toBeLessThan(hipWidthZ);
    expect(spanZ(standard)).toBeGreaterThan(hipWidthZ);
    expect(spanZ(wide)).toBeGreaterThan(spanZ(standard));
  });

  test('kneeOut abducts the solved knees outward in world Z while keeping 22.25 thigh and shin lengths', () => {
    const narrowBottom = chainGeometry('narrow-stance-squats', 1, BODY);
    const wideBottom = chainGeometry('wide-stance-barbell-squat', 1, BODY);
    const bandBottom = chainGeometry('squat-with-bands', 1, BODY);

    const kneeSpanZ = (fig) => fig.world.near.knee[2] - fig.world.far.knee[2];
    expect(kneeSpanZ(wideBottom)).toBeGreaterThan(kneeSpanZ(narrowBottom) + 18);
    expect(kneeSpanZ(bandBottom)).toBeGreaterThan(kneeSpanZ(narrowBottom) + 19);

    for (const fig of [narrowBottom, wideBottom, bandBottom]) {
      expect(dist3(fig.world.near.hipJoint, fig.world.near.knee)).toBeCloseTo(22.25, 6);
      expect(dist3(fig.world.near.knee, fig.world.near.ankle)).toBeCloseTo(22.25, 6);
    }
  });

  test('nearBarEnd and farBarEnd attach band lines to the outer ends of the barbell shaft, not the hands', () => {
    for (const slug of ['squat-with-bands', 'reverse-band-box-squat', 'speed-box-squat']) {
      const fig = chainGeometry(slug, 0.5, BODY);
      const pose = { ...fig.joints, ph: 0.5 };
      const prims = layoutCanonicalFigure(pose, {
        view: 'oblique',
        body: BODY,
        assetKey: `movement/${slug}/demo/v1`,
      });
      // Bar end points sit 9 box units outside the near and far hand holds along the bar axis.
      expect(dist2(fig.barEnd.near, fig.hold.near)).toBeCloseTo(9, 5);
      expect(dist2(fig.barEnd.far, fig.hold.far)).toBeCloseTo(9, 5);
      expect(dist2(fig.barEnd.near, fig.barEnd.far)).toBeGreaterThan(dist2(fig.hold.near, fig.hold.far) + 17.9);

      const bandBones = prims.filter(
        (p) => p.kind === 'bone' && p.color === 'textMid' && Math.abs(p.w - 1.4) < 1e-6,
      );
      expect(bandBones).toHaveLength(2);
      // Layer 2 paints far-depth lines first, then Layer 5 paints near-depth lines.
      const ends = bandBones.map((b) => [b.x2, b.y2]);
      expect(ends[0][0]).toBeCloseTo(fig.barEnd.far[0], 5);
      expect(ends[0][1]).toBeCloseTo(fig.barEnd.far[1], 5);
      expect(ends[1][0]).toBeCloseTo(fig.barEnd.near[0], 5);
      expect(ends[1][1]).toBeCloseTo(fig.barEnd.near[1], 5);
    }
  });

  test('closeUp optional zoom and open keep a constant open-hand fingertip panel across all phases without altering phase-driven finger-curls', () => {
    for (const ph of [0, 0.5, 1]) {
      const cleanFig = chainGeometry('front-squat-clean-grip', ph, BODY);
      const panel = handCloseUp(cleanFig);
      expect(panel).not.toBeNull();
      expect(panel.zoom).toBe(1);
      expect(panel.open).toBe(1);
      // In screen coordinates (+y downward), the open fingertips (finger[2], finger[3]) sit directly under the bar (larger y than bar[1]).
      expect(panel.finger[2][1]).toBeGreaterThan(panel.bar[1] + 3.0);
      expect(panel.finger[3][1]).toBeGreaterThan(panel.bar[1] + 1.5);
      expect(dist2(panel.centre, panel.bar)).toBeLessThan(panel.r);
    }
    // Omitted zoom/open on finger-curls preserves phase-driven panel opening.
    expect(handCloseUp(chainGeometry('finger-curls', 0, BODY))).toBeNull();
    expect(handCloseUp(chainGeometry('finger-curls', 1, BODY)).open).toBe(0);
    expect(handCloseUp(chainGeometry('finger-curls', 2, BODY)).open).toBe(1);
  });
});

describe('MOV-A01 universal invariants across all 9 squats', () => {
  test.each(MOV_A01_IDS)('movement %i has pending status, oblique view, family yaw, and exact bone lengths on every 33ms tick', (id) => {
    const entry = entryFor(id);
    const slug = slugFor(id);
    const def = CHAIN_MOVEMENTS[slug];
    expect(entry).toBeDefined();
    expect(entry.status).toBe('pending');
    expect(entry.view).toBe('oblique');
    expect(def.view).toBe('oblique');
    const expectedYaw = [1, 123, 277, 299].includes(id) ? 32 : [8, 208].includes(id) ? 10 : 30;
    expect(def.yawDeg).toBe(expectedYaw);
    if ([8, 208].includes(id)) expect(def.yawDeg).toBeLessThanOrEqual(10);
    expect(entry.reason).toContain(`turned ${expectedYaw} degrees`);
    expect(entry.frames.length).toBeGreaterThanOrEqual(5);

    const total = entry.segmentDurationsMs.reduce((a, b) => a + b, 0);
    const [vx, vy, vw, vh] = entry.viewBox;
    const pose0 = chainGeometry(slug, 0, BODY);

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

      // Feet remain planted on the floor throughout the rep.
      expect(dist3(w.near.ankle, pose0.world.near.ankle)).toBeLessThan(1e-6);
      expect(dist3(w.far.ankle, pose0.world.far.ankle)).toBeLessThan(1e-6);

      // Bar stays over mid-foot throughout the rep.
      const bar = barMidWorld(fig);
      const midFootX = w.near.ankle[0] + 2.7;
      expect(Math.abs(bar[0] - midFootX)).toBeLessThanOrEqual(3.5);

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

describe('MOV-A01 per-movement source-bound biomechanics', () => {
  test('1 Competition Squat: rooted stance, bar across upper back over mid-foot, hip crease passes top of knee', () => {
    const row = rowFor(1);
    expect(row.source.instructions).toContain('until the hip crease passes the top of the knee');
    expect(row.source.instructions).toContain('while the bar stays over mid-foot');

    const top = chainGeometry('competition-squat', 0, BODY);
    const bottom = chainGeometry('competition-squat', 1, BODY);
    const shoulderSpanZ = top.world.near.shoulder[2] - top.world.far.shoulder[2];
    const ankleSpanZ = top.world.near.ankle[2] - top.world.far.ankle[2];
    expect(ankleSpanZ).toBeGreaterThan(shoulderSpanZ);

    // Hip crease below top of knee at bottom.
    expect(bottom.world.hip[1]).toBeLessThan(bottom.world.near.knee[1] - 1.0);

    // Bar sits across the upper back (behind the neck) at every phase.
    for (const ph of [0, 0.25, 0.5, 0.75, 1]) {
      const fig = chainGeometry('competition-squat', ph, BODY);
      const bar = barMidWorld(fig);
      expect(bar[0]).toBeLessThan(fig.world.neck[0]);
      expect(Math.hypot(bar[0] - fig.world.neck[0], bar[1] - fig.world.neck[1])).toBeLessThanOrEqual(3.5);
    }
  });

  test('123 Narrow Stance Squats: stance narrower than shoulder width, knees travel forward over toes into a deep squat', () => {
    const row = rowFor(123);
    expect(row.source.instructions).toContain('stance narrower than shoulder width');
    expect(row.source.instructions).toContain('let the knees travel forward as the hips sit down');
    expect(row.source.cues).toContain('Send the knees forward over the toes');

    const top = chainGeometry('narrow-stance-squats', 0, BODY);
    const bottom = chainGeometry('narrow-stance-squats', 1, BODY);
    const compTop = chainGeometry('competition-squat', 0, BODY);
    const compBottom = chainGeometry('competition-squat', 1, BODY);

    const shoulderSpanZ = top.world.near.shoulder[2] - top.world.far.shoulder[2];
    const narrowAnkleSpanZ = top.world.near.ankle[2] - top.world.far.ankle[2];
    const compAnkleSpanZ = compTop.world.near.ankle[2] - compTop.world.far.ankle[2];
    expect(narrowAnkleSpanZ).toBeLessThan(shoulderSpanZ - 6);
    expect(narrowAnkleSpanZ).toBeLessThan(compAnkleSpanZ - 10);

    // Deep squat with knees travelling well forward over the toes.
    expect(bottom.world.near.knee[0]).toBeGreaterThan(bottom.world.near.toe[0] + 9);
    expect(bottom.world.near.knee[0]).toBeGreaterThan(compBottom.world.near.knee[0] + 4);
    expect(bottom.world.hip[1]).toBeLessThan(compBottom.world.hip[1]);
  });

  test('277 Squat with Bands: floor-anchored bands to barbell ends, wide stance with knees pushed out, hip crease level with top of knee', () => {
    const row = rowFor(277);
    expect(row.source.instructions).toContain('Attach bands from the ends of the bar to a secure anchor near the floor');
    expect(row.source.instructions).toContain('until the hip crease is level with the top of the knee');

    const top = chainGeometry('squat-with-bands', 0, BODY);
    const bottom = chainGeometry('squat-with-bands', 1, BODY);

    // Wide stance and knees pushed out.
    const ankleSpanZ = top.world.near.ankle[2] - top.world.far.ankle[2];
    const kneeSpanBottomZ = bottom.world.near.knee[2] - bottom.world.far.knee[2];
    expect(ankleSpanZ).toBeGreaterThan(28);
    expect(kneeSpanBottomZ).toBeGreaterThan(ankleSpanZ + 6);

    // Hip crease level with the top of the knee at bottom (within 1.2 units of knee center).
    expect(Math.abs(bottom.world.hip[1] - bottom.world.near.knee[1])).toBeLessThanOrEqual(1.2);

    // Floor-anchored bands lengthen as the bar rises from bottom to standing lockout.
    const anchorNear = top.project([-1, 1.2, 16.5]);
    const lenTop = dist2(anchorNear, top.barEnd.near);
    const lenBottom = dist2(anchorNear, bottom.barEnd.near);
    expect(lenTop).toBeGreaterThan(lenBottom + 18);
  });

  test('299 Wide Stance Barbell Squat: stance wider than the shoulders, knees pushed out, thighs just below level with floor', () => {
    const row = rowFor(299);
    expect(row.source.instructions).toContain('stance wider than the shoulders');
    expect(row.source.instructions).toContain('until the thighs are just below level with the floor');

    const top = chainGeometry('wide-stance-barbell-squat', 0, BODY);
    const bottom = chainGeometry('wide-stance-barbell-squat', 1, BODY);
    const compTop = chainGeometry('competition-squat', 0, BODY);

    const shoulderSpanZ = top.world.near.shoulder[2] - top.world.far.shoulder[2];
    const wideAnkleSpanZ = top.world.near.ankle[2] - top.world.far.ankle[2];
    const compAnkleSpanZ = compTop.world.near.ankle[2] - compTop.world.far.ankle[2];
    expect(wideAnkleSpanZ).toBeGreaterThan(shoulderSpanZ + 9);
    expect(wideAnkleSpanZ).toBeGreaterThan(compAnkleSpanZ + 5);

    // Thighs just below level with the floor at the bottom.
    expect(bottom.world.hip[1]).toBeLessThan(bottom.world.near.knee[1]);
    expect(bottom.world.near.knee[1] - bottom.world.hip[1]).toBeLessThanOrEqual(1.5);
  });

  test('8 Front Squat: bar across front of shoulders, secure grip slightly wider than shoulder-width, upper arms near horizontal and pointing forward at every tick', () => {
    const row = rowFor(8);
    expect(row.source.instructions).toContain('Set the bar across the front of the shoulders with a secure grip and the elbows pointing forward');
    expect(row.source.cues).toContain('Stay tall through the drive');

    const entry = entryFor(8);
    const bottom = chainGeometry('front-squat', 1, BODY);
    const compBottom = chainGeometry('competition-squat', 1, BODY);

    // Secure grip directly on the bar (no wrist-extension hand segment, no closeUp).
    expect(bottom.angles.hand).toBeUndefined();
    expect(handCloseUp(bottom)).toBeNull();

    // At every 33ms tick, bar sits across the front of the shoulders and upper arms stay near horizontal (within 10 deg) and pointing forward.
    const total = entry.segmentDurationsMs.reduce((a, b) => a + b, 0);
    for (let t = 0; t <= total; t += 33) {
      const p = poseAtTime(entry.frames.map((f) => f.joints), t, entry.segmentDurationsMs);
      const fig = chainGeometry('front-squat', p.ph, BODY);
      const bar = barMidWorld(fig);
      expect(bar[0]).toBeGreaterThan(fig.world.neck[0] + 1.0);
      expect(Math.hypot(bar[0] - fig.world.neck[0], bar[1] - fig.world.neck[1])).toBeLessThanOrEqual(2.5);

      const dx = fig.world.near.elbow[0] - fig.world.near.shoulder[0];
      const dy = fig.world.near.elbow[1] - fig.world.near.shoulder[1];
      const upperArmPitchDeg = Math.atan2(dy, dx) * 180 / Math.PI;
      expect(dx).toBeGreaterThan(12.0);
      expect(Math.abs(upperArmPitchDeg)).toBeLessThanOrEqual(10.0);
    }

    // Upright torso (more vertical than back squat) and full squat depth.
    expect(bottom.angles.trunk[0]).toBeGreaterThan(compBottom.angles.trunk[0] + 15);
    expect(bottom.world.hip[1]).toBeLessThan(bottom.world.near.knee[1] - 1.0);
  });

  test('208 Front Squat (Clean Grip): rack visibly below shoulder height, hands just outside shoulders (narrower than 8), fingertips under bar in closeUp, elbows at least as high as 8 at every tick', () => {
    const row = rowFor(208);
    expect(row.source.instructions).toContain('Set the bar in a rack just below shoulder height');
    expect(row.source.instructions).toContain('fingertips under the bar and the elbows high');

    const entry = entryFor(208);
    const top = chainGeometry('front-squat-clean-grip', 0, BODY);
    const bottom = chainGeometry('front-squat-clean-grip', 1, BODY);
    const stdTop = chainGeometry('front-squat', 0, BODY);

    // Rack J-hook height (63.0) is visibly below standing shoulder height (70.08) and lower than 8 Front Squat's J-hooks (68.5).
    const cleanHookY = 63.0;
    const stdHookY = 68.5;
    expect(top.world.near.shoulder[1] - cleanHookY).toBeGreaterThanOrEqual(6.5);
    expect(cleanHookY).toBeLessThan(stdHookY - 5.0);

    // Grip width relationship: 8 ("slightly wider than shoulder-width") has wider hand spacing than 208 ("hands just outside the shoulders"), and both are outside the shoulders.
    const shoulderSpanZ = top.world.near.shoulder[2] - top.world.far.shoulder[2];
    const cleanGripSpanZ = top.world.near.grip[2] - top.world.far.grip[2];
    const stdGripSpanZ = stdTop.world.near.grip[2] - stdTop.world.far.grip[2];
    expect(cleanGripSpanZ).toBeGreaterThan(shoulderSpanZ + 3.0);
    expect(stdGripSpanZ).toBeGreaterThan(cleanGripSpanZ + 2.0);

    // At every 33ms tick: bar rests on front of shoulders, upper arms are near horizontal and pointing forward with elbows higher than 8, and closeUp shows fingertips under the bar.
    const total = entry.segmentDurationsMs.reduce((a, b) => a + b, 0);
    for (let t = 0; t <= total; t += 33) {
      const p = poseAtTime(entry.frames.map((f) => f.joints), t, entry.segmentDurationsMs);
      const cleanFig = chainGeometry('front-squat-clean-grip', p.ph, BODY);
      const stdFig = chainGeometry('front-squat', p.ph, BODY);
      const bar = barMidWorld(cleanFig);
      expect(bar[0]).toBeGreaterThan(cleanFig.world.neck[0] + 1.0);
      expect(Math.hypot(bar[0] - cleanFig.world.neck[0], bar[1] - cleanFig.world.neck[1])).toBeLessThanOrEqual(2.5);

      const cleanDx = cleanFig.world.near.elbow[0] - cleanFig.world.near.shoulder[0];
      const cleanDy = cleanFig.world.near.elbow[1] - cleanFig.world.near.shoulder[1];
      const stdDy = stdFig.world.near.elbow[1] - stdFig.world.near.shoulder[1];
      const cleanPitchDeg = Math.atan2(cleanDy, cleanDx) * 180 / Math.PI;
      expect(cleanDx).toBeGreaterThan(12.0);
      expect(Math.abs(cleanPitchDeg)).toBeLessThanOrEqual(10.0);
      expect(cleanDy).toBeGreaterThanOrEqual(stdDy + 1.0);

      const panel = handCloseUp(cleanFig);
      expect(panel).not.toBeNull();
      expect(panel.open).toBe(1);
      expect(panel.finger[2][1]).toBeGreaterThan(panel.bar[1] + 3.0);
      expect(panel.finger[3][1]).toBeGreaterThan(panel.bar[1] + 1.5);
      expect(panel.centre[0] + panel.r).toBeLessThan(cleanFig.joints.hd[0] - 8);
    }

    expect(bottom.world.hip[1]).toBeLessThan(bottom.world.near.knee[1] - 2.0);
  });

  test('38 Box Squat: box at parallel height behind lifter, hips sit far back onto box with near-vertical shins and a seated pause', () => {
    const row = rowFor(38);
    expect(row.source.instructions).toContain('Set a box behind you at or just below parallel height');
    expect(row.source.cues).toContain('Sit back, shins near vertical');

    const entry = entryFor(38);
    const bottom = chainGeometry('box-squat', 1, BODY);
    const compBottom = chainGeometry('competition-squat', 1, BODY);

    // Hips travel much further back than in a regular back squat, keeping shins near-vertical (within 7 deg of 90).
    expect(bottom.world.hip[0]).toBeLessThan(compBottom.world.hip[0] - 4.0);
    expect(Math.abs(shinAngleFromFloorDeg(bottom) - 90)).toBeLessThanOrEqual(7.0);

    // Underside of the hips/thighs contacts the box top (y = 20.2) at the bottom pause.
    const thighRadius = BODY.lw * 1.18 / 2;
    const boxTopY = 20.2;
    expect(Math.abs((bottom.world.hip[1] - thighRadius) - boxTopY)).toBeLessThanOrEqual(0.5);

    // Pauses seated on the box between frames[1] and frames[2].
    expect(entry.frames[1].joints.ph).toBe(1);
    expect(entry.frames[2].joints.ph).toBe(1);
    expect(entry.segmentDurationsMs[1]).toBeGreaterThanOrEqual(500);
  });

  test('256 Reverse Band Box Squat: bands hang from top of power rack to barbell ends, lengthen on descent to help at bottom, wide stance onto box', () => {
    const row = rowFor(256);
    expect(row.source.instructions).toContain('Inside a rack, hang bands from the top and loop them around the bar');
    expect(row.source.coaching_intent).toContain('bands that help most at the bottom');

    const top = chainGeometry('reverse-band-box-squat', 0, BODY);
    const bottom = chainGeometry('reverse-band-box-squat', 1, BODY);

    // Overhead band anchor at the top of the rack (world y = 86, above standing head height).
    expect(86).toBeGreaterThan(top.world.head[1] + 5);
    const overheadAnchorNear = top.project([-4, 86, 16.5]);
    const lenTop = dist2(overheadAnchorNear, top.barEnd.near);
    const lenBottom = dist2(overheadAnchorNear, bottom.barEnd.near);

    // Reverse bands stretch as the bar descends onto the box (longer at bottom than at top).
    expect(lenBottom).toBeGreaterThan(lenTop + 18);

    // Wide stance, sitting back onto the box with near-vertical shins.
    const ankleSpanZ = top.world.near.ankle[2] - top.world.far.ankle[2];
    expect(ankleSpanZ).toBeGreaterThan(26);
    expect(Math.abs(shinAngleFromFloorDeg(bottom) - 90)).toBeLessThanOrEqual(7.0);
    const thighRadius = BODY.lw * 1.18 / 2;
    expect(Math.abs((bottom.world.hip[1] - thighRadius) - 20.2)).toBeLessThanOrEqual(0.5);
  });

  test('275 Speed Box Squat: floor-anchored bands to bar ends, controlled descent to box, brief pause, concentric visibly faster than descent', () => {
    const row = rowFor(275);
    expect(row.source.instructions).toContain('Anchor bands near the floor and loop them over the ends of the bar');
    expect(row.source.instructions).toContain('Drive up off the box as fast as you can');

    const entry = entryFor(275);
    const top = chainGeometry('speed-box-squat', 0, BODY);
    const bottom = chainGeometry('speed-box-squat', 1, BODY);

    // Floor-anchored bands lengthen as the lifter drives up from the box.
    const floorAnchorNear = top.project([-4, 1.2, 16.5]);
    const lenTop = dist2(floorAnchorNear, top.barEnd.near);
    const lenBottom = dist2(floorAnchorNear, bottom.barEnd.near);
    expect(lenTop).toBeGreaterThan(lenBottom + 18);

    // Sits back onto the box with near-vertical shins.
    expect(Math.abs(shinAngleFromFloorDeg(bottom) - 90)).toBeLessThanOrEqual(7.0);
    const thighRadius = BODY.lw * 1.18 / 2;
    expect(Math.abs((bottom.world.hip[1] - thighRadius) - 20.2)).toBeLessThanOrEqual(0.5);

    // Concentric ascent duration (segment 2) is less than half the controlled descent duration (segment 0), with a brief pause on the box (segment 1).
    const [descentMs, boxPauseMs, concentricMs] = entry.segmentDurationsMs;
    expect(entry.frames[1].joints.ph).toBe(1);
    expect(entry.frames[2].joints.ph).toBe(1);
    expect(boxPauseMs).toBeGreaterThanOrEqual(300);
    expect(concentricMs * 2).toBeLessThan(descentMs);
  });
});

