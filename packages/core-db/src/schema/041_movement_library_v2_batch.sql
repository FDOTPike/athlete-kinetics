-- =============================================================================
-- 041_movement_library_v2_batch.sql
-- Phase 2a curated batch: 15 movements (generated, additive, idempotent).
-- Coaching fingerprints deliberately exclude movement media.
-- =============================================================================

INSERT OR IGNORE INTO movement (name, pattern, primary_muscle, is_compound) VALUES
  ('Dumbbell Bench Press with Neutral Grip', 'push_h', 'chest', 1),
  ('Dumbbell Bicep Curl', 'isolation', 'biceps', 0),
  ('Dumbbell Incline Shoulder Raise', 'isolation', 'shoulders', 0),
  ('Dumbbell Lying Rear Lateral Raise', 'isolation', 'shoulders', 0),
  ('Dumbbell One-Arm Shoulder Press', 'push_v', 'shoulders', 1),
  ('Dumbbell Prone Incline Curl', 'isolation', 'biceps', 0),
  ('Dumbbell Seated One-Leg Calf Raise', 'isolation', 'calves', 0),
  ('Dumbbell Squat To A Bench', 'squat', 'quadriceps', 1),
  ('Dumbbell Tricep Extension -Pronated Grip', 'isolation', 'triceps', 0),
  ('Elevated Back Lunge', 'lunge', 'quadriceps', 1),
  ('Elevated Cable Rows', 'pull_h', 'lats', 1),
  ('Extended Range One-Arm Kettlebell Floor Press', 'push_h', 'chest', 1),
  ('External Rotation', 'isolation', 'shoulders', 0),
  ('External Rotation with Cable', 'isolation', 'shoulders', 0),
  ('EZ-Bar Curl', 'isolation', 'biceps', 0);

INSERT INTO movement_detail
  (movement_id, base_name, supported_prefixes, difficulty_rating, target_muscles, instructions, cues, video_placeholder_uri)
VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Bench Press with Neutral Grip'), 'Dumbbell Bench Press with Neutral Grip', '["DB"]', 'Beginner', '["chest","shoulders","triceps"]', 'Set up Dumbbell Bench Press with Neutral Grip with bench, dumbbells and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Bicep Curl'), 'Dumbbell Bicep Curl', '["DB"]', 'Beginner', '["biceps","forearms"]', 'Set up Dumbbell Bicep Curl with dumbbells and choose a load or range you can control. Hold the upper arms still, curl the load through the forearms, and squeeze without lifting the shoulders. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Keep the upper arms quiet. Curl through the forearms. Own the lowering phase.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Incline Shoulder Raise'), 'Dumbbell Incline Shoulder Raise', '["DB"]', 'Beginner', '["shoulders","triceps"]', 'Set up Dumbbell Incline Shoulder Raise with bench, dumbbells and choose a load or range you can control. Move the arms through the intended arc with soft elbows and a shoulder position that stays set. When the torso swings, the load is stealing the rep; reset with less weight.', 'Set the shoulder blades before moving. Lead the rep through the elbows. Lower with the same smooth path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Lying Rear Lateral Raise'), 'Dumbbell Lying Rear Lateral Raise', '["DB"]', 'Intermediate', '["shoulders"]', 'Set up Dumbbell Lying Rear Lateral Raise with bench, dumbbells and choose a load or range you can control. Move the arms through the intended arc with soft elbows and a shoulder position that stays set. When the torso swings, the load is stealing the rep; reset with less weight.', 'Set the shoulder blades before moving. Lead the rep through the elbows. Lower with the same smooth path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell One-Arm Shoulder Press'), 'Dumbbell One-Arm Shoulder Press', '["DB"]', 'Intermediate', '["shoulders","triceps"]', 'Set up Dumbbell One-Arm Shoulder Press with bench, dumbbells and choose a load or range you can control. Organise the load at shoulder height, then press overhead while staying tall through the trunk. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Stay tall through the torso. Stack the wrists over the elbows. Finish overhead with a quiet ribcage.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Prone Incline Curl'), 'Dumbbell Prone Incline Curl', '["DB"]', 'Intermediate', '["biceps"]', 'Set up Dumbbell Prone Incline Curl with bench, dumbbells and choose a load or range you can control. Hold the upper arms still, curl the load through the forearms, and squeeze without lifting the shoulders. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Keep the upper arms quiet. Curl through the forearms. Own the lowering phase.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Seated One-Leg Calf Raise'), 'Dumbbell Seated One-Leg Calf Raise', '["DB"]', 'Beginner', '["calves"]', 'Set up Dumbbell Seated One-Leg Calf Raise with bench, dumbbells and choose a load or range you can control. Rise through the ball of the working foot, pause at the top, and lower the heel under control. When the torso swings, the load is stealing the rep; reset with less weight.', 'Keep pressure through the ball of the foot. Rise as tall as the ankle allows. Lower through a controlled stretch.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Squat To A Bench'), 'Dumbbell Squat To A Bench', '["DB"]', 'Intermediate', '["quadriceps","calves","glutes","hamstrings","lower back"]', 'Set up Dumbbell Squat To A Bench with bench, dumbbells and choose a load or range you can control. Sit between the hips under control, keep pressure through the whole foot, and stand through the same path. When foot pressure rolls away from the working base, shorten the range and rebuild the next rep.', 'Brace before the descent. Keep pressure through the whole foot. Drive the floor away to stand.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Tricep Extension -Pronated Grip'), 'Dumbbell Tricep Extension -Pronated Grip', '["DB"]', 'Beginner', '["triceps"]', 'Set up Dumbbell Tricep Extension -Pronated Grip with bench, dumbbells and choose a load or range you can control. Keep the elbows organised while the forearms extend, then return into a controlled stretch. When the elbows chase the load, the extension has lost its line; shorten the range or load.', 'Aim the elbows through one steady line. Extend through the forearms. Control the return into the stretch.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Elevated Back Lunge'), 'Elevated Back Lunge', '["BB"]', 'Intermediate', '["quadriceps","glutes","hamstrings"]', 'Set up Elevated Back Lunge with barbell, squat rack and choose a load or range you can control. Move into a stable split stance, lower under control, and drive through the working foot to finish. When foot pressure rolls away from the working base, shorten the range and rebuild the next rep.', 'Build a stable split stance. Track the knee over the working foot. Drive through the whole foot to finish.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Elevated Cable Rows'), 'Elevated Cable Rows', '["Cable"]', 'Intermediate', '["lats","middle back","traps"]', 'Set up Elevated Cable Rows with cable machine and choose a load or range you can control. Reach into the start, then drive the elbows back until the upper back finishes the pull. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the torso before the pull. Lead with the elbows. Pause with the upper back engaged.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Extended Range One-Arm Kettlebell Floor Press'), 'Extended Range One-Arm Kettlebell Floor Press', '["KB"]', 'Beginner', '["chest","shoulders","triceps"]', 'Set up Extended Range One-Arm Kettlebell Floor Press with kettlebell and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'External Rotation'), 'External Rotation', '["DB"]', 'Beginner', '["shoulders"]', 'Set up External Rotation with bench, dumbbells and choose a load or range you can control. Keep the elbow anchored and rotate the forearm through the range the shoulder can own. When posture or foot strike changes, slow the pace before continuing.', 'Pin the elbow in place. Rotate through an owned range. Keep the torso quiet on the return.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'External Rotation with Cable'), 'External Rotation with Cable', '["Cable"]', 'Beginner', '["shoulders"]', 'Set up External Rotation with Cable with bands, cable machine and choose a load or range you can control. Keep the elbow anchored and rotate the forearm through the range the shoulder can own. When posture or foot strike changes, slow the pace before continuing.', 'Pin the elbow in place. Rotate through an owned range. Keep the torso quiet on the return.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'EZ-Bar Curl'), 'EZ-Bar Curl', '["BB"]', 'Beginner', '["biceps"]', 'Set up EZ-Bar Curl with barbell and choose a load or range you can control. Hold the upper arms still, curl the load through the forearms, and squeeze without lifting the shoulders. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Keep the upper arms quiet. Curl through the forearms. Own the lowering phase.', '')
ON CONFLICT(movement_id) DO UPDATE SET
  base_name = excluded.base_name,
  supported_prefixes = excluded.supported_prefixes,
  difficulty_rating = excluded.difficulty_rating,
  target_muscles = excluded.target_muscles,
  instructions = excluded.instructions,
  cues = excluded.cues,
  video_placeholder_uri = '';

INSERT INTO movement_coaching_intent (movement_id, coaching_intent) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Bench Press with Neutral Grip'), 'Train chest with the specific loading and range of Dumbbell Bench Press with Neutral Grip while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Bicep Curl'), 'Train biceps with the specific loading and range of Dumbbell Bicep Curl while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Incline Shoulder Raise'), 'Train shoulders with the specific loading and range of Dumbbell Incline Shoulder Raise while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Lying Rear Lateral Raise'), 'Train shoulders with the specific loading and range of Dumbbell Lying Rear Lateral Raise while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell One-Arm Shoulder Press'), 'Train shoulders with the specific loading and range of Dumbbell One-Arm Shoulder Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Prone Incline Curl'), 'Train biceps with the specific loading and range of Dumbbell Prone Incline Curl while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Seated One-Leg Calf Raise'), 'Train calves with the specific loading and range of Dumbbell Seated One-Leg Calf Raise while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Squat To A Bench'), 'Train quadriceps with the specific loading and range of Dumbbell Squat To A Bench while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Tricep Extension -Pronated Grip'), 'Train triceps with the specific loading and range of Dumbbell Tricep Extension -Pronated Grip while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Elevated Back Lunge'), 'Train quadriceps with the specific loading and range of Elevated Back Lunge while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Elevated Cable Rows'), 'Train lats with the specific loading and range of Elevated Cable Rows while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Extended Range One-Arm Kettlebell Floor Press'), 'Train chest with the specific loading and range of Extended Range One-Arm Kettlebell Floor Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'External Rotation'), 'Train shoulders with the specific loading and range of External Rotation while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'External Rotation with Cable'), 'Train shoulders with the specific loading and range of External Rotation with Cable while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'EZ-Bar Curl'), 'Train biceps with the specific loading and range of EZ-Bar Curl while keeping each rep technically honest.')
ON CONFLICT(movement_id) DO UPDATE SET coaching_intent = excluded.coaching_intent;

INSERT INTO movement_taxonomy (movement_id, category, implement, family) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Bench Press with Neutral Grip'), 'push', 'dumbbell', 'dumbbell_bench_press_with_neutral_grip'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Bicep Curl'), 'accessory', 'dumbbell', 'dumbbell_bicep_curl'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Incline Shoulder Raise'), 'accessory', 'dumbbell', 'dumbbell_incline_shoulder_raise'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Lying Rear Lateral Raise'), 'accessory', 'dumbbell', 'dumbbell_lying_rear_lateral_raise'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell One-Arm Shoulder Press'), 'unilateral', 'dumbbell', 'dumbbell_one_arm_shoulder_press'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Prone Incline Curl'), 'accessory', 'dumbbell', 'dumbbell_prone_incline_curl'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Seated One-Leg Calf Raise'), 'unilateral', 'dumbbell', 'dumbbell_seated_one_leg_calf_raise'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Squat To A Bench'), 'squat', 'dumbbell', 'dumbbell_squat_to_a_bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Tricep Extension -Pronated Grip'), 'accessory', 'dumbbell', 'dumbbell_tricep_extension_pronated_grip'),
  ((SELECT movement_id FROM movement WHERE name = 'Elevated Back Lunge'), 'unilateral', 'barbell', 'elevated_back_lunge'),
  ((SELECT movement_id FROM movement WHERE name = 'Elevated Cable Rows'), 'row', 'cable', 'elevated_cable_rows'),
  ((SELECT movement_id FROM movement WHERE name = 'Extended Range One-Arm Kettlebell Floor Press'), 'unilateral', 'kettlebell', 'extended_range_one_arm_kettlebell_floor_press'),
  ((SELECT movement_id FROM movement WHERE name = 'External Rotation'), 'accessory', 'dumbbell', 'external_rotation'),
  ((SELECT movement_id FROM movement WHERE name = 'External Rotation with Cable'), 'accessory', 'cable', 'external_rotation_with_cable'),
  ((SELECT movement_id FROM movement WHERE name = 'EZ-Bar Curl'), 'accessory', 'barbell', 'ez_bar_curl')
ON CONFLICT(movement_id) DO UPDATE SET
  category = excluded.category, implement = excluded.implement, family = excluded.family;

INSERT OR IGNORE INTO movement_equipment (movement_id, item) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Bench Press with Neutral Grip'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Bench Press with Neutral Grip'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Bicep Curl'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Incline Shoulder Raise'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Incline Shoulder Raise'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Lying Rear Lateral Raise'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Lying Rear Lateral Raise'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell One-Arm Shoulder Press'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell One-Arm Shoulder Press'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Prone Incline Curl'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Prone Incline Curl'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Seated One-Leg Calf Raise'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Seated One-Leg Calf Raise'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Squat To A Bench'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Squat To A Bench'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Tricep Extension -Pronated Grip'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Tricep Extension -Pronated Grip'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Elevated Back Lunge'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Elevated Back Lunge'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Elevated Cable Rows'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Extended Range One-Arm Kettlebell Floor Press'), 'kettlebell'),
  ((SELECT movement_id FROM movement WHERE name = 'External Rotation'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'External Rotation'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'External Rotation with Cable'), 'bands'),
  ((SELECT movement_id FROM movement WHERE name = 'External Rotation with Cable'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'EZ-Bar Curl'), 'barbell');

INSERT INTO movement_media (movement_id, asset_key, status, revision) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Bench Press with Neutral Grip'), 'movement/dumbbell-bench-press-with-neutral-grip/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Bicep Curl'), 'movement/dumbbell-bicep-curl/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Incline Shoulder Raise'), 'movement/dumbbell-incline-shoulder-raise/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Lying Rear Lateral Raise'), 'movement/dumbbell-lying-rear-lateral-raise/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell One-Arm Shoulder Press'), 'movement/dumbbell-one-arm-shoulder-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Prone Incline Curl'), 'movement/dumbbell-prone-incline-curl/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Seated One-Leg Calf Raise'), 'movement/dumbbell-seated-one-leg-calf-raise/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Squat To A Bench'), 'movement/dumbbell-squat-to-a-bench/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Tricep Extension -Pronated Grip'), 'movement/dumbbell-tricep-extension-pronated-grip/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Elevated Back Lunge'), 'movement/elevated-back-lunge/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Elevated Cable Rows'), 'movement/elevated-cable-rows/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Extended Range One-Arm Kettlebell Floor Press'), 'movement/extended-range-one-arm-kettlebell-floor-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'External Rotation'), 'movement/external-rotation/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'External Rotation with Cable'), 'movement/external-rotation-with-cable/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'EZ-Bar Curl'), 'movement/ez-bar-curl/demo/v1', 'planned', 1)
ON CONFLICT(movement_id) DO UPDATE SET
  asset_key = excluded.asset_key, status = 'planned', revision = 1;
