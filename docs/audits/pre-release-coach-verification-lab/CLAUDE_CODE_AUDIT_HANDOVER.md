# Claude Code independent audit handover

Use VS Code with this worktree open:

`C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\pre-release-content-correction`

Agent: Claude Code, Opus 5, maximum reasoning, **Plan Mode / read-only**.

## Prompt

You are the independent read-only release-hardening auditor. Do not edit, create, delete, stage, commit, amend, reset, checkout, push, sign, upload, or release anything. Do not trust the implementer's summary: inspect source and reproduce claims. Record `git status --short`, branch, and `git rev-parse HEAD` before and after; they must remain byte-identical. Ignore only gate-generated ignored caches/build outputs.

Frozen baseline before this work: `2f67d56911ef248f1597d8d66715a61614e41f2a` (`fix(android): close ONNX release hardening gaps`). Audit every committed change from that baseline through current `HEAD`. Expected implementation commits include:

- `37a06b8c292ec3fe4dece1bdb74ca85a09ecf837` — migration 050 supplementary-role convergence;
- `ebaf78453e82ce695d5159d0258bfb8f74483090` — hidden advanced tools and Coach Verification Lab.

Release signing, Play Console upload, rollout, and public distribution are explicitly unauthorized.

### Audit objectives

1. **Migration 050 convergence**
   - Establish from migration 028 and later seeds whether `supplementary` is intentionally broad while `major` and `conditional` remain explicit allowlists.
   - Verify clean 049→050 upgrade, fresh chain, replay/idempotence, poisoned `user_version` repair, and future movement insertion converge to the same policy.
   - Confirm the trigger cannot widen `major` or `conditional`, duplicate rows, or disturb the 300-movement/media/content invariants.

2. **Hidden-surface and persistence contract**
   - The ordinary five tabs remain visible, including the athlete-facing `COACH` program surface.
   - Multi-athlete database management and the Verification Lab are absent by default.
   - Exactly seven taps on `BUILD 0.1.0` unlock them; the strict boolean persists device-wide in the registry, survives athlete switches/restarts, defaults fail-closed for old/corrupt registries, and has an explicit relock.
   - Treat the gesture as discoverability, not authentication; report any language or code that claims otherwise.

3. **Lab no-write boundary and engine authenticity**
   - Trace the UI selectors and the pure Lab input surface. Prove a run has no route to athlete/database/store mutators.
   - Confirm the six scenarios call the shipped production inference functions: daily prescription; LINEAR/WAVE/STEP/APRE generation; flaw detection/control/daily adaptation; four-mode load selection including manual bodyweight `0.0`; shared movement availability; session reducer and outcome classifier.
   - Confirm no network/API/model invocation, clock read inside the pure core, randomness, or diagnostic write exists.
   - Verify 14/30/90 evidence summaries preserve missingness and the read-only profile context query counts only sessions with logged sets.

4. **Privacy and UI behavior**
   - Verify the share payload omits athlete names, free text, database/file identifiers, raw evidence rows/dates, and raw health readings.
   - Verify hardware/sub-view back closes the Lab safely, relock hides both surfaces, touch/accessibility labels exist, and the normal athlete screens remain unchanged.
   - Review `docs/decisions/coach-verification-lab.md` against the implementation.

5. **Independent reproduction**
   - Run `npm.cmd run verify:all` (all 21 configured gates).
   - Run Android `./gradlew :app:assembleDebug :app:bundleDebug --no-daemon` from `apps/mobile/android` using the repository's existing dependency-resolution hardening.
   - Confirm the ONNX packaging verifier accepts both artifacts.
   - If the Pixel is connected, install with `adb install -r`, start Metro plus `adb reverse tcp:8081 tcp:8081`, launch the app, and verify the real UI rather than only a resumed native activity. Do not erase app data.
   - On-device expected result after opening the Lab and pressing `RUN ALL CHECKS`: `6 passed · 0 need attention`. Record PSS/private-dirty memory and compare private dirty with the 450 MB ceiling.

### Implementer evidence to reproduce, not assume

- `npm.cmd run verify:all`: PASS, 21/21 configured gates; component suite 10/10 suites and 152/152 tests.
- Android debug APK + AAB: PASS; ONNX packaging contract PASS.
- Pixel 9 Pro: data-preserving install PASS; real app UI visible after Metro/USB reverse; seven-tap unlock PASS; Lab result 6/6 PASS.
- Lab-loaded process memory: total PSS 326,324 KB; private dirty 269,312 KB; below the 450 MB dirty-memory ceiling.
- Debug APK SHA-256: `616D2C3B0968E48D763EAD6E75645F39B9DCF7ED9836B40C14C07EC95D6C6062`.
- Debug AAB SHA-256: `FBB75137A87A76BD719D491409E8F0D1A0B0D36C669F7267FF6808D771E82119`.

Known non-blocking debug observation: React Native 0.81 emits its core `SafeAreaView` deprecation warning in development, producing the debug warning banner. It is not a crash and is absent from release UI. Decide independently whether this is P2 or informational. Also distinguish Babel module-resolver warning text from an actual resolution failure: the bundle and tests must demonstrably compile against this worktree's package sources.

### Output format

Return one Markdown audit with:

- frozen before/after repository state and audited SHA range;
- commands and exact results;
- findings ordered P0, P1, P2, then informational, with file/line evidence;
- an explicit verdict: `PASS`, `PASS_WITH_NONBLOCKING_FINDINGS`, or `FAIL`;
- separate decisions for code readiness, local visual-testing readiness, and public-release authorization (which must remain **NOT AUTHORIZED** regardless of technical pass).

Do not propose or implement fixes in this audit. If a defect exists, provide the smallest reproducible counterexample and stop at the finding.
