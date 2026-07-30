# Checkpoint C6 — R2 window-segment observer

Date: 2026-07-30
Status: **RATIFIED — R2 GO; FINAL C6B `2.5` AUTHORITY POLICY APPROVED.**

## Review package

- `tools/autopilot-sim/RATIFICATION_C5_R1A.md`
- `tools/autopilot-sim/R2_PHASE_ANALYSIS_C6.md`
- `tools/autopilot-sim/R2_PIN_RECOMPUTE_C6.md`
- `tools/autopilot-sim/REMEDIATION_R2_C6.md`
- `tools/autopilot-sim/HANDOVER_2026-07-30_R2_C6.md`
- `docs/AUDIT_C6_R2_2026-07-30.md`
- `tools/autopilot-sim/C6_POST_AUDIT_AUTHORITY_SENSITIVITY.md`
- `tools/autopilot-sim/CHECKPOINT_C6A.md`
- `packages/inference/src/kinematicAutopilot.ts`
- `packages/inference/test/verify_autopilot.mjs`
- `packages/inference/test/verify_autopilot_counterexamples.ts`
- `tools/autopilot-sim/runSweep.ts`

## Questions reviewed by Opus

1. Is the source-backed conclusion correct that week-4 deload is universal
   except for the peak overreach shift?
2. Does the window-segment endpoint formula remove both identified straddles
   without adding template-specific coupling?
3. Is the one-observation-per-segment behavior acceptable under the existing
   `MIN_OBSERVATIONS` gate?
4. Are the old/new analytic pin changes complete and reviewable?
5. Do the stationary, nominal, safety, alignment, low-frequency, and
   2,385-case results justify a C6 GO?

## Opus disposition

`docs/AUDIT_C6_R2_2026-07-30.md` returned **GO on R2**, independently
re-derived the changed pins, and confirmed all six historical conversions.
Its authority-policy obligation is resolved in `CHECKPOINT_C6B.md`;
it does not reopen the observer correction.

## Verification

```text
npm.cmd run typecheck
exit=0

npm.cmd run verify:blocks
exit=0

npm.cmd run verify:autopilot
exit=0

npm.cmd run verify:autopilot-counterexamples
exit=0 (7 R2 conversions, 13 expected PASS)

npx.cmd tsc --strict --target es2020 --module commonjs --lib es2020,dom
  --rootDir . --outDir tools/autopilot-sim/.build
  tools/autopilot-sim/runSweep.ts
exit=0

node tools/autopilot-sim/.build/tools/autopilot-sim/runSweep.js
exit=0
primary cases=2,385
deterministic double-runs=true
limit cycles=0
saturated-up cases=0
ratchet cases=0

npm.cmd run verify:all
exit=0 (20 gates + typecheck)
component suites=7/7
component tests=66/66
```

The component run retains the repository's existing non-fatal React
`act(...)` warnings.

R2 is ratified. `docs/AUDIT_C6B_2026-07-30.md` subsequently ratified the final
`2.5` authority policy and cleared the combined remediation for landing.
