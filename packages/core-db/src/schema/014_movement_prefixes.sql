-- =============================================================================
-- 014_movement_prefixes.sql
-- Phase 13, Step 1: condition multipliers. The physical implement / loading
-- condition applied to a base movement (Kettlebell, Banded, Earthquake Bar,
-- Chains, Bottom-Up) mathematically amplifies its CNS tax, stability demand,
-- and difficulty. This is the DATA layer for the pure inference utility
-- (inference/src/conditionEngine.ts) — no UI yet.
--
-- UNIFIED VOCABULARY (operator decision, Phase 13 Step 1): prefix_name is a
-- member of the ONE prefix vocabulary already defined in inference/types.ts
-- (MOVEMENT_PREFIXES) and used by movement_detail.supported_prefixes / the
-- Phase 12 implement dropdown. We do NOT introduce a third vocabulary; the new
-- condition tokens (Earthquake Bar / Chains / Bottom-Up) were ADDED to
-- MOVEMENT_PREFIXES, and KB (=Kettlebell) / Banded gain weights here too.
-- Membership is machine-checked by verify:blocks (mirrors the 010
-- supported_prefixes precedent — a TS const can't be a SQL CHECK).
--
-- Additive + idempotent (CREATE IF NOT EXISTS + INSERT OR IGNORE), consistent
-- with the append-only self-healing migration chain. STRICT.
--
-- Modifiers are positive multipliers; 1.0 = neutral (a standard barbell):
--   cns_load_modifier              > 1.0 => higher CNS tax
--   stability_requirement_modifier > 1.0 => more stabilization demanded
--   difficulty_modifier            > 1.0 => harder to control at a given load
-- (difficulty_modifier is included beyond the two modifiers named in the
-- mandate because the mandate prose calls out the "difficulty curve" as a third
-- amplified dimension — flagged in the ledger.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS movement_prefix (
  prefix_name                    TEXT PRIMARY KEY,
  cns_load_modifier              REAL NOT NULL DEFAULT 1.0 CHECK (cns_load_modifier > 0),
  stability_requirement_modifier REAL NOT NULL DEFAULT 1.0 CHECK (stability_requirement_modifier > 0),
  difficulty_modifier            REAL NOT NULL DEFAULT 1.0 CHECK (difficulty_modifier > 0)
) STRICT;

-- Baseline seed (5 conditions). prefix_name values are MOVEMENT_PREFIXES members.
INSERT OR IGNORE INTO movement_prefix
  (prefix_name, cns_load_modifier, stability_requirement_modifier, difficulty_modifier)
VALUES
  ('KB',             1.15, 1.30, 1.10),  -- Kettlebell: offset centre of mass
  ('Banded',         1.10, 1.20, 1.15),  -- accommodating resistance (ascending)
  ('Earthquake Bar', 1.25, 1.60, 1.30),  -- oscillating specialty bar
  ('Chains',         1.20, 1.15, 1.20),  -- accommodating resistance at lockout
  ('Bottom-Up',      1.20, 1.70, 1.25);  -- bottom-up KB: extreme stability/grip
