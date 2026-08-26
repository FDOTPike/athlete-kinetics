# Progression measurement — open owner decisions

Date: 2026-08-26  
Status: **owner decisions required — no option selected and no implementation authority**

## 1. Decision boundary

The independent audit supports a corrected evidence record, not a product design. The canonical
evidence boundary is
[`PROGRESSION_MEASUREMENT_EVIDENCE_BASELINE.md`](../research/PROGRESSION_MEASUREMENT_EVIDENCE_BASELINE.md).

No option below is a recommendation. No selection may introduce a numerical threshold without a
separate Calibration Policy ratification recorded against its evidence or approved own-data
protocol.

## 2. Dormant e1RM series

**Current state:** `packages/inference/src/e1rm.ts` contains pure derivation functions. The pinned
baseline has no store getter, persistence, display, threshold, plateau detector, or prescription
consumer.

**Evidence boundary:** RIR/RTF prediction has material observed error [H-Q2-04; H-Q2-05]. Direct
supervised 1RM reliability [H-Q5-01] does not establish app-e1RM reliability or MDC. The audit's
documented search did not locate qualifying direct validation of the additive RIR substitution
or an app-specific e1RM MDC [H-Q2-03; H-Q2-07].

**Owner ruling needed:** whether e1RM remains dormant, becomes a descriptive display in a later
work order, or waits for an app-specific measurement protocol.

**Owner ruling — ratified 2026-08-26: option (a), remains dormant, with a disclosure rider.**
The series stays dormant by default: no store getter, persistence, display, threshold, detector, or
prescription consumer. The owner additionally directs that a **disclosure path gated to advanced
athletes** be scoped as future work, so that athletes at `training_age IN ('advanced', 'elite')`
(`TRAINING_AGES` in `packages/inference/src/types.ts:40`) may opt to uncover the derived series as
extra data.

**The rider is not ratified by this ruling and must not be built on it.** Gating changes *who sees*
the number; it does not change *how precise* the number is. An advanced athlete reading an e1RM
series with no established error bound is chasing a value whose movement may be noise, exactly as a
beginner would be. A gated disclosure is therefore option (b) behind an eligibility check, and
requires its own ratification against the measurement work in section 4 — specifically, an honest
statement of precision shown alongside the number, or an explicit ruling that the series may be
shown without one.

**Further investigation if requested:** full-text verification of H-Q2-02, A-Q2-01, and related
equation-error claims; or a separately designed closed-beta repeatability protocol. This phase
does not perform either investigation.

## 3. Hard-set count

**Current state:** migration 001 maintains `hard_sets` for sets logged at `RPE >= 8`; policy
tests keep it out of prospective planning.

**Evidence boundary:** the audit did not validate `RPE >= 8` as a superior app proxy. The claimed
hard-set-versus-tonnage correlation has no accessible source locator [A-Q3-03], and the
documented search did not locate a qualifying direct proxy comparison [H-Q3-02].

**Owner ruling needed:** whether the count remains internal, is considered for descriptive
display in a later work order, or is excluded from progression reporting.

**Owner ruling — ratified 2026-08-26: option (b), considered for descriptive display in a later
work order.** The count stays internal until that work order exists; this ruling authorizes no
display, surface, or schema change now.

Binding constraints on any such work order:

- Descriptive use does not breach the machine tripwire at `apps/mobile/test/verify_policy.mjs:398`,
  which forbids `hard_sets` and `session_rpe` reaching a prospective planner. A display is not a
  planner. A prescriptive use would breach it and is not authorized.
- `RPE ≥ 8` remains an **unvalidated** proxy. The audit did not establish it as superior to any
  alternative, the claimed correlation has no accessible source locator, and no qualifying direct
  proxy comparison was located. Any display must therefore present it as a count of sets logged at
  or above a chosen effort mark — not as a validated measure of effective volume, stimulus, or
  hypertrophic dose.

**Further investigation if requested:** obtain and inspect the Baz-Valle full text for the exact
R² attribution, then separately determine whether any result transfers to the app's optional,
unsupervised RPE input. This phase performs neither task.

## 4. App-specific repeatability and stagnation

**Current state:** no e1RM MDC, noise floor, persistence window, smoother, plateau detector, or
stagnation authority is ratified or implemented.

**Evidence boundary:** the Antigravity MDC/window calculations are auditor-derived and rely on
unvalidated substitutions and assumed adaptation rates [A-Q2-04; A-Q5-03; A-Q5-04]. Direct 1RM
reliability cannot supply the missing app-e1RM quantities.

**Owner ruling needed:** whether stagnation detection remains out of scope or whether a future
phase should design an own-data measurement protocol for later ratification.

**Owner ruling — ratified 2026-08-26: option (b), a future phase designs an own-data measurement
protocol for later ratification.** Stagnation detection stays out of scope until that protocol is
designed, run, and separately ratified. No MDC, noise floor, persistence window, smoother, or
plateau detector is authorized by this ruling.

The owner directs that this phase may run **concurrently with the KineStrike instrumentation
project** (`KINESTRIKE_MECHATRONIC_SYSTEM_AUDIT_REPORT.md`, ENG233, piezoelectric polymer insole).
What the two share is **method, not data**: both require establishing what an own-device
measurement's repeatability, noise floor, and minimal detectable change actually are before any
threshold derived from it can carry authority. Strength-progression e1RM and gait kinetics are
different measurands; no coefficient, threshold, or reliability figure transfers between them, and
concurrency must not become substitution.

**Further investigation if requested:** protocol design must specify repeated-measure conditions,
missing RPE handling, exercise stratification, training status, bias, reliability, uncertainty,
and a predeclared analysis. Designing or running that research is outside this phase.

## 5. Descriptive versus prescriptive authority

**Current state — clarified 2026-08-26 after an owner challenge.** The earlier one-line statement
was accurate but invited a broader reading, and the owner correctly observed that the app already
does both. Stated precisely:

**The app is already prescriptive.** `packages/inference/src/completionAction.ts` emits
`dLoad_p`/`dSet_p`/`dRpe_p` corrections, and `kinematicAutopilot.ts` states in its own header that
its control action `u` "produces forward-looking PRESCRIPTION corrections only." Those corrections
reach the athlete through `blockGenerator.ts:707-731`.

**What it prescribes from is execution and tolerance, not progression.** The autopilot's input
`StateVectorRow` (`types.ts:7`) carries readiness, HRV, sleep, SpO2, ACWR and load — physiological
state. `completionAction.ts` reads shortfall against prescribed sets — execution. Niggle severity
carries joint tolerance. Every one of these answers *how did the athlete cope with what was
prescribed*.

**No progression measurement reaches any prescriptive path.** `e1rm.ts` is consumed only by a
barrel re-export at `index.ts:349-353` and by nothing else; `hard_sets` is held out of every
prospective planner by the tripwire at `apps/mobile/test/verify_policy.mjs:398`. Nothing in the
engine answers *is the athlete getting stronger* and then changes the prescription because of it.

This decision governs **only that second class**: whether a measurement of progression may acquire
prescription authority. It does not reopen the readiness, completion, or tolerance paths, which are
already ratified and in service.

**Evidence boundary:** reviewed autoregulation studies are supervised, heterogeneous, and
terminologically inconsistent [H-Q8-01]. The audit found no paper establishing a mandatory
descriptive-only rule for this application; the no-prescription boundary is therefore a product
and safety decision, not a research result.

**Owner ruling needed:** retain the current separation indefinitely, or authorize a later
evidence-and-control-design phase. No feedback-loop design is authorized here.

**Sequencing note added 2026-08-26.** Decision 3 was ratified (b): the own-data measurement protocol
is future work and no repeatability, noise floor, or minimal detectable change yet exists for any
progression measurement. Until that protocol lands, a progression measurement has no established
precision, so option (b) here cannot be exercised responsibly even if ratified — there would be
nothing to state a confidence bound against. This decision is therefore gated behind decision 3 in
practice, whichever way it is ruled.

**Out of scope for this decision: new measurement domains.** The KineStrike instrumentation project
proposes giving a gait-kinetics measurement direct prescription authority (automatic session halt,
automatic deload, automatic niggle insertion). That is the same *class* of question but a different
measurand and a different safety profile, and it is not covered by this ruling. It requires its own
boundary decision and its own system-safety brief.

**Further investigation if requested:** establish a separate system-safety brief covering signal
missingness, bias, failure modes, authority limits, and prospective validation before any control
proposal is drafted.

## 6. Push-up variation force values

**Current state:** the capability graph uses ordinal movement relationships; no audited force
coefficient is authorized.

**Evidence boundary:** accessible abstracts support force differences by push-up condition, not
the claimed exact `41/49/64/74%` values, continuous interpolation, or a common scale with barbell
work [A-Q4-01].

**Owner ruling needed:** whether the exact values are important enough to justify full-text
verification. Until then, preserve ordinal relationships without adding evidence claims or
coefficients.

**Owner ruling — ratified 2026-08-26: option (a), do not pursue.** The exact values are not
product-critical. Push-up variations remain ordered by `movement_progression.progression_rank`
(`packages/core-db/src/schema/016_movement_library_seed.sql`), an integer ordinal that carries
sequence and no magnitude. No force coefficient, percentage of bodyweight, continuous
interpolation, or common scale with barbell work is authorized. The `41/49/64/74%` figures remain
quarantined and must not appear as a default, example, fixture, comment, or candidate constant.

**What this ruling does not assert:** it is a decision not to spend verification effort. It is not
a finding that the published values are wrong, and it does not convert “not located” into a
literature conclusion. Option (b) remains available unchanged if exact values later become
product-critical.

**Further investigation if requested:** inspect the relevant full-text tables and record exact
conditions, apparatus, population, uncertainty, and transfer limits. This phase does not perform
that investigation.

## 7. Evidence archive durability

**Current state:** the six binding audit artifacts are stored outside this repository at the path
recorded in the canonical evidence baseline. Their SHA-256 hashes are recorded in-repository, but
a hash cannot make a missing artifact independently inspectable.

**Owner ruling needed:** whether to preserve an immutable copy in a durable archive, and which
location and retention rule should be authoritative. No copy or relocation is authorized by this
documentation phase.

**Owner ruling — ratified 2026-08-26: option (b), preserve an immutable copy, with this
repository as the authoritative location.**

- **Unit preserved:** the complete 25-file audit run, not the six binding artifacts alone. The six
  are conclusions; `checkpoints/`, `calculations/`, `inputs/`, `VERDICT_LOCK.json`,
  `source_metadata.json` and `workorder.md` are the derivation trail that makes the run
  re-checkable rather than merely re-readable.
- **Location:** `docs/research/audits/progression-terra-2026-08-26/`. Copied **unscrubbed**, so the
  archived bytes hash-match what the audit produced. The owner accepted that the run's sixteen
  author-local absolute paths become public when this branch is pushed; a scan found no credential
  or personal data.
- **Retention:** indefinite and immutable. Never edited in place, never deleted. A later audit of
  the same claims is added as a new dated run directory **alongside**, never replacing this one.
- **Byte preservation is enforced, not assumed.** Seventeen of the twenty-five files contain CRLF,
  including all six binding artifacts. The repository's default `* text=auto eol=lf` rule would
  have rewritten them on commit and checkout and broken every recorded hash. `.gitattributes` now
  carries `docs/research/audits/** -text` to disable conversion; removing that rule silently
  invalidates the archive.
- **Verification recorded at ratification:** all 25 files byte-identical to the originating copy by
  `diff -r`; all 25 staged git blobs hash-equal to their source files; all six binding hashes match
  the table in the canonical evidence baseline; `sha256sum -c` over the 25-file manifest reports 25
  `OK` and 0 failures.
- **What this ruling does not do:** it preserves an evidence record. It ratifies no conclusion the
  audit reached, and confers no authority on any number inside the archive. The quarantine list
  stands unchanged.
- The originating copy at the author-local path was left in place. Nothing was moved or deleted.

## 8. Investigation backlog — not authorized in this phase

The following work remains available for later, separately approved tasks:

1. **Full-text claim verification:** the 14-item queue in the canonical evidence baseline.
2. **Systematic negative-claim searches:** required before strengthening “not located” into a
   broader literature conclusion.
3. **Closed-beta repeatability protocol:** required before app-specific MDC or stagnation work.
   **Authorized as future work by decision 3, ratified 2026-08-26**, and may run concurrently with
   the KineStrike instrumentation project. Shared method only; see section 4.
4. **Metric-display behavioural review:** direct evidence would be needed before claiming that a
   strength metric will improve adherence or cause gaming.
5. **Control-system safety review:** required before any progression signal gains prescription
   authority.
6. **Push-up biomechanics verification:** needed only if exact force values or coefficients are
   product-critical. Not authorized: decision 5 was ratified (a) on
   2026-08-26. Reopening requires the product-critical condition to arise first.

7. **KineStrike boundary decision:** if the instrumentation project's host-integration section is
   pursued, it needs a decision of its own on whether a gait measurement may halt a session, insert
   a niggle, or trigger a deload. Not covered by decision 4, which governs progression measurement
   only.


## 9. Ratification record

| Decision | Owner ruling | Date | Evidence/protocol reference |
|---|---|---|---|
| Dormant e1RM series | **Ratified — (a) dormant; gated-disclosure rider unratified** | 2026-08-26 | H-Q2-03/04/05/07; H-Q5-01 |
| Hard-set count | **Ratified — (b) descriptive display, later work order** | 2026-08-26 | H-Q3-02; A-Q3-01/03/04; A-Q7-02 |
| Own-data repeatability protocol | **Ratified — (b) future phase designs protocol** | 2026-08-26 | A-Q2-04; H-Q5-03; A-Q5-03/04 |
| Descriptive/prescriptive boundary | Pending — re-scoped 2026-08-26, see section 5 | — | H-Q8-01; A-Q8-01/02/03 |
| Push-up full-text verification | **Ratified — (a) do not pursue** | 2026-08-26 | A-Q4-01/02/03 |
| Evidence archive location and retention | **Ratified — (b) preserve in-repo, indefinite** | 2026-08-26 | Canonical artifact hash table |
