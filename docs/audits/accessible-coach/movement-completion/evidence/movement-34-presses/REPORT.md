# MOV-A05 Report — Bench, Floor and Cable Presses

- **Batch ID:** `MOV-A05`
- **Branch:** `movement/34-presses-2026-10-17`
- **Base Commit:** `2a0d69841e728b482bccebb0f213746ffdb90c7d`
- **Source Commit 1 (Frame-Fit Test Split):** `9e03224865b78a94a49367828f09fe6df802e3dd`
- **Source Commit 2 (10 Presses Authored):** `13fb72cb7d62f123ff082c01d74fa785e98bf5dc`
- **Source Commit 3 (Floor Contact & Incline Reason Alignment):** `cfbf952a10b8e0221bed2bdade59bdc946c41a10`
- **Movement IDs:** `3, 43, 45, 102, 65, 151, 252, 203, 249, 83`
- **Status:** `EVIDENCE CAPTURED`

---

## 1. Frame-Fit Test Split (`9e03224865b78a94a49367828f09fe6df802e3dd`)

Before authoring the 10 presses, `apps/mobile/test/components/MovementPreview.canonicalFrameFit.test.js` was updated in its own source commit (`9e03224865b78a94a49367828f09fe6df802e3dd`) to split the single all-movements loop (`Coverage of all renderable canonical and derived entries across the full cycle`) into one test per entry via `test.each(fullCycleEntries)` plus a count check (`Coverage count check: every renderable and derived entry has its own full-cycle test`), without raising the time limit or changing what is asserted (`assertEnclosure` at every `33 ms` tick and `deriveVariantEntry` frame-pose equality).

### 1.1 Probe Verification on `9e03224865b78a94a49367828f09fe6df802e3dd`
Running the rendered-output probe on `9e03224865b78a94a49367828f09fe6df802e3dd` against the base probe confirmed zero drawing changes:
- `movements measured: 209 (baseline 209)`
- `added: none`
- `removed: none`
- `changed, expected: none`
- `changed, NOT expected: none`
- `movements with overflow above 1e-6 dp: none`

### 1.2 Per-Test Execution Times (`MovementPreview.canonicalFrameFit.test.js`)
Across the `216` tests in `MovementPreview.canonicalFrameFit.test.js` (`209` per-entry full-cycle tests + `7` enclosure/negative-control/count/layout tests, total suite time `75.713 s` in `mov-a05-framefit-split-utf8.txt`), the per-entry full-cycle test times have:
- **Minimum:** `39 ms` (`entry 27 Road Run`)
- **Median:** `266 ms` (`entry 21 Lat Pulldown`)
- **Mean:** `333.2 ms`
- **Maximum:** `880 ms` (`entry 232 Kneeling Cable Crunch With Alternating Oblique Twists`)

Full per-test times from `npx jest --config apps/mobile/jest.config.js --runInBand --no-cache --verbose apps/mobile/test/components/MovementPreview.canonicalFrameFit.test.js`:

```text
PASS apps/mobile/test/components/MovementPreview.canonicalFrameFit.test.js (74.866 s)
  Finding A: Canonical Frame-Fit Enclosure and Stage Integrity
    √ Movement 52: figureFrame encloses stage, floor full height fits, all painted Views enclosed (neutral) (1448 ms)
    √ Negative Control: original 171.43 dp frame height demonstrably fails enclosure guard for 52 (14 ms)
    √ Negative Control: 24 dp shorter frame mutation demonstrably fails enclosure guard for 52 (3 ms)
    √ Negative Control: a painted primitive past the stage edge fails the enclosure guard (9 ms)
    √ Negative Control: a floor line whose thickness leaves the stage fails the enclosure guard (4 ms)
    √ Coverage of renderable entry 14 (Goblet Squat) across the full cycle (76 ms)
    √ Coverage of renderable entry 55 (Dumbbell Squat) across the full cycle (100 ms)
    √ Coverage of renderable entry 9 (Romanian Deadlift) across the full cycle (103 ms)
    √ Coverage of renderable entry 113 (Cable Deadlifts) across the full cycle (171 ms)
    √ Coverage of renderable entry 287 (Stiff Leg Barbell Good Morning) across the full cycle (549 ms)
    √ Coverage of renderable entry 86 (Dumbbell Floor Press) across the full cycle (155 ms)
    √ Coverage of renderable entry 100 (Close-Grip Dumbbell Press) across the full cycle (155 ms)
    √ Coverage of renderable entry 128 (Alternating Floor Press) across the full cycle (160 ms)
    √ Coverage of renderable entry 133 (Barbell Bench Press - Medium Grip) across the full cycle (424 ms)
    √ Coverage of renderable entry 141 (Bench Press - With Bands) across the full cycle (309 ms)
    √ Coverage of renderable entry 168 (Close-Grip EZ-Bar Press) across the full cycle (145 ms)
    √ Coverage of renderable entry 185 (Dumbbell Bench Press with Neutral Grip) across the full cycle (179 ms)
    √ Coverage of renderable entry 196 (Extended Range One-Arm Kettlebell Floor Press) across the full cycle (581 ms)
    √ Coverage of renderable entry 246 (One Arm Dumbbell Bench Press) across the full cycle (165 ms)
    √ Coverage of renderable entry 227 (JM Press) across the full cycle (169 ms)
    √ Coverage of renderable entry 22 (Cable Row) across the full cycle (560 ms)
    √ Coverage of renderable entry 30 (Band Row) across the full cycle (88 ms)
    √ Coverage of renderable entry 117 (Cable Rope Rear-Delt Rows) across the full cycle (247 ms)
    √ Coverage of renderable entry 238 (Low Pulley Row To Neck) across the full cycle (282 ms)
    √ Coverage of renderable entry 273 (Shotgun Row) across the full cycle (499 ms)
    √ Coverage of renderable entry 142 (Bent Over Barbell Row) across the full cycle (200 ms)
    √ Coverage of renderable entry 144 (Bent Over One-Arm Long Bar Row) across the full cycle (211 ms)
    √ Coverage of renderable entry 146 (Bent Over Two-Dumbbell Row) across the full cycle (442 ms)
    √ Coverage of renderable entry 147 (Bent Over Two-Dumbbell Row With Palms In) across the full cycle (206 ms)
    √ Coverage of renderable entry 32 (Band External Rotation) across the full cycle (160 ms)
    √ Coverage of renderable entry 115 (Cable Internal Rotation) across the full cycle (187 ms)
    √ Coverage of renderable entry 197 (External Rotation) across the full cycle (654 ms)
    √ Coverage of renderable entry 198 (External Rotation with Cable) across the full cycle (192 ms)
    √ Coverage of renderable entry 224 (Internal Rotation with Band) across the full cycle (551 ms)
    √ Coverage of renderable entry 127 (Alternating Cable Shoulder Press) across the full cycle (355 ms)
    √ Coverage of renderable entry 274 (Shoulder Press - With Bands) across the full cycle (222 ms)
    √ Coverage of renderable entry 280 (Standing Dumbbell Press) across the full cycle (661 ms)
    √ Coverage of renderable entry 284 (Standing Palm-In One-Arm Dumbbell Press) across the full cycle (207 ms)
    √ Coverage of renderable entry 76 (Standing Dumbbell Calf Raise) across the full cycle (148 ms)
    √ Coverage of renderable entry 118 (Calf Raises - With Bands) across the full cycle (620 ms)
    √ Coverage of renderable entry 15 (Kettlebell Swing) across the full cycle (52 ms)
    √ Coverage of renderable entry 10 (Dumbbell Bench Press) across the full cycle (98 ms)
    √ Coverage of renderable entry 11 (Dumbbell Shoulder Press) across the full cycle (185 ms)
    √ Coverage of renderable entry 12 (Single-Arm Dumbbell Row) across the full cycle (163 ms)
    √ Coverage of renderable entry 247 (One-Arm Dumbbell Row) across the full cycle (505 ms)
    √ Coverage of renderable entry 21 (Lat Pulldown) across the full cycle (266 ms)
    √ Coverage of renderable entry 74 (Scapular Pull-Up) across the full cycle (303 ms)
    √ Coverage of renderable entry 103 (One Arm Lat Pulldown) across the full cycle (538 ms)
    √ Coverage of renderable entry 169 (Close-Grip Front Lat Pulldown) across the full cycle (183 ms)
    √ Coverage of renderable entry 294 (Underhand Cable Pulldowns) across the full cycle (687 ms)
    √ Coverage of renderable entry 298 (V-Bar Pullup) across the full cycle (298 ms)
    √ Coverage of renderable entry 300 (Wide-Grip Lat Pulldown) across the full cycle (704 ms)
    √ Coverage of renderable entry 97 (Band Good Morning) across the full cycle (186 ms)
    √ Coverage of renderable entry 54 (Dumbbell Split Squat) across the full cycle (89 ms)
    √ Coverage of renderable entry 17 (Walking Lunge) across the full cycle (811 ms)
    √ Coverage of renderable entry 19 (Farmer Carry) across the full cycle (167 ms)
    √ Coverage of renderable entry 20 (Suitcase Carry) across the full cycle (236 ms)
    √ Coverage of renderable entry 39 (Cable Crunch) across the full cycle (530 ms)
    √ Coverage of renderable entry 62 (Hammer Curl) across the full cycle (254 ms)
    √ Coverage of renderable entry 186 (Dumbbell Bicep Curl) across the full cycle (512 ms)
    √ Coverage of renderable entry 267 (Seated Cable Shoulder Press) across the full cycle (329 ms)
    √ Coverage of renderable entry 270 (Seated Dumbbell Press) across the full cycle (282 ms)
    √ Coverage of renderable entry 34 (Barbell Curl) across the full cycle (425 ms)
    √ Coverage of renderable entry 106 (Reverse Barbell Curl) across the full cycle (153 ms)
    √ Coverage of renderable entry 167 (Close-Grip EZ Bar Curl) across the full cycle (154 ms)
    √ Coverage of renderable entry 199 (EZ-Bar Curl) across the full cycle (197 ms)
    √ Coverage of renderable entry 114 (Cable Hammer Curls - Rope Attachment) across the full cycle (441 ms)
    √ Coverage of renderable entry 260 (Reverse Cable Curl) across the full cycle (289 ms)
    √ Coverage of renderable entry 278 (Standing Biceps Cable Curl) across the full cycle (169 ms)
    √ Coverage of renderable entry 126 (Alternate Hammer Curl) across the full cycle (636 ms)
    √ Coverage of renderable entry 172 (Cross Body Hammer Curl) across the full cycle (489 ms)
    √ Coverage of renderable entry 134 (Barbell Incline Bench Press - Medium Grip) across the full cycle (576 ms)
    √ Coverage of renderable entry 212 (Hammer Grip Incline DB Bench Press) across the full cycle (175 ms)
    √ Coverage of renderable entry 216 (Incline Cable Chest Press) across the full cycle (203 ms)
    √ Coverage of renderable entry 218 (Incline Dumbbell Bench With Palms Facing In) across the full cycle (268 ms)
    √ Coverage of renderable entry 24 (Band Pull-Apart) across the full cycle (375 ms)
    √ Coverage of renderable entry 159 (Cable Rear Delt Fly) across the full cycle (272 ms)
    √ Coverage of renderable entry 25 (Pallof Press) across the full cycle (204 ms)
    √ Coverage of renderable entry 251 (Pallof Press With Rotation) across the full cycle (710 ms)
    √ Coverage of renderable entry 111 (Barbell Seated Calf Raise) across the full cycle (167 ms)
    √ Coverage of renderable entry 191 (Dumbbell Seated One-Leg Calf Raise) across the full cycle (192 ms)
    √ Coverage of renderable entry 26 (Plank) across the full cycle (379 ms)
    √ Coverage of renderable entry 42 (Chest-Supported Dumbbell Row) across the full cycle (111 ms)
    √ Coverage of renderable entry 44 (Dead Bug) across the full cycle (140 ms)
    √ Coverage of renderable entry 57 (Dumbbell Sumo Squat) across the full cycle (176 ms)
    √ Coverage of renderable entry 59 (Face Pull) across the full cycle (605 ms)
    √ Coverage of renderable entry 266 (Seated Cable Rows) across the full cycle (281 ms)
    √ Coverage of renderable entry 60 (Feet-Elevated Push-Up) across the full cycle (69 ms)
    √ Coverage of renderable entry 254 (Push Up to Side Plank) across the full cycle (871 ms)
    √ Coverage of renderable entry 255 (Push-Up Wide) across the full cycle (64 ms)
    √ Coverage of renderable entry 174 (Crunch - Hands Overhead) across the full cycle (336 ms)
    √ Coverage of renderable entry 175 (Crunches) across the full cycle (612 ms)
    √ Coverage of renderable entry 263 (Rope Crunch) across the full cycle (267 ms)
    √ Coverage of renderable entry 116 (Cable Rope Overhead Triceps Extension) across the full cycle (289 ms)
    √ Coverage of renderable entry 157 (Cable One Arm Tricep Extension) across the full cycle (374 ms)
    √ Coverage of renderable entry 193 (Dumbbell Tricep Extension -Pronated Grip) across the full cycle (247 ms)
    √ Coverage of renderable entry 282 (Standing Dumbbell Triceps Extension) across the full cycle (68 ms)
    √ Coverage of renderable entry 283 (Standing Overhead Barbell Triceps Extension) across the full cycle (93 ms)
    √ Coverage of renderable entry 53 (Dumbbell Shrug) across the full cycle (515 ms)
    √ Coverage of renderable entry 82 (Barbell Shrug) across the full cycle (217 ms)
    √ Coverage of renderable entry 138 (Barbell Shrug Behind The Back) across the full cycle (250 ms)
    √ Coverage of renderable entry 163 (Cable Shrugs) across the full cycle (552 ms)
    √ Coverage of renderable entry 125 (3/4 Sit-Up) across the full cycle (405 ms)
    √ Coverage of renderable entry 161 (Cable Seated Crunch) across the full cycle (643 ms)
    √ Coverage of renderable entry 225 (Jackknife Sit-Up) across the full cycle (88 ms)
    √ Coverage of renderable entry 226 (Janda Sit-Up) across the full cycle (802 ms)
    √ Coverage of renderable entry 40 (Cable Pull-Through) across the full cycle (202 ms)
    √ Coverage of renderable entry 132 (Band Good Morning (Pull Through)) across the full cycle (249 ms)
    √ Coverage of renderable entry 214 (Hip Extension with Bands) across the full cycle (500 ms)
    √ Coverage of renderable entry 90 (Incline Push-Up) across the full cycle (111 ms)
    √ Coverage of renderable entry 222 (Incline Push-Up Close-Grip) across the full cycle (67 ms)
    √ Coverage of renderable entry 223 (Incline Push-Up Wide) across the full cycle (67 ms)
    √ Coverage of renderable entry 92 (Preacher Curl) across the full cycle (610 ms)
    √ Coverage of renderable entry 158 (Cable Preacher Curl) across the full cycle (441 ms)
    √ Coverage of renderable entry 253 (Preacher Hammer Dumbbell Curl) across the full cycle (376 ms)
    √ Coverage of renderable entry 73 (Russian Twist) across the full cycle (436 ms)
    √ Coverage of renderable entry 173 (Cross-Body Crunch) across the full cycle (401 ms)
    √ Coverage of renderable entry 245 (Oblique Crunches) across the full cycle (619 ms)
    √ Coverage of renderable entry 29 (Glute Bridge) across the full cycle (114 ms)
    √ Coverage of renderable entry 75 (Single-Leg Glute Bridge) across the full cycle (63 ms)
    √ Coverage of renderable entry 51 (Dumbbell Lunge) across the full cycle (87 ms)
    √ Coverage of renderable entry 286 (Step-up with Knee Raise) across the full cycle (658 ms)
    √ Coverage of renderable entry 110 (Barbell Rear Delt Row) across the full cycle (270 ms)
    √ Coverage of renderable entry 143 (Bent Over Dumbbell Rear Delt Raise With Head On Bench) across the full cycle (483 ms)
    √ Coverage of renderable entry 122 (Kneeling Single-Arm High Pulley Row) across the full cycle (292 ms)
    √ Coverage of renderable entry 234 (Kneeling High Pulley Row) across the full cycle (221 ms)
    √ Coverage of renderable entry 135 (Barbell Incline Shoulder Raise) across the full cycle (160 ms)
    √ Coverage of renderable entry 187 (Dumbbell Incline Shoulder Raise) across the full cycle (528 ms)
    √ Coverage of renderable entry 80 (Triceps Pushdown) across the full cycle (257 ms)
    √ Coverage of renderable entry 262 (Reverse Grip Triceps Pushdown) across the full cycle (255 ms)
    √ Coverage of renderable entry 292 (Triceps Pushdown - Rope Attachment) across the full cycle (502 ms)
    √ Coverage of renderable entry 264 (Rope Straight-Arm Pulldown) across the full cycle (265 ms)
    √ Coverage of renderable entry 49 (Dumbbell Flye) across the full cycle (258 ms)
    √ Coverage of renderable entry 178 (Decline Dumbbell Flyes) across the full cycle (621 ms)
    √ Coverage of renderable entry 220 (Incline Dumbbell Flyes) across the full cycle (218 ms)
    √ Coverage of renderable entry 84 (Cable Glute Kickback) across the full cycle (183 ms)
    √ Coverage of renderable entry 52 (Dumbbell Reverse Lunge) across the full cycle (523 ms)
    √ Coverage of renderable entry 66 (Inverted Row) across the full cycle (167 ms)
    √ Coverage of renderable entry 152 (Body Tricep Press) across the full cycle (221 ms)
    √ Coverage of renderable entry 50 (Dumbbell Lateral Raise) across the full cycle (644 ms)
    √ Coverage of renderable entry 236 (Lateral Raise - With Bands) across the full cycle (243 ms)
    √ Coverage of renderable entry 87 (Dumbbell Front Raise) across the full cycle (214 ms)
    √ Coverage of renderable entry 206 (Front Cable Raise) across the full cycle (517 ms)
    √ Coverage of renderable entry 272 (Seated Side Lateral Raise) across the full cycle (294 ms)
    √ Coverage of renderable entry 219 (Incline Dumbbell Curl) across the full cycle (346 ms)
    √ Coverage of renderable entry 221 (Incline Hammer Curls) across the full cycle (550 ms)
    √ Coverage of renderable entry 207 (Front Incline Dumbbell Raise) across the full cycle (274 ms)
    √ Coverage of renderable entry 155 (Cable Incline Triceps Extension) across the full cycle (666 ms)
    √ Coverage of renderable entry 179 (Decline Dumbbell Triceps Extension) across the full cycle (164 ms)
    √ Coverage of renderable entry 180 (Decline EZ Bar Triceps Extension) across the full cycle (224 ms)
    √ Coverage of renderable entry 156 (Cable Lying Triceps Extension) across the full cycle (453 ms)
    √ Coverage of renderable entry 237 (Low Cable Triceps Extension) across the full cycle (209 ms)
    √ Coverage of renderable entry 276 (Spider Curl) across the full cycle (246 ms)
    √ Coverage of renderable entry 171 (Concentration Curls) across the full cycle (663 ms)
    √ Coverage of renderable entry 268 (Seated Dumbbell Palms-Down Wrist Curl) across the full cycle (253 ms)
    √ Coverage of renderable entry 269 (Seated Dumbbell Palms-Up Wrist Curl) across the full cycle (544 ms)
    √ Coverage of renderable entry 164 (Cable Wrist Curl) across the full cycle (297 ms)
    √ Coverage of renderable entry 95 (Sit-Up) across the full cycle (243 ms)
    √ Coverage of renderable entry 124 (Tuck Crunch) across the full cycle (534 ms)
    √ Coverage of renderable entry 72 (Reverse Crunch) across the full cycle (287 ms)
    √ Coverage of renderable entry 99 (Cable Reverse Crunch) across the full cycle (239 ms)
    √ Coverage of renderable entry 150 (Bent-Knee Hip Raise) across the full cycle (707 ms)
    √ Coverage of renderable entry 183 (Decline Reverse Crunch) across the full cycle (231 ms)
    √ Coverage of renderable entry 285 (Standing Rope Crunch) across the full cycle (653 ms)
    √ Coverage of renderable entry 232 (Kneeling Cable Crunch With Alternating Oblique Twists) across the full cycle (880 ms)
    √ Coverage of renderable entry 181 (Decline Oblique Crunch) across the full cycle (253 ms)
    √ Coverage of renderable entry 160 (Cable Russian Twists) across the full cycle (486 ms)
    √ Coverage of renderable entry 248 (One-Arm High-Pulley Cable Side Bends) across the full cycle (586 ms)
    √ Coverage of renderable entry 89 (Floor Back Extension) across the full cycle (210 ms)
    √ Coverage of renderable entry 37 (Bench Dip) across the full cycle (554 ms)
    √ Coverage of renderable entry 182 (Decline Push-Up) across the full cycle (241 ms)
    √ Coverage of renderable entry 27 (Road Run) across the full cycle (39 ms)
    √ Coverage of renderable entry 295 (Upright Barbell Row) across the full cycle (397 ms)
    √ Coverage of renderable entry 297 (Upright Row - With Bands) across the full cycle (387 ms)
    √ Coverage of renderable entry 139 (Barbell Side Split Squat) across the full cycle (135 ms)
    √ Coverage of renderable entry 162 (Cable Seated Lateral Raise) across the full cycle (223 ms)
    √ Coverage of renderable entry 261 (Reverse Flyes) across the full cycle (633 ms)
    √ Coverage of renderable entry 131 (Back Flyes - With Bands) across the full cycle (172 ms)
    √ Coverage of renderable entry 200 (Finger Curls) across the full cycle (642 ms)
    √ Coverage of renderable entry 154 (Cable Incline Pushdown) across the full cycle (311 ms)
    √ Coverage of renderable entry 279 (Standing Cable Chest Press) across the full cycle (211 ms)
    √ Coverage of renderable entry 1 (Competition Squat) across the full cycle (656 ms)
    √ Coverage of renderable entry 123 (Narrow Stance Squats) across the full cycle (225 ms)
    √ Coverage of renderable entry 277 (Squat with Bands) across the full cycle (184 ms)
    √ Coverage of renderable entry 299 (Wide Stance Barbell Squat) across the full cycle (614 ms)
    √ Coverage of renderable entry 8 (Front Squat) across the full cycle (281 ms)
    √ Coverage of renderable entry 208 (Front Squat (Clean Grip)) across the full cycle (656 ms)
    √ Coverage of renderable entry 38 (Box Squat) across the full cycle (203 ms)
    √ Coverage of renderable entry 256 (Reverse Band Box Squat) across the full cycle (251 ms)
    √ Coverage of renderable entry 275 (Speed Box Squat) across the full cycle (553 ms)
    √ Coverage of renderable entry 140 (Barbell Squat To A Bench) across the full cycle (205 ms)
    √ Coverage of renderable entry 192 (Dumbbell Squat To A Bench) across the full cycle (190 ms)
    √ Coverage of renderable entry 81 (Zercher Squat) across the full cycle (674 ms)
    √ Coverage of renderable entry 98 (Barbell Hack Squat) across the full cycle (243 ms)
    √ Coverage of renderable entry 120 (Jefferson Squats) across the full cycle (169 ms)
    √ Coverage of renderable entry 235 (Kneeling Squat) across the full cycle (529 ms)
    √ Coverage of renderable entry 105 (One-Arm Overhead Kettlebell Squat) across the full cycle (210 ms)
    √ Coverage of renderable entry 48 (Double Kettlebell Front Squat) across the full cycle (150 ms)
    √ Coverage of renderable entry 2 (Deadlift) across the full cycle (577 ms)
    √ Coverage of renderable entry 46 (Deficit Deadlift) across the full cycle (280 ms)
    √ Coverage of renderable entry 176 (Deadlift with Bands) across the full cycle (287 ms)
    √ Coverage of renderable entry 257 (Reverse Band Deadlift) across the full cycle (531 ms)
    √ Coverage of renderable entry 78 (Sumo Deadlift) across the full cycle (256 ms)
    √ Coverage of renderable entry 258 (Reverse Band Sumo Deadlift) across the full cycle (499 ms)
    √ Coverage of renderable entry 290 (Sumo Deadlift with Bands) across the full cycle (314 ms)
    √ Coverage of renderable entry 288 (Stiff-Legged Barbell Deadlift) across the full cycle (232 ms)
    √ Coverage of renderable entry 61 (Good Morning) across the full cycle (533 ms)
    √ Coverage of renderable entry 210 (Good Morning off Pins) across the full cycle (202 ms)
    √ Coverage of renderable entry 271 (Seated Good Mornings) across the full cycle (206 ms)
    √ Coverage of renderable entry 94 (Single-Leg Romanian Deadlift) across the full cycle (319 ms)
    √ Coverage of renderable entry 35 (Barbell Hip Thrust) across the full cycle (593 ms)
    √ Coverage of renderable entry 23 (Nordic Curl) across the full cycle (210 ms)
    √ Coverage of renderable entry 202 (Floor Glute-Ham Raise) across the full cycle (677 ms)
    √ Coverage of renderable entry 244 (Natural Glute Ham Raise) across the full cycle (318 ms)
    √ Coverage count check: every renderable and derived entry has its own full-cycle test (3 ms)
    √ Parent layout presentation: compact mode (SessionScreen) and card mode (LibraryScreenV2) (4 ms)
```

---

## 2. Views Chosen Per Family and Why

1. **`3` Competition Bench, `43` Close-Grip Bench Press, `45` Decline Bench Press, `102` Decline Dumbbell Bench Press, `65` Incline Dumbbell Press, `151` Board Press, `252` Pin Presses, `203` Floor Press, `249` One-Arm Kettlebell Floor Press — `view: 'oblique', yawDeg: 28`:**
   - A `28°` turned view preserves `88.3%` (`cos 28°`) of the sagittal press path (bench/floor contact, arch, incline/decline angle, board stack height, safety pin height, and vertical forearm stack) while opening `46.9%` (`sin 28°`) of lateral width across the barbell or dumbbells. This directly makes the grip-width differences (`±14.50` competition grip on `3` vs `±9.40` shoulder-width grip on `43` vs `±11.80` just-wider-than-shoulder grip on `45`), elbow-path differences (`26.27°` flare on `3` vs `0.11°` tucked to the ribs on `43` vs `45.07°` on `65`), inward dumbbell convergence (`102`, `65`), and single-arm kettlebell rotation (`249`) immediately legible without collapsing the barbell into an end-on circle.
2. **`83` Cable Chest Press — `view: 'oblique', yawDeg: 55, pitchDeg: 15`:**
   - A `55°` turned view with a `15°` downward pitch opens `81.9%` (`sin 55°`) of lateral width together with `57.4%` (`cos 55°`) of forward reach, allowing both chest-height pulleys behind the lifter (`[-24.00, 61.50, ±19.50]`), both backward-pulling cables, the staggered stance (`nearAnkle = [-10.00, 2.16, 6.80]`, `farAnkle = [10.00, 2.16, -6.80]`), and the hands drifting together at full forward reach (`hold Z` from `±19.50` to `±1.50`) to be seen simultaneously without overlap.

---

## 3. Chain Kit Additions (`apps/mobile/src/components/movementPreview/canonicalFigure.ts`)

1. **`chestBoard?: { along: number; length: number; height: number }` (`lines 1301–1302` and `6295–6327`):**
   ```ts
     /** Boards banded to the chest for a Board Press: position along the spine from neck to hip (0..1), length along the chest, and board stack height. */
     chestBoard?: { along: number; length: number; height: number };
   ```
   ```ts
     if (chain && chain.movement.chestBoard) {
       const b = chain.movement.chestBoard;
       const bi = Math.max(0, Math.min(slices, Math.round(b.along * slices)));
       const bt = bi / slices;
       const here = curledSpine ? curledSpine[bi] : at(bt);
       const before = curledSpine ? curledSpine[Math.max(0, bi - 1)] : j.nk;
       const after = curledSpine ? curledSpine[Math.min(slices, bi + 1)] : j.hp;
       const run = Math.hypot(after[0] - before[0], after[1] - before[1]) || 1;
       const bAxis: CanonicalPoint = [(after[0] - before[0]) / run, (after[1] - before[1]) / run];
       const across: CanonicalPoint = [-(after[1] - before[1]) / run, (after[0] - before[0]) / run];
       const upNormal: CanonicalPoint = across[1] <= 0 ? across : [-across[0], -across[1]];
       const half = !front
         ? sw + (Math.min(hw, sw * 0.9) - sw) * bt
         : bt <= 0.56 ? sw + (waistWidth - sw) * (bt / 0.56) : waistWidth + (hw - waistWidth) * ((bt - 0.56) / 0.44);
       const boardCenter: CanonicalPoint = [
         here[0] + upNormal[0] * (half + b.height / 2),
         here[1] + upNormal[1] * (half + b.height / 2),
       ];
       const halfLen = b.length / 2;
       prims.push(bone(
         [boardCenter[0] - bAxis[0] * halfLen, boardCenter[1] - bAxis[1] * halfLen],
         [boardCenter[0] + bAxis[0] * halfLen, boardCenter[1] + bAxis[1] * halfLen],
         b.height, 'textMid', 1,
       ));
       for (const sOff of [-halfLen * 0.45, halfLen * 0.45]) {
         const sc: CanonicalPoint = [here[0] + bAxis[0] * sOff, here[1] + bAxis[1] * sOff];
         prims.push(bone(
           [sc[0] - upNormal[0] * half, sc[1] - upNormal[1] * half],
           [sc[0] + upNormal[0] * (half + b.height), sc[1] + upNormal[1] * (half + b.height)],
           1.1, 'ink1', 0.85,
         ));
       }
     }
   ```
   - **Why needed:** `151 Board Press` specifies `"Lie on the bench and band the boards securely to the chest; confirm they remain fixed before unracking... Lower the bar under control until it settles on the boards."` `chestBoard` draws the board stack flush against the chest contour in Layer 3 together with two dark band straps securing the boards around the torso.

2. **`kettlebellTurn?: boolean` (`lines 1303–1304` and `5435–5445`):**
   ```ts
     /** Whether a held kettlebell starts with the palm facing in at phase 0 and turns 90 degrees as the arm presses to phase 1. */
     kettlebellTurn?: boolean;
   ```
   ```ts
       const turnT = movement.kettlebellTurn ? Math.max(0, Math.min(1, figure.ph)) : 1;
       const hAxis: ChainVec = movement.kettlebellTurn
         ? [Math.cos(turnT * Math.PI / 2), 0, Math.sin(turnT * Math.PI / 2)]
         : [0, 0, 1];
       const kbRest: ChainVec = movement.kettlebellTurn
         ? [-1.8 * turnT, -2.2, 2.2 * (1 - turnT) + 1.4 * turnT]
         : KETTLEBELL_REST;
       const a = project(chainAdd(w.near.hold, hAxis, -2.6)), b = project(chainAdd(w.near.hold, hAxis, 2.6));
       const c = project(chainAdd(w.near.hold, kbRest, 1));
       near.push({ kind: 'circle', cx: c[0], cy: c[1], r: KETTLEBELL_RADIUS, fill: 'textHi', stroke: 'ink1', strokeWidth: 1, opacity: 1 });
       near.push(line(a, b, 2.2, 'textHi', 1));
   ```
   - **Why needed:** `249 One-Arm Kettlebell Floor Press` specifies `"Lie on the floor holding a kettlebell in one hand with that upper arm resting on the floor and the palm facing in. Press the kettlebell straight up until the arm is straight, letting the wrist turn as it rises."` `kettlebellTurn` rotates the kettlebell handle axis `90°` from `[1, 0, 0]` (palm facing in at `ph = 0`) to `[0, 0, 1]` (palm turned forward at `ph = 1`) while shifting the bell body onto the back of the forearm as it rises.

---

## 4. Failing-First Test Run & Guard Failure Demonstration

### 4.1 First Failing Test Run (Before Authoring)
`apps/mobile/test/components/MovementPreview.movA05Presses.test.js` was written before authoring the 10 movements in `canonicalFigure.ts` or `chain_motion_specs.mjs`. Running `npx jest --config apps/mobile/jest.config.js --runInBand --no-cache apps/mobile/test/components/MovementPreview.movA05Presses.test.js` failed all 16 initial tests (`mov-a05-first-failing-test.txt`):

```text
FAIL test/components/MovementPreview.movA05Presses.test.js
  MOV-A05 horizontal, incline, decline, floor, board, pin, and cable presses: physics, joint angles, contacts, and family distinctions
    × movement 3 is authored as pending with at least 5 frames and renders across every 33 ms tick (2 ms)
    × movement 43 is authored as pending with at least 5 frames and renders across every 33 ms tick
    × movement 45 is authored as pending with at least 5 frames and renders across every 33 ms tick (1 ms)
    × movement 102 is authored as pending with at least 5 frames and renders across every 33 ms tick
    × movement 65 is authored as pending with at least 5 frames and renders across every 33 ms tick (1 ms)
    × movement 151 is authored as pending with at least 5 frames and renders across every 33 ms tick
    × movement 252 is authored as pending with at least 5 frames and renders across every 33 ms tick
    × movement 203 is authored as pending with at least 5 frames and renders across every 33 ms tick
    × movement 249 is authored as pending with at least 5 frames and renders across every 33 ms tick
    × movement 83 is authored as pending with at least 5 frames and renders across every 33 ms tick
    × 3 Competition Bench and 43 Close-Grip Bench Press plant feet, pin upper back and hips to the bench, stack forearms vertically at the lower-chest touch, and separate competition grip + pause from shoulder-width close grip + tucked elbows
    × 45 Decline Bench Press and 102 Decline Dumbbell Bench Press hook legs into a head-lower decline bench with zero painted torso-to-pad gap, vertical forearms at bottom, and distinct barbell vs inward-converging dumbbell paths
    × 65 Incline Dumbbell Press sets the bench between 30 and 45 degrees with zero painted backrest gap, lowers to a deep stretch outside the chest with ~45-deg elbows, and presses up and slightly back to finish over the face
    × 151 Board Press and 252 Pin Presses show their distinct partial-stroke stops: chest-banded boards vs rack safety pins
    × 203 Floor Press and 249 One-Arm Kettlebell Floor Press lie directly on the floor, rest upper arms on the floor at the bottom with vertical forearms, and distinguish racked barbell from single-arm rotating kettlebell
    × 83 Cable Chest Press stands in a staggered stance facing away from chest-height pulleys, presses both handles forward until hands drift together at full reach, and returns slowly under cable tension (1 ms)

Test Suites: 1 failed, 1 total
Tests:       16 failed, 16 total
```

### 4.2 Guard Break Verification (After Authoring)
After authoring all 10 movements, `chestBoard.height` on `'board-press'` (`id 151`) in `apps/mobile/src/components/movementPreview/canonicalFigure.ts` was temporarily changed from `4.2` to `1.5`. Re-running `npx jest --config apps/mobile/jest.config.js --runInBand --no-cache apps/mobile/test/components/MovementPreview.movA05Presses.test.js` caught the `2.70`-unit bar-to-board gap (`mov-a05-guard-break.txt`):

```text
  ● MOV-A05 horizontal, incline, decline, floor, board, pin, and cable presses: physics, joint angles, contacts, and family distinctions › 151 Board Press and 252 Pin Presses show their distinct partial-stroke stops: chest-banded boards vs rack safety pins

    expect(received).toBeLessThanOrEqual(expected)

    Expected: <= 0.15
    Received:    2.696597948740674

      202 |     const barMidY151 = 96.9 - bot151.world.near.hold[1];
      203 |     const barBotY151 = barMidY151 + 0.8;
    > 204 |     expect(Math.abs(barBotY151 - boardTopY)).toBeLessThanOrEqual(0.15);
          |                                              ^

Test Suites: 1 failed, 1 total
Tests:       1 failed, 15 passed, 16 total
```

`chestBoard.height: 4.2` was restored and `MovementPreview.movA05Presses.test.js` (including the 17th depth-order and mid-press elbow-trajectory test) passed `17/17`.

---

## 5. Per-Movement Catalogue Text, Start/End Measured Values & Physics Checks

### 5.1 `3` — `Competition Bench` (`competition-bench`, `view: 'oblique', yawDeg: 28`)
- **Catalogue text (`ALL_300_MOTION_MAP.json:1515–1516`):**
  > `"instructions": "Plant the feet and pin the upper back to the bench before taking a secure competition-width grip. Unrack to straight arms, settle the bar, then lower to the same chest touch point with stacked forearms. Hold the competition pause before pressing back to lockout. If the hips lift or the touch point wanders, reduce the load until every rep follows one standard.",`
  > `"cues": "Drive the feet and pin the upper back. Touch the same lower-chest point. Hold the pause, then press.",`
- **Measured start (`ph = 0`) and end (`ph = 1`) values:**
  - `ph = 0` (lockout): `elbowDeg3D = 174.02°`, `hip = [10.00, 23.89, 0.00]`, `neck = [-13.97, 24.51, 0.00]`, `head = [-22.97, 24.82, 0.00]`, `nearShoulder = [-13.97, 24.51, 9.38]`, `nearElbow = [-12.91, 36.61, 12.30]`, `nearHold = [-12.97, 48.41, ±14.50]` (competition-width grip `±14.50`, `5.12` units wider per side than `shoulderHalf = 9.384`), planted `nearAnkle = [22.00, 2.16, ±12.00]`, painted upper-back bottom `t0BotY = 78.90` and glute bottom `t32BotY = 78.90` on bench top `78.90` (`0.00` gap).
  - `ph = 1` (lower-chest touch with competition pause): `elbowDeg3D = 67.90°`, `forearmVertDeg3D = 0.06°` (`<= 1.0°` stacked forearms), `elbowTuckDeg = 26.27°`, `nearElbow = [-3.59, 19.80, 14.51]`, `nearHold = [-3.58, 31.80, ±14.50]`, `t0BotY = 78.90`, `t32BotY = 78.90`, `nearAnkle = [22.00, 2.16, ±12.00]` (`0.00` drift); `segmentDurationsMs = [1300, 900, 950, 500]` (`900 ms` visible competition pause on the chest).

### 5.2 `43` — `Close-Grip Bench Press` (`close-grip-bench-press`, `view: 'oblique', yawDeg: 28`)
- **Catalogue text (`ALL_300_MOTION_MAP.json:4243–4244`):**
  > `"instructions": "Lie on a bench and grip the bar at about shoulder width, not narrower. Unrack and lower the bar to your lower chest, elbows staying close to your sides. Press back up to straight arms.",`
  > `"cues": "Elbows ride close to the ribs. Wrists stacked over the elbows. Touch low on the chest.",`
- **Measured start (`ph = 0`) and end (`ph = 1`) values:**
  - `ph = 0` (lockout): `elbowDeg3D = 173.38°`, `hip = [10.00, 23.90, 0.00]`, `neck = [-13.98, 24.51, 0.00]`, `nearShoulder = [-13.98, 24.51, 9.38]`, `nearElbow = [-12.51, 36.92, 9.39]`, `nearHold = [-12.48, 48.92, ±9.40]` (shoulder-width grip `±9.40` vs `shoulderHalf = 9.384`, `5.10` units narrower per side than `3 Competition Bench`), planted `nearAnkle = [22.00, 2.16, ±11.30]`, `t0BotY = 78.91`, `t32BotY = 78.90`.
  - `ph = 1` (lower-chest touch with elbows tucked to the ribs): `elbowDeg3D = 67.89°`, `forearmVertDeg3D = 0.03°` (wrists stacked over elbows), `elbowTuckDeg = 0.11°` (elbows riding close to the sides at `nearElbow Z = 9.41`, `5.10` units narrower per side than `3 Competition Bench`), `nearHold = [-2.40, 31.80, ±9.40]` (low on the chest), `segmentDurationsMs = [1200, 450, 950, 450]`.

### 5.3 `45` — `Decline Bench Press` (`decline-bench-press`, `view: 'oblique', yawDeg: 28`)
- **Catalogue text (`ALL_300_MOTION_MAP.json:4375–4376`):**
  > `"instructions": "Hook your legs into the decline bench and take the bar just wider than shoulder width. Lower to the lower line of your chest — the decline shortens the stroke, so expect to touch sooner than on flat. Press back to lockout over your eyes. Have a spotter for the unrack; getting out of a decline alone is ugly.",`
  > `"cues": "Touch at the natural end of the shorter stroke. Wrists stacked, bar over the forearm bones. Spotter on the unrack.",`
- **Measured start (`ph = 0`) and end (`ph = 1`) values:**
  - `ph = 0` (lockout over the eyes on `-18.00°` decline bench): `trunkDegFromHoriz = -18.00°`, `hip = [4.00, 25.00, 0.00]`, `neck = [-18.83, 17.58, 0.00]`, `head = [-27.69, 16.02, 0.00]`, `slabTopGapSlice0 = 0.00`, `slabTopGapSlice32 = 0.00` (zero painted gap between torso and decline pad), knees hooked over rollers at `[24.22, 34.00, ±9.13]`, ankles hooked at `[38.48, 17.00, ±10.68]`, `elbowDeg3D = 175.36°`, `nearHold = [-25.40, 41.04, ±11.80]` (grip `±11.80` just wider than `shoulderHalf = 9.384`; lockout at `X = -25.40` directly over the eyes/head at `X = -27.69`).
  - `ph = 1` (shorter stroke touching the lower line of the chest): `elbowDeg3D = 80.88°`, `forearmVertDeg3D = 0.05°`, `nearElbow = [-6.72, 15.60, 11.79]`, `nearHold = [-6.72, 27.60, ±11.80]` (vertical stroke `41.04 - 27.60 = 13.44` units, `3.17` units shorter than `3 Competition Bench`'s `16.61`-unit stroke); `segmentDurationsMs = [1200, 450, 950, 450]`.

### 5.4 `102` — `Decline Dumbbell Bench Press` (`decline-dumbbell-bench-press`, `view: 'oblique', yawDeg: 28`)
- **Catalogue text (`ALL_300_MOTION_MAP.json:8218–8219`):**
  > `"instructions": "Secure the legs in a decline bench, sit with the dumbbells on the thighs, then lie back and bring the bells to the chest before pressing them into position. Lower toward the lower chest with the forearms vertical and the shoulder blades pinned into the pad. Press up and slightly inward; when the bells are too heavy to mount cleanly, the setup has already chosen a lighter working load for you.",`
  > `"cues": "Pin the shoulder blades into the pad. Stack the wrists over the elbows. Press up and slightly in.",`
- **Measured start (`ph = 0`) and end (`ph = 1`) values:**
  - `ph = 0` (top lockout, pressed up and slightly inward): `trunkDegFromHoriz = -18.00°`, `hip = [4.00, 25.00, 0.00]`, `neck = [-18.83, 17.58, 0.00]`, `slabTopGapSlice0 = 0.00`, `slabTopGapSlice32 = 0.00`, `nearKnee = [24.22, 34.00, ±9.13]`, `nearAnkle = [38.48, 17.00, ±10.68]`, `elbowDeg3D = 175.54°`, `nearHold = [-20.83, 41.91, ±7.50]` (`6.00` units inward per side from the bottom width `±13.50`).
  - `ph = 1` (bottom at lower chest with vertical forearms): `elbowDeg3D = 70.94°`, `forearmVertDeg3D = 0.03°`, `nearElbow = [-7.75, 13.50, 13.49]`, `nearHold = [-7.75, 25.50, ±13.50]`; `segmentDurationsMs = [1250, 450, 950, 450]`.

### 5.5 `65` — `Incline Dumbbell Press` (`incline-dumbbell-press`, `view: 'oblique', yawDeg: 28`)
- **Catalogue text (`ALL_300_MOTION_MAP.json:5731–5732`):**
  > `"instructions": "Set the bench between 30 and 45 degrees — lower hits more chest, higher bleeds into shoulders. Kick the dumbbells up off your knees one at a time and start from the top. Lower to a deep stretch just outside your chest with your elbows about 45 degrees from your sides, then press up and slightly back so the dumbbells finish over your face, not your belly.",`
  > `"cues": "Feet planted, upper back tight on the bench. Earn the stretch at the bottom. Press up and slightly back, finishing over the face.",`
- **Measured start (`ph = 0`) and end (`ph = 1`) values:**
  - **Bench angle:** `35.00°` from horizontal (inside the `30°` to `45°` range), `slabTopGapSlice0 = 0.00`, `slabTopGapSlice32 = 0.00`, planted `nearAnkle = [22.00, 2.16, ±11.60]`.
  - `ph = 0` (starts from the top, dumbbells over the face, not the belly): `elbowDeg3D = 174.92°`, `hip = [4.00, 19.60, 0.00]`, `neck = [-15.66, 33.37, 0.00]`, `head = [-23.61, 37.59, 0.00]`, `nearHold = [-21.50, 57.06, ±7.50]` (`|hold X - head X| = 2.11 <= 2.50` over the face, `25.50` units back from the belly/hips at `X = 4.00`).
  - `ph = 1` (deep stretch just outside the chest with `~45°` elbows): `elbowDeg3D = 53.91°`, `forearmVertDeg3D = 0.04°`, `elbowTuckDeg = 45.07°` (`45°` from the sides), `nearElbow = [-8.53, 26.00, 16.53]`, `nearHold = [-8.52, 38.00, ±16.53]` (`7.15` units outside `nearShoulder Z = 9.38`); pressing from `ph = 1` to `ph = 0` moves up `+19.06` in `Y`, back `-12.98` in `X` toward the face, and inward `-9.03` in `Z`; `segmentDurationsMs = [1250, 450, 950, 450]`.

### 5.6 `151` — `Board Press` (`board-press`, `view: 'oblique', yawDeg: 28`)
- **Catalogue text (`ALL_300_MOTION_MAP.json:11554–11555`):**
  > `"instructions": "Lie on the bench and band the boards securely to the chest; confirm they remain fixed before unracking. Use a spotter when available. Set the feet, arch the back, and retract the shoulder blades, then take the bar out of the rack without protracting the shoulders. Lower the bar under control until it settles on the boards. Drive the bar up with force, keeping the elbows tucked until lockout.",`
  > `"cues": "Keep the boards banded and fixed. Let the bar settle on the boards. Keep the elbows tucked to lockout.",`
- **Measured start (`ph = 0`) and end (`ph = 1`) values:**
  - `ph = 0` (lockout with arched back and boards banded to chest): `chestBoard = { along: 0.25, length: 10, height: 4.2 }`, `elbowDeg3D = 173.94°`, `hip = [10.00, 23.84, 0.00]`, `neck = [-13.91, 24.47, 0.00]`, `t0BotY = 78.90` and `t32BotY = 78.90` on bench top `78.90` while arched mid-torso `t16BotY = 78.12` clears the bench by `0.78` units, planted `nearAnkle = [21.00, 2.16, ±12.00]`, `nearHold = [-12.91, 48.80, ±11.80]`.
  - `ph = 1` (bar settled on top of the chest-banded boards): `elbowDeg3D = 86.47°`, `forearmVertDeg3D = 0.05°`, `elbowTuckDeg = 11.12°`, `nearElbow = [-1.67, 23.70, 11.79]`, `nearHold = [-1.67, 35.70, ±11.80]`, painted bar bottom edge `barBotY = 62.00` rests flush on painted board top edge `boardTopY = 62.00` (`barToBoardGap = 0.00`); `segmentDurationsMs = [1150, 650, 850, 450]` (`650 ms` settle on the boards).

### 5.7 `252` — `Pin Presses` (`pin-presses`, `view: 'oblique', yawDeg: 28`)
- **Catalogue text (`ALL_300_MOTION_MAP.json:18318–18319`):**
  > `"instructions": "Set a bench inside a rack with the pins at the chosen height and the bar resting on them, then lie back with the bar above your usual touch point, shoulder blades pulled together and feet set. From a full pause on the pins, drive the bar up to straight arms, keeping the bar, wrists and elbows in line. Lower the bar back to the pins and let it settle before the next repetition.",`
  > `"cues": "Shoulder blades pulled together. Drive from a full pause. Settle the bar on the pins each time.",`
- **Measured start (`ph = 0`) and end (`ph = 1`) values:**
  - `ph = 0` (bottom dead-stop on rack safety pins at `Y = 35.20` above the usual chest touch point `Y = 31.80`): `elbowDeg3D = 91.33°`, `forearmVertDeg3D = 0.03°` (bar, wrists, and elbows aligned vertically), `elbowTuckDeg = 13.00°`, `nearElbow = [-1.81, 24.80, 12.20]`, `nearHold = [-1.81, 36.80, ±12.20]` (bar shaft bottom `36.80 - 0.80 = 36.00` rests with `0.00` painted gap on the safety pin top `35.20 + 0.80 = 36.00`), `t0BotY = 78.91`, `t32BotY = 78.90`, planted `nearAnkle = [22.00, 2.16, ±11.60]`.
  - `ph = 1` (straight-arm lockout): `elbowDeg3D = 173.98°`, `nearElbow = [-12.84, 36.86, 10.96]`, `nearHold = [-12.98, 48.79, ±12.20]`; `segmentDurationsMs = [900, 450, 1200, 850]` (`850 ms` full pause settling on the pins).

### 5.8 `203` — `Floor Press` (`floor-press`, `view: 'oblique', yawDeg: 28`)
- **Catalogue text (`ALL_300_MOTION_MAP.json:15043–15044`):**
  > `"instructions": "Lie on the floor with your head inside a rack, the bar set on low hooks, shoulder blades pulled together, and lift the bar off with straight arms. Lower the bar toward the lower chest with the elbows tucked until the upper arms rest on the floor, and pause. Press the bar back up, keeping the bar, wrists and elbows in line.",`
  > `"cues": "Shoulder blades pulled together. Pause with the arms on the floor. Wrists stacked over the elbows.",`
- **Measured start (`ph = 0`) and end (`ph = 1`) values:**
  - `ph = 0` (lockout on the floor with head inside the rack): `elbowDeg3D = 173.20°`, `hip = [10.00, 5.91, 0.00]`, `neck = [-13.99, 6.52, 0.00]`, `head = [-22.98, 6.83, 0.00]` (inside rack uprights at `X = -23.50` with low hooks at `Y = 29.50`), `t0BotY = 96.90` and `t32BotY = 96.90` (`0.00` painted gap to floor `96.90`), knees bent (`nearKnee = [26.22, 20.95, ±9.23]`) with planted feet `nearAnkle = [38.00, 2.16, ±11.00]`, `nearHold = [-12.99, 30.74, ±12.60]`.
  - `ph = 1` (upper arms resting flat on the floor with pause): `elbowDeg3D = 69.37°`, `forearmVertDeg3D = 0.01°` (wrists stacked over elbows), `elbowTuckDeg = 15.95°`, `nearElbow = [-2.74, 2.11, 12.60]` (`Y = 2.112 = BODY.lw * 0.88 / 2`, so the painted bottom edge of the upper arm touches the floor `96.90` with `0.00` gap and `0.00` sinking), `nearHold = [-2.74, 14.11, ±12.60]`; `segmentDurationsMs = [1200, 800, 950, 450]` (`800 ms` floor pause).

### 5.9 `249` — `One-Arm Kettlebell Floor Press` (`one-arm-kettlebell-floor-press`, `view: 'oblique', yawDeg: 28`)
- **Catalogue text (`ALL_300_MOTION_MAP.json:18113–18114`):**
  > `"instructions": "Lie on the floor holding a kettlebell in one hand with that upper arm resting on the floor and the palm facing in. Press the kettlebell straight up until the arm is straight, letting the wrist turn as it rises. Lower it slowly until the upper arm rests on the floor again. Complete the repetitions, then change arms.",`
  > `"cues": "Wrist stacked over the elbow. Press straight up. Lower until the arm rests on the floor.",`
- **Measured start (`ph = 0`) and end (`ph = 1`) values:**
  - `ph = 0` (bottom on the floor, kettlebell in near hand, upper arm resting on the floor, palm facing in): `implement = 'kettlebell'`, `kettlebellTurn = true` (`hAxis = [1, 0, 0]`), `t0BotY = 96.90`, `t32BotY = 96.90`, `nearElbow = [-2.59, 2.11, 12.00]` (`Y = 2.112 = BODY.lw * 0.88 / 2`, `0.00` painted floor gap), `nearHold = [-2.59, 14.11, 12.00]`, `elbowDeg3D = 69.35°`, `forearmVertDeg3D = 0.03°`, `elbowTuckDeg = 12.94°`, planted `nearAnkle = [38.00, 2.16, ±11.00]`.
  - `ph = 1` (pressed straight up to straight-arm lockout with wrist turned `90°`): `elbowDeg3D = 173.00°`, `nearElbow = [-12.75, 18.95, 9.56]`, `nearHold = [-12.99, 30.95, 9.40]` (directly over `nearShoulder = [-13.99, 6.52, 9.38]`), `hAxis = [0, 0, 1]` (`90.00°` wrist rotation); `segmentDurationsMs = [950, 400, 1450, 500]` (`1450 ms` slow lowering `> 950 ms` press).

### 5.10 `83` — `Cable Chest Press` (`cable-chest-press`, `view: 'oblique', yawDeg: 55, pitchDeg: 15`)
- **Catalogue text (`ALL_300_MOTION_MAP.json:6948–6949`):**
  > `"instructions": "Set two handles at chest height, face away, and take a staggered stance. Press both handles forward until your arms are long, letting them drift together at the end. Return under control — the cable pulls backward the entire rep, so the squeeze at lockout is real work here.",`
  > `"cues": "Brace into the staggered stance. Press to a full reach, hands finishing together. Ride the cables back slow.",`
- **Measured start (`ph = 0`) and end (`ph = 1`) values:**
  - `ph = 0` (standing in staggered stance facing away from two chest-height pulleys at `[-24.00, 61.50, ±19.50]`): `trunkDegFromHoriz = 96.00°` (`6.00°` athletic forward brace), `hip = [0.00, 45.00, 0.00]`, `neck = [2.51, 68.87, 0.00]`, planted rear `nearAnkle = [-10.00, 2.16, 6.80]`, planted lead `farAnkle = [10.00, 2.16, -6.80]` (`20.00`-unit staggered stance, `0.00` drift), `elbowDeg3D = 60.29°`, `nearElbow = [-3.91, 65.92, 19.69]`, `nearHold = [8.00, 64.50, ±19.50]`, 3D cable length `32.14` units.
  - `ph = 1` (full forward reach with long arms and hands drifted together): `elbowDeg3D = 173.65°`, `nearElbow = [14.27, 66.37, 5.96]`, `nearHold = [25.25, 64.50, ±1.50]` (`+17.25` units forward press in `X`, hands drifted together by `18.00` units per side from `±19.50` to `±1.50`), 3D cable length `52.52` units (lengthening monotonically across the working half `[0, 1]` and shortening on the `1450 ms` controlled return); `segmentDurationsMs = [950, 450, 1450, 450]`.

---

## 6. Gate Commands Run & Decisive Output

All five gate commands were executed via `batch_gates.sh` against source commit `cfbf952a10b8e0221bed2bdade59bdc946c41a10` and recorded in `docs/audits/accessible-coach/movement-completion/evidence/movement-34-presses/`:

1. **`typecheck.log` (`npm run typecheck`):**
   - `> tsc -p apps/mobile/tsconfig.json`
   - `exit code: 0`
2. **`jest-movement-preview.log` (`npx jest --config apps/mobile/jest.config.js --runInBand --no-cache --testPathPattern MovementPreview`):**
   - `PASS apps/mobile/test/components/MovementPreview.movA05Presses.test.js`
   - `PASS apps/mobile/test/components/MovementPreview.canonicalFrameFit.test.js`
   - `PASS apps/mobile/test/components/MovementPreview.chain.test.js`
   - `Test Suites: 61 passed, 61 total`
   - `Tests:       3427 passed, 3427 total`
   - `exit code: 0`
3. **`storage-guard.log` (`node --expose-gc tools/rendering/verify_preview_storage.mjs`):**
   - `"records": 225, "families": 75, "rawBytes": 649928, "gzipBytes": 107425`
   - `"pass": true`
   - `exit code: 0`
4. **`evidence-gate.log` (`node tools/rendering/test_verify_movement_evidence.mjs`):**
   - `PASS — clean evidence passes and all 19 injected defects are rejected by their own check.`
   - `exit code: 0`
5. **`rendered-output-probe.log` (`rendered-output probe (real MovementPreview, neutral figure, every 33 ms tick) compared with probe-8b9082b978a09b2c98db7f4a38ad1fb64dcbea85.json`):**
   - `movements measured: 219 (baseline 209)`
   - `added: 3 Competition Bench; 43 Close-Grip Bench Press; 45 Decline Bench Press; 102 Decline Dumbbell Bench Press; 65 Incline Dumbbell Press; 151 Board Press; 252 Pin Presses; 203 Floor Press; 249 One-Arm Kettlebell Floor Press; 83 Cable Chest Press`
   - `removed: none`
   - `changed, expected: none`
   - `changed, NOT expected: none`
   - `movements with overflow above 1e-6 dp: none`
   - `exit code: 0 (probe run exit 0)`

---

## 7. Unresolved Items

- None.
