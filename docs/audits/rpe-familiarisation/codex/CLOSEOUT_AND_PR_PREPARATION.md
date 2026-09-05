# RPE Familiarisation: Codex Closeout and Local PR Preparation

## 1. Disposition and Review Boundary

- Review date: 2026-09-04.
- Reviewed branch: `codex/rpe-familiarisation`.
- Reviewed HEAD: `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72`; worktree initially clean.
- Approved product freeze named by the device work order: `6dde126f058fdd3ec2c765dd4e3c4d9ed02d3e06`; tree `17eeb8c7cc6e32d09c6e316566f0759a60ff4ffb`.
- Scope: Antigravity's live-session evidence and its corrections, relevant RPE data/UI paths, current automated verification, and a read-only integration inventory.
- Result: core effort-control and next-set-reset evidence accepted; complete device work order PARTIAL. No new product defect identified within this focused review.
- This is not a semantic audit of all accumulated branch changes, a new live device run, a release approval, or an independent second review of Codex's own documentation edits.
- Completed locally: corrected the mutable handback, appended ledger Entry 0070, reran verification, prepared this PR packet.
- Not performed: product edits, device interactions, dependency changes, rebuild, staging, commit, push, PR creation, merge, signing, release, or C6.

## 2. Findings and Evidence Disposition

### 2.1 Documentation Findings Corrected

- P1: the handback's Case D/section 3 still described expected SQLite values as observed writes after the headline was downgraded. It now explicitly distinguishes source-derived expectations from device readback. The complete-device token is PARTIAL; core control PASS is separate.
- P2: A3 cited a block-phase tooltip as the routine-builder gate. Corrected to the actual edit/create entry points at `BlockScreen.tsx:956` and `:979`, and the loading-method tip at `RoutineTemplateBuilder.tsx:771`.
- P2: the general upgrade label could imply older-version migration coverage. It now says same-APK reinstall only, matching the actual work order.
- P3: removed the unsupported “Borg CR10” attribution and corrected the quoted neutral cue's punctuation to match the device XML.
- Evidence qualification: Case G remains the executor's reported PASS; the cited raw crash/ANR outputs are not retained in the local capture directory, so this review does not independently certify that historical log check.
- Historical ledger Entry 0069 is preserved. Its opening COMPLETE statement and write-value shorthand are superseded by Entry 0070 and this evidence-qualified disposition, not silently rewritten.

[Source: docs/audits/rpe-familiarisation/antigravity/HANDBACK_LIVE_SESSION_EVIDENCE.md, line 24]
[Source: docs/audits/rpe-familiarisation/antigravity/WORKORDER_LIVE_SESSION_EVIDENCE.md, line 181]

### 2.2 Device Cases

| Case | Review disposition | Evidence boundary |
| --- | --- | --- |
| A1/A2: RIR/RPE tips | Captured popovers supported; executor reports both dismissal routes passed | Saved valid captures inspected; no new device interaction |
| A3: loading-method tip | NOT RUN on device | Beginner routine-entry restriction; code reuse is not device coverage |
| B: effort controls | PASS from saved device evidence | Four valid PNG/XML pairs; neutral → RIR 2/RPE 8.0 → direct 8.5 → Not sure/neutral |
| C: next-set reset | PASS from saved device evidence | Set 2 shown with neutral/unselected effort; no previous answer carried over |
| D: restored session/count | PASS from saved device evidence | Active session resumes with two completed Bodyweight Squat sets |
| D: saved individual RPE | NOT VERIFIED; Case D remains PARTIAL | Neither screenshots nor completed-set UI expose stored 8.0/NULL values |
| E: same-APK reinstall | Captures support preserved visible state; command success is executor-reported | Does not test an older app/schema upgrade |
| F: glossary spot-check | Executor-reported PASS, consistent with glossary/component tests | Not a fresh full device glossary audit |
| G: stability logs | Executor-reported PASS; not independently reproduced | No saved raw logcat output available in the capture directory |

The four Case B XML files contain the required neutral/selected cues. The planned-target cue “Moderate; about three good reps left.” is absent from all four captured hierarchies. This supports the tested states only, not every possible session configuration.

[Source: docs/audits/rpe-familiarisation/antigravity/HANDBACK_LIVE_SESSION_EVIDENCE.md, line 37]
[Source: docs/audits/rpe-familiarisation/antigravity/HANDBACK_LIVE_SESSION_EVIDENCE.md, line 65]
[Source: docs/audits/rpe-familiarisation/antigravity/HANDBACK_LIVE_SESSION_EVIDENCE.md, line 78]
[Source: docs/audits/rpe-familiarisation/antigravity/HANDBACK_LIVE_SESSION_EVIDENCE.md, line 255]

### 2.3 Relevant Product Checks

- `apps/mobile/src/screens/SessionScreen.tsx:359`: explicit RIR/direct entry determines actual RPE; no answer remains null.
- `apps/mobile/src/screens/SessionScreen.tsx:606`: logging receives that actual value.
- `apps/mobile/src/screens/SessionScreen.tsx:1032`: cue derives only from actual effort; null displays neutral guidance.
- `apps/mobile/src/state/useStore.ts:5596` and `:5646`: inspected insert preserves null/actual effort and writes the planned target separately.
- `apps/mobile/src/screens/SessionScreen.tsx:149` and `:737`: completed rows show counts and selected duration/band metrics, not saved per-set RPE. Therefore restoration cannot prove those hidden values.
- `apps/mobile/test/components/SessionScreen.test.js:661`: executed regression covers chosen RIR/direct cues and Not sure/null logging. Component mocks and source inspection are not substitutes for a read of this phone's database.

## 3. Verification and Artifact Provenance

### 3.1 Current Verification

- Executed `npm.cmd run verify:ci` from this worktree: exit 0.
- Includes typecheck and the declared database, migration, inference, store, progression, artifact-verifier tests, and other chained gates.
- Mobile component result: 20/20 suites, 280/280 tests passed.
- Log: `scratch/codex-rpe-closeout/verify-ci.log`.
- Log SHA-256: `a97c82f1a359975bb795e05e5fa12dacf12b2a90bee5227685932f416b8513a0`.
- The log includes React Native Animated `act(...)` warnings; passing does not mean warning-free.
- `verify:ci` does not execute the physical-device memory contract or verify the installed QA candidate. Do not relabel it `verify:release`.
- Product-freeze-to-reviewed-HEAD diff contains only five documentation paths. Codex's additions are documentation-only as well.
- Final whitespace and scope checks are recorded in Entry 0070.

[Source: package.json, line 47]
[Source: docs/audits/rpe-familiarisation/EXECUTOR_HANDOFF.md, line 281]

### 3.2 Existing APK

- Local APK: `apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk`.
- Size: 194449552 bytes.
- Recomputed SHA-256: `b42c1be10167dc516f675de2331189d1e4025a8ecdf0ec5d300d92624d410c67`.
- Embedded build HEAD: `e927d8ee5d7f01497e85d1a4c7f64c927c26dea4`; package `com.pikemethods.training.qa`.
- Label: `NON_PRODUCTION_QA_DEBUG_SIGNED`; version `1.0.0-beta.1-QA` / code 1.
- Embedded manifest read directly from the APK; bytes match the prior verified artifact.
- The prior candidate-verification log records exit 0 at its build state. That is historical evidence, not a fresh candidate verification against the later documentation HEAD. No APK was rebuilt or relabeled.

[Source: docs/audits/rpe-familiarisation/opus/PIXEL9PRO_SMOKE_REPORT.md, line 10]
[Local evidence: scratch/pixel9pro-smoke/2026-09-03T21-59-17Z/verify-qa-candidate.log]

### 3.3 Selected Evidence Fingerprints

All paths below are relative to `scratch/pixel9pro-live-session/2026-09-03T23-42-51Z/`. These are ignored local artifacts, not attachments available in a fresh GitHub checkout. Hashes identify bytes; they do not independently establish what happened on the device. Do not publish raw captures containing personal information without redaction/authorization.

| Artifact | Bytes | SHA-256 |
| --- | --- | --- |
| `ui_caseb_state1_untouched.xml` | 25734 | `b298779242c24a82dbd4a341c5e1ed5e4d68e6cc2315fa8bba74ce215ae49984` |
| `ui_caseb_state2_rir2.xml` | 25326 | `e93d6b9811ec4d1b13bee63b2e0dcdf601bacfebdb3576ab42dba0dbf9208d06` |
| `ui_caseb_state3_rpe85.xml` | 32671 | `5173276044efe93e0332c8910286299056da7db025c88be0f0b3746b636ffaba` |
| `ui_caseb_state4_notsure.xml` | 31923 | `72c1ea72302f4387a2d7d07ef497acf0364e48ac40c5001216598d8e7276e8f0` |
| `caseB_state1_untouched_valid.png` | 162388 | `3fdfdafb8d1f52eb6f0be0013e79f3a883f724d0a21b4179e6398f5e80e03343` |
| `caseB_state2_rir2_valid.png` | 158464 | `59b86fc3d62011acd48321ebaa1a3d6b8ee9d36c26ce2a3a271418f6e8ed54bc` |
| `caseB_state3_rpe85_valid.png` | 123791 | `e66fad6d632c378c86b4c831af70a2a8ae6779d0496da2189e455cb7b8e8dbf7` |
| `caseB_state4_notsure_valid.png` | 124023 | `c8b89d548eb897a2b2db1fbb087e4a4741f42d8cc6afbb33fa264a14cb5d7fe8` |
| `caseA_01_rir_infotip_valid.png` | 130135 | `665b0936402e6c5f9104df119c06776b1c9939221f2b419a1b0c7bb7b0b85c1a` |
| `caseA_04_rpe_infotip_valid.png` | 141690 | `cbe2f83c1cf12005b20bd31a17261c99280eeaaf6e8d483ca5df49134a1cf5a6` |
| `caseC_06_after_ready.png` | 151808 | `589be35377d439af5166988eb9e8332f48bbdbba673f88733c8c0fbc1070c35d` |
| `caseC_07_set2_scrolled.png` | 176936 | `310edd20372590aa1dd5bd6e4b378d35c5209a56c942ea70114cd92a298624d7` |
| `caseD_03_foregrounded.png` | 149091 | `967678b282ebfb7a662472d6eb836e7de326779142d20425e853bfc6a6efca44` |
| `caseD_04_killed_and_relaunched.png` | 110406 | `e9415e1e1380303590a86b6402c5cb532f2a957549f2d4cf735b21c50bfcc9be` |
| `caseD_06_session_resumed.png` | 145873 | `2762aba413b0d8c662823066f1115132f7d685f032cc31c7d82083e36b95d2f5` |
| `caseE_01_upgrade_ready.png` | 111178 | `75afdbcb2a9ab5d95036b6e7f5e0f55df7eb8874399f01588aad595e1eb325da` |
| `caseE_02_upgrade_session.png` | 145934 | `c928c5572ad08ff69b9c11d97ace5026a55e30a3d1938d1a63f5d640a3e78477` |
| `caseE_03_upgrade_athlete.png` | 162095 | `89b395e9042ec6f2562be071d6a05b4c3d0d603a11ec8c034eb783cf1a3b61c8` |

## 4. Strict Remaining Work Ledger

These are current unresolved requirements or explicit limitations, not newly invented product debt.

| ID | Status | Required next action / completion evidence | Exact source |
| --- | --- | --- | --- |
| RPE-D | OPEN — device evidence | Demonstrate saved actual effort and null after cold relaunch using an authorized readback surface or isolated QA setup. Do not infer from counts, root the owner's phone, or change its package security. | `docs/audits/rpe-familiarisation/antigravity/WORKORDER_LIVE_SESSION_EVIDENCE.md:173`; `docs/audits/rpe-familiarisation/antigravity/HANDBACK_LIVE_SESSION_EVIDENCE.md:100` |
| RPE-A3 | OPEN — device evidence | Exercise the loading-method tip and both dismissal routes in an authorized non-Beginner QA context. Current no-profile-switch/no-regeneration boundaries remain in force. | `docs/audits/rpe-familiarisation/antigravity/WORKORDER_LIVE_SESSION_EVIDENCE.md:146`; `docs/audits/rpe-familiarisation/antigravity/HANDBACK_LIVE_SESSION_EVIDENCE.md:35` |
| RPE-G | EVIDENCE NOT RETAINED | Recover the original app-scoped crash/ANR output if available, or capture a fresh scoped stability check during the authorized follow-up and label its new time window. | `docs/audits/rpe-familiarisation/antigravity/WORKORDER_LIVE_SESSION_EVIDENCE.md:192`; `docs/audits/rpe-familiarisation/antigravity/HANDBACK_LIVE_SESSION_EVIDENCE.md:262` |
| C6 | NOT EVALUATED — separate release gate | Execute the existing low-memory/device gate under its own authorization; this Pixel smoke does not satisfy it. No gate waiver is implied. | `docs/audits/rpe-familiarisation/antigravity/WORKORDER_LIVE_SESSION_EVIDENCE.md:286`; `docs/audits/rpe-familiarisation/opus/PIXEL9PRO_SMOKE_REPORT.md:159` |
| OWNER-PUSH | NOT AUTHORIZED by this closeout | Obtain owner acceptance and explicit publication authority; review the actual aggregate PR scope before merge. | `docs/audits/rpe-familiarisation/opus/OPUS_REAUDIT_ROUND3.md:234`; `docs/audits/rpe-familiarisation/antigravity/WORKORDER_LIVE_SESSION_EVIDENCE.md:24` |

The deliberately unfinished workout is preserved evidence, not an instruction to complete or delete it. Older-version upgrade coverage was not required by this same-APK work order; its absence is a limitation, not a newly added task.

## 5. Local PR Preparation — Not Submitted

### 5.1 Verified Integration Scope

- Remote default branch is `master`, not `main`.
- Live read-only remote query returned `master = 4c5056fc40b132c11436c22f9207af5256929775`.
- At reviewed HEAD, branch is 131 commits ahead and 0 behind that base.
- Aggregate diff contains 310 paths: 25 mobile source, 25 mobile test, 30 inference, 29 database schema, 16 other database, 7 Android, 34 tooling, 111 documentation, and 33 other paths.
- This includes accumulated programming-quality, routine/progression/suspension, database, native/build, and documentation work. It must not be described as a small RPE-only PR.
- These are snapshot counts before this documentation closeout; recompute at the eventual committed tip and current remote base.
- Inventory commands: `git ls-remote --symref origin HEAD refs/heads/master refs/heads/codex/rpe-familiarisation`, `git rev-list --left-right --count 4c5056fc40b132c11436c22f9207af5256929775...HEAD`, and `git diff --name-status 4c5056fc40b132c11436c22f9207af5256929775...HEAD`.
- No remote feature-branch ref was returned. No publication was attempted.

### 5.2 Proposed PR Text

**Title:** Integrate training-program updates and beginner RPE/RIR guidance

**Summary:** This is an accumulated integration branch, not solely a terminology change. It includes programming/routine/progression and supporting database/build work, plus explicit optional RIR/RPE entry and the offline glossary. Review the complete file diff by subsystem.

**Verification:** Current local `verify:ci` passes, including 280 mobile component tests. Existing Pixel captures support the effort-control cycle, next-set reset and visible session continuity. Saved per-set effort readback and loading-method tooltip device coverage remain incomplete. Same-APK reinstall coverage does not establish older-version migration safety. C6 is not evaluated.

**Review request:** Check the full aggregate diff, particularly data migrations, actual-versus-target effort separation, routine/progression behavior and native/CI changes. Treat historical agent approvals as scoped to their recorded commits. CodeRabbit feedback supplements, but does not replace, device evidence or owner acceptance.

**Release boundary:** Review-only; no production release or C6 waiver requested. Raw private device captures are not included in the repository.

### 5.3 Next Executor Instructions

1. Read Entry 0070 and this report; verify the working tree before touching existing changes.
2. Do not start another open-ended audit cycle or unrelated feature work. The focused outstanding device cases are RPE-D and RPE-A3; retain scoped stability logs alongside the follow-up.
3. Request authorization for an isolated QA profile/build or a read-only evidence surface if existing authorized access cannot complete those cases. Do not modify the owner's active profile, training records or security settings to bypass a test limitation.
4. Keep expected values separate from directly observed persisted values. Record artifact/build identity and exact evidence for any new run. Do not grant all-device PASS while a required case is unverified.
5. Only after explicit owner instruction, commit the documentation closeout and prepare a draft PR against `master`, recomputing its full scope. Do not rebase, cherry-pick, merge, push or publish artifacts under this report alone.
6. Hold merge/release until the aggregate integration review and applicable release gates are satisfied. A draft PR for feedback, when authorized, is not a release.
