-- Display preference belongs to the profile slot. No row means compact.
CREATE TABLE IF NOT EXISTS profile_ui_description_preference (
  profile_slot_id INTEGER PRIMARY KEY REFERENCES profile_slot(slot_id) ON DELETE CASCADE,
  description_mode TEXT NOT NULL CHECK (description_mode IN ('compact', 'expanded')),
  updated_at_ms INTEGER NOT NULL DEFAULT 0
) STRICT;
