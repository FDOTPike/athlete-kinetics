/**
 * completionAction.ts - objective completion evidence for beginner control.
 *
 * This module is deliberately separate from the RPE observer. Completion
 * shortfall never becomes synthetic delta-RPE or phi. It produces an
 * independently bounded, never-upward ControlAction that may later be composed
 * with the RPE action at the action boundary.
 *
 * Numeric policy has no default. Callers must supply an explicitly ratified
 * policy; invalid policy fails closed to a neutral completion action.
 */
import { MOVEMENT_PATTERNS, type MovementPattern } from './types';
import type { ControlAction, PatternCorrection } from './kinematicAutopilot';

/** One grouped row per local (date, movement pattern). */
export interface WindowCompletionRow {
  /** ISO YYYY-MM-DD. */
  date: string;
  pattern: MovementPattern;
  /** Eligible prescribed repetition sets represented by this row. */
  evidenceCount: number;
  /** Sum of per-set shortfall values, each bounded to [0, 1]. */
  sumShortfall: number;
}

/** Calendar-aligned completion evidence for one movement pattern. */
export interface PatternDailyCompletion {
  /** Mean per-set shortfall for the day; null means no honest evidence. */
  avgShortfall: readonly (number | null)[];
  /** Eligible prescribed set count for the day. */
  evidenceCount: readonly number[];
}

/** Auditable window summary used by candidate action policies. */
export interface CompletionPatternSummary {
  observationDays: number;
  evidenceSets: number;
  /** Set-weighted mean shortfall across valid days; null when absent. */
  meanShortfall: number | null;
}

/**
 * Explicit candidate/ratified policy. No module-level production values exist.
 */
export interface CompletionActionPolicy {
  minObservationDays: number;
  deficitThreshold: number;
  strongThreshold: number;
}

const NEUTRAL_CORRECTION: PatternCorrection = {
  dLoad_p: 1,
  dSet_p: 0,
  dRpe_p: 0,
  prefBias_p: 0,
};

/** Existing moderate reduction row from the RPE control-action vocabulary. */
const REDUCE_CORRECTION: PatternCorrection = {
  dLoad_p: 1,
  dSet_p: -1,
  dRpe_p: -0.5,
  prefBias_p: -1,
};

/** Existing strong reduction row from the RPE control-action vocabulary. */
const STRONG_REDUCE_CORRECTION: PatternCorrection = {
  dLoad_p: 0.95,
  dSet_p: -1,
  dRpe_p: -0.5,
  prefBias_p: -1,
};

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

const round12 = (value: number): number =>
  Math.round(value * 1e12) / 1e12;

const isPositiveRepCount = (value: number): boolean =>
  Number.isInteger(value) && value >= 1 && value <= 100;

const keyOf = (date: string, pattern: MovementPattern): string =>
  `${date}|${pattern}`;

const neutralAction = (): ControlAction => {
  const corrections = {} as Record<MovementPattern, PatternCorrection>;
  for (const pattern of MOVEMENT_PATTERNS) {
    corrections[pattern] = { ...NEUTRAL_CORRECTION };
  }
  return { corrections, blockAddedSets: 0, blockAddedRpe: 0 };
};

/**
 * Objective shortfall for one honestly mapped logged repetition set.
 * Missing/invalid target or actual evidence is absent, never zero.
 */
export function loggedCompletionShortfall(
  targetReps: number | null,
  actualReps: number | null,
): number | null {
  if (
    targetReps === null ||
    actualReps === null ||
    !isPositiveRepCount(targetReps) ||
    !isPositiveRepCount(actualReps)
  ) {
    return null;
  }
  return clamp((targetReps - actualReps) / targetReps, 0, 1);
}

/**
 * Pivot grouped rows onto the fixed local-calendar window. Duplicate grouped
 * rows are safely re-aggregated, making the result input-order independent.
 */
export function buildCompletionWindow(
  windowDates: readonly string[],
  rows: readonly WindowCompletionRow[],
): Record<MovementPattern, PatternDailyCompletion> {
  const grouped = new Map<string, { count: number; sum: number }>();
  for (const row of rows) {
    if (!MOVEMENT_PATTERNS.includes(row.pattern)) continue;
    const count = Number.isFinite(row.evidenceCount)
      ? Math.max(0, Math.floor(row.evidenceCount))
      : 0;
    if (count === 0) continue;
    const sum = Number.isFinite(row.sumShortfall)
      ? clamp(row.sumShortfall, 0, count)
      : 0;
    const key = keyOf(row.date, row.pattern);
    const previous = grouped.get(key);
    grouped.set(key, {
      count: (previous?.count ?? 0) + count,
      sum: (previous?.sum ?? 0) + sum,
    });
  }

  const result = {} as Record<MovementPattern, PatternDailyCompletion>;
  for (const pattern of MOVEMENT_PATTERNS) {
    const avgShortfall: (number | null)[] = new Array(windowDates.length).fill(null);
    const evidenceCount: number[] = new Array(windowDates.length).fill(0);
    for (let index = 0; index < windowDates.length; index++) {
      const row = grouped.get(keyOf(windowDates[index], pattern));
      if (row === undefined || row.count === 0) continue;
      evidenceCount[index] = row.count;
      avgShortfall[index] = clamp(row.sum / row.count, 0, 1);
    }
    result[pattern] = { avgShortfall, evidenceCount };
  }
  return result;
}

/** Summarize a completion window without granting control authority. */
export function summarizeCompletionWindow(
  window: Record<MovementPattern, PatternDailyCompletion>,
): Record<MovementPattern, CompletionPatternSummary> {
  const result = {} as Record<MovementPattern, CompletionPatternSummary>;
  for (const pattern of MOVEMENT_PATTERNS) {
    const series = window[pattern];
    let observationDays = 0;
    let evidenceSets = 0;
    let weightedShortfall = 0;
    const length = Math.max(
      series?.avgShortfall.length ?? 0,
      series?.evidenceCount.length ?? 0,
    );
    for (let index = 0; index < length; index++) {
      const average = series?.avgShortfall[index] ?? null;
      const rawCount = series?.evidenceCount[index] ?? 0;
      const count = Number.isFinite(rawCount) ? Math.max(0, Math.floor(rawCount)) : 0;
      if (average === null || !Number.isFinite(average) || count === 0) continue;
      observationDays += 1;
      evidenceSets += count;
      weightedShortfall += clamp(average, 0, 1) * count;
    }
    result[pattern] = {
      observationDays,
      evidenceSets,
      meanShortfall: evidenceSets > 0
        ? round12(clamp(weightedShortfall / evidenceSets, 0, 1))
        : null,
    };
  }
  return result;
}

const validPolicy = (policy: CompletionActionPolicy): boolean =>
  Number.isInteger(policy.minObservationDays) &&
  policy.minObservationDays >= 1 &&
  Number.isFinite(policy.deficitThreshold) &&
  policy.deficitThreshold > 0 &&
  policy.deficitThreshold <= 1 &&
  Number.isFinite(policy.strongThreshold) &&
  policy.strongThreshold >= policy.deficitThreshold &&
  policy.strongThreshold <= 1;

/**
 * Derive a candidate completion action. This is not wired to production block
 * generation until its explicit policy has been ratified.
 */
export function deriveCompletionAction(
  window: Record<MovementPattern, PatternDailyCompletion>,
  policy: CompletionActionPolicy,
): ControlAction {
  if (!validPolicy(policy)) return neutralAction();
  const summaries = summarizeCompletionWindow(window);
  const action = neutralAction();
  for (const pattern of MOVEMENT_PATTERNS) {
    const summary = summaries[pattern];
    if (
      summary.observationDays < policy.minObservationDays ||
      summary.meanShortfall === null
    ) {
      continue;
    }
    if (summary.meanShortfall >= policy.strongThreshold) {
      action.corrections[pattern] = { ...STRONG_REDUCE_CORRECTION };
    } else if (summary.meanShortfall >= policy.deficitThreshold) {
      action.corrections[pattern] = { ...REDUCE_CORRECTION };
    }
  }
  return action;
}

/**
 * Fieldwise conservative composition. Identity is neutral; the result is
 * commutative, associative, and idempotent for correction-literal inputs.
 */
export function composeControlActions(
  ...actions: readonly ControlAction[]
): ControlAction {
  if (actions.length === 0) return neutralAction();
  const corrections = {} as Record<MovementPattern, PatternCorrection>;
  for (const pattern of MOVEMENT_PATTERNS) {
    let combined = {
      ...(actions[0].corrections[pattern] ?? NEUTRAL_CORRECTION),
    };
    for (let index = 1; index < actions.length; index++) {
      const action = actions[index];
      const correction = action.corrections[pattern] ?? NEUTRAL_CORRECTION;
      combined = {
        dLoad_p: Math.min(combined.dLoad_p, correction.dLoad_p),
        dSet_p: Math.min(combined.dSet_p, correction.dSet_p),
        dRpe_p: Math.min(combined.dRpe_p, correction.dRpe_p),
        prefBias_p: Math.min(combined.prefBias_p, correction.prefBias_p) as -1 | 0 | 1,
      };
    }
    corrections[pattern] = combined;
  }
  const blockAddedSets = MOVEMENT_PATTERNS.reduce(
    (total, pattern) => total + Math.max(0, corrections[pattern].dSet_p),
    0,
  );
  const blockAddedRpe = MOVEMENT_PATTERNS.reduce(
    (total, pattern) => total + Math.max(0, corrections[pattern].dRpe_p),
    0,
  );
  return { corrections, blockAddedSets, blockAddedRpe };
}
