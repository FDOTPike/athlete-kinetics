-- =============================================================================
-- 017_movement_batch.sql
-- Curation batch: 15 movements from staging (GENERATED — regenerate
-- only before this migration ships; scripts/generate-batch-migration.mjs).
-- Additive + idempotent (INSERT OR IGNORE), append-only chain, STRICT.
-- =============================================================================

INSERT OR IGNORE INTO movement (name, pattern, primary_muscle, is_compound) VALUES
  ('Barbell Shrug', 'isolation', 'traps', 0),
  ('Cable Chest Press', 'push_h', 'chest', 1),
  ('Cable Glute Kickback', 'isolation', 'glutes', 0),
  ('Double Kettlebell Push Press', 'push_v', 'shoulders', 1),
  ('Dumbbell Floor Press', 'push_h', 'triceps', 1),
  ('Dumbbell Front Raise', 'isolation', 'shoulders', 0),
  ('Dumbbell Romanian Deadlift', 'hinge', 'hamstrings', 1),
  ('Floor Back Extension', 'hinge', 'lower back', 1),
  ('Incline Push-Up', 'push_h', 'chest', 1),
  ('Lying Dumbbell Triceps Extension', 'isolation', 'triceps', 0),
  ('Preacher Curl', 'isolation', 'biceps', 0),
  ('Renegade Row', 'pull_h', 'middle back', 1),
  ('Single-Leg Romanian Deadlift', 'hinge', 'hamstrings', 1),
  ('Sit-Up', 'rotation', 'abdominals', 0),
  ('Standing Barbell Calf Raise', 'isolation', 'calves', 0);

INSERT OR IGNORE INTO movement_detail
  (movement_id, base_name, supported_prefixes, difficulty_rating, target_muscles,
   instructions, cues, video_placeholder_uri)
SELECT m.movement_id, e.column2, e.column3, e.column4, e.column5, e.column6, e.column7, e.column8
FROM (VALUES
  ('Barbell Shrug', 'Shrug', '["BB"]', 'Beginner', '["traps"]', 'Hold a barbell in front of your thighs with straight arms, at your natural standing width. With intention, pull your shoulder blades up and back behind your ears as high as the traps will take them. Hold the top for a full second, then lower until the weight stretches the traps. The bar lets you load heavier than dumbbells — earn it with the same strict path.', 'Up and back behind the ears, with intention. Own a full second at the top. Arms stay ropes — traps lift, hands just hold.', 'https://www.youtube.com/watch?v=X26Ji1j9LWA'),
  ('Cable Chest Press', 'Chest Press', '["Cable"]', 'Intermediate', '["chest","shoulders","triceps"]', 'Set two handles at chest height, face away, and take a staggered stance. Press both handles forward until your arms are long, letting them drift together at the end. Return under control — the cable pulls backward the entire rep, so the squeeze at lockout is real work here.', 'Brace into the staggered stance. Press to a full reach, hands finishing together. Ride the cables back slow.', 'https://www.youtube.com/watch?v=fOHouR0t9Cw'),
  ('Cable Glute Kickback', 'Glute Kickback', '["Cable"]', 'Beginner', '["glutes","hamstrings"]', 'Strap a low cable to one ankle, face the stack, and hold it for balance with a slight forward lean. Drive the strapped leg straight back and slightly up by squeezing the glute, then return under control. The range is shorter than people want it to be — where the lower back starts arching is where the glute stopped working.', 'Push the heel back, squeeze at the end. Torso still, hips level. Short honest range beats a high arched kick.', 'https://www.youtube.com/watch?v=bVrmtCI00Ys'),
  ('Double Kettlebell Push Press', 'Push Press', '["KB"]', 'Intermediate', '["shoulders","calves","quadriceps","triceps"]', 'Clean two kettlebells to the rack position. Dip a few inches by bending the knees with a vertical torso, then drive the legs hard and let that force carry both bells to locked-out arms overhead. Lower back to the rack, breathe, repeat. The legs start the press and the arms finish it — a shallow, snappy dip beats a deep slow one every time.', 'Dip shallow, drive fast. Legs throw it, arms catch the lockout. Rack, reset, breathe between reps.', 'https://www.youtube.com/watch?v=W9NlTHkK1iU'),
  ('Dumbbell Floor Press', 'Floor Press', '["DB"]', 'Beginner', '["triceps","chest","shoulders"]', 'Lie on the floor with dumbbells pressed over your chest, knees bent, feet flat. Lower until your upper arms rest lightly on the floor, pause a beat, then press back up. The floor caps the range where shoulders get cranky, and it needs no bench — a natural first press for home training.', 'Elbows about 45 degrees, touch down soft. Pause on the floor, then drive. Wrists stacked over elbows.', 'https://www.youtube.com/watch?v=uUGDRwge4F8'),
  ('Dumbbell Front Raise', 'Front Raise', '["DB"]', 'Beginner', '["shoulders"]', 'Stand holding dumbbells in front of your thighs, palms facing back. Raise one or both arms straight ahead to shoulder height with a soft elbow, then lower on a slow count. Front delts already work in every press you do — this stays light, strict, and honest, or it is the lower back doing the raising.', 'Lift to shoulder height, hands soft. Torso a pillar — the delts raise, the body stays. Slower down than up.', 'https://www.youtube.com/watch?v=zkP0MsTcIVU'),
  ('Dumbbell Romanian Deadlift', 'Romanian Deadlift', '["DB"]', 'Beginner', '["hamstrings","glutes","lower back"]', 'Stand with dumbbells resting on the front of your thighs. Push your hips straight back and let the dumbbells slide down your legs, knees softly bent, until the hamstrings tell you to stop. Drive the hips forward to stand tall. The dumbbells hug your legs the whole way — daylight between them and you means the load has wandered onto your back.', 'Hips back, dumbbells glued to the legs. Flat back, long spine. Stand up by squeezing the glutes through.', 'https://www.youtube.com/watch?v=aa57T45iFSE'),
  ('Floor Back Extension', 'Back Extension', '["Bodyweight"]', 'Beginner', '["lower back","glutes","hamstrings"]', 'Lie face-down with your arms reaching ahead. Lift your chest, arms, and legs a few inches off the floor by squeezing the glutes and upper back, hold a beat, then lower with control. Height is not the goal — a long body and a strong squeeze are. Reach LONG through fingers and toes rather than cranking upward.', 'Reach long, then lift — length before height. Glutes squeeze first. Hold the top for a slow beat.', 'https://www.youtube.com/watch?v=z6PJMT2y8GQ'),
  ('Incline Push-Up', 'Push-Up', '["Bodyweight"]', 'Beginner', '["chest","shoulders","triceps"]', 'Place your hands on a bench or sturdy surface around hip height and walk your feet back into one rigid line. Lower your chest to the edge, then press away to long arms. The higher the hands, the easier the rep — walk your hands lower over the weeks and the floor push-up arrives on its own.', 'One rigid line, glutes switched on. Chest travels to the edge, whole body together. Lower the surface as reps get strict.', 'https://www.youtube.com/watch?v=0JUrOH--Kdk'),
  ('Lying Dumbbell Triceps Extension', 'Triceps Extension', '["DB"]', 'Intermediate', '["triceps","chest","shoulders"]', 'Lie on a bench with dumbbells pressed over your chest, palms facing each other. Keeping your upper arms still and angled slightly back over your head, bend the elbows and lower the dumbbells beside your ears. Press back to long arms along the same path. Upper arms are the hinge pin — they point at one spot on the ceiling for the whole set.', 'Upper arms frozen, angled just past vertical. Lower to the ears, deep and controlled. Elbows point at the ceiling, always.', 'https://www.youtube.com/watch?v=8ncEJDm7Cig'),
  ('Preacher Curl', 'Biceps Curl', '["BB"]', 'Beginner', '["biceps"]', 'Set your upper arms flat on the preacher pad, chest against it, bar in an underhand grip. Curl to shoulder height, then lower slower than you lifted until your arms reach their natural long position on the pad. The pad removes every cheat you own — expect to lift less than your standing curl, and let that be information.', 'Upper arms welded to the pad. Lower on a three-count into the long stretch. Settle at the bottom, no bounce out of it.', 'https://www.youtube.com/watch?v=BPmUhDtdQfw'),
  ('Renegade Row', 'Renegade Row', '["DB"]', 'Advanced', '["middle back","abdominals","biceps","chest","lats","triceps"]', 'Set up in a push-up plank with a hand on each dumbbell, feet wider than usual. Row one dumbbell to your ribs while the rest of you stays a statue, then place it down and row the other side. The row is the easy part — the work is refusing to let the hips twist.', 'Hips square to the floor — a statue with one moving arm. Feet wide for a stable base. Pull with the elbow, quiet everywhere else.', 'https://www.youtube.com/watch?v=4qEIChzM4ZA'),
  ('Single-Leg Romanian Deadlift', 'Single-Leg Romanian Deadlift', '["KB"]', 'Intermediate', '["hamstrings","glutes","lower back"]', 'Hold a kettlebell in one hand and stand on the opposite leg. Hinge forward, letting the free leg travel straight back as a counterweight, until your torso and back leg are near parallel with the floor. Drive the hips through to stand tall. Wobbling is part of the exercise — every save is your ankle and hip learning their job.', 'Hips stay square, back leg reaches long. Bell hangs plumb under the shoulder. Slow beats far — shorten the hinge before you lose it.', 'https://www.youtube.com/watch?v=Nenu2LI9_dw'),
  ('Sit-Up', 'Sit-Up', '["Bodyweight"]', 'Beginner', '["abdominals"]', 'Lie on your back with knees bent, feet flat, hands crossed on your chest or lightly at your temples. Curl your torso up one segment at a time until your chest meets your thighs, then roll back down the same way. The curl is the exercise — a flat-backed lever heave onto the hip flexors is a different movement wearing the same name.', 'Peel up one vertebra at a time. Exhale on the way up. Roll down as slowly as you rose.', 'https://www.youtube.com/watch?v=pCX65Mtc_Kk'),
  ('Standing Barbell Calf Raise', 'Calf Raise', '["BB"]', 'Intermediate', '["calves"]', 'Set a bar across your upper back as for a squat, balls of your feet on a plate or block, heels hanging free. Lower your heels to a deep stretch, pause, then rise as high onto your toes as balance allows. The bar loads the calves harder than dumbbells ever will — trade some range for load only after the stretch and pause are non-negotiable habits.', 'Deep stretch, full pause at the bottom. Drive up over the big toe. Tall body, bar quiet on the back.', 'https://www.youtube.com/watch?v=3UWi44yN-wM')) AS e
JOIN movement m ON m.name = e.column1;

INSERT OR IGNORE INTO movement_taxonomy (movement_id, category, implement, family)
SELECT m.movement_id, e.column2, e.column3, e.column4
FROM (VALUES
  ('Barbell Shrug', 'row', 'barbell', 'shrug'),
  ('Cable Chest Press', 'push', 'cable', 'chest_press'),
  ('Cable Glute Kickback', 'unilateral', 'cable', 'glute_kickback'),
  ('Double Kettlebell Push Press', 'push', 'kettlebell', 'push_press'),
  ('Dumbbell Floor Press', 'push', 'dumbbell', 'floor_press'),
  ('Dumbbell Front Raise', 'accessory', 'dumbbell', 'front_raise'),
  ('Dumbbell Romanian Deadlift', 'hinge', 'dumbbell', 'romanian_deadlift'),
  ('Floor Back Extension', 'hinge', 'bodyweight', 'back_extension'),
  ('Incline Push-Up', 'push', 'bodyweight', 'push_up'),
  ('Lying Dumbbell Triceps Extension', 'accessory', 'dumbbell', 'triceps_extension'),
  ('Preacher Curl', 'accessory', 'barbell', 'biceps_curl'),
  ('Renegade Row', 'row', 'dumbbell', 'renegade_row'),
  ('Single-Leg Romanian Deadlift', 'unilateral', 'kettlebell', 'single_leg_romanian_deadlift'),
  ('Sit-Up', 'core', 'bodyweight', 'sit_up'),
  ('Standing Barbell Calf Raise', 'accessory', 'barbell', 'calf_raise')) AS e
JOIN movement m ON m.name = e.column1;

INSERT OR IGNORE INTO movement_equipment (movement_id, item)
SELECT m.movement_id, e.column2
FROM (VALUES
  ('Barbell Shrug', 'barbell'),
  ('Cable Chest Press', 'cable_machine'),
  ('Cable Glute Kickback', 'cable_machine'),
  ('Double Kettlebell Push Press', 'kettlebell'),
  ('Dumbbell Floor Press', 'dumbbells'),
  ('Dumbbell Front Raise', 'dumbbells'),
  ('Dumbbell Romanian Deadlift', 'dumbbells'),
  ('Incline Push-Up', 'bench'),
  ('Lying Dumbbell Triceps Extension', 'dumbbells'),
  ('Lying Dumbbell Triceps Extension', 'bench'),
  ('Preacher Curl', 'barbell'),
  ('Preacher Curl', 'bench'),
  ('Renegade Row', 'dumbbells'),
  ('Single-Leg Romanian Deadlift', 'kettlebell'),
  ('Standing Barbell Calf Raise', 'barbell'),
  ('Standing Barbell Calf Raise', 'squat_rack')) AS e
JOIN movement m ON m.name = e.column1;
