import type { Objective, SchemaType, TrainingAge } from './types';

export type RoutineRole = 'major' | 'supplementary' | 'conditional';
export interface RoutineSelection { readonly movementId: number; readonly role: RoutineRole; }
export interface RoutineRoleSnapshotRow extends RoutineSelection {}
export type RoutineRoleEligibility = Readonly<Record<RoutineRole, ReadonlySet<number>>>;
export interface RoutinePrescription extends RoutineSelection { readonly slotIndex: number; readonly sets: number; readonly reps: number; readonly targetRpe: number; }
export interface ComposeRoutineInput {
  readonly selections: readonly RoutineSelection[];
  readonly schemaType: SchemaType;
  readonly objective: Objective;
  readonly trainingAge: TrainingAge;
  readonly durationCapMin: number;
  readonly baseRpeCap: number;
  readonly availableMovementIds: ReadonlySet<number>;
}
export interface ComposedRoutine { readonly slots: readonly RoutinePrescription[]; readonly warnings: readonly string[]; }

/** Minimal movement shape used by the routine builder's recommendation law.
 * IDs and role/access eligibility stay database-owned; names only bind the
 * deliberately curated relationship between the eight ratified major lifts
 * and their preferred supplementary work. */
export interface RoutineRecommendationMovement {
  readonly movementId: number;
  readonly name: string;
  readonly pattern: string;
  readonly targetMuscles: readonly string[];
  readonly isCompound: boolean;
}

export interface RoutineSupplementaryRecommendation {
  readonly movementId: number;
  readonly rank: number;
  readonly reason: string;
  readonly curated: boolean;
}

export interface RoutineMajorRpeProjection {
  /** Loading-week 1 target. */
  readonly startRpe: number;
  /** Highest target reached during the three loading weeks. */
  readonly maxRpe: number;
  /** Weeks 1-3 loading targets followed by the week-4 deload target. */
  readonly weekTargets: readonly [number, number, number, number];
}

interface CuratedRecommendation {
  readonly name: string;
  readonly reason: string;
}

/** Owner-delegated, deterministic coaching curation. These are names rather
 * than IDs because movement IDs remain database-owned. Callers must still
 * supply only live, role-eligible, executable candidates; this table can
 * rank a movement but can never grant access to it. */
const CURATED_SUPPLEMENTARY_BY_MAJOR: Readonly<Record<string, readonly CuratedRecommendation[]>> = {
  'Competition Squat': [
    { name: 'Romanian Deadlift', reason: 'Posterior-chain support' },
    { name: 'Bulgarian Split Squat', reason: 'Unilateral leg strength' },
    { name: 'Barbell Hip Thrust', reason: 'Hip-extension strength' },
  ],
  'Front Squat': [
    { name: 'Romanian Deadlift', reason: 'Posterior-chain balance' },
    { name: 'Bulgarian Split Squat', reason: 'Unilateral leg strength' },
    { name: 'Barbell Hip Thrust', reason: 'Hip-extension strength' },
  ],
  Deadlift: [
    { name: 'Barbell Hip Thrust', reason: 'Hip-extension volume with less spinal loading' },
    { name: 'Bulgarian Split Squat', reason: 'Unilateral leg strength' },
    { name: 'Chest-Supported Dumbbell Row', reason: 'Upper-back support with less spinal loading' },
  ],
  'Sumo Deadlift': [
    { name: 'Romanian Deadlift', reason: 'Hamstring and hinge support' },
    { name: 'Bulgarian Split Squat', reason: 'Unilateral leg strength' },
    { name: 'Barbell Hip Thrust', reason: 'Hip-extension strength' },
  ],
  'Competition Bench': [
    { name: 'Incline Dumbbell Press', reason: 'Pressing volume through a different angle' },
    { name: 'Barbell Row', reason: 'Upper-back support for pressing' },
    { name: 'Triceps Pushdown', reason: 'Elbow-extension support' },
  ],
  'Overhead Press': [
    { name: 'Pull-Up', reason: 'Vertical-pull balance' },
    { name: 'Incline Dumbbell Press', reason: 'Additional shoulder and pressing volume' },
    { name: 'Face Pull', reason: 'Scapular and rear-shoulder support' },
  ],
  'Barbell Row': [
    { name: 'Pull-Up', reason: 'Vertical-pull balance' },
    { name: 'Chest-Supported Dumbbell Row', reason: 'Upper-back volume with less spinal loading' },
    { name: 'Face Pull', reason: 'Scapular and rear-shoulder support' },
  ],
  'Power Clean': [
    { name: 'Front Squat', reason: 'Receiving-position and leg-strength support' },
    { name: 'Romanian Deadlift', reason: 'Posterior-chain strength' },
    { name: 'Overhead Press', reason: 'Upper-body force-transfer support' },
  ],
};

const COMPLEMENTARY_PATTERNS: Readonly<Record<string, readonly string[]>> = {
  squat: ['hinge', 'lunge', 'isolation', 'core'],
  hinge: ['lunge', 'pull_h', 'squat', 'core'],
  push_h: ['pull_h', 'push_h', 'pull_v', 'isolation'],
  push_v: ['pull_v', 'pull_h', 'push_h', 'isolation'],
  pull_h: ['pull_v', 'pull_h', 'push_h', 'isolation'],
};

const normalizedMuscles = (movement: RoutineRecommendationMovement): ReadonlySet<string> =>
  new Set(movement.targetMuscles.map((muscle) => muscle.trim().toLocaleLowerCase()).filter(Boolean));

/** Rank up to `limit` executable supplementary candidates for a selected
 * major. Curated matches always lead. If equipment, safety, tier or capability
 * removes one, a deterministic muscle/pattern score fills the gap without
 * weakening those upstream gates. */
export function rankRoutineSupplementaryRecommendations(
  major: RoutineRecommendationMovement | null,
  candidates: readonly RoutineRecommendationMovement[],
  limit = 3,
): readonly RoutineSupplementaryRecommendation[] {
  if (major === null || !Number.isInteger(limit) || limit < 1) return [];
  const curated = CURATED_SUPPLEMENTARY_BY_MAJOR[major.name] ?? [];
  const majorMuscles = normalizedMuscles(major);
  const complementary = COMPLEMENTARY_PATTERNS[major.pattern] ?? [];
  const uniqueCandidates = [...new Map(
    candidates
      .filter((candidate) => candidate.movementId !== major.movementId)
      .map((candidate) => [candidate.movementId, candidate] as const),
  ).values()];

  const fallbackScore = (candidate: RoutineRecommendationMovement): number => {
    const overlap = [...normalizedMuscles(candidate)].filter((muscle) => majorMuscles.has(muscle)).length;
    const patternIndex = complementary.indexOf(candidate.pattern);
    const patternScore = patternIndex < 0 ? 0 : (complementary.length - patternIndex) * 3;
    return overlap * 8 + patternScore + (candidate.isCompound ? 1 : 0);
  };

  uniqueCandidates.sort((a, b) => {
    const aCurated = curated.findIndex((entry) => entry.name === a.name);
    const bCurated = curated.findIndex((entry) => entry.name === b.name);
    if (aCurated >= 0 || bCurated >= 0) {
      if (aCurated < 0) return 1;
      if (bCurated < 0) return -1;
      return aCurated - bCurated;
    }
    return fallbackScore(b) - fallbackScore(a) || a.name.localeCompare(b.name);
  });

  return uniqueCandidates.slice(0, Math.min(limit, uniqueCandidates.length)).map((candidate, index) => {
    const authored = curated.find((entry) => entry.name === candidate.name);
    return {
      movementId: candidate.movementId,
      rank: index + 1,
      reason: authored?.reason ?? (fallbackScore(candidate) > 0
        ? 'Compatible supplementary support'
        : 'Available supplementary option'),
      curated: authored !== undefined,
    };
  });
}

const clampRpe = (value: number, cap: number): number => {
  const safeCap = Math.min(10, Math.max(5, Number.isFinite(cap) ? cap : 5));
  return Math.min(safeCap, Math.max(5, Math.round(value * 2) / 2));
};

/** Project a major lift's peak RPE across a four-week custom block. The
 * template's persisted target remains the peak (backward compatible); the
 * start and each frozen week are derived. The low point is 2.5 RPE below the
 * peak where the athlete's cap allows, matching the intentionally conservative
 * 6 -> 8.5 example. Each method then preserves its existing weekly shape. */
export function projectRoutineMajorRpe(
  peakTargetRpe: number,
  schemaType: SchemaType,
  baseRpeCap: number,
): RoutineMajorRpeProjection {
  const maxRpe = clampRpe(Number.isFinite(peakTargetRpe) ? peakTargetRpe : 5, baseRpeCap);
  const lowRpe = clampRpe(maxRpe - 2.5, maxRpe);
  const midpoint = clampRpe((lowRpe + maxRpe) / 2, maxRpe);
  const deload = clampRpe(lowRpe - 1, maxRpe);
  const loadingTargets: readonly [number, number, number] = schemaType === 'STEP'
    ? [lowRpe, lowRpe, maxRpe]
    : schemaType === 'WAVE'
      ? [lowRpe, maxRpe, midpoint]
      : schemaType === 'APRE'
        ? [midpoint, midpoint, maxRpe]
        : [lowRpe, midpoint, maxRpe];
  const startRpe = loadingTargets[0];
  return { startRpe, maxRpe, weekTargets: [...loadingTargets, deload] };
}

export function routineMajorRpeForWeek(
  peakTargetRpe: number,
  schemaType: SchemaType,
  weekIndex: number,
  baseRpeCap: number,
): number {
  if (!Number.isInteger(weekIndex) || weekIndex < 1 || weekIndex > 4) {
    throw new Error('Routine block week must be an integer from 1 to 4.');
  }
  return projectRoutineMajorRpe(peakTargetRpe, schemaType, baseRpeCap).weekTargets[weekIndex - 1];
}

/** One authored slot with its position inside the template. */
export interface RoutineTemplateSlotPlacement extends RoutineSelection {
  readonly dayIndex: number;
  readonly slotIndex: number;
}

/** Role budget for ONE routine day. Every populated day is an independently
 *  executable session, so these are never a template-wide allowance. */
export const ROUTINE_DAY_ROLE_MAXIMA: Readonly<Record<RoutineRole, number>> = {
  major: 1, supplementary: 2, conditional: 3,
};

/** Overall supported template size, unchanged by multi-day support. */
export const ROUTINE_TEMPLATE_MAX_SLOTS = 6;
export const ROUTINE_TEMPLATE_MAX_DAYS = 7;

/**
 * Group an authored template into its populated days and enforce the
 * structural routine law, throwing the athlete-facing message for the first
 * violation. Two scopes are deliberately different:
 *
 *   PER DAY   role maxima and exactly one major — a day is one session;
 *   PER TEMPLATE  the slot ceiling, position uniqueness, and MOVEMENT
 *                 IDENTITY. A movement may appear once in the whole template
 *                 so the day-index-free planned-session snapshot stays
 *                 decidable for isRoutineRoleSnapshotExecutable at start time.
 *
 * Role ratification, capability verdicts and dose bounds are the caller's
 * (database-backed) half; this function is pure and knows no athlete.
 */
export function groupRoutineTemplateDays(
  placements: readonly RoutineTemplateSlotPlacement[],
): ReadonlyMap<number, readonly RoutineTemplateSlotPlacement[]> {
  if (placements.length < 1 || placements.length > ROUTINE_TEMPLATE_MAX_SLOTS) {
    throw new Error(`A routine template must contain between 1 and ${ROUTINE_TEMPLATE_MAX_SLOTS} movements.`);
  }
  const byDay = new Map<number, RoutineTemplateSlotPlacement[]>();
  const countsByDay = new Map<number, Record<RoutineRole, number>>();
  const seenMovements = new Set<number>();
  const seenPositions = new Set<string>();

  for (const placement of placements) {
    const { dayIndex, slotIndex } = placement;
    if (!Number.isInteger(dayIndex) || dayIndex < 1 || dayIndex > ROUTINE_TEMPLATE_MAX_DAYS
      || !Number.isInteger(slotIndex) || slotIndex < 1 || slotIndex > ROUTINE_TEMPLATE_MAX_SLOTS) {
      throw new Error('Routine day and slot positions must stay inside the supported 1-7 / 1-6 bounds.');
    }
    const positionKey = `${dayIndex}:${slotIndex}`;
    if (seenPositions.has(positionKey)) throw new Error('Routine slot positions must be unique.');
    seenPositions.add(positionKey);
    if (seenMovements.has(placement.movementId)) {
      throw new Error('A movement can appear only once in a routine template.');
    }
    seenMovements.add(placement.movementId);
    const counts = countsByDay.get(dayIndex) ?? { major: 0, supplementary: 0, conditional: 0 };
    countsByDay.set(dayIndex, counts);
    counts[placement.role] += 1;
    const maximum = ROUTINE_DAY_ROLE_MAXIMA[placement.role];
    if (counts[placement.role] > maximum) {
      throw new Error(`A routine day supports at most ${maximum} ${placement.role} movement${maximum === 1 ? '' : 's'}.`);
    }
    const day = byDay.get(dayIndex) ?? [];
    day.push(placement);
    byDay.set(dayIndex, day);
  }

  const ordered = [...byDay.keys()].sort((a, b) => a - b);
  for (const dayIndex of ordered) {
    if (countsByDay.get(dayIndex)!.major !== 1) {
      throw new Error(`Routine day ${dayIndex} must contain exactly one major movement.`);
    }
  }
  return new Map(ordered.map((dayIndex) => [dayIndex, byDay.get(dayIndex)!]));
}

const roleMinutes: Record<RoutineRole, number> = { major: 18, supplementary: 12, conditional: 8 };
const baseDose: Record<RoutineRole, readonly [number, number, number]> = {
  major: [4, 5, 8], supplementary: [3, 8, 7.5], conditional: [2, 12, 7],
};
const ageSetDelta: Record<TrainingAge, number> = { beginner: -1, intermediate: 0, advanced: 1, elite: 1 };

/** Revalidate a frozen routine against its live, DB-derived role policy.
 *
 * `planMovementIds` is one executable day's frozen plan; `sourceRows` is the
 * whole template, which is why the sole-major law is counted over the plan and
 * never over the source. Missing and duplicated source rows are deliberately
 * unverifiable: the planned-session method snapshot does not carry a template
 * day index, so a movement that resolves to more than one role — or to none —
 * cannot be attributed to the day being started. The store keeps movement
 * identity unique template-wide precisely so this stays decidable. */
export function isRoutineRoleSnapshotExecutable(
  planMovementIds: readonly number[],
  sourceRows: readonly RoutineRoleSnapshotRow[],
  eligibility: RoutineRoleEligibility,
): boolean {
  const rolesByMovement = new Map<number, RoutineRole[]>();
  for (const row of sourceRows) {
    const roles = rolesByMovement.get(row.movementId) ?? [];
    roles.push(row.role);
    rolesByMovement.set(row.movementId, roles);
  }
  let majorCount = 0;
  for (const movementId of planMovementIds) {
    const roles = rolesByMovement.get(movementId) ?? [];
    if (roles.length !== 1) return false;
    const [role] = roles;
    if (!eligibility[role].has(movementId)) return false;
    if (role === 'major') majorCount += 1;
  }
  return majorCount === 1;
}

/** Deterministic pre-session composer. It enforces role counts, duration, the
 * shared availability verdict, and the existing RPE cap before freezing slots. */
export function composeRoutine(input: ComposeRoutineInput): ComposedRoutine {
  const warnings: string[] = [];
  const seen = new Set<number>();
  const counts: Record<RoutineRole, number> = { major: 0, supplementary: 0, conditional: 0 };
  const maxima: Record<RoutineRole, number> = { major: 1, supplementary: 2, conditional: 3 };
  const candidates: Array<RoutinePrescription & { readonly minutes: number }> = [];

  for (const selection of input.selections) {
    if (seen.has(selection.movementId)) {
      warnings.push(`Movement ${selection.movementId} was selected more than once.`);
      continue;
    }
    seen.add(selection.movementId);
    if (!input.availableMovementIds.has(selection.movementId)) {
      warnings.push(`Movement ${selection.movementId} is teaching-only.`);
      continue;
    }
    if (counts[selection.role] >= maxima[selection.role]) {
      warnings.push(`Too many ${selection.role} movements.`);
      continue;
    }
    const [baseSets, baseReps, baseRpe] = baseDose[selection.role];
    const methodSetDelta = input.schemaType === 'STEP' ? 1 : input.schemaType === 'WAVE' && selection.role === 'major' ? 1 : 0;
    const objectiveRepDelta = input.objective === 'strength' ? -1 : input.objective === 'hypertrophy' ? 1 : 0;
    const methodRepDelta = input.schemaType === 'WAVE' ? -1 : input.schemaType === 'APRE' ? 1 : 0;
    const methodRpeDelta = input.schemaType === 'APRE' ? -0.5 : input.schemaType === 'STEP' ? 0.25 : 0;
    candidates.push({
      ...selection,
      slotIndex: 0,
      sets: Math.max(1, Math.min(10, baseSets + ageSetDelta[input.trainingAge] + methodSetDelta)),
      reps: Math.max(1, Math.min(100, baseReps + objectiveRepDelta + methodRepDelta)),
      targetRpe: Math.max(5, Math.min(input.baseRpeCap, baseRpe + methodRpeDelta)),
      minutes: roleMinutes[selection.role],
    });
    counts[selection.role] += 1;
  }

  const included = new Set(candidates.map((_, index) => index));
  const durationCap = Math.max(15, input.durationCapMin);
  let totalMinutes = candidates.reduce((total, candidate) => total + candidate.minutes, 0);
  // Preserve athlete-authored order, but trim lowest-priority work first so a
  // short cap never keeps conditional work by sacrificing the sole major lift.
  for (const role of ['conditional', 'supplementary', 'major'] as const) {
    for (let index = candidates.length - 1; index >= 0 && totalMinutes > durationCap; index -= 1) {
      const candidate = candidates[index];
      if (!included.has(index) || candidate.role !== role || included.size === 1) continue;
      included.delete(index);
      totalMinutes -= candidate.minutes;
      warnings.push(`Duration cap omitted movement ${candidate.movementId}.`);
    }
  }

  const slots = candidates
    .filter((_, index) => included.has(index))
    .map(({ minutes: _minutes, ...candidate }, index): RoutinePrescription => ({
      ...candidate,
      slotIndex: index + 1,
    }));
  return { slots, warnings };
}
