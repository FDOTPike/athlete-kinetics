-- =============================================================================
-- 006_user_profile.sql
-- The athlete questionnaire: a single-row, CHECK-constrained profile that the
-- prescription chain treats as a HARD CEILING (policy -> profile clamps ->
-- triage guardrails, each layer monotone conservative). Ten categories,
-- standard advanced-PT baseline; defaults are deliberately middle-of-road so
-- a fresh install is safe before the athlete fills anything in.
--
-- Idempotent by the migration contract (IF NOT EXISTS + INSERT OR IGNORE).
-- JSON-array columns (injury_flags, mobility_limits) are validated app-side;
-- SQLite json_valid() CHECKs keep them structurally sound.
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_profile (
  profile_id              INTEGER PRIMARY KEY CHECK (profile_id = 1),

  -- 1. Primary fitness objective
  objective               TEXT NOT NULL DEFAULT 'gpp' CHECK (objective IN
                            ('strength','hypertrophy','power','endurance','gpp','rehab','weight_loss')),
  -- 2. Training age
  training_age            TEXT NOT NULL DEFAULT 'intermediate' CHECK (training_age IN
                            ('beginner','intermediate','advanced','elite')),
  -- 3. Routine: weekly frequency + hard daily session cap
  weekly_frequency        INTEGER NOT NULL DEFAULT 4 CHECK (weekly_frequency BETWEEN 1 AND 7),
  max_sessions_per_day    INTEGER NOT NULL DEFAULT 1 CHECK (max_sessions_per_day BETWEEN 1 AND 3),
  -- 4. Session duration ceiling (minutes)
  session_duration_cap_min INTEGER NOT NULL DEFAULT 90 CHECK (session_duration_cap_min BETWEEN 15 AND 240),
  -- 5. Base effort ceiling: no prescription may exceed this RPE, ever
  base_rpe_cap            REAL NOT NULL DEFAULT 9.0 CHECK (base_rpe_cap BETWEEN 5.0 AND 10.0),
  -- 6. Target energy system
  target_energy_system    TEXT NOT NULL DEFAULT 'hybrid' CHECK (target_energy_system IN
                            ('aerobic','anaerobic','atp_pc','hybrid')),
  -- 7. Progression methodology
  progression_methodology TEXT NOT NULL DEFAULT 'autoregulated' CHECK (progression_methodology IN
                            ('linear','undulating','conjugate','autoregulated')),
  -- 8. Historical injuries: JSON array of {"region": string, "note": string}
  injury_flags            TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(injury_flags)),
  -- 9. Mobility limitations: same shape
  mobility_limits         TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(mobility_limits)),
  -- 10. Equipment access
  equipment_access        TEXT NOT NULL DEFAULT 'full_gym' CHECK (equipment_access IN
                            ('full_gym','home_basic','minimal')),

  updated_at_ms           INTEGER NOT NULL DEFAULT 0
) STRICT;

INSERT OR IGNORE INTO user_profile (profile_id) VALUES (1);
