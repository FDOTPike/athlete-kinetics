# MOV-S1-R3 repair report (`movement-56-stream1-r3`)

- Branch: `movement/56-stream1-r3-2026-10-18`
- Base: `defb8bce46daeba89fc7a50b2a7a9e62edaf31d8`
- Source commit: `617e906b302a05f3db7fc2674ed8a47d7ff90f57`
- Baseline probe: `probe-f639bbbf1370267bf24f5939a3bc2212e330bbd1.json`
- Allowed to change: 130, 5, 107, 104, 79, 184, 213, 240, 98, 288, 78, 23, 249. Changed: all thirteen; the probe reports nothing else changed and no overflow.
- Signed: builder

All values are world units from `chainGeometry(slug, phase, BODY).world`, measured at every 33 ms tick of the authored cycle unless a single pose is named. Painted widths are the tests': thigh half 2.832, shin half 2.16, foot cap 2.16, chest half 5.916, hand radius 2.212, bar half 0.8.

## Major: 130 Alternating Kettlebell Row

| Measure | Audit | Now | Bound |
| --- | --- | --- | --- |
| Knees, both sides, every tick | 121.5 deg | 151.28 deg | 150 to 165 |
| Body centre of mass inside the painted foot (smallest margin) | about 5 behind the heel | 4.48 | > 0 |
| Same, with the rowed bell (a fifth of body mass) in the hand | | 2.83 | > 0 |
| Floor bells, painted bottom on the floor line, start and midpoint | | 96.9 | 96.9 (1 dp) |
| View | yaw 28 | yaw 50, no pitch | far row visible |

Hips at x 5 over ankles at 14 with the flat trunk 22.7 deg below level, so straight plumb arms reach handles on floor bells. The downward pitch an earlier draft added lifted the near and far bells off the floor line by different amounts (a projection of z); with pitch removed and the view turned 50 deg both bells rest on the floor and the far row's bell is drawn clear of the torso and legs at its peak.

## Correction to MOV-A05-R2: 249 One-Arm Kettlebell Floor Press

| Measure | Now | Bound |
| --- | --- | --- |
| Locked arm (shoulder to wrist) from vertical | 1.50 deg | <= 5 |
| Hand off plumb over the shoulder | 0.64 | <= 1.0 |
| Painted bell centre off plumb over the shoulder | 1.64 | <= 2.5 |
| Bell start off plumb over the elbow | 2.20 | <= 2.5 |
| Elbow's offset from the shoulder (anatomy, not drift) | 11.70 | |
| Headward travel beyond the elbow's offset | 1.30 | <= 3 |
| Bell rise | 16.87 | > 12 |
| Top elbow | 174.33 deg | >= 172 |

The bottom pose is unchanged (upper arm 45 deg out on the floor, wrist over the elbow). The lockout hand is set 0.64 off plumb against the direction the turned bell rests from the wrist, so the bell, not just the hand, finishes over the shoulder.

## Minor

**5 Barbell Row and 107 Reverse Grip Bent-Over Rows.** Hips at (-4.245, 43.363), trunk 49 deg, knees 150 deg, ankles at 8 (toe 13.4). The bar hangs plumb under the shoulders (0.000 off) at x 11.50, 0.80 ahead of mid-foot (bound 1.0). With the bar at half body mass the loaded centre of mass stays over the painted foot at every tick (smallest margin 0.45 for 5, 0.26 for 107). The row now finishes at the lower ribs, 12 up the trunk (it was 10); 107 touches the chest's painted surface (bar 6.716 below the trunk line, bound CHEST_HALF + 0.8 within 0.1). A loaded bent-over row at the old 24 deg trunk cannot balance in this rig: rowed to the ribs, the bar travels back about 16 and takes the loaded centre of mass behind the heel; 49 deg is close to the shallowest that holds at every tick (the test allows 15 to 60, the text sets no angle). 107 caption 1 is now the text's sentence ("... until the bar hangs below them with the torso braced.").

**104 One-Arm Kettlebell Row.** The free hand rests on the front thigh four fifths of the way to the knee: wrist to thigh axis 5.044 at every tick (THIGH_HALF + HAND_RADIUS = 5.044).

**79 T-Bar Row.** The floor pivot moved from x -32 to -36 and the top is at 42.3 deg on the circle through the plumb bottom, so the bar is a little flatter than the 45 deg trunk at the top. Handle 7.037 below the trunk line (bound 6.816 to 7.116); plate hubs 7.311 and 7.181 (bound >= 7.116); elbows 3.95 behind the trunk (pole changed from [135, 25] to [135, 0], no flare). New close-up of the near hand, `grip: 'neutral'`: the handle is drawn across the fist, square to the forearm on screen (|cos| 0.0000), standing out either side.

**184 Drag Curl.** Three keyframes. Start: shoulders drawn 1.5 down (an arm hanging straight from the shoulder cannot otherwise reach below the hip crease); bar 1.674 below the hip (bound >= 1.4) at the thigh front plus the bar half width (3.652 against 3.632, bound 0.05). Then across the crease and up the tapering trunk front, 0.1 off the painted surface. The forearm is 12 long, so with the bar on the chest at the height the text asks for (rise 15.07) the elbow can come at most 12 behind it, which is in front of the ribs' back: the hips ease 0.7 back at the top with the feet planted (legs 0.9 deg from vertical, every bone at its real length), and the elbows finish at -6.306 (bound < -6.016). Underhand close-up: palm forward (0.984).

**Grip close-ups (213, 240).** 213 High Cable Curls: palm up at the start (-0.995) and toward the head at the top (0.551, bound > 0.5). That needs the curled hand level with the head: the shoulders are lifted 3 (as with arms raised to shoulder height, both poses, so the upper arms stay still) and the top forearm rises 33 deg (elbow 33 deg, wrist 13.251 from the midline against 13.384). A new opt-in close-up rule, `palm: 'flexion'`, puts the palm on the inside of the elbow's bend. 240 Lying Cable Curl: palm up (-0.996).

**98 Barbell Hack Squat.** Ankle span 14.80 against hip joints 13.60 apart (bound a sixth, 2.27); grip 18.77 against shoulders 18.77 (arms hang straight down, no outward turn). Bar behind the legs within 1.329 of the nearer surface at every tick (bound 1.5), clear by at least 0.124; the plates still touch the floor.

**288 Stiff-Legged Barbell Deadlift.** Nine keyframes: the hips go back early, the legs leaning back at the fixed knee, and the arms hang within 9 deg of plumb. The bar is within 1.099 of the surface of the leg segment at its height at every tick (bound 1.5), clear by at least 0.152; 288 is in the close-to-legs set.

**78 Sumo Deadlift.** Restored bound: start trunk drawn 45.07 deg above level (>= 45). The trunk is 34.85 deg in the body's plane, the neck set so the shoulders and bar stay put; the stance is 2 wider each side (ankles at z +-27) and the knees pushed further out, so the hips stay 0.88 above the knees on screen (> 0.5) and the shins clear the bar (0.039); through the knees the arms hang 3 and 1 deg further back so the bar stays within 1.290 of the legs. Over the wider stance the lockout hips finish 0.96 lower, where the legs reach the floor at full length. The view is unchanged (46 deg, shared by the sumo family).

**23 Nordic Curl.** Catch caption: 'Catch with the hands.' (no push-up position, no "when you can no longer hold").

## Open points

1. **288 balance.** "Bar close to the legs" within 1.5 at every tick, with the fixed knee and arms within 10 deg of vertical, holds only with the hips far back (to -22.98): with the bar at half body mass the loaded centre of mass is up to 9.08 behind the painted heel mid-descent. The base drawing kept the centre of mass over the foot at every tick but let the bar swing 9 off the thighs. Scanning every trunk angle, the closest a balanced figure gets is 1.6 to 3.75 between about 65 deg and the bottom; at the bottom alone it can be within 1.33. No test measures 288's balance. If balance is preferred, the 1.5 bound would apply at the bottom only.
2. **Close-up census.** `MovementPreview.fingerCurls.test.js` lists every movement with a close-up; it now includes `t-bar-row`, `drag-curl`, `high-cable-curls` and `lying-cable-curl`, which this order asks for.

## Gates

typecheck exit 0; MovementPreview jest 65 of 65 suites, 3789 of 3789 tests, exit 0; storage guard exit 0; evidence gate exit 0; rendered-output probe exit 0 (232 movements, the thirteen above changed, nothing unexpected, no overflow). See `typecheck.log`, `jest-movement-preview.log`, `storage-guard.log`, `evidence-gate.log` and `rendered-output-probe.log`, each naming the source commit. Renders of all thirteen cycles are in `movement-<id>/neutral-cycle.png`.
