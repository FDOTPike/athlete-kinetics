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

**[S12] Session-adjacent HR features are only beginning to be modeled — and only classifies intensity bands.**
Smiley et al. 2023 (AMIA Annu Symp Proc 2023:653–662; PMC10785938): ML on ECG, SpO2, pulse rate, RPM during 16-minute cycling predicted 3 exertion levels from wearables — 71.04% accuracy (nuSVM), 68.10% (RF), F1 ≈ 0.4–0.6. Modality: cycling; labels: coarse exertion classes. Applicability: the strongest published ML-biometric→exertion result we located is a 3-band classifier on a bike at ~71% — nowhere near a set-RPE estimator, and it used *one modality label per minute*, not per set.

**[S14–S17] HRV: stress-sensitive, individually variable, day-scale.**
Cardiac vagal tone basis (Laborde, Mosley & Thayer 2017, Front Psychol 8:213, doi 10.3389/fpsyg.2017.00213, PMC5316555 — recommendations review used for orientation); stress meta-analysis (Kim et al. 2018, Psychiatry Investig 15(3):235–245, PMID 29486547): group-level HRV changes under psychological stress with wide metric/individual variability; day–night HRV differences vary with age and cardiopulmonary disease (Ma et al. 2023, J Clin Sleep Med 19(3):563–574, PMID 36692177); sleep-deprivation HRV meta-analysis (Zhang et al. 2025, Front Neurol 16:1556784, PMID 40895095) finds heterogeneous effects across HRV metrics. Applicability: HRV is a legitimate day-scale readiness input (as the app already uses it) and is simultaneously useless as a per-set effort signal — different timescale, different construct.

## 5. Sleep, SpO2, and wearables

**[S19] Consumer sleep staging is materially unreliable.**
Lee et al. 2023 (JMIR Mhealth Uhealth 11:e50983; doi 10.2196/50983): prospective multicenter validation of 11 consumer sleep trackers vs polysomnography (n = 34 young healthy adults per protocol); total-sleep-time MAPE ≈ 10–20% and sleep/wake accuracy ≈ 84–91%, but stage agreement very poor (deep/REM Cohen's κ ≈ 0.05–0.38 depending on device). Applicability: the app's consumed quantity (sleep efficiency from in-bed/asleep minutes) sits on the *more* reliable side (TST/wake), while deep/REM minutes — which the app also ingests — must never be described as validated physiology.

**[S20] Sleep and athletic performance: review-level support for a capacity effect.**
Watson 2017 / Sleep Med Clin (PMC9960533; sleep-and-athletic-performance review): insufficient sleep degrades physical and cognitive performance and elevates injury risk in athlete populations — review evidence, not a measurement model. Applicability: supports sleep as a *readiness input* (already ratified [R01, R01b]); supports nothing about grading effort.

**[S13] Smartwatch SpO2 can detect short-time hypoxemia — under controlled conditions.**
Rafl et al. 2022 (Digit Health 8:20552076221132127; PMID 36249475): 24 healthy adults; Apple Watch Series 6 vs Masimo Radical-7 during controlled breathing-circuit desaturation; the watch detected short-time hypoxemia comparably to the reference in this protocol. Applicability: one device, one protocol, healthy volunteers — and still no connection whatsoever to resistance-training effort.

**[S18] Consumer SpO2 shows systematic bias in broader data.**
iScience 2023 (26(3):106153; "Evaluating blood oxygen saturation measurements by popular fitness trackers in postoperative patients: a prospective clinical trial"; doi 10.1016/j.isci.2023.106153; **author list not verified this run — cite by DOI**; publisher's own Highlights state the headline numbers): fitness-tracker SpO2 was merely "tolerable" vs arterial blood gas (RMSE ≈ 4%; Pearson correlation 0.46–0.64) in postoperative patients; Lancet Respir Med comment (Zhang & Khatami 2022, 10(5):e47–e48, PMID 35358426) cautions against trusting consumer smartwatch SpO2. Applicability: reinforces the do-not-collect disposition — accuracy concerns plus zero effort relevance.

**[S21] Wrist HR accuracy varies by device, activity, and individual factors (review).**
Accuracy of Wrist-Worn Heart Rate Monitors: A Comprehensive Review (Quality of Sport Sciences / UMCS journal apcz.umk.pl QS, 2024) — located via search; full text not extracted this run. Used only as corroborating orientation for [S09]; no numeric claim rests on it. Marked UNRESOLVED for quantitative use.

## 6. ML-biometric RPE prediction: the direct evidence search

**[S12]** (above) is the best-matched primary result: wearable physiology → 3-band exertion classification, cycling, ~71% accuracy.
**[S22]** Zhang/derived ML stress-episode prediction from wearable sensor data — systematic review (Comput Biol Med, 2025, via ScienceDirect listing): stress episodes from wearables remain a classification problem with heterogeneous results; not fully extracted (UNRESOLVED for numbers).
**Search verdict:** no located study demonstrates per-set resistance-training RPE estimation from watch/phone biometrics with athlete-level validity. The arXiv preprint on inertial-sensor RPE estimation for bicep curls (arXiv:2510.03197) exists but is a non-peer-reviewed preprint on a single-joint exercise with lab sensors — it is evidence that *research is starting*, not evidence that *it works*; it is recorded in the manifest as context [S23] and supports no claim here.

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

## 8. UNRESOLVED claims register

- **[S05] pooled reps-to-failure estimation error** — review identified, quantitative values not independently extracted; nothing depends on it.
- **[S21] wrist-HR review numeric ranges** — corroborative only; [S09] carries the numbers.
- **RHR → set RPE** — no primary source located; treated as UNRESOLVED; the app stores RHR as descriptive data only (§1 Construct Map).
- **Talk test → resistance sets** — no primary source located for strength work; construct excluded from any quantitative role.
- **[S23] arXiv inertial RPE preprint** — non-peer-reviewed; recorded as research-landscape context only.

## 9. What this evidence base supports (and forbids)

Supports: manual RPE/RIR instrumentation with plain-language anchors [S01–S03, R05]; a post-session session-RPE prompt as subjective internal load [S07, S08]; subjective cue entry [S10]; HRV/sleep as day-scale readiness inputs under the ratified policy [R01b, S14–S20].

Forbids: any device-biometric → set-RPE conversion claim [S04, S09, S11–S13, S18, S19, S22]; population coefficients as individual truth; SpO2 collection for effort purposes; medical or prognostic framing of any in-app signal [S11].
