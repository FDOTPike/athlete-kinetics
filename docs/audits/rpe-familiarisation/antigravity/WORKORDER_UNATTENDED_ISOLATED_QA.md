# Unattended Isolated QA: Saved RPE, Loading Tips, and Stability Evidence

## 1. Objective and Authority

Complete the remaining focused RPE/RIR device checks without touching the owner's existing training data. The owner is away and wants Antigravity to run unattended. Act as executor, then perform one evidence self-check. Codex performs the final independent audit later.

Owner authorization, verbatim:

> Sure, i dont mind as long as i can run antigravity unattended until i finish cutting the lawns

This approves an isolated QA profile/build. It does not approve changes to the owner's existing profiles, programs, sessions, app security, or phone settings; C6; production changes; commit; push; PR; merge; release; or signing-key use.

This work order supersedes the earlier live-session work order ONLY for creating and operating an isolated synthetic QA environment, its new evidence packet, and its ledger entry. Do not repeat the old Entry 0069 initialization, commit-first instruction, or original Pixel session actions.

## 2. Workspace and Preservation

- Working directory: `C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\rpe-familiarisation`.
- Expected branch: `codex/rpe-familiarisation`.
- Dispatch HEAD: `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72`.
- Product freeze: `6dde126f058fdd3ec2c765dd4e3c4d9ed02d3e06`.
- Existing APK: `apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk`.
- APK SHA-256: `b42c1be10167dc516f675de2331189d1e4025a8ecdf0ec5d300d92624d410c67`.
- Embedded APK build HEAD: `e927d8ee5d7f01497e85d1a4c7f64c927c26dea4`.
- Package: `com.pikemethods.training.qa`.

Read the applicable repository instructions and:
- `docs/audits/rpe-familiarisation/codex/CLOSEOUT_AND_PR_PREPARATION.md`
- `docs/audits/rpe-familiarisation/antigravity/HANDBACK_LIVE_SESSION_EVIDENCE.md`
- `docs/audits/rpe-familiarisation/antigravity/WORKORDER_LIVE_SESSION_EVIDENCE.md`

The worktree is intentionally dirty. Preserve:
- `PROMPT_LEDGER.md`, including Entries 0070 and 0071.
- The corrected Antigravity handback.
- `docs/audits/rpe-familiarisation/codex/CLOSEOUT_AND_PR_PREPARATION.md`.
- This work order.

Inventory HEAD, branch, tracked diff and untracked files. Save baseline fingerprints in ignored scratch. Do not reset, stash, clean, switch branches, stage, or commit. If HEAD differs, proceed only if you can prove the intervening changes are documentation-only and the APK/product identity remains valid; otherwise stop with the exact mismatch.

As your first tracked write, append the next unused ledger entry with exactly one Input and one Output. Record the received dispatch prompt verbatim, this work order's path and SHA-256, and the existing dirty state. Do not claim a paraphrase or file hash is the verbatim prompt. Leave closed entries untouched. Close only your new entry at handback.

## 3. Unattended Execution Policy

- Proceed without routine questions within these boundaries.
- Prefer existing tools and the existing APK; no rebuild or product changes are needed for the primary route.
- Allow at most one full setup attempt plus one concrete recovery for a diagnosed setup issue. Do not cycle through speculative SDK versions, reinstall dependencies, or commission multiple review rounds.
- Setup budget: 30 minutes. Total execution budget: 90 minutes. If reached, preserve evidence and hand back PARTIAL/BLOCKED, not an invented PASS.
- Any request for new licence acceptance, administrator elevation, paid service, credentials, BIOS/hypervisor changes, reboot, or relaxed security is a stop condition. Do not leave an interactive prompt waiting for the absent owner.
- Stop on an actual app crash, ANR, migration error or data-loss symptom; retain the reproducer and logs. Do not modify product code during this evidence run.
- No unattended promise of success: an honest blocked handback is preferable to bypassing the boundary.

## 4. Isolated Environment

### 4.1 Preferred Route: Fresh Emulator, Identical APK

Use a newly created, uniquely named disposable Android virtual device. Do not reuse an existing populated AVD or import the owner's device data/accounts. The same package ID on a fresh emulator is isolated from the physical Pixel.

Read-only host preflight at dispatch found:
- SDK: `C:\Users\fpike\AppData\Local\Android\Sdk`.
- `platform-tools\adb.exe`, `cmdline-tools\latest\bin\sdkmanager.bat`, and `avdmanager.bat` available.
- No emulator executable at that SDK and no installed system images found.
- Approximately 229.8 GB free on C: at inspection; recheck before setup.

Permitted setup:
- Discover official SDK package identifiers using the SDK tools.
- Install the official Android emulator package and at most one compatible Google APIs/AOSP system image, using already-accepted licences. Prefer a debuggable emulator image that supports emulator-only `adb root`; Google Play production images commonly do not.
- Use an API level compatible with the existing APK; record actual API/ABI/RAM/page size. Do not represent emulated RAM as a physical 4 GB C6 device.
- Create a new named AVD with synthetic data only. Launch background helpers with hidden windows where supported; retain their logs.
- Do not download third-party images, accept new legal terms, enable Windows features, or change system security to make the emulator work.

If this route is unavailable within the budget, stop with a setup handback. Do not fall back to using, reinstalling, rooting, clearing, or switching profiles on the physical Pixel while the owner is absent.

### 4.2 Device and Package Guard

Inventory connected devices read-only. Before every install, shell write, tap, kill, root, or data-read operation:
- Explicitly select the newly created emulator serial with `adb -s <serial>`.
- Verify emulator identity, expected AVD name and package. Never use an unqualified adb command for a mutating operation.
- `adb root` is permitted ONLY on this newly created emulator. It is not permitted on any physical device.
- Never use `adb kill-server` to recover one emulator; it affects other sessions.
- Install only the hash-verified QA APK. Never uninstall or clear storage on an existing device/package.
- Record APK hash and embedded build identity; do not relabel this artifact as built from the later documentation HEAD.
- Do not sign into Google, connect health data, enable biometrics, or import real training data.

Create one synthetic non-Beginner athlete through the normal app UI, using an obvious test name such as “RPE QA”. Select an ordinary supported goal/equipment/schedule sufficient to reach the routine builder and a rep-based session. Profile/program creation and normal session writes are authorized ONLY inside this new isolated environment. Do not inject or edit database rows to manufacture the tested state.

## 5. Required Evidence

### 5.1 RPE-D: Saved Values After Relaunch

1. Use a rep-based movement with a non-null planned RPE; prefer a target different from 8.0 so target copying is distinguishable. Record the actual target.
2. Start one synthetic session. Capture the initial neutral effort state.
3. Choose RIR 2, capture displayed actual RPE 8.0, then log one set through the UI.
4. Confirm the next set resets to neutral; log that set with effort untouched. Do not log a default/target value manually.
5. Read the actual database records, not just the set count. Discover the database filename and schema rather than guessing. Identify the exact new session, movement, set IDs and corresponding target rows.
6. Background/foreground, then force-stop and cold-relaunch the QA app. Resume the session and repeat the readback for the SAME set IDs.
7. Demonstrate first-set `set_record.rpe = 8.0`, second-set SQL NULL, and the independently stored planned target in `set_target`. Record SQL types/null checks so NULL is not confused with zero, an empty string or the text “null”.
8. Capture relevant UI and the read-only query/results before and after relaunch. Never UPDATE/INSERT values directly for this verification.

Use a read-only query on the dedicated emulator, or copy a consistent database snapshot from that emulator for read-only local inspection. If copying, stop the QA process first, retain database/WAL sidecars as necessary, and check snapshot integrity before interpreting results. Do not assume a main database file alone contains committed WAL records. Raw synthetic database evidence stays in ignored scratch.

If the app does not display individual saved values, say so. Database readback can prove persistence, but it must not be described as a user-visible saved-RPE display. Record that subrequirement separately as NOT AVAILABLE; do not add an unrequested history screen.

This new emulator evidence does NOT retrospectively verify the original two Pixel rows. Keep their prior NOT READ BACK disposition intact.

### 5.2 RPE-A3: Loading-Method Information Affordance

- With the isolated non-Beginner athlete, enter the routine builder through normal UI.
- Exercise an actual loading-method info button, not a glossary search or unrelated phase tip. Prefer Undulating/WAVE mapping and also inspect Linear if reachable without extra setup.
- Capture the loading-method label and its readable matching explanation.
- Verify tap-away dismissal; reopen and verify Android Back dismissal without navigation trap.
- Save valid screenshots and UI hierarchy before/open/after states. Do not save an unnecessary routine or alter the owner's program.
- Cite the actual component path and record the selected method. Reusing the same InfoTip component elsewhere is not sufficient evidence.

### 5.3 RPE-G: Retained Stability Evidence

- Record the new run's start/end times, device/package identity, app launches and PID changes.
- Retain raw crash/ANR/logcat evidence for this run. Inspect attribution to the QA app rather than counting unrelated emulator service warnings as app failures.
- Capture sufficient context to distinguish a clean run from a failed log command. Save commands and exit codes.
- Do not claim this new interval proves the earlier Pixel log window was clean.
- Any app-attributable crash, ANR, migration error or data loss means FAIL and immediate handback.

## 6. Evidence Handling and Verification

- Raw output directory: a new `scratch/rpe-isolated-qa/<UTC timestamp>/`.
- Keep screenshots, XML, read-only SQL/results, synthetic database snapshots, emulator setup logs, package/build identity and a command/exit-code journal there.
- On Windows, do not pipe binary screenshots through text redirection. Use binary-safe capture/pull and validate PNG signatures AND inspect images.
- Fingerprint cited evidence with SHA-256 and record its exact relative path.
- Do not reuse stale outputs from another run as fresh evidence.
- No new unit tests or full CI rerun is required if all product/build inputs remain unchanged. Carry forward Entry 0070's dated CI result as historical, not freshly rerun. Execute final `git diff --check` and product-byte/baseline checks.
- Leave the new AVD and evidence intact for review; shut down ONLY the emulator you created after the run. Do not delete SDK packages or AVDs to tidy up.
- One final self-check: each PASS must map to an actual artifact and tested environment; every missing observation must remain PARTIAL/NOT RUN. This is not independent audit certification.

## 7. Deliverables and Stop

Write:
- `docs/audits/rpe-familiarisation/antigravity/HANDBACK_ISOLATED_QA.md`.
- Close your new ledger entry with commands/results, artifact identity, scope and remaining limitations.

Do not overwrite prior handbacks or the Codex closeout. Your handback must include:
- Starting/final HEAD and preserved baseline changes.
- Actual host/emulator setup performed, package/API/ABI identity, APK hash/build HEAD.
- Exact synthetic profile/session/set actions; how database consistency and read-only access were ensured.
- RPE-D pre/post values with corresponding IDs/targets, RPE-A3 UI observations, and app-scoped stability results.
- Paths, hashes and exit codes; distinguish observed values, inferred behavior and unavailable UI.
- Setup failures, deviations and any specific next decision, without waiting for the owner mid-run.
- Confirmation: physical Pixel untouched; no existing training data changed; no product changes; no commits, staging, publication or C6 action.

Finish with these tokens, replacing placeholders truthfully:

```text
ISOLATED QA EXECUTION: COMPLETE / PARTIAL / BLOCKED
SAVED RPE READBACK — ISOLATED EMULATOR: PASS / FAIL / NOT RUN
SAVED RPE DISPLAY IN APP: PASS / NOT AVAILABLE / NOT RUN
LOADING-METHOD TOOLTIP — ISOLATED EMULATOR: PASS / FAIL / NOT RUN
STABILITY — NEW RUN WITH RETAINED LOGS: PASS / FAIL / NOT RUN
ORIGINAL PIXEL SAVED VALUES: NOT RE-VERIFIED
C6: NOT EVALUATED
PHYSICAL PIXEL / EXISTING TRAINING DATA: UNTOUCHED
PUSH / MERGE / RELEASE: NOT PERFORMED
INDEPENDENT AUDIT: PENDING CODEX
```

Stop after the handback. Do not start a further work order, announce release readiness, or initiate another audit team.
