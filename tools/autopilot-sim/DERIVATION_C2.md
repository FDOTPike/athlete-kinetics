# C2 derivation — two-channel relay response

Status: **RATIFIED 2026-07-30.** Francis explicitly directed C2 ratification
before presentation to Opus. No closed-loop sweep has run.

## Result

The one-block local response does **not** support the prior “gain ≈ 1.2 causes a
one-step relay reversal” interpretation. With the shipped block timing, the RPE
and set channels, the week-4 deload, and the trend term included, the canonical
response crosses the relay deadband near gain 1.0 in the **same direction as the
action that produced it**:

| Forced action | Local relay activation gain | Response at `RPE_GAIN=3` | One-step reversal requires |
|---|---:|---:|---:|
| deficit cut (`dRpe=-0.5`, `dSet=-1`) | 0.9965806 | `φ=+0.2788` | `Δφ≤-0.3000` |
| headroom raise (`dRpe=+0.5`, one `dSet=+1`) | 1.0133801 | `φ=-0.2777` | `Δφ≥+0.3000` |

The signs are the important result. The cut produces a positive score and the
raise produces a negative score, so this local model predicts relay persistence
or saturation, not a period-2 reversal. This is not a closed-loop stability
proof: initial state, nonlinear RPE clamping, baseline errors, later blocks, and
plant-family variation remain C3 questions.

## 1. Scope and operating point

The evaluated template is emitted by the real `generateBlock` engine:

- strength objective, intermediate, four sessions per week;
- LINEAR schema, macro block 3 (first hypertrophy-phase block);
- squat, trained twice per week;
- 21-day observer window covering block days 7 through 27;
- no injury attenuation, no observation attenuation, and zero noise;
- local perturbation about zero observer error, before actual-RPE or `E_MAX`
  branch changes.

The real template contains squat observations at observer indices
`[0,3,7,10,14,17]`. Indices 0 and 3 are week 2, 7 and 10 are week 3, and 14
and 17 are the uncorrected deload week. Calendar gaps remain `null`, exactly as
`buildPatternWindow` emits them.

## 2. Both control channels

The ratified daily slot dose is

```text
q = (sets / 4) × (target_rpe / 10) = sets × target_rpe / 40.
```

For the audit's canonical `4 sets @ RPE 7.5` slot:

```text
q_base = 4 × 7.5 / 40 = 30 / 40 = 0.7500.

RPE-only cut:
q_rpe = 4 × 7.0 / 40 = 28 / 40 = 0.7000
Δq_rpe = 0.7000 − 0.7500 = −0.0500.

Set-only cut:
q_set = 3 × 7.5 / 40 = 22.5 / 40 = 0.5625
Δq_set = 0.5625 − 0.7500 = −0.1875.

|Δq_set| / |Δq_rpe| = 0.1875 / 0.0500 = 3.7500.

Simultaneous shipped cut:
q_cut = 3 × 7.0 / 40 = 21 / 40 = 0.5250
Δq_cut = 0.5250 − 0.7500 = −0.2250.
```

The simultaneous result includes the `(+1 set-RPE unit)/40 = +0.0125`
cross-term, so `−0.0500 − 0.1875 + 0.0125 = −0.2250`.

The raise is asymmetric. `generateBlock` grants a positive set addition once
per pattern per block, but applies a negative set cut at every occurrence. The
first raise is

```text
q_raise,first = 5 × 8.0 / 40 = 40 / 40 = 1.0000
Δq_raise,first = 1.0000 − 0.7500 = +0.2500.
```

Later non-deload raise slots carry only `dRpe=+0.5`. In week 2:

```text
q_base = 4 × 8.0 / 40 = 0.8000
q_raise = 4 × 8.5 / 40 = 0.8500
Δq_raise = +0.0500.
```

The first `+1 set` occurs on day 0, outside the trailing observer window. Its
plant state persists into the window, but its direct dose does not appear as a
recent observation.

## 3. Different lags

Let `a_fit=exp(-1/TAU_FIT)` and `a_fat=exp(-1/TAU_FAT)`. At the stable plant
point:

```text
a_fit = exp(-1/45) = 0.9780228725
a_fat = exp(-1/14) = 0.9310627797.
```

The paired corrected-minus-baseline state obeys

```text
δfitness(t+1) = a_fit × δfitness(t) + K_FIT × δq(t)
δfatigue(t+1) = a_fat × δfatigue(t) + K_FAT × δq(t)
δcapacity(t+1) = δfitness(t+1) − δfatigue(t+1).
```

Before RPE clamping, the observable error is

```text
e(t) = actual_rpe(t) − target_rpe(t)
     = RPE_GAIN × (target_rpe(t) − capacity(t)).
```

Therefore the correction response is

```text
δe(t) = RPE_GAIN × (δtarget_rpe(t) − δcapacity(t)).
```

`δtarget_rpe` is the fast same-session channel. `δcapacity` is the convolution
of all earlier dose changes with the two decay kernels. The real-template
substitutions give:

| Block day | Observer index | Cut `δrpe` | Cut `δq` | Cut `δcapacity` | Cut `δe/gain` | Raise `δrpe` | Raise `δq` | Raise `δcapacity` | Raise `δe/gain` |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 7 | 0 | −0.5 | −0.2375 | +0.1952120 | −0.6952120 | +0.5 | +0.0500 | −0.0824354 | +0.5824354 |
| 10 | 3 | −0.5 | −0.2375 | +0.2380111 | −0.7380111 | +0.5 | +0.0500 | −0.0807631 | +0.5807631 |
| 14 | 7 | −0.5 | −0.2500 | +0.2575306 | −0.7575306 | +0.5 | +0.0500 | −0.0730268 | +0.5730268 |
| 17 | 10 | −0.5 | −0.2500 | +0.2872716 | −0.7872716 | +0.5 | +0.0500 | −0.0723816 | +0.5723816 |
| 21 | 14 | 0 | 0 | +0.1924092 | −0.1924092 | 0 | 0 | −0.0467901 | +0.0467901 |
| 24 | 17 | 0 | 0 | +0.1384321 | −0.1384321 | 0 | 0 | −0.0323016 | +0.0323016 |

The last two rows contain only the slow plant channel: week 4 is deloaded, so
`generateBlock` applies neither correction there.

## 4. Observer condition with trend

For response vector `v_i=δe_i/RPE_GAIN`, define

```text
S_max(λ) = (1 − λ^21) / (1 − λ)

d(g,λ) = [Σ λ^(20−i) × clip(g×v_i, −E_MAX, E_MAX)]
         / [E_MAX × S_max(λ)]

φ_base(g,λ) = 0                         when |d(g,λ)| < DELTA
              d(g,λ)                    otherwise

z(g) = g × (mean(v_recent) − mean(v_old)) / T_SCALE

F(g) = W_BASE × φ_base(g,λ) + W_TREND × tanh(z(g)).
```

Here `g=RPE_GAIN`. This is the two-channel one-block response condition on gain,
`TAU_FAT`, `TAU_FIT`, both plant gains, `λ`, both deadbands, and the real slot
schedule. `TAU_FAT` and `TAU_FIT` enter every `v_i` through `δcapacity`; `λ`
enters `d` and determines whether the base channel clears its deadband.

The observer normalization evaluates to

```text
λ^21 = 0.88^21 = 0.0682552584
S_max = (1 − 0.0682552584) / (1 − 0.88)
      = 0.9317447416 / 0.12
      = 7.7645395133.
```

### Cut at the baseline gain

At `g=3`, the six cut errors are

```text
[-2.0856359, -2.2140334, -2.2725918,
 -2.3618147, -0.5772275, -0.4152964].
```

The weighted base substitution is

```text
numerator
= 0.88^20×(-2.0856359) + 0.88^17×(-2.2140334)
  + 0.88^13×(-2.2725918) + 0.88^10×(-2.3618147)
  + 0.88^6×(-0.5772275) + 0.88^3×(-0.4152964)
= -2.0539254.

d_cut = -2.0539254 / (3 × 7.7645395)
      = -2.0539254 / 23.2936185
      = -0.0881755.
```

Because `|-0.0881755| < 0.15`, `φ_base=0`.

The trend substitution is

```text
e_old = (-2.0856359 − 2.2140334) / 2 = -2.1498346
e_recent = (-0.5772275 − 0.4152964) / 2 = -0.4962620
z_cut = -0.4962620 − (-2.1498346) = +1.6535727
tanh(z_cut) = 0.9293463

F_cut(3) = 0.7×0 + 0.3×0.9293463
         = +0.2788039
         → round4 = +0.2788.
```

### Raise at the baseline gain

At `g=3`, the six raise errors are

```text
[1.7473062, 1.7422893, 1.7190805,
 1.7171448, 0.1403703, 0.0969047].
```

The weighted numerator is `1.2695455`, so

```text
d_raise = 1.2695455 / 23.2936185 = +0.0545019.
```

Because `|+0.0545019| < 0.15`, `φ_base=0`.

```text
e_old = (1.7473062 + 1.7422893) / 2 = 1.7447978
e_recent = (0.1403703 + 0.0969047) / 2 = 0.1186375
z_raise = 0.1186375 − 1.7447978 = -1.6261603
tanh(z_raise) = -0.9255128

F_raise(3) = 0.7×0 + 0.3×(-0.9255128)
           = -0.2776538
           → round4 = -0.2777.
```

The independent arithmetic and shipped `buildPatternWindow → detectFlaws`
pipeline agree exactly after round4 at every evaluated point.

## 5. What the boundary actually is

At the first relay activation, both base responses remain inside the observer
deadband. The activation equation is therefore trend-only by branch selection,
not because `λ` or the base term is omitted:

```text
W_TREND × tanh(g × |z_per_gain| / T_SCALE) = DEADBAND

g_critical
= atanh(DEADBAND / W_TREND) × T_SCALE / |z_per_gain|.
```

With `DEADBAND=0.15`, `W_TREND=0.3`, and `T_SCALE=1`:

```text
atanh(0.15 / 0.3) = atanh(0.5) = 0.5493061443.

cut:
z_per_gain = 0.5511908851
g_critical = 0.5493061443 / 0.5511908851
           = 0.9965806024.

raise:
|z_per_gain| = 0.5420534312
g_critical = 0.5493061443 / 0.5420534312
           = 1.0133800706.
```

At both thresholds the shipped observer returns exactly `±0.1500` after round4.
The prior ≈1.2 RPE-only estimate is close in magnitude but wrong in mechanism:
the set channel and its carryover matter, and the response sign indicates
persistence rather than reversal.

Within the ratified gain envelope `[0.25,6]`, the canonical base response stays
inside its own deadband (`d_cut(6)=-0.1322754`,
`d_raise(6)=+0.0962266`). The trend channel therefore dominates throughout
that envelope. At `g=6`, the shipped outputs are `+0.2992` after a cut and
`-0.2991` after a raise.

For context only, if all six observed errors saturate at `E_MAX`, their
exponential weights sum to `1.8055470`:

```text
normalized observed weight = 1.8055470 / 7.7645395 = 0.2325376
cut limit = -0.7×0.2325376 + 0.3 = +0.1372237
raise limit = +0.7×0.2325376 - 0.3 = -0.1372237.
```

These endpoint signs remain persistence signs; they are not used as a proof
about every gain outside the ratified envelope.

## 6. Why the trend has the persistence sign

The correction acts in weeks 1–3, but the 21-day boundary window starts at week
2 and ends after week 4. Its old seven-day trend window contains the large,
directly corrected week-2 errors. Its recent seven-day window contains the
uncorrected deload and only the smaller residual capacity effect.

- After a cut, old errors are strongly negative and recent errors are less
  negative. `e_recent − e_old > 0`, so the trend channel reports deficit.
- After a raise, old errors are strongly positive and recent errors are less
  positive. `e_recent − e_old < 0`, so the trend channel reports headroom.

Thus the week-4 deload makes an improving cut look like a positive trend and a
decaying raise look like a negative trend. Around this operating point the
trend term reinforces the relay's prior direction.

## 7. One-step reversal condition

Starting at the positive relay boundary, a deficit cut reverses the next action
only if it moves the score from `+0.15` to at most `-0.15`:

```text
Δφ_cut ≤ -0.15 − (+0.15) = -0.30.
```

Starting at the negative boundary, a raise reverses only if

```text
Δφ_raise ≥ +0.15 − (-0.15) = +0.30.
```

The baseline-gain responses are `+0.2788` and `-0.2777`, respectively—the
opposite signs. This refutes the local one-step-reversal hypothesis for the
canonical template. It does not rule out multi-block limit cycles generated by
accumulated plant state or other templates.

## 8. C3 bracket and falsifiers

The boundary-bracketing gain grid is:

```text
[0.25, 0.50, 0.75, 0.90, 0.95, 1.00, 1.05, 1.10,
 1.25, 1.50, 2.00, 3.00, 4.50, 6.00].
```

The sweep treats the transition as an open question. Any of these results
refutes the predictive boundary rather than being relabelled “inconclusive”:

1. In the zero-noise canonical slice, repeated-direction correction or
   saturation shows no qualitative change across the `0.90–1.10` bracket.
2. The observed transition lies outside `[0.75,1.25]`.
3. The first post-correction direction reverses immediately instead of
   persisting around the baseline plant point.
4. Per-block φ tables show convergence while the local model predicts repeated
   same-direction actions, or saturation while the local model predicts
   deadband entry.

The analytic calculation itself is falsified if the same generated block and
paired plant response do not reproduce the six `δe/gain` values above, or if
the shipped projection/observer differs from the independent formula after
round4. The C2 executable already checks the latter and throws on disagreement.

The plant-family sweep also includes initial-state offsets, without moving
`BASE_CAPACITY_RPE`:

| State | Initial fitness | Initial fatigue | Initial capacity offset |
|---|---:|---:|---:|
| neutral | 0 | 0 | 0 |
| mid-deficit | 0 | 0.75 | −0.75 |
| mid-supercompensation | 0.75 | 0 | +0.75 |

Seeded determinism is checked at `SIGMA_RPE=0.5`, not only at zero noise.

## 9. Evidence

Command:

```powershell
npx.cmd tsc --strict --target es2020 --module commonjs --lib es2020,dom `
  --rootDir . --outDir tools/autopilot-sim/.build `
  tools/autopilot-sim/deriveBoundary.ts
node tools/autopilot-sim/.build/tools/autopilot-sim/deriveBoundary.js
```

Observed:

```text
C2_TYPECHECK_EXIT=0
cut activation gain=0.9965806024454587
raise activation gain=1.0133800705617177
gain=3: cut independent/shipped=0.2788/0.2788
gain=3: raise independent/shipped=-0.2777/-0.2777
gain=6: cut independent/shipped=0.2992/0.2992
gain=6: raise independent/shipped=-0.2991/-0.2991
C2_DERIVATION_EXIT=0
```

Source: `tools/autopilot-sim/deriveBoundary.ts`. It executes real
`generateBlock`, `buildPatternWindow`, and `detectFlaws`; the observer formula
used for comparison is implemented independently in the same executable.
