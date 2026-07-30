# Checkpoint C4 — expected-failure counterexample gate

Status: **RATIFIED 2026-07-30.** `docs/AUDIT_C4_2026-07-30.md` is a GO and
authorizes R1 through checkpoint C5.

Audit notes:

- The TypeScript gate is intentional: it imports the TypeScript C3 harness and
  obtains a strict compile before execution.
- The C4 change in `apps/mobile/test/verify_store_sql.mjs` was only the
  repository gate-count assertion changing from 19 to 20.

Artifacts:

- `packages/inference/test/verify_autopilot_counterexamples.ts`
- `tools/autopilot-sim/CHECKPOINT_C4.md`
- `package.json`
- `.github/workflows/ci.yml`
- `apps/mobile/test/verify_store_sql.mjs`
- `DEVIATION_LOG.md`
- `RELEASE_READINESS.md`

Verification:

```text
npm.cmd run verify:autopilot-counterexamples
ALL CHECKS PASSED (7 known XFAIL, 4 expected PASS)
C4_GATE_SECONDS=4.436
C4_GATE_EXIT=0

npm.cmd run typecheck
exit=0

npm.cmd run verify:all
exit=0 (20 gates + typecheck)
```

Gate contract:

- Six stationary-template limit cycles are pinned as known XFAIL.
- Nominal stable gain-3, zero-noise upward saturation is pinned as known XFAIL.
- An unexpected pass is a gate failure requiring deliberate conversion during
  remediation.
- The paired healthy/niggle override is expected PASS for all eight boundaries.
- GPP/frequency-4 carry and rotation remain `thin_data_neutral` with `obs=3`.
- Every case is deterministic across two complete runs.

Self-report:

1. C3 is recorded as ratified with plant-dependent and structural findings
   distinguished.
2. The gate executes the shipped observer, controller, generator, and window
   builder through the C3 closed-loop harness.
3. Seven known defects reproduce as XFAIL.
4. Four assertions are expected PASS: deterministic double-run, paired safety
   override, carry thin-data, and rotation thin-data.
5. Both zero-noise stationary counterexamples are included.
6. Nominal gain-3 raises at all eight boundaries and binds the peak RPE cap.
7. The gate is strict TypeScript and contains no explicit `any`.
8. The gate is named `verify:autopilot-counterexamples`, not a stability gate.
9. `verify:all`, CI, workflow guidance, and README counts are 20 gates plus
   typecheck.
10. `DEVIATION_LOG.md` and release-readiness section D identify the open defect.
11. No controller constant, shipped inference source, schema, app, or migration
    changed.
12. R1 and R2 remain blocked behind their later checkpoints.
