# System-safety brief — progression measurement as a prescription input

**Status:** draft, plan only. Authorized by owner decision 4 of
[`PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md`](decisions/PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md),
ratified 2026-08-27 as option (b), **plan only and deferred until further notice**.

**This document ratifies nothing.** It contains no threshold, coefficient, smoother, detector, or
control design, and authorizes no implementation. It exists to establish whether option (b) is worth
executing at all, and what executing it would honestly cost. Every factual claim about the app is
cited to a file and line so it can be checked rather than believed.

---

## 1. The question

The app already prescribes. The question is not *should measurement inform prescription* — it
already does — but whether a **measurement of progression** may join the inputs that do.

"Progression measurement" here means any signal answering *is the athlete getting stronger*:
an e1RM series, a hard-set trend, a volume-adjusted performance index. It does **not** mean
readiness, completion, or tolerance, which are already ratified inputs and are out of scope.

---

## 2. What the control loop already is

This section corrects two errors in the analysis that preceded this brief. Both made option (b) look
harder than it is.

### 2.1 The engine can already raise dose

The correction vocabulary includes an increase — `LOAD_MODIFIER_LITERALS` at
`packages/inference/src/outputSchema.ts:16` runs `0.80 … 1.05` — and two live paths emit it:

- `packages/inference/src/kinematicAutopilot.ts:425` emits `rRpe = 0.5; rSet = 1; rLoad = 1.05`
  when the flaw score is strongly negative, i.e. when the observer sees headroom.
- `packages/inference/src/policyReference.ts:39` sets `load = 1.05` at readiness ≥ 85 with a
  non-negative HRV z-score.

So a progression signal asking for *more* work would not be architecturally novel. Readiness already
does exactly that. **What is novel is the input class, not the direction of the correction.**

### 2.2 There is already a mature guard layer

Four mechanisms already constrain what any input may do:

| Mechanism | Location | Effect |
|---|---|---|
| Monotone-conservative override | `kinematicAutopilot.ts:437-442` | Under a caution class, a restrictive guardrail, **or** an injured loaded joint, every channel is clamped so it may only pull down |
| Conservative arbitration | `completionAction.ts:243-246` | Independent actions combine by `Math.min` on all four channels — the most conservative wins |
| Anti-windup volume budget | `kinematicAutopilot.ts:452-455` | Total positive set additions across patterns are capped |
| Halt supremacy | `blockGenerator.ts:506-511` | A recorded halt snaps the whole block to a recovery template |

The override's own comment records a real defect already found and closed: a severe niggle on fewer
than five logged days could collapse to a `neutral` class and "read as headroom and raise load into
the injury." The injury trigger was made independent of the class for exactly that reason.

**Implication for option (b).** This is not a loop that would need building. It is a loop with a
working guard layer, and the honest framing of 4(b) is *adding one input to it*. That is a
substantially smaller and better-understood job than "design a control system," and it means the
existing guards are the natural place to bound a progression signal's authority.

---

## 3. Signal missingness

Two coverage gaps, both structural rather than incidental.

**RPE is optional.** `packages/core-db/src/schema/001_mechanical_input.sql:80` declares
`rpe REAL CHECK (rpe IS NULL OR rpe BETWEEN 0 AND 10)`. The rollup carries `reps_with_rpe` at
line 103 precisely because RPE is frequently absent. `e1rm.ts:75` returns `null` without it.

**Bodyweight movements yield nothing.** `e1rm.ts:77` returns `null` when `loadKg <= 0`, and
bodyweight sets carry no load — they contribute zero to `tonnage_kg` in the same migration. A
push-up, a pull-up, a pike push-up and a handstand push-up all produce **no e1RM at all**.

The second gap is the more serious one, and it is not a detail:

> The complaint that opened this entire line of work was that the app tells an athlete "same
> push-ups, higher RPE." Push-ups are exactly the case where e1RM is undefined. **An e1RM-driven
> progression controller would be blind precisely where the originating problem lives.**

Any option (b) execution must state, before anything else, what fraction of an athlete's sets
actually yield a value, and what the controller does for the athletes and movements that yield none.
A controller that silently governs only the barbell portion of a mixed programme is a controller
whose coverage the athlete cannot see.

---

## 4. Bias

The relevant finding is that athletes underpredict reps in reserve by roughly one rep
[PMID 34542869, tier A in the evidence baseline]. Underpredicting RIR means **reporting a higher RPE
than is true**.

Trace that through the app's own formula at `blockGenerator.ts:428-430`:

```
targetPct(reps, rpe) = 1 / (1 + (reps + max(0, 10 - rpe)) / 30)
e1RM = loadKg / targetPct(reps, rpe)
```

A higher reported RPE shrinks `max(0, 10 - rpe)`, which shrinks `totalReps`, which **raises**
`targetPct`, which **lowers** the derived e1RM. So the app's e1RM is systematically biased downward
by the documented direction of self-report error.

**The nuance that matters more than the bias itself.** If the bias is roughly *constant*, it shifts
the level and largely cancels out of a trend — a controller reading Δe1RM would mostly survive it.
The danger is a bias that **varies with fatigue**: RPE inflation under accumulated fatigue would
manufacture a falling e1RM trend that is indistinguishable from genuine regression, and a controller
reading that trend would deload an athlete who is not actually regressing, reduce their training,
and see the signal fail to recover — a self-confirming ratchet.

Establishing which of those two you have is measurement work under decision 3, not literature work.
No published result can answer it for this app's optional, unsupervised RPE input.

**One consequence for a ruling already made.** The same study found no improvement in self-report
accuracy with training status (β ≈ −0.006). The advanced-athlete disclosure rider attached to
decision 1 therefore buys **no measurement accuracy** — it changes who sees the number, not how
good it is. That was recorded when the rider was ratified and is repeated here because it bears
directly on any controller built for advanced athletes specifically.

---

## 5. Failure modes to enumerate before any design

Beyond the fatigue-correlated bias ratchet in §4, an execution of option (b) must state its
behaviour under each of these. None is hypothetical; each is reachable in normal use.

1. **Sparse and irregular sampling.** RPE logged on some sets and not others yields an unevenly
   spaced series. Trend estimators on irregular samples can produce apparent movement from sampling
   pattern alone.
2. **Movement substitution.** The engine substitutes movements around injured joints
   (`substitution.ts` region matching). A substituted movement's e1RM is a different measurand; a
   naive series would read the substitution as a step change in strength.
3. **Equipment and setup change.** A different bar, a different machine, a change in range of
   motion. Same movement name, different measurand.
4. **Deliberate deload.** A scheduled deload week lowers load by design. A controller must not read
   its own prescription as evidence of regression, or the loop closes on itself.
5. **Bodyweight change.** For the bodyweight movements that yield no e1RM at all, and for the
   loaded ones where the athlete's own mass is part of the system.
6. **Detraining versus noise.** A genuine layoff and a measurement artefact look alike over a short
   window; the app has no return-to-training dose modifier by policy.
7. **Gaming.** Once a number visibly moves the plan, it becomes a target. This is a behavioural
   risk the evidence baseline explicitly says is unevidenced in either direction — backlog item 4
   in the open-decisions docket.

---

## 6. Authority limits — where a progression signal would sit

Given §2.2, the design space is narrower and safer than it first appears. Three bounding options,
in increasing order of authority. They are described so a future decision can choose between them;
**none is recommended or ratified here.**

**(i) Reduction-only.** The progression signal may pull down and never raise. It slots under the
existing monotone-conservative override with no change to the guard layer, and inherits `min()`
arbitration for free. The failure mode of a false negative is an unnecessary deload — recoverable,
visible, and the same class of error the app already tolerates from readiness.

**(ii) Symmetric, guard-subordinate.** The signal may raise as well as lower, but is clamped by the
existing override triggers exactly as the autopilot is, and its raises are subject to the same
anti-windup budget. This is the authority readiness already holds.

**(iii) Independent.** The signal carries authority the guards do not bound. **This should be
treated as out of scope.** The override's own comment documents that the last hole of this shape —
a signal reading as headroom while a niggle went unseen — raised load into an injury.

Whichever is chosen, two limits appear non-negotiable: a progression signal must never override
halt supremacy, and it must never be the sole justification for a raise while an injury trigger is
active.

---

## 7. Prospective validation

A controller changes the data it would be judged on, so a backtest cannot settle it — replaying
history evaluates a policy against decisions the policy did not make.

An execution of option (b) would need, at minimum: a predeclared analysis fixed before data
collection; a comparison condition that is not simply "the current engine" evaluated on its own
outputs; explicit handling of the missingness in §3 rather than complete-case deletion; and a
stopping rule. The evidence baseline's §8 backlog item 5 already names this as a prerequisite.

This is a closed-beta data exercise. It is neither a literature task nor a codebase task.

---

## 8. Scope check — would option (b) solve the originating problem?

Worth answering before spending anything, because the answer looks like no.

The originating complaint was that a push-up block advances effort without advancing anything else.
`SCHEMA_WEEKS.LINEAR` at `blockGenerator.ts:384-387` holds `repsScale: 1` across all three weeks and
advances only `rpeIdx` 0 → 1 → 2. The neighbouring schemes show this is a property of `LINEAR`
specifically, not of the engine: `WAVE` at `:391-393` varies `repsScale` 1.0 / 0.8 / 1.2, and `STEP`
at `:397-399` advances `setsDelta`.

So the push-up progression defect is a **layer-2 scheme selection issue**, addressable by changing
which schema a bodyweight-dominant block receives, or by giving `LINEAR` a rep progression. It needs
no measurement authority, no controller, and no new input — and per §3, e1RM cannot see push-ups
anyway.

**A progression controller and the push-up defect are different problems.** Option (b) may still be
worth executing on its own merits, but it should not be justified by the complaint that started
this work.

---

## 9. Recommendation

**Do not execute option (b) yet, and do not commission literature research for it.**

1. **It is gated on decision 3 regardless.** Without an established repeatability and minimal
   detectable change, §4's central question — constant bias or fatigue-correlated bias — cannot be
   answered, and a controller cannot state when a change is real. Everything else is premature.
2. **The literature has already been asked.** The audit's H-Q8-01 found reviewed autoregulation
   studies supervised, heterogeneous and terminologically inconsistent, and found no paper
   establishing the boundary either way. Re-commissioning the same question invites re-importing
   quarantined material.
3. **The cheap win is elsewhere.** §8's `LINEAR` scheme issue is a bounded change that addresses the
   originating complaint directly.

**If option (b) is later executed**, the shape suggested by this brief is: authority option (i),
reduction-only, subordinate to the existing guard layer, with coverage reporting per §3 shown to the
athlete, and validated prospectively per §7 — not because that is the most capable design, but
because it is the one whose worst failure is an unnecessary deload.

**One question this brief cannot answer and literature might.** Not "should measurement drive
prescription" — that has been asked. Rather: *what safety frameworks exist for closed-loop systems
whose primary measurement is self-reported and known to be biased?* That is control and safety
engineering, a corpus the audit never searched, and it would be a narrow, answerable commission.
It should only be raised if a future ruling moves toward authority option (ii) or beyond.

---

## 10. What this brief does not contain

Named so absence is not mistaken for oversight:

- No threshold, coefficient, window length, smoother, or detector.
- No estimate of how often RPE is actually present. That requires closed-beta data, not source
  reading, and inventing a figure would be the exact failure the evidence audit corrected.
- No claim that any specific control design is safe. §6 bounds a design space; it does not validate
  one.
- No behavioural claim about how athletes would respond to a visible progression number. The
  evidence baseline records that this is unevidenced in both directions.
- No push-up force coefficient, and no reopening of decision 5.
