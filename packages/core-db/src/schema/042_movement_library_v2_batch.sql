-- =============================================================================
-- 042_movement_library_v2_batch.sql
-- Phase 2a curated batch: 15 movements (generated, additive, idempotent).
-- Coaching fingerprints deliberately exclude movement media.
-- =============================================================================

INSERT OR IGNORE INTO movement (name, pattern, primary_muscle, is_compound) VALUES
  ('Finger Curls', 'isolation', 'forearms', 0),
  ('Flat Bench Cable Flyes', 'push_h', 'chest', 0),
  ('Floor Glute-Ham Raise', 'hinge', 'hamstrings', 0),
  ('Floor Press', 'push_h', 'triceps', 1),
  ('Frog Sit-Ups', 'rotation', 'abdominals', 0),
  ('Front Barbell Squat To A Bench', 'squat', 'quadriceps', 1),
  ('Front Cable Raise', 'isolation', 'shoulders', 0),
  ('Front Incline Dumbbell Raise', 'isolation', 'shoulders', 0),
  ('Front Squat (Clean Grip)', 'squat', 'quadriceps', 1),
  ('Full Range-Of-Motion Lat Pulldown', 'pull_v', 'lats', 1),
  ('Good Morning off Pins', 'hinge', 'hamstrings', 1),
  ('Gorilla Chin/Crunch', 'rotation', 'abdominals', 1),
  ('Hammer Grip Incline DB Bench Press', 'push_h', 'chest', 1),
  ('High Cable Curls', 'isolation', 'biceps', 1),
  ('Hip Extension with Bands', 'hinge', 'glutes', 1);

INSERT INTO movement_detail
  (movement_id, base_name, supported_prefixes, difficulty_rating, target_muscles, instructions, cues, video_placeholder_uri)
VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Finger Curls'), 'Finger Curls', '["BB"]', 'Beginner', '["forearms"]', 'Set up Finger Curls with barbell and choose a load or range you can control. Support the forearms and move the load through the available wrist or finger range without shifting the elbows. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Support the forearms before the rep. Move through the wrists with a relaxed grip. Own the full return.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Flat Bench Cable Flyes'), 'Flat Bench Cable Flyes', '["Cable"]', 'Intermediate', '["chest"]', 'Set up Flat Bench Cable Flyes with bench, cable machine and choose a load or range you can control. Move the arms through the intended arc with soft elbows and a shoulder position that stays set. When the torso swings, the load is stealing the rep; reset with less weight.', 'Set the shoulder blades before moving. Lead the rep through the elbows. Lower with the same smooth path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Floor Glute-Ham Raise'), 'Floor Glute-Ham Raise', '["Bodyweight"]', 'Intermediate', '["hamstrings","calves","glutes"]', 'Set up Floor Glute-Ham Raise with a stable bodyweight start position and choose a load or range you can control. Move the arms through the intended arc with soft elbows and a shoulder position that stays set. When the torso swings, the load is stealing the rep; reset with less weight.', 'Set the shoulder blades before moving. Lead the rep through the elbows. Lower with the same smooth path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Floor Press'), 'Floor Press', '["BB"]', 'Intermediate', '["triceps","chest","shoulders"]', 'Set up Floor Press with barbell, squat rack and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Frog Sit-Ups'), 'Frog Sit-Ups', '["Bodyweight"]', 'Intermediate', '["abdominals"]', 'Set up Frog Sit-Ups with a stable bodyweight start position and choose a load or range you can control. Brace before moving, then complete the trunk action through a range you can own without momentum. When momentum starts the rep, shorten the range and rebuild the brace.', 'Set the pelvis before the rep. Move through a braced trunk. Own the return without momentum.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Front Barbell Squat To A Bench'), 'Front Barbell Squat To A Bench', '["BB"]', 'Advanced', '["quadriceps","calves","glutes","hamstrings"]', 'Set up Front Barbell Squat To A Bench with barbell, bench, squat rack and choose a load or range you can control. Sit between the hips under control, keep pressure through the whole foot, and stand through the same path. When foot pressure rolls away from the working base, shorten the range and rebuild the next rep.', 'Brace before the descent. Keep pressure through the whole foot. Drive the floor away to stand.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Front Cable Raise'), 'Front Cable Raise', '["Cable"]', 'Beginner', '["shoulders"]', 'Set up Front Cable Raise with cable machine and choose a load or range you can control. Move the arms through the intended arc with soft elbows and a shoulder position that stays set. When the torso swings, the load is stealing the rep; reset with less weight.', 'Set the shoulder blades before moving. Lead the rep through the elbows. Lower with the same smooth path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Front Incline Dumbbell Raise'), 'Front Incline Dumbbell Raise', '["DB"]', 'Beginner', '["shoulders"]', 'Set up Front Incline Dumbbell Raise with bench, dumbbells and choose a load or range you can control. Move the arms through the intended arc with soft elbows and a shoulder position that stays set. When the torso swings, the load is stealing the rep; reset with less weight.', 'Set the shoulder blades before moving. Lead the rep through the elbows. Lower with the same smooth path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Front Squat (Clean Grip)'), 'Front Squat (Clean Grip)', '["BB"]', 'Intermediate', '["quadriceps","abdominals","glutes","hamstrings"]', 'Set up Front Squat (Clean Grip) with barbell, squat rack and choose a load or range you can control. Sit between the hips under control, keep pressure through the whole foot, and stand through the same path. When foot pressure rolls away from the working base, shorten the range and rebuild the next rep.', 'Brace before the descent. Keep pressure through the whole foot. Drive the floor away to stand.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Full Range-Of-Motion Lat Pulldown'), 'Full Range-Of-Motion Lat Pulldown', '["Cable"]', 'Intermediate', '["lats","biceps","middle back","shoulders"]', 'Set up Full Range-Of-Motion Lat Pulldown with bench, cable machine and choose a load or range you can control. Set the shoulders before bending the elbows, then pull through the full available range. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the shoulders before bending the elbows. Pull through the elbows, not the hands. Reach long under control.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Good Morning off Pins'), 'Good Morning off Pins', '["BB"]', 'Intermediate', '["hamstrings","abdominals","glutes","lower back"]', 'Set up Good Morning off Pins with barbell, squat rack and choose a load or range you can control. Soften the knees, send the hips back until the posterior chain loads, and stand by driving the hips through. When the load leaves the hips and moves into the back, reduce the range or weight before the next rep.', 'Set the ribs down and brace first. Send the hips back into the load. Finish tall through the glutes.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Gorilla Chin/Crunch'), 'Gorilla Chin/Crunch', '["Bodyweight"]', 'Intermediate', '["abdominals","biceps","lats"]', 'Set up Gorilla Chin/Crunch with pullup bar and choose a load or range you can control. Brace before moving, then complete the trunk action through a range you can own without momentum. When momentum starts the rep, shorten the range and rebuild the brace.', 'Set the pelvis before the rep. Move through a braced trunk. Own the return without momentum.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Hammer Grip Incline DB Bench Press'), 'Hammer Grip Incline DB Bench Press', '["DB"]', 'Beginner', '["chest","shoulders","triceps"]', 'Set up Hammer Grip Incline DB Bench Press with bench, dumbbells and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'High Cable Curls'), 'High Cable Curls', '["Cable"]', 'Intermediate', '["biceps"]', 'Set up High Cable Curls with cable machine and choose a load or range you can control. Hold the upper arms still, curl the load through the forearms, and squeeze without lifting the shoulders. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Keep the upper arms quiet. Curl through the forearms. Own the lowering phase.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Hip Extension with Bands'), 'Hip Extension with Bands', '["Banded"]', 'Beginner', '["glutes","hamstrings"]', 'Set up Hip Extension with Bands with bands and choose a load or range you can control. Soften the knees, send the hips back until the posterior chain loads, and stand by driving the hips through. When the load leaves the hips and moves into the back, reduce the range or weight before the next rep.', 'Set the ribs down and brace first. Send the hips back into the load. Finish tall through the glutes.', '')
ON CONFLICT(movement_id) DO UPDATE SET
  base_name = excluded.base_name,
  supported_prefixes = excluded.supported_prefixes,
  difficulty_rating = excluded.difficulty_rating,
  target_muscles = excluded.target_muscles,
  instructions = excluded.instructions,
  cues = excluded.cues,
  video_placeholder_uri = '';

INSERT INTO movement_coaching_intent (movement_id, coaching_intent) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Finger Curls'), 'Train forearms with the specific loading and range of Finger Curls while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Flat Bench Cable Flyes'), 'Train chest with the specific loading and range of Flat Bench Cable Flyes while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Floor Glute-Ham Raise'), 'Train hamstrings with the specific loading and range of Floor Glute-Ham Raise while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Floor Press'), 'Train triceps with the specific loading and range of Floor Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Frog Sit-Ups'), 'Train abdominals with the specific loading and range of Frog Sit-Ups while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Front Barbell Squat To A Bench'), 'Train quadriceps with the specific loading and range of Front Barbell Squat To A Bench while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Front Cable Raise'), 'Train shoulders with the specific loading and range of Front Cable Raise while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Front Incline Dumbbell Raise'), 'Train shoulders with the specific loading and range of Front Incline Dumbbell Raise while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Front Squat (Clean Grip)'), 'Train quadriceps with the specific loading and range of Front Squat (Clean Grip) while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Full Range-Of-Motion Lat Pulldown'), 'Train lats with the specific loading and range of Full Range-Of-Motion Lat Pulldown while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Good Morning off Pins'), 'Train hamstrings with the specific loading and range of Good Morning off Pins while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Gorilla Chin/Crunch'), 'Train abdominals with the specific loading and range of Gorilla Chin/Crunch while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Hammer Grip Incline DB Bench Press'), 'Train chest with the specific loading and range of Hammer Grip Incline DB Bench Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'High Cable Curls'), 'Train biceps with the specific loading and range of High Cable Curls while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Hip Extension with Bands'), 'Train glutes with the specific loading and range of Hip Extension with Bands while keeping each rep technically honest.')
ON CONFLICT(movement_id) DO UPDATE SET coaching_intent = excluded.coaching_intent;

INSERT INTO movement_taxonomy (movement_id, category, implement, family) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Finger Curls'), 'accessory', 'barbell', 'finger_curls'),
  ((SELECT movement_id FROM movement WHERE name = 'Flat Bench Cable Flyes'), 'push', 'cable', 'flat_bench_cable_flyes'),
  ((SELECT movement_id FROM movement WHERE name = 'Floor Glute-Ham Raise'), 'accessory', 'bodyweight', 'floor_glute_ham_raise'),
  ((SELECT movement_id FROM movement WHERE name = 'Floor Press'), 'push', 'barbell', 'floor_press'),
  ((SELECT movement_id FROM movement WHERE name = 'Frog Sit-Ups'), 'core', 'bodyweight', 'frog_sit_ups'),
  ((SELECT movement_id FROM movement WHERE name = 'Front Barbell Squat To A Bench'), 'squat', 'barbell', 'front_barbell_squat_to_a_bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Front Cable Raise'), 'accessory', 'cable', 'front_cable_raise'),
  ((SELECT movement_id FROM movement WHERE name = 'Front Incline Dumbbell Raise'), 'accessory', 'dumbbell', 'front_incline_dumbbell_raise'),
  ((SELECT movement_id FROM movement WHERE name = 'Front Squat (Clean Grip)'), 'squat', 'barbell', 'front_squat_clean_grip'),
  ((SELECT movement_id FROM movement WHERE name = 'Full Range-Of-Motion Lat Pulldown'), 'row', 'cable', 'full_range_of_motion_lat_pulldown'),
  ((SELECT movement_id FROM movement WHERE name = 'Good Morning off Pins'), 'hinge', 'barbell', 'good_morning_off_pins'),
  ((SELECT movement_id FROM movement WHERE name = 'Gorilla Chin/Crunch'), 'core', 'bodyweight', 'gorilla_chin_crunch'),
  ((SELECT movement_id FROM movement WHERE name = 'Hammer Grip Incline DB Bench Press'), 'push', 'dumbbell', 'hammer_grip_incline_db_bench_press'),
  ((SELECT movement_id FROM movement WHERE name = 'High Cable Curls'), 'accessory', 'cable', 'high_cable_curls'),
  ((SELECT movement_id FROM movement WHERE name = 'Hip Extension with Bands'), 'accessory', 'band', 'hip_extension_with_bands')
ON CONFLICT(movement_id) DO UPDATE SET
  category = excluded.category, implement = excluded.implement, family = excluded.family;

INSERT OR IGNORE INTO movement_equipment (movement_id, item) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Finger Curls'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Flat Bench Cable Flyes'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Flat Bench Cable Flyes'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Floor Press'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Floor Press'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Front Barbell Squat To A Bench'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Front Barbell Squat To A Bench'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Front Barbell Squat To A Bench'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Front Cable Raise'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Front Incline Dumbbell Raise'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Front Incline Dumbbell Raise'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Front Squat (Clean Grip)'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Front Squat (Clean Grip)'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Full Range-Of-Motion Lat Pulldown'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Full Range-Of-Motion Lat Pulldown'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Good Morning off Pins'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Good Morning off Pins'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Gorilla Chin/Crunch'), 'pullup_bar'),
  ((SELECT movement_id FROM movement WHERE name = 'Hammer Grip Incline DB Bench Press'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Hammer Grip Incline DB Bench Press'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'High Cable Curls'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Hip Extension with Bands'), 'bands');

INSERT INTO movement_media (movement_id, asset_key, status, revision) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Finger Curls'), 'movement/finger-curls/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Flat Bench Cable Flyes'), 'movement/flat-bench-cable-flyes/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Floor Glute-Ham Raise'), 'movement/floor-glute-ham-raise/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Floor Press'), 'movement/floor-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Frog Sit-Ups'), 'movement/frog-sit-ups/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Front Barbell Squat To A Bench'), 'movement/front-barbell-squat-to-a-bench/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Front Cable Raise'), 'movement/front-cable-raise/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Front Incline Dumbbell Raise'), 'movement/front-incline-dumbbell-raise/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Front Squat (Clean Grip)'), 'movement/front-squat-clean-grip/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Full Range-Of-Motion Lat Pulldown'), 'movement/full-range-of-motion-lat-pulldown/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Good Morning off Pins'), 'movement/good-morning-off-pins/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Gorilla Chin/Crunch'), 'movement/gorilla-chin-crunch/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Hammer Grip Incline DB Bench Press'), 'movement/hammer-grip-incline-db-bench-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'High Cable Curls'), 'movement/high-cable-curls/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Hip Extension with Bands'), 'movement/hip-extension-with-bands/demo/v1', 'planned', 1)
ON CONFLICT(movement_id) DO UPDATE SET
  asset_key = excluded.asset_key, status = 'planned', revision = 1;
