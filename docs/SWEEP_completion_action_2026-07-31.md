# Completion-action candidate sweep

Date: 2026-07-31
Status: **OPUS CHECKPOINT. NO PRODUCTION NUMERIC AUTHORITY.**
Work order: `WORKORDER_Sol_completion_vs_prescription_observer.md`

## 1. Architecture result

Completion does not enter `detectFlaws`, does not become synthetic delta-RPE,
and does not change `phi`.

The new pure path is:

```text
completion evidence -> candidate completion action
RPE evidence        -> existing RPE action
final action        -> fieldwise minimum of both actions
```

The existing `verify_autopilot.mjs` analytic pins pass unchanged. Conservative
composition is pinned as commutative, associative, and idempotent. An explicit
neutral completion action caps beginner headroom at neutral; either source's
reduction survives.

The completion path is exported for analysis but is not wired into production
block generation.

## 2. Connected-device baseline

Read-only result:

- `session_outcome`: 0 rows;
- finalized beginner planned sessions: 0;
- finalized beginner planned complete/no-skip sessions: 0;
- `set_dose_target`: 4 rows;
- `session_plan_slot`: 4 rows;
- `session_slot_target`: 4 rows.

The four current sets have frozen dose evidence but no finalized outcome. The
device therefore has **zero eligible real completion history** for threshold
calibration.

## 3. Durable-evidence correction

`session_outcome` persists `skipped_slot_count` but not the identities of the
skipped slots. A skipped set therefore cannot be attributed to a movement
pattern after finalization without new durable storage.

The migration-free, fail-closed rule is to exclude an entire session whenever
`skipped_slot_count > 0`. Completed no-skip sessions can attribute logged and
missing work through their frozen `session_plan_slot` rows.

## 4. Finite sweep

Eighteen diagnostic policies were evaluated:

- minimum observation days: `3`, `5`, `7`;
- mean shortfall deficit threshold: `0.10`, `0.20`, `0.30`;
- strong-reduction threshold: `0.40`, `0.60`.

No value is a production default.

Scenarios covered exact, 10%, 25%, 50%, and 60% repeated shortfall; two-, three-,
five-, and seven-day histories; mixed histories; and equal-mean improving and
worsening histories.

## 5. Findings

Universal safety:

- exact completion remained neutral in all 18 policies;
- two severe observation days remained neutral in all 18 policies;
- no candidate produced positive load, set, RPE, or preference authority;
- invalid policy failed closed to neutral;
- decimal equality at a threshold remained inclusive and deterministic.

The three policy axes are genuinely distinct:

- `3` days reacts to a severe three-day history; `5` and `7` do not;
- `5` days reacts to a severe five-day history; `7` does not;
- `0.10` cuts on repeated 10% shortfall;
- `0.20` ignores 10% but cuts on 25%;
- `0.30` ignores both 10% and 25%;
- strong `0.40` makes a 50% mean shortfall a load-and-volume reduction;
- strong `0.60` makes the same 50% history volume/RPE-only and reserves the
  load reduction for 60%.

## 6. Blocking finding

The current candidate statistic is a set-weighted mean over valid days. It is
order-insensitive.

These histories therefore produce the same action:

```text
improving: 0.50, 0.40, 0.30, 0.20, 0.10, 0, 0
worsening: 0, 0, 0.10, 0.20, 0.30, 0.40, 0.50
```

That is not a code defect; it is an unresolved policy choice. Adding recency
would introduce another numeric rule and must be separately swept. Selecting a
mean-only candidate would knowingly accept this ambiguity.

## 7. Decision required

Real-data threshold selection cannot occur yet because the device has zero
eligible finalized outcomes.

Choose one:

1. Keep action authority dormant until real completion history accumulates,
   then repeat the sweep against observed distributions.
2. Ratify a provisional mean-only policy now, explicitly accepting that equal-
   mean improving and worsening histories receive the same action.
3. Authorize a recency-aware candidate family and a second finite sweep before
   selecting any production policy.

Recommendation: **1**. It matches the ratified A6 decision to defer the
threshold to real data and avoids another synthetic calibration.
