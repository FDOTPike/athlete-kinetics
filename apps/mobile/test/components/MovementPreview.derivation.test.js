/**
 * WO-09 R2 Part A — the `derivesFrom` variant contract.
 *
 * What this file holds:
 *   - resolution rules (missing field, field equal to the base's, duplicate
 *     previewId, unknown base, derivation chain, caption keyed to a frame that
 *     does not exist, step missing / unknown / repeated / reordered);
 *   - reference sharing: the resolved frames' `joints` ARE the base's own
 *     objects (`toBe`), never copies — review finding F1;
 *   - the per-family step lists, and that this module no longer reads caption
 *     WORDS: wording is judged by review, on the rendered card (owner
 *     direction after audit Entry 0160 A1);
 *   - verification of an already-resolved record against its base, so the
 *     offline tools cannot draw a hand-flattened variant (A-C2 / A2-C4);
 *   - peak-only implement tilt: exactly one frame of a supinated variant
 *     differs from its flat drawing, and that frame is the `peak` — and a base
 *     entry can never tilt, because a base resolved entry carries no steps.
 *
 * Every expectation is computed from the live manifest pair (base 62 →
 * variant 186), never from a hand-written copy of it.
 */
import {
  previewEntries,
  rawPreviewEntries,
  buildPreviewEntry,
  deriveVariantEntry,
  isVariantEntry,
  PEAK_STEP,
  STEP_LISTS,
  stepListForBase,
  validateVariantSet,
  verifyResolvedVariant,
} from '../../src/components/movementPreview/manifest';
import {
  DUAL_BODY_PARAMETERS,
  layoutCanonicalFigure,
} from '../../src/components/movementPreview/canonicalFigure';

// R2 Part C split the preview data into an index plus one file per family; this
// suite needs the raw authoring records and every resolved entry, so it uses the
// module's own readers: `rawPreviewEntries()` and `previewEntries()`.
// The raw authoring records (the base's and variant's metadata included) live
// in the manifest - the compact family files carry the drawn data only.
const RAW = { entries: require('../../src/components/movementPreview/movementPreviewManifest.json').entries };
const rawEntryFor = (movementId) => RAW.entries.find((entry) => entry.movementId === movementId);
const PREVIEW_ENTRIES = previewEntries();

const BASE = rawEntryFor(62);
const VARIANT = rawEntryFor(186);
const PEAK_FRAME_ID = Object.keys(VARIANT.frameRoles)
  .find((frameId) => VARIANT.frameRoles[frameId] === 'peak');

/** A clone of the live variant with one change applied, for the refusal tests. */
const variantWith = (change) => ({ ...VARIANT, ...change });

const resolvedVariant = () => deriveVariantEntry(VARIANT, BASE);
const resolvedCoveredVariant = () => buildPreviewEntry({ ...VARIANT, status: 'covered' }, BASE);
const resolvedCoveredBase = () => buildPreviewEntry({ ...BASE, status: 'covered' });

const primsFor = (frame, options = {}) => layoutCanonicalFigure(frame.joints, {
  view: BASE.view,
  body: DUAL_BODY_PARAMETERS.neutral,
  assetKey: VARIANT.assetKey,
  ...options,
});
const primSignature = (frame, options = {}) => JSON.stringify(primsFor(frame, options));

describe('the live 186 variant resolves through the contract', () => {
  test('it is recognised as a variant and its base is the live Hammer Curl', () => {
    expect(isVariantEntry(VARIANT)).toBe(true);
    expect(isVariantEntry(BASE)).toBe(false);
    expect(VARIANT.derivesFrom).toBe(BASE.movementId);
  });

  test('the resolver SHARES the base joints objects by reference (never copies them)', () => {
    const resolved = resolvedVariant();
    expect(resolved.frames).toHaveLength(BASE.frames.length);
    resolved.frames.forEach((frame, i) => {
      expect(frame.joints).toBe(BASE.frames[i].joints);
      expect(frame.id).toBe(BASE.frames[i].id);
    });
  });

  test('the app boundary then normalises base and variant frames the same way', () => {
    // The resolver shares; `readEntry` then builds its own validated tuple
    // arrays for EVERY entry, base and variant alike (unchanged behaviour).
    // The variant is not special-cased and nothing is copied at derivation.
    const covered = resolvedCoveredVariant();
    expect(covered.frameData.rig).toBe('canonical');
    covered.frames.forEach((frame, i) => {
      expect(frame.joints).toEqual(BASE.frames[i].joints);
      expect(frame.joints).not.toBe(BASE.frames[i].joints);
    });
    resolvedCoveredBase().frames.forEach((frame, i) => {
      expect(frame.joints).toEqual(BASE.frames[i].joints);
      expect(frame.joints).not.toBe(BASE.frames[i].joints);
    });
  });

  test('it carries its own captions, keyed by the base frame id, one per base frame', () => {
    const resolved = resolvedVariant();
    const baseIds = BASE.frames.map((frame) => frame.id).sort();
    expect(Object.keys(VARIANT.captionOverrides).sort()).toEqual(baseIds);
    resolved.frames.forEach((frame, i) => {
      expect(frame.caption).toBe(VARIANT.captionOverrides[BASE.frames[i].id]);
      expect(frame.caption).not.toBe(BASE.frames[i].caption);
    });
  });

  test('its steps are the curl family list, in order, and every Batch 1 base is calibrated', () => {
    const { steps } = STEP_LISTS.curl;
    BASE.frames.forEach((frame, i) => {
      expect(VARIANT.frameRoles[frame.id]).toBe(steps[i]);
    });
    // Every family in play for Batch 1 has one step per authored frame, so a
    // strictly forward assignment is the whole structure — no step can be
    // skipped, repeated, or reordered.
    for (const movementId of [62, 12, 14, 19, 21, 88]) {
      const list = stepListForBase(movementId);
      expect(list).toBeDefined();
      expect(list.steps.length).toBe(rawEntryFor(movementId).frames.length);
    }
  });

  test('required fields differ from the base and the inherited ones are declared', () => {
    for (const field of ['movementId', 'name', 'assetKey', 'previewId', 'summary', 'instructions', 'cues', 'reason']) {
      expect(VARIANT[field]).toBeDefined();
      expect(VARIANT[field]).not.toEqual(BASE[field]);
    }
    expect(VARIANT.techniqueCitationsInherited).toBe(true);
    expect(VARIANT.techniqueCitations).toBeUndefined();
    const resolved = resolvedVariant();
    expect(resolved.techniqueCitations).toBe(BASE.techniqueCitations);
    expect(resolved.pattern).toBe(BASE.pattern);
    expect(resolved.view).toBe(BASE.view);
    expect(resolved.viewBox).toBe(BASE.viewBox);
  });

  test('the live entry stays pending: the derivation is not an approval', () => {
    const live = PREVIEW_ENTRIES.find((entry) => entry.movementId === 186);
    expect(live).toBeDefined();
    expect(live.status).toBe('pending');
  });
});

describe('resolution refuses a malformed variant', () => {
  test('a missing required field', () => {
    const variant = variantWith({ cues: undefined });
    expect(() => deriveVariantEntry(variant, BASE)).toThrow(/must supply cues/);
  });

  test('a required field equal to the base value', () => {
    expect(() => deriveVariantEntry(variantWith({ cues: BASE.cues }), BASE)).toThrow(/cues must not equal the base/);
    expect(() => deriveVariantEntry(variantWith({ summary: BASE.summary }), BASE)).toThrow(/summary must not equal the base/);
    expect(() => deriveVariantEntry(variantWith({ previewId: BASE.previewId }), BASE)).toThrow(/previewId must not equal the base/);
  });

  test('a duplicate previewId anywhere in the set', () => {
    const entries = RAW.entries.map((entry) => (
      entry.movementId === 186 ? variantWith({ previewId: BASE.previewId }) : entry
    ));
    expect(() => validateVariantSet(entries)).toThrow(/previewId .* is already used by movement 62/);
  });

  test('an unknown derivesFrom', () => {
    expect(() => deriveVariantEntry(variantWith({ derivesFrom: 9999 }), undefined)).toThrow(/has no base entry/);
    const entries = [...RAW.entries, { ...VARIANT, movementId: 999, derivesFrom: 4242, previewId: 'ghost' }];
    expect(() => validateVariantSet(entries)).toThrow(/has no base entry/);
  });

  test('a derivation chain (a variant of a variant)', () => {
    expect(() => deriveVariantEntry(VARIANT, VARIANT)).toThrow(/derivation chains are rejected/);
    // A base that is itself a derived variant is refused whatever it contains.
    expect(() => deriveVariantEntry(VARIANT, { movementId: 900, derivesFrom: 88 }))
      .toThrow(/derivation chains are rejected/);
  });

  test('a caption keyed to a frame that does not exist, and a base frame with no caption', () => {
    expect(() => deriveVariantEntry(
      variantWith({ captionOverrides: { ...VARIANT.captionOverrides, 'not-a-frame-6': 'Extra.' } }),
      BASE,
    )).toThrow(/not a frame of base 62/);
    const { 'full-stretch-5': dropped, ...rest } = VARIANT.captionOverrides;
    expect(() => deriveVariantEntry(variantWith({ captionOverrides: rest }), BASE)).toThrow(/no caption supplied for base frame full-stretch-5/);
  });

  test('caption wording is NOT gated by this module (owner direction, Entry 0160 A1)', () => {
    // The F2 caption on the lowering frame is accepted here on purpose: the
    // keyword floor was calibrated on curls and could not describe a carry, a
    // pulldown or a hinge. Wording is judged by review, on the rendered card.
    expect(() => deriveVariantEntry(
      variantWith({
        captionOverrides: { ...VARIANT.captionOverrides, 'lower-past-m-4': 'Hold the top position briefly.' },
      }),
      BASE,
    )).not.toThrow();
  });

  test('the step assignment is checked structurally: unknown, out of order, repeated', () => {
    expect(() => deriveVariantEntry(
      variantWith({ frameRoles: { ...VARIANT.frameRoles, 'lower-past-m-4': 'sideways' } }),
      BASE,
    )).toThrow(/lower-past-m-4: "sideways" is not a step of the curl family/);
    // Swapped steps: the second frame's step no longer comes after the first's.
    expect(() => deriveVariantEntry(
      variantWith({ frameRoles: { ...VARIANT.frameRoles, 'elbows-quiet-2': 'peak' } }),
      BASE,
    )).toThrow(/curl-to-ches-3: step "peak" does not come after the previous frame's step "peak"/);
    // A repeated step is the same failure: two frames cannot share one step.
    expect(() => deriveVariantEntry(
      variantWith({ frameRoles: { ...VARIANT.frameRoles, 'elbows-quiet-2': 'rise', 'curl-to-ches-3': 'rise' } }),
      BASE,
    )).toThrow(/curl-to-ches-3: step "rise" does not come after the previous frame's step/);
  });

  test('a base whose family has no step list is refused, not guessed', () => {
    expect(() => deriveVariantEntry(VARIANT, { ...BASE, movementId: 999 }))
      .toThrow(/base 999 has no step list; declare its family in STEP_FAMILY_BY_BASE/);
  });

  test('roles on an entry that carries no derivesFrom are refused at the app boundary', () => {
    // A hand-authored base with steps but no base pointer was never checked by
    // the resolver; the app refuses it instead of drawing it flat (A2-C2).
    expect(() => buildPreviewEntry({ ...BASE, status: 'covered', frameRoles: VARIANT.frameRoles }))
      .toThrow(/frameRoles on an entry that carries no derivesFrom/);
  });

  test('a resolved record is verified against its base, never trusted', () => {
    const resolved = resolvedVariant();
    expect(() => verifyResolvedVariant(resolved, BASE)).not.toThrow();

    // Edited joints: refused. This is the hand-flattened case the loader used
    // to draw as-is (A-C2) and the renderer had no guard against (A2-C4).
    const edited = structuredClone(resolved);
    edited.frames[2].joints = { ...edited.frames[2].joints, wr: [39.8, 30] };
    expect(() => verifyResolvedVariant(edited, BASE))
      .toThrow(/curl-to-ches-3 joints do not match the base's/);

    // Reordered steps: refused by the same rule resolution applies.
    const reordered = structuredClone(resolved);
    reordered.frameRoles['elbows-quiet-2'] = 'peak';
    expect(() => verifyResolvedVariant(reordered, BASE))
      .toThrow(/does not come after the previous frame's step/);

    // A derivation chain is refused here too.
    expect(() => verifyResolvedVariant(resolvedVariant(), VARIANT))
      .toThrow(/derivation chains are rejected/);
  });

  test('a frame role that is missing, unknown, or keyed to a frame that does not exist', () => {
    const { 'neutral-grip-1': dropped, ...rest } = VARIANT.frameRoles;
    expect(() => deriveVariantEntry(variantWith({ frameRoles: rest }), BASE)).toThrow(/no frame role for base frame neutral-grip-1/);
    expect(() => deriveVariantEntry(
      variantWith({ frameRoles: { ...VARIANT.frameRoles, 'lower-past-m-4': 'sideways' } }),
      BASE,
    )).toThrow(/is not a step of the curl family/);
    expect(() => deriveVariantEntry(
      variantWith({ frameRoles: { ...VARIANT.frameRoles, 'spare-6': 'start' } }),
      BASE,
    )).toThrow(/not a frame of base 62/);
  });

  test('an illegal implementOrientation', () => {
    expect(() => deriveVariantEntry(variantWith({ implementOrientation: 'sideways' }), BASE)).toThrow(/implementOrientation must be/);
  });

  test('an implementOrientation needs a declared peak step and exactly one frame on it', () => {
    // The live pair satisfies the rule, so the rule is not vacuous.
    expect(resolvedVariant().implementOrientation).toBe('supinated');
    expect(Object.values(VARIANT.frameRoles).filter((step) => step === PEAK_STEP)).toHaveLength(1);

    // A family that declares no peak step cannot carry an orientation at all,
    // because the tilt is applied AT the peak and nowhere else.
    const hinge = rawEntryFor(88);
    const captionsFor = (base) => Object.fromEntries(
      base.frames.map((frame) => [frame.id, `Synthetic caption for ${frame.id}.`]),
    );
    const hingeVariant = {
      movementId: 1888,
      derivesFrom: 88,
      name: 'Synthetic Hinge Variant',
      assetKey: 'movement/synthetic-hinge/demo/v1',
      previewId: 'synthetic_hinge_variant',
      summary: 'Synthetic, for the refusal only.',
      instructions: 'Synthetic, for the refusal only.',
      cues: 'Synthetic, for the refusal only.',
      reason: 'Synthetic, for the refusal only.',
      status: 'pending',
      implementOrientation: 'flat',
      techniqueCitations: ['synthetic'],
      captionOverrides: captionsFor(hinge),
      frameRoles: {
        [hinge.frames[0].id]: 'start',
        [hinge.frames[1].id]: 'hinge',
        [hinge.frames[2].id]: 'bottom',
      },
    };
    expect(() => deriveVariantEntry(hingeVariant, hinge))
      .toThrow(/the hinge family declares no "peak" step, so implementOrientation cannot be used/);
    const hingeNoOrientation = { ...hingeVariant };
    delete hingeNoOrientation.implementOrientation;
    expect(() => deriveVariantEntry(hingeNoOrientation, hinge)).not.toThrow();

    // A family list LONGER than the frame count can step over the peak. That is
    // the case the explicit count check exists for: the pulldown family on a
    // three-frame base whose steps stop before the peak.
    const pulldown = rawEntryFor(21);
    const pulldownBase = { ...pulldown, frames: pulldown.frames.slice(0, 3) };
    const skipPeak = {
      ...hingeVariant,
      movementId: 121,
      derivesFrom: 21,
      name: 'Synthetic Pulldown Variant',
      assetKey: 'movement/synthetic-pulldown/demo/v1',
      previewId: 'synthetic_pulldown_variant',
      captionOverrides: captionsFor(pulldownBase),
      frameRoles: {
        [pulldownBase.frames[0].id]: 'reach',
        [pulldownBase.frames[1].id]: 'set',
        [pulldownBase.frames[2].id]: 'pull-1',
      },
    };
    expect(() => deriveVariantEntry(skipPeak, pulldownBase))
      .toThrow(/implementOrientation "flat" requires exactly one frame with role "peak", found 0/);

    // Two peaks can no longer be expressed at all: a repeated step fails the
    // forward rule before any count is taken.
    expect(() => deriveVariantEntry(
      variantWith({ frameRoles: { ...VARIANT.frameRoles, 'elbows-quiet-2': PEAK_STEP } }),
      BASE,
    )).toThrow(/does not come after the previous frame's step/);
  });

  test('inherited techniqueCitations without the declaration', () => {
    expect(() => deriveVariantEntry(variantWith({ techniqueCitationsInherited: false }), BASE))
      .toThrow(/must be declared with techniqueCitationsInherited: true/);
  });
});

describe('the implement tilt belongs to the peak frame only', () => {
  test('a base entry can never tilt: it resolves with no roles and no orientation', () => {
    const covered = resolvedCoveredBase();
    expect(covered.frameRoles).toBeUndefined();
    expect(covered.implementOrientation).toBeUndefined();
  });

  test('the variant resolves with exactly one peak frame and a supinated orientation', () => {
    const covered = resolvedCoveredVariant();
    const peakIds = Object.entries(covered.frameRoles)
      .filter(([, role]) => role === 'peak')
      .map(([frameId]) => frameId);
    expect(peakIds).toEqual([PEAK_FRAME_ID]);
    expect(covered.implementOrientation).toBe('supinated');
  });

  test('stable bell primitives tilt at the peak while preserving all body geometry', () => {
    const covered = resolvedCoveredVariant();
    const differing = [];
    covered.frames.forEach((frame, i) => {
      const flat = primsFor(BASE.frames[i]);
      const variant = primsFor(BASE.frames[i], {
        role: covered.frameRoles[frame.id],
        implementOrientation: covered.implementOrientation,
      });
      const bells = variant.filter(p => p.kind === 'bone' && p.w === 4.6);
      expect(bells).toHaveLength(2);
      if (bells.some(p => Math.abs(p.y2 - p.y1) > 1e-9)) differing.push(frame.id);
      expect(variant.filter(p => !(p.kind === 'bone' && p.w === 4.6)))
        .toEqual(flat.filter(p => !(p.kind === 'rect' && p.w === 13 && p.h === 4.6)));
    });
    expect(differing).toEqual([PEAK_FRAME_ID]);
  });

  test('the peak frame draws the tilted bell at the expected rise; the flat frames do not', () => {
    const covered = resolvedCoveredVariant();
    const peakIndex = covered.frames.findIndex((frame) => frame.id === PEAK_FRAME_ID);
    const expectedRise = 2 * 6.5 * Math.tan((15 * Math.PI) / 180);
    const bellBones = (prims) => prims.filter(
      (prim) => prim.kind === 'bone' && prim.w === 4.6 && Math.abs(Math.abs(prim.y2 - prim.y1) - expectedRise) < 1e-9,
    );
    const tilted = primsFor(BASE.frames[peakIndex], {
      role: covered.frameRoles[PEAK_FRAME_ID],
      implementOrientation: covered.implementOrientation,
    });
    // Two tilted bells: the near one at full opacity, the far one dimmed.
    expect(bellBones(tilted)).toHaveLength(2);
    for (const index of covered.frames.map((_, i) => i).filter((i) => i !== peakIndex)) {
      expect(bellBones(primsFor(BASE.frames[index]))).toHaveLength(0);
    }
  });

  test('the orientation is required as well as the role: a supinated variant without orientation stays flat', () => {
    const covered = resolvedCoveredVariant();
    const peakIndex = covered.frames.findIndex((frame) => frame.id === PEAK_FRAME_ID);
    expect(primSignature(BASE.frames[peakIndex], { role: 'peak' })).toBe(primSignature(BASE.frames[peakIndex]));
    for (const role of [undefined, 'lower']) {
      const bells = primsFor(BASE.frames[peakIndex], { role, implementOrientation: 'supinated' })
        .filter(p => p.kind === 'bone' && p.w === 4.6);
      expect(bells).toHaveLength(2);
      expect(bells.every(p => p.y1 === p.y2)).toBe(true);
    }
  });

  test('the base Hammer Curl drawing is untouched by the contract', () => {
    // 62 is drawn by its own slug branch (vertical bells), and 186 by the
    // generic dumbbells branch. Drawing the BASE at the BASE's own assetKey
    // must not move a single primitive, contract present or not.
    const atBaseSlug = (frame, opts = {}) => JSON.stringify(layoutCanonicalFigure(frame.joints, {
      view: BASE.view, body: DUAL_BODY_PARAMETERS.neutral, assetKey: BASE.assetKey, ...opts,
    }));
    for (const frame of BASE.frames) {
      expect(atBaseSlug(frame, { role: 'peak', implementOrientation: 'supinated' })).toBe(atBaseSlug(frame));
    }
    const baseSlugPrims = layoutCanonicalFigure(BASE.frames[2].joints, {
      view: BASE.view,
      body: DUAL_BODY_PARAMETERS.neutral,
      assetKey: BASE.assetKey,
    });
    // Hammer Curl draws its bells as axis-aligned rects, never as tilted bones.
    expect(baseSlugPrims.filter((prim) => prim.kind === 'rect').length).toBeGreaterThan(0);
  });
});

describe('the declared implement count (Stage 2 Batch 1)', () => {
  test('an illegal implementCount is refused', () => {
    expect(() => deriveVariantEntry(variantWith({ implementCount: 3 }), BASE))
      .toThrow(/implementCount must be one of 1\|2/);
    expect(() => deriveVariantEntry(variantWith({ implementCount: '1' }), BASE))
      .toThrow(/implementCount must be one of 1\|2/);
  });

  test('a declared count on a movement with no implement is refused, not drawn as a no-op', () => {
    const noImplement = { ...BASE, equipment: 'none' };
    expect(() => deriveVariantEntry(variantWith({ implementCount: 1 }), noImplement))
      .toThrow(/implementCount requires a held implement; "none" is not one/);
    // The live pair holds dumbbells, so the rule is not vacuous there: the same
    // variant derives cleanly and the count rides the resolved record.
    expect(deriveVariantEntry(variantWith({ implementCount: 1 }), BASE).implementCount).toBe(1);
  });

  test('20 Suitcase Carry draws ONE bell on the near wrist; its base 19 draws two', () => {
    const carry = rawEntryFor(19);
    const suitcase = rawEntryFor(20);
    expect(suitcase.implementCount).toBe(1);
    const optionFor = (entry) => ({
      view: entry.view ?? 'side',
      body: DUAL_BODY_PARAMETERS.neutral,
      assetKey: entry.assetKey,
      implementCount: entry.implementCount,
      implementScale: entry.implementScale,
    });
    // Owner correction 2026-09-25 (Entry 0171): carry bells hang below the grip
    // as a 4.6 x 13 vertical dumbbell at the declared scale, so they read as held
    // beside the thigh and stay inside the card. Count the shape the carry
    // branch actually draws, at the entry's scale.
    const carryScale = carry.implementScale ?? 1;
    const bells = (prims) => prims.filter((prim) => prim.kind === 'rect'
      && Math.abs(prim.w - 4.6 * carryScale) < 0.02
      && Math.abs(prim.h - 13 * carryScale) < 0.02);
    for (const frame of carry.frames) {
      expect(bells(layoutCanonicalFigure(frame.joints, optionFor(carry)))).toHaveLength(2);
      const one = bells(layoutCanonicalFigure(frame.joints, optionFor(suitcase)));
      expect(one).toHaveLength(1);
      // The surviving bell hangs on the NEAR wrist, never the far one (compared
      // on the bell's x centre, since it hangs below the hand).
      const centre = one[0].x + (4.6 * carryScale) / 2;
      expect(Math.abs(centre - frame.joints.wr[0])).toBeLessThan(7);
      expect(Math.abs(centre - frame.joints.wf[0])).toBeGreaterThan(7);
    }
  });

  test('a resolved record may carry the count, and a bad value is refused on it too', () => {
    const resolved = deriveVariantEntry(rawEntryFor(20), rawEntryFor(19));
    expect(resolved.implementCount).toBe(1);
    const tampered = { ...resolved, implementCount: 4 };
    expect(() => verifyResolvedVariant(tampered, rawEntryFor(19)))
      .toThrow(/implementCount must be one of 1\|2/);
  });
});
