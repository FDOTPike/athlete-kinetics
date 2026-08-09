-- =============================================================================
-- 043_movement_library_v2_batch.sql
-- Phase 2a curated batch: 15 movements (generated, additive, idempotent).
-- Coaching fingerprints deliberately exclude movement media.
-- =============================================================================

INSERT OR IGNORE INTO movement (name, pattern, primary_muscle, is_compound) VALUES
  ('Incline Barbell Triceps Extension', 'isolation', 'triceps', 0),
  ('Incline Cable Chest Press', 'push_h', 'chest', 1),
  ('Incline Cable Flye', 'push_h', 'chest', 0),
  ('Incline Dumbbell Bench With Palms Facing In', 'push_h', 'chest', 1),
  ('Incline Dumbbell Curl', 'isolation', 'biceps', 0),
  ('Incline Dumbbell Flyes', 'push_h', 'chest', 1),
  ('Incline Hammer Curls', 'isolation', 'biceps', 0),
  ('Incline Push-Up Close-Grip', 'push_h', 'triceps', 1),
  ('Incline Push-Up Wide', 'push_h', 'chest', 1),
  ('Internal Rotation with Band', 'isolation', 'shoulders', 0),
  ('Jackknife Sit-Up', 'rotation', 'abdominals', 1),
  ('Janda Sit-Up', 'rotation', 'abdominals', 0),
  ('JM Press', 'push_h', 'triceps', 1),
  ('Kettlebell Arnold Press', 'push_v', 'shoulders', 1),
  ('Kettlebell Seated Press', 'push_h', 'shoulders', 1);

INSERT INTO movement_detail
  (movement_id, base_name, supported_prefixes, difficulty_rating, target_muscles, instructions, cues, video_placeholder_uri)
VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Incline Barbell Triceps Extension'), 'Incline Barbell Triceps Extension', '["BB"]', 'Intermediate', '["triceps","forearms"]', 'Set up Incline Barbell Triceps Extension with barbell, bench and choose a load or range you can control. Keep the elbows organised while the forearms extend, then return into a controlled stretch. When the elbows chase the load, the extension has lost its line; shorten the range or load.', 'Aim the elbows through one steady line. Extend through the forearms. Control the return into the stretch.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Cable Chest Press'), 'Incline Cable Chest Press', '["Cable"]', 'Beginner', '["chest","shoulders","triceps"]', 'Set up Incline Cable Chest Press with cable machine and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Cable Flye'), 'Incline Cable Flye', '["Cable"]', 'Intermediate', '["chest","shoulders"]', 'Set up Incline Cable Flye with bench, cable machine and choose a load or range you can control. Move the arms through the intended arc with soft elbows and a shoulder position that stays set. When the torso swings, the load is stealing the rep; reset with less weight.', 'Set the shoulder blades before moving. Lead the rep through the elbows. Lower with the same smooth path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Bench With Palms Facing In'), 'Incline Dumbbell Bench With Palms Facing In', '["DB"]', 'Beginner', '["chest","shoulders","triceps"]', 'Set up Incline Dumbbell Bench With Palms Facing In with bench, dumbbells and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Curl'), 'Incline Dumbbell Curl', '["DB"]', 'Beginner', '["biceps"]', 'Set up Incline Dumbbell Curl with bench, dumbbells and choose a load or range you can control. Hold the upper arms still, curl the load through the forearms, and squeeze without lifting the shoulders. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Keep the upper arms quiet. Curl through the forearms. Own the lowering phase.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Flyes'), 'Incline Dumbbell Flyes', '["DB"]', 'Beginner', '["chest","shoulders"]', 'Set up Incline Dumbbell Flyes with bench, dumbbells and choose a load or range you can control. Move the arms through the intended arc with soft elbows and a shoulder position that stays set. When the torso swings, the load is stealing the rep; reset with less weight.', 'Set the shoulder blades before moving. Lead the rep through the elbows. Lower with the same smooth path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Hammer Curls'), 'Incline Hammer Curls', '["DB"]', 'Beginner', '["biceps"]', 'Set up Incline Hammer Curls with bench, dumbbells and choose a load or range you can control. Hold the upper arms still, curl the load through the forearms, and squeeze without lifting the shoulders. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Keep the upper arms quiet. Curl through the forearms. Own the lowering phase.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Push-Up Close-Grip'), 'Incline Push-Up Close-Grip', '["Bodyweight"]', 'Beginner', '["triceps","chest","shoulders"]', 'Set up Incline Push-Up Close-Grip with a stable bodyweight start position and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Push-Up Wide'), 'Incline Push-Up Wide', '["Bodyweight"]', 'Beginner', '["chest","abdominals","shoulders","triceps"]', 'Set up Incline Push-Up Wide with a stable bodyweight start position and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Internal Rotation with Band'), 'Internal Rotation with Band', '["Banded"]', 'Beginner', '["shoulders"]', 'Set up Internal Rotation with Band with bands and choose a load or range you can control. Keep the elbow anchored and rotate the forearm through the range the shoulder can own. When posture or foot strike changes, slow the pace before continuing.', 'Pin the elbow in place. Rotate through an owned range. Keep the torso quiet on the return.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Jackknife Sit-Up'), 'Jackknife Sit-Up', '["Bodyweight"]', 'Beginner', '["abdominals"]', 'Set up Jackknife Sit-Up with a stable bodyweight start position and choose a load or range you can control. Brace before moving, then complete the trunk action through a range you can own without momentum. When momentum starts the rep, shorten the range and rebuild the brace.', 'Set the pelvis before the rep. Move through a braced trunk. Own the return without momentum.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Janda Sit-Up'), 'Janda Sit-Up', '["Bodyweight"]', 'Beginner', '["abdominals"]', 'Set up Janda Sit-Up with a stable bodyweight start position and choose a load or range you can control. Brace before moving, then complete the trunk action through a range you can own without momentum. When momentum starts the rep, shorten the range and rebuild the brace.', 'Set the pelvis before the rep. Move through a braced trunk. Own the return without momentum.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'JM Press'), 'JM Press', '["BB"]', 'Beginner', '["triceps","chest","shoulders"]', 'Set up JM Press with barbell, bench and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Arnold Press'), 'Kettlebell Arnold Press', '["KB"]', 'Intermediate', '["shoulders","triceps"]', 'Set up Kettlebell Arnold Press with kettlebell and choose a load or range you can control. Organise the load at shoulder height, then press overhead while staying tall through the trunk. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Stay tall through the torso. Stack the wrists over the elbows. Finish overhead with a quiet ribcage.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Seated Press'), 'Kettlebell Seated Press', '["KB"]', 'Intermediate', '["shoulders","triceps"]', 'Set up Kettlebell Seated Press with kettlebell and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', '')
ON CONFLICT(movement_id) DO UPDATE SET
  base_name = excluded.base_name,
  supported_prefixes = excluded.supported_prefixes,
  difficulty_rating = excluded.difficulty_rating,
  target_muscles = excluded.target_muscles,
  instructions = excluded.instructions,
  cues = excluded.cues,
  video_placeholder_uri = '';

INSERT INTO movement_coaching_intent (movement_id, coaching_intent) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Incline Barbell Triceps Extension'), 'Train triceps with the specific loading and range of Incline Barbell Triceps Extension while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Cable Chest Press'), 'Train chest with the specific loading and range of Incline Cable Chest Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Cable Flye'), 'Train chest with the specific loading and range of Incline Cable Flye while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Bench With Palms Facing In'), 'Train chest with the specific loading and range of Incline Dumbbell Bench With Palms Facing In while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Curl'), 'Train biceps with the specific loading and range of Incline Dumbbell Curl while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Flyes'), 'Train chest with the specific loading and range of Incline Dumbbell Flyes while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Hammer Curls'), 'Train biceps with the specific loading and range of Incline Hammer Curls while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Push-Up Close-Grip'), 'Train triceps with the specific loading and range of Incline Push-Up Close-Grip while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Push-Up Wide'), 'Train chest with the specific loading and range of Incline Push-Up Wide while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Internal Rotation with Band'), 'Train shoulders with the specific loading and range of Internal Rotation with Band while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Jackknife Sit-Up'), 'Train abdominals with the specific loading and range of Jackknife Sit-Up while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Janda Sit-Up'), 'Train abdominals with the specific loading and range of Janda Sit-Up while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'JM Press'), 'Train triceps with the specific loading and range of JM Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Arnold Press'), 'Train shoulders with the specific loading and range of Kettlebell Arnold Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Seated Press'), 'Train shoulders with the specific loading and range of Kettlebell Seated Press while keeping each rep technically honest.')
ON CONFLICT(movement_id) DO UPDATE SET coaching_intent = excluded.coaching_intent;

INSERT INTO movement_taxonomy (movement_id, category, implement, family) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Incline Barbell Triceps Extension'), 'accessory', 'barbell', 'incline_barbell_triceps_extension'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Cable Chest Press'), 'push', 'cable', 'incline_cable_chest_press'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Cable Flye'), 'push', 'cable', 'incline_cable_flye'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Bench With Palms Facing In'), 'push', 'dumbbell', 'incline_dumbbell_bench_with_palms_facing_in'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Curl'), 'accessory', 'dumbbell', 'incline_dumbbell_curl'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Flyes'), 'push', 'dumbbell', 'incline_dumbbell_flyes'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Hammer Curls'), 'accessory', 'dumbbell', 'incline_hammer_curls'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Push-Up Close-Grip'), 'push', 'bodyweight', 'incline_push_up_close_grip'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Push-Up Wide'), 'push', 'bodyweight', 'incline_push_up_wide'),
  ((SELECT movement_id FROM movement WHERE name = 'Internal Rotation with Band'), 'accessory', 'band', 'internal_rotation_with_band'),
  ((SELECT movement_id FROM movement WHERE name = 'Jackknife Sit-Up'), 'core', 'bodyweight', 'jackknife_sit_up'),
  ((SELECT movement_id FROM movement WHERE name = 'Janda Sit-Up'), 'core', 'bodyweight', 'janda_sit_up'),
  ((SELECT movement_id FROM movement WHERE name = 'JM Press'), 'push', 'barbell', 'jm_press'),
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Arnold Press'), 'push', 'kettlebell', 'kettlebell_arnold_press'),
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Seated Press'), 'push', 'kettlebell', 'kettlebell_seated_press')
ON CONFLICT(movement_id) DO UPDATE SET
  category = excluded.category, implement = excluded.implement, family = excluded.family;

INSERT OR IGNORE INTO movement_equipment (movement_id, item) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Incline Barbell Triceps Extension'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Barbell Triceps Extension'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Cable Chest Press'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Cable Flye'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Cable Flye'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Bench With Palms Facing In'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Bench With Palms Facing In'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Curl'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Curl'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Flyes'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Flyes'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Hammer Curls'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Hammer Curls'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Internal Rotation with Band'), 'bands'),
  ((SELECT movement_id FROM movement WHERE name = 'JM Press'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'JM Press'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Arnold Press'), 'kettlebell'),
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Seated Press'), 'kettlebell');

INSERT INTO movement_media (movement_id, asset_key, status, revision) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Incline Barbell Triceps Extension'), 'movement/incline-barbell-triceps-extension/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Cable Chest Press'), 'movement/incline-cable-chest-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Cable Flye'), 'movement/incline-cable-flye/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Bench With Palms Facing In'), 'movement/incline-dumbbell-bench-with-palms-facing-in/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Curl'), 'movement/incline-dumbbell-curl/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Flyes'), 'movement/incline-dumbbell-flyes/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Hammer Curls'), 'movement/incline-hammer-curls/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Push-Up Close-Grip'), 'movement/incline-push-up-close-grip/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Push-Up Wide'), 'movement/incline-push-up-wide/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Internal Rotation with Band'), 'movement/internal-rotation-with-band/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Jackknife Sit-Up'), 'movement/jackknife-sit-up/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Janda Sit-Up'), 'movement/janda-sit-up/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'JM Press'), 'movement/jm-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Arnold Press'), 'movement/kettlebell-arnold-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Seated Press'), 'movement/kettlebell-seated-press/demo/v1', 'planned', 1)
ON CONFLICT(movement_id) DO UPDATE SET
  asset_key = excluded.asset_key, status = 'planned', revision = 1;
