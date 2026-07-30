# C6B authority decision — test 3.0, select 2.5 fallback

Date: 2026-07-30
Status: **RATIFIED 2026-07-31 — 3.0 NO-GO; 2.5 SELECTED.**

## 1. Decision

The preferred `MAX_MACROCYCLE_RPE_RAISE=3.0` candidate was rejected under the
work order's predeclared `mixed` early-warning rule. The authorized next-lower
step, `2.5`, passed and is implemented.

Production schedule:

```text
MAX_MACROCYCLE_RPE_RAISE = 2.5
RPE_STEP = 0.5
grant schedule = 0.5,0.5,0.5,0.5,0.5,0,0,0
```

This retains positive corrective authority for five macro blocks, roughly
20 weeks. Planned progression remains owned by `progressionEngine` and
`SCHEMES`/`PHASE_MODS`; cuts remain unrationed.

## 2. Method

`runAuthorityC6B.mjs` installed each candidate into a fresh OS-temp copy of the
real inference and simulator sources. Each copy was strict-compiled, ran the
complete deterministic 2,385-case family twice with deep equality, and ran the
historical counterexample gate. The production source was checked byte-unchanged
after every isolated candidate.

Tested:

```text
1.0       = 0.5,0.5,0,0,0,0,0,0
2.5       = 0.5,0.5,0.5,0.5,0.5,0,0,0
3.0       = 0.5,0.5,0.5,0.5,0.5,0.5,0,0
unbounded = 0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5
```

## 3. Historical decision-boundary classifications

These preserve the existing C3–C6 reporting convention: the last-three window
classifies `actionForNext` decisions made after simulation blocks 6–8.

| Authority | Converged | Mixed | Authority-limited | Saturated down | Limit cycle | Saturated up | Ratchet up/down |
|---|---:|---:|---:|---:|---:|---:|---:|
| `1.0` | 1,654 | 389 | 339 | 3 | 0 | 0 | 0 / 0 |
| `2.5` | 1,654 | 389 | 339 | 3 | 0 | 0 | 0 / 0 |
| `3.0` | 1,654 | 389 | 339 | 3 | 0 | 0 | 0 / 0 |
| unbounded | 1,654 | 562 | 165 | 3 | 1 | 0 | 0 / 0 |

The per-case assignment fingerprint is identical at `1.0`, `2.5`, and `3.0`
(`3d3504f4`), not merely the aggregate counts.

## 4. C6B timing coverage and applied-block classifications

C6B assumed that a block-6 grant overlaps a classifier window covering blocks
6–8. The historical label instead reads `actionForNext`: the decision applied
in macro block 6 is made after simulation block 5 and is one record earlier.
Consequently, the unchanged historical counts at `3.0` were structurally blind
to the sixth grant slot.

A reporting-only `appliedTrajectory` view was added. It classifies
`actionApplied` during actual blocks 6–8 and aligns the authority window with
the work order's stated intent. Production controller behavior is unchanged.

| Authority | Converged | Mixed | Authority-limited | Saturated down | Limit cycle | Saturated up |
|---|---:|---:|---:|---:|---:|---:|
| `1.0` | 1,639 | 401 | 344 | 1 | 0 | 0 |
| `2.5` | 1,639 | 401 | 344 | 1 | 0 | 0 |
| `3.0` | 1,639 | 463 | 282 | 1 | 0 | 0 |
| unbounded | 1,639 | 569 | 176 | 1 | 0 | 0 |

`2.5` exactly preserves the baseline applied assignment fingerprint
(`4b6b5379`). At `3.0`, `mixed` increases by 62 while authority-limited neutral
falls by 62; the fingerprint changes to `36bcbe9d`. This covers about 37% of the
baseline-to-unbounded mixed increase (`401 → 569`) in one half-step.

That is the early-warning drift C6B prohibited. Zero cycles and zero upward
saturation at `3.0` do not override that declared failure criterion.

## 5. Other required gates

| Gate | `2.5` result | `3.0` result |
|---|---|---|
| Primary double-run deep-equal | PASS | PASS |
| Macro-schedule binding, cases/blocks | 561 / 790 | 466 / 591 |
| Nominal gain-3 zero-noise probe | converged, all neutral | converged, all neutral |
| Nominal RPE-cap bindings | 0 | 0 |
| Knee-niggle raise blocks | 0 | 0 |
| Six historical stationary conversions | 6/6 | 6/6 |
| Nominal saturation conversion | PASS | PASS |
| Full counterexample gate | PASS | PASS |
| Historical limit cycles/upward saturation | 0 / 0 | 0 / 0 |
| Applied `mixed` drift | none | **+62 — NO-GO** |

The unbounded control re-confirmed one deterministic decision-boundary limit
cycle, historical `mixed=562`, applied `mixed=569`, and a red counterexample
gate. R1 remains load-bearing after R2.

## 6. Implementation

- Production authority is `2.5`.
- Unit pins require the exact five-block grant schedule and cumulative `2.5`.
- Block-generation pins require generated and applied cumulative raises
  `<=2.5`.
- Block-8 cuts remain unrationed.
- Missing, `undefined`, `NaN`, or otherwise non-finite macro position still
  fails closed.
- `DEVIATION_LOG.md` item 3 is closed with the rejected `3.0` result and the
  independent unbounded NO-GO.

## 7. Verification

```text
node --check tools/autopilot-sim/runAuthorityC6B.mjs = 0
C6B 1.0/2.5/3.0/unbounded strict sweeps = 0
npm.cmd run typecheck = 0
npm.cmd run verify:autopilot = 0
npm.cmd run verify:autopilot-counterexamples = 0
npm.cmd run verify:blocks = 0
npm.cmd run verify:all = 0
component suites = 7/7
component tests = 66/66
```

The component suite emitted only the existing non-fatal React `act(...)`
warnings.

## 8. Audit follow-up

`docs/AUDIT_C6B_2026-07-30.md` ratified this decision. Its only follow-up,
replaying the pre-R1 C3 baseline through the corrected applied-block
classifier, is complete in
`tools/autopilot-sim/C3_CORRECTED_CLASSIFIER_FOLLOWUP.md`. The corrected C3
headlines are 7 limit cycles and 1,687 saturated cases (1,445 upward, 242
downward); the original counterexample finding remains intact.
