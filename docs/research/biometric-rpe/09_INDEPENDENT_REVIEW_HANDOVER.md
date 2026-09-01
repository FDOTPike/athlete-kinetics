# 09 — Independent Review Handover

**Audience:** the independent auditor(s) (owner-assigned: Codex/Sol) who review this frozen output.
**Status of independent review: PENDING — OWNER ASSIGNED TO CODEX/SOL.** No reviewer has been commissioned, run, or fabricated by this executor. The two review lenses the work order describes (Reviewer A — evidence; Reviewer B — engineering/privacy) are handed over un-started. This discovery does **not** claim the work order's §10 independent-review criterion is satisfied.

## 0. Freeze record (two rounds)

- **Base commit (verified before any write):** `e15bbe9301fe756ecda9d8296877b19e425ac112` — `git status --short` was empty at W0; `docs/WORKORDER_ADVANCED_BIOMETRIC_RPE_DISCOVERY.md` present at base.
- **Branch / worktree:** `codex/biometric-rpe-discovery` at `C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\codex-biometric-rpe-discovery`. Deviation note: the work order names the path `...\worktrees\biometric-rpe-discovery` (without the `codex-` prefix); the existing worktree at the prefixed path already carried this exact branch at the exact base commit with a clean tree, so it was used rather than duplicated or overwritten, per the work order's own inspect-don't-overwrite rule.
- **Commit chain (all local; no push/merge/tag):**
  1. `9dd3ba9f3a489563bfb1c1340078c14f3d59d63a` — first deliverables commit (ten files; tree `caecdd3e23e2d4e2667734df2c928668ce0f94eb`).
  2. `f9eb6bd56aaf0abd9502348a33b35fd7c28db82a` — first freeze record (Freeze Log fill; touched only `09` §0).
  3. **REMEDIATION COMMIT** = `<filled-by-final-freeze-commit>` — the audit-remediation commit (five P1 findings + additional corrections; touches only the ten files in §2).
  4. **FINAL FREEZE COMMIT (audit target)** = `<filled-by-final-freeze-commit>` — fills the two placeholders above and this §0; touches only this file. HEAD after it is what you audit; recompute with `git rev-parse HEAD` / `git rev-parse HEAD^{tree}` — never trust a SHA written inside a commit's own text.
- **Deliverables tree:** exactly ten files, `docs/research/biometric-rpe/00…09` (§2 lists them). `git show --stat` for commits 1 and 3 must list only these (commit 1: all ten new; commit 3: remediation edits within the same set); commits 2 and 4 must touch only this file.
- **First-freeze audit:** REQUEST CHANGES (five P1 findings + additional required corrections). Remediation record: §11. The audit's provisional acceptance of the decision token and SpO2 ruling is recorded there verbatim in substance.

## 1. What this run was (and was not)

Executor: GLM 5.3 at high effort, per the owner's dispatch (the remediation sequence's "recommended lead" rows name Gemini models; per established practice the owner's model switch is the role assignment). Effort disclosure: high, as instructed — for both the original run and the audit remediation. Owner override honored: the two in-run independent reviewers described in WO §9 were NOT commissioned; instead the owner-assigned Codex/Sol audit reviewed the first freeze (verdict: REQUEST CHANGES) and this remediation responds to it. Documentation-only: no TypeScript/JavaScript, SQL/migrations, native code, dependencies, permissions, prescriptions, release configuration, or signing material was touched. No biometric RPE scanner was implemented. No push, merge, tag, release, sign, or build was performed.

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

## 3. Source totals (03_SOURCE_MANIFEST.csv, 42 rows after remediation)

- Primary research: 25 (17 `primary_research` + 6 `primary_research_review` + 2 `primary_research_meta`)
- Official platform/policy documentation: 7 (6 `official_documentation` + 1 `official_commentary` [S24])
- Repository controls (live code/schema/policy inspection): 9 (`R01`, `R01b`, `R02`–`R05`, `R06`–`R08`)
- Non-peer-reviewed preprint (context only, supports no claim): 1 (`S23`)
- Partially verified rows (identity/DOI confirmed; remaining fields flagged in-row; no numeric claim rests on them): 6 — `S05`, `S06`, `S21`, `S22`, `S23`, `S26`. Plus `S25`/`S27` carry incomplete author lists (rest of the row verified). The first freeze's claim that its partially verified sources carried no numeric dependence was **false as applied to S19/S12/S18/S20/S16** (misreported content, not just missing fields) — corrected in remediation and called out here so the auditor does not trust self-certification twice.

## 4. Important claims requiring your verification (highest-stakes first)

1. **The decision token** (RESEARCH PILOT ONLY, `00` §1) — check it is the right token given the evidence, and that nothing in the deliverable set quietly promises a feature.
2. **The bounded negative conclusion** (`02` §4b/§6, **revised per the first audit**): the direct resistance-training literature ([S25] PERSIST set-level RPE dataset, [S26] camera-based RPE prediction, [S27] load-cell fatigue/RPE estimation on a robotic bench press) shows per-set estimation is a live research area with promising lab results — but none of it validates consumer-watch/phone biometrics, the modality this app could collect. The claim to verify is the *bounded* one: "consumer-modality per-set RPE estimation is unproven, not disproven." Re-run the search independently across both lanes: (a) direct resistance-training estimation — "RPE prediction resistance training sensor", "PERSIST dataset perceived exertion", "fatigue estimation bench press machine learning"; (b) consumer-device estimation — "RPE estimation wearable heart rate", "machine learning rating of perceived exertion prediction smartwatch". If you find a consumer-modality per-set validation this review missed, the token itself needs re-examination.
3. **Bibliographic identities — mandatory re-verification, given the first freeze's record.** The first freeze shipped misreported citations (S12's study design, S18's DOI/issue/article number, S19's population and metrics, S20's author/year, S16's pagination) and a mis-attached commentary (S24 vs S21); all were corrected only after the audit. **Treat every manifest row as unverified until you check it yourself**, with priority on: the six partially verified rows (`S05`, `S06`, `S21`, `S22`, `S23`, `S26` — flagged in-row), the audit-corrected rows (`S12`, `S16`, `S18`, `S19`, `S20`, `S24`), and `S25`/`S27` (author lists not fully extracted). Do not rely on any in-document claim that a citation was "corrected" — verify the correction itself.
4. **Repository claim table** (`02` §7) — re-verify each `YES` against the cited files (bridge record types, `rpeTouched` null gate, session-close derivation, readiness weights, SpO2 weight 0.00).
5. **The SpO2 ruling** (`00` §3; `05` §8) — arguments: no effort evidence [S13/S18 are non-effort validations; S24 is the independent trustworthiness caution]; accuracy limits and device dropout [S18]; medical semantics [S11 analogy]; Play per-data-type declaration burden [D01/D02/D05]. Attack this; it is the most consequential collect/do-not-collect call.
6. **The validation protocol's two-arm design** (`06` §2/§7 — Arm P population athlete-disjoint, Arm I chronological individualisation, contemporaneous-RIR leakage rules) and its safety properties (§1 label-anchoring rule, §8 unratified thresholds, §11 approval matrix) — a reviewer should stress-test whether any step could leak into product behavior without owner gates, and whether Arm I's calibration-window design still leaks anywhere.
7. **The privacy/architecture reconciliation** (`05` §1b/§2; `01` §4; `07` §1) — verify against the live repository that the described flows are now accurate: readiness → prescription modifiers [R07], RHR feeding nothing [UD-9 gap], any-granted bridge status [R08].
8. **Platform-documentation currency** [D01–D05, D08] — captured 2026-09-02 (D05's page footer-dated 2026-03-10); re-check the cited Android/Apple pages if policy changed.

## 5. SpO2 disposition (as recorded — audit-accepted)

**Do not collect — any configuration, any purpose, under this discovery.** The independent audit explicitly accepted this ruling. Full reasoning: `05` §8 (and `00` §3); evidence: no effort relevance [S13/S18 are non-effort validations; S24 is the independent trustworthiness caution], accuracy limits and device dropout [S18], medical semantics [S11 analogy], Play per-data-type declaration burden [D01/D02/D05]. The schema's computed-but-excluded `spo2_component` (weight 0.00, Calibration Policy v1 [R01b]) stays untouched; formal deprecation is left open as UD-6.

## 6. Proposed architecture boundaries (for Reviewer B's lens — corrected per audit)

- Six value classes stay separate end-to-end (observed biometric / derived feature / readiness / advisory estimate / actual RPE / target RPE): `07` §1. **Readiness is a prescription input** — its flow is `biometrics (HRV, sleep) → readiness → planned load/set/rpe_cap modifiers` via `policyReference.ts` [R07] — and the boundary the architecture must hold is planned-side prescription vs athlete-authored actual RPE, which no biometric path may touch.
- No biometric value may write, grade, or appear inside the RPE entry flow; athlete-entered RPE is the only effort authority; unanswered stays NULL (`07` §9; `00` §4; repository law [R03]).
- Readiness composition remains the ratified HRV+sleep formula [R01b]; any future context display lives on the readiness surface, never beside set entry, and carries provenance + dates (`07` O4; `05` §4).
- No new permission, no new Health Connect record type, no schema change proposed. The collectible universe under this discovery is exactly the current three day-scale types + manual entry (`04` §1, §10) — **with the disclosed UD-9 gap**: RHR is requested and stored but feeds nothing, and the bridge's any-granted "ready" status does not model partial grants [R08].
- O5 (advisory estimate) is hypothetical behind the full `06` chain (Arm P + Arm I); its smallest architecture is specified but nothing in it is authorized.
- 4 GB device contract: compaction boundary must not move; streaming costs are bounded-estimate-until-measured (`04` §9); research capture stays out of the shipped binary.

## 7. Unresolved decisions (complete list — from `08` §2)

UD-1 ratify/amend/shelve the pilot protocol; UD-2 adopt/reject/move candidate thresholds (MAE ≤ 0.5 in Arm I, high-effort miss ≤ 10%, band superiority, no-harmful-subgroup — unratified by design); UD-3 product ranking among O2/O3/O4; UD-4 session-RPE: direct global rating vs current mean-of-rated-sets derivation; UD-5 iOS HealthKit path; UD-6 `spo2_component` column deprecation vs neutral-excluded; UD-7 pilot data governance (retention, export, ethics text) if UD-1 = execute; UD-8 docket disposition after the post-remediation audit; **UD-9 (added per audit) the RHR consuming-feature gap — drop the request, give it a consuming feature, or document explicit justification before any Health apps declaration**. Plus the open scientific disagreements recorded in `08` §3 (advisory resolution vs perceptual noise floor; individual HRV reactivity; session-RPE construct framing; HRV vendor heterogeneity).

## 8. Known evidence weaknesses (own them before the auditor does)

- **The first freeze misreported verified sources and missed a literature.** S12's design was misstated (three-band ~71% vs the actual two-class n=10 85.7% KNN result); S18's DOI/issue/article number were wrong; S19's population and metrics were wrong; S20 carried a wrong author/year; S16 carried stale pagination; the Zhang & Khatami commentary was mis-attached; and three direct resistance-training studies ([S25]–[S27]) were missed entirely. All corrected in the remediation record (§11) — but the lesson is recorded here: **this executor's citation verification has a demonstrated failure history; re-verify independently.**
- This is a **structured desk review, not a systematic review**: single-screening, search-engine discovery, no dual independent extraction, no pre-registered protocol (`02` disclosure note). Do not cite it as systematic.
- The core finding is a **bounded** negative: consumer-modality per-set RPE estimation is unproven, not disproven; the direct resistance-training literature is active and lab-instrumented (`02` §4b/§6). Absence of consumer-modality validation is not proof of impossibility.
- Six manifest rows are partially verified (`S05`, `S06`, `S21`, `S22`, `S23`, `S26` — flagged in-row; no numeric claim rests on them); `S25`/`S27` carry incomplete author lists (rest of row verified).
- Key populations skew young/healthy/male (PERSIST: 12 men; Sensors: 32 men; S12: 10 adults cycling; S18: postoperative; S19: Korean adults 19–70) — transferability to the app's broader demographic is unknown.
- HRR evidence (`S11`) is clinical-population prognostics; it is used strictly as a boundary argument against medical framing, never as an effort claim.
- Platform documentation (`D01`–`D05`, `D08`) is a point-in-time capture (2026-09-02; D05 page-dated 2026-03-10) and evolves.
- All evidence is population-level; no individually validated model exists anywhere — which is precisely why the token is RESEARCH PILOT ONLY.

## 9. Exact checks already performed (across both rounds)

1. Ten deliverables exist under `docs/research/biometric-rpe/` (count verified by file listing; re-verified after remediation).
2. `03_SOURCE_MANIFEST.csv` parses (Python csv.DictReader): re-verified after regeneration — row count and 15-column header reported in §3.
3. Claim→source cross-check: every `[S##]`/`[R##]`/`[D##]` identifier used in the prose must exist in the manifest (script output: "MISSING FROM MANIFEST: none" — re-run after remediation edits).
4. Unsupported-certainty sweep: greps for forbidden/unsupported patterns — RPE-conversion verbs, medical-claim language, automatic-fill language, permission-change language — with every hit reviewed against context (prohibitions, negations, and this document's own descriptions of the checks are the expected hits). **Known limitation, stated honestly:** pattern sweeps catch phrasing, not misreported sources — the first freeze passed these greps while carrying citation errors; only the audit caught those. Treat this check as necessary, not sufficient.
5. `git diff --check` (whitespace/conflict-marker hygiene): clean at both freezes.
6. Changed-path scope: only `docs/research/biometric-rpe/**` touched; verified via `git status --porcelain` and `git diff --name-only e15bbe9..HEAD`.
7. Product-code/permission/dependency/migration/release verification: `git show --stat` confirms §2's file list; `package.json`, manifest, gradle, and schema files carry no diff.
8. Base-commit lineage: `git log` shows the commit chain rooted at `e15bbe9301fe756ecda9d8296877b19e425ac112`.

Re-run everything yourself — this handover is an input to your audit, not a substitute for it.

## 10. Review lenses (owner-assigned audit of the POST-REMEDIATION state)

- **Reviewer A — evidence:** source quality, construct validity, population fit, confounders, whether conclusions exceed evidence — now including whether the bounded negative conclusion (`02` §4b/§6) survives the added literature and whether the remediated citations actually reproduce.
- **Reviewer B — engineering/privacy:** repository fit, permissions, data minimization, failure modes, 4 GB implications, separation of planned prescription from athlete-entered actual RPE (`04`, `05` §1b, `07`, `02` §7).
- The first audit (REQUEST CHANGES) was returned against the pre-remediation state; its findings are closed in §11 and must be re-verified, not trusted. No verdict on the post-remediation state exists yet; do not treat any sentence in this document as a reviewer's conclusion. Material disagreements you find belong in the decision docket (`08`), per the work order.

## 11. Remediation record (audit response, this branch)

**Audit verdict on the first freeze:** REQUEST CHANGES. Five P1 findings plus additional required corrections; decision token and SpO2 ruling provisionally accepted; pilot execution NO-GO until the protocol is fixed; merge-as-approved-research NO-GO pending remediation. Disposition of every finding:

| # | Audit finding | Disposition |
|---|---|---|
| P1-1 | S12 materially misreported (three-band ~71% vs actual two-class high/low exertion at RPE 3.5, n=10, 70 records, 20% test split, best 85.7% KNN); invalidated the three-band pilot justification | **FIXED** — S12 rewritten in `02` §4 and the manifest from the primary paper (verified against the audit's attached full text); every "three-band ceiling" claim removed (`06` §1, §8; `09` §4.2); the three-band secondary target now rests only on [S03] + app cue bands [R05] |
| P1-2 | Direct resistance-training research missed (PERSIST; BSPC 105701; Sensors 25(20):6588) | **FIXED** — added as [S25]/[S26]/[S27], each verified against its primary page and explicitly bounded (lab instrumentation, homogeneous cohorts, single exercises); the overbroad negative conclusion withdrawn and replaced with the bounded "unproven, not disproven" statement (`02` §4b/§6); handover reviewer guidance updated to two-lane search |
| P1-3 | Validation split incoherent: athlete-disjoint holdout incompatible with per-athlete models/baselines; contemporaneous-RIR leakage unspecified | **FIXED** — `06` §2/§7 redesigned into Arm P (population generalisation, athlete-disjoint) and Arm I (individualisation, chronological calibration window → future-session holdout); contemporaneous RIR barred as an input absent a pre-registered leakage-free calibration procedure; baselines and metrics re-assigned per arm |
| P1-4 | Privacy/architecture contradicted the repository: claimed all three types feed readiness (RHR does not); called readiness "descriptive" while it drives load/sets/rpe_cap via `policyReference.ts`; permission wording claimed a non-existent consuming feature | **FIXED** — `05` §0/§1b/§2/§3 rewritten to the actual flow `biometrics (HRV, sleep) → readiness → planned prescription modifiers` [R07]; RHR no-consumer gap disclosed as UD-9 with three owner options; consent wording corrected; partial-grant bridge behavior documented [R08]; `01` §4 and `07` §1/§9 reconciled |
| P1-5 | Residual citation errors: S18 wrong DOI/issue/article number; S19 inconsistent population and unreported metrics; S20 wrong author/year; S21 mis-cited for the SpO2 warning (which is S24, previously rowless); S16 stale pagination; handover's self-certification therefore false | **FIXED** — all five rows corrected from primary pages (Helmer et al. iScience 26(11):108155 / PMC10590865; S19 actual κ/F1 results and 19–70-y hospital+clinic population; Charest & Grandner 2020; Ma et al. 19(5):873–882); S24 given its own row; S21 scoped to HR only; handover §3/§8 now discloses the failures instead of certifying past them |
| Additional | "tens of MB" unsupported memory claim | **FIXED** — replaced with a bounded calculation (~5–15 MB working set per active streaming session) and an explicit measurement-gate requirement (`04` §9) |
| Additional | Retention implied trailing-window deletion the code does not implement | **FIXED** — retention stated as-built: indefinite daily rows, bounded read window, deletion only via `resetTrainingData` (`04` §11; `05` §4); bounded pilot retention tied to UD-1 ratification (`05` §1) |
| Additional | Partial Health Connect grants unmodeled | **FIXED** — documented the any-granted "ready" behavior [R08] and specified the required per-type granted/denied model for future consent/status work (`05` §1b; `04` §10) |
| Additional | Chest-strap-vs-ECG attribution overreach; vague D05 row | **FIXED** — `04` §4 scoped to what S09 actually supports; D05 replaced with the page-dated Health Connect publishing row (footer-dated 2026-03-10) and Apple's App Review Guidelines added as D08 |

**Not changed (audit-accepted):** the RESEARCH PILOT ONLY token (now provisional pending re-audit), the SpO2 do-not-collect ruling, the WO boundaries, the documentation-only scope. **Pilot execution remains NO-GO** until UD-1 ratifies the remediated protocol.

## 12. How to fail this work

For clarity, the findings that would most change the outcome: any verified primary source demonstrating per-set biometric RPE estimation; any repository claim in `02` §7 that does not reproduce; any conflated construct in `01`; any missing manifest row behind a material claim; any place the deliverables promise a feature rather than a decision. If you find one, the token, the docket, or the document set needs revision — say which.
