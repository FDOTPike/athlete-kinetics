# C2 findings for Opus review

Date: 2026-07-30
Status: **C2 RATIFIED BY FRANCIS. C3 NOT STARTED.**

## Review request

Review the analytic boundary, the sign interpretation, and the binding C3
coverage below. The work order prohibits controller-constant changes and places
the closed-loop sweep after this checkpoint.

## Finding

The local response predicts a **ratchet (relay persistence/saturation)** for the
evaluated alignment, not a one-step limit cycle.

| Applied correction | Trend-only activation gain | Response at gain 3 | One-step reversal requires |
|---|---:|---:|---:|
| deficit cut: `dRpe=-0.5`, `dSet=-1` | `0.9965806` | `phi=+0.2788` | `delta_phi <= -0.3000` |
| headroom raise: `dRpe=+0.5`, one `dSet=+1` | `1.0133801` | `phi=-0.2777` | `delta_phi >= +0.3000` |

The observed signs reinforce the preceding action. A cut still reads as a
deficit and requests another cut; a raise still reads as headroom and requests
another raise.

This is a local, alignment-specific prediction. It is not a global stability
claim.

## Boundary derivation

The shipped observer is

```text
phi = W_BASE * phi_base
    + W_TREND * tanh((e_recent - e_old) / T_SCALE)
```

The canonical response remains inside the base-channel deadband throughout the
ratified plant-gain envelope `[0.25, 6]`. Activation is therefore trend-only.
The control boundary is `|phi|=0.15`, so:

```text
atanh(0.15 / 0.3) = atanh(0.5) = 0.5493061443

cut gain   = 0.5493061443 / 0.5511908851 = 0.9965806024
raise gain = 0.5493061443 / 0.5420534312 = 1.0133800706
```

At gain 3:

```text
cut:   recent - old = +1.6535726554; phi = +0.2788038750
raise: recent - old = -1.6261602936; phi = -0.2776538462
```

## Mechanism

The real LINEAR block applies corrections in weeks 1-3 and leaves week 4 as an
uncorrected deload. The 21-day observer window spans block days 7-27:

- its old seven-day slice contains strongly corrected week-2 errors;
- its recent seven-day slice contains the uncorrected week-4 deload;
- an improving cut consequently creates a positive trend;
- a decaying raise consequently creates a negative trend.

The trend channel therefore reinforces the prior relay direction for this
window/deload alignment.

## Evidence independence

The executable uses the shipped:

- `generateBlock`;
- `buildPatternWindow`;
- `detectFlaws`.

It also computes the Banister state convolution and observer arithmetic
independently. The independent and shipped observer values agree after round4
at gain `0.25`, both analytic critical gains (`0.9965806` and `1.0133801`),
gain `3`, and gain `6`; the executable throws on any disagreement.

The response includes both control channels:

- fast `dRpe` authority at every corrected non-deload slot;
- slower `dSet` dose authority, including the shipped positive-set rationing.

## Binding C3 coverage from the C2 audit

1. **Phase alignment:** vary deload placement and block-boundary/window offset.
2. **Observation density:** include at least one low-frequency pattern close to
   `MIN_OBSERVATIONS=5`.
3. **Nonlinear regime:** exercise RPE clamping, `E_MAX` saturation, and the
   monotone-conservative safety override.
4. **Safety asymmetry:** test the healthy-athlete upward RPE ratchet separately
   from the faster downward set ratchet.

The boundary-bracketing plant-gain grid is:

```text
[0.25, 0.50, 0.75, 0.90, 0.95, 1.00, 1.05, 1.10,
 1.25, 1.50, 2.00, 3.00, 4.50, 6.00]
```

The initial-state sweep covers neutral, mid-deficit, and
mid-supercompensation offsets. Seeded determinism includes
`SIGMA_RPE=0.5`.

## Falsifiers carried into C3

The local boundary is refuted if:

1. no qualitative transition occurs across the `0.90-1.10` bracket;
2. the transition falls outside the wider `0.75-1.25` bracket;
3. the first closed-loop response reverses immediately instead of persisting;
4. per-block trajectories converge while the local model predicts persistent
   same-direction actions or saturation;
5. phase-alignment variation flips the sign without the model accounting for
   that alignment.

## Verification record

```text
C2 strict typecheck: exit 0
C2 executable derivation: exit 0
npm.cmd run verify:blocks: ALL CHECKS PASSED
npm.cmd run verify:autopilot: ALL CHECKS PASSED
```

No shipped source, controller constant, app, migration, package, or CI file
changed during C2.

## Questions for Opus

1. Does the trend-only activation derivation support the approximately `1.0`
   boundary?
2. Does the persistence-sign interpretation follow from the real observer
   timing?
3. Do the five falsifiers and four audit conditions adequately constrain C3?
4. Is any analytic objection unresolved before the closed-loop sweep?

Primary evidence:

- `tools/autopilot-sim/DERIVATION_C2.md`
- `tools/autopilot-sim/deriveBoundary.ts`
- `tools/autopilot-sim/CHECKPOINT_C2.md`
- `docs/AUDIT_C2_2026-07-30.md`
