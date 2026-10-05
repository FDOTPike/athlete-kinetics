-- =============================================================================
-- 066_focus_and_goals.sql
--
-- Work order 2: the athlete's training focus and SMART goals.
--
--   * muscle_group / muscle_group_alias — canonical muscle-group ids in plain
--     gym language, with verified aliases. Every alias of kind 'library_term'
--     is a value that actually appears in movement_detail.target_muscles.
--   * movement_muscle_role — the explicit primary/supporting mapping for each
--     movement id. movement_detail.target_muscles stays exactly as it is (it
--     is display content and history); this table is the allocation contract.
--   * athlete_focus (+ _muscle) — what the athlete selected. A preference,
--     never inferred, never a safety or eligibility input.
--   * athlete_goal (+ _revision, _observation) — SMART goals. A goal is edited
--     by APPENDING a revision; an observation is a measurement the athlete
--     recorded and is never rewritten. Nothing here is derived from training
--     volume, and nothing here changes a past plan.
--
-- Provenance of the movement mapping (rule 'library_target_muscles'):
--   movement_detail.target_muscles lists the single upstream primary muscle
--   first, followed by the upstream secondary muscles. That order is how the
--   library generator writes it (scripts/generate-library-v2.mjs builds
--   [...target_muscles, ...secondary_muscles]) and the staged import carries
--   exactly one primary per record. So position 0 is 'primary' and every
--   later position is 'supporting'. Two library terms name no muscle group
--   ('full_body', 'cardiovascular') and are left unmapped on purpose.
--
-- Rule 'incline_press_rule': the four incline PRESSES whose library primary is
-- the chest are also mapped to the upper chest — movement ids 65 (Incline
-- Dumbbell Press), 134 (Barbell Incline Bench Press - Medium Grip), 212
-- (Hammer Grip Incline DB Bench Press) and 216 (Incline Cable Chest Press).
-- Basis: Trebs AA, Brandenburg JP, Pitney WA. J Strength Cond Res 2010;
-- 24(7):1925-1930 — clavicular-head activation is greater on an inclined
-- bench (44 and 56 degrees) than flat.
-- Deliberately NOT included, because that evidence does not cover them:
--   * incline push-ups (90, 223) — hands raised, which is the opposite body
--     angle to an incline bench;
--   * incline flyes (217, 220) — not presses;
--   * 218 (Incline Dumbbell Bench With Palms Facing In) — its identity is an
--     open question in the content audit;
--   * 135 and 187 — held, and isolation raises rather than presses.
-- The rule lists canonical ids rather than matching names, so a later name
-- correction can never change who it applies to on a replay.
--
-- Filename: 066 is the next unused schema filename (the chain's 65th entry).
-- =============================================================================

CREATE TABLE IF NOT EXISTS muscle_group (
  muscle_group_id  TEXT PRIMARY KEY CHECK (muscle_group_id IN
                     ('chest','upper_chest','shoulders','rear_shoulders','biceps','triceps','forearms',
                      'upper_back','lats','lower_back','core',
                      'glutes','quadriceps','hamstrings','calves','inner_thighs','outer_hips')),
  display_name     TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 40),
  region           TEXT NOT NULL CHECK (region IN ('upper','trunk','lower')),
  sort_order       INTEGER NOT NULL UNIQUE CHECK (sort_order BETWEEN 1 AND 99)
) STRICT, WITHOUT ROWID;

INSERT OR IGNORE INTO muscle_group (muscle_group_id, display_name, region, sort_order) VALUES
  ('chest',          'Chest',          'upper',  1),
  ('upper_chest',    'Upper chest',    'upper',  2),
  ('shoulders',      'Shoulders',      'upper',  3),
  ('rear_shoulders', 'Rear shoulders', 'upper',  4),
  ('biceps',         'Biceps',         'upper',  5),
  ('triceps',        'Triceps',        'upper',  6),
  ('forearms',       'Forearms',       'upper',  7),
  ('upper_back',     'Upper back',     'upper',  8),
  ('lats',           'Lats',           'upper',  9),
  ('lower_back',     'Lower back',     'trunk', 10),
  ('core',           'Core and abs',   'trunk', 11),
  ('glutes',         'Glutes',         'lower', 12),
  ('quadriceps',     'Quads',          'lower', 13),
  ('hamstrings',     'Hamstrings',     'lower', 14),
  ('calves',         'Calves',         'lower', 15),
  ('inner_thighs',   'Inner thighs',   'lower', 16),
  ('outer_hips',     'Outer hips',     'lower', 17);

CREATE TABLE IF NOT EXISTS muscle_group_alias (
  alias            TEXT PRIMARY KEY CHECK (alias = lower(alias) AND length(trim(alias)) BETWEEN 1 AND 40),
  muscle_group_id  TEXT NOT NULL REFERENCES muscle_group(muscle_group_id),
  alias_kind       TEXT NOT NULL CHECK (alias_kind IN ('library_term','gym_term'))
) STRICT, WITHOUT ROWID;

INSERT OR IGNORE INTO muscle_group_alias (alias, muscle_group_id, alias_kind) VALUES
  ('chest',             'chest',          'library_term'),
  ('pectorals',         'chest',          'library_term'),
  ('upper_chest',       'upper_chest',    'library_term'),
  ('shoulders',         'shoulders',      'library_term'),
  ('deltoids',          'shoulders',      'library_term'),
  ('anterior_deltoids', 'shoulders',      'library_term'),
  ('rear_deltoids',     'rear_shoulders', 'library_term'),
  ('biceps',            'biceps',         'library_term'),
  ('triceps',           'triceps',        'library_term'),
  ('forearms',          'forearms',       'library_term'),
  ('middle back',       'upper_back',     'library_term'),
  ('rhomboids',         'upper_back',     'library_term'),
  ('traps',             'upper_back',     'library_term'),
  ('trapezius',         'upper_back',     'library_term'),
  ('upper_back',        'upper_back',     'library_term'),
  ('lats',              'lats',           'library_term'),
  ('lower back',        'lower_back',     'library_term'),
  ('spinal_erectors',   'lower_back',     'library_term'),
  ('abdominals',        'core',           'library_term'),
  ('core',              'core',           'library_term'),
  ('obliques',          'core',           'library_term'),
  ('glutes',            'glutes',         'library_term'),
  ('quadriceps',        'quadriceps',     'library_term'),
  ('hamstrings',        'hamstrings',     'library_term'),
  ('calves',            'calves',         'library_term'),
  ('adductors',         'inner_thighs',   'library_term'),
  ('abductors',         'outer_hips',     'library_term'),
  ('pecs',              'chest',          'gym_term'),
  ('upper chest',       'upper_chest',    'gym_term'),
  ('delts',             'shoulders',      'gym_term'),
  ('rear delts',        'rear_shoulders', 'gym_term'),
  ('rear shoulders',    'rear_shoulders', 'gym_term'),
  ('upper back',        'upper_back',     'gym_term'),
  ('lower_back',        'lower_back',     'gym_term'),
  ('abs',               'core',           'gym_term'),
  ('quads',             'quadriceps',     'gym_term'),
  ('hams',              'hamstrings',     'gym_term'),
  ('inner thighs',      'inner_thighs',   'gym_term'),
  ('outer hips',        'outer_hips',     'gym_term');

CREATE TABLE IF NOT EXISTS movement_muscle_role (
  movement_id       INTEGER NOT NULL REFERENCES movement ON DELETE CASCADE,
  muscle_group_id   TEXT NOT NULL REFERENCES muscle_group(muscle_group_id),
  role              TEXT NOT NULL CHECK (role IN ('primary','supporting')),
  source            TEXT NOT NULL CHECK (source IN ('library_target_muscles','incline_press_rule')),
  mapping_revision  INTEGER NOT NULL CHECK (mapping_revision >= 1),
  PRIMARY KEY (movement_id, muscle_group_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_movement_muscle_role_group
  ON movement_muscle_role (muscle_group_id, role);

-- Position 0 is the upstream primary; the rest are upstream secondaries. The
-- ORDER BY makes the earliest position win when two library terms of one
-- movement resolve to the same canonical group.
INSERT OR IGNORE INTO movement_muscle_role (movement_id, muscle_group_id, role, source, mapping_revision)
SELECT d.movement_id,
       a.muscle_group_id,
       CASE WHEN CAST(j.key AS INTEGER) = 0 THEN 'primary' ELSE 'supporting' END,
       'library_target_muscles',
       1
FROM movement_detail d
JOIN json_each(d.target_muscles) j
JOIN muscle_group_alias a
  ON a.alias = lower(trim(j.value)) AND a.alias_kind = 'library_term'
ORDER BY d.movement_id, CAST(j.key AS INTEGER);

INSERT OR IGNORE INTO movement_muscle_role (movement_id, muscle_group_id, role, source, mapping_revision)
SELECT m.movement_id, 'upper_chest', 'primary', 'incline_press_rule', 1
FROM movement m
JOIN movement_muscle_role r
  ON r.movement_id = m.movement_id AND r.muscle_group_id = 'chest' AND r.role = 'primary'
WHERE m.pattern = 'push_h'
  AND m.movement_id IN (65, 134, 212, 216);

-- ---------------------------------------------------------------------------
-- Focus: one current selection per athlete database.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS athlete_focus (
  focus_id          INTEGER PRIMARY KEY CHECK (focus_id = 1),
  bundle_id         TEXT CHECK (bundle_id IS NULL OR bundle_id IN
                      ('posture','beach_muscles','lower_body','balanced')),
  customised        INTEGER NOT NULL CHECK (customised IN (0, 1)),
  movement_control  INTEGER NOT NULL CHECK (movement_control IN (0, 1)),
  revision          INTEGER NOT NULL CHECK (revision >= 1),
  updated_at_ms     INTEGER NOT NULL CHECK (updated_at_ms >= 0)
) STRICT;

CREATE TABLE IF NOT EXISTS athlete_focus_muscle (
  focus_id         INTEGER NOT NULL REFERENCES athlete_focus(focus_id) ON DELETE CASCADE,
  muscle_group_id  TEXT NOT NULL REFERENCES muscle_group(muscle_group_id),
  PRIMARY KEY (focus_id, muscle_group_id)
) STRICT, WITHOUT ROWID;

-- More than six areas is no longer an emphasis.
CREATE TRIGGER IF NOT EXISTS trg_athlete_focus_muscle_limit_bi
BEFORE INSERT ON athlete_focus_muscle
WHEN (SELECT COUNT(*) FROM athlete_focus_muscle WHERE focus_id = NEW.focus_id) >= 6
BEGIN
  SELECT RAISE(ABORT, 'athlete_focus_muscle: at most six areas can be selected');
END;

-- ---------------------------------------------------------------------------
-- SMART goals. athlete_goal is the envelope; each definition is an immutable
-- revision; observations are immutable measurements the athlete recorded.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS athlete_goal (
  goal_id           TEXT PRIMARY KEY CHECK (length(goal_id) BETWEEN 8 AND 80),
  status            TEXT NOT NULL CHECK (status IN ('active','achieved','retired')),
  current_revision  INTEGER NOT NULL CHECK (current_revision >= 1),
  created_at_ms     INTEGER NOT NULL CHECK (created_at_ms >= 0),
  updated_at_ms     INTEGER NOT NULL CHECK (updated_at_ms >= created_at_ms)
) STRICT;

CREATE TABLE IF NOT EXISTS athlete_goal_revision (
  goal_id             TEXT NOT NULL REFERENCES athlete_goal(goal_id) ON DELETE CASCADE,
  revision            INTEGER NOT NULL CHECK (revision >= 1),
  specific_outcome    TEXT NOT NULL CHECK (length(trim(specific_outcome)) BETWEEN 3 AND 200),
  metric_id           TEXT NOT NULL CHECK (metric_id IN
                        ('load_kg','reps','time_seconds','distance_m','bodyweight_kg','length_cm','height_cm','custom')),
  unit                TEXT NOT NULL CHECK (length(trim(unit)) BETWEEN 1 AND 24),
  measurement_method  TEXT NOT NULL CHECK (length(trim(measurement_method)) BETWEEN 5 AND 300),
  baseline_known      INTEGER NOT NULL CHECK (baseline_known IN (0, 1)),
  baseline_value      REAL CHECK (baseline_value IS NULL OR baseline_value BETWEEN 0 AND 100000),
  target_value        REAL NOT NULL CHECK (target_value BETWEEN 0 AND 100000),
  reason              TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 200),
  requested_deadline  TEXT CHECK (requested_deadline IS NULL OR
                        (date(requested_deadline) IS NOT NULL AND date(requested_deadline) = requested_deadline)),
  recorded_at_ms      INTEGER NOT NULL CHECK (recorded_at_ms >= 0),
  PRIMARY KEY (goal_id, revision),
  -- A baseline is a number or an explicit unknown, never an assumed zero.
  CHECK ((baseline_known = 1 AND baseline_value IS NOT NULL)
      OR (baseline_known = 0 AND baseline_value IS NULL))
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS athlete_goal_observation (
  observation_id  TEXT PRIMARY KEY CHECK (length(observation_id) BETWEEN 8 AND 80),
  goal_id         TEXT NOT NULL REFERENCES athlete_goal(goal_id) ON DELETE CASCADE,
  goal_revision   INTEGER NOT NULL CHECK (goal_revision >= 1),
  observed_on     TEXT NOT NULL CHECK (date(observed_on) IS NOT NULL AND date(observed_on) = observed_on),
  value           REAL NOT NULL CHECK (value BETWEEN 0 AND 100000),
  unit            TEXT NOT NULL CHECK (length(trim(unit)) BETWEEN 1 AND 24),
  -- Only a measurement the athlete entered. There is no derived source.
  source          TEXT NOT NULL CHECK (source = 'athlete_entered'),
  recorded_at_ms  INTEGER NOT NULL CHECK (recorded_at_ms >= 0),
  FOREIGN KEY (goal_id, goal_revision) REFERENCES athlete_goal_revision(goal_id, revision)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_athlete_goal_observation_goal
  ON athlete_goal_observation (goal_id, observed_on);

-- Editing a goal appends a revision. A recorded definition is never rewritten,
-- so what a past plan or observation referred to stays readable.
CREATE TRIGGER IF NOT EXISTS trg_athlete_goal_revision_immutable_bu
BEFORE UPDATE ON athlete_goal_revision
BEGIN
  SELECT RAISE(ABORT, 'athlete_goal_revision is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_athlete_goal_revision_no_delete_bd
BEFORE DELETE ON athlete_goal_revision
WHEN EXISTS (SELECT 1 FROM athlete_goal g WHERE g.goal_id = OLD.goal_id)
BEGIN
  SELECT RAISE(ABORT, 'athlete_goal_revision: a revision is kept for as long as its goal exists');
END;

-- The envelope's revision only moves forward.
CREATE TRIGGER IF NOT EXISTS trg_athlete_goal_revision_forward_bu
BEFORE UPDATE OF current_revision ON athlete_goal
WHEN NEW.current_revision < OLD.current_revision
BEGIN
  SELECT RAISE(ABORT, 'athlete_goal: current_revision cannot move backwards');
END;

-- A measurement is what was recorded. It can be removed by the athlete, never edited.
CREATE TRIGGER IF NOT EXISTS trg_athlete_goal_observation_immutable_bu
BEFORE UPDATE ON athlete_goal_observation
BEGIN
  SELECT RAISE(ABORT, 'athlete_goal_observation is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_athlete_goal_active_limit_bi
BEFORE INSERT ON athlete_goal
WHEN NEW.status = 'active'
 AND (SELECT COUNT(*) FROM athlete_goal WHERE status = 'active') >= 5
BEGIN
  SELECT RAISE(ABORT, 'athlete_goal: at most five goals can be active');
END;

CREATE TRIGGER IF NOT EXISTS trg_athlete_goal_active_limit_bu
BEFORE UPDATE OF status ON athlete_goal
WHEN NEW.status = 'active' AND OLD.status <> 'active'
 AND (SELECT COUNT(*) FROM athlete_goal WHERE status = 'active') >= 5
BEGIN
  SELECT RAISE(ABORT, 'athlete_goal: at most five goals can be active');
END;
