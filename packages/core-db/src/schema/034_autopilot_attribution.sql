-- 034_autopilot_attribution.sql
-- Durable, per-slot attribution for the Kinematic Autopilot's RPE/set edits.
-- Absence means the planned slot was not changed by the autopilot.

CREATE TABLE IF NOT EXISTS planned_slot_autopilot (
  planned_slot_id INTEGER PRIMARY KEY REFERENCES planned_slot ON DELETE CASCADE,
  rpe_delta REAL NOT NULL CHECK (rpe_delta BETWEEN -0.5 AND 0.5),
  set_delta INTEGER NOT NULL CHECK (set_delta BETWEEN -1 AND 1),
  reason TEXT NOT NULL CHECK (reason IN ('eased','raised','held_safety'))
) STRICT;
