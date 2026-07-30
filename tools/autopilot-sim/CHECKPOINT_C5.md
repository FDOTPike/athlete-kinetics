# Checkpoint C5 — R1 cumulative RPE authority budget

Status: **RATIFIED 2026-07-30. R2 AUTHORIZED.**

Artifacts:

- `packages/inference/src/kinematicAutopilot.ts`
- `packages/inference/src/blockGenerator.ts`
- `packages/inference/test/verify_autopilot.mjs`
- `packages/inference/test/verify_blocks.mjs`
- `packages/inference/test/verify_autopilot_counterexamples.ts`
- `tools/autopilot-sim/closedLoop.ts`
- `tools/autopilot-sim/runSweep.ts`
- `tools/autopilot-sim/REMEDIATION_R1_C5.md`
- `tools/autopilot-sim/REMEDIATION_R1A_C5.md`
- `docs/AUDIT_C5_R1_2026-07-30.md`
- `docs/WORKORDER_Sol_R1a_C5_amendment.md`
- `DEVIATION_LOG.md`
- `tools/autopilot-sim/CHECKPOINT_C5.md`

Verification:

```text
typecheck=0
verify:blocks=0
verify:autopilot=0
verify:autopilot-counterexamples=0
R1a omitted/undefined/NaN macro-index pin=PASS
C5 strict compile + 2,385-case sweep=0
R1a transition table versus original C5=UNCHANGED
verify:all=0 (20 gates + typecheck)
```

Self-report:

1. C4 is recorded as ratified by `AUDIT_C4_2026-07-30.md`.
2. R1 uses the persisted macro-block index; no migration or hidden state exists.
3. Positive RPE grants are `0.5,0.5,0,0,0,0,0,0`.
4. The worst-case controller-space and applied-slot macro-cycle sums are +1.0.
5. Unused grants do not bank; the allowance resets on macro index 8→1.
6. Positive grants apply to one planned slot; cuts remain unrestricted.
7. Halt and monotone-conservative safety overrides remain supreme.
8. The observer and analytic `phi` pins are unchanged.
9. All seven C4 XFAIL cases deliberately convert to expected PASS.
10. In the historical decision-boundary view used at C5, primary limit cycles fall 14→0 and saturated-up cases 1,505→0; the later corrected C3 baseline is 7 and 1,445.
11. The six stationary-template counterexamples no longer alternate.
12. RPE-cap binding falls 1,911→0 cases.
13. Downward saturation remains 206 and the downward ratchet remains 1.
14. Low-frequency thin-data behavior remains correct.
15. R1 is a consequence bound, not a stability cure.
16. C5 is ratified; R2 is authorized under the separate C6 gate.
17. R1a makes `macroBlockIndex` required for typed callers.
18. Omitted, `undefined`, and `NaN` macro indices fail closed with no RPE grant.
19. The corrective-overlay rationale and post-R2 recalibration obligation are recorded.
20. The full 2,385-case transition and nonlinear-binding tables are unchanged.
