# Work order C6B — test `MAX_MACROCYCLE_RPE_RAISE = 3.0`

**Assignee:** Sol. **Effort: high.**
Decision by Francis, 2026-07-30, on `AUDIT_C6A_authority_2026-07-30.md`.
Production stays at `1.0` until C6B ratifies. Nothing staged or committed.

---

## 1. The decision and its rationale

Neither `1.0` (my recommendation) nor `2.0` (yours). **Test `3.0`**, on a
coaching rationale rather than a sweep result:

> Six blocks — roughly 24 weeks — is the period over which a coach would still be
> learning an athlete. The autopilot should retain upward authority through that
> window and stop afterwards.

At `RPE_STEP = 0.5`, `3.0` yields six grant slots: blocks 1–6, then none.
The schedule maps exactly onto the stated reasoning.

Record this rationale verbatim on the constant. It is the first genuinely
domain-grounded justification any value in `CONTROL_AUTHORITY` has carried —
every other constant in that table traces to a DeepSeek chat session picking
numbers. That provenance is worth more than the number.

## 2. Why C6A's evidence does NOT cover 3.0

**This is a new experiment, not an interpolation. Do not treat the
"1.0/1.5/2.0 identical" result as reassurance.**

Trajectory labels inspect the **last three blocks** (6, 7, 8). The grant schedule
fills forward from block 1. So:

| Ceiling | Grant slots | Grants reach | Overlaps label window? |
|---:|---:|---|---|
| 1.0 | 2 | blocks 1–2 | no |
| 1.5 | 3 | blocks 1–3 | no |
| 2.0 | 4 | blocks 1–4 | no |
| **3.0** | **6** | **blocks 1–6** | **yes — block 6** |

Every ceiling C6A tested was invariant to the label **by construction**. `3.0` is
the first value where the grant window and the classification window intersect,
so it is the first value at which any trajectory count can move — including the
339 `authority_limited_neutral`, which have been frozen for structural reasons
rather than physical ones.

The unbounded case produced one deterministic limit cycle and pushed `mixed`
from 389 to 562. `3.0` is materially closer to unbounded than anything yet
tested. Expect real movement, and treat a null result as suspicious rather than
comforting.

## 3. Run

Full 2,385-case family at `3.0`, double-run deep-equal, plus `2.5` to bracket the
label-overlap threshold and a re-confirmed unbounded control. Report:

1. Full trajectory table versus the `1.0` baseline — every count, both sides.
2. **Any limit cycle.** One deterministic cycle is a NO-GO for `3.0`.
3. **Any upward saturation.** Non-zero is a NO-GO.
4. `authority_limited_neutral` and macro-schedule binding — the two numbers that
   should move if the relaxation does anything.
5. Whether `mixed` rises toward the unbounded value of 562. That is the early
   warning signal.
6. The nominal gain-3 zero-noise probe, and the paired healthy/niggle override.
   The niggle case must still block every raise.

Counterexample gate re-run at `3.0`: **6/6 historical stationary conversions plus
nominal saturation must still convert.** Any regression is a NO-GO.

## 4. If clean

- Update `MAX_MACROCYCLE_RPE_RAISE` to `3.0` with the §1 rationale.
- Pins: cumulative bound `= 3.0`; schedule `0.5,0.5,0.5,0.5,0.5,0.5,0,0`;
  cuts still unrationed at block 8; fail-closed on absent/non-finite index
  unchanged.
- Close `DEVIATION_LOG.md:19` item 3, recording that the value was set on
  coaching grounds after a sensitivity study, **and that the unbounded NO-GO
  stands independently** — R2 did not make R1 redundant, which is C6A's most
  durable finding.
- `verify:all` green, then hand back for C6B ratification.

## 5. If not clean

Report and stop. Do not tune toward a passing value — that would be fitting a
safety bound to an invented plant, which is the inference this whole work order
has refused from the start. If `3.0` fails, the options are the next lower value
that passes, or `1.0` with the coaching rationale recorded as untestable on
current evidence.

## 6. Standing caveat, unchanged

The Banister family is fiat — cited for structure, never validated against
athletes. Simulation evidence justifies *restricting* the controller more readily
than *expanding* it. `3.0` is an expansion, so the bar for "clean" is
correspondingly higher: zero cycles, zero upward saturation, no counterexample
regression, and `mixed` not drifting toward the unbounded figure.
