-- =============================================================================
-- 027_operational_safeguards.sql
-- Bounded history lookups and rollup-integrity guards.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_set_movement_latest
  ON set_record (movement_id, set_id DESC);

CREATE TRIGGER IF NOT EXISTS trg_session_date_guard_bu
BEFORE UPDATE OF session_date ON session
WHEN EXISTS (SELECT 1 FROM set_record WHERE session_id = OLD.session_id)
BEGIN
  SELECT RAISE(ABORT, 'session_date is immutable after sets are logged');
END;
