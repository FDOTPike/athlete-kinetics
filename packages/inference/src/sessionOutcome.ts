/**
 * sessionOutcome.ts - Phase 18 neutral training-decision classifier.
 *
 * The engine records what happened; it never rewards, scores, progresses, or
 * changes a prescription. It is deliberately dose-only: subjective exertion,
 * load, band choice, rest behaviour, tier, and session mode are not inputs.
 * Every timestamp and every prescribed-at-log dose is supplied by the caller.
 */
import type { RunnerHaltReason, RunnerTarget } from './sessionRunner';

export const SESSION_OUTCOME_ENGINE_VERSION = 1 as const;

export type SessionOutcomeKind =
  | 'followed_plan'
  | 'adapted_session'
  | 'stopped_safely'
  | 'session_recorded';

export type SessionOutcomeOriginKind = 'planned' | 'free_form';

export type SessionOutcomeProvenanceKind =
  | 'planned'
  | 'substituted'
  | 'day_swapped'
  | 'added'
  | 'free_form';

export type SessionOutcomeTerminal =
  | { readonly phase: 'complete'; readonly haltReason: null }
  | { readonly phase: 'halted'; readonly haltReason: RunnerHaltReason };

export interface SessionOutcomeSlotInput {
  readonly sessionPlanSlotId: number;
  readonly plannedSets: number;
  readonly provenanceKind: SessionOutcomeProvenanceKind;
}

export interface SessionOutcomeSetInput {
  readonly setId: number;
  readonly sessionPlanSlotId: number | null;
  readonly provenanceKind: SessionOutcomeProvenanceKind;
  /** Immutable target that was displayed when this set was logged. */
  readonly prescribedDose: RunnerTarget | null;
  /** Current logged value. Null means the required metric evidence is absent. */
  readonly actualDose: RunnerTarget | null;
}

export interface SessionOutcomeInput {
  readonly originKind: SessionOutcomeOriginKind;
  readonly terminal: SessionOutcomeTerminal;
  readonly slots: readonly SessionOutcomeSlotInput[];
  readonly sets: readonly SessionOutcomeSetInput[];
  readonly skippedSessionPlanSlotIds: readonly number[];
  /** Explicit adapter-supplied time; the engine never reads a clock. */
  readonly finalizedAtMs: number;
}

/** Counts are durable explanation evidence, not a score. */
export interface SessionOutcomeEvidence {
  readonly slotCount: number;
  readonly plannedSetCount: number;
  readonly loggedSetCount: number;
  readonly exactDoseCount: number;
  readonly underDoseCount: number;
  readonly overDoseCount: number;
  readonly unknownDoseCount: number;
  readonly unmappedSetCount: number;
  readonly missingSetCount: number;
  readonly missingUnskippedSetCount: number;
  readonly extraSetCount: number;
  readonly adaptedSlotCount: number;
  readonly skippedSlotCount: number;
  readonly offPlanSlotCount: number;
}

export interface SessionOutcomeDecision {
  readonly engineVersion: typeof SESSION_OUTCOME_ENGINE_VERSION;
  readonly kind: SessionOutcomeKind;
  readonly terminalPhase: SessionOutcomeTerminal['phase'];
  readonly haltReason: RunnerHaltReason | null;
  readonly finalizedAtMs: number;
  readonly evidence: SessionOutcomeEvidence;
}

export class SessionOutcomeValidationError extends Error {
  constructor(message: string) {
    super(`session outcome: ${message}`);
    this.name = 'SessionOutcomeValidationError';
  }
}

const PROVENANCE_KINDS: readonly SessionOutcomeProvenanceKind[] = [
  'planned',
  'substituted',
  'day_swapped',
  'added',
  'free_form',
];

const HALT_REASONS: readonly RunnerHaltReason[] = [
  'manual',
  'niggle',
  'pain',
  'safety',
];

const isPositiveInteger = (value: number): boolean =>
  Number.isInteger(value) && value > 0;

const isProvenanceKind = (value: unknown): value is SessionOutcomeProvenanceKind =>
  typeof value === 'string' && PROVENANCE_KINDS.includes(value as SessionOutcomeProvenanceKind);

const isHaltReason = (value: unknown): value is RunnerHaltReason =>
  typeof value === 'string' && HALT_REASONS.includes(value as RunnerHaltReason);

const validateDose = (dose: RunnerTarget | null, label: string): void => {
  if (dose === null) return;
  if (dose.kind === 'reps') {
    if (!isPositiveInteger(dose.reps) || dose.reps > 100) {
      throw new SessionOutcomeValidationError(`${label} reps must be an integer from 1 to 100`);
    }
    return;
  }
  if (dose.kind === 'time') {
    if (!isPositiveInteger(dose.seconds) || dose.seconds > 7200) {
      throw new SessionOutcomeValidationError(`${label} seconds must be an integer from 1 to 7200`);
    }
    return;
  }
  throw new SessionOutcomeValidationError(`${label} has an unknown dose kind`);
};

const isDirectiveHalt = (reason: RunnerHaltReason): boolean =>
  reason === 'niggle' || reason === 'pain' || reason === 'safety';

type DoseComparison = 'exact' | 'under' | 'over' | 'unknown';

const compareDose = (
  prescribed: RunnerTarget | null,
  actual: RunnerTarget | null,
): DoseComparison => {
  if (prescribed === null || actual === null || prescribed.kind !== actual.kind) {
    return 'unknown';
  }
  const targetValue = prescribed.kind === 'reps' ? prescribed.reps : prescribed.seconds;
  const actualValue = actual.kind === 'reps' ? actual.reps : actual.seconds;
  if (actualValue === targetValue) return 'exact';
  return actualValue < targetValue ? 'under' : 'over';
};

const isAdaptation = (kind: SessionOutcomeProvenanceKind): boolean =>
  kind === 'substituted' || kind === 'day_swapped';

const isOffPlan = (kind: SessionOutcomeProvenanceKind): boolean =>
  kind === 'added' || kind === 'free_form';

const validateInput = (input: SessionOutcomeInput): void => {
  if (input.originKind !== 'planned' && input.originKind !== 'free_form') {
    throw new SessionOutcomeValidationError('unknown origin kind');
  }
  if (!Number.isSafeInteger(input.finalizedAtMs) || input.finalizedAtMs < 0) {
    throw new SessionOutcomeValidationError('finalizedAtMs must be a non-negative safe integer');
  }
  if (input.terminal.phase === 'complete') {
    if (input.terminal.haltReason !== null) {
      throw new SessionOutcomeValidationError('complete terminal cannot carry a halt reason');
    }
  } else if (input.terminal.phase === 'halted') {
    if (!isHaltReason(input.terminal.haltReason)) {
      throw new SessionOutcomeValidationError('halted terminal requires a valid halt reason');
    }
  } else {
    throw new SessionOutcomeValidationError('only a terminal runner may be classified');
  }

  const slotIds = new Set<number>();
  for (const slot of input.slots) {
    if (!isPositiveInteger(slot.sessionPlanSlotId)) {
      throw new SessionOutcomeValidationError('session-plan slot IDs must be positive integers');
    }
    if (slotIds.has(slot.sessionPlanSlotId)) {
      throw new SessionOutcomeValidationError(`duplicate session-plan slot ID ${slot.sessionPlanSlotId}`);
    }
    if (!isPositiveInteger(slot.plannedSets) || slot.plannedSets > 100) {
      throw new SessionOutcomeValidationError(`slot ${slot.sessionPlanSlotId} plannedSets must be from 1 to 100`);
    }
    if (!isProvenanceKind(slot.provenanceKind)) {
      throw new SessionOutcomeValidationError(`slot ${slot.sessionPlanSlotId} has invalid provenance`);
    }
    slotIds.add(slot.sessionPlanSlotId);
  }

  const skippedIds = new Set<number>();
  for (const slotId of input.skippedSessionPlanSlotIds) {
    if (!isPositiveInteger(slotId) || !slotIds.has(slotId)) {
      throw new SessionOutcomeValidationError(`skipped slot ${slotId} is not in this session plan`);
    }
    if (skippedIds.has(slotId)) {
      throw new SessionOutcomeValidationError(`duplicate skipped slot ID ${slotId}`);
    }
    skippedIds.add(slotId);
  }

  const setIds = new Set<number>();
  for (const loggedSet of input.sets) {
    if (!isPositiveInteger(loggedSet.setId)) {
      throw new SessionOutcomeValidationError('set IDs must be positive integers');
    }
    if (setIds.has(loggedSet.setId)) {
      throw new SessionOutcomeValidationError(`duplicate set ID ${loggedSet.setId}`);
    }
    if (loggedSet.sessionPlanSlotId !== null && !isPositiveInteger(loggedSet.sessionPlanSlotId)) {
      throw new SessionOutcomeValidationError(`set ${loggedSet.setId} has an invalid session-plan slot ID`);
    }
    if (!isProvenanceKind(loggedSet.provenanceKind)) {
      throw new SessionOutcomeValidationError(`set ${loggedSet.setId} has invalid provenance`);
    }
    validateDose(loggedSet.prescribedDose, `set ${loggedSet.setId} prescribed`);
    validateDose(loggedSet.actualDose, `set ${loggedSet.setId} actual`);
    setIds.add(loggedSet.setId);
  }
};

const buildEvidence = (input: SessionOutcomeInput): SessionOutcomeEvidence => {
  const slotById = new Map(input.slots.map((slot) => [slot.sessionPlanSlotId, slot] as const));
  const skippedIds = new Set(input.skippedSessionPlanSlotIds);
  const loggedCountsBySlot = new Map<number, number>();
  const adaptedSlotIds = new Set<number>();
  let exactDoseCount = 0;
  let underDoseCount = 0;
  let overDoseCount = 0;
  let unknownDoseCount = 0;
  let unmappedSetCount = 0;

  for (const slot of input.slots) {
    if (isAdaptation(slot.provenanceKind) || skippedIds.has(slot.sessionPlanSlotId)) {
      adaptedSlotIds.add(slot.sessionPlanSlotId);
    }
  }

  for (const loggedSet of input.sets) {
    const slotId = loggedSet.sessionPlanSlotId;
    if (slotId === null || !slotById.has(slotId)) {
      unmappedSetCount += 1;
      continue;
    }
    loggedCountsBySlot.set(slotId, (loggedCountsBySlot.get(slotId) ?? 0) + 1);
    if (isAdaptation(loggedSet.provenanceKind)) adaptedSlotIds.add(slotId);
    switch (compareDose(loggedSet.prescribedDose, loggedSet.actualDose)) {
      case 'exact': exactDoseCount += 1; break;
      case 'under': underDoseCount += 1; break;
      case 'over': overDoseCount += 1; break;
      case 'unknown': unknownDoseCount += 1; break;
    }
  }

  let missingSetCount = 0;
  let missingUnskippedSetCount = 0;
  let extraSetCount = 0;
  for (const slot of input.slots) {
    const loggedCount = loggedCountsBySlot.get(slot.sessionPlanSlotId) ?? 0;
    if (loggedCount < slot.plannedSets) {
      const missing = slot.plannedSets - loggedCount;
      missingSetCount += missing;
      if (!skippedIds.has(slot.sessionPlanSlotId)) missingUnskippedSetCount += missing;
    } else if (loggedCount > slot.plannedSets) {
      extraSetCount += loggedCount - slot.plannedSets;
    }
  }

  const offPlanSlotIds = new Set<number>();
  for (const slot of input.slots) {
    if (isOffPlan(slot.provenanceKind)) offPlanSlotIds.add(slot.sessionPlanSlotId);
  }
  for (const loggedSet of input.sets) {
    if (loggedSet.sessionPlanSlotId !== null && isOffPlan(loggedSet.provenanceKind)) {
      offPlanSlotIds.add(loggedSet.sessionPlanSlotId);
    }
  }

  return {
    slotCount: input.slots.length,
    plannedSetCount: input.slots.reduce((total, slot) => total + slot.plannedSets, 0),
    loggedSetCount: input.sets.length,
    exactDoseCount,
    underDoseCount,
    overDoseCount,
    unknownDoseCount,
    unmappedSetCount,
    missingSetCount,
    missingUnskippedSetCount,
    extraSetCount,
    adaptedSlotCount: adaptedSlotIds.size,
    skippedSlotCount: skippedIds.size,
    offPlanSlotCount: offPlanSlotIds.size,
  };
};

const decision = (
  input: SessionOutcomeInput,
  evidence: SessionOutcomeEvidence,
  kind: SessionOutcomeKind,
): SessionOutcomeDecision => ({
  engineVersion: SESSION_OUTCOME_ENGINE_VERSION,
  kind,
  terminalPhase: input.terminal.phase,
  haltReason: input.terminal.haltReason,
  finalizedAtMs: input.finalizedAtMs,
  evidence,
});

/**
 * Classify a finalized session. Null means there was no durable training
 * decision to retain (an empty completion or an accidental empty manual stop).
 */
export function evaluateSessionOutcome(
  input: SessionOutcomeInput,
): SessionOutcomeDecision | null {
  validateInput(input);
  const evidence = buildEvidence(input);

  if (evidence.loggedSetCount === 0) {
    if (input.terminal.phase === 'halted' && isDirectiveHalt(input.terminal.haltReason)) {
      return decision(input, evidence, 'stopped_safely');
    }
    return null;
  }

  // Halt precedence: the label acknowledges the stopping decision, not dose.
  if (input.terminal.phase === 'halted') {
    return decision(input, evidence, 'stopped_safely');
  }

  const allLoggedDoseExact =
    evidence.exactDoseCount === evidence.loggedSetCount &&
    evidence.underDoseCount === 0 &&
    evidence.overDoseCount === 0 &&
    evidence.unknownDoseCount === 0 &&
    evidence.unmappedSetCount === 0;
  const noExtraOrOffPlan = evidence.extraSetCount === 0 && evidence.offPlanSlotCount === 0;
  const isPlannedCompletion = input.originKind === 'planned' && allLoggedDoseExact && noExtraOrOffPlan;

  if (
    isPlannedCompletion &&
    evidence.adaptedSlotCount === 0 &&
    evidence.skippedSlotCount === 0 &&
    evidence.missingSetCount === 0
  ) {
    return decision(input, evidence, 'followed_plan');
  }

  const everySkipExplainsMissingWork =
    evidence.skippedSlotCount > 0 &&
    input.skippedSessionPlanSlotIds.every((slotId) => {
      const slot = input.slots.find((candidate) => candidate.sessionPlanSlotId === slotId)!;
      const loggedCount = input.sets.filter((loggedSet) => loggedSet.sessionPlanSlotId === slotId).length;
      return loggedCount < slot.plannedSets;
    });
  const missingWorkIsExplained =
    evidence.missingSetCount === 0 ||
    (evidence.missingUnskippedSetCount === 0 && everySkipExplainsMissingWork);

  if (
    isPlannedCompletion &&
    evidence.adaptedSlotCount > 0 &&
    (evidence.skippedSlotCount === 0 || everySkipExplainsMissingWork) &&
    missingWorkIsExplained
  ) {
    return decision(input, evidence, 'adapted_session');
  }

  return decision(input, evidence, 'session_recorded');
}
