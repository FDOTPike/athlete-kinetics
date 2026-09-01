/**
 * movementRanking.ts — the goal/tier movement-ranking policy (WO §2.4-2.6).
 *
 * A PURE, DETERMINISTIC ranking layer that runs ONLY AFTER the equipment,
 * tier, safety, capability, prior-experience, attestation and context gates.
 * It can choose among the gated-available and it can downgrade, but it can
 * never re-admit a candidate those gates rejected: every excluded candidate
 * is reported with the exact gate(s) that excluded it, and every fallback is
 * drawn only from the available.
 *
 * Owner contract implemented here:
 *   - a valid explicit athlete movement preference is FIRST priority;
 *   - for strength, the Competition Squat / Competition Bench / Deadlift
 *     anchors are selected whenever they are gated-available (big-lift
 *     contract §2.5), with the best available loaded rung disclosed as the
 *     substitute (with the anchor's name and its exact blockers) when an
 *     anchor is gated out;
 *   - an intermediate-or-higher non-rehab athlete is never defaulted to a
 *     strictly bodyweight movement while a compatible loaded candidate is
 *     available (§2.4 — objective-independent). Bodyweight is kept WITH an
 *     exact reason — the gates that removed every loaded option — when
 *     nothing loaded survives;
 *   - hypertrophy (bodybuilding, §2.6) carries no anchor obligation; the
 *     competition lifts stay available through an explicit preference.
 *
 * Modes:
 *   strength / hypertrophy / power / gpp / endurance / weight_loss / hybrid,
 *   intermediate-or-higher  → LOADED-FIRST: the engine's own compound-first,
 *     stable-id ordering is applied to LOADED candidates only; a strictly
 *     bodyweight candidate is chosen only when no loaded candidate survives,
 *     and then with its gate reasons. (Ordering among loaded candidates is
 *     deliberately the legacy law — the work order does not re-rank loaded
 *     rungs for non-strength objectives, and byte-stable non-strength
 *     defaults keep the blast radius on the defect.)
 *   strength (same mode)    → plus anchor promotion and substitute
 *     disclosure. Hypertrophy gets NO anchor promotion.
 *   beginner or rehab       → LEGACY: the historical compound-then-id order
 *     over ALL available candidates. The work order scopes the loaded-first
 *     law to non-rehab intermediate+; beginner ceilings and rehab
 *     conservativism already bind through the gates.
 *
 * Loaded vs bodyweight follows the L1(a) rule: the PLANNED implement is
 * 'Bodyweight' only when the slot's implement selection is exactly that.
 * Absence fails closed to the loaded path. (Same rule as blockGenerator's
 * isPurelyBodyweight; restated here because the generator imports THIS
 * module, so the import must stay one-directional.)
 *
 * Difficulty-tier exclusion reuses tierPolicy.isDifficultyAllowed — the one
 * tier law, never a restatement.
 */
import type { DifficultyRating, Objective, TrainingAge } from './types';
import { isDifficultyAllowed } from './tierPolicy';

export type RankingGate = 'equipment' | 'tier' | 'safety' | 'capability';

/** The gate list every exclusion report is ordered by. */
const GATE_ORDER: readonly RankingGate[] = ['equipment', 'tier', 'safety', 'capability'];

/**
 * The objective's block-generating focus KINDS. A focus is a SLOT-BEARING day
 * kind; the strength anchor capacity law (below) counts slots on the foci
 * that can carry the big three, after the duration shaping has already
 * trimmed each focus's pattern menu.
 */
const ANCHOR_FOCUS_KINDS: ReadonlySet<string> = new Set(['lower', 'full']);


/** A candidate already carrying the shared capability verdict. `excludedBy`,
 *  when provided, is the upstream gate report and is trusted as-is; when
 *  absent, a false `capabilityAvailable` means capability-excluded. The
 *  ranker ADDITIONALLY evaluates equipment, tier and safety from raw inputs
 *  so a stale upstream verdict cannot re-admit a rejected movement. */
export interface RankingCandidate {
  readonly movementId: number;
  readonly name: string;
  readonly difficulty: DifficultyRating;
  readonly required: readonly string[];
  /** The implement PLANNED for this slot (L1(a)). 'Bodyweight' = strictly
   *  bodyweight; absent/anything else = the loaded path. */
  readonly plannedImplement?: string;
  /** Shared verdict: available after equipment/tier/safety/capability. */
  readonly capabilityAvailable: boolean;
  /** Optional upstream gate report (MovementAvailability.reasons). */
  readonly excludedBy?: readonly RankingGate[];
  /** Whitelisted Intermediate staple for beginners (tierPolicy input). */
  readonly beginnerOk?: boolean;
  readonly sportTracking?: boolean;
  /** Compound status (mirrors movement.is_compound) for the legacy
   *  compound-first-then-id ordering. */
  readonly isCompound?: boolean;
}

export interface MovementRankingInput {
  readonly trainingAge: TrainingAge;
  readonly objective: Objective;
  readonly inventory: readonly string[];
  readonly safetyExcludedMovementIds?: ReadonlySet<number>;
  readonly preferredMovementIds?: ReadonlySet<number>;
  /** The executable access context the slot runs in. The sport/conditioning
   *  context removes the difficulty-tier ceiling by ratified law; the ranker
   *  must apply the SAME context, not assume the weight room. Default:
   *  'weight_room'. */
  readonly accessContext?: 'weight_room' | 'sport_conditioning';
  /**
   * R1 (Round 2, ledger 0060): the athlete's curated POWER movement names —
   * the `movement_lift_family` rows whose owner-authored
   * `preferred_purpose` is 'speed' (migration 052). The store reads the
   * table and hands the names in; the ranker never re-derives the
   * classification, so the curated data stays the single source of truth.
   * Absent/empty = no power preference (every other objective, and any
   * objective when the table carries no rows).
   *
   * This is a PREFERENCE among already-gated candidates, not a gate: a
   * speed rung that lost a gate is reported in blockersById exactly like
   * any other candidate and is never re-admitted here. The tier ceiling
   * (isDifficultyAllowed) binds identically for power — an intermediate is
   * never handed Power Clean (Advanced) because the objective says power.
   */
  readonly powerPreferredMovementNames?: readonly string[];
}

export type RankingReason = 'preference' | 'anchor' | 'loaded' | 'bodyweight';

export interface MovementRanking {
  readonly movementId: number;
  readonly name: string;
  readonly reason: RankingReason;
  /** Every gated-available candidate for the pattern, in final preference
   *  order (loaded candidates first in the legacy law, bodyweight last). */
  readonly rankedIds: readonly number[];
  /** The gates that removed EVERY loaded option — the honest fallback reason
   *  when the selection is strictly bodyweight. Empty otherwise. */
  readonly blockers: readonly RankingGate[];
  /** Per-movement gate report for every EXCLUDED candidate (anchor or not),
   *  so the UI can name the exact blocker for a missing competition lift. */
  readonly blockersById: Readonly<Record<number, readonly RankingGate[]>>;
  /** When a strength anchor is blocked and a loaded rung was chosen instead,
   *  that rung's id; null when the anchor is satisfied or no loaded rung
   *  exists. This is the "loaded substitute" the UI must disclose. */
  readonly substituteId: number | null;
  /** The NAME of the blocked anchor a substitute stands in for. */
  readonly substituteAnchorName: string | null;
  /** The movementId of the blocked anchor a substitute stands in for. */
  readonly substituteAnchorId: number | null;
}

/** The big-three anchor NAMES (authored keys in 010/016; ids are corpus
 *  data and are resolved against the candidate pool, never hardcoded). */
export const ANCHOR_MOVEMENT_NAMES: readonly string[] = [
  'Competition Squat', 'Competition Bench', 'Deadlift',
];

export const bigLiftAnchorNames = (): readonly string[] => [...ANCHOR_MOVEMENT_NAMES];

/** Anchors bind to strength ONLY (WO §2.5/§2.6): hypertrophy must not inherit
 *  a mandatory big-three contract. */
export const anchorNamesForObjective = (objective: Objective): readonly string[] =>
  objective === 'strength' ? bigLiftAnchorNames() : [];

/** Honest athlete-facing style per persisted objective (WO §2.2). The UI must
 *  not label the BJJ-specific hybrid split as a generic strength-and-engine
 *  plan, and rehab/weight_loss make no medical or outcome guarantee. */
const OBJECTIVE_STYLE_LABELS: Record<Objective, string> = {
  strength: 'Big-lift strength',
  hypertrophy: 'Bodybuilding',
  power: 'Athletic power',
  endurance: 'Endurance',
  gpp: 'General athlete',
  hybrid: 'Strength + grappling',
  rehab: 'Return to training',
  weight_loss: 'Fat-loss support',
};

export const objectiveStyleLabel = (objective: Objective): string =>
  OBJECTIVE_STYLE_LABELS[objective];

/**
 * R1 (Round 2, ledger 0060): the athlete-facing POWER explanation, as a pure
 * export so the UI copy and the evidence harness can never drift. It states
 * what athletic power training means here, that speed-focused rungs of the
 * big lifts are planned, and that the tier ceiling (Power Clean is Advanced)
 * binds — no tier-unlock, no invented policy, no medical claim.
 *
 * Round 2 review correction (Reviewer A P2): the speed-first preference is a
 * `loaded`-mode law, and `modeFor('beginner', …)` returns 'legacy' — so the
 * engine does NOT guarantee speed rungs for a beginner power athlete. The
 * beginner variant honestly describes the beginner path instead of
 * overpromising: conservative basics first, power training refines them
 * later. The UI renders the variant matching the athlete's training age.
 */
export const powerObjectiveExplanation = (
  objective: Objective,
  trainingAge: TrainingAge = 'intermediate',
): string => {
  if (objective !== 'power') return '';
  if (trainingAge === 'beginner') {
    return 'Power training builds explosive force: big lifts moved fast, with full '
      + 'recovery between sets. As a new lifter you will build the strength base first '
      + '— the coach plans controlled strength work now, and the fast, speed-focused '
      + 'versions of the lifts come once the basics are solid. All safety, equipment '
      + 'and experience gates still apply.';
  }
  return 'Power training builds explosive force: the same big lifts, moved fast, '
    + 'with full recovery between sets. The coach plans the speed-focused versions '
    + 'of the lifts and keeps the reps low so every rep stays sharp. All safety, '
    + 'equipment and experience gates still apply — olympic-lift competition '
    + 'movements are Advanced-tier and appear only when your training history '
    + 'supports them.';
};

const isStrictlyBodyweight = (c: RankingCandidate): boolean =>
  c.plannedImplement === 'Bodyweight';

const DIFFICULTY_RANK: Record<DifficultyRating, number> = {
  Beginner: 0, Intermediate: 1, Advanced: 2,
};

/** Every gate that excludes `c`, evaluated from raw inputs (plus the trusted
 *  upstream report when supplied). Deterministic. */
const exclusionsOf = (c: RankingCandidate, input: MovementRankingInput): RankingGate[] => {
  const gates = new Set<RankingGate>();
  for (const g of c.excludedBy ?? []) gates.add(g);
  if (!c.capabilityAvailable && (c.excludedBy === undefined || c.excludedBy.length === 0)) {
    gates.add('capability');
  }
  if (!c.required.every((item) => input.inventory.includes(item))) gates.add('equipment');
  if ((input.safetyExcludedMovementIds ?? new Set()).has(c.movementId)) gates.add('safety');
  const tierOk = c.sportTracking === true || isDifficultyAllowed(
    input.trainingAge,
    c.difficulty,
    c.beginnerOk ?? false,
    input.accessContext ?? 'weight_room',
    c.sportTracking ?? false,
  );
  if (!tierOk) gates.add('tier');
  return GATE_ORDER.filter((g) => gates.has(g));
};

/** The engine's own ordering law (blockGenerator.pickForPattern): most
 *  compound first, then stable movement_id order. Used for loaded candidates
 *  in loaded-first mode and for everything in legacy mode. */
const compareLegacy = (a: RankingCandidate, b: RankingCandidate): number => {
  const byCompound = Number(b.isCompound ?? false) - Number(a.isCompound ?? false);
  if (byCompound !== 0) return byCompound;
  return a.movementId - b.movementId;
};

/** Ranking mode by (training age, objective). `loaded` = the loaded-first law
 *  with strength anchor promotion; `legacy` = the historical order over all
 *  available candidates (beginners and rehab keep their byte-stable
 *  behavior; the work order scopes the new law to non-rehab intermediate+). */
const modeFor = (age: TrainingAge, objective: Objective): 'loaded' | 'legacy' => {
  if (age === 'beginner' || objective === 'rehab') return 'legacy';
  return 'loaded';
};

/** Loaded-first ordering: legacy law among loaded candidates, then strictly
 *  bodyweight candidates by stable id. */
const orderLoadedFirst = (available: readonly RankingCandidate[]): number[] => [
  ...available.filter((c) => !isStrictlyBodyweight(c)).sort(compareLegacy).map((c) => c.movementId),
  ...available.filter(isStrictlyBodyweight).sort((a, b) => a.movementId - b.movementId)
    .map((c) => c.movementId),
];

/** Legacy ordering over every available candidate (the historical engine
 *  law, bodyweight included). */
const orderLegacy = (available: readonly RankingCandidate[]): number[] =>
  [...available].sort(compareLegacy).map((c) => c.movementId);

/**
 * R2 (Round 2, ledger 0060): accessory-slot ordering. Prefer NON-compound
 * candidates first (legacy law within each class), so an accessory slot's
 * movement class matches its dose role — the same visible-distinctness the
 * §2.6 contract demands of the working sets. Bodyweight handling is
 * unchanged: callers keep the loaded-first/bodyweight separation outside
 * this comparison.
 */
const compareAccessoryFirst = (a: RankingCandidate, b: RankingCandidate): number => {
  const byClass = Number(a.isCompound ?? false) - Number(b.isCompound ?? false);
  if (byClass !== 0) return byClass;
  return compareLegacy(a, b);
};

/**
 * R1 (Round 2, ledger 0060): POWER ordering. The objective's power names are
 * the owner-curated speed-purpose rows (migration 052's
 * movement_lift_family.preferred_purpose='speed'). Ordering:
 *   1. gated-available speed-purpose candidates (legacy law within);
 *   2. other loaded candidates (legacy law within);
 *   3. strictly bodyweight candidates (stable id).
 * A power-preferred candidate is still just a preference: gates bind exactly
 * as before, so an intermediate's tier ceiling keeps Power Clean out and a
 * gate-rejected speed rung lands in blockersById untouched.
 */
const orderPowerFirst = (
  available: readonly RankingCandidate[],
  powerNames: readonly string[],
): number[] => {
  const wanted = new Set(powerNames);
  const isSpeed = (c: RankingCandidate): boolean => wanted.has(c.name);
  return [
    ...available.filter((c) => !isStrictlyBodyweight(c) && isSpeed(c)).sort(compareLegacy),
    ...available.filter((c) => !isStrictlyBodyweight(c) && !isSpeed(c)).sort(compareLegacy),
    ...available.filter(isStrictlyBodyweight).sort((a, b) => a.movementId - b.movementId),
  ].map((c) => c.movementId);
};

/**
 * The optional per-slot role hint (R2, Round 2): an ACCESSORY slot
 * (slot_index >= ACCESSORY_SLOT_FROM in blockGenerator) prefers non-compound
 * candidates, keeping the dose role and the movement class visibly aligned.
 * A primary slot passes nothing and keeps the compound-first law.
 */
export interface RankingSlotRole {
  readonly accessorySlot?: boolean;
}

/**
 * Rank one pattern's candidates for an athlete. The pool handed in is the
 * pattern's candidates WITH the shared capability verdict attached; every
 * gate is (re-)evaluated here from raw inputs, so this function alone cannot
 * weaken a gate and cannot re-admit a rejected candidate.
 */
export function rankMovementsForPattern(
  candidates: readonly RankingCandidate[],
  input: MovementRankingInput,
  _pattern: string,
  slotRole?: RankingSlotRole,
): MovementRanking {
  void _pattern; // the pool is already pattern-scoped by the caller
  const available: RankingCandidate[] = [];
  const blockersById: Record<number, readonly RankingGate[]> = {};
  for (const c of candidates) {
    const gates = exclusionsOf(c, input);
    if (gates.length === 0) available.push(c);
    else blockersById[c.movementId] = gates;
  }
  const mode = modeFor(input.trainingAge, input.objective);
  const powerNames = input.powerPreferredMovementNames ?? [];
  const usePowerLaw = mode === 'loaded' && input.objective === 'power' && powerNames.length > 0;
  const rankedIds = mode === 'legacy'
    ? orderLegacy(available)
    : usePowerLaw
      ? orderPowerFirst(available, powerNames)
      : orderLoadedFirst(available);

  const preferenceId = (input.preferredMovementIds ?? new Set<number>());
  const preferred = available.find((c) => preferenceId.has(c.movementId));
  if (preferred !== undefined) {
    return {
      movementId: preferred.movementId,
      name: preferred.name,
      reason: 'preference',
      rankedIds,
      blockers: [],
      blockersById,
      substituteId: null,
      substituteAnchorName: null,
      substituteAnchorId: null,
    };
  }

  if (mode === 'legacy') {
    // Historical behavior, byte-stable: most compound, then lowest id, over
    // ALL available candidates. No new default policy for beginners/rehab.
    const chosen = available.slice().sort(compareLegacy)[0];
    if (chosen === undefined) {
      const first = [...candidates].sort((a, b) => a.movementId - b.movementId)[0];
      return {
        movementId: -1,
        name: first?.name ?? '',
        reason: 'bodyweight',
        rankedIds: [],
        blockers: GATE_ORDER.filter((g) =>
          candidates.some((c) => (blockersById[c.movementId] ?? []).includes(g))),
        blockersById,
        substituteId: null,
        substituteAnchorName: null,
      substituteAnchorId: null,
      };
    }
    return {
      movementId: chosen.movementId,
      name: chosen.name,
      reason: isStrictlyBodyweight(chosen) ? 'bodyweight' : 'loaded',
      rankedIds,
      blockers: [],
      blockersById,
      substituteId: null,
      substituteAnchorName: null,
      substituteAnchorId: null,
    };
  }

  // Loaded-first mode (non-rehab intermediate+).
  const anchorForThisObjective = new Set(anchorNamesForObjective(input.objective));
  const anchorAvailable = available.find((c) => anchorForThisObjective.has(c.name));
  const anchorExcluded = candidates.filter(
    (c) => anchorForThisObjective.has(c.name) && !available.includes(c),
  );
  // Bodybuilding contract (WO §2.6): HYPERTROPHY specifically must not have
  // the big-three obligation — legacy id-order would otherwise hand
  // hypertrophy the competition lifts as defaults and make the bodybuilding
  // plan merely relabeled strength. Only hypertrophy de-prioritises them as
  // defaults (they remain preference-selectable everywhere); other
  // objectives keep the legacy loaded ordering, so advanced/elite gpp/power
  // defaults are byte-stable.
  const defaultLoadedPool = input.objective === 'hypertrophy'
    ? available.filter((c) => !ANCHOR_MOVEMENT_NAMES.includes(c.name))
    : available;
  const loadedAvailable = defaultLoadedPool.filter((c) => !isStrictlyBodyweight(c))
    .sort(compareLegacy);

  // A loaded rung survives: an intermediate-or-higher athlete is never
  // defaulted to bodyweight while it does (WO §2.4). A blocked strength
  // anchor with a loaded fallback = the disclosed substitute (rung + anchor
  // name + the exact blocker in blockersById).
  //
  // The default loaded pool honors the slot's ordering law:
  //   - power (R1): curated speed-purpose rungs first, then other loaded;
  //   - accessory slots (R2): non-compound candidates first, so the dose
  //     role and the movement class stay visibly aligned;
  //   - otherwise the legacy law, byte-stable.
  //
  // Audit round 4 (P1): the accessory branch must sort the SAME
  // objective-excluded pool the primary path uses. It previously sorted
  // `available` directly, which let a competition lift return as a
  // hypertrophy accessory default. `defaultLoadedPool` already excludes
  // the anchor names for hypertrophy, so both role paths start there.
  //
  // Round 5 (owner directive): the bodybuilding contract keeps competition
  // lifts out of DEFAULTS whenever a non-competition loaded rung exists,
  // but the loaded-first law (WO §2.4) outranks the exclusion — if the
  // anchor-excluded pool is EMPTY, an available compatible competition
  // lift is the default before any bodyweight movement. Explicit
  // preference still outranks everything.
  const anchorExcludedLoadedPool = defaultLoadedPool.filter((c) => !isStrictlyBodyweight(c));
  const orderedLoadedPool = usePowerLaw
    ? available.filter((c) => !isStrictlyBodyweight(c))
        .sort((a, b) => orderPowerFirst([a, b], powerNames).indexOf(a.movementId)
          - orderPowerFirst([a, b], powerNames).indexOf(b.movementId))
    : slotRole?.accessorySlot === true
      ? (anchorExcludedLoadedPool.length > 0 ? anchorExcludedLoadedPool : available.filter((c) => !isStrictlyBodyweight(c)))
          .sort(compareAccessoryFirst)
      : (loadedAvailable.length > 0
        ? loadedAvailable
        : available.filter((c) => !isStrictlyBodyweight(c)).sort(compareLegacy));
  const bodyweightAvailable = available.filter(isStrictlyBodyweight)
    .sort((a, b) => a.movementId - b.movementId);

  // The strength anchor, when gated-available, outranks every other rung.
  if (anchorAvailable !== undefined) {
    return {
      movementId: anchorAvailable.movementId,
      name: anchorAvailable.name,
      reason: 'anchor',
      rankedIds,
      blockers: [],
      blockersById,
      substituteId: null,
      substituteAnchorName: null,
      substituteAnchorId: null,
    };
  }

  const chosenLoaded = orderedLoadedPool[0];
  if (chosenLoaded !== undefined) {
    const blockedAnchor = anchorExcluded[0];
    return {
      movementId: chosenLoaded.movementId,
      name: chosenLoaded.name,
      reason: 'loaded',
      rankedIds,
      blockers: [],
      blockersById,
      substituteId: blockedAnchor !== undefined ? chosenLoaded.movementId : null,
      substituteAnchorName: blockedAnchor?.name ?? null,
      substituteAnchorId: blockedAnchor?.movementId ?? null,
    };
  }

  // Nothing loaded survived. Bodyweight is valid WITH its exact reason.
  const fallback = bodyweightAvailable[0];
  if (fallback === undefined) {
    // No candidate at all: report the gates that emptied the slot so the UI
    // can name the blocker instead of dropping it silently.
    const first = [...candidates].sort((a, b) => a.movementId - b.movementId)[0];
    return {
      movementId: -1,
      name: first?.name ?? '',
      reason: 'bodyweight',
      rankedIds: [],
      blockers: GATE_ORDER.filter((g) =>
        candidates.some((c) => (blockersById[c.movementId] ?? []).includes(g))),
      blockersById,
      substituteId: null,
      substituteAnchorName: null,
      substituteAnchorId: null,
    };
  }
  const blockerSet = new Set<RankingGate>();
  for (const c of candidates) {
    if (!isStrictlyBodyweight(c)) {
      for (const g of blockersById[c.movementId] ?? []) blockerSet.add(g);
    }
  }
  return {
    movementId: fallback.movementId,
    name: fallback.name,
    reason: 'bodyweight',
    rankedIds,
    blockers: GATE_ORDER.filter((g) => blockerSet.has(g)),
    blockersById,
    substituteId: null,
    substituteAnchorName: null,
      substituteAnchorId: null,
  };
}

// DIFFICULTY_RANK is retained for upcoming per-objective rung policies; it is
// deliberately unused today so no unreviewed ordering enters the engine.
void DIFFICULTY_RANK;

/** The loaded substitute for a named anchor, from a gated candidate pool.
 *  Null when the anchor is available or no loaded rung survives. */
export function anchorSubstituteFor(
  anchorName: string,
  candidates: readonly RankingCandidate[],
  input: MovementRankingInput,
): number | null {
  const available = candidates.filter((c) => exclusionsOf(c, input).length === 0);
  const anchor = candidates.find((c) => c.name === anchorName);
  if (anchor !== undefined && available.some((c) => c.movementId === anchor.movementId)) return null;
  const loaded = available.filter((c) => !isStrictlyBodyweight(c)).sort(compareLegacy);
  return loaded[0]?.movementId ?? null;
}
