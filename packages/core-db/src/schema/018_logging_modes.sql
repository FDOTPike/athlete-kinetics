-- =============================================================================
-- 018_logging_modes.sql
-- P16 T2/T4 (ratified by Francis 2026-07-14): time-based logging + band levels.
--
-- Decisions encoded here:
--   (1) Band progression is a PERSONAL ordinal ladder (gyms/brands disagree on
--       colors, so the athlete defines their own in Profile) — no pretend-kg.
--   (2) Time is the only non-rep mode. Distance was considered and DROPPED:
--       for carries it says the same thing as time; the WHY of the movement
--       lives in coaching intention, not units.
--   (3) Time-based movements participate in progression like everything else
--       (multi-purpose app): the chain policy's "required reps" reads as
--       required SECONDS for time-mode movements (the store feeds
--       COALESCE(time_s, reps) into the resolver).
--
-- Additive + idempotent (CREATE IF NOT EXISTS + INSERT OR IGNORE), STRICT.
-- =============================================================================

-- (1) Per-movement logging mode. No row = 'reps' (the whole library except
-- the handful below — zero storage for the common case).
CREATE TABLE IF NOT EXISTS movement_logging_mode (
  movement_id INTEGER PRIMARY KEY REFERENCES movement ON DELETE CASCADE,
  mode        TEXT NOT NULL CHECK (mode IN ('reps','time'))
) STRICT;

INSERT OR IGNORE INTO movement_logging_mode (movement_id, mode)
SELECT m.movement_id, 'time' FROM movement m WHERE m.name IN (
  'Plank',               -- held, not repped
  'Road Run',            -- duration is the dose
  'BJJ Sparring Round',  -- round length
  'Farmer Carry',        -- ratified: carries log TIME, not distance
  'Suitcase Carry'
);

-- (2) Per-set measurements beyond reps x kg. Composite key: a banded plank
-- legitimately carries BOTH a time and a band level.
CREATE TABLE IF NOT EXISTS set_metric (
  set_id INTEGER NOT NULL REFERENCES set_record ON DELETE CASCADE,
  metric TEXT NOT NULL CHECK (metric IN ('time_s','band_level')),
  value  REAL NOT NULL CHECK (value > 0),
  PRIMARY KEY (set_id, metric)
) STRICT, WITHOUT ROWID;

-- (3) The athlete's personal band ladder (labels are theirs: colors, brands,
-- whatever hangs on their rack). Level is the progression ordinal. Not
-- seeded — defined in Profile when the athlete first logs banded work.
CREATE TABLE IF NOT EXISTS band_ladder (
  level INTEGER PRIMARY KEY CHECK (level >= 1),
  label TEXT NOT NULL
) STRICT;

-- (4) Per-chain advancement policy (audit B3): a time-based chain qualifies
-- on SECONDS (required_value = seconds), a custom rep chain can override the
-- engine's 3x8 default. No row = engine default. Consumed by
-- useStore.resolveGoalRung.
CREATE TABLE IF NOT EXISTS progression_policy (
  progression_group TEXT PRIMARY KEY,
  required_sets     INTEGER NOT NULL CHECK (required_sets > 0),
  required_value    REAL NOT NULL CHECK (required_value > 0)
) STRICT;
