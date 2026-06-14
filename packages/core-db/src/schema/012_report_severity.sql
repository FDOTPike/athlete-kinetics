-- =============================================================================
-- 012_report_severity.sql
-- Phase 12 Step 5: the athlete-entered 1-10 severity attached to a textual
-- subjective_report. The semantic codebase ROUTES the free text to a guardrail;
-- this severity then GATES that guardrail per the experience-weighted matrix
-- (EXPERIENCE_SEVERITY / applySeverityToGuardrail): below the athlete's
-- triageMin it de-escalates to a no-op (benign), at/above haltMin it forces a
-- halt. Persisted so the pure re-derivation (computePrescription) survives an
-- app restart with the severity intact.
--
-- Side-car (not an ALTER on 005): ALTER ADD COLUMN is not idempotent under the
-- self-heal re-apply path, so the column lives in a 1:1 table keyed on the
-- parent report_id — the 009/010/011 precedent.
-- =============================================================================
CREATE TABLE IF NOT EXISTS report_severity (
  report_id INTEGER PRIMARY KEY REFERENCES subjective_report ON DELETE CASCADE,
  severity  INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 10)
) STRICT;
