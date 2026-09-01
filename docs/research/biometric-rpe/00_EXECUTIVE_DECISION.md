# 00 — Executive Decision: Advanced Biometric RPE Discovery

- **Work order:** `docs/WORKORDER_ADVANCED_BIOMETRIC_RPE_DISCOVERY.md` (Phase C of `docs/PROGRAM_QUALITY_REMEDIATION_SEQUENCE.md`)
- **Base commit (verified):** `e15bbe9301fe756ecda9d8296877b19e425ac112`
- **Deliverable set:** documentation-only discovery, ten files under `docs/research/biometric-rpe/`
- **Independent review status:** `PENDING — OWNER ASSIGNED TO CODEX/SOL` (owner override for this run: the two in-run reviewers described in WO §9 were not commissioned; Codex/Sol audit tomorrow audits this frozen output)
- **This run's executor:** GLM 5.3, high effort, per owner dispatch (the sequence's "recommended lead" rows name Gemini models; the owner's model switch is the role assignment)

## 1. Decision

**DECISION TOKEN: RESEARCH PILOT ONLY**

Exactly one authorized token is returned: **RESEARCH PILOT ONLY — no prescription or athlete-facing estimate.**

What this token authorizes, and nothing more:

1. The app continues to treat **athlete-entered set RPE (with plain-language RIR-anchored cues), athlete-entered session RPE, and the existing HRV+sleep readiness score** as the only effort/recovery constructs it presents. No biometric quantity may be displayed as, converted into, or graded against any form of RPE.
2. The only future-touching artifact this discovery authorizes is the **prospective, athlete-separated validation protocol in `06_VALIDATION_PROTOCOL.md`** — an offline, owner-gated research pilot to learn whether any individually calibrated advisory estimate is even measurable before anyone talks about shipping one. The pilot writes no product behavior, holds no prescription authority, and requires its own owner ratification before any data collection begins.
3. No new Health Connect record type, no new Android permission, no schema change, and no prescription/prescription-adjacent code change may be introduced by or for this discovery. The SpO2 disposition (§3) is **do-not-collect**.

The app ships honest subjective effort instrumentation today. Whether a biometric context aid can ever be added is now a well-posed, falsifiable research question with a written protocol — not a feature promise.

## 2. Why not the other tokens

**NO-GO was rejected** because the evidence review (`02`, `01`) does not support the strong claim that biometric effort aids are unscientific in general; it supports a weaker, well-defined claim: no existing evidence converts heart rate, HRV, sleep, SpO2, or stress signals into resistance-training set RPE with demonstrated athlete-level validity [S01–S08, S14]. A NO-GO would also discard the app's own already-built, already-permissioned HRV/sleep/readiness plumbing, which remains valid for its ratified readiness purpose under Calibration Policy v1 [R01].

**ADVISORY PROTOTYPE ELIGIBLE was rejected** because every prerequisite it would lean on is unmet: no individually calibrated model exists, no validation dataset exists, no population-transfer evidence exists for resistance training, and the WO forbids population coefficients as individual truth [S03, S08]. An advisory estimate today would be an unvalidated number next to an authoritative one — the exact false-reassurance failure the WO's acceptance criteria exclude.

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

Independent review is **PENDING — OWNER ASSIGNED TO CODEX/SOL**. This run did not commission the two reviewers the WO describes, did not fabricate reviewer verdicts, and does not claim the workorder's independent-review acceptance criterion (§10) is satisfied. `09_INDEPENDENT_REVIEW_HANDOVER.md` is the auditor entry point.
