import type { DB } from '@op-engineering/op-sqlite';
import type {
  ActivityDemand,
  ActivityEquipmentKind,
  ActivityFacilityKind,
  ActivityKindId,
  ActivityModalityId,
  ActivityOccurrenceState,
  ActivityPurposeId,
  TimingCommitment,
} from '@ak/inference';

export interface ActivityDefinitionFact {
  readonly activityId: string;
  readonly kindId: ActivityKindId;
  readonly displayName: string;
  readonly demand: ActivityDemand;
  readonly facilities: readonly ActivityFacilityKind[];
  readonly equipment: readonly ActivityEquipmentKind[];
}

export interface ActivitySeriesFact {
  readonly seriesId: string;
  readonly activityId: string;
  readonly displayName: string;
  readonly revision: number;
  readonly localWeekday: number;
  readonly localStartMinute: number | null;
  readonly timezoneId: string;
  readonly timing: TimingCommitment;
  readonly expectedDurationMin: number | null;
  readonly expectedEffort: number | null;
  readonly effectiveStartDate: string;
  readonly effectiveEndDate: string | null;
}

export interface ActivityOccurrenceFact {
  readonly occurrenceId: string;
  readonly activityId: string;
  readonly displayName: string;
  readonly localDate: string;
  readonly localStartMinute: number | null;
  readonly timezoneId: string;
  readonly state: ActivityOccurrenceState;
  readonly timing: TimingCommitment;
  readonly modalityId: ActivityModalityId;
  readonly purposeId: ActivityPurposeId;
  readonly expectedDurationMin: number | null;
  readonly expectedEffort: number | null;
  readonly actualDurationMin: number | null;
  readonly actualEffort: number | null;
}

export interface ActivityLedgerSnapshot {
  readonly definitions: readonly ActivityDefinitionFact[];
  readonly series: readonly ActivitySeriesFact[];
  readonly occurrences: readonly ActivityOccurrenceFact[];
  readonly completedLast28Days: number;
  readonly knownMinutesLast28Days: number;
  readonly completedWithUnknownDuration: number;
  readonly scheduledKnownMinutesPerWeek: number;
  readonly scheduledWithUnknownDuration: number;
}

export const EMPTY_ACTIVITY_LEDGER: ActivityLedgerSnapshot = {
  definitions: [],
  series: [],
  occurrences: [],
  completedLast28Days: 0,
  knownMinutesLast28Days: 0,
  completedWithUnknownDuration: 0,
  scheduledKnownMinutesPerWeek: 0,
  scheduledWithUnknownDuration: 0,
};

export interface ActivityDefinitionInput {
  readonly activityId?: string;
  readonly kindId: ActivityKindId;
  readonly displayName: string;
  readonly demand: ActivityDemand;
  readonly facilityCode: ActivityFacilityKind | null;
  readonly equipmentCode: ActivityEquipmentKind | null;
}

export interface WeeklyActivityInput extends ActivityDefinitionInput {
  readonly seriesId?: string;
  readonly localWeekday: number;
  readonly localStartMinute: number | null;
  readonly timezoneId: string;
  readonly timing: TimingCommitment;
  readonly expectedDurationMin: number | null;
  readonly expectedEffort: number | null;
  readonly effectiveStartDate: string;
}

export interface OneOffActivityInput extends ActivityDefinitionInput {
  readonly localDate: string;
  readonly localStartMinute: number | null;
  readonly timezoneId: string;
  readonly timing: TimingCommitment;
  readonly state: ActivityOccurrenceState;
  readonly modalityId: ActivityModalityId;
  readonly purposeId: ActivityPurposeId;
  readonly expectedDurationMin: number | null;
  readonly expectedEffort: number | null;
  readonly actualDurationMin: number | null;
  readonly actualEffort: number | null;
}

export interface CompleteActivityInput {
  readonly occurrenceId: string;
  readonly actualDurationMin: number | null;
  readonly actualEffort: number | null;
}

const rowsOf = <T>(result: unknown): T[] => {
  const rows = (result as { rows?: unknown }).rows;
  if (Array.isArray(rows)) return rows as T[];
  const array = (rows as { _array?: unknown } | undefined)?._array;
  return Array.isArray(array) ? array as T[] : [];
};

const strictLocalDate = (value: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Date must use YYYY-MM-DD.');
  }
  const [year, month, day] = value.split('-').map(Number);
  const utc = Date.UTC(year, month - 1, day);
  if (new Date(utc).toISOString().slice(0, 10) !== value) {
    throw new Error('Enter a real calendar date.');
  }
  return value;
};

const boundedText = (value: string, label: string, max: number): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error(`${label} is required.`);
  if (value.length > max) throw new Error(`${label} is too long.`);
  return trimmed;
};

const optionalWhole = (value: number | null, label: string, min: number, max: number): number | null => {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  return value;
};

const optionalEffort = (value: number | null): number | null => {
  if (value === null) return null;
  if (!Number.isFinite(value) || value < 1 || value > 10) {
    throw new Error('Effort must be between 1 and 10.');
  }
  return value;
};

const nextId = (db: DB, prefix: string, table: string, column: string, atMs: number): string => {
  const base = `${prefix}-${Math.max(0, Math.floor(atMs)).toString(36)}`;
  let suffix = 0;
  while (suffix < 1000) {
    const candidate = suffix === 0 ? base : `${base}-${suffix.toString(36)}`;
    const found = rowsOf<{ present: number }>(db.executeSync(
      `SELECT 1 AS present FROM ${table} WHERE ${column} = ? LIMIT 1`,
      [candidate],
    ))[0];
    if (found === undefined) return candidate;
    suffix += 1;
  }
  throw new Error('Could not allocate a local activity identifier.');
};

const effortColumns = (effort: number | null): readonly [string | null, number | null] =>
  effort === null ? [null, null] : ['whole_session_effort_1_10', 1];

const saveDefinition = (
  db: DB,
  input: ActivityDefinitionInput,
  atMs: number,
): string => {
  const displayName = boundedText(input.displayName, 'Activity name', 160);
  const activityId = input.activityId ?? nextId(db, 'activity', 'activity_definition', 'activity_id', atMs);
  if (input.activityId === undefined) {
    db.executeSync(
      `INSERT INTO activity_definition
        (activity_id,kind_id,display_name,demand_class,demand_source,provenance,created_at_ms,updated_at_ms)
       VALUES (?,?,?,?,?,'user_reported',?,?)`,
      [activityId, input.kindId, displayName, input.demand,
        input.demand === 'unknown' ? 'unknown' : 'user_reported', atMs, atMs],
    );
  } else {
    const existingDefinition = rowsOf<{ kind_id: ActivityKindId }>(db.executeSync(
      'SELECT kind_id FROM activity_definition WHERE activity_id=?', [activityId],
    ))[0];
    if (existingDefinition === undefined) throw new Error('Saved activity was not found.');
    if (existingDefinition.kind_id !== input.kindId) {
      throw new Error('A saved activity type cannot be relabelled. Create a new activity instead.');
    }
    db.executeSync(
      `UPDATE activity_definition
          SET kind_id=?,display_name=?,demand_class=?,demand_source=?,updated_at_ms=?
        WHERE activity_id=?`,
      [input.kindId, displayName, input.demand,
        input.demand === 'unknown' ? 'unknown' : 'user_reported', atMs, activityId],
    );
  }

  const requirements: Array<['facility' | 'equipment', string | null]> = [
    ['facility', input.facilityCode],
    ['equipment', input.equipmentCode],
  ];
  for (const [kind, code] of requirements) {
    const existing = rowsOf<{ requirement_code: string }>(db.executeSync(
      `SELECT requirement_code FROM activity_requirement
        WHERE activity_id=? AND requirement_kind=? ORDER BY requirement_code`,
      [activityId, kind],
    ));
    // This UI owns one simple fact per category. It may replace that single
    // fact, but it never erases a richer multi-row record created by a future
    // importer or editor it cannot faithfully display.
    if (existing.length <= 1) {
      db.executeSync(
        'DELETE FROM activity_requirement WHERE activity_id=? AND requirement_kind=?',
        [activityId, kind],
      );
    }
    if (code !== null && (existing.length <= 1 || !existing.some((row) => row.requirement_code === code))) {
      const requirementId = nextId(db, `requirement-${kind}`, 'activity_requirement', 'requirement_id', atMs);
      db.executeSync(
        `INSERT INTO activity_requirement
          (requirement_id,activity_id,requirement_kind,requirement_code,requirement_state,provenance,recorded_at_ms)
         VALUES (?,?,?,?,?,'user_reported',?)`,
        [requirementId, activityId, kind, code, code === 'unknown' ? 'unknown' : 'known_available', atMs],
      );
    }
  }
  return activityId;
};

const localFixedInstant = (
  localDate: string,
  localStartMinute: number,
  durationMin: number | null,
): { startMs: number; endMs: number; resolverVersion: string } => {
  const [year, month, day] = strictLocalDate(localDate).split('-').map(Number);
  const hours = Math.floor(localStartMinute / 60);
  const minutes = localStartMinute % 60;
  const resolved = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (resolved.getFullYear() !== year || resolved.getMonth() !== month - 1
      || resolved.getDate() !== day || resolved.getHours() !== hours
      || resolved.getMinutes() !== minutes) {
    throw new Error('That local time does not exist on this device. Choose flexible timing or another time.');
  }
  const beforeOffset = new Date(resolved.getTime() - 60 * 60 * 1000).getTimezoneOffset();
  const afterOffset = new Date(resolved.getTime() + 60 * 60 * 1000).getTimezoneOffset();
  if (beforeOffset !== afterOffset) {
    throw new Error('That local time is affected by a daylight-saving change. Choose flexible timing for now.');
  }
  const startMs = resolved.getTime();
  return {
    startMs,
    endMs: startMs + (durationMin ?? 0) * 60_000,
    resolverVersion: 'device-date-v1',
  };
};

export const readActivityLedger = (db: DB, today: string): ActivityLedgerSnapshot => {
  strictLocalDate(today);
  const definitions = rowsOf<{
    activity_id: string; kind_id: ActivityKindId; display_name: string; demand_class: ActivityDemand;
  }>(db.executeSync(
    `SELECT activity_id,kind_id,display_name,demand_class
       FROM activity_definition ORDER BY lower(display_name),activity_id`,
  )).map((row) => {
    const requirements = rowsOf<{ requirement_kind: string; requirement_code: string }>(db.executeSync(
      `SELECT requirement_kind,requirement_code FROM activity_requirement
        WHERE activity_id=? ORDER BY requirement_kind,requirement_code`,
      [row.activity_id],
    ));
    return {
      activityId: row.activity_id,
      kindId: row.kind_id,
      displayName: row.display_name,
      demand: row.demand_class,
      facilities: requirements.filter((item) => item.requirement_kind === 'facility')
        .map((item) => item.requirement_code as ActivityFacilityKind),
      equipment: requirements.filter((item) => item.requirement_kind === 'equipment')
        .map((item) => item.requirement_code as ActivityEquipmentKind),
    };
  });

  const series = rowsOf<{
    series_id: string; activity_id: string; display_name: string; revision: number;
    local_weekday: number; local_start_minute: number | null; timezone_id: string;
    timing_commitment: TimingCommitment; expected_duration_min: number | null;
    expected_effort: number | null; effective_start_date: string; effective_end_date: string | null;
  }>(db.executeSync(
    `SELECT s.series_id,s.activity_id,d.display_name,s.revision,s.local_weekday,s.local_start_minute,
            s.timezone_id,s.timing_commitment,s.expected_duration_min,s.expected_effort,
            s.effective_start_date,s.effective_end_date
       FROM activity_series s JOIN activity_definition d USING(activity_id)
      ORDER BY s.effective_end_date IS NOT NULL,s.local_weekday,s.local_start_minute,d.display_name`,
  )).map((row) => ({
    seriesId: row.series_id,
    activityId: row.activity_id,
    displayName: row.display_name,
    revision: row.revision,
    localWeekday: row.local_weekday,
    localStartMinute: row.local_start_minute,
    timezoneId: row.timezone_id,
    timing: row.timing_commitment,
    expectedDurationMin: row.expected_duration_min,
    expectedEffort: row.expected_effort,
    effectiveStartDate: row.effective_start_date,
    effectiveEndDate: row.effective_end_date,
  }));

  const occurrences = rowsOf<{
    occurrence_id: string; activity_id: string; display_name: string; local_date: string;
    local_start_minute: number | null; timezone_id: string; occurrence_state: ActivityOccurrenceState;
    timing_commitment: TimingCommitment; modality_id: ActivityModalityId; purpose_id: ActivityPurposeId;
    expected_duration_min: number | null; expected_effort: number | null;
    actual_duration_min: number | null; actual_effort: number | null;
  }>(db.executeSync(
    `SELECT o.occurrence_id,o.activity_id,d.display_name,o.local_date,o.local_start_minute,o.timezone_id,
            o.occurrence_state,o.timing_commitment,o.modality_id,o.purpose_id,
            o.expected_duration_min,o.expected_effort,c.actual_duration_min,c.actual_effort
       FROM activity_occurrence o
       JOIN activity_definition d USING(activity_id)
       LEFT JOIN activity_completion c USING(occurrence_id)
      ORDER BY o.local_date DESC,o.local_start_minute DESC,o.occurrence_id DESC`,
  )).map((row) => ({
    occurrenceId: row.occurrence_id,
    activityId: row.activity_id,
    displayName: row.display_name,
    localDate: row.local_date,
    localStartMinute: row.local_start_minute,
    timezoneId: row.timezone_id,
    state: row.occurrence_state,
    timing: row.timing_commitment,
    modalityId: row.modality_id,
    purposeId: row.purpose_id,
    expectedDurationMin: row.expected_duration_min,
    expectedEffort: row.expected_effort,
    actualDurationMin: row.actual_duration_min,
    actualEffort: row.actual_effort,
  }));

  const summary = rowsOf<{
    completed_count: number; known_minutes: number; unknown_duration_count: number;
  }>(db.executeSync(
    `SELECT count(*) AS completed_count,
            coalesce(sum(c.actual_duration_min),0) AS known_minutes,
            sum(CASE WHEN c.actual_duration_min IS NULL THEN 1 ELSE 0 END) AS unknown_duration_count
       FROM activity_occurrence o JOIN activity_completion c USING(occurrence_id)
      WHERE o.occurrence_state='completed' AND o.local_date BETWEEN date(?,'-27 days') AND ?`,
    [today, today],
  ))[0];
  const scheduled = rowsOf<{ known_minutes: number; unknown_duration_count: number }>(db.executeSync(
    `SELECT coalesce(sum(expected_duration_min),0) AS known_minutes,
            sum(CASE WHEN expected_duration_min IS NULL THEN 1 ELSE 0 END) AS unknown_duration_count
       FROM activity_series WHERE effective_end_date IS NULL`,
  ))[0];

  return {
    definitions,
    series,
    occurrences,
    completedLast28Days: Number(summary?.completed_count ?? 0),
    knownMinutesLast28Days: Number(summary?.known_minutes ?? 0),
    completedWithUnknownDuration: Number(summary?.unknown_duration_count ?? 0),
    scheduledKnownMinutesPerWeek: Number(scheduled?.known_minutes ?? 0),
    scheduledWithUnknownDuration: Number(scheduled?.unknown_duration_count ?? 0),
  };
};

export const saveWeeklyActivity = (db: DB, input: WeeklyActivityInput, atMs: number): string => {
  if (!Number.isInteger(input.localWeekday) || input.localWeekday < 0 || input.localWeekday > 6) {
    throw new Error('Choose a day of the week.');
  }
  const duration = optionalWhole(input.expectedDurationMin, 'Duration', 1, 1440);
  const effort = optionalEffort(input.expectedEffort);
  const startMinute = input.localStartMinute === null
    ? null
    : optionalWhole(input.localStartMinute, 'Start time', 0, 1439);
  if (input.timing === 'fixed' && startMinute === null) {
    throw new Error('A fixed weekly activity needs a start time.');
  }
  const startDate = strictLocalDate(input.effectiveStartDate);
  const timezone = boundedText(input.timezoneId, 'Timezone', 128);
  const [effortScaleId, effortScaleVersion] = effortColumns(effort);
  db.executeSync('BEGIN');
  try {
    if (input.seriesId !== undefined) {
      const activeSeries = rowsOf<{ activity_id: string }>(db.executeSync(
        `SELECT activity_id FROM activity_series
          WHERE series_id=? AND effective_end_date IS NULL`,
        [input.seriesId],
      ))[0];
      if (input.activityId === undefined || activeSeries?.activity_id !== input.activityId) {
        throw new Error('Weekly activity was not found.');
      }
    }
    const activityId = saveDefinition(db, input, atMs);
    const seriesId = input.seriesId
      ?? nextId(db, 'series', 'activity_series', 'series_id', atMs);
    if (input.seriesId === undefined) {
      db.executeSync(
        `INSERT INTO activity_series
          (series_id,activity_id,revision,recurrence_kind,local_weekday,local_start_minute,
           timezone_id,time_resolution_state,effective_start_date,effective_end_date,timing_commitment,
           expected_duration_min,expected_effort,effort_scale_id,effort_scale_version,created_at_ms,updated_at_ms)
         VALUES (?,?,1,'weekly',?,?,?,'unresolved',?,NULL,?,?,?,?,?,?,?)`,
        [seriesId, activityId, input.localWeekday, startMinute, timezone, startDate, input.timing,
          duration, effort, effortScaleId, effortScaleVersion, atMs, atMs],
      );
    } else {
      db.executeSync(
        `UPDATE activity_series
            SET revision=revision+1,local_weekday=?,local_start_minute=?,timezone_id=?,
                time_resolution_state='unresolved',
                timing_commitment=?,expected_duration_min=?,expected_effort=?,effort_scale_id=?,
                effort_scale_version=?,updated_at_ms=?
          WHERE series_id=? AND activity_id=?`,
        // effective_start_date is when the commitment began. An edit revises
        // the schedule; it must not rewrite that historical fact to today.
        [input.localWeekday, startMinute, timezone, input.timing, duration, effort,
          effortScaleId, effortScaleVersion, atMs, seriesId, activityId],
      );
    }
    db.executeSync('COMMIT');
    return seriesId;
  } catch (error) {
    try { db.executeSync('ROLLBACK'); } catch { /* preserve original failure */ }
    throw error;
  }
};

export const saveOneOffActivity = (
  db: DB,
  input: OneOffActivityInput,
  atMs: number,
  currentLocalDate: string,
): string => {
  const localDate = strictLocalDate(input.localDate);
  const today = strictLocalDate(currentLocalDate);
  if ((input.state === 'completed' || input.state === 'missed') && localDate > today) {
    throw new Error('Completed or missed activities cannot be dated in the future.');
  }
  const timezone = boundedText(input.timezoneId, 'Timezone', 128);
  const expectedDuration = optionalWhole(input.expectedDurationMin, 'Expected duration', 1, 1440);
  const actualDuration = optionalWhole(input.actualDurationMin, 'Actual duration', 1, 1440);
  const expectedEffort = optionalEffort(input.expectedEffort);
  const actualEffort = optionalEffort(input.actualEffort);
  const startMinute = input.localStartMinute === null
    ? null
    : optionalWhole(input.localStartMinute, 'Start time', 0, 1439);
  if (input.timing === 'fixed' && startMinute === null) {
    throw new Error('A fixed activity needs a start time.');
  }
  if (input.timing === 'fixed' && expectedDuration === null && actualDuration === null) {
    throw new Error('A fixed one-off activity needs a duration so its end time is not guessed.');
  }
  const fixed = input.timing === 'fixed' && startMinute !== null
    ? localFixedInstant(localDate, startMinute, expectedDuration ?? actualDuration)
    : null;
  const [expectedScaleId, expectedScaleVersion] = effortColumns(expectedEffort);
  const [actualScaleId, actualScaleVersion] = effortColumns(actualEffort);

  db.executeSync('BEGIN');
  try {
    const activityId = saveDefinition(db, input, atMs);
    const occurrenceId = nextId(db, 'occurrence', 'activity_occurrence', 'occurrence_id', atMs);
    db.executeSync(
      `INSERT INTO activity_occurrence
        (occurrence_id,activity_id,series_id,original_recurrence_key,origin_kind,origin_identity,
         origin_session_id,revision,local_date,local_start_minute,timezone_id,time_resolution_state,
         resolved_start_at_ms,resolved_end_at_ms,resolver_version,occurrence_state,timing_commitment,
         modality_id,purpose_id,expected_duration_min,expected_effort,effort_scale_id,
         effort_scale_version,created_at_ms,updated_at_ms)
       VALUES (?,?,NULL,NULL,'manual',?,NULL,1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [occurrenceId, activityId, `manual:${occurrenceId}`, localDate, startMinute, timezone,
        fixed === null ? 'unresolved' : 'unambiguous', fixed?.startMs ?? null, fixed?.endMs ?? null,
        fixed?.resolverVersion ?? null, input.state, input.timing, input.modalityId, input.purposeId,
        expectedDuration, expectedEffort, expectedScaleId, expectedScaleVersion, atMs, atMs],
    );
    if (input.state === 'completed') {
      db.executeSync(
        `INSERT INTO activity_completion
          (occurrence_id,completion_state,actual_start_at_ms,actual_end_at_ms,actual_duration_min,
           actual_effort,effort_scale_id,effort_scale_version,effort_reported_at_ms,provenance,recorded_at_ms)
         VALUES (?,'completed',NULL,NULL,?,?,?,?,?,'user_reported',?)`,
        [occurrenceId, actualDuration, actualEffort, actualScaleId, actualScaleVersion,
          actualEffort === null ? null : atMs, atMs],
      );
    }
    db.executeSync('COMMIT');
    return occurrenceId;
  } catch (error) {
    try { db.executeSync('ROLLBACK'); } catch { /* preserve original failure */ }
    throw error;
  }
};

export const completeActivityOccurrence = (db: DB, input: CompleteActivityInput, atMs: number): void => {
  const duration = optionalWhole(input.actualDurationMin, 'Actual duration', 1, 1440);
  const effort = optionalEffort(input.actualEffort);
  const [scaleId, scaleVersion] = effortColumns(effort);
  db.executeSync('BEGIN');
  try {
    const row = rowsOf<{ occurrence_state: ActivityOccurrenceState }>(db.executeSync(
      'SELECT occurrence_state FROM activity_occurrence WHERE occurrence_id=?',
      [input.occurrenceId],
    ))[0];
    if (row === undefined) throw new Error('Activity entry was not found.');
    if (row.occurrence_state !== 'planned') throw new Error('Only a planned activity can be completed.');
    db.executeSync(
      `UPDATE activity_occurrence SET occurrence_state='completed',revision=revision+1,updated_at_ms=?
        WHERE occurrence_id=?`,
      [atMs, input.occurrenceId],
    );
    db.executeSync(
      `INSERT INTO activity_completion
        (occurrence_id,completion_state,actual_start_at_ms,actual_end_at_ms,actual_duration_min,
         actual_effort,effort_scale_id,effort_scale_version,effort_reported_at_ms,provenance,recorded_at_ms)
       VALUES (?,'completed',NULL,NULL,?,?,?,?,?,'user_reported',?)`,
      [input.occurrenceId, duration, effort, scaleId, scaleVersion,
        effort === null ? null : atMs, atMs],
    );
    db.executeSync('COMMIT');
  } catch (error) {
    try { db.executeSync('ROLLBACK'); } catch { /* preserve original failure */ }
    throw error;
  }
};

export const setActivityOccurrenceState = (
  db: DB,
  occurrenceId: string,
  state: Extract<ActivityOccurrenceState, 'cancelled' | 'missed'>,
  atMs: number,
): void => {
  const row = rowsOf<{ occurrence_state: ActivityOccurrenceState }>(db.executeSync(
    'SELECT occurrence_state FROM activity_occurrence WHERE occurrence_id=?', [occurrenceId],
  ))[0];
  if (row === undefined) throw new Error('Activity entry was not found.');
  if (row.occurrence_state !== 'planned') throw new Error('Only a planned activity can be changed.');
  db.executeSync(
    `UPDATE activity_occurrence SET occurrence_state=?,revision=revision+1,updated_at_ms=?
      WHERE occurrence_id=?`,
    [state, atMs, occurrenceId],
  );
};

export const endActivitySeries = (db: DB, seriesId: string, endDate: string, atMs: number): void => {
  const date = strictLocalDate(endDate);
  const row = rowsOf<{ effective_start_date: string }>(db.executeSync(
    'SELECT effective_start_date FROM activity_series WHERE series_id=?', [seriesId],
  ))[0];
  if (row === undefined) throw new Error('Weekly activity was not found.');
  if (date < row.effective_start_date) throw new Error('The end date cannot precede the schedule start.');
  db.executeSync(
    `UPDATE activity_series SET effective_end_date=?,revision=revision+1,updated_at_ms=? WHERE series_id=?`,
    [date, atMs, seriesId],
  );
};

export const deviceTimezone = (): string => {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return typeof zone === 'string' && zone.trim().length > 0 ? zone : 'UTC';
};
