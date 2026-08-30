/**
 * blockGenerator.ts — the deterministic 4-week block template engine.
 *
 * Pure function of (profile, movement library, start date): no I/O, no
 * randomness, no clock reads. Every table below is data, not heuristics —
 * the machine-verified boundary invariants live in test/verify_blocks.mjs:
 *   1. determinism: double-run deep-equality;
 *   2. structure: exactly 4 weeks ending in deload, planned_slot CHECK
 *      domains, target RPE never above base_rpe_cap (rehab never above 7);
 *   3. equipment strictness: a movement is emitted ONLY if its required
 *      equipment is a subset of the athlete's inventory — no substitution
 *      upward, missing pattern slots are dropped with a warning;
 *   4. hybrid balance: every hybrid split contains bjj sessions and carries
 *      strictly less raw strength set volume than the pure strength block
 *      (concurrent-training interference damping).
 */
import type { DifficultyRating, MacroPhase, MovementPattern, MovementPrefix, Objective, SchemaType, UserProfile } from './types';
import { EXPERIENCE_SEVERITY } from './types';
import { DIFFICULTY_RANK } from './types';
// Phase 13 Step 4 — the Block Generator Intercept: the generator imports the
// autopilot controller and applies its forward-looking corrections to the next
// block (a recorded halt snaps the whole block to a recovery template).
import { deriveControlAction, type ControlAction, type FlawReport } from './kinematicAutopilot';
import { DEFAULT_ADVANCEMENT_POLICY } from './progressionEngine';

// ---------------------------------------------------------------------------
// Inputs / outputs (mirror the 007 block tables 1:1)
// ---------------------------------------------------------------------------
export interface GeneratorMovement {
  movement_id: number;
  /** movement_detail.difficulty_rating; absent = ungated (legacy callers are
   *  byte-identical — the store passes it from Phase 16 onward). */
  difficulty?: DifficultyRating;
  /** movement_beginner_whitelist membership: an Intermediate staple a
   *  beginner may be prescribed (plan P16 S4). Absent = not whitelisted. */
  beginner_ok?: boolean;
  /** Shared capability resolver verdict. False means teaching-only. */
  capability_available?: boolean;
  name: string;
  pattern: MovementPattern;
  is_compound: boolean;
  /** movement_equipment rows; empty = needs no equipment. NOT a bodyweight
   *  test — Feet-Elevated Push-Up requires a bench and is still bodyweight
   *  loaded. Use `primaryImplement` for the loading question. */
  required: readonly string[];
  /** Optional persisted set ceiling (for example a timed-movement policy).
   *  The generator applies this before and after autopilot correction so its
   *  returned plan is the exact plan the store can persist. */
  set_cap?: number;
  /** movement_detail.supported_prefixes[0] — the canonical primary implement.
   *  Absent, empty, or non-canonical is not bodyweight evidence and fails
   *  toward external-load behaviour. */
  primaryImplement?: MovementPrefix;
}

/** Strictly bodyweight movements have exactly the canonical Bodyweight
 * implement. Weighted calisthenics and missing/non-canonical values stay on
 * the external-load path. */
export const isPurelyBodyweight = (m: GeneratorMovement): boolean =>
  m.primaryImplement === 'Bodyweight';

export type BlockFocus = 'lower' | 'upper' | 'full' | 'conditioning' | 'bjj';
export type BlockPhase = 'accumulation' | 'intensification' | 'realization' | 'deload';

export interface PlannedSlotPlan {
  slot_index: number;   // 1-based
  movement_id: number;
  sets: number;         // 1..10 (schema CHECK)
  reps: number;         // 1..30
  target_rpe: number;   // 5.0..10.0
  /** Phase 13: optional implement/loading conditions applied to this slot
   *  (MOVEMENT_PREFIXES members). TS-only for now — not persisted, not set by
   *  the generator; conditionEngine folds their movement_prefix weights in. */
  applied_prefixes?: readonly MovementPrefix[];
  /** Durable, plain-language attribution for an effective autopilot change. */
  autopilotDelta?: AutopilotSlotDelta;
}

export type AutopilotSlotReason = 'eased' | 'raised' | 'held_safety';

export interface AutopilotSlotDelta {
  rpe_delta: number;
  set_delta: number;
  reason: AutopilotSlotReason;
}

export interface PlannedSessionPlan {
  week_index: number;   // 1..4
  day_index: number;    // 1..7, offset within the week from start_date
  focus: BlockFocus;
  phase: BlockPhase;
  session_date: string; // ISO YYYY-MM-DD
  slots: PlannedSlotPlan[];
}

export interface BlockPlan {
  objective: Objective;
  start_date: string;
  weeks: 4;
  schemaType: SchemaType;
  /** Position in the 32-week macro-cycle (1..8). */
  macroBlockIndex: number;
  macroPhase: MacroPhase;
  /** Deadlift auto-regulation fired: deload inserted week 1, peak +1 week. */
  peakShifted: boolean;
  sessions: PlannedSessionPlan[];
  /** Pattern slots that had no equipment-available movement (deduped). */
  warnings: string[];
  /** Phase 13 Step 4: a recorded halt snapped the block to the recovery
   *  template (every week deloaded, no progressive overload). */
  recovery: boolean;
  /** Movement patterns the autopilot's ControlAction adjusted (deduped, sorted);
   *  empty when no flaw report was supplied or nothing crossed the deadband. */
  autopilotAdjusted: string[];
}

export interface ProgramMovementPreference {
  slot_index: number;
  pattern: MovementPattern;
  movement_id: number;
}

export interface ProgramDayPreference {
  day_index: number;
  focus: BlockFocus;
  movement_preferences?: readonly ProgramMovementPreference[];
}

export interface BlockInput {
  profile: UserProfile;
  movements: readonly GeneratorMovement[];
  /** Generation day; week 1 day 1 lands here. */
  startDate: string;
  /** Loading-schema strategy; defaults to LINEAR (pre-Phase-10 behavior). */
  schemaType?: SchemaType;
  /** Position in the 32-week macro-cycle (1..8); defaults to 1. */
  macroBlockIndex?: number;
  /** Rolling fatigue at generation time (state_vector.acwr) — drives the
   *  deadlift auto-regulation gate in the peak phase. */
  recentAcwr?: number | null;
  /** Explicit repeating weekly schedule for a goal program. */
  programDays?: readonly ProgramDayPreference[];

  /** Phase 13 Step 4: the Kinematic Autopilot's flaw report for the trailing
   *  3-week window. When present the generator derives a bounded ControlAction
   *  (deriveControlAction) and applies its per-pattern target_rpe / working-set
   *  corrections to NON-deload weeks; a `globalGuardrail.halt` snaps the whole
   *  block to the recovery template. Absent ⇒ the pre-Step-4 block, byte-identical. */
  flawReport?: FlawReport;
}

// ---------------------------------------------------------------------------
// Template tables
// ---------------------------------------------------------------------------
export const BLOCK_WEEKS = 4 as const;

const PHASE_BY_WEEK: readonly BlockPhase[] = [
  'accumulation', 'intensification', 'realization', 'deload',
];

/** Training-day offsets inside a week, indexed by weekly_frequency - 1. */
const DAY_SPREAD: readonly (readonly number[])[] = [
  [1],
  [1, 4],
  [1, 3, 5],
  [1, 2, 4, 6],
  [1, 2, 4, 5, 6],
  [1, 2, 3, 4, 5, 6],
  [1, 2, 3, 4, 5, 6, 7],
];

/** Ordered pattern menu per focus; trimmed to the session slot budget. */
const FOCUS_PATTERNS: Record<BlockFocus, readonly MovementPattern[]> = {
  lower: ['squat', 'hinge', 'lunge', 'isolation'],
  upper: ['push_h', 'pull_h', 'push_v', 'pull_v'],
  full: ['squat', 'push_h', 'hinge', 'pull_h', 'carry'],
  conditioning: ['locomotion', 'carry', 'rotation'],
  bjj: ['locomotion', 'rotation', 'isolation'],
};

/** Strength-side foci (the volume hybrid damping applies to). */
const STRENGTH_FOCI: ReadonlySet<BlockFocus> = new Set(['lower', 'upper', 'full']);

// Weekly splits, indexed by weekly_frequency - 1. Hybrid alternates lifting
// and sport days; at frequency 1 the sport IS the week (concurrent training
// needs at least two days — the strength side returns at frequency 2).
const STRENGTH_SPLITS: readonly (readonly BlockFocus[])[] = [
  ['full'],
  ['lower', 'upper'],
  ['lower', 'upper', 'full'],
  ['lower', 'upper', 'lower', 'upper'],
  ['lower', 'upper', 'lower', 'upper', 'full'],
  ['lower', 'upper', 'lower', 'upper', 'full', 'conditioning'],
  ['lower', 'upper', 'lower', 'upper', 'full', 'conditioning', 'full'],
];
const ENDURANCE_SPLITS: readonly (readonly BlockFocus[])[] = [
  ['conditioning'],
  ['full', 'conditioning'],
  ['full', 'conditioning', 'conditioning'],
  ['full', 'conditioning', 'full', 'conditioning'],
  ['full', 'conditioning', 'full', 'conditioning', 'conditioning'],
  ['full', 'conditioning', 'full', 'conditioning', 'full', 'conditioning'],
  ['full', 'conditioning', 'full', 'conditioning', 'full', 'conditioning', 'conditioning'],
];
const GPP_SPLITS: readonly (readonly BlockFocus[])[] = [
  ['full'],
  ['full', 'conditioning'],
  ['lower', 'upper', 'conditioning'],
  ['lower', 'upper', 'full', 'conditioning'],
  ['lower', 'upper', 'full', 'conditioning', 'conditioning'],
  ['lower', 'upper', 'conditioning', 'lower', 'upper', 'conditioning'],
  ['lower', 'upper', 'conditioning', 'lower', 'upper', 'conditioning', 'full'],
];
const REHAB_SPLITS: readonly (readonly BlockFocus[])[] =
  [1, 2, 3, 4, 5, 6, 7].map((n) => Array<BlockFocus>(n).fill('full'));
const HYBRID_SPLITS: readonly (readonly BlockFocus[])[] = [
  ['bjj'],
  ['full', 'bjj'],
  ['lower', 'bjj', 'upper'],
  ['lower', 'bjj', 'upper', 'bjj'],
  ['lower', 'bjj', 'upper', 'bjj', 'full'],
  ['lower', 'bjj', 'upper', 'bjj', 'full', 'bjj'],
  ['lower', 'bjj', 'upper', 'bjj', 'full', 'bjj', 'conditioning'],
];

const SPLITS: Record<Objective, readonly (readonly BlockFocus[])[]> = {
  strength: STRENGTH_SPLITS,
  power: STRENGTH_SPLITS,
  hypertrophy: STRENGTH_SPLITS,
  endurance: ENDURANCE_SPLITS,
  weight_loss: ENDURANCE_SPLITS,
  gpp: GPP_SPLITS,
  rehab: REHAB_SPLITS,
  hybrid: HYBRID_SPLITS,
};

export const programFocuses = (objective: Objective, frequency: number): readonly BlockFocus[] =>
  SPLITS[objective][clamp(Math.round(frequency), 1, 7) - 1];

export const defaultProgramDayIndices = (frequency: number): readonly number[] =>
  DAY_SPREAD[clamp(Math.round(frequency), 1, 7) - 1];

const BLOCK_FOCI: ReadonlySet<BlockFocus> = new Set(['lower', 'upper', 'full', 'conditioning', 'bjj']);

/** Rep/set/effort scheme per objective. rpeWave is weeks 1..3; week 4 is the
 *  deload transform (sets halved up, RPE = wave[0] - 1.0, floor 5.0). */
interface Scheme {
  reps: number;
  sets: number;
  rpeWave: readonly [number, number, number];
}
const SCHEMES: Record<Objective, Scheme> = {
  strength: { reps: 5, sets: 4, rpeWave: [7.5, 8.0, 8.5] },
  power: { reps: 3, sets: 5, rpeWave: [7.0, 7.5, 8.0] },
  hypertrophy: { reps: 10, sets: 4, rpeWave: [7.5, 8.0, 8.5] },
  endurance: { reps: 15, sets: 3, rpeWave: [6.5, 7.0, 7.5] },
  gpp: { reps: 8, sets: 3, rpeWave: [7.0, 7.5, 8.0] },
  hybrid: { reps: 5, sets: 4, rpeWave: [7.5, 8.0, 8.5] },
  rehab: { reps: 12, sets: 3, rpeWave: [6.0, 6.5, 7.0] },
  weight_loss: { reps: 12, sets: 3, rpeWave: [7.0, 7.5, 8.0] },
};

/** Locomotion work is planned as rounds (BJJ rounds, conditioning pieces). */
const LOCOMOTION_SETS = 5;
const LOCOMOTION_REPS = 1;

// ---------------------------------------------------------------------------
// Phase 10: 32-week macro-cycle, schema strategies, fatigue cost, translation
// ---------------------------------------------------------------------------
export const MACRO_BLOCKS = 8;
export const MACRO_TOTAL_WEEKS = MACRO_BLOCKS * BLOCK_WEEKS; // 32

/** Two 4-week blocks per phase: gpp -> hypertrophy -> volume -> peak. */
export const macroPhaseOf = (blockIndex: number): MacroPhase => {
  const phases: readonly MacroPhase[] = ['gpp', 'hypertrophy', 'volume', 'peak'];
  return phases[Math.floor((Math.min(Math.max(blockIndex, 1), MACRO_BLOCKS) - 1) / 2)];
};

/** Guided program macro ownership (AUD-GP-2): block N of a goal program
 *  anchored at `startingMacroBlockIndex` sits at
 *    ((starting - 1) + (sequence_index - 1)) % 8 + 1
 *  — the program OWNS its macro progression and does not inherit the
 *  athlete's global cycle counter at continuation time. Both preview and
 *  committed generation MUST call this identical derivation so a mid-cycle
 *  start (e.g. 6,7,8,1) is deterministic and tested, never silent. */
export const programMacroIndex = (
  startingMacroBlockIndex: number,
  sequenceIndex: number,
): number => (((startingMacroBlockIndex - 1) + (sequenceIndex - 1)) % MACRO_BLOCKS) + 1;

/** Macro-phase modulation applied on top of the objective scheme. */
const PHASE_MODS: Record<MacroPhase, { reps: number; rpe: number; sets: number }> = {
  gpp: { reps: 2, rpe: -0.5, sets: 0 },
  hypertrophy: { reps: 3, rpe: 0, sets: 0 },
  volume: { reps: 0, rpe: 0, sets: 1 },
  peak: { reps: -2, rpe: 0.5, sets: 0 },
};

/** Strategy pattern: per-schema weekly loading rows (weeks 1..3; the deload
 *  week is schema-independent). Each row reshapes reps/sets/effort so the
 *  four schemas yield mathematically distinct progressions (machine-checked
 *  pairwise in verify:blocks). */
interface SchemaWeekMod {
  repsScale: number;
  setsDelta: number;
  /** Index into the objective's rpeWave. */
  rpeIdx: 0 | 1 | 2;
  rpeDelta: number;
}
const SCHEMA_WEEKS: Record<SchemaType, readonly [SchemaWeekMod, SchemaWeekMod, SchemaWeekMod]> = {
  // Fixed reps, effort ramps week over week.
  LINEAR: [
    { repsScale: 1, setsDelta: 0, rpeIdx: 0, rpeDelta: 0 },
    { repsScale: 1, setsDelta: 0, rpeIdx: 1, rpeDelta: 0 },
    { repsScale: 1, setsDelta: 0, rpeIdx: 2, rpeDelta: 0 },
  ],
  // Undulating: volume week, heavy short week, lighter long week.
  WAVE: [
    { repsScale: 1.0, setsDelta: 0, rpeIdx: 0, rpeDelta: 0 },
    { repsScale: 0.8, setsDelta: 0, rpeIdx: 2, rpeDelta: 0 },
    { repsScale: 1.2, setsDelta: 0, rpeIdx: 1, rpeDelta: 0 },
  ],
  // Step loading: hold effort, add a set, then step effort up.
  STEP: [
    { repsScale: 1, setsDelta: 0, rpeIdx: 0, rpeDelta: 0 },
    { repsScale: 1, setsDelta: 1, rpeIdx: 0, rpeDelta: 0 },
    { repsScale: 1, setsDelta: 1, rpeIdx: 2, rpeDelta: 0 },
  ],
  // Autoregulated: high effort from week 1, near-max AMRAP week 3. The
  // reactive load mutation lives in the store (slot_override), not here.
  APRE: [
    { repsScale: 1, setsDelta: 0, rpeIdx: 1, rpeDelta: 0 },
    { repsScale: 1, setsDelta: 0, rpeIdx: 1, rpeDelta: 0 },
    { repsScale: 1, setsDelta: 0, rpeIdx: 2, rpeDelta: 0.5 },
  ],
};

/** Per-schema working-set delta for strictly bodyweight slots. LINEAR gains a
 * visible volume channel; all other rows mirror their loaded schema. */
const SCHEMA_WEEKS_BODYWEIGHT_SETS_DELTA:
  Record<SchemaType, readonly [number, number, number]> = {
  LINEAR: [0, 1, 1],
  WAVE: [0, 0, 0],
  STEP: [0, 1, 1],
  APRE: [0, 0, 0],
};

/** The Schema Cost Matrix: fatigue weight per (schema, macro phase). Pure
 *  data — the hybrid tax below is its only in-engine consumer today; the
 *  store/UI may surface it later. */
export const SCHEMA_FATIGUE_COST: Record<SchemaType, Record<MacroPhase, number>> = {
  LINEAR: { gpp: 1.0, hypertrophy: 1.1, volume: 1.2, peak: 1.2 },
  WAVE: { gpp: 1.1, hypertrophy: 1.2, volume: 1.3, peak: 1.3 },
  STEP: { gpp: 1.1, hypertrophy: 1.2, volume: 1.4, peak: 1.3 },
  APRE: { gpp: 1.3, hypertrophy: 1.4, volume: 1.5, peak: 1.6 },
};
/** No separate bodyweight fatigue coefficient has been ratified. Keep the
 * routing explicit while preserving the existing cost table exactly. */
const SCHEMA_FATIGUE_COST_BODYWEIGHT = SCHEMA_FATIGUE_COST;

export const schemaFatigueCost = (
  schemaType: SchemaType,
  macroPhase: MacroPhase,
  bodyweightDominant: boolean,
): number => (bodyweightDominant
  ? SCHEMA_FATIGUE_COST_BODYWEIGHT
  : SCHEMA_FATIGUE_COST)[schemaType][macroPhase];
/** Hybrid athletes pay for high-fatigue schemas (>= threshold strips one
 *  accessory set, >= 1.5 strips two) — CNS budget protection. */
export const HYBRID_TAX_THRESHOLD = 1.3;

/** Accessory/secondary work = slots after the first two compounds. */
const ACCESSORY_SLOT_FROM = 3;

/** ACWR above this at peak-block generation time = overreaching: insert a
 *  deload week and shift the peak back (the deadlift auto-regulation rule —
 *  the hinge peak must never land on an overreached athlete). */
export const OVERREACH_ACWR = 1.5;

// --- RPE/rep -> %1RM translation (Epley): pct = 1 / (1 + totalReps/30) ------
/** Fraction of 1RM implied by `reps` at `rpe` (RIR = 10 - rpe). */
export const targetPct = (reps: number, rpe: number): number => {
  const totalReps = reps + Math.max(0, 10 - rpe);
  return 1 / (1 + totalReps / 30);
};
/** Physical target weight, rounded to the 2.5 kg plates actually on racks. */
export const targetLoadKg = (oneRmKg: number, reps: number, rpe: number): number =>
  Math.max(0, Math.round((oneRmKg * targetPct(reps, rpe)) / 2.5) * 2.5);

// ---------------------------------------------------------------------------
// Helpers (all pure)
// ---------------------------------------------------------------------------
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** ISO date + n days via UTC arithmetic (no timezone/DST traps). */
export const addDaysIso = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

export type ProgramReviewHorizon =
  | { kind: 'weeks'; blockCount: number }
  | { kind: 'date'; requestedReviewDate: string };

export interface NormalizedProgramHorizon {
  requestedReviewDate: string | null;
  plannedBlockCount: number;
  plannedEndDate: string;
}

const exactIsoUtcMs = (value: string, label: string): number => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must use YYYY-MM-DD.`);
  const [year, month, day] = value.split('-').map(Number);
  const ms = Date.UTC(year, month - 1, day);
  if (new Date(ms).toISOString().slice(0, 10) !== value) throw new Error(`${label} is not valid.`);
  return ms;
};

/** Normalize a 4-32 week review horizon against its stable program anchor.
 *  The anchor may move when a late continuation preserves full four-week
 *  blocks; future edits must reuse it rather than silently restarting the
 *  total horizon from the edit date. */
export const normalizeProgramHorizon = (
  anchorDate: string,
  horizon: ProgramReviewHorizon,
): NormalizedProgramHorizon => {
  const anchorMs = exactIsoUtcMs(anchorDate, 'Program anchor date');
  if (horizon.kind === 'weeks') {
    if (!Number.isInteger(horizon.blockCount) || horizon.blockCount < 1 || horizon.blockCount > 8) {
      throw new Error('Choose a review horizon from 4 to 32 weeks.');
    }
    return {
      requestedReviewDate: null,
      plannedBlockCount: horizon.blockCount,
      plannedEndDate: addDaysIso(anchorDate, horizon.blockCount * 28),
    };
  }
  const reviewMs = exactIsoUtcMs(horizon.requestedReviewDate, 'Review date');
  const daysAway = Math.floor((reviewMs - anchorMs) / 86400000);
  if (daysAway < 28 || daysAway > 224) throw new Error('Review date must be 4 to 32 weeks away.');
  const plannedBlockCount = Math.ceil(daysAway / 28);
  return {
    requestedReviewDate: horizon.requestedReviewDate,
    plannedBlockCount,
    plannedEndDate: addDaysIso(anchorDate, plannedBlockCount * 28),
  };
};

/** Recover the stable review-horizon anchor from durable program state. */
export const programHorizonAnchor = (plannedEndDate: string, plannedBlockCount: number): string => {
  exactIsoUtcMs(plannedEndDate, 'Program end date');
  if (!Number.isInteger(plannedBlockCount) || plannedBlockCount < 1 || plannedBlockCount > 8) {
    throw new Error('Program block count is not valid.');
  }
  return addDaysIso(plannedEndDate, -plannedBlockCount * 28);
};

/** STRICT boolean equipment filter (boundary invariant 3). */
export const availableMovements = (
  movements: readonly GeneratorMovement[],
  inventory: readonly string[],
): GeneratorMovement[] =>
  movements.filter((m) => m.required.every((item) => inventory.includes(item)));

/** Deterministic pick: most compound first, then stable movement_id order. */
const pickForPattern = (
  pool: readonly GeneratorMovement[],
  pattern: MovementPattern,
  usedIds: ReadonlySet<number>,
): GeneratorMovement | null => {
  let best: GeneratorMovement | null = null;
  for (const m of pool) {
    if (m.pattern !== pattern || usedIds.has(m.movement_id)) continue;
    if (
      best === null ||
      (m.is_compound && !best.is_compound) ||
      (m.is_compound === best.is_compound && m.movement_id < best.movement_id)
    ) {
      best = m;
    }
  }
  return best;
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------
export function generateBlock(input: BlockInput): BlockPlan {
  const { profile, startDate } = input;
  const schemaType: SchemaType = input.schemaType ?? 'LINEAR';
  const macroBlockIndex = clamp(Math.round(input.macroBlockIndex ?? 1), 1, MACRO_BLOCKS);
  const macroPhase = macroPhaseOf(macroBlockIndex);
  const recentAcwr = input.recentAcwr ?? null;

  // Phase 13 Step 4 — autopilot intercept. Halt supremacy: a recorded halt snaps
  // the block to a RECOVERY template (every week deloaded, no progressive
  // overload) and suppresses ALL per-pattern corrections. Otherwise the bounded
  // ControlAction supplies the per-pattern target_rpe / set deltas.
  const flawReport = input.flawReport;
  const recovery = flawReport?.globalGuardrail?.halt === true;
  const control: ControlAction | null =
    flawReport !== undefined && !recovery
      ? deriveControlAction(flawReport, profile, macroPhase, macroBlockIndex)
      : null;
  // Positive set additions are granted ONCE per pattern (the block-wide +2 cap is
  // already enforced inside deriveControlAction.blockAddedSets).
  const positiveApplied = new Set<MovementPattern>();
  // R1: a positive RPE grant is likewise applied to at most one planned slot
  // in the block. Cuts remain applied to every occurrence.
  const positiveRpeApplied = new Set<MovementPattern>();
  const autopilotAdjusted = new Set<MovementPattern>();
  const globalSafetyOverride = flawReport?.globalGuardrail;
  const restrictiveGlobalSafety = globalSafetyOverride !== null
    && globalSafetyOverride !== undefined
    && (globalSafetyOverride.load_multiplier < 1
      || globalSafetyOverride.set_delta < 0
      || globalSafetyOverride.rpe_cap_max < 10);
  const scheme = SCHEMES[profile.objective];
  const phaseMod = PHASE_MODS[macroPhase];
  const frequency = clamp(profile.weekly_frequency, 1, 7);
  const split = SPLITS[profile.objective][frequency - 1];
  const spread = DAY_SPREAD[frequency - 1];
  const programSchedule = input.programDays === undefined
    ? null
    : [...input.programDays]
        .sort((a, b) => a.day_index - b.day_index)
        .map((day) => ({ ...day, movement_preferences: [...(day.movement_preferences ?? [])] }));
  if (programSchedule !== null) {
    if (programSchedule.length < 1 || programSchedule.length > 7) {
      throw new Error('Program schedule must contain 1-7 days.');
    }
    const seenDays = new Set<number>();
    for (const day of programSchedule) {
      if (!Number.isInteger(day.day_index) || day.day_index < 1 || day.day_index > 7
          || seenDays.has(day.day_index) || !BLOCK_FOCI.has(day.focus)) {
        throw new Error('Program schedule contains an invalid or duplicate day.');
      }
      seenDays.add(day.day_index);
      const seenSlots = new Set<number>();
      const seenPatterns = new Set<MovementPattern>();
      for (const preference of day.movement_preferences) {
        if (!Number.isInteger(preference.slot_index) || preference.slot_index < 1 || preference.slot_index > 5
            || seenSlots.has(preference.slot_index) || seenPatterns.has(preference.pattern)
            || !FOCUS_PATTERNS[day.focus].includes(preference.pattern)) {
          throw new Error('Program schedule contains an invalid movement preference.');
        }
        seenSlots.add(preference.slot_index);
        seenPatterns.add(preference.pattern);
      }
    }
  }
  const schedule = programSchedule ?? split.map((focus, i) => ({
    day_index: spread[i], focus, movement_preferences: [] as ProgramMovementPreference[],
  }));
  const equipPool = availableMovements(input.movements, profile.equipment_inventory)
    .filter((movement) => movement.capability_available !== false);
  // Phase 16: tier gating — a beginner is never PRESCRIBED an Advanced
  // movement. Untagged rows (difficulty undefined) stay eligible so legacy
  // callers/fixtures are byte-identical; a pattern with no in-tier candidate
  // yields a dropped slot + warning at the pick site (strictness over
  // substitution — the tier cap is a hard safety bound, like equipment).
  // Plan P16 S4: "Beginner sees Beginner + whitelisted Intermediate staples;
  // Advanced sees all." Untagged rows (difficulty undefined) stay eligible so
  // legacy callers/fixtures are byte-identical.
  const pool = profile.training_age !== 'beginner'
    ? equipPool
    : equipPool.filter((m) =>
        m.difficulty === undefined || m.difficulty === 'Beginner' || m.beginner_ok === true);
  // Session slot budget from the duration cap (~22 min per movement including
  // rest), bounded to the planned_session shape the UI is built around.
  const slotBudget = clamp(Math.round(profile.session_duration_cap_min / 22), 2, 5);

  // Deadlift auto-regulation: if rolling fatigue is in the overreaching band
  // while a PEAK block is being generated, insert a deload week 1 and shift
  // the whole peaking progression back one week.
  const peakShifted =
    macroPhase === 'peak' && recentAcwr !== null && recentAcwr > OVERREACH_ACWR;
  const phaseByWeek: readonly BlockPhase[] = peakShifted
    ? ['deload', 'accumulation', 'intensification', 'realization']
    : PHASE_BY_WEEK;

  // The Hybrid Tax: high-fatigue schemas (cost matrix) are paid for by
  // stripping 1-2 working sets from accessory/secondary slots — concurrent
  // grappling load leaves no CNS budget for both.
  const fatigueCost = schemaFatigueCost(schemaType, macroPhase, false);
  const accessoryCut =
    profile.objective === 'hybrid'
      ? fatigueCost >= 1.5 ? 2 : fatigueCost >= HYBRID_TAX_THRESHOLD ? 1 : 0
      : 0;

  const warnings = new Set<string>();
  const sessions: PlannedSessionPlan[] = [];

  for (let week = 1; week <= BLOCK_WEEKS; week++) {
    const phase = phaseByWeek[week - 1];
    // Recovery (halt) deloads EVERY week; otherwise only the scheduled deload week.
    const deload = recovery || phase === 'deload';
    const sessionPhase: BlockPhase = recovery ? 'deload' : phase;
    // Loading row: non-deload weeks advance through the schema's three-week
    // pattern in order (a shifted peak runs it across weeks 2-4).
    const progIdx = clamp((peakShifted ? week - 2 : week - 1), 0, 2);
    const wmod = SCHEMA_WEEKS[schemaType][progIdx as 0 | 1 | 2];

    for (const { focus, day_index: dayIndex, movement_preferences: preferences } of schedule) {
      const patterns = FOCUS_PATTERNS[focus].slice(0, slotBudget);

      // Working sets: objective scheme + macro phase + schema row, damped for
      // hybrid strength days (interference) and beginners, +1 for elites.
      const workingSetsFor = (setsDelta: number, phaseSets: number): number => {
        let baseSets = scheme.sets + phaseSets + (deload ? 0 : setsDelta);
        if (profile.objective === 'hybrid' && STRENGTH_FOCI.has(focus)) baseSets -= 1;
        if (profile.training_age === 'beginner') baseSets -= 1;
        if (profile.training_age === 'elite') baseSets += 1;
        baseSets = clamp(baseSets, 2, 6);
        return deload ? Math.max(1, Math.ceil(baseSets / 2)) : baseSets;
      };

      // Reps: scheme reps through the schema's scale, then the phase delta.
      const reps = deload
        ? clamp(scheme.reps + phaseMod.reps, 1, 30)
        : clamp(Math.round(scheme.reps * wmod.repsScale) + phaseMod.reps, 1, 30);
      // Bodyweight prescriptions must reach the same rep threshold used by
      // the capability ladder. Loaded movements retain their phase-shaped
      // rep prescription, and deloads remain exempt from the floor.
      const bodyweightReps = deload
        ? reps
        : Math.max(reps, DEFAULT_ADVANCEMENT_POLICY.requiredReps);

      // Effort: schema row picks the wave position; deload pulls below week
      // 1 and ignores phase/schema heat. Every cap below stays monotone
      // conservative with the profile (machine-verified).
      let rpe = deload
        ? scheme.rpeWave[0] - 1.0
        : scheme.rpeWave[wmod.rpeIdx] + wmod.rpeDelta + phaseMod.rpe;
      rpe = Math.min(rpe, profile.base_rpe_cap);
      if (profile.objective === 'rehab') rpe = Math.min(rpe, 7.0);
      rpe = Math.max(5.0, Math.round(rpe * 2) / 2);

      const usedIds = new Set<number>();
      const slots: PlannedSlotPlan[] = [];
      for (const pattern of patterns) {
        const preferred = preferences.find((p) => p.pattern === pattern);
        const preferredMovement = preferred === undefined
          ? undefined
          : pool.find((candidate) => candidate.movement_id === preferred.movement_id
              && candidate.pattern === pattern && !usedIds.has(candidate.movement_id));
        const m = preferredMovement ?? pickForPattern(pool, pattern, usedIds);
        if (preferred !== undefined && preferredMovement === undefined && m !== null) {
          warnings.add(`${focus}: preferred ${pattern} movement unavailable; safe fallback used`);
        }
        if (preferred !== undefined && preferredMovement === undefined && m === null) {
          warnings.add(`${focus}: preferred ${pattern} movement unavailable; slot dropped`);
        }
        if (m === null) {
          // Strictness over substitution, tier included: a pattern the
          // inventory cannot support — or that only exists above the
          // athlete's tier cap — is dropped with a warning, never filled
          // upward. (Audit F1: the previous ungated fallback could hand a
          // beginner an Advanced movement.)
          const tierBlocked = pickForPattern(equipPool, pattern, usedIds) !== null;
          warnings.add(tierBlocked
            ? `${focus}: no tier-eligible movement for ${pattern}`
            : `${focus}: no equipment-available movement for ${pattern}`);
          continue;
        }
        usedIds.add(m.movement_id);
        const locomotion = m.pattern === 'locomotion';
        const slotIndex = slots.length + 1;
        // The hybrid tax lands on accessory/secondary slots of strength
        // sessions only, never below one working set, never on the deload.
        const taxed =
          !deload && accessoryCut > 0 && STRENGTH_FOCI.has(focus) &&
          slotIndex >= ACCESSORY_SLOT_FROM && !locomotion;
        const bodyweightSlot = isPurelyBodyweight(m);
        // RR-04: the macro phase's set delta belongs to primary work. Volume
        // is the only phase carrying a non-zero delta today, so accessories
        // stay at base volume while primary slots receive it.
        const primarySlot = slotIndex < ACCESSORY_SLOT_FROM;
        const slotWorkingSets = workingSetsFor(
          bodyweightSlot
            ? SCHEMA_WEEKS_BODYWEIGHT_SETS_DELTA[schemaType][progIdx as 0 | 1 | 2]
            : wmod.setsDelta,
          primarySlot ? phaseMod.sets : 0,
        );
        const setCap = m.set_cap === undefined
          ? 10
          : Number.isFinite(m.set_cap)
            ? clamp(Math.round(m.set_cap), 1, 10)
            : 1;
        let slotSets = Math.min(setCap, locomotion
          ? (deload ? Math.max(1, Math.ceil(LOCOMOTION_SETS / 2)) : LOCOMOTION_SETS)
          : Math.max(1, slotWorkingSets - (taxed ? accessoryCut : 0)));
        const slotReps = bodyweightSlot ? bodyweightReps : reps;
        let slotRpe = rpe;
        const preAutopilotSets = slotSets;
        const preAutopilotRpe = slotRpe;
        let autopilotDelta: AutopilotSlotDelta | undefined;
        // Phase 13 Step 4: apply the autopilot's per-pattern correction. Only on
        // NON-deload weeks (the deload is sacred) and not locomotion rounds.
        // dRpe shifts the prescribed effort (re-clamped to [5, base_rpe_cap],
        // rehab ≤ 7, 0.5 grid). R1 applies a positive dRpe grant once in the
        // block while negative dRpe still reaches every occurrence. dSet trims
        // every occurrence but ADDS at most once per pattern (block-wide +2 cap).
        if (control !== null && !deload && !locomotion) {
          const corr = control.corrections[m.pattern];
          const mayApplyRpe =
            corr.dRpe_p < 0 ||
            (corr.dRpe_p > 0 && !positiveRpeApplied.has(m.pattern));
          if (mayApplyRpe) {
            const previousRpe = slotRpe;
            let r = slotRpe + corr.dRpe_p;
            r = Math.min(r, profile.base_rpe_cap);
            if (profile.objective === 'rehab') r = Math.min(r, 7.0);
            slotRpe = Math.max(5.0, Math.round(r * 2) / 2);
            if (slotRpe !== previousRpe) {
              if (corr.dRpe_p > 0) positiveRpeApplied.add(m.pattern);
              autopilotAdjusted.add(m.pattern);
            }
          }
          if (corr.dSet_p < 0) {
            const previousSets = slotSets;
            slotSets = Math.max(1, slotSets + corr.dSet_p);
            if (slotSets !== previousSets) autopilotAdjusted.add(m.pattern);
          } else if (corr.dSet_p > 0 && !positiveApplied.has(m.pattern)) {
            const previousSets = slotSets;
            slotSets = Math.min(setCap, slotSets + corr.dSet_p);
            if (slotSets !== previousSets) {
              positiveApplied.add(m.pattern);
              autopilotAdjusted.add(m.pattern);
            }
          }
        }
        const rpeDelta = Math.round((slotRpe - preAutopilotRpe) * 2) / 2;
        const setDelta = slotSets - preAutopilotSets;
        if (rpeDelta !== 0 || setDelta !== 0) {
          const flaw = flawReport?.patterns[m.pattern];
          const heldForSafety = restrictiveGlobalSafety
            || flaw?.flawClass === 'caution'
            || (flaw !== undefined
              && flaw.maxJointSev >= EXPERIENCE_SEVERITY[profile.training_age].triageMin);
          autopilotDelta = {
            rpe_delta: rpeDelta,
            set_delta: setDelta,
            reason: heldForSafety
              ? 'held_safety'
              : rpeDelta < 0 || setDelta < 0
                ? 'eased'
                : 'raised',
          };
        }
        slots.push({
          slot_index: slotIndex,
          movement_id: m.movement_id,
          sets: slotSets,
          reps: locomotion ? LOCOMOTION_REPS : slotReps,
          target_rpe: slotRpe,
          ...(autopilotDelta === undefined ? {} : { autopilotDelta }),
        });
      }
      if (slots.length === 0) {
        warnings.add(`${focus}: session dropped, no available movements at all`);
        continue;
      }
      sessions.push({
        week_index: week,
        day_index: dayIndex,
        focus,
        phase: sessionPhase,
        session_date: addDaysIso(startDate, (week - 1) * 7 + (dayIndex - 1)),
        slots,
      });
    }
  }

  return {
    objective: profile.objective,
    start_date: startDate,
    weeks: BLOCK_WEEKS,
    schemaType,
    macroBlockIndex,
    macroPhase,
    peakShifted,
    sessions,
    warnings: [...warnings].sort(),
    recovery,
    autopilotAdjusted: [...autopilotAdjusted].sort(),
  };
}
