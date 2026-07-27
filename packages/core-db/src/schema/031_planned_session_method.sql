-- =============================================================================
-- 031_planned_session_method.sql
-- Snapshot the loading method used when a routine template is frozen into a
-- planned session. The snapshot survives template deletion and lets APRE
-- finalization follow the session's method instead of the surrounding block.
-- =============================================================================

CREATE TABLE IF NOT EXISTS planned_session_method (
  planned_session_id  INTEGER PRIMARY KEY REFERENCES planned_session ON DELETE CASCADE,
  schema_type         TEXT NOT NULL CHECK (schema_type IN ('LINEAR','WAVE','STEP','APRE')),
  routine_template_id INTEGER REFERENCES routine_template ON DELETE SET NULL,
  template_name       TEXT NOT NULL CHECK (length(trim(template_name)) BETWEEN 1 AND 80),
  frozen_at_ms        INTEGER NOT NULL CHECK (frozen_at_ms >= 0)
) STRICT;