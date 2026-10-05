-- =============================================================================
-- 047_movement_library_v2_batch.sql
-- Phase 2a curated batch: 15 movements (generated, additive, idempotent).
-- Coaching fingerprints deliberately exclude movement media.
-- =============================================================================

INSERT OR IGNORE INTO movement (name, pattern, primary_muscle, is_compound) VALUES
  ('Speed Box Squat', 'squat', 'quadriceps', 1),
  ('Spider Curl', 'isolation', 'biceps', 0),
  ('Squat with Bands', 'squat', 'quadriceps', 1),
  ('Standing Biceps Cable Curl', 'isolation', 'biceps', 0),
  ('Standing Cable Chest Press', 'push_h', 'chest', 1),
  ('Standing Dumbbell Press', 'push_h', 'shoulders', 1),
  ('Standing Dumbbell Reverse Curl', 'isolation', 'biceps', 0),
  ('Standing Dumbbell Triceps Extension', 'isolation', 'triceps', 0),
  ('Standing Overhead Barbell Triceps Extension', 'isolation', 'triceps', 0),
  ('Standing Palm-In One-Arm Dumbbell Press', 'isolation', 'shoulders', 1),
  ('Standing Rope Crunch', 'rotation', 'abdominals', 0),
  ('Step-up with Knee Raise', 'lunge', 'glutes', 1),
  ('Stiff Leg Barbell Good Morning', 'hinge', 'lower back', 1),
  ('Stiff-Legged Barbell Deadlift', 'hinge', 'hamstrings', 1),
  ('Straight-Arm Dumbbell Pullover', 'pull_v', 'chest', 1);

INSERT INTO movement_detail
  (movement_id, base_name, supported_prefixes, difficulty_rating, target_muscles, instructions, cues, video_placeholder_uri)
VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Speed Box Squat'), 'Speed Box Squat', '["BB"]', 'Intermediate', '["quadriceps","calves","glutes","hamstrings"]', 'Set up Speed Box Squat with bands, barbell and choose a load or range you can control. Sit between the hips under control, keep pressure through the whole foot, and stand through the same path. When foot pressure rolls away from the working base, shorten the range and rebuild the next rep.', 'Brace before the descent. Keep pressure through the whole foot. Drive the floor away to stand.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Spider Curl'), 'Spider Curl', '["BB"]', 'Beginner', '["biceps"]', 'Set up Spider Curl with barbell, bench and choose a load or range you can control. Hold the upper arms still, curl the load through the forearms, and squeeze without lifting the shoulders. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Keep the upper arms quiet. Curl through the forearms. Own the lowering phase.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Squat with Bands'), 'Squat with Bands', '["BB"]', 'Intermediate', '["quadriceps","adductors","calves","glutes","hamstrings","lower back"]', 'Set up Squat with Bands with bands, barbell, dumbbells, squat rack and choose a load or range you can control. Sit between the hips under control, keep pressure through the whole foot, and stand through the same path. When foot pressure rolls away from the working base, shorten the range and rebuild the next rep.', 'Brace before the descent. Keep pressure through the whole foot. Drive the floor away to stand.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Biceps Cable Curl'), 'Standing Biceps Cable Curl', '["Cable"]', 'Beginner', '["biceps"]', 'Set up Standing Biceps Cable Curl with cable machine and choose a load or range you can control. Hold the upper arms still, curl the load through the forearms, and squeeze without lifting the shoulders. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Keep the upper arms quiet. Curl through the forearms. Own the lowering phase.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Cable Chest Press'), 'Standing Cable Chest Press', '["Cable"]', 'Beginner', '["chest","shoulders","triceps"]', 'Set up Standing Cable Chest Press with cable machine and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Press'), 'Standing Dumbbell Press', '["DB"]', 'Beginner', '["shoulders","triceps"]', 'Set up Standing Dumbbell Press with dumbbells and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Reverse Curl'), 'Standing Dumbbell Reverse Curl', '["DB"]', 'Intermediate', '["biceps","forearms"]', 'Set up Standing Dumbbell Reverse Curl with dumbbells and choose a load or range you can control. Hold the upper arms still, curl the load through the forearms, and squeeze without lifting the shoulders. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Keep the upper arms quiet. Curl through the forearms. Own the lowering phase.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Triceps Extension'), 'Standing Dumbbell Triceps Extension', '["DB"]', 'Beginner', '["triceps"]', 'Set up Standing Dumbbell Triceps Extension with dumbbells and choose a load or range you can control. Keep the elbows organised while the forearms extend, then return into a controlled stretch. When the elbows chase the load, the extension has lost its line; shorten the range or load.', 'Aim the elbows through one steady line. Extend through the forearms. Control the return into the stretch.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Overhead Barbell Triceps Extension'), 'Standing Overhead Barbell Triceps Extension', '["BB"]', 'Beginner', '["triceps","shoulders"]', 'Set up Standing Overhead Barbell Triceps Extension with barbell and choose a load or range you can control. Keep the elbows organised while the forearms extend, then return into a controlled stretch. When the elbows chase the load, the extension has lost its line; shorten the range or load.', 'Aim the elbows through one steady line. Extend through the forearms. Control the return into the stretch.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Palm-In One-Arm Dumbbell Press'), 'Standing Palm-In One-Arm Dumbbell Press', '["DB"]', 'Beginner', '["shoulders","triceps"]', 'Set up Standing Palm-In One-Arm Dumbbell Press with bench, dumbbells and choose a load or range you can control. Move at a sustainable pace while keeping each stride and change of direction deliberate. When posture or foot strike changes, slow the pace before continuing.', 'Set a repeatable starting position. Keep every stride smooth and quiet. Finish with the same posture you started with.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Rope Crunch'), 'Standing Rope Crunch', '["Cable"]', 'Beginner', '["abdominals"]', 'Set up Standing Rope Crunch with cable machine and choose a load or range you can control. Brace before moving, then complete the trunk action through a range you can own without momentum. When momentum starts the rep, shorten the range and rebuild the brace.', 'Set the pelvis before the rep. Move through a braced trunk. Own the return without momentum.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Step-up with Knee Raise'), 'Step-up with Knee Raise', '["Bodyweight"]', 'Beginner', '["glutes","hamstrings","quadriceps"]', 'Set up Step-up with Knee Raise with bench and choose a load or range you can control. Move the arms through the intended arc with soft elbows and a shoulder position that stays set. When the torso swings, the load is stealing the rep; reset with less weight.', 'Set the shoulder blades before moving. Lead the rep through the elbows. Lower with the same smooth path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Stiff Leg Barbell Good Morning'), 'Stiff Leg Barbell Good Morning', '["BB"]', 'Beginner', '["lower back","glutes","hamstrings"]', 'Set up Stiff Leg Barbell Good Morning with barbell, squat rack and choose a load or range you can control. Soften the knees, send the hips back until the posterior chain loads, and stand by driving the hips through. When the load leaves the hips and moves into the back, reduce the range or weight before the next rep.', 'Set the ribs down and brace first. Send the hips back into the load. Finish tall through the glutes.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Stiff-Legged Barbell Deadlift'), 'Stiff-Legged Barbell Deadlift', '["BB"]', 'Intermediate', '["hamstrings","glutes","lower back"]', 'Set up Stiff-Legged Barbell Deadlift with barbell and choose a load or range you can control. Soften the knees, send the hips back until the posterior chain loads, and stand by driving the hips through. When the load leaves the hips and moves into the back, reduce the range or weight before the next rep.', 'Set the ribs down and brace first. Send the hips back into the load. Finish tall through the glutes.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Straight-Arm Dumbbell Pullover'), 'Straight-Arm Dumbbell Pullover', '["DB"]', 'Intermediate', '["chest","lats","shoulders","triceps"]', 'Set up Straight-Arm Dumbbell Pullover with bench, dumbbells and choose a load or range you can control. Set the shoulders before bending the elbows, then pull through the full available range. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the shoulders before bending the elbows. Pull through the elbows, not the hands. Reach long under control.', '')
ON CONFLICT(movement_id) DO UPDATE SET
  base_name = excluded.base_name,
  supported_prefixes = excluded.supported_prefixes,
  difficulty_rating = excluded.difficulty_rating,
  target_muscles = excluded.target_muscles,
  instructions = excluded.instructions,
  cues = excluded.cues,
  video_placeholder_uri = '';

INSERT INTO movement_coaching_intent (movement_id, coaching_intent) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Speed Box Squat'), 'Train quadriceps with the specific loading and range of Speed Box Squat while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Spider Curl'), 'Train biceps with the specific loading and range of Spider Curl while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Squat with Bands'), 'Train quadriceps with the specific loading and range of Squat with Bands while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Biceps Cable Curl'), 'Train biceps with the specific loading and range of Standing Biceps Cable Curl while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Cable Chest Press'), 'Train chest with the specific loading and range of Standing Cable Chest Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Press'), 'Train shoulders with the specific loading and range of Standing Dumbbell Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Reverse Curl'), 'Train biceps with the specific loading and range of Standing Dumbbell Reverse Curl while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Triceps Extension'), 'Train triceps with the specific loading and range of Standing Dumbbell Triceps Extension while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Overhead Barbell Triceps Extension'), 'Train triceps with the specific loading and range of Standing Overhead Barbell Triceps Extension while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Palm-In One-Arm Dumbbell Press'), 'Train shoulders with the specific loading and range of Standing Palm-In One-Arm Dumbbell Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Rope Crunch'), 'Train abdominals with the specific loading and range of Standing Rope Crunch while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Step-up with Knee Raise'), 'Train glutes with the specific loading and range of Step-up with Knee Raise while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Stiff Leg Barbell Good Morning'), 'Train lower back with the specific loading and range of Stiff Leg Barbell Good Morning while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Stiff-Legged Barbell Deadlift'), 'Train hamstrings with the specific loading and range of Stiff-Legged Barbell Deadlift while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Straight-Arm Dumbbell Pullover'), 'Train chest with the specific loading and range of Straight-Arm Dumbbell Pullover while keeping each rep technically honest.')
ON CONFLICT(movement_id) DO UPDATE SET coaching_intent = excluded.coaching_intent;

INSERT INTO movement_taxonomy (movement_id, category, implement, family) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Speed Box Squat'), 'squat', 'barbell', 'speed_box_squat'),
  ((SELECT movement_id FROM movement WHERE name = 'Spider Curl'), 'accessory', 'barbell', 'spider_curl'),
  ((SELECT movement_id FROM movement WHERE name = 'Squat with Bands'), 'squat', 'barbell', 'squat_with_bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Biceps Cable Curl'), 'accessory', 'cable', 'standing_biceps_cable_curl'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Cable Chest Press'), 'push', 'cable', 'standing_cable_chest_press'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Press'), 'push', 'dumbbell', 'standing_dumbbell_press'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Reverse Curl'), 'accessory', 'dumbbell', 'standing_dumbbell_reverse_curl'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Triceps Extension'), 'accessory', 'dumbbell', 'standing_dumbbell_triceps_extension'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Overhead Barbell Triceps Extension'), 'accessory', 'barbell', 'standing_overhead_barbell_triceps_extension'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Palm-In One-Arm Dumbbell Press'), 'unilateral', 'dumbbell', 'standing_palm_in_one_arm_dumbbell_press'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Rope Crunch'), 'core', 'cable', 'standing_rope_crunch'),
  ((SELECT movement_id FROM movement WHERE name = 'Step-up with Knee Raise'), 'unilateral', 'bodyweight', 'step_up_with_knee_raise'),
  ((SELECT movement_id FROM movement WHERE name = 'Stiff Leg Barbell Good Morning'), 'hinge', 'barbell', 'stiff_leg_barbell_good_morning'),
  ((SELECT movement_id FROM movement WHERE name = 'Stiff-Legged Barbell Deadlift'), 'hinge', 'barbell', 'stiff_legged_barbell_deadlift'),
  ((SELECT movement_id FROM movement WHERE name = 'Straight-Arm Dumbbell Pullover'), 'row', 'dumbbell', 'straight_arm_dumbbell_pullover')
ON CONFLICT(movement_id) DO UPDATE SET
  category = excluded.category, implement = excluded.implement, family = excluded.family;

INSERT OR IGNORE INTO movement_equipment (movement_id, item) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Speed Box Squat'), 'bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Speed Box Squat'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Spider Curl'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Spider Curl'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Squat with Bands'), 'bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Squat with Bands'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Squat with Bands'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Squat with Bands'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Biceps Cable Curl'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Cable Chest Press'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Press'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Reverse Curl'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Triceps Extension'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Overhead Barbell Triceps Extension'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Palm-In One-Arm Dumbbell Press'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Palm-In One-Arm Dumbbell Press'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Rope Crunch'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Step-up with Knee Raise'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Stiff Leg Barbell Good Morning'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Stiff Leg Barbell Good Morning'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Stiff-Legged Barbell Deadlift'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Straight-Arm Dumbbell Pullover'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Straight-Arm Dumbbell Pullover'), 'dumbbells');

INSERT INTO movement_media (movement_id, asset_key, status, revision) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Speed Box Squat'), 'movement/speed-box-squat/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Spider Curl'), 'movement/spider-curl/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Squat with Bands'), 'movement/squat-with-bands/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Biceps Cable Curl'), 'movement/standing-biceps-cable-curl/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Cable Chest Press'), 'movement/standing-cable-chest-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Press'), 'movement/standing-dumbbell-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Reverse Curl'), 'movement/standing-dumbbell-reverse-curl/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Triceps Extension'), 'movement/standing-dumbbell-triceps-extension/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Overhead Barbell Triceps Extension'), 'movement/standing-overhead-barbell-triceps-extension/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Palm-In One-Arm Dumbbell Press'), 'movement/standing-palm-in-one-arm-dumbbell-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Rope Crunch'), 'movement/standing-rope-crunch/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Step-up with Knee Raise'), 'movement/step-up-with-knee-raise/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Stiff Leg Barbell Good Morning'), 'movement/stiff-leg-barbell-good-morning/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Stiff-Legged Barbell Deadlift'), 'movement/stiff-legged-barbell-deadlift/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Straight-Arm Dumbbell Pullover'), 'movement/straight-arm-dumbbell-pullover/demo/v1', 'planned', 1)
ON CONFLICT(movement_id) DO UPDATE SET
  asset_key = excluded.asset_key, status = 'planned', revision = 1;
