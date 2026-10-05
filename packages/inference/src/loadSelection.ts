/**
 * loadSelection.ts — four-mode load selection resolver (WO_FOUR_MODE_LOAD,
 * ratified 2026-08-07).
 *
 * The durable athlete choice is the two-way preference `auto | manual`
 * (migration 035). Evidence and tier then determine the EFFECTIVE source for
 * each movement: seeded | history | derived | manual. This module is that
 * resolver. It is pure and deterministic: explicit inputs only — no clock,
 * no database, no Zustand, no React.
 *
 * Binding laws (WO §§1-3, Sol audit corrections 4-8):
 *  - Beginner is restricted to seeded -> history. One-rep-max and APRE-derived
 *    absolute targets NEVER become operative beginner loads.
 *  - Non-beginner manual: the effective source is always manual. APRE
 *    override, 1RM-derived target, or history may be returned as ONE advisory
 *    suggestion (in that precedence) — an advisory never populates the
 *    authoritative first-set entry.
 *  - Non-beginner auto: valid APRE overrideLoadKg -> derived; else repetition
 *    target + movement 1RM -> derived via targetLoadKg; else honest history;
 *    else seeded.
 *  - Timed targets cannot use repetition/1RM derivation. A valid absolute
 *    APRE override remains eligible for non-beginner auto because it is
 *    already an absolute prescription and does not depend on reps/1RM.
 *  - Missing evidence is not zero; an explicit zero IS valid evidence.
 *  - First-exposure external-load fields are blank (null), never coerced.
 *  - Bodyweight added-load may initialize to 0 — the identity load, not a
 *    fiat starting-weight table. This holds in manual mode too.
 *  - After the athlete logs the first manual set for a movement in the active
 *    session, that actual current-session load may carry to the next set; the
 *    source stays manual and the carried value is not an advisory.
 */

import { targetLoadKg } from './blockGenerator';
import type { TrainingAge } from './types';

export type LoadPreference = 'auto' | 'manual';
export type LoadSource = 'seeded' | 'history' | 'derived' | 'manual';
export type AdvisoryKind = 'apre' | 'onerm' | 'history';

export interface LoadSelectionInput {
  trainingAge: TrainingAge;
  preference: LoadPreference;
  /** True when the movement's primary implement is bodyweight (added load). */
  bodyweightMode: boolean;
  /** Repetition target reps when the slot target is rep-based, else null. */
  targetReps: number | null;
  /** Prescribed RPE for the slot (targetLoadKg's third argument). */
  targetRpe: number;
  /** Movement-specific 1RM in kg, or absent. */
  oneRepMaxKg: number | null;
  /** APRE absolute override in kg, or absent. */
  overrideLoadKg: number | null;
  /** Honest latest logged load for the movement, or absent. Explicit 0 is
   *  evidence and must be passed as 0, not null. */
  lastLoggedLoadKg: number | null;
  /** Load the athlete actually logged for this movement earlier in the ACTIVE
   *  session, or absent. Drives the manual current-session carry-forward. */
  currentSessionLoadKg: number | null;
  /** True for the first set of this movement in the active session. */
  isFirstSet: boolean;
}

export interface LoadSelection {
  /** The effective source for this movement/set. Exactly four values exist. */
  source: LoadSource;
  /** Operative initial entry value in kg. null = blank field (athlete must
   *  make an explicit choice). 0 is a real value (identity/explicit zero). */
  initialLoadKg: number | null;
  /** Manual-mode advisory suggestion (never an operative entry). */
  advisoryKg: number | null;
  advisoryKind: AdvisoryKind | null;
}

/** A load is honest evidence when it is a finite, non-negative number.
 *  Explicit zero qualifies; NaN/Infinity/negatives fail closed. */
const isHonest = (kg: number | null): kg is number =>
  kg !== null && Number.isFinite(kg) && kg >= 0;

/** The default durable preference for a tier (WO §2). */
export const defaultLoadPreference = (age: TrainingAge): LoadPreference =>
  age === 'advanced' || age === 'elite' ? 'manual' : 'auto';

/**
 * Training-age transition law for the durable preference (WO §2):
 *  - entering beginner forces auto (manual beginner prescription is not
 *    authorized);
 *  - leaving beginner applies the destination tier's default (the prior
 *    beginner value was forced, not an explicit preference);
 *  - moving between non-beginner tiers preserves the athlete's explicit
 *    choice.
 * `explicit` is true only when the athlete actively chose the current value;
 * a value set purely by a tier default is not explicit and is re-derived.
 */
export const transitionLoadPreference = (
  from: TrainingAge,
  to: TrainingAge,
  current: LoadPreference,
  explicit: boolean,
): LoadPreference => {
  if (to === 'beginner') return 'auto';
  if (from === 'beginner') return defaultLoadPreference(to);
  return explicit ? current : defaultLoadPreference(to);
};

export function resolveLoadSelection(input: LoadSelectionInput): LoadSelection {
  const {
    trainingAge, preference, bodyweightMode, targetReps, targetRpe,
    oneRepMaxKg, overrideLoadKg, lastLoggedLoadKg, currentSessionLoadKg, isFirstSet,
  } = input;

  const history = isHonest(lastLoggedLoadKg) ? lastLoggedLoadKg : null;
  const apre = isHonest(overrideLoadKg) ? overrideLoadKg : null;
  const oneRm = isHonest(oneRepMaxKg) ? oneRepMaxKg : null;
  const validTargetReps = targetReps !== null
    && Number.isInteger(targetReps)
    && targetReps > 0;
  const validTargetRpe = Number.isFinite(targetRpe)
    && targetRpe >= 5
    && targetRpe <= 10;
  // Timed targets cannot use repetition/1RM derivation: no reps, no path.
  // Invalid rep/RPE numerics also fail closed before targetLoadKg can emit a
  // non-finite or physically meaningless result.
  const calculated = !bodyweightMode && validTargetReps && validTargetRpe && oneRm !== null
    ? targetLoadKg(oneRm, targetReps, targetRpe)
    : null;
  const derived = isHonest(calculated) ? calculated : null;

  // Manual-mode advisory precedence: APRE -> 1RM-derived -> history. Exactly
  // one advisory, and never an operative entry.
  const advisory = ((): { kg: number | null; kind: AdvisoryKind | null } => {
    if (apre !== null) return { kg: apre, kind: 'apre' };
    if (derived !== null) return { kg: derived, kind: 'onerm' };
    if (history !== null) return { kg: history, kind: 'history' };
    return { kg: null, kind: null };
  })();

  // 1. Beginner: seeded -> history. 1RM/APRE never become operative.
  if (trainingAge === 'beginner') {
    if (history !== null) {
      return { source: 'history', initialLoadKg: history, advisoryKg: null, advisoryKind: null };
    }
    // Bodyweight identity load: explicit 0 is lawful even at first exposure.
    return {
      source: 'seeded',
      initialLoadKg: bodyweightMode ? 0 : null,
      advisoryKg: null,
      advisoryKind: null,
    };
  }

  // 2. Non-beginner manual: the athlete's entry is authoritative.
  if (preference === 'manual') {
    // Current-session carry-forward: after the first logged set, the actual
    // logged load initializes the next set. The source stays manual; the
    // carried value is the athlete's own, not an advisory.
    if (!isFirstSet && isHonest(currentSessionLoadKg)) {
      return {
        source: 'manual',
        initialLoadKg: currentSessionLoadKg,
        advisoryKg: advisory.kg,
        advisoryKind: advisory.kind,
      };
    }
    return {
      source: 'manual',
      // External load starts blank; bodyweight identity load starts at 0.
      initialLoadKg: bodyweightMode ? 0 : null,
      advisoryKg: advisory.kg,
      advisoryKind: advisory.kind,
    };
  }

  // 3. Non-beginner auto: APRE (absolute, target-kind independent) -> derived;
  //    reps + 1RM -> derived; history; seeded.
  if (apre !== null) {
    return { source: 'derived', initialLoadKg: apre, advisoryKg: null, advisoryKind: null };
  }
  if (derived !== null) {
    return { source: 'derived', initialLoadKg: derived, advisoryKg: null, advisoryKind: null };
  }
  if (history !== null) {
    return { source: 'history', initialLoadKg: history, advisoryKg: null, advisoryKind: null };
  }
  return {
    source: 'seeded',
    initialLoadKg: bodyweightMode ? 0 : null,
    advisoryKg: null,
    advisoryKind: null,
  };
}
