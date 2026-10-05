# Codex review of W4/W5 and delegated decisions

Reviewed 2026-09-05 on codex/rpe-familiarisation, starting HEAD 0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72.

Codex reviewed the original Opus-authored documents in this separate task before revising the landing decision. This review is independent of their author. The subsequent Codex UI changes and this decision record are self-verified, not independently audited. The user delegated the owner decisions with: "Please make the owner blocking decisions yours".

## Reviewed inputs

| Input | SHA-256 of reviewed bytes |
| :--- | :--- |
| W4_C6_RELEASE_PREPARATION.md | 86fbcc4c3f4d2d3186e978f8b8084db347a8987ead2cdc251d1900645e154f0a |
| Original OWNER_LANDING_DECISION.md | b73fe127473d3dba4a986613161545b5d6411cc19a9541344e448b3bdb6d17b0 |
| FREEZE_INVENTORY_W2.json | 8fef8466a4058243c0db2f1e5caf90634a6915e53205fc50fc9c4c3089637661 |

The original W5 bytes are retained verbatim beneath the new decision in that file. W4, the earlier audits, both freeze inventories, and all closed ledger entries remain unchanged. The original APK was copied outside the repository before the QA rebuild.

## Findings and disposition

1. **W4/W5 memory approval claim is incorrect.** W4 section 1.1 and W5 item 2 imply that both physical evidence and an exact-envelope review are missing. tools/memory-audit/budget.json already contains ceilingRatification.reviewBandApproval.reviewedEnvelopeBytes = 471936000, with the exact component composition. memory_gate.mjs checks that record against the live envelope. A fresh verify:memory-contract run fails A solely because D lacks physical evidence; it does not report a missing or stale approval. Retain the existing review band and all floors/ceilings. The delegated decision reaffirms that exact envelope conditionally; it does not approve release or a measured peak. The missing physical 4 GB qualification remains a real release gate.

2. **W5 item 8 inherits a false migration premise from W3.** packages/core-db/src/migrations.ts explicitly excludes 004 from the migration array. packages/core-db/src/index.ts exports it as MATERIALIZE_STATE_VECTOR_SQL. apps/mobile/src/state/useStore.ts runs that current SQL over the trailing 14 days immediately after migrate(db) on initialization, independent of user_version. The current HRV/sleep recovery formula therefore refreshes both new and upgraded installations; ACWR and load_component remain contextual fields. No new migration or historic SQL edit is warranted. A regression in verify_migrations.mjs now starts with a latest-version database, preserves an old ACWR-derived row through a no-op migration run, and proves the runtime upsert converges to the fresh-install result without changing user_version. Older snapshots outside the existing refresh window remain historical data; no bulk rewrite was performed or implied.

3. **W5's proposed two-commit sequence would not create the advertised split.** Its instructions stage every file before the first git commit, so that commit would include the documentation too. Actual landing stages the five product/test files first, commits them, then stages the explicit documentation allowlist and commits it. No directory-wide git add, git add -A, or git add . is used. The original 25-path count describes the original proposal, not this expanded remediation.

4. **W3-09 is closed by this corrigendum and Entry 0090.** The hash af3a46f47db568810f07e189e064bc9cd316c46024ae9dbb83ee9d47e39d1496 cited by W2_OPUS_AUDIT_R3.md:21 and WORKORDER_OPUS_W2_PATH_A_CLOSEOUT.md:36 identifies a superseded snapshot. The retained inventory is 8fef8466a4058243c0db2f1e5caf90634a6915e53205fc50fc9c4c3089637661, generatedAt 2026-09-04T17:02:33.902Z, stage W2_REMEDIATION_PATH_A_RECAPTURE, as disclosed by Entry 0081. The exact replacement time relative to R3 cannot be reconstructed and is not invented. Before the new remediation, 46 of 47 records across 45 distinct paths verified; only the already-disclosed continuing ledger differed. Both frozen citations remain intact and must be read with this correction. Later source/test/APK differences are the intentional new candidate, not changes retrospectively covered by the W2 approval.

## Coverage and limits

Reproduced the original branch identity, 131-commit / 310-path range against the local origin/master ref, original four tracked modifications and 21 untracked documents, initial selector/test/APK hashes, exclusion rules, and inventory verification. Reviewed W4 against the memory budget, gate, harness/provenance boundaries and release scripts; reviewed W5 staging and readiness statements against Git state, production migration registration, runtime materialization, and UI source. The remote ref was not fetched; the original W3 baseline is not a claim about today's live remote or merge conflicts.

Verdict: W4/W5 review complete with the corrections above. The original preparation/landing conclusions are usable only with this report and the superseding decision. C6 remains NOT EVALUATED. Prior W1-W3 approval is not extended to the new UI revision. Codex accepts the limited new UI remediation for local integration on fresh automated and emulator verification; no second independent review is claimed for it.

## Execution evidence

Final verification and commit outcomes are recorded in Entry 0090 and the current decision at the top of OWNER_LANDING_DECISION.md. Raw logs and candidate evidence are retained outside the repository at C:/Users/fpike/AppData/Local/Temp/rpe-owner-decisions-OrMqqq/.

### Completed verification

- verify:ci exited 0 across 23 stages; 20 component suites and 282 tests passed, including the strengthened tooltip title assertion. The three new SQLite convergence assertions also passed.
- QA build and verify:qa-candidate exited 0 for APK 2240c1fcab47fb727345bd75ea9dba4e6c2457c222726380ac1532b79617f4ba at the pre-closeout build boundary. Later document/commit identity changes require candidate revalidation; no clean-HEAD artifact claim is made.
- Standard layout was visually inspected. At both 411.43 dp/font 1.30 and 360 dp/font 1.30, all three selected methods, exact 56 by 56 dp tooltip targets, corner-triggered modals, canonical titles/dismissal, and ACC containment passed. Screenshots inspected. The unchanged bottom navigation wraps/abuts labels at the combined narrow/enlarged setting; accepted as a nonblocking limitation for this local landing, not a whole-app accessibility certification.
- verify:memory-contract exited 1: A depends on unsatisfied physical evidence D. No missing/stale review was reported. C6 NOT EVALUATED; verify:release cannot pass.
- Product commit: cc30e451e88598401242606b9d9f2e3edfd7e693. Local documentation commit contains this report and the current decision. No remote publication occurred.

### Staged evidence formatting disposition

Staged documentation whitespace check returned exit 2 with six pre-existing warnings: four trailing-space lines in captured SQL table output in HANDBACK_ISOLATED_QA.md (157, 158, 175, 176), plus blank EOF lines in CODEX_REVIEW_AND_OPUS_NEXT_STEPS.md (150) and W3_INTEGRATION_PACKET.md (718). All three documents still match their initial hashes. Codex accepts these historical formatting warnings to preserve frozen bytes; no functional gate or new-product whitespace check was waived.
