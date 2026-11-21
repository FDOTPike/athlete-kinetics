# MOV-R2 Evidence Report — Bar Clearance and Glute-Ham Push (`movement-48-bar-clearance-r2`)

- **Batch:** `MOV-R2`
- **Branch:** `movement/48-bar-clearance-r2-2026-10-18`
- **Base Commit:** `d18242943cd59aebd9483da3bc038b3d72b377af`
- **Source Commit:** `818fc33ecfc1efb7c0a0158bbbb843dbe056d6e9`
- **Movements Repaired (12):** `2`, `46`, `176`, `257`, `78`, `258`, `290`, `98`, `288`, `23`, `202`, `140`

## 1. Renderer Limb and Bar Widths & 3D Bar-Axis Clearance

From `apps/mobile/src/components/movementPreview/canonicalFigure.ts`:
- `CANONICAL_BODY_PARAMETERS.lw = 4.8`
- **Drawn shin half-width:** `(body.lw * 0.9) / 2 = 2.16` units (`bone(k, a, body.lw * 0.9, s)`).
- **Drawn thigh half-width:** `(body.lw * 1.18) / 2 = 2.832` units (`taperedBone(h, k, body.lw * 1.18, body.lw * 0.96, s)`).
- **Drawn bar shaft half-width:** `1.6 / 2 = 0.8` units (`bone(wr, wf, 1.6, 'ink1')`).
- **Minimum non-penetrating 3D axis-to-centreline distances:**
  - Shin: `2.16 + 0.8 = 2.96` units.
  - Thigh: `2.832 + 0.8 = 3.632` units.
- **Maximum close-to-legs surface gap:** `1.5` units (`dShin <= 4.46` while beside shins, `dThigh <= 5.132` while beside thighs).

In `apps/mobile/test/components/MovementPreview.rigidBar.test.js`, every chain movement holding a bar (`implement === 'bar' || implement === 'ez'`, `barAt !== 'elbows'`) is now tested at every `33 ms` tick across the full cycle for `dShin >= 2.96` and `dThigh >= 3.632` on both near and far legs, and movements `[2, 46, 176, 257, 78, 258, 290, 98]` are additionally bound to `<= 1.5` surface units while the bar is beside the legs.

## 2. Per-Movement Repairs

### 2 (`deadlift`), 46 (`deficit-deadlift`), 176 (`deadlift-with-bands`), 257 (`reverse-band-deadlift`)
- Added intermediate knee-passage and mid-thigh waypoints (`unitPhase: true`) so the bar path travels around the shins and thighs without penetration while staying within `1.5` surface units (`dShin` in `[2.96, 4.46]`, `dThigh` in `[3.632, 5.132]`).
- For **Deadlift (`2`)** and **Deficit Deadlift (`46`)**, added an explicit slack-pull preload phase (`ph = 0 -> 0.2`, `0..250 ms`) where the bar remains on the floor at `Y = 9.5` while the hips wedge down (`1.74` units in `2`, `1.62` units in `46`, both `> 1.5`) and the trunk angle rises (`+4.4 deg` in `2`, `+4.6 deg` in `46`, both `> 2.0 deg`) before the plates leave the floor.

### 78 (`sumo-deadlift`), 258 (`reverse-band-sumo-deadlift`), 290 (`sumo-deadlift-with-bands`)
- Replaced the 2-pose linear interpolation with 5 unit-phase poses (`ph = 0, 0.25, 0.5, 0.75, 1.0`) so the bar tracks outside the shins (`dShin` in `[3.00, 4.41]`) and clears the abducted sumo thighs (`dThigh` in `[3.67, 5.10]`) at every `33 ms` tick.

### 98 (`barbell-hack-squat`)
- Replaced the 2-pose linear path with 5 unit-phase poses (`ph = 0, 0.25, 0.5, 0.75, 1.0`) that guide the bar up behind the calves, around the back of the knees, and along the hamstrings (`dShin >= 3.04`, `dThigh >= 3.74`, surface gap `<= 1.5`).

### 288 (`stiff-legged-barbell-deadlift`)
- Set `poses[0]` (`trunk: 82`) and `poses[1]` (`trunk: 5`) with softly bent knees (`159.08 deg` top, `158.95 deg` bottom, `< 0.2 deg` change) and plumb arms (`0.22 deg` from vertical) so the bar clears both shins (`dShin >= 3.19`) and thighs (`dThigh >= 3.85`) throughout the hinge.

### 23 (`nordic-curl`) and 202 (`floor-glute-ham-raise`)
- Configured `armReach: true` with `elbowPole: 135` and pinned the 3D wrist targets at the exact same floor contact coordinates across both `poses[1]` (`ph = 1`, bottom catch at `2600..3100 ms`) and `poses[2]` (`ph = 2`, end of floor push at `3600 ms`): `[75.8158, 2.122]` for `23` and `[77.4085, 2.122]` for `202`.
- Across every `33 ms` tick of the push (`3100..3600 ms`), the painted hand-to-floor gap is `0.000` units (`<= 0.2`) and horizontal hand drift is `0.000` units (`<= 0.3`) while the elbows extend monotonically by `+39.72 deg` (`23`) and `+39.24 deg` (`202`), before leaving the floor to return to tall kneeling (`elbowTop = 134.00 deg <= elbowPush`).

### 140 (`barbell-squat-to-a-bench`)
- Updated `poses[1].kneeOut = 14.8` so the 3D `ankle -> knee` ray direction in the horizontal plane at the bottom bench touch is `22.00 deg`, matching the `22.00 deg` foot yaw (`0.00 deg` difference).
- Updated `apps/mobile/test/components/MovementPreview.movA02OtherSquats.test.js` to compare the `ankle -> knee` ray (alongside the `hipJoint -> knee` ray) against the foot yaw.

## 3. Gate Summary (`818fc33ecfc1efb7c0a0158bbbb843dbe056d6e9`)

- **`typecheck.log`:** `exit code: 0`
- **`jest-movement-preview.log`:** `Test Suites: 64 passed, 64 total`, `Tests: 3732 passed, 3732 total`, `exit code: 0`
- **`storage-guard.log`:** `records: 238, families: 75, rawBytes: 682684, gzipBytes: 112408, pass: true`, `exit code: 0`
- **`evidence-gate.log`:** `PASS — clean evidence passes and all 19 injected defects are rejected by their own check.`, `exit code: 0`
- **`rendered-output-probe.log`:**
  - `movements measured: 232 (baseline 232)`
  - `added: none`
  - `removed: none`
  - `changed, expected: 140 Barbell Squat To A Bench; 98 Barbell Hack Squat; 2 Deadlift; 46 Deficit Deadlift; 176 Deadlift with Bands; 257 Reverse Band Deadlift; 78 Sumo Deadlift; 258 Reverse Band Sumo Deadlift; 290 Sumo Deadlift with Bands; 288 Stiff-Legged Barbell Deadlift; 23 Nordic Curl; 202 Floor Glute-Ham Raise`
  - `changed, NOT expected: none`
  - `movements with overflow above 1e-6 dp: none`
  - `exit code: 0 (probe run exit 0)`
