import type { Objective, SchemaType, TrainingAge } from './types';
import {
  groupRoutineTemplateDays,
  type RoutineRole,
  type RoutineRoleEligibility,
} from './routineComposer';

export type RoutineStressPurpose = 'heavy' | 'volume' | 'technique' | 'speed' | 'low_fatigue';

/** Curated stress identity. This is deliberately separate from the capability
 * progression graph: capability answers "may the athlete perform it?", while
 * this contract answers "how much of this lift-family intent does it cost?". */
export interface RoutineLiftFamilyContract {
  readonly movementId: number;
  readonly family: string;
  readonly stressCoefficient: number;
  readonly preferredPurpose: RoutineStressPurpose | null;
}

/** Curated assistance distance from one major family to a candidate movement.
 * Distance 1 is close/direct supplementary work; distance 2-3 is useful,
 * low-fatigue accessory work. An absent row means no recommendation. */
export interface RoutineAssistanceContract {
  readonly family: string;
  readonly movementId: number;
  readonly distance: 1 | 2 | 3;
  readonly stressFactor: number;
  readonly fatigueCost: number;
  readonly reason: string;
}

export interface RoutineMicrocycleMovement {
  readonly movementId: number;
  readonly name: string;
  readonly pattern: string;
  readonly targetMuscles: readonly string[];
  readonly isCompound: boolean;
}

export interface RoutineMicrocycleSelection {
  readonly dayIndex: number;
  readonly slotIndex: number;
  readonly movementId: number;
  readonly role: RoutineRole;
  readonly sets?: number;
  readonly reps?: number;
  readonly targetRpe?: number;
}

export interface ComposeRoutineMicrocycleInput {
  readonly selections: readonly RoutineMicrocycleSelection[];
  readonly movements: readonly RoutineMicrocycleMovement[];
  readonly liftFamilies: readonly RoutineLiftFamilyContract[];
  readonly assistance: readonly RoutineAssistanceContract[];
  readonly roleEligibility: RoutineRoleEligibility;
  readonly schemaType: SchemaType;
  readonly objective: Objective;
  readonly trainingAge: TrainingAge;
  readonly durationCapMin: number;
  readonly baseRpeCap: number;
  readonly availableMovementIds: ReadonlySet<number>;
  /** Omit to validate every day (builder/save). A freeze supplies only the
   * selected day so future-day capability or role drift cannot block today,
   * while every day still contributes to weekly stress analysis. */
  readonly executionGateDayIndices?: ReadonlySet<number>;
}

export interface RoutineMicrocyclePrescription {
  readonly dayIndex: number;
  readonly sourceSlotIndex: number;
  readonly executionSlotIndex: number | null;
  readonly movementId: number;
  readonly role: RoutineRole;
  /** Materialized athlete-authored dose before any stress/duration adaptation. */
  readonly authoredSets: number;
  readonly authoredReps: number;
  readonly authoredTargetRpe: number;
  /** Final bounded dose used when the session is frozen. */
  readonly sets: number;
  readonly reps: number;
  readonly targetRpe: number;
  readonly included: boolean;
  readonly family: string | null;
  readonly stressCoefficient: number;
  readonly purpose: RoutineStressPurpose | null;
  /** The owner's requested a*volume1 + b*volume2 term. */
  readonly equivalentVolume: number;
  /** Equivalent volume additionally weighted by effort and stress purpose. */
  readonly stressDose: number;
  readonly adaptations: readonly string[];
}

export interface RoutineSessionFamilyStress {
  readonly dayIndex: number;
  /** One family exposure per session, even when it is distributed over variations. */
  readonly exposureCount: 1;
  readonly variationCount: number;
  readonly equivalentVolume: number;
  readonly initialStress: number;
  readonly finalStress: number;
  readonly budget: number;
  readonly level: 'low' | 'moderate' | 'high';
}

export interface RoutineFamilyStressDecision {
  readonly family: string;
  /** Number of training days carrying this family, not number of variations. */
  readonly exposureCount: number;
  /** Number of distinct selected movement variations in this family. */
  readonly variationCount: number;
  readonly equivalentVolume: number;
  readonly initialStress: number;
  readonly finalStress: number;
  readonly weeklyBudget: number;
  readonly level: 'low' | 'moderate' | 'high';
  readonly purposes: readonly RoutineStressPurpose[];
  readonly sessions: readonly RoutineSessionFamilyStress[];
  readonly adaptations: readonly string[];
}

export interface ComposedRoutineMicrocycle {
  readonly prescriptions: readonly RoutineMicrocyclePrescription[];
  readonly familyDecisions: readonly RoutineFamilyStressDecision[];
  readonly warnings: readonly string[];
  readonly recommendations: readonly string[];
  readonly adaptations: readonly string[];
  readonly blockers: readonly string[];
}

export interface RoutineAccessoryRecommendation {
  readonly movementId: number;
  readonly rank: number;
  readonly family: string;
  readonly distance: 2 | 3;
  readonly reason: string;
  readonly score: number;
}

interface MutablePrescription {
  dayIndex: number;
  sourceSlotIndex: number;
  executionSlotIndex: number | null;
  movementId: number;
  movementName: string;
  role: RoutineRole;
  sets: number;
  reps: number;
  targetRpe: number;
  included: boolean;
  family: string | null;
  stressCoefficient: number;
  purpose: RoutineStressPurpose | null;
  preferredPurpose: RoutineStressPurpose | null;
  originalSets: number;
  originalReps: number;
  originalTargetRpe: number;
  adaptations: string[];
}

const PURPOSE_SEQUENCE: readonly RoutineStressPurpose[] = [
  'heavy', 'volume', 'technique', 'speed', 'low_fatigue',
];

const PURPOSE_STRESS_FACTOR: Readonly<Record<RoutineStressPurpose, number>> = {
  heavy: 1.1,
  volume: 1,
  technique: 0.65,
  speed: 0.55,
  low_fatigue: 0.5,
};

const ROLE_SUPPORT_FACTOR: Readonly<Record<Exclude<RoutineRole, 'major'>, number>> = {
  supplementary: 0.45,
  accessory: 0.2,
  conditional: 0.25,
};

const ROLE_DEFAULTS: Readonly<Record<RoutineRole, readonly [number, number, number]>> = {
  major: [4, 5, 8],
  supplementary: [3, 8, 7.5],
  accessory: [2, 12, 6.5],
  conditional: [2, 12, 7],
};

const AGE_SET_DELTA: Readonly<Record<TrainingAge, number>> = {
  beginner: -1, intermediate: 0, advanced: 1, elite: 1,
};

/** Dose ceilings are deliberately exposure-count agnostic. Five light,
 * distributed exposures can fit; one excessive exposure is adapted. */
export const ROUTINE_FAMILY_STRESS_BUDGETS: Readonly<Record<TrainingAge, {
  readonly session: number;
  readonly week: number;
}>> = {
  beginner: { session: 0, week: 0 },
  intermediate: { session: 32, week: 60 },
  advanced: { session: 40, week: 80 },
  elite: { session: 48, week: 100 },
};

const round1 = (value: number): number => Math.round(value * 10) / 10;
const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));
const effortFactor = (rpe: number): number => 0.65 + (clamp(rpe, 5, 10) - 5) * 0.07;

const familyMapOf = (
  rows: readonly RoutineLiftFamilyContract[],
): ReadonlyMap<number, RoutineLiftFamilyContract> =>
  new Map(rows.map((row) => [row.movementId, row] as const));

const assistanceFor = (
  assistance: readonly RoutineAssistanceContract[],
  family: string,
  movementId: number,
): RoutineAssistanceContract | undefined => assistance.find(
  (row) => row.family === family && row.movementId === movementId,
);

/** Resolve roles in the current major context. Static DB eligibility remains a
 * hard outer gate; curated distance supplies the contextual half. */
export function contextualRoutineRoles(
  movementId: number,
  selectedMajorMovementIds: readonly number[],
  liftFamilies: readonly RoutineLiftFamilyContract[],
  assistance: readonly RoutineAssistanceContract[],
  eligibility: RoutineRoleEligibility,
): ReadonlySet<RoutineRole> {
  const result = new Set<RoutineRole>();
  const families = familyMapOf(liftFamilies);
  const candidateFamily = families.get(movementId)?.family;
  const majorFamilies = new Set(selectedMajorMovementIds
    .map((id) => families.get(id)?.family)
    .filter((family): family is string => family !== undefined));

  if (eligibility.major.has(movementId) && candidateFamily !== undefined) result.add('major');
  if (eligibility.conditional.has(movementId)) result.add('conditional');
  if (majorFamilies.size === 0) return result;

  const sameFamily = candidateFamily !== undefined && majorFamilies.has(candidateFamily);
  const closestRelation = [...majorFamilies]
    .map((family) => assistanceFor(assistance, family, movementId))
    .filter((row): row is RoutineAssistanceContract => row !== undefined)
    .sort((a, b) => a.distance - b.distance || a.fatigueCost - b.fatigueCost)[0];
  // The closest relationship controls the contextual support role. A movement
  // can remain statically multi-role without being offered as both direct
  // assistance and distant accessory work in the same mixed-family session.
  if (eligibility.supplementary.has(movementId)
      && (sameFamily || closestRelation?.distance === 1)) {
    result.add('supplementary');
  }
  if (!sameFamily && eligibility.accessory.has(movementId)
      && closestRelation !== undefined && closestRelation.distance >= 2) {
    result.add('accessory');
  }
  return result;
}

const defaultDose = (
  selection: RoutineMicrocycleSelection,
  input: Pick<ComposeRoutineMicrocycleInput, 'schemaType' | 'objective' | 'trainingAge' | 'baseRpeCap'>,
): readonly [number, number, number] => {
  const [baseSets, baseReps, baseRpe] = ROLE_DEFAULTS[selection.role];
  const methodSetDelta = input.schemaType === 'STEP'
    ? 1
    : input.schemaType === 'WAVE' && selection.role === 'major' ? 1 : 0;
  const objectiveRepDelta = input.objective === 'strength'
    ? -1
    : input.objective === 'hypertrophy' ? 1 : 0;
  const methodRepDelta = input.schemaType === 'WAVE' ? -1 : input.schemaType === 'APRE' ? 1 : 0;
  const methodRpeDelta = input.schemaType === 'APRE' ? -0.5 : input.schemaType === 'STEP' ? 0.25 : 0;
  return [
    clamp(baseSets + AGE_SET_DELTA[input.trainingAge] + methodSetDelta, 1, 10),
    clamp(baseReps + objectiveRepDelta + methodRepDelta, 1, 100),
    Math.round(clamp(baseRpe + methodRpeDelta, 5, input.baseRpeCap) * 2) / 2,
  ];
};

const majorEquivalentVolume = (row: MutablePrescription): number =>
  row.included && row.role === 'major' ? row.sets * row.reps * row.stressCoefficient : 0;

const majorStress = (row: MutablePrescription): number => {
  if (!row.included || row.role !== 'major' || row.purpose === null) return 0;
  return majorEquivalentVolume(row) * effortFactor(row.targetRpe) * PURPOSE_STRESS_FACTOR[row.purpose];
};

const supportStressForFamily = (
  row: MutablePrescription,
  family: string,
  familyByMovement: ReadonlyMap<number, RoutineLiftFamilyContract>,
  assistance: readonly RoutineAssistanceContract[],
): number => {
  if (!row.included || row.role === 'major') return 0;
  const sameFamily = familyByMovement.get(row.movementId)?.family === family;
  const relation = assistanceFor(assistance, family, row.movementId);
  if (!sameFamily && relation === undefined) return 0;
  const factor = sameFamily ? 0.5 : relation!.stressFactor;
  return row.sets * row.reps * factor * effortFactor(row.targetRpe) * ROLE_SUPPORT_FACTOR[row.role];
};

const familyBurden = (
  rows: readonly MutablePrescription[],
  family: string,
  familyByMovement: ReadonlyMap<number, RoutineLiftFamilyContract>,
  assistance: readonly RoutineAssistanceContract[],
  dayIndex?: number,
): number => rows
  .filter((row) => dayIndex === undefined || row.dayIndex === dayIndex)
  .reduce((sum, row) => sum + (row.family === family ? majorStress(row) : 0)
    + supportStressForFamily(row, family, familyByMovement, assistance), 0);

const stressLevel = (stress: number, budget: number): 'low' | 'moderate' | 'high' => {
  const ratio = budget <= 0 ? 1 : stress / budget;
  return ratio < 0.65 ? 'low' : ratio < 0.9 ? 'moderate' : 'high';
};

const isRelatedSupport = (
  row: MutablePrescription,
  family: string,
  familyByMovement: ReadonlyMap<number, RoutineLiftFamilyContract>,
  assistance: readonly RoutineAssistanceContract[],
): boolean => row.role !== 'major' && (
  familyByMovement.get(row.movementId)?.family === family
  || assistanceFor(assistance, family, row.movementId) !== undefined
);

const supportPriority = (role: RoutineRole): number =>
  role === 'accessory' ? 0 : role === 'conditional' ? 1 : role === 'supplementary' ? 2 : 3;

const purposeReductionPriority = (purpose: RoutineStressPurpose | null): number => {
  switch (purpose) {
    case 'low_fatigue': return 0;
    case 'speed': return 1;
    case 'technique': return 2;
    case 'volume': return 3;
    case 'heavy': return 4;
    default: return 5;
  }
};

const estimatedMinutes = (row: MutablePrescription): number => {
  if (!row.included) return 0;
  switch (row.role) {
    case 'major': return 3 + row.sets * 2.5;
    case 'supplementary': return 2 + row.sets * 1.5;
    case 'conditional': return 1.5 + row.sets * 1.25;
    case 'accessory': return 1 + row.sets;
  }
};

const adaptDuplicatePurpose = (row: MutablePrescription): void => {
  const purpose = row.purpose;
  if (purpose === null) return;
  const before = `${row.sets}x${row.reps}@${row.targetRpe.toFixed(1)}`;
  switch (purpose) {
    case 'volume':
      row.reps = clamp(row.reps + 2, 1, 100);
      row.targetRpe = Math.max(5, row.targetRpe - 0.5);
      break;
    case 'technique':
      row.sets = Math.min(row.sets, 3);
      row.reps = Math.min(row.reps, 5);
      row.targetRpe = Math.min(row.targetRpe, 6.5);
      break;
    case 'speed':
      row.sets = Math.min(row.sets, 4);
      row.reps = Math.min(row.reps, 3);
      row.targetRpe = Math.min(row.targetRpe, 6);
      break;
    case 'low_fatigue':
      row.sets = Math.min(row.sets, 2);
      row.reps = Math.min(row.reps, 5);
      row.targetRpe = Math.min(row.targetRpe, 6);
      break;
    case 'heavy':
      row.reps = Math.min(row.reps, 5);
      break;
  }
  const after = `${row.sets}x${row.reps}@${row.targetRpe.toFixed(1)}`;
  if (before !== after) row.adaptations.push(`Distinct ${purpose.replace('_', '-')} exposure: ${before} -> ${after}.`);
};

const assignPurposes = (rows: MutablePrescription[]): void => {
  const byFamily = new Map<string, MutablePrescription[]>();
  for (const row of rows) {
    if (row.role !== 'major' || row.family === null) continue;
    const familyRows = byFamily.get(row.family) ?? [];
    familyRows.push(row);
    byFamily.set(row.family, familyRows);
  }
  for (const familyRows of byFamily.values()) {
    familyRows.sort((a, b) => a.dayIndex - b.dayIndex || a.sourceSlotIndex - b.sourceSlotIndex);
    const used = new Set<RoutineStressPurpose>();
    for (const row of familyRows) {
      if (row.preferredPurpose !== null && !used.has(row.preferredPurpose)) {
        row.purpose = row.preferredPurpose;
        used.add(row.preferredPurpose);
      }
    }
    let cursor = familyRows.length === 1 ? 1 : 0;
    for (const row of familyRows) {
      if (row.purpose !== null) continue;
      let purpose = PURPOSE_SEQUENCE[cursor % PURPOSE_SEQUENCE.length];
      while (used.has(purpose) && used.size < PURPOSE_SEQUENCE.length) {
        cursor += 1;
        purpose = PURPOSE_SEQUENCE[cursor % PURPOSE_SEQUENCE.length];
      }
      row.purpose = purpose;
      used.add(purpose);
      cursor += 1;
    }

    const signatures = new Map<string, number>();
    for (const row of familyRows) {
      const signature = `${row.sets}:${row.reps}:${row.targetRpe}`;
      const seen = signatures.get(signature) ?? 0;
      signatures.set(signature, seen + 1);
      if (seen > 0) adaptDuplicatePurpose(row);
    }
  }
};

/** Build a complete, deterministic microcycle. Selection is uncapped; dose is
 * bounded. Every selected major is treated as athlete-locked and can disappear
 * only when a genuine blocker makes even a minimum prescription impossible. */
export function composeRoutineMicrocycle(input: ComposeRoutineMicrocycleInput): ComposedRoutineMicrocycle {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  const globalAdaptations: string[] = [];
  const movementById = new Map(input.movements.map((movement) => [movement.movementId, movement] as const));
  const familyByMovement = familyMapOf(input.liftFamilies);

  if (input.trainingAge === 'beginner') {
    blockers.push('Standalone routines unlock after the Beginner stage. Generated training remains available.');
  }
  try {
    groupRoutineTemplateDays(input.selections);
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : String(error));
  }

  for (const selection of input.selections) {
    const movement = movementById.get(selection.movementId);
    const enforceExecutionGate = input.executionGateDayIndices === undefined
      || input.executionGateDayIndices.has(selection.dayIndex);
    if (movement === undefined) blockers.push(`Movement ${selection.movementId} is missing from the live library.`);
    if (enforceExecutionGate && !input.availableMovementIds.has(selection.movementId)) {
      blockers.push(`${movement?.name ?? `Movement ${selection.movementId}`} is unavailable under equipment, safety, tier, capability, or attestation gates.`);
    }
    if (enforceExecutionGate && !input.roleEligibility[selection.role].has(selection.movementId)) {
      blockers.push(`${movement?.name ?? `Movement ${selection.movementId}`} is not ratified for the ${selection.role} role.`);
    }
    if (selection.role === 'major' && familyByMovement.get(selection.movementId) === undefined) {
      blockers.push(`${movement?.name ?? `Movement ${selection.movementId}`} has no curated lift-family stress contract.`);
    }
    if (selection.sets !== undefined && (!Number.isInteger(selection.sets) || selection.sets < 1 || selection.sets > 10)) {
      blockers.push(`${movement?.name ?? `Movement ${selection.movementId}`} sets must be a whole number from 1 to 10.`);
    }
    if (selection.reps !== undefined && (!Number.isInteger(selection.reps) || selection.reps < 1 || selection.reps > 100)) {
      blockers.push(`${movement?.name ?? `Movement ${selection.movementId}`} reps must be a whole number from 1 to 100.`);
    }
    if (selection.targetRpe !== undefined && (!Number.isFinite(selection.targetRpe)
        || selection.targetRpe < 5 || selection.targetRpe > input.baseRpeCap)) {
      blockers.push(`${movement?.name ?? `Movement ${selection.movementId}`} RPE must be between 5 and ${input.baseRpeCap}.`);
    }
  }

  const selectionsByDay = new Map<number, RoutineMicrocycleSelection[]>();
  for (const selection of input.selections) {
    const day = selectionsByDay.get(selection.dayIndex) ?? [];
    day.push(selection);
    selectionsByDay.set(selection.dayIndex, day);
  }
  for (const [dayIndex, day] of selectionsByDay) {
    if (input.executionGateDayIndices !== undefined
        && !input.executionGateDayIndices.has(dayIndex)) continue;
    const majors = day.filter((selection) => selection.role === 'major').map((selection) => selection.movementId);
    for (const selection of day) {
      const contextual = contextualRoutineRoles(
        selection.movementId, majors, input.liftFamilies, input.assistance, input.roleEligibility,
      );
      if (!contextual.has(selection.role)) {
        const movement = movementById.get(selection.movementId);
        blockers.push(`${movement?.name ?? `Movement ${selection.movementId}`} is not ${selection.role}-eligible for the major families on day ${dayIndex}.`);
      }
    }
  }

  const uniqueBlockers = [...new Set(blockers)];
  if (uniqueBlockers.length > 0) {
    return { prescriptions: [], familyDecisions: [], warnings: [], recommendations: [], adaptations: [], blockers: uniqueBlockers };
  }

  const rows: MutablePrescription[] = input.selections.map((selection) => {
    const movement = movementById.get(selection.movementId)!;
    const family = familyByMovement.get(selection.movementId);
    const [defaultSets, defaultReps, defaultRpe] = defaultDose(selection, input);
    const sets = selection.sets ?? defaultSets;
    const reps = selection.reps ?? defaultReps;
    const targetRpe = selection.targetRpe ?? defaultRpe;
    return {
      dayIndex: selection.dayIndex,
      sourceSlotIndex: selection.slotIndex,
      executionSlotIndex: null,
      movementId: selection.movementId,
      movementName: movement.name,
      role: selection.role,
      sets,
      reps,
      targetRpe,
      included: true,
      family: selection.role === 'major' ? family!.family : null,
      stressCoefficient: selection.role === 'major' ? family!.stressCoefficient : 0,
      purpose: null,
      preferredPurpose: selection.role === 'major' ? family!.preferredPurpose : null,
      originalSets: sets,
      originalReps: reps,
      originalTargetRpe: targetRpe,
      adaptations: [],
    };
  });

  assignPurposes(rows);
  const budgets = ROUTINE_FAMILY_STRESS_BUDGETS[input.trainingAge];
  const families = [...new Set(rows
    .filter((row) => row.role === 'major' && row.family !== null)
    .map((row) => row.family!))].sort();
  const daysByFamily = new Map(families.map((family) => [family, [...new Set(rows
    .filter((row) => row.family === family)
    .map((row) => row.dayIndex))].sort((a, b) => a - b)] as const));
  const initialSessionStress = new Map<string, number>();
  const initialWeeklyStress = new Map<string, number>();
  for (const family of families) {
    initialWeeklyStress.set(family, familyBurden(rows, family, familyByMovement, input.assistance));
    for (const dayIndex of daysByFamily.get(family) ?? []) {
      initialSessionStress.set(`${family}:${dayIndex}`, familyBurden(
        rows, family, familyByMovement, input.assistance, dayIndex,
      ));
    }
  }

  const boundFamily = (family: string, budget: number, dayIndex?: number): void => {
    const inScope = (row: MutablePrescription): boolean => dayIndex === undefined || row.dayIndex === dayIndex;
    const burden = (): number => familyBurden(rows, family, familyByMovement, input.assistance, dayIndex);
    const supports = rows
      .filter((row) => inScope(row) && row.included
        && isRelatedSupport(row, family, familyByMovement, input.assistance))
      .sort((a, b) => supportPriority(a.role) - supportPriority(b.role)
        || b.dayIndex - a.dayIndex || b.sourceSlotIndex - a.sourceSlotIndex);
    for (const row of supports) {
      if (burden() <= budget) break;
      if (row.role === 'accessory') {
        row.included = false;
        row.adaptations.push(`Omitted before changing ${family} major exposure because family stress was high.`);
      } else if (row.sets > 1) {
        row.sets = 1;
        row.adaptations.push(`Reduced to 1 set before changing ${family} major exposure.`);
      }
      if (burden() > budget && row.included) {
        row.included = false;
        row.adaptations.push(`Omitted before changing ${family} major exposure because the remaining family burden was high.`);
      }
    }

    const majors = rows
      .filter((row) => inScope(row) && row.included && row.role === 'major' && row.family === family)
      .sort((a, b) => purposeReductionPriority(a.purpose) - purposeReductionPriority(b.purpose)
        || b.dayIndex - a.dayIndex || b.sourceSlotIndex - a.sourceSlotIndex);
    let guard = 0;
    while (burden() > budget && guard < 10000) {
      guard += 1;
      let changed = false;
      for (const row of majors) {
        if (burden() <= budget) break;
        if (row.sets > 1) {
          row.sets -= 1;
          changed = true;
        } else if (row.reps > 1) {
          row.reps -= 1;
          changed = true;
        } else if (row.targetRpe > 5) {
          row.targetRpe = Math.max(5, row.targetRpe - 0.5);
          changed = true;
        }
      }
      if (!changed) break;
    }
    if (burden() > budget + 0.05) {
      blockers.push(`No valid minimum prescription can bound ${family} within its ${dayIndex === undefined ? 'weekly' : `day ${dayIndex}`} stress budget.`);
    }
  };

  for (const family of families) {
    for (const dayIndex of daysByFamily.get(family) ?? []) boundFamily(family, budgets.session, dayIndex);
    boundFamily(family, budgets.week);
  }

  const durationCap = Math.max(15, input.durationCapMin);
  for (const dayIndex of [...selectionsByDay.keys()].sort((a, b) => a - b)) {
    const dayRows = rows.filter((row) => row.dayIndex === dayIndex);
    const duration = (): number => dayRows.reduce((sum, row) => sum + estimatedMinutes(row), 0);
    const supports = dayRows.filter((row) => row.role !== 'major').sort(
      (a, b) => supportPriority(a.role) - supportPriority(b.role)
        || b.sourceSlotIndex - a.sourceSlotIndex,
    );
    for (const row of supports) {
      if (duration() <= durationCap) break;
      if (!row.included) continue;
      row.included = false;
      row.adaptations.push(`Omitted to keep day ${dayIndex} inside the ${durationCap}-minute duration cap before changing a major.`);
    }
    const majors = dayRows.filter((row) => row.role === 'major').sort(
      (a, b) => purposeReductionPriority(a.purpose) - purposeReductionPriority(b.purpose)
        || b.sourceSlotIndex - a.sourceSlotIndex,
    );
    let guard = 0;
    while (duration() > durationCap && guard < 1000) {
      guard += 1;
      const reducible = majors.find((row) => row.sets > 1);
      if (reducible === undefined) break;
      reducible.sets -= 1;
    }
    if (duration() > durationCap + 0.05) {
      blockers.push(`Day ${dayIndex} cannot fit every selected major at a safe minimum dose inside ${durationCap} minutes.`);
    }
  }

  for (const row of rows) {
    if (row.sets !== row.originalSets || row.reps !== row.originalReps
        || row.targetRpe !== row.originalTargetRpe) {
      const summary = `Dose bounded from ${row.originalSets}x${row.originalReps}@${row.originalTargetRpe.toFixed(1)} to ${row.sets}x${row.reps}@${row.targetRpe.toFixed(1)}.`;
      if (!row.adaptations.includes(summary)) row.adaptations.push(summary);
    }
  }

  const executionPurposeOrder: Readonly<Record<RoutineStressPurpose, number>> = {
    heavy: 0, speed: 1, volume: 2, technique: 3, low_fatigue: 4,
  };
  for (const dayIndex of [...selectionsByDay.keys()].sort((a, b) => a - b)) {
    const included = rows.filter((row) => row.dayIndex === dayIndex && row.included).sort((a, b) => {
      const aRole = a.role === 'major' ? 0 : a.role === 'supplementary' ? 1 : a.role === 'conditional' ? 2 : 3;
      const bRole = b.role === 'major' ? 0 : b.role === 'supplementary' ? 1 : b.role === 'conditional' ? 2 : 3;
      return aRole - bRole
        || (a.purpose === null ? 99 : executionPurposeOrder[a.purpose])
          - (b.purpose === null ? 99 : executionPurposeOrder[b.purpose])
        || a.sourceSlotIndex - b.sourceSlotIndex;
    });
    included.forEach((row, index) => {
      row.executionSlotIndex = index + 1;
      if (row.sourceSlotIndex !== index + 1) {
        row.adaptations.push(`Ordered as slot ${index + 1} after complete-session stress review.`);
      }
    });
  }

  const familyDecisions: RoutineFamilyStressDecision[] = families.map((family) => {
    const familyRows = rows.filter((row) => row.role === 'major' && row.family === family);
    const sessions = (daysByFamily.get(family) ?? []).map((dayIndex): RoutineSessionFamilyStress => {
      const dayRows = familyRows.filter((row) => row.dayIndex === dayIndex);
      const finalStress = familyBurden(rows, family, familyByMovement, input.assistance, dayIndex);
      return {
        dayIndex,
        exposureCount: 1,
        variationCount: dayRows.length,
        equivalentVolume: round1(dayRows.reduce((sum, row) => sum + majorEquivalentVolume(row), 0)),
        initialStress: round1(initialSessionStress.get(`${family}:${dayIndex}`) ?? 0),
        finalStress: round1(finalStress),
        budget: budgets.session,
        level: stressLevel(finalStress, budgets.session),
      };
    });
    const initialStress = initialWeeklyStress.get(family) ?? 0;
    const finalStress = familyBurden(rows, family, familyByMovement, input.assistance);
    const familyAdaptations = rows
      .filter((row) => row.family === family || isRelatedSupport(row, family, familyByMovement, input.assistance))
      .flatMap((row) => row.adaptations.map((adaptation) => `${row.movementName}: ${adaptation}`));
    return {
      family,
      exposureCount: sessions.length,
      variationCount: new Set(familyRows.map((row) => row.movementId)).size,
      equivalentVolume: round1(familyRows.reduce((sum, row) => sum + majorEquivalentVolume(row), 0)),
      initialStress: round1(initialStress),
      finalStress: round1(finalStress),
      weeklyBudget: budgets.week,
      level: stressLevel(finalStress, budgets.week),
      purposes: familyRows.map((row) => row.purpose!).filter((purpose, index, all) => all.indexOf(purpose) === index),
      sessions,
      adaptations: [...new Set(familyAdaptations)],
    };
  });

  for (const decision of familyDecisions) {
    const distributedSessions = decision.sessions.filter((session) => session.variationCount > 1);
    for (const session of distributedSessions) {
      warnings.push(`${decision.family} day ${session.dayIndex}: ${session.variationCount} selected variations form one major-family exposure (${session.equivalentVolume.toFixed(1)} weighted equivalent reps).`);
    }
    if (decision.exposureCount > 1) {
      warnings.push(`${decision.family}: ${decision.exposureCount} weekly family exposures (${decision.variationCount} distinct variation${decision.variationCount === 1 ? '' : 's'}; ${decision.equivalentVolume.toFixed(1)} weighted equivalent reps) are distributed across ${decision.purposes.map((purpose) => purpose.replace('_', '-')).join(', ')} purposes.`);
    }
    if (decision.initialStress > decision.weeklyBudget) {
      warnings.push(`${decision.family}: weekly burden was bounded from ${decision.initialStress.toFixed(1)} to ${decision.finalStress.toFixed(1)}.`);
    }
    const consecutive = decision.sessions.some((session, index, all) =>
      index > 0 && session.dayIndex === all[index - 1].dayIndex + 1);
    if (consecutive) {
      recommendations.push(`${decision.family}: consecutive-day exposure is preserved with distinct stress purposes; review recovery before progressing dose.`);
    }
  }
  for (const row of rows) {
    globalAdaptations.push(...row.adaptations.map((adaptation) => `${row.movementName}: ${adaptation}`));
  }

  const prescriptions = rows.map((row): RoutineMicrocyclePrescription => ({
    dayIndex: row.dayIndex,
    sourceSlotIndex: row.sourceSlotIndex,
    executionSlotIndex: row.executionSlotIndex,
    movementId: row.movementId,
    role: row.role,
    authoredSets: row.originalSets,
    authoredReps: row.originalReps,
    authoredTargetRpe: row.originalTargetRpe,
    sets: row.sets,
    reps: row.reps,
    targetRpe: row.targetRpe,
    included: row.included,
    family: row.family,
    stressCoefficient: row.stressCoefficient,
    purpose: row.purpose,
    equivalentVolume: round1(majorEquivalentVolume(row)),
    stressDose: round1(majorStress(row)),
    adaptations: [...row.adaptations],
  }));

  return {
    prescriptions,
    familyDecisions,
    warnings: [...new Set(warnings)],
    recommendations: [...new Set(recommendations)],
    adaptations: [...new Set(globalAdaptations)],
    blockers: [...new Set(blockers)],
  };
}

/** Rank only explicitly related, low-fatigue accessory work after major and
 * supplementary choices are known. Equipment/safety/capability filtering is
 * upstream; absence of a relationship row intentionally returns no filler. */
export function rankRoutineAccessoryRecommendations(input: {
  readonly majorMovementIds: readonly number[];
  readonly selectedMovementIds: readonly number[];
  readonly candidates: readonly RoutineMicrocycleMovement[];
  readonly allMovements: readonly RoutineMicrocycleMovement[];
  readonly liftFamilies: readonly RoutineLiftFamilyContract[];
  readonly assistance: readonly RoutineAssistanceContract[];
  readonly objective: Objective;
  readonly remainingMinutes: number;
  readonly remainingFatigue: number;
  readonly limit?: number;
}): readonly RoutineAccessoryRecommendation[] {
  const limit = input.limit ?? 3;
  if (!Number.isInteger(limit) || limit < 1 || input.remainingMinutes < 4 || input.remainingFatigue <= 0) return [];
  const familyByMovement = familyMapOf(input.liftFamilies);
  const majorFamilies = [...new Set(input.majorMovementIds
    .map((movementId) => familyByMovement.get(movementId)?.family)
    .filter((family): family is string => family !== undefined))];
  if (majorFamilies.length === 0) return [];
  const selected = new Set(input.selectedMovementIds);
  const selectedMuscles = new Set(input.allMovements
    .filter((movement) => selected.has(movement.movementId))
    .flatMap((movement) => movement.targetMuscles.map((muscle) => muscle.trim().toLocaleLowerCase())));

  const ranked = input.candidates.flatMap((candidate) => {
    if (selected.has(candidate.movementId)) return [];
    const relations = majorFamilies
      .map((family) => assistanceFor(input.assistance, family, candidate.movementId))
      .filter((row): row is RoutineAssistanceContract => row !== undefined)
      .sort((a, b) => a.distance - b.distance || a.fatigueCost - b.fatigueCost || a.family.localeCompare(b.family));
    const relation = relations[0];
    if (relation === undefined || relation.distance < 2
        || relation.fatigueCost > input.remainingFatigue) return [];
    const muscles = candidate.targetMuscles.map((muscle) => muscle.trim().toLocaleLowerCase());
    const uncovered = muscles.filter((muscle) => !selectedMuscles.has(muscle)).length;
    const duplicated = muscles.length - uncovered;
    const goalBonus = input.objective === 'hypertrophy' && !candidate.isCompound
      ? 4
      : ['gpp', 'hybrid', 'endurance', 'weight_loss'].includes(input.objective) && relation.fatigueCost <= 1
        ? 3
        : input.objective === 'strength' || input.objective === 'power' ? 2 : 1;
    const score = uncovered * 5 - duplicated * 3 + goalBonus
      + (4 - relation.distance) * 3 - relation.fatigueCost;
    if (score <= 0) return [];
    return [{ candidate, relation, score }];
  }).sort((a, b) => b.score - a.score
    || a.relation.distance - b.relation.distance
    || a.candidate.name.localeCompare(b.candidate.name));

  return ranked.slice(0, Math.min(limit, ranked.length)).map((row, index) => ({
    movementId: row.candidate.movementId,
    rank: index + 1,
    family: row.relation.family,
    distance: row.relation.distance as 2 | 3,
    reason: row.relation.reason,
    score: round1(row.score),
  }));
}
