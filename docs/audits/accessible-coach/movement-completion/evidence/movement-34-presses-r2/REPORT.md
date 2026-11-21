# MOV-A05-R2 repair report (`movement-34-presses-r2`)

- Branch: `movement/53-presses-repairs-r2-2026-10-18`
- Base: `02fe5a77aa98a922910d21bef6c978c7f4520e05`
- Source commit: `f639bbbf1370267bf24f5939a3bc2212e330bbd1`
- Baseline probe: `probe-818fc33ecfc1efb7c0a0158bbbb843dbe056d6e9.json`
- Allowed to change: 249, 65, 8, 208, 81. Changed: 249, 65, 8, 208. Zercher Squat (81) is unchanged in drawing (tests added only).
- Signed: builder

All values are world units from `chainGeometry(slug, phase, BODY).world`, at every 33 ms tick of the authored cycle.

## 249 One-Arm Kettlebell Floor Press

| Measure | MOV-A05-R1 | Now | Bound |
| --- | --- | --- | --- |
| Upper arm out from the trunk, floor plane, at the start | 67.37 deg | 45.00 deg | 30 to 50 deg |
| Bottom forearm from vertical | 0.00 deg | 0.005 deg | <= 1 deg |
| Bottom elbow centre height (painted edge on the floor) | 2.113 | 2.112, never lower over the cycle | 2.112 +- 0.05 |
| Painted bell centre, largest horizontal offset from its start (x and z) | 4.50 headward and 11.60 inward (audit) | 2.401 | <= 3 at every tick |
| Horizontal path of the bell centre over the press | | 2.397 | <= 3 |
| Bell rise | 16.83 | 14.18 | > 12 |
| Top elbow | 176.42 deg | 175.94 deg | >= 172 deg |
| Top segment | 400 ms (a hold) | 200 ms | <= 200 ms |

The bell centre is the painted one (the hold plus the bell's rest on the back of the wrist, which turns with the wrist). A new exported helper `chainKettlebellCentre` gives the painter and the test the same point. The hand moves 1.8 toward the feet and 0.8 outward as it rises so the turning bell stays over its start; the remaining 2.4 of drift is toward the shoulder.

View: turned 45 degrees the other way (`yawDeg` 16 to -45). A unit horizontal step of the bell toward the shoulder moves it 0.993 on screen; a step along or across the trunk, 0.707. At yaw 16 the R1 diagonal (headward and inward) projected to almost nothing. The free arm now lies on the floor beside the body (in the new view its hand floated above the head).

Captions: the hold caption is replaced by 'The arm is straight and the wrist has turned.'; the last caption is 'Wrist stacked over the elbow, press straight up, lower until the arm rests on the floor, and change arms after the repetitions.'

**Where I disagree with the order.** With the upper arm resting on the floor and the wrist stacked over the elbow (the text's cue), the bell starts 11.70 units out from the shoulder (shoulder 6.52 above the floor, upper arm 12.5, elbow on the floor). A vertical path of at most 3 units therefore cannot finish over the shoulder: the straight arm finishes leaning 27.2 degrees from vertical, toward the feet and outward, over where the bell started. The text asks for straight up until the arm is straight, which this meets; it does not say over the shoulder, but a real lockout is usually stacked over it, and in a real floor press the bell does travel from over the elbow to over the shoulder (the diagonal the auditor measured). The alternative, the bell over the shoulder at the bottom, needs the forearm leaning about 45 degrees inward, against "Wrist stacked over the elbow.", with the bell on the chest. I chose the text and the order's 3-unit path; if a stacked lockout is preferred, the 3-unit bound has to go.

## 65 Incline Dumbbell Press

Caption three is now 'Earn the stretch at the bottom just outside your chest.' (the cue's words). The forearm-within-1-degree assertion is removed; the test asserts no caption says "vertical forearm". Drawing byte-identical to R1 (drawn hash `f2ce0a3d...` in both probes); only the caption hash changed.

## 8 Front Squat, 208 Front Squat (Clean Grip), 81 Zercher Squat

| Measure | 8 before | 8 now | 208 before | 208 now | 81 (unchanged) |
| --- | --- | --- | --- | --- | --- |
| Smallest internal elbow, both arms, every tick | 17.00 deg | 33.71 deg | 23.89 deg | 32.48 deg | 43.04 deg |
| Smallest wrist distance to the upper arm axis (painted halves sum to 3.84) | | 6.66 | | 6.44 | 8.19 |
| Bar disc against the painted shoulder girdle (gap) | -1.41 (inside it) | -0.016 to 0.051 | -1.33 | 0.003 to 0.051 | |
| Bar clear of the painted neck (min) | | -0.032 | | -0.018 | |
| Bar clear of the painted trunk top (min) | | -0.016 | | -0.002 | |
| Largest upper arm pitch | | 0.00 deg | | 6.04 deg | |
| Grip span (z) | | 31.77 | | 29.17 | |

Before, the bar of 8 and 208 sat 1.4 units inside the painted shoulder girdle and neck. It now rests on the front of the shoulders, in front of the neck and on top of the trunk, at the same place relative to the trunk in both poses. The elbows stay level and forward (8) or 6 degrees above level (208); the opening comes from the hands sitting further out along the bar, the only way this rig's long forearm reaches a bar resting on the shoulders without folding into the upper arm. 8 stays wider than 208.

The test measures the rack against painted widths: bar disc radius 0.8 on the girdle (radius lw * 0.88 / 2 = 2.112), in front of the neck (half width 1.776), above the trunk's first slice (0.6 above the neck point); tolerance 0.1 for contact, 0.05 for overlap.

**Not done, and why.** I measured "forearm painted outline clear of the upper arm's" in the world with the painted widths: on every arm at every tick the wrist end is at least 3.84 from the upper arm's axis. On screen, in the 10-degree turn A01 fixed for 8 and 208, the opening points toward the viewer, so the near forearm is still painted over the near upper arm: projected wrist 0.34 (8) and 2.74 (208) from the projected upper arm. For a level, forward elbow with the bar on the shoulders no side-on turn separates them. Zercher's far forearm is 0.44 from its upper arm on screen. If the order means the screen, 8 and 208 need another view and the A01 yaw test changes.

Zercher (81): I cannot reproduce the order's 28 degrees. At this base its smallest internal elbow is 43.04 degrees on both arms at every tick (shoulder, elbow, wrist; the same with grip). Drawing left alone; elbow and clearance assertions added to its test.

## Joint-limit test

`MovementPreview.jointLimits.test.js` checks the 56 movements of MOV-A01 to MOV-A05, MOV-A08 and MOV-A11: every knee >= 35 deg and every elbow >= 30 deg, near and far, every 33 ms tick. Before this repair it failed on 8 (17.00) and 208 (23.89) only; it passes now.

Chain movements outside these batches that breach it (not touched), smallest elbow: 39 Cable Crunch 0.14, 161 Cable Seated Crunch 7.00, 234 Kneeling High Pulley Row 17.89, 95 Sit-Up 18.00, 248 One-Arm High-Pulley Cable Side Bends 20.00, 132 Band Good Morning (Pull Through) 22.00, 285 Standing Rope Crunch 22.00, 118 Calf Raises - With Bands 25.00, 287 Stiff Leg Barbell Good Morning 26.30, 171 Concentration Curls 29.00, 295 Upright Barbell Row 29.94. No knee breaches. Older non-chain drawings were not scanned.

## Tests written first

The first run of the four changed test files failed 6 tests: 249 upper arm 67.37 > 50; 8 girdle gap 1.41 > 0.1; 208 1.33 > 0.1; 65 caption with "vertical forearm"; joint limits 8 elbow 17.00 and 208 elbow 23.89.

## Gates on `f639bbbf`

- typecheck exit 0; MovementPreview suite 65 suites, 3789 tests passed, exit 0; storage guard exit 0; evidence gate exit 0.
- Rendered-output probe: 232 measured, none added or removed; changed as expected 8, 208, 65, 249; nothing else changed; no overflow.
