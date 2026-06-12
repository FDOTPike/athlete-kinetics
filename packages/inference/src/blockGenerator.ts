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
import type { MovementPattern, Objective, UserProfile } from './types';

// ---------------------------------------------------------------------------
// Inputs / outputs (mirror the 007 block tables 1:1)
// ---------------------------------------------------------------------------
export interface GeneratorMovement {
  movement_id: number;
  name: string;
  pattern: MovementPattern;
  is_compound: boolean;
  /** movement_equipment rows; empty = bodyweight. */
  required: readonly string[];
}

export type BlockFocus = 'lower' | 'upper' | 'full' | 'conditioning' | 'bjj';
export type BlockPhase = 'accumulation' | 'intensification' | 'realization' | 'deload';

export interface PlannedSlotPlan {
  slot_index: number;   // 1-based
  movement_id: number;
  sets: number;         // 1..10 (schema CHECK)
  reps: number;         // 1..30
  target_rpe: number;   // 5.0..10.0
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
  sessions: PlannedSessionPlan[];
  /** Pattern slots that had no equipment-available movement (deduped). */
  warnings: string[];
}

export interface BlockInput {
  profile: UserProfile;
  movements: readonly GeneratorMovement[];
  /** Generation day; week 1 day 1 lands here. */
  startDate: string;
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
// Helpers (all pure)
// ---------------------------------------------------------------------------
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** ISO date + n days via UTC arithmetic (no timezone/DST traps). */
export const addDaysIso = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
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
  const scheme = SCHEMES[profile.objective];
  const split = SPLITS[profile.objective][clamp(profile.weekly_frequency, 1, 7) - 1];
  const spread = DAY_SPREAD[clamp(profile.weekly_frequency, 1, 7) - 1];
  const pool = availableMovements(input.movements, profile.equipment_inventory);
  // Session slot budget from the duration cap (~22 min per movement including
  // rest), bounded to the planned_session shape the UI is built around.
  const slotBudget = clamp(Math.round(profile.session_duration_cap_min / 22), 2, 5);

  const warnings = new Set<string>();
  const sessions: PlannedSessionPlan[] = [];

  for (let week = 1; week <= BLOCK_WEEKS; week++) {
    const phase = PHASE_BY_WEEK[week - 1];
    const deload = week === BLOCK_WEEKS;

    for (let dayPos = 0; dayPos < split.length; dayPos++) {
      const focus = split[dayPos];
      const dayIndex = spread[dayPos];
      const patterns = FOCUS_PATTERNS[focus].slice(0, slotBudget);

      // Working sets: objective scheme, damped for hybrid strength days
      // (interference management) and beginners, raised one for elites.
      let baseSets = scheme.sets;
      if (profile.objective === 'hybrid' && STRENGTH_FOCI.has(focus)) baseSets -= 1;
      if (profile.training_age === 'beginner') baseSets -= 1;
      if (profile.training_age === 'elite') baseSets += 1;
      baseSets = clamp(baseSets, 2, 6);
      const workingSets = deload ? Math.max(1, Math.ceil(baseSets / 2)) : baseSets;

      // Effort: weekly wave, deload pulls below week 1; every cap below is
      // monotone conservative with the profile (machine-verified).
      let rpe = deload ? scheme.rpeWave[0] - 1.0 : scheme.rpeWave[week - 1];
      rpe = Math.min(rpe, profile.base_rpe_cap);
      if (profile.objective === 'rehab') rpe = Math.min(rpe, 7.0);
      rpe = Math.max(5.0, rpe);

      const usedIds = new Set<number>();
      const slots: PlannedSlotPlan[] = [];
      for (const pattern of patterns) {
        const m = pickForPattern(pool, pattern, usedIds);
        if (m === null) {
          // Strictness over substitution: a pattern the inventory cannot
          // support is dropped, never replaced with unavailable equipment.
          warnings.add(`${focus}: no equipment-available movement for ${pattern}`);
          continue;
        }
        usedIds.add(m.movement_id);
        const locomotion = m.pattern === 'locomotion';
        slots.push({
          slot_index: slots.length + 1,
          movement_id: m.movement_id,
          sets: locomotion
            ? (deload ? Math.max(1, Math.ceil(LOCOMOTION_SETS / 2)) : LOCOMOTION_SETS)
            : workingSets,
          reps: locomotion ? LOCOMOTION_REPS : scheme.reps,
          target_rpe: rpe,
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
        phase,
        session_date: addDaysIso(startDate, (week - 1) * 7 + (dayIndex - 1)),
        slots,
      });
    }
  }

  return {
    objective: profile.objective,
    start_date: startDate,
    weeks: BLOCK_WEEKS,
    sessions,
    warnings: [...warnings].sort(),
  };
}
