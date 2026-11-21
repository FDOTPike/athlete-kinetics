-- =============================================================================
-- 074_session_feel_reasons.sql
-- Session feel (070): a reason is required only for "Harder than planned", and
-- harder and easier have their own reason lists (issue #220).
--
-- Still a record only: no engine reads session_feel or this side-car, and
-- nothing here changes a prescription, block or progression.
--
-- TWO CHANGES
--
-- 1. session_feel is rebuilt with a looser CHECK. 070 required at least one
--    reason for every answer but "as planned". Now only "harder" needs one,
--    and that reason may be one of the new ones below, which live in another
--    table, so the database keeps only the half of the rule it can see in one
--    row: "as planned" has no reasons. The "harder needs a reason" half is
--    validateSessionFeel (packages/inference/src/sessionFeel.ts), applied by
--    the store before every write. The rebuild copies every column of every
--    row unchanged (no WHERE, no OR IGNORE): every row 070 accepted satisfies
--    the looser CHECK. It follows 061: a staging table created IF NOT EXISTS,
--    a bare copy, DROP, RENAME, so a re-apply (including the sentinel
--    self-heal, which replays the chain from zero) re-copies the same rows.
--
-- 2. Three new reasons are columns of a side-car table, not ALTER TABLE ...
--    ADD COLUMN on session_feel: ADD COLUMN throws on re-apply (see 012, 059,
--    073). A row exists only for a session with at least one new reason. It
--    references session, not session_feel, so the rebuild above (which drops
--    session_feel on every replay) can never cascade into it.
--
-- CONTRACT MIRROR (machine-checked by verify:outcomes):
--   SESSION_FEEL_REASONS = the reason_<name> columns of session_feel (070),
--   then those of session_feel_extra_reason (below), same names, same order.
-- =============================================================================

CREATE TABLE IF NOT EXISTS session_feel_074 (
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
    feel <> 'as_planned'
    OR reason_pain + reason_tired + reason_unwell + reason_technique
      + reason_equipment + reason_time + reason_felt_good + reason_other = 0
  )
) STRICT;

-- Preserve every row exactly. No WHERE, no OR IGNORE: see above.
INSERT INTO session_feel_074 (session_id, feel, reason_pain, reason_tired, reason_unwell, reason_technique,
  reason_equipment, reason_time, reason_felt_good, reason_other, recorded_at_ms)
SELECT session_id, feel, reason_pain, reason_tired, reason_unwell, reason_technique,
  reason_equipment, reason_time, reason_felt_good, reason_other, recorded_at_ms
FROM session_feel;

DROP TABLE session_feel;

ALTER TABLE session_feel_074 RENAME TO session_feel;

CREATE TABLE IF NOT EXISTS session_feel_extra_reason (
  session_id          INTEGER PRIMARY KEY REFERENCES session ON DELETE CASCADE,
  reason_too_heavy    INTEGER NOT NULL DEFAULT 0 CHECK (reason_too_heavy IN (0, 1)),
  reason_too_light    INTEGER NOT NULL DEFAULT 0 CHECK (reason_too_light IN (0, 1)),
  reason_rested_well  INTEGER NOT NULL DEFAULT 0 CHECK (reason_rested_well IN (0, 1)),
  -- A row only for a session with at least one of these reasons.
  CHECK (reason_too_heavy + reason_too_light + reason_rested_well >= 1)
) STRICT;
