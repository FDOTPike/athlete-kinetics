/**
 * canonicalFigure.ts — pure layout for the WO-09 canonical 11-joint rig.
 *
 * This module owns EVERY number that turns a canonical keyframe into a drawn
 * figure. It is shared verbatim by two renderers:
 *
 *  1. the app (`MovementPreview.tsx`) — primitives become styled RN Views;
 *  2. the evidence rasterizer (`tools/rendering/render_manifest_evidence.mjs`)
 *     — the SAME primitives become SVG and rasterize to PNG.
 *
 * Because both consume this one layout, the rendered evidence is the app's
 * own geometry, not a parallel re-implementation. The module imports nothing
 * at runtime (the variant-role types are a type-only import, erased on emit):
 * no React, no React Native, no theme — colors are referenced by ROLE and
 * each renderer maps roles to its own tokens (theme.color.* / SVG hex).
 *
 * Visual laws implemented here are the ratified M2 rig contract
 * (docs/audits/accessible-coach/WO09_M2_CANONICAL_RIG_FOUNDATION.md §5–§7):
 *  - z-order: ground/apparatus, far limbs (textLow), torso, near limbs
 *    (textHi), neck+head, hands/implements;
 *  - sagittal far-limb perspective separation (FAROFF) so the far side stays
 *    legible in side view without inventing motion;
 *  - neutral morphology by default, with the original male/female parameter
 *    sets retained as explicit compatibility inputs; technique is invariant;
 *  - chalk (#EFC94C) NEVER appears in figure output — this module cannot
 *    emit it by construction.
 */

export type ViewName = 'side' | 'front' | 'oblique';

import type { FrameRole, ImplementCount, ImplementOrientation, JointOffsets } from './derivation';

export type CanonicalPoint = readonly [number, number];

/**
 * Canonical gender-neutral figure morphology (MOV-B001 single-figure standard).
 * The sole production silhouette used for all movement rendering and verification.
 */
export const CANONICAL_BODY_PARAMETERS: BodyParameters = Object.freeze({
  sw: 10.2,
  hw: 8.5,
  lw: 4.8,
  hr: 6.2,
});

/**
 * Neutral production silhouette is the sole geometry. Legacy 'male' and 'female'
 * inputs map to the identical neutral parameters at the boundary.
 */
export const DUAL_BODY_PARAMETERS: Readonly<Record<'neutral' | 'male' | 'female', BodyParameters>> = {
  neutral: CANONICAL_BODY_PARAMETERS,
  male: CANONICAL_BODY_PARAMETERS,
  female: CANONICAL_BODY_PARAMETERS,
} as const;

export interface CanonicalPose {
  hd: CanonicalPoint;
  nk: CanonicalPoint;
  hp: CanonicalPoint;
  el: CanonicalPoint;
  wr: CanonicalPoint;
  ef: CanonicalPoint;
  wf: CanonicalPoint;
  kn: CanonicalPoint;
  an: CanonicalPoint;
  kf: CanonicalPoint;
  af: CanonicalPoint;
  b?: CanonicalPoint;
  /**
   * Family 13: how far the middle of a held barbell is lifted at this pose, in
   * box units. Zero is a level bar. It is a drawing instruction, not a joint, so
   * the joint-limit checker never measures it.
   */
  bt?: number;
  /**
   * Entry 0184: 1 on a position where the bar has reached its chin stop, so the
   * finish-line tick is drawn. A drawing instruction, not a joint.
   */
  ct?: number;
  /** Shoulder-girdle elevation for shrug poses; head/trunk anchors stay still. */
  se?: number;
  /** Supported-curl forearm bearing in degrees; preserves the elbow arc. */
  ca?: number;
  /** World-transverse shoulder abduction for the supported rear-delt raise. */
  ra?: number;
  /** Pinned-upper-arm pushdown elbow flexion, in degrees. */
  pe?: number;
  /** Sagittal shoulder bearing for the straight-arm rope pulldown. */
  sa?: number;
  /** Flye shoulder opening, from closed0 to the supported wide position1. */
  fo?: number;
  /** Small ankle-cable hip extension; body and supporting leg stay quiet. */
  ke?: number;
  /** Reverse-lunge step, lower, rise and return phase, from0 through4. */
  rl?: number;
  /** Inverted row pull phase, from 0 (long arms) to 1 (chest to bar). */
  ir?: number;
  /** Body tricep press extension phase, from 0 (lockout) to 1 (flexed pause). */
  tp?: number;
}

export type ColorRole = 'textHi' | 'textLow' | 'textMid' | 'line' | 'ink1';

export interface BonePrim {
  kind: 'bone';
  /** Endpoints in manifest box units. */
  x1: number; y1: number; x2: number; y2: number;
  /** Stroke width in box units. */
  w: number;
  color: ColorRole;
  opacity: number;
  /** Optional outline (torso bars read as dark shapes with a light contour). */
  stroke?: ColorRole;
  strokeWidth?: number;
  /**
   * Drawn BEFORE the head ring (apparatus the figure passes behind, e.g. the
   * pulldown bar descending past the face).
   */
  beforeHead?: boolean;
}

export interface CirclePrim {
  kind: 'circle';
  cx: number; cy: number; r: number;
  fill: ColorRole;
  stroke?: ColorRole;
  strokeWidth?: number;
  opacity: number;
}

export interface RectPrim {
  kind: 'rect';
  x: number; y: number; w: number; h: number; rx: number;
  fill: ColorRole;
  stroke?: ColorRole;
  strokeWidth?: number;
  opacity: number;
}

export type FigurePrim = BonePrim | CirclePrim | RectPrim;

/** Interpolable pose: every joint present in both frames lerps; others hold. */
export function lerpJoints(a: CanonicalPose, b: CanonicalPose, u: number): CanonicalPose {
  const mix = (p: CanonicalPoint, q: CanonicalPoint): CanonicalPoint =>
    [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
  const out: Partial<Record<keyof CanonicalPose, CanonicalPoint | number>> = {};
  // `bt` (family 13's held-bar tilt) and `ct` (Entry 0184's chin-stop flag) are
  // scalars, not joints, so they interpolate as numbers. Mixing them as points
  // would hand the drawer an array and drop the instruction mid-rep, and the app's
  // motion frames would not match their own stills.
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof CanonicalPose>;
  for (const key of keys) {
    if (key === 'bt' || key === 'ct' || key === 'se' || key === 'ca' || key === 'ra' || key === 'pe' || key === 'sa' || key === 'fo' || key === 'ke' || key === 'rl' || key === 'ir' || key === 'tp') {
      out[key] = (a[key] ?? 0) + ((b[key] ?? 0) - (a[key] ?? 0)) * u;
      continue;
    }
    const p = a[key] as CanonicalPoint | undefined;
    const q = b[key] as CanonicalPoint | undefined;
    out[key] = (p !== undefined && q !== undefined ? mix(p, q) : p ?? q) as CanonicalPoint;
  }
  return out as CanonicalPose;
}

/** Quadratic ease-in-out, identical to the ratified inspector reference. */
export function easeInOut(u: number): number {
  return u < 0.5 ? 2 * u * u : -1 + (4 - 2 * u) * u;
}

/** Segment durations (ms) between keyframes; 900 ms default per gap. */
export function segmentDurations(count: number, perSegment?: readonly number[]): number[] {
  const gaps = Math.max(0, count - 1);
  if (perSegment && perSegment.length >= gaps) return perSegment.slice(0, gaps);
  return Array.from({ length: gaps }, () => 900);
}

/** Pose at time tMs across a frame list, with eased per-segment interpolation. */
export function poseAtTime(
  frames: readonly CanonicalPose[],
  tMs: number,
  perSegment?: readonly number[],
): CanonicalPose {
  if (frames.length === 0) throw new Error('canonicalFigure: poseAtTime needs frames');
  const segs = segmentDurations(frames.length, perSegment);
  const total = segs.reduce((acc, d) => acc + d, 0);
  const t = Math.max(0, Math.min(total, tMs));
  if (t >= total) return frames[frames.length - 1];
  let acc = 0;
  let idx = segs.length - 1;
  for (let i = 0; i < segs.length; i++) {
    if (t < acc + segs[i]) { idx = i; break; }
    acc += segs[i];
  }
  if (idx >= frames.length - 1) return frames[frames.length - 1];
  const dur = segs[idx] || 1;
  const u = easeInOut(Math.max(0, Math.min(1, (t - acc) / dur)));
  return lerpJoints(frames[idx], frames[idx + 1], u);
}

/** Blend grip presentation on the same authored/eased timeline as the pose. */
export function peakWeightAtTime(
  frames: readonly { id: string }[],
  roles: Readonly<Record<string, FrameRole>> | undefined,
  tMs: number,
  perSegment?: readonly number[],
): number {
  if (frames.length === 0 || roles === undefined) return 0;
  const weight = (index: number): number => roles[frames[index].id] === 'peak' ? 1 : 0;
  const segments = segmentDurations(frames.length, perSegment);
  let remaining = Math.max(0, tMs);
  for (let i = 0; i < segments.length; i++) {
    if (remaining < segments[i]) {
      const u = easeInOut(remaining / segments[i]);
      return weight(i) + (weight(i + 1) - weight(i)) * u;
    }
    remaining -= segments[i];
  }
  return weight(frames.length - 1);
}

/**
 * Movement-specific sagittal far-limb offsets (M2 §5.4). Default [-4.8, 0]
 * separates a hidden far side from the near side in side view; three
 * movements carry calibrated overrides.
 */
const FAROFF: Record<string, readonly [number, number]> = {
  'dumbbell-bench-press': [-2.0, 4.0],
  'dumbbell-shoulder-press': [-3.5, 1.5],
  'cable-crunch': [-4.0, 0.5],
  // Family 4: the close-grip pair sits tight - the far side reads closer in.
  'close-grip-dumbbell-press': [-2.4, 0.0],
  // Family 4: the neutral-grip pair sits together; palms face each other.
  'dumbbell-bench-press-with-neutral-grip': [-2.6, 0.0],
  // Family 15: the incline barbell press keeps the end-on-press far separation
  // (family 4's [-8, -2]) without the PERSPECTIVE set's 94.4 foot plane, so
  // every incline member shares one ground; the neutral pair sits together.
  'barbell-incline-bench-press-medium-grip': [-8.0, -2.0],
  'hammer-grip-incline-db-bench-press': [-3.0, 0.0],
  'incline-dumbbell-bench-with-palms-facing-in': [-3.0, 0.0],
};
const FAROFF_DEFAULT: readonly [number, number] = [-4.8, 0.0];

/**
 * Base 12's bench pad. The top sits at y 78 rather than the historical 66:
 * with a 22 thigh and a 22 shin a kneeling hip can only leave a SLIGHTLY BENT
 * standing leg a reachable span if the bench is lower (a slightly-bent leg
 * spans ~42.5 of its 44-unit maximum; the historical pad required 52.4).
 * See acceptance-evidence/wo09/deepseek-loop/B1-RIG-R2_PREFLIGHT.md section 4.
 * The pad is drawn AFTER the far limbs (Layer 2), not with the other
 * apparatus, so the standing leg passes behind the bench; and this one
 * constant replaces the three hard-coded "y ~ 66" tests that could drift.
 */
const ROW_BENCH = { x: 14, w: 48, top: 78, h: 5 } as const;
// Both row slugs share one drawing: the one-arm variant (247) derives base 12's
// frames, so its bench and dumbbell are the same apparatus. Keeping the pair in
// one set is what the critic's round-1 P2 required: 247 previously drew no pad
// and no bell because every row branch tested only the base slug.
const ROW_SLUGS = new Set(['single-arm-dumbbell-row', 'one-arm-dumbbell-row']);

/**
 * Family 15 (horizontal press, incline): the four members share one reclined
 * body and one incline bench. The base draws the end-on barbell (Entry 0181's
 * side-view rule), two members hold a neutral dumbbell pair, and the cable
 * member presses a D-handle in each hand against a low pulley at the head end
 * of the bench - the standard setup for the name, recorded as an open question
 * at the family 15 checkpoint.
 */
const INCLINE_PRESS_SLUGS = new Set([
  'barbell-incline-bench-press-medium-grip', 'hammer-grip-incline-db-bench-press',
  'incline-cable-chest-press', 'incline-dumbbell-bench-with-palms-facing-in',
]);
// The two incline dumbbell members join the neutral-grip bell branch: vertical
// bells, both drawn, the pair held together (palms facing each other).
const INCLINE_DB_SLUGS = new Set([
  'hammer-grip-incline-db-bench-press', 'incline-dumbbell-bench-with-palms-facing-in',
]);
const INCLINE_CABLE = {
  pulley: [76, 92.8] as const,
  pulleyR: 1.7,
  gripHalf: 3.0,
  gripW: 1.5,
  clipDrop: 3.4,
  strapW: 1.0,
  cableW: 1.4,
} as const;

/**
 * Batch 1 (B1-300): the pulldown slugs share one machine. The wide-grip variant
 * derives base 21's frames, so it needs the same gantry, seat, thigh pad, pulley
 * and cable; every branch that tested only the base slug would have drawn it
 * with no machine at all (the row's round-1 P2, B1-247). The posts' x values are
 * shared with the variant bar so the bar can never be drawn through a post.
 */
const PULLDOWN_SLUGS: ReadonlySet<string> = new Set(['lat-pulldown', 'wide-grip-lat-pulldown', 'close-grip-front-lat-pulldown', 'underhand-cable-pulldowns']);

// Ruling 10 (Scapular Pull-Up, family 2): a hanging movement has a bar. The
// bar is STATIC in the frame - the whole figure translates along it as the
// body lifts - and spans well past both hands so the hands read as gripping.
const PULLUP_BAR_X1 = 33;
const PULLUP_BAR_X2 = 67;
const PULLUP_BAR_Y = 9;
const PULLDOWN_POST_X = { left: 22, right: 78 } as const;
/**
 * The one-arm pulldown pulls with a single arm, so its pulley belongs on the
 * working side of the gantry rather than on the centreline. It used to sit at
 * (50, 8) - directly over the head at (50, 20), radius 6.2, so the cable
 * crossed the face from the moment the hand came up off the chest. The head
 * spans x 43.8..56.2; at x 35 the cable stays left of it at every position, the
 * furthest hand being 42.
 */
const ONE_ARM_PULLEY: readonly [number, number] = [35, 8];
/** The drawn post width (apparatus() draws every post 1.6 wide). */
const PULLDOWN_POST_W = 1.6;
const PULLDOWN_BAR_W = 3.4;
/**
 * How far a variant's bar runs past each hand (B1-300). Base 21 keeps its own
 * byte-locked bar, which ends 5 units INSIDE the hands (a pre-existing defect
 * recorded for the owner, not changed here).
 */
const PULLDOWN_BAR_OVERHANG = 3.5;

/** Ground line the drawings sit on (M2 §5.1); the far foot must stay above it. */
const GROUND_LINE = 96.4;

/**
 * Batch 1 (B1-113, owner re-base Entry 0175): low-cable movements drawn side-on.
 * 113 Cable Deadlifts derives base 9 Romanian Deadlift's frames; the athlete
 * stands centred between two low pulleys, which project near the feet in a side
 * view. Keyed on the VARIANT slug, so base 9 draws exactly as before (and gets
 * no cable), and this set draws no barbell plate (that branch is keyed on the
 * base slug).
 *
 * Geometry, in box units:
 *  - each hand holds a D-handle: the grip bar runs front to back through the
 *    hand (a neutral grip beside the thigh), and two short straps meet below it
 *    at the clip the cable hangs from;
 *  - each cable runs straight from its clip to a pulley wheel resting on the
 *    floor, `pulleyForward` ahead of that side's ankle: just clear of the toes
 *    (the foot capsule ends ~7.4 ahead of the ankle). Measured on base 9's
 *    frames, a wheel under the midfoot (2.7) leaves 4.3 of the 35.1-unit
 *    standing cable and 23% of the wheel visible behind the near leg, so it
 *    does not read as a cable; at 9 the wheel is fully visible and 25.7 / 35.6
 *    (standing) and 14.3 / 16.8 (bottom) of the cable show;
 *  - paint order is by depth: the far pulley and cable before the far limbs,
 *    the far handle after the far arm, the near pulley and cable after the torso
 *    but BEFORE the near limbs, the near handle and hand last. Cable lines drawn
 *    with the other implements (after the near limbs) painted over the near leg.
 */
const CABLE_LOW_SLUGS: ReadonlySet<string> = new Set(['cable-deadlifts']);
// Family 13: the three cable curls also ride a low cable to a D-handle, but they
// are drawn FRONT view, where the pulley sits at the near ankle and the cable
// comes up to the hand.
export const CABLE_CURL_SLUGS: ReadonlySet<string> = new Set([
  'cable-hammer-curls-rope-attachment', 'reverse-cable-curl', 'standing-biceps-cable-curl',
]);
// Family 13: the four barbell curls draw a shaft through both grips with a plate
// at each end. `bt` (bar tilt, box units) raises the middle of the bar at the peak
// of a supinated curl, so the inner ends read higher than the plates, mirrored
// about the middle, rather than as one flat bar.
const CURL_SLUGS: ReadonlySet<string> = new Set([
  'barbell-curl', 'reverse-barbell-curl', 'close-grip-ez-bar-curl', 'ez-bar-curl',
]);
// Family 13: the two reverse curls take an overhand grip, which the hand reads as
// a knuckle line toward the viewer instead of a grip ring on a supinated bar.
export const PRONATED_SLUGS: ReadonlySet<string> = new Set(['reverse-barbell-curl', 'reverse-cable-curl']);
// Entry 0184 (owner): a short horizontal tick at chin height, on the positions
// where the bar is at its stop, so the athlete can see where the chin stop is
// instead of being told it. Keyed to the three grip variations the owner named, so
// every other movement, finished or not, stays byte-identical. `ct` is 1 on a stop
// position; the tick is drawn once `ct` reaches 0.5, which is the same halfway
// point the app's own motion frames cross.
const CHIN_TICK_SLUGS: ReadonlySet<string> = new Set([
  'wide-grip-lat-pulldown', 'close-grip-front-lat-pulldown', 'underhand-cable-pulldowns',
]);
const CABLE_LOW = {
  pulleyForward: 9,
  pulleyR: 1.8,
  gripHalf: 3.0,
  gripW: 1.5,
  clipDrop: 3.4,
  strapW: 1.0,
  cableW: 1.4,
} as const;

/** The four depth groups of a low-cable drawing (B1-113); see CABLE_LOW_SLUGS. */
export interface LowCableLayers {
  readonly farCable: FigurePrim[];
  readonly farHandle: FigurePrim[];
  readonly nearCable: FigurePrim[];
  readonly nearHandle: FigurePrim[];
}

/**
 * One side's pulley and cable, and its handle, for a hand at `wr` whose foot is
 * planted at `an`. Pure; exported for the tests and the scanner.
 */
export function layoutLowCable(
  j: Pick<CanonicalPose, 'wr' | 'wf' | 'an' | 'af'>,
  body: BodyParameters,
  farColor: ColorRole,
  farOpacity: number,
): LowCableLayers {
  const side = (wr: CanonicalPoint, an: CanonicalPoint, hand: ColorRole, opacity: number) => {
    const clip: CanonicalPoint = [wr[0], wr[1] + CABLE_LOW.clipDrop];
    const pulley: CanonicalPoint = [an[0] + CABLE_LOW.pulleyForward, GROUND_LINE - CABLE_LOW.pulleyR];
    const cable: FigurePrim[] = [
      { kind: 'bone', x1: clip[0], y1: clip[1], x2: pulley[0], y2: pulley[1],
        w: CABLE_LOW.cableW, color: 'textMid', opacity },
      { kind: 'circle', cx: pulley[0], cy: pulley[1], r: CABLE_LOW.pulleyR,
        fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity },
    ];
    const g0: CanonicalPoint = [wr[0] - CABLE_LOW.gripHalf, wr[1]];
    const g1: CanonicalPoint = [wr[0] + CABLE_LOW.gripHalf, wr[1]];
    const handle: FigurePrim[] = [
      { kind: 'bone', x1: g0[0], y1: g0[1], x2: clip[0], y2: clip[1], w: CABLE_LOW.strapW, color: 'textMid', opacity },
      { kind: 'bone', x1: g1[0], y1: g1[1], x2: clip[0], y2: clip[1], w: CABLE_LOW.strapW, color: 'textMid', opacity },
      { kind: 'bone', x1: g0[0], y1: g0[1], x2: g1[0], y2: g1[1], w: CABLE_LOW.gripW, color: 'textMid', opacity },
      { kind: 'circle', cx: wr[0], cy: wr[1], r: body.lw * 0.44, fill: hand, opacity },
    ];
    return { cable, handle };
  };
  const near = side(j.wr, j.an, 'textHi', 1);
  const far = side(j.wf, j.af, farColor, farOpacity);
  return { farCable: far.cable, farHandle: far.handle, nearCable: near.cable, nearHandle: near.handle };
}

/**
 * Family 15: the incline cable press. One low pulley at the base of the stack
 * behind the bench's head end (the standard setup for the name); each hand
 * holds a D-handle on its own cable to that pulley. The same four depth groups
 * as the low cable (B1-113), so both renderers layer it identically: far cable,
 * far handle, near cable behind the near limbs, near handle last.
 */
export function layoutInclineCable(
  j: Pick<CanonicalPose, 'wr' | 'wf'>,
  body: BodyParameters,
  farColor: ColorRole,
  farOpacity: number,
): LowCableLayers {
  const side = (wr: CanonicalPoint, hand: ColorRole, opacity: number, pulley: boolean) => {
    const clip: CanonicalPoint = [wr[0], wr[1] + INCLINE_CABLE.clipDrop];
    const cable: FigurePrim[] = [
      { kind: 'bone', x1: clip[0], y1: clip[1], x2: INCLINE_CABLE.pulley[0], y2: INCLINE_CABLE.pulley[1],
        w: INCLINE_CABLE.cableW, color: 'textMid', opacity },
    ];
    if (pulley) {
      cable.push({ kind: 'circle', cx: INCLINE_CABLE.pulley[0], cy: INCLINE_CABLE.pulley[1],
        r: INCLINE_CABLE.pulleyR, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity });
    }
    const g0: CanonicalPoint = [wr[0] - INCLINE_CABLE.gripHalf, wr[1]];
    const g1: CanonicalPoint = [wr[0] + INCLINE_CABLE.gripHalf, wr[1]];
    const handle: FigurePrim[] = [
      { kind: 'bone', x1: g0[0], y1: g0[1], x2: clip[0], y2: clip[1], w: INCLINE_CABLE.strapW, color: 'textMid', opacity },
      { kind: 'bone', x1: g1[0], y1: g1[1], x2: clip[0], y2: clip[1], w: INCLINE_CABLE.strapW, color: 'textMid', opacity },
      { kind: 'bone', x1: g0[0], y1: g0[1], x2: g1[0], y2: g1[1], w: INCLINE_CABLE.gripW, color: 'textMid', opacity },
      { kind: 'circle', cx: wr[0], cy: wr[1], r: body.lw * 0.44, fill: hand, opacity },
    ];
    return { cable, handle };
  };
  const near = side(j.wr, 'textHi', 1, true);
  const far = side(j.wf, farColor, farOpacity, false);
  return { farCable: far.cable, farHandle: far.handle, nearCable: near.cable, nearHandle: near.handle };
}

/** Kneeling movements suppress drawn feet (M2 §5.1 floor suppression). */
const NOFEET: ReadonlySet<string> = new Set(['cable-crunch']);

export interface FigureOptions {
  view: ViewName;
  body?: BodyParameters;
  /** Media asset key, e.g. `movement/cable-crunch/demo/v1` (drives overrides). */
  assetKey: string;
  /**
   * Step role of the frame being drawn (R2 Part A). A variant supplies it from
   * its own `frameRoles`; a base entry passes nothing at all — which is why the
   * base drawing path cannot change. Only the `peak` frame tilts an implement,
   * and only when `implementOrientation` asks for a supinated grip.
   */
  role?: FrameRole;
  /** Eased peak influence during playback; stills derive it from their role. */
  implementTiltWeight?: number;
  /** Variant implement orientation; omitted means 'flat'. */
  implementOrientation?: ImplementOrientation;
  /**
   * Variant implement count (R2 Batch 1); omitted means the slug's own default,
   * so every base entry draws exactly as it always has. Only 1 departs from
   * that default: a suitcase carry lifts ONE bell in the near hand, and the far
   * hand stays empty.
   */
  implementCount?: ImplementCount;
  /**
   * Owner batch (B1-20-R2): implement scale. The carries draw their bells 1.4x
   * larger, for those movements only; omitted means 1. It scales the bell, its
   * clearance shift and the head-clearance push together, so a bigger bell still
   * reads as held rather than merged with the torso.
   */
  implementScale?: number;
  /**
   * Owner batch (B1-20-R2): a slight body turn in degrees about the athlete's own
   * vertical axis, front view only. The one-bell suitcase carry declares ~10 so
   * its centre of mass visibly relates to the symmetric two-bell farmer carry.
   * Omitted means none: the farmer carry stays square.
   */
  bodyTurnDeg?: number;
  /**
   * Batch 1 (B1-55, owner ruling Entry 0175): a variant's constant, additive
   * per-joint offsets, applied HERE at draw time so the frames' joints stay the
   * base's own objects. The contract (derivation.ts) has already refused the
   * planted contacts, unknown joints and any keyframe whose drawn segment moves
   * more than 5%. Omitted means none: every base draws exactly as before.
   */
  jointOffsets?: JointOffsets;
  /**
   * Batch 1 (B1-300, owner ruling Entry 0175): a variant's grip change in box
   * units PER HAND, positive meaning wider, front view only. Each wrist's x moves
   * outward by this constant and the elbow is re-solved (resolveGripArms) with
   * the frame's own drawn upper-arm and forearm lengths, so no bone changes
   * length. The contract (derivation.ts) has already refused it on a base, on a
   * side view, on a grip beyond reach and on an elbow path that jumps. Omitted
   * means none: every base draws exactly as before.
   */
  gripDelta?: number;
}

/** One front-view arm re-solved for a grip change (B1-300). */
export interface GripArmSolution {
  readonly el: CanonicalPoint;
  readonly wr: CanonicalPoint;
  /**
   * The moved wrist was out of the arm's reach at its own height, so it kept the
   * grip x and moved onto the full-reach circle: the arm is drawn straight.
   */
  readonly clamped: boolean;
  /**
   * False only when the grip x itself lies beyond the arm's full reach; the arm
   * is then drawn straight toward the target. The contract refuses any keyframe
   * where this happens, so a validated movement never draws it.
   */
  readonly reachable: boolean;
}

/**
 * Re-solve ONE arm for a grip change (B1-300, owner ruling Entry 0175). Pure:
 * the app (resolveFigureJoints), the renderer (the same module) and the scanner
 * all call this one function.
 *
 * The wrist's x moves by `dx` (signed, box units). The upper-arm and forearm
 * lengths are the frame's OWN drawn lengths (shoulder -> elbow, elbow -> wrist),
 * and the elbow is placed by two-bone inverse kinematics: of the two solutions
 * the one nearest the frame's own elbow is kept, so the elbow keeps its side and
 * moves continuously. A wrist that the straight arm cannot reach at its own
 * height keeps the grip x and moves onto the full-reach circle (for an overhead
 * reach that drops it slightly; the arm is then straight).
 */
export function solveGripArm(
  shoulder: CanonicalPoint,
  elbow: CanonicalPoint,
  wrist: CanonicalPoint,
  dx: number,
): GripArmSolution {
  const upper = Math.hypot(elbow[0] - shoulder[0], elbow[1] - shoulder[1]);
  const fore = Math.hypot(wrist[0] - elbow[0], wrist[1] - elbow[1]);
  const reach = upper + fore;
  const tx = wrist[0] + dx;
  const ox = tx - shoulder[0];
  if (Math.abs(ox) > reach) {
    // Beyond reach at any height: drawn straight toward the target (refused by
    // the contract on every keyframe, so this only keeps the function total).
    const oy = wrist[1] - shoulder[1];
    const len = Math.hypot(ox, oy);
    const u: CanonicalPoint = [ox / len, oy / len];
    return {
      el: [shoulder[0] + u[0] * upper, shoulder[1] + u[1] * upper],
      wr: [shoulder[0] + u[0] * reach, shoulder[1] + u[1] * reach],
      clamped: true,
      reachable: false,
    };
  }
  let ty = wrist[1];
  let clamped = false;
  const side = Math.sign(ty - shoulder[1]) || -1;
  let span = Math.hypot(ox, ty - shoulder[1]);
  const inner = Math.abs(upper - fore);
  if (span > reach) {
    ty = shoulder[1] + side * Math.sqrt(Math.max(0, reach * reach - ox * ox));
    span = reach;
    clamped = true;
  } else if (span < inner) {
    ty = shoulder[1] + side * Math.sqrt(Math.max(0, inner * inner - ox * ox));
    span = inner;
    clamped = true;
  }
  const wr: CanonicalPoint = [tx, ty];
  if (span < 1e-12) return { el: elbow, wr, clamped, reachable: true };
  const u: CanonicalPoint = [(tx - shoulder[0]) / span, (ty - shoulder[1]) / span];
  const along = (upper * upper - fore * fore + span * span) / (2 * span);
  const h = Math.sqrt(Math.max(0, upper * upper - along * along));
  const foot: CanonicalPoint = [shoulder[0] + u[0] * along, shoulder[1] + u[1] * along];
  const a: CanonicalPoint = [foot[0] - u[1] * h, foot[1] + u[0] * h];
  const b: CanonicalPoint = [foot[0] + u[1] * h, foot[1] - u[0] * h];
  const da = Math.hypot(a[0] - elbow[0], a[1] - elbow[1]);
  const db = Math.hypot(b[0] - elbow[0], b[1] - elbow[1]);
  return { el: da <= db ? a : b, wr, clamped, reachable: true };
}

/**
 * Both arms of a front-view figure re-solved for a grip change of `gripDelta`
 * per hand (positive = wider). "Outward" is the side of the midline each arm's
 * shoulder root sits on, so the near (left) hand moves left and the far hand
 * right. The shoulder roots are the drawn ones (nk offset by sw * 0.92 across
 * the torso axis), so the lengths held are exactly the lengths drawn.
 */
export function resolveGripArms(
  joints: {
    readonly nk: CanonicalPoint; readonly nArm: CanonicalPoint; readonly fArm: CanonicalPoint;
    readonly el: CanonicalPoint; readonly wr: CanonicalPoint;
    readonly ef: CanonicalPoint; readonly wf: CanonicalPoint;
  },
  gripDelta: number,
): { near: GripArmSolution; far: GripArmSolution } {
  const outward = (shoulder: CanonicalPoint, fallback: number): number =>
    Math.sign(shoulder[0] - joints.nk[0]) || fallback;
  return {
    near: solveGripArm(joints.nArm, joints.el, joints.wr, outward(joints.nArm, -1) * gripDelta),
    far: solveGripArm(joints.fArm, joints.ef, joints.wf, outward(joints.fArm, 1) * gripDelta),
  };
}

/**
 * The pose a movement actually draws: the authored pose plus its declared
 * constant joint offsets. With no offsets it is a plain copy, so every entry
 * that declares none keeps its drawing byte for byte. Offsets are constant, so
 * applying them after interpolation equals interpolating offset keyframes.
 */
export function applyJointOffsets(pose: CanonicalPose, offsets?: JointOffsets): CanonicalPose {
  const j: CanonicalPose = { ...pose };
  if (offsets === undefined) return j;
  const moved = j as unknown as Record<string, CanonicalPoint | undefined>;
  for (const [joint, delta] of Object.entries(offsets)) {
    const p = moved[joint];
    if (p === undefined || delta === undefined) continue;
    moved[joint] = [p[0] + delta[0], p[1] + delta[1]];
  }
  return j;
}

export interface BodyParameters {
  readonly sw: number; // shoulder half-width
  readonly hw: number; // hip half-width
  readonly lw: number; // limb stroke weight
  readonly hr: number; // cranial radius
}

function slugOf(assetKey: string): string {
  const parts = assetKey.split('/');
  return parts.length >= 2 ? parts[1] : '';
}

const SHRUG_SLUGS = new Set(['dumbbell-shrug', 'barbell-shrug', 'barbell-shrug-behind-the-back', 'cable-shrugs']);
const PREACHER_SLUGS = new Set(['preacher-curl', 'cable-preacher-curl', 'preacher-hammer-dumbbell-curl']);
const HEAD_SUPPORTED_RAISE = 'bent-over-dumbbell-rear-delt-raise-with-head-on-bench';
const HEAD_BENCH_ANGLE = 20 * Math.PI / 180;
const HEAD_BENCH_NORMAL = [Math.sin(HEAD_BENCH_ANGLE), Math.cos(HEAD_BENCH_ANGLE)] as const;
const PUSHDOWN_SLUGS = new Set(['triceps-pushdown', 'reverse-grip-triceps-pushdown', 'triceps-pushdown-rope-attachment']);
const STRAIGHT_ARM_PULLDOWN = 'rope-straight-arm-pulldown';
const ANKLE_KICKBACK = 'cable-glute-kickback';
const REVERSE_LUNGE = 'dumbbell-reverse-lunge';

/** Rear foot steps away and returns; the entire front sole stays planted.
 * Each leg is solved on two22.25-unit circles throughout the interpolated
 * motion, including the lifted step. Numeric stride/hover are draft choices.
 */
export function reverseLungeGeometry(phase: number, body: BodyParameters) {
  if (!Number.isFinite(phase) || phase < 0 || phase > 4) throw new Error('Invalid reverse-lunge phase');
  const footWidth = body.lw * 0.9;
  // Native ground View starts at96.9; the older apparatus center is96.4.
  const soleY = 96.9 - footWidth / 2;
  const standY = soleY - 44.5;
  const step = phase <= 1 ? phase : phase >= 3 ? 4 - phase : 1;
  const lowering = phase <= 1 || phase >= 3 ? 0 : phase <= 2 ? phase - 1 : 3 - phase;
  const hp: CanonicalPoint = [48 - 20 * step, standY + (58 - standY) * step + 10.4 * lowering];
  const nk: CanonicalPoint = [hp[0], hp[1] - 24];
  const nLeg = hp, fLeg: CanonicalPoint = [hp[0] - body.hw * 0.5, hp[1]];
  const an: CanonicalPoint = [48, soleY];
  const af: CanonicalPoint = [48 - body.hw * 0.5 - 42.25 * step, soleY - 2.2 * step - 7 * Math.sin(Math.PI * step)];
  const knee = (root: CanonicalPoint, ankle: CanonicalPoint): CanonicalPoint => {
    // The shared elbow solver deliberately rejects a fully straight chain.
    // A standing leg is exactly that tangent case: its knee is the midpoint.
    if (Math.abs(Math.hypot(ankle[0] - root[0], ankle[1] - root[1]) - 44.5) < 1e-9) {
      return [(root[0] + ankle[0]) / 2, (root[1] + ankle[1]) / 2];
    }
    const candidates = elbowCircleSolutions(root, ankle, 22.25, 22.25);
    if (!candidates) throw new Error('Unreachable reverse-lunge leg');
    // Flex toward the toes, rather than choosing a backwards knee solution.
    return candidates[0][0] >= candidates[1][0] ? candidates[0] : candidates[1];
  };
  const nArm: CanonicalPoint = [nk[0] + body.sw * 0.58, nk[1]];
  const fArm: CanonicalPoint = [nk[0] - body.sw * 0.58, nk[1]];
  const el: CanonicalPoint = [nArm[0], nArm[1] + 12.5], wr: CanonicalPoint = [el[0], el[1] + 12];
  const ef: CanonicalPoint = [fArm[0], fArm[1] + 12.5], wf: CanonicalPoint = [ef[0], ef[1] + 12];
  const joints: FigureJoints = { hd: [nk[0], nk[1] - 9], nk, hp,
    waist: [hp[0], nk[1] + 24 * 0.56], nArm, fArm, el, wr, ef, wf,
    nLeg, fLeg, kn: knee(nLeg, an), an, kf: knee(fLeg, af), af };
  // Keep the existing 5.4-unit foot and its ankle attachment. A native rounded
  // View insets each cap centre along the diagonal; endpoint+radius is not
  // its painted sole. This toe rise makes the actual rounded end tangent at
  // landing, with the same 7-unit flight arc above the floor.
  const heelRise = 2.2 * step;
  const toeRise = heelRise / (1 - footWidth / (2 * 5.4));
  const frontFoot: readonly [CanonicalPoint, CanonicalPoint] = [an, [an[0] + 5.4, an[1]]];
  const rearFoot: readonly [CanonicalPoint, CanonicalPoint] = [af,
    [af[0] + Math.sqrt(5.4 ** 2 - toeRise ** 2), af[1] + toeRise]];
  return { joints, frontFoot, rearFoot, footWidth };
}

/**
 * Inverted row geometry (Movement 66).
 * Fixed bar in rack at [54.70, 52.8] (hip height 44.1 dp above floor), planted heels on floor (94.74),
 * rigid body plank, horizontal pull under bar with chest touching bar at peak.
 */
export function invertedRowGeometry(phase: number, body: BodyParameters) {
  const footWidth = body.lw * 0.9;
  const soleY = 96.9 - footWidth / 2;
  const bar: CanonicalPoint = [54.70, 52.8];
  const heelAnchor: CanonicalPoint = [8.0, soleY];
  const phi = (21.22 + phase * (36.65 - 21.22)) * Math.PI / 180;
  const cosP = Math.cos(phi), sinP = Math.sin(phi);

  const an: CanonicalPoint = heelAnchor;
  const kn: CanonicalPoint = [an[0] + 22.25 * cosP, an[1] - 22.25 * sinP];
  const hp: CanonicalPoint = [an[0] + 44.50 * cosP, an[1] - 44.50 * sinP];
  const nk: CanonicalPoint = [an[0] + 68.50 * cosP, an[1] - 68.50 * sinP];
  const hd: CanonicalPoint = [nk[0] + 9.0 * cosP, nk[1] - 9.0 * sinP];
  const waist: CanonicalPoint = [hp[0] + (nk[0] - hp[0]) * 0.44, hp[1] + (nk[1] - hp[1]) * 0.44];

  const sols = elbowCircleSolutions(nk, bar, 12.5, 12.0);
  if (!sols) throw new Error(`Unreachable inverted-row elbow at phase ${phase}`);
  const el: CanonicalPoint = sols[1];

  const joints: FigureJoints = {
    hd, nk, hp, waist,
    nArm: nk, fArm: nk,
    el, wr: bar,
    ef: el, wf: bar,
    nLeg: hp, fLeg: hp,
    kn, an, kf: kn, af: an,
    b: bar,
  };
  return { bar, heelAnchor, footWidth, joints, plankAngleDeg: phi * 180 / Math.PI, barHeightAboveFloor: 96.9 - bar[1] };
}

/**
 * Body tricep press geometry (Movement 152).
 * Fixed bar in rack at [75, 39.9] (chest height 57.0 dp above floor), planted toes on floor (94.74),
 * rigid body plank, isolated elbow extension with bounded upper arm drift (<= 10 deg across cycle).
 */
export function bodyTricepPressGeometry(phase: number, body: BodyParameters) {
  const footWidth = body.lw * 0.9;
  const soleY = 96.9 - footWidth / 2;
  const bar: CanonicalPoint = [75.0, 39.9];
  const heelAnchor: CanonicalPoint = [6.0, soleY];
  const phi = (49.20 - phase * (49.20 - 41.40)) * Math.PI / 180;
  const cosP = Math.cos(phi), sinP = Math.sin(phi);

  const an: CanonicalPoint = heelAnchor;
  const kn: CanonicalPoint = [an[0] + 22.25 * cosP, an[1] - 22.25 * sinP];
  const hp: CanonicalPoint = [an[0] + 44.50 * cosP, an[1] - 44.50 * sinP];
  const nk: CanonicalPoint = [an[0] + 68.50 * cosP, an[1] - 68.50 * sinP];
  const hd: CanonicalPoint = [nk[0] + 9.0 * cosP, nk[1] - 9.0 * sinP];
  const waist: CanonicalPoint = [hp[0] + (nk[0] - hp[0]) * 0.44, hp[1] + (nk[1] - hp[1]) * 0.44];

  const sols = elbowCircleSolutions(nk, bar, 12.5, 12.0);
  if (!sols) throw new Error(`Unreachable body-tricep-press elbow at phase ${phase}`);
  const el: CanonicalPoint = sols[0];

  const d = Math.hypot(nk[0] - bar[0], nk[1] - bar[1]);
  const cosFlex = (12.5 * 12.5 + 12.0 * 12.0 - d * d) / (2 * 12.5 * 12.0);
  const elbowFlexionDeg = 180 - Math.acos(Math.max(-1, Math.min(1, cosFlex))) * 180 / Math.PI;

  const joints: FigureJoints = {
    hd, nk, hp, waist,
    nArm: nk, fArm: nk,
    el, wr: bar,
    ef: el, wf: bar,
    nLeg: hp, fLeg: hp,
    kn, an, kf: kn, af: an,
    b: bar,
  };
  return { bar, heelAnchor, footWidth, joints, elbowFlexionDeg, plankAngleDeg: phi * 180 / Math.PI, barHeightAboveFloor: 96.9 - bar[1] };
}

/** Small hip arc with fixed soft knee; an actual cuff, not a hand cable. */
export function kickbackGeometry(extensionDeg: number, body: BodyParameters): FigureJoints {
  const upper = (extensionDeg + 2.5) * Math.PI / 180;
  const lower = (extensionDeg - 2.5) * Math.PI / 180;
  const hp: CanonicalPoint = [51.5, 51.5], nk: CanonicalPoint = [57.5, 27.5];
  const nLeg = hp, fLeg: CanonicalPoint = [hp[0] - body.hw * 0.5, hp[1]];
  const kn: CanonicalPoint = [hp[0] - 22.25 * Math.sin(upper), hp[1] + 22.25 * Math.cos(upper)];
  const an: CanonicalPoint = [kn[0] - 22.25 * Math.sin(lower), kn[1] + 22.25 * Math.cos(lower)];
  const nArm = nk, fArm: CanonicalPoint = [nk[0] - 4.8, nk[1]];
  const wr: CanonicalPoint = [79.5, 31], wf: CanonicalPoint = [74.7, 31];
  const near = elbowCircleSolutions(nArm, wr, 12.5, 12);
  const far = elbowCircleSolutions(fArm, wf, 12.5, 12);
  if (!near || !far) throw new Error('Unreachable kickback balance grip');
  return { hd: [60.5, 18.5], nk, hp, waist: [54.14, 40.94],
    nArm, fArm, el: near[0], wr, ef: far[0], wf, nLeg, fLeg, kn, an,
    kf: [fLeg[0], fLeg[1] + 22.25], af: [fLeg[0], 96] };
}
const FLYE_INCLINES: Readonly<Record<string, number>> = {
  'dumbbell-flye': 0, 'decline-dumbbell-flyes': -15, 'incline-dumbbell-flyes': 30,
};

/** Supported shoulder arc in the chest-normal/transverse plane. Both world
 * arm segments keep their lengths and15deg elbow bend; this is not a press.
 * Numeric incline/ROM values are schematic draft choices requiring review.
 */
export function flyeGeometry(opening: number, body: BodyParameters, inclineDeg: number) {
  type Point3 = readonly [number, number, number];
  const i = inclineDeg * Math.PI / 180, yaw = 35 * Math.PI / 180;
  const trunk: Point3 = [Math.cos(i), Math.sin(i), 0];
  const chest: Point3 = [-Math.sin(i), Math.cos(i), 0];
  const project = (p: Point3): CanonicalPoint => [43 + p[0] * Math.cos(yaw) - p[2] * Math.sin(yaw), 67 - p[1]];
  const neck: Point3 = [24 * trunk[0], 24 * trunk[1], 0];
  const bend = 15 * Math.PI / 180;
  const phase = Math.atan2(12 * Math.sin(bend), 12.5 + 12 * Math.cos(bend));
  const reach = Math.hypot(12.5 + 12 * Math.cos(bend), 12 * Math.sin(bend));
  // Two wrists retain a7-unit gap at the top; bells never crash together.
  const closed = phase + Math.asin((3.5 - body.sw * 0.92) / reach);
  const a = closed + (85 * Math.PI / 180 - closed) * opening;
  const arm = (side: number) => {
    const shoulder: Point3 = [neck[0], neck[1], side * body.sw * 0.92];
    const elbow: Point3 = [shoulder[0] + 12.5 * chest[0] * Math.cos(a), shoulder[1] + 12.5 * chest[1] * Math.cos(a), shoulder[2] + side * 12.5 * Math.sin(a)];
    const wrist: Point3 = [elbow[0] + 12 * chest[0] * Math.cos(a - bend), elbow[1] + 12 * chest[1] * Math.cos(a - bend), elbow[2] + side * 12 * Math.sin(a - bend)];
    const shaft: readonly [Point3, Point3] = [
      [wrist[0] - 5 * trunk[0], wrist[1] - 5 * trunk[1], wrist[2]],
      [wrist[0] + 5 * trunk[0], wrist[1] + 5 * trunk[1], wrist[2]],
    ];
    return { world: { shoulder, elbow, wrist, shaft }, projected: { shoulder: project(shoulder), elbow: project(elbow), wrist: project(wrist), shaft: shaft.map(project) } };
  };
  const near = arm(1), far = arm(-1);
  const hip = project([0, 0, 0]), nk = project(neck);
  const length = Math.hypot(nk[0] - hip[0], nk[1] - hip[1]);
  const unit: CanonicalPoint = [(nk[0] - hip[0]) / length, (nk[1] - hip[1]) / length];
  const back: CanonicalPoint = [-unit[1], unit[0]];
  const skinCap = Math.max(0.6, length / 32 * 1.6) / 2;
  const padAt = (t: number): CanonicalPoint => {
    const depth = body.sw * 0.58 * (0.9 + 0.1 * t) + skinCap + 2;
    return [hip[0] + (nk[0] - hip[0]) * t + back[0] * depth, hip[1] + (nk[1] - hip[1]) * t + back[1] * depth];
  };
  // Continue beyond the head's contact projection, including the finite
  // rounded tip; tangent contact with an infinite plane alone is insufficient.
  const pad: readonly [CanonicalPoint, CanonicalPoint] = [padAt(inclineDeg < 0 ? -40 / 24 : -6 / 24), padAt(44 / 24)];
  const padLength = Math.hypot(pad[1][0] - pad[0][0], pad[1][1] - pad[0][1]);
  const padNormal: CanonicalPoint = [-(pad[1][1] - pad[0][1]) / padLength, (pad[1][0] - pad[0][0]) / padLength];
  const headRef: CanonicalPoint = [nk[0] + unit[0] * (body.hr + 4.25), nk[1] + unit[1] * (body.hr + 4.25)];
  const headShift = (pad[0][0] - headRef[0]) * padNormal[0] + (pad[0][1] - headRef[1]) * padNormal[1] - (body.hr + 2);
  const head: CanonicalPoint = [headRef[0] + padNormal[0] * headShift, headRef[1] + padNormal[1] * headShift];
  const leg = (side: number) => {
    const z = side * body.hw * 0.8;
    const root: Point3 = [0, 0, z];
    const knee: Point3 = inclineDeg < 0 ? [-20 * trunk[0] + 4 * chest[0], -20 * trunk[1] + 4 * chest[1], z] : [-21.3, -6.9, z];
    const ankle: Point3 = inclineDeg < 0 ? [-40 * trunk[0], -40 * trunk[1], z] : [-18, -29, z];
    const toe: Point3 = [ankle[0] - 5.4 * trunk[0], ankle[1] - 5.4 * trunk[1], z];
    return { world: { root, knee, ankle, toe }, projected: { root: project(root), knee: project(knee), ankle: project(ankle), toe: project(toe) } };
  };
  const nearLeg = leg(1), farLeg = leg(-1);
  const joints: FigureJoints = { hd: head, nk, hp: hip,
    waist: [nk[0] + (hip[0] - nk[0]) * 0.56, nk[1] + (hip[1] - nk[1]) * 0.56],
    nArm: near.projected.shoulder, fArm: far.projected.shoulder,
    el: near.projected.elbow, wr: near.projected.wrist, ef: far.projected.elbow, wf: far.projected.wrist,
    nLeg: nearLeg.projected.root, fLeg: farLeg.projected.root,
    kn: nearLeg.projected.knee, an: nearLeg.projected.ankle, kf: farLeg.projected.knee, af: farLeg.projected.ankle };
  return { near, far, nearLeg, farLeg, joints, pad, padNormal, chest, trunk, project,
    shoulderBearingDeg: a * 180 / Math.PI, elbowFlexionDeg: 15, inclineDeg, yawDeg: 35 };
}

function layoutFlyeDumbbell(fly: ReturnType<typeof flyeGeometry>, near: boolean): FigurePrim[] {
  const arm = near ? fly.near : fly.far;
  const [a, b] = arm.projected.shaft;
  const color: ColorRole = near ? 'textHi' : 'textLow', opacity = near ? 1 : 0.9;
  const out: FigurePrim[] = [{ kind: 'bone', x1: a[0], y1: a[1], x2: b[0], y2: b[1], w: 2.2, color, opacity }];
  for (const p of arm.world.shaft) {
    const left = fly.project([p[0] - 2.3 * fly.chest[0], p[1] - 2.3 * fly.chest[1], p[2]]);
    const right = fly.project([p[0] + 2.3 * fly.chest[0], p[1] + 2.3 * fly.chest[1], p[2]]);
    out.push({ kind: 'bone', x1: left[0], y1: left[1], x2: right[0], y2: right[1], w: 2.3, color, opacity, stroke: 'ink1', strokeWidth: 0.6 });
  }
  return out;
}
type RopePoint3 = readonly [number, number, number];

// These bilateral wrists are separated only transversely; the pulley is in
// their sagittal midplane. A free junction lies toward the pulley, so its
// equal branch tensions balance the main cable, including a stationary hold.
function tautRopeJunction(near: RopePoint3, far: RopePoint3, pulley: RopePoint3): RopePoint3 {
  const midpoint = near.map((v, i) => (v + far[i]) / 2);
  const halfSpan = Math.hypot(...near.map((v, i) => v - far[i])) / 2;
  const direction = pulley.map((v, i) => v - midpoint[i]);
  const length = Math.hypot(...direction);
  const offset = Math.sqrt(12 ** 2 - halfSpan ** 2);
  return midpoint.map((v, i) => v + direction[i] / length * offset) as unknown as RopePoint3;
}

/** Whole straight arms sweep from overhead/front to thighs at the shoulders. */
export function straightArmPulldownGeometry(bearingDeg: number, body: BodyParameters) {
  type Point3 = readonly [number, number, number];
  const a = bearingDeg * Math.PI / 180, yaw = 20 * Math.PI / 180;
  const project = (p: Point3): CanonicalPoint => [49 + p[0] * Math.cos(yaw) - p[2] * Math.sin(yaw), 31 - p[1]];
  const arm = (side: number) => {
    const shoulder: Point3 = [0, 0, side * body.sw * 0.92];
    const elbow: Point3 = [12.5 * Math.cos(a), -12.5 * Math.sin(a), shoulder[2]];
    const wrist: Point3 = [24.5 * Math.cos(a), -24.5 * Math.sin(a), shoulder[2]];
    return { world: { shoulder, elbow, wrist }, projected: { shoulder: project(shoulder), elbow: project(elbow), wrist: project(wrist) } };
  };
  const near = arm(1), far = arm(-1);
  const pulley: Point3 = [(88 - 49) / Math.cos(yaw), 31 - 4, 0];
  const junction = tautRopeJunction(near.world.wrist, far.world.wrist, pulley);
  return { near, far, junction: { world: junction, projected: project(junction) },
    pulley: { world: pulley, projected: project(pulley) }, yawDeg: 20 };
}

/** Fixed upper arms, actual elbow flexion and source-specific rope spreading.
 * World X points forward, Y up, Z transverse; the30deg oblique projection
 * exposes the sagittal elbow action and both attachment grips together.
 */
export function pushdownGeometry(flexionDeg: number, body: BodyParameters, rope: boolean) {
  type Point3 = readonly [number, number, number];
  const a = flexionDeg * Math.PI / 180;
  const yaw = Math.PI / 6;
  const project = (p: Point3): CanonicalPoint => [45.3 + p[0] * Math.cos(yaw) - p[2] * Math.sin(yaw), 27.6 - p[1]];
  const arm = (side: number) => {
    const shoulder: Point3 = [0, 0, side * body.sw * 0.92];
    const elbow: Point3 = [0, -12.5, shoulder[2]];
    const horizontal = 12 * Math.sin(a);
    // Rope hands start close together in front. At full extension they sit
    // directly below the pinned elbows beside the thighs. This preserves
    // forearm length AND straight elbows; spreading does not invent a bend.
    const dz = rope ? -side * body.sw * 0.92 * 0.7 * Math.sin(a) : 0;
    const wrist: Point3 = [Math.sqrt(Math.max(0, horizontal ** 2 - dz ** 2)), -12.5 - 12 * Math.cos(a), shoulder[2] + dz];
    return { world: { shoulder, elbow, wrist }, projected: { shoulder: project(shoulder), elbow: project(elbow), wrist: project(wrist) } };
  };
  const near = arm(1), far = arm(-1);
  const pulley: Point3 = [(84 - 45.3) / Math.cos(yaw), 27.6 - 10, 0];
  const junction = tautRopeJunction(near.world.wrist, far.world.wrist, pulley);
  return { near, far, junction: { world: junction, projected: project(junction) },
    pulley: { world: pulley, projected: project(pulley) }, yawDeg: 30 };
}

/**
 * Orthographic45deg oblique projection of a WORLD-LATERAL raise. World axes:
 * X is forward along the horizontal trunk, Y is up, Z is transverse. The
 * elbows flex15deg in the Y/Z plane; neither arm rows backwards along X.
 * Expose world joints as well as projection so audits can measure actual
 * lengths/plane/angle rather than treating foreshortened pixels as anatomy.
 */
export function supportedRearRaiseGeometry(angleDeg: number, body: BodyParameters) {
  const a = angleDeg * Math.PI / 180;
  const bend = 15 * Math.PI / 180;
  const yaw = 45 * Math.PI / 180;
  type Point3 = readonly [number, number, number];
  const project = (p: Point3): CanonicalPoint => [60 + p[0] * Math.cos(yaw) - p[2] * Math.sin(yaw), 55 - p[1]];
  const arm = (side: number) => {
    const shoulder: Point3 = [0, 0, side * body.sw];
    const elbow: Point3 = [0, -12.5 * Math.cos(a), shoulder[2] + side * 12.5 * Math.sin(a)];
    const wrist: Point3 = [0, elbow[1] - 12 * Math.cos(a - bend), elbow[2] + side * 12 * Math.sin(a - bend)];
    return { world: { shoulder, elbow, wrist }, projected: { shoulder: project(shoulder), elbow: project(elbow), wrist: project(wrist) } };
  };
  return { yawDeg: 45, elbowFlexionDeg: 15, near: arm(1), far: arm(-1),
    // The fixed incline pad is centered at68,63, width4. The head's outer
    // RN circle's OUTER radius is hr: its border is inside the View box.
    // The same outer bounds are used by the evidence rasterizer.
    head: [68 - (body.hr + 2) * HEAD_BENCH_NORMAL[0],
      63 - (body.hr + 2) * HEAD_BENCH_NORMAL[1]] as CanonicalPoint };
}

/** Bone-length audit: returns each tracked segment's length in box units. */
export function segmentLengths(p: CanonicalPose): Record<string, number> {
  const d = (a: CanonicalPoint, b: CanonicalPoint): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
  return {
    spine: d(p.nk, p.hp),
    nearThigh: d(p.hp, p.kn),
    nearShin: d(p.kn, p.an),
    farThigh: d(p.hp, p.kf),
    farShin: d(p.kf, p.af),
    nearForearm: d(p.el, p.wr),
    farForearm: d(p.ef, p.wf),
  };
}

/**
 * Resolve the figure's DRAWN joint positions: applies the sagittal far-limb
 * separation and derives the synthetic roots (shoulders, leg roots, waist)
 * exactly as the layout does. Exported so audits measure what is actually
 * drawn, not the raw authored joints — the distinction that let an earlier
 * audit miss a visible far-thigh undershoot.
 */
export interface FigureJoints {
  hd: CanonicalPoint;
  nk: CanonicalPoint;
  hp: CanonicalPoint;
  waist: CanonicalPoint;
  nArm: CanonicalPoint;
  fArm: CanonicalPoint;
  nLeg: CanonicalPoint;
  fLeg: CanonicalPoint;
  el: CanonicalPoint;
  wr: CanonicalPoint;
  ef: CanonicalPoint;
  wf: CanonicalPoint;
  kn: CanonicalPoint;
  an: CanonicalPoint;
  kf: CanonicalPoint;
  af: CanonicalPoint;
  b?: CanonicalPoint;
}

export function resolveFigureJoints(pose: CanonicalPose, opts: FigureOptions): FigureJoints {
  const { view, body = CANONICAL_BODY_PARAMETERS } = opts;
  const front = view === 'front';
  const slug = slugOf(opts.assetKey);

  const j: CanonicalPose = applyJointOffsets(pose, opts.jointOffsets);
  if (slug === REVERSE_LUNGE && j.rl !== undefined) return reverseLungeGeometry(j.rl, body).joints;
  if (slug === 'inverted-row' && j.ir !== undefined) return invertedRowGeometry(j.ir, body).joints;
  if (slug === 'body-tricep-press' && j.tp !== undefined) return bodyTricepPressGeometry(j.tp, body).joints;
  if (slug === ANKLE_KICKBACK && j.ke !== undefined) return kickbackGeometry(j.ke, body);
  if (FLYE_INCLINES[slug] !== undefined && j.fo !== undefined) {
    return flyeGeometry(j.fo, body, FLYE_INCLINES[slug]).joints;
  }
  // Where the far limb emerges from behind the torso must travel with its
  // chain: a parallel displacement keeps every far segment's drawn length
  // identical to its authored length (shifting only the endpoints shortened
  // the drawn far thigh/upper arm by up to 21% — round-3 drawn-geometry
  // audit). The shifted root is hidden behind the torso in side view.
  let farLegShift: [number, number] = [0, 0];
  let farArmShift: [number, number] = [0, 0];
  if (!front) {
    const off = PERSPECTIVE_BARBELL_SLUGS.has(slug) ? [-8, -2] : FAROFF[slug] ?? FAROFF_DEFAULT;
    const close = (a?: CanonicalPoint, b?: CanonicalPoint): boolean =>
      a !== undefined && b !== undefined && Math.hypot(a[0] - b[0], a[1] - b[1]) < 4;
    if (close(j.kf, j.kn) && close(j.af, j.an)) {
      farLegShift = [off[0], off[1]];
      j.kf = [j.kf[0] + off[0], j.kf[1] + off[1]];
      j.af = [j.af[0] + off[0], j.af[1] + off[1]];
      // The separation vector must never bury a far foot under the floor: a
      // downward offset (bench press +4) pushed the far ankle to y=98 while
      // the ground line sits at 96.9, drawing the foot through the floor
      // (round-3 reviewer finding, bench press). Translate the whole far
      // leg chain — root included — back up; a pure translation, so segment
      // lengths hold.
      if (j.af[1] > GROUND_LINE) {
        const dy = j.af[1] - GROUND_LINE;
        j.af = [j.af[0], j.af[1] - dy];
        j.kf = [j.kf[0], j.kf[1] - dy];
        farLegShift = [farLegShift[0], farLegShift[1] - dy];
      }
    }
    if (close(j.ef, j.el) && close(j.wf, j.wr)) {
      const armOff = PERSPECTIVE_BARBELL_SLUGS.has(slug) ? [-8, -2] : off;
      farArmShift = [armOff[0], armOff[1]];
      j.ef = [j.ef[0] + armOff[0], j.ef[1] + armOff[1]];
      j.wf = [j.wf[0] + armOff[0], j.wf[1] + armOff[1]];
    }
  }

  const ax: [number, number] = [j.hp[0] - j.nk[0], j.hp[1] - j.nk[1]];
  // Owner batch (B1-20-R2): the slight body turn, front view only. At ten
  // degrees a geometric yaw is invisible on a front-view figure, so the turn is
  // drawn the way it reads: the body carries its centre of mass a little toward
  // the loaded (near-wrist) side, the shoulders counter-roll, and the head stays
  // over the base. The whole figure translates together so no drawn segment
  // changes length; only the head and neck hold back, which is what reads as a
  // lean. A movement that declares nothing is untouched: the farmer carry stays
  // square, the suitcase carry is the only one that turns.
  const turn = front ? opts.bodyTurnDeg ?? 0 : 0;
  if (turn !== 0) {
    const loaded = j.wr[0] < j.nk[0] ? -1 : 1;
    // A 10-degree yaw is geometrically invisible in a front view (cos 10 = 0.985),
    // so the turn is drawn the way a coach reads it: the pelvis and legs travel
    // 2.6 units toward the loaded side under a level head and shoulders, and the
    // wrists roll opposite ways. Owner batch B1-20-R2; the scanner proves a
    // declared turn actually changes the drawing (C.bodyTurn).
    const shift = (turn / 10) * 2.6;
    const roll = (turn / 10) * 0.8;
    const move = (p: CanonicalPoint): CanonicalPoint => [p[0] + loaded * shift, p[1]];
    (['hp', 'kn', 'kf', 'an', 'af', 'el', 'ef'] as const).forEach((k) => {
      const p = j[k];
      if (p) j[k] = move(p);
    });
    j.nk = [j.nk[0] + loaded * shift * 0.6, j.nk[1]];
    j.hd = [j.hd[0] + loaded * shift * 0.4, j.hd[1]];
    j.wr = [j.wr[0] + loaded * shift, j.wr[1] - roll];
    j.wf = [j.wf[0] + loaded * shift, j.wf[1] + roll];
  }
  const L = Math.hypot(ax[0], ax[1]) || 1;
  const pp: [number, number] = [-ax[1] / L, ax[0] / L];
  const at = (f: number): [number, number] => [j.nk[0] + ax[0] * f, j.nk[1] + ax[1] * f];
  const offP = (pt: CanonicalPoint, d: number): [number, number] =>
    [pt[0] + pp[0] * d, pt[1] + pp[1] * d];

  const sw = front ? body.sw : body.sw * 0.58;
  const hw = front ? body.hw : body.hw * 0.92;
  const waist = at(0.56);
  let nArm = front ? offP(j.nk, sw * 0.92) : ([j.nk[0], j.nk[1]] as CanonicalPoint);
  const baseFarArm = front ? offP(j.nk, -sw * 0.92) : ([j.nk[0], j.nk[1]] as CanonicalPoint);
  let fArm: CanonicalPoint = [baseFarArm[0] + farArmShift[0], baseFarArm[1] + farArmShift[1]];
  const nLeg = front ? offP(j.hp, hw * 0.8) : ([j.hp[0], j.hp[1]] as CanonicalPoint);
  const baseFarLeg = front ? offP(j.hp, -hw * 0.8) : ([j.hp[0], j.hp[1]] as CanonicalPoint);
  const fLeg: CanonicalPoint = [baseFarLeg[0] + farLegShift[0], baseFarLeg[1] + farLegShift[1]];

  // Entry 0183: a grip change on a keyed slug re-solves from the KEYED arm, not
  // from the authored elbow. The authored elbow is a two-decimal point and the
  // male and female shoulder roots sit off it, so a grip variant would have drawn
  // an arm of a different length on every body than the base draws.
  const gripSpec = ELBOW_ON_SHOULDER_CIRCLE.get(slug);
  if (front && gripSpec && opts.gripDelta !== undefined && opts.gripDelta !== 0) {
    const nearKeyed = elbowCircleSolutions(nArm, j.wr, gripSpec.upper, gripSpec.fore);
    const farKeyed = elbowCircleSolutions(fArm, j.wf, gripSpec.upper, gripSpec.fore);
    if (nearKeyed) j.el = nearKeyed[gripSpec.side === 1 ? 0 : 1];
    if (farKeyed) j.ef = farKeyed[gripSpec.side === 1 ? 1 : 0];
  }

  // Batch 1 (B1-300): a declared grip change re-solves both arms from the drawn
  // shoulder roots, holding this pose's own drawn bone lengths. Front view only
  // (the contract refuses it elsewhere); a movement that declares none is
  // untouched.
  if (front && opts.gripDelta !== undefined && opts.gripDelta !== 0) {
    const grip = resolveGripArms({ nk: j.nk, nArm, fArm, el: j.el, wr: j.wr, ef: j.ef, wf: j.wf },
      opts.gripDelta);
    j.el = grip.near.el; j.wr = grip.near.wr;
    j.ef = grip.far.el; j.wf = grip.far.wr;
  }

  // Entry 0181: these slugs re-solve BOTH elbows on the drawn shoulder circle,
  // per body, so the upper arm holds its declared length on all three bodies.
  // A frame the declared arm cannot reach keeps its authored elbow untouched
  // rather than being silently straightened.
  // A movement with its own gripDelta has already had its elbow re-solved on
  // the shoulder circle by resolveGripArms, and the grip contract owns that
  // result. Re-solving here would override it.
  const armSpec = opts.gripDelta === undefined ? ELBOW_ON_SHOULDER_CIRCLE.get(slug) : undefined;
  if (armSpec) {
    const near = elbowCircleSolutions(nArm, j.wr, armSpec.upper, armSpec.fore);
    if (near) j.el = near[armSpec.side === 1 ? 0 : 1];
    const far = elbowCircleSolutions(fArm, j.wf, armSpec.upper, armSpec.fore);
    // In front view the two arm roots are mirror images about the centreline, so
    // a mirrored pair of arms needs MIRRORED elbow solutions. Picking the same
    // index for both sent one elbow high by the shoulder while the other dropped
    // 22.9 below it: the hands mirrored to 0.01 and the elbows missed by up to
    // 13.3, which is what "the arms do not mirror" looked like on the sheet.
    // Side view shares one root, so the same index is correct there.
    const farIndex = front ? (armSpec.side === 1 ? 1 : 0) : (armSpec.side === 1 ? 0 : 1);
    if (far) j.ef = far[farIndex];
  }

  if (SHRUG_SLUGS.has(slug) && j.se !== undefined) {
    // Translate each whole extended arm with its shoulder girdle. The head,
    // trunk, pelvis and leg chain are independent, stationary anchors.
    const elevation = j.se;
    const shift = (p: CanonicalPoint): CanonicalPoint => [p[0] - elevation / 4, p[1] - elevation];
    nArm = shift(nArm); fArm = shift(fArm);
    const dx = slug === 'barbell-shrug-behind-the-back' ? -6.2
      : slug === 'barbell-shrug' || slug === 'cable-shrugs' ? 6.2 : 1.2;
    const dy = Math.sqrt(24.5 ** 2 - dx ** 2);
    const elbow = (p: CanonicalPoint): CanonicalPoint => [p[0] + dx * 12.5 / 24.5, p[1] + dy * 12.5 / 24.5];
    const wrist = (p: CanonicalPoint): CanonicalPoint => [p[0] + dx, p[1] + dy];
    j.el = elbow(nArm); j.wr = wrist(nArm);
    j.ef = elbow(fArm); j.wf = wrist(fArm);
  }
  if (PREACHER_SLUGS.has(slug) && j.ca !== undefined && !front) {
    // The supported upper arm is fixed at60deg, not re-solved from a moving
    // wrist. Interpolate the forearm bearing on its12-unit elbow circle.
    const a = j.ca * Math.PI / 180;
    const elbow = (p: CanonicalPoint): CanonicalPoint => [p[0] + 6.25, p[1] + 12.5 * Math.sin(Math.PI / 3)];
    const wrist = (p: CanonicalPoint): CanonicalPoint => [p[0] + 12 * Math.cos(a), p[1] + 12 * Math.sin(a)];
    j.el = elbow(nArm); j.ef = elbow(fArm);
    j.wr = wrist(j.el); j.wf = wrist(j.ef);
  }
  if (slug === HEAD_SUPPORTED_RAISE && j.ra !== undefined) {
    const raise = supportedRearRaiseGeometry(j.ra, body);
    nArm = raise.near.projected.shoulder; fArm = raise.far.projected.shoulder;
    j.el = raise.near.projected.elbow; j.wr = raise.near.projected.wrist;
    j.ef = raise.far.projected.elbow; j.wf = raise.far.projected.wrist;
    j.hd = raise.head;
  }
  if (PUSHDOWN_SLUGS.has(slug) && j.pe !== undefined) {
    const push = pushdownGeometry(j.pe, body, slug === 'triceps-pushdown-rope-attachment');
    nArm = push.near.projected.shoulder; fArm = push.far.projected.shoulder;
    j.el = push.near.projected.elbow; j.wr = push.near.projected.wrist;
    j.ef = push.far.projected.elbow; j.wf = push.far.projected.wrist;
  }
  if (slug === STRAIGHT_ARM_PULLDOWN && j.sa !== undefined) {
    const pull = straightArmPulldownGeometry(j.sa, body);
    nArm = pull.near.projected.shoulder; fArm = pull.far.projected.shoulder;
    j.el = pull.near.projected.elbow; j.wr = pull.near.projected.wrist;
    j.ef = pull.far.projected.elbow; j.wf = pull.far.projected.wrist;
  }

  return {
    hd: j.hd, nk: j.nk, hp: j.hp, waist,
    nArm, fArm, nLeg, fLeg,
    el: j.el, wr: j.wr, ef: j.ef, wf: j.wf,
    kn: j.kn, an: j.an, kf: j.kf, af: j.af,
    ...(j.b !== undefined ? { b: j.b } : {}),
  };
}

/** Bone lengths of the DRAWN figure, in box units (post--separation). */
export function drawnSegmentLengths(pose: CanonicalPose, opts: FigureOptions): Record<string, number> {
  const f = resolveFigureJoints(pose, opts);
  const d = (a: CanonicalPoint, b: CanonicalPoint): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const footLen = (an: CanonicalPoint): number => {
    const drop = Math.min(96.4, an[1] + (96.4 - an[1]) * 0.85);
    return Math.min(5.4, Math.hypot(5.4, drop - an[1]));
  };
  return {
    spine: d(f.nk, f.hp),
    chest: d(f.nk, f.waist),
    pelvis: d(f.waist, f.hp),
    nearThigh: d(f.nLeg, f.kn),
    nearShin: d(f.kn, f.an),
    nearFoot: footLen(f.an),
    farThigh: d(f.fLeg, f.kf),
    farShin: d(f.kf, f.af),
    farFoot: footLen(f.af),
    nearUpperArm: d(f.nArm, f.el),
    nearForearm: d(f.el, f.wr),
    farUpperArm: d(f.fArm, f.ef),
    farForearm: d(f.ef, f.wf),
    neck: d([f.nk[0] + 0.02 * (f.hp[0] - f.nk[0]), f.nk[1] + 0.02 * (f.hp[1] - f.nk[1])], f.hd),
  };
}

/**
 * Layout one canonical pose into renderer primitives, in BOX units.
 * Order of the returned array IS the z-order (paint back to front).
 */
export function layoutCanonicalFigure(pose: CanonicalPose, opts: FigureOptions): FigurePrim[] {
  const { view, body = CANONICAL_BODY_PARAMETERS } = opts;
  const front = view === 'front';
  const slug = slugOf(opts.assetKey);

  const f = resolveFigureJoints(pose, opts);
  // The drawn pose carries the variant's declared offsets (B1-55), exactly as
  // resolveFigureJoints applies them, so every layer below draws offset joints.
  const j: CanonicalPose = applyJointOffsets(pose, opts.jointOffsets);
  // Post-separation limb endpoints (mirrors FigureJoints).
  const { nArm, fArm, nLeg, fLeg } = f;
  // Entry 0182 (owner audit, fix items 1-4 and 12): a slug whose elbow is
  // re-solved on the drawn shoulder circle must DRAW that elbow. Re-solving in
  // resolveFigureJoints alone moved the joint the checker measures while the
  // bones kept the authored elbow, so the slide never changed and L9 failed on
  // every keyed movement. Same contract as the grip and turn branches below:
  // what is measured is what is drawn.
  const keyedArms = opts.gripDelta === undefined && ELBOW_ON_SHOULDER_CIRCLE.has(slug);
  if (!front) {
    j.kf = f.kf; j.af = f.af; j.ef = f.ef; j.wf = f.wf;
    if (keyedArms) { j.el = f.el; j.wr = f.wr; }
  } else if (opts.bodyTurnDeg) {
    // Owner batch (B1-20-R2): a front-view body turn must be drawn from the
    // RESOLVED pose. Drawing from the raw pose moved only the far-side bones
    // (which read from `f`) and left the pelvis, the near limbs and the held
    // implement where they were — the scanner's C.bodyTurn check caught it.
    j.hp = f.hp; j.nk = f.nk; j.hd = f.hd;
    j.kn = f.kn; j.an = f.an; j.kf = f.kf; j.af = f.af;
    j.el = f.el; j.wr = f.wr; j.ef = f.ef; j.wf = f.wf;
  } else if (opts.gripDelta !== undefined && opts.gripDelta !== 0) {
    // Batch 1 (B1-300): the re-solved arms are drawn, and the bar and cable
    // (Layer 6) follow the re-solved hands.
    j.el = f.el; j.wr = f.wr; j.ef = f.ef; j.wf = f.wf;
  } else if (keyedArms) {
    j.el = f.el; j.wr = f.wr; j.ef = f.ef; j.wf = f.wf;
  }
  if (slug === HEAD_SUPPORTED_RAISE && pose.ra !== undefined) j.hd = f.hd;
  if (PUSHDOWN_SLUGS.has(slug) && pose.pe !== undefined) {
    j.el = f.el; j.wr = f.wr; j.ef = f.ef; j.wf = f.wf;
  }
  if (slug === STRAIGHT_ARM_PULLDOWN && pose.sa !== undefined) {
    j.el = f.el; j.wr = f.wr; j.ef = f.ef; j.wf = f.wf;
  }
  const fly = FLYE_INCLINES[slug] !== undefined && pose.fo !== undefined
    ? flyeGeometry(pose.fo, body, FLYE_INCLINES[slug]) : null;
  if (fly) for (const key of ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'an', 'kf', 'af'] as const) j[key] = f[key];
  const reverseLunge = slug === REVERSE_LUNGE && pose.rl !== undefined
    ? reverseLungeGeometry(pose.rl, body) : null;
  if (reverseLunge) for (const key of ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'an', 'kf', 'af'] as const) j[key] = f[key];
  const invertedRow = slug === 'inverted-row' && pose.ir !== undefined;
  if (invertedRow) for (const key of ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'an', 'kf', 'af'] as const) j[key] = f[key];
  const bodyTricepPress = slug === 'body-tricep-press' && pose.tp !== undefined;
  if (bodyTricepPress) for (const key of ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'an', 'kf', 'af'] as const) j[key] = f[key];
  const kickback = slug === ANKLE_KICKBACK && pose.ke !== undefined;
  if (kickback) for (const key of ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'an', 'kf', 'af'] as const) j[key] = f[key];
  const farColor: ColorRole = front ? 'textHi' : 'textLow';
  const farOpacity = front ? 1 : 0.9;
  const sw = front ? body.sw : body.sw * 0.58;
  const hw = front ? body.hw : body.hw * 0.92;
  const at = (t: number): [number, number] =>
    [j.nk[0] + (j.hp[0] - j.nk[0]) * t, j.nk[1] + (j.hp[1] - j.nk[1]) * t];

  const bone = (
    p1: CanonicalPoint, p2: CanonicalPoint, w: number, color: ColorRole, opacity: number,
  ): BonePrim => ({ kind: 'bone', x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], w, color, opacity });

  const prims: FigurePrim[] = [];

  // ---- Layer 1: apparatus / structure (behind everything but ground) ----
  if (!PREACHER_SLUGS.has(slug) && slug !== HEAD_SUPPORTED_RAISE) prims.push(...apparatus(slug, front, body));
  if (kickback) {
    // Cable is behind the support and working legs; cuff rides the ankle in
    // the final layer. Both balance hands grip the connected high crossbar.
    prims.push(bone([84, 10], [84, GROUND_LINE], 1.6, 'textLow', 0.75),
      bone([72, 31], [84, 31], 1.6, 'textMid', 1),
      { kind: 'circle', cx: 84, cy: 89, r: 2.2, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 },
      bone([84, 89], j.an, 1.4, 'textMid', 1));
  }
  if (fly) {
    prims.push(bone(fly.pad[0], fly.pad[1], 4, 'textMid', 1));
    for (const t of [0.18, 0.82]) {
      const p: CanonicalPoint = [fly.pad[0][0] + (fly.pad[1][0] - fly.pad[0][0]) * t, fly.pad[0][1] + (fly.pad[1][1] - fly.pad[0][1]) * t];
      prims.push(bone(p, [p[0], GROUND_LINE], 1.6, 'textLow', 0.75));
    }
  }
  // Entry 0181: a supine barbell press is side view, so the bar reads END-ON
  // at the grip - a plate and a hub - rather than as a shaft with a plate at
  // each end, which ran across the head. Only these slugs draw the short form.
  const endOn = END_ON_BARBELL_SLUGS.has(slug) && !!j.b;
  // Entry 0182 item 7: the EZ-bar is a distinct end-on shape (cambered shaft
  // off the hub); every other end-on bar keeps the plain disc form.
  const endOnBar = endOn
    ? (slug === 'close-grip-ez-bar-press'
      ? layoutEndOnEzBar(j.b as CanonicalPoint)
      : layoutEndOnBarbell(j.b as CanonicalPoint))
    : null;
  const perspectiveBar = PERSPECTIVE_BARBELL_SLUGS.has(slug) && !endOn && j.b
    ? layoutPerspectiveBarbell(j.b) : null;
  // The far sleeve and shaft pass behind the body; the near half occludes it.
  // This order is shared by native Views and evidence, not an SVG-only trick.
  if (perspectiveBar) prims.push(...perspectiveBar.far);
  // B1-113: a low cable is layered by depth (see CABLE_LOW_SLUGS).
  const lowCable = (CABLE_LOW_SLUGS.has(slug) && !front) || CABLE_CURL_SLUGS.has(slug)
    ? layoutLowCable(j, body, farColor, farOpacity) : null;
  // Family 15: the incline cable press rides the same depth groups to its own
  // low pulley at the head end of the bench.
  const inclineCable = slug === 'incline-cable-chest-press' && !front
    ? layoutInclineCable(j, body, farColor, farOpacity) : null;
  const cableDraw = lowCable ?? inclineCable;
  if (cableDraw) prims.push(...cableDraw.farCable);

  // ---- Layer 2: far limbs ----
  prims.push(bone(fArm, j.ef, body.lw * 0.88, farColor, farOpacity));
  prims.push(bone(j.ef, j.wf, body.lw * 0.72, farColor, farOpacity));
  prims.push(bone(fLeg, j.kf, body.lw * 1.18, farColor, farOpacity));
  prims.push(bone(j.kf, j.af, body.lw * 0.9, farColor, farOpacity));
  if (reverseLunge) prims.push(bone(reverseLunge.rearFoot[0], reverseLunge.rearFoot[1], reverseLunge.footWidth, farColor, farOpacity));
  else if (fly && fly.inclineDeg < 0) prims.push(bone(j.af, fly.farLeg.projected.toe, body.lw * 0.82, farColor, farOpacity));
  else if (!NOFEET.has(slug)) prims.push(foot(j.af, farColor, body, front, farOpacity,
    PERSPECTIVE_BARBELL_SLUGS.has(slug) ? 94.4 : 96.4));
  if (cableDraw) prims.push(...cableDraw.farHandle);
  if (fly) prims.push(...layoutFlyeDumbbell(fly, false));
  if (reverseLunge) prims.push(...layoutHammerDumbbell(j.wf, j.ef, false));

  // The row's bench sits BETWEEN the far leg and the torso: the kneeling
  // athlete's standing leg passes behind the bench, so the pad occludes it.
  // Drawing the pad with Layer 1 apparatus (behind the far limbs) put the far
  // shin in front of the bench slab (B1-247-R2).
  if (ROW_SLUGS.has(slug)) {
    prims.push({ kind: 'rect', x: ROW_BENCH.x, y: ROW_BENCH.top, w: ROW_BENCH.w,
      h: ROW_BENCH.h, rx: 1, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    prims.push(bone([ROW_BENCH.x + 3, ROW_BENCH.top + ROW_BENCH.h], [ROW_BENCH.x + 3, GROUND_LINE],
      1.6, 'textLow', 0.75));
    prims.push(bone([ROW_BENCH.x + ROW_BENCH.w - 3, ROW_BENCH.top + ROW_BENCH.h],
      [ROW_BENCH.x + ROW_BENCH.w - 3, GROUND_LINE], 1.6, 'textLow', 0.75));
    // The supports are dimmed: apparatus must not carry the opaque near-colour
    // signature the torso layer is read by (torso engineering test), nor read as
    // a limb (the far-arm width).
  }

  // ---- Layer 3: torso ----
  // The oblique transverse shoulder roots must visibly join the trunk;
  // front/side silhouette bars alone cannot span this projected girdle.
  if (fly) prims.push(bone(fArm, nArm, body.lw * 0.88, 'textLow', 1));
  // The far arm is behind the head-support bench; the near arm is in front.
  if (slug === HEAD_SUPPORTED_RAISE) prims.push(...apparatus(slug, front, body));
  // Overlapping transverse bars form one shoulder→waist→hip silhouette.
  // No per-bar strokes or alpha: either would expose internal ring seams.
  // textLow separates the solid trunk from textHi near limbs and implements;
  // the existing far→torso→near layering remains unchanged. This is a View-
  // compatible approximation, not a polygon or a change to authored joints.
  const spineLength = Math.hypot(j.hp[0] - j.nk[0], j.hp[1] - j.nk[1]);
  const normal: CanonicalPoint = spineLength > 0
    ? [-(j.hp[1] - j.nk[1]) / spineLength, (j.hp[0] - j.nk[0]) / spineLength]
    : [1, 0];
  const waistWidth = Math.min(sw, hw) * 0.72;
  const slices = 32;
  const thickness = Math.max(0.6, (spineLength / slices) * 1.6);
  for (let i = 0; i <= slices; i++) {
    const t = i / slices;
    const center = at(t);
    // Profile depth tapers directly to the hips: carrying the frontal waist
    // pinch and pelvic breadth into side view produced a skirt-like flare.
    // Keep the front-view silhouette exactly as it was in the prior trial.
    const halfWidth = !front
      ? sw + (Math.min(hw, sw * 0.9) - sw) * t
      : t <= 0.56
        ? sw + (waistWidth - sw) * (t / 0.56)
        : waistWidth + (hw - waistWidth) * ((t - 0.56) / 0.44);
    prims.push(bone(
      [center[0] - normal[0] * halfWidth, center[1] - normal[1] * halfWidth],
      [center[0] + normal[0] * halfWidth, center[1] + normal[1] * halfWidth],
      thickness, 'textLow', 1,
    ));
  }

  // B1-113: the near cable passes behind the near leg, never over it.
  if (cableDraw) prims.push(...cableDraw.nearCable);

  // ---- Layer 4: near limbs ----
  // The preacher pad is in front of the chest; keep its support surface
  // visible while the working upper arm occludes it on the near side.
  if (PREACHER_SLUGS.has(slug)) prims.push(...apparatus(slug, front, body));
  prims.push(bone(nLeg, j.kn, body.lw * 1.18, 'textHi', 1));
  prims.push(bone(j.kn, j.an, body.lw * 0.9, 'textHi', 1));
  if (reverseLunge) prims.push(bone(reverseLunge.frontFoot[0], reverseLunge.frontFoot[1], reverseLunge.footWidth, 'textHi', 1));
  else if (fly && fly.inclineDeg < 0) prims.push(bone(j.an, fly.nearLeg.projected.toe, body.lw * 0.82, 'textHi', 1));
  else if (!NOFEET.has(slug)) prims.push(foot(j.an, 'textHi', body, front, 1));
  const nearUpperArm = bone(nArm, j.el, body.lw * 0.88, 'textHi', 1);
  const nearForearm = bone(j.el, j.wr, body.lw * 0.72, 'textHi', 1);
  // A seated side-view press stacks the pressing arm beside the ear: the arm
  // is on the NEAR side of the head, so it draws AFTER the head ring —
  // otherwise the lockout elbow (authored over the shoulder axis per O-8)
  // hides inside the head circle and the press reads as clipped.
  const armAfterHead = slug === 'dumbbell-shoulder-press';
  if (!armAfterHead) {
    prims.push(nearUpperArm, nearForearm);
  }

  // ---- Layer 5: neck & head ----
  if (SHRUG_SLUGS.has(slug) && pose.se !== undefined && pose.se > 0) {
    prims.push(bone(j.nk, nArm, body.lw * 0.8, 'textHi', 1));
  }
  // Cable/rope attachment LINES (textMid) are drawn BEFORE the head so the
  // head ring occludes them: a cable painted across the face (round-3
  // reviewer finding, cable crunch and lat pulldown) reads as the rope
  // passing behind the skull where the stored cue pins it.
  const implementPrims = implement(slug, j, farColor, farOpacity, view, body, {
    role: opts.role,
    implementTiltWeight: opts.implementTiltWeight,
    implementOrientation: opts.implementOrientation,
    implementCount: opts.implementCount,
    implementScale: opts.implementScale,
  });
  prims.push(...implementPrims.filter((p) => p.kind === 'bone'
    && (p.color === 'textMid' || p.beforeHead === true)));
  prims.push(bone(at(0.02), j.hd, body.lw * 0.74, 'textHi', 1));
  prims.push({
    kind: 'circle', cx: j.hd[0], cy: j.hd[1], r: body.hr,
    fill: 'ink1', stroke: 'textHi', strokeWidth: 2.5, opacity: 1,
  });
  if (armAfterHead) {
    prims.push(nearUpperArm, nearForearm);
  }

  // ---- Layer 6: hands & implements ----
  if (perspectiveBar) prims.push(...perspectiveBar.near);
  if (endOnBar) prims.push(...endOnBar);
  if (cableDraw) prims.push(...cableDraw.nearHandle);
  const equipment = EQUIPMENT_BY_SLUG[slug] ?? 'none';
  if ((equipment === 'none' || equipment === 'barbell' || equipment === 'kettlebell' || equipment === 'squat_rack')
    && !CURL_SLUGS.has(slug)) {
    prims.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: body.lw * 0.44, fill: 'textHi', opacity: 1 });
    prims.push({ kind: 'circle', cx: j.wf[0], cy: j.wf[1], r: body.lw * 0.44, fill: farColor, opacity: farOpacity });
  } else if (equipment === 'dumbbells' && ROW_SLUGS.has(slug)) {
    // One hand grips the dumbbell; the other supports on the bench (stored
    // cue: "Support one hand and knee on a bench"). The support hand was
    // drawn with a dumbbell lying through the pad (round-3 reviewer finding);
    // the support hand is the wrist resting on the bench plane.
    const support = Math.abs(j.wr[1] - ROW_BENCH.top) <= Math.abs(j.wf[1] - ROW_BENCH.top)
      ? 'wr' : 'wf';
    const supportPoint = support === 'wr' ? j.wr : j.wf;
    prims.push({ kind: 'circle', cx: supportPoint[0], cy: supportPoint[1], r: body.lw * 0.44, fill: 'textHi', opacity: 1 });
  }
  // Layer 6: everything that was NOT hoisted before the head. A beforeHead
  // prim must not be painted a second time here — the round-4 audit caught
  // the pulldown bar drawn behind AND in front of the face (the front copy
  // defeated the occlusion entirely). This filter is the exact complement of
  // the pre-head hoist above so the two can never drift apart.
  prims.push(...implementPrims.filter((p) => !(p.kind === 'bone'
    && (p.color === 'textMid' || p.beforeHead === true))));
  if (fly && fly.inclineDeg < 0) {
    // Connected ankle roller lies above the actual secured ankles; never
    // substitute floor-standing legs for the decline setup.
    const offset = body.lw * 0.9 / 2 + 2.2;
    const a: CanonicalPoint = [j.af[0] - fly.padNormal[0] * offset, j.af[1] - fly.padNormal[1] * offset];
    const b: CanonicalPoint = [j.an[0] - fly.padNormal[0] * offset, j.an[1] - fly.padNormal[1] * offset];
    const centre: CanonicalPoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    prims.push(bone(centre, fly.pad[0], 1.6, 'textLow', 0.75), bone(a, b, 4.4, 'textMid', 1));
  }
  if (reverseLunge) prims.push(...layoutHammerDumbbell(j.wr, j.el));
  if (kickback) {
    const length = Math.hypot(j.an[0] - j.kn[0], j.an[1] - j.kn[1]);
    const half = (body.lw * 0.9 + 1) / 2;
    const dx = -(j.an[1] - j.kn[1]) / length * half, dy = (j.an[0] - j.kn[0]) / length * half;
    prims.push(bone([j.an[0] - dx, j.an[1] - dy], [j.an[0] + dx, j.an[1] + dy], 2.2, 'textMid', 1));
    for (const point of [j.wf, j.wr]) prims.push({ kind: 'circle', cx: point[0], cy: point[1], r: body.lw * 0.44, fill: 'textHi', opacity: 1 });
  }

  return prims;
}

function foot(an: CanonicalPoint, color: ColorRole, body: BodyParameters, front: boolean, opacity: number, ground = 96.4): BonePrim {
  if (front) {
    return {
      kind: 'bone',
      x1: an[0] - 2.8, y1: an[1] + 0.6, x2: an[0] + 2.8, y2: an[1] + 0.6,
      w: body.lw * 0.82, color, opacity,
    };
  }
  // The foot capsule is never longer than a foot: when the ankle is high off
  // the floor the old drop-to-the-floor formula drew a 21-unit rod from a
  // raised ankle (supported row, far foot — round-3 reviewer P1). The tip
  // still aims at the floor, but the capsule length is capped.
  const drop = Math.min(ground, an[1] + (ground - an[1]) * 0.85);
  const dx = 5.4;
  const dy = drop - an[1];
  const len = Math.hypot(dx, dy);
  const FOOT_LEN = 5.4;
  const k = len > FOOT_LEN ? FOOT_LEN / len : 1;
  return { kind: 'bone', x1: an[0], y1: an[1], x2: an[0] + dx * k, y2: an[1] + dy * k, w: body.lw * 0.82, color, opacity };
}

/** Equipment class per movement slug (mirrors the manifest entries). */
export const EQUIPMENT_BY_SLUG: Record<string, string> = {
  'inverted-row': 'barbell',
  'body-tricep-press': 'squat_rack',
  'dumbbell-reverse-lunge': 'dumbbells',
  'cable-glute-kickback': 'cable_machine',
  'dumbbell-flye': 'dumbbells',
  'decline-dumbbell-flyes': 'dumbbells',
  'incline-dumbbell-flyes': 'dumbbells',
  'competition-squat': 'barbell',
  'deadlift': 'barbell',
  'barbell-row': 'barbell',
  'front-squat': 'barbell',
  'goblet-squat': 'dumbbells',
  'romanian-deadlift': 'barbell',
  'kettlebell-swing': 'kettlebell',
  'dumbbell-bench-press': 'dumbbells',
  'dumbbell-shoulder-press': 'dumbbells',
  'single-arm-dumbbell-row': 'dumbbells',
  'one-arm-dumbbell-row': 'dumbbells',
  'lat-pulldown': 'cable_machine',
  // WO-09 Batch 1 (B1-300): the wide-grip variant uses the same cable machine.
  'wide-grip-lat-pulldown': 'cable_machine',
  // Family 2: the scapular pull-up hangs from a bodyweight pull-up bar.
  'scapular-pull-up': 'none',
  // Family 2: the one-arm pull works a high cable with a single handle.
  'one-arm-lat-pulldown': 'cable_machine',
  // Family 2: the close-grip pull uses the pulldown cable machine.
  'close-grip-front-lat-pulldown': 'cable_machine',
  // Family 2: the underhand pull uses the pulldown cable machine.
  'underhand-cable-pulldowns': 'cable_machine',
  // Family 10: the wrist curl works a low cable at bench height.
  'cable-wrist-curl': 'cable_machine',
  // Family 11: the seated cable press rides a low pulley beside the seat.
  'seated-cable-shoulder-press': 'cable_machine',
  // Family 10: the finger curl holds a barbell across the fingers.
  'finger-curls': 'barbell',
  // Family 12: both seated wrist curls take a bell over the bench edge.
  'seated-dumbbell-palms-down-wrist-curl': 'dumbbells',
  'seated-dumbbell-palms-up-wrist-curl': 'dumbbells',
  // Family 13: the standing curls and what they hold.
  'barbell-curl': 'barbell',
  'reverse-barbell-curl': 'barbell',
  'close-grip-ez-bar-curl': 'barbell',
  'ez-bar-curl': 'barbell',
  'cable-hammer-curls-rope-attachment': 'cable_machine',
  'reverse-cable-curl': 'cable_machine',
  'standing-biceps-cable-curl': 'cable_machine',
  'alternate-hammer-curl': 'dumbbells',
  'cross-body-hammer-curl': 'dumbbells',
  // Family 3: the band good morning is the first band implement.
  'band-good-morning': 'band',
  // Family 3: the good morning barbell sits across the shoulders.
  'stiff-leg-barbell-good-morning': 'barbell',
  // Family 4: the floor press base uses the generic side-view dumbbells.
  'dumbbell-floor-press': 'dumbbells',
  // Family 4: the close-grip pair also rides the dumbbell machinery.
  'close-grip-dumbbell-press': 'dumbbells',
  // Family 4: the alternating press uses a kettlebell on the floor setup.
  'alternating-floor-press': 'kettlebell',
  // Family 4: the barbell bench presses draw the end-on bar.
  'barbell-bench-press-medium-grip': 'barbell',
  // Family 4: the band bench presses loop a band under the bench.
  'bench-press-with-bands': 'band',
  // Family 4: the EZ-bar press draws the end-on bar; the neutral pair is dumbbells.
  'close-grip-ez-bar-press': 'barbell',
  'dumbbell-bench-press-with-neutral-grip': 'dumbbells',
  // Family 4: the one-arm members - a kettlebell and a single dumbbell.
  'extended-range-one-arm-kettlebell-floor-press': 'kettlebell',
  'one-arm-dumbbell-bench-press': 'dumbbells',
  // Family 4: the JM press draws the end-on bar.
  'jm-press': 'barbell',
  // Family 5: the cable row rides the seated machine.
  'cable-row': 'cable_machine',
  // Family 5: the band row anchors a band at chest height.
  'band-row': 'band',
  // Family 5: the remaining rows ride cable machines.
  'cable-rope-rear-delt-rows': 'cable_machine',
  'low-pulley-row-to-neck': 'cable_machine',
  'shotgun-row': 'cable_machine',
  // Family 6: the bent-over rows draw the end-on bar and dumbbells.
  'bent-over-barbell-row': 'barbell',
  'bent-over-one-arm-long-bar-row': 'barbell',
  'bent-over-two-dumbbell-row': 'dumbbells',
  'bent-over-two-dumbbell-row-with-palms-in': 'dumbbells',
  // Family 7: the shoulder-rotation band movements.
  'band-external-rotation': 'band',
  'internal-rotation-with-band': 'band',
  // Family 7: the cable rotations and the dumbbell arc.
  'cable-internal-rotation': 'cable_machine',
  'external-rotation-with-cable': 'cable_machine',
  'external-rotation': 'dumbbells',
  // Family 8: the vertical presses.
  'alternating-cable-shoulder-press': 'cable_machine',
  'shoulder-press-with-bands': 'band',
  'standing-dumbbell-press': 'dumbbells',
  'standing-palm-in-one-arm-dumbbell-press': 'dumbbells',
  // Family 9: the calf raises on the step.
  'standing-dumbbell-calf-raise': 'dumbbells',
  'calf-raises-with-bands': 'band',
  'dumbbell-split-squat': 'dumbbells',
  'walking-lunge': 'none',
  'farmer-carry': 'dumbbells',
  'cable-crunch': 'cable_machine',
  'hammer-curl': 'dumbbells',
  // WO-09 prototype: a supinated dumbbell curl derives Hammer Curl's frames and
  // differs only in implement orientation. Listing the slug here routes it to
  // the generic horizontal-bell branch below; the hammer-curl branch above
  // stays byte-identical because it is keyed on its own slug.
  'dumbbell-bicep-curl': 'dumbbells',
  // WO-09 Batch 1: a suitcase carry derives Farmer Carry's frames and differs
  // in implement COUNT - one bell, in the near hand (the loop order's "one bell
  // hidden"). Listing the slug here routes it to the same generic branch below;
  // the farmer-carry drawing stays byte-identical because it is keyed on its
  // own slug, and the count itself arrives through `implementCount`.
  'suitcase-carry': 'dumbbells',
  // WO-09 Batch 1 (B1-55): a dumbbell squat derives Goblet Squat's frames and
  // hangs the arms plumb through declared jointOffsets. Listing the slug routes
  // it to the generic horizontal-bell branch below: one bell at each wrist,
  // beside the legs. The goblet-squat branch is keyed on its own slug, so base
  // 14's front-held bell stays byte-identical.
  'dumbbell-squat': 'dumbbells',
  // WO-09 Batch 1 (B1-113): a cable deadlift derives Romanian Deadlift's frames
  // and holds a D-handle on a low cable in each hand (CABLE_LOW_SLUGS draws the
  // handles, hands, cables and pulleys). As a cable movement it takes no bare
  // hand dots from the generic branch and no barbell plate.
  'cable-deadlifts': 'cable_machine',
  // Family 15: the incline presses - a barbell, two neutral dumbbell pairs and
  // a cable-machine press.
  'barbell-incline-bench-press-medium-grip': 'barbell',
  'hammer-grip-incline-db-bench-press': 'dumbbells',
  'incline-cable-chest-press': 'cable_machine',
  'incline-dumbbell-bench-with-palms-facing-in': 'dumbbells',
  // Family 16: the standing rear delts - a stretched band, and crossed cable
  // handles to two high pulleys.
  'band-pull-apart': 'band',
  'cable-rear-delt-fly': 'cable_machine',
  // Family 17: the Pallof pair - an anchored band and a chest-height cable.
  'pallof-press': 'band',
  'pallof-press-with-rotation': 'cable_machine',
  // Family 18: the seated calf raises - a padded bar on the thighs, and one
  // dumbbell in the working hand.
  'barbell-seated-calf-raise': 'barbell',
  'dumbbell-seated-one-leg-calf-raise': 'dumbbells',
  // Family 19: the forearm plank - no implement, the hands and feet carry it.
  'plank': 'none',
  // Family 20: the chest-supported row - a dumbbell in each hand.
  'chest-supported-dumbbell-row': 'dumbbells',
  // Family 21: the dead bug - no implement, the limbs are the movement.
  'dead-bug': 'none',
  // Family 22: the sumo squat - one dumbbell at the midline between the legs.
  'dumbbell-sumo-squat': 'dumbbells',
  // Family 23: the face pull - a cable rope to a chest-height pulley.
  'face-pull': 'cable_machine',
  // Family 24: the seated cable row - the low pulley at the foot end.
  'seated-cable-rows': 'cable_machine',
  // Family 25: the push-up floor variations are bodyweight; the elevated one
  // sets its feet on a drawn box.
  'feet-elevated-push-up': 'box',
  'push-up-to-side-plank': 'none',
  'push-up-wide': 'none',
  // Family 26: the crunch floor variations - the bench version rides a pad.
  'crunch-hands-overhead': 'none',
  'crunches': 'bench',
  'rope-crunch': 'cable_machine',
  // Family 27: the overhead triceps extensions.
  'cable-rope-overhead-triceps-extension': 'cable_machine',
  'cable-one-arm-tricep-extension': 'cable_machine',
  'dumbbell-tricep-extension-pronated-grip': 'dumbbells',
  'standing-dumbbell-triceps-extension': 'dumbbells',
  'standing-overhead-barbell-triceps-extension': 'barbell',
  // Family 28: the shrugs.
  'dumbbell-shrug': 'dumbbells',
  'barbell-shrug': 'barbell',
  'barbell-shrug-behind-the-back': 'barbell',
  'cable-shrugs': 'cable_machine',
  // Family 29: the sit-ups - the cable version rides a bench and a pulley.
  'three-quarter-sit-up': 'none',
  'cable-seated-crunch': 'cable_machine',
  'jackknife-sit-up': 'none',
  'janda-sit-up': 'none',
  // Family 30: the hip hinges.
  'cable-pull-through': 'cable_machine',
  'band-good-morning-pull-through': 'bands',
  'hip-extension-with-bands': 'bands',
  // Family 31: the trunk twist family.
  'russian-twist': 'none',
  'cross-body-crunch': 'none',
  'oblique-crunches': 'none',
  // Family 32: the incline push-ups.
  'incline-push-up': 'none',
  'incline-push-up-close-grip': 'none',
  'incline-push-up-wide': 'none',
  // Family 33: the preacher curls.
  'preacher-curl': 'barbell',
  'cable-preacher-curl': 'cable_machine',
  'preacher-hammer-dumbbell-curl': 'dumbbells',
  // Family 34: the glute bridges.
  'glute-bridge': 'none',
  'single-leg-glute-bridge': 'none',
  // Family 35: the split-stance family.
  'dumbbell-lunge': 'dumbbells',
  'step-up-with-knee-raise': 'none',
  // Family 36: the bent-over rear delts.
  'barbell-rear-delt-row': 'barbell',
  'bent-over-dumbbell-rear-delt-raise-with-head-on-bench': 'dumbbells',
  // Family 37: the kneeling high pulley rows.
  'kneeling-single-arm-high-pulley-row': 'cable_machine',
  'kneeling-high-pulley-row': 'cable_machine',
  // Family 38: the incline shoulder raises.
  'barbell-incline-shoulder-raise': 'barbell',
  'dumbbell-incline-shoulder-raise': 'dumbbells',
};

/**
 * B1-55's side-hanging bell rule moved into `implement()` with its only
 * member: `dumbbell-squat` now draws its own hanging bell (suitcase form,
 * ink1 outline, outward nudge) in the family-queue rebuild of the squat
 * family, so the side-hanging set itself no longer exists.
 */

const PERSPECTIVE_BARBELL_SLUGS: ReadonlySet<string> = new Set([
  'competition-squat', 'deadlift', 'barbell-row', 'front-squat',
  // Family 3: the good morning carries the bar across the shoulders, drawn
  // end-on with its plates (side view), the same oblique projection.
  'stiff-leg-barbell-good-morning',
  // Family 4: the supine barbell presses ride the same end-on bar.
  'barbell-bench-press-medium-grip',
  'close-grip-ez-bar-press',
  'jm-press',
  // Family 6: the bent-over barbell row rides the same end-on bar.
  'bent-over-barbell-row',
]);

/**
 * Side-view barbell, drawn END-ON (owner fix, Entry 0181).
 *
 * A barbell seen from the side must not read as a long bar with a plate at
 * each end: that shaft runs across the head. Seen from the side it reads
 * end-on, as the finished Romanian Deadlift already draws it - a plate disc
 * with a small hub at the hands.
 *
 * Only the slugs listed here change. Every other movement in
 * PERSPECTIVE_BARBELL_SLUGS (the competition squat, deadlift, barbell row,
 * front squat, the good morning and the bent-over row) keeps the oblique
 * projection, byte for byte: the set membership is unchanged, so the far
 * limb offset and the foot plane these slugs read are untouched too.
 */
const END_ON_BARBELL_SLUGS: ReadonlySet<string> = new Set([
  'barbell-bench-press-medium-grip',
  'close-grip-ez-bar-press',
  'jm-press',
  // Family 15: the incline barbell press is side view too, so its bar reads
  // end-on at the grip (the same Entry 0181 rule). It is NOT in the
  // PERSPECTIVE set: its far separation comes from FAROFF and it shares the
  // 96.4 ground with the other three incline members.
  'barbell-incline-bench-press-medium-grip',
  // Family 18: the seated calf raise's padded bar lies across the thighs in
  // the depth axis, so it reads end-on at the grip (the same Entry 0181 rule).
  'barbell-seated-calf-raise',
]);
// NOT here: stiff-leg-barbell-good-morning. Its bar belongs across the upper
// back, and with the bar behind the shoulder L3 would need the elbow ABOVE the
// shoulder. Blocked on an owner ruling; see drafts/wo09-slides/DAILY_REVIEW.md.

/**
 * Elbows re-solved on the drawn shoulder circle (Entry 0181, items 1-4).
 *
 * A front-view shoulder root sits `sw * 0.92` out from the neck, and `sw` is a
 * BODY PARAMETER. An elbow authored in absolute coordinates therefore lands on
 * a different radius for the male and female bodies - the neutral figure held
 * 5% and the other two drifted up to 18.7%. The fix solves the elbow per body
 * from the radius this movement declares, so all three bodies draw the same
 * bone length.
 *
 * Only these slugs are keyed. Every other movement, finished or not, keeps the
 * authored elbow and its exact drawing.
 *
 * `fore` is the declared forearm; `upper` the declared upper arm. `side` picks
 * the circle solution ONCE for the whole movement so the elbow cannot hop to
 * the other side of the shoulder-wrist line and flip its bend side (L4).
 *
 * Entry 0182: the close-grip pull finishes with its hands on the sternum, so
 * the shoulder-wrist line runs across the body. Its `side: 1` is the choice
 * that keeps each elbow OUTBOARD, on its own side of the body, at the bottom
 * of the pull; the opposite index draws the near elbow inboard of the far arm
 * and the arms read as crossed. Both indices hold a constant bend side, so
 * this is a drawing-quality choice, not a limits relaxation.
 */
const ELBOW_ON_SHOULDER_CIRCLE: ReadonlyMap<string, { upper: number; fore: number; side: 1 | -1 }> = new Map<string, { upper: number; fore: number; side: 1 | -1 }>([
  // Family 13: the nine standing curls. A curl pins the elbow beside the ribs and
  // moves only the forearm, so the elbow cannot be authored per frame without the
  // upper arm changing length (L1). These take the base Hammer Curl's own drawn
  // bones - upper 13.26, forearm 11.2, the neutral body's measurements off the
  // finished base - so the curl holds both lengths on all three bodies. `side: -1`
  // is the solution that hangs the elbow behind its own hand, the way the base's
  // finished elbow does (its elbow sits 0.9 inboard of the hand at every position).
  ...([
    'barbell-curl', 'reverse-barbell-curl', 'close-grip-ez-bar-curl', 'ez-bar-curl',
    'cable-hammer-curls-rope-attachment', 'reverse-cable-curl', 'standing-biceps-cable-curl',
    'alternate-hammer-curl', 'cross-body-hammer-curl',
  ] as string[]).map((s): [string, { upper: number; fore: number; side: -1 }] =>
    [s, { upper: 13.26, fore: 11.2, side: -1 }]),
  // Family 16: the two standing rear delts take the same front-view arm bones.
  // The band's elbows hang below their shoulder-wrist line (side -1); the cable
  // fly's elbows lead outboard as the arms open from the crossed start (side 1,
  // the Entry 0182 outboard choice). Both hold one side for the whole movement.
  ['band-pull-apart', { upper: 13.26, fore: 11.2, side: -1 }],
  ['cable-rear-delt-fly', { upper: 13.26, fore: 11.2, side: 1 }],
  // Family 17: the Pallof pair takes the side-view arm bones (the pulldown
  // pair). side 1 keeps the elbow behind the chest hold as the arms press out.
  ['pallof-press', { upper: 12.5, fore: 12.0, side: 1 }],
  ['pallof-press-with-rotation', { upper: 12.5, fore: 12.0, side: 1 }],
  // Family 20: the chest-supported row takes the side-view arm bones; side 1
  // keeps the elbow leading up toward the ceiling through the row.
  ['chest-supported-dumbbell-row', { upper: 12.5, fore: 12.0, side: 1 }],
  // Family 21: the dead bug's arms at the ceiling ride the same side-view
  // bones; side 1 keeps each elbow on one side through the arm lower.
  ['dead-bug', { upper: 12.5, fore: 12.0, side: 1 }],
  // Family 22: the sumo squat's hanging arms take the same side-view bones
  // (the front-view pair 13.26 / 11.2 is the curl pair; these are the hanging
  // 12.5 / 12.0 arms the side-view rows and presses use).
  ['dumbbell-sumo-squat', { upper: 12.5, fore: 12.0, side: 1 }],
  // Family 23: the face pull takes the same side-view bones. side 1 keeps the
  // elbow behind the shoulder-wrist chord (L3): for a pull to the nose the
  // high-elbow solution sits on L3's wrong side, so the cue rides the caption.
  ['face-pull', { upper: 12.5, fore: 12.0, side: 1 }],
  // Family 24: the seated row takes the same side-view bones.
  ['seated-cable-rows', { upper: 12.5, fore: 12.0, side: 1 }],
  // Family 25: the push-up chain (the shoulder rides the arm circle from a
  // 22-unit span to 12 at the bottom). side 1 keeps the elbow behind the wrist
  // line (the base's tucked elbows); the wide flips to the flared side.
  ['feet-elevated-push-up', { upper: 12.5, fore: 12.0, side: 1 }],
  ['push-up-to-side-plank', { upper: 12.5, fore: 12.0, side: 1 }],
  ['push-up-wide', { upper: 12.5, fore: 12.0, side: -1 }],
  // Family 26: the crunch arms take the same side-view bones on all three.
  ['crunch-hands-overhead', { upper: 12.5, fore: 12.0, side: 1 }],
  ['crunches', { upper: 12.5, fore: 12.0, side: 1 }],
  ['rope-crunch', { upper: 12.5, fore: 12.0, side: 1 }],
  // Family 27: the overhead extension chain - the elbow fixed high beside the
  // head, the forearm folding 50 to 173 degrees behind it.
  ['cable-rope-overhead-triceps-extension', { upper: 12.5, fore: 12.0, side: 1 }],
  ['cable-one-arm-tricep-extension', { upper: 12.5, fore: 12.0, side: 1 }],
  ['dumbbell-tricep-extension-pronated-grip', { upper: 12.5, fore: 12.0, side: 1 }],
  ['standing-dumbbell-triceps-extension', { upper: 12.5, fore: 12.0, side: 1 }],
  ['standing-overhead-barbell-triceps-extension', { upper: 12.5, fore: 12.0, side: 1 }],
  // Family 28: the shrugs take the hanging side-view arms.
  ['dumbbell-shrug', { upper: 12.5, fore: 12.0, side: 1 }],
  ['barbell-shrug', { upper: 12.5, fore: 12.0, side: 1 }],
  ['barbell-shrug-behind-the-back', { upper: 12.5, fore: 12.0, side: 1 }],
  ['cable-shrugs', { upper: 12.5, fore: 12.0, side: 1 }],
  // Family 29: the sit-up arms take the same supine bones.
  ['three-quarter-sit-up', { upper: 12.5, fore: 12.0, side: 1 }],
  ['cable-seated-crunch', { upper: 12.5, fore: 12.0, side: 1 }],
  ['jackknife-sit-up', { upper: 12.5, fore: 12.0, side: 1 }],
  ['janda-sit-up', { upper: 12.5, fore: 12.0, side: 1 }],
  // Family 30: the hinge arms just hold at the hips.
  ['cable-pull-through', { upper: 12.5, fore: 12.0, side: 1 }],
  ['band-good-morning-pull-through', { upper: 12.5, fore: 12.0, side: 1 }],
  ['hip-extension-with-bands', { upper: 12.5, fore: 12.0, side: 1 }],
  // Family 31: the twist and oblique arms.
  ['russian-twist', { upper: 12.5, fore: 12.0, side: 1 }],
  ['cross-body-crunch', { upper: 12.5, fore: 12.0, side: 1 }],
  ['oblique-crunches', { upper: 12.5, fore: 12.0, side: 1 }],
  // Family 32: the incline push-up arms.
  ['incline-push-up', { upper: 12.5, fore: 12.0, side: 1 }],
  ['incline-push-up-close-grip', { upper: 12.5, fore: 12.0, side: 1 }],
  ['incline-push-up-wide', { upper: 12.5, fore: 12.0, side: 1 }],
  // Family 33: the preacher arms (both drawn at the front view).
  ['preacher-curl', { upper: 12.5, fore: 12.0, side: 1 }],
  ['cable-preacher-curl', { upper: 12.5, fore: 12.0, side: 1 }],
  ['preacher-hammer-dumbbell-curl', { upper: 12.5, fore: 12.0, side: 1 }],
  // Family 34: the bridge arms rest on the floor.
  ['glute-bridge', { upper: 12.5, fore: 12.0, side: 1 }],
  ['single-leg-glute-bridge', { upper: 12.5, fore: 12.0, side: 1 }],
  // Family 35: the split-stance arms.
  ['dumbbell-lunge', { upper: 12.5, fore: 12.0, side: 1 }],
  ['step-up-with-knee-raise', { upper: 12.5, fore: 12.0, side: 1 }],
  // Family 36: the bent-over rear-delt arms.
  ['barbell-rear-delt-row', { upper: 12.5, fore: 12.0, side: 1 }],
  ['bent-over-dumbbell-rear-delt-raise-with-head-on-bench', { upper: 12.5, fore: 12.0, side: 1 }],
  // Family 37: the kneeling row arms.
  ['kneeling-single-arm-high-pulley-row', { upper: 12.5, fore: 12.0, side: 1 }],
  ['kneeling-high-pulley-row', { upper: 12.5, fore: 12.0, side: 1 }],
  // Family 38: the incline raise arms.
  ['barbell-incline-shoulder-raise', { upper: 12.5, fore: 12.0, side: 1 }],
  ['dumbbell-incline-shoulder-raise', { upper: 12.5, fore: 12.0, side: 1 }],
  // Entry 0183 (owner, L10): on a vertical pull the working elbow has to sit
  // BELOW the wrist and drive down past the shoulder, so these three take the
  // lower circle solution (side -1). The close grip keeps side 1: with its
  // hands inside the shoulder line the upper solution is already the one at
  // the ribs, and it is the one that keeps the elbows outboard.
  // Entry 0183 (owner, L10 sweep): the side-on lat pulldown keys its elbow too.
  // Its keyframes are exact, but interpolating two positions on the shoulder
  // circle cuts the chord and the upper arm shrank to 10.16 of 12.50 (18.8%).
  ['lat-pulldown', { upper: 12.5, fore: 12.0, side: 1 }],
  ['wide-grip-lat-pulldown', { upper: 13.237, fore: 12.0, side: -1 }],
  ['close-grip-front-lat-pulldown', { upper: 13.113, fore: 12.0, side: 1 }],
  ['underhand-cable-pulldowns', { upper: 12.85, fore: 12.0, side: -1 }],
  ['one-arm-lat-pulldown', { upper: 13.594, fore: 12.0, side: -1 }],
  // Item 12: the four standing presses. Their keyframes are exact, but the
  // eased in-between frames interpolated the elbow straight across the chord
  // and the upper arm shrank to 10.49 of 12.50 (16.1%, limit 8%).
  ['alternating-cable-shoulder-press', { upper: 12.5, fore: 12.0, side: 1 }],
  ['shoulder-press-with-bands', { upper: 12.5, fore: 12.0, side: 1 }],
  ['standing-dumbbell-press', { upper: 12.5, fore: 12.0, side: 1 }],
  ['standing-palm-in-one-arm-dumbbell-press', { upper: 12.5, fore: 12.0, side: 1 }],
  // Item 9: the three standing rows whose hands now reach the body. Their
  // keyframes are exact, but pulling the hand to the ribs swings the elbow
  // through a wide arc, and the eased in-between frames interpolated the elbow
  // straight across the chord - the upper arm shrank to 10.57 of 12.50 (15.4%,
  // limit 8%) and the forearm to 8.76 of 12.00. All three carry upper 12.5 /
  // fore 12.0 exactly, so the per-frame re-solve holds their own lengths.
  ['band-row', { upper: 12.5, fore: 12.0, side: 1 }],
  ['shotgun-row', { upper: 12.5, fore: 12.0, side: 1 }],
  ['low-pulley-row-to-neck', { upper: 12.5, fore: 12.0, side: 1 }],
  // Item 10: the two bent-over two-dumbbell rows, whose trunk is re-laid flat.
  // Flattening the spine moves the shoulder, and a row pulls the elbow through
  // a wide arc, so the eased in-between frames would otherwise interpolate it
  // across the chord. Both carry upper 12.5 / fore 12.0.
  ['bent-over-two-dumbbell-row', { upper: 12.5, fore: 12.0, side: 1 }],
  ['bent-over-two-dumbbell-row-with-palms-in', { upper: 12.5, fore: 12.0, side: 1 }],
]);

/** Both intersections of circles (root, upper) and (wrist, fore). */
function elbowCircleSolutions(
  root: CanonicalPoint, wrist: CanonicalPoint, upper: number, fore: number,
): [CanonicalPoint, CanonicalPoint] | null {
  const dx = wrist[0] - root[0], dy = wrist[1] - root[1];
  const d = Math.hypot(dx, dy);
  if (d > upper + fore - 1e-9 || d < Math.abs(upper - fore) + 1e-9) return null;
  const a = (upper * upper - fore * fore + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, upper * upper - a * a));
  const ux = dx / d, uy = dy / d;
  const fx = root[0] + ux * a, fy = root[1] + uy * a;
  return [[fx - uy * h, fy + ux * h], [fx + uy * h, fy - ux * h]];
}

/**
 * Supinated bell tilt.
 *
 * A supinated (palms-up) curl rotates the wrist so the pinky angles slightly
 * toward the ear at the top of the rep. The bell therefore reads as a tilted
 * bar with its INNER end (the end nearer the body midline) sitting higher than
 * its outer end, mirrored between the two arms.
 *
 * The tilt is selected by the VARIANT CONTRACT, not by the slug: it is drawn
 * only when the variant asks for a supinated orientation AND the frame being
 * drawn carries the `peak` role. A base entry has no roles, and every
 * non-peak frame of a variant, therefore keep the flat branch in `implement()`
 * untouched, byte for byte.
 *
 * BELL_TILT_DEG is a prototype value carried into owner review — it is a visual
 * reading of "slightly", not a measured constant, and nothing derived from it
 * should be treated as ratified.
 */
const BELL_TILT_DEG = 15;

/**
 * Oblique orthographic projection: transverse depth points up/left, matching
 * the far arm's [-8,-2] displacement. Equal discs lie in a plane normal to
 * the shaft. Their projected faces are ellipses, built from the SAME rounded
 * View bars as the tapered trunk; no new primitive or drawing dependency.
 * b is the near grip; the far grip is b+[-8,-2]. Plates sit beyond both grips.
 */
export function layoutPerspectiveBarbell(b: CanonicalPoint): { far: FigurePrim[]; near: FigurePrim[] } {
  const u: CanonicalPoint = [4 / Math.sqrt(17), 1 / Math.sqrt(17)];
  const v: CanonicalPoint = [-u[1], u[0]];
  const at = (x: number, y: number): CanonicalPoint => [b[0] + x, b[1] + y];
  const shaft = (a: CanonicalPoint, z: CanonicalPoint, color: ColorRole): BonePrim =>
    ({ kind: 'bone', x1: a[0], y1: a[1], x2: z[0], y2: z[1], w: 1.4, color, opacity: 1 });
  const disc = (c: CanonicalPoint, color: ColorRole): FigurePrim[] => {
    const out: FigurePrim[] = [];
    // Opaque nested ellipses leave a readable rim and a dark face.
    for (const [major, minor, paint] of [[7, 3.1, color], [5.7, 2.1, 'ink1']] as const) {
      for (let i = -12; i <= 12; i++) {
        const t = i / 13;
        const half = major * Math.sqrt(1 - t * t);
        const x = c[0] + u[0] * minor * t, y = c[1] + u[1] * minor * t;
        out.push({ kind: 'bone', x1: x - v[0] * half, y1: y - v[1] * half,
          x2: x + v[0] * half, y2: y + v[1] * half,
          w: minor / 13 * 1.5, color: paint, opacity: 1 });
      }
    }
    out.push({ kind: 'circle', cx: c[0], cy: c[1], r: 1.4, fill: color, opacity: 1 });
    return out;
  };
  return {
    far: [shaft(at(-24, -6), at(-4, -1), 'textLow'), ...disc(at(-20, -5), 'textLow')],
    near: [shaft(at(-4, -1), at(16, 4), 'textHi'), ...disc(at(12, 3), 'textHi')],
  };
}

/**
 * The end-on bar (Entry 0181): a plate disc and a small hub at the grip `b`,
 * the form the finished Romanian Deadlift already uses (plate r 6.6, hub
 * r 2.2). A side view has no width to show, so the plate is what reads; the
 * long shaft is what crossed the head.
 */
export function layoutEndOnBarbell(b: CanonicalPoint): FigurePrim[] {
  return [
    { kind: 'circle', cx: b[0], cy: b[1], r: 6.6, fill: 'textHi', opacity: 1 },
    { kind: 'circle', cx: b[0], cy: b[1], r: 2.2, fill: 'ink1', opacity: 1 },
  ];
}

/**
 * The end-on EZ-bar (Entry 0182, item 7). A straight bar and an EZ are the
 * same disc end-on, which is why the close-grip EZ slide read as the bench
 * press. What tells them apart is the CAMBER: an EZ bar's shaft steps up and
 * down around the grip, so seen end-on its shaft leaves the hub at an angle
 * instead of running straight. That step is drawn here, on the same plate and
 * hub the straight bar uses, so only this slug changes.
 */
export function layoutEndOnEzBar(b: CanonicalPoint): FigurePrim[] {
  return [
    { kind: 'circle', cx: b[0], cy: b[1], r: 6.6, fill: 'textHi', opacity: 1 },
    // The camber: the shaft rises off the hub on both sides at the EZ angle,
    // so the silhouette steps rather than running straight through.
    { kind: 'bone', x1: b[0], y1: b[1], x2: b[0] - 9.0, y2: b[1] - 5.2, w: 2.4, color: 'textHi', opacity: 1 },
    { kind: 'bone', x1: b[0], y1: b[1], x2: b[0] - 9.0, y2: b[1] + 5.2, w: 2.4, color: 'textHi', opacity: 1 },
    { kind: 'circle', cx: b[0], cy: b[1], r: 2.2, fill: 'ink1', opacity: 1 },
  ];
}

/** A shared straight bar that extends beyond both actual grips. */
export function layoutStraightGripBar(wr: CanonicalPoint, wf: CanonicalPoint, loaded: boolean, palmsUp = true): FigurePrim[] {
  const [left, right] = wr[0] < wf[0] ? [wr, wf] : [wf, wr];
  const length = Math.hypot(right[0] - left[0], right[1] - left[1]) || 1;
  const ux = (right[0] - left[0]) / length, uy = (right[1] - left[1]) / length;
  const a: CanonicalPoint = [left[0] - ux * 3.5, left[1] - uy * 3.5];
  const b: CanonicalPoint = [right[0] + ux * 3.5, right[1] + uy * 3.5];
  const out: FigurePrim[] = [{ kind: 'bone', x1: a[0], y1: a[1], x2: b[0], y2: b[1], w: 1.6, color: 'textHi', opacity: 1 }];
  if (loaded) for (const point of [a, b]) out.push({ kind: 'circle', cx: point[0], cy: point[1], r: 3.2, fill: 'textMid', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
  for (const point of [wr, wf]) {
    // The palm sits below an underhand grip and above an overhand grip.
    const dy = palmsUp ? 1.8 : -1.8;
    out.push({ kind: 'bone', x1: point[0] - 2, y1: point[1] + dy, x2: point[0] + 2, y2: point[1] + dy, w: 2.2, color: 'textHi', opacity: 1 });
    out.push({ kind: 'bone', x1: point[0] + 2, y1: point[1] + dy, x2: point[0] + 2, y2: point[1] - dy / 2, w: 1.2, color: 'textHi', opacity: 1 });
  }
  return out;
}

/** Rigid neutral-grip load: shaft stays perpendicular to the forearm. */
export function layoutHammerDumbbell(wrist: CanonicalPoint, elbow: CanonicalPoint, near = true): FigurePrim[] {
  const length = Math.hypot(wrist[0] - elbow[0], wrist[1] - elbow[1]);
  const ux = (wrist[0] - elbow[0]) / length, uy = (wrist[1] - elbow[1]) / length;
  const half: CanonicalPoint = [-uy * 5, ux * 5];
  const color: ColorRole = near ? 'textHi' : 'textLow';
  const opacity = near ? 1 : 0.9;
  const out: FigurePrim[] = [{ kind: 'bone', x1: wrist[0] - half[0], y1: wrist[1] - half[1], x2: wrist[0] + half[0], y2: wrist[1] + half[1], w: 2.2, color, opacity }];
  for (const side of [-1, 1]) {
    const centre = [wrist[0] + side * half[0], wrist[1] + side * half[1]];
    out.push({ kind: 'bone', x1: centre[0] - ux * 2.3, y1: centre[1] - uy * 2.3,
      x2: centre[0] + ux * 2.3, y2: centre[1] + uy * 2.3, w: 4.6, color: near ? 'textMid' : 'textLow', opacity });
  }
  return out;
}

function apparatus(slug: string, front: boolean, body: BodyParameters): FigurePrim[] {
  const frame = (x: number, y: number, w: number, h: number): RectPrim =>
    ({ kind: 'rect', x, y, w, h, rx: 1, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
  const post = (x1: number, y1: number, x2: number, y2: number): BonePrim =>
    ({ kind: 'bone', x1, y1, x2, y2, w: 1.6, color: 'textLow', opacity: 1 });
  const out: FigurePrim[] = [];
  if (slug === 'lat-pulldown' && !front) {
    // Entry 0183 (owner): the Lat Pulldown is the one movement drawn SIDE-ON,
    // so the machine is drawn as a side elevation, not as the front-view
    // gantry the three grip variants share: one rear upright, the top arm
    // reaching forward over the head to the pulley, the seat under the hips
    // and the thigh pad clamping the thighs. The other three pulldown slugs
    // stay front view and keep the branch below untouched.
    out.push(post(26, 8, 26, 96), post(26, 8, 50, 8),
      { kind: 'circle', cx: 50, cy: 8, r: 1.8, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 },
      frame(34, 71, 26, 5), post(46, 76, 46, 96),
      frame(52, 64, 12, 4.5), post(58, 68.5, 58, 71));
  } else if (slug === 'inverted-row') {
    // Fixed barbell in a rack around hip height (bar at [54.70, 52.8]).
    out.push(
      post(54.70, 16, 54.70, 96),
      { kind: 'rect', x: 52.95, y: 51.8, w: 3.5, h: 3, rx: 0.8, fill: 'line', stroke: 'textLow', strokeWidth: 1.0, opacity: 1 },
      { kind: 'circle', cx: 54.70, cy: 52.8, r: 2.6, fill: 'textHi', opacity: 1 },
      { kind: 'circle', cx: 54.70, cy: 52.8, r: 1.2, fill: 'ink1', opacity: 1 },
    );
  } else if (slug === 'body-tricep-press') {
    // Fixed bar in a rack at chest height (bar at [75, 39.9]).
    out.push(
      post(75, 16, 75, 96),
      { kind: 'rect', x: 73.25, y: 38.9, w: 3.5, h: 3, rx: 0.8, fill: 'line', stroke: 'textLow', strokeWidth: 1.0, opacity: 1 },
      { kind: 'circle', cx: 75, cy: 39.9, r: 2.6, fill: 'textHi', opacity: 1 },
      { kind: 'circle', cx: 75, cy: 39.9, r: 1.2, fill: 'ink1', opacity: 1 },
    );
  } else if (slug === 'dumbbell-bench-press') {
    out.push(frame(36, 60, 36, 5), post(40, 65, 40, 96), post(68, 65, 68, 96));
  } else if (slug === 'close-grip-dumbbell-press') {
    // The same flat bench as the supine precedent (entry 10).
    out.push(frame(36, 60, 36, 5), post(40, 65, 40, 96), post(68, 65, 68, 96));
  } else if (slug === 'barbell-bench-press-medium-grip' || slug === 'bench-press-with-bands') {
    // The same flat bench; the rack uprights are not drawn (the cue shows
    // the bar and plates).
    out.push(frame(36, 60, 36, 5), post(40, 65, 40, 96), post(68, 65, 68, 96));
  } else if (slug === 'close-grip-ez-bar-press' || slug === 'dumbbell-bench-press-with-neutral-grip' || slug === 'one-arm-dumbbell-bench-press' || slug === 'jm-press') {
    // The same flat bench for the family-4 bench members.
    out.push(frame(36, 60, 36, 5), post(40, 65, 40, 96), post(68, 65, 68, 96));
  } else if (slug === 'seated-cable-shoulder-press' || slug === 'seated-dumbbell-press') {
    // Family 11: the athlete is pressed from a seat, so the seat is drawn -
    // it is the whole difference from the standing press, and the standing
    // version's stance must not leak in here.
    out.push(
      frame(44, 56, 22, 4.5),
      post(46, 60.5, 46, 96),
      post(62, 60.5, 62, 96));
  } else if (slug === 'seated-dumbbell-palms-down-wrist-curl' || slug === 'seated-dumbbell-palms-up-wrist-curl') {
    // Family 12: the bench the forearm is laid along, and whose top the elbow
    // rests on for the whole rep. Side view.
    out.push(
      frame(40, 52, 28, 4.5),
      post(42, 56.5, 42, 96),
      post(64, 56.5, 64, 96));
  } else if (slug === 'cable-wrist-curl' || slug === 'finger-curls') {
    // Family 10: the forearms rest on a bench and the elbow is pinned on it -
    // that support is the setup the instructions describe, so it has to be on
    // the sheet. Side view: the bench top runs under the forearm.
    out.push(
      frame(36, 55, 30, 4.5),
      post(39, 59.5, 39, 96),
      post(62, 59.5, 62, 96));
  } else if (slug === 'dumbbell-shoulder-press') {
    out.push(frame(38, 66, 20, 5), frame(35, 36, 5, 32), post(47, 71, 47, 96));
  } else if (slug === 'single-arm-dumbbell-row') {
    // The pad is pushed after Layer 2 in layoutCanonicalFigure: it has to
    // occlude the standing leg, which Layer 1 apparatus cannot do.
  } else if (slug === 'wide-grip-lat-pulldown') {
    // Owner fix (family 2): the draft read as standing. Seat set lower so the
    // athlete sits deep - hips just above the knee line, thighs foreshortened
    // under the pad, shins full and vertical to flat feet - grip stays wide.
    out.push(
      post(PULLDOWN_POST_X.left, 6, PULLDOWN_POST_X.left, 96),
      post(PULLDOWN_POST_X.right, 6, PULLDOWN_POST_X.right, 96),
      post(PULLDOWN_POST_X.left, 6, PULLDOWN_POST_X.right, 6),
      frame(40, 66, 20, 5),
      post(50, 71, 50, 96),
      frame(38, 67.5, 24, 3.5),
      { kind: 'circle', cx: 50, cy: 8, r: 1.8, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
  } else if (PULLDOWN_SLUGS.has(slug)) {
    // The machine must read as a usable object: seat under the hips, thigh
    // pad CLAMPING the thighs just above the knees (the authored knees sit at
    // y 72.2, so the pad crosses the thigh at y 68-72), a pulley wheel where
    // the cable terminates, and the gantry posts.
    out.push(frame(40, 56, 20, 5), post(50, 61, 50, 96), frame(38, 68, 24, 4),
      post(PULLDOWN_POST_X.left, 6, PULLDOWN_POST_X.left, 96),
      post(PULLDOWN_POST_X.right, 6, PULLDOWN_POST_X.right, 96),
      post(PULLDOWN_POST_X.left, 6, PULLDOWN_POST_X.right, 6),
      { kind: 'circle', cx: 50, cy: 8, r: 1.8, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
  } else if (slug === 'cable-row' || slug === 'cable-rope-rear-delt-rows') {
    // Family 5: the seated cable rows: a bench under the hips, the foot plate
    // ahead, and the low pulley at the base of the stack line.
    out.push(
      frame(38, 60, 20, 5),
      post(48, 65, 48, 92),
      frame(62, 88, 8, 6),
      frame(86, 58, 6, 34),
      { kind: 'circle', cx: 86, cy: 92.8, r: 1.7, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 },
    );
  } else if (slug === 'low-pulley-row-to-neck' || slug === 'shotgun-row' || slug === 'alternating-cable-shoulder-press') {
    // Family 5/8: standing low-pulley movements: the stack tower and pulley.
    out.push(
      frame(86, 58, 6, 34),
      { kind: 'circle', cx: 86, cy: 92.8, r: 1.7, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 },
    );
  } else if (slug === 'band-row') {
    // Family 5: the band's chest-height anchor plate on the far wall.
    out.push(
      post(89, 24, 89, 40),
      { kind: 'circle', cx: 88, cy: 31, r: 1.7, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 },
    );
  } else if (slug === 'band-external-rotation' || slug === 'internal-rotation-with-band') {
    // Family 7: the band's elbow-height anchor plate on the far wall.
    out.push(
      post(89, 33, 89, 49),
      { kind: 'circle', cx: 88, cy: 41, r: 1.7, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 },
    );
  } else if (slug === 'cable-internal-rotation' || slug === 'external-rotation-with-cable') {
    // Family 7: the rotation cable tower with its elbow-height pulley.
    out.push(
      frame(86, 20, 6, 72),
      { kind: 'circle', cx: 86, cy: 40.5, r: 1.7, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 },
    );
  } else if (slug === 'standing-palm-in-one-arm-dumbbell-press') {
    // Family 8: the incline bench the free hand braces on.
    out.push(frame(34, 49, 24, 5), post(38, 54, 38, 96), post(54, 54, 54, 96));
  } else if (slug === 'standing-dumbbell-calf-raise' || slug === 'calf-raises-with-bands') {
    // Family 9: the step under the balls of the feet.
    out.push(frame(52, 92.5, 16, 4));
  } else if (slug === 'cable-crunch') {
    out.push(post(26, 6, 26, 96), post(26, 6, 40, 6), frame(21, 30, 10, 44));
  } else if (slug === 'scapular-pull-up') {
    // Ruling 10: a hanging movement has a bar. Static in frame; the hands
    // travel along it as the whole figure lifts. Drawn before the head layer
    // (beforeHead), like the pulldown bar.
    out.push(
      { kind: 'bone', x1: PULLUP_BAR_X1, y1: PULLUP_BAR_Y, x2: PULLUP_BAR_X2, y2: PULLUP_BAR_Y, w: 2.4, color: 'textHi', opacity: 1, beforeHead: true },
      post(PULLUP_BAR_X1 + 0.8, PULLUP_BAR_Y, PULLUP_BAR_X1 + 0.8, PULLUP_BAR_Y + 5.6),
      post(PULLUP_BAR_X2 - 0.8, PULLUP_BAR_Y, PULLUP_BAR_X2 - 0.8, PULLUP_BAR_Y + 5.6),
    );
  } else if (slug === 'one-arm-lat-pulldown') {
    // One-arm pulldown from a high cable. Entry 0182: the athlete is drawn
    // SEATED (the owner allowed kneeling or seated, and a front view cannot
    // show a kneeling shin), so the machine carries the seat and thigh pad the
    // seated pulldown stance needs - hips on the pad, thighs under the roller.
    out.push(
      frame(40, 56, 20, 5), post(50, 61, 50, 96), frame(38, 68, 24, 4),
      post(PULLDOWN_POST_X.left, 6, PULLDOWN_POST_X.left, 96),
      post(PULLDOWN_POST_X.right, 6, PULLDOWN_POST_X.right, 96),
      post(PULLDOWN_POST_X.left, 6, PULLDOWN_POST_X.right, 6),
      { kind: 'circle', cx: ONE_ARM_PULLEY[0], cy: ONE_ARM_PULLEY[1], r: 1.8, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
  } else if (slug === 'v-bar-pullup') {
    // Ruling 10: a hanging movement has a bar. The same static bar as the
    // scapular pull-up, set lower (15.4: the fixed hands must stay within
    // reach of the shoulder roots through the whole pull), with the small V
    // chevron of the V-bar handle hanging under its centre.
    out.push(
      { kind: 'bone', x1: PULLUP_BAR_X1, y1: 15.4, x2: PULLUP_BAR_X2, y2: 15.4, w: 2.4, color: 'textHi', opacity: 1, beforeHead: true },
      post(PULLUP_BAR_X1 + 0.8, 15.4, PULLUP_BAR_X1 + 0.8, 21.0),
      post(PULLUP_BAR_X2 - 0.8, 15.4, PULLUP_BAR_X2 - 0.8, 21.0),
      { kind: 'bone', x1: 47.5, y1: 18.6, x2: 50, y2: 16.6, w: 1.8, color: 'textHi', opacity: 1, beforeHead: true },
      { kind: 'bone', x1: 50, y1: 16.6, x2: 52.5, y2: 18.6, w: 1.8, color: 'textHi', opacity: 1, beforeHead: true },
    );
  } else if (INCLINE_PRESS_SLUGS.has(slug) || slug === 'chest-supported-dumbbell-row') {
    // Family 15: the incline bench. The pad rides the trunk's back surface at
    // the 25-degree recline - drawn as a solid slab with a surface-coloured
    // core, so where the torso covers its upper half the visible rim below the
    // silhouette reads the same as the flat bench's outline rect. The pad's top
    // reaches behind the head and its low end carries the hips: the athlete
    // reads as ON the bench, and the pad crosses the back along its whole
    // length (the apparatus-usage law). The cable member adds the stack whose
    // pulley its two cables run to.
    out.push(
      { kind: 'bone', x1: 37.5, y1: 69.5, x2: 65.8, y2: 56.3, w: 6, color: 'textLow', opacity: 1 },
      { kind: 'bone', x1: 37.5, y1: 69.5, x2: 65.8, y2: 56.3, w: 3.6, color: 'line', opacity: 1 },
      post(42, 70.4, 42, 96),
      post(62, 61.1, 62, 96),
    );
    if (slug === 'incline-cable-chest-press') {
      out.push(frame(76, 58, 6, 34));
    }
  } else if (slug === 'barbell-incline-shoulder-raise' || slug === 'dumbbell-incline-shoulder-raise') {
    // Family 38: the incline bench (the reclined backrest) and, on the
    // barbell version, the squat rack behind it.
    out.push({ kind: 'rect', x: 20, y: 78, w: 34, h: 4, rx: 1.5, fill: 'textHi', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    out.push({ kind: 'bone', x1: 22, y1: 78, x2: 8, y2: 44, w: 3.2, color: 'textMid', opacity: 1 });
    out.push({ kind: 'rect', x: 24, y: 82, w: 4, h: 16, rx: 1.2, fill: 'textMid', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    if (slug === 'barbell-incline-shoulder-raise') {
      out.push({ kind: 'rect', x: 4, y: 30, w: 3, h: 62, rx: 1.2, fill: 'textMid', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    }
  } else if (slug === 'kneeling-single-arm-high-pulley-row' || slug === 'kneeling-high-pulley-row') {
    // Family 37: the drawn high pulley the rows reach into.
    out.push({ kind: 'circle', cx: 84, cy: 22, r: 1.9, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    out.push({ kind: 'rect', x: 86, y: 22, w: 3, h: 62, rx: 1.2, fill: 'textMid', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
  } else if (PUSHDOWN_SLUGS.has(slug)) {
    out.push(post(87, 10, 87, 96), post(87, 10, 84, 10));
    out.push({ kind: 'circle', cx: 84, cy: 10, r: 1.7, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
  } else if (slug === STRAIGHT_ARM_PULLDOWN) {
    out.push(post(91, 4, 91, 96), post(91, 4, 88, 4));
    out.push({ kind: 'circle', cx: 88, cy: 4, r: 1.7, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
  } else if (slug === 'bent-over-dumbbell-rear-delt-raise-with-head-on-bench') {
    // A real incline pad, with connected supports and the same surface used
    // by the body-specific forehead contact in supportedRearRaiseGeometry.
    const dx = 12 * Math.cos(HEAD_BENCH_ANGLE), dy = -12 * Math.sin(HEAD_BENCH_ANGLE);
    out.push({ kind: 'bone', x1: 68 - dx, y1: 63 - dy, x2: 68 + dx, y2: 63 + dy, w: 4, color: 'textHi', opacity: 1 });
    // Like the row bench, apparatus between far limbs and trunk is dimmed:
    // it must not carry the opaque torso-bar signature or read as a limb.
    out.push({ ...post(68 - dx, 63 - dy + 2, 68 - dx, 96), opacity: 0.75 });
    out.push({ ...post(68 + dx, 63 + dy + 2, 68 + dx, 96), opacity: 0.75 });
  } else if (slug === 'step-up-with-knee-raise') {
    // Family 35: the drawn box under the stepping foot.
    out.push({ kind: 'rect', x: 52, y: 78, w: 30, h: 22, rx: 1.5, fill: 'textMid', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    out.push({ kind: 'rect', x: 52, y: 76, w: 30, h: 3, rx: 1.2, fill: 'textHi', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
  } else if (slug === 'preacher-curl' || slug === 'cable-preacher-curl' || slug === 'preacher-hammer-dumbbell-curl') {
    if (front) {
      out.push({ kind: 'rect', x: 24, y: 42, w: 40, h: 18, rx: 4, fill: 'textMid', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    } else {
      // Sloped support on the underside of the fixed60deg upper-arm chain.
      // The working rep never moves the pad, shoulder or supported elbow.
      const distance = body.lw * 0.88 / 2 + 2.5;
      const dx = -Math.sin(Math.PI / 3) * distance;
      const dy = Math.cos(Math.PI / 3) * distance;
      out.push({ kind: 'bone', x1: 44 + dx, y1: 32 + dy, x2: 50.25 + dx, y2: 32 + 12.5 * Math.sin(Math.PI / 3) + dy, w: 5, color: 'textMid', opacity: 1 });
      out.push(post(50.25 + dx, 32 + 12.5 * Math.sin(Math.PI / 3) + dy, 42, 76));
    }
    out.push({ kind: 'rect', x: 40, y: 51, w: 4, h: 28, rx: 1.5, fill: 'textMid', opacity: 1 });
    out.push({ kind: 'rect', x: 22, y: 64, w: 18, h: 3, rx: 1.2, fill: 'textHi', opacity: 1 });
    out.push({ kind: 'rect', x: 26, y: 67, w: 3, h: 29, rx: 1, fill: 'textMid', opacity: 1 });
    if (slug === 'cable-preacher-curl') {
      out.push({ kind: 'circle', cx: 72, cy: 92, r: 1.7, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    }
  } else if (slug === 'incline-push-up' || slug === 'incline-push-up-close-grip' || slug === 'incline-push-up-wide') {
    // Family 32: the raised platform under the hands (the incline).
    out.push({ kind: 'rect', x: 58, y: 55, w: 42, h: 3, rx: 1.2, fill: 'textHi', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    out.push({ kind: 'rect', x: 62, y: 58, w: 4, h: 34, rx: 1.2, fill: 'textMid', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    out.push({ kind: 'rect', x: 92, y: 58, w: 4, h: 34, rx: 1.2, fill: 'textMid', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
  } else if (slug === 'cable-pull-through' || slug === 'band-good-morning-pull-through' || slug === 'hip-extension-with-bands') {
    // Family 30: the low anchor behind the hips (the pulley for the cable, the
    // band anchor for the two band versions).
    out.push({ kind: 'circle', cx: 86, cy: 88, r: 1.7, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
  } else if (slug === 'cable-seated-crunch') {
    // Family 29: the bench pad and the low pulley the seated crunch works on.
    out.push({ kind: 'rect', x: 36, y: 89, w: 46, h: 5, rx: 1.6, fill: 'line', opacity: 1 });
    out.push({ kind: 'circle', cx: 14, cy: 82, r: 1.7, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
  } else if (slug === 'cable-shrugs') {
    // The frozen source specifies one low pulley and a straight cable bar.
    out.push({ kind: 'circle', cx: 84, cy: 88, r: 1.7, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    out.push(post(87, 74, 87, 96));
  } else if (slug === 'cable-rope-overhead-triceps-extension' || slug === 'cable-one-arm-tricep-extension') {
    // Family 27: the low pulley the overhead cable runs from (behind the hips).
    out.push({ kind: 'circle', cx: 14, cy: 62, r: 1.7, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
  } else if (slug === 'crunches') {
    // Family 26: the bench pad the torso rides (the template names a bench).
    out.push({ kind: 'rect', x: 36, y: 89, w: 46, h: 5, rx: 1.6, fill: 'line', opacity: 1 });
  } else if (slug === 'rope-crunch') {
    // Family 26: the low pulley the rope crunch's cable runs from.
    out.push({ kind: 'circle', cx: 14, cy: 82, r: 1.7, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
  } else if (slug === 'feet-elevated-push-up') {
    // Family 25: the box the feet rest on - it is what makes the cue readable.
    out.push({ kind: 'rect', x: 11, y: 58, w: 19, h: 34, rx: 1, fill: 'line', opacity: 1 });
  } else if (slug === 'seated-cable-rows') {
    // Family 24: the footplate at the feet and the low pulley beside it - the
    // cable terminates at a drawn pulley, so the usage relationship reads.
    out.push({ kind: 'rect', x: 76, y: 88, w: 8, h: 3, rx: 1, fill: 'line', opacity: 1 });
    out.push({ kind: 'circle', cx: 84, cy: 82, r: 1.7, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
  } else if (slug === 'face-pull') {
    // Family 23: the cable stack with its upper-chest-height pulley - the rope
    // terminates at a drawn pulley, so the usage relationship reads at app240.
    out.push(frame(86, 18, 6, 78), { kind: 'circle', cx: 86, cy: 50, r: 1.7, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
  } else if (slug === 'pallof-press' || slug === 'pallof-press-with-rotation') {
    // Family 17: the anchor post behind the figure, chest height - the band or
    // cable terminates at it, so the usage relationship reads at app240.
    out.push(post(26, 30, 26, 96));
  } else if (slug === 'barbell-seated-calf-raise' || slug === 'dumbbell-seated-one-leg-calf-raise') {
    // Family 18: the flat bench the hips sit on and the low block the balls of
    // the feet rest on - the seated reads seated and the feet read on the block.
    out.push(
      frame(28, 62, 26, 5), post(32, 67, 32, 96), post(50, 67, 50, 96),
      frame(75, 88, 14, 8),
    );
  }
  return out;
}

/**
 * Implements. RN has no path primitive, so the kettlebell / goblet handle arc
 * is approximated with a short straight bar above the bell — the same
 * approximation both renderers share (documented P3 deviation).
 *
 * Front-view horizontal dumbbells sit exactly at the wrists, and a front-view
 * torso is at its widest at the pelvis — the bell then blends into the torso
 * outline (found in the WO-09 round-1 visual sweep, farmer carry). Bell bars
 * therefore shift 2.5 box units outward from the spine axis in front view so
 * they read as separate held implements.
 */
function implement(
  slug: string,
  j: CanonicalPose,
  farColor: ColorRole,
  farOpacity: number,
  view: ViewName,
  body: BodyParameters,
  options: Pick<FigureOptions, 'role' | 'implementTiltWeight' | 'implementOrientation' | 'implementCount'
    | 'implementScale'> = {},
): FigurePrim[] {
  const out: FigurePrim[] = [];
  if (PERSPECTIVE_BARBELL_SLUGS.has(slug)) return out;
  const equipment = EQUIPMENT_BY_SLUG[slug] ?? 'none';
  const front = view === 'front';
  // Owner batch (B1-20-R2): the carries draw their bells 1.4x. The scale travels
  // with every derived measure - the bell, its outward clearance, the head push
  // and the side-view merge threshold - so a bigger bell still reads as held.
  const scale = options.implementScale ?? 1;
  const outward = (x: number): number => (x >= j.nk[0] ? x + 2.5 * scale : x - 2.5 * scale);
  if (CHIN_TICK_SLUGS.has(slug) && (j.ct ?? 0) >= 0.5) {
    // Entry 0184: the finish line. A short tick at the chin, either side of the
    // hands, drawn in the mid tone the scanner allows - never the chalk accent -
    // and never on the body.
    const chin = j.hd[1] + body.hr;
    const cx = (j.wr[0] + j.wf[0]) / 2;
    out.push({ kind: 'bone', x1: cx - 4.5, y1: chin, x2: cx + 4.5, y2: chin,
      w: 1.2, color: 'textMid', opacity: 0.9 });
  }
  if (equipment === 'dumbbells' && slug !== 'dumbbell-shrug' && slug !== 'preacher-hammer-dumbbell-curl' && slug !== HEAD_SUPPORTED_RAISE && FLYE_INCLINES[slug] === undefined && slug !== REVERSE_LUNGE) {
    if (slug === 'hammer-curl') {
      // Neutral (thumbs-up) vertical orientation.
      if (j.wr) out.push({ kind: 'rect', x: j.wr[0] - 2.3, y: j.wr[1] - 6.5, w: 4.6, h: 13, rx: 1.6, fill: 'textHi', opacity: 1 });
      if (j.wf) out.push({ kind: 'rect', x: j.wf[0] - 2.3, y: j.wf[1] - 6.5, w: 4.6, h: 13, rx: 1.6, fill: farColor, opacity: farOpacity });
    } else if (slug === 'goblet-squat' && j.b) {
      // Single front-held implement at anchor b.
      out.push({ kind: 'circle', cx: j.b[0], cy: j.b[1] + 1.6, r: 5.2, fill: 'textHi', opacity: 1 });
      out.push({ kind: 'bone', x1: j.b[0] - 3.0, y1: j.b[1] - 2.6, x2: j.b[0] + 3.0, y2: j.b[1] - 2.6, w: 2.2, color: 'textHi', opacity: 1 });
    } else if (ROW_SLUGS.has(slug)) {
      // Working hand only (see the hand-circle note above): the dumbbell rides
      // the wrist that is NOT resting on the bench plane.
      const working = j.wr && j.wf
        ? (Math.abs(j.wr[1] - ROW_BENCH.top) > Math.abs(j.wf[1] - ROW_BENCH.top) ? j.wr : j.wf)
        : (j.wr ?? j.wf);
      if (working) {
        // Owner correction 2026-09-25 (Entry 0171): at the row's top position
        // the arm, the bell and the thigh merged into one F shape at app240.
        // The grip is untouched; the bell gains a background-coloured outline so
        // it reads as a separate object wherever it crosses the forearm, the
        // thigh or the torso.
        out.push({ kind: 'rect', x: working[0] - 6.5 * scale, y: working[1] - 2.3 * scale,
          w: 13 * scale, h: 4.6 * scale, rx: 1.6 * scale, fill: 'textHi', opacity: 1,
          stroke: 'ink1', strokeWidth: 1.4 });
      }
    } else if (slug === 'farmer-carry' || slug === 'suitcase-carry') {
      // Owner correction 2026-09-25 (Entry 0171): a carry bell must read as a
      // dumbbell held in the hand beside the thigh, fully inside the card. It
      // hangs below the grip like a suitcase, so it no longer reads as a bar
      // across the thigh and no longer runs off the left edge of frame 1. The
      // small outward nudge the owner ruled for (0169) still applies.
      const bell = (cx: number, cy: number, color: ColorRole, op: number): void => {
        const x = cx >= j.nk[0] ? cx + 2.5 * scale : cx - 2.5 * scale;
        out.push({ kind: 'rect', x: x - 2.3 * scale, y: cy + 1.6,
          w: 4.6 * scale, h: 13 * scale, rx: 1.6 * scale, fill: color, opacity: op });
      };
      if (j.wr) bell(j.wr[0], j.wr[1], 'textHi', 1);
      if (j.wf && options.implementCount !== 1) bell(j.wf[0], j.wf[1], farColor, farOpacity);
    } else if (slug === 'dumbbell-squat') {
      // Family-queue family 1 (squat, standing). The dumbbells hang at the
      // sides beside the legs, so the near bell uses the carry's suitcase
      // form (owner correction 2026-09-25, Entry 0171: a side bell hangs
      // below the grip and must not read as a bar across the hip) with the
      // ink1 outline the owner asked for (Entry 0176) so it separates from
      // the thigh where they cross at the bottom of the squat, and the
      // outward nudge (Entry 0169) that keeps it clear of the shin at
      // app240. The side-view head-clearance push does not apply here: a
      // bell hung at the sides can never reach the head circle, so the
      // authored wrist positions are used directly.
      const bell = (cx: number, cy: number, color: ColorRole, op: number): void => {
        const x = cx >= j.nk[0] ? cx + 2.5 * scale : cx - 2.5 * scale;
        out.push({ kind: 'rect', x: x - 2.3 * scale, y: cy + 1.6,
          w: 4.6 * scale, h: 13 * scale, rx: 1.6 * scale, fill: color, opacity: op,
          stroke: 'ink1', strokeWidth: 1.4 });
      };
      if (j.wr) bell(j.wr[0], j.wr[1], 'textHi', 1);
      // Side view: the two wrists sit 4.8 apart, so two bells at this depth
      // would merge into one slab; the far bell is occluded by the near one
      // and is not drawn (the same rule the generic branch below uses).
      const farHidden = options.implementCount === 1
        || (!front && j.wf !== undefined && Math.abs(j.wr[0] - j.wf[0]) < 7.5 * scale);
      if (j.wf && !farHidden) bell(j.wf[0], j.wf[1], farColor, farOpacity);
    } else if (slug === 'close-grip-dumbbell-press' && j.wr && j.wf) {
      // Close grip: the bells are pressed together, so the pair is drawn as
      // one compact unit - both bells in the horizontal side-view form, the
      // far one at the tightened offset, never hidden.
      const bell = (cx: number, cy: number, color: ColorRole, op: number): void => {
        out.push({ kind: 'rect', x: cx - 6.5, y: cy - 2.3, w: 13, h: 4.6, rx: 1.6, fill: color, opacity: op });
      };
      bell(j.wr[0], j.wr[1], 'textHi', 1);
      bell(j.wf[0], j.wf[1], farColor, farOpacity);
    } else if ((slug === 'dumbbell-bench-press-with-neutral-grip' || INCLINE_DB_SLUGS.has(slug)) && j.wr && j.wf) {
      // Neutral grip: the bells stand vertical (palms facing each other);
      // both are drawn, the far one at the tightened offset, never hidden.
      // Family 15's two incline dumbbell members join this branch: the same
      // neutral pair on the same pressed path, told apart by their elbows.
      const bell = (cx: number, cy: number, color: ColorRole, op: number): void => {
        out.push({ kind: 'rect', x: cx - 2.3, y: cy - 6.5, w: 4.6, h: 13, rx: 1.6, fill: color, opacity: op });
      };
      bell(j.wr[0], j.wr[1], 'textHi', 1);
      bell(j.wf[0], j.wf[1], farColor, farOpacity);
    } else if (slug === 'one-arm-dumbbell-bench-press' && j.wr) {
      // One bell in the working hand; the free arm stays empty.
      out.push({ kind: 'rect', x: j.wr[0] - 6.5, y: j.wr[1] - 2.3, w: 13, h: 4.6, rx: 1.6, fill: 'textHi', opacity: 1 });
    } else if (slug === 'bent-over-two-dumbbell-row-with-palms-in' && j.wr && j.wf) {
      // Palms-in: the bells stand vertical through the row.
      const bell = (cx: number, cy: number, color: ColorRole, op: number): void => {
        out.push({ kind: 'rect', x: cx - 2.3, y: cy - 6.5, w: 4.6, h: 13, rx: 1.6, fill: color, opacity: op });
      };
      bell(j.wr[0], j.wr[1], 'textHi', 1);
      bell(j.wf[0], j.wf[1], farColor, farOpacity);
    } else if (slug === 'standing-palm-in-one-arm-dumbbell-press' && j.wr) {
      // One palm-in bell in the working hand, drawn standing vertical.
      out.push({ kind: 'rect', x: j.wr[0] - 2.3, y: j.wr[1] - 6.5, w: 4.6, h: 13, rx: 1.6, fill: 'textHi', opacity: 1 });
    } else {
      // Horizontal dumbbells at each wrist. In SIDE view the rack position of
      // a seated press puts the bells beside the ears, and an undivided bell
      // bar overlapped the drawn head by 1.6 units (near) / 5.1 units (far)
      // at that frame (round-3 reviewer finding, verified geometrically).
      // A bell that would intersect the head circle is pushed just clear of
      // it along the view's horizontal axis — projection legibility only; the
      // authored wrist positions are untouched.
      const out2 = (x: number): number => (x >= j.nk[0] ? x + 2.5 * scale : x - 2.5 * scale);
      const clearOfHead = (cx: number, cy: number): number => {
        if (front) return cx;
        const half = 6.5 * scale;
        const headClear = Math.abs(cx - j.hd[0]) - half - (body.hr + 1.0);
        if (headClear >= 0) return cx;
        const dir = Math.sign(cx - j.hd[0] || 1);
        const target = j.hd[0] + dir * (half + body.hr + 1.0);
        // The push may never detach the bell from its hand: it is clamped to
        // keep the bell's inner edge over the wrist dot. At the press lockout
        // the wrist sits beside the ear (O-8 stack) — a full clearance push
        // would throw the bell off the hand, and with the near arm drawn
        // AFTER the head the bell above the head needs no push at all.
        const maxPush = half - body.lw * 0.44 - 0.5;
        const push = Math.min(Math.abs(target - cx), maxPush);
        return cx + dir * push;
      };
      // In side view two bells at nearly the same depth merge into one slab
      // (round-3 reviewer finding, split squat: two 13-unit bells 5.8 apart
      // overlapped by 7.2). The far bell is occluded by the near one when the
      // wrists are that close, so it is not drawn.
      // A declared count of 1 hides the far bell outright: a suitcase carry
      // holds one bell in the near hand, whatever the wrists' separation.
      const farBellHidden = options.implementCount === 1
        || (!front && j.wf !== undefined && Math.abs(j.wr[0] - j.wf[0]) < 7.5 * scale);
      if (options.implementOrientation === 'supinated') {
        // Keep one primitive shape throughout the rep and blend into/out of
        // the peak tilt. The bell's inner end rises toward the peak.
        // measured half-length x tan(tilt); the inner end is the one nearer the
        // neck, so the two arms mirror about the midline. Drawn as bones rather
        // than rects because RectPrim is axis-aligned and a bone already
        // serialises to a rotated rounded bar.
        const weight = options.implementTiltWeight ?? (options.role === 'peak' ? 1 : 0);
        const rise = 6.5 * scale * Math.tan((BELL_TILT_DEG * weight * Math.PI) / 180);
        const bell = (cx: number, cy: number, color: ColorRole, op: number): void => {
          const innerDir = Math.sign(j.nk[0] - cx) || 1;
          out.push({
            kind: 'bone',
            x1: cx - innerDir * 6.5 * scale, y1: cy + rise,
            x2: cx + innerDir * 6.5 * scale, y2: cy - rise,
            w: 4.6 * scale, color, opacity: op,
          });
        };
        if (j.wr) bell(clearOfHead(front ? out2(j.wr[0]) : j.wr[0], j.wr[1]), j.wr[1], 'textHi', 1);
        if (j.wf && !farBellHidden) bell(clearOfHead(front ? out2(j.wf[0]) : j.wf[0], j.wf[1]), j.wf[1], farColor, farOpacity);
      } else {
        if (j.wr) out.push({ kind: 'rect', x: clearOfHead(front ? out2(j.wr[0]) : j.wr[0], j.wr[1]) - 6.5 * scale, y: j.wr[1] - 2.3 * scale, w: 13 * scale, h: 4.6 * scale, rx: 1.6 * scale, fill: 'textHi', opacity: 1 });
        if (j.wf && !farBellHidden) out.push({ kind: 'rect', x: clearOfHead(front ? out2(j.wf[0]) : j.wf[0], j.wf[1]) - 6.5 * scale, y: j.wf[1] - 2.3 * scale, w: 13 * scale, h: 4.6 * scale, rx: 1.6 * scale, fill: farColor, opacity: farOpacity });
      }
    }
  }
  if (slug === 'kettlebell-swing' && j.b) {
    out.push({ kind: 'circle', cx: j.b[0], cy: j.b[1] + 1.6, r: 5.2, fill: 'textHi', opacity: 1 });
    out.push({ kind: 'bone', x1: j.b[0] - 3.0, y1: j.b[1] - 2.6, x2: j.b[0] + 3.0, y2: j.b[1] - 2.6, w: 2.2, color: 'textHi', opacity: 1 });
  }
  if ((slug === 'alternating-floor-press' || slug === 'extended-range-one-arm-kettlebell-floor-press') && j.b) {
    // The same round bell hanging under its handle, riding the working hand.
    out.push({ kind: 'circle', cx: j.b[0], cy: j.b[1] + 1.6, r: 5.2, fill: 'textHi', opacity: 1 });
    out.push({ kind: 'bone', x1: j.b[0] - 3.0, y1: j.b[1] - 2.6, x2: j.b[0] + 3.0, y2: j.b[1] - 2.6, w: 2.2, color: 'textHi', opacity: 1 });
  }
  if (slug === 'bench-press-with-bands' && j.wr && j.b) {
    // The band loops under the bench (anchor at its base) and runs up over
    // the bar; it softens at the chest and stretches to lockout.
    const anchor: CanonicalPoint = [52, 90];
    const hook: CanonicalPoint = [j.b[0] - 3.2, j.b[1] - 2.2];
    const over: CanonicalPoint = [j.b[0] + 2.6, j.b[1] - 0.6];
    out.push({ kind: 'bone', x1: anchor[0], y1: anchor[1], x2: hook[0], y2: hook[1], w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'bone', x1: hook[0], y1: hook[1], x2: over[0], y2: over[1], w: 1.4, color: 'textMid', opacity: 1 });
  }
  if ((slug === 'cable-row' || slug === 'cable-rope-rear-delt-rows' || slug === 'low-pulley-row-to-neck' || slug === 'shotgun-row') && j.wr) {
    // Family 5: the cable runs from the handle at the hands to the low pulley.
    out.push({ kind: 'bone', x1: j.wr[0], y1: j.wr[1], x2: 86, y2: 92.8, w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
    if (slug === 'cable-rope-rear-delt-rows') {
      // The rope ends read as a pair at the hands.
      out.push({ kind: 'bone', x1: j.wr[0] - 3.2, y1: j.wr[1] + 0.8, x2: j.wr[0] + 0.4, y2: j.wr[1] - 1.6, w: 1.2, color: 'textMid', opacity: 1 });
      out.push({ kind: 'bone', x1: j.wr[0] + 3.2, y1: j.wr[1] + 0.8, x2: j.wr[0] - 0.4, y2: j.wr[1] - 1.6, w: 1.2, color: 'textMid', opacity: 1 });
    }
  }
  if (slug === 'band-row' && j.wr) {
    // The band runs from the chest-height anchor to the hands.
    out.push({ kind: 'bone', x1: 88, y1: 31, x2: j.wr[0] + 2.0, y2: j.wr[1] - 1.4, w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'bone', x1: j.wr[0] + 2.0, y1: j.wr[1] - 1.4, x2: j.wr[0] - 1.4, y2: j.wr[1] + 1.0, w: 1.4, color: 'textMid', opacity: 1 });
  }
  if ((slug === 'band-external-rotation' || slug === 'internal-rotation-with-band') && j.wr) {
    // Family 7: the band runs from the elbow-height anchor to the hand.
    out.push({ kind: 'bone', x1: 88, y1: 41, x2: j.wr[0] + 2.0, y2: j.wr[1] - 1.2, w: 1.4, color: 'textMid', opacity: 1 });
  }
  if (slug === 'shoulder-press-with-bands' && j.wr) {
    // Family 8: the band is stood on and runs up to the hands; it is longest
    // at the overhead finish.
    out.push({ kind: 'bone', x1: 49, y1: 94, x2: j.wr[0] + 2.0, y2: j.wr[1] - 1.2, w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'bone', x1: 49, y1: 94, x2: j.wr[0] - 1.6, y2: j.wr[1] + 0.6, w: 1.4, color: 'textMid', opacity: 1 });
  }
  if (slug === 'calf-raises-with-bands' && j.wr && j.an) {
    // Family 9: the band runs from under the forefeet up to the handles.
    out.push({ kind: 'bone', x1: j.an[0] - 1.0, y1: j.an[1] + 1.0, x2: j.wr[0] + 2.0, y2: j.wr[1] - 1.2, w: 1.4, color: 'textMid', opacity: 1 });
  }
  if (slug === 'band-pull-apart' && j.wr && j.wf) {
    // Family 16: one band held between the hands at shoulder height. It is
    // visibly stretching: its drawn width thins as the hands reach wide (the
    // hand distance runs 43 -> 64.4 across the rep).
    const stretch = Math.hypot(j.wf[0] - j.wr[0], j.wf[1] - j.wr[1]);
    const w = 1.9 - Math.min(0.8, Math.max(0, (stretch - 43) * 0.8 / 21.4));
    out.push({ kind: 'bone', x1: j.wr[0], y1: j.wr[1], x2: j.wf[0], y2: j.wf[1], w, color: 'textMid', opacity: 1 });
  }
  if (slug === 'cable-rear-delt-fly' && j.wr && j.wf) {
    // Family 16: crossed handles, each cable running to the OPPOSITE pulley
    // above head height - the cross over the chest is the visual cue. The
    // cables are drawn before the head ring where their run passes the head
    // (the pulldown convention).
    out.push({ kind: 'circle', cx: 14, cy: 9.5, r: 2.2, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    out.push({ kind: 'circle', cx: 86, cy: 9.5, r: 2.2, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    out.push({ kind: 'bone', x1: j.wr[0], y1: j.wr[1], x2: 86, y2: 9.5, w: 1.4, color: 'textMid', opacity: 1, beforeHead: true });
    out.push({ kind: 'bone', x1: j.wf[0], y1: j.wf[1], x2: 14, y2: 9.5, w: 1.4, color: 'textMid', opacity: 1, beforeHead: true });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wf[0], cy: j.wf[1], r: 2.6, fill: 'textHi', opacity: 1 });
  }
  if (slug === 'pallof-press' && j.wr) {
    // Family 17: the band runs from the drawn anchor post behind the figure to
    // the hands and visibly stretches as the hands press away from the chest
    // (24.5 -> 36.3 units, thinning as it goes).
    const stretch = Math.hypot(j.wr[0] - 26, j.wr[1] - 46);
    const w = 1.9 - Math.min(0.8, Math.max(0, (stretch - 24.5) * 0.8 / 11.8));
    out.push({ kind: 'bone', x1: 26, y1: 46, x2: j.wr[0], y2: j.wr[1], w, color: 'textMid', opacity: 1 });
  }
  if (slug === 'pallof-press-with-rotation' && j.wr) {
    // Family 17: the cable member - a D-handle at the hands and a cable to the
    // drawn pulley at the anchor height (chest height, the standard setup for
    // the name; recorded as the open question at the checkpoint).
    out.push({ kind: 'circle', cx: 26, cy: 46, r: 2.2, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    out.push({ kind: 'bone', x1: 26, y1: 46, x2: j.wr[0], y2: j.wr[1], w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
  }
  if (slug === 'seated-cable-rows' && j.wr) {
    // Family 24: the cable runs from the low pulley to the hands; a D-handle
    // sits at the wrists (the family-17 handle reading).
    out.push({ kind: 'bone', x1: 84, y1: 82, x2: j.wr[0], y2: j.wr[1], w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'rect', x: j.wr[0] - 1.1, y: j.wr[1] - 4, w: 2.2, h: 8, rx: 1, fill: 'textHi', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
  }
  if (slug === 'barbell-incline-shoulder-raise' && j.wr) {
    // the barbell across the hands
    out.push({ kind: 'bone', x1: j.wr[0], y1: j.wr[1] - 3.2, x2: j.wr[0], y2: j.wr[1] + 3.2, w: 1.6, color: 'textHi', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1] - 3.2, r: 2.2, fill: 'textMid', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1] + 3.2, r: 2.2, fill: 'textMid', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
  }
  if (slug === 'dumbbell-incline-shoulder-raise' && j.wr) {
    out.push({ kind: 'rect', x: j.wr[0] - 1.8, y: j.wr[1] - 3.5, w: 3.6, h: 7, rx: 1.5, fill: 'textMid', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
  }
  if ((slug === 'kneeling-single-arm-high-pulley-row' || slug === 'kneeling-high-pulley-row') && j.wr) {
    out.push({ kind: 'bone', x1: 84, y1: 22, x2: j.wr[0], y2: j.wr[1], w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
  }
  if (slug === 'barbell-rear-delt-row' && j.wr) {
    // the barbell at the hands
    out.push({ kind: 'bone', x1: j.wr[0], y1: j.wr[1] - 3.2, x2: j.wr[0], y2: j.wr[1] + 3.2, w: 1.6, color: 'textHi', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1] - 3.2, r: 2.2, fill: 'textMid', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1] + 3.2, r: 2.2, fill: 'textMid', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
  }
  if (slug === 'dumbbell-lunge' && j.wr) {
    // the dumbbells hang at the hands
    out.push({ kind: 'rect', x: j.wr[0] - 1.8, y: j.wr[1], w: 3.6, h: 7, rx: 1.5, fill: 'textMid', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
  }
  if (slug === 'preacher-curl' && j.wr && j.wf) {
    out.push(...layoutStraightGripBar(j.wr, j.wf, true));
  }
  if (slug === 'cable-preacher-curl' && j.wr && j.wf) {
    out.push({ kind: 'bone', x1: 72, y1: 92, x2: (j.wr[0] + j.wf[0]) / 2, y2: (j.wr[1] + j.wf[1]) / 2, w: 1.4, color: 'textMid', opacity: 1 });
    out.push(...layoutStraightGripBar(j.wr, j.wf, false));
  }
  if (slug === 'preacher-hammer-dumbbell-curl' && j.wr && j.wf) {
    out.push(...layoutHammerDumbbell(j.wf, j.ef, false), ...layoutHammerDumbbell(j.wr, j.el));
  }
  if (slug === HEAD_SUPPORTED_RAISE) {
    // Two loads, projected along the forward grip axis; one per actual hand.
    const half = 6.5 * Math.cos(45 * Math.PI / 180);
    for (const [point, color, opacity] of [[j.wf, farColor, farOpacity], [j.wr, 'textHi', 1]] as const) {
      out.push({ kind: 'bone', x1: point[0] - half, y1: point[1], x2: point[0] + half, y2: point[1], w: 2.2, color, opacity });
      for (const dx of [-half, half]) out.push({ kind: 'circle', cx: point[0] + dx, cy: point[1], r: 2.4, fill: color, opacity });
    }
  }
  if (slug === 'cable-pull-through' && j.wr) {
    out.push({ kind: 'bone', x1: 86, y1: 88, x2: j.wr[0], y2: j.wr[1], w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'bone', x1: j.wr[0] - 3.2, y1: j.wr[1] - 0.8, x2: j.wr[0] + 0.4, y2: j.wr[1] + 1.6, w: 1.2, color: 'textMid', opacity: 1 });
    out.push({ kind: 'bone', x1: j.wr[0] + 3.2, y1: j.wr[1] - 0.8, x2: j.wr[0] - 0.4, y2: j.wr[1] + 1.6, w: 1.2, color: 'textMid', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
  }
  if (slug === 'band-good-morning-pull-through' && j.wr) {
    // the band thins with stretch (the family-16 rule)
    const stretch = Math.max(0, Math.min(1, (Math.hypot(j.wr[0] - 86, j.wr[1] - 88) - 40) / 30));
    out.push({ kind: 'bone', x1: 86, y1: 88, x2: j.wr[0], y2: j.wr[1], w: 1.9 - stretch * 0.8, color: 'textMid', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
  }
  if (slug === 'hip-extension-with-bands' && j.hp) {
    // the tell: the band loads at the HIP line, not the hands
    const stretch = Math.max(0, Math.min(1, (Math.hypot(j.hp[0] - 86, j.hp[1] - 88) - 40) / 30));
    out.push({ kind: 'bone', x1: 86, y1: 88, x2: j.hp[0] + 3, y2: j.hp[1], w: 1.9 - stretch * 0.8, color: 'textMid', opacity: 1 });
  }
  if (slug === 'cable-seated-crunch' && j.wr) {
    // Family 29: the cable from the low pulley to the handle at the hands.
    out.push({ kind: 'bone', x1: 14, y1: 82, x2: j.wr[0], y2: j.wr[1], w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'rect', x: j.wr[0] - 1.1, y: j.wr[1] - 4, w: 2.2, h: 8, rx: 1, fill: 'textHi', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
  }
  if (slug === 'dumbbell-shrug' && j.wr && j.wf) {
    // Family 28: a dumbbell hangs at each side (the arms as dead weight).
    out.push({ kind: 'rect', x: j.wr[0] - 3, y: j.wr[1] - 6.2, w: 6, h: 4.6, rx: 1.2, fill: 'textLow', opacity: 1 });
    out.push({ kind: 'rect', x: j.wr[0] - 3, y: j.wr[1] + 1.6, w: 6, h: 4.6, rx: 1.2, fill: 'textLow', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
    out.push({ kind: 'rect', x: j.wf[0] - 3, y: j.wf[1] - 6.2, w: 6, h: 4.6, rx: 1.2, fill: 'textLow', opacity: 1 });
    out.push({ kind: 'rect', x: j.wf[0] - 3, y: j.wf[1] + 1.6, w: 6, h: 4.6, rx: 1.2, fill: 'textLow', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wf[0], cy: j.wf[1], r: 2.6, fill: 'textHi', opacity: 1 });
  }
  if ((slug === 'barbell-shrug' || slug === 'barbell-shrug-behind-the-back') && j.wr && j.wf) {
    // A coherent shaft spans BOTH resolved grips in the side projection.
    // The wrists place the shared load in front or behind the pelvis.
    out.push(...layoutStraightGripBar(j.wr, j.wf, true, false));
  }
  if (slug === 'cable-shrugs' && j.wr && j.wf) {
    out.push({ kind: 'bone', x1: 84, y1: 88, x2: (j.wr[0] + j.wf[0]) / 2, y2: (j.wr[1] + j.wf[1]) / 2, w: 1.4, color: 'textMid', opacity: 1 });
    out.push(...layoutStraightGripBar(j.wr, j.wf, false, false));
  }
  if (PUSHDOWN_SLUGS.has(slug) && j.pe !== undefined) {
    const rope = slug === 'triceps-pushdown-rope-attachment';
    const push = pushdownGeometry(j.pe, body, rope);
    const centre: CanonicalPoint = rope ? push.junction.projected : [(j.wr[0] + j.wf[0]) / 2, (j.wr[1] + j.wf[1]) / 2];
    out.push({ kind: 'bone', x1: 84, y1: 10, x2: centre[0], y2: centre[1], w: 1.4, color: 'textMid', opacity: 1 });
    if (rope) {
      for (const point of [j.wf, j.wr]) {
        out.push({ kind: 'bone', x1: centre[0], y1: centre[1], x2: point[0], y2: point[1], w: 1.2, color: 'textMid', opacity: 1 });
        out.push({ kind: 'bone', x1: point[0], y1: point[1] - 2.5, x2: point[0], y2: point[1] + 2.5, w: 2.2, color: 'textHi', opacity: 1 });
        out.push({ kind: 'circle', cx: point[0], cy: point[1] + 2.5, r: 1.7, fill: 'textMid', opacity: 1 });
      }
    } else out.push(...layoutStraightGripBar(j.wr, j.wf, false, slug === 'reverse-grip-triceps-pushdown'));
  }
  if (slug === STRAIGHT_ARM_PULLDOWN && j.sa !== undefined) {
    const centre = straightArmPulldownGeometry(j.sa, body).junction.projected;
    out.push({ kind: 'bone', x1: 88, y1: 4, x2: centre[0], y2: centre[1], w: 1.4, color: 'textMid', opacity: 1 });
    for (const point of [j.wf, j.wr]) {
      out.push({ kind: 'bone', x1: centre[0], y1: centre[1], x2: point[0], y2: point[1], w: 1.2, color: 'textMid', opacity: 1 });
      out.push({ kind: 'bone', x1: point[0], y1: point[1] - 2.5, x2: point[0], y2: point[1] + 2.5, w: 2.2, color: 'textHi', opacity: 1 });
      out.push({ kind: 'circle', cx: point[0], cy: point[1] + 2.5, r: 1.7, fill: 'textMid', opacity: 1 });
    }
  }
  if (FLYE_INCLINES[slug] !== undefined && j.fo !== undefined) {
    const fly = flyeGeometry(j.fo, body, FLYE_INCLINES[slug]);
    out.push(...layoutFlyeDumbbell(fly, true));
  }
  if (slug === 'cable-rope-overhead-triceps-extension' && j.wr) {
    out.push({ kind: 'bone', x1: 14, y1: 62, x2: j.wr[0], y2: j.wr[1], w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'bone', x1: j.wr[0] - 3.2, y1: j.wr[1] - 0.8, x2: j.wr[0] + 0.4, y2: j.wr[1] + 1.6, w: 1.2, color: 'textMid', opacity: 1 });
    out.push({ kind: 'bone', x1: j.wr[0] + 3.2, y1: j.wr[1] - 0.8, x2: j.wr[0] - 0.4, y2: j.wr[1] + 1.6, w: 1.2, color: 'textMid', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
  }
  if (slug === 'cable-one-arm-tricep-extension' && j.wr) {
    out.push({ kind: 'bone', x1: 14, y1: 62, x2: j.wr[0], y2: j.wr[1], w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
  }
  if (slug === 'dumbbell-tricep-extension-pronated-grip' && j.wr) {
    // Entry 0181: the end-on dumbbell (the plate faces the viewer).
    out.push({ kind: 'rect', x: j.wr[0] - 6.6, y: j.wr[1] - 2.2, w: 4.2, h: 4.4, rx: 2, fill: 'textLow', opacity: 1 });
    out.push({ kind: 'rect', x: j.wr[0] + 2.4, y: j.wr[1] - 2.2, w: 4.2, h: 4.4, rx: 2, fill: 'textLow', opacity: 1 });
    out.push({ kind: 'bone', x1: j.wr[0] - 2.6, y1: j.wr[1], x2: j.wr[0] + 2.6, y2: j.wr[1], w: 2.2, color: 'textHi', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
  }
  if (slug === 'standing-dumbbell-triceps-extension' && j.wr) {
    // The bell lies across the forearm (the neutral read).
    out.push({ kind: 'rect', x: j.wr[0] - 3, y: j.wr[1] - 7.4, w: 6, h: 4.6, rx: 1.2, fill: 'textLow', opacity: 1 });
    out.push({ kind: 'rect', x: j.wr[0] - 3, y: j.wr[1] + 2.8, w: 6, h: 4.6, rx: 1.2, fill: 'textLow', opacity: 1 });
    out.push({ kind: 'bone', x1: j.wr[0], y1: j.wr[1] - 3, x2: j.wr[0], y2: j.wr[1] + 3, w: 2.2, color: 'textHi', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
  }
  if (slug === 'standing-overhead-barbell-triceps-extension' && j.wr) {
    // Entry 0181: the barbell end-on - the plate pairs ride the wrists.
    out.push({ kind: 'rect', x: j.wr[0] - 6.2, y: j.wr[1] - 2.2, w: 3.4, h: 4.4, rx: 1.2, fill: 'textLow', opacity: 1 });
    out.push({ kind: 'rect', x: j.wr[0] + 2.8, y: j.wr[1] - 2.2, w: 3.4, h: 4.4, rx: 1.2, fill: 'textLow', opacity: 1 });
    out.push({ kind: 'bone', x1: j.wr[0] - 3, y1: j.wr[1], x2: j.wr[0] + 3, y2: j.wr[1], w: 1.8, color: 'textHi', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
  }
  if (slug === 'rope-crunch' && j.wr) {
    // Family 26: the cable runs from the low pulley to the hands; the rope ends
    // ride the hands (the family-5 rope reading).
    out.push({ kind: 'bone', x1: 14, y1: 82, x2: j.wr[0], y2: j.wr[1], w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'bone', x1: j.wr[0] - 3.2, y1: j.wr[1] - 0.8, x2: j.wr[0] + 0.4, y2: j.wr[1] + 1.6, w: 1.2, color: 'textMid', opacity: 1 });
    out.push({ kind: 'bone', x1: j.wr[0] + 3.2, y1: j.wr[1] - 0.8, x2: j.wr[0] - 0.4, y2: j.wr[1] + 1.6, w: 1.2, color: 'textMid', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
  }
  if (slug === 'face-pull' && j.wr) {
    // Family 23: the cable runs from the pulley to the hands; the rope ends
    // split at the hands (the family-5 rope reading).
    out.push({ kind: 'bone', x1: 86, y1: 50, x2: j.wr[0], y2: j.wr[1], w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'bone', x1: j.wr[0] - 3.2, y1: j.wr[1] + 0.8, x2: j.wr[0] + 0.4, y2: j.wr[1] - 1.6, w: 1.2, color: 'textMid', opacity: 1 });
    out.push({ kind: 'bone', x1: j.wr[0] + 3.2, y1: j.wr[1] + 0.8, x2: j.wr[0] - 0.4, y2: j.wr[1] - 1.6, w: 1.2, color: 'textMid', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
  }
  if (slug === 'dumbbell-sumo-squat' && j.wr) {
    // Family 22: one dumbbell held at the midline between the legs, hanging
    // with the hands through the squat (the instructions' single dumbbell).
    out.push({ kind: 'rect', x: j.wr[0] - 2.3, y: j.wr[1] - 6.5, w: 4.6, h: 13, rx: 1.2, fill: 'textHi', opacity: 1 });
  }
  if (slug === 'chest-supported-dumbbell-row' && j.wr && j.wf) {
    // Family 20: a dumbbell in each hand hanging from the shoulders (the pair
    // rides the hands through the row; the far one at the far offset).
    out.push({ kind: 'rect', x: j.wr[0] - 2.3, y: j.wr[1] - 6.5, w: 4.6, h: 13, rx: 1.2, fill: 'textHi', opacity: 1 });
    out.push({ kind: 'rect', x: j.wf[0] - 2.3, y: j.wf[1] - 6.5, w: 4.6, h: 13, rx: 1.2, fill: 'textHi', opacity: 1 });
  }
  if (slug === 'dumbbell-seated-one-leg-calf-raise' && j.wr) {
    // Family 18: one dumbbell in the working hand, resting on the working
    // thigh near the knee (it rides the hand through the range).
    out.push({ kind: 'rect', x: j.wr[0] - 2.3, y: j.wr[1] - 6.5, w: 4.6, h: 13, rx: 1.2, fill: 'textHi', opacity: 1 });
  }
  if ((slug === 'cable-internal-rotation' || slug === 'external-rotation-with-cable') && j.wr) {
    // Family 7: the cable runs from the handle to the elbow-height pulley.
    out.push({ kind: 'bone', x1: j.wr[0], y1: j.wr[1], x2: 86, y2: 40.5, w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
  }
  if (slug === 'alternating-cable-shoulder-press' && j.b) {
    // Family 8: the cable runs from the working hand to the low pulley and
    // the handle rides the hand.
    out.push({ kind: 'bone', x1: j.b[0], y1: j.b[1], x2: 86, y2: 92.8, w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'circle', cx: j.b[0], cy: j.b[1], r: 2.6, fill: 'textHi', opacity: 1 });
  }
  if (slug === 'romanian-deadlift' && j.b) {
    out.push({ kind: 'circle', cx: j.b[0], cy: j.b[1], r: 6.6, fill: 'textHi', opacity: 1 });
    out.push({ kind: 'circle', cx: j.b[0], cy: j.b[1], r: 2.2, fill: 'ink1', opacity: 1 });
  }
  if (slug === 'lat-pulldown' && !front && j.wr && j.wf) {
    // Entry 0183: side-on, so the bar is seen END-ON at the hands - a collar
    // and a hub, on the axis midway between them - and the cable runs from the
    // pulley straight down to it. The front-view shaft across the hands would
    // run across the face from a side elevation. The three grip variants keep
    // the front-view branch below.
    const mx = (j.wr[0] + j.wf[0]) / 2;
    const my = (j.wr[1] + j.wf[1]) / 2;
    out.push({ kind: 'bone', x1: 50, y1: 8, x2: mx, y2: my, w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'circle', cx: mx, cy: my, r: 3.2, fill: 'textHi', opacity: 1 });
    out.push({ kind: 'circle', cx: mx, cy: my, r: 1.2, fill: 'ink1', opacity: 1 });
  } else if (PULLDOWN_SLUGS.has(slug) && j.wr && j.wf) {
    const mx = (j.wr[0] + j.wf[0]) / 2;
    const my = (j.wr[1] + j.wf[1]) / 2;
    out.push({ kind: 'bone', x1: mx, y1: my, x2: 50, y2: 8, w: 1.4, color: 'textMid', opacity: 1 });
    // The bar descends PAST the face: it draws behind the head ring (the
    // figure's head passes in front of the bar plane on the way down).
    if (slug === 'lat-pulldown') {
      // Base 21's own bar, byte-locked with its evidence.
      out.push({ kind: 'bone', x1: j.wf[0] - 5, y1: j.wf[1] - 1, x2: j.wr[0] + 5, y2: j.wr[1] - 1, w: PULLDOWN_BAR_W, color: 'textHi', opacity: 1, beforeHead: true });
    } else {
      // A variant's bar (B1-300) runs PAST both hands, so the hands read as
      // gripping it, and its rounded ends stay inside the gantry posts.
      const left = j.wr[0] <= j.wf[0] ? j.wr : j.wf;
      const right = left === j.wr ? j.wf : j.wr;
      const inset = PULLDOWN_POST_W / 2 + PULLDOWN_BAR_W / 2 + 0.5;
      const x1 = Math.max(PULLDOWN_POST_X.left + inset, left[0] - PULLDOWN_BAR_OVERHANG);
      const x2 = Math.min(PULLDOWN_POST_X.right - inset, right[0] + PULLDOWN_BAR_OVERHANG);
      out.push({ kind: 'bone', x1, y1: left[1] - 1, x2, y2: right[1] - 1, w: PULLDOWN_BAR_W, color: 'textHi', opacity: 1, beforeHead: true });
    }
    if (slug === 'underhand-cable-pulldowns') {
      // Underhand (supinated) grip, drawn so it READS at app240. The previous
      // cue was three 1.1-wide, 1.7-tall strokes per hand: about 3 stage px on
      // the sheet, which the owner could not see ("the palms-up detail can't
      // be seen"). A supinated grip is drawn the way it reads - the hand wraps
      // UP over the bar and the thumb sits in front of it - so the bar carries
      // a raised knuckle line and a thumb stub at each hand, both an order of
      // magnitude larger than the old strokes. The elbows also drive DOWN in
      // front of the body on this movement (its own cue), so the wrap is
      // drawn at the hand the bar actually passes.
      const wrap = (x: number, y: number, color: ColorRole, op: number): void => {
        // The knuckle line the fingers wrap over: a bar-length segment riding
        // just above the bar, so both hands read as palms-up.
        out.push({ kind: 'bone', x1: x - 3.4, y1: y - 3.1, x2: x + 3.4, y2: y - 3.1,
          w: 2.2, color, opacity: op });
        // The thumb in front of the bar, at the near end of the grip.
        out.push({ kind: 'bone', x1: x - 2.6, y1: y - 3.1, x2: x - 2.6, y2: y + 0.6,
          w: 2.2, color, opacity: op });
      };
      wrap(j.wr[0], j.wr[1], 'textHi', 1);
      wrap(j.wf[0], j.wf[1], farColor, farOpacity);
    }
  } else if (slug === 'one-arm-lat-pulldown' && j.wr) {
    // One handle on a high cable: the line runs from the working wrist to the
    // pulley on the gantry, and a dot marks the grip. The pulley is over the
    // WORKING side, not the centreline, so the cable never crosses the face.
    out.push({ kind: 'bone', x1: j.wr[0], y1: j.wr[1], x2: ONE_ARM_PULLEY[0], y2: ONE_ARM_PULLEY[1], w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
  } else if (slug === 'band-good-morning' && j.nk && j.an && j.kn && j.wr) {
    // Band good morning: the band runs from under the mid-foot, behind the
    // knee, up the back to the shoulders, over the trap (clear of the neck)
    // and into the hands at the front. It lengthens through the drive.
    const th = Math.atan2(j.nk[0] - j.hp[0], j.hp[1] - j.nk[1]);
    const cos = Math.cos(th), sin = Math.sin(th);
    const foot: CanonicalPoint = [j.an[0] + 1.2, j.an[1] - 0.6];
    const kneeBack: CanonicalPoint = [j.kn[0] - 1.6, j.kn[1] + 1.0];
    const back: CanonicalPoint = [j.nk[0] - 4.6 * cos, j.nk[1] - 4.6 * sin];
    const over: CanonicalPoint = [j.nk[0] - 1.6 * cos - 2.4 * sin, j.nk[1] + 1.6 * sin - 2.4 * cos];
    const bands: Array<[CanonicalPoint, CanonicalPoint]> = [
      [foot, kneeBack], [kneeBack, back], [back, over], [over, [j.wr[0], j.wr[1] + 0.6]],
    ];
    for (const [a, z] of bands) {
      out.push({ kind: 'bone', x1: a[0], y1: a[1], x2: z[0], y2: z[1], w: 1.3, color: 'textMid', opacity: 1 });
    }
  } else if (slug === 'cable-crunch' && j.wr) {
    out.push({ kind: 'bone', x1: j.wr[0], y1: j.wr[1], x2: 26, y2: 9, w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
  } else if (slug === 'cable-wrist-curl' && j.wr) {
    // Family 10 base: a low cable at bench height. The handle rides the
    // working hand and the cable runs back to its pulley behind the athlete,
    // so the "Cable" in the name is on the sheet.
    out.push({ kind: 'bone', x1: j.wr[0], y1: j.wr[1], x2: 78, y2: 34, w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'bone', x1: j.wr[0] - 2.4, y1: j.wr[1] + 1.2, x2: j.wr[0] + 2.4, y2: j.wr[1] + 1.2,
      w: 2.6, color: 'textHi', opacity: 1 });
  } else if (slug === 'seated-cable-shoulder-press' && j.wr) {
    // Family 11 base: a cable from the handle back to its low pulley beside
    // the seat, so the press reads as cable-driven and not as a free weight.
    out.push({ kind: 'bone', x1: j.wr[0], y1: j.wr[1], x2: 80, y2: 30, w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'bone', x1: j.wr[0] - 2.4, y1: j.wr[1] + 1.2, x2: j.wr[0] + 2.4, y2: j.wr[1] + 1.2,
      w: 2.6, color: 'textHi', opacity: 1 });
  } else if (slug === 'seated-dumbbell-press' && j.wr) {
    // Family 11 variant: a bell in the working hand, drawn along the forearm
    // so it reads as a dumbbell at the lockout.
    out.push({ kind: 'rect', x: j.wr[0] - 2.6, y: j.wr[1] - 7.0, w: 5.2, h: 14, rx: 2.0, fill: 'textHi', opacity: 1 });
  } else if (slug === 'seated-dumbbell-palms-down-wrist-curl' && j.wr) {
    // Family 12 base: the bell hangs below the hand, as it does pronated.
    out.push({ kind: 'rect', x: j.wr[0] - 2.2, y: j.wr[1] - 1.0, w: 4.4, h: 7.5, rx: 1.8, fill: 'textHi', opacity: 1 });
  } else if (slug === 'seated-dumbbell-palms-up-wrist-curl' && j.wr) {
    // Family 12 variant: the bell sits across the palm, above the hand, as it
    // does supinated - so the load is on the other side of the hand and the
    // two read as different movements rather than one relabelled.
    out.push({ kind: 'bone', x1: j.wr[0] - 5.2, y1: j.wr[1] - 3.0, x2: j.wr[0] + 5.2, y2: j.wr[1] - 3.0,
      w: 2.2, color: 'textHi', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0] - 5.2, cy: j.wr[1] - 3.0, r: 2.8, fill: 'textHi', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0] + 5.2, cy: j.wr[1] - 3.0, r: 2.8, fill: 'textHi', opacity: 1 });
  } else if (CURL_SLUGS.has(slug) && j.wr && j.wf) {
    // Family 13: a barbell held across both hands. The shaft runs past both
    // grips with a plate at each end, so the hands read as gripping it. The
    // author lifts the middle by `bt` at the peak of a supinated curl: the inner
    // ends then sit higher than the plates, mirrored about the middle, which is
    // what the pinky-to-ear rotation looks like from the front. An overhand grip
    // draws a knuckle line at each hand instead of a grip ring.
    const near = j.wr[0] <= j.wf[0] ? j.wr : j.wf;
    const far = near === j.wr ? j.wf : j.wr;
    const mx = (near[0] + far[0]) / 2;
    const my = (near[1] + far[1]) / 2 - (j.bt ?? 0);
    const outX = 7.0;
    const endNear: CanonicalPoint = [near[0] - outX, near[1] + (j.bt ?? 0)];
    const endFar: CanonicalPoint = [far[0] + outX, far[1] + (j.bt ?? 0)];
    out.push({ kind: 'bone', x1: endNear[0], y1: endNear[1], x2: mx, y2: my, w: 2.2, color: 'textHi', opacity: 1 });
    out.push({ kind: 'bone', x1: mx, y1: my, x2: endFar[0], y2: endFar[1], w: 2.2, color: 'textHi', opacity: 1 });
    out.push({ kind: 'circle', cx: endNear[0], cy: endNear[1], r: 4.2, fill: 'textHi', opacity: 1 });
    out.push({ kind: 'circle', cx: endFar[0], cy: endFar[1], r: 4.2, fill: 'textHi', opacity: 1 });
    for (const [hand, color, op] of [[near, 'textHi', 1], [far, farColor, farOpacity]] as const) {
      if (PRONATED_SLUGS.has(slug)) {
        out.push({ kind: 'bone', x1: hand[0] - 2.4, y1: hand[1], x2: hand[0] + 2.4, y2: hand[1],
          w: 1.6, color: 'ink1', opacity: op });
      } else {
        out.push({ kind: 'circle', cx: hand[0], cy: hand[1], r: 2.4, fill: 'ink1', opacity: op });
      }
    }
  } else if (PRONATED_SLUGS.has(slug) && j.wr) {
    // Family 13: the reverse cable curl has no bar, so the overhand grip is the
    // knuckle line at each hand on its own.
    out.push({ kind: 'bone', x1: j.wr[0] - 2.4, y1: j.wr[1], x2: j.wr[0] + 2.4, y2: j.wr[1],
      w: 1.6, color: 'ink1', opacity: 1 });
    out.push({ kind: 'bone', x1: j.wf[0] - 2.4, y1: j.wf[1], x2: j.wf[0] + 2.4, y2: j.wf[1],
      w: 1.6, color: 'ink1', opacity: farOpacity });
  } else if (slug === 'finger-curls' && j.wr) {
    // Family 10 variant: a barbell held ACROSS the fingers, so it is drawn
    // across the hand rather than continuing the forearm line - that is the
    // whole difference from the base, and the family needs them to read as
    // two movements rather than one relabelled.
    out.push({ kind: 'bone', x1: j.wr[0] - 7.0, y1: j.wr[1] + 1.0, x2: j.wr[0] + 7.0, y2: j.wr[1] + 1.0,
      w: 2.4, color: 'textHi', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0] - 7.0, cy: j.wr[1] + 1.0, r: 3.0, fill: 'textHi', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0] + 7.0, cy: j.wr[1] + 1.0, r: 3.0, fill: 'textHi', opacity: 1 });
  }
  return out;
}
