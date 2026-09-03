# 09 — Independent Review Handover

**Audience:** the independent auditor(s) (owner-assigned: Codex/Sol) who review this frozen output.
**Status of independent review (swept per Reviewer B B-1; earlier revisions of this line still said “un-started” after Reviewer A had reported).** **Reviewer A (evidence): COMPLETE — verdict REQUEST CHANGES.** **Reviewer B (engineering/privacy): COMPLETE — verdict REQUEST CHANGES.** Both lenses are now run and attached; **neither returned an approval, and no approval of any state of this branch exists.** Reviewer A audited `337778f1` (two P2, remediated at `756b031`) and on targeted re-verification opened **P2-3** against that remediation; Reviewer B audited `8c9c9a3` (five P2, zero P1). Both sets are remediated in this commit. **No reviewer has re-reviewed the resulting state**, so a remediation is not an approval, and this document still does **not** claim the work order's §10 criterion is satisfied — that is the owner's determination. Records: §13 (Reviewer A), §14 (Reviewer B).

## 0. Freeze record (four rounds; pushed)

- **Base commit (verified before any write):** `e15bbe9301fe756ecda9d8296877b19e425ac112` — `git status --short` was empty at W0; `docs/WORKORDER_ADVANCED_BIOMETRIC_RPE_DISCOVERY.md` present at base.
- **Branch / worktree:** `codex/biometric-rpe-discovery`, in a local worktree whose absolute path is **redacted** — it is not needed to reproduce this audit, and it exposed a developer username and directory layout (removed per Round 4 review). Deviation note: the work order names a worktree directory without the `codex-` prefix; the existing worktree at the prefixed directory already carried this exact branch at the exact base commit with a clean tree, so it was used rather than duplicated or overwritten, per the work order's own inspect-don't-overwrite rule.
- **Historical commit chain (as built — this list is the *pre-push development history*, not the current remote state; see "Current remote state" below):**
  1. `9dd3ba9f3a489563bfb1c1340078c14f3d59d63a` — first deliverables commit (ten files; tree `caecdd3e23e2d4e2667734df2c928668ce0f94eb`).
  2. `f9eb6bd56aaf0abd9502348a33b35fd7c28db82a` — first freeze record (Freeze Log fill; touched only `09` §0).
  3. `3ddfd78692c1cb8c87033039fa1992491762e30e` — first remediation (five P1 findings + additional corrections; 10 files, 184 insertions / 103 deletions).
  4. `9388edb6d24c7fde4b379f486b1a3cac56923111` — first final freeze record (freeze-log fill; touched only `09` §0; tree `6a998c388b6bd473ebb8566540198f89be1a3dc5`). **This is the commit the second audit reviewed.**
  5. `0f1d7be4b0442ff0c7ff0a4f2b8ee0779de809a3` — **SECOND REMEDIATION COMMIT** — the second audit's fixes (six findings; 10 files, 80 insertions / 53 deletions, all within the ten files in §2).
  6. `1649c8ed45f539ae8b5e4a7f09ef0c965280cbe3` — second final freeze record (tree `82ee3500ada9fc313763beb51fdbbe3ccf81f090`). **This is the commit the third audit reviewed.**
  7. `3c70c71e2f5c4850775ed10ebdea552fc7b17754` (amended to `0820fe5…` — final SHA is the one `git log` shows for "third-audit remediation") — **THIRD REMEDIATION COMMIT** — the focused-cleanup commit for the third audit's six findings (9 files, 68 insertions / 45 deletions, all within the ten files in §2). The original SHA `3c70c71e2f5c4850775ed10ebdea552fc7b17754` was amended only to normalize CSV line endings; the amended commit is canonical.
  8. `39cbafd6ec9437aa78070b7b6ed6ecc00b0e608b` — Round 3 closure freeze record (tree `03a517ab539559e598019a3ceb3f3bbabd2fc1bb`); touched only this file. **This is the commit the Round 4 Codex/Sol audit reviewed.** It is no longer `HEAD`.

- **Current remote state (authoritative; supersedes any "all local / unpushed" statement in earlier rounds).** The branch `codex/biometric-rpe-discovery` **is published on `origin`** (`https://github.com/FDOTPike/athlete-kinetics`). Under the Round 4 authority its prerequisite branch `codex/program-quality-remediation` is fast-forwarded (no force) to `e15bbe9301fe756ecda9d8296877b19e425ac112`, and the research branch is opened as a **draft stacked pull request** against that base so the PR diff contains exactly the ten deliverables. The exact SHAs and the PR URL are recorded in the **Round 4 freeze** block below, written after those actions completed. Nothing is merged, rebased, force-pushed, tagged or released; the PR is **not** marked ready; and `master` is untouched. **Never trust a SHA written inside a commit's own text** — resolve the current tip yourself with `git rev-parse HEAD` / `git rev-parse HEAD^{tree}` and `git ls-remote --heads origin`.
- **Second audit verdict:** REQUEST CHANGES — freeze integrity, documentation-only scope, the two-arm split, the RIR leakage rules, and the SpO2 ruling passed; six substantive findings followed. Remediation record: §11 (Round 2 table).
- **Fourth audit verdict (Codex/Sol, against `39cbafd…`):** REQUEST CHANGES — four findings: current-evidence correction ([S29]/[S30] and the categorical wrist-PPG wording), handover correction, PR-base correction, and independent reviews still pending. Remediation record: §11 (Round 4 table).
- **Third audit verdict:** REQUEST CHANGES as a final recheck — freeze integrity, docs-only scope, and all round-2 literature/platform fixes passed; four P1s + a P2 set of residual inconsistencies followed. Remediation record: §11 (Round 3 table).
- **Deliverables tree:** exactly ten files, `docs/research/biometric-rpe/00…09` (§2 lists them). `git show --stat` for commits 1, 3, 5, and 7 must list only these; commits 2, 4, 6, and 8 must touch only this file.
- **First-freeze audit:** REQUEST CHANGES (five P1 findings + additional required corrections). Remediation record: §11. The audit's provisional acceptance of the decision token and SpO2 ruling is recorded there verbatim in substance.

### Round 3 closure freeze (state at `39cbafd…` — the commit the Round 4 audit reviewed)

Recorded mechanically from the repository at that freeze. **The manifest and join counts in this block are the Round 3 figures (46 rows); Round 4 added [S29] and [S30], so the current totals are 48 — see §3 and the Round 4 freeze block.** Recompute everything yourself rather than trusting these strings.

- **Remediation commit (Commit 1):** `517505ca835f15f6cd0c32133bd7cff66116f2f4` — tree `785ab9f2a8c58113d5ffdf10e4a3baf2ddc078a2`. Message: `docs(research): close final biometric-RPE audit findings`.
- **Files changed by Commit 1:** **9** of the ten deliverables (`00`, `01`, `02`, `03`, `04`, `05`, `06`, `08`, `09`), **86 insertions / 34 deletions**. `07_ARCHITECTURE_OPTIONS.md` required no change in this pass and is unchanged by Commit 1; it remains inside the cumulative ten-file scope from the base commit.
- **Cumulative changed paths, `e15bbe9…` → this freeze:** exactly **10**, all under `docs/research/biometric-rpe/`. No product code, TypeScript, JavaScript, SQL/migration, dependency, permission, native, or release-configuration file appears in the diff.
- **Freeze commit (Commit 2):** the commit that wrote this block. It cannot record its own SHA and touches only this file — resolve it with `git rev-parse HEAD` / `git rev-parse HEAD^{tree}`.
- **Predecessor state audited:** the Round 3 audit was returned against `1649c8ed45f539ae8b5e4a7f09ef0c965280cbe3`; its first remediation landed as `0820fe5…` + `e2dde70…`, and this closure pass completes the residual findings left open at `e2dde70…` (§11, Round 3 closure table).

**Manifest totals (mechanically derived from `03_SOURCE_MANIFEST.csv`):**

| Metric | Value |
|---|---|
| Columns | 15 |
| Rows | 46 |
| Unique IDs | 46 (no duplicates) |
| `primary_research` | 18 |
| `primary_research_review` | 6 |
| `primary_research_meta` | 2 |
| `journal_commentary` | 1 |
| `official_documentation` | 8 |
| `repository_control` | 10 |
| `preprint_context` | 1 |
| Partially verified | 5 — `S05`, `S06`, `S21`, `S22`, `S23` |

**Verification results at this freeze:**

| Check | Result |
|---|---|
| CSV parse (`csv.DictReader`) | 15 columns, 46 rows, 46 unique IDs, 0 duplicates, type totals exactly as tabled above |
| Prose → manifest join | **46** distinct cited IDs at that freeze; **0** missing from the manifest; **0** manifest rows uncited (range notation expanded before joining) |
| Stale-claim sweep | 6 residual hits, **each explicitly marked withdrawn or `SUPERSEDED BY ROUND 2/3`**; no hit states current truth |
| `git diff --check e15bbe9…..HEAD` | clean — no whitespace errors, no conflict markers |
| Changed-path scope | exactly the ten permitted deliverables |
| Encoding / structure | all ten files valid UTF-8; no replacement characters, no mojibake, no merge markers, no CR; all Markdown tables well-formed (the malformed `08` UD-9 row inherited from an earlier commit was repaired); CSV rows all 15 fields |
| `npm run verify:ci` | **exit 0** |

**`npm run verify:ci` detail (so the number is auditable).** The first invocation *failed* at preflight: this worktree had no `node_modules` and no materialized embedder artifacts. The repository's own preflight prescribes the fix sequence, which was followed exactly — `npm ci`, then `npm run fetch:embedder` (the repository's sole network-capable materializer, which byte-verifies every artifact against its pinned SHA-256), then `npm run verify:ci`, which exited **0**. **No product code, test, fixture, or verifier threshold was modified to obtain that pass.** Both installed trees are git-ignored and appear in no diff. The log contains 2,816 `PASS` lines and 40 `FAIL` lines; **every one of those `FAIL` lines is inside the QA-artifact verifier's deliberate negative fixture** — a known-bad artifact used to prove the verifier detects failure, immediately followed by `PASS bad artifact reports failure without throwing`. Component tests: 19 suites / 249 tests, all passing.

**No post-fix independent verdict has been fabricated.** Codex/Sol has **not** reviewed, verified, or approved this freeze. No reviewer verdict on this state exists anywhere in the document set, and none has been invented, paraphrased, or implied. This is **executor remediation under owner-granted push authority**, awaiting independent re-review; the work order's §10 independent-review criterion remains **unsatisfied**.

**Boundaries at this freeze.** Decision token unchanged: **RESEARCH PILOT ONLY — no prescription or athlete-facing estimate**, still provisional. **Pilot execution: NO-GO**, pending UD-1, UD-2, UD-7 and the `06` §11 qualified approvals (owner, domain expert, IRB/EC). **Merge and release: NOT PERFORMED** — this branch is pushed to GitHub under explicit owner authority as the terminal action of this pass, and nothing else; it is not merged, rebased, force-pushed, tagged, released, built, or opened as a pull request, and `master` is untouched. A reviewer should confirm the remote branch resolves to the same commit as local `HEAD` and that no other ref moved. UD-10 (the ProfileScreen copy defect) is deliberately **not** fixed here, because product-code changes are outside this work order.

### Round 4 freeze (historical — state at `1437f5c…`, superseded by the post-CodeRabbit block below)

Recorded mechanically after the actions completed; recompute everything yourself rather than trusting these strings.

- **Round 4 remediation commit:** `dd7cf56e6d7e138d4830f45304f10efb69bd02e1` — tree `5baa51bd22136e5159c0817996ba4b370ae6ad09`. Parent: `39cbafd6ec9437aa78070b7b6ed6ecc00b0e608b` (the audited state). Message: `docs(research): current-evidence correction and handover integrity`.
- **Files changed by that commit:** **7** — `01`, `02`, `03`, `04`, `05`, `06`, `09` (**68 insertions / 24 deletions**). `00`, `07` and `08` needed no change this round and remain inside the cumulative ten-file scope.
- **Cumulative changed paths, `e15bbe9…` → this freeze:** exactly **10**, all under `docs/research/biometric-rpe/`. No product code, TypeScript, JavaScript, SQL/migration, dependency, permission, native or release-configuration file appears in the diff.
- **Freeze commit:** the commit that wrote this block; it touches only this file and cannot record its own SHA. Resolve it with `git rev-parse HEAD`.
- **Remote state, verified by `git ls-remote` after pushing:**
  - `refs/heads/codex/program-quality-remediation` = `e15bbe9301fe756ecda9d8296877b19e425ac112` — **fast-forwarded from `965492e02184e07ddab20391740f10a694bd9149`, no force**; `965492e` was confirmed an ancestor of `e15bbe9` before the push.
  - `refs/heads/codex/biometric-rpe-discovery` = `dd7cf56e6d7e138d4830f45304f10efb69bd02e1` at the time of that push, then advanced by this freeze commit.
- **Pull request:** a **draft** stacked PR, base `codex/program-quality-remediation`, head `codex/biometric-rpe-discovery`, so its diff contains exactly the ten deliverables rather than unrelated prerequisite commits. It is **not** marked ready for review. **CodeRabbit** was asked for a review by manual comment (`@coderabbitai full review`), because a draft PR against a non-default base is not auto-reviewed.

**Manifest totals (mechanically derived):**

| Metric | Value |
|---|---|
| Columns | 15 |
| Rows | **48** |
| Unique IDs | 48 (no duplicates) |
| `primary_research` | **20** (18 + [S29] + [S30]) |
| `primary_research_review` | 6 |
| `primary_research_meta` | 2 |
| `journal_commentary` | 1 |
| `official_documentation` | 8 |
| `repository_control` | 10 |
| `preprint_context` | 1 |
| Partially verified | 5 — `S05`, `S06`, `S21`, `S22`, `S23` |

**Verification results at this freeze:**

| Check | Result |
|---|---|
| CSV parse | 15 columns, 48 rows, 48 unique IDs, 0 duplicates, every row exactly 15 fields, type totals as tabled |
| Prose → manifest join | **48** distinct cited IDs; **0** missing from the manifest; **0** manifest rows uncited (range notation expanded before joining) |
| Encoding / structure | all ten files valid UTF-8; no replacement characters, no mojibake, no conflict markers, no CR; all Markdown tables well-formed; CSV quoting valid |
| `git diff --check e15bbe9..HEAD` | clean — no whitespace errors, no conflict markers |
| Changed-path scope | exactly the ten permitted deliverables |
| `npm run verify:ci` | **exit 0** — 2,816 `PASS` lines; component tests 19 suites / 249 tests passing |

**On that `verify:ci` pass.** It required the repository's own prescribed preflight sequence first — `npm ci`, then `npm run fetch:embedder` (the sole network-capable materializer, which byte-verifies each artifact against its pinned SHA-256). **No verifier, product source, test, fixture, dependency, permission or release file was modified to obtain the pass.** Both installed trees are git-ignored and appear in no diff. The log's `FAIL` lines all sit inside the QA-artifact verifier's deliberate negative fixture, immediately followed by `PASS bad artifact reports failure without throwing`.

**No independent verdict on this state exists.** Codex/Sol's Round 4 audit was returned against `39cbafd…`; everything after it — including this freeze — is **executor remediation awaiting independent re-review**. Reviewer A (evidence) and Reviewer B (engineering/privacy) are both **incomplete**. A CodeRabbit review has been requested, but CodeRabbit is an automated assistant and is **neither** work-order lens. The work order's §10 independent-review criterion remains **unsatisfied**, and no reviewer conclusion has been invented, paraphrased or implied anywhere in this document set.

**Boundaries at this freeze.** Decision token: **RESEARCH PILOT ONLY — no prescription or athlete-facing estimate**, still provisional. **Pilot execution: NO-GO**, pending UD-1, UD-2, UD-7 and the `06` §11 qualified approvals. **UD-9** and **UD-10** both remain **open**; UD-10 is deliberately unfixed because product-code changes are out of scope. Not performed: merge, rebase, force-push, tag, release, APK build, permission change, schema change, product-code change, marking the PR ready, or pilot execution. `master` is untouched.

### Post-CodeRabbit candidate (CURRENT STATE)

This is the live state of the branch. It supersedes the freeze blocks above on every point where they differ; those are retained as history, not as current truth.

- **Candidate commit at the start of this remediation:** `16ff5485a7653a8fb03cb2df9c7f5a9e5f18c870` — tree `8cba55fedf48a1cf45339836f72baffc9e03e2cc`.
- **Base:** `e15bbe9301fe756ecda9d8296877b19e425ac112` (confirmed an ancestor of the candidate).
- **Post-freeze remediation commits** (all documentation-only, all inside the ten deliverables):

  | # | SHA | What it did |
  |---|---|---|
  | 1 | `cd2c4c2` | aligned `04` §10's feasibility verdict with the [S29] device/timing boundary |
  | 2 | `640e613` | scoped [S30] to association strength; withdrew "already works" framing for M0 |
  | 3 | `5409bdf` | addressed the CodeRabbit review: **excluded biometric-derived planned target RPE from M0**, added the `06` blinding gate and high-effort evaluability floor, OS-backup disclosure, `07` writer-contract and provenance limits, and removed a committed local filesystem path |
  | 4 | `9e2ea55` | reconciled residual [S30] prediction wording in `02` and the manifest row |
  | 5 | `16ff548` | reconciled the safety-care copy, `04` matrix qualifiers, Arm I calibration/holdout minima, and the O4 consent gate |

- **Pull request:** <https://github.com/FDOTPike/athlete-kinetics/pull/7> — base `codex/program-quality-remediation`, head `codex/biometric-rpe-discovery`, **draft, stacked**. Not marked ready; not merged.

**CodeRabbit status — stated precisely, because the two signals disagree.**

- The **manual reviews** (each triggered by an explicit `@coderabbitai full review` comment) produced **30 review threads**. All **30 are resolved**; **26 are outdated** (superseded by later pushes) and **0 current unresolved threads** remain.
- The **automatic status check** on the PR reports **"Review skipped: draft pull request"**, which GitHub renders as a green *pass*. **That green tick is not a review verdict** — it records that CodeRabbit declined to auto-review a draft. Do not read it as approval, and do not conflate it with the manual review results above.
- **CodeRabbit is an automated assistant. It is not the work order's Reviewer A (evidence) or Reviewer B (engineering/privacy), and it cannot satisfy either.**

**CI at this exact head (`16ff5485`)** — both GitHub jobs completed successfully:

| Job | Result |
|---|---|
| Verification suite (21 gates + typecheck) | **success** |
| Android QA + debug APKs (sideloadable, never for Play) | **success** |

**Durable manifest/citation invariant (replaces the brittle range-count phrasing).** The check that matters, and the one to re-run:

> **48 expanded cited IDs · 48 manifest IDs · 0 missing · 0 uncited.**

Every `[S##]`/`[D##]`/`[R##]` reference in the prose, **with range notation expanded to its members**, resolves to a manifest row; and every manifest row is cited somewhere. Counting how many ranges happen to appear is an artifact of phrasing and was removed — the invariant above is what a reviewer should assert.

**Independent review status — unchanged and unsatisfied.**

- **Reviewer A (evidence): COMPLETE — verdict REQUEST CHANGES.** **Reviewer B (engineering/privacy): COMPLETE — verdict REQUEST CHANGES.** Both lenses are now run and attached; **neither returned an approval, and no approval of any state of this branch exists.**
- Both lenses have now been completed and attached — Reviewer A against `337778f1` (plus a targeted re-verification of `756b031`), Reviewer B against `8c9c9a3`. Every finding from both is remediated in this commit, and **no reviewer has re-reviewed the result**. Whether the work order's acceptance criterion is thereby satisfied is an **owner determination**, not one this executor makes or claims.
- **No APPROVE verdict exists.** None has been issued, self-issued, fabricated, paraphrased, or implied by this executor, and no CodeRabbit output may be presented as one. Every audit round to date returned **REQUEST CHANGES**.

**On this commit's own SHA.** The commit that writes this block **cannot contain its own SHA** — the hash is computed over the content, so any SHA printed here would necessarily be a different, earlier commit. Reviewers must therefore resolve the live tip themselves rather than trusting a string in the text:

```
git rev-parse HEAD
git rev-parse HEAD^{tree}
git ls-remote --heads origin refs/heads/codex/biometric-rpe-discovery
```

The same caution applies to every SHA in this document: treat them as claims to verify, not as facts.

## 1. What the Round 3 closure run was (historical record — superseded on the push/PR points)

> **Currency note (per Round 4 review):** this section records the **Round 3 closure** run. Its statement that no push, merge, tag, release or build was performed was true when written and is **no longer current** on the push point — the branch is published and a draft stacked PR is open (see §0, "Current remote state", and the Round 4 freeze). The executor attribution below describes the Round 3 run; **Round 4 was executed by Claude Opus 5**. Merge, rebase, force-push, tag, release and build remain not performed.

Executor: GLM 5.3 at high effort, per the owner's dispatch (the remediation sequence's "recommended lead" rows name Gemini models; per established practice the owner's model switch is the role assignment). Effort disclosure: high, as instructed — for both the original run and the audit remediation. Owner override honored: the two in-run independent reviewers described in WO §9 were NOT commissioned; instead the owner-assigned Codex/Sol audit reviewed the first freeze (verdict: REQUEST CHANGES) and this remediation responds to it. Documentation-only: no TypeScript/JavaScript, SQL/migrations, native code, dependencies, permissions, prescriptions, release configuration, or signing material was touched. No biometric RPE scanner was implemented. **Updated at the Round 3 closure freeze:** the owner granted explicit authority to push this branch to GitHub, and that push is the **terminal action** of this closure pass — it follows this commit, and the resulting remote ref is verified against local `HEAD` in the closure handback. **No merge, no rebase, no force-push, no pull request, no tag, no release, no signing, no build, and no pilot execution is performed**, and `master` is not modified.

## 2. Files changed (complete list)

1. `docs/research/biometric-rpe/00_EXECUTIVE_DECISION.md`
2. `docs/research/biometric-rpe/01_CONSTRUCT_MAP.md`
3. `docs/research/biometric-rpe/02_EVIDENCE_REVIEW.md`
4. `docs/research/biometric-rpe/03_SOURCE_MANIFEST.csv`
5. `docs/research/biometric-rpe/04_ANDROID_DATA_FEASIBILITY.md`
6. `docs/research/biometric-rpe/05_PRIVACY_AND_SAFETY.md`
7. `docs/research/biometric-rpe/06_VALIDATION_PROTOCOL.md`
8. `docs/research/biometric-rpe/07_ARCHITECTURE_OPTIONS.md`
9. `docs/research/biometric-rpe/08_DECISION_DOCKET.md`
10. `docs/research/biometric-rpe/09_INDEPENDENT_REVIEW_HANDOVER.md`

Nothing outside `docs/research/biometric-rpe/` was added, modified, or deleted. No `.agents/**` or historical `team-preview/**` files were copied across (verified at W0: clean tree at base).

## 3. Source totals (03_SOURCE_MANIFEST.csv, **48 rows** after the Round 4 current-evidence remediation; counts mechanically derived and cross-checked against the CSV by script)

- **Literature records: 29** — of which **`primary_research`: 20**, plus 6 `primary_research_review`, 2 `primary_research_meta` and 1 `journal_commentary` [S24]. (**Label corrected per Round 4 review:** the aggregate was previously headed "Primary research: 29", which overstated the primary-evidence count by folding reviews, meta-analyses and a commentary into it.) — `primary_research` rose from 18 with the Round 4 additions **[S29]** (smartwatch HR vs ECG in resistance exercise) and **[S30]** (workload/context predictors of set RPE)
- Official platform/policy documentation: **8** (`D01`–`D05`, `D08`, `D09`, `D10` — corrected per third audit; the round-2 handover said six)
- Repository controls (live code/schema/policy inspection): 10 (`R01`, `R01b`, `R02`–`R05`, `R06`–`R08`, **`R09`** — RHR's actual code handling, added per third audit)
- Non-peer-reviewed preprint (context only, supports no claim): 1 (`S23`)
- Partially verified rows: 5 — `S05`, `S06`, `S21`, `S22`, `S23`, unchanged by Round 4 (`S10` moved out after the third audit supplied its full record: n = 17 healthy young adults, 12 M / 5 F, age 26.53±2.70). **Standing disclosure:** citation verification has failed across **four** audit rounds (round 3 caught residual stale figures, the RHR overstatement, the missing `HeartRateRecord` capability, and manifest field inconsistencies); treat every row as unverified until independently checked.

## 4. Important claims requiring your verification (highest-stakes first)

1. **The decision token** (RESEARCH PILOT ONLY, `00` §1) — check it is the right token given the evidence, and that nothing in the deliverable set quietly promises a feature.
2. **The bounded negative conclusion** (`02` §4b/§6, **revised across both audits**): the direct resistance-training literature ([S25] PERSIST set-level RPE dataset, [S26] camera-based fatigue/RPE monitoring, [S27] load-cell RPE/fatigue estimation on a robotic bench press, [S28] IEEE BIBM wearable IMU+ECG prediction where HRV features added incremental value) shows per-set estimation is a live, productive research area — but none of it validates consumer-watch/phone biometrics, the modality this app could collect. The claim to verify is the *bounded* one: "consumer-modality per-set RPE estimation is unproven, not disproven." Re-run the search independently across both lanes: (a) direct resistance-training estimation — "RPE prediction resistance training sensor", "PERSIST dataset perceived exertion", "fatigue estimation bench press machine learning", "perceived exertion IMU ECG flywheel"; (b) consumer-device estimation — "RPE estimation wearable heart rate", "machine learning rating of perceived exertion prediction smartwatch". If you find a consumer-modality per-set validation this review missed, the token itself needs re-examination. **Verify the four new identities against their publisher records yourself** — the first remediation got three of four wrong (S25 authors, S26 title/authors, S27 issue).
3. **Bibliographic identities — mandatory re-verification, given the documented failure history across four rounds** (rounds 1 and 2 shipped wrong identities; round 3 caught residual stale figures and classifications; Reviewer A caught two more in rows flagged `verified_this_run = Y`, then a third in the correction itself — reconciled per Reviewer B B-3, which found this list still saying "two rounds").** Round 1 shipped misreported citations (S12's study design, S18's DOI/issue/article number, S19's population and metrics, S20's author/year, S16's pagination, S24-vs-S21 mis-attachment); round 2's remediation then shipped three wrong identities of its own (S25 authors, S26 title/authors, S27 issue) and missed [S28]. **Treat every manifest row as unverified until you check it yourself.** Priority: `S25`–`S28` (the twice-touched lane), the audit-corrected rows (`S12`, `S16`, `S18`–`S20`, `S24`), the Round 4 additions (`S29`, `S30`), and the five currently partially verified rows (`S05`, `S06`, `S21`, `S22`, `S23` — `S10` is **no longer** on this list; its full record was supplied in round 3 and the row is fully verified). Do not rely on any in-document claim that a citation was "corrected" — verify the correction itself.
4. **Repository claim table** (`02` §7) — re-verify each `YES` against the cited files (bridge record types, `rpeTouched` null gate, session-close derivation, readiness weights, SpO2 weight 0.00).
5. **The SpO2 ruling** (`00` §3; `05` §8) — arguments: no effort evidence [S13/S18 are non-effort validations; S24 is the independent trustworthiness caution]; accuracy limits and device dropout [S18]; medical semantics [S11 analogy]; Play per-data-type declaration burden [D01/D02/D05]. Attack this; it is the most consequential collect/do-not-collect call.
6. **The validation protocol's two-arm design and its decision-critical ablation** (`06` §2/§7 — Arm P population athlete-disjoint, Arm I chronological individualisation, contemporaneous-RIR leakage rules, and the M0 workload/context vs M0+biometric incremental ablation with tuning contained inside training partitions) plus its safety properties (§1 five-band target per `effortCues.ts`, §8 unratified thresholds, §11 IRB/EC approval matrix) — stress-test whether any step could leak into product behavior without owner gates, whether Arm I's calibration-window design still leaks anywhere, and whether the ablation genuinely isolates the biometric increment.
7. **The privacy/architecture reconciliation** (`05` §1b/§2; `01` §4/§13; `07` §1) — verify against the live repository that the described flows are accurate. Specifically: **both** HRV/sleep policy paths — the **composite** path (`HRV/sleep → readiness_score → planned load/set/rpe_cap modifiers`) **and** the **direct** path (`hrv_z` / `sleep_efficiency_pct` read as rule conditions inside `evaluatePolicy`, `policyReference.ts:39,46,51`) [R07]; the **complete RHR data map** [R09] — requested and read, stored only alongside an existing/incoming HRV row (`useStore.ts:4232-4243`), contributing nothing to readiness or prescription, **exposed** through `loadMeasuredHistory` (`useStore.ts:4384-4405`), **counted** by the `hrvDays` diagnostic (`coachVerificationLab.ts:362-377`), and still lacking any athlete-facing consuming feature [UD-9 gap]; any-granted bridge status [R08]; and the ProfileScreen copy defect logged as UD-10 (`01` §13.4).
8. **Platform-documentation currency** [D01–D05, D08, **D09**, **D10**] — captured 2026-09-02 (D05's page footer-dated 2026-03-10); re-check the cited Android/Apple pages if policy changed. **D09 and D10 are included per Round 4 review**, because the `ExerciseSegment` set-structure claim and the `HeartRateRecord.Sample` / exercise-session-range claim in `04` §5 rest entirely on them; leaving them out put two load-bearing platform-capability claims outside the stated verification scope.

## 5. SpO2 disposition (as recorded — audit-accepted)

**Do not collect — any configuration, any purpose, under this discovery.** The independent audit explicitly accepted this ruling. Full reasoning: `05` §8 (and `00` §3); evidence: no effort relevance [S13/S18 are non-effort validations; S24 is the independent trustworthiness caution], accuracy limits and device dropout [S18], medical semantics [S11 analogy], Play per-data-type declaration burden [D01/D02/D05]. The schema's computed-but-excluded `spo2_component` (weight 0.00, Calibration Policy v1 [R01b]) stays untouched; formal deprecation is left open as UD-6.

## 6. Proposed architecture boundaries (for Reviewer B's lens — corrected per audit)

- Six value classes stay separate end-to-end (observed biometric / derived feature / readiness / advisory estimate / actual RPE / target RPE): `07` §1. **Readiness is a prescription input** — its flow is `biometrics (HRV, sleep) → readiness → planned load/set/rpe_cap modifiers` via `policyReference.ts` [R07] — and the boundary the architecture must hold is planned-side prescription vs athlete-authored actual RPE, which no biometric path may touch.
- No biometric value may write, grade, or appear inside the RPE entry flow; athlete-entered RPE is the only effort authority; unanswered stays NULL (`07` §9; `00` §4; repository law [R03]).
- Readiness composition remains the ratified HRV+sleep formula [R01b]; any future context display lives on the readiness surface, never beside set entry, and carries provenance + dates (`07` O4; `05` §4).
- No new permission, no new Health Connect record type, no schema change proposed. The collectible universe under this discovery is exactly the current three day-scale types + manual entry (`04` §1, §10) — **with the disclosed UD-9 gap**: RHR is requested and read, conditionally stored (only alongside an existing/incoming HRV row), exposed through the internal `loadMeasuredHistory` accessor and counted by the internal `hrvDays` diagnostic — while reaching **no** readiness, planned-load, planned-set or RPE-cap computation and having **no athlete-facing consuming feature** [R09]; and the bridge's any-granted "ready" status does not model partial grants [R08].
- O5 (advisory estimate) is hypothetical behind the full `06` chain (Arm P + Arm I); its smallest architecture is specified but nothing in it is authorized.
- 4 GB device contract: compaction boundary must not move; streaming costs are bounded-estimate-until-measured (`04` §9); research capture stays out of the shipped binary.

## 7. Unresolved decisions (complete list — from `08` §2)

UD-1 ratify/amend/shelve the pilot protocol; UD-2 adopt/reject/move candidate thresholds (MAE ≤ 0.5 in Arm I, high-effort miss ≤ 10%, band superiority, no-harmful-subgroup — unratified by design); UD-3 product ranking among O2/O3/O4; UD-4 session-RPE: direct global rating vs current mean-of-rated-sets derivation; UD-5 iOS HealthKit path; UD-6 `spo2_component` column deprecation vs neutral-excluded; UD-7 pilot data governance (retention, export, ethics text) if UD-1 = execute — **including the IRB/EC requirement** (`06` §11); UD-8 docket disposition after the post-remediation audit; **UD-9 (first audit)** the RHR consuming-feature gap — drop the request, give it a consuming feature, or document explicit justification before any Health apps declaration; **UD-10 (second audit)** the ProfileScreen copy defect (`apps/mobile/src/screens/ProfileScreen.tsx:415` claims RHR feeds readiness) — a code-remediation work order item, logged here because this WO is documentation-only. Plus the open scientific disagreements recorded in `08` §3 (advisory resolution vs perceptual noise floor; individual HRV reactivity; session-RPE construct framing; HRV vendor heterogeneity).

## 8. Known evidence weaknesses (own them before the auditor does)

- **Citation verification failed in rounds 1 and 2, and round 3 caught further residual errors — treat the failure history as **four rounds deep** (reconciled per Round 4; earlier text saying "two consecutive rounds" understated it and is withdrawn).** Round 1: S12's design was misstated (three-band ~71% vs the actual two-class n=10 85.7% KNN result); S18's DOI/issue/article number were wrong; S19's population and metrics were wrong; S20 carried a wrong author/year; S16 carried stale pagination; the Zhang & Khatami commentary was mis-attached; three direct resistance-training studies were missed. Round 2: the first remediation's replacement rows were themselves wrong (S25 authors; S26 title/authors — a wrong paper attached to a correct DOI; S27 issue) and the IEEE BIBM paper [S28] was missed. Round 3 then caught residual stale figures, the RHR overstatement, the missing `HeartRateRecord` capability and manifest field inconsistencies. All are dispositioned in §11 — and the standing lesson is stronger: **treat every citation in this package as unverified until an independent reader checks it against its publisher record.** The Round 4 additions [S29] and [S30] were each verified by this executor against the PubMed record (and, for [S29], the open-access full text) before being written in, but that is an executor's check, not an independent one.
- This is a **structured desk review, not a systematic review**: single-screening, search-engine discovery, no dual independent extraction, no pre-registered protocol (`02` disclosure note). Do not cite it as systematic.
- The core finding is a **bounded** negative: consumer-modality per-set RPE estimation is unproven, not disproven; the direct resistance-training literature is active and lab-instrumented (`02` §4b/§6). Absence of consumer-modality validation is not proof of impossibility.
- **Five** manifest rows are partially verified (`S05`, `S06`, `S21`, `S22`, `S23` — flagged in-row; no numeric claim rests on them). *`S10` was listed here in earlier rounds and is **SUPERSEDED BY ROUND 3**: its full record (n = 17 healthy young adults, 12 M / 5 F, age 26.53±2.70) was supplied and the row is now fully verified.* This count is mechanically derived from the CSV and agrees with §3. **Round-2 disclosure:** the first remediation's three new literature rows were themselves wrong (S25 authors; S26 title/authors; S27 issue) and [S28] was missed — fixed in the second remediation; counting round 3's residual findings, this executor's citation verification has now failed across three rounds, and every row must be independently re-verified.
- Key populations skew young/healthy/male (PERSIST: 12 men; Sensors: 32 men; S12: 10 adults cycling; S18: postoperative; S19: Korean adults 19–70) — transferability to the app's broader demographic is unknown.
- HRR evidence (`S11`) is clinical-population prognostics; it is used strictly as a boundary argument against medical framing, never as an effort claim.
- Platform documentation (`D01`–`D05`, `D08`) is a point-in-time capture (2026-09-02; D05 page-dated 2026-03-10) and evolves.
- All evidence is population-level; no individually validated model exists anywhere — which is precisely why the token is RESEARCH PILOT ONLY.

## 9. Exact checks already performed (across the four recorded rounds)

1. Ten deliverables exist under `docs/research/biometric-rpe/` (count verified by file listing; re-verified after remediation).
2. `03_SOURCE_MANIFEST.csv` parses (Python csv.DictReader): re-verified after regeneration — row count and 15-column header reported in §3.
3. Claim→source cross-check: every `[S##]`/`[R##]`/`[D##]` identifier used in the prose must exist in the manifest (script output: "MISSING FROM MANIFEST: none" — re-run after remediation edits).
4. Unsupported-certainty sweep: greps for forbidden/unsupported patterns — RPE-conversion verbs, medical-claim language, automatic-fill language, permission-change language — with every hit reviewed against context (prohibitions, negations, and this document's own descriptions of the checks are the expected hits). **Known limitation, stated honestly:** pattern sweeps catch phrasing, not misreported sources — the first freeze passed these greps while carrying citation errors; only the audit caught those. Treat this check as necessary, not sufficient.
5. `git diff --check e15bbe9..HEAD` (whitespace/conflict-marker hygiene): clean at every freeze, including this one. Run exactly that command — a bare `git diff --check` only inspects unstaged changes and proves nothing about the committed range.
6. Changed-path scope: only `docs/research/biometric-rpe/**` touched — exactly ten files; verified via `git status --porcelain` and `git diff --name-only e15bbe9..HEAD`.
7. Product-code/permission/dependency/migration/release verification: `git show --stat` confirms §2's file list; `package.json`, manifest, gradle, and schema files carry no diff.
8. Base-commit lineage: `git log` shows the commit chain rooted at `e15bbe9301fe756ecda9d8296877b19e425ac112`.

Re-run everything yourself — this handover is an input to your audit, not a substitute for it.

## 10. Review lenses (owner-assigned audit of the POST-REMEDIATION state)

- **Reviewer A — evidence:** source quality, construct validity, population fit, confounders, whether conclusions exceed evidence — now including whether the bounded negative conclusion (`02` §4b/§6) survives the added literature and whether the remediated citations actually reproduce.
- **Reviewer B — engineering/privacy:** repository fit, permissions, data minimization, failure modes, 4 GB implications, separation of planned prescription from athlete-entered actual RPE (`04`, `05` §1b, `07`, `02` §7).
- The first audit (REQUEST CHANGES) was returned against the pre-remediation state; its findings are closed in §11 and must be re-verified, not trusted. **Corrected per Reviewer B B-1:** an earlier revision of this line said “no verdict on the post-remediation state exists yet” and “do not treat any sentence in this document as a reviewer's conclusion.” Both halves are now false — Reviewer A returned REQUEST CHANGES against the post-remediation `337778f1`, Reviewer B against `8c9c9a3`, and §§13–14 **are** reviewers' conclusions, reproduced as delivered. What remains true: **no approving verdict exists**, and no verdict binds any SHA other than the one it names. Material disagreements you find belong in the decision docket (`08`), per the work order.

## 11. Remediation record (audit responses, this branch)

**Round 1** (against the first deliverables commit): REQUEST CHANGES, five P1 findings + additional corrections — all dispositioned below.
**Round 2** (against `9388edb6d24c7fde4b379f486b1a3cac56923111`): REQUEST CHANGES, six findings, three of them errors in the round-1 remediation itself — dispositioned below.
**Round 3** (against `1649c8ed45f539ae8b5e4a7f09ef0c965280cbe3`): REQUEST CHANGES as a final recheck — freeze integrity, docs-only scope, and all round-2 literature/platform fixes passed; four P1s + a P2 set of residual inconsistencies followed. All dispositioned below.
**Round 4** (against `39cbafd6ec9437aa78070b7b6ed6ecc00b0e608b`, the pushed Round 3 closure freeze): REQUEST CHANGES — current-evidence correction, handover correction, PR-base correction, and independent reviews still pending. Dispositioned in the Round 4 table below.

### Round 1 (five P1 findings + additional required corrections)

| # | Audit finding | Disposition |
|---|---|---|
| P1-1 | S12 materially misreported (three-band ~71% vs actual two-class high/low exertion at RPE 3.5, n=10, 70 records, 20% test split, best 85.7% KNN); invalidated the three-band pilot justification | **FIXED** — S12 rewritten in `02` §4 and the manifest from the primary paper (verified against the audit's attached full text); every "three-band ceiling" claim removed (`06` §1, §8; `09` §4.2); the three-band secondary target now rests only on [S03] + app cue bands [R05] — **SUPERSEDED BY ROUND 2/3:** the secondary target is defined on the app's **five** cue bands [R05], and the collapsed three-band view is **exploratory robustness reporting** that is *not* derived from or justified by those five bands (`06` §1, §8) |
| P1-2 | Direct resistance-training research missed (PERSIST; BSPC 105701; Sensors 25(20):6588) | **FIXED** — added as [S25]/[S26]/[S27], each verified against its primary page and explicitly bounded (lab instrumentation, homogeneous cohorts, single exercises); the overbroad negative conclusion withdrawn and replaced with the bounded "unproven, not disproven" statement (`02` §4b/§6); handover reviewer guidance updated to two-lane search |
| P1-3 | Validation split incoherent: athlete-disjoint holdout incompatible with per-athlete models/baselines; contemporaneous-RIR leakage unspecified | **FIXED** — `06` §2/§7 redesigned into Arm P (population generalisation, athlete-disjoint) and Arm I (individualisation, chronological calibration window → future-session holdout); contemporaneous RIR barred as an input absent a pre-registered leakage-free calibration procedure; baselines and metrics re-assigned per arm |
| P1-4 | Privacy/architecture contradicted the repository: claimed all three types feed readiness (RHR does not); called readiness "descriptive" while it drives load/sets/rpe_cap via `policyReference.ts`; permission wording claimed a non-existent consuming feature | **FIXED** — `05` §0/§1b/§2/§3 rewritten to the actual flow `biometrics (HRV, sleep) → readiness → planned prescription modifiers` [R07]; RHR no-consumer gap disclosed as UD-9 with three owner options; consent wording corrected; partial-grant bridge behavior documented [R08]; `01` §4 and `07` §1/§9 reconciled |
| P1-5 | Residual citation errors: S18 wrong DOI/issue/article number; S19 inconsistent population and unreported metrics; S20 wrong author/year; S21 mis-cited for the SpO2 warning (which is S24, previously rowless); S16 stale pagination; handover's self-certification therefore false | **FIXED** — all five rows corrected from primary pages (Helmer et al. iScience 26(11):108155 / PMC10590865; S19 actual κ/F1 results and 19–70-y hospital+clinic population; Charest & Grandner 2020; Ma et al. 19(5):873–882); S24 given its own row; S21 scoped to HR only; handover §3/§8 now discloses the failures instead of certifying past them |
| Additional | "tens of MB" unsupported memory claim | **FIXED (historical) — SUPERSEDED BY ROUND 2/3:** the replacement figure quoted here (~5–15 MB working set per active streaming session) was itself arithmetically wrong. The round-2 remediation withdrew it and corrected `04` §9 to 0.2–0.4 MB, retaining the explicit measurement-gate requirement. Recorded for history; **not current truth** |
| Additional | Retention implied trailing-window deletion the code does not implement | **FIXED** — retention stated as-built: indefinite daily rows, bounded read window, deletion only via `resetTrainingData` (`04` §11; `05` §4); bounded pilot retention tied to UD-1 ratification (`05` §1) |
| Additional | Partial Health Connect grants unmodeled | **FIXED** — documented the any-granted "ready" behavior [R08] and specified the required per-type granted/denied model for future consent/status work (`05` §1b; `04` §10) |
| Additional | Chest-strap-vs-ECG attribution overreach; vague D05 row | **FIXED** — `04` §4 scoped to what S09 actually supports; D05 replaced with the page-dated Health Connect publishing row (footer-dated 2026-03-10) and Apple's App Review Guidelines added as D08 |

**Not changed (audit-accepted):** the RESEARCH PILOT ONLY token (now provisional pending re-audit), the SpO2 do-not-collect ruling, the WO boundaries, the documentation-only scope. **Pilot execution remains NO-GO** until UD-1 ratifies the remediated protocol.

### Round 2 (second audit against `9388edb6d24c7fde4b379f486b1a3cac56923111`)

Second verdict: REQUEST CHANGES — freeze integrity, documentation-only scope, the two-arm split, the RIR leakage rules, and the SpO2 ruling all passed; six substantive findings followed. Dispositions:

| # | Second-audit finding | Disposition |
|---|---|---|
| P1-1 | First remediation's new literature was bibliographically wrong: PERSIST authors (real: Albert, Herdick, Brahms, Granacher, Arnrich); DOI 10.1016/j.bspc.2023.105701 is "A computer vision approach to continuously monitor fatigue during resistance training" by Albert & Arnrich (not "Hard set" by Wei et al.); Sensors is 25(**21**):6588 (not 25(20)); the IEEE BIBM paper was missed | **FIXED** — [S25]/[S26]/[S27] corrected from the publisher records attached to the audit; **[S28] added** (IEEE BIBM 2021, doi 10.1109/BIBM52615.2021.9669577: 16 participants, flywheel squats, six IMUs + chest ECG, best MAPE 7.71%, r = 0.85, R² = 0.48, HRV features significantly improved prediction — the direct motivation for the §7 ablation); `02` §4b intro and conclusion updated to four studies |
| P1-2 | "Health Connect has no set/repetition schema" is false — `ExerciseSegment` supports repetitions, weight, `setIndex`, optional 0–10 RPE | **FIXED** — `04` §1/§4 rewritten: the platform schema does support set-level structure [D09]; the accurate claim is that the current bridge does not request or consume these records and vendor coverage/latency is unverified |
| P1-3 | Stale citations survived in supposedly corrected sections: S19's MAPE/84–91% figures still in `01` §10 and `04` §2; S21 still cited for SpO2 in `08` D-MADE-2 | **FIXED** — both S19 passages rewritten to the paper's actual reported results; D-MADE-2 now cites [S24]; sweep re-run |
| P1-4 | Documented flow still contradicted live code: `evaluatePolicy` uses `hrv_z` and `sleep_efficiency_pct` **directly** in rule conditions, not only via readiness; ProfileScreen copy claims RHR feeds readiness | **FIXED** — `01` §13.3 states the flow as composite **plus** direct rule conditions (`policyReference.ts:39,46,51`); the ProfileScreen defect logged as **UD-10** (`08` §2, `01` §13.4) — a code-remediation item, out of scope for this documentation-only WO |
| P1-5 | Pilot could not establish whether biometrics add value (no matched workload/context model); "three app cue bands" contradicts the five bands in `effortCues.ts`; IRB requirement | **FIXED** — `06` §7 adds the decision-critical **M0 (workload/context: relative load, reps, set index, rest, movement class, target RPE) vs M1 (+biometric features) matched ablation** with identical splits/tuning and out-of-sample Δ reporting; §1 corrects to the five owner-ratified cue bands; §11 requires **IRB/EC approval** per Google's human-subjects-research rules [D02] |
| P2 | Memory arithmetic wrong (0.2–0.4 MB, not 5–15 MB); S09 does not directly validate chest straps; S10 is an original study not a review; S24 is a journal commentary not platform documentation; residual "ceiling" language; `^3.3.0` is a range (lockfile: 3.5.3); "40 cited IDs" undercount | **FIXED** — `04` §9 arithmetic corrected with the wrong figure withdrawn; S09 attribution scoped; S10 reclassified `primary_research` with sample size flagged; S24 retyped `journal_commentary`; "ceiling" retired in `02` §6/§9 and `07` O5; version statement corrected; handover counts mechanically regenerated (44 manifest rows at that time — **SUPERSEDED BY ROUND 3:** the manifest now carries **46** rows after `D10` and `R09` were added; see §3; the prose↔manifest join count is stated only from script output) |

### Round 3 (third audit against `1649c8ed45f539ae8b5e4a7f09ef0c965280cbe3` — final recheck)

Third verdict: REQUEST CHANGES — freeze integrity, docs-only scope, and all round-2 literature/platform fixes passed (S25–S28 reproduce against the HPI publication record; `ExerciseSegment` correctly documented; memory arithmetic corrected); four P1s + a P2 set of residual inconsistencies followed. Dispositions:

| # | Third-audit finding | Disposition |
|---|---|---|
| P1-1 | Executive rationale contradicted the corrected evidence: `00` §2 still said "no existing evidence converts HR/HRV into set RPE" and "no validation dataset exists" (**both quoted as the historical defect — SUPERSEDED BY ROUND 3; neither phrase states current truth, and PERSIST [S25] and [S28] are acknowledged throughout**) | **FIXED** — `00` §2 narrowed to the defensible claim: no *representative consumer-watch/phone field validation* exists for this app's population/modality, while lab-grade estimation and HRV increments exist under instrumentation the app lacks; the ADVISORY rejection re-worded on the same scope |
| P1-2 | RHR data map wrong: "stored and feeds no computation" (**quoted as the historical defect — SUPERSEDED BY ROUND 3; the phrase is withdrawn and does not state current truth**) ignored `useStore.ts:4237` and `coachVerificationLab.ts:376` | **FIXED, then COMPLETED BY ROUND 3 CLOSURE (C-4):** this round restated `00` §6, `05` §0, `01` §13 and `08` UD-9 around the athlete-facing-consumer test [**R09** added], but the map was still **incomplete** — it omitted `loadMeasuredHistory` (`useStore.ts:4384-4405`). The complete five-fact map is recorded in the Round 3 closure table below and is the current truth |
| P1-3 | "No Health Connect record captures rest-interval HR" was false — `HeartRateRecord` samples are timestamped and queryable over an exercise session's time range [workouts guide] | **FIXED** — `04` §5.3 corrected: platform capability exists [**D10** added]; the limitation is the app's ingestion and unverified vendor coverage, not the schema |
| P1-4 | Ablation ambiguous: M1's "any session-context features" clause would confound M1−M0 | **FIXED** — `06` §7: M1 adds **only pre-registered biometric features** (prior-night HRV z, sleep efficiency) with every non-biometric feature identical; paired deltas on biometric-eligible rows with **coverage reported separately**; Arm P new-athlete availability rules for relative-capacity and HRV-z defined without label leakage |
| P2 | Handover said six official-documentation rows (CSV had seven→eight with D10); S10 typed primary research but classed "review" (actual: n = 17 healthy young adults); S24 classed "platform policy"; S12 applicability said "ceiling"; R06 said versions "pinned"; `01` §7 still gave chest-strap accuracy directly to S09; `06` §8 still said "three-band" | **FIXED** — counts mechanically derived (stated at the time as "45 rows: 28 literature / 8 official docs / 10 repo controls / 1 preprint" — **SUPERSEDED BY ROUND 3 CLOSURE:** that line was arithmetically wrong on two counts; the correct totals are **46 rows = 27 literature + 8 official documentation + 10 repository controls + 1 preprint**, as mechanically derived in §3); S10 updated to n=17 with class `correlation`; S24 classed `journal commentary`; S12 wording fixed; R06 wording fixed (`^3.3.0` → lockfile 3.5.3); `01` §7 attribution scoped; `06` §8 wording aligned to five bands + collapsed-three-band robustness view |

### Round 3 closure — executor remediation under owner-granted push authority

**What this pass is.** A bounded documentation closure pass against the Codex/Sol Round 3 audit of `1649c8ed45f539ae8b5e4a7f09ef0c965280cbe3`, completing the residual findings that the first Round 3 remediation commit left open. It was executed by **Claude Opus 5** as *executor*, not as reviewer, under **explicit owner-granted authority** to remediate, commit, and **push this branch to GitHub**. Scope was restricted to the ten documents in §2; no product code, TypeScript, JavaScript, SQL, dependency, permission, native, or release-configuration file was touched.

**Explicit non-claim — no fabricated verdict.** **Codex/Sol has NOT reviewed, verified, or approved the post-edit state produced by this pass.** No independent post-fix verdict exists, and none has been invented, paraphrased, or implied anywhere in this document set. The Round 3 audit was returned against `1649c8e`; everything committed after that point — including this pass — is **executor self-remediation awaiting independent re-review**. The work order's §10 independent-review acceptance criterion remains **unsatisfied**.

**Residual findings closed by this pass:**

| # | Residual finding at `e2dde70` | Disposition |
|---|---|---|
| C-1 | `00` §2 still asserted the unbounded "no population-transfer evidence exists for resistance training on consumer devices" | **FIXED** — replaced with the bounded statement: the available transfer evidence is small, homogeneous, laboratory-based, and collected under instrumentation the shipped app lacks (six IMUs + chest ECG with derived HRV [S28]; IMU + ECG + MoCap [S25]) — thin and off-modality, not absent |
| C-2 | Token boundary did not separate shipped code from the offline pilot; `00` §1.1 blanket-barred converting biometrics into "any form of RPE", which the blinded pilot must be able to do offline | **FIXED** — `00` §1.1 now states both halves: shipped product code may never generate, display, pre-fill or grade athlete RPE from biometrics; the offline pilot may compute predictions **solely for blinded validation**, with no athlete-facing and no prescription authority |
| C-3 | `01` opening claimed "descriptive signals have no prescription authority" — false, since `hrv_z`/`sleep_efficiency_pct` reach planned prescription directly [R07] | **FIXED** — `01` §intro withdraws the claim and states the narrower true invariant: no physiological signal may fill, grade or substitute for athlete-reported RPE; its legitimate reach is the readiness/planning channel |
| C-4 | RHR data map incomplete everywhere: `loadMeasuredHistory` (`useStore.ts:4384-4405`) exposes `resting_hr` and appeared in **no** deliverable; "feeds nothing" survived in `09` §4.7 and §6 | **FIXED** — the complete five-fact map (requested/read; conditionally stored; no readiness or prescription contribution; exposed via `loadMeasuredHistory`; counted in the `hrvDays` diagnostic) now appears in `00` §6, `01` §8, `02` §5, `05` §0/§1b, `08` UD-9, `09` §4/§6; `R09` expanded to cite all four live file ranges; both the "feeds nothing" and "always stored" overstatements withdrawn; UD-9 reaffirmed as a valid Play/declaration issue; UD-10 left **unfixed by design** (product code is out of scope) |
| C-5 | `04` §5 lacked segment start/end timestamps, sampling density, and the explicit HR-to-rest-window alignment capability | **FIXED** — `04` §5.1/§5.3 now state that `HeartRateRecord.Sample`s are timestamped and queryable over an `ExerciseSessionRecord` range, that segments carry start/end times plus reps/weight/set index/optional RPE, that the platform **could theoretically** align HR samples with exercise and rest windows, that Athlete App requests and consumes neither record type, and that vendor coverage, sampling density, sync latency and segment completeness are unverified [D09, D10] |
| C-6 | `06` §7 lacked an exact paired-comparison population and an Arm P cold-start definition | **FIXED** — the delta is now fit and evaluated on identical biometric-eligible rows and splits, with M0 additionally evaluated over the **full labelled population** as a coverage reference and selection differences reported; Arm P cold-start distinguishes a **declared pre-pilot capacity assessment** from **trailing historical load**, with a missing field or a pre-registered alternative when neither exists; HRV z is restricted to pre-prediction history and stays missing when history is insufficient |
| C-7 | `06` §8 tied the collapsed three-band view to the app's cue bands; `09` §8 said six partially verified rows while §3 said five; historical `~5–15 MB`, `44 rows`, `45 rows / 28 literature`, and the three-band disposition were presented as current truth | **FIXED** — §8 states five cue bands with the three-band view as **exploratory robustness reporting not derived from or justified by them**; the partially-verified count reconciled to **five** (`S05`, `S06`, `S21`, `S22`, `S23`); every stale historical figure now carries an explicit **SUPERSEDED BY ROUND 2/3** marker preserving the history without asserting it |
| C-8 | Manifest precision: `S10` classed `correlation`; `R09` cited only two of the four live locations | **FIXED** — `S10` reclassified **validation study**; `R09` rewritten to cite `useStore.ts:4232-4243`, `useStore.ts:4384-4405`, `coachVerificationLab.ts:362-377`, and `ProfileScreen.tsx:413-417`. Totals unchanged at 46 rows |

**Boundaries unchanged by this pass.** The decision token remains **RESEARCH PILOT ONLY — no prescription or athlete-facing estimate**, and remains provisional. **Pilot execution remains NO-GO** pending UD-1, UD-2, UD-7 and the §11 qualified approvals. No merge, rebase, force-push, pull request, tag, release, or build was performed, and the pilot was not executed.


### Round 4 (Codex/Sol audit of `39cbafd6ec9437aa78070b7b6ed6ecc00b0e608b`)

**Fourth verdict: REQUEST CHANGES.** The audit examined the pushed Round 3 closure state. Freeze integrity, the documentation-only ten-file scope, the corrected RHR data map, the Health Connect capability correction and the M0/M1 ablation design all passed. Four findings followed; all are dispositioned below.

| # | Round 4 finding | Disposition |
|---|---|---|
| R4-1 | **Current-evidence correction.** The evidence base predated two directly relevant 2026 primary sources, and the package carried a categorical "wrist PPG fails during strength work" claim that rests on [S09] — a *running* study — rather than on resistance-training data | **FIXED** — **[S29]** (Lee et al., *Sensors* 2026;26(8):2526; PMID 42076635) and **[S30]** (Lyristakis et al., *J Strength Cond Res* 2026 Aug 4; PMID 42551879) added to `03` and written into `01`, `02`, `04` and `06`. Both were verified by this executor against the PubMed record before use, and [S29] additionally against its open-access full text (PMC13120158) for the exercise list and HR timepoints. The categorical wrist-PPG wording is replaced everywhere with the evidence-supported **device- and timing-specific** boundary: consumer-watch HR agreed with ECG around resistance sets (r = 0.64–0.97, ICC > 0.94, LoA ≈ ±10 bpm) at **three discrete timepoints**, with **only the Apple Watch** matching ECG in the resistance condition — while **continuous intra-set HR, Health Connect delivery, cross-device equivalence, RPE prediction and any non-male population remain unvalidated**. [S30] gives the M0 baseline independent non-biometric support and argues for retaining movement class. Decision token unchanged: **RESEARCH PILOT ONLY** |
| R4-2 | **Handover correction.** `09` carried stale structure: a "two rounds" freeze heading, a commit chain still described as entirely local and unpushed, an item identifying a superseded freeze as `HEAD`, a reproducible command missing its commit range, `S10` still on the partially-verified priority list, and "two" versus "three" audit-failure statements in conflict | **FIXED** — heading now reads four rounds and pushed; the historical pre-push chain is explicitly separated from a new **Current remote state** block; the obsolete `HEAD` item is replaced with `39cbafd…`'s actual SHA and tree; the command is corrected to `git diff --check e15bbe9..HEAD` with a note on why the bare form proves nothing; `S10` removed from the current priority list (it is fully verified) and `S29`/`S30` added; the failure history reconciled to **three rounds** with the understating text withdrawn. All source and count references updated for the two new rows |
| R4-3 | **PR-base correction.** The branch's changes sit on top of the `codex/program-quality-remediation` lineage, so a pull request opened against the repository default branch would have shown unrelated prerequisite commits rather than this discovery's ten documents | **FIXED** — the prerequisite remote branch is fast-forwarded (no force) to `e15bbe9301fe756ecda9d8296877b19e425ac112`, and the pull request is opened as a **draft stacked PR** with base `codex/program-quality-remediation` and head `codex/biometric-rpe-discovery`, so its diff contains exactly the ten `docs/research/biometric-rpe/` files |
| R4-4 | **Independent reviews still pending.** Neither work-order review lens has been completed on any post-remediation state | **OPEN — NOT FIXED, and not fixable by an executor.** Reviewer A (evidence) and Reviewer B (engineering/privacy) both remain **incomplete**. CodeRabbit has been asked for a full review on the draft PR; that is an automated assistant, **not** either work-order lens and **not** an independent evidence review. The work order's §10 independent-review acceptance criterion remains **unsatisfied** |

**Explicit non-claim.** Codex/Sol has **not** reviewed, verified or approved the post-Round-4 state. The Round 4 verdict recorded above was returned against `39cbafd…`; everything committed after it is executor remediation awaiting independent re-review. No reviewer verdict on the current state exists, and none has been invented, paraphrased or implied.

**Boundaries unchanged by Round 4.** Decision token: **RESEARCH PILOT ONLY**. **Pilot execution: NO-GO**, pending UD-1, UD-2, UD-7 and the `06` §11 qualified approvals. **UD-9** (RHR consuming-feature gap) and **UD-10** (ProfileScreen copy defect) both remain **open**; UD-10 is deliberately unfixed because product-code changes are out of scope. No merge, rebase, force-push, tag, release, APK build, permission change, schema change, product-code change or pilot execution was performed.

## 12. How to fail this work

For clarity, the findings that would most change the outcome: any verified primary source demonstrating per-set biometric RPE estimation; any repository claim in `02` §7 that does not reproduce; any conflated construct in `01`; any missing manifest row behind a material claim; any place the deliverables promise a feature rather than a decision. If you find one, the token, the docket, or the document set needs revision — say which.

## 13. Reviewer A — independent evidence audit (COMPLETED; verdict REQUEST CHANGES)

**This is the first completed independent review lens on this branch.** It is recorded here because the status changed: Reviewer A is no longer pending. It did **not** approve.

- **Auditor:** Hermes running GLM 5.3, read-only. It performed no repository writes and no GitHub mutations, and reported the worktree byte-identical at audit end.
- **Audit target:** `337778f1dc72604d4b360478c662180b5ec9c35a` (tree `02360399…`, parent `16ff5485…`, base `e15bbe93…`).
- **Verdict: REQUEST CHANGES.** Two P2 findings, **no P1**. Merge/release authority explicitly **not granted**. **Reviewer B: still required.**

### Findings and disposition

| # | Reviewer A finding | Disposition |
|---|---|---|
| P2-1 | **[S09]'s headline "MAPE up to ~18.66%" does not exist in the primary source.** The paper reports no MAPE statistic at all; its error magnitudes are accuracy root-mean-square (Aᵣₘₛ) **in bpm**. The figure most plausibly came from the Apple Watch treadmill Aᵣₘₛ of 18.34 bpm — a different metric in a different unit | **FIXED and independently re-verified.** This executor confirmed against the PMC full text (PMC9952291) that `18.66` occurs **0 times** and `MAPE` occurs **0 times**, while all six cited Aᵣₘₛ values are present. The figure is withdrawn from `02` §4, `01` §7 and the S09 manifest row and replaced with the paper's actual reported statistics. **Two further S09 errors were found in the same pass and are also fixed:** the population was recorded as "healthy adults" (actual: **8 athletes**, 1,286 HR pairs) and the modality as "intense free-running exercise" (actual: **maximal stress testing on a cycle ergometer or treadmill**) |
| P2-2 | **[S08]'s sample size is wrong — the paper enrolled 13, not 16.** The row was typed `primary_research` with `verified_this_run = Y`, so the error sat inside a row the package asserted was fully verified | **FIXED and independently re-verified.** The PubMed record (PMID 30041435) states "Thirteen male HIFT practitioners". Corrected in `02` §2 and the S08 manifest row. **A third error in the same sentence, which Reviewer A did not flag, was found and fixed:** the entry said "three HIFT sessions"; the paper names **two** (Fight Gone Bad and Fran). The validity conclusion is unchanged by either correction |
| P2-3 | **Opened by Reviewer A against the remediation `756b031` itself.** The replacement S09 statistics carried two new errors of the class being corrected: the Fitbit's >150 bpm ICC was written `0.019` when the primary table reports **−0.019** (dropped sign, which understates the disagreement), and "the Apple Watch stays moderate (ICC 0.528–0.729)" attached a range to the Apple Watch when **0.528 is the TomTom's** value and the Apple Watch's is **0.729** alone — leaving `02` and the manifest disagreeing with `01` | **FIXED.** Both corrected in `02` §4, `01` §7 and the S09 manifest row: the Fitbit ICC is now **−0.019**, and the >150 bpm pair is attributed per device (**TomTom 0.528, Apple Watch 0.729**). **Owned plainly:** the previous commit message asserted every replacement figure had been re-verified against the primary source; these two had not been, which is the same corrections-carrying-their-own-errors failure mode this package's disclosure history names. No threshold or decision rested on the ICC values, and the load-bearing Aᵣₘₛ figures and the FB/G2 collapse were correct |

### What Reviewer A verified and did not challenge

Recorded because a reviewer should know what has already been reproduced independently: the ten-file scope and focused three-file diff; the four-round audit history with no approving verdict; the D-MADE-6 `07` O4 cross-reference; the historical-vs-current freeze structure; all five post-freeze commits; PR #7's draft/stacked/base/head state; the CodeRabbit distinction (30 threads / 30 resolved / 26 outdated / 0 unresolved, versus the "review skipped: draft" green non-verdict); the **48 / 48 / 0 / 0** citation invariant; and both GitHub jobs `success` at the audit target itself. It re-ran a fresh five-lane literature search and found nothing that changes the decision token. It independently confirmed the construct separations, the `evaluatePolicy` biometric-to-`rpe_cap` path behind M0's exclusion of planned target RPE, the Arm P/Arm I designs, the blinding gate, the evaluability floors, and the platform-capability statements against live Android documentation.

### Reviewer A INFO items (not findings; recorded for the owner)

- **[S06] could be upgraded from partially verified to fully verified** — its identity and sample (Hackett et al. 2019, JFMK 4(3):56, n = 27 M + 11 F) are resolvable from the publisher page. **Left as-is deliberately:** changing a verification flag is an evidence decision, and no numeric claim rests on the row. Owner call.
- **[S06]'s one-line gloss in `02` §1 compresses the paper's finding.** The correlation is with *absolute* error, which the authors attribute mainly to proximity-to-failure (error is larger in easy early sets). The package uses S06 only as a qualitative confounder flag and extracts no number from it. Recorded, not changed.

### Status after this remediation

**Reviewer A: COMPLETED, verdict REQUEST CHANGES — findings remediated above, re-review NOT run.** A remediation is not an approval, and this executor has not sought, inferred, or recorded one. **Reviewer B (engineering/privacy): COMPLETED — verdict REQUEST CHANGES; see §14 below.** *(This line previously read “NOT STARTED” and denied that §14 existed — both true when written, both false once Reviewer B reported and §14 was added. Corrected per Antigravity panel P1-1; its handover scope was §6 with §10.)* The work order's acceptance criterion requiring **both** independent reviews attached remains **NOT met**, and merge/release authority remains **not granted**.

## 14. Reviewer B — independent engineering/privacy audit (COMPLETED; verdict REQUEST CHANGES)

**Audit target:** `8c9c9a3cc02481b5eaaa15ec440f45dea1843272`, tree `2dca9e5792db132b0c8034aea3d5dc5e299b95df`, base `e15bbe93` — all confirmed by the reviewer, worktree clean at both ends.
**Reviewer:** independent, fresh, read-only; a different session and dispatch from this executor (Claude Opus 5). No writes, no GitHub mutations, no desired verdict supplied.
**Verdict: REQUEST CHANGES — five P2 findings, zero P1.** All ten load-bearing engineering/privacy claims in the dispatch reproduced against live code (R09's five-fact RHR map complete and accurate; UD-10 confirmed live and correctly unfixed; R08 bridge model; O4 provenance limits; O3 writer hazard; retention-as-built; memory arithmetic; ten-file scope with zero code/permission changes).

| # | Finding | Disposition |
|---|---|---|
| B-1 | Stale review-status claims survived Reviewer A's completion — `09` §0/§10 and the CURRENT STATE block, `08` §5 and the criterion row, and `00` §5 all still said the lenses were un-started, contradicting §13 | **FIXED** — every review-status statement in `00`, `08` and `09` swept to the true state: both lenses complete, both REQUEST CHANGES, findings remediated, no re-review run, no approval anywhere, §10 satisfaction left to the owner |
| B-2 | The OS-backup egress claim contradicted the build: `android:allowBackup="false"` with no override (`AndroidManifest.xml:24`) means the app is excluded from Auto Backup, cloud restore and device-to-device transfer | **FIXED** — `05` §3 now states the opt-out as built, withdraws the "real egress route ... outside the app's control" sentence as factually wrong, names the residual routes (OEM tooling; a future `allowBackup` regression, worth a build-time guard), and the draft consent copy no longer asserts a forbidden egress path |
| B-3 | The "two rounds" understatement survived in `09` §4's priority list while §8 called the history three rounds deep | **FIXED** — §4 item 3 now reads four rounds and names what each caught, including the two Reviewer A found inside `verified_this_run = Y` rows and the third inside the correction itself |
| B-4 | M0's "current load ... reps, set index" were unpinned, leaving a live biometric leak channel: `load_modifier` and `set_modifier` are readiness/HRV/sleep-driven (`policyReference.ts:36-55`), so executed values carry readiness into the biometric-free arm — excluding planned target RPE closed only one of three doors | **FIXED** — `06` §7 now pins load, the relative-load numerator, reps and set index to **as-written (pre-modifier)** values, demands the same independence proof required of any plan-derived feature, and makes a row with no captured pre-modifier value **ineligible for M0** rather than back-filled |
| B-5 | Byte-identical bullet duplicated at `05` §1b and §1 | **FIXED** — the §1 copy now cross-references §1b instead of restating it |

**Observations dispositioned:** (a) the `04 S2` section pointer collided with manifest ID `S02` — renoted as `04` §3; (c) the `07` matrix cell "New schema: none" for O3 now carries a footnote stating it holds only under writer-option (b). (b) the one-line overlap in R09's cited ranges is accepted as cosmetic; the code boundary is unambiguous.

**Not an approval.** Reviewer B returned REQUEST CHANGES and has **not** re-reviewed this remediation. Its verdict binds `8c9c9a3` only.

## 15. Antigravity multi-agent panel — independent review (COMPLETED; verdict REQUEST CHANGES)

**Audit target:** `504d999922045ae342343666ccedb892d921d860`, tree `be43a322140840c9295504f0f747345bbd94688a`, base `e15bbe93` — all confirmed by the panel; target worktree clean at inception and completion, zero repository or GitHub mutations.
**Panel:** seven lanes (A1 citation forensics, A2 cross-document consistency, A3 live-code reproduction, A4 validation protocol and leakage, A5 privacy/permissions/policy, A6 mechanical battery, A7 adjudicator), on a Gemini runtime — a third model family, reviewing state **no prior reviewer had seen**. No desired verdict supplied.
**Verdict: REQUEST CHANGES — six P1, fourteen P2.** Lanes A3 (live-code) and A6 (mechanical) returned PASS: every repository claim reproduced against source, and all eight mechanical checks exited 0.

### P1 findings and dispositions

| # | Finding | Disposition |
|---|---|---|
| P1-1 | Two "Reviewer B: NOT STARTED" survivors (`00` §1 header, `09` §13 status line, the latter also denying §14 existed) contradicting §14 and the swept lines — the B-1 sweep was incomplete | **FIXED** — both corrected to COMPLETE / REQUEST CHANGES with the prior wording disclosed |
| P1-2 | `07` §1 item 6 asserted planned target RPE was "untouched by all biometric paths" — contradicting `policyReference.ts` and the entire `06` §7 rationale for excluding it from M0 | **FIXED** — restated as biometric-modulated on the planning side, strictly separated from athlete-entered actual RPE |
| P1-3 | **The fourth door.** `preceding rest interval` sat in M0 unpinned. Prescribed rest is a function of target RPE (`restSecondsFor` → 240/180/120/90 s, `SessionScreen.tsx:111-115`, called with `safeRpe ?? currentSlot.targetRpe` at `:589`), and `targetRpe` is capped by the biometric `rpe_cap` — so rest duration carries readiness | **FIXED** — executed rest duration **barred**; only as-written prescribed rest may enter, with the same independence proof and missing-not-back-filled rule |
| P1-4 | Door 2 only half closed: the relative-load **numerator** was pinned but the **denominator** could accumulate from trailing *executed* loads, which were lifted under `load_modifier` — so past biometrics depress capacity and inflate today's relative load | **FIXED** — trailing capacity must be computed from as-written prescribed loads only, else M0 capacity restricts to the pre-pilot assessment |
| P1-5 | The ≤10% high-effort gate judged on a 95% CI upper bound was **mathematically unsatisfiable** at the stated denominators: by the rule of three the zero-miss upper bound is 20% at N=15 and exactly 10% at N=30, so no subgroup could ever pass and an arm could pass only with a perfect record | **FIXED** — gate restated at two levels: arm/tier decision gate at a denominator where the bound is attainable (candidate ≥75), subgroups descriptive with point estimate + exact binomial interval + MAE |
| P1-6 | Structural deadlock: ≥15 RPE≥9 sets **per movement-class subgroup** is unreachable at planned Arm I volume (≈40–60 such sets per tier over six classes), and §7 banned pooled-only reporting — so every subgroup would be NOT EVALUABLE and the arm could never decide | **FIXED** — §7 clarified that the ban is on reporting *only* the pooled number, not a per-subgroup acceptance gate; subgroup floors no longer block the arm-level decision |

### P2 dispositions (all fourteen fixed)

Citation and reference integrity: **P2-1** S10 prose relabelled from "Review" to an original validation study with authors and the resolving DOI (the non-resolving `10.12965/jer.2346.068` withdrawn); **P2-6** `05` and `06` given the §0 headings that six and one dangling cross-references respectively already cited; **P2-7** remaining `04 S2` collisions with manifest ID `S02` renoted `04 §3`; **P2-8** manifest option notation `07 A6` / `07 A1-A4` corrected to the O-namespace; **P2-5** the sibling "three rounds" statements B-3 missed, now four.

Architecture and matrix accuracy: **P2-2** Arm I minima in `07` restated as the split ≥6 calibration + ≥4 holdout; **P2-3** the `01` non-conflation matrix cell corrected from "may feed readiness *only*" to include the direct `evaluatePolicy` rule conditions; **P2-4** O4's privacy burden restored from "declaration update" to separate consent moment + purpose-specific copy + declaration, with a footnote; **P2-9** UD-10 widened — deleting the words "resting heart rate" is insufficient, because the same static string renders whenever *any* permission is granted, so an athlete who grants sleep and denies HRV is still told all three feed readiness.

Protocol hardening: **P2-10** mandatory 14–28 day biometric run-in for Arm P holdout athletes, without which every set would be M1-ineligible on a four-week pilot; **P2-11/P2-12/P2-14** an explicit barred-feature deny-list — `session.session_rpe` (the label's own mean), `mean_velocity_ms` (proxy ground truth at r ≈ −0.88), and cumulative set count / relative set position / session duration (survivor bias with a biometric cause via `set_modifier`); **P2-13** hierarchical shrinkage pre-registered for Arm I per-athlete estimation, which is rank-deficient across six movement classes at ≥6 calibration sessions.

**Not an approval.** The panel returned REQUEST CHANGES and has **not** re-reviewed this remediation. Its verdict binds `504d999` only. Three independent reviews now exist — Reviewer A, Reviewer B and this panel — and **none has ever issued an approval of any state of this branch.**
