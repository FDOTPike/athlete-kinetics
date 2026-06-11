-- =============================================================================
-- 007_program_engine.sql
-- Phase 9: hybrid objective, equipment inventory, 4-week block engine tables.
--
-- (1) athlete_profile — v2 of the questionnaire table. SQLite cannot widen a
--     CHECK in place and shipped migrations are append-only, so the profile
--     moves to a NEW table whose `objective` accepts 'hybrid' and whose
--     equipment model is a JSON inventory (strict boolean filters) instead of
--     the legacy 3-way equipment_access enum. The legacy row is copied once
--     (INSERT OR IGNORE), then user_profile is dropped.
--
--     Idempotency + data preservation under the self-heal re-apply path
--     (runner re-runs ALL migrations when a sentinel is missing): 006
--     recreates an empty-default user_profile, the copy below is ignored
--     because athlete_profile row 1 already exists, and the drop repeats.
--     A customized hybrid objective / inventory is never reset.
--
-- (2) movement library seed — the block engine needs a movement pool on a
--     REAL install (previously only the demo loader seeded movements). Ids
--     1..7 are byte-identical to the demo loader's so both paths coexist
--     (the loader now uses INSERT OR IGNORE).
--
-- (3) movement_equipment — required-equipment join table. A movement is
--     available iff EVERY row here is in the athlete's inventory; no rows
--     means bodyweight. Join table (not an ALTER ADD COLUMN) because ALTER
--     is not idempotent and `movement` has incoming FKs.
--
-- (4) training_block / planned_session / planned_slot — the deterministic
--     4-week macro-cycle. Self-contained: macro_cycle/micro_cycle stay the
--     demo's historical periodization record (their CHECK enums are shipped
--     and lack 'hybrid').
-- =============================================================================

-- ---------------------------------------------------------------------------
-- (0) Defensive shim: a poisoned field DB can reach this migration with
-- user_version >= 6 but user_profile missing (the pre-runner async bug).
-- Without this, the copy below would fail at prepare time and the failed
-- migration would block boot forever. Mirrors 006 exactly; no-op normally.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profile (
  profile_id              INTEGER PRIMARY KEY CHECK (profile_id = 1),
  objective               TEXT NOT NULL DEFAULT 'gpp' CHECK (objective IN
                            ('strength','hypertrophy','power','endurance','gpp','rehab','weight_loss')),
  training_age            TEXT NOT NULL DEFAULT 'intermediate' CHECK (training_age IN
                            ('beginner','intermediate','advanced','elite')),
  weekly_frequency        INTEGER NOT NULL DEFAULT 4 CHECK (weekly_frequency BETWEEN 1 AND 7),
  max_sessions_per_day    INTEGER NOT NULL DEFAULT 1 CHECK (max_sessions_per_day BETWEEN 1 AND 3),
  session_duration_cap_min INTEGER NOT NULL DEFAULT 90 CHECK (session_duration_cap_min BETWEEN 15 AND 240),
  base_rpe_cap            REAL NOT NULL DEFAULT 9.0 CHECK (base_rpe_cap BETWEEN 5.0 AND 10.0),
  target_energy_system    TEXT NOT NULL DEFAULT 'hybrid' CHECK (target_energy_system IN
                            ('aerobic','anaerobic','atp_pc','hybrid')),
  progression_methodology TEXT NOT NULL DEFAULT 'autoregulated' CHECK (progression_methodology IN
                            ('linear','undulating','conjugate','autoregulated')),
  injury_flags            TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(injury_flags)),
  mobility_limits         TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(mobility_limits)),
  equipment_access        TEXT NOT NULL DEFAULT 'full_gym' CHECK (equipment_access IN
                            ('full_gym','home_basic','minimal')),
  updated_at_ms           INTEGER NOT NULL DEFAULT 0
) STRICT;
INSERT OR IGNORE INTO user_profile (profile_id) VALUES (1);

-- ---------------------------------------------------------------------------
-- (1) athlete_profile v2 — 'hybrid' objective + equipment inventory.
-- equipment_inventory items and order MUST mirror EQUIPMENT_ITEMS in
-- packages/inference/src/types.ts (machine-checked by verify:blocks).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS athlete_profile (
  profile_id              INTEGER PRIMARY KEY CHECK (profile_id = 1),
  objective               TEXT NOT NULL DEFAULT 'gpp' CHECK (objective IN
                            ('strength','hypertrophy','power','endurance','gpp','hybrid','rehab','weight_loss')),
  training_age            TEXT NOT NULL DEFAULT 'intermediate' CHECK (training_age IN
                            ('beginner','intermediate','advanced','elite')),
  weekly_frequency        INTEGER NOT NULL DEFAULT 4 CHECK (weekly_frequency BETWEEN 1 AND 7),
  max_sessions_per_day    INTEGER NOT NULL DEFAULT 1 CHECK (max_sessions_per_day BETWEEN 1 AND 3),
  session_duration_cap_min INTEGER NOT NULL DEFAULT 90 CHECK (session_duration_cap_min BETWEEN 15 AND 240),
  base_rpe_cap            REAL NOT NULL DEFAULT 9.0 CHECK (base_rpe_cap BETWEEN 5.0 AND 10.0),
  target_energy_system    TEXT NOT NULL DEFAULT 'hybrid' CHECK (target_energy_system IN
                            ('aerobic','anaerobic','atp_pc','hybrid')),
  progression_methodology TEXT NOT NULL DEFAULT 'autoregulated' CHECK (progression_methodology IN
                            ('linear','undulating','conjugate','autoregulated')),
  injury_flags            TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(injury_flags)),
  mobility_limits         TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(mobility_limits)),
  equipment_inventory     TEXT NOT NULL DEFAULT '["barbell","squat_rack","bench","dumbbells","kettlebell","pullup_bar","nordic_bench","bands","cable_machine","mats"]'
                            CHECK (json_valid(equipment_inventory)),
  updated_at_ms           INTEGER NOT NULL DEFAULT 0
) STRICT;

-- One-time copy from the legacy table; legacy equipment_access maps to an
-- inventory bundle (must mirror EQUIPMENT_PRESETS in types.ts).
INSERT OR IGNORE INTO athlete_profile (profile_id, objective, training_age,
  weekly_frequency, max_sessions_per_day, session_duration_cap_min, base_rpe_cap,
  target_energy_system, progression_methodology, injury_flags, mobility_limits,
  equipment_inventory, updated_at_ms)
SELECT profile_id, objective, training_age, weekly_frequency, max_sessions_per_day,
  session_duration_cap_min, base_rpe_cap, target_energy_system,
  progression_methodology, injury_flags, mobility_limits,
  CASE equipment_access
    WHEN 'home_basic' THEN '["dumbbells","kettlebell","pullup_bar","bands","mats"]'
    WHEN 'minimal'    THEN '["bands","mats"]'
    ELSE '["barbell","squat_rack","bench","dumbbells","kettlebell","pullup_bar","nordic_bench","bands","cable_machine","mats"]'
  END,
  updated_at_ms
FROM user_profile;

INSERT OR IGNORE INTO athlete_profile (profile_id) VALUES (1);

DROP TABLE IF EXISTS user_profile;

-- ---------------------------------------------------------------------------
-- (2) Movement library seed. Ids 1..7 MUST stay identical to the demo
-- loader's list (packages/core-db/src/demoData.ts) — both use OR IGNORE.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO movement (movement_id, name, pattern, is_compound) VALUES
  (1,  'Competition Squat',       'squat',      1),
  (2,  'Deadlift',                'hinge',      1),
  (3,  'Competition Bench',       'push_h',     1),
  (4,  'Overhead Press',          'push_v',     1),
  (5,  'Barbell Row',             'pull_h',     1),
  (6,  'Weighted Pull-up',        'pull_v',     1),
  (7,  'BJJ Sparring Round',      'locomotion', 1),
  (8,  'Front Squat',             'squat',      1),
  (9,  'Romanian Deadlift',       'hinge',      1),
  (10, 'Dumbbell Bench Press',    'push_h',     1),
  (11, 'Dumbbell Shoulder Press', 'push_v',     1),
  (12, 'Single-Arm Dumbbell Row', 'pull_h',     1),
  (13, 'Chin-up',                 'pull_v',     1),
  (14, 'Goblet Squat',            'squat',      1),
  (15, 'Kettlebell Swing',        'hinge',      1),
  (16, 'Push-up',                 'push_h',     1),
  (17, 'Walking Lunge',           'lunge',      1),
  (18, 'Bulgarian Split Squat',   'lunge',      1),
  (19, 'Farmer Carry',            'carry',      1),
  (20, 'Suitcase Carry',          'carry',      1),
  (21, 'Lat Pulldown',            'pull_v',     1),
  (22, 'Cable Row',               'pull_h',     1),
  (23, 'Nordic Curl',             'isolation',  0),
  (24, 'Band Pull-Apart',         'isolation',  0),
  (25, 'Pallof Press',            'rotation',   0),
  (26, 'Plank',                   'rotation',   0),
  (27, 'Road Run',                'locomotion', 1),
  (28, 'Bodyweight Squat',        'squat',      1),
  (29, 'Glute Bridge',            'hinge',      0),
  (30, 'Band Row',                'pull_h',     0);

-- ---------------------------------------------------------------------------
-- (3) Required-equipment join table. STRICT boolean semantics: available iff
-- required set is a subset of the inventory. No rows = bodyweight movement.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movement_equipment (
  movement_id INTEGER NOT NULL REFERENCES movement ON DELETE CASCADE,
  item        TEXT NOT NULL CHECK (item IN
                ('barbell','squat_rack','bench','dumbbells','kettlebell',
                 'pullup_bar','nordic_bench','bands','cable_machine','mats')),
  PRIMARY KEY (movement_id, item)
) STRICT, WITHOUT ROWID;

-- Seeded by name (not id) so rows attach correctly however the movement
-- arrived (007 seed above, or a pre-007 demo install).
INSERT OR IGNORE INTO movement_equipment (movement_id, item)
SELECT m.movement_id, e.column2
FROM (VALUES
  ('Competition Squat',       'barbell'),
  ('Competition Squat',       'squat_rack'),
  ('Deadlift',                'barbell'),
  ('Competition Bench',       'barbell'),
  ('Competition Bench',       'bench'),
  ('Overhead Press',          'barbell'),
  ('Barbell Row',             'barbell'),
  ('Weighted Pull-up',        'pullup_bar'),
  ('BJJ Sparring Round',      'mats'),
  ('Front Squat',             'barbell'),
  ('Front Squat',             'squat_rack'),
  ('Romanian Deadlift',       'barbell'),
  ('Dumbbell Bench Press',    'dumbbells'),
  ('Dumbbell Bench Press',    'bench'),
  ('Dumbbell Shoulder Press', 'dumbbells'),
  ('Single-Arm Dumbbell Row', 'dumbbells'),
  ('Single-Arm Dumbbell Row', 'bench'),
  ('Chin-up',                 'pullup_bar'),
  ('Goblet Squat',            'dumbbells'),
  ('Kettlebell Swing',        'kettlebell'),
  ('Bulgarian Split Squat',   'bench'),
  ('Farmer Carry',            'dumbbells'),
  ('Suitcase Carry',          'kettlebell'),
  ('Lat Pulldown',            'cable_machine'),
  ('Cable Row',               'cable_machine'),
  ('Nordic Curl',             'nordic_bench'),
  ('Band Pull-Apart',         'bands'),
  ('Pallof Press',            'bands'),
  ('Band Row',                'bands')
) AS e
JOIN movement m ON m.name = e.column1;

-- ---------------------------------------------------------------------------
-- (4) Deterministic 4-week block. Exactly one 'active' block (app-enforced:
-- generation archives the previous one inside the same transaction).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_block (
  block_id      INTEGER PRIMARY KEY,
  start_date    TEXT NOT NULL CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  objective     TEXT NOT NULL CHECK (objective IN
                  ('strength','hypertrophy','power','endurance','gpp','hybrid','rehab','weight_loss')),
  weeks         INTEGER NOT NULL DEFAULT 4 CHECK (weeks = 4),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at_ms INTEGER NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS planned_session (
  planned_session_id INTEGER PRIMARY KEY,
  block_id           INTEGER NOT NULL REFERENCES training_block ON DELETE CASCADE,
  week_index         INTEGER NOT NULL CHECK (week_index BETWEEN 1 AND 4),
  day_index          INTEGER NOT NULL CHECK (day_index BETWEEN 1 AND 7),
  focus              TEXT NOT NULL CHECK (focus IN
                       ('lower','upper','full','conditioning','bjj')),
  phase              TEXT NOT NULL CHECK (phase IN
                       ('accumulation','intensification','realization','deload')),
  session_date       TEXT NOT NULL CHECK (session_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  UNIQUE (block_id, week_index, day_index)
) STRICT;

-- The "what's today" boot lookup: active block's session by date.
CREATE INDEX IF NOT EXISTS idx_planned_session_date ON planned_session (session_date);

CREATE TABLE IF NOT EXISTS planned_slot (
  planned_slot_id    INTEGER PRIMARY KEY,
  planned_session_id INTEGER NOT NULL REFERENCES planned_session ON DELETE CASCADE,
  slot_index         INTEGER NOT NULL CHECK (slot_index >= 1),
  movement_id        INTEGER NOT NULL REFERENCES movement ON DELETE RESTRICT,
  sets               INTEGER NOT NULL CHECK (sets BETWEEN 1 AND 10),
  reps               INTEGER NOT NULL CHECK (reps BETWEEN 1 AND 30),
  target_rpe         REAL NOT NULL CHECK (target_rpe BETWEEN 5.0 AND 10.0),
  UNIQUE (planned_session_id, slot_index)
) STRICT;
