# R2 observer pin recomputation

Date: 2026-07-30
Status: **OPUS-VERIFIED — PIN RECOMPUTATION INDEPENDENTLY RE-DERIVED.**

R2 changes only the trend term. Base-EMA-only analytic pins are unchanged;
pins that depended on a cross-slice trend are recomputed explicitly.

## 1. Analytic pins

| Pin | Before R2 | After R2 |
|---|---:|---:|
| constant delta-RPE `+3` | `+0.7000` | `+0.7000` |
| constant delta-RPE `-3` | `-0.7000` | `-0.7000` |
| constant delta-RPE `+1` | `+0.2333` | `+0.2333` |
| attenuation | `+0.3500` | `+0.3500` |
| injury attenuation | `+0.4200` | `+0.4200` |
| headroom | `-0.7000` | `-0.7000` |
| strict deadband | `0` | `0` |
| strict classification boundary | `+0.1050` | `+0.1050` |
| newest six days at `+3` | `+0.7009` | `+0.4024` |
| oldest/reference six days at `+3` | `-0.2985` | `0` |

The newest-slice result retains only the recency-weighted base signal. The
reference-only pattern has no qualified within-phase movement, so it no longer
fabricates a negative trend.

## 2. Edge diagnostics

| Diagnostic | Before R2 | After R2 |
|---|---:|---:|
| non-finite attenuation | `+0.2985` | `0` |
| steep trend | `+0.6701` | `+0.3701` |
| negative attenuation | `0` | `0` |

An explicit R2 direction pin supplies two observations in each seven-day
window segment:

```text
within-phase rise: phi=+0.2892
within-phase fall: phi=-0.2892
```

## 3. R1a coverage-note closure

The phi-domain control-action sweep now passes macro block index `1`.
Consequently it observes all three intended values:

```text
dRpe_p ∈ {-0.5, 0, +0.5}
```

The fail-closed omitted/`undefined`/`NaN` pin remains separate and unchanged.
