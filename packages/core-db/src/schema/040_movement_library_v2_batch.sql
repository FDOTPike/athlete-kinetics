-- =============================================================================
-- 040_movement_library_v2_batch.sql
-- Phase 2a curated batch: 15 movements (generated, additive, idempotent).
-- Coaching fingerprints deliberately exclude movement media.
-- =============================================================================

INSERT OR IGNORE INTO movement (name, pattern, primary_muscle, is_compound) VALUES
  ('Close-Grip Push-Up off of a Dumbbell', 'push_h', 'triceps', 1),
  ('Concentration Curls', 'isolation', 'biceps', 0),
  ('Cross Body Hammer Curl', 'isolation', 'biceps', 0),
  ('Cross-Body Crunch', 'rotation', 'abdominals', 1),
  ('Crunch - Hands Overhead', 'rotation', 'abdominals', 0),
  ('Crunches', 'rotation', 'abdominals', 0),
  ('Deadlift with Bands', 'hinge', 'lower back', 1),
  ('Decline Close-Grip Bench To Skull Crusher', 'push_h', 'triceps', 1),
  ('Decline Dumbbell Flyes', 'push_h', 'chest', 1),
  ('Decline Dumbbell Triceps Extension', 'isolation', 'triceps', 0),
  ('Decline EZ Bar Triceps Extension', 'isolation', 'triceps', 0),
  ('Decline Oblique Crunch', 'rotation', 'abdominals', 1),
  ('Decline Push-Up', 'push_h', 'chest', 1),
  ('Decline Reverse Crunch', 'rotation', 'abdominals', 1),
  ('Drag Curl', 'isolation', 'biceps', 1);

INSERT INTO movement_detail
  (movement_id, base_name, supported_prefixes, difficulty_rating, target_muscles, instructions, cues, video_placeholder_uri)
VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip Push-Up off of a Dumbbell'), 'Close-Grip Push-Up off of a Dumbbell', '["Bodyweight"]', 'Intermediate', '["triceps","abdominals","chest","shoulders"]', 'Set up Close-Grip Push-Up off of a Dumbbell with dumbbells and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Concentration Curls'), 'Concentration Curls', '["DB"]', 'Beginner', '["biceps","forearms"]', 'Set up Concentration Curls with bench, dumbbells and choose a load or range you can control. Hold the upper arms still, curl the load through the forearms, and squeeze without lifting the shoulders. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Keep the upper arms quiet. Curl through the forearms. Own the lowering phase.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Cross Body Hammer Curl'), 'Cross Body Hammer Curl', '["DB"]', 'Beginner', '["biceps","forearms"]', 'Set up Cross Body Hammer Curl with dumbbells and choose a load or range you can control. Hold the upper arms still, curl the load through the forearms, and squeeze without lifting the shoulders. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Keep the upper arms quiet. Curl through the forearms. Own the lowering phase.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Cross-Body Crunch'), 'Cross-Body Crunch', '["Bodyweight"]', 'Beginner', '["abdominals"]', 'Set up Cross-Body Crunch with a stable bodyweight start position and choose a load or range you can control. Brace before moving, then complete the trunk action through a range you can own without momentum. When momentum starts the rep, shorten the range and rebuild the brace.', 'Set the pelvis before the rep. Move through a braced trunk. Own the return without momentum.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Crunch - Hands Overhead'), 'Crunch - Hands Overhead', '["Bodyweight"]', 'Beginner', '["abdominals"]', 'Set up Crunch - Hands Overhead with a stable bodyweight start position and choose a load or range you can control. Brace before moving, then complete the trunk action through a range you can own without momentum. When momentum starts the rep, shorten the range and rebuild the brace.', 'Set the pelvis before the rep. Move through a braced trunk. Own the return without momentum.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Crunches'), 'Crunches', '["Bodyweight"]', 'Beginner', '["abdominals"]', 'Set up Crunches with bench and choose a load or range you can control. Brace before moving, then complete the trunk action through a range you can own without momentum. When momentum starts the rep, shorten the range and rebuild the brace.', 'Set the pelvis before the rep. Move through a braced trunk. Own the return without momentum.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Deadlift with Bands'), 'Deadlift with Bands', '["BB"]', 'Advanced', '["lower back","forearms","glutes","hamstrings","middle back","quadriceps","traps"]', 'Set up Deadlift with Bands with bands, barbell, dumbbells, squat rack and choose a load or range you can control. Soften the knees, send the hips back until the posterior chain loads, and stand by driving the hips through. When the load leaves the hips and moves into the back, reduce the range or weight before the next rep.', 'Set the ribs down and brace first. Send the hips back into the load. Finish tall through the glutes.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Close-Grip Bench To Skull Crusher'), 'Decline Close-Grip Bench To Skull Crusher', '["BB"]', 'Intermediate', '["triceps","chest","shoulders"]', 'Set up Decline Close-Grip Bench To Skull Crusher with barbell, bench, squat rack and choose a load or range you can control. Keep the elbows organised while the forearms extend, then return into a controlled stretch. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Aim the elbows through one steady line. Extend through the forearms. Control the return into the stretch.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Dumbbell Flyes'), 'Decline Dumbbell Flyes', '["DB"]', 'Beginner', '["chest"]', 'Set up Decline Dumbbell Flyes with bench, dumbbells and choose a load or range you can control. Move the arms through the intended arc with soft elbows and a shoulder position that stays set. When the torso swings, the load is stealing the rep; reset with less weight.', 'Set the shoulder blades before moving. Lead the rep through the elbows. Lower with the same smooth path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Dumbbell Triceps Extension'), 'Decline Dumbbell Triceps Extension', '["DB"]', 'Beginner', '["triceps"]', 'Set up Decline Dumbbell Triceps Extension with bench, dumbbells and choose a load or range you can control. Keep the elbows organised while the forearms extend, then return into a controlled stretch. When the elbows chase the load, the extension has lost its line; shorten the range or load.', 'Aim the elbows through one steady line. Extend through the forearms. Control the return into the stretch.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Decline EZ Bar Triceps Extension'), 'Decline EZ Bar Triceps Extension', '["BB"]', 'Beginner', '["triceps"]', 'Set up Decline EZ Bar Triceps Extension with barbell, bench, squat rack and choose a load or range you can control. Keep the elbows organised while the forearms extend, then return into a controlled stretch. When the elbows chase the load, the extension has lost its line; shorten the range or load.', 'Aim the elbows through one steady line. Extend through the forearms. Control the return into the stretch.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Oblique Crunch'), 'Decline Oblique Crunch', '["Bodyweight"]', 'Beginner', '["abdominals"]', 'Set up Decline Oblique Crunch with bench and choose a load or range you can control. Brace before moving, then complete the trunk action through a range you can own without momentum. When momentum starts the rep, shorten the range and rebuild the brace.', 'Set the pelvis before the rep. Move through a braced trunk. Own the return without momentum.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Push-Up'), 'Decline Push-Up', '["Bodyweight"]', 'Beginner', '["chest","shoulders","triceps"]', 'Set up Decline Push-Up with bench and choose a load or range you can control. Lower into the working range with the shoulders supported, then press through the intended line. When the press path shifts or the setup lifts, the set is finished; reset before continuing.', 'Keep the chest open and shoulder blades set. Stack the wrists over the press line. Finish every rep through the same path.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Reverse Crunch'), 'Decline Reverse Crunch', '["Bodyweight"]', 'Beginner', '["abdominals"]', 'Set up Decline Reverse Crunch with bench and choose a load or range you can control. Brace before moving, then complete the trunk action through a range you can own without momentum. When momentum starts the rep, shorten the range and rebuild the brace.', 'Set the pelvis before the rep. Move through a braced trunk. Own the return without momentum.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Drag Curl'), 'Drag Curl', '["BB"]', 'Intermediate', '["biceps","forearms"]', 'Set up Drag Curl with barbell and choose a load or range you can control. Hold the upper arms still, curl the load through the forearms, and squeeze without lifting the shoulders. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.', 'Keep the upper arms quiet. Curl through the forearms. Own the lowering phase.', '')
ON CONFLICT(movement_id) DO UPDATE SET
  base_name = excluded.base_name,
  supported_prefixes = excluded.supported_prefixes,
  difficulty_rating = excluded.difficulty_rating,
  target_muscles = excluded.target_muscles,
  instructions = excluded.instructions,
  cues = excluded.cues,
  video_placeholder_uri = '';

INSERT INTO movement_coaching_intent (movement_id, coaching_intent) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip Push-Up off of a Dumbbell'), 'Train triceps with the specific loading and range of Close-Grip Push-Up off of a Dumbbell while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Concentration Curls'), 'Train biceps with the specific loading and range of Concentration Curls while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Cross Body Hammer Curl'), 'Train biceps with the specific loading and range of Cross Body Hammer Curl while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Cross-Body Crunch'), 'Train abdominals with the specific loading and range of Cross-Body Crunch while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Crunch - Hands Overhead'), 'Train abdominals with the specific loading and range of Crunch - Hands Overhead while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Crunches'), 'Train abdominals with the specific loading and range of Crunches while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Deadlift with Bands'), 'Train lower back with the specific loading and range of Deadlift with Bands while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Close-Grip Bench To Skull Crusher'), 'Train triceps with the specific loading and range of Decline Close-Grip Bench To Skull Crusher while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Dumbbell Flyes'), 'Train chest with the specific loading and range of Decline Dumbbell Flyes while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Dumbbell Triceps Extension'), 'Train triceps with the specific loading and range of Decline Dumbbell Triceps Extension while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline EZ Bar Triceps Extension'), 'Train triceps with the specific loading and range of Decline EZ Bar Triceps Extension while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Oblique Crunch'), 'Train abdominals with the specific loading and range of Decline Oblique Crunch while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Push-Up'), 'Train chest with the specific loading and range of Decline Push-Up while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Reverse Crunch'), 'Train abdominals with the specific loading and range of Decline Reverse Crunch while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Drag Curl'), 'Train biceps with the specific loading and range of Drag Curl while keeping each rep technically honest.')
ON CONFLICT(movement_id) DO UPDATE SET coaching_intent = excluded.coaching_intent;

INSERT INTO movement_taxonomy (movement_id, category, implement, family) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip Push-Up off of a Dumbbell'), 'push', 'bodyweight', 'close_grip_push_up_off_of_a_dumbbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Concentration Curls'), 'accessory', 'dumbbell', 'concentration_curls'),
  ((SELECT movement_id FROM movement WHERE name = 'Cross Body Hammer Curl'), 'accessory', 'dumbbell', 'cross_body_hammer_curl'),
  ((SELECT movement_id FROM movement WHERE name = 'Cross-Body Crunch'), 'core', 'bodyweight', 'cross_body_crunch'),
  ((SELECT movement_id FROM movement WHERE name = 'Crunch - Hands Overhead'), 'core', 'bodyweight', 'crunch_hands_overhead'),
  ((SELECT movement_id FROM movement WHERE name = 'Crunches'), 'core', 'bodyweight', 'crunches'),
  ((SELECT movement_id FROM movement WHERE name = 'Deadlift with Bands'), 'hinge', 'barbell', 'deadlift_with_bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Close-Grip Bench To Skull Crusher'), 'push', 'barbell', 'decline_close_grip_bench_to_skull_crusher'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Dumbbell Flyes'), 'push', 'dumbbell', 'decline_dumbbell_flyes'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Dumbbell Triceps Extension'), 'accessory', 'dumbbell', 'decline_dumbbell_triceps_extension'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline EZ Bar Triceps Extension'), 'accessory', 'barbell', 'decline_ez_bar_triceps_extension'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Oblique Crunch'), 'core', 'bodyweight', 'decline_oblique_crunch'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Push-Up'), 'push', 'bodyweight', 'decline_push_up'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Reverse Crunch'), 'core', 'bodyweight', 'decline_reverse_crunch'),
  ((SELECT movement_id FROM movement WHERE name = 'Drag Curl'), 'accessory', 'barbell', 'drag_curl')
ON CONFLICT(movement_id) DO UPDATE SET
  category = excluded.category, implement = excluded.implement, family = excluded.family;

INSERT OR IGNORE INTO movement_equipment (movement_id, item) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip Push-Up off of a Dumbbell'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Concentration Curls'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Concentration Curls'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Cross Body Hammer Curl'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Crunches'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Deadlift with Bands'), 'bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Deadlift with Bands'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Deadlift with Bands'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Deadlift with Bands'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Close-Grip Bench To Skull Crusher'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Close-Grip Bench To Skull Crusher'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Close-Grip Bench To Skull Crusher'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Dumbbell Flyes'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Dumbbell Flyes'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Dumbbell Triceps Extension'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Dumbbell Triceps Extension'), 'dumbbells'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline EZ Bar Triceps Extension'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline EZ Bar Triceps Extension'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline EZ Bar Triceps Extension'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Oblique Crunch'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Push-Up'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Reverse Crunch'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Drag Curl'), 'barbell');

INSERT INTO movement_media (movement_id, asset_key, status, revision) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip Push-Up off of a Dumbbell'), 'movement/close-grip-push-up-off-of-a-dumbbell/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Concentration Curls'), 'movement/concentration-curls/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Cross Body Hammer Curl'), 'movement/cross-body-hammer-curl/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Cross-Body Crunch'), 'movement/cross-body-crunch/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Crunch - Hands Overhead'), 'movement/crunch-hands-overhead/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Crunches'), 'movement/crunches/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Deadlift with Bands'), 'movement/deadlift-with-bands/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Close-Grip Bench To Skull Crusher'), 'movement/decline-close-grip-bench-to-skull-crusher/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Dumbbell Flyes'), 'movement/decline-dumbbell-flyes/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Dumbbell Triceps Extension'), 'movement/decline-dumbbell-triceps-extension/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Decline EZ Bar Triceps Extension'), 'movement/decline-ez-bar-triceps-extension/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Oblique Crunch'), 'movement/decline-oblique-crunch/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Push-Up'), 'movement/decline-push-up/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Reverse Crunch'), 'movement/decline-reverse-crunch/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Drag Curl'), 'movement/drag-curl/demo/v1', 'planned', 1)
ON CONFLICT(movement_id) DO UPDATE SET
  asset_key = excluded.asset_key, status = 'planned', revision = 1;
