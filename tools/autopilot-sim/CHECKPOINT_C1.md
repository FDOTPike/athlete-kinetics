# Checkpoint C1 — plant constants

Status: **RATIFIED 2026-07-30.** Francis directed work to begin C2 after
`docs/AUDIT_C1_2026-07-30.md`. No parameter sweep ran before ratification.

## Explicit plant table

| Dimension | Baseline | Primary envelope | Unit | Status |
|---|---:|---:|---|---|
| `TAU_FAT` | 14 | 7–21 | days | Literature-informed envelope, deliberately widened beyond the 7–15 day reference range |
| `TAU_FIT` | 45 | 30–60 | days | Literature-informed envelope, deliberately widened beyond the 42–50 day reference range |
| `K_FAT` | 0.50 | 0.30–1.00 | capacity / normalized dose | Fiat plant gain; swept |
| `K_FIT` | 0.12 | 0.05–0.20 | capacity / normalized dose | Fiat plant gain; swept |
| `RPE_GAIN` | 3.00 | 0.25–6.00 | delta-RPE / capacity | Fiat observer coupling; swept; envelope brackets the work order's ~1.2 first-order estimate |
| `SIGMA_RPE` | 0.50 | 0–1.00 | RPE | Fiat noise; swept; zero is retained for deterministic isolation |
| `BASE_CAPACITY_RPE` | 7.50 | fixed | RPE-scale capacity | Fiat equilibrium reference, not swept |

The three retained archetype points are:

| Archetype | `TAU_FAT` | `TAU_FIT` | `K_FAT` | `K_FIT` | `RPE_GAIN` | `SIGMA_RPE` | `BASE_CAPACITY_RPE` |
|---|---:|---:|---:|---:|---:|---:|---:|
| stable | 14 | 45 | 0.50 | 0.12 | 3.0 | 0.5 | 7.5 |
| overreach | 10 | 50 | 0.80 | 0.10 | 4.5 | 0.7 | 7.5 |
| adapting | 18 | 40 | 0.40 | 0.18 | 2.5 | 0.4 | 7.5 |

The C1 audit keeps `BASE_CAPACITY_RPE` fixed and adds three initial accumulator
states to the later robustness sweep: neutral `(fitness=0, fatigue=0)`,
mid-deficit `(0, 0.75)`, and mid-supercompensation `(0.75, 0)`.

## Dose and time semantics

The simulation advances the plant once per calendar day, including zero-dose
recovery days. For every real `generateBlock` slot:

```text
slotDose = (sets / 4) × (target_rpe / 10)
dose(pattern, date) = sum(slotDose for that pattern and date)
```

This scaling retains Neo's ordinary dose scale (`4 sets @ RPE 7.5 → 0.75`) and
closes both shipped prescription channels that are actually consumed by
`generateBlock`: `dSet_p` and `dRpe_p`.

## Rejected inherited value

Neo's `BASE_CAPACITY=5.0` does not describe a neutral starting athlete. At the
stable point, with target RPE 7.5 and zero noise:

```text
rpe_actual
= clamp(target_rpe + RPE_GAIN × (prescribed_intensity − capacity), 1, 10)
= clamp(7.5 + 3.0 × (7.5 − 5.0), 1, 10)
= clamp(15.0, 1, 10)
= 10.0
```

The inherited harness then stores the unclamped `rpeDelta=7.5` rather than the
observable `actual-target=2.5`, so it begins with a saturated observer input by
construction. `BASE_CAPACITY_RPE=7.5` instead pins the zero-state/no-noise
starting observation at `actual=target=7.5`.

## Literature boundary

The cited work supports a systems model with antagonistic first-order fitness
and fatigue responses to training dose. It does not identify the RPE mapping,
the slot-dose normalization, or universal gains for this strength-training
controller. Busso (2003) explicitly fits model parameters to experimental
training data expressed in training units; the constants above remain declared
simulation choices and swept uncertainty dimensions.

References:

- Calvert, Banister, Savage & Bach (1976), “A Systems Model of the Effects of
  Training on Physical Performance,” DOI
  [10.1109/TSMC.1976.5409179](https://doi.org/10.1109/TSMC.1976.5409179).
- Busso (2003), “Variable Dose-Response Relationship between Exercise Training
  and Performance,” DOI
  [10.1249/01.MSS.0000074465.13621.37](https://doi.org/10.1249/01.MSS.0000074465.13621.37).

## Evidence already run

`npm.cmd run verify:all` exits 0 on Node `v24.11.1`: all 19 `verify:*` targets
plus `typecheck` resolve. The existing component suite reports 7/7 suites and
66/66 tests green; React `act(...)` warnings remain non-fatal pre-existing
output.

The forced-correction coupling A/B test against Neo's harness gives:

```text
forced dRpe                 -0.5
dose                         0.75 -> 0.70
first-session ΔRPE change   -1.5569999999999986
plant-equation prediction   -1.557
next-window mean change     -1.7114756309258485
next-boundary phi            0.6451 -> 0.6420
independent phi check        exact to round4
```

All four links hold. The prior null is not an open-loop artefact, so the plant
and loop structure are salvaged. The hand-built prescription/projection
shortcuts are not: the production simulation still imports and executes
`detectFlaws`, `deriveControlAction`, `generateBlock`, and `buildPatternWindow`.

## Self-report

1. No controller constants changed.
2. No shipped source, app, migration, package manifest, or CI file changed.
3. The C1 range adds the missing low-gain region below Neo's 2.0 sweep floor.
4. Francis ratified the baseline-capacity judgment by directing C2 to begin.
5. No pre-ratification sweep ran and no stability conclusion is claimed.
