# Training progression layers

Date: 2026-08-19
Status: design — owner ratification required before any implementation

## Why this document exists

The app has confused two different things since early on: how a block progresses *week to
week*, and how training progresses *block to block*. The first is implemented. The second is
not — what stands in its place is a fixed rotation with no inputs.

The confusion is visible in the code. `PROGRESSION_METHODS`
(`packages/inference/src/types.ts:61-63`) is `['linear', 'undulating', 'conjugate',
'autoregulated']` — three of those are schema names and one is a whole training system. It is
persisted as `athlete_profile.progression_methodology`
(`006_user_profile.sql:33`), validated, and round-tripped through the store, and **no engine
code reads it.** A grep for `progression_methodology` across `packages/inference/src` returns
only the type declaration and the default. It is a field that decides nothing.

This document names the layers, records what exists at each, and specifies what the missing
layer should do. **It proposes no code.** Every value below needs ratification under
Calibration Policy v1 §5.

---

## 1. The three layers

| Layer | Question it answers | Time scale | Status |
|---|---|---|---|
| **L1 — Day organisation** | What does a training week look like? | 1 week | Implemented, fixed by objective |
| **L2 — Week-to-week** | How does dose move across weeks 1–3 of a block? | 4 weeks | Implemented (`SCHEMA_TYPES`) |
| **L3 — Block-to-block** | What quality is this block developing, and why this one now? | months | **Missing** — see §3 |

The layers are independent by construction: L2 redistributes a dose that L3 sets, and L1
decides which days receive it. A change at one layer should not require a change at another.

### The category error this replaces

An earlier decision retired `WAVE` on the grounds that it is a volume- and intensity-equated
permutation of `LINEAR` (`blockGenerator.ts:381-407` — both carry a 3-week rep-scale sum of
3.0 and the same RPE indices in a different order). That observation is correct, and it is
recorded in `TRAINING_STRUCTURE_CONVENTIONS.md` §5.

The decision was not. It judged an L2 construct by an L3 outcome. A schema is *texture inside
a fixed block dose*; delivering the same block dose is what it is supposed to do. Long-term
progress was never its job. `WAVE` has been reinstated as a selectable schema carrying no
evidential claim of superiority.

---

## 2. What exists at L1 and L2

**L1 — Day organisation.** `programFocuses(objective, frequency)`
(`packages/inference/src/blockGenerator.ts:281`) maps an objective and a weekly frequency to a
split. Fixed per objective; the athlete controls frequency
(`athlete_profile.weekly_frequency`, `006_user_profile.sql:23`) and may edit day focuses.

**L2 — Week-to-week.** `SCHEMA_WEEKS` (`blockGenerator.ts:381-407`). Selectable set is
`LINEAR`, `WAVE`, `APRE` (`types.ts:214`); `STEP` is retired from selection but still
generates.

Week 4 is a deload in every case except an autopilot halt, which deloads all four weeks
(`blockGenerator.ts:591`).

---

## 3. What stands in for L3 today

A carousel. Two functions, no inputs.

`nextMacroPosition` (`apps/mobile/src/state/useStore.ts:1802-1810`):

```ts
const macroBlockIndex = lastMeta !== undefined
  ? (lastMeta.macro_block_index % MACRO_BLOCKS) + 1
  : 1;
```

`macroPhaseOf` (`packages/inference/src/blockGenerator.ts:345-348`):

```ts
const phases = ['gpp', 'hypertrophy', 'volume', 'peak'];
return phases[Math.floor((Math.min(Math.max(blockIndex, 1), MACRO_BLOCKS) - 1) / 2)];
```

So the sequence is fixed at `gpp, gpp, hypertrophy, hypertrophy, volume, volume, peak, peak`,
then it wraps to block 1 forever.

**Nothing about the athlete influences it.** Not logged outcomes, not readiness, not injury
state, not a competition date, not whether the previous block's work was completed. The only
input is the previous block's index. An athlete who spent a block injured advances to `peak`
on schedule; an athlete peaking with no competition peaks anyway.

That is the gap. It is not that the sequence is wrong — `gpp → hypertrophy → volume → peak` is
a defensible block-periodization order. It is that nothing decides *whether this athlete
should be at this point*.

---

## 4. The proposed L3 phase set

The performance sequence keeps the existing four values. **Rehab is deliberately not one of
them** (§4.1), and **taper is a derived property rather than a fifth value** (§4.2).

| Phase | Purpose | `PHASE_MODS` effect (`blockGenerator.ts:363-368`) |
|---|---|---|
| `gpp` | General preparation — work capacity and tissue tolerance. | +2 reps, −0.5 RPE |
| `hypertrophy` | Generic accumulation — build tissue. | +3 reps |
| `volume` | **Sport- and skill-specific loading** — add work to the skill the athlete's goal demands (power, conditioning, grappling). | +1 set |
| `peak` | Competition preparation — intensify toward a date. | −2 reps, +0.5 RPE |

**`hypertrophy` and `volume` are not interchangeable and must not be merged.** They were
considered for a merge to free an enum slot; that was rejected on 2026-08-20. `hypertrophy` is
generic tissue accumulation. `volume` is *skill-specific* — its purpose is to add work to a
particular quality, not to add work in general. Collapsing them would delete the only phase
that expresses sport specificity.

**Recorded gap between intent and implementation.** `volume` is currently implemented as a
uniform `+1 set` applied to every slot in the block. That is generic accumulation, not
skill-specific loading. To match its stated purpose the phase would need to bias the added
work toward the skill or sport days that `programFocuses` (`blockGenerator.ts:281`) already
produces, rather than spreading it evenly. This is a real defect in the current engine, not a
missing feature of the design. No fix is proposed here — the corrected distribution is an
unratified behaviour change.

### 4.1 Rehab is a suspending state, not a phase

Rehab does not belong in the phase sequence or in any block picker. Three reasons.

**It is not a step toward performance.** The other four phases are ordered — each develops a
quality the next one builds on. Rehab is not a rung on that ladder; it is a condition that
*interrupts* the ladder. Placing it in the sequence implies an athlete progresses out of it on
schedule, which is the same defect the carousel already has (§3).

**It is not selectable.** An athlete does not choose to be injured. The other four phases are
things a plan can legitimately offer; rehab is a state the athlete reports or the engine
detects. Putting it in a picker invites selecting it while uninjured, which means nothing.

**It would cost a migration.** `block_meta.macro_phase` is
`CHECK (macro_phase IN ('gpp','hypertrophy','volume','peak'))`
(`009_periodization.sql:38-39`) in a frozen migration. Adding a fifth value requires migration
057 against the frozen chain. Keeping rehab out of the phase enum avoids that entirely.

**How it should work instead.** Rehab suspends the sequence and preserves the athlete's macro
position, rather than replacing it:

- Entering rehab does not advance `macro_block_index`. The athlete's place in the performance
  sequence is held, not consumed.
- The route back out is therefore already defined: resume the preserved position. This closes
  the "no defined route back out" gap without inventing a return protocol.
- The training behaviour already exists at L1 and L2. `objective: 'rehab'` caps RPE at 7.0
  (`blockGenerator.ts:638`) and routes every day to `full` (`REHAB_SPLITS`,
  `blockGenerator.ts:258-259`, `:277`). Nothing new is needed there.

What is missing is only the L3 bookkeeping: a way to mark the athlete as suspended, and a
guarantee that `nextMacroPosition` (`useStore.ts:1802-1810`) does not advance while they are.
That is a small, self-contained change and it needs no new number.

### 4.2 Taper is derived, not a fifth phase value

Taper is a real and distinct structure — peak *intensifies* (−2 reps, +0.5 RPE), whereas a
taper holds intensity and cuts volume so fatigue clears before competition. The app cannot
express it today: the last two macro blocks are both `peak`, so a tapering athlete is peaked
again.

It does **not** need a fifth `macro_phase` value. There is already a precedent for a
block-shaping property that is computed rather than stored: `recovery`
(`blockGenerator.ts:510`) is derived at generation time from `globalGuardrail.halt`, reshapes
the entire block (`:591`), and has **no column in `block_meta`** — that table holds only
`macro_block_index`, `macro_phase`, `schema_type` and the vestigial `peak_shifted`
(`009_periodization.sql:35-45`).

Taper should work the same way. Once phase selection counts back from a dated horizon (§5A),
"this is the final block before the competition date" is **derivable from data that already
exists** — `requested_review_date` and the block's own dates. It needs no enum member, no
column, and therefore no migration against the frozen chain.

The block would carry `macro_phase = 'peak'` with a derived taper behaviour applied, exactly
as a halted block carries its ordinary phase with `recovery` applied.

**What is still unratified:** what the taper actually *does*. Duration and volume-reduction
percentage are supplied by no cited source for this population (§7). The derivation of *when*
a taper occurs is free; the magnitude is not.

---

## 5. What should move the athlete between phases

Three trigger classes, in descending order of confidence.

These are two different kinds of movement: **advancing** through the performance sequence, and
**suspending** it for rehab (§4.1). A suspend is not a phase transition.

**A — Athlete-declared.** The athlete names a competition date, or reports an injury. Highest
confidence, needs no threshold. `training_program` already carries the calendar hook:
`horizon_kind` of `'date'` or `'weeks'` with `requested_review_date`
(`033_goal_program.sql:13-14`, tied by the CHECK at `:22-25`). A dated horizon is what
competition preparation would count back from. An injury report *suspends* rather than
advances.

**B — Engine-observed, hard.** An autopilot halt (`globalGuardrail.halt`,
`blockGenerator.ts:510`) already deloads a whole block (`blockGenerator.ts:591`). What it does
not do is suspend the macro sequence — the athlete still consumes a macro position while
recovering. A halt is the natural engine-side signal for entering the suspended state.

**C — Engine-observed, soft.** Stagnation. At the pinned R8 baseline,
`packages/inference/src/e1rm.ts` exposes pure derivation functions, but there is no store getter,
persistence, display, threshold or detector. Direct supervised 1RM reliability cannot be
transferred into an MDC for the app's RPE-adjusted e1RM series. The documented audit searches did
not locate qualifying direct validation for an app-specific MDC or persistence window, and no
such value is ratified. Stagnation therefore remains non-authoritative and unimplemented; any
future use requires a separate owner ruling after source-located evidence or an approved own-data
protocol. See
[`PROGRESSION_MEASUREMENT_EVIDENCE_BASELINE.md`](../research/PROGRESSION_MEASUREMENT_EVIDENCE_BASELINE.md)
and
[`PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md`](PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md).

**Recommendation: build A first.** It requires no unratified number, and it covers the two
cases the carousel handles worst — injury and a real competition date.

---

## 6. Where conjugate fits

Conjugate is not an L2 schema, and it is not an L3 phase model either. It specifies all three
layers simultaneously:

| Layer | What conjugate specifies |
|---|---|
| L1 | Max-effort / dynamic-effort / repetition-effort days |
| L2 | The dynamic-effort pendulum — an explicit 3-week wave on percentage |
| L3 | **Concurrent.** All qualities trained year-round, never sequenced into phases. Progression comes from rotating the max-effort exercise. |

The L3 row is the real contrast with this app. Block periodization *sequences* qualities;
conjugate trains them *concurrently* and rotates exercises instead.

This is why conjugate never fitted `SCHEMA_TYPES`, and why it would not fit an L3 enum
cleanly either. Selecting it would have to **override the layers below it** — it is a system
choice, not a value in one dimension.

Practical consequence: `PROGRESSION_METHODS` should not be extended or wired up as it stands.
Its four members mix three L2 schema names with one whole system, and any code that reads it
would inherit that confusion. Either it is redefined as a system selector with exactly the
members that genuinely constrain all three layers, or it is formally recorded as dead. It
cannot be deleted — it sits in `CHECK` constraints in frozen migrations 006 and 007.

---

## 7. Numbers deliberately absent

None of the following appear in this document, because no cited source supplies them for this
population and Calibration Policy v1 §5 forbids inventing them:

- how many blocks a phase should last;
- taper duration, or its volume-reduction percentage;
- any app-specific e1RM error bound or persistence rule that would declare stagnation;
- any load or effort modifier for entering or leaving rehab;
- how far out from a competition date preparation should begin.

Each needs owner ratification before it enters code. A phase model can be built without them
by making transitions athlete-declared (§5A).

---

## 8. Open decisions for the owner

This section tracks phase-model decisions. Progression-measurement decisions are maintained in
the separate
[`PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md`](PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md)
docket; both records must be checked before authorizing work that crosses the two scopes.

### Settled

| Date | Decision |
|---|---|
| 2026-08-19 | **Rehab is not a phase.** It stays out of the sequence and out of every block picker; it is a suspending state (§4.1). |
| 2026-08-20 | **`hypertrophy` and `volume` are not merged.** `volume` is skill-specific loading, not generic accumulation — merging would delete the only phase expressing sport specificity (§4). |
| 2026-08-20 | **Taper is derived, not a fifth phase value** (§4.2), following the `recovery` precedent. |
| 2026-08-20 | **A competition date drives phase selection.** Count back from a dated horizon; fall back to the rotation when no date exists (§5A). |
| 2026-08-20 | **An autopilot halt prompts rather than auto-suspends.** The halt already deloads the whole block, so the athlete is protected either way; suspension changes weeks of future plan and should not happen silently. |

**Net effect: `MACRO_PHASES` stays at its four frozen values and no migration is required for
any of the above.** The one exception is the suspended-state flag — see open question 1.

### Open

1. **How is the suspended state recorded?** This has a factual constraint: there is no
   persistent injury state to infer from. Niggles are queried on a rolling recency window
   (`WHERE reported_at_ms >= ?`, `useStore.ts:3048`, `:5117`) with no resolved flag and no
   lifecycle — a daily complaint channel, not an injury record. So suspension needs its own
   explicit state, which is the **only** item here that would require migration 057. Whatever
   is chosen, `nextMacroPosition` (`useStore.ts:1802-1810`) must not advance while suspended.
2. **What does a taper actually do?** Duration and volume reduction are unratified (§7).
   *When* it happens is now derivable for free; *how much* it changes is not.
3. **How far out from the competition date does preparation begin?** Also unratified. Counting
   back requires knowing how many blocks to reserve.
4. **Should `volume` bias its added set toward skill/sport days** to match its stated purpose?
5. **What is the fatigue price of a strictly bodyweight working set?** *(raised 2026-08-27 by the
   Option C implementation.)* Option C gives bodyweight slots a `setsDelta` of `0 → 1 → 1` in
   LINEAR, so a bodyweight block now carries real added volume in weeks 2 and 3.
   `SCHEMA_FATIGUE_COST` is a ratified table and **no bodyweight row has been ratified for it**, so
   `SCHEMA_FATIGUE_COST_BODYWEIGHT` in `blockGenerator.ts` is deliberately an alias of the loaded
   table — a no-op branch that injects no unratified number.
   **Disclosed consequence while it stays an alias:** the hybrid CNS tax prices LINEAR as a schema
   that adds no volume, so a hybrid athlete on bodyweight LINEAR receives the week 2-3 set with no
   corresponding accessory-tax adjustment. The exposure is bounded to hybrid athletes, bodyweight
   slots, weeks 2-3, one set. Ratifying a coefficient is a table edit at that alias, not a
   refactor.
   Currently it adds a set uniformly (§4). This is a behaviour change to a shipped engine.
5. **`progression_methodology`**: redefine as a system selector, or record as dead? Blocked on
   question 6.
6. **Is conjugate in scope at all?** Supporting it properly means one selection overriding all
   three layers, and the app has no max-effort / dynamic-effort day model to build on.
7. **Duration vs Date horizon presentation**: When an athlete chooses a Duration horizon (weeks)
   with no target date, the app converts that duration into a concrete review boundary date
   (`start_date + weeks * 7`). The UI displays this converted date, making a Duration-horizon program
   visually indistinguishable from a Date-horizon program on screen. Corroboration requires inspecting
   the `horizon_kind` column in `training_program` (`weeks` vs `date`). Future UI work should consider
   whether the Duration horizon should display relative duration (e.g. "4 weeks remaining" or "Block N of M")
   rather than a converted calendar date, or whether the current uniform date presentation is intentional.
8. **Switching a program from Date to Duration keeps the date-derived anchor.** Observed on
   device: `program 4` became `horizon_kind='weeks'` with `requested_review_date` null while
   retaining `starting_macro_block_index = 2`, which was derived from its earlier competition
   date. This follows from the deliberate decision not to re-anchor a running program, but it
   means an athlete who removes their competition date keeps a competition-shaped phase sequence
   with nothing on screen explaining why. Decide whether that is correct, or whether removing a
   date should return the program to the rotation.

Nothing in this document is implemented. `MACRO_PHASES` is unchanged at
`['gpp', 'hypertrophy', 'volume', 'peak']`, matching the frozen CHECK at
`009_periodization.sql:38-39`.
