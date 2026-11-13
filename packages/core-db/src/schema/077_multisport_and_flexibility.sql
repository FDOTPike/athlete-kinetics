-- 077_multisport_and_flexibility.sql
--
-- Multi-sport support without touching 067's invariants:
--   * athlete_sport_profile remains the Rank-1 profile and keeps its singleton
--     CHECK (sport_profile_id = 1); a second row is still rejected.
--   * athlete_secondary_sport_profile is the Rank-2 side-car and fixes rank at 2.
--     Rank-1 presence and sport distinctness are TypeScript guards, not schema
--     constraints (see the note above the flexibility tag table).
--   * activity_flexibility_tag marks an activity_definition row as a
--     mobility/flexibility session. The tag, not the kind CHECK, carries the
--     meaning, so activity_definition's CREATE TABLE text is byte-identical to
--     064 and the [067] verifier keeps its invariant.
--
-- The three flexibility triggers name activity_definition (064), created after
-- the chain's rename point, so they are registered in REPLAY_BLOCKING_TRIGGERS;
-- both 077 tables are registered in SENTINELS.
--
-- Idempotent by contract: CREATE TABLE/TRIGGER IF NOT EXISTS only.
-- =============================================================================

CREATE TABLE IF NOT EXISTS athlete_secondary_sport_profile (
  priority_rank               INTEGER PRIMARY KEY CHECK (priority_rank = 2),
  sport_profile_id            INTEGER NOT NULL DEFAULT 1
                                CHECK (sport_profile_id = 1),
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

-- Rank 1 must exist and the two sports must differ. Neither is a schema
-- constraint here, and neither is an FK: 076 rebuilds athlete_sport_profile with
-- DROP + RENAME, so a trigger that names it breaks the rename on re-apply, and
-- ON DELETE CASCADE would silently delete the Rank-2 row during that rebuild.
-- Both rules are enforced in TypeScript by assertSecondarySportAllowed(),
-- called on the workload path and tested in MultiSportAndFlexibility.test.js.
--
CREATE TABLE IF NOT EXISTS activity_flexibility_tag (
  activity_id     TEXT PRIMARY KEY REFERENCES activity_definition(activity_id) ON DELETE CASCADE,
  template_id     TEXT NOT NULL CHECK (template_id IN
                    ('hips_lower_body','thoracic_shoulders','ankles_calves','wrists_forearms','full_body_recovery')),
  recorded_at_ms  INTEGER NOT NULL CHECK (recorded_at_ms >= 0)
) STRICT, WITHOUT ROWID;

-- A tagged activity must exist and be low demand at the moment of tagging.
CREATE TRIGGER IF NOT EXISTS trg_activity_flexibility_tag_low_demand_bi
BEFORE INSERT ON activity_flexibility_tag
WHEN NOT EXISTS (SELECT 1 FROM activity_definition
                 WHERE activity_id = NEW.activity_id AND demand_class = 'low')
BEGIN
  SELECT RAISE(ABORT, 'mobility_flexibility activity must exist with demand_class low');
END;

CREATE TRIGGER IF NOT EXISTS trg_activity_flexibility_tag_low_demand_bu
BEFORE UPDATE ON activity_flexibility_tag
WHEN NOT EXISTS (SELECT 1 FROM activity_definition
                 WHERE activity_id = NEW.activity_id AND demand_class = 'low')
BEGIN
  SELECT RAISE(ABORT, 'mobility_flexibility activity must exist with demand_class low');
END;

-- And a tagged activity cannot be reclassified away from low demand.
CREATE TRIGGER IF NOT EXISTS trg_activity_definition_flexibility_low_demand_bu
BEFORE UPDATE OF demand_class ON activity_definition
WHEN NEW.demand_class <> 'low'
  AND EXISTS (SELECT 1 FROM activity_flexibility_tag WHERE activity_id = NEW.activity_id)
BEGIN
  SELECT RAISE(ABORT, 'tagged mobility_flexibility activity must stay low demand');
END;
