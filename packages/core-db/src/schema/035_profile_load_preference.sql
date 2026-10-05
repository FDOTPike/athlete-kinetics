-- 035_profile_load_preference.sql
-- Four-mode load selection (WO_FOUR_MODE_LOAD, ratified 2026-08-07).
-- Durable per-slot athlete preference: 'auto' (coach-resolved load) or
-- 'manual' (athlete entry is authoritative). Effective per-movement sources
-- (seeded | history | derived | manual) are resolved in pure code from this
-- preference plus evidence. is_explicit is transition metadata: it records
-- whether the athlete actually chose the current value, so an explicit choice
-- equal to a tier default still survives a later non-beginner tier change.
--
-- Seeding law (WO §5): the active slot derives from the LIVE athlete_profile
-- row; inactive slots derive from their validated profile_json snapshot.
-- beginner/intermediate seed 'auto'; advanced/elite seed 'manual'.
-- Idempotent: CREATE IF NOT EXISTS + INSERT OR IGNORE (self-heal replays it).

CREATE TABLE IF NOT EXISTS profile_load_preference (
  profile_slot_id INTEGER PRIMARY KEY REFERENCES profile_slot(slot_id) ON DELETE CASCADE,
  preference      TEXT NOT NULL CHECK (preference IN ('auto', 'manual')),
  is_explicit     INTEGER NOT NULL DEFAULT 0 CHECK (is_explicit IN (0, 1))
) STRICT;

INSERT OR IGNORE INTO profile_load_preference (profile_slot_id, preference)
SELECT
  s.slot_id,
  CASE
    WHEN COALESCE(
      CASE
        WHEN s.is_active = 1 THEN ap.training_age
        ELSE json_extract(s.profile_json, '$.training_age')
      END,
      'beginner'
    ) IN ('advanced', 'elite') THEN 'manual'
    ELSE 'auto'
  END
FROM profile_slot s
LEFT JOIN athlete_profile ap ON ap.profile_id = 1;
