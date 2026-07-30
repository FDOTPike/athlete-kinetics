# Checkpoint C2 — derivation

Status: **RATIFIED 2026-07-30.** Francis explicitly directed C2 ratification
before presentation to Opus. No closed-loop sweep has run.

Artifacts:

- `tools/autopilot-sim/DERIVATION_C2.md`
- `tools/autopilot-sim/deriveBoundary.ts`

Gate output:

```text
npx.cmd tsc --strict ... tools/autopilot-sim/deriveBoundary.ts
C2_TYPECHECK_EXIT=0

node tools/autopilot-sim/.build/tools/autopilot-sim/deriveBoundary.js
C2_DERIVATION_EXIT=0

npm.cmd run verify:blocks
ALL CHECKS PASSED

npm.cmd run verify:autopilot
ALL CHECKS PASSED
```

Self-report:

1. The derivation includes the shipped trend term.
2. It carries the fast RPE channel and the slower set-dose convolution separately.
3. It uses a real `generateBlock` schedule and real deload timing.
4. Independent observer arithmetic agrees with shipped `detectFlaws` after round4.
5. The local relay activates near gain 1.0, inside the ratified 0.25–6 envelope.
6. The action response has the persistence sign, not the one-step reversal sign.
7. This is a saturation warning, not a closed-loop stability conclusion.
8. Explicit sweep falsifiers and a boundary-bracketing grid are recorded.
9. Initial fitness/fatigue offsets and nonzero-noise determinism are included.
10. No controller constant, shipped source, app, migration, package, or CI file changed.
