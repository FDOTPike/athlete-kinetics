-- =============================================================================
-- 039_movement_library_v2_batch.sql
-- Phase 2a curated batch: 15 movements (generated, additive, idempotent).
-- Coaching fingerprints deliberately exclude movement media.
-- =============================================================================

INSERT OR IGNORE INTO movement (name, pattern, primary_muscle, is_compound) VALUES
  ('Cable Incline Triceps Extension', 'isolation', 'triceps', 0),
  ('Cable Lying Triceps Extension', 'isolation', 'triceps', 0),
  ('Cable One Arm Tricep Extension', 'isolation', 'triceps', 0),
  ('Cable Preacher Curl', 'isolation', 'biceps', 0),
  ('Cable Rear Delt Fly', 'isolation', 'shoulders', 0),
  ('Cable Russian Twists', 'rotation', 'abdominals', 1),
  ('Cable Seated Crunch', 'rotation', 'abdominals', 0),
  ('Cable Seated Lateral Raise', 'isolation', 'shoulders', 0),
  ('Cable Shrugs', 'isolation', 'traps', 0),
  ('Cable Wrist Curl', 'isolation', 'forearms', 0),
  ('Calf Raise On A Dumbbell', 'isolation', 'calves', 0),
  ('Clock Push-Up', 'push_h', 'chest', 1),
  ('Close-Grip EZ Bar Curl', 'isolation', 'biceps', 0),
  ('Close-Grip EZ-Bar Press', 'push_h', 'triceps', 1),
  ('Close-Grip Front Lat Pulldown', 'pull_v', 'lats', 1);

INSERT INTO movement_detail
  (movement_id, base_name, supported_prefixes, difficulty_rating, target_muscles, instructions, cues, video_placeholder_uri)
VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Cable Incline Triceps Extension'), 'Cable Incline Triceps Extension', '["Cable"]', 'Beginner', '["triceps"]', 'Set up Cable Incline Triceps Extension with bench, cable machine and choose a load or range you can control. Keep the elbows organised while the forearms extend, then return into a controlled stretch. When the elbows chase the load, the extension has lost its line; shorten the range or load.', 'Aim the elbows through one steady line. Extend through the forearms. Control the return into the stretch.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Lying Triceps Extension'), 'Cable Lying Triceps Extension', '["Cable"]', 'Beginner', '["triceps"]', 'Set up Cable Lying Triceps Extension with bench, cable machine and choose a load or range you can control. Keep the elbows organised while the forearms extend, then return into a controlled stretch. When the elbows chase the load, the extension has lost its line; shorten the range or load.', 'Aim the elbows through one steady line. Extend through the forearms. Control the return into the stretch.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Cable One Arm Tricep Extension'), 'Cable One Arm Tricep Extension', '["Cable"]', 'Beginner', '["triceps"]', 'Set up Cable One Arm Tricep Extension with cable machine and choose a load or range you can control. Keep the elbows organised while the forearms extend, then return into a controlled stretch. When the elbows chase the load, the extension has lost its line; shorten the range or load.', 'Aim the elbows through one steady line. Extend through the forearms. Control the return into the stretch.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Preacher Curl'), 'Cable Preacher Curl', '["Cable"]', 'Beginner', '["biceps","forearms"]', 'Set up Cable Preacher Curl with bench, cable machine and choose a load or range you can control. Hold the upper arms still, curl the load through the forearms, and squeeze without lifting the shoulders. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Keep the upper arms quiet. Curl through the forearms. Own the lowering phase.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Rear Delt Fly'), 'Cable Rear Delt Fly', '["Cable"]', 'Beginner', '["shoulders"]', 'Set up Cable Rear Delt Fly with cable machine and choose a load or range you can control. Move at a sustainable pace while keeping each stride and change of direction deliberate. When posture or foot strike changes, slow the pace before continuing.', 'Set a repeatable starting position. Keep every stride smooth and quiet. Finish with the same posture you started with.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Russian Twists'), 'Cable Russian Twists', '["Cable"]', 'Beginner', '["abdominals"]', 'Set up Cable Russian Twists with cable machine and choose a load or range you can control. Brace before moving, then complete the trunk action through a range you can own without momentum. When momentum starts the rep, shorten the range and rebuild the brace.', 'Set the pelvis before the rep. Move through a braced trunk. Own the return without momentum.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Seated Crunch'), 'Cable Seated Crunch', '["Cable"]', 'Beginner', '["abdominals"]', 'Set up Cable Seated Crunch with bench, cable machine and choose a load or range you can control. Brace before moving, then complete the trunk action through a range you can own without momentum. When momentum starts the rep, shorten the range and rebuild the brace.', 'Set the pelvis before the rep. Move through a braced trunk. Own the return without momentum.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Seated Lateral Raise'), 'Cable Seated Lateral Raise', '["Cable"]', 'Beginner', '["shoulders","middle back","traps"]', 'Set up Cable Seated Lateral Raise with bench, cable machine and choose a load or range you can control. Move the arms through the intended arc with soft elbows and a shoulder position that stays set. When the torso swings, the load is stealing the rep; reset with less weight.', 'Set the shoulder blades before moving. Lead the rep through the elbows. Lower with the same smooth path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Shrugs'), 'Cable Shrugs', '["Cable"]', 'Beginner', '["traps"]', 'Set up Cable Shrugs with cable machine and choose a load or range you can control. Raise the shoulders up and back, pause behind the ears, and lower through the same path. When posture or foot strike changes, slow the pace before continuing.', 'Stand tall before the shrug. Drive the shoulders up and back behind the ears. Own the pause before lowering.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Wrist Curl'), 'Cable Wrist Curl', '["Cable"]', 'Beginner', '["forearms"]', 'Set up Cable Wrist Curl with bench, cable machine and choose a load or range you can control. Support the forearms and move the load through the available wrist or finger range without shifting the elbows. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Support the forearms before the rep. Move through the wrists with a relaxed grip. Own the full return.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Calf Raise On A Dumbbell'), 'Calf Raise On A Dumbbell', '["DB"]', 'Intermediate', '["calves"]', 'Set up Calf Raise On A Dumbbell with dumbbells and choose a load or range you can control. Rise through the ball of the working foot, pause at the top, and lower the heel under control. When the torso swings, the load is stealing the rep; reset with less weight.', 'Keep pressure through the ball of the foot. Rise as tall as the ankle allows. Lower through a controlled stretch.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Clock Push-Up'), 'Clock Push-Up', '["Bodyweight"]', 'Intermediate', '["chest","shoulders","triceps"]', 'Set up Clock Push-Up with a stable bodyweight start position and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip EZ Bar Curl'), 'Close-Grip EZ Bar Curl', '["BB"]', 'Beginner', '["biceps","forearms"]', 'Set up Close-Grip EZ Bar Curl with barbell and choose a load or range you can control. Hold the upper arms still, curl the load through the forearms, and squeeze without lifting the shoulders. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Keep the upper arms quiet. Curl through the forearms. Own the lowering phase.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip EZ-Bar Press'), 'Close-Grip EZ-Bar Press', '["BB"]', 'Beginner', '["triceps","chest","shoulders"]', 'Set up Close-Grip EZ-Bar Press with barbell, bench and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip Front Lat Pulldown'), 'Close-Grip Front Lat Pulldown', '["Cable"]', 'Beginner', '["lats","biceps","middle back","shoulders"]', 'Set up Close-Grip Front Lat Pulldown with cable machine and choose a load or range you can control. Set the shoulders before bending the elbows, then pull through the full available range. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the shoulders before bending the elbows. Pull through the elbows, not the hands. Reach long under control.', '')
ON CONFLICT(movement_id) DO UPDATE SET
  base_name = excluded.base_name,
  supported_prefixes = excluded.supported_prefixes,
  difficulty_rating = excluded.difficulty_rating,
  target_muscles = excluded.target_muscles,
  instructions = excluded.instructions,
  cues = excluded.cues,
  video_placeholder_uri = '';

INSERT INTO movement_coaching_intent (movement_id, coaching_intent) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Cable Incline Triceps Extension'), 'Train triceps with the specific loading and range of Cable Incline Triceps Extension while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Lying Triceps Extension'), 'Train triceps with the specific loading and range of Cable Lying Triceps Extension while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable One Arm Tricep Extension'), 'Train triceps with the specific loading and range of Cable One Arm Tricep Extension while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Preacher Curl'), 'Train biceps with the specific loading and range of Cable Preacher Curl while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Rear Delt Fly'), 'Train shoulders with the specific loading and range of Cable Rear Delt Fly while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Russian Twists'), 'Train abdominals with the specific loading and range of Cable Russian Twists while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Seated Crunch'), 'Train abdominals with the specific loading and range of Cable Seated Crunch while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Seated Lateral Raise'), 'Train shoulders with the specific loading and range of Cable Seated Lateral Raise while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Shrugs'), 'Train traps with the specific loading and range of Cable Shrugs while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Wrist Curl'), 'Train forearms with the specific loading and range of Cable Wrist Curl while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Calf Raise On A Dumbbell'), 'Train calves with the specific loading and range of Calf Raise On A Dumbbell while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Clock Push-Up'), 'Train chest with the specific loading and range of Clock Push-Up while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip EZ Bar Curl'), 'Train biceps with the specific loading and range of Close-Grip EZ Bar Curl while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip EZ-Bar Press'), 'Train triceps with the specific loading and range of Close-Grip EZ-Bar Press while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip Front Lat Pulldown'), 'Train lats with the specific loading and range of Close-Grip Front Lat Pulldown while keeping each rep technically honest.')
ON CONFLICT(movement_id) DO UPDATE SET coaching_intent = excluded.coaching_intent;

INSERT INTO movement_taxonomy (movement_id, category, implement, family) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Cable Incline Triceps Extension'), 'accessory', 'cable', 'cable_incline_triceps_extension'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Lying Triceps Extension'), 'accessory', 'cable', 'cable_lying_triceps_extension'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable One Arm Tricep Extension'), 'unilateral', 'cable', 'cable_one_arm_tricep_extension'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Preacher Curl'), 'accessory', 'cable', 'cable_preacher_curl'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Rear Delt Fly'), 'accessory', 'cable', 'cable_rear_delt_fly'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Russian Twists'), 'core', 'cable', 'cable_russian_twists'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Seated Crunch'), 'core', 'cable', 'cable_seated_crunch'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Seated Lateral Raise'), 'accessory', 'cable', 'cable_seated_lateral_raise'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Shrugs'), 'row', 'cable', 'cable_shrugs'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Wrist Curl'), 'accessory', 'cable', 'cable_wrist_curl'),
  ((SELECT movement_id FROM movement WHERE name = 'Calf Raise On A Dumbbell'), 'accessory', 'dumbbell', 'calf_raise_on_a_dumbbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Clock Push-Up'), 'push', 'bodyweight', 'clock_push_up'),
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip EZ Bar Curl'), 'accessory', 'barbell', 'close_grip_ez_bar_curl'),
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip EZ-Bar Press'), 'push', 'barbell', 'close_grip_ez_bar_press'),
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip Front Lat Pulldown'), 'row', 'cable', 'close_grip_front_lat_pulldown')
ON CONFLICT(movement_id) DO UPDATE SET
  category = excluded.category, implement = excluded.implement, family = excluded.family;

INSERT OR IGNORE INTO movement_equipment (movement_id, item) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Cable Incline Triceps Extension'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Incline Triceps Extension'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Lying Triceps Extension'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Lying Triceps Extension'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable One Arm Tricep Extension'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Preacher Curl'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Preacher Curl'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Rear Delt Fly'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Russian Twists'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Seated Crunch'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Seated Crunch'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Seated Lateral Raise'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Seated Lateral Raise'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Shrugs'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Wrist Curl'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Wrist Curl'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Calf Raise On A Dumbbell'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip EZ Bar Curl'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip EZ-Bar Press'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip EZ-Bar Press'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip Front Lat Pulldown'), 'cable_machine');

INSERT INTO movement_media (movement_id, asset_key, status, revision) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Cable Incline Triceps Extension'), 'movement/cable-incline-triceps-extension/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Lying Triceps Extension'), 'movement/cable-lying-triceps-extension/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Cable One Arm Tricep Extension'), 'movement/cable-one-arm-tricep-extension/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Preacher Curl'), 'movement/cable-preacher-curl/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Rear Delt Fly'), 'movement/cable-rear-delt-fly/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Russian Twists'), 'movement/cable-russian-twists/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Seated Crunch'), 'movement/cable-seated-crunch/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Seated Lateral Raise'), 'movement/cable-seated-lateral-raise/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Shrugs'), 'movement/cable-shrugs/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Wrist Curl'), 'movement/cable-wrist-curl/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Calf Raise On A Dumbbell'), 'movement/calf-raise-on-a-dumbbell/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Clock Push-Up'), 'movement/clock-push-up/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip EZ Bar Curl'), 'movement/close-grip-ez-bar-curl/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip EZ-Bar Press'), 'movement/close-grip-ez-bar-press/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip Front Lat Pulldown'), 'movement/close-grip-front-lat-pulldown/demo/v1', 'planned', 1)
ON CONFLICT(movement_id) DO UPDATE SET
  asset_key = excluded.asset_key, status = 'planned', revision = 1;
