-- =============================================================================
-- 045_movement_library_v2_batch.sql
-- Phase 2a curated batch: 15 movements (generated, additive, idempotent).
-- Coaching fingerprints deliberately exclude movement media.
-- =============================================================================

INSERT OR IGNORE INTO movement (name, pattern, primary_muscle, is_compound) VALUES
  ('Oblique Crunches', 'rotation', 'abdominals', 0),
  ('One Arm Dumbbell Bench Press', 'push_h', 'chest', 1),
  ('One-Arm Dumbbell Row', 'pull_h', 'middle back', 1),
  ('One-Arm High-Pulley Cable Side Bends', 'rotation', 'abdominals', 0),
  ('One-Arm Kettlebell Floor Press', 'push_h', 'chest', 1),
  ('One-Arm Kettlebell Swings', 'hinge', 'hamstrings', 1),
  ('Pallof Press With Rotation', 'rotation', 'abdominals', 1),
  ('Pin Presses', 'push_h', 'triceps', 1),
  ('Preacher Hammer Dumbbell Curl', 'isolation', 'biceps', 0),
  ('Push Up to Side Plank', 'rotation', 'chest', 1),
  ('Push-Up Wide', 'push_h', 'chest', 1),
  ('Reverse Band Box Squat', 'squat', 'quadriceps', 1),
  ('Reverse Band Deadlift', 'hinge', 'lower back', 1),
  ('Reverse Band Sumo Deadlift', 'hinge', 'hamstrings', 1),
  ('Reverse Barbell Preacher Curls', 'isolation', 'biceps', 0);

INSERT INTO movement_detail
  (movement_id, base_name, supported_prefixes, difficulty_rating, target_muscles, instructions, cues, video_placeholder_uri)
VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Oblique Crunches'), 'Oblique Crunches', '["Bodyweight"]', 'Beginner', '["abdominals"]', 'Set up Oblique Crunches with a stable bodyweight start position and choose a load or range you can control. Brace before moving, then complete the trunk action through a range you can own without momentum. When momentum starts the rep, shorten the range and rebuild the brace.', 'Set the pelvis before the rep. Move through a braced trunk. Own the return without momentum.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'One Arm Dumbbell Bench Press'), 'One Arm Dumbbell Bench Press', '["DB"]', 'Beginner', '["chest","shoulders","triceps"]', 'Set up One Arm Dumbbell Bench Press with bench, dumbbells and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm Dumbbell Row'), 'One-Arm Dumbbell Row', '["DB"]', 'Beginner', '["middle back","biceps","lats","shoulders"]', 'Set up One-Arm Dumbbell Row with bench, dumbbells and choose a load or range you can control. Reach into the start, then drive the elbows back until the upper back finishes the pull. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the torso before the pull. Lead with the elbows. Pause with the upper back engaged.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm High-Pulley Cable Side Bends'), 'One-Arm High-Pulley Cable Side Bends', '["Cable"]', 'Beginner', '["abdominals"]', 'Set up One-Arm High-Pulley Cable Side Bends with cable machine and choose a load or range you can control. Brace before moving, then complete the trunk action through a range you can own without momentum. When momentum starts the rep, shorten the range and rebuild the brace.', 'Set the pelvis before the rep. Move through a braced trunk. Own the return without momentum.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm Kettlebell Floor Press'), 'One-Arm Kettlebell Floor Press', '["KB"]', 'Intermediate', '["chest","triceps"]', 'Set up One-Arm Kettlebell Floor Press with kettlebell and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm Kettlebell Swings'), 'One-Arm Kettlebell Swings', '["KB"]', 'Intermediate', '["hamstrings","calves","glutes","lower back","shoulders"]', 'Set up One-Arm Kettlebell Swings with kettlebell and choose a load or range you can control. Soften the knees, send the hips back until the posterior chain loads, and stand by driving the hips through. When the load leaves the hips and moves into the back, reduce the range or weight before the next rep.', 'Set the ribs down and brace first. Send the hips back into the load. Finish tall through the glutes.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Pallof Press With Rotation'), 'Pallof Press With Rotation', '["Cable"]', 'Beginner', '["abdominals","chest","shoulders","triceps"]', 'Set up Pallof Press With Rotation with cable machine and choose a load or range you can control. Brace before moving, then complete the trunk action through a range you can own without momentum. When momentum starts the rep, shorten the range and rebuild the brace.', 'Set the pelvis before the rep. Move through a braced trunk. Own the return without momentum.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Pin Presses'), 'Pin Presses', '["BB"]', 'Intermediate', '["triceps","chest","forearms","lats","middle back","shoulders"]', 'Set up Pin Presses with barbell, bench, squat rack and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Preacher Hammer Dumbbell Curl'), 'Preacher Hammer Dumbbell Curl', '["DB"]', 'Beginner', '["biceps","forearms"]', 'Set up Preacher Hammer Dumbbell Curl with bench, dumbbells and choose a load or range you can control. Hold the upper arms still, curl the load through the forearms, and squeeze without lifting the shoulders. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Keep the upper arms quiet. Curl through the forearms. Own the lowering phase.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Push Up to Side Plank'), 'Push Up to Side Plank', '["Bodyweight"]', 'Beginner', '["chest","abdominals","shoulders","triceps"]', 'Set up Push Up to Side Plank with a stable bodyweight start position and choose a load or range you can control. Brace before moving, then complete the trunk action through a range you can own without momentum. When momentum starts the rep, shorten the range and rebuild the brace.', 'Set the pelvis before the rep. Move through a braced trunk. Own the return without momentum.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Push-Up Wide'), 'Push-Up Wide', '["Bodyweight"]', 'Beginner', '["chest","abdominals","shoulders","triceps"]', 'Set up Push-Up Wide with a stable bodyweight start position and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Box Squat'), 'Reverse Band Box Squat', '["BB"]', 'Intermediate', '["quadriceps","abductors","adductors","calves","forearms","glutes","hamstrings","lower back"]', 'Set up Reverse Band Box Squat with bands, barbell, squat rack and choose a load or range you can control. Sit between the hips under control, keep pressure through the whole foot, and stand through the same path. When foot pressure rolls away from the working base, shorten the range and rebuild the next rep.', 'Brace before the descent. Keep pressure through the whole foot. Drive the floor away to stand.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Deadlift'), 'Reverse Band Deadlift', '["BB"]', 'Advanced', '["lower back","abductors","adductors","calves","glutes","hamstrings","quadriceps"]', 'Set up Reverse Band Deadlift with bands, barbell, squat rack and choose a load or range you can control. Soften the knees, send the hips back until the posterior chain loads, and stand by driving the hips through. When the load leaves the hips and moves into the back, reduce the range or weight before the next rep.', 'Set the ribs down and brace first. Send the hips back into the load. Finish tall through the glutes.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Sumo Deadlift'), 'Reverse Band Sumo Deadlift', '["BB"]', 'Advanced', '["hamstrings","abductors","adductors","calves","forearms","glutes","lower back","quadriceps","traps"]', 'Set up Reverse Band Sumo Deadlift with bands, barbell, squat rack and choose a load or range you can control. Soften the knees, send the hips back until the posterior chain loads, and stand by driving the hips through. When the load leaves the hips and moves into the back, reduce the range or weight before the next rep.', 'Set the ribs down and brace first. Send the hips back into the load. Finish tall through the glutes.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Barbell Preacher Curls'), 'Reverse Barbell Preacher Curls', '["BB"]', 'Intermediate', '["biceps","forearms"]', 'Set up Reverse Barbell Preacher Curls with barbell, bench and choose a load or range you can control. Hold the upper arms still, curl the load through the forearms, and squeeze without lifting the shoulders. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Keep the upper arms quiet. Curl through the forearms. Own the lowering phase.', '')
ON CONFLICT(movement_id) DO UPDATE SET
  base_name = excluded.base_name,
  supported_prefixes = excluded.supported_prefixes,
  difficulty_rating = excluded.difficulty_rating,
  target_muscles = excluded.target_muscles,
  instructions = excluded.instructions,
  cues = excluded.cues,
  video_placeholder_uri = '';

INSERT INTO movement_coaching_intent (movement_id, coaching_intent) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Oblique Crunches'), 'Train abdominals with the specific loading and range of Oblique Crunches while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'One Arm Dumbbell Bench Press'), 'Train chest with the specific loading and range of One Arm Dumbbell Bench Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm Dumbbell Row'), 'Train middle back with the specific loading and range of One-Arm Dumbbell Row while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm High-Pulley Cable Side Bends'), 'Train abdominals with the specific loading and range of One-Arm High-Pulley Cable Side Bends while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm Kettlebell Floor Press'), 'Train chest with the specific loading and range of One-Arm Kettlebell Floor Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm Kettlebell Swings'), 'Train hamstrings with the specific loading and range of One-Arm Kettlebell Swings while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Pallof Press With Rotation'), 'Train abdominals with the specific loading and range of Pallof Press With Rotation while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Pin Presses'), 'Train triceps with the specific loading and range of Pin Presses while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Preacher Hammer Dumbbell Curl'), 'Train biceps with the specific loading and range of Preacher Hammer Dumbbell Curl while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Push Up to Side Plank'), 'Train chest with the specific loading and range of Push Up to Side Plank while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Push-Up Wide'), 'Train chest with the specific loading and range of Push-Up Wide while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Box Squat'), 'Train quadriceps with the specific loading and range of Reverse Band Box Squat while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Deadlift'), 'Train lower back with the specific loading and range of Reverse Band Deadlift while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Sumo Deadlift'), 'Train hamstrings with the specific loading and range of Reverse Band Sumo Deadlift while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Barbell Preacher Curls'), 'Train biceps with the specific loading and range of Reverse Barbell Preacher Curls while keeping each rep technically honest.')
ON CONFLICT(movement_id) DO UPDATE SET coaching_intent = excluded.coaching_intent;

INSERT INTO movement_taxonomy (movement_id, category, implement, family) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Oblique Crunches'), 'core', 'bodyweight', 'oblique_crunches'),
  ((SELECT movement_id FROM movement WHERE name = 'One Arm Dumbbell Bench Press'), 'unilateral', 'dumbbell', 'one_arm_dumbbell_bench_press'),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm Dumbbell Row'), 'unilateral', 'dumbbell', 'one_arm_dumbbell_row'),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm High-Pulley Cable Side Bends'), 'core', 'cable', 'one_arm_high_pulley_cable_side_bends'),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm Kettlebell Floor Press'), 'unilateral', 'kettlebell', 'one_arm_kettlebell_floor_press'),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm Kettlebell Swings'), 'unilateral', 'kettlebell', 'one_arm_kettlebell_swings'),
  ((SELECT movement_id FROM movement WHERE name = 'Pallof Press With Rotation'), 'push', 'cable', 'pallof_press_with_rotation'),
  ((SELECT movement_id FROM movement WHERE name = 'Pin Presses'), 'push', 'barbell', 'pin_presses'),
  ((SELECT movement_id FROM movement WHERE name = 'Preacher Hammer Dumbbell Curl'), 'accessory', 'dumbbell', 'preacher_hammer_dumbbell_curl'),
  ((SELECT movement_id FROM movement WHERE name = 'Push Up to Side Plank'), 'push', 'bodyweight', 'push_up_to_side_plank'),
  ((SELECT movement_id FROM movement WHERE name = 'Push-Up Wide'), 'push', 'bodyweight', 'push_up_wide'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Box Squat'), 'squat', 'barbell', 'reverse_band_box_squat'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Deadlift'), 'hinge', 'barbell', 'reverse_band_deadlift'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Sumo Deadlift'), 'hinge', 'barbell', 'reverse_band_sumo_deadlift'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Barbell Preacher Curls'), 'accessory', 'barbell', 'reverse_barbell_preacher_curls')
ON CONFLICT(movement_id) DO UPDATE SET
  category = excluded.category, implement = excluded.implement, family = excluded.family;

INSERT OR IGNORE INTO movement_equipment (movement_id, item) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'One Arm Dumbbell Bench Press'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'One Arm Dumbbell Bench Press'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm Dumbbell Row'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm Dumbbell Row'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm High-Pulley Cable Side Bends'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm Kettlebell Floor Press'), 'kettlebell'),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm Kettlebell Swings'), 'kettlebell'),
  ((SELECT movement_id FROM movement WHERE name = 'Pallof Press With Rotation'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Pin Presses'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Pin Presses'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Pin Presses'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Preacher Hammer Dumbbell Curl'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Preacher Hammer Dumbbell Curl'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Box Squat'), 'bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Box Squat'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Box Squat'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Deadlift'), 'bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Deadlift'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Deadlift'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Sumo Deadlift'), 'bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Sumo Deadlift'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Sumo Deadlift'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Barbell Preacher Curls'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Barbell Preacher Curls'), 'bench');

INSERT INTO movement_media (movement_id, asset_key, status, revision) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Oblique Crunches'), 'movement/oblique-crunches/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'One Arm Dumbbell Bench Press'), 'movement/one-arm-dumbbell-bench-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm Dumbbell Row'), 'movement/one-arm-dumbbell-row/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm High-Pulley Cable Side Bends'), 'movement/one-arm-high-pulley-cable-side-bends/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm Kettlebell Floor Press'), 'movement/one-arm-kettlebell-floor-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm Kettlebell Swings'), 'movement/one-arm-kettlebell-swings/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Pallof Press With Rotation'), 'movement/pallof-press-with-rotation/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Pin Presses'), 'movement/pin-presses/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Preacher Hammer Dumbbell Curl'), 'movement/preacher-hammer-dumbbell-curl/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Push Up to Side Plank'), 'movement/push-up-to-side-plank/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Push-Up Wide'), 'movement/push-up-wide/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Box Squat'), 'movement/reverse-band-box-squat/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Deadlift'), 'movement/reverse-band-deadlift/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Sumo Deadlift'), 'movement/reverse-band-sumo-deadlift/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Barbell Preacher Curls'), 'movement/reverse-barbell-preacher-curls/demo/v1', 'planned', 1)
ON CONFLICT(movement_id) DO UPDATE SET
  asset_key = excluded.asset_key, status = 'planned', revision = 1;
