import type { Objective, SchemaType, TrainingAge } from './types';

export type RoutineRole = 'major' | 'supplementary' | 'conditional';
export interface RoutineSelection { readonly movementId: number; readonly role: RoutineRole; }
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

const roleOrder: Record<RoutineRole, number> = { major: 0, supplementary: 1, conditional: 2 };
const roleMinutes: Record<RoutineRole, number> = { major: 18, supplementary: 12, conditional: 8 };
const baseDose: Record<RoutineRole, readonly [number, number, number]> = {
  major: [4, 5, 8], supplementary: [3, 8, 7.5], conditional: [2, 12, 7],
};
const ageSetDelta: Record<TrainingAge, number> = { beginner: -1, intermediate: 0, advanced: 1, elite: 1 };

/** Deterministic pre-session composer. It enforces role counts, duration, the
 * shared availability verdict, and the existing RPE cap before freezing slots. */
export function composeRoutine(input: ComposeRoutineInput): ComposedRoutine {
  const warnings: string[] = [];
  const seen = new Set<number>();
  const counts: Record<RoutineRole, number> = { major: 0, supplementary: 0, conditional: 0 };
  const maxima: Record<RoutineRole, number> = { major: 1, supplementary: 2, conditional: 3 };
  let minutes = 0;
  const accepted = [...input.selections].sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);
  const slots: RoutinePrescription[] = [];
  for (const selection of accepted) {
    if (seen.has(selection.movementId)) { warnings.push(`Movement ${selection.movementId} was selected more than once.`); continue; }
    seen.add(selection.movementId);
    if (!input.availableMovementIds.has(selection.movementId)) { warnings.push(`Movement ${selection.movementId} is teaching-only.`); continue; }
    if (counts[selection.role] >= maxima[selection.role]) { warnings.push(`Too many ${selection.role} movements.`); continue; }
    if (minutes + roleMinutes[selection.role] > Math.max(15, input.durationCapMin)) { warnings.push(`Duration cap omitted movement ${selection.movementId}.`); continue; }
    const [baseSets, baseReps, baseRpe] = baseDose[selection.role];
    const methodSetDelta = input.schemaType === 'STEP' ? 1 : input.schemaType === 'WAVE' && selection.role === 'major' ? 1 : 0;
    const objectiveRepDelta = input.objective === 'strength' ? -1 : input.objective === 'hypertrophy' ? 1 : 0;
    const methodRepDelta = input.schemaType === 'WAVE' ? -1 : input.schemaType === 'APRE' ? 1 : 0;
    const methodRpeDelta = input.schemaType === 'APRE' ? -0.5 : input.schemaType === 'STEP' ? 0.25 : 0;
    slots.push({
      ...selection,
      slotIndex: slots.length + 1,
      sets: Math.max(1, Math.min(10, baseSets + ageSetDelta[input.trainingAge] + methodSetDelta)),
      reps: Math.max(1, Math.min(100, baseReps + objectiveRepDelta + methodRepDelta)),
      targetRpe: Math.max(5, Math.min(input.baseRpeCap, baseRpe + methodRpeDelta)),
    });
    counts[selection.role] += 1;
    minutes += roleMinutes[selection.role];
  }
  return { slots, warnings };
}