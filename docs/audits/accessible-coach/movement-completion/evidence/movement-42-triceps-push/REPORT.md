# MOV-A12 Verification Evidence Report (`movement-42-triceps-push`)

- **Batch**: `MOV-A12`
- **Branch**: `movement/45-triceps-push-2026-10-18`
- **Base Commit**: `5df157f97546a6b5db0fa9c5ebb8e55a096b77e4`
- **Source Commit**: `7022cb94bd4c3df0d366393633179835fc164b86`
- **Baseline Probe**: `C:/Users/fpike/Documents/Claude Coding/Athlete App/.claude/worktrees/builder-scratch/probe-fc3fcf3ce0eee1cbf916188e3b13f377d9a66f08.json`
- **Movements Authored**: `91, 242, 215, 233, 177, 47, 170, 166` (`allowedChanged: []`)

---

## 1. Summary of Authored Movements and Measured Geometry

| ID | Name | View (`yawDeg`) | Implement & Equipment | Key Geometric & Timing Measurements |
| --- | --- | --- | --- | --- |
| `91` | Lying Dumbbell Triceps Extension | `oblique` (`22°`) | `hammer` dumbbells on flat bench (`top = 22.0`) | Upper arms frozen at `104°` (`14°` past vertical toward head, elbow drift `0.00` across all ticks); forearms hinge `104° -> 236°` (`3D` elbow angle `180.00° -> 48.00°`); bottom wrists beside ears (`\|wr.x - hd.x\| = 0.07`, `\|wr.y - hd.y\| = 1.98`, `\|wr.z\| = 9.384`); `1300 ms` lower vs `900 ms` press (`2200 ms` cycle). |
| `242` | Lying Triceps Press | `oblique` (`22°`) | `ez` bar on flat bench (`top = 22.0`) | Rigid grip span `18.77` (`maxSpanDrift = 0.00`); tucked elbows fixed at `90.00°` (`z = ±9.384`, drift `0.00`); forearms hinge `90° -> 195°` (`3D` elbow angle `180.00° -> 75.00°`), stopping `2.11` units above the forehead (`wr.y = 35.75`, `9.48` units higher than `91`); `3D` head clearance `>= 9.75` (`>= 7.0`); `1300 ms` lower vs `900 ms` press (`2200 ms` cycle). |
| `215` | Incline Barbell Triceps Extension | `oblique` (`18°`) | `bar` on `128°` incline bench | Rigid narrower-than-shoulder grip `16.81 < 18.77` (`maxSpanDrift = 0.00`); upper arms frozen in line with torso (`[128, -4.5]`, `6.08` units from head, drift `0.00`); forearms lower behind head to `[222, -4.5]` (`3D` elbow angle `180.00° -> 86.09°`, `wr.x = 22.25 < hd.x - hr - 5`, `3D` head clearance `>= 14.72`); `1400 ms` lower, `800 ms` extend, `550 ms` overhead pause (`2750 ms` cycle). |
| `233` | Kneeling Cable Triceps Extension | `oblique` (`18°`) | `cableBar` from high pulley `[8, 78]` + flat bench (`x = 60..79, top = 24.5`) | Kneeling facing away (`knees at x = 14, y = 2.01`); head and backs of upper arms resting on bench (`sh.y - armRadius = 24.66`, `el.y - armRadius = 24.66`, elbow drift `0.00`); narrow grip (`15.73` units, `maxSpanDrift = 0.00`); extends from `[104, -7]` (`77.09°`) to `[0, -7]` (`180.00°` level with floor, cable `+13.71` units, `3D` head clearance `>= 12.20`); `800 ms` extend, `550 ms` pause, `1400 ms` slow return (`2750 ms` cycle). |
| `177` | Decline Close-Grip Bench To Skull Crusher | `oblique` (`18°`) | `bar` on `-20°` decline bench + ankle roller | Rigid narrower-than-shoulder grip (`16.81 < 18.77`, `maxSpanDrift = 0.00`); cycle `[1, 0, 1, 2, 1]` alternates one close-grip press to lower chest (`upperArm [-15, -4.5], forearm [115, -4.5]`, elbow travel `21.57` units) and one stationary-upper-arm skull crusher toward forehead (`upperArm [105, -4.5], forearm [222, -4.5]`, elbow drift `0.00` throughout `t >= 1700 ms`, `3.55` units from forehead, `3D` head clearance `>= 8.00`); `[1000, 700, 1000, 700] ms` (`3400 ms` cycle). |
| `47` | Dip | `oblique` (`28°`) | Parallel bars (`y = 46, z = ±9.384`) | Hands planted on parallel bars (`wrist drift = 0.00`, `wr.y - HAND_HALF = 48.00`), feet suspended (`ankle.y >= 16.57`); top lockout has straight arms (`3D` elbow angle `175.87° >= 172°`) and packed shoulders (`shrug = 0`); lowers body `12.01` units until upper arms are horizontal (`\|sh.y - el.y\| = 0.00`, `3D` elbow angle `88.38°`); `[600, 600, 450, 450] ms` (`2100 ms` cycle). |
| `170` | Close-Grip Push-Up off of a Dumbbell | `oblique` (`24°`) | Vertical end-standing dumbbell (`x = 72.5..79.5, top = 9.6`) | Both hands placed together on top of standing dumbbell (`grip span = 3.60 <= 5.0`, `wr.y - HAND_HALF = 9.60`, wrist/toe drift `0.00`); rigid straight body line (`knee angle = 180.00°`, `hip-to-spine angle = 180.00°` at every tick); top straight arms (`174.90° >= 172°`), bottom lowers chest `11.17` units with elbows tucked (`\|el.z\| = 9.48 <= 10.88`, `3D` elbow angle `57.28°`); `[600, 600, 450, 450] ms` (`2100 ms` cycle). |
| `166` | Clock Push-Up | `oblique` (`32°`) | Floor bodyweight (`cycle: true`) | Shoulder-width hands (`span = 18.77`), rigid straight body line (`180.00°` knee and hip-to-spine at every tick); lowers chest `10.75` units (`520 ms`, `3D` elbow angle `65.98°`), pushes up fast (`320 ms`) so both hands leave floor (`wr.y = 8.40` vs `2.35`), lands a short step to one side (`8.85` units, body yaw turns `16.00°`) with soft bent elbows (`3D` elbow angle `126.13°`), resets to straight arms (`175.30° >= 172°`), and hops back (`2740 ms` cycle). |

---

## 2. Gate Execution Summary (`7022cb94bd4c3df0d366393633179835fc164b86`)

- `typecheck.log`: `exit code: 0` (`EVIDENCE CAPTURED`)
- `jest-movement-preview.log`: `Test Suites: 63 passed, 63 total`, `Tests: 3618 passed, 3618 total`, `exit code: 0` (`EVIDENCE CAPTURED`)
- `storage-guard.log`: `records: 237`, `families: 75`, `rawBytes: 688122`, `gzipBytes: 113469`, `pass: true`, `exit code: 0` (`EVIDENCE CAPTURED`)
- `evidence-gate.log`: `PASS — clean evidence passes and all 19 injected defects are rejected by their own check.`, `exit code: 0` (`EVIDENCE CAPTURED`)
- `rendered-output-probe.log`:
  - `movements measured: 231 (baseline 223)`
  - `added: 91 Lying Dumbbell Triceps Extension; 242 Lying Triceps Press; 215 Incline Barbell Triceps Extension; 233 Kneeling Cable Triceps Extension; 177 Decline Close-Grip Bench To Skull Crusher; 47 Dip; 170 Close-Grip Push-Up off of a Dumbbell; 166 Clock Push-Up`
  - `removed: none`
  - `changed, expected: none`
  - `changed, NOT expected: none`
  - `movements with overflow above 1e-6 dp: none`
  - `exit code: 0 (probe run exit 0)` (`EVIDENCE CAPTURED`)
