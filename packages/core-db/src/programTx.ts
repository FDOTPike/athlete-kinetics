/**
 * programTx.ts — shared, minimal DB helper for guided-program transactions.
 *
 * WHY THIS EXISTS (audit P2): the guided-program write path used to be
 * embedded verbatim inside the Zustand store, and the Node test suite
 * re-typed the same SQL by hand. That meant the test could stay green while
 * production wiring drifted. This module is the SINGLE source of the program
 * SQL; both the store (import) and the Node verifier (compiled require) call
 * the exact same functions, so a divergence is a compile/require error, not
 * a silent test gap.
 *
 * The helper is intentionally DB-agnostic: it speaks a minimal
 * executeSync(sql, params?) surface (op-sqlite on device; node:sqlite under
 * the test adapter). Callers own transaction boundaries (BEGIN/COMMIT/
 * ROLLBACK) so a mid-write failure rolls back the WHOLE block generation,
 * not just the program rows.
 */

export interface ExecDb {
  executeSync(sql: string, params?: readonly unknown[]): { rows: Record<string, unknown>[] };
}

export interface ProgramDayWrite {
  dayIndex: number;
  focus: string;
}

export interface ProgramPreferenceWrite {
  dayIndex: number;
  slotIndex: number;
  pattern: string;
  movementId: number;
}

export interface CreateProgramWrite {
  objective: string;
  startDate: string;
  horizonKind: 'weeks' | 'date';
  requestedReviewDate: string | null;
  plannedEndDate: string;
  plannedBlockCount: number;
  startingMacroBlockIndex: number;
  schemaType: string;
  days: readonly ProgramDayWrite[];
  movementPreferences: readonly ProgramPreferenceWrite[];
  weeklyFrequency: number;
  now: number;
}

/** Insert the training_program row plus its day/preference children and the
 *  athlete's weekly-frequency update. Returns the new program_id. */
export function insertTrainingProgram(d: ExecDb, input: CreateProgramWrite): number {
  d.executeSync(
    `INSERT INTO training_program
       (objective, start_date, horizon_kind, requested_review_date, planned_end_date,
        planned_block_count, starting_macro_block_index, schema_type, status, created_at_ms, updated_at_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    [input.objective, input.startDate, input.horizonKind,
      input.requestedReviewDate, input.plannedEndDate,
      input.plannedBlockCount, input.startingMacroBlockIndex, input.schemaType, input.now, input.now],
  );
  const programId = Number(
    (d.executeSync('SELECT last_insert_rowid() AS id').rows[0] as { id: number } | undefined)?.id ?? 0,
  );
  if (programId === 0) throw new Error('Failed to read program_id after insert.');
  for (const day of input.days) {
    d.executeSync('INSERT INTO training_program_day (program_id, day_index, focus) VALUES (?, ?, ?)',
      [programId, day.dayIndex, day.focus]);
  }
  for (const preference of input.movementPreferences) {
    d.executeSync(
      `INSERT INTO training_program_movement_preference
         (program_id, day_index, slot_index, pattern, movement_id) VALUES (?, ?, ?, ?, ?)`,
      [programId, preference.dayIndex, preference.slotIndex, preference.pattern, preference.movementId],
    );
  }
  d.executeSync('UPDATE athlete_profile SET weekly_frequency = ?, updated_at_ms = ? WHERE profile_id = 1',
    [input.weeklyFrequency, input.now]);
  return programId;
}

/** Continuation write: advance an active program's planned end date. */
export function updateTrainingProgramEndDate(
  d: ExecDb,
  programId: number,
  plannedEndDate: string,
  updatedAtMs: number,
): void {
  d.executeSync(
    'UPDATE training_program SET planned_end_date = ?, updated_at_ms = ? WHERE program_id = ? AND status = ?',
    [plannedEndDate, updatedAtMs, programId, 'active'],
  );
}

/** Link a generated block to its program with the program-relative sequence. */
export function linkTrainingBlockProgram(
  d: ExecDb,
  blockId: number,
  programId: number,
  sequenceIndex: number,
): void {
  d.executeSync(
    'INSERT INTO training_block_program (block_id, program_id, sequence_index) VALUES (?, ?, ?)',
    [blockId, programId, sequenceIndex],
  );
}

/** Archive any currently active training_block (idempotent: no-op when none). */
export function archiveActiveTrainingBlock(d: ExecDb): void {
  d.executeSync("UPDATE training_block SET status = 'archived' WHERE status = 'active'");
}

export type BaseProgramFocus = 'lower' | 'upper' | 'full' | 'conditioning' | 'bjj';

/** Map an extended Phase 2 focus ('push'|'pull'|'legs'|'accessories') to the
 *  base CHECK-constrained focus stored in training_program_day / planned_session. */
export function mapBaseProgramFocus(focus: string): BaseProgramFocus {
  switch (focus) {
    case 'push':
    case 'pull':
      return 'upper';
    case 'legs':
      return 'lower';
    case 'accessories':
      return 'full';
    case 'lower':
    case 'upper':
    case 'full':
    case 'conditioning':
    case 'bjj':
      return focus;
    default:
      return 'full';
  }
}

export interface ProgramSlotOverrideWrite {
  dayIndex: number;
  slotIndex: number;
  sets?: number | null;
  reps?: number | null;
  targetRpe?: number | null;
}

export interface ProgramRoutineDayWrite {
  dayIndex: number;
  routineTemplateId: number;
  routineDayIndex: number;
}

export interface ProgramAdvancedControlWrite {
  scheduleMode?: 'iso_weekday' | 'relative_day_index';
  days: readonly ProgramDayWrite[];
  slotOverrides?: readonly ProgramSlotOverrideWrite[];
  routineAssignments?: readonly ProgramRoutineDayWrite[];
}

/** Replace Phase 2 advanced control side-cars for a program inside an active tx. */
export function writeProgramAdvancedControl(
  d: ExecDb,
  programId: number,
  input: ProgramAdvancedControlWrite,
): void {
  d.executeSync('DELETE FROM training_program_day_focus_ext WHERE program_id = ?', [programId]);
  for (const day of input.days) {
    if (
      day.focus === 'push'
      || day.focus === 'pull'
      || day.focus === 'legs'
      || day.focus === 'accessories'
    ) {
      d.executeSync(
        'INSERT INTO training_program_day_focus_ext (program_id, day_index, focus) VALUES (?, ?, ?)',
        [programId, day.dayIndex, day.focus],
      );
    }
  }
  d.executeSync(
    'INSERT OR REPLACE INTO training_program_schedule_mode (program_id, mode) VALUES (?, ?)',
    [programId, input.scheduleMode ?? 'iso_weekday'],
  );
  d.executeSync('DELETE FROM training_program_slot_override WHERE program_id = ?', [programId]);
  for (const ov of input.slotOverrides ?? []) {
    if (ov.sets == null && ov.reps == null && ov.targetRpe == null) continue;
    d.executeSync(
      'INSERT INTO training_program_slot_override (program_id, day_index, slot_index, sets, reps, target_rpe) VALUES (?, ?, ?, ?, ?, ?)',
      [programId, ov.dayIndex, ov.slotIndex, ov.sets ?? null, ov.reps ?? null, ov.targetRpe ?? null],
    );
  }
  d.executeSync('DELETE FROM training_program_day_routine WHERE program_id = ?', [programId]);
  for (const ra of input.routineAssignments ?? []) {
    d.executeSync(
      'INSERT INTO training_program_day_routine (program_id, day_index, routine_template_id, routine_day_index) VALUES (?, ?, ?, ?)',
      [programId, ra.dayIndex, ra.routineTemplateId, ra.routineDayIndex],
    );
  }
}
