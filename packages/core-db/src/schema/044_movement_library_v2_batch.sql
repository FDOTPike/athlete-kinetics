-- =============================================================================
-- 044_movement_library_v2_batch.sql
-- Phase 2a curated batch: 15 movements (generated, additive, idempotent).
-- Coaching fingerprints deliberately exclude movement media.
-- =============================================================================

INSERT OR IGNORE INTO movement (name, pattern, primary_muscle, is_compound) VALUES
  ('Kettlebell Seesaw Press', 'push_v', 'shoulders', 1),
  ('Kettlebell Turkish Get-Up (Lunge style)', 'lunge', 'shoulders', 1),
  ('Kneeling Cable Crunch With Alternating Oblique Twists', 'rotation', 'abdominals', 0),
  ('Kneeling Cable Triceps Extension', 'isolation', 'triceps', 0),
  ('Kneeling High Pulley Row', 'pull_h', 'lats', 1),
  ('Kneeling Squat', 'squat', 'glutes', 1),
  ('Lateral Raise - With Bands', 'isolation', 'shoulders', 0),
  ('Low Cable Triceps Extension', 'isolation', 'triceps', 0),
  ('Low Pulley Row To Neck', 'pull_h', 'shoulders', 1),
  ('Lunge Pass Through', 'lunge', 'hamstrings', 1),
  ('Lying Cable Curl', 'isolation', 'biceps', 0),
  ('Lying Rear Delt Raise', 'isolation', 'shoulders', 0),
  ('Lying Triceps Press', 'isolation', 'triceps', 0),
  ('Middle Back Shrug', 'isolation', 'middle back', 0),
  ('Natural Glute Ham Raise', 'hinge', 'hamstrings', 1);

INSERT INTO movement_detail
  (movement_id, base_name, supported_prefixes, difficulty_rating, target_muscles, instructions, cues, video_placeholder_uri)
VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Seesaw Press'), 'Kettlebell Seesaw Press', '["KB"]', 'Intermediate', '["shoulders","triceps"]', 'Set up Kettlebell Seesaw Press with kettlebell and choose a load or range you can control. Organise the load at shoulder height, then press overhead while staying tall through the trunk. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Stay tall through the torso. Stack the wrists over the elbows. Finish overhead with a quiet ribcage.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Turkish Get-Up (Lunge style)'), 'Kettlebell Turkish Get-Up (Lunge style)', '["KB"]', 'Intermediate', '["shoulders","abdominals","hamstrings","quadriceps","triceps"]', 'Set up Kettlebell Turkish Get-Up (Lunge style) with kettlebell and choose a load or range you can control. Move into a stable split stance, lower under control, and drive through the working foot to finish. When foot pressure rolls away from the working base, shorten the range and rebuild the next rep.', 'Build a stable split stance. Track the knee over the working foot. Drive through the whole foot to finish.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling Cable Crunch With Alternating Oblique Twists'), 'Kneeling Cable Crunch With Alternating Oblique Twists', '["Cable"]', 'Beginner', '["abdominals"]', 'Set up Kneeling Cable Crunch With Alternating Oblique Twists with cable machine and choose a load or range you can control. Brace before moving, then complete the trunk action through a range you can own without momentum. When momentum starts the rep, shorten the range and rebuild the brace.', 'Set the pelvis before the rep. Move through a braced trunk. Own the return without momentum.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling Cable Triceps Extension'), 'Kneeling Cable Triceps Extension', '["Cable"]', 'Intermediate', '["triceps"]', 'Set up Kneeling Cable Triceps Extension with bench, cable machine and choose a load or range you can control. Keep the elbows organised while the forearms extend, then return into a controlled stretch. When the elbows chase the load, the extension has lost its line; shorten the range or load.', 'Aim the elbows through one steady line. Extend through the forearms. Control the return into the stretch.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling High Pulley Row'), 'Kneeling High Pulley Row', '["Cable"]', 'Beginner', '["lats","biceps","middle back"]', 'Set up Kneeling High Pulley Row with cable machine and choose a load or range you can control. Reach into the start, then drive the elbows back until the upper back finishes the pull. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the torso before the pull. Lead with the elbows. Pause with the upper back engaged.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling Squat'), 'Kneeling Squat', '["BB"]', 'Intermediate', '["glutes","abdominals","hamstrings","lower back"]', 'Set up Kneeling Squat with barbell, squat rack and choose a load or range you can control. Sit between the hips under control, keep pressure through the whole foot, and stand through the same path. When foot pressure rolls away from the working base, shorten the range and rebuild the next rep.', 'Brace before the descent. Keep pressure through the whole foot. Drive the floor away to stand.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Lateral Raise - With Bands'), 'Lateral Raise - With Bands', '["Banded"]', 'Beginner', '["shoulders"]', 'Set up Lateral Raise - With Bands with bands and choose a load or range you can control. Move the arms through the intended arc with soft elbows and a shoulder position that stays set. When the torso swings, the load is stealing the rep; reset with less weight.', 'Set the shoulder blades before moving. Lead the rep through the elbows. Lower with the same smooth path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Low Cable Triceps Extension'), 'Low Cable Triceps Extension', '["Cable"]', 'Beginner', '["triceps"]', 'Set up Low Cable Triceps Extension with bench, cable machine and choose a load or range you can control. Keep the elbows organised while the forearms extend, then return into a controlled stretch. When the elbows chase the load, the extension has lost its line; shorten the range or load.', 'Aim the elbows through one steady line. Extend through the forearms. Control the return into the stretch.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Low Pulley Row To Neck'), 'Low Pulley Row To Neck', '["Cable"]', 'Beginner', '["shoulders","biceps","middle back","traps"]', 'Set up Low Pulley Row To Neck with cable machine and choose a load or range you can control. Reach into the start, then drive the elbows back until the upper back finishes the pull. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the torso before the pull. Lead with the elbows. Pause with the upper back engaged.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Lunge Pass Through'), 'Lunge Pass Through', '["KB"]', 'Intermediate', '["hamstrings","calves","glutes","quadriceps"]', 'Set up Lunge Pass Through with kettlebell and choose a load or range you can control. Move into a stable split stance, lower under control, and drive through the working foot to finish. When foot pressure rolls away from the working base, shorten the range and rebuild the next rep.', 'Build a stable split stance. Track the knee over the working foot. Drive through the whole foot to finish.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Lying Cable Curl'), 'Lying Cable Curl', '["Cable"]', 'Intermediate', '["biceps"]', 'Set up Lying Cable Curl with cable machine and choose a load or range you can control. Hold the upper arms still, curl the load through the forearms, and squeeze without lifting the shoulders. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Keep the upper arms quiet. Curl through the forearms. Own the lowering phase.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Lying Rear Delt Raise'), 'Lying Rear Delt Raise', '["DB"]', 'Intermediate', '["shoulders"]', 'Set up Lying Rear Delt Raise with bench, dumbbells and choose a load or range you can control. Move the arms through the intended arc with soft elbows and a shoulder position that stays set. When the torso swings, the load is stealing the rep; reset with less weight.', 'Set the shoulder blades before moving. Lead the rep through the elbows. Lower with the same smooth path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Lying Triceps Press'), 'Lying Triceps Press', '["BB"]', 'Intermediate', '["triceps"]', 'Set up Lying Triceps Press with barbell, bench and choose a load or range you can control. Keep the elbows organised while the forearms extend, then return into a controlled stretch. When the elbows chase the load, the extension has lost its line; shorten the range or load.', 'Aim the elbows through one steady line. Extend through the forearms. Control the return into the stretch.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Middle Back Shrug'), 'Middle Back Shrug', '["DB"]', 'Intermediate', '["middle back"]', 'Set up Middle Back Shrug with bench, dumbbells and choose a load or range you can control. Raise the shoulders up and back, pause behind the ears, and lower through the same path. When posture or foot strike changes, slow the pace before continuing.', 'Stand tall before the shrug. Drive the shoulders up and back behind the ears. Own the pause before lowering.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Natural Glute Ham Raise'), 'Natural Glute Ham Raise', '["Bodyweight"]', 'Intermediate', '["hamstrings","calves","glutes","lower back"]', 'Set up Natural Glute Ham Raise with bands, bench and choose a load or range you can control. Move the arms through the intended arc with soft elbows and a shoulder position that stays set. When the torso swings, the load is stealing the rep; reset with less weight.', 'Set the shoulder blades before moving. Lead the rep through the elbows. Lower with the same smooth path.', '')
ON CONFLICT(movement_id) DO UPDATE SET
  base_name = excluded.base_name,
  supported_prefixes = excluded.supported_prefixes,
  difficulty_rating = excluded.difficulty_rating,
  target_muscles = excluded.target_muscles,
  instructions = excluded.instructions,
  cues = excluded.cues,
  video_placeholder_uri = '';

INSERT INTO movement_coaching_intent (movement_id, coaching_intent) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Seesaw Press'), 'Train shoulders with the specific loading and range of Kettlebell Seesaw Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Turkish Get-Up (Lunge style)'), 'Train shoulders with the specific loading and range of Kettlebell Turkish Get-Up (Lunge style) while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling Cable Crunch With Alternating Oblique Twists'), 'Train abdominals with the specific loading and range of Kneeling Cable Crunch With Alternating Oblique Twists while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling Cable Triceps Extension'), 'Train triceps with the specific loading and range of Kneeling Cable Triceps Extension while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling High Pulley Row'), 'Train lats with the specific loading and range of Kneeling High Pulley Row while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling Squat'), 'Train glutes with the specific loading and range of Kneeling Squat while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Lateral Raise - With Bands'), 'Train shoulders with the specific loading and range of Lateral Raise - With Bands while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Low Cable Triceps Extension'), 'Train triceps with the specific loading and range of Low Cable Triceps Extension while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Low Pulley Row To Neck'), 'Train shoulders with the specific loading and range of Low Pulley Row To Neck while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Lunge Pass Through'), 'Train hamstrings with the specific loading and range of Lunge Pass Through while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Lying Cable Curl'), 'Train biceps with the specific loading and range of Lying Cable Curl while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Lying Rear Delt Raise'), 'Train shoulders with the specific loading and range of Lying Rear Delt Raise while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Lying Triceps Press'), 'Train triceps with the specific loading and range of Lying Triceps Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Middle Back Shrug'), 'Train middle back with the specific loading and range of Middle Back Shrug while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Natural Glute Ham Raise'), 'Train hamstrings with the specific loading and range of Natural Glute Ham Raise while keeping each rep technically honest.')
ON CONFLICT(movement_id) DO UPDATE SET coaching_intent = excluded.coaching_intent;

INSERT INTO movement_taxonomy (movement_id, category, implement, family) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Seesaw Press'), 'push', 'kettlebell', 'kettlebell_seesaw_press'),
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Turkish Get-Up (Lunge style)'), 'unilateral', 'kettlebell', 'kettlebell_turkish_get_up_lunge_style'),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling Cable Crunch With Alternating Oblique Twists'), 'core', 'cable', 'kneeling_cable_crunch_with_alternating_oblique_twists'),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling Cable Triceps Extension'), 'accessory', 'cable', 'kneeling_cable_triceps_extension'),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling High Pulley Row'), 'row', 'cable', 'kneeling_high_pulley_row'),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling Squat'), 'squat', 'barbell', 'kneeling_squat'),
  ((SELECT movement_id FROM movement WHERE name = 'Lateral Raise - With Bands'), 'accessory', 'band', 'lateral_raise_with_bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Low Cable Triceps Extension'), 'accessory', 'cable', 'low_cable_triceps_extension'),
  ((SELECT movement_id FROM movement WHERE name = 'Low Pulley Row To Neck'), 'row', 'cable', 'low_pulley_row_to_neck'),
  ((SELECT movement_id FROM movement WHERE name = 'Lunge Pass Through'), 'unilateral', 'kettlebell', 'lunge_pass_through'),
  ((SELECT movement_id FROM movement WHERE name = 'Lying Cable Curl'), 'accessory', 'cable', 'lying_cable_curl'),
  ((SELECT movement_id FROM movement WHERE name = 'Lying Rear Delt Raise'), 'accessory', 'dumbbell', 'lying_rear_delt_raise'),
  ((SELECT movement_id FROM movement WHERE name = 'Lying Triceps Press'), 'accessory', 'barbell', 'lying_triceps_press'),
  ((SELECT movement_id FROM movement WHERE name = 'Middle Back Shrug'), 'row', 'dumbbell', 'middle_back_shrug'),
  ((SELECT movement_id FROM movement WHERE name = 'Natural Glute Ham Raise'), 'accessory', 'bodyweight', 'natural_glute_ham_raise')
ON CONFLICT(movement_id) DO UPDATE SET
  category = excluded.category, implement = excluded.implement, family = excluded.family;

INSERT OR IGNORE INTO movement_equipment (movement_id, item) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Seesaw Press'), 'kettlebell'),
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Turkish Get-Up (Lunge style)'), 'kettlebell'),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling Cable Crunch With Alternating Oblique Twists'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling Cable Triceps Extension'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling Cable Triceps Extension'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling High Pulley Row'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling Squat'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling Squat'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Lateral Raise - With Bands'), 'bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Low Cable Triceps Extension'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Low Cable Triceps Extension'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Low Pulley Row To Neck'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Lunge Pass Through'), 'kettlebell'),
  ((SELECT movement_id FROM movement WHERE name = 'Lying Cable Curl'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Lying Rear Delt Raise'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Lying Rear Delt Raise'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Lying Triceps Press'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Lying Triceps Press'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Middle Back Shrug'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Middle Back Shrug'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Natural Glute Ham Raise'), 'bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Natural Glute Ham Raise'), 'bench');

INSERT INTO movement_media (movement_id, asset_key, status, revision) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Seesaw Press'), 'movement/kettlebell-seesaw-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Turkish Get-Up (Lunge style)'), 'movement/kettlebell-turkish-get-up-lunge-style/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling Cable Crunch With Alternating Oblique Twists'), 'movement/kneeling-cable-crunch-with-alternating-oblique-twists/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling Cable Triceps Extension'), 'movement/kneeling-cable-triceps-extension/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling High Pulley Row'), 'movement/kneeling-high-pulley-row/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling Squat'), 'movement/kneeling-squat/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Lateral Raise - With Bands'), 'movement/lateral-raise-with-bands/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Low Cable Triceps Extension'), 'movement/low-cable-triceps-extension/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Low Pulley Row To Neck'), 'movement/low-pulley-row-to-neck/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Lunge Pass Through'), 'movement/lunge-pass-through/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Lying Cable Curl'), 'movement/lying-cable-curl/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Lying Rear Delt Raise'), 'movement/lying-rear-delt-raise/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Lying Triceps Press'), 'movement/lying-triceps-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Middle Back Shrug'), 'movement/middle-back-shrug/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Natural Glute Ham Raise'), 'movement/natural-glute-ham-raise/demo/v1', 'planned', 1)
ON CONFLICT(movement_id) DO UPDATE SET
  asset_key = excluded.asset_key, status = 'planned', revision = 1;
