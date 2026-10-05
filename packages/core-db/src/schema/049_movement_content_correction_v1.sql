-- =============================================================================
-- 049_movement_content_correction_v1.sql
-- Phase 2a pre-release content correction (generated, additive, idempotent).
-- Source of truth: packages/core-db/staging/movement_content_correction_v1.json
-- Regenerate with: node scripts/generate-library-correction.mjs --write
--
-- Writes NO media of any kind: asset keys, statuses, revisions and the legacy
-- fallback URLs stay byte-identical. Migrations 036-048 are not modified.
-- =============================================================================

-- Full-body scope is a SEPARATE axis from movement.pattern: FOCUS_PATTERNS.full
-- already holds five entries, so a sixth pattern slot is unreachable. Row absent
-- = not scoped.
CREATE TABLE IF NOT EXISTS movement_scope (
  movement_id INTEGER NOT NULL REFERENCES movement ON DELETE CASCADE,
  scope       TEXT NOT NULL CHECK (scope IN ('full_body')),
  PRIMARY KEY (movement_id, scope)
) STRICT, WITHOUT ROWID;

-- Immutable revision history: INSERT OR IGNORE only. A future correction set
-- writes version 2 alongside version 1 — never an UPDATE, never a DELETE.
CREATE TABLE IF NOT EXISTS movement_content_correction (
  movement_id        INTEGER NOT NULL REFERENCES movement ON DELETE CASCADE,
  correction_version INTEGER NOT NULL CHECK (correction_version >= 1),
  correction_sha256  TEXT    NOT NULL,
  applied_at_ms      INTEGER NOT NULL,
  PRIMARY KEY (movement_id, correction_version)
) STRICT;

-- ---------------------------------------------------------------------------
-- movement_equipment: widen the item CHECK to carry specialist equipment.
-- The CHECK is a STRICT table constraint and SQLite cannot ALTER it, so the
-- table is rebuilt. movement_equipment is a child-only table (nothing
-- REFERENCES it), which is why a rename/copy/drop is FK-safe even though the
-- runner holds an open transaction (PRAGMA foreign_keys = OFF is silently
-- ignored inside one, so the classic 12-step recipe would not work here).
-- STRICT, WITHOUT ROWID, the composite PK and the ON DELETE CASCADE are all
-- preserved, and every pre-existing row is copied before any correction runs.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movement_equipment_v049 (
  movement_id INTEGER NOT NULL REFERENCES movement ON DELETE CASCADE,
  item        TEXT NOT NULL CHECK (item IN
                ('barbell','squat_rack','bench','dumbbells','kettlebell',
                 'pullup_bar','nordic_bench','bands','cable_machine','mats',
                 'boards')),
  PRIMARY KEY (movement_id, item)
) STRICT, WITHOUT ROWID;

INSERT OR IGNORE INTO movement_equipment_v049 (movement_id, item)
  SELECT movement_id, item FROM movement_equipment;

DROP TABLE movement_equipment;
ALTER TABLE movement_equipment_v049 RENAME TO movement_equipment;

-- ---------------------------------------------------------------------------
-- 01 · Barbell Side Split Squat
-- correction_sha256 b50758455d04713009e5d6644d38ebf9bc0b71b72ac347aefeb62e6dd6d5c40e
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand tall with a barbell across the back of the shoulders and the feet placed wide apart, the lead foot angled out to the side. Bend the knee and hip of the lead leg to lower toward that side, keeping the trailing leg only slightly bent. Return by extending the hip and knee of the lead leg. Complete the reps on one side, then work the other.', cues = 'Angle the lead foot out before you descend. Shift toward the working side. Keep the trailing leg long.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Barbell Side Split Squat');
UPDATE movement_coaching_intent SET coaching_intent = 'Train one leg at a time through a wide lateral stance, shifting into the angled lead foot.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Barbell Side Split Squat');

-- ---------------------------------------------------------------------------
-- 02 · Bent Over Dumbbell Rear Delt Raise With Head On Bench
-- correction_sha256 d39f4dce066c5e72c8e73e8cb18a879a7304819e976227d3be44ba41943cf6aa
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand holding a dumbbell in each hand with an incline bench in front of you. Keeping the back in its natural arch, lean forward until the forehead rests on the bench and the arms hang straight down, palms facing each other. With a slight bend at the elbows, lift the dumbbells straight out to the side until the arms are parallel to the floor. Hold for a second, then lower along the same path.', cues = 'Rest the forehead on the bench throughout. Lift straight out to the side. Keep the torso still as the arms move.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Bent Over Dumbbell Rear Delt Raise With Head On Bench');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the rear deltoids through a lateral arc with the forehead resting on a bench for support.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Bent Over Dumbbell Rear Delt Raise With Head On Bench');

-- ---------------------------------------------------------------------------
-- 03 · Bent-Arm Dumbbell Pullover
-- correction_sha256 29e3e284812ea3c97259fd713a65f28d6d86b4f5c25b5210e9416f198dcc98eb
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie perpendicular across a flat bench with only the shoulders on the surface, hips low and feet flat on the floor. Hold one dumbbell over the chest with both palms pressed against the underside and the elbows bent. Keeping that elbow bend fixed, lower the dumbbell in an arc behind the head until you feel a stretch across the chest. Return along the same arc to the start.', cues = 'Set the elbow bend before rep one. Hold that angle the whole set. Keep the shoulders the only contact with the bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Bent-Arm Dumbbell Pullover');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the chest and lats through an overhead arc with the elbows held at a fixed bend.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Bent-Arm Dumbbell Pullover');

-- ---------------------------------------------------------------------------
-- 04 · Bent-Knee Hip Raise
-- correction_sha256 9460164a120fd400081098b22e2f89a5dcec456f2b7f215a840888f9ec819f0f
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie flat on the floor with the arms beside you, knees bent to about seventy-five degrees and the feet a couple of inches up. Draw the knees toward the chest, holding that knee angle, until the pelvis rolls back and the hips leave the floor. Squeeze at the top for a second, then lower slowly to the start.', cues = 'Roll the pelvis back to lift. Hold the knee angle throughout. Lower one segment at a time.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Bent-Knee Hip Raise');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the lower abdominals by rolling the pelvis back to lift the hips off the floor.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Bent-Knee Hip Raise');

-- ---------------------------------------------------------------------------
-- 05 · Board Press
-- correction_sha256 cc145660978190bceb59f0665221f0aa55c3af53b7dfe14f580fdb92b21273c3
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie on the bench and band the boards securely to the chest; confirm they remain fixed before unracking. Use a spotter when available. Set the feet, arch the back, and retract the shoulder blades, then take the bar out of the rack without protracting the shoulders. Lower the bar under control until it settles on the boards. Drive the bar up with force, keeping the elbows tucked until lockout.', cues = 'Keep the boards banded and fixed. Let the bar settle on the boards. Keep the elbows tucked to lockout.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Board Press');
UPDATE movement_coaching_intent SET coaching_intent = 'Press from a board-limited range to load the lockout portion of the bench press.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Board Press');
DELETE FROM movement_equipment WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Board Press');
INSERT OR IGNORE INTO movement_equipment (movement_id, item) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Board Press'), 'boards'),
  ((SELECT movement_id FROM movement WHERE name = 'Board Press'), 'bands'),
  ((SELECT movement_id FROM movement WHERE name = 'Board Press'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Board Press'), 'bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Board Press'), 'squat_rack');

-- ---------------------------------------------------------------------------
-- 06 · Cable Incline Pushdown
-- correction_sha256 65ad8f64dc27ae96be1904977d618c2f5eeabffd8781989edb5b586cf3c299d5
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie back on an incline bench set in front of a high pulley, facing away from the machine, with a straight bar overhead. Take an overhand shoulder-width grip and bring the arms down so the bar sits just above the thighs. Keeping the upper arms stationary, let the bar travel back overhead in a semicircle. Pull it back down to the thighs with the lats and hold the contraction.', cues = 'Keep the upper arms stationary. Move the bar in one smooth semicircle. Finish the pull with the lats.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cable Incline Pushdown');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the lats through shoulder extension while lying on an incline bench facing away from the stack.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cable Incline Pushdown');

-- ---------------------------------------------------------------------------
-- 07 · Cable Rear Delt Fly
-- correction_sha256 51d5431e48adc9af459fdfc0ccf96fa944c323c4db36d2b08b07df5315f82f38
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Set both pulleys above head height and select the load. Take the left handle in the right hand and the right handle in the left, crossed in front of you. Keeping the arms straight, move them back and outward until they reach the end of the arc. Pause, then return the handles to the crossed start position.', cues = 'Keep the arms straight throughout. Sweep back and outward. Pause at the end of the arc.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cable Rear Delt Fly');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the rear deltoids through a horizontal arc with the arms straight.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Cable Rear Delt Fly');

-- ---------------------------------------------------------------------------
-- 08 · Drag Curl
-- correction_sha256 1f6dc1c99ff1ff722c91038c895a38614dd54555b8a9ad73961e5b7c941e41df
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand tall holding a barbell against the front of the thighs with a shoulder-width underhand grip. Drag the bar straight up the torso, letting the elbows travel back behind the ribs as it rises. Lower along the same contact path; when the bar leaves the body, reduce the load.', cues = 'Keep the bar touching the torso. Let the elbows drift back. Lower along the same line.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Drag Curl');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the biceps with the bar kept in contact with the torso by drawing the elbows back as you curl.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Drag Curl');

-- ---------------------------------------------------------------------------
-- 09 · Dumbbell Bench Press with Neutral Grip
-- correction_sha256 b97f9dcf9f745328c446128b8eac1401c52f6ae9dfd809cf8745a7e871a8b0b9
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie back on a flat bench with a dumbbell in each hand, feet flat on the floor and the shoulder blades retracted. Start with the arms extended straight above you, palms facing each other. Bend the elbows to lower the upper arms out to the side until the dumbbells reach the torso. Pause, then extend the elbows back to the start.', cues = 'Keep the palms facing each other. Keep the bench flat and the shoulder blades set. Pause at the bottom of each rep.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Dumbbell Bench Press with Neutral Grip');
UPDATE movement_coaching_intent SET coaching_intent = 'Press from a flat bench with the palms facing each other throughout.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Dumbbell Bench Press with Neutral Grip');

-- ---------------------------------------------------------------------------
-- 10 · Dumbbell Lying Rear Lateral Raise
-- correction_sha256 5f257155cf916968e01f204f860d31886b6dc916cd6463ea593a4e7f633b8714
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie chest-down on an adjustable bench set to a shallow incline of about fifteen degrees, a dumbbell in each hand. Hold the palms facing the torso with the arms extended and the elbows slightly bent. Raise the arms out to the side until the elbows reach shoulder height and the arms are roughly parallel to the floor. Hold the contraction for a second, then lower under control.', cues = 'Keep the bench shallow and the chest down. Raise until the elbows reach shoulder height. Hold the top for a full second.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Dumbbell Lying Rear Lateral Raise');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the rear deltoids from a shallow fifteen degree incline with the chest supported.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Dumbbell Lying Rear Lateral Raise');

-- ---------------------------------------------------------------------------
-- 11 · Floor Glute-Ham Raise
-- correction_sha256 9f0856d24a6e4572e395d10abb3bb76eb110d4e0d20eff047d8928d0383ea1c3
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Kneel tall in a Nordic bench with the ankles locked under the foot pads, hips and shoulders in one line. Lower yourself forward by extending at the knees, keeping the hips straight rather than folding. Bring the hands to the floor to catch, then push lightly off the floor to help yourself back up.', cues = 'Keep the hips in line with the shoulders. Lower as slowly as you control. Let the hands catch and assist the return.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Floor Glute-Ham Raise');
UPDATE movement_coaching_intent SET coaching_intent = 'Build hamstring strength by lowering the body forward from a tall kneeling position with the ankles secured.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Floor Glute-Ham Raise');
DELETE FROM movement_equipment WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Floor Glute-Ham Raise');
INSERT OR IGNORE INTO movement_equipment (movement_id, item) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Floor Glute-Ham Raise'), 'nordic_bench');

-- ---------------------------------------------------------------------------
-- 12 · Front Incline Dumbbell Raise
-- correction_sha256 5f42c5b6c3d3394654cede5254491d8cc84e3236988978c394825c51fc01e333
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Sit back on an incline bench set between thirty and sixty degrees with a dumbbell in each hand. Extend the arms straight in front of you, palms facing down, dumbbells just above the thighs. Keeping the elbows locked, raise the dumbbells straight up until they are slightly above shoulder height. Squeeze for a second, then lower back to the start.', cues = 'Keep the elbows locked straight. Raise straight up in front. Keep the head resting on the bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Front Incline Dumbbell Raise');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the front deltoids by raising the arms straight forward from a supported incline position.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Front Incline Dumbbell Raise');

-- ---------------------------------------------------------------------------
-- 13 · Hammer Grip Incline DB Bench Press
-- correction_sha256 83e34d6176b3b1c17cb9cfd526d11bf64cdecf59b531968beb61e85840c628a8
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie back on an incline bench with a dumbbell in each hand resting on the thighs, palms facing each other. Use the thighs to help clean the dumbbells up one at a time until you hold them at shoulder width. Keeping the neutral grip, set the upper arms in line with the shoulders and the elbows bent to about ninety degrees. Lower the weights to the sides under full control, then press back up and hold the lockout for a second.', cues = 'Keep the palms facing each other. Keep the elbows in line with the shoulders. Lower twice as slowly as you press.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Hammer Grip Incline DB Bench Press');
UPDATE movement_coaching_intent SET coaching_intent = 'Press from an incline bench with the palms facing each other throughout.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Hammer Grip Incline DB Bench Press');

-- ---------------------------------------------------------------------------
-- 14 · Incline Dumbbell Bench With Palms Facing In
-- correction_sha256 911bc8ea4c6124456b146f5f98ee2bd3cfa36bd42de0230ed2b8991746fb35bf
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie back on an incline bench with a dumbbell in each hand resting on the thighs, palms facing each other. Use the thighs to help clean the dumbbells up one at a time until you hold them at shoulder width. Keeping the neutral grip, set the upper arms in line with the shoulders and the elbows bent to about ninety degrees. Lower the weights to the sides under full control, then press back up and hold the lockout for a second.', cues = 'Keep the palms facing each other. Keep the elbows in line with the shoulders. Lower twice as slowly as you press.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Bench With Palms Facing In');
UPDATE movement_coaching_intent SET coaching_intent = 'Press from an incline bench with the palms facing each other throughout.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Bench With Palms Facing In');

-- ---------------------------------------------------------------------------
-- 15 · Janda Sit-Up
-- correction_sha256 a1603d324734aac719dd781ad9d31372437f4aa7ecc42d550a07c48c68ff22a6
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie on your back with the knees bent to about ninety degrees and the feet flat on the floor, arms crossed over the chest or resting at your sides. Tighten the glutes and hamstrings hard and hold that tension, then curl the trunk up over a slow three to six second count. Lower back down under the same tension across a matching count.', cues = 'Squeeze the glutes and hamstrings first. Hold that tension for the whole rep. Take the descent as slowly as the climb.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Janda Sit-Up');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the abdominals with the glutes and hamstrings deliberately tightened, so the trunk does the work.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Janda Sit-Up');

-- ---------------------------------------------------------------------------
-- 16 · Kettlebell Seated Press
-- correction_sha256 d3586fc137e583413ae0b90869fafc06c1f1b2cc0cbc045684fb8e997d934771
-- ---------------------------------------------------------------------------
UPDATE movement SET pattern = 'push_v' WHERE name = 'Kettlebell Seated Press';
UPDATE movement_detail SET instructions = 'Sit on the floor with the legs spread comfortably wide for a stable base. Clean one kettlebell to the shoulder so the bell rests on the forearm. Press up and out until the arm locks out overhead, then return to the shoulder under control.', cues = 'Keep the legs wide and settled. Finish with the elbow locked overhead. Lower back to the rack position with intent.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Kettlebell Seated Press');
UPDATE movement_coaching_intent SET coaching_intent = 'Press a kettlebell overhead from a floor-seated position with the trunk holding you upright.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Kettlebell Seated Press');

-- ---------------------------------------------------------------------------
-- 17 · Kettlebell Turkish Get-Up (Lunge style)
-- correction_sha256 0fe12ef5517daa52df0e21b43c0cc5165fb36466be9e8b5f3aea6c021891c2a4
-- ---------------------------------------------------------------------------
UPDATE movement SET pattern = 'rotation', is_compound = 1 WHERE name = 'Kettlebell Turkish Get-Up (Lunge style)';
UPDATE movement_detail SET target_muscles = '["shoulders","abdominals","glutes","hamstrings","quadriceps","triceps"]' WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Kettlebell Turkish Get-Up (Lunge style)');
UPDATE movement_detail SET instructions = 'Lie on your back and press the kettlebell to a locked-out arm, then bend the knee on the same side. Keeping the arm locked out, pivot to the opposite side and use the free hand to drive forward and push up to a seated position, then to one knee. Looking up at the kettlebell, stand up from the one-knee position. Reverse the same sequence back to the floor.', cues = 'Keep the arm locked out the whole time. Look up at the bell as you rise. Reverse the same path back down.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Kettlebell Turkish Get-Up (Lunge style)');
UPDATE movement_coaching_intent SET coaching_intent = 'Move from lying to standing and back with a kettlebell locked out overhead the whole way.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Kettlebell Turkish Get-Up (Lunge style)');
UPDATE movement_taxonomy SET category = 'core', implement = 'kettlebell', family = 'turkish_get_up' WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Kettlebell Turkish Get-Up (Lunge style)');

-- ---------------------------------------------------------------------------
-- 18 · Kneeling Squat
-- correction_sha256 86f7db1cad30888774bf11834a745608fecfc04e4e90d9c344a3005de441e936
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Kneel tall in a rack with the bar on the back and the hips, knees and shoulders stacked. Sit the hips back toward the heels only as far as the trunk stays braced. Drive the hips forward to return to tall kneeling; when the ribs flare, shorten the range.', cues = 'Set the ribs down before you sit back. Move at the hips, not the low back. Finish tall through the glutes.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Kneeling Squat');
UPDATE movement_coaching_intent SET coaching_intent = 'Train hip extension under load from a kneeling position, with the trunk doing the bracing instead of the legs.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Kneeling Squat');

-- ---------------------------------------------------------------------------
-- 19 · Lying Rear Delt Raise
-- correction_sha256 4894e791b2707d2afc2cfcbfc0ca6dd6d4045800e98e9f5e31e842ba4a7cc3c7
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie chest-down on a flat bench with a dumbbell in each hand. Hold the palms facing the torso with the arms extended and the elbows slightly bent. Raise the arms out to the side until the elbows reach shoulder height and the arms are roughly parallel to the floor. Hold the contraction for a second, then lower under control.', cues = 'Keep the chest flat on the bench. Raise until the elbows reach shoulder height. Hold the top for a full second.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Lying Rear Delt Raise');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the rear deltoids from a flat bench with the chest fully supported.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Lying Rear Delt Raise');

-- ---------------------------------------------------------------------------
-- 20 · Middle Back Shrug
-- correction_sha256 416625095b92b1dd54ec99e13d1960ba86e49a3bc897704503aabeca9481ddda
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie chest-down on an incline bench holding a dumbbell in each hand with the arms hanging straight. Pull the shoulder blades back and together without bending the elbows, and pause at the top. Lower under control; when the elbows bend to move the load, reduce the weight.', cues = 'Keep the arms straight throughout. Squeeze the shoulder blades together. Let the chest stay on the bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Middle Back Shrug');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the mid-back by retracting the shoulder blades with the chest supported, without letting the arms pull.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Middle Back Shrug');

-- ---------------------------------------------------------------------------
-- 21 · Natural Glute Ham Raise
-- correction_sha256 7ef766a4317be9b4904c3cfe5cfedca32fe1d72fcb43458dcaa605f87782c539
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Set up in a Nordic bench with the ankles locked under the foot pads and a band anchored to assist the return. Start upright with good posture, then lower yourself under control until the knees are almost straight. Reverse the movement and pull yourself back to upright, letting the band assist only as much as you need.', cues = 'Keep the hips in line with the shoulders. Lower as slowly as you control. Let the band assist the reversal.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Natural Glute Ham Raise');
UPDATE movement_coaching_intent SET coaching_intent = 'Build hamstring strength by controlling the descent and reversing it with band assistance.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Natural Glute Ham Raise');
DELETE FROM movement_equipment WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Natural Glute Ham Raise');
INSERT OR IGNORE INTO movement_equipment (movement_id, item) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Natural Glute Ham Raise'), 'nordic_bench'),
  ((SELECT movement_id FROM movement WHERE name = 'Natural Glute Ham Raise'), 'bands');

-- ---------------------------------------------------------------------------
-- 22 · Reverse Flyes
-- correction_sha256 85c337efc8b85079c9b3d3198d56c5d0b685a0c623ee4a6ae676e495ebaa34cf
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie chest-down on an incline bench with a dumbbell in each hand, palms facing each other. Extend the arms so they hang perpendicular to the bench angle. Holding a slight bend at the elbows, move the weights out and away from each other in an arc until the arms are parallel to the floor. Squeeze the shoulder blades together, then lower under control.', cues = 'Keep the chest on the bench. Sweep the weights out and apart. Squeeze the shoulder blades at the top.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Reverse Flyes');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the rear deltoids through a wide horizontal arc with the chest supported on an incline bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Reverse Flyes');

-- ---------------------------------------------------------------------------
-- 23 · Rope Straight-Arm Pulldown
-- correction_sha256 5e5189d79ab81c893792462607e17218324f85bb76634f689dc9c59bcef71f87
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand facing a high pulley with a rope, feet staggered, arms extended up and in front of you and a slight hinge at the hips. Keeping the elbows straight, sweep the rope down in an arc until the hands reach the thighs. Return overhead under control; when the elbows start to bend, reduce the load.', cues = 'Keep the elbows straight the whole rep. Move from the shoulders. Feel the lats finish the arc.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Rope Straight-Arm Pulldown');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the lats through shoulder extension with the elbows locked out, so the arms never take over.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Rope Straight-Arm Pulldown');

-- ---------------------------------------------------------------------------
-- 24 · Seated Dumbbell Palms-Down Wrist Curl
-- correction_sha256 786e7fd8fa513b66d7a142da7002bea6045ac2521249c4ac4fb4c8ad5951a15b
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Sit on the edge of a flat bench with the forearms resting on the thighs, palms facing down and the wrists just past the knees. Let the wrists drop, then lift the backs of the hands as far as the range allows without the elbows moving. Lower slowly; when the elbows lift to help, reduce the load.', cues = 'Keep the forearms flat and still. Lift the backs of the hands. Own the full return.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Palms-Down Wrist Curl');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the wrist extensors through a controlled range with the forearms supported.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Palms-Down Wrist Curl');

-- ---------------------------------------------------------------------------
-- 25 · Seated Dumbbell Palms-Up Wrist Curl
-- correction_sha256 a79d3273500581b8991b56a443cebbfe3cd4c6db97e8e29b16cb0db36dbb40b3
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Sit on the edge of a flat bench with the forearms resting on the thighs, palms facing up and the wrists just past the knees. Let the wrists open under the load, then curl the palms up as far as the range allows without the elbows moving. Lower slowly into the stretch; when the elbows lift to help, reduce the load.', cues = 'Keep the forearms flat and still. Curl the palms toward the forearms. Own the full return.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Palms-Up Wrist Curl');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the wrist flexors through a controlled range with the forearms supported.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Palms-Up Wrist Curl');

-- ---------------------------------------------------------------------------
-- 26 · Seated Dumbbell Press
-- correction_sha256 da8037f2b028a0b4501e8881c21e0f8cc7c2e9abfd41f0a8aa8acabfed188ee0
-- ---------------------------------------------------------------------------
UPDATE movement SET pattern = 'push_v' WHERE name = 'Seated Dumbbell Press';
UPDATE movement_detail SET instructions = 'Sit on a bench with a back support, a dumbbell in each hand cleaned from the thighs to shoulder height, palms turned to face forward. Brace, then press both dumbbells overhead until they meet at the top. Pause, then lower to the shoulders under control; when the back arches off the bench, reduce the load.', cues = 'Keep the back on the bench. Stack the wrists over the elbows. Finish overhead with a quiet ribcage.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Press');
UPDATE movement_coaching_intent SET coaching_intent = 'Press dumbbells overhead from a supported seated position while the ribcage stays quiet.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Press');

-- ---------------------------------------------------------------------------
-- 27 · Seated Good Mornings
-- correction_sha256 3880f5cd394c4e1bba6fefdbf3b7b1b410f5f49c5b9ac25b241a8db1dd38cd58
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Set a bench inside a power rack and set the pins at the depth you intend to reach. Take the bar across the back of the shoulders, squeeze the shoulder blades together, step back and sit down on the bench. Keeping the bar tight and the lower back arched, bend forward at the hips until the bar approaches the pins. Pause just above the pins and reverse the motion until the torso is upright.', cues = 'Set the pins before the first rep. Move at the hips with the back arched. Pause just above the pins each rep.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Seated Good Mornings');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the posterior chain through a seated hip hinge, with the rack pins defining the depth.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Seated Good Mornings');
DELETE FROM movement_equipment WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Seated Good Mornings');
INSERT OR IGNORE INTO movement_equipment (movement_id, item) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Seated Good Mornings'), 'barbell'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Good Mornings'), 'squat_rack'),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Good Mornings'), 'bench');

-- ---------------------------------------------------------------------------
-- 28 · Seated Side Lateral Raise
-- correction_sha256 f5a703b1c1d69a7d2ace0a563b6e0583f21c500db37f5fd0515a495d17db7f94
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Sit at the end of a flat bench with the feet firmly on the floor and a dumbbell in each hand hanging by your sides, palms facing in. Keeping the torso still, lift the dumbbells out to the side with a slight bend at the elbow, hands tilted slightly forward as if pouring water. Continue until the arms are parallel to the floor and pause for a second. Lower back down slowly to the start.', cues = 'Lift out to shoulder level. Tilt the hands as if pouring water. Keep the torso quiet throughout.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Seated Side Lateral Raise');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the side deltoids by raising the arms out to the side from a seated start.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Seated Side Lateral Raise');

-- ---------------------------------------------------------------------------
-- 29 · Standing Dumbbell Press
-- correction_sha256 03400d1846566719252d57541ecb9d843ce8f8e1b93b558ea9b0241848078718
-- ---------------------------------------------------------------------------
UPDATE movement SET pattern = 'push_v' WHERE name = 'Standing Dumbbell Press';
UPDATE movement_detail SET instructions = 'Stand with the feet shoulder width apart and raise the dumbbells to head height, elbows out at about ninety degrees. Brace, then press both dumbbells overhead until the arms finish straight, without leg drive or leaning back. Pause, then lower to the start under control.', cues = 'Stay tall through the torso. Stack the wrists over the elbows. Finish overhead with a quiet ribcage.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Press');
UPDATE movement_coaching_intent SET coaching_intent = 'Press dumbbells overhead from a tall standing position while the trunk stays braced.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Press');

-- ---------------------------------------------------------------------------
-- 30 · Standing Palm-In One-Arm Dumbbell Press
-- correction_sha256 00371501f0a201c3430c741d5d3c188bc8e9baf35e0189740baf0e1da35e3899
-- ---------------------------------------------------------------------------
UPDATE movement SET pattern = 'push_v' WHERE name = 'Standing Palm-In One-Arm Dumbbell Press';
UPDATE movement_detail SET instructions = 'Stand with the feet shoulder width apart, one dumbbell at shoulder height in a neutral grip, palm facing in. Hold the incline bench with the free hand to keep your balance throughout the set. Press until the arm is fully extended overhead, then lower until the elbow returns to about ninety degrees. Finish all reps on one side, then switch arms.', cues = 'Keep the palm facing in throughout. Let the free hand steady you on the bench. Keep the forearm stacked under the bell.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Standing Palm-In One-Arm Dumbbell Press');
UPDATE movement_coaching_intent SET coaching_intent = 'Press one dumbbell overhead with a neutral grip while the free hand steadies you on an incline bench.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Standing Palm-In One-Arm Dumbbell Press');

-- ---------------------------------------------------------------------------
-- 31 · Step-up with Knee Raise
-- correction_sha256 120c678ec47b9811443b371039c77e9f48cad96874dbbd4cff19a25b93e51b9d
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Stand facing a box or bench of a height you can control, feet together. Step up by placing one whole foot on the top and extending the hip and knee to stand tall. As you stand, drive the opposite knee up as high as you can. Reverse the motion to step down, then repeat on the other leg.', cues = 'Drive through the whole stepping foot. Stand tall before the knee comes up. Lower under control on every rep.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Step-up with Knee Raise');
UPDATE movement_coaching_intent SET coaching_intent = 'Build single-leg strength and balance by stepping onto a box and driving the trailing knee up.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Step-up with Knee Raise');

-- ---------------------------------------------------------------------------
-- 32 · Straight-Arm Dumbbell Pullover
-- correction_sha256 94f454bad821e3e2c357f21856c2d2ffc322f10358735fac909ce15a22827dc6
-- ---------------------------------------------------------------------------
UPDATE movement_detail SET instructions = 'Lie perpendicular across a flat bench with only the shoulders on the surface, hips low and feet flat on the floor. Hold one dumbbell over the chest at full extension with both palms pressed against the underside. Keeping the arms straight, lower the dumbbell in a wide arc behind the head until you feel a stretch across the chest. Return along the same arc to the start.', cues = 'Keep the elbows straight throughout. Reach long behind the head. Return along the same arc.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Straight-Arm Dumbbell Pullover');
UPDATE movement_coaching_intent SET coaching_intent = 'Train the chest and lats through a long overhead arc with the elbows straight.'
  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Straight-Arm Dumbbell Pullover');

-- ---------------------------------------------------------------------------
-- Full-body scope assignments (seeded by name, matching the 037-048 idiom).
-- The canonical Kettlebell Turkish Get-Up is a LEGACY v1 record: it receives a
-- scope row and nothing else, so its v1 fingerprint and reviewed YouTube
-- fallback stay byte-identical.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO movement_scope (movement_id, scope) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Turkish Get-Up'), 'full_body'),
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Turkish Get-Up (Lunge style)'), 'full_body');

-- ---------------------------------------------------------------------------
-- Provenance. Table existence proves 049 ran; it proves nothing about row
-- presence or content integrity — verify_library.py checks those separately.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO movement_content_correction
  (movement_id, correction_version, correction_sha256, applied_at_ms) VALUES
  ((SELECT movement_id FROM movement WHERE name = 'Barbell Side Split Squat'), 1, 'b50758455d04713009e5d6644d38ebf9bc0b71b72ac347aefeb62e6dd6d5c40e', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Bent Over Dumbbell Rear Delt Raise With Head On Bench'), 1, 'd39f4dce066c5e72c8e73e8cb18a879a7304819e976227d3be44ba41943cf6aa', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Bent-Arm Dumbbell Pullover'), 1, '29e3e284812ea3c97259fd713a65f28d6d86b4f5c25b5210e9416f198dcc98eb', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Bent-Knee Hip Raise'), 1, '9460164a120fd400081098b22e2f89a5dcec456f2b7f215a840888f9ec819f0f', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Board Press'), 1, 'cc145660978190bceb59f0665221f0aa55c3af53b7dfe14f580fdb92b21273c3', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Incline Pushdown'), 1, '65ad8f64dc27ae96be1904977d618c2f5eeabffd8781989edb5b586cf3c299d5', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Cable Rear Delt Fly'), 1, '51d5431e48adc9af459fdfc0ccf96fa944c323c4db36d2b08b07df5315f82f38', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Drag Curl'), 1, '1f6dc1c99ff1ff722c91038c895a38614dd54555b8a9ad73961e5b7c941e41df', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Bench Press with Neutral Grip'), 1, 'b97f9dcf9f745328c446128b8eac1401c52f6ae9dfd809cf8745a7e871a8b0b9', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Dumbbell Lying Rear Lateral Raise'), 1, '5f257155cf916968e01f204f860d31886b6dc916cd6463ea593a4e7f633b8714', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Floor Glute-Ham Raise'), 1, '9f0856d24a6e4572e395d10abb3bb76eb110d4e0d20eff047d8928d0383ea1c3', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Front Incline Dumbbell Raise'), 1, '5f42c5b6c3d3394654cede5254491d8cc84e3236988978c394825c51fc01e333', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Hammer Grip Incline DB Bench Press'), 1, '83e34d6176b3b1c17cb9cfd526d11bf64cdecf59b531968beb61e85840c628a8', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Incline Dumbbell Bench With Palms Facing In'), 1, '911bc8ea4c6124456b146f5f98ee2bd3cfa36bd42de0230ed2b8991746fb35bf', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Janda Sit-Up'), 1, 'a1603d324734aac719dd781ad9d31372437f4aa7ecc42d550a07c48c68ff22a6', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Seated Press'), 1, 'd3586fc137e583413ae0b90869fafc06c1f1b2cc0cbc045684fb8e997d934771', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Kettlebell Turkish Get-Up (Lunge style)'), 1, '0fe12ef5517daa52df0e21b43c0cc5165fb36466be9e8b5f3aea6c021891c2a4', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Kneeling Squat'), 1, '86f7db1cad30888774bf11834a745608fecfc04e4e90d9c344a3005de441e936', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Lying Rear Delt Raise'), 1, '4894e791b2707d2afc2cfcbfc0ca6dd6d4045800e98e9f5e31e842ba4a7cc3c7', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Middle Back Shrug'), 1, '416625095b92b1dd54ec99e13d1960ba86e49a3bc897704503aabeca9481ddda', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Natural Glute Ham Raise'), 1, '7ef766a4317be9b4904c3cfe5cfedca32fe1d72fcb43458dcaa605f87782c539', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Reverse Flyes'), 1, '85c337efc8b85079c9b3d3198d56c5d0b685a0c623ee4a6ae676e495ebaa34cf', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Rope Straight-Arm Pulldown'), 1, '5e5189d79ab81c893792462607e17218324f85bb76634f689dc9c59bcef71f87', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Palms-Down Wrist Curl'), 1, '786e7fd8fa513b66d7a142da7002bea6045ac2521249c4ac4fb4c8ad5951a15b', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Palms-Up Wrist Curl'), 1, 'a79d3273500581b8991b56a443cebbfe3cd4c6db97e8e29b16cb0db36dbb40b3', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Dumbbell Press'), 1, 'da8037f2b028a0b4501e8881c21e0f8cc7c2e9abfd41f0a8aa8acabfed188ee0', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Good Mornings'), 1, '3880f5cd394c4e1bba6fefdbf3b7b1b410f5f49c5b9ac25b241a8db1dd38cd58', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Seated Side Lateral Raise'), 1, 'f5a703b1c1d69a7d2ace0a563b6e0583f21c500db37f5fd0515a495d17db7f94', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Dumbbell Press'), 1, '03400d1846566719252d57541ecb9d843ce8f8e1b93b558ea9b0241848078718', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Standing Palm-In One-Arm Dumbbell Press'), 1, '00371501f0a201c3430c741d5d3c188bc8e9baf35e0189740baf0e1da35e3899', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Step-up with Knee Raise'), 1, '120c678ec47b9811443b371039c77e9f48cad96874dbbd4cff19a25b93e51b9d', 1786406400000),
  ((SELECT movement_id FROM movement WHERE name = 'Straight-Arm Dumbbell Pullover'), 1, '94f454bad821e3e2c357f21856c2d2ffc322f10358735fac909ce15a22827dc6', 1786406400000);
