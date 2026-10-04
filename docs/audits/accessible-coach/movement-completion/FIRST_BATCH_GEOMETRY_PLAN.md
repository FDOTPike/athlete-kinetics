# First batch: independent geometry acceptance plan

Frozen source: feature commit `12a1fb15aff5611b771348a53e2e04f4079e0e34`. These are proposed repair requirements for independent review, not a technique approval. Root owns implementation.

## 143: forehead-supported rear lateral raise

Use a front or oblique primary action view that shows the arms sweeping laterally, with a side view/inset proving the hinge and forehead contact. A sagittal forward/back arm swing does not depict a lateral raise. Both views must represent the same pose/action; do not merely mirror or relabel a row.

The torso, pelvis, feet and head stay quiet. Each elbow has a fixed slight bend while the entire arm sweeps out toward parallel to the floor. The source does not call for an elbow-flexing row. Keep both dumbbells continuously attached to the palms and visible with clearance from the bench/body. Hold the top for at least 1000 ms, then return along the same lateral arc to hanging arms.

Draw an actual adjustable incline bench in front. Place the forehead skin surface against the bench pad surface in every frame and interpolated pose, without a gap or head penetrating the pad. The bench supports the forehead; it does not support the chest or sit behind an unsupported floating head. Check body-specific head radii/neck lengths in both body variants. A marker touching the center of the head is not contact proof.

Regression: ID 110 is a wide-elbow barbell row to the upper chest with active elbow flexion; it must stay distinct. The legacy identical raw poses for 110 and 143 are a failure, even if captions differ.

## 82: standing scapular shrug

Use a front/side view that makes the shoulder girdle displacement clear. Fix the head, trunk/rib anchor, pelvis, hips, knees and all foot contacts. Animate each shoulder-girdle/arm root upward and modestly backward relative to that fixed torso anchor. Preserve the source up/back cue without inventing a circular shoulder roll.

The elbow remains at the natural straight position and the wrist stays on the same long-arm chain; the bar/load follows the translating arm roots. The legacy 135.35-degree elbow and whole-body 4.5-unit bounce fail. Do not achieve a shrug by lifting the head/pelvis, extending the knees, bending the elbows or pitching the trunk. The current rig conflates its torso/head shoulder anchor with the arm root; distinguish those responsibilities if required to preserve head/trunk position.

Hold top at least 1000 ms, then lower through the same path into the source-controlled stretch. Check neutral, male and female body resolvers, all interpolated segments and loop boundary. Regression candidates: 53 dumbbells, 138 behind-back bar, 163 cable; their setup/anchor/grip details remain independent source questions.

## 92, 158, 253: supported preacher curls

A side or three-quarter primary camera best shows the sagittal elbow arc and sloped pad contact. Add a front/grip view to prove 92 underhand bar, 158 underhand low-cable bar, and 253 neutral dumbbells. A front crossing pose with no readable pad contact is insufficient.

Keep each body-specific shoulder and supported elbow fixed in world/pad coordinates. Construct one supported upper-arm direction from the accepted setup, with declared length U=12.5, then fix elbow E=S+U*u. Move wrist W=E+F*(cos(phi),sin(phi)) with the declared F=12.0. Interpolate phi on the intended elbow-flexion arc rather than interpolating Cartesian wrist endpoints and re-solving a moving elbow. Near/far limbs may have different projected orientations but each must keep its own supported elbow and grip consistent.

The pad must support the actual upper-arm surface along its sloped edge; locate the apparatus from the accepted arm/contact geometry rather than leaving an unrelated rectangular pad. Chest support and feet remain quiet. Hands/load never teleport, detach or pass through the pad. The low-cable vector in 158 runs to its real low pulley and remains taut/clear.

Start at the natural long-arm position allowed by the supported setup, curl toward source shoulder endpoint without shoulder lift, then return completely to that same position. The existing final angles fail: 92 ends about100.34 degrees versus first170.62; 158 ends109.56 versus176.94; 253 ends78.57 versus149.07. Copying final to first is necessary closure evidence but does not fix moving elbows or the already-bent 253 start. Source-specific natural endpoint still needs to be authored honestly.

Lower slower than ascent for 92; the existing three-count lowering caption must be supported by actual approximately three-second descent or the independently accepted source/caption must be corrected together. Preserve explicit slow controlled return for 158. For 253, the requested draft repair can be made with preacher support and neutral DB grip, but current generic source does not explicitly establish pad setup; final signoff needs setup/grip/full-return source confirmation. Remove its underhand-bar caption.

## Exact source bindings

### 143: Bent Over Dumbbell Rear Delt Raise With Head On Bench

Source: [packages/core-db/src/schema/049_movement_content_correction_v1.sql](<C:/Users/fpike/.codex/worktrees/release-feature-audit-2026-10-04/Athlete App/packages/core-db/src/schema/049_movement_content_correction_v1.sql:68>) at frozen commit `12a1fb15aff5611b771348a53e2e04f4079e0e34`.

Stand holding a dumbbell in each hand with an incline bench in front of you. Keeping the back in its natural arch, lean forward until the forehead rests on the bench and the arms hang straight down, palms facing each other. With a slight bend at the elbows, lift the dumbbells straight out to the side until the arms are parallel to the floor. Hold for a second, then lower along the same path.

Cues: Rest the forehead on the bench throughout. Lift straight out to the side. Keep the torso still as the arms move.

Equipment: bench, dumbbells.

### 82: Barbell Shrug

Source: [packages/core-db/src/schema/017_movement_batch.sql](<C:/Users/fpike/.codex/worktrees/release-feature-audit-2026-10-04/Athlete App/packages/core-db/src/schema/017_movement_batch.sql:30>) at frozen commit `12a1fb15aff5611b771348a53e2e04f4079e0e34`.

Hold a barbell in front of your thighs with straight arms, at your natural standing width. With intention, pull your shoulder blades up and back behind your ears as high as the traps will take them. Hold the top for a full second, then lower until the weight stretches the traps. The bar lets you load heavier than dumbbells — earn it with the same strict path.

Cues: Up and back behind the ears, with intention. Own a full second at the top. Arms stay ropes — traps lift, hands just hold.

Equipment: barbell.

### 92: Preacher Curl

Source: [packages/core-db/src/schema/025_movement_coaching_content.sql](<C:/Users/fpike/.codex/worktrees/release-feature-audit-2026-10-04/Athlete App/packages/core-db/src/schema/025_movement_coaching_content.sql:106>) at frozen commit `12a1fb15aff5611b771348a53e2e04f4079e0e34`.

Set your upper arms flat on the preacher pad, chest against it, bar in an underhand grip. Curl to shoulder height, then lower slower than you lifted until your arms reach their natural long position on the pad. The pad removes every cheat you own — expect to lift less than your standing curl, and let that be information.

Cues: Keep the upper arms on the pad. Lower on a three-count into the natural long position. Settle at the bottom before the next curl.

Equipment: barbell, bench.

### 158: Cable Preacher Curl

Source: [packages/core-db/src/schema/068_movement_content_correction_v2.sql](<C:/Users/fpike/.codex/worktrees/release-feature-audit-2026-10-04/Athlete App/packages/core-db/src/schema/068_movement_content_correction_v2.sql:196>) at frozen commit `12a1fb15aff5611b771348a53e2e04f4079e0e34`.

Set a preacher bench in front of a low pulley, sit with the upper arms flat on the pad and hold the straight bar with an underhand grip, arms extended. Keeping the upper arms on the pad, curl the bar up toward the shoulders. Squeeze, then lower slowly until the arms are extended.

Cues: Upper arms stay flat on the pad. Curl to shoulder height. Lower slowly.

Equipment: bench, cable_machine.

### 253: Preacher Hammer Dumbbell Curl

Source: [packages/core-db/src/schema/045_movement_library_v2_batch.sql](<C:/Users/fpike/.codex/worktrees/release-feature-audit-2026-10-04/Athlete App/packages/core-db/src/schema/045_movement_library_v2_batch.sql:35>) at frozen commit `12a1fb15aff5611b771348a53e2e04f4079e0e34`.

Set up Preacher Hammer Dumbbell Curl with bench, dumbbells and choose a load or range you can control. Hold the upper arms still, curl the load through the forearms, and squeeze without lifting the shoulders. When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.

Cues: Keep the upper arms quiet. Curl through the forearms. Own the lowering phase.

Equipment: bench, dumbbells.

## Independent evidence requested

Supply exact revision, modified source/asset hashes, every frame/segment duration, and rendered complete cycles for each body variant. Capture the defined main/contact/grip views at usable size with slow/scrubbed evidence and ordinary-speed motion. Include the start, peak, controlled return and loop boundary.

Geometry assertions are useful evidence for fixed anchors, lengths, angle, contact gaps and duration. A human visual assessment must still compare the physical action to the source. A separate runtime auditor will check native smoothness/lifecycle and timing; neither role should approve the other criterion by implication.

Known baseline evidence and exact source limitations are in the preceding MOVEMENT_TECHNIQUE_AUDIT.md. No new implementation/render revision has been reviewed in this plan.
