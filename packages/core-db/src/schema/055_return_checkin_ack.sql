-- 055_return_checkin_ack.sql
-- Acknowledgement ledger for the optional 21-day return check-in.
-- Ratified in Calibration Policy v1 (Section 4).
--
-- Records ONLY that the athlete acknowledged a detected gap and which of the two
-- truthful actions they chose. Numerical return modifiers remain deferred, so no
-- applied-dose column exists here by design.
--
-- Keyed on the last qualifying training date: one row per DETECTED GAP, so an
-- INSERT OR IGNORE suppresses duplicate prompts for that same gap while a later
-- gap (a new qualifying session, then another layoff) prompts again.

CREATE TABLE IF NOT EXISTS return_checkin_ack (
  last_qualifying_date TEXT NOT NULL PRIMARY KEY
                            CHECK (last_qualifying_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  acknowledged_action  TEXT NOT NULL
                            CHECK (acknowledged_action IN ('continue_plan', 'review_first_session')),
  acknowledged_at_ms   INTEGER NOT NULL
) STRICT;
