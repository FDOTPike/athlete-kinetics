-- =============================================================================
-- 071_beta_recording.sql
-- Two facts the app knew during a session and did not keep afterwards.
--
-- This slot was computed from max(schema files, movement manifest, coaching
-- manifest) + 1 at implementation time. It was not reserved in advance.
--
-- Owner ruling 2026-10-13: store which planned slots were skipped and the load
-- the entry was seeded with, in one migration with no change of behaviour.
-- Both are records and nothing else: no engine reads them, and they change no
-- prescription, block, progression, outcome or display. The completion
-- observer stays dormant (same ruling: wait for real completion history).
--
-- SIDE-CAR TABLES, NOT ALTER ADD COLUMN, for the reason 059 gives: the chain is
-- append-only and the self-heal path re-applies every migration. set_record,
-- session_plan_slot and session_outcome are untouched.
--
-- NO BACKFILL. A row exists only for work finalized or logged after this
-- migration. Absence means "not recorded", never "none": a session finalized
-- earlier keeps its skipped_slot_count and no row here, and a set logged
-- earlier, or by a caller that supplied no seed, has no row in set_load_shown.
--
-- session_skipped_slot
--   One row per session_plan_slot the athlete skipped, written in the same
--   transaction that writes session_outcome. Until now only the count survived
--   (session_outcome.skipped_slot_count); the identities lived in the runner
--   checkpoint, which is deleted when the session ends. The slot carries its
--   own session, so the session is not repeated here: there is nothing that
--   could disagree.
--
-- set_load_shown
--   What the load field was seeded with for the set that was then logged, and
--   where that seed came from. shown_load_kg NULL is a blank field (the athlete
--   had to choose); 0 is a real zero. It is the seed of the draft, as rounded
--   for display, not every advisory the athlete may later have seen. Editing a
--   set afterwards does not rewrite it.
--
-- CONTRACT MIRROR (machine-checked by verify:blocks, verify_load_selection.mjs):
--   * load_source CHECK domain    <->  LoadSource in
--                                      packages/inference/src/loadSelection.ts
--   * advisory_kind CHECK domain  <->  AdvisoryKind, same file
-- =============================================================================
CREATE TABLE IF NOT EXISTS session_skipped_slot (
  session_plan_slot_id  INTEGER PRIMARY KEY REFERENCES session_plan_slot ON DELETE CASCADE
) STRICT;

CREATE TABLE IF NOT EXISTS set_load_shown (
  set_id         INTEGER PRIMARY KEY REFERENCES set_record ON DELETE CASCADE,
  load_source    TEXT NOT NULL CHECK (load_source IN ('seeded', 'history', 'derived', 'manual')),
  shown_load_kg  REAL CHECK (shown_load_kg IS NULL OR shown_load_kg >= 0),
  advisory_kg    REAL CHECK (advisory_kg IS NULL OR advisory_kg >= 0),
  advisory_kind  TEXT CHECK (advisory_kind IS NULL OR advisory_kind IN ('apre', 'onerm', 'history')),
  CHECK ((advisory_kg IS NULL) = (advisory_kind IS NULL))
) STRICT;
