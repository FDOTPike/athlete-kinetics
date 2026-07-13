/**
 * sessionRunner.ts — P17 S1: the guided-session state machine, pure TS.
 *
 * Walks an athlete through a planned session one set at a time: ordered
 * slots → current set → rest interval → next-up preview → substitution offer
 * on thumbs-down. A reducer over explicit events: no clock, no IO, no RNG —
 * the UI owns the timer and feeds REST_ELAPSED; the engine only ever computes
 * the next state from (state, event). Deterministic and knife-testable before
 * any UI exists (rev4 plan, P17 Step 1).
 *
 * Rest prescription (documented defaults, overridable per call):
 *   target RPE >= 9 → 240s, >= 8 → 180s, >= 7 → 120s, else 90s;
 *   scaled by tier (beginner ×0.75 — lighter absolute loads recover faster
 *   and long idle kills novice adherence; elite ×1.25); snapped to 15s,
 *   clamped [45s, 300s].
 */
import type { TrainingAge } from './types';

export interface RunnerSlot {
  readonly plannedSlotId: number;
  readonly movementId: number;
  readonly movementName: string;
  readonly sets: number;
  readonly reps: number;
  readonly targetRpe: number;
}

export type RunnerPhase = 'working' | 'resting' | 'complete';

export interface RunnerState {
  readonly slots: readonly RunnerSlot[];
  /** Index into slots of the CURRENT slot (meaningless when complete). */
  readonly slotIndex: number;
  /** 1-based set about to be performed (or just logged, when resting). */
  readonly setIndex: number;
  readonly phase: RunnerPhase;
  /** Prescribed rest for the current 'resting' phase; 0 while working. */
  readonly restSecondsTarget: number;
  /** Total sets logged this session (all slots). */
  readonly loggedSets: number;
  /** Slot the athlete thumbed-down — the UI should offer the substitution
   *  router for it; null when no offer is pending. */
  readonly substitutionOfferedFor: number | null;
}

export type RunnerEvent =
  | { readonly kind: 'LOG_SET' }
  | { readonly kind: 'REST_ELAPSED' }
  | { readonly kind: 'SKIP_REST' }
  | { readonly kind: 'THUMBS_DOWN' }
  | { readonly kind: 'DECLINE_SUBSTITUTION' }
  /** Swap the CURRENT slot's movement (router-chosen); remaining sets keep
   *  their prescription — volume is the plan's, the movement is negotiable. */
  | { readonly kind: 'SUBSTITUTE'; readonly movementId: number; readonly movementName: string }
  /** Abandon the current slot entirely (e.g. equipment taken, pain). */
  | { readonly kind: 'SKIP_SLOT' };

const TIER_REST_SCALE: Record<TrainingAge, number> = {
  beginner: 0.75, intermediate: 1.0, advanced: 1.0, elite: 1.25,
};

/** Deterministic rest prescription for a slot (see header). */
export function restSecondsFor(slot: RunnerSlot, tier: TrainingAge): number {
  const base = slot.targetRpe >= 9 ? 240 : slot.targetRpe >= 8 ? 180 : slot.targetRpe >= 7 ? 120 : 90;
  const scaled = base * TIER_REST_SCALE[tier];
  const snapped = Math.round(scaled / 15) * 15;
  return Math.min(300, Math.max(45, snapped));
}

export function startRunner(slots: readonly RunnerSlot[]): RunnerState {
  return {
    slots,
    slotIndex: 0,
    setIndex: 1,
    phase: slots.length === 0 ? 'complete' : 'working',
    restSecondsTarget: 0,
    loggedSets: 0,
    substitutionOfferedFor: null,
  };
}

/** The set the athlete will perform NEXT (after the current one / the rest),
 *  or null when the session is on its final set or complete. */
export function nextUp(state: RunnerState): { slot: RunnerSlot; setIndex: number } | null {
  if (state.phase === 'complete') return null;
  const slot = state.slots[state.slotIndex];
  if (slot === undefined) return null;
  if (state.setIndex < slot.sets) return { slot, setIndex: state.setIndex + 1 };
  const next = state.slots[state.slotIndex + 1];
  return next === undefined ? null : { slot: next, setIndex: 1 };
}

export function advance(state: RunnerState, event: RunnerEvent, tier: TrainingAge = 'intermediate'): RunnerState {
  if (state.phase === 'complete') return state; // terminal: every event is a no-op

  const slot = state.slots[state.slotIndex]!;

  switch (event.kind) {
    case 'LOG_SET': {
      if (state.phase !== 'working') return state; // log while resting = UI bug, ignore
      const logged = state.loggedSets + 1;
      const lastSetOfSlot = state.setIndex >= slot.sets;
      const lastSlot = state.slotIndex >= state.slots.length - 1;
      if (lastSetOfSlot && lastSlot) {
        return { ...state, loggedSets: logged, phase: 'complete', restSecondsTarget: 0, substitutionOfferedFor: null };
      }
      return { ...state, loggedSets: logged, phase: 'resting', restSecondsTarget: restSecondsFor(slot, tier) };
    }
    case 'REST_ELAPSED':
    case 'SKIP_REST': {
      if (state.phase !== 'resting') return state;
      const lastSetOfSlot = state.setIndex >= slot.sets;
      if (lastSetOfSlot) {
        return { ...state, phase: 'working', restSecondsTarget: 0, slotIndex: state.slotIndex + 1, setIndex: 1 };
      }
      return { ...state, phase: 'working', restSecondsTarget: 0, setIndex: state.setIndex + 1 };
    }
    case 'THUMBS_DOWN':
      return { ...state, substitutionOfferedFor: slot.plannedSlotId };
    case 'DECLINE_SUBSTITUTION':
      return { ...state, substitutionOfferedFor: null };
    case 'SUBSTITUTE': {
      const swapped: RunnerSlot = { ...slot, movementId: event.movementId, movementName: event.movementName };
      const slots = state.slots.map((s, i) => (i === state.slotIndex ? swapped : s));
      return { ...state, slots, substitutionOfferedFor: null };
    }
    case 'SKIP_SLOT': {
      const lastSlot = state.slotIndex >= state.slots.length - 1;
      if (lastSlot) {
        return { ...state, phase: 'complete', restSecondsTarget: 0, substitutionOfferedFor: null };
      }
      return { ...state, phase: 'working', restSecondsTarget: 0, slotIndex: state.slotIndex + 1, setIndex: 1, substitutionOfferedFor: null };
    }
  }
}
