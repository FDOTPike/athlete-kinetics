-- =============================================================================
-- 020_movement_batch.sql
-- Curation batch: 15 movements from staging (GENERATED — regenerate
-- only before this migration ships; scripts/generate-batch-migration.mjs).
-- Additive + idempotent (INSERT OR IGNORE), append-only chain, STRICT.
-- =============================================================================

INSERT OR IGNORE INTO movement (name, pattern, primary_muscle, is_compound) VALUES
  ('Barbell Rear Delt Row', 'pull_h', 'shoulders', 1),
  ('Barbell Seated Calf Raise', 'isolation', 'calves', 0),
  ('Bent Press', 'push_v', 'abdominals', 1),
  ('Cable Deadlifts', 'hinge', 'quadriceps', 1),
  ('Cable Hammer Curls - Rope Attachment', 'isolation', 'biceps', 0),
  ('Cable Internal Rotation', 'isolation', 'shoulders', 1),
  ('Cable Rope Overhead Triceps Extension', 'isolation', 'triceps', 0),
  ('Cable Rope Rear-Delt Rows', 'pull_h', 'shoulders', 1),
  ('Calf Raises - With Bands', 'isolation', 'calves', 0),
  ('Decline Crunch', 'rotation', 'abdominals', 0),
  ('Jefferson Squats', 'squat', 'quadriceps', 1),
  ('Kettlebell Dead Clean', 'hinge', 'hamstrings', 1),
  ('Kneeling Single-Arm High Pulley Row', 'pull_h', 'lats', 1),
  ('Narrow Stance Squats', 'squat', 'quadriceps', 1),
  ('Tuck Crunch', 'rotation', 'abdominals', 0);

INSERT OR IGNORE INTO movement_detail
  (movement_id, base_name, supported_prefixes, difficulty_rating, target_muscles,
   instructions, cues, video_placeholder_uri)
SELECT m.movement_id, e.column2, e.column3, e.column4, e.column5, e.column6, e.column7, e.column8
FROM (VALUES
  ('Barbell Rear Delt Row', 'Rear-Delt Row', '["BB"]', 'Beginner', '["shoulders","biceps","lats","middle back"]', 'Take a wide overhand grip, soften the knees, and hinge until the bar hangs beneath a braced torso. Drive the elbows wide and row the bar toward the upper chest, holding long enough to feel the rear shoulders finish. Lower to long arms without rising; if the bar heads toward the stomach, the elbows have tucked and the movement has become a lat row.', 'Brace the hinge before the pull. Drive the elbows wide. Touch the upper chest and lower under control.', 'https://www.youtube.com/watch?v=gvBbvB9NKrk'),
  ('Barbell Seated Calf Raise', 'Seated Calf Raise', '["BB"]', 'Beginner', '["calves"]', 'Sit tall on a flat bench with the balls of both feet on a low block and settle a padded bar across the thighs just above the knees. Let the heels drop into a controlled stretch, then drive through the big-toe joints and rise as high as the ankles allow. Hold the top before lowering; if the bar starts bouncing on the thighs, the calves stopped owning the rep.', 'Root the balls of the feet. Rise tall through the ankles. Hold the top, then lower slowly.', 'https://www.youtube.com/watch?v=abDaq2ly34Q'),
  ('Bent Press', 'Bent Press', '["KB"]', 'Advanced', '["abdominals","glutes","hamstrings","lower back","quadriceps","shoulders","triceps"]', 'Clean one kettlebell to the shoulder, set the feet wider than the hips, and turn them slightly away from the loaded side. Send the hips away and wedge the torso under the bell, straightening the arm as the body descends while the eyes stay on the handle. Once the elbow is locked, drive the feet through the floor to stand tall; if the bell travels sideways instead of staying over its base, the range is too deep or the setup was rushed.', 'Keep the bell stacked over its base. Send the hips away and wedge under the handle. Stand tall beneath a locked arm.', 'https://www.youtube.com/watch?v=cFmSd61PPTI'),
  ('Cable Deadlifts', 'Cable Deadlift', '["Cable"]', 'Beginner', '["quadriceps","forearms","glutes","hamstrings","lower back"]', 'Set two cable handles at the lowest position, stand centred between them, and sit the hips back to take the handles with long arms. Brace, push the floor away, and extend the hips and knees together until the handles finish beside the thighs. Send the hips back before bending the knees to return; if the stack pulls the shoulders forward at the bottom, the load or range is too large.', 'Brace before the cables leave the stack. Push the floor away through the whole foot. Send the hips back to begin the return.', 'https://www.youtube.com/watch?v=_4U_5JO3oiE'),
  ('Cable Hammer Curls - Rope Attachment', 'Hammer Curl', '["Cable"]', 'Beginner', '["biceps"]', 'Attach a rope to a low cable, stand tall with a neutral grip, and settle the elbows beside the ribs. Close the elbows to curl the rope toward the shoulders, separating the ends slightly while the upper arms stay quiet. Return to the natural long-arm rest; if the shoulders roll forward to finish the curl, the stack is ahead of the biceps.', 'Stand tall over quiet elbows. Curl the rope ends toward the shoulders. Reach the natural rest under control.', 'https://www.youtube.com/watch?v=7Tw9fpb5mOo'),
  ('Cable Internal Rotation', 'Internal Rotation', '["Cable"]', 'Beginner', '["shoulders"]', 'Set a single cable handle around elbow height and stand side-on with the working elbow bent to 90 degrees and resting lightly against the ribs. Rotate the forearm across the torso while the upper arm stays quiet, then pause when the hand reaches the centreline. Return until the forearm points toward the cable; if the elbow floats away from the ribs, the chosen range has outrun the shoulder.', 'Stack the wrist in front of the elbow. Rotate around a quiet upper arm. Return smoothly to the cable line.', 'https://www.youtube.com/watch?v=YOc7DYcASNk'),
  ('Cable Rope Overhead Triceps Extension', 'Overhead Triceps Extension', '["Cable"]', 'Beginner', '["triceps"]', 'Attach a rope to a low cable, face away in a split stance, and bring the rope overhead with the elbows beside the temples. Keep the upper arms quiet as the hands travel behind the head into a long triceps stretch. Extend the elbows and separate the rope at the top; if the torso loses its stack before the arms straighten, the cable is too heavy.', 'Plant the split stance. Aim the elbows forward beside the temples. Reach the knuckles long at the top.', 'https://www.youtube.com/watch?v=t7m1RyOZHFQ'),
  ('Cable Rope Rear-Delt Rows', 'Rear-Delt Row', '["Cable"]', 'Beginner', '["shoulders","biceps","middle back"]', 'Sit tall at a low cable with a rope in both hands and reach forward at shoulder height until the shoulder blades can travel. Pull the rope toward the upper chest by driving the elbows wide, separating the ends as the rear shoulders finish. Return to the full reach slowly; if the wrists beat the elbows to the finish, the arms have taken the job from the rear delts.', 'Reach the shoulder blades forward. Drive the elbows wide toward the back wall. Separate the rope at the upper chest.', 'https://www.youtube.com/watch?v=QPzdXm3osCk'),
  ('Calf Raises - With Bands', 'Standing Calf Raise', '["Banded"]', 'Beginner', '["calves"]', 'Stand on the middle of a long band with the handles held at shoulder height and the feet set about hip width. Root the forefeet and rise as high as the ankles allow while the hands stay quiet beside the shoulders. Pause, then lower into an owned stretch; if the hands bob to manufacture height, the calves have stopped driving the rep.', 'Root the forefeet evenly. Rise tall through the ankles. Own the top before a slow return.', 'https://www.youtube.com/watch?v=a2xjbhP4MkY'),
  ('Decline Crunch', 'Decline Crunch', '["Bodyweight"]', 'Intermediate', '["abdominals"]', 'Secure the legs on a decline bench and lie back with the fingertips resting lightly beside the temples. Press the lower back into the pad and curl the shoulder blades up, bringing the ribs toward the pelvis without sitting tall. Hold the shortened position, then unroll slowly; if the feet do the work and the torso shoots upright, the angle or range is too ambitious.', 'Anchor the lower back to the pad. Curl the ribs toward the pelvis. Hold the top before you unroll.', 'https://www.youtube.com/watch?v=FRzQXeN1hro'),
  ('Jefferson Squats', 'Jefferson Squat', '["BB"]', 'Intermediate', '["quadriceps","calves","glutes","hamstrings","lower back","traps"]', 'Straddle the bar with the feet angled comfortably, then squat down and take one hand in front of the body and one behind at equal distances. Brace a tall torso and push both feet through the floor to stand with the bar travelling between the legs. Lower along the same centred path and switch orientation between sets; if the bar twists away from the midline, reset the grip and stance before adding load.', 'Centre the torso over the bar. Push both feet through the floor. Keep the bar travelling straight between the legs.', 'https://www.youtube.com/watch?v=VzQhgHPoi4s'),
  ('Kettlebell Dead Clean', 'Dead Clean', '["KB"]', 'Intermediate', '["hamstrings","calves","glutes","lower back","quadriceps","traps"]', 'Set one kettlebell between the feet, hinge back, and take the handle with the shoulder packed over the bell. Drive the floor away and extend the hips to guide the bell close into the rack rather than looping it around the wrist. Reverse the path to the floor; if the bell slaps the forearm, the hand travelled around the bell instead of the bell rolling around the hand.', 'Drive the floor and finish the hips. Zip the bell close to the body. Receive it softly with the elbow tucked.', 'https://www.youtube.com/watch?v=6Hjuscd4ab4'),
  ('Kneeling Single-Arm High Pulley Row', 'Half-Kneeling Single-Arm Row', '["Cable"]', 'Beginner', '["lats","biceps","middle back"]', 'Half-kneel facing a high cable, take one handle, and reach the working arm long while the hips and shoulders stay square. Pull the elbow down and back toward the ribs, allowing the palm to turn toward the body as the shoulder blade finishes. Return to the full reach slowly; if the hand reaches the ribs before the elbow travels, soften the grip and let the elbow lead.', 'Reach long from a square half-kneeling base. Drive the elbow down toward the ribs. Let the shoulder blade finish the pull.', 'https://www.youtube.com/watch?v=O3D5-yTGH7Y'),
  ('Narrow Stance Squats', 'Narrow-Stance Squat', '["BB"]', 'Intermediate', '["quadriceps","calves","glutes","hamstrings","lower back"]', 'Set the bar across the upper back and step into a stance narrower than shoulder width with the toes turned slightly out. Brace and let the knees travel forward as the hips sit down, keeping pressure across the whole foot to the deepest position you own. Push the floor away to stand; if the heels lift or the knees lose their line, the stance is narrower than your available range.', 'Root the whole foot. Send the knees forward over the toes. Drive straight up under the bar.', 'https://www.youtube.com/watch?v=9Ulb6gOqhA4'),
  ('Tuck Crunch', 'Tuck Crunch', '["Bodyweight"]', 'Beginner', '["abdominals"]', 'Lie on your back with the hips and knees bent and the arms reaching toward the feet. Bring the ribs and pelvis toward one another, curling the shoulders up as the knees travel slightly toward the chest. Pause with the abdominals shortened, then lower both ends slowly; if the legs swing ahead of the curl, the range is longer than you own.', 'Draw the ribs and pelvis together. Reach past the hips at the top. Lower both ends on the same slow count.', 'https://www.youtube.com/watch?v=NuEIjBPATwE')) AS e
JOIN movement m ON m.name = e.column1;

INSERT OR IGNORE INTO movement_taxonomy (movement_id, category, implement, family)
SELECT m.movement_id, e.column2, e.column3, e.column4
FROM (VALUES
  ('Barbell Rear Delt Row', 'row', 'barbell', 'rear_delt_row'),
  ('Barbell Seated Calf Raise', 'accessory', 'barbell', 'seated_calf_raise'),
  ('Bent Press', 'push', 'kettlebell', 'bent_press'),
  ('Cable Deadlifts', 'hinge', 'cable', 'cable_deadlift'),
  ('Cable Hammer Curls - Rope Attachment', 'accessory', 'cable', 'hammer_curl'),
  ('Cable Internal Rotation', 'accessory', 'cable', 'internal_rotation'),
  ('Cable Rope Overhead Triceps Extension', 'push', 'cable', 'overhead_triceps_extension'),
  ('Cable Rope Rear-Delt Rows', 'row', 'cable', 'rear_delt_row'),
  ('Calf Raises - With Bands', 'accessory', 'band', 'standing_calf_raise'),
  ('Decline Crunch', 'core', 'bodyweight', 'decline_crunch'),
  ('Jefferson Squats', 'squat', 'barbell', 'jefferson_squat'),
  ('Kettlebell Dead Clean', 'hinge', 'kettlebell', 'dead_clean'),
  ('Kneeling Single-Arm High Pulley Row', 'unilateral', 'cable', 'half_kneeling_single_arm_row'),
  ('Narrow Stance Squats', 'squat', 'barbell', 'narrow_stance_squat'),
  ('Tuck Crunch', 'core', 'bodyweight', 'tuck_crunch')) AS e
JOIN movement m ON m.name = e.column1;

INSERT OR IGNORE INTO movement_equipment (movement_id, item)
SELECT m.movement_id, e.column2
FROM (VALUES
  ('Barbell Rear Delt Row', 'barbell'),
  ('Barbell Seated Calf Raise', 'barbell'),
  ('Barbell Seated Calf Raise', 'bench'),
  ('Bent Press', 'kettlebell'),
  ('Cable Deadlifts', 'cable_machine'),
  ('Cable Hammer Curls - Rope Attachment', 'cable_machine'),
  ('Cable Internal Rotation', 'cable_machine'),
  ('Cable Rope Overhead Triceps Extension', 'cable_machine'),
  ('Cable Rope Rear-Delt Rows', 'cable_machine'),
  ('Calf Raises - With Bands', 'bands'),
  ('Decline Crunch', 'bench'),
  ('Jefferson Squats', 'barbell'),
  ('Kettlebell Dead Clean', 'kettlebell'),
  ('Kneeling Single-Arm High Pulley Row', 'cable_machine'),
  ('Narrow Stance Squats', 'barbell'),
  ('Narrow Stance Squats', 'squat_rack')) AS e
JOIN movement m ON m.name = e.column1;
