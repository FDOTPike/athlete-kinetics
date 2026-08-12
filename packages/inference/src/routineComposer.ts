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

const roleMinutes: Record<RoutineRole, number> = { major: 18, supplementary: 12, conditional: 8 };
const baseDose: Record<RoutineRole, readonly [number, number, number]> = {
  major: [4, 5, 8], supplementary: [3, 8, 7.5], conditional: [2, 12, 7],
};
const ageSetDelta: Record<TrainingAge, number> = { beginner: -1, intermediate: 0, advanced: 1, elite: 1 };

/** Revalidate a frozen routine against its live, DB-derived role policy.
 * Missing and duplicated source rows are deliberately unverifiable because
 * the planned-session method snapshot does not carry a template day index. */
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
