# MOV-A10-R1 Evidence Report (`movement-39-pulls-r1`)

- **Batch:** `MOV-A10-R1`
- **Branch:** `movement/51-pulls-repairs-2026-10-18`
- **Base Commit:** `a96621beac74fc8d0be1d922c7081452dafc4a70`
- **Source Commit:** `75c793807058421ee45e2e07c15cbb190b13a546`
- **Allowed Changed Movement IDs (13):** `6, 13, 71, 108, 209, 77, 211, 64, 231, 121, 112, 229, 85`

---

## 1. Summary of Repairs

1. **`211` Gorilla Chin/Crunch (`gorilla-chin-crunch`) — Major Knee-Angle & Shin-Through-Thigh Repair + Grip Close-Up + Hold Removal:**
   - Replaced the knee-folding shin angles (`shin: 0` at `poses[1]` and `shin: 112` at `poses[2]`, which closed the internal 3D knee angle to `49.5°` mid-pull and `9.0°` at the top and drew the shin inside the thigh) with `poses[0]: thigh: 1, shin: -91`, `poses[1]: thigh: 16, shin: -82`, `poses[2]: thigh: 26, shin: -94`.
   - Internal 3D knee angle (`hipJoint, knee, ankle`) stays `>= 60.00° >= 35°` across every 33 ms tick (`90.00°` at `ph=0`, `82.00°` at `ph=1`, `60.00°` at `ph=2`), the knees still finish at chest height (`knee.y = 87.48` inside `(hip.y + 10, neck.y)`), and the painted shin outline stays clear of the painted thigh outline across `s in [0, 0.72]` on every 33 ms tick.
   - Added magnified hand close-up `closeUp: { at: [-30, 88], r: 10, scale: 1.55, palm: 'underhand' }` and removed unsourced top and bottom holds (`phases: [0, 1, 2, 1, 0]`, `segments: [600, 600, 825, 825]`).

2. **Caption & Hold-Segment Cleanup (`6, 13, 71, 108, 209, 77, 211, 64`):**
   - Checked each of the eight A10 movements against its catalogue text in `ALL_300_MOTION_MAP.json`:
     - **`108` V-Bar Pulldown:** The instructions explicitly say *"Pull the elbows down and back until the handle reaches the upper chest, then pause without turning the rep into a row."* Kept the `450 ms` chest pause (`phases: [0, 0.5, 1, 1, 0.5, 0]`, `segments: [550, 550, 450, 775, 775]`) and removed the unsourced bottom overhead dwell.
     - **`64` Hanging Leg Raise:** The cues explicitly say *"Dead-still hang between reps."* Kept the `450 ms` dead-still hang at the bottom and removed the unsourced top hold (`phases: [0, 1.5, 3, 1.5, 0, 0]`, `segments: [750, 750, 1050, 1050, 450]`).
     - **`6, 13, 71, 209, 77, 211`:** Neither instructions nor cues name a pause or hold; removed all hold captions (`/\b(hold|pause|briefly)\b/i` absent outside `108`) and shortened each cycle to 5 turnaround keyframes (`phases: [0, 0.5, 1, 0.5, 0]` or `[0, 1, 2, 1, 0]`).

3. **Readable Grip Orientation (`13, 71, 64, 108, 209, 211`):**
   - Added magnified hand close-up panels (`closeUp`) to `13` (`palm: 'underhand'`, `panel.bar[0] < panel.knuckle[0]`), `71` (`palm: 'overhand'`, `panel.bar[0] > panel.knuckle[0]`), `211` (`palm: 'underhand'`), and `64` (`palm: 'overhand'`).
   - Extended `ChainCloseUp` and `handCloseUp` in `canonicalFigure.ts` with `'neutral'` and `'turn'` grip modes:
     - **`108` V-Bar Pulldown:** `closeUp: { at: [-29, 78], r: 10, scale: 1.55, palm: 'neutral' }` renders the two V-bar branches and both hands gripping from the outside with their inner palm pads facing each other (`palmsFacingEachOther: true`, `leftPalmX > leftDorsalX`, `rightPalmX < rightDorsalX`).
     - **`209` Full Range-Of-Motion Lat Pulldown:** Added `hand: [0, 0]` at `poses[0]`, `hand: [0, -45]` at `poses[1]`, and `hand: [0, -90]` at `poses[2]` with `closeUp: { at: [-34, 78], r: 10, scale: 1.55, palm: 'turn' }`, turning `palmYaw` monotonically from `0°` (`palmFacingViewer: true`, palms facing forward) at the overhead cross to `90°` (`palmFacingViewer: false`, palms facing each other) at the bottom, and updated the opening caption to include *"with the palms facing forward"*.

4. **`77` Straight-Arm Pulldown (`straight-arm-pulldown`) — Hands Reach the Thighs:**
   - Adjusted `poses[1]` and `poses[2]` (`upperArm: [-83.5, 22.9], forearm: [-95.5, 22.9]` at `poses[2]`) so the hands reach the thighs at the bottom of the arc while keeping a constant `168.00°` elbow angle and constant `29.93`-unit 3D hand spacing across every 33 ms tick.
   - At `ph = 1`, the 2D painted distance from the near hand (`grip.near`) to the near thigh segment (`j.nLeg -> j.kn`) is `4.96` units vs `BODY.lw * 0.44 + THIGH_HALF = 4.944` (painted contact gap `0.016 <= 0.15 < 0.5`), and the 3D sagittal distance is within `0.15` units of `4.944`.

5. **`108` V-Bar Pulldown (`v-bar-pulldown`) — Lifted Weight Stack:**
   - Added `weightStack: { x: 46, baseTop: 18, minClearance: 5.5, stroke: 24 }` to `v-bar-pulldown` and rendered the weight-stack guide rods, top structural crossbar from the high pulley, resting bottom stack block, and lifted upper stack plate in `layoutChainExtras`.
   - At `ph = 0` (full overhead reach), the lifted stack plate stays `5.5 >= 4.0` units above the resting stack (`liftedBottom = 23.5` vs `baseTop = 18.0`), rising to `47.5` at `ph = 1` (`clearance = 29.5`) and never settling onto the resting stack at any tick.

6. **Stream 3 Joint-Limit Repairs (`6, 13, 71, 231, 121, 112, 229, 85`) & `MovementPreview.jointLimits.test.js`:**
   - **`231` Kettlebell Turkish Get-Up (Lunge style):** Routed the sweeping far leg wide in `z` at `poses[1]` (`farThigh: [14, 72], farShin: [16, 72]`) so the internal 3D knee angle stays `>= 38.15° >= 35°` across every 33 ms tick of the sweep between poses 1 and 2 while keeping `kneeling.far.knee[1] = 3.64 < 4.0`.
   - **`121` Kettlebell Dead Clean:** Opened the top rack arm at `poses[2]` (`upperArm: [-84, -10], forearm: [82, -22]`) so internal 3D elbow angle is `34.81° >= 30°` while keeping `|kettlebell.body[0] - floorPose.kettlebell.body[0]| < 3.5`.
   - **`112` Bent Press:** Opened the rack arm at `poses[0]` and `poses[3]` (`upperArm: [-92, 14], forearm: [54, -22]`) so internal 3D elbow angle is `35.12° >= 30°`.
   - **`229` Kettlebell Seated Press:** Opened the rack arm at `poses[0]` (`upperArm: [-92, 16], forearm: [52, -20]`) so internal 3D elbow angle is `36.12° >= 30°`.
   - **`85` Double Kettlebell Push Press:** Opened the rack arms at `poses[0]` and `poses[1]` (`upperArm: [-90, 14], forearm: [56, -18]`) so internal 3D elbow angle is `34.12° >= 30°` on both arms.
   - **`6, 13, 71` Pull-Ups:** Opened the top-of-pull elbows to `31.69°` (`6`), `30.50°` (`13`), and `31.83°` (`71`) (`>= 30°`) with the chin still clearing the bar.
   - Added `apps/mobile/test/components/MovementPreview.jointLimits.test.js` covering all 34 movements in stream 3's batches (`MOV-A07, MOV-A10, MOV-A13, MOV-A14`) at every 33 ms tick (`knee >= 35°`, `elbow >= 30°`).

---

## 2. Movements Outside Stream 3's Batches Breaching `knee < 35°` or `elbow < 30°` (Untouched)

Per `MOV-A10-R1.md`, a scan of all 243 chain movements on `75c793807058421ee45e2e07c15cbb190b13a546` found **0** movements inside stream 3's batches (`A07, A10, A13, A14`) breaching `knee < 35°` or `elbow < 30°`, and **16** movements outside stream 3's batches that breach those limits (left untouched):

| Movement ID | Name | Slug | Minimum Angle Breach |
| ---: | :--- | :--- | :--- |
| `27` | Road Run | `road-run` | `minFarKnee = 25.09°` |
| `48` | Double Kettlebell Front Squat | `double-kettlebell-front-squat` | `minNearElbow = 20.69°, minFarElbow = 20.69°` |
| `62` | Hammer Curl | `hammer-curl` | `minNearElbow = 25.00°, minFarElbow = 25.00°` |
| `81` | Zercher Squat | `zercher-squat` | `minNearElbow = 28.00°, minFarElbow = 28.00°` |
| `126` | Alternate Hammer Curl | `alternate-hammer-curl` | `minNearElbow = 25.00°, minFarElbow = 25.00°` |
| `157` | Cable One Arm Tricep Extension | `cable-one-arm-tricep-extension` | `minNearElbow = 25.00°` |
| `172` | Cross Body Hammer Curl | `cross-body-hammer-curl` | `minNearElbow = 29.55°, minFarElbow = 29.55°` |
| `193` | Dumbbell Tricep Extension -Pronated Grip | `dumbbell-tricep-extension-pronated-grip` | `minNearElbow = 25.00°, minFarElbow = 25.00°` |
| `202` | Floor Glute-Ham Raise | `floor-glute-ham-raise` | `minNearKnee = 27.00°, minFarKnee = 27.00°` |
| `208` | Front Squat (Clean Grip) | `front-squat-clean-grip` | `minNearElbow = 16.51°, minFarElbow = 16.51°` |
| `234` | Kneeling High Pulley Row | `kneeling-high-pulley-row` | `minNearKnee = 30.00°, minFarKnee = 30.00°` |
| `235` | Kneeling Squat | `kneeling-squat` | `minNearKnee = 26.00°, minFarKnee = 26.00°` |
| `244` | Natural Glute Ham Raise | `natural-glute-ham-raise` | `minNearKnee = 19.00°, minFarKnee = 19.00°` |
| `247` | One-Arm Dumbbell Row | `one-arm-dumbbell-row` | `minNearKnee = 23.00°` |
| `253` | Preacher Hammer Dumbbell Curl | `preacher-hammer-dumbbell-curl` | `minNearElbow = 27.99°, minFarElbow = 27.99°` |
| `273` | Shotgun Row | `shotgun-row` | `minNearElbow = 24.48°` |
