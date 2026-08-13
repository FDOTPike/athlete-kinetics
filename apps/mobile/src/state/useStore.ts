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
import { theme } from '../theme/theme';
import { create } from 'zustand';
import type { DB } from '@op-engineering/op-sqlite';
import {
  DEMO_DAYS,
  MATERIALIZE_STATE_VECTOR_SQL,
  SPO2_FOLD_SQL,
  SPO2_TRIM_SQL,
  archiveActiveTrainingBlock,
  closeKineticsDb,
  demoDates,
  generateDemoHistory,
  insertTrainingProgram,
  linkTrainingBlockProgram,
  migrate,
  openKineticsDb,
  updateTrainingProgramEndDate,
  type DemoSql,
} from '@ak/core-db';
import {
  activeEntry,
  addAthlete,
  removeAthlete as regRemoveAthlete,
  renameAthlete as regRenameAthlete,
  setAdvancedToolsUnlocked as regSetAdvancedToolsUnlocked,
  setActiveAthlete,
  type AthleteEntry,
} from './athleteRegistryCore';
import { loadRegistry, saveRegistry } from './athleteRegistry';
import {
  inventoryFromRowCell,
  inventoryFromSnapshot,
  inventoryToSnapshot,
} from './equipmentInventory';
import {
  executeDirectLoadPreferenceSave,
  executeProfileLoadSave,
  persistLoadPreferenceRow,
  persistProfileFields,
  planProfileLoadTransition,
  readActiveLoadPreference,
} from './loadPreferenceStore';
import {
  buildPatternWindow,
  addDaysIso,
  composeRoutineMicrocycle,
  contextualRoutineRoles,
  computeSubstitutions,
  DEFAULT_PROFILE,
  detectFlaws,
  derivePrescription,
  ENERGY_SYSTEMS,
  EQUIPMENT_ITEMS,
  STANDARD_EQUIPMENT_ITEMS,
  EXPERIENCE_SEVERITY,
  generateBlock,
  groupRoutineTemplateDays,
  accessContextForBlockFocus,
  historyContentFingerprint,
  parseHistoryImport,
  defaultProgramDayIndices,
  programFocuses,
  OBJECTIVES,
  PROGRESSION_METHODS,
  TRAINING_AGES,
  isNoOpGuardrail,
  isDifficultyAllowed,
  isRoutineRoleSnapshotExecutable,
  routineMajorRpeForWeek,
  JOINTS,
  PATTERN_JOINTS,
  loadCodebase,
  MACRO_BLOCKS,
  macroPhaseOf,
  programMacroIndex,
  MOVEMENT_PREFERENCE,
  MOVEMENT_PREFIXES,
  RED_FLAG_PAIN,
  RED_FLAG_SYSTEMIC,
  resolveReport,
  resolveMovementAvailability,
  triage,
  type CapabilityEdge,
  type CapabilityEvidence,
  type DaySwapOption,
  type MovementAvailability,
  type MovementAccessContext,
  type ExecutableMovementAccessContext,
  type RoutineRole,
  type RoutineAssistanceContract,
  type RoutineFamilyStressDecision,
  type RoutineLiftFamilyContract,
  type RoutineSessionFamilyStress,
  type RoutineStressPurpose,
  type DifficultyRating,
  type Embedder,
  type BlockPlan,
  type BlockFocus,
  type ProgramDayPreference,
  type FutureSlot,
  type GeneratorMovement,
  type Guardrail,
  type Joint,
  type HistoryParseResult,
  type LoadedCodebase,
  type MacroPhase,
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
  CAPABILITY_EVIDENCE_WINDOW_DAYS,
  conditionApplies,
  resolveActiveRung,
  type RungResolution,
  targetLoadKg,
  evaluateSessionOutcome,
  advance as advanceSessionRunner,
  currentSlot as currentRunnerSlot,
  deserializeRunner,
  serializeRunner,
  startRunner,
  type RunnerHaltReason,
  type RunnerState,
  type RunnerTarget,
  type SessionOutcomeDecision,
  type SessionOutcomeInput,
  type SessionOutcomeOriginKind,
  type SessionOutcomeProvenanceKind,
  type Prescription,
  type ProfileContext,
  type SchemaType,
  type SessionDirective,
  type StateVectorRow,
  type TriageResult,
  type UserProfile,
  defaultLoadPreference,
  resolveLoadSelection,
  transitionLoadPreference,
  type LoadPreference,
  type LoadSelection,
} from '@ak/inference';

export type { MovementAvailability };
export type { LoadPreference, LoadSelection, LoadSource } from '@ak/inference';

export const REASON_TEXT_MAP: Record<'tier' | 'equipment' | 'safety' | 'capability', string> = {
  tier: 'not for your experience level yet',
  equipment: "needs equipment you don't have",
  safety: 'held back by a reported niggle',
  capability: 'build the movement below it first',
};

export const formatTeachingOnlyReason = (verdict: MovementAvailability | undefined): string => {
  if (verdict === undefined) return 'Access cannot be verified right now.';
  if (verdict.reasons.length === 0) return 'Teaching only';
  const humanReasons = verdict.reasons.map((reason) => {
    if (reason !== 'capability') return REASON_TEXT_MAP[reason];
    if (verdict.separateAttestationRequired) return 'requires separate movement approval';
    if (verdict.confirmationWouldClear) return 'prior-experience confirmation is available';
    return REASON_TEXT_MAP.capability;
  }).join('; ');
  return `Teaching only — ${humanReasons}`;
};
// Codebase + pre-embedded vectors ride in the JS bundle (~1 MB total);
// relative imports resolve via metro watchFolders / tsc include.
import type { BiometricsBridge } from '@ak/biometrics';
import phraseCodebaseJson from '../../../../packages/inference/assets/phrase-codebase.json';
import phraseVectorsJson from '../../../../packages/inference/assets/phrase-codebase.vectors.json';

// ---------------------------------------------------------------------------
// Shared dark palette (sweaty-hands UI: high contrast, zero decoration)
// ---------------------------------------------------------------------------
// pikeMethods visual system (theme.ts is canonical; this legacy palette is
// remapped onto it so every existing screen reskins at once). The old
// traffic-light keys are DEPRECATED aliases: no red/amber/green exists in the
// design — halts and finishes carry equal weight by construction. Screen-level
// work orders retire these aliases; new code imports { theme } directly.
export const palette = {
  bg: theme.color.ink0,
  surface: theme.color.ink1,
  line: theme.color.line,
  text: theme.color.textHi,
  dim: theme.color.textMid,
  faint: theme.color.textLow,
  chalk: theme.color.chalk,
  onChalk: theme.color.onChalk,
  /** @deprecated traffic-light era — now the single accent. */
  green: theme.color.chalk,
  /** @deprecated traffic-light era — now neutral secondary. */
  amber: theme.color.textMid,
  /** @deprecated traffic-light era — now plain high-emphasis text. */
  red: theme.color.textHi,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type MovementMediaStatus = 'planned' | 'external_fallback' | 'ready';

export interface MovementMediaRef {
  assetKey: string;
  status: MovementMediaStatus;
  revision: number;
  fallbackUrl: string | null;
}

export interface Movement {
  movement_id: number;
  name: string;
  pattern: string;
  is_compound: boolean;
  /** movement_beginner_whitelist membership — an Intermediate staple a
   *  beginner may see/be prescribed (plan P16 S4). */
  beginnerOk: boolean;
  /** movement_logging_mode: 'time' movements log seconds, everything else
   *  logs reps (018; no row = 'reps'). */
  loggingMode: 'reps' | 'time';
  /** Curated reference content. Empty text remains deliberately honest until
   * a reviewed movement-library migration supplies it. */
  instructions: string;
  cues: string;
  media: MovementMediaRef | null;
  targetMuscles: string[];
  coachingIntent: string | null;
  /** Frozen into slots at plan/session creation; never read as a live dose. */
  timePolicy: { defaultSets: number; targetSeconds: number } | null;
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
  /** Authored progression metadata. Null means no ordered skill chain. */
  progressionGroup: string | null;
  progressionRank: number | null;
  /** movement_scope (049) — a training scope that cuts ACROSS `pattern`.
   *  'full_body' marks a movement the generator prefers at a full-body
   *  session's dedicated scope slot. Null = not scoped (no row). */
  scope: 'full_body' | null;
  /** movement_sport_tracking membership. */
  sportTracking: boolean;
}

export interface CoachMovementAccessContext {
  edges: CapabilityEdge[];
  evidence: CapabilityEvidence[];
  attestedEdgeKeys: string[];
  safetyExcludedMovementIds: number[];
  priorExperienceMovementIds: number[];
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
  rpe: number | null;
  tonnage_kg: number;
  session_plan_slot_id: number | null;
  timeS: number | null;
  bandLevel: number | null;
}

/** Optional metric edits. A duration remains positive; a band level can be
 * cleared when the athlete corrects the implement used for that set. */
export interface SetMetricPatch {
  timeS?: number;
  bandLevel?: number | null;
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

/** Per-profile utility-first presentation preferences (023). A null mode is
 * intentionally resolved at session start from the athlete tier. */
export type SessionMode = 'guided' | 'self_directed';
export type ReadinessDetail = 'summary' | 'full';
export type TextScale = 'system' | 'large' | 'extra_large';
export interface UiPreferences {
  sessionModeOverride: SessionMode | null;
  readinessDetail: ReadinessDetail;
  restTimerEnabled: boolean;
  textScale: TextScale;
}

/** A personal, ordinal band ladder. Labels belong to the athlete; no colour is
 * ever treated as a universal load. */
export interface BandLadderLevel {
  level: number;
  label: string;
}

/** A frozen set target is explicit: a session never infers that a timed slot
 * should become a rep slot after a policy update. */
export type SlotTarget =
  | { kind: 'reps'; reps: number }
  | { kind: 'time'; seconds: number };
/** One slot in the active session's workout plan. */
/** How a session slot's frozen prescription was obtained (Fix-1 provenance). */
export type SlotProvenanceKind =
  | 'planned' | 'substituted' | 'day_swapped' | 'added' | 'free_form';

export interface PlanSlot {
  sessionPlanSlotId: number;
  movementId: number;
  plannedSets: number;
  plannedReps: number | null;
  /** 023 target sidecar projected into the session plan. plannedReps remains
   * for compatibility with legacy callers; target is the authoritative UI dose. */
  target: SlotTarget;
  /** Provenance of the frozen target, captured at plan creation. */
  provenanceKind: SlotProvenanceKind;
  /** Exact prescribed target RPE the athlete was shown, or null (no evidence). */
  targetRpe: number | null;
  /** planned_slot this slot descends from, or null (added/free_form). */
  sourcePlannedSlotId: number | null;
  originalMovementId: number | null;
  originalSessionDate: string | null;
  overrideLoadKg: number | null;
  overrideReason: string | null;
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
  /** Exact finalized outcome for this planned session; never inferred by date. */
  completionStatus: 'complete' | 'halted' | null;
}

export type AutopilotAttributionReason = 'eased' | 'raised' | 'held_safety';

export interface AutopilotAttribution {
  rpeDelta: number;
  setDelta: number;
  reason: AutopilotAttributionReason;
}

export interface TodaySlot {
  slotIndex: number;
  plannedSlotId: number;
  movementId: number;
  movementName: string;
  sets: number;
  reps: number;
  /** Frozen target side-car, falling back to reps for pre-023 blocks. */
  target: SlotTarget;
  targetRpe: number;
  /** APRE reactive load (slot_override), null when none applies. */
  overrideLoadKg: number | null;
  /** WHY the load moved — rendered verbatim as a badge. */
  overrideReason: string | null;
  /** Optional planned_slot_autopilot provenance; absent means untouched. */
  autopilot?: AutopilotAttribution;
  /** Frozen bounded-dose decision for routine-derived slots. */
  routineDecision?: {
    role: RoutineRole;
    family: string | null;
    purpose: RoutineStressPurpose | null;
    stressCoefficient: number;
    equivalentVolume: number;
    stressDose: number;
    adaptations: string[];
  };
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
  routineStress: {
    routineDayIndex: number;
    familyDecisions: RoutineFamilyStressDecision[];
    warnings: string[];
    recommendations: string[];
    adaptations: string[];
  } | null;
}

export interface RoutinePlanningContract {
  liftFamilies: RoutineLiftFamilyContract[];
  assistance: RoutineAssistanceContract[];
}

export interface TrainingProgramMovementPreference {
  dayIndex: number;
  slotIndex: number;
  pattern: MovementPattern;
  movementId: number;
}

export interface TrainingProgramDay {
  dayIndex: number;
  focus: string;
}

export interface TrainingProgram {
  programId: number;
  objective: UserProfile['objective'];
  startDate: string;
  horizonKind: 'weeks' | 'date';
  requestedReviewDate: string | null;
  plannedEndDate: string;
  plannedBlockCount: number;
  startingMacroBlockIndex: number;
  schemaType: SchemaType;
  status: 'active' | 'review_due' | 'archived';
  currentSequenceIndex: number;
  days: TrainingProgramDay[];
  movementPreferences: TrainingProgramMovementPreference[];
}

export type TrainingProgramHorizon =
  | { kind: 'weeks'; blockCount: number }
  | { kind: 'date'; requestedReviewDate: string };

export interface TrainingProgramInput {
  horizon: TrainingProgramHorizon;
  schemaType: SchemaType;
  dayIndices: number[];
  movementPreferences?: TrainingProgramMovementPreference[];
}

export interface TrainingProgramPreview {
  objective: UserProfile['objective'];
  startDate: string;
  requestedReviewDate: string | null;
  plannedEndDate: string;
  plannedBlockCount: number;
  schemaType: SchemaType;
  days: TrainingProgramDay[];
  plan: BlockPlan;
}

export interface RoutineTemplateSlot {
  routineTemplateSlotId: number;
  routineTemplateId: number;
  dayIndex: number;
  slotIndex: number;
  role: RoutineRole;
  movementId: number;
  movementName: string;
  sets: number;
  reps: number;
  targetRpe: number;
}

export interface RoutineTemplate {
  routineTemplateId: number;
  name: string;
  schemaType: SchemaType;
  createdAtMs: number;
  updatedAtMs: number;
  slots: RoutineTemplateSlot[];
}

export interface HistoryImportCommitResult {
  readonly committed: boolean;
  readonly duplicate: boolean;
  readonly preview: HistoryParseResult;
}
export interface MeasuredDailyPoint {
  readonly date: string;
  readonly tonnageKg: number;
  readonly setCount: number;
  readonly bodyweightKg: number | null;
  readonly hrvRmssdMs: number | null;
  readonly restingHr: number | null;
  readonly sleepMinutes: number | null;
}
export interface CoachDiagnosticContext {
  readonly sessionsToday: number;
  readonly trainedDaysLast7: number;
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
  /** Phase 17 display/session preferences scoped to the active profile slot. */
  uiPreferences: UiPreferences;
  /** Personal ordinal resistance-band labels, scoped to this athlete DB. */
  bandLadder: BandLadderLevel[];
  /** Phase 13: movement_prefix (014) hydrated at boot as MovementPrefixCondition
   *  objects — the condition weights the Session tab folds via conditionEngine. */
  movementPrefixes: MovementPrefixCondition[];
  /** True when the semantic embedder is wired; the keyword safety layer
   *  works regardless. */
  triageReady: boolean;
  triaging: boolean;
  lastTriage: TriageOutcome | null;
  sessionPlan: PlanSlot[];
  activeSessionPlanSlotId: number | null;
  activeMovementId: number | null;
  /** Exact serializable Phase 17 runner state for this active session. */
  runner: RunnerState | null;
  /** Frozen at session start; a preference change affects the next session. */
  sessionMode: SessionMode | null;
  /** Open substitution sheet: the deterministic engine's 3-tier result for a
   *  SWAP target (null = closed). */
  substitution: { targetId: number; result: SubstitutionResult } | null;
  /** Today's active niggles (region + severity), fed verbatim into
   *  computeSubstitutions — they drive the injury guardrail and Layer 3. */
  niggles: NiggleInput[];
  /** Active athlete-local movement declarations, hydrated from migration 051. */
  activePriorExperienceMovementIds: number[];
  /** Explicit invalidation token for every memoized availability consumer. */
  movementAvailabilityRevision: number;
  /** Frozen execution context for the active/restored session. */
  activeSessionAccessContext: ExecutableMovementAccessContext | null;
  /** Active 4-week block, its grid, and today's planned session. */
  block: ActiveBlock | null;
  blockMeta: BlockMeta | null;
  blockSessions: BlockSessionSummary[];
  todayPlan: TodayPlan | null;
  hasArchivedBlock: boolean;
  program: TrainingProgram | null;
  routineTemplates: RoutineTemplate[];
  /** Absolute 1RMs by movement_id (one_rep_max rows). */
  oneRepMaxes: Record<number, number>;
  /** Evidence-backed last load by movement, hydrated from durable set history. */
  lastLoggedLoads: Record<number, number>;
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
  /** Device-wide hidden coaching/debug surfaces. Persisted in the registry,
   *  deliberately outside every athlete database. */
  advancedToolsUnlocked: boolean;
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
  previewTrainingProgram: (input: TrainingProgramInput) => TrainingProgramPreview;
  createTrainingProgram: (input: TrainingProgramInput) => boolean;
  updateProgramPreferences: (input: TrainingProgramInput) => boolean;
  previewNextProgramBlock: () => BlockPlan | null;
  continueTrainingProgram: () => void;
  archiveTrainingProgram: () => void;
  refreshProgram: () => void;
  /** Upsert (or clear with null) an absolute 1RM for a movement. */
  saveOneRepMax: (movementId: number, kg: number | null) => void;
  /** Parse, validate, deduplicate, and commit a complete staged import atomically. */
  importHistory: (text: string, verified: boolean, readinessEligible: boolean) => HistoryImportCommitResult;
  /** Manual bodyweight is a measured daily value, never a score. Null deletes. */
  saveBodyweight: (date: string, kg: number | null) => void;
  /** Indexed daily rollups for local charts; imported sessions always appear. */
  loadMeasuredHistory: (limit?: number) => MeasuredDailyPoint[];
  /** Exact read-only profile-clamp context for the in-memory verification Lab. */
  loadCoachDiagnosticContext: () => CoachDiagnosticContext;
  /** Exact read-only capability facts for the Lab's production resolver call. */
  loadCoachMovementAccessContext: () => CoachMovementAccessContext;
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
  /** Re-read UI preferences for the active profile slot. */
  refreshUiPreferences: () => void;
  /** Persist one or more utility-first preferences for the active profile slot. */
  saveUiPreferences: (patch: Partial<UiPreferences>) => void;
  /** Durable four-mode load-selection preference for the active profile slot
   *  (migration 035). Beginner is always 'auto' — never asked, never stored
   *  otherwise. */
  loadPreference: LoadPreference;
  /** True only when the athlete explicitly selected the current preference.
   *  Persisted per profile so same-as-default choices survive restart and
   *  non-beginner tier changes. */
  loadPreferenceExplicit: boolean;
  /** Re-read the load preference for the active profile slot. Malformed or
   *  missing rows fail safely to the tier default. */
  refreshLoadPreference: () => void;
  /** The single validated save action for the preference. Rejects changes
   *  during an active session and rejects manual for beginners. */
  saveLoadPreference: (preference: LoadPreference) => boolean;
  /** Pure resolution of the effective load source for a movement/set from the
   *  durable preference plus evidence. Screens render from this; they never
   *  re-implement the resolver order. */
  resolveSlotLoad: (input: {
    movementId: number;
    bodyweightMode: boolean;
    targetReps: number | null;
    targetRpe: number;
    overrideLoadKg: number | null;
    sessionPlanSlotId: number;
  }) => LoadSelection;
  refreshBandLadder: () => void;
  saveBandLevel: (level: number, label: string) => void;
  deleteBandLevel: (level: number) => void;  /** Re-read the saved profile slots (013) into state. */
  refreshProfileSlots: () => void;
  /** Switch the active profile: snapshot the live profile back into its slot,
   *  load the chosen slot into athlete_profile, then wipe block state (so the
   *  new profile regenerates cleanly). Destructive — clears the active block +
   *  today's reports/niggles. */
  switchProfile: (slotId: number) => void;
  /** Hard-DELETE the active block (+ cascade) and today's volatile reports +
   *  niggles, in one transaction. Training history (set_record) is preserved. */
  wipeActiveBlockState: () => void;
  /** P16 progression: resolve the active rung of a goal-movement chain from
   *  logged history (pure read — UI consumers land with P17). Null when the
   *  group has no chain rows. */
  resolveGoalRung: (progressionGroup: string, today: string) => RungResolution | null;
  /** Capability attestation: manual coach/athlete override for attestation-gated edges. */
  attestEdge: (prerequisiteMovementId: number, movementId: number) => void;
  revokeAttestation: (prerequisiteMovementId: number, movementId: number) => void;
  confirmMovementPriorExperience: (
    movementId: number,
    context: MovementAccessContext,
  ) => boolean;
  revokeMovementPriorExperience: (movementId: number) => boolean;
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
  /** Unlock or explicitly relock the advanced coaching/debug surfaces. */
  setAdvancedToolsUnlocked: (unlocked: boolean) => void;
  /** Onboarding completion: persist every answer in ONE save (no partial
   *  profiles), name the athlete, and enter the app. The load preference is
   *  committed in the same SQLite transaction as the profile fields. */
  completeOnboarding: (
    patch: Partial<UserProfile>,
    athleteName: string,
    loadPreference?: LoadPreference,
    loadPreferenceExplicit?: boolean,
  ) => void;
  /** Triage a free-text complaint with a forced 1-10 severity (Phase 12 Step
   *  5). The severity gates the matched guardrail by training age. */
  reportSubjective: (text: string, severity: number) => Promise<void>;
  selectMovement: (movementId: number) => void;
  selectMovementSlot: (sessionPlanSlotId: number) => void;
  /** Advance an elapsed rest only when its persisted target has actually ended. */
  advanceRunnerRest: () => void;
  /** Athlete-controlled, non-judgmental rest skip. */
  skipRunnerRest: () => void;
  /** Persist a 15-second session rest override in the durable runner checkpoint. */
  setRunnerRestOverride: (seconds: number | null) => void;
  /** Avoid the current movement and open its deterministic substitution choices. */
  runnerThumbsDown: () => void;
  runnerDeclineSubstitution: () => void;
  runnerSkipSlot: () => void;
  runnerHalt: (reason?: RunnerHaltReason) => void;
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
  startSession: (repeatPlanned?: boolean) => void;
  /** Append a logged set. `displayName` carries the prefix-engine
   *  concatenation (e.g. 'DB Bench Press') into the in-memory log payload;
   *  falls back to the movement's canonical name when absent. `appliedPrefixes`
   *  (Phase 13) are the toggled condition tokens; their compound multipliers +
   *  effective load are persisted to the set_prefix side-car. */
  logSet: (movementId: number, reps: number, loadKg: number, rpe: number | null, displayName?: string, appliedPrefixes?: readonly MovementPrefix[], implement?: MovementPrefix, metrics?: { timeS?: number; bandLevel?: number }, sessionPlanSlotId?: number) => void;
  /** Hard-delete one logged set. The 001 AFTER DELETE trigger
   *  (trg_set_record_ad) drains mech_daily by this row's exact contribution;
   *  the in-memory list drops the row. */
  deleteSet: (setId: number) => void;
  /** Edit one logged set's reps/load/RPE in place. The 001 AFTER UPDATE
   *  trigger (trg_set_record_au) re-deltas mech_daily. NOTE: "sets" is not a
   *  per-row attribute — each set_record row IS one set; change the count by
   *  adding/deleting rows, not by editing one. */
  editSet: (setId: number, reps: number, loadKg: number, rpe: number | null, metrics?: SetMetricPatch) => void;
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
  dismissOutcome: () => void;
  loadSessionOutcome: (sessionId: number) => { outcomeKind: string; finalizedAtMs: number } | null;
  loadRecentOutcomes: (limit?: number) => { outcomeKind: string; finalizedAtMs: number }[];
  loadRoutineTemplates: () => void;
  saveRoutineTemplate: (input: {
    routineTemplateId?: number;
    name: string;
    schemaType: SchemaType;
    slots: Array<{
      dayIndex?: number;
      slotIndex?: number;
      role: RoutineRole;
      movementId: number;
      sets?: number;
      reps?: number;
      targetRpe?: number;
    }>;
  }) => RoutineTemplate;
  deleteRoutineTemplate: (routineTemplateId: number) => void;
  freezeRoutineTemplateToPlannedSession: (
    routineTemplateId: number,
    sessionDate?: string,
    dayIndex?: number,
  ) => { plannedSessionId: number; archivedPreviousBlock: boolean };
  getMovementAvailabilityVerdicts: (
    context: MovementAccessContext,
  ) => readonly MovementAvailability[];
  getRoutineRoleEligibleMovementIds: () => Record<RoutineRole, readonly number[]>;
  getRoutinePlanningContract: () => RoutinePlanningContract;
}

// ---------------------------------------------------------------------------
// DB singleton + row normalization (op-sqlite returns rows as an array on
// current versions; older builds nest it under _array)
// ---------------------------------------------------------------------------
let db: DB | null = null;
let bootInFlight = false;
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

export const localToday = (): string => {
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
  base_name: string | null; supported_prefixes: string | null; target_muscles: string | null;
  difficulty_rating: string | null; preference: number | null;
  beginner_ok: number | null;
  logging_mode: string | null;
  instructions: string | null; cues: string | null; video_placeholder_uri: string | null;
  media_asset_key: string | null; media_status: string | null; media_revision: number | null;
  coaching_intent: string | null;
  time_default_sets: number | null; time_target_seconds: number | null;
  progression_group: string | null; progression_rank: number | null;
  scope: string | null;
  sport_tracking: number | null;
}
const PREFIX_SET = new Set<string>(MOVEMENT_PREFIXES);
const MEDIA_STATUS_SET = new Set<string>(['planned', 'external_fallback', 'ready']);
const parseStringArray = (json: string | null): string[] => {
  try {
    const value = JSON.parse(json ?? '[]') as unknown;
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
};
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
    required = parseStringArray(r.required_json);
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
    loggingMode: r.logging_mode === 'time' ? 'time' : 'reps',
    instructions: r.instructions ?? '',
    cues: r.cues ?? '',
    media: r.media_asset_key !== null
      && r.media_status !== null
      && MEDIA_STATUS_SET.has(r.media_status)
      && r.media_revision !== null
      ? {
          assetKey: r.media_asset_key,
          status: r.media_status as MovementMediaStatus,
          revision: r.media_revision,
          fallbackUrl: (r.video_placeholder_uri ?? '').trim().length > 0
            ? r.video_placeholder_uri
            : null,
        }
      : null,
    targetMuscles: parseStringArray(r.target_muscles),
    coachingIntent: r.coaching_intent ?? null,
    timePolicy: r.time_default_sets !== null && r.time_target_seconds !== null
      ? { defaultSets: r.time_default_sets, targetSeconds: r.time_target_seconds }
      : null,
    preference: toPreference(r.preference),
    progressionGroup: r.progression_group,
    progressionRank: r.progression_rank,
    // 'full_body' is the only legal movement_scope.scope value; anything else
    // (including a NULL LEFT JOIN) reads as "not scoped".
    scope: r.scope === 'full_body' ? 'full_body' : null,
    sportTracking: r.sport_tracking === 1,
  };
};

const MOVEMENT_LIBRARY_SQL = `SELECT m.movement_id, m.name, m.pattern, m.is_compound,
  (SELECT json_group_array(me.item) FROM movement_equipment me WHERE me.movement_id = m.movement_id) AS required_json,
  d.base_name, d.supported_prefixes, d.difficulty_rating, d.target_muscles, d.instructions, d.cues, d.video_placeholder_uri,
  mm.asset_key AS media_asset_key, mm.status AS media_status, mm.revision AS media_revision,
  ci.coaching_intent, tp.default_sets AS time_default_sets, tp.target_seconds AS time_target_seconds, p.preference,
  (w.movement_id IS NOT NULL) AS beginner_ok, lm.mode AS logging_mode, mp.progression_group, mp.progression_rank,
  ms.scope AS scope, (mst.movement_id IS NOT NULL) AS sport_tracking
  FROM movement m LEFT JOIN movement_detail d ON d.movement_id = m.movement_id LEFT JOIN movement_media mm ON mm.movement_id = m.movement_id LEFT JOIN movement_coaching_intent ci ON ci.movement_id = m.movement_id LEFT JOIN movement_time_policy tp ON tp.movement_id = m.movement_id LEFT JOIN movement_preference p ON p.movement_id = m.movement_id LEFT JOIN movement_beginner_whitelist w ON w.movement_id = m.movement_id LEFT JOIN movement_logging_mode lm ON lm.movement_id = m.movement_id LEFT JOIN movement_progression mp ON mp.movement_id = m.movement_id LEFT JOIN movement_scope ms ON ms.movement_id = m.movement_id LEFT JOIN movement_sport_tracking mst ON mst.movement_id = m.movement_id ORDER BY m.movement_id`;

/** Map the 023 side-car (or a conservative legacy rep fallback) into one
 * target union. Historic sessions without the side-car stay readable. */
const targetFromFields = (
  kind: string | null | undefined,
  reps: number | null | undefined,
  seconds: number | null | undefined,
  fallbackReps: number | null | undefined,
): SlotTarget => {
  if (kind === 'time' && typeof seconds === 'number' && seconds > 0) {
    return { kind: 'time', seconds: Math.round(seconds) };
  }
  return { kind: 'reps', reps: Math.max(1, Math.round(reps ?? fallbackReps ?? 1)) };
};

const targetForMovement = (movement: Movement | undefined, fallbackReps = 5): SlotTarget => {
  if (movement?.loggingMode === 'time') {
    // Every shipped time-mode movement has a 023 policy. The one-second
    // fallback preserves the SQL union contract without inventing a workout.
    return { kind: 'time', seconds: movement.timePolicy?.targetSeconds ?? 1 };
  }
  return { kind: 'reps', reps: Math.max(1, Math.round(fallbackReps)) };
};

const defaultSetsForTarget = (movement: Movement | undefined, fallbackSets: number): number =>
  movement?.loggingMode === 'time' && movement.timePolicy !== null
    ? movement.timePolicy.defaultSets
    : fallbackSets;

/** Beginner routes are defensive at every entry point: a curated whitelist may
 * admit an Intermediate staple, but an Advanced/Elite movement never leaks
 * through a plan picker, substitution, session start, or renderer. */
const permittedForProfile = (
  movement: Movement | undefined,
  profile: UserProfile,
  accessContext: ExecutableMovementAccessContext,
): boolean =>
  movement !== undefined && isDifficultyAllowed(
    profile.training_age,
    movement.difficulty,
    movement.beginnerOk,
    accessContext,
    movement.sportTracking,
  );

/** Project a store Movement onto the substitution engine's input shape. The
 *  engine never reads SQL; the store assembles this from 001 + 010 columns. */
const toSubMovement = (m: Movement, availableIds: ReadonlySet<number>): SubstitutionMovement => ({
  movement_id: m.movement_id,
  name: m.name,
  pattern: m.pattern as MovementPattern,
  is_compound: m.is_compound,
  difficulty: m.difficulty,
  beginnerOk: m.beginnerOk,
  capabilityAvailable: availableIds.has(m.movement_id),
  sportTracking: m.sportTracking,
  family: m.baseName,
  required: m.required,
  preference: m.preference,
});

/** Resolve active niggles into movement-level safety exclusions using the same
 * pattern/joint map as substitutions. Safety remains an outer hard gate. */
const safetyExcludedMovementIdsFor = (
  movements: readonly Movement[],
  profile: UserProfile,
  niggles: readonly NiggleInput[],
): ReadonlySet<number> => {
  const injuredJoints = new Set<Joint>();
  const triageMin = EXPERIENCE_SEVERITY[profile.training_age].triageMin;
  for (const niggle of niggles) {
    if (niggle.severity < triageMin) continue;
    const key = niggle.region.trim().toLowerCase();
    const joint = JOINTS.find((candidate) => candidate.toLowerCase() === key);
    if (joint !== undefined) injuredJoints.add(joint);
  }
  if (injuredJoints.size === 0) return new Set<number>();
  return new Set(
    movements
      .filter((movement) => (PATTERN_JOINTS[movement.pattern as MovementPattern] ?? [])
        .some((joint) => injuredJoints.has(joint)))
      .map((movement) => movement.movement_id),
  );
};

interface CapabilityFacts {
  edges: CapabilityEdge[];
  evidence: CapabilityEvidence[];
  attestedEdgeKeys: string[];
  priorExperienceMovementIds: number[];
}

/** Read only the compact access sidecars; historical set rows never enter the
 * runtime resolver or the diagnostic adapter. */
const loadCapabilityFacts = (d: DB): CapabilityFacts => {
  const edges = rowsOf<{
    prerequisite_movement_id: number; movement_id: number; relationship: CapabilityEdge['relationship'];
    min_sessions: number; min_sets_per_session: number; min_value: number;
    value_kind: CapabilityEdge['valueKind']; max_rpe: number | null; requires_attestation: number;
  }>(d.executeSync(`SELECT prerequisite_movement_id, movement_id, relationship,
      min_sessions, min_sets_per_session, min_value, value_kind, max_rpe, requires_attestation
    FROM movement_capability_edge ORDER BY prerequisite_movement_id, movement_id`));
  const evidence = rowsOf<{
    session_id: number; movement_id: number; qualifying_sets: number;
    minimum_value: number; maximum_rpe: number | null; verified: number;
  }>(d.executeSync(`SELECT session_id, movement_id, qualifying_sets, minimum_value, maximum_rpe, verified
    FROM capability_session_evidence WHERE verified = 1 ORDER BY movement_id, session_id`));
  const importedEvidence = rowsOf<{
    history_import_session_id: number; movement_id: number; qualifying_sets: number;
    minimum_value: number; maximum_rpe: number | null;
  }>(d.executeSync(`SELECT ice.history_import_session_id, ice.movement_id, ice.qualifying_sets,
      ice.minimum_value, ice.maximum_rpe
    FROM history_import_capability_evidence ice
    JOIN history_import_session his USING (history_import_session_id)
    JOIN history_import hi USING (history_import_id)
    WHERE hi.verified = 1
    ORDER BY ice.movement_id, ice.history_import_session_id`));
  const attestations = rowsOf<{ prerequisite_movement_id: number; movement_id: number }>(
    d.executeSync('SELECT prerequisite_movement_id, movement_id FROM movement_capability_attestation'),
  );
  const priorExperience = rowsOf<{ movement_id: number }>(d.executeSync(
    'SELECT movement_id FROM movement_prior_experience WHERE revoked_at_ms IS NULL ORDER BY movement_id',
  ));
  return {
    edges: edges.map((edge): CapabilityEdge => ({
      prerequisiteMovementId: edge.prerequisite_movement_id, movementId: edge.movement_id,
      relationship: edge.relationship, minSessions: edge.min_sessions,
      minSetsPerSession: edge.min_sets_per_session, minValue: edge.min_value,
      valueKind: edge.value_kind, maxRpe: edge.max_rpe,
      requiresAttestation: edge.requires_attestation === 1,
    })),
    evidence: [
      ...evidence.map((row): CapabilityEvidence => ({
        movementId: row.movement_id, sessionId: row.session_id,
        qualifyingSets: row.qualifying_sets, minimumValue: row.minimum_value,
        maximumRpe: row.maximum_rpe, verified: row.verified === 1,
      })),
      ...importedEvidence.map((row): CapabilityEvidence => ({
        movementId: row.movement_id, sessionId: `import:${row.history_import_session_id}`,
        qualifyingSets: row.qualifying_sets, minimumValue: row.minimum_value,
        maximumRpe: row.maximum_rpe, verified: true,
      })),
    ],
    attestedEdgeKeys: attestations.map((row) => `${row.prerequisite_movement_id}:${row.movement_id}`),
    priorExperienceMovementIds: priorExperience.map((row) => row.movement_id),
  };
};

/** Resolve the shared law for one explicit presentation/execution context. */
const capabilityMovementAvailability = (
  d: DB,
  movements: readonly Movement[],
  profile: UserProfile,
  accessContext: MovementAccessContext,
  priorExperienceMovementIds: ReadonlySet<number>,
  safetyExcludedMovementIds: ReadonlySet<number>,
): readonly MovementAvailability[] => {
  const facts = loadCapabilityFacts(d);
  return resolveMovementAvailability({
    movements: movements.map((movement) => ({
      movementId: movement.movement_id, difficulty: movement.difficulty,
      beginnerOk: movement.beginnerOk, sportTracking: movement.sportTracking,
      requiredEquipment: movement.required,
    })),
    edges: facts.edges,
    evidence: facts.evidence,
    attestedEdgeKeys: new Set(facts.attestedEdgeKeys),
    priorExperienceMovementIds,
    trainingAge: profile.training_age,
    accessContext,
    equipment: new Set(profile.equipment_inventory),
    safetyExcludedMovementIds,
  });
};

const capabilityAvailableMovementIds = (
  d: DB,
  movements: readonly Movement[],
  profile: UserProfile,
  accessContext: ExecutableMovementAccessContext,
  priorExperienceMovementIds: ReadonlySet<number>,
  safetyExcludedMovementIds: ReadonlySet<number>,
): ReadonlySet<number> => new Set(
  capabilityMovementAvailability(
    d, movements, profile, accessContext, priorExperienceMovementIds, safetyExcludedMovementIds,
  )
    .filter((row) => row.state === 'available')
    .map((row) => row.movementId),
);

/** Before session start, mutations belong to today's performance context. Once
 * a session exists, its frozen context is the only authority. */
const executionContextForState = (state: Pick<
  KineticsStore,
  'session' | 'todayPlan' | 'activeSessionAccessContext'
>): ExecutableMovementAccessContext | null => {
  // Active-session mutations must use the frozen context. Missing context is
  // an unverifiable state, not permission to infer a different one.
  if (state.session !== null) return state.activeSessionAccessContext;
  return state.todayPlan === null
    ? 'weight_room'
    : accessContextForBlockFocus(state.todayPlan.focus as BlockFocus);
};

const routineRoleEligibility = (d: DB): Record<RoutineRole, ReadonlySet<number>> => {
  const result: Record<RoutineRole, Set<number>> = {
    major: new Set<number>(), supplementary: new Set<number>(), accessory: new Set<number>(), conditional: new Set<number>(),
  };
  const rows = rowsOf<{ movement_id: number; role: RoutineRole }>(d.executeSync(
    'SELECT movement_id, role FROM movement_role_eligibility ORDER BY role, movement_id',
  ));
  for (const row of rows) result[row.role].add(row.movement_id);
  return result;
};

const routinePlanningContract = (d: DB): RoutinePlanningContract => ({
  liftFamilies: rowsOf<{
    movement_id: number; family: string; stress_coefficient: number;
    preferred_purpose: RoutineStressPurpose | null;
  }>(d.executeSync(
    `SELECT movement_id, family, stress_coefficient, preferred_purpose
       FROM movement_lift_family ORDER BY family, movement_id`,
  )).map((row) => ({
    movementId: row.movement_id,
    family: row.family,
    stressCoefficient: row.stress_coefficient,
    preferredPurpose: row.preferred_purpose,
  })),
  assistance: rowsOf<{
    major_family: string; movement_id: number; distance: number;
    stress_factor: number; fatigue_cost: number; reason: string;
  }>(d.executeSync(
    `SELECT major_family, movement_id, distance, stress_factor, fatigue_cost, reason
       FROM movement_assistance_relationship ORDER BY major_family, distance, movement_id`,
  )).map((row) => ({
    family: row.major_family,
    movementId: row.movement_id,
    distance: row.distance as 1 | 2 | 3,
    stressFactor: row.stress_factor,
    fatigueCost: row.fatigue_cost,
    reason: row.reason,
  })),
});

const ROUTINE_STRESS_PURPOSES = new Set<RoutineStressPurpose>([
  'heavy', 'volume', 'technique', 'speed', 'low_fatigue',
]);
const ROUTINE_STRESS_LEVELS = new Set(['low', 'moderate', 'high']);
const isFiniteNonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isRoutineSessionFamilyStress = (value: unknown): value is RoutineSessionFamilyStress => {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return Number.isInteger(row.dayIndex) && Number(row.dayIndex) >= 1 && Number(row.dayIndex) <= 7
    && row.exposureCount === 1
    && Number.isInteger(row.variationCount) && Number(row.variationCount) >= 1
    && isFiniteNonnegative(row.equivalentVolume)
    && isFiniteNonnegative(row.initialStress)
    && isFiniteNonnegative(row.finalStress)
    && isFiniteNonnegative(row.budget)
    && typeof row.level === 'string' && ROUTINE_STRESS_LEVELS.has(row.level);
};
const isRoutineFamilyStressDecision = (value: unknown): value is RoutineFamilyStressDecision => {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.family === 'string' && row.family.length > 0
    && Number.isInteger(row.exposureCount) && Number(row.exposureCount) >= 1
    && Number.isInteger(row.variationCount) && Number(row.variationCount) >= 1
    && isFiniteNonnegative(row.equivalentVolume)
    && isFiniteNonnegative(row.initialStress)
    && isFiniteNonnegative(row.finalStress)
    && isFiniteNonnegative(row.weeklyBudget)
    && typeof row.level === 'string' && ROUTINE_STRESS_LEVELS.has(row.level)
    && Array.isArray(row.purposes) && row.purposes.every(
      (purpose) => typeof purpose === 'string'
        && ROUTINE_STRESS_PURPOSES.has(purpose as RoutineStressPurpose),
    )
    && Array.isArray(row.sessions) && row.sessions.every(isRoutineSessionFamilyStress)
    && Array.isArray(row.adaptations) && row.adaptations.every((item) => typeof item === 'string');
};
const parseRoutineFamilyDecisions = (json: string | null): RoutineFamilyStressDecision[] => {
  try {
    const value = JSON.parse(json ?? '[]') as unknown;
    return Array.isArray(value) ? value.filter(isRoutineFamilyStressDecision) : [];
  } catch {
    return [];
  }
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
/** Fail-closed inventory parsing: canonicalize an EXPLICIT selection against
 *  the full persisted union (so a chosen specialist item survives), but recover
 *  a damaged cell to STANDARD items only (so no fallback ever grants one).
 *  The branch logic and its tests live in ./equipmentInventory; adjacent
 *  parseBodyNotes above fails closed to [] the same way. */
const parseInventory = (json: string): UserProfile['equipment_inventory'] =>
  inventoryFromRowCell(json, EQUIPMENT_ITEMS, STANDARD_EQUIPMENT_ITEMS);
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

/** Serialize a profile to the profile_slot JSON snapshot shape. */
const profileToJsonString = (p: UserProfile): string => JSON.stringify({
  objective: p.objective, training_age: p.training_age,
  weekly_frequency: p.weekly_frequency, max_sessions_per_day: p.max_sessions_per_day,
  session_duration_cap_min: p.session_duration_cap_min, base_rpe_cap: p.base_rpe_cap,
  target_energy_system: p.target_energy_system, progression_methodology: p.progression_methodology,
  injury_flags: p.injury_flags, mobility_limits: p.mobility_limits,
  equipment_inventory: inventoryToSnapshot(p.equipment_inventory),
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
      equipment_inventory: inventoryFromSnapshot(
        o.equipment_inventory, EQUIPMENT_ITEMS, STANDARD_EQUIPMENT_ITEMS,
      ),
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

const defaultUiPreferences = (profile: UserProfile): UiPreferences => ({
  sessionModeOverride: null,
  readinessDetail: profile.training_age === 'beginner' ? 'summary' : 'full',
  restTimerEnabled: true,
  textScale: 'system',
});

const uiPreferencesFromRow = (
  row: { session_mode_override: string | null; readiness_detail: string | null; rest_timer_enabled: number | null; text_scale: string | null } | undefined,
  profile: UserProfile,
): UiPreferences => {
  const fallback = defaultUiPreferences(profile);
  return {
    sessionModeOverride: row?.session_mode_override === 'guided' || row?.session_mode_override === 'self_directed'
      ? row.session_mode_override
      : null,
    readinessDetail: row?.readiness_detail === 'full' || row?.readiness_detail === 'summary'
      ? row.readiness_detail
      : fallback.readinessDetail,
    restTimerEnabled: row?.rest_timer_enabled !== 0,
    textScale: row?.text_scale === 'large' || row?.text_scale === 'extra_large' || row?.text_scale === 'system'
      ? row.text_scale
      : 'system',
  };
};
/** Resolve the mode once at session creation. The nullable override intentionally
 * never retroactively changes an active session. */
const modeForNewSession = (preferences: UiPreferences, profile: UserProfile): SessionMode =>
  preferences.sessionModeOverride ?? (profile.training_age === 'beginner' ? 'guided' : 'self_directed');

const runnerSlotsForPlan = (
  plan: readonly PlanSlot[],
  movements: readonly Movement[],
) => plan.map((slot) => ({
  sessionPlanSlotId: slot.sessionPlanSlotId,
  plannedSlotId: slot.sourcePlannedSlotId,
  movementId: slot.movementId,
  movementName: movements.find((movement) => movement.movement_id === slot.movementId)?.name ?? 'Movement',
  sets: slot.plannedSets,
  target: slot.target,
  targetRpe: slot.targetRpe ?? 8,
}));

/** Checkpoint and scalar projection are committed in the same SQLite transaction
 * as the set/plan mutation that produced them. */
const persistRunnerCheckpoint = (
  d: DB,
  sessionId: number,
  mode: SessionMode,
  runner: RunnerState,
): void => {
  const current = currentRunnerSlot(runner);
  d.executeSync(
    `INSERT INTO session_runner_checkpoint
       (session_id, session_mode, phase, current_session_plan_slot_id, current_set_index,
        rest_target_seconds, rest_started_at_ms, substitution_offered_for_session_plan_slot_id,
        runner_state_json, updated_at_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       session_mode = excluded.session_mode,
       phase = excluded.phase,
       current_session_plan_slot_id = excluded.current_session_plan_slot_id,
       current_set_index = excluded.current_set_index,
       rest_target_seconds = excluded.rest_target_seconds,
       rest_started_at_ms = excluded.rest_started_at_ms,
       substitution_offered_for_session_plan_slot_id = excluded.substitution_offered_for_session_plan_slot_id,
       runner_state_json = excluded.runner_state_json,
       updated_at_ms = excluded.updated_at_ms`,
    [
      sessionId,
      mode,
      runner.phase,
      current?.sessionPlanSlotId ?? null,
      current === null ? null : runner.setIndex,
      runner.restSecondsTarget,
      runner.restStartedAtMs,
      runner.substitutionOfferedForSessionPlanSlotId,
      serializeRunner(runner),
      runner.updatedAtMs ?? 0,
    ],
  );
};

interface FinalizationLoggedSet {
  readonly setId: number;
  readonly movementId: number;
  readonly sessionPlanSlotId: number | null;
  readonly sourcePlannedSlotId: number | null;
  readonly reps: number;
  readonly rpe: number | null;
}

interface SessionFinalizationSnapshot {
  readonly sessionDate: string;
  readonly startedAtMs: number | null;
  readonly originKind: SessionOutcomeOriginKind;
  readonly sourcePlannedSessionId: number | null;
  readonly sessionMode: SessionMode;
  readonly runner: RunnerState;
  readonly hasPersistedSafetyHalt: boolean;
  readonly slots: SessionOutcomeInput['slots'];
  readonly sets: SessionOutcomeInput['sets'];
  readonly loggedSets: readonly FinalizationLoggedSet[];
}

const doseFromFields = (
  kind: string | null,
  reps: number | null,
  seconds: number | null,
): RunnerTarget | null => {
  if (kind === 'reps' && Number.isInteger(reps) && reps !== null && reps >= 1 && reps <= 100) {
    return { kind: 'reps', reps };
  }
  if (kind === 'time' && Number.isInteger(seconds) && seconds !== null && seconds >= 1 && seconds <= 7200) {
    return { kind: 'time', seconds };
  }
  return null;
};

/** Read every Phase 18 classification input from SQLite while the caller's
 * finalization transaction is open. Historical rows without 026 snapshots
 * remain present through LEFT JOINs and therefore classify as unknown. */
const hydrateSessionFinalization = (d: DB, sessionId: number): SessionFinalizationSnapshot => {
  const checkpoint = rowsOf<{
    session_mode: string;
    phase: string;
    runner_state_json: string;
    session_date: string;
    started_at_ms: number | null;
  }>(d.executeSync(
    'SELECT c.session_mode, c.phase, c.runner_state_json, s.session_date, s.started_at_ms FROM session_runner_checkpoint c JOIN session s ON s.session_id = c.session_id WHERE c.session_id = ?',
    [sessionId],
  ))[0];
  if (checkpoint === undefined) throw new Error('Session checkpoint is missing; reopen the session before finishing.');
  if (checkpoint.session_mode !== 'guided' && checkpoint.session_mode !== 'self_directed') {
    throw new Error('Session checkpoint has an invalid frozen mode.');
  }

  const runner = deserializeRunner(checkpoint.runner_state_json);
  if (runner.phase !== checkpoint.phase) throw new Error('Session checkpoint phase does not match its runner state.');

  const origin = rowsOf<{ origin_kind: string; source_planned_session_id: number | null }>(d.executeSync(
    'SELECT origin_kind, source_planned_session_id FROM session_origin WHERE session_id = ?',
    [sessionId],
  ))[0];
  if (origin !== undefined && origin.origin_kind !== 'planned' && origin.origin_kind !== 'free_form') {
    throw new Error('Session origin is invalid.');
  }
  const originKind: SessionOutcomeOriginKind = origin?.origin_kind === 'planned' ? 'planned' : 'free_form';

  const slotRows = rowsOf<{
    session_plan_slot_id: number;
    planned_sets: number;
    provenance_kind: string;
  }>(d.executeSync(
    'SELECT session_plan_slot_id, planned_sets, provenance_kind FROM session_plan_slot WHERE session_id = ? ORDER BY slot_index',
    [sessionId],
  ));
  const slots: SessionOutcomeInput['slots'] = slotRows.map((row) => ({
    sessionPlanSlotId: row.session_plan_slot_id,
    plannedSets: row.planned_sets,
    provenanceKind: row.provenance_kind as SessionOutcomeProvenanceKind,
  }));
  if (
    runner.slots.length !== slotRows.length ||
    runner.slots.some((slot, index) =>
      slot.sessionPlanSlotId !== slotRows[index]?.session_plan_slot_id ||
      slot.sets !== slotRows[index]?.planned_sets
    )
  ) {
    throw new Error('Session checkpoint no longer matches its frozen plan.');
  }

  const setRows = rowsOf<{
    set_id: number;
    movement_id: number;
    reps: number;
    rpe: number | null;
    session_plan_slot_id: number | null;
    source_planned_slot_id: number | null;
    provenance_kind: string | null;
    target_kind: string | null;
    target_reps: number | null;
    target_seconds: number | null;
    time_s: number | null;
  }>(d.executeSync(
    "SELECT sr.set_id, sr.movement_id, sr.reps, sr.rpe, st.session_plan_slot_id, st.source_planned_slot_id, st.provenance_kind, sdt.target_kind, sdt.target_reps, sdt.target_seconds, tm.value AS time_s FROM set_record sr LEFT JOIN set_target st ON st.set_id = sr.set_id LEFT JOIN set_dose_target sdt ON sdt.set_id = sr.set_id LEFT JOIN set_metric tm ON tm.set_id = sr.set_id AND tm.metric = 'time_s' WHERE sr.session_id = ? ORDER BY sr.set_id",
    [sessionId],
  ));
  const sets: SessionOutcomeInput['sets'] = setRows.map((row) => {
    const prescribedDose = doseFromFields(row.target_kind, row.target_reps, row.target_seconds);
    const repsDose = Number.isInteger(row.reps) && row.reps >= 1 && row.reps <= 100
      ? { kind: 'reps' as const, reps: row.reps }
      : null;
    const timeDose = Number.isInteger(row.time_s) && row.time_s !== null && row.time_s >= 1 && row.time_s <= 7200
      ? { kind: 'time' as const, seconds: row.time_s }
      : null;
    const actualDose = prescribedDose?.kind === 'time'
      ? timeDose
      : prescribedDose?.kind === 'reps'
        ? repsDose
        : timeDose ?? repsDose;
    return {
      setId: row.set_id,
      sessionPlanSlotId: row.session_plan_slot_id,
      provenanceKind: (row.provenance_kind ?? 'free_form') as SessionOutcomeProvenanceKind,
      prescribedDose,
      actualDose,
    };
  });

  const hasPersistedSafetyHalt = rowsOf<{ present: number }>(d.executeSync(
    'SELECT 1 AS present FROM subjective_report WHERE date = ? AND halt = 1 ORDER BY report_id DESC LIMIT 1',
    [checkpoint.session_date],
  ))[0]?.present === 1;

  return {
    sessionDate: checkpoint.session_date,
    startedAtMs: checkpoint.started_at_ms,
    originKind,
    sourcePlannedSessionId: originKind === 'planned' ? origin?.source_planned_session_id ?? null : null,
    sessionMode: checkpoint.session_mode,
    runner,
    hasPersistedSafetyHalt,
    slots,
    sets,
    loggedSets: setRows.map((row) => ({
      setId: row.set_id,
      movementId: row.movement_id,
      sessionPlanSlotId: row.session_plan_slot_id,
      sourcePlannedSlotId: row.source_planned_slot_id,
      reps: row.reps,
      rpe: row.rpe,
    })),
  };
};

const persistSessionOutcome = (
  d: DB,
  sessionId: number,
  originKind: SessionOutcomeOriginKind,
  sessionMode: SessionMode,
  trainingAge: RunnerState['tier'],
  outcomeDecision: SessionOutcomeDecision,
): void => {
  const evidence = outcomeDecision.evidence;
  d.executeSync(
    'INSERT INTO session_outcome (session_id, outcome_kind, terminal_phase, halt_reason, origin_kind, session_mode, training_age, slot_count, planned_set_count, logged_set_count, exact_dose_count, under_dose_count, over_dose_count, unknown_dose_count, unmapped_set_count, missing_set_count, missing_unskipped_set_count, extra_set_count, adapted_slot_count, skipped_slot_count, off_plan_slot_count, finalized_at_ms, engine_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      sessionId,
      outcomeDecision.kind,
      outcomeDecision.terminalPhase,
      outcomeDecision.haltReason,
      originKind,
      sessionMode,
      trainingAge,
      evidence.slotCount,
      evidence.plannedSetCount,
      evidence.loggedSetCount,
      evidence.exactDoseCount,
      evidence.underDoseCount,
      evidence.overDoseCount,
      evidence.unknownDoseCount,
      evidence.unmappedSetCount,
      evidence.missingSetCount,
      evidence.missingUnskippedSetCount,
      evidence.extraSetCount,
      evidence.adaptedSlotCount,
      evidence.skippedSlotCount,
      evidence.offPlanSlotCount,
      outcomeDecision.finalizedAtMs,
      outcomeDecision.engineVersion,
    ],
  );
};

/** Macro-cycle continuation — the ONLY place the next position is derived.
 *  Every path that mints a block_meta row must call this. Two callers used to
 *  compute it independently and drifted: the routine-template freeze hardcoded
 *  index 1 / 'gpp', so using a template after a block expired rewound an
 *  athlete mid-macrocycle back to the start (audit 6ff5449 s2). Deterministic:
 *  reads persisted state only, no clock, no RNG. */
const nextMacroPosition = (d: DB): { macroBlockIndex: number; macroPhase: MacroPhase } => {
  const lastMeta = rowsOf<{ macro_block_index: number }>(d.executeSync(
    'SELECT macro_block_index FROM block_meta ORDER BY block_id DESC LIMIT 1',
  ))[0];
  const macroBlockIndex = lastMeta !== undefined
    ? (lastMeta.macro_block_index % MACRO_BLOCKS) + 1
    : 1;
  return { macroBlockIndex, macroPhase: macroPhaseOf(macroBlockIndex) };
};

/** Preserve the existing APRE mutation, but bind it to this session's frozen
 * planned origin and persisted sets. Recognition labels never enter this path. */
const applyApreFinalization = (
  d: DB,
  sourcePlannedSessionId: number | null,
  loggedSets: readonly FinalizationLoggedSet[],
  finalizedAtMs: number,
): void => {
  if (sourcePlannedSessionId === null) return;
  const source = rowsOf<{ week_index: number; block_id: number }>(d.executeSync(
    `SELECT ps.week_index, ps.block_id FROM planned_session ps JOIN block_meta bm ON bm.block_id = ps.block_id LEFT JOIN planned_session_method psm ON psm.planned_session_id = ps.planned_session_id WHERE ps.planned_session_id = ? AND COALESCE(psm.schema_type, bm.schema_type) = 'APRE'`,
    [sourcePlannedSessionId],
  ))[0];
  if (source === undefined || source.week_index >= 4) return;

  const sourceSlots = rowsOf<{ planned_slot_id: number; movement_id: number; reps: number; one_rm_kg: number | null }>(d.executeSync(
    'SELECT sl.planned_slot_id, sl.movement_id, sl.reps, orm.load_kg AS one_rm_kg FROM planned_slot sl LEFT JOIN one_rep_max orm ON orm.movement_id = sl.movement_id WHERE sl.planned_session_id = ? ORDER BY sl.slot_index',
    [sourcePlannedSessionId],
  ));
  for (const slot of sourceSlots) {
    if (slot.one_rm_kg === null) continue;
    const bestReps = loggedSets
      .filter((loggedSet) => loggedSet.sourcePlannedSlotId === slot.planned_slot_id && loggedSet.movementId === slot.movement_id)
      .reduce((best, loggedSet) => Math.max(best, loggedSet.reps), 0);
    const surplus = bestReps - slot.reps;
    if (surplus <= 0) continue;
    const nextSlot = rowsOf<{ planned_slot_id: number; reps: number; target_rpe: number }>(d.executeSync(
      'SELECT sl.planned_slot_id, sl.reps, sl.target_rpe FROM planned_slot sl JOIN planned_session ps ON ps.planned_session_id = sl.planned_session_id WHERE ps.block_id = ? AND ps.week_index = ? AND sl.movement_id = ? ORDER BY ps.day_index LIMIT 1',
      [source.block_id, source.week_index + 1, slot.movement_id],
    ))[0];
    if (nextSlot === undefined) continue;
    const deltaKg = Math.min(7.5, Math.ceil(surplus / 2) * 2.5);
    const existing = rowsOf<{ target_load_kg: number }>(d.executeSync(
      'SELECT target_load_kg FROM slot_override WHERE planned_slot_id = ?',
      [nextSlot.planned_slot_id],
    ))[0];
    const base = existing?.target_load_kg ?? targetLoadKg(slot.one_rm_kg, nextSlot.reps, nextSlot.target_rpe);
    d.executeSync(
      'INSERT INTO slot_override (planned_slot_id, target_load_kg, reason, created_at_ms) VALUES (?, ?, ?, ?) ON CONFLICT(planned_slot_id) DO UPDATE SET target_load_kg = excluded.target_load_kg, reason = excluded.reason, created_at_ms = excluded.created_at_ms',
      [
        nextSlot.planned_slot_id,
        clamp(base + deltaKg, 2.5, 600),
        'APRE: +' + deltaKg + ' kg, beat the ' + slot.reps + '-rep target by ' + surplus + ' last week',
        finalizedAtMs,
      ],
    );
  }
};
const runnerSelection = (runner: RunnerState): Pick<KineticsStore, 'runner' | 'activeSessionPlanSlotId' | 'activeMovementId'> => {
  const current = currentRunnerSlot(runner);
  return {
    runner,
    activeSessionPlanSlotId: current?.sessionPlanSlotId ?? null,
    activeMovementId: current?.movementId ?? null,
  };
};

/** One durable, evidence-backed starting load per movement. Zero is preserved
 * as valid evidence for bodyweight work; only an absent row means “start light”. */
const latestLoadMap = (d: DB): Record<number, number> => {
  const rows = rowsOf<{ movement_id: number; load_kg: number | null }>(d.executeSync(
    `SELECT m.movement_id,
            (SELECT sr.load_kg FROM set_record sr
              WHERE sr.movement_id = m.movement_id
              ORDER BY sr.set_id DESC LIMIT 1) AS load_kg
       FROM movement m`,
  ));
  return Object.fromEntries(
    rows.filter((row) => row.load_kg !== null).map((row) => [row.movement_id, row.load_kg as number]),
  );
};
interface PendingProgramCreation {
  input: TrainingProgramInput;
  preview: TrainingProgramPreview;
  programDays: ProgramDayPreference[];
}

let pendingProgramCreation: PendingProgramCreation | null = null;

interface PendingProgramContinuation {
  programId: number;
  sequenceIndex: number;
  /** The program's own anchor macro position (training_program.starting_macro_block_index).
   *  Carried through so preview and committed generation share the SAME
   *  program-owned derivation (AUD-GP-2) — never re-read from the global cycle. */
  startingMacroBlockIndex: number;
  plannedEndDate: string;
  programDays: ProgramDayPreference[];
  weeklyFrequency: number;
  objective: UserProfile['objective'];
}

let pendingProgramContinuation: PendingProgramContinuation | null = null;
const isoUtcMs = (value: string): number => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Review date must use YYYY-MM-DD.');
  const [y, m, day] = value.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, day);
  if (new Date(ms).toISOString().slice(0, 10) !== value) throw new Error('Review date is not valid.');
  return ms;
};

const trainingProgramShape = (profile: UserProfile, input: TrainingProgramInput, startDate: string) => {
  const selected = [...new Set(input.dayIndices)].sort((a, b) => a - b);
  if (selected.length < 1 || selected.length > 7
      || selected.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
    throw new Error('Choose between one and seven training days.');
  }
  let plannedBlockCount: number;
  let requestedReviewDate: string | null = null;
  if (input.horizon.kind === 'weeks') {
    plannedBlockCount = input.horizon.blockCount;
    if (!Number.isInteger(plannedBlockCount) || plannedBlockCount < 1 || plannedBlockCount > 8) {
      throw new Error('Choose a review horizon from 4 to 32 weeks.');
    }
  } else {
    requestedReviewDate = input.horizon.requestedReviewDate;
    const daysAway = Math.floor((isoUtcMs(requestedReviewDate) - isoUtcMs(startDate)) / 86400000);
    if (daysAway < 28 || daysAway > 224) throw new Error('Review date must be 4 to 32 weeks away.');
    plannedBlockCount = Math.ceil(daysAway / 28);
  }
  const focuses = programFocuses(profile.objective, selected.length);
  const days = selected.map((dayIndex, i) => ({ dayIndex, focus: focuses[i] }));
  const allowedDays = new Set(selected);
  const seenSlots = new Set<string>();
  const movementPreferences = [...(input.movementPreferences ?? [])].sort(
    (a, b) => a.dayIndex - b.dayIndex || a.slotIndex - b.slotIndex,
  );
  for (const preference of movementPreferences) {
    const key = `${preference.dayIndex}:${preference.slotIndex}`;
    if (!allowedDays.has(preference.dayIndex) || !Number.isInteger(preference.slotIndex)
        || preference.slotIndex < 1 || preference.slotIndex > 5 || seenSlots.has(key)) {
      throw new Error('A movement preference points to an invalid program slot.');
    }
    seenSlots.add(key);
  }
  const programDays: ProgramDayPreference[] = days.map((day) => ({
    day_index: day.dayIndex,
    focus: day.focus as ProgramDayPreference['focus'],
    movement_preferences: movementPreferences.filter((p) => p.dayIndex === day.dayIndex).map((p) => ({
      slot_index: p.slotIndex, pattern: p.pattern, movement_id: p.movementId,
    })),
  }));
  return {
    requestedReviewDate, plannedBlockCount,
    plannedEndDate: addDaysIso(startDate, plannedBlockCount * 28),
    days, movementPreferences, programDays,
  };
};

/** Everything per-athlete in the store, cleared on a Coach Mode file swap so
 *  nothing bleeds across athletes (the re-boot re-hydrates all of it from the
 *  target file). `onboarded: true` here is the no-flash default; boot() then
 *  reads the real value from the new file. */
const PER_ATHLETE_RESET: Partial<KineticsStore> = {
  vector: null, trend: [], session: null, prescription: null,
  profileNotes: [], profile: DEFAULT_PROFILE, triaging: false, lastTriage: null,
  sessionPlan: [], activeSessionPlanSlotId: null, activeMovementId: null, runner: null, sessionMode: null, substitution: null, niggles: [],
  activePriorExperienceMovementIds: [], movementAvailabilityRevision: 0, activeSessionAccessContext: null,
  block: null, blockMeta: null, blockSessions: [], todayPlan: null, program: null, routineTemplates: [],
  oneRepMaxes: {}, lastLoggedLoads: {}, lastEndedSessionId: null, profileSlots: [], uiPreferences: defaultUiPreferences(DEFAULT_PROFILE), loadPreference: 'auto', loadPreferenceExplicit: false, bandLadder: [], onboarded: true,
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
  activeSessionPlanSlotId: null,
  activeMovementId: null,
  runner: null,
  sessionMode: null,
  substitution: null,
  niggles: [],
  activePriorExperienceMovementIds: [],
  movementAvailabilityRevision: 0,
  activeSessionAccessContext: null,
  block: null,
  blockMeta: null,
  blockSessions: [],
  todayPlan: null,
  hasArchivedBlock: false,
  program: null,
  routineTemplates: [],
  oneRepMaxes: {},
  lastLoggedLoads: {},
  lastEndedSessionId: null,
  biometricsStatus: 'off',
  profileSlots: [],
  uiPreferences: defaultUiPreferences(DEFAULT_PROFILE),
  loadPreference: 'auto',
  loadPreferenceExplicit: false,
  bandLadder: [],
  movementPrefixes: [],
  athletes: [],
  activeAthleteId: 'default',
  advancedToolsUnlocked: false,
  onboarded: true,

  boot: () => {
    if (get().status === 'ready') return;
    // Audit A6: App.tsx and ReadinessScreen both invoke boot() on mount; the
    // second concurrent boot reopened the DB and leaked the first handle.
    if (bootInFlight) return;
    bootInFlight = true;
    // Async wrapper: the athlete-registry read is the only await; everything
    // after it is the original synchronous boot path against the chosen file.
    void (async () => {
    try {
      const reg = await loadRegistry();
      const entry = activeEntry(reg);
      set({
        athletes: reg.athletes,
        activeAthleteId: entry.id,
        advancedToolsUnlocked: reg.advancedToolsUnlocked,
      });
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
          MOVEMENT_LIBRARY_SQL,
        ),
      ).map(movementFromRow);
      const profileRow = rowsOf<ProfileRow>(
        getDb().executeSync('SELECT * FROM athlete_profile WHERE profile_id = 1'),
      )[0];
      const rms = rowsOf<{ movement_id: number; load_kg: number }>(
        getDb().executeSync('SELECT movement_id, load_kg FROM one_rep_max'),
      );
      const lastLoggedLoads = latestLoadMap(getDb());
      const capabilityFacts = loadCapabilityFacts(getDb());
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
        lastLoggedLoads,
        status: 'ready',
        error: null,
        onboarded: onboardStamp !== undefined && onboardStamp.updated_at_ms > 0,
        movements,
        activePriorExperienceMovementIds: capabilityFacts.priorExperienceMovementIds,
        movementAvailabilityRevision: 0,
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
      get().refreshUiPreferences();
      get().refreshLoadPreference();
      get().refreshBandLadder();
      // The block lives only in SQLite; the store is a read surface over it.
      get().refreshBlock();
      get().refreshProgram();
      get().loadRoutineTemplates();
      // Audit B6: an app killed mid-session RESUMES it on restart instead of
      // permitting a duplicate shell. Unfinished = today's row with no
      // duration (endSession stamps duration or deletes empty shells).
      const openSession = rowsOf<{ session_id: number; started_at_ms: number | null }>(
        db!.executeSync(
          'SELECT session_id, started_at_ms FROM session WHERE session_date = ? AND duration_min IS NULL AND started_at_ms IS NOT NULL ORDER BY session_id DESC LIMIT 1',
          [localToday()],
        ),
      )[0];
      if (openSession !== undefined) {
        const restoredOrigin = rowsOf<{ origin_kind: string; focus: string | null }>(
          db!.executeSync(
            `SELECT so.origin_kind, ps.focus
             FROM session_origin so
             LEFT JOIN planned_session ps ON ps.planned_session_id = so.source_planned_session_id
             WHERE so.session_id = ?`,
            [openSession.session_id],
          ),
        )[0];
        const restoredAccessContext: ExecutableMovementAccessContext =
          restoredOrigin?.origin_kind === 'planned' && restoredOrigin.focus !== null
            ? accessContextForBlockFocus(restoredOrigin.focus as BlockFocus)
            : 'weight_room';
        const restored = rowsOf<{
          set_id: number;
          movement_id: number;
          movement_name: string;
          set_index: number;
          reps: number;
          load_kg: number;
          rpe: number | null;
          session_plan_slot_id: number | null;
          time_s: number | null; band_level: number | null;
        }>(
          db!.executeSync(
            `SELECT sr.set_id, sr.movement_id, m.name AS movement_name, sr.set_index, sr.reps, sr.load_kg, sr.rpe,
                    st.session_plan_slot_id, tm.value AS time_s, bm.value AS band_level
             FROM set_record sr
             JOIN movement m ON m.movement_id = sr.movement_id
             LEFT JOIN set_target st ON st.set_id = sr.set_id
             LEFT JOIN set_metric tm ON tm.set_id = sr.set_id AND tm.metric = 'time_s'
             LEFT JOIN set_metric bm ON bm.set_id = sr.set_id AND bm.metric = 'band_level'
             WHERE sr.session_id = ?
             ORDER BY sr.set_index DESC`,
            [openSession.session_id],
          ),
        );
        const planSlots = rowsOf<{
          session_plan_slot_id: number;
          movement_id: number;
          planned_sets: number;
          planned_reps: number | null;
          target_kind: string | null; target_reps: number | null; target_seconds: number | null;
          provenance_kind: string;
          target_rpe: number | null;
          source_planned_slot_id: number | null;
          original_movement_id: number | null;
          original_session_date: string | null;
          override_load_kg: number | null;
          override_reason: string | null;
        }>(
          db!.executeSync(
            `SELECT sps.session_plan_slot_id, sps.movement_id, sps.planned_sets, sps.planned_reps,
                    sst.target_kind, sst.target_reps, sst.target_seconds,
                    sps.provenance_kind, sps.target_rpe, sps.source_planned_slot_id,
                    sps.original_movement_id, sps.original_session_date, sps.override_load_kg, sps.override_reason
             FROM session_plan_slot sps
             LEFT JOIN session_slot_target sst ON sst.session_plan_slot_id = sps.session_plan_slot_id
             WHERE sps.session_id = ?
             ORDER BY sps.slot_index`,
            [openSession.session_id]
          )
        );
        const sessionPlan = planSlots.map((ps) => ({
          sessionPlanSlotId: ps.session_plan_slot_id,
          movementId: ps.movement_id,
          plannedSets: ps.planned_sets,
          plannedReps: ps.planned_reps,
          target: targetFromFields(ps.target_kind, ps.target_reps, ps.target_seconds, ps.planned_reps),
          provenanceKind: ps.provenance_kind as SlotProvenanceKind,
          targetRpe: ps.target_rpe,
          sourcePlannedSlotId: ps.source_planned_slot_id,
          originalMovementId: ps.original_movement_id,
          originalSessionDate: ps.original_session_date,
          overrideLoadKg: ps.override_load_kg,
          overrideReason: ps.override_reason,
        }));
        const checkpoint = rowsOf<{
          session_mode: string;
          runner_state_json: string;
        }>(db!.executeSync(
          `SELECT session_mode, runner_state_json
           FROM session_runner_checkpoint WHERE session_id = ?`,
          [openSession.session_id],
        ))[0];
        const fallbackMode = modeForNewSession(get().uiPreferences, get().profile);
        const restoredMode: SessionMode = checkpoint?.session_mode === 'guided' || checkpoint?.session_mode === 'self_directed'
          ? checkpoint.session_mode
          : fallbackMode;
        let restoredRunner: RunnerState;
        try {
          if (checkpoint === undefined) throw new Error('legacy open session has no checkpoint');
          restoredRunner = deserializeRunner(checkpoint.runner_state_json);
          const dbSlotIds = sessionPlan.map((slot) => slot.sessionPlanSlotId).join(',');
          const runnerSlotIds = restoredRunner.slots.map((slot) => slot.sessionPlanSlotId).join(',');
          if (dbSlotIds !== runnerSlotIds) throw new Error('checkpoint slots no longer match the session plan');
        } catch {
          // Legacy in-progress sessions predate 023. Replay their durable set
          // count without reading a clock, then pin a new exact checkpoint.
          restoredRunner = startRunner(
            runnerSlotsForPlan(sessionPlan, get().movements),
            { tier: get().profile.training_age, startedAtMs: openSession.started_at_ms ?? null },
          );
          const loggedBySlot = new Map<number, number>();
          for (const setRow of restored) {
            if (setRow.session_plan_slot_id !== null) {
              loggedBySlot.set(
                setRow.session_plan_slot_id,
                (loggedBySlot.get(setRow.session_plan_slot_id) ?? 0) + 1,
              );
            }
          }
          let replayAt = openSession.started_at_ms ?? 0;
          for (const slot of restoredRunner.slots) {
            for (let count = 0; count < (loggedBySlot.get(slot.sessionPlanSlotId) ?? 0); count++) {
              replayAt += 1;
              restoredRunner = advanceSessionRunner(restoredRunner, { kind: 'LOG_SET', atMs: replayAt });
              if (restoredRunner.phase === 'resting') {
                restoredRunner = advanceSessionRunner(restoredRunner, { kind: 'SKIP_REST', atMs: replayAt });
              }
            }
          }
          try {
            db!.executeSync('BEGIN');
            persistRunnerCheckpoint(db!, openSession.session_id, restoredMode, restoredRunner);
            db!.executeSync('COMMIT');
          } catch {
            try { db!.executeSync('ROLLBACK'); } catch { /* resume still works in memory */ }
          }
        }
        set({
          session: {
            sessionId: openSession.session_id,
            date: localToday(),
            startedAtMs: openSession.started_at_ms ?? Date.now(),
            sets: restored.map((r) => ({
              set_id: r.set_id,
              movement_id: r.movement_id,
              movement_name: r.movement_name,
              set_index: r.set_index,
              reps: r.reps,
              load_kg: r.load_kg,
              rpe: r.rpe,
              tonnage_kg: r.reps * r.load_kg,
              session_plan_slot_id: r.session_plan_slot_id,
              timeS: r.time_s,
              bandLevel: r.band_level,
            })),
          },
          sessionPlan,
          sessionMode: restoredMode,
          activeSessionAccessContext: restoredAccessContext,
          ...runnerSelection(restoredRunner),
        });
      }
      // Prescription is a pure derivation over persisted state (profile +
      // today's reports), so a halt logged yesterday evening survives an
      // app restart this morning.
      get().computePrescription([]);
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    } finally {
      bootInFlight = false;
    }
    })();
  },

  saveProfile: (patch) => {
    const prior = get().profile;
    const merged: UserProfile = { ...prior, ...patch };
    // Clamp numerics to the 006 CHECK domains (UI bugs must never throw).
    merged.weekly_frequency = Math.round(clamp(merged.weekly_frequency, 1, 7));
    merged.max_sessions_per_day = Math.round(clamp(merged.max_sessions_per_day, 1, 3));
    merged.session_duration_cap_min = Math.round(clamp(merged.session_duration_cap_min, 15, 240));
    merged.base_rpe_cap = clamp(Math.round(merged.base_rpe_cap * 2) / 2, 5, 10);
    // Canonical inventory: dedupe, drop unknown items, EQUIPMENT_ITEMS order
    // (the block generator's determinism depends on a stable order).
    const owned = new Set(merged.equipment_inventory);
    merged.equipment_inventory = EQUIPMENT_ITEMS.filter((i) => owned.has(i));
    const currentLoadPreference = {
      preference: get().loadPreference,
      explicit: get().loadPreferenceExplicit,
    };
    const nextLoadPreference = planProfileLoadTransition(
      prior.training_age,
      merged.training_age,
      currentLoadPreference,
      transitionLoadPreference,
    );
    try {
      const result = executeProfileLoadSave({
        getDb,
        sessionActive: get().session !== null,
        current: currentLoadPreference,
        next: nextLoadPreference,
        persistProfile: (d) => persistProfileFields(d as DB, merged),
        commitState: () => {
          set({
            profile: merged,
            loadPreference: nextLoadPreference.preference,
            loadPreferenceExplicit: nextLoadPreference.explicit,
          });
          // Re-derive: profile clamps may have changed the operative prescription.
          if (get().prescription !== null) get().computePrescription([]);
        },
      });
      if (!result.ok) set({ error: result.error });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
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

  refreshUiPreferences: () => {
    const d = getDb();
    const row = rowsOf<{
      session_mode_override: string | null;
      readiness_detail: string | null;
      rest_timer_enabled: number | null;
      text_scale: string | null;
    }>(d.executeSync(
      `SELECT p.session_mode_override, p.readiness_detail, p.rest_timer_enabled, p.text_scale
       FROM profile_slot s
       LEFT JOIN profile_ui_preference p ON p.profile_slot_id = s.slot_id
       WHERE s.is_active = 1
       LIMIT 1`,
    ))[0];
    set({ uiPreferences: uiPreferencesFromRow(row, get().profile) });
  },

  saveUiPreferences: (patch) => {
    const d = getDb();
    const slot = rowsOf<{ slot_id: number }>(
      d.executeSync('SELECT slot_id FROM profile_slot WHERE is_active = 1 LIMIT 1'),
    )[0];
    if (slot === undefined) return;
    const current = get().uiPreferences;
    const next: UiPreferences = { ...current, ...patch };
    d.executeSync(
      `INSERT INTO profile_ui_preference
         (profile_slot_id, session_mode_override, readiness_detail, rest_timer_enabled, text_scale, updated_at_ms)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(profile_slot_id) DO UPDATE SET
         session_mode_override = excluded.session_mode_override,
         readiness_detail = excluded.readiness_detail,
         rest_timer_enabled = excluded.rest_timer_enabled,
         text_scale = excluded.text_scale,
         updated_at_ms = excluded.updated_at_ms`,
      [
        slot.slot_id,
        next.sessionModeOverride,
        next.readinessDetail,
        next.restTimerEnabled ? 1 : 0,
        next.textScale,
        Date.now(),
      ],
    );
    set({ uiPreferences: next });
  },

  refreshLoadPreference: () => {
    const loaded = readActiveLoadPreference(
      getDb(),
      get().profile.training_age,
      defaultLoadPreference,
    );
    set({ loadPreference: loaded.preference, loadPreferenceExplicit: loaded.explicit });
  },

  saveLoadPreference: (preference) => {
    const result = executeDirectLoadPreferenceSave({
      getDb,
      sessionActive: get().session !== null,
      trainingAge: get().profile.training_age,
      preference,
      commitState: () => set({ loadPreference: preference, loadPreferenceExplicit: true }),
    });
    if (!result.ok && result.error !== null) set({ error: result.error });
    return result.ok;
  },

  resolveSlotLoad: (input) => {
    const state = get();
    const latestCurrentSessionSet = state.session?.sets.reduce<LoggedSet | null>(
      (latest, candidate) => candidate.movement_id === input.movementId
        && (latest === null || candidate.set_id > latest.set_id)
        ? candidate
        : latest,
      null,
    ) ?? null;
    return resolveLoadSelection({
      trainingAge: state.profile.training_age,
      preference: state.loadPreference,
      bodyweightMode: input.bodyweightMode,
      targetReps: input.targetReps,
      targetRpe: input.targetRpe,
      oneRepMaxKg: state.oneRepMaxes[input.movementId] ?? null,
      overrideLoadKg: input.overrideLoadKg,
      lastLoggedLoadKg: state.lastLoggedLoads[input.movementId] ?? null,
      currentSessionLoadKg: latestCurrentSessionSet?.load_kg ?? null,
      isFirstSet: latestCurrentSessionSet === null,
    });
  },

  refreshBandLadder: () => {
    const rows = rowsOf<{ level: number; label: string }>(
      getDb().executeSync('SELECT level, label FROM band_ladder ORDER BY level'),
    );
    set({ bandLadder: rows.map((row) => ({ level: row.level, label: row.label })) });
  },

  saveBandLevel: (level, label) => {
    const safeLevel = Math.round(clamp(level, 1, 20));
    const safeLabel = label.trim().slice(0, 48) || `Band ${safeLevel}`;
    getDb().executeSync(
      `INSERT INTO band_ladder (level, label) VALUES (?, ?)
       ON CONFLICT(level) DO UPDATE SET label = excluded.label`,
      [safeLevel, safeLabel],
    );
    get().refreshBandLadder();
  },

  deleteBandLevel: (level) => {
    getDb().executeSync('DELETE FROM band_ladder WHERE level = ?', [Math.round(clamp(level, 1, 20))]);
    get().refreshBandLadder();
  },
  switchProfile: (slotId) => {
    // Audit A2: swapping the athlete_profile mid-session changes the caps and
    // guardrails the live session was prescribed under.
    if (get().session !== null) {
      set({ error: 'End the active session before switching profiles.' });
      return;
    }
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
      d.executeSync("UPDATE training_program SET status = 'archived', updated_at_ms = ? WHERE status IN ('active','review_due')", [Date.now()]);
      d.executeSync('COMMIT');
    } catch (e) {
      d.executeSync('ROLLBACK');
      set({ error: e instanceof Error ? e.message : String(e) });
      return;
    }
    set({
      profile: loaded,
      block: null, blockMeta: null, blockSessions: [], todayPlan: null, program: null,
      niggles: [], lastTriage: null,
    });
    get().refreshProfileSlots();
    get().refreshUiPreferences();
    get().refreshLoadPreference();
    get().refreshBandLadder();
    get().refreshNiggles();
    get().refreshBlock();
    get().refreshProgram();
    get().refreshVector();
    get().computePrescription([]);
  },

  wipeActiveBlockState: () => {
    if (get().session !== null) {
      set({ error: 'End the active session before deleting the block.' });
      return;
    }
    const d = getDb();
    d.executeSync('BEGIN');
    try {
      runBlockWipe(d, localToday());
      d.executeSync("UPDATE training_program SET status = 'archived', updated_at_ms = ? WHERE status IN ('active','review_due')", [Date.now()]);
      d.executeSync('COMMIT');
    } catch (e) {
      d.executeSync('ROLLBACK');
      set({ error: e instanceof Error ? e.message : String(e) });
      return;
    }
    // Clear EVERY piece of UI state derived from the wiped rows (audit: stale
    // prescription/substitution/plan state survived the wipe). profileNotes are
    // NOT cleared — athlete_profile is intentionally preserved by this wipe.
    set({ block: null, blockMeta: null, blockSessions: [], todayPlan: null, program: null, niggles: [], lastTriage: null, prescription: null, substitution: null, sessionPlan: [], activeSessionPlanSlotId: null, activeMovementId: null, runner: null, sessionMode: null, lastEndedSessionId: null });
    get().refreshNiggles();
    get().refreshBlock();
    get().refreshProgram();
    get().refreshVector();
    get().computePrescription([]);
  },

  resolveGoalRung: (progressionGroup, today) => {
    const d = getDb();
    const chain = rowsOf<{ name: string; progression_group: string; progression_rank: number }>(
      d.executeSync('SELECT m.name, p.progression_group, p.progression_rank FROM movement_progression p JOIN movement m ON m.movement_id = p.movement_id WHERE p.progression_group = ? ORDER BY p.progression_rank', [progressionGroup]),
    ).map((r) => ({ movementName: r.name, progressionGroup: r.progression_group, progressionRank: r.progression_rank }));
    if (chain.length === 0) return null;
    // Per-session set lists at chain movements (same-session 3x8 semantics —
    // the engine never aggregates across sessions). Bounded by evidence window.
    const rows = rowsOf<{ session_id: number; name: string; reps: number }>(
      d.executeSync(
        "SELECT sr.session_id, m.name, COALESCE(sm.value, sr.reps) AS reps FROM set_record sr JOIN session s ON s.session_id = sr.session_id JOIN movement m ON m.movement_id = sr.movement_id JOIN movement_progression p ON p.movement_id = sr.movement_id LEFT JOIN set_metric sm ON sm.set_id = sr.set_id AND sm.metric = 'time_s' WHERE p.progression_group = ? AND s.session_date >= date(?, ?) ORDER BY sr.session_id, sr.set_index",
        [progressionGroup, today, `-${CAPABILITY_EVIDENCE_WINDOW_DAYS} days`],
      ),
    );
    const bySession = new Map<string, { movementName: string; repsPerSet: number[] }>();
    for (const r of rows) {
      const key = `${r.session_id}:${r.name}`;
      const entry = bySession.get(key);
      if (entry === undefined) bySession.set(key, { movementName: r.name, repsPerSet: [r.reps] });
      else entry.repsPerSet.push(r.reps);
    }
    // Per-chain policy (018 progression_policy): time chains qualify on
    // seconds, custom rep chains override the 3x8 default.
    const pol = rowsOf<{ required_sets: number; required_value: number }>(
      d.executeSync('SELECT required_sets, required_value FROM progression_policy WHERE progression_group = ?', [progressionGroup]),
    )[0];
    if (pol !== undefined) {
      return resolveActiveRung(chain, [...bySession.values()], { requiredSets: pol.required_sets, requiredReps: pol.required_value });
    }
    return resolveActiveRung(chain, [...bySession.values()]);
  },

  attestEdge: (prerequisiteMovementId, movementId) => {
    const d = getDb();
    d.executeSync('BEGIN');
    try {
      d.executeSync(
        'INSERT INTO movement_capability_attestation (prerequisite_movement_id, movement_id, attested_at_ms) VALUES (?, ?, ?) ON CONFLICT(prerequisite_movement_id, movement_id) DO UPDATE SET attested_at_ms = excluded.attested_at_ms',
        [prerequisiteMovementId, movementId, Date.now()],
      );
      d.executeSync('COMMIT');
    } catch (e) {
      d.executeSync('ROLLBACK');
      set({ error: e instanceof Error ? e.message : String(e) });
      return;
    }
    set((state) => ({ movementAvailabilityRevision: state.movementAvailabilityRevision + 1 }));
  },

  revokeAttestation: (prerequisiteMovementId, movementId) => {
    const d = getDb();
    d.executeSync('BEGIN');
    try {
      d.executeSync(
        'DELETE FROM movement_capability_attestation WHERE prerequisite_movement_id = ? AND movement_id = ?',
        [prerequisiteMovementId, movementId],
      );
      d.executeSync('COMMIT');
    } catch (e) {
      d.executeSync('ROLLBACK');
      set({ error: e instanceof Error ? e.message : String(e) });
      return;
    }
    set((state) => ({ movementAvailabilityRevision: state.movementAvailabilityRevision + 1 }));
  },

  confirmMovementPriorExperience: (movementId, context) => {
    const verdict = get().getMovementAvailabilityVerdicts(context)
      .find((candidate) => candidate.movementId === movementId);
    if (
      verdict === undefined
      || verdict.state !== 'teaching_only'
      || !verdict.confirmationWouldClear
      || verdict.separateAttestationRequired
      || verdict.reasons.length !== 1
      || verdict.reasons[0] !== 'capability'
    ) {
      set({ error: 'Prior experience cannot clear every current access requirement for this movement.' });
      return false;
    }
    const d = getDb();
    const now = Date.now();
    d.executeSync('BEGIN');
    try {
      d.executeSync(
        `INSERT INTO movement_prior_experience
           (movement_id, confirmed_at_ms, revoked_at_ms, basis)
         VALUES (?, ?, NULL, 'local_user_confirmation')
         ON CONFLICT(movement_id) DO UPDATE SET
           confirmed_at_ms = excluded.confirmed_at_ms,
           revoked_at_ms = NULL,
           basis = 'local_user_confirmation'`,
        [movementId, now],
      );
      d.executeSync('COMMIT');
    } catch (error) {
      try { d.executeSync('ROLLBACK'); } catch { /* no partial declaration */ }
      set({ error: error instanceof Error ? error.message : String(error) });
      return false;
    }
    const active = [...new Set([...get().activePriorExperienceMovementIds, movementId])]
      .sort((a, b) => a - b);
    set((state) => ({
      activePriorExperienceMovementIds: active,
      movementAvailabilityRevision: state.movementAvailabilityRevision + 1,
      error: null,
    }));
    return true;
  },

  revokeMovementPriorExperience: (movementId) => {
    if (!get().activePriorExperienceMovementIds.includes(movementId)) return false;
    const d = getDb();
    d.executeSync('BEGIN');
    try {
      d.executeSync(
        `UPDATE movement_prior_experience
         SET revoked_at_ms = MAX(confirmed_at_ms, ?)
         WHERE movement_id = ? AND revoked_at_ms IS NULL`,
        [Date.now(), movementId],
      );
      d.executeSync('COMMIT');
    } catch (error) {
      try { d.executeSync('ROLLBACK'); } catch { /* no partial revocation */ }
      set({ error: error instanceof Error ? error.message : String(error) });
      return false;
    }
    set((state) => ({
      activePriorExperienceMovementIds: state.activePriorExperienceMovementIds
        .filter((id) => id !== movementId),
      movementAvailabilityRevision: state.movementAvailabilityRevision + 1,
      error: null,
    }));
    return true;
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
        if (!(await saveRegistry(reg))) {
          set({ status: 'ready', error: 'Could not persist the athlete switch — registry write failed.' });
          return;
        }
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
        if (!(await saveRegistry(setActiveAthlete(reg, entry.id)))) {
          set({ status: 'ready', error: 'Could not create the athlete — registry write failed.' });
          return;
        }
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
      if (!(await saveRegistry(reg))) {
        set({ error: 'Rename not saved — registry write failed.' });
        return;
      }
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
      if (!(await saveRegistry(reg))) {
        set({ error: 'Delete not saved — registry write failed. The athlete is unchanged.' });
        return;
      }
      // File removal: an orphaned file is invisible but the UI promised the
      // database is removed — say so honestly when it is not (audit A3).
      let fileGone = true;
      try {
        const { open } = require('@op-engineering/op-sqlite') as typeof import('@op-engineering/op-sqlite');
        open({ name: removed.dbName }).delete();
      } catch { fileGone = false; }
      set({
        athletes: reg.athletes,
        error: fileGone ? null : 'Athlete removed from the list, but their database file could not be deleted. It holds no visible data and can be cleared by reinstalling.',
      });
    })();
  },

  setAdvancedToolsUnlocked: (unlocked) => {
    void (async () => {
      const reg = regSetAdvancedToolsUnlocked(await loadRegistry(), unlocked);
      if (!(await saveRegistry(reg))) {
        set({ error: 'Advanced tools setting not saved — registry write failed.' });
        return;
      }
      set({ advancedToolsUnlocked: unlocked, error: null });
    })();
  },

  completeOnboarding: (patch, athleteName, loadPreference, loadPreferenceExplicit) => {
    // ONE atomic save: profile fields + load preference commit in a SINGLE
    // SQLite transaction — no committed state may contain a completed
    // onboarding profile with the wrong tier default (WO §5). The stamp on
    // updated_at_ms is what marks this athlete onboarded on every future
    // boot, so it must land in the same commit.
    const merged: UserProfile = { ...get().profile, ...patch };
    merged.weekly_frequency = Math.round(clamp(merged.weekly_frequency, 1, 7));
    merged.max_sessions_per_day = Math.round(clamp(merged.max_sessions_per_day, 1, 3));
    merged.session_duration_cap_min = Math.round(clamp(merged.session_duration_cap_min, 15, 240));
    merged.base_rpe_cap = clamp(Math.round(merged.base_rpe_cap * 2) / 2, 5, 10);
    const owned = new Set(merged.equipment_inventory);
    merged.equipment_inventory = EQUIPMENT_ITEMS.filter((i) => owned.has(i));
    // Beginner is never asked: force auto. Non-beginner uses the athlete's
    // wizard choice, falling back to the tier default when absent.
    const pref: LoadPreference = merged.training_age === 'beginner'
      ? 'auto'
      : loadPreference ?? defaultLoadPreference(merged.training_age);
    const prefExplicit = merged.training_age !== 'beginner'
      && loadPreference !== undefined
      && (loadPreferenceExplicit ?? true);
    const d = getDb();
    d.executeSync('BEGIN');
    try {
      persistProfileFields(d, merged);
      persistLoadPreferenceRow(d, pref, prefExplicit);
      d.executeSync('COMMIT');
    } catch (e) {
      d.executeSync('ROLLBACK');
      set({ error: e instanceof Error ? e.message : String(e) });
      return;
    }
    set({
      profile: merged,
      loadPreference: pref,
      loadPreferenceExplicit: prefExplicit,
      onboarded: true,
    });
    if (get().prescription !== null) get().computePrescription([]);
    void (async () => {
      const reg = regRenameAthlete(await loadRegistry(), get().activeAthleteId, athleteName);
      if (!(await saveRegistry(reg))) {
        set({ error: 'Athlete name not saved — registry write failed. You can rename them in the ATHLETE tab.' });
        return;
      }
      set({ athletes: reg.athletes });
    })();
  },

  previewTrainingProgram: (input) => {
    if (get().session !== null) {
      throw new Error('End the active session before previewing program changes.');
    }
    const { profile, movements, vector, niggles } = get();
    if (!(['LINEAR', 'WAVE', 'STEP', 'APRE'] as readonly string[]).includes(input.schemaType)) {
      throw new Error('Choose a training method.');
    }
    const activeProgram = get().program;
    const planningProfile = activeProgram === null ? profile
      : { ...profile, objective: activeProgram.objective };
    const startDate = localToday();
    const shape = trainingProgramShape(planningProfile, input, startDate);
    const byId = new Map(movements.map((movement) => [movement.movement_id, movement]));
    const d = getDb();
    const safetyExcluded = safetyExcludedMovementIdsFor(movements, profile, niggles);
    const priorExperience = new Set(get().activePriorExperienceMovementIds);
    const capabilityAvailableWeightRoom = capabilityAvailableMovementIds(
      d, movements, profile, 'weight_room', priorExperience, safetyExcluded,
    );
    const capabilityAvailableSport = capabilityAvailableMovementIds(
      d, movements, profile, 'sport_conditioning', priorExperience, safetyExcluded,
    );
    for (const preference of shape.movementPreferences) {
      const movement = byId.get(preference.movementId);
      const day = shape.days.find((candidate) => candidate.dayIndex === preference.dayIndex);
      const accessContext = day === undefined
        ? 'weight_room'
        : accessContextForBlockFocus(day.focus as BlockFocus);
      const capabilityAvailable = accessContext === 'sport_conditioning'
        ? capabilityAvailableSport
        : capabilityAvailableWeightRoom;
      if (movement === undefined || movement.pattern !== preference.pattern) {
        throw new Error('A preferred movement does not match that slot.');
      }
      if (!permittedForProfile(movement, profile, accessContext) || !capabilityAvailable.has(movement.movement_id)) {
        throw new Error('A preferred movement is teaching-only for this athlete.');
      }
    }
    const genMovements: GeneratorMovement[] = movements.map((m) => ({
      movement_id: m.movement_id, name: m.name, pattern: m.pattern as MovementPattern,
      is_compound: m.is_compound, required: m.required, difficulty: m.difficulty,
      beginner_ok: m.beginnerOk, sportTracking: m.sportTracking,
      capability_available_weight_room: capabilityAvailableWeightRoom.has(m.movement_id),
      capability_available_sport_conditioning: capabilityAvailableSport.has(m.movement_id),
      // Store-side null <-> generator-side "absent": GeneratorMovement's optional
      // fields all use undefined as their absent signal (see blockGenerator).
      scope: m.scope ?? undefined,
    }));
    // Program-owned macro position (AUD-GP-2): when a program exists, the
    // preview shows the NEXT program block at starting + (sequence-1) mod 8 —
    // the identical derivation committed generation uses. Only a brand-new
    // program (no program row yet) anchors to the athlete's global position.
    const macroBlockIndex = activeProgram !== null
      ? programMacroIndex(activeProgram.startingMacroBlockIndex, activeProgram.currentSequenceIndex + 1)
      : nextMacroPosition(d).macroBlockIndex;
    const effectiveProfile = { ...planningProfile, weekly_frequency: shape.days.length };
    const plan = generateBlock({
      profile: effectiveProfile, movements: genMovements, startDate,
      schemaType: input.schemaType, macroBlockIndex,
      recentAcwr: vector?.acwr ?? null, programDays: shape.programDays,
    });
    return {
      objective: planningProfile.objective, startDate, requestedReviewDate: shape.requestedReviewDate,
      plannedEndDate: shape.plannedEndDate, plannedBlockCount: shape.plannedBlockCount,
      schemaType: input.schemaType, days: shape.days, plan,
    };
  },

  createTrainingProgram: (input) => {
    if (get().session !== null) {
      set({ error: 'End the active session before creating a program.' });
      return false;
    }
    if (get().block !== null || get().program !== null) {
      set({ error: 'Archive the current block or program before creating another.' });
      return false;
    }
    try {
      const preview = get().previewTrainingProgram(input);
      const shape = trainingProgramShape(get().profile, input, preview.startDate);
      pendingProgramCreation = { input, preview, programDays: shape.programDays };
      set({ error: null });
      get().generateNewBlock(input.schemaType);
      get().refreshProgram();
      const created = get().program !== null && get().error === null;
      pendingProgramCreation = null;
      return created;
    } catch (e) {
      pendingProgramCreation = null;
      set({ error: e instanceof Error ? e.message : String(e) });
      return false;
    }
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
    get().refreshProgram();
    get().computePrescription([]);
  },

  generateNewBlock: (schemaType = 'LINEAR') => {
    const { profile: storedProfile, movements, status, vector } = get();
    const pendingFrequency = pendingProgramCreation?.preview.days.length
      ?? pendingProgramContinuation?.weeklyFrequency;
    const pendingObjective = pendingProgramCreation?.preview.objective
      ?? pendingProgramContinuation?.objective;
    const profile = pendingFrequency === undefined && pendingObjective === undefined ? storedProfile
      : { ...storedProfile, weekly_frequency: pendingFrequency ?? storedProfile.weekly_frequency, objective: pendingObjective ?? storedProfile.objective };
    if (status !== 'ready') return;
    // Audit A2: regenerating mid-session archives the plan the live session
    // was built from — APRE completion would then read the WRONG plan.
    if (get().session !== null) {
      set({ error: 'End the active session before generating a new block.' });
      return;
    }
    if (get().program?.status === 'active' && pendingProgramContinuation === null && pendingProgramCreation === null) {
      set({ error: 'Review and confirm the next program block before starting it.' });
      return;
    }
    const d = getDb();
    // Macro continuation: STANDALONE blocks advance through the athlete's
    // GLOBAL 32-week cycle from wherever the last generated block sat. A
    // guided-program continuation OWNS its macro position (AUD-GP-2): block N
    // sits at starting_macro_block_index + (N-1) mod 8 — the SAME derivation
    // the preview used, never the global counter.
    const macroBlockIndex = pendingProgramContinuation !== null
      ? programMacroIndex(pendingProgramContinuation.startingMacroBlockIndex, pendingProgramContinuation.sequenceIndex)
      : nextMacroPosition(d).macroBlockIndex;
    // The generator is pure; everything stateful happens in ONE transaction
    // below so a mid-write crash leaves the previous block fully active.
    const safetyExcluded = safetyExcludedMovementIdsFor(movements, profile, get().niggles);
    const priorExperience = new Set(get().activePriorExperienceMovementIds);
    const capabilityAvailableWeightRoom = capabilityAvailableMovementIds(
      d, movements, profile, 'weight_room', priorExperience, safetyExcluded,
    );
    const capabilityAvailableSport = capabilityAvailableMovementIds(
      d, movements, profile, 'sport_conditioning', priorExperience, safetyExcluded,
    );
    const genMovements: GeneratorMovement[] = movements.map((m) => ({
      movement_id: m.movement_id,
      name: m.name,
      pattern: m.pattern as MovementPattern,
      is_compound: m.is_compound,
      required: m.required,
      // Phase 16: tier gating — beginners see Beginner + whitelisted staples.
      difficulty: m.difficulty,
      beginner_ok: m.beginnerOk,
      sportTracking: m.sportTracking,
      capability_available_weight_room: capabilityAvailableWeightRoom.has(m.movement_id),
      capability_available_sport_conditioning: capabilityAvailableSport.has(m.movement_id),
      // Store-side null <-> generator-side "absent" (see blockGenerator).
      scope: m.scope ?? undefined,
    }));
    // Phase 13 Step 4 — autopilot hydration. A bounded, READ-ONLY, n+1-free pull
    // of the trailing 3-week window: ONE grouped per-(date,pattern) set aggregate
    // (set_record ⋈ session ⋈ movement ⋈ set_prefix ⋈ the per-set set_target
    // snapshot) + ONE windowed niggle scan. mech_daily is the cross-movement raw
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
              COALESCE(SUM(CASE WHEN sr.rpe IS NOT NULL AND st.target_rpe IS NOT NULL THEN sr.rpe - st.target_rpe END), 0) AS sum_delta_rpe,
              SUM(CASE WHEN sr.rpe IS NOT NULL AND st.target_rpe IS NOT NULL THEN 1 ELSE 0 END) AS delta_count,
              SUM(1.0 / MAX(1.0, COALESCE(sp.effective_load_kg, sr.load_kg) / MAX(sr.load_kg, 0.01))) AS sum_attenuation
       FROM set_record sr
       JOIN session s ON s.session_id = sr.session_id
       JOIN movement m ON m.movement_id = sr.movement_id
       LEFT JOIN set_prefix sp ON sp.set_id = sr.set_id
       LEFT JOIN set_target st ON st.set_id = sr.set_id
       WHERE s.session_date >= ? AND s.session_date <= ?
       GROUP BY s.session_date, m.pattern`,
      [winStart, today],
    ));
    // Niggles are bucketed to LOCAL calendar days in JS (mirroring startOfTodayMs),
    // never via SQLite UTC date() — so they agree with session/state_vector dates.
    // Over-fetch by ms then let buildPatternWindow keep only in-calendar dates.
    // Calendar-anchored lower bound: local midnight of the window's OLDEST day,
    // NOT a fixed (WINDOW-1)x24h ms subtraction — that over/under-shoots across a
    // DST transition inside the window and can under-fetch day 0's niggles.
    // buildPatternWindow keeps only in-calendar dates, so any over-fetch is inert.
    const [wsY, wsM, wsD] = winCalendar[0].split('-').map(Number);
    const winStartMs = new Date(wsY, wsM - 1, wsD, 0, 0, 0, 0).getTime();
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
      programDays: pendingProgramCreation?.programDays ?? pendingProgramContinuation?.programDays,
      flawReport,
    });
    d.executeSync('BEGIN');
    try {
      let programId: number | null = pendingProgramContinuation?.programId ?? null;
      const programDraft = pendingProgramCreation;
      if (programDraft !== null) {
        // Shared production helper (AUD P2): the Node verifier exercises the
        // SAME function via the compiled core-db build.
        programId = insertTrainingProgram(d, {
          objective: profile.objective,
          startDate: programDraft.preview.startDate,
          horizonKind: programDraft.input.horizon.kind,
          requestedReviewDate: programDraft.preview.requestedReviewDate,
          plannedEndDate: programDraft.preview.plannedEndDate,
          plannedBlockCount: programDraft.preview.plannedBlockCount,
          startingMacroBlockIndex: plan.macroBlockIndex,
          schemaType,
          days: programDraft.preview.days,
          movementPreferences: programDraft.input.movementPreferences ?? [],
          weeklyFrequency: programDraft.preview.days.length,
          now: Date.now(),
        });
      }
      if (pendingProgramContinuation !== null) {
        updateTrainingProgramEndDate(d, pendingProgramContinuation.programId,
          pendingProgramContinuation.plannedEndDate, Date.now());
      }
      archiveActiveTrainingBlock(d);
      d.executeSync(
        'INSERT INTO training_block (start_date, objective, created_at_ms) VALUES (?, ?, ?)',
        [plan.start_date, plan.objective, Date.now()],
      );
      const blockId = rowsOf<{ id: number }>(
        d.executeSync('SELECT last_insert_rowid() AS id'),
      )[0]!.id;
      if (programId !== null) {
        linkTrainingBlockProgram(d, blockId, programId, pendingProgramContinuation?.sequenceIndex ?? 1);
      }
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
          const movement = movements.find((m) => m.movement_id === sl.movement_id);
          const target = targetForMovement(movement, sl.reps);
          // Time policies own their default set count. The generated plan may
          // still be reduced later by readiness, but never grown past policy.
          const plannedSets = defaultSetsForTarget(movement, sl.sets);
          const legacyReps = target.kind === 'reps' ? target.reps : sl.reps;
          d.executeSync(
            'INSERT INTO planned_slot (planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (?, ?, ?, ?, ?, ?)',
            [sessionId, sl.slot_index, sl.movement_id, plannedSets, legacyReps, sl.target_rpe],
          );
          const plannedSlotId = rowsOf<{ id: number }>(d.executeSync('SELECT last_insert_rowid() AS id'))[0]!.id;
          if (sl.autopilotDelta !== undefined) {
            d.executeSync(
              'INSERT INTO planned_slot_autopilot (planned_slot_id, rpe_delta, set_delta, reason) VALUES (?, ?, ?, ?)',
              [plannedSlotId, sl.autopilotDelta.rpe_delta, sl.autopilotDelta.set_delta, sl.autopilotDelta.reason],
            );
          }
          d.executeSync(
            `INSERT INTO planned_slot_target (planned_slot_id, target_kind, target_reps, target_seconds)
             VALUES (?, ?, ?, ?)`,
            [
              plannedSlotId,
              target.kind,
              target.kind === 'reps' ? target.reps : null,
              target.kind === 'time' ? target.seconds : null,
            ],
          );
        }
      }
      d.executeSync('COMMIT');
    } catch (e) {
      d.executeSync('ROLLBACK');
      set({ error: e instanceof Error ? e.message : String(e) });
      return;
    }
    if (pendingFrequency !== undefined) set({ profile });
    get().refreshBlock();
    get().refreshProgram();
  },

  refreshBlock: () => {
    const d = getDb();
    const today = localToday();
    const hasArchivedBlock = Number(rowsOf<{ count: number }>(d.executeSync(
      "SELECT count(block_id) AS count FROM training_block WHERE status = 'archived'",
    ))[0]?.count ?? 0) > 0;
    const blockRow = rowsOf<{
      block_id: number; start_date: string; objective: string; created_at_ms: number;
    }>(d.executeSync(
      "SELECT block_id, start_date, objective, created_at_ms FROM training_block WHERE status = 'active' ORDER BY block_id DESC LIMIT 1",
    ))[0];
    if (blockRow === undefined) {
      set({ block: null, blockMeta: null, blockSessions: [], todayPlan: null, hasArchivedBlock });
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
      completion_status: string | null;
    }>(d.executeSync(
      `SELECT ps.planned_session_id, ps.week_index, ps.day_index, ps.focus, ps.phase,
              ps.session_date, count(sl.planned_slot_id) AS slot_count,
              CASE
                WHEN EXISTS (
                  SELECT 1 FROM session_origin so
                  JOIN session_outcome outcome ON outcome.session_id = so.session_id
                  WHERE so.source_planned_session_id = ps.planned_session_id
                    AND outcome.terminal_phase = 'complete'
                ) THEN 'complete'
                WHEN EXISTS (
                  SELECT 1 FROM session_origin so
                  JOIN session_outcome outcome ON outcome.session_id = so.session_id
                  WHERE so.source_planned_session_id = ps.planned_session_id
                    AND outcome.terminal_phase = 'halted'
                ) THEN 'halted'
                ELSE NULL
              END AS completion_status
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
      completionStatus:
        s.completion_status === 'complete' || s.completion_status === 'halted'
          ? s.completion_status
          : null,
    }));
    // Rest-day fallback: no planned session today is a normal, renderable
    // state (todayPlan null) — never an error.
    const todayRow = blockSessions.find((s) => s.sessionDate === today);
    const routineStressRow = todayRow === undefined ? undefined : rowsOf<{
      routine_day_index: number; family_decisions_json: string; warnings_json: string;
      recommendations_json: string; adaptations_json: string;
    }>(d.executeSync(
      `SELECT routine_day_index, family_decisions_json, warnings_json,
              recommendations_json, adaptations_json
         FROM planned_session_routine_context WHERE planned_session_id = ?`,
      [todayRow.plannedSessionId],
    ))[0];
    const todayPlan: TodayPlan | null = todayRow === undefined
      ? null
      : {
          plannedSessionId: todayRow.plannedSessionId,
          focus: todayRow.focus,
          phase: todayRow.phase,
          slots: get().loadSessionSlots(todayRow.plannedSessionId),
          routineStress: routineStressRow === undefined ? null : {
            routineDayIndex: routineStressRow.routine_day_index,
            familyDecisions: parseRoutineFamilyDecisions(routineStressRow.family_decisions_json),
            warnings: parseStringArray(routineStressRow.warnings_json),
            recommendations: parseStringArray(routineStressRow.recommendations_json),
            adaptations: parseStringArray(routineStressRow.adaptations_json),
          },
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

  refreshProgram: () => {
    const d = getDb();
    const row = rowsOf<{
      program_id: number; objective: string; start_date: string; horizon_kind: 'weeks' | 'date';
      requested_review_date: string | null; planned_end_date: string; planned_block_count: number;
      starting_macro_block_index: number; schema_type: SchemaType;
      status: 'active' | 'review_due' | 'archived'; current_sequence_index: number;
    }>(d.executeSync(
      `SELECT tp.*, COALESCE(MAX(tbp.sequence_index), 0) AS current_sequence_index
         FROM training_program tp
         LEFT JOIN training_block_program tbp ON tbp.program_id = tp.program_id
        WHERE tp.status IN ('active','review_due')
        GROUP BY tp.program_id
        ORDER BY tp.program_id DESC LIMIT 1`,
    ))[0];
    if (row === undefined) {
      set({ program: null });
      return;
    }
    const days = rowsOf<{ day_index: number; focus: string }>(d.executeSync(
      'SELECT day_index, focus FROM training_program_day WHERE program_id = ? ORDER BY day_index',
      [row.program_id],
    )).map((day) => ({ dayIndex: day.day_index, focus: day.focus }));
    const movementPreferences = rowsOf<{
      day_index: number; slot_index: number; pattern: MovementPattern; movement_id: number;
    }>(d.executeSync(
      `SELECT day_index, slot_index, pattern, movement_id
         FROM training_program_movement_preference
        WHERE program_id = ? ORDER BY day_index, slot_index`,
      [row.program_id],
    )).map((preference) => ({
      dayIndex: preference.day_index, slotIndex: preference.slot_index,
      pattern: preference.pattern, movementId: preference.movement_id,
    }));
    set({ program: {
      programId: row.program_id, objective: row.objective as UserProfile['objective'], startDate: row.start_date,
      horizonKind: row.horizon_kind, requestedReviewDate: row.requested_review_date,
      plannedEndDate: row.planned_end_date, plannedBlockCount: row.planned_block_count,
      startingMacroBlockIndex: row.starting_macro_block_index, schemaType: row.schema_type,
      status: row.status, currentSequenceIndex: row.current_sequence_index, days, movementPreferences,
    } });
  },

  updateProgramPreferences: (input) => {
    const current = get().program;
    if (get().session !== null) {
      set({ error: 'End the active session before managing the program.' });
      return false;
    }
    if (current === null || current.status !== 'active') {
      set({ error: 'No active program to manage.' });
      return false;
    }
    try {
      const preview = get().previewTrainingProgram(input);
      if (preview.plannedBlockCount < current.currentSequenceIndex) {
        throw new Error('The horizon cannot remove a block already started.');
      }
      const d = getDb();
      const now = Date.now();
      d.executeSync('BEGIN');
      try {
        d.executeSync(
          `UPDATE training_program SET horizon_kind = ?, requested_review_date = ?, planned_end_date = ?,
             planned_block_count = ?, schema_type = ?, updated_at_ms = ?
           WHERE program_id = ? AND status = 'active'`,
          [input.horizon.kind, preview.requestedReviewDate, preview.plannedEndDate,
            preview.plannedBlockCount, input.schemaType, now, current.programId],
        );
        d.executeSync('DELETE FROM training_program_movement_preference WHERE program_id = ?', [current.programId]);
        d.executeSync('DELETE FROM training_program_day WHERE program_id = ?', [current.programId]);
        for (const day of preview.days) {
          d.executeSync('INSERT INTO training_program_day (program_id, day_index, focus) VALUES (?, ?, ?)',
            [current.programId, day.dayIndex, day.focus]);
        }
        for (const preference of input.movementPreferences ?? []) {
          d.executeSync(
            `INSERT INTO training_program_movement_preference
               (program_id, day_index, slot_index, pattern, movement_id) VALUES (?, ?, ?, ?, ?)`,
            [current.programId, preference.dayIndex, preference.slotIndex, preference.pattern, preference.movementId],
          );
        }
        d.executeSync('UPDATE athlete_profile SET weekly_frequency = ?, updated_at_ms = ? WHERE profile_id = 1',
          [preview.days.length, now]);
        d.executeSync('COMMIT');
      } catch (e) {
        d.executeSync('ROLLBACK');
        throw e;
      }
      set({ profile: { ...get().profile, weekly_frequency: preview.days.length }, error: null });
      get().refreshProgram();
      return true;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
      return false;
    }
  },

  previewNextProgramBlock: () => {
    const current = get().program;
    const block = get().block;
    if (current === null || block === null || current.status !== 'active'
        || localToday() <= addDaysIso(block.startDate, 27)
        || current.currentSequenceIndex >= current.plannedBlockCount) return null;
    const input: TrainingProgramInput = {
      horizon: { kind: 'weeks', blockCount: current.plannedBlockCount },
      schemaType: current.schemaType, dayIndices: current.days.map((day) => day.dayIndex),
      movementPreferences: current.movementPreferences,
    };
    return get().previewTrainingProgram(input).plan;
  },

  continueTrainingProgram: () => {
    const current = get().program;
    const block = get().block;
    if (get().session !== null) {
      set({ error: 'End the active session before continuing the program.' });
      return;
    }
    if (current === null || block === null || current.status !== 'active'
        || localToday() <= addDaysIso(block.startDate, 27)) {
      set({ error: 'The current block is not ready to continue.' });
      return;
    }
    const d = getDb();
    if (current.currentSequenceIndex >= current.plannedBlockCount) {
      d.executeSync('BEGIN');
      try {
        d.executeSync("UPDATE training_block SET status = 'archived' WHERE block_id = ?", [block.blockId]);
        d.executeSync("UPDATE training_program SET status = 'review_due', updated_at_ms = ? WHERE program_id = ?",
          [Date.now(), current.programId]);
        d.executeSync('COMMIT');
      } catch (e) {
        d.executeSync('ROLLBACK');
        set({ error: e instanceof Error ? e.message : String(e) });
        return;
      }
      get().refreshBlock();
      get().refreshProgram();
      return;
    }
    const programDays: ProgramDayPreference[] = current.days.map((day) => ({
      day_index: day.dayIndex, focus: day.focus as ProgramDayPreference['focus'],
      movement_preferences: current.movementPreferences.filter((p) => p.dayIndex === day.dayIndex).map((p) => ({
        slot_index: p.slotIndex, pattern: p.pattern, movement_id: p.movementId,
      })),
    }));
    const nextSequence = current.currentSequenceIndex + 1;
    const remainingBlocks = current.plannedBlockCount - current.currentSequenceIndex;
    pendingProgramContinuation = {
      programId: current.programId, sequenceIndex: nextSequence,
      startingMacroBlockIndex: current.startingMacroBlockIndex,
      plannedEndDate: addDaysIso(localToday(), remainingBlocks * 28),
      objective: current.objective,
      programDays, weeklyFrequency: current.days.length,
    };
    try {
      set({ error: null });
      get().generateNewBlock(current.schemaType);
    } finally {
      pendingProgramContinuation = null;
    }
  },

  archiveTrainingProgram: () => {
    const current = get().program;
    if (current === null) return;
    if (get().session !== null) {
      set({ error: 'End the active session before archiving the program.' });
      return;
    }
    const d = getDb();
    d.executeSync('BEGIN');
    try {
      d.executeSync("UPDATE training_program SET status = 'archived', updated_at_ms = ? WHERE program_id = ?",
        [Date.now(), current.programId]);
      d.executeSync(
        `UPDATE training_block SET status = 'archived' WHERE block_id IN
          (SELECT block_id FROM training_block_program WHERE program_id = ?) AND status = 'active'`,
        [current.programId],
      );
      d.executeSync('COMMIT');
    } catch (e) {
      d.executeSync('ROLLBACK');
      set({ error: e instanceof Error ? e.message : String(e) });
      return;
    }
    get().refreshBlock();
    get().refreshProgram();
  },

  getMovementAvailabilityVerdicts: (context) => {
    const d = getDb();
    const { movements, profile, niggles, activePriorExperienceMovementIds } = get();
    return capabilityMovementAvailability(
      d,
      movements,
      profile,
      context,
      new Set(activePriorExperienceMovementIds),
      safetyExcludedMovementIdsFor(movements, profile, niggles),
    );
  },

  getRoutineRoleEligibleMovementIds: () => {
    const eligible = routineRoleEligibility(getDb());
    return {
      major: [...eligible.major],
      supplementary: [...eligible.supplementary],
      accessory: [...eligible.accessory],
      conditional: [...eligible.conditional],
    };
  },
  getRoutinePlanningContract: () => routinePlanningContract(getDb()),
  loadRoutineTemplates: () => {
    const d = getDb();
    const templates = rowsOf<{
      routine_template_id: number; name: string; schema_type: string;
      created_at_ms: number; updated_at_ms: number;
    }>(d.executeSync('SELECT routine_template_id, name, schema_type, created_at_ms, updated_at_ms FROM routine_template ORDER BY routine_template_id DESC'));

    const result: RoutineTemplate[] = [];
    for (const t of templates) {
      const slots = rowsOf<{
        routine_template_slot_id: number; routine_template_id: number; day_index: number;
        slot_index: number; role: RoutineRole; movement_id: number; movement_name: string;
        sets: number; reps: number; target_rpe: number;
      }>(d.executeSync(
        `SELECT rts.routine_template_slot_id, rts.routine_template_id, rts.day_index,
                rts.slot_index, rts.role, rts.movement_id, m.name AS movement_name,
                rts.sets, rts.reps, rts.target_rpe
         FROM routine_template_slot rts
         JOIN movement m ON m.movement_id = rts.movement_id
         WHERE rts.routine_template_id = ?
         ORDER BY rts.day_index, rts.slot_index`,
        [t.routine_template_id]
      ));
      result.push({
        routineTemplateId: t.routine_template_id,
        name: t.name,
        schemaType: t.schema_type as SchemaType,
        createdAtMs: t.created_at_ms,
        updatedAtMs: t.updated_at_ms,
        slots: slots.map((s) => ({
          routineTemplateSlotId: s.routine_template_slot_id,
          routineTemplateId: s.routine_template_id,
          dayIndex: s.day_index,
          slotIndex: s.slot_index,
          role: s.role,
          movementId: s.movement_id,
          movementName: s.movement_name,
          sets: s.sets,
          reps: s.reps,
          targetRpe: s.target_rpe,
        })),
      });
    }
    set({ routineTemplates: result });
  },

  saveRoutineTemplate: (input) => {
    const d = getDb();
    const { profile } = get();
    const name = input.name.trim();
    if (name.length < 1 || name.length > 80) {
      throw new Error('Routine template name must be between 1 and 80 characters.');
    }
    const validSchemas: SchemaType[] = ['LINEAR', 'WAVE', 'STEP', 'APRE'];
    if (!validSchemas.includes(input.schemaType)) {
      throw new Error(`Invalid schema type: ${input.schemaType}`);
    }
    if (input.slots.length < 1) throw new Error('A routine template must contain at least one movement.');

    if (profile.training_age === 'beginner') {
      throw new Error('Standalone routines unlock after the Beginner stage. Generated training remains available.');
    }
    const verdicts = get().getMovementAvailabilityVerdicts('weight_room');
    const availableSet = new Set(verdicts.filter((verdict) => verdict.state === 'available').map((verdict) => verdict.movementId));
    const roleEligibility = routineRoleEligibility(d);
    const planningContract = routinePlanningContract(d);
    const nextSlotByDay = new Map<number, number>();
    const placements = input.slots.map((item) => {
      const dayIndex = item.dayIndex ?? 1;
      const automaticSlot = (nextSlotByDay.get(dayIndex) ?? 0) + 1;
      nextSlotByDay.set(dayIndex, automaticSlot);
      return {
        dayIndex,
        slotIndex: item.slotIndex ?? automaticSlot,
        movementId: item.movementId,
        role: item.role,
      };
    });
    groupRoutineTemplateDays(placements);
    const { movements } = get();
    const analysis = composeRoutineMicrocycle({
      selections: input.slots.map((item, index) => ({
        ...placements[index], sets: item.sets, reps: item.reps, targetRpe: item.targetRpe,
      })),
      movements: movements.map((movement) => ({
        movementId: movement.movement_id,
        name: movement.name,
        pattern: movement.pattern,
        targetMuscles: movement.targetMuscles,
        isCompound: movement.is_compound,
      })),
      liftFamilies: planningContract.liftFamilies,
      assistance: planningContract.assistance,
      roleEligibility,
      schemaType: input.schemaType,
      objective: profile.objective,
      trainingAge: profile.training_age,
      durationCapMin: profile.session_duration_cap_min,
      baseRpeCap: profile.base_rpe_cap,
      availableMovementIds: availableSet,
    });
    if (analysis.blockers.length > 0) throw new Error(analysis.blockers[0]);

    const now = Date.now();
    let templateId = input.routineTemplateId;
    d.executeSync('BEGIN');
    try {
      if (templateId !== undefined) {
        const existing = rowsOf<{ routine_template_id: number }>(d.executeSync(
          'SELECT routine_template_id FROM routine_template WHERE routine_template_id = ?',
          [templateId],
        ))[0];
        if (existing === undefined) throw new Error(`Routine template ${templateId} not found.`);
        d.executeSync(
          'UPDATE routine_template SET name = ?, schema_type = ?, updated_at_ms = ? WHERE routine_template_id = ?',
          [name, input.schemaType, now, templateId],
        );
        d.executeSync('DELETE FROM routine_template_slot WHERE routine_template_id = ?', [templateId]);
      } else {
        d.executeSync(
          'INSERT INTO routine_template (name, schema_type, created_at_ms, updated_at_ms) VALUES (?, ?, ?, ?)',
          [name, input.schemaType, now, now],
        );
        templateId = rowsOf<{ id: number }>(d.executeSync('SELECT last_insert_rowid() AS id'))[0]!.id;
      }

      for (let index = 0; index < input.slots.length; index += 1) {
        const item = input.slots[index];
        const placement = placements[index];
        const prescribed = analysis.prescriptions.find((candidate) =>
          candidate.dayIndex === placement.dayIndex
          && candidate.sourceSlotIndex === placement.slotIndex)!;
        // A template stores the athlete-authored/defaulted request. Bounded
        // values belong to the frozen session sidecars so a later freeze can
        // still explain every support-first and major-dose adaptation.
        const sets = prescribed.authoredSets;
        const reps = prescribed.authoredReps;
        const targetRpe = prescribed.authoredTargetRpe;
        d.executeSync(
          `INSERT INTO routine_template_slot (routine_template_id, day_index, slot_index, role, movement_id, sets, reps, target_rpe)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [templateId, placement.dayIndex, placement.slotIndex, item.role, item.movementId, sets, reps, targetRpe],
        );
      }
      d.executeSync('COMMIT');
    } catch (error) {
      try { d.executeSync('ROLLBACK'); } catch { /* transaction already closed */ }
      throw error;
    }

    get().loadRoutineTemplates();
    const saved = get().routineTemplates.find((template) => template.routineTemplateId === templateId);
    if (saved === undefined) throw new Error('Routine template saved but could not be reloaded.');
    return saved;
  },

  deleteRoutineTemplate: (routineTemplateId) => {
    const d = getDb();
    // Slots cascade; any frozen planned_session_method row keeps its snapshot
    // via ON DELETE SET NULL. Wrapped for consistency with every other mutation
    // in this store -- an unguarded write is the one that surprises you later.
    d.executeSync('BEGIN');
    try {
      d.executeSync('DELETE FROM routine_template WHERE routine_template_id = ?', [routineTemplateId]);
      d.executeSync('COMMIT');
    } catch (error) {
      try { d.executeSync('ROLLBACK'); } catch { /* transaction already closed */ }
      throw error;
    }
    get().loadRoutineTemplates();
  },

  freezeRoutineTemplateToPlannedSession: (routineTemplateId, sessionDate, routineDayIndex = 1) => {
    if (get().session !== null) throw new Error('End the active session before replacing today\'s plan.');
    if (get().program?.status === 'active') {
      throw new Error('Standalone routines cannot replace a goal-program block. Manage the program instead.');
    }
    const d = getDb();
    const today = sessionDate ?? localToday();
    const template = get().routineTemplates.find((candidate) => candidate.routineTemplateId === routineTemplateId);
    if (template === undefined) throw new Error(`Routine template ${routineTemplateId} not found.`);

    const { profile, movements } = get();
    if (profile.training_age === 'beginner') {
      throw new Error('Standalone routines unlock after the Beginner stage. Generated training remains available.');
    }
    const verdicts = get().getMovementAvailabilityVerdicts('weight_room');
    const availableSet = new Set(verdicts.filter((verdict) => verdict.state === 'available').map((verdict) => verdict.movementId));
    const roleEligibility = routineRoleEligibility(d);
    // P2-2: freezing executes ONE routine day. Only that day's movements are
    // validated and composed — another day's drifted role or teaching-only
    // movement neither blocks nor licenses this session.
    const planningContract = routinePlanningContract(d);
    const daySlots = template.slots.filter((slot) => slot.dayIndex === routineDayIndex);
    if (daySlots.length === 0) throw new Error(`Routine template ${routineTemplateId} has no movements for day ${routineDayIndex}.`);
    const analysis = composeRoutineMicrocycle({
      selections: template.slots.map((slot) => ({
        dayIndex: slot.dayIndex,
        slotIndex: slot.slotIndex,
        movementId: slot.movementId,
        role: slot.role,
        sets: slot.sets,
        reps: slot.reps,
        targetRpe: slot.targetRpe,
      })),
      movements: movements.map((movement) => ({
        movementId: movement.movement_id,
        name: movement.name,
        pattern: movement.pattern,
        targetMuscles: movement.targetMuscles,
        isCompound: movement.is_compound,
      })),
      liftFamilies: planningContract.liftFamilies,
      assistance: planningContract.assistance,
      roleEligibility,
      schemaType: template.schemaType,
      objective: profile.objective,
      trainingAge: profile.training_age,
      durationCapMin: profile.session_duration_cap_min,
      baseRpeCap: profile.base_rpe_cap,
      availableMovementIds: availableSet,
      executionGateDayIndices: new Set([routineDayIndex]),
    });
    if (analysis.blockers.length > 0) throw new Error(analysis.blockers[0]);
    const composedDay = analysis.prescriptions
      .filter((slot) => slot.dayIndex === routineDayIndex && slot.included)
      .sort((a, b) => (a.executionSlotIndex ?? Number.MAX_SAFE_INTEGER)
        - (b.executionSlotIndex ?? Number.MAX_SAFE_INTEGER));
    if (composedDay.length === 0 || !composedDay.some((slot) => slot.role === 'major')) {
      throw new Error('The current constraints cannot produce a valid major prescription for this routine day.');
    }

    d.executeSync('BEGIN');
    let plannedSessionId = 0;
    let archivedPreviousBlock = false;
    try {
      let blockRow: { block_id: number; start_date: string } | undefined = rowsOf<{ block_id: number; start_date: string }>(d.executeSync(
        "SELECT block_id, start_date FROM training_block WHERE status = 'active' ORDER BY block_id DESC LIMIT 1",
      ))[0];
      let dayOffset = blockRow === undefined ? 0 : Number(rowsOf<{ day_offset: number }>(d.executeSync(
        'SELECT CAST(julianday(?) - julianday(?) AS INTEGER) AS day_offset',
        [today, blockRow.start_date],
      ))[0]?.day_offset ?? Number.NaN);

      if (blockRow !== undefined && (!Number.isInteger(dayOffset) || dayOffset < 0 || dayOffset > 27)) {
        if (dayOffset > 27) {
          archivedPreviousBlock = true;
        }
        d.executeSync("UPDATE training_block SET status = 'archived' WHERE block_id = ?", [blockRow.block_id]);
        blockRow = undefined;
        dayOffset = 0;
      }
      if (blockRow === undefined) {
        d.executeSync("UPDATE training_block SET status = 'archived' WHERE status = 'active'");
        d.executeSync(
          'INSERT INTO training_block (start_date, objective, created_at_ms) VALUES (?, ?, ?)',
          [today, profile.objective, Date.now()],
        );
        const blockId = rowsOf<{ id: number }>(d.executeSync('SELECT last_insert_rowid() AS id'))[0]!.id;
        // Continue the macrocycle. Freezing a template is not a reason to lose
        // the athlete's periodization position.
        const macro = nextMacroPosition(d);
        d.executeSync(
          'INSERT INTO block_meta (block_id, macro_block_index, macro_phase, schema_type, peak_shifted) VALUES (?, ?, ?, ?, ?)',
          [blockId, macro.macroBlockIndex, macro.macroPhase, template.schemaType, 0],
        );
        blockRow = { block_id: blockId, start_date: today };
      }

      const weekIndex = Math.floor(dayOffset / 7) + 1;
      const plannedDayIndex = (dayOffset % 7) + 1;
      const existingSession = rowsOf<{ planned_session_id: number; session_date: string }>(d.executeSync(
        'SELECT planned_session_id, session_date FROM planned_session WHERE block_id = ? AND week_index = ? AND day_index = ?',
        [blockRow.block_id, weekIndex, plannedDayIndex],
      ))[0];

      if (existingSession !== undefined) {
        plannedSessionId = existingSession.planned_session_id;
        const alreadyUsed = Number(rowsOf<{ c: number }>(d.executeSync(
          `SELECT (SELECT COUNT(*) FROM session_origin WHERE source_planned_session_id = ?)
                + (SELECT COUNT(*) FROM planned_slot_disposition pd JOIN planned_slot ps USING (planned_slot_id)
                   WHERE ps.planned_session_id = ?) AS c`,
          [plannedSessionId, plannedSessionId],
        ))[0]?.c ?? 0);
        if (alreadyUsed > 0) throw new Error('Today\'s planned session has already been used and cannot be replaced.');
        d.executeSync(
          "UPDATE planned_session SET focus = 'full', phase = ?, session_date = ? WHERE planned_session_id = ?",
          [weekIndex === 4 ? 'deload' : 'accumulation', today, plannedSessionId],
        );
        d.executeSync('DELETE FROM planned_slot WHERE planned_session_id = ?', [plannedSessionId]);
      } else {
        d.executeSync(
          'INSERT INTO planned_session (block_id, week_index, day_index, focus, phase, session_date) VALUES (?, ?, ?, ?, ?, ?)',
          [blockRow.block_id, weekIndex, plannedDayIndex, 'full', weekIndex === 4 ? 'deload' : 'accumulation', today],
        );
        plannedSessionId = rowsOf<{ id: number }>(d.executeSync('SELECT last_insert_rowid() AS id'))[0]!.id;
      }

      d.executeSync(
        `INSERT INTO planned_session_method (planned_session_id, schema_type, routine_template_id, template_name, frozen_at_ms)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(planned_session_id) DO UPDATE SET
           schema_type = excluded.schema_type,
           routine_template_id = excluded.routine_template_id,
           template_name = excluded.template_name,
           frozen_at_ms = excluded.frozen_at_ms`,
        [plannedSessionId, template.schemaType, template.routineTemplateId, template.name, Date.now()],
      );

      d.executeSync(
        `INSERT INTO planned_session_routine_context
           (planned_session_id, routine_day_index, family_decisions_json, warnings_json,
            recommendations_json, adaptations_json)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(planned_session_id) DO UPDATE SET
           routine_day_index = excluded.routine_day_index,
           family_decisions_json = excluded.family_decisions_json,
           warnings_json = excluded.warnings_json,
           recommendations_json = excluded.recommendations_json,
           adaptations_json = excluded.adaptations_json`,
        [
          plannedSessionId,
          routineDayIndex,
          JSON.stringify(analysis.familyDecisions),
          JSON.stringify(analysis.warnings),
          JSON.stringify(analysis.recommendations),
          JSON.stringify(analysis.adaptations),
        ],
      );

      for (const composedSlot of composedDay) {
        const movement = movements.find((candidate) => candidate.movement_id === composedSlot.movementId);
        const target = targetForMovement(movement, composedSlot.reps);
        const plannedSets = defaultSetsForTarget(movement, composedSlot.sets);
        const legacyReps = target.kind === 'reps' ? Math.min(30, target.reps) : Math.min(30, composedSlot.reps);
        // A major slot persists its peak target for backward compatibility;
        // freezing resolves the selected loading method to this block week's
        // actual target. Supplementary/conditional work retains its authored
        // constant target.
        const frozenTargetRpe = composedSlot.role === 'major'
          ? routineMajorRpeForWeek(composedSlot.targetRpe, template.schemaType, weekIndex, profile.base_rpe_cap)
          : Math.min(composedSlot.targetRpe, profile.base_rpe_cap);
        d.executeSync(
          'INSERT INTO planned_slot (planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (?, ?, ?, ?, ?, ?)',
          [plannedSessionId, composedSlot.executionSlotIndex, composedSlot.movementId, plannedSets, legacyReps, frozenTargetRpe],
        );
        const plannedSlotId = rowsOf<{ id: number }>(d.executeSync('SELECT last_insert_rowid() AS id'))[0]!.id;
        d.executeSync(
          'INSERT INTO planned_slot_target (planned_slot_id, target_kind, target_reps, target_seconds) VALUES (?, ?, ?, ?)',
          [plannedSlotId, target.kind, target.kind === 'reps' ? target.reps : null, target.kind === 'time' ? target.seconds : null],
        );
        d.executeSync(
          `INSERT INTO planned_slot_routine_decision
             (planned_slot_id, role, lift_family, stress_purpose, stress_coefficient,
              equivalent_volume, stress_dose, adaptations_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            plannedSlotId,
            composedSlot.role,
            composedSlot.family,
            composedSlot.purpose,
            composedSlot.stressCoefficient,
            composedSlot.equivalentVolume,
            composedSlot.stressDose,
            JSON.stringify(composedSlot.adaptations),
          ],
        );
      }

      d.executeSync('COMMIT');
    } catch (error) {
      try { d.executeSync('ROLLBACK'); } catch { /* transaction already closed */ }
      throw error;
    }

    get().refreshBlock();
    return { plannedSessionId, archivedPreviousBlock };
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

  importHistory: (text, verified, readinessEligible) => {
    const movements = get().movements;
    const preview = parseHistoryImport(
      text,
      movements.map((movement) => ({ movementId: movement.movement_id, name: movement.name })),
    );
    if (preview.formatVersion === null || preview.errors.length > 0 || preview.unknownMovementNames.length > 0) {
      return { committed: false, duplicate: false, preview };
    }
    const d = getDb();
    const fingerprint = historyContentFingerprint(text);
    const duplicate = (rowsOf<{ c: number }>(d.executeSync(
      'SELECT COUNT(*) AS c FROM history_import WHERE content_fingerprint = ?', [fingerprint],
    ))[0]?.c ?? 0) > 0;
    if (duplicate) return { committed: false, duplicate: true, preview };
    d.executeSync('BEGIN');
    try {
      d.executeSync(
        `INSERT INTO history_import
           (content_fingerprint, format_version, verified, readiness_eligible, created_at_ms)
         VALUES (?, 'AK_HISTORY_V1', ?, ?, ?)`,
        [fingerprint, verified ? 1 : 0, verified && readinessEligible ? 1 : 0, Date.now()],
      );
      const importId = rowsOf<{ id: number }>(d.executeSync('SELECT last_insert_rowid() AS id'))[0]!.id;
      for (const session of preview.sessions) {
        d.executeSync(
          `INSERT INTO history_import_session
             (history_import_id, source_ordinal, session_date, duration_min, session_rpe, source_line)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [importId, session.sourceOrdinal, session.sessionDate, session.durationMin, session.sessionRpe, session.sourceLine],
        );
        const importSessionId = rowsOf<{ id: number }>(d.executeSync('SELECT last_insert_rowid() AS id'))[0]!.id;
        const byMovement = new Map<number, { sets: number; minimum: number; maxRpe: number | null }>();
        for (const historySet of session.sets) {
          d.executeSync(
            `INSERT INTO history_import_set
               (history_import_session_id, movement_id, set_index, reps, load_kg, rpe, seconds, source_line)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [importSessionId, historySet.movementId, historySet.setIndex, historySet.reps,
             historySet.loadKg, historySet.rpe, historySet.seconds, historySet.sourceLine],
          );
          const value = historySet.seconds ?? historySet.reps;
          const current = byMovement.get(historySet.movementId);
          byMovement.set(historySet.movementId, current === undefined
            ? { sets: 1, minimum: value, maxRpe: historySet.rpe }
            : {
                sets: current.sets + 1,
                minimum: Math.min(current.minimum, value),
                maxRpe: historySet.rpe === null ? current.maxRpe
                  : current.maxRpe === null ? historySet.rpe : Math.max(current.maxRpe, historySet.rpe),
              });
        }
        for (const [movementId, evidence] of byMovement) {
          d.executeSync(
            `INSERT INTO history_import_capability_evidence
               (history_import_session_id, movement_id, qualifying_sets, minimum_value, maximum_rpe)
             VALUES (?, ?, ?, ?, ?)`,
            [importSessionId, movementId, evidence.sets, evidence.minimum, evidence.maxRpe],
          );
        }
        if (verified && readinessEligible) {
          const tonnageKg = session.sets.reduce((sum, historySet) => sum + historySet.reps * historySet.loadKg, 0);
          d.executeSync(
            `INSERT INTO import_readiness_daily (date, tonnage_kg, updated_at_ms)
             VALUES (?, ?, ?)
             ON CONFLICT(date) DO UPDATE SET tonnage_kg = import_readiness_daily.tonnage_kg + excluded.tonnage_kg,
               updated_at_ms = excluded.updated_at_ms`,
            [session.sessionDate, tonnageKg, Date.now()],
          );
        }
      }
      d.executeSync('COMMIT');
      set((state) => ({ movementAvailabilityRevision: state.movementAvailabilityRevision + 1 }));
      if (verified && readinessEligible) {
        for (const date of demoDates(localToday(), 29)) d.executeSync(MATERIALIZE_STATE_VECTOR_SQL, [date]);
        get().refreshVector();
        get().computePrescription([]);
      }
      return { committed: true, duplicate: false, preview };
    } catch (error) {
      try { d.executeSync('ROLLBACK'); } catch { /* full import remains atomic */ }
      set({ error: error instanceof Error ? error.message : String(error) });
      return { committed: false, duplicate: false, preview };
    }
  },

  saveBodyweight: (date, kg) => {
    const d = getDb();
    if (kg === null) {
      d.executeSync('DELETE FROM bodyweight_daily WHERE date = ?', [date]);
      return;
    }
    const safe = Math.round(clamp(kg, 20, 500) * 10) / 10;
    d.executeSync(
      `INSERT INTO bodyweight_daily (date, weight_kg, source, recorded_at_ms)
       VALUES (?, ?, 'manual', ?)
       ON CONFLICT(date) DO UPDATE SET weight_kg = excluded.weight_kg,
         source = 'manual', recorded_at_ms = excluded.recorded_at_ms`,
      [date, safe, Date.now()],
    );
  },

  loadMeasuredHistory: (limit = 90) => rowsOf<{
    date: string; tonnage_kg: number | null; set_count: number | null;
    weight_kg: number | null; rmssd_ms: number | null; resting_hr: number | null;
    asleep_min: number | null;
  }>(getDb().executeSync(
    `WITH dates(date) AS (
       SELECT date FROM v_training_daily_all UNION SELECT date FROM bodyweight_daily
       UNION SELECT date FROM hrv_daily UNION SELECT date FROM sleep_daily
     )
     SELECT dates.date, td.tonnage_kg, td.set_count, bw.weight_kg,
            h.rmssd_ms, h.resting_hr, sl.asleep_min
     FROM dates
     LEFT JOIN v_training_daily_all td USING (date)
     LEFT JOIN bodyweight_daily bw USING (date)
     LEFT JOIN hrv_daily h USING (date)
     LEFT JOIN sleep_daily sl USING (date)
     ORDER BY dates.date DESC LIMIT ?`,
    [Math.round(clamp(limit, 1, 7300))],
  )).map((row) => ({
    date: row.date, tonnageKg: row.tonnage_kg ?? 0, setCount: row.set_count ?? 0,
    bodyweightKg: row.weight_kg, hrvRmssdMs: row.rmssd_ms,
    restingHr: row.resting_hr, sleepMinutes: row.asleep_min,
  })),
  loadCoachDiagnosticContext: () => {
    const today = get().today;
    const row = rowsOf<{ sessions_today: number; trained_days_last_7: number }>(getDb().executeSync(
      `SELECT
         (SELECT COUNT(DISTINCT s.session_id) FROM session s
          WHERE s.session_date = ?
            AND EXISTS (SELECT 1 FROM set_record sr WHERE sr.session_id = s.session_id)) AS sessions_today,
         (SELECT COUNT(DISTINCT s.session_date) FROM session s
          WHERE s.session_date >= ? AND s.session_date <= ?
            AND EXISTS (SELECT 1 FROM set_record sr WHERE sr.session_id = s.session_id)) AS trained_days_last_7`,
      [today, addDaysIso(today, -6), today],
    ))[0];
    return {
      sessionsToday: row?.sessions_today ?? 0,
      trainedDaysLast7: row?.trained_days_last_7 ?? 0,
    };
  },
  loadCoachMovementAccessContext: () => {
    const state = get();
    const facts = loadCapabilityFacts(getDb());
    return {
      edges: facts.edges,
      evidence: facts.evidence,
      attestedEdgeKeys: facts.attestedEdgeKeys,
      safetyExcludedMovementIds: [...safetyExcludedMovementIdsFor(
        state.movements,
        state.profile,
        state.niggles,
      )].sort((a, b) => a - b),
      priorExperienceMovementIds: facts.priorExperienceMovementIds,
    };
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
      target_kind: string | null; target_reps: number | null; target_seconds: number | null;
      override_load_kg: number | null; override_reason: string | null;
      autopilot_rpe_delta: number | null; autopilot_set_delta: number | null; autopilot_reason: AutopilotAttributionReason | null;
      routine_role: RoutineRole | null; lift_family: string | null;
      stress_purpose: RoutineStressPurpose | null; stress_coefficient: number | null;
      equivalent_volume: number | null; stress_dose: number | null;
      routine_adaptations_json: string | null;
    }>(getDb().executeSync(
      `SELECT sl.slot_index, sl.planned_slot_id, sl.movement_id, m.name AS movement_name,
              sl.sets, sl.reps, sl.target_rpe,
              st.target_kind, st.target_reps, st.target_seconds,
              pa.rpe_delta AS autopilot_rpe_delta, pa.set_delta AS autopilot_set_delta, pa.reason AS autopilot_reason,
              so.target_load_kg AS override_load_kg, so.reason AS override_reason,
              rd.role AS routine_role, rd.lift_family, rd.stress_purpose,
              rd.stress_coefficient, rd.equivalent_volume, rd.stress_dose,
              rd.adaptations_json AS routine_adaptations_json
       FROM planned_slot sl
       JOIN movement m ON m.movement_id = sl.movement_id
       LEFT JOIN planned_slot_target st ON st.planned_slot_id = sl.planned_slot_id
       LEFT JOIN planned_slot_autopilot pa ON pa.planned_slot_id = sl.planned_slot_id
       LEFT JOIN slot_override so ON so.planned_slot_id = sl.planned_slot_id
       LEFT JOIN planned_slot_routine_decision rd ON rd.planned_slot_id = sl.planned_slot_id
       WHERE sl.planned_session_id = ?
         AND sl.planned_slot_id NOT IN (SELECT planned_slot_id FROM planned_slot_disposition WHERE disposition = 'swapped')
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
      target: targetFromFields(sl.target_kind, sl.target_reps, sl.target_seconds, sl.reps),
      targetRpe: sl.target_rpe,
      overrideLoadKg: sl.override_load_kg,
      overrideReason: sl.override_reason,
      autopilot: sl.autopilot_reason === null ? undefined : {
        rpeDelta: sl.autopilot_rpe_delta ?? 0,
        setDelta: sl.autopilot_set_delta ?? 0,
        reason: sl.autopilot_reason,
      },
      routineDecision: sl.routine_role === null ? undefined : {
        role: sl.routine_role,
        family: sl.lift_family,
        purpose: sl.stress_purpose,
        stressCoefficient: sl.stress_coefficient ?? 0,
        equivalentVolume: sl.equivalent_volume ?? 0,
        stressDose: sl.stress_dose ?? 0,
        adaptations: parseStringArray(sl.routine_adaptations_json),
      },
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

  startSession: (repeatPlanned) => {
    // Audit A2: double-start would orphan the first session's rows.
    if (get().session !== null) return;
    get().rolloverDay();
    const triageNow = get().lastTriage;
    if (triageNow !== null && triageNow.kind === 'matched' && triageNow.directive.halt) return;
    const today = localToday();
    const startedAtMs = Date.now();
    const d = getDb();

    const { prescription, todayPlan, movements, profile, uiPreferences } = get();
    const alreadyPlannedToday = todayPlan !== null ? rowsOf<{ c: number }>(d.executeSync(
      `SELECT COUNT(*) AS c FROM session_origin
       WHERE source_planned_session_id = ?`,
      [todayPlan.plannedSessionId]
    ))[0]?.c ?? 0 : 0;
    const consumePlan = todayPlan !== null && (alreadyPlannedToday === 0 || repeatPlanned === true);
    const planToConsume = consumePlan ? todayPlan : null;
    const executionContext: ExecutableMovementAccessContext = planToConsume === null
      ? 'weight_room'
      : accessContextForBlockFocus(planToConsume.focus as BlockFocus);
    const capabilityAvailable = capabilityAvailableMovementIds(
      d,
      movements,
      profile,
      executionContext,
      new Set(get().activePriorExperienceMovementIds),
      safetyExcludedMovementIdsFor(movements, profile, get().niggles),
    );
    if (planToConsume !== null && planToConsume.slots.some((slot) =>
      !permittedForProfile(
        movements.find((movement) => movement.movement_id === slot.movementId),
        profile,
        executionContext,
      ) || !capabilityAvailable.has(slot.movementId)
    )) {
      set({ error: 'This plan contains a movement outside the current access boundary. Regenerate or edit it before starting.' });
      return;
    }
    if (planToConsume !== null) {
      const routineProvenance = rowsOf<{
        routine_template_id: number | null; routine_day_index: number | null;
      }>(d.executeSync(
        `SELECT psm.routine_template_id, prc.routine_day_index
           FROM planned_session_method psm
           LEFT JOIN planned_session_routine_context prc
             ON prc.planned_session_id = psm.planned_session_id
          WHERE psm.planned_session_id = ?`,
        [planToConsume.plannedSessionId],
      ))[0];
      // The snapshot survives template deletion, so row existence is the
      // durable routine provenance—not a still-live routine_template_id.
      if (routineProvenance !== undefined && profile.training_age === 'beginner') {
        set({ error: 'Standalone routines unlock after the Beginner stage. Generated training remains available.' });
        return;
      }
      if (routineProvenance !== undefined) {
        if (routineProvenance.routine_day_index === null && routineProvenance.routine_template_id === null) {
          set({ error: 'This routine\'s source template no longer exists, so its role eligibility cannot be verified. Rebuild it before starting.' });
          return;
        }
        if (routineProvenance.routine_day_index !== null
            && (planToConsume.routineStress === null
              || planToConsume.routineStress.familyDecisions.length === 0)) {
          set({ error: 'This routine\'s frozen stress review is missing or invalid. Edit and refreeze it before starting.' });
          return;
        }
        const frozenTemplateRoles = routineProvenance.routine_day_index !== null
          ? rowsOf<{ movement_id: number; role: RoutineRole }>(d.executeSync(
              `SELECT ps.movement_id, rd.role
                 FROM planned_slot ps
                 JOIN planned_slot_routine_decision rd USING (planned_slot_id)
                WHERE ps.planned_session_id = ? ORDER BY ps.slot_index`,
              [planToConsume.plannedSessionId],
            ))
          : routineProvenance.routine_template_id === null
            ? []
            : rowsOf<{ movement_id: number; role: RoutineRole }>(d.executeSync(
                `SELECT movement_id, role FROM routine_template_slot
                 WHERE routine_template_id = ? ORDER BY day_index, slot_index`,
                [routineProvenance.routine_template_id],
              ));
        const currentRoleEligibility = routineRoleEligibility(d);
        if (!isRoutineRoleSnapshotExecutable(
          planToConsume.slots.map((slot) => slot.movementId),
          frozenTemplateRoles.map((row) => ({ movementId: row.movement_id, role: row.role })),
          currentRoleEligibility,
        )) {
          set({ error: 'This routine no longer satisfies its current movement-role policy. Edit and refreeze it before starting.' });
          return;
        }
        const planningContract = routinePlanningContract(d);
        const plannedMovementIds = new Set(planToConsume.slots.map((slot) => slot.movementId));
        const frozenPlanRoles = frozenTemplateRoles.filter((row) => plannedMovementIds.has(row.movement_id));
        const majorMovementIds = frozenPlanRoles
          .filter((row) => row.role === 'major')
          .map((row) => row.movement_id);
        if (frozenPlanRoles.some((row) => !contextualRoutineRoles(
          row.movement_id,
          majorMovementIds,
          planningContract.liftFamilies,
          planningContract.assistance,
          currentRoleEligibility,
        ).has(row.role))) {
          set({ error: 'This routine no longer satisfies its current lift-family role contract. Edit and refreeze it before starting.' });
          return;
        }
      }
    }
    const originKind = consumePlan ? 'planned' : 'free_form';

    const setDelta = prescription !== null && prescription.forDate === today
      ? prescription.vector.set_modifier
      : 0;

    let sessionPlan: PlanSlot[];
    if (consumePlan) {
      const rpeSafetyCap = prescription?.vector.rpe_cap ?? 10.0;
      sessionPlan = planToConsume!.slots.map((sl) => {
        const effectiveRpe = Math.min(sl.targetRpe, rpeSafetyCap);
        const movement = movements.find((m) => m.movement_id === sl.movementId);
        const adjustedSets = Math.round(clamp(sl.sets + setDelta, 1, 6));
        // Timed policies and complete-microcycle routine analysis both own a
        // hard upper dose. Readiness may ease either prescription, but a good
        // day cannot silently grow it past the frozen bound.
        const plannedSets = sl.target.kind === 'time' || sl.routineDecision !== undefined
          ? Math.min(sl.sets, adjustedSets)
          : adjustedSets;
        return {
          sessionPlanSlotId: 0,
          movementId: sl.movementId,
          plannedSets,
          plannedReps: sl.target.kind === 'reps' ? sl.target.reps : null,
          target: sl.target,
          provenanceKind: 'planned' as const,
          targetRpe: effectiveRpe,
          sourcePlannedSlotId: sl.plannedSlotId,
          originalMovementId: null,
          originalSessionDate: today,
          overrideLoadKg: sl.overrideLoadKg,
          overrideReason: sl.overrideReason,
        };
      });
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
      sessionPlan = lastMovements.flatMap((m) => {
        const movement = movements.find((item) => item.movement_id === m.movement_id);
        // Repeating old history is still a prescription route. A beginner may
        // never inherit an Advanced movement from a prior athlete tier.
        if (!permittedForProfile(movement, profile, 'weight_room') || !capabilityAvailable.has(m.movement_id)) return [];
        const target = targetForMovement(movement, 5);
        return [{
          sessionPlanSlotId: 0,
          movementId: m.movement_id,
          plannedSets: defaultSetsForTarget(movement, plannedSets),
          plannedReps: target.kind === 'reps' ? target.reps : null,
          target,
          provenanceKind: 'free_form' as const,
          targetRpe: null,
          sourcePlannedSlotId: null,
          originalMovementId: null,
          originalSessionDate: null,
          overrideLoadKg: null,
          overrideReason: null,
        }];
      });
    }

    d.executeSync('BEGIN');
    try {
      d.executeSync(
        'INSERT INTO session (micro_cycle_id, session_date, started_at_ms) VALUES (NULL, ?, ?)',
        [today, startedAtMs],
      );
      const sessionId = rowsOf<{ id: number }>(
        d.executeSync('SELECT last_insert_rowid() AS id'),
      )[0]!.id;

      d.executeSync(
        'INSERT INTO session_origin (session_id, origin_kind, source_planned_session_id) VALUES (?, ?, ?)',
        [sessionId, originKind, planToConsume?.plannedSessionId ?? null],
      );

      const updatedSessionPlan: PlanSlot[] = [];
      for (let i = 0; i < sessionPlan.length; i++) {
        const sl = sessionPlan[i];
        d.executeSync(
          `INSERT INTO session_plan_slot (session_id, slot_index, movement_id, planned_sets, planned_reps, provenance_kind, target_rpe, source_planned_slot_id, original_movement_id, original_session_date, override_load_kg, override_reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [sessionId, i, sl.movementId, sl.plannedSets, sl.plannedReps, sl.provenanceKind, sl.targetRpe, sl.sourcePlannedSlotId, sl.originalMovementId, sl.originalSessionDate, sl.overrideLoadKg, sl.overrideReason],
        );
        const slotId = rowsOf<{ id: number }>(d.executeSync('SELECT last_insert_rowid() AS id'))[0]!.id;
        d.executeSync(
          `INSERT INTO session_slot_target (session_plan_slot_id, target_kind, target_reps, target_seconds)
           VALUES (?, ?, ?, ?)`,
          [
            slotId,
            sl.target.kind,
            sl.target.kind === 'reps' ? sl.target.reps : null,
            sl.target.kind === 'time' ? sl.target.seconds : null,
          ],
        );
        updatedSessionPlan.push({
          ...sl,
          sessionPlanSlotId: slotId,
        });
      }

      const sessionMode = modeForNewSession(uiPreferences, profile);
      const runner = startRunner(
        runnerSlotsForPlan(updatedSessionPlan, movements),
        { tier: profile.training_age, startedAtMs },
      );
      persistRunnerCheckpoint(d, sessionId, sessionMode, runner);
      for (const sl of updatedSessionPlan) {
        if (sl.provenanceKind === 'day_swapped' && sl.sourcePlannedSlotId !== null) {
          d.executeSync(
            `INSERT INTO planned_slot_disposition (planned_slot_id, disposition, session_id)
             VALUES (?, 'swapped', ?)
             ON CONFLICT(planned_slot_id) DO UPDATE SET disposition = excluded.disposition, session_id = excluded.session_id`,
            [sl.sourcePlannedSlotId, sessionId]
          );
        }
      }

      if (consumePlan) {
        for (const sl of planToConsume!.slots) {
          d.executeSync(
            `INSERT INTO planned_slot_disposition (planned_slot_id, disposition, session_id)
             VALUES (?, 'consumed', ?)
             ON CONFLICT(planned_slot_id) DO UPDATE SET disposition = excluded.disposition, session_id = excluded.session_id`,
            [sl.plannedSlotId, sessionId]
          );
        }
      }

      d.executeSync('COMMIT');

      set({
        session: { sessionId, date: today, startedAtMs, sets: [] },
        sessionPlan: updatedSessionPlan,
        sessionMode,
        activeSessionAccessContext: executionContext,
        ...runnerSelection(runner),
      });
    } catch (e) {
      try { d.executeSync('ROLLBACK'); } catch { /* fail silent */ }
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  selectMovement: (movementId) => {
    const { sessionPlan } = get();
    const slot = sessionPlan.find((s) => s.movementId === movementId);
    set({
      activeMovementId: movementId,
      activeSessionPlanSlotId: slot ? slot.sessionPlanSlotId : null,
    });
  },

  selectMovementSlot: (sessionPlanSlotId) => {
    const { sessionPlan, session, runner, sessionMode } = get();
    const slotIndex = sessionPlan.findIndex((slot) => slot.sessionPlanSlotId === sessionPlanSlotId);
    const slot = slotIndex >= 0 ? sessionPlan[slotIndex] : undefined;
    if (slot === undefined) return;
    if (runner === null || session === null || sessionMode === null) {
      set({ activeSessionPlanSlotId: sessionPlanSlotId, activeMovementId: slot.movementId });
      return;
    }
    const current = currentRunnerSlot(runner);
    if (runner.phase !== 'working') {
      set({ error: 'Finish or skip the current rest before changing exercises.' });
      return;
    }
    if (sessionMode === 'guided' && current?.sessionPlanSlotId !== sessionPlanSlotId) {
      set({ error: 'Guided mode keeps the next exercise in order.' });
      return;
    }
    const loggedForSlot = session.sets.filter((setRow) => setRow.session_plan_slot_id === sessionPlanSlotId).length;
    if (loggedForSlot >= slot.plannedSets) {
      set({ error: 'That exercise is already complete.' });
      return;
    }
    if (sessionMode === 'self_directed' && current?.sessionPlanSlotId !== sessionPlanSlotId) {
      const nextRunner: RunnerState = {
        ...runner,
        slotIndex,
        setIndex: loggedForSlot + 1,
        phase: 'working',
        restSecondsTarget: 0,
        restStartedAtMs: null,
        restRpe: null,
        substitutionOfferedForSessionPlanSlotId: null,
        updatedAtMs: Date.now(),
      };
      const d = getDb();
      d.executeSync('BEGIN');
      try {
        persistRunnerCheckpoint(d, session.sessionId, sessionMode, nextRunner);
        d.executeSync('COMMIT');
      } catch (error) {
        try { d.executeSync('ROLLBACK'); } catch { /* no partial selection */ }
        set({ error: error instanceof Error ? error.message : String(error) });
        return;
      }
      set(runnerSelection(nextRunner));
      return;
    }
    set({ activeSessionPlanSlotId: sessionPlanSlotId, activeMovementId: slot.movementId });
  },

  advanceRunnerRest: () => {
    const { session, runner, sessionMode } = get();
    if (session === null || runner === null || sessionMode === null) return;
    const nextRunner = advanceSessionRunner(runner, { kind: 'REST_ELAPSED', atMs: Date.now() });
    if (nextRunner === runner) return;
    const d = getDb();
    d.executeSync('BEGIN');
    try {
      persistRunnerCheckpoint(d, session.sessionId, sessionMode, nextRunner);
      d.executeSync('COMMIT');
    } catch (error) {
      try { d.executeSync('ROLLBACK'); } catch { /* no partial checkpoint */ }
      set({ error: error instanceof Error ? error.message : String(error) });
      return;
    }
    set(runnerSelection(nextRunner));
  },

  skipRunnerRest: () => {
    const { session, runner, sessionMode } = get();
    if (session === null || runner === null || sessionMode === null) return;
    const nextRunner = advanceSessionRunner(runner, { kind: 'SKIP_REST', atMs: Date.now() });
    if (nextRunner === runner) return;
    const d = getDb();
    d.executeSync('BEGIN');
    try {
      persistRunnerCheckpoint(d, session.sessionId, sessionMode, nextRunner);
      d.executeSync('COMMIT');
    } catch (error) {
      try { d.executeSync('ROLLBACK'); } catch { /* no partial checkpoint */ }
      set({ error: error instanceof Error ? error.message : String(error) });
      return;
    }
    set(runnerSelection(nextRunner));
  },

  setRunnerRestOverride: (seconds) => {
    const { session, runner, sessionMode } = get();
    if (session === null || runner === null || sessionMode === null) return;
    const nextRunner = advanceSessionRunner(runner, { kind: 'SET_REST_OVERRIDE', atMs: Date.now(), seconds });
    if (nextRunner === runner) return;
    const d = getDb();
    d.executeSync('BEGIN');
    try {
      persistRunnerCheckpoint(d, session.sessionId, sessionMode, nextRunner);
      d.executeSync('COMMIT');
    } catch (error) {
      try { d.executeSync('ROLLBACK'); } catch { /* no partial checkpoint */ }
      set({ error: error instanceof Error ? error.message : String(error) });
      return;
    }
    set(runnerSelection(nextRunner));
  },

  runnerThumbsDown: () => {
    const { session, runner, sessionMode } = get();
    const current = runner === null ? null : currentRunnerSlot(runner);
    if (session === null || runner === null || sessionMode === null || current === null) return;
    const nextRunner = advanceSessionRunner(runner, { kind: 'THUMBS_DOWN', atMs: Date.now() });
    if (nextRunner === runner) return;
    const d = getDb();
    d.executeSync('BEGIN');
    try {
      d.executeSync(
        `INSERT INTO movement_preference (movement_id, preference, updated_at_ms) VALUES (?, ?, ?)
         ON CONFLICT(movement_id) DO UPDATE SET preference = excluded.preference, updated_at_ms = excluded.updated_at_ms`,
        [current.movementId, MOVEMENT_PREFERENCE.AVOID, Date.now()],
      );
      persistRunnerCheckpoint(d, session.sessionId, sessionMode, nextRunner);
      d.executeSync('COMMIT');
    } catch (error) {
      try { d.executeSync('ROLLBACK'); } catch { /* no partial feedback */ }
      set({ error: error instanceof Error ? error.message : String(error) });
      return;
    }
    set({
      ...runnerSelection(nextRunner),
      movements: get().movements.map((movement) => movement.movement_id === current.movementId
        ? { ...movement, preference: MOVEMENT_PREFERENCE.AVOID }
        : movement),
    });
    get().openSubstitution(current.movementId);
  },

  runnerDeclineSubstitution: () => {
    const { session, runner, sessionMode } = get();
    if (session === null || runner === null || sessionMode === null) return;
    const nextRunner = advanceSessionRunner(runner, { kind: 'DECLINE_SUBSTITUTION', atMs: Date.now() });
    if (nextRunner === runner) return;
    const d = getDb();
    d.executeSync('BEGIN');
    try {
      persistRunnerCheckpoint(d, session.sessionId, sessionMode, nextRunner);
      d.executeSync('COMMIT');
    } catch (error) {
      try { d.executeSync('ROLLBACK'); } catch { /* no partial checkpoint */ }
      set({ error: error instanceof Error ? error.message : String(error) });
      return;
    }
    set({ ...runnerSelection(nextRunner), substitution: null });
  },

  runnerSkipSlot: () => {
    const { session, runner, sessionMode } = get();
    if (session === null || runner === null || sessionMode === null) return;
    const nextRunner = advanceSessionRunner(runner, { kind: 'SKIP_SLOT', atMs: Date.now() });
    if (nextRunner === runner) return;
    const d = getDb();
    d.executeSync('BEGIN');
    try {
      persistRunnerCheckpoint(d, session.sessionId, sessionMode, nextRunner);
      d.executeSync('COMMIT');
    } catch (error) {
      try { d.executeSync('ROLLBACK'); } catch { /* no partial checkpoint */ }
      set({ error: error instanceof Error ? error.message : String(error) });
      return;
    }
    set(runnerSelection(nextRunner));
  },

  runnerHalt: (reason = 'manual') => {
    const { session, runner, sessionMode } = get();
    if (session === null || runner === null || sessionMode === null) return;
    const nextRunner = advanceSessionRunner(runner, { kind: 'HALT', atMs: Date.now(), reason });
    if (nextRunner === runner) return;
    const d = getDb();
    d.executeSync('BEGIN');
    try {
      persistRunnerCheckpoint(d, session.sessionId, sessionMode, nextRunner);
      d.executeSync('COMMIT');
    } catch (error) {
      try { d.executeSync('ROLLBACK'); } catch { /* no partial checkpoint */ }
      set({ error: error instanceof Error ? error.message : String(error) });
      return;
    }
    set(runnerSelection(nextRunner));
  },

  addPlanSlot: (movementId) => {
    const state = get();
    const { sessionPlan, prescription, today, session, movements, profile, runner } = state;
    // The legacy library picker stays outside Phase 17. Refusing late inserts
    // avoids creating a session slot that the durable runner cannot replay.
    if (session !== null && runner !== null) {
      set({ error: 'Add movements before starting the guided session.' });
      return;
    }
    const movement = movements.find((m) => m.movement_id === movementId);
    const accessContext = executionContextForState(state);
    if (accessContext === null) {
      set({ error: 'The active session access context cannot be verified. Reopen the session before editing it.' });
      return;
    }
    const availability = capabilityMovementAvailability(
      getDb(), movements, profile, accessContext,
      new Set(state.activePriorExperienceMovementIds),
      safetyExcludedMovementIdsFor(movements, profile, state.niggles),
    )
      .find((r) => r.movementId === movementId);
    if (!permittedForProfile(movement, profile, accessContext) || availability?.state !== 'available') {
      set({ error: formatTeachingOnlyReason(availability) });
      return;
    }
    const baseSets = Math.round(clamp(
      3 + (prescription !== null && prescription.forDate === today
        ? prescription.vector.set_modifier
        : 0),
      1, 6,
    ));
    const target = targetForMovement(movement, 5);
    const plannedSets = defaultSetsForTarget(movement, baseSets);
    const newSlot: PlanSlot = {
      sessionPlanSlotId: 0,
      movementId,
      plannedSets,
      plannedReps: target.kind === 'reps' ? target.reps : null,
      target,
      provenanceKind: 'added',
      targetRpe: null,
      sourcePlannedSlotId: null,
      originalMovementId: null,
      originalSessionDate: null,
      overrideLoadKg: null,
      overrideReason: null,
    };
    if (session !== null) {
      const d = getDb();
      d.executeSync(
        `INSERT INTO session_plan_slot (session_id, slot_index, movement_id, planned_sets, planned_reps, provenance_kind, target_rpe, source_planned_slot_id, original_movement_id, original_session_date, override_load_kg, override_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [session.sessionId, sessionPlan.length, movementId, plannedSets, newSlot.plannedReps, 'added', null, null, null, null, null, null]
      );
      const slotId = rowsOf<{ id: number }>(d.executeSync('SELECT last_insert_rowid() AS id'))[0]!.id;
      d.executeSync(
        `INSERT INTO session_slot_target (session_plan_slot_id, target_kind, target_reps, target_seconds)
         VALUES (?, ?, ?, ?)`,
        [slotId, target.kind, target.kind === 'reps' ? target.reps : null, target.kind === 'time' ? target.seconds : null],
      );
      newSlot.sessionPlanSlotId = slotId;
    }
    set({
      sessionPlan: [...sessionPlan, newSlot],
      activeSessionPlanSlotId: newSlot.sessionPlanSlotId || null,
      activeMovementId: movementId,
    });
  },

  swapMovement: (oldMovementId, newMovementId) => {
    const state = get();
    const { sessionPlan, activeSessionPlanSlotId, session, runner, sessionMode, movements, profile } = state;
    const slot = activeSessionPlanSlotId !== null
      ? sessionPlan.find((candidate) => candidate.sessionPlanSlotId === activeSessionPlanSlotId)
      : sessionPlan.find((candidate) => candidate.movementId === oldMovementId);
    const replacement = movements.find((movement) => movement.movement_id === newMovementId);
    if (slot === undefined || replacement === undefined) return;
    const accessContext = executionContextForState(state);
    if (accessContext === null) {
      set({ error: 'The active session access context cannot be verified. Reopen the session before editing it.' });
      return;
    }
    const availability = capabilityMovementAvailability(
      getDb(), movements, profile, accessContext,
      new Set(state.activePriorExperienceMovementIds),
      safetyExcludedMovementIdsFor(movements, profile, state.niggles),
    )
      .find((r) => r.movementId === newMovementId);
    if (!permittedForProfile(replacement, profile, accessContext) || availability?.state !== 'available') {
      set({ error: formatTeachingOnlyReason(availability) });
      return;
    }

    const originalMv = slot.originalMovementId ?? slot.movementId;
    const newProvKind: SlotProvenanceKind = slot.targetRpe !== null ? 'substituted' : slot.provenanceKind;
    const nextPlan = sessionPlan.map((candidate) =>
      candidate.sessionPlanSlotId === slot.sessionPlanSlotId
        ? { ...candidate, movementId: newMovementId, provenanceKind: newProvKind, originalMovementId: originalMv }
        : candidate,
    );
    let nextRunner = runner;
    const current = runner === null ? null : currentRunnerSlot(runner);
    const runnerSlotIndex = runner?.slots.findIndex((candidate) => candidate.sessionPlanSlotId === slot.sessionPlanSlotId) ?? -1;
    if (runner !== null && runnerSlotIndex >= 0) {
      const throughSubstitution = current?.sessionPlanSlotId === slot.sessionPlanSlotId &&
        runner.substitutionOfferedForSessionPlanSlotId === slot.sessionPlanSlotId
        ? advanceSessionRunner(runner, {
            kind: 'SUBSTITUTE', atMs: Date.now(), movementId: newMovementId, movementName: replacement.name,
          })
        : runner;
      // Self-directed mode may replace a future slot. Keep the durable runner
      // snapshot in lockstep even when its cursor is elsewhere.
      nextRunner = throughSubstitution === runner
        ? {
            ...runner,
            slots: runner.slots.map((candidate) => candidate.sessionPlanSlotId === slot.sessionPlanSlotId
              ? { ...candidate, movementId: newMovementId, movementName: replacement.name }
              : candidate),
            updatedAtMs: Date.now(),
          }
        : throughSubstitution;
    }

    if (session !== null) {
      const d = getDb();
      d.executeSync('BEGIN');
      try {
        d.executeSync(
          `UPDATE session_plan_slot
           SET movement_id = ?, provenance_kind = ?, original_movement_id = ?
           WHERE session_plan_slot_id = ?`,
          [newMovementId, newProvKind, originalMv, slot.sessionPlanSlotId],
        );
        if (nextRunner !== null && sessionMode !== null) {
          persistRunnerCheckpoint(d, session.sessionId, sessionMode, nextRunner);
        }
        d.executeSync('COMMIT');
      } catch (error) {
        try { d.executeSync('ROLLBACK'); } catch { /* no partial substitution */ }
        set({ error: error instanceof Error ? error.message : String(error) });
        return;
      }
    }
    set({
      sessionPlan: nextPlan,
      activeMovementId: newMovementId,
      ...(nextRunner !== null ? runnerSelection(nextRunner) : {}),
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
    const state = get();
    const { movements, profile, block } = state;
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
    const accessContext = executionContextForState(get());
    if (accessContext === null) {
      set({ error: 'The active session access context cannot be verified. Reopen the session before substituting.' });
      return;
    }
    const capabilityAvailable = capabilityAvailableMovementIds(
      d, movements, profile, accessContext,
      new Set(get().activePriorExperienceMovementIds),
      safetyExcludedMovementIdsFor(movements, profile, get().niggles),
    );
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
             AND sl.planned_slot_id NOT IN (SELECT planned_slot_id FROM planned_slot_disposition WHERE disposition = 'swapped')
           ORDER BY ps.session_date, sl.slot_index`,
          [block.startDate, block.blockId, today],
        ),
      );
      futureSlots = rows.flatMap((r) => {
        const mv = byId.get(r.movement_id);
        return mv === undefined
          ? []
          : [{ plannedSlotId: r.planned_slot_id, dayIndex: r.day_index, movement: toSubMovement(mv, capabilityAvailable), sets: r.sets }];
      });
    }
    const result = computeSubstitutions({
      target: toSubMovement(target, capabilityAvailable),
      library: movements.map((movement) => toSubMovement(movement, capabilityAvailable)),
      inventory: profile.equipment_inventory,
      niggles: get().niggles, // active niggles drive the guardrail + Layer 3
      futureSlots,
      currentDayIndex,
      trainingAge: profile.training_age, // experience-weighted severity thresholds
      accessContext,
    });
    set({ substitution: { targetId: targetMovementId, result } });
  },

  closeSubstitution: () => set({ substitution: null }),

  reportNiggle: (region, severity) => {
    // Region must be a JOINTS member or the engine cannot apply its safety rules.
    if (!JOINT_SET.has(region)) return;
    const safe = Math.round(clamp(severity, 1, 10));
    const loggedAtMs = Date.now();
    const id = `${loggedAtMs}-${niggleSeq++}-${Math.floor(Math.random() * 1e9).toString(36)}`;
    const state = get();
    const current = state.runner === null ? null : currentRunnerSlot(state.runner);
    const nextRunner = state.runner === null
      ? null
      : advanceSessionRunner(state.runner, { kind: 'NIGGLE', atMs: loggedAtMs, severity: safe });
    const d = getDb();
    d.executeSync('BEGIN');
    try {
      d.executeSync(
        'INSERT INTO niggle (id, region, severity, reported_at_ms) VALUES (?, ?, ?, ?)',
        [id, region, safe, loggedAtMs],
      );
      if (nextRunner !== null && state.session !== null && state.sessionMode !== null && nextRunner !== state.runner) {
        persistRunnerCheckpoint(d, state.session.sessionId, state.sessionMode, nextRunner);
      }
      d.executeSync('COMMIT');
    } catch (error) {
      try { d.executeSync('ROLLBACK'); } catch { /* no partial safety report */ }
      set({ error: error instanceof Error ? error.message : String(error) });
      return;
    }
    set({
      niggles: [...state.niggles, { region, severity: safe }],
      ...(nextRunner !== null && nextRunner !== state.runner ? runnerSelection(nextRunner) : {}),
    });
    // A qualifying (but not halt-level) niggle immediately offers a route
    // around the movement. Halt-level reports block `logSet` at this boundary.
    if (nextRunner !== null && nextRunner.phase === 'working' &&
      nextRunner.substitutionOfferedForSessionPlanSlotId !== null && current !== null) {
      get().openSubstitution(current.movementId);
    }
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
    get().swapMovement(targetMovementId, optionMovementId);
    set({ substitution: null });
  },

  applyDaySwap: (targetMovementId, option) => {
    const state = get();
    const { sessionPlan, activeSessionPlanSlotId, session, runner, sessionMode, movements, profile } = state;
    const targetSlot = activeSessionPlanSlotId !== null
      ? sessionPlan.find((slot) => slot.sessionPlanSlotId === activeSessionPlanSlotId)
      : sessionPlan.find((slot) => slot.movementId === targetMovementId);
    if (targetSlot === undefined) return;

    const d = getDb();
    const futureSlotInfo = rowsOf<{
      target_rpe: number | null; movement_id: number; session_date: string; reps: number;
      target_kind: string | null; target_reps: number | null; target_seconds: number | null;
    }>(d.executeSync(
      `SELECT sl.target_rpe, sl.movement_id, ps.session_date, sl.reps,
              pst.target_kind, pst.target_reps, pst.target_seconds
       FROM planned_slot sl
       JOIN planned_session ps ON ps.planned_session_id = sl.planned_session_id
       LEFT JOIN planned_slot_target pst ON pst.planned_slot_id = sl.planned_slot_id
       WHERE sl.planned_slot_id = ?`,
      [option.plannedSlotId]
    ))[0];
    const swapTarget = futureSlotInfo?.target_rpe ?? null;
    const originDate = futureSlotInfo?.session_date ?? null;
    const swapKind: SlotProvenanceKind = swapTarget !== null ? 'day_swapped' : 'free_form';
    const movedTarget = targetFromFields(
      futureSlotInfo?.target_kind,
      futureSlotInfo?.target_reps,
      futureSlotInfo?.target_seconds,
      futureSlotInfo?.reps ?? 5,
    );
    const loggedSetsCount = session?.sets.filter((setRow) =>
      setRow.session_plan_slot_id !== null
        ? setRow.session_plan_slot_id === targetSlot.sessionPlanSlotId
        : setRow.movement_id === targetSlot.movementId
    ).length ?? 0;
    // Never erase logged work. A replacement can only finish the remaining
    // volume of its current slot, even when the pulled-forward source is smaller.
    const movedSets = Math.max(1, Math.round(option.setsConserved), loggedSetsCount);
    const movedReps = movedTarget.kind === 'reps' ? movedTarget.reps : null;

    const overrideRow = rowsOf<{ target_load_kg: number; reason: string | null }>(d.executeSync(
      'SELECT target_load_kg, reason FROM slot_override WHERE planned_slot_id = ?',
      [option.plannedSlotId]
    ))[0];
    const overrideLoad = overrideRow?.target_load_kg ?? null;
    const overrideReason = overrideRow?.reason ?? null;
    const replacement = movements.find((movement) => movement.movement_id === option.movement_id);
    const accessContext = executionContextForState(state);
    if (accessContext === null) {
      set({ error: 'The active session access context cannot be verified. Reopen the session before substituting.' });
      return;
    }
    const availability = capabilityMovementAvailability(
      d, movements, profile, accessContext,
      new Set(state.activePriorExperienceMovementIds),
      safetyExcludedMovementIdsFor(movements, profile, state.niggles),
    )
      .find((r) => r.movementId === option.movement_id);
    if (!permittedForProfile(replacement, profile, accessContext) || availability?.state !== 'available') {
      set({ error: formatTeachingOnlyReason(availability) });
      return;
    }

    const nextPlan = sessionPlan.map((slot) =>
      slot.sessionPlanSlotId === targetSlot.sessionPlanSlotId
        ? {
            ...slot,
            movementId: option.movement_id,
            plannedSets: movedSets,
            plannedReps: movedReps,
            target: movedTarget,
            provenanceKind: swapKind,
            targetRpe: swapTarget,
            sourcePlannedSlotId: option.plannedSlotId,
            originalMovementId: slot.originalMovementId ?? slot.movementId,
            originalSessionDate: originDate,
            overrideLoadKg: overrideLoad,
            overrideReason: overrideReason,
          }
        : slot
    );

    let nextRunner = runner;
    const runnerSlotIndex = runner?.slots.findIndex((slot) => slot.sessionPlanSlotId === targetSlot.sessionPlanSlotId) ?? -1;
    if (runner !== null && runnerSlotIndex >= 0) {
      const current = currentRunnerSlot(runner);
      const throughSubstitution = current?.sessionPlanSlotId === targetSlot.sessionPlanSlotId &&
        runner.substitutionOfferedForSessionPlanSlotId === targetSlot.sessionPlanSlotId
        ? advanceSessionRunner(runner, {
            kind: 'SUBSTITUTE', atMs: Date.now(), movementId: option.movement_id,
            movementName: replacement?.name ?? option.name,
          })
        : runner;
      const completedHere = throughSubstitution.slotSetCounts[runnerSlotIndex] ?? 0;
      const runnerSets = Math.max(movedSets, completedHere);
      nextRunner = {
        ...throughSubstitution,
        slots: throughSubstitution.slots.map((slot, index) => index === runnerSlotIndex
          ? {
              ...slot,
              movementId: option.movement_id,
              movementName: replacement?.name ?? option.name,
              sets: runnerSets,
              target: movedTarget,
              targetRpe: swapTarget ?? slot.targetRpe,
            }
          : slot),
        // A selected self-directed slot keeps its independently completed count.
        setIndex: throughSubstitution.slotIndex === runnerSlotIndex && throughSubstitution.phase === 'working'
          ? completedHere + 1
          : throughSubstitution.setIndex,
        updatedAtMs: Date.now(),
      };
    }

    d.executeSync('BEGIN');
    try {
      d.executeSync(
        `INSERT INTO planned_slot_disposition (planned_slot_id, disposition, session_id)
         VALUES (?, 'swapped', ?)
         ON CONFLICT(planned_slot_id) DO UPDATE SET disposition = excluded.disposition, session_id = excluded.session_id`,
        [option.plannedSlotId, session !== null ? session.sessionId : null]
      );

      if (session !== null) {
        d.executeSync(
          `UPDATE session_plan_slot
           SET movement_id = ?, planned_sets = ?, planned_reps = ?, provenance_kind = ?, target_rpe = ?, source_planned_slot_id = ?, original_movement_id = ?, original_session_date = ?, override_load_kg = ?, override_reason = ?
           WHERE session_plan_slot_id = ?`,
          [option.movement_id, movedSets, movedReps, swapKind, swapTarget, option.plannedSlotId, targetSlot.originalMovementId ?? targetSlot.movementId, originDate, overrideLoad, overrideReason, targetSlot.sessionPlanSlotId]
        );
        d.executeSync(
          `INSERT INTO session_slot_target (session_plan_slot_id, target_kind, target_reps, target_seconds)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(session_plan_slot_id) DO UPDATE SET
             target_kind = excluded.target_kind,
             target_reps = excluded.target_reps,
             target_seconds = excluded.target_seconds`,
          [targetSlot.sessionPlanSlotId, movedTarget.kind, movedTarget.kind === 'reps' ? movedTarget.reps : null, movedTarget.kind === 'time' ? movedTarget.seconds : null],
        );
        if (nextRunner !== null && sessionMode !== null) {
          persistRunnerCheckpoint(d, session.sessionId, sessionMode, nextRunner);
        }
      }
      d.executeSync('COMMIT');
    } catch (error) {
      try { d.executeSync('ROLLBACK'); } catch { /* no partial day swap */ }
      set({ error: error instanceof Error ? error.message : String(error) });
      return;
    }

    set({
      sessionPlan: nextPlan,
      substitution: null,
      ...(nextRunner !== null ? runnerSelection(nextRunner) : {
        activeMovementId: option.movement_id,
        activeSessionPlanSlotId: targetSlot.sessionPlanSlotId,
      }),
    });
    get().refreshBlock();
  },

  logSet: (movementId, reps, loadKg, rpe, displayName, appliedPrefixes, implement, metrics, sessionPlanSlotId) => {
    const state = get();
    const s = state.session;
    if (s === null) return;
    if (!Number.isFinite(loadKg) || loadKg < 0) {
      set({ error: 'Enter a finite load of 0 kg or more before logging the set.' });
      return;
    }
    if (state.lastTriage?.kind === 'matched' && state.lastTriage.directive.halt) {
      set({ error: 'Training is halted. Finish the session before logging more work.' });
      return;
    }
    const movement = state.movements.find((m) => m.movement_id === movementId);
    if (movement === undefined) return;

    let planSlot: PlanSlot | undefined;
    if (sessionPlanSlotId !== undefined) {
      planSlot = state.sessionPlan.find((slot) => slot.sessionPlanSlotId === sessionPlanSlotId);
      if (planSlot === undefined) {
        set({ error: `Unknown sessionPlanSlotId ${sessionPlanSlotId}: slot not found in the active session plan` });
        return;
      }
      if (planSlot.movementId !== movementId) {
        set({ error: `Mismatched slot and movement: slot ${sessionPlanSlotId} is for movement ${planSlot.movementId}, but logged movement is ${movementId}` });
        return;
      }
    } else if (state.activeSessionPlanSlotId !== null) {
      const activeSlot = state.sessionPlan.find((slot) => slot.sessionPlanSlotId === state.activeSessionPlanSlotId);
      if (activeSlot !== undefined && activeSlot.movementId === movementId) planSlot = activeSlot;
    }
    if (planSlot === undefined) planSlot = state.sessionPlan.find((slot) => slot.movementId === movementId);

    const runnerCurrent = state.runner === null ? null : currentRunnerSlot(state.runner);
    if (state.runner !== null) {
      if (state.runner.phase === 'halted') {
        set({ error: 'Training is halted. Finish the session before logging more work.' });
        return;
      }
      if (state.runner.phase !== 'working' || runnerCurrent === null) {
        set({ error: 'Finish or skip the current rest before logging the next set.' });
        return;
      }
      if (planSlot === undefined || runnerCurrent.sessionPlanSlotId !== planSlot.sessionPlanSlotId) {
        set({ error: 'This set is not the current session step.' });
        return;
      }
    }

    // Store-boundary access revalidation. SessionScreen disables an
    // unavailable slot, but logSet is a public store action: a direct call
    // must not be able to persist work the shared capability law refuses.
    // This runs AFTER the identity and halt checks and BEFORE the runner
    // advance and the write transaction, so a refusal leaves the database,
    // the durable checkpoint and the in-memory runner all untouched.
    //
    // The frozen active-session context is the ONLY authority here — there is
    // no weight-room (or any other) fallback to infer for a live session, so
    // an unverifiable context is a refusal, not a default.
    const logAccessContext = executionContextForState(state);
    if (logAccessContext === null) {
      set({ error: 'The active session access context cannot be verified. Reopen the session before logging more work.' });
      return;
    }
    // One shared law, one verdict: tier, equipment, active niggles, capability
    // evidence, prior-experience declarations and separate attestation are all
    // resolved together against the live profile and the frozen context.
    const logAvailability = capabilityMovementAvailability(
      getDb(),
      state.movements,
      state.profile,
      logAccessContext,
      new Set(state.activePriorExperienceMovementIds),
      safetyExcludedMovementIdsFor(state.movements, state.profile, state.niggles),
    ).find((verdict) => verdict.movementId === movementId);
    // Fail closed: a missing verdict is unverifiable, not permission.
    if (logAvailability?.state !== 'available') {
      set({ error: formatTeachingOnlyReason(logAvailability) });
      return;
    }

    const prescribedDose = planSlot?.target ?? null;
    const timeMode = prescribedDose?.kind === 'time' || (prescribedDose === null && movement.loggingMode === 'time');
    if (timeMode && (metrics?.timeS === undefined || metrics.timeS <= 0)) {
      set({ error: `${movement.name} is time-based - log seconds for it.` });
      return;
    }
    const effImplement = implement ?? movement.supportedPrefixes[0] ?? 'Bodyweight';
    appliedPrefixes = (appliedPrefixes ?? []).filter((condition) => conditionApplies(condition, effImplement));

    const safeReps = timeMode ? 1 : Math.round(clamp(reps, 1, 50));
    const safeLoad = clamp(Math.round(loadKg / 2.5) * 2.5, 0, 500);
    const safeRpe = rpe === null ? null : clamp(Math.round(rpe * 2) / 2, 5, 10);
    const loggedAtMs = Date.now();

    let nextRunner: RunnerState | null = state.runner;
    if (state.runner !== null) {
      nextRunner = advanceSessionRunner(state.runner, {
        kind: 'LOG_SET',
        atMs: loggedAtMs,
        ...(safeRpe === null ? {} : { actualRpe: safeRpe }),
      });
      if (nextRunner === state.runner) {
        set({ error: 'That set cannot be logged in the current session state.' });
        return;
      }
      // A disabled timer means no waiting screen at all, while the checkpoint
      // still records the exact deterministic transition.
      if (!state.uiPreferences.restTimerEnabled && nextRunner.phase === 'resting') {
        nextRunner = advanceSessionRunner(nextRunner, { kind: 'SKIP_REST', atMs: loggedAtMs });
      }
    }

    const d = getDb();
    let provKind: SlotProvenanceKind = planSlot?.provenanceKind ?? 'free_form';
    const rawTarget = planSlot?.targetRpe ?? null;
    const rpeSafetyCap = state.prescription?.vector.rpe_cap ?? 10.0;
    const provTarget: number | null = rawTarget !== null ? Math.min(rawTarget, rpeSafetyCap) : null;
    const provSlotId: number | null = planSlot?.sourcePlannedSlotId ?? null;
    if (provTarget === null && provKind !== 'added') provKind = 'free_form';
    if (provTarget !== null && provKind === 'free_form') provKind = 'added';

    const setIndex = planSlot !== undefined
      ? (rowsOf<{ next: number }>(d.executeSync(
          `SELECT COUNT(*) + 1 AS next
           FROM set_target WHERE session_plan_slot_id = ?`,
          [planSlot.sessionPlanSlotId],
        ))[0]?.next ?? 1)
      : (rowsOf<{ next: number }>(d.executeSync(
          'SELECT COALESCE(MAX(set_index), 0) + 1 AS next FROM set_record WHERE session_id = ? AND movement_id = ?',
          [s.sessionId, movementId],
        ))[0]?.next ?? 1);

    const applied = (appliedPrefixes ?? []).filter((prefix, index, all) => all.indexOf(prefix) === index);
    const conds = applied.length > 0
      ? state.movementPrefixes.filter((condition) => applied.includes(condition.prefixName))
      : [];

    let setId = 0;
    d.executeSync('BEGIN');
    try {
      d.executeSync(
        `INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [s.sessionId, movementId, setIndex, safeReps, safeLoad, safeRpe, loggedAtMs],
      );
      setId = rowsOf<{ id: number }>(d.executeSync('SELECT last_insert_rowid() AS id'))[0]!.id;
      d.executeSync(
        `INSERT INTO set_target (set_id, session_plan_slot_id, provenance_kind, target_rpe, source_planned_slot_id, created_at_ms)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [setId, planSlot?.sessionPlanSlotId ?? null, provKind, provTarget, provSlotId, loggedAtMs],
      );
      if (prescribedDose !== null) {
        d.executeSync(
          'INSERT INTO set_dose_target (set_id, target_kind, target_reps, target_seconds) VALUES (?, ?, ?, ?)',
          [
            setId,
            prescribedDose.kind,
            prescribedDose.kind === 'reps' ? prescribedDose.reps : null,
            prescribedDose.kind === 'time' ? prescribedDose.seconds : null,
          ],
        );
      }
      if (timeMode && metrics?.timeS !== undefined && metrics.timeS > 0) {
        d.executeSync(
          'INSERT INTO set_metric (set_id, metric, value) VALUES (?, ?, ?)',
          [setId, 'time_s', clamp(Math.round(metrics.timeS), 1, 7200)],
        );
      }
      if (metrics?.bandLevel !== undefined && metrics.bandLevel >= 1) {
        d.executeSync(
          'INSERT INTO set_metric (set_id, metric, value) VALUES (?, ?, ?)',
          [setId, 'band_level', Math.round(clamp(metrics.bandLevel, 1, 20))],
        );
      }
      if (conds.length > 0) {
        const eff = calculateEffectiveLoad(safeLoad, conds);
        const cnsMod = conds.reduce((product, condition) => product * condition.cnsLoadModifier, 1);
        const diffMod = conds.reduce((product, condition) => product * condition.difficultyModifier, 1);
        d.executeSync(
          `INSERT INTO set_prefix (set_id, applied_prefixes, cns_load_modifier,
             stability_requirement_modifier, difficulty_modifier, effective_load_kg)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [setId, JSON.stringify(eff.appliedPrefixes), cnsMod, eff.stabilityDemand, diffMod, eff.effectiveLoad],
        );
      }
      if (nextRunner !== null && state.sessionMode !== null) {
        persistRunnerCheckpoint(d, s.sessionId, state.sessionMode, nextRunner);
      }
      d.executeSync('COMMIT');
    } catch (error) {
      try { d.executeSync('ROLLBACK'); } catch { /* connection-level failure */ }
      set({ error: error instanceof Error ? error.message : String(error) });
      return;
    }

    const logged: LoggedSet = {
      set_id: setId,
      movement_id: movementId,
      movement_name: displayName !== undefined && displayName.length > 0 ? displayName : movement.name,
      set_index: setIndex,
      reps: safeReps,
      load_kg: safeLoad,
      rpe: safeRpe,
      tonnage_kg: safeReps * safeLoad,
      session_plan_slot_id: planSlot?.sessionPlanSlotId ?? null,
      timeS: timeMode ? (metrics?.timeS ?? null) : null,
      bandLevel: metrics?.bandLevel ?? null,
    };
    set({
      session: { ...s, sets: [logged, ...s.sets] },
      lastLoggedLoads: { ...state.lastLoggedLoads, [movementId]: safeLoad },
      ...(nextRunner !== null ? runnerSelection(nextRunner) : {}),
    });
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

  editSet: (setId, reps, loadKg, rpe, metrics) => {
    const s = get().session;
    if (s === null) return;
    const existing = s.sets.find((setRow) => setRow.set_id === setId);
    if (existing === undefined) return;
    // Same CHECK-domain clamps as logSet: a UI bug must never throw mid-edit.
    const safeReps = Math.round(clamp(reps, 1, 50));
    const editedTimeS = metrics?.timeS === undefined
      ? existing.timeS
      : Math.round(clamp(metrics.timeS, 1, 7200));
    const editedBandLevel = metrics?.bandLevel === undefined
      ? existing.bandLevel
      : metrics.bandLevel === null
        ? null
        : Math.round(clamp(metrics.bandLevel, 1, 20));
    const safeLoad = clamp(Math.round(loadKg / 2.5) * 2.5, 0, 500);
    const safeRpe = rpe === null ? null : clamp(Math.round(rpe * 2) / 2, 5, 10);
    // UPDATE OF reps, load_kg, rpe fires trg_set_record_au, which re-deltas
    // mech_daily (old contribution out, new in). tonnage_kg is a GENERATED
    // STORED column — SQLite recomputes it; we mirror it in memory below.
    const dEdit = getDb();
    dEdit.executeSync(
      'UPDATE set_record SET reps = ?, load_kg = ?, rpe = ? WHERE set_id = ?',
      [safeReps, safeLoad, safeRpe, setId],
    );
    if (metrics?.timeS !== undefined) {
      dEdit.executeSync(
        `INSERT INTO set_metric (set_id, metric, value) VALUES (?, 'time_s', ?)
         ON CONFLICT(set_id, metric) DO UPDATE SET value = excluded.value`,
        [setId, editedTimeS],
      );
    }
    if (metrics?.bandLevel !== undefined) {
      if (editedBandLevel === null) {
        dEdit.executeSync("DELETE FROM set_metric WHERE set_id = ? AND metric = 'band_level'", [setId]);
      } else {
        dEdit.executeSync(
          `INSERT INTO set_metric (set_id, metric, value) VALUES (?, 'band_level', ?)
           ON CONFLICT(set_id, metric) DO UPDATE SET value = excluded.value`,
          [setId, editedBandLevel],
        );
      }
    }
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
            ? {
                ...x,
                reps: safeReps,
                load_kg: safeLoad,
                rpe: safeRpe,
                tonnage_kg: safeReps * safeLoad,
                timeS: editedTimeS,
                bandLevel: editedBandLevel,
              }
            : x),
      },
      lastLoggedLoads: latestLoadMap(dEdit),
    });
  },

  endSession: () => {
    const activeSession = get().session;
    if (activeSession === null) return;
    const d = getDb();
    const finalizedAtMs = Date.now();
    let outcomeDecision: SessionOutcomeDecision | null = null;

    d.executeSync('BEGIN');
    try {
      const snapshot = hydrateSessionFinalization(d, activeSession.sessionId);
      let terminalRunner = snapshot.runner;
      if (
        (terminalRunner.phase === 'working' || terminalRunner.phase === 'resting') &&
        snapshot.hasPersistedSafetyHalt
      ) {
        terminalRunner = advanceSessionRunner(terminalRunner, {
          kind: 'HALT',
          atMs: finalizedAtMs,
          reason: 'safety',
        });
      }
      if (terminalRunner.phase !== 'complete' && terminalRunner.phase !== 'halted') {
        throw new Error('Stop the active session before finishing it.');
      }

      const terminal = terminalRunner.phase === 'complete'
        ? { phase: 'complete' as const, haltReason: null }
        : { phase: 'halted' as const, haltReason: terminalRunner.haltReason! };
      outcomeDecision = evaluateSessionOutcome({
        originKind: snapshot.originKind,
        terminal,
        slots: snapshot.slots,
        sets: snapshot.sets,
        skippedSessionPlanSlotIds: terminalRunner.skippedSessionPlanSlotIds,
        finalizedAtMs,
      });

      if (outcomeDecision === null) {
        if (snapshot.loggedSets.length !== 0) {
          throw new Error('Only an empty session can be discarded.');
        }
        // Parent-first keeps 026's immutable side-cars legal. The explicit
        // cleanup that follows also handles test/dev connections with FKs off.
        d.executeSync('DELETE FROM session WHERE session_id = ?', [activeSession.sessionId]);
        d.executeSync('DELETE FROM session_slot_target WHERE session_plan_slot_id IN (SELECT session_plan_slot_id FROM session_plan_slot WHERE session_id = ?)', [activeSession.sessionId]);
        d.executeSync('DELETE FROM planned_slot_disposition WHERE session_id = ?', [activeSession.sessionId]);
        d.executeSync('DELETE FROM session_plan_slot WHERE session_id = ?', [activeSession.sessionId]);
        d.executeSync('DELETE FROM session_origin WHERE session_id = ?', [activeSession.sessionId]);
      } else {
        const ratedSets = snapshot.loggedSets.filter((loggedSet) => loggedSet.rpe !== null);
        const avgRpe = ratedSets.length === 0
          ? null
          : Math.round(
              (ratedSets.reduce((sum, loggedSet) => sum + (loggedSet.rpe ?? 0), 0) / ratedSets.length) * 2,
            ) / 2;
        const durationMin = Math.round(
          (Math.max(0, finalizedAtMs - (snapshot.startedAtMs ?? finalizedAtMs)) / 60_000) * 10,
        ) / 10;
        d.executeSync(
          'UPDATE session SET session_rpe = ?, duration_min = ? WHERE session_id = ?',
          [avgRpe, durationMin, activeSession.sessionId],
        );
        d.executeSync(
          `INSERT INTO capability_session_evidence
             (session_id, movement_id, qualifying_sets, minimum_value, maximum_rpe, verified)
           SELECT sr.session_id, sr.movement_id, COUNT(*),
                  CAST(MIN(CASE WHEN lm.mode = 'time' THEN tm.value ELSE sr.reps END) AS INTEGER),
                  MAX(sr.rpe), 1
           FROM set_record sr
           LEFT JOIN movement_logging_mode lm ON lm.movement_id = sr.movement_id
           LEFT JOIN set_metric tm ON tm.set_id = sr.set_id AND tm.metric = 'time_s'
           WHERE sr.session_id = ?
             AND (lm.mode <> 'time' OR tm.value IS NOT NULL)
           GROUP BY sr.session_id, sr.movement_id
           ON CONFLICT(session_id, movement_id) DO UPDATE SET
             qualifying_sets = excluded.qualifying_sets,
             minimum_value = excluded.minimum_value,
             maximum_rpe = excluded.maximum_rpe,
             verified = 1`,
          [activeSession.sessionId],
        );        d.executeSync(MATERIALIZE_STATE_VECTOR_SQL, [snapshot.sessionDate]);
        applyApreFinalization(
          d,
          snapshot.originKind === 'planned' ? snapshot.sourcePlannedSessionId : null,
          snapshot.loggedSets,
          finalizedAtMs,
        );
        persistSessionOutcome(
          d,
          activeSession.sessionId,
          snapshot.originKind,
          snapshot.sessionMode,
          terminalRunner.tier,
          outcomeDecision,
        );
      }

      // Always the final DML before COMMIT. A fault here rolls session
      // finalization, APRE, outcome, and the checkpoint delete back together.
      d.executeSync('DELETE FROM session_runner_checkpoint WHERE session_id = ?', [activeSession.sessionId]);
      d.executeSync('COMMIT');
    } catch (error) {
      try { d.executeSync('ROLLBACK'); } catch { /* retain resumable state */ }
      set({ error: error instanceof Error ? error.message : String(error) });
      return;
    }

    set({
      session: null,
      sessionPlan: [],
      activeSessionPlanSlotId: null,
      activeMovementId: null,
      runner: null,
      sessionMode: null,
      activeSessionAccessContext: null,
      substitution: null,
      movementAvailabilityRevision: get().movementAvailabilityRevision + 1,
      lastEndedSessionId: outcomeDecision === null ? null : activeSession.sessionId,
      error: null,
    });
    get().refreshVector();
    get().refreshBlock();
    get().computePrescription([]);
  },
  computePrescription: (_patterns) => {
    const { vector, profile, session } = get();
    // No readiness vector -> no adjustment; NEVER leave yesterday's on screen.
    if (vector === null) { set({ prescription: null }); return; }
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
      // A safety halt is a store boundary, not merely a red screen. Commit the
      // report and exact runner checkpoint together so a relaunch cannot reopen
      // logging between a report and its safety state.
      const activeRunner = get().runner;
      const activeMode = get().sessionMode;
      const haltedRunner = auditHalt && activeSession !== null && activeRunner !== null && activeMode !== null
        ? advanceSessionRunner(activeRunner, { kind: 'HALT', atMs: Date.now(), reason: 'safety' })
        : null;
      d.executeSync('BEGIN');
      try {
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
        if (haltedRunner !== null && haltedRunner !== activeRunner && activeSession !== null && activeMode !== null) {
          persistRunnerCheckpoint(d, activeSession.sessionId, activeMode, haltedRunner);
        }
        d.executeSync('COMMIT');
      } catch (error) {
        try { d.executeSync('ROLLBACK'); } catch { /* safety report is atomic */ }
        set({ error: error instanceof Error ? error.message : String(error) });
        return;
      }
      if (haltedRunner !== null && haltedRunner !== activeRunner) {
        set(runnerSelection(haltedRunner));
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
      d.executeSync('DELETE FROM history_import_capability_evidence');
      d.executeSync('DELETE FROM history_import_set');
      d.executeSync('DELETE FROM history_import_session');
      d.executeSync('DELETE FROM history_import');
      d.executeSync('DELETE FROM import_readiness_daily');
      d.executeSync('DELETE FROM bodyweight_daily');
      d.executeSync('DELETE FROM movement_capability_attestation');
      d.executeSync('DELETE FROM movement_prior_experience');
      d.executeSync('DELETE FROM capability_session_evidence');
      d.executeSync('DELETE FROM set_target');
      d.executeSync('DELETE FROM session_runner_checkpoint');
      d.executeSync('DELETE FROM session_slot_target');
      d.executeSync('DELETE FROM planned_slot_disposition');
      d.executeSync('DELETE FROM planned_slot_autopilot');
      d.executeSync('DELETE FROM planned_slot_routine_decision');
      d.executeSync('DELETE FROM planned_slot_target');
      d.executeSync('DELETE FROM planned_session_routine_context');
      d.executeSync('DELETE FROM planned_session_method');
      d.executeSync('DELETE FROM session_plan_slot');
      d.executeSync('DELETE FROM session_origin');
      d.executeSync('DELETE FROM set_prefix');
      d.executeSync('DELETE FROM set_record');
      // 026 snapshot immutability permits deletion only after its parent is
      // gone. With FKs on the parent cascade already emptied this table; with
      // FKs off this explicit pass removes the now-parentless rows.
      d.executeSync('DELETE FROM set_dose_target');
      d.executeSync('DELETE FROM session_note');
      d.executeSync('DELETE FROM report_severity');
      d.executeSync('DELETE FROM slot_override');
      d.executeSync('DELETE FROM planned_slot');
      d.executeSync('DELETE FROM planned_session');
      d.executeSync('DELETE FROM block_meta');
      d.executeSync('DELETE FROM training_program_movement_preference');
      d.executeSync('DELETE FROM training_program_day');
      d.executeSync('DELETE FROM training_block_program');
      d.executeSync('DELETE FROM training_program');
      d.executeSync('DELETE FROM session');
      // Same parent-first rule as set_dose_target.
      d.executeSync('DELETE FROM session_outcome');
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
    // Reflect the now-empty DB in memory — EVERY derived surface, not just
    // 1RMs (audit B1: stale prescription/session/plan state survived the
    // reset). profileNotes intentionally stay: athlete_profile — including
    // injury/mobility notes — is preserved by this wipe and the dialog says so.
    set({
      oneRepMaxes: {},
      lastLoggedLoads: {},
      session: null, sessionPlan: [], activeSessionPlanSlotId: null, activeMovementId: null, runner: null, sessionMode: null,
      activeSessionAccessContext: null, activePriorExperienceMovementIds: [],
      movementAvailabilityRevision: get().movementAvailabilityRevision + 1,
      prescription: null, substitution: null, lastTriage: null, niggles: [],
      block: null, blockMeta: null, blockSessions: [], todayPlan: null, program: null,
      lastEndedSessionId: null,
    });
    get().refreshVector();
    get().refreshBlock();
    get().refreshProgram();
    get().refreshNiggles();
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
      d.executeSync(MOVEMENT_LIBRARY_SQL),
    ).map(movementFromRow);
    set({ movements, lastLoggedLoads: latestLoadMap(d) });
    get().refreshVector();
  },

  dismissOutcome: () => {
    set({ lastEndedSessionId: null });
  },

  loadSessionOutcome: (sessionId) => {
    try {
      const res = getDb().executeSync(
        'SELECT outcome_kind, finalized_at_ms FROM session_outcome WHERE session_id = ?',
        [sessionId],
      );
      const rows = rowsOf<{ outcome_kind: string; finalized_at_ms: number }>(res);
      if (rows.length > 0) {
        return {
          outcomeKind: rows[0].outcome_kind,
          finalizedAtMs: rows[0].finalized_at_ms,
        };
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  loadRecentOutcomes: (limit = 20) => {
    try {
      const res = getDb().executeSync(
        'SELECT outcome_kind, finalized_at_ms FROM session_outcome ORDER BY finalized_at_ms DESC LIMIT ?',
        [limit],
      );
      const rows = rowsOf<{ outcome_kind: string; finalized_at_ms: number }>(res);
      return rows.map((r) => ({
        outcomeKind: r.outcome_kind,
        finalizedAtMs: r.finalized_at_ms,
      }));
    } catch (e) {
      console.error('Failed to load recent session outcomes:', e);
      return [];
    }
  },
}));
