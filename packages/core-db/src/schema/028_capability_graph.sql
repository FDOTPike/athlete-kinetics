-- =============================================================================
-- 028_capability_graph.sql
-- Multi-role movement classification and a hybrid prerequisite graph.
-- Existing ordered bodyweight ladders are mirrored as adjacent prerequisite
-- edges; major-lift graph content remains curator-owned and is not invented.
-- =============================================================================

CREATE TABLE IF NOT EXISTS movement_role_eligibility (
  movement_id INTEGER NOT NULL REFERENCES movement ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('major','supplementary','conditional')),
  PRIMARY KEY (movement_id, role)
) STRICT, WITHOUT ROWID;

-- Conservative default: every movement may fill supplementary work. Promotion
-- to major/conditional is explicit and additive; the four existing BIG4 anchors
-- are already a ratified product contract.
INSERT OR IGNORE INTO movement_role_eligibility (movement_id, role)
SELECT movement_id, 'supplementary' FROM movement;
INSERT OR IGNORE INTO movement_role_eligibility (movement_id, role)
SELECT movement_id, 'major' FROM movement
WHERE name IN ('Competition Squat','Competition Bench','Deadlift','Overhead Press');

CREATE TABLE IF NOT EXISTS movement_capability_family (
  movement_id INTEGER PRIMARY KEY REFERENCES movement ON DELETE CASCADE,
  family      TEXT NOT NULL CHECK (length(trim(family)) BETWEEN 1 AND 80),
  is_anchor   INTEGER NOT NULL DEFAULT 0 CHECK (is_anchor IN (0,1))
) STRICT;

CREATE TABLE IF NOT EXISTS movement_capability_edge (
  prerequisite_movement_id INTEGER NOT NULL REFERENCES movement ON DELETE CASCADE,
  movement_id              INTEGER NOT NULL REFERENCES movement ON DELETE CASCADE,
  relationship             TEXT NOT NULL CHECK (relationship IN ('prerequisite','regression','variation')),
  min_sessions             INTEGER NOT NULL DEFAULT 1 CHECK (min_sessions BETWEEN 1 AND 100),
  min_sets_per_session     INTEGER NOT NULL DEFAULT 3 CHECK (min_sets_per_session BETWEEN 1 AND 20),
  min_value                INTEGER NOT NULL DEFAULT 8 CHECK (min_value BETWEEN 1 AND 7200),
  value_kind               TEXT NOT NULL DEFAULT 'reps' CHECK (value_kind IN ('reps','time')),
  max_rpe                  REAL CHECK (max_rpe IS NULL OR max_rpe BETWEEN 5.0 AND 10.0),
  requires_attestation     INTEGER NOT NULL DEFAULT 0 CHECK (requires_attestation IN (0,1)),
  PRIMARY KEY (prerequisite_movement_id, movement_id, relationship),
  UNIQUE (prerequisite_movement_id, movement_id),
  CHECK (prerequisite_movement_id <> movement_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS movement_capability_attestation (
  prerequisite_movement_id INTEGER NOT NULL,
  movement_id              INTEGER NOT NULL,
  attested_at_ms           INTEGER NOT NULL CHECK (attested_at_ms >= 0),
  PRIMARY KEY (prerequisite_movement_id, movement_id),
  FOREIGN KEY (prerequisite_movement_id, movement_id)
    REFERENCES movement_capability_edge (prerequisite_movement_id, movement_id)
    ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS capability_session_evidence (
  session_id       INTEGER NOT NULL REFERENCES session ON DELETE CASCADE,
  movement_id      INTEGER NOT NULL REFERENCES movement ON DELETE CASCADE,
  qualifying_sets  INTEGER NOT NULL CHECK (qualifying_sets BETWEEN 0 AND 100),
  minimum_value    INTEGER NOT NULL CHECK (minimum_value BETWEEN 0 AND 7200),
  maximum_rpe      REAL CHECK (maximum_rpe IS NULL OR maximum_rpe BETWEEN 0 AND 10),
  verified         INTEGER NOT NULL DEFAULT 1 CHECK (verified IN (0,1)),
  PRIMARY KEY (session_id, movement_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_capability_evidence_movement
  ON capability_session_evidence (movement_id, verified, session_id);

INSERT OR IGNORE INTO movement_capability_family (movement_id, family, is_anchor)
SELECT movement_id, progression_group, 0 FROM movement_progression;
UPDATE movement_capability_family
SET is_anchor = 1
WHERE movement_id IN (
  SELECT p.movement_id FROM movement_progression p
  WHERE p.progression_rank = (
    SELECT MAX(p2.progression_rank) FROM movement_progression p2
    WHERE p2.progression_group = p.progression_group
  )
);

INSERT OR IGNORE INTO movement_capability_edge
  (prerequisite_movement_id, movement_id, relationship,
   min_sessions, min_sets_per_session, min_value, value_kind,
   max_rpe, requires_attestation)
SELECT lower.movement_id, upper.movement_id, 'prerequisite',
       1, COALESCE(policy.required_sets, 3), COALESCE(policy.required_value, 8),
       CASE WHEN EXISTS (
         SELECT 1 FROM movement_logging_mode lm
         WHERE lm.movement_id = lower.movement_id AND lm.mode = 'time'
       ) THEN 'time' ELSE 'reps' END,
       NULL, 0
FROM movement_progression lower
JOIN movement_progression upper
  ON upper.progression_group = lower.progression_group
 AND upper.progression_rank = (
   SELECT MIN(next.progression_rank) FROM movement_progression next
   WHERE next.progression_group = lower.progression_group
     AND next.progression_rank > lower.progression_rank
 )
LEFT JOIN progression_policy policy
  ON policy.progression_group = lower.progression_group;
