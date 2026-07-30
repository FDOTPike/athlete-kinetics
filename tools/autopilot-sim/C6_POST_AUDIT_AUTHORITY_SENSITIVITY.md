# C6 post-audit — R1 authority sensitivity under R2

Date: 2026-07-30
Status: **HISTORICAL C6A EVIDENCE — SUPERSEDED BY C6B.**

## 1. Method

The shipped `MAX_MACROCYCLE_RPE_RAISE=1.0` source was not edited.
`runAuthoritySensitivity.mjs` creates a fresh OS-temp source tree for each
variant, replaces the one authority literal in that copy, strict-compiles the
real inference and closed-loop engines, runs the deterministic 2,385-case
family, removes the temp tree, and verifies the shipped source is byte
unchanged.

Reproduction:

```text
node tools/autopilot-sim/runAuthoritySensitivity.mjs
```

The tested schedules are:

```text
1.0       = .5,.5,0,0,0,0,0,0
1.5       = .5,.5,.5,0,0,0,0,0
2.0       = .5,.5,.5,.5,0,0,0,0
unbounded = .5,.5,.5,.5,.5,.5,.5,.5
```

“Unbounded” uses `Number.POSITIVE_INFINITY`. The existing one-positive-pattern
per-block selector still limits the eight-block horizon to at most +4.0.

## 2. Trajectory sensitivity

| Authority | Converged | Mixed | Authority-limited | Saturated down | Limit cycles | Saturated up |
|---|---:|---:|---:|---:|---:|---:|
| shipped `1.0` | 1,654 | 389 | 339 | 3 | 0 | 0 |
| candidate `1.5` | 1,654 | 389 | 339 | 3 | 0 | 0 |
| candidate `2.0` | 1,654 | 389 | 339 | 3 | 0 | 0 |
| unbounded | 1,654 | 562 | 165 | 3 | 1 | 0 |

No finite candidate changes a trajectory class. Unbounded does not restore
upward saturation, but it introduces one limit cycle and increases `mixed` by
173 cases.

The unbounded cycle is:

```text
id=corner_14|g0.25|s1.00|mid_supercompensation|squat
plant=TAU_FAT 21, TAU_FIT 60, K_FAT 1, K_FIT .05
phi(last 4)=+.2605,-.1705,+.2384,-.2725
action(last 4)=cut,raise,cut,raise
RPE-cap binding occurs in block 7
```

This is noisy (`SIGMA_RPE=1`) but is a genuine deterministic seeded
counterexample to removing the macro schedule entirely.

## 3. Authority-cost instrumentation

The old `rpeBudgetBlockedRaise` signal combined two separate constraints:

1. the macrocycle schedule was closed; or
2. the schedule was open, but a different pattern won the single positive RPE
   grant for that block.

The simulator now reports these separately without changing controller
behavior.

| Authority | Any authority refusal, cases/blocks | Macro schedule, cases/blocks | Per-block selection, cases/blocks | Accepted positive grants, cases/blocks |
|---|---:|---:|---:|---:|
| `1.0` | 824 / 1,554 | 798 / 1,440 | 114 / 114 | 1,030 / 1,030 |
| `1.5` | 778 / 1,452 | 709 / 1,194 | 232 / 258 | 1,310 / 2,100 |
| `2.0` | 744 / 1,362 | 631 / 991 | 316 / 371 | 1,391 / 3,071 |
| unbounded | 557 / 940 | 0 / 0 | 557 / 940 | 1,520 / 7,741 |

The unchanged `authority_limited_neutral=339` count at finite budgets is not
evidence that the extra grants do nothing. That classifier examines the final
three blocks; every tested finite schedule is closed there. The direct binding
instrumentation shows the actual cost:

- `1.5` reduces macro-schedule binding by 89 cases and 246 blocks;
- `2.0` reduces it by 167 cases and 449 blocks;
- accepted positive-grant blocks rise from 1,030 to 2,100 and 3,071
  respectively.

## 4. Residual population characterization

### Three `saturated_down` cases

All three are noisy, end `cut,cut,cut`, bind both `E_MAX` and the actual-RPE
clamp, and have zero upward saturation:

| Case | Gain/noise/start | Action composition | Nonlinear evidence |
|---|---|---|---|
| `corner_04` | `1.25 / 1.0 / mid_supercompensation` | one early raise, then cuts | `E_MAX`, actual-RPE clamp |
| `corner_13` | `.95 / 1.0 / mid_deficit` | cuts only | `E_MAX`, actual-RPE clamp |
| `corner_13` | `1.05 / .5 / mid_supercompensation` | cuts only | `E_MAX`, actual-RPE clamp |

These are conservative nonlinear responses, not an upward-stability defect.
Cuts remain deliberately unrationed.

### 389 `mixed` cases

- All 389 contain non-zero simulated noise: 297 at `1.0`, 82 at `.5`, eight at
  the overreach archetype's `.7`, and two at the adapting archetype's `.4`.
- 354 are cut-only; 35 contain both a raise and a cut.
- Every final three-block sequence contains only cuts and neutral actions.
- 364/389 bind the actual-RPE clamp, 215 bind `E_MAX`, and 252 bind set
  anti-windup.

The increase from 246 to 389 therefore represents intermittent, predominantly
downward noisy responses exposed after removing the fabricated trend—not
late-stage upward ratcheting.

## 5. Recommendation

**Reject unbounded authority.** It adds one deterministic limit cycle and 173
mixed cases.

Both finite candidates preserve every tested R2 trajectory classification and
keep upward saturation at zero. If Francis intends to relax the corrective
overlay, **2.0 is the largest tested finite safe candidate** and removes more
macro-schedule refusal than 1.5.

That is still a product-policy change: it extends possible upward autopilot
correction from macro blocks 1–2 to blocks 1–4. No production constant has been
changed. Francis must choose:

1. ratify `2.0`, then change the constant/pins and rerun the final family; or
2. retain `1.0` as intentional product behavior and explicitly close the
   standing deviation obligation as superseded by policy.

R2's C6 GO stands independently. C6B subsequently tested `3.0`, rejected it
for applied-`mixed` drift, and implemented the authorized `2.5` fallback. See
`CHECKPOINT_C6B.md`.
