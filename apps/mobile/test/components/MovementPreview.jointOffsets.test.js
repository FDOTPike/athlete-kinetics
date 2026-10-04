/**
 * WO-09 family queue, family 1 (squat, standing) — the rebuilt 55 Dumbbell
 * Squat and the declared jointOffsets machinery.
 *
 * 55 is no longer a variant of 14. Owner review in the family queue found the
 * first draft off centre with its mass behind the feet, so the movement now
 * carries its OWN seven drawn frames — a neutral upright start with the feet
 * under the hips, the squat path kept between the ankles, and one dumbbell
 * hung plumb beside each hand — authored and checked with the family's own
 * number script (tools/rendering/wo09_family1_squat_check.mjs).
 *
 * What this file holds, one test per rule:
 *   - the live 55 is its own authored entry: no derivesFrom, no jointOffsets,
 *     seven canonical frames, and it resolves through the app boundary both
 *     pending and as a hypothetical covered fixture;
 *   - the drawn pose: both drawn arms hang plumb on every keyframe (authored
 *     plumb in the data, not offset at draw time), the authored segment
 *     lengths are constant across the seven frames, and the planted feet sit
 *     at the authored stance with the far foot drawn behind the near;
 *   - the drawing: one outlined bell hangs centred on the near wrist — the
 *     suitcase form below the grip, never a bar across the hip — and there is
 *     no front-held goblet bell;
 *   - the jointOffsets machinery, still used by the movements queued behind
 *     this family, keeps refusing what it always refused. The live tree no
 *     longer carries a live offsets user, so the machinery is exercised
 *     through a synthetic variant of base 14;
 *   - base 14 draws exactly as before, and the app stage draws the rebuilt 55.
 *
 * Every expectation about 55 and 14 is computed from the live manifest.
 */
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import {
  JOINT_OFFSET_MAX_SEGMENT_CHANGE,
  buildPreviewEntry,
  deriveVariantEntry,
  rawPreviewEntries,
  validateVariantSet,
  verifyResolvedVariant,
} from '../../src/components/movementPreview/manifest';
import * as manifestModule from '../../src/components/movementPreview/manifest';
import {
  DUAL_BODY_PARAMETERS,
  layoutCanonicalFigure,
  resolveFigureJoints,
  segmentLengths,
} from '../../src/components/movementPreview/canonicalFigure';
import { MovementPreview } from '../../src/components/movementPreview';
import { resetPreviewPlayback } from '../../src/components/movementPreview/playbackCoordinator';

// The first MovementPreview render in a jest worker is slow (several seconds).
jest.setTimeout(30000);

const RAW = rawPreviewEntries();
const rawEntryFor = (movementId) => RAW.find((entry) => entry.movementId === movementId);
const BASE = rawEntryFor(14);
const VARIANT = rawEntryFor(55);

const optionsFor = (entry, body = 'neutral', extra = {}) => ({
  view: entry.view ?? BASE.view,
  body: DUAL_BODY_PARAMETERS[body],
  assetKey: entry.assetKey,
  ...extra,
});

describe('the live 55 Dumbbell Squat is its own authored entry', () => {
  test('it carries no derivesFrom and no jointOffsets, and seven canonical frames', () => {
    expect(VARIANT.derivesFrom).toBeUndefined();
    expect(VARIANT.jointOffsets).toBeUndefined();
    expect(VARIANT.captionOverrides).toBeUndefined();
    expect(VARIANT.frameRoles).toBeUndefined();
    expect(VARIANT.frames).toHaveLength(7);
    for (const frame of VARIANT.frames) {
      expect(typeof frame.id).toBe('string');
      expect(frame.caption.length).toBeGreaterThan(0);
      for (const joint of ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'an', 'kf', 'af', 'b']) {
        expect(Array.isArray(frame.joints[joint])).toBe(true);
      }
    }
  });

  test('the ladder is a symmetric descent and rise, neutral at both ends', () => {
    const [f1, f2, f3, f4, f5, f6, f7] = VARIANT.frames;
    expect(f1.joints).toEqual(f7.joints);
    expect(f2.joints).toEqual(f6.joints);
    expect(f3.joints).toEqual(f5.joints);
    expect(f4.joints.hp[1]).toBeGreaterThan(f1.joints.hp[1]);
    // feet under the hips at the neutral stance; shoulders within half a unit
    expect(f1.joints.hp[0]).toBe(f1.joints.an[0]);
    expect(Math.abs(f1.joints.nk[0] - f1.joints.an[0])).toBeLessThanOrEqual(0.5);
  });

  test('it resolves through the app boundary pending, and as a covered fixture', () => {
    const pending = buildPreviewEntry(VARIANT);
    expect(pending.movementId).toBe(55);
    expect(pending.status).toBe('pending');
    const covered = buildPreviewEntry({ ...VARIANT, status: 'covered' });
    expect(covered.frames).toHaveLength(7);
    expect(covered.derivesFrom).toBeUndefined();
    expect(covered.jointOffsets).toBeUndefined();
  });
});

describe('the drawn pose (authored in the data, lengths held across the ladder)', () => {
  test('both drawn arm segments hang plumb on every keyframe', () => {
    for (const frame of VARIANT.frames) {
      const j = resolveFigureJoints(frame.joints, optionsFor(VARIANT));
      expect(j.el[0]).toBeCloseTo(j.nArm[0], 9);
      expect(j.wr[0]).toBeCloseTo(j.el[0], 9);
      expect(j.wr[1]).toBeGreaterThan(j.el[1]);
      expect(j.el[1]).toBeGreaterThan(j.nArm[1]);
    }
  });

  test('the authored segment lengths are the same on every keyframe', () => {
    // 2dp joint rounding leaves the spine a hair under its nominal 24.
    const NOMINAL = { spine: 24, nearThigh: 22, nearShin: 22.5, farThigh: 22, farShin: 22.5, nearForearm: 10, farForearm: 10 };
    for (const frame of VARIANT.frames) {
      const lens = segmentLengths(frame.joints);
      for (const [segment, nominal] of Object.entries(NOMINAL)) {
        expect(lens[segment]).toBeCloseTo(nominal, 1);
      }
    }
  });

  test('the planted feet sit at the authored stance, far foot drawn behind the near', () => {
    for (const frame of VARIANT.frames) {
      const j = resolveFigureJoints(frame.joints, optionsFor(VARIANT));
      expect(j.an).toEqual([44, 96]);
      // the side-view far offset the canonical figure draws (FAROFF_DEFAULT)
      expect(j.af).toEqual([44 - 4.8, 96]);
    }
  });

  test('one outlined bell hangs centred on the near wrist, below the grip; never a bar across the hip', () => {
    for (const frame of VARIANT.frames) {
      const j = resolveFigureJoints(frame.joints, optionsFor(VARIANT));
      const prims = layoutCanonicalFigure(frame.joints, optionsFor(VARIANT));
      // no horizontal bar form anywhere on this movement
      expect(prims.some((p) => p.kind === 'rect' && p.w === 13 && p.h === 4.6)).toBe(false);
      const bells = prims.filter((p) => p.kind === 'rect' && p.w === 4.6 && p.h === 13);
      expect(bells).toHaveLength(1);
      const [bell] = bells;
      // the suitcase hang: same outward nudge as the carry bells, below the grip
      expect(bell.x + bell.w / 2).toBeCloseTo(j.wr[0] + 2.5, 9);
      expect(bell.y).toBeCloseTo(j.wr[1] + 1.6, 9);
      expect(bell.y + bell.h / 2).toBeGreaterThanOrEqual(j.hp[1]);
      expect(bell.stroke).toBe('ink1');
      expect(bell.strokeWidth).toBe(1.4);
      // Base 14's goblet bell is a 5.2-radius circle at the chest; 55 has none.
      expect(prims.some((p) => p.kind === 'circle' && p.r === 5.2)).toBe(false);
    }
  });
});

describe('base 14 is untouched', () => {
  test('omitting the offsets draws the base exactly as before, with its front-held bell', () => {
    for (const frame of BASE.frames) {
      const plain = layoutCanonicalFigure(frame.joints, optionsFor(BASE));
      const explicit = layoutCanonicalFigure(frame.joints, optionsFor(BASE, 'neutral', { jointOffsets: undefined }));
      expect(JSON.stringify(explicit)).toBe(JSON.stringify(plain));
      expect(plain.some((p) => p.kind === 'circle' && p.r === 5.2)).toBe(true);
      expect(plain.some((p) => p.kind === 'rect' && p.stroke !== undefined)).toBe(false);
    }
  });
});

/**
 * A synthetic variant of base 14 in the exact raw shape the movements queued
 * behind this family will declare. It exists because the live tree no longer
 * carries a live jointOffsets user after the 55 rebuild; the machinery it
 * guards is shared by every family, so it stays exercised here.
 */
const SYNTHETIC = {
  movementId: 9901,
  derivesFrom: 14,
  name: 'Synthetic Offsets Variant',
  assetKey: 'movement/synthetic-offsets-variant/demo/v1',
  previewId: 'synthetic_offsets_variant',
  summary: 'Synthetic variant for the jointOffsets machinery guard.',
  instructions: 'Synthetic instructions for the jointOffsets machinery guard.',
  cues: 'Synthetic cue for the jointOffsets machinery guard.',
  reason: 'Synthetic variant: the live tree no longer carries a live jointOffsets user after the squat-family rebuild.',
  techniqueCitations: ['Synthetic citation for the jointOffsets machinery guard.'],
  captionOverrides: {
    'stand-tall-l-1': 'Synthetic caption one.',
    'sit-between--2': 'Synthetic caption two.',
    'depth-you-ca-3': 'Synthetic caption three.',
    'drive-up-thr-4': 'Synthetic caption four.',
    'stand-tall-a-5': 'Synthetic caption five.',
  },
  frameRoles: {
    'stand-tall-l-1': 'start',
    'sit-between--2': 'descend',
    'depth-you-ca-3': 'bottom',
    'drive-up-thr-4': 'drive',
    'stand-tall-a-5': 'return',
  },
  jointOffsets: { el: [-9, 3.1], wr: [-9, 23.1], ef: [-9, 3.1], wf: [-9, 23.1], b: [-9, 23.1] },
};
const syntheticWith = (change) => ({ ...SYNTHETIC, ...change });

describe('the jointOffsets machinery refuses a malformed declaration (synthetic variant of base 14)', () => {
  test('on an entry that carries no derivesFrom (resolver set check and app boundary)', () => {
    const offsets = { el: [-9, 3.1] };
    expect(() => validateVariantSet([{ ...BASE, jointOffsets: offsets }]))
      .toThrow(/jointOffsets on an entry that carries no derivesFrom/);
    expect(() => buildPreviewEntry({ ...BASE, status: 'covered', jointOffsets: offsets }))
      .toThrow(/jointOffsets on an entry that carries no derivesFrom/);
    expect(() => buildPreviewEntry({ ...BASE, jointOffsets: offsets }))
      .toThrow(/jointOffsets on an entry that carries no derivesFrom/);
  });

  test('the planted contacts an and af', () => {
    expect(() => deriveVariantEntry(syntheticWith({ jointOffsets: { an: [1, 0] } }), BASE))
      .toThrow(/jointOffsets\.an: the planted contacts \(an, af\) cannot be offset/);
    expect(() => deriveVariantEntry(syntheticWith({ jointOffsets: { ...SYNTHETIC.jointOffsets, af: [0, -1] } }), BASE))
      .toThrow(/jointOffsets\.af: the planted contacts/);
  });

  test('an unknown joint', () => {
    expect(() => deriveVariantEntry(syntheticWith({ jointOffsets: { elbow: [1, 0] } }), BASE))
      .toThrow(/jointOffsets\.elbow is not a joint that may be offset/);
  });

  test('a value that is not two finite numbers, a [0, 0] offset and an empty declaration', () => {
    for (const bad of [[1], [1, 2, 3], ['1', 0], [Number.NaN, 0], [Infinity, 0], 'x', null]) {
      expect(() => deriveVariantEntry(syntheticWith({ jointOffsets: { el: bad } }), BASE))
        .toThrow(/jointOffsets\.el must be \[dx, dy\], two finite numbers/);
    }
    expect(() => deriveVariantEntry(syntheticWith({ jointOffsets: { el: [0, 0] } }), BASE))
      .toThrow(/jointOffsets\.el is \[0, 0\]/);
    expect(() => deriveVariantEntry(syntheticWith({ jointOffsets: {} }), BASE))
      .toThrow(/jointOffsets must declare at least one joint/);
    for (const bad of [[], 'el', 3]) {
      expect(() => deriveVariantEntry(syntheticWith({ jointOffsets: bad }), BASE))
        .toThrow(/jointOffsets must be an object of joint -> \[dx, dy\]/);
    }
  });

  test('an offset of a joint the base frames do not carry (it would draw nothing)', () => {
    const curlBase = rawEntryFor(62);
    const curl = rawEntryFor(186);
    expect(curlBase.frames[0].joints.b).toBeUndefined();
    expect(() => deriveVariantEntry({ ...curl, jointOffsets: { b: [1, 0] } }, curlBase))
      .toThrow(/jointOffsets\.b: base frame \S+ carries no b joint/);
  });

  test('any keyframe whose drawn segment moves more than 5%, proven from both sides of the bound', () => {
    expect(JOINT_OFFSET_MAX_SEGMENT_CHANGE).toBe(0.05);
    // Base 14's forearm is 10 long and vertical (wr = el + (0, -10)), so moving
    // the wrist down by d shortens it to 10 - d.
    expect(() => deriveVariantEntry(syntheticWith({ jointOffsets: { wr: [0, 0.6] } }), BASE))
      .toThrow(/jointOffsets change the drawn nearForearm of frame stand-tall-l-1 \(neutral\) from 10\.000 to 9\.400, more than 5%/);
    expect(() => deriveVariantEntry(syntheticWith({ jointOffsets: { wr: [0, 0.4] } }), BASE)).not.toThrow();
    // The same rule sees the upper arm, which is drawn from the synthetic
    // shoulder root rather than a raw joint.
    expect(() => deriveVariantEntry(syntheticWith({ jointOffsets: { el: [-9, 0] } }), BASE))
      .toThrow(/jointOffsets change the drawn nearUpperArm/);
  });

  test('a resolved record carrying offsets is verified against its base, never trusted', () => {
    const resolved = deriveVariantEntry(SYNTHETIC, BASE);
    expect(() => verifyResolvedVariant(resolved, BASE)).not.toThrow();
    expect(() => verifyResolvedVariant({ ...resolved, jointOffsets: { an: [1, 0] } }, BASE))
      .toThrow(/planted contacts/);
    expect(() => verifyResolvedVariant({ ...resolved, jointOffsets: { wr: [0, 0.6] } }, BASE))
      .toThrow(/more than 5%/);
  });
});

describe('the app stage draws the rebuilt entry (hypothetical approval fixture)', () => {
  let restore;
  let realResolve;
  const COVERED = buildPreviewEntry({ ...VARIANT, status: 'covered' });
  const BASE_COVERED = buildPreviewEntry({ ...BASE, status: 'covered' });
  const SUBJECT = {
    movement_id: 55,
    name: VARIANT.name,
    media: { assetKey: VARIANT.assetKey, status: 'ready', revision: 1, fallbackUrl: null },
  };
  const BASE_SUBJECT = {
    movement_id: 14,
    name: BASE.name,
    media: { assetKey: BASE.assetKey, status: 'ready', revision: 1, fallbackUrl: null },
  };
  beforeEach(() => {
    resetPreviewPlayback();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    realResolve = manifestModule.resolveMovementPreview;
    restore = jest.spyOn(manifestModule, 'resolveMovementPreview')
      .mockImplementation((subject) => {
        if (subject && subject.movement_id === 55) return COVERED;
        if (subject && subject.movement_id === 14) return BASE_COVERED;
        return realResolve(subject);
      });
  });
  afterEach(() => {
    restore.mockRestore();
  });

  const stageStyles = async (movement) => {
    const utils = render(<MovementPreview movement={movement} reducedMotion />);
    await act(async () => {});
    const styles = JSON.stringify(
      React.Children.toArray(screen.getByTestId('movement-preview-stage-canonical').props.children)
        .map((child) => child.props.style),
    );
    utils.unmount();
    return styles;
  };

  test('the stage for 55 draws its own frames and the outlined hanging bell', async () => {
    const drawn = await stageStyles(SUBJECT);
    const base = await stageStyles(BASE_SUBJECT);
    // its own authored pose, not base 14's shared frames
    expect(drawn).not.toBe(base);
    // the ink1 outline of the hanging bell is drawn for 55 and for neither base
    expect(drawn).toContain('"borderColor":"#141412"');
    expect(base).not.toContain('"borderColor":"#141412"');
  });
});