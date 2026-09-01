# 04 — Android Data Feasibility (phone-only, watch, chest strap, pulse oximeter, manual)

Method: the WO's configuration separation is applied first — every data type is assessed per configuration rather than averaged across them. Sources: the live repository [R01, R06], official Android/Play documentation [D01, D02, D05], and the device-accuracy literature [S09, S13, S16, S17, S19]. Capture date for all platform documentation: 2026-09-02; platform policy evolves and the auditor should re-check the cited pages.

## 1. What the app can actually touch today

The pinned integration (`react-native-health-connect` ^3.3.0, minSdk 26, targetSdk 36 [R06]) reads **exactly three record types**: `HeartRateVariabilityRmssd`, `RestingHeartRate`, `SleepSession` [R01]. The store treats the bridge as optional and never blocks on it: a five-state machine (`off / unavailable / idle / denied / ready`) degrades to subjective-only routing with no uncaught throw, sync is foreground-lifecycle only (boot / AppState active / manual SYNC — no background workers), and data lands as one compacted row per day per table [R01]. Any new record type would require: a new permission entry, a new Health apps declaration justification in Play Console [D02, D04], a schema-side ingestion path, and an owner decision — none of which this discovery proposes.

**Android permission reality [D01, D02, D05]:** Health Connect permissions are per-data-type (`android.permission.health.READ_*`), declarations are audited against the features that consume them, and access must be tied to a clear user-facing benefit. Requesting a type the app does not meaningfully consume is a policy failure mode, not just a privacy one. `BODY_SENSORS` (direct on-body sensor access) is a different, heavier permission class the app does not hold.

## 2. Configuration S1 — phone only

Health Connect is an on-device store that other apps write into; a phone-only Athlete App installation sees data **only if a companion app (watch vendor app, strap app, oximeter app) wrote it there**. The phone's own sensors provide nothing relevant: a phone in the pocket during lifting has no valid HR, HRV, sleep, or SpO2 signal.

- **HRV / RHR / sleep:** day-scale availability, entirely dependent on whether the athlete owns a wearable and its app writes to Health Connect. Missing day = missing day (never zero) — already the app's behavior [R01].
- **At-set-time availability:** effectively none. Health Connect receives workout data when the companion app syncs (minutes to hours later, sometimes after phone reconnection). No per-set records exist in the Health Connect schema — there is no "set" or "repetition" concept in the data model [D01]; at best there are `ExerciseSession` windows with HR series sampled inside them.
- **Latency & provenance:** record timestamps are vendor-generated; provenance metadata exists in Health Connect but the app currently does not surface it [R01]. A readiness read the morning after is fine; a mid-session read of "today's HRV" is semantically incoherent (see S4).
- **Offline:** Health Connect is local; reads are local IPC. The whole path works with no network — consistent with the app's offline posture.

**Phone-only verdict:** the existing three day-scale types, nothing more, nothing at set time.

## 3. Configuration S2 — smartwatch (wrist)

- **Sleep:** best-supported quantity. Consumer trackers validate well on total-sleep-time and sleep/wake against polysomnography (MAPE ≈ 10–20%, accuracy ≈ 84–91% across 11 devices, n = 75) but **stage estimates are unreliable** [S19]. The app's consumed efficiency/TST-side quantities sit on the reliable side; deep/REM minutes do not and must never be described as validated physiology.
- **Overnight HRV:** available only if the vendor computes and writes `HeartRateVariabilityRmssd` to Health Connect. Vendor practices differ (reading protocol, artifact rejection, nightly vs spot readings), so the same column carries different provenance across devices — a vendor-difference risk the aggregation layer silently averages today [R01]. Day-night HRV patterns differ with age and health status [S16], and sleep loss shifts HRV heterogeneically by metric [S17]: nightly HRV is a day-scale context input, not a repeatable absolute.
- **During-lifting HR:** wrist PPG is least accurate exactly here — intense, intermittent, grip-heavy motion produced MAPE up to ~18.66% vs ECG in validation [S09]. Valsalva and wrist flexion make it worse. Per-set HR features on a watch are unreliable *before* any modeling.
- **SpO2:** some watches expose nightly SpO2. Disposition: **do not collect** (00 §3; §6 below).

## 4. Configuration S3 — chest strap (ECG-class)

Chest straps are the accuracy criterion for exercise HR [S09] and the only configuration with credible per-second HR during heavy sets. But: the app has **no Bluetooth layer** — using a strap means adding BLE permissions, a native scanning stack, and a strap-vendor integration surface. That is a product-code change the WO forbids and this discovery does not design. Even granted: strap HR during lifting measures pressor responses, breath-hold, and muscle-mass effects (01 §7) — an accurate measurement of the wrong construct for effort. Straps could also bridge to Health Connect via their own apps, landing in the S1 path with day-scale granularity.

## 5. Configuration S4 — set-time reality check (the decisive constraint)

Even with perfect hardware, "at set time" biometrics face structural walls:

1. **No set-level schema.** Health Connect has no per-set construct [D01]; any per-set semantics would have to be manufactured by the app from continuous streams the app does not and cannot collect phone-only.
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

- Ingesting continuous per-second HR streams into the app's memory or database would add tens of MB of working set and GC churn for zero validated benefit — the compaction boundary (native adapter in, pure daily aggregation out) must not move [R01].
- Background/foreground-service sensor loops (needed for set-time capture) are battery-hostile and were deliberately excluded from the lifecycle; reintroducing them for an unvalidated estimate violates both the memory contract and the proportionality principle.
- ONNX/embedder assets already share the 450 MB budget; a biometric-model path would compete for the same headroom. A prototype must live outside the shipped binary (research-app or offline analysis on exported data).

## 10. Feasibility verdict

Within the WO's boundaries (no new permissions, no new record types, no native code), the collectible universe is exactly the current three day-scale types plus manual subjective entry. Phone-only cannot produce set-time biometrics; watches produce unreliable set-time HR and vendor-heterogeneous nightly HRV; straps are out of scope; oximetry is ruled out on the merits. Missingness is structural, not incidental: a large fraction of athletes will have no wearable, and even owners will have stale or partial days. Any future design must treat "no data" as the common case, never impute it, and display whatever exists with provenance and staleness [D02's minimization principle applied honestly].
