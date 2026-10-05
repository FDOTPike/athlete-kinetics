-- =============================================================================
-- 063_movement_load_intent.sql
-- Domain: the athlete's EXPLICIT, PROSPECTIVE declaration of how they load an
-- ambiguous movement. Closes OW-001, the unimplemented half of L1(a).
--
-- Ruling implemented (docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md §6, owner
-- ratification re-confirmed 2026-09-09):
--   L1(a) constrained — persist explicit PROSPECTIVE per-slot load
--         intent/implement at block generation. Ambiguous mixed movements
--         REQUIRE ATHLETE SELECTION. Missing legacy state fails closed toward
--         the conservative loaded path. Intent may NOT be derived from dropdown
--         order, taxonomy, equipment ownership, or retrospective set data.
--
-- 059 gave the per-slot RECORD (planned_slot_load_intent) and the fail-closed
-- read. What it never had was a way for the athlete to actually declare
-- anything: the store wrote a row only when a movement had exactly ONE
-- supported prefix, so the 17 genuinely ambiguous movements on the shipped
-- 300-movement corpus were permanently undeclared and permanently loaded. This
-- table is the missing declaration.
--
-- ---------------------------------------------------------------------------
-- WHY THE DECLARATION IS PER MOVEMENT WHILE THE RECORD STAYS PER SLOT
-- ---------------------------------------------------------------------------
-- Owner-selected 2026-09-09, from a fork the ratified text does not resolve.
-- The constraint that forces it is in the engine, not in taste:
-- `isStrictlyBodyweight` (movementRanking.ts) orders the loaded and anchor
-- pools, so a declaration changes WHICH movement the ranker picks, not merely
-- how that slot is dosed. A post-generation per-slot editor would therefore be
-- able to replace the very slot being edited, and would make a block
-- irreproducible from its recorded inputs — breaking the generator's
-- determinism law. Slots also do not exist before generation, so a literal
-- per-slot choice has nothing to attach to at the only moment the ruling names.
--
-- So: the athlete declares per movement, BEFORE generation; generation resolves
-- that declaration into the per-slot planned_slot_load_intent row that L1(a)
-- requires. Both halves of the ruling hold — the choice is explicit and
-- prospective, and the record is per slot.
--
-- A useful consequence: planned_slot_load_intent is now written exactly once
-- per slot and never revised, because revision happens HERE and affects only
-- FUTURE blocks. Changing your mind never rewrites what you already trained.
-- That is also why the deferred owner question — whether a declared
-- planned_implement should freeze once its slot has been trained — stays
-- deferred without blocking anything: nothing writes that row twice.
--
-- NOT DERIVATION. Every prohibited source stays prohibited. This table holds
-- only what the athlete explicitly chose:
--   * dropdown order — the store's sole-supported-prefix rule is untouched and
--     applies ONLY when there is exactly one option, where there is no choice
--     to make; element zero of a multi-member list is still never taken;
--   * taxonomy — movement_taxonomy.implement is not read here;
--   * equipment ownership — owning dumbbells still does not declare intent, and
--     the equipment filter is applied to WHICH movements are offered, never to
--     what the answer is;
--   * retrospective set data — set_record and set_prefix are not read here, and
--     this table is written before the training it describes.
--
-- NO NUMERIC VALUE ENTERS THE ENGINE HERE. No threshold, coefficient, dose or
-- default. An undeclared ambiguous movement remains undeclared and still fails
-- closed to the loaded path exactly as before; nothing is defaulted on the
-- athlete's behalf.
--
-- Idempotent (IF NOT EXISTS) and append-only, per the migration contract.
-- =============================================================================

CREATE TABLE IF NOT EXISTS movement_load_intent (
  movement_id       INTEGER PRIMARY KEY REFERENCES movement ON DELETE CASCADE,
  -- Mirrors MOVEMENT_PREFIXES (packages/inference/src/types.ts) and the 059
  -- planned_slot_load_intent domain exactly — one vocabulary, machine-checked
  -- by verify:blocks.
  planned_implement TEXT NOT NULL CHECK (planned_implement IN
                      ('DB', 'BB', 'KB', 'Free Weight', 'Banded', 'Bodyweight',
                       'Cable', 'Earthquake Bar', 'Chains', 'Bottom-Up')),
  -- Provenance, not a dose input. Nothing reads this to decide anything; it
  -- exists so a declaration can be shown as "you chose this, on this date".
  declared_at_ms    INTEGER NOT NULL CHECK (declared_at_ms > 0)
) STRICT;

-- ---------------------------------------------------------------------------
-- A declaration must be one of the movement's OWN supported implements.
--
-- Without this, an athlete (or a future caller) could declare 'BB' for a
-- movement that has no barbell variant, and generation would then route a slot
-- on an implement the movement does not support. The CHECK above can only
-- police the vocabulary; only a trigger can police the pairing.
--
-- This names movement_detail, created by 010 at chain position 10 — well before
-- the earliest ALTER TABLE ... RENAME at position 48 — so a self-heal replay
-- recreates it in time and this trigger does NOT belong on migrationRunner's
-- REPLAY_BLOCKING_TRIGGERS. See 062's header for why that distinction matters.
-- ---------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_movement_load_intent_supported_bi
BEFORE INSERT ON movement_load_intent
WHEN NOT EXISTS (
  SELECT 1 FROM movement_detail d
   WHERE d.movement_id = NEW.movement_id
     AND EXISTS (SELECT 1 FROM json_each(d.supported_prefixes) j
                  WHERE j.value = NEW.planned_implement)
)
BEGIN
  SELECT RAISE(ABORT, 'movement_load_intent: that implement is not supported by this movement');
END;

CREATE TRIGGER IF NOT EXISTS trg_movement_load_intent_supported_bu
BEFORE UPDATE OF planned_implement ON movement_load_intent
WHEN NOT EXISTS (
  SELECT 1 FROM movement_detail d
   WHERE d.movement_id = NEW.movement_id
     AND EXISTS (SELECT 1 FROM json_each(d.supported_prefixes) j
                  WHERE j.value = NEW.planned_implement)
)
BEGIN
  SELECT RAISE(ABORT, 'movement_load_intent: that implement is not supported by this movement');
END;
