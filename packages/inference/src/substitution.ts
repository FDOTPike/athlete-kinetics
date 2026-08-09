/**
 * substitution.ts — the deterministic 3-tier contravariant substitution
 * engine (Phase 12).
 *
 * Pure function of (target, library, inventory, niggles, block context): no
 * I/O, no randomness, no clock reads. Given a movement the athlete wants to
 * swap, it computes exactly three bounded layers of alternatives:
 *
 *   LAYER 1  REGRESSION   (green)  — same biomechanical PATTERN, never harder.
 *                                    "reduce difficulty OR modify torque."
 *                                    Guarded: a candidate loading an injured
 *                                    structural joint is barred.
 *   LAYER 2  DAY SWAP      (purple) — same ExRx CATEGORY, pulled forward from a
 *                                    later block day; the moved volume is
 *                                    deducted from its origin slot (strict
 *                                    Conservation of Volume).
 *   LAYER 3  NIGGLE TRIAGE (orange) — a niggle (severity 3..5) converts ONE
 *                                    compound/supplementary movement into a
 *                                    cluster of <= ratio accessory movements
 *                                    (CNS tax cap, default 3:1).
 *
 * Grain choice (documented invariant): Layer 1 matches the precise 001
 * `pattern` (Bench -> DB Bench -> Push-up), Layer 2 matches the coarser ExRx
 * `category` (any "row variant"), Layer 3 is category-agnostic isolation work.
 *
 * Sentiment routing: preference -1 (Avoid) hard-excludes a movement from
 * every layer; preference +1 (Prioritize) sorts it ahead of neutral peers.
 *
 * The machine-verified boundary invariants live in test/verify_blocks.mjs
 * (determinism, conservation-of-volume, the injury guardrail, the CNS cap,
 * and sentiment exclusion/priority).
 */
import {
  DIFFICULTY_RANK,
  EXPERIENCE_SEVERITY,
  MOVEMENT_PREFERENCE,
  PATTERN_TO_CATEGORY,
  type DifficultyRating,
  type MovementPattern,
  type MovementPreference,
  type TrainingAge,
} from './types';
import { isDifficultyAllowed } from './tierPolicy';

// ---------------------------------------------------------------------------
// Joint model (engine-local safety policy)
// ---------------------------------------------------------------------------
export const JOINTS = [
  'knee', 'hip', 'ankle', 'shoulder', 'elbow', 'wrist', 'lower_back', 'spine', 'neck',
] as const;
export type Joint = (typeof JOINTS)[number];

/** Structural joints loaded per movement pattern (coarse, deterministic). A
 *  per-movement `joints` override on SubstitutionMovement wins when present —
 *  forward-compat for a future precise joints column. */
export const PATTERN_JOINTS: Record<MovementPattern, readonly Joint[]> = {
  squat: ['knee', 'hip'],
  hinge: ['hip', 'lower_back'],
  push_h: ['shoulder', 'elbow'],
  push_v: ['shoulder', 'elbow'],
  pull_h: ['shoulder', 'elbow'],
  pull_v: ['shoulder', 'elbow'],
  lunge: ['knee', 'hip', 'ankle'],
  carry: ['shoulder'],
  rotation: ['spine'],
  isolation: [],
  locomotion: ['knee', 'ankle'],
};

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------
/** The niggle severity band is EXPERIENCE-WEIGHTED (Phase 12 Step 5): the live
 *  thresholds come from EXPERIENCE_SEVERITY[trainingAge]. These exported consts
 *  remain the INTERMEDIATE baseline (the default when no training age is given):
 *  a niggle at/above NIGGLE_MIN is operative, the Layer-3 triage band is
 *  [NIGGLE_MIN, NIGGLE_MAX], and severity above NIGGLE_MAX is halt territory the
 *  prescription engine owns, not a swap. */
export const NIGGLE_MIN = EXPERIENCE_SEVERITY.intermediate.triageMin;
export const NIGGLE_MAX = EXPERIENCE_SEVERITY.intermediate.haltMin - 1;
/** CNS tax: at most this many accessories may replace one primary. */
export const DEFAULT_ACCESSORY_RATIO = 3;

export const SUBSTITUTION_COLORS = {
  regression: 'green',
  day_swap: 'purple',
  triage: 'orange',
} as const;
export type SubstitutionLayer = keyof typeof SUBSTITUTION_COLORS;

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------
/** A library row projected for the router: 001 movement + 010 detail/sentiment
 *  + movement_equipment. The store assembles this; the engine never reads SQL. */
export interface SubstitutionMovement {
  movement_id: number;
  /** movement_beginner_whitelist membership (plan P16 S4): an Intermediate
   *  staple a beginner may be offered. Absent = not whitelisted. */
  beginnerOk?: boolean;
  /** Shared capability resolver verdict. False stays visible for teaching but cannot be offered. */
  capabilityAvailable?: boolean;
  name: string;
  pattern: MovementPattern;
  is_compound: boolean;
  /** movement_detail.difficulty_rating. */
  difficulty: DifficultyRating;
  /** Variation-family key (movement_detail.base_name); implement variants
   *  share it. */
  family: string;
  /** movement_equipment rows; empty == bodyweight. */
  required: readonly string[];
  /** movement_preference.preference; 0/neutral when no row exists. */
  preference: MovementPreference;
  /** Optional precise structural joints; falls back to PATTERN_JOINTS. */
  joints?: readonly Joint[];
}

/** A reported niggle. region is matched case-insensitively against JOINTS. */
export interface NiggleInput {
  region: string;
  /** Subjective severity 1..10. */
  severity: number;
}

/** A movement scheduled later in the 28-day block, eligible to pull forward. */
export interface FutureSlot {
  plannedSlotId: number;
  /** Absolute day index within the block. */
  dayIndex: number;
  movement: SubstitutionMovement;
  /** Planned working sets at the origin slot (the volume that will move). */
  sets: number;
}

export interface SubstitutionInput {
  target: SubstitutionMovement;
  library: readonly SubstitutionMovement[];
  /** Athlete equipment inventory (strict boolean subset availability). */
  inventory: readonly string[];
  niggles?: readonly NiggleInput[];
  futureSlots?: readonly FutureSlot[];
  /** Current block day index; only strictly-later slots are pull-forward
   *  eligible (Layer 2). */
  currentDayIndex: number;

  /** CNS tax cap override (clamped 1..DEFAULT_ACCESSORY_RATIO). */
  maxAccessoryRatio?: number;
  /** Athlete training age — scales the niggle severity thresholds via
   *  EXPERIENCE_SEVERITY (DOMS-vs-structural). Defaults to 'intermediate'. */
  trainingAge?: TrainingAge;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------
export interface RegressionOption {
  movement_id: number;
  name: string;
  difficulty: DifficultyRating;
  preference: MovementPreference;
  rationale: string;
}
export interface DaySwapOption {
  movement_id: number;
  name: string;
  preference: MovementPreference;
  fromDayIndex: number;
  plannedSlotId: number;
  /** Volume moved forward AND deducted from the origin (conservation). */
  setsConserved: number;
  rationale: string;
}
export interface TriageClusterMember {
  movement_id: number;
  name: string;
  preference: MovementPreference;
}
export interface TriageCluster {
  movements: TriageClusterMember[];
  /** Cluster size (<= ratio) = the realized CNS conversion ratio. */
  cnsTaxRatio: number;
  rationale: string;
}
export interface SubstitutionResult {
  layer1Regression: { color: typeof SUBSTITUTION_COLORS.regression; options: RegressionOption[] };
  layer2DaySwap: { color: typeof SUBSTITUTION_COLORS.day_swap; options: DaySwapOption[] };
  layer3Triage: { color: typeof SUBSTITUTION_COLORS.triage; cluster: TriageCluster | null };
  /** movement_ids the injury guardrail removed (structural joint overlap). */
  blockedByGuardrail: number[];
  /** True when a niggle reached the athlete's HALT threshold
   *  (EXPERIENCE_SEVERITY[age].haltMin): too severe to train around — the UI
   *  should advise ending the session rather than substituting. */
  haltAdvised: boolean;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------
const clampInt = (x: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, Math.round(x)));

const jointsOf = (m: SubstitutionMovement): readonly Joint[] =>
  m.joints ?? PATTERN_JOINTS[m.pattern];

/** Joints with a niggle at/above the athlete's operative threshold (the
 *  experience-weighted `triageMin`). */
const injuredJoints = (niggles: readonly NiggleInput[], triageMin: number): Set<Joint> => {
  const out = new Set<Joint>();
  for (const n of niggles) {
    if (n.severity < triageMin) continue;
    const region = n.region.toLowerCase();
    for (const j of JOINTS) {
      if (region.includes(j) || region.includes(j.replace('_', ' '))) out.add(j);
    }
  }
  return out;
};

const isAvoided = (m: SubstitutionMovement): boolean =>
  m.preference === MOVEMENT_PREFERENCE.AVOID;

// Total, deterministic comparators (final tie-break on the unique movement_id).
const byRegression = (a: RegressionOption, b: RegressionOption): number =>
  DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] ||
  b.preference - a.preference ||
  a.movement_id - b.movement_id;
const byDaySwap = (a: DaySwapOption, b: DaySwapOption): number =>
  a.fromDayIndex - b.fromDayIndex ||
  b.preference - a.preference ||
  a.movement_id - b.movement_id;
const byTriage = (a: SubstitutionMovement, b: SubstitutionMovement): number =>
  b.preference - a.preference ||
  DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] ||
  a.movement_id - b.movement_id;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------
export function computeSubstitutions(input: SubstitutionInput): SubstitutionResult {
  const ratio = clampInt(input.maxAccessoryRatio ?? DEFAULT_ACCESSORY_RATIO, 1, DEFAULT_ACCESSORY_RATIO);
  const inventory = new Set(input.inventory);
  const niggles = input.niggles ?? [];
  // Experience-weighted thresholds (DOMS-vs-structural): a beginner tolerates
  // more before a niggle bars a joint or triages; an elite reacts sooner.
  const { triageMin, haltMin } = EXPERIENCE_SEVERITY[input.trainingAge ?? 'intermediate'];
  const injured = injuredJoints(niggles, triageMin);
  const guarded = injured.size > 0;
  const haltAdvised = niggles.some((n) => n.severity >= haltMin);
  const targetCategory = PATTERN_TO_CATEGORY[input.target.pattern];
  const targetRank = DIFFICULTY_RANK[input.target.difficulty];
  const blocked = new Set<number>();

  const available = (m: SubstitutionMovement): boolean =>
    m.capabilityAvailable !== false && m.required.every((item) => inventory.has(item));
  /** Plan P16 S4 tier gate: a beginner is only offered Beginner movements or
   *  whitelisted Intermediate staples — in EVERY layer, triage included. */
  const tierBars = (m: SubstitutionMovement): boolean => !isDifficultyAllowed(
    input.trainingAge ?? 'intermediate',
    m.difficulty,
    m.beginnerOk,
  );
  /** Guardrail predicate with the side effect of recording the block. */
  const guardrailBars = (m: SubstitutionMovement): boolean => {
    if (guarded && jointsOf(m).some((j) => injured.has(j))) {
      blocked.add(m.movement_id);
      return true;
    }
    return false;
  };

  // --- LAYER 1: biomechanical regression (green) ---------------------------
  // Same precise pattern, difficulty NOT above the target ("reduce difficulty
  // OR modify torque at matched difficulty"), available, not Avoided.
  const layer1: RegressionOption[] = [];
  for (const m of input.library) {
    if (m.movement_id === input.target.movement_id) continue;
    if (m.pattern !== input.target.pattern) continue;
    if (isAvoided(m) || !available(m)) continue;
    if (DIFFICULTY_RANK[m.difficulty] > targetRank) continue;
    if (tierBars(m)) continue;
    if (guardrailBars(m)) continue;
    const easier = DIFFICULTY_RANK[m.difficulty] < targetRank;
    layer1.push({
      movement_id: m.movement_id,
      name: m.name,
      difficulty: m.difficulty,
      preference: m.preference,
      rationale:
        `${m.name} (${m.difficulty}) substitutes ${input.target.name}` +
        (easier ? ' with reduced mechanical demand' : ' at matched difficulty, altered torque') +
        (guarded ? '; cleared the injury guardrail' : ''),
    });
  }
  layer1.sort(byRegression);

  // --- LAYER 2: volume conservation / day swap (purple) --------------------
  // Same ExRx category, pulled from a STRICTLY later block day. The moved
  // volume is deducted from the origin slot — net block volume is unchanged.
  const layer2: DaySwapOption[] = [];
  for (const slot of input.futureSlots ?? []) {
    if (slot.dayIndex <= input.currentDayIndex) continue;
    const m = slot.movement;
    if (m.movement_id === input.target.movement_id) continue;
    if (PATTERN_TO_CATEGORY[m.pattern] !== targetCategory) continue;
    if (isAvoided(m) || !available(m)) continue;
    if (tierBars(m)) continue;
    if (guardrailBars(m)) continue;
    layer2.push({
      movement_id: m.movement_id,
      name: m.name,
      preference: m.preference,
      fromDayIndex: slot.dayIndex,
      plannedSlotId: slot.plannedSlotId,
      setsConserved: slot.sets,
      rationale:
        `Pull ${m.name} forward from day ${slot.dayIndex}; ${slot.sets} set(s) ` +
        'deducted from that slot to conserve block volume.',
    });
  }
  layer2.sort(byDaySwap);

  // --- LAYER 3: niggle / injury accessory triage (orange) ------------------
  // A niggle in the experience-weighted triage band [triageMin, haltMin)
  // converts ONE compound/supplementary movement into <= ratio joint-safe
  // accessory movements. Above haltMin is halt territory (haltAdvised), not a swap.
  let cluster: TriageCluster | null = null;
  const niggleTripped = niggles.some((n) => n.severity >= triageMin && n.severity < haltMin);
  if (niggleTripped && input.target.is_compound) {
    const pool: SubstitutionMovement[] = [];
    for (const m of input.library) {
      if (m.movement_id === input.target.movement_id) continue;
      if (m.is_compound) continue;                 // isolation/accessory only
      if (isAvoided(m) || !available(m)) continue;
      if (tierBars(m)) continue;                    // tier gate holds in triage too
      if (guardrailBars(m)) continue;              // never triage onto the niggle
      pool.push(m);
    }
    pool.sort(byTriage);
    const chosen = pool.slice(0, ratio);
    if (chosen.length > 0) {
      cluster = {
        movements: chosen.map((m) => ({
          movement_id: m.movement_id, name: m.name, preference: m.preference,
        })),
        cnsTaxRatio: chosen.length,
        rationale:
          `Replace 1 ${input.target.name} with ${chosen.length} isolation movement(s) ` +
          `(CNS tax cap ${ratio}:1) to train around the niggle.`,
      };
    }
  }

  return {
    layer1Regression: { color: SUBSTITUTION_COLORS.regression, options: layer1 },
    layer2DaySwap: { color: SUBSTITUTION_COLORS.day_swap, options: layer2 },
    layer3Triage: { color: SUBSTITUTION_COLORS.triage, cluster },
    blockedByGuardrail: [...blocked].sort((a, b) => a - b),
    haltAdvised,
  };
}
