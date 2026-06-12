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
  DEFAULT_PROFILE,
  derivePrescription,
  EQUIPMENT_ITEMS,
  generateBlock,
  isNoOpGuardrail,
  loadCodebase,
  RED_FLAG_PAIN,
  RED_FLAG_SYSTEMIC,
  resolveReport,
  triage,
  type Embedder,
  type GeneratorMovement,
  type LoadedCodebase,
  type MovementPattern,
  type PhraseCodebase,
  type PhraseEntry,
  targetLoadKg,
  type Prescription,
  type ProfileContext,
  type SchemaType,
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
  is_compound: boolean;
  /** Equipment items this movement needs (movement_equipment rows). */
  required: string[];
}

/** STRICT boolean equipment filter: available iff every required item is in
 *  the athlete's inventory. No-equipment movements are always available. */
export const isMovementAvailable = (
  m: Movement,
  inventory: readonly string[],
): boolean => m.required.every((item) => inventory.includes(item));

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
  /** Positive sentiment: identity pass-through, nothing changes — the UI
   *  shows a minimal acknowledgment, never a guardrail card. */
  | { kind: 'positive'; cue: string }
  | { kind: 'matched'; directive: SessionDirective };

/** One slot in the active session's workout plan. */
export interface PlanSlot {
  movementId: number;
  plannedSets: number;
}

// --- 4-week block (007 tables) ----------------------------------------------
export interface ActiveBlock {
  blockId: number;
  startDate: string;
  objective: string;
  createdAtMs: number;
}

/** One cell of the block grid (a planned training day). */
export interface BlockSessionSummary {
  plannedSessionId: number;
  weekIndex: number;
  dayIndex: number;
  focus: string;
  phase: string;
  sessionDate: string;
  slotCount: number;
  /** A real session with logged sets exists on this date. */
  trained: boolean;
}

export interface TodaySlot {
  slotIndex: number;
  plannedSlotId: number;
  movementId: number;
  movementName: string;
  sets: number;
  reps: number;
  targetRpe: number;
  /** APRE reactive load (slot_override), null when none applies. */
  overrideLoadKg: number | null;
  /** WHY the load moved — rendered verbatim as a badge. */
  overrideReason: string | null;
}

/** The active block's periodization metadata (block_meta side-car). */
export interface BlockMeta {
  schemaType: SchemaType;
  macroBlockIndex: number;
  macroPhase: string;
  peakShifted: boolean;
}

/** Today's planned session, null on rest days (the UI renders that state). */
export interface TodayPlan {
  plannedSessionId: number;
  focus: string;
  phase: string;
  slots: TodaySlot[];
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
  /** Active 4-week block, its grid, and today's planned session. */
  block: ActiveBlock | null;
  blockMeta: BlockMeta | null;
  blockSessions: BlockSessionSummary[];
  todayPlan: TodayPlan | null;
  /** Absolute 1RMs by movement_id (one_rep_max rows). */
  oneRepMaxes: Record<number, number>;
  /** Most recently completed session (post-session note target). */
  lastEndedSessionId: number | null;

  boot: () => void;
  /** Re-sync everything date-derived when the calendar day has changed since
   *  the last read (overnight backgrounding, app left open past midnight).
   *  Cheap no-op when the date is unchanged. */
  rolloverDay: () => void;
  /** Archive any active block and persist a freshly generated one (single
   *  SQLite transaction). Deterministic: profile + equipment + schema +
   *  macro position + today. Continues the 32-week macro-cycle. */
  generateNewBlock: (schemaType?: SchemaType) => void;
  /** Upsert (or clear with null) an absolute 1RM for a movement. */
  saveOneRepMax: (movementId: number, kg: number | null) => void;
  /** Attach/replace a free-text note on the last completed session. */
  saveSessionNote: (text: string) => void;
  /** Re-read active block + grid + today's plan from persistence. */
  refreshBlock: () => void;
  /** Synchronous read of a planned session's slots (grid detail view). */
  loadSessionSlots: (plannedSessionId: number) => TodaySlot[];
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

/** Layer-2 inputs from real training history, always for the CURRENT date —
 *  the active session never counts against itself. */
const profileCtx = (
  d: DB,
  today: string,
  activeSessionId: number,
): ProfileContext => ({
  sessionsToday: Number(rowsOf<{ c: number }>(d.executeSync(
    `SELECT count(DISTINCT s.session_id) AS c
     FROM session s JOIN set_record sr ON sr.session_id = s.session_id
     WHERE s.session_date = ? AND s.session_id != ?`,
    [today, activeSessionId],
  ))[0]?.c ?? 0),
  trainedDaysLast7: Number(rowsOf<{ c: number }>(d.executeSync(
    `SELECT count(DISTINCT s.session_date) AS c
     FROM session s JOIN set_record sr ON sr.session_id = s.session_id
     WHERE s.session_date >= date(?, '-6 days') AND s.session_date <= ?`,
    [today, today],
  ))[0]?.c ?? 0),
});

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

// --- movement row <-> object mapping ------------------------------------------
interface MovementRow {
  movement_id: number; name: string; pattern: string;
  is_compound: number; required_json: string | null;
}
const movementFromRow = (r: MovementRow): Movement => {
  let required: string[] = [];
  try {
    const v = JSON.parse(r.required_json ?? '[]') as unknown;
    if (Array.isArray(v)) required = v.filter((x): x is string => typeof x === 'string');
  } catch {
    /* unreadable requirement rows fail toward "needs nothing" */
  }
  return {
    movement_id: r.movement_id, name: r.name, pattern: r.pattern,
    is_compound: r.is_compound === 1, required,
  };
};

// --- profile row <-> object mapping ------------------------------------------
interface ProfileRow {
  objective: string; training_age: string; weekly_frequency: number;
  max_sessions_per_day: number; session_duration_cap_min: number;
  base_rpe_cap: number; target_energy_system: string;
  progression_methodology: string; injury_flags: string;
  mobility_limits: string; equipment_inventory: string;
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
const parseInventory = (json: string): UserProfile['equipment_inventory'] => {
  try {
    const v = JSON.parse(json) as unknown;
    if (!Array.isArray(v)) return [...EQUIPMENT_ITEMS];
    const seen = new Set(v.filter((x): x is string => typeof x === 'string'));
    return EQUIPMENT_ITEMS.filter((i) => seen.has(i)); // canonical order, known items
  } catch {
    return [...EQUIPMENT_ITEMS];
  }
};
const profileFromRow = (r: ProfileRow): UserProfile => ({
  ...(DEFAULT_PROFILE as UserProfile),
  ...r,
  injury_flags: parseBodyNotes(r.injury_flags),
  mobility_limits: parseBodyNotes(r.mobility_limits),
  equipment_inventory: parseInventory(r.equipment_inventory),
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
  block: null,
  blockMeta: null,
  blockSessions: [],
  todayPlan: null,
  oneRepMaxes: {},
  lastEndedSessionId: null,

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
      const movements = rowsOf<MovementRow>(
        getDb().executeSync(
          'SELECT m.movement_id, m.name, m.pattern, m.is_compound, (SELECT json_group_array(me.item) FROM movement_equipment me WHERE me.movement_id = m.movement_id) AS required_json FROM movement m ORDER BY m.movement_id',
        ),
      ).map(movementFromRow);
      const profileRow = rowsOf<ProfileRow>(
        getDb().executeSync('SELECT * FROM athlete_profile WHERE profile_id = 1'),
      )[0];
      const rms = rowsOf<{ movement_id: number; load_kg: number }>(
        getDb().executeSync('SELECT movement_id, load_kg FROM one_rep_max'),
      );
      set({
        oneRepMaxes: Object.fromEntries(rms.map((r) => [r.movement_id, r.load_kg])),
        status: 'ready',
        error: null,
        movements,
        today: localToday(),
        profile: profileRow !== undefined ? profileFromRow(profileRow) : DEFAULT_PROFILE,
      });
      get().refreshVector();
      // The block lives only in SQLite; the store is a read surface over it.
      get().refreshBlock();
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
    // Canonical inventory: dedupe, drop unknown items, EQUIPMENT_ITEMS order
    // (the block generator's determinism depends on a stable order).
    const owned = new Set(merged.equipment_inventory);
    merged.equipment_inventory = EQUIPMENT_ITEMS.filter((i) => owned.has(i));
    getDb().executeSync(
      `UPDATE athlete_profile SET
         objective = ?, training_age = ?, weekly_frequency = ?,
         max_sessions_per_day = ?, session_duration_cap_min = ?, base_rpe_cap = ?,
         target_energy_system = ?, progression_methodology = ?,
         injury_flags = ?, mobility_limits = ?, equipment_inventory = ?, updated_at_ms = ?
       WHERE profile_id = 1`,
      [
        merged.objective, merged.training_age, merged.weekly_frequency,
        merged.max_sessions_per_day, merged.session_duration_cap_min, merged.base_rpe_cap,
        merged.target_energy_system, merged.progression_methodology,
        JSON.stringify(merged.injury_flags), JSON.stringify(merged.mobility_limits),
        JSON.stringify(merged.equipment_inventory), Date.now(),
      ],
    );
    set({ profile: merged });
    // Re-derive: profile clamps may have changed the operative prescription.
    if (get().prescription !== null) get().computePrescription([]);
  },

  rolloverDay: () => {
    if (get().status !== 'ready') return;
    if (localToday() === get().today) return;
    // New calendar day: yesterday's reports no longer govern, today's plan
    // cell moves, the trailing-week materialization may be missing a day.
    const d = getDb();
    for (const date of demoDates(localToday(), 7)) {
      d.executeSync(MATERIALIZE_STATE_VECTOR_SQL, [date]);
    }
    get().refreshVector();   // also advances store.today
    get().refreshBlock();
    get().computePrescription([]);
  },

  generateNewBlock: (schemaType = 'LINEAR') => {
    const { profile, movements, status, vector } = get();
    if (status !== 'ready') return;
    const d = getDb();
    // Macro continuation: the next block advances through the 32-week cycle
    // (8 positions, wrapping) from wherever the last generated block sat.
    const lastMeta = rowsOf<{ macro_block_index: number }>(d.executeSync(
      'SELECT macro_block_index FROM block_meta ORDER BY block_id DESC LIMIT 1',
    ))[0];
    const macroBlockIndex = lastMeta !== undefined
      ? (lastMeta.macro_block_index % 8) + 1
      : 1;
    // The generator is pure; everything stateful happens in ONE transaction
    // below so a mid-write crash leaves the previous block fully active.
    const genMovements: GeneratorMovement[] = movements.map((m) => ({
      movement_id: m.movement_id,
      name: m.name,
      pattern: m.pattern as MovementPattern,
      is_compound: m.is_compound,
      required: m.required,
    }));
    const plan = generateBlock({
      profile,
      movements: genMovements,
      startDate: localToday(),
      schemaType,
      macroBlockIndex,
      recentAcwr: vector !== null ? vector.acwr : null,
    });
    d.executeSync('BEGIN');
    try {
      d.executeSync(
        "UPDATE training_block SET status = 'archived' WHERE status = 'active'",
      );
      d.executeSync(
        'INSERT INTO training_block (start_date, objective, created_at_ms) VALUES (?, ?, ?)',
        [plan.start_date, plan.objective, Date.now()],
      );
      const blockId = rowsOf<{ id: number }>(
        d.executeSync('SELECT last_insert_rowid() AS id'),
      )[0]!.id;
      d.executeSync(
        'INSERT INTO block_meta (block_id, macro_block_index, macro_phase, schema_type, peak_shifted) VALUES (?, ?, ?, ?, ?)',
        [blockId, plan.macroBlockIndex, plan.macroPhase, plan.schemaType, plan.peakShifted ? 1 : 0],
      );
      for (const s of plan.sessions) {
        d.executeSync(
          'INSERT INTO planned_session (block_id, week_index, day_index, focus, phase, session_date) VALUES (?, ?, ?, ?, ?, ?)',
          [blockId, s.week_index, s.day_index, s.focus, s.phase, s.session_date],
        );
        const sessionId = rowsOf<{ id: number }>(
          d.executeSync('SELECT last_insert_rowid() AS id'),
        )[0]!.id;
        for (const sl of s.slots) {
          d.executeSync(
            'INSERT INTO planned_slot (planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (?, ?, ?, ?, ?, ?)',
            [sessionId, sl.slot_index, sl.movement_id, sl.sets, sl.reps, sl.target_rpe],
          );
        }
      }
      d.executeSync('COMMIT');
    } catch (e) {
      d.executeSync('ROLLBACK');
      set({ error: e instanceof Error ? e.message : String(e) });
      return;
    }
    get().refreshBlock();
  },

  refreshBlock: () => {
    const d = getDb();
    const today = localToday();
    const blockRow = rowsOf<{
      block_id: number; start_date: string; objective: string; created_at_ms: number;
    }>(d.executeSync(
      "SELECT block_id, start_date, objective, created_at_ms FROM training_block WHERE status = 'active' ORDER BY block_id DESC LIMIT 1",
    ))[0];
    if (blockRow === undefined) {
      set({ block: null, blockMeta: null, blockSessions: [], todayPlan: null });
      return;
    }
    const metaRow = rowsOf<{
      macro_block_index: number; macro_phase: string; schema_type: string; peak_shifted: number;
    }>(d.executeSync(
      'SELECT macro_block_index, macro_phase, schema_type, peak_shifted FROM block_meta WHERE block_id = ?',
      [blockRow.block_id],
    ))[0];
    const sessions = rowsOf<{
      planned_session_id: number; week_index: number; day_index: number;
      focus: string; phase: string; session_date: string; slot_count: number;
      trained: number;
    }>(d.executeSync(
      `SELECT ps.planned_session_id, ps.week_index, ps.day_index, ps.focus, ps.phase,
              ps.session_date, count(sl.planned_slot_id) AS slot_count,
              EXISTS (SELECT 1 FROM session s JOIN set_record sr ON sr.session_id = s.session_id
                      WHERE s.session_date = ps.session_date) AS trained
       FROM planned_session ps
       LEFT JOIN planned_slot sl ON sl.planned_session_id = ps.planned_session_id
       WHERE ps.block_id = ?
       GROUP BY ps.planned_session_id
       ORDER BY ps.week_index, ps.day_index`,
      [blockRow.block_id],
    ));
    const blockSessions: BlockSessionSummary[] = sessions.map((s) => ({
      plannedSessionId: s.planned_session_id,
      weekIndex: s.week_index,
      dayIndex: s.day_index,
      focus: s.focus,
      phase: s.phase,
      sessionDate: s.session_date,
      slotCount: s.slot_count,
      trained: s.trained === 1,
    }));
    // Rest-day fallback: no planned session today is a normal, renderable
    // state (todayPlan null) — never an error.
    const todayRow = blockSessions.find((s) => s.sessionDate === today);
    const todayPlan: TodayPlan | null = todayRow === undefined
      ? null
      : {
          plannedSessionId: todayRow.plannedSessionId,
          focus: todayRow.focus,
          phase: todayRow.phase,
          slots: get().loadSessionSlots(todayRow.plannedSessionId),
        };
    set({
      block: {
        blockId: blockRow.block_id,
        startDate: blockRow.start_date,
        objective: blockRow.objective,
        createdAtMs: blockRow.created_at_ms,
      },
      blockMeta: metaRow !== undefined
        ? {
            schemaType: metaRow.schema_type as SchemaType,
            macroBlockIndex: metaRow.macro_block_index,
            macroPhase: metaRow.macro_phase,
            peakShifted: metaRow.peak_shifted === 1,
          }
        : null, // pre-009 blocks have no meta; UI treats them as LINEAR-era
      blockSessions,
      todayPlan,
    });
  },

  saveOneRepMax: (movementId, kg) => {
    const d = getDb();
    if (kg === null) {
      d.executeSync('DELETE FROM one_rep_max WHERE movement_id = ?', [movementId]);
    } else {
      const safe = clamp(Math.round(kg / 2.5) * 2.5, 20, 500);
      d.executeSync(
        'INSERT INTO one_rep_max (movement_id, load_kg, updated_at_ms) VALUES (?, ?, ?) ON CONFLICT(movement_id) DO UPDATE SET load_kg = excluded.load_kg, updated_at_ms = excluded.updated_at_ms',
        [movementId, safe, Date.now()],
      );
    }
    const rms = rowsOf<{ movement_id: number; load_kg: number }>(
      d.executeSync('SELECT movement_id, load_kg FROM one_rep_max'),
    );
    set({ oneRepMaxes: Object.fromEntries(rms.map((r) => [r.movement_id, r.load_kg])) });
  },

  saveSessionNote: (text) => {
    const sessionId = get().lastEndedSessionId;
    const raw = text.trim().slice(0, 1000);
    if (sessionId === null || raw.length === 0) return;
    getDb().executeSync(
      'INSERT INTO session_note (session_id, note, created_at_ms) VALUES (?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET note = excluded.note, created_at_ms = excluded.created_at_ms',
      [sessionId, raw, Date.now()],
    );
  },

  loadSessionSlots: (plannedSessionId) => {
    const slots = rowsOf<{
      slot_index: number; planned_slot_id: number; movement_id: number;
      movement_name: string; sets: number; reps: number; target_rpe: number;
      override_load_kg: number | null; override_reason: string | null;
    }>(getDb().executeSync(
      `SELECT sl.slot_index, sl.planned_slot_id, sl.movement_id, m.name AS movement_name,
              sl.sets, sl.reps, sl.target_rpe,
              so.target_load_kg AS override_load_kg, so.reason AS override_reason
       FROM planned_slot sl
       JOIN movement m ON m.movement_id = sl.movement_id
       LEFT JOIN slot_override so ON so.planned_slot_id = sl.planned_slot_id
       WHERE sl.planned_session_id = ?
       ORDER BY sl.slot_index`,
      [plannedSessionId],
    ));
    return slots.map((sl) => ({
      slotIndex: sl.slot_index,
      plannedSlotId: sl.planned_slot_id,
      movementId: sl.movement_id,
      movementName: sl.movement_name,
      sets: sl.sets,
      reps: sl.reps,
      targetRpe: sl.target_rpe,
      overrideLoadKg: sl.override_load_kg,
      overrideReason: sl.override_reason,
    }));
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
    // Past midnight, todayPlan/prescription may be yesterday's — re-sync
    // before seeding so the athlete gets TODAY'S planned session.
    get().rolloverDay();
    // Safety floor (gate-independent): an operative halt refuses to start a
    // session no matter which button asked.
    const triageNow = get().lastTriage;
    if (triageNow !== null && triageNow.kind === 'matched' && triageNow.directive.halt) return;
    const today = localToday();
    const startedAtMs = Date.now();
    const d = getDb();
    // Seed the workout plan BEFORE creating the new row. Source of truth, in
    // order: today's planned block session (slot sets + today's set_modifier),
    // else the most recent completed session (pre-block behavior).
    const { prescription, todayPlan } = get();
    const setDelta = prescription !== null && prescription.forDate === today
      ? prescription.vector.set_modifier
      : 0;
    let sessionPlan: PlanSlot[];
    if (todayPlan !== null) {
      sessionPlan = todayPlan.slots.map((sl) => ({
        movementId: sl.movementId,
        plannedSets: Math.round(clamp(sl.sets + setDelta, 1, 6)),
      }));
    } else {
      const plannedSets = Math.round(clamp(3 + setDelta, 1, 6));
      const lastMovements = rowsOf<{ movement_id: number }>(d.executeSync(
        `SELECT movement_id FROM set_record
         WHERE session_id = (
           SELECT s.session_id FROM session s
           JOIN set_record r ON r.session_id = s.session_id
           ORDER BY s.session_id DESC LIMIT 1)
         GROUP BY movement_id ORDER BY MIN(set_id)`,
      ));
      sessionPlan = lastMovements.map((m) => ({
        movementId: m.movement_id,
        plannedSets,
      }));
    }
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

      // APRE reactive mutation: in an APRE block, beating a slot's rep
      // target raises the SAME movement's load next week (slot_override,
      // +2.5 kg per 2 surplus reps, capped +7.5) with a reason the UI shows
      // verbatim — the athlete must never wonder why the bar got heavier.
      const { todayPlan, blockMeta, oneRepMaxes } = get();
      if (blockMeta !== null && blockMeta.schemaType === 'APRE' && todayPlan !== null) {
        const weekRow = rowsOf<{ week_index: number; block_id: number }>(d.executeSync(
          'SELECT week_index, block_id FROM planned_session WHERE planned_session_id = ?',
          [todayPlan.plannedSessionId],
        ))[0];
        if (weekRow !== undefined && weekRow.week_index < 4) {
          for (const slot of todayPlan.slots) {
            const oneRm = oneRepMaxes[slot.movementId];
            if (oneRm === undefined) continue; // no absolute base to progress
            const bestReps = s.sets
              .filter((x) => x.movement_id === slot.movementId)
              .reduce((m, x) => Math.max(m, x.reps), 0);
            const surplus = bestReps - slot.reps;
            if (surplus <= 0) continue;
            const nextSlot = rowsOf<{
              planned_slot_id: number; reps: number; target_rpe: number;
            }>(d.executeSync(
              'SELECT sl.planned_slot_id, sl.reps, sl.target_rpe FROM planned_slot sl JOIN planned_session ps ON ps.planned_session_id = sl.planned_session_id WHERE ps.block_id = ? AND ps.week_index = ? AND sl.movement_id = ? ORDER BY ps.day_index LIMIT 1',
              [weekRow.block_id, weekRow.week_index + 1, slot.movementId],
            ))[0];
            if (nextSlot === undefined) continue;
            const deltaKg = Math.min(7.5, Math.ceil(surplus / 2) * 2.5);
            const existing = rowsOf<{ target_load_kg: number }>(d.executeSync(
              'SELECT target_load_kg FROM slot_override WHERE planned_slot_id = ?',
              [nextSlot.planned_slot_id],
            ))[0];
            const base = existing !== undefined
              ? existing.target_load_kg
              : targetLoadKg(oneRm, nextSlot.reps, nextSlot.target_rpe);
            d.executeSync(
              'INSERT INTO slot_override (planned_slot_id, target_load_kg, reason, created_at_ms) VALUES (?, ?, ?, ?) ON CONFLICT(planned_slot_id) DO UPDATE SET target_load_kg = excluded.target_load_kg, reason = excluded.reason, created_at_ms = excluded.created_at_ms',
              [
                nextSlot.planned_slot_id,
                clamp(base + deltaKg, 2.5, 600),
                `APRE: +${deltaKg} kg, beat the ${slot.reps}-rep target by ${surplus} last week`,
                Date.now(),
              ],
            );
          }
        }
      }
    }
    set({
      session: null,
      sessionPlan: [],
      activeMovementId: null,
      lastEndedSessionId: s.sets.length > 0 ? s.sessionId : null,
    });
    get().refreshVector();
    // Logged work changes the grid's trained markers.
    get().refreshBlock();
    // Session count changed: the daily/weekly profile clamps may now bind.
    get().computePrescription([]);
  },

  computePrescription: (_patterns) => {
    const { vector, profile, session } = get();
    if (vector === null) return;
    const d = getDb();
    // ALWAYS the real current date — a store snapshot can be yesterday's
    // (app open past midnight) and would re-read yesterday's reports.
    const today = localToday();

    // The whole three-layer derivation is the pure, machine-verified
    // derivePrescription (verify:policy [6]); this is only its SQL adapter.
    // Deriving from the database means a halt survives an app kill and a
    // profile edit can never resurrect a damped prescription.
    const reports = rowsOf<{ matched_entry_id: string }>(d.executeSync(
      'SELECT matched_entry_id FROM subjective_report WHERE date = ? AND matched_entry_id IS NOT NULL ORDER BY report_id',
      [today],
    ))
      .map((r) => entryById(r.matched_entry_id))
      .filter((e): e is PhraseEntry => e !== undefined);
    const derived = derivePrescription({
      vector,
      profile,
      ctx: profileCtx(d, today, session !== null ? session.sessionId : -1),
      reports,
    });
    set({
      prescription: { vector: derived.vector, source: derived.source, forDate: today },
      profileNotes: derived.notes,
      // Mirror persistence exactly: no operative report today means no
      // banner — a stale in-memory halt must never outlive its day.
      lastTriage: derived.directive !== null
        ? { kind: 'matched', directive: derived.directive }
        : null,
      today,
    });
  },

  setEmbedder: (e) => {
    embedder = e;
    set({ triageReady: e !== null });
  },

  reportSubjective: async (text) => {
    // A report typed after midnight must land on the NEW day — persisting it
    // under a stale date would make the resulting halt vanish on restart.
    get().rolloverDay();
    const { vector, triaging } = get();
    const today = localToday();
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
      // Persist the routing outcome. The audit snapshot uses the SAME pure
      // derivation as the operative path (this entry alone on today's
      // profile-limited base) — never the current prescription, which may
      // already carry another guardrail (compounding) or yesterday's date.
      const activeSession = get().session;
      const audit = derivePrescription({
        vector,
        profile: get().profile,
        ctx: profileCtx(d, today, activeSession !== null ? activeSession.sessionId : -1),
        reports: [resolved.entry],
      });
      const auditHalt = audit.directive !== null && audit.directive.halt;
      d.executeSync(
        `INSERT INTO subjective_report (date, reported_at_ms, raw_text, matched_entry_id, similarity, halt, load_modifier, set_modifier, rpe_cap)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          today, Date.now(), raw, resolved.entry.id, resolved.similarity,
          auditHalt ? 1 : 0, audit.vector.load_modifier,
          audit.vector.set_modifier, audit.vector.rpe_cap,
        ],
      );
      // Re-derive the operative prescription from persistence (single source
      // of truth; also sets lastTriage to the now-operative directive).
      get().computePrescription([]);
      // Positive identity pass-through: a no-op entry never reads as a
      // guardrail. Acknowledge it — unless a restrictive report from earlier
      // today still governs, in which case the honest card is the directive.
      if (isNoOpGuardrail(resolved.entry.guardrail) && get().lastTriage === null) {
        set({ lastTriage: { kind: 'positive', cue: resolved.entry.cue } });
      }
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
    const movements = rowsOf<MovementRow>(
      d.executeSync('SELECT m.movement_id, m.name, m.pattern, m.is_compound, (SELECT json_group_array(me.item) FROM movement_equipment me WHERE me.movement_id = m.movement_id) AS required_json FROM movement m ORDER BY m.movement_id'),
    ).map(movementFromRow);
    set({ movements });
    get().refreshVector();
  },
}));
