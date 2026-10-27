# MOV-A02-R2 Evidence Report: Bench-Squat Painted Contact & Barbell Hack Squat Bar Layering

## Scope

- **Batch:** `MOV-A02-R2`
- **Branch:** `movement/33-hinges-2026-10-17`
- **Base commit:** `76d47fffea7e8ecb80a1f0201cf1821398fae5e2`
- **Source commit:** `8b9082b978a09b2c98db7f4a38ad1fb64dcbea85`
- **Movements inspected / updated:**
  - `140` — **Barbell Squat To A Bench** (`barbell-squat-to-a-bench`)
  - `192` — **Dumbbell Squat To A Bench** (`dumbbell-squat-to-a-bench`)
  - `98` — **Barbell Hack Squat** (`barbell-hack-squat`)

---

## 1. Painted Gap Between Hips/Thighs and Bench (`140` & `192`)

Both `140` (`Barbell Squat To A Bench`) and `192` (`Dumbbell Squat To A Bench`) state in their catalogue `source.instructions`:
- `140`: `"Place a flat bench behind you, take the bar from the rack across the upper back and stand with the feet shoulder-width apart and toes turned slightly out. Bend the knees and sit the hips back, chest up, until you lightly touch the bench. Drive through the feet to stand back up without resting on the bench."`
- `192`: `"Stand in front of a flat bench with a dumbbell in each hand at your sides, feet shoulder-width apart and toes turned slightly out. Bend the knees and sit the hips back, chest up, until you lightly touch the bench. Push through the feet to stand back up without resting on the bench."`

In `MovementPreview.movA02OtherSquats.test.js`, `expectPaintedBenchContact(entry)` measures the actual primitives returned by `layoutCanonicalFigure(bottomFrame.joints, { ...entry, body: BODY })` at the bottom keyframe (`ph = 1`):

| Movement | Painted Bench Top (`y`, screen / world) | Painted Hip Underside (`y = thigh.y1 + thigh.w / 2`) | **Painted Gap (Hips to Bench Top)** | Painted Thigh Underside at Bench Front Edge (`x = 44.1519`) | **Painted Gap (Thigh at Bench Edge to Bench Top)** | Lowest Painted Thigh Underside (`Math.max(y1, y2) + w / 2`) | **Minimum Thigh Gap to Bench Top** | Drawing Changed? |
|---|---|---|---|---|---|---|---|---|
| `140` Barbell Squat To A Bench (near / far) | `76.7000` / `20.2000` (`x in [20.5165, 44.1519]`) | `76.5320` (`73.7000 + 2.8320`) | **`0.1680` u** | `76.5673` (near) / `76.5486` (far) | **`0.1327` u** (near) / **`0.1514` u** (far) | `76.6522` | **`0.0478` u** | **No** |
| `192` Dumbbell Squat To A Bench (near / far) | `76.7000` / `20.2000` (`x in [20.5165, 44.1519]`) | `76.5320` (`73.7000 + 2.8320`) | **`0.1680` u** | `76.5673` (near) / `76.5486` (far) | **`0.1327` u** (near) / **`0.1514` u** (far) | `76.6522` | **`0.0478` u** | **No** |

Both `140` and `192` already touch within the `0.5`-unit bound (`0.1680 u <= 0.5 u` at the hips, `0.1327 u <= 0.5 u` at the bench front edge, `0.0478 u <= 0.5 u` at the lowest thigh point) and do not penetrate (`gap >= 0`), so neither bench-squat drawing changed.

---

## 2. `barAt: 'behind'` Split at the Near Hold (`98 Barbell Hack Squat`)

In `canonicalFigure.ts` (`layoutChainExtras`, lines `5055–5061`), when `movement.barAt === 'behind'`, the near half of the barbell shaft is now split at the near hold (`q = project(barNear)`):
- `mid -> q` (`[56.4672, 87.4] -> [51.6044, 87.4]`) is pushed to `groups.behind` (painted at primitive index `1`, before `farThighIdx = 5` and `nearShinIdx = 45`).
- `q -> nearEnd` (`[51.6044, 87.4] -> [42.6044, 87.4]`, outside the near leg) is pushed to `near` (painted at primitive index `52`, after `nearShinIdx = 45`).

### Movements Using `barAt: 'behind'`

Across the entire `CHAIN_MOVEMENTS` table and `movementPreviewManifest.json`:
- **`98` Barbell Hack Squat (`barbell-hack-squat`)** is the **only** movement that uses `barAt: 'behind'`.
- **Did its drawing change?** **Yes** (`drawnSha256` updated to `df09477deb9718b7e50e5dfe8ed9048dd0fdaa766f314f27b074e07411dadc6c`; `captionSha256` unchanged at `b02aee67082836f69d640dcd1eee7586a641c687399589ff2b1e39a50b7ed06e`).
- **Did any other movement change?** **No** (`rendered-output-probe.log` verified `changed, expected: 98 Barbell Hack Squat` and `changed, NOT expected: none` across all 209 measured movements).

---

## 3. Verification Gates (`batch_gates.sh` on `8b9082b978a09b2c98db7f4a38ad1fb64dcbea85`)

- `typecheck.log`: `exit code: 0`
- `jest-movement-preview.log`: `Test Suites: 60 passed, 60 total`, `Tests:       3061 passed, 3061 total`, `exit code: 0`
- `storage-guard.log`: `"pass": true`, `exit code: 0`
- `evidence-gate.log`: `PASS — clean evidence passes and all 19 injected defects are rejected by their own check.`, `exit code: 0`
- `rendered-output-probe.log`: `movements measured: 209 (baseline 209)`, `added: none`, `removed: none`, `changed, expected: 98 Barbell Hack Squat`, `changed, NOT expected: none`, `movements with overflow above 1e-6 dp: none`, `exit code: 0 (probe run exit 0)`
