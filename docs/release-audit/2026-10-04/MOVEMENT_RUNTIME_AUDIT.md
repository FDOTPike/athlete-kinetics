# Independent movement runtime audit — 2026-10-04

The existing preview test suite passes, but the draft renderer is not ready for approval or release. Independent checks reproduce a pause jump, stale playback state when a mounted preview changes identity, and a boundary error in the production interpolation helper. Draft crops cut off visible anatomy or equipment, and one variant switches implement geometry abruptly. No native frame-timing proof for the audited source was established.

This is the separate runtime/smoothness lane requested by the owner. It does not certify exercise technique. No tracked product source or movement asset was changed by this audit. The owner's 4 GB phone acceptance is deferred; this report does not impose a RAM ceiling or represent that acceptance as passed.

## Exact audited input

- Checkout: `C:/Users/fpike/.codex/worktrees/wo09-health-connect-ordering/Athlete App`.
- Base commit: `01023cf04eeb85b73004b92de11f64efa7350a1c`, with an inherited dirty integration overlay. A commit ID alone does not identify these drawings.
- Split preview data SHA-256, using the repository's filename/NUL/bytes digest: `d8e2332e4a1e64c1a1d8e262c0f3a6410d22f4989b68c666e3a37ba1443a6244`.
- Authoring manifest SHA-256: `10ef1c176426cc8d50a2f1d83abef4b1baca57212b8afb84e8feb9ce0e723bdd`.
- `MovementPreview.tsx`: `4f8988c6cc472b94d036a1072ea660d55b73469b9480e3628c2425ab9c56dca6`.
- `canonicalFigure.ts`: `14c45475322f56daa246141e2712f8867f15ba129b4441f96463b4c7cce14a38`.
- `manifest.ts`: `643bf1e7edd9435e47cb03204abe8b26a85d00c80e8517ab767902e01933b206`.
- All 49 preview source/data files were identical before and after verification. The before/after inventory files both hash to `ab2dcd2470ab32f63c6a2313d57075f50bfa0d27c654d6d5eb544221400c7cef`.

Full per-file digests are in [runtime/source-digests-before.json](runtime/source-digests-before.json), with supporting screen, accessibility, test and tool digests in [runtime/supporting-source-digests.json](runtime/supporting-source-digests.json). This local overlay must be integrated and published before a GitHub cloud worker can act on this exact input. It is not evidence that a GitHub branch already contains the preview work.

## Inventory and actual visibility

The authoring manifest and shipped split both contain **129 records across 40 family files**: 3 `covered`, 123 `pending`, 3 `intentionally_unsuitable`. The 123 pending records contain canonical draft motion, including derived variants. The three covered records use the legacy rig.

`previewIndex.json` still declares global technique review `pending`. `manifest.ts:793` requires global review `complete`, a covered record, matching movement/asset identity, and database media `ready`. Consequently **zero previews resolve through the unmodified production approval path today**. Existing drawing tests deliberately use labelled hypothetical approval fixtures. Their success must not be described as 129 approved or usable animations.

## Findings requiring resolution before activation

| ID | Severity | Evidence and implication | Smallest responsible change |
|---|---|---|---|
| R1 | P2 | `MovementPreview.tsx:539` draws an interpolated pose only while `playing`; pausing replaces it with the preceding authored keyframe. The real component repro fails after 264 ms of Goblet Squat playback. Its maximum joint snap is about **15.85 dp** at the current crop scale. Resuming jumps forward to the held timeline again. Background cancellation uses the same paused drawing path. | Keep the interpolated pose at the held canonical time when full motion is paused. Continue snapping to curated stills when reduced motion is active. Preserve captions, final stop and replay semantics. |
| R2 | P2 | `MovementPreview.tsx:374` initializes time/index/playing only once; no movement-identity reset exists. Rerendering the same mounted slot from Goblet Squat to Walking Lunge while playing shows `PAUSE` and carries elapsed time into the new movement. When the subject becomes uncovered, the drawing disappears and its timer effect cleans up, but `playing` remains true and the global coordinator still reports active. Both production-component repros fail. The Session and Library integrations do not give the preview an identity key. | Reset playback and position on canonical movement/asset identity changes and on loss of coverage, or enforce an identity-keyed child boundary. Release the coordinator even when the component resolves to null. Do not reset on every freshly allocated subject object. |
| R3 | P2 | `canonicalFigure.ts:146–164` clamps time to total duration, walks every segment, then uses `acc === total` to interpolate the final gap at fraction zero. `poseAtTime(total)` therefore returns the penultimate pose. **122 of 123 canonical records** have a differing final pose. The endpoint repro fails. The component's current single-cycle stop bypasses this helper and does reach its final keyframe; that positive control passes. | Return the final pose explicitly at or beyond total duration, including a one-frame input. Add a real boundary test; preserve the component's already-working final stop. |
| R4 | P2 | `MovementPreview.tsx:689` applies `overflow: hidden` to the authored crop. A scan of actual production primitives finds definite circle/rect clipping in **9 records**. Incline Push-Up's neutral head extends 5.1 source units above its crop at time zero; Standing Dumbbell Triceps Extension clips a held load by 3.80 units during interpolation. The visually inspected headless diagnostic makes both cuts visible. | Adjust only affected authored view boxes using the full drawn silhouette, implements and interpolated extrema, with a small margin; regenerate their split data and evidence. Keep a fixed crop over the cycle so the camera does not pump. |
| R5 | P2 | `canonicalFigure.ts:1977` changes a supinated implement from rects to tilted bones solely when the discrete frame role becomes `peak`. Movement 186, Dumbbell Bicep Curl, changes its implement primitive kinds abruptly at **900 ms and 1500 ms** while its joint positions remain continuous. This is independent of technique correctness. | Interpolate the implement orientation through the rise/peak/lower segments using the existing renderer and audited angle semantics. Audit both sides of each segment boundary; keep the variant identity and grip intact. |

The clipping records found without any conservative bone-bound assumption are:

| Movement ID | Record | Maximum circle/rect crop excess, source units |
|---|---|---:|
| 284 | Standing Palm-In One-Arm Dumbbell Press | 0.50 |
| 270 | Seated Dumbbell Press | 2.50 |
| 159 | Cable Rear Delt Fly | 0.70 |
| 282 | Standing Dumbbell Triceps Extension | 3.80 |
| 225 | Jackknife Sit-Up | 4.09 |
| 90 | Incline Push-Up | 5.30 |
| 222 | Incline Push-Up Close-Grip | 7.20 |
| 223 | Incline Push-Up Wide | 3.30 |
| 286 | Step-up with Knee Raise | 1.40 |

The largest value in each row considers neutral, male and female compatibility bodies. The neutral production body is also clipped in the clearly rendered examples. The first broad scan flagged 36 records using conservative bone/stroke bounds; **that number is not a confirmed defect count**. The nine above use circle/rect outer dimensions without extra SVG stroke padding. All results and affected primitives are retained in [runtime/supplemental-results.json](runtime/supplemental-results.json).

![Headless crop diagnostic](runtime/crop-diagnostic.png)

The diagnostic uses production pose/layout math and the existing SVG primitive converter. Yellow outlines represent the app's clipping box; faded geometry sits outside it. This is a headless approximation, not an iOS or Android screenshot.

## Checks and their limits

| Check | Fresh result | What it proves |
|---|---|---|
| Existing Jest `MovementPreview` suites | **22 suites / 759 tests passed**, exit 0 | Current tested component controls, geometry, identity gates, reduced motion, lazy family loading, lifecycle cleanup, derivation and content contracts. These are host tests. |
| Existing Node Tier 1 coverage suite | **102 passed**, exit 0 | Its actual storage/data assertions and host test logic pass. It does not establish device performance. |
| Independent production-component/math repros | **4 failed / 1 passed**, exit 1 | R1, R2's two cases and R3 reproduce. The component's single-cycle final stop and stable halted drawing pass. |
| Production math/primitive scan | **29,610 pose/body draws** over 123 canonical records, zero non-finite numeric primitives and zero invalid active segment durations | Existing sampled draft interpolation remains numerically finite. It does not certify anatomy or frame delivery. |
| Preview source inventory before/after | **49 files identical** | Audit did not change the preview inputs. |
| Native iOS/Android frame timing for these source digests | **Unavailable in this audit** | No smoothness pass or release certification is claimed. |

Raw logs and JSON are retained under [runtime/](runtime/): `jest-movement-raw.log`, `jest-movement-results.json`, `tier1-raw.log`, `runtime-reproductions-raw.log`, `runtime-reproductions-results.json`, `numerical-trace-results.json`, and `supplemental-results.json`. Audit probes/config/scripts are saved there and can be rerun without editing product files.

The initial Jest command used an incorrect CLI argument and selected no tests; the corrected command above selected and executed all 22 suites. The initial external repro harness destructured Testing Library's changing `screen` export too early. Its error logs are preserved as `runtime-reproductions-harness-error.*`; the corrected live-export harness produced the four real failures and passing control reported here. Harness failures are not counted as product failures.

Commands executed from the audited checkout:

```powershell
node node_modules/jest/bin/jest.js --config apps/mobile/jest.config.js --runInBand --no-cache --testPathPattern MovementPreview --json --outputFile <audit>/runtime/jest-movement-results.json
node --test test/e2e/movement_previews/tier1_feature_coverage.test.mjs
node node_modules/jest/bin/jest.js --config <audit>/runtime/jest-runtime-audit.config.cjs --runInBand --no-cache --json --outputFile <audit>/runtime/runtime-reproductions-results.json
node <audit>/runtime/numerical-trace.mjs
node <audit>/runtime/supplemental-trace.mjs
```

## Release proof gaps

1. **Native timing is absent.** Canonical playback uses a JS `setInterval` every 33 ms (`MovementPreview.tsx:423`), advancing a fixed 33 ms per callback. This is approximately 30 pose updates per second, not proof of 60 FPS or delivery under JS contention. Some drawings reach **151 primitive Views per pose**. Profile the actual signed candidate with the integrated source; do not assume a new dependency is required before measuring it.
2. **Several so-called E2E checks are simulations or constants.** Tier 1 F15 models playback separately; F18-03 asserts a literal `0.45` MB; F20-01 asserts a locally assigned expected exit code and F20-04 a literal clean-source boolean. F02-04 benchmarks a legacy centring helper, not React/native rendering. Their green results must not serve as smoothness or runtime memory evidence. Replace the release-facing claims with measured results or explicitly label them as contract/simulator checks. Keep useful tests.
3. **Whole-cycle layout evidence is incomplete.** Current evidence-card checks and stills do not by themselves rule out interpolated crop/implement defects. Rebuild affected evidence after fixes and check all frames plus segment boundaries and midpoints. Existing evidence from another source digest cannot certify the repaired candidate.
4. **Cache measurements are host-only.** The parsed-family map is finite for the present 40 registered families, and the normal stopped/unmounted timers clean up under tested scenarios. Families and required JSON modules are retained after first use. This is bounded catalogue retention, not an observed unbounded animation timer leak. Actual native retention and repeated mount/unmount behavior still need a measured candidate run; no 4 GB acceptance decision is inferred.

## Final independent smoothness acceptance plan

1. Freeze the candidate commit, overlay digest if any, all preview source/data digests, compiled build identity, bundle/application identity and device/OS. Keep technique approval independent; an author cannot mark their own work as audited.
2. Carry the four failing checks into the real component suite. Add canonical pause/resume/background drawing equality, covered-to-covered and covered-to-uncovered identity resets, exact endpoint/one-frame boundaries, and continuous implement orientation. Require timer and coordinator cleanup on dismissal/unmount/coverage loss and one active player globally.
3. Scan every canonical draft/derived record, all active body inputs, authored frames, segment boundaries with values immediately before/after, midpoints, and the final pose. Reject non-finite geometry, unintended discontinuities, clipped head/hands/feet/implements, mismatched captions and incorrect reduced-motion teaching order. Re-render and visually review affected crops.
4. On the exact Android and iOS release candidate, record repeated playback of the dense 151-primitive drawings, walking lunge, rotations/cable variants, and the repaired clipping examples. Measure delivered frame timings, visible stalls and playback duration while navigation/coaching work runs. Review screen recordings for jump, crop and equipment defects. Compare behavior against the authored timing; report the measured results rather than extrapolating a Node benchmark.
5. Exercise Play/Pause/Replay, rapid tapping, moving between details/session movements, dismissal, app background/inactive/foreground, reduced-motion preference changes, larger text and screen-reader labels. Returning foreground must stay paused; reduced motion must start no playback timer; all positions remain reachable and correctly labelled.
6. Repeat mounts, switches and all-family visits; confirm active timers/listeners/coordinator state return to the expected idle baseline and any retained family data stabilizes. This checks correctness without treating the owner's deferred phone-memory limit as a gate.
7. Separate runtime reviewer signs off only the frozen candidate that passes these checks. Owner phone testing remains a separate acceptance item. Missing Apple/Android device execution or technique approval remains visible; it cannot be cleared by editing a status field.
