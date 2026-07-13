/**
 * conditionEngine.ts — Phase 13, Step 1: pure condition-multiplier math.
 *
 * A movement's physical demand is amplified by the implement / loading
 * conditions applied to it (Kettlebell, Banded, Earthquake Bar, Chains,
 * Bottom-Up, ...). Each condition carries positive multipliers persisted in
 * movement_prefix (014); the prefix vocabulary is the unified MOVEMENT_PREFIXES.
 *
 * This module is PURE and STANDALONE — it does NOT touch block generation, the
 * prescription, or the substitution engine; those consume it explicitly when
 * wired (Phase 13 Step 2 / later). Deterministic: no clock, no randomness,
 * fixed rounding — safe in the verifier and on-device alike.
 */
import { type MovementPrefix, type MovementPrefixCondition } from './types';

/** Neutral multiplier — a standard barbell / no condition applied. */
export const NEUTRAL_PREFIX_MODIFIER = 1.0;

export interface EffectiveLoad {
  /** The base mechanical load passed in (kg), clamped to >= 0. */
  baseLoad: number;
  /** Difficulty-adjusted load: baseLoad x product(difficultyModifier) — the
   *  "feels like" load the athlete must actually control. */
  effectiveLoad: number;
  /** CNS tax: baseLoad x product(cnsLoadModifier). */
  cnsLoad: number;
  /** Relative stability demand: product(stabilityRequirementModifier),
   *  dimensionless (1.0 = a stable barbell). */
  stabilityDemand: number;
  /** The prefixes whose modifiers were folded in, in application order. */
  appliedPrefixes: readonly MovementPrefix[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

/**
 * calculateEffectiveLoad — fold a base load through the applied prefix
 * conditions. Pure, deterministic, and order-independent for the products.
 *
 * @param baseLoad        base mechanical load (kg); non-finite / negative
 *                        inputs clamp to 0.
 * @param prefixModifiers the conditions applied to the movement. Empty array =>
 *                        identity (effectiveLoad == cnsLoad == baseLoad,
 *                        stabilityDemand == 1.0).
 */
export function calculateEffectiveLoad(
  baseLoad: number,
  prefixModifiers: readonly MovementPrefixCondition[],
): EffectiveLoad {
  const safeBase = Number.isFinite(baseLoad) && baseLoad > 0 ? baseLoad : 0;
  let cnsProduct = 1;
  let stabilityProduct = 1;
  let difficultyProduct = 1;
  const appliedPrefixes: MovementPrefix[] = [];
  for (const m of prefixModifiers) {
    // The 014 CHECK enforces > 0 at the DB boundary; guard anyway so a bad
    // object can never flip a multiplier to <= 0 and corrupt the product.
    const cns = m.cnsLoadModifier > 0 ? m.cnsLoadModifier : 1;
    const stab = m.stabilityRequirementModifier > 0 ? m.stabilityRequirementModifier : 1;
    const diff = m.difficultyModifier > 0 ? m.difficultyModifier : 1;
    cnsProduct *= cns;
    stabilityProduct *= stab;
    difficultyProduct *= diff;
    appliedPrefixes.push(m.prefixName);
  }
  return {
    baseLoad: round2(safeBase),
    effectiveLoad: round2(safeBase * difficultyProduct),
    cnsLoad: round2(safeBase * cnsProduct),
    stabilityDemand: round4(stabilityProduct),
    appliedPrefixes,
  };
}

// ---------------------------------------------------------------------------
// P16 T1: condition applicability. A condition multiplier only makes physical
// sense on the implement it modifies — Earthquake Bar and Chains hang plates
// on a BARBELL, Bottom-Up inverts a KETTLEBELL, the KB offset-mass weights
// apply when the implement IS a kettlebell. Banded attaches to anything.
// Shared by the SessionScreen chips AND the store's logging boundary so an
// inapplicable condition can never reach set_prefix.
// ---------------------------------------------------------------------------

const CONDITION_REQUIRES_IMPLEMENT: Readonly<Partial<Record<string, MovementPrefix>>> = {
  'Earthquake Bar': 'BB',
  Chains: 'BB',
  'Bottom-Up': 'KB',
  KB: 'KB',
};

/** True when `condition` is meaningful on the (effective) `implement`. */
export function conditionApplies(condition: MovementPrefix, implement: MovementPrefix): boolean {
  const required = CONDITION_REQUIRES_IMPLEMENT[condition];
  return required === undefined || required === implement;
}
