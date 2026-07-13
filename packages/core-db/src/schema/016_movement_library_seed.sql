-- =============================================================================
-- 016_movement_library_seed.sql
-- Phase 16 S4: seeds the curated movement library from staging
-- (packages/core-db/staging/movement_import.json).
--
-- GENERATED FILE — do not hand-edit. Regenerate with:
--   node scripts/generate-library-migration.mjs
--
-- 51 curated movements seeded as rows (implement variants included
-- as rows with their own equipment — audit F3: the prefix model cannot
-- carry per-implement equipment requirements).
-- Idempotent (IF NOT EXISTS / INSERT OR IGNORE / constant UPDATE),
-- append-only chain, STRICT.
-- =============================================================================

-- (1) movement rows (auto ids; name is UNIQUE COLLATE NOCASE).
INSERT OR IGNORE INTO movement (name, pattern, primary_muscle, is_compound) VALUES
  ('Arnold Press', 'push_v', 'shoulders', 1),
  ('Band External Rotation', 'isolation', 'shoulders', 1),
  ('Barbell Ab Rollout', 'rotation', 'abdominals', 1),
  ('Barbell Curl', 'isolation', 'biceps', 0),
  ('Barbell Hip Thrust', 'hinge', 'glutes', 1),
  ('Barbell Step-Up', 'lunge', 'quadriceps', 1),
  ('Bench Dip', 'push_h', 'triceps', 1),
  ('Box Squat', 'squat', 'quadriceps', 1),
  ('Cable Crunch', 'rotation', 'abdominals', 0),
  ('Cable Pull-Through', 'hinge', 'glutes', 1),
  ('Cable Shoulder Press', 'push_v', 'shoulders', 1),
  ('Chest-Supported Dumbbell Row', 'pull_h', 'middle back', 1),
  ('Close-Grip Bench Press', 'push_h', 'triceps', 1),
  ('Dead Bug', 'rotation', 'abdominals', 1),
  ('Decline Bench Press', 'push_h', 'chest', 1),
  ('Deficit Deadlift', 'hinge', 'lower back', 1),
  ('Dip', 'push_h', 'triceps', 1),
  ('Double Kettlebell Front Squat', 'squat', 'quadriceps', 1),
  ('Dumbbell Flye', 'push_h', 'chest', 0),
  ('Dumbbell Lateral Raise', 'isolation', 'shoulders', 0),
  ('Dumbbell Lunge', 'lunge', 'quadriceps', 1),
  ('Dumbbell Reverse Lunge', 'lunge', 'quadriceps', 1),
  ('Dumbbell Shrug', 'isolation', 'traps', 0),
  ('Dumbbell Split Squat', 'lunge', 'quadriceps', 1),
  ('Dumbbell Squat', 'squat', 'quadriceps', 1),
  ('Dumbbell Step-Up', 'lunge', 'quadriceps', 1),
  ('Dumbbell Sumo Squat', 'squat', 'quadriceps', 1),
  ('Eccentric Wall Handstand Push-Up', 'push_v', 'shoulders', 1),
  ('Face Pull', 'pull_h', 'shoulders', 1),
  ('Feet-Elevated Push-Up', 'push_h', 'chest', 1),
  ('Good Morning', 'hinge', 'hamstrings', 1),
  ('Hammer Curl', 'isolation', 'biceps', 0),
  ('Handstand Push-Up', 'push_v', 'shoulders', 1),
  ('Hanging Leg Raise', 'rotation', 'abdominals', 0),
  ('Incline Dumbbell Press', 'push_h', 'chest', 1),
  ('Inverted Row', 'pull_h', 'middle back', 1),
  ('Kettlebell Pistol Squat', 'squat', 'quadriceps', 1),
  ('Kettlebell Turkish Get-Up', 'rotation', 'shoulders', 1),
  ('Pike Push-Up', 'push_v', 'shoulders', 1),
  ('Power Clean', 'hinge', 'hamstrings', 1),
  ('Pull-Up', 'pull_v', 'lats', 1),
  ('Reverse Crunch', 'rotation', 'abdominals', 0),
  ('Russian Twist', 'rotation', 'abdominals', 1),
  ('Scapular Pull-Up', 'pull_v', 'traps', 0),
  ('Single-Leg Glute Bridge', 'hinge', 'glutes', 0),
  ('Standing Dumbbell Calf Raise', 'isolation', 'calves', 0),
  ('Straight-Arm Pulldown', 'pull_v', 'lats', 0),
  ('Sumo Deadlift', 'hinge', 'hamstrings', 1),
  ('T-Bar Row', 'pull_h', 'middle back', 1),
  ('Triceps Pushdown', 'isolation', 'triceps', 0),
  ('Zercher Squat', 'squat', 'quadriceps', 1);

-- (2) movement_detail side-car (name-join, mirrors the 010 seed shape).
INSERT OR IGNORE INTO movement_detail
  (movement_id, base_name, supported_prefixes, difficulty_rating, target_muscles,
   instructions, cues, video_placeholder_uri)
SELECT m.movement_id, e.column2, e.column3, e.column4, e.column5, e.column6, e.column7, e.column8
FROM (VALUES
  ('Arnold Press', 'Arnold Press', '["DB"]', 'Intermediate', '["shoulders","triceps"]', 'Sit or stand holding dumbbells at shoulder height with palms facing you. Press up while rotating your palms to face forward at the top. Reverse the rotation on the way back down to the start. Stay tall and braced the whole press — the lean-back arch is the classic cheat, and it quietly turns this into a sloppy incline press.', 'Chest open, lats in the back pocket. Elbows tight, core tension. Rotate smooth all the way to lockout.', 'https://www.youtube.com/watch?v=3ml7BH7mNwQ'),
  ('Band External Rotation', 'External Rotation', '["Banded"]', 'Beginner', '["shoulders"]', 'Anchor a light band at elbow height and stand side-on, holding it with the far hand, elbow bent 90 degrees and pinned to your ribs. Rotate the forearm away from your body as far as it goes without the elbow leaving your side. Return slowly. This one trains the small rotators that stabilise every press you do — it feels like nothing on the day, and that is the point.', 'Elbow welded to the ribs — a towel between them keeps you honest. Light band, strict reps. Boring on purpose; do it anyway.', 'https://www.youtube.com/watch?v=_UvmPNGtlPM'),
  ('Barbell Ab Rollout', 'Ab Rollout', '["BB"]', 'Advanced', '["abdominals","lower back","shoulders"]', 'Kneel behind a loaded barbell with small plates and grip it at shoulder width. Brace hard and roll the bar forward as far as you can without your hips sagging. Pull the bar back to your knees using your abs, not your arms.', 'Tuck the pelvis before you move. Reach long with the elbows — push the upper back towards the ceiling. Shorten the rollout before you lose position.', 'https://www.youtube.com/watch?v=O-d6HC9gLcw'),
  ('Barbell Curl', 'Biceps Curl', '["BB"]', 'Beginner', '["biceps","forearms"]', 'Grip the bar at shoulder width with your arms hanging in their natural rest position. Curl to shoulder height with your upper arms pinned, then fight the bar down slower than it went up. Lower under control until your arms are back in the rest position — a small hip lean on the last rep is honest, a swing from rep one means the bar is too heavy.', 'Elbows stay behind the bar. Lower slower than you lift. Settle into the rest position between reps.', 'https://www.youtube.com/watch?v=QZEqB6wUPxQ'),
  ('Barbell Hip Thrust', 'Hip Thrust', '["BB"]', 'Intermediate', '["glutes","calves","hamstrings"]', 'Sit on the floor with your upper back against a bench and a padded bar over your hips. Plant your feet about hip-width, heels under your knees. Drive through your heels until your thighs and torso are level with the floor — finish flat like a tabletop, because any height past neutral comes from the lower back, not the glutes. Lower your hips under control and repeat.', 'Tuck the pelvis and pause a full beat at the top. One straight line knee-to-shoulder, core braced in neutral. Drive through the heels, shins vertical.', 'https://www.youtube.com/watch?v=pF17m_CXfL0'),
  ('Barbell Step-Up', 'Step-Up', '["BB"]', 'Intermediate', '["quadriceps","calves","glutes","hamstrings"]', 'Set the bar as for a squat and stand close to a box that puts your thigh near parallel when your foot is up. Put the whole foot on the box and stand up through it — the floor leg hangs, it does not jump. Lower on a controlled count until the floor toe touches, and go again without rocking.', 'Drive through the top leg — the bottom foot is a passenger. Whole foot on the box, stand tall through the hip. Chest proud the whole way up.', 'https://www.youtube.com/watch?v=MRtbwZPK7iY'),
  ('Bench Dip', 'Bench Dip', '["Bodyweight"]', 'Beginner', '["triceps","chest","shoulders"]', 'Grip the edge of a bench behind you, legs out in front, hips just clear of the bench. Bend the elbows straight back and lower until your upper arms are about parallel. Press back to lockout, keeping your hips close to the bench the whole way. Elevate the feet or add a plate on the lap to progress.', 'Elbows point straight back. Hips graze the bench the whole way. Shoulders down, away from the ears.', 'https://www.youtube.com/watch?v=0326dy_-CzM'),
  ('Box Squat', 'Box Squat', '["BB"]', 'Intermediate', '["quadriceps","adductors","calves","glutes","hamstrings","lower back"]', 'Set a box behind you at or just below parallel height and set up as for a back squat. Sit back onto the box under control, pausing briefly without relaxing. Drive back up to standing without rocking forward.', 'Sit back, shins near vertical. Land soft and stay tight through the whole pause. Explode up off the box.', 'https://www.youtube.com/watch?v=WGjf5w8iaTM'),
  ('Cable Crunch', 'Cable Crunch', '["Cable"]', 'Intermediate', '["abdominals"]', 'Kneel far enough from the stack that the cable stays loaded at the top, rope held to your collarbones. Crunch by rounding your upper spine, driving your elbows towards your thighs while your hips stay frozen. Unroll slowly until the abs are on stretch, keeping the rope pinned to your head the whole set.', 'Round the upper spine, elbows to the thighs. Hips locked in place. Abs pull, arms just hold the rope.', 'https://www.youtube.com/watch?v=0KEP6A1deBE'),
  ('Cable Pull-Through', 'Pull-Through', '["Cable"]', 'Beginner', '["glutes","hamstrings","lower back"]', 'Face away from a low cable with a rope between your legs, held at your hips. Walk out until the cable is taut, then push your hips back and hinge forward with a flat back. Drive your hips forward to stand tall, squeezing your glutes.', 'Push the hips back — the arms just hold the rope. Squeeze the glutes at lockout. Flat back the whole rep.', 'https://www.youtube.com/watch?v=cXPOYVFjgC8'),
  ('Cable Shoulder Press', 'Shoulder Press', '["Cable"]', 'Intermediate', '["shoulders","triceps"]', 'Set a low pulley and bring the handle to shoulder height, standing tall. Press to lockout overhead against the cable''s pull, which drags forward and down the entire rep — that constant tension is the point, there is no rest at the top. Lower under control back to the shoulder. Usually run one arm at a time; the free hand tells you when you are leaning.', 'Press to a tall, stacked lockout — chest open. Constant tension up and down, the cable never rests. Brace like someone is about to pull you forward, because something is.', 'https://www.youtube.com/watch?v=VuZSb_4Of-M'),
  ('Chest-Supported Dumbbell Row', 'Chest-Supported Row', '["DB"]', 'Beginner', '["middle back","biceps","forearms","lats","shoulders"]', 'Lie chest-down on an incline bench with a dumbbell hanging from each hand. Row both dumbbells up, driving the elbows towards the ceiling, until your shoulder blades pinch. Lower to a full hang and let the weight pull the blades apart. The bench removes the cheat — whatever moves the weight here is actually your back.', 'Chest glued to the pad the whole set. Pull with the elbows. Full hang and blade stretch at the bottom.', 'https://www.youtube.com/watch?v=kX4gtPQeyb8'),
  ('Close-Grip Bench Press', 'Close-Grip Bench Press', '["BB"]', 'Intermediate', '["triceps","chest","shoulders"]', 'Lie on a bench and grip the bar at about shoulder width, not narrower. Unrack and lower the bar to your lower chest, elbows staying close to your sides. Press back up to straight arms.', 'Elbows ride close to the ribs. Wrists stacked over the elbows. Touch low on the chest.', 'https://www.youtube.com/watch?v=nEF0bv2FW94'),
  ('Dead Bug', 'Dead Bug', '["Bodyweight"]', 'Beginner', '["abdominals"]', 'Lie on your back, arms at the ceiling, knees stacked over your hips. Flatten your lower back into the floor and keep that pressure for the entire set — that pressure is the exercise. Lower one arm and the opposite leg as far as you can without the back peeling up, exhaling the whole way, then switch sides.', 'Press the floor with your lower back — that pressure is the rep. Exhale like fogging a mirror as the limbs lower. Slow, opposite arm and leg, full control.', 'https://www.youtube.com/watch?v=bxn9FBrt4-A'),
  ('Decline Bench Press', 'Decline Bench Press', '["BB"]', 'Intermediate', '["chest","shoulders","triceps"]', 'Hook your legs into the decline bench and take the bar just wider than shoulder width. Lower to the lower line of your chest — the decline shortens the stroke, so expect to touch sooner than on flat. Press back to lockout over your eyes. Have a spotter for the unrack; getting out of a decline alone is ugly.', 'Touch at the natural end of the shorter stroke. Wrists stacked, bar over the forearm bones. Spotter on the unrack.', 'https://www.youtube.com/watch?v=LfyQBUKR8SE'),
  ('Deficit Deadlift', 'Deadlift', '["BB"]', 'Advanced', '["lower back","forearms","glutes","hamstrings","middle back","quadriceps","traps"]', 'Stand on a plate or low platform, one to three inches, bar over mid-foot. Set up as for a conventional deadlift — the deficit forces more knee and hip bend, so brace before you even reach for the bar. Pull to lockout, fighting hardest through the longer bottom range. Earn a flat back at this depth before loading heavy; the deficit exposes mobility you can hide on a normal pull.', 'Earn the extra range with a flat back. Pull the slack out before the bar breaks the floor. Keep the deficit small — three inches is plenty.', 'https://www.youtube.com/watch?v=hnuPZZfeRzs'),
  ('Dip', 'Dip', '["Bodyweight"]', 'Intermediate', '["triceps","chest","shoulders"]', 'Support yourself on parallel bars with arms straight. Bend your elbows and lower your body until your upper arms are about parallel to the floor. Press back up to straight arms. Lean slightly forward for more chest, stay upright for more triceps.', 'Shoulders down, away from the ears. Lower to a stretch you can press out of. Lock out tall, shoulders packed.', 'https://www.youtube.com/watch?v=wjUmnZH528Y'),
  ('Double Kettlebell Front Squat', 'Front Squat', '["KB"]', 'Intermediate', '["quadriceps","calves","glutes"]', 'Clean two kettlebells into the rack position, resting on your forearms at your chest. Squat down as deep as you can control, keeping your elbows in and chest up. Drive back up to standing without letting the bells pull you forward.', 'Elbows in, bells resting on the forearms. Stay tall — chest proud against the load. Full foot planted, knees out.', 'https://www.youtube.com/watch?v=6XghYOzny8U'),
  ('Dumbbell Flye', 'Flye', '["DB"]', 'Beginner', '["chest"]', 'Lie on a flat bench with dumbbells pressed over your chest, palms facing each other. Open your arms in a wide arc with a fixed soft elbow bend until you feel a real stretch across the chest. Bring them back up along the same arc, like hugging a barrel. The stretch builds the chest; the last inches of the squeeze at the top do almost nothing.', 'Elbow angle locked the whole arc. Open to a deep working stretch, then hug the barrel back up. Lighter than you think — this movement punishes ego.', 'https://www.youtube.com/watch?v=LzFvciCdoW0'),
  ('Dumbbell Lateral Raise', 'Lateral Raise', '["DB"]', 'Beginner', '["shoulders"]', 'Stand with a slight forward lean, dumbbells hanging just off your thighs rather than pinned to your sides. Raise both arms out and slightly forward until your elbows reach shoulder height, leading the whole way with the elbows. Lower on a three-count — the lowering half builds most of the delt. If you have to swing, the dumbbells are too heavy; this stays lighter than your ego wants.', 'Lead with the elbows, hands stay below them. Lean an inch forward to take the front delts out of it. Three seconds down.', 'https://www.youtube.com/watch?v=3VcKaXpzqRo'),
  ('Dumbbell Lunge', 'Lunge', '["DB"]', 'Beginner', '["quadriceps","calves","glutes","hamstrings"]', 'Step forward far enough that your front shin stays near vertical when you drop. Lower until the back knee hovers just off the floor, torso tall. Drive through the whole front foot to come back up — the back leg is a kickstand, not an engine.', 'Long step, vertical shin. All the work belongs to the front leg. When you wobble, slow the descent and keep the full range.', 'https://www.youtube.com/watch?v=G4gAK8Bhyro'),
  ('Dumbbell Reverse Lunge', 'Lunge', '["DB"]', 'Beginner', '["quadriceps","calves","glutes","hamstrings"]', 'Stand with a dumbbell in each hand and step one foot back, lowering until the back knee hovers just off the floor. Drive through the whole front foot to return to standing. Stepping back instead of forward keeps the front shin vertical and is much kinder to cranky knees — same muscles, less complaint.', 'The front leg does the work — the back leg just catches you. Torso tall and stacked. Place the step back soft and controlled.', 'https://www.youtube.com/watch?v=mHkPgReOqUM'),
  ('Dumbbell Shrug', 'Shrug', '["DB"]', 'Beginner', '["traps"]', 'Stand holding dumbbells at your sides with your arms hanging as dead weight. With intention, pull your shoulder blades up and back behind your ears, as high as the traps will take them. Hold a full second at the top, then lower until you feel the traps stretch — the rep is the squeeze and the stretch, not the bounce in between.', 'With intention: pull the shoulder blades up and back behind your ears. Own a full second at the top. Let the weight stretch the traps at the bottom.', 'https://www.youtube.com/watch?v=qvvJUKq7_sU'),
  ('Dumbbell Split Squat', 'Split Squat', '["DB"]', 'Intermediate', '["quadriceps","glutes","hamstrings"]', 'Take a long stance, one foot forward and one back, dumbbells at your sides. Lower straight down until the back knee hovers just off the floor — the stance stays planted the entire set, which is what separates this from a lunge. Drive up through the front foot. If you feel it mostly in the back leg''s hip flexor, your stance is too short.', 'Drop straight down between the feet. Both feet planted the whole set. Take a stance long enough to feel glute, not hip flexor.', 'https://www.youtube.com/watch?v=5VG4UnfA7Bk'),
  ('Dumbbell Squat', 'Squat', '["DB"]', 'Beginner', '["quadriceps","calves","glutes","hamstrings","lower back"]', 'Stand with dumbbells hanging at your sides and squat until your thighs are near parallel, letting the dumbbells travel straight down beside you. Drive up through the whole foot with a tall chest. Grip gives out before legs do at any serious weight — when that happens, it is time for the goblet or the bar, not straps.', 'Let the dumbbells hang plumb at your sides. Tall chest, full foot. When grip becomes the limit, graduate to the bar.', 'https://www.youtube.com/watch?v=ZXwvmRSRRxY'),
  ('Dumbbell Step-Up', 'Step-Up', '["DB"]', 'Intermediate', '["quadriceps","calves","glutes","hamstrings"]', 'Hold a dumbbell in each hand and stand close to a box that puts your thigh near parallel when your foot is up. Put the whole foot on the box and stand up through it — the floor leg hangs, it does not jump. Lower on a controlled count until the floor toe touches, and go again without rocking.', 'Drive through the top leg — the bottom foot is a passenger. Whole foot on the box, stand all the way up. Dumbbells hang quiet at your sides.', 'https://www.youtube.com/watch?v=tqECKZxlCKE'),
  ('Dumbbell Sumo Squat', 'Sumo Squat', '["DB"]', 'Beginner', '["quadriceps","abdominals","calves","glutes","hamstrings"]', 'Take a wide stance, toes out around 45 degrees, one dumbbell hanging from both hands between your legs. Squat straight down between your knees, keeping your torso tall. Drive up through the whole foot, pushing the knees out over the toes the entire time. You should feel the inner thighs and glutes doing work a normal squat never asks of them.', 'Push the knees out over the toes. Sit straight down between the heels. Tall chest, let the dumbbell hang.', 'https://www.youtube.com/watch?v=GG92d1QZTZg'),
  ('Eccentric Wall Handstand Push-Up', 'Handstand Push-Up', '["Bodyweight"]', 'Advanced', '["shoulders","triceps"]', 'Kick up into a handstand with your back to a wall, hands just wider than your shoulders. Lower as slowly as you can — aim for a full five seconds — until your head lightly meets the floor. Come down, reset, and kick back up; the lowering IS the rep, there is no press yet. When five-second negatives feel owned, start pressing back out.', 'Own all five seconds of the descent. Glutes squeezed, hips off the wall. The lowering IS the rep — give it your full attention.', 'https://www.youtube.com/watch?v=GGBOX8Byz08'),
  ('Face Pull', 'Face Pull', '["Cable","Banded"]', 'Beginner', '["shoulders","middle back"]', 'Set the rope at upper-chest height, grab it thumbs-back, and step away until the stack is live. Pull the rope to the bridge of your nose while splitting your hands past your ears, letting the shoulders rotate back at the end. If you cannot hold a one-second squeeze with the shoulder blades pinned, the weight is wrong — this never becomes a heavy movement.', 'Thumbs to the ears, elbows high. Squeeze the blades for a full beat. The weight stays humble.', 'https://www.youtube.com/watch?v=eTCBSFlCJ_s'),
  ('Feet-Elevated Push-Up', 'Push-Up', '["Bodyweight"]', 'Beginner', '["chest","shoulders","triceps"]', 'Set your feet on a box or bench with your hands on the floor just wider than your shoulders. Lower your chest to the floor as one rigid line — the higher the feet, the more the shoulders take over from the chest. Press back to long arms without the hips piking or sagging. Own strict floor push-ups before you raise the feet.', 'One rigid line, hips locked into the plank. Lead with the chest, chin packed. Earn strict floor reps before you raise the feet.', 'https://www.youtube.com/watch?v=SKPab2YC8BE'),
  ('Good Morning', 'Good Morning', '["BB"]', 'Intermediate', '["hamstrings","abdominals","glutes","lower back"]', 'Set a barbell across your upper back as in a squat. With a slight knee bend, push your hips back and hinge forward until your torso is near parallel to the floor. Drive your hips forward to stand back up. Start light and add weight slowly.', 'Push the hips straight back. Flat back the whole rep. Feel the hamstrings load — they bring you back up.', 'https://www.youtube.com/watch?v=0Syp9iyINZ4'),
  ('Hammer Curl', 'Biceps Curl', '["DB"]', 'Beginner', '["biceps"]', 'Hold dumbbells at your sides with palms facing each other, and keep them that way for the whole rep. Curl to shoulder height with the upper arms pinned, then lower slower than you lifted. The neutral grip shifts the work to the brachialis and forearms — it is the thickness builder, and it will quietly take more load than a normal curl.', 'Thumbs up — carry the neutral grip through the whole rep. Elbows pinned. Heavier than your supinated curl is normal, earn it strict.', 'https://www.youtube.com/watch?v=zC3nLlEvin4'),
  ('Handstand Push-Up', 'Handstand Push-Up', '["Bodyweight"]', 'Advanced', '["shoulders","triceps"]', 'Kick up into a handstand against a wall, hands just wider than your shoulders. Lower under control until your head lightly touches the floor. Press back up to straight arms. Build up with pike push-ups first if you cannot control the descent.', 'Brace like a vertical plank — ribs stacked over hips. Kiss the floor with the head, then press away. Own the way down.', 'https://www.youtube.com/watch?v=7wSZnHQZChI'),
  ('Hanging Leg Raise', 'Hanging Leg Raise', '["Bodyweight"]', 'Intermediate', '["abdominals"]', 'Hang from a pull-up bar with an overhand grip, arms and legs straight. Raise your legs until they are at least parallel to the floor, higher if you can keep control. Lower slowly back to a dead hang. Bend your knees to make it easier.', 'Curl the pelvis up towards the ribs. Dead-still hang between reps. Slow on the way down.', 'https://www.youtube.com/watch?v=rbOJSK07AGA'),
  ('Incline Dumbbell Press', 'Incline Press', '["DB"]', 'Intermediate', '["chest","shoulders","triceps"]', 'Set the bench between 30 and 45 degrees — lower hits more chest, higher bleeds into shoulders. Kick the dumbbells up off your knees one at a time and start from the top. Lower to a deep stretch just outside your chest with your elbows about 45 degrees from your sides, then press up and slightly back so the dumbbells finish over your face, not your belly.', 'Feet planted, upper back tight on the bench. Earn the stretch at the bottom. Press up and slightly back, finishing over the face.', 'https://www.youtube.com/watch?v=8iPEnn-ltC8'),
  ('Inverted Row', 'Inverted Row', '["Bodyweight"]', 'Beginner', '["middle back","lats"]', 'Set a bar around hip height and get under it with your body in one rigid line, heels planted. Pull your chest to the bar, leading with the elbows, and touch the same spot every rep. Lower to long arms without letting the hips sag — the plank is half the exercise. Feet further under the bar makes it easier, feet elevated makes it harder.', 'Glutes squeezed, body one rigid plank. Pull with the elbows, chest to bar. Same touch point every rep.', 'https://www.youtube.com/watch?v=hXTc1mDnZCw'),
  ('Kettlebell Pistol Squat', 'Pistol Squat', '["KB"]', 'Advanced', '["quadriceps","calves","glutes","hamstrings","shoulders"]', 'Hold a kettlebell at your chest with both hands and stand on one leg, the other leg extended in front of you. Squat all the way down on the standing leg, keeping the other leg off the floor. Drive back up to standing without touching down. The kettlebell acts as a counterbalance, which makes this easier than an unloaded pistol.', 'Heel stays down. Use the bell as a counterweight. Slow down, strong up.', 'https://www.youtube.com/watch?v=3dMMJMSpFV0'),
  ('Kettlebell Turkish Get-Up', 'Turkish Get-Up', '["KB"]', 'Advanced', '["shoulders","abdominals","calves","hamstrings","quadriceps","triceps"]', 'Lie on your back and press a kettlebell to a locked arm — that arm stays vertical and locked for everything that follows. Roll to your elbow, then your hand, sweep the leg through, and stand up in stages, eyes on the bell the whole way. Reverse every stage back to the floor with the same control. Learn it with a shoe balanced on your fist before you ever load it.', 'Bell arm locked and vertical — eyes on the bell. Own each position before you leave it. Slow IS the technique.', 'https://www.youtube.com/watch?v=lpltjWHd0ek'),
  ('Pike Push-Up', 'Pike Push-Up', '["Bodyweight"]', 'Intermediate', '["shoulders","triceps","chest"]', 'Start in a push-up position, then walk your feet in and lift your hips high so your torso points at the floor like an inverted V. Bend your elbows and lower the top of your head towards the floor between your hands. Press back to long arms without the hips drifting forward. Elevate the feet to move it closer to a handstand push-up.', 'Hips stacked high the whole rep. Head travels to a spot just ahead of the hands. Elbows track at about 45 degrees.', 'https://www.youtube.com/watch?v=lIZ_C4VJnmc'),
  ('Power Clean', 'Power Clean', '["BB"]', 'Advanced', '["hamstrings","calves","forearms","glutes","lower back","middle back","quadriceps","shoulders","traps","triceps"]', 'Start with the bar over mid-foot, hips higher than a deadlift setup. Pull the bar from the floor, then explode with your hips when it passes your knees, shrugging hard. Drop under and catch the bar on your front shoulders in a quarter squat, elbows whipped through. Stand up, then lower under control and reset each rep.', 'Slow off the floor, violent at the hips. The arms are ropes until the shrug. Catch with high elbows.', 'https://www.youtube.com/watch?v=lI35socHJ4k'),
  ('Pull-Up', 'Pull-Up', '["Bodyweight"]', 'Intermediate', '["lats","biceps","middle back"]', 'Take an overhand grip just outside your shoulders and start from a dead hang. Pull your chest towards the bar, driving the elbows down and back, until your chin clears without reaching for it. Lower under full control back to the dead hang — cutting the bottom quietly steals the range that builds the back.', 'Every rep starts from a dead hang. Drive the elbows down and back. Quiet body — all pull, no kick.', 'https://www.youtube.com/watch?v=vw5Xmu5CIew'),
  ('Reverse Crunch', 'Reverse Crunch', '["Bodyweight"]', 'Beginner', '["abdominals"]', 'Lie on your back with knees bent over your hips, hands flat beside you or holding something behind your head. Curl your hips off the floor, bringing the knees towards your ribs — the movement is the pelvis rolling up, not the legs swinging. Lower the hips back down slowly without letting the feet touch between reps.', 'Roll the pelvis up towards the ribs. Lower the hips slow — that half is where the abs work. Keep the feet floating between reps.', 'https://www.youtube.com/watch?v=XY8KzdDcMFg'),
  ('Russian Twist', 'Russian Twist', '["Bodyweight"]', 'Beginner', '["abdominals","lower back"]', 'Sit with knees bent and heels lightly touching the floor, torso leaned back to about 45 degrees with a long spine. Rotate your ribcage side to side, eyes and chest travelling together — the hands only follow. Add weight at the chest or float the feet only once the rotation stays crisp without the lower back rounding.', 'Turn the ribs — the arms just follow. Sit tall, long spine. Slow rotation, full control at both ends.', 'https://www.youtube.com/watch?v=IJDOoVyVjhc'),
  ('Scapular Pull-Up', 'Pull-Up', '["Bodyweight"]', 'Beginner', '["traps","lats","middle back"]', 'Hang from a pull-up bar with straight arms and let your shoulders rise to your ears. Without bending your elbows, pull your shoulder blades down and back so your body lifts a few inches. Hold the top for a beat, then return to the full hang with control.', 'Arms stay straight — this is the shoulder blades'' job. Small range, done with intention. It is the first inch of every pull-up you will ever do.', 'https://www.youtube.com/watch?v=-ZIpSoTRsuE'),
  ('Single-Leg Glute Bridge', 'Glute Bridge', '["Bodyweight"]', 'Beginner', '["glutes","hamstrings"]', 'Lie with one foot planted close enough that your fingertips can graze the heel, the other leg extended. Drive through the planted heel to a straight line from knee to shoulder, and hold the top until the glute, not the hamstring, owns it. If the hamstring cramps, the foot is too far out — pull it in and re-set.', 'Hips dead level the whole rep. Heel in close for glute, further out for hamstring. Own the top before you lower.', 'https://www.youtube.com/watch?v=VUl8R0kn6v4'),
  ('Standing Dumbbell Calf Raise', 'Calf Raise', '["DB"]', 'Beginner', '["calves"]', 'Stand with the balls of your feet on a step, heels hanging off, a dumbbell in one hand and the other hand on something for balance. Lower your heels until you feel a deep calf stretch, pause, then drive up as high onto your toes as you can. Calves respond to the stretch and the pause — bouncing through half reps at the top is why most people''s calves never grow.', 'Full stretch at the bottom, pause there. All the way up onto the big toe. High reps, honest range — 15 to 25 beats 8 bounces.', 'https://www.youtube.com/watch?v=HvvqTpTongY'),
  ('Straight-Arm Pulldown', 'Straight-Arm Pulldown', '["Cable"]', 'Intermediate', '["lats"]', 'Stand facing a high cable with a straight bar or rope, arms extended in front of you at shoulder height. Keeping a slight elbow bend, pull the attachment down in an arc until your hands reach your thighs. Return under control to shoulder height.', 'Arms long, elbows soft and fixed at that angle. Pull with the elbows, not the hands — hands wake the biceps, elbows wake the lats. Hinge slightly and stay braced.', 'https://www.youtube.com/watch?v=mvgQs3CkgGQ'),
  ('Sumo Deadlift', 'Sumo Deadlift', '["BB"]', 'Intermediate', '["hamstrings","adductors","forearms","glutes","lower back","middle back","quadriceps","traps"]', 'Stand with a wide stance, toes pointed out, bar over mid-foot. Grip the bar inside your knees with straight arms. Brace, then drive the floor away, keeping the bar against your legs until you stand tall. Push your hips back and bend your knees to return the bar to the floor.', 'Knees track over toes. Chest up before you pull. Push the floor apart with your feet.', 'https://www.youtube.com/watch?v=1ltxpKdXkG4'),
  ('T-Bar Row', 'T-Bar Row', '["BB"]', 'Intermediate', '["middle back","biceps","lats"]', 'Straddle the bar, hinge to about 45 degrees, and take the handle with a neutral grip. Pull the plates to your chest, driving the elbows up and back, and let the bar stretch your lats at the bottom of every rep. Hold your hinge angle — every degree you stand up as the set gets hard is range you stole from your back.', 'Lock your hinge angle and defend it all set. Pull with the elbows to the chest. Full stretch at the bottom, plates floating.', 'https://www.youtube.com/watch?v=zAZQJYx9vrk'),
  ('Triceps Pushdown', 'Triceps Pushdown', '["Cable"]', 'Beginner', '["triceps"]', 'Pin your elbows to your ribs at a high cable and take a half step back so the stack pulls at a slight angle. Push down to a hard lockout and squeeze for a beat. Ride the cable back up until your forearms pass parallel — the stretch is half the rep, but the moment your elbows drift forward the lats take over and the triceps get nothing.', 'Elbows glued to the ribs. Squeeze the lockout for a beat. Ride the cable back up under full control.', 'https://www.youtube.com/watch?v=-zLyUAo1gMw'),
  ('Zercher Squat', 'Zercher Squat', '["BB"]', 'Advanced', '["quadriceps","calves","glutes","hamstrings"]', 'Cradle the bar in the crooks of your elbows, hands clasped, and stand up out of the rack. Squat between your knees, keeping the elbows inside them and your torso as upright as the front-load forces you to be. Drive up without letting the bar roll down your forearms. Wrap the bar or wear sleeves — the discomfort is front-of-arm, and it fades with exposure.', 'Elbows ride inside the knees at the bottom. Brace tall like a front squat. Wrap the bar, then give it full effort.', 'https://www.youtube.com/watch?v=-1iRwWOGTlk')) AS e
JOIN movement m ON m.name = e.column1;

-- (3) movement_taxonomy side-car (8-pattern category + implement + family).
INSERT OR IGNORE INTO movement_taxonomy (movement_id, category, implement, family)
SELECT m.movement_id, e.column2, e.column3, e.column4
FROM (VALUES
  ('Arnold Press', 'push', 'dumbbell', 'arnold_press'),
  ('Band External Rotation', 'accessory', 'band', 'external_rotation'),
  ('Barbell Ab Rollout', 'core', 'barbell', 'ab_rollout'),
  ('Barbell Curl', 'accessory', 'barbell', 'biceps_curl'),
  ('Barbell Hip Thrust', 'hinge', 'barbell', 'hip_thrust'),
  ('Barbell Step-Up', 'unilateral', 'barbell', 'step_up'),
  ('Bench Dip', 'push', 'bodyweight', 'bench_dip'),
  ('Box Squat', 'squat', 'barbell', 'box_squat'),
  ('Cable Crunch', 'core', 'cable', 'cable_crunch'),
  ('Cable Pull-Through', 'hinge', 'cable', 'pull_through'),
  ('Cable Shoulder Press', 'push', 'cable', 'shoulder_press'),
  ('Chest-Supported Dumbbell Row', 'row', 'dumbbell', 'chest_supported_row'),
  ('Close-Grip Bench Press', 'push', 'barbell', 'close_grip_bench_press'),
  ('Dead Bug', 'core', 'bodyweight', 'dead_bug'),
  ('Decline Bench Press', 'push', 'barbell', 'decline_bench_press'),
  ('Deficit Deadlift', 'hinge', 'barbell', 'deadlift'),
  ('Dip', 'push', 'bodyweight', 'dip'),
  ('Double Kettlebell Front Squat', 'squat', 'kettlebell', 'front_squat'),
  ('Dumbbell Flye', 'push', 'dumbbell', 'flye'),
  ('Dumbbell Lateral Raise', 'accessory', 'dumbbell', 'lateral_raise'),
  ('Dumbbell Lunge', 'unilateral', 'dumbbell', 'lunge'),
  ('Dumbbell Reverse Lunge', 'unilateral', 'dumbbell', 'lunge'),
  ('Dumbbell Shrug', 'row', 'dumbbell', 'shrug'),
  ('Dumbbell Split Squat', 'unilateral', 'dumbbell', 'split_squat'),
  ('Dumbbell Squat', 'squat', 'dumbbell', 'squat'),
  ('Dumbbell Step-Up', 'unilateral', 'dumbbell', 'step_up'),
  ('Dumbbell Sumo Squat', 'squat', 'dumbbell', 'sumo_squat'),
  ('Eccentric Wall Handstand Push-Up', 'push', 'bodyweight', 'handstand_push_up'),
  ('Face Pull', 'row', 'cable', 'face_pull'),
  ('Feet-Elevated Push-Up', 'push', 'bodyweight', 'push_up'),
  ('Good Morning', 'hinge', 'barbell', 'good_morning'),
  ('Hammer Curl', 'accessory', 'dumbbell', 'biceps_curl'),
  ('Handstand Push-Up', 'push', 'bodyweight', 'handstand_push_up'),
  ('Hanging Leg Raise', 'core', 'bodyweight', 'hanging_leg_raise'),
  ('Incline Dumbbell Press', 'push', 'dumbbell', 'incline_press'),
  ('Inverted Row', 'row', 'bodyweight', 'inverted_row'),
  ('Kettlebell Pistol Squat', 'unilateral', 'kettlebell', 'pistol_squat'),
  ('Kettlebell Turkish Get-Up', 'core', 'kettlebell', 'turkish_get_up'),
  ('Pike Push-Up', 'push', 'bodyweight', 'pike_push_up'),
  ('Power Clean', 'hinge', 'barbell', 'power_clean'),
  ('Pull-Up', 'row', 'bodyweight', 'pull_up'),
  ('Reverse Crunch', 'core', 'bodyweight', 'reverse_crunch'),
  ('Russian Twist', 'core', 'bodyweight', 'russian_twist'),
  ('Scapular Pull-Up', 'row', 'bodyweight', 'pull_up'),
  ('Single-Leg Glute Bridge', 'unilateral', 'bodyweight', 'glute_bridge'),
  ('Standing Dumbbell Calf Raise', 'accessory', 'dumbbell', 'calf_raise'),
  ('Straight-Arm Pulldown', 'row', 'cable', 'straight_arm_pulldown'),
  ('Sumo Deadlift', 'hinge', 'barbell', 'sumo_deadlift'),
  ('T-Bar Row', 'row', 'barbell', 't_bar_row'),
  ('Triceps Pushdown', 'push', 'cable', 'triceps_pushdown'),
  ('Zercher Squat', 'squat', 'barbell', 'zercher_squat')) AS e
JOIN movement m ON m.name = e.column1;

-- (5) movement_equipment (007 vocabulary; no rows = bodyweight — which is
-- load-bearing in the generator, so every non-bodyweight row is mapped).
INSERT OR IGNORE INTO movement_equipment (movement_id, item)
SELECT m.movement_id, e.column2
FROM (VALUES
  ('Arnold Press', 'dumbbells'),
  ('Band External Rotation', 'bands'),
  ('Barbell Ab Rollout', 'barbell'),
  ('Barbell Curl', 'barbell'),
  ('Barbell Hip Thrust', 'barbell'),
  ('Barbell Hip Thrust', 'bench'),
  ('Barbell Step-Up', 'barbell'),
  ('Barbell Step-Up', 'squat_rack'),
  ('Barbell Step-Up', 'bench'),
  ('Bench Dip', 'bench'),
  ('Box Squat', 'barbell'),
  ('Box Squat', 'squat_rack'),
  ('Box Squat', 'bench'),
  ('Cable Crunch', 'cable_machine'),
  ('Cable Pull-Through', 'cable_machine'),
  ('Cable Shoulder Press', 'cable_machine'),
  ('Chest-Supported Dumbbell Row', 'dumbbells'),
  ('Chest-Supported Dumbbell Row', 'bench'),
  ('Close-Grip Bench Press', 'barbell'),
  ('Close-Grip Bench Press', 'bench'),
  ('Decline Bench Press', 'barbell'),
  ('Decline Bench Press', 'bench'),
  ('Deficit Deadlift', 'barbell'),
  ('Dip', 'pullup_bar'),
  ('Double Kettlebell Front Squat', 'kettlebell'),
  ('Dumbbell Flye', 'dumbbells'),
  ('Dumbbell Flye', 'bench'),
  ('Dumbbell Lateral Raise', 'dumbbells'),
  ('Dumbbell Lunge', 'dumbbells'),
  ('Dumbbell Reverse Lunge', 'dumbbells'),
  ('Dumbbell Shrug', 'dumbbells'),
  ('Dumbbell Split Squat', 'dumbbells'),
  ('Dumbbell Squat', 'dumbbells'),
  ('Dumbbell Step-Up', 'dumbbells'),
  ('Dumbbell Step-Up', 'bench'),
  ('Dumbbell Sumo Squat', 'dumbbells'),
  ('Face Pull', 'cable_machine'),
  ('Feet-Elevated Push-Up', 'bench'),
  ('Good Morning', 'barbell'),
  ('Good Morning', 'squat_rack'),
  ('Hammer Curl', 'dumbbells'),
  ('Hanging Leg Raise', 'pullup_bar'),
  ('Incline Dumbbell Press', 'dumbbells'),
  ('Incline Dumbbell Press', 'bench'),
  ('Inverted Row', 'barbell'),
  ('Inverted Row', 'squat_rack'),
  ('Kettlebell Pistol Squat', 'kettlebell'),
  ('Kettlebell Turkish Get-Up', 'kettlebell'),
  ('Power Clean', 'barbell'),
  ('Pull-Up', 'pullup_bar'),
  ('Scapular Pull-Up', 'pullup_bar'),
  ('Standing Dumbbell Calf Raise', 'dumbbells'),
  ('Straight-Arm Pulldown', 'cable_machine'),
  ('Sumo Deadlift', 'barbell'),
  ('T-Bar Row', 'barbell'),
  ('Triceps Pushdown', 'cable_machine'),
  ('Zercher Squat', 'barbell'),
  ('Zercher Squat', 'squat_rack')) AS e
JOIN movement m ON m.name = e.column1;

-- (6) movement_beginner_whitelist — plan P16 S4: beginners see Beginner
-- difficulty plus exactly these Intermediate staples (ratified 2026-07-13,
-- no barbell lifts). Presence of a row = whitelisted.
CREATE TABLE IF NOT EXISTS movement_beginner_whitelist (
  movement_id INTEGER PRIMARY KEY REFERENCES movement ON DELETE CASCADE
) STRICT;
INSERT OR IGNORE INTO movement_beginner_whitelist (movement_id)
SELECT m.movement_id FROM movement m WHERE m.name IN (
  'Dumbbell Bench Press',
  'Dumbbell Shoulder Press',
  'Incline Dumbbell Press',
  'Dumbbell Step-Up',
  'Dumbbell Split Squat',
  'Cable Shoulder Press',
  'Straight-Arm Pulldown',
  'Cable Crunch');

-- (7) movement_progression — goal-movement ladders (progressionEngine.ts).
-- Side-car (001 movement cannot gain columns idempotently). Rank is an
-- ordinal within a group; gaps legal; (group, rank) unique.
CREATE TABLE IF NOT EXISTS movement_progression (
  movement_id      INTEGER PRIMARY KEY REFERENCES movement ON DELETE CASCADE,
  progression_group TEXT NOT NULL,
  progression_rank  INTEGER NOT NULL CHECK (progression_rank >= 0),
  UNIQUE (progression_group, progression_rank)
) STRICT;

INSERT OR IGNORE INTO movement_progression (movement_id, progression_group, progression_rank)
SELECT m.movement_id, e.column2, e.column3
FROM (VALUES
  ('Push-up', 'handstand-push-up', 0),
  ('Feet-Elevated Push-Up', 'handstand-push-up', 1),
  ('Pike Push-Up', 'handstand-push-up', 2),
  ('Eccentric Wall Handstand Push-Up', 'handstand-push-up', 3),
  ('Handstand Push-Up', 'handstand-push-up', 4),
  ('Lat Pulldown', 'pull-up', 0),
  ('Inverted Row', 'pull-up', 1),
  ('Scapular Pull-Up', 'pull-up', 2),
  ('Pull-Up', 'pull-up', 3),
  ('Weighted Pull-up', 'pull-up', 4)) AS e
JOIN movement m ON m.name = e.column1;
