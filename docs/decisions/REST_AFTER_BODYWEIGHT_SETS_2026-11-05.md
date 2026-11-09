# Rest After Bodyweight Sets — 2026-11-05

**Status: PROPOSED.** It is ratified when the owner merges the pull request that carries it.

## Rule

After a bodyweight set, the automatic rest is:

| Effort used for rest | Rest |
|---|---|
| below RPE 8 | 60 s |
| RPE 8 or above | 90 s |

A bodyweight set is a set logged at 0 kg on a bodyweight movement (the movement's first supported implement is `Bodyweight`). The same movement with added load is a loaded set and keeps the RPE bands.

This comes from issue #209 (ruling of 2026-11-05: "rests of 60 to 90 seconds after bodyweight sets"). The walk found two to four minutes of rest after a set of push-ups, which made a short beginner session long for no reason.

## How it sits with the tier-neutral rest ruling

`docs/decisions/REST_DURATION_TIER_NEUTRAL_2026-09-15.md` stays in force: experience tier alone never lengthens or shortens rest. This rule is by **load**, not by tier. For the same effort and the same kind of set, every tier gets the same rest. A beginner and an elite athlete who both do a bodyweight set at RPE 7 both rest 60 s; with added load both rest 120 s.

## What stays the same

- **RPE bands for loaded sets:** 240 / 180 / 120 / 90 s.
- **Which effort sets the rest:** the athlete's actual effort when given, otherwise the planned target.
- **Contract:** a 15-second step within 45 to 300 s.
- **Overrides:** a rest the athlete sets for the session still wins. Clearing it returns to the rule.
- **Checkpoint:** version 1. A rest after a bodyweight set carries `restBodyweight: true` in the checkpoint while that rest runs; older checkpoints have no such field and restore as loaded-set rests.
- **Out of scope:** sets, reps, load, effort targets, session size and beginner protections.

## Implementation

- **Runner:** `packages/inference/src/sessionRunner.ts`: `restSecondsFor(slot, tier, actualRpe, bodyweightSet)`; the `LOG_SET` event carries `bodyweightSet`.
- **Store:** `logSet` marks a set of 0 kg on a bodyweight movement as a bodyweight set.
- **App fallback:** the local rest in `apps/mobile/src/screens/SessionScreen.tsx` (no runner) uses the same rule.
- **Tests:** `packages/inference/test/verify_runner.mjs` (R5b) checks every tier for both kinds of set, the checkpoint cases, and that a rest function with a tier multiplier fails the check. `RestAfterBodyweightSets.test.js` checks the store with the real database; the SessionScreen component test checks the fallback.

This is a product-policy rule for deterministic software, not a clinical recommendation.
