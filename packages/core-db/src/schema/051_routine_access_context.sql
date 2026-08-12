-- =============================================================================
-- 051_routine_access_context.sql
-- Athlete-local prior-experience declarations and the frozen set of movements
-- whose authored use is sport/conditioning rather than weight-room training.
-- Runtime access decisions remain in the pure inference resolver.
-- =============================================================================

CREATE TABLE IF NOT EXISTS movement_prior_experience (
  movement_id     INTEGER PRIMARY KEY REFERENCES movement ON DELETE CASCADE,
  confirmed_at_ms INTEGER NOT NULL CHECK (confirmed_at_ms >= 0),
  revoked_at_ms   INTEGER CHECK (
                    revoked_at_ms IS NULL OR revoked_at_ms >= confirmed_at_ms
                  ),
  basis           TEXT NOT NULL DEFAULT 'local_user_confirmation'
                  CHECK (basis = 'local_user_confirmation')
) STRICT;

CREATE TABLE IF NOT EXISTS movement_sport_tracking (
  movement_id INTEGER PRIMARY KEY REFERENCES movement ON DELETE CASCADE
) STRICT;

-- All sport-tracking records must already carry the established cardio
-- taxonomy. BJJ Sparring Round predates the complete taxonomy side-car, so
-- close that historical omission without replacing any existing row.
INSERT OR IGNORE INTO movement_taxonomy (movement_id, category, implement, family)
SELECT movement_id, 'cardio', 'bodyweight', 'bjj_sparring_round'
FROM movement WHERE name = 'BJJ Sparring Round';

INSERT OR IGNORE INTO movement_sport_tracking (movement_id)
SELECT movement_id FROM movement WHERE name = 'BJJ Sparring Round';

INSERT OR IGNORE INTO movement_sport_tracking (movement_id)
SELECT movement_id FROM movement WHERE name = 'Road Run';

INSERT OR IGNORE INTO movement_sport_tracking (movement_id)
SELECT movement_id FROM movement WHERE name = 'Trail Running/Walking';
