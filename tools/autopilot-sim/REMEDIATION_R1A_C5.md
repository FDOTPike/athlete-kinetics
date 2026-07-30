# R1a amendment - fail-closed macro-cycle authority

Date: 2026-07-30
Status: **RATIFIED AT C5 ON 2026-07-30.**

## 1. Audit finding closed

`AUDIT_C5_R1_2026-07-30.md` found that an omitted or non-finite
`macroBlockIndex` resolved to macro block 1. Because blocks 1 and 2 carry the
R1 positive-RPE allowance, unknown state opened upward authority.

R1a closes that path:

- `deriveControlAction` now requires `macroBlockIndex` at the TypeScript
  boundary.
- Its runtime guard resolves an absent or non-finite value to
  `macroGrantSlots + 1`, which has no positive RPE allowance.
- `undefined`, `NaN`, and an omitted fourth argument each produce
  `blockAddedRpe = 0` and zero positive `dRpe_p` corrections.
- `blockGenerator.ts` remains the only shipped caller and already supplies the
  persisted index. The simulator also supplies its explicit next-block index.

The change fails closed without adding state, a migration, or a dependency.

## 2. Ratified product rationale recorded

The accepted `+1.0` macro-cycle budget and
`0.5,0.5,0,0,0,0,0,0` grant schedule apply only to the autopilot's corrective
addition. Planned progression continues through `progressionEngine` and the
`SCHEMES`/`PHASE_MODS` tables.

Source comments now state that R1 compensates for the known phase-biased
observer. `DEVIATION_LOG.md` records the standing R2 obligation to revisit the
constant and schedule after the observer fix, then rerun the full family and
confirm upward saturation does not return.

## 3. Verification

```text
npm.cmd run typecheck
exit=0

npm.cmd run verify:autopilot
R1a absent/non-finite macro index fails closed with zero RPE grant: PASS
ALL CHECKS PASSED

npm.cmd run verify:blocks
ALL CHECKS PASSED

npm.cmd run verify:autopilot-counterexamples
ALL CHECKS PASSED (7 R1 conversions, 11 expected PASS)

strict simulator compile
exit=0

full 2,385-case family
exit=0
deterministic double-runs=true
```

The complete `verify:all` run passed all 20 gates plus typecheck. Component
verification passed 7/7 suites and 66/66 tests; the existing non-fatal React
`act(...)` warnings remain.

## 4. Full-family comparison

The R1a transition table is unchanged from the original C5 evidence:

| Trajectory | Original C5 | After R1a | Change |
|---|---:|---:|---:|
| `converged_neutral` | 77 | 77 | 0 |
| `authority_limited_neutral` | 1,855 | 1,855 | 0 |
| `mixed` | 246 | 246 | 0 |
| `saturated_down` | 206 | 206 | 0 |
| `ratchet_down` | 1 | 1 | 0 |
| total | 2,385 | 2,385 | 0 |

Additional pins are unchanged:

```text
limit cycles=0
saturated-up cases=0
RPE-cap binding cases=0
saturated-down cases=206
ratchet-down cases=1
healthy raise blocks=1
niggle raise blocks=0
niggle override binding blocks=8
```

Nonlinear binding counts are also unchanged:

```text
E_MAX observer input=1067
actual-RPE clamp=2145
set floor=0
positive-set anti-windup=2082
```

## 5. C5 handback

R1a closes the audit's required fail-open fix without changing any valid-index
trajectory. The original R1 conclusion still holds: it is a consequence bound,
not evidence of closed-loop stability.

C5 was ratified by Francis on 2026-07-30. R2 is authorized under its separate
C6 review gate. Its first design question is answered in
`R2_PHASE_ANALYSIS_C6.md`.

The separate UI debt remains open: `BlockPlan.autopilotAdjusted` still has no
consumer that attributes autopilot changes to the athlete.
