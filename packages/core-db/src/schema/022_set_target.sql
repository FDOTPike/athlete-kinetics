-- =============================================================================
-- 022_set_target.sql
-- Phase 13 Step 5: durable prescribed-target provenance for the Kinematic Autopilot.
--
-- Idempotency: all four tables use CREATE TABLE IF NOT EXISTS. The rename-copy
-- upgrade pattern from the draft was removed because it destroyed
-- session_plan_slot_id values on any re-application (self-heal, user_version
-- regression). A true IF NOT EXISTS is a complete no-op on a complete-schema
-- database, which is the correct behaviour.
--
-- FK policy for snapshot identifiers:
--   source_planned_session_id and source_planned_slot_id are stored as plain
--   INTEGER (no FK). An ON DELETE SET NULL FK would contradict the CHECK
--   requiring them non-null for planned/substituted/day_swapped rows. An ON
--   DELETE RESTRICT FK would block training-block wipe via the cascade chain:
--   training_block -> planned_session -> planned_slot. Neither is acceptable.
--   The values are immutable provenance snapshots frozen at session-start; they
--   do not need live referential enforcement.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- session_origin: records whether a session followed a planned session or was
-- started free-form. source_planned_session_id is a snapshot integer — no FK.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_origin (
  session_id                 INTEGER PRIMARY KEY REFERENCES session ON DELETE CASCADE,
  origin_kind                TEXT NOT NULL CHECK(origin_kind IN ('planned', 'free_form')),
  source_planned_session_id  INTEGER,
  CHECK (
    (origin_kind = 'planned'   AND source_planned_session_id IS NOT NULL)
    OR (origin_kind = 'free_form' AND source_planned_session_id IS NULL)
  )
) STRICT;

-- ---------------------------------------------------------------------------
-- session_plan_slot: the frozen plan shown to the athlete at session start.
-- source_planned_slot_id is a snapshot integer — no FK (same rationale above).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_plan_slot (
  session_plan_slot_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id                 INTEGER NOT NULL REFERENCES session ON DELETE CASCADE,
  slot_index                 INTEGER NOT NULL,
  movement_id                INTEGER NOT NULL REFERENCES movement ON DELETE CASCADE,
  planned_sets               INTEGER NOT NULL CHECK(planned_sets >= 1),
  planned_reps               INTEGER CHECK(planned_reps IS NULL OR planned_reps BETWEEN 1 AND 100),
  provenance_kind            TEXT NOT NULL CHECK(provenance_kind IN ('planned', 'substituted', 'day_swapped', 'added', 'free_form')),
  target_rpe                 REAL CHECK(target_rpe IS NULL OR target_rpe BETWEEN 5.0 AND 10.0),
  source_planned_slot_id     INTEGER,
  original_movement_id       INTEGER REFERENCES movement ON DELETE SET NULL,
  original_session_date      TEXT,
  override_load_kg           REAL,
  override_reason            TEXT,
  UNIQUE(session_id, slot_index),
  CHECK (
    (provenance_kind IN ('planned','substituted','day_swapped') AND target_rpe IS NOT NULL AND source_planned_slot_id IS NOT NULL)
    OR (provenance_kind IN ('free_form', 'added') AND target_rpe IS NULL AND source_planned_slot_id IS NULL)
  )
) STRICT;

CREATE INDEX IF NOT EXISTS idx_session_plan_slot_session ON session_plan_slot(session_id);

-- ---------------------------------------------------------------------------
-- planned_slot_disposition: tracks when a planned slot was consumed or swapped
-- into a different session (day-swap). FK to planned_slot is CASCADE because
-- planned_slot_disposition has no value without its parent slot.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS planned_slot_disposition (
  planned_slot_id            INTEGER PRIMARY KEY REFERENCES planned_slot ON DELETE CASCADE,
  disposition                TEXT NOT NULL CHECK(disposition IN ('swapped', 'consumed')),
  session_id                 INTEGER REFERENCES session ON DELETE CASCADE
) STRICT;

-- ---------------------------------------------------------------------------
-- set_target: immutable per-set provenance snapshot written atomically with
-- set_record at log time. source_planned_slot_id is a snapshot integer — no FK.
-- session_plan_slot_id FK is safe: session_plan_slot is session-scoped and
-- deleted together with set_record when the session is deleted.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS set_target (
  set_id                     INTEGER PRIMARY KEY REFERENCES set_record ON DELETE CASCADE,
  session_plan_slot_id       INTEGER REFERENCES session_plan_slot ON DELETE SET NULL,
  provenance_kind            TEXT NOT NULL CHECK(provenance_kind IN ('planned', 'substituted', 'day_swapped', 'added', 'free_form')),
  target_rpe                 REAL CHECK(target_rpe IS NULL OR target_rpe BETWEEN 5.0 AND 10.0),
  source_planned_slot_id     INTEGER,
  created_at_ms              INTEGER NOT NULL DEFAULT 0,
  CHECK (
    (provenance_kind IN ('planned','substituted','day_swapped') AND target_rpe IS NOT NULL)
    OR (provenance_kind = 'free_form' AND target_rpe IS NULL)
    OR (provenance_kind = 'added')
  )
) STRICT;
