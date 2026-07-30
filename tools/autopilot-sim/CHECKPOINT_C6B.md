# Checkpoint C6B — authority 3.0 experiment

Date: 2026-07-30
Status: **RATIFIED 2026-07-31 — `2.5` AUTHORITY POLICY APPROVED.**

## Ratified verdict

**GO — ratify `MAX_MACROCYCLE_RPE_RAISE=2.5`.**

`docs/AUDIT_C6B_2026-07-30.md` independently verified the result and authorized
landing. Its corrected-classifier follow-up is complete in
`tools/autopilot-sim/C3_CORRECTED_CLASSIFIER_FOLLOWUP.md`.

The preferred `3.0` candidate passed cycles, saturation, nominal, safety, and
counterexample gates, but failed the work order's `mixed` early-warning gate
once the classifier was aligned to corrections actually applied in blocks 6–8:

```text
applied mixed:             401 at 1.0
                           401 at 2.5
                           463 at 3.0
                           569 unbounded

applied authority-limited: 344 at 1.0
                           344 at 2.5
                           282 at 3.0
                           176 unbounded
```

Per Francis's instruction, the next lower `0.5` step was selected. `2.5`
preserves both historical and applied per-case classification assignments from
the baseline, while reducing macro-schedule binding from 798 to 561 cases.

## Review set

- `docs/AUDIT_C6A_authority_2026-07-30.md`
- `docs/WORKORDER_Sol_C6B_authority_3.md`
- `tools/autopilot-sim/C6B_AUTHORITY_3_RESULTS.md`
- `tools/autopilot-sim/runAuthorityC6B.mjs`
- `tools/autopilot-sim/runSweep.ts`
- `tools/autopilot-sim/closedLoop.ts`
- `packages/inference/src/kinematicAutopilot.ts`
- `packages/inference/test/verify_autopilot.mjs`
- `packages/inference/test/verify_blocks.mjs`
- `DEVIATION_LOG.md`

## Ratification checks

1. `3.0` was tested as a new experiment, not interpolated.
2. Baseline, `2.5`, `3.0`, and unbounded were strict-compiled and double-run.
3. The historical decision-boundary timing mismatch was identified rather than
   allowing a structurally blind null result.
4. The applied-block classifier covers the block-6 grant during blocks 6–8.
5. `3.0` was rejected for a 62-case applied-`mixed` drift.
6. `2.5` has zero cycles, zero upward saturation, no applied-classification
   drift, a neutral nominal probe, zero niggle raises, and a green
   counterexample gate.
7. The exact `2.5` cumulative bound and five-block schedule are pinned.
8. Cuts remain unrationed and absent/non-finite macro positions fail closed.
9. The standing deviation is closed and the unbounded NO-GO is retained.
10. `verify:all` is green: 20 targets, 7/7 component suites, 66/66 tests.

The checkpoint is cleared for landing.
