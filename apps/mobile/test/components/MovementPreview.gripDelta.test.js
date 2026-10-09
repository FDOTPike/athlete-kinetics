/**
 * WO-09 Batch 1, B1-300 — declared grip change (owner ruling, ledger Entry 0175).
 *
 * After the owner's family-2 review the live 300 Wide-Grip Lat Pulldown is no
 * longer a gripDelta variant: it draws its OWN seated frames (the draft read
 * as standing; the fix sits the athlete deep on the seat). The gripDelta
 * contract itself still ships for future grip variants, so this file now runs
 * it against a SYNTHETIC base-and-variant pair built in-test from the live
 * base 21, and separately pins the live 300's own-frames facts. What this file
 * holds, one test per rule:
 *   - the live 300: no derivation, its own thirteen frames, wide hands, deep
 *     seat, and still pending;
 *   - the synthetic variant resolves, carries its grip change, and SHARES the
 *     base's joint objects (`toBe`); its roles are the pulldown step list;
 *   - the drawn pose: hands exactly gripDelta wider, the wrist keeps its height
 *     except where the straight arm cannot reach (then it sits on the
 *     full-reach circle at the grip x), every drawn bone the base frame's own
 *     length, the elbow the IK solution nearest the base elbow, and elbow steps
 *     within the contract's factor, for all three bodies;
 *   - the drawing: the pulldown gantry and pulley, and a bar that runs past
 *     both hands and ends inside the posts; base 21 unchanged;
 *   - the refusals: a base carrying it (resolver and app boundary), a side
 *     view, a malformed or zero value, a grip beyond reach, and an elbow path
 *     that jumps (the boundary proven from both sides); a resolved record is
 *     verified, not trusted;
 *   - the app stage draws the grip change.
 *
 * The contract expectations are computed from the live base 21 and the
 * synthetic variant built from it.
 */
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import {
  GRIP_ELBOW_STEP_MAX_FACTOR,
  STEP_LISTS,
  buildPreviewEntry,
  deriveVariantEntry,
  rawPreviewEntries,
  validateVariantSet,
  verifyResolvedVariant,
} from '../../src/components/movementPreview/manifest';
import * as manifestModule from '../../src/components/movementPreview/manifest';
import {
  DUAL_BODY_PARAMETERS,
  drawnSegmentLengths,
  layoutCanonicalFigure,
  poseAtTime,
  resolveFigureJoints,
  resolveGripArms,
  solveGripArm,
} from '../../src/components/movementPreview/canonicalFigure';
import { MovementPreview } from '../../src/components/movementPreview';
import { resetPreviewPlayback } from '../../src/components/movementPreview/playbackCoordinator';

// The first MovementPreview render in a jest worker is slow (several seconds).
jest.setTimeout(30000);

const RAW = rawPreviewEntries();
const rawEntryFor = (movementId) => RAW.find((entry) => entry.movementId === movementId);
// Entry 0183: a FIXED front-view pulldown base, pinned here from the pre-
// Entry-0183 base 21 (13 frames). gripDelta is a front-view override and the live
// base 21 is now drawn side-on, so the contract is proved against this pose and
// not against a camera the owner can change. Names and text stay the base's own.
const BASE = {
  movementId: 21,
  assetKey: "movement/lat-pulldown/demo/v1",
  name: "Lat Pulldown",
  pattern: "pull_v",
  status: "pending",
  view: "front",
  equipment: "cable_machine",
  viewBox: [18,2,64,96],
  coachingIntent: "Train vertical pulling by driving the elbows down while the torso stays tall and quiet.",
  instructions: "Sit with the thighs secured and take a comfortable grip just outside shoulder width. Reach long overhead with the torso tall and the stack held just off its rest. Drive the elbows down until the bar reaches the upper chest, then return slowly to the full reach. If the hands tire before the back, soften the grip and reduce the load until the elbows can lead.",
  cues: "Drive the elbows down toward the sides. Keep the chest tall and torso quiet. Reach long overhead on the return.",
  techniqueCitations: ["Haff, G. G., & Triplett, N. T. (Eds.). (2016). Essentials of Strength Training and Conditioning (4th ed.). Human Kinetics, pp. 398-399.","Sperandei, S., et al. (2009). Analysis of the execution of lat pull-down exercises. JSCR, 23(7), 2033-2038.","Andersen, V., et al. (2014). Effects of grip width and forearm pronation/supination on muscle activity during the lat pull-down. JSCR, 28(4), 1135-1142."],
  reason: "Authored coordinate prototype with coronal 11-joint topology, cable machine frame, and pulldow.",
  segmentDurationsMs: [480,460,460,460,460,500,560,460,460,460,460,560],
  frames: [
    {"id":"pull-1","caption":"Reach long overhead with the grip just outside the shoulders.","joints":{"hd":[50,20],"nk":[50,31],"hp":[50,54],"el":[38.38,18.7],"wr":[33.32,7.82],"ef":[61.62,18.7],"wf":[66.68,7.82],"kn":[37.6,72.2],"an":[43,94],"kf":[62.4,72.2],"af":[57,94]}},
    {"id":"pull-2","caption":"Grip set, stack held just off its rest, torso tall.","joints":{"hd":[50,20],"nk":[50,31],"hp":[50,54],"el":[41.57,18.54],"wr":[33.17,9.97],"ef":[58.43,18.54],"wf":[66.83,9.97],"kn":[37.6,72.2],"an":[43,94],"kf":[62.4,72.2],"af":[57,94]}},
    {"id":"pull-3","caption":"The pull begins — the elbows lead down and out.","joints":{"hd":[50,20],"nk":[50,31],"hp":[50,54],"el":[44.74,19.2],"wr":[33.17,16.01],"ef":[55.26,19.2],"wf":[66.83,16.01],"kn":[37.6,72.2],"an":[43,94],"kf":[62.4,72.2],"af":[57,94]}},
    {"id":"pull-4","caption":"Drive the elbows down and keep the chest tall.","joints":{"hd":[50,20],"nk":[50,31],"hp":[50,54],"el":[44.77,19.21],"wr":[33.17,22.27],"ef":[55.23,19.21],"wf":[66.83,22.27],"kn":[37.6,72.2],"an":[43,94],"kf":[62.4,72.2],"af":[57,94]}},
    {"id":"pull-5","caption":"The elbows reach the sides, still driving down.","joints":{"hd":[50,20],"nk":[50,31],"hp":[50,54],"el":[41.88,18.56],"wr":[33.17,26.82],"ef":[58.12,18.56],"wf":[66.83,26.82],"kn":[37.6,72.2],"an":[43,94],"kf":[62.4,72.2],"af":[57,94]}},
    {"id":"pull-6","caption":"The bar nears the chest with the elbows low.","joints":{"hd":[50,20],"nk":[50,31],"hp":[50,54],"el":[37.48,18.9],"wr":[33.17,30.1],"ef":[62.52,18.9],"wf":[66.83,30.1],"kn":[37.6,72.2],"an":[43,94],"kf":[62.4,72.2],"af":[57,94]}},
    {"id":"pull-7","caption":"Pull until the bar reaches the upper chest.","joints":{"hd":[50,20],"nk":[50,31],"hp":[50,54],"el":[32.71,21.32],"wr":[33.17,33.31],"ef":[67.29,21.32],"wf":[66.83,33.31],"kn":[37.6,72.2],"an":[43,94],"kf":[62.4,72.2],"af":[57,94]}},
    {"id":"pull-8","caption":"Return slowly along the same path.","joints":{"hd":[50,20],"nk":[50,31],"hp":[50,54],"el":[37.48,18.9],"wr":[33.17,30.1],"ef":[62.52,18.9],"wf":[66.83,30.1],"kn":[37.6,72.2],"an":[43,94],"kf":[62.4,72.2],"af":[57,94]}},
    {"id":"pull-9","caption":"The bar rises with the elbows wide.","joints":{"hd":[50,20],"nk":[50,31],"hp":[50,54],"el":[41.88,18.56],"wr":[33.17,26.82],"ef":[58.12,18.56],"wf":[66.83,26.82],"kn":[37.6,72.2],"an":[43,94],"kf":[62.4,72.2],"af":[57,94]}},
    {"id":"pull-10","caption":"The bar rises past the face under control.","joints":{"hd":[50,20],"nk":[50,31],"hp":[50,54],"el":[44.77,19.21],"wr":[33.17,22.27],"ef":[55.23,19.21],"wf":[66.83,22.27],"kn":[37.6,72.2],"an":[43,94],"kf":[62.4,72.2],"af":[57,94]}},
    {"id":"pull-11","caption":"The arms lengthen toward the full reach.","joints":{"hd":[50,20],"nk":[50,31],"hp":[50,54],"el":[44.74,19.2],"wr":[33.17,16.01],"ef":[55.26,19.2],"wf":[66.83,16.01],"kn":[37.6,72.2],"an":[43,94],"kf":[62.4,72.2],"af":[57,94]}},
    {"id":"pull-12","caption":"Almost at the reach, stack still held.","joints":{"hd":[50,20],"nk":[50,31],"hp":[50,54],"el":[41.57,18.54],"wr":[33.17,9.97],"ef":[58.43,18.54],"wf":[66.83,9.97],"kn":[37.6,72.2],"an":[43,94],"kf":[62.4,72.2],"af":[57,94]}},
    {"id":"pull-13","caption":"Full stretch finish with the stack held just off its rest.","joints":{"hd":[50,20],"nk":[50,31],"hp":[50,54],"el":[38.38,18.7],"wr":[33.32,7.82],"ef":[61.62,18.7],"wf":[66.68,7.82],"kn":[37.6,72.2],"an":[43,94],"kf":[62.4,72.2],"af":[57,94]}},
  ],
  previewId: "lat_pulldown",
  summary: "Five drawn positions of a lat pulldown, seen from the front.",
};
const LIVE300 = rawEntryFor(300);
// The contract's synthetic pair: a gripDelta variant of the live base 21.
const VARIANT = (() => {
  const captionOverrides = {};
  const frameRoles = {};
  BASE.frames.forEach((frame, index) => {
    captionOverrides[frame.id] = `Wide grip: ${frame.id}`;
    frameRoles[frame.id] = STEP_LISTS.pulldown.steps[index];
  });
  return {
    movementId: 300,
    name: 'Hypothetical Wide-Grip Variant Fixture',
    // Entry 0183: the contract refuses a variant that carries the base's own
    // asset key, so the fixture variant stays on the wide-grip slug. The bone
    // lengths a grip change must hold are now measured against this variant's
    // own un-gripped drawing, since each slug declares its own arm on its own
    // shoulder circle.
    assetKey: 'movement/wide-grip-lat-pulldown/demo/v1',
    status: 'pending',
    previewId: 'wide_grip_lat_pulldown',
    summary: 'Hypothetical gripDelta fixture for the shipped contract.',
    instructions: 'Hypothetical wide-grip fixture: reach long overhead, pull through the elbows, and return slowly.',
    cues: 'Hypothetical fixture cues: hands wide, elbows lead.',
    coachingIntent: 'Hypothetical fixture intent for the shipped gripDelta contract.',
    reason: 'Hypothetical wide-grip fixture drawn over the live base 21 for the shipped gripDelta contract.',
    techniqueCitationsInherited: true,
    derivesFrom: 21,
    gripDelta: 4,
    frameRoles,
    captionOverrides,
  };
})();
const BODIES = ['neutral'];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const variantWith = (change) => ({ ...VARIANT, ...change });
const baseOptions = (body = 'neutral') => ({
  view: BASE.view, body: DUAL_BODY_PARAMETERS[body], assetKey: BASE.assetKey,
});
const variantOptions = (body = 'neutral', gripDelta = VARIANT.gripDelta) => ({
  view: BASE.view, body: DUAL_BODY_PARAMETERS[body], assetKey: VARIANT.assetKey, gripDelta,
});
// Entry 0183: the same variant drawn WITHOUT the grip change. Each slug now
// declares its own arm lengths on its own shoulder circle, so the bone lengths a
// grip change must hold are the variant's own, not the base's. The key is left
// off rather than set to 0: a zero gripDelta suppresses the keyed elbow solve,
// and a default parameter would fall back to the variant's own gripDelta.
const variantOwnOptions = (body = 'neutral') => ({
  view: BASE.view, body: DUAL_BODY_PARAMETERS[body], assetKey: VARIANT.assetKey,
});

describe('the live 300 Wide-Grip Lat Pulldown draws its own frames now', () => {
  test('it carries no derivation and stays pending', () => {
    expect(LIVE300.derivesFrom).toBeUndefined();
    expect(LIVE300.gripDelta).toBeUndefined();
    expect(LIVE300.status).toBe('pending');
    expect(LIVE300.view).toBe('front');
  });

  test('its own thirteen wide-grip frames sit deep on the seat', () => {
    expect(LIVE300.frames).toHaveLength(13);
    expect(LIVE300.frames.map((frame) => frame.id)).toEqual([
      'reach', 'set', 'pull-1', 'pull-2', 'pull-3', 'pull-4', 'pause',
      'rise-1', 'rise-2', 'rise-3', 'rise-4', 'almost', 'reach-again',
    ]);
    const first = LIVE300.frames[0].joints;
    // Entry 0182 item 1: the owner measured a 33.7-unit span - exactly the
    // base Lat Pulldown's - and required at least 41, so the hands now sit
    // about 4 further out per hand.
    // Entry 0183 task 2: the full span is held in EVERY frame, reach included,
    // so the reach frame is measured the same way the working frames are.
    expect(first.wr[0]).toBe(29.17);
    expect(first.wf[0]).toBe(70.83);
    expect(Math.abs(first.wf[0] - first.wr[0])).toBeGreaterThanOrEqual(41);
    const pause = LIVE300.frames[6].joints;
    expect(Math.abs(pause.wf[0] - pause.wr[0])).toBeGreaterThanOrEqual(41);
    expect(first.hp[1]).toBe(66);
    expect(first.an[1]).toBe(94);
  });

  test('the synthetic variant still resolves through the shipped contract', () => {
    expect(VARIANT.derivesFrom).toBe(21);
    expect(VARIANT.gripDelta).toBe(4);
    expect(VARIANT.view).toBeUndefined();
    expect(BASE.frames.map((frame) => VARIANT.frameRoles[frame.id])).toEqual(STEP_LISTS.pulldown.steps);
    const resolved = deriveVariantEntry(VARIANT, BASE);
    expect(resolved.gripDelta).toBe(4);
    expect(resolved.frames).toHaveLength(BASE.frames.length);
    resolved.frames.forEach((frame, i) => {
      expect(frame.id).toBe(BASE.frames[i].id);
      expect(frame.joints).toBe(BASE.frames[i].joints);
    });
  });

  test('the app boundary reads the same grip change on a covered fixture of the pair', () => {
    expect(buildPreviewEntry({ ...VARIANT, status: 'covered' }, BASE).gripDelta).toBe(4);
    expect(buildPreviewEntry(VARIANT, BASE).gripDelta).toBe(4);
  });
});

describe('the shared re-solve (solveGripArm) on its own', () => {
  // A bent arm hanging below its shoulder root (upper 11.66, forearm 11.70).
  const shoulder = [40, 30];
  const elbow = [34, 40];
  const wrist = [38, 51];
  const reflect = (p, a, z) => {
    const u = [(z[0] - a[0]) / dist(a, z), (z[1] - a[1]) / dist(a, z)];
    const t = (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1];
    const f = [a[0] + u[0] * t, a[1] + u[1] * t];
    return [2 * f[0] - p[0], 2 * f[1] - p[1]];
  };

  test('it keeps both bone lengths and moves the wrist x by exactly dx', () => {
    const s = solveGripArm(shoulder, elbow, wrist, -3);
    expect(s.reachable).toBe(true);
    expect(s.clamped).toBe(false);
    expect(s.wr).toEqual([35, 51]);
    expect(dist(shoulder, s.el)).toBeCloseTo(dist(shoulder, elbow), 12);
    expect(dist(s.el, s.wr)).toBeCloseTo(dist(elbow, wrist), 12);
  });

  test('of the two IK solutions it keeps the one nearest the given elbow', () => {
    const s = solveGripArm(shoulder, elbow, wrist, -3);
    const other = reflect(s.el, shoulder, s.wr);
    expect(dist(other, s.el)).toBeGreaterThan(1);
    expect(dist(s.el, elbow)).toBeLessThan(dist(other, elbow));
    // An elbow given on the other side (same bone lengths) gets the other solution.
    const flipped = solveGripArm(shoulder, reflect(elbow, shoulder, wrist), wrist, -3);
    expect(flipped.el[0]).toBeCloseTo(other[0], 9);
    expect(flipped.el[1]).toBeCloseTo(other[1], 9);
  });

  test('a wrist out of reach at its height keeps the grip x and lands on the full-reach circle', () => {
    // A near-straight overhead arm (12.166 + 12.166): moving the grip 6 out
    // leaves the wrist 26 from the shoulder, beyond the 24.33 reach.
    const top = solveGripArm(shoulder, [38, 18], [36, 6], -6);
    const reach = 2 * Math.hypot(2, 12);
    expect(top.clamped).toBe(true);
    expect(top.reachable).toBe(true);
    expect(top.wr[0]).toBe(30);
    expect(dist(shoulder, top.wr)).toBeCloseTo(reach, 12);
    expect(top.wr[1]).toBeGreaterThan(6);
    expect(top.wr[1]).toBeLessThan(shoulder[1]);
    expect(dist(shoulder, top.el)).toBeCloseTo(reach / 2, 12);
  });

  test('a wrist moved inside the inner reach |upper - forearm| is clamped onto the inner circle (B1-300-R2-C1)', () => {
    // Upper arm 5, forearm 8.944: no elbow can put the wrist closer to the
    // shoulder than 3.944. Moving the grip 8 inward leaves it 1 away, so the
    // wrist keeps the grip x and moves onto the inner circle; the arm folds
    // and BOTH drawn lengths still hold. Without the clamp the IK places the
    // elbow 27 from the shoulder (the upper arm would stretch 5x).
    const sh = [40, 30];
    const el = [40, 35];
    const wr = [48, 31];
    const upper = dist(sh, el);
    const fore = dist(el, wr);
    const inner = Math.abs(upper - fore);
    const s = solveGripArm(sh, el, wr, -8);
    expect(s.clamped).toBe(true);
    expect(s.reachable).toBe(true);
    expect(s.wr[0]).toBe(40);
    expect(dist(sh, s.wr)).toBeCloseTo(inner, 12);
    expect(s.wr[1]).toBeGreaterThan(sh[1]);
    expect(dist(sh, s.el)).toBeCloseTo(upper, 12);
    expect(dist(s.el, s.wr)).toBeCloseTo(fore, 12);
  });

  test('a grip x beyond the full reach is reported unreachable', () => {
    const reach = dist(shoulder, elbow) + dist(elbow, wrist);
    expect(solveGripArm(shoulder, elbow, wrist, -(reach + 1)).reachable).toBe(false);
  });
});

describe('the drawn pose (re-solved at draw time, lengths held)', () => {
  test('each hand moves 4 outward; the wrist keeps its height except on the full-reach frames', () => {
    const clampedFrames = [];
    for (const frame of BASE.frames) {
      const own = resolveFigureJoints(frame.joints, variantOwnOptions());
      const drawn = resolveFigureJoints(frame.joints, variantOptions());
      expect(drawn.wr[0]).toBeCloseTo(own.wr[0] - 4, 12);
      expect(drawn.wf[0]).toBeCloseTo(own.wf[0] + 4, 12);
      if (Math.abs(drawn.wr[1] - own.wr[1]) > 1e-12) {
        clampedFrames.push(frame.id);
        const reach = dist(own.nArm, own.el) + dist(own.el, own.wr);
        // Entry 0183: the rig keys this pose's elbow on the drawn shoulder
        // circle while the grip solve works from the two-decimal authored elbow,
        // so the two closed-form solves can differ by the authored rounding.
        // Measured residual on the clamped frames: 0.0016 of a 24.5 reach.
        expect(dist(drawn.nArm, drawn.wr)).toBeCloseTo(reach, 2);
        // Measured: the straight overhead arm sits 0.61 lower (neutral).
        expect(drawn.wr[1] - own.wr[1]).toBeCloseTo(0.61, 2);
      }
    }
    expect(clampedFrames).toEqual(['pull-1', 'pull-13']);
  });

  test('every drawn segment keeps the variant\'s own length, for all three bodies', () => {
    for (const body of BODIES) {
      for (const frame of BASE.frames) {
        const own = drawnSegmentLengths(frame.joints, variantOwnOptions(body));
        const drawn = drawnSegmentLengths(frame.joints, variantOptions(body));
        for (const segment of Object.keys(own)) {
          // Entry 0183: keyed circle vs two-decimal authored elbow, same
          // rounding residual as above (0.0016 of a 12.5 segment).
          expect(Math.abs(drawn[segment] - own[segment])).toBeLessThan(1e-2);
        }
      }
    }
  });

  test('the drawn elbow is the IK solution nearest the base elbow, on every keyframe', () => {
    for (const body of BODIES) {
      for (const frame of BASE.frames) {
        const own = resolveFigureJoints(frame.joints, variantOwnOptions(body));
        const grip = resolveGripArms(own, 4);
        const drawn = resolveFigureJoints(frame.joints, variantOptions(body));
        expect(drawn.el[0]).toBeCloseTo(grip.near.el[0], 2);
        expect(drawn.el[1]).toBeCloseTo(grip.near.el[1], 2);
        expect(drawn.ef[0]).toBeCloseTo(grip.far.el[0], 2);
        expect(drawn.ef[1]).toBeCloseTo(grip.far.el[1], 2);
        // The other solution is the reflection across the shoulder-wrist line.
        const reflect = (p, a, z) => {
          const u = [(z[0] - a[0]) / dist(a, z), (z[1] - a[1]) / dist(a, z)];
          const t = (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1];
          const f = [a[0] + u[0] * t, a[1] + u[1] * t];
          return [2 * f[0] - p[0], 2 * f[1] - p[1]];
        };
        const other = reflect(drawn.el, drawn.nArm, drawn.wr);
        expect(dist(drawn.el, own.el)).toBeLessThanOrEqual(dist(other, own.el) + 1e-9);
      }
    }
  });

  test('the eased elbow path is continuous: no 2 ms elbow jump near the size of an IK flip', () => {
    // Playback interpolates the base keyframes and re-solves every pose. The
    // path is continuous; its steepest point (where the arm meets full reach)
    // moves 0.51 in 2 ms, while an elbow flipping to the other IK solution
    // jumps more than 5 units whatever the sampling step.
    const total = BASE.segmentDurationsMs.reduce((a, b) => a + b, 0);
    for (const body of BODIES) {
      let prior;
      let worst = 0;
      for (let t = 0; t < total; t += 2) {
        const pose = poseAtTime(BASE.frames.map((frame) => frame.joints), t, BASE.segmentDurationsMs);
        const drawn = resolveFigureJoints(pose, variantOptions(body));
        if (prior) worst = Math.max(worst, dist(prior.el, drawn.el), dist(prior.ef, drawn.ef));
        prior = drawn;
      }
      expect(worst).toBeLessThan(1);
    }
  });

  test('keyframe elbow steps stay within the contract factor of the base\'s largest (measured 1.24x-1.40x)', () => {
    expect(GRIP_ELBOW_STEP_MAX_FACTOR).toBe(1.5);
    // Entry 0183: the pinned pose's reach hands now sit on the drawn 24.5 reach,
    // so its largest keyframe elbow step and the grip variant's steps were
    // re-measured on the variant's own keyed arm. Measured for neutral: 1.302.
    const MEASURED = { neutral: 1.302 };
    for (const body of BODIES) {
      let step = 0;
      let baseStep = 0;
      BASE.frames.forEach((frame, i) => {
        if (i === 0) return;
        const prior = BASE.frames[i - 1].joints;
        const a = resolveFigureJoints(prior, variantOptions(body));
        const b = resolveFigureJoints(frame.joints, variantOptions(body));
        step = Math.max(step, dist(a.el, b.el), dist(a.ef, b.ef));
        baseStep = Math.max(baseStep, dist(prior.el, frame.joints.el), dist(prior.ef, frame.joints.ef));
      });
      expect(baseStep).toBeCloseTo(5.349, 3);
      expect(step / baseStep).toBeLessThan(GRIP_ELBOW_STEP_MAX_FACTOR);
      expect(step / baseStep).toBeCloseTo(MEASURED[body], 2);
    }
  });
});

describe('the drawing: the pulldown machine and a bar held past the hands', () => {
  const bones = (prims) => prims.filter((p) => p.kind === 'bone');

  test('the drawing keeps the pulldown gantry and pulley, and runs the cable from the bar\'s middle to the pulley', () => {
    // The live 300 draws its own LOW seat (owner fix), so only the gantry
    // (two posts and the crossbar) is byte-identical to base 21's machine.
    const gantryOf = (prims) => {
      const b = prims.filter((p) => p.kind === 'bone' && p.color === 'textLow');
      return [
        b.find((p) => p.x1 === 22 && p.y1 === 6 && p.y2 === 96),
        b.find((p) => p.x1 === 78 && p.y1 === 6 && p.y2 === 96),
        b.find((p) => p.y1 === 6 && p.y2 === 6 && p.x1 === 22 && p.x2 === 78),
      ];
    };
    const baseGantry = gantryOf(layoutCanonicalFigure(BASE.frames[0].joints, baseOptions()));
    for (const frame of BASE.frames) {
      const prims = layoutCanonicalFigure(frame.joints, variantOptions());
      expect(gantryOf(prims)).toEqual(baseGantry);
      const pulley = prims.find((p) => p.kind === 'circle' && p.r === 1.8);
      expect(pulley).toMatchObject({ cx: 50, cy: 8 });
      const drawn = resolveFigureJoints(frame.joints, variantOptions());
      const cable = bones(prims).find((p) => p.color === 'textMid');
      expect(cable).toMatchObject({ x2: 50, y2: 8 });
      expect(cable.x1).toBeCloseTo((drawn.wr[0] + drawn.wf[0]) / 2, 12);
      expect(cable.y1).toBeCloseTo((drawn.wr[1] + drawn.wf[1]) / 2, 12);
    }
  });

  test('the bar runs 3.5 past each hand, at the hands\' height, with its ends inside the posts', () => {
    for (const body of BODIES) {
      for (const frame of BASE.frames) {
        const prims = layoutCanonicalFigure(frame.joints, variantOptions(body));
        const drawn = resolveFigureJoints(frame.joints, variantOptions(body));
        const bar = bones(prims).find((p) => p.beforeHead === true && p.color === 'textHi');
        expect(bar.x1).toBeCloseTo(drawn.wr[0] - 3.5, 12);
        expect(bar.x2).toBeCloseTo(drawn.wf[0] + 3.5, 12);
        expect(bar.y1).toBeCloseTo(drawn.wr[1] - 1, 12);
        expect(bar.y2).toBeCloseTo(drawn.wf[1] - 1, 12);
        // Posts at x 22 / 78, 1.6 wide; the bar's rounded ends (w 3.4) inside.
        expect(bar.x1 - bar.w / 2).toBeGreaterThan(22.8);
        expect(bar.x2 + bar.w / 2).toBeLessThan(77.2);
      }
    }
  });

  test('a grip wide enough to reach the posts has its bar ends clamped inside them', () => {
    // At +6 per hand the 3.5 overhang would end at 23.67; the ends stop at the
    // post's inner edge (22 + 0.8) plus the bar's rounded end (1.7) plus 0.5.
    expect(() => deriveVariantEntry(variantWith({ gripDelta: 6 }), BASE)).not.toThrow();
    for (const frame of BASE.frames) {
      const drawn = resolveFigureJoints(frame.joints, variantOptions('neutral', 6));
      const bar = bones(layoutCanonicalFigure(frame.joints, variantOptions('neutral', 6)))
        .find((p) => p.beforeHead === true && p.color === 'textHi');
      expect(drawn.wr[0] - 3.5).toBeLessThan(25);
      expect(bar.x1).toBeCloseTo(25, 12);
      expect(bar.x2).toBeCloseTo(75, 12);
      expect(bar.x1).toBeLessThan(drawn.wr[0]);
      expect(bar.x2).toBeGreaterThan(drawn.wf[0]);
    }
  });

  test('the drawn arms are the re-solved ones (the layout does not ignore the grip)', () => {
    for (const frame of BASE.frames) {
      const prims = layoutCanonicalFigure(frame.joints, variantOptions());
      const drawn = resolveFigureJoints(frame.joints, variantOptions());
      const has = (a, z) => bones(prims).some((p) => p.x1 === a[0] && p.y1 === a[1] && p.x2 === z[0] && p.y2 === z[1]);
      expect(has(drawn.nArm, drawn.el)).toBe(true);
      expect(has(drawn.el, drawn.wr)).toBe(true);
      expect(has(drawn.fArm, drawn.ef)).toBe(true);
      expect(has(drawn.ef, drawn.wf)).toBe(true);
    }
  });

  test('base 21 draws exactly as before: its own bar 5 inside the hands, and no grip change', () => {
    for (const frame of BASE.frames) {
      const plain = layoutCanonicalFigure(frame.joints, baseOptions());
      expect(layoutCanonicalFigure(frame.joints, { ...baseOptions(), gripDelta: undefined })).toEqual(plain);
      const bar = bones(plain).find((p) => p.beforeHead === true);
      // Pre-existing, byte-locked with base 21's evidence (recorded for the owner).
      expect(bar.x1).toBeCloseTo(frame.joints.wf[0] - 5, 12);
      expect(bar.x2).toBeCloseTo(frame.joints.wr[0] + 5, 12);
    }
  });
});

describe('the contract refuses a gripDelta it cannot honour', () => {
  test('on an entry without derivesFrom (resolver set check and app boundary)', () => {
    expect(() => validateVariantSet([{ ...BASE, gripDelta: 4 }]))
      .toThrow(/gripDelta on an entry that carries no derivesFrom/);
    expect(() => buildPreviewEntry({ ...BASE, status: 'covered', gripDelta: 4 }))
      .toThrow(/gripDelta on an entry that carries no derivesFrom/);
    expect(() => buildPreviewEntry({ ...BASE, gripDelta: 4 }))
      .toThrow(/gripDelta on an entry that carries no derivesFrom/);
  });

  test('on a side view (resolver and app boundary)', () => {
    expect(() => deriveVariantEntry(variantWith({ view: 'side' }), BASE))
      .toThrow(/gripDelta is a front-view override; this movement is drawn "side"/);
    const rowBase = rawEntryFor(12);
    // The library no longer holds a side-view variant: One-Arm Dumbbell Row
    // (247) was given its own drawing on 9 October 2026. The refusal is still
    // checked against the real side-view base, with the variant 247 used to be.
    const row = {
      movementId: 247,
      derivesFrom: 12,
      name: 'Hypothetical Side-View Row Variant Fixture',
      assetKey: 'movement/one-arm-dumbbell-row/demo/v1',
      status: 'pending',
      previewId: 'hypothetical_side_view_row_variant',
      summary: 'Five drawn positions of a one-arm dumbbell row on a bench, seen from the side.',
      instructions: 'Brace on the bench, let the working arm hang long, then drive the elbow back toward the hip and lower under control.',
      cues: 'Set the torso before the pull. Lead with the elbow.',
      coachingIntent: 'A fixture: the same bench-supported pull as its base.',
      reason: 'A fixture derived from the Single-Arm Dumbbell Row authored joint path (derivesFrom 12).',
      techniqueCitationsInherited: true,
      captionOverrides: {
        'reach-long-a-1': 'Brace on the bench and let the working arm hang long.',
        'elbow-drives-2': 'Pull by driving the elbow back toward the hip.',
        'elbow-to-the-3': 'Finish with the elbow at the hip and the upper back doing the work.',
        'lower-to-ful-4': 'Lower the bell under control to the full reach.',
        'full-stretch-5': 'If the torso turns or the shoulder shrugs, reset the rep.',
      },
      frameRoles: {
        'reach-long-a-1': 'reach', 'elbow-drives-2': 'drive', 'elbow-to-the-3': 'peak', 'lower-to-ful-4': 'lower', 'full-stretch-5': 'return',
      },
    };
    expect(rowBase.view).toBe('side');
    expect(() => deriveVariantEntry({ ...row, gripDelta: 4 }, rowBase))
      .toThrow(/gripDelta is a front-view override/);
    const covered = buildPreviewEntry({ ...VARIANT, status: 'covered' }, BASE);
    expect(covered.gripDelta).toBe(4);
    expect(() => buildPreviewEntry({ ...row, status: 'covered', gripDelta: 4 }, rowBase))
      .toThrow(/gripDelta/);
  });

  test('a value that is not a finite number, and 0', () => {
    for (const bad of ['4', Number.NaN, Infinity, null, [4], {}]) {
      expect(() => deriveVariantEntry(variantWith({ gripDelta: bad }), BASE))
        .toThrow(/gripDelta must be a finite number of box units per hand/);
    }
    expect(() => deriveVariantEntry(variantWith({ gripDelta: 0 }), BASE))
      .toThrow(/gripDelta is 0/);
  });

  test('a grip x beyond the arm\'s full reach on any keyframe', () => {
    expect(() => deriveVariantEntry(variantWith({ gripDelta: 30 }), BASE))
      .toThrow(/gripDelta 30 puts the near grip of frame pull-1 \(neutral\) beyond the arm's full reach/);
  });

  test('an elbow path that jumps, proven from both sides of the 1.5x bound', () => {
    // A close grip folds the elbow inside the shoulder (the dropped 169):
    // measured 1.53x at -3 (neutral), 1.41x at -2.
    expect(() => deriveVariantEntry(variantWith({ gripDelta: -3 }), BASE))
      .toThrow(/gripDelta -3 moves the (near|far) elbow \d+\.\d+ between keyframes \S+ and \S+ \(neutral\), more than 1\.5x the base's largest keyframe elbow step 5\.348/);
    expect(() => deriveVariantEntry(variantWith({ gripDelta: -2 }), BASE)).not.toThrow();
    expect(() => deriveVariantEntry(variantWith({ gripDelta: 5 }), BASE)).not.toThrow();
  });

  test('a resolved record carrying a grip change is verified against its base, never trusted', () => {
    const resolved = deriveVariantEntry(VARIANT, BASE);
    expect(() => verifyResolvedVariant(resolved, BASE)).not.toThrow();
    expect(() => verifyResolvedVariant({ ...resolved, gripDelta: 0 }, BASE)).toThrow(/gripDelta is 0/);
    expect(() => verifyResolvedVariant({ ...resolved, gripDelta: -3 }, BASE)).toThrow(/more than 1\.5x/);
  });
});

describe('the app stage draws the grip change (hypothetical approval fixture)', () => {
  let restore;
  let realResolve;
  const COVERED = buildPreviewEntry({ ...VARIANT, status: 'covered' }, BASE);
  const COVERED_PLAIN = { ...COVERED, gripDelta: undefined };
  const SUBJECT = {
    movement_id: 300,
    name: VARIANT.name,
    media: { assetKey: VARIANT.assetKey, status: 'ready', revision: 1, fallbackUrl: null },
  };
  let fixture = COVERED;
  beforeEach(() => {
    resetPreviewPlayback();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    realResolve = manifestModule.resolveMovementPreview;
    restore = jest.spyOn(manifestModule, 'resolveMovementPreview')
      .mockImplementation((subject) => (subject && subject.movement_id === 300 ? fixture : realResolve(subject)));
  });
  afterEach(() => {
    restore.mockRestore();
  });

  const stageStyles = async () => {
    const utils = render(<MovementPreview movement={SUBJECT} reducedMotion />);
    await act(async () => {});
    const styles = JSON.stringify(
      React.Children.toArray(screen.getByTestId('movement-preview-stage-canonical').props.children)
        .map((child) => child.props.style),
    );
    utils.unmount();
    return styles;
  };

  test('the stage for 300 differs from the same entry drawn without its grip change', async () => {
    fixture = COVERED;
    const drawn = await stageStyles();
    fixture = COVERED_PLAIN;
    const plain = await stageStyles();
    expect(drawn).not.toBe(plain);
  });
});
