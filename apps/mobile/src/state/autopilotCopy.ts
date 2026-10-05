/**
 * autopilotCopy.ts — the ONE plain-language reading of an autopilot reason.
 *
 * Extracted verbatim from BlockScreen's `autopilotExplanation` (Sol R4 F2) so
 * Today and Plan say the same thing about the same persisted fact. Before this,
 * Today rendered the raw stored token (e.g. `held_safety`) to the athlete.
 *
 * An unrecognised reason returns null: the caller renders NO caption rather
 * than a raw database value or an invented explanation.
 */
import type { AutopilotAttributionReason } from './useStore';

export const autopilotReasonCopy = (
  reason: AutopilotAttributionReason | string | null | undefined,
): string | null => {
  switch (reason) {
    case 'eased': return 'Eased off — your recent sets felt harder than planned.';
    case 'raised': return 'Nudged up — your recent sets felt easier than planned.';
    case 'held_safety': return 'Eased for safety — a recent safety signal lowered this target.';
    default: return null;
  }
};
