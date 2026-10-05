# Four-lift equivalent-volume decision

Date: 2026-08-10
Status: accepted product direction; current pre-release limitation accepted
Owner direction: Francis Pike

## Release decision

The existing readiness rollup remains unchanged for this pre-release cycle.
It records raw external tonnage as `reps × load_kg`; bodyweight-only sets can
therefore contribute zero to readiness load. This known limitation is accepted
for internal testing and does not justify delaying the movement-content audit.

The app must not claim that current ACWR/readiness tonnage represents total
mechanical work from bodyweight movements. This decision does not authorize
invented conversion coefficients or a silent change to historical readiness
values.

## Ratified scope for later remediation

Equivalent volume is deliberately limited to four anchor families:

| Anchor | Capability family | Anchor coefficient |
|---|---|---:|
| Squat | `squat-competition` | 1.0 |
| Bench press | `press-bench` | 1.0 |
| Deadlift | `hinge-deadlift` | 1.0 |
| Overhead press (OHP) | `press-overhead` | 1.0 |

An alternative contributes only when it has an explicit, reviewed mapping to
one of these families. Broad pattern matching is not sufficient. Each mapping
has a movement-specific coefficient that may account for stability, leverage,
implement, position, and range of motion. Machine, cable, dumbbell, seated, and
standing variants must not inherit a coefficient merely from their label.

For one logged set:

```text
system_load_kg = entered_load_kg
               + (bodyweight_kg when the reviewed mapping includes bodyweight)

anchor_equivalent_volume_kg = reps × system_load_kg × movement_coefficient
```

The entered load keeps the app's existing logging semantics. For a reviewed
bodyweight alternative, `bodyweight_kg` is the most recent valid manual or
imported bodyweight measurement on or before the session date. Added external
load is still entered normally. If bodyweight is missing, equivalent volume
must be unavailable for that set rather than silently assuming zero or a
population average.

## Explicit non-decisions

- No alternative coefficient has been approved in this decision.
- The current capability-family ordering is not evidence for a coefficient.
- Existing condition-prefix multipliers are not four-lift equivalence factors.
- Historical data is not backfilled until coefficient versioning and
  recalculation behaviour are separately approved.
- Accessory, rowing, carry, core, and BJJ movements remain outside this metric.

The implementation gate for this later remediation is a versioned mapping with
owner-reviewed coefficients, deterministic bodyweight lookup, missing-data
behaviour, migration/replay tests, and readiness recalibration tests. Until
then, the open implementation limitation remains visible in `DEVIATION_LOG.md`.
