# Post-Merge State C Data-Integrity Remediation — Handback

**Branch:** `claude/state-c-data-integrity-remediation`
**Base:** `3ec532d6082e4ad96470c413a3365dc7f531a765` (the PR #8 merge commit on
`codex/rpe-familiarisation`)
**Worktree:** `.worktrees/state-c-data-integrity-remediation`
**Date:** 2026-09-09
**Scope:** implementation and a DRAFT PR only. Nothing merged, tagged, published
or released. `.worktrees/rpe-familiarisation` was never written to.

---

## 1. What this closes

Two of the three P1s left open by the PR #8 merge. The third — the athlete-facing
per-slot implement selection (`OW-001`) — is **NOT STARTED** and is untouched
here.

| Finding | Source | Status after this branch |
|---|---|---|
| Reset lifecycle gap | `AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md` §1.2, `MASTER_AUDIT_SYNTHESIS.md` `OW-002` | **RESOLVED** |
| 059 immutability surface + behaviour coverage | `AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md` §2.1, `MASTER_AUDIT_SYNTHESIS.md` `OW-004` | **RESOLVED** |
| Per-slot implement selection | `MASTER_AUDIT_SYNTHESIS.md` `OW-001` | NOT STARTED |

---

## 2. P1 — reset and athlete switching

### Root cause

**(a) `PER_ATHLETE_RESET` omitted `suspension`.** It cleared every other
per-athlete surface. `boot()` ends with `refreshSuspension()`, so a *completed*
Coach Mode swap re-hydrated the value and looked correct. Two windows were left
open: the interval between the `set()` and that call, during which
`activeAthleteId` is already athlete B while `suspension` still holds athlete
A's episode; and any boot that fails before reaching it, which leaves A's
episode resident permanently.

**(b) `resetTrainingData` deleted no suspension row and refreshed no suspension
state.** Its 49 `DELETE` statements named none of the three suspension tables,
and the five post-reset refresh calls did not include `refreshSuspension()`.
Because `nextMacroPosition` short-circuits to the frozen index for as long as an
episode is open, a wipe left the athlete **still suspended at a frozen macro
index whose entire block history no longer existed** — and every block minted
afterwards was pinned to that same index. The reset was frozen permanently, in
the database and in memory.

### Fix

- `PER_ATHLETE_RESET` now clears `suspension`, so a failed boot degrades to "no
  suspension" rather than "athlete B wearing athlete A's episode".
- `resetTrainingData` deletes **only the open episode**
  (`DELETE FROM suspension_episode WHERE ended_at_ms IS NULL`), placed before the
  `training_program` / `training_block` deletes so that episode's 059 side-cars
  cascade from their own episode.
- The 059 side-cars are cleared **after** their parents, following the same
  parent-first rule `set_dose_target` and `session_outcome` already use.
- `suspension: null` in the post-reset `set()`, and `refreshSuspension()` added
  to the refresh list, so memory is re-read from the wiped file.

### Two things deliberately NOT done

A blanket `DELETE FROM suspension_episode` **is not the fix**: 059's
`trg_suspension_episode_no_delete_closed_bd` aborts on the first closed row, and
inside the reset's single transaction that abort rolls the entire wipe back.

Whether a training-data wipe should keep closed episodes at all is
`OW-034`, still `OWNER_ONLY`, and is **not answered here**. Closed episodes
survive, and a test asserts that.

### Why the FK-OFF cleanup pass is not decoration

With foreign keys ON the parent cascades have already emptied both side-cars, so
those two statements are no-ops. They exist for the FK-OFF path, and the hazard
there is specific: `training_block` reuses rowids once the table is empty, so a
surviving `block_suspension_origin` row would attribute a **brand new post-reset
block** to a deleted episode and hide it from `nextMacroPosition` for good.

---

## 3. P1 — Migration 062

### Root cause

059 protected the base episode completely and its own frozen-program side-car
against `UPDATE` only. Three mutations remained allowed on the shipped chain:

| Operation | Before 062 |
|---|---|
| `DELETE suspension_episode_program` | ALLOWED — no trigger existed |
| `UPDATE block_suspension_origin` | ALLOWED — no trigger existed |
| `DELETE block_suspension_origin` | ALLOWED — no trigger existed |

`block_suspension_origin` is the sharp one. It is the attribution table that
makes S6(b) work, and it works by **absence**: the position readers exclude
attributed blocks rather than storing a second copy of the position. Delete or
re-point one row and a suspension-era block silently starts consuming a macro
position again — the exact P1-1 defect the ruling was raised to close.

Separately, **no test exercised any 059 trigger at all**. Sentinel registration
proves an object is present and restorable, not that it refuses anything.

### Fix — migration 062, four triggers, no table and no number

| Trigger | Effect |
|---|---|
| `trg_suspension_episode_program_no_delete_bd` | refuses a direct DELETE while both parents live |
| `trg_block_suspension_origin_immutable_bu` | refuses any UPDATE (both columns *are* the attribution) |
| `trg_block_suspension_origin_no_delete_bd` | refuses a direct DELETE while both parents live |
| `trg_planned_slot_load_intent_no_repoint_bu` | refuses moving an intent to a different slot |

**Migration number 062, array index 60, `user_version` 61.** Appended, never
spliced. 059 and 061 are untouched.

### `planned_slot_load_intent` is deliberately NOT made immutable

`OW-004` names exactly two tables, and **no source document states that a
declared load intent is immutable**. The opposite is closer to true: `OW-001` is
still open and its remedy is an athlete-facing per-slot implement selection
writing to this very table, so freezing `planned_implement` would pre-empt an
owner decision that has not been made.

Only the protection L1(a) supports directly is applied — an intent may not be
**moved** to a slot it was never declared for, because re-pointing a primary key
manufactures a declaration for the receiving slot out of nothing, and L1(a)'s
rule is that only explicit declaration counts. Revising or clearing an intent on
its **own** slot stays open, and deletion is safe by construction: absence *is*
the conservative loaded path.

**Owner item to rule on:** whether a declared `planned_implement` should become
immutable once its slot has been trained. That is a live question the moment
`OW-001` lands, and it is not answered here.

### Two measured facts that shaped the design

Both were established by direct probe, not by reasoning, and both changed the
implementation:

1. **An FK `ON DELETE CASCADE` action DOES fire the child's `BEFORE DELETE`
   trigger, independently of `PRAGMA recursive_triggers`.** An unconditional
   delete guard would therefore have made `training_block`, `training_program`
   and `suspension_episode` undeletable for as long as any side-car row
   referenced them, aborting `resetTrainingData` outright. The guards
   consequently use 026's `WHEN EXISTS (<parent>)` shape, naming **both**
   parents because either one legitimately carries the row away.

2. **Naming another table in a trigger makes `ALTER TABLE ... RENAME` fail** with
   `error in trigger <name>: no such table` while that table is absent, because
   a rename re-parses and rewrites the entire schema. 049, 052 and 061 each
   rename, and every parent here is a **SENTINEL** — so "absent" is precisely
   the poisoned-DB state the self-heal exists to repair.

   Left unhandled this was serious: dropping `suspension_episode` aborted the
   replay at 049, **nine migrations before 058 could recreate it**, turning a
   recoverable database into a permanently unrecoverable one. `migrationRunner`
   now drops `REPLAY_BLOCKING_TRIGGERS` before a full re-apply, and the replay
   recreates them from 062. The round trip is asserted for all three parents.

### Correction: 026 is NOT exposed — the rule is positional

The first version of this document, and the comments shipped in `062` and
`migrationRunner.ts`, claimed that 026's `trg_set_dose_target_bd` and
`trg_session_outcome_bd` shared this exposure because they have the same
cross-table shape. **That was wrong**, and it was corrected in the follow-up
branch after being measured rather than reasoned about.

The exposure is decided by ONE thing: whether a self-heal replay — which starts
at chain position 0 — recreates the referenced table **before** it reaches the
earliest `ALTER TABLE ... RENAME` at position 48.

| Referenced table | Created by | Position | Exposed? |
|---|---|---|---|
| `set_record`, `session` | 001 | 1 | No — recreated long before the rename |
| `planned_slot`, `training_block` | 007 | 7 | No |
| `training_program` | 033 | 33 | No |
| `suspension_episode` | 058 | **57** | **Yes — after the rename** |

So only the two 062 triggers naming `suspension_episode` are replay-blocking,
and `REPLAY_BLOCKING_TRIGGERS` was already correct; what was wrong was the
stated reason. Shape is not the criterion — position is. Both sides are now
pinned behaviourally in `verify:migrations` `[2ab]`: dropping
`suspension_episode` requires the list, and dropping `set_record` or `session`
does not (the replay completes and 026's own refusals come back).

A future cross-table trigger belongs on that list only if the table it names is
created after position 48.

---

## 4. Coverage added

- `apps/mobile/test/components/SuspensionResetAndSwitch.test.js` — 9 tests. Boots
  the real store against the real migration chain and extends the existing
  harness by keying the DB seam **on file name**, so Coach Mode's
  one-database-per-athlete model is genuinely exercised rather than every
  athlete sharing one in-memory database.
- `verify_migrations.mjs` `[2ab]` — fresh install, upgrade from the shipped
  pre-062 state (with a precondition proving the gap was real), refusal and
  permission for every table in the contract, row preservation after a refused
  mutation, cascade and parentless-cleanup behaviour, self-heal per trigger
  asserted through **behaviour** rather than presence, the three-parent replay
  round trip, and the array index. Plus the first behavioural coverage of 059's
  own four triggers.
- `verify_store_sql.mjs` — the reset's delete ordering is now enforced by the
  database, not by convention: 062 is in that verifier's chain, so an ordering
  regression that named a side-car before its parents aborts the probe.

### A harness defect found and fixed in passing

`useStore` takes a **static** `import { loadRegistry, saveRegistry } from
'./athleteRegistry'`, so a `jest.mock` issued from inside `beforeEach` binds
after the real module has already resolved and is **silently inert**. The
existing component tests pass regardless because the real loader falls back to a
default single-athlete registry, which happens to be what they want. Any
multi-athlete test needs the mock hoisted to module scope; the new file does
that and says why.

---

## 5. Verification

See the PR body and `PROMPT_LEDGER.md` Entry 0097 for the full gate totals,
the clean pre-change baseline at `3ec532d`, and the mutation matrix.

Note for reviewers reading raw gate output: `verify:qa-artifact` prints
`N QA ARTIFACT CHECK(S) FAILED` lines **by design**. They come from
`tools/test_verify_qa_artifact.mjs`, the meta-test that feeds deliberately
broken fixtures to the artifact verifier and asserts it rejects them. They are
negative controls; the enclosing gate exits 0.

---

## 6. What remains open

- `OW-001` — per-slot implement selection. **NOT STARTED.**
- `OW-034` — whether a training-data reset should preserve closed episodes.
  `OWNER_ONLY`, unanswered.
- Whether a declared `planned_implement` becomes immutable once trained (new,
  raised by §3 above). `OWNER_ONLY`.
- ~~026's cross-table trigger exposure~~ — **withdrawn**: measured and shown not
  to exist. See the correction in §3; the criterion is chain position, not
  trigger shape.
- C6 physical-device memory qualification and the W8 live-emulator
  qualification remain mandatory for release and are untouched here.
  `verify:release` still cannot pass while `verify:memory-contract` exits 1.

**This branch is data-integrity remediation, not release readiness.**
