-- =============================================================================
-- 048_movement_library_v2_batch.sql
-- Phase 2a curated batch: 11 movements (generated, additive, idempotent).
-- Coaching fingerprints deliberately exclude movement media.
-- =============================================================================

INSERT OR IGNORE INTO movement (name, pattern, primary_muscle, is_compound) VALUES
  ('Sumo Deadlift with Bands', 'hinge', 'hamstrings', 1),
  ('Trail Running/Walking', 'locomotion', 'quadriceps', 0),
  ('Triceps Pushdown - Rope Attachment', 'isolation', 'triceps', 0),
  ('Two-Arm Kettlebell Row', 'pull_h', 'middle back', 1),
  ('Underhand Cable Pulldowns', 'pull_v', 'lats', 1),
  ('Upright Barbell Row', 'pull_v', 'shoulders', 1),
  ('Upright Cable Row', 'pull_v', 'traps', 1),
  ('Upright Row - With Bands', 'pull_v', 'traps', 1),
  ('V-Bar Pullup', 'pull_v', 'lats', 1),
  ('Wide Stance Barbell Squat', 'squat', 'quadriceps', 1),
  ('Wide-Grip Lat Pulldown', 'pull_v', 'lats', 1);

INSERT INTO movement_detail
  (movement_id, base_name, supported_prefixes, difficulty_rating, target_muscles, instructions, cues, video_placeholder_uri)
VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Sumo Deadlift with Bands'), 'Sumo Deadlift with Bands', '["BB"]', 'Intermediate', '["hamstrings","adductors","forearms","glutes","lower back","middle back","quadriceps","traps"]', 'Set up Sumo Deadlift with Bands with bands, barbell and choose a load or range you can control. Soften the knees, send the hips back until the posterior chain loads, and stand by driving the hips through. When the load leaves the hips and moves into the back, reduce the range or weight before the next rep.', 'Set the ribs down and brace first. Send the hips back into the load. Finish tall through the glutes.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Trail Running/Walking'), 'Trail Running/Walking', '["Bodyweight"]', 'Beginner', '["quadriceps","calves","glutes","hamstrings"]', 'Set up Trail Running/Walking with a stable bodyweight start position and choose a load or range you can control. Move at a sustainable pace while keeping each stride and change of direction deliberate. When posture or foot strike changes, slow the pace before continuing.', 'Set a repeatable starting position. Keep every stride smooth and quiet. Finish with the same posture you started with.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Triceps Pushdown - Rope Attachment'), 'Triceps Pushdown - Rope Attachment', '["Cable"]', 'Beginner', '["triceps"]', 'Set up Triceps Pushdown - Rope Attachment with cable machine and choose a load or range you can control. Keep the elbows organised while the forearms extend, then return into a controlled stretch. When the elbows chase the load, the extension has lost its line; shorten the range or load.', 'Aim the elbows through one steady line. Extend through the forearms. Control the return into the stretch.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Two-Arm Kettlebell Row'), 'Two-Arm Kettlebell Row', '["KB"]', 'Intermediate', '["middle back","biceps","lats"]', 'Set up Two-Arm Kettlebell Row with kettlebell and choose a load or range you can control. Reach into the start, then drive the elbows back until the upper back finishes the pull. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the torso before the pull. Lead with the elbows. Pause with the upper back engaged.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Underhand Cable Pulldowns'), 'Underhand Cable Pulldowns', '["Cable"]', 'Beginner', '["lats","biceps","middle back","shoulders"]', 'Set up Underhand Cable Pulldowns with cable machine and choose a load or range you can control. Set the shoulders before bending the elbows, then pull through the full available range. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the shoulders before bending the elbows. Pull through the elbows, not the hands. Reach long under control.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Upright Barbell Row'), 'Upright Barbell Row', '["BB"]', 'Beginner', '["shoulders","traps"]', 'Set up Upright Barbell Row with barbell and choose a load or range you can control. Set the shoulders before bending the elbows, then pull through the full available range. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the shoulders before bending the elbows. Pull through the elbows, not the hands. Reach long under control.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Upright Cable Row'), 'Upright Cable Row', '["Cable"]', 'Intermediate', '["traps","shoulders"]', 'Set up Upright Cable Row with cable machine and choose a load or range you can control. Set the shoulders before bending the elbows, then pull through the full available range. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the shoulders before bending the elbows. Pull through the elbows, not the hands. Reach long under control.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Upright Row - With Bands'), 'Upright Row - With Bands', '["Banded"]', 'Beginner', '["traps","shoulders"]', 'Set up Upright Row - With Bands with bands and choose a load or range you can control. Set the shoulders before bending the elbows, then pull through the full available range. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the shoulders before bending the elbows. Pull through the elbows, not the hands. Reach long under control.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'V-Bar Pullup'), 'V-Bar Pullup', '["Bodyweight"]', 'Beginner', '["lats","biceps","middle back","shoulders"]', 'Set up V-Bar Pullup with pullup bar and choose a load or range you can control. Set the shoulders before bending the elbows, then pull through the full available range. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the shoulders before bending the elbows. Pull through the elbows, not the hands. Reach long under control.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Wide Stance Barbell Squat'), 'Wide Stance Barbell Squat', '["BB"]', 'Intermediate', '["quadriceps","calves","glutes","hamstrings","lower back"]', 'Set up Wide Stance Barbell Squat with barbell, squat rack and choose a load or range you can control. Sit between the hips under control, keep pressure through the whole foot, and stand through the same path. When foot pressure rolls away from the working base, shorten the range and rebuild the next rep.', 'Brace before the descent. Keep pressure through the whole foot. Drive the floor away to stand.', ''),
  ((SELECT movement_id FROM movement WHERE name = 'Wide-Grip Lat Pulldown'), 'Wide-Grip Lat Pulldown', '["Cable"]', 'Beginner', '["lats","biceps","middle back","shoulders"]', 'Set up Wide-Grip Lat Pulldown with cable machine and choose a load or range you can control. Set the shoulders before bending the elbows, then pull through the full available range. When the hands finish before the elbows, the load is too ambitious; reset and own the pull.', 'Set the shoulders before bending the elbows. Pull through the elbows, not the hands. Reach long under control.', '')
ON CONFLICT(movement_id) DO UPDATE SET
  base_name = excluded.base_name,
  supported_prefixes = excluded.supported_prefixes,
  difficulty_rating = excluded.difficulty_rating,
  target_muscles = excluded.target_muscles,
  instructions = excluded.instructions,
  cues = excluded.cues,
  video_placeholder_uri = '';

INSERT INTO movement_coaching_intent (movement_id, coaching_intent) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Sumo Deadlift with Bands'), 'Train hamstrings with the specific loading and range of Sumo Deadlift with Bands while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Trail Running/Walking'), 'Build sustainable locomotion capacity with Trail Running/Walking while keeping posture and foot strike repeatable across the interval.'),
  ((SELECT movement_id FROM movement WHERE name = 'Triceps Pushdown - Rope Attachment'), 'Train triceps with the specific loading and range of Triceps Pushdown - Rope Attachment while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Two-Arm Kettlebell Row'), 'Train middle back with the specific loading and range of Two-Arm Kettlebell Row while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Underhand Cable Pulldowns'), 'Train lats with the specific loading and range of Underhand Cable Pulldowns while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Upright Barbell Row'), 'Train shoulders with the specific loading and range of Upright Barbell Row while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Upright Cable Row'), 'Train traps with the specific loading and range of Upright Cable Row while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Upright Row - With Bands'), 'Train traps with the specific loading and range of Upright Row - With Bands while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'V-Bar Pullup'), 'Train lats with the specific loading and range of V-Bar Pullup while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Wide Stance Barbell Squat'), 'Train quadriceps with the specific loading and range of Wide Stance Barbell Squat while keeping each rep technically honest.'),
  ((SELECT movement_id FROM movement WHERE name = 'Wide-Grip Lat Pulldown'), 'Train lats with the specific loading and range of Wide-Grip Lat Pulldown while keeping each rep technically honest.')
ON CONFLICT(movement_id) DO UPDATE SET coaching_intent = excluded.coaching_intent;

INSERT INTO movement_taxonomy (movement_id, category, implement, family) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Sumo Deadlift with Bands'), 'hinge', 'barbell', 'sumo_deadlift_with_bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Trail Running/Walking'), 'cardio', 'bodyweight', 'trail_running_walking'),
  ((SELECT movement_id FROM movement WHERE name = 'Triceps Pushdown - Rope Attachment'), 'accessory', 'cable', 'triceps_pushdown_rope_attachment'),
  ((SELECT movement_id FROM movement WHERE name = 'Two-Arm Kettlebell Row'), 'row', 'kettlebell', 'two_arm_kettlebell_row'),
  ((SELECT movement_id FROM movement WHERE name = 'Underhand Cable Pulldowns'), 'row', 'cable', 'underhand_cable_pulldowns'),
  ((SELECT movement_id FROM movement WHERE name = 'Upright Barbell Row'), 'row', 'barbell', 'upright_barbell_row'),
  ((SELECT movement_id FROM movement WHERE name = 'Upright Cable Row'), 'row', 'cable', 'upright_cable_row'),
  ((SELECT movement_id FROM movement WHERE name = 'Upright Row - With Bands'), 'row', 'band', 'upright_row_with_bands'),
  ((SELECT movement_id FROM movement WHERE name = 'V-Bar Pullup'), 'row', 'bodyweight', 'v_bar_pullup'),
  ((SELECT movement_id FROM movement WHERE name = 'Wide Stance Barbell Squat'), 'squat', 'barbell', 'wide_stance_barbell_squat'),
  ((SELECT movement_id FROM movement WHERE name = 'Wide-Grip Lat Pulldown'), 'row', 'cable', 'wide_grip_lat_pulldown')
ON CONFLICT(movement_id) DO UPDATE SET
  category = excluded.category, implement = excluded.implement, family = excluded.family;

INSERT OR IGNORE INTO movement_equipment (movement_id, item) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Sumo Deadlift with Bands'), 'bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Sumo Deadlift with Bands'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Triceps Pushdown - Rope Attachment'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Two-Arm Kettlebell Row'), 'kettlebell'),
  ((SELECT movement_id FROM movement WHERE name = 'Underhand Cable Pulldowns'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Upright Barbell Row'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Upright Cable Row'), 'cable_machine'),
  ((SELECT movement_id FROM movement WHERE name = 'Upright Row - With Bands'), 'bands'),
  ((SELECT movement_id FROM movement WHERE name = 'V-Bar Pullup'), 'pullup_bar'),
  ((SELECT movement_id FROM movement WHERE name = 'Wide Stance Barbell Squat'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Wide Stance Barbell Squat'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Wide-Grip Lat Pulldown'), 'cable_machine');

INSERT INTO movement_media (movement_id, asset_key, status, revision) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Sumo Deadlift with Bands'), 'movement/sumo-deadlift-with-bands/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Trail Running/Walking'), 'movement/trail-running-walking/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Triceps Pushdown - Rope Attachment'), 'movement/triceps-pushdown-rope-attachment/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Two-Arm Kettlebell Row'), 'movement/two-arm-kettlebell-row/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Underhand Cable Pulldowns'), 'movement/underhand-cable-pulldowns/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Upright Barbell Row'), 'movement/upright-barbell-row/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Upright Cable Row'), 'movement/upright-cable-row/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Upright Row - With Bands'), 'movement/upright-row-with-bands/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'V-Bar Pullup'), 'movement/v-bar-pullup/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Wide Stance Barbell Squat'), 'movement/wide-stance-barbell-squat/demo/v1', 'planned', 1),
  ((SELECT movement_id FROM movement WHERE name = 'Wide-Grip Lat Pulldown'), 'movement/wide-grip-lat-pulldown/demo/v1', 'planned', 1)
ON CONFLICT(movement_id) DO UPDATE SET
  asset_key = excluded.asset_key, status = 'planned', revision = 1;

INSERT INTO movement_logging_mode (movement_id, mode)
VALUES ((SELECT movement_id FROM movement WHERE name = 'Trail Running/Walking'), 'time')
ON CONFLICT(movement_id) DO UPDATE SET mode = 'time';

INSERT INTO movement_time_policy (movement_id, default_sets, target_seconds)
VALUES ((SELECT movement_id FROM movement WHERE name = 'Trail Running/Walking'), 1, 1200)
ON CONFLICT(movement_id) DO UPDATE SET default_sets = 1, target_seconds = 1200;
