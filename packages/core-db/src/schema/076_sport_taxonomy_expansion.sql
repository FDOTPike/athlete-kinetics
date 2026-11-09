-- 076_sport_taxonomy_expansion.sql
--
-- Widens the `athlete_sport_profile` sport CHECK from 10 to the proposed 22
-- SportIds (WO-02 v12). The outcome, experience and range CHECKs are copied
-- unchanged from 067_sport_and_emphasis.sql.
--
-- SQLite cannot ALTER a CHECK constraint, so this migration rebuilds the table:
-- create the replacement, copy every row, drop the original, rename. The table
-- keeps its name and all twelve columns, so no reader changes.
--
-- Idempotent by contract: the temp table is dropped first, and the copy selects
-- only the columns both versions share (this file's twelve).
-- =============================================================================

DROP TABLE IF EXISTS athlete_sport_profile_076;

CREATE TABLE athlete_sport_profile_076 (
  sport_profile_id            INTEGER PRIMARY KEY CHECK (sport_profile_id = 1),
  sport_id                    TEXT NOT NULL CHECK (sport_id IN
                                ('basketball','court_netball','football_association','football_australian',
                                 'football_rugby','football_american','hockey_field','hockey_ice',
                                 'powerlifting','muay_thai','other','grappling_bjj','grappling_wrestling',
                                 'grappling_judo','combat_boxing','combat_mma','racquet_tennis',
                                 'racquet_squash','racquet_pickleball','running_sprinting',
                                 'running_endurance','swimming')),
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
  matches_per_week            INTEGER CHECK (matches_per_week IS NULL OR matches_per_week BETWEEN 0 AND 14),
  typical_session_min         INTEGER CHECK (typical_session_min IS NULL OR typical_session_min BETWEEN 1 AND 600),
  competition_date            TEXT CHECK (competition_date IS NULL
                                OR (date(competition_date) IS NOT NULL AND date(competition_date) = competition_date)),
  revision                    INTEGER NOT NULL CHECK (revision >= 1),
  updated_at_ms               INTEGER NOT NULL CHECK (updated_at_ms >= 0),
  CHECK ((sport_id = 'other') = (other_sport_name IS NOT NULL))
) STRICT;

INSERT INTO athlete_sport_profile_076 (
  sport_profile_id, sport_id, other_sport_name, outcome_id, experience_id,
  practice_sessions_per_week, matches_per_week, typical_session_min,
  competition_date, revision, updated_at_ms)
SELECT
  sport_profile_id, sport_id, other_sport_name, outcome_id, experience_id,
  practice_sessions_per_week, matches_per_week, typical_session_min,
  competition_date, revision, updated_at_ms
FROM athlete_sport_profile;

DROP TABLE athlete_sport_profile;

ALTER TABLE athlete_sport_profile_076 RENAME TO athlete_sport_profile;
