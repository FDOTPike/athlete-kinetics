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
  closeKineticsDb,
  demoDates,
  generateDemoHistory,
  migrate,
  openKineticsDb,
  type DemoSql,
} from '@ak/core-db';
import {
  activeEntry,
  addAthlete,
  removeAthlete as regRemoveAthlete,
  renameAthlete as regRenameAthlete,
  setActiveAthlete,
  type AthleteEntry,
} from './athleteRegistryCore';
import { loadRegistry, saveRegistry } from './athleteRegistry';
import {
  buildPatternWindow,
  computeSubstitutions,
  DEFAULT_PROFILE,
  detectFlaws,
  derivePrescription,
  ENERGY_SYSTEMS,
  EQUIPMENT_ITEMS,
  EXPERIENCE_SEVERITY,
  generateBlock,
  OBJECTIVES,
  PROGRESSION_METHODS,
  TRAINING_AGES,
  isNoOpGuardrail,
  JOINTS,
  loadCodebase,
  MOVEMENT_PREFERENCE,
  MOVEMENT_PREFIXES,
  RED_FLAG_PAIN,
  RED_FLAG_SYSTEMIC,
  resolveReport,
  triage,
  type DaySwapOption,
  type DifficultyRating,
  type Embedder,
  type FutureSlot,
  type GeneratorMovement,
  type Guardrail,
  type Joint,
  type LoadedCodebase,
  type MovementPattern,
  type MovementPrefix,
  type MovementPrefixCondition,
  type MovementPreference,
  type NiggleInput,
  type PhraseCodebase,
  type SubstitutionMovement,
  type SubstitutionResult,
  type PhraseEntry,
  calculateEffectiveLoad,
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
import type { BiometricsBridge } from '@ak/biometrics';
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
  /** movement_beginner_whitelist membership — an Intermediate staple a
   *  beginner may see/be prescribed (plan P16 S4). */
  beginnerOk: boolean;
  /** Equipment items this movement needs (movement_equipment rows). */
  required: string[];
  /** movement_detail.base_name — the normalized pattern the prefix engine
   *  prepends onto (e.g. 'Bench Press'); falls back to `name` when no 010
   *  detail row exists. */
  baseName: string;
  /** movement_detail.supported_prefixes — the per-movement implement dropdown
   *  (a subset of MOVEMENT_PREFIXES). Empty when bodyweight/undetailed. */
  supportedPrefixes: MovementPrefix[];
  /** movement_detail.difficulty_rating; defaults to Intermediate. */
  difficulty: DifficultyRating;
  /** movement_preference.preference — thumbs sentiment. 0/neutral when no row
   *  exists (the 010 invariant: neutral is the ABSENCE of a row). */
  preference: MovementPreference;
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
  /** Saved profile snapshots (013 multi-tenancy); exactly one is active and
   *  mirrors `profile` / athlete_profile. */
  profileSlots: ProfileSlot[];
  /** Phase 13: movement_prefix (014) hydrated at boot as MovementPrefixCondition
   *  objects — the condition weights the Session tab folds via conditionEngine. */
  movementPrefixes: MovementPrefixCondition[];
  /** True when the semantic embedder is wired; the keyword safety layer
   *  works regardless. */
  triageReady: boolean;
  triaging: boolean;
  lastTriage: TriageOutcome | null;
  sessionPlan: PlanSlot[];
  activeMovementId: number | null;
  /** Open substitution sheet: the deterministic engine's 3-tier result for a
   *  SWAP target (null = closed). */
  substitution: { targetId: number; result: SubstitutionResult } | null;
  /** Today's active niggles (region + severity), fed verbatim into
   *  computeSubstitutions — they drive the injury guardrail and Layer 3. */
  niggles: NiggleInput[];
  /** Active 4-week block, its grid, and today's planned session. */
  block: ActiveBlock | null;
  blockMeta: BlockMeta | null;
  blockSessions: BlockSessionSummary[];
  todayPlan: TodayPlan | null;
  /** Absolute 1RMs by movement_id (one_rep_max rows). */
  oneRepMaxes: Record<number, number>;
  /** Most recently completed session (post-session note target). */
  lastEndedSessionId: number | null;
  /** Health Connect state: 'off' until probed; 'idle' = available but not
   *  yet authorized (CONNECT shown). Never blocks anything. */
  biometricsStatus: 'off' | 'unavailable' | 'idle' | 'denied' | 'ready';
  /** Coach Mode (Phase 15): registered athletes — one SQLite FILE each, so
   *  sessions/telemetry/blocks never bleed between people. The registry is a
   *  document-dir JSON side-file (it selects which DB to open, so it cannot
   *  live inside one). */
  athletes: AthleteEntry[];
  activeAthleteId: string;
  /** False until this athlete's profile has been saved at least once
   *  (athlete_profile.updated_at_ms > 0) — routes first run to the
   *  onboarding questionnaire. Defaults true pre-boot to avoid a wizard
   *  flash on existing installs. */
  onboarded: boolean;

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
  /** Wire the Health Connect bridge (null = unavailable). READ-ONLY at
   *  boot: checks existing grants, NEVER opens a permission sheet (the
   *  v0.11.0 boot crash lived in an automatic boot-time request). */
  connectBiometrics: (bridge: BiometricsBridge | null) => Promise<void>;
  /** Explicit user action (CONNECT on ATHLETE): opens the system permission
   *  sheet, then syncs on grant. Never throws. */
  requestBiometricsAccess: () => Promise<void>;
  /** Foreground-only ingestion: compacted trailing-week biometrics upserted
   *  into the 002 rollups, then the state vector re-materializes. Silent
   *  no-op on any failure (subjective-only fallback). */
  syncBiometrics: () => Promise<void>;
  /** Re-read active block + grid + today's plan from persistence. */
  refreshBlock: () => void;
  /** Synchronous read of a planned session's slots (grid detail view). */
  loadSessionSlots: (plannedSessionId: number) => TodaySlot[];
  setEmbedder: (e: Embedder | null) => void;
  saveProfile: (patch: Partial<UserProfile>) => void;
  /** Re-read the saved profile slots (013) into state. */
  refreshProfileSlots: () => void;
  /** Switch the active profile: snapshot the live profile back into its slot,
   *  load the chosen slot into athlete_profile, then wipe block state (so the
   *  new profile regenerates cleanly). Destructive — clears the active block +
   *  today's reports/niggles. */
  switchProfile: (slotId: number) => void;
  /** Hard-DELETE the active block (+ cascade) and today's volatile reports +
   *  niggles, in one transaction. Training history (set_record) is preserved. */
  wipeActiveBlockState: () => void;
  /** Coach Mode: close the current athlete's DB and re-boot against the
   *  target athlete's file. Refused while a session is active. */
  switchAthlete: (id: string) => void;
  /** Coach Mode: register a new athlete (fresh, empty DB file) and switch to
   *  them — a fresh file has updated_at_ms = 0, so they land in onboarding. */
  createAthlete: (name: string) => void;
  /** Coach Mode: rename a registry entry (display name only). */
  renameAthleteEntry: (id: string, name: string) => void;
  /** Coach Mode: remove a non-active, non-default athlete from the registry
   *  and best-effort delete their DB file. */
  deleteAthlete: (id: string) => void;
  /** Onboarding completion: persist every answer in ONE save (no partial
   *  profiles), name the athlete, and enter the app. */
  completeOnboarding: (patch: Partial<UserProfile>, athleteName: string) => void;
  /** Triage a free-text complaint with a forced 1-10 severity (Phase 12 Step
   *  5). The severity gates the matched guardrail by training age. */
  reportSubjective: (text: string, severity: number) => Promise<void>;
  selectMovement: (movementId: number) => void;
  addPlanSlot: (movementId: number) => void;
  swapMovement: (oldMovementId: number, newMovementId: number) => void;
  /** Thumbs sentiment for a movement. NEUTRAL (0) DELETEs the row (the 010
   *  invariant: neutral == no row); AVOID (-1) / PRIORITIZE (+1) upsert it.
   *  The deterministic substitution router reads this map. */
  setMovementPreference: (movementId: number, preference: MovementPreference) => void;
  /** Open the deterministic substitution sheet for a SWAP target: assembles the
   *  engine inputs (library projection + the active block's future slots +
   *  today's active niggles, re-read fresh) and runs computeSubstitutions. The
   *  niggles drive the injury guardrail and Layer 3 triage. */
  openSubstitution: (targetMovementId: number) => void;
  closeSubstitution: () => void;
  /** Apply a Layer-1 regression: swap the target slot for the chosen movement
   *  (logged sets stand as history). */
  applyRegression: (targetMovementId: number, optionMovementId: number) => void;
  /** Apply a Layer-2 day-swap: replace today's target with the pulled movement
   *  AND delete its origin future planned_slot (conservation of volume — the
   *  moved work is performed today instead of on its scheduled day). */
  applyDaySwap: (targetMovementId: number, option: DaySwapOption) => void;
  /** Log a niggle (append-only to 011) and add it to the active niggle set so
   *  the next SWAP un-hides Layer 3 / activates the guardrail. */
  reportNiggle: (region: string, severity: number) => void;
  /** Reload today's niggles from 011 into state (boot + day rollover). */
  refreshNiggles: () => void;
  refreshVector: () => void;
  startSession: () => void;
  /** Append a logged set. `displayName` carries the prefix-engine
   *  concatenation (e.g. 'DB Bench Press') into the in-memory log payload;
   *  falls back to the movement's canonical name when absent. `appliedPrefixes`
   *  (Phase 13) are the toggled condition tokens; their compound multipliers +
   *  effective load are persisted to the set_prefix side-car. */
  logSet: (movementId: number, reps: number, loadKg: number, rpe: number, displayName?: string, appliedPrefixes?: readonly MovementPrefix[]) => void;
  /** Hard-delete one logged set. The 001 AFTER DELETE trigger
   *  (trg_set_record_ad) drains mech_daily by this row's exact contribution;
   *  the in-memory list drops the row. */
  deleteSet: (setId: number) => void;
  /** Edit one logged set's reps/load/RPE in place. The 001 AFTER UPDATE
   *  trigger (trg_set_record_au) re-deltas mech_daily. NOTE: "sets" is not a
   *  per-row attribute — each set_record row IS one set; change the count by
   *  adding/deleting rows, not by editing one. */
  editSet: (setId: number, reps: number, loadKg: number, rpe: number) => void;
  endSession: () => void;
  computePrescription: (patterns: readonly MovementPattern[]) => void;
  /** First-run affordance: 180-day deterministic demo athlete. Refuses to run
   *  unless the database is empty — it must never touch real training data. */
  loadDemoAthlete: () => void;
  /** DESTRUCTIVE: wipe ALL training history + telemetry + derived state
   *  (sessions, sets, blocks, cycles, telemetry, state_vector, niggles,
   *  reports, 1RMs) so the demo athlete can be loaded fresh. KEEPS the
   *  athlete_profile, the movement library, preferences, and saved profile
   *  slots. The caller is expected to confirm first (the UI shows an alert).
   *  Returns true if it actually cleared anything. */
  resetTrainingData: () => boolean;
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

/** Local-midnight epoch ms — the lower bound for "today's" (active) niggles. */
const startOfTodayMs = (): number => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Local Y-M-D for an epoch-ms instant — mirrors localToday()/startOfTodayMs()
 *  so the autopilot buckets a niggle on the SAME calendar day as the session /
 *  state_vector / active-niggle paths (NEVER SQLite's UTC date(), which would
 *  mis-date an evening niggle in a UTC-negative zone). */
const localDateOf = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** A neutral placeholder state_vector row for a calendar day with no
 *  materialized row (a pure rest day). The autopilot reads ONLY the window
 *  length from these, never their fields — they exist so detectFlaws sees a
 *  fixed 21-CALENDAR-day grid (preserving the per-calendar-day EMA recency),
 *  not a gap-collapsed list of only training/telemetry days. */
const blankVector = (date: string): StateVectorRow => ({
  date, readiness_score: 50, hrv_component: 50, load_component: 50,
  sleep_component: 50, spo2_component: 50, acwr: null, acute_load_kg: null,
  chronic_load_kg: null, ln_rmssd: null, hrv_z: null,
  sleep_efficiency_pct: null, spo2_night_mean: null, computed_at_ms: 0,
});

/** Valid niggle regions (the engine's structural joints). */
const JOINT_SET = new Set<string>(JOINTS);
/** Per-process monotonic counter feeding the niggle TEXT id (combined with a
 *  random suffix so a restart that resets it to 0 can never collide). */
let niggleSeq = 0;

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
/** Health Connect bridge; null = device cannot serve biometrics (by design,
 *  nothing else in the app changes — subjective-triage-only routing). */
let biometrics: BiometricsBridge | null = null;
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
  // 010 LEFT JOINs — null when no movement_detail / movement_preference row.
  base_name: string | null; supported_prefixes: string | null;
  difficulty_rating: string | null; preference: number | null;
  beginner_ok: number | null;
}
const PREFIX_SET = new Set<string>(MOVEMENT_PREFIXES);
/** Parse movement_detail.supported_prefixes, keeping only canonical tokens —
 *  an unknown/garbage token is dropped rather than offered in the dropdown. */
const parsePrefixes = (json: string | null): MovementPrefix[] => {
  try {
    const v = JSON.parse(json ?? '[]') as unknown;
    return Array.isArray(v)
      ? v.filter((x): x is MovementPrefix => typeof x === 'string' && PREFIX_SET.has(x))
      : [];
  } catch {
    return [];
  }
};
/** Coerce a raw preference cell to the {-1,0,1} domain (null/garbage -> 0). */
const toPreference = (n: number | null): MovementPreference =>
  n === MOVEMENT_PREFERENCE.AVOID || n === MOVEMENT_PREFERENCE.PRIORITIZE
    ? n
    : MOVEMENT_PREFERENCE.NEUTRAL;
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
    baseName: r.base_name ?? r.name,
    supportedPrefixes: parsePrefixes(r.supported_prefixes),
    difficulty: (r.difficulty_rating ?? 'Intermediate') as DifficultyRating,
    beginnerOk: r.beginner_ok === 1,
    preference: toPreference(r.preference),
  };
};

/** Project a store Movement onto the substitution engine's input shape. The
 *  engine never reads SQL; the store assembles this from 001 + 010 columns. */
const toSubMovement = (m: Movement): SubstitutionMovement => ({
  movement_id: m.movement_id,
  name: m.name,
  pattern: m.pattern as MovementPattern,
  is_compound: m.is_compound,
  difficulty: m.difficulty,
  beginnerOk: m.beginnerOk,
  family: m.baseName,
  required: m.required,
  preference: m.preference,
});

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

// --- profile slots (013) + state wipe ----------------------------------------
/** A saved profile snapshot (profile_slot row), projected for the UI. */
export interface ProfileSlot {
  slotId: number;
  name: string;
  trainingAge: string;
  isActive: boolean;
}

/** Write a profile into the single athlete_profile row (shared by saveProfile
 *  and the profile switch). */
const persistProfileFields = (d: DB, p: UserProfile): void => {
  d.executeSync(
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

/** Serialize a profile to the profile_slot JSON snapshot shape. */
const profileToJsonString = (p: UserProfile): string => JSON.stringify({
  objective: p.objective, training_age: p.training_age,
  weekly_frequency: p.weekly_frequency, max_sessions_per_day: p.max_sessions_per_day,
  session_duration_cap_min: p.session_duration_cap_min, base_rpe_cap: p.base_rpe_cap,
  target_energy_system: p.target_energy_system, progression_methodology: p.progression_methodology,
  injury_flags: p.injury_flags, mobility_limits: p.mobility_limits,
  equipment_inventory: p.equipment_inventory,
});

/** Coerce a value into an enum, falling back to a default when it is not a
 *  member — so a corrupt/hand-edited slot can NEVER carry an out-of-domain enum
 *  into the athlete_profile CHECKs. */
const inEnum = <T extends string>(v: unknown, arr: readonly T[], d: T): T =>
  typeof v === 'string' && (arr as readonly string[]).includes(v) ? (v as T) : d;

/** Parse a profile_slot snapshot back to a UserProfile. Fully VALIDATED +
 *  CLAMPED here (enum membership + numeric domains) so the result always
 *  satisfies the athlete_profile CHECKs — the switch persists it atomically and
 *  must never throw on a malformed slot. Falls back to DEFAULT_PROFILE on any
 *  parse failure. */
const profileFromJsonString = (json: string): UserProfile => {
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    const num = (k: string, lo: number, hi: number, d: number): number =>
      clamp(typeof o[k] === 'number' ? (o[k] as number) : d, lo, hi);
    return {
      ...DEFAULT_PROFILE,
      objective: inEnum(o.objective, OBJECTIVES, DEFAULT_PROFILE.objective),
      training_age: inEnum(o.training_age, TRAINING_AGES, DEFAULT_PROFILE.training_age),
      weekly_frequency: Math.round(num('weekly_frequency', 1, 7, DEFAULT_PROFILE.weekly_frequency)),
      max_sessions_per_day: Math.round(num('max_sessions_per_day', 1, 3, DEFAULT_PROFILE.max_sessions_per_day)),
      session_duration_cap_min: Math.round(num('session_duration_cap_min', 15, 240, DEFAULT_PROFILE.session_duration_cap_min)),
      base_rpe_cap: clamp(Math.round(num('base_rpe_cap', 5, 10, DEFAULT_PROFILE.base_rpe_cap) * 2) / 2, 5, 10),
      target_energy_system: inEnum(o.target_energy_system, ENERGY_SYSTEMS, DEFAULT_PROFILE.target_energy_system),
      progression_methodology: inEnum(o.progression_methodology, PROGRESSION_METHODS, DEFAULT_PROFILE.progression_methodology),
      injury_flags: parseBodyNotes(JSON.stringify(o.injury_flags ?? [])),
      mobility_limits: parseBodyNotes(JSON.stringify(o.mobility_limits ?? [])),
      equipment_inventory: parseInventory(JSON.stringify(o.equipment_inventory ?? [])),
    };
  } catch {
    return DEFAULT_PROFILE;
  }
};

/** The block-wipe DELETEs (no transaction — the caller wraps them). Removes the
 *  ACTIVE block (FK-cascades planned_session -> planned_slot -> slot_override,
 *  and block_meta) plus today's volatile subjective reports (cascades
 *  report_severity) and niggles. set_record + the mech_daily triggers are
 *  untouched: logged training history is preserved. */
const runBlockWipe = (d: DB, today: string): void => {
  d.executeSync("DELETE FROM training_block WHERE status = 'active'");
  d.executeSync('DELETE FROM subjective_report WHERE date = ?', [today]);
  d.executeSync('DELETE FROM niggle WHERE reported_at_ms >= ?', [startOfTodayMs()]);
};

/** Everything per-athlete in the store, cleared on a Coach Mode file swap so
 *  nothing bleeds across athletes (the re-boot re-hydrates all of it from the
 *  target file). `onboarded: true` here is the no-flash default; boot() then
 *  reads the real value from the new file. */
const PER_ATHLETE_RESET: Partial<KineticsStore> = {
  vector: null, trend: [], session: null, prescription: null,
  profileNotes: [], profile: DEFAULT_PROFILE, triaging: false, lastTriage: null,
  sessionPlan: [], activeMovementId: null, substitution: null, niggles: [],
  block: null, blockMeta: null, blockSessions: [], todayPlan: null,
  oneRepMaxes: {}, lastEndedSessionId: null, profileSlots: [], onboarded: true,
};

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
  substitution: null,
  niggles: [],
  block: null,
  blockMeta: null,
  blockSessions: [],
  todayPlan: null,
  oneRepMaxes: {},
  lastEndedSessionId: null,
  biometricsStatus: 'off',
  profileSlots: [],
  movementPrefixes: [],
  athletes: [],
  activeAthleteId: 'default',
  onboarded: true,

  boot: () => {
    if (get().status === 'ready') return;
    // Async wrapper: the athlete-registry read is the only await; everything
    // after it is the original synchronous boot path against the chosen file.
    void (async () => {
    try {
      const reg = await loadRegistry();
      const entry = activeEntry(reg);
      set({ athletes: reg.athletes, activeAthleteId: entry.id });
      db = openKineticsDb(entry.dbName);
      migrate(db);
      // Catch-up materialization: idempotent upsert over the trailing week so
      // today's state_vector row exists whenever any base data does (a no-op
      // on days with no data at all).
      for (const date of demoDates(localToday(), 7)) {
        db.executeSync(MATERIALIZE_STATE_VECTOR_SQL, [date]);
      }
      const movements = rowsOf<MovementRow>(
        getDb().executeSync(
          'SELECT m.movement_id, m.name, m.pattern, m.is_compound, (SELECT json_group_array(me.item) FROM movement_equipment me WHERE me.movement_id = m.movement_id) AS required_json, d.base_name, d.supported_prefixes, d.difficulty_rating, p.preference, (w.movement_id IS NOT NULL) AS beginner_ok FROM movement m LEFT JOIN movement_detail d ON d.movement_id = m.movement_id LEFT JOIN movement_preference p ON p.movement_id = m.movement_id LEFT JOIN movement_beginner_whitelist w ON w.movement_id = m.movement_id ORDER BY m.movement_id',
        ),
      ).map(movementFromRow);
      const profileRow = rowsOf<ProfileRow>(
        getDb().executeSync('SELECT * FROM athlete_profile WHERE profile_id = 1'),
      )[0];
      const rms = rowsOf<{ movement_id: number; load_kg: number }>(
        getDb().executeSync('SELECT movement_id, load_kg FROM one_rep_max'),
      );
      const prefixRows = rowsOf<{
        prefix_name: string; cns_load_modifier: number;
        stability_requirement_modifier: number; difficulty_modifier: number;
      }>(getDb().executeSync(
        'SELECT prefix_name, cns_load_modifier, stability_requirement_modifier, difficulty_modifier FROM movement_prefix',
      ));
      // Onboarding trigger: updated_at_ms stays 0 until the FIRST profile
      // save — a fresh install (or a brand-new Coach Mode athlete file)
      // routes to the questionnaire; any previously saved profile skips it.
      const onboardStamp = rowsOf<{ updated_at_ms: number }>(
        getDb().executeSync('SELECT updated_at_ms FROM athlete_profile WHERE profile_id = 1'),
      )[0];
      set({
        oneRepMaxes: Object.fromEntries(rms.map((r) => [r.movement_id, r.load_kg])),
        status: 'ready',
        error: null,
        onboarded: onboardStamp !== undefined && onboardStamp.updated_at_ms > 0,
        movements,
        today: localToday(),
        profile: profileRow !== undefined ? profileFromRow(profileRow) : DEFAULT_PROFILE,
        movementPrefixes: prefixRows
          .filter((r) => PREFIX_SET.has(r.prefix_name))
          .map((r) => ({
            prefixName: r.prefix_name as MovementPrefix,
            cnsLoadModifier: r.cns_load_modifier,
            stabilityRequirementModifier: r.stability_requirement_modifier,
            difficultyModifier: r.difficulty_modifier,
          })),
      });
      get().refreshVector();
      // Today's active niggles (drive the substitution guardrail / Layer 3).
      get().refreshNiggles();
      // Saved profile slots (local multi-tenancy).
      get().refreshProfileSlots();
      // The block lives only in SQLite; the store is a read surface over it.
      get().refreshBlock();
      // Prescription is a pure derivation over persisted state (profile +
      // today's reports), so a halt logged yesterday evening survives an
      // app restart this morning.
      get().computePrescription([]);
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
    })();
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
    persistProfileFields(getDb(), merged);
    set({ profile: merged });
    // Re-derive: profile clamps may have changed the operative prescription.
    if (get().prescription !== null) get().computePrescription([]);
  },

  refreshProfileSlots: () => {
    const rows = rowsOf<{ slot_id: number; name: string; training_age: string; is_active: number }>(
      getDb().executeSync(
        "SELECT slot_id, name, json_extract(profile_json, '$.training_age') AS training_age, is_active FROM profile_slot ORDER BY slot_id",
      ),
    );
    set({
      profileSlots: rows.map((r) => ({
        slotId: r.slot_id, name: r.name, trainingAge: r.training_age, isActive: r.is_active === 1,
      })),
    });
  },

  switchProfile: (slotId) => {
    const d = getDb();
    const target = rowsOf<{ profile_json: string }>(
      d.executeSync('SELECT profile_json FROM profile_slot WHERE slot_id = ?', [slotId]),
    )[0];
    if (target === undefined) return;
    // Validated + clamped here, so the athlete_profile UPDATE below can never
    // throw on a malformed slot (the whole switch stays atomic).
    const loaded = profileFromJsonString(target.profile_json);
    // ONE transaction: snapshot the live profile back into the active slot, move
    // the active flag to the target, LOAD the target into athlete_profile, and
    // wipe block state. Either all of it commits or none does — is_active and
    // athlete_profile can never disagree.
    d.executeSync('BEGIN');
    try {
      d.executeSync(
        'UPDATE profile_slot SET profile_json = ?, updated_at_ms = ? WHERE is_active = 1',
        [profileToJsonString(get().profile), Date.now()],
      );
      d.executeSync('UPDATE profile_slot SET is_active = CASE WHEN slot_id = ? THEN 1 ELSE 0 END', [slotId]);
      persistProfileFields(d, loaded);
      runBlockWipe(d, localToday());
      d.executeSync('COMMIT');
    } catch (e) {
      d.executeSync('ROLLBACK');
      set({ error: e instanceof Error ? e.message : String(e) });
      return;
    }
    set({
      profile: loaded,
      block: null, blockMeta: null, blockSessions: [], todayPlan: null,
      niggles: [], lastTriage: null,
    });
    get().refreshProfileSlots();
    get().refreshNiggles();
    get().refreshBlock();
    get().refreshVector();
    get().computePrescription([]);
  },

  wipeActiveBlockState: () => {
    const d = getDb();
    d.executeSync('BEGIN');
    try {
      runBlockWipe(d, localToday());
      d.executeSync('COMMIT');
    } catch (e) {
      d.executeSync('ROLLBACK');
      set({ error: e instanceof Error ? e.message : String(e) });
      return;
    }
    set({ block: null, blockMeta: null, blockSessions: [], todayPlan: null, niggles: [], lastTriage: null });
    get().refreshNiggles();
    get().refreshBlock();
    get().refreshVector();
    get().computePrescription([]);
  },

  // --- Coach Mode (Phase 15): one DB file per athlete ------------------------
  switchAthlete: (id) => {
    if (get().session !== null) {
      set({ error: 'End the active session before switching athletes.' });
      return;
    }
    if (id === get().activeAthleteId && get().status === 'ready') return;
    set({ status: 'booting', error: null });
    void (async () => {
      try {
        const reg = setActiveAthlete(await loadRegistry(), id);
        if (reg.activeId !== id) {
          set({ status: 'ready', error: 'Unknown athlete.' });
          return;
        }
        await saveRegistry(reg);
        if (db !== null) {
          try { closeKineticsDb(db); } catch { /* reopen path recovers */ }
          db = null;
        }
        set({ ...PER_ATHLETE_RESET, athletes: reg.athletes, activeAthleteId: id });
        get().boot(); // status is 'booting' -> full open/migrate/hydrate path
      } catch (e) {
        set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    })();
  },

  createAthlete: (name) => {
    if (get().session !== null) {
      set({ error: 'End the active session before adding athletes.' });
      return;
    }
    set({ status: 'booting', error: null });
    void (async () => {
      try {
        const { reg, entry } = addAthlete(await loadRegistry(), name, Date.now());
        await saveRegistry(setActiveAthlete(reg, entry.id));
        if (db !== null) {
          try { closeKineticsDb(db); } catch { /* reopen path recovers */ }
          db = null;
        }
        set({
          ...PER_ATHLETE_RESET,
          athletes: reg.athletes,
          activeAthleteId: entry.id,
        });
        // Fresh file: migrate() builds the full schema; its athlete_profile
        // row has updated_at_ms = 0, so this athlete lands in onboarding.
        get().boot();
      } catch (e) {
        set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    })();
  },

  renameAthleteEntry: (id, name) => {
    void (async () => {
      const reg = regRenameAthlete(await loadRegistry(), id, name);
      await saveRegistry(reg);
      set({ athletes: reg.athletes });
    })();
  },

  deleteAthlete: (id) => {
    void (async () => {
      const { reg, removed } = regRemoveAthlete(await loadRegistry(), id);
      if (removed === null) {
        set({ error: 'The active and default athletes cannot be deleted.' });
        return;
      }
      await saveRegistry(reg);
      // Best-effort file removal; an orphaned file is harmless and invisible.
      try {
        const { open } = require('@op-engineering/op-sqlite') as typeof import('@op-engineering/op-sqlite');
        open({ name: removed.dbName }).delete();
      } catch { /* orphan tolerated */ }
      set({ athletes: reg.athletes });
    })();
  },

  completeOnboarding: (patch, athleteName) => {
    // ONE atomic save: clamps + persists + stamps updated_at_ms (the trigger
    // that marks this athlete onboarded on every future boot).
    get().saveProfile(patch);
    set({ onboarded: true });
    void (async () => {
      const reg = regRenameAthlete(await loadRegistry(), get().activeAthleteId, athleteName);
      await saveRegistry(reg);
      set({ athletes: reg.athletes });
    })();
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
    get().refreshNiggles();  // yesterday's niggles drop out of the active set
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
      // Phase 16: tier gating — beginners see Beginner + whitelisted staples.
      difficulty: m.difficulty,
      beginner_ok: m.beginnerOk,
    }));
    // Phase 13 Step 4 — autopilot hydration. A bounded, READ-ONLY, n+1-free pull
    // of the trailing 3-week window: ONE grouped per-(date,pattern) set aggregate
    // (set_record ⋈ session ⋈ movement ⋈ set_prefix ⋈ the prescribed planned_slot
    // target) + ONE windowed niggle scan. mech_daily is the cross-movement raw
    // rollup (no per-pattern dimension) so it is NOT the per-pattern source and
    // stays untouched; state_vector supplies the calendar. detectFlaws then feeds
    // the generator, which auto-corrects the next (entirely forward-dated) block.
    const today = localToday();
    const AUTOPILOT_WINDOW_DAYS = 21;
    // The window is the FIXED 21-calendar-day grid (gap-tolerant, oldest first),
    // NOT the sparse set of materialized state_vector dates — so rest-day niggles
    // are not dropped and detectFlaws' EMA recency stays per-calendar-day.
    const winCalendar = demoDates(today, AUTOPILOT_WINDOW_DAYS);
    const winStart = winCalendar[0];
    const svByDate = new Map(rowsOf<StateVectorRow>(d.executeSync(
      'SELECT * FROM state_vector WHERE date >= ? AND date <= ? ORDER BY date',
      [winStart, today],
    )).map((r) => [r.date, r] as const));
    // Align state_vector to the calendar (rest day → neutral placeholder); F reads
    // only the length, so the placeholders are inert but keep the grid fixed at 21.
    const windowVectors: StateVectorRow[] = winCalendar.map((dt) => svByDate.get(dt) ?? blankVector(dt));
    const setAgg = rowsOf<{
      date: string; pattern: MovementPattern; set_count: number;
      sum_delta_rpe: number; delta_count: number; sum_attenuation: number;
    }>(d.executeSync(
      `SELECT s.session_date AS date, m.pattern AS pattern, COUNT(*) AS set_count,
              COALESCE(SUM(CASE WHEN sr.rpe IS NOT NULL AND tp.target_rpe IS NOT NULL THEN sr.rpe - tp.target_rpe END), 0) AS sum_delta_rpe,
              SUM(CASE WHEN sr.rpe IS NOT NULL AND tp.target_rpe IS NOT NULL THEN 1 ELSE 0 END) AS delta_count,
              SUM(1.0 / MAX(1.0, COALESCE(sp.effective_load_kg, sr.load_kg) / MAX(sr.load_kg, 0.01))) AS sum_attenuation
       FROM set_record sr
       JOIN session s ON s.session_id = sr.session_id
       JOIN movement m ON m.movement_id = sr.movement_id
       LEFT JOIN set_prefix sp ON sp.set_id = sr.set_id
       LEFT JOIN (SELECT ps.session_date AS sd, psl.movement_id AS mid, MIN(psl.target_rpe) AS target_rpe
                  FROM planned_slot psl JOIN planned_session ps ON ps.planned_session_id = psl.planned_session_id
                  GROUP BY ps.session_date, psl.movement_id) tp
         ON tp.sd = s.session_date AND tp.mid = sr.movement_id
       WHERE s.session_date >= ? AND s.session_date <= ?
       GROUP BY s.session_date, m.pattern`,
      [winStart, today],
    ));
    // Niggles are bucketed to LOCAL calendar days in JS (mirroring startOfTodayMs),
    // never via SQLite UTC date() — so they agree with session/state_vector dates.
    // Over-fetch by ms then let buildPatternWindow keep only in-calendar dates.
    const winStartMs = startOfTodayMs() - (AUTOPILOT_WINDOW_DAYS - 1) * 86_400_000;
    const niggleRows = rowsOf<{ region: string; severity: number; reported_at_ms: number }>(d.executeSync(
      'SELECT region, severity, reported_at_ms FROM niggle WHERE reported_at_ms >= ?',
      [winStartMs],
    ));
    const patternWindow = buildPatternWindow(
      winCalendar,
      setAgg.map((r) => ({
        date: r.date, pattern: r.pattern, setCount: r.set_count,
        sumDeltaRpe: r.sum_delta_rpe, deltaCount: r.delta_count, sumAttenuation: r.sum_attenuation,
      })),
      niggleRows.map((r) => ({ date: localDateOf(r.reported_at_ms), region: r.region as Joint, severity: r.severity })),
    );
    // Severe ACTIVE joint load (>= the experience-weighted halt threshold) is a
    // block-level halt → the generator snaps to the recovery template. Uses the
    // SAME local-midnight bound as the active-niggle path (runBlockWipe).
    const haltMin = EXPERIENCE_SEVERITY[profile.training_age].haltMin;
    const maxNiggleToday = rowsOf<{ s: number }>(d.executeSync(
      'SELECT COALESCE(MAX(severity), 0) AS s FROM niggle WHERE reported_at_ms >= ?',
      [startOfTodayMs()],
    ))[0]?.s ?? 0;
    const autopilotGuardrail: Guardrail | null = maxNiggleToday >= haltMin
      ? { load_multiplier: 1, set_delta: 0, rpe_cap_max: 10, halt: true, follow_up: null }
      : null;
    const flawReport = detectFlaws(windowVectors, patternWindow, profile.training_age, autopilotGuardrail);

    const plan = generateBlock({
      profile,
      movements: genMovements,
      startDate: today,
      schemaType,
      macroBlockIndex,
      recentAcwr: vector !== null ? vector.acwr : null,
      flawReport,
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

  connectBiometrics: async (bridge) => {
    biometrics = bridge;
    if (bridge === null) {
      // Health Connect APK missing / not Android / native module failed:
      // the Phase 8 subjective-triage-only path is the whole product here.
      set({ biometricsStatus: 'unavailable' });
      return;
    }
    try {
      // Boot is READ-ONLY: already-granted -> sync; otherwise wait for the
      // athlete to tap CONNECT. No automatic permission sheet, ever.
      if (await bridge.hasGrantedPermissions()) {
        set({ biometricsStatus: 'ready' });
        await get().syncBiometrics();
      } else {
        set({ biometricsStatus: 'idle' });
      }
    } catch {
      set({ biometricsStatus: 'unavailable' });
    }
  },

  requestBiometricsAccess: async () => {
    if (biometrics === null) return;
    try {
      const granted = await biometrics.requestPermissions();
      if (!granted) {
        set({ biometricsStatus: 'denied' });
        return;
      }
      set({ biometricsStatus: 'ready' });
      await get().syncBiometrics();
    } catch {
      set({ biometricsStatus: 'denied' });
    }
  },

  syncBiometrics: async () => {
    // Foreground-lifecycle only (boot / AppState 'active' / manual SYNC) —
    // no background workers, nothing for Jetsam to kill mid-write.
    if (get().status !== 'ready' || get().biometricsStatus !== 'ready' || biometrics === null) {
      return;
    }
    try {
      const days = await biometrics.readDaily(7);
      if (days.length === 0) return;
      const d = getDb();
      for (const r of days) {
        // One compacted row per day per table — raw ticks never reach SQLite.
        if (r.rmssdMs !== null) {
          d.executeSync(
            "INSERT INTO hrv_daily (date, rmssd_ms, resting_hr, source) VALUES (?, ?, ?, 'health_connect') ON CONFLICT(date) DO UPDATE SET rmssd_ms = excluded.rmssd_ms, resting_hr = COALESCE(excluded.resting_hr, resting_hr), source = excluded.source",
            [r.date, r.rmssdMs, r.restingHrBpm],
          );
        } else if (r.restingHrBpm !== null) {
          // RHR without HRV: hrv_daily requires rmssd_ms, so only an
          // existing row can absorb it (no-op otherwise, by design).
          d.executeSync(
            'UPDATE hrv_daily SET resting_hr = ? WHERE date = ?',
            [r.restingHrBpm, r.date],
          );
        }
        if (r.inBedMin !== null && r.inBedMin > 0) {
          d.executeSync(
            'INSERT INTO sleep_daily (date, in_bed_min, asleep_min, deep_min, rem_min, light_min) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(date) DO UPDATE SET in_bed_min = excluded.in_bed_min, asleep_min = excluded.asleep_min, deep_min = excluded.deep_min, rem_min = excluded.rem_min, light_min = excluded.light_min',
            [r.date, r.inBedMin, r.asleepMin ?? 0, r.deepMin, r.remMin, r.lightMin],
          );
        }
      }
      // New telemetry -> the trailing week's readiness re-materializes and
      // today's prescription re-derives from the fresh state vector.
      for (const date of demoDates(localToday(), 7)) {
        d.executeSync(MATERIALIZE_STATE_VECTOR_SQL, [date]);
      }
      get().refreshVector();
      get().computePrescription([]);
    } catch {
      // Silent fallback: a biometric failure must never degrade the app
      // below its Phase 8 baseline (training data + subjective reports).
    }
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

  setMovementPreference: (movementId, preference) => {
    const d = getDb();
    // The 010 invariant: NEUTRAL is the ABSENCE of a row, so toggling back to
    // neutral DELETEs; AVOID/PRIORITIZE upsert. Keeps the table empty until
    // used and never dirties the immutable movement_detail cache.
    if (preference === MOVEMENT_PREFERENCE.NEUTRAL) {
      d.executeSync('DELETE FROM movement_preference WHERE movement_id = ?', [movementId]);
    } else {
      d.executeSync(
        'INSERT INTO movement_preference (movement_id, preference, updated_at_ms) VALUES (?, ?, ?) ON CONFLICT(movement_id) DO UPDATE SET preference = excluded.preference, updated_at_ms = excluded.updated_at_ms',
        [movementId, preference, Date.now()],
      );
    }
    set({
      movements: get().movements.map((m) =>
        m.movement_id === movementId ? { ...m, preference } : m),
    });
  },

  openSubstitution: (targetMovementId) => {
    const { movements, profile, block } = get();
    const target = movements.find((m) => m.movement_id === targetMovementId);
    if (target === undefined) return;
    // Re-read today's niggles from 011 so a midnight crossing while the app sat
    // foregrounded (no AppState 'active' -> no rolloverDay) can't feed the
    // engine yesterday's niggles. set() is synchronous, so get().niggles below
    // is the fresh set.
    get().refreshNiggles();
    const d = getDb();
    const today = localToday();
    const byId = new Map(movements.map((m) => [m.movement_id, m]));
    let futureSlots: FutureSlot[] = [];
    let currentDayIndex = 0;
    // Layer 2 (day-swap) needs the active block's later days. With no block,
    // futureSlots stays empty and only Layer 1 (regression) can yield options.
    if (block !== null) {
      currentDayIndex = Number(
        rowsOf<{ d: number }>(
          d.executeSync('SELECT CAST(julianday(?) - julianday(?) AS INTEGER) AS d', [today, block.startDate]),
        )[0]?.d ?? 0,
      );
      const rows = rowsOf<{
        planned_slot_id: number; session_date: string; movement_id: number;
        sets: number; day_index: number;
      }>(
        d.executeSync(
          `SELECT sl.planned_slot_id, ps.session_date, sl.movement_id, sl.sets,
                  CAST(julianday(ps.session_date) - julianday(?) AS INTEGER) AS day_index
           FROM planned_slot sl
           JOIN planned_session ps ON ps.planned_session_id = sl.planned_session_id
           WHERE ps.block_id = ? AND ps.session_date > ?
           ORDER BY ps.session_date, sl.slot_index`,
          [block.startDate, block.blockId, today],
        ),
      );
      futureSlots = rows.flatMap((r) => {
        const mv = byId.get(r.movement_id);
        return mv === undefined
          ? []
          : [{ plannedSlotId: r.planned_slot_id, dayIndex: r.day_index, movement: toSubMovement(mv), sets: r.sets }];
      });
    }
    const result = computeSubstitutions({
      target: toSubMovement(target),
      library: movements.map(toSubMovement),
      inventory: profile.equipment_inventory,
      niggles: get().niggles, // active niggles drive the guardrail + Layer 3
      futureSlots,
      currentDayIndex,
      trainingAge: profile.training_age, // experience-weighted severity thresholds
    });
    set({ substitution: { targetId: targetMovementId, result } });
  },

  closeSubstitution: () => set({ substitution: null }),

  reportNiggle: (region, severity) => {
    // Region must be a JOINTS member or the engine can't route it; the UI only
    // offers valid joints, but guard the store boundary anyway.
    if (!JOINT_SET.has(region)) return;
    const safe = Math.round(clamp(severity, 1, 10));
    const ms = Date.now();
    // ms + per-process counter (monotonic within a ms) + random suffix (so a
    // restart that resets the counter still can't collide on the TEXT PK).
    const id = `${ms}-${niggleSeq++}-${Math.floor(Math.random() * 1e9).toString(36)}`;
    getDb().executeSync(
      'INSERT INTO niggle (id, region, severity, reported_at_ms) VALUES (?, ?, ?, ?)',
      [id, region, safe, ms],
    );
    set({ niggles: [...get().niggles, { region, severity: safe }] });
  },

  refreshNiggles: () => {
    const rows = rowsOf<{ region: string; severity: number }>(
      getDb().executeSync(
        'SELECT region, severity FROM niggle WHERE reported_at_ms >= ? ORDER BY reported_at_ms',
        [startOfTodayMs()],
      ),
    );
    set({ niggles: rows.map((r) => ({ region: r.region, severity: r.severity })) });
  },

  applyRegression: (targetMovementId, optionMovementId) => {
    // SWAP semantics: the target is replaced. Layer 1 guarantees the chosen
    // movement differs from the target. If it is ALREADY in today's plan, drop
    // the target slot and focus the existing one (never leave both); otherwise
    // swap the target slot's movement in place.
    const plan = get().sessionPlan;
    if (plan.some((s) => s.movementId === optionMovementId)) {
      set({
        sessionPlan: plan.filter((s) => s.movementId !== targetMovementId),
        activeMovementId: optionMovementId,
      });
    } else {
      get().swapMovement(targetMovementId, optionMovementId);
      // Focus the chosen movement explicitly (swapMovement only moves focus
      // when the swapped slot was already active — true here, but don't rely
      // on the SWAP-target-equals-active invariant).
      set({ activeMovementId: optionMovementId });
    }
    set({ substitution: null });
  },

  applyDaySwap: (targetMovementId, option) => {
    // Conservation of volume: the pulled movement's future slot is deleted so
    // it is never done twice, and its volume is performed TODAY. planned_slot.sets
    // cannot be 0 (CHECK >= 1), so the whole future slot is removed.
    getDb().executeSync('DELETE FROM planned_slot WHERE planned_slot_id = ?', [option.plannedSlotId]);
    // setsConserved is the origin slot's FULL set count (1..10) — it is NOT
    // clamped to the plan's display range, or moved volume would be lost.
    const movedSets = Math.max(1, Math.round(option.setsConserved));
    const plan = get().sessionPlan;
    let next: PlanSlot[];
    if (plan.some((s) => s.movementId === option.movement_id)) {
      // Pulled movement is ALSO planned today (a different movement than the
      // target): drop the swapped-away target slot, then ADD the moved volume
      // to the existing slot — today's pre-planned volume is conserved.
      next = plan
        .filter((s) => s.movementId !== targetMovementId)
        .map((s) =>
          s.movementId === option.movement_id
            ? { ...s, plannedSets: s.plannedSets + movedSets }
            : s);
    } else if (plan.some((s) => s.movementId === targetMovementId)) {
      // Replace the target's slot in place with the pulled movement.
      next = plan.map((s) =>
        s.movementId === targetMovementId
          ? { movementId: option.movement_id, plannedSets: movedSets }
          : s);
    } else {
      next = [...plan, { movementId: option.movement_id, plannedSets: movedSets }];
    }
    set({ sessionPlan: next, activeMovementId: option.movement_id, substitution: null });
    get().refreshBlock(); // the future grid lost a slot
  },

  logSet: (movementId, reps, loadKg, rpe, displayName, appliedPrefixes) => {
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

    // Phase 13 Step 2: persist applied condition prefixes + their compound
    // multipliers + the effective load to the set_prefix side-car (set_record
    // can't gain columns idempotently). mech_daily (raw tonnage -> readiness) is
    // deliberately untouched; effective volume is tracked here, per set.
    const applied = (appliedPrefixes ?? []).filter((p, i, a) => a.indexOf(p) === i);
    if (applied.length > 0) {
      const conds = get().movementPrefixes.filter((c) => applied.includes(c.prefixName));
      if (conds.length > 0) {
        const eff = calculateEffectiveLoad(safeLoad, conds);
        const cnsMod = conds.reduce((p, c) => p * c.cnsLoadModifier, 1);
        const diffMod = conds.reduce((p, c) => p * c.difficultyModifier, 1);
        d.executeSync(
          `INSERT INTO set_prefix (set_id, applied_prefixes, cns_load_modifier,
             stability_requirement_modifier, difficulty_modifier, effective_load_kg)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [setId, JSON.stringify(eff.appliedPrefixes), cnsMod, eff.stabilityDemand, diffMod, eff.effectiveLoad],
        );
      }
    }

    const logged: LoggedSet = {
      set_id: setId,
      movement_id: movementId,
      // Prefix-engine payload: the implement-prefixed display name when the UI
      // supplied one (e.g. 'DB Bench Press'), else the canonical movement name.
      movement_name:
        displayName !== undefined && displayName.length > 0 ? displayName : movement.name,
      set_index: setIndex,
      reps: safeReps,
      load_kg: safeLoad,
      rpe: safeRpe,
      tonnage_kg: safeReps * safeLoad,
    };
    set({ session: { ...s, sets: [logged, ...s.sets] } });
  },

  deleteSet: (setId) => {
    const s = get().session;
    if (s === null) return;
    // Hard delete: trg_set_record_ad (001) drains mech_daily by this row's
    // exact contribution, so no re-aggregation is needed. Mirrors logSet —
    // state_vector re-materializes at endSession, not per row mutation.
    getDb().executeSync('DELETE FROM set_record WHERE set_id = ?', [setId]);
    set({ session: { ...s, sets: s.sets.filter((x) => x.set_id !== setId) } });
  },

  editSet: (setId, reps, loadKg, rpe) => {
    const s = get().session;
    if (s === null) return;
    // Same CHECK-domain clamps as logSet: a UI bug must never throw mid-edit.
    const safeReps = Math.round(clamp(reps, 1, 50));
    const safeLoad = clamp(Math.round(loadKg / 2.5) * 2.5, 0, 500);
    const safeRpe = clamp(Math.round(rpe * 2) / 2, 5, 10);
    // UPDATE OF reps, load_kg, rpe fires trg_set_record_au, which re-deltas
    // mech_daily (old contribution out, new in). tonnage_kg is a GENERATED
    // STORED column — SQLite recomputes it; we mirror it in memory below.
    const dEdit = getDb();
    dEdit.executeSync(
      'UPDATE set_record SET reps = ?, load_kg = ?, rpe = ? WHERE set_id = ?',
      [safeReps, safeLoad, safeRpe, setId],
    );
    // Phase 13: a prefixed set's effective load depends on the (edited) base
    // load, so re-sync the set_prefix side-car from its persisted token list —
    // else effective_load_kg goes stale and effective volume is unrecoverable.
    // mech_daily is already corrected by trg_set_record_au above (untouched).
    const sp = rowsOf<{ applied_prefixes: string }>(
      dEdit.executeSync('SELECT applied_prefixes FROM set_prefix WHERE set_id = ?', [setId]),
    )[0];
    if (sp !== undefined) {
      let tokens: MovementPrefix[] = [];
      try {
        const parsed = JSON.parse(sp.applied_prefixes);
        if (Array.isArray(parsed)) {
          tokens = parsed.filter((x): x is MovementPrefix => typeof x === 'string');
        }
      } catch {
        tokens = [];
      }
      const conds = get().movementPrefixes.filter((c) => tokens.includes(c.prefixName));
      const eff = calculateEffectiveLoad(safeLoad, conds);
      const cnsMod = conds.reduce((p, c) => p * c.cnsLoadModifier, 1);
      const diffMod = conds.reduce((p, c) => p * c.difficultyModifier, 1);
      dEdit.executeSync(
        `UPDATE set_prefix SET cns_load_modifier = ?, stability_requirement_modifier = ?,
           difficulty_modifier = ?, effective_load_kg = ? WHERE set_id = ?`,
        [cnsMod, eff.stabilityDemand, diffMod, eff.effectiveLoad, setId],
      );
    }
    set({
      session: {
        ...s,
        sets: s.sets.map((x) =>
          x.set_id === setId
            ? { ...x, reps: safeReps, load_kg: safeLoad, rpe: safeRpe, tonnage_kg: safeReps * safeLoad }
            : x),
      },
    });
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
    // Each matched report carries its persisted 1-10 severity (012 side-car;
    // null for pre-severity rows) — derivePrescription severity-gates the
    // matched guardrail by it + training age (DOMS-vs-structural).
    // `halt` is the RECORDED halt for the row — a fact re-derivation must honor
    // even if the athlete's training age later changes (a halt is never relaxed).
    const reports = rowsOf<{ matched_entry_id: string; severity: number | null; halt: number }>(d.executeSync(
      'SELECT sr.matched_entry_id, sr.halt, rs.severity FROM subjective_report sr LEFT JOIN report_severity rs ON rs.report_id = sr.report_id WHERE sr.date = ? AND sr.matched_entry_id IS NOT NULL ORDER BY sr.report_id',
      [today],
    ))
      .map((r) => {
        const entry = entryById(r.matched_entry_id);
        return entry === undefined ? null : { entry, severity: r.severity, wasHalt: r.halt === 1 };
      })
      .filter((r): r is { entry: PhraseEntry; severity: number | null; wasHalt: boolean } => r !== null);
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

  reportSubjective: async (text, severity) => {
    // A report typed after midnight must land on the NEW day — persisting it
    // under a stale date would make the resulting halt vanish on restart.
    get().rolloverDay();
    const { vector, triaging } = get();
    const today = localToday();
    const raw = text.trim();
    if (vector === null || triaging) return;
    if (raw.length === 0 || raw.length > 500) return;
    // The UI forces a 1-10 severity before processing; clamp at the boundary.
    const safeSeverity = Math.round(clamp(severity, 1, 10));
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
        reports: [{ entry: resolved.entry, severity: safeSeverity }],
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
      // Persist the severity (012 side-car) so the pure re-derivation survives a
      // restart with the severity gate intact.
      const reportId = rowsOf<{ id: number }>(
        d.executeSync('SELECT last_insert_rowid() AS id'),
      )[0]?.id;
      if (reportId !== undefined) {
        d.executeSync(
          'INSERT INTO report_severity (report_id, severity) VALUES (?, ?)',
          [reportId, safeSeverity],
        );
      }
      // Re-derive the operative prescription from persistence (single source
      // of truth; also sets lastTriage to the now-operative directive).
      get().computePrescription([]);
      // Acknowledge a confident match that did NOT become operative — either
      // positive sentiment OR a complaint the severity gate de-escalated to
      // benign (DOMS) — unless a restrictive report from earlier today still
      // governs, in which case computePrescription kept that honest directive.
      if (get().lastTriage === null) {
        set({ lastTriage: { kind: 'positive', cue: resolved.entry.cue } });
      }
    } finally {
      set({ triaging: false });
    }
  },

  resetTrainingData: () => {
    const d = getDb();
    const had = rowsOf<{ c: number }>(d.executeSync('SELECT count(*) AS c FROM session'))[0];
    d.executeSync('BEGIN');
    try {
      // Children before parents, so it is correct whether or not foreign_keys is
      // ON. KEEPS athlete_profile / movement library / preferences / profile_slot.
      d.executeSync('DELETE FROM set_prefix');
      d.executeSync('DELETE FROM set_record');
      d.executeSync('DELETE FROM session_note');
      d.executeSync('DELETE FROM report_severity');
      d.executeSync('DELETE FROM slot_override');
      d.executeSync('DELETE FROM planned_slot');
      d.executeSync('DELETE FROM planned_session');
      d.executeSync('DELETE FROM block_meta');
      d.executeSync('DELETE FROM session');
      d.executeSync('DELETE FROM micro_cycle');
      d.executeSync('DELETE FROM macro_cycle');
      d.executeSync('DELETE FROM training_block');
      d.executeSync('DELETE FROM subjective_report');
      d.executeSync('DELETE FROM niggle');
      d.executeSync('DELETE FROM one_rep_max');
      d.executeSync('DELETE FROM hrv_daily');
      d.executeSync('DELETE FROM sleep_daily');
      d.executeSync('DELETE FROM spo2_daily');
      d.executeSync('DELETE FROM spo2_sample');
      d.executeSync('DELETE FROM mech_daily');
      d.executeSync('DELETE FROM state_vector');
      d.executeSync('COMMIT');
    } catch (e) {
      d.executeSync('ROLLBACK');
      set({ error: e instanceof Error ? e.message : String(e) });
      return false;
    }
    // Reflect the now-empty DB in memory.
    get().refreshVector();
    get().refreshBlock();
    get().refreshNiggles();
    set({ oneRepMaxes: {} });
    return (had?.c ?? 0) > 0;
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
      d.executeSync('SELECT m.movement_id, m.name, m.pattern, m.is_compound, (SELECT json_group_array(me.item) FROM movement_equipment me WHERE me.movement_id = m.movement_id) AS required_json, d.base_name, d.supported_prefixes, d.difficulty_rating, p.preference, (w.movement_id IS NOT NULL) AS beginner_ok FROM movement m LEFT JOIN movement_detail d ON d.movement_id = m.movement_id LEFT JOIN movement_preference p ON p.movement_id = m.movement_id LEFT JOIN movement_beginner_whitelist w ON w.movement_id = m.movement_id ORDER BY m.movement_id'),
    ).map(movementFromRow);
    set({ movements });
    get().refreshVector();
  },
}));
