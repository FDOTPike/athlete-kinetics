-- =============================================================================
-- 011_niggle_tracking.sql
-- Phase 12 Step 4: the niggle-severity source. Logs acute joint/muscle pain so
-- the deterministic substitution engine's Layer 3 (orange triage) + injury
-- guardrail have the `severity` input they were written against but had no
-- column to read (injury_flags/mobility_limits carry no severity, and
-- subjective_report has no joint+severity).
--
-- Append-only by usage (the app only INSERTs): one row per report, never
-- mutated — the same discipline as subjective_report. Acuteness is a read-time
-- concern: the store treats only TODAY's rows as "active" niggles.
--
-- CONTRACT MIRROR (machine-checked by verify:blocks [13]):
--   * region CHECK domain  <->  JOINTS in packages/inference/src/substitution.ts
--     (the engine matches a niggle's region against this exact set).
-- =============================================================================
CREATE TABLE IF NOT EXISTS niggle (
  -- App-generated TEXT key (`<reported_at_ms>-<seq>`): no autoincrement rowid,
  -- so the id is meaningful and collision-free across a session.
  id             TEXT PRIMARY KEY,
  -- Structural region — MUST be a member of substitution.ts JOINTS so the
  -- engine's injuredJoints() region match resolves it.
  region         TEXT NOT NULL CHECK (region IN
                   ('knee','hip','ankle','shoulder','elbow','wrist',
                    'lower_back','spine','neck')),
  severity       INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 10),
  reported_at_ms INTEGER NOT NULL
) STRICT;

-- "Today's niggles" is the hot read (a trailing-window scan by report time).
CREATE INDEX IF NOT EXISTS idx_niggle_reported ON niggle (reported_at_ms);
