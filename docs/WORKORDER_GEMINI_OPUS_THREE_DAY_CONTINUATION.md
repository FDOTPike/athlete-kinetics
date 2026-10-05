# Gemini Execution / Opus Audit: Three-Day Continuation Queue

## 1. Decision and Current State

- Prepared 2026-09-04 at owner request. This is a work queue, not an automation or a promise of a usage-reset time.
- Gemini is the executor. A fresh Opus context is the auditor and may issue scoped technical verdicts without waiting for Codex.
- Owner retains approval of publication, merge, signing, release, physical-device writes and any scope expansion not explicitly permitted below.
- Workspace: `C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\rpe-familiarisation`.
- Branch: `codex/rpe-familiarisation`; dispatch HEAD `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72`.
- Current state: dirty, deliberately. Opus has already added the selector-container flex fix, a test ID and a regression test; do not reimplement these from scratch.
- Latest declared result: `SOL REVIEW REMEDIATION COMPLETE — LAYOUT FIX UNIT-PROVEN, DEVICE RE-VERIFICATION PENDING`.
- The APK with hash `b42c1be10167dc516f675de2331189d1e4025a8ecdf0ec5d300d92624d410c67` predates this layout fix. It cannot demonstrate the fix.
- Earlier emulator database evidence independently supports actual RPE 8.0, SQL NULL for unanswered effort, and separate target 6.5. No RPE redesign is requested.
- AVD files `rpe_isolated_qa_avd.avd` and `rpe_isolated_qa_avd.ini` were still present at dispatch inspection. “AVD destroyed” is not established; distinguish shutdown from deletion and inspect before recreating anything.
- Current code has a test that silently skips missing option containers, and the corrected log summary still misidentifies the five error-level lines. W1 addresses these bounded residuals.

Sources: `PROMPT_LEDGER.md:4685`, `PROMPT_LEDGER.md:4746`, `apps/mobile/test/components/RoutineTemplateBuilder.test.js:123`, `docs/audits/rpe-familiarisation/antigravity/HANDBACK_ISOLATED_QA.md:222`.

## 2. Order and Roles

| Order | Gemini executor | Opus auditor | Dependency / outcome |
| --- | --- | --- | --- |
| W1 | Harden existing selector regression; reconcile evidence | Reproduce fail-closed assertions, inspect minimal diff and computed evidence | Ready now; technical approval permits W2 |
| W2 | Build current QA artifact; visually verify selector on isolated emulator | Verify build identity, inspect actual screenshots/XML and runtime checks | After W1; measured layout result, not just style assertions |
| W3 | Prepare current aggregate integration inventory and review packet | Review the actual PR-sized code delta and record coverage | After W2; review-ready does not mean merge-authorized |
| W4 | Prepare C6 and release prerequisites, using current repository gates | Check provenance requirements and outstanding owner decisions | Preparation only; physical C6 and release remain blocked |
| W5 | Prepare exact proposed commit/publication commands and file list | Verify proposed landing scope and approval state | Owner approval required before executing any publication action |

Do not reinterpret this queue as a backlog of every historical checkbox. Do not reopen completed audits merely because an older document still says OPEN.

## 3. Shared Execution Rules

1. Read applicable repository instructions, Entries 0070–0075, and the existing Codex closeout. Snapshot HEAD, status, diff and fingerprints before work. Preserve all inherited modifications and untracked audit documents.
2. Only one agent writes in the worktree at a time. Gemini stops writing at handoff; Opus reviews that frozen state. Pass handbacks manually between their chats unless your existing tooling already provides an authorized handoff.
3. Each executing role appends the next unused ledger entry as its first tracked write, with exactly one Input and one Output. Record the received prompt verbatim and this work order's path/hash separately. Closed history is append-only.
4. Freeze means a named HEAD plus exact tracked diff fingerprint and hashes of relevant new files when work is uncommitted. HEAD alone does not identify this candidate. Store the machine-generated freeze inventory under the current packet directory.
5. No commit, staging, reset, stash, clean, rebase, branch switch, cherry-pick, push, PR creation, merge, tag, production signing or release is authorized by this document. Building a local QA APK is authorized under W2.
6. Do not copy private screenshots, raw athlete data or databases into tracked files or GitHub. Synthetic/raw local evidence belongs in ignored scratch; tracked summaries must be redacted.
7. No owner-phone interaction is authorized here. Use isolated synthetic QA only. No root on a physical device, personal profile switching, storage clearing, account access, device security changes or real workout logging.
8. W1 product scope is only the selector and its focused test. W2 may adjust that same layout if observation proves it still clips. No training algorithm, glossary definition, schema, dependency, biometrics or native-build-script changes.
9. Opus audits; it does not repair product code and then call its own repair independently approved. Prior Opus authorship of the initial flex fix must be disclosed. Use a fresh review context; do not claim multiple independent reviewers.
10. Use one review pass plus one targeted remediation pass per work order. Persistent blockers or a material scope change produce a precise handback, not an endless audit loop. Do not suppress newly discovered material defects to meet this limit.
11. Pass/FAIL statements and hashes must come from tools and cited evidence. Do not generate or manually complete hash suffixes.
12. No new licence acceptance, elevation, reboot, paid service or weakened security during unattended work. Stop cleanly instead of waiting for the absent owner.

## 4. W1 — Finish the Existing Selector Fix and Evidence Corrections

### 4.1 Gemini Work

Preserve the existing flex fix. Inspect its actual diff rather than assuming Entry 0074 proves runtime layout.

Authorized product files:
- `apps/mobile/src/components/RoutineTemplateBuilder.tsx`
- `apps/mobile/test/components/RoutineTemplateBuilder.test.js`

Required test corrections:
- Replace the `queryByTestId` / `if (container === null) continue` pattern. A missing expected control must fail.
- Explicitly require every currently selectable schema option and its matching pressable. Use the canonical selectable-schema contract plus explicit expected non-retired labels; never skip a missing method.
- Check all relevant option containers/pressables, not only Linear.
- Preserve selection and tooltip behavior tests. Verify a missing control and the missing parent-flex regression both fail in a controlled negative test/probe.
- A style assertion is not a pixel measurement; leave final layout verification to W2.

Evidence corrections:
- Recompute all 43 existing manifest rows from the actual files. Correct mismatches if any remain; preserve raw evidence bytes and record what changed.
- Re-read `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/emulator_full_logcat_dump.log` using a real log parser or an anchored pattern.
- The earlier Codex extraction found three FrameTracker lines on PID 3764 and two “Not starting debugger…” lines across PIDs 3764/6208. Verify rather than copy this count. The current “five FrameTracker lines on PID 3764” claim is not supported by those raw lines.
- Record exact diagnostic categories and distinguish error priority from a crash/ANR. Do not manufacture a crash finding from ordinary platform diagnostics.
- Do not treat the suspicious common hash prefixes as proof of intent or provenance. Establish the measurable fact: original digests did not match, regenerated digests do.
- Keep Opus's corrected Case B description as corroboration, not gap-filling. Do not count the selectable RPE 6.5 input chip as a target prescription.
- Correct new summaries about the existing AVD based on actual inventory. Do not rewrite closed ledger history; append a correction.
- Do not overwrite the historical Codex closeout and its recorded hashes; add the current disposition in this packet.

Run targeted component tests and `npm.cmd run verify:ci` after final product changes. Record commands, exit codes and warning limitations.

### 4.2 Opus Acceptance

- Inspect the exact candidate diff.
- Execute the focused tests and fail-closed probes; require absent options to fail.
- Independently recompute the 43 evidence fingerprints.
- Independently reproduce the log categorization from raw output.
- Confirm only authorized product files changed.
- Verdict: `W1 APPROVE`, `W1 REQUEST CHANGES`, or `W1 BLOCKED`, bound to the freeze inventory.
- Approval is for moving to W2, not a claim that device layout already passed.

## 5. W2 — Current APK and Observed Layout

### 5.1 Gemini Work

Read the existing QA build procedure and current build/verification code before starting:
- `docs/PRE_RELEASE_ANDROID.md`
- `docs/audits/rpe-familiarisation/opus/PIXEL9PRO_SMOKE_REPORT.md`
- `apps/mobile/android/app/build.gradle`
- `tools/verify_qa_artifact.mjs`

Preserve the old APK and its identity in a uniquely named ignored evidence directory before rebuilding. Do not overwrite the sole copy of previously cited evidence.

Build and provenance sequence:
1. Verify existing dependencies, Java/SDK/NDK/model prerequisites. Do not rerun installation or download steps blindly.
2. Finish ledger initialization and intended pre-build tracked writes.
3. Freeze exact source inputs, including dirty diff and relevant new files. Do not claim a clean checkout.
4. Run the required current verification; reuse W1's full CI result only if tested product/config inputs are byte-identical and identify it as that prior run.
5. Build the existing QA variant with the repository's documented command.
6. Immediately run `npm.cmd run verify:qa-candidate` while tracked build inputs are unchanged. The verifier compares current HEAD, branch and tracked-diff fingerprint, so a dirty candidate must be honestly represented.
7. Save APK, SHA-256, embedded manifest and verification logs. Do not bypass a provenance failure, patch the verifier, stage files or commit to make it pass.
8. Later documentation writes may change the tracked fingerprint; record that transition. Never describe the earlier artifact as built from later documentation or a later commit.

The current verifier supports exact dirty-diff provenance; a verified local QA artifact is not a clean release candidate. If tooling rejects the candidate, diagnose within setup scope and stop rather than weaken the gate.

Emulator procedure:
- Inspect existing AVDs and preserve their evidence/data. Prefer a fresh uniquely named synthetic AVD; do not wipe an existing one.
- Installed official SDK/emulator tools may be reused. Apply the isolated-device protections from the prior unattended work order.
- Every mutating adb operation names the verified emulator serial explicitly.
- Install the NEW hash-verified APK on that isolated emulator.
- Create a synthetic Intermediate athlete through normal UI and reach the routine builder.
- At ordinary phone width and a narrower supported phone width, capture all three method labels and their controls. Also inspect an enlarged font setting. Record actual viewport density, width in dp, font scale and screenshot dimensions.
- Linear, Undulating and Autoregulated must be readable and tappable without overlapping adjacent info buttons. Measure primary control bounds against the repository touch-target contract; pixel bounds alone are not dp.
- Select each method through the UI and verify the visible selection changes. Open the matching explanations and test tap-away and Android Back dismissal.
- If the simple flex fix still clips at the tested sizes, adjust only this selector's layout (for example wrapping or stacking) without changing labels or behavior, then rerun affected gates/rebuild. Retain before/after evidence.
- Retain app-scoped crash/ANR logs for the new run.
- Perform a short neutral → selected effort → neutral regression check on the new artifact. Link the actual target header to the same session/slot; a numeric input chip does not establish the target.
- Preserve the original emulator database proof. Repeating the entire persistence experiment is not required for a layout-only change unless runtime/source evidence gives a concrete reason.
- Shut down only the emulator you created. Preserve its AVD and logs; do not claim it was deleted.

### 5.2 Opus Acceptance

- Match reviewed source freeze to embedded build provenance and actual APK hash.
- Inspect screenshots directly, not just XML strings or test names.
- Recompute control bounds/density and confirm all three labels and selection states.
- Check matching tooltip content and both dismissal routes.
- Check new log evidence and ensure no report attributes emulator results to the Pixel.
- Verdict: `W2 APPROVE` only when the layout is observed. If not, return the exact viewport/control defect.
- Original Pixel saved rows remain NOT RE-VERIFIED. Saved-RPE history UI remains NOT AVAILABLE. Neither status is a reason to add an unrequested feature.

## 6. W3 — Aggregate Integration Review Packet

### 6.1 Gemini Work

This branch was previously 131 commits / 310 paths ahead of remote master. Those are old snapshot counts, not current truth.

Read-only Git work:
- Query the current remote default branch and tip; do not assume main or reuse stale counts.
- Resolve the actual merge base. If remote objects are absent, report that limitation or use a narrowly scoped read-only retrieval; do not pull/rebase/change the checkout.
- Generate current commit/path inventory grouped by mobile UI/state, inference, database/migrations, native/build/CI, tests, documentation and generated artifacts.
- Map each substantive group to its existing work order, implemented changes, test evidence, prior review freeze and still-open findings.
- Distinguish completed programming-quality/intake work from current RPE work. Do not redispatch the old implementation just because its original work order says READY.
- Identify unexpected/accidental tracked artifacts and unresolved scope decisions; propose disposition, do not delete them.
- Prepare a draft PR title/body, verification matrix, risk summary and rollback considerations. No PR is created.

### 6.2 Opus Acceptance

- Audit the actual aggregate code delta, not merely the last flex commit or handback.
- Prioritize migrations/data preservation, actual-versus-target separation, program/routine/progression behavior, and native/CI changes.
- Record reviewed and unreviewed files/subsystems explicitly. Tests and old agent verdicts do not substitute for semantic coverage.
- Reproduce the required integration gates at the frozen candidate. Do not claim full coverage if time/context stops the review.
- Return actionable findings bound to code lines, reproducer and severity. Out-of-scope fixes require a separate owner dispatch.
- Verdict: `INTEGRATION REVIEW APPROVE`, `REQUEST CHANGES`, or `PARTIAL COVERAGE`. No silent promotion from partial review to merge readiness.
- There is no mandatory wait for Codex; Opus provides the delegated technical verdict and the owner decides publication.

## 7. W4 — C6 / Release Preparation Only

Use current executable contracts, not stale narrative thresholds:
- `tools/memory-audit/audit.mjs`
- `tools/memory-audit/memory_gate.mjs`
- `tools/memory-audit/budget.json`
- `tools/memory-audit/meminfo_harness.mjs`
- `tools/memory-audit/evidence_provenance.mjs`
- `docs/PRE_RELEASE_ANDROID.md`

Gemini prepares:
- Exact required physical reference-device properties, test scenarios, artifact identity, evidence files and verifier invocation from the current contracts.
- A checklist separating tooling ready, owner/device access needed, and measurements NOT RUN.
- Current release-gate map, including C6 and owner-only C7/publication decisions.
- Store/signing/privacy paperwork inventory as preparation only. If quoting current platform requirements, verify official sources; do not treat the July release checklist as current legal/platform guidance.
- Do not accept terms, create paid accounts, access signing secrets, submit declarations, sign a production build or execute physical-device stress tests.

Opus verifies:
- Emulator success has not been used as physical 4 GB evidence.
- No threshold, envelope, measurement or release policy was weakened.
- Missing evidence remains missing; an expected closed gate is not PASS.
- The proposed runbook is executable once the owner supplies the required device and explicit authorization.

Completion token: `C6 PREPARATION READY — PHYSICAL GATE NOT RUN`, or a precise setup blocker. Actual C6 remains held.

## 8. W5 — Owner Landing Decision

Prepare, but do not execute:
- Exact changed-file list proposed for commits, separated into product/test and evidence/documentation groups.
- Review verdicts and freeze IDs supporting each group.
- Proposed target branch/remote and PR scope, freshly verified.
- Known untracked/private material to exclude; avoid broad `git add .`.
- State separately: local QA ready, review-ready, commit-ready, push-authorized, merge-ready and release-ready.

Owner must explicitly authorize committing/pushing/PR creation. Even a successful technical audit does not authorize merge or production release. If C6 is still open, report it; do not root the Pixel or manufacture evidence to clear it.

## 9. Deferred / Not Automatically Restarted

- Programming-quality and intake remediation: existing implementation/review history, not a fresh queue item. W3 checks inclusion and regressions.
- Advanced biometric RPE research: separate branch and unresolved research reviews; not required for this non-biometric learning feature. No pilot, sensor collection, SpO2 or biometric-RPE implementation.
- Saved-RPE history UI: documented absence, not authorized feature work.
- Original Pixel SQL readback: remains unverified; no phone-security changes.
- Full public-store/iOS rollout: separate scope and owner decisions. This is an Android QA/integration continuation.
- Other worktrees: preserve them. This queue is not an audit or cleanup of every branch on the machine.

## 10. Handoff Files and Ready-to-Paste Prompts

Use `docs/audits/rpe-familiarisation/continuation/` for:
- `W1_EXECUTOR.md`, `W1_OPUS_AUDIT.md`
- `W2_EXECUTOR.md`, `W2_OPUS_AUDIT.md`
- `W3_INTEGRATION_PACKET.md`, `W3_OPUS_AUDIT.md`
- `W4_C6_RELEASE_PREPARATION.md`, `W4_OPUS_AUDIT.md`
- `OWNER_LANDING_DECISION.md`

Each handoff includes exact freeze identity, changed files, commands/exit codes, evidence paths/hashes, limitations and next authorized step. Do not use self-approval as an audit result.

### Gemini Start Prompt

```text
You are the executor, not the auditor.
Work in C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\rpe-familiarisation.
Read docs/WORKORDER_GEMINI_OPUS_THREE_DAY_CONTINUATION.md and applicable repository instructions.
Start with W1, preserving the existing uncommitted Opus layout fix and all other inherited changes.
Execute only the current work order, create its frozen handoff, and stop for fresh Opus review.
After Opus APPROVE is supplied, continue to the next authorized work order; do not wait for Codex.
Do not touch my physical Pixel, commit, push, merge or release. Stop with a handback on a scope/permission blocker.
```

### Opus Start Prompt

```text
You are the independent auditor for Gemini's continuation work, not its product executor.
Work in C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\rpe-familiarisation.
Read docs/WORKORDER_GEMINI_OPUS_THREE_DAY_CONTINUATION.md and Gemini's current numbered handoff.
Use a fresh audit context. Disclose that an earlier Opus session authored the inherited initial flex fix.
Verify the exact frozen candidate, reproduce the stated checks, inspect visual evidence yourself, and compute hashes using tools.
Write a scoped APPROVE, REQUEST CHANGES or BLOCKED/PARTIAL COVERAGE verdict with actionable evidence.
Do not repair product code or count prior claims as proof. Do not require Codex to return before issuing your technical verdict.
Do not commit, push, merge, release or touch the physical Pixel.
```
