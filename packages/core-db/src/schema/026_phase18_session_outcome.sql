-- =============================================================================
-- 026_phase18_session_outcome.sql
-- Phase 18: neutral, immutable training-decision records.
--
-- This slot was computed from max(schema files, movement manifest, coaching
-- manifest) + 1 at implementation time. It was not reserved in advance.
--
-- 022 freezes plan-at-start provenance. set_dose_target complements it by
-- freezing the reps-or-seconds target displayed for each set at log time, so
-- a later slot substitution/day swap cannot rewrite earlier training truth.
-- No existing set is backfilled: absent evidence remains honestly absent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS set_dose_target (
  set_id          INTEGER PRIMARY KEY REFERENCES set_record ON DELETE CASCADE,
  target_kind     TEXT NOT NULL CHECK (target_kind IN ('reps', 'time')),
  target_reps     INTEGER CHECK (target_reps IS NULL OR target_reps BETWEEN 1 AND 100),
  target_seconds  INTEGER CHECK (target_seconds IS NULL OR target_seconds BETWEEN 1 AND 7200),
  CHECK (
    (target_kind = 'reps' AND target_reps IS NOT NULL AND target_seconds IS NULL)
    OR (target_kind = 'time' AND target_reps IS NULL AND target_seconds IS NOT NULL)
  )
) STRICT;

-- Snapshot rows are insert-once. The BEFORE INSERT guard also blocks
-- INSERT OR REPLACE, whose implicit delete can bypass delete triggers when
-- recursive triggers are disabled. Parent set deletion still cascades.
CREATE TRIGGER IF NOT EXISTS trg_set_dose_target_bi
BEFORE INSERT ON set_dose_target
WHEN EXISTS (SELECT 1 FROM set_dose_target WHERE set_id = NEW.set_id)
BEGIN
  SELECT RAISE(ABORT, 'set_dose_target is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_set_dose_target_bu
BEFORE UPDATE ON set_dose_target
BEGIN
  SELECT RAISE(ABORT, 'set_dose_target is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_set_dose_target_bd
BEFORE DELETE ON set_dose_target
WHEN EXISTS (SELECT 1 FROM set_record WHERE set_id = OLD.set_id)
BEGIN
  SELECT RAISE(ABORT, 'set_dose_target is immutable');
END;

CREATE TABLE IF NOT EXISTS session_outcome (
  session_id                    INTEGER PRIMARY KEY REFERENCES session ON DELETE CASCADE,
  outcome_kind                  TEXT NOT NULL CHECK (outcome_kind IN (
    'followed_plan', 'adapted_session', 'stopped_safely', 'session_recorded'
  )),
  terminal_phase                TEXT NOT NULL CHECK (terminal_phase IN ('complete', 'halted')),
  halt_reason                   TEXT CHECK (halt_reason IS NULL OR halt_reason IN ('manual', 'niggle', 'pain', 'safety')),
  origin_kind                   TEXT NOT NULL CHECK (origin_kind IN ('planned', 'free_form')),
  session_mode                  TEXT NOT NULL CHECK (session_mode IN ('guided', 'self_directed')),
  training_age                  TEXT NOT NULL CHECK (training_age IN ('beginner', 'intermediate', 'advanced', 'elite')),
  slot_count                    INTEGER NOT NULL,
  planned_set_count             INTEGER NOT NULL,
  logged_set_count              INTEGER NOT NULL,
  exact_dose_count              INTEGER NOT NULL,
  under_dose_count              INTEGER NOT NULL,
  over_dose_count               INTEGER NOT NULL,
  unknown_dose_count            INTEGER NOT NULL,
  unmapped_set_count            INTEGER NOT NULL,
  missing_set_count             INTEGER NOT NULL,
  missing_unskipped_set_count   INTEGER NOT NULL,
  extra_set_count               INTEGER NOT NULL,
  adapted_slot_count            INTEGER NOT NULL,
  skipped_slot_count            INTEGER NOT NULL,
  off_plan_slot_count           INTEGER NOT NULL,
  finalized_at_ms               INTEGER NOT NULL,
  engine_version                INTEGER NOT NULL,

  CHECK (
    slot_count >= 0
    AND planned_set_count >= 0
    AND logged_set_count >= 0
    AND exact_dose_count >= 0
    AND under_dose_count >= 0
    AND over_dose_count >= 0
    AND unknown_dose_count >= 0
    AND unmapped_set_count >= 0
    AND missing_set_count >= 0
    AND missing_unskipped_set_count >= 0
    AND extra_set_count >= 0
    AND adapted_slot_count >= 0
    AND skipped_slot_count >= 0
    AND off_plan_slot_count >= 0
    AND finalized_at_ms >= 0
    AND engine_version >= 1
  ),
  CHECK (
    (slot_count = 0 AND planned_set_count = 0)
    OR (slot_count > 0 AND planned_set_count >= slot_count)
  ),
  CHECK (adapted_slot_count <= slot_count),
  CHECK (skipped_slot_count <= adapted_slot_count),
  CHECK (off_plan_slot_count <= slot_count + unmapped_set_count),
  CHECK (planned_set_count <= slot_count * 100),
  CHECK (missing_set_count <= planned_set_count),
  CHECK (extra_set_count <= logged_set_count - unmapped_set_count),
  CHECK (missing_unskipped_set_count <= missing_set_count),
  CHECK (
    exact_dose_count + under_dose_count + over_dose_count
      + unknown_dose_count + unmapped_set_count = logged_set_count
  ),
  CHECK (
    logged_set_count - unmapped_set_count + missing_set_count
      = planned_set_count + extra_set_count
  ),
  CHECK (
    (outcome_kind = 'stopped_safely'
      AND terminal_phase = 'halted'
      AND halt_reason IS NOT NULL)
    OR (outcome_kind <> 'stopped_safely'
      AND terminal_phase = 'complete'
      AND halt_reason IS NULL)
  ),
  -- Empty manual stops/completions are disposable. Only a safety directive
  -- can produce a durable zero-set decision.
  CHECK (
    logged_set_count > 0
    OR (outcome_kind = 'stopped_safely' AND halt_reason IN ('niggle', 'pain', 'safety'))
  ),
  -- Positive labels fail closed here. session_recorded intentionally remains
  -- a valid neutral fallback; evaluateSessionOutcome is the exact classifier.
  CHECK (
    outcome_kind <> 'followed_plan'
    OR (
      origin_kind = 'planned'
      AND exact_dose_count = logged_set_count
      AND under_dose_count = 0
      AND over_dose_count = 0
      AND unknown_dose_count = 0
      AND unmapped_set_count = 0
      AND missing_set_count = 0
      AND extra_set_count = 0
      AND adapted_slot_count = 0
      AND skipped_slot_count = 0
      AND off_plan_slot_count = 0
    )
  ),
  CHECK (
    outcome_kind <> 'adapted_session'
    OR (
      origin_kind = 'planned'
      AND exact_dose_count = logged_set_count
      AND under_dose_count = 0
      AND over_dose_count = 0
      AND unknown_dose_count = 0
      AND unmapped_set_count = 0
      AND missing_unskipped_set_count = 0
      AND extra_set_count = 0
      AND off_plan_slot_count = 0
      AND adapted_slot_count > 0
      -- Necessary aggregate bound; the pure engine additionally proves that
      -- every individual skipped slot actually owns missing work.
      AND (skipped_slot_count = 0 OR missing_set_count >= skipped_slot_count)
    )
  )
) STRICT;

CREATE INDEX IF NOT EXISTS idx_session_outcome_finalized
  ON session_outcome (finalized_at_ms DESC, session_id DESC);

CREATE TRIGGER IF NOT EXISTS trg_session_outcome_bi
BEFORE INSERT ON session_outcome
WHEN EXISTS (SELECT 1 FROM session_outcome WHERE session_id = NEW.session_id)
BEGIN
  SELECT RAISE(ABORT, 'session_outcome is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_session_outcome_bu
BEFORE UPDATE ON session_outcome
BEGIN
  SELECT RAISE(ABORT, 'session_outcome is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_session_outcome_bd
BEFORE DELETE ON session_outcome
WHEN EXISTS (SELECT 1 FROM session WHERE session_id = OLD.session_id)
BEGIN
  SELECT RAISE(ABORT, 'session_outcome is immutable');
END;
