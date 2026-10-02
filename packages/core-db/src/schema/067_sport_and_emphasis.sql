-- =============================================================================
-- 067_sport_and_emphasis.sql
--
-- Work order 3: sport selection, and the record of how focus, goal, sport and
-- scheduled sport workload shaped a block.
--
--   * athlete_sport_profile — the STRUCTURED sport objective: which sport, the
--     outcome the athlete wants from training for it, how long they have
--     played, and the practice/match workload they stated. One row, or none
--     when the athlete plays no sport.
--
--     This is deliberately NOT activity_definition.kind_id (064). The
--     Activities schedule names what a calendar entry IS (and has no value
--     for Australian football, American football, ice hockey, powerlifting
--     or Muay Thai); this table names what the athlete is TRAINING FOR. The
--     schedule stays the evidence for workload: when weekly activity_series
--     rows exist they are counted and the numbers stated here are ignored.
--
--     It is also deliberately not athlete_profile.objective: that column's
--     CHECK and every value in it are unchanged, so every existing reader of
--     the objective keeps working.
--
--   * athlete_goal_movement — an optional link from a goal to the one
--     exercise it is about ("Squat 100 kg" -> the squat). A side-car, so the
--     append-only goal revisions (066) are not altered. Removing the link
--     removes nothing else.
--
--   * block_emphasis — written once, in the block's own generation
--     transaction: what the generator was told (inputs_json) and what it did
--     and could not do, in plain language (report_json). It is the frozen
--     explanation of a frozen plan: changing the focus, a goal or the sport
--     later never rewrites it.
--
-- competition_date is context for reminders and goal review. Nothing reads it
-- to plan a peak, a taper or a maximum test.
--
-- Filename: 067 is the next unused schema filename (the chain's 66th entry).
-- =============================================================================

CREATE TABLE IF NOT EXISTS athlete_sport_profile (
  sport_profile_id            INTEGER PRIMARY KEY CHECK (sport_profile_id = 1),
  sport_id                    TEXT NOT NULL CHECK (sport_id IN
                                ('basketball','football_association','football_australian','football_rugby',
                                 'football_american','hockey_field','hockey_ice','powerlifting','muay_thai','other')),
  other_sport_name            TEXT CHECK (other_sport_name IS NULL
                                OR length(trim(other_sport_name)) BETWEEN 2 AND 40),
  outcome_id                  TEXT NOT NULL CHECK (outcome_id IN
                                ('jump_higher','faster_running','strength_for_contact','stay_available',
                                 'last_the_whole_game','bigger_competition_lifts','striking_and_clinch',
                                 'general_support')),
  experience_id               TEXT NOT NULL CHECK (experience_id IN
                                ('new','under_2_years','2_to_5_years','over_5_years')),
  -- NULL = "not sure". It is never read as zero.
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

CREATE TABLE IF NOT EXISTS athlete_goal_movement (
  goal_id       TEXT PRIMARY KEY REFERENCES athlete_goal(goal_id) ON DELETE CASCADE,
  movement_id   INTEGER NOT NULL REFERENCES movement(movement_id) ON DELETE CASCADE,
  linked_at_ms  INTEGER NOT NULL CHECK (linked_at_ms >= 0)
) STRICT, WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_athlete_goal_movement_movement ON athlete_goal_movement(movement_id);

CREATE TABLE IF NOT EXISTS block_emphasis (
  block_id          INTEGER PRIMARY KEY REFERENCES training_block(block_id) ON DELETE CASCADE,
  emphasis_version  INTEGER NOT NULL CHECK (emphasis_version = 1),
  inputs_json       TEXT NOT NULL CHECK (json_valid(inputs_json) AND json_type(inputs_json) = 'object'),
  report_json       TEXT NOT NULL CHECK (json_valid(report_json) AND json_type(report_json) = 'object'),
  created_at_ms     INTEGER NOT NULL CHECK (created_at_ms >= 0)
) STRICT;

-- The explanation of a frozen plan is frozen with it.
CREATE TRIGGER IF NOT EXISTS trg_block_emphasis_immutable_bu
BEFORE UPDATE ON block_emphasis
BEGIN
  SELECT RAISE(ABORT, 'block_emphasis is immutable');
END;
