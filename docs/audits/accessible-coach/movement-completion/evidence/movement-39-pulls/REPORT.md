# MOV-A10 — Vertical Pulls and Hanging (`movement-39-pulls`)

- **Branch:** `movement/39-pulls-2026-10-17`
- **Base commit:** `55ca8711ab56acb6b2c7bc900c430571c276e05d`
- **Source commit:** `225cd4c2b7541914b898ef18c4eef3f803c83dc9`
- **Movements:** `6` Weighted Pull-up, `13` Chin-up, `71` Pull-Up, `108` V-Bar Pulldown, `209` Full Range-Of-Motion Lat Pulldown, `77` Straight-Arm Pulldown, `211` Gorilla Chin/Crunch, `64` Hanging Leg Raise
- **Status:** `EVIDENCE CAPTURED`

## 1. What Was Done

1. **`apps/mobile/test/components/MovementPreview.movA10Pulls.test.js`:**
   - Written before authoring the 8 movements and run first (`20 failed, 20 total`).
   - Enforces every instruction and cue quote word for word from `docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json`, 3D segmental centre-of-mass balance directly under the bar across every `33 ms` tick for all 5 hanging movements (`6`, `13`, `71`, `211`, `64`), monotonic cable lengthening on the working half for all 3 cable pulldowns (`108`, `209`, `77`), painted dip-belt load clearance from the floor and both painted thighs in `6`, visible grip width / wrist orientation / elbow path distinction between `13` and `71`, thigh roller pad lock in `108`, crossed opposite cables and wide arc in `209`, fixed soft elbow angle (`168.00 deg`) and stationary braced hinge (`78 deg`) in `77`, simultaneous pull and lower-spine knee crunch in `211`, and straight-arm/straight-leg lower-spine pelvic curl (`curl = 28 deg`) in `64`.
2. **`apps/mobile/src/components/movementPreview/canonicalFigure.ts`:**
   - Added three small chain-kit extensions:
     - `{ kind: 'bar'; a: ChainPoint; b: ChainPoint; layer?: ChainLayer }` on `ChainShape` to draw the fixed overhead pull-up bar in `textMid` (`w = 2.2`) across the two uprights.
     - `'vBar'` on `ChainMovement['implement']` to render a close neutral V-bar attachment connected at its apex to the overhead cable and held at both grips.
     - `waistLoad?: { drop: number; r?: number }` on `ChainMovement` (exposed on `chainGeometry(...).world.waistLoad` and painted in `layoutChainExtras`) to draw a dip belt across the pelvis, vertical suspension strap/chain, and circular weight plate with inner hub hanging centrally below the hips.
   - Authored `weighted-pull-up` (`6`), `chin-up` (`13`), `pull-up` (`71`), `v-bar-pulldown` (`108`), `full-range-of-motion-lat-pulldown` (`209`), `straight-arm-pulldown` (`77`), `gorilla-chin-crunch` (`211`), and `hanging-leg-raise` (`64`) in `CHAIN_MOVEMENTS` and `EQUIPMENT_BY_SLUG`.
3. **`tools/rendering/chain_motion_specs.mjs` & `tools/rendering/wo09_split_preview_manifest.mjs`:**
   - Added the 8 movement specs and mapped `straight-arm-pulldown` to `straight-arm-pulldown__standing.json`, then regenerated `movementPreviewManifest.json`, `previewIndex.json`, and family files via `node tools/rendering/author_chain_motion.mjs` and `node tools/rendering/wo09_split_preview_manifest.mjs`.
4. **`apps/mobile/test/components/MovementPreview.approval.test.js` & `apps/mobile/test/components/MovementPreview.layout.test.js`:**
   - Updated the pending count (`140 -> 148`, `222 -> 230` non-placeholder) and added `straight-arm-pulldown` (`77`) to `OBLIQUE_FIGURES`.

## 2. Views Chosen and Why

- **`6` Weighted Pull-up (`oblique`, `yawDeg = 42`):** Shows the wide overhand grip on the overhead bar (`z = +-13.5`), the chest rising to the bar, and the dip belt with its vertical strap and circular weight plate hanging centrally between the slightly abducted thighs (`thigh = [-86, 24] -> [-85, 24]`) clear of both painted legs.
- **`13` Chin-up (`oblique`, `yawDeg = 32`):** Shows the shoulder-width underhand grip (`z = +-9.5`, `wrist.x = +3.76` on the athlete side of the bar) and the elbows driving down in front toward the ribs (`elbow.x > 0` at the top) as the upper chest reaches the bar and the chin clears without craning the neck.
- **`71` Pull-Up (`oblique`, `yawDeg = 32`):** Uses the same 32-degree camera angle as `13 Chin-up` so the wider overhand grip (`z = +-14.5`, `wrist.x = -3.76` on the far side of the bar) and the wider, more rearward elbow path (`elbow.x < -3`, `elbow.z = 21.11` vs `15.53` in `13`) contrast directly against `13 Chin-up`.
- **`108` V-Bar Pulldown (`oblique`, `yawDeg = 38`):** Shows the seated lat-pulldown station (bench slab, thigh roller pad locked over the upper thighs, high pulley at `[9, 98, 0]`, vertical cable, and close neutral V-bar implement) together with the small tall-chest lean back (`trunk = 100 deg`) and elbows driving down and back until the V-bar reaches the upper chest.
- **`209` Full Range-Of-Motion Lat Pulldown (`oblique`, `yawDeg = 68`):** Turns 68 degrees toward the front so both high pulleys (`[4, 98, -36]` and `[4, 98, +36]`), the two opposite cables crossing in an `X` overhead (`near wrist z = -2.12`, `far wrist z = +2.12`), the wide sweeping arc (`mid wrist z = +24.30`), and the elbows pulling down and in at the bottom all read without foreshortening.
- **`77` Straight-Arm Pulldown (`oblique`, `yawDeg = 28`):** Shows the sagittal arc of the straight-arm pulldown from shoulder height (`wrist.y = 70.26`, `shoulder.y = 69.89`) down to the thighs (`wrist.y = 45.70`, `hip.y = 46.42`), the stationary small braced hinge (`trunk = 78 deg`), and the fixed soft elbow bend (`168.00 deg`) along with the cable bar width.
- **`211` Gorilla Chin/Crunch (`oblique`, `yawDeg = 32`):** Shows the underhand grip slightly wider than the shoulders (`z = +-11.5`, `wrist.x = +3.76`), the 90-degree bent knees with shins level with the floor at the hang (`knee.y = 33.25`, `ankle.y = 33.25`), and the simultaneous pull-up and lower-spine pelvic crunch (`curl = 26 deg`) finishing with knees at chest height (`knee.y = 87.48`) and nose level with the bar (`head.y = 105.95`, `bar.y = 105`).
- **`64` Hanging Leg Raise (`oblique`, `yawDeg = 30`):** Shows the overhand grip (`wrist.x = -3.76`), the straight arms and straight legs (`180.00 deg` knee angle), the lower-spine pelvic curl (`spine: 'lower'`, `trunkAt: 'neck'`, `curl = 28 deg`), and the straight legs rising above parallel (`ankle.y = 69.35 > hip.y + 10 = 65.60`) while the upper torso shifts slightly behind the bar so the centre of mass stays directly under the bar on every tick.

## 3. Measured Values per Movement

| ID | Movement | View (`yawDeg`) | CoM `x` Range (bar at `x = 0`) | 3D Elbow Angle Range | Key Start -> Top Measurements | Cycle (`ms`) |
| --- | --- | --- | --- | --- | --- | --- |
| `6` | Weighted Pull-up | `oblique` (`42 deg`) | `[0.00, 0.09]` (with `0.25` waist load) | `175.64 deg -> 19.83 deg` | `neck.y: 79.71 -> 102.58`, `head.y - hr: 106.92 > 105`, `waistLoad.y: 39.24 -> 62.70` | `3450` (`[550,550,400,1500,450]`) |
| `13` | Chin-up | `oblique` (`32 deg`) | `[-0.08, 0.29]` | `175.47 deg -> 35.34 deg` | `grip.z = 9.50` (`shoulder.z = 9.38`), `wrist.x = +3.76`, `neck.y: 79.58 -> 102.68` | `3450` (`[550,550,400,1500,450]`) |
| `71` | Pull-Up | `oblique` (`32 deg`) | `[0.01, 0.12]` | `175.65 deg -> 24.41 deg` | `grip.z = 14.50`, `wrist.x = -3.76`, `neck.y: 79.93 -> 102.69`, `elbow.x = -3.88` | `3450` (`[550,550,400,1500,450]`) |
| `108` | V-Bar Pulldown | `oblique` (`38 deg`) | `[2.78, 3.19]` (seated) | `176.24 deg -> 47.67 deg` | `trunk = 100 deg`, `hold.z = +-3.00`, `hold.y: 71.22 -> 45.39` (`neck.y = 48.05`) | `3550` (`[550,550,450,1550,450]`) |
| `209` | Full ROM Lat Pulldown | `oblique` (`68 deg`) | `[3.81, 4.02]` (seated) | `180.00 deg -> 90.00 deg` | `wrist.z: -2.12 (crossed) -> +24.30 (arc) -> +25.85 (bottom)`, cables grow `+32.7` | `3800` (`[600,600,400,1750,450]`) |
| `77` | Straight-Arm Pulldown | `oblique` (`28 deg`) | `[2.71, 3.78]` (standing) | `168.00 deg -> 168.00 deg` | `trunk = 78 deg`, `wrist: [29.35, 70.26] -> [7.91, 45.70]` (`hip.y = 46.42`) | `3500` (`[550,550,400,1550,450]`) |
| `211` | Gorilla Chin/Crunch | `oblique` (`32 deg`) | `[-0.71, -0.01]` | `175.03 deg -> 65.22 deg` | `start knee.y = ankle.y = 33.25`, `top knee.y = 87.48`, `head.y = 105.95`, `curl = 26 deg` | `3700` (`[600,600,400,1650,450]`) |
| `64` | Hanging Leg Raise | `oblique` (`30 deg`) | `[-0.40, 0.14]` | `171.56 deg -> 176.75 deg` | `knee = 180.00 deg`, `curl: 0 -> 28 deg`, `ankle.y: 10.95 -> 69.35` (`hip.y = 55.60`) | `4450` (`[750,750,400,1050,1050,450]`) |

## 4. Gate Summary on Source Commit `225cd4c2b7541914b898ef18c4eef3f803c83dc9`

- `typecheck.log`: `exit code: 0`
- `jest-movement-preview.log`: `Test Suites: 62 passed, 62 total`, `Tests: 3513 passed, 3513 total`, `exit code: 0`
- `storage-guard.log`: `records: 230`, `families: 75`, `rawBytes: 668072`, `gzipBytes: 110964`, `exit code: 0`
- `evidence-gate.log`: `exit code: 0`
- `rendered-output-probe.log`: `movements measured: 224 (baseline 216)`, `added: 6 Weighted Pull-up; 13 Chin-up; 71 Pull-Up; 108 V-Bar Pulldown; 209 Full Range-Of-Motion Lat Pulldown; 77 Straight-Arm Pulldown; 211 Gorilla Chin/Crunch; 64 Hanging Leg Raise`, `removed: none`, `changed, NOT expected: none`, `movements with overflow above 1e-6 dp: none`, `exit code: 0 (probe run exit 0)`
