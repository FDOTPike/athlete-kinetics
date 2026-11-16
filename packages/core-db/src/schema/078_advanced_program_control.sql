-- =============================================================================
-- 078_advanced_program_control.sql
-- Phase 2 (#228) + Owner A7: Advanced athlete program control side-cars.
--
-- Append-only STRICT side-cars because PRAGMA foreign_keys = OFF is ignored
-- inside migrationRunner's BEGIN...COMMIT transaction and existing tables
-- (training_program_day, planned_session, planned_slot, training_program) must
-- NEVER be dropped or rebuilt.
-- =============================================================================

-- Extended Q2 session foci ('push','pull','legs','accessories') paired with
-- base FK-compatible focus on training_program_day and planned_session.
CREATE TABLE IF NOT EXISTS training_program_day_focus_ext (
  program_id INTEGER NOT NULL,
  day_index  INTEGER NOT NULL,
  focus      TEXT NOT NULL CHECK (focus IN ('push','pull','legs','accessories')),
  PRIMARY KEY (program_id, day_index),
  FOREIGN KEY (program_id, day_index)
    REFERENCES training_program_day (program_id, day_index) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS planned_session_focus_ext (
  planned_session_id INTEGER PRIMARY KEY REFERENCES planned_session (planned_session_id) ON DELETE CASCADE,
  focus              TEXT NOT NULL CHECK (focus IN ('push','pull','legs','accessories'))
) STRICT;

-- Explicit Q3 schedule mode per program ('iso_weekday' vs legacy 'relative_day_index').
CREATE TABLE IF NOT EXISTS training_program_schedule_mode (
  program_id INTEGER PRIMARY KEY REFERENCES training_program (program_id) ON DELETE CASCADE,
  mode       TEXT NOT NULL CHECK (mode IN ('iso_weekday','relative_day_index'))
) STRICT;

-- Q1 athlete per-slot dose customization in Customize (sets [1..10], reps [1..30],
-- target_rpe [5.0..10.0]) for intermediate+ athletes.
CREATE TABLE IF NOT EXISTS training_program_slot_override (
  program_id INTEGER NOT NULL,
  day_index  INTEGER NOT NULL,
  slot_index INTEGER NOT NULL CHECK (slot_index BETWEEN 1 AND 6),
  sets       INTEGER CHECK (sets IS NULL OR (sets BETWEEN 1 AND 10)),
  reps       INTEGER CHECK (reps IS NULL OR (reps BETWEEN 1 AND 30)),
  target_rpe REAL CHECK (target_rpe IS NULL OR (target_rpe BETWEEN 5.0 AND 10.0)),
  PRIMARY KEY (program_id, day_index, slot_index),
  CHECK (sets IS NOT NULL OR reps IS NOT NULL OR target_rpe IS NOT NULL),
  FOREIGN KEY (program_id, day_index)
    REFERENCES training_program_day (program_id, day_index) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

-- Q1 saved routine day assigned to a program day across Weeks 1-3 (+ scaled Wk 4).
CREATE TABLE IF NOT EXISTS training_program_day_routine (
  program_id          INTEGER NOT NULL,
  day_index           INTEGER NOT NULL,
  routine_template_id INTEGER NOT NULL REFERENCES routine_template (routine_template_id) ON DELETE CASCADE,
  routine_day_index   INTEGER NOT NULL CHECK (routine_day_index BETWEEN 1 AND 7),
  PRIMARY KEY (program_id, day_index),
  FOREIGN KEY (program_id, day_index)
    REFERENCES training_program_day (program_id, day_index) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

-- Frozen provenance on planned_slot indicating explicit athlete Customize
-- control ('slot_override' | 'routine_assignment') and MRV ceiling status.
CREATE TABLE IF NOT EXISTS planned_slot_athlete_override (
  planned_slot_id  INTEGER PRIMARY KEY REFERENCES planned_slot (planned_slot_id) ON DELETE CASCADE,
  source           TEXT NOT NULL CHECK (source IN ('slot_override','routine_assignment')),
  mrv_ceiling_sets INTEGER CHECK (mrv_ceiling_sets IS NULL OR (mrv_ceiling_sets BETWEEN 1 AND 10)),
  above_mrv        INTEGER NOT NULL DEFAULT 0 CHECK (above_mrv IN (0, 1))
) STRICT;
