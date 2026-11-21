# MOV-A05-R1 Audit Repair Report (`movement-34-presses-r1`)

- **Branch:** `movement/41-presses-repairs-2026-10-18`
- **Base Commit:** `61afce33a3603e5c2fb4a2bb4a30d784ebb586ef`
- **Source Commit:** `38134f313676d1721c940c5fe5461f42837b03bd`
- **Baseline Probe:** `probe-abfa57d31016af68b8993b7ba1b5391c27940f27.json`
- **Repaired Movements (`allowedChanged`):** `249, 45, 102, 65, 252, 83, 2, 46, 176, 257`

---

## 1. What I Did (Repairs and Measured Values Before vs. After)

### 1.1 Major — `249 One-Arm Kettlebell Floor Press` (`one-arm-kettlebell-floor-press`)
- **Finding (`AUDIT_A05.json`):** At the bottom (`ph = 0`), the upper arm lay almost parallel to the torso (`12.94°` from the trunk in the floor plane), and the kettlebell translated `10.40` units along the trunk (`X` from `-2.59` to `-12.99`) during its `16.84`-unit vertical rise.
- **Repair:** Updated `one-arm-kettlebell-floor-press` in `apps/mobile/src/components/movementPreview/canonicalFigure.ts` (`yawDeg: 16`, `elbowPole: [-75.964, 30.19]`, `poses[0].wrist: [-9.488, 14.113, 20.182]`, `poses[1].wrist: [-12.19, 30.94, 9.384]`) and its `reason` in `tools/rendering/chain_motion_specs.mjs`.
- **Measured Values (Before -> After):**
  - Upper-arm angle from the trunk in the floor plane (`XZ`) at bottom (`ph = 0`): `12.94°` -> `67.37°` (`22.63°` forward of the shoulder line; test binds `[40°, 70°]`).
  - Bottom elbow floor height (`world.near.elbow[1]`): `2.112` -> `2.113` (painted bottom edge rests on `y = 96.9`).
  - Bottom forearm angle from vertical (`forearmDegFromVertical3D`): `0.02°` -> `0.00°`.
  - Horizontal kettlebell travel along the trunk over the press (`|top.hold[0] - bot.hold[0]|`): `10.400` units -> `2.702` units (test binds `<= 3.0` units; projected 2D `X` shift `0.38` dp across a `16.83` dp vertical rise).
  - Top lockout elbow angle (`deg3D(shoulder, elbow, hold)`): `176.29°` -> `176.42°` (test binds `>= 172°`).
  - Top horizontal offset from shoulder (`|top.hold[0] - shoulder[0]|`): `0.998` units -> `1.798` units (test binds `<= 2.0` units).

### 1.2 Minor — First Captions of `45`, `102`, and `65` (`tools/rendering/chain_motion_specs.mjs`)
- **`45 Decline Bench Press` (`captions[0]`):**
  - **Old:** `'Hook your legs into the decline bench, take the bar just wider than shoulder width, and hold lockout over your eyes.'`
  - **New:** `'Hook your legs into the decline bench, take the bar just wider than shoulder width, and have a spotter for the unrack to lockout over your eyes.'`
- **`102 Decline Dumbbell Bench Press` (`captions[0]`):**
  - **Old:** `'Secure the legs in a decline bench, lie back with the shoulder blades pinned into the pad, and press the dumbbells into position.'`
  - **New:** `'Secure the legs in a decline bench, sit with the dumbbells on the thighs, then lie back and bring the bells to the chest before pressing them into position.'`
- **`65 Incline Dumbbell Press` (`captions[0]`):**
  - **Old:** `'Set the bench between 30 and 45 degrees, plant the feet, and start from the top with the dumbbells over your face.'`
  - **New:** `'Set the bench between 30 and 45 degrees, kick the dumbbells up off your knees one at a time, and start from the top.'`

### 1.3 Minor — `252 Pin Presses` (`tools/rendering/chain_motion_specs.mjs`)
- **Finding (`AUDIT_A05.json`):** `captions[2]` added a lockout hold (`'Hold lockout with straight arms above the shoulders.'`) not in the source text, and `segments[1]` held the top for `450` ms.
- **Repair:** Shortened `segments[1]` to a `200` ms top turnaround and replaced `captions[2]`.
- **Measured Values (Before -> After):**
  - `segmentDurationsMs`: `[900, 450, 1200, 850]` (`top = 450 ms`) -> `[900, 200, 1200, 850]` (`top = 200 ms`, test binds `<= 200 ms`, bottom pin pause `850 ms >= 800 ms`).
  - `captions[2]`:
    - **Old:** `'Hold lockout with straight arms above the shoulders.'`
    - **New:** `'Reach straight arms at the top with the bar, wrists and elbows in line.'`

### 1.4 Minor — Apparatus-Bound Tests for `45`, `102`, and `65` (`apps/mobile/test/components/MovementPreview.movA05Presses.test.js`)
- **`45` & `102` (Hooked legs against rollers):** Bound test to the two `roller` shapes in `movement.equipment` (`knee`-to-roller 3D distance `<= 4.5`, `ankle`-to-roller 3D distance `<= 5.5`) and the two painted roller circles (`r = 2.6, fill = 'textMid'`) in `layoutCanonicalFigure` (`kneeRollerGap = -2.975 dp <= 0`, `ankleRollerNearFootGap = -1.405 dp <= 0`), plus painted zero-gap torso contact on `declinePadPrim`.
- **`65` (Incline backrest slab angle):** Bound test directly to the inclined `slab` in `movement.equipment` (`worldBackrestDeg = 33.53°` in `[30°, 45°]`) and the painted backrest `slab` bone in `layoutCanonicalFigure` (`projBackrestDeg = 36.89°` in `[30°, 45°]`), plus zero-gap contact (`<= 0.05` dp) with painted torso slices `0` and `32`.

### 1.5 Minor — `83 Cable Chest Press` (`cable-chest-press`)
- **Finding (`AUDIT_A05.json`):** At `yawDeg: 55`, the far pulley projected to `X = 54.75`, inside the painted torso horizontal span `[44.69, 57.34]`, so the torso occluded the far pulley and most of the far cable.
- **Repair:** Changed `yawDeg` from `55` to `30` in `canonicalFigure.ts` and updated `reason` in `chain_motion_specs.mjs`.
- **Measured Values (Before -> After):**
  - `yawDeg`: `55°` -> `30°`
  - Projected near pulley `pNear`: `[14.61, 41.32]` -> `[15.48, 38.02]`
  - Projected far pulley `pFar`: `[54.75, 25.61]` -> `[39.48, 27.27]`
  - Painted torso horizontal span `torsoX`: `[44.69, 57.34]` -> `[44.70, 58.06]`
  - Far pulley outer-edge clearance to the left of `torsoMinX`: `-12.26` dp (occluded inside torso) -> `+3.02` dp clear to the left of the torso (test binds `> 2.0` dp).

### 1.6 Rigid Bar in the Deadlift Family (`2`, `46`, `176`, `257`) & `MovementPreview.rigidBar.test.js`
- **Finding:** In `2 (deadlift)`, `46 (deficit-deadlift)`, `176 (deadlift-with-bands)`, and `257 (reverse-band-deadlift)`, `poses[0]` had `upperArm: [-90.5, -1.4], forearm: [-90.5, -1.4]` (`wristDistFloor = 17.5708`) while `poses[1]` had `upperArm: [-85, 8], forearm: [-85, 8]` (`wristDistLockout = 25.5875`, widening by `8.0167` units during the pull).
- **Repair:** Updated `poses[1]` in `2`, `46`, `176`, and `257` to `upperArm: [-85, -1.4], forearm: [-85, -1.4]`, and added `apps/mobile/test/components/MovementPreview.rigidBar.test.js` covering all 45 two-hand bar movements in `previewManifest` (`bar`, `ez`, `cableBar`, excluding `barAt === 'elbows'`) across every 33 ms tick.
- **Measured Values (Before -> After):**
  - `2 Deadlift`: floor `17.5708`, lockout `25.5875` (`drift = 8.0167`) -> floor `17.5708`, lockout `17.5708` (`drift = 0.0000`).
  - `46 Deficit Deadlift`: floor `17.5708`, lockout `25.5875` (`drift = 8.0167`) -> floor `17.5708`, lockout `17.5708` (`drift = 0.0000`).
  - `176 Deadlift with Bands`: floor `17.5708`, lockout `25.5875` (`drift = 8.0167`) -> floor `17.5708`, lockout `17.5708` (`drift = 0.0000`).
  - `257 Reverse Band Deadlift`: floor `17.5708`, lockout `25.5875` (`drift = 8.0167`) -> floor `17.5708`, lockout `17.5708` (`drift = 0.0000`).

---

## 2. Gate Logs & Decisive Output (`EVIDENCE CAPTURED`)

### 2.1 Typecheck (`typecheck.log`)
```text
source commit: 38134f313676d1721c940c5fe5461f42837b03bd
command: npm run typecheck


> athlete-kinetics@0.1.0 typecheck
> tsc -p apps/mobile/tsconfig.json

exit code: 0
```

### 2.2 Jest MovementPreview Suite (`jest-movement-preview.log`)
```text
source commit: 38134f313676d1721c940c5fe5461f42837b03bd
command: npx jest --config apps/mobile/jest.config.js --runInBand --no-cache --testPathPattern MovementPreview
...
PASS apps/mobile/test/components/MovementPreview.movA05Presses.test.js
PASS apps/mobile/test/components/MovementPreview.movA03Deadlifts.test.js
PASS apps/mobile/test/components/MovementPreview.chain.test.js (53.037 s)
PASS apps/mobile/test/components/MovementPreview.rigidBar.test.js
Test Suites: 62 passed, 62 total
Tests:       3474 passed, 3474 total
Snapshots:   0 total
exit code: 0
```

### 2.3 Storage Guard (`storage-guard.log`)
```text
source commit: 38134f313676d1721c940c5fe5461f42837b03bd
command: node --expose-gc tools/rendering/verify_preview_storage.mjs

{
  "runtime": "v24.11.1",
  "scope": "Host storage and retained JSON-clone regression only; no native peak memory/frame-timing/4GBphone acceptance",
  "records": 225,
  "families": 75,
  "rawBytes": 649965,
  "gzipBytes": 107686,
  "largestFamily": {
    "file": "horizontal-press__supine.json",
    "rawBytes": 59891
  },
  ...
  "pass": true
}
exit code: 0
```

### 2.4 Evidence Gate (`evidence-gate.log`)
```text
source commit: 38134f313676d1721c940c5fe5461f42837b03bd
command: node tools/rendering/test_verify_movement_evidence.mjs
...
PASS — clean evidence passes and all 19 injected defects are rejected by their own check.
exit code: 0
```

### 2.5 Rendered-Output Probe (`rendered-output-probe.log`)
```text
source commit: 38134f313676d1721c940c5fe5461f42837b03bd
command: rendered-output probe (real MovementPreview, neutral figure, every 33 ms tick) compared with probe-abfa57d31016af68b8993b7ba1b5391c27940f27.json

movements measured: 219 (baseline 219)
added: none
removed: none
changed, expected: 2 Deadlift; 46 Deficit Deadlift; 176 Deadlift with Bands; 257 Reverse Band Deadlift; 45 Decline Bench Press; 102 Decline Dumbbell Bench Press; 65 Incline Dumbbell Press; 252 Pin Presses; 249 One-Arm Kettlebell Floor Press; 83 Cable Chest Press
changed, NOT expected: none
movements with overflow above 1e-6 dp: none
  2 Deadlift: drawn f9f701b241bd19e5d186c71a73c1d7f74eb3c26998ebc3591587cc729c600346 captions 9d2a8752cf3602407cc76f21e0c7cd02e48d635bf79aec58b6a1daeb4606d673 stage 122.61x240.00 cycle 3600 ms
  46 Deficit Deadlift: drawn 0e15f71358d959c5b19a309b8f97cb351c2c3f42fd6526f9f763b8dd53851775 captions cf8a13848ca5d53cecab555f8d4670af6ac3dcccb729976c1798e4da668483cf stage 117.50x240.00 cycle 3650 ms
  176 Deadlift with Bands: drawn db2efe3766d3bc8dce6b3a34493062a5142c805cd2a82a55cb1dbf26a6478529 captions 901139ddb7e017051d3fce3d58e6e39d7d32c65c6cb3c8f06f386358ec31e930 stage 122.61x240.00 cycle 3600 ms
  257 Reverse Band Deadlift: drawn 1e5a4446eb4cf88eff42a6d02d52a9a9bd9cb9b9573b72a321657e15bf3af1ba captions a863622970652b21647d1ed867aa7e9883aba88aabb5ac02f60cfd8d50e4e2a9 stage 132.77x240.00 cycle 3600 ms
  45 Decline Bench Press: drawn 8626380ba205a993ad7c79cda1b0edfee22472fff3262bba08a7a43197328c31 captions 4bd02c23812c828ef4855ac058c7ed274d396ebd0980d3d6520e1fb6931b7c48 stage 240.00x144.00 cycle 3050 ms
  102 Decline Dumbbell Bench Press: drawn 3009fa954183c9ef051551676f93b9dbea93ee72d447bc84a625209a6b1934ed captions b0c3ddaae60cf43c485d0d5a28e101680213bc9f5b8fd5aa7f6da1e9f41f21b5 stage 240.00x153.25 cycle 3100 ms
  65 Incline Dumbbell Press: drawn f2ce0a3d1ad9af4d989438873e696841c26d11f6b9d13ff8e17aaa18de2117c9 captions 278596af0dcc7ff736bb78d979bef6774b7c0c6378c55f64f76b394606eed174 stage 232.94x240.00 cycle 3100 ms
  252 Pin Presses: drawn cb474214b8d876122ad6d8fef6a09bc9252af28c70ba521d2d335a538624887c captions 7cb3c0a9ae931e3265a3b1c4af32809e601e4c47aeb8f156476b2909386fc190 stage 201.95x240.00 cycle 3150 ms
  249 One-Arm Kettlebell Floor Press: drawn a802319607cb0ab29ac9173e2ff03d723ce74c0e9911f87efa4488970b967840 captions e0b003788960523751bdaf380e93f385115688272efed5cf8e05b64bfde2c626 stage 240.00x117.07 cycle 3300 ms
  83 Cable Chest Press: drawn 8397bd75f2615b9ef55fb7a7b6ef2cbb30d8456368a47b47e20f4979fc75dc3b captions c8dd42b4cc60b4338131fbcd40adc6bdc4ec310120c0bf7e5fed761900211ded stage 176.17x240.00 cycle 3300 ms
exit code: 0 (probe run exit 0)
```

---

## 3. What I Could Not Verify
- `NOT VERIFIED — On-device Android/iOS physical runtime rendering and frame-rate profiling`: All evidence in this batch is captured from headless Jest/SVG and Resvg PNG rendering on the host machine; native 4 GB phone runtime memory and frame-timing are outside the host gate scope.
