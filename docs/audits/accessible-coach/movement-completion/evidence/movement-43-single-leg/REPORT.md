# MOV-A13 Evidence Report — Single-Leg Work and Calf Raises (`18, 36, 56, 136, 194, 239, 67, 96`)

## 1. Scope & Source Commit
- **Batch:** `MOV-A13`
- **Branch:** `movement/44-single-leg-2026-10-18`
- **Base Commit:** `914dc85b2c161ca140379f5a22a124b1f3350274`
- **Source Commits:** `325978ef9dab82ff44c46ba30108286316fed720`, `019668f6c9bf55dfb9fe272870cbf732adf5a16f`
- **Movements Authored (8):**
  - `18` Bulgarian Split Squat (`movement/bulgarian-split-squat/demo/v1`, `bench`, oblique `18°`)
  - `36` Barbell Step-Up (`movement/barbell-step-up/demo/v1`, `barbell`, oblique `18°`)
  - `56` Dumbbell Step-Up (`movement/dumbbell-step-up/demo/v1`, `dumbbells`, oblique `18°`)
  - `136` Barbell Lunge (`movement/barbell-lunge/demo/v1`, `barbell`, oblique `18°`)
  - `194` Elevated Back Lunge (`movement/elevated-back-lunge/demo/v1`, `barbell`, oblique `18°`)
  - `239` Lunge Pass Through (`movement/lunge-pass-through/demo/v1`, `kettlebell`, oblique `22°`)
  - `67` Kettlebell Pistol Squat (`movement/kettlebell-pistol-squat/demo/v1`, `kettlebell`, oblique `18°`)
  - `96` Standing Barbell Calf Raise (`movement/standing-barbell-calf-raise/demo/v1`, `barbell`, oblique `18°`)

## 2. Views Chosen and Why
- **Oblique `18°` (`18, 36, 56, 136, 194, 67, 96`):** Separates the near and far limbs, hip joints, and shoulder girdle across the body while preserving true sagittal-plane joint angles, vertical hip/knee paths, step/box/bench geometry, and bar/dumbbell placement without near-far occlusion.
- **Oblique `22°` (`239` Lunge Pass Through):** Slightly wider yaw opens the window beneath the front thigh so the kettlebell handle and body remain clearly visible as the bell passes under the front thigh from the inside hand to the outside hand on both sides.

## 3. Measured Values Set by Each Source Text
- **`18` Bulgarian Split Squat:**
  - Front foot planted flat on the floor at `ankle = [13.50, 2.16, 6.80]`, `toe = [18.90, 2.16, 6.80]` (`foot = 0°`), painted sole at `96.71` (`FLOOR = 96.9`).
  - Top of the rear foot resting on `chainFlatBench(-34, -16, 12.0)` at `farAnkle = [-18.50, 13.00, -6.80]`, `farToe = [-23.90, 13.00, -6.80]` (`farFoot = 180°`).
  - Standing front knee `174.1°` (`>= 172°`); bottom front knee `74.3°`.
  - Rear knee drops straight down from `y = 22.32` (`ph = 0`) to `y = 3.29` (`ph = 2`, drop `19.03` units) with horizontal drift `0.16` units (`< 0.5`).
- **`36` Barbell Step-Up & `56` Dumbbell Step-Up:**
  - Whole lead foot planted flat on the `y = 20.0` box across every tick (`ankle = [0.00, 22.16, 6.80]`, `toe = [5.40, 22.16, 6.80]`, painted sole at `76.71` on box top `76.90`).
  - At `ph = 0` (bottom), lead thigh is at `-10.0°` from horizontal (`<= 12°`, near parallel to the floor), and the trailing floor toe touches the floor at `y = 2.16` while the trailing ankle is elevated at `y = 4.83` (`farFoot = -29.61°`).
  - At `ph = 2` (top), standing knee reaches `175.0°` (`>= 172°`) while the trailing leg hangs passively behind the box (`farAnkle = [-11.81, 24.07, -6.80]`, `farToe = [-6.88, 21.87, -6.80]`).
  - Lowering segment duration (`1500 ms`) exceeds the drive-up segment duration (`1100 ms`).
  - Across every `33 ms` tick, 3D CoM stays strictly over the standing foot `[0.00, 5.40]`:
    - `36` Barbell Step-Up (`0.40` bodyweight bar, constant 3D wrist span `33.12`): loaded CoM `x in [1.88, 3.69]`, unloaded CoM `x in [0.34, 1.33]`.
    - `56` Dumbbell Step-Up (`0.25` bodyweight bells, arms hanging quiet at `upperArm = [-90, 8], forearm = [-90, 6]`): loaded CoM `x in [1.10, 3.31]`, unloaded CoM `x in [0.53, 1.62]`.
- **`136` Barbell Lunge:**
  - Barbell across upper back with constant 3D wrist span `33.12` and rack behind (`x = -22`).
  - Standing pose (`ph = 0`): feet hip-width apart at `x = -6.00`, both knees straight at `174.1°` (`>= 172°`).
  - Forward step (`ph = 1`): lead ankle advances `22.50` units to `x = 16.50, y = 2.16`.
  - Straight-down hip drop (`ph = 1 -> 2`): hip drops from `[0.00, 41.20]` to `[0.00, 24.80]` (`dx = 0.00`, `dy = 16.40`), bottom front knee `78.0°` in line with toes (`|knee[0] - toe[0]| = 0.14 < 1.0`), rear knee `68.3°` hovering at `y = 3.58` above the floor, torso upright (`trunk = 89°`) across every tick.
  - Post-set instruction (`"Complete the repetitions on one leg, then change legs."`) appears only in the final frame caption (`p7`).
- **`194` Elevated Back Lunge:**
  - Barbell across upper back with constant 3D wrist span `33.12`.
  - Standing on the `y = 6.0` platform (`ph = 1`): both ankles at `[10.00, 8.16, ±6.80]`, both knees straight at `174.1°` (`>= 172°`).
  - First rep (`ph = 0`, near leg steps back off platform to `[-18.50, 5.21, 6.80]`): near knee reaches `y = 2.841` with painted bottom `96.891` (`FLOOR = 96.9`), front knee flexed to `55.6°`.
  - Second rep (`ph = 2`, far leg steps back off platform to `[-18.50, 5.21, -6.80]`): far knee reaches `y = 2.841` with painted bottom `96.891` (`FLOOR = 96.9`), front knee flexed to `55.6°`.
- **`239` Lunge Pass Through:**
  - Standing poses (`ph = 0` and `ph = 3`): both knees straight at `174.1°` (`>= 172°`), kettlebell in near hand (`bellSide = +1` at `ph = 0`) and far hand (`bellSide = -1` at `ph = 3`).
  - First lunge (`ph = 1 -> 2`, opposite/far foot steps forward to `x = 11.50`): torso upright (`trunk = 76°`), kettlebell passes under the front (far) thigh (`bell body y = 10.61 < far thigh midpoint y = 16.72 - 3.0`) from `bellSide = +0.45` (`textHi`) to `bellSide = -0.85` (`textLow`).
  - Second lunge (`ph = 4 -> 5`, near foot steps forward to `x = 11.50`): kettlebell passes under the front (near) thigh (`bell body y = 10.61 < near thigh midpoint y = 16.72 - 3.0`) from `bellSide = -0.45` (`textLow`) to `bellSide = +0.85` (`textHi`).
- **`67` Kettlebell Pistol Squat:**
  - Standing foot rooted flat on the floor across every tick (`ankle = [0.00, 2.16, 6.80]`, `toe = [5.40, 2.16, 6.80]`, painted sole `96.71` at `FLOOR = 96.9`).
  - Standing knee straight at top (`175.0° >= 172°`) and deeply flexed at bottom (`51.0° < 60°`).
  - Free (far) leg stays straight (`176.0° >= 172°`) and well off the floor across every tick (`farAnkle[1] >= 8.90`, `farToe[1] >= 11.27`, painted sole `<= 91.8 < FLOOR - 5.0`).
  - Kettlebell reaches forward by `+14.12` units at the bottom as a counterbalance; 3D CoM with the `0.20` bodyweight bell stays strictly over the standing foot `[0.00, 5.40]` (`x in [3.48, 5.26]`, unloaded CoM `x in [0.15, 2.96]`) across every `33 ms` tick.
  - Lowering segment (`1500 ms`) is slower than the drive-up segment (`1100 ms`).
- **`96` Standing Barbell Calf Raise:**
  - Barbell across upper back with constant 3D wrist span `33.12`; body tall (`trunk = 89°`) with straight knees (`179.0° >= 172°`) across every tick.
  - Forefeet rooted at `toe = [5.40, 7.968, ±6.80]` on the `y = 6.0` block (`[2.2, 0.5]` to `[8.8, 6.0]`) with heels free off the back edge (`x < 2.2`).
  - Bottom stretch (`ph = 1`, `foot = +28°`): ankle drops to `y = 5.62` (below block top `6.0`) and heel bottom drops to `y = 3.65` (`2.35` units below block top), held for a `500 ms` pause (`p2 -> p3`).
  - Top peak (`ph = 2`, `foot = -42°`): ankle rises to `y = 11.77` (`+5.77` units above block top), held for a `450 ms` pause (`p4 -> p5`).

## 4. Kit Fields Added
- `ChainPose.bellSide?: number` (`apps/mobile/src/components/movementPreview/canonicalFigure.ts`): interpolates which hand holds a single kettlebell (`+1` near hand, `0` centred between both hands, `-1` far hand) and exposes `world.kettlebell`.
- `ChainMovement.kettlebellHang?: boolean` (`apps/mobile/src/components/movementPreview/canonicalFigure.ts`): hangs a single kettlebell's body below its handle (`bellGrip[1] - 4.6`) for two-handed goblet holds and under-thigh hand-to-hand passes.

## 5. Gate Summary
- `typecheck.log`: `exit code: 0`
- `jest-movement-preview.log`: `exit code: 0`
- `storage-guard.log`: `exit code: 0`
- `evidence-gate.log`: `exit code: 0`
- `rendered-output-probe.log`: `exit code: 0 (probe run exit 0)`
