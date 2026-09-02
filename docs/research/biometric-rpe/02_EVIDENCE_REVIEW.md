# 02 — Evidence Review

Scope: every material scientific claim used across this discovery, reviewed against primary sources or authoritative standards. Each numbered finding carries its manifest ID from `03_SOURCE_MANIFEST.csv`. Claims that could not be verified against a retrievable source are marked UNRESOLVED and carry no weight anywhere in this deliverable set.

**Search execution note (disclosure):** literature identification used web search engines (Google/Bing-backed `web_search` queries, 2026-09-02) followed by direct extraction of PubMed/PMC/journal pages to confirm bibliographic identity, population, methods, and results. This is a structured desk review, not a systematic review with dual independent screening; it should not be represented as one.

## 1. The subjective effort constructs (what the app already uses)

**[S01] The resistance-training RPE scale is a validated instrument for trained lifters.**
Zourdos et al. 2016 (J Strength Cond Res 2016 Jan;30(1):267–275; doi 10.1519/JSC.0000000000001049; PMID 26049792) developed the RIR-anchored 0–10 scale in 29 squatters (15 experienced, training age 5.2±3.5 y; 14 novice, 0.4±0.6 y), showing a strong inverse velocity–RPE relationship in experienced (r = −0.88) and novice (r = −0.77) lifters across 60–90% 1RM. Population: young experienced/novice squatters; single-joint/compound squat only. Applicability: supports the app's existing RPE stepper and its RIR-anchored cue copy as a defensible instrument; it does not support deriving the number from anything but the athlete.

**[S02] The application literature recommends RIR-based RPE for resistance training.**
Helms, Cronin, Storey & Zourdos 2016 (Strength Cond J 38(4):42–49; doi 10.1519/SSC.0000000000000218) — a narrative/practical review, used here only for orientation of scale use (WO rule: numerical claims do not rest on it).

**[S03] Perceptual accuracy degrades away from failure and by exercise.**
Hackett et al. 2017 (J Strength Cond Res 31(8):2162–2168; PMID 27787474): 81 adults (53 M / 28 F), chest press 70% 1RM and leg press 80% 1RM, up to 10 sets of 10 with estimated-then-actual repetitions to failure. ERF error ≈1 repetition at actual-RIR 0–5 but >2 repetitions at RIR 7–10; chest press more accurate than leg press; training experience did not affect accuracy. Applicability: the app's "about N good reps left" cues are honest *guides*, and any future advisory estimate inherits this noise floor: an estimate claiming ±0.5 RIR resolution is beyond what the perceptual system itself resolves at high RIR.

**[S04] Velocity tracks RPE/RIR — in equipped lab conditions.**
Zourdos 2016 velocity findings [S01] plus Paulsen et al. 2025 (PeerJ 13:e19797; doi 10.7717/peerj.19797) in strength-trained individuals: the velocity–RIR relationship is moderated by exercise type, load, velocity-loss threshold, and set number. No phone-native measurement exists; the app has no transducer. Applicability: velocity is a research instrument here, not a product capability.

**[S05] Reps-to-failure estimation has a documented error literature.**
Halperin et al. 2022 scoping review/exploratory meta-analysis (Sports Med 52(2):377–390; PMID 34542869), identified via search but not fully extracted this run — identity verified (title/journal/PMID via PubMed listing); exact pooled effects are cited secondhand through [S03]/[S06] and marked UNRESOLVED for direct quantitative use. Nothing in this deliverable set rests on it.

**[S06] Perceptual fatigue further degrades estimation accuracy.**
Hackett DA, Selvanayagam VS, Halaki M, Cobley SP. Associations between Perceptual Fatigue and Accuracy of Estimated Repetitions to Failure during Resistance Exercises. J Funct Morphol Kinesiol 2019;4(3):56; doi 10.3390/jfmk4030056; PMID 33467371 (identity verified via PubMed metadata; sample size not extracted this run). Companion to [S03]: higher perceived fatigue is associated with poorer reps-to-failure estimation — a first-class confounder for any future advisory design. The exercise-class (upper-body > lower-body) and experience findings themselves come from [S03].

## 2. Session-level subjective load

**[S07] The Foster session-RPE method is valid for quantifying internal load across modalities.**
Foster et al. 2001 (J Strength Cond Res 15(1):109–115; PMID 11708692): session RPE × duration tracked an HR-based objective standard consistently across steady-state cycle, interval cycle, and basketball, though absolute scores differed. Applicability: supports a *post-session subjective session-RPE prompt* as a legitimate, low-burden internal-load index — while implying nothing about per-set biometric estimation.

**[S08] Session RPE holds in high-intensity functional training.**
Tibana et al. 2018 (Sports 6(3):68; doi 10.3390/sports6030068): 16 men (recreational CrossFit background), session RPE validated against HR-derived load across three HIFT sessions. Small, male, single-modality sample — supporting evidence, not a universal guarantee.

## 3. Subjective proxy cues

**[S10] The talk test tracks aerobic intensity.**
Review, J Exerc Rehabil 2023;19(3):163–169 (doi 10.12965/jer.2346.068; PMC10331140): talk test status aligns with ventilatory/lactate thresholds across healthy populations. Endurance-based; no resistance-set validity. Applicability: the app's existing copy ("rough guides, not targets" [R05]) is the correct strength framing; breathing/talk cues may be offered as subjective athlete-entered observations only.

## 4. The physiological signals (why they cannot grade set RPE)

**[S11] Heart-rate recovery's evidence base is prognostic, not effort-related.**
Cole et al. 1999 (N Engl J Med 341(18):1351–1357; PMID 10536127): 2,428 consecutive adults referred for diagnostic exercise testing (mean age 57±12 y); blunted 1-min HRR (≤12 bpm) predicted all-cause mortality (adjusted RR 2.0, 95% CI 1.5–2.7). Modality: graded treadmill/pharmacology-adjacent clinical testing. Applicability: none for resistance set effort; using HRR in-app would import mortality-adjacent medical semantics the app must never imply.

**[S09] Wrist optical HR is unreliable in intense exercise; chest ECG is the criterion.**
Martín-Escudero et al. 2023 (Bioengineering 10(2):254; doi 10.3390/bioengineering10020254): wrist devices during intense free-running exercise reached MAPE up to ~18.66% vs ECG; agreement degrades with intensity and motion. Population: healthy adults; modality: running/intense exercise; method: wrist PPG vs 12-lead/monitor ECG. Applicability: the exact motion signature of strength work (grip, flexed wrist, Valsalva, interval structure) sits in the device's worst regime; per-set HR features are unreliable before any modeling begins.

**[S12] Session-window physiological features classify only coarse exertion bands — in a small cycling study.**
Smiley et al. 2023 (AMIA Annu Symp Proc 2023:653–662; PMC10785938; PMID 38222331) — **corrected per independent audit against the primary paper**: ten healthy adults (21–61 y, 60% female), 16-minute supervised cycling on an instrumented bike, chest ECG (Actiheart 5) + wrist pulse oximeter (WristOx2) + RPM; each 16-min session divided into eight 2-minute windows; RPE (revised 1–10 Borg) reported once per minute; each window labeled **two-class** — high vs low exertion at an RPE threshold of 3.5; the previous window's features predict the next window's label; 70 predictor rows (7 windows × 10 users), random 20% test split. Best test result: **k-nearest neighbors 85.7% accuracy, F1 83%, AUC 0.92 (ensemble)** for the two-class problem. Applicability: the strongest published wearable-physiology→exertion *classification* result located, and it is a two-band, per-2-minute-window, lab-instrumented, 10-participant, single-modality (cycling) result — not a per-set RPE estimator and not a three-band one. **All earlier "three-band, ~71%" descriptions in this document set were wrong and have been removed** (remediation record: `09` §12).

**[S14–S17] HRV: stress-sensitive, individually variable, day-scale.**
Cardiac vagal tone basis (Laborde, Mosley & Thayer 2017, Front Psychol 8:213, doi 10.3389/fpsyg.2017.00213, PMC5316555 — recommendations review used for orientation); stress meta-analysis (Kim et al. 2018, Psychiatry Investig 15(3):235–245, PMID 29486547): group-level HRV changes under psychological stress with wide metric/individual variability; day–night HRV differences vary with age and cardiopulmonary disease (Ma et al. 2023, J Clin Sleep Med 19(5):873–882, PMID 36692177; citation corrected per audit — the 19(3):563–574 pagination in the first freeze was wrong); sleep-deprivation HRV meta-analysis (Zhang et al. 2025, Front Neurol 16:1556784, PMID 40895095) finds heterogeneous effects across HRV metrics. Applicability: HRV is a legitimate day-scale readiness input (as the app already uses it) and is simultaneously useless as a per-set effort signal — different timescale, different construct.

## 4b. Direct resistance-training RPE/fatigue estimation research (added in remediation; identities corrected per second audit)

The first freeze missed the direct resistance-training literature below. The independent audit required these to be reviewed and explicitly bounded before any negative evidence-landscape conclusion. All four ([S25]–[S28]) are now verified against their primary publisher records; none changes the decision token, but all four change what "no evidence" is allowed to mean.

**[S25] PERSIST — a public multimodal resistance-training RPE dataset (the closest direct match).**
Albert JA, Herdick A, Brahms CM, Granacher U, Arnrich B (author list per the publisher's own APA citation; **corrected per second audit** — the first remediation carried an unverified, wrong author list), "PERSIST: A Multimodal Dataset for the Prediction of Perceived Exertion during Resistance Training," Data 2023;8(1):9; doi 10.3390/data8010009; published 2022-12-28. Sixteen young healthy men screened, twelve consenting to open data; twelve flywheel-squat sets × 12 reps with lactate-confirmed fatigue; **set-level RPE reported after each set**; synchronized IMU + ECG + motion capture + HRV parameters. What it shows: per-set RPE prediction from body-worn sensors is an active, resourced research direction with a public dataset. What it does not show: any validated product-grade estimator; a single exercise on a lab flywheel platform; a small homogeneous male cohort; lab instrumentation (ECG, MoCap) far beyond what any consumer wearable or phone provides. Applicability bound: demonstrates feasibility *research*, not consumer-device validity; directly informs the `06` pilot design (labels per set; lactate-anchored fatigue substudy analog).

**[S26] Computer-vision monitoring of fatigue and RPE during resistance training.**
Albert JA, Arnrich B. "A computer vision approach to continuously monitor fatigue during resistance training." Biomedical Signal Processing and Control 2024;89:105701; doi 10.1016/j.bspc.2023.105701 (**title and authors corrected per second audit** — the first remediation attached the wrong paper to this DOI): 16 subjects performed flywheel-squat exercises recorded by two Azure Kinect cameras; skeleton-feature ML predicted generated power and set-level RPE; Gradient Boosting Regression Trees best predicted perceived exertion with mean absolute percentage error 8.08% and Spearman ρ = 0.74. Bound: multi-camera lab vision, flywheel platform, single exercise — no consumer-phone capability; supports no product claim.

**[S27] ML fatigue/RPE estimation during repeated isokinetic bench press (RPE-labeled).**
Baek JY, Kwon JH, Khan H, Lee MC. "Machine Learning-Driven Muscle Fatigue Estimation in Resistance Training with Assistive Robotics." Sensors 2025;25(**21**):6588; doi 10.3390/s25216588; PMID 41228812 (**issue and authors corrected per second audit** — the first remediation printed 25(20) and no authors): 32 healthy men (age 33.2±5.9; 64 limb datasets), seven sets at a standardized 7RM load on the XIM isokinetic robotic bench press, load-cell force–time features paired with RPE labels; RF reached R² 0.84, MAE 0.62 RPE, 93.1% of predictions within ±1 RPE. What it shows: with a robotic system's *embedded force sensor* (a device-integrated mechanical measurement, not a body-worn biometric), continuous fatigue/RPE estimation reaches ~±0.6 RPE MAE. What it does not show: anything about wrist HRV/SpO2-class signals, free-weight settings, or phone-only collection.

**[S28] Wearable-sensor RPE prediction with HRV features (IEEE BIBM 2021) — the closest published step toward this app's question.**
Albert JA, Herdick A, Brahms CM, Granacher U, Arnrich B. "Using Machine Learning to Predict Perceived Exertion During Resistance Training With Wearable Heart Rate and Movement Sensors." 2021 IEEE International Conference on Bioinformatics and Biomedicine (BIBM), Houston TX; doi 10.1109/BIBM52615.2021.9669577 (**added per second audit** — missed by both the first freeze and the first remediation): 16 participants performed flywheel squats wearing six IMUs and an ECG sensor; regressors (SVR, RF, GBRT) predicted per-set RPE — best model mean absolute percentage error 7.71%, Pearson r = 0.85, R² = 0.48; ECG-derived HRV parameters **significantly improved** prediction, with the training-impulse (TRIMP) parameter the most informative feature. What it shows: in lab conditions, HRV features carry genuine *incremental* signal for per-set RPE prediction beyond movement alone — the direct motivation for the `06` §7 incremental-biometric ablation. What it does not show: anything about consumer watches or phones — "wearable" here means six research-grade IMUs plus chest ECG on a flywheel platform, single exercise, small cohort.

**Bounded negative conclusion (replaces the first freeze's overreach; refined after the second audit):** the direct resistance-training literature now on file ([S25], [S26], [S27], [S28]) establishes that per-set RPE/fatigue prediction from sensors is a **live, productive research area** — lab MAPEs of ~7.7–8.1% RPE and MAE ≈ 0.62 RPE under ECG/MoCap/load-cell/vision instrumentation, small homogeneous cohorts, single-exercise protocols — and [S28] shows HRV features add incremental value in that setting. What remains unproven is the specific claim this discovery needed to test: that **consumer-watch/phone biometrics** (the modality this app could actually collect, `04`) can estimate per-set resistance-training RPE with athlete-level validity. The evidence gap is *modality-and-setting-specific*, not a general absence of research.



## 5. Sleep, SpO2, and wearables

**[S19] Consumer sleep-stage classification is materially unreliable — and the first freeze misreported this study's numbers.**
Lee T, Cho Y, Cha KS, et al. 2023 (JMIR Mhealth Uhealth 11:e50983; doi 10.2196/50983; PMID 37917155) — **corrected per audit against the primary paper**: 75 adults aged 19–70 (39 M / 36 F; mean age 43.6±14.1), recruited through a tertiary hospital sleep lab (Seoul National University Bundang Hospital, n=37, scheduled polysomnography for sleep disorders) and a primary-care clinic via online recruitment (n=38) — **not "34 young healthy adults,"** and **not** the source of the "MAPE 10–20% / accuracy 84–91%" figures the first freeze attributed to it (those numbers do not appear in this paper). The study's actual reported results, four-stage epoch-by-epoch classification vs polysomnography across 11 consumer devices: accuracy 0.2830–0.7106, macro F1 0.2588–0.6863, Cohen's κ 0.0741–0.5565; the best wearables reached only moderate stage agreement (κ 0.4–0.6: Google Pixel Watch, Galaxy Watch 5, Fitbit Sense 2), others fair or slight. Applicability: consumer sleep **stage** data is demonstrably heterogeneous and only moderately reliable at best; the app's consumed quantity (sleep efficiency from in-bed/asleep minutes) is closer to the better-validated total-sleep-time/wake side than to stage classification, but deep/REM minutes ingested via Health Connect must never be described as validated physiology.

**[S20] Sleep and athletic performance: review-level support for a capacity effect.**
Charest J, Grandner MA. Sleep Med Clin 2020 Mar;15(1):41–57; doi 10.1016/j.jsmc.2019.11.005; PMCID PMC9960533 (author/year **corrected per audit** — the first freeze's "Watson 2017" attribution was wrong): insufficient sleep and poor sleep quality are prevalent among athletes and degrade physical performance, cognition, and recovery — review evidence, not a measurement model. Applicability: supports sleep as a *readiness input* (already ratified [R01, R01b]); supports nothing about grading effort.

**[S13] Smartwatch SpO2 can detect short-time hypoxemia — under controlled conditions.**
Rafl et al. 2022 (Digit Health 8:20552076221132127; PMID 36249475): 24 healthy adults; Apple Watch Series 6 vs Masimo Radical-7 during controlled breathing-circuit desaturation; the watch detected short-time hypoxemia comparably to the reference in this protocol. Applicability: one device, one protocol, healthy volunteers — and still no connection whatsoever to resistance-training effort.

**[S18] Consumer SpO2 shows systematic bias in broader data.**
Helmer P, Rodemers P, Hottenrott S, Leppich R, et al. iScience 2023;26(11):108155; doi 10.1016/j.isci.2023.108155; PMC10590865 (citation **corrected per audit** — the first freeze carried a wrong DOI, issue, and article number, and an unverified author line): 112 postoperative patients (24–92 y, median 68) measured with three consumer trackers (Apple Watch 7, Garmin Fenix 6 Pro, Withings ScanWatch) against arterial blood gas and transmissive pulse oximetry at rest; tracker SpO2 underestimated saturation by ~1–3% on average vs SaO2, with substantial measurement dropout (up to 48% of attempted readings on one device); publisher's own Highlights characterize accuracy as "tolerable" (RMSE ≈ 4%; Pearson r 0.46–0.64 vs arterial blood gas). Companion comment: **[S24]** Zhang Z, Khatami R. Can we trust the oxygen saturation measured by consumer smartwatches? Lancet Respir Med 2022 May;10(5):e47–e48; doi 10.1016/S2213-2600(22)00103-5; PMID 35358426 — an independent caution on consumer smartwatch SpO2 trustworthiness (now its own manifest row; the first freeze wrongly attached this citation to [S21], a wrist-HR review). Applicability: reinforces the do-not-collect disposition — accuracy concerns, device dropout, and zero effort relevance.

**[S21] Wrist HR accuracy varies by device, activity, and individual factors (review).**
Paluch K, Szypuła Z, Nowak A, et al. Accuracy of Wrist-Worn Heart Rate Monitors: A Comprehensive Review of Smartwatches in Exercise Monitoring. Quality of Sport Sciences (Nicolaus Copernicus University, apcz.umk.pl/QS) 2024; review covering studies with >900 total participants (identity via publisher page and DOAJ 704da2e5ca484d7bbb8f51d920eed847). Used only as corroborating orientation for [S09]; no numeric claim rests on it. Marked UNRESOLVED for quantitative use. **Correction note:** this row must not be cited for SpO2 claims — the Zhang & Khatami SpO2 comment is [S24].

## 6. ML-biometric RPE prediction: the direct evidence search (verdict revised in remediation)

The search verdict in the first freeze ("no located study demonstrates per-set resistance-training RPE estimation from watch/phone biometrics with athlete-level validity") was **overbroad and has been withdrawn** — it rested on a missed literature (§4b). The corrected landscape:

- **Direct resistance-training estimation exists and is productive in the lab:** set-level RPE prediction on public multimodal data ([S25] PERSIST), continuous fatigue/RPE monitoring via camera vision ([S26], MAPE 8.08%, ρ = 0.74), load-cell fatigue/RPE estimation reaching MAE ≈ 0.62 RPE / 93.1% within ±1 RPE on a robotic bench press ([S27]), and **[S28] — wearable IMU+ECG prediction with per-set labels where ECG-derived HRV features significantly improved accuracy (best MAPE 7.71%, r = 0.85, R² = 0.48)**.
- **None of it validates the modality this app could actually collect:** every direct study relies on instrumentation beyond consumer reach (six research IMUs + chest ECG, camera rigs, embedded robotic load cells), small homogeneous cohorts, and single flywheel/robotic exercises.
- **The consumer-modality result remains S12** — a two-class (high/low exertion, RPE 3.5 threshold), 2-minute-window, n=10 cycling classification (best 85.7% KNN) — which is not a per-set resistance-training result. (The phrase "consumer-modality ceiling" was retired per the second audit: S12 bounds what adjacent consumer-collectable modalities have demonstrated; it is not a proven limit on what could ever be achieved.)
- The arXiv preprint on inertial-sensor RPE estimation for bicep curls ([S23], arXiv:2510.03197) remains non-peer-reviewed landscape context. Adjacent ML-classification context: stress-episode prediction from wearable sensor data ([S22], Pataca AO, Zdravevski E, et al., Comput Biol Med 2025;198(Pt A):111166, PMID 41061390 — systematic review, values UNRESOLVED for quantitative use) remains heterogeneous classification work.

**Corrected verdict:** it is unproven — not disproven — that consumer-watch/phone biometrics can estimate per-set resistance-training RPE with athlete-level validity. The evidence base is too thin and too instrumented-lab-bound to justify a product estimate, and equally too active and HRV-positive ([S28]) to justify the stronger NO-GO claim that the direction is unscientific. This is exactly the question the `06` pilot — now designed around an incremental-biometric ablation (§7) — is meant to test, and why the token is RESEARCH PILOT ONLY.

## 7. Repository claim verification (WO §2 — checked, not assumed)

| WO starting claim | Verified | Evidence |
|---|---|---|
| `packages/biometrics/src/healthConnect.ts` provides an optional Android Health Connect bridge | YES | graceful-degradation bridge, `tryCreateHealthConnectBridge`, Android guard, SDK check [R01] |
| `packages/biometrics/src/aggregate.ts` compacts supported daily records | YES | pure `aggregateDaily`, one row/day, never throws [R01] |
| `packages/biometrics/test/verify_biometrics.mjs` protects aggregation | YES | gate file exists in `packages/biometrics/test/` |
| `apps/mobile/src/state/useStore.ts` imports optional readiness data, works without it | YES | `biometricsStatus` machine (`off/unavailable/idle/denied/ready`), null-bridge = subjective-only path [R01] |
| `ReadinessScreen.tsx` presents readiness separately from actual set RPE | YES | readiness classification + disclosure surface, no RPE element [R01] |
| `SessionScreen.tsx` records actual RPE only after athlete interaction | YES | `rpeTouched` gate → `safeRpe = rpeTouched ? clamp(...) : null` [R03] |
| `docs/ANALYSIS_ios_biometrics_gap.md` contains prior platform/SpO2 analysis | YES | Health Connect per-data-type justification enforcement context; iOS gap options A/B/C [R02] |
| Calibration Policy v1 / existing readiness not silently expanded | YES | readiness = HRV+sleep only, SpO2 weight 0.00, ACWR removed [R01, R01b]; this discovery proposes no policy change |

## 8. UNRESOLVED claims register (rebuilt in remediation)

Partially verified — identity/DOI confirmed, remaining fields flagged; **no numeric claim in this document set rests on any row in this list**:

- **[S05]** pooled reps-to-failure estimation error (Halperin et al. 2022, Sports Med 52:377–390) — review identified, quantitative values not independently extracted.
- **[S06]** perceptual-fatigue/ERF-accuracy association (Hackett et al. 2019, J Funct Morphol Kinesiol 4(3):56) — PubMed-verified identity; sample size not extracted.
- **[S21]** wrist-HR review (Paluch et al. 2024, Quality of Sport Sciences) — publisher/DOAJ identity; numeric ranges not extracted.
- **[S22]** wearable stress-episode ML review (Pataca et al. 2025, Comput Biol Med) — PMID-verified identity; values not extracted.
- **[S23]** arXiv:2510.03197 inertial RPE preprint — non-peer-reviewed; landscape context only.
- ([S26] was on this list after round 1 — its full text was bot-walled at the time; it is now fully extracted from the publisher page and moved out of this register per the second audit.)

**RHR → set RPE** — no primary source located; UNRESOLVED. RHR's exact current handling [R09]: requested and read; stored alongside an `hrv_daily` row when that day's rMSSD exists, otherwise only updating an already-existing row (and not persisted at all when none exists); contributing nothing to readiness, planned load, planned sets, or the RPE cap; exposed through `loadMeasuredHistory`; and counted toward the developer-facing `hrvDays` diagnostic availability window — with **no athlete-facing consuming feature** (`00` §6, `01` §8, `05` §0).
**Talk test → resistance sets** — no primary source located for strength work; construct excluded from any quantitative role.

## 9. What this evidence base supports (and forbids)

Supports: manual RPE/RIR instrumentation with plain-language anchors [S01–S03, R05]; a post-session session-RPE prompt as subjective internal load [S07, S08]; subjective cue entry [S10]; HRV/sleep as day-scale readiness inputs under the ratified policy [R01b, S14–S20].

Forbids: any consumer-device-biometric → set-RPE conversion claim today [S12 is the only consumer-adjacent result and it is two-class at 2-minute windows; S25–S28 are lab-instrumented only]; population coefficients as individual truth; SpO2 collection for effort purposes [S13, S18, S24]; medical or prognostic framing of any in-app signal [S11]. The bounded scope of every negative statement is set in §4b and §6.
