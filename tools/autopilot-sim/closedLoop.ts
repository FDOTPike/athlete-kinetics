import {
  CONTROL_AUTHORITY,
  DEFAULT_PROFILE,
  EXPERIENCE_SEVERITY,
  FLAW_DETECTION_CONSTANTS,
  MOVEMENT_PATTERNS,
  addDaysIso,
  buildPatternWindow,
  deriveControlAction,
  detectFlaws,
  generateBlock,
  macroPhaseOf,
  type BlockPlan,
  type ControlAction,
  type FlawReport,
  type GeneratorMovement,
  type Joint,
  type MovementPattern,
  type PatternCorrection,
  type StateVectorRow,
  type UserProfile,
  type WindowNiggleRow,
  type WindowSetRow,
} from '../../packages/inference/src';
import {
  type BanisterInitialStateOffset,
  type BanisterPlantParams,
  PLANT_SCALE,
} from './plantConstants';

export const SIMULATION_BLOCKS = 8;
export const DAYS_PER_BLOCK = 28;
export const OBSERVER_DAYS = 21;
export const SIMULATION_START_DATE = '2026-01-05';

export type TrajectoryClass =
  | 'converged_neutral'
  | 'thin_data_neutral'
  | 'safety_override_neutral'
  | 'authority_limited_neutral'
  | 'inactive_nonconverged'
  | 'limit_cycle'
  | 'ratchet_down'
  | 'ratchet_up'
  | 'saturated_down'
  | 'saturated_up'
  | 'mixed';

export interface NiggleScenario {
  region: Joint;
  severity: number;
}

export interface ClosedLoopConfig {
  id: string;
  plant: BanisterPlantParams;
  initialState: BanisterInitialStateOffset;
  seed: number;
  targetPattern?: MovementPattern;
  profile?: UserProfile;
  /** Normal production macro-cycle when absent; otherwise repeat this real template. */
  fixedMacroBlockIndex?: number;
  /** Real peak-shift input. Values > OVERREACH_ACWR move deload to week 1. */
  recentAcwr?: number | null;
  /** Non-positive telemetry alignment offset from the scheduled block end. */
  observerEndOffsetDays?: number;
  niggle?: NiggleScenario;
}

export interface AppliedPlanDelta {
  rpeDeltaTotal: number;
  setDeltaTotal: number;
  changedRpeSlots: number;
  positiveSetOccurrences: number;
  negativeSetOccurrences: number;
  rpeCapBindings: number;
  setFloorBindings: number;
}

export interface BlockRecord {
  block: number;
  macroBlockIndex: number;
  macroPhase: string;
  peakShifted: boolean;
  observerEndOffsetDays: number;
  phi: number;
  flawClass: string;
  observations: number;
  actionForNext: PatternCorrection;
  blockAddedSetsForNext: number;
  blockAddedRpeForNext: number;
  actionApplied: PatternCorrection;
  blockAddedSetsApplied: number;
  blockAddedRpeApplied: number;
  appliedPlanDelta: AppliedPlanDelta;
  targetBearingSets: number;
  eMaxBindings: number;
  actualRpeClampBindings: number;
  antiWindupBound: boolean;
  monotoneOverrideBlockedRaise: boolean;
  rpeBudgetBlockedRaise: boolean;
  macroScheduleBlockedRaise: boolean;
  perBlockRpeSelectionBlockedRaise: boolean;
}

export interface ClosedLoopResult {
  id: string;
  targetPattern: MovementPattern;
  blocks: readonly BlockRecord[];
  trajectory: TrajectoryClass;
  /** Diagnostic classification of corrections actually applied in each block. */
  appliedTrajectory: TrajectoryClass;
  firstThreePhiPeakToPeak: number;
  lastThreePhiPeakToPeak: number;
  nonNeutralActionBlocks: number;
  directionChanges: number;
  totalTargetBearingSets: number;
  totalEMaxBindings: number;
  totalActualRpeClampBindings: number;
  totalRpeCapBindings: number;
  totalSetFloorBindings: number;
  antiWindupBindingBlocks: number;
  monotoneOverrideBindingBlocks: number;
  rpeBudgetBindingBlocks: number;
  macroScheduleBindingBlocks: number;
  perBlockRpeSelectionBindingBlocks: number;
  block1AllPhiZero: boolean;
  block1AllCorrectionsNeutral: boolean;
}

interface PatternPlantState {
  fitness: number;
  fatigue: number;
}

interface BlockSimulationMetrics {
  targetBearingSets: number;
  eMaxBindings: number;
  actualRpeClampBindings: number;
}

const NEUTRAL_CORRECTION: PatternCorrection = {
  dLoad_p: 1,
  dSet_p: 0,
  dRpe_p: 0,
  prefBias_p: 0,
};

const movements: readonly GeneratorMovement[] = MOVEMENT_PATTERNS.map(
  (pattern, index): GeneratorMovement => ({
    movement_id: index + 1,
    name: `C3 ${pattern}`,
    pattern,
    is_compound: pattern !== 'isolation' && pattern !== 'locomotion',
    required: [],
    beginner_ok: false,
    sportTracking: false,
    capability_available_weight_room: true,
    capability_available_sport_conditioning: true,
  }),
);

const movementById = new Map(
  movements.map((movement) => [movement.movement_id, movement.pattern]),
);

const defaultProfile: UserProfile = {
  ...DEFAULT_PROFILE,
  objective: 'strength',
  base_rpe_cap: 9,
};

const clamp = (value: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, value));

const round6 = (value: number): number => Math.round(value * 1_000_000) / 1_000_000;

const peakToPeak = (values: readonly number[]): number =>
  values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);

const directionOf = (correction: PatternCorrection): -1 | 0 | 1 =>
  correction.dRpe_p < 0 ? -1 : correction.dRpe_p > 0 ? 1 : 0;

const makePrng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return (): number => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const makeGaussian = (seed: number): (() => number) => {
  const uniform = makePrng(seed);
  let spare: number | null = null;
  return (): number => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    const u1 = Math.max(Number.EPSILON, uniform());
    const u2 = uniform();
    const radius = Math.sqrt(-2 * Math.log(u1));
    const angle = 2 * Math.PI * u2;
    spare = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  };
};

const stateVector = (date: string, day: number): StateVectorRow => ({
  date,
  readiness_score: 50,
  hrv_component: 50,
  load_component: 50,
  sleep_component: 50,
  spo2_component: 50,
  acwr: null,
  acute_load_kg: null,
  chronic_load_kg: null,
  ln_rmssd: null,
  hrv_z: null,
  sleep_efficiency_pct: null,
  spo2_night_mean: null,
  computed_at_ms: day * 86_400_000,
});

const correctionFor = (
  action: ControlAction | null,
  pattern: MovementPattern,
): PatternCorrection =>
  action === null ? { ...NEUTRAL_CORRECTION } : action.corrections[pattern];

const planEntries = (
  plan: BlockPlan,
): ReadonlyMap<string, { sets: number; rpe: number }> => {
  const entries = new Map<string, { sets: number; rpe: number }>();
  for (const session of plan.sessions) {
    for (const slot of session.slots) {
      entries.set(`${session.session_date}|${slot.movement_id}`, {
        sets: slot.sets,
        rpe: slot.target_rpe,
      });
    }
  }
  return entries;
};

const comparePlanForPattern = (
  baseline: BlockPlan,
  adjusted: BlockPlan,
  pattern: MovementPattern,
  appliedCorrection: PatternCorrection,
  profile: UserProfile,
): AppliedPlanDelta => {
  const baselineEntries = planEntries(baseline);
  const adjustedEntries = planEntries(adjusted);
  const movement = movements.find((candidate) => candidate.pattern === pattern);
  if (movement === undefined) throw new Error(`Missing movement for ${pattern}`);

  let rpeDeltaTotal = 0;
  let setDeltaTotal = 0;
  let changedRpeSlots = 0;
  let positiveSetOccurrences = 0;
  let negativeSetOccurrences = 0;
  let rpeCapBindings = 0;
  let setFloorBindings = 0;

  for (const session of baseline.sessions) {
    const key = `${session.session_date}|${movement.movement_id}`;
    const base = baselineEntries.get(key);
    const actual = adjustedEntries.get(key);
    if (base === undefined || actual === undefined || session.phase === 'deload') continue;
    const rpeDelta = actual.rpe - base.rpe;
    const setDelta = actual.sets - base.sets;
    rpeDeltaTotal += rpeDelta;
    setDeltaTotal += setDelta;
    if (rpeDelta !== 0) changedRpeSlots += 1;
    if (setDelta > 0) positiveSetOccurrences += 1;
    if (setDelta < 0) negativeSetOccurrences += 1;
    if (
      appliedCorrection.dRpe_p > 0 &&
      rpeDelta === 0 &&
      base.rpe >= profile.base_rpe_cap
    ) {
      rpeCapBindings += 1;
    }
    if (appliedCorrection.dSet_p < 0 && setDelta === 0 && base.sets <= 1) {
      setFloorBindings += 1;
    }
  }

  return {
    rpeDeltaTotal: round6(rpeDeltaTotal),
    setDeltaTotal,
    changedRpeSlots,
    positiveSetOccurrences,
    negativeSetOccurrences,
    rpeCapBindings,
    setFloorBindings,
  };
};

const rawRaiseRequested = (
  report: FlawReport,
  pattern: MovementPattern,
): boolean => {
  const flaw = report.patterns[pattern];
  return (
    flaw.observations >= FLAW_DETECTION_CONSTANTS.MIN_OBSERVATIONS &&
    flaw.phi <= -CONTROL_AUTHORITY.DEADBAND
  );
};

const antiWindupWouldBind = (report: FlawReport): boolean => {
  let candidates = 0;
  for (const pattern of MOVEMENT_PATTERNS) {
    const flaw = report.patterns[pattern];
    if (
      flaw.observations >= FLAW_DETECTION_CONSTANTS.MIN_OBSERVATIONS &&
      flaw.phi <= -CONTROL_AUTHORITY.DEADBAND &&
      flaw.flawClass !== 'caution' &&
      flaw.maxJointSev === 0
    ) {
      candidates += 1;
    }
  }
  return candidates > CONTROL_AUTHORITY.MAX_ADDED_SETS;
};

const classifyTrajectory = (blocks: readonly BlockRecord[]): TrajectoryClass => {
  const directions = blocks.map((block) => directionOf(block.actionForNext));
  const lastFour = directions.slice(-4);
  const alternating =
    lastFour.length === 4 &&
    lastFour.every((direction) => direction !== 0) &&
    lastFour.slice(1).every((direction, index) => direction === -lastFour[index]);
  if (alternating) return 'limit_cycle';

  const lastThree = directions.slice(-3);
  const lastThreeBlocks = blocks.slice(-3);
  if (lastThree.every((direction) => direction === 0)) {
    if (
      lastThreeBlocks.every(
        (block) =>
          block.observations < FLAW_DETECTION_CONSTANTS.MIN_OBSERVATIONS,
      )
    ) {
      return 'thin_data_neutral';
    }
    if (
      lastThreeBlocks.some((block) => block.monotoneOverrideBlockedRaise)
    ) {
      return 'safety_override_neutral';
    }
    if (lastThreeBlocks.some((block) => block.rpeBudgetBlockedRaise)) {
      return 'authority_limited_neutral';
    }
    if (
      lastThreeBlocks.every(
        (block) => Math.abs(block.phi) < CONTROL_AUTHORITY.DEADBAND,
      )
    ) {
      return 'converged_neutral';
    }
    return 'inactive_nonconverged';
  }
  if (lastThree.every((direction) => direction === -1)) {
    const nonlinear = blocks.slice(-3).some(
      (block) =>
        block.eMaxBindings > 0 ||
        block.actualRpeClampBindings > 0 ||
        block.appliedPlanDelta.setFloorBindings > 0,
    );
    return nonlinear ? 'saturated_down' : 'ratchet_down';
  }
  if (lastThree.every((direction) => direction === 1)) {
    const nonlinear = blocks.slice(-3).some(
      (block) =>
        block.eMaxBindings > 0 ||
        block.actualRpeClampBindings > 0 ||
        block.appliedPlanDelta.rpeCapBindings > 0,
    );
    return nonlinear ? 'saturated_up' : 'ratchet_up';
  }
  return 'mixed';
};

/**
 * C6B timing diagnostic: classify the corrections actually applied during
 * blocks 6-8. `actionForNext` at the end of block 5 becomes `actionApplied`
 * in block 6, so this view includes the sixth macro grant slot without
 * changing the historical decision-boundary trajectory label.
 */
const classifyAppliedTrajectory = (
  blocks: readonly BlockRecord[],
): TrajectoryClass => {
  const directions = blocks.map((block) => directionOf(block.actionApplied));
  const lastFour = directions.slice(-4);
  const alternating =
    lastFour.length === 4 &&
    lastFour.every((direction) => direction !== 0) &&
    lastFour.slice(1).every(
      (direction, index) => direction === -lastFour[index],
    );
  if (alternating) return 'limit_cycle';

  const lastThree = directions.slice(-3);
  const appliedBlocks = blocks.slice(-3);
  const decisionBlocks = blocks.slice(-4, -1);
  if (lastThree.every((direction) => direction === 0)) {
    if (
      decisionBlocks.every(
        (block) =>
          block.observations < FLAW_DETECTION_CONSTANTS.MIN_OBSERVATIONS,
      )
    ) {
      return 'thin_data_neutral';
    }
    if (
      decisionBlocks.some((block) => block.monotoneOverrideBlockedRaise)
    ) {
      return 'safety_override_neutral';
    }
    if (decisionBlocks.some((block) => block.rpeBudgetBlockedRaise)) {
      return 'authority_limited_neutral';
    }
    if (
      decisionBlocks.every(
        (block) => Math.abs(block.phi) < CONTROL_AUTHORITY.DEADBAND,
      )
    ) {
      return 'converged_neutral';
    }
    return 'inactive_nonconverged';
  }
  if (lastThree.every((direction) => direction === -1)) {
    const nonlinear = appliedBlocks.some(
      (block) =>
        block.eMaxBindings > 0 ||
        block.actualRpeClampBindings > 0 ||
        block.appliedPlanDelta.setFloorBindings > 0,
    );
    return nonlinear ? 'saturated_down' : 'ratchet_down';
  }
  if (lastThree.every((direction) => direction === 1)) {
    const nonlinear = appliedBlocks.some(
      (block) =>
        block.eMaxBindings > 0 ||
        block.actualRpeClampBindings > 0 ||
        block.appliedPlanDelta.rpeCapBindings > 0,
    );
    return nonlinear ? 'saturated_up' : 'ratchet_up';
  }
  return 'mixed';
};

const countDirectionChanges = (blocks: readonly BlockRecord[]): number => {
  const nonzero = blocks
    .map((block) => directionOf(block.actionForNext))
    .filter((direction) => direction !== 0);
  let changes = 0;
  for (let index = 1; index < nonzero.length; index += 1) {
    if (nonzero[index] !== nonzero[index - 1]) changes += 1;
  }
  return changes;
};

const simulateBlock = (
  plan: BlockPlan,
  blockStartDay: number,
  targetPattern: MovementPattern,
  plant: BanisterPlantParams,
  states: Record<MovementPattern, PatternPlantState>,
  gaussian: () => number,
  setRows: WindowSetRow[],
  niggleRows: WindowNiggleRow[],
  niggle: NiggleScenario | undefined,
): BlockSimulationMetrics => {
  const sessionsByDay = new Map<number, BlockPlan['sessions'][number][]>();
  for (const session of plan.sessions) {
    const day = Math.round(
      (Date.parse(`${session.session_date}T00:00:00Z`) -
        Date.parse(`${plan.start_date}T00:00:00Z`)) /
        86_400_000,
    );
    const list = sessionsByDay.get(day) ?? [];
    list.push(session);
    sessionsByDay.set(day, list);
  }

  let targetBearingSets = 0;
  let eMaxBindings = 0;
  let actualRpeClampBindings = 0;
  const fitDecay = Math.exp(-1 / plant.TAU_FIT);
  const fatigueDecay = Math.exp(-1 / plant.TAU_FAT);

  for (let localDay = 0; localDay < DAYS_PER_BLOCK; localDay += 1) {
    const globalDay = blockStartDay + localDay;
    const date = addDaysIso(SIMULATION_START_DATE, globalDay);
    const sessions = sessionsByDay.get(localDay) ?? [];
    const dailyDose = new Map<MovementPattern, number>();

    for (const session of sessions) {
      for (const slot of session.slots) {
        const pattern = movementById.get(slot.movement_id);
        if (pattern === undefined) throw new Error(`Unknown movement ${slot.movement_id}`);
        const dose =
          (slot.sets / PLANT_SCALE.REFERENCE_SETS_PER_SLOT) *
          (slot.target_rpe / PLANT_SCALE.RPE_SCALE_MAX);
        dailyDose.set(pattern, (dailyDose.get(pattern) ?? 0) + dose);
      }
    }

    for (const pattern of MOVEMENT_PATTERNS) {
      const state = states[pattern];
      const dose = dailyDose.get(pattern) ?? 0;
      state.fitness = fitDecay * state.fitness + plant.K_FIT * dose;
      state.fatigue = fatigueDecay * state.fatigue + plant.K_FAT * dose;
    }

    for (const session of sessions) {
      for (const slot of session.slots) {
        const pattern = movementById.get(slot.movement_id);
        if (pattern === undefined) throw new Error(`Unknown movement ${slot.movement_id}`);
        const state = states[pattern];
        const capacity =
          plant.BASE_CAPACITY_RPE + state.fitness - state.fatigue;
        const noise = plant.SIGMA_RPE * gaussian();
        const rawActual =
          slot.target_rpe +
          plant.RPE_GAIN * (slot.target_rpe - capacity) +
          noise;
        const actual = clamp(
          rawActual,
          PLANT_SCALE.RPE_MIN,
          PLANT_SCALE.RPE_MAX,
        );
        const delta = actual - slot.target_rpe;
        if (pattern === targetPattern) {
          targetBearingSets += slot.sets;
          if (Math.abs(delta) >= FLAW_DETECTION_CONSTANTS.E_MAX) eMaxBindings += 1;
          if (rawActual < PLANT_SCALE.RPE_MIN || rawActual > PLANT_SCALE.RPE_MAX) {
            actualRpeClampBindings += 1;
          }
        }
        setRows.push({
          date,
          pattern,
          setCount: slot.sets,
          sumDeltaRpe: delta * slot.sets,
          deltaCount: slot.sets,
          sumAttenuation: slot.sets,
        });
      }
    }

    if (niggle !== undefined) {
      niggleRows.push({
        date,
        region: niggle.region,
        severity: niggle.severity,
      });
    }
  }

  return { targetBearingSets, eMaxBindings, actualRpeClampBindings };
};

export function runClosedLoop(config: ClosedLoopConfig): ClosedLoopResult {
  const profile = config.profile ?? defaultProfile;
  const targetPattern = config.targetPattern ?? 'squat';
  const observerEndOffsetDays = config.observerEndOffsetDays ?? 0;
  if (observerEndOffsetDays > 0 || observerEndOffsetDays < -7) {
    throw new Error('observerEndOffsetDays must be in [-7, 0]');
  }

  const gaussian = makeGaussian(config.seed);
  const states = {} as Record<MovementPattern, PatternPlantState>;
  for (const pattern of MOVEMENT_PATTERNS) {
    states[pattern] = {
      fitness: config.initialState.fitness,
      fatigue: config.initialState.fatigue,
    };
  }

  const setRows: WindowSetRow[] = [];
  const niggleRows: WindowNiggleRow[] = [];
  const records: BlockRecord[] = [];
  let previousReport: FlawReport | undefined;
  let previousAction: ControlAction | null = null;
  let block1AllPhiZero = false;
  let block1AllCorrectionsNeutral = false;

  for (let block = 1; block <= SIMULATION_BLOCKS; block += 1) {
    const blockStartDay = (block - 1) * DAYS_PER_BLOCK;
    const startDate = addDaysIso(SIMULATION_START_DATE, blockStartDay);
    const macroBlockIndex = config.fixedMacroBlockIndex ?? block;
    const input = {
      profile,
      movements,
      startDate,
      schemaType: 'LINEAR' as const,
      macroBlockIndex,
      recentAcwr: config.recentAcwr ?? null,
    };
    const baselinePlan = generateBlock(input);
    const plan =
      previousReport === undefined
        ? baselinePlan
        : generateBlock({ ...input, flawReport: previousReport });
    const actionApplied = correctionFor(previousAction, targetPattern);
    const appliedPlanDelta = comparePlanForPattern(
      baselinePlan,
      plan,
      targetPattern,
      actionApplied,
      profile,
    );
    const blockMetrics = simulateBlock(
      plan,
      blockStartDay,
      targetPattern,
      config.plant,
      states,
      gaussian,
      setRows,
      niggleRows,
      config.niggle,
    );
    if (blockMetrics.targetBearingSets === 0) {
      throw new Error(`${config.id}: block ${block} emitted no prescribed targets`);
    }

    const observerEndDay =
      blockStartDay + DAYS_PER_BLOCK - 1 + observerEndOffsetDays;
    const windowStartDay = observerEndDay - OBSERVER_DAYS + 1;
    const windowDates = Array.from(
      { length: OBSERVER_DAYS },
      (_, index) => addDaysIso(SIMULATION_START_DATE, windowStartDay + index),
    );
    const windowDateSet = new Set(windowDates);
    const projected = buildPatternWindow(
      windowDates,
      setRows.filter((row) => windowDateSet.has(row.date)),
      niggleRows.filter((row) => windowDateSet.has(row.date)),
    );
    const vectors = windowDates.map((date, index) =>
      stateVector(date, windowStartDay + index),
    );
    const report = detectFlaws(
      vectors,
      projected,
      profile.training_age,
      null,
    );
    if (block === 1) {
      block1AllPhiZero = MOVEMENT_PATTERNS.every(
        (pattern) => report.patterns[pattern].phi === 0,
      );
    }
    const nextMacroIndex =
      config.fixedMacroBlockIndex ?? Math.min(SIMULATION_BLOCKS, block + 1);
    const actionForNext = deriveControlAction(
      report,
      profile,
      macroPhaseOf(nextMacroIndex),
      nextMacroIndex,
    );
    if (block === 1) {
      block1AllCorrectionsNeutral = MOVEMENT_PATTERNS.every((pattern) => {
        const correction = actionForNext.corrections[pattern];
        return (
          correction.dLoad_p === 1 &&
          correction.dSet_p === 0 &&
          correction.dRpe_p === 0 &&
          correction.prefBias_p === 0
        );
      });
    }
    const flaw = report.patterns[targetPattern];
    const nextCorrection = actionForNext.corrections[targetPattern];
    const rawRaise = rawRaiseRequested(report, targetPattern);
    const restrictive =
      report.globalGuardrail !== null &&
      (report.globalGuardrail.load_multiplier < 1 ||
        report.globalGuardrail.set_delta < 0 ||
        report.globalGuardrail.rpe_cap_max < 10);
    const safetyWouldBlock =
      flaw.flawClass === 'caution' ||
      restrictive ||
      flaw.maxJointSev >= EXPERIENCE_SEVERITY[profile.training_age].triageMin;
    const blockedRaise =
      rawRaise && safetyWouldBlock && nextCorrection.dRpe_p <= 0;
    const macroGrantSlots = Math.floor(
      CONTROL_AUTHORITY.MAX_MACROCYCLE_RPE_RAISE /
        CONTROL_AUTHORITY.RPE_STEP,
    );
    const macroScheduleOpen = nextMacroIndex <= macroGrantSlots;
    const macroScheduleBlockedRaise =
      rawRaise && !safetyWouldBlock && !macroScheduleOpen;
    const perBlockRpeSelectionBlockedRaise =
      rawRaise &&
      !safetyWouldBlock &&
      macroScheduleOpen &&
      nextCorrection.dRpe_p <= 0;
    const rpeBudgetBlockedRaise =
      macroScheduleBlockedRaise || perBlockRpeSelectionBlockedRaise;

    records.push({
      block,
      macroBlockIndex,
      macroPhase: macroPhaseOf(macroBlockIndex),
      peakShifted: plan.peakShifted,
      observerEndOffsetDays,
      phi: flaw.phi,
      flawClass: flaw.flawClass,
      observations: flaw.observations,
      actionForNext: nextCorrection,
      blockAddedSetsForNext: actionForNext.blockAddedSets,
      blockAddedRpeForNext: actionForNext.blockAddedRpe,
      actionApplied,
      blockAddedSetsApplied: previousAction?.blockAddedSets ?? 0,
      blockAddedRpeApplied: previousAction?.blockAddedRpe ?? 0,
      appliedPlanDelta,
      targetBearingSets: blockMetrics.targetBearingSets,
      eMaxBindings: blockMetrics.eMaxBindings,
      actualRpeClampBindings: blockMetrics.actualRpeClampBindings,
      antiWindupBound: antiWindupWouldBind(report),
      monotoneOverrideBlockedRaise: blockedRaise,
      rpeBudgetBlockedRaise,
      macroScheduleBlockedRaise,
      perBlockRpeSelectionBlockedRaise,
    });

    previousReport = report;
    previousAction = actionForNext;
  }

  const phis = records.map((record) => record.phi);
  const directions = records.map((record) => directionOf(record.actionForNext));
  return {
    id: config.id,
    targetPattern,
    blocks: records,
    trajectory: classifyTrajectory(records),
    appliedTrajectory: classifyAppliedTrajectory(records),
    firstThreePhiPeakToPeak: round6(peakToPeak(phis.slice(0, 3))),
    lastThreePhiPeakToPeak: round6(peakToPeak(phis.slice(-3))),
    nonNeutralActionBlocks: directions.filter((direction) => direction !== 0).length,
    directionChanges: countDirectionChanges(records),
    totalTargetBearingSets: records.reduce(
      (sum, record) => sum + record.targetBearingSets,
      0,
    ),
    totalEMaxBindings: records.reduce(
      (sum, record) => sum + record.eMaxBindings,
      0,
    ),
    totalActualRpeClampBindings: records.reduce(
      (sum, record) => sum + record.actualRpeClampBindings,
      0,
    ),
    totalRpeCapBindings: records.reduce(
      (sum, record) => sum + record.appliedPlanDelta.rpeCapBindings,
      0,
    ),
    totalSetFloorBindings: records.reduce(
      (sum, record) => sum + record.appliedPlanDelta.setFloorBindings,
      0,
    ),
    antiWindupBindingBlocks: records.filter((record) => record.antiWindupBound).length,
    monotoneOverrideBindingBlocks: records.filter(
      (record) => record.monotoneOverrideBlockedRaise,
    ).length,
    rpeBudgetBindingBlocks: records.filter(
      (record) => record.rpeBudgetBlockedRaise,
    ).length,
    macroScheduleBindingBlocks: records.filter(
      (record) => record.macroScheduleBlockedRaise,
    ).length,
    perBlockRpeSelectionBindingBlocks: records.filter(
      (record) => record.perBlockRpeSelectionBlockedRaise,
    ).length,
    block1AllPhiZero,
    block1AllCorrectionsNeutral,
  };
}
