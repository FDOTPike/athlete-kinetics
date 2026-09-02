# 01 — Construct Map: Effort, Recovery, and Physiological Observations

This document defines every candidate construct precisely enough that no future design, prompt, or code path can silently merge two of them. The governing repository law already exists in Calibration Policy v1 [R01]: missing values stay missing, every construct keeps its own provenance and its own named consumer, and the four-concept split below mirrors the policy's own architecture. **Corrected per Round 3 closure:** an earlier version of this line read "descriptive signals have no prescription authority." That is false as written, and the error mattered — live HRV and sleep signals *do* reach the planned prescription, both through `readiness_score` and as **direct rule conditions** in `evaluatePolicy` [R07] (§13.3). The accurate invariant is narrower and is the one this document enforces: no physiological signal may fill, grade, or substitute for an **athlete-reported RPE**; its only legitimate reach is the readiness/planning channel.

## 1. Set RPE (actual, athlete-reported)

- **Intended measure:** the athlete's perceived effort for a completed single set, expressed on the 0–10 resistance-training RPE scale where the whole number anchor is repetitions in reserve (RIR).
- **Scale-provenance caution (added per Round 4):** the resistance-training literature uses at least two non-interchangeable RPE scales. This app uses the **0–10 RIR-anchored** scale [S01, R05]. [S30]'s reported values (17.2, 13.3) indicate the **Borg 6–20 category scale**. Findings transfer at the level of *which variables move RPE*, never as raw numbers; any future work that mixes the two scales without conversion is a construct error of exactly the kind §13 exists to prevent.
- **Time window:** the seconds immediately after a set ends; recorded at set logging time.
- **Subjective or physiological:** subjective — a perceptual report from the person doing the work.
- **Applies to:** one set, one exercise.
- **Ground truth:** the athlete's own perception; there is no external referent. Validity of the *scale* is anchored to RIR: RPE 10 = 0 RIR, RPE 9 = 1 RIR, etc.
- **Evidence state:** the RIR-anchored 0–10 scale was developed and validated for resistance exercise in trained populations; accuracy of the underlying perceptual judgment degrades with distance from failure — estimated-reps-to-failure error is roughly one repetition within 0–5 RIR but grows beyond 2 repetitions at 7–10 RIR, and is worse for large-muscle lower-body exercises [S01, S02, S03]. The scale measures what it claims in its own terms; it is not a physiological measurement.
- **Why it must not be conflated:** it is the only per-set effort authority the athlete has; readiness and biometrics describe different days and different bodies.

## 2. Repetitions in reserve (RIR)

- **Intended measure:** how many further technically-clean repetitions the athlete believes they could have completed.
- **Time window:** same instant as set RPE; on the app's 0–10 RPE scale it is the anchor language, not a separately logged field (`set_record.rpe` only [R04]).
- **Subjective or physiological:** subjective.
- **Applies to:** one set.
- **Ground truth:** actual repetitions to failure, measurable only by training to failure.
- **Evidence state:** RIR-based RPE is more accurate near failure [S03]; upper-body exercises are estimated more accurately than lower-body, training experience does not rescue accuracy [S03], and perceptual fatigue degrades it further [S06]. Velocity-based and failure-test research confirms the RIR construct is meaningful but noisy at high RIR [S04, S06].
- **Why it must not be conflated:** RIR is the anchor of set RPE, not an independent biometric; "two good reps left" language in the app's cues (`effortCue` [R05]) is copy derived from the athlete's chosen number, never a computed value.

## 3. Session RPE (actual, athlete-reported)

- **Intended measure:** a whole-session rating of perceived exertion (Borg CR-10 convention), typically rated ~30 minutes after the session; multiplied by duration it forms the Foster session-RPE internal-load product [S07].
- **Time window:** one session, rated after it ends.
- **Subjective or physiological:** subjective (a retrospective global self-rating).
- **Applies to:** the session as a whole.
- **Ground truth:** the athlete's integrated perception; the Foster method validates it against an HR-based objective standard for *load quantification*, not as an effort-measurement identity [S07, S08].
- **Evidence state:** the session-RPE method correlates consistently with HR-derived load across steady-state cycle, interval, basketball [S07] and high-intensity functional training [S08]; absolute scores differ from HR-based scores, so it is a valid *internal-load index*, not a synonym for physiological intensity.
- **Repository state:** the app currently derives `session_rpe` at session close as the mean of rated sets, or `NULL` when no set was rated [R03]. That derivation is present behavior, disclosed here for construct honesty; this discovery proposes no change to it.
- **Why it must not be conflated:** a mean of set RPEs is a within-session aggregation, not a fresh global perceptual rating, and neither is a daily recovery state.

## 4. Daily readiness / recovery (the app's composite)

- **Intended measure:** the app's readiness score — a renormalized weighted mean of the *available* HRV and sleep-efficiency components (0.35/0.25), neutral 50.0 when no inputs exist [R01b].
- **Time window:** one calendar day, materialized per date.
- **Subjective or physiological:** physiological-input composite (HRV z-score, sleep efficiency) — neither input is an effort rating.
- **Applies to:** the day, before or between sessions.
- **Ground truth:** none claimed. Calibration Policy v1 fixed its *composition* (HRV+sleep only; ACWR/load removed) — but readiness is **not merely descriptive**: the live prescription engine (`policyReference.ts:36-55` [R07]) maps it to a planned load modifier (0.85–1.05), planned set modifier (−2…+1), and a planned-RPE cap (6.5–9.5). **Corrected per audit** — the first freeze mislabeled readiness "descriptive," importing the ACWR story onto the wrong signal. The precise authority boundary: readiness modulates **planned** prescription numbers; it never writes, grades, or replaces athlete-entered actual RPE.
- **Why it must not be conflated:** readiness is a day-scale recovery descriptor with planned-side prescription authority; a heavy session on a "ready" day can still produce set RPE 9.5, and a fresh athlete on a poor-readiness day can still cruise at RPE 6. The WO's boundaries forbid converting readiness into set RPE in either direction.

## 5. Talk/breathing cues (subjective, observed)

- **Intended measure:** the athlete's ability to speak comfortably or control breathing during/after work — a practical intensity proxy.
- **Time window:** during or immediately after exertion.
- **Subjective or physiological:** subjective observation of a physiological phenomenon.
- **Applies to:** a set or a work bout.
- **Ground truth:** ventilatory threshold approximations in aerobic work.
- **Evidence state:** the talk test tracks aerobic intensity against ventilatory/lactate thresholds in healthy populations [S10]. Its evidence base is endurance exercise; no primary source demonstrates it grades resistance set RPE. The app's existing copy already handles this honestly: breathing cues "vary by exercise and fitness — rough guides, not targets" [R05].
- **Why it must not be conflated:** heavy strength work with Valsalva breaks the talk test's premise entirely (breath holding is deliberate); a talk cue cannot be an RPE substitute.

## 6. Rep velocity / velocity loss (mechanical, not biometric)

- **Intended measure:** barbell/dumbbell movement speed, or its decline across a set.
- **Time window:** within and across sets of loaded, linear-path exercises.
- **Subjective or physiological:** mechanical measurement (a kinematic quantity, not a sensor-of-the-body biometric — listed here because the WO includes it).
- **Applies to:** one repetition or one set.
- **Ground truth:** proximity to concentric failure.
- **Evidence state:** mean velocity correlates inversely with RPE/RIR (experienced lifters r ≈ −0.88, novice r ≈ −0.77 for squat at 60–90% 1RM [S01, S04]); but the velocity–RIR relationship is *moderated* by exercise type, load, velocity-loss threshold, and set number [S04], and estimating reps to failure from perception alone still carries the error profile of §2. It also requires external hardware (a linear position transducer or vision-based measurement) the app does not have.
- **Why it must not be conflated:** velocity is an external kinematic signal, not a body sensor; even if it were available it would estimate RIR, not replace the athlete's report — and the WO forbids building a biometric-derived RPE score.

## 7. Exercise heart-rate response and recovery

- **Intended measure:** HR during sets/inter-sets, and post-exercise HR recovery (HRR = fall in HR in the first minute after effort cessation).
- **Time window:** seconds to minutes around work bouts.
- **Subjective or physiological:** physiological.
- **Applies to:** a work bout or session; HRR is a post-bout measurement.
- **Ground truth:** cardiac autonomic (vagal) reactivation for HRR.
- **Evidence state:** HRR's strongest evidence is *prognostic*: a blunted 1-minute HRR predicted all-cause mortality in 2,428 referred adults (adjusted relative risk 2.0, 95% CI 1.5–2.7) [S11] — a clinical-risk finding in a clinical population, with no demonstrated mapping to resistance-training effort. Wrist optical HR accuracy is **regime-specific, and the categorical claim earlier drafts made is withdrawn (per Round 4)**: in continuous intense free-running it degrades badly (MAPE up to ~18.66% vs an ECG criterion [S09]), but measured *in resistance training itself*, consumer watches agreed closely with ECG at discrete pre/post/1-min timepoints — r = 0.64–0.97, ICC > 0.94, limits of agreement ≈ ±10 bpm across bench press, squat, T-bar row and deadlift [S29]. The defensible boundary is therefore **device- and timing-specific**, not blanket: agreement is demonstrated for *discrete samples around* a set on the devices tested (and in the resistance condition only the Apple Watch showed no significant difference from ECG), while **continuous intra-set** wrist HR, Health Connect delivery, cross-device equivalence and any non-male population remain unmeasured. Note also that [S29]'s sample is 62 healthy adult men. **No cited source directly validates chest straps themselves** (corrected per third audit); chest-worn ECG-class sensors are nonetheless the criterion method in this literature, and they measure the same non-effort quantity. Resistance-training HR is confounded by Valsalva, small vs large muscle mass, rest intervals, and heat.
- **Why it must not be conflated:** HR during a heavy set reflects pressor responses, breath holding, and muscle-mass effects as much as metabolic demand — identical HR traces can come from a grinding RPE 9.5 set and an easy RPE 6 set with different breathing strategies.

## 8. Resting heart rate (RHR)

- **Intended measure:** morning/resting HR as a slow-moving fitness/recovery descriptor.
- **Time window:** daily.
- **Subjective or physiological:** physiological.
- **Applies to:** the day (requested and read by the app alongside HRV [R01]).
- **Evidence state:** no primary source located that maps RHR to next-day set RPE. Marked **UNRESOLVED** in `02_EVIDENCE_REVIEW.md` (§5): this discovery claims nothing causal or predictive about it, and any future use requires new primary evidence.
- **Current handling in the live app (complete; per Round 3 closure) [R09]:** requested and read [R01]; stored **alongside** an `hrv_daily` row when that day's rMSSD exists, while an RHR-only day merely updates an already-existing row and is **not persisted at all** if none exists (`useStore.ts:4232-4243`); contributing **nothing** to readiness, planned load, planned sets, or the RPE cap [R01b]; **exposed** through `loadMeasuredHistory` as `restingHr` (`useStore.ts:4384-4405`); and **counted** toward the developer-facing `hrvDays` diagnostic availability window (`coachVerificationLab.ts:362-377`) — a diagnostic count, not readiness or prescription use. It nonetheless has **no athlete-facing consuming feature**, which is why UD-9 remains a live Play/declaration issue (`00` §6, `05` §1b, `08` UD-9). Statements like "RHR feeds nothing" or "RHR is always stored" are both inaccurate and are withdrawn wherever they appeared.
- **Why it must not be conflated:** a day-scale resting metric cannot grade a 40-second set.

## 9. Heart-rate variability (HRV / rMSSD)

- **Intended measure:** beat-to-beat autonomic fluctuation; the app uses ln(rMSSD) z-scored against a 28-day baseline as a readiness input [R01b].
- **Time window:** daily snapshots (typically overnight readings from wearables via Health Connect).
- **Subjective or physiological:** physiological.
- **Applies to:** the day.
- **Evidence state:** HRV tracks cardiac vagal tone [S14] and responds to psychological stress at the group level, but with wide individual and metric variability [S15]; day–night patterns differ materially by age and health status [S16]; sleep loss shifts HRV but with heterogeneous findings across metrics [S17]. None of this converts a nightly HRV number into a per-set effort grade — the honest reading is that HRV is a plausible *context* signal with established *stress-sensitivity* and no established *set-effort validity*.
- **Why it must not be conflated:** it is already an input to readiness under Calibration Policy v1; giving it a second meaning (effort) would corrupt both.

## 10. Sleep (duration, efficiency, stages)

- **Intended measure:** nightly sleep; the app ingests in-bed/asleep/stage minutes via Health Connect `SleepSession` [R01] and consumes sleep efficiency in readiness [R01b].
- **Time window:** one night, read the following morning.
- **Subjective or physiological:** physiological (device-estimated) — with the caveat below.
- **Applies to:** the night/day.
- **Evidence state:** sleep insufficiency and poor quality degrade athletes' physical performance and recovery (review-level [S20]); consumer wearables validate only moderately against polysomnography for stage classification: across 11 devices in a 75-participant multicenter study (ages 19–70), four-stage epoch-by-epoch accuracy spanned 0.28–0.71 with macro F1 0.26–0.69 and Cohen's κ 0.07–0.56, the best wearables reaching only moderate agreement [S19]. The app's unstaged-sleep fallback (0.92 population-median efficiency, `UNSTAGED_SLEEP_EFFICIENCY` [R01]) is an explicit internal estimation constant, disclosed here — not an external scientific claim.
- **Why it must not be conflated:** last night's sleep plausibly modulates today's *capacity*, which is a readiness story; it cannot know how hard a set felt.

## 11. SpO2 (peripheral oxygen saturation)

- **Intended measure:** % hemoglobin oxygen saturation from pulse oximetry (wearable or fingertip device).
- **Time window:** point-in-time or overnight trends.
- **Subjective or physiological:** physiological.
- **Applies to:** a measurement session.
- **Evidence state:** one validated smartwatch detected short-time hypoxemia comparably to a medical-grade reference during controlled desaturation in 24 healthy adults [S13]; broader consumer-device data show systematic underestimation vs clinical references [S18] and an independent journal commentary cautions against trusting consumer smartwatch SpO2 [S24]. There is **no evidence** connecting SpO2 to resistance-training effort or proximity to failure.
- **Disposition:** **do not collect** (ruling in `00` §3 and `05` §8).
- **Why it must not be conflated:** oxygenation is a medical-adjacent vital sign; using it as an effort proxy would both be unsupported and imply medical monitoring the app must never claim.

## 12. Perceived stress (user-reported)

- **Intended measure:** the athlete's own stress state.
- **Time window:** day scale.
- **Subjective or physiological:** subjective when self-reported (the only form the app should accept).
- **Evidence state:** stress and HRV relate at group level with large individual variability [S15]; this supports "stress is a real physiological/contextual factor," not "a stress number predicts set RPE."
- **Why it must not be conflated:** daily stress belongs to the readiness/context tier; converting it (or its physiological correlates) into effort would erase the distinction between how ready an athlete feels and how hard a set was.

---

## 13. Non-conflation matrix (enforced at architecture level in `07`)

| | Set RPE | RIR | Session RPE | Readiness | Biometric obs. |
|---|---|---|---|---|---|
| **Set RPE** | — | anchor language | different window (set vs session) | different window & kind | no conversion either way |
| **RIR** | anchor of RPE | — | — | — | — |
| **Session RPE** | aggregation ≠ new perception | — | — | — | no conversion |
| **Readiness** | never fills/grades athlete RPE; modulates **planned** load/sets/rpe_cap via the policy engine [R07] | — | never derived from set RPE | — | inputs: HRV, sleep only (RHR: no athlete-facing consumer [R01, R09]) |
| **Biometric observations** | never fill, never grade | — | never fill | may feed readiness *only* | — |

The three critical conflation traps, stated as invariants for tomorrow's auditor:

1. **No fill:** an absent `set_record.rpe` or `session_rpe` stays `NULL` [R03]; no biometric quantity may write it.
2. **No grading:** no biometric-derived value may be displayed as a correctness judgment of an athlete-entered RPE.
3. **No channel mixing:** readiness inputs flow only into the materialized readiness score and its downstream policy use [R01b, R07] — and **the flow is direct as well as composite** (corrected per second audit): `evaluatePolicy` reads `hrv_z` and `sleep_efficiency_pct` **directly** for the load modifier and the readiness-boost/set rules (`policyReference.ts:39,46,51`), in addition to their contribution through `readiness_score`. The accurate statement of the live flow is therefore `HRV/sleep → readiness_score → load/set/rpe_cap modifiers` **plus** `HRV z / sleep efficiency → direct rule conditions in evaluatePolicy`. A future biometric-context surface would be a separate channel with its own provenance, never merged into readiness, policy inputs, or RPE paths.
4. **Athlete-facing copy must match the flow (UD-10).** The ProfileScreen's connected-state copy claims resting heart rate "feeds your readiness score" (`apps/mobile/src/screens/ProfileScreen.tsx:415`) — which the live materialization contradicts [R01b]. Because this work order is documentation-only, this product-copy defect is logged as **UD-10** in `08` for later code remediation; until fixed, privacy/consent documentation must not repeat its claim.
