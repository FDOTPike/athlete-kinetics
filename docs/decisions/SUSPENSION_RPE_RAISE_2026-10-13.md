# A block generated during a suspension gets no autopilot effort raise

Date: 2026-10-13
Status: **PROPOSED. It is ratified by the owner merging the pull request that carries this file, and not before.**

## The conflict

Two ratified rules, a month apart, that nothing tested together.

1. **The ceiling.** The autopilot may raise a planned effort target by half a point at each of the first five positions of the eight-block cycle, and at none of the last three. `MAX_MACROCYCLE_RPE_RAISE` is 2.5, listed as frozen in `CALIBRATION_POLICY_V1.md`. It was set after a ceiling of 3.0 was rejected for drift in the applied blocks (`tools/autopilot-sim/C6B_AUTHORITY_3_RESULTS.md`). The code enforces it by position, and its comment said this "guarantees the cumulative bound".
2. **Suspension.** While a suspension is open the macro position is frozen, and "blocks generated during an episode consume neither frozen progression state" (ruling S6(b), `RELEASE_CANDIDATE_C1_DOCKET.md`).

Together: every block generated during an episode frozen at position 1 to 5 could receive that position's half point again. The position-based ceiling does not count those blocks, so the 2.5 could be passed. This was read in the code; it was not observed in a running app.

Each extra raise was small: half a point on one planned slot of one movement pattern in one block, under the athlete's own effort cap, and only where recent sets read as having room to spare. But the ceiling is a frozen number, and an episode can last any number of blocks.

## The ruling proposed

**A block generated while a suspension is open receives no positive effort raise from the autopilot.**

On 2026-10-13 the owner was asked whether the ceiling should hold while a suspension is open. He answered "go with your recommendations on both" (this and one other question). No recommendation had been stated with the question, so those words name no option. The recommendation then made, on outside advice, is the rule above. Merging the pull request is the owner's ratification of it.

## What changes

- At block generation the store reads whether a suspension is open and tells the generator. If one is, the autopilot's positive RPE grant is withheld for that block.
- The comment that claimed an unconditional guarantee now states its condition.

## What does not change

- **Training continues during a suspension**, and blocks are still generated. S6(b), S5(c) and S4 stand as written: the position stays frozen and is resumed exactly.
- **Only the positive effort raise is withheld.** Cuts, set changes, substitution, the rehab effort ceiling, halts and every other correction are as they were. A block generated during a suspension can still be eased.
- **No number changes.** The ceiling stays 2.5, the step stays 0.5, the five granting positions stay the first five. No migration, no new storage.
- Blocks generated outside a suspension are generated exactly as before. The autopilot's verifiers and the C6B authority sweep give the same results as before this change.

## The exception this makes

Migration 058's header says of a suspension: "It freezes the macro position. That is all", and that it "adds no modifier of its own" to the existing safety machinery.

This rule is an exception to that sentence, and is recorded here as one: **a suspension now also withholds the autopilot's effort raise from blocks generated during it.** It withholds an increase; it imposes no reduction and sets no value. Migration 058 is shipped and is not edited; this file is where the exception lives.

## Options not taken

- **Accept the gap** (the ceiling applies outside suspensions only). No engineering risk, but it turns a frozen ceiling into one with an untested exemption.
- **Count grants in the cycle**, or share one allowance per position across an episode. Each needs an accounting design and, for the first, new storage. Neither was designed.

## What this does not settle

Whether effort should be raised at all for an athlete who has opened a suspension for an injury is a coaching question this rule answers only as a side effect. Nothing here is a clinical claim.
