# Progression Measurement Evidence Review — Research Brief

You are producing an evidence review for the owner of a strength-training application. He will
use it to decide **how the app should measure whether an athlete is getting stronger**. He is
not asking you to design the app.

**Do not rely on any source code.** A repository may accompany this brief. The code there is a
different revision and does not match. **This document is the authoritative description of the
system.** If code contradicts anything below, this document is correct.

**A companion brief already exists** covering acute:chronic workload ratio, telemetry for
combat athletes, per-muscle volume landmarks, tapering, loading-scheme distinctness, scheme
selection, step loading, and conjugate. **Do not re-answer those.** Where a question here
touches one of them, say so in one line and move on.

---

## Part 1 — The system

A mobile strength-training application. Offline. **No coach is involved at any point.** The
athlete follows what the screen says and self-reports effort. Nobody observes technique, nobody
notices a bad day, nobody intervenes.

### What the athlete logs

Per set: **repetitions**, **external load in kilograms**, and a **Rate of Perceived Exertion
(RPE) from 0 to 10** which is optional and may be absent. Optionally, elapsed **seconds** (for
held or timed movements) and a **band level** on a personal ordinal ladder. Nothing else. There
is no velocity measurement, no force plate, no bar tracker — a database column for mean velocity
exists and is written by nothing.

Bodyweight is entered manually. Sessions carry a start and end timestamp.

**Received automatically** (Android Health Connect only): heart-rate variability, resting heart
rate, sleep stages. Nothing else.

**Received not at all:** the app schedules grappling and conditioning days and gets **no data
back from them** — no duration, no rounds, no intensity.

### The four things the app currently computes from logged work

**1. Daily volume-load (called tonnage).** A trigger-maintained daily rollup:

    tonnage_kg = sum over all sets of (repetitions x external_load_kg)

A bodyweight set carries `external_load_kg = 0`, so **it contributes exactly zero**. A set of
20 push-ups and a set that was never performed are numerically identical in this rollup. The
owner has formally accepted this as a known pre-release limitation and has forbidden the app
from claiming this figure represents total mechanical work.

Alongside it the same rollup stores: total repetitions, set count, a count of **"hard sets" —
sets logged at RPE >= 8** — and the sums needed for a repetition-weighted mean RPE.

Volume-load feeds an acute:chronic workload ratio which is **displayed but has been ratified as
having no authority over any prescription decision**. The hard-set count and the mean RPE feed
nothing at all.

**2. An athlete-entered one-repetition maximum.** One row per movement. Exposed only for four
lifts (back squat, bench press, deadlift, overhead press). **Overwritten in place — the previous
value is destroyed.** There is no history and therefore no series.

**3. A repetition/effort-to-percentage translation**, used forward to turn a known 1RM into a
target load for a prescribed set:

    percentage_of_1RM = 1 / (1 + (repetitions + max(0, 10 - RPE)) / 30)

This is an Epley-family model with the repetitions-in-reserve term (`10 - RPE`) added to the
repetition count as though reserve repetitions were performed repetitions. It is the app's only
intensity model.

**4. An estimated 1RM, derived by reading that same equation backwards:**

    estimated_1RM = logged_load_kg / percentage_of_1RM(logged_reps, logged_RPE)

One point per session per movement — the highest estimate that session produced. A set logged
without an RPE yields no estimate at all rather than a default.

**This exists as a library function and is consumed by nothing.** It is not stored, not
displayed, and does not influence any prescription. It deliberately carries **no minimal
detectable change value, no noise floor, and no definition of a stall**, because no such number
has been ratified.

### The one non-load progression axis that exists

Separately from all of the above, the app holds a **capability graph**: ordered movement chains
(for example an ascending push-up chain from an inclined push-up through to a handstand push-up)
with explicit criteria on each edge — a minimum number of qualifying sessions, a minimum number
of sets per session, a minimum repetition or second count, and optionally a maximum RPE. When an
athlete's logged evidence clears an edge, the harder movement becomes available to them.

This is a **qualitative, ordinal** progression axis. It shares no scale, no units and no
arithmetic with volume-load or estimated 1RM, and the two never meet. Today it gates *which
movements the athlete may be shown*; it does not report progress and it does not change dose.

### What the athlete is shown about their own progress

Recorded tonnage and set count per day. The acute:chronic ratio, labelled as descriptive. The
1RM values they typed in themselves. **That is the whole of it.** There is no per-movement
strength trend, no repetition-at-load record, no chart of estimated 1RM over time.

### Prescription, for context only

Training runs in 4-week blocks; week 4 is a deload. The athlete's stated goal sets a base
repetition count, a base set count and a three-value RPE ramp; a weekly loading scheme moves
those across weeks 1 to 3. Working sets are bounded between 2 and 6 per exercise. **There is no
per-muscle volume tracking.** Load is either derived from the entered 1RM via the equation
above, or entered by the athlete.

### The specific concern that prompted this review

The owner's position, in his words: the app has *"a very one-dimensional way to track
progression — increase weight equals improvement"*, and *"doing sets at lower load and higher
repetitions is not equivalent to higher load and lower repetitions even if the volume is the
same."*

He wants to know whether that intuition is supported, and if it is, what a defensible
multi-dimensional progression model would have to measure — given that all he can observe is
repetitions, kilograms, a self-reported RPE that is frequently absent, seconds, and a manually
entered bodyweight.

### Two constraints that shape every answer

**There is no coach.** A protocol validated on supervised, trained, motivated subjects does not
automatically transfer to an unsupervised recreational trainee whose RPE reports are unverified
and possibly uncalibrated. Where that gap matters, say so explicitly.

**Numbers are frozen by policy.** No numerical value enters this app without the owner's
explicit ratification, recorded against a source. Your findings inform that decision; they do
not authorise anything. **Do not propose implementation, database design, or product features.**

### No audience data

No product has launched. There is **no age range, no training-age distribution, no confirmed
sport mix.** Do not assume any. The design implies training ages from beginner to elite, one to
seven sessions per week, and grappling as a first-class training day. Grappling is the only
combat sport modelled.

---

## Part 2 — Evidence standard

This is the part that determines whether the review is useful.

### Tier every claim, inline

- **A** — meta-analysis or systematic review
- **B** — randomised or controlled trial
- **B−** — peer-reviewed conceptual, methodological, psychometric or statistical analysis; no new data
- **C** — observational, cohort or field data
- **D** — practitioner consensus or expert opinion
- **E** — commercial system with no independent validation

Where a tier is arguable, state the lower one and say why.

**Tier B− carries unusual weight in this review.** Several questions below are measurement-
validity questions — how accurate is this equation, how reliable is this rating, how large is
the smallest real change. Those are answered by validation and reliability studies, not by
training trials. Do not down-rank a psychometric or measurement-error paper for lacking a
training outcome.

### Every factual claim carries a DOI or PMID

No exceptions. If you cannot produce one, it is not a finding — either drop it, or label it
explicitly as your impression rather than evidence.

Do not cite a review's description of a primary study as though you read the primary study. Say
which you actually read.

### For every claim also give

- **Population studied** — training status, sex, age, sport — and whether it transfers to an
  unsupervised recreational trainee. This is frequently the whole answer.
- **Effect size and uncertainty**, not just direction.
- **What goes wrong if the number is wrong**, in *both* directions, for an unsupervised athlete.

### Separate the science from the system

Renaissance Periodization, Westside Barbell, Kabuki Strength, Juggernaut, and every commercial
1RM calculator or proprietary "strength score" mix well-evidenced principles, reasonable
extrapolation, and framing that exists partly to be sellable. Distinguish those three
explicitly.

**A number being specific, confident and widely repeated is not evidence.** Epley, Brzycki,
Lombardi and Wathan formulas are quoted to four significant figures across the entire fitness
industry. Report what has actually been *validated*, in whom, and with what error.

### "I don't know" is a complete answer

All of these are valid and valuable:

- "The evidence does not support a specific value."
- "This is practitioner consensus with no controlled evidence."
- "Studies exist but the populations do not transfer."
- "I could not find evidence bearing on this."

**Never fill a gap with something plausible.** A fabricated value does not speed up the owner's
decision; it corrupts it. Four solid answers and four honest blanks beat eight confident ones.

---

## Part 3 — The questions

### Q1 — Is strength progression validly representable as a single number?

The app has two candidate scalars: volume-load (repetitions x kilograms, summed) and an
estimated 1RM. Both collapse a (load, repetitions, effort) triple onto one axis.

Is that collapse defensible? What does the evidence say about whether maximal strength,
strength-endurance, hypertrophy and skill acquisition progress **together** or **dissociate**?
Under what training conditions do they come apart far enough that a single scalar misreports
progress — and in which direction does it misread?

If the evidence supports a multi-dimensional representation, **how many dimensions does it
actually support**, and what is each one? Name them from the literature, not from convenience.

### Q2 — How accurate is the specific equation this app uses?

    percentage_of_1RM = 1 / (1 + (repetitions + (10 - RPE)) / 30)

This is the highest-value question in the set, because it is narrow, testable, and already
load-bearing in production.

- What is the validated accuracy of Epley-family repetition-maximum equations, by **repetition
  range** (roughly 1–5, 6–12, 13+), by **exercise** (multi-joint versus single-joint, upper
  versus lower body), and by **training status**? Give error magnitudes, not "good" or "poor".
- The app adds repetitions-in-reserve to the repetition count as though reserve repetitions were
  performed repetitions. Is that substitution validated anywhere? What happens to the estimate's
  accuracy as RPE moves away from 10?
- What is the **measurement error of a self-reported RPE or repetitions-in-reserve rating** in
  an untrained or lightly trained person with no coach calibrating them? Does accuracy differ by
  proximity to failure, by repetition range, by training age, by exercise?
- Propagating both error sources, **what is the minimal detectable change of an estimated-1RM
  series computed this way?** In kilograms or in percent. If the literature does not support a
  value, say so plainly — that is a usable answer, and the owner will not adopt an unsourced one.

### Q3 — Does equal volume-load mean equal stimulus?

The owner's direct question. Two sessions with identical `sum(reps x kg)` — one heavy and low
repetition, one light and high repetition.

- For which outcomes does volume-load equate, and for which does it demonstrably fail? Treat
  maximal strength, hypertrophy and local endurance separately.
- Where is the boundary? Is there an evidenced load or repetition threshold below which
  volume-load stops tracking a hypertrophic or strength stimulus, or is the relationship
  continuous?
- **Is a count of "hard sets" (sets taken near failure) a better-evidenced volume proxy than
  tonnage?** The app already computes exactly this — sets logged at RPE >= 8 — and uses it for
  nothing. Compare the two proxies directly, with effect sizes.
- Note explicitly if this overlaps the companion brief's per-muscle volume question, and confine
  yourself to the equating question here.

### Q4 — How is progression measured on movements with no load axis?

Bodyweight, leverage-based, isometric, eccentric-only, and plyometric work all record zero or
near-zero external load. Volume-load is structurally blind to them and the estimated-1RM
equation has nothing to divide.

- Is there an evidenced way to place bodyweight or leverage progressions on a common scale with
  externally loaded work, or must they be tracked on separate axes?
- Where a movement progresses by **changing leverage or variation** rather than by adding load
  or repetitions, how is the size of that jump quantified in the literature — if at all?
- For **isometrics** and **eccentric-only** work, what is the evidenced progression variable —
  time, position, load, or something else?
- The owner has ratified a limited "equivalent volume" concept for four barbell lifts using
  reviewed per-movement coefficients, and has explicitly excluded accessory, carry, core and
  grappling work. Is coefficient-based equating of *different movements* supportable by evidence
  at all, or is it necessarily a convention? Say which.

### Q5 — What separates real progress from noise, without a coach?

- What is the **test-retest reliability and typical error** of the measurements this app can
  actually take: a repetition maximum at a submaximal load, a self-reported RPE, a
  repetitions-at-fixed-load record, a timed hold?
- **How long must a non-improving trend persist before it means anything?** State the evidence
  for a persistence window, or state that none exists. This is a number the owner needs and
  currently refuses to invent.
- Does biological and day-to-day variation in these measures differ enough by training age that
  one threshold cannot serve beginner through elite?

### Q6 — What happens when you show an unsupervised athlete a progress metric?

- What is the evidence on displaying quantified progress metrics to unsupervised trainees —
  effects on adherence, on training behaviour, and on **gaming the displayed number**?
- Specifically: if an athlete can raise a displayed score by adding repetitions, adding load, or
  reporting a higher RPE, what does the behavioural literature predict they will do? Is there
  direct evidence from fitness applications or self-monitoring research?
- Is there evidence that a **flat or declining** metric shown to a novice harms adherence?
- Does showing multiple progress dimensions help comprehension or degrade it relative to one
  number?

### Q7 — Which non-load progression axes are worth measuring at all?

Candidates: repetitions at a fixed load, load at fixed repetitions, estimated 1RM, range of
motion, movement-variation rung advancement, work density (work per unit time), rest-interval
tolerance, repetition velocity, and time under tension.

For each you address: does it have **outcome evidence** (it predicts or reflects adaptation) or
only **sensitivity evidence** (it moves when training changes)? Is it capturable from
repetitions, kilograms, seconds, a self-reported RPE and a phone clock — with no wearable beyond
heart-rate variability and sleep, and no bar tracker? Separate the ones that need hardware this
app does not have, and say so rather than describing them as options.

### Q8 — Should a progression metric ever drive prescription, or only describe?

The owner has already ruled that the acute:chronic workload ratio is **computed, stored,
displayed, and given no authority whatsoever** over any prescription decision. The estimated-1RM
series is currently in the same position by default: it exists and nothing consumes it.

- Is that separation the right one for a progression metric, or does the evidence support
  closing the loop and letting a measured trend change future dose?
- What are the documented failure modes of an autoregulating system driven by a **noisy,
  self-reported, frequently absent** signal in an unsupervised population? Include instability,
  oscillation, and ratcheting.
- Is there evidence on **how often** a progression metric should be allowed to change a
  prescription — per set, per session, per block — or is that convention?

---

## Part 4 — Output

One report. One section per question, in order, headed Q1 through Q8.

For each question, end with a short block headed **"What this does and does not authorise"**,
separating (a) findings solid enough to base a decision on, from (b) things that are convention
or practitioner consensus and would be the owner's ruling rather than an evidenced value.

Then close with:

1. **A count** — how many factual claims you made, and how many carry a DOI or PMID. If those
   numbers differ, list every claim that does not.
2. **What you could not answer**, each with its reason: insufficient evidence, no transferable
   population, or could not locate sources.
3. **Every number a reader might mistake for a ratified recommendation**, listed explicitly with
   its tier and its population. The owner's policy forbids adopting an unsourced value, and the
   most common way one enters a system is by appearing confidently in a report.
4. **Any source published within the last 90 days**, listed separately with its DOI, so it can
   be verified by hand before anything rests on it.
5. **The single weakest claim in your report**, and why it is weak.

### One thing this report must not do

Do not design a progression score. Do not propose a formula, a weighting, a composite index, or
a set of thresholds. If the evidence supports a multi-dimensional model, describe **what the
dimensions are and what each is measured by** — and stop there. Composition is the owner's
ratification decision, and a plausible-looking formula in this report would pre-empt it.

Questions 1, 3 and 8 test positions the owner already holds. Q1 and Q3 test his stated intuition
that one dimension is not enough; Q8 tests his ruling that measurement stays descriptive. You
are not there to confirm any of them.
