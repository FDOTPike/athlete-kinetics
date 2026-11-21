/**
 * blockWeekChanges — what a generated block actually does from week to week
 * (#169), read from its own planned slots: working sets and set-weighted
 * target effort per week. The phase cards and the build page say this instead
 * of fixed phase prose, which was true for one objective and false for
 * another (a hypertrophy block's "realise" week has its MOST sets).
 *
 * Pure. No numbers are invented: every figure is a sum or mean of the plan.
 */
export interface WeekSlotInput {
  readonly week: number;
  readonly phase: string;
  readonly sets: number;
  readonly targetRpe: number;
}

export interface BlockWeekTotal {
  readonly week: number;
  readonly phase: string;
  /** All working sets planned across the week. */
  readonly workingSets: number;
  /** Set-weighted mean target RPE, to the nearest 0.5. */
  readonly targetRpe: number;
}

const roundHalf = (value: number): number => Math.round(value * 2) / 2;

export function blockWeekTotals(slots: readonly WeekSlotInput[]): BlockWeekTotal[] {
  const byWeek = new Map<number, { phase: string; sets: number; weighted: number }>();
  for (const slot of slots) {
    const row = byWeek.get(slot.week) ?? { phase: slot.phase, sets: 0, weighted: 0 };
    row.sets += slot.sets;
    row.weighted += slot.sets * slot.targetRpe;
    byWeek.set(slot.week, row);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, row]) => ({
      week,
      phase: row.phase,
      workingSets: row.sets,
      targetRpe: row.sets === 0 ? 0 : roundHalf(row.weighted / row.sets),
    }));
}

/** The phase names the Plan tab uses. */
export const PHASE_NAME: Readonly<Record<string, string>> = {
  accumulation: 'Build',
  intensification: 'Build strength',
  realization: 'Realise',
  deload: 'Deload',
};

/** One plain sentence for a week, against the week before it. With
 *  `withPhase`, the week is named with its phase ("Week 3 (Realise): …"). */
export function describeBlockWeek(weeks: readonly BlockWeekTotal[], week: number, withPhase = false): string | null {
  const index = weeks.findIndex((row) => row.week === week);
  if (index < 0) return null;
  const now = weeks[index]!;
  const before = index === 0 ? null : weeks[index - 1]!;
  const phaseName = withPhase ? PHASE_NAME[now.phase] : undefined;
  const lead = phaseName === undefined ? `Week ${now.week}` : `Week ${now.week} (${phaseName})`;
  if (before === null) {
    return `${lead}: ${now.workingSets} working sets across the week, at a target effort of about RPE ${now.targetRpe}.`;
  }
  const sets = now.workingSets > before.workingSets
    ? `more working sets than week ${before.week} (${before.workingSets} → ${now.workingSets})`
    : now.workingSets < before.workingSets
      ? `fewer working sets than week ${before.week} (${before.workingSets} → ${now.workingSets})`
      : `the same working sets as week ${before.week} (${now.workingSets})`;
  const effort = now.targetRpe > before.targetRpe
    ? `at a higher target effort (RPE ${before.targetRpe} → ${now.targetRpe})`
    : now.targetRpe < before.targetRpe
      ? `at a lower target effort (RPE ${before.targetRpe} → ${now.targetRpe})`
      : `at the same target effort (RPE ${now.targetRpe})`;
  return `${lead}: ${sets}, ${effort}.`;
}

/** The phase card's text: what this block does in the weeks of that phase. */
export function phaseCardText(weeks: readonly BlockWeekTotal[], phase: string, phaseName: string): string | null {
  const lines = weeks
    .filter((row) => row.phase === phase)
    .map((row) => describeBlockWeek(weeks, row.week))
    .filter((line): line is string => line !== null);
  if (lines.length === 0) return null;
  return `${phaseName} in this block, from your plan:\n${lines.join('\n')}`;
}
