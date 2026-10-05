-- =============================================================================
-- 056_movement_taxonomy_backfill.sql
-- Backfill the 21 missing movement_taxonomy rows so every row in movement
-- has exactly one taxonomy row.
-- Seeded BY NAME (same pattern as 008_taxonomy.sql) for ordering independence.
-- =============================================================================
INSERT OR IGNORE INTO movement_taxonomy (movement_id, category, implement, family)
SELECT m.movement_id, e.column2, e.column3, e.column4
FROM (VALUES
  ('Front Squat',             'squat',      'barbell',    'front_squat'),
  ('Goblet Squat',            'squat',      'kettlebell', 'goblet_squat'),
  ('Bodyweight Squat',        'squat',      'bodyweight', 'back_squat'),
  ('Overhead Press',          'push',       'barbell',    'overhead_press'),
  ('Dumbbell Shoulder Press', 'push',       'dumbbell',   'overhead_press'),
  ('Dumbbell Bench Press',    'push',       'dumbbell',   'bench_press'),
  ('Push-up',                 'push',       'bodyweight', 'push_up'),
  ('Chin-up',                 'row',        'bodyweight', 'pull_up'),
  ('Weighted Pull-up',        'row',        'bodyweight', 'pull_up'),
  ('Lat Pulldown',            'row',        'cable',      'lat_pulldown'),
  ('Cable Row',               'row',        'cable',      'row'),
  ('Band Row',                'row',        'band',       'row'),
  ('Single-Arm Dumbbell Row', 'row',        'dumbbell',   'row'),
  ('Romanian Deadlift',       'hinge',      'barbell',    'romanian_deadlift'),
  ('Kettlebell Swing',        'hinge',      'kettlebell', 'kettlebell_swing'),
  ('Glute Bridge',            'hinge',      'bodyweight', 'glute_bridge'),
  ('Bulgarian Split Squat',   'unilateral', 'bodyweight', 'split_squat'),
  ('Farmer Carry',            'accessory',  'dumbbell',   'farmer_carry'),
  ('Suitcase Carry',          'accessory',  'dumbbell',   'suitcase_carry'),
  ('Nordic Curl',             'accessory',  'bodyweight', 'nordic_curl'),
  ('Pallof Press',            'core',       'cable',      'pallof_press')
) AS e
JOIN movement m ON m.name = e.column1;
