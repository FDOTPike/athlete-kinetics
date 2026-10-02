-- =============================================================================
-- 065_session_preparation.sql
--
-- Movement preparation as a durable side-car of a LIVE session.
--
-- The four runner phases (023: working / resting / complete / halted) are left
-- exactly as they are. Preparation is not a fifth phase: it is its own frozen,
-- versioned protocol with its own truthful outcome, created in the same
-- transaction that inserts the session.
--
-- What these tables are NOT:
--   * not training volume: nothing here is a set_record row, so preparation
--     can never feed mech_daily, a lifting record or APRE progression;
--   * not history that can be invented later: a protocol can only be inserted
--     for a session that is live (started, not finished) at that moment, so a
--     completed, imported or demo session reads "not recorded";
--   * not transferable: session.session_id is INTEGER PRIMARY KEY with no
--     AUTOINCREMENT, so ids are reused after a reset. A protocol is bound to
--     the session's own started_at_ms and to a per-protocol instance id, and
--     every write names that instance, so a revision number alone can never
--     let a NEW session with a reused id pick up an OLD session's preparation.
--
-- Filename: 065 is the next unused schema filename (the chain's 64th entry;
-- user_version counts entries, not filename suffixes). The animation lane's
-- drafted incline-raise content correction is not applied and reserves
-- nothing; it takes the next unused filename when it lands.
-- =============================================================================

CREATE TABLE IF NOT EXISTS session_preparation (
  session_id             INTEGER PRIMARY KEY REFERENCES session ON DELETE CASCADE,
  instance_id            TEXT NOT NULL UNIQUE CHECK (length(instance_id) BETWEEN 8 AND 80),
  session_started_at_ms  INTEGER NOT NULL CHECK (session_started_at_ms >= 0),
  policy_id              TEXT NOT NULL CHECK (length(trim(policy_id)) >= 1 AND length(policy_id) <= 80),
  policy_revision        INTEGER NOT NULL CHECK (policy_revision >= 1),
  protocol_version       INTEGER NOT NULL CHECK (protocol_version >= 1),
  protocol_json          TEXT NOT NULL CHECK (json_valid(protocol_json) AND length(protocol_json) <= 60000),
  item_count             INTEGER NOT NULL CHECK (item_count BETWEEN 1 AND 20),
  estimate_low_seconds   INTEGER NOT NULL CHECK (estimate_low_seconds BETWEEN 1 AND 7200),
  estimate_high_seconds  INTEGER NOT NULL CHECK (estimate_high_seconds BETWEEN 1 AND 7200),
  status                 TEXT NOT NULL CHECK (status IN
                           ('pending','in_progress','completed','modified','already_warm','skipped','stopped')),
  revision               INTEGER NOT NULL CHECK (revision >= 1),
  created_at_ms          INTEGER NOT NULL CHECK (created_at_ms >= 0),
  updated_at_ms          INTEGER NOT NULL CHECK (updated_at_ms >= created_at_ms),
  finished_at_ms         INTEGER CHECK (finished_at_ms IS NULL OR finished_at_ms >= created_at_ms),
  CHECK (estimate_low_seconds <= estimate_high_seconds),
  CHECK ((status IN ('pending','in_progress') AND finished_at_ms IS NULL)
      OR (status NOT IN ('pending','in_progress') AND finished_at_ms IS NOT NULL))
) STRICT;

CREATE TABLE IF NOT EXISTS session_preparation_item (
  session_id         INTEGER NOT NULL REFERENCES session_preparation(session_id) ON DELETE CASCADE,
  item_index         INTEGER NOT NULL CHECK (item_index BETWEEN 0 AND 19),
  item_id            TEXT NOT NULL CHECK (length(trim(item_id)) >= 1 AND length(item_id) <= 80),
  item_revision      INTEGER NOT NULL CHECK (item_revision >= 1),
  movement_id        INTEGER REFERENCES movement(movement_id),
  prescribed_kind    TEXT NOT NULL CHECK (prescribed_kind IN ('time','reps','ramp')),
  prescribed_amount  INTEGER NOT NULL CHECK (prescribed_amount BETWEEN 1 AND 3600),
  per_side           INTEGER NOT NULL CHECK (per_side IN (0, 1)),
  status             TEXT NOT NULL CHECK (status IN
                       ('pending','done','modified','substituted','skipped','withheld')),
  performed_amount   INTEGER CHECK (performed_amount IS NULL OR performed_amount BETWEEN 0 AND 3600),
  performed_load_kg  REAL CHECK (performed_load_kg IS NULL OR performed_load_kg BETWEEN 0 AND 500),
  substitution_text  TEXT CHECK (substitution_text IS NULL
                                 OR (length(trim(substitution_text)) >= 1 AND length(substitution_text) <= 200)),
  reason_code        TEXT CHECK (reason_code IS NULL OR reason_code IN
                       ('athlete_choice','discomfort','restricted_at_execution','no_time')),
  -- 1 when the performed dose is well above the prescribed one: that is work
  -- or practice volume and is shown as such, never folded into "warm-up".
  extra_work         INTEGER NOT NULL DEFAULT 0 CHECK (extra_work IN (0, 1)),
  updated_at_ms      INTEGER NOT NULL CHECK (updated_at_ms >= 0),
  PRIMARY KEY (session_id, item_index),
  -- An item's record must say what actually happened.
  CHECK (
    (status = 'pending'
      AND performed_amount IS NULL AND performed_load_kg IS NULL
      AND substitution_text IS NULL AND reason_code IS NULL AND extra_work = 0)
    OR (status = 'done'
      AND performed_amount = prescribed_amount AND substitution_text IS NULL AND extra_work = 0)
    OR (status = 'modified'
      AND performed_amount IS NOT NULL AND performed_amount <> prescribed_amount
      AND substitution_text IS NULL)
    OR (status = 'substituted'
      AND substitution_text IS NOT NULL)
    OR (status IN ('skipped','withheld')
      AND performed_amount IS NULL AND performed_load_kg IS NULL
      AND substitution_text IS NULL AND reason_code IS NOT NULL AND extra_work = 0)
  )
) STRICT, WITHOUT ROWID;

-- A protocol exists only for a session that is live right now, and it starts
-- pending at revision 1. Completed, imported and demo sessions carry a
-- duration and can therefore never acquire a fabricated preparation record.
CREATE TRIGGER IF NOT EXISTS trg_session_preparation_live_session_bi
BEFORE INSERT ON session_preparation
WHEN NEW.status <> 'pending' OR NEW.revision <> 1
  OR NOT EXISTS (
    SELECT 1 FROM session s
    WHERE s.session_id = NEW.session_id
      AND s.started_at_ms IS NOT NULL
      AND s.started_at_ms = NEW.session_started_at_ms
      AND s.duration_min IS NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'session_preparation: a protocol can only be created pending for a live session');
END;

-- The protocol and its binding to one session are frozen at creation.
CREATE TRIGGER IF NOT EXISTS trg_session_preparation_frozen_bu
BEFORE UPDATE OF session_id, instance_id, session_started_at_ms, policy_id, policy_revision,
                 protocol_version, protocol_json, item_count, estimate_low_seconds,
                 estimate_high_seconds, created_at_ms ON session_preparation
WHEN NEW.session_id <> OLD.session_id OR NEW.instance_id <> OLD.instance_id
  OR NEW.session_started_at_ms <> OLD.session_started_at_ms
  OR NEW.policy_id <> OLD.policy_id OR NEW.policy_revision <> OLD.policy_revision
  OR NEW.protocol_version <> OLD.protocol_version OR NEW.protocol_json <> OLD.protocol_json
  OR NEW.item_count <> OLD.item_count
  OR NEW.estimate_low_seconds <> OLD.estimate_low_seconds
  OR NEW.estimate_high_seconds <> OLD.estimate_high_seconds
  OR NEW.created_at_ms <> OLD.created_at_ms
BEGIN
  SELECT RAISE(ABORT, 'session_preparation: the frozen protocol is immutable');
END;

-- Every accepted write advances the revision by exactly one, an outcome is
-- final once recorded, and a started protocol never returns to pending.
-- The guard fires on ANY update, whatever columns the statement names, so a
-- write that touches only the timestamps cannot slip past it, and a row with
-- a recorded outcome accepts no further write at all (not even a new finish
-- time under the same status).
CREATE TRIGGER IF NOT EXISTS trg_session_preparation_transition_bu
BEFORE UPDATE ON session_preparation
WHEN NEW.revision <> OLD.revision + 1
  OR OLD.status NOT IN ('pending','in_progress')
  OR (OLD.status = 'in_progress' AND NEW.status = 'pending')
BEGIN
  SELECT RAISE(ABORT, 'session_preparation: invalid status or revision transition');
END;

-- What was prescribed for an item is as frozen as the protocol it came from.
CREATE TRIGGER IF NOT EXISTS trg_session_preparation_item_frozen_bu
BEFORE UPDATE OF session_id, item_index, item_id, item_revision, movement_id,
                 prescribed_kind, prescribed_amount, per_side ON session_preparation_item
WHEN NEW.session_id <> OLD.session_id OR NEW.item_index <> OLD.item_index
  OR NEW.item_id <> OLD.item_id OR NEW.item_revision <> OLD.item_revision
  OR NEW.movement_id IS NOT OLD.movement_id
  OR NEW.prescribed_kind <> OLD.prescribed_kind
  OR NEW.prescribed_amount <> OLD.prescribed_amount OR NEW.per_side <> OLD.per_side
BEGIN
  SELECT RAISE(ABORT, 'session_preparation_item: the prescribed item is immutable');
END;

-- Item records close with their protocol: after an outcome is recorded, what
-- the athlete did in preparation cannot be rewritten.
CREATE TRIGGER IF NOT EXISTS trg_session_preparation_item_open_bu
BEFORE UPDATE ON session_preparation_item
WHEN NOT EXISTS (
  SELECT 1 FROM session_preparation p
  WHERE p.session_id = NEW.session_id AND p.status IN ('pending','in_progress')
)
BEGIN
  SELECT RAISE(ABORT, 'session_preparation_item: preparation has already finished');
END;
