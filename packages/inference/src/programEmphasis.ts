/**
 * programEmphasis.ts — how the athlete's focus, goal, sport and scheduled
 * sport workload reach the block generator (work order 3).
 *
 * It is an ADDITIVE side-car on BlockInput. When it is absent the generator
 * is byte-identical to what it was, and the persisted Objective values and
 * their CHECK constraint are untouched: a sport objective is never squeezed
 * into `athlete_profile.objective`.
 *
 * Precedence, fixed and enforced by where this is consulted in the generator:
 *
 *   1. safety, capability, equipment and experience-tier gates;
 *   2. the session time limit;
 *   3. the athlete's own explicit exercise choice for a slot;
 *   4. an exercise named by one of the athlete's goals;
 *   5. the objective's own laws (strength main lifts, loaded-first,
 *      bodybuilding and power ordering);
 *   6. this emphasis.
 *
 * So the emphasis only ever chooses among movements that already passed every
 * gate, never changes a main lift the objective fixed, and never adds time:
 * it re-uses a slot the session already had.
 *
 * Everything it does, and everything it could not do, is written to an
 * EmphasisReport in plain language. Nothing here promises an outcome.
 *
 * Pure: no clock, no storage, no randomness.
 */
import {
  MUSCLE_GROUP_INFO,
  describeFocus,
  type FocusSelection,
  type MovementMuscleRole,
  type MuscleGroupId,
  type MuscleRegion,
} from './focusGoals';
import {
  COMPETITION_DATE_NOTE,
  SPORT_OUTCOME_LABEL,
  sportDisplayName,
  sportEmphasisFor,
  sportWorkloadEffect,
  type SportProfile,
  type SportWorkload,
  type SportWorkloadTier,
} from './sportProfile';

export const PROGRAM_EMPHASIS_VERSION = 1 as const;

/** A goal the athlete tied to one exercise ("Squat 100 kg" -> the squat). */
export interface GoalMovementLink {
  readonly movementId: number;
  readonly goalLabel: string;
}

export interface ProgramEmphasis {
  readonly version: typeof PROGRAM_EMPHASIS_VERSION;
  readonly focus: {
    readonly muscles: readonly MuscleGroupId[];
    readonly movementControl: boolean;
    readonly description: string;
  } | null;
  readonly sport: {
    readonly name: string;
    readonly outcomeLabel: string;
    readonly muscles: readonly MuscleGroupId[];
    readonly competitionLifts: boolean;
    readonly summary: string;
    readonly limits: readonly string[];
    readonly citations: readonly string[];
    readonly competitionDate: string | null;
  } | null;
  readonly workload: {
    readonly tier: SportWorkloadTier;
    readonly accessorySetCut: 0 | 1 | 2;
    readonly holdHardestWeek: boolean;
    readonly explanation: string;
  } | null;
  readonly goalMovements: readonly GoalMovementLink[];
  /** The explicit movement-to-muscle mapping (movement_muscle_role). */
  readonly roles: readonly MovementMuscleRole[];
}

/** What the generator did with the emphasis, and what it could not do. */
export interface EmphasisReport {
  readonly version: typeof PROGRAM_EMPHASIS_VERSION;
  readonly applied: readonly string[];
  readonly omitted: readonly string[];
}

/**
 * Assemble the side-car from what the athlete has saved. Returns null when
 * there is nothing to apply (balanced focus, no sport, no goal exercise), so
 * the generator runs exactly as it did before.
 */
export function buildProgramEmphasis(input: {
  readonly focus: FocusSelection | null;
  readonly sport: SportProfile | null;
  readonly workload: SportWorkload | null;
  readonly goalMovements: readonly GoalMovementLink[];
  readonly roles: readonly MovementMuscleRole[];
}): ProgramEmphasis | null {
  const focus = input.focus !== null && input.focus.muscles.length > 0
    ? { muscles: [...input.focus.muscles], movementControl: input.focus.movementControl, description: describeFocus(input.focus) }
    : null;
  let sport: ProgramEmphasis['sport'] = null;
  if (input.sport !== null) {
    const derived = sportEmphasisFor(input.sport);
    sport = {
      name: sportDisplayName(input.sport),
      outcomeLabel: SPORT_OUTCOME_LABEL[input.sport.outcomeId],
      muscles: [...derived.muscles],
      competitionLifts: derived.competitionLifts,
      summary: derived.summary,
      limits: [...derived.limits],
      citations: derived.basis.map((basis) => basis.citation),
      competitionDate: input.sport.competitionDate,
    };
  }
  // Workload is reported whenever a sport is set (even "none": the athlete is
  // told nothing was adjusted and how to change that), and whenever the
  // schedule itself carries sport sessions.
  let workload: ProgramEmphasis['workload'] = null;
  if (input.workload !== null && (input.sport !== null || input.workload.tier !== 'none')) {
    const effect = sportWorkloadEffect(input.workload);
    workload = {
      tier: input.workload.tier,
      accessorySetCut: effect.accessorySetCut,
      holdHardestWeek: effect.holdHardestWeek,
      explanation: effect.explanation,
    };
  }
  const seen = new Set<number>();
  const goalMovements = input.goalMovements.filter((link) => {
    if (seen.has(link.movementId)) return false;
    seen.add(link.movementId);
    return true;
  });
  if (focus === null && sport === null && workload === null && goalMovements.length === 0) return null;
  return {
    version: PROGRAM_EMPHASIS_VERSION,
    focus,
    sport,
    workload,
    goalMovements,
    roles: input.roles,
  };
}

// ---------------------------------------------------------------------------
// Lookups the generator uses
// ---------------------------------------------------------------------------

/** The part of the body a strength day trains. */
export type EmphasisDayRegion = 'lower' | 'upper' | 'full';

const REGIONS_FOR_DAY: Record<EmphasisDayRegion, ReadonlySet<MuscleRegion>> = {
  lower: new Set<MuscleRegion>(['lower', 'trunk']),
  upper: new Set<MuscleRegion>(['upper', 'trunk']),
  full: new Set<MuscleRegion>(['lower', 'upper', 'trunk']),
};

export type EmphasisOrigin = 'focus' | 'sport';

/** Lower is better. Uncovered muscles come first so the emphasis is spread
 *  across the athlete's whole selection instead of piling onto one muscle. */
export const EMPHASIS_RANK_NONE = 6;

export interface EmphasisMatch {
  readonly rank: number;
  /** The emphasised muscle the movement was matched on; null when rank is none. */
  readonly muscle: MuscleGroupId | null;
  readonly origin: EmphasisOrigin | null;
}

export interface EmphasisIndex {
  /** Emphasised muscles in priority order: the athlete's focus, then the sport's. */
  readonly muscles: readonly MuscleGroupId[];
  readonly originOf: (muscle: MuscleGroupId) => EmphasisOrigin | null;
  /** Emphasised muscles a day of this kind can train, in priority order. */
  readonly musclesForDay: (day: EmphasisDayRegion) => readonly MuscleGroupId[];
  /** Emphasised muscles this movement is PRIMARY for. */
  readonly primaryFor: (movementId: number) => readonly MuscleGroupId[];
  /** Whether `replacement` still trains, as a primary, every muscle `original`
   *  is primary for (emphasised or not). A main lift may only be swapped for a
   *  movement that keeps doing the main lift's own job. */
  readonly keepsPrimaryWork: (replacementId: number, originalId: number) => boolean;
  /** Whether a movement belongs on a day of this kind, judged by the muscles
   *  it is primary for. A movement with no mapping fits a full-body day only. */
  readonly fitsDay: (movementId: number, day: EmphasisDayRegion) => boolean;
  /** How well a movement serves the emphasis, given what the session already covers. */
  readonly match: (movementId: number, covered: ReadonlySet<MuscleGroupId>) => EmphasisMatch;
  readonly movementControl: boolean;
}

export function makeEmphasisIndex(emphasis: ProgramEmphasis): EmphasisIndex {
  const origin = new Map<MuscleGroupId, EmphasisOrigin>();
  for (const muscle of emphasis.focus?.muscles ?? []) origin.set(muscle, 'focus');
  for (const muscle of emphasis.sport?.muscles ?? []) if (!origin.has(muscle)) origin.set(muscle, 'sport');
  const muscles = [...origin.keys()];
  const primary = new Map<number, MuscleGroupId[]>();
  const supporting = new Map<number, MuscleGroupId[]>();
  const everyPrimary = new Map<number, Set<MuscleGroupId>>();
  for (const row of emphasis.roles) {
    if (row.role === 'primary') {
      const all = everyPrimary.get(row.movementId) ?? new Set<MuscleGroupId>();
      all.add(row.muscleGroupId);
      everyPrimary.set(row.movementId, all);
    }
    if (!origin.has(row.muscleGroupId)) continue;
    const target = row.role === 'primary' ? primary : supporting;
    const list = target.get(row.movementId) ?? [];
    list.push(row.muscleGroupId);
    target.set(row.movementId, list);
  }
  const inPriorityOrder = (list: readonly MuscleGroupId[]): MuscleGroupId[] =>
    muscles.filter((muscle) => list.includes(muscle));
  const first = (
    list: readonly MuscleGroupId[], wanted: EmphasisOrigin, covered: ReadonlySet<MuscleGroupId> | null,
  ): MuscleGroupId | null => inPriorityOrder(list).find((muscle) =>
    origin.get(muscle) === wanted && (covered === null || !covered.has(muscle))) ?? null;

  return {
    muscles,
    originOf: (muscle) => origin.get(muscle) ?? null,
    musclesForDay: (day) => muscles.filter((muscle) => REGIONS_FOR_DAY[day].has(MUSCLE_GROUP_INFO[muscle].region)),
    primaryFor: (movementId) => inPriorityOrder(primary.get(movementId) ?? []),
    fitsDay: (movementId, day) => {
      const all = everyPrimary.get(movementId);
      if (all === undefined || all.size === 0) return day === 'full';
      for (const muscle of all) if (REGIONS_FOR_DAY[day].has(MUSCLE_GROUP_INFO[muscle].region)) return true;
      return false;
    },
    keepsPrimaryWork: (replacementId, originalId) => {
      const replacement = everyPrimary.get(replacementId) ?? new Set<MuscleGroupId>();
      for (const muscle of everyPrimary.get(originalId) ?? []) if (!replacement.has(muscle)) return false;
      return true;
    },
    match: (movementId, covered) => {
      const primaries = primary.get(movementId) ?? [];
      const supports = supporting.get(movementId) ?? [];
      const tiers: readonly [readonly MuscleGroupId[], EmphasisOrigin, ReadonlySet<MuscleGroupId> | null][] = [
        [primaries, 'focus', covered],
        [primaries, 'sport', covered],
        [primaries, 'focus', null],
        [primaries, 'sport', null],
        [supports, 'focus', null],
        [supports, 'sport', null],
      ];
      for (const [rank, [list, wanted, uncoveredOnly]] of tiers.entries()) {
        const muscle = first(list, wanted, uncoveredOnly);
        if (muscle !== null) return { rank, muscle, origin: wanted };
      }
      return { rank: EMPHASIS_RANK_NONE, muscle: null, origin: null };
    },
    movementControl: emphasis.focus?.movementControl === true,
  };
}

// ---------------------------------------------------------------------------
// Plain-language report lines
// ---------------------------------------------------------------------------

const muscleName = (muscle: MuscleGroupId): string => MUSCLE_GROUP_INFO[muscle].label.toLowerCase();

export const emphasisReason = (origin: EmphasisOrigin, emphasis: ProgramEmphasis): string =>
  origin === 'focus'
    ? 'your focus'
    : `your ${emphasis.sport?.name ?? 'sport'} outcome`;

export const describeEmphasisSwap = (input: {
  readonly chosen: string; readonly instead: string; readonly muscle: MuscleGroupId;
  readonly origin: EmphasisOrigin; readonly emphasis: ProgramEmphasis;
}): string =>
  `${input.chosen} is planned instead of ${input.instead}: it trains ${muscleName(input.muscle)} directly (${emphasisReason(input.origin, input.emphasis)}).`;

export const describeEmphasisSlot = (input: {
  readonly chosen: string; readonly displaced: string | null; readonly day: EmphasisDayRegion;
  /** The emphasised muscle the slot is for, or the goal that names the exercise. */
  readonly why: { readonly muscle: MuscleGroupId; readonly origin: EmphasisOrigin } | { readonly goalLabel: string };
  readonly emphasis: ProgramEmphasis;
}): string => {
  const reason = 'goalLabel' in input.why
    ? `because of your goal "${input.why.goalLabel}"`
    : `for ${muscleName(input.why.muscle)} (${emphasisReason(input.why.origin, input.emphasis)})`;
  return input.displaced === null
    ? `${input.chosen} is added to a ${input.day} day ${reason}. The session had room for it.`
    : `${input.chosen} takes the place of ${input.displaced} on one ${input.day} day a week, ${reason}. ${input.displaced} is still trained on another day.`;
};

export type EmphasisGap = 'no_exercise' | 'no_room' | 'no_day';

export const describeEmphasisGap = (muscle: MuscleGroupId, gap: EmphasisGap, capMin: number): string => {
  const name = muscleName(muscle);
  switch (gap) {
    case 'no_exercise':
      return `No extra ${name} work: no exercise that trains ${name} directly passed your equipment, experience and availability checks.`;
    case 'no_day':
      return `No extra ${name} work: this plan has no strength day that trains that part of the body.`;
    case 'no_room':
    default:
      return `No room for extra ${name} work in your ${capMin}-minute sessions: what is already planned is a main lift, already serves your emphasis, or is the only time that movement is trained in the week. Longer sessions or one more training day would make room.`;
  }
};

export type GoalMovementGap = 'unknown' | 'no_slot' | 'equipment' | 'tier' | 'capability' | 'own_choice';

export const describeGoalMovementPlaced = (movement: string, goal: string): string =>
  `${movement} is in your plan because of your goal "${goal}". It is never the first thing cut when a session is short.`;

export const describeGoalMovementGap = (movement: string, goal: string, gap: GoalMovementGap): string => {
  const lead = `Your goal "${goal}" names ${movement}, but it is not in this plan:`;
  switch (gap) {
    case 'equipment': return `${lead} it needs equipment you have not listed.`;
    case 'tier': return `${lead} it is above your current experience level.`;
    case 'capability': return `${lead} it is not available to you right now.`;
    case 'own_choice': return `${lead} you chose a different exercise for that slot, and your choice was kept.`;
    case 'no_slot': return `${lead} no session in this plan has a place for that kind of movement.`;
    case 'unknown':
    default: return `${lead} the exercise is no longer in the library.`;
  }
};

export const describeCompetitionLifts = (planned: readonly string[], missing: readonly string[]): string[] => {
  const lines: string[] = [];
  if (planned.length > 0) lines.push(`Competition lifts planned as main lifts: ${planned.join(', ')}.`);
  return lines.concat(missing.map((name) => `${name} is not planned as a main lift: it did not pass your equipment, experience or availability checks, or no session has a place for it.`));
};

/** The fixed lines every report carries for a sport answer. */
export function sportReportLines(emphasis: ProgramEmphasis): { applied: string[]; omitted: string[] } {
  const applied: string[] = [];
  const omitted: string[] = [];
  if (emphasis.sport !== null) {
    applied.push(`${emphasis.sport.name} — ${emphasis.sport.outcomeLabel.toLowerCase()}: ${emphasis.sport.summary}`);
    omitted.push(...emphasis.sport.limits);
    if (emphasis.sport.competitionDate !== null) {
      omitted.push(`Your competition on ${emphasis.sport.competitionDate} does not change this plan. ${COMPETITION_DATE_NOTE}`);
    } else if (emphasis.sport.competitionLifts) {
      omitted.push('The app does not plan a peak, a taper or a maximum test for a meet.');
    }
  }
  if (emphasis.workload !== null) {
    (emphasis.workload.accessorySetCut > 0 || emphasis.workload.holdHardestWeek ? applied : omitted)
      .push(emphasis.workload.explanation);
  }
  return { applied, omitted };
}

/** Shown when nothing was set, so the athlete is not left guessing. */
export const NO_EMPHASIS_EXPLANATION = 'No focus, sport or goal exercise is set, so this is the standard plan for your objective. You can set them in Athlete Profile; they are used when the next block is created.';
