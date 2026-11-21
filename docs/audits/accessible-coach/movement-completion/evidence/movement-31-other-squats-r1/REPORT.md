# MOV-A02-R1 Report — The Other Squats (Repair 1)

- **Batch ID:** `MOV-A02-R1`
- **Branch:** `movement/31-other-squats-2026-10-17`
- **Base Commit:** `62add4bc79011f8a118f661c9ec89d9d79912736`
- **Source Commit:** `3c7c2a6220ac485bda06625ff13035ecd553b1a4`
- **Movement IDs:** `140, 192, 81, 98, 120, 235, 105, 48`
- **Status:** `EVIDENCE CAPTURED`

---

## 1. Repair Summary & Untouched Movements

Five of the eight movements in `MOV-A02` (`140` Barbell Squat To A Bench, `192` Dumbbell Squat To A Bench, `81` Zercher Squat, `235` Kneeling Squat, `48` Double Kettlebell Front Squat) were accepted on sight in Round 1 and remain byte-identical in both `drawnSha256` and `captionSha256`.

Three movements were repaired in `MOV-A02-R1`:
1. **`98` `Barbell Hack Squat` (`barbell-hack-squat`):**
   - Added `plateRadius?: number` to `ChainMovement` (`apps/mobile/src/components/movementPreview/canonicalFigure.ts` lines `1297–1298`), exported `CHAIN_FLOOR_PLATE = 8.3` and `CHAIN_FLOOR_BAR_HEIGHT = CHAIN_FLOOR_PLATE + 1.2` (`= 9.5`, lines `1352–1354`), and wired `const pr = movement.plateRadius ?? 4.2;` in `layoutChainExtras` (`line 4535`). With the plate's `2.4`-wide bone stroke cap (`w / 2 = 1.2`), `plateRadius: CHAIN_FLOOR_PLATE` (`8.3`) gives a `9.5`-unit outer plate radius (19-unit diameter Olympic plate) whose painted bottom edge (`Math.max(y1, y2) + w / 2`) rests directly on `CHAIN_FLOOR = 96.900000` (`0.000000` box-unit painted plate-to-floor gap) when the bar centre starts at `Y = CHAIN_FLOOR_BAR_HEIGHT = 9.500000`.
   - Lowered the bottom keyframe (`ph = 0`) hip and trunk (`hip: [-8.5, 12.0], trunk: 40`) and gave the bottom pose explicit wrist targets on the floor-resting bar behind the calves (`wrist: [-3.9, 9.5, 9.5], farWrist: [-3.9, 9.5, -9.5]`, `elbowPole: [-40, 0]`) while keeping collinear straight-arm forward kinematics at the top (`ph = 1`: `upperArm: [-98, -6], forearm: [-98, -6]`), so both elbows remain completely straight (`179.999999 deg`, reach `24.500000 = 12.5 + 12.0`) and the bar skims up close behind the legs (`bar[0] < knee[0] - 3.0` on every phase).
2. **`120` `Jefferson Squats` (`jefferson-squats`):**
   - Set `plateRadius: CHAIN_FLOOR_PLATE` (`8.3`), lowered the bottom keyframe (`ph = 0`) so the bar rests on the floor line (`hip: [0, 12.0], trunk: [42, 58]`, bar `Y = CHAIN_FLOOR_BAR_HEIGHT = 9.500000`, painted plate bottom `96.900000 = CHAIN_FLOOR`, `0.000000` box-unit painted plate-to-floor gap), and kept both arms straight (`179.999999 deg` elbow angle, reach `24.500000`) at both the bottom (`wrist: [5.4, 9.5, 11.4], farWrist: [-5.4, 9.5, -11.4]`) and standing lockout (`upperArm: [-89, 10], forearm: [-89, 10], farUpperArm: [-91, 10], farForearm: [-91, 10]`).
   - Turned the view to `yawDeg: 28` with a wider straddle stance (`ankle: [-7.0, 2.16, 18.0], farAnkle: [7.0, 2.16, -18.0]`, `kneePole: [90, 36]`) and `58°` torso twist across the bar so the near hand projects clearly in front of the trunk (`wr = [59.1, 87.4]`, `+9.1` box units ahead of `hp[0] = 50.0`), the far hand projects clearly behind the trunk (`wf = [40.9, 87.4]`, `-9.1` box units behind `hp[0] = 50.0`), and the barbell runs visibly between the straddled legs (`bar midpoint = [0, 9.50, 0]` to `[0, 41.20, 0]`).
3. **`105` `One-Arm Overhead Kettlebell Squat` (`one-arm-overhead-kettlebell-squat`):**
   - Adjusted the near overhead arm (`upperArm: [85, -12], forearm: [88, -8]` at standing; `upperArm: [87, -14], forearm: [90, -10]` at bottom) so the locked overhead arm stays stacked over the near shoulder (`|wrist[0] - shoulder[0]| <= 3.5`, `wrist[1] > head[1] + 10`) while clearing the head circle (`r = 5.5` plus half stroke `0.7 = 6.2`) across every `33 ms` tick with a minimum clearance of **`+2.005` box units** (`+0.755` box units against the `primBounds` `r + 1.95 = 7.45` circle box).

---

## 2. Turned Views & Yaw Chosen Per Family

1. **`bench-squat` (`140` Barbell Squat To A Bench, `192` Dumbbell Squat To A Bench) — `yawDeg: 30`:**
   - Unchanged from `MOV-A02`: retains `86.6%` sagittal depth for the bench contact (`slab` at `y = 20.6`) and `50%` lateral Z projection for the shoulder-width stance and side dumbbells.
2. **`zercher-squat` (`81` Zercher Squat) — `yawDeg: 32`:**
   - Unchanged from `MOV-A02`: clearly shows the bar cradled in the elbow crooks (`barAt: 'elbows'`), clasped hands at the chest, and elbows riding inside the knees at the bottom.
3. **`barbell-hack-squat` (`98` Barbell Hack Squat) — `yawDeg: 30`:**
   - At `30°`, the floor-resting `8.3`-radius plates (`painted bottom = 96.900000 = CHAIN_FLOOR`) behind the calves, the `180°` straight arms reaching down behind the legs, and the close vertical path skimming behind the calves and hamstrings to standing lockout read cleanly.
4. **`jefferson-squat` (`120` Jefferson Squats) — `yawDeg: 28`:**
   - At `28°` with `58°` torso twist across the bar, the straddled legs (`ankle: [-7.0, 2.16, 18.0], farAnkle: [7.0, 2.16, -18.0]`) and alternating hands (`wr[0] = 59.1` in front of the torso, `wf[0] = 40.9` behind the torso) separate cleanly in 2D while the floor-starting plates (`painted bottom = 96.900000 = CHAIN_FLOOR`) and centred bar path (`X = 0, Z = 0`) travel straight between the legs.
5. **`kneeling-squat` (`235` Kneeling Squat) — `yawDeg: 30`:**
   - Unchanged from `MOV-A02`: shows both shins and knees planted flat on the floor and the backward hip hinge toward the heels.
6. **`kettlebell-squat` (`105` One-Arm Overhead Kettlebell Squat, `48` Double Kettlebell Front Squat) — `yawDeg: 32`:**
   - At `32°`, `105` shows the unilateral overhead kettlebell stacked over the near shoulder with `+2.005` box units of clearance from the head circle alongside the forward counterbalance arm, and `48` (unchanged) shows both kettlebells racked on the forearms at the chest.

---

## 3. Chain Kit Additions (`apps/mobile/src/components/movementPreview/canonicalFigure.ts`)

1. **`barAt?: 'hands' | 'elbows' | 'behind'` (`lines 1295–1296`, `4308–4320`, `4511–4512`, `4529`):**
   ```ts
     implement?: 'none' | 'bells' | 'bell' | 'hammer' | 'bar' | 'ez' | 'cableBar' | 'handle' | 'handles' | 'rope' | 'longBar' | 'kettlebell' | 'kettlebells';
     /** Where a held bar rests on the figure: across the hands by default, cradled in the elbow crooks ('elbows'), or held in the hands with its far half behind the legs ('behind'). */
     barAt?: 'hands' | 'elbows' | 'behind';
     /** Half-length of a held barbell's plate segment (4.2 by default; larger for floor-starting barbell lifts). */
     plateRadius?: number;
   ```
2. **`plateRadius?: number`, `CHAIN_FLOOR_PLATE`, and `CHAIN_FLOOR_BAR_HEIGHT` (`lines 1297–1298`, `1352–1354`, `4534–4540`):**
   ```ts
   /** Half-length of a floor-starting barbell plate segment (with its 1.2 cap, outer radius is 9.5). */
   export const CHAIN_FLOOR_PLATE = 8.3;
   export const CHAIN_FLOOR_BAR_HEIGHT = CHAIN_FLOOR_PLATE + 1.2;
   ```
   ```ts
         if (kind !== 'cableBar') {
           const pr = movement.plateRadius ?? 4.2;
           const plate = (c: CanonicalPoint, color: ColorRole, opacity: number): FigurePrim =>
             ({ ...line([c[0] + uy * pr, c[1] - ux * pr], [c[0] - uy * pr, c[1] + ux * pr], 2.4, color, opacity), stroke: 'ink1', strokeWidth: 0.6 });
           farGroup.push(plate([farEnd[0] + ux * 2, farEnd[1] + uy * 2], farTone, farAlpha));
           near.push(plate([nearEnd[0] - ux * 2, nearEnd[1] - uy * 2], 'textHi', 1));
         }
   ```
3. **`'kettlebells'` on `ChainMovement['implement']` (`lines 1294`, `4558–4564`):**
   ```ts
       if (kind === 'kettlebells') {
         const fa = figure.projectFar(chainAdd(w.far.hold, [0, 0, 1], -2.6));
         const fb = figure.projectFar(chainAdd(w.far.hold, [0, 0, 1], 2.6));
         const fc = figure.projectFar(chainAdd(w.far.hold, [KETTLEBELL_REST[0], KETTLEBELL_REST[1], -KETTLEBELL_REST[2]], 1));
         far.push({ kind: 'circle', cx: fc[0], cy: fc[1], r: KETTLEBELL_RADIUS, fill: farColor, stroke: 'ink1', strokeWidth: 1, opacity: farOpacity });
         far.push(line(fa, fb, 2.2, farColor, farOpacity));
       }
   ```

---

## 4. Exact Measurements for `98`, `120`, and `105`

### 4.1 `98` — `Barbell Hack Squat` (`barbell-hack-squat`, `yawDeg: 30`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:7952–7953`):**
  > `"instructions": "Set a bar on the floor behind your calves, stand about hip width, then squat down and take a shoulder-width grip with long arms. Brace the trunk and drive the floor away, letting the bar skim up behind the legs as the hips and knees straighten together. Lower along the same close path; when the grip or torso position breaks before the legs tire, that is the load limit for the day.",`
  > `"cues": "Set the chest proud and the arms long. Push the floor away. Keep the bar close behind the legs.",`
- **Bottom-keyframe (`ph = 0`) plate-to-floor gap & elbow angle:**
  - Bar world `Y`: `9.500000` (screen `Y`: `87.400000`)
  - `plateRadius`: `8.3` (`CHAIN_FLOOR_PLATE`; segment half-length `8.3` + stroke cap `1.2` = outer plate radius `9.5`)
  - Near & far plate painted bottom edge (`Math.max(y1, y2) + w / 2`): `96.900000` (`CHAIN_FLOOR = 96.900000`)
  - **Painted plate-to-floor gap:** `0.000000` box units (segment-endpoint-to-floor: `1.200000` box units)
  - **Near & far elbow angle:** `179.999999 deg` (`180°` straight arms; shoulder-to-wrist reach `24.500000`)

### 4.2 `120` — `Jefferson Squats` (`jefferson-squats`, `yawDeg: 28`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:9435–9436`):**
  > `"instructions": "Straddle the bar with the feet angled comfortably, then squat down and take one hand in front of the body and one behind at equal distances. Brace a tall torso and push both feet through the floor to stand with the bar travelling between the legs. Lower along the same centred path and switch orientation between sets; if the bar twists away from the midline, reset the grip and stance before adding load.",`
  > `"cues": "Centre the torso over the bar. Push both feet through the floor. Keep the bar travelling straight between the legs.",`
- **Bottom-keyframe (`ph = 0`) plate-to-floor gap, elbow angle & 2D grip/leg separation:**
  - Bar world `Y`: `9.500000` (screen `Y`: `87.400000`), bar midpoint: `[0.000000, 9.500000, 0.000000]`
  - `plateRadius`: `8.3` (`CHAIN_FLOOR_PLATE`; segment half-length `8.3` + stroke cap `1.2` = outer plate radius `9.5`)
  - Near & far plate painted bottom edge (`Math.max(y1, y2) + w / 2`): `96.900000` (`CHAIN_FLOOR = 96.900000`)
  - **Painted plate-to-floor gap:** `0.000000` box units (segment-endpoint-to-floor: `1.200000` box units)
  - **Near & far elbow angle:** `179.999999 deg` (`180°` straight arms; shoulder-to-wrist reach `24.500000`)
  - **2D projected hands vs trunk (`ph = 0`):** `hp = [50.0, 84.9]`, near wrist `wr = [59.1, 87.4]` (`+9.1` box units in front of trunk), far wrist `wf = [40.9, 87.4]` (`-9.1` box units behind trunk)

### 4.3 `105` — `One-Arm Overhead Kettlebell Squat` (`one-arm-overhead-kettlebell-squat`, `yawDeg: 32`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:8420–8421`):**
  > `"instructions": "Clean and press one kettlebell overhead, lock the elbow, and use the free arm forward as a counterbalance. Root the whole foot and sit between the hips while keeping the bell stacked over the shoulder and the eyes forward. Pause at the deepest owned position, then drive to standing; the rep ends where the bell drifts or the ribs flare, not where the hips wish to go.",`
  > `"cues": "Punch the bell toward the ceiling. Sit between the hips on a rooted foot. Drive up under the bell.",`
- **Head-overlap / arm-to-head clearance measurement across all `33 ms` ticks:**
  - Minimum across the full `3200 ms` cycle occurs at `t = 0 ms`:
    - **Near upper arm (`el -> nArm`) to head (`r = 5.5`, stroke outer edge `r + 0.7 = 6.2`):** centre-to-segment distance `10.317` box units, arm half-width `2.112` box units (`w = 4.224`), **painted edge-to-edge clearance: `+2.005` box units** (`+0.755` box units against the `primBounds` `r + 1.95 = 7.45` circle box; zero bounding-box or segment intersection at every tick).
    - **Near forearm (`wr -> el`) to head:** centre-to-segment distance `11.6627` box units, arm half-width `1.728` box units (`w = 3.456`), **painted edge-to-edge clearance: `+3.7347` box units** (`+2.4847` box units against `r = 7.45`).

### 4.4 Unchanged Movements (`140`, `192`, `81`, `235`, `48`)
- **`140` `Barbell Squat To A Bench` (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:10798–10799`):**
  > `"instructions": "Place a flat bench behind you, take the bar from the rack across the upper back and stand with the feet shoulder-width apart and toes turned slightly out. Bend the knees and sit the hips back, chest up, until you lightly touch the bench. Drive through the feet to stand back up without resting on the bench.",`
  > `"cues": "Sit the hips back to the bench. Touch lightly, stay tight. Chest up, knees in line with the toes.",`
- **`192` `Dumbbell Squat To A Bench` (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:14306–14307`):**
  > `"instructions": "Stand in front of a flat bench with a dumbbell in each hand at your sides, feet shoulder-width apart and toes turned slightly out. Bend the knees and sit the hips back, chest up, until you lightly touch the bench. Push through the feet to stand back up without resting on the bench.",`
  > `"cues": "Sit back to the bench. Touch lightly, stay tight. Chest up, eyes forward.",`
- **`81` `Zercher Squat` (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:6811–6812`):**
  > `"instructions": "Cradle the bar in the crooks of the elbows, clasp the hands, and stand from the rack. Squat between the knees while the torso stays as tall as the front load allows. Drive up without letting the bar roll down the forearms. Use a wrap or pad as needed; if arm pressure becomes painful or changes the position, end the set and adjust.",`
  > `"cues": "Elbows ride inside the knees at the bottom. Brace tall like a front squat. Wrap the bar, then give it full effort.",`
- **`235` `Kneeling Squat` (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:17179–17180`):**
  > `"instructions": "Kneel tall in a rack with the bar on the back and the hips, knees and shoulders stacked. Sit the hips back toward the heels only as far as the trunk stays braced. Drive the hips forward to return to tall kneeling; when the ribs flare, shorten the range.",`
  > `"cues": "Set the ribs down before you sit back. Move at the hips, not the low back. Finish tall through the glutes.",`
- **`48` `Double Kettlebell Front Squat` (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:4581–4582`):**
  > `"instructions": "Clean two kettlebells into the rack position, resting on your forearms at your chest. Squat down as deep as you can control, keeping your elbows in and chest up. Drive back up to standing without letting the bells pull you forward.",`
  > `"cues": "Elbows in, bells resting on the forearms. Stay tall — chest proud against the load. Full foot planted, knees out.",`

---

## 5. Gate Commands Run & Decisive Output

All five gate commands were executed via `batch_gates.sh` against source commit `3c7c2a6220ac485bda06625ff13035ecd553b1a4` and recorded in `docs/audits/accessible-coach/movement-completion/evidence/movement-31-other-squats-r1/`:

1. **`typecheck.log` (`npm run typecheck`):**
   - `> tsc -p apps/mobile/tsconfig.json`
   - `exit code: 0`
2. **`jest-movement-preview.log` (`npx jest --config apps/mobile/jest.config.js --runInBand --no-cache --testPathPattern MovementPreview`):**
   - `PASS apps/mobile/test/components/MovementPreview.movA02OtherSquats.test.js`
   - `Test Suites: 58 passed, 58 total`
   - `Tests:       2823 passed, 2823 total`
   - `exit code: 0`
3. **`storage-guard.log` (`node --expose-gc tools/rendering/verify_preview_storage.mjs`):**
   - `"records": 199, "families": 75, "rawBytes": 579263, "gzipBytes": 96725`
   - `"pass": true`
   - `exit code: 0`
4. **`evidence-gate.log` (`node tools/rendering/test_verify_movement_evidence.mjs`):**
   - `PASS — clean evidence passes and all 19 injected defects are rejected by their own check.`
   - `exit code: 0`
5. **`rendered-output-probe.log` (`rendered-output probe (real MovementPreview, neutral figure, every 33 ms tick) compared with probe-fc22d196e2b9d3a0a601089f68f169486b43f275.json`):**
   - `movements measured: 193 (baseline 185)`
   - `added: 140 Barbell Squat To A Bench; 192 Dumbbell Squat To A Bench; 81 Zercher Squat; 98 Barbell Hack Squat; 120 Jefferson Squats; 235 Kneeling Squat; 105 One-Arm Overhead Kettlebell Squat; 48 Double Kettlebell Front Squat`
   - `removed: none`
   - `changed, expected: none`
   - `changed, NOT expected: none`
   - `movements with overflow above 1e-6 dp: none`
   - `exit code: 0 (probe run exit 0)`

---

## 6. Unresolved Items

- None.
