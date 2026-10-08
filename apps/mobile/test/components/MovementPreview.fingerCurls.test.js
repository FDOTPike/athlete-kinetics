// Finger Curls is drawn as a scene, at the owner's request of 9 October 2026:
// the athlete holding the barbell, then a close-up of one hand, because the
// whole movement is in the fingers and the figure's own hand is too small to
// show it. The close-up is a round panel that opens out of the hand.
import {
  CANONICAL_BODY_PARAMETERS,
  CHAIN_MOVEMENTS,
  CLOSE_UP_HAND,
  FINGER_CURL_PANEL,
  chainGeometry,
  handCloseUp,
  layoutCanonicalFigure,
  poseAtTime,
} from '../../src/components/movementPreview/canonicalFigure';
import { previewManifest } from './previewManifest';

const BODY = CANONICAL_BODY_PARAMETERS;
const THIGH_HALF = (BODY.lw * 1.18) / 2;
const deg = (rad) => (rad * 180) / Math.PI;
const distance = (a, b) => Math.hypot(...a.slice(0, Math.min(a.length, b.length)).map((v, i) => v - b[i]));
/** How far point `c` is from the segment `p` to `q`. */
function segmentDistance(p, q, c) {
  const ux = q[0] - p[0], uy = q[1] - p[1];
  const k = Math.max(0, Math.min(1, ((c[0] - p[0]) * ux + (c[1] - p[1]) * uy) / (ux * ux + uy * uy)));
  return Math.hypot(c[0] - (p[0] + ux * k), c[1] - (p[1] + uy * k));
}

const entry = previewManifest.entries.find((e) => e.movementId === 200);
const segments = entry.segmentDurationsMs;
const total = segments.reduce((a, b) => a + b, 0);
const ticks = [...Array.from({ length: Math.ceil(total / 33) }, (_, i) => i * 33), total];
/** When each keyframe is reached. */
const times = segments.reduce((list, d) => [...list, list.at(-1) + d], [0]);
// Keyframes: the athlete alone, the close-up open on a closed hand, fingers open, hand closed, held, the close-up gone, rest.
const [alone, zoomed, opened, closed, held, gone] = times;
const poseAt = (t) => poseAtTime(entry.frames.map((f) => f.joints), t, segments);
const figureAt = (t) => chainGeometry('finger-curls', poseAt(t).ph, BODY, 0);
const panelAt = (t) => handCloseUp(figureAt(t));
const primsAt = (t) => layoutCanonicalFigure(poseAt(t), { ...entry, body: BODY });

test('Finger Curls is a pending draft whose text says where it came from', () => {
  expect(entry.status).toBe('pending');
  expect(entry.view).toBe('side');
  expect(entry.equipment).toBe('barbell');
  expect(entry.frames.map((f) => f.joints.ph)).toEqual([0, 1, 2, 1, 1, 0, 0]);
  // The catalogue's own text is a placeholder on a source hold; this entry does not carry it.
  expect(entry.instructions).not.toMatch(/choose a load or range you can control/);
  expect(entry.reason).toMatch(/placeholder on a source hold/);
  expect(entry.reason).toMatch(/checked by a separate auditor/);
});

describe('the athlete holding the barbell', () => {
  test('sits with the forearms level along the thighs and the hands beyond the knees', () => {
    const { world } = figureAt(alone);
    const slab = CHAIN_MOVEMENTS['finger-curls'].equipment.find((s) => s.kind === 'slab');
    expect(slab.a[1] + 2).toBeCloseTo(world.hip[1] - THIGH_HALF, 6); // on the bench
    for (const side of [world.near, world.far]) {
      expect(side.wrist[1]).toBeCloseTo(side.elbow[1], 6); // forearm level,
      expect(side.elbow[1] - side.knee[1]).toBeLessThanOrEqual(THIGH_HALF + BODY.lw * 0.36 + 1e-6); // resting on the thigh
      expect(side.wrist[0]).toBeGreaterThan(side.knee[0]); // the hand is beyond the knee
      expect(side.ankle[1]).toBeLessThan(3); // feet flat on the floor
    }
  });

  test('does not move: the whole movement is in the fingers', () => {
    const start = figureAt(alone).joints;
    for (const t of ticks) {
      const now = figureAt(t).joints;
      for (const key of ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'an', 'kf', 'af']) expect(distance(now[key], start[key])).toBeLessThan(1e-9);
    }
  });

  test('holds one barbell, seen end-on at the hands', () => {
    const figure = figureAt(alone);
    const plates = primsAt(alone).filter((p) => p.kind === 'circle' && p.r === 6.6);
    expect(plates).toHaveLength(1);
    expect(distance([plates[0].cx, plates[0].cy], figure.hold.near)).toBeLessThan(1e-9);
  });
});

describe('the close-up of the hand', () => {
  test('is not there at the start or the end, and opens out of the hand', () => {
    expect(panelAt(alone)).toBeNull();
    expect(panelAt(gone)).toBeNull();
    expect(panelAt(total)).toBeNull();
    const hand = figureAt(alone).grip.near;
    let last = 0;
    for (const t of ticks.filter((tick) => tick > alone && tick <= zoomed)) {
      const panel = panelAt(t);
      if (panel === null) continue;
      expect(panel.r).toBeGreaterThanOrEqual(last - 1e-9); // it only grows on the way in,
      last = panel.r;
      // and its centre travels in a straight line from the hand to its place.
      const target = figureAt(t).project([...FINGER_CURL_PANEL.at, 0]);
      expect(segmentDistance(hand, target, panel.centre)).toBeLessThan(1e-9);
    }
    const open = panelAt(zoomed);
    expect(open.r).toBeCloseTo(FINGER_CURL_PANEL.r, 9);
    expect(open.scale).toBeCloseTo(FINGER_CURL_PANEL.scale, 9);
    expect(FINGER_CURL_PANEL.scale).toBeGreaterThanOrEqual(5); // a real enlargement
  });

  test('sits clear of the athlete, and everything drawn in it is inside it', () => {
    const figure = figureAt(zoomed);
    const panel = panelAt(zoomed);
    expect(distance(panel.centre, figure.joints.hd)).toBeGreaterThan(panel.r + BODY.hr);
    expect(distance(panel.centre, figure.hold.near)).toBeGreaterThan(panel.r + 6.6); // clear of the barbell too
    for (const t of [zoomed, opened, closed, held]) {
      const now = panelAt(t);
      const inside = (point, half) => expect(distance(point, now.centre) + half * now.scale).toBeLessThanOrEqual(now.r - 0.5);
      inside(now.stub, CLOSE_UP_HAND.wristHalf);
      inside(now.wrist, CLOSE_UP_HAND.wristHalf);
      inside(now.knuckle, CLOSE_UP_HAND.palmHalf);
      for (const point of now.finger) inside(point, CLOSE_UP_HAND.fingerHalf);
      inside(now.bar, CLOSE_UP_HAND.bar);
    }
  });

  test('draws the hand the way the figure holds it: forearm level, palm up', () => {
    const panel = panelAt(zoomed);
    expect(panel.wrist[1]).toBeCloseTo(panel.knuckle[1], 9); // the hand lies level,
    expect(panel.knuckle[0]).toBeGreaterThan(panel.wrist[0]); // pointing the way the figure's forearm points,
    expect(panel.bar[1]).toBeLessThan(panel.knuckle[1]); // and the bar is on top of the palm (up the screen)
  });
});

describe('what the fingers do', () => {
  test('the bar starts held in the closed hand: wrapped by the fingers, resting on the palm', () => {
    const panel = panelAt(zoomed);
    expect(panel.open).toBe(0);
    const { finger, bar } = panel.model;
    const touching = CLOSE_UP_HAND.bar + CLOSE_UP_HAND.fingerHalf;
    // All three finger bones touch the bar: the finger is wrapped right round it,
    for (let i = 0; i < 3; i++) expect(segmentDistance(finger[i], finger[i + 1], bar)).toBeCloseTo(touching, 6);
    // it rests against the end of the palm (a rounded end, centred on the knuckle at the origin),
    expect(distance(bar, [0, 0])).toBeCloseTo(CLOSE_UP_HAND.palmHalf + CLOSE_UP_HAND.bar, 6);
    expect(bar[1]).toBeGreaterThan(0); // on the palm's side of the hand,
    // and the fingertip has come back over the top of it toward the wrist.
    expect(finger[3][0]).toBeLessThan(finger[2][0]);
    expect(finger[3][1]).toBeGreaterThan(bar[1]);
  });

  test('"Open the fingers and let the bar roll down the hands until it rests in the last joints of the fingers"', () => {
    const before = panelAt(zoomed), after = panelAt(opened);
    expect(after.open).toBe(1);
    const { finger, bar } = after.model;
    const touching = CLOSE_UP_HAND.bar + CLOSE_UP_HAND.fingerHalf;
    // The last joint: the bar is hooked between the middle bone and the tip bone.
    expect(segmentDistance(finger[1], finger[2], bar)).toBeCloseTo(touching, 6);
    expect(segmentDistance(finger[2], finger[3], bar)).toBeCloseTo(touching, 6);
    // It has rolled out along the hand, toward the fingertips, and down.
    expect(bar[0] - before.model.bar[0]).toBeGreaterThanOrEqual(0.9);
    expect(bar[1]).toBeLessThan(before.model.bar[1] - 0.4);
    expect(after.bar[1]).toBeGreaterThan(before.bar[1]); // lower on the drawing
    // The fingers are open: the fingertip is far out beyond the knuckle, not folded back.
    expect(finger[3][0]).toBeGreaterThan(1.5);
    // The tip is still hooked up toward the palm side, or the bar would fall.
    expect(deg(Math.atan2(finger[3][1] - finger[2][1], finger[3][0] - finger[2][0]))).toBeGreaterThanOrEqual(45);
  });

  test('the wrist stays still: only the fingers and the bar move', () => {
    const start = panelAt(zoomed);
    let moved = 0;
    for (const t of ticks.filter((tick) => tick >= zoomed && tick <= held)) {
      const now = panelAt(t);
      for (const key of ['stub', 'wrist', 'knuckle', 'centre']) expect(distance(now[key], start[key])).toBeLessThan(1e-9);
      expect(distance(now.thumb[1], start.thumb[1])).toBeLessThan(1e-9);
      moved = Math.max(moved, distance(now.bar, start.bar));
    }
    expect(moved).toBeGreaterThan(5); // while the bar travels well over a bar's width on the drawing
  });

  test('"Close the hands to curl the bar back up as high as you can, and hold for a moment"', () => {
    const start = panelAt(zoomed), top = panelAt(closed);
    expect(top.open).toBe(0);
    expect(distance(top.bar, start.bar)).toBeLessThan(1e-9); // all the way back into the closed hand
    for (const t of ticks.filter((tick) => tick >= closed && tick <= held)) expect(distance(panelAt(t).bar, top.bar)).toBeLessThan(1e-9);
    expect(held - closed).toBeGreaterThanOrEqual(600); // the hold
    // The bar is never loose.
    for (const t of ticks.filter((tick) => tick >= zoomed && tick <= held)) {
      const { finger, bar } = panelAt(t).model;
      const nearest = Math.min(...[0, 1, 2].map((i) => segmentDistance(finger[i], finger[i + 1], bar)));
      // It always touches the finger that carries it, and no finger bone is ever drawn through it.
      expect(nearest).toBeCloseTo(CLOSE_UP_HAND.bar + CLOSE_UP_HAND.fingerHalf, 6);
    }
  });
});

test('no other movement has a close-up', () => {
  expect(Object.keys(CHAIN_MOVEMENTS).filter((slug) => CHAIN_MOVEMENTS[slug].closeUp !== undefined)).toEqual(['finger-curls']);
});
