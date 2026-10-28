# MOV-A03-R1 Report — Floor and Sumo Deadlifts Start-Position Repair

- **Batch ID:** `MOV-A03-R1`
- **Branch:** `movement/32-deadlifts-2026-10-17`
- **Base Commit:** `cf2f040526c15b7a3d8d48abce59e0a690c0c635`
- **Source Commit:** `a981b09f4fbeebdf2a1ffd3ca11dcae08dcf4f2c`
- **Movement IDs:** `2, 46, 176, 257, 78, 258, 290`
- **Status:** `EVIDENCE CAPTURED`

---

## 1. Views Chosen Per Family and Why

1. **Conventional Floor Deadlifts (`2` Deadlift, `46` Deficit Deadlift, `176` Deadlift with Bands, `257` Reverse Band Deadlift) — `view: 'oblique', yawDeg: 24`:**
   - A `24°` turned view preserves `91.4%` (`cos 24°`) of the sagittal hip-hinge, flat back angle (`trunk: 18°` in 3D / `19.58°` in 2D on `2, 176, 257`; `13.5°` in 3D / `14.72°` in 2D on `46`), shin-to-bar proximity (`barToShinWorldX = 1.50` on `2, 176, 257` and `2.37` on `46`), and vertical arm hang (`nk -> wr` angle `8.75°` from vertical, `nArm -> wr` angle `0.11°` from vertical) while opening `40.7%` (`sin 24°`) of lateral depth so both hip-width feet (`ankleSpanZ = 11.20`), both outside-knee arms (`wristSpanZ = 18.68`), both full-size plates (`plateRadius: CHAIN_FLOOR_PLATE = 8.3`), and twin floor or rack bands are simultaneously visible.

2. **Sumo Floor Deadlifts (`78` Sumo Deadlift, `258` Reverse Band Sumo Deadlift, `290` Sumo Deadlift with Bands) — `view: 'oblique', yawDeg: 46`:**
   - A `46°` front-plus-side oblique view balances lateral width (`sin 46° = 71.9%`) and sagittal depth (`cos 46° = 69.5%`) so the wide sumo stance (`ankleSpanZ = 50.00`), externally rotated toes (`foot: [0, 38]`), knees pushed out over the toes (`kneeSpanZ = 27.60`), chest-up start torso (`trunk: 35.3°` in 3D / `45.55°` from horizontal in 2D, `+25.97°` more upright than `2 Deadlift`), and straight vertical arms gripping inside the knees (`wristSpanZ = 7.45`, `nk -> wr` angle `8.50°` from vertical, `nArm -> wr` angle `9.77°` from vertical) read simultaneously alongside the hip-hinge and bar-to-leg path.
   - In 2D projection at `yawDeg: 46`, the near knee (`x = 42.63`) sits cleanly outside the near hand (`x = 46.85`) and ahead of the near hip (`x = 32.14`) and pelvis (`x = 37.03`), framing both hands between the knees while connecting the near thigh through the hip.

---

## 2. Measured Start Values (`poses[0]`, `ph = 0`) for All Seven Movements

All start-keyframe values below were computed directly from `chainGeometry(slug, 0, CANONICAL_BODY_PARAMETERS)` at source commit `a981b09f4fbeebdf2a1ffd3ca11dcae08dcf4f2c` and recorded in `mov-a03-r1-measurements.json`:

| ID | Movement | Trunk Angle from Horizontal (2D / 3D) | Arm Angle from Vertical (`nk->wr` / `nArm->wr`) | Shoulder-to-Bar Distance (`nk[0]-wr[0]` / `nk[0]-barMidX`) | Hip Above Knee (`kn[1]-hp[1]` screen / `hipY-kneeY` 3D) | Shin-to-Bar 3D Distance (`barX-shinX`) | 3D Knee / Hip Included Angles |
|---:|---|---|---|---|---|---|---|
| `2` | `Deadlift` | `19.58°` / `18.00°` | `8.75°` / `0.11°` | `3.77` / `0.20` | `+2.24` / `+2.24` | `1.50` | `91.87°` / `28.59°` |
| `46` | `Deficit Deadlift` | `14.72°` / `13.50°` | `8.75°` / `0.11°` | `3.77` / `0.20` | `+0.81` / `+0.81` | `2.37` | `87.35°` / `23.68°` |
| `176` | `Deadlift with Bands` | `19.58°` / `18.00°` | `8.75°` / `0.11°` | `3.77` / `0.20` | `+2.24` / `+2.24` | `1.50` | `91.87°` / `28.59°` |
| `257` | `Reverse Band Deadlift` | `19.58°` / `18.00°` | `8.75°` / `0.11°` | `3.77` / `0.20` | `+2.24` / `+2.24` | `1.50` | `91.87°` / `28.59°` |
| `78` | `Sumo Deadlift` | `45.55°` / `35.30°` | `8.50°` / `9.77°` | `3.76` / `0.61` | `+0.62` / `+0.62` | `0.20` | `87.66°` / `46.74°` |
| `258` | `Reverse Band Sumo Deadlift` | `45.55°` / `35.30°` | `8.50°` / `9.77°` | `3.76` / `0.61` | `+0.62` / `+0.62` | `0.20` | `87.66°` / `46.74°` |
| `290` | `Sumo Deadlift with Bands` | `45.55°` / `35.30°` | `8.50°` / `9.77°` | `3.76` / `0.61` | `+0.62` / `+0.62` | `0.20` | `87.66°` / `46.74°` |

### Why the Conventional Trunk Angle Is `19.58°` (2D) / `18.00°` (3D)
With the bar resting on the floor at `Y = 9.50` (`CHAIN_FLOOR_BAR_HEIGHT`), `24.50`-unit straight arms (`12.5` upper arm + `12.0` forearm) hanging within `10°` of vertical (`upperArm: [-90.5, -1.4]`, placing the shoulder `Y = 33.99` and `nk[0] - wr[0] = 3.77`), shins brought to the bar (`ankle: [-2.0, 2.16]`, placing `kneeY = 24.30` and `barToShinWorldX = 1.50`), and hips above the knees (`hipY = 26.54 > kneeY = 24.30`, `hipAboveKnee = +2.24`), the `24.0`-unit spine requires `sin(trunk_3D) = (33.99 - 26.54) / 24.0 = 0.3104`, yielding `trunk_3D = 18.00°` (`trunk_2D = 19.58°` at `yawDeg = 24`).

---

## 3. Failing-First Test Run & Guard Break Verification

### 3.1 First Failing Test Run (Before Editing `canonicalFigure.ts`)
Before modifying `apps/mobile/src/components/movementPreview/canonicalFigure.ts`, the `MOV-A03-R1` start-keyframe assertions (arms within `10°` of vertical, `0 <= nk[0] - wr[0] <= 4`, `kn[1] - hp[1] > 0.5`, sumo start trunk `>= 45°` from horizontal and `>= 10°` more upright than conventional, and deficit start deeper knee/hip bend) were added to `apps/mobile/test/components/MovementPreview.movA03Deadlifts.test.js`. Running Jest against the unmodified `MOV-A03` source failed all 8 start-position tests (`mov-a03-r1-test-first-fail.txt`):

```text
FAIL apps/mobile/test/components/MovementPreview.movA03Deadlifts.test.js
  MOV-A03 floor and sumo deadlifts: batch-wide floor plates, straight arms, head clearance, and family views
    × movement 2 starts and finishes with floor-sized plates touching the floor line, straight arms, and zero head overlap (32 ms)
    × movement 46 starts and finishes with floor-sized plates touching the floor line, straight arms, and zero head overlap (23 ms)
    × movement 176 starts and finishes with floor-sized plates touching the floor line, straight arms, and zero head overlap (20 ms)
    × movement 257 starts and finishes with floor-sized plates touching the floor line, straight arms, and zero head overlap (19 ms)
    × movement 78 starts and finishes with floor-sized plates touching the floor line, straight arms, and zero head overlap (20 ms)
    × movement 258 starts and finishes with floor-sized plates touching the floor line, straight arms, and zero head overlap (17 ms)
    × movement 290 starts and finishes with floor-sized plates touching the floor line, straight arms, and zero head overlap (19 ms)
    √ conventional floor deadlifts share one oblique view (24 deg) and sumo floor deadlifts share one front-plus-side oblique view (46 deg) (1 ms)
    × sumo start trunk is at least 45 deg from horizontal and at least 10 deg more upright than conventional start, while deficit start has deeper knee and hip bend (1 ms)

  ● MOV-A03 floor and sumo deadlifts: batch-wide floor plates, straight arms, head clearance, and family views › movement 2 starts and finishes with floor-sized plates touching the floor line, straight arms, and zero head overlap

    expect(received).toBeLessThanOrEqual(expected)

    Expected: <= 10
    Received:    15.847350174208764

      64 |     const armDegNkWr = (Math.abs(Math.atan2(j.nk[0] - j.wr[0], j.wr[1] - j.nk[1])) * 180) / Math.PI;
      65 |     const armDegNear = (Math.abs(Math.atan2(j.nArm[0] - j.wr[0], j.wr[1] - j.nArm[1])) * 180) / Math.PI;
    > 66 |     expect(armDegNkWr).toBeLessThanOrEqual(10);
         |                        ^

  ● MOV-A03 floor and sumo deadlifts: batch-wide floor plates, straight arms, head clearance, and family views › sumo start trunk is at least 45 deg from horizontal and at least 10 deg more upright than conventional start, while deficit start has deeper knee and hip bend

    expect(received).toBeGreaterThanOrEqual(expected)

    Expected: >= 45
    Received:    32.345859403516915

      139 |     for (const id of SUMO_IDS) {
      140 |       const sumoTrunk = trunkAngleFromHorizontal(id);
    > 141 |       expect(sumoTrunk).toBeGreaterThanOrEqual(45);
          |                         ^

Test Suites: 1 failed, 1 total
Tests:       8 failed, 8 passed, 16 total
```

### 3.2 Guard Break Verification (After Repairing `canonicalFigure.ts`)
After repairing all 7 start positions in `canonicalFigure.ts`, `trunk` on `sumo-deadlift` (`id 78`) `poses[0]` was temporarily reverted from `35.3` to `24`. Re-running `MovementPreview.movA03Deadlifts.test.js` caught the violation (`mov-a03-r1-guard-break.txt`):

```text
  ● MOV-A03 floor and sumo deadlifts: batch-wide floor plates, straight arms, head clearance, and family views › sumo start trunk is at least 45 deg from horizontal and at least 10 deg more upright than conventional start, while deficit start has deeper knee and hip bend

    expect(received).toBeGreaterThanOrEqual(expected)

    Expected: >= 45
    Received:    32.657104433197226

      139 |     for (const id of SUMO_IDS) {
      140 |       const sumoTrunk = trunkAngleFromHorizontal(id);
    > 141 |       expect(sumoTrunk).toBeGreaterThanOrEqual(45);
          |                         ^

Test Suites: 1 failed, 1 total
Tests:       2 failed, 14 passed, 16 total
```

Restoring `trunk: 35.3` returned `MovementPreview.movA03Deadlifts.test.js` to `16 passed, 16 total`.

---

## 4. Gate Commands Run & Decisive Output

All five gate commands were executed via `batch_gates.sh` against source commit `a981b09f4fbeebdf2a1ffd3ca11dcae08dcf4f2c` and recorded in `docs/audits/accessible-coach/movement-completion/evidence/movement-32-deadlifts-r1/`:

1. **`typecheck.log` (`npm run typecheck`):**
   - `> tsc -p apps/mobile/tsconfig.json`
   - `exit code: 0`
2. **`jest-movement-preview.log` (`npx jest --config apps/mobile/jest.config.js --runInBand --no-cache --testPathPattern MovementPreview`):**
   - `Test Suites: 59 passed, 59 total`
   - `Tests:       2930 passed, 2930 total`
   - `exit code: 0`
3. **`storage-guard.log` (`node --expose-gc tools/rendering/verify_preview_storage.mjs`):**
   - `"records": 206, "families": 75, "rawBytes": 599468, "gzipBytes": 99208`
   - `"pass": true`
   - `exit code: 0`
4. **`evidence-gate.log` (`node tools/rendering/test_verify_movement_evidence.mjs`):**
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

## 5. Unresolved Items

- None.
