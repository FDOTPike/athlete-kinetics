# R1 remediation — cumulative RPE authority budget

Date: 2026-07-30
Status: **AMENDED BY R1a AND RATIFIED AT C5 ON 2026-07-30.**

R1a closes the C5 audit's fail-open macro-index default. See
`REMEDIATION_R1A_C5.md` for the amendment and unchanged full-family evidence.

## 1. Result

R1 establishes an immediate upper bound on positive RPE authority without
changing the observer:

```text
RPE_STEP = 0.5
MAX_MACROCYCLE_RPE_RAISE = 1.0
macro block allowance = 0.5,0.5,0,0,0,0,0,0
```

At most one positive `dRpe_p` grant survives in macro blocks 1 and 2. The
eligible pattern with the lowest `phi` wins; declaration order resolves a tie.
Blocks 3–8 have zero positive RPE authority. The generator applies each
positive grant to at most one planned slot, so the controller-space sum and the
actual planned-slot sum are both bounded by +1.0 over the eight-block
macro-cycle.

Unused grants do not bank. Existing persisted `macroBlockIndex` rolls from 8
back to 1, releasing the next cycle's first 0.5 grant without a migration or
hidden in-memory accumulator.

Cuts are not budgeted. A negative `dRpe_p` continues to reach every eligible
non-deload occurrence. Halt returns before either authority pass, and the
monotone-conservative safety override runs before the RPE budget.

## 2. Implementation

- `CONTROL_AUTHORITY.MAX_MACROCYCLE_RPE_RAISE = 1.0`.
- `ControlAction.blockAddedRpe` exposes the granted positive RPE sum.
- `deriveControlAction` receives the block's existing `macroBlockIndex`.
- A third constraint pass ranks positive RPE requests and applies the
  macro-cycle allowance.
- `generateBlock` applies a positive RPE grant once; negative RPE corrections
  remain unrationed.
- The simulator distinguishes `authority_limited_neutral` from
  `safety_override_neutral`.

No flaw-detection formula, observer constant, analytic `phi` pin, schema,
migration, dependency, or app-store call site changed.

## 3. Bound evidence

Targeted controller and generated-plan gates establish:

```text
controller blockAddedRpe = 0.5,0.5,0,0,0,0,0,0
controller cumulative positive RPE = 1.0
generated per-pattern cumulative positive RPE = 1.0
generated applied-slot cumulative positive RPE = 1.0
macro block 8 all-deficit probe: every pattern keeps dRpe_p=-0.5
macro rollover 8→1: positive allowance returns to 0.5
```

This is the bound requested by option 3. It limits consequence; it does not
correct the phase-biased observer.

## 4. Full-family result

This table preserves the historical decision-boundary classifier used for the
C5 decision. The later C6B follow-up restates the pre-R1 applied-block baseline
as 7 limit cycles, 1,445 saturated-up, 242 saturated-down, 69 converged, and 621
mixed; see `C3_CORRECTED_CLASSIFIER_FOLLOWUP.md`.

The same 2,385-case C3 family was rerun twice with deep-equal output.

| Trajectory | C3 | After R1 | Change |
|---|---:|---:|---:|
| `converged_neutral` | 75 | 77 | +2 |
| `authority_limited_neutral` | 0 | 1,855 | +1,855 |
| `mixed` | 584 | 246 | -338 |
| `saturated_up` | 1,505 | 0 | -1,505 |
| `limit_cycle` | 14 | 0 | -14 |
| `saturated_down` | 206 | 206 | 0 |
| `ratchet_down` | 1 | 1 | 0 |
| total | 2,385 | 2,385 | 0 |

RPE-cap binding falls from 1,911 cases to 0. The 206 downward-saturation cases
and the single downward ratchet are unchanged, which is consistent with cuts
remaining unrationed.

The six original stationary-template cases convert as follows:

| Original C4 case | R1 trajectory | RPE actions 1–8 |
|---|---|---|
| hypertrophy `(7,30,.3,.2,.25,1)`, neutral | `mixed` | `N,C,N,N,N,C,N,C` |
| peak `(21,30,1,.05,.5,.5)`, supercompensated | `authority_limited_neutral` | `N,N,N,N,C,N,N,N` |
| peak `(21,30,1,.05,.75,1)`, neutral | `authority_limited_neutral` | `N,C,C,N,C,N,N,N` |
| peak `(21,30,1,.2,1.25,1)`, supercompensated | `mixed` | `N,C,N,N,C,N,C,N` |
| zero-noise peak `(21,60,1,.2,1.5,0)`, neutral | `converged_neutral` | `N,C,N,N,N,N,N,N` |
| zero-noise peak `(21,60,1,.2,1.5,0)`, deficit | `converged_neutral` | `C,N,C,N,N,N,N,N` |

None remains a last-four alternating limit cycle, and none contains an RPE
raise at its fixed macro index.

## 5. Nominal and safety probes

Nominal stable gain-3, zero-noise:

```text
phi=-.2984,-.2996,-.2994,-.2996,-.2988,-.2991,-.2994,-.2995
actions=raise,neutral,neutral,neutral,neutral,neutral,neutral,neutral
applied RPE delta sum=0,.5,0,0,0,0,0,0
RPE-cap bindings=0,0,0,0,0,0,0,0
trajectory=authority_limited_neutral
```

The signal remains near `-0.299`; R1 suppresses it after the bounded grant
rather than fixing it. This is explicit evidence that R2 remains necessary.

The family-wide healthy headroom probe has one positive-action block, down from
eight. Its knee-niggle pair has zero raises and the monotone-conservative
override still binds all eight raw raise requests. The carry and rotation
`obs=3` probes remain `thin_data_neutral`.

## 6. Verification

```text
npm.cmd run typecheck
exit=0

npm.cmd run verify:blocks
ALL CHECKS PASSED

npm.cmd run verify:autopilot
ALL CHECKS PASSED

npm.cmd run verify:autopilot-counterexamples
ALL CHECKS PASSED (7 R1 conversions, 11 expected PASS)

strict C5 compile + full family sweep
C5_SWEEP_SECONDS=13.752
C5_SWEEP_EXIT=0
PRIMARY_CASES=2385
LIMIT_CYCLES=0
RPE_CAP_BINDING_CASES=0

npm.cmd run verify:all
exit=0 (20 gates + typecheck)
```

The component gate passed 66/66 tests with its existing non-fatal React
`act(...)` warnings.

## 7. C5 conclusion

R1 is a **GO for a cumulative positive-RPE exposure bound** and remains a
**NO-GO for a stability claim**. The observer continues to emit systematic
headroom signals in 1,855 authority-limited cases. R2 must not start before C5
ratification and must first settle whether the deload/window straddle is
universal or template-specific.
