-- =============================================================================
-- _chain_projection.sql.tpl — SQL chain projection template.
-- Re-projects movement_progression (movement_id, progression_group, progression_rank)
-- from movement_capability_family and movement_capability_edge.
--
-- Atomically deletes and replaces movement_progression within a single transaction
-- to prevent transient UNIQUE index violations during chain reordering.
-- =============================================================================

DELETE FROM movement_progression;

INSERT INTO movement_progression (movement_id, progression_group, progression_rank)
WITH RECURSIVE
  valid_edges AS (
    SELECT
      e.prerequisite_movement_id AS src,
      e.movement_id AS dst,
      pf.family AS family
    FROM movement_capability_edge e
    JOIN movement_capability_family pf ON pf.movement_id = e.prerequisite_movement_id
    JOIN movement_capability_family mf ON mf.movement_id = e.movement_id
    WHERE e.relationship = 'prerequisite'
      AND pf.family = mf.family
  ),
  roots AS (
    SELECT
      f.movement_id AS root_id,
      f.family AS family
    FROM movement_capability_family f
    WHERE NOT EXISTS (
      SELECT 1 FROM valid_edges e WHERE e.dst = f.movement_id
    )
  ),
  chain_walk AS (
    SELECT
      r.root_id AS movement_id,
      r.family AS progression_group,
      0 AS progression_rank
    FROM roots r

    UNION ALL

    SELECT
      e.dst AS movement_id,
      w.progression_group,
      w.progression_rank + 1 AS progression_rank
    FROM chain_walk w
    JOIN valid_edges e ON e.src = w.movement_id AND e.family = w.progression_group
  )
SELECT movement_id, progression_group, progression_rank
FROM chain_walk
ORDER BY progression_group ASC, progression_rank ASC;
