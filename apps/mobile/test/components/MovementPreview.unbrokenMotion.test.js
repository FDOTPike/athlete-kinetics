// Owner decision, 8 October 2026: each lift and each lowering is one unbroken
// motion. Every gap between keyframes is eased in and out, so a keyframe
// half-way through a lift made the limb hesitate there. These are the nine
// movements drawn before that was understood; the later ones hold the same
// rule in their own files.
import {
  CANONICAL_BODY_PARAMETERS,
  poseAtTime,
  resolveFigureJoints,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** The one number that drives each of these figures. */
const DRIVER = { 66: 'ir', 152: 'tp', 50: 'la', 236: 'la', 87: 'fr', 206: 'fr', 135: 'pi', 187: 'pi', 272: 'la' };
const entries = Object.keys(DRIVER).map((id) => previewManifest.entries.find((e) => e.movementId === Number(id)));

describe.each(entries.map((e) => [e.name, e]))('%s', (_name, entry) => {
  const key = DRIVER[entry.movementId];
  const [first, hold, second, rest] = entry.segmentDurationsMs;
  const jointsAt = (t) => resolveFigureJoints(
    poseAtTime(entry.frames.map((f) => f.joints), t, entry.segmentDurationsMs),
    { ...entry, body: CANONICAL_BODY_PARAMETERS },
  );

  test('keyframes are start, far end, far end again, start, start: no keyframe in mid-motion', () => {
    const values = entry.frames.map((f) => f.joints[key]);
    expect(values).toHaveLength(5);
    expect(values[1]).not.toBe(values[0]);
    expect(values).toEqual([values[0], values[1], values[1], values[0], values[0]]);
    expect(entry.segmentDurationsMs).toHaveLength(4);
  });

  test('the figure never stops between the two end positions, and is still while it holds and rests', () => {
    const moved = (t) => {
      const a = jointsAt(t), b = jointsAt(t + 33);
      return Math.max(...['nk', 'hp', 'el', 'wr', 'ef', 'wf'].map((k) => distance(a[k], b[k])));
    };
    for (let t = 33; t < first - 66; t += 33) expect(moved(t)).toBeGreaterThan(0.003);
    for (let t = first + hold + 33; t < first + hold + second - 66; t += 33) expect(moved(t)).toBeGreaterThan(0.003);
    for (let t = first; t + 33 <= first + hold; t += 33) expect(moved(t)).toBe(0);
    for (let t = first + hold + second; t + 33 <= first + hold + second + rest; t += 33) expect(moved(t)).toBe(0);
  });
});
