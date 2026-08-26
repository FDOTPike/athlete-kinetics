"""Generate audit deliverables from the locked audit record; no product artifacts are touched."""
from __future__ import annotations
import csv, json, math
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
# Each row is a separately adjudicated factual atom or a distinct claim-class atom.
H='Hermes review'; A='Antigravity review'
rows=[
('H-Q1-01',H,'Q1 L32-50','published finding','three/four dissociable outcome dimensions; scalar inadequacy','10.1519/JSC.0000000000002200; 10.1249/MSS.0000000000001764','abstract','A/B','SUPPORTED—LIMITED','moderate','supervised, mostly men','Retain only as outcome dissociation; do not claim a fixed dimension count.'),
('H-Q1-02',H,'Q1 L44','published finding','load-by-outcome dose profiles','10.1007/s40279-024-02006-3','abstract/conclusion','A','UNVERIFIED—FULL TEXT REQUIRED','moderate','unknown full extraction','Quarantine exact optima; retain only source identity.'),
('H-Q2-01',H,'Q2 L78-92','published finding','Epley-family accuracy degrades beyond about 10 repetitions','18714230; 10.1007/s40279-023-01937-7','PubMed abstract/full-text claim not independently reread','B/A','PARTIALLY SUPPORTED','high','women bench press / heterogeneous review','Rewrite: one cited bench-press study says fewer-than-10 RTF improved prediction; it is not universal Epley validation.'),
('H-Q2-02',H,'Q2 L89-92','published finding','2.51 reps SD at 80%, 4.36 at 60%; leg press 13.1 vs bench 8.8','10.1007/s40279-023-01937-7','metadata only in this audit','A','UNVERIFIED—FULL TEXT REQUIRED','high','meta-regression','Exact numbers require accessible locator/table.'),
('H-Q2-03',H,'Q2 L98-100','research-gap statement','no direct validation of additive RIR substitution','none','documented but non-systematic targeted search','—','GAP-NOT-ESTABLISHED','high','not applicable','Rewrite: no qualifying direct validation located in this audit’s documented search.'),
('H-Q2-04',H,'Q2 L104','published finding','mean RIR underprediction 0.95 [0.17,1.73], SD 1.45, heterogeneity 97.9%, status beta -0.006','PMID 34542869','PubMed abstract','A','SUPPORTED','high','414 participants; sets to task failure','Retain exact values and qualification.'),
('H-Q2-05',H,'Q2 L105','published finding','error about one rep ARF 0–5 and >2 ARF 7–10; experience no effect','PMID 27787474','PubMed abstract','C','SUPPORTED','high','81 adults; chest press/leg press','Retain conditions and exercise difference.'),
('H-Q2-06',H,'Q2 L111','inference','supervision-free error is a floor, not a ceiling','34542869;27787474','abstracts','inference','INFERENCE—REWRITE','high','unobserved population absent','Plausible but not measured; not a finding.'),
('H-Q2-07',H,'Q2 L115','research-gap statement','no propagated e1RM MDC','none','targeted search logged only at report level','—','GAP-NOT-ESTABLISHED','critical','not applicable','Use bounded documented-search wording; do not say none exists.'),
('H-Q3-01',H,'Q3 L135-143','published finding','heavy loads favor 1RM; hypertrophy relation conditional on effort','28834797;38970765','PubMed abstract','A','SUPPORTED—LIMITED','high','trials/meta-regression, supervised','Retain distinction; exact ~30% floor needs source locator.'),
('H-Q3-02',H,'Q3 L141','research-gap statement','no head-to-head hard-set vs tonnage proxy trial','none','non-exhaustive search','—','GAP-NOT-ESTABLISHED','critical','not applicable','No qualifying direct comparison located; RPE>=8 is not validated proxy.'),
('H-Q4-01',H,'Q4 L165','published finding','calisthenic push-up programme improved outcomes','29466268','PubMed abstract','B','SUPPORTED—LIMITED','moderate','23 men, 4 weeks','No common scale claim is a gap, not an empirical outcome.'),
('H-Q4-02',H,'Q4 L166','inference','isometric time/position/intensity map to app seconds and ordinal band','10.1186/s40885-022-00232-3','source not independently read','inference','UNVERIFIED—FULL TEXT REQUIRED','moderate','hypertension protocols','Health outcome does not validate strength progression metric.'),
('H-Q5-01',H,'Q5 L191','published finding','direct 1RM ICC median .97, CV median 4.2%','32681399','PubMed abstract','A','SUPPORTED','high','32 studies, n=1595','Supervised direct 1RM only.'),
('H-Q5-02',H,'Q5 L192','published finding','rep-max ICC/SEM values','10.1371/journal.pone.0268074','not retrieved in this audit','C','UNVERIFIED—FULL TEXT REQUIRED','high','24 trained adults claimed','Exact figures require article locator.'),
('H-Q5-03',H,'Q5 L196','research-gap statement','no persistence window','none','non-exhaustive targeted search','—','GAP-NOT-ESTABLISHED','critical','not applicable','Do not convert absence into non-buildability theorem.'),
('H-Q6-01',H,'Q6 L219','published finding','trackers/apps SDM .350 and ~1850 steps/day','33355160','not independently retrieved','A','UNVERIFIED—FULL TEXT REQUIRED','moderate','general activity adults','Not strength-metric display evidence.'),
('H-Q6-02',H,'Q6 L220-222','published finding/inference','quantification may reduce enjoyment; score gaming prediction','10.1093/jcr/ucv095','metadata only','B/inference','PARTIALLY SUPPORTED','moderate','consumer experiments','Do not represent as fitness-app gaming evidence.'),
('H-Q7-01',H,'Q7 L241-250','published finding','candidate-axis table','multiple','mixed access','mixed','PARTIALLY SUPPORTED','moderate','heterogeneous','Hardware/capturability are system facts, not research findings.'),
('H-Q8-01',H,'Q8 L271-275','published finding','autoregulation review and terminology inconsistency','33520457;32813181','PubMed abstracts','C/B-','SUPPORTED—LIMITED','moderate','supervised interventions','No evidence establishes unsupervised descriptive-only policy.'),
('A-Q1-01',A,'Q1 L55-89','published finding','four independent dimensions and mechanisms','multiple','mostly metadata only','mixed','PARTIALLY SUPPORTED','high','heterogeneous','Retain outcome dissociation only; mechanisms/independence overstate.'),
('A-Q1-02',A,'Q1 L59-61','published finding','Schoenfeld g=.58 vs .35 values','28834797','PubMed abstract','A','UNVERIFIED—FULL TEXT REQUIRED','high','21 RCTs','Abstract supports direction, not these exact values.'),
('A-Q1-03',A,'Q1 L67-70','published finding','Pareja-Blanco +9.5% vs -1.2%','27038416','PubMed abstract','B','CONTRADICTED','high','22 young men, squat','Abstract reports CMJ 9.5% vs 3.5%, not -1.2%.'),
('A-Q1-04',A,'Q1 L75-82','published finding','Shimano exercise-specific repetitions','17194239','not retrieved','C','UNVERIFIED—FULL TEXT REQUIRED','moderate','30 men claimed','Exact table requires source locator.'),
('A-Q2-01',A,'Q2 L151-175','published finding','Epley error ranges and LeSuer/Reynolds exact SEE','16937972;10.1519/00124278-199711000-00001','metadata/abstract insufficient','B-','UNVERIFIED—FULL TEXT REQUIRED','critical','varied exercises','Exact table has no furnished primary locator.'),
('A-Q2-02',A,'Q2 L195-200','published finding','Halperin MAE 1.15±.40 and stratified MAEs','34542869','PubMed abstract','A','CONTRADICTED','critical','414 participants','Abstract reports underprediction .95 [0.17,1.73], not claimed MAE table.'),
('A-Q2-03',A,'Q2 L204-209','published finding','Hackett 3.5±1.2; Armes instructed 2-RIR 4–7','27787474;33424678','PubMed abstracts','C/B','CONTRADICTED','critical','81 adults; trained persons','Hackett abstract lacks statistic; Armes has no instructed-2-RIR condition and pooled 2.0 [0,4].'),
('A-Q2-04',A,'Q2 L215-250','derived calculation','direct-1RM MDC and e1RM MDC table','32681399','PubMed abstract + calculations register','derived','AUDITOR-DERIVED—NOT PUBLISHED','critical','direct supervised 1RM basis','Math partly reproducible; no validated propagation or transfer.'),
('A-Q2-05',A,'Q2 L267-274','design proposal','restrict e1RM inputs and >=12–15% sustained changes','none','not source-supported','proposal','UNSUPPORTED','critical','not applicable','Quarantine; prohibited recommendation.'),
('A-Q3-01',A,'Q3 L282-284','published finding','hard set is fundamental hypertrophy quantum','30063555;38970765','PubMed abstracts','A','OVERSTATED','critical','review/meta-regression','Sources support conditional/estimated RIR relation, not universal fundamental unit.'),
('A-Q3-02',A,'Q3 L309-317','published finding','failure-matched hypertrophy and load effects','28834797;27174923;38970765','PubMed abstracts','A/B','SUPPORTED—LIMITED','high','supervised','Retain conditions; do not equate volume load.'),
('A-Q3-03',A,'Q3 L327','published finding','hard sets R²=.68 vs tonnage R²=.09','30063555','PubMed abstract','A','UNVERIFIED—FULL TEXT REQUIRED','critical','14-study review','No R² in record; cannot retain until full-text locator.'),
('A-Q3-04',A,'Q3 L335-345','design proposal','exclusive hard-set tracking/thresholds','none','not evidence','proposal','UNSUPPORTED','critical','not applicable','Quarantine.'),
('A-Q4-01',A,'Q4 L382-390','published finding','push-up 41/49/64/74% BW, eta²','21873902;20179649','PubMed abstracts','B','UNVERIFIED—FULL TEXT REQUIRED','high','23 recreationally fit / 28 trained men','Abstract supports condition ordering, not supplied exact force values.'),
('A-Q4-02',A,'Q4 L393-396','published finding','Calatayud/Kotarsky equivalence confirmed','24983847;29466268','metadata/abstract','B','OVERSTATED','high','small trials','p=.79 is not equivalence; Kotarsky is B not A.'),
('A-Q4-03',A,'Q4 L399-404','published finding','planche torque 1.5–2.8x and exact Nm','none','no DOI/PMID','D','UNSUPPORTED','high','unspecified','No verifiable primary source supplied.'),
('A-Q5-01',A,'Q5 L515-518','published findings','acute noise taxonomy and exact percentages','multiple','not independently retrieved','mixed','UNVERIFIED—FULL TEXT REQUIRED','high','varied tasks','Plausible lead list only.'),
('A-Q5-02',A,'Q5 L539-546','published finding','Silva per-exercise MDC 15–51%','38086002','PubMed abstract','B-','UNVERIFIED—FULL TEXT REQUIRED','high','113 women >40','Abstract confirms study/population, exact values need tables.'),
('A-Q5-03',A,'Q5 L550-555','published finding','advanced gains .25-.75% weekly and 8–20× noise','27102172;29372481','not retrieved','A/D','UNSUPPORTED','critical','not specified','Unsourced adaptation-rate assumption drives derived conclusion.'),
('A-Q5-04',A,'Q5 L566-595','derived calculation','persistence windows, EWMA, e1RM SEM/MDC','multiple','calculation register','derived','AUDITOR-DERIVED—NOT PUBLISHED','critical','assumed IID/SEM/effect','Quarantine all operational windows.'),
('A-Q6-01',A,'Q6 L619-620','published finding','Etkin d=.45-.62 and persistence effect','10.1093/jcr/ucv095','metadata only','B','UNVERIFIED—FULL TEXT REQUIRED','moderate','consumer experiments','No fitness setting transfer.'),
('A-Q6-02',A,'Q6 L638-641','inference','observed resistance-training metric gaming','none','no direct study cited','inference','UNSUPPORTED AS EMPIRICAL','high','not applicable','May be a risk hypothesis only.'),
('A-Q6-03',A,'Q6 L655-657','published finding','Baumel fitness app retention','31573916','metadata only','B-','MISCHARACTERISED','moderate','mental-health apps','Correct domain; do not call fitness-app data.'),
('A-Q7-01',A,'Q7 L703-725','published finding/proposal','rest, ROM, tempo, hard-set validity table','multiple','mixed','mixed','PARTIALLY SUPPORTED','high','heterogeneous','Tables improperly convert evidence into app verdicts.'),
('A-Q7-02',A,'Q7 L723-725','published finding','binary RPE>=8 robust and R²=.68','34542869;30063555','PubMed abstracts','A','OVERSTATED','critical','task-failure studies/review','No binary-threshold validation or R² in records.'),
('A-Q8-01',A,'Q8 L765-772','design proposal','metrics must never prescribe; +12% loop','none','calculation/inference','proposal','UNSUPPORTED','critical','not applicable','No observed loop evidence; no policy decision authorised.'),
('A-Q8-02',A,'Q8 L795-799','published finding','Mansfield anchoring, Armes 3–6, Refalo/Hughes error','32881842;33424678','PubMed abstracts','B','CONTRADICTED/PARTIAL','critical','trained men/participants','Mansfield found no blind/nonblind difference; Armes claim false.'),
('A-Q8-03',A,'Q8 L802-808','published finding','sensorless VBT error/CV and daily capacity ±5–10','multiple','abstracts not read','B-','UNVERIFIED—FULL TEXT REQUIRED','high','hardware studies','No transfer to this sensorless app without exact locators.'),
('A-META-01',A,'Q1-Q8 authorise blocks','design proposal','numerical thresholds/UI/algorithm restrictions','none','document text','proposal','UNSUPPORTED','critical','not applicable','Separate from evidence; directly breaches original brief.'),
('A-META-02',A,'L829-832','system/process claim','99 claims/100% coverage/zero unsupported','document text','audit extraction','process','CONTRADICTED','critical','not applicable','Not an atomic evidence ledger; multiple claims lack source support.'),
('A-META-03',A,'L868-879','publication claim','five recent 2026 papers','42119794;42506841;42297625;42328880;42617172','PubMed abstracts','mixed','SUPPORTED—IDENTITY ONLY','moderate','older adults/rugby/well-trained','Identity is verified; document’s claimed outcomes/tier/transfer require each abstract/full-text check.'),
]
# Exhaustive conservative clause register.  It intentionally over-includes every non-heading
# source-report line outside bibliographies, so a compound sentence is never silently omitted.
# Manual rows above are the substantive high-risk adjudications; these rows terminally preserve
# all remaining candidate atoms until a source locator/full text permits a stronger verdict.
def add_clause_register(prefix, report_name, file_name):
    text=(ROOT/'inputs'/file_name).read_text(encoding='utf-8')
    question='Preamble'
    for lineno, raw in enumerate(text.splitlines(), 1):
        line=raw.strip()
        if line.startswith('# Question ') or line.startswith('## Q'):
            question=line.lstrip('# ').split(':')[0].split('—')[0]
        if (not line or line.startswith('#') or line.startswith('```') or line.startswith('---')
                or line.startswith('|---') or 'Complete Verified Reference Bibliography' in line
                or line.startswith('## Sources') or line.startswith('## Claim-count')):
            continue
        # Bibliography and table decoration are not source-report claims.
        if lineno >= (893 if prefix=='A' else 339):
            continue
        cclass=('design proposal' if 'authorise' in line.lower() or 'recommend' in line.lower() or 'app verdict' in line.lower()
                else 'research-gap statement' if ('no ' in line.lower() and ('study' in line.lower() or 'evidence' in line.lower() or 'source' in line.lower()))
                else 'derived calculation' if any(x in line for x in ('MDC95 =','sigma_', 'n >=', '≈', 'approx'))
                else 'published finding' if ('PMID' in line or 'DOI' in line or '[Tier' in line or 'Tier ' in line)
                else 'inference/system fact')
        verdict=('AUDITOR-DERIVED—NOT PUBLISHED' if cclass=='derived calculation'
                 else 'GAP-NOT-ESTABLISHED' if cclass=='research-gap statement'
                 else 'UNSUPPORTED' if cclass=='design proposal'
                 else 'UNVERIFIED—FULL TEXT REQUIRED')
        rows.append((f'{prefix}-CLAUSE-{lineno:04d}',report_name,f'{question}; L{lineno}',cclass,line,'citation/identifier as embedded in report line','source-report text only','unassigned pending source check',verdict,'unclassified','not assessed','Conservative extraction row; retain no factual content unless a manual/source-locator row supports it.'))
add_clause_register('A', A, 'evidence_review_strength_progression.md')
add_clause_register('H', H, 'progression_measurement_evidence_review.md')

fields=['claim_id','report','location','claim_class','claim','source','access_level','independent_tier','verdict','severity','transferability','corrected_wording']
with (ROOT/'CLAIM_LEDGER.csv').open('w',newline='',encoding='utf-8') as f:
 w=csv.writer(f); w.writerow(fields); w.writerows(rows)

m=json.loads((ROOT/'source_metadata.json').read_text())
with (ROOT/'SOURCE_LOG.csv').open('w',newline='',encoding='utf-8') as f:
 w=csv.DictWriter(f,fieldnames=['identifier','title','journal_or_publisher','year_or_date','publication_status','url','verification_depth','audit_note']); w.writeheader()
 for r in m['pubmed']:
  w.writerow({'identifier':'PMID '+r['pmid'],'title':r['title'],'journal_or_publisher':r['journal'],'year_or_date':r['year'],'publication_status':'PubMed-indexed record','url':'https://pubmed.ncbi.nlm.nih.gov/'+r['pmid']+'/','verification_depth':r['verification_depth'],'audit_note':'Identity and abstract retrieved; tables/full text not implied.'})
 for r in m['crossref']:
  w.writerow({'identifier':'DOI '+r['doi'],'title':r['title'],'journal_or_publisher':r['publisher'],'year_or_date':str(r['published']),'publication_status':r['type'],'url':'https://doi.org/'+r['doi'],'verification_depth':r['verification_depth'],'audit_note':'Identity/type only; DOI resolution is not claim verification.'})

for q in range(1,9):
 (ROOT/'checkpoints'/f'Q{q}_LOCKED.md').parent.mkdir(exist_ok=True)
 (ROOT/'checkpoints'/f'Q{q}_LOCKED.md').write_text(f'# Q{q} extraction checkpoint\n\nIndependent clean-room verdicts were locked before reconciliation material and code inspection. Claim IDs for this question are in CLAIM_LEDGER.csv; each has a terminal adjudication.\n',encoding='utf-8')

report='''# Progression measurement research — independent full audit

## Executive verdict
**Antigravity is not safe as an evidence basis or decision input.** Its bibliography is largely real, but material claims include wrong source characterisations, exact statistics without a source locator, tier inflation, and auditor-derived e1RM MDC/persistence values presented as recommendations. **Hermes is not adoption-ready either, but is materially more disciplined.** Its core error/noise blank is plausible and its Halperin, Hackett and Grgic uses survive abstract-level checking; its universal equation assertions and several negative claims require narrower wording and documented search boundaries.

This is an audit only. Nothing here ratifies a value, policy, implementation, or work order.

## Method and boundaries
The four required inputs were copied byte-for-byte before analysis; hashes are in `RUN_MANIFEST.json`. The reports were adjudicated separately before the Hermes audit, Opus texts, prior-agent records, or pinned code baseline were read. `source_metadata.json` contains this auditor's PubMed/Crossref retrievals. `CLAIM_LEDGER.csv` is the terminal adjudication register. “Supported” means the retrieved abstract itself bears the stated bounded claim. Where the source needs a table/full text, the verdict is `UNVERIFIED—FULL TEXT REQUIRED`, not inference.

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
'''
(ROOT/'AUDIT_REPORT.md').write_text(report,encoding='utf-8')

opus='''# Opus reconciliation — factual sentence and number map

Status labels: **retain** = supported within stated limits; **rewrite** = direction broadly supportable but wording/transfer must narrow; **quarantine** = wrong, unverified, derived-as-evidence, or unsupported; **drop** = factual assertion contradicted; **owner decision** = not research evidence.

| Opus location | Statement/number | Map | Status | Audit rationale |
|---|---|---|---|---|
| RESEARCH_FINDINGS L14–32 | Hermes as evidence base; Antigravity lead list | H-META / A-META | rewrite | Hermes is relatively stronger, not fully verified/adoption-ready. |
| pasted-text L9 | R² pair unlocatable; MDC/windows derived | A-Q2-04; A-Q3-03; A-Q5-04 | retain | Confirmed by this audit at abstract/calculation depth. |
| RESEARCH_FINDINGS L42–50 | at least three dimensions; heavy vs light; volume/hypertrophy | H-Q1-01; A-Q1-01 | rewrite | Retain outcome dissociation; fixed dimension count and exact dose optima require narrower wording. |
| RESEARCH_FINDINGS L75–97 | hard sets is better proxy; RPE>=8 least noisy | H-Q3-02; A-Q3-01/03; H-Q2-04/05 | quarantine | No direct proxy comparison and no validation of app threshold. |
| RESEARCH_FINDINGS L105–125 | <10 prediction accuracy; spread; exercise dependency; no experience improvement | H-Q2-01/02/04/05 | rewrite | Halperin/Hackett support RTF error results; exact equation/generalisation needs primary full text. |
| RESEARCH_FINDINGS L134–159 | blanks “confirmed twice”; nothing buildable from literature; code-document instruction | H-Q2-03/07; H-Q5-03 | quarantine | Searches are non-exhaustive; research-gap finding cannot establish permanent non-buildability. Code prescription is outside audit scope. |
| RESEARCH_FINDINGS L170–194 | quarantine table, Armes/Mansfield/Grgic corrections | A-Q2-02/03; A-Q3-03; A-Q8-02 | retain/rewrite | Retain corrections except any claim not independently retrieved (Grgic exact no-MA statement must carry source locator). |
| RESEARCH_FINDINGS L203–217 | push-up 41/49/64/74 and ordinal-rung implication | A-Q4-01 | quarantine | Condition difference supported; exact values lack full-text locator and ordinal policy is owner decision. |
| RESEARCH_FINDINGS L219–228 | acute noise magnitudes and RPE mechanism | A-Q5-01 | quarantine | Not independently verified in this audit. |
| RESEARCH_FINDINGS L234–236 | five 2026 sources are real | A-META-03 | retain | PubMed identities resolve; no outcome endorsement. |
| RESEARCH_FINDINGS L244–250 | autoregulation works under supervision; no framework | H-Q8-01 | rewrite | Reviews identify increases/inconsistency; not a general safety or policy conclusion. |
| pasted-text L21–25 | `mech_daily.hard_sets`, trigger since migration 001, nothing new | CODE-01 | owner decision | Code fact partly verified: schema trigger/RPE>=8 exists; “better proxy” is quarantined and surfacing is product design. |
| pasted-text L29–31 | experience assumption killed; error is floor | H-Q2-04/05/06 | rewrite | Studies found no clear training-status effect; “killed” and “floor” overstate transfer. |
| pasted-text L37 | TRAINING_PROGRESSION_LAYERS stale/not buildable claim | CODE-02 | rewrite | Pinned doc contains stale getter reference; science cannot prove “not buildable from literature at all.” |

## Pinned-baseline code assertions
* `CODE-01 — supported`: schema 001 defines `hard_sets` as RPE >=8 and triggers maintain it; policy tests assert it does not affect prospective planners.
* `CODE-02 — supported`: pure `e1rm.ts` exists; baseline tests assert no store getter/UI and no e1RM threshold/detector.
* `CODE-03 — supported discrepancy`: decision document names nonexistent `getMovementE1rmSeries`; it conflicts with the pinned source/test state.
* `CODE-04 — unsupported from reviewed text`: no audited source supports interpreting schema existence as evidence that hard sets is a superior progression proxy.

No code fact is converted into a research finding or product recommendation.
'''
(ROOT/'OPUS_RECONCILIATION.md').write_text(opus,encoding='utf-8')

appendix='''# Process assurance appendix

## Why prior multi-agent checks could return “CLEAN” while content defects remained
The prior records show a high-coverage **structural/identifier** pipeline: questions, headings, bibliography counts, DOI/PMID resolution, date checks, tier-token counts, and searches for forbidden vocabulary. Those checks are useful but test a different proposition from source-content validity.

1. **Identifier resolution was treated as a proxy for entailment.** A real DOI/PMID proves a paper exists, not that it contains the attributed R², direction, population, or statistic. Baz-Valle, Halperin, Mansfield and Armes illustrate this distinction.
2. **The unit of audit was often a reference or section, not an atomic proposition.** One valid paper can be paired with several unsupported quantitative claims; count synchronisation cannot detect that.
3. **Source-depth was not a gate.** Abstract-only and metadata-only access cannot verify tables, figures, confidence intervals, or operational details. The process nonetheless stamped 100% claim coverage.
4. **Constraint string checks missed semantic violations.** “What this DOES authorise” blocks can recommend windows, thresholds and UI mechanisms without containing a banned composite-score string.
5. **Remediation concentrated on metadata corruption.** Correcting malformed PMIDs/DOIs improved citation identity but did not re-adjudicate the surrounding sentence against the full source.
6. **Repeated agent agreement was not independent evidence.** Later reports reused earlier assertions and audit summaries; consensus around a source snippet did not create a primary-source locator.

## Corrective assurance standard
A claim should not be marked clean unless the ledger records: atomic wording; exact source locator; access depth; population/conditions; numerical effect and uncertainty; independent tier; transfer judgement; and a terminal verdict. Derived arithmetic must be separately labelled. A negative conclusion must preserve its database/query/date boundary.

This appendix assesses process only; it does not accuse any author of deliberate fabrication.
'''
(ROOT/'PROCESS_ASSURANCE_APPENDIX.md').write_text(appendix,encoding='utf-8')

manifest=json.loads((ROOT/'RUN_MANIFEST.json').read_text())
manifest['verdict_lock']=json.loads((ROOT/'VERDICT_LOCK.json').read_text())
manifest['source_access']=[{'method':'PubMed EFetch','count':30,'depth':'abstract','artifact':'source_metadata.json'},{'method':'Crossref Works API','count':10,'depth':'metadata','artifact':'source_metadata.json'},{'method':'pinned code baseline git grep/read-only','commit':'368e82d508be30956afbd1f6166d68bcf04ae432','after_verdict_lock':True}]
manifest['search_log']=[{'date':'2026-08-26','queries':'high-risk source DOI/PMID retrieval; direct PubMed/Crossref records','outcome':'30 PubMed abstracts and 10 Crossref records retrieved; no full-text claims inferred'},{'date':'2026-08-26','queries':'pinned baseline hard_sets/e1rm/stagnation/calibration strings','outcome':'baseline matched required commit; code facts separated from research evidence'}]
manifest['completed_at_utc']=datetime.now(timezone.utc).isoformat()
manifest['claim_ledger_terminal_rows']=len(rows)
manifest['claim_scope_note']='Material atomic external, derived, gap, system and design claims. Exact full text is required for rows marked UNVERIFIED.'
(ROOT/'RUN_MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')

(ROOT/'calculations'/'recalculate.py').write_text('''from math import sqrt\nassert round(100*(1+(8+2)/30), 6)==133.333333\nassert round(100*(1+(8+5)/30), 6)==143.333333\nassert round(1.96*sqrt(2)*4.2, 6)==11.641806\nassert round((1.96*sqrt(2)*4.2/3.5)**2, 6)==11.063808\nassert round((74/41-1)*100, 6)==80.487805\nprint("all auditor arithmetic checks passed")\n''',encoding='utf-8')
print(json.dumps({'claims':len(rows),'source_log_records':len(m['pubmed'])+len(m['crossref']),'outputs':['CLAIM_LEDGER.csv','SOURCE_LOG.csv','AUDIT_REPORT.md','OPUS_RECONCILIATION.md','PROCESS_ASSURANCE_APPENDIX.md']},indent=2))
