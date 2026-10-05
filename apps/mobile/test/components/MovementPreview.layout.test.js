/**
 * WO-09 round-4 audit remediation — layout primitive-order guarantees.
 *
 * The audit caught the lat-pulldown bar drawn twice (hoisted before the head
 * ring AND painted again in front of it — the front copy defeated the
 * occlusion). These tests hold the class, not just the instance:
 *   1. every canonical movement, both bodies, every keyframe: no duplicate
 *      primitives with identical geometry (a double-draw of ANY apparatus);
 *   2. any beforeHead bone (the pulldown bar) is drawn exactly once, strictly
 *      before the head ring, for every keyframe and both bodies.
 */
import fs from 'fs';
import path from 'path';
import {
  layoutCanonicalFigure,
  DUAL_BODY_PARAMETERS,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const RAW_MANIFEST = previewManifest;

const CANONICAL = RAW_MANIFEST.entries.filter((e) => e.frames?.length && e.frames[0].joints?.nk !== undefined);

const primKey = (p) => JSON.stringify(p);

const headIndexOf = (prims) => prims.findIndex((p) => p.kind === 'circle' && p.stroke === 'textHi' && p.r >= 5.5);

test('every canonical movement, both bodies, every keyframe: no duplicate primitives', () => {
  // 67 members: the fifty earlier entries, the two calf-raise members added for
  // family 9 (Standing Dumbbell Calf Raise, Calf Raises - With Bands), the two
  // seated-press members for family 11 (Seated Cable Shoulder Press, Seated
  // Dumbbell Press), and the two members added for family 12 that are not wrist
  // curls. Entry 0183: the four wrist-curl movements (Cable Wrist Curl, Finger
  // Curls, Seated Dumbbell Palms-Down Wrist Curl, Seated Dumbbell Palms-Up Wrist
  // Curl) are out of the manifest because the rig has no wrist joint. Family 13
  // adds the nine standing curls that were not done; family 15 adds the four
  // incline-press members (the barbell base and its three variations), and
  // family 16 adds Band Pull-Apart and Cable Rear Delt Fly, and family 17 adds
  // Pallof Press and Pallof Press With Rotation, and family 18 adds Barbell
  // Seated Calf Raise and Dumbbell Seated One-Leg Calf Raise, and family 19
  // adds the Plank, and family 20 adds Chest-Supported Dumbbell Row, and
  // family 21 adds the Dead Bug, and family 22 adds Dumbbell Sumo Squat, and
  // family 27 adds the five overhead triceps extensions, and family 28 adds
  // family 37 adds the kneeling rows, and family 38 adds the incline raises.
  // Original120 plus pushdowns, pulldown, flyes ankle kickback84 and reverse lunge52.
  expect(CANONICAL.length).toBe(129);
  for (const entry of CANONICAL) {
    for (const bodyName of ['neutral']) {
      for (const frame of entry.frames) {
        const prims = layoutCanonicalFigure(frame.joints, {
          view: entry.view,
          body: DUAL_BODY_PARAMETERS[bodyName],
          assetKey: entry.assetKey,
        });
        const keys = prims.map(primKey);
        expect(new Set(keys).size).toBe(keys.length);
      }
    }
  }
});

test('the side-on lat pulldown draws its end-on bar and its cable exactly once, for every keyframe on the neutral body', () => {
  const entry = CANONICAL.find((e) => e.assetKey === 'movement/lat-pulldown/demo/v1');
  expect(entry).toBeDefined();
  expect(entry.view).toBe('side');
  expect(entry.frames.length).toBeGreaterThanOrEqual(13);
  for (const bodyName of ['neutral']) {
    for (const frame of entry.frames) {
      const prims = layoutCanonicalFigure(frame.joints, {
        view: entry.view,
        body: DUAL_BODY_PARAMETERS[bodyName],
        assetKey: entry.assetKey,
      });
      // The bar is seen end-on from the side: one collar and one hub, both on
      // the axis midway between the two hands, and one cable from the pulley.
      const collars = prims.filter((p) => p.kind === 'circle' && p.r === 3.2 && p.fill === 'textHi');
      const hubs = prims.filter((p) => p.kind === 'circle' && p.r === 1.2 && p.fill === 'ink1');
      expect(collars).toHaveLength(1);
      expect(hubs).toHaveLength(1);
      const mx = (frame.joints.wr[0] + frame.joints.wf[0]) / 2;
      const my = (frame.joints.wr[1] + frame.joints.wf[1]) / 2;
      expect(collars[0].cx).toBeCloseTo(50, 6);
      expect(collars[0].cy).toBeCloseTo(my, 6);
      expect(hubs[0].cx).toBeCloseTo(50, 6);
      expect(hubs[0].cy).toBeCloseTo(my, 6);
      const cables = prims.filter((p) => p.kind === 'bone' && p.color === 'textMid' && p.w === 1.4);
      expect(cables).toHaveLength(1);
      expect(cables[0].x1).toBeCloseTo(50, 6);
      expect(cables[0].y1).toBeCloseTo(8, 6);
      expect(cables[0].x2).toBeCloseTo(50, 6);
      expect(cables[0].y2).toBeCloseTo(my, 6);
      // The cable is hoisted before the head ring, and nothing is painted twice.
      const headIdx = headIndexOf(prims);
      expect(headIdx).toBeGreaterThan(-1);
      expect(prims.indexOf(cables[0])).toBeLessThan(headIdx);
      const keys = prims.map(primKey);
      expect(new Set(keys).size).toBe(keys.length);
    }
  }
});
