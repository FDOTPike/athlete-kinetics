# C5 ratification — R1a cumulative RPE authority amendment

Date: 2026-07-30
Decision: **GO — RATIFIED. R2 AUTHORIZED UNDER THE C6 GATE.**

Francis ratified C5 after verifying all four R1a items in source:

1. `macroBlockIndex` is required and has no typed default.
2. An omitted, `undefined`, `NaN`, or otherwise non-finite index resolves to
   `macroGrantSlots + 1`, so unknown state fails closed with no positive RPE
   grant.
3. The R1a pin covers both `undefined` and `NaN`, and asserts per-pattern
   zeroing as well as aggregate zero authority.
4. The post-R2 recalibration obligation is recorded in `DEVIATION_LOG.md`.

The ratification identified one non-blocking coverage note:
`verify_autopilot.mjs` called `deriveControlAction` with three arguments inside
the phi-domain sweep. JavaScript supplied `undefined`, which correctly failed
closed, but the sweep silently stopped observing the `+0.5` branch. R2 supplies
macro index `1` in that pin, restoring the complete
`dRpe_p ∈ {-0.5, 0, +0.5}` domain.

This note did not reopen R1a and did not change any C5 transition result. It is
closed as part of the R2 test cleanup.
