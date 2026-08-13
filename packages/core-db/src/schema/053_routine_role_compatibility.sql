-- =============================================================================
-- 053_routine_role_compatibility.sql
-- Exact, athlete-local compatibility for pre-052 supplementary selections.
-- This does not restore blanket role eligibility or invent assistance edges.
-- =============================================================================

CREATE TABLE IF NOT EXISTS routine_template_legacy_role_allowance (
  routine_template_id INTEGER NOT NULL REFERENCES routine_template ON DELETE CASCADE,
  day_index           INTEGER NOT NULL CHECK (day_index BETWEEN 1 AND 7),
  movement_id         INTEGER NOT NULL REFERENCES movement ON DELETE RESTRICT,
  role                TEXT NOT NULL CHECK (role = 'supplementary'),
  PRIMARY KEY (routine_template_id, day_index, movement_id, role)
) STRICT, WITHOUT ROWID;

-- A pre-052 supplementary choice is already valid under the current contract
-- when it is same-family work or distance-1 assistance for at least one major
-- on that day. Snapshot only the remaining exact selections; do not add them
-- to movement_role_eligibility or movement_assistance_relationship.
INSERT OR IGNORE INTO routine_template_legacy_role_allowance
  (routine_template_id, day_index, movement_id, role)
SELECT support.routine_template_id, support.day_index,
       support.movement_id, support.role
FROM routine_template_slot support
WHERE support.role = 'supplementary'
  AND NOT EXISTS (
    SELECT 1
    FROM routine_template_slot major
    JOIN movement_lift_family major_family
      ON major_family.movement_id = major.movement_id
    LEFT JOIN movement_lift_family support_family
      ON support_family.movement_id = support.movement_id
    LEFT JOIN movement_assistance_relationship assistance
      ON assistance.major_family = major_family.family
     AND assistance.movement_id = support.movement_id
    WHERE major.routine_template_id = support.routine_template_id
      AND major.day_index = support.day_index
      AND major.role = 'major'
      AND (
        support_family.family = major_family.family
        OR assistance.distance = 1
      )
  );

-- Frozen snapshots retain the exact compatibility decision even if the source
-- template is later deleted. The role column makes the allowance explicit and
-- prevents a marker from licensing any major or accessory role.
CREATE TABLE IF NOT EXISTS planned_slot_legacy_role_allowance (
  planned_slot_id INTEGER PRIMARY KEY REFERENCES planned_slot ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role = 'supplementary')
) STRICT;

-- Idempotent reconstruction for sentinel repair while the source template is
-- still present. Ordinary freezes insert this row in the same transaction as
-- planned_slot_routine_decision.
INSERT OR IGNORE INTO planned_slot_legacy_role_allowance (planned_slot_id, role)
SELECT slot.planned_slot_id, decision.role
FROM planned_slot slot
JOIN planned_slot_routine_decision decision
  ON decision.planned_slot_id = slot.planned_slot_id
JOIN planned_session_routine_context context
  ON context.planned_session_id = slot.planned_session_id
JOIN planned_session_method method
  ON method.planned_session_id = slot.planned_session_id
JOIN routine_template_legacy_role_allowance allowance
  ON allowance.routine_template_id = method.routine_template_id
 AND allowance.day_index = context.routine_day_index
 AND allowance.movement_id = slot.movement_id
 AND allowance.role = decision.role
WHERE decision.role = 'supplementary';
