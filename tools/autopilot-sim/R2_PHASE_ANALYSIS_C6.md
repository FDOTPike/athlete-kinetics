# R2 phase analysis — observer normalization

Date: 2026-07-30
Status: **OPUS-VERIFIED — WINDOW-RELATIVE PRECISION NOTE APPLIED.**

## 1. Deload-placement decision

The normal week-4 deload is universal across the shipped generator's macro
phases, objectives, and schema types:

```text
PHASE_BY_WEEK =
  accumulation, intensification, realization, deload
```

The one shipped non-recovery exception is peak auto-regulation when
`recentAcwr > 1.5`:

```text
deload, accumulation, intensification, realization
```

A halt is not another observer alignment: it converts all four weeks to the
recovery template and suppresses controller corrections.

At a normal block boundary, the fixed 21-day observer window therefore covers
weeks 2, 3, and deload. At a shifted peak boundary it covers accumulation,
intensification, and realization. The correction must support both layouts,
but it does not need macro-phase-specific branches.

## 2. Window-segment trend formula

Let `e_i` be valid daily delta-RPE evidence in the fixed window, and partition
the window into seven-day window-relative segments:

```text
q(i) = floor(i / 7)
V_q  = ordered valid observations in segment q
Q    = { q : |V_q| >= 2 }

delta_phase =
  0,                                      if Q is empty
  mean_q∈Q(last(V_q) - first(V_q)),       otherwise

t_p = tanh(delta_phase / T_SCALE)
phi = clamp(W_BASE * phi_base + W_TREND * t_p, -1, 1)
```

`phi_base`, recency weighting, attenuation, injury handling, and the
`MIN_OBSERVATIONS` confidence gate remain unchanged.

At scheduled production boundaries the segments align with prescription weeks,
so the formulation compares error movement within the same prescription phase
and never compares loading-week means with deload means or different loading
levels. At diagnostic offsets not divisible by seven, the partition remains
window-relative and does not guarantee phase identity. Offset `-3` is explicitly
tested and reproduces the aligned result.

A segment with one observation contributes no trend; the observations still
count toward the existing confidence gate. `last(V_q) - first(V_q)` deliberately
discards interior observations. That keeps the estimate hand-checkable, but
makes it endpoint-sensitive in noisy phases; the full noisy family is therefore
part of the required gate.

## 3. Rejected intermediate

An oldest-seven-days versus middle-seven-days reference removed the explicit
loading/deload comparison, but it still compared different loading levels.
The exploratory full-family result regressed to 55 downward ratchets and 112
downward saturations. It was rejected before C6.

The window-segment endpoint formulation has zero ratchets and only three
downward-saturation cases in the final family.

## 4. Real-template substitutions

All rows are deterministic eight-block real-generator runs:

| Alignment | R2 phi, blocks 1–8 | Actions | Result |
|---|---|---|---|
| normal week-4 deload, offset 0 | `-.0263,-.0322,-.0308,-.0295,-.0287,-.0282,-.0280,-.0279` | neutral × 8 | converged |
| normal week-4 deload, offset -3 | same | neutral × 8 | converged |
| normal week-4 deload, offset -7 | `+.0645,+.0230,+.0207,+.0223,+.0235,+.0242,+.0246,+.0248` | neutral × 8 | converged |
| peak, normal week-4 deload | `-.0296,-.0357,-.0343,-.0329,-.0320,-.0316,-.0313,-.0312` | neutral × 8 | converged |
| peak, shifted week-1 deload | `0,0,0,0,0,0,0,0` | neutral × 8 | converged |

The nominal gain-3, zero-noise case is also neutral for all eight blocks:

```text
phi=.0179,-.0104,-.0307,-.0296,-.0283,-.0298,-.0330,-.0307
applied RPE delta=0 × 8
RPE-cap binding=0 × 8
trajectory=converged_neutral
```

## 5. Low-frequency behavior

The real carry and rotation probes each produce three valid observations per
boundary. Each seven-day segment has only one observation, so the local trend
is zero. Both patterns remain `thin_data_neutral` with phi zero and neutral
action at all eight boundaries.
