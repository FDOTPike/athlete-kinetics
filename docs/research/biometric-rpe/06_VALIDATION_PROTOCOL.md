# 06 — Validation Protocol (Prospective, Athlete-Separated, Owner-Gated)

Status: a design for a research pilot, authorized by the decision token (RESEARCH PILOT ONLY) as the only forward artifact of this discovery. It is **not** ratified for execution: running it requires the owner's separate approval, an ethics/consent review, and a domain-expert sign-off named in §11. It produces no athlete-facing behavior and holds no prescription authority — the output is knowledge, gated before it could ever become product.

Design purpose: determine whether any individually calibrated advisory effort estimate is *measurable* in this app's population and modality — before anyone debates shipping one. The pilot is designed so that "no" is a publishable, actionable outcome.

## 1. Target label and collection timing

- **Primary label:** athlete-entered set RPE (RIR-anchored 0–10) captured at set logging time in the existing flow [R03]. Rationale: it is the construct any advisory would estimate (01 §1), and it is already collected with honest null semantics.
- **Secondary labels:** estimated RIR at set end (0–5 band scale to keep the athlete away from noise-dominated high-RIR ranges [S03]); post-session session RPE ~30 min after session end per the Foster convention [S07]; optional subjective cue tags (breathing/talk/form) as separate fields, never mixed into the RPE label.
- **Label timing rule:** the label must be captured *before any biometric feature for that set is shown or computed* — the pilot never puts a number in front of the athlete that could anchor their report. Ordering is enforced by capture order, recorded per event.
- **Prediction target definition (pre-registered):** set-level RPE as a continuous value; a coarse-band classification (≤7.5 / 8–8.5 / ≥9, matching the app's cue bands [R05]) is the *maximum* granularity a future product could honestly attempt, per the [S12] ceiling.

## 2. Participants: tiers, separation, and leakage control

- **Tiers:** beginner (<6 months), intermediate (6 months–2 years), advanced (>2 years), mirroring the app's training-age slots. Target n ≥ 20 per tier for pooled stability; individual-calibration sub-study (§7) targets n ≥ 10 per tier with ≥ 10 rated sessions each. These are design targets for power discussion, **not validated acceptance thresholds** — final numbers belong to the owner/domain-expert gate (§11).
- **Exercise modalities (stratified, never pooled silently):** squat-pattern barbell; horizontal press; vertical press; hip hinge; bodyweight work; conditioning finishers. The stratification exists because estimation accuracy differs by movement class and muscle mass [S03].
- **Training/holdout separation to prevent identity leakage:** athletes are partitioned into train and holdout groups **at the athlete level** — every session and set from one athlete lives entirely on one side. Model fitting never sees holdout athletes' data. Per-athlete calibration evaluation (§7) is reported separately from pooled evaluation; a pooled number that hides per-athlete failure is the identity-leakage failure mode this section exists to kill.
- **Inclusion/exclusion:** adults; no known cardiovascular, respiratory, or metabolic conditions that exercise stress could aggravate (safety screen); no medications materially affecting HR/HRV when the HRV/HR arm is analyzed; athletes under 18 excluded outright.
- **Withdrawal:** any athlete may stop at any time with data deleted on request (05 §4); withdrawal is recorded, not imputed around.

## 3. Manual RPE/RIR reference protocol (the ground truth discipline)

- Reference = the athlete's own report, collected per §1. There is **no external physiologic ground truth for perceived effort** — the pilot validates whether biometrics can *predict the athlete's report*, not whether biometrics know "true" effort. Any writeup must say exactly this.
- Anchor training: each athlete gets one standardized orientation on the RIR-anchored scale (the app's existing cue bands [R05]) to reduce scale-usage variance; no coaching of answers afterward.
- Failure-test sets are **not** part of routine collection (safety and ecological validity); a small optional substudy may use controlled near-failure sets to calibrate the RIR anchor against reality [S03], with its own consent and supervision.

## 4. Device, source, and metadata capture

Every event row records: date; device class (phone-only / watch model / strap model if the athlete owns one); the exact record types present; vendor write timing (record timestamp vs Health Connect ingestion); sync latency; app version; movement id; set index; load/reps; rest interval preceding the set; session order within the block; and the label events with their capture order. Provenance per row is mandatory (05 §4); vendor heterogeneity [R01, 04 S2] is a variable of interest, not noise to hide.

## 5. Missing-data behavior (predefined, non-negotiable)

- Missing biometric day → the set contributes label-only rows; no imputation from neighbors, population means, or the athlete's other days.
- Missing label (athlete skipped RPE) → the set contributes biometrics-only rows; **no backfilled label ever exists** [R03 law carried into research].
- Staleness: biometric records older than 30 h relative to a morning-read construct are flagged stale and analyzed separately, never silently merged.
- Missingness itself is reported: per-athlete, per-modality, per-device-class missingness rates appear in the final analysis. A pilot that hides its missingness has failed its own standard.

## 6. Counterexamples, adversarial coverage, and sensor dropout

The collection protocol *actively schedules* adversarial conditions rather than waiting to stumble into them: heavy sets with long Valsalva; small-muscle isolation vs large-muscle compounds at matched RPE; the same session repeated across readiness extremes; sessions after poor sleep vs good sleep; caffeine vs no-caffeine sessions (self-reported); hot vs temperate environments; circuit-style sessions; double sessions. Sensor dropout (dead watch, unworn strap, unsynced companion app) is recorded as a condition, not discarded. The confounder list from the WO (§4.4) is encoded as mandatory per-session annotations: exercise type/muscle mass, set duration, rest interval, breath holding, caffeine/stimulants, heat/hydration, altitude, medication, illness, anxiety, sensor fit/motion artifact, skin perfusion, device lag, individual conditioning, circuit vs heavy structure, missing/stale records.

## 7. Analysis plan (pre-registered before first data)

- **Split:** athlete-level train/holdout (§2) with the split seed recorded before analysis.
- **Baselines (must precede any ML):** (a) athlete's own historical mean RPE per movement; (b) planned target RPE as naive predictor; (c) per-athlete RPE-vs-RIR band model using cue-band structure [R05]. An advisory candidate must beat these *per athlete*, not just pooled, to justify existence.
- **Model classes:** simple regularized per-athlete regression on day-scale features (prior-night HRV, sleep efficiency, prior-day tonnage) is the *only* class consistent with the app's closed-form deterministic posture [R01b] and the pilot's data density; any complex model is exploratory-only and reported as such.
- **Metrics, by athlete and pooled:** within-athlete MAE and bias on set RPE; band-classification confusion; calibration (predicted vs observed band frequencies); high-effort miss rate (fraction of athlete-reported ≥9 sets predicted below 8 — the false-reassurance direction); false-reassurance rate at ≥8.5 target; coverage of uncertainty intervals.
- **Subgroup reporting:** per tier, per movement class, per device class, per session type (strength/hypertrophy/conditioning/bodyweight). Pooled-only results are explicitly disallowed in the final report.
- **Uncertainty and bias reporting:** per-athlete intervals via bootstrap over that athlete's sessions; pooled intervals via bootstrap over athletes. Missingness rates travel with every table (§5).

## 8. Candidate thresholds — explicitly NOT decided here

The WO forbids inventing acceptance thresholds; this protocol proposes *candidate* thresholds for the owner/domain-expert gate to adopt, reject, or move, each with its rationale: within-athlete set-RPE MAE ≤ 0.5 (justification: perceptual noise floor near failure is ~1 RIR [S03]; an advisory claiming resolution finer than the perceptual system is untruthful); high-effort miss rate ≤ 10% (false-reassurance guard); band classification materially above the §7 baselines; no athlete subgroup with bias direction harmful (under-predicting effort). **These are unratified placeholders.** The stop rule: if candidate thresholds are not met on holdout athletes with pre-registered analysis, the advisory option dies and the pilot's honest output is "not measurable."

## 9. Opt-out, manual-only path, and data handling

- Participation is opt-in; the app (or pilot build) functions identically without it. Every participant keeps the manual-only path forever (05 §10).
- Pilot data lives in the same local-first posture: on-device capture, exported only with explicit per-export consent, de-identified at export (athlete codes, no free-text), held by the owner under a stated retention limit, deleted on request. No third-party transfer. No device-extracted raw streams beyond the app's existing compacted daily types [R01].
- The pilot never modifies the athlete's plan, prescriptions, or progression behavior — its presence in a training block is observational only. Any observed interaction with training behavior is reported, not designed.

## 10. Safety monitoring

- Stop criteria for the pilot itself: any adverse event plausibly linked to participation; any indication the data is being interpreted as medical (05 §7); any privacy incident. The pilot pauses and the owner re-ratifies or kills it.
- The failure-test substudy (if run) requires direct supervision and its own consent language; it never runs inside the pilot's routine capture.

## 11. Who approves what (qualification matrix, per WO §5)

| Decision | Qualified approver |
|---|---|
| Protocol ratification (this document, thresholds, sample sizes) | Owner (Francis Pike) + a qualified exercise-science domain expert (sport/exercise scientist with measurement-methodology background) |
| Ethics/consent review (informed consent text, withdrawal, de-identification) | Owner + independent ethics-literate reviewer (not the pilot designer) |
| Data-collection start | Owner, after both the above |
| Any transition from pilot to product (advisory option O5) | Owner only, after holdout results meet ratified thresholds, privacy review (05), and a fresh independent audit of the analysis |
| Killing the pilot | Owner, unilaterally, at any time |

## 12. What this protocol deliberately does not do

It does not estimate RPE for anyone. It does not put biometrics in front of athletes during sessions (the label-anchoring rule, §1). It does not touch prescription state [R01, R01b]. It does not collect SpO2 [05 §8]. It does not validate "biometric RPE" as a concept — it tests whether one specific, individually calibrated, day-scale-feature advisory is measurable against athlete-reported labels, and it is built so the answer can be no.
