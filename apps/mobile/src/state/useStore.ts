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
import { getPrescription, type MovementPattern, type Prescription, type StateVectorRow } from '@ak/inference';

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

interface KineticsStore {
  status: BootStatus;
  error: string | null;
  today: string;
  vector: StateVectorRow | null; // null = no state_vector row for today
  trend: TrendPoint[];           // trailing 14 days, ascending
  movements: Movement[];
  session: ActiveSession | null;
  prescription: (Prescription & { forDate: string }) | null;

  boot: () => void;
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
      set({ status: 'ready', error: null, movements, today: localToday() });
      get().refreshVector();
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
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
    d.executeSync(
      'INSERT INTO session (micro_cycle_id, session_date, started_at_ms) VALUES (NULL, ?, ?)',
      [today, startedAtMs],
    );
    const sessionId = rowsOf<{ id: number }>(
      d.executeSync('SELECT last_insert_rowid() AS id'),
    )[0]!.id;
    set({ session: { sessionId, date: today, startedAtMs, sets: [] } });
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
      // Load changed -> re-materialize today's State Vector (the SLM and the
      // dashboard both read the result; triggers already updated mech_daily).
      d.executeSync(MATERIALIZE_STATE_VECTOR_SQL, [s.date]);
    }
    set({ session: null });
    get().refreshVector();
  },

  computePrescription: (_patterns) => {
    const { vector, today } = get();
    if (vector === null) return;
    // Deterministic policy table — synchronous, infallible, zero downloads.
    // Subjective-report guardrails (semantic triage) refine this vector once
    // the on-device embedder adapter lands; the pipeline is already verified.
    set({ prescription: { ...getPrescription(vector), forDate: today } });
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
