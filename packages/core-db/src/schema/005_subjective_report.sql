-- =============================================================================
-- 005_subjective_report.sql
-- Subjective athlete reports routed by the Vector-Heuristic triage. Stores
-- the raw text alongside the routing outcome and the guardrail actually
-- applied, so pain/fatigue history becomes longitudinal data (and rejected
-- reports are kept for codebase curation).
-- =============================================================================
CREATE TABLE IF NOT EXISTS subjective_report (
  report_id        INTEGER PRIMARY KEY,
  date             TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  reported_at_ms   INTEGER NOT NULL,
  raw_text         TEXT NOT NULL CHECK (length(raw_text) BETWEEN 1 AND 500),
  -- NULL = rejected by the confidence gate (no guardrail applied).
  matched_entry_id TEXT,
  similarity       REAL CHECK (similarity IS NULL OR similarity BETWEEN -1.0 AND 1.0),
  halt             INTEGER NOT NULL DEFAULT 0 CHECK (halt IN (0, 1)),
  -- The applied (post-composition) adjustment, for audit/history:
  load_modifier    REAL CHECK (load_modifier IS NULL OR load_modifier BETWEEN 0 AND 1.1),
  set_modifier     INTEGER CHECK (set_modifier IS NULL OR set_modifier BETWEEN -3 AND 1),
  rpe_cap          REAL CHECK (rpe_cap IS NULL OR rpe_cap BETWEEN 0 AND 10)
) STRICT;

-- History reads are by day (today's reports) or trailing windows.
CREATE INDEX IF NOT EXISTS idx_subjective_date ON subjective_report (date);
