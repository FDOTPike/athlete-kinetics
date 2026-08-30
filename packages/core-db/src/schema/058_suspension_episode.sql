-- =============================================================================
-- 058_suspension_episode.sql
-- Domain: athlete-owned suspension episodes (RR-02, ratified 2026-08-27).
--
-- Suspension freezes macro progression; it does not stop training or modify
-- dose. The frozen position lives on an episode rather than a boolean so the
-- athlete can resume exactly where they left off. Open state is derived from
-- ended_at_ms IS NULL and is never stored separately.
--
-- There is deliberately no auto-expiry, maximum duration, detraining decay,
-- or return-to-training modifier. Ending an episode is an explicit athlete
-- action, and the existing safety/substitution machinery continues unchanged.
-- =============================================================================

CREATE TABLE IF NOT EXISTS suspension_episode (
  episode_id         INTEGER PRIMARY KEY,
  started_at_ms      INTEGER NOT NULL CHECK (started_at_ms > 0),
  ended_at_ms        INTEGER CHECK (ended_at_ms IS NULL OR ended_at_ms >= started_at_ms),
  reason             TEXT NOT NULL CHECK (reason IN ('injury', 'illness', 'life')),
  frozen_macro_index INTEGER NOT NULL CHECK (frozen_macro_index BETWEEN 1 AND 8)
) STRICT;

-- Every open row maps to the same expression key, allowing at most one.
CREATE UNIQUE INDEX IF NOT EXISTS ux_suspension_episode_single_open
  ON suspension_episode ((ended_at_ms IS NULL)) WHERE ended_at_ms IS NULL;

-- Keep a legible fail-closed error even if the structural index is damaged.
CREATE TRIGGER IF NOT EXISTS trg_suspension_episode_single_open_bi
BEFORE INSERT ON suspension_episode
WHEN NEW.ended_at_ms IS NULL
  AND EXISTS (SELECT 1 FROM suspension_episode WHERE ended_at_ms IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'suspension_episode: an episode is already open');
END;

-- Reopening destroys the episode audit trail; a new episode is required.
CREATE TRIGGER IF NOT EXISTS trg_suspension_episode_no_reopen_bu
BEFORE UPDATE OF ended_at_ms ON suspension_episode
WHEN OLD.ended_at_ms IS NOT NULL AND NEW.ended_at_ms IS NULL
BEGIN
  SELECT RAISE(ABORT, 'suspension_episode: a closed episode cannot be reopened');
END;

CREATE INDEX IF NOT EXISTS ix_suspension_episode_started
  ON suspension_episode (started_at_ms DESC);
