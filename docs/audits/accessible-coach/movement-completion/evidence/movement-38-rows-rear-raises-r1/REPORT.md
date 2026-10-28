# MOV-A09-R1 Evidence Report — Repairs to Rows, Upright Row, Middle Back Shrug, and Rear Delt Raises

- **Order**: `MOV-A09-R1` (`movement-38-rows-rear-raises-r1`)
- **Branch**: `movement/49-rows-rear-raises-repairs-2026-10-18`
- **Base Commit**: `b9f89f975e9ba8c38c6538348fb43f57305fd7fa`
- **Source Commit**: `c9d0f25faf35617b4189e385a839819751249205` (preceded by `02288c12da900a5314d6825dae5b04fa3d4543fc`)
- **Repaired Movements (`6`)**: `93`, `195`, `296`, `243`, `188`, `241` (`265` unchanged from `MOV-A09`)

## 1. Source-Bound & Physics-Bound Tests (Written First)

- **Test File**: `apps/mobile/test/components/MovementPreview.movA09RowsRearRaises.test.js`
- **First Failing Run** (recorded prior to editing source code):
  - `Test Suites: 1 failed, 1 total`
  - `Tests:       5 failed, 3 passed, 8 total`
  - Decisive failures on unrepaired movements:
    - `93 Renegade Row`: `expect(entry.frames.map((f) => f.joints.ph)).toEqual([1, 0, 1, 2, 1])` — `Expected: [1, 0, 1, 2, 1], Received: [1, 0, 0, 1, 2, 2, 1]`
    - `195 Elevated Cable Rows`: `expect(reach.movement.implement).toBe('vHandle')` — `Expected: "vHandle", Received: "handles"`
    - `296 Upright Cable Row`: `expect(bottom.angles.palmYaw).toBe(180)` — `Expected: 180, Received: undefined`
    - `243 Middle Back Shrug`: `expect(bottom.movement.yawDeg).toBeGreaterThanOrEqual(48)` — `Expected: >= 48, Received: 36`
    - `188 Dumbbell Lying Rear Lateral Raise & 241 Lying Rear Delt Raise`: `expect(low.angles.palmYaw).toBe(90)` — `Expected: 90, Received: undefined`
- **Guard-Break Verification**:
  - Temporarily broke `195` `Elevated Cable Rows` `lines` in `apps/mobile/src/components/movementPreview/canonicalFigure.ts` from `[{ from: NECK_ROW_PULLEY, to: 'vHandleApex' }]` to two separate cables (`nearGrip` and `farGrip`).
  - Observed test failure at `apps/mobile/test/components/MovementPreview.movA09RowsRearRaises.test.js:228`:
    `expect((reach.movement.lines ?? []).length).toBe(1) — Expected: 1, Received: 2` (`Tests: 1 failed, 7 passed, 8 total`).
  - Restored `lines: [{ from: NECK_ROW_PULLEY, to: 'vHandleApex' }]` and re-verified all 8 tests in `MovementPreview.movA09RowsRearRaises.test.js`.

## 2. Repairs by Movement and Measured Values

### `93` — `Renegade Row` (`renegade-row`)
- **Audit Findings Addressed**:
  1. Removed the uninvented top hold keyframes in `tools/rendering/chain_motion_specs.mjs` (`phases: [1, 0, 1, 2, 1]`, `durations: [1100, 1100, 1100, 1100]`, 5 frames) and removed `"Pause briefly"` from captions so captions state only what the catalogue text says.
  2. Set `yawDeg: -38`, `pitchDeg: 28`, `originX: 52` and symmetric rib endpoints `wrist: [12.5, 22.8, CHAIN_SHOULDER_HALF + 4.84]` (`ph = 0`) and `farWrist: [12.5, 22.8, -CHAIN_SHOULDER_HALF - 4.84]` (`ph = 2`).
- **Measured Values**:
  - Ribcage midpoint `ribMid = [10.65, 25.66, 0]` (`60%` along spine from hip `[-2.0, 19.09]` to neck `[19.09, 30.04]`): both near and far row endpoints sit at `x = 12.50` (`|dx| = 1.85 <= 3.5`), `y = 22.80` (`|dy| = 2.86 <= 3.5`), and symmetric `z = ±14.224`.
  - Screen perpendicular distance from the spine line (`trunkHalf = 4.64`): near row hold `6.78 >= trunkHalf + 2.0`, far row hold `6.78 >= trunkHalf + 1.8`, far elbow `10.60 >= trunkHalf + 4.5` — the far-side row rises clearly outside the torso silhouette.

### `195` — `Elevated Cable Rows` (`elevated-cable-rows`)
- **Audit Findings Addressed**:
  1. Added 3D foot-plate rails `{ kind: 'frame', a: [43.21, 9.56, ±CHAIN_HIP_HALF], b: [44.94, 19.41, ±CHAIN_HIP_HALF] }` with top/bottom crossbars and `pitchDeg: 12` so both near and far soles sit in exact painted contact with the foot plate across every tick.
  2. Added `implement: 'vHandle'`, `vHandleApex` cable target (`lines: [{ from: NECK_ROW_PULLEY, to: 'vHandleApex' }]`), and `palmYaw: 90, farPalmYaw: 90` so a single cable runs from the low pulley to the apex of a single rigid V-handle held by both hands with palms facing.
- **Measured Values**:
  - Foot-plate contact (`contactSum = footWidth / 2 + 0.8 = 2.768`): 3D ankle/toe distance to foot-plate rail is `2.768` (`in [2.418, 3.118]`) and 2D screen distance is `2.267 <= 2.818` for both near and far feet at every 33 ms tick.
  - Emitted primitives at every tick have `cableLines.length === 1` (`w = 1.4, color = 'textMid'`) from `NECK_ROW_PULLEY` to `vHandleApex`, and `vBranches.length === 2` (`w = 2.0, color = 'textHi'`) from `vHandleApex` to `hold.near` and `hold.far` (`dist3D(hold.near, hold.far) = 5.60`).

### `296` — `Upright Cable Row` (`upright-cable-row`)
- **Audit Findings Addressed**:
  - Set `palmYaw: 180, farPalmYaw: 180` on both poses and added `closeUp: { at: [-32, 68], r: 12.5, scale: 4.2, zoom: 1 }` with hanging-arm `cableBar` rendering in `layoutChainExtras` so the overhand (pronated) grip on the straight cable bar is clearly visible at `240x240`.
- **Measured Values**:
  - `palmYaw = 180`, `farPalmYaw = 180`, `world.near.palmDir = [-1, 0, 0]`, `handCloseUp(geom).palmFacingViewer = false` across every 33 ms tick.

### `243` — `Middle Back Shrug` (`middle-back-shrug`)
- **Audit Findings Addressed**:
  - Turned the camera to `yawDeg: 58, originX: 28` and added `upperBackCloseUp(figure)` at `[22, 22]` (`r: 13.5`) showing a rear view of the thoracic spine and two shoulder blades pinching medially toward the spine while the arms hang straight (`180.00° >= 172°`) throughout.
- **Measured Values**:
  - 3D inter-shoulder span narrows by `4.48` units (`18.77 -> 14.29`); 2D projected shoulder span narrows by `3.80` units (`15.92 -> 12.12`, `>= 3.5`); `upperBackCloseUp` `bladeSpan` narrows by `7.20` units (`12.80 -> 5.60`, `>= 6.0`).

### `188` — `Dumbbell Lying Rear Lateral Raise` & `241` — `Lying Rear Delt Raise`
- **Audit Findings Addressed**:
  - Set `palmYaw: 90, farPalmYaw: 90` on all poses of `188` and `241` and added `closeUp: { at: [14, 72], r: 12.5, scale: 4.2, zoom: 1 }` showing the hanging hand holding the dumbbell with the palm facing the torso (`palmYaw = 90°`) while preserving `bellAxis` on the main figure (`[cos 15°, sin 15°, 0]` for `188`, `[1, 0, 0]` for `241`).
- **Measured Values**:
  - `palmYaw = 90`, `farPalmYaw = 90`, `world.near.palmDir[2] = -1`, `world.far.palmDir[2] = +1`, and `handCloseUp(geom).palmYaw = 90` at every 33 ms tick for both `188` (`15°` incline) and `241` (`0°` flat bench).
