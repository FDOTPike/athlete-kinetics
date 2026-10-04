-- =============================================================================
-- 068_movement_content_correction_v2.sql
-- Movement content correction v2 (generated, additive, idempotent).
-- Source of truth: packages/core-db/staging/movement_content_correction_v2.json
-- Evidence:        packages/core-db/staging/movement_upstream_instructions.json
-- Regenerate with: node scripts/generate-content-correction-v2.mjs --write
--
-- Replaces the shared "Set up <name> with ..." coaching template on 115 movements
-- with concrete setup, action and controlled-return text. Coaching text ONLY:
-- no name, id, alias, pattern, difficulty, taxonomy, equipment, asset key, media
-- status, fallback URL or preview is written. Movements 135 and 187 are not
-- touched. Migrations 036-049 are not modified.
--
-- Ratification state when generated: pending_owner_review.
--
-- Provenance is appended to movement_content_correction (created by 049) at
-- correction_version 2, beside any version 1 row: INSERT OR IGNORE, never an
-- UPDATE, never a DELETE.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 001 · Alternate Hammer Curl
-- correction_sha256 983bb2e88bd2502368d8ebcd165fd7a13a090f67040a5fbd66b0664c627c3c56
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand tall with a dumbbell in each hand at arm''s length, elbows close to the body and palms facing the body. Keeping the upper arm still and the palm facing in, curl one dumbbell up to shoulder height. Lower it slowly until the arm is straight, then curl the other side.', cues = 'Palms face in throughout. Upper arms stay still. Lower slowly before the other arm starts.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Alternate Hammer Curl');
UPDATE movement_coaching_intent SET coaching_intent = 'Curl one dumbbell at a time with the palms facing the body.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Alternate Hammer Curl');

-- ---------------------------------------------------------------------------
-- 002 · Alternating Cable Shoulder Press
-- correction_sha256 432fd44b4653c4c7b908a89828c7b598bf787c48e9b182dedb461175f2226a17
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Set both pulleys low, take a handle in each hand and stand tall with the hands at shoulder height and the palms facing forward. Keeping the head and chest up, press one handle straight overhead until the arm is straight. Pause, lower it to shoulder height, then press the other side.', cues = 'Stand tall, ribs down. Wrist stacked over the elbow. Lower to the shoulder before the other side.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Alternating Cable Shoulder Press');
UPDATE movement_coaching_intent SET coaching_intent = 'Press one cable handle overhead at a time from shoulder height.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Alternating Cable Shoulder Press');

-- ---------------------------------------------------------------------------
-- 003 · Alternating Floor Press
-- correction_sha256 63e44b71c7f1ace7855b7448f47b307e385479b789c5b1256a8201c90e76fb7f
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie on the floor and press two kettlebells to straight arms above the chest. Lower one kettlebell toward the chest until that upper arm rests on the floor, while the other arm stays straight. Press it back up beside the other, then lower the opposite side.', cues = 'One arm stays locked out. Lower until the arm rests on the floor. Press back up along the same line.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Alternating Floor Press');
UPDATE movement_coaching_intent SET coaching_intent = 'Lower and press one kettlebell at a time from the floor while the other stays locked out.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Alternating Floor Press');

-- ---------------------------------------------------------------------------
-- 004 · Alternating Kettlebell Press
-- correction_sha256 ff4715bd668dcd0ce342aef6ebac31cd3500b7cae48314a2b97fa00ebcdbd654
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Clean two kettlebells to the shoulders and stand tall with the palms facing in. Press one kettlebell straight overhead until the arm is straight, turning the palm to face forward as it rises, while the other stays at the shoulder. Lower it under control back to the shoulder, then press the other side.', cues = 'Stand tall and squeeze the glutes. One bell moves, the other waits at the shoulder. Finish with the arm straight beside the ear.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Alternating Kettlebell Press');
UPDATE movement_coaching_intent SET coaching_intent = 'Press one kettlebell overhead at a time while the other waits at the shoulder.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Alternating Kettlebell Press');

-- ---------------------------------------------------------------------------
-- 005 · Alternating Kettlebell Row
-- correction_sha256 12926c20bb4ab8478d94075054e8536f8b0c4fb39f66a601144f8037fd6010e0
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand over two kettlebells, bend the knees slightly, push the hips back and take a handle in each hand with the back flat. Pull one kettlebell toward the lower ribs, drawing that shoulder blade back, while the other hand holds its kettlebell on the floor. Lower it under control to the floor, then row the other side.', cues = 'Hips back, back flat. Pull the elbow toward the hip. Keep the chest square to the floor.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Alternating Kettlebell Row');
UPDATE movement_coaching_intent SET coaching_intent = 'Row one kettlebell at a time from a hinged position while the other stays on the floor.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Alternating Kettlebell Row');

-- ---------------------------------------------------------------------------
-- 006 · Back Flyes - With Bands
-- correction_sha256 f16beaba7e4b84a4e9e602970dc1aeead84704e9782cf8e2910bb90c15be6f7d
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Loop a band around a rack upright, take an end in each hand and step back until the band is taut with the arms straight in front at shoulder height. Keeping the arms straight and level with the floor, pull the hands apart and back until the arms are out to the sides. Pause, then let the hands return slowly to the front.', cues = 'Arms straight and level with the floor. Squeeze the shoulder blades together. Return slowly against the band.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Back Flyes - With Bands');
UPDATE movement_coaching_intent SET coaching_intent = 'Open the arms against a band from straight in front to out at the sides to train the rear shoulders and upper back.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Back Flyes - With Bands');

-- ---------------------------------------------------------------------------
-- 007 · Barbell Bench Press - Medium Grip
-- correction_sha256 c36054b866e510a856ef518b451f0f6ed8819ee3e6170454b81fe8004cd8b41b
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie back on a flat bench, take the bar from the rack with a medium-width grip and hold it over the chest with the arms straight. Lower the bar slowly until it touches the middle of the chest. Pause briefly, then press it back up until the arms are straight.', cues = 'Shoulder blades set on the bench. Wrists stacked over the elbows. Lower slowly, press along the same line.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Barbell Bench Press - Medium Grip');
UPDATE movement_coaching_intent SET coaching_intent = 'Press a barbell from the middle of the chest on a flat bench with a medium grip.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Barbell Bench Press - Medium Grip');

-- ---------------------------------------------------------------------------
-- 008 · Barbell Incline Bench Press - Medium Grip
-- correction_sha256 8fea83efd230eab309ab53dd4c4965bfc121d9204c90786bc3ef6bf54b04ee23
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie back on an incline bench, take the bar from the rack with a medium-width grip and hold it over the upper chest with the arms straight. Lower the bar slowly until it reaches the upper chest. Pause, then press it back up until the arms are straight.', cues = 'Chest open, shoulder blades set. Wrists stacked over the elbows. Lower slowly, press along the same line.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Barbell Incline Bench Press - Medium Grip');
UPDATE movement_coaching_intent SET coaching_intent = 'Press a barbell from the upper chest on an incline bench with a medium grip.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Barbell Incline Bench Press - Medium Grip');

-- ---------------------------------------------------------------------------
-- 009 · Barbell Lunge
-- correction_sha256 b4a40330455d789fe414ca5a07ea477f8709a380f7f6fbc1f69f9c9a73ed1d51
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Take the bar from a rack set just below shoulder height so it rests across the upper back, and step clear with the feet hip-width apart. Step forward with one leg and lower the hips straight down under control, keeping the torso upright. Push through the front heel to step back to standing. Complete the repetitions on one leg, then change legs.', cues = 'Torso tall, eyes forward. Front knee in line with the toes. Push through the front heel.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Barbell Lunge');
UPDATE movement_coaching_intent SET coaching_intent = 'Train one leg at a time by stepping forward into a lunge with a barbell across the upper back.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Barbell Lunge');

-- ---------------------------------------------------------------------------
-- 010 · Barbell Rollout from Bench
-- correction_sha256 f9405bb77d9b2932fcc694bbcbebcdf9394645cf869143c6e208e728ce9d1556
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Place a loaded barbell on the floor at the end of a bench, kneel on the bench and grip the bar with the hands about shoulder-width apart. With the arms straight, let the hips extend and roll the bar forward until the arms are reaching overhead as far as you can control. Pull the bar back under the shoulders to return to the start.', cues = 'Arms stay straight. Ribs down, trunk braced. Roll only as far as you can pull back from.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Barbell Rollout from Bench');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the trunk by rolling a barbell away and back while kneeling on a bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Barbell Rollout from Bench');

-- ---------------------------------------------------------------------------
-- 011 · Barbell Squat To A Bench
-- correction_sha256 6b1d5254f22e34e3cb151071a12868d44d85adb45deb6da908b3907e489f630c
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Place a flat bench behind you, take the bar from the rack across the upper back and stand with the feet shoulder-width apart and toes turned slightly out. Bend the knees and sit the hips back, chest up, until you lightly touch the bench. Drive through the feet to stand back up without resting on the bench.', cues = 'Sit the hips back to the bench. Touch lightly, stay tight. Chest up, knees in line with the toes.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Barbell Squat To A Bench');
UPDATE movement_coaching_intent SET coaching_intent = 'Squat with a barbell across the upper back, sitting the hips back until they lightly touch a bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Barbell Squat To A Bench');

-- ---------------------------------------------------------------------------
-- 012 · Bent Over Barbell Row
-- correction_sha256 7b83cfc2760a8242f6e5cfa038a9abd2cfb328e1109bfa1a1c3c0689c447e738
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Hold a barbell with an overhand grip, bend the knees slightly and hinge forward with the back straight until the torso is almost level with the floor and the bar hangs under the shoulders. Keeping the torso still and the elbows close to the body, pull the bar up to the body. Squeeze the back, then lower the bar slowly to a full hang.', cues = 'Back straight, torso still. Lead with the elbows. Lower to a full hang.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Bent Over Barbell Row');
UPDATE movement_coaching_intent SET coaching_intent = 'Row a barbell to the body from a bent-over position with the torso held still.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Bent Over Barbell Row');

-- ---------------------------------------------------------------------------
-- 013 · Bent Over One-Arm Long Bar Row
-- correction_sha256 c95cf556f95717da8991c35ea307266e8b2dd35727c369cd3083b86e3ef49246
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Load one end of a barbell and brace the other end in a corner or against something heavy, then hinge forward with the knees slightly bent, grip the bar just behind the plates with one hand and rest the other hand on the knee. Keeping the torso still and the elbow in, pull the bar straight up until the plates reach the lower chest. Squeeze, then lower slowly without letting the plates rest on the floor. Complete the repetitions, then change arms.', cues = 'Torso stays still. Elbow close to the body. Lower to a full stretch.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Bent Over One-Arm Long Bar Row');
UPDATE movement_coaching_intent SET coaching_intent = 'Row the loaded end of a barbell with one arm while the other end is braced on the floor.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Bent Over One-Arm Long Bar Row');

-- ---------------------------------------------------------------------------
-- 014 · Bent Over Two-Dumbbell Row
-- correction_sha256 dd34af0e9edfd1196b4e03574ee44ad7dd9f0d13155d02a718b5da4b89053ef2
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Hold a dumbbell in each hand with the palms facing the body, bend the knees slightly and hinge forward with the back straight until the torso is almost level with the floor and the arms hang straight down. Keeping the torso still and the elbows close to the body, pull the dumbbells up to your sides. Squeeze the back, then lower slowly to a full hang.', cues = 'Back flat, torso still. Pull the elbows back past the ribs. Lower to a full hang.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Dumbbell Row');
UPDATE movement_coaching_intent SET coaching_intent = 'Row two dumbbells to the sides of the body from a bent-over position.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Dumbbell Row');

-- ---------------------------------------------------------------------------
-- 015 · Bent Over Two-Dumbbell Row With Palms In
-- correction_sha256 48541795094ea24b93ffd2c5771e8aa16592511df15abeba4c492adba6d5d763
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Hold a dumbbell in each hand with the palms facing each other, bend the knees slightly and hinge forward with the back straight until the torso is almost level with the floor and the arms hang straight down. Keeping the torso still, pull the dumbbells up to your sides and squeeze the shoulder blades together. Pause, then lower slowly to a full hang.', cues = 'Palms face each other. Squeeze the shoulder blades together. Lower to a full hang.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Dumbbell Row With Palms In');
UPDATE movement_coaching_intent SET coaching_intent = 'Row two dumbbells from a bent-over position with the palms facing each other.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Dumbbell Row With Palms In');

-- ---------------------------------------------------------------------------
-- 016 · Bent-Arm Barbell Pullover
-- correction_sha256 fd73b8a844671caa1b80f2c7c6905f7aba3b655e3ced792693a76b3f566d6013
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie on a flat bench holding a barbell with a shoulder-width grip over the chest, elbows bent. Keeping the same bend in the elbows, lower the bar in an arc behind the head until you feel a stretch across the chest. Pull the bar back along the same arc to the start and pause over the chest.', cues = 'Keep the elbow bend fixed. Lower in a smooth arc. Ribs down as the bar travels back.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Bent-Arm Barbell Pullover');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the lats and chest by lowering a barbell in an arc behind the head with the elbows bent.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Bent-Arm Barbell Pullover');

-- ---------------------------------------------------------------------------
-- 017 · Body Tricep Press
-- correction_sha256 4fde4fc9a83557843be86c463e3000e05a7bb86a7ca7d46745433b805ffd4a7a
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Fix a bar in a rack at chest height, take a shoulder-width grip and walk the feet back until the body leans on straight arms in one line. Bend the elbows to lower yourself toward the bar, keeping the body straight. Pause, then straighten the elbows to return to the start.', cues = 'Body in one straight line. Elbows bend, shoulders stay still. Press back to straight arms.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Body Tricep Press');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the triceps by lowering the body toward a fixed bar and pressing back with the elbows.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Body Tricep Press');

-- ---------------------------------------------------------------------------
-- 018 · Cable Incline Triceps Extension
-- correction_sha256 239a44772e0ee8e292e9f4c589a8987ff40d5950777f9ba09ba2e3f9bc2e0cd9
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie back on an incline bench facing away from a high pulley and take the straight bar overhead with a narrow overhand grip, elbows bent and tucked in. Keeping the upper arms still, straighten the elbows until the arms are fully extended. Pause, then let the bar return slowly until the elbows are bent again.', cues = 'Upper arms stay still. Elbows tucked in. Squeeze the triceps at full extension.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cable Incline Triceps Extension');
UPDATE movement_coaching_intent SET coaching_intent = 'Straighten the elbows against a high cable while lying on an incline bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cable Incline Triceps Extension');

-- ---------------------------------------------------------------------------
-- 019 · Cable Lying Triceps Extension
-- correction_sha256 cde27da676b229c1ff322f698d01d0c5fc0c615dd6deb5d96a81ee84aef00df9
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie on a flat bench with your head toward a low pulley and hold the straight bar with a narrow overhand grip, arms straight above the chest. Keeping the upper arms still and the elbows in, bend the elbows to lower the bar until it is just above the forehead. Straighten the elbows to return the bar above the chest and pause.', cues = 'Upper arms point at the ceiling. Elbows in. Lower slowly to the forehead line.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cable Lying Triceps Extension');
UPDATE movement_coaching_intent SET coaching_intent = 'Bend and straighten the elbows against a low cable while lying on a flat bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cable Lying Triceps Extension');

-- ---------------------------------------------------------------------------
-- 020 · Cable Preacher Curl
-- correction_sha256 ab65c17523862442e634918451f39945361adf37ae482d0cab3a8f7c1d871947
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Set a preacher bench in front of a low pulley, sit with the upper arms flat on the pad and hold the straight bar with an underhand grip, arms extended. Keeping the upper arms on the pad, curl the bar up toward the shoulders. Squeeze, then lower slowly until the arms are extended.', cues = 'Upper arms stay flat on the pad. Curl to shoulder height. Lower slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cable Preacher Curl');
UPDATE movement_coaching_intent SET coaching_intent = 'Curl a low cable bar with the upper arms supported on a preacher bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cable Preacher Curl');

-- ---------------------------------------------------------------------------
-- 021 · Cable Russian Twists
-- correction_sha256 e1f35282fda40304dcea30099c9c22b4a33742fd55315ff5b22ed67dbaec2a69
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Set the pulley at mid height, lie with the upper back on a stability ball side-on to the cable and hold the handle in both hands with the arms straight above the chest and the hips raised. Keeping the hips up and the arms straight, turn the torso away from the pulley through a quarter turn. Pause, then return slowly to the start with tension still on the cable. Complete the repetitions, then turn around and repeat on the other side.', cues = 'Hips stay raised. Arms straight, turn from the ribs. Return slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cable Russian Twists');
UPDATE movement_coaching_intent SET coaching_intent = 'Rotate the torso away from a cable with straight arms while bridging on a stability ball.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cable Russian Twists');

-- ---------------------------------------------------------------------------
-- 022 · Cable Seated Crunch
-- correction_sha256 af391ebf525a1477e59715744b0206ce2c626cf008fab4aad5bd1d159e35974f
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Sit on a flat bench with your back to a high pulley and hold the rope ends over the shoulders against the upper chest. Keeping the hips still, curl the torso forward so the elbows travel toward the hips. Pause, then return slowly to sitting tall.', cues = 'Hips stay still. Curl the ribs toward the hips. Return slowly against the cable.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cable Seated Crunch');
UPDATE movement_coaching_intent SET coaching_intent = 'Crunch the torso forward against a high cable while seated with your back to the machine.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cable Seated Crunch');

-- ---------------------------------------------------------------------------
-- 023 · Cable Seated Lateral Raise
-- correction_sha256 35b59b21f4610803d1fbfeb7f38401e0d304a4b30f155b444ce0d59277fd2c6f
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Sit on the end of a flat bench between two low pulleys, lean forward so the chest rests toward the thighs with the back flat, and hold the left handle in the right hand and the right handle in the left. With a slight, fixed bend in the elbows, raise the upper arms out to the sides until they are level with the shoulders. Pause, then lower the arms slowly to the start.', cues = 'Back flat, chest toward the thighs. Lead with the elbows. Keep the elbow bend fixed.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cable Seated Lateral Raise');
UPDATE movement_coaching_intent SET coaching_intent = 'Raise the arms out to the sides against crossed low cables while seated and leaning forward.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cable Seated Lateral Raise');

-- ---------------------------------------------------------------------------
-- 024 · Cable Wrist Curl
-- correction_sha256 4c1bbbff856f0f6de51c13801f7db12e947c4c3fe14272206c4e05f8b4e3e427
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Sit on a bench facing a low pulley, grip the straight bar palms-up at about shoulder width and rest the forearms on the thighs with the wrists just past the knees. Keeping the forearms still, curl the wrists up as far as they go. Pause, then lower the bar slowly until the wrists are extended again.', cues = 'Forearms stay on the thighs. Only the wrists move. Lower slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cable Wrist Curl');
UPDATE movement_coaching_intent SET coaching_intent = 'Curl the wrists against a low cable with the forearms resting on the thighs.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cable Wrist Curl');

-- ---------------------------------------------------------------------------
-- 025 · Clock Push-Up
-- correction_sha256 98dfc34280fce2c9239a2f7d12e49fe5be3fd8635913ab4937c71aaa64bcd4dd
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Start in a push-up position with the hands about shoulder-width apart and the body in a straight line. Lower the chest toward the floor, then push up fast enough for the hands to leave the floor and land a short step to one side, turning the body slightly. Land with soft elbows, reset the straight body line and repeat, working around the circle until you are back where you started.', cues = 'Body in one straight line. Push the floor away fast. Land softly with bent elbows.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Clock Push-Up');
UPDATE movement_coaching_intent SET coaching_intent = 'Build explosive pressing by pushing off the floor and landing a little further around a circle each repetition.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Clock Push-Up');

-- ---------------------------------------------------------------------------
-- 026 · Close-Grip EZ Bar Curl
-- correction_sha256 8ca91f37cc070afabebfcde978890023ae2b4e0fb72a63a706c933368e299170
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand tall holding an EZ bar on the inner grips with the palms facing forward and the elbows close to the body. Keeping the upper arms still, curl the bar up to shoulder height. Squeeze, then lower slowly until the arms are straight.', cues = 'Elbows stay beside the ribs. Upper arms stay still. Lower slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Close-Grip EZ Bar Curl');
UPDATE movement_coaching_intent SET coaching_intent = 'Curl an EZ bar with the hands on the inner grips.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Close-Grip EZ Bar Curl');

-- ---------------------------------------------------------------------------
-- 027 · Close-Grip EZ-Bar Press
-- correction_sha256 679a70a2bdf9624260c1776c2410d39d525e241dbdf45ead99bd6ef1aeba295b
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie on a flat bench holding an EZ bar with a narrow grip, arms straight above the chest and elbows in. Keeping the elbows close to the body, lower the bar to the lower chest. Press the bar back up until the arms are straight.', cues = 'Elbows close to the ribs. Shoulder blades set on the bench. Press along the same line.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Close-Grip EZ-Bar Press');
UPDATE movement_coaching_intent SET coaching_intent = 'Press an EZ bar from the lower chest with a narrow grip to train the triceps.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Close-Grip EZ-Bar Press');

-- ---------------------------------------------------------------------------
-- 028 · Close-Grip Front Lat Pulldown
-- correction_sha256 8cb64a2903eab5dacafce3fe9e83a5834725f47aaf76ff2712b9fa0944de247b
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Sit at a pulldown station with the knee pad snug, take the bar with the palms facing forward and the hands closer than shoulder width, and lean back slightly with the chest up. Draw the shoulders and upper arms down and back to pull the bar to the upper chest. Squeeze the back, then let the bar rise slowly until the arms are straight.', cues = 'Chest up to meet the bar. Pull through the elbows. Return slowly to a full reach.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Close-Grip Front Lat Pulldown');
UPDATE movement_coaching_intent SET coaching_intent = 'Pull a high bar down to the upper chest with the hands closer than shoulder width.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Close-Grip Front Lat Pulldown');

-- ---------------------------------------------------------------------------
-- 029 · Close-Grip Push-Up off of a Dumbbell
-- correction_sha256 cb655349b3edac72c2a493c906ca90e7111d36c54e20665da783ed741efba432
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand a dumbbell on its end, place both hands on the top of it and set a push-up position on the toes with the arms straight and the body rigid. Bend the elbows, keeping them close to the body, to lower the chest toward the hands. Press back up until the arms are straight.', cues = 'Elbows brush the ribs. Hips level with the shoulders. Press the dumbbell into the floor.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Close-Grip Push-Up off of a Dumbbell');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the triceps with a push-up performed with both hands close together on an upright dumbbell.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Close-Grip Push-Up off of a Dumbbell');

-- ---------------------------------------------------------------------------
-- 030 · Concentration Curls
-- correction_sha256 3668ceeb4031e64a07d398827cc6c10035f4722fd03adcfb755b8445eda1b412
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Sit on a flat bench with the feet wide, hold one dumbbell and rest the back of that upper arm against the inner thigh with the arm straight and the palm facing forward. Keeping the upper arm still, curl the dumbbell up toward the shoulder. Squeeze, then lower slowly until the arm is straight. Complete the repetitions, then change arms.', cues = 'Upper arm stays on the thigh. Only the forearm moves. Lower slowly to a straight arm.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Concentration Curls');
UPDATE movement_coaching_intent SET coaching_intent = 'Curl one dumbbell at a time with the upper arm braced against the inner thigh.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Concentration Curls');

-- ---------------------------------------------------------------------------
-- 031 · Cross Body Hammer Curl
-- correction_sha256 e72dcef3a35654897c0fd168a0e099a5bba3905bb4d8fc85532e92ea0a6959cf
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand tall with a dumbbell in each hand at your sides, palms facing in. Keeping the palm facing in, curl one dumbbell across the body toward the opposite shoulder. Pause, lower it slowly along the same path, then curl the other side.', cues = 'Palm faces in throughout. Upper arm stays close to the body. Lower along the same path.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cross Body Hammer Curl');
UPDATE movement_coaching_intent SET coaching_intent = 'Curl one dumbbell at a time across the body toward the opposite shoulder with the palm facing in.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cross Body Hammer Curl');

-- ---------------------------------------------------------------------------
-- 032 · Cross-Body Crunch
-- correction_sha256 48291c4b622360c84697a6b18ee0a9901e210edb55b9e959d19fd6ac1cff6a92
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie on your back with the knees bent and the feet flat, hands resting lightly behind the head. Curl up and turn so one elbow and shoulder travel across the body while the opposite knee comes in to meet them. Lower slowly to the start, then repeat to the other side.', cues = 'Lead with the shoulder. Curl the ribs toward the hips. Lower slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cross-Body Crunch');
UPDATE movement_coaching_intent SET coaching_intent = 'Crunch up with a twist so one elbow travels toward the opposite knee, alternating sides.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cross-Body Crunch');

-- ---------------------------------------------------------------------------
-- 033 · Crunch - Hands Overhead
-- correction_sha256 eacc443fa804479baa6c2366c2c32a50363466fed13e0821a3f6d92a219021f7
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie on your back with the knees bent and the feet flat, arms stretched overhead with the hands together. Keeping the arms in line with the head, curl the upper body up until the shoulder blades are just off the floor. Pause, then lower slowly to the start.', cues = 'Arms stay in line with the head. Curl the ribs toward the hips. Lower slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Crunch - Hands Overhead');
UPDATE movement_coaching_intent SET coaching_intent = 'Crunch with the arms held straight overhead in line with the head.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Crunch - Hands Overhead');

-- ---------------------------------------------------------------------------
-- 034 · Deadlift with Bands
-- correction_sha256 44e3ed41a440e9c079bdef24bd5719917bfb908eadbb346f14274ffcdc327706
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Loop the bands over the bar and anchor them under the feet or to a secure base, then stand with the bar over the middle of the feet and grip it just outside the legs. Take a breath, bring the shins to the bar with the chest up and the back flat, and drive through the feet to lift the bar. As the bar passes the knees, bring the hips forward to stand tall against the band tension. Lower by pushing the hips back and guiding the bar down the legs to the floor.', cues = 'Chest up, back flat. Bar stays against the legs. Stand tall into the bands.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Deadlift with Bands');
UPDATE movement_coaching_intent SET coaching_intent = 'Deadlift a barbell with bands adding resistance as the bar rises.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Deadlift with Bands');

-- ---------------------------------------------------------------------------
-- 035 · Decline Close-Grip Bench To Skull Crusher
-- correction_sha256 038b88d5ae32fbf03e924776c3de8d42027714af5974afe5d7e32c3f4dd1b52c
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Secure the legs on a decline bench, lie back and hold the bar over the chest with a grip slightly narrower than shoulder width and the arms straight. Lower the bar to the lower chest with the elbows in and press it back up. Then, keeping the upper arms still, bend the elbows to lower the bar toward the forehead and straighten them again. Alternate one press and one extension for the set.', cues = 'Elbows in on the press. Upper arms still on the extension. Lower slowly each time.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Decline Close-Grip Bench To Skull Crusher');
UPDATE movement_coaching_intent SET coaching_intent = 'Pair a close-grip press with a lying triceps extension on a decline bench, one after the other.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Decline Close-Grip Bench To Skull Crusher');

-- ---------------------------------------------------------------------------
-- 036 · Decline Dumbbell Flyes
-- correction_sha256 92a34494768c3e78d9ad769a15486a0b7d0ffcf3effe9113ec74ecc070c68f0c
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Secure the legs on a decline bench, lie back and hold a dumbbell in each hand above the chest with the palms facing each other and the arms almost straight. With a slight, fixed bend in the elbows, lower the arms out to the sides in a wide arc until you feel a stretch across the chest. Bring the dumbbells back together above the chest along the same arc.', cues = 'Keep the elbow bend fixed. Open wide, slowly. Squeeze the chest to close.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Decline Dumbbell Flyes');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the chest by opening and closing the arms in a wide arc on a decline bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Decline Dumbbell Flyes');

-- ---------------------------------------------------------------------------
-- 037 · Decline Dumbbell Triceps Extension
-- correction_sha256 7c7b22772ea6b1acd52ff70a5675ab4161e0e5891f49f4cf202ba7e77ecf25c1
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Secure the legs on a decline bench, lie back and hold a dumbbell in each hand above the chest with the palms facing each other and the arms straight. Keeping the upper arms still and the elbows in, bend the elbows to lower the dumbbells beside the ears. Straighten the elbows to return the dumbbells above the chest.', cues = 'Upper arms stay still. Elbows point at the ceiling. Lower slowly beside the ears.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Decline Dumbbell Triceps Extension');
UPDATE movement_coaching_intent SET coaching_intent = 'Bend and straighten the elbows with two dumbbells while lying on a decline bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Decline Dumbbell Triceps Extension');

-- ---------------------------------------------------------------------------
-- 038 · Decline EZ Bar Triceps Extension
-- correction_sha256 7c2fa43838fe96ab0fa237959774f1f795373041b068ef92c92b310f260f6615
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Secure the legs on a decline bench, lie back and hold the EZ bar above the chest with a grip slightly narrower than shoulder width and the arms straight. Keeping the upper arms still, bend the elbows to lower the bar toward the forehead. Straighten the elbows to return the bar above the chest.', cues = 'Upper arms stay still. Elbows in. Lower slowly toward the forehead.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Decline EZ Bar Triceps Extension');
UPDATE movement_coaching_intent SET coaching_intent = 'Bend and straighten the elbows with an EZ bar while lying on a decline bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Decline EZ Bar Triceps Extension');

-- ---------------------------------------------------------------------------
-- 039 · Decline Oblique Crunch
-- correction_sha256 f7d8f16084a13816464b0f3b729e76f1004a812a2408d40c50dc742ef3b38ec2
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Secure the legs on a decline bench and lean back until the torso is partway down, one hand beside the head and the other on the thigh. Curl the torso up while turning it so the raised elbow travels toward the opposite knee. Pause, then lower slowly to the start. Complete the repetitions on one side, then change sides.', cues = 'Turn the ribs, lead with the shoulder. Move slowly both ways. Keep the abdominals tight throughout.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Decline Oblique Crunch');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the obliques by crunching up with a twist on a decline bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Decline Oblique Crunch');

-- ---------------------------------------------------------------------------
-- 040 · Decline Push-Up
-- correction_sha256 e12c290861d3b20a7bb6e87d949b3c910f559f8b4743cebf5b953d2cdf3a7fb8
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Place the hands on the floor a little wider than the shoulders and the feet up on a bench, arms straight and the body in one line. Bend the elbows to lower the chest until it is just above the floor. Press back up until the arms are straight.', cues = 'Body in one straight line. Chest to just above the floor. Push the floor away.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Decline Push-Up');
UPDATE movement_coaching_intent SET coaching_intent = 'Perform a push-up with the feet raised on a bench to shift more load onto the shoulders and upper chest.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Decline Push-Up');

-- ---------------------------------------------------------------------------
-- 041 · Decline Reverse Crunch
-- correction_sha256 beb5ecdc74435df235a62e7c96902eed075429b9a7e9e62947982c6fa2b71dc5
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie on a decline bench with the head at the high end, hold the top of the bench and raise the legs, knees slightly bent, until they are level with the floor. Draw the knees toward the chest and roll the pelvis so the hips lift off the bench. Pause, then lower the hips and return the legs slowly to the start.', cues = 'Roll the hips up off the bench. Hold the bench firmly. Lower the legs slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Decline Reverse Crunch');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the lower abdominals by curling the hips up toward the chest on a decline bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Decline Reverse Crunch');

-- ---------------------------------------------------------------------------
-- 042 · Dumbbell Bicep Curl
-- correction_sha256 6a819e9c8a4e3fd4410a98a9eed19bfa936b462aea0cc14e7dfe266fde614dd5
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand tall with a dumbbell in each hand at arm''s length, elbows close to the body and palms facing forward. Keeping the upper arms still, curl the dumbbells up to shoulder height. Squeeze, then lower slowly until the arms are straight.', cues = 'Elbows stay beside the ribs. Upper arms stay still. Lower slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Dumbbell Bicep Curl');
UPDATE movement_coaching_intent SET coaching_intent = 'Curl two dumbbells with the palms facing forward.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Dumbbell Bicep Curl');

-- ---------------------------------------------------------------------------
-- 043 · Dumbbell One-Arm Shoulder Press
-- correction_sha256 52b4d273854e86cc7c9709c8b562830cc8f79ca179ddcc8e8a8b4947d5c11d62
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Sit on a bench with back support or stand tall, and bring one dumbbell to shoulder height with the palm facing forward and the other hand at your side or on a fixed support. Press the dumbbell straight up until the arm is straight. Pause, then lower it slowly to shoulder height. Complete the repetitions, then change arms.', cues = 'Ribs down, trunk tall. Press straight up. Lower slowly to the shoulder.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Dumbbell One-Arm Shoulder Press');
UPDATE movement_coaching_intent SET coaching_intent = 'Press one dumbbell overhead at a time, seated with back support or standing.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Dumbbell One-Arm Shoulder Press');

-- ---------------------------------------------------------------------------
-- 044 · Dumbbell Prone Incline Curl
-- correction_sha256 47452a4fd20796dd21944fbea062d7333abbf1ec9ba078a1174901e1e7fa2ce9
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie face down on an incline bench with the shoulders near the top and a dumbbell in each hand, arms hanging straight down and palms facing forward. Keeping the upper arms still, curl the dumbbells up until the elbows are fully bent. Lower slowly until the arms are straight again.', cues = 'Chest stays on the bench. Upper arms hang straight down. Lower to a full stretch.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Dumbbell Prone Incline Curl');
UPDATE movement_coaching_intent SET coaching_intent = 'Curl two dumbbells while lying face down on an incline bench so the upper arms hang straight down.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Dumbbell Prone Incline Curl');

-- ---------------------------------------------------------------------------
-- 045 · Dumbbell Seated One-Leg Calf Raise
-- correction_sha256 561668fef745691e845ad1eabd3045d20f7dee3013f7ed7f3a28931031d282be
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Sit on a flat bench with the ball of one foot on a low block and a dumbbell resting on that thigh just above the knee. Let the heel drop into a stretch, then raise it as high as the ankle allows. Pause, then lower the heel slowly into the stretch. Complete the repetitions, then change legs.', cues = 'Ball of the foot stays on the block. Rise as high as the ankle allows. Lower slowly into the stretch.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Dumbbell Seated One-Leg Calf Raise');
UPDATE movement_coaching_intent SET coaching_intent = 'Train one calf at a time by raising the heel while seated with a dumbbell resting on the thigh.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Dumbbell Seated One-Leg Calf Raise');

-- ---------------------------------------------------------------------------
-- 046 · Dumbbell Squat To A Bench
-- correction_sha256 1b3a7baa79394ff98d3b2ab9b7df0a978616f2f1fd32dc545e99bbb594ba3bd7
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand in front of a flat bench with a dumbbell in each hand at your sides, feet shoulder-width apart and toes turned slightly out. Bend the knees and sit the hips back, chest up, until you lightly touch the bench. Push through the feet to stand back up without resting on the bench.', cues = 'Sit back to the bench. Touch lightly, stay tight. Chest up, eyes forward.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Dumbbell Squat To A Bench');
UPDATE movement_coaching_intent SET coaching_intent = 'Squat with a dumbbell in each hand, lowering until the hips lightly touch a bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Dumbbell Squat To A Bench');

-- ---------------------------------------------------------------------------
-- 047 · EZ-Bar Curl
-- correction_sha256 81bb379e1803c994b4cdd15e67868d5ad6ce4702568e2d6efc33762960c5e1b7
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand tall holding an EZ bar on the wide outer grips with the palms facing forward and the elbows close to the body. Keeping the upper arms still, curl the bar up to shoulder height. Squeeze, then lower slowly until the arms are straight.', cues = 'Elbows stay beside the ribs. Upper arms stay still. Lower slower than you lift.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'EZ-Bar Curl');
UPDATE movement_coaching_intent SET coaching_intent = 'Curl an EZ bar with the hands on the wide outer grips.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'EZ-Bar Curl');

-- ---------------------------------------------------------------------------
-- 048 · Elevated Back Lunge
-- correction_sha256 a79cce0952d3e49a6d67a63a85a042d53c120de09e2d95fada9e1dcc71de670d
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Take the bar from the rack across the upper back and stand with both feet on a low, stable platform. Step back off the platform with one leg and lower until the back knee reaches the floor. Drive through the front leg to return to the platform, then repeat with the other leg.', cues = 'Back tight, chest up. Lower under control. Drive through the front foot.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Elevated Back Lunge');
UPDATE movement_coaching_intent SET coaching_intent = 'Step back off a low platform into a lunge with a barbell across the upper back.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Elevated Back Lunge');

-- ---------------------------------------------------------------------------
-- 049 · Elevated Cable Rows
-- correction_sha256 6165e596401ad448514053a99e6e9d15c5e718780b794dcebbbc0661d8e21de4
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Place a low platform on the seat of a cable row station, sit on it with the feet on the foot plate and the knees slightly bent, and hold the V-handle with the arms straight and the torso upright. Keeping the torso still and the arms close to the body, pull the handle to the stomach. Squeeze the back, then let the handle return slowly until the arms are straight.', cues = 'Torso stays upright and still. Elbows close to the body. Return slowly to a full reach.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Elevated Cable Rows');
UPDATE movement_coaching_intent SET coaching_intent = 'Row a low cable to the stomach while seated on a raised platform to lengthen the pull.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Elevated Cable Rows');

-- ---------------------------------------------------------------------------
-- 050 · Flat Bench Cable Flyes
-- correction_sha256 93de66b253b22178a5c1fa20e57e5a4c84e2999f2c0438204b27ea5b96a9255b
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Set a flat bench between two low pulleys so the pulleys line up with the chest, lie back and hold a handle in each hand, arms out to the sides with a slight bend in the elbows. Keeping that elbow bend fixed, bring the hands together in an arc until they meet above the chest. Pause, then lower the arms slowly back out to the sides.', cues = 'Keep the elbow bend fixed. Hands meet above the chest. Open slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Flat Bench Cable Flyes');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the chest by bringing two low cables together above the chest while lying on a flat bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Flat Bench Cable Flyes');

-- ---------------------------------------------------------------------------
-- 051 · Floor Press
-- correction_sha256 276ac12ff86eafe62dffa025780633363427a14d851820035f9eab0545252328
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie on the floor with your head inside a rack, the bar set on low hooks, shoulder blades pulled together, and lift the bar off with straight arms. Lower the bar toward the lower chest with the elbows tucked until the upper arms rest on the floor, and pause. Press the bar back up, keeping the bar, wrists and elbows in line.', cues = 'Shoulder blades pulled together. Pause with the arms on the floor. Wrists stacked over the elbows.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Floor Press');
UPDATE movement_coaching_intent SET coaching_intent = 'Press a barbell from the floor, with the upper arms stopping on the ground at the bottom of each repetition.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Floor Press');

-- ---------------------------------------------------------------------------
-- 052 · Frog Sit-Ups
-- correction_sha256 04f80d4364b1a9b8143cdb15078b579e98661fcf60a1a80060aea1abac8f9c8b
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie on your back with the soles of the feet together and the knees dropped out to the sides, arms crossed over the chest. Flatten the lower back to the floor and curl the head and shoulders up a short way. Pause, then lower slowly to the floor.', cues = 'Lower back presses into the floor. Curl up a short way. Lower slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Frog Sit-Ups');
UPDATE movement_coaching_intent SET coaching_intent = 'Curl the torso up a short way with the soles of the feet together and the knees dropped out to the sides.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Frog Sit-Ups');

-- ---------------------------------------------------------------------------
-- 053 · Front Cable Raise
-- correction_sha256 ba9385a68ece1512e07ed7b4dcd29bb001f3053b4762a299ee9ea187d794c8ab
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand facing away from a low pulley holding the single handle in one hand in front of the thigh, palm facing the thigh. Keeping the torso still and a slight bend in the elbow, raise the arm to the front until it is just above level with the floor. Pause, then lower slowly to the start. Complete the repetitions, then change arms.', cues = 'Torso stays still. Raise to just above shoulder height. Lower slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Front Cable Raise');
UPDATE movement_coaching_intent SET coaching_intent = 'Raise one arm to the front against a low cable to train the front of the shoulder.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Front Cable Raise');

-- ---------------------------------------------------------------------------
-- 054 · Front Squat (Clean Grip)
-- correction_sha256 0b333e1816a7032aa155c7b98e2551d50f518c2a01714c6dbbdd80b52621c0cd
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Set the bar in a rack just below shoulder height, rest it on the front of the shoulders with the fingertips under the bar and the elbows high, then step back with the feet shoulder-width apart. Keeping the elbows and chest up, bend the knees and sit straight down between the legs as deep as you can control. Drive through the middle of the feet to stand back up.', cues = 'Elbows high. Chest up, sit straight down. Knees track over the toes.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Front Squat (Clean Grip)');
UPDATE movement_coaching_intent SET coaching_intent = 'Squat with the bar resting on the front of the shoulders, held in place with a clean grip and high elbows.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Front Squat (Clean Grip)');

-- ---------------------------------------------------------------------------
-- 055 · Full Range-Of-Motion Lat Pulldown
-- correction_sha256 f91ad5e56eda39c4bb62a8ef53bb9e108ada4eb084ff8f430ac6e8a6aa101320
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Sit on a high bench or stand between two high pulleys and take the opposite handle in each hand so the arms are crossed overhead with the palms facing forward. With the chest up, pull the handles down in an arc, turning the hands so the palms face each other at the bottom. Return slowly along the same arc until the arms are crossed overhead again.', cues = 'Chest up. Pull the elbows down and in. Return slowly to a full stretch.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Full Range-Of-Motion Lat Pulldown');
UPDATE movement_coaching_intent SET coaching_intent = 'Pull two crossed high cables down through a long arc, turning the palms in as the hands come down.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Full Range-Of-Motion Lat Pulldown');

-- ---------------------------------------------------------------------------
-- 056 · Good Morning off Pins
-- correction_sha256 7d26e9d24328ecbdf2647636a5c0455434e37e844d837f1c0b03c2b77ec7c85d
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Set the bar on the pins at about stomach height, bend over under it so it sits across the back of the shoulders, with the torso near level with the floor, the back tight and the knees slightly bent. Drive the hips forward to stand up with the bar. Push the hips back to lower the bar slowly to the pins and let it settle before the next repetition.', cues = 'Back tight, shoulder blades pinched. Drive the hips forward. Lower slowly to the pins.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Good Morning off Pins');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the hamstrings, glutes and lower back by standing up with a bar from a bent-over start on the rack pins.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Good Morning off Pins');

-- ---------------------------------------------------------------------------
-- 057 · Gorilla Chin/Crunch
-- correction_sha256 b7cdd7557250d0c778fd41b20947869a554935f2b21abb4a177e6c679c0edead
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Hang from a bar with an underhand grip slightly wider than the shoulders and bend the knees so the shins are level with the floor. Pull yourself up while drawing the knees up, finishing with the knees at chest height and the nose level with the bar. Lower slowly to a full hang with the knees bent as at the start.', cues = 'Pull and crunch together. Knees to the chest. Lower slowly to a full hang.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Gorilla Chin/Crunch');
UPDATE movement_coaching_intent SET coaching_intent = 'Combine a chin-up with a knee raise so the knees and chest meet at the top.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Gorilla Chin/Crunch');

-- ---------------------------------------------------------------------------
-- 058 · High Cable Curls
-- correction_sha256 2f90bdd2d7fb2fa9ec40c668ba97dca8a72af4d02f3e1adeb4d4185c32a5b24b
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand between two high pulleys holding a handle in each hand, upper arms out to the sides at shoulder height and palms facing you. Keeping the upper arms still, curl the handles in toward the ears. Squeeze, then straighten the arms slowly.', cues = 'Upper arms level with the floor. Curl the hands to the ears. Straighten slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'High Cable Curls');
UPDATE movement_coaching_intent SET coaching_intent = 'Curl two high cable handles toward the ears with the upper arms held out at shoulder height.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'High Cable Curls');

-- ---------------------------------------------------------------------------
-- 059 · Incline Barbell Triceps Extension
-- correction_sha256 e13c8abda2652d601cb93fa46e671eba9cca4d481a08068ffa324d451a5f665a
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie back on an incline bench holding a barbell overhead with an overhand grip slightly narrower than the shoulders, arms straight and in line with the torso. Keeping the upper arms still and close to the head, bend the elbows to lower the bar behind the head. Straighten the elbows to return the bar overhead and pause.', cues = 'Upper arms close to the head. Only the forearms move. Lower slowly behind the head.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Incline Barbell Triceps Extension');
UPDATE movement_coaching_intent SET coaching_intent = 'Bend and straighten the elbows with a barbell overhead while lying back on an incline bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Incline Barbell Triceps Extension');

-- ---------------------------------------------------------------------------
-- 060 · Incline Cable Flye
-- correction_sha256 65985ed39b8beb2c3174f535ef0647d66be2295fd2d1b5a1b10c6f203d24461d
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Set an incline bench between two low pulleys, lie back with a handle in each hand and bring the hands together at arm''s length above the face. With a slight, fixed bend in the elbows, lower the arms out to the sides in a wide arc until you feel a stretch across the chest. Bring the hands back together along the same arc and pause.', cues = 'Keep the elbow bend fixed. Open wide, slowly. Squeeze the chest to close.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Incline Cable Flye');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the chest by opening and closing the arms against two low cables on an incline bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Incline Cable Flye');

-- ---------------------------------------------------------------------------
-- 061 · Incline Dumbbell Curl
-- correction_sha256 adef02778643ce04e804295277c21d4b11865cede653ed7ee19dbe337a307f82
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Sit back on an incline bench with a dumbbell in each hand, arms hanging straight down, elbows close to the body and palms facing forward. Keeping the upper arms still, curl the dumbbells up to shoulder height. Pause, then lower slowly until the arms are straight.', cues = 'Back stays on the bench. Upper arms hang still. Lower to a full stretch.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Curl');
UPDATE movement_coaching_intent SET coaching_intent = 'Curl two dumbbells from a stretched start while sitting back on an incline bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Curl');

-- ---------------------------------------------------------------------------
-- 062 · Incline Dumbbell Flyes
-- correction_sha256 2a6302171baaa6763f401ccd6ac0aa0c168e7079ab33d33d850b4cce5e7dec1b
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie back on a bench set to a low incline holding a dumbbell in each hand above the chest, arms almost straight. Keeping the same slight bend in the elbows, lower the arms out to the sides in a wide arc until you feel a stretch across the chest. Bring the dumbbells back up along the same arc to the start.', cues = 'Keep the elbow bend fixed. Move only at the shoulders. Lower slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Flyes');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the chest by opening and closing the arms with two dumbbells on a low incline bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Flyes');

-- ---------------------------------------------------------------------------
-- 063 · Incline Hammer Curls
-- correction_sha256 5ef82e84bcd9af052bf31ce89413be32891b3e61c698de3136021fc2c26f6cb3
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Sit back on an incline bench with a dumbbell in each hand, arms hanging straight down and palms facing each other. Keeping the upper arms still and the palms facing in, bend the elbows to curl the dumbbells up. Pause at the top, then lower slowly until the arms are straight.', cues = 'Palms face each other throughout. Upper arms hang still. Lower slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Incline Hammer Curls');
UPDATE movement_coaching_intent SET coaching_intent = 'Curl two dumbbells with the palms facing in while sitting back on an incline bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Incline Hammer Curls');

-- ---------------------------------------------------------------------------
-- 064 · Incline Push-Up Close-Grip
-- correction_sha256 c86483676ff6fd6d2289c5c287a76ba4ca7b6ddfcc0d342846fa0406d9b5df56
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Place the hands next to each other on a sturdy bar or raised platform and walk the feet back until the arms and body are straight. Keeping the body straight and the elbows tucked, bend the arms to lower the chest to the bar. Press back up until the arms are straight.', cues = 'Body in one straight line. Elbows stay tucked. Press back to straight arms.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Incline Push-Up Close-Grip');
UPDATE movement_coaching_intent SET coaching_intent = 'Perform a push-up with the hands close together on a raised bar or platform to emphasise the triceps.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Incline Push-Up Close-Grip');

-- ---------------------------------------------------------------------------
-- 065 · Incline Push-Up Wide
-- correction_sha256 dca0fac88ae94dbac1589db72cd13f0aeda8736016285edf0e8ca36eb3f24441
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Place the hands wider than the shoulders on a sturdy bar or raised platform and walk the feet back until the arms and body are straight. Keeping the body straight, bend the arms to lower the chest to the bar. Press back up until the arms are straight.', cues = 'Body in one straight line. Hands wide, chest open. Press back to straight arms.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Incline Push-Up Wide');
UPDATE movement_coaching_intent SET coaching_intent = 'Perform a push-up with the hands wide on a raised bar or platform to emphasise the chest.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Incline Push-Up Wide');

-- ---------------------------------------------------------------------------
-- 066 · Internal Rotation with Band
-- correction_sha256 cc2b64ed829f63d5fdba8f066ca55b0ce8a057da8404e3b46f34810197d1f657
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Fix a band at elbow height, stand side-on to it with the near elbow pressed to your side and bent to a right angle, and hold the band with the forearm pointing out away from the body. Keeping the elbow at your side, rotate the forearm in across the body as far as you can. Pause, then let it return slowly to the start. Complete the repetitions, then change sides.', cues = 'Elbow stays pinned to the side. Rotate from the shoulder. Return slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Internal Rotation with Band');
UPDATE movement_coaching_intent SET coaching_intent = 'Rotate the forearm in toward the body against a band with the elbow held at the side.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Internal Rotation with Band');

-- ---------------------------------------------------------------------------
-- 067 · JM Press
-- correction_sha256 24f065be646b01c266642daa84450db2a8b257186556eb479a8e816b9b9791e2
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie on a flat bench holding a barbell with a close grip, arms straight and the bar above the upper chest with the elbows in. Bend the elbows to lower the bar about halfway, as in a lying triceps extension, then let the upper arms move slightly toward the legs until they are upright. Press the bar back up to straight arms with the elbows tucked.', cues = 'Elbows stay tucked. Lower slowly on a short line. Press back to straight arms.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'JM Press');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the triceps with a press that starts like a lying triceps extension and finishes like a close-grip bench press.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'JM Press');

-- ---------------------------------------------------------------------------
-- 068 · Jackknife Sit-Up
-- correction_sha256 2e64ab2278e6f7b026c1847b6492bbaf248a2bd1f5a2240365a5b7cebc5c84cf
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie on your back with the legs straight and the arms stretched overhead. Lift the legs and the upper body together, reaching the hands toward the feet with the arms and legs straight. Pause, then lower the arms and legs slowly to the floor.', cues = 'Arms and legs stay long. Fold from the waist. Lower both ends slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Jackknife Sit-Up');
UPDATE movement_coaching_intent SET coaching_intent = 'Raise the straight legs and arms together so the hands and feet meet above the body.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Jackknife Sit-Up');

-- ---------------------------------------------------------------------------
-- 069 · Kettlebell Arnold Press
-- correction_sha256 942137926a02dce419b57436284ca440e327d259d4cdf09b33f3ab1caa6af2ee
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Clean a kettlebell to the shoulder and stand tall with the palm facing in. Press the kettlebell up and overhead, turning the wrist so the palm faces forward at the top. Lower it to the shoulder, turning the palm back to face in.', cues = 'Stand tall, eyes forward. Turn the palm as you press. Finish with the arm straight.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Kettlebell Arnold Press');
UPDATE movement_coaching_intent SET coaching_intent = 'Press a kettlebell overhead while turning the palm from facing in to facing forward.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Kettlebell Arnold Press');

-- ---------------------------------------------------------------------------
-- 070 · Kettlebell Seesaw Press
-- correction_sha256 6f51e6087c2a75cc224c1bce80189f97e870f93562aa5d025fa78ac6de701536
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Clean two kettlebells to the shoulders and stand tall. Press one kettlebell overhead until the arm is straight. As you lower it to the shoulder, press the other kettlebell up, and keep alternating for the same number of repetitions on each side.', cues = 'Stand tall and squeeze the glutes. One up as one comes down. Finish each press with a straight arm.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Kettlebell Seesaw Press');
UPDATE movement_coaching_intent SET coaching_intent = 'Press two kettlebells overhead in turn, one going up as the other comes down.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Kettlebell Seesaw Press');

-- ---------------------------------------------------------------------------
-- 071 · Kneeling Cable Crunch With Alternating Oblique Twists
-- correction_sha256 648ac96dca6752b78c6849f1a25749c81057b19856c04838e470a3f693d62330
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Attach a rope to a high pulley, kneel facing it a short step back and hold the rope ends beside the ears. Keeping the hands by the ears and the hips still, curl the torso down until the elbows reach the knees, then rise slowly. On the next repetition turn partway down so one elbow travels to the opposite knee, rise slowly, then repeat to the other side.', cues = 'Hands stay by the ears. Curl the spine, hips still. Rise slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Kneeling Cable Crunch With Alternating Oblique Twists');
UPDATE movement_coaching_intent SET coaching_intent = 'Crunch against a high cable from kneeling, alternating straight crunches with crunches that turn toward each knee.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Kneeling Cable Crunch With Alternating Oblique Twists');

-- ---------------------------------------------------------------------------
-- 072 · Kneeling Cable Triceps Extension
-- correction_sha256 ed385260f01898fd16bc62b37d32ccc728116de6b9b35cac20dc7848f241c343
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Place a bench sideways in front of a high pulley, kneel facing away from the machine and rest the head and the backs of the upper arms on the bench, holding the straight bar with a narrow overhand grip and the elbows bent. Keeping the upper arms on the bench and close to the head, straighten the elbows until the arms are level with the floor. Pause, then let the elbows bend slowly back to the start.', cues = 'Upper arms stay on the bench. Elbows in. Squeeze the triceps at full extension.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Kneeling Cable Triceps Extension');
UPDATE movement_coaching_intent SET coaching_intent = 'Straighten the elbows against a high cable while kneeling with the upper arms resting on a bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Kneeling Cable Triceps Extension');

-- ---------------------------------------------------------------------------
-- 073 · Lateral Raise - With Bands
-- correction_sha256 a02f74c1e1c2dc4aa6e267ede03dabb61762e101e989e9fcb7f492394f2d749b
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand on the middle of a band and hold an end in each hand at the sides of the thighs, arms almost straight and the back tall. With a slight, fixed bend in the elbows, raise the arms out to the sides until they are just above level with the floor. Pause, then lower slowly to the start.', cues = 'Torso stays still. Lead with the elbows. Lower slowly against the band.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Lateral Raise - With Bands');
UPDATE movement_coaching_intent SET coaching_intent = 'Raise the arms out to the sides against a band held under the feet.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Lateral Raise - With Bands');

-- ---------------------------------------------------------------------------
-- 074 · Low Cable Triceps Extension
-- correction_sha256 56033faf5f323a1a0775300fe3665dfe2c1881472eeb8413b5ba371f332a368c
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie face up on the bench of a seated row station with your head toward the pulley and hold the rope ends with the palms facing each other, upper arms pointing at the ceiling and elbows bent to a right angle. Keeping the upper arms still, straighten the elbows until the forearms are vertical. Squeeze, then let the elbows bend slowly back to a right angle.', cues = 'Upper arms point at the ceiling. Elbows in. Only the forearms move.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Low Cable Triceps Extension');
UPDATE movement_coaching_intent SET coaching_intent = 'Straighten the elbows against a low cable while lying on your back with the upper arms pointing at the ceiling.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Low Cable Triceps Extension');

-- ---------------------------------------------------------------------------
-- 075 · Low Pulley Row To Neck
-- correction_sha256 5eb45aefcb2ba0088871b909a3ec04a6522c2d0f8c0c2660ef35a0ccd10d09fc
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Sit at a low cable row station holding the rope ends with the palms facing down, back upright, knees slightly bent and arms straight in front. Keeping the torso still, lift the elbows and pull the rope toward the neck until the hands are beside the ears and the upper arms are level with the floor. Pause, then return slowly until the arms are straight.', cues = 'Torso stays upright and still. Elbows high and wide. Return slowly to a full reach.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Low Pulley Row To Neck');
UPDATE movement_coaching_intent SET coaching_intent = 'Pull a low cable rope toward the neck with the elbows high and wide to train the rear shoulders and upper back.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Low Pulley Row To Neck');

-- ---------------------------------------------------------------------------
-- 076 · Lunge Pass Through
-- correction_sha256 d1d1947a7471ac53fc7a88a518924695aeeb2f5d6fa2f1e084f02c3137667c95
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand tall holding a kettlebell in one hand. Step forward with the opposite foot and lower the back knee toward the floor with the torso upright, passing the kettlebell under the front leg to the other hand. Push through the front heel to return to standing, then step forward with the other foot and pass the kettlebell back.', cues = 'Torso upright. Pass the bell under the front thigh. Push through the front heel.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Lunge Pass Through');
UPDATE movement_coaching_intent SET coaching_intent = 'Lunge forward while passing a kettlebell under the front leg from one hand to the other.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Lunge Pass Through');

-- ---------------------------------------------------------------------------
-- 077 · Lying Cable Curl
-- correction_sha256 5da37068ea959ca903c9b8fde9e496bbd3173418345d05fbeb418d647bd98d66
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie on your back facing a low pulley with the feet braced against the base of the machine and the legs straight, holding the bar with a shoulder-width underhand grip and the arms almost straight. Keeping the upper arms still and the elbows close to the body, curl the bar toward the chest. Squeeze, then lower the bar slowly to the start.', cues = 'Elbows stay close to the body. Upper arms stay still. Lower slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Lying Cable Curl');
UPDATE movement_coaching_intent SET coaching_intent = 'Curl a low cable bar toward the chest while lying on your back.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Lying Cable Curl');

-- ---------------------------------------------------------------------------
-- 078 · Lying Triceps Press
-- correction_sha256 501fa45fbaac9840f33c452ab85aa650c577bdc40aa55d1ee8dc1d16bffdd5d5
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie on a flat bench holding an EZ bar or a straight bar with a medium overhand grip, arms straight above the chest and elbows tucked in. Keeping the upper arms and elbows still, bend the elbows to lower the bar until it is just above the forehead. Straighten the elbows to return the bar above the chest.', cues = 'Upper arms stay still. Elbows tucked in. Lower slowly toward the forehead.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Lying Triceps Press');
UPDATE movement_coaching_intent SET coaching_intent = 'Bend and straighten the elbows with a barbell while lying on a flat bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Lying Triceps Press');

-- ---------------------------------------------------------------------------
-- 079 · One Arm Dumbbell Bench Press
-- correction_sha256 7b5936fbdfeb17c02599586011c487fe3ad2113be47778d2dee724e95abc38b9
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie on a flat bench holding one dumbbell above the chest with the arm straight and the palm facing forward, the free hand resting at your side. Lower the dumbbell slowly to the side of the chest. Press it back up until the arm is straight. Complete the repetitions, then change arms.', cues = 'Shoulders stay square on the bench. Lower slowly beside the chest. Press along the same line.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'One Arm Dumbbell Bench Press');
UPDATE movement_coaching_intent SET coaching_intent = 'Press one dumbbell at a time from the chest on a flat bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'One Arm Dumbbell Bench Press');

-- ---------------------------------------------------------------------------
-- 080 · One-Arm High-Pulley Cable Side Bends
-- correction_sha256 6ced01e40af0b4894708514e7b9f790d534cbb2ed40b643539bf9733c7d0c4f8
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand side-on to a high pulley, take the handle with the near hand in an underhand grip and pull it down until the elbow touches your side and the handle is by the shoulder, feet hip-width apart and the free hand on the hip. Keeping that arm fixed in place, bend sideways toward the cable side to pull the weight down. Return slowly to upright, keeping tension on the cable. Complete the repetitions, then change sides.', cues = 'Arm stays fixed at the side. Bend from the waist. Return slowly, keep the cable tight.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'One-Arm High-Pulley Cable Side Bends');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the obliques by bending sideways against a high cable held at the shoulder.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'One-Arm High-Pulley Cable Side Bends');

-- ---------------------------------------------------------------------------
-- 081 · One-Arm Kettlebell Floor Press
-- correction_sha256 39e0ddafb98ac9f955e4389a72ff8f2ba4890994dcde53e3a425b44a1aa03c7e
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie on the floor holding a kettlebell in one hand with that upper arm resting on the floor and the palm facing in. Press the kettlebell straight up until the arm is straight, letting the wrist turn as it rises. Lower it slowly until the upper arm rests on the floor again. Complete the repetitions, then change arms.', cues = 'Wrist stacked over the elbow. Press straight up. Lower until the arm rests on the floor.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'One-Arm Kettlebell Floor Press');
UPDATE movement_coaching_intent SET coaching_intent = 'Press one kettlebell from the floor, with the upper arm resting on the ground at the bottom.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'One-Arm Kettlebell Floor Press');

-- ---------------------------------------------------------------------------
-- 082 · Pallof Press With Rotation
-- correction_sha256 69cd480344e0f7ef6d2d7fa7a272e04de0b07adbc23d8ffbdcd64dce664711b0
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Set the pulley at shoulder height, stand side-on to it an arm''s length away with the feet hip-width apart and hold the handle in both hands at the chest. Press the handle straight out, then, keeping the hips still and the arms straight, turn the torso away from the pulley through a quarter turn. Return slowly to face forward and bring the handle back to the chest. Complete the repetitions, then face the other way.', cues = 'Hips stay square. Arms straight, turn from the ribs. Return slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Pallof Press With Rotation');
UPDATE movement_coaching_intent SET coaching_intent = 'Press a cable away from the chest and then turn the torso away from the pulley with straight arms.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Pallof Press With Rotation');

-- ---------------------------------------------------------------------------
-- 083 · Pin Presses
-- correction_sha256 4806978501ff4b19a654cc8e407208516cb1892caea19055d8d5c30aeb65c92d
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Set a bench inside a rack with the pins at the chosen height and the bar resting on them, then lie back with the bar above your usual touch point, shoulder blades pulled together and feet set. From a full pause on the pins, drive the bar up to straight arms, keeping the bar, wrists and elbows in line. Lower the bar back to the pins and let it settle before the next repetition.', cues = 'Shoulder blades pulled together. Drive from a full pause. Settle the bar on the pins each time.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Pin Presses');
UPDATE movement_coaching_intent SET coaching_intent = 'Press a barbell from a dead stop on the rack pins to train a chosen part of the bench press range.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Pin Presses');

-- ---------------------------------------------------------------------------
-- 084 · Push Up to Side Plank
-- correction_sha256 c043151f834bff21ffa7c6689ffa382f016ac6ad63942de4437ca30af6d79ff1
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Start in a push-up position on the toes with the hands just outside shoulder width. Lower into a push-up with the body straight, and as you press up shift onto one hand and turn the body, reaching the other arm to the ceiling. Return the hand to the floor, do another push-up and turn to the other side.', cues = 'Body in one straight line. Reach the top hand to the ceiling. Return the hand under control.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Push Up to Side Plank');
UPDATE movement_coaching_intent SET coaching_intent = 'Follow each push-up by turning into a side plank with the top arm reaching to the ceiling.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Push Up to Side Plank');

-- ---------------------------------------------------------------------------
-- 085 · Push-Up Wide
-- correction_sha256 0ea26fe85b98cf6feedf17bd1f4fdf7cccd07a67cef64c2719109321c98eba78
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Support the body on the hands and toes with the hands wide apart, arms straight and the body in one line. Bend the elbows to lower the chest to the floor. Press back up until the arms are straight.', cues = 'Hands wide, chest open. Hips level with the shoulders. Press back to straight arms.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Push-Up Wide');
UPDATE movement_coaching_intent SET coaching_intent = 'Perform a push-up with the hands set wide apart to emphasise the chest.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Push-Up Wide');

-- ---------------------------------------------------------------------------
-- 086 · Reverse Band Box Squat
-- correction_sha256 7be88a631a712355ef781bd1c17df78190fe2d6dcc427a53f60c18735318ec2c
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Inside a rack, hang bands from the top and loop them around the bar, set a box behind you, take the bar across the back of the shoulders and step back. With the trunk tight, push the knees out and sit the hips back until you are seated on the box, and pause. Drive through the feet with the knees out to stand up off the box.', cues = 'Sit back onto the box under control. Pause on the box, stay tight. Drive up with the knees out.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Reverse Band Box Squat');
UPDATE movement_coaching_intent SET coaching_intent = 'Squat back onto a box with the bar hung from bands that help most at the bottom.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Reverse Band Box Squat');

-- ---------------------------------------------------------------------------
-- 087 · Reverse Band Deadlift
-- correction_sha256 b5237479f4fd4b0525755dc7005a86f37fd774f949b2b78b176b3560a9200e0a
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Inside a rack, hang bands from the top and loop them around the bar, then stand with the bar over the middle of the feet, hip-width apart, and grip it at shoulder width. Take a breath, bring the shins to the bar with the chest up and the back flat, and drive through the feet to lift the bar. As the bar passes the knees, bring the hips forward to stand tall. Lower by pushing the hips back and guiding the bar to the floor.', cues = 'Chest up, back flat. Bar stays against the legs. Hips forward to stand tall.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Reverse Band Deadlift');
UPDATE movement_coaching_intent SET coaching_intent = 'Deadlift a barbell hung from bands that help most at the floor and less as the bar rises.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Reverse Band Deadlift');

-- ---------------------------------------------------------------------------
-- 088 · Reverse Band Sumo Deadlift
-- correction_sha256 d124d93c3b1349f30dd7b7c5414e976166f06ec4825e63bdd19f04f2f0517d43
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Inside a rack, hang bands from the top and loop them around the bar, then set the feet wide with the bar over the middle of the feet and grip it with the arms inside the legs. Take a breath, lower the hips with the chest up, and drive through the floor, spreading it apart with the feet. As the bar passes the knees, bring the hips to the bar and stand tall. Lower by pushing the hips back and controlling the bar to the floor.', cues = 'Chest up, arms straight. Push the knees out over the feet. Hips to the bar to finish.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Reverse Band Sumo Deadlift');
UPDATE movement_coaching_intent SET coaching_intent = 'Deadlift with a wide stance and the bar hung from bands that help most at the floor.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Reverse Band Sumo Deadlift');

-- ---------------------------------------------------------------------------
-- 089 · Reverse Barbell Preacher Curls
-- correction_sha256 a26293eda58539ccf06a17533ff76f6b3c4de1fa42c3748fbe747fd3301cc60a
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Hold an EZ bar with a shoulder-width, palms-down grip and rest the upper arms on the preacher bench pad with the arms extended. Keeping the upper arms on the pad, curl the bar up to shoulder height. Squeeze, then lower slowly until the arms are extended.', cues = 'Palms face down throughout. Upper arms stay on the pad. Lower slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Reverse Barbell Preacher Curls');
UPDATE movement_coaching_intent SET coaching_intent = 'Curl an EZ bar with the palms facing down and the upper arms supported on a preacher bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Reverse Barbell Preacher Curls');

-- ---------------------------------------------------------------------------
-- 090 · Reverse Cable Curl
-- correction_sha256 ff304dbc94bd7e14e574cbdd5b2832cc253afe6783a25871e749f10ef33611a3
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand tall holding the bar from a low pulley with a shoulder-width, palms-down grip and the elbows close to the body. Keeping the upper arms still, curl the bar up to shoulder height with the palms still facing down. Pause, then lower slowly until the arms are straight.', cues = 'Palms face down throughout. Elbows stay beside the ribs. Lower slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Reverse Cable Curl');
UPDATE movement_coaching_intent SET coaching_intent = 'Curl a low cable bar with the palms facing down.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Reverse Cable Curl');

-- ---------------------------------------------------------------------------
-- 091 · Reverse Grip Triceps Pushdown
-- correction_sha256 3c132876f1c927fcfc3cdbb3623eb4f0f779331629dff098eaa3f0ff08fd2800
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand facing a high pulley and take the bar with a shoulder-width underhand grip, then bring it down until the elbows are at your sides and bent. Keeping the upper arms still against the body, straighten the elbows until the arms are fully extended beside the thighs. Let the bar rise slowly until the forearms are level with the chest.', cues = 'Elbows pinned to the sides. Only the forearms move. Return slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Reverse Grip Triceps Pushdown');
UPDATE movement_coaching_intent SET coaching_intent = 'Straighten the elbows against a high cable using an underhand grip.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Reverse Grip Triceps Pushdown');

-- ---------------------------------------------------------------------------
-- 092 · Seated Bent-Over Rear Delt Raise
-- correction_sha256 50943c8b8f37085ace45e56cc83a3f9cacd059c8b9b0b38a2bade95144463dec
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Sit on the end of a flat bench with the feet together, bend forward from the hips with the back straight and hold a dumbbell in each hand behind the calves, palms facing each other. Keeping the torso still and a slight bend in the elbows, lift the dumbbells straight out to the sides until the arms are level with the floor. Pause, then lower slowly to the start.', cues = 'Torso stays down and still. Lift out to the sides. Lower slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Seated Bent-Over Rear Delt Raise');
UPDATE movement_coaching_intent SET coaching_intent = 'Raise two dumbbells out to the sides while seated and bent forward to train the rear shoulders.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Seated Bent-Over Rear Delt Raise');

-- ---------------------------------------------------------------------------
-- 093 · Seated Cable Rows
-- correction_sha256 afe9ca5f8465652d011a1e532b65cdd6dc29a2881d92d63bc6322be044db72a4
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Sit at a low cable row station with the feet on the foot plate and the knees slightly bent, hold the V-handle and sit upright with the arms straight and the chest up. Keeping the torso still and the arms close to the body, pull the handle to the stomach. Squeeze the back, then let the handle return slowly until the arms are straight.', cues = 'Torso stays upright and still. Drive the elbows back past the ribs. Return slowly to a full reach.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Seated Cable Rows');
UPDATE movement_coaching_intent SET coaching_intent = 'Row a low cable to the stomach from a seated position with the torso upright.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Seated Cable Rows');

-- ---------------------------------------------------------------------------
-- 094 · Seated Cable Shoulder Press
-- correction_sha256 e498b354e3590a665bab07f977dcfa3e3afd54df1e95d226905afd1cb909573c
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Sit tall holding a cable handle in each hand at shoulder height, upper arms out to the sides and elbows bent to about a right angle. Press the handles up and together overhead until the arms are straight. Pause, then lower them slowly to shoulder height, keeping tension on the cables.', cues = 'Sit tall, ribs down. Wrists stacked over the elbows. Lower slowly to shoulder height.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Seated Cable Shoulder Press');
UPDATE movement_coaching_intent SET coaching_intent = 'Press two cable handles overhead from shoulder height while seated.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Seated Cable Shoulder Press');

-- ---------------------------------------------------------------------------
-- 095 · Shoulder Press - With Bands
-- correction_sha256 3fdd89fb167d8b4315e9ac3883e7b71c38eb2d5920f8d8604ec567c4583e4787
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand on the middle of a band and bring a handle in each hand to shoulder height with the palms facing forward. Press both handles straight up until the arms are straight overhead. Lower slowly to shoulder height.', cues = 'Stand tall, ribs down. Press both sides together. Lower slowly against the band.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Shoulder Press - With Bands');
UPDATE movement_coaching_intent SET coaching_intent = 'Press band handles overhead from shoulder height while standing on the band.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Shoulder Press - With Bands');

-- ---------------------------------------------------------------------------
-- 096 · Speed Box Squat
-- correction_sha256 cfef15d8c7c3f0f970948a2359bbb50462199a159244b611950e25d193a33d91
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Anchor bands near the floor and loop them over the ends of the bar, set a box behind you, take the bar across the upper back with the shoulder blades pulled together and step back. Sit the hips back under control until you are seated on the box, and pause briefly. Drive up off the box as fast as you can while staying tight.', cues = 'Sit back onto the box under control. Pause, stay tight. Stand up fast.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Speed Box Squat');
UPDATE movement_coaching_intent SET coaching_intent = 'Squat back onto a box and stand up fast against band tension with a moderate load.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Speed Box Squat');

-- ---------------------------------------------------------------------------
-- 097 · Spider Curl
-- correction_sha256 83ddbf234a555a16d3334450431b416016ef65b1b716f8b424c48248ac400dde
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie with the chest and stomach against the angled side of a preacher bench, feet on the floor, upper arms resting on the pad and the bar held with a shoulder-width underhand grip, arms straight. Keeping the upper arms on the pad, curl the bar up as far as you can. Squeeze, then lower slowly until the arms are straight.', cues = 'Chest stays on the bench. Upper arms stay on the pad. Lower slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Spider Curl');
UPDATE movement_coaching_intent SET coaching_intent = 'Curl a barbell with the chest against the angled side of a preacher bench so the arms hang straight down.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Spider Curl');

-- ---------------------------------------------------------------------------
-- 098 · Squat with Bands
-- correction_sha256 9482bae69699b32a150714f8b0f5f0dab671cab27f6cf05f4d73822946c68640
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Attach bands from the ends of the bar to a secure anchor near the floor, take the bar across the back of the shoulders with the shoulder blades squeezed together and step back into a wide stance. With the trunk tight, push the knees out and sit the hips back and down until the hip crease is level with the top of the knee. Drive through the feet, keeping the knees out, to stand tall against the band tension.', cues = 'Shoulder blades squeezed together. Knees out, hips back. Stay tight from head to toe.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Squat with Bands');
UPDATE movement_coaching_intent SET coaching_intent = 'Squat with a barbell across the upper back and bands adding resistance as you stand up.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Squat with Bands');

-- ---------------------------------------------------------------------------
-- 099 · Standing Biceps Cable Curl
-- correction_sha256 a053907c2aee3315de43b5720f73aec9ab836cb9bcad2662527bb511fa5b8f2c
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand tall holding the bar from a low pulley with a shoulder-width, palms-up grip and the elbows close to the body. Keeping the upper arms still, curl the bar up to shoulder height. Squeeze, then lower slowly until the arms are straight.', cues = 'Elbows stay beside the ribs. Upper arms stay still. Lower slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Standing Biceps Cable Curl');
UPDATE movement_coaching_intent SET coaching_intent = 'Curl a low cable bar with the palms facing up.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Standing Biceps Cable Curl');

-- ---------------------------------------------------------------------------
-- 100 · Standing Dumbbell Reverse Curl
-- correction_sha256 7d9feff5a6adb5d829f9eee91c48a6d5cc987c48d2d10edce3e11cc2c3b6a19a
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand tall with a dumbbell in each hand, arms straight and palms facing down. Keeping the upper arms still, curl the dumbbells up to shoulder height with the palms still facing down. Pause, then lower slowly until the arms are straight.', cues = 'Palms face down throughout. Upper arms stay still. Lower slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Reverse Curl');
UPDATE movement_coaching_intent SET coaching_intent = 'Curl two dumbbells with the palms facing down to train the forearms and biceps.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Reverse Curl');

-- ---------------------------------------------------------------------------
-- 101 · Standing Dumbbell Triceps Extension
-- correction_sha256 d6f7c00b5f5ab9baeff625fbad6750e5366e9ffcc4fe4ca29ba20ef4bec3d748
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand with the feet shoulder-width apart and hold one dumbbell in both hands overhead with the arms straight and the elbows in. Keeping the upper arms close to the head, bend the elbows to lower the dumbbell behind the head. Straighten the elbows to return the dumbbell overhead.', cues = 'Upper arms stay close to the head. Only the forearms move. Lower slowly behind the head.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Triceps Extension');
UPDATE movement_coaching_intent SET coaching_intent = 'Lower and raise one dumbbell behind the head with both hands while standing.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Triceps Extension');

-- ---------------------------------------------------------------------------
-- 102 · Standing Overhead Barbell Triceps Extension
-- correction_sha256 315ad04f9a88f04e87c4de640005ce75158f7360681c74428aa7c2e0d16b8f05
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand with the feet shoulder-width apart and hold a barbell or EZ bar overhead with the hands closer than shoulder width, arms straight and elbows in. Keeping the upper arms close to the head, bend the elbows to lower the bar behind the head. Straighten the elbows to return the bar overhead.', cues = 'Elbows stay narrow. Only the forearms move. Lower slowly behind the head.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Standing Overhead Barbell Triceps Extension');
UPDATE movement_coaching_intent SET coaching_intent = 'Lower and raise a barbell behind the head with the upper arms held still while standing.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Standing Overhead Barbell Triceps Extension');

-- ---------------------------------------------------------------------------
-- 103 · Standing Rope Crunch
-- correction_sha256 23979df2d4b8851d84e3e4647083170f67f2b60c7fe9c1be35bd445440d78b15
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Attach a rope to a high pulley, stand with your back to the machine and hold the rope ends over the shoulders against the upper chest. Keeping the hips still, curl the spine to crunch the torso down as far as you can control. Pause, then return slowly to standing tall.', cues = 'Rope stays at the upper chest. Curl the spine, hips still. Return slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Standing Rope Crunch');
UPDATE movement_coaching_intent SET coaching_intent = 'Crunch the torso down against a high cable while standing with your back to the machine.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Standing Rope Crunch');

-- ---------------------------------------------------------------------------
-- 104 · Stiff Leg Barbell Good Morning
-- correction_sha256 d2072c507a629b321a0e364435c7e7db3f0872fff787769ae3b4b1acee60cb54
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Take the bar from the rack across the back of the shoulders and stand with the feet shoulder-width apart, back straight and head up. Keeping the legs still, push the hips back and lower the torso until it is about level with the floor. Bring the hips forward to stand tall again.', cues = 'Back straight, ribs down. Hips back, legs still. Stand tall through the hips.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Stiff Leg Barbell Good Morning');
UPDATE movement_coaching_intent SET coaching_intent = 'Hinge forward at the hips with a barbell across the upper back and the legs held nearly straight.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Stiff Leg Barbell Good Morning');

-- ---------------------------------------------------------------------------
-- 105 · Stiff-Legged Barbell Deadlift
-- correction_sha256 e84bd29a0a62de08f38084a7e9f2a6f7d94450c2abcf2c0ff90b69dd3f090a8c
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand tall holding a barbell with an overhand grip, feet shoulder-width apart or a little narrower and the knees slightly bent. Keeping the knees at that angle and the back straight, push the hips back to lower the bar toward the top of the feet until you feel a stretch in the hamstrings. Bring the hips forward to stand tall again.', cues = 'Back straight, knees softly bent. Hips back, bar close to the legs. Stand tall with the hips.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Stiff-Legged Barbell Deadlift');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the hamstrings by hinging at the hips with a barbell and the knees only slightly bent.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Stiff-Legged Barbell Deadlift');

-- ---------------------------------------------------------------------------
-- 106 · Sumo Deadlift with Bands
-- correction_sha256 eae92fe266e7f1995835de44352e58e367b3f11c37b0f212561a208e8280fc97
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Loop short bands over the bar and stand on them, feet set wide with the bar over the middle of the feet, and grip the bar with the arms inside the legs. Take a breath, lower the hips with the chest up, and drive through the floor, spreading it apart with the feet. As the bar passes the knees, bring the hips to the bar and stand tall against the band tension. Lower by pushing the hips back and controlling the bar to the floor.', cues = 'Chest up, arms straight. Push the knees out over the feet. Hips to the bar to finish.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Sumo Deadlift with Bands');
UPDATE movement_coaching_intent SET coaching_intent = 'Deadlift with a wide stance and bands adding resistance as the bar rises.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Sumo Deadlift with Bands');

-- ---------------------------------------------------------------------------
-- 107 · Triceps Pushdown - Rope Attachment
-- correction_sha256 10c53514ee756ebf6d6ac95cf4581d93645f8fd397e1a863d5091f6c295bab64
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Attach a rope to a high pulley and hold the ends with the palms facing each other, standing tall with the upper arms against the body and the forearms pointing up toward the pulley. Keeping the upper arms still, straighten the elbows and bring the rope ends down to the sides of the thighs. Pause, then let the rope rise slowly to the start.', cues = 'Upper arms stay against the body. Spread the rope at the bottom. Return slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Triceps Pushdown - Rope Attachment');
UPDATE movement_coaching_intent SET coaching_intent = 'Straighten the elbows against a high cable using a rope, finishing with the hands beside the thighs.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Triceps Pushdown - Rope Attachment');

-- ---------------------------------------------------------------------------
-- 108 · Two-Arm Kettlebell Row
-- correction_sha256 2e99578adca1bc69faf307e6d396499ef806a4cd5e46ffbf2abda6134eef80ea
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand over two kettlebells, bend the knees slightly, push the hips back and take a handle in each hand with the back straight. Pull both kettlebells toward the stomach, drawing the shoulder blades together. Lower them under control until the arms are straight.', cues = 'Hips back, back straight. Pull the elbows toward the hips. Lower under control.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Two-Arm Kettlebell Row');
UPDATE movement_coaching_intent SET coaching_intent = 'Row two kettlebells together from a hinged position.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Two-Arm Kettlebell Row');

-- ---------------------------------------------------------------------------
-- 109 · Underhand Cable Pulldowns
-- correction_sha256 0b51941b9b71f76097b6e31ff9db3a2d92c32667b723e673237038f0b920176a
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Sit at a pulldown station with the knee pad snug, take the bar with the palms facing you and the hands closer than shoulder width, and lean back slightly with the chest up. Keeping the elbows close to the body, draw the shoulders and upper arms down and back to pull the bar to the upper chest. Squeeze the back, then let the bar rise slowly until the arms are straight.', cues = 'Chest up to meet the bar. Elbows close to the body. Return slowly to a full reach.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Underhand Cable Pulldowns');
UPDATE movement_coaching_intent SET coaching_intent = 'Pull a high bar down to the upper chest with a close, palms-up grip.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Underhand Cable Pulldowns');

-- ---------------------------------------------------------------------------
-- 110 · Upright Barbell Row
-- correction_sha256 49a0b143d24df8aef66c8c9211540f00dbc853f6f4158523436f6a87addd709e
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand tall holding a barbell against the thighs with an overhand grip slightly narrower than the shoulders. Keeping the bar close to the body, lift it toward the chin by raising the elbows up and out to the sides, elbows higher than the hands. Pause, then lower the bar slowly to the thighs.', cues = 'Elbows lead and stay above the hands. Bar stays close to the body. Lower slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Upright Barbell Row');
UPDATE movement_coaching_intent SET coaching_intent = 'Lift a barbell up the front of the body with the elbows leading to train the shoulders and upper traps.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Upright Barbell Row');

-- ---------------------------------------------------------------------------
-- 111 · Upright Cable Row
-- correction_sha256 a93e5116e04eed1ac3a17a1978aa76da533ae72c3ef5ecd383b2b03f5a3c6b99
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand tall facing a low pulley holding the straight bar against the thighs with an overhand grip slightly narrower than the shoulders. Keeping the bar close to the body, lift it toward the chin by raising the elbows up and out to the sides, elbows higher than the hands. Pause, then lower the bar slowly to the thighs.', cues = 'Elbows lead and stay above the hands. Bar stays close to the body. Lower slowly.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Upright Cable Row');
UPDATE movement_coaching_intent SET coaching_intent = 'Lift a low cable bar up the front of the body with the elbows leading.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Upright Cable Row');

-- ---------------------------------------------------------------------------
-- 112 · Upright Row - With Bands
-- correction_sha256 ab39a89e9131e39b27b20c3efdbcc55b01e2c06098be2327e33d3416c6f2b61c
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand on the middle of a band and hold an end in each hand against the thighs with the palms facing the body. Keeping the hands close to the body, lift them toward the chin by raising the elbows up and out to the sides, elbows higher than the hands. Pause, then lower slowly to the thighs.', cues = 'Elbows lead and stay above the hands. Hands stay close to the body. Lower slowly against the band.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Upright Row - With Bands');
UPDATE movement_coaching_intent SET coaching_intent = 'Lift band handles up the front of the body with the elbows leading.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Upright Row - With Bands');

-- ---------------------------------------------------------------------------
-- 113 · V-Bar Pullup
-- correction_sha256 66f062c8643101f5802e4142cc182fcb1e3c8b43a385ce3639000b4cc4af117d
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Hang a V-handle over the middle of the pull-up bar, grip one side in each hand and hang with the arms straight, chest up and leaning back slightly. Pull the body up, leaning the head back slightly to clear the bar, until the chest is close to the handle. Pause, then lower slowly to a full hang.', cues = 'Chest up, lean back slightly. Pull through the elbows. Lower slowly to a full hang.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'V-Bar Pullup');
UPDATE movement_coaching_intent SET coaching_intent = 'Pull up on a V-handle hung over the bar, with the palms facing each other.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'V-Bar Pullup');

-- ---------------------------------------------------------------------------
-- 114 · Wide Stance Barbell Squat
-- correction_sha256 fd70964cf2561865bbdaa5772a9bf7c934e68c7c24b84af5aee9df4ecad7c1e0
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Take the bar from the rack across the upper back and step back into a stance wider than the shoulders with the toes turned slightly out. Keeping the chest up and the back straight, bend the knees and lower until the thighs are just below level with the floor. Drive through the feet to stand back up.', cues = 'Chest up, back straight. Knees track over the toes. Drive through the whole foot.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Wide Stance Barbell Squat');
UPDATE movement_coaching_intent SET coaching_intent = 'Squat with a barbell across the upper back and the feet set wider than the shoulders.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Wide Stance Barbell Squat');

-- ---------------------------------------------------------------------------
-- 115 · Wide-Grip Lat Pulldown
-- correction_sha256 22eee3050273cd4d23eadca8972d9e6c0a43651bfe1fbd3c6e0428c088fb36ea
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Sit at a pulldown station with the knee pad snug, take the bar with the palms facing forward and the hands wider than the shoulders, and lean back slightly with the chest up. Draw the shoulders and upper arms down and back to pull the bar to the upper chest. Squeeze the shoulder blades together, then let the bar rise slowly until the arms are straight.', cues = 'Chest up to meet the bar. Pull through the elbows. Return slowly to a full reach.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Wide-Grip Lat Pulldown');
UPDATE movement_coaching_intent SET coaching_intent = 'Pull a high bar down to the upper chest with the hands wider than the shoulders.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Wide-Grip Lat Pulldown');

-- ---------------------------------------------------------------------------
-- Provenance (immutable revision history, version 2)
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO movement_content_correction
  (movement_id, correction_version, correction_sha256, applied_at_ms) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Alternate Hammer Curl'), 2, '983bb2e88bd2502368d8ebcd165fd7a13a090f67040a5fbd66b0664c627c3c56', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Cable Shoulder Press'), 2, '432fd44b4653c4c7b908a89828c7b598bf787c48e9b182dedb461175f2226a17', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Floor Press'), 2, '63e44b71c7f1ace7855b7448f47b307e385479b789c5b1256a8201c90e76fb7f', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Kettlebell Press'), 2, 'ff4715bd668dcd0ce342aef6ebac31cd3500b7cae48314a2b97fa00ebcdbd654', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Alternating Kettlebell Row'), 2, '12926c20bb4ab8478d94075054e8536f8b0c4fb39f66a601144f8037fd6010e0', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Back Flyes - With Bands'), 2, 'f16beaba7e4b84a4e9e602970dc1aeead84704e9782cf8e2910bb90c15be6f7d', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Bench Press - Medium Grip'), 2, 'c36054b866e510a856ef518b451f0f6ed8819ee3e6170454b81fe8004cd8b41b', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Incline Bench Press - Medium Grip'), 2, '8fea83efd230eab309ab53dd4c4965bfc121d9204c90786bc3ef6bf54b04ee23', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Lunge'), 2, 'b4a40330455d789fe414ca5a07ea477f8709a380f7f6fbc1f69f9c9a73ed1d51', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Rollout from Bench'), 2, 'f9405bb77d9b2932fcc694bbcbebcdf9394645cf869143c6e208e728ce9d1556', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Squat To A Bench'), 2, '6b1d5254f22e34e3cb151071a12868d44d85adb45deb6da908b3907e489f630c', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Barbell Row'), 2, '7b83cfc2760a8242f6e5cfa038a9abd2cfb328e1109bfa1a1c3c0689c447e738', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over One-Arm Long Bar Row'), 2, 'c95cf556f95717da8991c35ea307266e8b2dd35727c369cd3083b86e3ef49246', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Dumbbell Row'), 2, 'dd34af0e9edfd1196b4e03574ee44ad7dd9f0d13155d02a718b5da4b89053ef2', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Two-Dumbbell Row With Palms In'), 2, '48541795094ea24b93ffd2c5771e8aa16592511df15abeba4c492adba6d5d763', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Bent-Arm Barbell Pullover'), 2, 'fd73b8a844671caa1b80f2c7c6905f7aba3b655e3ced792693a76b3f566d6013', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Body Tricep Press'), 2, '4fde4fc9a83557843be86c463e3000e05a7bb86a7ca7d46745433b805ffd4a7a', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Incline Triceps Extension'), 2, '239a44772e0ee8e292e9f4c589a8987ff40d5950777f9ba09ba2e3f9bc2e0cd9', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Lying Triceps Extension'), 2, 'cde27da676b229c1ff322f698d01d0c5fc0c615dd6deb5d96a81ee84aef00df9', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Preacher Curl'), 2, 'ab65c17523862442e634918451f39945361adf37ae482d0cab3a8f7c1d871947', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Russian Twists'), 2, 'e1f35282fda40304dcea30099c9c22b4a33742fd55315ff5b22ed67dbaec2a69', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Seated Crunch'), 2, 'af391ebf525a1477e59715744b0206ce2c626cf008fab4aad5bd1d159e35974f', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Seated Lateral Raise'), 2, '35b59b21f4610803d1fbfeb7f38401e0d304a4b30f155b444ce0d59277fd2c6f', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Wrist Curl'), 2, '4c1bbbff856f0f6de51c13801f7db12e947c4c3fe14272206c4e05f8b4e3e427', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Clock Push-Up'), 2, '98dfc34280fce2c9239a2f7d12e49fe5be3fd8635913ab4937c71aaa64bcd4dd', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip EZ Bar Curl'), 2, '8ca91f37cc070afabebfcde978890023ae2b4e0fb72a63a706c933368e299170', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip EZ-Bar Press'), 2, '679a70a2bdf9624260c1776c2410d39d525e241dbdf45ead99bd6ef1aeba295b', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip Front Lat Pulldown'), 2, '8cb64a2903eab5dacafce3fe9e83a5834725f47aaf76ff2712b9fa0944de247b', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Close-Grip Push-Up off of a Dumbbell'), 2, 'cb655349b3edac72c2a493c906ca90e7111d36c54e20665da783ed741efba432', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Concentration Curls'), 2, '3668ceeb4031e64a07d398827cc6c10035f4722fd03adcfb755b8445eda1b412', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Cross Body Hammer Curl'), 2, 'e72dcef3a35654897c0fd168a0e099a5bba3905bb4d8fc85532e92ea0a6959cf', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Cross-Body Crunch'), 2, '48291c4b622360c84697a6b18ee0a9901e210edb55b9e959d19fd6ac1cff6a92', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Crunch - Hands Overhead'), 2, 'eacc443fa804479baa6c2366c2c32a50363466fed13e0821a3f6d92a219021f7', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Deadlift with Bands'), 2, '44e3ed41a440e9c079bdef24bd5719917bfb908eadbb346f14274ffcdc327706', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Close-Grip Bench To Skull Crusher'), 2, '038b88d5ae32fbf03e924776c3de8d42027714af5974afe5d7e32c3f4dd1b52c', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Dumbbell Flyes'), 2, '92a34494768c3e78d9ad769a15486a0b7d0ffcf3effe9113ec74ecc070c68f0c', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Dumbbell Triceps Extension'), 2, '7c7b22772ea6b1acd52ff70a5675ab4161e0e5891f49f4cf202ba7e77ecf25c1', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Decline EZ Bar Triceps Extension'), 2, '7c2fa43838fe96ab0fa237959774f1f795373041b068ef92c92b310f260f6615', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Oblique Crunch'), 2, 'f7d8f16084a13816464b0f3b729e76f1004a812a2408d40c50dc742ef3b38ec2', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Push-Up'), 2, 'e12c290861d3b20a7bb6e87d949b3c910f559f8b4743cebf5b953d2cdf3a7fb8', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Decline Reverse Crunch'), 2, 'beb5ecdc74435df235a62e7c96902eed075429b9a7e9e62947982c6fa2b71dc5', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Bicep Curl'), 2, '6a819e9c8a4e3fd4410a98a9eed19bfa936b462aea0cc14e7dfe266fde614dd5', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell One-Arm Shoulder Press'), 2, '52b4d273854e86cc7c9709c8b562830cc8f79ca179ddcc8e8a8b4947d5c11d62', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Prone Incline Curl'), 2, '47452a4fd20796dd21944fbea062d7333abbf1ec9ba078a1174901e1e7fa2ce9', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Seated One-Leg Calf Raise'), 2, '561668fef745691e845ad1eabd3045d20f7dee3013f7ed7f3a28931031d282be', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Squat To A Bench'), 2, '1b3a7baa79394ff98d3b2ab9b7df0a978616f2f1fd32dc545e99bbb594ba3bd7', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'EZ-Bar Curl'), 2, '81bb379e1803c994b4cdd15e67868d5ad6ce4702568e2d6efc33762960c5e1b7', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Elevated Back Lunge'), 2, 'a79cce0952d3e49a6d67a63a85a042d53c120de09e2d95fada9e1dcc71de670d', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Elevated Cable Rows'), 2, '6165e596401ad448514053a99e6e9d15c5e718780b794dcebbbc0661d8e21de4', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Flat Bench Cable Flyes'), 2, '93de66b253b22178a5c1fa20e57e5a4c84e2999f2c0438204b27ea5b96a9255b', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Floor Press'), 2, '276ac12ff86eafe62dffa025780633363427a14d851820035f9eab0545252328', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Frog Sit-Ups'), 2, '04f80d4364b1a9b8143cdb15078b579e98661fcf60a1a80060aea1abac8f9c8b', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Front Cable Raise'), 2, 'ba9385a68ece1512e07ed7b4dcd29bb001f3053b4762a299ee9ea187d794c8ab', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Front Squat (Clean Grip)'), 2, '0b333e1816a7032aa155c7b98e2551d50f518c2a01714c6dbbdd80b52621c0cd', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Full Range-Of-Motion Lat Pulldown'), 2, 'f91ad5e56eda39c4bb62a8ef53bb9e108ada4eb084ff8f430ac6e8a6aa101320', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Good Morning off Pins'), 2, '7d26e9d24328ecbdf2647636a5c0455434e37e844d837f1c0b03c2b77ec7c85d', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Gorilla Chin/Crunch'), 2, 'b7cdd7557250d0c778fd41b20947869a554935f2b21abb4a177e6c679c0edead', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'High Cable Curls'), 2, '2f90bdd2d7fb2fa9ec40c668ba97dca8a72af4d02f3e1adeb4d4185c32a5b24b', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Barbell Triceps Extension'), 2, 'e13c8abda2652d601cb93fa46e671eba9cca4d481a08068ffa324d451a5f665a', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Cable Flye'), 2, '65985ed39b8beb2c3174f535ef0647d66be2295fd2d1b5a1b10c6f203d24461d', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Curl'), 2, 'adef02778643ce04e804295277c21d4b11865cede653ed7ee19dbe337a307f82', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Flyes'), 2, '2a6302171baaa6763f401ccd6ac0aa0c168e7079ab33d33d850b4cce5e7dec1b', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Hammer Curls'), 2, '5ef82e84bcd9af052bf31ce89413be32891b3e61c698de3136021fc2c26f6cb3', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Push-Up Close-Grip'), 2, 'c86483676ff6fd6d2289c5c287a76ba4ca7b6ddfcc0d342846fa0406d9b5df56', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Push-Up Wide'), 2, 'dca0fac88ae94dbac1589db72cd13f0aeda8736016285edf0e8ca36eb3f24441', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Internal Rotation with Band'), 2, 'cc2b64ed829f63d5fdba8f066ca55b0ce8a057da8404e3b46f34810197d1f657', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'JM Press'), 2, '24f065be646b01c266642daa84450db2a8b257186556eb479a8e816b9b9791e2', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Jackknife Sit-Up'), 2, '2e64ab2278e6f7b026c1847b6492bbaf248a2bd1f5a2240365a5b7cebc5c84cf', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Arnold Press'), 2, '942137926a02dce419b57436284ca440e327d259d4cdf09b33f3ab1caa6af2ee', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Seesaw Press'), 2, '6f51e6087c2a75cc224c1bce80189f97e870f93562aa5d025fa78ac6de701536', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling Cable Crunch With Alternating Oblique Twists'), 2, '648ac96dca6752b78c6849f1a25749c81057b19856c04838e470a3f693d62330', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling Cable Triceps Extension'), 2, 'ed385260f01898fd16bc62b37d32ccc728116de6b9b35cac20dc7848f241c343', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Lateral Raise - With Bands'), 2, 'a02f74c1e1c2dc4aa6e267ede03dabb61762e101e989e9fcb7f492394f2d749b', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Low Cable Triceps Extension'), 2, '56033faf5f323a1a0775300fe3665dfe2c1881472eeb8413b5ba371f332a368c', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Low Pulley Row To Neck'), 2, '5eb45aefcb2ba0088871b909a3ec04a6522c2d0f8c0c2660ef35a0ccd10d09fc', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Lunge Pass Through'), 2, 'd1d1947a7471ac53fc7a88a518924695aeeb2f5d6fa2f1e084f02c3137667c95', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Lying Cable Curl'), 2, '5da37068ea959ca903c9b8fde9e496bbd3173418345d05fbeb418d647bd98d66', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Lying Triceps Press'), 2, '501fa45fbaac9840f33c452ab85aa650c577bdc40aa55d1ee8dc1d16bffdd5d5', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'One Arm Dumbbell Bench Press'), 2, '7b5936fbdfeb17c02599586011c487fe3ad2113be47778d2dee724e95abc38b9', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm High-Pulley Cable Side Bends'), 2, '6ced01e40af0b4894708514e7b9f790d534cbb2ed40b643539bf9733c7d0c4f8', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'One-Arm Kettlebell Floor Press'), 2, '39e0ddafb98ac9f955e4389a72ff8f2ba4890994dcde53e3a425b44a1aa03c7e', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Pallof Press With Rotation'), 2, '69cd480344e0f7ef6d2d7fa7a272e04de0b07adbc23d8ffbdcd64dce664711b0', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Pin Presses'), 2, '4806978501ff4b19a654cc8e407208516cb1892caea19055d8d5c30aeb65c92d', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Push Up to Side Plank'), 2, 'c043151f834bff21ffa7c6689ffa382f016ac6ad63942de4437ca30af6d79ff1', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Push-Up Wide'), 2, '0ea26fe85b98cf6feedf17bd1f4fdf7cccd07a67cef64c2719109321c98eba78', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Box Squat'), 2, '7be88a631a712355ef781bd1c17df78190fe2d6dcc427a53f60c18735318ec2c', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Deadlift'), 2, 'b5237479f4fd4b0525755dc7005a86f37fd774f949b2b78b176b3560a9200e0a', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Band Sumo Deadlift'), 2, 'd124d93c3b1349f30dd7b7c5414e976166f06ec4825e63bdd19f04f2f0517d43', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Barbell Preacher Curls'), 2, 'a26293eda58539ccf06a17533ff76f6b3c4de1fa42c3748fbe747fd3301cc60a', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Cable Curl'), 2, 'ff304dbc94bd7e14e574cbdd5b2832cc253afe6783a25871e749f10ef33611a3', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Grip Triceps Pushdown'), 2, '3c132876f1c927fcfc3cdbb3623eb4f0f779331629dff098eaa3f0ff08fd2800', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Bent-Over Rear Delt Raise'), 2, '50943c8b8f37085ace45e56cc83a3f9cacd059c8b9b0b38a2bade95144463dec', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Cable Rows'), 2, 'afe9ca5f8465652d011a1e532b65cdd6dc29a2881d92d63bc6322be044db72a4', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Cable Shoulder Press'), 2, 'e498b354e3590a665bab07f977dcfa3e3afd54df1e95d226905afd1cb909573c', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Shoulder Press - With Bands'), 2, '3fdd89fb167d8b4315e9ac3883e7b71c38eb2d5920f8d8604ec567c4583e4787', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Speed Box Squat'), 2, 'cfef15d8c7c3f0f970948a2359bbb50462199a159244b611950e25d193a33d91', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Spider Curl'), 2, '83ddbf234a555a16d3334450431b416016ef65b1b716f8b424c48248ac400dde', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Squat with Bands'), 2, '9482bae69699b32a150714f8b0f5f0dab671cab27f6cf05f4d73822946c68640', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Biceps Cable Curl'), 2, 'a053907c2aee3315de43b5720f73aec9ab836cb9bcad2662527bb511fa5b8f2c', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Reverse Curl'), 2, '7d9feff5a6adb5d829f9eee91c48a6d5cc987c48d2d10edce3e11cc2c3b6a19a', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Triceps Extension'), 2, 'd6f7c00b5f5ab9baeff625fbad6750e5366e9ffcc4fe4ca29ba20ef4bec3d748', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Overhead Barbell Triceps Extension'), 2, '315ad04f9a88f04e87c4de640005ce75158f7360681c74428aa7c2e0d16b8f05', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Rope Crunch'), 2, '23979df2d4b8851d84e3e4647083170f67f2b60c7fe9c1be35bd445440d78b15', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Stiff Leg Barbell Good Morning'), 2, 'd2072c507a629b321a0e364435c7e7db3f0872fff787769ae3b4b1acee60cb54', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Stiff-Legged Barbell Deadlift'), 2, 'e84bd29a0a62de08f38084a7e9f2a6f7d94450c2abcf2c0ff90b69dd3f090a8c', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Sumo Deadlift with Bands'), 2, 'eae92fe266e7f1995835de44352e58e367b3f11c37b0f212561a208e8280fc97', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Triceps Pushdown - Rope Attachment'), 2, '10c53514ee756ebf6d6ac95cf4581d93645f8fd397e1a863d5091f6c295bab64', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Two-Arm Kettlebell Row'), 2, '2e99578adca1bc69faf307e6d396499ef806a4cd5e46ffbf2abda6134eef80ea', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Underhand Cable Pulldowns'), 2, '0b51941b9b71f76097b6e31ff9db3a2d92c32667b723e673237038f0b920176a', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Upright Barbell Row'), 2, '49a0b143d24df8aef66c8c9211540f00dbc853f6f4158523436f6a87addd709e', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Upright Cable Row'), 2, 'a93e5116e04eed1ac3a17a1978aa76da533ae72c3ef5ecd383b2b03f5a3c6b99', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Upright Row - With Bands'), 2, 'ab39a89e9131e39b27b20c3efdbcc55b01e2c06098be2327e33d3416c6f2b61c', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'V-Bar Pullup'), 2, '66f062c8643101f5802e4142cc182fcb1e3c8b43a385ce3639000b4cc4af117d', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Wide Stance Barbell Squat'), 2, 'fd70964cf2561865bbdaa5772a9bf7c934e68c7c24b84af5aee9df4ecad7c1e0', 1790899200000),
  ((SELECT movement_id FROM movement WHERE name = 'Wide-Grip Lat Pulldown'), 2, '22eee3050273cd4d23eadca8972d9e6c0a43651bfe1fbd3c6e0428c088fb36ea', 1790899200000);
