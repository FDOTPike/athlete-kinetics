/**
 * longitudinalAutopilot.ts — V1 9-month longitudinal coaching-engine overlay
 * (WO-LONG-ENGINE-01).
 *
 * Pure, deterministic, zero-I/O cross-block controller layered over the
 * 21-day Flaw-Detection observer (`detectFlaws`), objective completion
 * shortfall (`deriveCompletionAction`), and 3-tier contravariant substitution
 * router (`computeSubstitutions`).
 *
 * Architectural boundaries enforced by construction:
 *   1. No module-level candidate threshold defaults (`LongitudinalAutopilotPolicy`
 *      must be explicitly supplied by the caller; null or invalid policy fails
 *      closed to a neutral overlay).
 *   2. Cross-block `073` slot-replacement + joint-discomfort memory promotes
 *      a movement to `MOVEMENT_PREFERENCE.AVOID` (`-1`) + Layer 1 green
 *      regression (`selectSubstitution`) across the trailing `swapWindowBlocks`
 *      window at `kTrigger`, while non-pathological swaps (`equipment_busy`,
 *      `equipment-improvised`, `preference`, `time`) contribute zero triggers.
 *   3. Per-pattern working-set ceiling `MRV_p` stays strictly bounded in
 *      `[1, 10]`, and `-1` Week-3 working-set trim engages after `mCadence`
 *      consecutive Week-3 overreach blocks, stepping back up by `+1` only
 *      after `mClean` consecutive clean `latent_headroom` blocks.
 *   4. Beginner upward-load clamp (`dLoad_p <= 1.0`) and macrocycle positive
 *      RPE authority envelope (`<= 2.5` across positions `1..8`, `0.0` in
 *      `6..8`, `0.0` while suspended, clean rollover at Macrocycle 2 position 1).
 *   5. Strictly isolated from descriptive/readiness side channels: `acwr`,
 *      `072_question_log`, and KineStrike `ks_*` telemetry fields are never
 *      read by prescription or substitution logic.
 */
import {
  EXPERIENCE_SEVERITY,
  MOVEMENT_PATTERNS,
  MOVEMENT_PREFERENCE,
  type MacroPhase,
  type MovementPattern,
  type StateVectorRow,
  type TrainingAge,
  type UserProfile,
} from './types';
import { LOAD_MODIFIER_LITERALS } from './outputSchema';
import type { Guardrail } from './semantic/codebase';
import type { BlockPlan, PlannedSessionPlan, PlannedSlotPlan } from './blockGenerator';
import type { ExecutableMovementAccessContext } from './tierPolicy';
import {
  CONTROL_AUTHORITY,
  FLAW_DETECTION_CONSTANTS,
  NEUTRAL_LOAD_MODIFIER,
  deriveControlAction,
  detectFlaws,
  snapToLiteral,
  type ControlAction,
  type FlawReport,
  type PatternCorrection,
} from './kinematicAutopilot';
import {
  buildPatternWindow,
  type WindowNiggleRow,
  type WindowSetRow,
} from './autopilotProjection';
import {
  buildCompletionWindow,
  deriveCompletionAction,
  summarizeCompletionWindow,
  type CompletionActionPolicy,
  type WindowCompletionRow,
} from './completionAction';
import {
  PATTERN_JOINTS,
  SUBSTITUTION_COLORS,
  computeSubstitutions,
  type Joint,
  type NiggleInput,
  type RegressionOption,
  type SubstitutionMovement,
  type SubstitutionResult,
  type TriageCluster,
} from './substitution';

// ---------------------------------------------------------------------------
// Shipped structural bounds & non-pathological exclusion vocabularies
// ---------------------------------------------------------------------------

/** Mirrors `planned_slot.sets CHECK (sets BETWEEN 1 AND 10)` in 007. */
export const LONGITUDINAL_MRV_MIN_SETS = 1;
export const LONGITUDINAL_MRV_MAX_SETS = 10;

/** Explicit swap causes that represent gym/logistics friction rather than pathology. */
export const EQUIPMENT_NON_PATHOLOGICAL_CAUSES = ['equipment_busy'] as const;

/** Semantic phrase IDs representing improvised equipment rather than joint pathology. */
export const EQUIPMENT_NON_PATHOLOGICAL_PHRASE_IDS = ['equipment-improvised'] as const;

// ---------------------------------------------------------------------------
// Explicit policy & input/output types
// ---------------------------------------------------------------------------

export interface LongitudinalAutopilotPolicy {
  /** Joint-coupled swap/discomfort trigger threshold across the trailing block window (>= 1). */
  readonly kTrigger: number;
  /** Trailing block window length for swap/discomfort memory (>= 1). */
  readonly swapWindowBlocks: number;
  /** Consecutive Week-3 overreach blocks required to engage `-1` Week-3 set trim (>= 1). */
  readonly mCadence: number;
  /** Consecutive clean `latent_headroom` blocks required to step up by `+1` (>= 1). */
  readonly mClean: number;
  /** Explicit completion shortfall policy; null disables completion reduction. */
  readonly completionPolicy: CompletionActionPolicy | null;
}

export type LongitudinalSwapCause =
  | 'joint_discomfort'
  | 'equipment_busy'
  | 'preference'
  | 'time'
  | 'other';

/** Cross-block projection of a `073_session_slot_replaced_by` swap event. */
export interface LongitudinalSwapRecord {
  readonly sessionDate: string;
  readonly sessionPlanSlotId: number;
  readonly replacedBySessionPlanSlotId: number;
  readonly originalMovementId: number;
  readonly replacementMovementId: number;
  readonly pattern: MovementPattern;
  readonly cause?: LongitudinalSwapCause;
  readonly matchedPhraseEntryId?: string | null;
  /** Optional SQL column-name mirror for direct store row mapping. */
  readonly matched_phrase_entry_id?: string | null;
  readonly sessionFeelReasonPain?: 0 | 1;
  readonly sessionFeelReasonEquipment?: 0 | 1;
}

/** One completed 4-week block's windowed evidence for longitudinal evaluation. */
export interface LongitudinalBlockEvidence {
  readonly blockSequence: number;
  /** Macrocycle block position (1..8) at which this block ran. */
  readonly macroBlockIndex: number;
  /** Calendar-ordered window dates (oldest first; typically 21 or 28 days). */
  readonly windowDates: readonly string[];
  /** Explicit Week-3 dates when caller overrides standard window segmentation. */
  readonly week3Dates?: readonly string[];
  readonly stateVectors: readonly StateVectorRow[];
  readonly setRows: readonly WindowSetRow[];
  readonly niggleRows: readonly WindowNiggleRow[];
  readonly completionRows?: readonly WindowCompletionRow[];
  readonly swapRecords?: readonly LongitudinalSwapRecord[];
  readonly globalGuardrail?: Guardrail | null;
  /** True when this block was generated/executed under an open suspension episode. */
  readonly isSuspended?: boolean;
  /** Optional peak prescribed working sets per pattern during this block. */
  readonly peakPrescribedSetsByPattern?: Partial<Record<MovementPattern, number>>;
}

export interface SelectSubstitutionInput {
  readonly targetMovementId: number;
  readonly library: readonly SubstitutionMovement[];
  readonly derivedPreferences: Readonly<Record<number, -1 | 0 | 1>>;
  readonly inventory: readonly string[];
  readonly trainingAge: TrainingAge;
  readonly upcomingBlockNiggles?: readonly NiggleInput[];
  readonly accessContext?: ExecutableMovementAccessContext;
}

export type SelectedSubstitution =
  | {
      readonly kind: 'layer1_regression';
      readonly color: typeof SUBSTITUTION_COLORS.regression;
      readonly targetMovementId: number;
      readonly replacement: RegressionOption;
      readonly triage: null;
      readonly substitutionResult: SubstitutionResult;
    }
  | {
      readonly kind: 'layer3_triage';
      readonly color: typeof SUBSTITUTION_COLORS.triage;
      readonly targetMovementId: number;
      readonly replacement: null;
      readonly triage: TriageCluster;
      readonly substitutionResult: SubstitutionResult;
    }
  | {
      readonly kind: 'halt_advised';
      readonly targetMovementId: number;
      readonly replacement: null;
      readonly triage: null;
      readonly substitutionResult: SubstitutionResult;
    }
  | {
      readonly kind: 'unresolvable';
      readonly targetMovementId: number;
      readonly replacement: null;
      readonly triage: null;
      readonly substitutionResult: SubstitutionResult;
    };

export interface LongitudinalAutopilotInput {
  readonly profile: UserProfile;
  readonly library: readonly SubstitutionMovement[];
  readonly inventory: readonly string[];
  /** Chronologically ordered completed blocks (oldest first). */
  readonly blocks: readonly LongitudinalBlockEvidence[];
  /** Initial per-pattern working-set ceiling before `blocks[0]` (clamped to 1..10). */
  readonly initialPatternMrvSets?: Partial<Record<MovementPattern, number>>;
  /** Upcoming block's 1..8 macrocycle position. */
  readonly upcomingMacroBlockIndex: number;
  readonly upcomingMacroPhase: MacroPhase;
  /** True if a suspension episode is currently open for the upcoming block. */
  readonly upcomingBlockSuspended?: boolean;
  /** Active acute niggles entering the upcoming block, if any. */
  readonly upcomingBlockNiggles?: readonly NiggleInput[];
  readonly accessContext?: ExecutableMovementAccessContext;
  /** Explicit ratified policy; null or invalid policy fails closed. */
  readonly policy: LongitudinalAutopilotPolicy | null;
}

export interface LongitudinalAutopilotResult {
  readonly policyApplied: boolean;
  /** Movements promoted to Avoid (-1) for the upcoming block. */
  readonly derivedPreferences: Record<number, -1>;
  /** Trailing-window joint-coupled swap counts per movement_id. */
  readonly swapTriggerCounts: Record<number, number>;
  /** Deterministic substitution resolution per Avoid-promoted movement_id. */
  readonly substitutions: Record<number, SelectedSubstitution>;
  /** Bounded per-pattern working-set ceiling in [1, 10]. */
  readonly patternMrvSets: Record<MovementPattern, number>;
  /** Per-pattern Week-3 cadence trim (`0` or `-1`). */
  readonly week3SetTrimByPattern: Record<MovementPattern, 0 | -1>;
  /** Consecutive Week-3 overreach streak per pattern after the latest block. */
  readonly consecutiveWeek3OverreachByPattern: Record<MovementPattern, number>;
  /** Consecutive clean latent-headroom streak per pattern after the latest block. */
  readonly consecutiveCleanHeadroomByPattern: Record<MovementPattern, number>;
  /** Latest block's FlawReport (or neutral report when blocks are empty / policy invalid). */
  readonly latestFlawReport: FlawReport | null;
  /** Composed, beginner-clamped, macrocycle-bounded ControlAction for upcoming block. */
  readonly controlAction: ControlAction;
  /** Cumulative positive RPE grants issued in the active macrocycle through upcoming block. */
  readonly cumulativeMacrocycleRpeGranted: number;
}

// ---------------------------------------------------------------------------
// Pure internal helpers
// ---------------------------------------------------------------------------

const NEUTRAL_CORRECTION: PatternCorrection = {
  dLoad_p: NEUTRAL_LOAD_MODIFIER,
  dSet_p: 0,
  dRpe_p: 0,
  prefBias_p: 0,
};

const clampInt = (value: number, low: number, high: number): number => {
  if (!Number.isFinite(value)) return high;
  return Math.min(high, Math.max(low, Math.round(value)));
};

const round4 = (value: number): number => Math.round(value * 1e4) / 1e4;

const neutralControlAction = (): ControlAction => {
  const corrections = {} as Record<MovementPattern, PatternCorrection>;
  for (const pattern of MOVEMENT_PATTERNS) {
    corrections[pattern] = { ...NEUTRAL_CORRECTION };
  }
  return { corrections, blockAddedSets: 0, blockAddedRpe: 0 };
};

const defaultPatternMap = <T>(fill: T): Record<MovementPattern, T> => {
  const out = {} as Record<MovementPattern, T>;
  for (const pattern of MOVEMENT_PATTERNS) {
    out[pattern] = fill;
  }
  return out;
};

const isValidCompletionPolicy = (
  candidate: unknown,
): candidate is CompletionActionPolicy => {
  if (candidate === null || typeof candidate !== 'object') return false;
  const record = candidate as Record<string, unknown>;
  const minObs = record.minObservationDays;
  const deficit = record.deficitThreshold;
  const strong = record.strongThreshold;
  return (
    typeof minObs === 'number' &&
    Number.isInteger(minObs) &&
    minObs >= 1 &&
    typeof deficit === 'number' &&
    Number.isFinite(deficit) &&
    deficit > 0 &&
    deficit <= 1 &&
    typeof strong === 'number' &&
    Number.isFinite(strong) &&
    strong >= deficit &&
    strong <= 1
  );
};

/** Validate explicit longitudinal policy without supplying fallback numbers. */
export function isValidLongitudinalAutopilotPolicy(
  policy: unknown,
): policy is LongitudinalAutopilotPolicy {
  if (policy === null || typeof policy !== 'object') return false;
  const record = policy as Record<string, unknown>;
  const { kTrigger, swapWindowBlocks, mCadence, mClean, completionPolicy } = record;
  return (
    typeof kTrigger === 'number' &&
    Number.isInteger(kTrigger) &&
    kTrigger >= 1 &&
    typeof swapWindowBlocks === 'number' &&
    Number.isInteger(swapWindowBlocks) &&
    swapWindowBlocks >= 1 &&
    typeof mCadence === 'number' &&
    Number.isInteger(mCadence) &&
    mCadence >= 1 &&
    typeof mClean === 'number' &&
    Number.isInteger(mClean) &&
    mClean >= 1 &&
    (completionPolicy === null || isValidCompletionPolicy(completionPolicy))
  );
}

const isNonPathologicalEquipmentSwap = (swap: LongitudinalSwapRecord): boolean => {
  const phraseId = swap.matchedPhraseEntryId ?? swap.matched_phrase_entry_id ?? null;
  if (
    swap.cause !== undefined &&
    (EQUIPMENT_NON_PATHOLOGICAL_CAUSES as readonly string[]).includes(swap.cause)
  ) {
    return true;
  }
  if (swap.cause === 'preference' || swap.cause === 'time') {
    return true;
  }
  if (
    phraseId !== null &&
    (EQUIPMENT_NON_PATHOLOGICAL_PHRASE_IDS as readonly string[]).includes(phraseId)
  ) {
    return true;
  }
  if (
    swap.sessionFeelReasonEquipment === 1 &&
    swap.sessionFeelReasonPain !== 1 &&
    swap.cause !== 'joint_discomfort'
  ) {
    return true;
  }
  return false;
};

/** Extract the Week-3 date slice from a block's calendar window. */
const resolveWeek3Dates = (block: LongitudinalBlockEvidence): readonly string[] => {
  if (block.week3Dates !== undefined && block.week3Dates.length > 0) {
    return block.week3Dates;
  }
  const dates = block.windowDates;
  if (dates.length >= 28) {
    return dates.slice(14, 21);
  }
  if (dates.length >= 14) {
    // In the standard 21-day Weeks 2/3/deload window, [L-14, L-7) is Week 3.
    return dates.slice(dates.length - 14, dates.length - 7);
  }
  return dates;
};

const isReductionCorrection = (corr: PatternCorrection): boolean =>
  corr.dLoad_p < NEUTRAL_LOAD_MODIFIER ||
  corr.dSet_p < 0 ||
  corr.dRpe_p < 0 ||
  corr.prefBias_p < 0;

/** Compose RPE action with objective completion reductions and beginner load clamp. */
const composeBlockBoundaryAction = (
  rpeAction: ControlAction,
  completionAction: ControlAction,
  profile: UserProfile,
  globalGuardrail: Guardrail | null,
): ControlAction => {
  if (globalGuardrail?.halt === true) {
    return neutralControlAction();
  }
  const corrections = {} as Record<MovementPattern, PatternCorrection>;
  for (const pattern of MOVEMENT_PATTERNS) {
    const base = rpeAction.corrections[pattern] ?? NEUTRAL_CORRECTION;
    const comp = completionAction.corrections[pattern] ?? NEUTRAL_CORRECTION;
    let dLoad = base.dLoad_p;
    let dSet = base.dSet_p;
    let dRpe = base.dRpe_p;
    let prefBias = base.prefBias_p;

    // Completion shortfall overrides any upward RPE headroom fieldwise.
    if (isReductionCorrection(comp)) {
      dLoad = Math.min(dLoad, comp.dLoad_p);
      dSet = Math.min(dSet, comp.dSet_p);
      dRpe = Math.min(dRpe, comp.dRpe_p);
      prefBias = Math.min(prefBias, comp.prefBias_p) as -1 | 0 | 1;
    }

    // Beginner upward-load clamp (AUDIT_2026-10-12:72): beginners never receive dLoad_p > 1.0.
    if (profile.training_age === 'beginner' && dLoad > NEUTRAL_LOAD_MODIFIER) {
      dLoad = NEUTRAL_LOAD_MODIFIER;
    }

    corrections[pattern] = {
      dLoad_p: snapToLiteral(dLoad, LOAD_MODIFIER_LITERALS),
      dSet_p: clampInt(dSet, -1, 1),
      dRpe_p: Math.round(Math.min(0.5, Math.max(-0.5, dRpe)) * 2) / 2,
      prefBias_p: clampInt(prefBias, -1, 1) as -1 | 0 | 1,
    };
  }

  const blockAddedSets = MOVEMENT_PATTERNS.reduce(
    (sum, pattern) => sum + Math.max(0, corrections[pattern].dSet_p),
    0,
  );
  const blockAddedRpe = round4(
    MOVEMENT_PATTERNS.reduce(
      (sum, pattern) => sum + Math.max(0, corrections[pattern].dRpe_p),
      0,
    ),
  );
  return { corrections, blockAddedSets, blockAddedRpe };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Deterministic substitution selector for an Avoid-promoted movement.
 * Wraps `computeSubstitutions` without duplicating tier, equipment, or joint rules.
 */
export function selectSubstitution(
  input: SelectSubstitutionInput,
): SelectedSubstitution {
  const projectedLibrary: SubstitutionMovement[] = input.library.map((item) => {
    const override = input.derivedPreferences[item.movement_id];
    return override !== undefined
      ? { ...item, preference: override }
      : { ...item };
  });

  const target = projectedLibrary.find(
    (item) => item.movement_id === input.targetMovementId,
  );
  if (target === undefined) {
    const emptyResult: SubstitutionResult = {
      layer1Regression: { color: SUBSTITUTION_COLORS.regression, options: [] },
      layer2DaySwap: { color: SUBSTITUTION_COLORS.day_swap, options: [] },
      layer3Triage: { color: SUBSTITUTION_COLORS.triage, cluster: null },
      blockedByGuardrail: [],
      haltAdvised: false,
    };
    return {
      kind: 'unresolvable',
      targetMovementId: input.targetMovementId,
      replacement: null,
      triage: null,
      substitutionResult: emptyResult,
    };
  }

  const substitutionResult = computeSubstitutions({
    target,
    library: projectedLibrary,
    inventory: input.inventory,
    niggles: input.upcomingBlockNiggles ?? [],
    futureSlots: [],
    currentDayIndex: 0,
    trainingAge: input.trainingAge,
    accessContext: input.accessContext ?? 'weight_room',
  });

  if (substitutionResult.haltAdvised) {
    return {
      kind: 'halt_advised',
      targetMovementId: input.targetMovementId,
      replacement: null,
      triage: null,
      substitutionResult,
    };
  }

  if (substitutionResult.layer1Regression.options.length > 0) {
    return {
      kind: 'layer1_regression',
      color: SUBSTITUTION_COLORS.regression,
      targetMovementId: input.targetMovementId,
      replacement: substitutionResult.layer1Regression.options[0],
      triage: null,
      substitutionResult,
    };
  }

  if (substitutionResult.layer3Triage.cluster !== null) {
    return {
      kind: 'layer3_triage',
      color: SUBSTITUTION_COLORS.triage,
      targetMovementId: input.targetMovementId,
      replacement: null,
      triage: substitutionResult.layer3Triage.cluster,
      substitutionResult,
    };
  }

  return {
    kind: 'unresolvable',
    targetMovementId: input.targetMovementId,
    replacement: null,
    triage: null,
    substitutionResult,
  };
}

/**
 * Evaluate the cross-block longitudinal autopilot overlay for the upcoming 4-week block.
 */
export function evaluateLongitudinalAutopilot(
  input: LongitudinalAutopilotInput,
): LongitudinalAutopilotResult {
  const initialMrv = {} as Record<MovementPattern, number>;
  for (const pattern of MOVEMENT_PATTERNS) {
    const raw = input.initialPatternMrvSets?.[pattern];
    initialMrv[pattern] =
      raw !== undefined && Number.isFinite(raw)
        ? clampInt(raw, LONGITUDINAL_MRV_MIN_SETS, LONGITUDINAL_MRV_MAX_SETS)
        : LONGITUDINAL_MRV_MAX_SETS;
  }

  if (!isValidLongitudinalAutopilotPolicy(input.policy)) {
    return {
      policyApplied: false,
      derivedPreferences: {},
      swapTriggerCounts: {},
      substitutions: {},
      patternMrvSets: defaultPatternMap(LONGITUDINAL_MRV_MAX_SETS),
      week3SetTrimByPattern: defaultPatternMap<0 | -1>(0),
      consecutiveWeek3OverreachByPattern: defaultPatternMap(0),
      consecutiveCleanHeadroomByPattern: defaultPatternMap(0),
      latestFlawReport: null,
      controlAction: neutralControlAction(),
      cumulativeMacrocycleRpeGranted: 0,
    };
  }

  const policy = input.policy;
  const triageMin = EXPERIENCE_SEVERITY[input.profile.training_age].triageMin;
  const libraryById = new Map<number, SubstitutionMovement>();
  for (const item of input.library) {
    libraryById.set(item.movement_id, item);
  }

  // -------------------------------------------------------------------------
  // Mechanism 1: Trailing-window `073` swap + joint-discomfort memory
  // -------------------------------------------------------------------------
  const trailingStart = Math.max(0, input.blocks.length - policy.swapWindowBlocks);
  const trailingBlocks = input.blocks.slice(trailingStart);
  const swapTriggerCounts: Record<number, number> = {};
  const jointCoupledSwapsByBlockAndPattern = new Map<string, number>();

  for (let bIdx = 0; bIdx < input.blocks.length; bIdx += 1) {
    const block = input.blocks[bIdx];
    const inTrailingWindow = bIdx >= trailingStart;
    const windowDateSet = new Set(block.windowDates);
    const operativeJoints = new Set<Joint>();
    for (const niggle of block.niggleRows) {
      if (!windowDateSet.has(niggle.date)) continue;
      if (niggle.severity >= triageMin) {
        operativeJoints.add(niggle.region);
      }
    }

    const seenSlotReplacements = new Set<string>();
    for (const swap of block.swapRecords ?? []) {
      if (swap.replacedBySessionPlanSlotId === swap.sessionPlanSlotId) continue;
      if (!windowDateSet.has(swap.sessionDate)) continue;

      const dedupeKey = `${block.blockSequence}|${swap.sessionDate}|${swap.sessionPlanSlotId}`;
      if (seenSlotReplacements.has(dedupeKey)) continue;
      seenSlotReplacements.add(dedupeKey);

      // Explicit non-pathological exclusion guard (equipment_busy, equipment-improvised, etc.)
      if (isNonPathologicalEquipmentSwap(swap)) continue;

      const movement = libraryById.get(swap.originalMovementId);
      const loadedJoints = movement?.joints ?? PATTERN_JOINTS[swap.pattern] ?? [];
      const hasOperativeJoint = loadedJoints.some((joint) => operativeJoints.has(joint));
      const isJointCoupled =
        (hasOperativeJoint &&
          (swap.cause === 'joint_discomfort' ||
            swap.sessionFeelReasonPain === 1 ||
            swap.cause === undefined)) ||
        (swap.cause === 'joint_discomfort' && loadedJoints.length > 0);

      if (!isJointCoupled) continue;

      const blockPatternKey = `${bIdx}|${swap.pattern}`;
      jointCoupledSwapsByBlockAndPattern.set(
        blockPatternKey,
        (jointCoupledSwapsByBlockAndPattern.get(blockPatternKey) ?? 0) + 1,
      );

      if (inTrailingWindow) {
        swapTriggerCounts[swap.originalMovementId] =
          (swapTriggerCounts[swap.originalMovementId] ?? 0) + 1;
      }
    }
  }
  void trailingBlocks;

  const derivedPreferences: Record<number, -1> = {};
  const promotedMovementIds = Object.keys(swapTriggerCounts)
    .map((key) => Number(key))
    .filter((id) => (swapTriggerCounts[id] ?? 0) >= policy.kTrigger)
    .sort((a, b) => a - b);

  for (const movementId of promotedMovementIds) {
    derivedPreferences[movementId] = MOVEMENT_PREFERENCE.AVOID;
  }

  const substitutions: Record<number, SelectedSubstitution> = {};
  for (const movementId of promotedMovementIds) {
    substitutions[movementId] = selectSubstitution({
      targetMovementId: movementId,
      library: input.library,
      derivedPreferences,
      inventory: input.inventory,
      trainingAge: input.profile.training_age,
      upcomingBlockNiggles: input.upcomingBlockNiggles ?? [],
      accessContext: input.accessContext ?? 'weight_room',
    });
  }

  // -------------------------------------------------------------------------
  // Mechanism 2: Bounded MRV_p in [1, 10], Week-3 Cadence Modulator, & Flaws
  // -------------------------------------------------------------------------
  const patternMrvSets = { ...initialMrv };
  const week3SetTrimByPattern = defaultPatternMap<0 | -1>(0);
  const overreachStreak = defaultPatternMap(0);
  const cleanHeadroomStreak = defaultPatternMap(0);

  const blockReports: FlawReport[] = [];
  const blockCompletionActions: ControlAction[] = [];

  for (let bIdx = 0; bIdx < input.blocks.length; bIdx += 1) {
    const block = input.blocks[bIdx];
    const patternWindow = buildPatternWindow(
      block.windowDates,
      block.setRows,
      block.niggleRows,
    );
    const guardrail = block.globalGuardrail ?? null;
    // Construct minimal length-preserving StateVector skeleton so descriptive fields
    // on StateVectorRow (acwr, readiness_score, ks_*) cannot influence detectFlaws.
    const sanitizedStateVectors: StateVectorRow[] = block.stateVectors.map((sv) => ({
      date: sv.date,
      readiness_score: 0,
      hrv_component: 0,
      load_component: 0,
      sleep_component: 0,
      spo2_component: 0,
      acwr: null,
      acute_load_kg: null,
      chronic_load_kg: null,
      ln_rmssd: null,
      hrv_z: null,
      sleep_efficiency_pct: null,
      spo2_night_mean: null,
      computed_at_ms: 0,
    }));

    const flawReport = detectFlaws(
      sanitizedStateVectors,
      patternWindow,
      input.profile.training_age,
      guardrail,
    );
    blockReports.push(flawReport);

    const completionWindow = buildCompletionWindow(
      block.windowDates,
      block.completionRows ?? [],
    );
    const completionAction =
      policy.completionPolicy !== null
        ? deriveCompletionAction(completionWindow, policy.completionPolicy)
        : neutralControlAction();
    blockCompletionActions.push(completionAction);

    const week3DateSet = new Set(resolveWeek3Dates(block));
    const week3CompletionSummaries =
      policy.completionPolicy !== null
        ? summarizeCompletionWindow(
            buildCompletionWindow(resolveWeek3Dates(block), block.completionRows ?? []),
          )
        : null;

    const restrictiveGlobal =
      guardrail !== null &&
      (guardrail.halt ||
        guardrail.load_multiplier < 1 ||
        guardrail.set_delta < 0 ||
        guardrail.rpe_cap_max < 10);

    for (const pattern of MOVEMENT_PATTERNS) {
      if (block.isSuspended === true) {
        overreachStreak[pattern] = 0;
        cleanHeadroomStreak[pattern] = 0;
        continue;
      }

      // Compute Week-3 set-weighted mean delta RPE for this pattern.
      let w3SumDelta = 0;
      let w3DeltaCount = 0;
      for (const row of block.setRows) {
        if (row.pattern !== pattern || !week3DateSet.has(row.date)) continue;
        if (row.deltaCount > 0 && Number.isFinite(row.sumDeltaRpe)) {
          w3SumDelta += row.sumDeltaRpe;
          w3DeltaCount += row.deltaCount;
        }
      }
      const w3MeanDelta = w3DeltaCount > 0 ? w3SumDelta / w3DeltaCount : null;
      const w3CompSummary = week3CompletionSummaries?.[pattern] ?? null;
      const w3CompOverreach =
        policy.completionPolicy !== null &&
        w3CompSummary !== null &&
        w3CompSummary.observationDays >= 1 &&
        w3CompSummary.meanShortfall !== null &&
        w3CompSummary.meanShortfall >= policy.completionPolicy.deficitThreshold;

      const flaw = flawReport.patterns[pattern];
      const compCorr = completionAction.corrections[pattern];

      const week3Overreach =
        (w3MeanDelta !== null && w3MeanDelta >= FLAW_DETECTION_CONSTANTS.THETA_DEFICIT) ||
        (flaw.flawClass === 'capacity_deficit' &&
          w3MeanDelta !== null &&
          w3MeanDelta > FLAW_DETECTION_CONSTANTS.DELTA) ||
        w3CompOverreach;

      const hadDeficit =
        flaw.flawClass === 'capacity_deficit' || isReductionCorrection(compCorr);

      if (hadDeficit) {
        const peakSets = block.peakPrescribedSetsByPattern?.[pattern];
        const contracted =
          peakSets !== undefined && Number.isFinite(peakSets)
            ? Math.min(patternMrvSets[pattern] - 1, Math.round(peakSets) - 1)
            : patternMrvSets[pattern] - 1;
        patternMrvSets[pattern] = clampInt(
          contracted,
          LONGITUDINAL_MRV_MIN_SETS,
          LONGITUDINAL_MRV_MAX_SETS,
        );
      }

      const swapsThisBlock =
        jointCoupledSwapsByBlockAndPattern.get(`${bIdx}|${pattern}`) ?? 0;

      const isCleanLatentHeadroom =
        !week3Overreach &&
        !restrictiveGlobal &&
        flaw.flawClass === 'latent_headroom' &&
        flaw.maxJointSev < triageMin &&
        !isReductionCorrection(compCorr) &&
        swapsThisBlock === 0;

      if (week3Overreach) {
        overreachStreak[pattern] += 1;
        cleanHeadroomStreak[pattern] = 0;
        if (overreachStreak[pattern] >= policy.mCadence) {
          week3SetTrimByPattern[pattern] = -1;
        }
      } else if (isCleanLatentHeadroom) {
        overreachStreak[pattern] = 0;
        cleanHeadroomStreak[pattern] += 1;
        if (cleanHeadroomStreak[pattern] >= policy.mClean) {
          week3SetTrimByPattern[pattern] = Math.min(
            0,
            week3SetTrimByPattern[pattern] + 1,
          ) as 0 | -1;
          patternMrvSets[pattern] = clampInt(
            patternMrvSets[pattern] + 1,
            LONGITUDINAL_MRV_MIN_SETS,
            LONGITUDINAL_MRV_MAX_SETS,
          );
          cleanHeadroomStreak[pattern] = 0;
        }
      } else {
        overreachStreak[pattern] = 0;
        cleanHeadroomStreak[pattern] = 0;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Upcoming Block Control Action & Macrocycle RPE Raise Envelope
  // -------------------------------------------------------------------------
  const macroGrantSlots = Math.floor(
    CONTROL_AUTHORITY.MAX_MACROCYCLE_RPE_RAISE / CONTROL_AUTHORITY.RPE_STEP,
  );
  const normalizedUpcomingMacroIdx = Number.isFinite(input.upcomingMacroBlockIndex)
    ? Math.max(1, Math.min(8, Math.round(input.upcomingMacroBlockIndex)))
    : macroGrantSlots + 1;

  // Walk backwards across historical blocks belonging to earlier positions
  // (< normalizedUpcomingMacroIdx) of the active macrocycle to accumulate already-issued RPE grants.
  const activeMacrocycleBlockIndices: number[] = [];
  let cursorUpperBound = normalizedUpcomingMacroIdx;
  for (let bIdx = input.blocks.length - 1; bIdx >= 0; bIdx -= 1) {
    const rawPos = input.blocks[bIdx].macroBlockIndex;
    const pos = Number.isFinite(rawPos) ? Math.max(1, Math.min(8, Math.round(rawPos))) : 1;
    if (pos < cursorUpperBound) {
      activeMacrocycleBlockIndices.unshift(bIdx);
      cursorUpperBound = pos;
    } else if (pos > cursorUpperBound) {
      // Crossed the previous macrocycle boundary (e.g., Block 8 of prior macrocycle).
      break;
    }
  }

  let priorMacrocycleRpeGranted = 0;
  for (const bIdx of activeMacrocycleBlockIndices) {
    const block = input.blocks[bIdx];
    if (block.isSuspended === true) continue;
    const pos = Math.max(1, Math.min(8, Math.round(block.macroBlockIndex)));
    const permittedThen =
      pos <= macroGrantSlots &&
      priorMacrocycleRpeGranted + CONTROL_AUTHORITY.RPE_STEP <=
        CONTROL_AUTHORITY.MAX_MACROCYCLE_RPE_RAISE;
    const historicalRpeAction = deriveControlAction(
      blockReports[bIdx],
      input.profile,
      input.upcomingMacroPhase,
      pos,
      permittedThen,
    );
    const historicalComposed = composeBlockBoundaryAction(
      historicalRpeAction,
      blockCompletionActions[bIdx],
      input.profile,
      block.globalGuardrail ?? null,
    );
    priorMacrocycleRpeGranted = round4(
      Math.min(
        CONTROL_AUTHORITY.MAX_MACROCYCLE_RPE_RAISE,
        priorMacrocycleRpeGranted + historicalComposed.blockAddedRpe,
      ),
    );
  }

  const latestFlawReport =
    blockReports.length > 0 ? blockReports[blockReports.length - 1] : null;
  const latestCompletionAction =
    blockCompletionActions.length > 0
      ? blockCompletionActions[blockCompletionActions.length - 1]
      : neutralControlAction();
  const latestGuardrail =
    input.blocks.length > 0
      ? (input.blocks[input.blocks.length - 1].globalGuardrail ?? null)
      : null;

  // Check if acute upcoming niggles cross halt threshold -> Halt supremacy.
  const haltMin = EXPERIENCE_SEVERITY[input.profile.training_age].haltMin;
  const acuteUpcomingHalt = (input.upcomingBlockNiggles ?? []).some(
    (niggle) => niggle.severity >= haltMin,
  );
  const effectiveGuardrail: Guardrail | null = acuteUpcomingHalt
    ? {
        load_multiplier: 1,
        set_delta: 0,
        rpe_cap_max: 10,
        halt: true,
        follow_up: null,
      }
    : latestGuardrail;

  let controlAction = neutralControlAction();
  if (latestFlawReport !== null && !acuteUpcomingHalt) {
    const rpeRaisePermitted =
      input.upcomingBlockSuspended !== true &&
      normalizedUpcomingMacroIdx <= macroGrantSlots &&
      priorMacrocycleRpeGranted + CONTROL_AUTHORITY.RPE_STEP <=
        CONTROL_AUTHORITY.MAX_MACROCYCLE_RPE_RAISE;

    const rawRpeAction = deriveControlAction(
      latestFlawReport,
      input.profile,
      input.upcomingMacroPhase,
      normalizedUpcomingMacroIdx,
      rpeRaisePermitted,
    );
    controlAction = composeBlockBoundaryAction(
      rawRpeAction,
      latestCompletionAction,
      input.profile,
      effectiveGuardrail,
    );
  }

  const cumulativeMacrocycleRpeGranted = round4(
    Math.min(
      CONTROL_AUTHORITY.MAX_MACROCYCLE_RPE_RAISE,
      priorMacrocycleRpeGranted + controlAction.blockAddedRpe,
    ),
  );

  return {
    policyApplied: true,
    derivedPreferences,
    swapTriggerCounts,
    substitutions,
    patternMrvSets,
    week3SetTrimByPattern,
    consecutiveWeek3OverreachByPattern: overreachStreak,
    consecutiveCleanHeadroomByPattern: cleanHeadroomStreak,
    latestFlawReport,
    controlAction,
    cumulativeMacrocycleRpeGranted,
  };
}

const lookupPattern = (
  movementId: number,
  movementPatternById:
    | ReadonlyMap<number, MovementPattern>
    | Readonly<Record<number, MovementPattern>>,
): MovementPattern | undefined => {
  if (movementPatternById instanceof Map) {
    return (movementPatternById as ReadonlyMap<number, MovementPattern>).get(movementId);
  }
  return (movementPatternById as Readonly<Record<number, MovementPattern>>)[movementId];
};

/**
 * Project a `LongitudinalAutopilotResult` onto a generated `BlockPlan` without
 * mutating the input plan:
 *   - Substitutes Avoid-promoted movements on non-deload sessions using their
 *     Layer 1 green regression when available and non-duplicating.
 *   - Enforces per-pattern `MRV_p` ceiling in `[1, 10]`.
 *   - Applies `-1` working-set trim on Week 3 (`week_index === 3`, non-deload,
 *     non-recovery) for patterns with active `week3SetTrimByPattern[p] === -1`.
 */
export function applyLongitudinalOverlayToBlockPlan(
  blockPlan: BlockPlan,
  movementPatternById:
    | ReadonlyMap<number, MovementPattern>
    | Readonly<Record<number, MovementPattern>>,
  overlay: LongitudinalAutopilotResult,
): BlockPlan {
  const cloneSlot = (slot: PlannedSlotPlan): PlannedSlotPlan => ({
    ...slot,
    ...(slot.applied_prefixes !== undefined
      ? { applied_prefixes: [...slot.applied_prefixes] }
      : {}),
    ...(slot.autopilotDelta !== undefined
      ? { autopilotDelta: { ...slot.autopilotDelta } }
      : {}),
  });

  if (!overlay.policyApplied) {
    return {
      ...blockPlan,
      sessions: blockPlan.sessions.map((session) => ({
        ...session,
        slots: session.slots.map(cloneSlot),
      })),
      warnings: [...blockPlan.warnings],
      autopilotAdjusted: [...blockPlan.autopilotAdjusted],
      timeBudget: {
        ...blockPlan.timeBudget,
        sessions: blockPlan.timeBudget.sessions.map((s) => ({
          ...s,
          trimmedSlotIndexes: [...s.trimmedSlotIndexes],
        })),
        conflicts: [...blockPlan.timeBudget.conflicts],
        alternatives: blockPlan.timeBudget.alternatives.map((a) => ({ ...a })),
      },
    };
  }

  const adjustedPatterns = new Set<string>(blockPlan.autopilotAdjusted);

  const sessions: PlannedSessionPlan[] = blockPlan.sessions.map((session) => {
    const isDeload = session.phase === 'deload';
    const usedIdsInSession = new Set<number>(session.slots.map((s) => s.movement_id));

    const slots: PlannedSlotPlan[] = session.slots.map((rawSlot) => {
      const slot = cloneSlot(rawSlot);
      let movementId = slot.movement_id;

      if (!isDeload) {
        const sub = overlay.substitutions[movementId];
        if (
          sub !== undefined &&
          sub.kind === 'layer1_regression' &&
          !usedIdsInSession.has(sub.replacement.movement_id)
        ) {
          usedIdsInSession.delete(movementId);
          movementId = sub.replacement.movement_id;
          usedIdsInSession.add(movementId);
          slot.movement_id = movementId;
        }
      }

      const pattern = lookupPattern(movementId, movementPatternById);
      if (pattern === undefined || pattern === 'locomotion') {
        return slot;
      }

      const ceiling = clampInt(
        overlay.patternMrvSets[pattern] ?? LONGITUDINAL_MRV_MAX_SETS,
        LONGITUDINAL_MRV_MIN_SETS,
        LONGITUDINAL_MRV_MAX_SETS,
      );

      let nextSets = clampInt(slot.sets, LONGITUDINAL_MRV_MIN_SETS, ceiling);
      if (
        !isDeload &&
        !blockPlan.recovery &&
        session.week_index === 3 &&
        overlay.week3SetTrimByPattern[pattern] === -1
      ) {
        nextSets = Math.max(LONGITUDINAL_MRV_MIN_SETS, nextSets - 1);
      }

      if (nextSets !== slot.sets) {
        slot.sets = nextSets;
        adjustedPatterns.add(pattern);
      }

      return slot;
    });

    return {
      ...session,
      slots,
    };
  });

  return {
    ...blockPlan,
    sessions,
    warnings: [...blockPlan.warnings],
    autopilotAdjusted: [...adjustedPatterns].sort(),
    timeBudget: {
      ...blockPlan.timeBudget,
      sessions: blockPlan.timeBudget.sessions.map((s) => ({
        ...s,
        trimmedSlotIndexes: [...s.trimmedSlotIndexes],
      })),
      conflicts: [...blockPlan.timeBudget.conflicts],
      alternatives: blockPlan.timeBudget.alternatives.map((a) => ({ ...a })),
    },
  };
}
