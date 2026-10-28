# MOV-A08 Report — Bent-Over Rows

- **Batch ID:** `MOV-A08`
- **Branch:** `movement/37-rows-2026-10-17`
- **Base Commit:** `d046755528abb3e6aaec30cd5789bea5ac59f262`
- **Source Commit 1 (6 Rows Authored):** `17a3da77eb9c088edfa15836561b6af9c7499b34`
- **Source Commit 2 (Allow-Lists Extended):** `39f877e6f1ba4dacfd26403cd03a58f82ec2c266`
- **Source Commit 3 (130 Non-Rowing Floor Invariant Across Every Tick):** `4bf7490f85b5cee750abb40d30e234d470643844`
- **Movement IDs:** `5, 104, 107, 293, 79, 130`
- **Status:** `EVIDENCE CAPTURED`

---

## 1. Summary of Changes

1. **`apps/mobile/test/components/MovementPreview.movA08Rows.test.js`:**
   - Written and run first before authoring any movement changes (first run failed `12 failed, 12 total`).
   - Binds at every `33 ms` tick for all six movements (`5, 104, 107, 293, 79, 130`):
     - Constant torso angle and spine angle (`<= 0.1 deg` drift across the entire cycle).
     - Load hanging plumb beneath the shoulders at the bottom (`|hold[0] - shoulder[0]| <= 0.50`) in straight arms (`elbowDeg3D >= 172 deg`).
     - Elbows travelling behind the trunk (`behindTrunkDist >= 3.0` units, `>= 4.0` units for `79 T-Bar Row`) at the top of each pull.
     - Movement-specific setup, grip width, close-up panel (`107`), top hold (`107`), scapular reach and back-pocket pull (`104`), landmine arc and floating plates (`79`), and resting non-rowing kettlebell on the floor across every `33 ms` tick (`130`).
2. **`apps/mobile/test/components/MovementPreview.rigidBar.test.js`:**
   - Extended to include `t-bar-row` alongside `bar`, `ez`, and `cableBar` so all two-hand bar rows (`5 Barbell Row`, `107 Reverse Grip Bent-Over Rows`, and `79 T-Bar Row`) are verified for rigid 3D wrist-to-wrist grip width across every `33 ms` tick (`50 passed, 50 total`).
3. **`apps/mobile/src/components/movementPreview/canonicalFigure.ts`:**
   - Added `kettlebellBelow?: boolean` on `ChainMovement` and `nearReach?: number` on `ChainPose`.
   - Updated `layoutChainExtras` to support `kettlebellBelow` (kettlebells hanging directly beneath the handle in rows) and `longBar` straddled along `Z = 0` in oblique view (`79 T-Bar Row`).
   - Added `EQUIPMENT_BY_SLUG` and `CHAIN_MOVEMENTS` entries for `barbell-row` (`5`), `one-arm-kettlebell-row` (`104`), `reverse-grip-bent-over-rows` (`107`), `two-arm-kettlebell-row` (`293`), `t-bar-row` (`79`), and `alternating-kettlebell-row` (`130`).
4. **`tools/rendering/chain_motion_specs.mjs` & `tools/rendering/wo09_split_preview_manifest.mjs`:**
   - Added the 6 row specifications to `CHAIN_MOTION_SPECS` and mapped `5, 104, 107, 293, 79, 130` to `'horizontal-pull@bent-over'` in `LEGACY_FAMILY_KEYS`.
   - Regenerated `apps/mobile/src/components/movementPreview/movementPreviewManifest.json`, `apps/mobile/src/components/movementPreview/previewIndex.json`, and `apps/mobile/src/components/movementPreview/families/horizontal-pull__bent-over.json`.
5. **Allow-List Test Updates (`apps/mobile/test/components/MovementPreview.approval.test.js`, `MovementPreview.batch3Perspective.test.js`, `MovementPreview.fingerCurls.test.js`, `MovementPreview.layout.test.js`):**
   - Extended `CANONICAL_AUTHORED` (`+6` IDs: `5, 104, 107, 293, 79, 130`), `AUTHORED_IN_MANIFEST` (`+1` ID: `5`), close-up allow-list (`reverse-grip-bent-over-rows`), and `CANONICAL.length` (`217 -> 223`), each with a comment naming `MOV-A08`.

---

## 2. First Failing Test Run (`MovementPreview.movA08Rows.test.js`)

Before authoring the movements in `canonicalFigure.ts` and `chain_motion_specs.mjs`, running `npx jest --runInBand test/components/MovementPreview.movA08Rows.test.js` produced:

```text
FAIL test/components/MovementPreview.movA08Rows.test.js
  MOV-A08 bent-over rows invariants across every 33 ms tick
    × movement 5 holds a constant torso angle (within 0.1 deg) across every 33 ms tick (2 ms)
    × movement 104 holds a constant torso angle (within 0.1 deg) across every 33 ms tick
    × movement 107 holds a constant torso angle (within 0.1 deg) across every 33 ms tick (1 ms)
    × movement 293 holds a constant torso angle (within 0.1 deg) across every 33 ms tick
    × movement 79 holds a constant torso angle (within 0.1 deg) across every 33 ms tick (1 ms)
    × movement 130 holds a constant torso angle (within 0.1 deg) across every 33 ms tick
    × 5 Barbell Row: hinged over soft knees, bar hangs plumb under shoulders in straight arms (>= 172 deg), elbows drive behind trunk at top
    × 104 One-Arm Kettlebell Row: staggered stance, square torso/hips, scapular reach at bottom with straight plumb arm (>= 172 deg), elbow past ribs toward back pocket at top (1 ms)
    × 107 Reverse Grip Bent-Over Rows: underhand grip just outside thighs with close-up panel, top hold, straight plumb arms at bottom, differs visibly from Barbell Row
    × 293 Two-Arm Kettlebell Row: standing over two bells, hips back, straight plumb arms at bottom (>= 172 deg), both pulled together toward stomach with elbows behind trunk
    × 79 T-Bar Row: straddling anchored landmine bar, 45 deg hinge, neutral grip, plates off floor at bottom in straight plumb arms (>= 172 deg), pulled to chest with elbows behind trunk (1 ms)
    × 130 Alternating Kettlebell Row: standing over two bells on floor, one rows to lower ribs with elbow behind trunk while the other stays on the floor in a straight plumb arm (>= 172 deg) (1 ms)

Test Suites: 1 failed, 1 total
Tests:       12 failed, 12 total
```

---

## 3. Movement-by-Movement Measurements (`chainGeometry` & Painted Primitives)

| ID | Movement | View / Yaw | Trunk / Spine Angle (Drift) | Knee Angle (3D) | Bottom Arm Angle (3D) | Bottom Plumb `\|holdX - shX\|` | Top Elbow Behind Trunk | 3D Grip Span |
|---:|---|---|---|---:|---:|---:|---:|---:|
| `5` | `Barbell Row` | `oblique` (`28°`) | `24.00°` / `24.00°` (`0.0000°`) | `148.17°` | `174.33°` | `0.0000` | `+3.93` | `22.40` (rigid) |
| `104` | `One-Arm Kettlebell Row` | `oblique` (`28°`) | `24.00°` / `24.00°` (`0.0000°`) | `120.27°` / `137.43°` | `174.33°` | `0.0000` | `+3.65` | unilateral (`9.38` Z) |
| `107` | `Reverse Grip Bent-Over Rows` | `oblique` (`28°`) | `24.00°` / `24.00°` (`0.0000°`) | `148.17°` | `174.33°` | `0.0000` | `+4.47` | `18.80` (rigid) |
| `293` | `Two-Arm Kettlebell Row` | `oblique` (`28°`) | `22.00°` / `22.00°` (`0.0000°`) | `140.42°` | `174.33°` | `0.0000` | `+4.17` | `17.20` |
| `79` | `T-Bar Row` | `oblique` (`28°`) | `45.00°` / `45.00°` (`0.0000°`) | `140.52°` | `174.33°` | `0.0000` | `+5.81` | `6.40` (rigid) |
| `130` | `Alternating Kettlebell Row` | `oblique` (`28°`) | `3.00°` / `3.00°` (`0.0000°`) | `121.46°` | `174.13°` | `0.0000` | `+4.51` | `16.80` (floor) |

### Detailed Verification per Movement

- **`5` — `Barbell Row` (`barbell-row`):**
  - **Source text:** `"Stand holding the bar just outside the legs, then soften the knees and hinge until the torso is stable. Let the bar hang beneath the shoulders with the trunk braced and the neck long. Drive the elbows back to row toward the lower ribs, then lower to long arms without changing the torso angle. If the torso rises on each pull, reduce the load before the hips turn the row into a heave."` / `"Brace the hinge before the pull. Drive the elbows behind you. Hold one torso angle for the set."`
  - **Measurements:** Hinged at `trunk = 24.00°` (`hip = [0.00, 44.20, 0.00]`, `neck = [21.93, 53.96, 0.00]`, `head = 32°`) over softened knees (`148.17°`, `ankle = [8.00, 2.16, ±6.80]`). Hands grip the bar just outside the legs at `hold Z = ±11.20` (`3D` wrist-to-wrist span `22.40` across all `103` ticks). At `ph = 0`, the bar hangs plumb beneath the shoulders (`hold = [21.93, 29.56, ±11.20]`, `|holdX - shoulderX| = 0.0000`) in straight arms (`174.33° >= 172°`). At `ph = 1`, the elbows drive behind the trunk (`nearElbow = [10.48, 53.16, 14.34]`, `behindTrunk = +3.93`) as the bar rows to the lower ribs (`[12.06, 41.69, ±11.20]`, `elbowDeg3D = 80.58°`).

- **`104` — `One-Arm Kettlebell Row` (`one-arm-kettlebell-row`):**
  - **Source text:** `"Take a staggered stance, hinge until the torso is long and stable, and let the kettlebell hang beneath one shoulder. Row the bell toward the back pocket by driving the elbow past the ribs while the hips stay square to the floor. Lower until the shoulder blade reaches naturally; if the torso opens to finish the pull, the bell is heavier than the row you intended."` / `"Set a long, square torso. Drive the elbow toward the back pocket. Reach the shoulder blade at the bottom."`
  - **Measurements:** Staggered stance (`nearAnkle = [-5.00, 2.16, 6.80]`, `farAnkle = [18.00, 2.16, -6.80]`, `dx = 23.00 >= 18`) with the non-working far hand braced on the lead thigh (`[15.80, 28.20, -6.80]`). Square hips and torso (`trunk = 24.00°`, `twist = 0`, `roll = 0` across all `108` ticks). At `ph = 0`, `nearReach = 1.80` lowers the working near shoulder from `Y = 49.96` to `Y = 48.16` while the kettlebell hangs plumb (`hold = [23.43, 23.69, 9.38]`, `|dx| = 0.0000`, `elbowDeg3D = 174.33° >= 172°`). At `ph = 1`, the bell rows back toward the back pocket (`hold = [9.05, 36.77, 9.38]`, `holdX - hipX = 7.55` vs `12.06` in `5 Barbell Row`) with the elbow driven past the ribs (`nearElbow = [11.12, 48.48, 10.99]`, `behindTrunk = +3.65`).

- **`107` — `Reverse Grip Bent-Over Rows` (`reverse-grip-bent-over-rows`):**
  - **Source text:** `"Take an underhand grip just outside the thighs, soften the knees, and hinge until the bar hangs below them with the torso braced. Pull the elbows back and row the bar toward the lower ribs, holding the top long enough to feel the shoulder blades finish. Lower to long arms without changing the hinge; if the torso rises on every pull, the bar is borrowing range from the hips."` / `"Brace the hinge before the pull. Drive the elbows behind you. Touch the lower ribs and own the way down."`
  - **Measurements:** Underhand grip just outside the thighs at `hold Z = ±9.40` (`3D` wrist-to-wrist span `18.80` across all `126` ticks, `3.60` units narrower than `5 Barbell Row`) with a close-up inset panel (`at: [38, 72]`, `r: 14`, `open: 0`) showing the closed palms-up grip wrapped around the bar. Softened knees (`148.17°`) and fixed hinge (`trunk = 24.00°`, `0.0000°` drift). At `ph = 0`, the bar hangs plumb beneath the shoulders (`hold = [21.93, 29.49, ±9.40]`, `elbowDeg3D = 174.33° >= 172°`). At `ph = 1`, the bar rows to the lower ribs (`[12.06, 41.69, ±9.40]`, `elbowDeg3D = 79.94°`) with elbows tucked closer (`Z = ±10.81` vs `±14.34` in `5`) and driven `+4.47` units behind the trunk, holding the top for `800 ms` (`segmentDurationsMs = [1100, 800, 1700, 500]`).

- **`293` — `Two-Arm Kettlebell Row` (`two-arm-kettlebell-row`):**
  - **Source text:** `"Stand over two kettlebells, bend the knees slightly, push the hips back and take a handle in each hand with the back straight. Pull both kettlebells toward the stomach, drawing the shoulder blades together. Lower them under control until the arms are straight."` / `"Hips back, back straight. Pull the elbows toward the hips. Lower under control."`
  - **Measurements:** Stands over two kettlebells (`ankle X = 15.50`, `toe X = 20.90`, bottom `hold X = 20.25`) with knees slightly bent (`140.42°`), hips pushed back `17.50` units behind the ankles (`hip = [-2.00, 40.20, 0.00]`), and straight back (`trunk = 22.00°`, `0.0000°` drift across all `115` ticks). At `ph = 0`, both bells hang plumb beneath the shoulders (`hold = [20.25, 24.73, ±8.60]`, `elbowDeg3D = 174.33° >= 172°`). At `ph = 1`, both bells pull together toward the stomach (`hold = [8.43, 37.08, ±8.60]`, `elbowDeg3D = 87.49°`, `behindTrunk = +4.17`), then lower under control (`1800 ms` lowering vs `1100 ms` pull).

- **`79` — `T-Bar Row` (`t-bar-row`):**
  - **Source text:** `"Straddle the bar, hinge to about 45 degrees, and take the handle with a neutral grip. Pull the plates to your chest, driving the elbows up and back, and let the bar stretch your lats at the bottom of every rep. Hold your hinge angle — every degree you stand up as the set gets hard is range you stole from your back."` / `"Lock your hinge angle and defend it all set. Pull with the elbows to the chest. Full stretch at the bottom, plates floating."`
  - **Measurements:** Feet straddle the anchored landmine bar (`Z = 0`) at `ankle = [8.00, 2.16, ±12.00]` (`footSpread = 5.2`). Torso hinges at `45.00°` (`0.0000°` drift across all `109` ticks). Hands take a neutral grip on the handle at `hold Z = ±3.20` (`3D` wrist-to-wrist span `6.40` across every tick). Bar pivots from floor landmine anchor `[-32.00, 2.60, 0.00]` at constant radius `57.52` units (`r0 = 57.516`, `r1 = 57.516`). At `ph = 0`, arms are straight (`174.33° >= 172°`) plumb beneath the shoulders (`[14.97, 35.79, ±3.20]`) with the painted plates floating off the floor (lowest plate bottom `63.16 < FLOOR 96.90 - 15`). At `ph = 1`, plates pull to the chest (`[6.11, 45.68, ±3.20]`, `elbowDeg3D = 91.29°`) with elbows driven up and back (`behindTrunk = +5.81 >= 4.0`).

- **`130` — `Alternating Kettlebell Row` (`alternating-kettlebell-row`):**
  - **Source text:** `"Stand over two kettlebells, bend the knees slightly, push the hips back and take a handle in each hand with the back flat. Pull one kettlebell toward the lower ribs, drawing that shoulder blade back, while the other hand holds its kettlebell on the floor. Lower it under control to the floor, then row the other side."` / `"Hips back, back flat. Pull the elbow toward the hip. Keep the chest square to the floor."`
  - **Measurements:** Stands over two kettlebells on the floor (`ankle X = 14.00`, `toe X = 19.40`, floor `hold X = 15.47`) with knees bent (`121.46°`), hips pushed back `22.50` units (`hip = [-8.50, 33.79, 0.00]`), and flat back (`trunk = 3.00°`, `twist = 0`, `roll = 0`, `0.0000°` drift across all `138` ticks). `phases = [1, 0, 1, 2, 1]` places the dual-floor rest pose at `poses[1]` (`ph = 1`, painted kettlebell bottoms `96.90 == FLOOR`, `elbowDeg3D = 174.13° >= 172°`). During the first half (`t = 0..2250 ms`, peak at `ph = 0`), the near kettlebell rows to the lower ribs (`[1.33, 27.80, 8.40]`, `nearBehindTrunk = +4.51`, `nearElbowDeg3D = 81.03°`) while the far kettlebell remains on the floor (`bottom = 96.90`, `farElbowDeg3D = 174.13°`) on every tick. During the second half (`t = 2250..4500 ms`, peak at `ph = 2`), the far kettlebell rows to the lower ribs (`[1.33, 27.80, -8.40]`, `farBehindTrunk = +4.51`, `farElbowDeg3D = 81.03°`) while the near kettlebell remains on the floor (`bottom = 96.90`, `nearElbowDeg3D = 174.13°`) on every tick.

---

## 4. Gate Summary (`batch_gates.sh` on `4bf7490f85b5cee750abb40d30e234d470643844`)

- **`typecheck.log`:** `exit code: 0`
- **`jest-movement-preview.log`:** `Test Suites: 63 passed, 63 total` / `Tests: 3573 passed, 3573 total` / `exit code: 0`
- **`storage-guard.log`:** `records: 231`, `families: 75`, `rawBytes: 665283` (budget `1048576`), `gzipBytes: 110008` (budget `196608`), `pass: true`, `exit code: 0`
- **`evidence-gate.log`:** `PASS — clean evidence passes and all 19 injected defects are rejected by their own check.` / `exit code: 0`
- **`rendered-output-probe.log`:**
  - `movements measured: 225 (baseline 219)`
  - `added: 5 Barbell Row; 104 One-Arm Kettlebell Row; 107 Reverse Grip Bent-Over Rows; 293 Two-Arm Kettlebell Row; 79 T-Bar Row; 130 Alternating Kettlebell Row`
  - `removed: none`
  - `changed, expected: none`
  - `changed, NOT expected: none`
  - `movements with overflow above 1e-6 dp: none`
  - `exit code: 0 (probe run exit 0)`
