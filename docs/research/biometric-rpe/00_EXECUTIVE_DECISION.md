# 00 — Executive Decision: Advanced Biometric RPE Discovery

- **Work order:** `docs/WORKORDER_ADVANCED_BIOMETRIC_RPE_DISCOVERY.md` (Phase C of `docs/PROGRAM_QUALITY_REMEDIATION_SEQUENCE.md`)
- **Base commit (verified):** `e15bbe9301fe756ecda9d8296877b19e425ac112`
- **Deliverable set:** documentation-only discovery, ten files under `docs/research/biometric-rpe/`
- **Remediation status:** this document set has been through **four independent audit rounds**, every one returning **REQUEST CHANGES** — five P1 findings in round 1; six in round 2, which found errors in the round-1 remediation itself; four P1s plus a P2 set in round 3; and four findings in round 4 (current-evidence correction, handover correction, PR-base correction, and independent reviews still pending). A remediation pass followed each, on the same branch; the full record for all four rounds is `09` §11. **No round has returned an approval.** Independent review of the current state remains **PENDING — OWNER ASSIGNED TO CODEX/SOL**, and nothing in this package should be read as approving the current tip.
- **This run's executor:** GLM 5.3, high effort, per owner dispatch (the sequence's "recommended lead" rows name Gemini models; the owner's model switch is the role assignment)

## 1. Decision

**DECISION TOKEN: RESEARCH PILOT ONLY** — unchanged by remediation, now **provisional** pending the post-remediation Codex/Sol audit.

Exactly one authorized token is returned: **RESEARCH PILOT ONLY — no prescription or athlete-facing estimate.** The audit accepted this token and the SpO2 ruling; its changes correct the evidence landscape and protocol design beneath the token, and the token's rationale is now worded at the bounded scope the corrected evidence supports (consumer-modality validity is *unproven*, not disproven — `02` §4b/§6).

What this token authorizes, and nothing more:

1. The app continues to treat **athlete-entered set RPE (with plain-language RIR-anchored cues), athlete-entered session RPE, and the existing HRV+sleep readiness score** as the only effort/recovery constructs it presents. **Token boundary, stated exactly (per Round 3 closure):** *shipped product code* may not generate, display, pre-fill, or grade athlete RPE from any biometric quantity — unconditionally, in any build. The *offline research pilot* of `06` may compute biometric-derived RPE predictions **solely for blinded validation analysis**: never surfaced to an athlete, never written to a product path, never used to fill or grade a logged set. Pilot output carries **no athlete-facing authority and no prescription authority**. Computing a prediction inside an offline analysis and shipping one to an athlete are different acts; only the first is authorized here.
2. The only future-touching artifact this discovery authorizes is the **prospective, athlete-separated validation protocol in `06_VALIDATION_PROTOCOL.md`** — an offline, owner-gated research pilot to learn whether any individually calibrated advisory estimate is even measurable before anyone talks about shipping one. The pilot writes no product behavior, holds no prescription authority, and requires its own owner ratification before any data collection begins.
3. No new Health Connect record type, no new Android permission, no schema change, and no prescription/prescription-adjacent code change may be introduced by or for this discovery. The SpO2 disposition (§3) is **do-not-collect**.

The app ships honest subjective effort instrumentation today. Whether a biometric context aid can ever be added is now a well-posed, falsifiable research question with a written protocol — not a feature promise.

## 2. Why not the other tokens

**NO-GO was rejected** because the evidence review (`02`, `01`) does not support the strong claim that biometric effort aids are unscientific in general; it supports a narrow, well-defined claim.

**What the evidence does contain (acknowledged explicitly, because earlier drafts wrongly denied it):**
- **PERSIST [S25] is a real resistance-training RPE validation dataset** — public, multimodal, with per-set RPE labels. It is also *small and lab-instrumented*: twelve consenting participants, flywheel squats, synchronized IMUs + ECG + motion capture.
- **[S28] reports held-out-subject per-set RPE prediction** on that class of data using **six IMUs plus a chest ECG sensor with ECG-derived HRV features** (best MAPE 7.71%, r = 0.85, R² = 0.48), and found the HRV features *significantly improved* prediction.

Any statement that "no resistance-training RPE validation dataset exists" is therefore **false and is withdrawn**.

**The defensible boundary, which is the claim this decision actually rests on:** *this review located no sufficiently representative consumer-watch/phone field validation for Athlete App's population and collectible modality* (`02` §4b/§6, `04`). The gap is modality-and-setting-specific — six research IMUs and a chest ECG on a lab flywheel platform are not what this app can collect — not a general absence of research. A NO-GO would also discard the app's own already-built, already-permissioned HRV/sleep/readiness plumbing, which remains valid for its ratified readiness purpose under Calibration Policy v1 [R01].

**ADVISORY PROTOTYPE ELIGIBLE was rejected** because every prerequisite it would lean on is unmet for *this app's data*: **this review located** no individually calibrated model for consumer-device data and no sufficiently representative field-validation dataset for this modality and population (search-bounded wording per Round 4 review — the position is *unproven*, not disproven, and a later source could change it) (the existing datasets are lab-instrumented, small, and homogeneous [S25, S28]), the available population-transfer evidence for resistance training is small, homogeneous, laboratory-based, and collected under instrumentation the shipped app does not have (six IMUs plus chest ECG with ECG-derived HRV in [S28]; IMU + ECG + motion capture in PERSIST [S25]) — thin and off-modality rather than absent; and the WO forbids population coefficients as individual truth [S03, S08]. An advisory estimate today would be an unvalidated number next to an authoritative one — the exact false-reassurance failure the WO's acceptance criteria exclude.

**IMPLEMENTATION ELIGIBLE was rejected** as strictly dominated by the above.

## 3. SpO2 disposition (concise ruling)

**Do not collect.** Not requested, not read, not stored by this discovery, and recommended against for the future:

- The live bridge reads exactly `HeartRateVariabilityRmssd`, `RestingHeartRate`, `SleepSession` — no SpO2 permission exists today [R01], and `spo2_component` is computed-but-excluded from readiness with weight 0.00 under Calibration Policy v1 [R01b].
- Prior platform analysis already ruled do-not-read SpO2 under Health Connect's per-data-type justification enforcement [R02].
- The peer-reviewed literature establishes only that a validated smartwatch pulse oximeter can *detect short-time hypoxemia* comparably to a medical-grade device under controlled desaturation [S13] and that consumer-device accuracy otherwise warrants caution [S18]. Nothing connects SpO2 to resistance-training proximity to failure. Collecting an oxygenation signal without a consumed feature and without this connection imports medical-monitoring semantics, privacy burden, and Play policy exposure (per-data-type declaration, purpose limitation [D02, D03]) for zero scientific return.

Full ruling: `05_PRIVACY_AND_SAFETY.md` §8.

## 4. Design constants carried forward

These are restatements of the WO's non-negotiables, kept beside the decision so no future reader has to reopen the WO:

- Unanswered actual RPE stays `NULL` — never imputed from biometrics, planned RPE, or population data [R03]. Existing null semantics are unchanged.
- Set RPE, session RPE, readiness, and physiological observations remain distinct constructs on separate state paths (`01_CONSTRUCT_MAP.md` §12).
- No medical, injury, oxygenation, fatigue, or recovery claims anywhere in athlete-facing copy.
- Any future estimate proposal must clear the prospective validation protocol in `06` first — athlete-separated, pre-registered thresholds, owner/domain-expert sign-off.

## 5. Review status

The first freeze was independently audited (REQUEST CHANGES, five P1 findings — S12 misreport, missed resistance-training literature, incoherent validation split, privacy/architecture mapping errors, and residual citation errors). All five findings are remediated in the remediation record `09` §11; the audit's additional required corrections (memory claim, retention truth, partial-grant model, chest-strap attribution, D05 row) are likewise addressed. **Independent review of the post-remediation state remains PENDING — OWNER ASSIGNED TO CODEX/SOL.** This run did not fabricate reviewer verdicts and does not claim the workorder's independent-review acceptance criterion (§10) is satisfied. `09_INDEPENDENT_REVIEW_HANDOVER.md` is the auditor entry point.

## 6. Addendum: the RHR consuming-feature gap (UD-9, disclosed per audit; complete data map per Round 3 closure)

Resting heart rate is a requested Health Connect type. Its **complete** current handling, stated exactly from the live code [R09] — earlier drafts' "feeds no computation" / "feeds nothing" wording was an overstatement and is withdrawn:

1. **Requested and read.** `RestingHeartRate` is one of the three record types the bridge requests and reads [R01].
2. **Stored — conditionally, never unconditionally.** When a day's rMSSD exists, RHR is written **alongside** it in the same `hrv_daily` upsert (`useStore.ts:4232-4238`). An **RHR-only** day merely `UPDATE`s an already-existing `hrv_daily` row; where no row exists for that date the value **is not persisted at all** (`useStore.ts:4239-4243`). "RHR is always stored" is therefore also false.
3. **No readiness, planned-load, planned-set, or RPE-cap contribution.** The materialized readiness score uses HRV and sleep only [R01b], and RHR appears in no prescription path.
4. **Exposed through the history accessor.** `loadMeasuredHistory` selects `hrv_daily.resting_hr` and returns it as `restingHr` on every measured-history row (`useStore.ts:4384-4405`).
5. **Counted in a developer diagnostic.** The Coach verification lab's evidence-window calculation counts a day toward `hrvDays` when rMSSD **or** RHR is present (`coachVerificationLab.ts:362-377`). This is a diagnostic *availability* count — **not** readiness input and **not** prescription use, and it must not be represented as either.

So RHR is read, conditionally stored, exposed through a history accessor, and counted by an internal diagnostic — and it still has **no genuine athlete-facing consuming feature**. Under Google's per-data-type justification requirement [D02, D05] that remains a declaration risk: neither a developer-facing diagnostic count nor an internal history accessor reads as a user-facing benefit. **UD-9 therefore stands as a valid Play/declaration issue.** The owner must choose: drop the RHR request, give it a consuming feature, or document an explicit justification (`08` UD-9). Until resolved, no Health apps declaration should be filed for the current permission set, and no consent copy may claim RHR feeds readiness — the ProfileScreen connected-state copy currently does (`ProfileScreen.tsx:413-417`), which is **UD-10**: a product-code defect that this documentation-only work order must **not** fix here.
