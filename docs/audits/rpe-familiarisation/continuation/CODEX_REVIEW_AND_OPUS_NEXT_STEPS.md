# Codex Review and Opus Remaining-Work Dispatch

## 1. Decision and scope

- Date: 2026-09-04. Workspace: `C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\rpe-familiarisation`.
- Roles remain Gemini/Antigravity executor and a fresh Opus context auditor. This is a handoff for the owner to send, not evidence that an external agent has received it.
- Read `docs/WORKORDER_GEMINI_OPUS_THREE_DAY_CONTINUATION.md` first. Its scope and safety rules remain controlling. This update replaces its stale instruction to START W1 with the current queue below.
- Review conclusion: W1 is approved; the W2 layout correction is supported by saved images, XML and focused tests; the final APK independently passes the artifact gate. W2 still needs Opus's remediation verdict and a precise link between the captured build and final APK.
- This is a scoped review of continuation work, NOT aggregate branch approval, live device certification or permission to publish.
- No new product fix, physical-device action, staging, commit, push, PR, merge or release is authorized here.

## 2. What Antigravity and Opus accomplished

### 2.1 W1 is finished

- Gemini replaced the selector test's silent missing-control skip with strict queries, checked every canonical selectable method and retained selection/tooltip interaction coverage.
- Opus caught an incorrect freeze digest and an incomplete log correction. Gemini corrected them; Opus's Round 2 explicitly closes F1/F2 and grants `W1 APPROVE`.
- Do not reopen W1 or repeat its database experiment without a concrete new regression.
- Sources: `docs/audits/rpe-familiarisation/continuation/W1_EXECUTOR.md`; `docs/audits/rpe-familiarisation/continuation/W1_OPUS_AUDIT.md`; `docs/audits/rpe-familiarisation/continuation/W1_OPUS_AUDIT_R2.md:6`.

### 2.2 W2 materially improved the screen

- The first Opus W2 audit correctly rejected clipped large-font labels (F4) and a duplicated large-font XML dump (F5). It also explicitly disclosed that Windows SDK artifact checks and full CI were not reproduced in that audit.
- Gemini changed only the authorized selector layout: vertically stacked, full-width choices with padding and spacing. The focused test file is unchanged from W1.
- Current saved captures show complete Linear, Undulating and Autoregulated labels at ordinary width, 360 dp width and font scale 1.30. The current large-font XML is genuinely distinct.
- Assessment: the executor made a sensible bounded fix, and the auditor caught real user-visible and evidence-quality problems. The remaining concern is evidence attribution, not a reason to redesign RPE or restart completed work.
- Sources: `docs/audits/rpe-familiarisation/continuation/W2_OPUS_AUDIT.md:187`, `:249`; `docs/audits/rpe-familiarisation/continuation/W2_EXECUTOR.md:11`; `apps/mobile/src/components/RoutineTemplateBuilder.tsx` (selector and schema styles).

## 3. Independently checked by Codex in this pass

### 3.1 Reviewed pre-documentation snapshot

All results in this subsection were obtained BEFORE Entry 0079 was appended.

| Field | Value |
| --- | --- |
| Branch | `codex/rpe-familiarisation` |
| HEAD | `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72` |
| Dirty-diff SHA-256 | `0de694091f75b89541c3c8b1c290a8e0919bd0bddbaeafd732fe00b289717203` |
| Diff bytes | 73357; method `sha256(git diff --full-index --binary HEAD)` |
| APK | `apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk` |
| APK SHA-256 | `3777054f246a01e30bfc28a33181791e09de93be928f515959ebc2440d4b858d` |
| APK bytes | 194450340 |
| Embedded build time | `2026-09-04T10:52:48.487332900Z` |
| Selector source SHA-256 | `98e8aef8d18a056b6fb4a47db4ac3e559bc8bc97bdfcd51ebc0dff31f4dacbc1` |
| Focused test SHA-256 | `104e0cbd77741a16e3367673b95771e07e38e4142685d3d9978e4c66c6904343` |

- Recomputed all 42 W2 inventory records: zero mismatches. The snapshot fingerprint and actual APK matched the freeze.
- Ran `npm.cmd run verify:qa-candidate`: exit 0, `QA ARTIFACT VERIFIED`. This included the actual Windows SDK tools, package/permissions, packaged model/font, Hermes bundle, debug-signature verification, zip alignment and 28 ELF64 library checks.
- Ran `npm.cmd run verify:components -- apps/mobile/test/components/RoutineTemplateBuilder.test.js`: exit 0, 17/17 tests.
- Raw read-only results are retained locally in ignored scratch, not for publication:
  - `scratch/continuation/codex-review/qa-candidate-before-review-docs.log`; SHA-256 `79df5596ba5e39757e1ca4ef6480a24b3d4adc8cc0ef250348232307bc675059`.
  - `scratch/continuation/codex-review/routine-builder-focused-tests.log`; SHA-256 `2ad4376f91a2f698d560d909313811e22c2e9a617edcbc6a8e94e77880c74548`.
- Source inventory: `docs/audits/rpe-familiarisation/continuation/FREEZE_INVENTORY_W2.json:1`.

### 3.2 Saved layout evidence

Codex directly viewed screenshots `01_standard_width_linear.png`, `12_narrow_width_autoregulated.png` and `15_font13_autoregulated.png` under `scratch/continuation/evidence/`. All three names are readable in those images.

Bounds independently recalculated for ALL three selector buttons from each corresponding XML:

| Configuration | Density | Button width x height |
| --- | --- | --- |
| 411.4 dp viewport | 2.625 | 347.43 x 56.00 dp |
| 360 dp viewport | 3.0 | 296.00 x 56.00 dp |
| 411.4 dp, font scale 1.30 | 2.625 | 347.43 x 56.00 dp |

- `ui_builder.xml`: 35002 bytes; SHA-256 `b9b9051bd9537de239143e2dfea302679647bafaf233f438350582f314655d77`.
- `ui_narrow_builder.xml`: 27679 bytes; SHA-256 `97e1df66d6b86c3452db555842b805482010c17a2de5690035abc820ba843c12`.
- `ui_font13_builder.xml`: 29427 bytes; SHA-256 `b67f21591c2d1f4122058ce2f9acb3933a67796fc4afe51d07b581f493f0c592`.

Limits: these are retained emulator observations. Codex did not launch an emulator, install anything, reproduce every interaction, rerun full CI or audit the aggregate branch in this pass. Gemini's full component/CI results remain executor-reported; Opus must label any results it reproduces versus relies on.

## 4. Remaining findings and dispositions

### 4.1 CR-W2-01: Final-APK/device-capture lineage needs clarification

- Type: evidence/provenance gap; holds unqualified W2 approval for the final APK, not an established product defect.
- Entry 0078 explicitly records installed APK `adcc6cdb19778e18ac52eeeb0bc713e600b9aaff0584f6a2749d41eda595503f` (194450436 bytes) with diff fingerprint `995a2ffc0dd4b0313f647b7da95d92c56855f70d4307e16392527d6bf6869dc9`.
- The current W2 handback and freeze instead identify APK `3777054f...`, and the handback's install statement does not explain a second build/capture boundary.
- On-disk UTC modification times: screenshot 01 at 10:36:05; 12 at 10:37:05; 15 at 10:37:48. The final APK embeds a build time of 10:52:48.487332900Z. File times are corroborating clues, not cryptographic capture attestations.
- A documentation-only rebuild is a plausible explanation, NOT yet a verified fact. Matching HEAD alone cannot prove identical product inputs on a dirty tree.
- Closure: identify the actual installed/captured APK; explain the rebuild chronologically; preserve that identity in a correction. If carrying observations to the final artifact, establish unchanged product/config inputs and relevant packaged payloads from retained artifacts or equivalent reproducible evidence. Different manifests/signatures must remain explicitly different.
- If that chain cannot be recovered, Gemini may use W2's already-authorized isolated emulator workflow to install the preserved final APK and recapture the required selector/tooltip/session observations with an explicit installation hash and chronology. Do not rebuild solely to change documentation, rerun unrelated persistence experiments, or touch the Pixel.
- Sources: `PROMPT_LEDGER.md:4906`, `:4907`, `:4910`; `docs/audits/rpe-familiarisation/continuation/W2_EXECUTOR.md:29`, `:48`; saved screenshots and embedded manifest.

### 4.2 Existing F7 and O1 remain owner decisions, not implemented fixes

- F7: the handback corrected the contract citation and disclosed the issue. It did NOT enlarge the shared InfoTip. Its 18 dp icon plus 12 dp hit slop per side gives a nominal 42 dp area, below the repository's 56 dp minimum; actual hit regions can be further constrained by parents.
- Record F7 as `DOCUMENTATION CORRECTED; SHARED CONTROL FIX/WAIVER NOT AUTHORIZED`. Do not read the opening claim that all minor findings were remediated as proof of a product fix.
- O1: tooltip titles still include raw `LINEAR` and `APRE`. Record `OWNER DISPOSITION PENDING`, not a completed owner waiver. Mapping/content correctness is separate from beginner-friendly naming.
- These are the existing audit's out-of-W2 issues. Keep them visible in W3/W5 without silently expanding selector-only remediation into shared UI/glossary changes.
- Sources: `docs/audits/rpe-familiarisation/continuation/W2_OPUS_AUDIT.md:194`, `:196`; `docs/audits/rpe-familiarisation/continuation/W2_EXECUTOR.md:15`, `:161`; `apps/mobile/src/components/InfoTip.tsx:76`, `:103`; `apps/mobile/src/theme/theme.ts:42`.

## 5. Updated execution order for Opus and Gemini

### 5.1 NOW: Opus W2 remediation review

1. Inspect identity/status BEFORE writing. Preserve the old W2 handback, inventory, audit, APKs and raw evidence.
2. Append the next unused ledger entry with the received prompt, recording the pre-write boundary. Do not edit closed history or fabricate a manifest self-hash.
3. Read W1 Round 2 for carry-forward status; do not repeat W1. Read the current W2 handback, original W2 audit, freeze and this update.
4. Review the actual selector/test delta and current images/XML. Verify F4/F5/F6 and behavior evidence; keep F7/O1 dispositions precise.
5. Resolve CR-W2-01 with evidence. Where executor action is necessary, issue a narrowly scoped Gemini handoff rather than editing product code yourself.
6. Use the independent Windows artifact-gate log above with an explicit attribution. If reproducing the full historical gate, use a separate reconstructed snapshot; do not truncate/revert the active ledger or weaken the verifier. A check against today's later documentation is not the earlier build state.
7. Write `docs/audits/rpe-familiarisation/continuation/W2_OPUS_AUDIT_R2.md` with artifact identity, source state, reviewed evidence, reproductions, limitations and a scoped `W2 APPROVE`, `W2 REQUEST CHANGES` or `W2 BLOCKED`.
8. W2 approval permits W3 without waiting for Codex. If a blocker persists after the bounded correction/verification, stop with the exact remaining requirement; do not spawn an indefinite review loop.

### 5.2 NEXT: W3 aggregate integration review

- After W2 approval, Gemini prepares `W3_INTEGRATION_PACKET.md` under the original work order §6: fresh remote/default-branch and merge-base identity, actual commit/path inventory, work-order mapping, existing findings, draft PR and verification matrix.
- Do not reuse the old 131-commit/310-path counts. Do not restart completed programming-quality, intake or biometric research work.
- Opus audits the actual aggregate code delta, including migrations/data preservation, training/progression behavior, actual-versus-target separation and native/build/CI risk. Reproduce integration gates; cite exact code findings.
- Write `W3_OPUS_AUDIT.md`. If context runs short, checkpoint reviewed/unreviewed paths and resume that coverage; do not re-audit from the beginning or label partial coverage APPROVE.
- No product repairs are authorized by W3 itself. A newly established out-of-scope defect gets a precise proposed executor task for owner approval.

### 5.3 THEN: W4 C6/release preparation

- Gemini prepares `W4_C6_RELEASE_PREPARATION.md` from the current executable memory/provenance contracts; Opus checks it in `W4_OPUS_AUDIT.md`.
- Separate ready tooling from missing physical evidence and owner decisions. Keep `C6: NOT EVALUATED`; emulator success is not physical 4 GB qualification.
- This is preparation only: no phone actions, stress runs, threshold changes, signing-secret access or store submission.

### 5.4 LAST: W5 proposed landing package

- Prepare `OWNER_LANDING_DECISION.md`: exact proposed product/test/doc files, review freezes, exclusions, target branch/remote, proposed commands and unresolved decisions.
- Carry F7/O1 and any genuine W3 findings forward. Exclude raw scratch evidence, private athlete data and unrelated files.
- Separate QA readiness, review completion, commit readiness, push authorization, merge readiness and release readiness.
- Stop for explicit owner authorization before staging, committing, pushing, opening a PR, merging or releasing. A technical approval alone grants none of these.

## 6. Documentation transition and retention

- This review adds Entry 0079 and this document after the successful pre-write gate. The APK and earlier freeze are historical snapshots, not representations of later ledger entries.
- The pre-review ledger was 347241 bytes with SHA-256 `c6770ed38452445a67a4bc68170dd5207d570bcf15e1ad64f2b71dcce1fa3fe6`. Preserve its prefix when verifying the append-only transition; do not rewrite the old freeze to match new paperwork.
- Original work order, prior handbacks/audits, selector/test bytes and APK remain unchanged by this review. The raw gate/test logs are ignored local evidence.
- Do not rebuild repeatedly just to incorporate each auditor's closeout. Keep build-input identity, tested-artifact identity and later review-document identity separate, as original work order §5.1 already requires.

## 7. Owner-to-Opus start prompt

```text
You are the fresh Opus auditor and continuation coordinator, not the product executor.
Work in C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\rpe-familiarisation.
Read applicable repository instructions, docs/WORKORDER_GEMINI_OPUS_THREE_DAY_CONTINUATION.md, and docs/audits/rpe-familiarisation/continuation/CODEX_REVIEW_AND_OPUS_NEXT_STEPS.md.
Start at W2 remediation review, not W1. Inspect the existing frozen state before your ledger write.
Verify Gemini's stacked selector and resolve CR-W2-01: Entry 0078 names a different installed APK from the current handback. Do not silently relabel old screenshots. Keep the existing InfoTip size and terminology issues explicitly pending owner disposition.
Use Gemini for any necessary scoped execution and preserve fresh audit separation. Record your W2 verdict in W2_OPUS_AUDIT_R2.md.
If W2 is approved, issue Gemini the W3 integration-packet task and audit that exact aggregate delta. Then continue the W4 preparation and W5 proposed landing package, passing frozen handoffs manually if no authorized agent bridge exists. Do not claim dispatch or completion until it actually occurred.
Use coverage checkpoints and bounded corrections; do not restart completed work or wait for Codex to return.
Do not change training algorithms, shared glossary/InfoTip code, schemas or release gates under this dispatch. Do not touch the physical Pixel, stage, commit, push, create a PR, merge, sign or release.
Stop with a precise handback on a missing authority or persistent blocker.
```

