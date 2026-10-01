# Movement preparation — sources, doses and rulings

Policy: `ramp-general`, revision 1 (`packages/inference/src/preparationPolicy.ts`).
Recorded 2026-10-02. This file is the provenance record for every number the
preparation policy prescribes and every number the session-time contract uses.
A dose that has no row here is not prescribed.

Nothing in this file is medical advice, and no item is a clearance to train.
Every item carries a stop instruction, and the session halt and niggle controls
stay available throughout preparation.

## Sources

| Id | Source | Used for |
| --- | --- | --- |
| `ramp` | Jeffreys I. *Warm-up revisited: the "ramp" method of optimising performance preparation.* Professional Strength and Conditioning 2007;(6):12-18. Also Jeffreys I, "Warm-Up and Flexibility Training", NSCA *Essentials of Strength Training and Conditioning*, 4th ed. (2016), ch. 14. | The protocol's structure — raise, activate and mobilise, potentiate — and a raise phase of 3-5 minutes. |
| `acsm` | American College of Sports Medicine. *ACSM's Guidelines for Exercise Testing and Prescription*, 11th ed. (2021), components of the exercise training session. | A warm-up of at least 5-10 minutes of light-to-moderate activity. The 5-minute floor is the lower bound of this range. |
| `fradkin2010` | Fradkin AJ, Zazryn TR, Smoliga JM. *Effects of warming-up on physical performance: a systematic review with meta-analysis.* J Strength Cond Res 2010;24(1):140-148. PMID 19996770. | Why preparation is essential rather than optional: performance improved in 79% of the criteria examined, with little evidence of harm. |
| `behm2016` | Behm DG, Blazevich AJ, Kay AD, McHugh M. *Acute effects of muscle stretching on physical performance, range of motion, and injury incidence in healthy active individuals: a systematic review.* Appl Physiol Nutr Metab 2016;41(1):1-11. | Mobility items are dynamic and short. Static stretching of 60 s or more per muscle group reduced performance (-4.6%) far more than shorter stretching (-1.1%); dynamic stretching was neutral-to-positive (+1.3%). No item is a long static hold. |
| `ribeiro2020` | Ribeiro B, Pereira A, Neves PP, et al. *The Role of Specific Warm-up during Bench Press and Squat Exercises: A Novel Approach.* Int J Environ Res Public Health 2020;17(18):6882. PMID 32971729. | Progressive preparation sets: 6 repetitions at 40% and then 80% of the training load. A single light set was not enough for the squat. |
| `fifa11plus` | Soligard T, Myklebust G, Steffen K, et al. *Comprehensive warm-up programme to prevent injuries in young female footballers: cluster randomised controlled trial.* BMJ 2008;337:a2469, and the FIFA 11+ manual (F-MARC). | Single-leg balance held 30 s per leg; a static front support ("the bench") held 20-30 s. |

Limits of this record: the sources were consulted through their abstracts,
published summaries and the FIFA 11+ exercise table, not through licensed full
texts. Citations identify where a number comes from; no source text, figure or
table is reproduced in the app.

## Items and doses

| Item | Dose | Source and reasoning |
| --- | --- | --- |
| `raise.easy_movement` | 4 minutes (full protocol), 3 minutes (short protocol), at a pace where conversation is possible | `ramp` raise phase is 3-5 minutes; `acsm` light-to-moderate intensity. With a lower-limb niggle the instruction changes to a seated or upper-body option; the item is never removed. |
| `mobilise.leg_swings`, `mobilise.ankle_rocks` | 30 s each side | `ramp` mobilise phase; dynamic per `behm2016`. A time box, not a repetition claim. |
| `mobilise.hip_hinge_reach`, `mobilise.arm_circles`, `mobilise.torso_rotation` | 30 s | As above. |
| `activate.single_leg_balance` | 30 s each side | `fifa11plus` single-leg stance, one bout rather than two because this is a general gym session, not a 20-minute team warm-up. Chosen for lunge, running and sport sessions. |
| `activate.front_support` | 20 s | Lower bound of the `fifa11plus` "bench" hold. Chosen for squat, hinge and carry sessions. |
| `rehearse.session_movement` | One set of up to 6 unloaded repetitions (or a 10 s easy effort for a timed movement) | `ramp` potentiate phase: rehearse the activity itself before its working intensity. |
| `ramp.set_40`, `ramp.set_80` | 6 repetitions at about 40%, then about 80%, of **today's working load** | `ribeiro2020`. Adaptation: repetitions are capped at the working-set repetitions, so a preparation set is never more repetitions than a working set. |

Selection rules (deterministic):

- Mobility drills follow the movement patterns of the session, in session order.
- A drill that loads a joint with an active niggle at or above the athlete's
  triage threshold is withheld and listed under "omitted" with the reason.
- Rehearsal and ramp sets use the first compound movement of the frozen session
  plan that passes the same gates as the main plan: support holds, capability,
  tier and equipment access, and niggle safety. A movement that fails is listed
  as omitted and the next one is tried.
- Movements 135 and 187 are never used for a preparation drill while their
  identity correction is pending in the animation lane.
- The short protocol (under 8 minutes) keeps the raise and the preparation of
  the first movement, and leaves out mobility and activation with the reason
  "time". For a loaded first movement the light ramp set doubles as the
  rehearsal.
- Experience changes the wording and emphasis, not the dose: no reviewed source
  gave a tier-specific dose, so none was invented.
- Reduced readiness adds an instruction to keep every item easy and to ramp
  from the day's reduced working load. It adds no work.

## Evaluated and not adopted

**25-50 hip-flexor raises per side as a Muay Thai warm-up.** Evaluated at the
owner's request. No reviewed source supports that volume as preparation. The
Muay Thai warm-up guidance that was found is from gym and coaching sites, not
peer-reviewed work; it describes dynamic leg swings and knee raises in the order
of ten per leg or about a minute in total, which is consistent with the
30 s-per-side time box used here and gives no support for 25-50 per side. Twenty-five to fifty
loaded-range repetitions per side is practice or conditioning volume: it
produces meaningful local fatigue before kicking practice. It is therefore not
a default and not a preparation item. An athlete who chooses to do it can
record the amount actually performed; the app then marks that item as extra
work and shows it in the preparation record instead of hiding it in the
warm-up.

**Tier-specific doses, a third heavier ramp set, and percentage-of-1RM ramp
loads.** Not adopted: the 1RM-testing warm-up sequences in the strength
literature are for maximal testing, which this app does not prescribe, and no
reviewed source supported changing preparation dose by training age.

## Extra work is visible

`EXTRA_WORK_RATIO` is 1.5. When the amount an athlete records for a preparation
item is more than one and a half times the prescribed amount, the item is
stored with `extra_work = 1` and shown as "extra work" in the preparation
record. This is a product rule for visibility, not a physiological threshold.
Extra work recorded in preparation still does not create a `set_record` row,
because inventing a logged set from a warm-up entry would fabricate training
history; it is displayed for what it is.

## Session-time contract

`packages/inference/src/sessionTimeBudget.ts`, contract version 1.

| Constant | Value | Basis |
| --- | --- | --- |
| `PREPARATION_FLOOR_MIN` | 5 min | `acsm` lower bound. Never reserved below this; a session that cannot afford it is reported as a conflict. |
| `PREPARATION_STANDARD_MIN` | 10 min | Raise 4 min + two mobility drills + one activation + rehearsal + two ramp sets as estimated by the policy. Reserved from 60-minute sessions upward; 8 min from 45 minutes. |
| Rest between sets | The runner's own `restSecondsFor` (90-240 s by effort) | Not restated, so the estimate matches the timer the athlete sees. |
| `WORK_SECONDS_PER_REP` | 4 s | Engineering allowance for a controlled repetition. Estimate only. |
| `MIN_WORK_SECONDS_PER_SET` | 20 s | Engineering allowance for setting up and finishing a set. Estimate only. |
| `TRANSITION_SECONDS_PER_SLOT` | 120 s | Engineering allowance for changing station and loading. Estimate only. |
| `LEGACY_MINUTES_PER_SLOT` | 22 min | The block generator's existing movement-count law, unchanged. |

The three planners now share this contract:

1. **Block generator.** `slotBudgetForCap` replaces all three copies of
   `clamp(round(cap / 22), 2, 5)` and reserves the preparation floor first. The
   lower clamp of two movements is gone: a 15- or 30-minute session carries one
   movement instead of two it had no time for. Every generated session is then
   checked against the limit with the shared estimator.
2. **Routine microcycle** (`composeRoutineMicrocycle`). Each row is estimated by
   the shared estimator, with the row's pre-contract role allowance (set-up
   plus minutes per set) kept as its minimum. Preparation is reserved before
   support work is shed or major sets are reduced.
3. **Routine composer** (`composeRoutine`). Each selection is estimated by the
   shared estimator, with its pre-contract fixed role minutes kept as its
   minimum, and the same reservation. Shedding is computed on the tier-neutral
   set count, so experience changes the dose and never which selections
   survive the cap.

The per-row minimums make the change strictly conservative: a routine day is
never estimated shorter than under the law it replaces, so every day that was
refused before is still refused, and preparation is counted on top.

Repair order when a session is over its limit, identical everywhere:
condense preparation to the 5-minute floor; shed or trim the lowest-priority
work down to each planner's existing reviewed minimum; then report the
conflict with feasible options (a longer session, or the same weekly time in
fewer, longer sessions). Preparation is never removed to make a session fit,
and a frozen plan is never rewritten: its overage is shown.
