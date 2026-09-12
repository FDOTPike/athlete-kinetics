# Accessible Coach Shared Contract — Owner and Clinical Decision Docket

## 1. Status

- Status: `PROPOSED — NOT RATIFIED`.
- Reserved migration: `064`.
- Purpose: give external activities, ordinary weekly planning, and clinician constraints one offline deterministic data contract.
- This docket authorizes no schema or product behavior until the listed decisions are ratified.

## 2. Proposed invariant set

### 2.1 Time and recurrence

- Store recurring activity definitions separately from generated occurrences.
- A definition carries local civil schedule intent plus an IANA time-zone identifier.
- An occurrence carries resolved start/end instants and an immutable source identity.
- Occurrence state is one of `planned`, `completed`, `cancelled`, or `missed`; unknown completion must not be inferred.
- A commitment is explicitly `fixed` or `flexible`; the planner may move only flexible commitments.

### 2.2 Activity load

- Minimum activity facts: activity kind, start/duration, fixed/flexible state, occurrence status, and source identity.
- Optional athlete effort uses the existing RPE 1–10 construct. Missing effort remains `null`; it is not converted from RIR or guessed from duration.
- Optional demand classification uses a small ratified vocabulary rather than a medical score.
- The same real-world activity must not be counted twice when represented by a recurrence and an occurrence, or by an imported and manually-entered record.

### 2.3 Clinician constraints

- A constraint is structured and typed; free text is context only and never executable.
- Required provenance fields: source class, recorded time, review/expiry state, and whether the claim was user-reported or independently verified.
- Product state is one of `pending_review`, `cleared_with_restrictions`, or `review_required`; `cleared` without qualifications is not inferred.
- Applying or changing an executable constraint requires explicit athlete confirmation.
- Expired, conflicting, incomplete, or unknown constraints fail closed by holding the affected recommendation for review, not by inventing a safe prescription.

### 2.4 Planning precedence

Proposed deterministic precedence, highest first:

1. Ratified clinician restriction.
2. Explicit safety halt or current suspension rule.
3. Fixed external commitment.
4. Existing guided-program invariant.
5. Goal optimization and flexible coached session placement.

No duration-times-effort formula is approved as a clinical safety score.

### 2.5 Backup interaction

- Backup format version 1 must declare the database/application version and covered table set.
- Once Migration 064 exists, its rows are required in the backup inventory and round-trip suite.
- Restore default is not decided; merge restore is not assumed safe.

## 3. Decisions required before Migration 064

### D-01 — Schema decomposition

- Proposed: separate activity definitions, activity occurrences, clinician constraints, and constraint applicability rows.
- Decide: approve, amend, or reject.

### D-02 — Recurrence and time-zone law

- Proposed: local civil recurrence plus IANA zone; materialized occurrences carry resolved instants.
- Decide: approve handling of daylight-saving gaps/overlaps and travel across zones.

### D-03 — Demand vocabulary

- Proposed: a bounded non-medical vocabulary for affected regions and broad demand (`low`, `moderate`, `high`, `unknown`).
- Decide: approve terms or require an evidence-backed alternative. `unknown` must remain available.

### D-04 — Clinician constraint types and units

- Decide the first executable constraint set, permitted units, applicability targets, and validation ranges.
- Recommendation: ship no executable numeric threshold until a qualified clinical reviewer approves its semantics.

### D-05 — Provenance and verification

- Proposed: athlete-entered clinician guidance defaults to `user_reported`; the app must not imply clinician verification.
- Decide whether any verified-source workflow exists in this offline release.

### D-06 — Conflict and expiry behavior

- Proposed: conflict, expiry, and missing required facts produce `review_required` and hold affected planning changes.
- Decide whether unaffected sessions may continue.

### D-07 — Backup restore mode

- Decide: full replacement only, merge, or both.
- Recommendation: begin with validated full replacement plus pre-restore backup; defer merge until identity/conflict laws are proven.

### D-08 — Experience-level policy conflict

- Current audit observation: experience alone changes prescribed set volume and some symptom severity gates.
- Decide separately:
  - whether experience may alter volume without other readiness/capacity evidence;
  - whether beginner symptom reporting may ever receive a less conservative threshold.
- Recommendation: do not ratify a less conservative symptom threshold without qualified clinical review.

### D-09 — Default-profile assumptions

- Current defaults assume intermediate experience, four weekly days, 90-minute duration, and RPE 9.
- Decide whether absence of onboarding data should block prescription, use clearly disclosed conservative defaults, or enter a setup-required state.

## 4. Acceptance checkpoint

Before implementation, the owner and qualified clinical reviewer must record:

- disposition for D-01 through D-09;
- accepted vocabulary and units;
- which constraints are executable versus display-only;
- allowed continuation behavior when one activity or constraint is unknown;
- backup restore mode;
- sign-off identity and date.

Until then, WO-05/WO-06 may produce types, examples, and tests only on an explicitly provisional branch; they may not land a production migration or change recommendations.
