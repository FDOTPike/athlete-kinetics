# MOV-A03 Report — Floor and Sumo Deadlifts

- **Batch ID:** `MOV-A03`
- **Branch:** `movement/32-deadlifts-2026-10-17`
- **Base Commit:** `cf2f040526c15b7a3d8d48abce59e0a690c0c635`
- **Source Commit:** `06669dd79f9fd6e6b5b2cb1da481bf3a6fd02f1c`
- **Movement IDs:** `2, 46, 176, 257, 78, 258, 290`
- **Status:** `EVIDENCE CAPTURED`

---

## 1. Views Chosen Per Family and Why

1. **Conventional Floor Deadlifts (`2` Deadlift, `46` Deficit Deadlift, `176` Deadlift with Bands, `257` Reverse Band Deadlift) — `view: 'oblique', yawDeg: 24`:**
   - A `24°` turned view preserves `91.4%` (`cos 24°`) of the sagittal hip-hinge, flat back angle (`trunk: 25°` on `2, 176, 257`; `19.5°` on `46`), shin-to-bar proximity, and close vertical bar path while opening `40.7%` (`sin 24°`) of lateral depth so both hip-width feet (`ankleSpanZ = 12.92`), both outside-knee arms (`gripSpanZ = 23.09 > kneeSpanZ = 13.70`), both full-size plates (`plateRadius: CHAIN_FLOOR_PLATE = 8.3`), and twin floor or rack bands are simultaneously visible without collapsing into a single profile line.
   - Paired with `kneePole: 10, kneeOut: 2, shrug: -2.2, upperArm: [-96, 10], forearm: [-96, 10]` at the floor start (`ph = 0`), the near knee (`x = 51.5`) and near wrist (`x = 44.5`) maintain a `7.0`-box-unit horizontal gap so the near arm and near shin never merge on screen.

2. **Sumo Floor Deadlifts (`78` Sumo Deadlift, `258` Reverse Band Sumo Deadlift, `290` Sumo Deadlift with Bands) — `view: 'oblique', yawDeg: 46`:**
   - A `46°` front-plus-side oblique view balances lateral width (`sin 46° = 71.9%`) and sagittal depth (`cos 46° = 69.5%`) so the wide sumo stance (`ankleSpanZ = 32.00`), externally rotated toes (`foot: [0, 38]`), knees pushed out over the toes (`kneeSpanZ = 29.88`, `kneePole: 25, kneeOut: 18`), and straight vertical arms gripping inside the knees (`gripSpanZ = 12.46`) read simultaneously alongside the hip-hinge and bar-to-leg path.
   - In 2D projection at `yawDeg: 46`, the near knee (`x = 39.8`) sits cleanly outside the near hand (`x = 46.3`) and ahead of the near hip (`x = 31.4`), avoiding near-thigh foreshortening while visibly framing both hands between the knees.

---

## 2. Chain Kit Additions (`apps/mobile/src/components/movementPreview/canonicalFigure.ts`)

- **`barAt?: 'hands' | 'elbows' | 'behind' | 'front'` (`lines 1295–1296` and `4783–4785`):**
  ```ts
    implement?: 'none' | 'bells' | 'bell' | 'hammer' | 'bar' | 'ez' | 'cableBar' | 'handle' | 'handles' | 'rope' | 'longBar' | 'kettlebell' | 'kettlebells';
    /** Where a held bar rests on the figure: across the hands by default, cradled in the elbow crooks ('elbows'), held in the hands with its far half behind the legs ('behind'), or held in front of both legs ('front'). */
    barAt?: 'hands' | 'elbows' | 'behind' | 'front';
  ```
  ```ts
        const whole = figure.view === 'front';
        const farGroup = whole || movement.barAt === 'front' ? near : movement.barAt === 'behind' ? groups.behind : far;
        const farTone: ColorRole = whole ? 'textHi' : farColor;
  ```
  - **Why needed:** In an oblique view (`figure.view === 'oblique'`), `layoutChainExtras` previously placed the far half of the barbell shaft into `far`, which renders behind `near` body limbs. For deadlifts, where the barbell travels up the front of both shins and thighs, placing the far half of the shaft in `far` caused the near white thigh and shin to paint over the right half of the bar shaft during the pull and at lockout. Adding `'front'` routes both shaft halves into `near` (while keeping `farTone` and `farAlpha` depth shading on the far half and plate) so a barbell held in front of both legs stays continuously visible across the entire pull.

---

## 3. Failing-First Test Run & Guard Failure Demonstration

### 3.1 First Failing Test Run (Before Authoring)
`apps/mobile/test/components/MovementPreview.movA03Deadlifts.test.js` was written before authoring any of the 7 movements in `CHAIN_MOVEMENTS` or `tools/rendering/chain_motion_specs.mjs`. Running `npx jest test/components/MovementPreview.movA03Deadlifts.test.js --no-coverage` failed all 15 tests:

```text
FAIL test/components/MovementPreview.movA03Deadlifts.test.js
  MOV-A03 floor and sumo deadlifts: batch-wide floor plates, straight arms, head clearance, and family views
    × movement 2 starts and finishes with floor-sized plates touching the floor line, straight arms, and zero head overlap (4 ms)
    × movement 46 starts and finishes with floor-sized plates touching the floor line, straight arms, and zero head overlap (1 ms)
    × movement 176 starts and finishes with floor-sized plates touching the floor line, straight arms, and zero head overlap
    × movement 257 starts and finishes with floor-sized plates touching the floor line, straight arms, and zero head overlap (1 ms)
    × movement 78 starts and finishes with floor-sized plates touching the floor line, straight arms, and zero head overlap
    × movement 258 starts and finishes with floor-sized plates touching the floor line, straight arms, and zero head overlap (1 ms)
    × movement 290 starts and finishes with floor-sized plates touching the floor line, straight arms, and zero head overlap
    × conventional floor deadlifts share one oblique view (24 deg) and sumo floor deadlifts share one front-plus-side oblique view (46 deg) (1 ms)
  MOV-A03 per-movement source-bound geometry
    × 2 Deadlift: bar over mid-foot, shins brought to the bar, flat braced back, bar stays close to legs to standing tall
    × 46 Deficit Deadlift: standing on a low platform with more knee and hip bend, flat back, and longer pull range than Deadlift
    × 176 Deadlift with Bands: bands looped over bar ends and anchored under the feet, grip outside legs, stretching to lockout (1 ms)
    × 257 Reverse Band Deadlift: inside a rack with bands hung from the top to the bar ends, hip-width stance and shoulder-width grip
    × 78 Sumo Deadlift: wide stance with toes pointed out, straight arms gripping inside the knees in 3D and 2D, bar over mid-foot (1 ms)
    × 258 Reverse Band Sumo Deadlift: sumo wide stance and inside-knee grip inside a rack with bands hung from the top (1 ms)
    × 290 Sumo Deadlift with Bands: short bands anchored under wide sumo feet, arms inside legs, stretching to lockout

Test Suites: 1 failed, 1 total
Tests:       15 failed, 15 total
```

### 3.2 Guard Break Verification (After Authoring)
After authoring all 7 movements and verifying green, `plateRadius` on `'deadlift'` (`id 2`) in `apps/mobile/src/components/movementPreview/canonicalFigure.ts` was temporarily changed from `CHAIN_FLOOR_PLATE` (`8.3`) to `4.2`. Re-running `npx jest test/components/MovementPreview.movA03Deadlifts.test.js --no-coverage` immediately caught the violation:

```text
FAIL test/components/MovementPreview.movA03Deadlifts.test.js
  ● MOV-A03 floor and sumo deadlifts: batch-wide floor plates, straight arms, head clearance, and family views › movement 2 starts and finishes with floor-sized plates touching the floor line, straight arms, and zero head overlap

    expect(received).toBe(expected) // Object.is equality

    Expected: 8.3
    Received: 4.2

      53 |     expect(movement.view).toBe('oblique');
      54 |     expect(movement.implement).toBe('bar');
    > 55 |     expect(movement.plateRadius).toBe(CHAIN_FLOOR_PLATE);
         |                                  ^
```

`plateRadius: CHAIN_FLOOR_PLATE` was then restored and `MovementPreview.movA03Deadlifts.test.js` passed `15/15`.

---

## 4. Per-Movement Catalogue Text, Measurements & Source-Bound Geometry

Across all 7 movements (`2, 46, 176, 257, 78, 258, 290`):
- **Floor-Resting Plates (`ph = 0` start and `ph = 0` final keyframe):** `plateRadius = 8.3` (`CHAIN_FLOOR_PLATE`), bar world `Y = 9.500000` (`CHAIN_FLOOR_BAR_HEIGHT`), painted bottom plate edge `Math.max(y1, y2) + w / 2 = 96.900000 = CHAIN_FLOOR` (**`0.000000` box-unit plate-to-floor gap**).
- **Straight Arms (`ph in [0, 0.25, 0.5, 0.75, 1]`):** collinear forward kinematics on upper arm and forearm yields **`180.0°` elbow angle** and `24.500000` (`12.5 + 12.0`) shoulder-to-wrist reach at every phase.
- **Head Clearance (`0..totalMs` at every `33 ms` tick):** zero arm-or-implement bounding-box or segment intersection with the head circle (`r = 5.5`, stroke outer edge `6.2`) across all 7 movements; minimum arm-to-head clearance across the batch exceeds `+9.6` box units.

### 4.1 `2` — `Deadlift` (`deadlift`, `yawDeg: 24`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:1448–1449`):**
  > `"instructions": "Stand with the bar over mid-foot and take a secure grip without rolling it away. Bring the shins to the bar, set the trunk, and pull the slack out before the plates leave the floor. Push the floor away and stand tall with the bar close; if it swings forward, reset the start or reduce the load.",`
  > `"cues": "Pull the slack out first. Push the floor away. Keep the bar close to the legs.",`
- **Key measurements:**
  - `ph = 0` (floor): bar `[0.00, 9.50, 0.00]` over mid-foot (`midFootX = -0.20`, `|barX - midFootX| = 0.20`), hip `[-16.43, 17.85]` above knees (`kneeY = 16.60`, `hipY - kneeY = +1.25`), trunk `25°`, grip span `Z = 23.09` outside knee span `Z = 13.70`.
  - `ph = 1` (standing lockout): bar `[0.85, 35.70, 0.00]` (`+26.20` vertical travel), trunk `89°`, bar stays within `0.17..3.41` units in front of the legs across all phases.

### 4.2 `46` — `Deficit Deadlift` (`deficit-deadlift`, `yawDeg: 24`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:4443–4444`):**
  > `"instructions": "Stand on a plate or low platform, one to three inches, bar over mid-foot. Set up as for a conventional deadlift — the deficit forces more knee and hip bend, so brace before you even reach for the bar. Pull to lockout, fighting hardest through the longer bottom range. Earn a flat back at this depth before loading heavy; the deficit exposes mobility you can hide on a normal pull.",`
  > `"cues": "Earn the extra range with a flat back. Pull the slack out before the bar breaks the floor. Keep the deficit small — three inches is plenty.",`
- **Key measurements:**
  - Platform box `a: [-11.5, 3.5], b: [7.5, 0.5]` (`3.0` units high) elevates the ankles to `Y = 5.52` (`+3.10` units above `2 Deadlift`'s `Y = 2.42`) while the plates rest on the floor line (`96.900000 = CHAIN_FLOOR`, bar `Y = 9.50`).
  - Bar-to-ankle vertical distance at `ph = 0` is `3.98` units vs `7.08` on `2 Deadlift` (`3.10` units lower relative to the feet).
  - Deeper start knee bend (`99.06°` included vs `104.60°` on `2 Deadlift`, **`+5.54°` more knee bend**) and deeper hip bend (`46.96°` included vs `52.10°` on `2 Deadlift`, **`+5.14°` more hip bend**) with a flatter braced trunk (`19.5°` vs `25.0°`).
  - Total vertical pull travel from `ph = 0` (`Y = 9.50`) to `ph = 1` (`Y = 38.80`) is **`29.30` units** (`+3.10` units longer than `2 Deadlift`).

### 4.3 `176` — `Deadlift with Bands` (`deadlift-with-bands`, `yawDeg: 24`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:13232–13233`):**
  > `"instructions": "Loop the bands over the bar and anchor them under the feet or to a secure base, then stand with the bar over the middle of the feet and grip it just outside the legs. Take a breath, bring the shins to the bar with the chest up and the back flat, and drive through the feet to lift the bar. As the bar passes the knees, bring the hips forward to stand tall against the band tension. Lower by pushing the hips back and guiding the bar down the legs to the floor.",`
  > `"cues": "Chest up, back flat. Bar stays against the legs. Stand tall into the bands.",`
- **Key measurements:**
  - Twin bands anchor under the near and far feet (`[0, 1.0, 12]` and `[0, 1.0, -12]`, `2.65` units from ankle landmarks) and loop to the near and far bar ends (`[0, 0, 7]` and `[0, 0, -7]`).
  - 2D rendered band length stretches from **`9.28` box units** at the floor (`ph = 0`) to **`34.98` box units** at lockout (`ph = 1`, `+25.70` box units of band stretch), then returns the plates to `CHAIN_FLOOR` (`96.900000`).

### 4.4 `257` — `Reverse Band Deadlift` (`reverse-band-deadlift`, `yawDeg: 24`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:18667–18668`):**
  > `"instructions": "Inside a rack, hang bands from the top and loop them around the bar, then stand with the bar over the middle of the feet, hip-width apart, and grip it at shoulder width. Take a breath, bring the shins to the bar with the chest up and the back flat, and drive through the feet to lift the bar. As the bar passes the knees, bring the hips forward to stand tall. Lower by pushing the hips back and guiding the bar to the floor.",`
  > `"cues": "Chest up, back flat. Bar stays against the legs. Hips forward to stand tall.",`
- **Key measurements:**
  - `chainPowerRack()` surrounds the lifter (`4` vertical posts + `2` top crossbars at `Y = 95`), and twin overhead bands hang from `[0, 95, 19]` and `[0, 95, -19]` to the near and far bar ends (`[0, 0, 7]` and `[0, 0, -7]`).
  - 2D rendered overhead band length is longest at the floor (**`85.51` box units** at `ph = 0`, where the bands assist most) and shortens to **`59.30` box units** at standing lockout (`ph = 1`, `-26.21` box units).

### 4.5 `78` — `Sumo Deadlift` (`sumo-deadlift`, `yawDeg: 46`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:6609–6610`):**
  > `"instructions": "Stand with a wide stance, toes pointed out, bar over mid-foot. Grip the bar inside your knees with straight arms. Brace, then drive the floor away, keeping the bar against your legs until you stand tall. Push your hips back and bend your knees to return the bar to the floor.",`
  > `"cues": "Knees track over toes. Chest up before you pull. Push the floor apart with your feet.",`
- **Key measurements:**
  - Wide stance `ankleSpanZ = 32.00` (`+19.08` wider than `2 Deadlift`), toes pointed out `38°` (`foot: [0, 38]`), knees pushed out to `kneeSpanZ = 29.88` (`kneePole: 25, kneeOut: 18`).
  - Straight arms (`180.0°` elbow angle) grip inside the knees in both 3D (`gripSpanZ = 12.46 < kneeSpanZ = 29.88`) and 2D projected screen coordinates (`near knee X = 39.8 < near wrist X = 46.3`).

### 4.6 `258` — `Reverse Band Sumo Deadlift` (`reverse-band-sumo-deadlift`, `yawDeg: 46`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:18740–18741`):**
  > `"instructions": "Inside a rack, hang bands from the top and loop them around the bar, then set the feet wide with the bar over the middle of the feet and grip it with the arms inside the legs. Take a breath, lower the hips with the chest up, and drive through the floor, spreading it apart with the feet. As the bar passes the knees, bring the hips to the bar and stand tall. Lower by pushing the hips back and controlling the bar to the floor.",`
  > `"cues": "Chest up, arms straight. Push the knees out over the feet. Hips to the bar to finish.",`
- **Key measurements:**
  - Combines the `78 Sumo Deadlift` wide stance (`ankleSpanZ = 32.00`, toes out `38°`, inside-knee grip `12.46 < 29.88`) with `chainPowerRack()` and twin overhead bands from `[0, 95, 19]` and `[0, 95, -19]` that shorten from **`85.62` box units** at `ph = 0` to **`59.07` box units** at `ph = 1`.

### 4.7 `290` — `Sumo Deadlift with Bands` (`sumo-deadlift-with-bands`, `yawDeg: 46`)
- **Catalogue text (`docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json:20898–20899`):**
  > `"instructions": "Loop short bands over the bar and stand on them, feet set wide with the bar over the middle of the feet, and grip the bar with the arms inside the legs. Take a breath, lower the hips with the chest up, and drive through the floor, spreading it apart with the feet. As the bar passes the knees, bring the hips to the bar and stand tall against the band tension. Lower by pushing the hips back and controlling the bar to the floor.",`
  > `"cues": "Chest up, arms straight. Push the knees out over the feet. Hips to the bar to finish.",`
- **Key measurements:**
  - Combines the `78 Sumo Deadlift` wide stance (`ankleSpanZ = 32.00`, toes out `38°`, inside-knee grip `12.46 < 29.88`) with short floor bands anchored under the wide feet (`[-1.8, 1.0, 16]` and `[-1.8, 1.0, -16]`, `1.42` units from ankle landmarks) that stretch from **`9.48` box units** at `ph = 0` to **`35.42` box units** at `ph = 1`.

---

## 5. Gate Commands Run & Decisive Output

All five gate commands were executed via `batch_gates.sh` against source commit `06669dd79f9fd6e6b5b2cb1da481bf3a6fd02f1c` and recorded in `docs/audits/accessible-coach/movement-completion/evidence/movement-32-deadlifts/`:

1. **`typecheck.log` (`npm run typecheck`):**
   - `> tsc -p apps/mobile/tsconfig.json`
   - `exit code: 0`
2. **`jest-movement-preview.log` (`npx jest --config apps/mobile/jest.config.js --runInBand --no-cache --testPathPattern MovementPreview`):**
   - `PASS apps/mobile/test/components/MovementPreview.movA03Deadlifts.test.js`
   - `Test Suites: 59 passed, 59 total`
   - `Tests:       2929 passed, 2929 total`
   - `exit code: 0`
3. **`storage-guard.log` (`node --expose-gc tools/rendering/verify_preview_storage.mjs`):**
   - `"records": 206, "families": 75, "rawBytes": 599484, "gzipBytes": 99230`
   - `"pass": true`
   - `exit code: 0`
4. **`evidence-gate.log` (`node tools/rendering/test_verify_movement_evidence.mjs`):**
   - `PASS — clean evidence passes and all 19 injected defects are rejected by their own check.`
   - `exit code: 0`
5. **`rendered-output-probe.log` (`rendered-output probe (real MovementPreview, neutral figure, every 33 ms tick) compared with probe-3c7c2a6220ac485bda06625ff13035ecd553b1a4.json`):**
   - `movements measured: 200 (baseline 193)`
   - `added: 2 Deadlift; 46 Deficit Deadlift; 176 Deadlift with Bands; 257 Reverse Band Deadlift; 78 Sumo Deadlift; 258 Reverse Band Sumo Deadlift; 290 Sumo Deadlift with Bands`
   - `removed: none`
   - `changed, expected: none`
   - `changed, NOT expected: none`
   - `movements with overflow above 1e-6 dp: none`
   - `exit code: 0 (probe run exit 0)`

---

## 6. Unresolved Items

- None.
