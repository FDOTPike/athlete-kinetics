-- =============================================================================
-- 070_session_feel.sql
-- How a finished session went, and why, in the athlete's own taps.
--
-- This slot was computed from max(schema files, movement manifest, coaching
-- manifest) + 1 at implementation time. It was not reserved in advance.
--
-- One row per session, written from the completion screen. It is a record and
-- nothing else: no engine reads it yet, and it changes no prescription, block
-- or progression. The typed post-session note stays where it has always been,
-- in session_note (009), saved word for word and never interpreted.
--
-- The reasons are columns, not a child table, so the whole rule ("a session
-- that went as planned has no reasons; any other answer has at least one")
-- is one CHECK on one table, with no trigger and no cross-table reference.
--
-- CONTRACT MIRROR (machine-checked by verify:outcomes):
--   * feel CHECK domain        <->  SESSION_FEEL_KINDS in
--                                   packages/inference/src/sessionFeel.ts
--   * reason_<name> columns    <->  SESSION_FEEL_REASONS, same names, same order
--
-- The answer may be corrected while the completion screen is open (the store
-- upserts), which is the same discipline as session_note.
-- =============================================================================
CREATE TABLE IF NOT EXISTS session_feel (
  session_id        INTEGER PRIMARY KEY REFERENCES session ON DELETE CASCADE,
  feel              TEXT NOT NULL CHECK (feel IN ('as_planned', 'harder', 'easier', 'stopped_early')),
  reason_pain       INTEGER NOT NULL DEFAULT 0 CHECK (reason_pain IN (0, 1)),
  reason_tired      INTEGER NOT NULL DEFAULT 0 CHECK (reason_tired IN (0, 1)),
  reason_unwell     INTEGER NOT NULL DEFAULT 0 CHECK (reason_unwell IN (0, 1)),
  reason_technique  INTEGER NOT NULL DEFAULT 0 CHECK (reason_technique IN (0, 1)),
  reason_equipment  INTEGER NOT NULL DEFAULT 0 CHECK (reason_equipment IN (0, 1)),
  reason_time       INTEGER NOT NULL DEFAULT 0 CHECK (reason_time IN (0, 1)),
  reason_felt_good  INTEGER NOT NULL DEFAULT 0 CHECK (reason_felt_good IN (0, 1)),
  reason_other      INTEGER NOT NULL DEFAULT 0 CHECK (reason_other IN (0, 1)),
  recorded_at_ms    INTEGER NOT NULL CHECK (recorded_at_ms >= 0),
  CHECK (
    (feel = 'as_planned'
      AND reason_pain + reason_tired + reason_unwell + reason_technique
        + reason_equipment + reason_time + reason_felt_good + reason_other = 0)
    OR (feel <> 'as_planned'
      AND reason_pain + reason_tired + reason_unwell + reason_technique
        + reason_equipment + reason_time + reason_felt_good + reason_other >= 1)
  )
) STRICT;
