/**
 * sessionTimeBudget.ts — the ONE contract for how a session's total
 * availability is spent.
 *
 *   total availability (session_duration_cap_min)
 *     = preparation
 *     + for every main movement: transition + work + rest between sets
 *
 * Before this module the three planners each kept a private law and none of
 * them counted preparation:
 *   - blockGenerator used `clamp(round(cap / 22), 2, 5)` in three places, whose
 *     lower clamp promised two 22-minute movements inside a 15-minute session;
 *   - routineMicrocycle used role constants (`3 + sets * 2.5`, ...);
 *   - routineComposer used fixed role minutes (18 / 12 / 8 / 8).
 * All three now reserve preparation here and estimate work, rest and
 * transitions with the same function, so "fits in the session" means the same
 * thing wherever it is asked.
 *
 * Pure and deterministic: no clock, no storage, no randomness.
 *
 * Provenance of the numbers (see docs/coaching/PREPARATION_PROVENANCE.md):
 *   - REST between sets is not restated: it is the runner's own prescription
 *     (`restSecondsFor`), so the estimate and the timer the athlete will
 *     actually see cannot drift apart.
 *   - PREPARATION_FLOOR_MIN (5) is the lower bound of the 5-10 minute general
 *     warm-up in ACSM's exercise-session structure; planners never reserve
 *     less, and a session that cannot afford it is reported, not shortened.
 *   - WORK_SECONDS_PER_REP, MIN_WORK_SECONDS_PER_SET and
 *     TRANSITION_SECONDS_PER_SLOT are engineering time allowances for a
 *     duration ESTIMATE. They are not training prescriptions and carry no
 *     clinical claim.
 */
import { restSecondsFor } from './sessionRunner';

export const SESSION_TIME_CONTRACT_VERSION = 1 as const;

/** Reviewed minimum preparation. Never reserved below this. */
export const PREPARATION_FLOOR_MIN = 5;
/** Preparation reserved when the session has room for the full protocol. */
export const PREPARATION_STANDARD_MIN = 10;
/** The block generator's per-movement allowance (work, rest and changeover). */
export const LEGACY_MINUTES_PER_SLOT = 22;
/** planned_session shape the UI is built around. */
export const MAX_SESSION_SLOTS = 5;
/** Changeover between movements: move station, set up, load. */
export const TRANSITION_SECONDS_PER_SLOT = 120;
/** Controlled repetition tempo used only to estimate time under work. */
export const WORK_SECONDS_PER_REP = 4;
/** A set is never estimated shorter than this (unrack, brace, re-rack). */
export const MIN_WORK_SECONDS_PER_SET = 20;

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const round1 = (x: number): number => Math.round(x * 10) / 10;

export type TimedSlotTarget =
  | { readonly kind: 'reps'; readonly reps: number }
  | { readonly kind: 'time'; readonly seconds: number };

export interface TimedSlot {
  readonly sets: number;
  readonly target: TimedSlotTarget;
  readonly targetRpe: number;
  /**
   * A reviewed minimum for this slot, in seconds. A planner that already had
   * an accepted time allowance for a movement passes it here, so the shared
   * estimate can only make that movement LONGER than the law it replaces,
   * never shorter — the contract adds preparation, rest and changeovers; it
   * does not quietly loosen an existing limit.
   */
  readonly minimumSeconds?: number;
}

/** The cap as every planner reads it: whole minutes inside the 15..240 profile domain. */
export const normalizedCapMin = (capMin: number): number =>
  clamp(Math.round(Number.isFinite(capMin) ? capMin : 15), 15, 240);

/**
 * Preparation minutes a PLANNER reserves before it knows the exact protocol.
 * Longer sessions reserve the standard protocol; short sessions reserve the
 * floor. The live protocol is built later, at session start, to fit whatever
 * this reserved (preparationPolicy.buildPreparationProtocol).
 */
export const preparationPlanningMinutes = (capMin: number): number => {
  const cap = normalizedCapMin(capMin);
  if (cap >= 60) return PREPARATION_STANDARD_MIN;
  if (cap >= 45) return 8;
  return PREPARATION_FLOOR_MIN;
};

/**
 * The block generator's movement-count law, with the preparation floor
 * reserved first. This is the single replacement for the three duplicated
 * `clamp(round(cap / 22), 2, 5)` formulas: the generator and both strength
 * anchor calculations call it, so they cannot disagree about how many pattern
 * slots a session carries.
 *
 * The old lower clamp of 2 is gone on purpose. It promised two movements to a
 * session that could not hold them; a short session now gets the one movement
 * it can carry, and `fitSessionToCap` reports honestly if even that does not
 * fit.
 */
export const slotBudgetForCap = (capMin: number): number => {
  const mainWorkMin = normalizedCapMin(capMin) - PREPARATION_FLOOR_MIN;
  return clamp(Math.round(mainWorkMin / LEGACY_MINUTES_PER_SLOT), 1, MAX_SESSION_SLOTS);
};

const restSeconds = (targetRpe: number): number =>
  restSecondsFor({ targetRpe: clamp(Number.isFinite(targetRpe) ? targetRpe : 8, 0, 10) }, 'intermediate');

const workSecondsPerSet = (target: TimedSlotTarget): number => target.kind === 'time'
  ? Math.max(1, Math.round(target.seconds))
  : Math.max(MIN_WORK_SECONDS_PER_SET, Math.round(target.reps) * WORK_SECONDS_PER_REP);

export interface SlotTimeEstimate {
  readonly transitionSeconds: number;
  readonly workSeconds: number;
  readonly restSeconds: number;
  /** Seconds added to reach the slot's reviewed minimum; 0 when none applies. */
  readonly allowanceSeconds: number;
  readonly totalSeconds: number;
}

/** One movement: changeover, every set's work, and the rest BETWEEN its sets. */
export function estimateSlotTime(slot: TimedSlot): SlotTimeEstimate {
  const sets = Math.max(0, Math.round(slot.sets));
  if (sets === 0) return { transitionSeconds: 0, workSeconds: 0, restSeconds: 0, allowanceSeconds: 0, totalSeconds: 0 };
  const workSeconds = sets * workSecondsPerSet(slot.target);
  const rest = (sets - 1) * restSeconds(slot.targetRpe);
  const measured = TRANSITION_SECONDS_PER_SLOT + workSeconds + rest;
  const minimum = slot.minimumSeconds !== undefined && Number.isFinite(slot.minimumSeconds)
    ? Math.max(0, slot.minimumSeconds) : 0;
  return {
    transitionSeconds: TRANSITION_SECONDS_PER_SLOT,
    workSeconds,
    restSeconds: rest,
    allowanceSeconds: Math.max(0, minimum - measured),
    totalSeconds: Math.max(measured, minimum),
  };
}

export const estimateSlotMinutes = (slot: TimedSlot): number =>
  estimateSlotTime(slot).totalSeconds / 60;

export interface SessionTimeEstimate {
  readonly contractVersion: typeof SESSION_TIME_CONTRACT_VERSION;
  readonly preparationMin: number;
  readonly transitionMin: number;
  readonly workMin: number;
  readonly restMin: number;
  /** Minutes added by per-slot reviewed minimums; 0 when none apply. */
  readonly allowanceMin: number;
  /** preparation + transitions + work + rest + allowance, to one decimal. */
  readonly totalMin: number;
}

export function estimateSessionTime(input: {
  readonly preparationMin: number;
  readonly slots: readonly TimedSlot[];
}): SessionTimeEstimate {
  let transition = 0;
  let work = 0;
  let rest = 0;
  let allowance = 0;
  for (const slot of input.slots) {
    const estimate = estimateSlotTime(slot);
    transition += estimate.transitionSeconds;
    work += estimate.workSeconds;
    rest += estimate.restSeconds;
    allowance += estimate.allowanceSeconds;
  }
  const preparationMin = Math.max(0, input.preparationMin);
  return {
    contractVersion: SESSION_TIME_CONTRACT_VERSION,
    preparationMin,
    transitionMin: round1(transition / 60),
    workMin: round1(work / 60),
    restMin: round1(rest / 60),
    allowanceMin: round1(allowance / 60),
    totalMin: round1(preparationMin + (transition + work + rest + allowance) / 60),
  };
}

export type SessionTimeReasonCode =
  | 'fits'
  | 'cap_below_preparation_floor'
  | 'no_main_work_time';

export interface SessionTimeReservation {
  readonly capMin: number;
  readonly preparationMin: number;
  /** Minutes left for main work (transitions, work and rest). */
  readonly mainWorkMin: number;
  readonly feasible: boolean;
  readonly reasonCode: SessionTimeReasonCode;
}

/** Reserve preparation out of the total. Preparation is never reserved below the floor. */
export function reserveSessionTime(input: {
  readonly capMin: number;
  readonly preparationMin: number;
}): SessionTimeReservation {
  const capMin = Math.max(0, input.capMin);
  const preparationMin = Math.max(PREPARATION_FLOOR_MIN, input.preparationMin);
  const mainWorkMin = round1(capMin - preparationMin);
  if (capMin < PREPARATION_FLOOR_MIN) {
    return { capMin, preparationMin, mainWorkMin: 0, feasible: false, reasonCode: 'cap_below_preparation_floor' };
  }
  if (mainWorkMin <= 0) {
    return { capMin, preparationMin, mainWorkMin: 0, feasible: false, reasonCode: 'no_main_work_time' };
  }
  return { capMin, preparationMin, mainWorkMin, feasible: true, reasonCode: 'fits' };
}

export interface FittableSlot extends TimedSlot {
  /** Reviewed minimum for this slot. Sets are never trimmed below it. */
  readonly minSets: number;
  /** Lower trims first. Ties trim the LATER slot first. */
  readonly trimPriority: number;
  /** False keeps the dose untouched (sport rounds, frozen plans). */
  readonly trimmable: boolean;
}

export interface SessionFit {
  readonly capMin: number;
  readonly preparationMin: number;
  /** True when preparation was reduced from the requested allowance to the floor. */
  readonly preparationCondensed: boolean;
  /** Final set count per input slot, same order. */
  readonly sets: readonly number[];
  readonly trimmedSlotIndices: readonly number[];
  readonly estimate: SessionTimeEstimate;
  readonly feasible: boolean;
  /** Minutes over the cap when infeasible; 0 otherwise. */
  readonly overByMin: number;
}

/**
 * Make one session fit its cap, in a fixed and explainable order:
 *   1. condense preparation to the reviewed floor (never below it);
 *   2. trim sets, lowest priority first, never below each slot's minimum;
 *   3. report the conflict. Nothing is dropped silently and nothing shrinks
 *      past a reviewed limit — an infeasible session comes back infeasible.
 */
export function fitSessionToCap(input: {
  readonly capMin: number;
  readonly preparationMin: number;
  readonly slots: readonly FittableSlot[];
}): SessionFit {
  const capMin = Math.max(0, input.capMin);
  const requestedPreparation = Math.max(PREPARATION_FLOOR_MIN, input.preparationMin);
  const sets = input.slots.map((slot) => Math.max(0, Math.round(slot.sets)));
  const estimateWith = (preparationMin: number): SessionTimeEstimate => estimateSessionTime({
    preparationMin,
    slots: input.slots.map((slot, index) => ({ ...slot, sets: sets[index]! })),
  });

  let preparationMin = requestedPreparation;
  let estimate = estimateWith(preparationMin);
  if (estimate.totalMin > capMin && preparationMin > PREPARATION_FLOOR_MIN) {
    preparationMin = PREPARATION_FLOOR_MIN;
    estimate = estimateWith(preparationMin);
  }

  const trimmed = new Set<number>();
  const order = input.slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => slot.trimmable)
    .sort((a, b) => a.slot.trimPriority - b.slot.trimPriority || b.index - a.index);
  let guard = 0;
  while (estimate.totalMin > capMin && guard < 1000) {
    guard += 1;
    const next = order.find(({ slot, index }) => sets[index]! > Math.max(1, Math.round(slot.minSets)));
    if (next === undefined) break;
    sets[next.index] = sets[next.index]! - 1;
    trimmed.add(next.index);
    estimate = estimateWith(preparationMin);
  }

  const feasible = estimate.totalMin <= capMin;
  return {
    capMin,
    preparationMin,
    preparationCondensed: preparationMin < requestedPreparation,
    sets,
    trimmedSlotIndices: [...trimmed].sort((a, b) => a - b),
    estimate,
    feasible,
    overByMin: feasible ? 0 : round1(estimate.totalMin - capMin),
  };
}

export type SessionTimeAlternative =
  | { readonly kind: 'extend_session'; readonly capMin: number }
  | { readonly kind: 'fewer_longer_sessions'; readonly weeklyFrequency: number; readonly capMin: number };

/**
 * Feasible offers for a session that cannot fit. Each one is something the
 * athlete can actually choose in the app (the session-length stepper moves in
 * 15-minute steps; training days are 1..7):
 *   - extend this session to the smallest length that fits;
 *   - keep the same weekly training time across fewer, longer sessions.
 * Returns an empty list when nothing inside the profile domain fits.
 */
export function feasibleSessionAlternatives(input: {
  readonly capMin: number;
  readonly requiredMin: number;
  readonly weeklyFrequency: number;
}): readonly SessionTimeAlternative[] {
  const required = Math.max(0, input.requiredMin);
  const extended = Math.ceil(required / 15) * 15;
  if (!Number.isFinite(extended) || extended > 240 || extended <= input.capMin) return [];
  const offers: SessionTimeAlternative[] = [{ kind: 'extend_session', capMin: extended }];
  const frequency = clamp(Math.round(input.weeklyFrequency), 1, 7);
  const weeklyMinutes = frequency * Math.max(0, input.capMin);
  const fewerDays = Math.floor(weeklyMinutes / extended);
  if (fewerDays >= 1 && fewerDays < frequency) {
    offers.push({ kind: 'fewer_longer_sessions', weeklyFrequency: fewerDays, capMin: extended });
  }
  return offers;
}

/** Plain-language form of one offer, for screens and warnings. */
export const describeSessionAlternative = (alternative: SessionTimeAlternative): string =>
  alternative.kind === 'extend_session'
    ? `Lengthen sessions to ${alternative.capMin} minutes.`
    : `Train ${alternative.weeklyFrequency} day${alternative.weeklyFrequency === 1 ? '' : 's'} a week at ${alternative.capMin} minutes — the same weekly time in fewer, longer sessions.`;

/** One honest sentence for a session that does not fit its cap. */
export function describeSessionTimeConflict(input: {
  readonly label: string;
  readonly capMin: number;
  readonly estimate: SessionTimeEstimate;
  readonly alternatives: readonly SessionTimeAlternative[];
}): string {
  const main = round1(input.estimate.totalMin - input.estimate.preparationMin);
  const base = `${input.label} needs about ${Math.ceil(input.estimate.totalMin)} minutes `
    + `(${input.estimate.preparationMin} min preparation + ${Math.ceil(main)} min main work with rest and changeovers) `
    + `but the session limit is ${input.capMin} minutes.`;
  return input.alternatives.length === 0
    ? `${base} Preparation was not removed to make it fit.`
    : `${base} Preparation was not removed to make it fit. Options: ${input.alternatives.map(describeSessionAlternative).join(' ')}`;
}
