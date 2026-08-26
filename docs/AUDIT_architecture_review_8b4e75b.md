# Audit — external architecture review of `8b4e75b`

**Date:** 2026-08-27
**Reviewed:** `pikeMethods/drafts/architecture-review-8b4e75b/` — RR-01..RR-04 and WO-01..WO-12.
**Method:** every load-bearing claim re-checked against source at
`codex/progression-evidence-remediation`. Nothing was accepted on the review's own authority.

**Headline:** the review is mostly sound and its factual base is better than average. Three
things need correcting before work orders are handed out, and one architectural defect that
matters more than most of the register **was missed entirely** (§6).

---

## 1. Verdict per docket

| Docket | Panel rec. | This audit | Relevance to the app |
|---|---|---|---|
| RR-01 bodyweight fatigue cost | A or B | **A stands** — but see §2 | Low. Bounded to hybrid athletes, one set. |
| RR-02 suspended state | A (Migration 059) | **A, with three corrections** (§3) | **High** — but it is a feature build, not a bug fix. |
| RR-03 competition taper | B | **Defer both** (§4) | **Low right now.** The feature does not exist. |
| RR-04 volume allocation | A | **A — the strongest of the three** (§5) | **High.** Real, verified, cheap, no new numbers. |

---

## 2. RR-01 — already signed; two things to know

The factual base checks out: `SCHEMA_FATIGUE_COST.LINEAR` is ≤ 1.2 in every phase, so
`accessoryCut` is 0 and hybrid athletes take the Option C set with no tax. Option A is a defensible
ruling — it is the status quo and the exposure is one set.

**But two claims around it are wrong.**

**The rationale is unsourced.** Option A's stated basis is that "calisthenics exercises inherently
produce lower systemic CNS fatigue and lower axial loading than heavy barbell equivalents." No
source locator is given. That is the exact pattern the progression evidence audit quarantined 17
claims for. The *ruling* is fine; the *reason recorded for it* should not be carried into a decision
record as though it were evidence.

**It was not a cycle-saving no-op.** Option A ratifies "bodyweight fatigue pricing permanently
equals external-load pricing" — a substantive, door-closing position, not a deferral. Cancelling
WO-07 on that basis is correct, but the thing signed is a policy, not a shortcut.

**Ordering note the panel got right:** WO-03 observes that
`schemaFatigueCost(schemaType, macroPhase, false)` hardcodes `bodyweightDominant = false`, so the
bodyweight branch is currently **unreachable**. Under Option A that is harmless — both branches
resolve identically forever. Had B or C been chosen, WO-03 would have been a hard prerequisite.

---

## 3. RR-02 — right answer, wrong framing on three counts

Option A is correct. Take it. But the docket misstates the situation:

**(a) The migration number is wrong.** The chain head is `057_block_meta_phase_invariant.sql`. The
next free slot is **058**, not 059. `TRAINING_PROGRESSION_LAYERS.md` §8 item 1 also still says
"migration 057", which is now stale — that line should be corrected in the same work order.

**(b) It is not a bug fix.** The docket says the code "unconditionally increments … consuming macro
positions while injured," which implies a flag exists and is being ignored. **No suspension state
exists anywhere** — not in any migration, not in `packages/inference/`. `nextMacroPosition` is four
lines that read `block_meta` and advance modulo `MACRO_BLOCKS`; there is nothing for it to check.
This is a feature build with a migration, a state machine, and entry/exit conditions, not a
one-line guard. Scope and estimate accordingly.

**(c) Option B is not a band-aid — it is non-viable.** The docket describes keeping suspension "in
Zustand persisted state." There is **no Zustand persist middleware in this app**; every `persist*`
symbol in `useStore.ts` writes to SQLite. Option B's state would not survive an app restart, let
alone a reinstall. So A does not win a trade-off; B was never on the table. Worth knowing, because
a false trade-off makes A look more expensive than it is.

**Unresolved and not in the docket:** what *sets* `is_suspended`? Rehab is an athlete-chosen
objective, not a detected state, and `011_niggle_tracking` is a rolling complaint channel with no
resolved flag or lifecycle. So the work order needs an explicit answer to "who suspends, who
un-suspends, and on what evidence" — otherwise the column ships with nothing writing to it.

---

## 4. RR-03 — defer. This is the one to say no to.

Three independent reasons, any one sufficient.

**The feature does not exist.** `taper` appears **zero times** across `packages/inference/src/` and
`apps/mobile/src/`. WO-09 concedes this: the app currently delivers a second `peak` block before
the event. So RR-03 is not choosing between two taper protocols — it is ratifying numeric
parameters for an unwritten feature.

**The numbers have no source locators.** "Bosquet et al. (2007)" and "Mujika (2010)" are author-year
strings with no DOI and no PMID. This repository's own evidence standard requires a resolvable
identifier, and — more importantly — a resolvable identifier still would not verify that those
papers contain the specific figures attributed to them. That distinction is exactly what the
progression audit was created to enforce.

**The figures are not stable across the review's own documents.** The queue says 41–60 %; WO-09 says
40–60 %; Option A says 50 %; Option B says 30 % then 60 %. Numbers that drift between documents in
the same package have not been pinned to anything.

**Recommendation.** Do not rule RR-03. If tapering matters for the closed beta, the honest sequence
is: build the derivation first (which §4.2 says is free), ship it as a *structural* taper with no
ratified percentage, and treat the magnitude as a separate ratification with real source locators —
the same shape as the bodyweight fatigue coefficient. WO-12 (combat-sport tapering research) is the
correct vehicle, and it should precede RR-03 rather than follow it.

---

## 5. RR-04 — take Option A. It is the best-value item in the package.

Verified: `PHASE_MODS` at `blockGenerator.ts:383` is

```ts
volume: { reps: 0, rpe: 0, sets: 1 },
```

applied uniformly to every slot. That matches the owner's own standing docket item 4 in
`TRAINING_PROGRESSION_LAYERS.md` §8, so it is a pre-existing, independently recorded gap rather than
something the panel invented.

**Why it is the strongest candidate:** it introduces **no new number**. The `+1` already exists and
is already ratified; Option A only changes *where it lands*. Compare RR-03, which is entirely new
numbers for a feature that does not exist.

**One correction before execution.** The mechanism as written — "inspect `day.focus` … apply +1 set
only to Primary Lifts and Sport/Skill focus days" — does not map onto the code. `BlockFocus` is
`'lower' | 'upper' | 'full' | 'conditioning' | 'bjj'`; there is no "primary lifts" focus value. The
primary/accessory distinction is **slot-index based** (`ACCESSORY_SLOT_FROM = 3`), the same handle
the hybrid tax already uses. WO-10 should be rewritten against `slot_index` and `focus`, not against
a focus value that does not exist.

**Note it changes shipped blocks.** Any athlete currently mid-`volume` block sees their accessory
volume drop. That is the intended fix, but it is a behaviour change to live plans and should be
called out, not slipped in.

---

## 6. What the review missed — and it is bigger than most of the register

**The capability ladder and the block generator disagree about reps, so bodyweight athletes cannot
advance a rung for six of eight macro blocks.**

The app already has a working bodyweight progression mechanism — the ordinal capability ladder
(`movement_progression`, Push-up → Feet-Elevated → Pike → Eccentric Wall HSPU → HSPU). It is wired:
`resolveActiveRung` is called from `useStore.ts:2568` and `:2570` against 180 days of real set
history. Advancement requires `DEFAULT_ADVANCEMENT_POLICY = { requiredSets: 3, requiredReps: 8 }`,
and no `progression_policy` override rows are seeded for that chain.

Measured across the macro cycle, for a bodyweight strength athlete on LINEAR:

| Macro block | Phase | Prescribed reps | Sets (wk 1-3) | Reaches 8 reps? |
|---|---|---|---|---|
| 1, 2 | gpp | 7 | 4/5/5 | no |
| 3, 4 | hypertrophy | 8 | 4/5/5 | **yes** |
| 5, 6 | volume | 5 | 5/6/6 | no |
| 7, 8 | peak | 3 | 4/5/5 | no |

**The prescription reaches the ladder's advancement threshold in two of eight blocks.** In `peak` it
prescribes three reps against a threshold of eight. An athlete who follows the plan as written
progresses a rung only during hypertrophy phases — 25 % of the macro cycle.

This is not fatal, because the ladder reads *logged* reps and Option C's design deliberately invites
athletes to exceed the prescription at a fixed RPE target. But that makes rung advancement depend
on athletes routinely out-performing their own plan, which is an undocumented load-bearing
assumption connecting two subsystems that were designed independently.

It also bears directly on the complaint that started this whole line of work. The ladder — not the
set count — is what actually moves someone from push-ups toward handstand push-ups. If it is gated
off for most of the cycle, the headline progression story is still broken after Option C.

**Recommended:** a work order to reconcile the two, ahead of RR-02 and RR-03. The reconciliation is
a ratification question (which of the two numbers moves, and to what), so it should be docketed
rather than coded.

---

## 7. Two work orders that should not ship as written

**WO-04 (e1RM persistence) contradicts a ratified decision and cites it as authority.** It lists
"Ratified Authority: `PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md` Decision 1 (Dormant e1RM)" and then
proposes persisting e1RM to a new SQLite table for historical visualisation. Decision 1 was ratified
2026-08-26 as **option (a), remains dormant**: explicitly "no store getter, **persistence**,
display, threshold, detector, or prescription consumer." There is also a live removal guard —
`verify_store_sql.mjs:649` asserts `!src.includes('getMovementE1rmSeries')` — which exists because
this exact surface was removed once already. **WO-04 should be withdrawn**, or re-scoped as a
proposal to revisit Decision 1, which is the owner's call and not a work order's.

**WO-02 (ladder integration) is factually wrong.** It states the progression engine "is not wired
into `apps/mobile/src/state/useStore.ts`", at HIGH confidence, on static inspection. It is wired —
imported at `useStore.ts:138`, called at `:2568` and `:2570`. A narrower claim may survive (session
*completion* surfaces no rung-advance prompt), but that is a small UI gap, not an unwired engine,
and the priority should drop accordingly. §6 is the finding that section was reaching for.

---

## 8. Recommended sequence

1. **RR-04 / WO-10** — real, verified, no new numbers, matches the owner's own docket. Fix the
   mechanism description first (§5).
2. **§6 reconciliation** — docket the ladder-versus-prescription rep mismatch. It is the largest
   open defect in bodyweight progression and it is currently unrecorded anywhere.
3. **RR-02 / WO-08** — take Option A, at slot **058**, scoped as a feature build, with the
   "who suspends and un-suspends" question answered first (§3).
4. **WO-01** — the dead `progression_methodology` column is a genuine finding and cheap to resolve;
   it is a second, parallel vocabulary to `schemaType`, and one of the two should go.
5. **RR-03** — defer. Revisit only after WO-12 returns sources with resolvable locators.
6. **WO-04** — withdraw. **WO-02** — re-scope and downgrade.

---

## 9. What this audit did not do

- No engine, schema, or test file was modified. This document is the only artifact.
- The review's work orders were read but not executed, and no ruling was signed on the owner's
  behalf.
- WO-05, WO-06 and WO-11 were not audited in depth. WO-05/06 concern the offline verification gaps
  already known in this worktree; WO-11 restates decision 3, which is already ratified as future
  work.
- The §6 measurements were produced by generating real blocks through the built engine, from a
  temporary script that was deleted. They are reproducible from `generateBlock` with
  `equipment_inventory: []`, `objective: 'strength'`, `schemaType: 'LINEAR'` across
  `macroBlockIndex` 1..8.
