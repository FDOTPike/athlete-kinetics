-- =============================================================================
-- 015_set_prefix.sql
-- Phase 13, Step 2: historical persistence of the condition prefixes applied to
-- a logged set, plus their compound multipliers and the resulting effective load.
--
-- WHY A SIDE-CAR (not columns on set_record): set_record (001) is shipped and the
-- chain is append-only + idempotent (self-heal re-applies every migration), so
-- ALTER ADD COLUMN is not viable (it throws on re-apply). This mirrors the
-- 009/010 precedent (slot_override / one_rep_max / movement_detail): a 1:1
-- side-car keyed on the parent PK, FK-cascaded so a set/session delete cleans up.
--
-- CONSERVATION OF VOLUME: the EFFECTIVE load (base x difficulty product) and the
-- compound cns/stability/difficulty multipliers are stored PER SET, so effective
-- volume is fully trackable over time. The raw-tonnage rollup mech_daily (which
-- feeds ACWR -> readiness) is DELIBERATELY left untouched — changing what the
-- readiness pipeline sees would be a separate, higher-risk decision, not made
-- here. effective_load_kg is the recoverable signal for any future analysis.
--
-- Additive + idempotent + STRICT. Multipliers are positive (1.0 = neutral).
-- =============================================================================

CREATE TABLE IF NOT EXISTS set_prefix (
  set_id                         INTEGER PRIMARY KEY REFERENCES set_record ON DELETE CASCADE,
  -- JSON array of MOVEMENT_PREFIXES tokens applied to the set (e.g. '["KB"]').
  applied_prefixes               TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(applied_prefixes)),
  cns_load_modifier              REAL NOT NULL DEFAULT 1.0 CHECK (cns_load_modifier > 0),
  stability_requirement_modifier REAL NOT NULL DEFAULT 1.0 CHECK (stability_requirement_modifier > 0),
  difficulty_modifier            REAL NOT NULL DEFAULT 1.0 CHECK (difficulty_modifier > 0),
  effective_load_kg              REAL NOT NULL CHECK (effective_load_kg >= 0)
) STRICT;
