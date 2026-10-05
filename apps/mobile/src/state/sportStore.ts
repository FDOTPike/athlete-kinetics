/**
 * sportStore.ts — the SQL boundary for the sport profile, the goal exercise
 * link and the frozen per-block emphasis record (067). Like focusGoalStore,
 * every function runs synchronously inside the caller's transaction and never
 * opens, commits or rolls one back.
 *
 * The weekly sport schedule is READ from the existing Activities tables (064);
 * nothing here writes to them. They are the evidence for workload.
 */
import type {
  EmphasisReport,
  ProgramEmphasis,
  ScheduledSportSession,
  SportExperienceId,
  SportId,
  SportOutcomeId,
  SportProfile,
} from '@ak/inference';

export interface SportDb {
  executeSync(sql: string, params?: unknown[]): unknown;
}

const rowsOf = <T>(result: unknown): T[] => {
  const rows = (result as { rows?: unknown }).rows;
  if (Array.isArray(rows)) return rows as T[];
  const nested = (rows as { _array?: unknown } | undefined)?._array;
  return Array.isArray(nested) ? (nested as T[]) : [];
};

// ---------------------------------------------------------------------------
// Sport profile
// ---------------------------------------------------------------------------

export interface StoredSportProfile extends SportProfile {
  readonly revision: number;
}

/** The athlete's sport answer, or null when they play no sport (no row). */
export function readSportProfile(db: SportDb): StoredSportProfile | null {
  const row = rowsOf<{
    sport_id: string; other_sport_name: string | null; outcome_id: string; experience_id: string;
    practice_sessions_per_week: number | null; matches_per_week: number | null;
    typical_session_min: number | null; competition_date: string | null; revision: number;
  }>(db.executeSync(
    `SELECT sport_id, other_sport_name, outcome_id, experience_id, practice_sessions_per_week,
            matches_per_week, typical_session_min, competition_date, revision
       FROM athlete_sport_profile WHERE sport_profile_id = 1`,
  ))[0];
  if (row === undefined) return null;
  return {
    sportId: row.sport_id as SportId,
    otherSportName: row.other_sport_name,
    outcomeId: row.outcome_id as SportOutcomeId,
    experienceId: row.experience_id as SportExperienceId,
    practiceSessionsPerWeek: row.practice_sessions_per_week,
    matchesPerWeek: row.matches_per_week,
    typicalSessionMinutes: row.typical_session_min,
    competitionDate: row.competition_date,
    revision: row.revision,
  };
}

/** Save a validated sport answer, replacing the previous one. */
export function writeSportProfile(db: SportDb, profile: SportProfile, nowMs: number): void {
  db.executeSync(
    `INSERT INTO athlete_sport_profile
       (sport_profile_id, sport_id, other_sport_name, outcome_id, experience_id, practice_sessions_per_week,
        matches_per_week, typical_session_min, competition_date, revision, updated_at_ms)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
     ON CONFLICT(sport_profile_id) DO UPDATE SET
       sport_id = excluded.sport_id,
       other_sport_name = excluded.other_sport_name,
       outcome_id = excluded.outcome_id,
       experience_id = excluded.experience_id,
       practice_sessions_per_week = excluded.practice_sessions_per_week,
       matches_per_week = excluded.matches_per_week,
       typical_session_min = excluded.typical_session_min,
       competition_date = excluded.competition_date,
       revision = athlete_sport_profile.revision + 1,
       updated_at_ms = excluded.updated_at_ms`,
    [
      profile.sportId, profile.otherSportName, profile.outcomeId, profile.experienceId,
      profile.practiceSessionsPerWeek, profile.matchesPerWeek, profile.typicalSessionMinutes,
      profile.competitionDate, nowMs,
    ],
  );
}

/** "I do not play a sport": the answer is the absence of a row. */
export function clearSportProfile(db: SportDb): void {
  db.executeSync('DELETE FROM athlete_sport_profile');
}

// ---------------------------------------------------------------------------
// Schedule evidence (read-only, from the Activities tables)
// ---------------------------------------------------------------------------

/**
 * The weekly sessions in force on `onDate` that count as sport workload.
 *
 * Counted: every weekly series in effect on that date, EXCEPT gym strength
 * training (that is what is being planned) and activities the athlete marked
 * as low demand (a daily walk is not a training session). Each is returned
 * with its own name so the athlete can see exactly what was counted.
 */
export function readScheduledSportSessions(db: SportDb, onDate: string): ScheduledSportSession[] {
  return rowsOf<{ display_name: string; local_weekday: number; expected_duration_min: number | null }>(db.executeSync(
    `SELECT d.display_name, s.local_weekday, s.expected_duration_min
       FROM activity_series s JOIN activity_definition d USING(activity_id)
      WHERE s.effective_start_date <= ?
        AND (s.effective_end_date IS NULL OR s.effective_end_date >= ?)
        AND d.kind_id <> 'strength_training'
        AND d.demand_class <> 'low'
      ORDER BY s.local_weekday, s.local_start_minute, d.display_name, s.series_id`,
    [onDate, onDate],
  )).map((row) => ({
    label: row.display_name,
    weekday: row.local_weekday,
    expectedDurationMin: row.expected_duration_min,
  }));
}

// ---------------------------------------------------------------------------
// Goal exercise link
// ---------------------------------------------------------------------------

/** goal id -> movement id, for every goal that names an exercise. */
export function readGoalMovementLinks(db: SportDb): Map<string, number> {
  return new Map(rowsOf<{ goal_id: string; movement_id: number }>(db.executeSync(
    'SELECT goal_id, movement_id FROM athlete_goal_movement ORDER BY goal_id',
  )).map((row) => [row.goal_id, row.movement_id]));
}

/** Set, change or (with null) remove the exercise a goal is about. The goal's
 * definition and its measurements are not touched. */
export function setGoalMovementLink(db: SportDb, goalId: string, movementId: number | null, nowMs: number): void {
  if (movementId === null) {
    db.executeSync('DELETE FROM athlete_goal_movement WHERE goal_id = ?', [goalId]);
    return;
  }
  db.executeSync(
    `INSERT INTO athlete_goal_movement (goal_id, movement_id, linked_at_ms) VALUES (?, ?, ?)
     ON CONFLICT(goal_id) DO UPDATE SET movement_id = excluded.movement_id, linked_at_ms = excluded.linked_at_ms`,
    [goalId, movementId, nowMs],
  );
}

// ---------------------------------------------------------------------------
// Frozen block emphasis record
// ---------------------------------------------------------------------------

/** What the generator was told, without the 800-row muscle mapping (that is
 * library data, already in the database). */
export type BlockEmphasisInputs = Omit<ProgramEmphasis, 'roles'>;

export interface StoredBlockEmphasis {
  readonly blockId: number;
  readonly inputs: BlockEmphasisInputs;
  readonly report: EmphasisReport;
}

/**
 * A block id is reused once its row is gone (INTEGER PRIMARY KEY without
 * AUTOINCREMENT). If a block ever disappeared without its explanation — a
 * crash, or a delete with foreign keys off — the next block to take that id
 * must not inherit it. Every code path that creates a block calls this first.
 */
export function clearBlockEmphasis(db: SportDb, blockId: number): void {
  db.executeSync('DELETE FROM block_emphasis WHERE block_id = ?', [blockId]);
}

/** Written once, in the block's own generation transaction. */
export function insertBlockEmphasis(
  db: SportDb, blockId: number, emphasis: ProgramEmphasis, report: EmphasisReport, nowMs: number,
): void {
  const { roles: _roles, ...inputs } = emphasis;
  void _roles;
  db.executeSync(
    `INSERT INTO block_emphasis (block_id, emphasis_version, inputs_json, report_json, created_at_ms)
     VALUES (?, ?, ?, ?, ?)`,
    [blockId, report.version, JSON.stringify(inputs), JSON.stringify(report), nowMs],
  );
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/** The frozen explanation for a block, or null when it was generated with no
 * emphasis (or before 067). A record that does not parse is treated as absent
 * rather than shown half-read. */
export function readBlockEmphasis(db: SportDb, blockId: number): StoredBlockEmphasis | null {
  const row = rowsOf<{ inputs_json: string; report_json: string }>(db.executeSync(
    'SELECT inputs_json, report_json FROM block_emphasis WHERE block_id = ?', [blockId],
  ))[0];
  if (row === undefined) return null;
  try {
    const report = JSON.parse(row.report_json) as EmphasisReport;
    const inputs = JSON.parse(row.inputs_json) as BlockEmphasisInputs;
    if (!isStringArray(report.applied) || !isStringArray(report.omitted)) return null;
    return { blockId, inputs, report };
  } catch {
    return null;
  }
}

/** Explicit delete for callers that remove blocks with foreign keys off:
 * block ids are reused once the table is empty. */
export function deleteBlockEmphasisFor(db: SportDb, where: 'all' | 'active'): void {
  db.executeSync(where === 'all'
    ? 'DELETE FROM block_emphasis'
    : "DELETE FROM block_emphasis WHERE block_id IN (SELECT block_id FROM training_block WHERE status = 'active')");
}
