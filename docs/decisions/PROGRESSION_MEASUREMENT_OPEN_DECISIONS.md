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

**Further investigation if requested:** protocol design must specify repeated-measure conditions,
missing RPE handling, exercise stratification, training status, bias, reliability, uncertainty,
and a predeclared analysis. Designing or running that research is outside this phase.

## 5. Descriptive versus prescriptive authority

**Current state:** progression measurements have no authority over prescription.

**Evidence boundary:** reviewed autoregulation studies are supervised, heterogeneous, and
terminologically inconsistent [H-Q8-01]. The audit found no paper establishing a mandatory
descriptive-only rule for this application; the no-prescription boundary is therefore a product
and safety decision, not a research result.

**Owner ruling needed:** retain the current separation indefinitely, or authorize a later
evidence-and-control-design phase. No feedback-loop design is authorized here.

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
4. **Metric-display behavioural review:** direct evidence would be needed before claiming that a
   strength metric will improve adherence or cause gaming.
5. **Control-system safety review:** required before any progression signal gains prescription
   authority.
6. **Push-up biomechanics verification:** needed only if exact force values or coefficients are
   product-critical. Not authorized: decision 5 was ratified (a) on
   2026-08-26. Reopening requires the product-critical condition to arise first.

## 9. Ratification record

| Decision | Owner ruling | Date | Evidence/protocol reference |
|---|---|---|---|
| Dormant e1RM series | Pending | — | H-Q2-03/04/05/07; H-Q5-01 |
| Hard-set count | Pending | — | H-Q3-02; A-Q3-01/03/04; A-Q7-02 |
| Own-data repeatability protocol | Pending | — | A-Q2-04; H-Q5-03; A-Q5-03/04 |
| Descriptive/prescriptive boundary | Pending | — | H-Q8-01; A-Q8-01/02/03 |
| Push-up full-text verification | **Ratified — (a) do not pursue** | 2026-08-26 | A-Q4-01/02/03 |
| Evidence archive location and retention | **Ratified — (b) preserve in-repo, indefinite** | 2026-08-26 | Canonical artifact hash table |
