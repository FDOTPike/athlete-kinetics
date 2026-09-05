# Work Order: Opus W2 Path A Closeout, Then W3 Handoff

## 1. Start here

- Prepared by Codex on 2026-09-05 for the owner's request to review Opus's recent work and prepare the next work order.
- Workspace: `C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\rpe-familiarisation`.
- **Gemini has already submitted the preferred Path A recapture in Entry 0081. Do not send it back to repeat that work by default.**
- Immediate task: a fresh Opus audit of the Path A evidence delta against `W2_OPUS_AUDIT_R2.md` §7. F4/F5/F6 and W1 stay closed unless new contradictory evidence is found.
- This document supersedes the older instruction to start W2 remediation again. Original work order `docs/WORKORDER_GEMINI_OPUS_THREE_DAY_CONTINUATION.md` remains controlling for scope, safety and W3-W5.
- No W2 approval is issued by this work order. The newest on-disk auditor verdict remains REQUEST CHANGES; Gemini's claim of closure is a submission for review.

## 2. What changed after the pasted Opus report

### 2.1 Current packet

- Opus R2, dated 2026-09-04, correctly verified the selector fix and held only the final-APK capture attribution. Sources: `docs/audits/rpe-familiarisation/continuation/W2_OPUS_AUDIT_R2.md:9`, `:170`, `:259`.
- Gemini subsequently recorded installing the preserved final APK at 11:52:18 UTC and recapturing the evidence at 11:53:32-11:55:31 UTC, without a rebuild. The new handback explicitly distinguishes the missing preliminary APK from the final candidate. Source: `docs/audits/rpe-familiarisation/continuation/W2_EXECUTOR.md:24`; `PROMPT_LEDGER.md:4992`.
- Codex independently rehashed the full inventory and APK, checked the live diff fingerprint and viewed the NEW large-font screenshot. All listed digests match, and the selector labels are complete in that image.
- This Codex pass did not launch an emulator, reproduce installation, rerun tests/CI or repeat the artifact gate. The earlier successful Windows artifact gate remains attributed to the earlier Codex pre-documentation check.

### 2.2 Read-only dispatch identity

These values were measured BEFORE Codex appended Entry 0082.

| Item | Verified value |
| --- | --- |
| Branch / HEAD | `codex/rpe-familiarisation` / `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72` |
| Current pre-0082 diff | `ad34457816be94342228adb8109fa43fbf0e8904511353218c6449ca6a07728c`, 88149 bytes |
| Original APK build diff | `0de694091f75b89541c3c8b1c290a8e0919bd0bddbaeafd732fe00b289717203`, 73357 bytes |
| Candidate APK | `apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk`, 194450340 bytes |
| Candidate SHA-256 | `3777054f246a01e30bfc28a33181791e09de93be928f515959ebc2440d4b858d` |
| Selector source SHA-256 | `98e8aef8d18a056b6fb4a47db4ac3e559bc8bc97bdfcd51ebc0dff31f4dacbc1` |
| Focused test SHA-256 | `104e0cbd77741a16e3367673b95771e07e38e4142685d3d9978e4c66c6904343` |
| W2 R2 audit SHA-256 | `1c430695851cce9f86e97a22d9f7ef139e5ea8866c971a205a1f5ad1ced333b7` |
| Current W2 handback SHA-256 | `6d91bf6cb1215834d9884c75952fb4cd57e7158f73dac55aaa8298e69567a9a6` |
| Current W2 inventory SHA-256 | `af3a46f47db568810f07e189e064bc9cd316c46024ae9dbb83ee9d47e39d1496` |
| Pre-0082 ledger | 362033 bytes; `11ba356481d38c4c062f4eaf2532455080b8e834015105837d435c743284cdf3` |
| New large-font screenshot | `scratch/continuation/evidence/15_font13_autoregulated.png`; `177f361e4b36a425d4e3c2bdfec2fc05878100daf5062ca79460057aeb0c5517` |

The current inventory contains **47 records / 45 distinct paths**: 44 array records plus three named APK records, with two paths repeated across those groups. All 47 records matched. The handback's 45/45 is consistent with distinct-path counting; label the denominator explicitly instead of inventing a hash failure.

## 3. Opus: one delta-only review

1. Read applicable repository instructions, this work order, the original queue, `W2_OPUS_AUDIT_R2.md`, current `W2_EXECUTOR.md`, `FREEZE_INVENTORY_W2.json`, and Entries 0080-0082. If a newer closeout already exists, inspect it instead of overwriting or repeating it.
2. Snapshot identity BEFORE any ledger write. Append the next unused entry, preserving closed entries and CRLF. Hash drift caused solely by this review's later documentation is not an APK defect.
3. Confirm the candidate/source/test identities above; compare the current Path A packet against the R2 request. Do not re-audit W1, redesign the selector, repeat full CI for unchanged product inputs or rebuild for documentation.
4. Check the new capture chronology and installation attribution. Distinguish the earlier `adcc6cdb...` run from this `3777054f...` submission. Verify new image hashes/contents, configuration evidence and the current large-font dump; do not count the older images as new captures.
5. Keep evidence attribution honest. The current handback records the installation, but Codex did not locate raw installer output in the retained continuation log files. Check device/host timezone conversion and distinguish an installation transcript from later runtime logs. Establish what can be corroborated from the submitted evidence and state any reliance on executor attestation. A file modification timestamp is supporting chronology, NOT proof that an old source file could never have been edited/restored.
6. Carry forward the earlier Windows artifact-gate result for the exact unchanged APK with attribution. Do not rerun it against later ledger text and call the expected fingerprint mismatch an APK regression; do not use fixture mode or weaken the verifier.
7. Include the bounded record clarifications in §4 in your audit/ledger append. They do not require an extra product cycle or rewriting closed history.
8. Write `docs/audits/rpe-familiarisation/continuation/W2_OPUS_AUDIT_R3.md`, binding the verdict to the exact APK and reviewed packet hashes. State checks reproduced, inherited results and residual limits separately.
9. Issue `W2 APPROVE — CR-W2-01 CLOSED` only if the final-APK attribution is sufficiently established. Otherwise return the exact missing evidence or contradiction, not another general request to redo W2. Opus does not repair product code and then independently approve itself.

## 4. Record clarifications and retained owner decisions

- **Build versus capture state:** Entry 0081's “Pre-capture boundary” labels the original 73357-byte build fingerprint as though it were the later worktree state. The current handback §4 correctly separates build and post-recapture fingerprints. State that clarification in the next append; do not edit Entry 0081 or claim a later live-worktree gate passed against the old fingerprint.
- **Counting:** report 47 inventory records / 45 distinct paths, zero mismatches at the pre-0082 snapshot. Do not classify the repeated references as different artifacts or a new blocker.
- **Timestamp inference:** Opus R2's claim that an unchanged modification time proves identical source across both builds is too strong. Do not use it as the basis for final-artifact approval. This clarification does not reopen the verified layout.
- **F7:** documentation corrected; shared InfoTip still below the repository's nominal 56 dp touch contract. Fix/waiver not authorized.
- **O1:** raw LINEAR/APRE tooltip titles remain an owner decision.
- **O3:** slot-role ACC clipping at font scale 1.30 remains an owner-disposition/W3 review item, not part of this selector-evidence repair.
- Preserve older reports and whatever raw evidence remains. Where old paths have been replaced by the newer captures, disclose that fact; do not imply historical hashes still resolve to the current contents.
- Do not turn accurate administrative clarification into repeated rebuilds or repeated reviews of unchanged code.

## 5. Gemini contingency only if evidence is still missing

- Do NOT start another emulator session merely because this work order exists. Path A is already submitted.
- If Opus identifies one necessary missing item, provide a bounded Gemini task naming that exact evidence and acceptance test. Prefer recovering existing execution output or checking the preserved installed artifact over repeating all 18 images.
- Any required emulator action remains under the original isolated synthetic W2 workflow: inspect the AVD first, preserve its data, explicitly target the verified emulator serial and use the unchanged hash-verified QA APK.
- No physical Pixel, clear-data/reset, APK rebuild, algorithm, glossary, InfoTip, role-row, dependency, native or release-gate edits.
- Preserve this packet before any correction. Use a new uniquely named evidence directory; never overwrite the sole remaining cited capture.
- If a material contradiction or missing authority persists, stop with a precise handback. Do not substitute repeated self-certification for evidence.

## 6. After W2 approval: move forward

- Opus issues Gemini the W3 integration-packet task under original work order §6. Gemini inventories the actual remote/default branch, merge base, code delta, work-order mapping, evidence and draft PR; it stops writing for Opus's aggregate audit.
- Opus reviews the actual aggregate code delta and integration gates, recording reviewed/unreviewed paths. Use checkpoints when context runs short; resume coverage rather than restart.
- F7/O1/O3 remain visible in that packet. Their implementation requires a separate owner-approved scope; W3 does not silently authorize those fixes.
- W4 remains C6/release PREPARATION only. W5 remains a proposed file/commit/PR landing package for owner approval. Follow the existing queue, not a new audit of every historical worktree.
- No staging, commit, push, PR creation, merge, signing or release is authorized. The offer to commit in the pasted Opus report is not owner consent. C6 remains NOT EVALUATED.

## 7. Ready-to-paste Opus prompt

```text
Work in C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\rpe-familiarisation as the fresh Opus auditor.
Read docs/audits/rpe-familiarisation/continuation/WORKORDER_OPUS_W2_PATH_A_CLOSEOUT.md and follow it with the original continuation work order.
Gemini already completed the requested Path A recapture in Entry 0081. Review that existing packet; do not commission the recapture again by default. Keep W1 and F4/F5/F6 closed.
Verify the final-APK attribution and only the evidence delta, record any executor-attested limits honestly, and include the small record clarifications without editing closed ledger history.
Write W2_OPUS_AUDIT_R3.md with a scoped verdict. If W2 is approved, issue Gemini the W3 integration-packet task and audit its frozen result under the existing queue; do not wait for Codex.
If evidence is still insufficient, request only the exact missing item, with a bounded Gemini task. Do not rebuild, restart the layout audit or expand into F7/O1/O3 fixes.
Do not touch my physical Pixel, stage, commit, push, create a PR, merge, sign or release. This is not acceptance of your offer to commit.
```
