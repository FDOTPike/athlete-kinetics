-- =============================================================================
-- 058_suspension_episode.sql
-- Domain: the suspending state (RR-02, owner-ratified 2026-08-27).
--
-- TRAINING_PROGRESSION_LAYERS.md 4.1 ratified that rehab is a SUSPENDING STATE,
-- not an L3 phase: an athlete who was in `volume` before an injury returns to
-- `volume`, rather than having macro positions consumed while hurt. Nothing
-- implemented it, because nothing could: `nextMacroPosition` had no state to
-- consult and no existing signal could supply one.
--
--   * athlete_profile.objective = 'rehab' is a GOAL, not an event. It has no
--     start, no end, and no memory of what preceded it.
--   * niggle (011) is a rolling daily complaint channel queried on recency,
--     with no resolved flag and no lifecycle. Suspension inferred from it would
--     silently expire by timeout, which is the failure it must not have.
--   * an autopilot halt is a block-level DOSE event. It already snaps the block
--     to recovery; treating it as suspension would suspend for fatigue.
--
-- So the trigger is explicit and athlete-owned. The app may PROMPT after a halt
-- or a persistent niggle, mirroring the ratified "a halt prompts rather than
-- auto-suspends" rule, but it never infers. An automatic injury detector would
-- be a diagnostic claim this project has no ratified authority to make.
--
-- WHAT SUSPENSION DOES AND DELIBERATELY DOES NOT DO
-- It freezes the macro position. That is all.
--
-- It does NOT stop training, and it must not: the app is a coach in the
-- athlete's pocket, and injuries are a thing to train around, not a reason to
-- go dark. The existing safety machinery keeps working untouched during a
-- suspension --- substitution away from injured joints (substitution.ts
-- injuredJoints/computeSubstitutions, matched on the niggle region domain), the
-- rehab RPE ceiling of 7.0, the autopilot's monotone-conservative override
-- which may only pull dose DOWN while a loaded joint is injured, and halt
-- supremacy. Suspension adds no modifier of its own to any of them.
--
-- NO NUMERIC VALUE ENTERS THE ENGINE HERE. There is no maximum duration, no
-- auto-expiry, no detraining decay, and no return-to-training dose modifier ---
-- Calibration Policy v1 forbids that last one outright, and the other three
-- would each be a new unratified coefficient. An episode ends when the athlete
-- says it ends.
--
-- Idempotent (IF NOT EXISTS) and append-only, per the migration contract.
-- =============================================================================

-- An EPISODE, not a boolean. The ratified requirement is that the athlete
-- returns to where they were, which needs the frozen position recorded at
-- entry; a bare flag has nowhere to put it. `is_suspended` is therefore DERIVED
-- (ended_at_ms IS NULL), never stored, so a flag and a history cannot drift.
CREATE TABLE IF NOT EXISTS suspension_episode (
  episode_id         INTEGER PRIMARY KEY,
  started_at_ms      INTEGER NOT NULL CHECK (started_at_ms > 0),
  -- NULL = currently suspended. Set once, by the athlete, on resume.
  ended_at_ms        INTEGER CHECK (ended_at_ms IS NULL OR ended_at_ms >= started_at_ms),
  -- Closed domain: free text cannot be reasoned about and will not stay clean.
  -- 'life' is deliberate --- travel, work, bereavement. Restricting suspension
  -- to injury would leave the commonest cause of a training gap still burning
  -- the athlete's progression track, which is the bug this table exists to fix.
  reason             TEXT NOT NULL CHECK (reason IN ('injury', 'illness', 'life')),
  -- The macro position frozen at entry, mirroring the 009 block_meta domain.
  frozen_macro_index INTEGER NOT NULL CHECK (frozen_macro_index BETWEEN 1 AND 8)
) STRICT;

-- At most one episode open at a time. A partial index over a constant-valued
-- expression is the structural form of that invariant: every open row indexes
-- the same key, so a second one cannot be inserted.
CREATE UNIQUE INDEX IF NOT EXISTS ux_suspension_episode_single_open
  ON suspension_episode ((ended_at_ms IS NULL)) WHERE ended_at_ms IS NULL;

-- Fail-closed guard (DB-SUSPENSION-DRIFT). The index above enforces the
-- invariant structurally; this trigger makes the violation legible and survives
-- as a registered sentinel, exactly as the 057 block_meta triggers do. A
-- dropped index would otherwise silently reopen double-suspension.
CREATE TRIGGER IF NOT EXISTS trg_suspension_episode_single_open_bi
BEFORE INSERT ON suspension_episode
WHEN NEW.ended_at_ms IS NULL
  AND EXISTS (SELECT 1 FROM suspension_episode WHERE ended_at_ms IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'suspension_episode: an episode is already open');
END;

-- An ended episode is closed for good. Re-opening one would lose the audit
-- trail the episode model exists to keep; a new episode is the correct move.
CREATE TRIGGER IF NOT EXISTS trg_suspension_episode_no_reopen_bu
BEFORE UPDATE OF ended_at_ms ON suspension_episode
WHEN OLD.ended_at_ms IS NOT NULL AND NEW.ended_at_ms IS NULL
BEGIN
  SELECT RAISE(ABORT, 'suspension_episode: a closed episode cannot be reopened');
END;

-- Resolving the open episode is the hot path (every macro position read), and
-- it is the only query shape this table serves.
CREATE INDEX IF NOT EXISTS ix_suspension_episode_started
  ON suspension_episode (started_at_ms DESC);
