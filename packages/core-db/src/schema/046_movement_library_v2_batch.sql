-- =============================================================================
-- 046_movement_library_v2_batch.sql
-- Phase 2a curated batch: 15 movements (generated, additive, idempotent).
-- Coaching fingerprints deliberately exclude movement media.
-- =============================================================================

INSERT OR IGNORE INTO movement (name, pattern, primary_muscle, is_compound) VALUES
  ('Reverse Cable Curl', 'isolation', 'biceps', 0),
  ('Reverse Flyes', 'isolation', 'shoulders', 0),
  ('Reverse Grip Triceps Pushdown', 'isolation', 'triceps', 0),
  ('Rope Crunch', 'rotation', 'abdominals', 0),
  ('Rope Straight-Arm Pulldown', 'pull_v', 'lats', 0),
  ('Seated Bent-Over Rear Delt Raise', 'isolation', 'shoulders', 0),
  ('Seated Cable Rows', 'pull_h', 'middle back', 1),
  ('Seated Cable Shoulder Press', 'push_v', 'shoulders', 1),
  ('Seated Dumbbell Palms-Down Wrist Curl', 'isolation', 'forearms', 0),
  ('Seated Dumbbell Palms-Up Wrist Curl', 'isolation', 'forearms', 0),
  ('Seated Dumbbell Press', 'push_h', 'shoulders', 1),
  ('Seated Good Mornings', 'hinge', 'lower back', 1),
  ('Seated Side Lateral Raise', 'isolation', 'shoulders', 0),
  ('Shotgun Row', 'pull_h', 'lats', 1),
  ('Shoulder Press - With Bands', 'push_v', 'shoulders', 1);

INSERT INTO movement_detail
  (movement_id, base_name, supported_prefixes, difficulty_rating, target_muscles, instructions, cues, video_placeholder_uri)
VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Cable Curl'), 'Reverse Cable Curl', '["Cable"]', 'Beginner', '["biceps","forearms"]', 'Set up Reverse Cable Curl with cable machine and choose a load or range you can control. Hold the upper arms still, curl the load through the forearms, and squeeze without lifting the shoulders. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Keep the upper arms quiet. Curl through the forearms. Own the lowering phase.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Flyes'), 'Reverse Flyes', '["DB"]', 'Beginner', '["shoulders"]', 'Set up Reverse Flyes with bench, dumbbells and choose a load or range you can control. Move the arms through the intended arc with soft elbows and a shoulder position that stays set. When the torso swings, the load is stealing the rep; reset with less weight.', 'Set the shoulder blades before moving. Lead the rep through the elbows. Lower with the same smooth path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Grip Triceps Pushdown'), 'Reverse Grip Triceps Pushdown', '["Cable"]', 'Beginner', '["triceps"]', 'Set up Reverse Grip Triceps Pushdown with cable machine and choose a load or range you can control. Keep the elbows organised while the forearms extend, then return into a controlled stretch. When the elbows chase the load, the extension has lost its line; shorten the range or load.', 'Aim the elbows through one steady line. Extend through the forearms. Control the return into the stretch.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Rope Crunch'), 'Rope Crunch', '["Cable"]', 'Beginner', '["abdominals"]', 'Set up Rope Crunch with cable machine and choose a load or range you can control. Brace before moving, then complete the trunk action through a range you can own without momentum. When momentum starts the rep, shorten the range and rebuild the brace.', 'Set the pelvis before the rep. Move through a braced trunk. Own the return without momentum.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Rope Straight-Arm Pulldown'), 'Rope Straight-Arm Pulldown', '["Cable"]', 'Beginner', '["lats"]', 'Set up Rope Straight-Arm Pulldown with cable machine and choose a load or range you can control. Set the shoulders before bending the elbows, then pull through the full available range. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the shoulders before bending the elbows. Pull through the elbows, not the hands. Reach long under control.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Bent-Over Rear Delt Raise'), 'Seated Bent-Over Rear Delt Raise', '["DB"]', 'Intermediate', '["shoulders"]', 'Set up Seated Bent-Over Rear Delt Raise with bench, dumbbells and choose a load or range you can control. Move the arms through the intended arc with soft elbows and a shoulder position that stays set. When the torso swings, the load is stealing the rep; reset with less weight.', 'Set the shoulder blades before moving. Lead the rep through the elbows. Lower with the same smooth path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Cable Rows'), 'Seated Cable Rows', '["Cable"]', 'Beginner', '["middle back","biceps","lats","shoulders"]', 'Set up Seated Cable Rows with cable machine and choose a load or range you can control. Reach into the start, then drive the elbows back until the upper back finishes the pull. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the torso before the pull. Lead with the elbows. Pause with the upper back engaged.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Cable Shoulder Press'), 'Seated Cable Shoulder Press', '["Cable"]', 'Beginner', '["shoulders","triceps"]', 'Set up Seated Cable Shoulder Press with cable machine and choose a load or range you can control. Organise the load at shoulder height, then press overhead while staying tall through the trunk. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Stay tall through the torso. Stack the wrists over the elbows. Finish overhead with a quiet ribcage.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Palms-Down Wrist Curl'), 'Seated Dumbbell Palms-Down Wrist Curl', '["DB"]', 'Beginner', '["forearms"]', 'Set up Seated Dumbbell Palms-Down Wrist Curl with bench, dumbbells and choose a load or range you can control. Support the forearms and move the load through the available wrist or finger range without shifting the elbows. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Support the forearms before the rep. Move through the wrists with a relaxed grip. Own the full return.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Palms-Up Wrist Curl'), 'Seated Dumbbell Palms-Up Wrist Curl', '["DB"]', 'Beginner', '["forearms"]', 'Set up Seated Dumbbell Palms-Up Wrist Curl with bench, dumbbells and choose a load or range you can control. Support the forearms and move the load through the available wrist or finger range without shifting the elbows. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Support the forearms before the rep. Move through the wrists with a relaxed grip. Own the full return.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Press'), 'Seated Dumbbell Press', '["DB"]', 'Beginner', '["shoulders","triceps"]', 'Set up Seated Dumbbell Press with bench, dumbbells and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Good Mornings'), 'Seated Good Mornings', '["BB"]', 'Intermediate', '["lower back","glutes"]', 'Set up Seated Good Mornings with barbell, squat rack and choose a load or range you can control. Soften the knees, send the hips back until the posterior chain loads, and stand by driving the hips through. When the load leaves the hips and moves into the back, reduce the range or weight before the next rep.', 'Set the ribs down and brace first. Send the hips back into the load. Finish tall through the glutes.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Side Lateral Raise'), 'Seated Side Lateral Raise', '["DB"]', 'Beginner', '["shoulders"]', 'Set up Seated Side Lateral Raise with bench, dumbbells and choose a load or range you can control. Move the arms through the intended arc with soft elbows and a shoulder position that stays set. When the torso swings, the load is stealing the rep; reset with less weight.', 'Set the shoulder blades before moving. Lead the rep through the elbows. Lower with the same smooth path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Shotgun Row'), 'Shotgun Row', '["Cable"]', 'Beginner', '["lats","biceps","middle back"]', 'Set up Shotgun Row with cable machine and choose a load or range you can control. Reach into the start, then drive the elbows back until the upper back finishes the pull. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the torso before the pull. Lead with the elbows. Pause with the upper back engaged.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Shoulder Press - With Bands'), 'Shoulder Press - With Bands', '["Banded"]', 'Beginner', '["shoulders","triceps"]', 'Set up Shoulder Press - With Bands with bands and choose a load or range you can control. Organise the load at shoulder height, then press overhead while staying tall through the trunk. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Stay tall through the torso. Stack the wrists over the elbows. Finish overhead with a quiet ribcage.', '')
ON CONFLICT(movement_id) DO UPDATE SET
  base_name = excluded.base_name,
  supported_prefixes = excluded.supported_prefixes,
  difficulty_rating = excluded.difficulty_rating,
  target_muscles = excluded.target_muscles,
  instructions = excluded.instructions,
  cues = excluded.cues,
  video_placeholder_uri = '';

INSERT INTO movement_coaching_intent (movement_id, coaching_intent) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Cable Curl'), 'Train biceps with the specific loading and range of Reverse Cable Curl while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Flyes'), 'Train shoulders with the specific loading and range of Reverse Flyes while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Grip Triceps Pushdown'), 'Train triceps with the specific loading and range of Reverse Grip Triceps Pushdown while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Rope Crunch'), 'Train abdominals with the specific loading and range of Rope Crunch while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Rope Straight-Arm Pulldown'), 'Train lats with the specific loading and range of Rope Straight-Arm Pulldown while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Bent-Over Rear Delt Raise'), 'Train shoulders with the specific loading and range of Seated Bent-Over Rear Delt Raise while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Cable Rows'), 'Train middle back with the specific loading and range of Seated Cable Rows while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Cable Shoulder Press'), 'Train shoulders with the specific loading and range of Seated Cable Shoulder Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Palms-Down Wrist Curl'), 'Train forearms with the specific loading and range of Seated Dumbbell Palms-Down Wrist Curl while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Palms-Up Wrist Curl'), 'Train forearms with the specific loading and range of Seated Dumbbell Palms-Up Wrist Curl while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Press'), 'Train shoulders with the specific loading and range of Seated Dumbbell Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Good Mornings'), 'Train lower back with the specific loading and range of Seated Good Mornings while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Side Lateral Raise'), 'Train shoulders with the specific loading and range of Seated Side Lateral Raise while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Shotgun Row'), 'Train lats with the specific loading and range of Shotgun Row while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Shoulder Press - With Bands'), 'Train shoulders with the specific loading and range of Shoulder Press - With Bands while keeping each rep technically honest.')
ON CONFLICT(movement_id) DO UPDATE SET coaching_intent = excluded.coaching_intent;

INSERT INTO movement_taxonomy (movement_id, category, implement, family) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Cable Curl'), 'accessory', 'cable', 'reverse_cable_curl'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Flyes'), 'accessory', 'dumbbell', 'reverse_flyes'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Grip Triceps Pushdown'), 'accessory', 'cable', 'reverse_grip_triceps_pushdown'),
  ((SELECT movement_id FROM movement WHERE name = 'Rope Crunch'), 'core', 'cable', 'rope_crunch'),
  ((SELECT movement_id FROM movement WHERE name = 'Rope Straight-Arm Pulldown'), 'row', 'cable', 'rope_straight_arm_pulldown'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Bent-Over Rear Delt Raise'), 'accessory', 'dumbbell', 'seated_bent_over_rear_delt_raise'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Cable Rows'), 'row', 'cable', 'seated_cable_rows'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Cable Shoulder Press'), 'push', 'cable', 'seated_cable_shoulder_press'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Palms-Down Wrist Curl'), 'accessory', 'dumbbell', 'seated_dumbbell_palms_down_wrist_curl'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Palms-Up Wrist Curl'), 'accessory', 'dumbbell', 'seated_dumbbell_palms_up_wrist_curl'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Press'), 'push', 'dumbbell', 'seated_dumbbell_press'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Good Mornings'), 'hinge', 'barbell', 'seated_good_mornings'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Side Lateral Raise'), 'accessory', 'dumbbell', 'seated_side_lateral_raise'),
  ((SELECT movement_id FROM movement WHERE name = 'Shotgun Row'), 'row', 'cable', 'shotgun_row'),
  ((SELECT movement_id FROM movement WHERE name = 'Shoulder Press - With Bands'), 'push', 'band', 'shoulder_press_with_bands')
ON CONFLICT(movement_id) DO UPDATE SET
  category = excluded.category, implement = excluded.implement, family = excluded.family;

INSERT OR IGNORE INTO movement_equipment (movement_id, item) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Cable Curl'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Flyes'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Flyes'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Grip Triceps Pushdown'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Rope Crunch'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Rope Straight-Arm Pulldown'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Bent-Over Rear Delt Raise'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Bent-Over Rear Delt Raise'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Cable Rows'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Cable Shoulder Press'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Palms-Down Wrist Curl'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Palms-Down Wrist Curl'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Palms-Up Wrist Curl'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Palms-Up Wrist Curl'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Press'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Press'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Good Mornings'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Good Mornings'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Side Lateral Raise'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Side Lateral Raise'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Shotgun Row'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Shoulder Press - With Bands'), 'bands');

INSERT INTO movement_media (movement_id, asset_key, status, revision) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Cable Curl'), 'movement/reverse-cable-curl/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Flyes'), 'movement/reverse-flyes/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Grip Triceps Pushdown'), 'movement/reverse-grip-triceps-pushdown/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Rope Crunch'), 'movement/rope-crunch/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Rope Straight-Arm Pulldown'), 'movement/rope-straight-arm-pulldown/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Bent-Over Rear Delt Raise'), 'movement/seated-bent-over-rear-delt-raise/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Cable Rows'), 'movement/seated-cable-rows/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Cable Shoulder Press'), 'movement/seated-cable-shoulder-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Palms-Down Wrist Curl'), 'movement/seated-dumbbell-palms-down-wrist-curl/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Palms-Up Wrist Curl'), 'movement/seated-dumbbell-palms-up-wrist-curl/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Press'), 'movement/seated-dumbbell-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Good Mornings'), 'movement/seated-good-mornings/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Side Lateral Raise'), 'movement/seated-side-lateral-raise/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Shotgun Row'), 'movement/shotgun-row/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Shoulder Press - With Bands'), 'movement/shoulder-press-with-bands/demo/v1', 'planned', 1)
ON CONFLICT(movement_id) DO UPDATE SET
  asset_key = excluded.asset_key, status = 'planned', revision = 1;
