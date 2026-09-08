-- =============================================================================
-- 061_autopilot_attribution_convergence.sql
-- Domain: converge the TWO shipped 034 schemas onto the strict contract.
--
-- WHY THIS EXISTS
-- `034_autopilot_attribution.sql` was authored INDEPENDENTLY on two lineages
-- after they diverged at 4c5056f, under the same migration number, with
-- different CHECK constraints. It is absent at the merge-base, so neither copy
-- is "the" 034:
--
--   * RELAXED (this lineage, `ab42b0e`):
--       rpe_delta REAL CHECK (rpe_delta BETWEEN -0.5 AND 0.5)
--       reason    TEXT CHECK (reason IN ('eased','raised','held_safety'))
--
--   * STRICT (the master lineage, `7bebc15`): the same two columns plus
--       CHECK (rpe_delta IN (-0.5, 0.0, 0.5))          -- 0.5 grid, not a range
--       CHECK (rpe_delta <> 0.0 OR set_delta <> 0)     -- no all-zero row
--       CHECK (reason/sign agreement)                  -- see below
--
-- Migrations are `CREATE TABLE IF NOT EXISTS`, so a device that already ran
-- either build keeps whichever constraint set it first saw, FOREVER: a plain
-- merge of the two lineages leaves the field permanently bimodal, and the
-- looser devices silently accept rows the stricter devices reject. 034 itself
-- is shipped and may never be edited (migration contract), and 058 is
-- untouched here. So convergence has to be a NEW, append-only migration.
--
-- WHY STRICT WINS
-- The strict predicate is not aspirational — it is what the generator already
-- produces, machine-checkable from the code:
--
--   * `kinematicAutopilot.ts` builds every correction as
--     `dRpe_p: roundToHalf(clamp(rRpe, -0.5, 0.5))`, so the per-pattern RPE
--     correction is exactly one of {-0.5, 0.0, +0.5}.
--   * `blockGenerator.ts` clamps the BASE prescription to
--     [5.0, base_rpe_cap], rehab <= 7.0, on the 0.5 grid BEFORE the autopilot
--     runs. The autopilot then re-applies those same three clamps to
--     `slotRpe + dRpe_p`. Re-clamping a value that already satisfies a clamp
--     can only cancel the step, never overshoot it, so
--     `rpe_delta = slotRpe_after - slotRpe_before` is itself in
--     {-0.5, 0.0, +0.5}. The wider `BETWEEN -0.5 AND 0.5` range therefore
--     admits values (0.25, -0.1) that no code path can generate.
--   * The all-zero row is already suppressed at the writer.
--   * The reason/sign agreement is made STRUCTURAL by the companion change to
--     `blockGenerator.ts` (ported from PR #6): the attributed pair is derived
--     FROM the chosen reason rather than asserted alongside it.
--
-- So the strict contract describes reality and the relaxed one merely fails to
-- exclude impossibilities. Converging DOWN to relaxed would discard a real
-- invariant; converging UP to strict costs nothing that the writer can emit.
--
-- PRESERVE-EXACTLY / FAIL-CLOSED
-- The copy below is a bare `INSERT ... SELECT` of every column, so a row that
-- already satisfies the strict predicate crosses over BYTE-IDENTICAL: no
-- rounding, no coercion, no re-derivation, no defaulting.
--
-- A row that does NOT satisfy it is, by the analysis above, unreachable from
-- any shipped generator. Its existence would mean something we do not model
-- wrote to this table, so this migration must not guess. It deliberately has
-- NO `WHERE` clause and NO `OR IGNORE`: the strict table's own CHECKs reject
-- the row, the INSERT fails, the runner's per-migration transaction rolls
-- back, and the original table is left exactly as it was.
--
-- `user_version` is UNCHANGED by that rollback. It is an INDEX into the
-- MIGRATIONS array, not a migration's file number: this entry sits at index 59
-- of 60, so a device that reaches it reads 59 before the attempt and still
-- reads 59 after the failure. It does not advance to 60, and it never takes the
-- value 61. Nothing has been applied, so the next boot simply retries this
-- entry — which is what makes the failure recoverable by shipping a fix rather
-- than by touching the device's data.
--
-- That is the fail-closed outcome — the schema refuses to converge rather than
-- silently dropping, truncating, or rewriting athlete attribution it cannot
-- explain. The SQLite error names the violated CHECK, which identifies the
-- class of the offending row.
--
-- Idempotent: the staging table is created IF NOT EXISTS and renamed away on
-- success, so a re-apply (including the sentinel self-heal path, which
-- re-runs the whole chain from zero) simply re-converges an already-strict
-- table and is a no-op in effect. Ordering is append-only: 061 is appended
-- AFTER m060, so no device's positional `user_version` index is renumbered.
-- =============================================================================

-- Staging table carries the STRICT contract verbatim, matching the master
-- lineage's 034 column-for-column and CHECK-for-CHECK so that a device which
-- already has the strict shape converges to a byte-identical definition.
CREATE TABLE IF NOT EXISTS planned_slot_autopilot_061 (
  planned_slot_id INTEGER PRIMARY KEY REFERENCES planned_slot ON DELETE CASCADE,
  rpe_delta REAL NOT NULL CHECK (rpe_delta IN (-0.5, 0.0, 0.5)),
  set_delta INTEGER NOT NULL CHECK (set_delta BETWEEN -1 AND 1),
  reason TEXT NOT NULL CHECK (reason IN ('eased','raised','held_safety')),
  -- Absence of a row means "the autopilot did not change this slot"; an
  -- all-zero row would claim a change while describing none.
  CHECK (rpe_delta <> 0.0 OR set_delta <> 0),
  -- 'raised' may only ever accompany non-negative movement, and the two easing
  -- reasons only non-positive movement. A mixed-sign row satisfies no reason.
  CHECK (
    (reason = 'raised' AND rpe_delta >= 0.0 AND set_delta >= 0)
    OR
    (reason IN ('eased','held_safety') AND rpe_delta <= 0.0 AND set_delta <= 0)
  )
) STRICT;

-- Preserve every surviving row exactly. No WHERE, no OR IGNORE: see above.
INSERT INTO planned_slot_autopilot_061 (planned_slot_id, rpe_delta, set_delta, reason)
SELECT planned_slot_id, rpe_delta, set_delta, reason
FROM planned_slot_autopilot;

DROP TABLE planned_slot_autopilot;

ALTER TABLE planned_slot_autopilot_061 RENAME TO planned_slot_autopilot;
