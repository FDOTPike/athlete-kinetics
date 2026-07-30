# R2 remediation — window-segment observer trend

Date: 2026-07-30
Status: **RATIFIED — C6B SELECTED FINAL `2.5` AUTHORITY POLICY.**

## 1. Result

R2 replaces the cross-slice trend with a window-segment trend: the mean of
`last(valid delta-RPE) - first(valid delta-RPE)` across qualified seven-day
segments. These align with prescription weeks at scheduled production
boundaries and remain window-relative at diagnostic offsets. It preserves the
fixed 21-day evidence window, base EMA,
injury attenuation, confidence gate, controller constants, R1 authority
budget, halt supremacy, and monotone-conservative safety override.

The detailed formula and template decision are in
`R2_PHASE_ANALYSIS_C6.md`. Old and new analytic pins are separated in
`R2_PIN_RECOMPUTE_C6.md`.

## 2. Source and gate changes

- `packages/inference/src/kinematicAutopilot.ts`
  implements the phase-local trend.
- `packages/inference/test/verify_autopilot.mjs`
  recomputes the affected analytic pins, adds a phase-local direction pin, and
  restores the R1a phi-domain sweep's positive-grant coverage.
- `packages/inference/test/verify_autopilot_counterexamples.ts`
  retains the C4 counterexamples as historical inputs and pins their R2
  conversions, nominal convergence, low-frequency behavior, the safety pair,
  and normal/shifted real-template alignment.
- `tools/autopilot-sim/runSweep.ts`
  keeps the deterministic full-family evidence and uses a non-vacuous R2
  sentinel selected from a case with both observer signal and control response.

No controller constant, migration, app source, runtime dependency, or database
contract changes in R2.

## 3. Full-family transition

| Trajectory | R1a/C5 | R2/C6 | Change |
|---|---:|---:|---:|
| `converged_neutral` | 77 | 1,654 | +1,577 |
| `authority_limited_neutral` | 1,855 | 339 | -1,516 |
| `mixed` | 246 | 389 | +143 |
| `saturated_down` | 206 | 3 | -203 |
| `ratchet_down` | 1 | 0 | -1 |
| total | 2,385 | 2,385 | 0 |

```text
limit cycles=0
saturated-up cases=0
ratchet cases=0
historical C4 stationary conversions=6/6
```

The sweep's dynamic stationary list contains no cases because it is derived
from primary limit cycles and R2 leaves none. The dedicated counterexample gate
still runs all six historical C4 stationary cases directly.

Nonlinear binding counts:

| Binding | R1a/C5 | R2/C6 |
|---|---:|---:|
| observer E_MAX | 1,067 | 1,063 |
| actual-RPE clamp | 2,145 | 2,149 |
| base RPE cap | 0 | 0 |
| set floor | 0 | 0 |
| positive-set anti-windup | 2,082 | 852 |

## 4. Regression conversions

The six C4 stationary counterexamples and the nominal gain-3 saturation case
are deterministic R2 expected-pass cases:

| Case | R2 trajectory | R2 actions |
|---|---|---|
| stationary 1 | authority-limited neutral | cut, neutral × 3, cut, neutral × 3 |
| stationary 2 | converged neutral | neutral × 8 |
| stationary 3 | authority-limited neutral | neutral × 4, cut, neutral × 3 |
| stationary 4 | converged neutral | cut, neutral × 7 |
| stationary 5 | converged neutral | neutral × 8 |
| stationary 6 | converged neutral | neutral × 8 |
| nominal gain 3 | converged neutral | neutral × 8 |

The family-wide paired safety probe remains asymmetric in the conservative
direction: the healthy case has one raise; its niggle pair has zero raises and
the override binds wherever needed. Cuts remain unrationed.

## 5. C6 conclusion

Opus returned **GO on R2** in `docs/AUDIT_C6_R2_2026-07-30.md`. The
authority-policy obligation was resolved by C6B: `3.0` failed the predeclared
applied-`mixed` drift gate and the authorized `2.5` fallback was ratified.
