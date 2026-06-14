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
import { clampAdjustment, type AdjustmentVector } from './outputSchema';
import { getPrescription, type AdjustmentSource } from './prescribe';
import {
  applyProfileLimits,
  applySeverityToGuardrail,
  scaleGuardrailForExperience,
  type ProfileContext,
} from './profileLimits';
import { isNoOpGuardrail, type Guardrail, type PhraseEntry } from './semantic/codebase';
import {
  applyGuardrail,
  moreConservative,
  type SessionDirective,
} from './semantic/triage';
import type { StateVectorRow, UserProfile } from './types';

/** A resolved subjective report: the matched codebase entry plus the athlete's
 *  reported severity (1-10), or null when no severity was captured (legacy
 *  rows / pre-severity reports — the matched guardrail is then used as-is). */
export interface ReportInput {
  entry: PhraseEntry;
  severity: number | null;
  /** True when this report was RECORDED as a halt (subjective_report.halt). A
   *  recorded halt is a FACT — re-derivation never relaxes it, even if the
   *  athlete's training age (and thus the severity gate) later changes. Without
   *  this floor, toggling training age could un-halt a session. */
  wasHalt?: boolean;
}

export interface DeriveInput {
  vector: StateVectorRow;
  profile: UserProfile;
  ctx: ProfileContext;
  /** Today's persisted subjective_report rows, in report_id order (order must
   *  not matter — verified). */
  reports: readonly ReportInput[];
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
  // (total order — halt, then load, then sets, then RPE cap), each first
  // severity-gated by the athlete's reported severity + training age (DOMS-vs-
  // structural), then experience-magnitude-scaled, then applied. Penalties NEVER
  // compound: exactly one operative report survives. Positive no-op entries —
  // and reports the severity gate de-escalates to no-op — are identity, so "it
  // felt good" (or a benign sub-threshold complaint) can never read as a guardrail.
  let operative: { entry: PhraseEntry; guardrail: Guardrail } | null = null;
  for (const r of reports) {
    const gated: Guardrail = r.severity === null
      ? r.entry.guardrail
      : applySeverityToGuardrail(r.entry.guardrail, r.severity, profile.training_age);
    // A recorded halt is never relaxed by a later profile / severity re-gating —
    // re-impose the halt the report originally produced.
    const effective: Guardrail = r.wasHalt === true && !gated.halt ? { ...gated, halt: true } : gated;
    if (isNoOpGuardrail(effective)) continue;
    if (operative === null || moreConservative(effective, operative.guardrail)) {
      operative = { entry: r.entry, guardrail: effective };
    }
  }
  if (operative === null) {
    return {
      vector: clampAdjustment(limited.vector),
      source: limited.notes.length > 0 ? 'profile' : 'policy',
      notes: limited.notes,
      directive: null,
    };
  }
  const scaled: PhraseEntry = {
    ...operative.entry,
    guardrail: scaleGuardrailForExperience(operative.guardrail, profile.training_age),
  };
  const directive = applyGuardrail(limited.vector, scaled, 1);
  // Final floor: penalties can never push the prescription below the safe
  // envelope (set_modifier >= -3, load >= 0, rpe in [0,10]).
  const flooredVector = clampAdjustment(directive.vector);
  return {
    vector: flooredVector,
    source: 'guardrail',
    notes: limited.notes,
    directive: { ...directive, vector: flooredVector },
  };
}
