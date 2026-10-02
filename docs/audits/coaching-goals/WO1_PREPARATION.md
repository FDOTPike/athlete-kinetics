# Work order 1 — preparation on every live session path

Audit, fix and validation record. 2026-10-02, Claude Opus 5.5 in Claude Code
Desktop. Baseline and prerequisite strategy: [BASELINE.md](BASELINE.md).
Sources and doses: [../../coaching/PREPARATION_PROVENANCE.md](../../coaching/PREPARATION_PROVENANCE.md).

## What was found

| # | Finding in the baseline | Where |
| --- | --- | --- |
| 1 | No preparation existed on any path. A session went from Start straight to its first working set. | `useStore.startSession` |
| 2 | An empty free-form session started with its runner already `complete`, so nothing stood between Start and logging. | `sessionRunner.startRunner` |
| 3 | Three planners each had a private duration law and none counted preparation. The block generator repeated `clamp(round(cap / 22), 2, 5)` three times; its lower clamp promised two 22-minute movements to a 15-minute session. | `blockGenerator`, `routineMicrocycle`, `routineComposer`, plus a fourth copy inline in `RoutineTemplateBuilder` |
| 4 | The backup contract accepted exactly one schema. The first new migration would have made every existing backup and retained recovery copy unrestorable — and would also have blocked backing up any athlete file not yet opened since the update. | `schemaContract.ts`, `contract.ts`, `backupStore.ts` |
| 5 | `session.session_id` is reused after a reset, so a side-car keyed only by session id and a revision could be inherited by a later session. | `001`, `resetTrainingData` |

## What was built

**Preparation policy** (`packages/inference/src/preparationPolicy.ts`, pure and
versioned: `ramp-general` revision 1). Raise, mobilise, activate, rehearse,
ramp. Tailored to the session's movement patterns, whether the first movement
is loaded, the time available, active niggles, sport context and readiness.
Every dose cites its source; nothing is prescribed from a title. Movements 135
and 187 are never used for a drill. Every item that is left out is listed with
its reason.

**Side-car** (`065_session_preparation.sql`). `session_preparation` holds the
frozen protocol and its outcome; `session_preparation_item` holds what was
prescribed and what was actually performed for each item. Five triggers make
the important properties structural: a protocol can only be created for a live
session; the frozen protocol and each prescribed item are immutable; every
write advances the revision by exactly one; an outcome is final; item records
close with their protocol. The four runner phases are unchanged.

**Store.** The protocol is built from the same frozen plan and the same gates as
the main work and inserted in the start transaction, so no live path can start
a session without one. Writes are compare-and-set on
`(session, instance, revision)` and must still be bound to the session's own
start time. `logSet` refuses while the protocol is open, reading the database
rather than the screen's copy. Halting records `stopped`. Discard and reset
delete the rows explicitly (foreign keys may be off). Restart reads the same
protocol back.

**Truthful outcomes.** *Completed* only when every item was done as written;
*modified* when anything was changed, substituted, skipped or withheld;
*already warm*; *skipped*; *stopped*. The athlete never picks completed or
modified — the store derives it. Work recorded well beyond the written dose is
flagged as extra work and shown on the completion screen. Preparation never
writes `set_record`.

**One session-time contract** (`sessionTimeBudget.ts`). Preparation is reserved
first and never below five minutes; rest is the runner's own prescription;
changeovers are explicit. All three planners use it. Repair order everywhere:
condense preparation to the floor, trim or shed the lowest-priority work down
to each planner's existing minimum, then report the conflict with feasible
options. The routine planners keep their previous role allowances as per-row
minimums, so no day that was refused before is now accepted. A frozen plan is
never rewritten: its overage is stated in the protocol.

**Backup.** A registry of exact schema contracts replaces the single pinned
one. A v63 archive or retained recovery copy is validated against the v63
fingerprint, staged as an isolated copy, forward-migrated there by the
production migration chain, required to match the current fingerprint exactly,
and only then installed through the existing journalled replacement. Unknown,
future or mismatched schemas fail closed before any bytes are decoded. A backup
of an athlete file still at v63 migrates the snapshot copy, not the live file.

## Decisions that are not obvious

- **Why the outcome screen can say "Preparation: not recorded."** Sessions that
  finished before 065, imported sessions and demo sessions have no preparation
  record and are never given one. Saying so is the truthful reading.
- **Why a session in progress during the update is not gated.** It has no
  protocol, and inventing one on resume would be a fabricated record.
- **Why short sessions changed.** A 15- or 30-minute session now carries one
  movement, not two. `verify_programQualityRound2 [P3]` pinned the old value
  and was re-pinned deliberately; at 15 minutes a three-day strength plan now
  reaches two of the three anchor roles and the setup screen says so. From 45
  minutes up, the stepper values keep their existing movement count.
- **Why extra preparation work is flagged, not converted into sets.** Turning a
  warm-up entry into a `set_record` row would invent training history. It is
  shown for what it is.
- **Why the item list closes unrecorded items as skipped** when the athlete
  finishes or skips, but not for *already warm* or *stopped*: in those two
  cases nothing is known about the unrecorded items.

## Validation

Gates (exit codes from the final integrated run are in the pull request):

| Gate | Result |
| --- | --- |
| `verify:preparation` (new) | 100 checks: session-time contract and all three planners (50), preparation policy (50) |
| `verify:migrations` | passes with 34 new 065 checks: upgrade from the 064 schema, every guard, reused id, self-heal of each table and trigger, replay with a surviving cross-table trigger |
| `verify:backup` | passes with the v63 and v64 contracts, fail-closed archive validation |
| `SessionPreparation.test.js` (new) | 37 tests on the real store |
| `SessionPreparationScreen.test.js` (new) | 7 tests of the real screen and store |
| `PreparationPanel.test.js` (new) | 12 tests including accessibility |
| `BackupForwardRestore.test.js` (new) | 11 tests on real SQLite files |

Negative controls. Fifteen mutations each removed one fix and ran the gate
meant to notice (`scripts/coaching/negative-controls-wo1.mjs`; results in [evidence/WO1_NEGATIVE_CONTROLS.md](evidence/WO1_NEGATIVE_CONTROLS.md)). Covered:
the `logSet` gate; creation in the start transaction; the instance id in the
compare-and-set; clearing a stale protocol under a reused id; stopping on halt;
the execution-time recheck; reset cleanup; the 135/187 hold; the block
generator's movement-count law; preparation reservation in both routine
planners; the replay-blocking trigger; the live-session guard; staged-copy
schema validation; and current-schema validation after migration.

Existing tests changed on purpose, and why:

| Test | Change |
| --- | --- |
| `SessionAccessBoundary`, `TrainingSupportBoundary`, `TrainingSupportEvidenceIdentity` | Their helpers start a session and log a set immediately. They now record preparation as *already warm* first; the gate itself is tested separately. |
| `KeyboardLayout` | Text-input count 31 to 32 for the panel's "exercise you did instead" field, which carries the required `disableFullscreenUI`. |
| `verify_migrations`, `verify_blocks`, `verify_pipeline`, `verify_backup_contract`, `verify_store_sql` | Deliberate version pins moved from 63 entries / 104 tables / 22 gates to 64 / 106 / 23 on the published base (24 to 25 gates on the development lineage; see BASELINE.md). |
| `verify_programQualityRound2 [P3]` | 15-minute anchor capacity 3 to 2, with a new 45-minute check. |

No existing routine or pipeline assertion had to be loosened.

## Not done here, and why

- Native-device memory acceptance is a separate lane; nothing here is evidence
  for it.
- The preparation panel has no movement animation of its own. Rehearsal and
  ramp items name a session movement; the preview for that movement is the
  animation lane's.
- Sport-specific preparation (for example a Muay Thai or football warm-up) is
  added with sport selection in work order 3; this policy is the general one.
