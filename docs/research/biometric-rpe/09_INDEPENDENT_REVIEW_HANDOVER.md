# 09 — Independent Review Handover

**Audience:** the independent auditor(s) (owner-assigned: Codex/Sol) who review this frozen output.
**Status of independent review: PENDING — OWNER ASSIGNED TO CODEX/SOL.** No reviewer has been commissioned, run, or fabricated by this executor. The two review lenses the work order describes (Reviewer A — evidence; Reviewer B — engineering/privacy) are handed over un-started. This discovery does **not** claim the work order's §10 independent-review criterion is satisfied.

## 0. Freeze record

- **Base commit (verified before any write):** `e15bbe9301fe756ecda9d8296877b19e425ac112` — `git status --short` was empty at W0; `docs/WORKORDER_ADVANCED_BIOMETRIC_RPE_DISCOVERY.md` present at base.
- **Branch / worktree:** `codex/biometric-rpe-discovery` at `C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\codex-biometric-rpe-discovery`. Deviation note: the work order names the path `...\worktrees\biometric-rpe-discovery` (without the `codex-` prefix); the existing worktree at the prefixed path already carried this exact branch at the exact base commit with a clean tree, so it was used rather than duplicated or overwritten, per the work order's own inspect-don't-overwrite rule.
- **DELIVERABLES COMMIT:** the single local commit that adds the ten files under `docs/research/biometric-rpe/`. Its SHA is recorded in the Freeze Log immediately below (added by the freeze-record commit, which edits only this §0). Nothing else about this document changes between the two commits.
- **AUDIT TARGET:** `HEAD` of `codex/biometric-rpe-discovery` when you begin. Valid audit target = DELIVERABLES COMMIT, or its single documented successor (the freeze-record commit that only writes the Freeze Log into this §0). Any other history means this handover is stale — stop and ask the owner.
- **Deliverables tree:** exactly ten files, `docs/research/biometric-rpe/00…09` (§2 lists them). `git show --stat <DELIVERABLES_COMMIT>` must list only these; the freeze-record commit must touch only this file.
- **Freeze Log:** DELIVERABLES COMMIT = `<filled-by-freeze-record-commit>`; DELIVERABLES-COMMIT TREE SHA = `<filled-by-freeze-record-commit>`. The freeze-record commit that fills these values touches only this §0. The final HEAD (its single successor) is the audit target; recompute its SHA and tree with `git rev-parse HEAD` / `git rev-parse HEAD^{tree}` — never trust a SHA written inside a commit's own text.

## 1. What this run was (and was not)

Executor: GLM 5.3 at high effort, per the owner's dispatch (the remediation sequence's "recommended lead" rows name Gemini models; per established practice the owner's model switch is the role assignment). Effort disclosure: high, as instructed. Owner override honored: the two in-run independent reviewers described in WO §9 were NOT commissioned; instead this handover + the pending Codex/Sol audit cover that role. Documentation-only: no TypeScript/JavaScript, SQL/migrations, native code, dependencies, permissions, prescriptions, release configuration, or signing material was touched. No biometric RPE scanner was implemented. No push, merge, tag, release, sign, or build was performed.

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

## 3. Source totals (03_SOURCE_MANIFEST.csv, 35 rows)

- Primary research: 22 (14 `primary_research` + 6 `primary_research_review` + 2 `primary_research_meta`)
- Official platform/policy documentation: 5 (`D01`–`D05`)
- Repository controls (live code/schema/policy inspection): 7 (`R01`, `R01b`, `R02`, `R03`, `R04`, `R05`, `R06`)
- Non-peer-reviewed preprint (context only, supports no claim): 1 (`S23`)
- Verification-status caveats: 6 rows are not fully verified — `S05`, `S21`, `S22` (identity verified, values UNRESOLVED, nothing rests on them), `S06`, `S18`, `S23` (identity verified via PubMed/DOI, remaining fields flagged). All other rows were verified against primary metadata this run.

## 4. Important claims requiring your verification (highest-stakes first)

1. **The decision token** (RESEARCH PILOT ONLY, `00` §1) — check it is the right token given the evidence, and that nothing in the deliverable set quietly promises a feature.
2. **The central negative finding** (`02` §6): no located study demonstrates per-set resistance-training RPE estimation from watch/phone biometrics with athlete-level validity. This is an absence-of-evidence claim; re-run the search independently (suggested queries: "RPE estimation wearable resistance training", "machine learning rating of perceived exertion prediction strength", "biometric effort estimate set"). One near-miss exists: arXiv:2510.03197 (`S23`, inertial sensors, single-joint, non-peer-reviewed) — judge whether its exclusion from claim-bearing use is correct.
3. **Bibliographic identities** — spot-check manifest rows against PubMed/DOI, especially the six caveat rows (`S05`, `S06`, `S18`, `S21`, `S22`, `S23`) and the rows where this executor corrected its own drafts: `S01` (Zourdos volume/pages: 2016 Jan;30(1):267–275), `S10` (Kwon/Kang/Chang, doi 10.12965/jer.2346170.085), `S16` (Ma et al., 19(5):873–882), `S18` (author list deliberately NOT asserted — cite by DOI), `S20` (Charest & Grandner, not the review's earlier guess).
4. **Repository claim table** (`02` §7) — re-verify each `YES` against the cited files (bridge record types, `rpeTouched` null gate, session-close derivation, readiness weights, SpO2 weight 0.00).
5. **The SpO2 ruling** (`00` §3; `05` §8) — arguments: no effort evidence [S13/S18 are non-effort validations]; accuracy limits [S18]; medical semantics [S11 analogy]; Play per-data-type declaration burden [D01/D02/D04]; prior ruling [R02]. Attack this; it is the most consequential collect/do-not-collect call.
6. **The validation protocol's safety properties** (`06` §1 label-anchoring rule, §2 athlete-level split, §8 unratified thresholds, §11 approval matrix) — a reviewer should stress-test whether any step could leak into product behavior without owner gates.
7. **Platform-documentation currency** [D01–D05] — captured 2026-09-02; re-check the cited Android/Apple pages if policy changed.

## 5. SpO2 disposition (as recorded)

**Do not collect — any configuration, any purpose, under this discovery.** Full reasoning: `05` §8 (and `00` §3). The schema's computed-but-excluded `spo2_component` (weight 0.00, Calibration Policy v1 [R01b]) stays untouched; formal deprecation is left open as UD-6.

## 6. Proposed architecture boundaries (for Reviewer B's lens)

- Six value classes stay separate end-to-end (observed biometric / derived feature / readiness / advisory estimate / actual RPE / target RPE): `07` §1.
- No biometric value may write, grade, or appear inside the RPE entry flow; athlete-entered RPE is the only effort authority; unanswered stays NULL (`07` §9; `00` §4; repository law [R03]).
- Readiness remains the ratified HRV+sleep composite [R01b]; any future context display lives on the readiness surface, never beside set entry, and carries provenance + dates (`07` O4; `05` §4).
- No new permission, no new Health Connect record type, no schema change proposed. The collectible universe under this discovery is exactly the current three day-scale types + manual entry (`04` §1, §10).
- O5 (advisory estimate) is hypothetical behind the full `06` chain; its smallest architecture is specified but nothing in it is authorized.
- 4 GB device contract: compaction boundary must not move; research capture stays out of the shipped binary (`04` §9).

## 7. Unresolved decisions (complete list — from `08` §2)

UD-1 ratify/amend/shelve the pilot protocol; UD-2 adopt/reject/move candidate thresholds (MAE ≤ 0.5, high-effort miss ≤ 10%, band superiority, no-harmful-subgroup — unratified by design); UD-3 product ranking among O2/O3/O4; UD-4 session-RPE: direct global rating vs current mean-of-rated-sets derivation; UD-5 iOS HealthKit path; UD-6 `spo2_component` column deprecation vs neutral-excluded; UD-7 pilot data governance (retention, export, ethics text) if UD-1 = execute; UD-8 docket disposition after your audit. Plus the open scientific disagreements recorded in `08` §3 (advisory resolution vs perceptual noise floor; individual HRV reactivity; session-RPE construct framing; HRV vendor heterogeneity).

## 8. Known evidence weaknesses (own them before the auditor does)

- This is a **structured desk review, not a systematic review**: single-screening, search-engine discovery, no dual independent extraction, no pre-registered protocol (`02` disclosure note). Do not cite it as systematic.
- The central finding is an **absence of evidence** in the exact target domain (resistance training, per-set, athlete-level); absence is not proof of impossibility, and the deliverable set is worded accordingly.
- Six manifest rows are partially verified (`S05`, `S06`, `S18`, `S21`, `S22`, `S23` — flagged in-row; nothing numeric rests on them).
- Key populations skew young/healthy/male (Zourdos n=29 squatters; Tibana n=16 men; Rafl n=24 healthy adults; sleep-tracker validation n=75 young healthy adults) — transferability to the app's broader demographic is unknown.
- HRR evidence (`S11`) is clinical-population prognostics; it is used strictly as a boundary argument against medical framing, never as an effort claim.
- Platform documentation (`D01`–`D05`) is a point-in-time capture (2026-09-02) and evolves.
- All evidence is population-level; no individually validated model exists anywhere — which is precisely why the token is RESEARCH PILOT ONLY.

## 9. Exact checks already performed (at freeze)

1. Ten deliverables exist under `docs/research/biometric-rpe/` (count verified by file listing).
2. `03_SOURCE_MANIFEST.csv` parses (Python csv.DictReader): 35 rows × 15 columns, header intact, no ragged rows.
3. Claim→source cross-check: every `[S##]`/`[R##]`/`[D##]` identifier used in the prose exists in the manifest; D01–D05 and R06 are cited in 00/04/05/07 (verification script output: "MISSING FROM MANIFEST: none").
4. Unsupported-certainty sweep: greps for forbidden/unsupported patterns — RPE-conversion verbs ("derive RPE from", "convert … into RPE", "estimate RPE from biometric"), medical-claim language ("diagnosis", "treat", "clinical accuracy"), automatic-fill language ("fill unanswered", "backfill", "impute"), and permission-change language — reviewed against context (protocol/03 discussing the *forbidden* patterns are expected hits; analysis docs state prohibitions, they do not perform actions).
5. `git diff --check` (whitespace/conflict-marker hygiene): clean at freeze.
6. Changed-path scope: `git status --porcelain` shows only `docs/research/biometric-rpe/**` untracked/added; no product path touched.
7. Product-code/permission/dependency/migration/release verification: `git show --stat` at the deliverables commit must confirm §2's file list; `package.json`, `AndroidManifest`, `build.gradle`, and schema files carry no diff.
8. Base-commit lineage: `git log` shows DELIVERABLES COMMIT parent = `e15bbe9301fe756ecda9d8296877b19e425ac112`.

Checks 4–6 were executed before the deliverables commit; their outcomes are asserted in §0's freeze record. Re-run everything yourself — this handover is an input to your audit, not a substitute for it.

## 10. Review lenses (un-started, per WO §9 — owner-assigned)

- **Reviewer A — evidence:** source quality, construct validity, population fit, confounders, whether conclusions exceed evidence (`00`–`03`, `06` §8, `08` §3).
- **Reviewer B — engineering/privacy:** repository fit, permissions, data minimization, failure modes, 4 GB implications, separation from prescription state (`04`, `05`, `07`, `02` §7).
- Neither verdict exists yet. Do not treat any sentence in this document as a reviewer's conclusion. Material disagreements you find belong in the decision docket (`08`), per the work order.

## 11. How to fail this work

For clarity, the findings that would most change the outcome: any verified primary source demonstrating per-set biometric RPE estimation; any repository claim in `02` §7 that does not reproduce; any conflated construct in `01`; any missing manifest row behind a material claim; any place the deliverables promise a feature rather than a decision. If you find one, the token, the docket, or the document set needs revision — say which.
