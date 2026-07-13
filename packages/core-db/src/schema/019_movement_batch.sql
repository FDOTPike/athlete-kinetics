-- =============================================================================
-- 019_movement_batch.sql
-- Curation batch: 13 movements from staging (GENERATED — regenerate
-- only before this migration ships; scripts/generate-batch-migration.mjs).
-- Additive + idempotent (INSERT OR IGNORE), append-only chain, STRICT.
-- =============================================================================

INSERT OR IGNORE INTO movement (name, pattern, primary_muscle, is_compound) VALUES
  ('Band Good Morning', 'hinge', 'hamstrings', 1),
  ('Barbell Hack Squat', 'squat', 'quadriceps', 1),
  ('Cable Reverse Crunch', 'rotation', 'abdominals', 0),
  ('Close-Grip Dumbbell Press', 'push_h', 'triceps', 1),
  ('Cuban Press', 'push_v', 'shoulders', 1),
  ('Decline Dumbbell Bench Press', 'push_h', 'chest', 1),
  ('One Arm Lat Pulldown', 'pull_v', 'lats', 1),
  ('One-Arm Kettlebell Row', 'pull_h', 'middle back', 1),
  ('One-Arm Overhead Kettlebell Squat', 'squat', 'quadriceps', 1),
  ('Reverse Barbell Curl', 'isolation', 'biceps', 0),
  ('Reverse Grip Bent-Over Rows', 'pull_h', 'middle back', 1),
  ('V-Bar Pulldown', 'pull_v', 'lats', 1),
  ('Zottman Curl', 'isolation', 'biceps', 0);

INSERT OR IGNORE INTO movement_detail
  (movement_id, base_name, supported_prefixes, difficulty_rating, target_muscles,
   instructions, cues, video_placeholder_uri)
SELECT m.movement_id, e.column2, e.column3, e.column4, e.column5, e.column6, e.column7, e.column8
FROM (VALUES
  ('Band Good Morning', 'Band Good Morning', '["Banded"]', 'Beginner', '["hamstrings","glutes","lower back"]', 'Stand on the middle of a long band and loop it across the back of your shoulders, clear of the neck. Soften the knees, brace, and push the hips back until the hamstrings load while the band stays over mid-foot. Drive the floor away and squeeze the glutes to stand; shorten the depth the moment the back starts carrying more than the hamstrings.', 'Brace first, then send the hips back. Keep the band stacked over mid-foot. Finish tall through the glutes.', 'https://www.youtube.com/watch?v=CTRaCzE8pWU'),
  ('Barbell Hack Squat', 'Barbell Hack Squat', '["BB"]', 'Intermediate', '["quadriceps","calves","forearms","hamstrings"]', 'Set a bar on the floor behind your calves, stand about hip width, then squat down and take a shoulder-width grip with long arms. Brace the trunk and drive the floor away, letting the bar skim up behind the legs as the hips and knees straighten together. Lower along the same close path; when the grip or torso position breaks before the legs tire, that is the load limit for the day.', 'Set the chest proud and the arms long. Push the floor away. Keep the bar close behind the legs.', 'https://www.youtube.com/watch?v=EdtaJRBqwes'),
  ('Cable Reverse Crunch', 'Cable Reverse Crunch', '["Cable"]', 'Beginner', '["abdominals"]', 'Attach both ankles to a low cable, lie facing away from the stack, and set the hips and knees near 90 degrees with the shoulders heavy on the floor. Tuck the pelvis first, then curl the knees toward the ribs until the tailbone lifts without throwing the legs. Set the hips down slowly while keeping cable tension; if the thighs swing but the pelvis stays put, lower the stack and earn the curl.', 'Start with the pelvis tucked. Curl the knees toward the ribs. Set the hips down on a slow count.', 'https://www.youtube.com/watch?v=b8oUb_6POhQ'),
  ('Close-Grip Dumbbell Press', 'Crush Press', '["DB"]', 'Beginner', '["triceps","chest","shoulders"]', 'Lie on a flat bench with two dumbbells pressed together over the middle of the chest, wrists stacked and feet planted. Keep crushing the bells together as you lower them softly to the chest with the elbows close to the ribs. Press the pair back up as one unit; if the bells separate, the close-grip tension disappeared before the rep was finished.', 'Crush the bells together. Stack the wrists over the elbows. Touch softly, then press as one unit.', 'https://www.youtube.com/watch?v=lNPH4gf4g08'),
  ('Cuban Press', 'Cuban Press', '["DB"]', 'Intermediate', '["shoulders","traps"]', 'Stand with very light dumbbells and raise the elbows wide to shoulder height, forearms hanging below them. Keep the upper arms fixed while rotating the forearms until the wrists stack directly over the elbows, then press to a tall overhead finish. Reverse every stage under control; if the hips have to help, the bells are too heavy for the rotation you are training.', 'Hold the elbows high and wide. Rotate around quiet upper arms. Reverse the path smoothly.', 'https://www.youtube.com/watch?v=IyvB-mdKIv4'),
  ('Decline Dumbbell Bench Press', 'Decline Dumbbell Bench Press', '["DB"]', 'Intermediate', '["chest","shoulders","triceps"]', 'Secure the legs in a decline bench, sit with the dumbbells on the thighs, then lie back and bring the bells to the chest before pressing them into position. Lower toward the lower chest with the forearms vertical and the shoulder blades pinned into the pad. Press up and slightly inward; when the bells are too heavy to mount cleanly, the setup has already chosen a lighter working load for you.', 'Pin the shoulder blades into the pad. Stack the wrists over the elbows. Press up and slightly in.', 'https://www.youtube.com/watch?v=Pf1nDoqx_1A'),
  ('One Arm Lat Pulldown', 'Single-Arm Lat Pulldown', '["Cable"]', 'Beginner', '["lats","biceps","middle back"]', 'Sit or kneel square to a high cable, take one handle, and reach overhead until the shoulder blade can travel without the stack resting. Pull the elbow down toward the hip and pause when the upper arm reaches the ribs, keeping the torso quiet. Return to the full reach slowly; if the hand tires before the lat, soften the grip and let the elbow lead the next rep.', 'Reach long at the top. Drive the elbow toward the hip. Keep the torso square and quiet.', 'https://www.youtube.com/watch?v=eM162KNncD8'),
  ('One-Arm Kettlebell Row', 'One-Arm Kettlebell Row', '["KB"]', 'Intermediate', '["middle back","biceps","lats"]', 'Take a staggered stance, hinge until the torso is long and stable, and let the kettlebell hang beneath one shoulder. Row the bell toward the back pocket by driving the elbow past the ribs while the hips stay square to the floor. Lower until the shoulder blade reaches naturally; if the torso opens to finish the pull, the bell is heavier than the row you intended.', 'Set a long, square torso. Drive the elbow toward the back pocket. Reach the shoulder blade at the bottom.', 'https://www.youtube.com/watch?v=bZ4h1Bqw-to'),
  ('One-Arm Overhead Kettlebell Squat', 'Single-Arm Overhead Squat', '["KB"]', 'Advanced', '["quadriceps","calves","glutes","hamstrings","shoulders"]', 'Clean and press one kettlebell overhead, lock the elbow, and use the free arm forward as a counterbalance. Root the whole foot and sit between the hips while keeping the bell stacked over the shoulder and the eyes forward. Pause at the deepest owned position, then drive to standing; the rep ends where the bell drifts or the ribs flare, not where the hips wish to go.', 'Punch the bell toward the ceiling. Sit between the hips on a rooted foot. Drive up under the bell.', 'https://www.youtube.com/watch?v=tpPKyhvf0IA'),
  ('Reverse Barbell Curl', 'Reverse Barbell Curl', '["BB"]', 'Beginner', '["biceps","forearms"]', 'Stand with a light bar in an overhand shoulder-width grip, wrists straight and elbows resting beside the ribs. Curl by closing the elbows until the forearms are near vertical, then hold the top without letting the shoulders climb. Lower to the natural long-arm rest; when the wrists fold or the shoulders rise, the load has moved ahead of the forearms.', 'Keep the knuckles long and the wrists stacked. Close the elbows around the bar. Lower all the way under control.', 'https://www.youtube.com/watch?v=nRgxYX2Ve9w'),
  ('Reverse Grip Bent-Over Rows', 'Reverse-Grip Bent-Over Row', '["BB"]', 'Intermediate', '["middle back","biceps","lats","shoulders"]', 'Take an underhand grip just outside the thighs, soften the knees, and hinge until the bar hangs below them with the torso braced. Pull the elbows back and row the bar toward the lower ribs, holding the top long enough to feel the shoulder blades finish. Lower to long arms without changing the hinge; if the torso rises on every pull, the bar is borrowing range from the hips.', 'Brace the hinge before the pull. Drive the elbows behind you. Touch the lower ribs and own the way down.', 'https://www.youtube.com/watch?v=3gdGSSgDby8'),
  ('V-Bar Pulldown', 'V-Bar Pulldown', '["Cable"]', 'Intermediate', '["lats","biceps","middle back","shoulders"]', 'Lock the thighs under the pad, take the neutral V-bar, and lean back only enough to keep the chest tall beneath the cable. Pull the elbows down and back until the handle reaches the upper chest, then pause without turning the rep into a row. Return to a full overhead reach without letting the stack settle; if the biceps burn first, soften the hands and lead harder with the elbows.', 'Show the chest to the handle. Drive the elbows down and back. Reach fully at the top.', 'https://www.youtube.com/watch?v=LJ5ebC1pWkA'),
  ('Zottman Curl', 'Zottman Curl', '["DB"]', 'Intermediate', '["biceps","forearms"]', 'Stand with dumbbells at the sides, curl with the palms turning up, and keep the upper arms quiet beside the ribs. At the top, rotate to palms-down while the elbows stay closed, then lower through the overhand grip. Turn back to neutral only at the bottom; this is lighter than the ego wants because the slow overhand descent is the part you came for.', 'Curl palms-up with quiet elbows. Turn the knuckles over at the top. Lower slowly through the overhand grip.', 'https://www.youtube.com/watch?v=D7bMA4WEKMI')) AS e
JOIN movement m ON m.name = e.column1;

INSERT OR IGNORE INTO movement_taxonomy (movement_id, category, implement, family)
SELECT m.movement_id, e.column2, e.column3, e.column4
FROM (VALUES
  ('Band Good Morning', 'hinge', 'band', 'band_good_morning'),
  ('Barbell Hack Squat', 'squat', 'barbell', 'barbell_hack_squat'),
  ('Cable Reverse Crunch', 'core', 'cable', 'cable_reverse_crunch'),
  ('Close-Grip Dumbbell Press', 'push', 'dumbbell', 'crush_press'),
  ('Cuban Press', 'push', 'dumbbell', 'cuban_press'),
  ('Decline Dumbbell Bench Press', 'push', 'dumbbell', 'decline_dumbbell_bench_press'),
  ('One Arm Lat Pulldown', 'unilateral', 'cable', 'single_arm_lat_pulldown'),
  ('One-Arm Kettlebell Row', 'unilateral', 'kettlebell', 'one_arm_kettlebell_row'),
  ('One-Arm Overhead Kettlebell Squat', 'unilateral', 'kettlebell', 'single_arm_overhead_squat'),
  ('Reverse Barbell Curl', 'accessory', 'barbell', 'reverse_barbell_curl'),
  ('Reverse Grip Bent-Over Rows', 'row', 'barbell', 'reverse_grip_bent_over_row'),
  ('V-Bar Pulldown', 'row', 'cable', 'v_bar_pulldown'),
  ('Zottman Curl', 'accessory', 'dumbbell', 'zottman_curl')) AS e
JOIN movement m ON m.name = e.column1;

INSERT OR IGNORE INTO movement_equipment (movement_id, item)
SELECT m.movement_id, e.column2
FROM (VALUES
  ('Band Good Morning', 'bands'),
  ('Barbell Hack Squat', 'barbell'),
  ('Cable Reverse Crunch', 'cable_machine'),
  ('Close-Grip Dumbbell Press', 'dumbbells'),
  ('Close-Grip Dumbbell Press', 'bench'),
  ('Cuban Press', 'dumbbells'),
  ('Decline Dumbbell Bench Press', 'dumbbells'),
  ('Decline Dumbbell Bench Press', 'bench'),
  ('One Arm Lat Pulldown', 'cable_machine'),
  ('One-Arm Kettlebell Row', 'kettlebell'),
  ('One-Arm Overhead Kettlebell Squat', 'kettlebell'),
  ('Reverse Barbell Curl', 'barbell'),
  ('Reverse Grip Bent-Over Rows', 'barbell'),
  ('V-Bar Pulldown', 'cable_machine'),
  ('Zottman Curl', 'dumbbells')) AS e
JOIN movement m ON m.name = e.column1;
