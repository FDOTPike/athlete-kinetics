# MOV-A15-R1 Evidence Report — Repairs to Held-Text Drafts and Drawings (`145`, `153`, `165`, `205`, `250`)

- **Branch**: `movement/52-held-text-repairs-2026-10-18`
- **Source Commit**: `30c655bacb95ad20a869bc8e94a45d29149ef66f`
- **Baseline Probe**: `probe-5ebb8f12a7e06f246cae79d1fbbb6e7d3b9dfa9f.json` (`236` movements)
- **Allowed Changed Movements**: `145`, `153`, `165`, `205`, `250` (`0` added, `0` removed)
- **Catalogue Entries**: Untouched (`ALL_300_MOTION_MAP.json` and `apps/mobile/src/data/movements.json` unmodified)

---

## 1. Summary of Repairs to `DRAFT_TEXT.md`, Drawings, Captions, and Tests

### `145` — `Bent Over Two-Arm Long Bar Row` (`bent-over-two-arm-long-bar-row`)
- **`DRAFT_TEXT.md` rationale repairs**:
  - Marked reading the catalogue's `"cable_machine"` equipment tag as the double-handle cable attachment hooked under the bar shaft (with no cable stack) as the chosen interpretation rather than verified catalogue provenance (`DRAFT_TEXT.md` lines 28, 31).
  - Attributed `"the torso stays still"` to `ALL_300_MOTION_MAP.json`'s `"Quiet hinged torso"` family constraint rather than to the two still photographs (`DRAFT_TEXT.md` lines 25, 28, 32).
- **Drawing & captions**:
  - Updated `reason` in `tools/rendering/chain_motion_specs.mjs` (line 2624) to attribute the stationary torso to the quiet-torso constraint; geometry unchanged (`drawn d3a13d62ad668d2e8a52cbd868a9fb7e6c92360fa905d976e4d4133b6b8fd93b`, `captions af885080cb47e3bd28de12175343f1f16703984be91ceefbc11a0d5de9511082`).

### `153` — `Box Squat with Bands` (`box-squat-with-bands`)
- **`DRAFT_TEXT.md` draft & rationale repairs**:
  - Added explicit trunk bracing through the descent, the seated pause, and the drive up (`"Keeping your trunk braced through the descent"`, `"Pause on the box without bouncing while keeping your trunk braced"`, `"Keep the trunk braced through the descent, the seated pause and the drive up"`).
  - Replaced `"shins perpendicular to the ground"` with `"shins approximately vertical, feet planted"` in both instructions and cues, and marked that choice in the rationale (`DRAFT_TEXT.md` lines 69, 74, 76).
  - Carried the chosen `"shoulder-width to slightly wider stance"` directly into the setup sentence of the instructions (`DRAFT_TEXT.md` line 74).
  - Added whole-foot pressure alongside driving through the heels (`"drive upward off the box through your heels with whole-foot pressure to stand tall"`, `"Drive up through your heels over the whole foot against the bands"`).
  - Removed the claim that both photographs prove the rack-base floor anchor (`0.jpg` crops the floor attachment and `1.jpg` partly obscures it; marked as a choice from sentence 1 in `DRAFT_TEXT.md` lines 60–61, 68).
- **Drawing, captions & tests**:
  - Updated `text`, `captions`, `reason`, and `summary` in `tools/rendering/chain_motion_specs.mjs` (lines 2633–2647) and verified in `MovementPreview.movA15HeldText.test.js` (`drawn 68c939ce6197333ff013bcddc8accffbff42d596efed78f2585b3db6559f355f`, `captions e851495513904efaf9591d028e9744fe5ffc1d51d7e410b8e11da79c0cf4d4aa`).

### `165` — `Calf Raise On A Dumbbell` (`calf-raise-on-a-dumbbell`)
- **`DRAFT_TEXT.md` safety repair & rationale**:
  - Replaced the upstream source's rolling-dumbbell instruction with a deliberate safety change (explicitly marked as **a choice** in `DRAFT_TEXT.md` line 106, not as something shown by the two still photographs): `"Use a dumbbell that cannot roll (hexagonal heads, or wedged) placed on the floor in front of a sturdy support that cannot move, check it is stable before stepping on, hold the support with both hands for balance, and stand with the ball of one foot on the dumbbell handle and the other foot lifted clear of the floor."`
  - Stated in instructions and cues that `"the dumbbell stays still"` while the ankle lowers into the stretch and rises into full calf extension (`"While the dumbbell stays still, lift the heel to rise on the ball of the foot over the handle into a full calf extension"`, `"Keep the dumbbell still while the ankle lowers and rises into full extension and holds for a second"`), and added `"complete the repetitions, then change legs"` (`DRAFT_TEXT.md` lines 111, 113).
- **Drawing, captions & tests**:
  - Replaced the round-disc floor dumbbell in `canonicalFigure.ts` (`'calf-raise-on-a-dumbbell'`, lines 5477–5491) with two stationary 6-sided flat-bottomed hexagonal dumbbell heads at `z = 0.6` and `z = 13.0` (`box` cores from `[-1.8, 0.5]` to `[1.8, 6.1]` plus 6-segment hexagonal `frame` perimeters with flat bottom edges on the floor `y = 0.5`, flat top edges at `y = 6.1`, and angled side facets reaching `x = ±3.2`) joined by the stationary handle `slab` at `[0, 2.6, 1.2]..[0, 2.6, 12.4]`.
  - Updated `text`, `captions`, `reason`, and `summary` in `tools/rendering/chain_motion_specs.mjs` (lines 2654–2669) and added structural assertions in `MovementPreview.movA15HeldText.test.js` verifying the two 6-sided flat-bottomed hexagonal heads (`12` hexagonal `frame` segments, `4` flat horizontal top/bottom edges, `8` angled side facets, `0` rolling disc circles) and verifying that the dumbbell's rendered primitives are byte-for-byte stationary across phases (`drawn 27e5676c421e5e2563e633339bf9ace3fa4912df46d8bc0e8188d53f5b9fc790`, `captions b969ad52fc76ea062b1f7220749c3562a94e442090c8935b84a9be895ea3bb7c`).

### `205` — `Front Barbell Squat To A Bench` (`front-barbell-squat-to-a-bench`)
- **`DRAFT_TEXT.md` draft & rationale repairs**:
  - Carried the bench-height choice directly into the setup sentence of the instructions (`"Inside a squat rack, place a stable bench set so the glutes touch it lightly at about thighs parallel behind you"`, `DRAFT_TEXT.md` lines 143, 150).
  - Updated the knee and foot cue in both instructions and cues to `"knees tracking with the toes over a whole foot"` alongside driving through the heels over the whole foot (`DRAFT_TEXT.md` lines 145, 150, 152), and recorded in the photo note for `1.jpg` that driving back up through the heels comes from sentence 5 of the source text rather than visible motion in the still photograph (`DRAFT_TEXT.md` line 137).
- **Drawing, captions & tests**:
  - Updated `text`, `captions`, `reason`, and `summary` in `tools/rendering/chain_motion_specs.mjs` (lines 2676–2691) and verified in `MovementPreview.movA15HeldText.test.js` (`drawn f304fc4fbb273400cd4d5cdb1a0a6086e7d3105e9efc8f424e54a707f098c51f`, `captions a58d6813322a5a1abd196e644ba8a802d821ab6d3851802d60bfbd50c18480b1`).

### `250` — `One-Arm Kettlebell Swings` (`one-arm-kettlebell-swings`)
- **`DRAFT_TEXT.md` draft & rationale repairs**:
  - Settled a definite floor start in both instructions and cues (`"Set a kettlebell on the floor a short step ahead of your feet in a stance slightly wider than your hips ... and hike the bell back between your thighs"`, `"Start with the bell on the floor a short step ahead of the feet and hike it back between the thighs with a flat back"`, `DRAFT_TEXT.md` lines 209, 217, 219).
  - Aligned the top-of-swing wording between instructions and cues to `"chest to shoulder height, the arm following the hip drive"` (`DRAFT_TEXT.md` lines 210, 217, 219).
  - Marked the free-arm counterbalance and keeping the shoulders square as a coaching choice rather than a photographic fact (`DRAFT_TEXT.md` lines 201, 211).
  - Added parking the bell under control on the floor at the end of the set before changing arms (`"then park the bell under control on the floor ahead of your feet at the end of the set before changing arms"`, `DRAFT_TEXT.md` lines 212, 217, 219).
- **Drawing, captions & tests**:
  - Updated `text`, `captions`, `reason`, and `summary` in `tools/rendering/chain_motion_specs.mjs` (lines 2698–2713) and verified in `MovementPreview.movA15HeldText.test.js` (`drawn 44c93bb925628580d5b6f516ae14229abcaba913f21b7fab6aaeb427d5bc622a`, `captions ed90bd38a6d650d15bd31937c857071d961efabc36d413792e58cda166f7dd59`).

---

## 2. Gate Logs & Decisive Output

1. **`typecheck.log`**:
   - `source commit: 30c655bacb95ad20a869bc8e94a45d29149ef66f`
   - `exit code: 0`
2. **`jest-movement-preview.log`**:
   - `source commit: 30c655bacb95ad20a869bc8e94a45d29149ef66f`
   - `Test Suites: 64 passed, 64 total`
   - `Tests:       3698 passed, 3698 total`
   - `exit code: 0`
3. **`storage-guard.log`**:
   - `source commit: 30c655bacb95ad20a869bc8e94a45d29149ef66f`
   - `"records": 242, "families": 75, "rawBytes": 705266, "gzipBytes": 117030`
   - `"pass": true`
   - `exit code: 0`
4. **`evidence-gate.log`**:
   - `source commit: 30c655bacb95ad20a869bc8e94a45d29149ef66f`
   - `PASS — clean evidence passes and all 19 injected defects are rejected by their own check.`
   - `exit code: 0`
5. **`rendered-output-probe.log`**:
   - `source commit: 30c655bacb95ad20a869bc8e94a45d29149ef66f`
   - `movements measured: 236 (baseline 236)`
   - `added: none`
   - `removed: none`
   - `changed, expected: 153 Box Squat with Bands; 165 Calf Raise On A Dumbbell; 205 Front Barbell Squat To A Bench; 250 One-Arm Kettlebell Swings`
   - `changed, NOT expected: none`
   - `movements with overflow above 1e-6 dp: none`
   - `exit code: 0 (probe run exit 0)`

---

## 3. Visual Verification of Rendered Cycle Strips

- `movement-145/neutral-cycle.png`: `EVIDENCE CAPTURED` — 12-frame cycle strip (`0ms` to `3950ms`) inspected; straddled floor-anchored long-bar row with double handle hooked behind the plates, stationary flat hinged torso, and plates clear of the floor at the bottom and rising to the lower chest at the top.
- `movement-153/neutral-cycle.png`: `EVIDENCE CAPTURED` — 12-frame cycle strip (`0ms` to `3550ms`) inspected; power rack with downward bands from barbell sleeves to rack base, braced trunk, parallel-height box behind the athlete, seated pause with shins approximately vertical and feet planted, and drive back up.
- `movement-165/neutral-cycle.png`: `EVIDENCE CAPTURED` — 12-frame cycle strip (`0ms` to `3700ms`) inspected; flat-bottomed hexagonal dumbbell heads resting flat on the floor with angled side facets and handle slab between them, completely stationary across all frames while the ball of the working foot stays on the handle, the non-working foot stays lifted, both hands hold the stationary support bar, and the working heel lowers into a stretch and rises into full extension.
- `movement-205/neutral-cycle.png`: `EVIDENCE CAPTURED` — 12-frame cycle strip (`0ms` to `2700ms`) inspected; cross-arm front rack inside a squat rack in front of a parallel-height bench, upright torso, knees tracking forward over the toes over a whole foot, and light glute touch on the bench at about thighs parallel before driving right back up.
- `movement-250/neutral-cycle.png`: `EVIDENCE CAPTURED` — 12-frame cycle strip (`0ms` to `1980ms`) inspected; flat-backed hip hinge hiking the kettlebell between the thighs with free arm counterbalancing behind the hip, explosive hip snap to stand tall while the long straight arm follows the hip drive to chest to shoulder height, and late hinge on the downswing.
