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
