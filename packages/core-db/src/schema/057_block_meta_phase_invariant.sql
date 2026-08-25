-- =============================================================================
-- 057_block_meta_phase_invariant.sql
-- DB-BLOCK-META-DRIFT (P2): repair + prevent block_meta macro_phase/index drift.
--
-- Field capture: (block_id=2, macro_block_index=3, macro_phase='volume') while
-- the production mapping (macroPhaseOf, machine-checked against MACRO_PHASES by
-- verify:blocks) requires index 3 -> 'hypertrophy'. The mapping is two 4-week
-- blocks per phase over the fixed 8-block cycle:
--     1-2 gpp | 3-4 hypertrophy | 5-6 volume | 7-8 peak
--
-- This migration:
--   1. repairs every persisted mismatch deterministically from
--      macro_block_index (the derived column follows its index; nothing else
--      about a row is touched);
--   2. installs fail-closed triggers so a future phase/index mismatch is
--      rejected at the database boundary instead of surfacing as silent
--      training-history corruption;
--   3. stays idempotent and self-heal safe: re-applying it after repair finds
--      zero mismatched rows and CREATE TRIGGER IF NOT EXISTS is a no-op.
--
-- Deliberately NOT changed: macro-cycle duration, phase order, block
-- generation, WAVE behavior, or any historical training meaning beyond the
-- inconsistent derived phase. block_id / macro_block_index / schema_type /
-- peak_shifted and all parent/dependent rows are preserved untouched.
-- =============================================================================

-- [1] Deterministic repair from macro_block_index.
UPDATE block_meta SET macro_phase = CASE
  WHEN macro_block_index BETWEEN 1 AND 2 THEN 'gpp'
  WHEN macro_block_index BETWEEN 3 AND 4 THEN 'hypertrophy'
  WHEN macro_block_index BETWEEN 5 AND 6 THEN 'volume'
  ELSE 'peak'
END
WHERE macro_phase <> CASE
  WHEN macro_block_index BETWEEN 1 AND 2 THEN 'gpp'
  WHEN macro_block_index BETWEEN 3 AND 4 THEN 'hypertrophy'
  WHEN macro_block_index BETWEEN 5 AND 6 THEN 'volume'
  ELSE 'peak'
END;

-- [2] Fail-closed boundary enforcement. The CHECK on 009 constrains the value
-- domain only; these triggers constrain the index->phase MAPPING.
CREATE TRIGGER IF NOT EXISTS trg_block_meta_phase_bi
BEFORE INSERT ON block_meta
WHEN NEW.macro_phase <> CASE
  WHEN NEW.macro_block_index BETWEEN 1 AND 2 THEN 'gpp'
  WHEN NEW.macro_block_index BETWEEN 3 AND 4 THEN 'hypertrophy'
  WHEN NEW.macro_block_index BETWEEN 5 AND 6 THEN 'volume'
  ELSE 'peak'
END
BEGIN
  SELECT RAISE(ABORT,
    'block_meta macro_phase does not match macro_block_index (1-2 gpp, 3-4 hypertrophy, 5-6 volume, 7-8 peak)');
END;

CREATE TRIGGER IF NOT EXISTS trg_block_meta_phase_bu
BEFORE UPDATE ON block_meta
WHEN NEW.macro_phase <> CASE
  WHEN NEW.macro_block_index BETWEEN 1 AND 2 THEN 'gpp'
  WHEN NEW.macro_block_index BETWEEN 3 AND 4 THEN 'hypertrophy'
  WHEN NEW.macro_block_index BETWEEN 5 AND 6 THEN 'volume'
  ELSE 'peak'
END
BEGIN
  SELECT RAISE(ABORT,
    'block_meta macro_phase does not match macro_block_index (1-2 gpp, 3-4 hypertrophy, 5-6 volume, 7-8 peak)');
END;
