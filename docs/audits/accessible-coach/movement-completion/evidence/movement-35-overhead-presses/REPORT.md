# MOV-A06 — Standing Overhead Presses (`4, 31, 41, 129, 189, 228, 230`)

## Status

- `EVIDENCE CAPTURED` — all 7 standing overhead presses (`4 Overhead Press`, `31 Arnold Press`, `41 Cable Shoulder Press`, `129 Alternating Kettlebell Press`, `189 Dumbbell One-Arm Shoulder Press`, `228 Kettlebell Arnold Press`, `230 Kettlebell Seesaw Press`) are authored on branch `movement/35-overhead-presses-2026-10-17` from base `9e03224865b78a94a49367828f09fe6df802e3dd`, with source commits `a4f2818d2fd1ecb4ce1b3394d78f1736b7268b5b` and `0f96a7508bf29e5225c7dc84499559f2a5284944`.
- `NOT VERIFIED — native Android runtime rendering on physical or virtual device` — verified in Node/Jest through the real `MovementPreview` component (`rendered-output-probe.log`) and headless cycle rasterizer (`render_motion_cycle.mjs`).

---

## 1. What I Did (Confirmed Against `git diff --name-only 9e03224865b78a94a49367828f09fe6df802e3dd..0f96a7508bf29e5225c7dc84499559f2a5284944`)

1. `apps/mobile/src/components/movementPreview/canonicalFigure.ts`:
   - Added `palmYaw?: number` and `farPalmYaw?: number` to `ChainPose` (lines 1227–1233) and 3D palm/handle orientation vectors (`palmDir`, `handleAxis`) in `chainGeometry` (lines 4957–4969, 5151–5152, 5164).
   - Extended `layoutChainExtras` (`bell` at lines 5258–5289 and `kb` at lines 5379–5396) so dumbbell plates, shaft, and knuckle-wrap segments and kettlebell handle/bell rest positions rotate in 3D with `palmYaw` / `farPalmYaw`, while preserving the exact `[0, 0, 1]` default handle axis when `palmYaw` is unset.
   - Authored 3D oblique chain definitions in `CHAIN_MOVEMENTS` (lines 4648–4878) for `overhead-press` (4), `arnold-press` (31), `cable-shoulder-press` (41), `alternating-kettlebell-press` (129), `dumbbell-one-arm-shoulder-press` (189), `kettlebell-arnold-press` (228), and `kettlebell-seesaw-press` (230).
2. `tools/rendering/chain_motion_specs.mjs`:
   - Added source-bound specs and 5-to-7-frame phase/duration/caption sequences for movements `4, 31, 41, 129, 189, 228, 230` (lines 2233–2354).
3. `tools/rendering/wo09_split_preview_manifest.mjs`:
   - Mapped `4, 31, 41, 129, 189, 228, 230` to `'vertical-press@standing'` in `LEGACY_FAMILY_KEYS` (lines 98–104).
4. `apps/mobile/src/components/movementPreview/movementPreviewManifest.json`, `apps/mobile/src/components/movementPreview/previewIndex.json`, `apps/mobile/src/components/movementPreview/families/vertical-press__standing.json`:
   - Regenerated via `node tools/rendering/author_chain_motion.mjs` and `node tools/rendering/wo09_split_preview_manifest.mjs`.
5. `apps/mobile/test/components/MovementPreview.movA06OverheadPresses.test.js`:
   - Written before authoring the drawings; tests universal 33 ms tick invariants (status `'pending'`, `>= 5` frames, upright uncurled trunk, planted feet with painted sole on `FLOOR = 96.9`, load over mid-foot base, elbow below wrist, back-to-front depth order) and per-movement text-bound invariants.
6. `apps/mobile/test/components/MovementPreview.approval.test.js` and `apps/mobile/test/components/MovementPreview.layout.test.js`:
   - Added `4, 31, 41, 129, 189, 228, 230` to `CANONICAL_AUTHORED` (line 102) and updated `CANONICAL.length` from `207` to `214` (line 53).

---

## 2. Views Chosen and Why

- `4 Overhead Press` (`view: 'oblique'`, `yawDeg: 34`): A pure side view collapses the barbell into an end-on disc that hides the face and head-through motion; a pure front view hides the bar's fore-aft position on the front shoulders and the head moving back and through. Turning 34 degrees shows both plates, the full grip across the front shoulders, the vertical forearms (`0.00 deg` off vertical at start), the bar path close past the face, and the head moving from `x = 1.447` at start to `x = 2.700` at lockout.
- `31 Arnold Press` (`view: 'oblique'`, `yawDeg: 32`): Turning 32 degrees shows both the elbows tucked tight in front of the shoulders at the start (`elbow.x = 8.103` vs `shoulder.x = 3.000`) and the 180-degree palm/dumbbell rotation from `palmYaw = 180` (palms facing the athlete, knuckle bar painted in front of the handle shaft) through `palmYaw = 90` (handles fore-aft) to `palmYaw = 0` (palms facing forward at lockout, shaft painted in front of the knuckle bar).
- `41 Cable Shoulder Press` (`view: 'oblique'`, `yawDeg: 36`): Turning 36 degrees separates the low pulley (`[20, 5, 11.5]`) and cable line from the torso, showing the cable dragging forward and down from the working hand throughout the press while the free far hand stays quiet at the hip.
- `129 Alternating Kettlebell Press` (`view: 'oblique'`, `yawDeg: 34`): Turning 34 degrees separates the near and far racked kettlebells so the waiting bell at the shoulder remains clearly visible while the pressing hand turns from `palmYaw = 90` (palm facing in, bell resting behind/outside the wrist) to `palmYaw = 0` (palm facing forward at lockout), and then the opposite side presses.
- `189 Dumbbell One-Arm Shoulder Press` (`view: 'oblique'`, `yawDeg: 32`): Turning 32 degrees shows the single dumbbell held with the palm facing forward (`palmYaw = 0`) from shoulder height to straight-arm lockout, the top pause (`600 ms`), the slow lowering (`1150 ms` vs `750 ms` press), and the quiet free hand at the side.
- `228 Kettlebell Arnold Press` (`view: 'oblique'`, `yawDeg: 34`): Turning 34 degrees shows the single kettlebell cleaned to the shoulder with the palm facing in (`palmYaw = 90`), the wrist rotation to palm facing forward (`palmYaw = 0`) as the kettlebell presses overhead, and the quiet free hand at the side.
- `230 Kettlebell Seesaw Press` (`view: 'oblique'`, `yawDeg: 34`): Turning 34 degrees separates the two kettlebells laterally so their simultaneous opposing trajectories (`ph: 1 -> 2`, crossing at `ph = 1.5` at `y = 83.977`) never occlude each other.

---

## 3. Kit Fields Added

- `ChainPose.palmYaw?: number` and `ChainPose.farPalmYaw?: number` (`apps/mobile/src/components/movementPreview/canonicalFigure.ts:1232-1233`): horizontal rotation of the palm about the vertical axis in degrees (`0` faces forward `+X` with handle axis along `side * Z`; `90` faces in toward the midline `-side * Z` with handle axis along `+X`; `180` faces back toward the athlete `-X` with handle axis along `-side * Z`). Interpolated across keyframes in `chainGeometry` (`canonicalFigure.ts:4957-4969`) and consumed by `bell` (`canonicalFigure.ts:5258-5289`) and `kb` (`canonicalFigure.ts:5379-5396`) in `layoutChainExtras`.

---

## 4. First Failing Test Run and Guard-Break Demonstration

### First Failing Test Run (Before Authoring Drawings)

Command:
`npx jest --config apps/mobile/jest.config.js --runInBand --no-cache apps/mobile/test/components/MovementPreview.movA06OverheadPresses.test.js`

Decisive output:
```text
FAIL apps/mobile/test/components/MovementPreview.movA06OverheadPresses.test.js
  MOV-A06 standing overhead presses: universal physics, painted floor contact, mid-foot balance, upright trunk, and depth order
    × movement 4 is authored as pending with >= 5 frames, planted painted floor contact, upright braced trunk, load over mid-foot, and back-to-front depth order at every 33 ms tick (4 ms)
    × movement 31 is authored as pending with >= 5 frames, planted painted floor contact, upright braced trunk, load over mid-foot, and back-to-front depth order at every 33 ms tick
    × movement 41 is authored as pending with >= 5 frames, planted painted floor contact, upright braced trunk, load over mid-foot, and back-to-front depth order at every 33 ms tick
    × movement 129 is authored as pending with >= 5 frames, planted painted floor contact, upright braced trunk, load over mid-foot, and back-to-front depth order at every 33 ms tick
    × movement 189 is authored as pending with >= 5 frames, planted painted floor contact, upright braced trunk, load over mid-foot, and back-to-front depth order at every 33 ms tick
    × movement 228 is authored as pending with >= 5 frames, planted painted floor contact, upright braced trunk, load over mid-foot, and back-to-front depth order at every 33 ms tick (1 ms)
    × movement 230 is authored as pending with >= 5 frames, planted painted floor contact, upright braced trunk, load over mid-foot, and back-to-front depth order at every 33 ms tick
    × 4 Overhead Press sets the bar across the front shoulders with a full grip and near-vertical forearms, presses close past the face, and moves the head through to a tall stacked lockout
    × 31 Arnold Press starts with dumbbells at shoulder height, elbows tight in front, and palms facing the athlete, then rotates the palms 180 degrees to face forward at lockout (1 ms)
    × 41 Cable Shoulder Press presses one handle from shoulder height to overhead lockout against a low pulley that drags forward and down throughout, with the free hand quiet
    × 129 Alternating Kettlebell Press vs 230 Kettlebell Seesaw Press: 129 keeps one bell waiting at the shoulder while turning the pressing palm from in to forward, whereas 230 moves one bell up as the other comes down
    × 189 Dumbbell One-Arm Shoulder Press and 228 Kettlebell Arnold Press show their distinct implement, wrist rotation (palm-forward throughout vs palm-in to palm-forward), top pause, and slow lowering

Test Suites: 1 failed, 1 total
Tests:       12 failed, 12 total
```

### Guard-Break Demonstration (Breaking `trunk: 90` -> `trunk: 78` on `overhead-press` Pose 1, Watching It Fail, and Restoring)

Decisive output when `trunk: 78` (lean-back arch) was injected on `overhead-press` Pose 1:
```text
  ● MOV-A06 standing overhead presses: universal physics, painted floor contact, mid-foot balance, upright trunk, and depth order › movement 4 is authored as pending with >= 5 frames, planted painted floor contact, upright braced trunk, load over mid-foot, and back-to-front depth order at every 33 ms tick

    expect(received).toBeLessThanOrEqual(expected)

    Expected: <= 0.5
    Received:    0.634770089781731

      66 |       expect(trunkDegFromHorizontal2D(g.joints)).toBeGreaterThanOrEqual(87);
    > 67 |       expect(Math.abs(g.world.neck[0] - g.world.hip[0])).toBeLessThanOrEqual(0.5);
         |                                                          ^

  ● MOV-A06 standing overhead presses: universal physics, painted floor contact, mid-foot balance, upright trunk, and depth order › 4 Overhead Press sets the bar across the front shoulders with a full grip and near-vertical forearms, presses close past the face, and moves the head through to a tall stacked lockout

    expect(received).toBeLessThan(expected)

    Expected: < 0.05
    Received:   4.98988057962623

    > 142 |     expect(Math.abs(top.world.neck[0] - top.world.hip[0])).toBeLessThan(0.05);
          |                                                            ^

Test Suites: 1 failed, 1 total
Tests:       2 failed, 10 passed, 12 total
```
Restored `trunk: 90` immediately after verifying the guard failure.

---

## 5. Measured Values Each Text Sets

All 7 movements stand with planted feet (`ankle.x = 0.000`, `toe.x = 5.400`, `midFootX = 2.700`, painted sole `y = 96.900 = FLOOR`), upright braced trunk (`trunk = 90 deg`, `|neck.x - hip.x| = 0.000`, `curled = false`), and `elbow.y <= wrist.y - 11.16` at every 33 ms tick:

1. **4 Overhead Press (`overhead-press`)**:
   - Catalogue text: `"Set the bar across the front shoulders with a full grip and the forearms close to vertical. Stand with balanced feet and brace before the bar leaves the shoulders. Press close past the face, move the head through to a tall lockout, and lower along the same path. If the torso leans into an incline press, reduce the load until the finish stays stacked."`
   - Measured: `implement = 'bar'`, full grip (`angles.hand = undefined`, `handCloseUp = null`), start bar hold `[4.355, 70.727, ±13.247]` across front shoulders (`neck = [2.700, 70.500, 0]`), start forearm `0.00 deg` off vertical (`elbow = [4.355, 58.727, ±13.247]`), head starts back at `[1.447, 79.412, 0]` (`head: 98`) and moves through to `[2.700, 79.500, 0]` (`head: 90`) at lockout, lockout hold `[2.700, 94.866, ±11.945]` stacked directly over `midFootX = 2.700` with `180.00 deg` 3D elbow extension, `viewBox = [24, -7, 52, 107]`, `segmentDurationsMs = [650, 650, 750, 750]` (`2800 ms`).
2. **31 Arnold Press (`arnold-press`)**:
   - Catalogue text: `"Sit or stand holding dumbbells at shoulder height with palms facing you. Press up while rotating your palms to face forward at the top. Reverse the rotation on the way back down to the start. Stay tall and braced the whole press — the lean-back arch is the classic cheat, and it quietly turns this into a sloppy incline press."` / `"Chest open, lats in the back pocket. Elbows tight, core tension. Rotate smooth all the way to lockout."`
   - Measured: `implement = 'bells'`, start hold `[4.451, 70.796, ±10.535]` at shoulder height (`shoulder.y = 70.500`), start elbows tucked tight in front at `[8.103, 59.557, ±12.619]` (`+5.103` units forward of `shoulder.x = 3.000`), start `palmYaw = 180, farPalmYaw = 180` (`palmDir = [-1, 0, 0]`, knuckle wrap painted after/in front of shaft), mid-press (`ph = 0.5`) `palmYaw = 90` (`handleAxis = [1, 0, 0]`, elbow opened out to `z = ±21.826`), lockout hold `[3.853, 94.925, ±11.093]` with `palmYaw = 0, farPalmYaw = 0` (`palmDir = [1, 0, 0]`, shaft painted after/in front of knuckle wrap) and `180.00 deg` 3D elbow extension, `viewBox = [29, -5, 40, 105]`, `segmentDurationsMs = [700, 700, 800, 800]` (`3000 ms`).
3. **41 Cable Shoulder Press (`cable-shoulder-press`)**:
   - Catalogue text: `"Set a low pulley and bring the handle to shoulder height, standing tall. Press to lockout overhead against the cable's pull, which drags forward and down the entire rep — that constant tension is the point, there is no rest at the top. Lower under control back to the shoulder. Usually run one arm at a time; the free hand tells you when you are leaning."`
   - Measured: `implement = 'handle'`, low pulley at `[20, 5, 11.5]` (`pulley.x - hold.x >= 16.089` forward and `pulley.y - hold.y <= -65.974` downward across every tick), start near hold `[3.911, 70.974, 14.067]` at shoulder height, lockout near hold `[2.700, 94.940, 11.093]` with `180.00 deg` 3D elbow extension (cable length grows from `68.095` at start to `91.372` at lockout), free far hand stationary at `[4.334, 46.498, -8.629]` across all ticks, `viewBox = [27, -4, 32, 105]`, `segmentDurationsMs = [650, 650, 800, 800]` (`2900 ms`).
4. **129 Alternating Kettlebell Press (`alternating-kettlebell-press`)**:
   - Catalogue text: `"Clean two kettlebells to the shoulders and stand tall with the palms facing in. Press one kettlebell straight overhead until the arm is straight, turning the palm to face forward as it rises, while the other stays at the shoulder. Lower it under control back to the shoulder, then press the other side."` / `"Stand tall and squeeze the glutes. One bell moves, the other waits at the shoulder. Finish with the arm straight beside the ear."`
   - Measured: `implement = 'kettlebells'`, 7-keyframe alternating cycle (`phases: [1, 0.5, 0, 1, 1.5, 2, 1]`, `segmentDurationsMs: [600, 600, 950, 600, 600, 950]`, `4300 ms`), rack (`ph = 1`) holds `[4.316, 70.890, ±11.992]` with `palmYaw = 90, farPalmYaw = 90` (`palmDir.z = ∓1`), near lockout (`ph = 0`) near hold `[2.700, 94.940, 11.093]` (`180.00 deg` elbow, `palmYaw = 0`) while far bell waits stationary at `[4.316, 70.890, -11.992]` (`farPalmYaw = 90`), far lockout (`ph = 2`) far hold `[2.700, 94.940, -11.093]` (`180.00 deg` elbow, `farPalmYaw = 0`) while near bell waits stationary at `[4.316, 70.890, 11.992]` (`palmYaw = 90`), `viewBox = [27, -4, 44, 104]`.
5. **189 Dumbbell One-Arm Shoulder Press (`dumbbell-one-arm-shoulder-press`)**:
   - Catalogue text: `"Sit on a bench with back support or stand tall, and bring one dumbbell to shoulder height with the palm facing forward and the other hand at your side or on a fixed support. Press the dumbbell straight up until the arm is straight. Pause, then lower it slowly to shoulder height. Complete the repetitions, then change arms."` / `"Ribs down, trunk tall. Press straight up. Lower slowly to the shoulder."`
   - Measured: `implement = 'bell'`, start near hold `[2.700, 70.910, 14.067]` at shoulder height with `palmYaw = 0` (`palmDir = [1, 0, 0]`), presses straight up (`Δx = 0.000`) to lockout `[2.700, 94.940, 11.093]` with `180.00 deg` 3D elbow extension and `palmYaw = 0`, pauses at lockout (`phases: [0, 1, 1, 0.5, 0]`, top hold `600 ms`), and lowers slowly (`2300 ms` total lowering vs `750 ms` press, `segmentDurationsMs = [750, 600, 1150, 1150]`, `3650 ms`), with free far hand stationary at `[4.334, 46.498, -8.629]`, `viewBox = [31, -5, 32, 105]`.
6. **228 Kettlebell Arnold Press (`kettlebell-arnold-press`)**:
   - Catalogue text: `"Clean a kettlebell to the shoulder and stand tall with the palm facing in. Press the kettlebell up and overhead, turning the wrist so the palm faces forward at the top. Lower it to the shoulder, turning the palm back to face in."` / `"Stand tall, eyes forward. Turn the palm as you press. Finish with the arm straight."`
   - Measured: `implement = 'kettlebell'`, start near hold `[4.316, 70.890, 11.992]` at shoulder height with `palmYaw = 90` (`palmDir = [0, 0, -1]`, `handleAxis = [1, 0, 0]`), lockout near hold `[2.700, 94.940, 11.093]` with `180.00 deg` 3D elbow extension and `palmYaw = 0` (`palmDir = [1, 0, 0]`, `handleAxis = [0, 0, 1]`), free far hand stationary at `[4.334, 46.498, -8.629]`, `viewBox = [27, -4, 36, 104]`, `segmentDurationsMs = [650, 650, 800, 800]` (`2900 ms`).
7. **230 Kettlebell Seesaw Press (`kettlebell-seesaw-press`)**:
   - Catalogue text: `"Clean two kettlebells to the shoulders and stand tall. Press one kettlebell overhead until the arm is straight. As you lower it to the shoulder, press the other kettlebell up, and keep alternating for the same number of repetitions on each side."` / `"Stand tall and squeeze the glutes. One up as one comes down. Finish each press with a straight arm."`
   - Measured: `implement = 'kettlebells'`, `phases: [0, 1, 2, 1, 0]`, `segmentDurationsMs: [900, 1250, 1250, 950]` (`4350 ms`), starts with both bells racked at `[4.316, 70.890, ±11.992]` (`ph = 0`), presses near bell to `[2.700, 94.940, 11.093]` (`180.00 deg` elbow, `ph = 1`), then across `ph: 1 -> 2` lowers the near bell while simultaneously pressing the far bell up to `[2.700, 94.940, -11.093]` (`180.00 deg` elbow, `ph = 2`), with both bells passing each other at the exact same height at `ph = 1.5` (`near hold = [1.651, 83.977, 21.581]`, `far hold = [1.651, 83.977, -21.581]`), `viewBox = [27, -4, 44, 104]`.

---

## 6. Commands Run and Decisive Output (`batch_gates.sh` on `0f96a7508bf29e5225c7dc84499559f2a5284944`)

- `typecheck.log`:
  `source commit: 0f96a7508bf29e5225c7dc84499559f2a5284944`
  `exit code: 0`
- `jest-movement-preview.log`:
  `source commit: 0f96a7508bf29e5225c7dc84499559f2a5284944`
  `Test Suites: 61 passed, 61 total`
  `Tests:       3380 passed, 3380 total`
  `exit code: 0`
- `storage-guard.log`:
  `source commit: 0f96a7508bf29e5225c7dc84499559f2a5284944`
  `"records": 222, "families": 75, "rawBytes": 643606, "gzipBytes": 106163, "pass": true`
  `exit code: 0`
- `evidence-gate.log`:
  `source commit: 0f96a7508bf29e5225c7dc84499559f2a5284944`
  `PASS — clean evidence passes and all 19 injected defects are rejected by their own check.`
  `exit code: 0`
- `rendered-output-probe.log`:
  `source commit: 0f96a7508bf29e5225c7dc84499559f2a5284944`
  `movements measured: 216 (baseline 209)`
  `added: 4 Overhead Press; 31 Arnold Press; 41 Cable Shoulder Press; 129 Alternating Kettlebell Press; 189 Dumbbell One-Arm Shoulder Press; 228 Kettlebell Arnold Press; 230 Kettlebell Seesaw Press`
  `removed: none`
  `changed, expected: none`
  `changed, NOT expected: none`
  `movements with overflow above 1e-6 dp: none`
  `exit code: 0 (probe run exit 0)`

---

## 7. Judgment Calls and Next Atomic Action

- **Judgment calls**:
  1. Used forward-kinematics `upperArm` and `forearm` angles (`[along, out]`) rather than `wrist` IK targets on all 7 standing overhead presses (matching existing overhead presses in `CHAIN_MOVEMENTS`), so the elbows arc cleanly outboard (`z ≈ ±21.8` at mid-press) with the forearms upright at every 33 ms tick and never cross over the head ring.
  2. When the first `batch_gates.sh` run on `a4f2818d2fd1ecb4ce1b3394d78f1736b7268b5b` reported `changed, NOT expected: 48 Double Kettlebell Front Squat` because `kb` defaulted to `[0, 0, side]` instead of `[0, 0, 1]` when `handleAxis` was `undefined`, added a second source commit (`0f96a7508bf29e5225c7dc84499559f2a5284944`) on top without amending or resetting, restoring `[0, 0, 1]` when `handleAxis` is `undefined`.
- **Next atomic action**: Commit `docs/audits/accessible-coach/movement-completion/evidence/movement-35-overhead-presses/` as the single evidence commit on `movement/35-overhead-presses-2026-10-17` and run `check_batch.mjs`.
