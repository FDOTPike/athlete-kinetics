# Accessible Coach Decision Checkpoint — 2026-09-12

## 1. Authority

- Status: `ORCHESTRATOR RECOMMENDATION — OWNER APPROVAL PENDING — CLINICAL APPROVAL PENDING`.
- Owner/product decider: Francis.
- Qualified clinical reviewer: not yet identified.
- Shared migration reservation: `064`; no SQL has been created.
- Inputs: `docs/research/accessible-coach/WO04_POLICY_DECISION_DOCKET.md`, `docs/audits/accessible-coach/WO06_CLINICAL_CONTRACT_REVIEW.md`, `docs/audits/accessible-coach/WO08_ACTIVITY_MOVEMENT_COVERAGE.md`, and `docs/decisions/ACCESSIBLE_COACH_SHARED_CONTRACT_DOCKET.md`.
- Rule: this document presents concrete choices at the existing checkpoint. It does not ratify policy, authorize medical logic, or authorize Migration 064.

## 2. Product and programming recommendations

| ID | Recommended disposition | Status after this checkpoint |
|---|---|---|
| D01 | Prefill only activity the athlete confirms is familiar plus the time they choose to make available. Missing type, dose, duration, and effort remain unknown. Do not invent a universal starter dose. | Francis decision pending; clinical/programming review required before any prescribed starter dose. |
| D02 | Desired end state: remove experience-tier-only workload uplift. Safe interim: do not use or describe the new accessible flow as conforming while the legacy uplift remains. Movement eligibility remains under existing ratified rules. | Francis and programming/architecture decision pending. |
| D03 | Use the preceding 28 local days plus an explicitly dated typical-week report. No log is not proof of inactivity or rest. | Francis decision pending. |
| D04 | Store whole-session duration plus optional athlete-reported Effort using a named scale. Permit duration-only records. A duration × effort value may be labelled rough/descriptive only; it is not a safety, recovery, equivalence, or sport-substitution score. | Francis and programming review pending. |
| D05 | Use stable IDs for activity definition, recurrence series, and occurrence; link planned and actual states explicitly. Resolve suspected duplicates explicitly, never by fuzzy name/time matching. | Francis/integration approval pending. |
| D06 | Preserve fixed external commitments as calendar facts. Fit only flexible coach work into remaining user-confirmed time. Expose conflicts; do not silently move sport or treat a fixed booking as health clearance. | Francis approval pending. |
| D07 | Approve only state/provenance capture in the first schema slice. Defer exact clinical screening questions and executable transitions to a qualified Australian clinical review, starting from APSS with ACSM as comparator. | Clinical approval pending. |
| D08 | Allow structured, user-confirmed transcription with units, scope, lifecycle, and `user_reported` provenance. Keep free text non-executable. Confirmation proves transcription, not medical verification. | Francis approval plus clinical review of executable limit types pending. |
| D09 | Model capability/connection/freshness truthfully and show monitoring as unavailable until native evidence exists. Historical imports are never live monitoring. | WO-07 and clinical warning-semantics review pending. |
| D10 | Quarantine the legacy experience-dependent symptom assumptions from new health-support claims. Do not treat monotonicity tests as medical validation. | Qualified clinical review pending. |

## 3. Shared data-contract recommendations

| ID | Recommended disposition | Required implementation consequence after approval |
|---|---|---|
| SC-01 | Separate athlete-owned activity definitions, recurrence series, occurrences/actuals, clinician-instruction revisions, applicability scopes, and recommendation-support records. | One shared contract module and one Migration 064; no WO-specific parallel tables or IDs. |
| SC-02 | Store recurrence as local civil intent plus IANA time zone. Materialize occurrences with resolved instants, source rule version, and explicit handling of ambiguous/nonexistent local times. Travel never silently changes the series home zone. | Pure resolver receives time/zone data; ambiguous DST state requires a visible choice. |
| SC-03 | Use non-medical broad demand `low | moderate | high | unknown` plus explicit source/unknown state. Do not infer demand from a custom name. | Missing descriptors remain unknown and cannot grant an adaptation. |
| SC-04 | Put no executable numeric medical threshold or validation range in Migration 064. The first schema stores typed drafts/revisions and review state; executable types/units wait for clinical approval. | Capture/display can ship separately from clinical enforcement, with truthful capability labels. |
| SC-05 | Default athlete-entered instruction provenance to `user_reported`; provide no `verified` state until an actual offline verification workflow and authority rule are designed. | UI must never label a self-entered record clinician-verified. |
| SC-06 | Conflict, expiry, ambiguous applicability, or missing required facts place affected personalized advice in `review_required`. Unaffected advice may continue only when scopes are demonstrably disjoint; history, stop, editing, and factual activity capture remain available. | One deterministic boundary guards generation, substitution, progression, and execution without blocking non-prescriptive use. |
| SC-07 | Start restore with validated full replacement plus a pre-restore recovery backup. Defer merge restore until cross-athlete identity and conflict laws are proved. | Backup contract must inventory all 064 rows and reject incompatible/partial restore before product claims. |
| SC-08 | Do not add a new experience-only dose uplift. Treat the legacy path as an explicit interim exception. Never make beginner symptom handling less conservative without qualified clinical approval. | New accessible recommendations cannot route around the shared support boundary through legacy assumptions. |
| SC-09 | If onboarding facts are absent, require setup before a new personalized recommendation. Existing database defaults may support legacy integrity but must not be presented as athlete-specific advice. | `setup_required` is a truthful state; no fabricated intermediate/4-day/90-minute/RPE-9 personalization. |

## 4. First Migration 064 slice if approved

The first implementation slice should contain identity, revisions, lifecycle, recurrence/time resolution, expected-versus-actual activity facts, provenance, unknown states, and review holds. It should not contain clinical thresholds, diagnostic labels, auto-parsed health prose, live alert timing, or a universal activity-equivalence score.

One normalized planner input should expose:

- fixed and flexible occurrence facts;
- expected and actual duration/effort as separate nullable facts;
- explicit occurrence reconciliation/duplicate state;
- structured instruction revisions, applicability, provenance, and review state;
- deterministic reason/input revision references;
- separate `planned`, `actual`, and `projected` accounting.

Precedence remains: ratified clinician restriction; explicit halt/suspension; fixed external commitment; existing guided-program invariant; goal/flexible optimization. Unknown applicability holds the affected recommendation rather than manufacturing permission.

## 5. Required acceptance before implementation can be called complete

- Francis records approve/amend/reject for D01–D10 and SC-01–SC-09.
- A qualified reviewer is named for screening, executable types/units, symptom policy, monitoring warnings, and conflict/expiry semantics.
- Integration rechecks that `064` is still the next unallocated migration before creating it.
- Persona and boundary tests cover the older beginner, weight-loss plus swimming, Friday sport, niche custom activity, clinician restriction with unavailable monitoring, DST ambiguity, duplicate reconciliation, and athlete isolation.
- Backup inventory and round-trip verification are rerun after 064.
- No release claim is made from capture-only storage or a passing legacy suite.

## 6. Current decision tokens

```text
OWNER APPROVAL: PENDING
CLINICAL APPROVAL: PENDING
MIGRATION 064: RESERVED, NOT AUTHORIZED
WO-05 PRODUCT IMPLEMENTATION: DEFERRED
WO-06 PRODUCT IMPLEMENTATION: DEFERRED
WO-07 LIVE MONITORING: DEFERRED
```
