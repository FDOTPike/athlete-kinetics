-- =============================================================================
-- 029_routine_history_analytics.sql
-- Durable pre-session routine templates, staged history imports, provenance,
-- and measured local analytics. Imported rows stay separate from live sessions
-- so unverified data cannot affect readiness or session-outcome contracts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS routine_template (
  routine_template_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  schema_type         TEXT NOT NULL CHECK (schema_type IN ('LINEAR','WAVE','STEP','APRE')),
  created_at_ms       INTEGER NOT NULL CHECK (created_at_ms >= 0),
  updated_at_ms       INTEGER NOT NULL CHECK (updated_at_ms >= created_at_ms)
) STRICT;

CREATE TABLE IF NOT EXISTS routine_template_slot (
  routine_template_slot_id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_template_id      INTEGER NOT NULL REFERENCES routine_template ON DELETE CASCADE,
  day_index                INTEGER NOT NULL CHECK (day_index BETWEEN 1 AND 7),
  slot_index               INTEGER NOT NULL CHECK (slot_index BETWEEN 1 AND 6),
  role                     TEXT NOT NULL CHECK (role IN ('major','supplementary','conditional')),
  movement_id              INTEGER NOT NULL REFERENCES movement ON DELETE RESTRICT,
  sets                     INTEGER NOT NULL CHECK (sets BETWEEN 1 AND 10),
  reps                     INTEGER NOT NULL CHECK (reps BETWEEN 1 AND 100),
  target_rpe               REAL NOT NULL CHECK (target_rpe BETWEEN 5.0 AND 10.0),
  UNIQUE (routine_template_id, day_index, slot_index)
) STRICT;
CREATE INDEX IF NOT EXISTS idx_routine_slot_template
  ON routine_template_slot (routine_template_id, day_index, slot_index);

CREATE TABLE IF NOT EXISTS history_import (
  history_import_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  content_fingerprint     TEXT NOT NULL UNIQUE CHECK (length(content_fingerprint) = 64),
  format_version     TEXT NOT NULL CHECK (format_version = 'AK_HISTORY_V1'),
  verified           INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0,1)),
  readiness_eligible INTEGER NOT NULL DEFAULT 0 CHECK (readiness_eligible IN (0,1)),
  created_at_ms      INTEGER NOT NULL CHECK (created_at_ms >= 0),
  CHECK (readiness_eligible = 0 OR verified = 1)
) STRICT;

CREATE TABLE IF NOT EXISTS history_import_session (
  history_import_session_id INTEGER PRIMARY KEY AUTOINCREMENT,
  history_import_id         INTEGER NOT NULL REFERENCES history_import ON DELETE CASCADE,
  source_ordinal            INTEGER NOT NULL CHECK (source_ordinal >= 1),
  session_date              TEXT NOT NULL CHECK (session_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  duration_min              REAL CHECK (duration_min IS NULL OR duration_min >= 0),
  session_rpe               REAL CHECK (session_rpe IS NULL OR session_rpe BETWEEN 0 AND 10),
  source_line               INTEGER NOT NULL CHECK (source_line >= 1),
  UNIQUE (history_import_id, source_ordinal)
) STRICT;
CREATE INDEX IF NOT EXISTS idx_history_import_session_date
  ON history_import_session (session_date, history_import_id);

CREATE TABLE IF NOT EXISTS history_import_set (
  history_import_set_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  history_import_session_id INTEGER NOT NULL REFERENCES history_import_session ON DELETE CASCADE,
  movement_id               INTEGER NOT NULL REFERENCES movement ON DELETE RESTRICT,
  set_index                 INTEGER NOT NULL CHECK (set_index >= 1),
  reps                      INTEGER NOT NULL CHECK (reps >= 0),
  load_kg                   REAL NOT NULL CHECK (load_kg >= 0),
  rpe                       REAL CHECK (rpe IS NULL OR rpe BETWEEN 0 AND 10),
  seconds                   INTEGER CHECK (seconds IS NULL OR seconds BETWEEN 1 AND 7200),
  source_line               INTEGER NOT NULL CHECK (source_line >= 1),
  UNIQUE (history_import_session_id, movement_id, set_index)
) STRICT;
CREATE INDEX IF NOT EXISTS idx_history_import_set_movement
  ON history_import_set (movement_id, history_import_session_id DESC);


CREATE TABLE IF NOT EXISTS history_import_capability_evidence (
  history_import_session_id INTEGER NOT NULL REFERENCES history_import_session ON DELETE CASCADE,
  movement_id               INTEGER NOT NULL REFERENCES movement ON DELETE CASCADE,
  qualifying_sets           INTEGER NOT NULL CHECK (qualifying_sets BETWEEN 0 AND 1000),
  minimum_value             INTEGER NOT NULL CHECK (minimum_value BETWEEN 0 AND 7200),
  maximum_rpe               REAL CHECK (maximum_rpe IS NULL OR maximum_rpe BETWEEN 0 AND 10),
  PRIMARY KEY (history_import_session_id, movement_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_history_import_capability_movement
  ON history_import_capability_evidence (movement_id, history_import_session_id);
CREATE TABLE IF NOT EXISTS import_readiness_daily (
  date       TEXT PRIMARY KEY CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  tonnage_kg REAL NOT NULL CHECK (tonnage_kg >= 0),
  updated_at_ms INTEGER NOT NULL CHECK (updated_at_ms >= 0)
) STRICT, WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS bodyweight_daily (
  date       TEXT PRIMARY KEY CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  weight_kg  REAL NOT NULL CHECK (weight_kg BETWEEN 20 AND 500),
  source     TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','health_connect','healthkit','import')),
  recorded_at_ms INTEGER NOT NULL CHECK (recorded_at_ms >= 0)
) STRICT, WITHOUT ROWID;

DROP VIEW IF EXISTS v_training_daily_all;
CREATE VIEW v_training_daily_all AS
SELECT date,
       SUM(tonnage_kg) AS tonnage_kg,
       SUM(total_reps) AS total_reps,
       SUM(set_count) AS set_count
FROM (
  SELECT date, tonnage_kg, total_reps, set_count FROM mech_daily
  UNION ALL
  SELECT hs.session_date,
         SUM(hset.reps * hset.load_kg),
         SUM(hset.reps),
         COUNT(*)
  FROM history_import_session hs
  JOIN history_import_set hset USING (history_import_session_id)
  GROUP BY hs.session_date
)
GROUP BY date;
