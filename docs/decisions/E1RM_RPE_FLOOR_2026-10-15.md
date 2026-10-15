# Estimated 1RM Effort Floor Decision Record

Date: 2026-10-15
Status: PROPOSED (ratified when the owner merges the pull request)

## Rule (2026-10-15)

> anything below rpe 6 shouldnt even qualify

## What changes

- **`packages/inference/src/e1rm.ts`:** `estimateOneRepMax` returns `null` when `rpe < 6` (`if (rpe < 6 || rpe > 10) return null;`). A set at `6.0` or above (up to `10.0`) continues to return `loadKg / targetPct(reps, rpe)`; `5.5` and lower return `null`. Because `bestPerSession` skips sets whose `estimateOneRepMax` is `null`, a session whose sets are all below RPE 6 produces no `E1rmPoint`, and a session mixing sets below 6 with sets at 6 or above takes its point only from the qualifying sets. The file header and JSDoc state the RPE 6 floor, whose rule it is, and where it is recorded.
- **`packages/inference/test/verify_blocks.mjs` (`[8b]`):** adds checks that `5.5` (and `5.9`, `0`) gives `null`, that `6.0` gives `100 / targetPct(5, 6.0)`, that `bestPerSession` emits no point when a session's only sets are below 6, and that a session containing a set below 6 and a set at 6 or above takes its point from the latter only.
- **`docs/decisions/CALIBRATION_POLICY_V1.md` (section 5) and `packages/inference/test/verify_policy.mjs` (`[10]`):** records the `6.0` floor row in the Frozen Coefficient Registry with provenance (`e1rm.ts:estimateOneRepMax` / `E1RM_RPE_FLOOR_2026-10-15.md`) and pins `estimateOneRepMax` by behaviour on either side of the floor (`5.5` and `5.9` return `null`; `6.0` returns `100 / targetPct(5, 6.0)`).

## What does not change

- It changes only `packages/inference/src/e1rm.ts` and what checks and records it.
- It does not change what an athlete may log (`set_record.rpe` remains `0..10` or `NULL`), what the app prescribes, the effort targets, the autopilot, or anything else that reads effort.
- The export surface of `packages/inference/src/e1rm.ts` remains `bestPerSession` and `estimateOneRepMax` only, with no exported constant and no second formula.
- `packages/inference/src/e1rm.ts` has no production caller today (it is re-exported from `packages/inference/src/index.ts` and called only in verification scripts), so nothing an athlete sees changes.
