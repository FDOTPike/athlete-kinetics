# C3 corrected-classifier follow-up

Date: 2026-07-31
Status: **COMPLETE — C6B §4 FOLLOW-UP DISCHARGED.**

## 1. Reason

The original C3 aggregate labels classified `actionForNext` decisions recorded
after simulation blocks 6–8. C6B established that this view is one controller
boundary later than the corrections actually applied in blocks 6–8.

`docs/AUDIT_C6B_2026-07-30.md` ratified the selected `2.5` authority policy and
required the pre-R1 C3 baseline to be replayed through the corrected
`actionApplied` classifier.

## 2. Method

`runC3Corrected.mjs` reads the exact pre-R1/pre-R2 inference source from commit
`84f3e7e496449aaa4cfc11db724a1dc6819bbf59`, installs it in a fresh OS-temp
tree, and adapts only the later simulator reporting fields needed to expose
both classifier views. It then strict-compiles and double-runs the unchanged
2,385-case C3 family.

The production `kinematicAutopilot.ts` and `blockGenerator.ts` files are checked
byte-unchanged after the isolated replay.

## 3. Restated C3 aggregates

| Classification | Historical decision boundary | Corrected applied blocks |
|---|---:|---:|
| `converged_neutral` | 75 | 69 |
| `mixed` | 584 | 621 |
| `saturated_up` | 1,505 | 1,445 |
| `limit_cycle` | 14 | 7 |
| `saturated_down` | 206 | 242 |
| `ratchet_down` | 1 | 1 |
| total | 2,385 | 2,385 |

Headline saturation therefore changes from `1,711` to `1,687` cases:
`1,445` upward plus `242` downward.

The historical assignment fingerprint reproduced as `f223ef91`; the corrected
applied assignment fingerprint is `2372b038`. All deterministic checks passed.

## 4. Stationary counterexample interpretation

The original finite eight-block decision-boundary view labels six stationary
replays as last-four alternating. The corrected finite applied-block view labels
two because it observes decisions through block 7; the decision made after
block 8 would first be applied in block 9, outside the eight-block horizon.

This timing restatement does not invalidate the six explicit counterexamples:
their per-boundary action tables remain reproducible, two are zero-noise, and
all six remain individually pinned by the remediation gate. It does narrow the
aggregate claim: two are visible as alternating in applied blocks 5–8, while
six are visible in decisions made after blocks 5–8.

## 5. Conclusion

The C3 conclusion is unchanged. The pre-remediation controller is a NO-GO for a
stability claim, with deterministic limit cycles and dominant upward
saturation under the ratified plant family. Only the aggregate labels are
restated; the explicit counterexamples and the need for both R1 and R2 remain.

## 6. Reproduction

```text
node --check tools/autopilot-sim/runC3Corrected.mjs
exit=0

node tools/autopilot-sim/runC3Corrected.mjs
productionSourcesMutated=false
strictCompile=true
fullFamilyDoubleRunDeepEqual=true
primaryCases=2385
historical=75,584,1505,14,206,1
corrected=69,621,1445,7,242,1
historicalStationaryLimitCycles=6
correctedAppliedStationaryLimitCycles=2
```
