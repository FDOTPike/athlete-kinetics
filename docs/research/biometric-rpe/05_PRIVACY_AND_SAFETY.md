# 05 — Privacy, Consent, and Safety

Governing principle: the app ingests three optional, day-scale, device-derived quantities. **Corrected data flow (per audit, against the live repository):** HRV and sleep efficiency feed the materialized readiness score [R01b]; the readiness score is **not merely descriptive** — it is a prescription input. `evaluatePolicy` (`packages/inference/src/policyReference.ts:36-55`) maps readiness (plus HRV z and sleep efficiency) to a load modifier (0.85–1.05), a set modifier (−2…+1), and a planned-RPE cap (6.5–9.5). Resting heart rate is the exception: it is requested, ingested, and stored, but currently feeds **no computation at all** — it has no consuming feature. Everything in this document starts from that actual footprint, not an idealized one.

## 1b. The RHR permission gap (disclosed compliance risk)

Google's Health apps declaration requires each requested data type to support a specific, user-facing health feature, and forbids requesting access a feature does not consume [D02, D04, D08]. As of this remediation, the app's `RestingHeartRate` request does not satisfy that test: the column is written (`hrv_daily.resting_hr`, upserted by the sync path [R01]) and displayed nowhere, and it contributes to no score. The honest options — an **owner decision** now logged as **UD-9** in `08` — are: (a) drop the RHR request and ingestion entirely; (b) give RHR a real consuming feature (e.g. a provenance-bearing trend row on the readiness disclosure) before any Play declaration is filed; or (c) keep it with an explicit, documented justification reviewed by the owner. This discovery neither drops nor extends the permission (WO boundary: no permission changes); it records the gap so the declaration is not filed on a false premise.

**Partial grants (corrected bridge model).** The live bridge reports "ready" when *any* requested permission is granted (`getGrantedPermissions()).length > 0`, `healthConnect.ts:83-98` [R01]), and the store then treats biometrics as ready. The result: an athlete who grants sleep but denies HRV gets sleep-only ingestion with a "ready" status — functionally fine (per-type reads that fail return empty, and downstream the readiness score renormalizes over available inputs [R01b]), but the status label and any future consent copy must not imply a complete set. Any future permission-wording work must model the partial state explicitly: per-type granted/denied tracking, per-type display when values are shown, and consent copy that lists each type individually rather than a bundle ("your health data").

- Per-type, per-feature justification [D02, D04, D08]: HRV and sleep have a consuming feature chain (readiness → prescription modifiers). RHR currently does not (§1b). A future data type must have the same named-consumer property — reviewed before the permission request is ever added — or it must not be requested. "We might use it later" is not a justification.

## 1. Data minimization

- The collectible universe under this discovery is exactly the existing set: `HeartRateVariabilityRmssd`, `RestingHeartRate`, `SleepSession` [R01]. No SpO2, no exercise-session streams, no body sensors, no location, nothing else (04 §8).
- Per-type, per-feature justification [D02, D04, D08]: HRV and sleep have a consuming feature chain (readiness → prescription modifiers). RHR currently does not (§1b). A future data type must have the same named-consumer property — reviewed before the permission request is ever added — or it must not be requested. "We might use it later" is not a justification.
- Raw high-frequency data is **not necessary**: the memory guardrail (one compacted row/day, compaction before persistence [R01]) is also the privacy posture. Minute-level ticks never reach the app's database; there is nothing finer-grained to leak, subpoena, or misinterpret. Any future feature that claims to need per-second streams must carry its own justification, memory analysis, and owner ratification.
- Collected data stays local: the sync path writes to the on-device SQLite store only; no network egress exists on this path [R01].
- **Pilot retention is separately bounded** (per audit): if UD-1 ratifies the `06` protocol, pilot label/biometric rows live under an explicit retention window fixed at ratification (candidate: analysis-complete + 90 days, then deletion) — not the app's indefinite descriptive retention (`04` §11).

## 2. Purpose limitation

- The ingestion types split into two purpose tiers (**corrected per audit**): HRV and sleep feed the readiness score, which in turn modulates the planned prescription (load/sets/planned-RPE caps via `policyReference.ts` [R01b, R07]); resting heart rate currently feeds **nothing** (§1b). They must never: influence set RPE or session RPE (including as hints), enter Coach-evidence deltas, or trigger safety halts. Calibration Policy v1 already stripped ACWR/load from readiness for exactly this class of reason [R01]; the same wall applies to every biometric here.
- A future biometric-*context* display (option O4, 08) is a **separate declared purpose**: it requires its own consent moment, its own copy, and its own Play declaration before the first athlete sees it. Silence or buried consent is non-compliant [D02].
- No advertising, analytics, or third-party sharing of any of this data — ever. This matches the strictest platform regime on the board [D03] and is the app's own posture.

## 3. Consent and permission wording

- The consent moment must be: explicit, per-purpose, untied to any other flow, and revocable. The app's existing pattern already embodies this — no permission sheet at boot; the sheet runs only from an explicit CONNECT tap [R01]. Preserve that law for anything future.
- Draft Health Connect permission wording (for any future declaration; not filed now; **corrected per audit**): "Athlete Kinetics reads your nightly heart-rate variability (HRV) and sleep data to calculate your daily readiness score, which is used to adjust your planned training. Resting heart rate, if granted, is stored for your own records and is not currently used in any calculation. Nothing is uploaded. You can disconnect at any time in your profile." Wording rules: name every type; name its actual feature (or its absence); name the locality; name the revocation. No generic "health data" phrases [D02]. **This wording must not be filed until UD-9 (the RHR consuming-feature gap) is resolved.**
- Denial is a first-class state, not an error: the existing `denied` status keeps the full subjective product alive [R01]. Copy must never imply lost functionality beyond the readiness inputs.
- If a future option ever touches a *new* type (this discovery proposes none), its consent copy must name the type and its consuming feature exactly, and the Health apps declaration must match [D04].

## 4. Local storage, retention, deletion, and provenance

- **Storage:** the app's existing SQLite tables (`hrv_daily`, `sleep_daily`, `state_vector`) on device, created and migrated by the frozen schema chain [R01b, R04]. No cloud copy exists; backups follow whatever the athlete's OS does, which the privacy policy must disclose.
- **Retention (stated as fact, not policy):** daily rows accumulate in `hrv_daily`, `sleep_daily`, and `state_vector` and are **retained indefinitely** on device; the app re-materializes and displays a bounded recent window (boot rematerialization ~14 days; trailing trend reads) but **deletes nothing** as of the audited commit. A future retention policy (e.g. auto-prune beyond N years) would be a new, owner-ratified behavior — this discovery neither assumes nor promises one. The only deletion path is the athlete's `resetTrainingData` action.
- **Deletion:** biometric rows die with the athlete's training data via the existing `resetTrainingData` path [R01]; any future biometric table must be registered there. Export behavior, if ever added, must carry the same consent framing as collection (export = disclosure risk).
- **Provenance:** every ingested row currently carries `source = 'health_connect'` [R01]. Future work must keep provenance per row and display it when values are shown: which device class wrote it, when it was written, how stale it is. Vendor heterogeneity (04 S2) makes provenance a truthfulness requirement, not metadata polish — two watches write different things into the "same" column.
- **Staleness:** displayed values must carry their date. A two-day-old HRV shown as current is a silent fabrication.

## 5. Model/algorithm transparency and uncertainty display

- The readiness formula is small, deterministic, and disclosed (renormalized weighted mean of available inputs; neutral 50.0 when nothing exists) [R01b]. This is the transparency bar: **an athlete must be able to learn, in one screen, how a displayed number was computed from what inputs.**
- If a future advisory estimate ever exists (post-06-validation), it must ship with: its input list; its per-athlete calibration basis; a visible uncertainty representation (e.g. an interval, not a point); and a one-tap "why am I seeing this?" disclosure. A bare number next to the athlete's own RPE fails this bar by construction.
- Uncertainty display is not optional garnish: the evidence base shows coarse classification ceilings even in lab settings [S12] and unstable signal quality in the field [S09, S19]. Any displayed estimate must look as unsure as the science is.

## 6. Athlete correction

- The athlete's own entered RPE is authoritative by design [R03]; nothing derived may overwrite, grade, or "fix" it. For any future athlete-editable biometric-context field (e.g. subjective stress/cue entry), the athlete must be able to edit or delete their entries, and edited entries must update any derived display in the same transaction, with no ghost copies.

## 7. Safety framing and the no-medical-use wall

- No medical claim anywhere: no diagnosis, no illness detection, no recovery guarantees, no oxygenation interpretation, no injury prediction. The app's existing stop guidance already draws the right line (pain is not effort; stop on pain, dizziness, loss of control [R05]); biometric surfaces must not blur it.
- **Not for medical emergencies:** no displayed value is a reason to seek or avoid care, and copy must never suggest monitoring ("your oxygen was low overnight" is a forbidden sentence). The strongest available evidence for these signals in a medical direction (HRR's mortality prognostics [S11]) is exactly why the line matters: prognostic semantics must never leak into a training app's copy.
- SpO2's disposition (§8) is the concrete instance: the safest sensor decision is the one not taken.

## 8. SpO2 disposition (explicit, per WO §6)

**Do not collect — in any configuration, for any purpose, under this discovery.** Reasons, in order of weight: (1) no peer-reviewed evidence connects SpO2 to resistance-training effort or proximity to failure (02 §5); (2) consumer-device accuracy is systematically limited vs clinical references [S13, S18], inviting misinterpretation; (3) oxygenation carries medical-monitoring semantics the app must never imply (§7); (4) collecting an unconsumed type is a Play-policy violation pattern (per-data-type justification, [D01, D02, D04]) already flagged in prior platform analysis [R02]; (5) the schema keeps a computed-but-excluded `spo2_component` with weight 0.00 under ratified policy [R01b] — the recommendation stands that it stay excluded and neutral, and that no permission be requested. A future proposal to collect SpO2 must re-open this ruling with new evidence, a consuming feature, and owner ratification.

## 9. Safe fallback when data is absent, denied, stale, contradictory, or unsupported

Each failure mode gets an explicit, pre-declared behavior — the WO requires fallbacks as first-class design:

- **Absent (no wearable / no records for a day):** the day stays null; readiness uses its renormalized neutral fallback [R01b]; no placeholder values, no interpolation, no population imputation. Consistent with Calibration Policy v1's missing-stays-missing law [R01].
- **Denied (permission refused or revoked):** `denied` state; subjective-only product continues unchanged [R01]. No nag loops; a single re-prompt path from the profile.
- **Stale:** values display with their date; stale inputs do not silently masquerade as current. Readiness already re-materializes on fresh data only [R01].
- **Contradictory:** the aggregation layer's rule generalizes — malformed or out-of-domain records are skipped, never propagated [R01]; when two sources disagree at display level, provenance and dates are shown and no merged "truth" is invented.
- **Unsupported (device/platform lacks it):** graceful null bridge; the product baseline is training data + subjective reports, and everything biometric is additive decoration [R01].
- **Contradiction with the athlete:** the athlete's report always wins. If a displayed context value conflicts with how the athlete says they feel, the conflict resolves in favor of the athlete, silently and without argument — the display is a mirror, not a judge.

## 10. Accessibility and equity notes (privacy-adjacent)

- Manual-only path must remain fully functional: every subjective construct (RPE, RIR anchors, session RPE, cues) is usable with zero biometrics, zero wearables, zero extra consent. The privacy-opt-out is simultaneously the accessibility floor (older athletes, low-income athletes, iOS athletes, screen-reader users get the same honest product).
- Any future context display must carry the same type-scale and screen-reader support as existing screens (theme tokens, no hex, accessible labels) — sensor data must never create a second-class interface.
- Consent copy must be plain-language, translatable, and free of coerced framing ("Connect to unlock your full potential" is a dark pattern; "Connect to add HRV and sleep to your readiness score. Optional." is the standard).
