-- =============================================================================
-- 013_profile_slot.sql
-- Phase 12 Step 6: local multi-tenancy. The shipped athlete_profile is locked
-- to a single row (CHECK profile_id = 1) and cannot be widened (append-only
-- chain), so saved profiles live in this side-car. athlete_profile remains THE
-- active profile the math reads; a "switch" copies the live profile back into
-- its slot, then loads the chosen slot into athlete_profile (store-side).
--
-- profile_json is the full athlete_profile snapshot as JSON (objective ...
-- equipment_inventory). is_active marks the slot currently loaded into
-- athlete_profile (exactly one, enforced app-side on switch).
--
-- Seeded with one slot per training age (the on-device debug workflow: switch
-- Beginner <-> Elite and regenerate a block), copied from the live
-- athlete_profile with only training_age overridden; the slot matching the live
-- profile is marked active. Idempotent (OR IGNORE on the fixed slot_ids).
-- =============================================================================
CREATE TABLE IF NOT EXISTS profile_slot (
  slot_id       INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  profile_json  TEXT NOT NULL CHECK (json_valid(profile_json)),
  is_active     INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  updated_at_ms INTEGER NOT NULL DEFAULT 0
) STRICT;

INSERT OR IGNORE INTO profile_slot (slot_id, name, profile_json, is_active, updated_at_ms)
SELECT e.column1, e.column2,
  json_set(
    json_object(
      'objective', ap.objective,
      'training_age', ap.training_age,
      'weekly_frequency', ap.weekly_frequency,
      'max_sessions_per_day', ap.max_sessions_per_day,
      'session_duration_cap_min', ap.session_duration_cap_min,
      'base_rpe_cap', ap.base_rpe_cap,
      'target_energy_system', ap.target_energy_system,
      'progression_methodology', ap.progression_methodology,
      'injury_flags', json(ap.injury_flags),
      'mobility_limits', json(ap.mobility_limits),
      'equipment_inventory', json(ap.equipment_inventory)
    ),
    '$.training_age', e.column3
  ),
  CASE WHEN ap.training_age = e.column3 THEN 1 ELSE 0 END,
  ap.updated_at_ms
FROM (VALUES
  (1, 'Beginner',     'beginner'),
  (2, 'Intermediate', 'intermediate'),
  (3, 'Advanced',     'advanced'),
  (4, 'Elite',        'elite')
) AS e
CROSS JOIN athlete_profile ap
WHERE ap.profile_id = 1;
