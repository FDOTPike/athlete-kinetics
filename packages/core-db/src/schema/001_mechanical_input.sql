-- =============================================================================
-- 001_mechanical_input.sql
-- Domain 1: MECHANICAL INPUT — periodization (macro/micro cycles), movement
-- library, sessions, sets, RPE, tonnage.
--
-- Conventions
--   * Calendar dates: ISO-8601 TEXT 'YYYY-MM-DD' (lexicographic == chronologic).
--   * Timestamps: INTEGER unix epoch milliseconds.
--   * All tables STRICT (type-enforced at insert).
--   * Run by the migration runner inside a single transaction.
--
-- Indexing strategy for this domain
--   * Hot write path is set_record INSERT during a live session: the
--     UNIQUE(session_id, movement_id, set_index) constraint doubles as the
--     per-session read index, so no extra index on session_id is needed.
--   * mech_daily is a trigger-maintained rollup clustered on date
--     (WITHOUT ROWID), so the State Vector never aggregates raw sets at
--     read time.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Periodization
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS macro_cycle (
  macro_cycle_id INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  goal           TEXT NOT NULL CHECK (goal IN
                   ('hypertrophy','strength','power','peaking','gpp','rehab')),
  start_date     TEXT NOT NULL CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  end_date       TEXT CHECK (end_date IS NULL OR end_date >= start_date),
  notes          TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS micro_cycle (
  micro_cycle_id    INTEGER PRIMARY KEY,
  macro_cycle_id    INTEGER NOT NULL REFERENCES macro_cycle ON DELETE CASCADE,
  week_index        INTEGER NOT NULL CHECK (week_index >= 1),
  phase             TEXT NOT NULL CHECK (phase IN
                      ('accumulation','intensification','realization','deload')),
  target_tonnage_kg REAL CHECK (target_tonnage_kg IS NULL OR target_tonnage_kg >= 0),
  target_avg_rpe    REAL CHECK (target_avg_rpe IS NULL OR target_avg_rpe BETWEEN 0 AND 10),
  UNIQUE (macro_cycle_id, week_index)              -- also serves cycle->weeks lookups
) STRICT;

-- ---------------------------------------------------------------------------
-- Movement library (small, mostly static reference table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movement (
  movement_id    INTEGER PRIMARY KEY,
  name           TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pattern        TEXT NOT NULL CHECK (pattern IN
                   ('squat','hinge','push_h','push_v','pull_h','pull_v',
                    'lunge','carry','rotation','isolation','locomotion')),
  primary_muscle TEXT,
  is_compound    INTEGER NOT NULL DEFAULT 1 CHECK (is_compound IN (0, 1))
) STRICT;

-- ---------------------------------------------------------------------------
-- Sessions and sets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session (
  session_id     INTEGER PRIMARY KEY,
  micro_cycle_id INTEGER REFERENCES micro_cycle ON DELETE SET NULL,
  session_date   TEXT NOT NULL CHECK (session_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  started_at_ms  INTEGER,
  duration_min   REAL CHECK (duration_min IS NULL OR duration_min >= 0),
  session_rpe    REAL CHECK (session_rpe IS NULL OR session_rpe BETWEEN 0 AND 10)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_session_date  ON session (session_date);
CREATE INDEX IF NOT EXISTS idx_session_micro ON session (micro_cycle_id, session_date);

CREATE TABLE IF NOT EXISTS set_record (
  set_id           INTEGER PRIMARY KEY,
  session_id       INTEGER NOT NULL REFERENCES session  ON DELETE CASCADE,
  movement_id      INTEGER NOT NULL REFERENCES movement ON DELETE RESTRICT,
  set_index        INTEGER NOT NULL CHECK (set_index >= 1),
  reps             INTEGER NOT NULL CHECK (reps >= 0),
  load_kg          REAL    NOT NULL CHECK (load_kg >= 0),
  rpe              REAL CHECK (rpe IS NULL OR rpe BETWEEN 0 AND 10),
  mean_velocity_ms REAL CHECK (mean_velocity_ms IS NULL OR mean_velocity_ms >= 0),
  logged_at_ms     INTEGER NOT NULL,
  -- Tonnage is derived, never written by the app layer.
  tonnage_kg       REAL GENERATED ALWAYS AS (reps * load_kg) STORED,
  UNIQUE (session_id, movement_id, set_index)      -- doubles as per-session index
) STRICT;

-- Movement-history queries (e1RM trends, last-time-performed):
CREATE INDEX IF NOT EXISTS idx_set_movement ON set_record (movement_id, session_id);

-- ---------------------------------------------------------------------------
-- Daily mechanical rollup — trigger-maintained so State Vector reads are O(1).
-- rpe_x_reps / reps_with_rpe carry the sums needed for a weighted average RPE
-- without re-scanning set_record.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mech_daily (
  date          TEXT PRIMARY KEY,
  tonnage_kg    REAL    NOT NULL DEFAULT 0,
  total_reps    INTEGER NOT NULL DEFAULT 0,
  set_count     INTEGER NOT NULL DEFAULT 0,
  hard_sets     INTEGER NOT NULL DEFAULT 0,       -- rpe >= 8
  rpe_x_reps    REAL    NOT NULL DEFAULT 0,       -- sum(rpe * reps), rpe non-null
  reps_with_rpe INTEGER NOT NULL DEFAULT 0        -- sum(reps) where rpe non-null
) STRICT, WITHOUT ROWID;

CREATE TRIGGER IF NOT EXISTS trg_set_record_ai
AFTER INSERT ON set_record
BEGIN
  INSERT INTO mech_daily (date, tonnage_kg, total_reps, set_count,
                          hard_sets, rpe_x_reps, reps_with_rpe)
  SELECT s.session_date,
         NEW.reps * NEW.load_kg,
         NEW.reps,
         1,
         CASE WHEN NEW.rpe >= 8 THEN 1 ELSE 0 END,
         COALESCE(NEW.rpe, 0) * NEW.reps,
         CASE WHEN NEW.rpe IS NOT NULL THEN NEW.reps ELSE 0 END
  FROM session s
  WHERE s.session_id = NEW.session_id
  ON CONFLICT (date) DO UPDATE SET
    tonnage_kg    = tonnage_kg    + excluded.tonnage_kg,
    total_reps    = total_reps    + excluded.total_reps,
    set_count     = set_count     + excluded.set_count,
    hard_sets     = hard_sets     + excluded.hard_sets,
    rpe_x_reps    = rpe_x_reps    + excluded.rpe_x_reps,
    reps_with_rpe = reps_with_rpe + excluded.reps_with_rpe;
END;

CREATE TRIGGER IF NOT EXISTS trg_set_record_ad
AFTER DELETE ON set_record
BEGIN
  UPDATE mech_daily SET
    tonnage_kg    = tonnage_kg    - (OLD.reps * OLD.load_kg),
    total_reps    = total_reps    - OLD.reps,
    set_count     = set_count     - 1,
    hard_sets     = hard_sets     - (CASE WHEN OLD.rpe >= 8 THEN 1 ELSE 0 END),
    rpe_x_reps    = rpe_x_reps    - (COALESCE(OLD.rpe, 0) * OLD.reps),
    reps_with_rpe = reps_with_rpe - (CASE WHEN OLD.rpe IS NOT NULL THEN OLD.reps ELSE 0 END)
  WHERE date = (SELECT session_date FROM session WHERE session_id = OLD.session_id);
END;

CREATE TRIGGER IF NOT EXISTS trg_set_record_au
AFTER UPDATE OF reps, load_kg, rpe ON set_record
BEGIN
  UPDATE mech_daily SET
    tonnage_kg    = tonnage_kg    - (OLD.reps * OLD.load_kg) + (NEW.reps * NEW.load_kg),
    total_reps    = total_reps    - OLD.reps + NEW.reps,
    hard_sets     = hard_sets
                    - (CASE WHEN OLD.rpe >= 8 THEN 1 ELSE 0 END)
                    + (CASE WHEN NEW.rpe >= 8 THEN 1 ELSE 0 END),
    rpe_x_reps    = rpe_x_reps
                    - (COALESCE(OLD.rpe, 0) * OLD.reps)
                    + (COALESCE(NEW.rpe, 0) * NEW.reps),
    reps_with_rpe = reps_with_rpe
                    - (CASE WHEN OLD.rpe IS NOT NULL THEN OLD.reps ELSE 0 END)
                    + (CASE WHEN NEW.rpe IS NOT NULL THEN NEW.reps ELSE 0 END)
  WHERE date = (SELECT session_date FROM session WHERE session_id = NEW.session_id);
END;

-- Session deletion: FK cascade removes set_record rows AFTER the parent
-- session row is gone, so trg_set_record_ad's session_date subquery would
-- return NULL and never drain the rollup. Drain it here instead, BEFORE the
-- delete, while both session and sets still exist. The later cascade-fired
-- trg_set_record_ad updates then match no row (date = NULL) — no double-count.
CREATE TRIGGER IF NOT EXISTS trg_session_bd
BEFORE DELETE ON session
BEGIN
  UPDATE mech_daily SET
    tonnage_kg    = tonnage_kg    - COALESCE((SELECT total(reps * load_kg)        FROM set_record WHERE session_id = OLD.session_id), 0),
    total_reps    = total_reps    - COALESCE((SELECT total(reps)                  FROM set_record WHERE session_id = OLD.session_id), 0),
    set_count     = set_count     - COALESCE((SELECT count(*)                     FROM set_record WHERE session_id = OLD.session_id), 0),
    hard_sets     = hard_sets     - COALESCE((SELECT count(*)                     FROM set_record WHERE session_id = OLD.session_id AND rpe >= 8), 0),
    rpe_x_reps    = rpe_x_reps    - COALESCE((SELECT total(rpe * reps)            FROM set_record WHERE session_id = OLD.session_id AND rpe IS NOT NULL), 0),
    reps_with_rpe = reps_with_rpe - COALESCE((SELECT total(reps)                  FROM set_record WHERE session_id = OLD.session_id AND rpe IS NOT NULL), 0)
  WHERE date = OLD.session_date;
END;

-- NOTE: editing session.session_date after sets exist is not covered by the
-- delta triggers above; the nightly compaction job recomputes mech_daily for
-- any session whose date changed (rare path, kept out of the hot triggers).
