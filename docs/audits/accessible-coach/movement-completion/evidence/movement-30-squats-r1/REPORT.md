# MOV-A01-R1 Report — Front-Rack Squats Repair & Splitter Deduplication

- **Batch ID:** `MOV-A01-R1`
- **Branch:** `movement/30-squats-2026-10-17`
- **Base Commit:** `614f7326fab8a2c08d9c4f4c00a2e3399580ac48`
- **Previous Source Commit (`MOV-A01`):** `9bbe6f1e08a77ebf89da65548f18f0e3284d9c70`
- **New Source Commit (`MOV-A01-R1`):** `2a80c201ab2b042ac037ab1dd0ce46f2881e3447`
- **Movement IDs:** `1, 123, 277, 299, 8, 208, 38, 256, 275` (`8` and `208` redrawn; `1, 123, 277, 299, 38, 256, 275` byte-identical)
- **Status:** `EVIDENCE CAPTURED`

---

## 1. Repair 1 — `Front Squat` (`8`) and `Front Squat (Clean Grip)` (`208`)

### 1.1 View Chosen for `front-rack-squat` (`8` and `208`): `view: 'oblique', yawDeg: 10`
- Both `8` (`front-squat`) and `208` (`front-squat-clean-grip`) are drawn in `view: 'oblique'` with `yawDeg: 10` (`<= 10` degrees, satisfying `MOV-A01-R1`'s *"view: 'side', or a small turn of at most 10 degrees"*) and `originX: 54`.
- **Why `yawDeg: 10` was chosen over `0°` (`view: 'side'`):** In `layoutChainExtras` (`apps/mobile/src/components/movementPreview/canonicalFigure.ts:4263`), whenever the projected distance between `figure.hold.near` and `figure.hold.far` is `< 3` box units (which occurs at `0°–6°` yaw), `layoutEndOnBarbell(figure.hold.near)` draws an end-on weight plate circle of radius `6.6` (`diameter 13.2`) in bright `textHi` directly on top of the shoulder/neck/upper-arm shelf. At `yawDeg: 10`, the projected grip span is `3.87` (`208`) and `4.42` (`8`) box units (`>= 3`), so the compact barbell sleeve is drawn with the near plate behind the neck (`-X`) and the far plate (`textLow`) behind the arm, while `cos(10°) = 98.48%` of the sagittal profile is preserved so the forward-pointing horizontal upper arms read unobstructed across the entire squat.

### 1.2 Grip-Width Relationship (`8` Wider Than `208`)
- Fixed the grip-width relationship and comments in `canonicalFigure.ts` and `chain_motion_specs.mjs` to match the owner's catalogue text and legacy reference:
  - **`8` (`Front Squat`, *"Grip the bar slightly wider than shoulder-width"*):** `upperArm: [3, -8], forearm: [-177, 25]` (Pose 0) / `upperArm: [24, -8], forearm: [-156, 25]` (Pose 1). World hand spacing `stdGripSpanZ = 25.43` (`w.near.grip[2] = +12.72`), which is `6.66` units wider than shoulder width (`shoulderSpanZ = 18.77`) and `3.16` units wider than `208`.
  - **`208` (`Front Squat (Clean Grip)`, *"with your hands just outside the shoulders"*):** `upperArm: [8, -4], forearm: [-150, 14], hand: [100, -4]` (Pose 0) / `upperArm: [26, -4], forearm: [-132, 14], hand: [100, -4]` (Pose 1). World hand spacing `cleanGripSpanZ = 22.27` (`w.near.grip[2] = +11.14`), placing the hands just outside the shoulders (`+3.50` units wider than `shoulderSpanZ = 18.77`) and narrower than `8` (`22.27 < 25.43`).

### 1.3 Grip Difference Shown at Card Size (`closeUp` on `208`)
- **What we chose for the `208` grip:** We used the existing `handCloseUp` (`closeUp`, the Finger Curls kit) on `208` (`closeUp: { at: [-33, 73], r: 15, scale: 5, zoom: 1, open: 1 }`), while `8` uses a direct closed grip (`hand: undefined`, `closeUp: undefined`).
- **Kit extension on `closeUp` (`canonicalFigure.ts:1335, 4397–4398, 4408`):**
  - Added optional `zoom?: number; open?: number` to `ChainMovement['closeUp']`. When omitted (as on `finger-curls`), `handCloseUp` computes `zoom` and `open` from `figure.ph` exactly as before (`finger-curls` is byte-identical in `rendered-output-probe.log`).
  - When `zoom: 1, open: 1` are specified on `front-squat-clean-grip`, `handCloseUp` keeps the magnified round panel (`centre = [21.0, 23.9], r = 15`, in the upper-left clear of the athlete and rack) open across all phases with the fingers extended (`open = 1`) and `palmSide` oriented upward (`along[0] < 0 ? [-along[1], along[0]] : [along[1], -along[0]]`), showing the open hand with the barbell resting in the fingertips (`panel.finger[2][1] > panel.bar[1] + 3.0` and `panel.finger[3][1] > panel.bar[1] + 1.5` in screen coordinates) connected by a leader line to the near hand.

### 1.4 Rack Hooks Visibly Below Shoulder Height on `208`
- On `208` (`Front Squat (Clean Grip)`), the rack J-hooks are set at world `y = 63.0` (`{ kind: 'frame', a: [14, 63.0, ±16], b: [10.2, 63.0, ±16] }`), which is `7.08` world units (`>= 6.5`) below the standing shoulder height (`top.world.near.shoulder[1] = 70.08`) and `5.5` world units lower than `8`'s rack hooks (`y = 68.5`).

### 1.5 Both Upper Arms Near Horizontal and Pointing Forward at Every Tick, With `208` Elbows Higher Than `8`
- Because both movements use `armsFollowTrunk: true` (`carried = trunk - 90`), Pose 1 adds `90 - trunk` (`+21°` on `8`, `+18°` on `208`) to `upperArm[0]` and `forearm[0]` so the upper arms do not droop as the torso leans forward into the squat:
  - On `8` (`Front Squat`): world `upperArm` sagittal pitch is constantly `+2.0°` (`|upperArmPitchDeg| <= 10.0°`, `elbow[0] - shoulder[0] = 12.37 > 12.0`) across every `33 ms` tick of the `3500 ms` cycle.
  - On `208` (`Front Squat (Clean Grip)`): world `upperArm` sagittal pitch is constantly `+8.0°` (`|cleanPitchDeg| <= 10.0°`, `elbow[0] - shoulder[0] = 12.35 > 12.0`) across every `33 ms` tick, keeping `208`'s elbow elevation (`elbow[1] - shoulder[1] = +1.74`) strictly higher than `8`'s (`+0.43`) by `+1.30` units (`>= 1.0`) at every tick.

---

## 2. Repair 2 — Family Splitter Moved to `tools/rendering/wo09_split_preview_manifest.mjs`

1. **Changes made:**
   - Removed the 115-line inline family-splitter copy from `tools/rendering/author_chain_motion.mjs` (`git diff 614f7326fab8a2c08d9c4f4c00a2e3399580ac48..2a80c201ab2b042ac037ab1dd0ce46f2881e3447 -- tools/rendering/author_chain_motion.mjs` is now empty — `tools/rendering/author_chain_motion.mjs` is byte-identical to `614f7326`).
   - Added the 9 squat IDs (`1, 123, 277, 299, 8, 208, 38, 256, 275 -> 'squat@standing'`) to `LEGACY_FAMILY_KEYS` in `tools/rendering/wo09_split_preview_manifest.mjs` (lines `65–73`).

2. **Before/After SHA-256 Hash Proof:**
   - **On the `MOV-A01` (`9bbe6f1e08a77ebf89da65548f18f0e3284d9c70`) manifest (`SHA256 = cd6b5b43c885f409869bf1d08bb0a214a9b610c5ef6c97009e1de55221847751`):**
     | File | SHA-256 via inline copy in `9bbe6f1e` | SHA-256 via `wo09_split_preview_manifest.mjs` | Match |
     | :--- | :--- | :--- | :--- |
     | `apps/mobile/src/components/movementPreview/previewIndex.json` | `a714bc8316101b033203533f3d19b6a19168e8cb777941a0c75013327821e910` | `a714bc8316101b033203533f3d19b6a19168e8cb777941a0c75013327821e910` | Exact (`0` diffs across all 77 files) |
     | `apps/mobile/src/components/movementPreview/familyLoaders.ts` | `3703fc028b879aae159ed2d1b7d53f8b55a5e217f4c78a6e2b4f7e9424559ab5` | `3703fc028b879aae159ed2d1b7d53f8b55a5e217f4c78a6e2b4f7e9424559ab5` | Exact (`0` diffs across all 77 files) |
     | `apps/mobile/src/components/movementPreview/families/squat__standing.json` | `7c9928ed766e30013e7aa3573def89b8f45409067d0b9cf5e1ba658f273b40d5` | `7c9928ed766e30013e7aa3573def89b8f45409067d0b9cf5e1ba658f273b40d5` | Exact (`0` diffs across all 77 files) |
   - **On the `MOV-A01-R1` (`2a80c201ab2b042ac037ab1dd0ce46f2881e3447`) manifest (`SHA256 = 6164d28da02b6b9accb3fb0252a3f79569d19eaecb691523c912ed78f86cff74`, after redrawing `8` and `208`):**
     | File | SHA-256 via `wo09_split_preview_manifest.mjs` |
     | :--- | :--- |
     | `apps/mobile/src/components/movementPreview/previewIndex.json` | `a714bc8316101b033203533f3d19b6a19168e8cb777941a0c75013327821e910` (unchanged from `9bbe6f1e`) |
     | `apps/mobile/src/components/movementPreview/familyLoaders.ts` | `3703fc028b879aae159ed2d1b7d53f8b55a5e217f4c78a6e2b4f7e9424559ab5` (unchanged from `9bbe6f1e`) |
     | `apps/mobile/src/components/movementPreview/families/squat__standing.json` | `194a9afb51d83cac38fcb1b205f34c1486c19ebf3e90113a79715481b35148d4` (updated `8` and `208` frames/reasons) |

---

## 3. Byte-for-Byte Identity of Accepted Movements (`1, 123, 277, 299, 38, 256, 275`)

Comparing `rendered-output-probe.log` from `MOV-A01` (`9bbe6f1e08a77ebf89da65548f18f0e3284d9c70`) and `MOV-A01-R1` (`2a80c201ab2b042ac037ab1dd0ce46f2881e3447`), all seven accepted squats are byte-for-byte identical in both `drawnSha256` and `captionSha256`:

- `1 Competition Squat`: `drawn 36239389856a68c3adc4a39689c2f7ca988726094b9ecd7e3aad3156fb108007 captions 3ca5f52e75df0c8356d3bc27db4e47b2a2b63d0bb67481bebc097db8ffaa4be3`
- `123 Narrow Stance Squats`: `drawn 0f917b23be9b162f709a599746846bc15c745187af42288f2e6b2618191393b7 captions 6d668b05a56ab53f53f3bd17468ef040529034f562efa169fba9eedbae72325b`
- `277 Squat with Bands`: `drawn ddf81b58e63f0d77b7b82ea29413047d5854efc1aec8d6e1df511fcb05096d82 captions fa04bff847d1d7f5fb4bca8bb31b0e47e236a5ab083f5f3ec10e62b85e620292`
- `299 Wide Stance Barbell Squat`: `drawn 390d9ca996247a61fada784bc874c8bd156ffd2886bc66f149375a91ce811de7 captions bc9f283bcbc90706218b0353c51dbac879ec4d6c83af3618873e3e2f022d7505`
- `38 Box Squat`: `drawn a20f6231456d97fcf47993dc9c13c2789e6fc83df1f20ad60c4a08c30503ae04 captions 16c0df06db5ddf310e80a9dea5ece496f28a92efff6b1391712a9cbbe6490482`
- `256 Reverse Band Box Squat`: `drawn 1953e222334ac3e9790f5bc3d3ec9394a9ce111f6fb99ec1b56394eb7f6ec16c captions df39a5573604ed37aeeb529eb9819daeaf7ff25c147b98368948a12a9b27233a`
- `275 Speed Box Squat`: `drawn 17b5d517cc1897e163f3599a853b44930c4403103eb1f9433e810150cdb24c50 captions 78da34aaf7427180fb57855b73040707e89a1199e641f41844773f582f91074b`

And the two repaired movements now have:
- `8 Front Squat`: `drawn 9c485ccf51d1ad4467018b446f00dd7d4e4551742868c01ff550699a4c91f02b captions 40f3e61950f7254d23119a7ca097830adcd5ef2290afe21867b3b0de2191d8df stage 103.23x240.00 cycle 3500 ms`
- `208 Front Squat (Clean Grip)`: `drawn b5f50d98cb11499533f0c42d1d4ce541b5a7d89e15b947f2a9258c4a8b656806 captions a4e23cc18ed2a82dc5b65132727cdc95e497d373defb5680c3ce1c98fa45d2bb stage 180.00x240.00 cycle 3500 ms`

---

## 4. Gate Commands Run & Decisive Output

All five gate commands were executed via `batch_gates.sh` against source commit `2a80c201ab2b042ac037ab1dd0ce46f2881e3447` and recorded in `docs/audits/accessible-coach/movement-completion/evidence/movement-30-squats-r1/`:

1. **`typecheck.log` (`npm run typecheck`):**
   - `> tsc -p apps/mobile/tsconfig.json`
   - `exit code: 0`
2. **`jest-movement-preview.log` (`npx jest --config apps/mobile/jest.config.js --runInBand --no-cache --testPathPattern MovementPreview`):**
   - `PASS apps/mobile/test/components/MovementPreview.movA01Squats.test.js (7.58 s)`
   - `PASS apps/mobile/test/components/MovementPreview.fingerCurls.test.js`
   - `Test Suites: 57 passed, 57 total`
   - `Tests:       2699 passed, 2699 total`
   - `exit code: 0`
3. **`storage-guard.log` (`node --expose-gc tools/rendering/verify_preview_storage.mjs`):**
   - `"records": 191, "families": 75, "rawBytes": 557267, "gzipBytes": 93224`
   - `"pass": true`
   - `exit code: 0`
4. **`evidence-gate.log` (`node tools/rendering/test_verify_movement_evidence.mjs`):**
   - `PASS — clean evidence passes and all 19 injected defects are rejected by their own check.`
   - `exit code: 0`
5. **`rendered-output-probe.log` (`rendered-output probe (real MovementPreview, neutral figure, every 33 ms tick) compared with baseline-614f7326.json`):**
   - `movements measured: 185 (baseline 176)`
   - `added: 1 Competition Squat; 123 Narrow Stance Squats; 277 Squat with Bands; 299 Wide Stance Barbell Squat; 8 Front Squat; 208 Front Squat (Clean Grip); 38 Box Squat; 256 Reverse Band Box Squat; 275 Speed Box Squat`
   - `removed: none`
   - `changed, expected: none`
   - `changed, NOT expected: none`
   - `movements with overflow above 1e-6 dp: none`
   - `exit code: 0 (probe run exit 0)`
