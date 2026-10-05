type LoadPreference = 'auto' | 'manual';
type TrainingAge = 'beginner' | 'intermediate' | 'advanced' | 'elite';

export const ACTIVE_LOAD_PREFERENCE_ERROR = 'End the active session before changing load selection.';

export interface LoadPreferenceRow {
  preference: string | null;
  is_explicit: number | null;
}

export interface LoadPreferenceState {
  preference: LoadPreference;
  explicit: boolean;
}

export interface LoadPreferenceDb {
  executeSync(sql: string, params?: (string | number | null)[]): unknown;
}

export type TransitionLoadPreference = (
  from: TrainingAge,
  to: TrainingAge,
  current: LoadPreference,
  explicit: boolean,
) => LoadPreference;

const rowsOf = <T>(result: unknown): T[] => {
  const rows = (result as { rows?: unknown }).rows;
  if (Array.isArray(rows)) return rows as T[];
  const array = (rows as { _array?: unknown } | undefined)?._array;
  return Array.isArray(array) ? array as T[] : [];
};

export const loadPreferenceFromRow = (
  row: LoadPreferenceRow | undefined,
  trainingAge: TrainingAge,
  defaultPreference: (age: TrainingAge) => LoadPreference,
): LoadPreferenceState => {
  if (trainingAge === 'beginner') return { preference: 'auto', explicit: false };
  if (row?.preference !== 'auto' && row?.preference !== 'manual') {
    return { preference: defaultPreference(trainingAge), explicit: false };
  }
  return { preference: row.preference, explicit: row.is_explicit === 1 };
};

export const readActiveLoadPreference = (
  db: LoadPreferenceDb,
  trainingAge: TrainingAge,
  defaultPreference: (age: TrainingAge) => LoadPreference,
): LoadPreferenceState => {
  const row = rowsOf<LoadPreferenceRow>(db.executeSync(
    `SELECT p.preference, p.is_explicit
     FROM profile_slot s
     LEFT JOIN profile_load_preference p ON p.profile_slot_id = s.slot_id
     WHERE s.is_active = 1
     LIMIT 1`,
  ))[0];
  return loadPreferenceFromRow(row, trainingAge, defaultPreference);
};

export const persistLoadPreferenceRow = (
  db: LoadPreferenceDb,
  preference: LoadPreference,
  explicit: boolean,
): void => {
  db.executeSync(
    `INSERT INTO profile_load_preference (profile_slot_id, preference, is_explicit)
     SELECT slot_id, ?, ? FROM profile_slot WHERE is_active = 1
     ON CONFLICT(profile_slot_id) DO UPDATE SET
       preference = excluded.preference,
       is_explicit = excluded.is_explicit`,
    [preference, explicit ? 1 : 0],
  );
};

export interface ProfileLoadTransitionPlan extends LoadPreferenceState {
  changed: boolean;
}

export const planProfileLoadTransition = (
  priorAge: TrainingAge,
  nextAge: TrainingAge,
  current: LoadPreferenceState,
  transitionPreference: TransitionLoadPreference,
): ProfileLoadTransitionPlan => {
  let preference = current.preference;
  let explicit = current.explicit;
  if (nextAge !== priorAge) {
    preference = transitionPreference(priorAge, nextAge, current.preference, current.explicit);
    explicit = priorAge !== 'beginner' && nextAge !== 'beginner' && current.explicit;
  } else if (nextAge === 'beginner') {
    preference = 'auto';
    explicit = false;
  }
  return {
    preference,
    explicit,
    changed: preference !== current.preference || explicit !== current.explicit,
  };
};

export type ProfileLoadSaveResult =
  | { ok: true; preferenceChanged: boolean }
  | { ok: false; error: string };

export const executeProfileLoadSave = <TDb extends LoadPreferenceDb>(input: {
  getDb: () => TDb;
  sessionActive: boolean;
  current: LoadPreferenceState;
  next: ProfileLoadTransitionPlan;
  persistProfile: (db: TDb) => void;
  commitState: () => void;
}): ProfileLoadSaveResult => {
  const preferenceChanged = input.next.preference !== input.current.preference
    || input.next.explicit !== input.current.explicit;
  if (preferenceChanged && input.sessionActive) {
    return { ok: false, error: ACTIVE_LOAD_PREFERENCE_ERROR };
  }

  const db = input.getDb();
  if (preferenceChanged) {
    db.executeSync('BEGIN');
    try {
      input.persistProfile(db);
      persistLoadPreferenceRow(db, input.next.preference, input.next.explicit);
      db.executeSync('COMMIT');
    } catch (error) {
      db.executeSync('ROLLBACK');
      throw error;
    }
  } else {
    input.persistProfile(db);
  }
  input.commitState();
  return { ok: true, preferenceChanged };
};

export type DirectLoadPreferenceSaveResult =
  | { ok: true }
  | { ok: false; error: string | null };

/** R4: the ONE policy decision for "may this preference be written now?".
 *  Returns a refusal reason, or null when the write is permitted.
 *
 *  It is a predicate rather than a writer because the two callers cannot share
 *  a write path: the direct save owns its own persistence, while onboarding
 *  must write the profile row and the preference row inside a SINGLE
 *  transaction. Sharing the decision — not the write — keeps one fail-closed
 *  boundary without forcing onboarding to split its transaction, and stops the
 *  two guards drifting apart as they had. */
export const loadPreferenceWriteRefusal = (input: {
  sessionActive: boolean;
  trainingAge: TrainingAge;
  preference: LoadPreference;
}): string | null => {
  if (input.sessionActive) return ACTIVE_LOAD_PREFERENCE_ERROR;
  if (input.preference !== 'auto' && input.preference !== 'manual') return '';
  if (input.trainingAge === 'beginner' && input.preference !== 'auto') return '';
  return null;
};

export const executeDirectLoadPreferenceSave = <TDb extends LoadPreferenceDb>(input: {
  getDb: () => TDb;
  sessionActive: boolean;
  trainingAge: TrainingAge;
  preference: LoadPreference;
  commitState: () => void;
}): DirectLoadPreferenceSaveResult => {
  const refusal = loadPreferenceWriteRefusal(input);
  // '' is a silent domain refusal (no user-facing error); the active-session
  // refusal carries its message. Preserves the previous return contract exactly.
  if (refusal !== null) return { ok: false, error: refusal === '' ? null : refusal };
  persistLoadPreferenceRow(input.getDb(), input.preference, true);
  input.commitState();
  return { ok: true };
};

// --- Profile-field persistence (Sol P2-03) -----------------------------------
// The single athlete_profile row write shared by saveProfile, the profile
// switch, and completeOnboarding. It lives in this seam — not inline in
// useStore — so the store verifier executes the exact production statement
// against a real database and asserts a durable row change, rather than
// counting callback invocations.

export interface ProfileFieldsRecord {
  objective: string;
  training_age: string;
  weekly_frequency: number;
  max_sessions_per_day: number;
  session_duration_cap_min: number;
  base_rpe_cap: number;
  target_energy_system: string;
  progression_methodology: string;
  injury_flags: unknown;
  mobility_limits: unknown;
  equipment_inventory: unknown;
}

export const persistProfileFields = (db: LoadPreferenceDb, p: ProfileFieldsRecord): void => {
  db.executeSync(
    `UPDATE athlete_profile SET
       objective = ?, training_age = ?, weekly_frequency = ?,
       max_sessions_per_day = ?, session_duration_cap_min = ?, base_rpe_cap = ?,
       target_energy_system = ?, progression_methodology = ?,
       injury_flags = ?, mobility_limits = ?, equipment_inventory = ?, updated_at_ms = ?
     WHERE profile_id = 1`,
    [
      p.objective, p.training_age, p.weekly_frequency,
      p.max_sessions_per_day, p.session_duration_cap_min, p.base_rpe_cap,
      p.target_energy_system, p.progression_methodology,
      JSON.stringify(p.injury_flags), JSON.stringify(p.mobility_limits),
      JSON.stringify(p.equipment_inventory), Date.now(),
    ],
  );
};
