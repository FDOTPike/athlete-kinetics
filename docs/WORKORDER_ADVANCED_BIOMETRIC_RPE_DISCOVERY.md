# Work Order — Advanced Biometric RPE Discovery

## 0. Control Record

- **Status:** PARKED UNTIL THE PROGRAM-QUALITY CANDIDATE IS FROZEN.
- **Role:** research, validation, privacy, and architecture agent.
- **Recommended lead:** Gemini 3.1 Pro at High effort.
- **Recommended feasibility checker:** Gemini 3.7 Flash at High effort in a separate context.
- **Working directory:** C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\program-quality-remediation
- **Mode:** read-only product inspection plus documentation writes.
- **Product-code authority:** none.

## 1. Objective

Determine whether any defensible optional biometric aid can help an athlete understand or report effort without pretending that a phone or wearable directly knows lifting RPE.

The output is a decision-ready specification, not a feature. It must distinguish:

- set RPE;
- reps in reserve;
- session RPE;
- daily readiness/recovery; and
- physiological measurements such as heart rate, heart-rate recovery, HRV, SpO2, respiratory rate, sleep, and user-reported stress.

## 2. Starting Facts to Verify

Inspect the live repository before research:

- packages/biometrics/src/healthConnect.ts currently provides an optional Android Health Connect bridge;
- packages/biometrics/src/aggregate.ts compacts supported daily records;
- packages/biometrics/test/verify_biometrics.mjs protects current aggregation behavior;
- apps/mobile/src/state/useStore.ts imports optional readiness data and works without it;
- apps/mobile/src/screens/ReadinessScreen.tsx presents readiness separately from actual set RPE;
- apps/mobile/src/screens/SessionScreen.tsx records actual RPE only after athlete interaction;
- docs/ANALYSIS_ios_biometrics_gap.md contains prior platform and SpO2 analysis; and
- Calibration Policy v1 and existing readiness behavior must not be silently expanded.

Treat those as repository claims to check, not as scientific validation.

## 3. Non-Negotiable Boundaries

- Do not modify TypeScript, JavaScript, SQL, native Android/iOS, dependencies, permissions, or release files.
- Do not add a sensor permission.
- Do not read new Health Connect data types.
- Do not create a biometric-derived RPE score.
- Do not convert readiness into set RPE.
- Do not backfill missing athlete answers.
- Do not make a diagnosis or injury, oxygenation, fatigue, or recovery claim.
- Do not imply that SpO2, heart rate, HRV, or stress alone measures resistance-training proximity to failure.
- Do not reuse population coefficients as individual truth without a validation plan.
- Do not claim clinical, sports-science, or device accuracy from a prototype.
- Do not weaken the existing null semantics for unanswered actual RPE.

## 4. Research Questions

### 4.1 Construct Definition

For each candidate construct, define:

- what it is intended to measure;
- the time window;
- whether it is subjective or physiological;
- whether it applies to a single set, exercise, session, or day;
- the expected ground truth; and
- why it must not be conflated with the other constructs.

At minimum compare:

- set RPE;
- repetitions in reserve;
- session RPE;
- talk/breathing cues;
- rep velocity or velocity loss;
- exercise heart-rate response and recovery;
- resting heart rate;
- HRV;
- sleep;
- SpO2; and
- perceived stress.

### 4.2 Evidence

Use current primary peer-reviewed research and official platform/device documentation. For every material claim record:

- exact source;
- publication date;
- study population;
- exercise modality;
- device or measurement method;
- sample size;
- reported uncertainty or limits;
- whether the evidence supports correlation, prediction, or causal use; and
- applicability limits for this app.

Do not cite a marketing page as validation. Reviews may orient the search, but numerical or clinical claims must trace to primary research or an authoritative standard.

### 4.3 Data Availability and Quality

Map what can actually be obtained on Android through the currently pinned Health Connect integration and likely wearables:

- data type;
- source device;
- sampling frequency;
- timestamp and synchronization delay;
- foreground/background availability;
- permission;
- missingness;
- vendor differences;
- likely battery/memory cost;
- whether the phone alone can provide it; and
- whether it is available at set time or only later.

Treat phone-only, watch, chest strap, pulse oximeter, and manually entered data as different configurations.

### 4.4 Confounders and Failure Modes

Explicitly evaluate:

- exercise type and muscle mass;
- set duration;
- rest interval;
- breath holding and Valsalva;
- caffeine or stimulants;
- heat and hydration;
- altitude;
- medication;
- illness;
- anxiety;
- sensor fit and motion artifact;
- skin perfusion;
- device lag;
- individual conditioning;
- circuit versus heavy strength work; and
- missing or stale records.

Provide adversarial examples where the same biometric observation could correspond to very different actual RPE.

### 4.5 Product Options

Compare at least:

1. plain-language RPE/RIR cues only;
2. optional user-entered breathing/talk/form cues;
3. post-session session-RPE prompt;
4. biometric context displayed beside, but never converted into, athlete RPE;
5. individually calibrated advisory estimate with explicit uncertainty; and
6. no biometric effort feature.

For each option report benefit, risk, data requirements, validation burden, privacy burden, offline behavior, accessibility, device support, and failure-safe behavior.

## 5. Validation Design

Produce a prospective validation plan before recommending any estimate:

- define target label and collection timing;
- define participant tiers and exercise modalities;
- separate training and holdout athletes to prevent identity leakage;
- establish a manual RPE/RIR reference protocol;
- capture device/source metadata;
- predefine missing-data behavior;
- evaluate calibration by athlete as well as pooled performance;
- report uncertainty, bias, false reassurance, and high-effort miss rates;
- test across strength sets, hypertrophy sets, conditioning, and bodyweight work;
- include counterexamples and sensor dropout;
- require an opt-out and manual-only path; and
- specify who is qualified to approve the protocol.

Do not invent acceptance thresholds. Recommend candidate thresholds with evidence and leave them as explicit owner/domain-expert decisions.

## 6. Privacy, Consent, and Safety

The specification must cover:

- data minimization;
- purpose limitation;
- explicit consent;
- Health Connect permission wording;
- local storage and retention;
- export/delete behavior;
- source provenance;
- whether raw high-frequency data is necessary;
- model/algorithm transparency;
- uncertainty display;
- user correction;
- no use for medical emergencies; and
- a safe fallback when data is absent, denied, stale, contradictory, or unsupported.

SpO2 requires a separate explicit disposition. Do not recommend collecting it merely because the schema or a wearable can expose it.

## 7. Repository Impact Analysis

Without editing product code, identify the smallest hypothetical architecture for each viable option:

- pure domain types;
- optional bridge boundaries;
- aggregation;
- persistence;
- provenance;
- UI;
- tests;
- migration needs;
- permission/policy impact;
- memory impact on a 4 GB device; and
- rollback/feature-flag behavior.

State how the design keeps these values separate:

- observed biometric;
- derived biometric feature;
- readiness;
- advisory effort estimate;
- athlete-confirmed actual RPE; and
- planned target RPE.

## 8. Required Deliverables

Write only:

- docs/research/biometric-rpe/00_EXECUTIVE_DECISION.md
- docs/research/biometric-rpe/01_CONSTRUCT_MAP.md
- docs/research/biometric-rpe/02_EVIDENCE_REVIEW.md
- docs/research/biometric-rpe/03_SOURCE_MANIFEST.csv
- docs/research/biometric-rpe/04_ANDROID_DATA_FEASIBILITY.md
- docs/research/biometric-rpe/05_PRIVACY_AND_SAFETY.md
- docs/research/biometric-rpe/06_VALIDATION_PROTOCOL.md
- docs/research/biometric-rpe/07_ARCHITECTURE_OPTIONS.md
- docs/research/biometric-rpe/08_DECISION_DOCKET.md
- docs/research/biometric-rpe/09_INDEPENDENT_REVIEW_HANDOVER.md

The executive decision must return exactly one:

- NO-GO — retain manual RPE/RIR aids only;
- RESEARCH PILOT ONLY — no prescription or athlete-facing estimate;
- ADVISORY PROTOTYPE ELIGIBLE — still no automatic actual RPE; or
- IMPLEMENTATION ELIGIBLE — only after listed owner, scientific, privacy, platform, and validation gates.

## 9. Independent Review

Commission two fresh read-only reviewers:

- **Reviewer A — evidence:** source quality, construct validity, population fit, confounders, and whether conclusions exceed evidence.
- **Reviewer B — engineering/privacy:** repository fit, permissions, data minimization, failure modes, 4 GB memory implications, and separation from prescription state.

Do not tell either reviewer the desired verdict. Any material disagreement remains open in the decision docket.

## 10. Acceptance Criteria

- every scientific claim has a source-manifest row;
- primary research and official platform documentation support material claims;
- set RPE, session RPE, and readiness are never conflated;
- no code or permission changes occur;
- uncertainty and missingness are first-class;
- phone-only and wearable-assisted modes are separated;
- SpO2 receives an explicit collect/do-not-collect ruling;
- validation is prospective and athlete-separated;
- privacy and deletion behavior are specified;
- manual RPE remains authoritative and optional;
- both independent reviews are attached; and
- the owner receives a bounded go/no-go decision rather than a speculative feature promise.

## 11. Ready-to-Paste Research Prompt

    Work at High effort as the research and architecture lead.
    In C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\program-quality-remediation, execute docs/WORKORDER_ADVANCED_BIOMETRIC_RPE_DISCOVERY.md exactly.
    This is documentation-only discovery. Do not modify product code, migrations, dependencies, permissions, or prescriptions. Use current primary research and official platform documentation, preserve unanswered actual RPE as null, and commission the two independent reviews required by the work order.
    Return the exact decision token, deliverable paths, source counts, material uncertainties, reviewer verdicts, and every owner/domain-expert decision still required.
