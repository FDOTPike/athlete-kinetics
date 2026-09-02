# 04 — Android Data Feasibility (phone-only, watch, chest strap, pulse oximeter, manual)

Method: the WO's configuration separation is applied first — every data type is assessed per configuration rather than averaged across them. Sources: the live repository [R01, R06], official Android/Play documentation [D01, D02, D05], and the device-accuracy literature [S09, S13, S16, S17, S19]. Capture date for all platform documentation: 2026-09-02; platform policy evolves and the auditor should re-check the cited pages.

## 1. What the app can actually touch today

The pinned integration (`react-native-health-connect` declared `^3.3.0`; the lockfile resolves **3.5.3** — corrected per second audit; minSdk 26, targetSdk 36 [R06]) reads **exactly three record types**: `HeartRateVariabilityRmssd`, `RestingHeartRate`, `SleepSession` [R01]. The store treats the bridge as optional and never blocks on it: a five-state machine (`off / unavailable / idle / denied / ready`) degrades to subjective-only routing with no uncaught throw, sync is foreground-lifecycle only (boot / AppState active / manual SYNC — no background workers), and data lands as one compacted row per day per table [R01]. Any new record type would require: a new permission entry, a new Health apps declaration justification in Play Console [D02, D04], a schema-side ingestion path, and an owner decision — none of which this discovery proposes.

**Android permission reality [D01, D02, D05]:** Health Connect permissions are per-data-type (`android.permission.health.READ_*`), declarations are audited against the features that consume them, and access must be tied to a clear user-facing benefit. Requesting a type the app does not meaningfully consume is a policy failure mode, not just a privacy one. `BODY_SENSORS` (direct on-body sensor access) is a different, heavier permission class the app does not hold.

## 2. Configuration S1 — phone only

Health Connect is an on-device store that other apps write into; a phone-only Athlete App installation sees data **only if a companion app (watch vendor app, strap app, oximeter app) wrote it there**. The phone's own sensors provide nothing relevant: a phone in the pocket during lifting has no valid HR, HRV, sleep, or SpO2 signal.

- **HRV / RHR / sleep:** day-scale availability, entirely dependent on whether the athlete owns a wearable and its app writes to Health Connect. Missing day = missing day (never zero) — already the app's behavior [R01].
- **At-set-time availability:** none *in the app's current ingestion path*. **Corrected per second audit:** the Health Connect *platform schema does* support set-level structure — `ExerciseSegment` (androidx.health.connect:connect-client, added 1.1.0; set fields from 1.2.0-alpha06) carries repetitions, weight, `setIndex`, and an optional 0–10 Borg-CR10 `rateOfPerceivedExertion` per segment, inside `ExerciseSessionRecord` [D09]. The accurate statement is therefore: **the current Athlete App bridge neither requests `ExerciseSession`/`ExerciseSegment` records nor consumes them** [R01], and real-world availability depends on whether the athlete's recording app (watch vendor, etc.) writes segment-level data — vendor coverage, completeness, and sync latency are **unverified** and would have to be measured before any design assumed them. No "set" record reaches the app today.
- **Latency & provenance:** record timestamps are vendor-generated; provenance metadata exists in Health Connect but the app currently does not surface it [R01]. A readiness read the morning after is fine; a mid-session read of "today's HRV" is semantically incoherent (see S4).
- **Offline:** Health Connect is local; reads are local IPC. The whole path works with no network — consistent with the app's offline posture.

**Phone-only verdict:** the existing three day-scale types, nothing more, nothing at set time.

## 3. Configuration S2 — smartwatch (wrist)

- **Sleep:** the best-supported quantity. Consumer trackers validate only moderately for stage classification against polysomnography (four-stage epoch-by-epoch accuracy 0.28–0.71; macro F1 0.26–0.69; κ 0.07–0.56 across 11 devices, n = 75) [S19]. The app's consumed efficiency/TST-side quantities sit closer to the better-validated side than stage classification; deep/REM minutes do not and must never be described as validated physiology.
- **Overnight HRV:** available only if the vendor computes and writes `HeartRateVariabilityRmssd` to Health Connect. Vendor practices differ (reading protocol, artifact rejection, nightly vs spot readings), so the same column carries different provenance across devices — a vendor-difference risk the aggregation layer silently averages today [R01]. Day-night HRV patterns differ with age and health status [S16], and sleep loss shifts HRV heterogeneically by metric [S17]: nightly HRV is a day-scale context input, not a repeatable absolute.
- **During-lifting HR:** wrist PPG is least accurate exactly here — intense, intermittent, grip-heavy motion produced MAPE up to ~18.66% vs ECG in validation [S09]. Valsalva and wrist flexion make it worse. Per-set HR features on a watch are unreliable *before* any modeling.
- **SpO2:** some watches expose nightly SpO2. Disposition: **do not collect** (00 §3; §6 below).

## 4. Configuration S3 — chest strap (ECG-class)

Chest-strap (ECG-class) sensors are treated as the criterion method in exercise-HR validation studies — S09 scored wrist PPG **against an ECG criterion**, and the chest-worn ECG strap is the common practical embodiment of that criterion in sport settings; **no cited source directly validates chest straps themselves** (corrected per second audit). Chest straps are nonetheless the only configuration with credible per-second HR during heavy sets. But: the app has **no Bluetooth layer** — using a strap means adding BLE permissions, a native scanning stack, and a strap-vendor integration surface. That is a product-code change the WO forbids and this discovery does not design. Even granted: strap HR during lifting measures pressor responses, breath-hold, and muscle-mass effects (01 §7) — an accurate measurement of the wrong construct for effort. Straps could also bridge to Health Connect via their own apps, landing in the S1 path with day-scale granularity.

## 5. Configuration S4 — set-time reality check (the decisive constraint)

Even with perfect hardware, "at set time" biometrics face structural walls:

1. **No set-level ingestion in the current app.** The Health Connect *platform schema does* support per-set structure — `ExerciseSegment` carries repetitions, weight, `setIndex`, and optional 0–10 Borg-CR10 RPE [D09] — but the app's bridge does not request or consume these records [R01], and vendor write coverage/latency for segment data is unverified. Any per-set biometric semantics would require a new record type request, a consuming feature, and measured vendor coverage — none of which this discovery proposes.
2. **PPG failure under load** [S09] — the signal is worst in the exact window of interest.
3. **Rest-interval HR is not a recovery measurement.** Inter-set HR decays under partial vagal reactivation whose timescale (seconds–minutes) no Health Connect record captures; treating "HR at next set start" as recovery would be an invented construct.
4. **Circadian/baseline confounding** [S16, S17] — "today's HRV" mid-morning is not the nightly measurement readiness is built on; reading it at set time would silently change the construct.

## 6. Configuration S5 — pulse oximeter

Fingertip pulse oximeters are clinical-grade relative to watches; watch SpO2 has demonstrated hypoxemia-detection utility under controlled conditions [S13] but systematic accuracy concerns in broader data (vs arterial blood gas: RMSE ≈ 4%, r 0.46–0.64) [S18]. Oxygenation is a medical-adjacent vital with **no established relationship to resistance-training effort**; collecting it would import medical semantics, per-data-type Play declarations [D01, D02], and zero scientific return. Disposition: **do not collect** in any configuration.

## 7. Configuration S6 — manual entry

Always available, zero permission burden, clean provenance (source = the athlete). This is the only configuration that delivers a set-time "observation" the WO's option 2 (subjective breathing/form cue entry) could legally use. Its costs are friction and self-report bias — the same class of bias as RPE itself, which is exactly why it can live beside the athlete's RPE without pretending to be an independent instrument.

## 8. Feasibility matrix

| Data type | Phone-only | Watch | Chest strap | Pulse ox | Manual | At set time? | Permission today |
|---|---|---|---|---|---|---|---|
| HRV (rMSSD) | via HC only if vendor writes | yes (overnight) | no | no | no (not validly self-estimable) | never | granted (R01) |
| Resting HR | via HC | yes | via vendor app | no | partially (morning pulse) | never | granted (R01) |
| Sleep (duration/efficiency) | via HC | yes | no | no | yes (coarse) | never | granted (R01) |
| Sleep stages (deep/REM) | via HC | yes (unreliable [S19]) | no | no | no | never | granted (R01) |
| Exercise HR (per-set) | no | unreliable [S09] | accurate but no BLE layer | no | no | only via strap (new code+permission) | none — would need new |
| SpO2 | no | some devices | no | yes (clinical) | no | n/a | none — do-not-collect |
| Velocity/RIR kinematics | no | no | no | no | no | requires external hardware [S04] | n/a |
| Subjective cues (breathing/form) | yes | yes | yes | yes | yes | yes (the athlete is present) | none |

## 9. The 4 GB device contract

The release contract pins a 4 GB low-RAM target device with dirty RAM **below 450 MB** [R06]. The current design is the memory posture: minute-level wearable ticks are compacted to one row/day *before* SQLite, sync is foreground-only, and the trailing window is 7 days [R01]. Implications for any future option:

- Continuous per-second HR ingestion: a **bounded arithmetic estimate**, corrected per second audit. For the stated 30-minute in-memory processing buffer at 1 Hz: 1,800 samples × ~16–32 B raw ≈ 29–58 KB; as JS objects at 100–200 B each ≈ **0.2–0.4 MB** — sub-MB for a bounded session buffer, not the "tens of MB" the first freeze asserted (that figure was wrong and is withdrawn). The honest risk statement: the plausible per-session cost is small, but the actual failure modes are (a) unbounded accumulation if the compaction boundary is ever skipped, (b) allocation/GC churn from per-sample objects, and (c) database growth if raw ticks were ever persisted — none quantifiable without measurement on the 4 GB target, whose release contract requires measured device evidence [R06]. Any future streaming design must therefore begin with a device measurement gate, and the compaction boundary (native adapter in, pure daily aggregation out) must not move [R01].
- Background/foreground-service sensor loops (needed for set-time capture) are battery-hostile and were deliberately excluded from the lifecycle; reintroducing them for an unvalidated estimate violates both the memory contract and the proportionality principle.
- ONNX/embedder assets already share the 450 MB budget; a biometric-model path would compete for the same headroom. A prototype must live outside the shipped binary (research-app or offline analysis on exported data).

## 10. Feasibility verdict

Within the WO's boundaries (no new permissions, no new record types, no native code), the collectible universe is exactly the current three day-scale types plus manual subjective entry. Phone-only cannot produce set-time biometrics; watches produce unreliable set-time HR and vendor-heterogeneous nightly HRV; straps are out of scope; oximetry is ruled out on the merits. Missingness is structural, not incidental: a large fraction of athletes will have no wearable, and even owners will have stale or partial days — including **partial grants** (the bridge treats any granted requested type as "ready" [R01; corrected model in `05` §1b]), so per-type availability must be tracked and displayed independently. Any future design must treat "no data" as the common case, never impute it, and display whatever exists with provenance and staleness [D02's minimization principle applied honestly].

## 11. Retention as-built (added per audit)

The ingestion tables (`hrv_daily`, `sleep_daily`, and the materialized `state_vector` rows) **retain daily rows indefinitely** on device; the app reads a bounded recent window (boot rematerialization ~14 days, trailing trend) but deletes nothing along the way. There is no trailing-window deletion policy in the live code, and this document must not imply one. The only deletion path is the athlete's `resetTrainingData` action [R01]. If a retention policy is ever wanted, it is new owner-ratified behavior with its own migration and tests. Pilot data, if `06` is ratified, is separately bounded (`05` §1).
