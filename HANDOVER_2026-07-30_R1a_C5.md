# Handover - R1a C5 amendment

Date: 2026-07-30
Status: **HISTORICAL — R1a/C5 RATIFIED; SUPERSEDED BY R2/C6B.**

## What changed

- `deriveControlAction` now requires `macroBlockIndex` for TypeScript callers.
- Omitted, `undefined`, and `NaN` macro indices fail closed with no positive
  RPE grant.
- The owning autopilot gate pins all three runtime cases.
- The source records the ratified corrective-overlay rationale.
- `DEVIATION_LOG.md` records the mandatory post-R2 budget/schedule review.
- The C5 checkpoint and remediation evidence include the R1a amendment.

No observer formula, schema, migration, runtime dependency, safety precedence,
or valid-index R1 behavior changed. R2 has not started.

## Verification

```text
typecheck=PASS
verify:autopilot=PASS
verify:blocks=PASS
verify:autopilot-counterexamples=PASS
strict simulator compile=PASS
full 2,385-case family=PASS
verify:all=PASS (20 gates + typecheck)
components=PASS (7/7 suites, 66/66 tests)
```

The full-family classification table and nonlinear-binding counts are unchanged
from the original C5 evidence. Limit cycles remain 0, saturated-up remains 0,
and RPE-cap binding remains 0.

## Judgment calls for review

The parameter is required at the TypeScript boundary and also guarded at
runtime. This provides compile-time pressure for future callers while keeping
JavaScript and corrupt persisted-state paths fail closed.

## Honest debt

- R1 remains a consequence bound, not a stability proof.
- R2 must revisit `MAX_MACROCYCLE_RPE_RAISE` and its schedule after correcting
  the biased observer, then rerun the full family and prove upward saturation
  does not return.
- R2 must first determine whether the deload/window straddle is universal or
  template-specific.
- `BlockPlan.autopilotAdjusted` still has no UI consumer, so changes are not
  attributed to the athlete.

## Francis checklist

1. Review `tools/autopilot-sim/REMEDIATION_R1A_C5.md`.
2. Confirm the fail-closed fix satisfies the conditional C5 audit.
3. Ratify or reject C5.
4. Do not authorize R2 until C5 is ratified.
