-- =============================================================================
-- 083_warmup_presets.sql
-- Personalised warm-up presets, ordered items, session-type defaults, and
-- per-planned-session warm-up overrides.
-- =============================================================================

CREATE TABLE IF NOT EXISTS warmup_preset (
  preset_id         INTEGER PRIMARY KEY,
  name              TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
  purpose           TEXT NOT NULL CHECK (purpose IN ('gpp','prehab','rehab')),
  weakness_target   TEXT CHECK (weakness_target IS NULL OR weakness_target IN (
    'elbow_tendon','shoulder_cuff','knee_patellar','achilles_calf','hip_groin','low_back_core','wrist_forearm',
    'upper_chest','mid_lower_chest','front_shoulders','side_shoulders','rear_shoulders','lats','upper_back','traps',
    'biceps','triceps','forearms','quadriceps','hamstrings','glutes','calves','abs','lower_back'
  )),
  include_ramp_sets INTEGER NOT NULL DEFAULT 1 CHECK (include_ramp_sets IN (0, 1)),
  created_at_ms     INTEGER NOT NULL CHECK (created_at_ms >= 0),
  updated_at_ms     INTEGER NOT NULL CHECK (updated_at_ms >= created_at_ms)
) STRICT;

CREATE TABLE IF NOT EXISTS warmup_preset_item (
  preset_id        INTEGER NOT NULL REFERENCES warmup_preset(preset_id) ON DELETE CASCADE,
  item_order       INTEGER NOT NULL CHECK (item_order BETWEEN 0 AND 11),
  source_kind      TEXT NOT NULL CHECK (source_kind IN ('catalog_drill','prehab_target','library_movement','custom_physio')),
  catalog_drill_id TEXT CHECK (catalog_drill_id IS NULL OR length(trim(catalog_drill_id)) BETWEEN 1 AND 80),
  prehab_target_id TEXT CHECK (prehab_target_id IS NULL OR prehab_target_id IN (
    'elbow_tendon','shoulder_cuff','knee_patellar','achilles_calf','hip_groin','low_back_core','wrist_forearm'
  )),
  movement_id      INTEGER REFERENCES movement(movement_id),
  title            TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  sets             INTEGER NOT NULL DEFAULT 1 CHECK (sets BETWEEN 1 AND 5),
  dose_kind        TEXT NOT NULL CHECK (dose_kind IN ('reps','time')),
  dose_amount      INTEGER NOT NULL,
  per_side         INTEGER NOT NULL DEFAULT 0 CHECK (per_side IN (0, 1)),
  cue_note         TEXT CHECK (cue_note IS NULL OR length(trim(cue_note)) BETWEEN 1 AND 240),
  PRIMARY KEY (preset_id, item_order),
  CHECK ((dose_kind = 'reps' AND dose_amount BETWEEN 1 AND 100) OR (dose_kind = 'time' AND dose_amount BETWEEN 5 AND 1800)),
  CHECK (
    (source_kind = 'catalog_drill' AND catalog_drill_id IS NOT NULL AND prehab_target_id IS NULL AND movement_id IS NULL)
    OR (source_kind = 'prehab_target' AND prehab_target_id IS NOT NULL AND catalog_drill_id IS NULL)
    OR (source_kind = 'library_movement' AND movement_id IS NOT NULL AND catalog_drill_id IS NULL AND prehab_target_id IS NULL)
    OR (source_kind = 'custom_physio' AND catalog_drill_id IS NULL AND prehab_target_id IS NULL AND movement_id IS NULL)
  )
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS warmup_session_type_assignment (
  session_type  TEXT PRIMARY KEY CHECK (session_type IN (
    'default','upper','lower','full','push','pull','legs','accessories','conditioning','bjj','free_form'
  )),
  preset_id     INTEGER NOT NULL REFERENCES warmup_preset(preset_id) ON DELETE CASCADE,
  updated_at_ms INTEGER NOT NULL CHECK (updated_at_ms >= 0)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS planned_session_warmup_override (
  planned_session_id INTEGER PRIMARY KEY REFERENCES planned_session(planned_session_id) ON DELETE CASCADE,
  mode               TEXT NOT NULL CHECK (mode IN ('preset','standard_auto')),
  preset_id          INTEGER REFERENCES warmup_preset(preset_id) ON DELETE CASCADE,
  updated_at_ms      INTEGER NOT NULL CHECK (updated_at_ms >= 0),
  CHECK ((mode = 'preset' AND preset_id IS NOT NULL) OR (mode = 'standard_auto' AND preset_id IS NULL))
) STRICT;
