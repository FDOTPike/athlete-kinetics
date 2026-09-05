# W5 — Delegated landing decisions (current)

**Decision date:** 2026-09-05. **Decision maker:** Codex, under the user's direct delegation:
"Please make the owner blocking decisions yours", followed by "please continue".

**All eight owner policy decisions are resolved. No further owner sign-off is pending for this package.**
This decision supersedes the older owner-only stops and proposed command sequence below for this work.
Those passages are retained as historical evidence; they are not the current instructions or authority.
Local integration is approved. Release is not approved while its technical evidence gates are unsatisfied.

## The eight decisions

| # | Decision made by Codex | Result and remaining work |
| :--- | :--- | :--- |
| 1 | Replace the requirement for Francis personally to install/test before a branch push with agent-owned verification of the actual candidate. Use isolated synthetic QA and the existing automated gates for local/branch integration. Personal acceptance testing is optional for that purpose. | The rebuilt candidate passed CI, its artifact gate, and isolated emulator checks. I choose **local landing only in this task**. A later branch push may proceed under this delegated decision after checking the live destination and current candidate; it does not need another owner policy approval. No push or PR was performed here. Physical memory qualification remains mandatory for release. |
| 2 | **Retain the ratified review band** for the exact **471,936,000 B** envelope, conditional on sound physical evidence. Keep the 450,000,000 B preferred target, 536,870,912 B hard ceiling, component floors and one-ceiling-for-all-tiers rule. | The exact-envelope review record already exists in budget.json; the old assertion that it is missing was wrong. Reaffirmed here under delegated authority. A changed envelope requires a new agent review, not an automatic waiver. C6 stays **NOT EVALUATED** until a dedicated physical 4 GB reference-device run supplies sealed, re-derivable evidence. Device choice is any qualifying dedicated 4 GB physical reference handset; the available emulator is not a substitute. No phone interaction or budget reduction was performed. |
| 3 | **Fix F7**, rather than waive the touch contract. | InfoTip now reserves a real 56 by 56 dp Pressable around the small icon. Removed reliance on clipped hitSlop. All three method tips measured exactly 56 by 56 dp and opened from corner taps at both tested enlarged-text widths. |
| 4 | **Fix O1** using the existing product names. | Canonical glossary titles are **Linear** and **Autoregulated**. Schema IDs LINEAR/APRE and alias lookup stay compatible. All three loading-method selections, modal titles and dismissal passed on the emulator; the component test now verifies the actual modal title. |
| 5 | **Fix O3** using a full-width wrapping control row. | Slot labels sit above the role controls; controls wrap within the card. ACC stays fully inside its button and the screen at font scale 1.30, including a 360 dp viewport. Screenshots were visually checked after scrolling the complete row into view. |
| 6 | **Close W3-09 with a corrigendum**, preserving frozen evidence. | Entry 0090 and W4_W5_CODEX_REVIEW.md identify af3a46f4... as the superseded snapshot and 8fef8466... as the retained inventory. They record the disclosed Path A regeneration boundary and the unrecoverable timing limit. The two frozen citations and inventory are unchanged. |
| 7 | **Have Codex review the original Opus W4/W5, then accept the bounded remediation for local integration on fresh verification.** | Review completed independently of the original author in W4_W5_CODEX_REVIEW.md. It corrects the memory-approval claim, runtime-SQL claim and proposed commit split. Codex's subsequent edits are self-verified; they are not represented as independently audited or covered by the older W2 approval. No additional owner selection of an auditor is pending. |
| 8 | **Retain one current recovery formula for fresh and existing installs; reject the claimed migration defect.** | 004 is explicitly excluded from migrations.ts and exported as runtime materialization SQL. Boot refreshes the trailing 14 days after migrate(db), irrespective of user_version. A SQLite regression proves an existing old-formula row converges to the fresh result with no schema-version change. No migration or historical SQL was edited. Older snapshots outside the normal refresh window remain historical records. |

## Verification and landing

- **Product/test commit:** cc30e451e88598401242606b9d9f2e3edfd7e693 — five explicitly staged files: InfoTip.tsx, RoutineTemplateBuilder.tsx, glossary.ts, RoutineTemplateBuilder.test.js, and verify_migrations.mjs. This includes the previously reviewed but uncommitted selector layout and tests.
- **Documentation landing:** this decision, the new W4/W5 review, the append-only ledger, and the previously proposed documentation trail are landed in a separate documentation commit. Its identity is the commit containing this record, with subject "docs(audit): resolve delegated owner landing decisions". The complete local package is **29 paths: five product/test and 24 documentation paths**, not the original 25-path proposal.
- **CI:** npm.cmd run verify:ci exited 0 across all 23 stages, including typecheck, migration regression, memory fixtures and **20 component suites / 282 tests**. A fresh pre-commit typecheck also passed. The component run emitted non-failing React act warnings; they did not fail a suite.
- **QA candidate at its build boundary:** assembleQa --no-daemon and verify:qa-candidate exited 0. APK SHA-256 **2240c1fcab47fb727345bd75ea9dba4e6c2457c222726380ac1532b79617f4ba**, embedded HEAD 0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72, tracked-diff SHA-256 **afe4e09a73214e01b8758b353bfdecd166a10506220dd88da4949b3a80237079**. The tested product bytes match the product commit; documentation and commit identity subsequently moved. This is a verified pre-closeout QA artifact, not a clean-HEAD release artifact. Rebuild and rerun the candidate gate at any later publication/release boundary.
- **UI evidence:** isolated emulator-5560, synthetic rpe_isolated_qa_avd, cold boot, read-only AVD with no snapshot save. Standard 411.43 dp/font 1.0 was inspected. Both 411.43 dp/font 1.30 and 360 dp/font 1.30 passed all method selections, real 56 dp tip targets, corner taps, canonical titles, dismissal, and ACC containment. Raw XML, PNGs, verifier, metrics and logs are outside the repository at C:/Users/fpike/AppData/Local/Temp/rpe-owner-decisions-OrMqqq/. The initial warm snapshot produced a blank render; acceptance captures came only after a cold boot. The emulator is no longer running; no physical device was targeted.
- **Accepted visual limit for local landing:** the unchanged bottom navigation wraps/abuts labels at the combined 360 dp/font 1.30 setting. This does not reopen any of the eight owner decisions. The scoped checks above do not certify every screen's accessibility.
- **Memory/release:** verify:memory-contract still exits 1 at A/D because qualifying physical evidence is absent. The exact-envelope review is present and current. verify:release was not represented as passing; it cannot pass in this state.
- **Documentation formatting disposition:** Staged documentation whitespace check returned exit 2 with six pre-existing warnings: four trailing-space lines in captured SQL table output in HANDBACK_ISOLATED_QA.md (157, 158, 175, 176), plus blank EOF lines in CODEX_REVIEW_AND_OPUS_NEXT_STEPS.md (150) and W3_INTEGRATION_PACKET.md (718). All three documents still match their initial hashes. Codex accepts these historical formatting warnings to preserve frozen bytes; no functional gate or new-product whitespace check was waived.
- **Preservation:** all closed ledger entries, W1-W3 audits, W4 and both freeze inventories are preserved. The original W5 bytes follow below verbatim. Original W2 APK bytes were archived outside the repository before rebuilding. Raw evidence, APKs and dependencies were excluded from staging.

## Current readiness and authority

| Question | Current disposition |
| :--- | :--- |
| QA readiness | Automated and scoped emulator checks pass for the verified product revision. |
| Review completion | Original W4/W5 reviewed with explicit corrections; new limited remediation accepted with disclosed self-verification. |
| Local commit readiness | Approved and locally landed as product/test plus documentation commits. |
| Push authority | Delegated; local-only execution chosen for this task. Check live destination and current candidate before a later push. No owner-policy hold remains. |
| Merge readiness | Not asserted: the live remote/target integration has not been refreshed or evaluated in this task. |
| Release readiness | Blocked by physical 4 GB qualification and the requirement to validate the candidate at the release boundary. No threshold or provenance gate is waived. |

**Publication decision:** no push, PR, merge, tag, production signing or release in this task. This is an affirmative local-landing decision, not a request for another approval. The remaining work is technical qualification and any separately undertaken publication action.

---

## Historical W5 proposal — superseded by the decision above

The remainder is preserved byte-for-byte from the originally reviewed proposal (SHA-256 b73fe127473d3dba4a986613161545b5d6411cc19a9541344e448b3bdb6d17b0).
Its owner-only stops, unaudited status, readiness assertions and proposed commands describe that earlier snapshot. Use the current decision and W4_W5_CODEX_REVIEW.md for the corrected state.

---

# W5 — Proposed Landing Package (Owner Decision Required)

> ## ⚠ NOT INDEPENDENTLY AUDITED — AND NOTHING HERE HAS BEEN EXECUTED
>
> Written by Claude Opus 5 acting as **executor**, at the owner's explicit direction, in the same context that
> audited W1–W3. There is no independent auditor for this document. Every command below is a **proposal**;
> none has been run. Nothing has been staged, committed, pushed, merged, signed or released.
>
> This document asks for a decision. It does not record one.

**Prepared:** 2026-09-05. Branch `codex/rpe-familiarisation`, HEAD `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72`.

---

## 1. The six readiness questions are not one question

Conflating these is the most common way a branch ships before it is ready. They are answered separately.

| Question | State | Basis |
| :--- | :--- | :--- |
| **QA readiness** — do the automated gates pass? | **YES**, with one exception | `verify:ci` (23 gates), `typecheck`, `verify:blocks`, `verify:components` (20 suites / 282 tests) all exit 0. `verify:memory-contract` **fails** (exit 1) |
| **Review completion** — has the work been independently reviewed? | **PARTIAL** | W1, W2, W3 independently audited. **W4 and W5 are not** |
| **Commit readiness** — is the working tree in a landable shape? | **YES** | 4 tracked modified + 21 untracked docs; all bulk evidence correctly gitignored |
| **Push authorization** | **NO** | Owner has not authorized it, and the standing rule requires on-device verification first |
| **Merge readiness** | **NO** | Depends on push authorization and on the open owner decisions in §5 |
| **Release readiness** | **NO** | `verify:release` cannot pass while `verify:memory-contract` fails; **C6 NOT EVALUATED** |

A green technical audit answers only the first row.

---

## 2. Proposed landing set

### 2.1 Already committed — 131 commits, 310 paths

Merge base `4c5056fc40b132c11436c22f9207af5256929775` (equal to the `origin/master` tip, so the branch is
strictly ahead). Full inventory in `W3_INTEGRATION_PACKET.md`, verified complete at 310/310 in
`W3_OPUS_AUDIT_R2.md`.

### 2.2 Working-tree changes proposed for landing — 25 paths

**Product and test (2):**

| Path | Change |
| :--- | :--- |
| `apps/mobile/src/components/RoutineTemplateBuilder.tsx` | +16/−? — W2 selector layout: column stacking, container flex, chip padding, option `testID` |
| `apps/mobile/test/components/RoutineTemplateBuilder.test.js` | +69 — W1/W2 contract-anchored, fail-closed selector tests |

**Ledger and handback (2):**

| Path | Change |
| :--- | :--- |
| `PROMPT_LEDGER.md` | +830, append-only — Entries 0069–0089 |
| `docs/audits/rpe-familiarisation/antigravity/HANDBACK_LIVE_SESSION_EVIDENCE.md` | +47/−? — additive remediation notes |

**Documentation, currently untracked (21):** the three-day continuation work order; two Antigravity
handback/work-order files; the Codex closeout; and the continuation set — `CODEX_REVIEW_AND_OPUS_NEXT_STEPS.md`,
`WORKORDER_OPUS_W2_PATH_A_CLOSEOUT.md`, `FREEZE_INVENTORY_W1.json`, `FREEZE_INVENTORY_W2.json`,
`W1_EXECUTOR.md`, `W1_OPUS_AUDIT.md`, `W1_OPUS_AUDIT_R2.md`, `W2_EXECUTOR.md`,
`W2_EXECUTOR_R1_SUPERSEDED.md`, `W2_OPUS_AUDIT.md`, `W2_OPUS_AUDIT_R2.md`, `W2_OPUS_AUDIT_R3.md`,
`W3_INTEGRATION_PACKET.md`, `W3_OPUS_AUDIT.md`, `W3_OPUS_AUDIT_R2.md`, `W4_C6_RELEASE_PREPARATION.md`, and
this document.

### 2.3 Review freezes this package rests on

| Artifact | Identity |
| :--- | :--- |
| Selector source | `98e8aef8d18a056b6fb4a47db4ac3e559bc8bc97bdfcd51ebc0dff31f4dacbc1` |
| Focused test | `104e0cbd77741a16e3367673b95771e07e38e4142685d3d9978e4c66c6904343` |
| QA candidate APK (**not** landing) | `3777054f246a01e30bfc28a33181791e09de93be928f515959ebc2440d4b858d` |
| W2 verdict | `W2_OPUS_AUDIT_R3.md` — `W2 APPROVE — CR-W2-01 CLOSED` |
| W3 verdict | `W3_OPUS_AUDIT_R2.md` — `W3 APPROVE` |

---

## 3. Explicit exclusions — what must not land

| Excluded | Why | Status |
| :--- | :--- | :--- |
| `scratch/` (**412 MB**) — emulator screenshots, UI dumps, logcats, archived APKs | Raw working evidence, not a deliverable; would bloat the repository enormously | `.gitignore`d ✓ verified |
| `apps/mobile/android/app/build/**` — including the 194 MB QA APK | Build output | `.gitignore`d ✓ verified |
| `node_modules/` | Dependencies | `.gitignore`d ✓ verified |
| Private athlete data | Never in scope | None present in the landing set |

All three exclusions were verified with `git check-ignore`, not assumed. **No `git add -A` / `git add .`** —
see §4.

---

## 4. Proposed commands — NOT RUN

Every command below is a proposal for the owner to review, adjust and execute. They are deliberately explicit
rather than wildcarded, so nothing unintended is swept in.

```bash
# 1. Confirm the tree is what you expect before staging anything.
git status --short
git diff --stat HEAD

# 2. Stage the product and test change.
git add apps/mobile/src/components/RoutineTemplateBuilder.tsx \
        apps/mobile/test/components/RoutineTemplateBuilder.test.js

# 3. Stage the ledger and handback.
git add PROMPT_LEDGER.md \
        docs/audits/rpe-familiarisation/antigravity/HANDBACK_LIVE_SESSION_EVIDENCE.md

# 4. Stage the documentation set explicitly (no -A, no .).
git add docs/WORKORDER_GEMINI_OPUS_THREE_DAY_CONTINUATION.md \
        docs/audits/rpe-familiarisation/antigravity/HANDBACK_ISOLATED_QA.md \
        docs/audits/rpe-familiarisation/antigravity/WORKORDER_UNATTENDED_ISOLATED_QA.md \
        docs/audits/rpe-familiarisation/codex/ \
        docs/audits/rpe-familiarisation/continuation/

# 5. Verify nothing unintended is staged — expect exactly 25 paths, no scratch/, no APK.
git diff --cached --name-only
git diff --cached --stat

# 6. Re-run the gates against the staged state.
npm.cmd run verify:ci
```

A suggested split is **two commits** — one product/test, one documentation — so the behavioural change is
reviewable on its own:

```bash
git commit -m "fix(routine-builder): stack loading-method selector for font-scale readability"
git commit -m "docs(audit): W1-W5 continuation work orders, executor handbacks and Opus audits"
```

**Not proposed, and not to be run without a separate explicit decision:** `git push`, PR creation, merge, tag,
sign, release.

---

## 5. Unresolved decisions — yours

| # | Decision | Consequence if unresolved |
| :--- | :--- | :--- |
| 1 | **On-device verification.** Your standing rule is that nothing is pushed until you have installed the app and verified the changes yourself | Push stays blocked |
| 2 | **C6 / memory band.** Either supply a 4 GB reference-device evidence packet **and** a review record naming the exact envelope `471,936,000 B`, or reduce the envelope below `450,000,000 B` | `verify:release` cannot pass; release stays blocked |
| 3 | **F7** — shared `InfoTip` ~42 dp effective target vs `theme.touch.min = 56` | Ships as-is unless you fix or waive it |
| 4 | **O1** — raw `LINEAR` / `APRE` identifiers as tooltip titles | Ships as-is |
| 5 | **O3** — slot-role chip row clips `ACC` at font scale 1.30, no horizontal scroll | Ships as-is |
| 6 | **W3-09** — `af3a46f4…` inventory hash cited in `W2_OPUS_AUDIT_R3.md:21` and the Path A work order no longer resolves after the disclosed Path A regeneration | A stale citation persists in two frozen documents |
| 7 | **W4/W5 independent review** — neither has an auditor | Two of five milestones are self-certified |
| 8 | **Readiness-formula divergence** — migration `004` removes the ACWR term; `user_version` gating means existing installs keep the old formula while fresh installs get the new one | Ships with a known behavioural bifurcation between existing and new users |

Items 3–5 are pre-existing and were deliberately held out of scope throughout W1–W3; they are listed so the
decision is conscious rather than inherited by default.

---

## 6. What I recommend

Offered as a view, not a decision:

1. **Land the two commits locally.** The product change is small, well-tested and independently audited twice;
   the documentation is the audit trail that justifies it.
2. **Do the on-device check before any push** — your own rule, and the one gate no automated tool substitutes
   for. Worth specifically exercising: the stacked selector at a large font scale, RIR/RPE entry persisting
   `null` when unanswered, and `Not sure` returning to neutral guidance.
3. **Treat C6 and release as a separate track.** Nothing in W1–W5 unblocks it, and a 4 GB reference device is
   required regardless.
4. **Get W4 and W5 reviewed by someone other than me** before they carry any weight. I wrote them; I should not
   also be the one vouching for them.
5. **Decide F7/O1/O3 explicitly**, even if the decision is "ship as-is". They have been carried forward for
   four rounds now.

---

## 7. Authority boundary

Nothing in this document has been executed. No staging, commit, push, PR, merge, tag, signing or release was
performed, no physical device was touched, no APK was rebuilt, and no product code, migration, schema,
dependency, native file or CI gate was modified.

**This package requires explicit owner authorization before any of §4 is run.** A technical approval — including
the `W2 APPROVE` and `W3 APPROVE` verdicts this package rests on — grants none of it.

```text
W5 LANDING PACKAGE PROPOSED — OWNER AUTHORIZATION REQUIRED — NOT INDEPENDENTLY AUDITED
```
