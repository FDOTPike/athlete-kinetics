-- 050_movement_role_convergence.sql
--
-- Migration 028 declares supplementary eligibility deliberately broad: every
-- live movement may fill a supplementary slot, while major and conditional
-- roles remain explicit allowlists. Phase 2a added 176 movements after 028, so
-- a fresh chain left those rows unseeded while a poisoned-database replay of
-- 028 (against all 300 movements) did not. Reassert the declared policy after
-- the complete library and keep future additive movement batches convergent.

INSERT OR IGNORE INTO movement_role_eligibility (movement_id, role)
SELECT movement_id, 'supplementary' FROM movement;

CREATE TRIGGER IF NOT EXISTS trg_movement_supplementary_ai
AFTER INSERT ON movement
BEGIN
  INSERT OR IGNORE INTO movement_role_eligibility (movement_id, role)
  VALUES (NEW.movement_id, 'supplementary');
END;
