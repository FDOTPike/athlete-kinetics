# MOV-A14 Evidence Report — Trunk, Pullovers, Flyes, and Kettlebell Skills (`33, 137, 119, 204, 149, 289, 148, 201, 217, 121, 231`)

- **Batch:** `MOV-A14`
- **Branch:** `movement/47-trunk-pullover-flye-skills-2026-10-18`
- **Base commit:** `07e5eb9f817e0ba0ce4817c7ff1bb317bf446105`
- **Source commits:**
  - `c30d88f593280cf7b34c3399fa16b13c6b9df65c` (trunk and pullovers: `33, 137, 119, 204, 149, 289, 148`)
  - `41244ac5de5ba795b06110689c7a5b8d9f30328b` (flyes, kettlebell skills, and tests: `201, 217, 121, 231`)
  - `8a01e41ef2eb1136041c59d02c4c5740d2efcada` (refinement of `119` temple hands and `204` frog leg splay/crossed arms)
  - `ae2415a5d4c8008a9418f7dce93bfe20affed7ad` (adjustment of `121` standing rack hip height to `46.50` so thigh and shin keep exact `22.25` length at `174.21°` knee lockout)
- **Evidence folder:** `docs/audits/accessible-coach/movement-completion/evidence/movement-44-trunk-pullover-flye-skills`
- **Status:** `EVIDENCE CAPTURED` for all 11 movements (`33, 137, 119, 204, 149, 289, 148, 201, 217, 121, 231`); `NOT VERIFIED — owner visual sign-off pending (`techniqueReview.status = "pending"`)`

---

## 1. What I Did

1. Wrote `apps/mobile/test/components/MovementPreview.movA14TrunkPulloverFlyeSkills.test.js` first and watched all 12 tests fail against the un-authored baseline (`Tests: 12 failed, 12 total`).
2. Authored the 11 movements in `apps/mobile/src/components/movementPreview/canonicalFigure.ts` (`CHAIN_MOVEMENTS`, lines 5476–5836) and `tools/rendering/chain_motion_specs.mjs` (lines 2627–2808), rebuilt `apps/mobile/src/components/movementPreview/movementPreviewManifest.json`, `apps/mobile/src/components/movementPreview/previewIndex.json`, and 7 family split files under `apps/mobile/src/components/movementPreview/families/`, and updated `apps/mobile/test/components/MovementPreview.layout.test.js` (`241` canonicals) and `apps/mobile/test/components/MovementPreview.approval.test.js`. No new kit fields were needed.
3. Ran `batch_gates.sh` on committed source `ae2415a5d4c8008a9418f7dce93bfe20affed7ad` and inspected all 11 rendered `neutral-cycle.png` sheets.

---

## 2. Views Chosen and Measured Values Bound by Source Text

| ID | Movement | View & Yaw | Measured Values Bound by Source Text |
| --- | --- | --- | --- |
| `33` | Barbell Ab Rollout | `oblique`, `14°` (`originX: 48`) | Knees stay on the floor (`y = 2.842`, `x = -40.25`) across every tick; small-plate barbell (`r = 4.2`) rolls forward on `FLOOR = 96.9` (`wrist[1] = 5.45`, forward wrist travel `+27.63 > 26`); 3D hand-to-hand distance `15.86` constant across every tick; 3D elbow angle `180.00° >= 172°`; hips never sag below the knee-to-shoulder line (`hip[1] >= lineY + 1.0`, `curl: 12°..16°`). |
| `137` | Barbell Rollout from Bench | `oblique`, `14°` (`originX: 52`) | Knees elevated on `chainFlatBench(-46, -18, 9.0)` at `y = 11.842` (`+9.000` units above `33`); barbell rolls on `FLOOR = 96.9` ahead of the bench end (`wrist[0]: -5.29 -> +19.52`, forward travel `+24.81 > 22`); 3D hand-to-hand distance `15.86` constant across every tick; 3D elbow angle `180.00° >= 172°`; hip extends by `+38.28° > 25°` without sagging below the knee-to-shoulder line. |
| `119` | Decline Crunch | `side` | Legs secured under the ankle roller of `chainDeclineBench`; fingertips stay beside the temples (`dist(near.grip, head) = 6.35 < 9.6` on every tick); `spine: 'upper'` anchors the lower back (`spine[0..12]`) to the decline pad (`0.000000` drift across every tick) while the upper spine curls `0° -> 58°` (shortening neck-to-hip distance by `3.74` units), holds `450 ms` at the top, and unrolls slowly (`1300 ms` vs `900 ms` curl). |
| `204` | Frog Sit-Ups | `oblique`, `38°` (`originX: 48`) | Oblique `38°` view with `kneePole: [52, 64]` shows the frog-leg diamond: soles together at the midline (`|near.ankle[2] - far.ankle[2]| = 3.20 <= 3.6`, `|near.toe[2] - far.toe[2]| = 0.22 <= 1.5`) while knees drop wide out to the sides (`near.knee[2] - far.knee[2] = 30.80 > 30`, projected separation `|kn[0] - kf[0]| = 20.60 > 15`); arms crossed over the chest; lower back (`spine[0..12]`) stays flat on the floor (`y = 3.500`, `0.000000` drift); short upper-spine curl (`40°`, neck rise `+8.35` units) with `450 ms` top pause and `1300 ms` slow lower. |
| `149` | Bent-Arm Dumbbell Pullover | `oblique`, `18°` (`originX: 54`) | Lies perpendicular across `chainFlatBench(-24, -10, 18.0)` with only the shoulders on the pad (`neck = [-17.0, 21.50]`), hips low ahead of the bench (`hip = [10.69, 13.78] < neck[1] - 5`), and feet flat on the floor (`ankle[1] = 2.160`); both hands together under one dumbbell (`dist(near.hold, far.hold) = 1.15 < 3.5`); 3D elbow bend stays fixed at `132.56°` (`0.000000°` variation) as the bell arcs behind the head (`wrist[0] = -35.60`) and returns. |
| `289` | Straight-Arm Dumbbell Pullover | `oblique`, `18°` (`originX: 54`) | Same perpendicular cross-bench setup as `149` (`neck = [-17.0, 21.50]`, `hip = [10.69, 13.78]`, `ankle[1] = 2.160`, `dist(near.hold, far.hold) = 0.65 < 3.5`); 3D elbow angle stays straight at `180.00° >= 172°` across every tick through a wider arc behind the head (`wrist[0] = -39.14`, `3.54` units wider than `149`). |
| `148` | Bent-Arm Barbell Pullover | `oblique`, `18°` (`originX: 54`) | Lies lengthwise along `chainFlatBench(-20, 12, 18.0)` with both shoulders and hips supported level on the pad (`hip[1] = neck[1] = 21.50`, `+7.72` units higher than `149`'s dropped hip); holds a shoulder-width rigid barbell (`implement: 'bar'`, 3D hand-to-hand distance `16.39` constant across every tick) with a fixed `132.16°` elbow bend (`0.000000°` variation), arcing behind the head (`wrist[0] = -32.26 < head[0] - 6`, bar midpoint clearance from head `>= 7.51 > 5.5`) and pausing `450 ms` over the chest. |
| `201` | Flat Bench Cable Flyes | `oblique`, `42°` (`originX: 52`) | Flat bench (`hip[1] = neck[1] = 21.50`) centered between two chest-aligned low pulleys (`[-16, 4.5, ±32]`); starts wide (`grip Z span = 66.26 > 55`) with a constant `156.00°` soft elbow bend, sweeps hands together above the chest (`grip Z span = 1.00 < 8`, `grip[1] = 45.23`), pauses `450 ms` at the top, and opens slowly (`1500 ms` vs `1000 ms` close); each 3D cable length strictly increases across every tick of the working closing half (`20.48 -> 49.69`, `+29.21` units). |
| `217` | Incline Cable Flye | `oblique`, `42°` (`originX: 52`) | `35°` incline bench (`trunk: 145°`, `neck[1] - hip[1] = 13.77 > 12`) centered between two low pulleys (`[-13.66, 4.5, ±32]`); starts with hands together above the face (`grip Z span = 1.00 < 8`, `grip[1] - head[1] = 19.31 > 15`), opens wide slowly (`1500 ms` vs `1000 ms` close) to `grip Z span = 66.26 > 55` with a constant `156.00°` elbow bend, closes along the same arc with cables strictly lengthening (`20.48 -> 49.69`), and pauses `450 ms` at the top. |
| `121` | Kettlebell Dead Clean | `oblique`, `28°` (`originX: 50`) | Starts hinged over the kettlebell on the floor between the ankles (`kettlebell.body[1] = 4.66 < 5.0`, `|shoulder[0] - grip[0]| = 0.48 < 2.5`), zips close up the body (`max |body[0] - x0| = 1.87 < 3.5` across all ticks as the elbow pulls back at mid-pull) into a standing front rack (`standing 3D knee angle = 174.21° >= 172°`, `elbow[1] = 44.87 < wrist[1] - 8`), and reverses to a dead stop between the feet. |
| `231` | Kettlebell Turkish Get-Up (Lunge style) | `oblique`, `24°` (`originX: 48`) | 5 chain poses and 7 keyframes (`phases: [0, 1, 2, 4, 2, 1, 0]`) rising from supine (`hip[1] = 3.50`, near knee bent, far leg straight) -> forearm/hand prop (`neck[1] = 27.85`) -> half-kneeling lunge (`far.knee[1] = 3.64 < 4.0`) -> standing tall (`hip[1] = 47.15`, both knees `176.00° >= 172°`) and reversing step-by-step to the floor; working kettlebell arm stays locked at `180.00° >= 172°` and vertical directly over the shoulder (`|wrist[0] - shoulder[0]| = 0.00`, `|wrist[2] - shoulder[2]| = 0.00`, `wrist[1] - shoulder[1] = 24.50`) across every tick. |

---

## 3. Gate Outputs (Quoted from Evidence Logs)

- `typecheck.log`:
  `source commit: ae2415a5d4c8008a9418f7dce93bfe20affed7ad`
  `exit code: 0`
- `jest-movement-preview.log`:
  `Test Suites: 64 passed, 64 total`
  `Tests:       3811 passed, 3811 total`
  `exit code: 0`
- `storage-guard.log`:
  `split 249 entries into 75 family files`
  `all preview data 725879 B raw (budget 1048576), 121310 B gzip (budget 196608)`
  `deep-equality self-check passed; every budget holds`
  `exit code: 0`
- `evidence-gate.log`:
  `movement evidence verification passed (249 movements, 0 failed)`
  `exit code: 0`
- `rendered-output-probe.log`:
  `added: 33 Barbell Ab Rollout; 137 Barbell Rollout from Bench; 119 Decline Crunch; 204 Frog Sit-Ups; 149 Bent-Arm Dumbbell Pullover; 289 Straight-Arm Dumbbell Pullover; 148 Bent-Arm Barbell Pullover; 201 Flat Bench Cable Flyes; 217 Incline Cable Flye; 121 Kettlebell Dead Clean; 231 Kettlebell Turkish Get-Up (Lunge style)`
  `removed: none`
  `changed, NOT expected: none`
  `movements with overflow above 1e-6 dp: none`
  `exit code: 0 (probe run exit 0)`
