# Routine Major-Lift Support Policy

Status: owner-delegated product curation, implemented for the custom routine builder.

## Recommendation table

The first three currently executable matches are pinned in this order. If a
listed movement is unavailable because of equipment, tier, active niggle,
capability evidence, attestation, or role policy, it is omitted and the shared
deterministic muscle/pattern scorer fills the open position.

| Selected major | Supplementary 1 | Supplementary 2 | Supplementary 3 |
|---|---|---|---|
| Competition Squat | Romanian Deadlift | Bulgarian Split Squat | Barbell Hip Thrust |
| Front Squat | Romanian Deadlift | Bulgarian Split Squat | Barbell Hip Thrust |
| Deadlift | Barbell Hip Thrust | Bulgarian Split Squat | Chest-Supported Dumbbell Row |
| Sumo Deadlift | Romanian Deadlift | Bulgarian Split Squat | Barbell Hip Thrust |
| Competition Bench | Incline Dumbbell Press | Barbell Row | Triceps Pushdown |
| Overhead Press | Pull-Up | Incline Dumbbell Press | Face Pull |
| Barbell Row | Pull-Up | Chest-Supported Dumbbell Row | Face Pull |
| Power Clean | Front Squat | Romanian Deadlift | Overhead Press |

Recommendations are advisory. They never auto-select a movement and never
grant access. The picker supplies the ranker only movements already proven
executable and supplementary-role eligible for the active athlete.

## Major RPE projection

The existing `routine_template_slot.target_rpe` remains the major lift's peak
target, preserving every existing template and avoiding a migration. The UI
shows a read-only projected start beside the editable maximum.

- Start target: peak minus 2.5 RPE, floored at 5.0 and bounded by the athlete cap.
- Every method reaches the peak during the three loading weeks; Undulating
  peaks in week 2, while Linear, Step Loading, and Autoregulated peak in week 3.
- Week 4: deloads one RPE below the low point, floored at 5.0.
- Linear advances low → midpoint → peak.
- Undulating advances low → peak → midpoint.
- Step Loading repeats the starting target in week 2.
- Autoregulated begins and holds at the midpoint before its week-3 peak.

The freeze path resolves the actual week target for the major. Supplementary
and conditional movements retain their authored single RPE target. Readiness,
safety, and autoregulation may still reduce the live prescription.
