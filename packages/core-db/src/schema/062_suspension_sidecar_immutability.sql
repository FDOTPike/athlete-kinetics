-- =============================================================================
-- 062_suspension_sidecar_immutability.sql
-- Domain: finishes the immutable-table contract Migration 059 STATED but only
-- partially enforced. 059 protected the base episode fully and its own
-- frozen-program side-car against UPDATE only; the rest of the mutation surface
-- was left open, and a probe of the real chain proved it.
--
-- WHAT WAS ACTUALLY OPEN (probed at 34f91ff, recorded in
-- docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md §2.1):
--   DELETE suspension_episode_program  -> ALLOWED, no trigger existed
--   UPDATE block_suspension_origin     -> ALLOWED, no trigger existed
--   DELETE block_suspension_origin     -> ALLOWED, no trigger existed
--
-- WHY block_suspension_origin IS THE SHARP ONE. It is the attribution table
-- that makes S6(b) work, and it works by ABSENCE: the position readers exclude
-- attributed blocks (useStore.ts nextMacroPosition) rather than storing a
-- second copy of the position that could drift. Delete or re-point one row and
-- a suspension-era block silently starts consuming a macro position again —
-- which is exactly the P1-1 defect the ruling was raised to close. 059's header
-- says the same about losing the table wholesale; one row is the same failure
-- at row granularity.
--
-- ---------------------------------------------------------------------------
-- WHY THE DELETE GUARDS ARE PARENT-SCOPED, AND WHAT THAT COST. READ BOTH.
-- ---------------------------------------------------------------------------
-- MEASURED, not assumed: an FK `ON DELETE CASCADE` action DOES fire the child's
-- BEFORE DELETE trigger, and this does not depend on PRAGMA recursive_triggers
-- (probed both ways against node:sqlite). An UNCONDITIONAL delete guard would
-- therefore make `training_block`, `training_program` and `suspension_episode`
-- undeletable for as long as any side-car row referenced them — which would
-- abort resetTrainingData outright. So the guard has to distinguish a direct
-- delete from a cascade, and the only thing that distinguishes them is that in
-- a cascade the parent row is ALREADY GONE when the trigger fires. That is
-- exactly 026's `WHEN EXISTS (<parent>)` shape, reused here.
--
-- Both parents are named, not one. These rows have two apiece (episode +
-- program, block + episode), and BOTH parents legitimately carry the row away:
-- resetTrainingData deletes the open episode first and its side-cars must go
-- with it, while training_block / training_program carry off the rest.
--
-- THE COST, AND THE THING THAT MAKES IT SAFE. Naming another table in a trigger
-- makes `ALTER TABLE ... RENAME` fail with "error in trigger <name>: no such
-- table" whenever that table is absent, because a rename re-parses and rewrites
-- the whole schema. 049, 052 and 061 each rename, and every parent here is a
-- SENTINEL — so "absent" is precisely the poisoned-DB state the self-heal
-- exists to repair. Left unhandled, dropping `suspension_episode` would abort
-- the replay at 049, nine migrations before 058 could recreate it, and the
-- database would be permanently unrecoverable. migrationRunner's
-- REPLAY_BLOCKING_TRIGGERS drops these two before a full re-apply and the
-- replay recreates them here; verify:migrations [2ab] proves the round trip.
-- If a future migration adds a cross-table trigger, it belongs on that list.
--
-- SCOPE — WHAT THIS MIGRATION DELIBERATELY DOES NOT DO:
--
--   * NO INSERT is prohibited anywhere. Every one of these tables is written
--     exactly once, at the moment the fact it records comes into existence
--     (beginSuspension, generateNewBlock), and nothing in the ratified contract
--     asks for an insert gate.
--
--   * planned_slot_load_intent is NOT made immutable. The owner decision this
--     migration implements (MASTER_AUDIT_SYNTHESIS.md OW-004) names exactly two
--     tables — block_suspension_origin and suspension_episode_program — and no
--     source document states that a declared load intent is immutable. The
--     opposite is closer to true: OW-001 is still OPEN and its remedy is an
--     athlete-facing per-slot implement selection writing to THIS table, so
--     freezing planned_implement here would pre-empt an owner decision that has
--     not been made. The one protection L1(a) does support directly is applied
--     and no more: an intent may not be MOVED to a slot it was never declared
--     for. "Intent may not be derived from dropdown order, taxonomy, equipment
--     ownership, or retrospective set data" is a rule that only explicit
--     declaration counts, and re-pointing a row's primary key manufactures a
--     declaration for the receiving slot out of nothing. Revising or clearing
--     an intent on its OWN slot stays open, and deleting a row is safe by
--     construction: absence IS the conservative loaded path (059:88-90).
--
--   * NO ruling is made on whether a training-data reset should keep closed
--     episodes (OW-034, still OWNER_ONLY). Nothing here changes what 059
--     permits on suspension_episode itself.
--
-- NO NUMERIC VALUE ENTERS THE ENGINE HERE. No table, column, CHECK, threshold,
-- coefficient or dose is added — this migration is four triggers.
--
-- Idempotent (IF NOT EXISTS) and append-only, per the migration contract.
-- 059 and 061 are shipped and are NOT edited.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- (1) suspension_episode_program — close the DELETE half.
--
-- 059 gave this table trg_suspension_episode_program_immutable_bu, which fires
-- BEFORE UPDATE only. The row it protected from revision could still be removed
-- outright — including for a CLOSED episode whose own row 059 refuses to let
-- anyone delete. Removing it moves the position the athlete resumes to, by
-- deletion instead of by rewrite: the same harm through a second door.
-- ---------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_suspension_episode_program_no_delete_bd
BEFORE DELETE ON suspension_episode_program
WHEN EXISTS (SELECT 1 FROM suspension_episode WHERE episode_id = OLD.episode_id)
 AND EXISTS (SELECT 1 FROM training_program  WHERE program_id = OLD.program_id)
BEGIN
  SELECT RAISE(ABORT, 'suspension_episode_program: the frozen program state cannot be deleted');
END;

-- ---------------------------------------------------------------------------
-- (2) block_suspension_origin — the table had no protection of any kind.
--
-- Both columns ARE the attribution (which block, which episode), so there is no
-- field a legitimate writer would ever revise: the row is written inside
-- generateNewBlock's block transaction and is never touched again.
-- ---------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_block_suspension_origin_immutable_bu
BEFORE UPDATE ON block_suspension_origin
BEGIN
  SELECT RAISE(ABORT, 'block_suspension_origin: the suspension attribution is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_block_suspension_origin_no_delete_bd
BEFORE DELETE ON block_suspension_origin
WHEN EXISTS (SELECT 1 FROM training_block     WHERE block_id   = OLD.block_id)
 AND EXISTS (SELECT 1 FROM suspension_episode WHERE episode_id = OLD.episode_id)
BEGIN
  SELECT RAISE(ABORT, 'block_suspension_origin: the suspension attribution cannot be deleted');
END;

-- ---------------------------------------------------------------------------
-- (3) planned_slot_load_intent — identity only, per the scope note above.
--
-- BEFORE UPDATE OF is not sufficient on its own: SQLite fires it whenever the
-- column appears in the SET clause, even when the value is unchanged. The WHEN
-- clause is what makes this a re-pointing gate rather than a column-name gate,
-- and `IS NOT` is null-safe. It compares NEW to OLD on this row only, so it
-- names no other table and needs no place on REPLAY_BLOCKING_TRIGGERS.
-- planned_implement is deliberately NOT covered.
-- ---------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_planned_slot_load_intent_no_repoint_bu
BEFORE UPDATE OF planned_slot_id ON planned_slot_load_intent
WHEN NEW.planned_slot_id IS NOT OLD.planned_slot_id
BEGIN
  SELECT RAISE(ABORT, 'planned_slot_load_intent: a declared intent belongs to its own slot');
END;
