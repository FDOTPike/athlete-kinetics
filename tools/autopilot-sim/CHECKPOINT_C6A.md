# Checkpoint C6A — post-audit authority policy

Date: 2026-07-30
Status: **HISTORICAL — SUPERSEDED BY CHECKPOINT C6B.**

## Audit closure completed

- The +1.5, +2.0, and unbounded authority sensitivities were run against the
  full deterministic 2,385-case R2 family.
- Macro-schedule refusal is separated from per-block pattern selection.
- The three downward saturations and 389 mixed cases are characterized.
- The window-relative partition and endpoint-noise characteristics are stated
  precisely.
- C6A measured the then-production `1.0`; C6B subsequently selected `2.5`.

Evidence:

- `docs/AUDIT_C6_R2_2026-07-30.md`
- `tools/autopilot-sim/C6_POST_AUDIT_AUTHORITY_SENSITIVITY.md`
- `tools/autopilot-sim/runAuthoritySensitivity.mjs`
- `tools/autopilot-sim/runSweep.ts`
- `tools/autopilot-sim/closedLoop.ts`

## Decision requested

1. **Ratify `2.0` (recommended finite relaxation).** It preserves all finite
   trajectory counts, keeps upward saturation and limit cycles at zero, reduces
   macro-schedule binding from 798 to 631 cases, and expands the grant schedule
   through macro block 4.
2. **Retain `1.0` as policy.** This preserves the C5 “no additional upward
   correction after week 8” posture; the standing deviation obligation must
   then be closed explicitly as a superseded calibration question.

Unbounded is a NO-GO because it introduces one deterministic noisy limit cycle.

## Verification

```text
node --check tools/autopilot-sim/runAuthoritySensitivity.mjs = 0
authority sensitivity, all four variants = 0
strict simulator compile and shipped 2,385-case baseline = 0
npm.cmd run verify:all = 0
component suites = 7/7
component tests = 66/66
```

The final shipped-baseline rerun reproduced `1,654 converged`, `389 mixed`,
`339 authority-limited`, `3 saturated-down`, `0 limit cycles`, and `0
saturated-up`; it also reconfirmed that the production source was byte
unchanged.

This checkpoint records the historical C6A decision surface. C6B tested the
preferred `3.0`, rejected it under the applied-`mixed` early-warning gate, and
implemented the authorized `2.5` fallback. See `CHECKPOINT_C6B.md`.
