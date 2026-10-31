-- Record which newly inserted session_plan_slot row replaced a slot swapped after logged sets.
ALTER TABLE session_plan_slot ADD COLUMN replaced_by_session_plan_slot_id INTEGER REFERENCES session_plan_slot(session_plan_slot_id) ON DELETE SET NULL;
