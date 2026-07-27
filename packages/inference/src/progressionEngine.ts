/**
 * progressionEngine.ts — P16: deterministic progression-ladder resolver.
 *
 * Answers "the athlete's goal is movement X — which rung of X's chain do we
 * prescribe today?" as a pure function of the chain and logged history.
 * No RNG, no IO, no Date. Same inputs always resolve the same rung, so block
 * generation stays reproducible (rev4 determinism rule).
 *
 * Data contract (P16 S4): movement rows carry a movement_progression side-car
 * (progression_group TEXT, progression_rank INTEGER). A chain is every
 * movement sharing a group, ordered by rank. Rank 0 may be a shipped
 * movement; gaps are legal (ranks are ordinals, not indices).
 *
 * Advancement rule (audit F7: proven WITHIN one session): a rung is PASSED
 * when some single logged session at that movement contains at least
 * `requiredSets` sets of `requiredReps` strict reps. History therefore
 * arrives as per-session set lists, not cross-session maxima — three sessions
 * of 1x8 can never masquerade as one session of 3x8. The active rung is the
 * lowest unpassed rung; a fully passed chain keeps the goal movement active
 * (mastery is maintenance, not graduation).
 *
 * INTEGRATION STATUS: engine + gate only. The store query (set_record ->
 * SessionSets) and the generator/UI consumers land with P17's session runner;
 * until then this is machine-verified library code, not a live product path.
 */

export interface ProgressionRung {
  readonly movementName: string;
  readonly progressionGroup: string;
  readonly progressionRank: number;
}

/** All working sets of ONE session at one movement (rep counts per set). */
export interface SessionSets {
  readonly movementName: string;
  readonly repsPerSet: readonly number[];
}

export interface AdvancementPolicy {
  readonly requiredSets: number;
  readonly requiredReps: number;
}

/** Trailing window (in days) within which set evidence qualifies a rung.
 *  Defaulted to 180 days; subject to future optimization/tuning to balance
 *  athlete capability retention vs query engine performance. */
export const CAPABILITY_EVIDENCE_WINDOW_DAYS = 180;

/** 3x8 strict in a single session — conservative default; tune per-chain in
 *  seed data if needed. */
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
  history: readonly SessionSets[],
  policy: AdvancementPolicy,
): boolean {
  for (const session of history) {
    if (session.movementName !== rung.movementName) continue;
    let qualifying = 0;
    for (const reps of session.repsPerSet) {
      if (reps >= policy.requiredReps) qualifying += 1;
    }
    if (qualifying >= policy.requiredSets) return true;
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
  history: readonly SessionSets[],
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
  for (let i = 0; i < ordered.length; i += 1) {
    const rung: ProgressionRung = ordered[i]!;
    if (isPassed(rung, history, policy)) {
      passed.push(rung);
    } else {
      return { active: rung, passed, next: i + 1 < ordered.length ? ordered[i + 1]! : null };
    }
  }
  // Every rung passed: goal movement stays active.
  return { active: ordered[ordered.length - 1]!, passed: passed.slice(0, -1), next: null };
}
