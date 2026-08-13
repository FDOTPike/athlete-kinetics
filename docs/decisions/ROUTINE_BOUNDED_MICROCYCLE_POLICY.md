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

Bounding is non-increasing. Purpose identity is assigned without changing the
dose, authored/defaulted stress is captured for review, and only then may
purpose, RPE, family-stress, or duration adaptations reduce the prescription.
No final set count, rep count, or target RPE may exceed its authored/defaulted
value. Timed-target conversion supplies seconds only; it cannot replace a
bounded set count with the movement's larger default.

A template save validates every day being saved. A freeze still analyses the
complete microcycle, but an irreducible duration overflow blocks only the day
being frozen; another day's overflow is retained as a visible warning until
that day is edited or frozen. Because the weekly analysis must stay valid for
every day, the remaining conditions block a freeze globally even when only one
day is being frozen: a selection whose movement is missing from the live
library, a major selection without a curated lift-family stress contract, an
out-of-range stored sets/reps/target-RPE value on any analysed day, a per-day
session stress budget that cannot be reduced to a valid safe minimum, and the
complete-week safe-minimum failure. The engine's final non-increasing
invariant remains a terminal safety blocker.

Newly authored RPE above the athlete's current cap is rejected. If the athlete
lowers the cap after a template was saved, freeze normalizes stored RPE drift
across the analysed microcycle, records the authored-to-final adaptation, and
persists matching family/session stress decisions. The editor exposes the same
normalization for review instead of requiring every stored field to be retyped.

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

## Pre-contract template compatibility

Migration 053 preserves only exact, athlete-local supplementary selections
authored before the curated relationship contract. An allowance is keyed by
template, day, movement, and supplementary role. It does not add global role
eligibility, populate a picker, create an assistance relationship, or license a
future selection. Reordering within the same day preserves it; changing the
day, movement, or role removes it. Equipment, active safety/niggle, tier,
capability, attestation, Beginner, missing-major-family, and valid-prescription
gates remain mandatory.

Freeze copies an applicable allowance to the exact planned slot so a newly
frozen session remains executable after source-template deletion. Historical
source rows that repeat the same movement and same role are redundant and
accepted; conflicting roles remain unverifiable and fail closed. A pre-052
frozen plan whose source template was already deleted before migration 053 has
no trustworthy role snapshot and cannot be recovered speculatively.

Re-derivation is bounded to the pre-contract era by append-only migration 054.
Migration 053 re-evaluates its backfill against live family and assistance rows
on every self-heal; if a future curation migration removes or re-parents a
`movement_lift_family` or `movement_assistance_relationship` row, 053 would
otherwise grandfather a template authored AFTER the contract. 054 snapshots the
contract cutoff once — the highest `routine_template_id` present when it first
ran on the install (AUTOINCREMENT ids are monotonic, so no wall-clock is
involved) — and prunes any allowance 053 re-derived for a template above that
watermark, including frozen planned-slot markers whose source template is
identifiable. A pre-contract template keeps every exact allowance, including
ones a later curation change makes newly relevant. A frozen marker whose source
template was already deleted cannot be re-verified and is preserved, never
deleted speculatively. The migration runner validates the cutoff table, its
singleton row, and both immutability guards. If any is lost, it persists cutoff
zero before the full replay; all reconstructable template allowances are then
pruned rather than recapturing the current maximum and inventing access.
