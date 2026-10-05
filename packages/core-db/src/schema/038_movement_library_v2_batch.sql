-- =============================================================================
-- 038_movement_library_v2_batch.sql
-- Phase 2a curated batch: 15 movements (generated, additive, idempotent).
-- Coaching fingerprints deliberately exclude movement media.
-- =============================================================================

INSERT OR IGNORE INTO movement (name, pattern, primary_muscle, is_compound) VALUES
  ('Barbell Squat To A Bench', 'squat', 'quadriceps', 1),
  ('Bench Press - With Bands', 'push_h', 'chest', 1),
  ('Bent Over Barbell Row', 'pull_h', 'middle back', 1),
  ('Bent Over Dumbbell Rear Delt Raise With Head On Bench', 'isolation', 'shoulders', 0),
  ('Bent Over One-Arm Long Bar Row', 'pull_h', 'middle back', 1),
  ('Bent Over Two-Arm Long Bar Row', 'pull_h', 'middle back', 1),
  ('Bent Over Two-Dumbbell Row', 'pull_h', 'middle back', 1),
  ('Bent Over Two-Dumbbell Row With Palms In', 'pull_h', 'middle back', 1),
  ('Bent-Arm Barbell Pullover', 'pull_v', 'lats', 1),
  ('Bent-Arm Dumbbell Pullover', 'pull_v', 'chest', 1),
  ('Bent-Knee Hip Raise', 'rotation', 'abdominals', 1),
  ('Board Press', 'push_h', 'triceps', 1),
  ('Body Tricep Press', 'push_h', 'triceps', 0),
  ('Box Squat with Bands', 'squat', 'quadriceps', 1),
  ('Cable Incline Pushdown', 'pull_v', 'lats', 0);

INSERT INTO movement_detail
  (movement_id, base_name, supported_prefixes, difficulty_rating, target_muscles, instructions, cues, video_placeholder_uri)
VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Squat To A Bench'), 'Barbell Squat To A Bench', '["BB"]', 'Advanced', '["quadriceps","calves","glutes","hamstrings","lower back"]', 'Set up Barbell Squat To A Bench with barbell, bench, squat rack and choose a load or range you can control. Sit between the hips under control, keep pressure through the whole foot, and stand through the same path. When foot pressure rolls away from the working base, shorten the range and rebuild the next rep.', 'Brace before the descent. Keep pressure through the whole foot. Drive the floor away to stand.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Bench Press - With Bands'), 'Bench Press - With Bands', '["Banded"]', 'Beginner', '["chest","shoulders","triceps"]', 'Set up Bench Press - With Bands with bands, bench and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Barbell Row'), 'Bent Over Barbell Row', '["BB"]', 'Beginner', '["middle back","biceps","lats","shoulders"]', 'Set up Bent Over Barbell Row with barbell and choose a load or range you can control. Reach into the start, then drive the elbows back until the upper back finishes the pull. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the torso before the pull. Lead with the elbows. Pause with the upper back engaged.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Dumbbell Rear Delt Raise With Head On Bench'), 'Bent Over Dumbbell Rear Delt Raise With Head On Bench', '["DB"]', 'Beginner', '["shoulders"]', 'Set up Bent Over Dumbbell Rear Delt Raise With Head On Bench with bench, dumbbells and choose a load or range you can control. Move the arms through the intended arc with soft elbows and a shoulder position that stays set. When the torso swings, the load is stealing the rep; reset with less weight.', 'Set the shoulder blades before moving. Lead the rep through the elbows. Lower with the same smooth path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over One-Arm Long Bar Row'), 'Bent Over One-Arm Long Bar Row', '["BB"]', 'Beginner', '["middle back","biceps","lats","lower back","traps"]', 'Set up Bent Over One-Arm Long Bar Row with barbell and choose a load or range you can control. Reach into the start, then drive the elbows back until the upper back finishes the pull. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the torso before the pull. Lead with the elbows. Pause with the upper back engaged.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Arm Long Bar Row'), 'Bent Over Two-Arm Long Bar Row', '["BB"]', 'Intermediate', '["middle back","biceps","lats"]', 'Set up Bent Over Two-Arm Long Bar Row with barbell, cable machine and choose a load or range you can control. Reach into the start, then drive the elbows back until the upper back finishes the pull. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the torso before the pull. Lead with the elbows. Pause with the upper back engaged.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Dumbbell Row'), 'Bent Over Two-Dumbbell Row', '["DB"]', 'Beginner', '["middle back","biceps","lats","shoulders"]', 'Set up Bent Over Two-Dumbbell Row with dumbbells and choose a load or range you can control. Reach into the start, then drive the elbows back until the upper back finishes the pull. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the torso before the pull. Lead with the elbows. Pause with the upper back engaged.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Dumbbell Row With Palms In'), 'Bent Over Two-Dumbbell Row With Palms In', '["DB"]', 'Beginner', '["middle back","biceps","lats"]', 'Set up Bent Over Two-Dumbbell Row With Palms In with dumbbells and choose a load or range you can control. Reach into the start, then drive the elbows back until the upper back finishes the pull. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the torso before the pull. Lead with the elbows. Pause with the upper back engaged.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Bent-Arm Barbell Pullover'), 'Bent-Arm Barbell Pullover', '["BB"]', 'Intermediate', '["lats","chest","shoulders","triceps"]', 'Set up Bent-Arm Barbell Pullover with barbell, bench and choose a load or range you can control. Set the shoulders before bending the elbows, then pull through the full available range. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the shoulders before bending the elbows. Pull through the elbows, not the hands. Reach long under control.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Bent-Arm Dumbbell Pullover'), 'Bent-Arm Dumbbell Pullover', '["DB"]', 'Intermediate', '["chest","lats","shoulders","triceps"]', 'Set up Bent-Arm Dumbbell Pullover with bench, dumbbells and choose a load or range you can control. Set the shoulders before bending the elbows, then pull through the full available range. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the shoulders before bending the elbows. Pull through the elbows, not the hands. Reach long under control.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Bent-Knee Hip Raise'), 'Bent-Knee Hip Raise', '["Bodyweight"]', 'Beginner', '["abdominals"]', 'Set up Bent-Knee Hip Raise with a stable bodyweight start position and choose a load or range you can control. Move the arms through the intended arc with soft elbows and a shoulder position that stays set. When the torso swings, the load is stealing the rep; reset with less weight.', 'Set the shoulder blades before moving. Lead the rep through the elbows. Lower with the same smooth path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Board Press'), 'Board Press', '["BB"]', 'Intermediate', '["triceps","chest","forearms","lats","shoulders"]', 'Set up Board Press with bands, barbell, bench, squat rack and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Body Tricep Press'), 'Body Tricep Press', '["Bodyweight"]', 'Beginner', '["triceps"]', 'Set up Body Tricep Press with squat rack and choose a load or range you can control. Keep the elbows organised while the forearms extend, then return into a controlled stretch. When the elbows chase the load, the extension has lost its line; shorten the range or load.', 'Aim the elbows through one steady line. Extend through the forearms. Control the return into the stretch.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Box Squat with Bands'), 'Box Squat with Bands', '["BB"]', 'Advanced', '["quadriceps","abductors","adductors","calves","glutes","hamstrings","lower back"]', 'Set up Box Squat with Bands with bands, barbell, dumbbells, squat rack and choose a load or range you can control. Sit between the hips under control, keep pressure through the whole foot, and stand through the same path. When foot pressure rolls away from the working base, shorten the range and rebuild the next rep.', 'Brace before the descent. Keep pressure through the whole foot. Drive the floor away to stand.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Incline Pushdown'), 'Cable Incline Pushdown', '["Cable"]', 'Beginner', '["lats"]', 'Set up Cable Incline Pushdown with bench, cable machine and choose a load or range you can control. Set the shoulders before bending the elbows, then pull through the full available range. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the shoulders before bending the elbows. Pull through the elbows, not the hands. Reach long under control.', '')
ON CONFLICT(movement_id) DO UPDATE SET
  base_name = excluded.base_name,
  supported_prefixes = excluded.supported_prefixes,
  difficulty_rating = excluded.difficulty_rating,
  target_muscles = excluded.target_muscles,
  instructions = excluded.instructions,
  cues = excluded.cues,
  video_placeholder_uri = '';

INSERT INTO movement_coaching_intent (movement_id, coaching_intent) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Squat To A Bench'), 'Train quadriceps with the specific loading and range of Barbell Squat To A Bench while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Bench Press - With Bands'), 'Train chest with the specific loading and range of Bench Press - With Bands while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Barbell Row'), 'Train middle back with the specific loading and range of Bent Over Barbell Row while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Dumbbell Rear Delt Raise With Head On Bench'), 'Train shoulders with the specific loading and range of Bent Over Dumbbell Rear Delt Raise With Head On Bench while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over One-Arm Long Bar Row'), 'Train middle back with the specific loading and range of Bent Over One-Arm Long Bar Row while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Arm Long Bar Row'), 'Train middle back with the specific loading and range of Bent Over Two-Arm Long Bar Row while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Dumbbell Row'), 'Train middle back with the specific loading and range of Bent Over Two-Dumbbell Row while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Dumbbell Row With Palms In'), 'Train middle back with the specific loading and range of Bent Over Two-Dumbbell Row With Palms In while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent-Arm Barbell Pullover'), 'Train lats with the specific loading and range of Bent-Arm Barbell Pullover while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent-Arm Dumbbell Pullover'), 'Train chest with the specific loading and range of Bent-Arm Dumbbell Pullover while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent-Knee Hip Raise'), 'Train abdominals with the specific loading and range of Bent-Knee Hip Raise while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Board Press'), 'Train triceps with the specific loading and range of Board Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Body Tricep Press'), 'Train triceps with the specific loading and range of Body Tricep Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Box Squat with Bands'), 'Train quadriceps with the specific loading and range of Box Squat with Bands while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Incline Pushdown'), 'Train lats with the specific loading and range of Cable Incline Pushdown while keeping each rep technically honest.')
ON CONFLICT(movement_id) DO UPDATE SET coaching_intent = excluded.coaching_intent;

INSERT INTO movement_taxonomy (movement_id, category, implement, family) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Squat To A Bench'), 'squat', 'barbell', 'barbell_squat_to_a_bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Bench Press - With Bands'), 'push', 'band', 'bench_press_with_bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Barbell Row'), 'row', 'barbell', 'bent_over_barbell_row'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Dumbbell Rear Delt Raise With Head On Bench'), 'accessory', 'dumbbell', 'bent_over_dumbbell_rear_delt_raise_with_head_on_bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over One-Arm Long Bar Row'), 'unilateral', 'barbell', 'bent_over_one_arm_long_bar_row'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Arm Long Bar Row'), 'row', 'barbell', 'bent_over_two_arm_long_bar_row'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Dumbbell Row'), 'row', 'dumbbell', 'bent_over_two_dumbbell_row'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Dumbbell Row With Palms In'), 'row', 'dumbbell', 'bent_over_two_dumbbell_row_with_palms_in'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent-Arm Barbell Pullover'), 'row', 'barbell', 'bent_arm_barbell_pullover'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent-Arm Dumbbell Pullover'), 'row', 'dumbbell', 'bent_arm_dumbbell_pullover'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent-Knee Hip Raise'), 'accessory', 'bodyweight', 'bent_knee_hip_raise'),
  ((SELECT movement_id FROM movement WHERE name = 'Board Press'), 'push', 'barbell', 'board_press'),
  ((SELECT movement_id FROM movement WHERE name = 'Body Tricep Press'), 'push', 'bodyweight', 'body_tricep_press'),
  ((SELECT movement_id FROM movement WHERE name = 'Box Squat with Bands'), 'squat', 'barbell', 'box_squat_with_bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Incline Pushdown'), 'row', 'cable', 'cable_incline_pushdown')
ON CONFLICT(movement_id) DO UPDATE SET
  category = excluded.category, implement = excluded.implement, family = excluded.family;

INSERT OR IGNORE INTO movement_equipment (movement_id, item) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Squat To A Bench'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Squat To A Bench'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Squat To A Bench'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Bench Press - With Bands'), 'bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Bench Press - With Bands'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Barbell Row'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Dumbbell Rear Delt Raise With Head On Bench'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Dumbbell Rear Delt Raise With Head On Bench'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over One-Arm Long Bar Row'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Arm Long Bar Row'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Arm Long Bar Row'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Dumbbell Row'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Dumbbell Row With Palms In'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent-Arm Barbell Pullover'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent-Arm Barbell Pullover'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent-Arm Dumbbell Pullover'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Bent-Arm Dumbbell Pullover'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Board Press'), 'bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Board Press'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Board Press'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Board Press'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Body Tricep Press'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Box Squat with Bands'), 'bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Box Squat with Bands'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Box Squat with Bands'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Box Squat with Bands'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Incline Pushdown'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Incline Pushdown'), 'cable_machine');

INSERT INTO movement_media (movement_id, asset_key, status, revision) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Squat To A Bench'), 'movement/barbell-squat-to-a-bench/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Bench Press - With Bands'), 'movement/bench-press-with-bands/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Barbell Row'), 'movement/bent-over-barbell-row/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Dumbbell Rear Delt Raise With Head On Bench'), 'movement/bent-over-dumbbell-rear-delt-raise-with-head-on-bench/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over One-Arm Long Bar Row'), 'movement/bent-over-one-arm-long-bar-row/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Arm Long Bar Row'), 'movement/bent-over-two-arm-long-bar-row/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Dumbbell Row'), 'movement/bent-over-two-dumbbell-row/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Dumbbell Row With Palms In'), 'movement/bent-over-two-dumbbell-row-with-palms-in/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Bent-Arm Barbell Pullover'), 'movement/bent-arm-barbell-pullover/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Bent-Arm Dumbbell Pullover'), 'movement/bent-arm-dumbbell-pullover/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Bent-Knee Hip Raise'), 'movement/bent-knee-hip-raise/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Board Press'), 'movement/board-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Body Tricep Press'), 'movement/body-tricep-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Box Squat with Bands'), 'movement/box-squat-with-bands/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Incline Pushdown'), 'movement/cable-incline-pushdown/demo/v1', 'planned', 1)
ON CONFLICT(movement_id) DO UPDATE SET
  asset_key = excluded.asset_key, status = 'planned', revision = 1;
