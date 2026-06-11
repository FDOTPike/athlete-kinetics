/**
 * useStore.ts — Zustand store bridging op-sqlite (synchronous JSI) and the UI.
 *
 * Design rules:
 *   * The native DB handle is a module-level singleton, NOT store state —
 *     it is non-serializable and must never trigger re-renders.
 *   * All DB calls are executeSync: op-sqlite point lookups/inserts are
 *     sub-millisecond over JSI, so there is no loading flicker to manage and
 *     a logged set is durable before the button finishes its press state.
 *   * The store reads ONLY the materialized state_vector (single-row PK
 *     lookups — same read surface as the SLM) and writes ONLY through the
 *     DAO statements below, which mirror packages/core-db.
 */
import { create } from 'zustand';
import type { DB } from '@op-engineering/op-sqlite';
import {
  DEMO_DAYS,
  MATERIALIZE_STATE_VECTOR_SQL,
  SPO2_FOLD_SQL,
  SPO2_TRIM_SQL,
  demoDates,
  generateDemoHistory,
  migrate,
  openKineticsDb,
  type DemoSql,
} from '@ak/core-db';
import {
  applyGuardrail,
  applyProfileLimits,
  DEFAULT_PROFILE,
  getPrescription,
  loadCodebase,
  moreConservative,
  RED_FLAG_PAIN,
  RED_FLAG_SYSTEMIC,
  resolveReport,
  triage,
  type Embedder,
  type LoadedCodebase,
  type MovementPattern,
  type PhraseCodebase,
  type PhraseEntry,
  type Prescription,
  type SessionDirective,
  type StateVectorRow,
  type TriageResult,
  type UserProfile,
} from '@ak/inference';
// Codebase + pre-embedded vectors ride in the JS bundle (~1 MB total);
// relative imports resolve via metro watchFolders / tsc include.
import phraseCodebaseJson from '../../../../packages/inference/assets/phrase-codebase.json';
import phraseVectorsJson from '../../../../packages/inference/assets/phrase-codebase.vectors.json';

// ---------------------------------------------------------------------------
// Shared dark palette (sweaty-hands UI: high contrast, zero decoration)
// ---------------------------------------------------------------------------
export const palette = {
  bg: '#0B0B0E',
  surface: '#15151A',
  line: '#26262E',
  text: '#F4F4F6',
  dim: '#86868F',
  green: '#2EE6A8',
  amber: '#FFB454',
  red: '#FF5D5D',
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Movement {
  movement_id: number;
  name: string;
  pattern: string;
}

export interface LoggedSet {
  set_id: number;
  movement_id: number;
  movement_name: string;
  set_index: number;
  reps: number;
  load_kg: number;
  rpe: number;
  tonnage_kg: number;
}

export interface ActiveSession {
  sessionId: number;
  date: string;
  startedAtMs: number;
  sets: LoggedSet[];
}

export interface TrendPoint {
  date: string;
  readiness_score: number;
}

export type BootStatus = 'booting' | 'ready' | 'error';

export type TriageOutcome =
  | { kind: 'rejected' }
  | { kind: 'matched'; directive: SessionDirective };

/** One slot in the active session's workout plan. */
export interface PlanSlot {
  movementId: number;
  plannedSets: number;
}

interface KineticsStore {
  status: BootStatus;
  error: string | null;
  today: string;
  vector: StateVectorRow | null; // null = no state_vector row for today
  trend: TrendPoint[];           // trailing 14 days, ascending
  movements: Movement[];
  session: ActiveSession | null;
  prescription: (Prescription & { forDate: string }) | null;
  /** Profile-limit notes attached to the current prescription. */
  profileNotes: string[];
  profile: UserProfile;
  /** True when the semantic embedder is wired; the keyword safety layer
   *  works regardless. */
  triageReady: boolean;
  triaging: boolean;
  lastTriage: TriageOutcome | null;
  sessionPlan: PlanSlot[];
  activeMovementId: number | null;

  boot: () => void;
  setEmbedder: (e: Embedder | null) => void;
  saveProfile: (patch: Partial<UserProfile>) => void;
  reportSubjective: (text: string) => Promise<void>;
  selectMovement: (movementId: number) => void;
  addPlanSlot: (movementId: number) => void;
  swapMovement: (oldMovementId: number, newMovementId: number) => void;
  refreshVector: () => void;
  startSession: () => void;
  logSet: (movementId: number, reps: number, loadKg: number, rpe: number) => void;
  endSession: () => void;
  computePrescription: (patterns: readonly MovementPattern[]) => void;
  /** First-run affordance: 180-day deterministic demo athlete. Refuses to run
   *  unless the database is empty — it must never touch real training data. */
  loadDemoAthlete: () => void;
}

// ---------------------------------------------------------------------------
// DB singleton + row normalization (op-sqlite returns rows as an array on
// current versions; older builds nest it under _array)
// ---------------------------------------------------------------------------
let db: DB | null = null;
const getDb = (): DB => {
  if (db === null) throw new Error('kinetics db not booted');
  return db;
};
const rowsOf = <T>(res: unknown): T[] => {
  const r = (res as { rows?: unknown }).rows;
  if (Array.isArray(r)) return r as T[];
  const arr = (r as { _array?: unknown } | undefined)?._array;
  return Array.isArray(arr) ? (arr as T[]) : [];
};

const localToday = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

// ---------------------------------------------------------------------------
// Semantic triage singletons (native-adjacent, non-serializable: module level)
// ---------------------------------------------------------------------------
let embedder: Embedder | null = null;
let codebaseCache: LoadedCodebase | null = null;
const getCodebase = (): LoadedCodebase => {
  if (codebaseCache === null) {
    codebaseCache = loadCodebase(
      phraseCodebaseJson as unknown as PhraseCodebase,
      phraseVectorsJson.vectors,
    );
  }
  return codebaseCache;
};

/** matched_entry_id -> entry, covering curated entries AND the deterministic
 *  red-flag overrides (so persisted reports re-resolve after restart). */
let entryIndexCache: Map<string, PhraseEntry> | null = null;
const entryById = (id: string): PhraseEntry | undefined => {
  if (entryIndexCache === null) {
    entryIndexCache = new Map(getCodebase().entries.map((e) => [e.id, e]));
    entryIndexCache.set(RED_FLAG_PAIN.id, RED_FLAG_PAIN);
    entryIndexCache.set(RED_FLAG_SYSTEMIC.id, RED_FLAG_SYSTEMIC);
  }
  return entryIndexCache.get(id);
};

// --- profile row <-> object mapping ------------------------------------------
interface ProfileRow {
  objective: string; training_age: string; weekly_frequency: number;
  max_sessions_per_day: number; session_duration_cap_min: number;
  base_rpe_cap: number; target_energy_system: string;
  progression_methodology: string; injury_flags: string;
  mobility_limits: string; equipment_access: string;
}
const parseBodyNotes = (json: string): UserProfile['injury_flags'] => {
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v)
      ? v.filter((x): x is { region: string; note: string } =>
          typeof x === 'object' && x !== null &&
          typeof (x as { region?: unknown }).region === 'string' &&
          typeof (x as { note?: unknown }).note === 'string')
      : [];
  } catch {
    return [];
  }
};
const profileFromRow = (r: ProfileRow): UserProfile => ({
  ...(DEFAULT_PROFILE as UserProfile),
  ...r,
  injury_flags: parseBodyNotes(r.injury_flags),
  mobility_limits: parseBodyNotes(r.mobility_limits),
} as UserProfile);

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export const useStore = create<KineticsStore>()((set, get) => ({
  status: 'booting',
  error: null,
  today: localToday(),
  vector: null,
  trend: [],
  movements: [],
  session: null,
  prescription: null,
  profileNotes: [],
  profile: DEFAULT_PROFILE,
  triageReady: false,
  triaging: false,
  lastTriage: null,
  sessionPlan: [],
  activeMovementId: null,

  boot: () => {
    if (get().status === 'ready') return;
    try {
      db = openKineticsDb();
      migrate(db);
      // Catch-up materialization: idempotent upsert over the trailing week so
      // today's state_vector row exists whenever any base data does (a no-op
      // on days with no data at all).
      for (const date of demoDates(localToday(), 7)) {
        db.executeSync(MATERIALIZE_STATE_VECTOR_SQL, [date]);
      }
      const movements = rowsOf<Movement>(
        getDb().executeSync(
          'SELECT movement_id, name, pattern FROM movement ORDER BY movement_id',
        ),
      );
      const profileRow = rowsOf<ProfileRow>(
        getDb().executeSync('SELECT * FROM user_profile WHERE profile_id = 1'),
      )[0];
      set({
        status: 'ready',
        error: null,
        movements,
        today: localToday(),
        profile: profileRow !== undefined ? profileFromRow(profileRow) : DEFAULT_PROFILE,
      });
      get().refreshVector();
      // Prescription is a pure derivation over persisted state (profile +
      // today's reports), so a halt logged yesterday evening survives an
      // app restart this morning.
      get().computePrescription([]);
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },

  saveProfile: (patch) => {
    const merged: UserProfile = { ...get().profile, ...patch };
    // Clamp numerics to the 006 CHECK domains (UI bugs must never throw).
    merged.weekly_frequency = Math.round(clamp(merged.weekly_frequency, 1, 7));
    merged.max_sessions_per_day = Math.round(clamp(merged.max_sessions_per_day, 1, 3));
    merged.session_duration_cap_min = Math.round(clamp(merged.session_duration_cap_min, 15, 240));
    merged.base_rpe_cap = clamp(Math.round(merged.base_rpe_cap * 2) / 2, 5, 10);
    getDb().executeSync(
      `UPDATE user_profile SET
         objective = ?, training_age = ?, weekly_frequency = ?,
         max_sessions_per_day = ?, session_duration_cap_min = ?, base_rpe_cap = ?,
         target_energy_system = ?, progression_methodology = ?,
         injury_flags = ?, mobility_limits = ?, equipment_access = ?, updated_at_ms = ?
       WHERE profile_id = 1`,
      [
        merged.objective, merged.training_age, merged.weekly_frequency,
        merged.max_sessions_per_day, merged.session_duration_cap_min, merged.base_rpe_cap,
        merged.target_energy_system, merged.progression_methodology,
        JSON.stringify(merged.injury_flags), JSON.stringify(merged.mobility_limits),
        merged.equipment_access, Date.now(),
      ],
    );
    set({ profile: merged });
    // Re-derive: profile clamps may have changed the operative prescription.
    if (get().prescription !== null) get().computePrescription([]);
  },

  refreshVector: () => {
    if (get().status !== 'ready') return;
    const today = localToday();
    const d = getDb();
    const vector =
      rowsOf<StateVectorRow>(
        d.executeSync('SELECT * FROM state_vector WHERE date = ?', [today]),
      )[0] ?? null;
    const trend = rowsOf<TrendPoint>(
      d.executeSync(
        `SELECT date, readiness_score FROM state_vector
         WHERE date >= date(?, '-13 days') ORDER BY date`,
        [today],
      ),
    );
    set({ vector, trend, today });
  },

  startSession: () => {
    const today = localToday();
    const startedAtMs = Date.now();
    const d = getDb();
    // Seed the workout plan from the most recent completed session, BEFORE
    // creating the new row. Planned sets fold in today's set_modifier — the
    // first place the prescription's set delta becomes actionable UI.
    const { prescription } = get();
    const plannedSets = Math.round(clamp(
      3 + (prescription !== null && prescription.forDate === today
        ? prescription.vector.set_modifier
        : 0),
      1, 6,
    ));
    const lastMovements = rowsOf<{ movement_id: number }>(d.executeSync(
      `SELECT movement_id FROM set_record
       WHERE session_id = (
         SELECT s.session_id FROM session s
         JOIN set_record r ON r.session_id = s.session_id
         ORDER BY s.session_id DESC LIMIT 1)
       GROUP BY movement_id ORDER BY MIN(set_id)`,
    ));
    const sessionPlan: PlanSlot[] = lastMovements.map((m) => ({
      movementId: m.movement_id,
      plannedSets,
    }));
    d.executeSync(
      'INSERT INTO session (micro_cycle_id, session_date, started_at_ms) VALUES (NULL, ?, ?)',
      [today, startedAtMs],
    );
    const sessionId = rowsOf<{ id: number }>(
      d.executeSync('SELECT last_insert_rowid() AS id'),
    )[0]!.id;
    set({
      session: { sessionId, date: today, startedAtMs, sets: [] },
      sessionPlan,
      activeMovementId: sessionPlan.length > 0 ? sessionPlan[0].movementId : null,
    });
  },

  selectMovement: (movementId) => {
    set({ activeMovementId: movementId });
  },

  addPlanSlot: (movementId) => {
    const { sessionPlan, prescription, today } = get();
    if (sessionPlan.some((s) => s.movementId === movementId)) return; // no duplicates
    const plannedSets = Math.round(clamp(
      3 + (prescription !== null && prescription.forDate === today
        ? prescription.vector.set_modifier
        : 0),
      1, 6,
    ));
    set({
      sessionPlan: [...sessionPlan, { movementId, plannedSets }],
      activeMovementId: movementId,
    });
  },

  swapMovement: (oldMovementId, newMovementId) => {
    const { sessionPlan, activeMovementId } = get();
    if (sessionPlan.some((s) => s.movementId === newMovementId)) return; // no duplicates
    set({
      // Logged sets stay as history; only the slot's identity changes.
      sessionPlan: sessionPlan.map((s) =>
        s.movementId === oldMovementId ? { ...s, movementId: newMovementId } : s),
      activeMovementId: activeMovementId === oldMovementId ? newMovementId : activeMovementId,
    });
  },

  logSet: (movementId, reps, loadKg, rpe) => {
    const s = get().session;
    if (s === null) return;
    const movement = get().movements.find((m) => m.movement_id === movementId);
    if (movement === undefined) return;

    // Clamp to the schema CHECK domains: a UI bug must never throw mid-set.
    const safeReps = Math.round(clamp(reps, 1, 50));
    const safeLoad = clamp(Math.round(loadKg / 2.5) * 2.5, 0, 500);
    const safeRpe = clamp(Math.round(rpe * 2) / 2, 5, 10);

    const d = getDb();
    // set_index is authoritative from the DB, not the in-memory list, so a
    // killed/restored app cannot double-assign an index.
    const setIndex =
      rowsOf<{ next: number }>(
        d.executeSync(
          'SELECT COALESCE(MAX(set_index), 0) + 1 AS next FROM set_record WHERE session_id = ? AND movement_id = ?',
          [s.sessionId, movementId],
        ),
      )[0]?.next ?? 1;
    d.executeSync(
      `INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [s.sessionId, movementId, setIndex, safeReps, safeLoad, safeRpe, Date.now()],
    );
    const setId = rowsOf<{ id: number }>(
      d.executeSync('SELECT last_insert_rowid() AS id'),
    )[0]!.id;

    const logged: LoggedSet = {
      set_id: setId,
      movement_id: movementId,
      movement_name: movement.name,
      set_index: setIndex,
      reps: safeReps,
      load_kg: safeLoad,
      rpe: safeRpe,
      tonnage_kg: safeReps * safeLoad,
    };
    set({ session: { ...s, sets: [logged, ...s.sets] } });
  },

  endSession: () => {
    const s = get().session;
    if (s === null) return;
    const d = getDb();
    if (s.sets.length === 0) {
      // Nothing logged: remove the empty shell row instead of polluting history.
      d.executeSync('DELETE FROM session WHERE session_id = ?', [s.sessionId]);
    } else {
      const avgRpe =
        Math.round((s.sets.reduce((a, x) => a + x.rpe, 0) / s.sets.length) * 2) / 2;
      const durationMin = Math.round(((Date.now() - s.startedAtMs) / 60_000) * 10) / 10;
      d.executeSync(
        'UPDATE session SET session_rpe = ?, duration_min = ? WHERE session_id = ?',
        [avgRpe, durationMin, s.sessionId],
      );
      // Load changed -> re-materialize today's State Vector (the dashboard
      // reads the result; triggers already updated mech_daily).
      d.executeSync(MATERIALIZE_STATE_VECTOR_SQL, [s.date]);
    }
    set({ session: null, sessionPlan: [], activeMovementId: null });
    get().refreshVector();
    // Session count changed: the daily/weekly profile clamps may now bind.
    get().computePrescription([]);
  },

  computePrescription: (_patterns) => {
    const { vector, today, profile, session } = get();
    if (vector === null) return;
    const d = getDb();

    // Layer 1: deterministic policy from the state vector.
    const base = getPrescription(vector);

    // Layer 2: profile clamps (overtraining prevention), driven by actual
    // training history. The active session must not count against itself.
    const sessionsToday = Number(rowsOf<{ c: number }>(d.executeSync(
      `SELECT count(DISTINCT s.session_id) AS c
       FROM session s JOIN set_record sr ON sr.session_id = s.session_id
       WHERE s.session_date = ? AND s.session_id != ?`,
      [today, session !== null ? session.sessionId : -1],
    ))[0]?.c ?? 0);
    const trainedDaysLast7 = Number(rowsOf<{ c: number }>(d.executeSync(
      `SELECT count(DISTINCT s.session_date) AS c
       FROM session s JOIN set_record sr ON sr.session_id = s.session_id
       WHERE s.session_date >= date(?, '-6 days') AND s.session_date <= ?`,
      [today, today],
    ))[0]?.c ?? 0);
    const limited = applyProfileLimits(base.vector, profile, { sessionsToday, trainedDaysLast7 });

    // Layer 3: the most conservative of TODAY'S PERSISTED reports. Deriving
    // from the database (not cached zustand state) means a halt survives an
    // app kill and a profile edit can never resurrect a damped prescription.
    const reportIds = rowsOf<{ matched_entry_id: string }>(d.executeSync(
      'SELECT matched_entry_id FROM subjective_report WHERE date = ? AND matched_entry_id IS NOT NULL',
      [today],
    ));
    let operative: PhraseEntry | null = null;
    for (const r of reportIds) {
      const e = entryById(r.matched_entry_id);
      if (e !== undefined && (operative === null || moreConservative(e.guardrail, operative.guardrail))) {
        operative = e;
      }
    }

    if (operative !== null) {
      const directive = applyGuardrail(limited.vector, operative, 1);
      set({
        prescription: { vector: directive.vector, source: 'guardrail', forDate: today },
        profileNotes: limited.notes,
        lastTriage: { kind: 'matched', directive },
      });
      return;
    }
    set({
      prescription: {
        vector: limited.vector,
        source: limited.notes.length > 0 ? 'profile' : 'policy',
        forDate: today,
      },
      profileNotes: limited.notes,
    });
  },

  setEmbedder: (e) => {
    embedder = e;
    set({ triageReady: e !== null });
  },

  reportSubjective: async (text) => {
    const { vector, today, triaging } = get();
    const raw = text.trim();
    if (vector === null || triaging) return;
    if (raw.length === 0 || raw.length > 500) return;
    set({ triaging: true });
    try {
      // Semantic routing is OPTIONAL; the keyword safety layer inside
      // resolveReport works with `null` (embedder absent or failed).
      let semantic: TriageResult | null = null;
      if (embedder !== null) {
        try {
          semantic = triage(await embedder.embed(raw), getCodebase());
        } catch {
          semantic = null;
        }
      }
      const resolved = resolveReport(raw, semantic);
      const d = getDb();
      if (!resolved.confident || resolved.entry === null) {
        // No curated match, no red-flag language: log for codebase curation,
        // change NOTHING about the prescription.
        d.executeSync(
          `INSERT INTO subjective_report (date, reported_at_ms, raw_text, matched_entry_id, similarity, halt, load_modifier, set_modifier, rpe_cap)
           VALUES (?, ?, ?, NULL, ?, 0, NULL, NULL, NULL)`,
          [today, Date.now(), raw, resolved.similarity],
        );
        set({ lastTriage: { kind: 'rejected' } });
        return;
      }
      // Persist the routing outcome; the applied numbers recorded here are
      // an audit snapshot (the operative prescription itself re-derives from
      // this row via computePrescription).
      const audit = applyGuardrail(
        get().prescription?.vector ?? getPrescription(vector).vector,
        resolved.entry,
        resolved.similarity ?? 1,
      );
      d.executeSync(
        `INSERT INTO subjective_report (date, reported_at_ms, raw_text, matched_entry_id, similarity, halt, load_modifier, set_modifier, rpe_cap)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          today, Date.now(), raw, resolved.entry.id, resolved.similarity,
          audit.halt ? 1 : 0, audit.vector.load_modifier,
          audit.vector.set_modifier, audit.vector.rpe_cap,
        ],
      );
      // Re-derive the operative prescription from persistence (single source
      // of truth; also sets lastTriage to the now-operative directive).
      get().computePrescription([]);
    } finally {
      set({ triaging: false });
    }
  },

  loadDemoAthlete: () => {
    const d = getDb();
    const existing = rowsOf<{ c: number }>(
      d.executeSync('SELECT count(*) AS c FROM session'),
    )[0];
    if (existing !== undefined && existing.c > 0) return; // never touch real data
    const adapter: DemoSql = {
      run: (sql, params = []) => {
        d.executeSync(sql, params as (string | number | null)[]);
      },
      one: <T,>(sql: string, params: readonly (string | number | null)[] = []) =>
        rowsOf<T>(d.executeSync(sql, params as (string | number | null)[]))[0],
    };
    const today = localToday();
    d.executeSync('BEGIN');
    try {
      generateDemoHistory(adapter, today, DEMO_DAYS);
      d.executeSync(SPO2_FOLD_SQL);
      d.executeSync(SPO2_TRIM_SQL, [Date.now() - 14 * 86_400_000]);
      for (const date of demoDates(today, DEMO_DAYS)) {
        d.executeSync(MATERIALIZE_STATE_VECTOR_SQL, [date]);
      }
      d.executeSync('COMMIT');
    } catch (e) {
      d.executeSync('ROLLBACK');
      set({ error: e instanceof Error ? e.message : String(e) });
      return;
    }
    const movements = rowsOf<Movement>(
      d.executeSync('SELECT movement_id, name, pattern FROM movement ORDER BY movement_id'),
    );
    set({ movements });
    get().refreshVector();
  },
}));
