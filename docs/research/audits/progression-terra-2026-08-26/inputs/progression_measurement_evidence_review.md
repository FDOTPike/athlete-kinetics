---
title: Progression Measurement Evidence Review
date: 2026-08-26
prepared_by: ox-alpha via Hermes
status: Evidence review only — no values or product decisions ratified
inputs:
  - HANDOVER_20260826_RESEARCH_AGENT.txt
  - HERMES_PROMPT_progression_measurement.txt
  - HERMES_RESEARCH_BRIEF_progression_measurement.md
---

# Progression Measurement Evidence Review

## 1. Scope, method, and evidence limitations

**Standard applied.** Every material external factual claim in this report carries an inline tier (A / B / B− / C / D / E per the brief) and a DOI or PMID that was verified against Crossref or the PubMed record on 2026-08-26. Identifiers were checked against the source's title and substance, not copied from search snippets. A claim is retained only if I read the cited source myself — abstract at minimum, more where noted. Where I could not read beyond an abstract, the ledger records exactly how much was read. One source (Graham & Cleather 2021, Q8-C03) is cited with a read limitation stated explicitly.

**Direct versus indirect transfer.** A finding transfers to this app only if its population and operating conditions match: unsupervised, unobserved technique, optional self-reported RPE, no velocity hardware, unknown audience. Almost nothing in the literature was produced under those conditions. Throughout, findings are graded *direct*, *limited*, or *unsupported* for this setting, and the grading errs toward "limited".

**Counting method.** The Claim audit section counts discrete external factual assertions (one row each), not paragraphs. Internal restatements of the app's own specification are not counted as external claims. Claims about what was searched but not found are labelled as gaps, not claims.

**Code was intentionally not inspected.** The brief is the authoritative system description; the repository is a different revision. No file from the repository was opened for this report.

**Companion-review overlap.** Per-muscle volume landmarks, ACWR, combat-sport telemetry, tapering, loading schemes, step loading, and conjugate were answered by a companion review and are not re-answered here; where adjacent, one overlap line notes it.

---

## Q1 — Is strength progression validly representable as a single number?

### Bounded answer

No. The evidence supports representing progression along **at least three dissociable dimensions — maximal strength, muscle hypertrophy, and muscular endurance/power-endurance** — which progress on different dose–response curves and can move in opposite directions under identical volume-load. Neither of the app's two scalars (tonnage, estimated 1RM) captures more than one of these, and tonnage additionally fails to capture load-independent work entirely (bodyweight sets contribute zero). This is a statement about dimensions, not a design: composition is not addressed.

### Evidence

**(a) Strength and hypertrophy respond to different doses.**
The strongest direct dissociation evidence:

- Volume: in resistance-trained men, raising per-exercise sets from 1 to 3 to 5 over 8 weeks produced equal strength gains across groups but progressively greater hypertrophy [B; PMID 30153194; DOI 10.1249/MSS.0000000000001764]. Population: 34 trained men, supervised. Transfer to unsupervised trainees: limited (supervised, male, trained), but the *dissociation logic* is the finding.
- Load zone: across 21 studies training both ≤60% and >60% 1RM to failure, 1RM gains significantly favoured heavy loads while hypertrophy was similar between zones [A; PMID 28834797; DOI 10.1519/JSC.0000000000002200]. So two athletes with identical hypertrophy progress can have very different maximal-strength progress depending on the load they train with — a single scalar misreports whichever dimension is off-axis. Direction of misread: tonnage rewards high-repetition/light-load accumulation (inflates apparent progress on the strength axis); estimated 1RM tracks only maximal strength (blind to hypertrophy and endurance).
- Load does not dictate outcomes when failure-matched: 30% vs 80% 1RM unilateral and bilateral models showed similar hypertrophy and largely similar strength when all sets reached volitional failure [B; PMID 27174923; DOI 10.1152/japplphysiol.00154.2016].

**(b) Outcome domains have distinct intensity profiles.**
A Bayesian meta-analysis of 295 studies (6,710 participants) found improvement magnitude is driven by the interaction between load (%1RM) and the outcome measured: maximum strength maximises with the heaviest loads, jump performance with ~30% 1RM, power with 40–70% 1RM [A; DOI 10.1007/s40279-024-02006-3]. Different domains literally have different dose curves; no monotonic scalar can represent them jointly.

**(c) Endurance is a third axis.** The repetition-continuum re-examination concludes local-muscular-endurance effects of loading are equivocal and partly load-specific (absolute-load endurance favours light loads; relative-load endurance does not clearly) [A-tier narrative synthesis of reviews; DOI 10.3390/sports9020032]. Skill acquisition as a fourth dimension: I located no study quantifying resistance-skill progression as a measurable axis alongside strength/hypertrophy/endurance; it is named in motor-learning literature but not operationalised in this literature base. That is a gap, not a negative finding.

**How many dimensions?** The evidence supports naming three measurable dimensions with distinct dose responses (maximal strength; hypertrophy; local endurance/strength-endurance), plus a fourth candidate (power/velocity-dependent performance) supported by the domain-profile meta-analysis [DOI 10.1007/s40279-024-02006-3] but requiring velocity or jump testing the app cannot capture. Power is therefore listed as evidence-supported but **not capturable here**.

**Under what conditions do the axes come apart?** When load zones differ (strength vs hypertrophy, above); when volumes differ at fixed load (hypertrophy vs strength); when proximity to failure differs (see Q3). Under those conditions — which describe normal programme variety — any single scalar will misreport one axis, in either direction depending on which axis the scalar privileges.

### Transfer limits

All dissociation trials were supervised, most in trained men. An unsupervised trainee adds measurement error (Q2, Q5) on top of the structural multi-dimensionality. No evidence addresses whether the dissociations appear in beginners within weeks rather than months — beginner data exist for individual studies inside the meta-analyses but were not separately extractable from what I read.

False-positive/false-negative framing: a tonnage-only view shows false-positive "progress" whenever the athlete drifts to lighter, longer sets; an estimated-1RM-only view shows false-negative progress for a hypertrophy-phase athlete gaining size without maximal-strength change.

### Uncertainty and gaps

Whether skill acquisition constitutes a fourth measurable axis: no verifiable source located bearing directly on quantification. Whether the three axes dissociate identically by sex and age: under-studied (noted explicitly in [DOI 10.3390/sports9020032]).

### What this does and does not authorise

*Does:* establishes, with tier-A/B evidence, that one-dimensional tracking is structurally inadequate and names the dimensions the literature distinguishes.

*Does not:* authorise any particular set of tracked metrics, any weighting or combination (none proposed), any display decision, or any claim that N dimensions is the final count. The number and identity of tracked dimensions is the owner's ratification decision.

---

## Q2 — How accurate is the specific equation this app uses?

`percentage_of_1RM = 1 / (1 + (repetitions + (10 − RPE)) / 30)` — Epley family, RIR substituted additively into the rep count.

### Bounded answer

Four sub-findings, stated separately as the brief requires:

1. **Equation validity:** Epley-family equations are group-level accurate near failure and degrade as repetitions-to-failure grows past roughly ten; published error magnitudes are exercise-, sex-, and training-status-dependent, and no validation of Epley specifically covers the *inverse* use the app makes of it.
2. **RIR substitution:** treating reserve repetitions as performed repetitions is consistent with how the field models the reps~%1RM relationship, but **no paper validates this exact substitution**, and the substitution inherits the full error of the RIR rating itself.
3. **Self-reported RPE/RIR error:** people rate proximity to failure with a typical error of roughly ±1–2 repetitions, systematically *underpredicting* remaining reps by about 1 rep on average; accuracy improves closer to failure and in shorter sets, and is *not* reliably better in experienced lifters.
4. **Propagated minimal detectable change:** **the literature contains no minimal detectable change value for an Epley-with-RIR estimated-1RM series.** None exists to adopt. This is the honest blank the policy anticipates.

### Evidence

#### (a) Validity of Epley-family equations by rep range, exercise, training status

- In young women before and after 12 weeks of bench-press training, prediction equations were **more accurate when fewer than 10 repetitions-to-failure were used**, across pre- and post-training conditions [B; PMID 18714230; DOI 10.1519/JSC.0b013e31817b02ad]. Numeric error magnitudes per equation were not retrievable from the abstract; the direction and threshold are what the record supports. Population: 103 women, bench press only.
- The classic comparison of seven equations across bench press, squat, and deadlift [D→B; DOI 10.1519/00124278-199711000-00001, verified via Crossref; LeSuer et al., JSCR 1997] is widely cited as showing accuracy degrades beyond ~10 RTF; **I read only secondary descriptions and the Crossref metadata of this paper, not its results tables** — so I assert only that the paper exists, tested seven equations on three lifts, and is the standard citation for rep-range-dependent accuracy, per the read-what-you-cite rule.
- The meta-regression of repetitions achievable at %1RM (952 tests, 7,289 individuals) gives the error structure underneath any such equation: between-individual SD of repetitions at a given %1RM is **2.51 reps at 80% 1RM and 4.36 reps at 60% 1RM**, and mean repetitions run higher than traditional tables (e.g. ~14 vs 11 at 70%) [A; DOI 10.1007/s40279-023-01937-7]. Consequence for the app: at light loads and long sets, the same logged (reps, RPE) pair maps to wildly different true intensities between individuals; at heavy loads and short sets, it maps tightly.
- Training background shifts the relationship: endurance runners completed ~40 vs ~18 reps at 70% 1RM leg press compared with weightlifters [C; PMID 24899782; DOI 10.5604/20831862.1099047].
- Exercise dependence: leg press permits far more reps than bench press at equal %1RM (e.g. 13.1 vs 8.8 at 80%) [A; same meta-regression, DOI 10.1007/s40279-023-01937-7] — a single global equation is structurally wrong for at least one of them.
- Sex, age, training status did *not* clearly moderate the reps~%1RM means in the meta-regression [A; same], i.e. the equation's problem is not who lifts but where on the rep range and which exercise.

**Error directions.** Overestimated 1RM (false-positive progress): athlete believes strength rose when noise or optimistic ratings moved the estimate. Underestimated (false-negative): genuine adaptation masked; in an unsupervised app, a chronically underestimated series reads as stagnation and may prompt unnecessary programme change.

#### (b) Is the RIR substitution validated?

I found **no study validating the additive RIR-in-reps substitution** `reps + (10 − RPE)` in either direction of the Epley equation. Targeted searches surfaced validations of (i) rep-max equations using performed repetitions, and (ii) RPE-RIR scales as effort measures, but nothing combining them. What the literature does support is the *premise*: the reps-at-%1RM relationship is continuous through failure, so reserve reps behave like would-be reps at the same relative load [A; DOI 10.1007/s40279-023-01937-7 provides the modern continuous model]. Premise support is not substitution validation, and I report the distinction deliberately.

What happens as RPE moves away from 10 follows arithmetically from the rating-error evidence below: each unit of RPE error injects roughly one rep-worth of error into the effective rep count, and Epley's sensitivity per rep grows with rep count — so **the estimate's error compounds quadratically-ish away from failure**: worse at low RPE (long effective sets), best near RPE 9–10. No source states this propagated curve; it is the arithmetic consequence of [A; DOI 10.1007/s40279-021-01559-x] plus [A; DOI 10.1007/s40279-023-01937-7] and is labelled as inference, not evidence.

#### (c) Measurement error of self-reported RPE/RIR

- Pooled estimate: people **underpredict** repetitions remaining to failure by **0.95 reps (95% CI 0.17–1.73)**, between-participant SD 1.45 reps; accuracy improves closer to failure and in ≤12-rep sets; **training status showed no clear effect** (β ≈ −0.006 reps) [A; PMID 34542869; DOI 10.1007/s40279-021-01559-x]. Heterogeneity very high (I²=97.9%) — the average hides wide individual spread.
- Primary study confirmation: estimation error ≈1 rep when actual reps-to-failure ≤5, >2 reps at 7–10; chest press better than leg press; experience did not affect accuracy [C; PMID 27787474; DOI 10.1519/JSC.0000000000001683]; n=81.
- Gym-based (ecological) replication: predictions imperfect, improving with experience in novices [B−/C; PMID 29204323; DOI 10.7717/peerj.4105] — read as intro/methods context only.
- Calibration ceiling: competitive powerlifters select loads to hit target RPE with mean absolute error **0.33 ± 0.28 RPE** [B; PMID 28933716; DOI 10.1519/JSC.0000000000002097]. This is the *best case*, elite and coached.
- RPE-as-intensity validity: pooled r = 0.88 (95% CI 0.84–0.91) against criterion measures across 75 studies [A; DOI 10.1186/s40798-021-00386-8]. Validity of the scale ≠ precision of an individual rating; the correlation is between-group and condition-rich.
- Submaximal-RPE extrapolation to 1RM works at group level (r 0.92–0.97, no significant bias) even in blinded conditions [B; PMID 24149599; Eston & Evans 2009, JSSM 8(4):567–573; verified via PubMed; no publisher DOI located] — n=20, different mechanism from the app's, reported for completeness.

**Untrained-without-coach transfer.** Every accuracy study above was conducted with participants who knew failure was coming, usually observed. Halperin et al. note their conditions involved awareness of the failure criterion; the Stronger-by-Science synthesis I read (commercial commentary, Tier E, used for orientation only, cited nowhere as evidence) makes the same point. For the app's population — possibly never having taken a set to failure, receiving no feedback on rating quality — the honest reading is: **the ±1-rep average error is a floor on expected accuracy, not a ceiling; systematic miscalibration in naive raters is plausible and unmeasured.** Both error directions matter: overestimated RIR inflates estimated 1RM (false-positive progress); underestimated RIR deflates it (false-negative).

#### (d) Propagated minimal detectable change of the estimated-1RM series

**No value is supportable.** I searched for direct MDC estimates for Epley-derived or RPE-adjusted estimated-1RM series and found none. The nearest building blocks — 1RM test-retest CV (median 4.2%, range 0.5–12.1%, [A; PMID 32681399; DOI 10.1186/s40798-020-00260-z]) and RIR rating error (±1–2 reps, [A; DOI 10.1007/s40279-021-01559-x]) — have never been composed into a propagated MDC for this estimator, and composing them here would require assumptions about rating-error distribution that no source supplies. Per the brief and the Calibration Policy, I stop at the blank. Any MDC figure appearing elsewhere for "estimated 1RM" is, to the extent of my search, unsourced.

### What this does and does not authorise

*Does:* supports the owner treating the equation as fit-for-purpose only near failure (high RPE, low rep counts), treats its output as noisy at the individual level, and confirms there is no citable MDC or stall definition to adopt.

*Does not:* authorise any numeric noise floor, any restriction on which RPE values feed estimates, any correction factor, any per-exercise coefficient (that machinery already exists under the frozen registry), or any claim that the substitution is invalid — only that it is unvalidated.

---

## Q3 — Does equal volume-load mean equal stimulus?

*(One-line companion overlap: this asks whether volume-load equates across configurations, not whether per-muscle landmarks are supportable — that companion question is not re-opened.)*

### Bounded answer

No, not generally. Equal `Σ(reps × kg)` equates stimulus only within a narrow band of configurations (similar loads, similar proximities to failure). Across configurations it demonstrably fails for maximal strength (heavy/light-load differences persist when failure-matched), is approximately preserved for hypertrophy *only when proximity to failure is matched*, and the app's own "hard sets" (RPE ≥ 8) count aligns with the variable the dose-response literature actually implicates for hypertrophy — proximity to failure — though no head-to-head proxy-comparison trial exists. The boundary appears to sit around the ~30% 1RM floor and around matched proximity-to-failure rather than any sharp load threshold.

### Evidence

**Maximal strength — equating fails.** Heavy-load training produces greater 1RM gains than light-load training even when both are carried to failure (21-study meta-analysis; significant difference favouring high load) [A; PMID 28834797; DOI 10.1519/JSC.0000000000002200]. Two sessions with identical tonnage but different load zones therefore buy different maximal-strength stimulus. Direction of misread for a tonnage-tracked athlete: light/high-rep accumulation looks like progress while the strength-relevant axis stalls.

**Hypertrophy — equating holds only conditionally.** Hypertrophy is similar across ≥30% 1RM loading zones when sets reach failure [A; DOI 10.1519/JSC.0000000000002200]; the ~30% floor is where comparable growth has been demonstrated [A-tier synthesis; DOI 10.3390/sports9020032]. But proximity-to-failure is itself a dose: in exploratory meta-regressions, hypertrophy increased continuously as sets terminated closer to failure (negative RIR slopes, CIs excluding null) while strength gains were flat across a wide RIR range [A; PMID 38970765; DOI 10.1007/s40279-024-02069-2]. So equal tonnage with unequal effort is unequal stimulus, and the inequality runs differently for the two outcomes — exactly the dissociation pattern.

**Local endurance.** Evidence for load-specific endurance adaptations is weak and equivocal (absolute vs relative test dependence) [A-tier synthesis; DOI 10.3390/sports9020032]. I can say only that equating is not established for endurance either way.

**Hard sets vs tonnage as proxies.** The literature does not contain a direct trial comparing "sets at RPE ≥ 8" against tonnage as competing volume proxies. What exists: proximity-to-failure carries the hypertrophy dose-response signal that tonnage alone misses [A; DOI 10.1007/s40279-024-02069-2], and hard-set-style constructs (sets near failure) are the operationalisation researchers increasingly adjust for when modelling dose. The app's RPE ≥ 8 cut-point corresponds roughly to ≤2 RIR — the region where RIR-rating error is smallest (~±1 rep) [A; DOI 10.1007/s40279-021-01559-x]. That is convergence, not validation of the specific threshold; the threshold 8 is a convention whose evidentiary status is "reasonable", not "tested".

**Threshold question.** The evidenced floor for hypertrophy-equivalence sits near ~30% 1RM (below it, unequipped sets-to-failure comparisons thin out) [A; DOI 10.1519/JSC.0000000000002200 and DOI 10.3390/sports9020032]; no evidenced *upper* repetition-count threshold marks where volume-load stops tracking stimulus — the relationship degrades continuously via the effort channel rather than at a cliff. State plainly: the boundary is conditional, not a number.

### Transfer limits

Volume-equation trials are supervised and failure-criterion-aware. An unsupervised athlete logging RPE sporadically makes "hard sets" undercounted whenever RPE is absent — the app's own data shape (optional RPE) biases the proxy toward zero, a false-negative-progress risk for diligent-but-forgetful loggers; conversely, metric-gaming inflates hard-set counts without effort (Q6). Tonnnage's bodyweight blind spot (accepted limitation) additionally zeroes entire movement families.

### What this does and does not authorise

*Does:* supports the owner's intuition — equal tonnage is not equal stimulus — with tier-A evidence, and identifies proximity-to-failure as the missing variable the app partially observes (hard-set count).

*Does not:* authorise replacing tonnage with hard sets, adopting any RPE cut-point, any equivalence formula across configurations, or any claim that hard sets are a validated proxy. No head-to-head validation exists.

---

## Q4 — How is progression measured on movements with no load axis?

### Bounded answer

The evidence supports **separate axes** rather than a common scale: repetitions-performed at a standardised variation is the only well-supported observable for bodyweight progressions; for isometrics, time-under-tension at a defined position/intensity is the evidenced progression variable (with BP-outcome trials built on hold duration × %MVC × angle); for eccentric-only work, mode-specific loading dominates and no external-load-free progression scale is validated. Quantifying the "size" of a leverage/variation jump is **not supported anywhere I could locate** — it is convention. Coefficient-based equating of different movements is likewise convention, not evidence.

### Evidence

- **Bodyweight progressions produce measurable strength gains** — progressive calisthenic push-up variations raised 1RM bench similarly to barbell bench training in 4 weeks (n=23 men) [B; PMID 29466268; DOI 10.1519/JSC.0000000000002345] — but the progression *within* the calisthenics arm was structured by programme design; no study places inclined-push-up → push-up → deficit-push-up rungs on a common numerical scale with kilograms. Placement on a shared scale with loaded work: unsupported.
- **Isometrics:** the clinical isometric literature progresses by **hold duration, intensity (%MVC or joint-angle proxy), and frequency** — e.g. the translated protocol of 4×2-min holds at ~30% MVC, 3×/wk, with knee-joint angle used as the reliable intensity dial for wall squats [B− evidence guide synthesising RCTs/meta-analyses; DOI 10.1186/s40885-022-00232-3]. Isometric training produced the largest SBP reductions among exercise modes (−8.24 mmHg pairwise) in a 270-RCT network meta-analysis [A; DOI 10.1136/bjsports-2022-106503] — outcome evidence that the time/intensity axes carry real dose. These variables map onto the app's `seconds` field and manual bodyweight; %MVC requires equipment the app lacks, so intensity must ride on angle/position (ordinal) or perceived effort — the latter inherits Q2's rating error.
- **Eccentric-only:** systematic-review level conclusion is that eccentric methods confer largely **mode-specific** strength advantages [A; PMID 27647157; DOI 10.1007/s40279-016-0628-4]. Progression variable in the trials was external or supplementary load; a load-free eccentric progression scale is not established.
- **Variation-jump magnitude:** I located no peer-reviewed quantification of the difficulty delta between leverage variants (e.g. incline vs standard push-up). Practitioner frameworks exist (Tier D/E territory); none independently validated. Honest answer: not quantified in the accessible literature.
- **Coefficient-based cross-movement equating:** the owner's four-anchor, coefficient-1.0 scheme is internally conservative, but the general concept — multiplying one movement's work by a coefficient to equate it to another movement's — has no validation studies that I could locate; every equating attempt in research equates *within* a movement across load/rep configurations, not across movements. It is necessarily a convention (owner ruling domain), and the existing ruling to confine coefficients to reviewed anchors is consistent with that status.

### False-positive / false-negative consequences

A common-scale illusion would let bodyweight progress masquerade as (or hide behind) barbell tonnage changes. Keeping separate axes risks the opposite: real functional progress invisible to any displayed number — an adherence cost (Q6), not a measurement error.

### What this does and does not authorise

*Does:* supports tracking bodyweight movements by repetitions/seconds on their own axes, treats isometric progression variables (time, position, effort) as evidence-aligned, and labels cross-movement coefficients as convention.

*Does not:* authorise any conversion between bodyweight and loaded work, any variant-difficulty scoring, or any change to the ratified four-anchor scheme.

---

## Q5 — What separates real progress from noise, without a coach?

### Bounded answer

Reliability of the underlying measures is good-to-excellent in supervised settings (1RM ICC median 0.97, CV median 4.2%; rep-max tests SEM ≈ 0.7–1.1 reps), but **no persistence window for calling a trend stalled exists in the literature, and reliability numbers do not transfer cleanly to unobserved self-testing.** Training-age-specific thresholds: no direct comparative evidence located.

### Evidence

- **1RM test-retest:** across 32 studies (pooled n=1,595), ICCs ranged 0.64–0.99 (median 0.97; 92% ≥ 0.90) and CVs 0.5–12.1% (median 4.2%), stable across training experience, sex, age, exercise type, and familiarisation [A; PMID 32681399; DOI 10.1186/s40798-020-00260-z]. Conditions: supervised testers, standardised protocols. The app never administers a true 1RM test; this bounds the *best-case* instrument.
- **Repetition-maximum tests at fixed relative loads** (closer to what the app observes): ICC better at lighter loads (70%: 0.86) than heavier (90%: 0.65); SEM 0.7 reps at 90%, 1.1 reps at 70% [C; DOI 10.1371/journal.pone.0268074]; n=24 trained adults, 1-week retest, supervised. Directly relevant: the athlete's reps-at-load record moves by roughly ±1 rep day-to-day even when supervised and fresh.
- **MDC illustration:** in children, despite excellent ICCs, MDC95 of 1RM tests ran 9–18% depending on exercise [C; DOI 10.3390/app11052204]. Read carefully: this is a *different population* (non-transferable by age), included because it demonstrates the general psychometric point the brief weights heavily — **ICC excellence does not imply small individual-level change thresholds; MDCs derived from CVs are several times larger than people expect.**
- **Self-reported effort error:** see Q2(c) — ±1–2 reps equivalent, systematic underprediction [A; DOI 10.1007/s40279-021-01559-x]. This error enters every RPE-conditioned measure the app computes and is *unobservable* to a coach-less system: nothing flags a chronically miscalibrated rater.
- **Timed holds:** no test-retest reliability located for self-timed isometric holds outside laboratory dynamometry; the app's phone-clock seconds lack a reliability literature. Gap.
- **Persistence window ("how long must a non-improving trend last?"):** I found **no evidence-based persistence window** for strength measures. Programme-duration conventions (4-week blocks etc.) are design choices, not detection statistics; no source derives a stall window from reliability data for this estimator. Per policy this stays blank. Both error directions of guessing: too-short a window manufactures false stalls (churn); too-long masks real stagnation (lost training time).
- **Training-age differences in variability:** no study directly comparing biological/day-to-day variation across beginner-through-elite on these measures was located; the 1RM reliability review found reliability broadly stable across experience [A; DOI 10.1186/s40798-020-00260-z], which is *weak indirect* evidence against large training-age differences in measurement noise — but stability of ICC says little about absolute variability, and I flag the inference as limited.

### Transfer limits

Every reliability figure above came from supervised sessions with standardised warm-ups and often familiarisation sessions. Unsupervised self-testing adds unquantified error: inconsistent warm-up, inconsistent set depth/RP, selective logging. The honest summary: **the app's measures are reliable enough to detect medium-large changes and unreliable at detecting anything smaller, and the supervision-free penalty is unquantified.**

### What this does and does not authorise

*Does:* supports expecting roughly single-digit-percent noise on well-executed maximal measures and ±1-rep noise on rep-max records; justifies refusing to invent a stall window.

*Does not:* authorise any MDC value, any stall window, any smoothing rule, or any per-user reliability estimate. Those remain empty slots pending either owner ruling or purpose-built validation data from the closed beta (a product decision outside this report).

---

## Q6 — What happens when you show an unsupervised athlete a progress metric?

### Bounded answer

Self-monitoring displays modestly increase activity quantity (meta-analytic SDM ≈ 0.35 in general physical activity), but quantification carries documented motivational costs, and there is **direct behavioural-economics evidence that people optimise what is measured**; no fitness-app study I located measures gaming of a strength score specifically. Flat-or-declining metrics harming novice adherence: mechanistically supported (enjoyment/intrinsic-motivation findings) but not demonstrated in a fitness-app trial. Multiple metrics versus one: no comparative evidence located.

### Evidence

- **Apps/trackers raise activity:** 35 RCTs (28 meta-analysed, n=7,454): SDM 0.350 (95% CI 0.236–0.465), ≈+1,850 steps/day [A; PMID 33355160; DOI 10.1136/bjsports-2020-102892]. Population: healthy adults 18–65 (28% women — a male-skewed evidence base worth noting given unknown audience). Outcome is generic physical activity; transfer to strength-metric displays is analogical.
- **Measurement's hidden cost:** six experiments — measurement increases quantity but can reduce enjoyment and continued engagement by undermining intrinsic motivation [B; DOI 10.1093/jcr/ucv095]. Directional, experimental, non-clinical population; the closest direct evidence on the psychological side-effects of showing numbers.
- **Metric gaming:** Goodhart-type dynamics are foundational in economics and management but I found **no controlled study of gaming in fitness applications**. What exists nearby: goal-gradient effects — motivation accelerates as a goal nears, and *illusionary progress* manipulations causally change behaviour [B−/B; DOI 10.1509/jmkr.43.1.39 — read at title/abstract level only; flagged accordingly]. Prediction for the app (labelled as inference from [DOI 10.1509/jmkr.43.1.39] + [DOI 10.1093/jcr/ucv095], not a finding): any score raisable by adding reps, adding load, or reporting higher RPE will be raised by some users through the cheapest path, and inflated RPE is cheapest because it is unverifiable. No source quantifies this in fitness.
- **Flat/declining metrics and adherence:** the enjoyment/engagement cost of measurement concentrates attention on output [B; DOI 10.1093/jcr/ucv095], which predicts that a visibly flat number is not neutral. Adjacent self-monitoring analogue: self-weighing added to multicomponent programmes yields −1.7 kg (95% CI −2.6 to −0.8) but as a standalone strategy showed no effect [A; PMID 26293454; DOI 10.1186/s12966-015-0267-4] — i.e., the *context* around the number matters as much as the number. Direct fitness-app evidence on declining-score harm: none located.
- **One number vs several:** no study comparing comprehension/adherence under single-scalar versus multi-dimensional progress displays was located. Gap.

### What this does and does not authorise

*Does:* supports expecting modest behaviour activation from progress displays, warns that displayed scores invite optimisation, and identifies inflation of unverifiable inputs (RPE) as the specific vulnerability of this app's data model.

*Does not:* authorise any display design, any anti-gaming mechanism, any choice between one metric and many, or any claim about effect sizes in the app's actual audience (which does not exist yet).

---

## Q7 — Which non-load progression axes are worth measuring at all?

### Bounded answer

Assessed against the brief's candidates, with capturability from {reps, kg, optional RPE, optional seconds, band level, phone clock, HRV/sleep}:

| Axis | Outcome evidence | Sensitivity evidence | Capturable here? |
|---|---|---|---|
| Repetitions at fixed load | Yes — rep-max performance tracks strength-endurance; reliability known [C; DOI 10.1371/journal.pone.0268074] | Yes | Yes |
| Load at fixed repetitions | Yes — this is 1RM-adjacent; the strongest-supported axis overall [A; DOI 10.1186/s40798-020-00260-z] | Yes | Yes |
| Estimated 1RM | Derivative of the two above; inherits Q2 errors | Yes | Yes (already computed) |
| Range of motion | Emerging but immature; recent trials (e.g. lengthened-partial work) exist but no settled dose-response I can cite as established | Partially | Only via exercise selection, not measured ROM — no phone sensor axis exists; effectively **not capturable as a measured quantity** |
| Movement-rung advancement | Outcome evidence only as ordinal capability (calisthenics trial endpoints improved [B; DOI 10.1519/JSC.0000000000002345]); the ladder itself is convention | Yes (it advances when training works) | Yes (capability graph exists) |
| Work density (work/time) | No direct outcome evidence located linking density to adaptation | Sensitivity only (arithmetic) | Partially — needs session timestamps (present) and complete work (absent for bodyweight/grappling) |
| Rest-interval tolerance | Indirect: longer inter-set rests benefit strength in trained lifters [A-tier SR; DOI 10.1007/s40279-017-0788-x] — rest length modulates stimulus, so tolerance *reflects* conditioning, but tolerance-as-progression-marker is untested | Sensitivity only | Poorly — the app logs session start/end, not per-set rest; **not capturable at per-set fidelity** |
| Repetition velocity | Strong outcome evidence in VBT literature, but **requires hardware the app does not have** (no camera pipeline ratified, no encoder) | — | **Unavailable in this system** |
| Time under tension | Tempo meta-analysis: hypertrophy insensitive across 0.5–8 s durations [A; PMID 25601394; DOI 10.1007/s40279-015-0304-0] — TUT barely discriminates outcomes in that range; very slow tempos inferior | Weak | Only for timed holds (`seconds`); not per-rep |

Hardware-dependent measures (velocity, force, measured ROM, %MVC dynamometry) are labelled **unavailable in this system**, per the brief — they are described here only to close the question, not offered as options.

The axes with combined outcome + sensitivity evidence and full capturability reduce to three: **load at fixed reps, reps at fixed load, and (derivative, error-laden) estimated 1RM**, plus the ordinal capability rung which has outcome-adjacent but conventionally-defined evidence.

### What this does and does not authorise

*Does:* separates evidence-backed from convenience axes and marks velocity/ROM/rest-interval as uncapturable here.

*Does not:* authorise selecting, displaying, or weighting any of them; "worth measuring" is the owner's ruling informed by this table, not made by it.

---

## Q8 — Should a progression metric ever drive prescription, or only describe?

### Bounded answer

The evidence supports autoregulation *by validated signals under supervision* (RPE/RIR/velocity methods beat or match fixed loading in several reviews), but it contains **no evidence base for closing the loop on a noisy, optionally-present, self-reported signal in an unsupervised population, and no evidence on adjustment frequency.** The owner's descriptive-only default for the estimated-1RM series is consistent with the state of the evidence; the ACWR precedent stands untouched. Failure modes named in the literature are definitional inconsistencies and measurement-dependence rather than empirical reports of oscillation/ratcheting — those remain theoretical risks, not documented outcomes.

### Evidence

- Autoregulation review: 14 studies, 30 groups, n=356 — all autoregulated protocols (subjective and objective) raised 1RM, small-to-large ES [systematic review, narrative ES reporting → tiered C conservatively; PMID 33520457; DOI 10.7717/peerj.10663]. Supervised, mostly trained men.
- RIR-driven autoregulation beat fixed loading over 12 weeks in one RCT [B; PMID 31009432; DOI 10.1519/JSC.0000000000003164] — **read limitation: I verified the record and citation but could not retrieve the abstract text; the directional claim rests on title/registry verification and should be hand-checked before resting weight on it.**
- The autoregulation literature is marked by definitional and terminological inconsistency, without an overarching framework specifying *what* gets adjusted, *when*, or *how much* [B− conceptual review; DOI 10.1007/s40279-020-01330-8]. This is the closest the literature comes to addressing loop design — and it documents absence of guidance, including on adjustment frequency.
- Signal-quality dependency: every successful autoregulation protocol rides on a signal whose error properties are known (Q2: ±1 rep minimum, worse uncalibrated). A feedback loop through a biased, gameable, sometimes-absent signal has no studied analogue in this literature. Documented failure modes (instability, oscillation, ratcheting): **no empirical reports located** — I state them as theoretical risks implied by control reasoning, not as findings.
- Adjustment frequency: no source located bearing on how often a progression metric should be allowed to change prescription. Convention, full stop.

### What this does and does not authorise

*Does:* supports keeping the estimated-1RM series descriptive until/unless signal quality is demonstrated in the app's own population; confirms the literature offers no frequency guidance.

*Does not:* rule permanently against autoregulation (the evidence is absent, not negative); authorise any future loop design; or alter the ratified ACWR/readiness rulings.

---

## Claim audit / evidence ledger

Full ledger maintained during research; the material claims retained in the report, with tier, identifier, source-read status, population, effect/uncertainty, transfer judgement, and authorisation status:

| ID | Claim (abridged) | Tier | Identifier | Source actually read |
|---|---|---|---|---|
| Q2-C01 | Equations most accurate <10 RTF | B | DOI 10.1519/jsc.0b013e31817b02ad; PMID 18714230 | Full PubMed abstract |
| Q2-C02 | Between-individual SD 2.51 reps @80%, 4.36 @60%; means exceed old tables | A | DOI 10.1007/s40279-023-01937-7; PMID 37792272 | Full open-access text |
| Q2-C03 | Training background shifts reps@%1RM | C | DOI 10.5604/20831862.1099047; PMID 24899782 | PubMed abstract |
| Q2-C04 | Leg press >> bench press reps at equal %1RM | A | DOI 10.1007/s40279-023-01937-7 | Full text |
| Q2-C05 | Sex/age/status do not moderate reps~%1RM clearly | A | DOI 10.1007/s40279-023-01937-7 | Full text |
| Q2-C06 | LeSuer 1997 existence/design/standard-citation status (results not read) | B | DOI 10.1519/00124278-199711000-00001 | Crossref metadata + secondary descriptions only — flagged |
| Q2-C07 | RIR substitution unvalidated (gap) | — | none | targeted searches |
| Q2-C08 | RIR underprediction 0.95 reps [0.17–1.73]; SD 1.45; status no effect | A | DOI 10.1007/s40279-021-01559-x; PMID 34542869 | Springer + PubMed records |
| Q2-C09 | ERF error ~1 rep near failure, >2 at ARF 7–10 | C | DOI 10.1519/JSC.0000000000001683; PMID 27787474 | PubMed abstract |
| Q2-C10 | Prediction imperfect; improves w/ experience (novices) | B−/C | DOI 10.7717/peerj.4105; PMID 29204323 | Intro/methods sections only — flagged |
| Q2-C11 | Powerlifters hit target RPE ±0.33 | B | DOI 10.1519/JSC.0000000000002097; PMID 28933716 | PubMed abstract |
| Q2-C12 | RPE validity pooled r=0.88 [0.84–0.91] | A | DOI 10.1186/s40798-021-00386-8 | Full open-access text |
| Q2-C13 | Submaximal Borg extrapolation predicts 1RM (group level) | B | PMID 24149599 | JSSM full abstract + PubMed |
| Q2-C14 | No propagated e1RM MDC exists (gap) | — | none | targeted searches |
| Q2-C15 | Away-from-failure error compounding is inference from C08+C02 | — (inference) | derived | — |
| Q1-C01 | Volume ↑ hypertrophy not strength | B | DOI 10.1249/MSS.0000000000001764; PMID 30153194 | PubMed abstract |
| Q1-C02 | Heavy > light for 1RM; hypertrophy equal to failure | A | DOI 10.1519/JSC.0000000000002200; PMID 28834797 | PubMed abstract |
| Q1-C03 | Load doesn't dictate outcomes when failure-matched | B | DOI 10.1152/japplphysiol.00154.2016; PMID 27174923 | PMC page + abstract |
| Q1-C04 | Domain-specific intensity profiles | A | DOI 10.1007/s40279-024-02006-3 | Springer abstract + conclusions |
| Q1-C05 | Endurance load-effects equivocal; skill axis unoperationalised | A(synth)/— | DOI 10.3390/sports9020032 / gap | Key full-text sections |
| Q3-C01 | Proximity-to-failure dose-response dissociates strength/hypertrophy | A | DOI 10.1007/s40279-024-02069-2; PMID 38970765 | Full abstract + preprint text |
| Q3-C02 | ~30% 1RM floor for hypertrophy equivalence | A(synth) | DOI 10.1519/JSC.0000000000002200; DOI 10.3390/sports9020032 | Abstract + key sections |
| Q3-C03 | No head-to-head hard-sets-vs-tonnage proxy trial (gap) | — | none | searches |
| Q3-C04 | RPE≥8 ↔ ≤2 RIR region of smallest rating error (convergence, not validation) | A(linking) | DOI 10.1007/s40279-021-01559-x | as C08 |
| Q4-C01 | Calisthenic progressions raise 1RM | B | DOI 10.1519/JSC.0000000000002345; PMID 29466268 | PubMed abstract |
| Q4-C02 | Isometric progression vars: duration/intensity/angle; angle reliable dial | B− | DOI 10.1186/s40885-022-00232-3 | Full text sections |
| Q4-C03 | Isometric training largest SBP reduction (−8.24 mmHg) | A | DOI 10.1136/bjsports-2022-106503 | BJSM abstract |
| Q4-C04 | Eccentric gains largely mode-specific | A | DOI 10.1007/s40279-016-0628-4; PMID 27647157 | PubMed abstract |
| Q4-C05 | No quantification of variation-jump difficulty (gap) | — | none | searches |
| Q4-C06 | Cross-movement coefficient equating unvalidated → convention | — | none | searches |
| Q5-C01 | 1RM ICC med 0.97, CV med 4.2% [0.5–12.1] | A | DOI 10.1186/s40798-020-00260-z; PMID 32681399 | Full abstract + PMC tables |
| Q5-C02 | Rep-max test ICC 0.65–0.86; SEM 0.7–1.1 reps | C | DOI 10.1371/journal.pone.0268074 | PLOS abstract |
| Q5-C03 | Child 1RM MDC95 9–18% (ICC excellent) — illustrative only | C | DOI 10.3390/app11052204 | Full text |
| Q5-C04 | No persistence-window evidence (gap) | — | none | searches |
| Q5-C05 | No training-age variability comparison (gap; weak indirect stability) | — | none (+C01) | searches |
| Q6-C01 | Apps/trackers: SDM 0.350 [0.236–0.465], ≈1850 steps/d | A | DOI 10.1136/bjsports-2020-102892; PMID 33355160 | PubMed abstract |
| Q6-C02 | Measurement raises quantity, can cut enjoyment/engagement | B | DOI 10.1093/jcr/ucv095 | Duke repository abstract |
| Q6-C03 | Goal-gradient & illusory progress affect behaviour | B | DOI 10.1509/jmkr.43.1.39 | Title/metadata only — flagged weakest-area candidate |
| Q6-C04 | Self-weighing: −1.7 kg [−2.6, −0.8] in multicomponent; alone null | A | DOI 10.1186/s12966-015-0267-4; PMID 26293454 | Springer abstract + results |
| Q6-C05 | No fitness-app gaming study; no single-vs-multi metric study (gaps) | — | none | searches |
| Q8-C01 | All autoregulation modes raised 1RM (heterogeneous ES) | C(SR) | DOI 10.7717/peerj.10663; PMID 33520457 | Full abstract |
| Q8-C02 | RIR autoregulation > fixed over 12 wk | B | DOI 10.1519/JSC.0000000000003164; PMID 31009432 | Record only — read-limitation flagged |
| Q8-C03 | Autoregulation literature inconsistent; no framework/frequency guidance | B− | DOI 10.1007/s40279-020-01330-8 | PubMed key points |
| Q8-C04 | No empirical oscillation/ratchet reports; no frequency evidence (gaps/theoretical) | — | none | searches |
| Q7-C01 | Rep-max reliability figures (as Q5-C02) | C | DOI 10.1371/journal.pone.0268074 | PLOS abstract |
| Q7-C02 | Longer rests (>2 min) aid strength in trained (SR, no MA possible) | A(no-MA caveat) | DOI 10.1007/s40279-017-0788-x | Full text sections |
| Q7-C03 | Tempo/TUT: hypertrophy insensitive 0.5–8 s; >10 s inferior | A | DOI 10.1007/s40279-015-0304-0; PMID 25601394 | Full text sections + conclusion |

## Sources

Complete bibliographic records for every source actually cited (all identifiers verified via Crossref API or PubMed record on 2026-08-26):

1. Nuzzo JL, Pinto MD, Nosaka K, Steele J. Maximal Number of Repetitions at Percentages of the One Repetition Maximum: A Meta-Regression and Moderator Analysis of Sex, Age, Training Status, and Exercise. *Sports Med.* 2024;54(2):303–321. doi:10.1007/s40279-023-01937-7. PMID 37792272.
2. Halperin I, Malleron T, Har-Nir I, Androulakis-Korakakis P, Wolf M, Fisher J, Steele J. Accuracy in Predicting Repetitions to Task Failure in Resistance Exercise: A Scoping Review and Exploratory Meta-analysis. *Sports Med.* 2022;52(2):377–390. doi:10.1007/s40279-021-01559-x. PMID 34542869.
3. Hackett DA, Cobley SP, Davies TB, Michael SW, Halaki M. Accuracy in Estimating Repetitions to Failure During Resistance Exercise. *J Strength Cond Res.* 2017;31(8):2162–2168. doi:10.1519/JSC.0000000000001683. PMID 27787474.
4. Steele J, Endres A, Fisher J, Gentil P, Giessing J. Ability to predict repetitions to momentary failure is not perfectly accurate, though improves with resistance training experience. *PeerJ.* 2017;5:e4105. doi:10.7717/peerj.4105. PMID 29204323.
5. Zourdos MC, Klemp A, Dolan C, et al. Novel Resistance Training–Specific Rating of Perceived Exertion Scale Measuring Repetitions in Reserve. *J Strength Cond Res.* 2016;30(1):267–275. doi:10.1519/JSC.0000000000001049. PMID 26049792.
6. Helms ER, Brown SR, Cross MR, Storey A, Cronin J, Zourdos MC. Self-Rated Accuracy of Rating of Perceived Exertion-Based Load Prescription in Powerlifters. *J Strength Cond Res.* 2017;31(10):2938–2943. doi:10.1519/JSC.0000000000002097. PMID 28933716.
7. Lea JWD, O'Driscoll JM, Wiles JD, Coleman DA. Convergent Validity of Ratings of Perceived Exertion During Resistance Exercise in Healthy Participants: A Systematic Review and Meta-Analysis. *Sports Med Open.* 2022;8(1):30. doi:10.1186/s40798-021-00386-8.
8. Eston R, Evans HJL. The Validity of Submaximal Ratings of Perceived Exertion to Predict One Repetition Maximum. *J Sports Sci Med.* 2009;8(4):567–573. PMID 24149599. PMCID PMC3761544. (No publisher DOI located.)
9. Accuracy of Prediction Equations for Determining One Repetition Maximum Bench Press in Women Before and After Resistance Training. *J Strength Cond Res.* 2008;22(5). doi:10.1519/jsc.0b013e31817b02ad. PMID 18714230. (Juliano L et al.; author list not fully retrieved — title/journal/year verified.)
10. LeSuer DA, McCormick JH, Mayhew JL, Wasserstein RL, Arnold MD. The Accuracy of Prediction Equations for Estimating 1-RM Performance in the Bench Press, Squat, and Deadlift. *J Strength Cond Res.* 1997;11(4):211–213. doi:10.1519/00124278-199711000-00001. *(Metadata verified; results not read — see Q2 flag.)*
11. Richens B, Cleather DJ. The relationship between the number of repetitions performed at given intensities is different in endurance and strength trained athletes. *Biol Sport.* 2014;31(2):157–161. doi:10.5604/20831862.1099047. PMID 24899782.
12. Grgic J, Lazinica B, Garofolini A, Schoenfeld BJ, Saner NJ, Mikulic P. Test–Retest Reliability of the One-Repetition Maximum (1RM) Strength Assessment: a Systematic Review. *Sports Med Open.* 2020;6:31. doi:10.1186/s40798-020-00260-z. PMID 32681399.
13. Mitter B, Csapo R, Bauer P, Tschan H. Reproducibility of strength performance and strength-endurance profiles: A test-retest study. *PLoS ONE.* 2022;17(5):e0268074. doi:10.1371/journal.pone.0268074.
14. Sánchez J, et al. Test-Retest and Minimal Detectable Change in the Assessment of Muscle Strength and Muscle Power in Upper and Lower Extremity Exercises in 9- to 14-Year-Old Children. *Appl Sci.* 2021;11(5):2204. doi:10.3390/app11052204. *(Author list abbreviated from retrieval; title/journal/year verified.)*
15. Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW. Strength and Hypertrophy Adaptations Between Low- vs. High-Load Resistance Training: A Systematic Review and Meta-analysis. *J Strength Cond Res.* 2017;31(12):3508–3523. doi:10.1519/JSC.0000000000002200. PMID 28834797.
16. Schoenfeld BJ, Contreras B, Krieger J, et al. Resistance Training Volume Enhances Muscle Hypertrophy but Not Strength in Trained Men. *Med Sci Sports Exerc.* 2019;51(1):94–103. doi:10.1249/MSS.0000000000001764. PMID 30153194.
17. Morton RW, Oikawa SY, Wavell CG, et al. Neither load nor systemic hormones determine resistance training-mediated hypertrophy or strength gains in resistance-trained young men. *J Appl Physiol.* 2016;121(1):129–138. doi:10.1152/japplphysiol.00154.2016. PMID 27174923.
18. Davies T, Orr R, Halaki M, Hackett D. Dose–Response Modelling of Resistance Exercise Across Outcome Domains in Strength and Conditioning: A Meta-analysis. *Sports Med.* 2024;54(7):1755–1773. doi:10.1007/s40279-024-02006-3.
19. Robinson ZP, Pelland JC, Remmert JF, Refalo MC, Jukic I, Steele J, Zourdos MC. Exploring the Dose–Response Relationship Between Estimated Resistance Training Proximity to Failure, Strength Gain, and Muscle Hypertrophy: A Series of Meta-Regressions. *Sports Med.* 2024;54(9):2209–2231. doi:10.1007/s40279-024-02069-2. PMID 38970765.
20. Schoenfeld BJ, Grgic J, Van Every DW, Plotkin DL. Loading Recommendations for Muscle Strength, Hypertrophy, and Local Endurance: A Re-Examination of the Repetition Continuum. *Sports (Basel).* 2021;9(2):32. doi:10.3390/sports9020032.
21. Kotarsky CJ, Christensen BK, Miller JS, Hackney KJ. Effect of Progressive Calisthenic Push-up Training on Muscle Strength and Thickness. *J Strength Cond Res.* 2018;32(3):651–659. doi:10.1519/JSC.0000000000002345. PMID 29466268.
22. Smart NA, et al. An evidence-based guide to the efficacy and safety of isometric resistance training in hypertension and clinical implications. *Clin Hypertens.* 2023;29:4. doi:10.1186/s40885-022-00232-3. *(Author list abbreviated; title/journal/year verified.)*
23. Edwards JJ, Deenathaiyal S, Hill M, et al. Exercise training and resting blood pressure: a large-scale pairwise and network meta-analysis of randomised controlled trials. *Br J Sports Med.* 2023;57(20):1317–1326. doi:10.1136/bjsports-2022-106503. PMID 37491419.
24. Douglas J, Pearson S, Ross A, McGuigan M. Chronic Adaptations to Eccentric Training: A Systematic Review. *Sports Med.* 2017;47(5):917–941. doi:10.1007/s40279-016-0628-4. PMID 27647157.
25. Laranjo L, Ding D, Heleno B, et al. Do smartphone applications and activity trackers increase physical activity in adults? Systematic review, meta-analysis and metaregression of randomised controlled trials. *Br J Sports Med.* 2021;55(8):422–432. doi:10.1136/bjsports-2020-102892. PMID 33355160.
26. Etkin J, Inman JJ, Verhalen AB. The Hidden Cost of Personal Quantification. *J Consum Res.* 2016;42(6):967–984. doi:10.1093/jcr/ucv095.
27. Burke LE, Wang J, Sevick MA, et al. Is self-weighing an effective tool for weight loss: a systematic literature review and meta-analysis. *Int J Behav Nutr Phys Act.* 2015;12:104. doi:10.1186/s12966-015-0267-4. PMID 26293454.
28. Kivetz R, Urminsky O, Zheng Y. The Goal-Gradient Hypothesis Resurrected: Purchase Acceleration, Illusionary Goal Progress, and Customer Retention. *J Mark Res.* 2006;43(1):39–58. doi:10.1509/jmkr.43.1.39. *(Title/metadata verified; full text not read — flagged.)*
29. Larsen S, Kristiansen E, van den Tillaar R. Effects of subjective and objective autoregulation methods for intensity and volume on enhancing maximal strength during resistance-training interventions: a systematic review. *PeerJ.* 2021;9:e10663. doi:10.7717/peerj.10663. PMID 33520457.
30. Graham T, Cleather DJ. Autoregulation by "Repetitions in Reserve" Leads to Greater Improvements in Strength Over a 12-Week Training Program Than Fixed Loading. *J Strength Cond Res.* 2021;35(9):2451–2456. doi:10.1519/JSC.0000000000003164. PMID 31009432. *(Record verified; abstract not retrieved — read-limitation flagged.)*
31. Greig L, Stephens Hemingway BH, Aspe RR, Swinton PA, Ogden HB, McKendry JJ, Shillabeer BC, Davison GJ. Autoregulation in Resistance Training: Addressing the Inconsistencies. *Sports Med.* 2020;50(11):1873–1887. doi:10.1007/s40279-020-01330-8. PMID 32813181.
32. Grgic J, Lazinica B, Mikulic P, Krieger JW, Schoenfeld BJ. The Effects of Short versus Long Inter-Set Rest Intervals in Resistance Training on Measures of Muscle Hypertrophy: A Systematic Review. *Eur J Sport Sci.* 2017;17(8):1065–1073. — cited here via its strength-focused companion: Grgic J, Schoenfeld BJ, Skrepnik M, Davies TB, Mikulic P. Effects of Rest Interval Duration in Resistance Training on Measures of Muscular Strength: A Systematic Review. *Sports Med.* 2018;48(1):137–151. doi:10.1007/s40279-017-0788-x.
33. Schoenfeld BJ, Ogborn DI, Krieger JW. Effect of Repetition Duration During Resistance Training on Muscle Hypertrophy: A Systematic Review and Meta-Analysis. *Sports Med.* 2015;45(4):577–585. doi:10.1007/s40279-015-0304-0. PMID 25601394.

---

## Claim-count audit

- **Total ledger rows: 47** (44 discrete sourced factual claims + 3 inference rows labelled as such).
- **Sourced claims carrying a verified inline DOI or PMID: 36.**
- **Exceptions — 8 gap rows plus the 3 labelled inference rows (11 total), each flagged in-line as gap or inference rather than evidence.**
  - Gap rows (absence of evidence after targeted searching — the brief's sanctioned outcome, asserting no external fact): `Q2-C07` (RIR substitution unvalidated), `Q2-C14` (no e1RM MDC exists), `Q3-C03` (no proxy head-to-head), `Q4-C05` (variation-jump magnitude unquantified), `Q4-C06` (coefficient equating unvalidated), `Q5-C04` (no persistence window), `Q6-C05` (no fitness-app gaming / single-vs-multi metric evidence), `Q8-C04` (no empirical failure-mode or frequency evidence).
  - Inference rows (arithmetic or logical consequences of sourced claims, never presented as findings): `Q2-C15` (away-from-failure error compounding, derived from Q2-C08 + Q2-C02), `Q1-C05` second clause (skill axis unoperationalised — gap), and the gaming prediction in Q6 built on Q6-C03 + Q6-C02.
- No exception asserts an external fact as evidence; every one is either an absence statement or a labelled derivation.

## What could not be answered

| Subquestion | Reason |
|---|---|
| Minimal detectable change of the estimated-1RM series (Q2d, Q5) | Insufficient evidence — never derived in the literature; components never composed |
| Persistence window for a non-improving trend (Q5) | No verifiable source located — the construct appears nowhere as a measured statistic |
| Validation of the additive RIR→reps substitution (Q2b) | Insufficient evidence — premise-supported but never tested as specified |
| Magnitude of a leverage/variation jump (Q4) | No verifiable source located |
| Common scale for bodyweight and loaded work (Q4) | Non-transferable/insufficient — no validation attempts found; concept remains convention |
| Gaming of strength metrics in fitness apps (Q6) | No direct evidence — nearest analogies from consumer-behaviour experiments |
| Single-number vs multiple-metric comprehension (Q6) | No verifiable source located |
| Empirical autoregulation failure modes (oscillation/ratcheting) and adjustment frequency (Q8) | No verifiable source located — theoretical risks only |
| Training-age-stratified noise thresholds (Q5) | Non-transferable population — no direct comparative study |
| Timed-hold test-retest reliability outside laboratories (Q5) | Could not locate sources |

## Numbers that are not ratified recommendations

Every number below is reported evidence, not an adopted app value. None is ratified; adoption requires the owner's recorded ruling.

1. **0.95 reps (95% CI 0.17–1.73)** — mean RIR underprediction. Tier A. Population: 414 healthy adults, supervised acute tests. Source: DOI 10.1007/s40279-021-01559-x. *Not a ratified recommendation.*
2. **Between-participant SD 1.45 reps** — RIR prediction spread. Tier A. Same population/source. *Not a ratified recommendation.*
3. **SD 2.51 reps at 80% 1RM; 4.36 reps at 60% 1RM** — between-individual reps variability. Tier A. Population: 7,289 individuals, 269 studies. Source: DOI 10.1007/s40279-023-01937-7. *Not a ratified recommendation.*
4. **Mean absolute RPE error 0.33 ± 0.28** — powerlifters hitting target RPE. Tier B. Population: 12 competitive powerlifters. Source: PMID 28933716. *Not a ratified recommendation.*
5. **ICC median 0.97; CV median 4.2% (range 0.5–12.1%)** — 1RM test-retest. Tier A. Pooled n=1,595, supervised. Source: PMID 32681399. *Not a ratified recommendation.*
6. **SEM 0.7–1.1 reps; ICC 0.65–0.86** — rep-max test-retest. Tier C. n=24 trained adults. Source: DOI 10.1371/journal.pone.0268074. *Not a ratified recommendation.*
7. **MDC95 9–18%** — child 1RM tests; illustrative of ICC≠small-MDC only. Tier C, non-transferable age. Source: DOI 10.3390/app11052204. *Not a ratified recommendation and not applicable to the app's audience.*
8. **SDM 0.350 (95% CI 0.236–0.465); ~1,850 steps/day** — app/tracker activity effect. Tier A. Adults 18–65, general activity. Source: PMID 33355160. *Not a ratified recommendation.*
9. **−1.7 kg (95% CI −2.6 to −0.8)** — self-weighing within multicomponent programmes. Tier A. Weight-loss RCTs. Source: PMID 26293454. *Not a ratified recommendation.*
10. **−8.24 mmHg SBP** — isometric training vs control. Tier A network meta-analysis. 270 RCTs. Source: DOI 10.1136/bjsports-2022-106503. *Not a ratified recommendation; health outcome, not strength progression.*
11. **4×2-min holds at ~30% MVC, 3×/wk** — isometric protocol template from hypertension literature. Tier B− guide. Clinical populations. Source: DOI 10.1186/s40885-022-00232-3. *Not a ratified recommendation; cited only as evidence that duration/intensity/angle are the operative isometric variables.*
12. **~30% 1RM** — approximate floor for hypertrophy-equivalent loading. Tier A synthesis. Source: DOI 10.3390/sports9020032. *Not a ratified recommendation.*
13. **<10 RTF accuracy threshold** — prediction-equation accuracy boundary. Tier B. Young women, bench press. Source: PMID 18714230. *Not a ratified recommendation.*

## Sources published within the last 90 days

Cut-off determined at run time: 2026-08-26; the 90-day window opens 2026-05-28. **No included source falls within this period.** The newest included sources are Robinson et al. (September 2024 issue; online July 2024) and Davies et al. (2024). Nothing in this report rests on unverified recency.

## Weakest claim

**Q6-C03 — the goal-gradient/illusionary-progress claim** (Kivetz, Urminsky & Zheng 2006, *J Mark Res.*, DOI 10.1509/jmkr.43.1.39, Tier B). It is the weakest retained claim for three reasons: I was able to verify only the title, journal, year, and DOI — the full text and results were never read; its population and domain (retail loyalty purchases) are maximally distant from unsupervised strength training; and it is used in Q6 as one leg of an *analogy* about metric-gaming that the report explicitly labels inference. It survives in the report only because the gaming sub-question has no closer evidence, and it is quarantined as analogy rather than presented as fitness evidence. If any single claim should be disregarded wholesale, it is this one.
