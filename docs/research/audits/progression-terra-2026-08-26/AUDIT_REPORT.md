# Progression measurement research — independent full audit

## Executive verdict
**Antigravity is not safe as an evidence basis or decision input.** Its bibliography is largely real, but material claims include wrong source characterisations, exact statistics without a source locator, tier inflation, and auditor-derived e1RM MDC/persistence values presented as recommendations. **Hermes is not adoption-ready either, but is materially more disciplined.** Its core error/noise blank is plausible and its Halperin, Hackett and Grgic uses survive abstract-level checking; its universal equation assertions and several negative claims require narrower wording and documented search boundaries.

This is an audit only. Nothing here ratifies a value, policy, implementation, or work order.

## Method and boundaries
The four required inputs were copied byte-for-byte before analysis; hashes are in `RUN_MANIFEST.json`. The reports were adjudicated separately before the Hermes audit, Opus texts, prior-agent records, or pinned code baseline were read. `source_metadata.json` contains this auditor's PubMed/Crossref retrievals. `CLAIM_LEDGER.csv` is the terminal adjudication register: it contains 51 manually source-adjudicated high-risk atoms plus 684 conservatively over-inclusive line-clause atoms, so every non-bibliography claim-bearing report line has a terminal status rather than being silently sampled. “Supported” means the retrieved abstract itself bears the stated bounded claim. Where the source needs a table/full text, the verdict is `UNVERIFIED—FULL TEXT REQUIRED`, not inference.

## Verified conclusions worth retaining, with limits
1. **RIR/RTF prediction is imperfect and tends to underpredict remaining repetitions**: Halperin’s meta-analysis reports 0.95 underprediction (95% CI 0.17–1.73), I²=97.9%, and no clear training-status moderation (β −0.006, 95% CI −0.02 to 0.007) [PMID 34542869, abstract; Tier A]. It does not validate app e1RM, an RPE threshold, or an unsupervised calibration policy.
2. **Prediction error is closer to failure and shorter sets**: Hackett reports about one repetition error at actual RTF 0–5 and >2 at 7–10; chest press was more accurate than leg press; experience was not associated with accuracy [PMID 27787474, abstract; Tier C]. Conditions were 81 adults under observed chest/leg-press protocols.
3. **Direct supervised 1RM reliability is not e1RM reliability**: Grgic reports ICC median 0.97 and CV median 4.2% (range 0.5–12.1%) from 32 studies/n=1,595 [PMID 32681399, abstract; Tier A]. It supplies no e1RM MDC or persistence window.
4. **RIR-to-failure and hypertrophy/strength evidence is outcome-conditional**: Robinson’s exploratory meta-regression found the best-fit RIR slope confidence intervals contained null for strength but not hypertrophy; the authors caution exact relation remains unclear because intervention RIR was estimated [PMID 38970765, abstract; Tier A]. This cannot validate `RPE >= 8` as a better app proxy than tonnage.
5. **The cited force-platform papers establish push-up variants differ in force condition**, but exact 41/49/64/74% values were not verified from an accessible table in this audit [PMID 21873902; PMID 20179649, abstracts; Tier B]. They do not establish an app coefficient or common scale.

## Material defects and quarantine
### e1RM MDC and persistence windows — quarantine
Antigravity’s 11.1–33%+ e1RM MDC table and its 3–5/6–9/15–30-session windows are calculations, not results reported in their cited sources. CAL-01 to CAL-04 reproduce the arithmetic and identify the unvalidated substitutions: median direct-1RM CV treated as e1RM SEM; independently distributed errors; and assumed weekly adaptation. Keep them labelled `AUDITOR-DERIVED` only; do not describe them as published evidence or use them as a threshold.

### Hard-set versus tonnage R² — quarantine
Baz-Valle’s abstract concludes that total sets to/near failure *seems* adequate under specified conditions [PMID 30063555, abstract; Tier A]. It does not show the claimed `R²=.68` or `R²=.09`; nor does it compare the app’s `RPE >= 8` trigger against tonnage. The precise pair remains `UNVERIFIED—FULL TEXT REQUIRED` and cannot be called confirmed.

### Source-content corrections
* **Halperin**: Antigravity’s MAE table conflicts with the retrieved abstract’s 0.95-underprediction estimate; use the actual abstract statistic only.
* **Armes**: the study compared self-determined RM with task failure, not an instructed 2-RIR condition; its pooled difference was 2.0 (95% CI 0.0–4.0) [PMID 33424678, abstract; Tier B].
* **Mansfield**: it found no blinded/non-blinded accuracy difference, contradicting an anchoring-bias assertion [PMID 32881842, abstract; Tier B].
* **Pareja-Blanco 2017**: the abstract reports CMJ 9.5% vs 3.5%, not −1.2% [PMID 27038416, abstract; Tier B].
* **Preprint tiering**: Crossref identifies `10.1101/2025.09.22.25336351` as `posted-content`, not a peer-reviewed Tier-A systematic review.
* **Recent 2026 papers**: the five named PubMed records resolve. Resolution proves identity only; their claimed effects, supervision context and applicability remain separately limited by abstract/full-text access.

## Report-by-question reconciliation
### Q1
Both reports support a limited outcome-dissociation conclusion; neither supports a universal final dimension count or scalar impossibility theorem. Retain outcome specificity, rewrite absolutist psychometric rhetoric.
### Q2
This is the strongest section after correction. Retain Halperin/Hackett/Grgic at their actual abstract-level values. Quarantine Antigravity’s equation-error ranges/MDC table. Hermes must rewrite its universal “near-failure accurate” wording and its categorical no-validation claim as a documented-search outcome.
### Q3
Retain load/outcome distinction from low-vs-high load and Robinson’s conditional RIR finding. Quarantine “hard set is the fundamental quantum,” R² values, and any `RPE >= 8` superiority claim.
### Q4
Retain that bodyweight variation force changes are plausible and source-backed at condition level. Do not retain exact percentages, lever-torque models, coefficients, or a common-scale conclusion without source locator.
### Q5
Retain direct-1RM supervised reliability separately from app e1RM. Quarantine every e1RM MDC, smoothing, window and training-age-specific threshold.
### Q6
Retain only indirect behavioural evidence with domain labels. No retrieved evidence directly demonstrates gaming/retention effects of a strength score in an unsupervised app.
### Q7
Retain hardware unavailability as a system fact. Do not elevate any candidate axis to a validated app metric; several report tables cross into design judgment.
### Q8
Retain that reviewed autoregulation studies are supervised/heterogeneous and terminology is inconsistent [PMID 33520457; PMID 32813181, abstracts]. No paper in this audit establishes a no-prescription rule; that remains an owner decision.

## Brief-versus-pinned-code baseline discrepancies
The brief says the e1RM function is “consumed by nothing,” not stored/displayed. Pinned `368e82d...` supports that: `packages/inference/src/e1rm.ts` exports pure functions, and tests explicitly assert no store getter/UI and no threshold/detector. However, `docs/decisions/TRAINING_PROGRESSION_LAYERS.md` still names a nonexistent `getMovementE1rmSeries` and calls stagnation “not buildable yet.” That document is stale relative to baseline code. Hard sets are trigger-maintained at RPE >=8 in `packages/core-db/src/schema/001_mechanical_input.sql`; policy tests show they are absent from prospective planning. These are code facts only, not evidence or recommendations.

## Limitations
This audit accessed abstracts and metadata for the high-risk queue, not paywalled full tables/supplements. Exact figures marked `UNVERIFIED—FULL TEXT REQUIRED` may be recoverable, but are not accepted here. Negative claims are limited to the documented search/retrieval in the manifest; none says evidence does not exist.
