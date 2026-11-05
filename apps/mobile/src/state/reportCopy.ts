/**
 * Plain words for a "Something feels off" report: which entry it matched and
 * what it changed today. Display only: nothing here reads or changes a
 * guardrail, a severity gate or a halt.
 */

/** The phrase-codebase entry ids (and the two red-flag overrides) in plain words. */
export const REPORT_ENTRY_NAME: Readonly<Record<string, string>> = {
  'pain-mild': 'Mild pain',
  'pain-moderate': 'Moderate pain',
  'pain-sharp': 'Sharp or sudden pain',
  'pain-chest': 'Chest pain',
  'illness-systemic': 'Feeling ill',
  dizzy: 'Dizziness',
  'fatigue-heavy': 'Everything feels heavy (slow bar speed)',
  'fatigue-sleep': 'Poor sleep',
  'soreness-doms': 'Normal muscle soreness (DOMS)',
  'technique-breakdown': 'Form breaking down',
  'positive-strong': 'Feeling strong',
  'equipment-improvised': 'Limited equipment',
  'red-flag-pain': 'Pain words in your report',
  'red-flag-systemic': 'Dizziness or chest symptoms',
};

/** Plain name for a matched entry id; null means the report matched nothing. */
export const reportEntryName = (entryId: string | null): string =>
  entryId === null ? 'Not matched to any entry' : REPORT_ENTRY_NAME[entryId] ?? 'A matched entry';

/** What a report changed, as differences from the plan without it. */
export interface ReportEffect {
  halt: boolean;
  /** Percent the planned load was reduced by (0 = unchanged). */
  loadReductionPct: number;
  /** Sets added (+) or removed (-) per lift. */
  setDelta: number;
  /** The tighter effort cap the report set, or null when the cap did not change. */
  rpeCap: number | null;
}

interface AdjustmentFigures {
  load_modifier: number;
  set_modifier: number;
  rpe_cap: number;
}

/** The report's own effect: the prescription with the report against the one without it. */
export function reportEffectBetween(
  withReport: AdjustmentFigures,
  withoutReport: AdjustmentFigures,
  halt: boolean,
): ReportEffect {
  const loadReductionPct = withoutReport.load_modifier > 0
    ? Math.max(0, Math.round((1 - withReport.load_modifier / withoutReport.load_modifier) * 100))
    : 0;
  return {
    halt,
    loadReductionPct,
    setDelta: withReport.set_modifier - withoutReport.set_modifier,
    rpeCap: withReport.rpe_cap < withoutReport.rpe_cap ? withReport.rpe_cap : null,
  };
}

const setsText = (delta: number): string => {
  const n = Math.abs(delta);
  if (n === 1) return delta < 0 ? 'one set fewer' : 'one set more';
  return `${n} ${delta < 0 ? 'fewer' : 'more'} sets`;
};

/** The changes in words, without a lead-in: "load reduced by 15% and one set fewer". Empty when nothing changed. */
export function reportEffectParts(effect: ReportEffect): string[] {
  const parts: string[] = [];
  if (effect.loadReductionPct > 0) parts.push(`load reduced by ${effect.loadReductionPct}%`);
  if (effect.setDelta !== 0) parts.push(setsText(effect.setDelta));
  if (effect.rpeCap !== null) parts.push(`effort capped at RPE ${effect.rpeCap}`);
  return parts;
}

const joinParts = (parts: readonly string[]): string => (parts.length <= 1
  ? parts.join('')
  : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);

/** One sentence: "Today: one set fewer and load reduced by 15%." or "Today's plan is unchanged." */
export function reportEffectText(effect: ReportEffect): string {
  if (effect.halt) return 'Training stopped for today.';
  const parts = reportEffectParts(effect);
  if (parts.length === 0) return 'Today\'s plan is unchanged.';
  return `Today: ${joinParts(parts)}.`;
}
