/**
 * derivation.ts — the WO-09 motion-family variant contract (R2 Part A).
 *
 * ONE implementation of the `derivesFrom` rules, shared by every consumer the
 * same way `canonicalFigure.ts` is: the app imports it (manifest.ts applies it
 * at manifest load), and the evidence tools compile it with tsc so the
 * prototype and the gate derive a variant with the SAME code. Review finding
 * F1 was a hand-flattened copy: a variant must never be flattened by hand.
 *
 * This module is a pure function library over plain objects. Its only runtime
 * import is the drawing module canonicalFigure.ts (see the jointOffsets note
 * below), which itself imports nothing at runtime, so the pair still compiles
 * standalone for the offline tooling.
 *
 * A variant is an entry that names a base (`derivesFrom`). Resolution:
 *
 *   - it resolves ONCE, when its data loads;
 *   - the resolved record SHARES the base's `joints` objects by reference —
 *     they are never copied (asserted with `===` in the tests);
 *   - it must SUPPLY `movementId`, `name`, `assetKey`, `previewId`, `summary`,
 *     `instructions`, `cues` and `reason`, and each must differ from the
 *     base's value. Resolution fails otherwise;
 *   - it may INHERIT `pattern`, `equipment`, `view`, `viewBox` and
 *     `segmentDurationsMs` unless it overrides them;
 *   - `techniqueCitations` may be inherited only when the record declares it
 *     (`techniqueCitationsInherited: true`);
 *   - captions are keyed by the BASE's frame `id` (never by position), one per
 *     base frame, and each must be a non-empty string;
 *   - `frameRoles` maps every base frame id to exactly one step of the base's
 *     movement FAMILY (see STEP_LISTS). The step assignment is structural and
 *     must run forward through the family's ordered list: no unknown step, no
 *     step repeated, no step before the previous frame's step. What a caption
 *     SAYS is judged by review, never by a word list here (owner direction
 *     after audit Entry 0160 A1: the old keyword floor was calibrated on curls
 *     and could not describe a carry, a pulldown or a hinge);
 *   - setting `implementOrientation` at all requires exactly one frame with
 *     role `peak`: the tilt is applied at the peak and nowhere else, so an
 *     orientation can never quietly draw flat on every frame;
 *   - it may declare `implementCount` (1 or 2) only where the movement holds
 *     an implement: 20 Suitcase Carry holds ONE bell, so only the near hand
 *     draws a bell and the far hand stays empty. A count declared on a
 *     movement with no implement is refused rather than drawn as a no-op;
 *   - a derivation chain (a variant of a variant) is rejected;
 *   - it may declare `gripDelta` (Batch 1, B1-300; owner ruling Entry 0175):
 *     a grip change per hand, front view only, applied at DRAW time by
 *     canonicalFigure's resolveGripArms (wrist x moved, elbow re-solved with
 *     the frame's own drawn lengths). Refused on a base, on a side view, on a
 *     grip x beyond reach and on an elbow path that jumps;
 *   - it may declare `jointOffsets` (Batch 1, B1-55; owner ruling Entry 0175):
 *     a constant, additive [dx, dy] per joint, applied at DRAW time so the
 *     frames' `joints` stay the base's own objects. Variant-only; the planted
 *     contacts `an`/`af` and unknown joints are refused; and every keyframe's
 *     DRAWN segment (canonicalFigure's `drawnSegmentLengths`, all three body
 *     parameter sets) must stay within 5% of the base frame's own.
 *
 * The drawn-length rule is the one runtime import: it measures with the drawing
 * module itself (canonicalFigure.ts, which imports nothing at runtime), so the
 * contract can never judge a length the renderer does not draw.
 *
 * A record that carries BOTH `derivesFrom` and frames is an ALREADY RESOLVED
 * variant (the prototype's render input, for example). The offline tools verify
 * such a record against its base with `verifyResolvedVariant` instead of
 * trusting it, so a hand-flattened variant with edited joints or reordered
 * steps is refused exactly as resolution would refuse it.
 */

import {
  CANONICAL_BODY_PARAMETERS, drawnSegmentLengths, resolveFigureJoints, resolveGripArms,
} from './canonicalFigure';
import type { CanonicalPose, ViewName } from './canonicalFigure';

export type FrameRole = string;

/**
 * The step an implement orientation applies to. Named `peak` by convention in
 * every family that has one, so the drawing gate stays a string compare.
 */
export const PEAK_STEP = 'peak';

/** One movement family's ordered steps. */
export interface StepList {
  /** Family name, used in error text. */
  readonly family: string;
  /** Every step of the family, in movement order. */
  readonly steps: readonly string[];
  /**
   * The peak step when the family has one. A family without a peak step cannot
   * carry an implement orientation, because the tilt is applied AT the peak.
   */
  readonly peak?: string;
}

/**
 * The step lists, one per movement family, calibrated on the authored base
 * movements' own drawn positions. A base earns a list when it exists; a variant
 * of a base whose family has no list is refused at resolution, loudly, so no
 * variant can be authored against an undeclared family.
 */
export const STEP_LISTS: Readonly<Record<string, StepList>> = {
  curl: { family: 'curl', steps: ['start', 'rise', 'peak', 'lower', 'return'], peak: PEAK_STEP },
  row: { family: 'row', steps: ['reach', 'drive', 'peak', 'lower', 'return'], peak: PEAK_STEP },
  squat: { family: 'squat', steps: ['start', 'descend', 'bottom', 'drive', 'return'] },
  carry: {
    family: 'carry',
    steps: ['start', 'step-1', 'step-2', 'step-3', 'step-4', 'step-5', 'step-6', 'step-7', 'finish'],
  },
  pulldown: {
    family: 'pulldown',
    steps: [
      'reach', 'set', 'pull-1', 'pull-2', 'pull-3', 'pull-4', 'peak',
      'return-1', 'return-2', 'return-3', 'return-4', 'return-5', 'finish',
    ],
    peak: PEAK_STEP,
  },
  hinge: { family: 'hinge', steps: ['start', 'hinge', 'bottom'] },
  // Batch 1 (B1-113, owner re-base Entry 0175): base 9 Romanian Deadlift draws
  // the whole hinge cycle in 5 positions (stand, hinge, bottom, drive, stand),
  // so it needs its own list. The 3-step `hinge` list above belongs to legacy
  // base 88 (the old 9-joint WO-09A rig, down-phase only) and is unchanged.
  'hinge-return': {
    family: 'hinge-return',
    steps: ['start', 'hinge', 'bottom', 'drive', 'return'],
  },
};

/** Which family each authored base movement belongs to. */
export const STEP_FAMILY_BY_BASE: Readonly<Record<number, string>> = {
  62: 'curl',
  12: 'row',
  14: 'squat',
  19: 'carry',
  21: 'pulldown',
  88: 'hinge',
  9: 'hinge-return',
};

/** A base movement's step list, or undefined when its family has none yet. */
export function stepListForBase(movementId: unknown): StepList | undefined {
  const family = STEP_FAMILY_BY_BASE[movementId as number];
  return family === undefined ? undefined : STEP_LISTS[family];
}

/** Implement orientations a variant may request. Base entries draw 'flat'. */
export type ImplementOrientation = 'flat' | 'supinated';

export const IMPLEMENT_ORIENTATIONS: readonly ImplementOrientation[] = ['flat', 'supinated'];

/** Implement counts a variant may declare. Omitted means the slug's default. */
export type ImplementCount = 1 | 2;

export const IMPLEMENT_COUNTS: readonly ImplementCount[] = [1, 2];

/** Owner batch (B1-20-R2): the range a declared implement scale may sit in. */
export const IMPLEMENT_SCALE_MIN = 1;
export const IMPLEMENT_SCALE_MAX = 2;
/** Owner batch (B1-20-R2): the most a front-view body turn may be asked for. */
export const BODY_TURN_MAX_DEG = 30;

/**
 * Batch 1 (B1-55, owner ruling Entry 0175): the joints a variant may offset.
 * The ankles `an`/`af` are the planted contacts and are never offset.
 */
export const OFFSET_JOINTS = ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'kf', 'b'] as const;
export type OffsetJoint = typeof OFFSET_JOINTS[number];
/** A constant, additive [dx, dy] per joint, in box units. */
export type JointOffsets = Readonly<Partial<Record<OffsetJoint, readonly [number, number]>>>;
const PLANTED_CONTACT_JOINTS: readonly string[] = ['an', 'af'];
/** The most a declared offset may change any drawn segment of a keyframe. */
export const JOINT_OFFSET_MAX_SEGMENT_CHANGE = 0.05;

/**
 * Validate the SHAPE of a declared `jointOffsets` value and return it typed.
 * Shared by variant resolution and the app boundary (manifest.ts), so the two
 * can never disagree on which joints may move. Refuses a non-object or empty
 * value, a planted contact (`an`/`af`), an unknown joint, a value that is not
 * two finite numbers, and a [0, 0] offset (a declared change that never draws).
 */
export function readJointOffsetsShape(where: string, value: unknown): JointOffsets {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(where, 'jointOffsets must be an object of joint -> [dx, dy]');
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length === 0) fail(where, 'jointOffsets must declare at least one joint');
  const out: Partial<Record<OffsetJoint, readonly [number, number]>> = {};
  for (const key of keys) {
    if (PLANTED_CONTACT_JOINTS.includes(key)) {
      fail(where, `jointOffsets.${key}: the planted contacts (an, af) cannot be offset`);
    }
    if (!(OFFSET_JOINTS as readonly string[]).includes(key)) {
      fail(where, `jointOffsets.${key} is not a joint that may be offset (${OFFSET_JOINTS.join(' | ')})`);
    }
    const pair = record[key];
    if (!Array.isArray(pair) || pair.length !== 2
      || typeof pair[0] !== 'number' || typeof pair[1] !== 'number'
      || !Number.isFinite(pair[0]) || !Number.isFinite(pair[1])) {
      fail(where, `jointOffsets.${key} must be [dx, dy], two finite numbers`);
    }
    if (pair[0] === 0 && pair[1] === 0) {
      fail(where, `jointOffsets.${key} is [0, 0]: a declared offset must move the joint`);
    }
    out[key as OffsetJoint] = [pair[0], pair[1]];
  }
  return out;
}

/**
 * The full `jointOffsets` rule for a variant against its base frames: the shape
 * rule above, every offset joint present on every base frame (an offset of a
 * joint the frames do not carry would draw nothing), and every keyframe's
 * DRAWN segment within 5% of the base frame's own drawn length, for all three
 * body parameter sets. The base is measured with its own asset key and no
 * offsets, exactly as it draws.
 */
function checkJointOffsets(
  where: string,
  entry: RawVariantLike,
  base: RawVariantLike,
): void {
  const offsets = readJointOffsetsShape(where, entry.jointOffsets);
  const frames = base.frames as { id: string; joints: Record<string, unknown> }[];
  if (frames[0].joints.nk === undefined) {
    fail(where, `jointOffsets need a canonical base; base ${String(base.movementId)} is drawn on the legacy rig`);
  }
  for (const joint of Object.keys(offsets)) {
    const missing = frames.find((frame) => frame.joints[joint] === undefined);
    if (missing !== undefined) {
      fail(where, `jointOffsets.${joint}: base frame ${missing.id} carries no ${joint} joint`);
    }
  }
  const view = (entry.view !== undefined ? entry.view : base.view) as ViewName;
  for (const frame of frames) {
    const pose = frame.joints as unknown as CanonicalPose;
    const body = CANONICAL_BODY_PARAMETERS;
    const own = drawnSegmentLengths(pose, { view, body, assetKey: String(base.assetKey) });
    const drawn = drawnSegmentLengths(pose, {
      view, body, assetKey: String(entry.assetKey), jointOffsets: offsets,
    });
    for (const segment of Object.keys(own)) {
      const reference = own[segment];
      const change = reference > 0
        ? Math.abs(drawn[segment] - reference) / reference
        : (drawn[segment] > 0 ? Infinity : 0);
      if (change > JOINT_OFFSET_MAX_SEGMENT_CHANGE) {
        fail(where,
          `jointOffsets change the drawn ${segment} of frame ${frame.id} (neutral) from ${reference.toFixed(3)} to ${drawn[segment].toFixed(3)}, more than ${JOINT_OFFSET_MAX_SEGMENT_CHANGE * 100}%`);
      }
    }
  }
}

/**
 * Batch 1 (B1-300, owner ruling Entry 0175): the most a grip change may raise
 * the largest keyframe-to-keyframe elbow step above the base's own largest one.
 * Set from measurement on base 21 (largest drawn elbow step 5.946): a wider grip
 * of +3 / +4 per hand measures 1.13 / 1.19x on all three bodies, and every close
 * grip that folds the elbow inside the shoulder (the dropped 169 Close-Grip,
 * -3 and narrower) measures 1.53x or more, so 1.5 admits the first and refuses
 * the second.
 */
export const GRIP_ELBOW_STEP_MAX_FACTOR = 1.5;

/**
 * Validate the SHAPE of a declared `gripDelta` (B1-300): a finite, non-zero
 * number of box units per hand. Shared by variant resolution and the app
 * boundary (manifest.ts), so the two can never disagree.
 */
export function readGripDeltaShape(where: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(where, 'gripDelta must be a finite number of box units per hand');
  }
  if (value === 0) fail(where, 'gripDelta is 0: a declared grip change must move the hands');
  return value as number;
}

/**
 * The full `gripDelta` rule for a variant against its base frames: the shape
 * rule, a front view (the grip is a width across the picture), a canonical
 * base, every keyframe's moved grip x within the arm's full reach for all three
 * bodies, and no keyframe-to-keyframe elbow step above
 * GRIP_ELBOW_STEP_MAX_FACTOR times the base's own largest. It measures with the
 * drawing module's own resolveGripArms, so the contract judges exactly what is
 * drawn.
 */
function checkGripDelta(
  where: string,
  entry: RawVariantLike,
  base: RawVariantLike,
): void {
  const delta = readGripDeltaShape(where, entry.gripDelta);
  const view = (entry.view !== undefined ? entry.view : base.view) as ViewName;
  if (view !== 'front') {
    fail(where, `gripDelta is a front-view override; this movement is drawn ${JSON.stringify(view)}`);
  }
  const frames = base.frames as { id: string; joints: Record<string, unknown> }[];
  if (frames[0].joints.nk === undefined) {
    fail(where, `gripDelta needs a canonical base; base ${String(base.movementId)} is drawn on the legacy rig`);
  }
  const offsets = entry.jointOffsets === undefined
    ? undefined : readJointOffsetsShape(where, entry.jointOffsets);
  const dist = (a: readonly number[], b: readonly number[]): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const body = CANONICAL_BODY_PARAMETERS;
  let baseStep = 0;
  let step = { size: 0, arm: '', from: '', to: '' };
  let previous: { id: string; own: { el: readonly number[]; ef: readonly number[] };
    drawn: { el: readonly number[]; ef: readonly number[] } } | undefined;
  for (const frame of frames) {
    const pose = frame.joints as unknown as CanonicalPose;
    const own = resolveFigureJoints(pose, { view, body, assetKey: String(base.assetKey), jointOffsets: offsets });
    const grip = resolveGripArms(own, delta);
    for (const [arm, solution, shoulder] of [
      ['near', grip.near, own.nArm], ['far', grip.far, own.fArm],
    ] as const) {
      if (!solution.reachable) {
        const reach = dist(shoulder, arm === 'near' ? own.el : own.ef)
          + dist(arm === 'near' ? own.el : own.ef, arm === 'near' ? own.wr : own.wf);
        fail(where,
          `gripDelta ${delta} puts the ${arm} grip of frame ${frame.id} (neutral) beyond the arm's full reach of ${reach.toFixed(3)}`);
      }
    }
    const drawn = { el: grip.near.el, ef: grip.far.el };
    if (previous !== undefined) {
      baseStep = Math.max(baseStep, dist(previous.own.el, own.el), dist(previous.own.ef, own.ef));
      for (const arm of ['el', 'ef'] as const) {
        const size = dist(previous.drawn[arm], drawn[arm]);
        if (size > step.size) step = { size, arm: arm === 'el' ? 'near' : 'far', from: previous.id, to: frame.id };
      }
    }
    previous = { id: frame.id, own, drawn };
  }
  if (step.size > GRIP_ELBOW_STEP_MAX_FACTOR * baseStep) {
    fail(where,
      `gripDelta ${delta} moves the ${step.arm} elbow ${step.size.toFixed(3)} between keyframes ${step.from} and ${step.to} (neutral), more than ${GRIP_ELBOW_STEP_MAX_FACTOR}x the base's largest keyframe elbow step ${baseStep.toFixed(3)}`);
  }
}

/** Fields a variant must supply, each different from the base's value. */
export const REQUIRED_VARIANT_FIELDS: readonly string[] = [
  'movementId', 'name', 'assetKey', 'previewId', 'summary', 'instructions', 'cues', 'reason',
];

/** Fields a variant may inherit from its base unless it overrides them. */
export const INHERITABLE_FIELDS: readonly string[] = [
  'pattern', 'equipment', 'view', 'viewBox', 'segmentDurationsMs',
];

export interface RawVariantLike {
  derivesFrom?: unknown;
  [field: string]: unknown;
}

/** True when this raw entry is a derived variant. */
export function isVariantEntry(raw: unknown): boolean {
  return raw !== null && typeof raw === 'object'
    && (raw as RawVariantLike).derivesFrom !== undefined;
}

function fail(where: string, message: string): never {
  throw new Error(`${where}: ${message}`);
}

/**
 * Check a step assignment against a family's ordered list. Shared by variant
 * resolution and by the verification of an already-resolved record, so a
 * resolved record can never carry a structure that resolution would refuse.
 * Throws on the first violation; returns the assignment keyed by frame id.
 */
function checkStepAssignment(
  where: string,
  familyList: StepList,
  baseFrameIds: readonly string[],
  roles: Record<string, unknown>,
  captions: Record<string, unknown>,
): Record<string, FrameRole> {
  const frameRoles: Record<string, FrameRole> = {};
  let previousStep = -1;
  for (const frameId of baseFrameIds) {
    const role = roles[frameId];
    if (typeof role !== 'string' || role.trim().length === 0) {
      fail(where, `frame ${frameId}: step must be a non-empty string`);
    }
    const step = role as string;
    const index = familyList.steps.indexOf(step);
    if (index === -1) {
      fail(where,
        `frame ${frameId}: ${JSON.stringify(step)} is not a step of the ${familyList.family} family (${familyList.steps.join(' | ')})`);
    }
    if (index <= previousStep) {
      fail(where,
        `frame ${frameId}: step ${JSON.stringify(step)} does not come after the previous frame's step ${JSON.stringify(familyList.steps[previousStep])}`);
    }
    previousStep = index;
    const caption = captions[frameId];
    if (typeof caption !== 'string' || caption.trim().length === 0) {
      fail(where, `caption for frame ${frameId} must be a non-empty string`);
    }
    frameRoles[frameId] = step;
  }
  return frameRoles;
}

/**
 * Derive one variant's resolved record from its base. Throws on any contract
 * violation, so a malformed variant is a loud load failure rather than a wrong
 * drawing. The returned record is covered-entry-shaped: it carries `frames`
 * whose `joints` are the BASE's own objects, with the variant's captions.
 */
/**
 * Validate a declared implement count. `undefined` means the slug's own
 * default and is always allowed. A declared count follows the same
 * silent-no-op rule as the orientation check: a count on a movement that holds
 * no implement would claim a drawing that never happens, so it is refused.
 */
function checkImplementCount(
  where: string,
  value: unknown,
  entry: RawVariantLike,
  base: RawVariantLike,
): void {
  if (value === undefined) return;
  if (typeof value !== 'number' || !IMPLEMENT_COUNTS.includes(value as ImplementCount)) {
    fail(where, `implementCount must be one of ${IMPLEMENT_COUNTS.join('|')}`);
  }
  const equipment = entry.equipment !== undefined ? entry.equipment : base.equipment;
  if (equipment === undefined || equipment === 'none') {
    fail(where, `implementCount requires a held implement; ${JSON.stringify(equipment)} is not one`);
  }
}

/**
 * Validate the drawing overrides a movement may declare on top of the rig:
 * `implementScale` (how large a held implement is drawn) and `bodyTurnDeg` (a
 * front-view body turn). Both follow the silent-no-op rule: a scale on a
 * movement that holds no implement, or a turn on a movement drawn side-on,
 * would claim a drawing that never happens. Unlike `implementCount` these may
 * legitimately sit on a BASE entry (owner ruling 2026-09-24: base 19's own
 * bells are bigger and 20 inherits them), so base and variant run the same
 * check — which is also what closes B1-20-C2, where a base entry could carry
 * the field through an unchecked cast.
 */
function checkDrawingOverrides(
  where: string,
  entry: RawVariantLike,
  base: RawVariantLike | undefined,
): void {
  const scale = entry.implementScale;
  if (scale !== undefined) {
    if (typeof scale !== 'number'
      || !(scale >= IMPLEMENT_SCALE_MIN && scale <= IMPLEMENT_SCALE_MAX)) {
      fail(where,
        `implementScale must be a number between ${IMPLEMENT_SCALE_MIN} and ${IMPLEMENT_SCALE_MAX}`);
    }
    const equipment = entry.equipment !== undefined ? entry.equipment : base?.equipment;
    if (equipment === undefined || equipment === 'none') {
      fail(where, `implementScale requires a held implement; ${JSON.stringify(equipment)} is not one`);
    }
  }
  const turn = entry.bodyTurnDeg;
  if (turn !== undefined) {
    if (typeof turn !== 'number' || !(turn > 0 && turn <= BODY_TURN_MAX_DEG)) {
      fail(where, `bodyTurnDeg must be a number above 0 and at most ${BODY_TURN_MAX_DEG}`);
    }
    const view = entry.view !== undefined ? entry.view : base?.view;
    if (view !== 'front') {
      fail(where,
        `bodyTurnDeg is a front-view override; this movement is drawn ${JSON.stringify(view)}`);
    }
  }
}

export function deriveVariantEntry(
  rawVariant: RawVariantLike,
  rawBase: RawVariantLike | undefined,
): Record<string, unknown> {
  const where = `movement preview ${String(rawVariant.movementId)}`;
  if (rawBase === undefined) {
    fail(where, `derivesFrom ${String(rawVariant.derivesFrom)} has no base entry in the manifest`);
  }
  const base = rawBase as RawVariantLike;
  if (isVariantEntry(base)) {
    fail(where, `derivesFrom ${String(rawVariant.derivesFrom)} is itself a derived variant; derivation chains are rejected`);
  }
  const baseFrames = base.frames;
  if (!Array.isArray(baseFrames) || baseFrames.length === 0) {
    fail(where, `base ${String(base.movementId)} has no frames to derive from`);
  }
  const frames = baseFrames as { id: string; caption: string; joints: unknown }[];
  const baseFrameIds = frames.map((frame) => frame.id);

  for (const field of REQUIRED_VARIANT_FIELDS) {
    const value = rawVariant[field];
    if (value === undefined || value === null
      || (typeof value === 'string' && value.trim().length === 0)) {
      fail(where, `variant must supply ${field}`);
    }
    if (value === base[field]) {
      fail(where, `${field} must not equal the base's value`);
    }
  }

  const overrides = rawVariant.captionOverrides;
  if (overrides === null || typeof overrides !== 'object' || Array.isArray(overrides)) {
    fail(where, 'variant must supply captionOverrides keyed by base frame id');
  }
  const captions = overrides as Record<string, unknown>;
  for (const frameId of baseFrameIds) {
    if (!Object.prototype.hasOwnProperty.call(captions, frameId)) {
      fail(where, `no caption supplied for base frame ${frameId}`);
    }
  }
  for (const key of Object.keys(captions)) {
    if (!baseFrameIds.includes(key)) {
      fail(where, `caption keyed to ${key}, which is not a frame of base ${String(base.movementId)}`);
    }
  }

  const rawRoles = rawVariant.frameRoles;
  if (rawRoles === null || typeof rawRoles !== 'object' || Array.isArray(rawRoles)) {
    fail(where, 'variant must supply frameRoles keyed by base frame id');
  }
  const roles = rawRoles as Record<string, unknown>;
  for (const frameId of baseFrameIds) {
    if (!Object.prototype.hasOwnProperty.call(roles, frameId)) {
      fail(where, `no frame role for base frame ${frameId}`);
    }
  }
  for (const key of Object.keys(roles)) {
    if (!baseFrameIds.includes(key)) {
      fail(where, `frame role keyed to ${key}, which is not a frame of base ${String(base.movementId)}`);
    }
  }
  const family = stepListForBase(base.movementId);
  if (family === undefined) {
    fail(where,
      `base ${String(base.movementId)} has no step list; declare its family in STEP_FAMILY_BY_BASE before authoring a variant of it`);
  }
  const familyList = family as StepList;
  if (baseFrameIds.length > familyList.steps.length) {
    fail(where,
      `base ${String(base.movementId)} has ${baseFrameIds.length} frames but the ${familyList.family} family lists ${familyList.steps.length} steps`);
  }
  const frameRoles = checkStepAssignment(where, familyList, baseFrameIds, roles, captions);

  const orientation = rawVariant.implementOrientation;
  if (orientation !== undefined && !IMPLEMENT_ORIENTATIONS.includes(orientation as ImplementOrientation)) {
    fail(where, `implementOrientation must be one of ${IMPLEMENT_ORIENTATIONS.join('|')}`);
  }
  // An implement orientation is a statement about ONE drawn frame — the tilt is
  // applied at the peak and nowhere else. A variant that sets an orientation
  // without a peak frame would draw flat on every frame while claiming
  // otherwise in its own record, so the combination is refused here rather
  // than rendered as a silent no-op.
  if (orientation !== undefined) {
    if (familyList.peak === undefined) {
      fail(where,
        `the ${familyList.family} family declares no ${JSON.stringify(PEAK_STEP)} step, so implementOrientation cannot be used`);
    }
    const peaks = baseFrameIds.filter((frameId) => frameRoles[frameId] === familyList.peak);
    if (peaks.length !== 1) {
      fail(where,
        `implementOrientation ${JSON.stringify(orientation)} requires exactly one frame with role ${JSON.stringify(familyList.peak)}, found ${peaks.length}`);
    }
  }

  checkImplementCount(where, rawVariant.implementCount, rawVariant, base);
  checkDrawingOverrides(where, rawVariant, base);
  if (rawVariant.jointOffsets !== undefined) checkJointOffsets(where, rawVariant, base);
  if (rawVariant.gripDelta !== undefined) checkGripDelta(where, rawVariant, base);

  let citations: unknown;
  if (rawVariant.techniqueCitations !== undefined) {
    if (!Array.isArray(rawVariant.techniqueCitations)
      || rawVariant.techniqueCitations.some((c) => typeof c !== 'string')) {
      fail(where, 'techniqueCitations must be an array of strings');
    }
    citations = rawVariant.techniqueCitations;
  } else {
    if (base.techniqueCitations === undefined) {
      fail(where, 'no techniqueCitations on the base and none supplied');
    }
    if (rawVariant.techniqueCitationsInherited !== true) {
      fail(where, 'inherited techniqueCitations must be declared with techniqueCitationsInherited: true');
    }
    citations = base.techniqueCitations;
  }

  const derived: Record<string, unknown> = {
    movementId: rawVariant.movementId,
    assetKey: rawVariant.assetKey,
    name: rawVariant.name,
    previewId: rawVariant.previewId,
    summary: rawVariant.summary,
    instructions: rawVariant.instructions,
    cues: rawVariant.cues,
    reason: rawVariant.reason,
    status: rawVariant.status ?? 'pending',
    derivesFrom: base.movementId,
    frameRoles,
    techniqueCitations: citations,
    // The variant's own caption text over the base's own joint objects.
    frames: frames.map((frame) => ({ id: frame.id, caption: captions[frame.id], joints: frame.joints })),
  };
  if (orientation !== undefined) derived.implementOrientation = orientation;
  if (rawVariant.implementCount !== undefined) derived.implementCount = rawVariant.implementCount;
  if (rawVariant.implementScale !== undefined) derived.implementScale = rawVariant.implementScale;
  if (rawVariant.bodyTurnDeg !== undefined) derived.bodyTurnDeg = rawVariant.bodyTurnDeg;
  if (rawVariant.jointOffsets !== undefined) derived.jointOffsets = rawVariant.jointOffsets;
  if (rawVariant.gripDelta !== undefined) derived.gripDelta = rawVariant.gripDelta;
  if (rawVariant.coachingIntent !== undefined) derived.coachingIntent = rawVariant.coachingIntent;
  for (const field of INHERITABLE_FIELDS) {
    const value = rawVariant[field] !== undefined ? rawVariant[field] : base[field];
    if (value !== undefined) derived[field] = value;
  }
  return derived;
}

/**
 * Verify a record that carries BOTH `derivesFrom` and frames — an already
 * resolved variant, such as the prototype's render input — against its base.
 * The offline tools use this instead of trusting such a record, so a
 * hand-flattened variant with edited joints or reordered steps is refused
 * exactly as resolution would refuse it (critic findings A-C2 / A2-C4). The
 * record's own text fields are checked for presence and difference from the
 * base's, never for wording.
 */
export function verifyResolvedVariant(
  rawResolved: RawVariantLike,
  rawBase: RawVariantLike | undefined,
): void {
  const where = `resolved movement preview ${String(rawResolved.movementId)}`;
  if (rawBase === undefined) {
    fail(where, `derivesFrom ${String(rawResolved.derivesFrom)} has no base entry in the manifest`);
  }
  const base = rawBase as RawVariantLike;
  if (isVariantEntry(base)) {
    fail(where, `derivesFrom ${String(rawResolved.derivesFrom)} is itself a derived variant; derivation chains are rejected`);
  }
  const baseFrames = base.frames;
  if (!Array.isArray(baseFrames) || baseFrames.length === 0) {
    fail(where, `base ${String(base.movementId)} has no frames to verify against`);
  }
  const frames = baseFrames as { id: string; joints: unknown }[];
  const resolvedFrames = rawResolved.frames;
  if (!Array.isArray(resolvedFrames) || resolvedFrames.length !== frames.length) {
    fail(where, `frames must be the base's ${frames.length} frames`);
  }
  const frameList = resolvedFrames as { id?: unknown; joints?: unknown; caption?: unknown }[];
  frameList.forEach((frame, i) => {
    if (frame.id !== frames[i].id) {
      fail(where,
        `frame ${i} is ${JSON.stringify(frame.id)}, not the base's ${JSON.stringify(frames[i].id)}`);
    }
    if (JSON.stringify(frame.joints) !== JSON.stringify(frames[i].joints)) {
      fail(where, `frame ${String(frame.id)} joints do not match the base's`);
    }
  });

  for (const field of REQUIRED_VARIANT_FIELDS) {
    const value = rawResolved[field];
    if (value === undefined || value === null
      || (typeof value === 'string' && value.trim().length === 0)) {
      fail(where, `variant must supply ${field}`);
    }
    if (value === base[field]) {
      fail(where, `${field} must not equal the base's value`);
    }
  }

  const family = stepListForBase(base.movementId);
  if (family === undefined) {
    fail(where,
      `base ${String(base.movementId)} has no step list; declare its family in STEP_FAMILY_BY_BASE`);
  }
  const familyList = family as StepList;
  if (frames.length > familyList.steps.length) {
    fail(where,
      `base ${String(base.movementId)} has ${frames.length} frames but the ${familyList.family} family lists ${familyList.steps.length} steps`);
  }
  const roles = rawResolved.frameRoles;
  if (roles === null || typeof roles !== 'object' || Array.isArray(roles)) {
    fail(where, 'a resolved variant must carry frameRoles');
  }
  const captions: Record<string, unknown> = {};
  frameList.forEach((frame) => { captions[String(frame.id)] = frame.caption; });
  const frameRoles = checkStepAssignment(
    where, familyList, frames.map((frame) => frame.id), roles as Record<string, unknown>, captions,
  );

  const orientation = rawResolved.implementOrientation;
  if (orientation !== undefined) {
    if (!IMPLEMENT_ORIENTATIONS.includes(orientation as ImplementOrientation)) {
      fail(where, `implementOrientation must be one of ${IMPLEMENT_ORIENTATIONS.join('|')}`);
    }
    if (familyList.peak === undefined) {
      fail(where,
        `the ${familyList.family} family declares no ${JSON.stringify(PEAK_STEP)} step, so implementOrientation cannot be used`);
    }
    const peaks = frames.filter((frame) => frameRoles[frame.id] === familyList.peak);
    if (peaks.length !== 1) {
      fail(where,
        `implementOrientation ${JSON.stringify(orientation)} requires exactly one frame with role ${JSON.stringify(familyList.peak)}, found ${peaks.length}`);
    }
  }
  checkImplementCount(where, rawResolved.implementCount, rawResolved, base);
  checkDrawingOverrides(where, rawResolved, base);
  if (rawResolved.jointOffsets !== undefined) checkJointOffsets(where, rawResolved, base);
  if (rawResolved.gripDelta !== undefined) checkGripDelta(where, rawResolved, base);
}

/**
 * Validate a whole raw entry list: unique movement ids, unique previewIds
 * across every entry (base and variant), and every variant derivable under the
 * contract. Called at manifest load so a bad variant fails loudly.
 */
export function validateVariantSet(rawEntries: readonly RawVariantLike[]): void {
  const byId = new Map<unknown, RawVariantLike>();
  for (const entry of rawEntries) {
    if (byId.has(entry.movementId)) {
      fail(`movement preview ${String(entry.movementId)}`, 'duplicate entry');
    }
    byId.set(entry.movementId, entry);
  }
  const seen = new Map<unknown, unknown>();
  for (const entry of rawEntries) {
    const previewId = entry.previewId;
    if (previewId === undefined) continue;
    if (seen.has(previewId)) {
      fail(`movement preview ${String(entry.movementId)}`,
        `previewId ${String(previewId)} is already used by movement ${String(seen.get(previewId))}`);
    }
    seen.set(previewId, entry.movementId);
  }
  for (const entry of rawEntries) {
    if (!isVariantEntry(entry)) continue;
    deriveVariantEntry(entry, byId.get(entry.derivesFrom));
  }
  // A BASE entry may legitimately declare a drawing override (owner ruling
  // 2026-09-24: base 19's own bells are bigger and 20 inherits them). It must
  // still be checked here, or a base entry could declare a scale that never
  // draws and load unflagged - the silent no-op B1-20-C2 recorded.
  for (const entry of rawEntries) {
    if (isVariantEntry(entry)) continue;
    checkDrawingOverrides(`movement preview ${String(entry.movementId)}`, entry, undefined);
    // jointOffsets are variant-only: a base has no base frame to be measured
    // against, so an offset on a base could move its drawing unchecked.
    if (entry.jointOffsets !== undefined) {
      fail(`movement preview ${String(entry.movementId)}`,
        'jointOffsets on an entry that carries no derivesFrom; offsets are variant-only');
    }
    // gripDelta is variant-only for the same reason (B1-300): the re-solve is
    // judged against a base's own frames.
    if (entry.gripDelta !== undefined) {
      fail(`movement preview ${String(entry.movementId)}`,
        'gripDelta on an entry that carries no derivesFrom; a grip change is variant-only');
    }
  }
}