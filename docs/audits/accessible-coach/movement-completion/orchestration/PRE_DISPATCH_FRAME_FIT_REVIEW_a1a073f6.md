# Pre-dispatch review of the committed frame-fit repair

Reviewer: Claude Opus 5.5, Claude Code Desktop, as orchestrator. 5 October 2026.

This is the orchestrator's own check of what `a1a073f6` actually fixes, made to
write the first repair orders. It is NOT one of the two independent final
audits. It covers frame and crop only, on host. No rendered media was
inspected, no technique was judged and nothing ran on Android or iOS.

## Source identity

- Commit `a1a073f6a08ce0c1f9921ba385579856348b3923`, tree `3c2dddd444fca1945b7b22b398f575b0c0dc663c`.
- Branch `gemini/movement-animation-completion-2026-10-05`, local only.
- Checked in an isolated detached worktree after `npm ci` (exit 0). Gemini's checkout was not touched. The worktree was clean at the same HEAD afterwards.
- Raw outputs and hashes: `evidence/a1a073f6-frame-fit/` (`SHA256SUMS`).

## Commands and real exits

| Command | Exit |
| --- | --- |
| `npm run typecheck` | 0 |
| `npx jest --config apps/mobile/jest.config.js --runInBand --no-cache --testPathPattern "MovementPreview.canonicalFrameFit\|MovementPreview.fixedBarBodyMotion"` | 0 (7 passed, 7 skipped, 1 of 2 suites skipped) |
| Same frame-fit suite with the frame height override removed (control A) | 1 (3 failed, 4 passed) |
| Same frame-fit suite with `height: canonicalStageH - 24` (control B) | 1 (3 failed, 4 passed) |
| Orchestrator probe, all movements, neutral, every 33 ms tick | 0 (132 measured) |

The probe (`opusAuditProbe.frameFit.test.js.txt`) renders the real
`MovementPreview` with its default neutral figure, presses play and reads the
actual frame, stage and primitive styles at every tick of the full cycle.

## What the commit does fix

- For all 132 canonical and derived movements the figure frame now has the
  stage's height and is at least as wide (`frameW` 240, `stageW` at most 240).
  The frame itself no longer cuts anything.
- The whole floor line, top plus height, is inside the frame in all 132.
- The movement 52 guard is real: it fails under both real frame mutations.

## Findings

**F1, high. Fifteen movements are still visibly clipped, and the test permits it.**
The stage has `overflow: 'hidden'` (`MovementPreview.tsx:706-709`), so anything
outside the view box is cut. Neutral figure, full cycle, measured:

| Movements | Side | Clipped (dp) | When |
| --- | --- | --- | --- |
| Dumbbell Floor Press 86, Alternating Floor Press 128, Extended Range One-Arm Kettlebell Floor Press 196 | left | 8.448 | 0 ms |
| Dumbbell Bench Press 10 | left | 6.256 | 0 ms |
| 3/4 Sit-Up 125, Cable Seated Crunch 161, Cross-Body Crunch 173, Janda Sit-Up 226, Oblique Crunches 245 | left | 3.028 | 0 ms |
| Stiff Leg Barbell Good Morning 287 | left | 1.313 | 1485 ms |
| Chest-Supported Dumbbell Row 42 | left | 0.464 | 0 ms |
| Cable Rope Overhead Triceps Extension 116, Cable One Arm Tricep Extension 157, Dumbbell Tricep Extension Pronated Grip 193, Standing Overhead Barbell Triceps Extension 283 | bottom | 0.459 | 0 ms |

The other 117, including derived 247, 20 and 186, measure zero. The committed
test passes these fifteen through `TRACKED_RESIDUALS` allowances of up to
8.91 dp (`MovementPreview.canonicalFrameFit.test.js:168-184`, `:281-287`). The
binding rule is the 1e-6 dp epsilon with no clipping allowance and no
unexplained passing baselines. Fourteen clip in the authored start pose, which
points at view-box framing in the source data, not at interpolation.

**F2, high. The two committed negative controls do not test anything.**
`:141-165` compare constants with constants. Both stayed green under control A
and control B. The required demonstration is that the short frame and the
24 dp shorter frame fail the real enclosure guard.

**F3, high. Only movement 52 has a frame guard.**
The all-entries test (`:186-292`) never renders the component or reads the
frame. It passed under both frame mutations. It also re-implements the
renderer's geometry (`MovementPreview.tsx:241-322`) instead of reading it,
samples five times per cycle instead of the full cycle, omits the role and
implement-tilt inputs the renderer passes, and hard-codes floor height 1.

**F4, medium. Derived movements are not covered.**
The filter requires raw `frames`, which derived entries 247, 20 and 186 do not
carry. The count is pinned as "at least 129".

**F5, medium. The restored fixed-bar test does not run.**
`MovementPreview.fixedBarBodyMotion.test.js:20` switches the whole suite to
`describe.skip` while movements 66 and 152 are absent. Seven tests are skipped
silently, so the suite is green without checking anything.

**F6, high, scope. Neutral-only is not implemented.**
Three parameter sets remain (`canonicalFigure.ts:39-42`); the component takes
`bodyType` and indexes them (`MovementPreview.tsx:335`, `:350`, `:547`);
derivation checks loop three names (`derivation.ts:234`, `:304`); 24 component
test files and 8 files under `tools/rendering` refer to male or female bodies.
No caller outside `movementPreview/` passes `bodyType`.

**F7, medium. Three of Gemini's committed evidence files are not evidence.**
In `acceptance-evidence/gemini/frame-fit-remediation/`:
`auditor-probe-output.txt` is a "No tests found, exiting with code 1" message;
`probe-runtime-base.txt`, `-remediated.txt` and `-final.txt` are byte-identical
(same SHA-256), so that probe cannot see the change it claims to bracket;
`git-status-short.txt` shows the logs were taken from an uncommitted tree.
Keep the files; mark them invalid for the claims they were filed under.

## Limits

Host measurements of React Native styles, not native pixels. Horizontal
narrowing under `maxWidth: '100%'` in a card narrower than 240 dp was not
measured. The three legacy-rig prototypes (28, 16, 88) and the three
unsuitable entries (70, 68, 7) were not measured.
