-- =============================================================================
-- 078_session_slot_swap_cause.sql
-- Issue #208: record why a session slot was swapped (`cause`) and its persistence
-- scope (`today_only` vs `rest_of_block`) in an idempotent additive side-car.
--
-- Why a side-car table instead of ALTER TABLE / DROP+RENAME:
--   migrationRunner.ts executes inside BEGIN...COMMIT where PRAGMA foreign_keys
--   = OFF is ignored, so dropping tables with incoming CASCADE/RESTRICT FKs is
--   unsafe, and ALTER TABLE ADD COLUMN throws on idempotent replay (see 073,
--   075, 077). Side-cars compose cleanly and cascade with `session_plan_slot`.
--
-- Contract:
--   * `cause IN ('equipment_busy', 'preference', 'time', 'joint_discomfort', 'other')`:
--     neutral reasons (`equipment_busy`, `preference`, `time`) never trigger
--     Phase 1 Mechanism 1 Avoid (-1) promotions or write `-1` to 010.
--   * `scope IN ('today_only', 'rest_of_block')`: distinguishes single-session
--     swaps from block-wide swaps across remaining unstarted `planned_slot` rows.
-- =============================================================================
CREATE TABLE IF NOT EXISTS session_slot_swap_cause (
  session_plan_slot_id             INTEGER PRIMARY KEY REFERENCES session_plan_slot(session_plan_slot_id) ON DELETE CASCADE,
  cause                            TEXT NOT NULL CHECK (cause IN ('equipment_busy', 'preference', 'time', 'joint_discomfort', 'other')),
  scope                            TEXT NOT NULL CHECK (scope IN ('today_only', 'rest_of_block')),
  replaced_movement_id             INTEGER REFERENCES movement(movement_id),
  replaced_by_session_plan_slot_id INTEGER REFERENCES session_plan_slot(session_plan_slot_id) ON DELETE SET NULL,
  recorded_at_ms                   INTEGER NOT NULL CHECK (recorded_at_ms >= 0)
) STRICT;
