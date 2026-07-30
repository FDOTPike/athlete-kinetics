# C6A audit — authority sensitivity decision (Claude/Opus)

Recommendation: **retain `MAX_MACROCYCLE_RPE_RAISE = 1.0`.** Close the standing
deviation as superseded by the C5 policy ratification, and record the unbounded
result as evidence that R1 remains load-bearing.

This disagrees with Sol's recommendation of 2.0. Reasons below; Sol's reading is
defensible, not careless.

---

## 1. Read the headline result carefully — the metric cannot see the ceiling

`1.0`, `1.5` and `2.0` producing **identical** trajectory classifications is not
evidence that the ceiling is unimportant. It is a property of the label.

`authority_limited_neutral` and its siblings inspect the **last three blocks**
(6, 7, 8). The grant schedule allocates `RPE_STEP = 0.5` per block from block 1,
so `MAX = 1.0` grants in blocks 1–2 and `MAX = 2.0` grants in blocks 1–4.
**Neither reaches block 6.** The classification is therefore invariant to any
finite ceiling below 3.0 by construction — it cannot distinguish them.

That the 339 `authority_limited_neutral` cases are identical at 2.0 confirms this
rather than exonerating the bound. The only metric that does move is
macro-schedule binding, `798 → 631`.

So the real question is narrow: **is 167 fewer schedule bindings worth doubling
cumulative upward authority?**

## 2. The most valuable finding in C6A is the unbounded case

Removing the bound entirely introduces **one deterministic limit cycle** and
pushes `mixed` from 389 to 562.

**This means R2 did not make R1 redundant.** The phase-local observer fix alone
is insufficient; the authority bound is doing real stabilising work on top of it.
Both remediations are load-bearing, and that was not established before C6A.

It also sets the direction of risk. Unbounded is the failure; 2.0 is a step
toward it, purchased with no measured improvement in any outcome classification.

## 3. Why retain 1.0

1. **No demonstrated benefit.** Identical trajectories. `798 → 631` measures how
   often the bound is reached, not any athlete-facing improvement. Nothing shows
   athletes are worse off at 1.0.
2. **The policy question was already ratified.** C5 accepted corrective-overlay
   semantics: the autopilot corrects, `progressionEngine` and the
   `SCHEMES`/`PHASE_MODS` tables progress. `1.0` expresses that; `2.0` dilutes it
   without evidence.
3. **The failure mode this whole exercise found was upward.** 1,505 upward
   saturations, healthy athletes ratcheted to `base_rpe_cap` with no gate. Upward
   is the direction where being wrong is expensive, and nothing is pressing for
   relaxation.
4. **Asymmetric burden of proof on an unvalidated plant.** The Banister family is
   fiat — cited for structure, never validated against athletes. Tightening a
   safety bound on simulation evidence is conservative. *Loosening* one on the
   same evidence is not the symmetric move. This is the inference the original
   work order warned against, and it applies with full force here.

## 4. The counter-argument, stated fairly

At 1.0, 339 cases have a now-trustworthy observer requesting a raise and being
refused, and 798 hit the schedule bind. An athlete with genuine capacity receives
no autopilot assistance after week 8. Sol's position — restore controller
function where the relaxation is measurably safe — is coherent.

What decides it against: "the observer is now trustworthy" rests on a corrected
formula tested against an invented plant. That is sufficient to justify
*restricting* the controller. It is not sufficient to justify *expanding* it.

## 5. Also worth noting

The three `saturated_down` cases and the `mixed` population were characterised as
noisy predominantly-downward responses rather than upward ratcheting. That closes
my §5c note from the C6 audit.

## 6. If Francis chooses 2.0 anyway

It is a defensible choice, not a mistake. In that case require:

- the rationale comment on `MAX_MACROCYCLE_RPE_RAISE` updated to state that 2.0
  was selected for schedule-binding relief with no trajectory improvement, so a
  later reader does not infer evidence that does not exist;
- the counterexample gate re-run and its 6/6 conversions re-confirmed at 2.0;
- a pin asserting the cumulative bound is 2.0 and the schedule is
  `0.5,0.5,0.5,0.5,0,0,0,0`;
- the deviation closed with the unbounded NO-GO recorded either way — that
  finding stands independent of which finite value is chosen.
