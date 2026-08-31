# Audit addendum — Claude release closeout at 34f91ff

## 0. Audit Control

### 0.1 Scope and Non-Claims

This addendum confirms or refutes exactly the five pre-documented findings listed in
`docs/WORKORDER_MASTER_AUDIT_SYNTHESIS_REMEDIATION.md` §3.5. It is not a general audit of the State
C branch and it did not scan for additional defects. Anything noticed outside those five findings is
recorded in §4.3 as an out-of-scope observation and is deliberately excluded from the strict
outstanding-work ledger in `MASTER_AUDIT_SYNTHESIS.md`.

- **Audited revision:** `34f91ffe548a0b9e51db863ffc6fad993619f940`, branch `claude/rc-48719b0`.
- **Audit method:** immutable-revision reads via `git show <revision>:<path>`, plus one read-only
  empirical probe described in §0.3. The State C worktree filesystem was never read; at work-order
  preparation time it carried further uncommitted Migration 060 and KineStrike changes that are
  outside this audit.
- **Auditor:** Claude Code Opus as `DOCUMENT_EXECUTOR`, work order W2.
- **Product code changed:** none. This addendum authorizes no remediation.

### 0.2 Commits Under Audit

| Commit | Subject | Files changed |
|---|---|---|
| `a80f955b0d76625587023536bcc260f6d80bc2a2` | `docs(decisions): C1 decision docket and the owner's ratified rulings` | `PROMPT_LEDGER.md`, `docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md` |
| `f3ebab38c703c549ca20b9bd972be915eb6dd84b` | `feat(db): Migration 059 -- suspension state, load intent, audit immutability` | 5 files, +183/−10 |
| `0cd8db9a8a1520ef1ce98803096e0dc4c22d9b2c` | `feat(release): freeze progression under suspension and route dose on planned load` | 9 files, +965/−62 |
| `34f91ffe548a0b9e51db863ffc6fad993619f940` | `docs(ledger): record the C0-C5 result for entry 0057` | `PROMPT_LEDGER.md`, +69/−4 |

`git log --oneline 48719b07988ad30d255b0fed37f45ed5db49c935..34f91ffe548a0b9e51db863ffc6fad993619f940`
returns exactly these four commits in this order, so State C is State A plus these four and nothing
else.

### 0.3 Empirical Probe Method

Findings 2 and 3 were additionally verified empirically rather than by reading alone. The 59
**schema files** at `34f91ff` — 58 migrations plus the non-migration slot 004, as §0.3 sets out
below — were extracted with `git show` into a session scratchpad outside the
repository, applied in filename order to an in-memory `node:sqlite` database under
`PRAGMA foreign_keys = ON`, and probed with the exact mutations under test. Nothing was written to
the repository, no repository file was modified, and no test file was edited. The probe reported
`chain applied: 59/59 files` and all three new tables plus all four new triggers present.

**The probe chain is not the production migration chain, and the difference is stated rather than
glossed.** The repository's contract is **58 migrations**: slot 004 is the parameterized
`state_vector` materialize script, never a migration -- it binds `?1` and is loaded separately as
`m004` by `packages/core-db/src/index.ts`. `verify_migrations.mjs` says so directly: "Slot 004 is
the parameterized materialize script, never a migration: 58 files (slots 001-059, no 004) ->
user_version 58."
[Source: packages/core-db/test/verify_migrations.mjs@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 1720-1725]
The probe applied all 59 schema files including 004. That file is an idempotent upsert on
`state_vector` and touches none of the suspension tables, so it cannot affect the trigger and
cascade results below -- but the probe's chain is 59 schema files, not the production 58-migration
chain, and no claim here depends on the two being identical.

The probe does **not** prove application behaviour, because it exercises SQL directly rather than
through the production migration runner and store. It proves what the database layer permits and
refuses. Claims that depend on the runner's sentinel and self-heal paths are labelled from source
reading instead.

## 1. Findings 1 and 2

### 1.1 Finding 1 — L1(a) Athlete-Choice Gap

**Verdict: `PARTIALLY_CONFIRMED`.**

The ratified ruling is L1 **(a) constrained**: *"Persist explicit prospective per-slot load
intent/implement at block generation. Ambiguous mixed movements require athlete selection. Missing
legacy state fails closed toward the conservative loaded path. Intent may not be derived from
dropdown order, taxonomy, equipment ownership, or retrospective set data."*
[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 452-452]

**What landed, verified at `34f91ff`.** Prospective per-slot intent is persisted at generation time:
`INSERT INTO planned_slot_load_intent (planned_slot_id, planned_implement)` executes inside the
block-generation write path, guarded so that nothing is written when intent is undeclared.
[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 3344-3354]
Intent is not derived from dropdown order for a multi-member list: `plannedImplementFor` returns the
sole supported prefix when there is exactly one, and `undefined` otherwise.
[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 1833-1834]
The fail-closed default holds, because the engine's bodyweight test is an equality against a
declared value, so an undeclared slot is not bodyweight.
[Source: packages/inference/src/blockGenerator.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 113-114]
Store-side behaviour is asserted in both directions, including a non-vacuity claim that some slot
must be declared.
[Source: apps/mobile/test/components/SuspensionLifecycle.test.js@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 339-392]

**What did not land.** The ruling's second sentence — *ambiguous mixed movements require athlete
selection* — has no implementation. Searching the whole tree at the audited revision for either the
schema object or the field name returns seven paths and not one of them is a screen or component:

```text
git grep -l "planned_slot_load_intent\|plannedImplement" 34f91ff -- apps/ packages/
  34f91ff:apps/mobile/src/state/useStore.ts
  34f91ff:apps/mobile/test/components/SuspensionLifecycle.test.js
  34f91ff:apps/mobile/test/verify_store_sql.mjs
  34f91ff:packages/core-db/src/migrationRunner.ts
  34f91ff:packages/core-db/src/schema/059_suspension_state_and_load_intent.sql
  34f91ff:packages/inference/src/blockGenerator.ts
  34f91ff:packages/inference/test/verify_blocks.mjs
```

All three production call sites derive intent from the same singleton rule and no other input.
[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 3052-3052]
[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 3179-3179]
[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 3348-3348]

**Answer to the question the work order posed.** No reachable UI or program input captures an
athlete's ambiguous per-slot selection at `34f91ff`. An ambiguous movement is therefore permanently
undeclared and permanently takes the loaded path; the athlete has no mechanism to correct it.

**Impact.** Directionally safe, because failing closed to loaded is what L1(a) mandates for missing
**legacy** state. It is not thereby ruling-compliant: the ruling scopes fail-closed to legacy state
and *separately* requires athlete selection for ambiguous mixed movements, so permanent fail-closed
for a movement the athlete was never able to declare is the defect, not the remedy. But the docket measured 17 multi-prefix movements in the shipped
corpus — 14 with two prefixes and 3 with three — of which 7 list `Bodyweight` first while supporting
external load: Bulgarian Split Squat, Walking Lunge, Weighted Pull-up, Chin-up, Glute Bridge, Nordic
Curl and Push-up.
[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 253-257]
Those seven now receive the loaded prescription with no athlete-facing route back to the bodyweight
dose.

**The impact is wider than load routing, and an independent reviewer was right to press on it.** At
State C one `bodyweightSlot` flag, computed at `:846`, gates **two** behaviours in the slot loop:
`isPurelyBodyweight(m)` selects the Option C set ramp at `:853-857`, and the SAME flag selects the
L2(b) chain rep floor at `:862` via `bodyweightRepsFor`. (A third consumer, `bodyweightDominant`,
is a separate call site treated in §2.2.) A slot not classified bodyweight receives the loaded set schedule *and* the raw
phase reps, bypassing the ladder floor entirely.
[Source: packages/inference/src/blockGenerator.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 844-862]
[Source: packages/inference/src/blockGenerator.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 765-771]

Push-up is the sharpest case, and sharper than first recorded. It is `('Push-up',
'handstand-push-up', 0)` -- rung **0**, the entry rung of a seeded capability chain. Undeclared at
State C, it loses the Option C ramp AND the ladder floor, so it is prescribed raw phase reps against
an advancement bar of 8 it can no longer reach. That is the same class of defect
`docs/AUDIT_architecture_review_8b4e75b.md` section 6 identified and the ladder reconciliation was
authorized to close. **This is a dose regression at State C relative to State A, not merely a
ruling-completeness gap.**

**On the `BLOCKING` status inference.** This addendum establishes the *facts*: an athlete-selection
surface required by a ratified ruling does not exist, and its absence changes prescribed dose for
seven named movements, removing the capability-ladder floor for those on a chain. It does **not**
rule on whether that blocks a release; §4.2 reserves that to the owner. In
`MASTER_AUDIT_SYNTHESIS.md` these facts are carried by two rows, because they are independently
closable: `OW-001` holds the athlete-selection residue at `NON_BLOCKING`, and `OW-036` holds the
chain-floor regression at `BLOCKING`. Each `release_effect` is a **status inference by the document
executor**, not an owner ruling and not a finding of this audit. It was chosen conservatively,
because the effect is an unratified dose change to a shipped progression path. An independent
reviewer is asked to adjudicate explicitly whether that inference is supportable on this evidence or
should be `NON_BLOCKING` pending an owner decision. Either answer leaves the release posture
unchanged, because C6 is independently deferred.

**Narrowest remediation.** Add an athlete-facing per-slot implement selection for movements whose
`supported_prefixes` has more than one member, writing to the existing
`planned_slot_load_intent` table. No schema change and no new number is required; the table, the
CHECK domain and the fail-closed read already exist. Until it lands, the L1(a) ruling is only
half-implemented and the residue should be disclosed rather than described as complete.

### 1.2 Finding 2 — Reset Lifecycle Gap

**Verdict: `CONFIRMED`, with part (a) materially mitigated and part (b) unmitigated.**

**Part (a) — `PER_ATHLETE_RESET` omits suspension state. Confirmed as written, mitigated in
practice.** The reset object clears every other per-athlete surface and does not clear `suspension`.
[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 2053-2060]
The store field it fails to clear is declared at
[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 643-643]
and initialised at
[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 2096-2096].

The mitigation is real and must be stated: both Coach Mode swap paths spread `PER_ATHLETE_RESET` and
then immediately call `boot()`, and `boot()` calls `refreshSuspension()`.
[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 2853-2854]
[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 2878-2885]
[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 2195-2195]
So a completed swap re-hydrates the value from the new athlete's file. The residual exposure is
bounded to two windows: the asynchronous interval between the `set()` and the `refreshSuspension()`
inside `boot()`, during which `activeAthleteId` is already the new athlete while `suspension` still
holds the previous athlete's episode; and any boot failure that sets `status: 'error'` before
reaching line 2195, which leaves the previous athlete's suspension resident.
[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 2367-2368]

**Part (b) — `resetTrainingData` neither deletes suspension rows nor refreshes suspension.
Confirmed, unmitigated, and empirically demonstrated.** The delete list runs 49 `DELETE` statements
and none names `suspension_episode`, `suspension_episode_program` or `block_suspension_origin`.
[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 6078-6130]
The post-reset in-memory update does not clear `suspension`, and the five refresh calls that follow
do not include `refreshSuspension()`.
[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 6141-6156]

The probe applied the exact parent deletes that touch the suspension side-cars — `training_block_program`,
`training_program`, `training_block` — with foreign keys on, as `pragmas.ts` sets them:

```text
before reset: suspension_episode=2 suspension_episode_program=1 block_suspension_origin=1
after  reset: suspension_episode=2 suspension_episode_program=0 block_suspension_origin=0
open episode(s) surviving a whole-athlete training-data reset: [{"episode_id":2,"frozen_macro_index":4}]
```

So a wipe leaves the athlete **still suspended at a frozen macro index whose entire block history no
longer exists**, while cascading away both the S5(c) frozen program state and every S6(b)
attribution row. The store's `suspension` field is simultaneously stale, because nothing refreshes
it. This is a genuine lifecycle defect, not a cosmetic omission.

**The obvious fix does not work, and this is why the remediation must be narrow.** The probe also
issued the blanket statement a reset would naively add:

```text
REFUSED | DELETE FROM suspension_episode (blanket, as a reset would issue)
        -> suspension_episode: a closed episode is history and cannot be deleted
```

Migration 059's `trg_suspension_episode_no_delete_closed_bd` aborts it. Inside `resetTrainingData`'s
single transaction that abort reaches the `catch` and `ROLLBACK`s the entire reset.
[Source: packages/core-db/src/schema/059_suspension_state_and_load_intent.sql@f3ebab38c703c549ca20b9bd972be915eb6dd84b, lines 147-152]
[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 6131-6136]

**Narrowest remediation.** Delete only the open episode — `DELETE FROM suspension_episode WHERE
ended_at_ms IS NULL` — placed before the `training_program` and `training_block` deletes so the
side-cars cascade from their own episode rather than from a program, then add
`get().refreshSuspension()` to the post-reset refresh list. Whether closed episodes should survive a
training-data wipe at all is an owner question, not an executor's: M1(a) says the migration must not
"block explicit whole-athlete data erasure", and 059's own header records that whole-athlete erasure
deletes the database file rather than rows.
[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 454-454]
[Source: packages/core-db/src/schema/059_suspension_state_and_load_intent.sql@f3ebab38c703c549ca20b9bd972be915eb6dd84b, lines 142-146]

## 2. Findings 3 and 4

### 2.1 Finding 3 — Migration 059 Immutability Surface and Behaviour Coverage

**Verdict: `CONFIRMED`.** Both halves hold: the side-car mutation surface is not closed, and no
behavioural test exercises any 059 trigger.

**The exact allowed and refused mutations, probed against the real chain.** Migration 059 closes the
M1 exposure on the base table for **completed history**. Every mutation the C1 docket listed as
`ALLOWED` under 058 alone is now refused for a closed episode. Two mutations remain permitted, both
deliberately: the athlete's own resume, and deletion of a still-open episode — the latter is what
§1.2's narrowest remediation depends on:

| Operation | Result | Enforcing object |
|---|---|---|
| `UPDATE` open episode `frozen_macro_index` | REFUSED — "the entry record is immutable" | `trg_suspension_episode_immutable_entry_bu` |
| `UPDATE` open episode `started_at_ms` | REFUSED — "the entry record is immutable" | `trg_suspension_episode_immutable_entry_bu` |
| `UPDATE` open episode `reason` | REFUSED — "the entry record is immutable" | `trg_suspension_episode_immutable_entry_bu` |
| `UPDATE ended_at_ms` NULL → non-NULL | **ALLOWED** — the intended athlete resume | none; deliberate |
| `UPDATE` closed episode `ended_at_ms` → different non-NULL | REFUSED — "a recorded close time cannot be changed" | `trg_suspension_episode_close_once_bu` |
| `UPDATE` closed episode `reason` | REFUSED — "the entry record is immutable" | `trg_suspension_episode_immutable_entry_bu` |
| `DELETE` a closed episode | REFUSED — "a closed episode is history and cannot be deleted" | `trg_suspension_episode_no_delete_closed_bd` |
| **`DELETE` an OPEN episode** | **ALLOWED** — deliberate; the trigger fires only `WHEN OLD.ended_at_ms IS NOT NULL`, because blocking it would strand a mis-entered suspension with no exit that is not itself a falsified record | none; documented at `059:142-146` |
| `UPDATE suspension_episode_program.frozen_sequence_index` | REFUSED — "the frozen program state is immutable" | `trg_suspension_episode_program_immutable_bu` |
| **`DELETE suspension_episode_program` directly** | **ALLOWED** | no trigger exists |
| **`UPDATE block_suspension_origin.episode_id`** | **ALLOWED** | no trigger exists |
| **`DELETE block_suspension_origin`** | **ALLOWED** | no trigger exists |
| Any mutation of `planned_slot_load_intent` | **ALLOWED** | no trigger exists |

The four triggers are the complete enforcement set in the migration.
[Source: packages/core-db/src/schema/059_suspension_state_and_load_intent.sql@f3ebab38c703c549ca20b9bd972be915eb6dd84b, lines 116-160]

**Why the gap matters and is not symmetric.** `trg_suspension_episode_program_immutable_bu` fires
`BEFORE UPDATE` only, so the row it protects from revision can still be removed outright — including
for a closed episode whose parent row is itself undeletable. And `block_suspension_origin` carries
no protection at all, which is the sharper of the two: it is the attribution table that makes S6(b)
work, because the position readers exclude attributed blocks rather than storing a second copy of
the position. Deleting a row silently returns a suspension-era block to consuming a macro position,
reintroducing exactly the P1-1 defect the ruling was raised to close.
[Source: packages/core-db/src/schema/059_suspension_state_and_load_intent.sql@f3ebab38c703c549ca20b9bd972be915eb6dd84b, lines 54-72]
[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 459-461]

**Behaviour coverage: absent.** Sentinel registration exists — three tables and four triggers, seven
objects.
[Source: packages/core-db/src/migrationRunner.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 190-196]
Both pinned migration counts were re-pinned from 57 to 58 files, never loosened — the
`verify:migrations` pin
[Source: packages/core-db/test/verify_migrations.mjs@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 1721-1725]
and the `verify:pipeline` pin
[Source: packages/inference/test/verify_pipeline.mjs@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 511-520]
But `verify_migrations.mjs` ends at its `[058]` section and has no `[059]` section: the final
behavioural block runs lines 1932–1994 and the file terminates at 1997.
[Source: packages/core-db/test/verify_migrations.mjs@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 1932-1997]
Searching the audited revision for any of the four trigger names or any of their four abort messages
returns only the migration itself and the sentinel list — no test asserts any refusal, and no test
covers 059 self-heal restoration. `SuspensionLifecycle.test.js` returns zero matches for
`immutable`, `DELETE`, `UPDATE suspension`, `059`, `episode_program` or `block_suspension_origin`
across all 393 lines.

This is precisely the distinction the work order warned against: sentinel existence proves the
object is present and restorable, not that it refuses anything. The `[058]` section demonstrates the
project's own standard for this — it plants poison and asserts the abort — and 059 does not meet it.

**Narrowest remediation.** Add a `[059]` section to `verify_migrations.mjs` asserting each of the
seven refusals in the table above, the one permitted transition, and self-heal restoration of a
dropped 059 trigger and table. Separately, decide whether `block_suspension_origin` and
`suspension_episode_program` should receive delete protection; that is a schema change requiring a
Migration 060 and therefore an owner authorization, not an executor's call.

### 2.2 Finding 4 — Bodyweight-Fatigue Branch Reachability

**Verdict: `CONFIRMED`. The branch is unreachable in production generation, and it is dose-neutral
today.**

`bodyweightDominant` requires every member of the generator's movement pool to be planned bodyweight.
[Source: packages/inference/src/blockGenerator.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 681-682]

Both production call sites construct `input.movements` by mapping the store's entire movement
catalogue, not the selected slots. `genMovements` is `movements.map(...)` where `movements` comes
from `get()`, hydrated by the catalogue-wide query that joins every movement table with
`ORDER BY m.movement_id` and no selection filter.
[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 3041-3056]
[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 3163-3183]
[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 1123-1123]

On the shipped 300-movement corpus, `every(isPurelyBodyweight)` is therefore false in every real
generation, so `bodyweightDominant` is always `false` and the bodyweight branch never evaluates.

**Why the impact is limited but the claim is still wrong.** `SCHEMA_FATIGUE_COST_BODYWEIGHT` is an
exact alias of `SCHEMA_FATIGUE_COST`, so both branches return the same number for every
`(schema, phase)` pair and the unreachability changes no athlete's dose today.
[Source: packages/inference/src/blockGenerator.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 498-508]
The commit's own comment states the purpose of the change was that "the claim that future pricing is
'only a table edit' [was] untrue" and that it "now carries the real classification."
[Source: packages/inference/src/blockGenerator.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 671-680]
That stated purpose is not achieved. Replacing the alias with a ratified bodyweight table would
still have no effect in production, because the branch selecting it cannot become true. The C1
docket's own framing — that this plumbing is dose-neutral and needs no ruling — remains correct; what
is incorrect is the belief that the ratification path is now open.
[Source: docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md@a80f955b0d76625587023536bcc260f6d80bc2a2, lines 388-393]

**Narrowest remediation.** Compute the classification from the movements actually placed into the
block's slots rather than from the available pool, or delete the branch and restate the pending
ratification honestly. Either is a code change requiring separate authorization. Nothing here
introduces or requires a number.

## 3. Finding 5 and Gate Coverage

### 3.1 Finding 5 — Resume Error-Handling Gap

**Verdict: `CONFIRMED`.**

The entry path wraps `beginSuspension` in `try/catch` and routes the message to an action-scoped
error state, deliberately separated from the global error channel.
[Source: apps/mobile/src/screens/BlockScreen.tsx@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 499-515]

The resume path calls `endSuspension(Date.now())` bare, with no `try/catch`.
[Source: apps/mobile/src/screens/BlockScreen.tsx@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 480-485]

`endSuspension` does not catch either. It issues an unguarded `executeSync` `UPDATE` — unlike
`beginSuspension` immediately above it, which wraps its writes in an explicit transaction with
`ROLLBACK` and re-throw.
[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 2704-2713]
[Source: apps/mobile/src/state/useStore.ts@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 2680-2699]

**A database error on resume therefore escapes the press handler with no athlete-visible message.**
There is a second, independent reason it could not be shown even if it were caught: the
`suspension-error` text node is rendered only inside the not-suspended branch of the conditional.
When `suspension != null` — the only state in which the resume button exists — no error surface is
mounted at all.
[Source: apps/mobile/src/screens/BlockScreen.tsx@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 471-517]

**Impact.** An athlete whose resume fails sees the suspension card unchanged and receives no
explanation, in a flow whose entire purpose is athlete-owned control in both directions. The
asymmetry is the defect: the same screen already establishes the correct pattern one branch away.

**Narrowest remediation.** Wrap the resume `onPress` in the same `try/catch` used at lines 499–506,
and mount an action-scoped error node inside the suspended branch. No store change is required,
though moving `endSuspension`'s write into the same transactional shape as `beginSuspension` would
be the more consistent fix.

### 3.2 What the C1–C5 Gates Did and Did Not Prove

The State C ledger entry reports `verify:ci` exit `0` with 231 tests across 18 suites, five
deliberate mutation reversions with five caught -- one of those five escaped on the first run and
was closed by two store-side assertions -- and a QA artifact built from the clean committed
candidate after an initial `verify:qa-candidate` rejection for a missing gitignored model asset.
[Source: PROMPT_LEDGER.md@34f91ffe548a0b9e51db863ffc6fad993619f940, lines 3074-3139]

These claims are `REPORTED`. This addendum did not re-run them, and the work order does not
authorize a release-gate execution. What they cannot prove, on the evidence above:

- They do not prove L1(a) is fully implemented. `SuspensionLifecycle.test.js` asserts the store's
  derivation and its fail-closed default, which is what exists; no test can fail for the absence of
  an athlete-selection surface that was never specified into a test.
- They do not prove 059's immutability. No gate exercises any of the four triggers, so the entire
  refusal surface — including the three unprotected mutation paths in §2.1 — is untested. A green
  `verify:migrations` is consistent with all four triggers being semantically wrong.
- They do not prove reset-lifecycle correctness. No gate covers `resetTrainingData` against
  suspension state.
- They do not prove the bodyweight-fatigue branch is reachable, only that it compiles and is
  dose-neutral.
- They do not prove C6. `verify:memory-contract` and therefore `verify:release` require the physical
  owner-authorized 4 GB device and an owner-signed evidence packet, and the ledger records both as
  not done.

The five deliberate reversions are meaningful evidence of gate sensitivity for the paths they
covered, and the entry discloses that one of those five escaped on the first run and was closed by
two store-side assertions. That disclosure is to the executor's credit and is recorded here as such. It
does not extend coverage to the four gaps above.

## 4. Disposition Summary

### 4.1 Verdict Table

| # | Finding | Verdict | Evidence class | Enters the strict ledger |
|---|---|---|---|---|
| 1 | L1(a) athlete-choice gap, and the chain-floor loss it causes | `PARTIALLY_CONFIRMED` | `VERIFIED AT 34f91ff` | Yes — split into `OW-001` (athlete selection) and `OW-036` (ladder-floor regression) |
| 2 | Reset lifecycle gap | `CONFIRMED` | `VERIFIED AT 34f91ff` plus empirical probe | Yes |
| 3 | Migration 059 immutability surface and behaviour coverage | `CONFIRMED` | `VERIFIED AT 34f91ff` plus empirical probe | Yes — split into two independently closable items |
| 4 | Bodyweight-fatigue branch reachability | `CONFIRMED` | `VERIFIED AT 34f91ff` | Yes |
| 5 | Resume error-handling gap | `CONFIRMED` | `VERIFIED AT 34f91ff` | Yes |

Nothing was refuted. Finding 1 is the only partial: its persistence, fail-closed and
no-dropdown-order requirements are met and only its athlete-selection requirement is absent, so only
that residue may enter the ledger. In `MASTER_AUDIT_SYNTHESIS.md` §4, these facts are carried by two
separate rows: `OW-001` holds the athlete-selection residue (`NON_BLOCKING`) and `OW-036` holds the
ladder-floor regression (`BLOCKING`), because either can be closed independently of the other.

### 4.2 Release Effect

None of the five is a data-loss or safety-invariant breach, and none rewrites completed history.
Findings 1, 2 and 5 are athlete-visible. Finding 3 is an audit-integrity and test-integrity
gap. Finding 4 is a ruling-completeness gap with no dose effect today. **Finding 1 is not.** It changes
the prescription of seven named movements relative to State A, and for those that sit on a
capability chain it also removes the ladder rep floor, so Push-up is prescribed below the level at
which its own capability is measured.

**The two halves must be weighed separately, and an independent reviewer was right that the earlier
wording muddled them.** The *set-schedule* half is conservative: an undeclared slot takes the flat
loaded schedule instead of the bodyweight 4-to-5-to-5 ramp, so it receives fewer sets and violates
no ratified constraint. The *rep-floor* half is not conservative and is not authorized by any
ruling: L2(b) narrowed the ladder floor to capability-chain movements, it did not remove the floor
from them, and losing it prescribes an entry-rung movement below the bar its own advancement is
measured against. It is also wrong to defend the first half as "what L1(a) mandates for missing
state": L1(a) scopes fail-closed to missing **legacy** state and separately requires athlete
selection, so a permanently undeclarable movement is the defect, not the remedy.

Whether any of them blocks the release is an owner decision. This addendum records them as open and
does not clear or weigh them against the C6 gate. Where `MASTER_AUDIT_SYNTHESIS.md` §4 carries a
`release_effect` value, that value is the document executor's conservative status inference from
these facts, explicitly flagged as such in §1.1, and is not a verdict of this audit. Those values are
`NON_BLOCKING` for `OW-001`, on the set-schedule ground above, and `BLOCKING` for `OW-036`, on the
rep-floor ground.

### 4.3 Out-of-Scope Observations

Recorded here per work-order §2.3 and deliberately excluded from `MASTER_AUDIT_SYNTHESIS.md`:

1. **`OUTSIDE_SCOPE_OBSERVATION`.** State B's working-tree overlay adds `suspensionEpisode: null` to
   `PER_ATHLETE_RESET`, which is the omission Finding 2(a) identifies at State C. The two lineages
   solved the same reset question differently and neither is a superset of the other. This is
   relevant to any future reconciliation of the two Task U3 implementations.
2. **`OUTSIDE_SCOPE_OBSERVATION`.** `docs/decisions/TRAINING_PROGRESSION_LAYERS.md:281` at State A
   records the broad bodyweight rep floor as `Settled 2026-08-27`. The C1 docket §5.6 retracts that
   framing and L2(b) narrows the floor to capability-chain movements, so the row misstates the
   record as of 2026-08-29. The docket already flags this as a checkpoint item outside its own write
   boundary; it is outside this work order's boundary too, and this addendum does not edit it.
3. **`OUTSIDE_SCOPE_OBSERVATION`.** `TRAINING_PROGRESSION_LAYERS.md` §8 numbers two consecutive
   entries `5`. A source-numbering defect only; no content consequence.

## 5. Post-Fix Addendum — OW-036 closure at commit `88f5b5c`

This addendum records the State C push-ready remediation's closure of the chain-floor regression that
this audit's Finding 1 split into `OW-036`. It does not revise the audit's verdicts at `34f91ff`,
which remain exactly as recorded above; it records what happened after this audit was delivered.

**What closed.** Commit `88f5b5c` (`fix(progression): decouple chain rep floor from load routing`)
renamed `bodyweightRepsFor` to `chainScopedRepsFor` and keyed it on chain membership
(`m.progressionGroup !== undefined`) rather than on `bodyweightSlot`. The floor now applies to every
capability-chain slot regardless of declared implement, with the per-chain bar
`m.chainAdvancementReps ?? DEFAULT_ADVANCEMENT_POLICY.requiredReps`; `isPurelyBodyweight` retains
sole control of Option C set routing; deload and off-chain movements keep their phase reps.
`[Source: packages/inference/src/blockGenerator.ts@88f5b5c72271f34df04a88c9817f63a128e8bcdf, lines 765-775]`
`[Source: packages/inference/src/blockGenerator.ts@88f5b5c72271f34df04a88c9817f63a128e8bcdf, lines 847-863]`

**The TDD packet.** Section `[28]` of `verify_blocks.mjs` was extended before the engine change and
proved, against the unmodified engine, four targeted failures caused by the old
`bodyweightSlot ? floor : reps` coupling (external-load floor lost, undeclared floor lost,
custom-policy loaded/unknown floor lost). After the fix the same assertions pass; temporarily
restoring the old coupling reproduced the four failures, and restoring the correct bytes returned
the gate to green. The mutation proof therefore isolates the decoupling as the closing change.
`[Source: packages/inference/test/verify_blocks.mjs@88f5b5c72271f34df04a88c9817f63a128e8bcdf, lines 2070-2085]`

**Disposition.** `OW-036` is moved to the closed register in `MASTER_AUDIT_SYNTHESIS.md` §5.1 with
this evidence. `OW-001` (athlete selection) stays open at `NON_BLOCKING`; C6 and C7 remain open and
owner-gated. The `BLOCKING` release effect recorded for `OW-036` at §1.1 and §4.2 above applied to
the state at `34f91ff` and is discharged for the push-ready candidate.
