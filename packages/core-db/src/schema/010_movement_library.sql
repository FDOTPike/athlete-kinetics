-- =============================================================================
-- 010_movement_library.sql
-- Phase 12: normalized movement metadata, dynamic prefix engine, and the
-- per-athlete sentiment map (thumbs up/down) the deterministic block engine
-- reads during substitution routing.
--
-- (Mandated as "008_movement_library.sql"; 008 shipped as the taxonomy
-- scaffold and 009 as the periodization side-cars — renumbered to 010, the
-- next free slot in the append-only chain. Same renumber the 009 header
-- records for its own "008" mandate.)
--
-- WHY SIDE-CARS, NOT A NEW MONOLITHIC movement_library TABLE:
--   * The shipped `movement` table (001) has 30 rows that planned_slot,
--     movement_equipment, movement_taxonomy, and one_rep_max all FK against.
--     It cannot gain columns idempotently (ALTER ADD COLUMN fails on the
--     self-heal re-apply path), and the rows cannot be deleted/repointed
--     without cascading the block engine. So Phase 12's per-movement
--     extensions key on movement_id, exactly like 009's one_rep_max /
--     block_meta / slot_override.
--   * "Store the base pattern once" is satisfied by base_name + the runtime
--     prefix dropdown: the implement variant is NOT a new row, it is a
--     display-time prepend (movement_detail.supported_prefixes) carried into
--     the session-log payload as metadata. No equipment row duplication.
--
-- Two tables, separated by mutability (memory + GC discipline):
--   (1) movement_detail — immutable reference data, load-once, never dirtied
--       by a write. ~30 small rows.
--   (2) movement_preference — mutable per-athlete sentiment. NOT pre-seeded:
--       a row materializes only when the athlete taps thumbs (absence == 0 /
--       neutral), so the table stays empty until used. Zero idle footprint.
--
-- CONTRACT MIRRORS (machine-checked by verify:blocks):
--   * difficulty_rating CHECK  <-> DIFFICULTY_RATINGS in inference/types.ts
--   * preference CHECK domain   <-> MOVEMENT_PREFERENCE in inference/types.ts
--   * every supported_prefixes token is a member of MOVEMENT_PREFIXES.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- (1) movement_detail — normalized base pattern + dynamic prefix set +
-- reference metadata. STRICT, 1:1 with movement.
-- supported_prefixes is a JSON array of MOVEMENT_PREFIXES tokens (the UI
-- dropdown); element membership is machine-checked, not SQL-checked, mirroring
-- the 007 equipment_inventory precedent (CHECK json_valid + verify:blocks).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movement_detail (
  movement_id           INTEGER PRIMARY KEY REFERENCES movement ON DELETE CASCADE,
  -- The normalized biomechanical base, stored ONCE per pattern. Implement
  -- variants share a base_name (it doubles as the variation-family key).
  base_name             TEXT NOT NULL,
  -- JSON array of valid prefix tokens for this pattern, e.g. '["BB","DB"]'.
  supported_prefixes    TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(supported_prefixes)),
  difficulty_rating     TEXT NOT NULL DEFAULT 'Intermediate'
                          CHECK (difficulty_rating IN ('Beginner','Intermediate','Advanced')),
  target_muscles        TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(target_muscles)),
  instructions          TEXT NOT NULL DEFAULT '',
  cues                  TEXT NOT NULL DEFAULT '',
  video_placeholder_uri TEXT NOT NULL DEFAULT ''
) STRICT;

-- Seeded by name (not id) so rows attach correctly however the movement
-- arrived (007 seed, or a pre-007 demo install). instructions/cues/video
-- intentionally default to '' — they are text blobs the UI layer populates
-- later; seeding them here would bloat the migration string for no engine use.
INSERT OR IGNORE INTO movement_detail
  (movement_id, base_name, supported_prefixes, difficulty_rating, target_muscles)
SELECT m.movement_id, e.column2, e.column3, e.column4, e.column5
FROM (VALUES
  ('Competition Squat',       'Back Squat',        '["BB"]',                 'Advanced',     '["quadriceps","glutes","spinal_erectors"]'),
  ('Deadlift',                'Deadlift',          '["BB"]',                 'Advanced',     '["glutes","hamstrings","spinal_erectors","lats"]'),
  ('Competition Bench',       'Bench Press',       '["BB","DB"]',            'Advanced',     '["pectorals","anterior_deltoids","triceps"]'),
  ('Overhead Press',          'Overhead Press',    '["BB","DB","KB"]',       'Intermediate', '["deltoids","triceps","upper_chest"]'),
  ('Barbell Row',             'Bent-Over Row',     '["BB","DB"]',            'Intermediate', '["lats","rhomboids","rear_deltoids","biceps"]'),
  ('Weighted Pull-up',        'Pull-up',           '["Bodyweight","Banded"]','Advanced',     '["lats","biceps","rhomboids"]'),
  ('BJJ Sparring Round',      'Sparring Round',    '["Bodyweight"]',         'Advanced',     '["full_body"]'),
  ('Front Squat',             'Front Squat',       '["BB","KB"]',            'Intermediate', '["quadriceps","glutes","upper_back"]'),
  ('Romanian Deadlift',       'Romanian Deadlift', '["BB","DB"]',            'Intermediate', '["hamstrings","glutes","spinal_erectors"]'),
  ('Dumbbell Bench Press',    'Bench Press',       '["BB","DB"]',            'Intermediate', '["pectorals","anterior_deltoids","triceps"]'),
  ('Dumbbell Shoulder Press', 'Overhead Press',    '["BB","DB","KB"]',       'Intermediate', '["deltoids","triceps"]'),
  ('Single-Arm Dumbbell Row', 'Bent-Over Row',     '["DB","KB"]',            'Beginner',     '["lats","rhomboids","biceps"]'),
  ('Chin-up',                 'Pull-up',           '["Bodyweight","Banded"]','Intermediate', '["lats","biceps"]'),
  ('Goblet Squat',            'Goblet Squat',      '["DB","KB"]',            'Beginner',     '["quadriceps","glutes"]'),
  ('Kettlebell Swing',        'Kettlebell Swing',  '["KB"]',                 'Intermediate', '["glutes","hamstrings","spinal_erectors"]'),
  ('Push-up',                 'Push-up',           '["Bodyweight","Banded"]','Beginner',     '["pectorals","triceps","anterior_deltoids"]'),
  ('Walking Lunge',           'Lunge',             '["Bodyweight","DB","BB"]','Beginner',    '["quadriceps","glutes","hamstrings"]'),
  ('Bulgarian Split Squat',   'Split Squat',       '["Bodyweight","DB","BB"]','Intermediate','["quadriceps","glutes"]'),
  ('Farmer Carry',            'Loaded Carry',      '["DB","KB"]',            'Beginner',     '["forearms","trapezius","core"]'),
  ('Suitcase Carry',          'Suitcase Carry',    '["KB","DB"]',            'Beginner',     '["obliques","forearms","trapezius"]'),
  ('Lat Pulldown',            'Lat Pulldown',      '["Cable"]',              'Beginner',     '["lats","biceps"]'),
  ('Cable Row',               'Seated Row',        '["Cable"]',              'Beginner',     '["lats","rhomboids","biceps"]'),
  ('Nordic Curl',             'Nordic Curl',       '["Bodyweight","Banded"]','Advanced',     '["hamstrings"]'),
  ('Band Pull-Apart',         'Pull-Apart',        '["Banded"]',             'Beginner',     '["rear_deltoids","rhomboids"]'),
  ('Pallof Press',            'Pallof Press',      '["Cable","Banded"]',     'Beginner',     '["obliques","core"]'),
  ('Plank',                   'Plank',             '["Bodyweight"]',         'Beginner',     '["core","abdominals"]'),
  ('Road Run',                'Run',               '["Bodyweight"]',         'Beginner',     '["quadriceps","calves","cardiovascular"]'),
  ('Bodyweight Squat',        'Air Squat',         '["Bodyweight"]',         'Beginner',     '["quadriceps","glutes"]'),
  ('Glute Bridge',            'Glute Bridge',      '["Bodyweight","BB"]',    'Beginner',     '["glutes","hamstrings"]'),
  ('Band Row',                'Band Row',          '["Banded"]',             'Beginner',     '["lats","rhomboids","biceps"]')
) AS e
JOIN movement m ON m.name = e.column1;

-- ---------------------------------------------------------------------------
-- (2) movement_preference — the heuristic feedback loop (thumbs up/down).
--   +1  Prioritize : bias the deterministic substitution router toward this.
--    0  Neutral    : default; represented by the ABSENCE of a row.
--   -1  Avoid      : hard-exclude from automated prescriptions/suggestions.
-- Mutable per-athlete state, kept apart from immutable movement_detail so a
-- write never dirties the reference cache. Not seeded — empty until used.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movement_preference (
  movement_id   INTEGER PRIMARY KEY REFERENCES movement ON DELETE CASCADE,
  preference    INTEGER NOT NULL DEFAULT 0 CHECK (preference IN (-1, 0, 1)),
  updated_at_ms INTEGER NOT NULL DEFAULT 0
) STRICT;
