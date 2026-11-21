# MOV-A07-R1 — Overhead Pressing Repairs (`229, 112, 58, 63, 69`; `85, 101` unchanged)

- **Branch:** `movement/42-overhead-other-repairs-2026-10-18`
- **Base commit:** `0ce1be74e2347a7eb2e32df2723417c5aed40633`
- **Source commit:** `c7b5556f4767ff789c7ed572a863989ec1be0115`
- **Status:** `EVIDENCE CAPTURED`

---

## 1. Audit Findings Repaired, Views Chosen, Bounds, and Measured Values

### `112` — Bent Press (`bent-press`) — Major + 2 Minors Repaired
- **Catalogue quotes (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json`):**
  - Line 8893 (`instructions`): `"Clean one kettlebell to the shoulder, set the feet wider than the hips, and turn them slightly away from the loaded side. Send the hips away and wedge the torso under the bell, straightening the arm as the body descends while the eyes stay on the handle. Once the elbow is locked, drive the feet through the floor to stand tall; if the bell travels sideways instead of staying over its base, the range is too deep or the setup was rushed."`
  - Line 8894 (`cues`): `"Keep the bell stacked over its base. Send the hips away and wedge under the handle. Stand tall beneath a locked arm."`
- **Repairs applied (`apps/mobile/src/components/movementPreview/canonicalFigure.ts:4702-4738`, `tools/rendering/chain_motion_specs.mjs:2266-2282`):**
  1. **Stand tall at setup and finish (Major):** Raised hip (`at: [-0.4, 46.3]`, `farAnkle: [-0.8, 2.16, -12.0]`, `kneeOut: 6`, `wrist: [2.64, 94.65, 7.36]`) at `ph = 0` and `ph = 2` so both near and far knees measure `174.41 deg >= 172 deg` (was `146.92 deg`), while the locked overhead arm at `ph = 2` measures `177.53 deg >= 176 deg` with exact `12.5` + `12.0` bone lengths.
  2. **Removed second wedge and its caption (Major + Minor):** Enabled `cycle: true` on `'bent-press'` and changed `phases` to `[0, 1, 2, 2, 3, 3]` (`segments: [1500, 1100, 400, 1000, 450]`, `4450 ms` total) so `ph = 2 -> 3` lowers the kettlebell directly from overhead lockout back to the shoulder rack while standing tall (`trunk = 89 deg`, both knees `174.41 deg >= 172 deg`), and replaced `'Control the descent back into the wedge.'` with `'Lower the kettlebell back to the shoulder while standing tall.'` and `'Reset at the shoulder before the next repetition.'`.
  3. **Head turned toward the bell in the wedge (Minor):** Set `head: [90, 20]` at `ph = 1` so the 3D `neck -> head` vector aligns within `0.97 deg <= 5 deg` of `neck -> hold` and tilts toward the overhead bell in 2D (`hd[0] = 52.60 < nk[0] = 54.24`), and noted in `reason` that the unmarked head circle cannot show eye gaze directly.

### `58` — Eccentric Wall Handstand Push-Up (`eccentric-wall-handstand-push-up`) — Major Repaired
- **Catalogue quotes (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json`):**
  - Line 5263 (`instructions`): `"Clear the floor, place a firm padded target beneath the head, and kick to the wall with the hands just outside shoulder width. Brace into a vertical line and lower for up to five seconds until the head meets the pad softly. Exit through the rehearsed clear side, reset, and kick back up; the controlled lowering is the full rep. If control disappears before the pad, raise the target or return to a pike progression."`
  - Line 5264 (`cues`): `"Own the full lowering count. Hold one strong vertical line. Meet the pad softly and exit under control."`
- **Repairs applied (`apps/mobile/src/components/movementPreview/canonicalFigure.ts:4780-4830`, `tools/rendering/chain_motion_specs.mjs:2302-2319`):**
  - Replaced the single-leg hover and reverse-through-`ph = 1` loop with a 6-pose `cycle: true` loop (`phases: [0, 1, 2, 3, 4, 5, 6]`, `segments: [4600, 650, 650, 500, 650, 650]`, `7700 ms` total):
    - `ph = 0 -> 1` (`4600 ms`): slow vertical lowering along the wall (`heelWallGap = 0.111` in `[0, 0.6]`) from `173.96 deg >= 172 deg` elbow angle until the painted head meets the pad softly (`headPadGap = 0.1` in `[0, 0.5]`, `elbow = 89.25 deg`).
    - `ph = 1 -> 2 -> 3` (`1300 ms`): with `at` held at `[0, 19.3]` so the elbow angle stays at `89.25 deg` (`maxElbowRiseWhileFeetAboveHands = 0.00000 deg`), both legs come away from the wall on the clear side (`+x`) and land on the floor at `ph = 3` (`near/far ankle Y = 2.253 <= 2.5`, `ankle X = 52.87 > 25`).
    - `ph = 3 -> 4` (`500 ms`): reset on the clear side with both feet on the floor (`ankle Y = 2.280 <= 2.5`) while the arms straighten (`173.96 deg`) ready to kick up.
    - `ph = 4 -> 5 -> 6` (`1300 ms`): kick back up to the wall handstand (`ph = 6 === ph = 0`) with straight arms (`173.96 deg`).

### `63` — Handstand Push-Up (`handstand-push-up`) — Major Repaired
- **Catalogue quotes (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json`):**
  - Line 5602 (`instructions`): `"Clear the floor, place a firm padded target beneath the head, and kick to the wall with the hands just outside shoulder width. Brace into one vertical line and lower until the head meets the pad softly. Press back to straight arms, then exit through a rehearsed clear side. If the descent or exit is uncertain, raise the target or build the range with pike push-ups first."`
  - Line 5603 (`cues`): `"Hold one strong vertical line. Meet the pad softly. Press tall, then exit under control."`
- **Repairs applied (`tools/rendering/chain_motion_specs.mjs:2320-2335`):**
  - Replaced the last caption (`'Hold tall at lockout before the next repetition or controlled exit.'`) with the direct post-set instruction `'After the last repetition, exit through your rehearsed clear side.'` (bound in `MovementPreview.movA07OverheadOther.test.js:384-385`).

### `69` — Pike Push-Up (`pike-push-up`) — Major + Minor Repaired
- **Catalogue quotes (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json`):**
  - Line 6007 (`instructions`): `"Start in a push-up position, then walk your feet in and lift your hips high so your torso points at the floor like an inverted V. Bend your elbows and lower the top of your head towards the floor between your hands. Press back to long arms without the hips drifting forward. Elevate the feet to move it closer to a handstand push-up."`
  - Line 6008 (`cues`): `"Hips stacked high the whole rep. Head travels to a spot just ahead of the hands. Elbows track at about 45 degrees."`
- **Repairs applied (`apps/mobile/src/components/movementPreview/canonicalFigure.ts:4864-4888`, `tools/rendering/chain_motion_specs.mjs:2336-2351`):**
  1. **Straight arms at the top (Major):** Adjusted Pose 0 `trunk` and `head` from `-40` to `-39.2` so the top elbow angle measures `174.56 deg >= 172 deg` (was `160.99 deg`), while keeping the inverted-V hip stack (`topHipAngleDeg = 79.79 deg <= 105 deg`, `hip.y - neck.y = +14.90 > 14`) and exact `12.5` / `12.0` arm bone lengths. Raised the test bound at line 438 from `158` to `172`.
  2. **45-degree elbow tracking wording (Minor):** Updated caption 2 to `'Let your elbows track back at about 45 degrees from your body and lower the top of your head towards a spot on the floor just ahead of your hands.'` (and matching wording in `reason` and `summary`).

### `229` — Kettlebell Seated Press (`kettlebell-seated-press`) — Minor Repaired
- **Catalogue quotes (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json`):**
  - Line 16781 (`instructions`): `"Sit on the floor with the legs spread comfortably wide for a stable base. Clean one kettlebell to the shoulder so the bell rests on the forearm. Press up and out until the arm locks out overhead, then return to the shoulder under control."`
  - Line 16782 (`cues`): `"Keep the legs wide and settled. Finish with the elbow locked overhead. Lower back to the rack position with intent."`
- **Repairs applied (`apps/mobile/src/components/movementPreview/canonicalFigure.ts:4644-4667`, `tools/rendering/chain_motion_specs.mjs:2233-2248`):**
  - Turned the view to `yawDeg: 72, originX: 44` with `at: [-4, CHAIN_THIGH_HALF + 0.05]`, `thigh: [0, 35]`, `shin: [-1.84, 35]`, `foot: [80, 28]` (and `upperArm: [90, 24], forearm: [90, 24]` at lockout) so both wide-straddled legs separate clearly in the 2D card projection (`near ankle X = 23.28 < near hip X 36.30 - 10`, `far ankle X = 84.77 > far hip X 49.23 + 25`, `2D ankle spread = 61.48 >= 55`, `3D ankle spread Z = 64.65 >= 60`, `knee angle = 178.49 deg >= 172 deg`) while keeping the bell path clear of the head circle (`min clearance = 2.166 > 0`) and locking out at `180.00 deg >= 176 deg`.

### `85` — Double Kettlebell Push Press & `101` — Cuban Press (Unchanged)
- Passed second audit in `AUDIT_A07.md`; untouched (`drawnSha256` and `captionSha256` identical to baseline).

---

## 2. Test-First Failing Run (`MovementPreview.movA07OverheadOther.test.js`)

Before editing `canonicalFigure.ts` or `chain_motion_specs.mjs`, the tightened assertions in `apps/mobile/test/components/MovementPreview.movA07OverheadOther.test.js` were run against the unedited source and failed on all 4 repaired test blocks (`229`, `112`, `58/63`, `69`):
- `229`: `expect(start.world.near.ankle[2] - start.world.far.ankle[2]).toBeGreaterThanOrEqual(60)` — `Received: 43.30881047180561`
- `112`: `expect(deg3D(setup.world.near.hipJoint, setup.world.near.knee, setup.world.near.ankle)).toBeGreaterThanOrEqual(172)` — `Received: 146.91529966030302`
- `58/63`: `expect(e63.frames.at(-1).caption).toContain('exit through')` — `Received: "Hold tall at lockout before the next repetition or controlled exit."`
- `69`: `expect(deg3D(top.world.near.shoulder, top.world.near.elbow, top.world.near.wrist)).toBeGreaterThanOrEqual(172)` — `Received: 160.9892425884795`

---

## 3. Kit Fields Added

- None. All repairs used existing `CHAIN_MOVEMENTS` fields (`cycle: true`, `yawDeg`, `originX`, `at`, `trunk`, `head`, `thigh`, `shin`, `foot`, `wrist`, `farWrist`, `ankle`, `farAnkle`, `kneeOut`, `upperArm`, `forearm`).

---

## 4. Gate Summary (`batch_gates.sh` on `c7b5556f4767ff789c7ed572a863989ec1be0115`)

- `typecheck.log`: `exit code: 0`
- `jest-movement-preview.log`: `Test Suites: 62 passed, 62 total`, `Tests: 3513 passed, 3513 total`, `exit code: 0`
- `storage-guard.log`: `230 records`, `75 families`, `669214 B raw`, `111394 B gzip`, `exit code: 0`
- `evidence-gate.log`: `PASS — clean evidence passes and all 19 injected defects are rejected by their own check.`, `exit code: 0`
- `rendered-output-probe.log`: `movements measured: 224 (baseline 224)`, `added: none`, `removed: none`, `changed, expected: 229 Kettlebell Seated Press; 112 Bent Press; 58 Eccentric Wall Handstand Push-Up; 63 Handstand Push-Up; 69 Pike Push-Up`, `changed, NOT expected: none`, `movements with overflow above 1e-6 dp: none`, `exit code: 0 (probe run exit 0)`

builder
