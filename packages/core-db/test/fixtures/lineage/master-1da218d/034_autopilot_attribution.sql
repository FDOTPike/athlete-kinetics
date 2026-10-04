-- 034_autopilot_attribution.sql
-- Durable, per-slot attribution for the Kinematic Autopilot's RPE/set edits.
-- Absence means the planned slot was not changed by the autopilot.

CREATE TABLE IF NOT EXISTS planned_slot_autopilot (
  planned_slot_id INTEGER PRIMARY KEY REFERENCES planned_slot ON DELETE CASCADE,
  rpe_delta REAL NOT NULL CHECK (rpe_delta IN (-0.5, 0.0, 0.5)),
  set_delta INTEGER NOT NULL CHECK (set_delta BETWEEN -1 AND 1),
  reason TEXT NOT NULL CHECK (reason IN ('eased','raised','held_safety')),
  CHECK (rpe_delta <> 0.0 OR set_delta <> 0),
  CHECK (
    (reason = 'raised' AND rpe_delta >= 0.0 AND set_delta >= 0)
    OR
    (reason IN ('eased','held_safety') AND rpe_delta <= 0.0 AND set_delta <= 0)
  )
) STRICT;
