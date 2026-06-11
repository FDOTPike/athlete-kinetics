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
import type { UserProfile } from './types';

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
