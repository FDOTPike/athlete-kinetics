/**
 * kinematicAutopilot.ts — Phase 13, Step 3: the discrete-time Kinematic
 * Autopilot (the Flaw-Detection observer `F` and the bounded Control Action
 * `u_{t+1}`).
 *
 * A hand-translation of the DeepSeek-R1 derivation in
 *   docs/Kinematic Autopilot Math Derivation - DeepSeek.pdf
 *   docs/Kinematic_Autopilot_Derivation.md.txt   (clean text mirror)
 * into pure, deterministic TypeScript. Section references (§) below point at
 * that artifact.
 *
 * Design posture (mirrors conditionEngine.ts in Step 1): this module is PURE
 * and STANDALONE. `F` reads only bounded fixed-length numeric arrays (the store
 * pre-aggregates the trailing 21-day window via SQL, exactly the rollup the
 * §1 read-budget allows); `u` produces forward-looking PRESCRIPTION corrections
 * only. It NEVER touches the backward-looking `mech_daily` / ACWR pipeline —
 * the raw-vs-effective tonnage bifurcation is preserved by construction
 * (invariant 6). No clock, no randomness, no external libs: O(window) time,
 * O(1)-beyond-window space, safe under the 450 MB Hermes ceiling.
 *
 * The six machine-checkable invariants (§ "Invariant List") are exercised in
 * test/verify_autopilot.mjs.
 */
import {
  EXPERIENCE_SEVERITY,
  MOVEMENT_PATTERNS,
  type MacroPhase,
  type MovementPattern,
  type StateVectorRow,
  type TrainingAge,
  type UserProfile,
} from './types';
import {
  clampAdjustment,
  LOAD_MODIFIER_LITERALS,
  RPE_CAP_LITERALS,
  type AdjustmentVector,
} from './outputSchema';
import type { Guardrail } from './semantic/codebase';

// ---------------------------------------------------------------------------
// Constant tables (§ "Constant Tables") — every coefficient is a
// human-reviewable literal, mirroring the PHASE_MODS / EXPERIENCE_TRIAGE style.
// ---------------------------------------------------------------------------

/** Fixed parameters for the flaw-detection operator F. */
export const FLAW_DETECTION_CONSTANTS = {
  /** Decay factor λ for the exponential moving sum (0 < λ < 1). */
  LAMBDA: 0.88,
  /** Cap on absolute ΔE magnitude (RPE error) — E_max. */
  E_MAX: 3.0,
  /** Maximum niggle severity (joint scale) — J_max. */
  J_MAX: 10,
  /** Deadband for φ_base: |D_norm| < δ → 0. */
  DELTA: 0.15,
  /** Weight on the base accumulation term. */
  W_BASE: 0.7,
  /** Weight on the trend term. */
  W_TREND: 0.3,
  /** Scale factor inside tanh for the trend. */
  T_SCALE: 1.0,
  /** Minimum days with ≥1 logged set to trust the signal (else 'neutral'). */
  MIN_OBSERVATIONS: 5,
  /** φ threshold for the 'capacity_deficit' class. */
  THETA_DEFICIT: 0.3,
  /** |φ| threshold for the 'latent_headroom' class. */
  THETA_HEADROOM: 0.3,
} as const;

/** Bounds on how much the autopilot may change the next 4-week block. */
export const CONTROL_AUTHORITY = {
  /** Maximum total POSITIVE set additions across all patterns in one block. */
  MAX_ADDED_SETS: 2,
  /** Allowed load-modifier step (one literal step up/down). */
  LOAD_STEP: 0.05,
  /** Allowed RPE delta per block. */
  RPE_STEP: 0.5,
  /** Allowed set delta per pattern. */
  SET_STEP: 1,
  /** Deadband for φ: |φ| < DEADBAND → no action. */
  DEADBAND: 0.15,
  /** φ threshold for a STRONG deficit / headroom (one extra step of load). */
  STRONG_THRESHOLD: 0.4,
} as const;

/** Neutral load-modifier literal (a standard, unadjusted prescription). */
export const NEUTRAL_LOAD_MODIFIER = 1.0;

// ---------------------------------------------------------------------------
// Pure numeric helpers (only the §1-permitted primitives + fixed rounding)
// ---------------------------------------------------------------------------
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
/** RPE rounds to the nearest 0.5 (the codebase-wide rule). */
const roundToHalf = (n: number): number => Math.round(n * 2) / 2;
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
/** tanh via the permitted exp primitive: (e^{2x}−1)/(e^{2x}+1). Bounded (−1,1).
 *  The argument is clamped to [−20, 20]: tanh saturates to ±1 to full double
 *  precision well before |x|=20, so this is transparent for every in-domain
 *  input while making the exp() overflow (→ Infinity → NaN at |x| > ~354)
 *  unreachable even on a corrupt pre-aggregate — the trend term fails safe. */
const tanh = (x: number): number => {
  const e2x = Math.exp(2 * clamp(x, -20, 20));
  return (e2x - 1) / (e2x + 1);
};

/**
 * Snap a value to the nearest numeric literal in a SORTED (ascending) string
 * literal array; ties resolve to the LOWER literal. Pure, no library calls.
 */
export function snapToLiteral(value: number, literals: readonly string[]): number {
  let best = Number(literals[0]);
  let bestDist = Math.abs(value - best);
  for (let i = 1; i < literals.length; i++) {
    const cand = Number(literals[i]);
    const dist = Math.abs(value - cand);
    // Strict `<` keeps the earlier (lower, since ascending) literal on a tie.
    if (dist < bestDist) {
      best = cand;
      bestDist = dist;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// F — Flaw-Detection operator (§ "F — Flaw-Detection Operator")
// ---------------------------------------------------------------------------

/** Flaw classification per movement pattern. */
export type FlawClass = 'capacity_deficit' | 'latent_headroom' | 'caution' | 'neutral';

/** Per-pattern flaw signal produced by the detector. */
export interface PatternFlaw {
  pattern: MovementPattern;
  /** φ_p, round4, ∈ [−1, 1]. > 0 ⇒ capacity deficit, < 0 ⇒ latent headroom. */
  phi: number;
  flawClass: FlawClass;
  /** Count of days with ≥1 logged set in the window. */
  observations: number;
  /** Max niggle severity (0..10) over PATTERN_JOINTS[p] across the window —
   *  surfaced so the controller can apply the §u injury override INDEPENDENTLY
   *  of `flawClass` (the thin-data gate can collapse a niggling pattern to
   *  'neutral', so the class alone is not a sufficient injury signal). */
  maxJointSev: number;
}

/** Top-level flaw report (the observer output `F`). */
export interface FlawReport {
  patterns: Record<MovementPattern, PatternFlaw>;
  windowSummary: {
    /** Flaw class of the pattern carrying the largest |φ|. */
    dominantFlaw: FlawClass;
    maxAbsPhi: number;
    /** The pattern with the largest |φ| (null when all φ are 0). */
    criticalPattern: MovementPattern | null;
  };
  /** Active global guardrail from the most recent restrictive report, if any. */
  globalGuardrail: Guardrail | null;
}

/** Per-pattern, per-day windowed aggregates (the store pre-computes these from
 *  the 015 `set_prefix` side-car + `niggle` rows — F never re-aggregates raw
 *  sets at read time). All arrays are oldest-first, length = the window. */
export interface PatternDailyDelta {
  /** e_p(i): mean (rpe_actual − target_rpe) over the day's sets; null if none. */
  avgDeltaRPE: readonly (number | null)[];
  /** w_p(i): mean 1/max(1, effective_load_kg / max(base_load_kg, 0.01)) over
   *  the day's sets — the condition ATTENUATION weight ∈ (0, 1]; 0 if no sets. */
  avgAttenuation: readonly number[];
  /** n_p(i): integer set count for the pattern on day i. */
  setCount: readonly number[];
  /** j_p(i): max niggle severity (0..10) over PATTERN_JOINTS[p] on day i. */
  maxJointSev: readonly number[];
}

/**
 * Deterministic Flaw-Detection operator `F`. Consumes at most 21 daily rows
 * plus the per-pattern windowed aggregates, and the athlete's training age for
 * the experience-weighted triage gate.
 *
 * @param stateVectors  ≤ 21 consecutive daily rows, oldest first (defines W).
 * @param patternDailyDelta  per-pattern daily arrays (length = window).
 * @param trainingAge  drives the EXPERIENCE_SEVERITY[age].triageMin caution gate.
 * @param globalGuardrail  most-recent restrictive report's guardrail, or null
 *        (carried through to the report; consumed by `deriveControlAction`).
 */
export function detectFlaws(
  stateVectors: readonly StateVectorRow[],
  patternDailyDelta: Record<MovementPattern, PatternDailyDelta>,
  trainingAge: TrainingAge,
  globalGuardrail: Guardrail | null = null,
): FlawReport {
  const L = stateVectors.length; // window length (≤ 21)
  const lastIdx = L > 0 ? L - 1 : 0;
  const {
    LAMBDA, E_MAX, J_MAX, DELTA, W_BASE, W_TREND, T_SCALE,
    MIN_OBSERVATIONS, THETA_DEFICIT, THETA_HEADROOM,
  } = FLAW_DETECTION_CONSTANTS;
  const triageMin = EXPERIENCE_SEVERITY[trainingAge].triageMin;

  // §1 Normalization S_max = Σ_{k=0}^{lastIdx} λ^k = (1 − λ^L)/(1 − λ).
  // Generalized to the actual window length so partial histories (a new
  // athlete with < 21 days) stay normalized and the newest day weighs 1.
  const sMax = L > 0 ? (1 - Math.pow(LAMBDA, L)) / (1 - LAMBDA) : 1;

  const patterns = {} as Record<MovementPattern, PatternFlaw>;
  let maxAbsPhi = 0;
  let criticalPattern: MovementPattern | null = null;

  for (const p of MOVEMENT_PATTERNS) {
    const s = patternDailyDelta[p];
    const eArr = s?.avgDeltaRPE ?? [];
    const wArr = s?.avgAttenuation ?? [];
    const nArr = s?.setCount ?? [];
    const jArr = s?.maxJointSev ?? [];

    let P = 0; // §2 deficit accumulation
    let N = 0; // §2 headroom accumulation
    let obs = 0;
    let maxJ = 0;
    // §4 trend windows: oldest up-to-7 days [0..oldTo], newest up-to-7 days
    // [recentFrom..L-1]. recentFrom is floored at oldTo+1 so the two windows are
    // DISJOINT even for short (< 14-day) histories — at L=21 this is exactly the
    // derivation's [0..6] / [14..20] (no day is ever double-counted in the trend).
    const oldTo = Math.min(6, lastIdx);
    const recentFrom = Math.max(oldTo + 1, L - 7);
    let oldSum = 0; let oldCnt = 0;
    let recSum = 0; let recCnt = 0;

    for (let i = 0; i < L; i++) {
      const ni = i < nArr.length ? nArr[i] : 0;
      const ji = i < jArr.length ? jArr[i] : 0;
      if (ni > 0) obs += 1;
      if (ji > maxJ) maxJ = ji;
      const ei = i < eArr.length ? eArr[i] : null;
      // Skip days with no defined ΔE — and defend against a non-finite aggregate
      // (a corrupt upstream value must never poison P/N or the trend → NaN φ).
      if (ei === null || !Number.isFinite(ei)) continue;
      const wiRaw = i < wArr.length ? wArr[i] : 0;
      // The attenuation weight is a reciprocal in (0,1] by construction; clamp to
      // that domain and coerce non-finite to 0 so a bad weight can neither flip
      // the control direction (negative w) nor blow up the sum (Infinity/NaN).
      const wi = Number.isFinite(wiRaw) ? Math.min(1, Math.max(0, wiRaw)) : 0;
      const omega = Math.pow(LAMBDA, lastIdx - i); // §1 ω_i = λ^(lastIdx − i)
      if (ei > 0) {
        // §2 P_p: recency × attenuation × capped error × injury attenuation.
        const injuryAtten = Math.max(0, 1 - ji / J_MAX);
        P += omega * wi * Math.min(ei, E_MAX) * injuryAtten;
      } else if (ei < 0) {
        // §2 N_p: headroom magnitude (NO injury attenuation — by derivation).
        N += omega * wi * Math.min(Math.abs(ei), E_MAX);
      }
      if (i <= oldTo) { oldSum += ei; oldCnt += 1; }
      if (i >= recentFrom) { recSum += ei; recCnt += 1; }
    }

    // §3 base signal + deadband.
    const dNorm = sMax > 0 ? (P - N) / (E_MAX * sMax) : 0;
    const phiBase = Math.abs(dNorm) < DELTA ? 0 : dNorm;
    // §4 trend.
    const eOld = oldCnt > 0 ? oldSum / oldCnt : 0;
    const eRecent = recCnt > 0 ? recSum / recCnt : 0;
    const tP = tanh((eRecent - eOld) / T_SCALE);
    // §5 final score (finite-guarded: corrupt inputs collapse to 0, not NaN).
    const phiRaw = W_BASE * phiBase + W_TREND * tP;
    const phi = Number.isFinite(phiRaw) ? round4(clamp(phiRaw, -1, 1)) : 0;

    // §6 classification (order matters: thin data, then injury, then φ bands).
    let flawClass: FlawClass;
    if (obs < MIN_OBSERVATIONS) flawClass = 'neutral';
    else if (maxJ >= triageMin) flawClass = 'caution';
    else if (phi >= THETA_DEFICIT) flawClass = 'capacity_deficit';
    else if (phi <= -THETA_HEADROOM) flawClass = 'latent_headroom';
    else flawClass = 'neutral';

    patterns[p] = { pattern: p, phi, flawClass, observations: obs, maxJointSev: maxJ };

    const absPhi = Math.abs(phi);
    if (absPhi > maxAbsPhi) { // strict ⇒ first pattern (declaration order) wins ties
      maxAbsPhi = absPhi;
      criticalPattern = p;
    }
  }

  const dominantFlaw: FlawClass =
    criticalPattern === null ? 'neutral' : patterns[criticalPattern].flawClass;

  return {
    patterns,
    windowSummary: { dominantFlaw, maxAbsPhi: round4(maxAbsPhi), criticalPattern },
    globalGuardrail,
  };
}

// ---------------------------------------------------------------------------
// u_{t+1} — Control Action operator (§ "u_{t+1} — Control Action Operator")
// ---------------------------------------------------------------------------

/** Per-pattern corrective perturbation for the next 4-week block. */
export interface PatternCorrection {
  /** Snapped to LOAD_MODIFIER_LITERALS (one of 0.95 / 1.00 / 1.05 here). */
  dLoad_p: number;
  /** Integer ∈ [−1, 1]. */
  dSet_p: number;
  /** ∈ [−0.5, 0.5], rounded to 0.5. */
  dRpe_p: number;
  /** Biases the substitution router (the shipped preference sentiment scale). */
  prefBias_p: -1 | 0 | 1;
}

/** The full control action for the upcoming block. */
export interface ControlAction {
  corrections: Record<MovementPattern, PatternCorrection>;
  /** Total positive set additions actually granted (≤ MAX_ADDED_SETS). */
  blockAddedSets: number;
}

const NEUTRAL_CORRECTION: PatternCorrection = {
  dLoad_p: NEUTRAL_LOAD_MODIFIER,
  dSet_p: 0,
  dRpe_p: 0,
  prefBias_p: 0,
};

/**
 * Derives the block-level auto-correction `u_{t+1}` from a FlawReport.
 *
 * Anti-windup / bounded authority (§5 invariant): per-pattern load moves at
 * most one literal step (±0.05) off neutral, set by ±1, RPE by ±0.5; total
 * positive set additions across the block are capped at MAX_ADDED_SETS.
 * Monotone-conservative under flags (§2): a 'caution' pattern or a restrictive
 * global guardrail may only reduce/neutralize. Halt supremacy (§4): a recorded
 * halt forces a fully neutral action.
 *
 * @param profile     the athlete (objective, base_rpe_cap, training_age) — the
 *                    downstream block projection clamps target_rpe to
 *                    [5.0, base_rpe_cap]; carried per the operator contract.
 * @param macroPhase  the next block's macro phase — same contract.
 */
export function deriveControlAction(
  report: FlawReport,
  profile: UserProfile,
  macroPhase: MacroPhase,
): ControlAction {
  void macroPhase; // contract param; consumed by the future block-projection (§2 snap)

  const g = report.globalGuardrail;
  const { DEADBAND, STRONG_THRESHOLD, MAX_ADDED_SETS } = CONTROL_AUTHORITY;
  const { MIN_OBSERVATIONS } = FLAW_DETECTION_CONSTANTS;
  // §u 4th override trigger needs the per-pattern injury threshold for this athlete.
  const triageMin = EXPERIENCE_SEVERITY[profile.training_age].triageMin;

  const corrections = {} as Record<MovementPattern, PatternCorrection>;

  // §4 Halt supremacy: a recorded halt is never relaxed — emit nothing else.
  if (g?.halt === true) {
    for (const p of MOVEMENT_PATTERNS) corrections[p] = { ...NEUTRAL_CORRECTION };
    return { corrections, blockAddedSets: 0 };
  }

  const restrictive =
    g !== null && (g.load_multiplier < 1 || g.set_delta < 0 || g.rpe_cap_max < 10);

  // Pass 1: raw deltas from the φ-threshold table, then the safety override.
  for (const p of MOVEMENT_PATTERNS) {
    const flaw = report.patterns[p];
    const phi = flaw.phi;
    // Confidence gate (spec §4.1 "no action on thin data") AND a fail-SAFE guard:
    // a thin-data or non-finite signal emits a neutral correction — it must never
    // fall through the φ-ladder into the authority-RAISING terminal branch.
    if (!Number.isFinite(phi) || flaw.observations < MIN_OBSERVATIONS) {
      corrections[p] = { ...NEUTRAL_CORRECTION };
      continue;
    }
    let rRpe: number; let rSet: number; let rLoad: number; let rPref: number;
    if (Math.abs(phi) < DEADBAND) {
      rRpe = 0; rSet = 0; rLoad = 1.0; rPref = 0;
    } else if (phi >= STRONG_THRESHOLD) {
      rRpe = -0.5; rSet = -1; rLoad = 0.95; rPref = -1;
    } else if (phi >= DEADBAND) {
      rRpe = -0.5; rSet = -1; rLoad = 1.0; rPref = -1;
    } else if (phi <= -STRONG_THRESHOLD) {
      rRpe = 0.5; rSet = 1; rLoad = 1.05; rPref = 1;
    } else {
      rRpe = 0.5; rSet = 1; rLoad = 1.0; rPref = 1;
    }

    // §2 Monotone-conservative override — the FOUR independent triggers of §u:
    // a 'caution' class, a restrictive global guardrail, OR an injured loaded
    // joint (maxJointSev ≥ triageMin) may only pull DOWN, never raise. The
    // injury trigger is INDEPENDENT of the class: F's thin-data gate can collapse
    // a niggling pattern to 'neutral', so the class alone would miss it (this was
    // a real monotone-conservatism hole — a severe niggle on < 5 logged days
    // could otherwise read as headroom and raise load into the injury).
    if (flaw.flawClass === 'caution' || restrictive || flaw.maxJointSev >= triageMin) {
      rRpe = Math.min(0, rRpe);
      rSet = Math.min(0, rSet);
      rLoad = Math.min(1.0, rLoad);
      rPref = Math.min(0, rPref);
    }

    corrections[p] = {
      dLoad_p: snapToLiteral(rLoad, LOAD_MODIFIER_LITERALS),
      dSet_p: clamp(Math.round(rSet), -1, 1),
      dRpe_p: roundToHalf(clamp(rRpe, -0.5, 0.5)),
      prefBias_p: clamp(Math.round(rPref), -1, 1) as -1 | 0 | 1,
    };
  }

  // Pass 2: §3 global volume budget (anti-windup on positive set additions).
  const positives = MOVEMENT_PATTERNS.filter((p) => corrections[p].dSet_p > 0);
  let blockAddedSets = positives.reduce((a, p) => a + corrections[p].dSet_p, 0);
  if (blockAddedSets > MAX_ADDED_SETS) {
    // Keep the patterns with the MOST headroom (lowest φ); tie → pattern order.
    const ranked = [...positives].sort(
      (a, b) =>
        report.patterns[a].phi - report.patterns[b].phi ||
        MOVEMENT_PATTERNS.indexOf(a) - MOVEMENT_PATTERNS.indexOf(b),
    );
    for (let k = MAX_ADDED_SETS; k < ranked.length; k++) {
      corrections[ranked[k]] = { ...corrections[ranked[k]], dSet_p: 0 };
    }
    blockAddedSets = MOVEMENT_PATTERNS.reduce(
      (a, p) => a + Math.max(0, corrections[p].dSet_p), 0,
    );
  }

  return { corrections, blockAddedSets };
}

/** A pattern token rendered into the CUE_RE-safe charset (no underscores). */
const patternLabel = (p: MovementPattern): string => p.replace(/_/g, ' ');

/** Deterministic coaching cue from the day's most-corrective pattern (§4). */
function coachingCue(
  action: ControlAction,
  dayPatterns: readonly MovementPattern[],
): string {
  let reduce: MovementPattern | null = null;
  let raise: MovementPattern | null = null;
  for (const p of MOVEMENT_PATTERNS) {
    if (!dayPatterns.includes(p)) continue;
    const c = action.corrections[p];
    if (c === undefined) continue;
    if (reduce === null && (c.dLoad_p < 1 || c.dSet_p < 0 || c.dRpe_p < 0)) reduce = p;
    if (raise === null && (c.dLoad_p > 1 || c.dSet_p > 0 || c.dRpe_p > 0)) raise = p;
  }
  if (reduce !== null) {
    return `Autopilot eased ${patternLabel(reduce)}: capacity deficit, target effort and load trimmed.`;
  }
  if (raise !== null) {
    return `Autopilot raised ${patternLabel(raise)}: latent headroom, target effort nudged up.`;
  }
  return 'Autopilot steady: block on plan, execute the session as written.';
}

/**
 * Projects the block ControlAction onto a single day's AdjustmentVector for the
 * patterns scheduled that day. Takes the MOST conservative correction across
 * the day's patterns (§4 min-composition). The result lands inside the shipped
 * AdjustmentVector literal domains and passes clampAdjustment idempotently
 * (invariant 3 — verified).
 */
export function deriveDailyAdjustment(
  action: ControlAction,
  dayPatterns: readonly MovementPattern[],
  profile: UserProfile,
): AdjustmentVector {
  let loadMod = NEUTRAL_LOAD_MODIFIER;
  let setMod = 0;
  let dRpeMin = 0;
  let seen = false;
  for (const p of dayPatterns) {
    const c = action.corrections[p];
    if (c === undefined) continue;
    if (!seen) {
      loadMod = c.dLoad_p; setMod = c.dSet_p; dRpeMin = c.dRpe_p; seen = true;
    } else {
      loadMod = Math.min(loadMod, c.dLoad_p);
      setMod = Math.min(setMod, c.dSet_p);
      dRpeMin = Math.min(dRpeMin, c.dRpe_p);
    }
  }
  // Clamp to the athlete's configured ceiling, NOT a flat 10.0: base_rpe_cap is a
  // hard profile clamp across the whole codebase (verify:blocks pins "target RPE
  // never exceeds base_rpe_cap"), so the autopilot may LOWER the session cap on a
  // deficit but never raise it above the athlete's personal max. This resolves the
  // derivation's §2 (clamp to base_rpe_cap) vs §4 (clamp to 10.0) inconsistency in
  // favour of the conservative bound. (The RPE_CAP_LITERALS vocabulary floors at
  // 6.5, so a sub-6.5 base_rpe_cap still snaps up to 6.5 as it always has.)
  const rpeRaw = clamp(profile.base_rpe_cap + dRpeMin, 5.0, profile.base_rpe_cap);
  const rpeCap = snapToLiteral(roundToHalf(rpeRaw), RPE_CAP_LITERALS);
  return clampAdjustment({
    load_modifier: loadMod,
    set_modifier: setMod,
    rpe_cap: rpeCap,
    coaching_cue: coachingCue(action, dayPatterns),
  });
}
