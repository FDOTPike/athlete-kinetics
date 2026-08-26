# Parked — RR-03 competition taper, and the architecture it actually needs

**Date:** 2026-08-27
**Owner ruling:** **RR-03 is parked. Neither option ruled. The proposed taper figures are
discarded and must not be carried into any work order.**
**Deferred to:** Sol — see §4 for the titled work order.

---

## 1. Why the figures were discarded

The RR-03 docket asked for a ruling between a 1-week 50 % taper and a 2-week 30 %/60 % taper. Three
findings, any one sufficient to refuse the ruling:

**The feature does not exist.** `taper` appears **zero times** across `packages/inference/src/` and
`apps/mobile/src/`. WO-09 concedes it: the app currently delivers a second `peak` block before the
event. RR-03 was asking for numeric parameters for unwritten code.

**No source locators.** The figures were attributed to "Bosquet et al. (2007)" and "Mujika (2010)" —
author-year strings with no DOI and no PMID. This repository's evidence standard requires a
resolvable identifier, and resolving one still would not verify that the paper contains the number
attributed to it. That distinction is the entire reason the progression evidence audit exists.

**The figures were not stable inside the review's own package.** 41–60 % in the ratification queue,
40–60 % in WO-09, 50 % in Option A, 30 % then 60 % in Option B. Numbers that move between documents
in one delivery have not been pinned to anything.

**Nothing about the underlying training concept is being rejected.** Tapering is real. What is
rejected is ratifying magnitudes with no traceable source into an engine that has no taper.

---

## 2. What the engine is actually missing

Two absences, and the second is the larger one.

**2.1 No taper architecture.** The block model has four phases (`gpp → hypertrophy → volume →
peak`), each a fixed 4-week block ending in a deload. A taper is not a deload: a deload cuts both
volume and intensity, while a taper **holds intensity and cuts volume**. `PHASE_MODS` cannot express
that — its `peak` row is `{ reps: -2, rpe: +0.5, sets: 0 }`, and the deload path
(`blockGenerator.ts`) reduces sets and pulls RPE below week 1 together. Taper needs a distinct
week-shape primitive, not a parameter.

**2.2 No non-7-day micro-cycle architecture.** The block engine is hard-wired to a 7-day week:
`BLOCK_WEEKS` is 4, sessions carry `week_index` 1..4, `SCHEMA_WEEKS` has exactly three working rows
plus a deload, and the whole scheme table is indexed by week. A 9, 12 or 14-day micro-cycle is not a
setting — it changes the indexing primitive that periodization, the coaching engine, the calendar
and the session runner are all built on.

This matters for tapering specifically: an 8–14 day taper cannot be expressed at all inside a 7-day
grid without either rounding it to one or two weeks (which is what forced RR-03's false choice) or
breaking the week model.

---

## 3. The owner's periodization intent, recorded

Recorded verbatim in substance so the future build has the actual requirement rather than
reconstructing it:

> Taper weeks should be accompanied by a **peak block 1–2 weeks prior**, and usually an **intensity
> block of about 4 weeks** before that, focused on **higher intensity and sets, lower volume**, to
> maximise the skill and supercompensation effect during the peak and taper weeks.

Read as a structure, this is a **multi-block sequence terminating at a competition date**, not a
week-4 modifier:

```
  intensity block (~4 wk)  →  peak (1-2 wk)  →  taper  →  competition
  high intensity           relative           intensity held
  higher sets              maintenance        volume cut
  lower volume                                skill preserved
```

Three consequences for whoever builds it:

- **The unit of periodization becomes the sequence, not the block.** The current engine picks one
  block at a time from a rotation. A competition-terminating sequence has to be planned backwards
  from a date across several blocks.
- **"Higher intensity and sets, lower volume" is not currently expressible.** `PHASE_MODS` moves
  reps, rpe and sets as one row per phase; there is no phase that raises sets while cutting total
  volume, because volume is not a modelled quantity — it is emergent from sets × reps.
- **The 1–2 week peak and the taper length are exactly the durations the 7-day grid cannot hold.**
  This is why §2.2 is a prerequisite for §2.1 and not a parallel nicety.

**No number in this section is ratified.** "~4 weeks", "1–2 weeks" and "8–14 days" are recorded as
the owner's stated design intent and as the shape the research must price — not as coefficients.

---

## 4. Deferred work order

**Title, as specified by the owner:**

> **Non-7-Day Micro-Cycle architecture implementation** — 9-day, 12-day and 14-day micro-cycles
> implemented into the block generator, the coaching engine, and the app in general.

**Assigned to:** Sol.
**Class:** architecture phase, not a work order. This is a foundational change to the indexing
primitive of the periodization model, and it should be scoped as its own phase with its own
checkpoints.

**Known blast radius** (from source, not estimated):

| Area | Why it is affected |
|---|---|
| `blockGenerator.ts` | `BLOCK_WEEKS = 4`, `SCHEMA_WEEKS` rows indexed by week, `progIdx` derivation, deload-by-week logic |
| `009_periodization.sql`, `007_program_engine.sql` | `week_index` columns and CHECK domains |
| Autopilot | the observer window is expressed in days (21) but the control action lands per block/week |
| Session runner and calendar | day indices, `programDays`, session dating |
| Coaching engine / UI | every "week N of 4" surface |
| Every block gate | `verify_blocks.mjs` asserts "exactly 4 weeks ending in deload" as a structural law |

**Sequencing:** §2.2 (micro-cycle architecture) is a **prerequisite** for §2.1 (taper), which is a
prerequisite for any re-opening of RR-03. Building taper first inside the 7-day grid would bake in
the rounding that made RR-03 unanswerable.

**Research dependency:** WO-12 (combat-sport tapering kinetics) should return **sources with
resolvable identifiers** before any magnitude is proposed. It informs; it does not authorize.

---

## 5. Status of the RR-03 docket

| | |
|---|---|
| Option A (1-week, 50 %) | **not ruled — figures discarded** |
| Option B (2-week, 30 %/60 %) | **not ruled — figures discarded** |
| Quarantined and not to enter any work order | 50 %, 30 %, 60 %, 40–60 %, 41–60 %, "8–14 days" as a ratified window, and the Bosquet/Mujika attributions in their current unlocatable form |
| Re-opens when | the micro-cycle architecture exists, a taper primitive exists, and WO-12 has returned locatable sources |
