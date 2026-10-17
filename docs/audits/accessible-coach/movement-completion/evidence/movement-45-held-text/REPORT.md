# MOV-A15 Builder Evidence Report — Five Movements on a Source Hold (`145`, `153`, `165`, `205`, `250`)

- **Work order**: `MOV-A15`
- **Branch**: `movement/50-held-text-2026-10-18` (branched from `181dc051da6744c9bb6975f25a6961dce429165d`)
- **Source commit**: `90c3838817662169dcfbea15e12ca8694181c198`
- **Baseline probe**: `probe-c9d0f25faf35617b4189e385a839819751249205.json` (`231` measured movements; `236` measured after adding the `5` held-text movements)
- **Batch IDs**: `145`, `153`, `165`, `205`, `250` (`allowedChanged`: `[]`)
- **Status**: `EVIDENCE CAPTURED`

---

## 1. Summary of Draft Authority & Authored Movements

All five movements (`145`, `153`, `165`, `205`, `250`) have their source-bound draft descriptions (`instructions`, `cues`, and `coachingIntent`) recorded in `docs/audits/accessible-coach/movement-completion/evidence/movement-45-held-text/DRAFT_TEXT.md` from the public-domain `free-exercise-db` entries and their photographs, resolving every hold reason and marking as **a choice** anything the source does not settle. The catalogue entries in `ALL_300_MOTION_MAP.json` and `apps/mobile/src/data/movements.json` are not modified. Each movement's preview entry carries `status: "pending"` and explicitly states in `text.basis` and `reason` that its text is a draft written from `free-exercise-db` and its photographs, awaiting the owner, while the catalogue's own text is a placeholder on a source hold.

| ID | Movement | Slug | View (`yawDeg`) | Cycle (`segments`) | Key Measured Geometry & Draft Bounds |
|---:|---|---|---|---|---|
| `145` | `Bent Over Two-Arm Long Bar Row` | `bent-over-two-arm-long-bar-row` | `oblique` (`28°`) | `3950 ms` (`[950, 1000, 1500, 500]`) | `implement: 'longBar'`, `barAnchor: [-20, 1.5]` in corner/pivot bracket, straddled stance (`ankle z = ±8.30`), flat uncurled spine held stationary at `24.00°` above horizontal across all ticks (`0.000` hip/neck drift), fixed knee bend `124.98°`, rigid `5.00`-unit 3D double-handle grip span (`palmYaw: 90`, `farPalmYaw: 90`), straight arms at bottom (`172.89°`, plates clear of floor) pulling to `90.85°` at top (`wrist y` from `26.80` to `36.63` at lower chest) with `1000 ms` top hold and `1500 ms` controlled lower. |
| `153` | `Box Squat with Bands` | `box-squat-with-bands` | `oblique` (`30°`) | `3550 ms` (`[1400, 550, 1150, 450]`) | `implement: 'bar'` inside power rack frame, two downward band lines from `nearBarEnd` and `farBarEnd` to rack base floor anchors `[-4, 1.2, ±16.5]`, parallel-height box at `y = 20.200` behind the athlete, hips sit back from `[1.8, 45.620]` to `[-16.8, 23.032]` so painted thigh bottom lands flush on box top at `y = 20.200`, shins vertical (`85.59°` from horizontal, knee angle `79.08°`), `550 ms` seated pause without bounce, then drive up through the heels (`1150 ms`). |
| `165` | `Calf Raise On A Dumbbell` | `calf-raise-on-a-dumbbell` | `oblique` (`28°`) | `3700 ms` (`[950, 1000, 1300, 450]`) | `root: 'toe'` at `[0, 6.568]` so painted sole bottom (`y = 4.600`) rests on top of the floor dumbbell handle (`slab` at `y = 2.6`, top `y = 4.600`) between vertical dumbbell heads, both hands on sturdy support bar at `x = 14, y = 64.212`, non-working foot lifted clear of floor (`farToe y = 9.491`), working knee straight (`180.00°`), working ankle rises from `y = 4.372` in stretch (`foot: 24°`) to `y = 10.319` in full extension (`foot: -44°`), `1000 ms` top hold, `1300 ms` controlled lower. |
| `205` | `Front Barbell Squat To A Bench` | `front-barbell-squat-to-a-bench` | `oblique` (`28°`) | `2700 ms` (`[750, 750, 600, 600]`) | `implement: 'bar'` in cross-arm front rack across front shoulders (`upperArm: [9, -28]`, `+8.00°` above horizontal at top, forearms crossed `[-168, -42]`), upright straight back (`trunk: 89°` to `72°`), knees track forward in line with toes (`knee x = 9.69 > toe x = 5.40`, knee angle `65.23°`), painted glute/thigh bottom touches flat bench (`y = 20.200`) at phase `1` (`at: [-10.8, 23.032]`, painted bottom `y = 20.200`) and immediately drives back up through the heels (`phases: [0, 0.5, 1, 0.5, 0]`, no seated hold). |
| `250` | `One-Arm Kettlebell Swings` | `one-arm-kettlebell-swings` | `oblique` (`28°`) | `1980 ms` (`[480, 500, 520, 480]`) | `implement: 'kettlebell'` in one hand (`palmYaw: 180`), stance wider than hips (`footSpread: 3.6`), flat-backed bottom hip hinge (`trunk: 30.00°`) hiking bell between upper thighs (`wrist y = 32.92`) with free arm back (`farWrist x = -9.48`), hip snap drives trunk to `78.00°` at phase `1` and `90.00°` at phase `2` (`topKneeDeg = 177.12°`) while straight working arm (`elbow = 180.00°`) swings bell on a circular arc (`R² = 0.9969`) to shoulder height (`wrist y = 71.35` vs `shoulder y = 70.50`), staying tall on the downswing until the hand passes the thighs before hinging into the next repetition. |

---

## 2. Gate Execution Summary (`90c3838817662169dcfbea15e12ca8694181c198`)

- **`typecheck.log`**:
  - `source commit: 90c3838817662169dcfbea15e12ca8694181c198`
  - `exit code: 0`
- **`jest-movement-preview.log`**:
  - `source commit: 90c3838817662169dcfbea15e12ca8694181c198`
  - `Test Suites: 64 passed, 64 total`
  - `Tests:       3698 passed, 3698 total`
  - `exit code: 0`
- **`storage-guard.log`**:
  - `source commit: 90c3838817662169dcfbea15e12ca8694181c198`
  - `"records": 242, "families": 75, "rawBytes": 703927, "gzipBytes": 116733`
  - `"largestFamily": { "file": "hip-hinge__standing.json", "rawBytes": 63217 }`
  - `"pass": true`
  - `exit code: 0`
- **`evidence-gate.log`**:
  - `source commit: 90c3838817662169dcfbea15e12ca8694181c198`
  - `PASS — clean evidence passes and all 19 injected defects are rejected by their own check.`
  - `exit code: 0`
- **`rendered-output-probe.log`**:
  - `source commit: 90c3838817662169dcfbea15e12ca8694181c198`
  - `movements measured: 236 (baseline 231)`
  - `added: 145 Bent Over Two-Arm Long Bar Row; 153 Box Squat with Bands; 165 Calf Raise On A Dumbbell; 205 Front Barbell Squat To A Bench; 250 One-Arm Kettlebell Swings`
  - `removed: none`
  - `changed, expected: none`
  - `changed, NOT expected: none`
  - `movements with overflow above 1e-6 dp: none`
  - `exit code: 0 (probe run exit 0)`

---

## 3. What Was Not Verified

- `NOT VERIFIED — native device runtime rendering and 4 GB physical phone frame-timing / peak memory`: All checks in this worktree run in Node/Jest and headless Chromium via `batch_gates.sh`; physical device rendering on a 4 GB Android handset was not executed.
- `NOT VERIFIED — owner sign-off on the five draft descriptions and marked choices in DRAFT_TEXT.md`: Each movement remains `status: "pending"` with its draft text awaiting owner review, and the catalogue entries remain untouched.

Signed: builder
