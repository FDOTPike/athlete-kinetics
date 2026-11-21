# MOV-A07 — Other Overhead Work (`229, 85, 112, 101, 58, 63, 69`)

- **Branch:** `movement/36-overhead-other-2026-10-17`
- **Base commit:** `9e03224865b78a94a49367828f09fe6df802e3dd`
- **Source commit:** `14af98271e0283abd8a190e5516c0fd89ea3149b`
- **Status:** `EVIDENCE CAPTURED`

---

## 1. Source Quotes, Views Chosen, Bounds, and Measured Values

### `229` — Kettlebell Seated Press (`kettlebell-seated-press`)
- **Catalogue quotes (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json`):**
  - Line 16781 (`instructions`): `"Sit on the floor with the legs spread comfortably wide for a stable base. Clean one kettlebell to the shoulder so the bell rests on the forearm. Press up and out until the arm locks out overhead, then return to the shoulder under control."`
  - Line 16782 (`cues`): `"Keep the legs wide and settled. Finish with the elbow locked overhead. Lower back to the rack position with intent."`
- **View chosen:** `oblique` (`yawDeg: 45`) so the floor-seated wide straddle of both legs (no bench), the single kettlebell resting on the near forearm at the shoulder rack, the up-and-out press path clear of the head ring, and the settled free arm all read together without foreshortening.
- **Bounds & measured values (`apps/mobile/test/components/MovementPreview.movA07OverheadOther.test.js:69-128`):**
  - Floor-seated with no bench (`equipment.length === 0`), painted thigh and shin undersides within `[0, 0.5]` of `FLOOR = 96.9`: measured thigh gap `0.05`, shin gap `0.049`.
  - Wide straddle across Z (`ankleSpreadZ >= 40`): measured `43.309`, with hip and ankle drift `< 0.01` (`0`) across every 33 ms tick and 2D trunk angle `>= 85 deg` (measured `90 deg`).
  - Rack start at shoulder on forearm (`rackElbowDeg <= 75 deg`, `rackWristToShoulderDist <= 9.5`) to locked overhead finish (`lockElbowDeg >= 176 deg`, `wristVerticalRise > 20`, `wristOutwardDeltaZ > 1.5`): measured `rackElbowDeg = 26.401 deg`, `rackWristToShoulderDist = 5.616`, `lockElbowDeg = 180 deg`, `wristVerticalRise = 20.026`, `wristOutwardDeltaZ = 8.077`, and positive 2D clearance between the near upper-arm bone and the head circle outer stroke on every tick.
  - Segment timings: `[1300, 350, 1500, 450]` ms (`3600 ms` total).

### `85` — Double Kettlebell Push Press (`double-kettlebell-push-press`)
- **Catalogue quotes (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json`):**
  - Line 7079 (`instructions`): `"Clean two kettlebells to the rack position. Dip a few inches by bending the knees with a vertical torso, then drive the legs hard and let that force carry both bells to locked-out arms overhead. Lower back to the rack, breathe, repeat. The legs start the press and the arms finish it — a shallow, snappy dip beats a deep slow one every time."`
  - Line 7080 (`cues`): `"Dip shallow, drive fast. Legs throw it, arms catch the lockout. Rack, reset, breathe between reps."`
- **View chosen:** `oblique` (`yawDeg: 28`) so both kettlebells in the front rack, the vertical torso during the shallow knee dip, and the two-stage leg drive into overhead lockout all read clearly.
- **Bounds & measured values (`apps/mobile/test/components/MovementPreview.movA07OverheadOther.test.js:130-177`):**
  - Phases `[1, 0, 2, 2, 1, 1]` start in the standing rack (`ph = 1`), dip shallowly (`ph = 0`) while keeping the bells racked at the shoulders (`wristToShoulderDist <= 9.5`, measured `4.906`), and drive through `ph = 1` (legs extend first while bells are still at the rack) into `ph = 2` (arms finish overhead at lockout).
  - Shallow hip dip in `[4.0, 8.0]` units with knee angle in `[125, 148] deg` and vertical 2D trunk `>= 88 deg`: measured `hipDipUnits = 4.985`, `dipKneeDeg = 125.403 deg` (vs `rackKneeDeg = 178.332 deg`, `lockKneeDeg = 178.332 deg`), `dipTrunkDeg2D = 90 deg`.
  - Overhead lockout (`lockElbowDeg >= 176 deg`, `wristAboveShoulderAtLock > 22`): measured `lockElbowDeg = 180 deg`, `wristAboveShoulderAtLock = 23.965`.
  - Snappy dip vs drive timing (`segmentDurationsMs[0] <= 400` and `segmentDurationsMs[0] * 2 <= segmentDurationsMs[1]`, reset pause `>= 400`): measured segments `[330, 820, 350, 950, 450]` ms (`2900 ms` total).

### `112` — Bent Press (`bent-press`)
- **Catalogue quotes (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json`):**
  - Line 8893 (`instructions`): `"Clean one kettlebell to the shoulder, set the feet wider than the hips, and turn them slightly away from the loaded side. Send the hips away and wedge the torso under the bell, straightening the arm as the body descends while the eyes stay on the handle. Once the elbow is locked, drive the feet through the floor to stand tall; if the bell travels sideways instead of staying over its base, the range is too deep or the setup was rushed."`
  - Line 8894 (`cues`): `"Keep the bell stacked over its base. Send the hips away and wedge under the handle. Stand tall beneath a locked arm."`
- **View chosen:** `oblique` (`yawDeg: 32`) so the wide stance with feet turned away from the loaded near side, the hips shifting away as the torso wedges under the kettlebell, and the vertical line of the kettlebell stacked over its base are all simultaneously visible.
- **Bounds & measured values (`apps/mobile/test/components/MovementPreview.movA07OverheadOther.test.js:179-227`):**
  - Wide stance (`ankleSpreadZ >= 22`) and feet turned slightly away from the loaded near side (`footTurnDeg <= -12 deg`): measured `ankleSpreadZ = 24`, `footTurnDeg = -18 deg`.
  - Setup to wedge (`ph = 0 -> 1`): hips shift away (`hipShiftAwayX < -6`, measured `-15.2`) and descend (`hipDropY < -4`, measured `-7`), torso wedges to `<= 55 deg` from horizontal (measured `wedgeTrunkDeg2D = 46.715 deg`), near shoulder drops `> 14` units under the bell, and near elbow straightens from `<= 65 deg` (measured `13.831 deg`) to `>= 176 deg` (measured `176.107 deg`) while the head looks up toward the handle (`head.y - neck.y = +8.98 > 5`).
  - Wedge to stand tall (`ph = 1 -> 2`): feet drive through the floor to stand tall (`standTrunkDeg2D = 89.152 deg >= 85 deg`, `standElbowDeg = 177.587 deg >= 176 deg`), raising the locked bell `+14.845` units (`> 14`).
  - Bell stays stacked over its base across every 33 ms tick (`|hold[0] - setup.hold[0]| <= 1.2` and `|hold[2] - setup.hold[2]| <= 1.2`): measured `holdXDriftMax = 0`, `holdZDriftMax = 0`.
  - Segment timings: `[1500, 1100, 350, 900, 800]` ms (`4650 ms` total).

### `101` — Cuban Press (`cuban-press`)
- **Catalogue quotes (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json`):**
  - Line 8153 (`instructions`): `"Stand with very light dumbbells and raise the elbows wide to shoulder height, forearms hanging below them. Keep the upper arms fixed while rotating the forearms until the wrists stack directly over the elbows, then press to a tall overhead finish. Reverse every stage under control; if the hips have to help, the bells are too heavy for the rotation you are training."`
  - Line 8154 (`cues`): `"Hold the elbows high and wide. Rotate around quiet upper arms. Reverse the path smoothly."`
- **View chosen:** `oblique` (`yawDeg: 38`) so both the wide shoulder-height abduction of the upper arms and the 180-degree sagittal rotation of the forearms from hanging below the elbows (`ph = 1`) to stacked vertically above the elbows (`ph = 2`) and overhead lockout (`ph = 3`) are clearly visible.
- **Bounds & measured values (`apps/mobile/test/components/MovementPreview.movA07OverheadOther.test.js:229-282`):**
  - Four poses (`ph = 0, 1, 2, 3`) traversed forward and reversed in order via `phases: [0, 1, 2, 3, 3, 2, 1, 0]`.
  - Stage 1 (`ph = 1`): elbows wide at shoulder height (`|elbow.y - shoulder.y| <= 1.0`, measured `0`; `elbow.z - shoulder.z >= 11.5`, measured `12.5`) with forearms hanging vertically below (`wrist.y - elbow.y < -11.5`, measured `-12`).
  - Stage 2 (`ph = 2`): upper arms stay fixed (`dist3(elbow(1+u), elbow(1)) < 0.05`, measured `0`) with a constant `90 deg` elbow angle while forearms rotate up until wrists stack directly over the elbows (`wrist.y - elbow.y > 11.5`, measured `+12`).
  - Stage 3 (`ph = 3`): press to a tall overhead finish (`stage3ElbowDeg >= 175 deg`, measured `180 deg`; `stage3WristAboveShoulderY > 22`, measured `23.965`), while hips and ankles stay quiet (`drift < 0.01`) on every 33 ms tick.
  - Segment timings: `[700, 750, 750, 350, 750, 750, 700]` ms (`4750 ms` total).

### `58` — Eccentric Wall Handstand Push-Up (`eccentric-wall-handstand-push-up`)
- **Catalogue quotes (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json`):**
  - Line 5263 (`instructions`): `"Clear the floor, place a firm padded target beneath the head, and kick to the wall with the hands just outside shoulder width. Brace into a vertical line and lower for up to five seconds until the head meets the pad softly. Exit through the rehearsed clear side, reset, and kick back up; the controlled lowering is the full rep. If control disappears before the pad, raise the target or return to a pike progression."`
  - Line 5264 (`cues`): `"Own the full lowering count. Hold one strong vertical line. Meet the pad softly and exit under control."`
- **View chosen:** `oblique` (`yawDeg: 20`) so the vertical wall behind the heels, the padded floor target beneath the head, both hands planted just outside shoulder width on the floor, and the clear-side exit leg stepping down at the end of the rep all read without overlapping.
- **Bounds & measured values (`apps/mobile/test/components/MovementPreview.movA07OverheadOther.test.js:284-365`):**
  - Inverted vertical line (`ankle.y > hip.y + 40`, `hip.y > neck.y + 22`, `neck.y > head.y + 8`) with hands just outside shoulder width (`wristSpanZ = 22.4 > shoulderSpanZ + 2.0 = 20.768`).
  - Controlled lowering for up to five seconds (`segmentDurationsMs[0]` in `[4000, 5000]` ms: measured `4600 ms`), flexing elbows from `>= 170 deg` (measured `173.96 deg`) to `<= 98 deg` (measured `89.245 deg`).
  - Painted contacts: head bottom to floor pad top gap in `[0, 0.5]` at bottom (measured `0.1`), near and far hands to `FLOOR = 96.9` gap in `[0, 0.5]` across every tick (measured `0.1`), and near heel left edge to wall right face gap in `[0, 0.6]` across every tick (measured `0.111`).
  - Eccentric-only rep with clear-side exit (`phases: [0, 1, 2, 2, 0]`, `exitFarAnkleDisplacement > 15`: measured `36.698`), distinguishing `58` from `63`.
  - Segment timings: `[4600, 900, 350, 1200]` ms (`7050 ms` total).

### `63` — Handstand Push-Up (`handstand-push-up`)
- **Catalogue quotes (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json`):**
  - Line 5602 (`instructions`): `"Clear the floor, place a firm padded target beneath the head, and kick to the wall with the hands just outside shoulder width. Brace into one vertical line and lower until the head meets the pad softly. Press back to straight arms, then exit through a rehearsed clear side. If the descent or exit is uncertain, raise the target or build the range with pike push-ups first."`
  - Line 5603 (`cues`): `"Hold one strong vertical line. Meet the pad softly. Press tall, then exit under control."`
- **View chosen:** `oblique` (`yawDeg: 20`) to pair directly with `58` Eccentric Wall Handstand Push-Up while contrasting the normal lowering tempo (`1500 ms` vs `4600 ms`) and the concentric press back to straight arms (`phases: [0, 1, 1, 0, 0]`).
- **Bounds & measured values (`apps/mobile/test/components/MovementPreview.movA07OverheadOther.test.js:284-365`):**
  - Same wall, floor pad, and outside-shoulder-width hand setup (`wristSpanZ = 22.4`, `shoulderSpanZ = 18.768`, `handFloorGap = 0.1`, `heelWallGap = 0.111`).
  - Normal descent (`1500 ms <= 2000 ms`, more than `2.5x` faster than `58`'s `4600 ms` eccentric) from `173.96 deg` to `89.245 deg` elbow angle until painted head meets the pad (`headPadGap = 0.1`), followed by a `1150 ms` press back to straight arms (`173.96 deg`).
  - Segment timings: `[1500, 350, 1150, 450]` ms (`3450 ms` total).

### `69` — Pike Push-Up (`pike-push-up`)
- **Catalogue quotes (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json`):**
  - Line 6007 (`instructions`): `"Start in a push-up position, then walk your feet in and lift your hips high so your torso points at the floor like an inverted V. Bend your elbows and lower the top of your head towards the floor between your hands. Press back to long arms without the hips drifting forward. Elevate the feet to move it closer to a handstand push-up."`
  - Line 6008 (`cues`): `"Hips stacked high the whole rep. Head travels to a spot just ahead of the hands. Elbows track at about 45 degrees."`
- **View chosen:** `oblique` (`yawDeg: 22`) so the inverted-V pike profile, both hands and feet planted on the floor, the elbows tracking at ~45 degrees, and the head lowering to a spot just ahead of the hands all read clearly.
- **Bounds & measured values (`apps/mobile/test/components/MovementPreview.movA07OverheadOther.test.js:367-414`):**
  - High hips in an inverted V (`hip.y > neck.y + 14` at top, `hip.y > neck.y + 16` at bottom, 3D `neck-hip-ankle` included angle `<= 105 deg`): measured `topHipAngleDeg = 78.997 deg`, `botHipAngleDeg = 58.757 deg`.
  - Elbows bend from `>= 158 deg` (measured `160.989 deg`) to `<= 95 deg` (measured `76.665 deg`) and track at about 45 degrees (`elbowTrackDeg` in `[30, 60] deg`, measured `55.035 deg`) while the head lowers to a spot just ahead of the hands (`botHeadAheadOfWristX` in `[2.0, 7.5]`, measured `+3.993`; `botHeadY <= 9.5`, measured `9.463`).
  - Press back to long arms without the hips drifting forward (`hipDriftForwardX <= 0.05` across every 33 ms tick: measured `0`).
  - Segment timings: `[1300, 350, 1100, 450]` ms (`3200 ms` total).

---

## 2. Test-First Failing Run and Guard-Break Verification

1. **First failing run before authoring (`MovementPreview.movA07OverheadOther.test.js`):**
   - All 13 tests failed with `expect(received).toBeDefined() / Received: undefined` at `entryFor(id)` before the 7 movements were authored into `canonicalFigure.ts`, `chain_motion_specs.mjs`, and `movementPreviewManifest.json`.
2. **Guard-break verification on `112` Bent Press:**
   - Temporarily shifting `wrist[0]` in Pose 1 of `bent-press` from `2.64` to `8.64` caused `MovementPreview.movA07OverheadOther.test.js` to fail at line 221 (`expect(Math.abs(g.world.near.hold[0] - setup.world.near.hold[0])).toBeLessThanOrEqual(1.2)`, `Received: 1.3068000000000004`), proving the sideways-bell-drift guard catches violations. Restored `2.64` and re-verified all 13 tests.

---

## 3. Kit Fields Added

- No new engine fields were required in `canonicalFigure.ts`; all 7 movements were authored using existing `CHAIN_MOVEMENTS` capabilities (`root: 'hip' | 'neck'`, `view: 'oblique'`, `yawDeg`, `feet: 'free'`, `footSpread`, `kneeOut`, `elbowPole`, `kneePole`, `implement: 'kettlebell' | 'kettlebells' | 'bells'`, and `equipment` `slab` primitives for the wall and head pad).
- Added the 7 family mappings (`229: 'vertical-press@seated'`, `85, 112, 101, 58, 63, 69: 'vertical-press@standing'`) to `LEGACY_FAMILY_KEYS` in `tools/rendering/wo09_split_preview_manifest.mjs`.

---

## 4. Gate Summary (`batch_gates.sh` on `14af98271e0283abd8a190e5516c0fd89ea3149b`)

- `typecheck.log`: `exit code: 0`
- `jest-movement-preview.log`: `Test Suites: 61 passed, 61 total`, `Tests: 3381 passed, 3381 total`, `exit code: 0`
- `storage-guard.log`: `222 entries`, `644064 B raw`, `106811 B gzip`, `exit code: 0`
- `evidence-gate.log`: `exit code: 0`
- `rendered-output-probe.log`: `added: 229 Kettlebell Seated Press; 85 Double Kettlebell Push Press; 112 Bent Press; 101 Cuban Press; 58 Eccentric Wall Handstand Push-Up; 63 Handstand Push-Up; 69 Pike Push-Up`, `removed: none`, `changed, NOT expected: none`, `movements with overflow above 1e-6 dp: none`, `exit code: 0`

builder
