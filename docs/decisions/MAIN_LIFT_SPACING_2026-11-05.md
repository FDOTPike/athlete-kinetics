# Main-Lift Spacing Decision Record

Date: 2026-11-05
Status: PROPOSED (ratified when the owner merges the pull request)
Issue: #228

## Rule (2026-11-05)

> the generator does not place the same main lift on consecutive days

## What changes

- A session's **main lifts** are its first two slots (the slots before
  `ACCESSORY_SLOT_FROM`) on a strength day (lower, upper or full).
- When the generator's own pick for a main slot is a movement that is
  already a main lift on the **calendar day before or after**, it takes the
  ranker's next movement for that slot instead. The replacement must:
  - have the same movement pattern;
  - be in the same gated pool (every gate still applies: equipment, tier,
    capability, niggles and attestation);
  - have the same loading class (loaded or strictly bodyweight; a movement
    whose implement is undeclared and that can be done with bodyweight, such
    as Push-up, counts as loaded only when the athlete has declared a load
    for it. The store tells the generator whether Bodyweight is one of a
    movement's supported implements; that is never read as a declaration,
    and dose routing does not use it);
  - have the same compound class;
  - not be held for preparation;
  - not be a main lift on either neighbouring day.
- In hypertrophy plans, main-lift spacing follows the Round 5 competition-lift exclusion: it selects the highest-ranked non-competition movement of the same pattern, loading class, and compound class when one exists, and falls back to a competition lift only when no non-competition movement qualifies.
- If no such movement exists, the pick stays as it was. The rule never drops
  a slot and never fills one upward.
- The days are calendar days. Each week makes the same choices, so day 7 and
  the next week's day 1 count as neighbours.
- Each swap is disclosed in the plan's warnings and shown under "Coach
  decisions in this plan", for example: "full: Goblet Squat planned
  instead of Front Squat, the main lift the day before or after".

## What does not change

- An explicit athlete choice for the slot (Customize) or a goal's named
  exercise is never moved. The athlete owns that choice, even when it puts
  the same lift on two days in a row.
- Sets, effort, the weekly progression, the deload and the session-time
  contract are unchanged.
- The spacing replacement is prescribed as that movement normally is. When the replacement belongs to a capability chain, it keeps its chain rep floor (chainScopedRepsFor), so target repetitions can rise if the original movement was not on a chain.
- Conditioning and BJJ days are not touched.
- Days that are not back to back are not touched.
- No tier rule is involved (D02). The rule is the same for every training
  age.

## Verification

`packages/inference/test/verify_blocks.mjs`, section `[MAIN_LIFT_SPACING]`:

- with a full gym, across 7 objectives × intermediate and advanced × 2 to 7
  days a week, no movement is a main lift on two strength days in a row;
- the walk's case (advanced, BUILD MUSCLE, 5 days) has no back-to-back
  repeat, and the swap is disclosed;
- an explicit choice of the same lift on two consecutive days is kept;
- a week with no back-to-back strength days carries no spacing note;
- in a hypertrophy plan where a non-competition movement qualifies, spacing
  does not pick a competition lift (advanced, 7 days: Goblet Squat, not
  Competition Squat, for Front Squat), across 2 to 7 days a week and both
  tiers;
- in a hypertrophy plan where no loaded non-competition movement qualifies
  (Push-up has an undeclared implement and no athlete-declared load), spacing
  falls back to Competition Bench for Dumbbell Bench Press rather than
  repeating it, and selects Push-up when the athlete declares a load for it;
- a spacing replacement on a capability chain is prescribed its chain rep
  floor when the main lift it replaces is off-chain.

The full-inventory "no warnings" check now ignores this disclosure. It is a
note about a choice, not a missing movement.
