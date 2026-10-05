# Progression measurement evidence baseline

Date: 2026-08-26  
Status: **audit-bounded evidence record — not owner-ratified product policy**  
Code baseline inspected by the audit:
`368e82d508be30956afbd1f6166d68bcf04ae432`

## 1. Purpose and authority

This document is the canonical record of what survived the independent progression-measurement
audit. It supersedes the Antigravity and Hermes reviews as decision input without overwriting
their historical artifacts.

It authorizes no implementation, threshold, display, score, persistence window, or prescription
change. Product choices remain in
[`PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md`](../decisions/PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md).

The binding audit artifacts are archived **in this repository** at
[`docs/research/audits/progression-terra-2026-08-26/`](audits/progression-terra-2026-08-26/), by
owner decision 6 ratified 2026-08-26. The archived copy is byte-identical to the audit's output and
the hashes below verify against it directly; run
`sha256sum -c docs/research/audits/progression-terra-2026-08-26.sha256` to check the complete
25-file run. Retention is indefinite and immutable — see
[`audits/README.md`](audits/README.md).

The originating copy remains at
`C:\Users\fpike\Documents\pikeMethods\audits\progression-terra-2026-08-26-full-audit`, which is now
a secondary location and no longer the record of reference.

| Artifact | SHA-256 |
|---|---|
| `AUDIT_REPORT.md` | `E473AB3AFA6620796F7A840929129F2F3276F7FBA2B52BBECF39D9D1C790F897` |
| `OPUS_RECONCILIATION.md` | `DF2685BFE3B13B6C21536068F9EBE0968B12C9418841ED8BF1508BB985CFF9EC` |
| `CLAIM_LEDGER.csv` | `1CCD4D4DD6E620FE140076FA00FBABDA264D16277FA5FBC5DBBF8089817800C3` |
| `SOURCE_LOG.csv` | `8152522B78C5C75F9FFD00B20BC6D3725F65AF20D3690D0FCC1063C1AA89314A` |
| `RUN_MANIFEST.json` | `D864E590A7478AC3DAA3C904B2CF0567CE758004F2CC79BF4EA92AE3FC57EE85` |
| `PROCESS_ASSURANCE_APPENDIX.md` | `27C39B7292B0FF2E4C489CCDEA38518739D5B46F44B796A3137402E7F3B2416F` |

The audit retrieved 30 PubMed abstracts and 10 Crossref metadata records for its high-risk
queue. It did not inspect paywalled tables or supplements. An exact result that depends on those
materials remains `FULL TEXT REQUIRED`; identifier resolution alone is not evidence that a
paper contains the attributed claim.

## 2. Findings retained from accessible abstracts

### 2.1 RIR/RTF prediction error

Halperin's meta-analysis reports mean underprediction of remaining repetitions of `0.95`
(`95% CI 0.17–1.73`), between-participant SD `1.45`, and heterogeneity `I²=97.9%`. Training
status was not a clear moderator (`beta=-0.006`, `95% CI -0.02–0.007`) [H-Q2-04; PMID 34542869;
abstract; Tier A].

This supports measurement uncertainty in observed study conditions. It does not validate the
app's e1RM calculation, an `RPE >= 8` threshold, or an unsupervised calibration rule.

Hackett reports approximately one repetition of error when actual repetitions to failure were
`0–5`, greater than two at `7–10`, better accuracy for chest press than leg press, and no
association with experience [H-Q2-05; PMID 27787474; abstract; Tier C]. The study involved 81
adults in observed chest- and leg-press protocols.

### 2.2 Direct 1RM reliability

Grgic reports median ICC `0.97` and median CV `4.2%` (range `0.5–12.1%`) across 32 studies and
1,595 participants [H-Q5-01; PMID 32681399; abstract; Tier A]. These are supervised direct-1RM
results. They do not establish reliability, SEM, MDC, or a persistence window for the app's
RPE-adjusted e1RM series.

## 3. Bounded qualitative findings

- Training outcomes can dissociate by outcome and training condition. Retain outcome specificity;
  do not assert a universal final dimension count or a scalar-impossibility theorem [H-Q1-01;
  A-Q1-01].
- Load, outcome, and effort conditions matter. The audit supports a bounded heavy-versus-light
  outcome distinction, not an exact load floor or a universal equivalence rule [H-Q3-01;
  A-Q3-02].
- Robinson's exploratory meta-regression found the best-fit RIR slope confidence intervals
  contained the null for strength but not hypertrophy; the authors cautioned that intervention
  RIR was estimated and the exact relationship remained unclear [PMID 38970765; abstract;
  Tier A]. This does not validate `RPE >= 8` or prove hard-set superiority over tonnage.
- Retrieved push-up abstracts support that force differs by variation/condition [A-Q4-01;
  PMIDs 21873902 and 20179649; abstracts; Tier B]. They do not verify the claimed exact
  percentages, an app coefficient, continuous interpolation, or a common scale with barbell work.
- Autoregulation reviews describe strength increases in reviewed protocols and inconsistent
  terminology [H-Q8-01; PMIDs 33520457 and 32813181; abstracts]. The reviewed settings are
  supervised and heterogeneous; they do not establish this app's descriptive-versus-prescriptive
  policy.
- Behavioural evidence discussed by the source reviews is indirect. It does not directly
  demonstrate gaming, adherence, or retention effects from displaying a strength metric in this
  unsupervised application [H-Q6-02; A-Q6-02; A-Q6-03].
- Hardware availability and current data capture are system facts. They do not validate a
  candidate progression metric [H-Q7-01].

## 4. Quarantined or contradicted claims

The following may be retained only as rejected historical claims:

- e1RM MDC values `11.1–33%+`, `12–15%` action/display thresholds, and all derived noise bands;
- persistence windows of `3–5`, `6–9`, or `15–30` sessions, EWMA half-lives, and assumed weekly
  adaptation rates;
- hard-set versus tonnage `R²=.68/.09`;
- hard sets as a fundamental hypertrophy unit or `RPE >= 8` as a validated superior app proxy;
- Antigravity's Halperin MAE table, Hackett `3.5 ± 1.2`, and Armes instructed-2-RIR account;
- Mansfield as evidence of anchoring bias;
- Pareja-Blanco `+9.5% versus -1.2%`; the retrieved abstract reports CMJ `9.5% versus 3.5%`;
- Calatayud “equivalence confirmed” based on a nonsignificant difference;
- exact push-up `41/49/64/74%` figures without a full-text table locator;
- planche torque coefficients, continuous leverage conversion, and cross-movement equivalence;
- exact acute-noise, Silva MDC, VBT-error, behavioural-gaming, and retention claims that the
  audit could not source-locate;
- numerical thresholds, UI constructs, or prescription restrictions presented as research
  findings;
- claims of “100% citation coverage” or “zero unsupported claims” based on identifier counts.

## 5. Auditor-derived calculations

The audit reproduced portions of the Antigravity calculations but found that they substitute
direct-1RM CV for app-e1RM SEM, assume independent errors, and assume adaptation rates not
validated for this signal. They remain `AUDITOR-DERIVED — NOT PUBLISHED` [A-Q2-04; A-Q5-04].

They must not be used as candidate constants, illustrative defaults, owner options, test fixtures,
or acceptance thresholds.

## 6. Full-text follow-up queue

These claims remain quarantined unless a later investigation records the exact page, table,
figure, or supplement; population; effect uncertainty; and independent tier:

| Claim ID | Unresolved subject |
|---|---|
| H-Q1-02 | Exact load-by-outcome dose optima |
| H-Q2-02 | Exact between-person repetition spread and exercise-specific values |
| H-Q4-02 | Isometric variables as an app progression measurement |
| H-Q5-02 | Exact repetition-maximum ICC/SEM values |
| H-Q6-01 | Tracker/app effect size and step-count translation |
| A-Q1-02 | Exact Schoenfeld effect sizes |
| A-Q1-04 | Exact exercise-specific repetition table |
| A-Q2-01 | Exact Epley, LeSuer, and Reynolds error values |
| A-Q3-03 | Claimed hard-set-versus-tonnage R² pair |
| A-Q4-01 | Exact push-up force percentages and effect size |
| A-Q5-01 | Acute-noise magnitudes |
| A-Q5-02 | Silva per-exercise MDC values and transfer limits |
| A-Q6-01 | Etkin effect sizes and persistence result |
| A-Q8-03 | VBT error/CV and daily-capacity magnitudes |

This queue records possible document verification, not authorization to perform new research.
If no full text is supplied or accessible, omit the exact claim.

## 7. Search-bounded unanswered questions

The independent audit did not establish universal absences. Its documented searches did not
locate qualifying direct validation for:

- adding RIR to performed repetitions as the app's e1RM equation does [H-Q2-03];
- an app-specific e1RM MDC [H-Q2-07];
- a direct hard-set-versus-tonnage proxy comparison validating `RPE >= 8` [H-Q3-02];
- a transferable stagnation persistence window [H-Q5-03].

These are search-bounded outcomes, not claims that evidence cannot exist or that a feature can
never be built. Any stronger conclusion requires a separately approved systematic search or an
app-specific measurement protocol.

## 8. Material-claim disposition

`FULL TEXT REQUIRED` means the original claim remains quarantined pending a source locator.

| Claim ID | Disposition | Bounded result |
|---|---|---|
| H-Q1-01 | rewrite | Retain outcome dissociation; remove fixed dimension count. |
| H-Q1-02 | full text required | Quarantine exact dose optima. |
| H-Q2-01 | rewrite | One bench-press result is not universal Epley validation. |
| H-Q2-02 | full text required | Exact spread/exercise figures need a locator. |
| H-Q2-03 | rewrite | Use documented-search wording. |
| H-Q2-04 | retain | Retain the abstract values and conditions. |
| H-Q2-05 | retain | Retain the abstract values and conditions. |
| H-Q2-06 | rewrite | Label the unsupervised-error claim as inference. |
| H-Q2-07 | rewrite | Use documented-search wording; no MDC theorem. |
| H-Q3-01 | rewrite | Retain outcome distinction; remove exact floor. |
| H-Q3-02 | rewrite | No qualifying direct comparison was located. |
| H-Q4-01 | rewrite | A programme result does not create a common scale. |
| H-Q4-02 | full text required | Health/isometric evidence does not yet validate the app metric. |
| H-Q5-01 | retain | Direct supervised 1RM only. |
| H-Q5-02 | full text required | Exact reliability values need a locator. |
| H-Q5-03 | rewrite | No qualifying window was located; avoid permanent non-buildability. |
| H-Q6-01 | full text required | Exact effect/step values and transfer remain unresolved. |
| H-Q6-02 | rewrite | Behavioural gaming is an indirect risk hypothesis. |
| H-Q7-01 | rewrite | Separate system capturability from evidence validity. |
| H-Q8-01 | rewrite | Reviews do not determine app prescription policy. |
| A-Q1-01 | rewrite | Retain outcome dissociation only. |
| A-Q1-02 | full text required | Exact effect sizes need a locator. |
| A-Q1-03 | quarantine | Correct CMJ comparison; original value is contradicted. |
| A-Q1-04 | full text required | Exact table needs a locator. |
| A-Q2-01 | full text required | Exact error values need a locator. |
| A-Q2-02 | quarantine | Claimed Halperin MAE table conflicts with the abstract. |
| A-Q2-03 | quarantine | Hackett/Armes claims are contradicted or unsourced. |
| A-Q2-04 | quarantine | Derived MDC is not published or validated. |
| A-Q2-05 | quarantine | Threshold/restriction proposal is unsupported. |
| A-Q3-01 | quarantine | Fundamental-unit claim is overstated. |
| A-Q3-02 | rewrite | Preserve load/outcome conditions only. |
| A-Q3-03 | full text required | R² pair has no accessible locator. |
| A-Q3-04 | quarantine | Exclusive hard-set policy is unsupported. |
| A-Q4-01 | full text required | Exact force percentages need a locator. |
| A-Q4-02 | quarantine | Nonsignificance is not equivalence. |
| A-Q4-03 | quarantine | No verifiable primary source was supplied. |
| A-Q5-01 | full text required | Exact acute-noise figures remain a lead list. |
| A-Q5-02 | full text required | Exact Silva MDC values need tables. |
| A-Q5-03 | quarantine | Adaptation-rate assumption is unsupported. |
| A-Q5-04 | quarantine | Persistence/EWMA outputs are derived and unvalidated. |
| A-Q6-01 | full text required | Exact Etkin values and transfer need a locator. |
| A-Q6-02 | quarantine | Gaming claim is unsupported as empirical evidence. |
| A-Q6-03 | rewrite | Identify the mental-health-app domain and indirect transfer. |
| A-Q7-01 | rewrite | Do not convert the evidence table into app verdicts. |
| A-Q7-02 | quarantine | Binary threshold and R² claims are unsupported. |
| A-Q8-01 | quarantine | No evidence mandates a no-prescription rule or `+12%` loop. |
| A-Q8-02 | quarantine | Mansfield/Armes characterizations are contradicted. |
| A-Q8-03 | full text required | Exact VBT/capacity values need locators and transfer review. |
| A-META-01 | quarantine | Design rules breached the source brief. |
| A-META-02 | quarantine | Coverage/zero-unsupported assertion is contradicted. |
| A-META-03 | rewrite | Retain publication identity only, not outcome endorsement. |

Disposition totals: **3 retain, 17 rewrite, 17 quarantine, 14 full text required — 51 total.**

## 9. Current product boundary

At the pinned baseline, `packages/inference/src/e1rm.ts` exposes pure derivation functions but
there is no store getter, persistence, display, MDC, threshold, or detector. `hard_sets` is a
trigger-maintained code fact at `RPE >= 8` and is excluded from prospective planning by policy
tests. Neither code fact is scientific validation or permission to surface the metric.

