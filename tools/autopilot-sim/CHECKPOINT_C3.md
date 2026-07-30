# Checkpoint C3 — closed-loop sweep

Status: **RATIFIED 2026-07-30.** `docs/AUDIT_C3_2026-07-30.md` accepts the
C3 finding as a NO-GO for a stability claim and a GO for preserving the
counterexamples. C4 is authorized as an expected-failure gate only. C6B later
restated the aggregate counts under the corrected applied-block classifier;
see `tools/autopilot-sim/C3_CORRECTED_CLASSIFIER_FOLLOWUP.md`.

Artifacts:

- `tools/autopilot-sim/closedLoop.ts`
- `tools/autopilot-sim/runSweep.ts`
- `tools/autopilot-sim/SWEEP_C3.md`
- `tools/autopilot-sim/PROPOSAL_autopilot_stability_counterexample.md`

Gate-independent execution:

```text
C3_TYPECHECK_EXIT=0
C3_SWEEP_EXIT=0
primary cases=2385; deterministic double-run=true
historical decision-boundary: limit=14; stationary limit=6
historical: saturated up=1505; saturated down=206; converged neutral=75
corrected applied blocks: limit=7; saturated up=1445; saturated down=242
corrected applied blocks: converged neutral=69; mixed=621; ratchet down=1

npm.cmd run verify:blocks
ALL CHECKS PASSED

npm.cmd run verify:autopilot
ALL CHECKS PASSED
```

Self-report:

1. The loop executes all four shipped engines for 8 blocks × 4 weeks.
2. Block 1 is nontrivial and target-bearing; a null harness throws.
3. All six ratified plant dimensions and all three initial states are swept.
4. Nonzero-noise and every audit probe are deterministic across two runs.
5. Per-block tables distinguish active saturation from neutral convergence.
6. Six limit cycles survive fixed-template replay; two use zero noise.
7. Healthy upward RPE ratcheting reaches the cap while positive sets stay rationed.
8. The knee-niggle override blocks all eight paired raises.
9. Low-frequency `obs=3` correctly emits neutral action despite `phi≈-0.3`.
10. No controller constant, shipped source, gate, package, CI, or migration changed.
