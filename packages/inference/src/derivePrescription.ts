/**
 * derivePrescription.ts — the COMPLETE three-layer daily derivation as one
 * pure function: policy(state_vector) → profile clamps → most-conservative
 * persisted report, experience-scaled, applied as a guardrail.
 *
 * Extracted from the store (2026-06-12) after mutation testing proved the
 * layer-3 wiring had zero machine coverage: deleting the experience-scaling
 * call inside useStore failed no verifier. The store is now a thin SQL
 * adapter over this function, and verify:policy [6] exercises the function
 * against the REAL phrase codebase — restart survival, tie ordering, and
 * training-age bounds are pinned here, not claimed in comments.
 *
 * Purity is the restart-survival proof: same persisted inputs in, same
 * prescription out — there is nothing in memory to lose.
 */
import type { AdjustmentVector } from './outputSchema';
import { getPrescription, type AdjustmentSource } from './prescribe';
import {
  applyProfileLimits,
  scaleGuardrailForExperience,
  type ProfileContext,
} from './profileLimits';
import { isNoOpGuardrail, type PhraseEntry } from './semantic/codebase';
import {
  applyGuardrail,
  moreConservative,
  type SessionDirective,
} from './semantic/triage';
import type { StateVectorRow, UserProfile } from './types';

export interface DeriveInput {
  vector: StateVectorRow;
  profile: UserProfile;
  ctx: ProfileContext;
  /** Resolved entries of today's persisted subjective_report rows, in
   *  report_id order (order must not matter — verified). */
  reports: readonly PhraseEntry[];
}

export interface DerivedPrescription {
  vector: AdjustmentVector;
  source: AdjustmentSource;
  /** Profile-clamp notes (layer 2), independent of layer 3. */
  notes: string[];
  /** The applied guardrail directive, or null when no report is operative. */
  directive: SessionDirective | null;
}

export function derivePrescription(input: DeriveInput): DerivedPrescription {
  const { vector, profile, ctx, reports } = input;

  // Layer 1: deterministic policy. Layer 2: profile clamps.
  const base = getPrescription(vector);
  const limited = applyProfileLimits(base.vector, profile, ctx);

  // Layer 3: the single most conservative of today's RESTRICTIVE reports
  // (total order — halt, then load, then sets, then RPE cap), experience-
  // scaled, applied. Positive no-op entries are identity by definition: they
  // never become operative, so "it felt good" can never read as a guardrail.
  let operative: PhraseEntry | null = null;
  for (const e of reports) {
    if (isNoOpGuardrail(e.guardrail)) continue;
    if (operative === null || moreConservative(e.guardrail, operative.guardrail)) {
      operative = e;
    }
  }
  if (operative === null) {
    return {
      vector: limited.vector,
      source: limited.notes.length > 0 ? 'profile' : 'policy',
      notes: limited.notes,
      directive: null,
    };
  }
  const scaled: PhraseEntry = {
    ...operative,
    guardrail: scaleGuardrailForExperience(operative.guardrail, profile.training_age),
  };
  const directive = applyGuardrail(limited.vector, scaled, 1);
  return {
    vector: directive.vector,
    source: 'guardrail',
    notes: limited.notes,
    directive,
  };
}
