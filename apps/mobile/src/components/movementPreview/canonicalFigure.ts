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
  /** Standing lateral raise: shoulder abduction in degrees from the arm hanging straight down. */
  la?: number;
  /** Standing front raise: shoulder flexion of the working arm(s) in degrees from hanging straight down. */
  fr?: number;
  /** Chest-supported incline raise phase, from 0 (arms hanging) to 1 (elbows at shoulder height). */
  pi?: number;
  /** Chain movement phase: 0 is the movement's first pose, 1 its second, and so on. */
  ph?: number;
  /** Chain movement turn: degrees the shoulders are turned about the spine, on top of the pose's own twist. */
  tw?: number;
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
    if (key === 'bt' || key === 'ct' || key === 'se' || key === 'ca' || key === 'ra' || key === 'pe' || key === 'sa' || key === 'fo' || key === 'ke' || key === 'rl' || key === 'ir' || key === 'tp' || key === 'la' || key === 'fr' || key === 'pi' || key === 'ph' || key === 'tw') {
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
/**
 * Standing lateral raises, front view. Each slug holds one fixed soft elbow
 * bend for the whole rep: the forearm is that many degrees less abducted than
 * the upper arm, which is what keeps the hand below the elbow at the top.
 */
export const LATERAL_RAISE_ELBOW_DEG: Readonly<Record<string, number>> = {
  'dumbbell-lateral-raise': 15,
  'lateral-raise-with-bands': 10,
  'seated-side-lateral-raise': 12,
};
/** The one seated lateral raise drawn so far; it has its own 3D figure. */
export const SEATED_LATERAL_RAISE = 'seated-side-lateral-raise';
/**
 * Standing front raises, side view. The soft elbow is the slight bend the text
 * asks for; bothArms is false where one arm works and the other hangs.
 */
export const FRONT_RAISE: Readonly<Record<string, { softElbowDeg: number; bothArms: boolean }>> = {
  'dumbbell-front-raise': { softElbowDeg: 10, bothArms: true },
  'front-cable-raise': { softElbowDeg: 8, bothArms: false },
};
/** Where a free arm hangs while the other one works, in degrees of flexion. */
export const FRONT_RAISE_FREE_ARM_DEG = 3;
/** The low pulley behind the athlete in the Front Cable Raise. */
export const FRONT_CABLE_RAISE_PULLEY: CanonicalPoint = [14, 91];
/** Side-view arm bone lengths (the same 12.5 / 12.0 the other side-view solved arms use). */
const SAGITTAL_UPPER_ARM = 12.5;
const SAGITTAL_FOREARM = 12.0;
/** Front-view arm bone lengths (the same 13.26 / 11.2 the keyed front-view arms use). */
const RAISE_UPPER_ARM = 13.26;
const RAISE_FOREARM = 11.2;
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

/**
 * Both arms of a standing lateral raise, drawn from the shoulder roots. The
 * arms abduct in the frontal plane and mirror about the midline; nothing else
 * on the figure moves. Exact on every tick, so the arc never cuts a chord.
 */
export function lateralRaiseArms(
  abductionDeg: number, elbowBendDeg: number, nearShoulder: CanonicalPoint, farShoulder: CanonicalPoint,
): { near: { el: CanonicalPoint; wr: CanonicalPoint }; far: { el: CanonicalPoint; wr: CanonicalPoint } } {
  const upper = abductionDeg * Math.PI / 180;
  const fore = (abductionDeg - elbowBendDeg) * Math.PI / 180;
  const arm = (shoulder: CanonicalPoint, outward: number): { el: CanonicalPoint; wr: CanonicalPoint } => {
    const el: CanonicalPoint = [
      shoulder[0] + outward * RAISE_UPPER_ARM * Math.sin(upper), shoulder[1] + RAISE_UPPER_ARM * Math.cos(upper),
    ];
    const wr: CanonicalPoint = [
      el[0] + outward * RAISE_FOREARM * Math.sin(fore), el[1] + RAISE_FOREARM * Math.cos(fore),
    ];
    return { el, wr };
  };
  const nearOutward = nearShoulder[0] <= farShoulder[0] ? -1 : 1;
  return { near: arm(nearShoulder, nearOutward), far: arm(farShoulder, -nearOutward) };
}

/**
 * One arm of a standing front raise, seen from the side, from its shoulder
 * root. The arm flexes forward in the sagittal plane. A soft elbow bends in the
 * arm's own plane: with the arm hanging it shows as the forearm sitting a little
 * forward of the upper arm, and it turns out of view as the arm comes level
 * (palms down, the elbow then points out to the side), so the visible bend
 * fades with the cosine of the flexion angle.
 */
export function frontRaiseArm(
  flexionDeg: number, softElbowDeg: number, shoulder: CanonicalPoint,
): { el: CanonicalPoint; wr: CanonicalPoint } {
  const upper = flexionDeg * Math.PI / 180;
  const fore = (flexionDeg + softElbowDeg * Math.cos(upper)) * Math.PI / 180;
  const el: CanonicalPoint = [
    shoulder[0] + SAGITTAL_UPPER_ARM * Math.sin(upper), shoulder[1] + SAGITTAL_UPPER_ARM * Math.cos(upper),
  ];
  const wr: CanonicalPoint = [
    el[0] + SAGITTAL_FOREARM * Math.sin(fore), el[1] + SAGITTAL_FOREARM * Math.cos(fore),
  ];
  return { el, wr };
}

/**
 * Chest-supported incline shoulder raises (owner correction, 2026-10-07): the
 * athlete lies chest-down on a 45 degree incline pad with the feet wide on the
 * floor, and the arms raise with the elbows leading.
 */
export const PRONE_INCLINE_RAISE_SLUGS: ReadonlySet<string> = new Set([
  'barbell-incline-shoulder-raise', 'dumbbell-incline-shoulder-raise',
]);
/** Everything the owner fixed, in one place, so the tests read the same numbers. */
export const PRONE_INCLINE_RAISE = {
  inclineDeg: 45,
  yawDeg: 40,
  /**
   * Dumbbells: the angle at the elbow, between upper arm and forearm, at the
   * start and at the top. It opens steadily through the raise, so the forearm
   * finishes almost parallel with the floor.
   */
  dumbbellElbowAngleDeg: [105, 172] as const,
  /** Dumbbells: the upper arm's abduction from hanging at the start and the top. */
  dumbbellAbductionDeg: [20, 90] as const,
  /**
   * Barbell: half the grip width. The first draft held 24; the owner brought
   * each hand in by one wrist width (the drawn forearm is 3.5 wide).
   */
  barbellGripHalfWidth: 20.5,
  /** Barbell: the elbow angle at the start (long arms) and at the top. */
  barbellElbowAngleDeg: [170, 104] as const,
  /** Where the pad runs along the trunk, as fractions from hip (0) to neck (1). */
  padSpan: [-0.25, 0.55] as const,
  /** Each ankle's distance out from the midline; wider than the hips. */
  stanceHalfWidth: 15,
} as const;

/**
 * The whole figure for a chest-supported incline raise, from a 3D model. World
 * axes: X forward along the floor, Y up, Z across the body (positive toward
 * the viewer). The trunk lies along the incline with the chest facing the pad;
 * the legs reach back to feet planted wide; nothing but the arms moves. With
 * dumbbells each upper arm swings out across the body from hanging to level
 * with the shoulder, the elbow leading, and the arm straightens gradually so
 * the forearm finishes almost parallel with the floor. With a bar, which holds
 * the hands at one width, it works like an upright row: the bar rises under
 * the shoulders and the elbows flare out and up. (Owner's corrections,
 * 2026-10-07.) World joints are returned beside the projection
 * so a test can measure real lengths and angles, not foreshortened ones.
 */
export function proneInclineRaiseGeometry(phase: number, body: BodyParameters, barbell: boolean) {
  type Point3 = readonly [number, number, number];
  const spec = PRONE_INCLINE_RAISE;
  const rad = (d: number): number => d * Math.PI / 180;
  const incline = rad(spec.inclineDeg), yaw = rad(spec.yawDeg);
  const trunk: Point3 = [Math.cos(incline), Math.sin(incline), 0];
  const anterior: Point3 = [Math.sin(incline), -Math.cos(incline), 0];
  const HIP_SCREEN: CanonicalPoint = [46, 56];
  const project = (q: Point3): CanonicalPoint =>
    [HIP_SCREEN[0] + q[0] * Math.cos(yaw) - q[2] * Math.sin(yaw), HIP_SCREEN[1] - q[1]];
  const along = (t: number, lift = 0): Point3 =>
    [24 * t * trunk[0] + lift * anterior[0], 24 * t * trunk[1] + lift * anterior[1], 0];
  const hip: Point3 = [0, 0, 0];
  const neck = along(1);
  const head: Point3 = [neck[0] + 9 * trunk[0], neck[1] + 9 * trunk[1], 0];
  const shoulderZ = body.sw * 0.92;
  const UPPER = 12.5, FORE = 12.0;

  const arm = (side: number) => {
    const shoulder: Point3 = [neck[0], neck[1], side * shoulderZ];
    let elbow: Point3;
    let wrist: Point3;
    if (barbell) {
      // Both hands are fixed on one bar, so this one works like an upright
      // row: the bar rises straight up under the shoulders while the elbow is
      // solved and flares out and up, leading the bar.
      const [open, closed] = spec.barbellElbowAngleDeg;
      const reachAt = (angleDeg: number): number =>
        Math.sqrt(UPPER * UPPER + FORE * FORE - 2 * UPPER * FORE * Math.cos(rad(angleDeg)));
      const span = spec.barbellGripHalfWidth - shoulderZ;
      const dropAt = (angleDeg: number): number => Math.sqrt(reachAt(angleDeg) ** 2 - span ** 2);
      const drop = dropAt(open) + (dropAt(closed) - dropAt(open)) * phase;
      wrist = [shoulder[0], shoulder[1] - drop, side * spec.barbellGripHalfWidth];
      const reach = Math.hypot(span, drop);
      const a = (UPPER * UPPER - FORE * FORE + reach * reach) / (2 * reach);
      const h = Math.sqrt(Math.max(0, UPPER * UPPER - a * a));
      // In the (across, up) plane: from the shoulder toward the hand, then out and up.
      const u = [span / reach, -drop / reach];
      const across = shoulderZ + u[0] * a + (-u[1]) * h;
      const up = shoulder[1] + u[1] * a + u[0] * h;
      elbow = [shoulder[0], up, side * across];
    } else {
      // The upper arm swings out across the body to shoulder height. The
      // forearm trails it: by a lot at the start, where the bells hang
      // together under the chest, and by less and less as the arm rises, so
      // the elbow leads and the arm straightens gradually toward the top.
      const [from, to] = spec.dumbbellAbductionDeg;
      const [angleFrom, angleTo] = spec.dumbbellElbowAngleDeg;
      const upper = rad(from + (to - from) * phase);
      const fore = upper - rad(180 - (angleFrom + (angleTo - angleFrom) * phase));
      elbow = [shoulder[0], shoulder[1] - UPPER * Math.cos(upper), shoulder[2] + side * UPPER * Math.sin(upper)];
      wrist = [elbow[0], elbow[1] - FORE * Math.cos(fore), elbow[2] + side * FORE * Math.sin(fore)];
    }
    return { world: { shoulder, elbow, wrist }, projected: { shoulder: project(shoulder), elbow: project(elbow), wrist: project(wrist) } };
  };
  const near = arm(1), far = arm(-1);

  // Feet planted wide behind the hips; the knee is solved, bending forward.
  const ankleHeight = -(96.9 - body.lw * 0.9 / 2 - HIP_SCREEN[1]);
  const leg = (side: number) => {
    const root: Point3 = [0, 0, side * body.hw * 0.8];
    const ankle: Point3 = [-15, ankleHeight, side * spec.stanceHalfWidth];
    const d: Point3 = [ankle[0] - root[0], ankle[1] - root[1], ankle[2] - root[2]];
    const length = Math.hypot(d[0], d[1], d[2]);
    const u: Point3 = [d[0] / length, d[1] / length, d[2] / length];
    const dot = u[0];
    const forward: Point3 = [1 - dot * u[0], -dot * u[1], -dot * u[2]];
    const fl = Math.hypot(forward[0], forward[1], forward[2]);
    const bend = Math.sqrt(Math.max(0, 22.25 * 22.25 - (length / 2) ** 2));
    const knee: Point3 = [
      root[0] + d[0] / 2 + forward[0] / fl * bend,
      root[1] + d[1] / 2 + forward[1] / fl * bend,
      root[2] + d[2] / 2 + forward[2] / fl * bend,
    ];
    return { world: { root, knee, ankle }, projected: { root: project(root), knee: project(knee), ankle: project(ankle) } };
  };
  const nearLeg = leg(1), farLeg = leg(-1);

  // The pad lies against the chest, parallel to the trunk, and stops short of
  // the shoulders so the arms and the implement clear its top end. It is laid
  // out against the DRAWN trunk: the trunk is painted at its side-profile
  // width about the projected spine, so a pad offset in world space would sit
  // partly under that silhouette in a turned view.
  const hp = project(hip), nk = project(neck);
  const drawnLength = Math.hypot(nk[0] - hp[0], nk[1] - hp[1]);
  const alongScreen: CanonicalPoint = [(nk[0] - hp[0]) / drawnLength, (nk[1] - hp[1]) / drawnLength];
  // The chest side of the drawn trunk: forward and down on screen.
  const chestSide: CanonicalPoint = [-alongScreen[1], alongScreen[0]];
  const trunkHalf = body.sw * 0.58;
  const padHalf = 2;
  const padLift = trunkHalf + padHalf + 0.8;
  const padAt = (t: number, lift: number): CanonicalPoint => [
    hp[0] + alongScreen[0] * drawnLength * t + chestSide[0] * lift,
    hp[1] + alongScreen[1] * drawnLength * t + chestSide[1] * lift,
  ];
  const pad: readonly [CanonicalPoint, CanonicalPoint] = [padAt(spec.padSpan[0], padLift), padAt(spec.padSpan[1], padLift)];
  const padMid = padAt((spec.padSpan[0] + spec.padSpan[1]) / 2, padLift + padHalf);
  const floorScreen = 96.4;
  const post: readonly [CanonicalPoint, CanonicalPoint] = [padMid, [padMid[0], floorScreen]];
  const base: readonly [CanonicalPoint, CanonicalPoint] = [[padMid[0] - 9, floorScreen], [padMid[0] + 11, floorScreen]];

  const joints: FigureJoints = {
    hd: project(head), nk, hp,
    waist: [nk[0] + (hp[0] - nk[0]) * 0.56, nk[1] + (hp[1] - nk[1]) * 0.56],
    nArm: near.projected.shoulder, fArm: far.projected.shoulder,
    el: near.projected.elbow, wr: near.projected.wrist, ef: far.projected.elbow, wf: far.projected.wrist,
    nLeg: nearLeg.projected.root, fLeg: farLeg.projected.root,
    kn: nearLeg.projected.knee, an: nearLeg.projected.ankle, kf: farLeg.projected.knee, af: farLeg.projected.ankle,
  };
  return {
    near, far, nearLeg, farLeg, joints, pad, post, base, padHalf, project,
    world: { hip, neck, head, trunk, anterior },
    chestSide,
    inclineDeg: spec.inclineDeg, yawDeg: spec.yawDeg,
  };
}

/**
 * The whole figure for the Seated Side Lateral Raise, from a 3D model. World
 * axes: X forward (the way the athlete faces), Y up from the floor, Z across
 * the body (positive toward the viewer). The athlete sits on the END of a flat
 * bench: trunk upright, thighs level and pointing forward, shins down to feet
 * flat on the floor, the bench running away behind. Only the arms move, out to
 * the sides in the plane across the body, with one slight fixed elbow bend.
 * A 35 degree oblique projection shows the seat and both arms at once.
 */
export function seatedLateralRaiseGeometry(abductionDeg: number, body: BodyParameters) {
  type Point3 = readonly [number, number, number];
  const rad = (d: number): number => d * Math.PI / 180;
  const yaw = rad(35);
  const HIP_SCREEN_X = 44;
  const FLOOR_SCREEN = 96.9;
  const project = (q: Point3): CanonicalPoint =>
    [HIP_SCREEN_X + q[0] * Math.cos(yaw) - q[2] * Math.sin(yaw), FLOOR_SCREEN - q[1]];
  const ankleY = body.lw * 0.9 / 2;
  const SHIN = 22.25, THIGH = 22.25, UPPER = 12.5, FORE = 12.0;
  const hipY = ankleY + SHIN;
  const hip: Point3 = [0, hipY, 0];
  const neck: Point3 = [0, hipY + 24, 0];
  const head: Point3 = [0, hipY + 33, 0];
  const shoulderZ = body.sw * 0.92;
  const upper = rad(abductionDeg);
  const fore = rad(abductionDeg - LATERAL_RAISE_ELBOW_DEG[SEATED_LATERAL_RAISE]);
  const arm = (side: number) => {
    const shoulder: Point3 = [0, neck[1], side * shoulderZ];
    const elbow: Point3 = [0, shoulder[1] - UPPER * Math.cos(upper), shoulder[2] + side * UPPER * Math.sin(upper)];
    const wrist: Point3 = [0, elbow[1] - FORE * Math.cos(fore), elbow[2] + side * FORE * Math.sin(fore)];
    return { world: { shoulder, elbow, wrist }, projected: { shoulder: project(shoulder), elbow: project(elbow), wrist: project(wrist) } };
  };
  const near = arm(1), far = arm(-1);
  // Thighs level and forward, a little apart; shins straight down; feet flat.
  const leg = (side: number) => {
    const root: Point3 = [0, hipY, side * body.hw * 0.8];
    const kneeZ = side * (body.hw * 0.8 + 2.2);
    const kneeX = Math.sqrt(THIGH * THIGH - 2.2 * 2.2);
    const knee: Point3 = [kneeX, hipY, kneeZ];
    const ankle: Point3 = [kneeX, ankleY, kneeZ];
    // The foot lies flat, pointing forward from the ankle, at the ankle's height.
    const toe: Point3 = [kneeX + 5.4, ankleY, kneeZ];
    return {
      world: { root, knee, ankle, toe },
      projected: { root: project(root), knee: project(knee), ankle: project(ankle), toe: project(toe) },
    };
  };
  const nearLeg = leg(1), farLeg = leg(-1);
  // The bench top is under the thighs; the athlete is at its front end.
  const seatY = hipY - body.lw * 1.18 / 2 - 2;
  const slab: readonly [CanonicalPoint, CanonicalPoint] = [project([-30, seatY, 0]), project([5, seatY, 0])];
  const posts: ReadonlyArray<readonly [CanonicalPoint, CanonicalPoint]> = [-25, 0].map((x) =>
    [project([x, seatY - 2, 0]), project([x, FLOOR_SCREEN - 96.4, 0])] as const);
  const hp = project(hip), nk = project(neck);
  const joints: FigureJoints = {
    hd: project(head), nk, hp,
    waist: [nk[0] + (hp[0] - nk[0]) * 0.56, nk[1] + (hp[1] - nk[1]) * 0.56],
    nArm: near.projected.shoulder, fArm: far.projected.shoulder,
    el: near.projected.elbow, wr: near.projected.wrist, ef: far.projected.elbow, wf: far.projected.wrist,
    nLeg: nearLeg.projected.root, fLeg: farLeg.projected.root,
    kn: nearLeg.projected.knee, an: nearLeg.projected.ankle, kf: farLeg.projected.knee, af: farLeg.projected.ankle,
  };
  // The ankle sits half a foot-thickness above the floor, so a level foot of
  // this width has its sole exactly on it.
  const footWidth = body.lw * 0.9;
  return { near, far, nearLeg, farLeg, joints, slab, posts, project, seatY, footWidth, world: { hip, neck, head }, yawDeg: 35 };
}

/** A dumbbell in each fist with its handle pointing forward, drawn through the figure's own projection. */
function layoutProjectedBells(
  figure: {
    near: { world: { wrist: readonly [number, number, number] } };
    far: { world: { wrist: readonly [number, number, number] } };
    project: (q: readonly [number, number, number]) => CanonicalPoint;
  },
): { far: FigurePrim[]; near: FigurePrim[] } {
  const far: FigurePrim[] = [];
  const near: FigurePrim[] = [];
  const bell = (wrist: readonly [number, number, number], color: ColorRole, opacity: number, out: FigurePrim[]): void => {
    const a = figure.project([wrist[0] - 4.2, wrist[1], wrist[2]]);
    const b = figure.project([wrist[0] + 4.2, wrist[1], wrist[2]]);
    out.push({ kind: 'bone', x1: a[0], y1: a[1], x2: b[0], y2: b[1], w: 1.8, color, opacity });
    for (const head of [a, b]) {
      out.push({ kind: 'bone', x1: head[0], y1: head[1] - 2.2, x2: head[0], y2: head[1] + 2.2, w: 2.6, color, opacity, stroke: 'ink1', strokeWidth: 0.6 });
    }
  };
  bell(figure.far.world.wrist, 'textLow', 0.9, far);
  bell(figure.near.world.wrist, 'textHi', 1, near);
  return { far, near };
}

/** The implement of a chest-supported incline raise, split so the far half sits behind the body. */
function layoutProneInclineImplement(
  raise: ReturnType<typeof proneInclineRaiseGeometry>, barbell: boolean,
): { far: FigurePrim[]; near: FigurePrim[] } {
  const far: FigurePrim[] = [];
  const near: FigurePrim[] = [];
  if (barbell) {
    // One straight bar through both hands, with a plate outside each hand.
    const y = raise.near.world.wrist[1], x = raise.near.world.wrist[0];
    const grip = PRONE_INCLINE_RAISE.barbellGripHalfWidth;
    // The bar is level and square across the body wherever the hands carry it.
    const end = (z: number): CanonicalPoint => raise.project([x, y, z]);
    const nearEnd = end(grip + 7), farEnd = end(-grip - 7), middle = end(0);
    far.push({ kind: 'bone', x1: middle[0], y1: middle[1], x2: farEnd[0], y2: farEnd[1], w: 1.6, color: 'textLow', opacity: 0.9 });
    const farPlate = end(-grip - 5);
    far.push({ kind: 'bone', x1: farPlate[0], y1: farPlate[1] - 4.2, x2: farPlate[0], y2: farPlate[1] + 4.2, w: 2.4, color: 'textLow', opacity: 0.9 });
    near.push({ kind: 'bone', x1: middle[0], y1: middle[1], x2: nearEnd[0], y2: nearEnd[1], w: 1.6, color: 'textHi', opacity: 1 });
    const nearPlate = end(grip + 5);
    near.push({ kind: 'bone', x1: nearPlate[0], y1: nearPlate[1] - 4.2, x2: nearPlate[0], y2: nearPlate[1] + 4.2, w: 2.4, color: 'textHi', opacity: 1, stroke: 'ink1', strokeWidth: 0.6 });
  } else {
    // A bell in each fist, its handle pointing forward, so it reads as a short
    // bar with a head at each end.
    return layoutProjectedBells(raise);
  }
  return { far, near };
}

// ---------------------------------------------------------------------------
// Chain movements: figures posed by the DIRECTION of each body segment.
//
// The figure is a 3D model. World axes: X forward (the way the athlete faces),
// Y up from the floor, Z across the body (positive toward the viewer). A
// direction is a sagittal angle in degrees (0 forward, 90 straight up, 180
// back, -90 straight down), optionally with an "out" angle away from the
// body's midline (90 is straight out to that limb's own side). A movement is a
// short list of poses; one number per keyframe (`ph`) says where between them
// the figure is, and every direction is blended, so each segment swings on its
// true arc at its true length on every tick. One joint, the root, is placed
// directly; everything else follows from it.
// ---------------------------------------------------------------------------

/** A segment direction: a sagittal angle in degrees, or [sagittal, out]. */
export type ChainDir = number | readonly [number, number];
type ChainVec = readonly [number, number, number];
/** A fixed point: [forward, height above the floor] on the midline, or with a third across-body coordinate. */
export type ChainPoint = readonly [number, number] | readonly [number, number, number];

/** One pose of a chain movement. */
export interface ChainPose {
  /** Where the root joint is: [forward, height above the floor], with an optional third number across the body. */
  at: ChainPoint;
  /** The spine's direction, hip toward neck. */
  trunk: ChainDir;
  /** How far the spine is curled forward, in degrees, from one end to the other. */
  curl?: number;
  /** How far the spine is bent to the near side, in degrees. */
  sideCurl?: number;
  /** How far the shoulders are turned about the spine, in degrees; positive brings the near shoulder forward. */
  twist?: number;
  /** How far the shoulders are lifted toward the ears, along the spine (a shrug). */
  shrug?: number;
  /**
   * How far the whole body is rolled about its own length, in degrees: hips
   * and shoulders together. Positive brings the near side toward the front of
   * the body, as `twist` does for the shoulders alone.
   */
  roll?: number;
  /** Neck to head; continues the spine when omitted. */
  head?: ChainDir;
  thigh: ChainDir;
  shin: ChainDir;
  /** Ankle to toe, for feet that are not flat on the floor. */
  foot?: ChainDir;
  upperArm: ChainDir;
  forearm: ChainDir;
  /** Wrist to grip, for movements that bend the wrist. */
  hand?: ChainDir;
  /** The far limbs, where they differ from the near ones. */
  farThigh?: ChainDir;
  farShin?: ChainDir;
  farFoot?: ChainDir;
  farUpperArm?: ChainDir;
  farForearm?: ChainDir;
  /**
   * A hand position the arms are solved to, in place of the arm directions
   * (hands planted, or on a fixed grip). With two numbers the hand stays in
   * line with its own shoulder; a third places it across the body.
   */
  wrist?: ChainPoint;
  farWrist?: ChainPoint;
  /** An ankle position the legs are solved to, in place of the leg directions (feet planted). */
  ankle?: ChainPoint;
  farAnkle?: ChainPoint;
}

/** Where a piece of equipment is painted: behind the figure, between the far limbs and the trunk, or in front of everything. */
export type ChainLayer = 'behind' | 'mid' | 'front';
/** A piece of fixed equipment. */
export type ChainShape =
  | { kind: 'slab'; a: ChainPoint; b: ChainPoint; layer?: ChainLayer }
  | { kind: 'frame'; a: ChainPoint; b: ChainPoint; layer?: ChainLayer }
  | { kind: 'post'; at: ChainPoint; layer?: ChainLayer }
  | { kind: 'pulley'; at: ChainPoint; layer?: ChainLayer }
  | { kind: 'ball'; at: ChainPoint; r: number; layer?: ChainLayer }
  | { kind: 'roller'; at: ChainPoint; layer?: ChainLayer }
  | { kind: 'box'; a: ChainPoint; b: ChainPoint; layer?: ChainLayer };

/** A cable or band from a fixed point, or from under a foot, to a hand or an ankle. */
export interface ChainLine {
  from: ChainPoint | 'nearFoot' | 'farFoot';
  /** 'midGrip' is half-way between the two hands: the middle of a bar they both hold. */
  to: 'nearGrip' | 'farGrip' | 'midGrip' | 'nearAnkle' | 'farAnkle';
  /** 'far' paints the line behind the trunk and the near limbs (a cable that runs between the legs). */
  depth?: 'far';
}

/** A chain movement: its poses, how it is seen, what it holds and the equipment around it. */
export interface ChainMovement {
  /**
   * The joint a pose places directly. 'ankle' is the near ankle: the body is
   * built up from a planted foot. 'toe' is the near forefoot: the body is built
   * up from the ball of a foot whose heel is free to rise. 'farAnkle' is the
   * far ankle, for a body that turns onto its far side.
   */
  root: 'hip' | 'neck' | 'ankle' | 'toe' | 'farAnkle';
  /**
   * The poses form a loop: after the last comes the first again, and the phase
   * may run on past it. Between whole phases the figure moves at an even pace,
   * so a stride does not pulse.
   */
  cycle?: boolean;
  /** Side view by default. 'oblique' turns the figure by `yawDeg`; 'front' faces it. */
  view?: 'side' | 'oblique' | 'front';
  yawDeg?: number;
  /**
   * An oblique view can also look down on the figure by this many degrees, so
   * that nearer things sit lower. For a movement that happens in one level
   * plane, which any level viewpoint would flatten to a line.
   */
  pitchDeg?: number;
  /** The screen x of world x = 0. */
  originX?: number;
  poses: readonly ChainPose[];
  /** Which part of the spine a curl bends: all of it, the upper part (a crunch) or the lower part (a pelvis roll). */
  spine?: 'whole' | 'upper' | 'lower';
  /** Which end of the spine `trunk` gives the direction of, when the spine is curled. */
  trunkAt?: 'hip' | 'neck';
  /** The way a solved elbow or knee points. */
  elbowPole?: ChainDir;
  kneePole?: ChainDir;
  /**
   * 'flat': level and on the floor. 'free': along the pose's foot direction.
   * 'front': standing, seen from the front, drawn the way every front view draws a foot.
   */
  feet?: 'flat' | 'free' | 'front' | 'none';
  /** What the hands hold. */
  implement?: 'none' | 'bells' | 'bell' | 'hammer' | 'bar' | 'ez' | 'cableBar' | 'handle' | 'handles' | 'rope' | 'longBar' | 'kettlebell';
  /** For 'longBar': the point on the floor the bar's far end is braced at, and the bar's whole length from there. */
  barAnchor?: ChainPoint;
  barLength?: number;
  /** Which way the palm of a bent hand faces: what it holds sits on that side of the knuckles. */
  palm?: 'up' | 'down';
  /**
   * A palms-up dumbbell curl whose wrist keeps turning at the top: over the
   * upper half of the lift each bell tilts so its inner, little-finger end
   * rises toward the same-side ear ("pinky toward the ear"). The same tilt the
   * supinated standing curl is drawn with.
   */
  supinatedPeak?: boolean;
  /** The direction a held dumbbell's handle points. Across the body when omitted. */
  bellAxis?: readonly [number, number, number];
  lines?: readonly ChainLine[];
  equipment?: readonly ChainShape[];
  /**
   * Arm directions are given as if the trunk were upright and turn with the
   * top of the spine (hands that stay on the chest or by the head as the trunk curls).
   */
  armsFollowTrunk?: boolean;
  /**
   * The keyframe's turn (`tw`) grows with the phase: none at the first pose,
   * all of it at the second. For a rep that turns as it goes down.
   */
  turnWithPhase?: boolean;
  /** Paint the far arm over the trunk (hands in front of the body in a front view). */
  farArmOver?: boolean;
  /** Paint the near arm over the head (an arm held beside the head). */
  nearArmOverHead?: boolean;
  /**
   * A magnified view of the near hand in a round panel, for a movement that
   * happens in the fingers. The poses then carry the scene as well as the
   * body: from pose 0 to pose 1 the panel grows out of the hand, and from
   * pose 1 to pose 2 the fingers open and the bar rolls from the palm to the
   * fingertips. `at` is the panel's centre, `r` its radius and `scale` how
   * many times larger than the figure the hand is drawn.
   */
  closeUp?: { at: ChainPoint; r: number; scale: number };
}

const CHAIN_TRUNK = 24;
const CHAIN_NECK = 9;
const CHAIN_THIGH = 22.25;
const CHAIN_SHIN = 22.25;
const CHAIN_HAND = 4;
/** How far from the knuckles' line a weight held in a bent hand sits. */
const CHAIN_PALM = 1.8;
const CHAIN_FOOT = 5.4;
/** The floor the soles rest on. */
const CHAIN_FLOOR = 96.9;
const CHAIN_SPINE_STEPS = 32;
/** The height of an ankle whose flat foot is on the floor, and of the hip of a figure standing straight on it. */
export const CHAIN_ANKLE_HEIGHT = CANONICAL_BODY_PARAMETERS.lw * 0.9 / 2;
export const CHAIN_STANDING_HIP = CHAIN_ANKLE_HEIGHT + CHAIN_THIGH + CHAIN_SHIN;

const chainRad = (d: number): number => d * Math.PI / 180;
const chainPair = (d: ChainDir): readonly [number, number] => (typeof d === 'number' ? [d, 0] : d);
/** The unit vector of a direction, for a limb on the near (+1) or far (-1) side. */
function chainUnit(d: readonly [number, number], side: number): ChainVec {
  const a = chainRad(d[0]), o = chainRad(d[1]);
  return [Math.cos(a) * Math.cos(o), Math.sin(a) * Math.cos(o), side * Math.sin(o)];
}
const chainAdd = (p: ChainVec, v: ChainVec, k: number): ChainVec => [p[0] + v[0] * k, p[1] + v[1] * k, p[2] + v[2] * k];
const chainDot = (p: ChainVec, q: ChainVec): number => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const chainCross = (p: ChainVec, q: ChainVec): ChainVec =>
  [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
function chainNormal(v: ChainVec): ChainVec {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
}
const chainWorld = (p: ChainPoint): ChainVec => [p[0], p[1], p[2] ?? 0];
/** The direction across the body, square to a spine direction: toward the viewer for a spine in the side plane. */
function chainAcross(axis: ChainVec): ChainVec {
  const k = axis[2];
  return chainNormal([-axis[0] * k, -axis[1] * k, 1 - axis[2] * k]);
}

/** The hip of a figure sitting with level thighs and feet flat on the floor. */
const CHAIN_SEATED_HIP = CHAIN_ANKLE_HEIGHT + CHAIN_SHIN;
/** Half the drawn depth of a thigh, and of the trunk at the shoulders. */
const CHAIN_THIGH_HALF = CANONICAL_BODY_PARAMETERS.lw * 1.18 / 2;
const CHAIN_BACK_HALF = CANONICAL_BODY_PARAMETERS.sw * 0.58;

/**
 * An incline bench for a figure sitting back against it: a back pad lying
 * along the trunk's back, a seat under the thighs, and a support under each.
 */
function chainInclineBench(hip: readonly [number, number], trunkDeg: number): ChainShape[] {
  const along = chainUnit([trunkDeg, 0], 1);
  const behind = chainUnit([trunkDeg + 90, 0], 1);
  const foot: ChainVec = chainAdd([hip[0], hip[1], 0], behind, CHAIN_BACK_HALF + 2);
  const low = chainAdd(foot, along, -1), high = chainAdd(foot, along, 37), prop = chainAdd(foot, along, 20);
  const seat = hip[1] - CHAIN_THIGH_HALF - 2;
  return [
    { kind: 'post', at: [prop[0], prop[1]] },
    { kind: 'post', at: [hip[0] + 9, seat - 2] },
    { kind: 'slab', a: [low[0], low[1]], b: [high[0], high[1]] },
    { kind: 'slab', a: [hip[0] - 2, seat], b: [hip[0] + 13, seat] },
  ];
}

const INCLINE_CURL_HIP: readonly [number, number] = [46, CHAIN_SEATED_HIP];
const FRONT_INCLINE_RAISE_HIP: readonly [number, number] = [48, CHAIN_SEATED_HIP];
const INCLINE_EXTENSION_HIP: readonly [number, number] = [50, CHAIN_SEATED_HIP];
/** The high pulley behind the Cable Incline Triceps Extension. */
export const INCLINE_EXTENSION_PULLEY: readonly [number, number] = [5.4, 74.6];

/** A flat bench: a level pad whose top is at height `top`, from `x0` to `x1`, on a support near each end. */
function chainFlatBench(x0: number, x1: number, top: number): ChainShape[] {
  return [
    { kind: 'post', at: [x0 + 5, top - 4] },
    { kind: 'post', at: [x1 - 5, top - 4] },
    { kind: 'slab', a: [x0, top - 2], b: [x1, top - 2] },
  ];
}

/**
 * A decline bench for a figure lying back on it, head at the low end: one
 * board under the back and thighs, a support at each end, and a roller the
 * ankles hook under so the legs are secured.
 */
function chainDeclineBench(hip: readonly [number, number], declineDeg: number, ankle: readonly [number, number]): ChainShape[] {
  const downhill = chainUnit([180 + declineDeg, 0], 1);
  const under = chainUnit([270 + declineDeg, 0], 1);
  const foot: ChainVec = chainAdd([hip[0], hip[1], 0], under, CHAIN_BACK_HALF + 2);
  const low = chainAdd(foot, downhill, 40), high = chainAdd(foot, downhill, -21);
  const roller: readonly [number, number] = [ankle[0] + 4.6, ankle[1] + 2.4];
  return [
    { kind: 'post', at: [low[0] + 5, low[1]] },
    { kind: 'post', at: [high[0] - 3, high[1]] },
    { kind: 'frame', a: [high[0], high[1]], b: roller },
    { kind: 'slab', a: [low[0], low[1]], b: [high[0], high[1]] },
    { kind: 'roller', at: roller },
  ];
}

/** The decline the two decline triceps extensions lie at, and the lying figure they share. */
export const DECLINE_EXTENSION_DEG = 20;
const DECLINE_EXTENSION_HIP: readonly [number, number] = [60, 36];
const DECLINE_EXTENSION_BODY = {
  at: DECLINE_EXTENSION_HIP, trunk: 180 + DECLINE_EXTENSION_DEG, thigh: DECLINE_EXTENSION_DEG - 8, shin: -80, foot: 10,
} as const;
/** Where the secured ankles sit: at the end of that fixed leg. */
const DECLINE_EXTENSION_ANKLE: readonly [number, number] = [
  DECLINE_EXTENSION_HIP[0] + CHAIN_THIGH * Math.cos(chainRad(DECLINE_EXTENSION_DEG - 8)) + CHAIN_SHIN * Math.cos(chainRad(-80)),
  DECLINE_EXTENSION_HIP[1] + CHAIN_THIGH * Math.sin(chainRad(DECLINE_EXTENSION_DEG - 8)) + CHAIN_SHIN * Math.sin(chainRad(-80)),
];
/** The flat benches the two cable extensions lie on, by the height of the pad's top. */
const CABLE_LYING_BENCH_TOP = 18;
const LOW_CABLE_BENCH_TOP = 12;
/** The low pulleys behind the head for the two lying cable extensions. */
export const CABLE_LYING_EXTENSION_PULLEY: readonly [number, number] = [4, 10];
export const LOW_CABLE_EXTENSION_PULLEY: readonly [number, number] = [5, 14];

/**
 * The wrist curls: sitting on the edge of a flat bench and leaning forward so
 * the forearms lie level along the thighs. The upper arm's direction is the
 * one that puts the forearm's underside exactly on the top of the thigh.
 */
const WRIST_CURL_HIP: readonly [number, number] = [34, CHAIN_SEATED_HIP];
const WRIST_CURL_TRUNK = 44;
const WRIST_CURL_FOREARM_HEIGHT = CHAIN_SEATED_HIP + CHAIN_THIGH_HALF + CANONICAL_BODY_PARAMETERS.lw * 0.72 / 2;
const WRIST_CURL_UPPER_ARM = -180 + Math.asin(
  (CHAIN_SEATED_HIP + CHAIN_TRUNK * Math.sin(chainRad(WRIST_CURL_TRUNK)) - WRIST_CURL_FOREARM_HEIGHT) / SAGITTAL_UPPER_ARM,
) * 180 / Math.PI;
const WRIST_CURL_BODY = {
  at: WRIST_CURL_HIP, trunk: WRIST_CURL_TRUNK, head: 62, thigh: 0, shin: -90, upperArm: WRIST_CURL_UPPER_ARM, forearm: 0,
} as const;
const WRIST_CURL_BENCH = chainFlatBench(WRIST_CURL_HIP[0] - 17, WRIST_CURL_HIP[0] + 7, CHAIN_SEATED_HIP - CHAIN_THIGH_HALF);
/** The low pulley the Cable Wrist Curl faces. */
export const CABLE_WRIST_CURL_PULLEY: readonly [number, number] = [92, 3];

/** The Spider Curl: where the hips are, how far the trunk leans, and the wedge pad that leaning puts under it. */
const SPIDER_CURL_HIP: readonly [number, number] = [37, 43.6];
const SPIDER_CURL_TRUNK = 40;
/** The direction the Spider Curl's upper arms lie in: down the far face of the pad, square to the leaning trunk. */
export const SPIDER_CURL_UPPER_ARM = SPIDER_CURL_TRUNK - 90;
/**
 * A preacher pad seen from the side, as a wedge: the angled face the chest
 * and stomach lie against, and the far face the upper arms rest on. The far
 * face runs parallel to the upper arms, set where their backs meet it, and
 * the two faces join at the top of the pad.
 */
export function spiderCurlPad(): { angled: readonly [ChainPoint, ChainPoint]; rest: readonly [ChainPoint, ChainPoint] } {
  const hip: ChainVec = [SPIDER_CURL_HIP[0], SPIDER_CURL_HIP[1], 0];
  const along = chainUnit([SPIDER_CURL_TRUNK, 0], 1);
  const arm = chainUnit([SPIDER_CURL_UPPER_ARM, 0], 1);
  const foot = chainAdd(hip, chainUnit([SPIDER_CURL_TRUNK - 90, 0], 1), CHAIN_BACK_HALF + 2);
  const under = chainAdd(chainAdd(hip, along, CHAIN_TRUNK), chainUnit([SPIDER_CURL_UPPER_ARM - 90, 0], 1),
    CANONICAL_BODY_PARAMETERS.lw * 0.88 / 2 + 2);
  // Where the two faces meet: foot + k * along = under + t * arm.
  const dx = under[0] - foot[0], dy = under[1] - foot[1];
  const k = (arm[0] * dy - arm[1] * dx) / (arm[0] * along[1] - arm[1] * along[0]);
  const top = chainAdd(foot, along, k);
  const low = chainAdd(foot, along, -3), end = chainAdd(top, arm, 15);
  return { angled: [[low[0], low[1]], [top[0], top[1]]], rest: [[top[0], top[1]], [end[0], end[1]]] };
}
const SPIDER_CURL_BODY = {
  at: SPIDER_CURL_HIP, trunk: SPIDER_CURL_TRUNK, head: 70, thigh: -110, shin: -110, ankle: [22, CHAIN_ANKLE_HEIGHT],
} as const;

/** The Concentration Curl: seated with the feet wide, leaning forward, seen turned so the inner thigh shows. */
const CONCENTRATION_BODY = {
  at: [0, CHAIN_SEATED_HIP], trunk: 42, head: 62, thigh: [0, 30], shin: -90, upperArm: [-90, 20],
  // The free hand rests on the other knee.
  farWrist: [
    CHAIN_THIGH * Math.cos(chainRad(30)) - 2,
    CHAIN_SEATED_HIP + CHAIN_THIGH_HALF + 1.7,
    -(CANONICAL_BODY_PARAMETERS.hw * 0.8 + CHAIN_THIGH * Math.sin(chainRad(30)) - 1),
  ],
} as const;

/**
 * The height of the spine of a figure lying on the floor: half the trunk's
 * depth, plus the rounded edge its slices are drawn with, so nothing is
 * painted below the floor.
 */
export const CHAIN_LYING_HEIGHT = CHAIN_BACK_HALF + 0.6;
/** Arms lying on the floor beside the body, pointing at the feet, palms down. */
const ARMS_BESIDE = { upperArm: -8, forearm: -12 } as const;
/** The low pulley beyond the feet for the Cable Reverse Crunch. */
export const CABLE_REVERSE_CRUNCH_PULLEY: readonly [number, number] = [93, 5];
/** The Decline Reverse Crunch: how steep the bench is, and where the shoulders lie on it. */
export const DECLINE_REVERSE_CRUNCH_DEG = 20;
const DECLINE_REVERSE_CRUNCH_NECK: readonly [number, number] = [24, 30];
/** That bench: one board under the back with the head at the high end, a handle beyond the head, a support at each end. */
function declineReverseCrunchBench(): ChainShape[] {
  const uphill = chainUnit([180 - DECLINE_REVERSE_CRUNCH_DEG, 0], 1);
  const under = chainUnit([270 - DECLINE_REVERSE_CRUNCH_DEG, 0], 1);
  const foot = chainAdd([DECLINE_REVERSE_CRUNCH_NECK[0], DECLINE_REVERSE_CRUNCH_NECK[1], 0], under, CHAIN_BACK_HALF + 2);
  const high = chainAdd(foot, uphill, 21), low = chainAdd(foot, uphill, -34);
  return [
    { kind: 'post', at: [high[0] + 4, high[1]] },
    { kind: 'post', at: [low[0] - 4, low[1]] },
    { kind: 'slab', a: [high[0], high[1]], b: [low[0], low[1]] },
  ];
}
/** Where the hands hold the top of that bench: on the board's upper face, beyond the head. */
const DECLINE_REVERSE_CRUNCH_GRIP: readonly [number, number] = [
  DECLINE_REVERSE_CRUNCH_NECK[0] + 20 * Math.cos(chainRad(180 - DECLINE_REVERSE_CRUNCH_DEG)) + CHAIN_BACK_HALF * Math.cos(chainRad(270 - DECLINE_REVERSE_CRUNCH_DEG)),
  DECLINE_REVERSE_CRUNCH_NECK[1] + 20 * Math.sin(chainRad(180 - DECLINE_REVERSE_CRUNCH_DEG)) + CHAIN_BACK_HALF * Math.sin(chainRad(270 - DECLINE_REVERSE_CRUNCH_DEG)) + 2,
];

/** The height of a knee resting on the floor: half the drawn depth of the thigh that ends there. */
const CHAIN_KNEELING_KNEE = CHAIN_THIGH_HALF + 0.01;
/** The height of an ankle, and of the hip above it, for a figure standing in a front view. */
export const CHAIN_FRONT_ANKLE = 2.9;
export const CHAIN_FRONT_HIP = CHAIN_FRONT_ANKLE + CHAIN_THIGH + CHAIN_SHIN;
/** Hands held beside the ears with the elbows forward, given as if the trunk were upright. */
const HANDS_BY_EARS = { upperArm: 35, forearm: 168 } as const;
/** The high pulley behind the Standing Rope Crunch, and the one the Kneeling Cable Crunch faces. */
export const STANDING_ROPE_CRUNCH_PULLEY: readonly [number, number] = [10, 88];
export const KNEELING_CRUNCH_PULLEY: readonly [number, number] = [70, 96];
/** How far the Kneeling Cable Crunch turns on its oblique repetitions, in degrees. */
export const KNEELING_CRUNCH_TURN = 35;
/** The Decline Oblique Crunch sits on the decline bench the triceps extensions lie on. */
const DECLINE_OBLIQUE_LEGS = { at: DECLINE_EXTENSION_HIP, thigh: DECLINE_EXTENSION_DEG - 8, shin: -80, foot: 10 } as const;
/** The mid-height pulley beside the Cable Russian Twists: across the body, on the far side. */
export const RUSSIAN_TWIST_PULLEY: readonly [number, number, number] = [2, 46, -50];
/** Both hands on one handle above the chest: each straight arm leans in from its shoulder to the midline. */
const RUSSIAN_TWIST_ARM_IN = -Math.asin(CANONICAL_BODY_PARAMETERS.sw * 0.92 / (SAGITTAL_UPPER_ARM + SAGITTAL_FOREARM)) * 180 / Math.PI;
/** The stability ball under the upper back. */
export const RUSSIAN_TWIST_BALL = { at: [6, 10.5] as const, r: 10.5 };
/** The high pulley beside the cable side bend: across the body, on the near side. */
export const SIDE_BEND_PULLEY: readonly [number, number, number] = [0, 88, 40];
/** How far the side bend bends, in degrees. */
export const SIDE_BEND_DEG = 30;

/**
 * Lying face down with the legs long: the thigh's direction that rests the
 * knee on the floor, and the shin's that rests the ankle there.
 */
const PRONE_KNEE_HEIGHT = CHAIN_THIGH_HALF + 0.02;
const PRONE_THIGH = 180 + Math.asin((CHAIN_LYING_HEIGHT - PRONE_KNEE_HEIGHT) / CHAIN_THIGH) * 180 / Math.PI;
const PRONE_SHIN = 180 + Math.asin((PRONE_KNEE_HEIGHT - CHAIN_ANKLE_HEIGHT - 0.02) / CHAIN_SHIN) * 180 / Math.PI;
/** The arm's direction that rests a hand on the floor ahead of a prone figure. */
const PRONE_ARM = -Math.asin((CHAIN_LYING_HEIGHT - 2.2) / (SAGITTAL_UPPER_ARM + SAGITTAL_FOREARM)) * 180 / Math.PI;
/** How far the Floor Back Extension arches, and how far the legs lift, in degrees. */
export const BACK_EXTENSION_ARCH = 18;
const BACK_EXTENSION_LEG_LIFT = 9;
/** The Bench Dip: the height of the bench top, where its front edge is, and where the hands grip it. */
export const BENCH_DIP_BENCH = { top: 21, edge: 38 } as const;
const BENCH_DIP_GRIP: readonly [number, number] = [BENCH_DIP_BENCH.edge - 2, BENCH_DIP_BENCH.top + 2.2];
const BENCH_DIP_FEET: readonly [number, number] = [73, CHAIN_ANKLE_HEIGHT];
/** The Decline Push-Up: the bench the feet are on, the ankle above it, and the hands on the floor. */
export const DECLINE_PUSH_UP_BENCH_TOP = 21;
const DECLINE_PUSH_UP_ANKLE: readonly [number, number] = [14, DECLINE_PUSH_UP_BENCH_TOP + CANONICAL_BODY_PARAMETERS.lw * 0.82 / 2 + 5.4 * Math.sin(chainRad(70))];
const DECLINE_PUSH_UP_HANDS: readonly [number, number] = [82.5, 2.2];
/** One body line from the ankles to the head, at an angle to the floor. */
function plankAt(deg: number) {
  return { at: DECLINE_PUSH_UP_ANKLE, trunk: deg, head: deg + 6, thigh: deg + 180, shin: deg + 180, foot: -70, upperArm: -90, forearm: -90, wrist: DECLINE_PUSH_UP_HANDS } as const;
}
/**
 * One leg through a running stride, as six positions: landing beneath the
 * body, mid-stance, toe-off, heel coming up behind, knee driving through, and
 * reaching down to land again. The other leg is three positions ahead.
 */
const RUN_LEG = [
  { thigh: -75, shin: -100, foot: 0 },
  { thigh: -92, shin: -98, foot: 0 },
  { thigh: -112, shin: -118, foot: -60 },
  { thigh: -100, shin: -175, foot: -150 },
  { thigh: -55, shin: -130, foot: -40 },
  { thigh: -62, shin: -95, foot: -5 },
] as const;
/** The arm on the same side as that leg, which swings opposite it: furthest back as the knee drives through, furthest forward at toe-off. */
const RUN_ARM = [-92, -70, -60, -82, -108, -112] as const;
/** The hip's height at each of the six positions: lowest on landing, highest in flight. */
const RUN_HIP = [46.1, 47.1, 48.1, 46.1, 47.1, 48.1] as const;
const RUN_POSES: ChainPose[] = RUN_LEG.map((leg, k): ChainPose => {
  const other = RUN_LEG[(k + 3) % 6];
  return {
    at: [50, RUN_HIP[k]], trunk: 84, head: 88,
    thigh: leg.thigh, shin: leg.shin, foot: leg.foot,
    farThigh: other.thigh, farShin: other.shin, farFoot: other.foot,
    upperArm: RUN_ARM[k], forearm: RUN_ARM[k] + 80,
    farUpperArm: RUN_ARM[(k + 3) % 6], farForearm: RUN_ARM[(k + 3) % 6] + 80,
  };
});

/** The height of the shoulders of a figure standing tall in a front view. */
const CHAIN_FRONT_SHOULDER = CHAIN_FRONT_HIP + CHAIN_TRUNK;
/**
 * The upright rows: half the distance between the hands, and where the hands
 * are at the bottom (against the thighs) and at the top (toward the chin), as
 * [forward of the shoulders, below the shoulders].
 */
export const UPRIGHT_ROW = {
  'upright-barbell-row': { gripHalf: 7.6, bottom: [5, 23.6], top: [6.3, 1] },
  'upright-row-with-bands': { gripHalf: 8.5, bottom: [5, 23.5], top: [6.3, 2.5] },
} as const;
/** One upright-row pose: both hands at the same height, each on its own side of the midline. */
function uprightRowPose(slug: keyof typeof UPRIGHT_ROW, end: 'bottom' | 'top'): ChainPose {
  const spec = UPRIGHT_ROW[slug];
  const [forward, below] = spec[end];
  return {
    at: [0, CHAIN_FRONT_HIP], trunk: 90, thigh: -90, shin: -90, upperArm: -90, forearm: -90,
    wrist: [forward, CHAIN_FRONT_SHOULDER - below, spec.gripHalf],
    farWrist: [forward, CHAIN_FRONT_SHOULDER - below, -spec.gripHalf],
  };
}
/** The Barbell Side Split Squat: how far each foot is from the midline, and where the hips are standing tall and at the bottom. */
export const SIDE_SPLIT_SQUAT = { footOut: 22, tall: [0, 44.4, 0], low: [0, 35.5, 14] } as const;
/** One side-split-squat pose: feet planted wide, the bar held across the back of the shoulders. */
function sideSplitSquatPose(hip: readonly [number, number, number]): ChainPose {
  return {
    at: hip, trunk: 90, thigh: -90, shin: -90,
    ankle: [0, CHAIN_FRONT_ANKLE, SIDE_SPLIT_SQUAT.footOut],
    farAnkle: [0, CHAIN_FRONT_ANKLE, -SIDE_SPLIT_SQUAT.footOut],
    upperArm: [-90, 35], forearm: [90, 0],
  };
}

/** The slight elbow bend the three side raises hold for the whole rep, in degrees. */
export const SIDE_RAISE_ELBOW_BEND = { 'cable-seated-lateral-raise': 12, 'reverse-flyes': 10 } as const;
/** The Cable Seated Lateral Raise: how far forward the trunk leans from the hips, and the two low pulleys either side of the bench. */
export const SEATED_CABLE_RAISE_LEAN = 28;
export const SEATED_CABLE_RAISE_PULLEYS: readonly [ChainPoint, ChainPoint] = [[20, 4, 46], [20, 4, -46]];
/** The Reverse Flyes: the incline the chest lies on, and where the hips are. */
export const REVERSE_FLYE_INCLINE = 45;
const REVERSE_FLYE_HIP: readonly [number, number] = [38, 40];
/** That bench: a pad along the front of the trunk, on a post. */
function reverseFlyeBench(): ChainShape[] {
  const along = chainUnit([REVERSE_FLYE_INCLINE, 0], 1);
  const front = chainUnit([REVERSE_FLYE_INCLINE - 90, 0], 1);
  const foot = chainAdd([REVERSE_FLYE_HIP[0], REVERSE_FLYE_HIP[1], 0], front, CHAIN_BACK_HALF + 2);
  const low = chainAdd(foot, along, -2), high = chainAdd(foot, along, 21), prop = chainAdd(foot, along, 10);
  return [
    { kind: 'post', at: [prop[0], prop[1]] },
    { kind: 'frame', a: [prop[0] - 12, 1.2], b: [prop[0] + 12, 1.2] },
    { kind: 'slab', a: [low[0], low[1]], b: [high[0], high[1]] },
  ];
}
/** The Back Flyes With Bands: where the band is looped round the rack upright, at shoulder height in front. */
export const BACK_FLYE_ANCHOR: readonly [number, number] = [46, CHAIN_STANDING_HIP + CHAIN_TRUNK];

/** The height of the shoulders of a figure standing tall on flat feet. */
const CHAIN_STANDING_SHOULDER = CHAIN_STANDING_HIP + CHAIN_TRUNK;
/** Cable Seated Crunch: the hips on the bench, and the high pulley behind. */
const SEATED_CRUNCH_HIP: readonly [number, number] = [44, CHAIN_SEATED_HIP];
export const SEATED_CRUNCH_PULLEY: readonly [number, number] = [8, 84];
/** Cable Crunch: kneeling with the hips a little behind the knees, facing a high pulley a short way in front. */
const CABLE_CRUNCH_THIGH = -70;
const CABLE_CRUNCH_HIP: readonly [number, number] = [46, CHAIN_KNEELING_KNEE + CHAIN_THIGH * Math.sin(chainRad(70))];
export const CABLE_CRUNCH_PULLEY: readonly [number, number] = [72, 96];
/** The two floor crunches: where the hips lie, and feet flat on the floor with the knees bent. */
const FLOOR_CRUNCH_HIP: readonly [number, number] = [50, CHAIN_LYING_HEIGHT];
const FLOOR_CRUNCH_FOOT: readonly [number, number] = [77, CHAIN_ANKLE_HEIGHT];
/** Janda Sit-Up: the foot placed so the planted leg's knee is bent to a right angle. */
const JANDA_HIP: readonly [number, number] = [44, CHAIN_LYING_HEIGHT];
const JANDA_FOOT: readonly [number, number] = [
  JANDA_HIP[0] + Math.sqrt(2 * CHAIN_THIGH * CHAIN_THIGH - (CHAIN_LYING_HEIGHT - CHAIN_ANKLE_HEIGHT) ** 2), CHAIN_ANKLE_HEIGHT,
];
/** The Pallof presses: the anchor out to the athlete's side, and the arm directions for hands at the chest and pressed out. */
export const PALLOF_BAND_ANCHOR: readonly [number, number, number] = [0, CHAIN_STANDING_SHOULDER - 7, 40];
export const PALLOF_PULLEY: readonly [number, number, number] = [0, CHAIN_STANDING_SHOULDER, 34];
const PALLOF_STANCE = { at: [0, CHAIN_STANDING_HIP], trunk: 90, thigh: -90, shin: -90 } as const;
const PALLOF_AT_CHEST = { upperArm: [-70, 25], forearm: [54, -72] } as const;
const PALLOF_PRESSED = { upperArm: [-5, -18.8], forearm: [-5, -18.8] } as const;
/** Cable Pull-Through: the low pulley behind the athlete, and where the feet stand. */
export const PULL_THROUGH_PULLEY: readonly [number, number] = [6, 5];
const PULL_THROUGH_FEET: readonly [number, number] = [52, CHAIN_ANKLE_HEIGHT];
/** Step-up with Knee Raise: the box, and a foot standing on it. */
export const STEP_BOX = { front: 50, back: 68, top: 14 } as const;
const STEP_ON_BOX: readonly [number, number] = [57, STEP_BOX.top + CHAIN_ANKLE_HEIGHT];
const STEP_ON_FLOOR: readonly [number, number] = [40, CHAIN_ANKLE_HEIGHT];
const STEP_ARMS = { upperArm: -88, forearm: -80 } as const;
/** The internal rotations: the anchor out to the working side at elbow height, in a front view. */
export const INTERNAL_ROTATION_ANCHOR: readonly [number, number, number] = [0, CHAIN_FRONT_SHOULDER - RAISE_UPPER_ARM, 40];
const INTERNAL_ROTATION_BODY = {
  at: [0, CHAIN_FRONT_HIP], trunk: 90, thigh: -90, shin: -90, upperArm: [-90, 0], farUpperArm: [-90, 4], farForearm: [-90, 2],
} as const;
/** Low Pulley Row To Neck: the seat, the foot plate and the low pulley of a row station. */
const NECK_ROW_SEAT_TOP = 12;
const NECK_ROW_FEET: readonly [number, number] = [43, 13];
export const NECK_ROW_PULLEY: readonly [number, number] = [58, 14];

/** Where a point sits against the front of a leaning trunk: `along` up the spine from the hip, `off` out from the spine's line. */
function chainOnFront(hip: readonly [number, number], trunkDeg: number, along: number, off: number): readonly [number, number] {
  const a = chainRad(trunkDeg);
  return [hip[0] + Math.cos(a) * along + Math.sin(a) * off, hip[1] + Math.sin(a) * along - Math.cos(a) * off];
}
const chainNeckOf = (hip: readonly [number, number], trunkDeg: number): readonly [number, number] => chainOnFront(hip, trunkDeg, CHAIN_TRUNK, 0);
/** How far from its shoulder the hand of a straight arm is: a hair short of the two segments, so the elbow can still be solved. */
const CHAIN_LONG_ARM = SAGITTAL_UPPER_ARM + SAGITTAL_FOREARM - 0.03;

/** Bent Over Barbell Row: hips back over soft knees with the trunk almost level; the bar finishes against the body. */
export const BENT_ROW_TRUNK = 15;
const BENT_ROW_HIP: readonly [number, number] = [33, 44.2];
const BENT_ROW_FEET: readonly [number, number] = [42, CHAIN_ANKLE_HEIGHT];
const BENT_ROW_SHOULDER = chainNeckOf(BENT_ROW_HIP, BENT_ROW_TRUNK);
/** How far up the spine from the hip the bar meets the body. */
export const BENT_ROW_TOUCH = 10;
const BENT_ROW_TOP = chainOnFront(BENT_ROW_HIP, BENT_ROW_TRUNK, BENT_ROW_TOUCH, 7.2);
/** Barbell Rear Delt Row: the hinge, half the wide grip, and the upper chest the bar is rowed toward. */
export const REAR_DELT_ROW_TRUNK = 25;
export const REAR_DELT_ROW_GRIP_HALF = 15;
const REAR_DELT_ROW_HIP: readonly [number, number] = [0, 44.6];
const REAR_DELT_ROW_FEET: readonly [number, number] = [8, CHAIN_ANKLE_HEIGHT];
const REAR_DELT_ROW_SHOULDER = chainNeckOf(REAR_DELT_ROW_HIP, REAR_DELT_ROW_TRUNK);
export const REAR_DELT_ROW_TOUCH = 20;
const REAR_DELT_ROW_TOP = chainOnFront(REAR_DELT_ROW_HIP, REAR_DELT_ROW_TRUNK, REAR_DELT_ROW_TOUCH, 7.6);
const REAR_DELT_ROW_HANG = Math.sqrt(CHAIN_LONG_ARM ** 2 - (REAR_DELT_ROW_GRIP_HALF - CANONICAL_BODY_PARAMETERS.sw * 0.92) ** 2);
/**
 * Bent Over One-Arm Long Bar Row: the bar is braced on the floor behind the
 * athlete and swings up about that end, so the hand on it travels on an arc.
 */
export const LONG_BAR = { anchor: [4, 1.5] as const, grip: 58.6, length: 67, lowDeg: 26.08, highDeg: 41.7 } as const;
const LONG_BAR_ROW_HIP: readonly [number, number] = [34, 43.5];
const LONG_BAR_ROW_FEET: readonly [number, number] = [44, CHAIN_ANKLE_HEIGHT];
export const LONG_BAR_ROW_TRUNK = 20;
const longBarHand = (deg: number): readonly [number, number] =>
  [LONG_BAR.anchor[0] + LONG_BAR.grip * Math.cos(chainRad(deg)), LONG_BAR.anchor[1] + LONG_BAR.grip * Math.sin(chainRad(deg))];
/** Where the free hand rests: on top of the far thigh just above the knee. */
const LONG_BAR_ROW_REST: readonly [number, number] = [46.5, 30.2];
/**
 * Stiff Leg Barbell Good Morning: the feet, the one soft bend the knees keep
 * for the whole rep, and how far the legs lean back with the hips. The leg
 * turns about the ankle as one piece, so the knee's angle cannot change.
 */
const GOOD_MORNING_FEET: readonly [number, number] = [42, CHAIN_ANKLE_HEIGHT];
export const GOOD_MORNING_KNEE_SOFT = 8;
export const GOOD_MORNING_LEAN = 13;
const goodMorningLeg = (lean: number) =>
  ({ at: GOOD_MORNING_FEET, thigh: -90 + GOOD_MORNING_KNEE_SOFT + lean, shin: -90 - GOOD_MORNING_KNEE_SOFT + lean }) as const;
/** Hands on a bar lying across the back of the shoulders, given as if the trunk were upright. */
const BAR_ON_BACK = { upperArm: -82, forearm: 124.3 } as const;
/** The low row station the Cable Row sits at: seat, foot plate and low pulley. */
const ROW_STATION = { seatTop: 12, hipX: 20 } as const;
const ROW_STATION_HIP: readonly [number, number] = [ROW_STATION.hipX, ROW_STATION.seatTop + CHAIN_THIGH_HALF];
const ROW_STATION_FEET: readonly [number, number] = [62.5, 13];
export const ROW_STATION_PULLEY: readonly [number, number] = [84, 16];
/** Cable Row: the handle in long arms toward the pulley, and where it finishes at the lower ribs. */
const CABLE_ROW_REACH: readonly [number, number] = [43.04, 30.61];
const CABLE_ROW_FINISH: readonly [number, number] = [25.5, 27.5];
/** Seated Cable Rows: half the width of the V-handle, and where it is at a full reach and at the stomach. */
export const V_HANDLE_HALF = 2.5;
const SEATED_ROW_REACH: readonly [number, number] = [21.55, 29.5];
const SEATED_ROW_FINISH: readonly [number, number] = [7.5, 27];
/** Face Pull: the pulley in front at upper-chest height. */
export const FACE_PULL_PULLEY: readonly [number, number] = [44, CHAIN_STANDING_SHOULDER - 4];
/**
 * The height of the ball of a planted foot whose heel is free to rise: the
 * height of a flat foot's ankle, so that with the heel down the shin's rounded
 * end rests on the floor and never dips under it.
 */
export const CHAIN_FOREFOOT_HEIGHT = CHAIN_ANKLE_HEIGHT;
/** Calf Raises - With Bands: how far the foot tilts at the top of the rise, in degrees. */
export const BAND_CALF_RAISE_TILT = 42;

/**
 * Standing in a front view with the feet shoulder width apart: how far each
 * straight leg leans out from its hip to put the foot under the shoulder, and
 * the height that leaves the hips at.
 */
const FRONT_STANCE_OUT = Math.asin((CANONICAL_BODY_PARAMETERS.sw * 0.92 - CANONICAL_BODY_PARAMETERS.hw * 0.8) / (CHAIN_THIGH + CHAIN_SHIN)) * 180 / Math.PI;
const FRONT_STANCE_HIP = CHAIN_FRONT_ANKLE + (CHAIN_THIGH + CHAIN_SHIN) * Math.cos(chainRad(FRONT_STANCE_OUT));
/**
 * The overhead presses, in the plane across the shoulders. An upper arm given
 * as [90, out] points `out` degrees away from straight up: 90 is level out to
 * the side, more than 90 is below level. The forearm stays upright.
 */
export const PRESS_START_OUT = { 'standing-dumbbell-press': 100, 'seated-dumbbell-press': 140, 'seated-cable-shoulder-press': 105 } as const;
/** Seated Dumbbell Press: the direction of the trunk sitting back against the bench's back support. */
export const SEATED_PRESS_BACK = 100;
/** Seated Cable Shoulder Press: a low pulley out to each side of the bench. */
export const CABLE_PRESS_PULLEYS: readonly [ChainPoint, ChainPoint] = [[0, 4, 40], [0, 4, -40]];
/** Underhand Cable Pulldowns: the pulley overhead, half the narrow grip, the slight lean back, and where the bar meets the chest. */
export const PULLDOWN = { pulley: [1.5, 92] as const, gripHalf: 5, back: 100, touch: 20 } as const;
const PULLDOWN_HIP: readonly [number, number] = [0, CHAIN_SEATED_HIP];
const PULLDOWN_REACH: readonly [number, number] = [0.5, 71.66];
const PULLDOWN_CHEST = chainOnFront(PULLDOWN_HIP, PULLDOWN.back, PULLDOWN.touch, 7.4);
/** V-Bar Pullup: the bar seen end-on, the handle hung over its middle, and half the distance between the hands on it. */
export const V_BAR = { bar: [50, 104] as const, grip: [50, 98] as const, half: 3 } as const;
/** The hammer curls: an arm hanging at the side, and the forearm at the top of each curl. */
const HAMMER_HANG = { upperArm: [-90, 4], forearm: [-90, 2] } as const;
const HAMMER_STANCE = { at: [0, CHAIN_STANDING_HIP], trunk: 90, thigh: -90, shin: -90 } as const;
/** A forearm curled straight up to shoulder height from an upper arm hanging at the side. */
const HAMMER_CURLED = [60, 2] as const;
/** Dumbbell Sumo Squat: how far each foot is from the midline, and the height of the hips standing and at the bottom. */
export const SUMO_SQUAT = { footOut: 16, tall: 45.9, low: 27 } as const;
/** One sumo-squat pose: feet planted wide, both hands on one dumbbell hanging at the midline on long arms. */
function sumoSquatPose(hipHeight: number): ChainPose {
  const hands = hipHeight + CHAIN_TRUNK - 22.7;
  return {
    at: [0, hipHeight], trunk: 90, thigh: -90, shin: -90,
    ankle: [0, CHAIN_FRONT_ANKLE, SUMO_SQUAT.footOut], farAnkle: [0, CHAIN_FRONT_ANKLE, -SUMO_SQUAT.footOut],
    upperArm: -90, forearm: -90, wrist: [3, hands, 1], farWrist: [3, hands, -1],
  };
}

/**
 * Push Up to Side Plank. The far hand and the far foot stay planted for the
 * whole movement, and the body is one line from the feet. Three angles of
 * that line to the floor: at the bottom of the push-up, at the top with the
 * shoulders over straight arms, and in the side plank, where the hips and
 * shoulders are stacked and the lower shoulder is over the planted hand.
 */
const SIDE_PLANK_ANKLE: readonly [number, number] = [14, CANONICAL_BODY_PARAMETERS.lw * 0.82 / 2 + CHAIN_FOOT * Math.sin(chainRad(70))];
const SIDE_PLANK_BODY = CHAIN_THIGH + CHAIN_SHIN + CHAIN_TRUNK;
const SIDE_PLANK_HAND_HEIGHT = 2.2;
const SIDE_PLANK_SHOULDER_OUT = CANONICAL_BODY_PARAMETERS.sw * 0.92;
const SIDE_PLANK_HIP_OUT = CANONICAL_BODY_PARAMETERS.hw * 0.8;
const sidePlankDeg = (rad: number): number => rad * 180 / Math.PI;
export const PUSH_UP_BOTTOM_DEG = sidePlankDeg(Math.asin((10 - SIDE_PLANK_ANKLE[1]) / SIDE_PLANK_BODY));
export const PUSH_UP_TOP_DEG = sidePlankDeg(Math.asin((SIDE_PLANK_HAND_HEIGHT + CHAIN_LONG_ARM - SIDE_PLANK_ANKLE[1]) / SIDE_PLANK_BODY));
export const SIDE_PLANK_DEG = sidePlankDeg(
  Math.asin((SIDE_PLANK_HAND_HEIGHT + CHAIN_LONG_ARM - SIDE_PLANK_ANKLE[1]) / Math.hypot(SIDE_PLANK_BODY, SIDE_PLANK_SHOULDER_OUT - SIDE_PLANK_HIP_OUT))
  + Math.atan((SIDE_PLANK_SHOULDER_OUT - SIDE_PLANK_HIP_OUT) / SIDE_PLANK_BODY),
);
/** Where both hands are planted for the push-up: under the shoulders at the top. */
const SIDE_PLANK_HANDS: readonly [number, number] = [
  SIDE_PLANK_ANKLE[0] + SIDE_PLANK_BODY * Math.cos(chainRad(PUSH_UP_TOP_DEG)), SIDE_PLANK_HAND_HEIGHT,
];
/** How far the upper leg angles down in the side plank, so its foot rests on the lower one. */
const SIDE_PLANK_LEG_IN = sidePlankDeg(Math.asin((2 * SIDE_PLANK_HIP_OUT - (CANONICAL_BODY_PARAMETERS.lw * 0.82 + 0.4)) / (CHAIN_THIGH + CHAIN_SHIN)));
/** The upper shoulder in the side plank, and the hand reached straight up from it. */
const SIDE_PLANK_TOP_SHOULDER: readonly [number, number] = [
  SIDE_PLANK_ANKLE[0] + SIDE_PLANK_BODY * Math.cos(chainRad(SIDE_PLANK_DEG)) - (SIDE_PLANK_HIP_OUT + SIDE_PLANK_SHOULDER_OUT) * Math.sin(chainRad(SIDE_PLANK_DEG)),
  SIDE_PLANK_ANKLE[1] + SIDE_PLANK_BODY * Math.sin(chainRad(SIDE_PLANK_DEG)) + (SIDE_PLANK_HIP_OUT + SIDE_PLANK_SHOULDER_OUT) * Math.cos(chainRad(SIDE_PLANK_DEG)),
];
/** One pose of it: the body line's angle, how far the body is rolled onto its far side, how far the upper leg angles in, and the near hand. */
function sidePlankPose(deg: number, roll: number, legIn: number, hand: ChainPoint, headUp: number): ChainPose {
  return {
    at: SIDE_PLANK_ANKLE, trunk: deg, head: deg + headUp, roll,
    thigh: deg + 180 + legIn, shin: deg + 180 + legIn, farThigh: deg + 180, farShin: deg + 180, foot: -70,
    upperArm: -90, forearm: -90, wrist: hand, farWrist: SIDE_PLANK_HANDS,
  };
}

/** Finger Curls: where the close-up of the hand sits, how big it is, and how many times it magnifies the hand. */
export const FINGER_CURL_PANEL = { at: [88, 64] as const, r: 24, scale: 7.5 } as const;
/** The seated athlete of the Finger Curls: the wrist curls' seat and level forearms, the hand in line with the forearm. */
const FINGER_CURL_BODY = { ...WRIST_CURL_BODY, hand: 0 } as const;

/** 3/4 Sit-Up: knees bent with the feet held down, and the bar that holds them. */
const THREE_QUARTER_HIP: readonly [number, number] = [50, CHAIN_LYING_HEIGHT];
const THREE_QUARTER_FEET: readonly [number, number] = [77, CHAIN_ANKLE_HEIGHT];
export const THREE_QUARTER_ANCHOR: readonly [number, number] = [THREE_QUARTER_FEET[0] + 2.7, CHAIN_ANKLE_HEIGHT * 2 + 2.6];
/** Crunches: lying with the lower legs resting on a bench, hips and knees at right angles. */
const BENCH_CRUNCH_HIP: readonly [number, number] = [36, CHAIN_LYING_HEIGHT];
/** The top of that bench: the underside of a level shin whose knee is a thigh's length above the hip. */
export const BENCH_CRUNCH_BENCH_TOP = CHAIN_LYING_HEIGHT + CHAIN_THIGH - CHAIN_ANKLE_HEIGHT;
/**
 * Rope Crunch: kneeling tall facing a high pulley a short way in front. The
 * pulley hangs from an overhead beam, with the machine's upright further off,
 * because the hands travel forward under the pulley as the spine curls.
 */
export const ROPE_CRUNCH_UPRIGHT = 88;
const ROPE_CRUNCH_HIP: readonly [number, number] = [44, CHAIN_KNEELING_KNEE + CHAIN_THIGH];
export const ROPE_CRUNCH_PULLEY: readonly [number, number] = [59, 112];
/** A rope end held in each hand beside the head, a little in front of the ears, given as if the trunk were upright. */
const ROPE_BY_HEAD = { upperArm: 30, forearm: 150 } as const;
/** Band Good Morning (Pull Through): the feet, the post in front, and where the band is looped round its base. */
const BAND_GOOD_MORNING_FEET: readonly [number, number] = [36, CHAIN_ANKLE_HEIGHT];
export const BAND_GOOD_MORNING_ANCHOR: readonly [number, number] = [84, 3];
export const BAND_GOOD_MORNING_LEAN = 12;
const bandGoodMorningLeg = (lean: number) =>
  ({ at: BAND_GOOD_MORNING_FEET, thigh: -90 + GOOD_MORNING_KNEE_SOFT + lean, shin: -90 - GOOD_MORNING_KNEE_SOFT + lean }) as const;
/** Hands holding something at the base of the neck, given as if the trunk were upright. */
const HANDS_AT_COLLAR = { upperArm: -80, forearm: 78 } as const;
/** Hip Extension with Bands: the post held for balance, where the band is fixed low on it, and how far the leg goes back. */
export const BAND_KICKBACK_POST = 60;
export const BAND_KICKBACK_ANCHOR: readonly [number, number] = [BAND_KICKBACK_POST, 5];
export const BAND_KICKBACK_DEG = 24;
/** The two shrugs: how far the shoulders lift, in figure units. The same lift the other two shrugs are drawn with. */
export const SHRUG_LIFT = 4.5;
/** Cable Shrugs: the low pulley close in front. */
export const CABLE_SHRUG_PULLEY: readonly [number, number] = [62, 5];

/** Cable One Arm Tricep Extension: the high pulley in front, and the forearm's direction at the start (elbow bent tighter than a right angle). */
export const ONE_ARM_PUSHDOWN_PULLEY: readonly [number, number] = [62, 96];
export const ONE_ARM_PUSHDOWN_START = 25;
/**
 * Preacher Hammer Dumbbell Curl: seated behind a sloping pad. The upper arms
 * lie down the pad's face; the pad is the slab just under them, starting
 * clear of the chest and running on past the elbows.
 */
const PREACHER_HIP: readonly [number, number] = [30, CHAIN_SEATED_HIP];
export const PREACHER_TRUNK = 80;
export const PREACHER_UPPER_ARM = -50;
const PREACHER_SHOULDER = chainNeckOf(PREACHER_HIP, PREACHER_TRUNK);
/** A point down the pad: `along` the upper arm from the shoulder, on the pad's centre line under the arm. */
function preacherPad(along: number): readonly [number, number] {
  const a = chainRad(PREACHER_UPPER_ARM), under = CANONICAL_BODY_PARAMETERS.lw * 0.88 / 2 + 2;
  return [
    PREACHER_SHOULDER[0] + Math.cos(a) * along + Math.sin(a) * under,
    PREACHER_SHOULDER[1] + Math.sin(a) * along - Math.cos(a) * under,
  ];
}
/** External Rotation with Cable: the cable at elbow height on the far side, so the near hand is the one farther from it. */
export const EXTERNAL_ROTATION_ANCHOR: readonly [number, number, number] = [0, CHAIN_FRONT_SHOULDER - RAISE_UPPER_ARM, -40];
/** Shotgun Row: a wide split stance leaning forward, the far leg in front, and the low pulley beyond it. */
const SHOTGUN_HIP: readonly [number, number] = [40, 38];
export const SHOTGUN_TRUNK = 45;
const SHOTGUN_SHOULDER = chainNeckOf(SHOTGUN_HIP, SHOTGUN_TRUNK);
export const SHOTGUN_PULLEY: readonly [number, number] = [92, 12];
const SHOTGUN_FRONT_FOOT: readonly [number, number] = [62, CHAIN_ANKLE_HEIGHT];
const SHOTGUN_BACK_FOOT: readonly [number, number] = [16, CHAIN_ANKLE_HEIGHT];
/** The straight arm reaching down the line to the pulley, and the hand at the side of the lower ribs. */
const SHOTGUN_REACH: readonly [number, number] = (() => {
  const dx = SHOTGUN_PULLEY[0] - SHOTGUN_SHOULDER[0], dy = SHOTGUN_PULLEY[1] - SHOTGUN_SHOULDER[1], d = Math.hypot(dx, dy);
  return [SHOTGUN_SHOULDER[0] + dx / d * CHAIN_LONG_ARM, SHOTGUN_SHOULDER[1] + dy / d * CHAIN_LONG_ARM];
})();
export const SHOTGUN_RIBS = 13;
const SHOTGUN_FINISH = chainOnFront(SHOTGUN_HIP, SHOTGUN_TRUNK, SHOTGUN_RIBS, 2);
/** Kneeling High Pulley Row: kneeling tall facing a pulley well overhead, about half a metre in front. */
const KNEELING_ROW_HIP: readonly [number, number] = [0, CHAIN_KNEELING_KNEE + CHAIN_THIGH];
export const KNEELING_ROW_PULLEY: readonly [number, number] = [25, 98];
/** Incline Cable Chest Press: how far the bench is raised from level, and a low pulley either side, just behind the shoulders. */
export const INCLINE_PRESS_BENCH_DEG = 40;
const INCLINE_PRESS_HIP: readonly [number, number] = [10, CHAIN_SEATED_HIP];
export const INCLINE_PRESS_PULLEYS: readonly [ChainPoint, ChainPoint] = [[-14, 4, 32], [-14, 4, -32]];

/** Half the width of the shoulders and of the hips, as the 3D model places them. */
const CHAIN_SHOULDER_HALF = CANONICAL_BODY_PARAMETERS.sw * 0.92;
const CHAIN_HIP_HALF = CANONICAL_BODY_PARAMETERS.hw * 0.8;
/** The height of a hand resting on a surface: half a hand's thickness above it. */
const CHAIN_HAND_REST = CANONICAL_BODY_PARAMETERS.lw * 0.44 + 0.1;
/** Oblique Crunches: how far the shoulders turn toward the far knee, and the far hand's place out on the floor. */
export const OBLIQUE_CRUNCH_TWIST = 30;
export const OBLIQUE_CRUNCH_FAR_HAND: readonly [number, number, number] = [BENCH_CRUNCH_HIP[0] - 33, CHAIN_HAND_REST, -29];
/**
 * Bench Press - With Bands: lying on a flat bench, the band trapped under the
 * bench's head-end leg and a handle in each hand. At the bottom the upper
 * arms are level, this many degrees out from the sides, and the forearms upright.
 */
const BAND_PRESS_BENCH: readonly [number, number] = [16, 66];
const BAND_PRESS_HIP: readonly [number, number] = [62, CABLE_LYING_BENCH_TOP + CHAIN_BACK_HALF];
const BAND_PRESS_SHOULDER: readonly [number, number] = [BAND_PRESS_HIP[0] - CHAIN_TRUNK, BAND_PRESS_HIP[1]];
export const BAND_PRESS_ELBOW_OUT = 45;
/** Where the band comes out from under the head-end leg, either side of it. */
export const BAND_PRESS_ANCHORS: readonly [ChainPoint, ChainPoint] = [[BAND_PRESS_BENCH[0] + 5, 0.7, 4], [BAND_PRESS_BENCH[0] + 5, 0.7, -4]];
function bandPressHands(lowered: boolean): { wrist: ChainPoint; farWrist: ChainPoint } {
  const [x, y] = BAND_PRESS_SHOULDER;
  if (!lowered) return { wrist: [x, y + CHAIN_LONG_ARM, CHAIN_SHOULDER_HALF], farWrist: [x, y + CHAIN_LONG_ARM, -CHAIN_SHOULDER_HALF] };
  const out = SAGITTAL_UPPER_ARM * Math.sin(chainRad(BAND_PRESS_ELBOW_OUT)), down = SAGITTAL_UPPER_ARM * Math.cos(chainRad(BAND_PRESS_ELBOW_OUT));
  return {
    wrist: [x + down, y + SAGITTAL_FOREARM, CHAIN_SHOULDER_HALF + out],
    farWrist: [x + down, y + SAGITTAL_FOREARM, -CHAIN_SHOULDER_HALF - out],
  };
}
/**
 * Extended Range One-Arm Kettlebell Floor Press: lying on the floor, rolled
 * this far away from the pressing (near) side, so the near shoulder is off
 * the floor and its elbow can sink below the line of the chest.
 */
export const KB_PRESS_ROLL = 35;
const KB_PRESS_HIP: readonly [number, number] = [52, CHAIN_LYING_HEIGHT + 1.5];
/** The pressing shoulder, lifted by the roll. */
export const KB_PRESS_SHOULDER: readonly [number, number, number] = [
  KB_PRESS_HIP[0] - CHAIN_TRUNK,
  KB_PRESS_HIP[1] + CHAIN_SHOULDER_HALF * Math.sin(chainRad(KB_PRESS_ROLL)),
  CHAIN_SHOULDER_HALF * Math.cos(chainRad(KB_PRESS_ROLL)),
];
/** At the bottom the upper arm points out to the side and down past the chest, the forearm upright. */
const KB_PRESS_LOW_UPPER_ARM: readonly [number, number] = [-40, 50];
const KB_PRESS_LOW: ChainPoint = (() => {
  const a = chainRad(KB_PRESS_LOW_UPPER_ARM[0]), o = chainRad(KB_PRESS_LOW_UPPER_ARM[1]);
  return [
    KB_PRESS_SHOULDER[0] + SAGITTAL_UPPER_ARM * Math.cos(a) * Math.cos(o),
    KB_PRESS_SHOULDER[1] + SAGITTAL_UPPER_ARM * Math.sin(a) * Math.cos(o) + SAGITTAL_FOREARM,
    KB_PRESS_SHOULDER[2] + SAGITTAL_UPPER_ARM * Math.sin(o),
  ];
})();
const KB_PRESS_HIGH: ChainPoint = [KB_PRESS_SHOULDER[0], KB_PRESS_SHOULDER[1] + CHAIN_LONG_ARM, KB_PRESS_SHOULDER[2]];
/** The free hand out on the floor on the far side, and the near foot planted across the body. */
const KB_PRESS_FREE_HAND: ChainPoint = [KB_PRESS_HIP[0] - CHAIN_TRUNK + 4, CHAIN_HAND_REST, -31.8];
const KB_PRESS_FOOT: ChainPoint = [KB_PRESS_HIP[0] + 18, CHAIN_ANKLE_HEIGHT, -14];
/** The far leg lies straight along the floor from its own hip joint. */
const KB_PRESS_FAR_FOOT: ChainPoint = [
  KB_PRESS_HIP[0] + CHAIN_THIGH + CHAIN_SHIN - 0.02,
  KB_PRESS_HIP[1] - CHAIN_HIP_HALF * Math.sin(chainRad(KB_PRESS_ROLL)),
  -CHAIN_HIP_HALF * Math.cos(chainRad(KB_PRESS_ROLL)),
];
/** A kettlebell's round bell: where its centre sits from the grip, and its radius. */
export const KETTLEBELL_REST: readonly [number, number, number] = [-2.8, -3.6, 1.5];
export const KETTLEBELL_RADIUS = 4.6;
/**
 * External Rotation: lying on the far side on a flat bench, facing the
 * viewer, so the working (near) arm is the top one. The forearm turns from
 * level, pointing straight ahead, up to this many degrees short of upright.
 */
export const SIDE_LYING_BENCH_TOP = CABLE_LYING_BENCH_TOP;
const SIDE_LYING_HIP: readonly [number, number] = [40, SIDE_LYING_BENCH_TOP + CHAIN_SHOULDER_HALF + CANONICAL_BODY_PARAMETERS.lw * 0.44];
export const SIDE_LYING_SHORT_OF_UPRIGHT = 20;
/**
 * One-Arm Dumbbell Row: the far knee and far hand on a bench, the near foot on
 * the floor beside it and the trunk level. The hand hangs under the shoulder
 * and finishes beside the chest, this far back from the shoulder and below the spine.
 */
export const BENCH_ROW_TOP = 19;
const BENCH_ROW_HIP: readonly [number, number] = [34, BENCH_ROW_TOP + CHAIN_THIGH_HALF + CHAIN_THIGH];
const BENCH_ROW_SHOULDER: readonly [number, number] = [BENCH_ROW_HIP[0] + CHAIN_TRUNK, BENCH_ROW_HIP[1]];
export const BENCH_ROW_FINISH: readonly [number, number] = [5, 5];
/** The far shin lies along the bench behind its knee. */
const BENCH_ROW_FAR_ANKLE: readonly [number, number] = [BENCH_ROW_HIP[0] - CHAIN_SHIN, BENCH_ROW_TOP + CHAIN_THIGH_HALF];

/** The chain movements, by slug. */
export const CHAIN_MOVEMENTS: Record<string, ChainMovement> = {
  // Incline Dumbbell Curl: sitting back on an incline bench, the upper arms
  // hang straight down and stay there while the forearms curl.
  'incline-dumbbell-curl': {
    root: 'hip',
    implement: 'bells',
    equipment: chainInclineBench(INCLINE_CURL_HIP, 120),
    poses: [
      { at: INCLINE_CURL_HIP, trunk: 120, thigh: 0, shin: -90, upperArm: -90, forearm: -90 },
      { at: INCLINE_CURL_HIP, trunk: 120, thigh: 0, shin: -90, upperArm: -90, forearm: 55 },
    ],
  },
  // Incline Hammer Curls: the same seat, palms facing in throughout, so each
  // bell is seen along its length and stays square to the forearm.
  'incline-hammer-curls': {
    root: 'hip',
    implement: 'hammer',
    equipment: chainInclineBench(INCLINE_CURL_HIP, 120),
    poses: [
      { at: INCLINE_CURL_HIP, trunk: 120, thigh: 0, shin: -90, upperArm: -90, forearm: -90 },
      { at: INCLINE_CURL_HIP, trunk: 120, thigh: 0, shin: -90, upperArm: -90, forearm: 45 },
    ],
  },
  // Front Incline Dumbbell Raise: reclined at 45 degrees, head on the bench,
  // locked arms lift from just above the thighs to slightly above the shoulders.
  'front-incline-dumbbell-raise': {
    root: 'hip',
    implement: 'bells',
    equipment: chainInclineBench(FRONT_INCLINE_RAISE_HIP, 135),
    poses: [
      { at: FRONT_INCLINE_RAISE_HIP, trunk: 135, thigh: 0, shin: -90, upperArm: -25, forearm: -25 },
      { at: FRONT_INCLINE_RAISE_HIP, trunk: 135, thigh: 0, shin: -90, upperArm: 8, forearm: 8 },
    ],
  },
  // Cable Incline Triceps Extension: lying back facing away from a high
  // pulley, the upper arms stay up beside the head while the elbows straighten.
  // The pulley sits where the forearm points at the start, so the cable only
  // ever lengthens as the arms extend.
  'cable-incline-triceps-extension': {
    root: 'hip',
    implement: 'cableBar',
    lines: [{ from: INCLINE_EXTENSION_PULLEY, to: 'nearGrip' }],
    equipment: [
      { kind: 'frame', a: [INCLINE_EXTENSION_PULLEY[0], 0.5], b: [INCLINE_EXTENSION_PULLEY[0], 82] },
      { kind: 'pulley', at: INCLINE_EXTENSION_PULLEY },
      ...chainInclineBench(INCLINE_EXTENSION_HIP, 125),
    ],
    poses: [
      { at: INCLINE_EXTENSION_HIP, trunk: 125, thigh: 0, shin: -90, upperArm: 60, forearm: 150 },
      { at: INCLINE_EXTENSION_HIP, trunk: 125, thigh: 0, shin: -90, upperArm: 60, forearm: 60 },
    ],
  },
  // Decline Dumbbell Triceps Extension: lying back on a decline bench with
  // the legs secured, the upper arms point up from the lying chest and stay
  // there while the elbows bend to bring the dumbbells down beside the ears.
  'decline-dumbbell-triceps-extension': {
    root: 'hip',
    feet: 'free',
    implement: 'hammer',
    equipment: chainDeclineBench(DECLINE_EXTENSION_HIP, DECLINE_EXTENSION_DEG, DECLINE_EXTENSION_ANKLE),
    poses: [
      { ...DECLINE_EXTENSION_BODY, upperArm: 105, forearm: 105 },
      { ...DECLINE_EXTENSION_BODY, upperArm: 105, forearm: 240 },
    ],
  },
  // Decline EZ Bar Triceps Extension: the same bench, one bar, and a shorter
  // bend that stops with the bar just above the forehead.
  'decline-ez-bar-triceps-extension': {
    root: 'hip',
    feet: 'free',
    implement: 'ez',
    equipment: chainDeclineBench(DECLINE_EXTENSION_HIP, DECLINE_EXTENSION_DEG, DECLINE_EXTENSION_ANKLE),
    poses: [
      { ...DECLINE_EXTENSION_BODY, upperArm: 105, forearm: 105 },
      { ...DECLINE_EXTENSION_BODY, upperArm: 105, forearm: 225 },
    ],
  },
  // Cable Lying Triceps Extension: flat bench, head toward a low pulley, the
  // bar lowered from straight arms to just above the forehead and pressed back.
  'cable-lying-triceps-extension': {
    root: 'hip',
    implement: 'cableBar',
    lines: [{ from: CABLE_LYING_EXTENSION_PULLEY, to: 'nearGrip' }],
    equipment: [
      { kind: 'frame', a: [CABLE_LYING_EXTENSION_PULLEY[0], 0.5], b: [CABLE_LYING_EXTENSION_PULLEY[0], 20] },
      { kind: 'pulley', at: CABLE_LYING_EXTENSION_PULLEY },
      ...chainFlatBench(20, 66, CABLE_LYING_BENCH_TOP),
    ],
    poses: [
      { at: [62, CABLE_LYING_BENCH_TOP + CHAIN_BACK_HALF], trunk: 180, thigh: 0, shin: -90, ankle: [84, CHAIN_ANKLE_HEIGHT], upperArm: 90, forearm: 90 },
      { at: [62, CABLE_LYING_BENCH_TOP + CHAIN_BACK_HALF], trunk: 180, thigh: 0, shin: -90, ankle: [84, CHAIN_ANKLE_HEIGHT], upperArm: 90, forearm: 200 },
    ],
  },
  // Low Cable Triceps Extension: face up on the low bench of a row station,
  // head toward the pulley, a rope in the hands; the forearms go from level to
  // vertical and back, and no further.
  'low-cable-triceps-extension': {
    root: 'hip',
    implement: 'rope',
    lines: [{ from: LOW_CABLE_EXTENSION_PULLEY, to: 'nearGrip' }],
    equipment: [
      { kind: 'frame', a: [LOW_CABLE_EXTENSION_PULLEY[0], 0.5], b: [LOW_CABLE_EXTENSION_PULLEY[0], 22] },
      { kind: 'pulley', at: LOW_CABLE_EXTENSION_PULLEY },
      ...chainFlatBench(18, 64, LOW_CABLE_BENCH_TOP),
    ],
    poses: [
      { at: [60, LOW_CABLE_BENCH_TOP + CHAIN_BACK_HALF], trunk: 180, thigh: 0, shin: -90, ankle: [84, CHAIN_ANKLE_HEIGHT], upperArm: 90, forearm: 180 },
      { at: [60, LOW_CABLE_BENCH_TOP + CHAIN_BACK_HALF], trunk: 180, thigh: 0, shin: -90, ankle: [84, CHAIN_ANKLE_HEIGHT], upperArm: 90, forearm: 90 },
    ],
  },
  // Spider Curl: chest and stomach against the angled side of a preacher
  // pad, feet on the floor, upper arms lying down its far side; only the
  // forearms move.
  'spider-curl': {
    root: 'hip',
    implement: 'bar',
    equipment: [
      { kind: 'post', at: [spiderCurlPad().angled[0][0] + 6, spiderCurlPad().angled[0][1] + 2] },
      { kind: 'slab', a: spiderCurlPad().rest[0], b: spiderCurlPad().rest[1] },
      { kind: 'slab', a: spiderCurlPad().angled[0], b: spiderCurlPad().angled[1] },
    ],
    poses: [
      { ...SPIDER_CURL_BODY, upperArm: SPIDER_CURL_UPPER_ARM, forearm: SPIDER_CURL_UPPER_ARM },
      { ...SPIDER_CURL_BODY, upperArm: SPIDER_CURL_UPPER_ARM, forearm: 60 },
    ],
  },
  // Concentration Curls: seated with the feet wide, the back of the working
  // upper arm against the inner thigh, the free hand on the other knee. At the
  // top the wrist keeps turning: little finger toward the same-side ear.
  'concentration-curls': {
    root: 'hip',
    supinatedPeak: true,
    view: 'oblique',
    yawDeg: 72,
    originX: 44,
    implement: 'bell',
    elbowPole: [180, 70],
    equipment: [
      { kind: 'post', at: [-24, CHAIN_SEATED_HIP - CHAIN_THIGH_HALF - 4] },
      { kind: 'post', at: [0, CHAIN_SEATED_HIP - CHAIN_THIGH_HALF - 4] },
      { kind: 'slab', a: [-29, CHAIN_SEATED_HIP - CHAIN_THIGH_HALF - 2], b: [5, CHAIN_SEATED_HIP - CHAIN_THIGH_HALF - 2] },
    ],
    poses: [
      { ...CONCENTRATION_BODY, forearm: [-90, 20] },
      { ...CONCENTRATION_BODY, forearm: [60, -15] },
    ],
  },
  // Seated Dumbbell Palms-Down Wrist Curl: forearms flat on the thighs, the
  // backs of the hands lifting; only the hands move.
  'seated-dumbbell-palms-down-wrist-curl': {
    root: 'hip',
    implement: 'bells',
    palm: 'down',
    equipment: WRIST_CURL_BENCH,
    poses: [
      { ...WRIST_CURL_BODY, hand: -45 },
      { ...WRIST_CURL_BODY, hand: 30 },
    ],
  },
  // Seated Dumbbell Palms-Up Wrist Curl: the same seat, palms up, a longer curl.
  'seated-dumbbell-palms-up-wrist-curl': {
    root: 'hip',
    implement: 'bells',
    palm: 'up',
    equipment: WRIST_CURL_BENCH,
    poses: [
      { ...WRIST_CURL_BODY, hand: -35 },
      { ...WRIST_CURL_BODY, hand: 50 },
    ],
  },
  // Cable Wrist Curl: the same seat facing a low pulley, one bar in both
  // hands, palms up. The pulley sits below the line of the dropped hands, so
  // the cable only lengthens as the wrists curl.
  'cable-wrist-curl': {
    root: 'hip',
    implement: 'cableBar',
    palm: 'up',
    lines: [{ from: CABLE_WRIST_CURL_PULLEY, to: 'nearGrip' }],
    equipment: [
      { kind: 'frame', a: [CABLE_WRIST_CURL_PULLEY[0], 0.5], b: [CABLE_WRIST_CURL_PULLEY[0], 16] },
      { kind: 'pulley', at: CABLE_WRIST_CURL_PULLEY },
      ...WRIST_CURL_BENCH,
    ],
    poses: [
      { ...WRIST_CURL_BODY, hand: -35 },
      { ...WRIST_CURL_BODY, hand: 50 },
    ],
  },
  // Sit-Up: knees bent, feet flat, hands crossed on the chest. The spine peels
  // off the floor from the top down, then the whole curled trunk comes up
  // until the chest meets the thighs, and it rolls back down the same way.
  'sit-up': {
    root: 'hip',
    kneePole: 90,
    armsFollowTrunk: true,
    poses: [
      { at: [50, CHAIN_LYING_HEIGHT], trunk: 180, curl: 0, thigh: 50, shin: -50, ankle: [77, CHAIN_ANKLE_HEIGHT], upperArm: -70, forearm: 92 },
      { at: [50, CHAIN_LYING_HEIGHT], trunk: 180, curl: 60, thigh: 50, shin: -50, ankle: [77, CHAIN_ANKLE_HEIGHT], upperArm: -70, forearm: 92 },
      { at: [50, CHAIN_LYING_HEIGHT], trunk: 97, curl: 64, thigh: 50, shin: -50, ankle: [77, CHAIN_ANKLE_HEIGHT], upperArm: -70, forearm: 92 },
    ],
  },
  // Tuck Crunch: hips and knees bent, arms reaching toward the feet; the
  // shoulders curl up while the knees travel a little toward the chest.
  'tuck-crunch': {
    root: 'hip',
    spine: 'upper',
    feet: 'free',
    poses: [
      { at: [48, CHAIN_LYING_HEIGHT], trunk: 180, curl: 0, thigh: 90, shin: 0, foot: 80, upperArm: 4, forearm: 4 },
      { at: [48, CHAIN_LYING_HEIGHT], trunk: 180, curl: 48, thigh: 106, shin: 12, foot: 92, upperArm: 10, forearm: 6 },
    ],
  },
  // Reverse Crunch: knees bent over the hips, hands flat beside the body. The
  // lower spine curls so the pelvis rolls up; the legs ride with it and keep
  // their shape, and the feet never come down.
  'reverse-crunch': {
    root: 'neck',
    trunkAt: 'neck',
    spine: 'lower',
    feet: 'free',
    poses: [
      { at: [22, CHAIN_LYING_HEIGHT], trunk: 180, curl: 0, thigh: 90, shin: 0, foot: 80, ...ARMS_BESIDE },
      { at: [22, CHAIN_LYING_HEIGHT], trunk: 180, curl: 50, thigh: 140, shin: 50, foot: 130, ...ARMS_BESIDE },
    ],
  },
  // Cable Reverse Crunch: the same roll against a low cable cuffed to the
  // ankles, lying with the head away from the stack.
  'cable-reverse-crunch': {
    root: 'neck',
    trunkAt: 'neck',
    spine: 'lower',
    feet: 'free',
    lines: [{ from: CABLE_REVERSE_CRUNCH_PULLEY, to: 'nearAnkle' }],
    equipment: [
      { kind: 'frame', a: [CABLE_REVERSE_CRUNCH_PULLEY[0], 0.5], b: [CABLE_REVERSE_CRUNCH_PULLEY[0], 18] },
      { kind: 'pulley', at: CABLE_REVERSE_CRUNCH_PULLEY },
    ],
    poses: [
      { at: [18, CHAIN_LYING_HEIGHT], trunk: 180, curl: 0, thigh: 90, shin: 0, foot: 80, ...ARMS_BESIDE },
      { at: [18, CHAIN_LYING_HEIGHT], trunk: 180, curl: 12, thigh: 102, shin: 12, foot: 92, ...ARMS_BESIDE },
      { at: [18, CHAIN_LYING_HEIGHT], trunk: 180, curl: 42, thigh: 134, shin: 44, foot: 124, ...ARMS_BESIDE },
    ],
  },
  // Bent-Knee Hip Raise: from legs held low with the knees bent 75 degrees,
  // the knees are drawn toward the chest at that same knee angle, then the
  // pelvis rolls back and the hips leave the floor.
  'bent-knee-hip-raise': {
    root: 'neck',
    trunkAt: 'neck',
    spine: 'lower',
    feet: 'free',
    poses: [
      { at: [20, CHAIN_LYING_HEIGHT], trunk: 180, curl: 0, thigh: 35, shin: -40, foot: 40, ...ARMS_BESIDE },
      { at: [20, CHAIN_LYING_HEIGHT], trunk: 180, curl: 0, thigh: 105, shin: 30, foot: 110, ...ARMS_BESIDE },
      { at: [20, CHAIN_LYING_HEIGHT], trunk: 180, curl: 40, thigh: 145, shin: 70, foot: 150, ...ARMS_BESIDE },
    ],
  },
  // Decline Reverse Crunch: head at the high end of a decline bench, hands on
  // the top of it; the legs start level with the floor, the knees come toward
  // the chest and the pelvis rolls so the hips lift off the bench.
  'decline-reverse-crunch': {
    root: 'neck',
    trunkAt: 'neck',
    spine: 'lower',
    feet: 'free',
    elbowPole: 90,
    nearArmOverHead: true,
    equipment: declineReverseCrunchBench(),
    poses: [
      { at: DECLINE_REVERSE_CRUNCH_NECK, trunk: 180 - DECLINE_REVERSE_CRUNCH_DEG, curl: 0, thigh: 8, shin: -8, foot: 75, upperArm: 150, forearm: 175, wrist: DECLINE_REVERSE_CRUNCH_GRIP },
      { at: DECLINE_REVERSE_CRUNCH_NECK, trunk: 180 - DECLINE_REVERSE_CRUNCH_DEG, curl: 0, thigh: 95, shin: 10, foot: 95, upperArm: 150, forearm: 175, wrist: DECLINE_REVERSE_CRUNCH_GRIP },
      { at: DECLINE_REVERSE_CRUNCH_NECK, trunk: 180 - DECLINE_REVERSE_CRUNCH_DEG, curl: 40, thigh: 135, shin: 50, foot: 135, upperArm: 150, forearm: 175, wrist: DECLINE_REVERSE_CRUNCH_GRIP },
    ],
  },
  // Standing Rope Crunch: back to a high pulley, rope ends over the shoulders
  // at the upper chest. The hips do not move; the spine curls the trunk down.
  'standing-rope-crunch': {
    root: 'hip',
    implement: 'rope',
    armsFollowTrunk: true,
    lines: [{ from: STANDING_ROPE_CRUNCH_PULLEY, to: 'nearGrip' }],
    equipment: [
      { kind: 'frame', a: [STANDING_ROPE_CRUNCH_PULLEY[0], 0.5], b: [STANDING_ROPE_CRUNCH_PULLEY[0], 94] },
      { kind: 'pulley', at: STANDING_ROPE_CRUNCH_PULLEY },
    ],
    poses: [
      { at: [50, CHAIN_STANDING_HIP], trunk: 90, curl: 0, thigh: -90, shin: -90, upperArm: -80, forearm: 78 },
      { at: [50, CHAIN_STANDING_HIP], trunk: 90, curl: 70, thigh: -90, shin: -90, upperArm: -80, forearm: 78 },
    ],
  },
  // Kneeling Cable Crunch With Alternating Oblique Twists: kneeling facing a
  // high pulley, leaning toward it, rope ends beside the ears. The pulley is
  // high and only a short step in front, so the cable only lengthens as the
  // hands come down. The trunk curls down until the
  // elbows reach the knees; on the oblique repetitions the shoulders turn as
  // it goes down, so one elbow travels toward the opposite knee.
  'kneeling-cable-crunch-with-alternating-oblique-twists': {
    root: 'hip',
    feet: 'free',
    implement: 'rope',
    armsFollowTrunk: true,
    turnWithPhase: true,
    lines: [{ from: KNEELING_CRUNCH_PULLEY, to: 'nearGrip' }],
    equipment: [
      { kind: 'frame', a: [KNEELING_CRUNCH_PULLEY[0], 0.5], b: [KNEELING_CRUNCH_PULLEY[0], 99] },
      { kind: 'pulley', at: KNEELING_CRUNCH_PULLEY },
    ],
    poses: [
      { at: [40, CHAIN_KNEELING_KNEE + CHAIN_THIGH * Math.sin(chainRad(50))], trunk: 62, curl: 0, thigh: -50, shin: 180, foot: 180, ...HANDS_BY_EARS },
      { at: [40, CHAIN_KNEELING_KNEE + CHAIN_THIGH * Math.sin(chainRad(50))], trunk: 45, curl: 95, thigh: -50, shin: 180, foot: 180, ...HANDS_BY_EARS },
    ],
  },
  // Decline Oblique Crunch: legs secured on a decline bench, torso partway
  // down, one hand beside the head and the other on the thigh. The trunk curls
  // up while it turns, so the raised elbow travels toward the opposite knee.
  'decline-oblique-crunch': {
    root: 'hip',
    feet: 'free',
    nearArmOverHead: true,
    equipment: chainDeclineBench(DECLINE_EXTENSION_HIP, DECLINE_EXTENSION_DEG, DECLINE_EXTENSION_ANKLE),
    poses: [
      { ...DECLINE_OBLIQUE_LEGS, trunk: 142, curl: 10, twist: 0, upperArm: 77, forearm: 210, farUpperArm: -30, farForearm: -20 },
      { ...DECLINE_OBLIQUE_LEGS, trunk: 112, curl: 45, twist: 32, upperArm: 12, forearm: 145, farUpperArm: -70, farForearm: -40 },
    ],
  },
  // Cable Russian Twists: upper back on a stability ball, hips raised, both
  // hands on one handle above the chest, side-on to a mid-height pulley. The
  // shoulders roll a quarter turn away from the pulley; the straight arms go
  // with them, and the hips stay up.
  'cable-russian-twists': {
    root: 'hip',
    view: 'oblique',
    yawDeg: -50,
    originX: 46,
    implement: 'handle',
    lines: [{ from: RUSSIAN_TWIST_PULLEY, to: 'nearGrip' }],
    equipment: [
      { kind: 'frame', a: [RUSSIAN_TWIST_PULLEY[0], 0.5, RUSSIAN_TWIST_PULLEY[2]], b: [RUSSIAN_TWIST_PULLEY[0], 62, RUSSIAN_TWIST_PULLEY[2]] },
      { kind: 'pulley', at: RUSSIAN_TWIST_PULLEY },
      { kind: 'ball', at: RUSSIAN_TWIST_BALL.at, r: RUSSIAN_TWIST_BALL.r },
    ],
    poses: [
      {
        at: [24, CHAIN_SEATED_HIP], trunk: 172, head: 180, thigh: [0, 12], shin: -90, twist: 0,
        upperArm: [90, RUSSIAN_TWIST_ARM_IN], forearm: [90, RUSSIAN_TWIST_ARM_IN],
        farUpperArm: [90, RUSSIAN_TWIST_ARM_IN], farForearm: [90, RUSSIAN_TWIST_ARM_IN],
      },
      {
        at: [24, CHAIN_SEATED_HIP], trunk: 172, head: 180, thigh: [0, 12], shin: -90, twist: -90,
        upperArm: [90, RUSSIAN_TWIST_ARM_IN + 90], forearm: [90, RUSSIAN_TWIST_ARM_IN + 90],
        farUpperArm: [90, RUSSIAN_TWIST_ARM_IN - 90], farForearm: [90, RUSSIAN_TWIST_ARM_IN - 90],
      },
    ],
  },
  // One-Arm High-Pulley Cable Side Bends: seen from the front, side-on to a
  // high pulley. The working elbow is at the side with the handle by the
  // shoulder, the free hand on the hip; the trunk bends toward the cable and
  // the arms go with it.
  'one-arm-high-pulley-cable-side-bends': {
    root: 'hip',
    view: 'front',
    feet: 'front',
    implement: 'handle',
    farArmOver: true,
    lines: [{ from: SIDE_BEND_PULLEY, to: 'nearGrip' }],
    equipment: [
      { kind: 'frame', a: [0, 0.5, SIDE_BEND_PULLEY[2]], b: [0, 94, SIDE_BEND_PULLEY[2]] },
      { kind: 'pulley', at: SIDE_BEND_PULLEY },
    ],
    poses: [
      {
        at: [0, CHAIN_FRONT_HIP], trunk: 90, sideCurl: 0, thigh: -90, shin: -90,
        upperArm: [-90, 5], forearm: [90, 15], farUpperArm: [-90, 28], farForearm: [-90, -35],
      },
      {
        at: [0, CHAIN_FRONT_HIP], trunk: 90, sideCurl: SIDE_BEND_DEG, thigh: -90, shin: -90,
        upperArm: [-90, 5 - SIDE_BEND_DEG], forearm: [90, 15 + SIDE_BEND_DEG],
        farUpperArm: [-90, 28 + SIDE_BEND_DEG], farForearm: [-90, -35 + SIDE_BEND_DEG],
      },
    ],
  },
  // Floor Back Extension: face down, arms reaching ahead. The spine arches a
  // little so the chest and arms come a few inches off the floor, and the long
  // legs lift a few inches from the hips; the pelvis stays down.
  'floor-back-extension': {
    root: 'hip',
    feet: 'free',
    poses: [
      { at: [50, CHAIN_LYING_HEIGHT], trunk: 0, curl: 0, head: 0, thigh: PRONE_THIGH, shin: PRONE_SHIN, foot: 180, upperArm: PRONE_ARM, forearm: PRONE_ARM },
      {
        at: [50, CHAIN_LYING_HEIGHT], trunk: 0, curl: -BACK_EXTENSION_ARCH, head: 10,
        thigh: PRONE_THIGH - BACK_EXTENSION_LEG_LIFT, shin: PRONE_SHIN - 2, foot: 180, upperArm: -2, forearm: -2,
      },
    ],
  },
  // Bench Dip: hands on the edge of a bench behind, knees bent, feet flat. The
  // hips travel straight down and up just in front of the bench while the
  // elbows bend straight back.
  'bench-dip': {
    root: 'hip',
    elbowPole: 180,
    kneePole: 90,
    equipment: chainFlatBench(BENCH_DIP_BENCH.edge - 28, BENCH_DIP_BENCH.edge, BENCH_DIP_BENCH.top),
    poses: [
      { at: [BENCH_DIP_BENCH.edge + 6, 23.5], trunk: 99, thigh: 30, shin: -60, ankle: BENCH_DIP_FEET, upperArm: -90, forearm: -90, wrist: BENCH_DIP_GRIP },
      { at: [BENCH_DIP_BENCH.edge + 6.3, 16.5], trunk: 99, thigh: 30, shin: -60, ankle: BENCH_DIP_FEET, upperArm: -90, forearm: -90, wrist: BENCH_DIP_GRIP },
    ],
  },
  // Decline Push-Up: feet up on a bench, hands on the floor. The body is one
  // line that pivots about the feet as the elbows bend.
  'decline-push-up': {
    root: 'ankle',
    feet: 'free',
    elbowPole: 150,
    equipment: chainFlatBench(2, 25, DECLINE_PUSH_UP_BENCH_TOP),
    poses: [plankAt(-1.2), plankAt(-14)],
  },
  // Road Run: an in-place stride. Six positions per leg, the two legs half a
  // stride apart, at an even pace.
  'road-run': {
    root: 'hip',
    feet: 'free',
    cycle: true,
    poses: RUN_POSES,
  },
  // Upright Barbell Row: seen from the front. The hands travel straight up
  // the front of the body from the thighs toward the chin, and the elbows are
  // solved up and out to the sides, finishing higher than the hands.
  'upright-barbell-row': {
    root: 'hip',
    view: 'front',
    feet: 'front',
    implement: 'bar',
    farArmOver: true,
    elbowPole: [90, 65],
    poses: [uprightRowPose('upright-barbell-row', 'bottom'), uprightRowPose('upright-barbell-row', 'top')],
  },
  // Upright Row - With Bands: the same lift with a band under the feet and an
  // end in each hand, the hands a little wider and finishing a little lower.
  'upright-row-with-bands': {
    root: 'hip',
    view: 'front',
    feet: 'front',
    implement: 'handles',
    farArmOver: true,
    elbowPole: [90, 65],
    lines: [{ from: 'nearFoot', to: 'nearGrip' }, { from: 'farFoot', to: 'farGrip' }],
    poses: [uprightRowPose('upright-row-with-bands', 'bottom'), uprightRowPose('upright-row-with-bands', 'top')],
  },
  // Barbell Side Split Squat: seen from the front, feet planted wide, the bar
  // across the back of the shoulders. The hips travel down and toward the
  // lead foot: the lead knee bends forward over it, the trailing leg stays long.
  'barbell-side-split-squat': {
    root: 'hip',
    view: 'front',
    feet: 'front',
    implement: 'bar',
    kneePole: [0, 15],
    poses: [sideSplitSquatPose(SIDE_SPLIT_SQUAT.tall), sideSplitSquatPose(SIDE_SPLIT_SQUAT.low)],
  },
  // Cable Seated Lateral Raise: on the end of a bench between two low
  // pulleys, leaning forward with a flat back, each hand holding the opposite
  // pulley's handle. The arms raise out to the sides with one fixed elbow bend.
  'cable-seated-lateral-raise': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 65,
    originX: 46,
    implement: 'handles',
    lines: [
      { from: SEATED_CABLE_RAISE_PULLEYS[1], to: 'nearGrip' },
      { from: SEATED_CABLE_RAISE_PULLEYS[0], to: 'farGrip' },
    ],
    equipment: [
      { kind: 'pulley', at: SEATED_CABLE_RAISE_PULLEYS[0] },
      { kind: 'pulley', at: SEATED_CABLE_RAISE_PULLEYS[1] },
      { kind: 'post', at: [-24, CHAIN_SEATED_HIP - CHAIN_THIGH_HALF - 4] },
      { kind: 'post', at: [0, CHAIN_SEATED_HIP - CHAIN_THIGH_HALF - 4] },
      { kind: 'slab', a: [-29, CHAIN_SEATED_HIP - CHAIN_THIGH_HALF - 2], b: [5, CHAIN_SEATED_HIP - CHAIN_THIGH_HALF - 2] },
    ],
    poses: [
      {
        at: [0, CHAIN_SEATED_HIP], trunk: SEATED_CABLE_RAISE_LEAN, head: 12, thigh: [0, 10], shin: -90,
        upperArm: [-90, 4], forearm: [-90, 4 - SIDE_RAISE_ELBOW_BEND['cable-seated-lateral-raise']],
      },
      {
        at: [0, CHAIN_SEATED_HIP], trunk: SEATED_CABLE_RAISE_LEAN, head: 12, thigh: [0, 10], shin: -90,
        upperArm: [-90, 90], forearm: [-90, 90 - SIDE_RAISE_ELBOW_BEND['cable-seated-lateral-raise']],
      },
    ],
  },
  // Reverse Flyes: chest down on an incline bench, feet on the floor. The arms
  // start hanging square to the bench and sweep out and apart, with one slight
  // elbow bend, until they are parallel to the floor.
  'reverse-flyes': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 40,
    originX: 14,
    implement: 'bells',
    bellAxis: [Math.cos(chainRad(REVERSE_FLYE_INCLINE)), Math.sin(chainRad(REVERSE_FLYE_INCLINE)), 0],
    kneePole: 0,
    equipment: reverseFlyeBench(),
    poses: [
      {
        at: REVERSE_FLYE_HIP, trunk: REVERSE_FLYE_INCLINE, thigh: -110, shin: -110, ankle: [18, CHAIN_ANKLE_HEIGHT],
        upperArm: [REVERSE_FLYE_INCLINE - 90, 6], forearm: [REVERSE_FLYE_INCLINE - 90, 6 - SIDE_RAISE_ELBOW_BEND['reverse-flyes']],
      },
      {
        at: REVERSE_FLYE_HIP, trunk: REVERSE_FLYE_INCLINE, thigh: -110, shin: -110, ankle: [18, CHAIN_ANKLE_HEIGHT],
        upperArm: [REVERSE_FLYE_INCLINE - 90, 90], forearm: [REVERSE_FLYE_INCLINE - 90, 90 - SIDE_RAISE_ELBOW_BEND['reverse-flyes']],
      },
    ],
  },
  // Back Flyes - With Bands: standing, a band looped round a rack upright in
  // front at shoulder height, an end in each hand. The straight arms stay
  // level and open from in front of the shoulders to out at the sides.
  'back-flyes-with-bands': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 32,
    // The whole movement is in one level plane at shoulder height, so the view looks down a little.
    pitchDeg: 18,
    originX: 30,
    implement: 'handles',
    lines: [{ from: BACK_FLYE_ANCHOR, to: 'nearGrip' }, { from: BACK_FLYE_ANCHOR, to: 'farGrip' }],
    equipment: [
      { kind: 'frame', a: [BACK_FLYE_ANCHOR[0], 0.5], b: [BACK_FLYE_ANCHOR[0], 92] },
      { kind: 'frame', a: [BACK_FLYE_ANCHOR[0] - 8, 1.2], b: [BACK_FLYE_ANCHOR[0] + 8, 1.2] },
    ],
    poses: [
      { at: [0, CHAIN_STANDING_HIP], trunk: 90, thigh: -90, shin: -90, upperArm: [0, 0], forearm: [0, 0] },
      { at: [0, CHAIN_STANDING_HIP], trunk: 90, thigh: -90, shin: -90, upperArm: [0, 90], forearm: [0, 90] },
    ],
  },
  // Cable Seated Crunch: sitting on a flat bench with the back to a high
  // pulley, rope ends over the shoulders at the upper chest; the hips stay put
  // and the spine curls the trunk forward.
  'cable-seated-crunch': {
    root: 'hip',
    implement: 'rope',
    armsFollowTrunk: true,
    lines: [{ from: SEATED_CRUNCH_PULLEY, to: 'nearGrip' }],
    equipment: [
      { kind: 'frame', a: [SEATED_CRUNCH_PULLEY[0], 0.5], b: [SEATED_CRUNCH_PULLEY[0], 90] },
      { kind: 'pulley', at: SEATED_CRUNCH_PULLEY },
      ...chainFlatBench(SEATED_CRUNCH_HIP[0] - 17, SEATED_CRUNCH_HIP[0] + 7, CHAIN_SEATED_HIP - CHAIN_THIGH_HALF),
    ],
    poses: [
      { at: SEATED_CRUNCH_HIP, trunk: 90, curl: 0, thigh: 0, shin: -90, upperArm: -80, forearm: 78 },
      // The arms are given relative to the chest. Curled, the elbows hang down toward the lap.
      { at: SEATED_CRUNCH_HIP, trunk: 90, curl: 65, thigh: 0, shin: -90, upperArm: -40, forearm: 133 },
    ],
  },
  // Cable Crunch: kneeling facing a high pulley, rope at the collarbones. The
  // hips are frozen and only the upper spine rounds, taking the elbows toward
  // the thighs.
  'cable-crunch': {
    root: 'hip',
    spine: 'upper',
    feet: 'free',
    implement: 'rope',
    armsFollowTrunk: true,
    lines: [{ from: CABLE_CRUNCH_PULLEY, to: 'nearGrip' }],
    equipment: [
      { kind: 'frame', a: [CABLE_CRUNCH_PULLEY[0], 0.5], b: [CABLE_CRUNCH_PULLEY[0], 99] },
      { kind: 'pulley', at: CABLE_CRUNCH_PULLEY },
    ],
    poses: [
      { at: CABLE_CRUNCH_HIP, trunk: 68, curl: 0, thigh: CABLE_CRUNCH_THIGH, shin: 180, foot: 180, upperArm: -75, forearm: 95 },
      // The arms are given relative to the chest. Rounded over, the elbows point down at the thighs.
      { at: CABLE_CRUNCH_HIP, trunk: 68, curl: 85, thigh: CABLE_CRUNCH_THIGH, shin: 180, foot: 180, upperArm: -13, forearm: 177 },
    ],
  },
  // Cross-Body Crunch: knees bent, feet flat, hands by the head. The middle
  // pose is lying down; either side of it the upper spine curls and turns so
  // one shoulder leads across while the opposite knee comes in to meet it.
  'cross-body-crunch': {
    root: 'hip',
    spine: 'upper',
    feet: 'free',
    kneePole: 90,
    armsFollowTrunk: true,
    poses: [
      { at: FLOOR_CRUNCH_HIP, trunk: 180, curl: 48, twist: 30, thigh: 50, shin: -50, ankle: FLOOR_CRUNCH_FOOT, farAnkle: [64, 20], foot: 0, farFoot: -30, ...HANDS_BY_EARS },
      { at: FLOOR_CRUNCH_HIP, trunk: 180, curl: 0, twist: 0, thigh: 50, shin: -50, ankle: FLOOR_CRUNCH_FOOT, farAnkle: FLOOR_CRUNCH_FOOT, foot: 0, farFoot: 0, ...HANDS_BY_EARS },
      { at: FLOOR_CRUNCH_HIP, trunk: 180, curl: 48, twist: -30, thigh: 50, shin: -50, ankle: [64, 20], farAnkle: FLOOR_CRUNCH_FOOT, foot: -30, farFoot: 0, ...HANDS_BY_EARS },
    ],
  },
  // Janda Sit-Up: knees bent to a right angle, feet flat, arms resting at the
  // sides. The spine peels off the floor and the curled trunk comes up, slowly,
  // and goes down the same way in the same time.
  'janda-sit-up': {
    root: 'hip',
    kneePole: 90,
    poses: [
      { at: JANDA_HIP, trunk: 180, curl: 0, thigh: 45, shin: -45, ankle: JANDA_FOOT, upperArm: -8, forearm: -12 },
      { at: JANDA_HIP, trunk: 180, curl: 58, thigh: 45, shin: -45, ankle: JANDA_FOOT, upperArm: -14, forearm: -10 },
      { at: JANDA_HIP, trunk: 102, curl: 58, thigh: 45, shin: -45, ankle: JANDA_FOOT, upperArm: -55, forearm: -25 },
    ],
  },
  // Pallof Press: standing side-on to an anchored band, drawn turned so the
  // anchor is seen out to the athlete's side. The hands press straight out
  // from the chest; nothing else moves.
  'pallof-press': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 60,
    originX: 62,
    lines: [{ from: PALLOF_BAND_ANCHOR, to: 'nearGrip' }],
    equipment: [
      { kind: 'frame', a: [0, 0.5, PALLOF_BAND_ANCHOR[2]], b: [0, CHAIN_STANDING_SHOULDER + 8, PALLOF_BAND_ANCHOR[2]] },
    ],
    poses: [
      { ...PALLOF_STANCE, ...PALLOF_AT_CHEST },
      { ...PALLOF_STANCE, ...PALLOF_PRESSED },
    ],
  },
  // Pallof Press With Rotation: the same stance beside a shoulder-height
  // pulley. Press out, then the shoulders turn a quarter turn away from the
  // pulley with the arms straight and the hips still.
  'pallof-press-with-rotation': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 60,
    originX: 58,
    implement: 'handle',
    lines: [{ from: PALLOF_PULLEY, to: 'nearGrip' }],
    equipment: [
      { kind: 'frame', a: [0, 0.5, PALLOF_PULLEY[2]], b: [0, CHAIN_STANDING_SHOULDER + 8, PALLOF_PULLEY[2]] },
      { kind: 'pulley', at: PALLOF_PULLEY },
    ],
    poses: [
      { ...PALLOF_STANCE, twist: 0, ...PALLOF_AT_CHEST },
      { ...PALLOF_STANCE, twist: 0, ...PALLOF_PRESSED },
      {
        ...PALLOF_STANCE, twist: 90,
        upperArm: [-5, -108.8], forearm: [-5, -108.8], farUpperArm: [-5, 71.2], farForearm: [-5, 71.2],
      },
    ],
  },
  // Cable Pull-Through: facing away from a low pulley, the rope held at the
  // hips with the cable running back between the legs. The hips go back and the
  // flat back hinges forward; the feet stay planted.
  'cable-pull-through': {
    root: 'hip',
    implement: 'rope',
    kneePole: 0,
    lines: [{ from: PULL_THROUGH_PULLEY, to: 'nearGrip', depth: 'far' }],
    equipment: [
      { kind: 'frame', a: [PULL_THROUGH_PULLEY[0], 0.5], b: [PULL_THROUGH_PULLEY[0], 16] },
      { kind: 'pulley', at: PULL_THROUGH_PULLEY },
    ],
    poses: [
      { at: [52, 46.3], trunk: 90, head: 90, thigh: -90, shin: -90, ankle: PULL_THROUGH_FEET, upperArm: -85, forearm: -88 },
      { at: [44, 43.5], trunk: 25, head: 42, thigh: -90, shin: -90, ankle: PULL_THROUGH_FEET, upperArm: -125, forearm: -125 },
    ],
  },
  // Step-up with Knee Raise: feet together on the floor, the lead foot lifted
  // onto the box, then standing tall on it as the other knee drives up.
  'step-up-with-knee-raise': {
    root: 'hip',
    feet: 'free',
    kneePole: 0,
    equipment: [{ kind: 'box', a: [STEP_BOX.front, 0], b: [STEP_BOX.back, STEP_BOX.top] }],
    poses: [
      { at: [40, 46.3], trunk: 90, thigh: -90, shin: -90, ankle: STEP_ON_FLOOR, farAnkle: STEP_ON_FLOOR, foot: 0, farFoot: 0, ...STEP_ARMS },
      { at: [42, 46.3], trunk: 88, thigh: -90, shin: -90, ankle: [48, 20], farAnkle: STEP_ON_FLOOR, foot: -8, farFoot: 0, ...STEP_ARMS },
      { at: [46, 46], trunk: 82, thigh: -90, shin: -90, ankle: STEP_ON_BOX, farAnkle: STEP_ON_FLOOR, foot: 0, farFoot: 0, ...STEP_ARMS },
      { at: [57, STEP_BOX.top + 46.3], trunk: 90, thigh: -90, shin: -90, ankle: STEP_ON_BOX, farAnkle: [80.4, STEP_BOX.top + 29.9], foot: 0, farFoot: -20, ...STEP_ARMS },
    ],
  },
  // Cable Internal Rotation: seen from the front, the cable out to the working
  // side at elbow height. The upper arm hangs still at the side; the level
  // forearm turns from pointing at the cable to the centreline.
  'cable-internal-rotation': {
    root: 'hip',
    view: 'front',
    feet: 'front',
    implement: 'handle',
    lines: [{ from: INTERNAL_ROTATION_ANCHOR, to: 'nearGrip' }],
    equipment: [
      { kind: 'frame', a: [0, 0.5, INTERNAL_ROTATION_ANCHOR[2]], b: [0, 84, INTERNAL_ROTATION_ANCHOR[2]] },
      { kind: 'pulley', at: INTERNAL_ROTATION_ANCHOR },
    ],
    poses: [
      { ...INTERNAL_ROTATION_BODY, forearm: [0, 90] },
      { ...INTERNAL_ROTATION_BODY, forearm: [0, -57] },
    ],
  },
  // Internal Rotation with Band: the same movement against a band fixed at
  // elbow height, turned further across the body.
  'internal-rotation-with-band': {
    root: 'hip',
    view: 'front',
    feet: 'front',
    lines: [{ from: INTERNAL_ROTATION_ANCHOR, to: 'nearGrip' }],
    equipment: [
      { kind: 'frame', a: [0, 0.5, INTERNAL_ROTATION_ANCHOR[2]], b: [0, INTERNAL_ROTATION_ANCHOR[1] + 6, INTERNAL_ROTATION_ANCHOR[2]] },
    ],
    poses: [
      { ...INTERNAL_ROTATION_BODY, forearm: [0, 90] },
      { ...INTERNAL_ROTATION_BODY, forearm: [0, -78] },
    ],
  },
  // Low Pulley Row To Neck: sitting at a low row station, back upright, feet
  // on the plate. The elbows lift high and wide and the rope comes to the neck,
  // hands beside the ears. Drawn turned so the wide elbows show.
  'low-pulley-row-to-neck': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 55,
    originX: 24,
    feet: 'free',
    kneePole: 90,
    implement: 'rope',
    lines: [{ from: NECK_ROW_PULLEY, to: 'nearGrip' }, { from: NECK_ROW_PULLEY, to: 'farGrip' }],
    equipment: [
      { kind: 'frame', a: [NECK_ROW_PULLEY[0], 0.5], b: [NECK_ROW_PULLEY[0], 22] },
      { kind: 'pulley', at: NECK_ROW_PULLEY },
      { kind: 'frame', a: [NECK_ROW_FEET[0] + 4.4, 4], b: [NECK_ROW_FEET[0] + 4.4, 22] },
      ...chainFlatBench(-13, 6, NECK_ROW_SEAT_TOP),
    ],
    poses: [
      { at: [0, NECK_ROW_SEAT_TOP + CHAIN_THIGH_HALF], trunk: 90, thigh: 10, shin: -10, ankle: NECK_ROW_FEET, foot: 80, upperArm: [-25, 0], forearm: [-25, 0] },
      { at: [0, NECK_ROW_SEAT_TOP + CHAIN_THIGH_HALF], trunk: 90, thigh: 10, shin: -10, ankle: NECK_ROW_FEET, foot: 80, upperArm: [0, 50], forearm: [123.7, -52] },
    ],
  },
  // Bent Over Barbell Row: hinged until the trunk is almost level, knees soft,
  // the bar hanging under the shoulders. The trunk stays still while the bar
  // is pulled up and back to the body, the elbows leading.
  'bent-over-barbell-row': {
    root: 'hip',
    implement: 'bar',
    kneePole: 0,
    elbowPole: 120,
    poses: [
      {
        at: BENT_ROW_HIP, trunk: BENT_ROW_TRUNK, head: 35, thigh: -90, shin: -90, ankle: BENT_ROW_FEET, upperArm: -90, forearm: -90,
        wrist: [BENT_ROW_SHOULDER[0], BENT_ROW_SHOULDER[1] - CHAIN_LONG_ARM],
      },
      { at: BENT_ROW_HIP, trunk: BENT_ROW_TRUNK, head: 35, thigh: -90, shin: -90, ankle: BENT_ROW_FEET, upperArm: -90, forearm: -90, wrist: BENT_ROW_TOP },
    ],
  },
  // Barbell Rear Delt Row: the same hinge seen turned, so the wide grip and the
  // wide elbows show. The bar goes to the upper chest, the elbows out to the sides.
  'barbell-rear-delt-row': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 40,
    originX: 40,
    implement: 'bar',
    kneePole: 0,
    elbowPole: [90, 70],
    poses: [
      {
        at: REAR_DELT_ROW_HIP, trunk: REAR_DELT_ROW_TRUNK, head: 42, thigh: -90, shin: -90, ankle: REAR_DELT_ROW_FEET, upperArm: -90, forearm: -90,
        wrist: [REAR_DELT_ROW_SHOULDER[0], REAR_DELT_ROW_SHOULDER[1] - REAR_DELT_ROW_HANG, REAR_DELT_ROW_GRIP_HALF],
        farWrist: [REAR_DELT_ROW_SHOULDER[0], REAR_DELT_ROW_SHOULDER[1] - REAR_DELT_ROW_HANG, -REAR_DELT_ROW_GRIP_HALF],
      },
      {
        at: REAR_DELT_ROW_HIP, trunk: REAR_DELT_ROW_TRUNK, head: 42, thigh: -90, shin: -90, ankle: REAR_DELT_ROW_FEET, upperArm: -90, forearm: -90,
        wrist: [REAR_DELT_ROW_TOP[0], REAR_DELT_ROW_TOP[1], REAR_DELT_ROW_GRIP_HALF],
        farWrist: [REAR_DELT_ROW_TOP[0], REAR_DELT_ROW_TOP[1], -REAR_DELT_ROW_GRIP_HALF],
      },
    ],
  },
  // Bent Over One-Arm Long Bar Row: one end of the bar braced on the floor
  // behind, the near hand on the shaft just behind the plates, the free hand
  // resting above the knee. The bar swings up about its braced end.
  'bent-over-one-arm-long-bar-row': {
    root: 'hip',
    implement: 'longBar',
    barAnchor: LONG_BAR.anchor,
    barLength: LONG_BAR.length,
    kneePole: 0,
    elbowPole: 120,
    equipment: [{ kind: 'frame', a: [LONG_BAR.anchor[0] - 2.4, 0.5], b: [LONG_BAR.anchor[0] - 2.4, 12] }],
    poses: [
      {
        at: LONG_BAR_ROW_HIP, trunk: LONG_BAR_ROW_TRUNK, head: 38, thigh: -90, shin: -90, ankle: LONG_BAR_ROW_FEET, upperArm: -90, forearm: -90,
        wrist: longBarHand(LONG_BAR.lowDeg), farWrist: LONG_BAR_ROW_REST,
      },
      {
        at: LONG_BAR_ROW_HIP, trunk: LONG_BAR_ROW_TRUNK, head: 38, thigh: -90, shin: -90, ankle: LONG_BAR_ROW_FEET, upperArm: -90, forearm: -90,
        wrist: longBarHand(LONG_BAR.highDeg), farWrist: LONG_BAR_ROW_REST,
      },
    ],
  },
  // Stiff Leg Barbell Good Morning: the bar across the back of the shoulders.
  // The hips go back and the trunk lowers to about level; the knees keep the
  // one soft bend they started with, so the legs only lean back with the hips.
  'stiff-leg-barbell-good-morning': {
    root: 'ankle',
    implement: 'bar',
    armsFollowTrunk: true,
    poses: [
      { ...goodMorningLeg(0), trunk: 90, head: 90, ...BAR_ON_BACK },
      { ...goodMorningLeg(GOOD_MORNING_LEAN), trunk: 8, head: 30, ...BAR_ON_BACK },
    ],
  },
  // Cable Row: sitting tall at a low row station, feet on the plate. The
  // handle comes from long arms to the lower ribs as the elbows drive down and
  // back; the trunk does not rock.
  'cable-row': {
    root: 'hip',
    feet: 'free',
    kneePole: 90,
    elbowPole: -160,
    implement: 'handle',
    lines: [{ from: ROW_STATION_PULLEY, to: 'nearGrip' }],
    equipment: [
      { kind: 'frame', a: [ROW_STATION_PULLEY[0], 0.5], b: [ROW_STATION_PULLEY[0], 24] },
      { kind: 'pulley', at: ROW_STATION_PULLEY },
      { kind: 'frame', a: [ROW_STATION_FEET[0] + 4.4, 4], b: [ROW_STATION_FEET[0] + 4.4, 22] },
      ...chainFlatBench(ROW_STATION.hipX - 13, ROW_STATION.hipX + 6, ROW_STATION.seatTop),
    ],
    poses: [
      { at: ROW_STATION_HIP, trunk: 90, thigh: 10, shin: -10, ankle: ROW_STATION_FEET, foot: 80, upperArm: -20, forearm: -20, wrist: CABLE_ROW_REACH },
      { at: ROW_STATION_HIP, trunk: 90, thigh: 10, shin: -10, ankle: ROW_STATION_FEET, foot: 80, upperArm: -20, forearm: -20, wrist: CABLE_ROW_FINISH },
    ],
  },
  // Seated Cable Rows: the same kind of station seen turned, both hands on one
  // V-handle. It comes from straight arms to the stomach with the arms close
  // to the body and the elbows passing back beside the ribs.
  'seated-cable-rows': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 35,
    originX: 24,
    feet: 'free',
    kneePole: 90,
    elbowPole: [-170, 25],
    implement: 'handles',
    lines: [{ from: NECK_ROW_PULLEY, to: 'nearGrip' }, { from: NECK_ROW_PULLEY, to: 'farGrip' }],
    equipment: [
      { kind: 'frame', a: [NECK_ROW_PULLEY[0], 0.5], b: [NECK_ROW_PULLEY[0], 22] },
      { kind: 'pulley', at: NECK_ROW_PULLEY },
      { kind: 'frame', a: [NECK_ROW_FEET[0] + 4.4, 4], b: [NECK_ROW_FEET[0] + 4.4, 22] },
      ...chainFlatBench(-13, 6, NECK_ROW_SEAT_TOP),
    ],
    poses: [
      {
        at: [0, NECK_ROW_SEAT_TOP + CHAIN_THIGH_HALF], trunk: 90, thigh: 10, shin: -10, ankle: NECK_ROW_FEET, foot: 80, upperArm: -25, forearm: -25,
        wrist: [SEATED_ROW_REACH[0], SEATED_ROW_REACH[1], V_HANDLE_HALF], farWrist: [SEATED_ROW_REACH[0], SEATED_ROW_REACH[1], -V_HANDLE_HALF],
      },
      {
        at: [0, NECK_ROW_SEAT_TOP + CHAIN_THIGH_HALF], trunk: 90, thigh: 10, shin: -10, ankle: NECK_ROW_FEET, foot: 80, upperArm: -25, forearm: -25,
        wrist: [SEATED_ROW_FINISH[0], SEATED_ROW_FINISH[1], V_HANDLE_HALF], farWrist: [SEATED_ROW_FINISH[0], SEATED_ROW_FINISH[1], -V_HANDLE_HALF],
      },
    ],
  },
  // Face Pull: standing facing a pulley at upper-chest height, seen turned.
  // The arms start long toward it; the elbows go high and wide and the hands
  // split to finish beside the ears, the forearms turned up and back.
  'face-pull': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 58,
    originX: 30,
    implement: 'rope',
    lines: [{ from: FACE_PULL_PULLEY, to: 'nearGrip' }, { from: FACE_PULL_PULLEY, to: 'farGrip' }],
    equipment: [
      { kind: 'frame', a: [FACE_PULL_PULLEY[0], 0.5], b: [FACE_PULL_PULLEY[0], 92] },
      { kind: 'pulley', at: FACE_PULL_PULLEY },
    ],
    poses: [
      // The upper arms start all but straight ahead, so everything the arms then do takes the hands back from the pulley.
      { at: [0, CHAIN_STANDING_HIP], trunk: 90, thigh: -90, shin: -90, upperArm: [-8, -6], forearm: [-8, -25] },
      { at: [0, CHAIN_STANDING_HIP], trunk: 90, thigh: -90, shin: -90, upperArm: [10, 62], forearm: [130, -47] },
    ],
  },
  // Calf Raises - With Bands: standing on a band, a handle in each hand beside
  // the shoulders. The forefeet stay planted and the heels rise; the hands do
  // not move against the body.
  'calf-raises-with-bands': {
    root: 'toe',
    feet: 'free',
    implement: 'handles',
    lines: [{ from: 'nearFoot', to: 'nearGrip' }],
    poses: [
      { at: [50, CHAIN_FOREFOOT_HEIGHT], trunk: 90, thigh: -90, shin: -90, foot: 0, upperArm: -75, forearm: 80 },
      { at: [50, CHAIN_FOREFOOT_HEIGHT], trunk: 90, thigh: -90, shin: -90, foot: -BAND_CALF_RAISE_TILT, upperArm: -75, forearm: 80 },
    ],
  },
  // Crunch - Hands Overhead: knees bent, feet flat, arms long beside the head.
  // The upper spine curls until the shoulder blades are just off the floor and
  // the arms stay in line with the head.
  'crunch-hands-overhead': {
    root: 'hip',
    spine: 'upper',
    kneePole: 90,
    armsFollowTrunk: true,
    nearArmOverHead: true,
    poses: [
      { at: FLOOR_CRUNCH_HIP, trunk: 180, curl: 0, thigh: 50, shin: -50, ankle: FLOOR_CRUNCH_FOOT, upperArm: 96, forearm: 96 },
      { at: FLOOR_CRUNCH_HIP, trunk: 180, curl: 38, thigh: 50, shin: -50, ankle: FLOOR_CRUNCH_FOOT, upperArm: 96, forearm: 96 },
    ],
  },
  // Standing Dumbbell Press: seen from the front, feet under the shoulders.
  // The dumbbells start at head height with the elbows out and the forearms
  // upright, and are pressed straight overhead; nothing below the arms moves.
  'standing-dumbbell-press': {
    root: 'hip',
    view: 'front',
    feet: 'front',
    implement: 'bells',
    poses: [
      {
        at: [0, FRONT_STANCE_HIP], trunk: 90, thigh: [-90, FRONT_STANCE_OUT], shin: [-90, FRONT_STANCE_OUT],
        upperArm: [90, PRESS_START_OUT['standing-dumbbell-press']], forearm: [90, 0],
      },
      {
        at: [0, FRONT_STANCE_HIP], trunk: 90, thigh: [-90, FRONT_STANCE_OUT], shin: [-90, FRONT_STANCE_OUT],
        upperArm: [90, 5], forearm: [90, 0],
      },
    ],
  },
  // Seated Dumbbell Press: sitting back against a bench with a back support,
  // seen turned. The dumbbells go from the shoulders to meet overhead, the
  // forearms upright the whole way.
  'seated-dumbbell-press': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 60,
    originX: 46,
    implement: 'bells',
    equipment: chainInclineBench([0, CHAIN_SEATED_HIP], SEATED_PRESS_BACK),
    poses: [
      {
        at: [0, CHAIN_SEATED_HIP], trunk: SEATED_PRESS_BACK, thigh: [0, 8], shin: -90,
        upperArm: [90, PRESS_START_OUT['seated-dumbbell-press']], forearm: [90, 0],
      },
      { at: [0, CHAIN_SEATED_HIP], trunk: SEATED_PRESS_BACK, thigh: [0, 8], shin: -90, upperArm: [90, -8], forearm: [90, -14] },
    ],
  },
  // Seated Cable Shoulder Press: sitting tall on a flat bench between two low
  // pulleys, a handle in each hand. The handles go up and together overhead.
  'seated-cable-shoulder-press': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 65,
    originX: 46,
    implement: 'handles',
    lines: [{ from: CABLE_PRESS_PULLEYS[0], to: 'nearGrip' }, { from: CABLE_PRESS_PULLEYS[1], to: 'farGrip' }],
    equipment: [
      { kind: 'pulley', at: CABLE_PRESS_PULLEYS[0] },
      { kind: 'pulley', at: CABLE_PRESS_PULLEYS[1] },
      { kind: 'post', at: [-24, CHAIN_SEATED_HIP - CHAIN_THIGH_HALF - 4] },
      { kind: 'post', at: [0, CHAIN_SEATED_HIP - CHAIN_THIGH_HALF - 4] },
      { kind: 'slab', a: [-29, CHAIN_SEATED_HIP - CHAIN_THIGH_HALF - 2], b: [5, CHAIN_SEATED_HIP - CHAIN_THIGH_HALF - 2] },
    ],
    poses: [
      {
        at: [0, CHAIN_SEATED_HIP], trunk: 90, thigh: [0, 10], shin: -90,
        upperArm: [90, PRESS_START_OUT['seated-cable-shoulder-press']], forearm: [90, 0],
      },
      { at: [0, CHAIN_SEATED_HIP], trunk: 90, thigh: [0, 10], shin: -90, upperArm: [90, -10], forearm: [90, -18] },
    ],
  },
  // Underhand Cable Pulldowns: seated under a high pulley with the thighs
  // under the knee pad, leaning back a little, seen turned. The hands are
  // close together on the bar; it comes to the upper chest as the elbows
  // travel down and back beside the ribs.
  'underhand-cable-pulldowns': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 40,
    originX: 40,
    implement: 'cableBar',
    elbowPole: [-125, 10],
    lines: [{ from: PULLDOWN.pulley, to: 'midGrip' }],
    equipment: [
      { kind: 'pulley', at: PULLDOWN.pulley },
      { kind: 'post', at: [16, CHAIN_SEATED_HIP + CHAIN_THIGH_HALF + 4] },
      { kind: 'roller', at: [14, CHAIN_SEATED_HIP + CHAIN_THIGH_HALF + 2.8] },
      ...chainFlatBench(-12, 8, CHAIN_SEATED_HIP - CHAIN_THIGH_HALF),
    ],
    poses: [
      {
        at: PULLDOWN_HIP, trunk: PULLDOWN.back, thigh: 0, shin: -90, upperArm: 80, forearm: 80,
        wrist: [PULLDOWN_REACH[0], PULLDOWN_REACH[1], PULLDOWN.gripHalf], farWrist: [PULLDOWN_REACH[0], PULLDOWN_REACH[1], -PULLDOWN.gripHalf],
      },
      {
        at: PULLDOWN_HIP, trunk: PULLDOWN.back, thigh: 0, shin: -90, upperArm: 80, forearm: 80,
        wrist: [PULLDOWN_CHEST[0], PULLDOWN_CHEST[1], PULLDOWN.gripHalf], farWrist: [PULLDOWN_CHEST[0], PULLDOWN_CHEST[1], -PULLDOWN.gripHalf],
      },
    ],
  },
  // V-Bar Pullup: both hands on one V-handle hung over the middle of the bar,
  // which is seen end-on. The body hangs leaning back a little and is pulled
  // up until the chest is close to the handle, the head passing behind the bar.
  'v-bar-pullup': {
    root: 'hip',
    feet: 'free',
    elbowPole: -80,
    equipment: [
      { kind: 'frame', a: V_BAR.bar, b: V_BAR.grip },
      { kind: 'roller', at: V_BAR.bar, layer: 'behind' },
    ],
    poses: [
      {
        at: [52.19, 51.07], trunk: 102, head: 100, thigh: -85, shin: -165, foot: -160, upperArm: 85, forearm: 85,
        wrist: [V_BAR.grip[0], V_BAR.grip[1], V_BAR.half], farWrist: [V_BAR.grip[0], V_BAR.grip[1], -V_BAR.half],
      },
      {
        at: [49.16, 76.08], trunk: 112, head: 122, thigh: -66, shin: -156, foot: -160, upperArm: 85, forearm: 85,
        wrist: [V_BAR.grip[0], V_BAR.grip[1], V_BAR.half], farWrist: [V_BAR.grip[0], V_BAR.grip[1], -V_BAR.half],
      },
    ],
  },
  // Alternate Hammer Curl: standing, seen turned, palms facing in. The middle
  // pose is both arms long; either side of it one forearm curls straight up
  // to shoulder height while the other arm hangs still.
  'alternate-hammer-curl': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 50,
    implement: 'hammer',
    farArmOver: true,
    poses: [
      { ...HAMMER_STANCE, ...HAMMER_HANG, forearm: HAMMER_CURLED, farForearm: HAMMER_HANG.forearm },
      { ...HAMMER_STANCE, ...HAMMER_HANG },
      { ...HAMMER_STANCE, ...HAMMER_HANG, farForearm: HAMMER_CURLED },
    ],
  },
  // Cross Body Hammer Curl: the same stance, but each forearm curls across the
  // front of the body toward the opposite shoulder, the upper arm coming
  // forward only a little.
  'cross-body-hammer-curl': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 50,
    implement: 'hammer',
    farArmOver: true,
    poses: [
      { ...HAMMER_STANCE, upperArm: [-78, 4], forearm: [45, -48], farUpperArm: HAMMER_HANG.upperArm, farForearm: HAMMER_HANG.forearm },
      { ...HAMMER_STANCE, ...HAMMER_HANG },
      { ...HAMMER_STANCE, ...HAMMER_HANG, farUpperArm: [-78, 4], farForearm: [45, -48] },
    ],
  },
  // Dumbbell Sumo Squat: seen from the front, feet planted wide, one dumbbell
  // hanging between the legs on long arms. The hips go straight down between
  // the knees, which travel out over the feet.
  'dumbbell-sumo-squat': {
    root: 'hip',
    view: 'front',
    feet: 'front',
    implement: 'bell',
    bellAxis: [0, 1, 0],
    farArmOver: true,
    kneePole: [0, 35],
    poses: [sumoSquatPose(SUMO_SQUAT.tall), sumoSquatPose(SUMO_SQUAT.low)],
  },
  // Push Up to Side Plank: a push-up on the toes, then the body rolls onto its
  // far hand and foot as it presses up, and the near arm sweeps out and up to
  // the ceiling. Poses: the bottom of the push-up, the top, half-way through
  // the turn, and the side plank.
  'push-up-to-side-plank': {
    root: 'farAnkle',
    feet: 'free',
    elbowPole: 150,
    poses: [
      sidePlankPose(PUSH_UP_BOTTOM_DEG, 0, 0, [SIDE_PLANK_HANDS[0], SIDE_PLANK_HANDS[1], SIDE_PLANK_SHOULDER_OUT], 6),
      sidePlankPose(PUSH_UP_TOP_DEG, 0, 0, [SIDE_PLANK_HANDS[0], SIDE_PLANK_HANDS[1], SIDE_PLANK_SHOULDER_OUT], 6),
      // Half-way through the turn the near arm is out to the side, toward the viewer.
      sidePlankPose((PUSH_UP_TOP_DEG + SIDE_PLANK_DEG) / 2, -45, SIDE_PLANK_LEG_IN / 2, [76.8, 46.8, 27.6], 3),
      sidePlankPose(SIDE_PLANK_DEG, -90, SIDE_PLANK_LEG_IN, [SIDE_PLANK_TOP_SHOULDER[0], SIDE_PLANK_TOP_SHOULDER[1] + CHAIN_LONG_ARM, 0], 0),
    ],
  },
  // Hammer Curl: standing, seen turned, palms facing each other. Both
  // forearms curl straight up to shoulder height together; the upper arms hang
  // still and each dumbbell stays square to its forearm.
  'hammer-curl': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 50,
    implement: 'hammer',
    farArmOver: true,
    poses: [
      { ...HAMMER_STANCE, ...HAMMER_HANG },
      { ...HAMMER_STANCE, ...HAMMER_HANG, forearm: HAMMER_CURLED },
    ],
  },
  // Dumbbell Bicep Curl: drawn from the Hammer Curl's frames (a variant, see
  // derivation.ts), so its poses are the same. Only the grip differs: palms
  // forward, so each dumbbell lies across the body, and the variant's
  // supinated orientation tilts it at the top.
  'dumbbell-bicep-curl': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 50,
    implement: 'bells',
    farArmOver: true,
    poses: [
      { ...HAMMER_STANCE, ...HAMMER_HANG },
      { ...HAMMER_STANCE, ...HAMMER_HANG, forearm: HAMMER_CURLED },
    ],
  },
  // Finger Curls: sitting with the forearms level along the thighs, palms up,
  // a barbell in the hands beyond the knees. The body does not move; the three
  // poses carry the scene. From the first to the second a close-up of the hand
  // opens, and from the second to the third the fingers open and the bar rolls
  // from the palm down to the last joints of the fingers.
  'finger-curls': {
    root: 'hip',
    implement: 'bar',
    palm: 'up',
    equipment: WRIST_CURL_BENCH,
    closeUp: FINGER_CURL_PANEL,
    poses: [FINGER_CURL_BODY, FINGER_CURL_BODY, FINGER_CURL_BODY],
  },
  // 3/4 Sit-Up: knees bent, feet held down, hands by the head. The poses are
  // lying, three quarters of the way down, and upright; sitting up from the
  // floor passes through the middle one, and each rep after that lowers only
  // as far as it.
  '3-4-sit-up': {
    root: 'hip',
    kneePole: 90,
    armsFollowTrunk: true,
    nearArmOverHead: true,
    equipment: [
      { kind: 'post', at: [THREE_QUARTER_ANCHOR[0], THREE_QUARTER_ANCHOR[1]] },
      { kind: 'roller', at: THREE_QUARTER_ANCHOR },
    ],
    poses: [
      { at: THREE_QUARTER_HIP, trunk: 180, curl: 0, thigh: 50, shin: -50, ankle: THREE_QUARTER_FEET, ...HANDS_BY_EARS },
      { at: THREE_QUARTER_HIP, trunk: 180, curl: 45, thigh: 50, shin: -50, ankle: THREE_QUARTER_FEET, ...HANDS_BY_EARS },
      { at: THREE_QUARTER_HIP, trunk: 95, curl: 20, thigh: 50, shin: -50, ankle: THREE_QUARTER_FEET, ...HANDS_BY_EARS },
    ],
  },
  // Crunches: lying with the lower legs resting on a bench, hands by the head.
  // The lower back stays on the floor and only the upper spine curls, lifting
  // the shoulders about ten centimetres.
  'crunches': {
    root: 'hip',
    spine: 'upper',
    feet: 'free',
    armsFollowTrunk: true,
    nearArmOverHead: true,
    equipment: chainFlatBench(BENCH_CRUNCH_HIP[0] + 4, BENCH_CRUNCH_HIP[0] + CHAIN_SHIN + 8, BENCH_CRUNCH_BENCH_TOP),
    poses: [
      { at: BENCH_CRUNCH_HIP, trunk: 180, curl: 0, thigh: 90, shin: 0, foot: 75, ...HANDS_BY_EARS },
      { at: BENCH_CRUNCH_HIP, trunk: 180, curl: 34, thigh: 90, shin: 0, foot: 75, ...HANDS_BY_EARS },
    ],
  },
  // Rope Crunch: kneeling tall facing a high pulley a short way in front, a
  // rope end in each hand beside the head. The hips stay still and the whole
  // spine curls the rib cage toward the thighs.
  'rope-crunch': {
    root: 'hip',
    feet: 'free',
    implement: 'rope',
    armsFollowTrunk: true,
    lines: [{ from: ROPE_CRUNCH_PULLEY, to: 'nearGrip' }],
    equipment: [
      { kind: 'frame', a: [ROPE_CRUNCH_UPRIGHT, 0.5], b: [ROPE_CRUNCH_UPRIGHT, ROPE_CRUNCH_PULLEY[1] + 3] },
      { kind: 'frame', a: [ROPE_CRUNCH_PULLEY[0] - 5, ROPE_CRUNCH_PULLEY[1] + 3], b: [ROPE_CRUNCH_UPRIGHT, ROPE_CRUNCH_PULLEY[1] + 3] },
      { kind: 'pulley', at: ROPE_CRUNCH_PULLEY },
    ],
    poses: [
      { at: ROPE_CRUNCH_HIP, trunk: 90, curl: 0, thigh: -90, shin: 180, foot: 180, ...ROPE_BY_HEAD },
      { at: ROPE_CRUNCH_HIP, trunk: 90, curl: 78, thigh: -90, shin: 180, foot: 180, ...ROPE_BY_HEAD },
    ],
  },
  // Band Good Morning (Pull Through): facing a post with a band looped round
  // its base and over the back of the neck, held at the collar. The hips go
  // back and the flat trunk folds to near level against the band; the knees
  // keep one soft bend, the leg turning about the ankle as one piece.
  'band-good-morning-pull-through': {
    root: 'ankle',
    armsFollowTrunk: true,
    lines: [{ from: BAND_GOOD_MORNING_ANCHOR, to: 'nearGrip' }],
    equipment: [
      { kind: 'frame', a: [BAND_GOOD_MORNING_ANCHOR[0], 0.5], b: [BAND_GOOD_MORNING_ANCHOR[0], 70] },
    ],
    poses: [
      { ...bandGoodMorningLeg(0), trunk: 90, head: 90, ...HANDS_AT_COLLAR },
      { ...bandGoodMorningLeg(BAND_GOOD_MORNING_LEAN), trunk: 12, head: 35, ...HANDS_AT_COLLAR },
    ],
  },
  // Hip Extension with Bands: standing tall facing a post and holding it, a
  // band from low on the post to the near ankle. That leg goes straight back
  // with the knee straight; the trunk and the standing leg do not move.
  'hip-extension-with-bands': {
    root: 'hip',
    feet: 'free',
    lines: [{ from: BAND_KICKBACK_ANCHOR, to: 'nearAnkle' }],
    equipment: [
      { kind: 'frame', a: [BAND_KICKBACK_POST, 0.5], b: [BAND_KICKBACK_POST, 82] },
    ],
    poses: [
      {
        at: [40, CHAIN_STANDING_HIP], trunk: 90, thigh: -90, shin: -90, foot: 0, farThigh: -90, farShin: -90, farFoot: 0,
        upperArm: -40, forearm: 10, wrist: [BAND_KICKBACK_POST, 58], farWrist: [BAND_KICKBACK_POST, 58],
      },
      {
        // The foot tilts less than the leg, so the toe never dips under the floor as the leg starts back.
        at: [40, CHAIN_STANDING_HIP], trunk: 90, thigh: -90 - BAND_KICKBACK_DEG, shin: -90 - BAND_KICKBACK_DEG, foot: -0.6 * BAND_KICKBACK_DEG,
        farThigh: -90, farShin: -90, farFoot: 0,
        upperArm: -40, forearm: 10, wrist: [BAND_KICKBACK_POST, 58], farWrist: [BAND_KICKBACK_POST, 58],
      },
    ],
  },
  // Barbell Shrug Behind The Back: standing tall, the bar hanging at arm's
  // length behind the body. The arms stay straight and only the shoulders
  // lift, straight up, and lower.
  'barbell-shrug-behind-the-back': {
    root: 'hip',
    implement: 'bar',
    poses: [
      { at: [50, CHAIN_STANDING_HIP], trunk: 90, thigh: -90, shin: -90, upperArm: -100, forearm: -100, shrug: 0 },
      { at: [50, CHAIN_STANDING_HIP], trunk: 90, thigh: -90, shin: -90, upperArm: -100, forearm: -100, shrug: SHRUG_LIFT },
    ],
  },
  // Cable Shrugs: standing tall close to a low pulley, the bar hanging in
  // front on straight arms. Only the shoulders lift and lower.
  'cable-shrugs': {
    root: 'hip',
    implement: 'cableBar',
    lines: [{ from: CABLE_SHRUG_PULLEY, to: 'nearGrip' }],
    equipment: [
      { kind: 'frame', a: [CABLE_SHRUG_PULLEY[0], 0.5], b: [CABLE_SHRUG_PULLEY[0], 16] },
      { kind: 'pulley', at: CABLE_SHRUG_PULLEY },
    ],
    poses: [
      { at: [50, CHAIN_STANDING_HIP], trunk: 90, thigh: -90, shin: -90, upperArm: -84, forearm: -84, shrug: 0 },
      { at: [50, CHAIN_STANDING_HIP], trunk: 90, thigh: -90, shin: -90, upperArm: -84, forearm: -84, shrug: SHRUG_LIFT },
    ],
  },
  // Cable One Arm Tricep Extension: standing facing a high pulley, one handle
  // in the near hand. The upper arm stays locked to the side while the forearm
  // straightens down beside the body; the free arm hangs.
  'cable-one-arm-tricep-extension': {
    root: 'hip',
    implement: 'handle',
    lines: [{ from: ONE_ARM_PUSHDOWN_PULLEY, to: 'nearGrip' }],
    equipment: [
      { kind: 'frame', a: [ONE_ARM_PUSHDOWN_PULLEY[0], 0.5], b: [ONE_ARM_PUSHDOWN_PULLEY[0], 99] },
      { kind: 'pulley', at: ONE_ARM_PUSHDOWN_PULLEY },
    ],
    poses: [
      {
        at: [40, CHAIN_STANDING_HIP], trunk: 90, thigh: -90, shin: -90,
        upperArm: -90, forearm: ONE_ARM_PUSHDOWN_START, farUpperArm: -88, farForearm: -80,
      },
      {
        at: [40, CHAIN_STANDING_HIP], trunk: 90, thigh: -90, shin: -90,
        upperArm: -90, forearm: -88, farUpperArm: -88, farForearm: -80,
      },
    ],
  },
  // Dumbbell Tricep Extension - Pronated Grip: lying on a flat bench, the
  // upper arms upright. The elbows bend to lower the dumbbells beside the ears
  // and straighten again; the palms face the feet, so each dumbbell is end-on.
  'dumbbell-tricep-extension-pronated-grip': {
    root: 'hip',
    implement: 'bells',
    nearArmOverHead: true,
    equipment: chainFlatBench(20, 66, CABLE_LYING_BENCH_TOP),
    poses: [
      { at: [62, CABLE_LYING_BENCH_TOP + CHAIN_BACK_HALF], trunk: 180, thigh: 0, shin: -90, ankle: [84, CHAIN_ANKLE_HEIGHT], upperArm: 90, forearm: 90 },
      { at: [62, CABLE_LYING_BENCH_TOP + CHAIN_BACK_HALF], trunk: 180, thigh: 0, shin: -90, ankle: [84, CHAIN_ANKLE_HEIGHT], upperArm: 90, forearm: 230 },
    ],
  },
  // Preacher Hammer Dumbbell Curl: seated, the backs of the upper arms on a
  // sloping pad. The forearms go from almost straight to shoulder height; the
  // upper arms do not leave the pad and each dumbbell is held like a hammer.
  'preacher-hammer-dumbbell-curl': {
    root: 'hip',
    implement: 'hammer',
    equipment: [
      { kind: 'post', at: [preacherPad(15)[0], preacherPad(15)[1]] },
      // In front: the pad's near edge is what the viewer sees under the arm.
      { kind: 'slab', a: preacherPad(8), b: preacherPad(20), layer: 'front' },
      ...chainFlatBench(PREACHER_HIP[0] - 12, PREACHER_HIP[0] + 6, CHAIN_SEATED_HIP - CHAIN_THIGH_HALF),
    ],
    poses: [
      // The top first: the text lowers, then curls back up and squeezes.
      { at: PREACHER_HIP, trunk: PREACHER_TRUNK, thigh: 0, shin: -90, upperArm: PREACHER_UPPER_ARM, forearm: 65 },
      { at: PREACHER_HIP, trunk: PREACHER_TRUNK, thigh: 0, shin: -90, upperArm: PREACHER_UPPER_ARM, forearm: PREACHER_UPPER_ARM + 15 },
    ],
  },
  // External Rotation with Cable: seen from the front, side-on to a cable at
  // elbow height on the far side. The near elbow stays at the side at a right
  // angle while its level forearm turns from across the body, outward.
  'external-rotation-with-cable': {
    root: 'hip',
    view: 'front',
    feet: 'front',
    implement: 'handle',
    lines: [{ from: EXTERNAL_ROTATION_ANCHOR, to: 'nearGrip' }],
    equipment: [
      { kind: 'frame', a: [0, 0.5, EXTERNAL_ROTATION_ANCHOR[2]], b: [0, 84, EXTERNAL_ROTATION_ANCHOR[2]] },
      { kind: 'pulley', at: EXTERNAL_ROTATION_ANCHOR },
    ],
    poses: [
      { ...INTERNAL_ROTATION_BODY, forearm: [0, -70] },
      { ...INTERNAL_ROTATION_BODY, forearm: [0, 50] },
    ],
  },
  // Shotgun Row: a wide split stance leaning forward with a flat back, the far
  // leg in front and the far hand on its thigh. The near arm reaches down the
  // cable's line to a low pulley, then rows the handle to the lower ribs.
  'shotgun-row': {
    root: 'hip',
    implement: 'handle',
    kneePole: 0,
    elbowPole: 135,
    lines: [{ from: SHOTGUN_PULLEY, to: 'nearGrip' }],
    equipment: [
      { kind: 'frame', a: [SHOTGUN_PULLEY[0], 0.5], b: [SHOTGUN_PULLEY[0], 24] },
      { kind: 'pulley', at: SHOTGUN_PULLEY },
    ],
    poses: [
      {
        at: SHOTGUN_HIP, trunk: SHOTGUN_TRUNK, head: 30, thigh: -90, shin: -90, ankle: SHOTGUN_BACK_FOOT, farAnkle: SHOTGUN_FRONT_FOOT,
        upperArm: -50, forearm: -50, wrist: SHOTGUN_REACH, farWrist: [52.5, 33.5],
      },
      {
        at: SHOTGUN_HIP, trunk: SHOTGUN_TRUNK, head: 30, thigh: -90, shin: -90, ankle: SHOTGUN_BACK_FOOT, farAnkle: SHOTGUN_FRONT_FOOT,
        upperArm: -50, forearm: -50, wrist: SHOTGUN_FINISH, farWrist: [52.5, 33.5],
      },
    ],
  },
  // Kneeling High Pulley Row: kneeling tall on both knees facing a pulley well
  // overhead, seen turned, a rope end in each hand. The arms start straight up
  // toward the pulley; the elbows go out to the sides and the rope ends come
  // to either side of the upper chest.
  'kneeling-high-pulley-row': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 50,
    originX: 40,
    feet: 'free',
    implement: 'rope',
    elbowPole: [-60, 70],
    lines: [{ from: KNEELING_ROW_PULLEY, to: 'nearGrip' }, { from: KNEELING_ROW_PULLEY, to: 'farGrip' }],
    equipment: [
      { kind: 'frame', a: [KNEELING_ROW_PULLEY[0], 0.5], b: [KNEELING_ROW_PULLEY[0], KNEELING_ROW_PULLEY[1] + 3] },
      { kind: 'pulley', at: KNEELING_ROW_PULLEY },
    ],
    poses: [
      {
        at: KNEELING_ROW_HIP, trunk: 90, thigh: -90, shin: 180, foot: 180, upperArm: 62, forearm: 62,
        wrist: [11.05, KNEELING_ROW_HIP[1] + CHAIN_TRUNK + 20.88, 3], farWrist: [11.05, KNEELING_ROW_HIP[1] + CHAIN_TRUNK + 20.88, -3],
      },
      {
        at: KNEELING_ROW_HIP, trunk: 90, thigh: -90, shin: 180, foot: 180, upperArm: 62, forearm: 62,
        wrist: [3, KNEELING_ROW_HIP[1] + CHAIN_TRUNK - 2.6, 11], farWrist: [3, KNEELING_ROW_HIP[1] + CHAIN_TRUNK - 2.6, -11],
      },
    ],
  },
  // Incline Cable Chest Press: lying back on an incline bench between two low
  // pulleys, seen turned. The handles start out from the chest with the
  // elbows at right angles and are pressed up and together until the arms are
  // straight. The arm directions are given as if the trunk were upright.
  'incline-cable-chest-press': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 28,
    originX: 46,
    implement: 'handles',
    armsFollowTrunk: true,
    lines: [{ from: INCLINE_PRESS_PULLEYS[0], to: 'nearGrip' }, { from: INCLINE_PRESS_PULLEYS[1], to: 'farGrip' }],
    equipment: [
      { kind: 'pulley', at: INCLINE_PRESS_PULLEYS[0] },
      { kind: 'pulley', at: INCLINE_PRESS_PULLEYS[1] },
      ...chainInclineBench(INCLINE_PRESS_HIP, 180 - INCLINE_PRESS_BENCH_DEG),
    ],
    poses: [
      { at: INCLINE_PRESS_HIP, trunk: 180 - INCLINE_PRESS_BENCH_DEG, thigh: [0, 8], shin: -90, upperArm: [-90, 45], forearm: [0, 0] },
      { at: INCLINE_PRESS_HIP, trunk: 180 - INCLINE_PRESS_BENCH_DEG, thigh: [0, 8], shin: -90, upperArm: [0, -12], forearm: [0, -20] },
    ],
  },
  // Oblique Crunches: Crunches' set-up seen turned, one hand beside the head
  // and the other arm out on the floor. The upper spine curls and the
  // shoulders turn, taking the near elbow toward the far knee.
  'oblique-crunches': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 12,
    pitchDeg: 30,
    originX: 16,
    spine: 'upper',
    feet: 'free',
    armsFollowTrunk: true,
    nearArmOverHead: true,
    // The arm on the floor bends, if at all, along the floor toward the head.
    elbowPole: 180,
    equipment: chainFlatBench(BENCH_CRUNCH_HIP[0] + 4, BENCH_CRUNCH_HIP[0] + CHAIN_SHIN + 8, BENCH_CRUNCH_BENCH_TOP),
    poses: [
      { at: BENCH_CRUNCH_HIP, trunk: 180, curl: 0, twist: 0, thigh: 90, shin: 0, foot: 75, ...HANDS_BY_EARS, farWrist: OBLIQUE_CRUNCH_FAR_HAND },
      // The raised elbow swings in across the body; the hand stays beside the head.
      { at: BENCH_CRUNCH_HIP, trunk: 180, curl: 34, twist: OBLIQUE_CRUNCH_TWIST, thigh: 90, shin: 0, foot: 75, upperArm: [HANDS_BY_EARS.upperArm, -25], forearm: [HANDS_BY_EARS.forearm, 20], farWrist: OBLIQUE_CRUNCH_FAR_HAND },
    ],
  },
  // Bench Press - With Bands: lying on a flat bench seen turned, a band from
  // under the bench's head-end leg to a handle in each hand. The arms start
  // straight above the chest and lower until the elbows are at right angles.
  'bench-press-with-bands': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 30,
    originX: 22,
    implement: 'handles',
    elbowPole: [0, BAND_PRESS_ELBOW_OUT],
    lines: [{ from: BAND_PRESS_ANCHORS[0], to: 'nearGrip' }, { from: BAND_PRESS_ANCHORS[1], to: 'farGrip', depth: 'far' }],
    equipment: chainFlatBench(BAND_PRESS_BENCH[0], BAND_PRESS_BENCH[1], CABLE_LYING_BENCH_TOP),
    poses: [
      { at: BAND_PRESS_HIP, trunk: 180, thigh: [0, 12], shin: -90, ankle: [84, CHAIN_ANKLE_HEIGHT], farAnkle: [84, CHAIN_ANKLE_HEIGHT], upperArm: 90, forearm: 90, ...bandPressHands(false) },
      { at: BAND_PRESS_HIP, trunk: 180, thigh: [0, 12], shin: -90, ankle: [84, CHAIN_ANKLE_HEIGHT], farAnkle: [84, CHAIN_ANKLE_HEIGHT], upperArm: 90, forearm: 90, ...bandPressHands(true) },
    ],
  },
  // Extended Range One-Arm Kettlebell Floor Press: lying on the floor seen
  // turned, the near knee taken across so the body rolls away from the
  // pressing arm. The kettlebell goes from beside the shoulder, elbow sunk
  // below the chest, to a straight upright arm; the free hand is out on the floor.
  'extended-range-one-arm-kettlebell-floor-press': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 12,
    pitchDeg: 30,
    originX: 10,
    feet: 'free',
    implement: 'kettlebell',
    elbowPole: KB_PRESS_LOW_UPPER_ARM,
    kneePole: [90, -30],
    poses: [
      {
        at: KB_PRESS_HIP, trunk: 180, roll: KB_PRESS_ROLL, thigh: 45, shin: -70, foot: 0, farThigh: 0, farShin: 0, farFoot: 80,
        upperArm: 90, forearm: 90, wrist: KB_PRESS_LOW, farWrist: KB_PRESS_FREE_HAND, ankle: KB_PRESS_FOOT, farAnkle: KB_PRESS_FAR_FOOT,
      },
      {
        at: KB_PRESS_HIP, trunk: 180, roll: KB_PRESS_ROLL, thigh: 45, shin: -70, foot: 0, farThigh: 0, farShin: 0, farFoot: 80,
        upperArm: 90, forearm: 90, wrist: KB_PRESS_HIGH, farWrist: KB_PRESS_FREE_HAND, ankle: KB_PRESS_FOOT, farAnkle: KB_PRESS_FAR_FOOT,
      },
    ],
  },
  // External Rotation: lying on the far side on a flat bench, facing the
  // viewer, head on the bottom arm. The top upper arm lies along the side;
  // its forearm turns from level, pointing ahead, up toward the ceiling.
  'external-rotation': {
    root: 'hip',
    view: 'oblique',
    yawDeg: 6,
    pitchDeg: 30,
    originX: 12,
    feet: 'free',
    implement: 'bell',
    bellAxis: [1, 0, 0],
    equipment: chainFlatBench(-6, 88, SIDE_LYING_BENCH_TOP),
    poses: [
      {
        at: SIDE_LYING_HIP, trunk: 0, roll: -90, head: -25,
        thigh: [192, 25], shin: [188, -25], farThigh: [180, -25], farShin: [180, 25], foot: [0, 80], farFoot: [0, -80],
        upperArm: 180, forearm: [90, 90], farUpperArm: [0, -40], farForearm: [0, 60],
      },
      {
        at: SIDE_LYING_HIP, trunk: 0, roll: -90, head: -25,
        thigh: [192, 25], shin: [188, -25], farThigh: [180, -25], farShin: [180, 25], foot: [0, 80], farFoot: [0, -80],
        upperArm: 180, forearm: [90, SIDE_LYING_SHORT_OF_UPRIGHT], farUpperArm: [0, -40], farForearm: [0, 60],
      },
    ],
  },
  // One-Arm Dumbbell Row: the far knee and hand on a bench, the near foot on
  // the floor, the trunk level. The dumbbell hangs under the near shoulder
  // and is pulled up beside the chest, the elbow rising past the back.
  'one-arm-dumbbell-row': {
    root: 'hip',
    feet: 'free',
    implement: 'bell',
    bellAxis: [1, 0, 0],
    elbowPole: 135,
    kneePole: 0,
    equipment: chainFlatBench(4, 72, BENCH_ROW_TOP),
    poses: [
      {
        at: BENCH_ROW_HIP, trunk: 0, thigh: -90, shin: -90, foot: 0, farThigh: -90, farShin: 180, farFoot: 180,
        ankle: [BENCH_ROW_HIP[0] - 12, CHAIN_ANKLE_HEIGHT], farAnkle: BENCH_ROW_FAR_ANKLE,
        upperArm: -90, forearm: -90,
        wrist: [BENCH_ROW_SHOULDER[0], BENCH_ROW_SHOULDER[1] - CHAIN_LONG_ARM],
        farWrist: [BENCH_ROW_SHOULDER[0] + 5, BENCH_ROW_TOP + CHAIN_HAND_REST],
      },
      {
        at: BENCH_ROW_HIP, trunk: 0, thigh: -90, shin: -90, foot: 0, farThigh: -90, farShin: 180, farFoot: 180,
        ankle: [BENCH_ROW_HIP[0] - 12, CHAIN_ANKLE_HEIGHT], farAnkle: BENCH_ROW_FAR_ANKLE,
        upperArm: -90, forearm: -90,
        wrist: [BENCH_ROW_SHOULDER[0] - BENCH_ROW_FINISH[0], BENCH_ROW_SHOULDER[1] - BENCH_ROW_FINISH[1]],
        farWrist: [BENCH_ROW_SHOULDER[0] + 5, BENCH_ROW_TOP + CHAIN_HAND_REST],
      },
    ],
  },
  // chain movements are added above this line
};

/**
 * The figure for a chain movement at phase `ph`: 0 is the first pose, 1 the
 * second, and so on, with every direction and the root blended in between.
 * Returns the 3D model, the joints it is drawn from, the spine's drawn path,
 * and where the hands grip and the toes are.
 */
export function chainGeometry(slug: string, ph: number, body: BodyParameters, turn = 0) {
  const movement = CHAIN_MOVEMENTS[slug];
  if (movement === undefined) throw new Error(`canonicalFigure: no chain movement for '${slug}'`);
  const view = movement.view ?? 'side';
  const front = view === 'front';
  const count = movement.poses.length;
  const last = count - 1;
  let t = Math.max(0, Math.min(last, ph));
  let index = Math.min(Math.max(0, last - 1), Math.floor(t));
  let u = last === 0 ? 0 : t - index;
  let next = Math.min(last, index + 1);
  if (movement.cycle === true) {
    // Each gap between keyframes is eased in and out; undoing that ease here
    // leaves the phase running evenly through the loop.
    t = ((ph % count) + count) % count;
    index = Math.floor(t);
    const eased = t - index;
    u = eased < 0.5 ? Math.sqrt(eased / 2) : 1 - Math.sqrt((1 - eased) / 2);
    next = (index + 1) % count;
  }
  const a = movement.poses[index];
  const b = movement.poses[next];
  const num = (x: number | undefined, y: number | undefined): number => (x ?? 0) + ((y ?? 0) - (x ?? 0)) * u;
  const dir = (x: ChainDir, y: ChainDir): readonly [number, number] => {
    const p = chainPair(x), q = chainPair(y);
    return [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
  };
  const optDir = (x: ChainDir | undefined, y: ChainDir | undefined): readonly [number, number] | undefined =>
    (x === undefined || y === undefined ? undefined : dir(x, y));
  const point = (x: ChainPoint | undefined, y: ChainPoint | undefined, name: string): ChainPoint | undefined => {
    if (x === undefined && y === undefined) return undefined;
    if (x === undefined || y === undefined || (x[2] === undefined) !== (y[2] === undefined)) {
      throw new Error(`canonicalFigure: '${slug}' gives '${name}' on some poses only`);
    }
    const flat: readonly [number, number] = [x[0] + (y[0] - x[0]) * u, x[1] + (y[1] - x[1]) * u];
    return x[2] === undefined || y[2] === undefined ? flat : [flat[0], flat[1], x[2] + (y[2] - x[2]) * u];
  };

  const at = point(a.at, b.at, 'at') as ChainPoint;
  const curl = num(a.curl, b.curl);
  const sideCurl = num(a.sideCurl, b.sideCurl);
  const roll = num(a.roll, b.roll);
  const shrug = num(a.shrug, b.shrug);
  const twist = num(a.twist, b.twist) + roll + turn * (movement.turnWithPhase === true ? Math.max(0, Math.min(1, ph)) : 1);
  const given = dir(a.trunk, b.trunk);
  const thigh = dir(a.thigh, b.thigh);
  const shin = dir(a.shin, b.shin);
  // Arms that follow the trunk turn by however far the top of the spine has left upright.
  const carried = movement.armsFollowTrunk === true ? given[0] - (movement.trunkAt === 'neck' ? 0 : curl) - 90 : 0;
  const carry = (d: readonly [number, number]): readonly [number, number] => [d[0] + carried, d[1]];
  const upperArm = carry(dir(a.upperArm, b.upperArm));
  const forearm = carry(dir(a.forearm, b.forearm));
  const farThigh = dir(a.farThigh ?? a.thigh, b.farThigh ?? b.thigh);
  const farShin = dir(a.farShin ?? a.shin, b.farShin ?? b.shin);
  const farUpperArm = carry(dir(a.farUpperArm ?? a.upperArm, b.farUpperArm ?? b.upperArm));
  const farForearm = carry(dir(a.farForearm ?? a.forearm, b.farForearm ?? b.forearm));
  const hand = optDir(a.hand, b.hand);
  const foot = optDir(a.foot, b.foot);
  const farFoot = optDir(a.farFoot ?? a.foot, b.farFoot ?? b.foot);
  const wristTarget = point(a.wrist, b.wrist, 'wrist');
  const farWristTarget = point(a.farWrist ?? a.wrist, b.farWrist ?? b.wrist, 'farWrist');
  const ankleTarget = point(a.ankle, b.ankle, 'ankle');
  const farAnkleTarget = point(a.farAnkle ?? a.ankle, b.farAnkle ?? b.ankle, 'farAnkle');

  // The spine, hip to neck, as a run of short steps. A curl turns each step a
  // little further toward the front of the body, so the trunk bends through
  // its length instead of hinging as one stiff piece.
  const atNeck = movement.trunkAt === 'neck';
  const hipEnd: readonly [number, number] = atNeck ? [given[0] + curl, given[1] - sideCurl] : given;
  const part = movement.spine ?? 'whole';
  const bend = (s: number): number => {
    if (part === 'upper') return Math.max(0, Math.min(1, (s - 0.4) / 0.6));
    if (part === 'lower') return Math.max(0, Math.min(1, s / 0.6));
    return s;
  };
  const tangent = (s: number): ChainVec => chainUnit([hipEnd[0] - curl * bend(s), hipEnd[1] + sideCurl * bend(s)], 1);
  const stepLength = CHAIN_TRUNK / CHAIN_SPINE_STEPS;
  const spineWorld: ChainVec[] = [[0, 0, 0]];
  for (let i = 0; i < CHAIN_SPINE_STEPS; i++) {
    spineWorld.push(chainAdd(spineWorld[i], tangent((i + 0.5) / CHAIN_SPINE_STEPS), stepLength));
  }
  const top = spineWorld[CHAIN_SPINE_STEPS];
  // From a planted ankle the hip is back up the near leg: shin, then thigh.
  const shinUp = chainUnit(shin, 1), thighUp = chainUnit(thigh, 1);
  // The hips sit square across the body, and turn about its length with a roll.
  const hipTangent = tangent(0);
  const hipLine = chainAcross(hipTangent);
  const hipFront = chainCross(hipTangent, hipLine);
  const hipAxis: ChainVec = roll === 0 ? hipLine : [
    hipLine[0] * Math.cos(chainRad(roll)) + hipFront[0] * Math.sin(chainRad(roll)),
    hipLine[1] * Math.cos(chainRad(roll)) + hipFront[1] * Math.sin(chainRad(roll)),
    hipLine[2] * Math.cos(chainRad(roll)) + hipFront[2] * Math.sin(chainRad(roll)),
  ];
  // From a planted far ankle the hip is back up the far leg, then across from the far hip joint.
  const farShinUp = chainUnit(farShin, -1), farThighUp = chainUnit(farThigh, -1);
  const farHipOut = body.hw * 0.8;
  // From a planted forefoot the ankle is back along the foot first.
  const footBack = movement.root === 'toe' && foot !== undefined ? chainUnit(foot, 1) : null;
  const heel: readonly [number, number] = footBack === null ? [0, 0] : [footBack[0] * CHAIN_FOOT, footBack[1] * CHAIN_FOOT];
  const shift: ChainVec = movement.root === 'neck' ? [at[0] - top[0], at[1] - top[1], 0]
    : movement.root === 'ankle' || movement.root === 'toe'
      ? [at[0] - heel[0] - (shinUp[0] * CHAIN_SHIN + thighUp[0] * CHAIN_THIGH), at[1] - heel[1] - (shinUp[1] * CHAIN_SHIN + thighUp[1] * CHAIN_THIGH), 0]
      : movement.root === 'farAnkle'
        ? [
          at[0] + hipAxis[0] * farHipOut - (farShinUp[0] * CHAIN_SHIN + farThighUp[0] * CHAIN_THIGH),
          at[1] + hipAxis[1] * farHipOut - (farShinUp[1] * CHAIN_SHIN + farThighUp[1] * CHAIN_THIGH),
          0,
        ]
        : [at[0], at[1], at[2] ?? 0];
  for (let i = 0; i <= CHAIN_SPINE_STEPS; i++) spineWorld[i] = chainAdd(spineWorld[i], shift, 1);
  const hip = spineWorld[0];
  const neck = spineWorld[CHAIN_SPINE_STEPS];
  const neckTangent = tangent(1);
  const headDir = optDir(a.head, b.head);
  const head = chainAdd(neck, headDir === undefined ? neckTangent : chainUnit(headDir, 1), CHAIN_NECK);

  // Shoulders and hips sit either side of the spine, square across the body,
  // and the shoulders turn about the spine with a twist.
  const shoulderLine = chainAcross(neckTangent);
  const forward = chainCross(neckTangent, shoulderLine);
  const tw = chainRad(twist);
  const shoulderAxis: ChainVec = [
    shoulderLine[0] * Math.cos(tw) + forward[0] * Math.sin(tw),
    shoulderLine[1] * Math.cos(tw) + forward[1] * Math.sin(tw),
    shoulderLine[2] * Math.cos(tw) + forward[2] * Math.sin(tw),
  ];
  const shoulderHalf = body.sw * 0.92;
  const hipHalf = body.hw * 0.8;
  const upperLength = front ? RAISE_UPPER_ARM : SAGITTAL_UPPER_ARM;
  const foreLength = front ? RAISE_FOREARM : SAGITTAL_FOREARM;

  /** The middle joint of a two-segment limb whose end is fixed, bent the way `pole` points. */
  const solve = (root: ChainVec, target: ChainVec, first: number, second: number, pole: ChainVec): ChainVec => {
    const d = Math.hypot(target[0] - root[0], target[1] - root[1], target[2] - root[2]) || 1;
    const along: ChainVec = [(target[0] - root[0]) / d, (target[1] - root[1]) / d, (target[2] - root[2]) / d];
    if (d >= first + second) return chainAdd(root, along, first);
    const k = (first * first - second * second + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, first * first - k * k));
    const p = chainDot(pole, along);
    const side = chainNormal([pole[0] - along[0] * p, pole[1] - along[1] * p, pole[2] - along[2] * p]);
    return chainAdd(chainAdd(root, along, k), side, h);
  };
  const limb = (
    root: ChainVec, side: number, first: readonly [number, number], second: readonly [number, number],
    firstLength: number, secondLength: number, target: ChainPoint | undefined, pole: ChainDir,
  ) => {
    if (target !== undefined) {
      const end: ChainVec = [target[0], target[1], target[2] ?? root[2]];
      return { root, mid: solve(root, end, firstLength, secondLength, chainUnit(chainPair(pole), side)), end };
    }
    const mid = chainAdd(root, chainUnit(first, side), firstLength);
    return { root, mid, end: chainAdd(mid, chainUnit(second, side), secondLength) };
  };
  // A shrug lifts both shoulders along the spine; the neck and head stay where they are.
  const girdleCentre = shrug === 0 ? neck : chainAdd(neck, neckTangent, shrug);
  const nearArm = limb(chainAdd(girdleCentre, shoulderAxis, shoulderHalf), 1, upperArm, forearm, upperLength, foreLength,
    wristTarget, movement.elbowPole ?? -135);
  const farArm = limb(chainAdd(girdleCentre, shoulderAxis, -shoulderHalf), -1, farUpperArm, farForearm, upperLength, foreLength,
    farWristTarget, movement.elbowPole ?? -135);
  const nearLeg = limb(chainAdd(hip, hipAxis, hipHalf), 1, thigh, shin, CHAIN_THIGH, CHAIN_SHIN,
    ankleTarget, movement.kneePole ?? 45);
  const farLeg = limb(chainAdd(hip, hipAxis, -hipHalf), -1, farThigh, farShin, CHAIN_THIGH, CHAIN_SHIN,
    farAnkleTarget, movement.kneePole ?? 45);
  const nearGrip = hand === undefined ? nearArm.end : chainAdd(nearArm.end, chainUnit(hand, 1), CHAIN_HAND);
  const farGrip = hand === undefined ? farArm.end : chainAdd(farArm.end, chainUnit(hand, -1), CHAIN_HAND);
  // What a bent hand holds sits on the palm's side of the knuckles.
  const holdOf = (grip: ChainVec, side: number): ChainVec => {
    if (hand === undefined || movement.palm === undefined) return grip;
    return chainAdd(grip, chainUnit([hand[0] + (movement.palm === 'up' ? 90 : -90), hand[1]], side), CHAIN_PALM);
  };
  const nearHold = holdOf(nearGrip, 1), farHold = holdOf(farGrip, -1);
  const feet = movement.feet ?? 'flat';
  const toeOf = (ankle: ChainVec, side: number, free: readonly [number, number] | undefined): ChainVec | null => {
    if (feet === 'flat') return [ankle[0] + CHAIN_FOOT, ankle[1], ankle[2]];
    if (feet === 'free' && free !== undefined) return chainAdd(ankle, chainUnit(free, side), CHAIN_FOOT);
    return null;
  };
  const nearToe = toeOf(nearLeg.end, 1, foot);
  const farToe = toeOf(farLeg.end, -1, farFoot);

  // What the viewer sees. A side view looks straight across the body, so the
  // far limbs would hide exactly behind the near ones; they are set back by
  // the side view's usual far-side offset instead.
  const yaw = chainRad(front ? 90 : view === 'oblique' ? movement.yawDeg ?? 35 : 0);
  const originX = movement.originX ?? (view === 'side' ? 0 : 50);
  const pitch = chainRad(view === 'oblique' ? movement.pitchDeg ?? 0 : 0);
  /** How far toward the viewer a point is. */
  const nearness = (q: ChainVec): number => q[0] * Math.sin(yaw) + q[2] * Math.cos(yaw);
  // Looking down, the nearest sole would drop below the floor line: the whole
  // figure is lifted by just that much, so its nearest foot still stands on it.
  const soles = [nearLeg.end, farLeg.end, nearToe, farToe].filter((q): q is ChainVec => q !== null);
  const lift = pitch === 0 ? 0
    : Math.max(...soles.map(nearness)) * Math.sin(pitch) + CHAIN_ANKLE_HEIGHT * (1 - Math.cos(pitch));
  const project = (q: ChainVec): CanonicalPoint => (pitch === 0
    ? [originX + q[0] * Math.cos(yaw) - q[2] * Math.sin(yaw), CHAIN_FLOOR - q[1]]
    : [originX + q[0] * Math.cos(yaw) - q[2] * Math.sin(yaw), CHAIN_FLOOR - lift - q[1] * Math.cos(pitch) + nearness(q) * Math.sin(pitch)]);
  const off: readonly [number, number] = view === 'side' ? FAROFF_DEFAULT : [0, 0];
  const projectFar = (q: ChainVec): CanonicalPoint => {
    const p = project(q);
    return [p[0] + off[0], p[1] + off[1]];
  };
  const spine = spineWorld.map(project).reverse();
  const nk = project(neck), hp = project(hip);
  const joints: FigureJoints = {
    hd: project(head), nk, hp,
    waist: spine[Math.round(0.56 * CHAIN_SPINE_STEPS)],
    nArm: project(nearArm.root), fArm: projectFar(farArm.root),
    nLeg: project(nearLeg.root), fLeg: projectFar(farLeg.root),
    el: project(nearArm.mid), wr: project(nearArm.end), ef: projectFar(farArm.mid), wf: projectFar(farArm.end),
    kn: project(nearLeg.mid), an: project(nearLeg.end), kf: projectFar(farLeg.mid), af: projectFar(farLeg.end),
  };
  return {
    movement, view, joints, project, projectFar, ph,
    /** The trunk's drawn centreline, neck first. Straight unless the spine is curled. */
    spine, curled: Math.abs(curl) > 1e-9 || Math.abs(sideCurl) > 1e-9,
    /** Whether the shoulders are drawn as a girdle out from the neck (any view that shows their width). */
    girdle: view === 'oblique' || (view === 'side' && Math.abs(twist) > 1e-9),
    world: {
      hip, neck, head, spine: spineWorld,
      near: { shoulder: nearArm.root, elbow: nearArm.mid, wrist: nearArm.end, grip: nearGrip, hold: nearHold, hipJoint: nearLeg.root, knee: nearLeg.mid, ankle: nearLeg.end, toe: nearToe },
      far: { shoulder: farArm.root, elbow: farArm.mid, wrist: farArm.end, grip: farGrip, hold: farHold, hipJoint: farLeg.root, knee: farLeg.mid, ankle: farLeg.end, toe: farToe },
    },
    grip: { near: project(nearGrip), far: projectFar(farGrip) },
    /** Where the held weight sits: the grip, moved to the palm's side when the hand is bent. */
    hold: { near: project(nearHold), far: projectFar(farHold) },
    toe: { near: nearToe ? project(nearToe) : null, far: farToe ? projectFar(farToe) : null },
    footWidth: feet === 'flat' ? body.lw * 0.9 : body.lw * 0.82,
    /** How far each held bell is tilted, inner end up, in degrees: none below half-way, all of it at the top. */
    peakTilt: movement.supinatedPeak === true ? BELL_TILT_DEG * Math.max(0, Math.min(1, (ph - 0.5) * 2)) : 0,
    angles: { trunk: given, curl, sideCurl, twist, roll, shrug, thigh, shin, upperArm, forearm, farThigh, farShin, farUpperArm, farForearm, hand, foot },
  };
}

/**
 * The line the trunk is drawn along, neck first: the two ends of a straight
 * trunk, or every point of a curled one. The torso checks measure the drawn
 * slices against this.
 */
export function trunkCentreline(pose: CanonicalPose, opts: FigureOptions): CanonicalPoint[] {
  const slug = slugOf(opts.assetKey);
  if (CHAIN_MOVEMENTS[slug] !== undefined && pose.ph !== undefined) {
    const figure = chainGeometry(slug, pose.ph, opts.body ?? CANONICAL_BODY_PARAMETERS, pose.tw ?? 0);
    if (figure.curled) return figure.spine;
  }
  const joints = resolveFigureJoints(pose, opts);
  return [joints.nk, joints.hp];
}

/** A chain movement's equipment, lines and held implement, grouped by where they are painted. */
function layoutChainExtras(
  figure: ReturnType<typeof chainGeometry>, body: BodyParameters, farColor: ColorRole, farOpacity: number,
  contractTilt: number | null = null,
) {
  // How far each held bell is tilted: the movement's own peak tilt, unless a
  // variant's declared orientation supplies it (the `derivesFrom` contract).
  const bellTilt = contractTilt ?? figure.peakTilt;
  const { movement, joints: j, project } = figure;
  const groups: Record<ChainLayer, FigurePrim[]> = { behind: [], mid: [], front: [] };
  const far: FigurePrim[] = [];
  const lines: FigurePrim[] = [];
  const near: FigurePrim[] = [];
  const line = (p: CanonicalPoint, q: CanonicalPoint, w: number, color: ColorRole, opacity: number): BonePrim =>
    ({ kind: 'bone', x1: p[0], y1: p[1], x2: q[0], y2: q[1], w, color, opacity });

  for (const shape of movement.equipment ?? []) {
    if (shape.kind === 'slab') {
      groups[shape.layer ?? 'mid'].push(line(project(chainWorld(shape.a)), project(chainWorld(shape.b)), 4, 'textMid', 1));
    } else if (shape.kind === 'frame') {
      groups[shape.layer ?? 'behind'].push(line(project(chainWorld(shape.a)), project(chainWorld(shape.b)), 1.6, 'textLow', 0.75));
    } else if (shape.kind === 'post') {
      const p = project(chainWorld(shape.at));
      groups[shape.layer ?? 'behind'].push(line(p, [p[0], GROUND_LINE], 1.6, 'textLow', 0.75));
    } else if (shape.kind === 'pulley') {
      const p = project(chainWorld(shape.at));
      groups[shape.layer ?? 'behind'].push({ kind: 'circle', cx: p[0], cy: p[1], r: 2.2, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    } else if (shape.kind === 'ball') {
      const p = project(chainWorld(shape.at));
      groups[shape.layer ?? 'mid'].push({ kind: 'circle', cx: p[0], cy: p[1], r: shape.r, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    } else if (shape.kind === 'box') {
      // A solid block between two opposite corners, as a box to step on.
      const p = project(chainWorld(shape.a)), q = project(chainWorld(shape.b));
      groups[shape.layer ?? 'behind'].push({
        kind: 'rect', x: Math.min(p[0], q[0]), y: Math.min(p[1], q[1]), w: Math.abs(q[0] - p[0]), h: Math.abs(q[1] - p[1]),
        rx: 1, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1,
      });
    } else {
      const p = project(chainWorld(shape.at));
      groups[shape.layer ?? 'front'].push({ kind: 'circle', cx: p[0], cy: p[1], r: 2.6, fill: 'textMid', opacity: 1 });
    }
  }

  for (const cable of movement.lines ?? []) {
    // Under the middle of the foot: ahead of the ankle from the side, at the ankle from the front.
    const underFoot = figure.view === 'front' ? 0 : CHAIN_FOOT / 2;
    // A band trapped under a foot starts on the floor: its own half-width above it.
    const trapped = CHAIN_FLOOR - 0.7;
    const start: CanonicalPoint = cable.from === 'nearFoot' ? [j.an[0] + underFoot, trapped]
      : cable.from === 'farFoot' ? [j.af[0] + underFoot, trapped]
        : project(chainWorld(cable.from));
    const end: CanonicalPoint = cable.to === 'nearGrip' ? figure.hold.near : cable.to === 'farGrip' ? figure.hold.far
      : cable.to === 'midGrip' ? [(figure.hold.near[0] + figure.hold.far[0]) / 2, (figure.hold.near[1] + figure.hold.far[1]) / 2]
        : cable.to === 'nearAnkle' ? j.an : j.af;
    (cable.depth === 'far' ? far : lines).push(line(start, end, 1.4, 'textMid', 1));
  }

  const handDot = (p: CanonicalPoint, color: ColorRole, opacity: number): FigurePrim =>
    ({ kind: 'circle', cx: p[0], cy: p[1], r: body.lw * 0.44, fill: color, opacity });
  if (figure.angles.hand !== undefined) {
    // A hand that bends at the wrist is its own short segment.
    far.push(line(j.wf, figure.grip.far, body.lw * 0.6, farColor, farOpacity));
    near.push(line(j.wr, figure.grip.near, body.lw * 0.6, 'textHi', 1));
  }
  far.push(handDot(figure.grip.far, farColor, farOpacity));
  near.push(handDot(figure.grip.near, 'textHi', 1));

  const kind = movement.implement ?? 'none';
  const bell = (grip: ChainVec, to: (q: ChainVec) => CanonicalPoint, color: ColorRole, opacity: number, out: FigurePrim[]): void => {
    const axis = movement.bellAxis ?? [0, 0, 1];
    const p = to(chainAdd(grip, axis, -4.2)), q = to(chainAdd(grip, axis, 4.2));
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (length < 2.4) {
      // The handle points at the viewer: the bell reads end-on in the fist.
      const c = to(grip);
      out.push({ kind: 'rect', x: c[0] - 2.8, y: c[1] - 2.8, w: 5.6, h: 5.6, rx: 1.6, fill: color, opacity, stroke: 'ink1', strokeWidth: 1.4 });
      return;
    }
    let a = p, b = q;
    if (bellTilt > 0) {
      // The inner end is the one nearer the neck, so two arms would mirror
      // about the midline. It rises and the outer end drops by the same amount.
      const rise = (length / 2) * Math.tan(chainRad(bellTilt));
      const inner = Math.abs(p[0] - j.nk[0]) <= Math.abs(q[0] - j.nk[0]) ? 'p' : 'q';
      a = [p[0], p[1] + (inner === 'p' ? -rise : rise)];
      b = [q[0], q[1] + (inner === 'q' ? -rise : rise)];
    }
    const drawn = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = -(b[1] - a[1]) / drawn * 2.2, ny = (b[0] - a[0]) / drawn * 2.2;
    out.push(line(a, b, 1.8, color, opacity));
    for (const end of [a, b]) {
      out.push({ ...line([end[0] - nx, end[1] - ny], [end[0] + nx, end[1] + ny], 2.6, color, opacity), stroke: 'ink1', strokeWidth: 0.6 });
    }
  };
  const w = figure.world;
  if (kind === 'bells' || kind === 'bell') {
    if (kind === 'bells') bell(w.far.hold, figure.projectFar, farColor, farOpacity, far);
    bell(w.near.hold, project, 'textHi', 1, near);
  } else if (kind === 'hammer') {
    far.push(...layoutHammerDumbbell(figure.grip.far, j.ef, false));
    near.push(...layoutHammerDumbbell(figure.grip.near, j.el));
  } else if (kind === 'bar' || kind === 'ez' || kind === 'cableBar') {
    const p = project(w.far.hold), q = project(w.near.hold);
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (length < 3) {
      // One bar through both hands, seen end-on at the near hand.
      if (kind === 'bar') near.push(...layoutEndOnBarbell(figure.hold.near));
      else if (kind === 'ez') near.push(...layoutEndOnEzBar(figure.hold.near));
      else near.push({ kind: 'circle', cx: figure.hold.near[0], cy: figure.hold.near[1], r: 2.4, fill: 'textHi', stroke: 'ink1', strokeWidth: 1, opacity: 1 });
    } else {
      // Seen along its length. From the front the whole bar is in front of
      // the body; turned, its far half passes behind.
      const ux = (q[0] - p[0]) / length, uy = (q[1] - p[1]) / length;
      const over = kind === 'cableBar' ? 3.5 : 9;
      const mid: CanonicalPoint = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const farEnd: CanonicalPoint = [p[0] - ux * over, p[1] - uy * over];
      const nearEnd: CanonicalPoint = [q[0] + ux * over, q[1] + uy * over];
      const whole = figure.view === 'front';
      const farGroup = whole ? near : far;
      const farTone: ColorRole = whole ? 'textHi' : farColor;
      const farAlpha = whole ? 1 : farOpacity;
      farGroup.push(line(mid, farEnd, 1.6, farTone, farAlpha));
      near.push(line(mid, nearEnd, 1.6, 'textHi', 1));
      if (kind !== 'cableBar') {
        const plate = (c: CanonicalPoint, color: ColorRole, opacity: number): FigurePrim =>
          ({ ...line([c[0] + uy * 4.2, c[1] - ux * 4.2], [c[0] - uy * 4.2, c[1] + ux * 4.2], 2.4, color, opacity), stroke: 'ink1', strokeWidth: 0.6 });
        farGroup.push(plate([farEnd[0] + ux * 2, farEnd[1] + uy * 2], farTone, farAlpha));
        near.push(plate([nearEnd[0] - ux * 2, nearEnd[1] - uy * 2], 'textHi', 1));
      }
    }
  } else if (kind === 'longBar' && movement.barAnchor !== undefined) {
    // One end braced on the floor, the near hand on the shaft just behind the plates at the other.
    const from = project(chainWorld(movement.barAnchor)), grip = figure.hold.near;
    const reach = Math.hypot(grip[0] - from[0], grip[1] - from[1]) || 1;
    const ux = (grip[0] - from[0]) / reach, uy = (grip[1] - from[1]) / reach;
    const length = movement.barLength ?? reach + 8;
    const end: CanonicalPoint = [from[0] + ux * length, from[1] + uy * length];
    near.push(line(from, end, 1.6, 'textHi', 1));
    for (const back of [2, 4.6]) {
      const c: CanonicalPoint = [end[0] - ux * back, end[1] - uy * back];
      near.push({ ...line([c[0] + uy * 6, c[1] - ux * 6], [c[0] - uy * 6, c[1] + ux * 6], 2.4, 'textHi', 1), stroke: 'ink1', strokeWidth: 0.6 });
    }
  } else if (kind === 'kettlebell') {
    // One kettlebell in the near hand: the handle across the palm, and the
    // round bell resting on the back of the wrist, below and behind the grip.
    const a = project(chainAdd(w.near.hold, [0, 0, 1], -2.6)), b = project(chainAdd(w.near.hold, [0, 0, 1], 2.6));
    const c = project(chainAdd(w.near.hold, KETTLEBELL_REST, 1));
    near.push({ kind: 'circle', cx: c[0], cy: c[1], r: KETTLEBELL_RADIUS, fill: 'textHi', stroke: 'ink1', strokeWidth: 1, opacity: 1 });
    near.push(line(a, b, 2.2, 'textHi', 1));
  } else if (kind === 'handle' || kind === 'handles' || kind === 'rope') {
    const r = kind === 'rope' ? 2.2 : 2.6;
    if (kind !== 'handle') far.push({ kind: 'circle', cx: figure.grip.far[0], cy: figure.grip.far[1], r, fill: farColor, opacity: farOpacity });
    near.push({ kind: 'circle', cx: figure.grip.near[0], cy: figure.grip.near[1], r, fill: 'textHi', opacity: 1 });
  }
  const panel = handCloseUp(figure);
  if (panel !== null) {
    // Back to front: the line from the real hand, the panel that hides whatever
    // is behind it, the wrist and palm, the fingers, and the bar they hold.
    groups.front.push(line(figure.grip.near, panel.centre, 0.8, 'textLow', 0.75));
    groups.front.push({ kind: 'circle', cx: panel.centre[0], cy: panel.centre[1], r: panel.r, fill: 'ink1', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    groups.front.push(line(panel.stub, panel.wrist, CLOSE_UP_HAND.wristHalf * 2 * panel.scale, 'textHi', 1));
    groups.front.push(line(panel.wrist, panel.knuckle, CLOSE_UP_HAND.palmHalf * 2 * panel.scale, 'textHi', 1));
    groups.front.push(line(panel.thumb[0], panel.thumb[1], CLOSE_UP_HAND.fingerHalf * 2 * panel.scale, 'textHi', 1));
    for (let i = 0; i < 3; i++) {
      groups.front.push(line(panel.finger[i], panel.finger[i + 1], CLOSE_UP_HAND.fingerHalf * 2 * panel.scale, 'textHi', 1));
    }
    groups.front.push({ kind: 'circle', cx: panel.bar[0], cy: panel.bar[1], r: CLOSE_UP_HAND.bar * panel.scale, fill: 'textMid', stroke: 'ink1', strokeWidth: 0.8, opacity: 1 });
  }
  return { ...groups, far, lines, near };
}

/**
 * The hand of the close-up, in hand units (one is a figure unit, about four
 * centimetres), with real proportions: a palm, a finger of three bones and a
 * bar of barbell thickness. Each finger bone's direction is measured from the
 * line of the hand, turning toward the palm: `closed` wraps the bar against
 * the end of the palm, `open` lets the fingers hang with only the last joint
 * hooked.
 */
const CLOSE_UP_PALM_HALF = 0.375, CLOSE_UP_FINGER_HALF = 0.21, CLOSE_UP_BAR = 0.36;
const CLOSE_UP_MIDDLE_BONE = 0.65;
/** How far the bar's centre is from the line of a finger bone it rests against. */
const CLOSE_UP_TOUCH = CLOSE_UP_BAR + CLOSE_UP_FINGER_HALF;
/**
 * The closed hand wraps the bar: the finger turns by the same angle at each
 * joint, the one that makes all three bones touch the bar at once. The first
 * bone is the length that then also rests the bar against the end of the palm.
 */
const CLOSE_UP_WRAP = 2 * Math.atan(CLOSE_UP_MIDDLE_BONE / (2 * CLOSE_UP_TOUCH)) * 180 / Math.PI;
const CLOSE_UP_FIRST_BONE = CLOSE_UP_MIDDLE_BONE / 2 + Math.sqrt((CLOSE_UP_PALM_HALF + CLOSE_UP_BAR) ** 2 - CLOSE_UP_TOUCH ** 2);
export const CLOSE_UP_HAND = {
  palm: 2.5, palmHalf: CLOSE_UP_PALM_HALF, wristHalf: 0.5, stub: 0.2,
  finger: [CLOSE_UP_FIRST_BONE, CLOSE_UP_MIDDLE_BONE, 0.6], fingerHalf: CLOSE_UP_FINGER_HALF, bar: CLOSE_UP_BAR,
  closed: [40, 40 + CLOSE_UP_WRAP, 40 + 2 * CLOSE_UP_WRAP], open: [-30, -5, 50],
} as const;
/** Where the knuckle sits in the panel, so that the whole hand is centred in it. */
const CLOSE_UP_KNUCKLE: readonly [number, number] = [0.25, -0.3];

/** The finger's four points for a given opening, from the knuckle at the origin: along the hand, and toward the palm. */
function closeUpFinger(open: number): [number, number][] {
  const points: [number, number][] = [[0, 0]];
  for (let i = 0; i < 3; i++) {
    const a = chainRad(CLOSE_UP_HAND.closed[i] + (CLOSE_UP_HAND.open[i] - CLOSE_UP_HAND.closed[i]) * open);
    points.push([points[i][0] + CLOSE_UP_HAND.finger[i] * Math.cos(a), points[i][1] + CLOSE_UP_HAND.finger[i] * Math.sin(a)]);
  }
  return points;
}
/**
 * Where a bar rests in the crook of the finger at joint `k`: touching the
 * bone before the joint and the bone after it, on the palm's side.
 */
function closeUpCrook(open: number, k: 1 | 2): [number, number] {
  const angle = (i: number): number => CLOSE_UP_HAND.closed[i] + (CLOSE_UP_HAND.open[i] - CLOSE_UP_HAND.closed[i]) * open;
  const turn = angle(k) - angle(k - 1);
  const reach = (CLOSE_UP_HAND.bar + CLOSE_UP_HAND.fingerHalf) / Math.cos(chainRad(turn / 2));
  const toward = chainRad(angle(k - 1) + 180 - (180 - turn) / 2);
  const joint = closeUpFinger(open)[k];
  return [joint[0] + reach * Math.cos(toward), joint[1] + reach * Math.sin(toward)];
}
/**
 * Where the bar is for a given opening. Closed, all three finger bones touch
 * it and it rests against the end of the palm; open, it is hooked in the last
 * joint. In between it rolls along the middle bone from one crook to the
 * other, touching that bone the whole way, so it is never loose and never
 * drawn through a finger.
 */
function closeUpBar(open: number): [number, number] {
  const first = closeUpCrook(open, 1), last = closeUpCrook(open, 2);
  return [first[0] + (last[0] - first[0]) * open, first[1] + (last[1] - first[1]) * open];
}

/**
 * The close-up of the near hand at this moment, or null when the movement has
 * none or the panel has not yet opened. Everything is in drawing coordinates.
 */
export function handCloseUp(figure: ReturnType<typeof chainGeometry>) {
  const closeUp = figure.movement.closeUp;
  if (closeUp === undefined) return null;
  const zoom = Math.max(0, Math.min(1, figure.ph));
  const open = Math.max(0, Math.min(1, figure.ph - 1));
  if (zoom < 1e-6) return null;
  const hand = figure.grip.near;
  const target = figure.project(chainWorld(closeUp.at));
  const centre: CanonicalPoint = [hand[0] + (target[0] - hand[0]) * zoom, hand[1] + (target[1] - hand[1]) * zoom];
  const scale = closeUp.scale * zoom;
  // The hand is drawn the way the figure's own forearm points, with the palm on the side a palms-up grip puts it.
  const j = figure.joints;
  const length = Math.hypot(j.wr[0] - j.el[0], j.wr[1] - j.el[1]) || 1;
  const along: CanonicalPoint = [(j.wr[0] - j.el[0]) / length, (j.wr[1] - j.el[1]) / length];
  const palmSide: CanonicalPoint = [along[1], -along[0]];
  const place = (q: readonly [number, number]): CanonicalPoint => [
    centre[0] + (along[0] * (q[0] + CLOSE_UP_KNUCKLE[0]) + palmSide[0] * (q[1] + CLOSE_UP_KNUCKLE[1])) * scale,
    centre[1] + (along[1] * (q[0] + CLOSE_UP_KNUCKLE[0]) + palmSide[1] * (q[1] + CLOSE_UP_KNUCKLE[1])) * scale,
  ];
  const finger = closeUpFinger(open);
  const bar = closeUpBar(open);
  return {
    zoom, open, centre, r: closeUp.r * zoom, scale,
    /** The hand model before it is placed: the finger's points and the bar, from the knuckle. */
    model: { finger, bar },
    stub: place([-CLOSE_UP_HAND.palm - CLOSE_UP_HAND.stub, 0]),
    wrist: place([-CLOSE_UP_HAND.palm, 0]),
    knuckle: place([0, 0]),
    thumb: [place([-CLOSE_UP_HAND.palm + 0.7, 0.25]), place([-CLOSE_UP_HAND.palm + 1.5, 0.7])] as const,
    finger: finger.map(place),
    bar: place(bar),
  };
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

/**
 * The joints the figure is actually drawn from. Starts from the authored pose,
 * applies the far side's perspective offset, front-view shoulder and hip
 * roots, any declared grip or turn, and then the movement-specific solved
 * geometry. Whatever is measured from the result is what gets painted.
 */
export function resolveFigureJoints(pose: CanonicalPose, opts: FigureOptions): FigureJoints {
  const { view, body = CANONICAL_BODY_PARAMETERS } = opts;
  const front = view === 'front';
  const slug = slugOf(opts.assetKey);

  const j: CanonicalPose = applyJointOffsets(pose, opts.jointOffsets);
  if (slug === REVERSE_LUNGE && j.rl !== undefined) return reverseLungeGeometry(j.rl, body).joints;
  if (slug === 'inverted-row' && j.ir !== undefined) return invertedRowGeometry(j.ir, body).joints;
  if (slug === 'body-tricep-press' && j.tp !== undefined) return bodyTricepPressGeometry(j.tp, body).joints;
  if (slug === ANKLE_KICKBACK && j.ke !== undefined) return kickbackGeometry(j.ke, body);
  if (PRONE_INCLINE_RAISE_SLUGS.has(slug) && j.pi !== undefined) {
    return proneInclineRaiseGeometry(j.pi, body, slug === 'barbell-incline-shoulder-raise').joints;
  }
  if (slug === SEATED_LATERAL_RAISE && j.la !== undefined) return seatedLateralRaiseGeometry(j.la, body).joints;
  if (CHAIN_MOVEMENTS[slug] !== undefined && j.ph !== undefined) return chainGeometry(slug, j.ph, body, j.tw ?? 0).joints;
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
  if (front && LATERAL_RAISE_ELBOW_DEG[slug] !== undefined && j.la !== undefined) {
    const raise = lateralRaiseArms(j.la, LATERAL_RAISE_ELBOW_DEG[slug], nArm, fArm);
    j.el = raise.near.el; j.wr = raise.near.wr;
    j.ef = raise.far.el; j.wf = raise.far.wr;
  }
  if (!front && FRONT_RAISE[slug] !== undefined && j.fr !== undefined) {
    // The far shoulder keeps its perspective offset for the whole rep. It must
    // not depend on whether the two hands happen to be close on this tick, or
    // a one-arm raise would shift the far shoulder part-way through.
    const spec = FRONT_RAISE[slug];
    const off = FAROFF[slug] ?? FAROFF_DEFAULT;
    nArm = [j.nk[0], j.nk[1]];
    fArm = [j.nk[0] + off[0], j.nk[1] + off[1]];
    const near = frontRaiseArm(j.fr, spec.softElbowDeg, nArm);
    const far = frontRaiseArm(spec.bothArms ? j.fr : FRONT_RAISE_FREE_ARM_DEG, spec.softElbowDeg, fArm);
    j.el = near.el; j.wr = near.wr;
    j.ef = far.el; j.wf = far.wr;
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
  if (front && LATERAL_RAISE_ELBOW_DEG[slug] !== undefined && pose.la !== undefined) {
    j.el = f.el; j.wr = f.wr; j.ef = f.ef; j.wf = f.wf;
  }
  if (!front && FRONT_RAISE[slug] !== undefined && pose.fr !== undefined) {
    j.el = f.el; j.wr = f.wr; j.ef = f.ef; j.wf = f.wf;
  }
  const fly = FLYE_INCLINES[slug] !== undefined && pose.fo !== undefined
    ? flyeGeometry(pose.fo, body, FLYE_INCLINES[slug]) : null;
  if (fly) for (const key of ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'an', 'kf', 'af'] as const) j[key] = f[key];
  const proneRaise = PRONE_INCLINE_RAISE_SLUGS.has(slug) && pose.pi !== undefined
    ? proneInclineRaiseGeometry(pose.pi, body, slug === 'barbell-incline-shoulder-raise') : null;
  if (proneRaise) for (const key of ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'an', 'kf', 'af'] as const) j[key] = f[key];
  const proneImplement = proneRaise
    ? layoutProneInclineImplement(proneRaise, slug === 'barbell-incline-shoulder-raise') : null;
  const seatedRaise = slug === SEATED_LATERAL_RAISE && pose.la !== undefined
    ? seatedLateralRaiseGeometry(pose.la, body) : null;
  if (seatedRaise) for (const key of ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'an', 'kf', 'af'] as const) j[key] = f[key];
  const seatedBells = seatedRaise ? layoutProjectedBells(seatedRaise) : null;
  const chain = CHAIN_MOVEMENTS[slug] !== undefined && pose.ph !== undefined ? chainGeometry(slug, pose.ph, body, pose.tw ?? 0) : null;
  if (chain) for (const key of ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'an', 'kf', 'af'] as const) j[key] = f[key];
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
  // A variant's supinated orientation tilts the bells at its peak step only, by the weight the contract gives.
  const contractTilt = opts.implementOrientation === 'supinated'
    ? BELL_TILT_DEG * (opts.implementTiltWeight ?? (opts.role === 'peak' ? 1 : 0)) : null;
  const chainDraw = chain ? layoutChainExtras(chain, body, farColor, farOpacity, contractTilt) : null;

  const prims: FigurePrim[] = [];

  // ---- Layer 1: apparatus / structure (behind everything but ground) ----
  // A chain movement brings its own equipment; the shared apparatus drawer is for the rest.
  if (!chain && !PREACHER_SLUGS.has(slug) && slug !== HEAD_SUPPORTED_RAISE) prims.push(...apparatus(slug, front, body));
  if (chainDraw) prims.push(...chainDraw.behind);
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
  const inclineCable = !chain && slug === 'incline-cable-chest-press' && !front
    ? layoutInclineCable(j, body, farColor, farOpacity) : null;
  const cableDraw = lowCable ?? inclineCable;
  if (cableDraw) prims.push(...cableDraw.farCable);

  // ---- Layer 2: far limbs ----
  // A far arm that crosses in front of the body is painted after the trunk instead.
  const farArmOver = chain !== null && chain.movement.farArmOver === true;
  if (!farArmOver) {
    prims.push(bone(fArm, j.ef, body.lw * 0.88, farColor, farOpacity));
    prims.push(bone(j.ef, j.wf, body.lw * 0.72, farColor, farOpacity));
  }
  prims.push(bone(fLeg, j.kf, body.lw * 1.18, farColor, farOpacity));
  prims.push(bone(j.kf, j.af, body.lw * 0.9, farColor, farOpacity));
  if (reverseLunge) prims.push(bone(reverseLunge.rearFoot[0], reverseLunge.rearFoot[1], reverseLunge.footWidth, farColor, farOpacity));
  else if (fly && fly.inclineDeg < 0) prims.push(bone(j.af, fly.farLeg.projected.toe, body.lw * 0.82, farColor, farOpacity));
  else if (seatedRaise) prims.push(bone(j.af, seatedRaise.farLeg.projected.toe, seatedRaise.footWidth, farColor, farOpacity));
  else if (chain && !front) { if (chain.toe.far) prims.push(bone(j.af, chain.toe.far, chain.footWidth, farColor, farOpacity)); }
  else if (!NOFEET.has(slug)) prims.push(foot(j.af, farColor, body, front, farOpacity,
    PERSPECTIVE_BARBELL_SLUGS.has(slug) ? 94.4 : 96.4));
  if (cableDraw) prims.push(...cableDraw.farHandle);
  if (chainDraw) {
    // Back to front: what the far hand holds, then the equipment the body rests on.
    if (!farArmOver) prims.push(...chainDraw.far);
    prims.push(...chainDraw.mid);
  }
  if (fly) prims.push(...layoutFlyeDumbbell(fly, false));
  if (seatedRaise && seatedBells) {
    // Back to front: the far bell and the hand that holds it, which travel
    // with the far arm behind the trunk, then the bench the athlete sits on.
    prims.push(...seatedBells.far);
    prims.push({ kind: 'circle', cx: j.wf[0], cy: j.wf[1], r: body.lw * 0.44, fill: farColor, opacity: farOpacity });
    for (const post of seatedRaise.posts) prims.push(bone(post[0], post[1], 1.6, 'textLow', 0.75));
    prims.push(bone(seatedRaise.slab[0], seatedRaise.slab[1], 4, 'textMid', 1));
  }
  if (proneRaise && proneImplement) {
    // Back to front: the far hand's implement, then the bench, which hides the
    // far arm where they cross, then the trunk lying on it.
    prims.push(...proneImplement.far);
    prims.push(bone(proneRaise.base[0], proneRaise.base[1], 1.6, 'textLow', 0.75));
    prims.push(bone(proneRaise.post[0], proneRaise.post[1], 1.6, 'textLow', 0.75));
    prims.push(bone(proneRaise.pad[0], proneRaise.pad[1], proneRaise.padHalf * 2, 'textMid', 1));
  }
  if (reverseLunge) prims.push(...layoutHammerDumbbell(j.wf, j.ef, false));
  if (slug === 'front-cable-raise' && FRONT_RAISE[slug] !== undefined && pose.fr !== undefined) {
    // The free hand travels with its arm, so the trunk hides it like the arm.
    prims.push({ kind: 'circle', cx: j.wf[0], cy: j.wf[1], r: body.lw * 0.44, fill: farColor, opacity: farOpacity });
  }

  // The row's bench sits BETWEEN the far leg and the torso: the kneeling
  // athlete's standing leg passes behind the bench, so the pad occludes it.
  // Drawing the pad with Layer 1 apparatus (behind the far limbs) put the far
  // shin in front of the bench slab (B1-247-R2). A row with a pose table
  // brings its own bench.
  if (!chain && ROW_SLUGS.has(slug)) {
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
  if (proneRaise) prims.push(bone(fArm, nArm, body.lw * 0.88, 'textLow', 1));
  if (seatedRaise || (chain && chain.girdle)) {
    // The shoulder girdle, as one piece out to each shoulder. With an upright
    // trunk a single bar across both shoulders would sit exactly where the
    // first trunk slice does and be mistaken for it by the torso checks.
    prims.push(bone(j.nk, fArm, body.lw * 0.88, 'textLow', 1));
    prims.push(bone(j.nk, nArm, body.lw * 0.88, 'textLow', 1));
  }
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
  // A curled spine is drawn along its own path, each slice square to the
  // spine where it sits; a straight one keeps the single shared normal.
  const curledSpine = chain && chain.curled ? chain.spine : null;
  for (let i = 0; i <= slices; i++) {
    const t = i / slices;
    if (curledSpine) {
      const here = curledSpine[i];
      const before = curledSpine[Math.max(0, i - 1)], after = curledSpine[Math.min(slices, i + 1)];
      const run = Math.hypot(after[0] - before[0], after[1] - before[1]) || 1;
      const across: CanonicalPoint = [-(after[1] - before[1]) / run, (after[0] - before[0]) / run];
      const half = !front ? sw + (Math.min(hw, sw * 0.9) - sw) * t
        : t <= 0.56 ? sw + (waistWidth - sw) * (t / 0.56) : waistWidth + (hw - waistWidth) * ((t - 0.56) / 0.44);
      prims.push(bone(
        [here[0] - across[0] * half, here[1] - across[1] * half],
        [here[0] + across[0] * half, here[1] + across[1] * half],
        Math.max(0.6, (24 / slices) * 1.6), 'textLow', 1,
      ));
      continue;
    }
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
  if (farArmOver && chainDraw) {
    prims.push(bone(fArm, j.ef, body.lw * 0.88, farColor, farOpacity));
    prims.push(bone(j.ef, j.wf, body.lw * 0.72, farColor, farOpacity));
    prims.push(...chainDraw.far);
  }

  // ---- Layer 4: near limbs ----
  // The preacher pad is in front of the chest; keep its support surface
  // visible while the working upper arm occludes it on the near side.
  // A pose-table movement brings its own pad (layoutChainExtras).
  if (!chain && PREACHER_SLUGS.has(slug)) prims.push(...apparatus(slug, front, body));
  prims.push(bone(nLeg, j.kn, body.lw * 1.18, 'textHi', 1));
  prims.push(bone(j.kn, j.an, body.lw * 0.9, 'textHi', 1));
  if (reverseLunge) prims.push(bone(reverseLunge.frontFoot[0], reverseLunge.frontFoot[1], reverseLunge.footWidth, 'textHi', 1));
  else if (fly && fly.inclineDeg < 0) prims.push(bone(j.an, fly.nearLeg.projected.toe, body.lw * 0.82, 'textHi', 1));
  else if (seatedRaise) prims.push(bone(j.an, seatedRaise.nearLeg.projected.toe, seatedRaise.footWidth, 'textHi', 1));
  else if (chain && !front) { if (chain.toe.near) prims.push(bone(j.an, chain.toe.near, chain.footWidth, 'textHi', 1)); }
  else if (!NOFEET.has(slug)) prims.push(foot(j.an, 'textHi', body, front, 1));
  const nearUpperArm = bone(nArm, j.el, body.lw * 0.88, 'textHi', 1);
  const nearForearm = bone(j.el, j.wr, body.lw * 0.72, 'textHi', 1);
  // A seated side-view press stacks the pressing arm beside the ear: the arm
  // is on the NEAR side of the head, so it draws AFTER the head ring —
  // otherwise the lockout elbow (authored over the shoulder axis per O-8)
  // hides inside the head circle and the press reads as clipped.
  const armAfterHead = slug === 'dumbbell-shoulder-press' || (chain !== null && chain.movement.nearArmOverHead === true);
  if (!armAfterHead) {
    prims.push(nearUpperArm, nearForearm);
  }

  // ---- Layer 5: neck & head ----
  if (SHRUG_SLUGS.has(slug) && pose.se !== undefined && pose.se > 0) {
    prims.push(bone(j.nk, nArm, body.lw * 0.8, 'textHi', 1));
  }
  // A pose-table shrug shows the same way: the lifted shoulder joined to the neck.
  if (chain && chain.angles.shrug > 0) prims.push(bone(j.nk, nArm, body.lw * 0.8, 'textHi', 1));
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
  if (chainDraw) prims.push(...chainDraw.lines);
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
  if (chain) {
    // A chain movement paints its own hands with what they hold, below.
  } else if ((equipment === 'none' || equipment === 'barbell' || equipment === 'kettlebell' || equipment === 'squat_rack')
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
  if (seatedRaise && seatedBells) {
    prims.push(...seatedBells.near);
    prims.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: body.lw * 0.44, fill: 'textHi', opacity: 1 });
  }
  if (proneRaise && proneImplement) {
    prims.push(...proneImplement.near);
    if (slug === 'dumbbell-incline-shoulder-raise') {
      prims.push({ kind: 'circle', cx: j.wf[0], cy: j.wf[1], r: body.lw * 0.44, fill: farColor, opacity: farOpacity });
      prims.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: body.lw * 0.44, fill: 'textHi', opacity: 1 });
    }
  }
  if (chainDraw) prims.push(...chainDraw.near, ...chainDraw.front);
  if (kickback) {
    const length = Math.hypot(j.an[0] - j.kn[0], j.an[1] - j.kn[1]);
    const half = (body.lw * 0.9 + 1) / 2;
    const dx = -(j.an[1] - j.kn[1]) / length * half, dy = (j.an[0] - j.kn[0]) / length * half;
    prims.push(bone([j.an[0] - dx, j.an[1] - dy], [j.an[0] + dx, j.an[1] + dy], 2.2, 'textMid', 1));
    for (const point of [j.wf, j.wr]) prims.push({ kind: 'circle', cx: point[0], cy: point[1], r: body.lw * 0.44, fill: 'textHi', opacity: 1 });
  }

  return prims;
}

/** One foot as a capsule from its ankle: flat across in front view, toe-forward and aimed at the floor in side view. */
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
  'cable-seated-lateral-raise': 'cable_machine',
  'reverse-flyes': 'dumbbells',
  'back-flyes-with-bands': 'band',
  'upright-barbell-row': 'barbell',
  'upright-row-with-bands': 'band',
  'barbell-side-split-squat': 'barbell',
  'floor-back-extension': 'none',
  'bench-dip': 'bench',
  'decline-push-up': 'bench',
  'road-run': 'none',
  'standing-rope-crunch': 'cable_machine',
  'kneeling-cable-crunch-with-alternating-oblique-twists': 'cable_machine',
  'decline-oblique-crunch': 'bench',
  'cable-russian-twists': 'cable_machine',
  'one-arm-high-pulley-cable-side-bends': 'cable_machine',
  'sit-up': 'none',
  'tuck-crunch': 'none',
  'reverse-crunch': 'none',
  'cable-reverse-crunch': 'cable_machine',
  'bent-knee-hip-raise': 'none',
  'decline-reverse-crunch': 'bench',
  'spider-curl': 'barbell',
  'concentration-curls': 'dumbbells',
  'decline-dumbbell-triceps-extension': 'dumbbells',
  'decline-ez-bar-triceps-extension': 'barbell',
  'cable-lying-triceps-extension': 'cable_machine',
  'low-cable-triceps-extension': 'cable_machine',
  'incline-dumbbell-curl': 'dumbbells',
  'incline-hammer-curls': 'dumbbells',
  'front-incline-dumbbell-raise': 'dumbbells',
  'cable-incline-triceps-extension': 'cable_machine',
  'dumbbell-lateral-raise': 'dumbbells',
  'lateral-raise-with-bands': 'band',
  'seated-side-lateral-raise': 'dumbbells',
  'dumbbell-front-raise': 'dumbbells',
  'front-cable-raise': 'cable_machine',
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
  'step-up-with-knee-raise': 'bench',
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

/** The fixed equipment a movement is done on or against (benches, racks, pulleys), painted behind the figure. */
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
  // A chain movement draws what it holds itself (layoutChainExtras).
  if (CHAIN_MOVEMENTS[slug] !== undefined && j.ph !== undefined) return out;
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
  if (equipment === 'dumbbells' && slug !== 'dumbbell-shrug' && slug !== 'preacher-hammer-dumbbell-curl' && slug !== HEAD_SUPPORTED_RAISE && FLYE_INCLINES[slug] === undefined && slug !== REVERSE_LUNGE && !PRONE_INCLINE_RAISE_SLUGS.has(slug) && slug !== SEATED_LATERAL_RAISE) {
    if (slug === 'hammer-curl') {
      // Neutral (thumbs-up) vertical orientation.
      if (j.wr) out.push({ kind: 'rect', x: j.wr[0] - 2.3, y: j.wr[1] - 6.5, w: 4.6, h: 13, rx: 1.6, fill: 'textHi', opacity: 1 });
      if (j.wf) out.push({ kind: 'rect', x: j.wf[0] - 2.3, y: j.wf[1] - 6.5, w: 4.6, h: 13, rx: 1.6, fill: farColor, opacity: farOpacity });
    } else if (slug === 'dumbbell-lateral-raise' || slug === 'dumbbell-front-raise') {
      // The bell's handle points at the viewer in both: a lateral raise seen
      // from the front, and a palms-back front raise seen from the side. So it
      // reads end-on in the fist for the whole rep. The outline keeps it apart
      // from the thigh at the start. From the side the two bells overlap, so
      // the far one is painted first; from the front they never meet and keep
      // the order the lateral raise was drawn in.
      const bell = (p: CanonicalPoint, color: ColorRole, opacity: number): void => {
        out.push({ kind: 'rect', x: p[0] - 2.8, y: p[1] - 2.8, w: 5.6, h: 5.6, rx: 1.6,
          fill: color, opacity, stroke: 'ink1', strokeWidth: 1.4 });
      };
      if (front) {
        if (j.wr) bell(j.wr, 'textHi', 1);
        if (j.wf) bell(j.wf, farColor, farOpacity);
      } else {
        if (j.wf) bell(j.wf, farColor, farOpacity);
        if (j.wr) bell(j.wr, 'textHi', 1);
      }
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
  if (slug === 'lateral-raise-with-bands' && j.wr && j.wf && j.an && j.af) {
    // The band is stood on at its middle and an end runs up to each hand. The
    // foot anchors never move, so the band visibly lengthens as the arms rise.
    const nearFoot: CanonicalPoint = [j.an[0], GROUND_LINE];
    const farFoot: CanonicalPoint = [j.af[0], GROUND_LINE];
    out.push({ kind: 'bone', x1: nearFoot[0], y1: nearFoot[1], x2: farFoot[0], y2: farFoot[1], w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'bone', x1: nearFoot[0], y1: nearFoot[1], x2: j.wr[0], y2: j.wr[1], w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'bone', x1: farFoot[0], y1: farFoot[1], x2: j.wf[0], y2: j.wf[1], w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: body.lw * 0.44, fill: 'textHi', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wf[0], cy: j.wf[1], r: body.lw * 0.44, fill: farColor, opacity: farOpacity });
  }
  if (slug === 'front-cable-raise' && j.wr && j.wf) {
    // One handle on a low pulley BEHIND the athlete. The working (near) hand
    // holds it; the free hand hangs empty and is painted with the far arm,
    // behind the trunk. The pulley never moves, so the cable swings up and
    // lengthens as the arm rises.
    const pulley = FRONT_CABLE_RAISE_PULLEY;
    out.push({ kind: 'bone', x1: pulley[0], y1: pulley[1], x2: pulley[0], y2: GROUND_LINE, w: 1.6, color: 'textLow', opacity: 0.75 });
    out.push({ kind: 'circle', cx: pulley[0], cy: pulley[1], r: 2.2, fill: 'line', stroke: 'textLow', strokeWidth: 1.2, opacity: 1 });
    out.push({ kind: 'bone', x1: pulley[0], y1: pulley[1], x2: j.wr[0], y2: j.wr[1], w: 1.4, color: 'textMid', opacity: 1 });
    out.push({ kind: 'circle', cx: j.wr[0], cy: j.wr[1], r: 2.6, fill: 'textHi', opacity: 1 });
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
