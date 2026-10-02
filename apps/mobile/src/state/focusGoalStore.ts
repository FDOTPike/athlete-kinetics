/**
 * focusGoalStore.ts — the SQL boundary for the athlete's focus and SMART goals
 * (066). Like preparationStore, every function runs synchronously inside the
 * caller's transaction and never opens, commits or rolls one back.
 *
 * Goals are append-only in the ways that matter: editing a goal writes a new
 * revision and leaves earlier revisions, and every recorded observation,
 * exactly as they were.
 */
import {
  normalizeFocusSelection,
  type FocusBundleId,
  type FocusSelection,
  type GoalMetricId,
  type GoalObservation,
  type MovementMuscleRole,
  type MuscleGroupId,
  type SmartGoal,
} from '@ak/inference';

export interface FocusGoalDb {
  executeSync(sql: string, params?: unknown[]): unknown;
}

const rowsOf = <T>(result: unknown): T[] => {
  const rows = (result as { rows?: unknown }).rows;
  if (Array.isArray(rows)) return rows as T[];
  const nested = (rows as { _array?: unknown } | undefined)?._array;
  return Array.isArray(nested) ? (nested as T[]) : [];
};

// ---------------------------------------------------------------------------
// Focus
// ---------------------------------------------------------------------------

export interface StoredFocus extends FocusSelection {
  readonly revision: number;
}

/** The athlete's saved focus, or null when they have never answered. */
export function readAthleteFocus(db: FocusGoalDb): StoredFocus | null {
  const row = rowsOf<{ bundle_id: string | null; revision: number }>(db.executeSync(
    'SELECT bundle_id, revision FROM athlete_focus WHERE focus_id = 1',
  ))[0];
  if (row === undefined) return null;
  const muscles = rowsOf<{ muscle_group_id: string }>(db.executeSync(
    `SELECT fm.muscle_group_id FROM athlete_focus_muscle fm
       JOIN muscle_group g ON g.muscle_group_id = fm.muscle_group_id
      WHERE fm.focus_id = 1 ORDER BY g.sort_order`,
  )).map((item) => item.muscle_group_id);
  // Re-derived from the stored selection, so a row written by another build
  // reads back under the current rules instead of being trusted blindly.
  const normalized = normalizeFocusSelection({ bundleId: row.bundle_id, muscles });
  if (!normalized.ok) return null;
  return { ...normalized.selection, revision: row.revision };
}

/** Replace the saved focus with a normalised selection. */
export function writeAthleteFocus(db: FocusGoalDb, selection: FocusSelection, nowMs: number): void {
  db.executeSync(
    `INSERT INTO athlete_focus (focus_id, bundle_id, customised, movement_control, revision, updated_at_ms)
     VALUES (1, ?, ?, ?, 1, ?)
     ON CONFLICT(focus_id) DO UPDATE SET
       bundle_id = excluded.bundle_id,
       customised = excluded.customised,
       movement_control = excluded.movement_control,
       revision = athlete_focus.revision + 1,
       updated_at_ms = excluded.updated_at_ms`,
    [selection.bundleId, selection.customised ? 1 : 0, selection.movementControl ? 1 : 0, nowMs],
  );
  db.executeSync('DELETE FROM athlete_focus_muscle WHERE focus_id = 1');
  for (const muscle of selection.muscles) {
    db.executeSync('INSERT INTO athlete_focus_muscle (focus_id, muscle_group_id) VALUES (1, ?)', [muscle]);
  }
}

/** Every movement's explicit muscle mapping, for the planner. */
export function readMovementMuscleRoles(db: FocusGoalDb): MovementMuscleRole[] {
  return rowsOf<{ movement_id: number; muscle_group_id: string; role: string }>(db.executeSync(
    'SELECT movement_id, muscle_group_id, role FROM movement_muscle_role ORDER BY movement_id, muscle_group_id',
  )).map((row) => ({
    movementId: row.movement_id,
    muscleGroupId: row.muscle_group_id as MuscleGroupId,
    role: row.role as 'primary' | 'supporting',
  }));
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export type GoalStatus = 'active' | 'achieved' | 'retired';

export interface StoredGoalObservation extends GoalObservation {
  readonly observationId: string;
  readonly goalRevision: number;
  readonly unit: string;
}

export interface StoredGoal {
  readonly goalId: string;
  readonly status: GoalStatus;
  readonly revision: number;
  readonly goal: SmartGoal;
  readonly observations: readonly StoredGoalObservation[];
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

interface GoalRevisionRow {
  goal_id: string; status: string; current_revision: number; created_at_ms: number; updated_at_ms: number;
  specific_outcome: string; metric_id: string; unit: string; measurement_method: string;
  baseline_known: number; baseline_value: number | null; target_value: number; reason: string;
  requested_deadline: string | null;
}

const goalFromRow = (row: GoalRevisionRow): SmartGoal => ({
  specificOutcome: row.specific_outcome,
  metricId: row.metric_id as GoalMetricId,
  unit: row.unit,
  measurementMethod: row.measurement_method,
  baselineKnown: row.baseline_known === 1,
  baselineValue: row.baseline_value,
  targetValue: row.target_value,
  reason: row.reason,
  requestedDeadline: row.requested_deadline,
});

/** Every goal with its CURRENT definition and all recorded observations. */
export function readAthleteGoals(db: FocusGoalDb): StoredGoal[] {
  const goals = rowsOf<GoalRevisionRow>(db.executeSync(
    `SELECT g.goal_id, g.status, g.current_revision, g.created_at_ms, g.updated_at_ms,
            r.specific_outcome, r.metric_id, r.unit, r.measurement_method, r.baseline_known,
            r.baseline_value, r.target_value, r.reason, r.requested_deadline
       FROM athlete_goal g
       JOIN athlete_goal_revision r ON r.goal_id = g.goal_id AND r.revision = g.current_revision
      ORDER BY CASE g.status WHEN 'active' THEN 0 ELSE 1 END, g.created_at_ms, g.goal_id`,
  ));
  const observations = rowsOf<{
    observation_id: string; goal_id: string; goal_revision: number; observed_on: string; value: number; unit: string;
    metric_id: string | null;
  }>(db.executeSync(
    // The metric comes from the revision the measurement was recorded against,
    // so progress can leave out measurements of something the goal no longer
    // tracks (two metrics can share a unit: lifted kilograms and body weight).
    `SELECT o.observation_id, o.goal_id, o.goal_revision, o.observed_on, o.value, o.unit, r.metric_id
       FROM athlete_goal_observation o
       LEFT JOIN athlete_goal_revision r ON r.goal_id = o.goal_id AND r.revision = o.goal_revision
      ORDER BY o.goal_id, o.observed_on, o.recorded_at_ms, o.observation_id`,
  ));
  return goals.map((row) => ({
    goalId: row.goal_id,
    status: row.status as GoalStatus,
    revision: row.current_revision,
    goal: goalFromRow(row),
    observations: observations.filter((item) => item.goal_id === row.goal_id).map((item) => ({
      observationId: item.observation_id,
      goalRevision: item.goal_revision,
      observedOn: item.observed_on,
      value: item.value,
      unit: item.unit,
      ...(item.metric_id === null ? {} : { metricId: item.metric_id }),
    })),
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
  }));
}

const insertRevision = (db: FocusGoalDb, goalId: string, revision: number, goal: SmartGoal, nowMs: number): void => {
  db.executeSync(
    `INSERT INTO athlete_goal_revision
       (goal_id, revision, specific_outcome, metric_id, unit, measurement_method, baseline_known,
        baseline_value, target_value, reason, requested_deadline, recorded_at_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      goalId, revision, goal.specificOutcome, goal.metricId, goal.unit, goal.measurementMethod,
      goal.baselineKnown ? 1 : 0, goal.baselineValue, goal.targetValue, goal.reason,
      goal.requestedDeadline, nowMs,
    ],
  );
};

/** Create a goal at revision 1. */
export function insertAthleteGoal(db: FocusGoalDb, goalId: string, goal: SmartGoal, nowMs: number): void {
  db.executeSync(
    `INSERT INTO athlete_goal (goal_id, status, current_revision, created_at_ms, updated_at_ms)
     VALUES (?, 'active', 1, ?, ?)`,
    [goalId, nowMs, nowMs],
  );
  insertRevision(db, goalId, 1, goal, nowMs);
}

/**
 * Edit a goal by appending a revision. Compare-and-set on the revision the
 * editor was shown, so two edits from the same screen cannot both apply.
 * Returns false when the goal is gone or has moved on.
 */
export function reviseAthleteGoal(
  db: FocusGoalDb, goalId: string, expectedRevision: number, goal: SmartGoal, nowMs: number,
): boolean {
  const current = rowsOf<{ current_revision: number; created_at_ms: number }>(db.executeSync(
    'SELECT current_revision, created_at_ms FROM athlete_goal WHERE goal_id = ?', [goalId],
  ))[0];
  if (current === undefined || current.current_revision !== expectedRevision) return false;
  const next = expectedRevision + 1;
  insertRevision(db, goalId, next, goal, nowMs);
  db.executeSync(
    'UPDATE athlete_goal SET current_revision = ?, updated_at_ms = ? WHERE goal_id = ? AND current_revision = ?',
    [next, Math.max(nowMs, current.created_at_ms), goalId, expectedRevision],
  );
  return true;
}

export function setAthleteGoalStatus(db: FocusGoalDb, goalId: string, status: GoalStatus, nowMs: number): boolean {
  const current = rowsOf<{ created_at_ms: number }>(db.executeSync(
    'SELECT created_at_ms FROM athlete_goal WHERE goal_id = ?', [goalId],
  ))[0];
  if (current === undefined) return false;
  db.executeSync('UPDATE athlete_goal SET status = ?, updated_at_ms = ? WHERE goal_id = ?',
    [status, Math.max(nowMs, current.created_at_ms), goalId]);
  return true;
}

/** Record one measurement against the goal's CURRENT definition. */
export function insertGoalObservation(db: FocusGoalDb, input: {
  readonly observationId: string;
  readonly goalId: string;
  readonly observedOn: string;
  readonly value: number;
  readonly nowMs: number;
}): boolean {
  const current = rowsOf<{ current_revision: number; unit: string }>(db.executeSync(
    `SELECT g.current_revision, r.unit FROM athlete_goal g
       JOIN athlete_goal_revision r ON r.goal_id = g.goal_id AND r.revision = g.current_revision
      WHERE g.goal_id = ?`,
    [input.goalId],
  ))[0];
  if (current === undefined) return false;
  db.executeSync(
    `INSERT INTO athlete_goal_observation
       (observation_id, goal_id, goal_revision, observed_on, value, unit, source, recorded_at_ms)
     VALUES (?, ?, ?, ?, ?, ?, 'athlete_entered', ?)`,
    [input.observationId, input.goalId, current.current_revision, input.observedOn, input.value, current.unit, input.nowMs],
  );
  return true;
}

export function deleteGoalObservation(db: FocusGoalDb, observationId: string): void {
  db.executeSync('DELETE FROM athlete_goal_observation WHERE observation_id = ?', [observationId]);
}

/** A training-data reset removes measurement history. Goals and focus are the
 * athlete's stated intentions and stay, like the rest of the profile. */
export function deleteAllGoalObservations(db: FocusGoalDb): void {
  db.executeSync('DELETE FROM athlete_goal_observation');
}

export type { FocusBundleId };
