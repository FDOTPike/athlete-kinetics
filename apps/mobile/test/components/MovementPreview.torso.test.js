/** Torso engineering regression; rendering fixtures are NOT approval. */
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { DUAL_BODY_PARAMETERS, layoutCanonicalFigure, resolveFigureJoints, lerpJoints, poseAtTime } from '../../src/components/movementPreview/canonicalFigure';
import { MovementPreview } from '../../src/components/movementPreview';
import * as manifest from '../../src/components/movementPreview/manifest';
import { resetPreviewPlayback } from '../../src/components/movementPreview/playbackCoordinator';
import { theme } from '../../src/theme/theme';
import { previewManifest } from './previewManifest';

// R2 Part C: the merged preview data comes from the app's own module.
const raw = previewManifest;
const entry = raw.entries.find((e) => e.movementId === 62);

function torsoOf(pose, options) {
  const joints = resolveFigureJoints(pose, options);
  const prims = layoutCanonicalFigure(pose, options);
  const at = (p, point) => p.kind === 'bone' && p.x1 === point[0] && p.y1 === point[1];
  const far = prims.findIndex((p) => at(p, joints.fArm) && p.w === options.body.lw * 0.88);
  // The torso layer is the run of opaque, stroke-free, near-colour bars; the far
  // limbs carry farOpacity (0.9 in side view) and the front-view far limbs carry
  // the highlight colour. Locate the layer by that signature instead of a fixed
  // offset, so apparatus primitives drawn between the far limbs and the torso
  // (the row's bench, owner batch B1-RIG-R2) cannot shift the window. The run
  // ends at the first primitive of any other signature, so depth-layered
  // implement pieces between the trunk and the near limbs (the low cable,
  // B1-113) end it rather than join it.
  const isTrunk = (p) => p.kind === 'bone' && p.color === 'textLow'
    && p.opacity === 1 && p.stroke === undefined;
  // A flye has an opaque shoulder-girdle connector before the silhouette.
  // Select the actual transverse slice at the resolved neck, rather than
  // treating every opaque anatomical connector as a torso slice. Connectivity
  // and all negative mutations below still grade the complete slice run.
  const spine = [joints.hp[0] - joints.nk[0], joints.hp[1] - joints.nk[1]];
  const start = prims.findIndex((p, i) => i >= far && isTrunk(p)
    && Math.hypot((p.x1 + p.x2) / 2 - joints.nk[0], (p.y1 + p.y2) / 2 - joints.nk[1]) < 1e-8
    && Math.abs((p.x2 - p.x1) * spine[0] + (p.y2 - p.y1) * spine[1]) < 1e-8);
  const torso = [];
  for (let i = start; i >= 0 && i < prims.length && isTrunk(prims[i]); i += 1) torso.push(prims[i]);
  return torso;
}

test.each(['male', 'female'])('one opaque seam-free trunk replaces the outlined rings (%s)', (body) => {
  const torso = torsoOf(entry.frames[0].joints, {
    body: DUAL_BODY_PARAMETERS[body], view: entry.view, assetKey: entry.assetKey,
  });
  expect(torso.length).toBeGreaterThan(0);
  expect(torso.every((p) => p.kind === 'bone' && p.color === 'textLow'
    && p.opacity === 1 && p.stroke === undefined)).toBe(true);
});

function connected(torso, pose) {
  if (!torso.length || torso.some((p) => p.kind !== 'bone' || p.opacity !== 1
    || p.color !== 'textLow' || p.stroke !== undefined)) return false;
  const dx = pose.hp[0] - pose.nk[0], dy = pose.hp[1] - pose.nk[1];
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= 0) return false;
  // Axial intervals alone would accept detached, sideways-shifted bars.
  // Require each bar's center on the spine and its long axis perpendicular.
  if (torso.some((p) => {
    const cx = (p.x1 + p.x2) / 2 - pose.nk[0];
    const cy = (p.y1 + p.y2) / 2 - pose.nk[1];
    const bx = p.x2 - p.x1, by = p.y2 - p.y1;
    return ![cx, cy, bx, by, p.w].every(Number.isFinite) || p.w <= 0
      || Math.hypot(bx, by) <= 0 || Math.abs(cx * dy - cy * dx) > 1e-7
      || Math.abs(bx * dx + by * dy) > 1e-7;
  })) return false;
  const intervals = torso.map((p) => {
    const t = (((p.x1 + p.x2) / 2 - pose.nk[0]) * dx
      + ((p.y1 + p.y2) / 2 - pose.nk[1]) * dy) / length;
    return [t - p.w / 2, t + p.w / 2];
  }).sort((a, b) => a[0] - b[0]);
  let end = 0;
  for (const [lo, hi] of intervals) {
    if (lo > end + 1e-8) return false;
    end = Math.max(end, hi);
  }
  return end >= length;
}

const canonicals = raw.entries.filter((e) => e.frames?.[0]?.joints?.nk);
test.each(canonicals.map((e) => [e.name, e]))('%s: both bodies retain connected, tapered trunks at keys and midpoints', (_, e) => {
  for (const body of Object.values(DUAL_BODY_PARAMETERS)) {
    const options = { body, view: e.view, assetKey: e.assetKey };
    const poses = e.frames.flatMap((f, i) => i === e.frames.length - 1
      ? [f.joints] : [f.joints, lerpJoints(f.joints, e.frames[i + 1].joints, 0.5)]);
    for (const pose of poses) {
      const torso = torsoOf(pose, options);
      expect(connected(torso, resolveFigureJoints(pose, options))).toBe(true);
      // Bound View allocation, and reject a uniform stack or a narrow spine
      // masquerading as a torso. Widths remain body/view-specific.
      expect(torso.length).toBeLessThanOrEqual(40);
      const widths = torso.map((p) => Math.hypot(p.x2 - p.x1, p.y2 - p.y1));
      expect(widths[0]).toBeCloseTo(2 * body.sw * (e.view === 'front' ? 1 : 0.58), 8);
      if (e.view === 'front') {
        expect(widths.at(-1)).toBeCloseTo(2 * body.hw, 8);
        expect(Math.min(...widths)).toBeLessThan(Math.min(widths[0], widths.at(-1)) * 0.8);
      } else {
        // Side depth must taper continuously, not pinch then flare into a skirt.
        expect(widths.every((w, i) => i === 0 || w <= widths[i - 1] + 1e-8)).toBe(true);
        expect(widths.at(-1)).toBeGreaterThan(widths[0] * 0.85);
        expect(widths.at(-1)).toBeLessThan(widths[0] * 0.95);
      }
    }
  }
});

test('continuity check rejects a missing middle bar, a ring stroke, transparent fill and empty output', () => {
  const pose = entry.frames[0].joints;
  const torso = torsoOf(pose, { body: DUAL_BODY_PARAMETERS.male, view: entry.view, assetKey: entry.assetKey });
  expect(connected(torso, pose)).toBe(true);
  const middle = Math.floor(torso.length / 2);
  expect(connected(torso.filter((_, i) => i !== middle), pose)).toBe(false);
  for (const mutation of [{ stroke: 'textHi' }, { opacity: 0.5 }, { color: 'ink1' }]) {
    expect(connected(torso.map((p, i) => i === middle ? { ...p, ...mutation } : p), pose)).toBe(false);
  }
  const p = torso[middle];
  expect(connected(torso.map((v, i) => i === middle
    ? { ...v, x1: v.x1 + 30, x2: v.x2 + 30 } : v), pose)).toBe(false);
  const cx = (p.x1 + p.x2) / 2, cy = (p.y1 + p.y2) / 2;
  expect(connected(torso.map((v, i) => i === middle ? { ...v,
    x1: cx - (p.y1 - cy), y1: cy + (p.x1 - cx),
    x2: cx - (p.y2 - cy), y2: cy + (p.x2 - cx),
  } : v), pose)).toBe(false);
  expect(connected([], pose)).toBe(false);
});

const frontBaseline = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/torso-front-baseline.json'), 'utf8'));
//92/158/253 intentionally changed to a supported side-view elbow arc. Their
//contact, fixed upper arms and continuous radius have dedicated regression
//coverage in MovementPreview.supportedGeometry.test.js. Retain this frozen
//front-drawing digest for every unchanged front projection.
test.each(frontBaseline.cases.filter(c => ![92, 158, 253].includes(c.movementId)).map((c) => [c.movementId, c.body, c]))('unchanged front drawing stays byte-identical: movement %i / %s', (id, body, baseline) => {
  const e = canonicals.find((v) => v.movementId === id);
  expect(e.view).toBe('front');
  const poses = e.frames.flatMap((f, i) => i === e.frames.length - 1 ? [f.joints]
    : [f.joints, lerpJoints(f.joints, e.frames[i + 1].joints, 0.5)]);
  expect(poses).toHaveLength(baseline.samples);
  const drawings = poses.map((p) => layoutCanonicalFigure(p, {
    body: DUAL_BODY_PARAMETERS[body], view: e.view, assetKey: e.assetKey,
  }));
  expect(createHash('sha256').update(JSON.stringify(drawings)).digest('hex')).toBe(baseline.sha256);
});

const subjects = canonicals.flatMap((e) => ['male', 'female'].map((body) => [e.movementId, body]));
test.each(subjects)('production View mapping and still/motion navigation: movement %i / %s', async (id, bodyType) => {
  const e = raw.entries.find((v) => v.movementId === id);
  const subject = { movement_id: id, media: { assetKey: e.assetKey, status: 'ready' } };
  expect(e.status).toBe('pending');
  expect(raw.techniqueReview.status).toBe('pending');
  expect(manifest.resolveMovementPreview(subject)).toBeNull();
  const fixture = manifest.buildPreviewEntry({ ...e, status: 'covered' });
  jest.useFakeTimers();
  resetPreviewPlayback();
  // Pending canonical entries are absent from the resolver's covered index:
  // this is a narrowly scoped drawing fixture, NOT approved-path evidence.
  const realResolve = manifest.resolveMovementPreview;
  jest.spyOn(manifest, 'resolveMovementPreview').mockImplementation((candidate, review) => (
    candidate?.movement_id === id && candidate?.media?.assetKey === e.assetKey
      && candidate?.media?.status === 'ready' ? fixture : realResolve(candidate, review)
  ));
  expect(manifest.resolveMovementPreview({ ...subject, media: { ...subject.media, status: 'planned' } })).toBeNull();
  expect(manifest.resolveMovementPreview({ ...subject, media: { ...subject.media, assetKey: 'mismatch' } })).toBeNull();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  const element = (reducedMotion) => <MovementPreview movement={subject} bodyType={bodyType} reducedMotion={reducedMotion} />;
  const view = render(element(true));
  await act(async () => {});
  const checkDrawing = (pose) => {
    const scale = Math.min(240 / e.viewBox[2], 240 / e.viewBox[3]);
    const prims = layoutCanonicalFigure(pose, { body: DUAL_BODY_PARAMETERS[bodyType], view: e.view, assetKey: e.assetKey });
    const stage = screen.getByTestId('movement-preview-stage-canonical');
    expect(StyleSheet.flatten(stage.props.style).width).toBeCloseTo(e.viewBox[2] * scale, 8);
    const styles = React.Children.toArray(stage.props.children).map((c) => StyleSheet.flatten(c.props.style));
    const ground = (96.9 - e.viewBox[1]) * scale;
    const drawn = styles.slice(ground >= 0 && ground <= e.viewBox[3] * scale ? 1 : 0);
    expect(drawn).toHaveLength(prims.length);
    // The app's ACTUAL Views must retain the shared primitive order, fill,
    // opacity, center, thickness, radius and rotation used by canonicalSvg.
    prims.forEach((p, i) => {
      expect(drawn[i].backgroundColor).toBe(theme.color[p.kind === 'bone' ? p.color : p.fill]);
      expect(drawn[i].opacity).toBe(p.opacity);
      if (p.kind !== 'bone') return;
      const dx = (p.x2 - p.x1) * scale, dy = (p.y2 - p.y1) * scale;
      const length = Math.hypot(dx, dy), thick = Math.max(1, p.w * scale);
      expect(drawn[i].width).toBeCloseTo(length, 8);
      expect(drawn[i].height).toBeCloseTo(thick, 8);
      expect(drawn[i].borderRadius).toBeCloseTo(thick / 2, 8);
      expect(drawn[i].left).toBeCloseTo(((p.x1 + p.x2) / 2 - e.viewBox[0]) * scale - length / 2, 8);
      expect(drawn[i].top).toBeCloseTo(((p.y1 + p.y2) / 2 - e.viewBox[1]) * scale - thick / 2, 8);
      expect(parseFloat(drawn[i].transform[0].rotate)).toBeCloseTo(Math.atan2(dy, dx) * 180 / Math.PI, 8);
      expect(drawn[i].borderWidth).toBe(p.stroke === undefined ? undefined : (p.strokeWidth ?? 1) * scale);
    });
  };
  try {
    const indices = e.reducedMotionFrames ?? e.frames.map((_, i) => i);
    for (let i = 0; i < indices.length; i++) {
      expect(screen.getByTestId('movement-preview-position')).toHaveTextContent(`Position ${i + 1} of ${indices.length}`);
      expect(screen.getByTestId('movement-preview-caption')).toHaveTextContent(e.frames[indices[i]].caption);
      checkDrawing(e.frames[indices[i]].joints);
      const before = JSON.stringify(view.toJSON());
      act(() => jest.advanceTimersByTime(100));
      expect(JSON.stringify(view.toJSON())).toBe(before);
      fireEvent.press(screen.getByTestId('movement-preview-control'));
    }
    checkDrawing(e.frames[0].joints);
    view.rerender(element(false));
    fireEvent.press(screen.getByTestId('movement-preview-control'));
    act(() => jest.advanceTimersByTime(330));
    checkDrawing(poseAtTime(e.frames.map((f) => f.joints), 330, e.segmentDurationsMs));
  } finally {
    view.unmount();
    jest.useRealTimers();
    jest.restoreAllMocks();
    resetPreviewPlayback();
  }
});
