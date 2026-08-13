-- =============================================================================
-- 054_contract_cutoff_provenance.sql
-- Bounds migration 053's self-heal re-derivation to templates that existed
-- before the curated relationship contract. 053 is shipped and can never be
-- edited, so on every full-chain re-apply (sentinel self-heal) it re-evaluates
-- its NOT EXISTS backfill against LIVE movement_lift_family and
-- movement_assistance_relationship rows. If a future curation migration
-- removes or re-parents one of those rows, 053 would silently grandfather a
-- supplementary selection from a template authored AFTER the contract.
--
-- This migration snapshots the pre-contract cutoff once -- the highest
-- routine_template_id present when it first runs on this install -- and then
-- prunes any allowance 053 re-derived for a template above that watermark.
-- routine_template_id is AUTOINCREMENT, so creation order is monotonic and
-- needs no wall-clock timestamps. The snapshot is one row, inserted with a
-- fixed primary key, so replay and self-heal preserve the original cutoff
-- instead of re-deriving it from whatever templates exist at heal time.
--
-- The production runner treats both this table and its singleton row as one
-- data sentinel. If either is lost after migration, the runner persists a
-- conservative cutoff of zero BEFORE replaying 001 onward. That fail-closed
-- value survives an earlier replay failure and prevents this migration from
-- recapturing the current MAX(id). A frozen planned-slot marker whose source
-- template was already deleted cannot be re-verified and is preserved rather
-- than deleted speculatively.
-- =============================================================================

-- One-row, durable watermark of "authored before the compatibility contract".
-- INSERT OR IGNORE with the fixed PK capture_epoch = 1 makes this a no-op on
-- every ordinary re-application, so the original cutoff survives replay and
-- self-heal. Provenance-loss repair pre-seeds zero, which is also preserved.
CREATE TABLE IF NOT EXISTS routine_template_contract_cutoff (
  cutoff_template_id INTEGER NOT NULL CHECK (cutoff_template_id >= 0),
  capture_epoch       INTEGER PRIMARY KEY CHECK (capture_epoch = 1)
) STRICT, WITHOUT ROWID;

INSERT OR IGNORE INTO routine_template_contract_cutoff (cutoff_template_id, capture_epoch)
SELECT COALESCE(MAX(routine_template_id), 0), 1 FROM routine_template;

-- Prune template-level allowances 053 re-derived for post-contract templates.
-- Idempotent: on every re-apply this removes exactly the same over-reach that
-- 053's backfill re-inserted moments earlier in the same chain. A missing
-- watermark row (COALESCE 0) degrades to "no pre-contract templates exist",
-- never to open-ended grandfathering.
DELETE FROM routine_template_legacy_role_allowance
WHERE routine_template_id > COALESCE(
  (SELECT cutoff_template_id FROM routine_template_contract_cutoff WHERE capture_epoch = 1),
  0
);

-- Prune frozen planned-slot markers reconstructed from a post-contract
-- template's allowance. Only a marker whose source template is still
-- identifiable can be judged; a marker whose source was deleted
-- (routine_template_id IS NULL) may be a legitimate frozen snapshot that must
-- survive source-template deletion, so it is preserved, never deleted.
DELETE FROM planned_slot_legacy_role_allowance
WHERE planned_slot_id IN (
  SELECT pla.planned_slot_id
  FROM planned_slot_legacy_role_allowance pla
  JOIN planned_slot ps ON ps.planned_slot_id = pla.planned_slot_id
  JOIN planned_session sess ON sess.planned_session_id = ps.planned_session_id
  JOIN planned_session_method psm ON psm.planned_session_id = sess.planned_session_id
  WHERE psm.routine_template_id IS NOT NULL
    AND psm.routine_template_id > COALESCE(
      (SELECT cutoff_template_id FROM routine_template_contract_cutoff WHERE capture_epoch = 1),
      0
    )
);

-- The captured boundary is immutable. If either guard is ever missing, the
-- production runner treats provenance as compromised, resets the cutoff to
-- zero before replay, and restores both guards from this migration.
CREATE TRIGGER IF NOT EXISTS trg_routine_template_contract_cutoff_bu
BEFORE UPDATE ON routine_template_contract_cutoff
BEGIN
  SELECT RAISE(ABORT, 'routine template contract cutoff is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_routine_template_contract_cutoff_bd
BEFORE DELETE ON routine_template_contract_cutoff
BEGIN
  SELECT RAISE(ABORT, 'routine template contract cutoff is immutable');
END;
