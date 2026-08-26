# Analysis — the LINEAR scheme's progression is quantised away

**Date:** 2026-08-27
**Status:** finding and options. **No engine change was made.** Every option below needs owner
ratification before implementation, for the reasons in §4.

---

## 1. What was asked

Fix the `LINEAR` scheme so a bodyweight block progresses week over week, instead of prescribing the
same work at a higher RPE label. This was scoped as a small, ratification-free change. **It is
neither**, and the defect is larger than bodyweight. This document records what was found before any
code was touched.

---

## 2. The defect

`SCHEMA_WEEKS.LINEAR` (`packages/inference/src/blockGenerator.ts:384-387`) holds
`repsScale: 1, setsDelta: 0` across all three working weeks and advances only `rpeIdx` 0 → 1 → 2.
Reps and sets are therefore constant by construction, and **effort is LINEAR's only progression
channel.**

That channel reaches the athlete by exactly one route: `rpe` raises `targetPct`
(`blockGenerator.ts:428-430`), which raises `targetLoadKg` (`:434`), which rounds to 2.5 kg plates.

Two things sever that route.

- **Bodyweight movements have no load channel at all.** `loadSelection.ts:123` computes a load only
  when `!bodyweightMode`, and `e1rm.ts:77` rejects `loadKg <= 0`. There is nothing for the RPE
  advance to move.
- **Plate rounding swallows the advance at low and moderate loads.** The RPE wave 7 → 7.5 → 8 at 7
  reps spans `targetPct` 0.7500 → 0.7595 → 0.7692, a 2.6 % range. Below roughly 60 kg of 1RM, that
  entire range rounds to a single plate loading.

---

## 3. Empirical reproduction

Generated through the built engine (`npm run build:inference-test`), not by reading code.

### 3.1 A bodyweight athlete — `equipment_inventory: []`, objective `strength`, `LINEAR`

| Week | Phase | Movement | Reps | Sets | RPE |
|---|---|---|---|---|---|
| 1 | accumulation | Push-up | 7 | 4 | 7.0 |
| 2 | intensification | Push-up | 7 | 4 | 7.5 |
| 3 | realization | Push-up | 7 | 4 | 8.0 |
| 4 | deload | Push-up | 7 | 2 | 6.5 |

Reps identical, sets identical, only the RPE label moves. This is the reported complaint, reproduced
exactly.

### 3.2 The same three weeks converted to load, by 1RM

| 1RM | Week 1 | Week 2 | Week 3 | Distinct loads |
|---|---|---|---|---|
| 20 kg | 15 | 15 | 15 | **1** |
| 30 kg | 22.5 | 22.5 | 22.5 | **1** |
| 40 kg | 30 | 30 | 30 | **1** |
| 50 kg | 37.5 | 37.5 | 37.5 | **1** |
| 60 kg | 45 | 45 | 45 | **1** |
| 70 kg | 52.5 | 52.5 | 55 | 2 |
| 100 kg | 75 | 75 | 77.5 | 2 |
| 140 kg | 105 | 107.5 | 107.5 | 2 |
| 200 kg | 150 | 152.5 | 155 | 3 |

**Five of thirteen sampled 1RMs receive no load progression whatsoever**, and no 1RM below 200 kg
receives three distinct weekly loads. Even at 100 kg, weeks 1 and 2 are identical.

**This is not a bodyweight defect.** It affects every bodyweight movement always, every movement
under roughly 60 kg of 1RM always, and produces one usable step out of two possible for most of the
rest. Accessory work, upper-body pressing for lighter athletes, and beginners sit almost entirely
inside the dead zone.

---

## 4. Why this is not a one-line change

Three couplings make any fix a ratification matter rather than an edit.

**4.1 Any progression rule is a new engine value.** Adding a rep or set progression to `LINEAR`
introduces numbers that determine what athletes are told to do. The standing rule is that no such
value enters the engine without owner ratification recorded against a source.

**4.2 It would invalidate a ratified coefficient table.** `SCHEMA_FATIGUE_COST`
(`blockGenerator.ts:413-418`) prices each schema's fatigue per macro phase. `LINEAR` carries
`1.0 / 1.1 / 1.2 / 1.2` — the numbers of a schema that adds no volume. `STEP`, which does add a set,
carries `1.1 / 1.2 / 1.4 / 1.3`. Giving `LINEAR` a volume progression without re-pricing it would
leave the table understating the real cost, and that table feeds the hybrid CNS tax at
`HYBRID_TAX_THRESHOLD = 1.3` (`blockGenerator.ts:580`). The consequence is not cosmetic: hybrid
athletes would stop paying for volume they are actually doing.

**4.3 Bodyweight is not visible where the decision would be made.** Dose is computed once per
session at `blockGenerator.ts:620-637`; the movement is not chosen until `:662`. The generator's
`Movement` input carries `required` equipment but **not** the implement, and `required` is not a
bodyweight test — Feet-Elevated Push-Up requires a bench yet is bodyweight-loaded. The canonical
signal is `primaryImplement === 'Bodyweight'` (`SessionScreen.tsx:327`, from
`movement_taxonomy.implement`). A movement-aware rule therefore needs that field threaded into the
generator's input type and its per-slot reps made mutable — a wider change than the scheme table.

---

## 5. Options

Stated neutrally. None is preselected; each needs a ruling.

**(a) Set progression in `LINEAR`, reusing `STEP`'s existing rows.** `setsDelta` 0 → 1 → 1 already
ships and is already ratified, so no new constant is invented. Works for bodyweight and for the
sub-60 kg dead zone alike, because sets are never quantised away. **Requires re-ratifying
`SCHEMA_FATIGUE_COST.LINEAR`** per §4.2, and arguably makes `LINEAR` a duplicate of `STEP`.

**(b) Rep progression in `LINEAR`.** Keeps sets fixed, so the fatigue table is less disturbed, and
keeps `LINEAR` distinct from `STEP`. Requires new numbers, and `repsScale` is multiplicative — at 7
reps the available steps are coarse.

**(c) Movement-aware rule: bodyweight slots progress by reps or sets, loaded slots keep the RPE
ramp.** The most precisely targeted option and the only one that leaves loaded blocks untouched.
Also the most work, and the only one requiring the §4.3 plumbing.

**(d) Route bodyweight-dominant athletes to `STEP` at composition time.** No engine change and no
new numbers. But scheme selection is per block, not per movement, so it changes the loaded slots in
a mixed block too, and does nothing for the sub-60 kg dead zone on loaded work.

**(e) Finer load rounding.** Addresses the dead zone in §3.2 but nothing in §3.1. Partial at best,
and rounding to plates the athlete does not own is worse than the current behaviour.

---

## 6. Recommendation

**Option (a), with `SCHEMA_FATIGUE_COST.LINEAR` re-ratified in the same change.** It is the only
option that fixes both halves of the defect, it invents no new constant, and the coefficient it
disturbs is one whose correct value is bounded by an existing ratified row — `STEP`'s, for a schema
that does exactly the same thing to volume.

The duplicate-of-`STEP` objection is real but weaker than it looks: `LINEAR` would keep its own RPE
ramp (`rpeIdx` 0 → 1 → 2) where `STEP` holds effort flat before stepping (0 → 0 → 2). They would
remain distinct schemes.

If instead the priority is to leave loaded blocks untouched, option (c) is the correct answer and
should be scoped as its own work order, since §4.3's plumbing is the bulk of it.

---

## 7. What was not done

- **No engine file was modified.** No scheme table, coefficient, type, or store query.
- No new numeric value was introduced anywhere.
- No fatigue-cost figure was proposed for any option. Naming one is a ratification act.
- The demonstration script in §3 was run from a temporary file and removed; it is not committed and
  is not a gate. If a fix is authorized, the assertions in §3.1 belong in `verify_blocks.mjs` as a
  regression guard so the defect cannot return silently.
