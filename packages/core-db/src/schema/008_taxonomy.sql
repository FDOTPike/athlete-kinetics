-- =============================================================================
-- 008_taxonomy.sql
-- Biomechanical taxonomy scaffold (ExRx-style) — SCHEMA ONLY, pre-Phase-10.
--
-- The shipped movement.pattern CHECK cannot be widened (append-only chain),
-- so classification lives in a side-car table. Phase 10's external training
-- laws will key on (category, implement, family); the block generator still
-- reads movement.pattern and is untouched by this migration.
--
-- Minimal viable skeleton by mandate: exactly ONE exercise per category,
-- mapped onto EXISTING canonical movements (no placeholder names in the
-- user-facing library). `family` groups implement variations of the same
-- movement (e.g. a future Dumbbell Bench Press joins family 'bench_press').
--
-- category/implement CHECK lists MUST mirror TAXONOMY_CATEGORIES /
-- TAXONOMY_IMPLEMENTS in packages/inference/src/types.ts (machine-checked
-- by verify:blocks).
-- =============================================================================
CREATE TABLE IF NOT EXISTS movement_taxonomy (
  movement_id INTEGER PRIMARY KEY REFERENCES movement ON DELETE CASCADE,
  category    TEXT NOT NULL CHECK (category IN
                ('push','row','hinge','squat','core','unilateral','accessory','cardio')),
  implement   TEXT NOT NULL DEFAULT 'bodyweight' CHECK (implement IN
                ('barbell','dumbbell','kettlebell','bodyweight','band','cable','machine','other')),
  -- Variation-family key: implement variants of one movement share it.
  family      TEXT
) STRICT;

-- One canonical exercise per category (seeded by name: works whether the
-- movement arrived via the 007 seed or a pre-007 demo install).
INSERT OR IGNORE INTO movement_taxonomy (movement_id, category, implement, family)
SELECT m.movement_id, e.column2, e.column3, e.column4
FROM (VALUES
  ('Competition Bench', 'push',       'barbell',    'bench_press'),
  ('Barbell Row',       'row',        'barbell',    'row'),
  ('Deadlift',          'hinge',      'barbell',    'deadlift'),
  ('Competition Squat', 'squat',      'barbell',    'back_squat'),
  ('Plank',             'core',       'bodyweight', 'plank'),
  ('Walking Lunge',     'unilateral', 'bodyweight', 'lunge'),
  ('Band Pull-Apart',   'accessory',  'band',       'pull_apart'),
  ('Road Run',          'cardio',     'bodyweight', 'run')
) AS e
JOIN movement m ON m.name = e.column1;
