/**
 * e1rm.ts — estimated 1RM derived from logged sets.
 *
 * WHY THIS EXISTS
 * `one_rep_max` (009_periodization.sql) holds ONE row per movement, keyed by
 * movement_id and overwritten in place. It is athlete-entered, exposed only for
 * the Big 4, and it keeps no history — the previous value is destroyed on update.
 * So the app has a current 1RM and no 1RM *series*. Nothing that needs to see
 * progress over time can be built on it.
 *
 * WHY IT INVENTS NOTHING
 * blockGenerator.targetPct already carries the ratified rep/RPE -> %1RM
 * translation, RIR term included:
 *
 *     targetPct(reps, rpe) = 1 / (1 + (reps + max(0, 10 - rpe)) / 30)
 *
 * It is used forward — known 1RM -> target load. This module reads the SAME
 * function backwards. There is no second formula, no new coefficient, and no
 * threshold. Calibration Policy v1 section 5 is therefore not engaged.
 *
 * WHAT THIS IS NOT
 * Not a plateau detector. It carries no minimal-detectable-change value, no
 * persistence window, and no notion of "stalled" — those are unratified numbers.
 * This module answers one question only: what does a logged set imply about the
 * athlete's 1RM at that moment. Deliberately observational: nothing here writes,
 * and nothing here may feed `one_rep_max`, which stays the single athlete-entered
 * source of truth for forward load targeting.
 *
 * Machine-checked in verify:blocks, including a negative invariant on the export
 * surface — this file exports exactly two functions and no constant, so a
 * threshold cannot be smuggled in later without turning the gate red.
 */
import { targetPct } from './blockGenerator';

/** One logged set, shaped as `set_record` joined to `session`. */
export interface E1rmSetInput {
  set_id: number;
  session_id: number;
  /** `session.session_date`, ISO `YYYY-MM-DD`. */
  session_date: string;
  reps: number;
  load_kg: number;
  /** `set_record.rpe` is NULLable, and a set without one yields no estimate. */
  rpe: number | null;
}

/** The best estimate a single session produced for one movement. */
export interface E1rmPoint {
  session_id: number;
  session_date: string;
  /** The set this estimate came from — so a reader can check the arithmetic. */
  set_id: number;
  e1rm_kg: number;
}

/**
 * Estimated 1RM implied by one logged set, or `null` when the set cannot
 * support an estimate.
 *
 * Returns `null` — never a fallback, never a default — when:
 *   - `rpe` is null. A set logged without effort carries no intensity anchor,
 *     and assuming one would fabricate the very signal being measured.
 *   - `reps < 1`, `loadKg <= 0`, or any input is non-finite.
 *   - `rpe` falls outside the 0..10 CHECK domain of `set_record.rpe`.
 *
 * The result is NOT rounded to plate increments. `targetLoadKg` rounds to 2.5 kg
 * because racks have plates; an estimate has no such constraint, and rounding it
 * would inject a quantisation the source data does not have.
 */
export function estimateOneRepMax(
  loadKg: number,
  reps: number,
  rpe: number | null,
): number | null {
  if (rpe === null) return null;
  if (!Number.isFinite(loadKg) || !Number.isFinite(reps) || !Number.isFinite(rpe)) return null;
  if (loadKg <= 0 || reps < 1) return null;
  if (rpe < 0 || rpe > 10) return null;
  const pct = targetPct(reps, rpe);
  if (!Number.isFinite(pct) || pct <= 0) return null;
  return loadKg / pct;
}

/**
 * Collapses logged sets into one point per session — the highest estimate that
 * session produced. Sets yielding `null` contribute nothing; a session in which
 * every set was logged without an RPE produces no point at all rather than a
 * zero or a gap-filled value.
 *
 * Deterministic: ties resolve to the lowest `set_id`, and the result is ordered
 * by `session_date` then `session_id`. Pure — the input array is not mutated.
 */
export function bestPerSession(sets: readonly E1rmSetInput[]): E1rmPoint[] {
  const best = new Map<number, E1rmPoint>();
  for (const s of sets) {
    const e1rm = estimateOneRepMax(s.load_kg, s.reps, s.rpe);
    if (e1rm === null) continue;
    const current = best.get(s.session_id);
    // Strictly greater keeps the FIRST set that reached the maximum; the
    // set_id tie-break below makes that independent of input order.
    if (current === undefined
      || e1rm > current.e1rm_kg
      || (e1rm === current.e1rm_kg && s.set_id < current.set_id)) {
      best.set(s.session_id, {
        session_id: s.session_id,
        session_date: s.session_date,
        set_id: s.set_id,
        e1rm_kg: e1rm,
      });
    }
  }
  return [...best.values()].sort((a, b) => (
    a.session_date === b.session_date
      ? a.session_id - b.session_id
      : (a.session_date < b.session_date ? -1 : 1)
  ));
}
