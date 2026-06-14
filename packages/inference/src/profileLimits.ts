/**
 * profileLimits.ts — the athlete profile as a hard ceiling on prescriptions.
 *
 * Layer 2 of the prescription chain (policy -> PROFILE CLAMPS -> triage
 * guardrails). Like every layer after the policy, it is MONOTONE
 * CONSERVATIVE: it can only reduce load, remove sets, or lower the RPE cap —
 * never raise them (machine-verified sweep in test/verify_policy.mjs).
 * Each applied rule emits a human-readable note for the UI; the coaching cue
 * itself is never modified (140-char contract stays with its author).
 */
import type { AdjustmentVector } from './outputSchema';
import type { Guardrail } from './semantic/codebase';
import { EXPERIENCE_SEVERITY, type TrainingAge, type UserProfile } from './types';

export interface ProfileContext {
  /** Completed sessions today (>=1 logged set), excluding any active one. */
  sessionsToday: number;
  /** Distinct days with >=1 logged set in the trailing 7 days. */
  trainedDaysLast7: number;
}

export interface ProfileLimitedPrescription {
  vector: AdjustmentVector;
  /** One line per rule that actually changed something. */
  notes: string[];
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

export function applyProfileLimits(
  base: AdjustmentVector,
  profile: UserProfile,
  ctx: ProfileContext,
): ProfileLimitedPrescription {
  let load = base.load_modifier;
  let sets = base.set_modifier;
  let rpe = base.rpe_cap;
  const notes: string[] = [];

  if (rpe > profile.base_rpe_cap) {
    rpe = profile.base_rpe_cap;
    notes.push(`Profile effort ceiling: RPE capped at ${profile.base_rpe_cap.toFixed(1)}.`);
  }
  if (profile.training_age === 'beginner' && rpe > 8.5) {
    rpe = 8.5;
    notes.push('Beginner training age: RPE capped at 8.5.');
  }
  if (profile.objective === 'rehab' && rpe > 7.0) {
    rpe = 7.0;
    notes.push('Rehab objective: RPE capped at 7.0.');
  }
  // Daily session cap: work beyond the cap is damped once (no compounding).
  if (ctx.sessionsToday >= profile.max_sessions_per_day) {
    load = round2(load * 0.85);
    sets = Math.max(-3, sets - 1);
    if (rpe > 7.0) rpe = 7.0;
    notes.push(
      `Daily session cap reached (${ctx.sessionsToday}/${profile.max_sessions_per_day}): extra-session work is damped.`,
    );
  }
  // Weekly frequency: once the planned training days are spent, today is
  // maintenance, not progression.
  if (ctx.trainedDaysLast7 >= profile.weekly_frequency) {
    load = round2(load * 0.9);
    if (rpe > 7.5) rpe = 7.5;
    notes.push(
      `Weekly frequency reached (${ctx.trainedDaysLast7}/${profile.weekly_frequency} days): maintenance load today.`,
    );
  }

  return {
    vector: { load_modifier: load, set_modifier: sets, rpe_cap: rpe, coaching_cue: base.coaching_cue },
    notes,
  };
}

// ---------------------------------------------------------------------------
// Experience-weighted triage scaling
// ---------------------------------------------------------------------------
/** How training age rescales a RESTRICTIVE triage guardrail before it is
 *  applied — the DOMS-vs-structural model (Phase 12 Step 5). A BEGINNER's
 *  complaint is assumed benign DOMS and damped LESS (relaxed toward the matched
 *  baseline); an ELITE's complaint skews structural and is damped MORE. This is
 *  the INVERSE of the original "protect the naive beginner" weighting; the hard
 *  bounds in scaleGuardrailForExperience (load <= 1, set <= 0, RPE in [5,8])
 *  keep every age monotone conservative — a relaxed beginner can only approach
 *  the base, never train above it. Severity is weakly monotone in experience
 *  (the 8.0 ceiling / 5.0 floor can bind for adjacent ages) — machine-verified
 *  across the REAL codebase entries in verify:policy [5]. */
export const EXPERIENCE_TRIAGE: Record<
  TrainingAge,
  { loadScale: number; capDelta: number; extraSetCut: number }
> = {
  beginner: { loadScale: 1.2, capDelta: 2.0, extraSetCut: 0 },
  intermediate: { loadScale: 1.0, capDelta: 0.0, extraSetCut: 0 },
  advanced: { loadScale: 0.9, capDelta: -0.5, extraSetCut: 0 },
  elite: { loadScale: 0.8, capDelta: -1.0, extraSetCut: 1 },
};

/** Hard ceiling for ANY flagged (restrictive) report, every training age:
 *  a body complaint never trains above RPE 8. */
const FLAGGED_RPE_CEILING = 8.0;

/**
 * Rescale a triage guardrail for the athlete's training age.
 *
 * Safety bounds, none negotiable:
 *   - halt guardrails are returned UNCHANGED (a hard stop never relaxes);
 *   - no-op guardrails (positive reports) are returned UNCHANGED — scaling
 *     must never tighten a healthy report nor loosen anything;
 *   - load_multiplier never exceeds 1.0, set_delta never exceeds 0;
 *   - the scaled RPE cap stays inside [5.0, 8.0].
 * Composed through applyGuardrail this remains monotone conservative with
 * respect to the operative base prescription at every training age.
 */
export function scaleGuardrailForExperience(g: Guardrail, age: TrainingAge): Guardrail {
  const restrictive = g.load_multiplier < 1 || g.set_delta < 0 || g.rpe_cap_max < 10;
  if (g.halt || !restrictive) return g;
  const t = EXPERIENCE_TRIAGE[age];
  return {
    ...g,
    load_multiplier: Math.min(1, round2(g.load_multiplier * t.loadScale)),
    set_delta: Math.min(0, g.set_delta - t.extraSetCut),
    rpe_cap_max: Math.min(
      FLAGGED_RPE_CEILING,
      Math.max(5.0, Math.round((g.rpe_cap_max + t.capDelta) * 2) / 2),
    ),
  };
}

// ---------------------------------------------------------------------------
// Experience-weighted severity gating (Phase 12 Step 5)
// (EXPERIENCE_SEVERITY itself lives in types.ts — shared with substitution.ts.)
// ---------------------------------------------------------------------------
const HALT_GUARDRAIL = (followUp: string | null): Guardrail => ({
  load_multiplier: 0,
  set_delta: -2,
  rpe_cap_max: 0,
  halt: true,
  follow_up: followUp,
});
const NOOP_GUARDRAIL = (followUp: string | null): Guardrail => ({
  load_multiplier: 1,
  set_delta: 0,
  rpe_cap_max: 10,
  halt: false,
  follow_up: followUp,
});

/**
 * Gate a matched guardrail by the athlete's reported severity (1-10), scaled by
 * training age. This is the THRESHOLD axis (does it trigger / halt?), distinct
 * from scaleGuardrailForExperience's MAGNITUDE axis (how hard, once triggered).
 *
 * Safety: a red-flag HALT entry is NEVER relaxed — structural language overrides
 * any severity. Otherwise:
 *   severity >= haltMin(age)   -> escalate to a full halt (e.g. an elite at 6);
 *   severity <  triageMin(age) -> de-escalate to a no-op (benign / DOMS, e.g. a
 *                                 beginner at 4);
 *   in-band                    -> keep the matched guardrail unchanged (its
 *                                 magnitude is then experience-scaled).
 */
export function applySeverityToGuardrail(
  g: Guardrail,
  severity: number,
  age: TrainingAge,
): Guardrail {
  if (g.halt) return g;
  const sev = Math.min(10, Math.max(1, Math.round(severity)));
  const { triageMin, haltMin } = EXPERIENCE_SEVERITY[age];
  if (sev >= haltMin) return HALT_GUARDRAIL(g.follow_up);
  if (sev < triageMin) return NOOP_GUARDRAIL(g.follow_up);
  return g;
}
