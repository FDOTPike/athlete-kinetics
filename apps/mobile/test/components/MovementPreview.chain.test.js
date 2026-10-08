// Chain movements: the checks every figure posed by segment directions must
// pass, whatever the movement. What each movement has to show is tested beside
// its own source text, in its family's file.
import {
  CANONICAL_BODY_PARAMETERS,
  CHAIN_ANKLE_HEIGHT,
  CHAIN_MOVEMENTS,
  chainGeometry,
  layoutCanonicalFigure,
  poseAtTime,
  resolveFigureJoints,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = CANONICAL_BODY_PARAMETERS;
const FLOOR = 96.9;
/** Straight-line distance between two points of any dimension. */
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const slugOf = (entry) => entry.assetKey.split('/')[1];
const entries = previewManifest.entries.filter((e) => CHAIN_MOVEMENTS[slugOf(e)] !== undefined);

test('every chain movement is authored, and nothing is authored twice', () => {
  expect(entries.map(slugOf).sort()).toEqual(Object.keys(CHAIN_MOVEMENTS).sort());
});

describe.each(entries.map((e) => [e.name, e]))('%s', (_name, entry) => {
  const slug = slugOf(entry);
  const movement = CHAIN_MOVEMENTS[slug];
  const view = movement.view ?? 'side';
  const opts = { ...entry, body: BODY };
  const total = entry.segmentDurationsMs.reduce((a, b) => a + b, 0);
  /** Every 33 ms tick of the cycle, plus its exact end. */
  const ticks = [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];
  /** The interpolated pose, the 3D model behind it, the drawn joints and the primitives at time `t`. */
  const at = (t) => {
    const pose = poseAtTime(entry.frames.map((f) => f.joints), t, entry.segmentDurationsMs);
    return {
      pose,
      figure: chainGeometry(slug, pose.ph, BODY, pose.tw ?? 0),
      joints: resolveFigureJoints(pose, opts),
      prims: layoutCanonicalFigure(pose, opts),
    };
  };

  test('is a pending draft in its declared view that closes its loop', () => {
    expect(entry.status).toBe('pending');
    expect(entry.view).toBe(view);
    expect(entry.frames.length).toBeGreaterThanOrEqual(5);
    // The cycle ends where it starts. A movement whose poses form a loop gets
    // there by running on to its first pose again, so its phase differs there
    // while every drawn joint is the same.
    if (movement.cycle === true) {
      const first = at(0).joints, lastDrawn = at(total).joints;
      for (const key of ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'an', 'kf', 'af']) {
        expect(distance(first[key], lastDrawn[key])).toBeLessThan(1e-9);
      }
    } else {
      expect(entry.frames[0].joints).toEqual(entry.frames.at(-1).joints);
    }
    for (const frame of entry.frames) expect(typeof frame.joints.ph).toBe('number');
    // Where the entry's own account says how far the model is turned, it is the angle the drawing uses.
    const turned = /turned (d+) degrees/.exec(entry.reason);
    if (turned) {
      expect(view).toBe('oblique');
      expect(Number(turned[1])).toBe(movement.yawDeg ?? 35);
    }
  });

  test('every bone keeps its real length on every tick', () => {
    const [upper, fore] = view === 'front' ? [13.26, 11.2] : [12.5, 12.0];
    for (const t of ticks) {
      const w = at(t).figure.world;
      let spine = 0;
      for (let i = 1; i < w.spine.length; i++) spine += distance(w.spine[i - 1], w.spine[i]);
      expect(spine).toBeCloseTo(24, 9);
      expect(w.spine[0]).toEqual(w.hip);
      expect(w.spine.at(-1)).toEqual(w.neck);
      expect(distance(w.neck, w.head)).toBeCloseTo(9, 9);
      for (const side of [w.near, w.far]) {
        expect(distance(side.hipJoint, side.knee)).toBeCloseTo(22.25, 9);
        expect(distance(side.knee, side.ankle)).toBeCloseTo(22.25, 9);
        expect(distance(side.shoulder, side.elbow)).toBeCloseTo(upper, 9);
        expect(distance(side.elbow, side.wrist)).toBeCloseTo(fore, 9);
      }
    }
  });

  test('what is measured is what is drawn', () => {
    for (const t of ticks) {
      const { figure, joints, prims } = at(t);
      expect(joints).toEqual(figure.joints);
      const painted = (from, to) => prims.some((p) => p.kind === 'bone'
        && p.x1 === from[0] && p.y1 === from[1] && p.x2 === to[0] && p.y2 === to[1]);
      for (const [from, to] of [
        [joints.nArm, joints.el], [joints.el, joints.wr], [joints.fArm, joints.ef], [joints.ef, joints.wf],
        [joints.nLeg, joints.kn], [joints.kn, joints.an], [joints.fLeg, joints.kf], [joints.kf, joints.af],
      ]) expect(painted(from, to)).toBe(true);
    }
  });

  test('the stored keyframe joints are the drawn projection', () => {
    for (const frame of entry.frames) {
      const f = resolveFigureJoints(frame.joints, opts);
      for (const key of ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'an', 'kf', 'af']) {
        expect(distance(frame.joints[key], f[key])).toBeLessThan(0.01);
      }
    }
  });

  test('the body never sinks into the floor', () => {
    for (const t of ticks) {
      for (const p of at(t).prims) {
        // Equipment supports are the dimmed pieces; everything else is body or implement.
        if (p.opacity === 0.75) continue;
        const bottom = p.kind === 'circle' ? p.cy + p.r : p.kind === 'rect' ? p.y + p.h : Math.max(p.y1, p.y2) + p.w / 2;
        expect(bottom).toBeLessThanOrEqual(FLOOR + 1e-6);
      }
    }
  });

  test('feet that stand on the floor are flat on it', () => {
    if ((movement.feet ?? 'flat') !== 'flat') return;
    for (const t of ticks) {
      const { figure, prims } = at(t);
      for (const side of [figure.world.near, figure.world.far]) {
        expect(side.ankle[1]).toBeCloseTo(CHAIN_ANKLE_HEIGHT, 9);
        expect(side.toe[1]).toBeCloseTo(side.ankle[1], 12);
      }
      if (view === 'front') continue;
      const soles = [];
      for (const [ankle, toe] of [[figure.joints.an, figure.toe.near], [figure.joints.af, figure.toe.far]]) {
        const foot = prims.find((p) => p.kind === 'bone' && p.x1 === ankle[0] && p.y1 === ankle[1] && p.x2 === toe[0] && p.y2 === toe[1]);
        expect(foot).toBeDefined();
        soles.push(Math.max(foot.y1, foot.y2) + foot.w / 2);
      }
      // Seen level, both soles are on the floor line. Looked down on, the nearer
      // foot sits lower: that one is on the line and the other is above it.
      if (movement.pitchDeg) {
        expect(Math.max(...soles)).toBeCloseTo(FLOOR, 9);
        expect(Math.min(...soles)).toBeLessThan(FLOOR);
      } else {
        for (const sole of soles) expect(sole).toBeCloseTo(FLOOR, 9);
      }
    }
  });

  test('the motion is continuous: no joint jumps between ticks', () => {
    let before = at(0).joints;
    for (const t of ticks.slice(1)) {
      const now = at(t).joints;
      for (const key of ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'an', 'kf', 'af']) {
        // A running stride moves a foot much further in one tick than any lift does.
        expect(distance(now[key], before[key])).toBeLessThanOrEqual(movement.cycle === true ? 14 : 4);
      }
      before = now;
    }
  });
});
