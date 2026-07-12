/**
 * progressionEngine.ts — P16: deterministic progression-ladder resolver.
 *
 * Answers "the athlete's goal is movement X — which rung of X's chain do we
 * prescribe today?" as a pure function of the chain and logged history.
 * No RNG, no IO, no Date. Same inputs always resolve the same rung, so block
 * generation stays reproducible (rev4 determinism rule).
 *
 * Data contract (P16 S4): movement rows carry nullable progression_group
 * (TEXT) + progression_rank (INTEGER). A chain is every movement sharing a
 * group, ordered by rank. Rank 0 may be a shipped movement; gaps are legal
 * (ranks are ordinals, not indices).
 *
 * Advancement rule: a rung is PASSED when logged history shows at least
 * `requiredSets` sets of `requiredReps` strict reps in one session at that
 * rung. The active rung is the lowest unpassed rung; a fully passed chain
 * keeps the goal movement active (mastery is maintenance, not graduation).
 */

export interface ProgressionRung {
  readonly movementName: string;
  readonly progressionGroup: string;
  readonly progressionRank: number;
}

/** Best single-session performance at a movement, from the athlete's log. */
export interface RungHistory {
  readonly movementName: string;
  readonly bestSets: number;
  readonly bestReps: number;
}

export interface AdvancementPolicy {
  readonly requiredSets: number;
  readonly requiredReps: number;
}

/** 3x8 strict — conservative default; tune per-chain in S4 seed data if needed. */
export const DEFAULT_ADVANCEMENT_POLICY: AdvancementPolicy = {
  requiredSets: 3,
  requiredReps: 8,
};

export interface RungResolution {
  /** The rung to prescribe now. */
  readonly active: ProgressionRung;
  /** Every rung below `active` that history has cleared, ascending rank. */
  readonly passed: readonly ProgressionRung[];
  /** The rung after `active`, or null when `active` is the goal movement. */
  readonly next: ProgressionRung | null;
}

function isPassed(
  rung: ProgressionRung,
  history: readonly RungHistory[],
  policy: AdvancementPolicy,
): boolean {
  for (const h of history) {
    if (
      h.movementName === rung.movementName &&
      h.bestSets >= policy.requiredSets &&
      h.bestReps >= policy.requiredReps
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Resolve the active rung of a progression chain.
 * Throws on malformed chains (empty, mixed groups, duplicate ranks) — a
 * malformed chain is seed-data corruption and must fail loudly, not resolve
 * arbitrarily.
 */
export function resolveActiveRung(
  chain: readonly ProgressionRung[],
  history: readonly RungHistory[],
  policy: AdvancementPolicy = DEFAULT_ADVANCEMENT_POLICY,
): RungResolution {
  if (chain.length === 0) {
    throw new Error('progression: empty chain');
  }
  const group: string = chain[0]!.progressionGroup;
  const seenRanks: Set<number> = new Set();
  for (const rung of chain) {
    if (rung.progressionGroup !== group) {
      throw new Error(
        `progression: mixed groups '${group}' / '${rung.progressionGroup}'`,
      );
    }
    if (seenRanks.has(rung.progressionRank)) {
      throw new Error(
        `progression: duplicate rank ${rung.progressionRank} in '${group}'`,
      );
    }
    seenRanks.add(rung.progressionRank);
  }

  const ordered: ProgressionRung[] = [...chain].sort(
    (a, b) => a.progressionRank - b.progressionRank,
  );

  const passed: ProgressionRung[] = [];
  let active: ProgressionRung = ordered[ordered.length - 1]!;
  let next: ProgressionRung | null = null;
  for (let i = 0; i < ordered.length; i += 1) {
    const rung: ProgressionRung = ordered[i]!;
    if (isPassed(rung, history, policy)) {
      passed.push(rung);
    } else {
      active = rung;
      next = i + 1 < ordered.length ? ordered[i + 1]! : null;
      return { active, passed, next };
    }
  }
  // Every rung passed: goal movement stays active.
  return { active, passed: passed.slice(0, -1), next: null };
}
