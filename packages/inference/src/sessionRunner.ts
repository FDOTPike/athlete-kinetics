/**
 * sessionRunner.ts - Phase 17 guided-session state machine.
 *
 * This module is intentionally a pure reducer. It never reads a clock, talks
 * to storage, or selects a substitute. The caller supplies every timestamp and
 * persists the returned plain-object state as its durable checkpoint.
 */
import { EXPERIENCE_SEVERITY, type TrainingAge } from './types';

/** One prescribed set: repetition work or a timed interval. */
export type RunnerTarget =
  | { readonly kind: 'reps'; readonly reps: number }
  | { readonly kind: 'time'; readonly seconds: number };

/**
 * A frozen session-plan slot. `sessionPlanSlotId` deliberately identifies the
 * session-scoped plan row, not its source planned_slot row: substitutions and
 * checkpoints must continue to point at the session that the athlete sees.
 */
export interface RunnerSlot {
  readonly sessionPlanSlotId: number;
  /** Source planned_slot, retained only as provenance for callers that need it. */
  readonly plannedSlotId?: number | null;
  readonly movementId: number;
  readonly movementName: string;
  readonly sets: number;
  readonly target: RunnerTarget;
  readonly targetRpe: number;
}

/**
 * Pre-Phase-17 slot shape. `startRunner` accepts it and normalizes it to a
 * session-plan slot so existing engine callers can move incrementally.
 */
export interface LegacyRunnerSlot {
  readonly plannedSlotId: number;
  readonly movementId: number;
  readonly movementName: string;
  readonly sets: number;
  readonly reps: number;
  readonly targetRpe: number;
}

export type RunnerSlotInput = RunnerSlot | LegacyRunnerSlot;

export type RunnerPhase = 'working' | 'resting' | 'complete' | 'halted';
export type RunnerHaltReason = 'manual' | 'niggle' | 'pain' | 'safety';

/**
 * Fully serializable reducer state. `setIndex` is one-based. While resting it
 * names the set just logged; while working it names the set to perform next.
 */
export interface RunnerState {
  readonly tier: TrainingAge;
  readonly slots: readonly RunnerSlot[];
  readonly slotIndex: number;
  readonly setIndex: number;
  readonly phase: RunnerPhase;
  readonly restSecondsTarget: number;
  readonly restStartedAtMs: number | null;
  /** RPE that produced the active rest prescription; null outside rest. */
  readonly restRpe: number | null;
  /** Completed logged sets by immutable session-plan slot index. */
  readonly slotSetCounts: readonly number[];
  /** Aggregate of slotSetCounts, retained for concise session summaries. */
  readonly loggedSets: number;
  readonly substitutionOfferedForSessionPlanSlotId: number | null;
  readonly haltReason: RunnerHaltReason | null;
  readonly skippedSessionPlanSlotIds: readonly number[];
  /** Last accepted event timestamp, or the supplied start timestamp. */
  readonly updatedAtMs: number | null;
}

export interface RunnerStartOptions {
  readonly tier?: TrainingAge;
  /** Optional supplied start time. No implicit Date.now() fallback exists. */
  readonly startedAtMs?: number | null;
}

/** `TrainingAge` is accepted here only for old callers of startRunner(slots, tier). */
export type RunnerStartConfig = RunnerStartOptions | TrainingAge;

export interface RunnerWork {
  readonly slot: RunnerSlot;
  readonly setIndex: number;
}

interface TimestampedRunnerEvent {
  /** Millisecond timestamp supplied by the caller; the runner never reads time. */
  readonly atMs: number;
}

export type RunnerEvent =
  | (TimestampedRunnerEvent & { readonly kind: 'LOG_SET'; readonly actualRpe?: number })
  | (TimestampedRunnerEvent & { readonly kind: 'REST_ELAPSED' })
  | (TimestampedRunnerEvent & { readonly kind: 'SKIP_REST' })
  | (TimestampedRunnerEvent & { readonly kind: 'THUMBS_DOWN' })
  | (TimestampedRunnerEvent & { readonly kind: 'NIGGLE'; readonly severity: number })
  | (TimestampedRunnerEvent & { readonly kind: 'DECLINE_SUBSTITUTION' })
  | (TimestampedRunnerEvent & {
    readonly kind: 'SUBSTITUTE';
    readonly movementId: number;
    readonly movementName: string;
  })
  | (TimestampedRunnerEvent & { readonly kind: 'SKIP_SLOT' })
  | (TimestampedRunnerEvent & { readonly kind: 'HALT'; readonly reason?: RunnerHaltReason });

export interface RunnerCheckpoint {
  readonly version: 1;
  readonly state: RunnerState;
}

export const RUNNER_CHECKPOINT_VERSION = 1 as const;

export class RunnerCheckpointError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunnerCheckpointError';
  }
}

const TIER_REST_SCALE: Record<TrainingAge, number> = {
  beginner: 0.75,
  intermediate: 1,
  advanced: 1,
  elite: 1.25,
};

const TRAINING_AGES: readonly TrainingAge[] = ['beginner', 'intermediate', 'advanced', 'elite'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTrainingAge(value: unknown): value is TrainingAge {
  return typeof value === 'string' && TRAINING_AGES.includes(value as TrainingAge);
}

function isNonNegativeTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isRpe(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10;
}

function isNiggleSeverity(value: unknown): value is number {
  return isPositiveInteger(value) && value <= 10;
}

function requirePositiveInteger(value: unknown, label: string): number {
  if (!isPositiveInteger(value)) throw new RunnerCheckpointError(`${label} must be a positive integer`);
  return value;
}

function requireRpe(value: unknown, label: string): number {
  if (!isRpe(value)) throw new RunnerCheckpointError(`${label} must be a finite RPE from 0 to 10`);
  return value;
}

function requireName(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RunnerCheckpointError(`${label} must be a non-empty string`);
  }
  return value;
}

function normalizeTarget(value: unknown, legacyReps: unknown): RunnerTarget {
  if (value === undefined) {
    return { kind: 'reps', reps: requirePositiveInteger(legacyReps, 'slot.reps') };
  }
  if (!isRecord(value) || typeof value.kind !== 'string') {
    throw new RunnerCheckpointError('slot.target must be a repetition or time target');
  }
  if (value.kind === 'reps') {
    return { kind: 'reps', reps: requirePositiveInteger(value.reps, 'slot.target.reps') };
  }
  if (value.kind === 'time') {
    return { kind: 'time', seconds: requirePositiveInteger(value.seconds, 'slot.target.seconds') };
  }
  throw new RunnerCheckpointError('slot.target.kind must be reps or time');
}

function normalizeSlot(value: unknown): RunnerSlot {
  if (!isRecord(value)) throw new RunnerCheckpointError('slot must be an object');
  const hasSessionPlanSlotId = Object.prototype.hasOwnProperty.call(value, 'sessionPlanSlotId');
  const sessionPlanSlotId = requirePositiveInteger(
    hasSessionPlanSlotId ? value.sessionPlanSlotId : value.plannedSlotId,
    hasSessionPlanSlotId ? 'slot.sessionPlanSlotId' : 'slot.plannedSlotId',
  );
  const plannedSlotId = value.plannedSlotId === undefined || value.plannedSlotId === null
    ? null
    : requirePositiveInteger(value.plannedSlotId, 'slot.plannedSlotId');

  return {
    sessionPlanSlotId,
    plannedSlotId,
    movementId: requirePositiveInteger(value.movementId, 'slot.movementId'),
    movementName: requireName(value.movementName, 'slot.movementName'),
    sets: requirePositiveInteger(value.sets, 'slot.sets'),
    target: normalizeTarget(value.target, value.reps),
    targetRpe: requireRpe(value.targetRpe, 'slot.targetRpe'),
  };
}

function normalizeSlots(values: unknown): readonly RunnerSlot[] {
  if (!Array.isArray(values)) throw new RunnerCheckpointError('slots must be an array');
  const slots = values.map(normalizeSlot);
  const ids = new Set<number>();
  for (const slot of slots) {
    if (ids.has(slot.sessionPlanSlotId)) {
      throw new RunnerCheckpointError(`duplicate sessionPlanSlotId ${slot.sessionPlanSlotId}`);
    }
    ids.add(slot.sessionPlanSlotId);
  }
  return slots;
}

function normalizeStartConfig(config: RunnerStartConfig | undefined): Required<RunnerStartOptions> {
  if (typeof config === 'string') {
    if (!isTrainingAge(config)) throw new RunnerCheckpointError('invalid training tier');
    return { tier: config, startedAtMs: null };
  }
  const tier = config?.tier ?? 'intermediate';
  if (!isTrainingAge(tier)) throw new RunnerCheckpointError('invalid training tier');
  const startedAtMs = config?.startedAtMs ?? null;
  if (startedAtMs !== null && !isNonNegativeTimestamp(startedAtMs)) {
    throw new RunnerCheckpointError('startedAtMs must be a non-negative millisecond timestamp');
  }
  return { tier, startedAtMs };
}

function isRestTarget(value: unknown): value is number {
  return isPositiveInteger(value) && value >= 45 && value <= 300 && value % 15 === 0;
}

function isHaltReason(value: unknown): value is RunnerHaltReason {
  return value === 'manual' || value === 'niggle' || value === 'pain' || value === 'safety';
}

function allSlotsResolved(
  slots: readonly RunnerSlot[],
  slotSetCounts: readonly number[],
  skippedSessionPlanSlotIds: ReadonlySet<number>,
): boolean {
  return slots.every((slot, index) =>
    skippedSessionPlanSlotIds.has(slot.sessionPlanSlotId) || slotSetCounts[index] >= slot.sets,
  );
}

/** Finds the next unfinished slot, wrapping at the end of the frozen plan. */
function nextIncompleteSlotIndex(
  slots: readonly RunnerSlot[],
  slotSetCounts: readonly number[],
  skippedSessionPlanSlotIds: ReadonlySet<number>,
  startIndex: number,
): number | null {
  if (slots.length === 0) return null;
  for (let offset = 0; offset < slots.length; offset += 1) {
    const index = (startIndex + offset) % slots.length;
    const slot = slots[index]!;
    if (!skippedSessionPlanSlotIds.has(slot.sessionPlanSlotId) && slotSetCounts[index] < slot.sets) {
      return index;
    }
  }
  return null;
}

/**
 * Checkpoints written before slotSetCounts existed were strictly linear. Infer
 * their completed counts from that linear pointer, then use loggedSets to
 * preserve any partially completed slot that was subsequently skipped.
 */
function inferLegacySlotSetCounts(
  slots: readonly RunnerSlot[],
  skippedSessionPlanSlotIds: readonly number[],
  phase: RunnerPhase,
  slotIndex: number,
  setIndex: number,
  loggedSets: number,
): readonly number[] {
  if (slotIndex > slots.length) throw new RunnerCheckpointError('legacy state.slotIndex is invalid');
  const skipped = new Set(skippedSessionPlanSlotIds);
  const counts = slots.map(() => 0);
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index]!;
    if (skipped.has(slot.sessionPlanSlotId)) continue;
    if (phase === 'complete' || index < slotIndex) {
      counts[index] = slot.sets;
    } else if (index === slotIndex) {
      counts[index] = Math.min(slot.sets, Math.max(0, phase === 'resting' ? setIndex : setIndex - 1));
    }
  }

  let remaining = loggedSets - counts.reduce((sum, count) => sum + count, 0);
  if (remaining < 0) throw new RunnerCheckpointError('legacy state.loggedSets is inconsistent');
  const candidates = [slotIndex, ...slots.map((_, index) => index).filter((index) => index !== slotIndex)];
  for (const index of candidates) {
    const slot = slots[index];
    if (slot === undefined || (!skipped.has(slot.sessionPlanSlotId) && index !== slotIndex)) continue;
    const add = Math.min(remaining, slot.sets - counts[index]!);
    counts[index] += add;
    remaining -= add;
    if (remaining === 0) break;
  }
  if (remaining !== 0) throw new RunnerCheckpointError('legacy state.loggedSets cannot be recovered');
  return counts;
}

function normalizeSlotSetCounts(
  value: unknown,
  slots: readonly RunnerSlot[],
  skippedSessionPlanSlotIds: readonly number[],
  phase: RunnerPhase,
  slotIndex: number,
  setIndex: number,
  loggedSets: number,
): readonly number[] {
  if (value === undefined) {
    return inferLegacySlotSetCounts(slots, skippedSessionPlanSlotIds, phase, slotIndex, setIndex, loggedSets);
  }
  if (!Array.isArray(value) || value.length !== slots.length || !value.every(isNonNegativeInteger)) {
    throw new RunnerCheckpointError('state.slotSetCounts is invalid');
  }
  const counts = [...value] as number[];
  for (const [index, count] of counts.entries()) {
    if (count > slots[index]!.sets) throw new RunnerCheckpointError('state.slotSetCounts exceeds planned volume');
  }
  return counts;
}

function normalizeState(value: unknown): RunnerState {
  if (!isRecord(value)) throw new RunnerCheckpointError('runner checkpoint state must be an object');
  const tier = value.tier;
  if (!isTrainingAge(tier)) throw new RunnerCheckpointError('state.tier is invalid');
  const slots = normalizeSlots(value.slots);
  const phase = value.phase;
  if (phase !== 'working' && phase !== 'resting' && phase !== 'complete' && phase !== 'halted') {
    throw new RunnerCheckpointError('state.phase is invalid');
  }
  if (!isNonNegativeInteger(value.slotIndex)) throw new RunnerCheckpointError('state.slotIndex is invalid');
  if (!isNonNegativeInteger(value.setIndex)) throw new RunnerCheckpointError('state.setIndex is invalid');
  if (!isNonNegativeInteger(value.loggedSets)) throw new RunnerCheckpointError('state.loggedSets is invalid');
  if (value.updatedAtMs !== null && value.updatedAtMs !== undefined && !isNonNegativeTimestamp(value.updatedAtMs)) {
    throw new RunnerCheckpointError('state.updatedAtMs is invalid');
  }
  const updatedAtMs = value.updatedAtMs === undefined ? null : value.updatedAtMs as number | null;
  const offered = value.substitutionOfferedForSessionPlanSlotId;
  if (offered !== null && offered !== undefined && !isPositiveInteger(offered)) {
    throw new RunnerCheckpointError('state.substitutionOfferedForSessionPlanSlotId is invalid');
  }
  const substitutionOfferedForSessionPlanSlotId = offered === undefined ? null : offered as number | null;
  const skippedRaw = value.skippedSessionPlanSlotIds === undefined ? [] : value.skippedSessionPlanSlotIds;
  if (!Array.isArray(skippedRaw) || !skippedRaw.every(isPositiveInteger)) {
    throw new RunnerCheckpointError('state.skippedSessionPlanSlotIds is invalid');
  }
  const skippedSessionPlanSlotIds = [...skippedRaw] as number[];
  if (new Set(skippedSessionPlanSlotIds).size !== skippedSessionPlanSlotIds.length) {
    throw new RunnerCheckpointError('state.skippedSessionPlanSlotIds contains duplicates');
  }
  const slotIds = new Set(slots.map((slot) => slot.sessionPlanSlotId));
  if (!skippedSessionPlanSlotIds.every((id) => slotIds.has(id))) {
    throw new RunnerCheckpointError('state.skippedSessionPlanSlotIds references an unknown slot');
  }
  const slotIndex = value.slotIndex as number;
  const setIndex = value.setIndex as number;
  const loggedSets = value.loggedSets as number;
  const slotSetCounts = normalizeSlotSetCounts(
    value.slotSetCounts,
    slots,
    skippedSessionPlanSlotIds,
    phase,
    slotIndex,
    setIndex,
    loggedSets,
  );
  if (slotSetCounts.reduce((sum, count) => sum + count, 0) !== loggedSets) {
    throw new RunnerCheckpointError('state.loggedSets must equal the sum of state.slotSetCounts');
  }

  const state: RunnerState = {
    tier,
    slots,
    slotIndex,
    setIndex,
    phase,
    restSecondsTarget: value.restSecondsTarget as number,
    restStartedAtMs: value.restStartedAtMs === undefined ? null : value.restStartedAtMs as number | null,
    restRpe: value.restRpe === undefined ? null : value.restRpe as number | null,
    slotSetCounts,
    loggedSets,
    substitutionOfferedForSessionPlanSlotId,
    haltReason: value.haltReason === undefined ? null : value.haltReason as RunnerHaltReason | null,
    skippedSessionPlanSlotIds,
    updatedAtMs,
  };

  const totalSets = slots.reduce((sum, slot) => sum + slot.sets, 0);
  if (state.loggedSets > totalSets) throw new RunnerCheckpointError('state.loggedSets exceeds planned volume');

  const skipped = new Set(state.skippedSessionPlanSlotIds);
  if (phase === 'complete') {
    if (state.slotIndex !== slots.length || state.setIndex !== 0 || state.restSecondsTarget !== 0 ||
      state.restStartedAtMs !== null || state.restRpe !== null ||
      state.substitutionOfferedForSessionPlanSlotId !== null || state.haltReason !== null ||
      !allSlotsResolved(slots, state.slotSetCounts, skipped)) {
      throw new RunnerCheckpointError('complete state has unresolved or live-session fields');
    }
    return state;
  }

  const current = slots[state.slotIndex];
  const currentCompleted = current === undefined ? 0 : state.slotSetCounts[state.slotIndex]!;
  if (current === undefined || state.setIndex < 1 || state.setIndex > current.sets) {
    throw new RunnerCheckpointError('live state does not point to a valid set');
  }
  if (state.substitutionOfferedForSessionPlanSlotId !== null &&
    state.substitutionOfferedForSessionPlanSlotId !== current.sessionPlanSlotId) {
    throw new RunnerCheckpointError('substitution offer must target the current session-plan slot');
  }
  if (state.skippedSessionPlanSlotIds.includes(current.sessionPlanSlotId)) {
    throw new RunnerCheckpointError('live state cannot point at a skipped session-plan slot');
  }

  if (phase === 'halted') {
    if (state.restSecondsTarget !== 0 || state.restStartedAtMs !== null || state.restRpe !== null ||
      state.substitutionOfferedForSessionPlanSlotId !== null || !isHaltReason(state.haltReason)) {
      throw new RunnerCheckpointError('halted state has invalid live-session fields');
    }
    return state;
  }

  if (state.haltReason !== null) throw new RunnerCheckpointError('only halted state may have a halt reason');
  if (phase === 'working') {
    if (state.restSecondsTarget !== 0 || state.restStartedAtMs !== null || state.restRpe !== null ||
      currentCompleted >= current.sets || state.setIndex !== currentCompleted + 1 ||
      allSlotsResolved(slots, state.slotSetCounts, skipped)) {
      throw new RunnerCheckpointError('working state has invalid active-work fields');
    }
    return state;
  }

  if (!isRestTarget(state.restSecondsTarget) || !isNonNegativeTimestamp(state.restStartedAtMs) || !isRpe(state.restRpe)) {
    throw new RunnerCheckpointError('resting state has invalid rest fields');
  }
  if (state.updatedAtMs === null || state.restStartedAtMs > state.updatedAtMs) {
    throw new RunnerCheckpointError('rest start cannot be after state update time');
  }
  if (state.substitutionOfferedForSessionPlanSlotId !== null) {
    throw new RunnerCheckpointError('resting state cannot retain a substitution offer');
  }
  if (currentCompleted < 1 || state.setIndex !== currentCompleted ||
    allSlotsResolved(slots, state.slotSetCounts, skipped)) {
    throw new RunnerCheckpointError('resting state must follow a logged, non-final session set');
  }
  if (state.restSecondsTarget !== restSecondsFor(current, state.tier, state.restRpe)) {
    throw new RunnerCheckpointError('resting state violates the rest prescription');
  }
  return state;
}

function cloneState(state: RunnerState): RunnerState {
  return normalizeState({
    ...state,
    slots: state.slots.map((slot) => ({
      ...slot,
      target: slot.target.kind === 'reps'
        ? { kind: 'reps', reps: slot.target.reps }
        : { kind: 'time', seconds: slot.target.seconds },
    })),
    slotSetCounts: [...state.slotSetCounts],
    skippedSessionPlanSlotIds: [...state.skippedSessionPlanSlotIds],
  });
}

/**
 * Deterministic rest prescription. Actual set RPE takes precedence when
 * provided; otherwise the slot target RPE is used. The result is always a
 * 15-second step in the inclusive 45..300 second contract.
 */
export function restSecondsFor(
  slot: Pick<RunnerSlot, 'targetRpe'>,
  tier: TrainingAge,
  actualRpe?: number | null,
): number {
  if (!isTrainingAge(tier)) throw new RunnerCheckpointError('invalid training tier');
  const rpe = actualRpe ?? slot.targetRpe;
  if (!isRpe(rpe)) throw new RunnerCheckpointError('RPE must be a finite value from 0 to 10');
  const base = rpe >= 9 ? 240 : rpe >= 8 ? 180 : rpe >= 7 ? 120 : 90;
  const snapped = Math.round((base * TIER_REST_SCALE[tier]) / 15) * 15;
  return Math.min(300, Math.max(45, snapped));
}

/** Start a runner from a frozen ordered session plan. */
export function startRunner(
  slotInputs: readonly RunnerSlotInput[],
  config?: RunnerStartConfig,
): RunnerState {
  const slots = normalizeSlots(slotInputs);
  const { tier, startedAtMs } = normalizeStartConfig(config);
  if (slots.length === 0) {
    return {
      tier,
      slots,
      slotIndex: 0,
      setIndex: 0,
      phase: 'complete',
      restSecondsTarget: 0,
      restStartedAtMs: null,
      restRpe: null,
      slotSetCounts: slots.map(() => 0),
      loggedSets: 0,
      substitutionOfferedForSessionPlanSlotId: null,
      haltReason: null,
      skippedSessionPlanSlotIds: [],
      updatedAtMs: startedAtMs,
    };
  }
  return {
    tier,
    slots,
    slotIndex: 0,
    setIndex: 1,
    phase: 'working',
    restSecondsTarget: 0,
    restStartedAtMs: null,
    restRpe: null,
    slotSetCounts: slots.map(() => 0),
    loggedSets: 0,
    substitutionOfferedForSessionPlanSlotId: null,
    haltReason: null,
    skippedSessionPlanSlotIds: [],
    updatedAtMs: startedAtMs,
  };
}

/** The current session-plan slot, including when a halt retains its context. */
export function currentSlot(state: RunnerState): RunnerSlot | null {
  if (state.phase === 'complete') return null;
  return state.slots[state.slotIndex] ?? null;
}

/** The set that can be logged now; no set is active during rest or terminal states. */
export function currentSet(state: RunnerState): RunnerWork | null {
  const slot = currentSlot(state);
  if (state.phase !== 'working' || slot === null) return null;
  return { slot, setIndex: state.setIndex };
}

/**
 * The work that follows the current set/rest. This is the compact next-up
 * preview used by the UI, never a command to advance the reducer.
 */
export function nextUp(state: RunnerState): RunnerWork | null {
  const slot = currentSlot(state);
  if (slot === null || state.phase === 'halted') return null;
  const skipped = new Set(state.skippedSessionPlanSlotIds);
  const currentCompleted = state.slotSetCounts[state.slotIndex] ?? 0;
  // Working has one unlogged current set; resting has already recorded it.
  const completedBeforePreview = state.phase === 'working' ? currentCompleted + 1 : currentCompleted;
  if (completedBeforePreview < slot.sets) {
    return { slot, setIndex: completedBeforePreview + 1 };
  }
  const nextIndex = nextIncompleteSlotIndex(
    state.slots,
    state.slotSetCounts,
    skipped,
    (state.slotIndex + 1) % state.slots.length,
  );
  if (nextIndex === null) return null;
  return { slot: state.slots[nextIndex]!, setIndex: state.slotSetCounts[nextIndex]! + 1 };
}

function isNormalEventTime(state: RunnerState, atMs: number): boolean {
  return isNonNegativeTimestamp(atMs) && (state.updatedAtMs === null || atMs >= state.updatedAtMs);
}

function withUpdate(state: RunnerState, atMs: number, changes: Partial<RunnerState>): RunnerState {
  return { ...state, ...changes, updatedAtMs: atMs };
}

function completeAt(state: RunnerState, atMs: number): RunnerState {
  return withUpdate(state, atMs, {
    slotIndex: state.slots.length,
    setIndex: 0,
    phase: 'complete',
    restSecondsTarget: 0,
    restStartedAtMs: null,
    restRpe: null,
    substitutionOfferedForSessionPlanSlotId: null,
    haltReason: null,
  });
}

/** Safety transitions remain reachable even if an external clock is late. */
function haltAt(state: RunnerState, atMs: number, reason: RunnerHaltReason): RunnerState {
  if (!isNonNegativeTimestamp(atMs)) return state;
  const updatedAtMs = state.updatedAtMs === null ? atMs : Math.max(state.updatedAtMs, atMs);
  return {
    ...state,
    phase: 'halted',
    restSecondsTarget: 0,
    restStartedAtMs: null,
    restRpe: null,
    substitutionOfferedForSessionPlanSlotId: null,
    haltReason: reason,
    updatedAtMs,
  };
}

function advanceFromRest(state: RunnerState, atMs: number): RunnerState {
  const nextIndex = nextIncompleteSlotIndex(
    state.slots,
    state.slotSetCounts,
    new Set(state.skippedSessionPlanSlotIds),
    state.slotIndex,
  );
  if (nextIndex === null) return completeAt(state, atMs);
  return withUpdate(state, atMs, {
    phase: 'working',
    slotIndex: nextIndex,
    setIndex: state.slotSetCounts[nextIndex]! + 1,
    restSecondsTarget: 0,
    restStartedAtMs: null,
    restRpe: null,
    substitutionOfferedForSessionPlanSlotId: null,
  });
}

/**
 * Apply one event. Invalid or out-of-phase events are no-ops; terminal states
 * are immutable. `HALT` and halt-level `NIGGLE` are the sole safety exception
 * to timestamp ordering, so every live state can always halt.
 */
export function advance(state: RunnerState, event: RunnerEvent): RunnerState {
  if (state.phase === 'complete' || state.phase === 'halted') return state;
  const slot = currentSlot(state);
  if (slot === null) return state;

  if (event.kind === 'HALT') {
    const reason = event.reason ?? 'manual';
    return isHaltReason(reason) ? haltAt(state, event.atMs, reason) : state;
  }

  if (event.kind === 'NIGGLE') {
    if (!isNiggleSeverity(event.severity) || !isNonNegativeTimestamp(event.atMs)) return state;
    if (event.severity >= EXPERIENCE_SEVERITY[state.tier].haltMin) {
      return haltAt(state, event.atMs, 'niggle');
    }
    if (!isNormalEventTime(state, event.atMs) || state.phase !== 'working' ||
      event.severity < EXPERIENCE_SEVERITY[state.tier].triageMin) {
      return state;
    }
    return withUpdate(state, event.atMs, {
      substitutionOfferedForSessionPlanSlotId: slot.sessionPlanSlotId,
    });
  }

  if (!isNormalEventTime(state, event.atMs)) return state;

  switch (event.kind) {
    case 'LOG_SET': {
      const currentCompleted = state.slotSetCounts[state.slotIndex] ?? 0;
      if (state.phase !== 'working' || currentCompleted >= slot.sets ||
        (event.actualRpe !== undefined && !isRpe(event.actualRpe))) return state;
      const actualRpe = event.actualRpe ?? slot.targetRpe;
      const slotSetCounts = state.slotSetCounts.map((count, index) =>
        index === state.slotIndex ? count + 1 : count,
      );
      const loggedSets = state.loggedSets + 1;
      if (allSlotsResolved(state.slots, slotSetCounts, new Set(state.skippedSessionPlanSlotIds))) {
        return completeAt({ ...state, slotSetCounts, loggedSets }, event.atMs);
      }
      return withUpdate(state, event.atMs, {
        slotSetCounts,
        loggedSets,
        phase: 'resting',
        restSecondsTarget: restSecondsFor(slot, state.tier, actualRpe),
        restStartedAtMs: event.atMs,
        restRpe: actualRpe,
        substitutionOfferedForSessionPlanSlotId: null,
      });
    }
    case 'REST_ELAPSED': {
      if (state.phase !== 'resting' || state.restStartedAtMs === null ||
        event.atMs - state.restStartedAtMs < state.restSecondsTarget * 1000) {
        return state;
      }
      return advanceFromRest(state, event.atMs);
    }
    case 'SKIP_REST':
      return state.phase === 'resting' ? advanceFromRest(state, event.atMs) : state;
    case 'THUMBS_DOWN':
      return state.phase === 'working'
        ? withUpdate(state, event.atMs, { substitutionOfferedForSessionPlanSlotId: slot.sessionPlanSlotId })
        : state;
    case 'DECLINE_SUBSTITUTION':
      return state.phase === 'working' && state.substitutionOfferedForSessionPlanSlotId === slot.sessionPlanSlotId
        ? withUpdate(state, event.atMs, { substitutionOfferedForSessionPlanSlotId: null })
        : state;
    case 'SUBSTITUTE': {
      if (state.phase !== 'working' || state.substitutionOfferedForSessionPlanSlotId !== slot.sessionPlanSlotId ||
        !isPositiveInteger(event.movementId) || typeof event.movementName !== 'string' || event.movementName.trim().length === 0) {
        return state;
      }
      const replacement: RunnerSlot = {
        ...slot,
        movementId: event.movementId,
        movementName: event.movementName,
      };
      const slots = state.slots.map((candidate, index) => index === state.slotIndex ? replacement : candidate);
      return withUpdate(state, event.atMs, {
        slots,
        substitutionOfferedForSessionPlanSlotId: null,
      });
    }
    case 'SKIP_SLOT': {
      if (state.phase !== 'working') return state;
      const skippedSessionPlanSlotIds = [...state.skippedSessionPlanSlotIds, slot.sessionPlanSlotId];
      const nextIndex = nextIncompleteSlotIndex(
        state.slots,
        state.slotSetCounts,
        new Set(skippedSessionPlanSlotIds),
        (state.slotIndex + 1) % state.slots.length,
      );
      if (nextIndex === null) return completeAt({ ...state, skippedSessionPlanSlotIds }, event.atMs);
      return withUpdate(state, event.atMs, {
        phase: 'working',
        slotIndex: nextIndex,
        setIndex: state.slotSetCounts[nextIndex]! + 1,
        restSecondsTarget: 0,
        restStartedAtMs: null,
        restRpe: null,
        substitutionOfferedForSessionPlanSlotId: null,
        skippedSessionPlanSlotIds,
      });
    }
  }
}

/** Deterministically replay an event transcript from its frozen session plan. */
export function replayRunner(
  slots: readonly RunnerSlotInput[],
  events: readonly RunnerEvent[],
  config?: RunnerStartConfig,
): RunnerState {
  return events.reduce((state, event) => advance(state, event), startRunner(slots, config));
}

/** Create a validated, defensive-copy checkpoint suitable for plain JSON storage. */
export function createRunnerCheckpoint(state: RunnerState): RunnerCheckpoint {
  return { version: RUNNER_CHECKPOINT_VERSION, state: cloneState(state) };
}

/** Restore and validate an object checkpoint read from durable storage. */
export function restoreRunnerCheckpoint(checkpoint: unknown): RunnerState {
  if (!isRecord(checkpoint) || checkpoint.version !== RUNNER_CHECKPOINT_VERSION) {
    throw new RunnerCheckpointError('unsupported runner checkpoint version');
  }
  return normalizeState(checkpoint.state);
}

/** Serialize a checkpoint without hidden timestamps, I/O, or non-JSON values. */
export function serializeRunner(state: RunnerState): string {
  return JSON.stringify(createRunnerCheckpoint(state));
}

/** Parse, restore, and validate a serialized runner checkpoint. */
export function deserializeRunner(serialized: string): RunnerState {
  if (typeof serialized !== 'string') throw new RunnerCheckpointError('runner checkpoint must be a JSON string');
  try {
    return restoreRunnerCheckpoint(JSON.parse(serialized));
  } catch (error) {
    if (error instanceof RunnerCheckpointError) throw error;
    throw new RunnerCheckpointError('runner checkpoint is not valid JSON');
  }
}