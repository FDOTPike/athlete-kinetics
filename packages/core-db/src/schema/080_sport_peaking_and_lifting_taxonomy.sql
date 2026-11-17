-- 078_sport_peaking_and_lifting_taxonomy.sql
--
-- Phase 2 (#219 + #229 + question1):
--   1. Rebuilds `athlete_sport_profile` (076) and `athlete_secondary_sport_profile`
--      (077) with the 24 SportIds (`olympic_weightlifting`, `strongman` added to
--      the strength family) and allows `matches_per_week BETWEEN 0 AND 52` for
--      lifting sports (`powerlifting`, `olympic_weightlifting`, `strongman`) while
--      keeping `0..14` for all other sports (#229 Q7).
--   2. Adds `sport_peaking_movement` seeded with the 3 starter basketball entries.
--   3. Adds STRICT side-car tables for #219/#229 strength back-off prescriptions
--      and meet-driven backward countdown metadata:
--        * `planned_slot_backoff`
--        * `session_slot_backoff`
--        * `training_program_meet_countdown`
--        * `training_block_meet_meta`
-- =============================================================================

DROP TABLE IF EXISTS athlete_sport_profile_078;

CREATE TABLE athlete_sport_profile_078 (
  sport_profile_id            INTEGER PRIMARY KEY CHECK (sport_profile_id = 1),
  sport_id                    TEXT NOT NULL CHECK (sport_id IN
                                ('basketball','court_netball','football_association','football_australian',
                                 'football_rugby','football_american','hockey_field','hockey_ice',
                                 'powerlifting','olympic_weightlifting','strongman','muay_thai','other',
                                 'grappling_bjj','grappling_wrestling','grappling_judo','combat_boxing',
                                 'combat_mma','racquet_tennis','racquet_squash','racquet_pickleball',
                                 'running_sprinting','running_endurance','swimming')),
  other_sport_name            TEXT CHECK (other_sport_name IS NULL
                                OR length(trim(other_sport_name)) BETWEEN 2 AND 40),
  outcome_id                  TEXT NOT NULL CHECK (outcome_id IN
                                ('jump_higher','faster_running','strength_for_contact','stay_available',
                                 'last_the_whole_game','bigger_competition_lifts','striking_and_clinch',
                                 'general_support')),
  experience_id               TEXT NOT NULL CHECK (experience_id IN
                                ('new','under_2_years','2_to_5_years','over_5_years')),
  practice_sessions_per_week  INTEGER CHECK (practice_sessions_per_week IS NULL
                                OR practice_sessions_per_week BETWEEN 0 AND 14),
  matches_per_week            INTEGER CHECK (matches_per_week IS NULL
                                OR (sport_id IN ('powerlifting','olympic_weightlifting','strongman')
                                    AND matches_per_week BETWEEN 0 AND 52)
                                OR (sport_id NOT IN ('powerlifting','olympic_weightlifting','strongman')
                                    AND matches_per_week BETWEEN 0 AND 14)),
  typical_session_min         INTEGER CHECK (typical_session_min IS NULL OR typical_session_min BETWEEN 1 AND 600),
  competition_date            TEXT CHECK (competition_date IS NULL
                                OR (date(competition_date) IS NOT NULL AND date(competition_date) = competition_date)),
  revision                    INTEGER NOT NULL CHECK (revision >= 1),
  updated_at_ms               INTEGER NOT NULL CHECK (updated_at_ms >= 0),
  CHECK ((sport_id = 'other') = (other_sport_name IS NOT NULL))
) STRICT;

INSERT INTO athlete_sport_profile_078 (
  sport_profile_id, sport_id, other_sport_name, outcome_id, experience_id,
  practice_sessions_per_week, matches_per_week, typical_session_min,
  competition_date, revision, updated_at_ms)
SELECT
  sport_profile_id, sport_id, other_sport_name, outcome_id, experience_id,
  practice_sessions_per_week, matches_per_week, typical_session_min,
  competition_date, revision, updated_at_ms
FROM athlete_sport_profile;

DROP TABLE athlete_sport_profile;

ALTER TABLE athlete_sport_profile_078 RENAME TO athlete_sport_profile;

DROP TABLE IF EXISTS athlete_secondary_sport_profile_078;

CREATE TABLE athlete_secondary_sport_profile_078 (
  priority_rank               INTEGER PRIMARY KEY CHECK (priority_rank = 2),
  sport_profile_id            INTEGER NOT NULL DEFAULT 1
                                CHECK (sport_profile_id = 1),
  sport_id                    TEXT NOT NULL CHECK (sport_id IN
                                ('basketball','court_netball','football_association','football_australian',
                                 'football_rugby','football_american','hockey_field','hockey_ice',
                                 'powerlifting','olympic_weightlifting','strongman','muay_thai','other',
                                 'grappling_bjj','grappling_wrestling','grappling_judo','combat_boxing',
                                 'combat_mma','racquet_tennis','racquet_squash','racquet_pickleball',
                                 'running_sprinting','running_endurance','swimming')),
  other_sport_name            TEXT CHECK (other_sport_name IS NULL
                                OR length(trim(other_sport_name)) BETWEEN 2 AND 40),
  outcome_id                  TEXT NOT NULL CHECK (outcome_id IN
                                ('jump_higher','faster_running','strength_for_contact','stay_available',
                                 'last_the_whole_game','bigger_competition_lifts','striking_and_clinch',
                                 'general_support')),
  experience_id               TEXT NOT NULL CHECK (experience_id IN
                                ('new','under_2_years','2_to_5_years','over_5_years')),
  practice_sessions_per_week  INTEGER CHECK (practice_sessions_per_week IS NULL
                                OR practice_sessions_per_week BETWEEN 0 AND 14),
  matches_per_week            INTEGER CHECK (matches_per_week IS NULL
                                OR (sport_id IN ('powerlifting','olympic_weightlifting','strongman')
                                    AND matches_per_week BETWEEN 0 AND 52)
                                OR (sport_id NOT IN ('powerlifting','olympic_weightlifting','strongman')
                                    AND matches_per_week BETWEEN 0 AND 14)),
  typical_session_min         INTEGER CHECK (typical_session_min IS NULL OR typical_session_min BETWEEN 1 AND 600),
  competition_date            TEXT CHECK (competition_date IS NULL
                                OR (date(competition_date) IS NOT NULL AND date(competition_date) = competition_date)),
  revision                    INTEGER NOT NULL CHECK (revision >= 1),
  updated_at_ms               INTEGER NOT NULL CHECK (updated_at_ms >= 0),
  CHECK ((sport_id = 'other') = (other_sport_name IS NOT NULL))
) STRICT;

INSERT INTO athlete_secondary_sport_profile_078 (
  priority_rank, sport_profile_id, sport_id, other_sport_name, outcome_id, experience_id,
  practice_sessions_per_week, matches_per_week, typical_session_min,
  competition_date, revision, updated_at_ms)
SELECT
  priority_rank, sport_profile_id, sport_id, other_sport_name, outcome_id, experience_id,
  practice_sessions_per_week, matches_per_week, typical_session_min,
  competition_date, revision, updated_at_ms
FROM athlete_secondary_sport_profile;

DROP TABLE athlete_secondary_sport_profile;

ALTER TABLE athlete_secondary_sport_profile_078 RENAME TO athlete_secondary_sport_profile;

CREATE TABLE IF NOT EXISTS sport_peaking_movement (
  movement_id  TEXT PRIMARY KEY,
  sport_id     TEXT NOT NULL CHECK (sport_id IN
                 ('basketball','court_netball','football_association','football_australian',
                  'football_rugby','football_american','hockey_field','hockey_ice',
                  'powerlifting','olympic_weightlifting','strongman','muay_thai','other',
                  'grappling_bjj','grappling_wrestling','grappling_judo','combat_boxing',
                  'combat_mma','racquet_tennis','racquet_squash','racquet_pickleball',
                  'running_sprinting','running_endurance','swimming')),
  category     TEXT NOT NULL CHECK (category IN
                 ('competition_simulation','sport_drill','high_intensity_cardio')),
  name         TEXT NOT NULL,
  notes        TEXT,
  sort_order   INTEGER NOT NULL CHECK (sort_order >= 1)
) STRICT;

INSERT OR IGNORE INTO sport_peaking_movement (movement_id, sport_id, category, name, notes, sort_order) VALUES
  ('peaking_bball_mock_game', 'basketball', 'competition_simulation', 'Mock basketball game', NULL, 1),
  ('peaking_bball_movement_drills', 'basketball', 'sport_drill', 'Specific basketball movement drills', NULL, 2),
  ('peaking_bball_hi_cardio', 'basketball', 'high_intensity_cardio', 'High-intensity cardio', NULL, 3);

CREATE TABLE IF NOT EXISTS planned_slot_backoff (
  planned_slot_id  INTEGER PRIMARY KEY REFERENCES planned_slot(planned_slot_id) ON DELETE CASCADE,
  sets             INTEGER NOT NULL CHECK (sets BETWEEN 1 AND 10),
  reps             INTEGER NOT NULL CHECK (reps BETWEEN 1 AND 30),
  target_rpe       REAL NOT NULL CHECK (target_rpe BETWEEN 5.0 AND 10.0),
  load_multiplier  REAL NOT NULL CHECK (load_multiplier > 0.0 AND load_multiplier <= 1.0)
) STRICT;

CREATE TABLE IF NOT EXISTS session_slot_backoff (
  session_plan_slot_id  INTEGER PRIMARY KEY REFERENCES session_plan_slot(session_plan_slot_id) ON DELETE CASCADE,
  sets                  INTEGER NOT NULL CHECK (sets BETWEEN 1 AND 10),
  reps                  INTEGER NOT NULL CHECK (reps BETWEEN 1 AND 30),
  target_rpe            REAL NOT NULL CHECK (target_rpe BETWEEN 5.0 AND 10.0),
  load_multiplier       REAL NOT NULL CHECK (load_multiplier > 0.0 AND load_multiplier <= 1.0)
) STRICT;

CREATE TABLE IF NOT EXISTS training_program_meet_countdown (
  program_id        INTEGER PRIMARY KEY REFERENCES training_program(program_id) ON DELETE CASCADE,
  competition_date  TEXT NOT NULL CHECK (date(competition_date) IS NOT NULL AND date(competition_date) = competition_date)
) STRICT;

CREATE TABLE IF NOT EXISTS training_block_meet_meta (
  block_id          INTEGER PRIMARY KEY REFERENCES training_block(block_id) ON DELETE CASCADE,
  competition_date  TEXT NOT NULL CHECK (date(competition_date) IS NOT NULL AND date(competition_date) = competition_date),
  block_number      INTEGER NOT NULL CHECK (block_number >= 1),
  total_blocks      INTEGER NOT NULL CHECK (total_blocks >= block_number)
) STRICT;
