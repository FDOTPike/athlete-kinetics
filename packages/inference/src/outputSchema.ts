/**
 * outputSchema.ts — the prescription output contract.
 *
 * History: this file originally compiled these literals into a GBNF grammar
 * for an on-device generative SLM. Live-fire evaluation (June 2026) showed
 * sub-3B models hold the grammar 100% but cannot execute the numeric rule
 * table (constant outputs regardless of input), so the generative path was
 * removed entirely. The literal domains remain as the canonical output
 * vocabulary of the deterministic policy, and validateAdjustment() is the
 * runtime guard used by tests and any future output producer.
 */

// ---------------------------------------------------------------------------
// Canonical output domains (the policy's discrete vocabulary)
// ---------------------------------------------------------------------------
export const LOAD_MODIFIER_LITERALS = ['0.80', '0.85', '0.90', '0.95', '1.00', '1.05'] as const;
export const SET_MODIFIER_LITERALS = ['-2', '-1', '0', '1'] as const;
export const RPE_CAP_LITERALS = ['6.5', '7.0', '7.5', '8.0', '8.5', '9.0', '9.5', '10.0'] as const;

/** Cue length bounds (chars). Min stops degenerate one-word cues; max bounds
 *  UI layout. Charset excludes quotes/backslashes so cues embed anywhere. */
export const CUE_MIN_CHARS = 12;
export const CUE_MAX_CHARS = 140;
export const CUE_RE = new RegExp(`^[0-9A-Za-z .,;:%()+/?-]{${CUE_MIN_CHARS},${CUE_MAX_CHARS}}$`);

export interface AdjustmentVector {
  /** Multiplier on today's planned working weights. */
  load_modifier: number;
  /** Delta on planned working sets per movement. */
  set_modifier: number;
  /** Hard RPE ceiling for the session. */
  rpe_cap: number;
  /** One blunt mechanical-rationale sentence. */
  coaching_cue: string;
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------
const LOAD_SET = new Set<number>(LOAD_MODIFIER_LITERALS.map(Number));
const SETS_SET = new Set<number>(SET_MODIFIER_LITERALS.map(Number));
const RPE_SET = new Set<number>(RPE_CAP_LITERALS.map(Number));

export class AdjustmentValidationError extends Error {}

/**
 * Validate a policy-domain adjustment. Guardrail-modified vectors
 * (semantic/triage.ts) intentionally leave this domain (e.g. load 0.665
 * after a pain multiplier) and are validated by their own invariants.
 */
export function validateAdjustment(v: AdjustmentVector): AdjustmentVector {
  if (!LOAD_SET.has(v.load_modifier)) {
    throw new AdjustmentValidationError(`load_modifier out of domain: ${v.load_modifier}`);
  }
  if (!SETS_SET.has(v.set_modifier)) {
    throw new AdjustmentValidationError(`set_modifier out of domain: ${v.set_modifier}`);
  }
  if (!RPE_SET.has(v.rpe_cap)) {
    throw new AdjustmentValidationError(`rpe_cap out of domain: ${v.rpe_cap}`);
  }
  if (!CUE_RE.test(v.coaching_cue)) {
    throw new AdjustmentValidationError('coaching_cue fails charset/length contract');
  }
  return v;
}

/** Fail-safe: execute the plan exactly as written. */
export const NEUTRAL_ADJUSTMENT: AdjustmentVector = Object.freeze({
  load_modifier: 1.0,
  set_modifier: 0,
  rpe_cap: 9.0,
  coaching_cue: 'No valid state vector; execute the plan as written.',
});
