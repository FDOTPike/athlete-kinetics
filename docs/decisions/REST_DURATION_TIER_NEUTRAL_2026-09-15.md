# Tier-Neutral Automatic Rest — Owner Ruling 2026-09-15

## Ruling

For identical RPE and session inputs, automatic rest duration is identical for beginner, intermediate, advanced and elite athletes. Experience tier alone must not lengthen or shorten prescribed minutes.

This closes the owner decision flagged in `HANDOVER_2026-09-15_D02_INFERENCE_POLICY_INTEGRATION.md` §8. It applies the D02 principle to rest time: D02 (`docs/decisions/ACCESSIBLE_COACH_ASTRA_OWNER_RULINGS_2026-09-13.md`) already rules that tier alone must not add sessions, minutes, sets, target effort or fatigue allowance.

## Rest before and after

| RPE used for rest | Before: beginner / intermediate / advanced / elite | After: every tier |
|---|---|---|
| 9.0 or higher | 180 / 240 / 240 / 300 s | 240 s |
| 8.0 to below 9.0 | 135 / 180 / 180 / 225 s | 180 s |
| 7.0 to below 8.0 | 90 / 120 / 120 / 150 s | 120 s |
| below 7.0 | 75 / 90 / 90 / 120 s | 90 s |

## What stays the same

- **RPE bands:** 240 / 180 / 120 / 90 seconds, snapped to a 15-second step within 45 to 300 seconds.
- **Which RPE sets the rest:** the athlete's actual RPE when given; otherwise the planned target RPE. Persisted actual effort stays null.
- **Explicit rest overrides:** a session rest the athlete sets still overrides the prescribed rest.
- **Checkpoint format and tier validation:** the runner checkpoint format (version 1) and training-tier validation are unchanged.
- **Out of scope:** sets, reps, load, effort targets, movement eligibility and beginner protections.

## Implementation

- **Runner:** `packages/inference/src/sessionRunner.ts` `restSecondsFor` uses only the RPE bands.
- **App fallback:** the local rest used when no runner owns the timer (`apps/mobile/src/screens/SessionScreen.tsx`) uses the same bands without tier.
- **Saved mid-rest checkpoints:**
  - A checkpoint saved by an earlier build may hold that build's tier-scaled rest target.
  - When restored with no rest override, it keeps the rest it was already counting down, instead of being rejected.
  - Every later rest is tier-neutral.
  - The pre-ruling multipliers are kept only for this check.
- **Tests:** `packages/inference/test/verify_runner.mjs` covers all four tiers across every RPE band and the checkpoint cases, and the SessionScreen component test covers the fallback. Reintroducing a tier multiplier fails the gate.

This is a product-policy ruling for deterministic software, not a clinical recommendation.
