-- 060_program_goal_tier_alignment.sql — WO §2.3 (program quality and intake
-- remediation). Competition Squat, Competition Bench and Deadlift are authored
-- 'Advanced' in 010 while onboarding defines intermediate as "the basic lifts
-- feel familiar". This append-only correction realigns EXACTLY those three
-- movement_detail difficulty rows to 'Intermediate' so the tier gate stops
-- blocking an intermediate from the loaded rungs of their own chains.
--
-- Reclassification is NOT capability evidence. Equipment, active
-- injury/niggle exclusions, capability evidence, prior-experience
-- confirmation and separate attestation remain independent hard gates —
-- this migration changes nothing about them.
--
-- Idempotent: the UPDATE matches only 'Advanced' rows, so a replay after the
-- correction has landed touches zero rows. Fail closed: the guard below
-- aborts the whole migration unless all three named movements exist with an
-- authored difficulty row. Shipped migrations, 010 included, are untouched.

CREATE TABLE IF NOT EXISTS movement_tier_alignment (
  movement_id INTEGER NOT NULL PRIMARY KEY REFERENCES movement(movement_id) ON DELETE CASCADE,
  movement_name TEXT NOT NULL,
  previous_difficulty TEXT NOT NULL,
  aligned_difficulty TEXT NOT NULL
) STRICT;

-- Fail-closed guard: the correction is defined for exactly the three named
-- big-lift rows. If any of them is missing (or has no movement_detail row),
-- RAISE aborts the migration inside its transaction and nothing is written.
CREATE TEMP TABLE IF NOT EXISTS _m060_guard (expected INTEGER NOT NULL, found INTEGER NOT NULL) STRICT;
DELETE FROM _m060_guard;
INSERT INTO _m060_guard (expected, found) VALUES (3, 0);
CREATE TEMP TRIGGER IF NOT EXISTS _m060_guard_assert BEFORE UPDATE ON _m060_guard
WHEN NEW.found <> NEW.expected
BEGIN
  SELECT RAISE(ABORT, 'migration 060: the expected named big-lift rows (Competition Squat, Competition Bench, Deadlift) are absent from the movement library');
END;
UPDATE _m060_guard
   SET found = (
     SELECT COUNT(*)
       FROM movement m
       JOIN movement_detail d ON d.movement_id = m.movement_id
      WHERE m.name IN ('Competition Squat', 'Competition Bench', 'Deadlift')
   );
DROP TRIGGER IF EXISTS _m060_guard_assert;
DROP TABLE IF EXISTS _m060_guard;

-- The correction itself: only these three rows, only Advanced -> Intermediate.
UPDATE movement_detail
   SET difficulty_rating = 'Intermediate'
 WHERE difficulty_rating = 'Advanced'
   AND movement_id IN (
     SELECT movement_id FROM movement
      WHERE name IN ('Competition Squat', 'Competition Bench', 'Deadlift')
   );

-- Provenance (idempotent): one row per corrected movement, so the correction
-- is auditable on device and the table doubles as the migration sentinel the
-- self-heal path replays.
INSERT OR IGNORE INTO movement_tier_alignment (movement_id, movement_name, previous_difficulty, aligned_difficulty)
SELECT m.movement_id, m.name, 'Advanced', 'Intermediate'
  FROM movement m
 WHERE m.name IN ('Competition Squat', 'Competition Bench', 'Deadlift');
