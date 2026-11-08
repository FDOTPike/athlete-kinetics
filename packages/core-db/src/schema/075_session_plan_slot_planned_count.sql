-- =============================================================================
-- 075_session_plan_slot_planned_count.sql
-- Issue #144: keep the set count a session slot was PLANNED with, when a swap
-- after logged sets overwrites session_plan_slot.planned_sets with the sets kept.
--
-- session_plan_slot.planned_sets stays the runner's executable count: the
-- checkpoint check in useStore (Session checkpoint no longer matches its frozen
-- plan) compares the two and is unchanged. This side-car holds the count the
-- athlete was given before the swap, so the workout and the summary can say
-- "1 of 2 sets, then swapped to <movement>".
--
-- A slot with no row here has no recorded original: every slot created before
-- this migration, and every slot that was never swapped after logged sets. The
-- screens fall back to today's wording for those. Nothing is inferred or
-- back-filled.
--
-- SIDE-CAR TABLE, NOT ALTER TABLE ... ADD COLUMN: the chain is append-only and
-- the self-heal path re-applies every migration, and ADD COLUMN throws on
-- re-apply (see 059, 071, 073, 074). Cascades with its session_plan_slot row.
-- =============================================================================
CREATE TABLE IF NOT EXISTS session_plan_slot_planned_count (
  session_plan_slot_id  INTEGER PRIMARY KEY REFERENCES session_plan_slot(session_plan_slot_id) ON DELETE CASCADE,
  original_planned_sets INTEGER NOT NULL CHECK (original_planned_sets >= 1)
) STRICT;
