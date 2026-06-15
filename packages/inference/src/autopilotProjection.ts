/**
 * autopilotProjection.ts — Phase 13, Step 4: the State-Hydration projection that
 * turns a bounded, n+1-free SQL read of the trailing window into the flat
 * `PatternDailyDelta` arrays the Kinematic Autopilot's `F` (detectFlaws)
 * consumes. PURE and deterministic — the store runs exactly TWO grouped queries
 * (one per-(date,pattern) set aggregate, one windowed niggle scan) and feeds
 * their rows here; no per-day or per-pattern query cascade.
 *
 * PREMISE CORRECTION (Step 4): the mandate says "pull from mech_daily and
 * 015_set_prefix", but `mech_daily` is a DATE-keyed cross-movement rollup with a
 * single weighted RPE — it carries NO per-pattern dimension and cannot yield the
 * per-pattern ΔE the flaw detector needs. Per the derivation's §1 read budget
 * ("windowed set_record/niggle aggregates"), the per-pattern signal is sourced
 * from `set_record ⋈ session(date) ⋈ movement(pattern) ⋈ planned_slot(target_rpe,
 * matched by date+movement) ⋈ set_prefix(effective_load_kg)` plus `niggle`.
 * `mech_daily`/`state_vector` still provide the calendar + ACWR context (the
 * `stateVectors` arg to F). The raw rollup is READ-ONLY here — never rewritten.
 */
import { MOVEMENT_PATTERNS, type MovementPattern } from './types';
import { PATTERN_JOINTS, type Joint } from './substitution';
import type { PatternDailyDelta } from './kinematicAutopilot';

/** One grouped row per (date, pattern) from the store's set-aggregate query.
 *  The store pre-computes the per-set sums so F never re-scans raw sets. */
export interface WindowSetRow {
  /** ISO 'YYYY-MM-DD'. */
  date: string;
  pattern: MovementPattern;
  /** Count of logged sets for the pattern that day. */
  setCount: number;
  /** Σ over the day's sets of (set_record.rpe − planned_slot.target_rpe), taken
   *  only over sets with a non-null rpe AND a matched prescribed target. */
  sumDeltaRpe: number;
  /** Count of sets contributing to `sumDeltaRpe` (non-null rpe + matched target). */
  deltaCount: number;
  /** Σ over ALL the day's sets of 1/max(1, effective_load_kg/max(load_kg,0.01))
   *  — the per-set condition ATTENUATION (a set with no set_prefix row coalesces
   *  to ratio 1 ⇒ attenuation 1, so this sum is over `setCount` sets). */
  sumAttenuation: number;
}

/** One windowed niggle row (the store maps reported_at_ms → its calendar date). */
export interface WindowNiggleRow {
  date: string;
  region: Joint;
  severity: number;
}

const keyOf = (date: string, pattern: MovementPattern): string => `${date}|${pattern}`;

/**
 * Pivot the flat grouped rows into the per-pattern daily arrays aligned to the
 * window calendar (oldest-first). Gap-tolerant: a date with no sets for a
 * pattern yields setCount 0 / avgDeltaRPE null / avgAttenuation 0 — exactly the
 * "absent calendar days are zero-load days" convention F expects.
 *
 * O(windowDates × patterns) time, O(window) space — no allocation scales with
 * raw set history. Deterministic: only arithmetic and fixed iteration order.
 *
 * @param windowDates  the window's ISO dates, oldest first (defines the arrays' length).
 * @param setRows      grouped (date,pattern) set aggregates (any order).
 * @param niggleRows   windowed niggle rows (any order).
 */
export function buildPatternWindow(
  windowDates: readonly string[],
  setRows: readonly WindowSetRow[],
  niggleRows: readonly WindowNiggleRow[],
): Record<MovementPattern, PatternDailyDelta> {
  // Index the set aggregates by (date,pattern) for O(1) lookup.
  const setIndex = new Map<string, WindowSetRow>();
  for (const r of setRows) setIndex.set(keyOf(r.date, r.pattern), r);

  // Per-date, per-joint max severity (so a pattern's daily joint load is the max
  // over its loaded joints). date → (joint → maxSeverity).
  const jointByDate = new Map<string, Map<Joint, number>>();
  for (const n of niggleRows) {
    let m = jointByDate.get(n.date);
    if (m === undefined) { m = new Map<Joint, number>(); jointByDate.set(n.date, m); }
    const prev = m.get(n.region) ?? 0;
    if (n.severity > prev) m.set(n.region, n.severity);
  }

  const out = {} as Record<MovementPattern, PatternDailyDelta>;
  const L = windowDates.length;
  for (const p of MOVEMENT_PATTERNS) {
    const joints = PATTERN_JOINTS[p];
    const avgDeltaRPE: (number | null)[] = new Array(L).fill(null);
    const avgAttenuation: number[] = new Array(L).fill(0);
    const setCount: number[] = new Array(L).fill(0);
    const maxJointSev: number[] = new Array(L).fill(0);

    for (let i = 0; i < L; i++) {
      const date = windowDates[i];
      const row = setIndex.get(keyOf(date, p));
      if (row !== undefined) {
        setCount[i] = row.setCount;
        avgDeltaRPE[i] = row.deltaCount > 0 ? row.sumDeltaRpe / row.deltaCount : null;
        avgAttenuation[i] = row.setCount > 0 ? row.sumAttenuation / row.setCount : 0;
      }
      const jm = jointByDate.get(date);
      if (jm !== undefined) {
        let mx = 0;
        for (const j of joints) {
          const sev = jm.get(j) ?? 0;
          if (sev > mx) mx = sev;
        }
        maxJointSev[i] = mx;
      }
    }
    out[p] = { avgDeltaRPE, avgAttenuation, setCount, maxJointSev };
  }
  return out;
}
