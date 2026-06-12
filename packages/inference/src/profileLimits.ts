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
import type { TrainingAge, UserProfile } from './types';

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
 *  applied. A beginner reporting pain/fatigue gets a more severe damping
 *  (lower work capacity, higher injury naivety); an advanced/elite athlete
 *  gets a milder one (higher baseline tolerance, better interoception).
 *  Severity is weakly monotone in experience (the 8.0 ceiling and 5.0 floor
 *  can bind for adjacent ages) — machine-verified across the REAL codebase
 *  entries in verify:policy [5]. */
export const EXPERIENCE_TRIAGE: Record<
  TrainingAge,
  { loadScale: number; capDelta: number; extraSetCut: number }
> = {
  beginner: { loadScale: 0.85, capDelta: -1.0, extraSetCut: 1 },
  intermediate: { loadScale: 1.0, capDelta: 0.0, extraSetCut: 0 },
  advanced: { loadScale: 1.1, capDelta: 1.0, extraSetCut: 0 },
  elite: { loadScale: 1.2, capDelta: 1.5, extraSetCut: 0 },
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
