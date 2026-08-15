/**
 * returnFromLayoff.ts - 21-day return check-in evaluation.
 * Ratified in Calibration Policy v1 (Section 4).
 *
 * The check-in is an acknowledgement prompt and nothing more. Numerical return
 * modifiers remain deferred under the ratification, so no value here scales,
 * caps, or otherwise rewrites a planned dose.
 */

/** Calendar days without qualifying training evidence that open the check-in.
 *  A check-in threshold, NOT a claim that detraining begins on day 21. */
export const LAYOFF_GAP_DAYS = 21;

/** The two truthful actions. `review_first_session` routes to the existing
 *  plan-review path; it never pretends a numeric reduction was applied. */
export type ReturnAction = 'continue_plan' | 'review_first_session';

export interface ReturnEvaluation {
  readonly daysSinceLastTrained: number;
  /** true iff days >= LAYOFF_GAP_DAYS */
  readonly isLayoff: boolean;
  readonly options: readonly ReturnAction[];
}

export const RETURN_OPTIONS: readonly ReturnAction[] = Object.freeze([
  'continue_plan',
  'review_first_session',
]);

export function evaluateReturn(daysSinceLastTrained: number): ReturnEvaluation {
  const isLayoff = Number.isFinite(daysSinceLastTrained)
    && daysSinceLastTrained >= LAYOFF_GAP_DAYS;
  return Object.freeze({
    daysSinceLastTrained,
    isLayoff,
    options: RETURN_OPTIONS,
  });
}
