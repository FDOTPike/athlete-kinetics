# Android USB validation on the owner's Windows PC

Run against synthetic records in the QA app on the owner's physical phone. This workflow captures evidence for review; it does not approve a beta release. It never clears app storage or uninstalls, but `adb install -r` updates any existing QA installation (`tools/device-validation/validate.mjs:128`). Save a backup first if that installation contains anything you need. Do not use participant health records for this device exercise.

## Prerequisites

- Node.js available as `node`; development check here used Node 24.11.1.
- Android SDK platform-tools: `adb` on PATH, USB debugging enabled, unlocked phone and USB authorization accepted. Disconnect other phones/emulators and use a USB cable.
- SDK build-tools `aapt.exe` on PATH, or supply its full path with `--aapt`.
- The exact CI **QA** APK, `app-qa.apk`, from the candidate being evaluated. The expected QA package is `com.pikemethods.training.qa`; this variant bundles the app and is non-debuggable (`apps/mobile/android/app/build.gradle:157`, `apps/mobile/android/app/build.gradle:162`). A debug/release APK is not interchangeable.
- Health Connect available on the phone for the denial scenario. An unavailable service does not demonstrate a user-denied permission.
- An owner-approved, private, unsynced local output directory outside the repository. The default is Windows temporary storage, which must be copied to the private evidence location before cleanup. Raw logcat, UI XML and screenshots may contain sensitive device/app information. Do not upload or commit them.

## Run from the repository root

```powershell
node tools/device-validation/validate.mjs --dry-run
node tools/device-validation/validate.mjs --apk 'C:\QA\app-qa.apk' --aapt "$env:LOCALAPPDATA\Android\Sdk\build-tools\<installed-version>\aapt.exe" --output-root 'C:\private-device-evidence'
```

Replace the APK, installed build-tools version and approved output location. The script prints its timestamped results path. It validates a single authorized target, physical USB connection, APK package, installation and installed-package metadata, and retains the APK SHA-256 (`tools/device-validation/validate.mjs:88`). It checks package identity, not the CI artifact signature/provenance; the owner must establish the trusted candidate source separately. The repository's release acceptance requirements remain in `docs/PRE_RELEASE_ANDROID.md:160`.

At each prompt, perform the taps and **type what you observed**, including the exact on-screen text and requested set/rest/athlete state. Empty observations stop the workflow. Include the word **FAIL** for a failed observation; failures remain in the report (`tools/device-validation/validate.mjs:95`). The script opens Settings for Health Connect revocation; navigation and permission taps are deliberately human steps (`tools/device-validation/validate.mjs:158`). Do not grant permission again during the denied session. Record an unavailable service as FAIL and test denial on a suitable phone later.

The exercise logs a full guided workout, backgrounds during active rest, returns to the same unfinished workout, force-stops and cold-relaunches, finishes the remaining sets and session feel, and completes another manual workout with Health Connect denied (`tools/device-validation/validate.mjs:139`). Keep the same athlete throughout. Screenshots, UI dumps, process IDs and typed observations support comparison; they do not automatically establish that set counts/rest expiry are correct (`tools/device-validation/validate.mjs:40`). Check them yourself and mark discrepancies FAIL. There is an intentional sampling gap while the app is force-stopped; launch transients can occur before the first post-launch sample.

The wrapper calls the existing harness with `start --package`, then serial `watch --interval-ms 250 --duration-s 30 --label ...`, then `finish`. Continuous epoch logcat is captured to `AK_LOGCAT_FILE`; `AK_MEM_EVIDENCE_DIR` points to the results folder. These environment inputs and commands are the harness's supported interface (`tools/memory-audit/meminfo_harness.mjs:4`, `tools/memory-audit/meminfo_harness.mjs:57`, `tools/memory-audit/meminfo_harness.mjs:211`). **Proposal:** use 30-second watch chunks so stopping waits for a clean harness exit instead of interrupting a database-packet write. Requested 250 ms cadence follows the harness example; achieved cadence is reported separately (`tools/memory-audit/meminfo_harness.mjs:10`, `tools/memory-audit/meminfo_harness.mjs:277`). There is no fixed workout-duration limit. After a phase, draining may take the remainder of a chunk plus the current adb capture. Do not close the terminal while draining. An interrupted run is incomplete; rerun into a new results folder.

For lifecycle evidence, exercise the ordinary body-state-report flow with synthetic text while sampling. Do not provoke symptoms, invent an injury or continue past a halt. Harness `finish` rejects evidence without a qualifying correlated request (`tools/memory-audit/meminfo_harness.mjs:242`); this is reported as NOT VERIFIED, not bypassed. Logcat/harness errors also prevent a verified status (`tools/device-validation/validate.mjs:168`).

## Results and interpretation

`results.json` and `SUMMARY.txt` include the maximum sampled Private Dirty and comparison with the ratified **536,870,912 B (512 MiB)** ceiling. Bands reuse the existing 450,000,000 B preferred target and hard ceiling (`tools/memory-audit/memory_gate.mjs:60`, `tools/device-validation/validate.mjs:17`). Above the ceiling blocks release; above the preferred target requires explicit review. Missing samples, failed observations or missing correlated summaries remain NOT VERIFIED. Exit code is nonzero for capture/observation failures, missing measurement or a ceiling breach (`tools/device-validation/validate.mjs:189`). A review-band result still needs owner review even when exit code is zero.

The folder retains `apk-badging.txt`, `device.txt`, `installed-package.txt`, `install.txt`, `observations.json`, screenshot/UI/PID pairs, continuous logcat, `harness-output.txt`, raw `sample-*.txt`, and the harness `session.json` when created (`tools/device-validation/validate.mjs:86`, `tools/device-validation/validate.mjs:40`; raw sample persistence: `tools/memory-audit/meminfo_harness.mjs:143`). Inspect `session.json.summary` for cadence, lifecycle correlation, disposal integrity and peak-claim limitations. No summary is produced when the harness rejects correlation. A sampled maximum cannot prove a missed transient peak (`tools/memory-audit/meminfo_harness.mjs:323`). A phone outside the target RAM class does not settle the required legacy-device check. Record that limit and arrange the appropriate device.

This wrapper does not seal a release evidence manifest or run the entire release gate. A release packet needs the separately verified manifest/provenance process (`tools/memory-audit/evidence_provenance.mjs:111`; release requirements: `docs/PRE_RELEASE_ANDROID.md:96`). Retain this raw folder unchanged for the reviewer; protect and delete it under the owner's evidence retention agreement.

## Host checks

```powershell
node --check tools/device-validation/validate.mjs
node --test tools/device-validation/validate.test.mjs
python tools/device-validation/verify_plan.py
python tools/device-validation/test_verify_plan.py
node tools/device-validation/validate.mjs --dry-run > tools/device-validation/DRY_RUN_OUTPUT.txt
```

The Node assertions cover memory boundaries, unavailable measurements, target ambiguity, argument errors, screenshot buffer sizing, stopped-app PID capture and propagation of other adb failures (`tools/device-validation/validate.test.mjs:6`). The Python check executes the reading-plan queries against table definitions fetched read-only from pinned commit `26f6557a793f1cafe9f609fb10e015cfc42d22b0` (the documented `origin/master` reference) with synthetic records, and checks cited locations exist (`tools/device-validation/verify_plan.py:15`). The reference regression check rejects movable refs during both citation and schema reads. Neither check drives a real phone. The initial Node test run failed because the implementation was absent; the fixture check initially rejected an incorrectly shaped outcome fixture, which was corrected to the real schema. Final dry-run output is retained in [DRY_RUN_OUTPUT.txt](DRY_RUN_OUTPUT.txt); no physical-device result is claimed.
