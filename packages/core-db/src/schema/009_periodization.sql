-- =============================================================================
-- 009_periodization.sql
-- Phase 10: absolute loads, multi-schema periodization metadata, reactive
-- (APRE) load overrides, post-session notes.
--
-- (Mandated as "008"; 008 shipped as the taxonomy scaffold — renumbered.)
--
-- Everything here is ADDITIVE side-car tables: the shipped training_block /
-- planned_slot / session tables cannot gain columns idempotently (ALTER ADD
-- COLUMN fails on self-heal re-apply; a rebuild would cascade-drop planned
-- sessions), so per-row extensions key on the parent's primary key.
--
-- (1) one_rep_max — absolute 1RMs keyed by movement (UI exposes the Big 4:
--     Competition Squat / Competition Bench / Deadlift / Overhead Press).
--     The RPE/rep -> %1RM translation itself is pure TS (packages/inference)
--     — only the athlete's measured maxes are state.
-- (2) block_meta — the block's position in the 32-week macro-cycle
--     (8 blocks x 4 weeks: gpp -> hypertrophy -> volume -> peak) plus the
--     loading schema strategy and the deadlift auto-regulation flag.
--     schema_type values MUST mirror SCHEMA_TYPES in types.ts; macro_phase
--     MUST mirror MACRO_PHASES (machine-checked by verify:blocks).
-- (3) slot_override — APRE reactive mutation target: beating a rep target
--     writes next week's absolute load here, with a human-readable reason
--     the UI surfaces as a badge ("why did my weight change?").
-- (4) session_note — free-text post-session notes (no triage; the
--     subjective_report pipeline is for body-state language).
-- =============================================================================

CREATE TABLE IF NOT EXISTS one_rep_max (
  movement_id   INTEGER PRIMARY KEY REFERENCES movement ON DELETE CASCADE,
  load_kg       REAL NOT NULL CHECK (load_kg >= 20.0 AND load_kg <= 500.0),
  updated_at_ms INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE IF NOT EXISTS block_meta (
  block_id          INTEGER PRIMARY KEY REFERENCES training_block ON DELETE CASCADE,
  macro_block_index INTEGER NOT NULL DEFAULT 1 CHECK (macro_block_index BETWEEN 1 AND 8),
  macro_phase       TEXT NOT NULL DEFAULT 'gpp' CHECK (macro_phase IN
                      ('gpp','hypertrophy','volume','peak')),
  schema_type       TEXT NOT NULL DEFAULT 'LINEAR' CHECK (schema_type IN
                      ('LINEAR','WAVE','STEP','APRE')),
  -- Deadlift auto-regulation: 1 when high ACWR at generation time inserted a
  -- deload week and pushed the peak back (+1 week).
  peak_shifted      INTEGER NOT NULL DEFAULT 0 CHECK (peak_shifted IN (0, 1))
) STRICT;

CREATE TABLE IF NOT EXISTS slot_override (
  planned_slot_id INTEGER PRIMARY KEY REFERENCES planned_slot ON DELETE CASCADE,
  target_load_kg  REAL NOT NULL CHECK (target_load_kg > 0 AND target_load_kg <= 600.0),
  -- Shown verbatim in the UI: the athlete must always know WHY the load moved.
  reason          TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 200),
  created_at_ms   INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE IF NOT EXISTS session_note (
  session_id    INTEGER PRIMARY KEY REFERENCES session ON DELETE CASCADE,
  note          TEXT NOT NULL CHECK (length(note) BETWEEN 1 AND 1000),
  created_at_ms INTEGER NOT NULL DEFAULT 0
) STRICT;
