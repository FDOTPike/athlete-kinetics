# MOV-A09 Evidence Report — Rows, Upright Row, Middle Back Shrug, and Rear Delt Raises

- **Order**: `MOV-A09` (`movement-38-rows-rear-raises`)
- **Branch**: `movement/38-rows-rear-raises-2026-10-17`
- **Base Commit**: `5a5a6f48f6f93b1019222c4e2fef0d39841e173a`
- **Source Commit**: `84d32a31f9be12ac96dae107705686ccb2c4ebfe` (preceded by `45c9a4af93a1fb325de7b5cab7bbd6673f04ee37` and `41dd757fb8e3434563dd532abdcf681569be8fab`)
- **Movements (`7`)**: `93`, `195`, `296`, `243`, `188`, `241`, `265`

## 1. Source-Bound & Physics-Bound Tests (Written First)

- **Test File**: `apps/mobile/test/components/MovementPreview.movA09RowsRearRaises.test.js`
- **First Failing Run** (recorded prior to authoring movements):
  - `Test Suites: 1 failed, 1 total`
  - `Tests:       8 failed, 8 total`
  - Decisive failure on unauthored movements: `expect(CHAIN_MOVEMENTS[id]).toBeDefined() — Expected: defined, Received: undefined`
- **Guard-Break Verification**:
  - Temporarily broke `243` `Middle Back Shrug` top pose forearm from `[-90, 4]` to `[-45, 4]` in `apps/mobile/src/components/movementPreview/canonicalFigure.ts` so the elbows bent at the top of the shrug.
  - Observed test failure at `apps/mobile/test/components/MovementPreview.movA09RowsRearRaises.test.js:288`:
    `expect(Math.max(...nearElbowAngles) - Math.min(...nearElbowAngles)).toBeLessThan(0.5) — Expected: < 0.5, Received: 0.7981326424526571`.
  - Restored `forearm: [-90, 4]` and re-verified all 243 tests across `MovementPreview.movA09RowsRearRaises.test.js`, `MovementPreview.layout.test.js`, and `MovementPreview.approval.test.js`.

## 2. Chain Kit Field Added

- Added `retract?: number` to `ChainPose` (`apps/mobile/src/components/movementPreview/canonicalFigure.ts:1192`) and interpolated it in `lerpChainPose`:
  - `const girdleCentre = retract === 0 ? girdleBase : chainAdd(girdleBase, forward, -retract);` (`canonicalFigure.ts:5279`)
  - `const effectiveShoulderHalf = Math.max(2, shoulderHalf - retract * 0.35);` (`canonicalFigure.ts:5280`)
  - Shifts the shoulder girdle dorsally along `-forward` and pinches the inter-shoulder span so prone/incline scapular retraction (`243` `Middle Back Shrug`) retracts the shoulder blades and lifts the hanging dumbbells without bending the elbows.

## 3. Views Chosen and Measured Values Bound by Text & Physics

### `93` — `Renegade Row` (`renegade-row`)
- **Source Text** (`ALL_300_MOTION_MAP.json:7620`):
  - `"Set up in a push-up plank with a hand on each dumbbell, feet wider than usual."`
  - `"Row one dumbbell to your ribs while the rest of you stays a statue, then place it down and row the other side. The row is the easy part — the work is refusing to let the hips twist."`
- **View Chosen**: `oblique` (`yawDeg: 28`, `originX: 48`) so both floor dumbbells, the wide-stance plank feet (`z = ±15.8`), and the alternating left/right rows (`phases: [1, 0, 1, 2, 1]`) are separated without occlusion.
- **Measured Values**:
  - Braced plank line `deg3D(ankleMid, hip, neck) = 177.36° >= 172°` across all ticks.
  - Knee straightness `deg3D(hipJoint, knee, ankle) = 176.82° >= 172°` across all ticks.
  - Planted supporting arm straightness `deg3D(shoulder, elbow, wrist) = 175.43° >= 172°` at plank (`t = 0`), during near row (`t = 1050 ms`, far arm supporting), and during far row (`t = 3250 ms`, near arm supporting).
  - Wide foot span `ankleNear.z - ankleFar.z = 31.60 >= 24.77` (`1.35 * 2 * sw * 0.92`).
  - Near row lifts wrist by `+17.90` units (`y = 3.60 -> 21.50`, elbow flexing to `52.8° < 95°` and rising above `neck[1] + 2`); far row lifts wrist by `+15.90` units (`y = 3.60 -> 19.50`, elbow flexing to `52.8° < 95°`).
  - Anti-rotation statue torso: `|roll| = 0.00° <= 0.5°`, `|twist| = 0.00° <= 0.5°` across all ticks.

### `195` — `Elevated Cable Rows` (`elevated-cable-rows`)
- **Source Text** (`ALL_300_MOTION_MAP.json:14510`):
  - `"Place a low platform on the seat of a cable row station, sit on it with the feet on the foot plate and the knees slightly bent, and hold the V-handle with the arms straight and the torso upright."`
  - `"Keeping the torso still and the arms close to the body, pull the handle to the stomach. Squeeze the back, then let the handle return slowly until the arms are straight."`
- **View Chosen**: `oblique` (`yawDeg: 35`, `originX: 24`) to display the elevated platform block `{ kind: 'box', a: [-8, 12.2], b: [4, 17.5] }` on the seat pad, the cable line from the pulley `[58, 14]` to the V-handle, and the downward-and-back pull path to the stomach.
- **Measured Values**:
  - Hip elevation: `hip[1] = 20.332`, which is `+5.50` units higher than `266` `seated-cable-rows` (`14.832`).
  - Knee bend: `deg3D(hipJoint, knee, ankle) = 145.69°` (within `[130°, 168°]`) with feet braced on the foot plate `[41, 13]`.
  - Extended reach arm straightness (`pose 0`): `deg3D(shoulder, elbow, wrist) = 174.52° >= 172°`.
  - Pull to stomach (`pose 1`): wrist travels `-14.05` in X (`21.55 -> 7.50`) and `-4.00` in Y (`35.00 -> 31.00`), elbows stay close to the body (`elbowNear.z = 11.49 <= shoulderHalf + 3.5`) and drive behind the torso (`elbowNear.x = -4.27 < hip.x`), torso remains upright and still (`trunk = 90°`), slow return `1400 ms > 1200 ms` pull.

### `296` — `Upright Cable Row` (`upright-cable-row`)
- **Source Text** (`ALL_300_MOTION_MAP.json:21301`):
  - `"Stand tall facing a low pulley holding the straight bar against the thighs with an overhand grip slightly narrower than the shoulders."`
  - `"Keeping the bar close to the body, lift it toward the chin by raising the elbows up and out to the sides, elbows higher than the hands. Pause, then lower the bar slowly to the thighs."`
- **View Chosen**: `oblique` (`yawDeg: 45`, `originX: 44`) so the low pulley `[18, 5]`, the narrow overhand grip on the straight bar (`implement: 'cableBar'`), the bar path close to the torso, and the flared high elbows above the hands are simultaneously visible.
- **Measured Values**:
  - Grip half-span: `6.80` (`< shoulderHalf 9.384`, strictly narrower than shoulders).
  - Bottom arm straightness (`pose 0`): `deg3D(shoulder, elbow, wrist) = 175.43° >= 172°` with bar against thighs (`wrist = [5.20, 46.745, ±6.80]`).
  - Top position (`pose 1`): bar pulled to chin height (`hold[1] = 68.725`, `1.80` below `neck[1] = 70.525`) close to the body (`wrist X = 5.80 <= 8.0`), while elbows lead high and out at `y = 75.50` (`+6.77` units above hands in 3D Y; projected screen `elbowNear.y = 21.40 < wristNear.y = 28.18`), with `450 ms` pause and `1400 ms` slow lower.

### `243` — `Middle Back Shrug` (`middle-back-shrug`)
- **Source Text** (`ALL_300_MOTION_MAP.json:17708`):
  - `"Lie chest-down on an incline bench holding a dumbbell in each hand with the arms hanging straight."`
  - `"Pull the shoulder blades back and together without bending the elbows, and pause at the top. Lower under control; when the elbows bend to move the load, reduce the weight."`
- **View Chosen**: `oblique` (`yawDeg: 36`, `originX: 16`) so the `38°` prone incline bench, both hanging dumbbells, and the dorsal scapular retraction + inter-shoulder pinch are visible.
- **Measured Values**:
  - Prone incline bench: `trunk = 38°`, `proneInclineBench([38, 38], 38)`.
  - Straight arms across the entire cycle: `deg3D(shoulder, elbow, wrist) = 180.00° >= 172°` at every 33 ms tick (`max - min = 0.00° < 0.5°`).
  - Scapular retraction (`retract: 0 -> 6.4`): shoulder joints and hanging dumbbells rise dorsally by `+5.04` units in Y (`48.61 -> 53.65` at shoulder, `18.67 -> 23.72` at wrist) and `-3.94` units in X (`56.71 -> 52.77`), while inter-shoulder span narrows by `4.48` units (`18.77 -> 14.29`), with a `550 ms` top pause and `1250 ms` controlled lower.

### `188` — `Dumbbell Lying Rear Lateral Raise` (`dumbbell-lying-rear-lateral-raise`)
- **Source Text** (`ALL_300_MOTION_MAP.json:14039`):
  - `"Lie chest-down on an adjustable bench set to a shallow incline of about fifteen degrees, a dumbbell in each hand. Hold the palms facing the torso with the arms extended and the elbows slightly bent."`
  - `"Raise the arms out to the side until the elbows reach shoulder height and the arms are roughly parallel to the floor. Hold the contraction for a second, then lower under control."`
- **View Chosen**: `oblique` (`yawDeg: 40`, `originX: 16`) to show both the shallow `15°` bench pitch and the bilateral lateral sweep of the dumbbells out to shoulder height.
- **Measured Values**:
  - Bench pitch: `trunk = 15°` (`proneInclineBench([34, 28], 15)`), `15°` steeper than `241` (`0°`) and `30°` shallower than `261` (`45°`).
  - Fixed slight elbow bend: `deg3D(shoulder, elbow, wrist) = 168.00°` (`12°` bend) across all ticks (`variation = 0.00°`).
  - Top raise (`pose 1`): wrist Z span widens from `18.85` to `65.53`; elbows reach shoulder height (`|elbow Y - shoulder Y| = 0.00 <= 2.5`, `|wrist Y - shoulder Y| = 0.72 <= 4.0`); held for `1000 ms` (`"Hold the contraction for a second"`) before `1700 ms` controlled lower.

### `241` — `Lying Rear Delt Raise` (`lying-rear-delt-raise`)
- **Source Text** (`ALL_300_MOTION_MAP.json:17577`):
  - `"Lie chest-down on a flat bench with a dumbbell in each hand. Hold the palms facing the torso with the arms extended and the elbows slightly bent."`
  - `"Raise the arms out to the side until the elbows reach shoulder height and the arms are roughly parallel to the floor. Hold the contraction for a second, then lower under control."`
- **View Chosen**: `oblique` (`yawDeg: 40`, `originX: 16`) matching `188` so the flat `0°` bench (`chainFlatBench(30, 62, 24.5)`) contrasts directly against `188`'s `15°` incline while showing the wide bilateral rear-delt arc.
- **Measured Values**:
  - Bench pitch: `trunk = 0°` (horizontal flat bench, chest supported at `y = 30.416`).
  - Fixed slight elbow bend: `deg3D(shoulder, elbow, wrist) = 168.00°` (`12°` bend) across all ticks (`variation = 0.00°`).
  - Top raise (`pose 1`): wrist Z span widens from `18.85` to `65.53`; elbows reach shoulder height (`|elbow Y - shoulder Y| = 0.00 <= 2.5`, `|wrist Y - shoulder Y| = 0.85 <= 4.0`); held for `1000 ms` before `1700 ms` controlled lower.

### `265` — `Seated Bent-Over Rear Delt Raise` (`seated-bent-over-rear-delt-raise`)
- **Source Text** (`ALL_300_MOTION_MAP.json:19210`):
  - `"Sit on the end of a flat bench with the feet together, bend forward from the hips with the back straight and hold a dumbbell in each hand behind the calves, palms facing each other."`
  - `"Keeping the torso still and a slight bend in the elbows, lift the dumbbells straight out to the sides until the arms are level with the floor. Pause, then lower slowly to the start."`
- **View Chosen**: `oblique` (`yawDeg: 48`, `originX: 38`) so the athlete seated on the front end of the bench (`hip = [0, 24.275]`), the feet together (`ankle Z span = 4.00`), the dumbbells tucked behind the calves at the bottom (`wrist X = 15.05 < ankle X = 21.80`), and the wide lateral arc to shoulder height are clearly visible.
- **Measured Values**:
  - Seated end-of-bench setup: `hip = [0, 24.275]` over `chainFlatBench(-28, 5, 21.62)`, hinged forward torso `trunk = 26°` (stationary across all ticks), feet together `ankle = [21.8, 2.025, ±2.0]` (`zSpan = 4.00 <= 5.5`).
  - Start behind calves (`pose 0`): `wrist X = 15.05 <= ankle X - 3.5 = 18.30`, `wrist Y = 11.49 < knee Y = 23.09`, `palmYaw = 90°` (palms facing each other).
  - Top raise (`pose 1`): wrist Z span expands from `10.67` to `65.53` with arms level with the floor at shoulder height (`|elbow Y - shoulder Y| = 0.00 <= 2.5`, `|wrist Y - shoulder Y| = 0.77 <= 4.0`), fixed `12°` elbow bend (`168.00°`), `450 ms` pause, and `1500 ms` slow lower.
