# MOV-A06-R1 Standing Overhead Presses Repair Report

- **Order**: `MOV-A06-R1` (`movement-35-overhead-presses-r1`)
- **Branch**: `movement/43-overhead-presses-repairs-2026-10-18`
- **Base commit**: `a75185fffc3e542d700aac42c79c15f1065703f2`
- **Source commit**: `fc3fcf3ce0eee1cbf916188e3b13f377d9a66f08`
- **Movements repaired (`allowedChanged`)**: `4, 31, 41, 129, 189, 228, 230`
- **Status**: `EVIDENCE CAPTURED`

## 1. What I Did (Confirmed Against `git status` / `git diff --name-only`)

- `apps/mobile/src/components/movementPreview/canonicalFigure.ts`:
  - **`4` `Overhead Press` (`overhead-press`)**:
    - Turned the oblique view closer to the side (`yawDeg: 18`, `originX: 58`) so the fore-aft bar path past the face and the head moving through under the bar read clearly while leaving `x ∈ [5..31]` open for a full-grip hand close-up panel (`closeUp: { at: [-38, 65], r: 13.0, scale: 4.4, zoom: 1, open: 0 }`).
    - Replaced independent shoulder/elbow angular interpolation with 3 explicit 3D poses (`elbowPole: [-88, 10]`) that pin `wrist: [x, y, 12.8]` and `farWrist: [x, y, -12.8]` at a constant `25.6000`-unit 3D span (`maxSpanDrift = 0.0000 <= 0.5`):
      - Pose 0 (`ph = 0`, Rack across front shoulders): `at: [1.3, 46.5]`, `trunk: 90`, `head: 114` (`head[0] = -2.36`), `wrist: [4.65, 70.4, 12.8]`, `farWrist: [4.65, 70.4, -12.8]` (`offVertical3D = 8.62° <= 10°`).
      - Pose 1 (`ph = 1`, Bar clearing the forehead while head draws back): `at: [1.3, 46.5]`, `trunk: 90`, `head: 122` (`head[0] = -3.47`, `headTop = 84.33`), `wrist: [4.55, 86.2, 12.8]`, `farWrist: [4.55, 86.2, -12.8]`. Across every 33 ms tick of the cycle, the 3D distance from `world.head` to the bar midpoint is at least `7.53 >= 7.0` (`BODY.hr + 0.8 = 6.2 + 0.8`) and the 2D screen distance from `joints.hd` to the bar midpoint is at least `7.16 >= 7.0`.
      - Pose 2 (`ph = 2`, Stacked lockout over mid-foot): `at: [2.7, 46.5]`, `trunk: 90`, `head: 90` (`head = [2.70, 79.50, 0]`, `neck = [2.70, 71.50, 0]`), `wrist: [2.7, 94.72, 12.8]`, `farWrist: [2.7, 94.72, -12.8]` (`midFootX = 2.70`, elbow angle `173.43° >= 172°`).
  - **`230` `Kettlebell Seesaw Press` (`kettlebell-seesaw-press`)**:
    - Enabled `cycle: true` on `kettlebell-seesaw-press` so that `ph: 2 -> 3` interpolates directly from Pose 2 (far kettlebell locked out overhead, near kettlebell at the rack) back to Pose 0 (both kettlebells at the rack) without passing back through `ph = 1` (near kettlebell overhead). Across one full cycle (`phases: [0, 1, 1.5, 2, 3]`, `segments: [950, 625, 625, 950]`), `nearTopCount === 1` and `farTopCount === 1`.
  - **`41` `Cable Shoulder Press` (`cable-shoulder-press`)**:
    - Set `yawDeg: 24`, `originX: 38`, and placed the low pulley and its vertical frame forward of the body at `[30, 6, 6.0]` (`lines: [{ from: [30, 6, 6.0], to: 'nearGrip' }]`). In 2D screen space, the pulley projects to `x = 62.97`, which is `+16.45` screen units in front of the forward-most toe (`maxFootScreenX = 46.51`, bound `> 14.0`).
  - **`31` `Arnold Press`, `129` `Alternating Kettlebell Press`, `189` `Dumbbell One-Arm Shoulder Press`, `228` `Kettlebell Arnold Press`**:
    - Added `originX: 58` and `closeUp: { at: [-44, 65], r: 13.0, scale: 4.4, zoom: 1 }` and extended `handCloseUp` + `layoutChainExtras` to project `palmYaw` (`palmDir`, `handleAxis`, `palmFacingViewer`, `palmScreenDir`, `handleScreenDir`) into the magnified hand close-up panel, selecting the active far hand when `w.far.hold[1] > w.near.hold[1] + 1` so `129` shows the active hand's palm rotation on both sides.
- `tools/rendering/chain_motion_specs.mjs`:
  - Updated `4` (`overhead-press`) to `phases: [0, 1, 2, 1, 0]`, `segments: [550, 650, 700, 700]` (`2600 ms`).
  - Updated `230` (`kettlebell-seesaw-press`) to `phases: [0, 1, 1.5, 2, 3]`, `segments: [950, 625, 625, 950]` (`3150 ms`).
- `apps/mobile/src/components/movementPreview/movementPreviewManifest.json` and `apps/mobile/src/components/movementPreview/families/vertical-press__standing.json`:
  - Regenerated via `node tools/rendering/author_chain_motion.mjs` and `node tools/rendering/wo09_split_preview_manifest.mjs`.
- `apps/mobile/test/components/MovementPreview.movA06OverheadPresses.test.js` and `apps/mobile/test/components/MovementPreview.fingerCurls.test.js`:
  - Added tests binding the fixed 3D grip width (`maxSpanDrift <= 0.5`), 3D/2D head clearance (`>= BODY.hr + 0.8 = 7.0` at every 33 ms tick), full-grip hand close-up (`open === 0`) on `4`, palm-direction close-ups on `31`, `129`, `189`, `228`, forward pulley screen projection (`pulleyScreen[0] > maxFootScreenX + 14`) on `41`, and equal repetition counts (`nearTopCount === 1`, `farTopCount === 1`) on `230`.
  - Updated the `closeUp` negative-invariant allowlist in `MovementPreview.fingerCurls.test.js` to include `overhead-press`, `arnold-press`, `alternating-kettlebell-press`, `dumbbell-one-arm-shoulder-press`, and `kettlebell-arnold-press`.

## 2. Views Chosen and Why

| ID | Movement | View (`yawDeg`, `originX`) | Rationale |
|---:|---|---|---|
| `4` | Overhead Press | `oblique` (`yawDeg: 18`, `originX: 58`) | Shows the fore-aft bar path clearing the face as the head draws back (`head[0]: -2.36 -> -3.47`) and moves through to a stacked lockout (`head[0] = 2.70 = neck[0] = midFootX`), while keeping the fixed 3D grip span (`25.60` units) and the closed-hand full-grip close-up panel (`at: [-38, 65]`) unobstructed. |
| `31` | Arnold Press | `oblique` (`yawDeg: 32`, `originX: 58`) | Shows both dumbbells starting at shoulder height with elbows tucked in front (`elbow[0] - shoulder[0] = 5.48`) and pressing to lockout while the magnified hand close-up panel (`at: [-44, 65]`) shows the 180° palm rotation from facing the chest (`palmYaw = 180`) to facing forward (`palmYaw = 0`). |
| `41` | Cable Shoulder Press | `oblique` (`yawDeg: 24`, `originX: 38`) | Separates the forward low pulley (`[30, 6, 6.0]`, screen `x = 62.97`) by `+16.45` screen units in front of the forward-most toe (`x = 46.51`) so the forward-and-down cable pull reads without crossing behind the ankles/shins. |
| `129` | Alternating Kettlebell Press | `oblique` (`yawDeg: 34`, `originX: 58`) | Shows both kettlebells at the shoulders with one waiting stationary at the rack while the other presses overhead, alongside a magnified kettlebell-and-hand close-up panel (`at: [-44, 65]`) showing the 90° palm turn from facing in (`palmYaw = 90`) to facing forward (`palmYaw = 0`) on each active side. |
| `189` | Dumbbell One-Arm Shoulder Press | `oblique` (`yawDeg: 32`, `originX: 58`) | Shows the single dumbbell pressing straight overhead with the free hand stationary at the side, while the magnified hand close-up panel (`at: [-44, 65]`) shows the palm facing forward (`palmYaw = 0`) from start to top. |
| `228` | Kettlebell Arnold Press | `oblique` (`yawDeg: 34`, `originX: 58`) | Shows the single kettlebell seated on the back of the forearm and pressing overhead while the magnified hand close-up panel (`at: [-44, 65]`) shows the palm turning from facing in (`palmYaw = 90`) at the shoulder to facing forward (`palmYaw = 0`) at lockout. |
| `230` | Kettlebell Seesaw Press | `oblique` (`yawDeg: 34`, `originX: 48`) | Shows both kettlebells moving simultaneously in opposite directions during `ph: 1 -> 2` (`near` descending as `far` rises) and returning directly from Pose 2 to Pose 0 (`ph: 2 -> 3` via `cycle: true`) so each arm performs exactly 1 press per cycle. |

## 3. First Failing Test Run & Guard-Break Check

- **First failing test run (before source repairs)**:
  - Command: `npx jest --config apps/mobile/jest.config.js --runInBand apps/mobile/test/components/MovementPreview.movA06OverheadPresses.test.js`
  - Decisive output:
    - `Tests: 5 failed, 7 passed, 12 total`
    - `4 Overhead Press`: `expect(maxSpanDrift).toBeLessThanOrEqual(0.5)` — `Expected: <= 0.5, Received: 18.449079033997145`
    - `31 Arnold Press`: `expect(startPanel).not.toBeNull()` — `Received: null`
    - `41 Cable Shoulder Press`: `expect(pulleyScreen[0]).toBeGreaterThan(maxFootScreenX + 14)` — `Expected: > 65.5435547594828, Received: 53.41840687576908`
    - `129 Alternating Kettlebell Press vs 230 Kettlebell Seesaw Press`: `expect(nearTopCount).toBe(1)` — `Expected: 1, Received: 2` (`farTopCount = 1`)
    - `189 Dumbbell One-Arm Shoulder Press and 228 Kettlebell Arnold Press`: `expect(p189Start).not.toBeNull()` — `Received: null`
- **Guard-break verification (after source repairs)**:
  - Temporarily perturbed `farWrist` in `overhead-press` Pose 1 from `[4.5, 86.4, -10.6]` to `[4.5, 86.4, -14.6]` and ran `MovementPreview.movA06OverheadPresses.test.js`:
    - `expect(maxSpanDrift).toBeLessThanOrEqual(0.5)` failed with `Expected: <= 0.5, Received: 3.9977088757396437` (`Tests: 1 failed, 11 passed, 12 total`).
  - Restored `canonicalFigure.ts` and re-ran `MovementPreview.movA06OverheadPresses.test.js`: `Tests: 12 passed, 12 total`.

**Correction 2026-10-29:** The guard-break line above gives a baseline that conflicts with section 1 and the sealed `quotes.json`, both of which record Pose 1 `farWrist` as `[4.55, 86.2, -12.8]`. A four-unit negative-z perturbation of that quoted baseline would be `[4.55, 86.2, -16.8]`; the edited source from the original guard-break run was not retained, so that hypothetical endpoint is not a newly verified observation. The original perturbation claim and recorded test results are preserved above; the actual baseline used in that run cannot be established from this packet.

## 4. Commands Run and Decisive Output

1. `typecheck.log`:
   - Command: `npm run typecheck`
   - Output: `exit code: 0`
2. `jest-movement-preview.log`:
   - Command: `npx jest --config apps/mobile/jest.config.js --runInBand --no-cache --testPathPattern MovementPreview`
   - Output: `Test Suites: 62 passed, 62 total` / `Tests: 3486 passed, 3486 total` / `exit code: 0`
3. `storage-guard.log`:
   - Command: `node --expose-gc tools/rendering/verify_preview_storage.mjs`
   - Output: `"records": 229, "families": 75, "rawBytes": 664046, "gzipBytes": 109208, "pass": true` / `exit code: 0`
4. `evidence-gate.log`:
   - Command: `node tools/rendering/test_verify_movement_evidence.mjs`
   - Output: `PASS — clean evidence passes and all 19 injected defects are rejected by their own check.` / `exit code: 0`
5. `rendered-output-probe.log`:
   - Command: `rendered-output probe (real MovementPreview, neutral figure, every 33 ms tick) compared with probe-84d32a31f9be12ac96dae107705686ccb2c4ebfe.json`
   - Output:
     - `movements measured: 223 (baseline 223)`
     - `added: none`
     - `removed: none`
     - `changed, expected: 4 Overhead Press; 31 Arnold Press; 41 Cable Shoulder Press; 129 Alternating Kettlebell Press; 189 Dumbbell One-Arm Shoulder Press; 228 Kettlebell Arnold Press; 230 Kettlebell Seesaw Press`
     - `changed, NOT expected: none`
     - `movements with overflow above 1e-6 dp: none`
     - `exit code: 0 (probe run exit 0)`

## 5. What I Could Not Verify

- Native on-device frame-rate and peak RSS memory on a physical 4 GB Android handset (`NOT VERIFIED — host Node/Jest environment only; verified host storage and clone budgets via verify_preview_storage.mjs`).
