// Source-specific engineering regressions; no technique or native approval.
import { DUAL_BODY_PARAMETERS, pushdownGeometry, poseAtTime, resolveFigureJoints, layoutCanonicalFigure } from '../../src/components/movementPreview/canonicalFigure';
import { buildPreviewEntry } from '../../src/components/movementPreview/manifest';
import { previewManifest } from './previewManifest';
const distance = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
const entries = [80, 262, 292].map(id => previewManifest.entries.find(e => e.movementId === id));
test.each(entries)('$movementId pushdown preserves upper arms, actual flexion and return through every body/tick', entry => {
  expect(entry.status).toBe('pending');
  expect(entry.segmentDurationsMs[2]).toBe(1000);
  expect(entry.frames.at(-1).joints).toEqual(entry.frames[0].joints);
  const total = entry.segmentDurationsMs.reduce((a, b) => a + b, 0);
  for (const body of [DUAL_BODY_PARAMETERS.neutral]) {
    const opts = { ...entry, body };
    const first = resolveFigureJoints(entry.frames[0].joints, opts);
    const ticks = [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];
    for (const t of ticks) {
      const pose = poseAtTime(entry.frames.map(f => f.joints), t, entry.segmentDurationsMs);
      expect(typeof pose.pe).toBe('number');
      expect(pose.pe).toBeGreaterThanOrEqual(0);
      expect(pose.pe).toBeLessThanOrEqual(110);
      const push = pushdownGeometry(pose.pe, body, entry.movementId === 292);
      const f = resolveFigureJoints(pose, opts);
      for (const key of ['hd', 'nk', 'hp', 'kn', 'kf', 'an', 'af', 'nArm', 'fArm', 'el', 'ef']) expect(f[key]).toEqual(first[key]);
      for (const arm of [push.near, push.far]) {
        const { shoulder, elbow, wrist } = arm.world;
        expect(distance(shoulder, elbow)).toBeCloseTo(12.5, 8);
        expect(distance(elbow, wrist)).toBeCloseTo(12, 8);
        expect(shoulder[0]).toBe(elbow[0]);
        expect(shoulder[2]).toBe(elbow[2]);
        const flexion = Math.acos((elbow[1] - wrist[1]) / 12) * 180 / Math.PI;
        expect(flexion).toBeCloseTo(pose.pe, 5);
        if (entry.movementId === 292) expect(distance(push.junction.world, wrist)).toBeCloseTo(12, 8);
        if (pose.pe === 0) expect(wrist).toEqual([elbow[0], elbow[1] - 12, elbow[2]]);
      }
      expect(f.wr).toEqual(push.near.projected.wrist);
      expect(f.wf).toEqual(push.far.projected.wrist);
      const prims = layoutCanonicalFigure(pose, opts);
      for (const p of prims) for (const value of Object.values(p).filter(v => typeof v === 'number')) expect(Number.isFinite(value)).toBe(true);
      const cable = prims.filter(p => p.kind === 'bone' && p.w === 1.4 && p.color === 'textMid');
      expect(cable).toHaveLength(1);
      expect([cable[0].x1, cable[0].y1]).toEqual([84, 10]);
      const attachment = entry.movementId === 292 ? push.junction.projected : [(f.wr[0] + f.wf[0]) / 2, (f.wr[1] + f.wf[1]) / 2];
      expect([cable[0].x2, cable[0].y2]).toEqual(attachment);
    }
  }
});

test('bar grips have opposite palm orientation and rope endpoints really spread without bending the extended elbows', () => {
  for (const body of [DUAL_BODY_PARAMETERS.neutral]) {
    const prims = entries.slice(0, 2).map(e => layoutCanonicalFigure(e.frames[0].joints, { ...e, body }));
    const palms = prims.map(ps => ps.filter(p => p.kind === 'bone' && p.w === 2.2 && p.color === 'textHi'));
    expect(palms[0]).toHaveLength(2); expect(palms[1]).toHaveLength(2);
    const hands = pushdownGeometry(110, body, false);
    for (const point of [hands.near.projected.wrist, hands.far.projected.wrist]) {
      expect(palms[0].some(p => p.y1 < point[1])).toBe(true);
      expect(palms[1].some(p => p.y1 > point[1])).toBe(true);
    }
    const start = pushdownGeometry(110, body, true), end = pushdownGeometry(0, body, true);
    expect(distance(end.near.projected.wrist, end.far.projected.wrist)).toBeGreaterThan(distance(start.near.projected.wrist, start.far.projected.wrist) * 2.5);
  }
});

test('pushdown scalar survives the app data boundary and refuses malformed data', () => {
  for (const entry of entries) {
    expect(buildPreviewEntry({ ...entry, status: 'covered' }).frameData.frames[0].joints.pe).toBe(110);
    const bad = JSON.parse(JSON.stringify(entry)); bad.frames[0].joints.pe = 'bad';
    expect(() => buildPreviewEntry({ ...bad, status: 'covered' })).toThrow('bad canonical pe');
  }
});
