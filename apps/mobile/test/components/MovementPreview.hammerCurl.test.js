// Hammer Curl was redrawn turned on 9 October 2026 at the owner's request: seen
// from the front its curl came toward the viewer, so the hands hardly seemed to
// rise. Dumbbell Bicep Curl is a variant drawn from Hammer Curl's frames, so it
// turned with it. Measured on the 3D model: x forward, y up from the floor, z
// across the body toward the viewer.
import {
  CANONICAL_BODY_PARAMETERS,
  CHAIN_MOVEMENTS,
  chainGeometry,
  layoutCanonicalFigure,
  peakWeightAtTime,
  poseAtTime,
} from '../../src/components/movementPreview/canonicalFigure';
import { deriveVariantEntry } from '../../src/components/movementPreview/derivation';
import { previewManifest } from './previewManifest';

const BODY = CANONICAL_BODY_PARAMETERS;
const deg = (rad) => (rad * 180) / Math.PI;
const distance = (a, b) => Math.hypot(...a.slice(0, Math.min(a.length, b.length)).map((v, i) => v - b[i]));
const minus = (a, b) => a.map((v, i) => v - b[i]);
const angleAt = (from, mid, to) => {
  const a = minus(from, mid), b = minus(to, mid);
  return deg(Math.acos(Math.max(-1, Math.min(1, a.reduce((sum, v, i) => sum + v * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b))))));
};
const elbowOf = (side) => angleAt(side.shoulder, side.elbow, side.wrist);
const slugOf = (entry) => entry.assetKey.split('/')[1];
const SIDES = ['near', 'far'];

const hammer = previewManifest.entries.find((e) => e.movementId === 62);
const rawBicep = previewManifest.entries.find((e) => e.movementId === 186);
/** The bicep curl as the contract resolves it: the base's frames, its own captions, roles and timings. */
const bicep = deriveVariantEntry(rawBicep, hammer);

function ticksOf(segments) {
  const total = segments.reduce((a, b) => a + b, 0);
  return [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];
}
const poseOf = (frames, segments, t) => poseAtTime(frames.map((f) => f.joints), t, segments);
const worldAt = (slug, frames, segments, t) => chainGeometry(slug, poseOf(frames, segments, t).ph, BODY, 0).world;
/** The handle of each drawn dumbbell: the thin bone between its two plates. */
const handlesOf = (prims, w) => prims.filter((p) => p.kind === 'bone' && p.w === w);

describe('Hammer Curl (62)', () => {
  const [up, hold, down] = hammer.segmentDurationsMs;
  const at = (t) => worldAt('hammer-curl', hammer.frames, hammer.segmentDurationsMs, t);

  test('is a pending redraw, turned so the curl can be seen, that keeps its draft id and its citations', () => {
    expect(hammer.status).toBe('pending');
    expect(hammer.view).toBe('oblique');
    expect(CHAIN_MOVEMENTS['hammer-curl'].yawDeg).toBe(50);
    expect(hammer.previewId).toBe('hammer_curl');
    expect(hammer.techniqueCitations).toHaveLength(3);
    expect(hammer.reason).toContain('Redrawn on 9 October 2026');
  });

  test('"Hold the dumbbells at the sides with the palms facing each other and keep that neutral grip for the whole rep"', () => {
    const start = at(0);
    for (const name of SIDES) {
      expect(elbowOf(start[name])).toBeGreaterThanOrEqual(175); // the natural long-arm position
      expect(Math.abs(start[name].wrist[0] - start[name].shoulder[0])).toBeLessThanOrEqual(1); // at the sides
    }
    // Neutral grip: each dumbbell is held like a hammer, square to its own forearm, on every tick.
    for (const t of ticksOf(hammer.segmentDurationsMs)) {
      const pose = poseOf(hammer.frames, hammer.segmentDurationsMs, t);
      const figure = chainGeometry('hammer-curl', pose.ph, BODY, 0);
      const prims = layoutCanonicalFigure(pose, { ...hammer, body: BODY });
      for (const [grip, elbow] of [[figure.grip.near, figure.joints.el], [figure.grip.far, figure.joints.ef]]) {
        const handle = handlesOf(prims, 2.2).find((p) => Math.abs((p.x1 + p.x2) / 2 - grip[0]) < 1e-9 && Math.abs((p.y1 + p.y2) / 2 - grip[1]) < 1e-9);
        expect(handle).toBeDefined();
        expect(Math.abs((handle.x2 - handle.x1) * (grip[0] - elbow[0]) + (handle.y2 - handle.y1) * (grip[1] - elbow[1]))).toBeLessThan(1e-6);
      }
    }
  });

  test('hardly seemed to rise from the front: "Curl to shoulder height with quiet upper arms"', () => {
    const start = at(0), top = at(up);
    for (const name of SIDES) {
      expect(Math.abs(top[name].wrist[1] - top[name].shoulder[1])).toBeLessThanOrEqual(4); // shoulder height
      expect(top[name].wrist[1] - start[name].wrist[1]).toBeGreaterThanOrEqual(18);
      expect(top[name].wrist[0]).toBeGreaterThan(top[name].elbow[0] + 4); // the forearm curls forward and up
    }
    for (const t of ticksOf(hammer.segmentDurationsMs)) {
      const now = at(t);
      for (const name of SIDES) {
        expect(now[name].elbow).toEqual(start[name].elbow); // quiet upper arms: the elbows do not move at all
        expect(now[name].wrist[1]).toBeCloseTo(now.near.wrist[1], 9); // both arms together
      }
      expect(now.hip).toEqual(start.hip); // the torso does not rock
      expect(now.neck).toEqual(start.neck);
    }
    // Turned, the rise shows: on the drawing the hand travels up by most of a forearm's length.
    const drawn = (t) => chainGeometry('hammer-curl', poseOf(hammer.frames, hammer.segmentDurationsMs, t).ph, BODY, 0).joints.wr;
    expect(drawn(0)[1] - drawn(up)[1]).toBeGreaterThanOrEqual(18);
  });

  test('"then lower slower than you lifted. Return to the natural long-arm position"', () => {
    expect(down).toBeGreaterThanOrEqual(1.5 * up);
    expect(hold).toBeLessThanOrEqual(400); // the text has no pause at the top
    const end = at(up + hold + down);
    for (const name of SIDES) expect(elbowOf(end[name])).toBeGreaterThanOrEqual(175);
  });
});

describe('Dumbbell Bicep Curl (186), drawn from the Hammer Curl frames', () => {
  const frames = bicep.frames;
  const segments = bicep.segmentDurationsMs;
  const [up, squeeze, down] = segments;
  const opts = { ...bicep, body: BODY };

  test('is still a variant of Hammer Curl: the same poses, its own grip, captions and timing', () => {
    expect(rawBicep.derivesFrom).toBe(62);
    expect(rawBicep.frames).toBeUndefined(); // it carries no frames of its own
    expect(bicep.status).toBe('pending');
    expect(slugOf(bicep)).toBe('dumbbell-bicep-curl');
    expect(bicep.view).toBe('oblique');
    expect(CHAIN_MOVEMENTS['dumbbell-bicep-curl'].poses).toEqual(CHAIN_MOVEMENTS['hammer-curl'].poses);
    expect(CHAIN_MOVEMENTS['dumbbell-bicep-curl'].implement).toBe('bells');
    expect(CHAIN_MOVEMENTS['hammer-curl'].implement).toBe('hammer');
    expect(frames.map((f) => f.caption)).not.toEqual(hammer.frames.map((f) => f.caption));
  });

  test('"palms facing forward": each dumbbell lies across the body, level, except at the squeeze', () => {
    const start = layoutCanonicalFigure(poseOf(frames, segments, 0), { ...opts, implementOrientation: bicep.implementOrientation, implementTiltWeight: 0 });
    const handles = handlesOf(start, 1.8);
    expect(handles).toHaveLength(2);
    for (const handle of handles) expect(Math.abs(handle.y2 - handle.y1)).toBeLessThan(1e-9);
  });

  test('"curl the dumbbells up to shoulder height ... Squeeze": the wrists turn a little further at the top, little finger toward the ear', () => {
    expect(squeeze).toBeGreaterThanOrEqual(600);
    const tiltAt = (t) => {
      const weight = peakWeightAtTime(frames, bicep.frameRoles, t, segments);
      const prims = layoutCanonicalFigure(poseOf(frames, segments, t), { ...opts, implementOrientation: bicep.implementOrientation, implementTiltWeight: weight });
      const figure = chainGeometry('dumbbell-bicep-curl', poseOf(frames, segments, t).ph, BODY, 0);
      return handlesOf(prims, 1.8).map((handle) => {
        // The inner end is the one nearer the neck; a positive tilt means it is the higher end.
        const ends = [[handle.x1, handle.y1], [handle.x2, handle.y2]].sort((a, b) => Math.abs(a[0] - figure.joints.nk[0]) - Math.abs(b[0] - figure.joints.nk[0]));
        return deg(Math.atan2(ends[1][1] - ends[0][1], Math.abs(ends[1][0] - ends[0][0])));
      });
    };
    for (const tilt of tiltAt(0)) expect(tilt).toBeCloseTo(0, 6);
    for (const tilt of tiltAt(up)) expect(tilt).toBeCloseTo(0, 6); // level on arriving at the top,
    for (const tilt of tiltAt(up + squeeze)) expect(tilt).toBeCloseTo(15, 6); // turned by the end of the squeeze,
    for (const tilt of tiltAt(up + squeeze + down)) expect(tilt).toBeCloseTo(0, 6); // and level again at long arms
    const world = worldAt('dumbbell-bicep-curl', frames, segments, up);
    for (const name of SIDES) expect(Math.abs(world[name].wrist[1] - world[name].shoulder[1])).toBeLessThanOrEqual(4);
  });

  test('"lower slowly until the arms are straight"', () => {
    expect(down).toBeGreaterThanOrEqual(1.5 * up);
    const end = worldAt('dumbbell-bicep-curl', frames, segments, up + squeeze + down);
    for (const name of SIDES) expect(elbowOf(end[name])).toBeGreaterThanOrEqual(175);
  });
});
