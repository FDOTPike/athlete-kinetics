/** Data regression: real production interpolation and post-separation geometry. */
import fs from 'fs';
import path from 'path';
import { drawnSegmentLengths, resolveFigureJoints, poseAtTime, segmentDurations,
  DUAL_BODY_PARAMETERS } from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';
// R2 Part C: the merged preview data comes from the app's own module.
const raw = previewManifest;
const entry = raw.entries.find((e) => e.movementId === 17);

test.each(['male', 'female'])('Walking Lunge retains rigid legs through the full in-plane stride (%s)', (body) => {
  const frames = entry.frames.map((f) => f.joints);
  const total = segmentDurations(frames.length, entry.segmentDurationsMs).reduce((a, b) => a + b, 0);
  const opts = { view: entry.view, body: DUAL_BODY_PARAMETERS[body], assetKey: entry.assetKey };
  const poses = [...frames];
  for (let t = 0; t < total; t += 10) poses.push(poseAtTime(frames, t, entry.segmentDurationsMs));
  expect(poses.length).toBeGreaterThan(100);
  for (const pose of poses) {
    const lengths = drawnSegmentLengths(pose, opts);
    for (const [segment, target] of Object.entries({ nearThigh: 22, farThigh: 22, nearShin: 22.5, farShin: 22.5 })) {
      expect(Math.abs(lengths[segment] - target) / target).toBeLessThanOrEqual(0.05);
    }
  }
  // Detect renderer separation discontinuities as well as authored teleports.
  let previous;
  for (let t = 0; t < total; t += 10) {
    const joints = resolveFigureJoints(poseAtTime(frames, t, entry.segmentDurationsMs), opts);
    if (previous) for (const joint of ['an', 'af', 'kn', 'kf']) {
      expect(Math.hypot(joints[joint][0] - previous[joint][0], joints[joint][1] - previous[joint][1])).toBeLessThan(2);
    }
    previous = joints;
  }
});
