/**
 * sessionFeel.ts - how a finished session went, in the athlete's own taps.
 *
 * A record, not a decision. Nothing in this module changes a prescription, a
 * block, a progression or a cue, and nothing here reads free text. It only
 * says (1) when the completion screen should ask the question, and (2) whether
 * an answer is well formed.
 *
 * The question is asked only when a session did not go to plan: the neutral
 * outcome classifier (sessionOutcome.ts) says the session was not followed as
 * written, or the logged effort sat a full RPE point or more away from the
 * targets frozen at log time. An athlete whose session went to plan is not
 * asked anything.
 *
 * CONTRACT MIRROR (machine-checked by verify:outcomes):
 *   SESSION_FEEL_KINDS    <->  session_feel.feel CHECK domain (070)
 *   SESSION_FEEL_REASONS  <->  session_feel.reason_<name> columns (070)
 */
import type { SessionOutcomeKind } from './sessionOutcome';

export const SESSION_FEEL_ENGINE_VERSION = 1 as const;

export const SESSION_FEEL_KINDS = ['as_planned', 'harder', 'easier', 'stopped_early'] as const;
export type SessionFeelKind = (typeof SESSION_FEEL_KINDS)[number];

/** Why a session did not go as planned. Order is the order shown and stored. */
export const SESSION_FEEL_REASONS = [
  'pain', 'tired', 'unwell', 'technique', 'equipment', 'time', 'felt_good', 'other',
] as const;
export type SessionFeelReason = (typeof SESSION_FEEL_REASONS)[number];

/** Mean (logged RPE - target RPE) at or beyond this, in either direction, means "not to plan". */
export const SESSION_FEEL_RPE_DRIFT_THRESHOLD = 1;

export interface SessionFeelEffortSet {
  /** Logged RPE, or null when the set was not rated. */
  readonly rpe: number | null;
  /** Target RPE frozen with the set at log time, or null when it had none. */
  readonly targetRpe: number | null;
}

/** Mean of (rpe - targetRpe) over the sets that carry both. Null when none do. */
export function meanRpeDrift(sets: readonly SessionFeelEffortSet[]): number | null {
  let sum = 0;
  let count = 0;
  for (const set of sets) {
    if (set.rpe === null || set.targetRpe === null) continue;
    if (!Number.isFinite(set.rpe) || !Number.isFinite(set.targetRpe)) continue;
    sum += set.rpe - set.targetRpe;
    count += 1;
  }
  return count === 0 ? null : sum / count;
}

export interface SessionFeelPromptInput {
  readonly outcomeKind: SessionOutcomeKind;
  readonly meanRpeDrift: number | null;
}

/** True when the completion screen should ask how the session went. */
export function shouldAskSessionFeel(input: SessionFeelPromptInput): boolean {
  if (input.outcomeKind !== 'followed_plan') return true;
  return input.meanRpeDrift !== null
    && Number.isFinite(input.meanRpeDrift)
    && Math.abs(input.meanRpeDrift) >= SESSION_FEEL_RPE_DRIFT_THRESHOLD;
}

export interface SessionFeelDraft {
  readonly feel: SessionFeelKind | null;
  readonly reasons: readonly SessionFeelReason[];
}

export interface SessionFeelRecord {
  readonly feel: SessionFeelKind;
  /** De-duplicated, in SESSION_FEEL_REASONS order. Empty exactly when feel is 'as_planned'. */
  readonly reasons: readonly SessionFeelReason[];
}

export type SessionFeelProblem = 'feel_required' | 'reason_required' | 'unknown_value';

export type SessionFeelValidation =
  | { readonly ok: true; readonly record: SessionFeelRecord }
  | { readonly ok: false; readonly problem: SessionFeelProblem };

/**
 * A session that went as planned carries no reasons (any tapped earlier are
 * dropped). Any other answer needs at least one reason: the point of the
 * record is to know why.
 */
export function validateSessionFeel(draft: SessionFeelDraft): SessionFeelValidation {
  if (draft.feel === null) return { ok: false, problem: 'feel_required' };
  if (!(SESSION_FEEL_KINDS as readonly string[]).includes(draft.feel)) return { ok: false, problem: 'unknown_value' };
  if (draft.reasons.some((reason) => !(SESSION_FEEL_REASONS as readonly string[]).includes(reason))) {
    return { ok: false, problem: 'unknown_value' };
  }
  if (draft.feel === 'as_planned') return { ok: true, record: { feel: draft.feel, reasons: [] } };
  const reasons = SESSION_FEEL_REASONS.filter((reason) => draft.reasons.includes(reason));
  if (reasons.length === 0) return { ok: false, problem: 'reason_required' };
  return { ok: true, record: { feel: draft.feel, reasons } };
}
