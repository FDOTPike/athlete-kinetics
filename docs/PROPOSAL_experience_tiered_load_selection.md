# Proposal — experience-tiered load selection and RPE trust

Date: 2026-07-31
Status: **PROPOSAL ONLY. UNRATIFIED. NO CODE.** Drafted by Claude at Francis's
request from his 2026-07-28 device-testing notes.

Every number in §5 and §6 is a **proposed** value, not a finding. §3 separates
what the literature supports from what is inference.

---

## 1. The request

From the notes:

> "can we also have the option for advance athletes to choose their own weights
> based of rpe goals, it should be one of the questions in the starting prompt
> (auto means 1rm are approximately known within a suitable error depending on
> the athlete...) beginners dont know rpe they are learning how to sense their
> body still, intermediate are trained and starting to grasp it, advance level
> are experienced enough to coach them selves but have the option for guidance,
> elite have a sense of their body's readiness in any given moment — adaptability
> should be considered. This ties into how 1rm are perceived by athletes at a
> given experience level."

Plus: **1RMs should move to the start screen** (currently buried in ATHLETE).

## 2. Three things currently conflated

The design gets much clearer once these are separated. They are independent:

- **(a) Load determination** — does the prescribed kilogram come from a stored
  1RM, or does the athlete choose it?
- **(b) RPE's role** — is RPE a *target* the athlete aims at, or a *report* they
  give afterwards? Currently it is both, on the same screen, with the same number.
- **(c) Trust in the report** — how much weight should the engine place on a
  self-reported RPE from *this* athlete?

Francis's request is mostly about (a). The interesting consequence is (c), because
the autopilot runs entirely on (c) — see §7.

## 3. Empirical basis

**What is reasonably established:**

- The RIR-based RPE scale (RPE 10 = 0 reps in reserve) has construct validity in
  both experienced and novice lifters — Zourdos et al. tested 29 squatters and
  found velocity/RPE correlations of r = −0.88 (experienced) and r = −0.77
  (novice).
- Accuracy improves as the set approaches failure. RIR estimates at 1 RIR are
  more reliable than at 4 RIR, across groups.
- Trained lifters are accurate near failure: mean error ≈ 0.65 ± 0.78 reps on
  bench press at 75% 1RM.
- The standing practical recommendation is that novices should *practise*
  recording RIR but **not have training intensity or progression based solely on
  it** until accuracy improves.

**Where the literature genuinely conflicts, and it matters here:**

- One line of evidence has experienced lifters underpredicting reps-to-failure by
  ~1–2 and less experienced by ~4–5 — a large gap, and the basis for a
  training-age-keyed model.
- A more recent back-squat study found **no difference** between experienced and
  novice in estimating RIR 3 and RIR 1, concluding that resistance-training
  experience does not itself drive accuracy, and that **prior familiarity with
  high-level effort** may matter more than training age.

**Do not treat this as settled.** It cuts a useful way, though: under the first
reading, tier-keying by training age is justified. Under the second, the real
discriminator is *exposure to near-failure work* — which the app can **measure
rather than ask** (§8). A design that keys on measured exposure is defensible
under both readings.

**Inference, not literature:** converting rep-error to load-error. The common
practical heuristic is that one rep of a set is worth roughly 2–3% of 1RM in the
5–10 rep range. If that holds, a 4–5 rep misjudgement is on the order of 10–15%
of 1RM, and a 1–2 rep misjudgement about 3–6%. **This chain is a heuristic on top
of contested evidence and should be labelled as such wherever it lands in code.**

## 4. What already exists

- `TrainingAge` = `beginner | intermediate | advanced | elite` (`types.ts:41`).
- `EXPERIENCE_SEVERITY[age]` = `{ triageMin, haltMin }` (`types.ts:51-56`) —
  precedent for tier-keyed engine behaviour.
- `targetLoadKg(oneRepMax, reps, targetRpe)` (`BlockScreen.tsx:87`) — **the auto
  path already exists.** What is missing is the manual path and the error handling.
- 1RMs for squat / bench / deadlift / OHP, snapped to 2.5 kg, cleared by typing 0.
- `base_rpe_cap` per profile; `profileLimits.ts` clamps.
- Tier law: beginners see only Beginner-difficulty movements plus the 8-item
  whitelist, and **no barbell** — so beginner 1RMs on the big four are largely
  moot today.

That last point is worth sitting with. A beginner cannot be prescribed a barbell
lift, so asking them for a barbell 1RM at onboarding asks for a number that
cannot be used and that they almost certainly do not know.

## 5. Proposed model — UNRATIFIED

| Tier | Load determination | RPE asked? | Autoregulation signal |
|---|---|---|---|
| **beginner** | Auto only, from a conservative estimate. No barbell 1RM prompt. | **No.** A 3-point proxy at most ("easy / hard / very hard"), stored but not fed to the engine. | Reps completed vs reps prescribed (§8) |
| **intermediate** | Auto default, manual available | Yes, with on-screen anchors explaining what each value means | RPE, attenuated |
| **advanced** | **Manual default**, auto available as guidance | Yes, full 0.5-step scale | RPE, full weight |
| **elite** | Manual, autopilot advisory only | Yes, plus session-level "how do you feel today" adaptability | RPE, full weight |

The shape of this follows Francis's own characterisation directly. The two
substantive additions are: beginners are not asked for RPE *at all* rather than
asked and answering unreliably; and the advanced/elite default flips to manual so
self-coaching is the path of least resistance rather than an opt-in.

## 6. The "suitable error" Francis asked for — UNRATIFIED

Rather than a percentage tolerance on the stored 1RM, express it as **confidence
in the derived target load**, and let it drive behaviour rather than just display:

| Tier | Assumed 1RM error | Proposed behaviour |
|---|---|---|
| beginner | unknown / not collected | Do not derive loads from 1RM for barbell lifts at all |
| intermediate | ~±10% | Show target as a **range**, not a single number; require a confirmation the first time a new 1RM is used |
| advanced | ~±5% | Single target, freely editable, no friction |
| elite | ~±5% or self-declared | Target shown as reference only; the athlete's entry is authoritative |

The percentages are the §3 heuristic and are the numbers most in need of
ratification. The behavioural column matters more than the exact figures — a
displayed *range* for a mid-tier athlete is honest about uncertainty in a way a
single decimal is not.

## 7. The part that connects to the autopilot — read this one

The Kinematic Autopilot's observer runs entirely on
`ΔE = actual_rpe − target_rpe` (`kinematicAutopilot.ts`, via
`autopilotProjection.ts`). **Its only input is a self-reported RPE.**

If §3's first reading holds, a beginner's report carries ~4–5 reps of error and
is **biased**, not merely noisy — novices call a set 9 when it was 6, i.e. they
systematically over-report effort. That yields systematically positive ΔE →
positive φ → `capacity_deficit` → the autopilot cuts.

So under this reading the autopilot would **systematically down-regulate
beginners**, reading measurement bias as fatigue. The direction is safe. The
reasoning is wrong, and nothing currently detects it: `MIN_OBSERVATIONS = 5`
offers no protection, because a beginner logs plenty of sets — they are just
plenty of unreliable ones.

Two candidate responses, both needing their own ratification:

1. **Attenuate by training age.** `PatternDailyDelta.avgAttenuation` is already a
   per-day weight channel in `(0,1]`, and `EXPERIENCE_SEVERITY` is precedent for
   tier-keyed constants. A beginner's ΔE could enter at reduced weight.
2. **Use a different signal for beginners entirely** — §8.

Option 2 is cleaner. Option 1 changes the observer, which was just stabilised at
`2a21ded` and whose analytic pins would move again.

## 8. Better signal for beginners: reps completed vs prescribed

For an athlete who cannot yet rate effort reliably, **"did you complete 4 × 7?"
is objective and already logged.** Shortfall against prescription is a real
fatigue signal requiring no introspection.

This also addresses §3's conflict directly. If the true discriminator is
familiarity with near-failure work rather than training age, the app can
**measure** it: an athlete with logged sets at RPE 9–10 has near-failure
exposure; one without does not. That is derivable from `set_record.rpe` history
with no new question and no new schema.

Per `AGENT_WORKFLOW.md` §3, a derived signal like that is not real until a gate
asserts it — so this is a scoped piece of work, not a free win.

## 9. Open questions — Francis decides

1. **Do beginners get asked for RPE at all?** §5 proposes not. It is the single
   biggest change to current behaviour and it contradicts "the athlete logs RPE"
   as a universal.
2. **Do advanced/elite default to manual?** This flips the current default.
3. **Are the §6 percentages right?** They are a heuristic on contested evidence.
4. **Range vs single number for intermediate targets** — honest, but more UI.
5. **Does the autopilot get tier-attenuated (7.1) or a substitute signal (7.2)?**
   Or neither for now, with the bias documented as known?
6. **1RMs on the start screen** — Francis asked for this. Which screen is "start"?
   READY is currently a readiness summary, and READY is itself under question
   (his note: *"I really don't like this screen"*). These two may want deciding
   together.
7. **Where does the auto/manual question live** — onboarding, per-profile setting,
   or both? And is it changeable later without invalidating logged history?

## 10. Out of scope

Layout and screen structure — `AGENT_WORKFLOW.md` §7 freezes that until the
pikeMethods template lands. The vocabulary problem is a separate ticket: this
proposal assumes an athlete knows what RPE *is*, and per Francis's note many do
not. A tiered model that stops asking beginners for RPE partly sidesteps that,
but does not solve it for the intermediate tier who are asked and still need it
explained.

## Sources

- [Novel Resistance Training-Specific RPE Scale Measuring Repetitions in Reserve (Zourdos et al.)](https://pubmed.ncbi.nlm.nih.gov/26049792/)
- [Application of the RIR-Based RPE Scale for Resistance Training](https://journals.lww.com/nsca-scj/fulltext/2016/08000/application_of_the_repetitions_in_reserve_based.10.aspx)
- [Efficacy of the RIR-Based RPE for the Bench Press in Experienced and Novice Benchers](https://pubmed.ncbi.nlm.nih.gov/28301439/)
- [Objective Accuracy in Estimating RIR in the Back Squat: Experienced vs. Novice](https://pmc.ncbi.nlm.nih.gov/articles/PMC13215226/)
- [Stronger by Science — Overshooting, Undershooting, Or Just Right?](https://www.strongerbyscience.com/reps-in-reserve/)

---

# Amendment 1 — 2026-07-31

Francis: **GO as design basis, NO-GO for code.** Three blockers. This amendment
resolves them. §5's tier shape and §7's autopilot concern survive; §6's
percentages are withdrawn.

## A1. Ratified from the original

- Beginner: effort **education**, not numeric RPE authority.
- Intermediate: auto default, manual optional.
- Advanced / elite: manual default, auto suggestion available.
- **§6's ±10% / ±5% are rejected** — heuristic, not calibrated. Withdrawn, not
  reworded. Nothing downstream may cite them.
- Completion-versus-prescription becomes the beginner control signal, in a
  **separate observer work order**.
- Auto/manual choice sits in onboarding and stays editable later.
- Moving 1RMs waits on the READY / start-screen redesign being ratified.

## A2. Blocker 2 first — it is a live defect today, not a future risk

`SessionScreen.tsx:270`:

```ts
setRpe(currentSlot.targetRpe ?? 8);
```

The RPE stepper is **pre-seeded to the prescribed target**. An athlete who logs a
set without touching it writes `rpe === target_rpe`, so `ΔE = 0`.

This is not confined to the beginner tier and does not depend on any of this
proposal shipping. **Every athlete, today, who does not adjust the RPE stepper
feeds the autopilot a synthetic zero** — indistinguishable from a genuinely
on-plan set. The observer cannot tell "performed exactly as prescribed" from
"never answered."

That is worse than the §7 bias case. Bias carries signal in the wrong direction;
fabricated zeros carry no signal while looking like health, and they pull φ
toward the deadband — the region the controller reads as *nothing to do*.

**The schema is already correct.** `001_mechanical_input.sql:80` —
`rpe REAL CHECK (rpe IS NULL OR rpe BETWEEN 0 AND 10)`. Nullable. **No migration
is required.**

**The observer is already correct.** A `null` daily ΔE is skipped
(`kinematicAutopilot.ts:237`), does not count toward `obs`, and so falls under
`MIN_OBSERVATIONS = 5` → neutral by *thin data*, which is honest. The plumbing to
handle absent evidence exists and works; only the seeding defeats it.

**Fix:** stop pre-seeding, or track a `touched` flag and persist `NULL` when the
stepper was never moved. Prefer explicit `touched` — an athlete may legitimately
land on the target value, and that answer should count.

**This wants its own work order ahead of the tiering work**, and it needs a
number before anything else: how many existing `set_record` rows have
`rpe === target_rpe` exactly? That fraction is the share of the autopilot's
historical evidence that may be fabricated. Everything in the C1–C6B chain was
validated against a simulated plant, never against this data path.

## A3. Blocker 1 — beginner load source

The original said "auto only, from a conservative estimate" and never named the
estimate. There isn't one: a beginner has no 1RM, cannot be prescribed barbell
work under the tier law, and has no history on session one.

**Resolution: there are four modes, not two.** "Auto vs manual" was the wrong
axis.

| Mode | Load comes from | Used by |
|---|---|---|
| **seeded** | Athlete self-selects on first exposure; app records it. Optional starting-load table by movement. | Beginner, first exposure to any movement |
| **history** | Last logged load for that movement, adjusted by completion versus prescription | Beginner thereafter; fallback for any tier on a movement with no 1RM |
| **derived** | `targetLoadKg(oneRepMax, reps, targetRpe)` — already exists | Intermediate default; suggestion for advanced/elite |
| **manual** | Athlete chooses every session | Advanced / elite default |

A beginner therefore runs **seeded → history** and never touches `derived`. No
1RM is required, no estimate is invented, and the tier law is respected rather
than worked around. `targetLoadKg` already exists for the derived path and needs
no change.

Open: does the seeded first exposure offer a suggested starting load, or a blank
field? A table is friendlier and is also a set of fiat numbers — the thing this
project keeps having to unwind. Recommend blank with a plain-language prompt
("pick a weight you could lift about ten times") and let `history` take over
immediately.

## A4. Blocker 3 — exposure cannot be inferred if it is never reported

Correct, and it kills §8's inference. If beginners never report RPE, there is no
RPE history from which to derive near-failure exposure.

**Resolution: stop inferring it. Teach it, and use the teaching as the
measurement.**

1. Beginner logs **completion only** — reps done against reps prescribed.
   Objective, requires no introspection, already stored.
2. After a ratified threshold of consistent logging, the app **introduces** RPE
   with anchors, and collects it *alongside* completion rather than instead of it.
3. During that overlap both signals exist, so the athlete's RPE can be checked
   against an objective outcome. A report of "RPE 9" on a set where they
   completed every prescribed rep comfortably is a calibration error the app can
   see.
4. RPE gains authority over prescription only once the two agree.

This gives a real graduation criterion instead of a self-declared tier, it
matches the literature's practical recommendation that novices practise recording
RIR without training being based on it, and it holds under §3's conflicting
evidence — because it measures the athlete in front of you rather than assuming
training age is the discriminator.

The threshold in step 2 and the agreement test in step 4 are both unratified and
should not be numbers anyone invents. Derive them from real logged data once it
exists.

## A5. Revised sequence

1. **RPE pre-seed fix** — standalone work order, ahead of everything here.
   Includes counting the historical `rpe === target_rpe` rows.
2. **Completion-versus-prescription observer** — separate work order, as ratified.
3. **Four-mode load selection** (A3) — needs A1 and A2 landed first.
4. **RPE teaching ladder** (A4) — last; depends on 2 for its objective signal.
5. **1RMs on the start screen** — blocked on the READY redesign.

## A6. Ratified by Francis - 2026-07-31

- Seeded first exposure uses a **blank field** with a plain-language selection
  prompt. No fiat starting-load table.
- RPE introduction is triggered by eligible completion history, not account
  age. Its numeric threshold is deferred until real completion data exists.
- An intermediate athlete without a movement-specific 1RM falls back to
  `history`; without history, the athlete receives the same blank seeded entry.
