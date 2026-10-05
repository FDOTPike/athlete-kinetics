-- =============================================================================
-- 037_movement_library_v2_batch.sql
-- Phase 2a curated batch: 15 movements (generated, additive, idempotent).
-- Coaching fingerprints deliberately exclude movement media.
-- =============================================================================

INSERT OR IGNORE INTO movement (name, pattern, primary_muscle, is_compound) VALUES
  ('3/4 Sit-Up', 'rotation', 'abdominals', 1),
  ('Alternate Hammer Curl', 'isolation', 'biceps', 0),
  ('Alternating Cable Shoulder Press', 'push_v', 'shoulders', 1),
  ('Alternating Floor Press', 'push_h', 'chest', 1),
  ('Alternating Kettlebell Press', 'push_v', 'shoulders', 1),
  ('Alternating Kettlebell Row', 'pull_h', 'middle back', 0),
  ('Back Flyes - With Bands', 'isolation', 'shoulders', 1),
  ('Band Good Morning (Pull Through)', 'hinge', 'hamstrings', 1),
  ('Barbell Bench Press - Medium Grip', 'push_h', 'chest', 1),
  ('Barbell Incline Bench Press - Medium Grip', 'push_h', 'chest', 1),
  ('Barbell Incline Shoulder Raise', 'isolation', 'shoulders', 1),
  ('Barbell Lunge', 'lunge', 'quadriceps', 1),
  ('Barbell Rollout from Bench', 'rotation', 'abdominals', 1),
  ('Barbell Shrug Behind The Back', 'isolation', 'traps', 0),
  ('Barbell Side Split Squat', 'lunge', 'quadriceps', 1);

INSERT INTO movement_detail
  (movement_id, base_name, supported_prefixes, difficulty_rating, target_muscles, instructions, cues, video_placeholder_uri)
VALUES
  ((SELECT movement_id FROM movement WHERE name = '3/4 Sit-Up'), '3/4 Sit-Up', '["Bodyweight"]', 'Beginner', '["abdominals"]', 'Set up 3/4 Sit-Up with a stable bodyweight start position and choose a load or range you can control. Brace before moving, then complete the trunk action through a range you can own without momentum. When momentum starts the rep, shorten the range and rebuild the brace.', 'Set the pelvis before the rep. Move through a braced trunk. Own the return without momentum.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Alternate Hammer Curl'), 'Alternate Hammer Curl', '["DB"]', 'Beginner', '["biceps","forearms"]', 'Set up Alternate Hammer Curl with dumbbells and choose a load or range you can control. Hold the upper arms still, curl the load through the forearms, and squeeze without lifting the shoulders. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Keep the upper arms quiet. Curl through the forearms. Own the lowering phase.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Cable Shoulder Press'), 'Alternating Cable Shoulder Press', '["Cable"]', 'Beginner', '["shoulders","triceps"]', 'Set up Alternating Cable Shoulder Press with cable machine and choose a load or range you can control. Organise the load at shoulder height, then press overhead while staying tall through the trunk. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Stay tall through the torso. Stack the wrists over the elbows. Finish overhead with a quiet ribcage.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Floor Press'), 'Alternating Floor Press', '["KB"]', 'Beginner', '["chest","abdominals","shoulders","triceps"]', 'Set up Alternating Floor Press with kettlebell and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Kettlebell Press'), 'Alternating Kettlebell Press', '["KB"]', 'Intermediate', '["shoulders","triceps"]', 'Set up Alternating Kettlebell Press with kettlebell and choose a load or range you can control. Organise the load at shoulder height, then press overhead while staying tall through the trunk. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Stay tall through the torso. Stack the wrists over the elbows. Finish overhead with a quiet ribcage.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Kettlebell Row'), 'Alternating Kettlebell Row', '["KB"]', 'Intermediate', '["middle back","biceps","lats"]', 'Set up Alternating Kettlebell Row with kettlebell and choose a load or range you can control. Reach into the start, then drive the elbows back until the upper back finishes the pull. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the torso before the pull. Lead with the elbows. Pause with the upper back engaged.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Back Flyes - With Bands'), 'Back Flyes - With Bands', '["Banded"]', 'Beginner', '["shoulders","middle back","triceps"]', 'Set up Back Flyes - With Bands with bands, squat rack and choose a load or range you can control. Move the arms through the intended arc with soft elbows and a shoulder position that stays set. When the torso swings, the load is stealing the rep; reset with less weight.', 'Set the shoulder blades before moving. Lead the rep through the elbows. Lower with the same smooth path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Band Good Morning (Pull Through)'), 'Band Good Morning (Pull Through)', '["Banded"]', 'Beginner', '["hamstrings","glutes","lower back"]', 'Set up Band Good Morning (Pull Through) with bands and choose a load or range you can control. Soften the knees, send the hips back until the posterior chain loads, and stand by driving the hips through. When the load leaves the hips and moves into the back, reduce the range or weight before the next rep.', 'Set the ribs down and brace first. Send the hips back into the load. Finish tall through the glutes.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Bench Press - Medium Grip'), 'Barbell Bench Press - Medium Grip', '["BB"]', 'Beginner', '["chest","shoulders","triceps"]', 'Set up Barbell Bench Press - Medium Grip with barbell, bench, squat rack and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Incline Bench Press - Medium Grip'), 'Barbell Incline Bench Press - Medium Grip', '["BB"]', 'Beginner', '["chest","shoulders","triceps"]', 'Set up Barbell Incline Bench Press - Medium Grip with barbell, bench, squat rack and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Incline Shoulder Raise'), 'Barbell Incline Shoulder Raise', '["BB"]', 'Beginner', '["shoulders","chest"]', 'Set up Barbell Incline Shoulder Raise with barbell, bench, squat rack and choose a load or range you can control. Move the arms through the intended arc with soft elbows and a shoulder position that stays set. When the torso swings, the load is stealing the rep; reset with less weight.', 'Set the shoulder blades before moving. Lead the rep through the elbows. Lower with the same smooth path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Lunge'), 'Barbell Lunge', '["BB"]', 'Intermediate', '["quadriceps","calves","glutes","hamstrings"]', 'Set up Barbell Lunge with barbell, squat rack and choose a load or range you can control. Move into a stable split stance, lower under control, and drive through the working foot to finish. When foot pressure rolls away from the working base, shorten the range and rebuild the next rep.', 'Build a stable split stance. Track the knee over the working foot. Drive through the whole foot to finish.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Rollout from Bench'), 'Barbell Rollout from Bench', '["BB"]', 'Intermediate', '["abdominals","glutes","hamstrings","lats","shoulders"]', 'Set up Barbell Rollout from Bench with barbell, bench and choose a load or range you can control. Brace before moving, then complete the trunk action through a range you can own without momentum. When momentum starts the rep, shorten the range and rebuild the brace.', 'Set the pelvis before the rep. Move through a braced trunk. Own the return without momentum.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Shrug Behind The Back'), 'Barbell Shrug Behind The Back', '["BB"]', 'Beginner', '["traps","forearms","middle back"]', 'Set up Barbell Shrug Behind The Back with barbell and choose a load or range you can control. Raise the shoulders up and back, pause behind the ears, and lower through the same path. When posture or foot strike changes, slow the pace before continuing.', 'Stand tall before the shrug. Drive the shoulders up and back behind the ears. Own the pause before lowering.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Side Split Squat'), 'Barbell Side Split Squat', '["BB"]', 'Beginner', '["quadriceps","calves","hamstrings","lower back"]', 'Set up Barbell Side Split Squat with barbell and choose a load or range you can control. Move into a stable split stance, lower under control, and drive through the working foot to finish. When foot pressure rolls away from the working base, shorten the range and rebuild the next rep.', 'Build a stable split stance. Track the knee over the working foot. Drive through the whole foot to finish.', '')
ON CONFLICT(movement_id) DO UPDATE SET
  base_name = excluded.base_name,
  supported_prefixes = excluded.supported_prefixes,
  difficulty_rating = excluded.difficulty_rating,
  target_muscles = excluded.target_muscles,
  instructions = excluded.instructions,
  cues = excluded.cues,
  video_placeholder_uri = '';

INSERT INTO movement_coaching_intent (movement_id, coaching_intent) VALUES
  ((SELECT movement_id FROM movement WHERE name = '3/4 Sit-Up'), 'Train abdominals with the specific loading and range of 3/4 Sit-Up while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Alternate Hammer Curl'), 'Train biceps with the specific loading and range of Alternate Hammer Curl while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Cable Shoulder Press'), 'Train shoulders with the specific loading and range of Alternating Cable Shoulder Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Floor Press'), 'Train chest with the specific loading and range of Alternating Floor Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Kettlebell Press'), 'Train shoulders with the specific loading and range of Alternating Kettlebell Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Kettlebell Row'), 'Train middle back with the specific loading and range of Alternating Kettlebell Row while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Back Flyes - With Bands'), 'Train shoulders with the specific loading and range of Back Flyes - With Bands while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Band Good Morning (Pull Through)'), 'Train hamstrings with the specific loading and range of Band Good Morning (Pull Through) while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Bench Press - Medium Grip'), 'Train chest with the specific loading and range of Barbell Bench Press - Medium Grip while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Incline Bench Press - Medium Grip'), 'Train chest with the specific loading and range of Barbell Incline Bench Press - Medium Grip while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Incline Shoulder Raise'), 'Train shoulders with the specific loading and range of Barbell Incline Shoulder Raise while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Lunge'), 'Train quadriceps with the specific loading and range of Barbell Lunge while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Rollout from Bench'), 'Train abdominals with the specific loading and range of Barbell Rollout from Bench while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Shrug Behind The Back'), 'Train traps with the specific loading and range of Barbell Shrug Behind The Back while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Side Split Squat'), 'Train quadriceps with the specific loading and range of Barbell Side Split Squat while keeping each rep technically honest.')
ON CONFLICT(movement_id) DO UPDATE SET coaching_intent = excluded.coaching_intent;

INSERT INTO movement_taxonomy (movement_id, category, implement, family) VALUES
  ((SELECT movement_id FROM movement WHERE name = '3/4 Sit-Up'), 'core', 'bodyweight', '3_4_sit_up'),
  ((SELECT movement_id FROM movement WHERE name = 'Alternate Hammer Curl'), 'accessory', 'dumbbell', 'alternate_hammer_curl'),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Cable Shoulder Press'), 'push', 'cable', 'alternating_cable_shoulder_press'),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Floor Press'), 'push', 'kettlebell', 'alternating_floor_press'),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Kettlebell Press'), 'push', 'kettlebell', 'alternating_kettlebell_press'),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Kettlebell Row'), 'row', 'kettlebell', 'alternating_kettlebell_row'),
  ((SELECT movement_id FROM movement WHERE name = 'Back Flyes - With Bands'), 'accessory', 'band', 'back_flyes_with_bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Band Good Morning (Pull Through)'), 'hinge', 'band', 'band_good_morning_pull_through'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Bench Press - Medium Grip'), 'push', 'barbell', 'barbell_bench_press_medium_grip'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Incline Bench Press - Medium Grip'), 'push', 'barbell', 'barbell_incline_bench_press_medium_grip'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Incline Shoulder Raise'), 'accessory', 'barbell', 'barbell_incline_shoulder_raise'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Lunge'), 'unilateral', 'barbell', 'barbell_lunge'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Rollout from Bench'), 'core', 'barbell', 'barbell_rollout_from_bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Shrug Behind The Back'), 'row', 'barbell', 'barbell_shrug_behind_the_back'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Side Split Squat'), 'unilateral', 'barbell', 'barbell_side_split_squat')
ON CONFLICT(movement_id) DO UPDATE SET
  category = excluded.category, implement = excluded.implement, family = excluded.family;

INSERT OR IGNORE INTO movement_equipment (movement_id, item) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Alternate Hammer Curl'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Cable Shoulder Press'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Floor Press'), 'kettlebell'),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Kettlebell Press'), 'kettlebell'),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Kettlebell Row'), 'kettlebell'),
  ((SELECT movement_id FROM movement WHERE name = 'Back Flyes - With Bands'), 'bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Back Flyes - With Bands'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Band Good Morning (Pull Through)'), 'bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Bench Press - Medium Grip'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Bench Press - Medium Grip'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Bench Press - Medium Grip'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Incline Bench Press - Medium Grip'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Incline Bench Press - Medium Grip'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Incline Bench Press - Medium Grip'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Incline Shoulder Raise'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Incline Shoulder Raise'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Incline Shoulder Raise'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Lunge'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Lunge'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Rollout from Bench'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Rollout from Bench'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Shrug Behind The Back'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Side Split Squat'), 'barbell');

INSERT INTO movement_media (movement_id, asset_key, status, revision) VALUES
  ((SELECT movement_id FROM movement WHERE name = '3/4 Sit-Up'), 'movement/3-4-sit-up/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Alternate Hammer Curl'), 'movement/alternate-hammer-curl/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Cable Shoulder Press'), 'movement/alternating-cable-shoulder-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Floor Press'), 'movement/alternating-floor-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Kettlebell Press'), 'movement/alternating-kettlebell-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Kettlebell Row'), 'movement/alternating-kettlebell-row/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Back Flyes - With Bands'), 'movement/back-flyes-with-bands/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Band Good Morning (Pull Through)'), 'movement/band-good-morning-pull-through/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Bench Press - Medium Grip'), 'movement/barbell-bench-press-medium-grip/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Incline Bench Press - Medium Grip'), 'movement/barbell-incline-bench-press-medium-grip/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Incline Shoulder Raise'), 'movement/barbell-incline-shoulder-raise/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Lunge'), 'movement/barbell-lunge/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Rollout from Bench'), 'movement/barbell-rollout-from-bench/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Shrug Behind The Back'), 'movement/barbell-shrug-behind-the-back/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Side Split Squat'), 'movement/barbell-side-split-squat/demo/v1', 'planned', 1)
ON CONFLICT(movement_id) DO UPDATE SET
  asset_key = excluded.asset_key, status = 'planned', revision = 1;
