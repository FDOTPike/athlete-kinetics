-- Links a session_plan_slot swapped after logged sets to its newly inserted replacement row.
-- Side-car table (not ALTER TABLE ... ADD COLUMN) so self-heal re-application of the migration chain is idempotent.
CREATE TABLE IF NOT EXISTS session_plan_slot_replacement (
  session_plan_slot_id INTEGER PRIMARY KEY REFERENCES session_plan_slot(session_plan_slot_id) ON DELETE CASCADE,
  replaced_by_session_plan_slot_id INTEGER NOT NULL UNIQUE REFERENCES session_plan_slot(session_plan_slot_id) ON DELETE CASCADE,
  CHECK (replaced_by_session_plan_slot_id <> session_plan_slot_id)
) STRICT;
