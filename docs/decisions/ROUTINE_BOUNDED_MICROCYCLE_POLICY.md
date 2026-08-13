# Routine bounded-microcycle policy

Date: 2026-08-13
Status: owner-approved and implemented

## Selection and dose

Routine major selection has no movement-count or weekly-frequency ceiling. A
populated training day needs at least one major, and the seven-day microcycle
is evaluated as a whole. Athlete-selected major movements and variations are
preserved whenever each can receive a valid minimum prescription.

Selection is uncapped; dose is bounded. The deterministic engine may adapt
sets, reps, target RPE, stress purpose, execution order, and support work. When
family stress or session duration is high, accessory work is removed first,
then related supplementary or conditional work, before a selected major dose
is reduced. A major is blocked only when equipment, live safety/niggle,
capability/attestation, role eligibility, missing curated family data, or the
inability to create a safe minimum prescription makes execution invalid. The
Beginner standalone-routine lock remains unchanged.

## Same-day variations

Two or more selected majors from the same curated lift family on one day are
one family exposure distributed across distinct executable variations. They
remain separate ordered prescriptions, but family volume is accumulated once:

```text
family_equivalent_reps = sum(movement_coefficient * sets * reps)
```

For example, Board Press `2 x 6` at coefficient `0.90` plus Competition Bench
`3 x 7` at coefficient `1.00` equals `31.8` bench-family equivalent reps and
one same-day bench-family exposure across two variations. This rule applies to
all seven curated major families: squat, deadlift, bench press, overhead press,
horizontal pull, vertical pull, and power clean.

Equivalent reps are a planning-dose metric. They do not change the separately
ratified four-lift logged-load/bodyweight decision in
`FOUR_LIFT_EQUIVALENT_VOLUME.md`.

## Distributed weekly exposure

Repeated family exposures receive distinct purposes where appropriate:
heavy, volume, technique, speed, or low-fatigue. Exposure count means distinct
training days; variation count means distinct movement choices. Five weekly
bench days are valid when their complete weighted stress can be bounded.

Session and weekly budgets are deterministic by training age. They are dose
ceilings, not selection-count ceilings, and are persisted with warnings,
recommendations, and adaptations for athlete and coach review.

## Roles and recommendations

The curated `movement_lift_family` and `movement_assistance_relationship`
contracts are separate from the capability progression graph. Static role
eligibility is still a hard outer gate; runtime role is contextual:

- a curated family movement may be major;
- same-family or distance-1 direct assistance may be supplementary;
- explicitly related distance-2 or distance-3 low-fatigue work may be accessory;
- an unrelated movement is not recommended to fill space.

Hammer Curl is supplementary after horizontal or vertical pulling and
accessory after squat, bench, deadlift, overhead press, or power-clean work.
When several major families are present, the closest curated relationship
wins, so direct assistance is not reintroduced as a distant accessory.
Accessories are offered only after major and supplementary choices are known,
ranked against uncovered stimulus, goal, availability, duplication, time, and
remaining fatigue. Returning zero accessory recommendations is valid.

The prior top-three supplementary recommendation behavior and projected major
RPE start/max behavior remain product contracts.
