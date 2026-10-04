-- =============================================================================
-- 033_goal_program.sql
-- Goal-program sidecars. Four-week training_block remains the audited atomic
-- unit; this layer stores a 1-8 block review horizon and forward preferences.
-- No historical block is backfilled or silently adopted.
-- =============================================================================

CREATE TABLE IF NOT EXISTS training_program (
  program_id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  objective                   TEXT NOT NULL CHECK (objective IN
                                ('strength','hypertrophy','power','endurance','gpp','hybrid','rehab','weight_loss')),
  start_date                  TEXT NOT NULL CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  horizon_kind                TEXT NOT NULL CHECK (horizon_kind IN ('weeks','date')),
  requested_review_date       TEXT CHECK (requested_review_date IS NULL OR requested_review_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  planned_end_date            TEXT NOT NULL CHECK (planned_end_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  planned_block_count         INTEGER NOT NULL CHECK (planned_block_count BETWEEN 1 AND 8),
  starting_macro_block_index  INTEGER NOT NULL CHECK (starting_macro_block_index BETWEEN 1 AND 8),
  schema_type                 TEXT NOT NULL CHECK (schema_type IN ('LINEAR','WAVE','STEP','APRE')),
  status                      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','review_due','archived')),
  created_at_ms               INTEGER NOT NULL CHECK (created_at_ms >= 0),
  updated_at_ms               INTEGER NOT NULL CHECK (updated_at_ms >= created_at_ms),
  CHECK (
    (horizon_kind = 'date' AND requested_review_date IS NOT NULL)
    OR (horizon_kind = 'weeks' AND requested_review_date IS NULL)
  )
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_training_program_one_current
  ON training_program ((1)) WHERE status IN ('active','review_due');

CREATE TABLE IF NOT EXISTS training_program_day (
  program_id  INTEGER NOT NULL REFERENCES training_program ON DELETE CASCADE,
  day_index   INTEGER NOT NULL CHECK (day_index BETWEEN 1 AND 7),
  focus       TEXT NOT NULL CHECK (focus IN ('lower','upper','full','conditioning','bjj')),
  PRIMARY KEY (program_id, day_index)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS training_program_movement_preference (
  program_id   INTEGER NOT NULL,
  day_index    INTEGER NOT NULL,
  slot_index   INTEGER NOT NULL CHECK (slot_index BETWEEN 1 AND 5),
  pattern      TEXT NOT NULL CHECK (pattern IN
                 ('squat','hinge','push_h','push_v','pull_h','pull_v','lunge','carry','rotation','isolation','locomotion')),
  movement_id  INTEGER NOT NULL REFERENCES movement ON DELETE RESTRICT,
  PRIMARY KEY (program_id, day_index, slot_index),
  UNIQUE (program_id, day_index, movement_id),
  FOREIGN KEY (program_id, day_index)
    REFERENCES training_program_day (program_id, day_index) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS training_block_program (
  block_id       INTEGER PRIMARY KEY REFERENCES training_block ON DELETE CASCADE,
  program_id     INTEGER NOT NULL REFERENCES training_program ON DELETE CASCADE,
  sequence_index INTEGER NOT NULL CHECK (sequence_index BETWEEN 1 AND 8),
  UNIQUE (program_id, sequence_index)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_training_block_program_program
  ON training_block_program (program_id, sequence_index);
