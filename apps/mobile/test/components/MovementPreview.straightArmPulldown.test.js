// Physical action regressions only; this never approves source or playback.
import { DUAL_BODY_PARAMETERS, straightArmPulldownGeometry, pushdownGeometry, poseAtTime, resolveFigureJoints, layoutCanonicalFigure } from '../../src/components/movementPreview/canonicalFigure';
import { buildPreviewEntry } from '../../src/components/movementPreview/manifest';
import { previewManifest } from './previewManifest';
const entry = previewManifest.entries.find(e => e.movementId === 264);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

test.each(['neutral'])('264 uses a shoulder sweep with straight world arms and stable body (%s)', name => {
  const body = DUAL_BODY_PARAMETERS[name], opts = { ...entry, body };
  const first = resolveFigureJoints(entry.frames[0].joints, opts);
  const total = entry.segmentDurationsMs.reduce((a, b) => a + b, 0);
  const ticks = [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];
  expect(first.nk[0]).toBeGreaterThan(first.hp[0]);
  expect(first.an).not.toEqual(first.af); // Explicit staggered support.
  for (const t of ticks) {
    const pose = poseAtTime(entry.frames.map(f => f.joints), t, entry.segmentDurationsMs);
    const geometry = straightArmPulldownGeometry(pose.sa, body);
    const f = resolveFigureJoints(pose, opts);
    for (const key of ['hd', 'nk', 'hp', 'kn', 'kf', 'an', 'af', 'nArm', 'fArm']) expect(f[key]).toEqual(first[key]);
    for (const arm of [geometry.near, geometry.far]) {
      const { shoulder, elbow, wrist } = arm.world;
      expect(distance(shoulder, elbow)).toBeCloseTo(12.5, 8);
      expect(distance(elbow, wrist)).toBeCloseTo(12, 8);
      expect(distance(shoulder, wrist)).toBeCloseTo(24.5, 8);
      expect(distance(geometry.junction.world, wrist)).toBeCloseTo(12, 8);
    }
    expect(f.wr).toEqual(geometry.near.projected.wrist);
    expect(f.wf).toEqual(geometry.far.projected.wrist);
    const cables = layoutCanonicalFigure(pose, opts).filter(p => p.kind === 'bone' && p.w === 1.4 && p.color === 'textMid');
    expect(cables).toHaveLength(1);
    expect([cables[0].x1, cables[0].y1]).toEqual([88, 4]);
    expect([cables[0].x2, cables[0].y2]).toEqual(geometry.junction.projected);
  }
  const top = straightArmPulldownGeometry(-30, body), bottom = straightArmPulldownGeometry(85, body);
  expect(top.near.projected.wrist[1]).toBeLessThan(first.hd[1]);
  expect(bottom.near.projected.wrist[1]).toBeGreaterThan(first.hp[1]);
  expect(distance(top.near.world.elbow, bottom.near.world.elbow)).toBeGreaterThan(20);
  const pushStart = pushdownGeometry(110, body, true), pushEnd = pushdownGeometry(0, body, true);
  expect(pushStart.near.world.elbow).toEqual(pushEnd.near.world.elbow); // Different physical action.
});

test('264 remains pending and carries its own scalar through complete return and app validation', () => {
  expect(entry.status).toBe('pending');
  expect(entry.frames.at(-1).joints).toEqual(entry.frames[0].joints);
  expect(entry.segmentDurationsMs.at(-1)).toBeGreaterThan(entry.segmentDurationsMs[0] + entry.segmentDurationsMs[1]);
  const parsed = buildPreviewEntry({ ...entry, status: 'covered' });
  expect(parsed.frameData.frames[0].joints.sa).toBe(-30);
  const bad = JSON.parse(JSON.stringify(entry)); bad.frames[0].joints.sa = 'bad';
  expect(() => buildPreviewEntry({ ...bad, status: 'covered' })).toThrow('bad canonical sa');
});
