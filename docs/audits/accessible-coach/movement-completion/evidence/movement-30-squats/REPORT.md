# MOV-A01 Report — Barbell, Front, and Box Squats (9 Movements)

- **Batch ID:** `MOV-A01`
- **Branch:** `movement/30-squats-2026-10-17`
- **Base Commit:** `614f7326fab8a2c08d9c4f4c00a2e3399580ac48`
- **Source Commit:** `9bbe6f1e08a77ebf89da65548f18f0e3284d9c70`
- **Movement IDs:** `1, 123, 277, 299, 8, 208, 38, 256, 275`
- **Status:** `EVIDENCE CAPTURED`

---

## 1. Turned Views & Yaw Chosen Per Family

All nine movements in `MOV-A01` use a turned 3D view (`view: 'oblique'` with `yawDeg` in `CHAIN_MOVEMENTS`, `view: 'side'` in `tools/rendering/chain_motion_specs.mjs` upgraded to `'oblique'` by `tools/rendering/author_chain_motion.mjs`, and `"turned <deg> degrees"` in `reason`), with a single yaw angle shared across each family so sibling movements can be compared side by side:

1. **`back-rack-squat` (`1` Competition Squat, `123` Narrow Stance Squats, `277` Squat with Bands, `299` Wide Stance Barbell Squat) — `yawDeg: 32`:**
   - At `32°`, the lateral Z separation (`-x * sin(32°)`) clearly distinguishes the narrow stance (`footSpread: -0.5`, world ankle span `13.40`), standard competition stance (`footSpread: 5.4`, world ankle span `25.20`), and wide stances (`footSpread: 10.0` / `10.2`, world ankle span `34.40` / `34.80`), as well as outward knee tracking (`kneeOut`), while preserving `84.8%` of sagittal X depth (`cos(32°)`) so forward knee travel over the toes (`123`), hip-crease depth relative to the top of the knee (`1`, `277`, `299`), trunk inclination, and upper-back barbell placement remain readable in one frame.
2. **`front-rack-squat` (`8` Front Squat, `208` Front Squat (Clean Grip)) — `yawDeg: 30`:**
   - At `30°`, the anterior front-rack bar placement on the front deltoids, the forward-pointing elbows (`8`) versus the clean-grip wrist extension (`hand`) with fingertips under the bar outside the shoulders and higher elbows (`208`), the rack J-hook height just below standing shoulder height (`208`), and the upright torso angle (`68°` and `72°` at the bottom) all read without visual overlap between the arms, head ring, and rack uprights.
3. **`box-squat` (`38` Box Squat, `256` Reverse Band Box Squat, `275` Speed Box Squat) — `yawDeg: 30`:**
   - At `30°`, the box behind the athlete (`x: [-24, -12], y: [0.6, 20.2]`), the long backward hip travel (`hip[0] = -16.8`), the near-vertical shins (`84.1°–84.3°` from floor at the bottom pause), the wide stance (`footSpread: 9.2–9.6`), and both the floor-anchored bands (`275`) and overhead power-rack reverse bands (`256`) on the outer bar ends are simultaneously legible.

---

## 2. Chain Kit Additions (`apps/mobile/src/components/movementPreview/canonicalFigure.ts`)

Three optional capabilities were added to the chain kit so all 176 pre-existing drawings remain byte-identical when these fields are omitted:

1. **Lateral Foot Spread (`footSpread?: number` on `ChainPose` and `ChainMovement`, lines `1223–1226`, `1284–1287`, `3944–3946`, `4048–4053`):**
   ```ts
     /** Lateral offset of each planted ankle from hip width, in world Z units. */
     footSpread?: number;
     /** Lateral out-angle (degrees) added to the solved knee pole so knees track outward. */
     kneeOut?: number;
   ```
   When `footSpread` is non-zero and a planted `ankle` / `farAnkle` target has no explicit Z coordinate, `chainGeometry` places the near ankle at `z = +hipHalf + footSpread` and the far ankle at `z = -hipHalf - footSpread`. When omitted (`0`), planted ankles sit in line with `±hipHalf` exactly as before.

2. **Lateral Knee Abduction (`kneeOut?: number` on `ChainPose` and `ChainMovement`, lines `1225–1226`, `1286–1287`, `3947–3949`, `4046–4047`):**
   ```ts
     const baseKneePole = chainPair(movement.kneePole ?? 45);
     const legPole: ChainDir = kneeOut === 0 ? (movement.kneePole ?? 45) : [baseKneePole[0], baseKneePole[1] + kneeOut];
   ```
   Adds a lateral out-angle (in degrees) to the 2-bone IK knee pole vector (`chainUnit(legPole, side)`), abducting the near knee toward `+Z` and the far knee toward `-Z` while preserving exact `22.25`-unit 3D thigh and shin lengths at every tick.

3. **Barbell-End Line Attachment Targets (`'nearBarEnd' | 'farBarEnd'` on `ChainLine.to`, lines `1245`, `4107–4114`, `4206`):**
   ```ts
     to: 'nearGrip' | 'farGrip' | 'midGrip' | 'nearBarEnd' | 'farBarEnd' | 'nearAnkle' | 'farAnkle';
   ```
   ```ts
     const barEnd: { near: CanonicalPoint; far: CanonicalPoint } = {
       near: [nearHoldProj[0] + barUx * barOver, nearHoldProj[1] + barUy * barOver],
       far: [farHoldProj[0] - barUx * barOver, farHoldProj[1] - barUy * barOver],
     };
   ```
   ```ts
           : cable.to === 'nearBarEnd' ? figure.barEnd.near : cable.to === 'farBarEnd' ? figure.barEnd.far
   ```
   Computes the projected outer ends of the barbell shaft (`9` box units outside `nearHoldProj` and `farHoldProj` along the bar axis, matching `layoutChainExtras`) so floor-anchored and overhead bands attach to the bar ends outside the plates rather than the hands.

---

## 3. Per-Movement Authoring & Source Bindings

All nine movements are authored on the single neutral figure (`CANONICAL_BODY_PARAMETERS`) with `status: 'pending'` and verified at every `33 ms` tick in `apps/mobile/test/components/MovementPreview.movA01Squats.test.js`.

### 3.1 ID `1` — `Competition Squat` (`competition-squat`, `back-rack-squat`, `yawDeg: 32`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:1380–1381`):**
  > `"instructions": "Set the bar securely, brace, and walk it out with the fewest controlled steps needed. Root the whole foot and descend until the hip crease passes the top of the knee. Drive back to standing while the bar stays over mid-foot. If the stance or depth changes between reps, reduce the load until the competition shape is repeatable."`
- **What was drawn:** Standing in front of a squat rack (`x = -15`), barbell resting across the upper back (`upperArm: [-102, 22], forearm: [88, 12]`, bar midpoint `1.68` units behind neck center), shoulder-width-plus stance (`footSpread: 5.4`, world ankle Z span `25.20 > shoulderSpanZ 20.98`), descending until the hip crease (`bottom.world.hip[1] = 19.50`) passes below the knee (`bottom.world.near.knee[1] = 21.11`) while the bar stays within `3.5` units of mid-foot (`x = 0.70`) throughout the `3500 ms` cycle.

### 3.2 ID `123` — `Narrow Stance Squats` (`narrow-stance-squats`, `back-rack-squat`, `yawDeg: 32`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:9642–9643`):**
  > `"instructions": "Set the bar across the upper back and step into a stance narrower than shoulder width with the toes turned slightly out. Brace and let the knees travel forward as the hips sit down, keeping pressure across the whole foot to the deepest position you own. Push the floor away to stand; if the heels lift or the knees lose their line, the stance is narrower than your available range."`
- **What was drawn:** Same `32°` oblique view and rack setup as `Competition Squat`, with `footSpread: -0.5` so the world ankle Z span (`13.40`) is visibly narrower than shoulder width (`20.98`) and `11.80` units narrower than `Competition Squat`. At the bottom (`hip[1] = 18.20`), the knees travel well forward over the toes (`knee[0] = 13.45` vs `toe[0] = 3.40`, `+4.62` units further forward than `Competition Squat`) while the feet stay flat on the floor.

### 3.3 ID `277` — `Squat with Bands` (`squat-with-bands`, `back-rack-squat`, `yawDeg: 32`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:20016–20017`):**
  > `"instructions": "Attach bands from the ends of the bar to a secure anchor near the floor, take the bar across the back of the shoulders with the shoulder blades squeezed together and step back into a wide stance. With the trunk tight, push the knees out and sit the hips back and down until the hip crease is level with the top of the knee. Drive through the feet, keeping the knees out, to stand tall against the band tension."`
- **What was drawn:** Wide stance (`footSpread: 10.2`, world ankle Z span `34.80`) inside a rack with base anchors near the floor (`[-1, 1.2, ±16.5]`) connected by `lines` to `'nearBarEnd'` and `'farBarEnd'`. At the bottom, the knees abduct outward (`kneeOut: 28`, world knee Z span `41.36 > ankleSpanZ + 6`), the hip crease sits level with the top of the knee (`hip[1] = 24.40` vs `knee[1] = 23.86`, `|Δy| = 0.54 <= 1.2`), and the floor-anchored bands lengthen by `25.8` box units as the lifter drives to lockout.

### 3.4 ID `299` — `Wide Stance Barbell Squat` (`wide-stance-barbell-squat`, `back-rack-squat`, `yawDeg: 32`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:21501–21502`):**
  > `"instructions": "Take the bar from the rack across the upper back and step back into a stance wider than the shoulders with the toes turned slightly out. Keeping the chest up and the back straight, bend the knees and lower until the thighs are just below level with the floor. Drive through the feet to stand back up."`
- **What was drawn:** Wide stance (`footSpread: 10.0`, world ankle Z span `34.40 > shoulderSpanZ + 9`), knees pushed out (`kneeOut: 26` at the bottom), lowering with a straight back until the thighs are just below level with the floor (`bottom.world.hip[1] = 22.40 < bottom.world.near.knee[1] = 23.02`, `knee[1] - hip[1] = 0.62 <= 1.5`), then driving through the planted feet to stand.

### 3.5 ID `8` — `Front Squat` (`front-squat`, `front-rack-squat`, `yawDeg: 30`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:1856–1857`):**
  > `"instructions": "Set the bar across the front of the shoulders with a secure grip and the elbows pointing forward. Stand around shoulder width, root the whole foot, and keep the elbows high before descending. Squat between the hips, then drive back to standing with the bar over mid-foot. If the elbows drop and the bar rolls forward, reduce the load until the upper back can hold the rack."`
- **What was drawn:** Turned `30°`, shoulder-width stance (`footSpread: 4.6`), barbell resting across the front deltoids (`upperArm: [4, -10], forearm: [-176, 27]`, bar midpoint `1.70` units anterior to neck center and `<= 2.5` units from neck across all ticks), direct closed grip (`hand: undefined`) with elbows pointing forward (`elbow[0] - shoulder[0] = 12.28 > 11.0`), descending with an upright torso (`trunk: 68°` at bottom vs `52°` in `Competition Squat`) to full depth (`hip[1] = 18.80 < knee[1] - 1.0`).

### 3.6 ID `208` — `Front Squat (Clean Grip)` (`front-squat-clean-grip`, `front-rack-squat`, `yawDeg: 30`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:15372–15373`):**
  > `"instructions": "Set the bar in a rack just below shoulder height, rest it on the front of the shoulders with the fingertips under the bar and the elbows high, then step back with the feet shoulder-width apart. Keeping the elbows and chest up, bend the knees and sit straight down between the legs as deep as you can control. Drive through the middle of the feet to stand back up."`
- **What was drawn:** Turned `30°` alongside `Front Squat` (`8`), with rack J-hooks at `y = 67.2` (just below standing shoulder height `70.08`), wrists extended via `hand: [125, -30]` / `[107, -30]` so the fingertips sit under the bar outside the shoulders (`grip[2] = 14.37 > shoulder[2] + 3.5`), elbows lifted higher above the shoulder line than in `Front Squat` (`upperArm: [11, -3]`, `+1.51` units higher elbow elevation), and chest kept upright (`trunk: 72°`) into a deep squat (`hip[1] = 18.20`).
- **Ambiguity note:** Both `8 Front Squat` and `208 Front Squat (Clean Grip)` describe a front-rack squat with high elbows; we distinguished them directly from their own text by drawing `208` with rack J-hooks explicitly placed just below shoulder height (`y = 67.2`), a bent-wrist `hand` segment placing the fingertips under the bar outside the shoulders, higher elbow elevation (`11°` vs `4°`), and a slightly more vertical bottom trunk (`72°` vs `68°`).

### 3.7 ID `38` — `Box Squat` (`box-squat`, `box-squat`, `yawDeg: 30`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:3897–3898`):**
  > `"instructions": "Set a box behind you at or just below parallel height and set up as for a back squat. Sit back onto the box under control, pausing briefly without relaxing. Drive back up to standing without rocking forward."`
- **What was drawn:** Turned `30°`, wide stance (`footSpread: 9.2`), a box behind the athlete (`a: [-24, 20.2], b: [-12, 0.6]`) whose top (`y = 20.2`) meets the underside of the hips/thighs at the bottom (`hip[1] - thighRadius = 23.20 - 3.07 = 20.13`, within `0.07` units of `20.2`). The hips sit far back (`hip[0] = -16.80` vs `-12.50` in `Competition Squat`) so the shins stay near-vertical (`84.28°` from floor, within `5.72°` of `90°`), holding a `550 ms` seated pause on the box (`frames[1..2].joints.ph = 1`) before driving straight up without rocking forward.

### 3.8 ID `256` — `Reverse Band Box Squat` (`reverse-band-box-squat`, `box-squat`, `yawDeg: 30`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:18594–18595`):**
  > `"instructions": "Inside a rack, hang bands from the top and loop them around the bar, set a box behind you, take the bar across the back of the shoulders and step back. With the trunk tight, push the knees out and sit the hips back until you are seated on the box, and pause. Drive through the feet with the knees out to stand up off the box."`
- **What was drawn:** Turned `30°` inside a four-post power rack with overhead crossbeams at `y = 86` (`> head[1] + 5`), bands hanging from `[-4, 86, ±16.5]` to `'nearBarEnd'` and `'farBarEnd'`, wide stance (`footSpread: 9.6`, `kneeOut: 30` at bottom), sitting back onto the box (`y = 20.2`) with near-vertical shins (`84.08°`) and a `550 ms` seated pause. As the bar descends to the box, the overhead bands stretch by `22.7` box units (`lenBottom > lenTop + 18`), providing maximum assistance at the bottom.

### 3.9 ID `275` — `Speed Box Squat` (`speed-box-squat`, `box-squat`, `yawDeg: 30`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:19883–19884`):**
  > `"instructions": "Anchor bands near the floor and loop them over the ends of the bar, set a box behind you, take the bar across the upper back with the shoulder blades pulled together and step back. Sit the hips back under control until you are seated on the box, and pause briefly. Drive up off the box as fast as you can while staying tight."`
- **What was drawn:** Turned `30°`, floor-anchored bands from `[-4, 1.2, ±16.5]` to `'nearBarEnd'` and `'farBarEnd'`, sitting the hips back onto the `y = 20.2` box with near-vertical shins (`84.28°`) on a controlled `1350 ms` descent, holding a brief `350 ms` pause seated on the box, and driving up off the box in `650 ms` (`concentricMs * 2 = 1300 < descentMs = 1350`) as the floor-anchored bands stretch by `22.4` box units toward lockout.

---

## 4. Gate Commands Run & Decisive Output

All five gate commands were executed via `batch_gates.sh` against source commit `9bbe6f1e08a77ebf89da65548f18f0e3284d9c70` and recorded in `docs/audits/accessible-coach/movement-completion/evidence/movement-30-squats/`:

1. **`typecheck.log` (`npm run typecheck`):**
   - `> tsc -p apps/mobile/tsconfig.json`
   - `exit code: 0`
2. **`jest-movement-preview.log` (`npx jest --config apps/mobile/jest.config.js --runInBand --no-cache --testPathPattern MovementPreview`):**
   - `PASS apps/mobile/test/components/MovementPreview.movA01Squats.test.js (7.282 s)`
   - `Test Suites: 57 passed, 57 total`
   - `Tests:       2698 passed, 2698 total`
   - `exit code: 0`
3. **`storage-guard.log` (`node --expose-gc tools/rendering/verify_preview_storage.mjs`):**
   - `"records": 191, "families": 75, "rawBytes": 556970, "gzipBytes": 93091`
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

---

## 5. Note on `check_batch.mjs` `execFileSync` `maxBuffer`

- In `check_batch.mjs` line 18 (`execFileSync('git', a, { cwd: wt, encoding: 'utf8', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } })`), `maxBuffer` is not set, so Node.js (`v24.11.1`) defaults to `1048576` bytes (`1 MiB`).
- Because `apps/mobile/src/components/movementPreview/movementPreviewManifest.json` in `614f7326fab8a2c08d9c4f4c00a2e3399580ac48` is a single-line JSON file of `618655` bytes and in `9bbe6f1e08a77ebf89da65548f18f0e3284d9c70` is `641975` bytes, `git diff -U0 614f7326fab8a2c08d9c4f4c00a2e3399580ac48..9bbe6f1e08a77ebf89da65548f18f0e3284d9c70 -- apps tools` (line 67) outputs `1379662` bytes and hits `Error: spawnSync git ENOBUFS` under the 1 MiB default buffer.
- With `maxBuffer: 33554432` (`32 MiB`) passed to `execFileSync` in an out-of-tree copy of `check_batch.mjs`, all `73/73` checks print `PASS`.

