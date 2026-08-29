-- =============================================================================
-- 059_suspension_state_and_load_intent.sql
-- Domain: the state the 2026-08-29 owner rulings require, plus the audit-trail
-- immutability 058 claimed but did not enforce.
--
-- Rulings implemented (docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md §6):
--   S5(c) freeze the global macro position AND, when a guided program is
--         active, its program-owned sequence state.
--   S6(b) training continues while suspended, but blocks generated during an
--         episode consume NEITHER frozen state; resume returns to exactly the
--         recorded position.
--   L1(a) constrained — the bodyweight route is taken only on an EXPLICIT
--         prospective per-slot load intent, recorded at block generation.
--         Intent is never derived from dropdown order, taxonomy, equipment
--         ownership, or retrospective set data; missing state fails closed
--         toward the loaded path.
--   M1(a) authorize this migration for immutable suspension history and the
--         state S5/L1 require.
--
-- SIDE-CAR TABLES, NOT ALTER ADD COLUMN. The chain is append-only AND
-- idempotent because the self-heal path re-applies every migration, and
-- `ALTER TABLE ... ADD COLUMN` throws on re-apply. 012_report_severity and
-- 015_set_prefix established this precedent against shipped tables and say so
-- in their headers; 058 is shipped in a QA build and is not editable at all.
--
-- NO NUMERIC VALUE ENTERS THE ENGINE HERE. This migration adds no threshold,
-- duration, coefficient or default dose. Every CHECK bound below mirrors an
-- existing ratified domain: the macro range from 009/058, the sequence range
-- from 033_goal_program.planned_block_count, and the implement vocabulary from
-- MOVEMENT_PREFIXES in packages/inference/src/types.ts.
--
-- Idempotent (IF NOT EXISTS) and append-only, per the migration contract.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- (1) S5(c) — the guided-program position frozen at entry.
--
-- 058's frozen_macro_index is a GLOBAL macro index in 1..8. A guided program's
-- position is not that: it is programMacroIndex(starting_macro_block_index,
-- sequenceIndex), where the sequence index is derived from generated blocks
-- (training_block_program). Freezing the global index alone therefore does
-- nothing for a program, which is exactly the bypass S5 was raised to close.
-- One row per episode, present only when a program was active at entry.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suspension_episode_program (
  episode_id            INTEGER PRIMARY KEY REFERENCES suspension_episode ON DELETE CASCADE,
  program_id            INTEGER NOT NULL REFERENCES training_program ON DELETE CASCADE,
  -- The sequence index the program had consumed at entry. Zero is legal: an
  -- episode may open before the program's first block is generated. The upper
  -- bound mirrors 033's planned_block_count CHECK.
  frozen_sequence_index INTEGER NOT NULL CHECK (frozen_sequence_index BETWEEN 0 AND 8)
) STRICT;

-- ---------------------------------------------------------------------------
-- (2) S6(b) — blocks generated while an episode was open.
--
-- The athlete keeps training while suspended (058's own contract: suspension
-- "does NOT stop training, and it must not"), so blocks keep being minted. What
-- must not happen is that those blocks CONSUME the frozen position: before this
-- table, a block generated during an episode wrote a block_meta row at the
-- frozen index, and after closure nextMacroPosition advanced from it — the
-- athlete was in `volume`, froze `volume`, and resumed in `peak`.
--
-- Attribution rather than duplication: the position readers exclude attributed
-- blocks instead of keeping a second copy of the position that could drift.
-- This is one row per block, so it also answers "which blocks were trained
-- around the injury" for free.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS block_suspension_origin (
  block_id   INTEGER PRIMARY KEY REFERENCES training_block ON DELETE CASCADE,
  episode_id INTEGER NOT NULL REFERENCES suspension_episode ON DELETE CASCADE
) STRICT;

-- Resolving "the last block that consumed a position" is the hot path, read on
-- every macro-position derivation.
CREATE INDEX IF NOT EXISTS ix_block_suspension_origin_episode
  ON block_suspension_origin (episode_id);

-- ---------------------------------------------------------------------------
-- (3) L1(a) — prospective per-slot load intent.
--
-- movement_detail.supported_prefixes is the UI DROPDOWN DOMAIN (010:41-43), not
-- a selection, and movement_taxonomy.implement is a per-MOVEMENT classification.
-- Measured on the live 300-movement corpus the two agree on every row, and both
-- classify `Weighted Pull-up` as bodyweight — because loading is not a property
-- of a movement. It is a per-slot, per-athlete choice, and nothing recorded it.
--
-- This table records it. Absence is meaningful and must stay meaningful: a slot
-- with no row has NO declared intent and fails closed to the loaded path, which
-- is why the column is NOT NULL here rather than nullable with a default.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS planned_slot_load_intent (
  planned_slot_id   INTEGER PRIMARY KEY REFERENCES planned_slot ON DELETE CASCADE,
  -- Mirrors MOVEMENT_PREFIXES (packages/inference/src/types.ts), the same
  -- unified vocabulary 014/015 use. Machine-checked by verify:blocks.
  planned_implement TEXT NOT NULL CHECK (planned_implement IN
                      ('DB', 'BB', 'KB', 'Free Weight', 'Banded', 'Bodyweight',
                       'Cable', 'Earthquake Bar', 'Chains', 'Bottom-Up'))
) STRICT;

-- ---------------------------------------------------------------------------
-- (4) M1(a) — the immutability 058 described but did not enforce.
--
-- 058's header calls the episode model an audit trail. Probed against the real
-- chain, 058 enforced exactly two invariants — one open episode, and no
-- reopening a closed one. started_at_ms, reason and frozen_macro_index were
-- rewritable at any time, a recorded close time could be moved, and a closed
-- episode could be DELETEd outright, erasing the trail entirely.
--
-- The ONLY lifecycle mutation these triggers permit is the one the athlete
-- actually performs: setting ended_at_ms exactly once, NULL -> non-NULL.
-- ---------------------------------------------------------------------------

-- The entry record is written once and never revised. `IS NOT` is null-safe in
-- SQLite, so these compare correctly even when a side is NULL.
CREATE TRIGGER IF NOT EXISTS trg_suspension_episode_immutable_entry_bu
BEFORE UPDATE ON suspension_episode
WHEN NEW.episode_id         IS NOT OLD.episode_id
  OR NEW.started_at_ms      IS NOT OLD.started_at_ms
  OR NEW.reason             IS NOT OLD.reason
  OR NEW.frozen_macro_index IS NOT OLD.frozen_macro_index
BEGIN
  SELECT RAISE(ABORT, 'suspension_episode: the entry record is immutable');
END;

-- A close time is recorded once. 058 already refuses non-NULL -> NULL
-- (reopening); this refuses non-NULL -> a DIFFERENT non-NULL, which would
-- silently restate how long the athlete was suspended.
CREATE TRIGGER IF NOT EXISTS trg_suspension_episode_close_once_bu
BEFORE UPDATE OF ended_at_ms ON suspension_episode
-- NEW.ended_at_ms IS NOT NULL is load-bearing: non-NULL -> NULL is REOPENING,
-- which 058's trg_suspension_episode_no_reopen_bu already refuses with its own
-- message. Without this clause SQLite's unspecified trigger order lets this one
-- fire first and answer a reopen with the wrong reason.
WHEN OLD.ended_at_ms IS NOT NULL
  AND NEW.ended_at_ms IS NOT NULL
  AND NEW.ended_at_ms IS NOT OLD.ended_at_ms
BEGIN
  SELECT RAISE(ABORT, 'suspension_episode: a recorded close time cannot be changed');
END;

-- A closed episode is history and cannot be deleted. An OPEN episode may still
-- be removed: it carries no completed trail, and blocking it would leave a
-- mis-entered suspension with no exit that is not itself a falsified record.
-- Whole-athlete erasure is unaffected — it deletes the database FILE
-- (athleteRegistry), never rows, so no trigger participates.
CREATE TRIGGER IF NOT EXISTS trg_suspension_episode_no_delete_closed_bd
BEFORE DELETE ON suspension_episode
WHEN OLD.ended_at_ms IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'suspension_episode: a closed episode is history and cannot be deleted');
END;

-- The frozen program state belongs to its episode and is equally immutable:
-- rewriting it would move the position the athlete resumes to.
CREATE TRIGGER IF NOT EXISTS trg_suspension_episode_program_immutable_bu
BEFORE UPDATE ON suspension_episode_program
BEGIN
  SELECT RAISE(ABORT, 'suspension_episode_program: the frozen program state is immutable');
END;
