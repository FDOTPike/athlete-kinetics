// Physical contact/arc regressions, not technique approval or native evidence.
import { buildPreviewEntry } from '../../src/components/movementPreview/manifest';
import { DUAL_BODY_PARAMETERS, poseAtTime, resolveFigureJoints, layoutCanonicalFigure, segmentDurations, supportedRearRaiseGeometry } from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';
const raw = require('../../src/components/movementPreview/movementPreviewManifest.json');
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const options = (entry, body) => ({ view: entry.view, assetKey: entry.assetKey, body });
const source = id => previewManifest.entries.find(e => e.movementId === id);
function times(entry) {
  const total = segmentDurations(entry.frames.length, entry.segmentDurationsMs).reduce((a, b) => a + b, 0);
  return [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];
}

test.each([53, 82, 138, 163])('shrug%i has stationary head/trunk/legs, extended arms and a one-second peak', id => {
  const entry = source(id);
  expect(entry.status).toBe('pending');
  expect(entry.segmentDurationsMs[2]).toBeGreaterThanOrEqual(1000);
  for (const body of Object.values(DUAL_BODY_PARAMETERS)) {
    const opts = options(entry, body);
    const initial = resolveFigureJoints(entry.frames[0].joints, opts);
    for (const t of times(entry)) {
      const pose = poseAtTime(entry.frames.map(f => f.joints), t, entry.segmentDurationsMs);
      const f = resolveFigureJoints(pose, opts);
      for (const key of ['hd', 'nk', 'hp', 'kn', 'kf', 'an', 'af']) expect(f[key]).toEqual(initial[key]);
      for (const [root, elbow, wrist] of [[f.nArm, f.el, f.wr], [f.fArm, f.ef, f.wf]]) {
        expect(distance(root, elbow)).toBeCloseTo(12.5, 8);
        expect(distance(elbow, wrist)).toBeCloseTo(12, 8);
        expect(distance(root, wrist)).toBeCloseTo(24.5, 8);
      }
    }
    const top = resolveFigureJoints(entry.frames[2].joints, opts);
    expect(initial.nArm[1] - top.nArm[1]).toBeCloseTo(4.5, 8);
    expect(initial.wr[1] - top.wr[1]).toBeCloseTo(4.5, 8);
    if (id === 82) expect(top.wr[0]).toBeGreaterThan(top.hp[0]);
    if (id === 138) expect(top.wr[0]).toBeLessThan(top.hp[0]);
  }
});

test.each([92, 158, 253])('preacher%i keeps supported elbows and forearm radius, with full slow return', id => {
  const entry = source(id);
  expect(entry.view).toBe('side');
  expect(entry.frames.at(-1).joints).toEqual(entry.frames[0].joints);
  expect(entry.segmentDurationsMs.at(-1)).toBe(3000);
  expect(entry.segmentDurationsMs[2]).toBeGreaterThanOrEqual(1000);
  for (const body of Object.values(DUAL_BODY_PARAMETERS)) {
    const opts = options(entry, body);
    const first = resolveFigureJoints(entry.frames[0].joints, opts);
    const pad = layoutCanonicalFigure(entry.frames[0].joints, opts).find(p => p.kind === 'bone' && p.w === 5 && p.color === 'textMid');
    expect(pad).toBeDefined();
    const dx = first.el[0] - first.nArm[0], dy = first.el[1] - first.nArm[1];
    const padDistance = Math.abs(dx * (pad.y1 - first.nArm[1]) - dy * (pad.x1 - first.nArm[0])) / Math.hypot(dx, dy);
    expect(padDistance).toBeCloseTo(body.lw * 0.88 / 2 + pad.w / 2, 8);
    for (const t of times(entry)) {
      const pose = poseAtTime(entry.frames.map(f => f.joints), t, entry.segmentDurationsMs);
      const f = resolveFigureJoints(pose, opts);
      for (const key of ['hd', 'nk', 'hp', 'nArm', 'fArm', 'el', 'ef']) expect(f[key]).toEqual(first[key]);
      expect(distance(f.nArm, f.el)).toBeCloseTo(12.5, 8);
      expect(distance(f.el, f.wr)).toBeCloseTo(12, 8);
      expect(distance(f.ef, f.wf)).toBeCloseTo(12, 8);
      // Signed flexion: an almost-straight unsigned angle missed a previous
      // hyperextension/reversal. Both arm chains must remain on the curl side.
      for (const [root, elbow, wrist] of [[f.nArm, f.el, f.wr], [f.fArm, f.ef, f.wf]]) {
        const u = [elbow[0] - root[0], elbow[1] - root[1]];
        const v = [wrist[0] - elbow[0], wrist[1] - elbow[1]];
        const flexion = -Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]) * 180 / Math.PI;
        expect(flexion).toBeGreaterThanOrEqual(10 - 1e-8);
        expect(flexion).toBeLessThanOrEqual(150 + 1e-8);
      }
    }
  }
});

test.each([82, 138, 92, 158, 163])('bar%i spans both actual hands and cable variants attach once to its center', id => {
  const entry = source(id);
  for (const body of Object.values(DUAL_BODY_PARAMETERS)) for (const t of times(entry)) {
    const pose = poseAtTime(entry.frames.map(f => f.joints), t, entry.segmentDurationsMs);
    const f = resolveFigureJoints(pose, options(entry, body));
    const prims = layoutCanonicalFigure(pose, options(entry, body));
    const shafts = prims.filter(p => p.kind === 'bone' && p.w === 1.6 && p.color === 'textHi');
    expect(shafts).toHaveLength(1);
    expect(distance([shafts[0].x1, shafts[0].y1], [shafts[0].x2, shafts[0].y2])).toBeCloseTo(distance(f.wr, f.wf) + 7, 8);
    const centre = [(f.wr[0] + f.wf[0]) / 2, (f.wr[1] + f.wf[1]) / 2];
    expect([(shafts[0].x1 + shafts[0].x2) / 2, (shafts[0].y1 + shafts[0].y2) / 2]).toEqual(centre);
    if ([158, 163].includes(id)) {
      const cables = prims.filter(p => p.kind === 'bone' && p.w === 1.4 && p.color === 'textMid');
      expect(cables).toHaveLength(1);
      expect([cables[0].x2, cables[0].y2]).toEqual(centre);
      expect([cables[0].x1, cables[0].y1]).toEqual(id === 158 ? [72, 92] : [84, 88]);
    }
  }
});

test.each([53, 143, 253])('dumbbell%i emits its one load depiction per hand without the generic horizontal rectangle', id => {
  const entry = source(id);
  for (const body of Object.values(DUAL_BODY_PARAMETERS)) for (const frame of entry.frames) {
    const prims = layoutCanonicalFigure(frame.joints, options(entry, body));
    expect(prims.filter(p => p.kind === 'rect' && p.w === 13 && p.h === 4.6)).toHaveLength(0);
    if (id === 143) {
      expect(prims.filter(p => p.kind === 'bone' && p.w === 2.2)).toHaveLength(2);
      expect(prims.filter(p => p.kind === 'circle' && p.r === 2.4)).toHaveLength(4);
      expect(prims.filter(p => p.kind === 'rect' && p.w === 3.6 && p.h === 7)).toHaveLength(0);
    }
    if (id === 253) {
      expect(prims.filter(p => p.kind === 'rect' && p.w === 3.2 && p.h === 10)).toHaveLength(0);
      const shafts = prims.filter(p => p.kind === 'bone' && p.w === 2.2);
      expect(shafts).toHaveLength(2);
      const f = resolveFigureJoints(frame.joints, options(entry, body));
      for (const [elbow, wrist] of [[f.el, f.wr], [f.ef, f.wf]]) {
        const shaft = shafts.find(p => Math.abs((p.x1 + p.x2) / 2 - wrist[0]) < 1e-8 && Math.abs((p.y1 + p.y2) / 2 - wrist[1]) < 1e-8);
        expect(shaft).toBeDefined();
        const dx = shaft.x2 - shaft.x1, dy = shaft.y2 - shaft.y1;
        expect(Math.hypot(dx, dy)).toBeCloseTo(10, 8);
        expect(dx * (wrist[0] - elbow[0]) + dy * (wrist[1] - elbow[1])).toBeCloseTo(0, 8);
      }
    }
    if (id === 53) expect(prims.filter(p => p.kind === 'rect' && p.w === 6 && p.h === 4.6)).toHaveLength(4);
  }
});

test('143 is a world-lateral supported raise with fixed bend, quiet torso and actual head-pad contact for every body', () => {
  const entry = source(143);
  expect(entry.view).toBe('oblique');
  expect(entry.segmentDurationsMs[2]).toBe(1000);
  expect(entry.frames.at(-1).joints).toEqual(entry.frames[0].joints);
  const distance3 = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
  for (const body of Object.values(DUAL_BODY_PARAMETERS)) {
    const initial = resolveFigureJoints(entry.frames[0].joints, options(entry, body));
    expect(initial.nk[1]).toEqual(initial.hp[1]);
    expect(initial.nk[0] - initial.hp[0]).toBeGreaterThan(16);
    for (const t of times(entry)) {
      const pose = poseAtTime(entry.frames.map(f => f.joints), t, entry.segmentDurationsMs);
      const world = supportedRearRaiseGeometry(pose.ra, body);
      const f = resolveFigureJoints(pose, options(entry, body));
      for (const key of ['hd', 'nk', 'hp', 'kn', 'kf', 'an', 'af', 'nArm', 'fArm']) expect(f[key]).toEqual(initial[key]);
      for (const arm of [world.near, world.far]) {
        const { shoulder, elbow, wrist } = arm.world;
        expect(distance3(shoulder, elbow)).toBeCloseTo(12.5, 8);
        expect(distance3(elbow, wrist)).toBeCloseTo(12, 8);
        expect([shoulder[0], elbow[0], wrist[0]]).toEqual([0, 0, 0]);
        const u = elbow.map((v, i) => v - shoulder[i]);
        const v = wrist.map((v, i) => v - elbow[i]);
        expect(Math.acos(u.reduce((s, x, i) => s + x * v[i], 0) / (12.5 * 12)) * 180 / Math.PI).toBeCloseTo(15, 8);
        if (pose.ra === 90) expect(elbow[1]).toBeCloseTo(shoulder[1], 8);
      }
      expect(f.wr).toEqual(world.near.projected.wrist);
      expect(f.wf).toEqual(world.far.projected.wrist);
      const prims = layoutCanonicalFigure(pose, options(entry, body));
      const pad = prims.find(p => p.kind === 'bone' && p.w === 4 && p.color === 'textHi');
      const px = pad.x2 - pad.x1, py = pad.y2 - pad.y1;
      const padLength = Math.hypot(px, py);
      expect(py).toBeLessThan(0); // Incline, rather than the old flat bench.
      const normalGap = Math.abs(px * (f.hd[1] - pad.y1) - py * (f.hd[0] - pad.x1)) / padLength;
      expect(normalGap).toBeCloseTo(body.hr + pad.w / 2, 8);
      const along = ((f.hd[0] - pad.x1) * px + (f.hd[1] - pad.y1) * py) / padLength;
      expect(along).toBeGreaterThan(0);
      expect(along).toBeLessThan(padLength);
    }
  }
  const parsed = buildPreviewEntry({ ...raw.entries.find(e => e.movementId === 143), status: 'covered' });
  expect(parsed.frameData.view).toBe('oblique');
  expect(parsed.frameData.frames[2].joints.ra).toBe(90);
});

test('253 caption names the neutral dumbbell grip and scalar drawing instructions survive validation', () => {
  expect(source(253).frames[0].caption).toContain('palms facing each other');
  expect(source(253).frames[0].caption).not.toContain('underhand');
  for (const id of [82, 92]) {
    const entry = raw.entries.find(e => e.movementId === id);
    const parsed = buildPreviewEntry({ ...entry, status: 'covered' });
    const key = id === 82 ? 'se' : 'ca';
    expect(parsed.frames[2].joints[key]).toEqual(entry.frames[2].joints[key]);
    const bad = JSON.parse(JSON.stringify(entry));
    bad.frames[0].joints[key] = 'bad';
    expect(() => buildPreviewEntry({ ...bad, status: 'covered' })).toThrow(`bad canonical ${key}`);
  }
});
