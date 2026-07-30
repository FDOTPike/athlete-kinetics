# C3 closed-loop sweep

Date: 2026-07-30
Status: **RATIFIED 2026-07-30. AGGREGATES RESTATED 2026-07-31 UNDER C6B.**

## 1. Finding

The shipped Kinematic Autopilot is **not stable across the ratified plant
family**.

- Under the corrected applied-block classifier, the 2,385-case primary
  macro-cycle sweep contains **7 limit-cycle cases**.
- The historical decision-boundary view identified **6 stationary-template
  limit cycles**; the finite corrected applied-block horizon labels 2, while
  all six explicit action tables remain reproducible and individually pinned.
- Two stationary counterexamples occur at `SIGMA_RPE=0`.
- **1,687/2,385 cases saturate**: 1,445 upward and 242 downward.
- Only 69 cases converge neutral; 621 remain mixed and one ratchets down before
  a nonlinear binding occurs.

The dominant practical failure is upward saturation. The stable nominal plant at
gain 3 requests a raise at every boundary and reaches the profile RPE cap. This
is not convergence: `phi` stays near `-0.298` while the relay remains active.

The C2 arithmetic remains a valid local forced-response calculation. Its
approximately-1.0 activation boundary does **not** predict the global
closed-loop onset. The explicit C2 sweep falsifiers fire.

## 2. Executed design

Every run imports and executes the shipped:

- `detectFlaws`;
- `deriveControlAction`;
- `generateBlock`;
- `buildPatternWindow`.

Each primary case runs 8 blocks × 4 weeks. The controller constants remain
unchanged.

The primary family contains:

```text
16 full-factor corners over:
  TAU_FAT  = {7, 21}
  TAU_FIT  = {30, 60}
  K_FAT    = {0.3, 1.0}
  K_FIT    = {0.05, 0.20}

15 RPE_GAIN values:
  [0.25, 0.50, 0.75, 0.90, 0.95, 1.00, 1.05, 1.10,
   1.25, 1.50, 2.00, 2.50, 3.00, 4.50, 6.00]

SIGMA_RPE = {0, 0.5, 1.0}

initial state =
  neutral                 (fitness=0,    fatigue=0)
  mid-deficit             (fitness=0,    fatigue=0.75)
  mid-supercompensation   (fitness=0.75, fatigue=0)

corner cases             = 16 × 15 × 3 × 3 = 2,160
stable nominal cases     =      15 × 3 × 3 =   135
overreach/adapting cases =  2 × 15 × 1 × 3 =    90
primary total                                      2,385
```

The separate audit probes contain:

- five real deload/window alignments;
- two low-frequency patterns;
- a paired healthy/niggle monotone-conservative test;
- 28 stationary-template replays of the 14 macro-cycle limit cases.

Actual RPE is the observable bounded value:

```text
capacity = BASE_CAPACITY_RPE + fitness - fatigue
raw_actual = target_rpe + RPE_GAIN × (target_rpe - capacity) + seeded_noise
actual_rpe = clamp(raw_actual, 1, 10)
delta_rpe = actual_rpe - target_rpe
```

Daily plant state uses the ratified same-day recurrence and slot dose:

```text
dose = (sets / 4) × (target_rpe / 10)
fitness(t+1) = exp(-1/TAU_FIT) × fitness(t) + K_FIT × dose(t)
fatigue(t+1) = exp(-1/TAU_FAT) × fatigue(t) + K_FAT × dose(t)
```

The PRNG and Gaussian transform are seeded. No `Date.now()` or `Math.random()`
appears. Primary, alignment, low-frequency, safety-override, and stationary
replays are each deep-equal across two complete runs.

## 3. Fail-loud coupling sentinel

The nominal stable, gain-3, zero-noise block-1 report is nontrivial:

```text
id=stable|g3.00|s0.00|neutral|squat
block1AllPhiZero=false
block1AllCorrectionsNeutral=false
block1Observations=6
block1Phi=-0.2984
totalTargetBearingSets=247
```

The executable throws if this sentinel becomes all-zero or if any simulated
block emits no target-bearing sets for its configured pattern.

## 4. Historical and corrected primary result

The original C3 labels used `actionForNext` decisions recorded after the last
blocks. C6B later established that this is one boundary later than the
corrections actually applied in those blocks. Both views are retained here;
the corrected `actionApplied` view is the current headline.

Trajectory labels use the last blocks, not aggregate variance alone:

- `converged_neutral`: last three actions neutral and `|phi|<0.15`;
- `limit_cycle`: last four actions nonzero and alternating;
- `ratchet_*`: last three actions have one direction without a nonlinear bind;
- `saturated_*`: last three actions have one direction while `E_MAX`, actual-RPE
  clamp, RPE cap, or set floor binds;
- `mixed`: none of the above.

Historical decision-boundary result (reproduced exactly by the follow-up):

```text
converged_neutral     75
mixed                584
saturated_up        1505
limit_cycle           14
saturated_down       206
ratchet_down            1
total                2385
```

Corrected applied-block result:

```text
converged_neutral     69
mixed                621
saturated_up        1445
limit_cycle            7
saturated_down       242
ratchet_down            1
total                2385
```

Historical decision-boundary per-gain counts:

| Gain | Cases | Any action | Direction change | Converged | Mixed | Saturated up | Saturated down | Limit cycle | Ratchet down |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.25 | 159 | 135 | 50 | 35 | 106 | 16 | 0 | 1 | 1 |
| 0.50 | 159 | 159 | 33 | 13 | 63 | 82 | 0 | 1 | 0 |
| 0.75 | 159 | 159 | 31 | 3 | 55 | 99 | 0 | 2 | 0 |
| 0.90 | 159 | 159 | 30 | 4 | 43 | 112 | 0 | 0 | 0 |
| 0.95 | 159 | 159 | 31 | 2 | 44 | 112 | 1 | 0 | 0 |
| 1.00 | 159 | 159 | 22 | 4 | 35 | 113 | 6 | 1 | 0 |
| 1.05 | 159 | 159 | 22 | 4 | 32 | 114 | 9 | 0 | 0 |
| 1.10 | 159 | 159 | 27 | 2 | 43 | 107 | 7 | 0 | 0 |
| 1.25 | 159 | 159 | 24 | 0 | 34 | 110 | 14 | 1 | 0 |
| 1.50 | 159 | 159 | 14 | 0 | 24 | 108 | 22 | 5 | 0 |
| 2.00 | 159 | 159 | 12 | 1 | 18 | 113 | 27 | 0 | 0 |
| 2.50 | 159 | 159 | 12 | 0 | 20 | 113 | 26 | 0 | 0 |
| 3.00 | 159 | 159 | 9 | 0 | 27 | 105 | 27 | 0 | 0 |
| 4.50 | 159 | 159 | 14 | 0 | 21 | 105 | 31 | 2 | 0 |
| 6.00 | 159 | 159 | 14 | 7 | 19 | 96 | 36 | 1 | 0 |

There is no stability transition at the C2 local boundary. In the canonical
zero-noise slice, the first non-neutral action appears at the grid floor
`RPE_GAIN=0.25` (blocks 7-8). The exact onset below 0.25 remains open. From 0.75
upward, the canonical case acts in all eight blocks.

## 5. Saturation is not convergence

Nominal stable plant, gain 3, zero noise:

| Block | Macro phase | `phi` | Next action | Applied set Δ | Applied RPE Δ sum | `E_MAX` binds | Actual-RPE clamps | RPE-cap binds |
|---:|---|---:|---|---:|---:|---:|---:|---:|
| 1 | gpp | -0.2984 | raise | 0 | 0 | 0 | 2 | 0 |
| 2 | gpp | -0.2987 | raise | +1 | +3 | 0 | 5 | 0 |
| 3 | hypertrophy | -0.2979 | raise | +1 | +3 | 0 | 6 | 0 |
| 4 | hypertrophy | -0.2988 | raise | +1 | +3 | 0 | 6 | 0 |
| 5 | volume | -0.2964 | raise | +1 | +3 | 0 | 6 | 0 |
| 6 | volume | -0.2973 | raise | +1 | +3 | 0 | 6 | 0 |
| 7 | peak | -0.2986 | raise | +1 | +2 | 0 | 6 | 2 |
| 8 | peak | -0.2987 | raise | +1 | +2 | 0 | 6 | 2 |

First-three `phi` peak-to-peak is `0.0008`; last-three is `0.0014`. A variance
test alone calls this settled. The action table shows the opposite: the relay
raises at every boundary and the RPE cap binds in the peak blocks.

Across the primary family, at least one nonlinear mechanism binds in:

```text
E_MAX observer input          1073 / 2385 cases
actual-RPE [1,10] clamp       2233 / 2385 cases
profile RPE cap               1911 / 2385 cases
set floor                        0 / 2385 cases
positive-set anti-windup      2081 / 2385 cases
```

## 6. Stationary-template limit-cycle counterexamples

The historical decision-boundary view identified fourteen alternating cases
over the real 32-week macro-cycle; the corrected applied-block view identifies
seven. Each of the original fourteen cases also runs for eight repeats of a
fixed hypertrophy template and eight repeats of a fixed peak template. Six of
those 28 stationary replays satisfy the historical last-four-decision
criterion, while two satisfy it within applied blocks 5–8. The other four make
the completing decision after block 8, which would be applied in block 9 beyond
the finite horizon. All six explicit decision tables remain pinned.

The strongest counterexample is deterministic and zero-noise:

```text
TAU_FAT=21, TAU_FIT=60, K_FAT=1.0, K_FIT=0.2,
RPE_GAIN=1.5, SIGMA_RPE=0, initial=(0,0),
real fixed macro block=8 (peak), normal week-4 deload.
```

| Block | `phi` | Next action | Applied set Δ | Applied RPE Δ sum | `E_MAX` binds | Actual-RPE clamps | RPE-cap binds |
|---:|---:|---|---:|---:|---:|---:|---:|
| 1 | +0.1337 | neutral | 0 | 0 | 0 | 5 | 0 |
| 2 | +0.3264 | cut | 0 | 0 | 0 | 6 | 0 |
| 3 | -0.1649 | raise | -6 | -3 | 0 | 6 | 0 |
| 4 | +0.2336 | cut | +1 | +2 | 0 | 6 | 2 |
| 5 | -0.2289 | raise | -6 | -3 | 0 | 6 | 0 |
| 6 | +0.1812 | cut | 0 | +2 | 0 | 6 | 2 |
| 7 | -0.2490 | raise | -6 | -3 | 0 | 6 | 0 |
| 8 | +0.1729 | cut | +1 | +2 | 0 | 6 | 2 |

`E_MAX` never binds in this counterexample. The actual-RPE plant clamp and the
profile RPE cap do bind, so this is precisely the nonlinear regime excluded by
the C2 linearisation.

A second zero-noise case starts mid-deficit at the same plant point:

| Block | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `phi` | +0.2070 | -0.0927 | +0.1755 | -0.2009 | +0.2172 | -0.2384 | +0.1711 | -0.2519 |
| action | cut | neutral | cut | raise | cut | raise | cut | raise |

All six stationary cases:

| Fixed template | Plant `(tauFat,tauFit,kFat,kFit,gain,sigma)` | Initial `(fit,fat)` | `phi` blocks 1-8 | Actions blocks 1-8 |
|---|---|---|---|---|
| hypertrophy | `(7,30,0.3,0.2,0.25,1)` | `(0,0)` | `.1224,.2707,-.2988,-.0359,-.2852,.1708,-.2871,.1911` | `N,C,R,N,R,C,R,C` |
| peak | `(21,30,1,.05,.5,.5)` | `(.75,0)` | `.1030,.0208,.0860,.1101,.1682,-.2273,.1631,-.2338` | `N,N,N,N,C,R,C,R` |
| peak | `(21,30,1,.05,.75,1)` | `(0,0)` | `-.1105,.4021,.4008,-.0362,.3593,-.2332,.2255,-.1906` | `N,C,C,N,C,R,C,R` |
| peak | `(21,30,1,.2,1.25,1)` | `(.75,0)` | `-.2060,.2665,-.0153,.0299,.1806,-.2612,.2511,-.2571` | `R,C,N,N,C,R,C,R` |
| peak | `(21,60,1,.2,1.5,0)` | `(0,0)` | `.1337,.3264,-.1649,.2336,-.2289,.1812,-.2490,.1729` | `N,C,R,C,R,C,R,C` |
| peak | `(21,60,1,.2,1.5,0)` | `(0,.75)` | `.2070,-.0927,.1755,-.2009,.2172,-.2384,.1711,-.2519` | `C,N,C,R,C,R,C,R` |

Legend: `N=neutral`, `C=cut`, `R=raise`.

## 7. Downward saturation and asymmetric authority

One downward example:

```text
plant=(21,30,1,0.05,gain=0.95,sigma=1)
initial=(0,0)
phi=-.1556,-.0708,.3039,-.0543,.3319,.2231,.2871,.2158
actions=raise,neutral,cut,neutral,cut,cut,cut,cut
applied set delta=0,+1,0,-6,0,-6,-6,-6
applied RPE delta sum=0,+3,0,-3,0,-3,-3,-3
E_MAX binds=0,0,1,1,1,3,1,1
```

A cut reaches all six non-deload squat occurrences (`set Δ=-6`), while a
positive set is granted once at most (`set Δ=+1`) and is often denied by the
global two-set budget. The RPE channel has no matching once-per-block ration:
its `±0.5` change reaches every non-deload occurrence unless the RPE cap binds.

The paired healthy headroom case uses the ratified adapting archetype at gain
0.75, sigma 0.4, and mid-supercompensation:

```text
healthy phi:
  -.2007,-.2846,-.2828,-.2845,-.2804,-.2813,-.2524,-.2587
healthy actions:
  raise,raise,raise,raise,raise,raise,raise,raise
applied set delta:
  0,0,+1,+1,0,0,0,0
applied RPE delta sum:
  0,+3,+3,+3,+3,+3,+2,+2
RPE-cap bindings:
  0,0,0,0,0,0,2,2
```

This confirms the C2 audit's safety concern: a healthy athlete requests an
upward RPE change at all eight observed boundaries. Seven requests enter the
remaining simulated blocks; the eighth targets the next block. Positive sets
remain rationed.

Adding a knee niggle at intermediate severity 4 leaves the negative `phi`
signal present but blocks all eight raises:

```text
niggle phi:
  -.2007,-.2681,-.2697,-.2665,-.2591,-.2611,-.2047,-.2546
actions:
  neutral,neutral,neutral,neutral,neutral,neutral,neutral,neutral
monotone-conservative override binding blocks=8
```

The override works when a qualifying safety signal exists. The healthy case has
no such protection.

## 8. Deload and observer alignment

All rows use the real generator. Offsets are non-positive telemetry end offsets
from the scheduled block boundary.

| Alignment | `phi` blocks 1-8 | Actions blocks 1-8 | Classification |
|---|---|---|---|
| normal week-4 deload, offset 0 | `-.2978,-.2957,-.2981,-.2988,-.2991,-.2992,-.2993,-.2993` | `R,R,R,R,R,R,R,R` | saturated up |
| normal week-4 deload, offset -3 | same | `R,R,R,R,R,R,R,R` | saturated up |
| normal week-4 deload, offset -7 | `+.0921,-.1955,-.2285,-.2285,-.2285,-.2285,-.2285,-.2285` | `N,R,R,R,R,R,R,R` | saturated up |
| peak, normal week-4 deload | `-.2928,-.2880,-.2949,-.2968,-.2977,-.2979,-.2982,-.2981` | `R,R,R,R,R,R,R,R` | saturated up |
| peak, shifted week-1 deload | `-.2285,-.1386,-.2285,-.1386,-.2285,-.1386,-.2285,-.1386` | `R,N,R,N,R,N,R,N` | mixed |

Moving the real peak deload to week 1 changes the trajectory materially and
removes same-direction action every second block. It does not establish
stability; the controller still repeats an active/neutral two-block pattern.

## 9. Low-frequency confidence gate

The real GPP/frequency-4 template trains `carry` and `rotation` once per week
under the four-slot session cap. Each 21-day observer window contains three
valid days:

```text
carry phi     = -.2999,-.3000,-.3000,-.3000,-.3000,-.3000,-.3000,-.3000
carry obs     = 3,3,3,3,3,3,3,3
carry action  = neutral × 8

rotation phi    = same
rotation obs    = 3,3,3,3,3,3,3,3
rotation action = neutral × 8
```

`detectFlaws` still exposes a large `phi`, but `deriveControlAction` correctly
collapses it to neutral because `3 < MIN_OBSERVATIONS=5`. This is
`thin_data_neutral`, not convergence.

## 10. C2 falsifiers resolved

| C2 falsifier | C3 result |
|---|---|
| No qualitative transition across `0.90-1.10` | **Fires.** Canonical cases are saturated upward throughout. |
| Transition outside `0.75-1.25` | **Fires.** Canonical action occurs at the 0.25 grid floor; exact lower onset remains open. |
| Immediate one-step reversal rather than persistence | Does not fire at canonical gain 3; it raises in all eight blocks. |
| Convergence where the local model predicts persistence/saturation | Does not rescue stability; nominal gain 3 saturates and six stationary cases cycle. |
| Alignment changes the sign/trajectory without accounting for phase | **Material.** Week-1 deload changes continuous raising to raise/neutral alternation. |

The approximately-1.0 C2 number describes the local incremental response around
zero error. It is not a global closed-loop stability boundary.

## 11. Reproducible command and output

```text
npx.cmd tsc --strict --target es2020 --module commonjs --lib es2020,dom
  --rootDir . --outDir tools/autopilot-sim/.build
  tools/autopilot-sim/runSweep.ts
C3_TYPECHECK_EXIT=0

node tools/autopilot-sim/.build/tools/autopilot-sim/runSweep.js
C3_SWEEP_EXIT=0

primaryCases=2385
primaryDoubleRunDeepEqual=true
alignmentDoubleRunDeepEqual=true
lowFrequencyDoubleRunDeepEqual=true
overrideDoubleRunDeepEqual=true
stationaryCycleDoubleRunDeepEqual=true
block1AllPhiZero=false
block1AllCorrectionsNeutral=false
macroCycleLimitCases=14
stationaryProbeCases=28
stationaryLimitCases=6
saturatedUp=1505
saturatedDown=206
convergedNeutral=75

node --check tools/autopilot-sim/runC3Corrected.mjs
C3_CORRECTED_RUNNER_CHECK_EXIT=0

node tools/autopilot-sim/runC3Corrected.mjs
C3_CORRECTED_REPLAY_EXIT=0
historical=75,584,1505,14,206,1
corrected=69,621,1445,7,242,1
historicalStationaryLimitCycles=6
correctedAppliedStationaryLimitCycles=2
```

The executable prints the full machine-readable per-block tables and throws on
nondeterminism, an all-zero sentinel, or missing targets.

## 12. C3 conclusion

C3 is a **NO-GO for a stability claim** and a **GO as a counterexample
finding**. No oscillation-absence gate represents this controller honestly.

The required response options are documented in
`tools/autopilot-sim/PROPOSAL_autopilot_stability_counterexample.md`. No C4 gate,
controller constant, shipped source, app, migration, package, or CI file
changes at this checkpoint.

## 13. Ratification interpretation

`docs/AUDIT_C3_2026-07-30.md` ratifies the C3 finding with these limits:

- The exact counts and distribution are plant-dependent because they rely on
  the ratified fiat plant.
- The observer/controller mismatch is structural and plant-independent: the
  observer compares older corrected weeks with a recent uncorrected week-4
  deload; a healthy athlete has no upward gate except the profile cap; and the
  RPE channel has no cumulative ration equivalent to positive sets.
- Classification thresholds are audit labels, not derived controller
  constants. The 584 mixed cases remain unresolved after eight blocks.
- The exact onset below gain 0.25 remains open.
- Whether the week-4 deload straddle is universal or template-specific must be
  established before the phase-aware remediation.

The zero-noise stationary cycles and nominal gain-3 upward saturation are
robust counterexamples despite those limits. C4 therefore preserves those
known failures explicitly; it does not claim absence of oscillation.

C6B's corrected-classifier follow-up is recorded in
`C3_CORRECTED_CLASSIFIER_FOLLOWUP.md`. It changes the aggregate labels, not the
C3 NO-GO conclusion or the explicit counterexamples.
