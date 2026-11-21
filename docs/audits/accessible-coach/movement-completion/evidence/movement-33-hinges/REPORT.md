# MOV-A04 Report — Hinges and the Posterior Chain

- **Batch ID:** `MOV-A04`
- **Branch:** `movement/33-hinges-2026-10-17`
- **Base Commit:** `f7e3906b33164978dbe7ab5b570a115b632b86af`
- **Source Commit:** `edbd5418b4fcf83944f36a3499dbd3bf00c441d2`
- **Movement IDs:** `288, 61, 210, 271, 94, 35, 23, 202, 244`
- **Status:** `EVIDENCE CAPTURED`

---

## 1. Views Chosen Per Family and Why

1. **`288` Stiff-Legged Barbell Deadlift — `view: 'oblique', yawDeg: 20`:**
   - A `20°` turned view preserves `94.0%` (`cos 20°`) of the sagittal hip hinge, fixed soft knee angle (`154.00°`), straight spine, and plumb bar path down to the top of the feet while opening `34.2%` (`sin 20°`) of lateral depth so the narrower stance (`footSpread: 1.6`), overhand barbell grip, and both plates are simultaneously visible in front of the legs (`barAt: 'front'`).
2. **`61` Good Morning, `210` Good Morning off Pins, `271` Seated Good Mornings — `view: 'oblique', yawDeg: 14`:**
   - A `14°` turned view preserves `97.0%` (`cos 14°`) of the sagittal hip hinge, neutral/arched spine, rack upright alignment, and horizontal safety-pin height (`Y = 47.00` on `210`; `Y = 32.20` on `271`) while opening `24.2%` (`sin 14°`) of lateral depth so the barbell across the upper back, both plates, both rack uprights, and both safety pins read clearly without collapsing into end-on dots.
3. **`94` Single-Leg Romanian Deadlift — `view: 'oblique', yawDeg: 18`:**
   - An `18°` turned view separates the near hand holding the kettlebell (`hold Z = +10.24`) from the opposite standing leg (`far ankle Z = -6.80`) while preserving `95.1%` (`cos 18°`) of the sagittal counterweight line so the near-parallel torso (`8.41°`), near-parallel reaching back leg (`8.00°`), square pelvis (`roll = 0°`), and plumb kettlebell (`0.00°` from vertical at the bottom) all read together.
4. **`35` Barbell Hip Thrust — `view: 'oblique', yawDeg: -12`:**
   - A `-12°` turned view keeps `97.8%` (`cos 12°`) of the sagittal tabletop alignment (`neck Y = 24.41`, `hip Y = 24.41`, `knee Y = 24.41` at lockout) and vertical shins (`knee X = 22.25 = ankle X = 22.25`) while angling the barbell shaft so the central pad (`barPad: true`), near plate, and near forearm sit cleanly in front of the hip crease without occluding the upper arm or bench.
5. **`23` Nordic Curl, `202` Floor Glute-Ham Raise, `244` Natural Glute Ham Raise — `view: 'side'` (`yawDeg: 0`):**
   - Pure sagittal side view (`0°`) directly displays the `180.00°` straight line from knees through hips to shoulders, the equipment distinction between `23` (low floor pad `knee Y = 6.80` + floor ankle roller `[11.5, 9.6]`) and `202`/`244` (elevated Nordic bench `knee Y = 10.50` + dual foot rollers), the depth progression across the three (`158.00°` -> `165.00°` -> `174.00°` 3D knee angle), and the hand-catch versus rear-band assistance (`lines: [{ from: [4, 56], to: 'nearGrip' }]` on `244`).

---

## 2. Chain Kit Additions (`apps/mobile/src/components/movementPreview/canonicalFigure.ts`)

- **`barPad?: boolean` (`lines 1299–1300` and `5057–5060`):**
  ```ts
    /** Whether a held barbell wears a thick pad around the middle of its shaft (as in a Barbell Hip Thrust). */
    barPad?: boolean;
  ```
  ```ts
        if (movement.barPad === true) {
          const padHalf = Math.min(3.2, length * 0.36);
          near.push({ ...line([mid[0] - ux * padHalf, mid[1] - uy * padHalf], [mid[0] + ux * padHalf, mid[1] + uy * padHalf], 4.2, 'textMid', 1), stroke: 'ink1', strokeWidth: 0.6 });
        }
  ```
  - **Why needed:** `35 Barbell Hip Thrust` specifies `"Sit on the floor with your upper back against a bench and a padded bar over your hips."` Adding `barPad?: boolean` draws a padded sleeve around the midpoint of the barbell shaft over the hip crease.

---

## 3. Failing-First Test Run & Guard Failure Demonstration

### 3.1 First Failing Test Run (Before Authoring)
`apps/mobile/test/components/MovementPreview.movA04Hinges.test.js` was written before authoring the 9 movements in `canonicalFigure.ts` or `chain_motion_specs.mjs`. Running `npx jest --runInBand test/components/MovementPreview.movA04Hinges.test.js` failed all 14 tests (`mov-a04-test-first-fail.txt`):

```text
FAIL test/components/MovementPreview.movA04Hinges.test.js
  MOV-A04 hinges and posterior chain: physics, joint angles, contacts, and family distinctions
    × movement 288 is authored as pending with at least 5 frames and zero head-implement collision across every 33 ms tick (3 ms)
    × movement 61 is authored as pending with at least 5 frames and zero head-implement collision across every 33 ms tick
    × movement 210 is authored as pending with at least 5 frames and zero head-implement collision across every 33 ms tick (1 ms)
    × movement 271 is authored as pending with at least 5 frames and zero head-implement collision across every 33 ms tick
    × movement 94 is authored as pending with at least 5 frames and zero head-implement collision across every 33 ms tick (1 ms)
    × movement 35 is authored as pending with at least 5 frames and zero head-implement collision across every 33 ms tick
    × movement 23 is authored as pending with at least 5 frames and zero head-implement collision across every 33 ms tick
    × movement 202 is authored as pending with at least 5 frames and zero head-implement collision across every 33 ms tick
    × movement 244 is authored as pending with at least 5 frames and zero head-implement collision across every 33 ms tick (1 ms)
    × 288 Stiff-Legged Barbell Deadlift starts standing, keeps the slight knee angle fixed throughout, pushes hips back over the base of support, and lowers the bar on plumb arms toward the top of the feet
    × 61 Good Morning, 210 Good Morning off Pins, and 271 Seated Good Mornings each satisfy their setup, rack/pin contact, and hip-hinge bounds (1 ms)
    × 94 Single-Leg Romanian Deadlift holds the kettlebell opposite the standing leg, hangs the bell plumb under the shoulder, keeps hips square, and extends the free leg straight back to near parallel
    × 35 Barbell Hip Thrust pivots the upper back on the bench, carries a padded bar over the hips, and finishes in a level tabletop with vertical shins and a full-beat pause (1 ms)
    × 23 Nordic Curl, 202 Floor Glute-Ham Raise, and 244 Natural Glute Ham Raise hold one straight knee-to-shoulder line, lower more than twice as slowly as they return, and show their distinct equipment, depth, and catch mechanics

Test Suites: 1 failed, 1 total
Tests:       14 failed, 14 total
```

### 3.2 Guard Break Verification (After Authoring)
After authoring all 9 movements, `barPad` on `'barbell-hip-thrust'` (`id 35`) in `apps/mobile/src/components/movementPreview/canonicalFigure.ts` was temporarily changed from `true` to `false`. Re-running `npx jest --runInBand test/components/MovementPreview.movA04Hinges.test.js` caught the violation (`mov-a04-guard-break.txt`):

```text
  ● MOV-A04 hinges and posterior chain: physics, joint angles, contacts, and family distinctions › 35 Barbell Hip Thrust pivots the upper back on the bench, carries a padded bar over the hips, and finishes in a level tabletop with vertical shins and a full-beat pause

    expect(received).toBe(expected) // Object.is equality

    Expected: true
    Received: false

      191 |     const top = rig.chainGeometry(slug, 1, BODY);
      192 |
    > 193 |     expect(top.movement.barPad).toBe(true);
          |                                 ^

Test Suites: 1 failed, 1 total
Tests:       1 failed, 13 passed, 14 total
```

`barPad: true` was then restored and `MovementPreview.movA04Hinges.test.js` passed `14/14`.

---

## 4. Per-Movement Catalogue Text, Start/End Measured Values & Physics Checks

### 4.1 `288` — `Stiff-Legged Barbell Deadlift` (`stiff-legged-barbell-deadlift`, `view: 'oblique', yawDeg: 20`)
- **Catalogue text (`ALL_300_MOTION_MAP.json:20763–20764`):**
  > `"instructions": "Stand tall holding a barbell with an overhand grip, feet shoulder-width apart or a little narrower and the knees slightly bent. Keeping the knees at that angle and the back straight, push the hips back to lower the bar toward the top of the feet until you feel a stretch in the hamstrings. Bring the hips forward to stand tall again.",`
  > `"cues": "Back straight, knees softly bent. Hips back, bar close to the legs. Stand tall with the hips.",`
- **Measured start (`ph = 0`) and end (`ph = 1`) values:**
  - `ph = 0` (standing start): `trunkDeg2D = 89.06°`, `kneeDeg3D = 154.00°`, `elbowDeg3D = 180.00°`, `armFromVerticalDeg2D = 2.05°`, `curled = false`, `hip = [0.00, 45.52, 0.00]`, `neck = [0.42, 69.52, 0.00]`, `nearKnee = [5.01, 23.84, 6.80]`, planted `nearAnkle = [0.00, 2.16, 6.80]`, `nearToe = [5.40, 2.16, 6.80]`, `nearHold = [2.12, 45.17, 11.52]` (bar starts standing at hip height `Y = 45.17`, not on the floor), `comMidpointX = 1.06` (inside foot `[0.00, 5.40]`).
  - `ph = 1` (hinged bottom): `trunkDeg2D = -4.26°`, `kneeDeg3D = 154.00°` (`0.00°` change across all ticks), `elbowDeg3D = 180.00°`, `armFromVerticalDeg2D = 3.12°` (`<= 10°` plumb), `curled = false`, `hip = [-18.32, 41.46, 0.00]` (`-18.32` units backward travel), `nearKnee = [-4.63, 23.92, 6.80]`, planted `nearAnkle = [0.00, 2.16, 6.80]` (`0.00` drift), `nearHold = [3.48, 15.49, 11.52]` (bar lowered well below knees toward the top of the feet, directly over the foot `[0.00, 5.40]` at `X = 3.48`).

### 4.2 `61` — `Good Morning` (`good-morning`, `view: 'oblique', yawDeg: 14`)
- **Catalogue text (`ALL_300_MOTION_MAP.json:5466–5467`):**
  > `"instructions": "Set the bar across the upper back as for a squat. Soften the knees and send the hips back until the hamstrings are loaded while the trunk stays long. Drive the hips through to stand tall along the same path. If the bar rolls or the trunk softens, shorten the range or reduce the load before the next rep.",`
  > `"cues": "Push the hips straight back. Flat back the whole rep. Feel the hamstrings load — they bring you back up.",`
- **Measured start (`ph = 0`) and end (`ph = 1`) values:**
  - `ph = 0` (standing start): `trunkDeg2D = 88.06°`, `kneeDeg3D = 156.00°`, `curled = false`, `hip = [4.00, 45.69, 0.00]`, `neck = [4.84, 69.67, 0.00]`, `nearHold = [2.85, 70.14, 16.56]` (bar across upper back), planted `nearAnkle = [4.00, 2.16, 6.80]`, `nearToe = [9.40, 2.16, 6.80]`, `comMidpointX = 3.43`.
  - `ph = 1` (hinged bottom): `trunkDeg2D = 14.41°`, `kneeDeg3D = 156.00°`, `curled = false`, `hip = [-12.31, 42.52, 0.00]` (`-16.31` units backward hip travel), `neck = [10.98, 48.32, 0.00]`, `nearHold = [10.88, 50.36, 16.56]`, planted `nearAnkle = [4.00, 2.16, 6.80]` (`0.00` drift), `comMidpointX = -0.71` (hips counterbalance the forward-hinged upper back and bar across the planted foot).

### 4.3 `210` — `Good Morning off Pins` (`good-morning-off-pins`, `view: 'oblique', yawDeg: 14`)
- **Catalogue text (`ALL_300_MOTION_MAP.json:15508–15509`):**
  > `"instructions": "Set the bar on the pins at about stomach height, bend over under it so it sits across the back of the shoulders, with the torso near level with the floor, the back tight and the knees slightly bent. Drive the hips forward to stand up with the bar. Push the hips back to lower the bar slowly to the pins and let it settle before the next repetition.",`
  > `"cues": "Back tight, shoulder blades pinched. Drive the hips forward. Lower slowly to the pins.",`
- **Measured start (`ph = 0`) and end (`ph = 1`) values:**
  - `ph = 0` (bent-over start under bar on stomach-height pins at `Y = 47.00`): `trunkDeg2D = 8.24°` (`<= 15°` near level), `kneeDeg3D = 156.00°`, `curled = false`, `hip = [-14.31, 42.52, 0.00]`, `neck = [9.46, 45.86, 0.00]`, `nearHold = [9.57, 47.89, 16.56]` (bar shaft radius `0.8` rests directly on top of the horizontal safety pins at `Y = 47.00`, `|47.89 - 47.00| = 0.89`), planted `nearAnkle = [2.00, 2.16, 6.80]`, `nearToe = [7.40, 2.16, 6.80]`.
  - `ph = 1` (standing tall): `trunkDeg2D = 88.06°`, `kneeDeg3D = 156.00°`, `curled = false`, `hip = [2.00, 45.69, 0.00]` (`+16.31` units forward hip drive), `neck = [2.84, 69.67, 0.00]`, `nearHold = [0.85, 70.14, 16.56]`, `comMidpointX = 1.43`; `segments = [1200, 350, 1900, 750]` (`1900 ms` slow lowering `> 1200 ms` ascent, plus `750 ms` settle on the pins).

### 4.4 `271` — `Seated Good Mornings` (`seated-good-mornings`, `view: 'oblique', yawDeg: 14`)
- **Catalogue text (`ALL_300_MOTION_MAP.json:19612–19613`):**
  > `"instructions": "Set a bench inside a power rack and set the pins at the depth you intend to reach. Take the bar across the back of the shoulders, squeeze the shoulder blades together, step back and sit down on the bench. Keeping the bar tight and the lower back arched, bend forward at the hips until the bar approaches the pins. Pause just above the pins and reverse the motion until the torso is upright.",`
  > `"cues": "Set the pins before the first rep. Move at the hips with the back arched. Pause just above the pins each rep.",`
- **Measured start (`ph = 0`) and end (`ph = 1`) values:**
  - `ph = 0` (seated upright on bench `Y = 24.41` inside rack with pins at `Y = 32.20`): `trunkDeg2D = 86.12°`, `curl = -8°` (arched lower back), `kneeDeg3D = 90.00°`, `hip = [-6.00, 24.41, 0.00]`, `neck = [-7.67, 48.33, 0.00]`, `nearHold = [-9.71, 48.44, 16.56]`, planted `nearAnkle = [15.91, 2.16, 10.66]`, `nearToe = [21.31, 2.16, 10.66]`.
  - `ph = 1` (hinged forward, pausing just above the pins): `trunkDeg2D = 29.74°`, `curl = -10°` (arched lower back), `kneeDeg3D = 90.00°`, `hip = [-6.00, 24.41, 0.00]` (`0.00` hip drift on bench), `nearAnkle = [15.91, 2.16, 10.66]` (`0.00` foot drift), `nearHold = [14.17, 37.91, 16.56]` (`5.71` units above the safety pins at `Y = 32.20`, leaving a `1.51`-unit gap below the `4.2`-radius barbell plate so it pauses just above the pins for `650 ms` without touching them).

### 4.5 `94` — `Single-Leg Romanian Deadlift` (`single-leg-romanian-deadlift`, `view: 'oblique', yawDeg: 18`)
- **Catalogue text (`ALL_300_MOTION_MAP.json:7689–7690`):**
  > `"instructions": "Hold a kettlebell in one hand and stand on the opposite leg. Hinge forward, letting the free leg travel straight back as a counterweight, until your torso and back leg are near parallel with the floor. Drive the hips through to stand tall. Wobbling is part of the exercise — every save is your ankle and hip learning their job.",`
  > `"cues": "Hips stay square, back leg reaches long. Bell hangs plumb under the shoulder. Slow beats far — shorten the hinge before you lose it.",`
- **Measured start (`ph = 0`) and end (`ph = 1`) values:**
  - `ph = 0` (standing on opposite far leg, kettlebell in near hand): `trunkDeg2D = 88.10°`, `farKneeDeg3D = 160.00°` (soft standing knee), `elbowDeg3D = 180.00°`, `armFromVerticalDeg2D = 1.28°`, `roll = 0°` (hips square), planted `farAnkle = [2.00, 2.16, -6.80]`, `farToe = [7.40, 2.16, -6.80]`, unloaded `nearAnkle = [-4.02, 3.32, 6.80]`, `nearToe = [2.16, 3.32, 6.80]`, `nearHold = [3.69, 45.50, 10.24]` (kettlebell on `+Z` side opposite the `-Z` standing leg), `comMidpointX = 2.85` (over standing foot `[2.00, 7.40]`).
  - `ph = 1` (hinged bottom, torso and back leg near parallel): `trunkDeg2D = 8.41°` (`<= 15°`), reaching back leg angle `8.00°` from horizontal (`<= 15°`), `kneeDeg3D = 180.00°` (free leg reaches long to `nearAnkle = [-49.63, 38.83, 6.80]`), `farKneeDeg3D = 156.00°` (slight bend in standing knee), `roll = 0°` (hips square), `armFromVerticalDeg2D = 0.00°` (bell hangs plumb under shoulder at `nearHold = [18.21, 23.87, 9.38]` beneath `neck = [18.21, 48.37, 0.00]`), planted `farAnkle = [2.00, 2.16, -6.80]` (`0.00` drift), `comMidpointX = 6.32` (inside standing foot `[2.00, 7.40]`).

### 4.6 `35` — `Barbell Hip Thrust` (`barbell-hip-thrust`, `view: 'oblique', yawDeg: -12`)
- **Catalogue text (`ALL_300_MOTION_MAP.json:3693–3694`):**
  > `"instructions": "Sit on the floor with your upper back against a bench and a padded bar over your hips. Plant your feet about hip-width, heels under your knees. Drive through your heels until your thighs and torso are level with the floor — finish flat like a tabletop, because any height past neutral comes from the lower back, not the glutes. Lower your hips under control and repeat.",`
  > `"cues": "Tuck the pelvis and pause a full beat at the top. One straight line knee-to-shoulder, core braced in neutral. Drive through the heels, shins vertical.",`
- **Measured start (`ph = 0`) and end (`ph = 1`) values:**
  - `ph = 0` (bottom, hips lowered under control, upper back on bench): `trunkDeg2D = 34.59°`, `kneeDeg3D = 65.09°`, `hipLineSagittalDeg = 110.19°`, `neck = [-19.90, 24.41, 0.00]` (supported on bench), `hip = [0.00, 10.99, 0.00]`, `nearKnee = [18.04, 24.01, 6.80]`, planted `nearAnkle = [22.25, 2.16, 6.80]`, `nearToe = [27.65, 2.16, 6.80]`, `nearHold = [0.61, 17.17, 16.95]` (padded bar `barPad = true` over the hip crease).
  - `ph = 1` (top tabletop lockout): `trunkDeg2D = 0.00°`, `kneeDeg3D = 90.00°`, `hipLineSagittalDeg = 180.00°` (one straight line knee-to-shoulder), `neck = [-24.00, 24.41, 0.00]`, `hip = [0.00, 24.41, 0.00]`, `nearKnee = [22.25, 24.41, 6.80]` (`neck Y = hip Y = knee Y = 24.41`, flat tabletop), planted `nearAnkle = [22.25, 2.16, 6.80]` (`knee X = ankle X = 22.25`, vertical shins), `nearHold = [-2.94, 29.88, 16.95]` (padded bar over hips), `segments = [1150, 1000, 1450, 450]` (`1000 ms` full-beat top pause).

### 4.7 `23` — `Nordic Curl` (`nordic-curl`, `view: 'side'`)
- **Catalogue text (`ALL_300_MOTION_MAP.json:2892–2893`):**
  > `"instructions": "Kneel on a soft pad and secure the ankles beneath an anchor that cannot move. Hold one line from knees to head with the hips extended, then lower that line as slowly as possible. Catch with the hands and use only enough push to return; if the hips fold first, shorten the lowering range.",`
  > `"cues": "Hold the hips extended. Own the lowering phase. Use the hands for a smooth return.",`
- **Measured start (`ph = 0`) and end (`ph = 1`) values:**
  - `ph = 0` (tall kneeling on low floor pad `box [27, 0.6]..[38, 4.2]`, ankles under floor roller `[11.5, 9.6]`): `trunkDeg2D = 90.00°`, `kneeDeg3D = 90.00°`, `hipLineSagittalDeg = 180.00°`, `nearKnee = [32.25, 6.80, 6.80]`, `nearAnkle = [10.00, 6.80, 6.80]`, `nearToe = [13.02, 2.32, 6.80]`, `hip = [32.25, 29.05, 0.00]`, `neck = [32.25, 53.05, 0.00]`, `nearWrist = [49.12, 38.62, 9.38]`.
  - `ph = 1` (lowered straight line, push-up catch on floor): `trunkDeg2D = 22.00°`, `kneeDeg3D = 158.00°`, `hipLineSagittalDeg = 180.00°` (hips remain extended `180.00°` at every tick), `elbowDeg3D = 116.00°` (bent push-up catch), `nearKnee = [32.25, 6.80, 6.80]`, `nearAnkle = [10.00, 6.80, 6.80]`, `nearWrist = [77.04, 3.43, 9.38]` (catching on the floor); `segments = [2750, 350, 1350, 450]` (`2750 ms` lowering `> 2 * 1350 ms` return).

### 4.8 `202` — `Floor Glute-Ham Raise` (`floor-glute-ham-raise`, `view: 'side'`)
- **Catalogue text (`ALL_300_MOTION_MAP.json:14977–14978`):**
  > `"instructions": "Kneel tall in a Nordic bench with the ankles locked under the foot pads, hips and shoulders in one line. Lower yourself forward by extending at the knees, keeping the hips straight rather than folding. Bring the hands to the floor to catch, then push lightly off the floor to help yourself back up.",`
  > `"cues": "Keep the hips in line with the shoulders. Lower as slowly as you control. Let the hands catch and assist the return.",`
- **Measured start (`ph = 0`) and end (`ph = 1`) values:**
  - `ph = 0` (tall kneeling in elevated Nordic bench `slab Y = 7.6`, dual foot rollers `[11.5, 13.2]` and `[8.2, 7.5]`): `trunkDeg2D = 90.00°`, `kneeDeg3D = 90.00°`, `hipLineSagittalDeg = 180.00°`, `nearKnee = [32.25, 10.50, 6.80]` (`+3.70` units higher than `23 Nordic Curl`), `nearAnkle = [10.00, 10.50, 6.80]`, `nearToe = [10.00, 5.10, 6.80]`, `hip = [32.25, 32.75, 0.00]`, `neck = [32.25, 56.75, 0.00]`.
  - `ph = 1` (deeper knee extension, light floor catch): `trunkDeg2D = 15.00°`, `kneeDeg3D = 165.00°` (`+7.00°` more knee extension than `23 Nordic Curl`), `hipLineSagittalDeg = 180.00°`, `elbowDeg3D = 149.50°` (`+33.50°` longer-arm light catch from the elevated bench than `23`), `nearWrist = [89.77, 2.63, 9.38]`; `segments = [2750, 350, 1350, 450]`.

### 4.9 `244` — `Natural Glute Ham Raise` (`natural-glute-ham-raise`, `view: 'side'`)
- **Catalogue text (`ALL_300_MOTION_MAP.json:17773–17774`):**
  > `"instructions": "Set up in a Nordic bench with the ankles locked under the foot pads and a band anchored to assist the return. Start upright with good posture, then lower yourself under control until the knees are almost straight. Reverse the movement and pull yourself back to upright, letting the band assist only as much as you need.",`
  > `"cues": "Keep the hips in line with the shoulders. Lower as slowly as you control. Let the band assist the reversal.",`
- **Measured start (`ph = 0`) and end (`ph = 1`) values:**
  - `ph = 0` (upright in elevated Nordic bench holding band anchored behind at `[4, 56]`): `trunkDeg2D = 90.00°`, `kneeDeg3D = 90.00°`, `hipLineSagittalDeg = 180.00°`, `nearKnee = [36.25, 10.50, 6.80]`, `nearAnkle = [14.00, 10.50, 6.80]`, `hip = [36.25, 32.75, 0.00]`, `neck = [36.25, 56.75, 0.00]`, `nearWrist = [36.66, 56.46, 9.38]` (holding band at upper chest, band length `32.66` units).
  - `ph = 1` (lowered until knees are almost straight, band-assisted without touching floor): `trunkDeg2D = 6.00°`, `kneeDeg3D = 174.00°` (`+9.00°` straighter than `202 Floor Glute-Ham Raise`, almost straight), `hipLineSagittalDeg = 180.00°`, `nearWrist = [82.00, 14.90, 9.38]` (`14.90` units above the floor, holding the stretched band at `88.24` units); `segments = [2750, 350, 1350, 450]`.

---

## 5. Gate Commands Run & Decisive Output

All five gate commands were executed via `batch_gates.sh` against source commit `edbd5418b4fcf83944f36a3499dbd3bf00c441d2` and recorded in `docs/audits/accessible-coach/movement-completion/evidence/movement-33-hinges/`:

1. **`typecheck.log` (`npm run typecheck`):**
   - `> tsc -p apps/mobile/tsconfig.json`
   - `exit code: 0`
2. **`jest-movement-preview.log` (`npx jest --config apps/mobile/jest.config.js --runInBand --no-cache --testPathPattern MovementPreview`):**
   - `PASS apps/mobile/test/components/MovementPreview.movA04Hinges.test.js`
   - `Test Suites: 60 passed, 60 total`
   - `Tests:       3061 passed, 3061 total`
   - `exit code: 0`
3. **`storage-guard.log` (`node --expose-gc tools/rendering/verify_preview_storage.mjs`):**
   - `"records": 215, "families": 75, "rawBytes": 623654, "gzipBytes": 103310`
   - `"pass": true`
   - `exit code: 0`
4. **`evidence-gate.log` (`node tools/rendering/test_verify_movement_evidence.mjs`):**
   - `PASS — clean evidence passes and all 19 injected defects are rejected by their own check.`
   - `exit code: 0`
5. **`rendered-output-probe.log` (`rendered-output probe (real MovementPreview, neutral figure, every 33 ms tick) compared with probe-a981b09f4fbeebdf2a1ffd3ca11dcae08dcf4f2c.json`):**
   - `movements measured: 209 (baseline 200)`
   - `added: 288 Stiff-Legged Barbell Deadlift; 61 Good Morning; 210 Good Morning off Pins; 271 Seated Good Mornings; 94 Single-Leg Romanian Deadlift; 35 Barbell Hip Thrust; 23 Nordic Curl; 202 Floor Glute-Ham Raise; 244 Natural Glute Ham Raise`
   - `removed: none`
   - `changed, expected: none`
   - `changed, NOT expected: none`
   - `movements with overflow above 1e-6 dp: none`
   - `exit code: 0 (probe run exit 0)`

---

## 6. Unresolved Items

- None.
