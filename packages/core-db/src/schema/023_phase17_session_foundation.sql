-- =============================================================================
-- 023_phase17_session_foundation.sql
-- Phase 17: durable data contracts for utility-first guided sessions.
--
-- This migration deliberately defines storage and conservative defaults only.
-- Coaching prose remains curator-owned and is inserted by a later, reviewed
-- additive migration; no placeholder advice or video metadata is fabricated
-- here. All tables are side-cars because shipped parent tables are frozen.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Immutable, curator-owned explanation of why a movement is in the program.
-- A row is added only after its copy has been reviewed; absence is distinct
-- from an invented generic explanation.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movement_coaching_intent (
  movement_id      INTEGER PRIMARY KEY REFERENCES movement ON DELETE CASCADE,
  coaching_intent  TEXT NOT NULL CHECK (length(trim(coaching_intent)) BETWEEN 1 AND 160)
) STRICT;

-- ---------------------------------------------------------------------------
-- Time-mode policy. Its values are planning defaults, never live mutable
-- targets: planners copy them into planned_slot_target and session_slot_target
-- so a later policy change cannot rewrite a session already prescribed.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movement_time_policy (
  movement_id      INTEGER PRIMARY KEY REFERENCES movement ON DELETE CASCADE,
  default_sets     INTEGER NOT NULL CHECK (default_sets BETWEEN 1 AND 10),
  target_seconds   INTEGER NOT NULL CHECK (target_seconds BETWEEN 1 AND 7200)
) STRICT;

INSERT OR IGNORE INTO movement_time_policy (movement_id, default_sets, target_seconds)
SELECT m.movement_id, e.column2, e.column3
FROM (VALUES
  ('Plank',              3, 30),
  ('Farmer Carry',       3, 40),
  ('Suitcase Carry',     3, 40),
  ('Road Run',           1, 1200),
  ('BJJ Sparring Round', 5, 300)
) AS e
JOIN movement m ON m.name = e.column1;

-- ---------------------------------------------------------------------------
-- Frozen targets for block-plan and session-plan slots. Existing reps columns
-- remain the compatibility source for legacy callers; Phase 17 code writes a
-- side-car for every new slot, making reps-vs-time explicit and immutable.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS planned_slot_target (
  planned_slot_id  INTEGER PRIMARY KEY REFERENCES planned_slot ON DELETE CASCADE,
  target_kind      TEXT NOT NULL CHECK (target_kind IN ('reps', 'time')),
  target_reps      INTEGER CHECK (target_reps IS NULL OR target_reps BETWEEN 1 AND 100),
  target_seconds   INTEGER CHECK (target_seconds IS NULL OR target_seconds BETWEEN 1 AND 7200),
  CHECK (
    (target_kind = 'reps' AND target_reps IS NOT NULL AND target_seconds IS NULL)
    OR (target_kind = 'time' AND target_reps IS NULL AND target_seconds IS NOT NULL)
  )
) STRICT;

CREATE TABLE IF NOT EXISTS session_slot_target (
  session_plan_slot_id  INTEGER PRIMARY KEY REFERENCES session_plan_slot ON DELETE CASCADE,
  target_kind           TEXT NOT NULL CHECK (target_kind IN ('reps', 'time')),
  target_reps           INTEGER CHECK (target_reps IS NULL OR target_reps BETWEEN 1 AND 100),
  target_seconds        INTEGER CHECK (target_seconds IS NULL OR target_seconds BETWEEN 1 AND 7200),
  CHECK (
    (target_kind = 'reps' AND target_reps IS NOT NULL AND target_seconds IS NULL)
    OR (target_kind = 'time' AND target_reps IS NULL AND target_seconds IS NOT NULL)
  )
) STRICT;

-- ---------------------------------------------------------------------------
-- Layout and guidance preferences belong to the saved Coach Mode profile slot,
-- not the globally loaded athlete_profile. A NULL mode override resolves from
-- training age (Beginner -> guided; all other tiers -> self-directed).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profile_ui_preference (
  profile_slot_id       INTEGER PRIMARY KEY REFERENCES profile_slot(slot_id) ON DELETE CASCADE,
  session_mode_override TEXT CHECK (session_mode_override IS NULL OR session_mode_override IN ('guided', 'self_directed')),
  readiness_detail      TEXT NOT NULL CHECK (readiness_detail IN ('summary', 'full')),
  rest_timer_enabled    INTEGER NOT NULL DEFAULT 1 CHECK (rest_timer_enabled IN (0, 1)),
  text_scale            TEXT NOT NULL DEFAULT 'system' CHECK (text_scale IN ('system', 'large', 'extra_large')),
  updated_at_ms         INTEGER NOT NULL DEFAULT 0
) STRICT;

INSERT OR IGNORE INTO profile_ui_preference
  (profile_slot_id, session_mode_override, readiness_detail, rest_timer_enabled, text_scale, updated_at_ms)
SELECT
  slot_id,
  NULL,
  CASE WHEN json_extract(profile_json, '$.training_age') = 'beginner' THEN 'summary' ELSE 'full' END,
  1,
  'system',
  0
FROM profile_slot;

-- ---------------------------------------------------------------------------
-- Exact runner persistence. The scalar columns make startup and rest-expiry
-- queries cheap; runner_state_json is the complete serializable reducer state
-- for deterministic rehydration. The session mode is frozen at session start.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_runner_checkpoint (
  session_id                                  INTEGER PRIMARY KEY REFERENCES session ON DELETE CASCADE,
  session_mode                                TEXT NOT NULL CHECK (session_mode IN ('guided', 'self_directed')),
  phase                                       TEXT NOT NULL CHECK (phase IN ('working', 'resting', 'complete', 'halted')),
  current_session_plan_slot_id                INTEGER REFERENCES session_plan_slot ON DELETE CASCADE,
  current_set_index                           INTEGER CHECK (current_set_index IS NULL OR current_set_index >= 1),
  rest_target_seconds                         INTEGER NOT NULL DEFAULT 0 CHECK (rest_target_seconds BETWEEN 0 AND 300),
  rest_started_at_ms                          INTEGER,
  substitution_offered_for_session_plan_slot_id INTEGER REFERENCES session_plan_slot ON DELETE CASCADE,
  runner_state_json                           TEXT NOT NULL CHECK (json_valid(runner_state_json)),
  updated_at_ms                               INTEGER NOT NULL DEFAULT 0,
  CHECK (
    (phase IN ('working', 'resting')
      AND current_session_plan_slot_id IS NOT NULL
      AND current_set_index IS NOT NULL)
    OR phase IN ('complete', 'halted')
  ),
  CHECK (
    (phase = 'resting'
      AND rest_target_seconds BETWEEN 45 AND 300
      AND rest_started_at_ms IS NOT NULL)
    OR (phase <> 'resting'
      AND rest_target_seconds = 0
      AND rest_started_at_ms IS NULL)
  )
) STRICT;

CREATE INDEX IF NOT EXISTS idx_session_runner_checkpoint_rest
  ON session_runner_checkpoint (phase, rest_started_at_ms);