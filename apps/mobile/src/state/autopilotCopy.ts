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

/** One stored autopilot change on a planned slot of the active block. */
export interface AppliedAdjustmentRow {
  readonly movementId: number;
  readonly movementName: string;
  readonly reason: string;
}

export interface AppliedAdjustmentLine {
  readonly key: string;
  readonly text: string;
}

/**
 * The Plan tab's "Changed in this block" lines. The rows are per planned slot,
 * so one movement repeats across sessions; it is listed once per movement and
 * reason, first occurrence kept. A reason with no plain wording is left out,
 * never shown as the stored token.
 */
export const appliedAdjustmentLines = (
  rows: readonly AppliedAdjustmentRow[],
): AppliedAdjustmentLine[] => {
  const seen = new Set<string>();
  const lines: AppliedAdjustmentLine[] = [];
  for (const row of rows) {
    const copy = autopilotReasonCopy(row.reason);
    if (copy === null) continue;
    const key = `${row.movementId}:${row.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push({ key, text: `${row.movementName}: ${copy}` });
  }
  return lines;
};
