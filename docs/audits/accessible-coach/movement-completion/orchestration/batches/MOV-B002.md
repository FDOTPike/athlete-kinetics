**Batch:** MOV-B002  **Type:** REPAIR (frame guard and stage clipping)

**Baseline:** the accepted MOV-B001 commit (SHA supplied when this is sent). Not to be started before MOV-B001 is accepted.

**Source of findings:** `PRE_DISPATCH_FRAME_FIT_REVIEW_a1a073f6.md` and its raw measurements in `evidence/a1a073f6-frame-fit/` on branch `claude/movement-orchestration-2026-10-05`.

**Defects:**
1. Fifteen movements are clipped by the stage (`overflow: 'hidden'`, `MovementPreview.tsx:706-709`). Neutral figure, full cycle, in dp:
   - Dumbbell Floor Press, Alternating Floor Press, Extended Range One-Arm Kettlebell Floor Press: left 8.448 at 0 ms.
   - Dumbbell Bench Press: left 6.256 at 0 ms.
   - 3/4 Sit-Up, Cable Seated Crunch, Cross-Body Crunch, Janda Sit-Up, Oblique Crunches: left 3.028 at 0 ms.
   - Stiff Leg Barbell Good Morning: left 1.313 at 1485 ms.
   - Chest-Supported Dumbbell Row: left 0.464 at 0 ms.
   - Cable Rope Overhead Triceps Extension, Cable One Arm Tricep Extension, Dumbbell Tricep Extension Pronated Grip, Standing Overhead Barbell Triceps Extension: bottom 0.459 at 0 ms.
2. `MovementPreview.canonicalFrameFit.test.js:168-184` and `:281-287` allow that clipping through `TRACKED_RESIDUALS`.
3. The negative controls at `:141-165` compare constants and stay green when the frame is really shortened.
4. Only Dumbbell Reverse Lunge has a frame guard. The all-entries test at `:186-292` never renders the component, re-implements renderer geometry, samples five times per cycle, and skips the three derived movements.
5. `MovementPreview.fixedBarBodyMotion.test.js:20` turns the whole suite into `describe.skip` while Inverted Row and the fixed-bar triceps press are absent.

**Owned files:** `MovementPreview.canonicalFrameFit.test.js`; `MovementPreview.fixedBarBodyMotion.test.js`; the source data for the fifteen movements (`movementPreviewManifest.json` and the family files, regenerated with the existing authoring tools, never hand-edited generated output alone); `MovementPreview.tsx` only if a diagnosed renderer cause requires it.

**Excluded:** every other movement's data; joint positions of the fifteen unless the diagnosis shows the pose, not the framing, is wrong; existing files under `acceptance-evidence/`; the joint-limits checker and scanner.

**Required change:**
- Diagnose each clipped group (view box too small, pose outside the stage, or renderer) and repair the cause. Report the diagnosis per group. A wider view box changes scale: state the before and after scale and confirm the figure is still centred and the floor still spans the card.
- Remove every clipping allowance. One enclosure function, epsilon 1e-6 dp, used for the whole stage, the real rounded painted bounds and the full floor thickness (top plus height).
- Run that function through the real rendered component for every canonical and derived movement, neutral figure, at every 33 ms tick of the full cycle. Derive the list from the manifest; no pinned counts.
- Negative controls must apply a real mutation (the original short frame, and a frame 24 dp shorter) and show the same enclosure function fail. Use a test-only override or module mock; do not leave a mutation in source.
- The fixed-bar suite must not go green by skipping. Until those two movements exist, record them as explicit `test.todo` items that the reply reports as not implemented.

**Acceptance criteria:** typecheck exit 0; full `MovementPreview` jest pattern exit 0 with skipped and todo counts stated; my probe re-run on your commit measures zero overflow for all movements; both real mutations make the guard fail.

**Evidence path:** `acceptance-evidence/gemini/frame-fit-b002/`, logs from the committed tree only, each naming its commit. Mark `auditor-probe-output.txt` and the three identical `probe-runtime-*.txt` files in `frame-fit-remediation/` as invalid in a short note beside them; do not delete or alter them.

**Required reply** to `claude`, subject starting `MOV-B002`: acknowledgement before starting; on completion the source SHA, changed paths, commands with real exit codes, artifact hashes, the per-group diagnosis, anything unresolved, next checkpoint. Then freeze.
