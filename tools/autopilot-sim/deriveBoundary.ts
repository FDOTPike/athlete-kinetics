import {
  CONTROL_AUTHORITY,
  DEFAULT_PROFILE,
  FLAW_DETECTION_CONSTANTS,
  MOVEMENT_PATTERNS,
  buildPatternWindow,
  detectFlaws,
  generateBlock,
  type BlockPlan,
  type FlawClass,
  type FlawReport,
  type GeneratorMovement,
  type MovementPattern,
  type PatternFlaw,
  type StateVectorRow,
  type UserProfile,
  type WindowSetRow,
} from '../../packages/inference/src';
import { BANISTER_BASELINE, PLANT_SCALE } from './plantConstants';

type PlanPoint = {
  day: number;
  date: string;
  sets: number;
  rpe: number;
  dose: number;
};

type ResponsePoint = {
  day: number;
  observerIndex: number;
  deltaRpeTarget: number;
  deltaDose: number;
  deltaFitness: number;
  deltaFatigue: number;
  deltaCapacity: number;
  deltaErrorPerGain: number;
};

type ObserverResult = {
  dNorm: number;
  phiBase: number;
  eOld: number;
  eRecent: number;
  trendArgument: number;
  trend: number;
  phiRaw: number;
  phiRound4: number;
};

const DAY_MS = 86_400_000;
const START_DATE = '2026-01-05';
const PATTERN: MovementPattern = 'squat';
const OBSERVER_START_DAY = 7;
const OBSERVER_LENGTH = 21;

const movements: readonly GeneratorMovement[] = MOVEMENT_PATTERNS.map(
  (pattern, index): GeneratorMovement => ({
    movement_id: index + 1,
    name: `C2 ${pattern}`,
    pattern,
    is_compound: pattern !== 'isolation' && pattern !== 'locomotion',
    required: [],
    beginner_ok: false,
    sportTracking: false,
    capability_available_weight_room: true,
    capability_available_sport_conditioning: true,
  }),
);

const profile: UserProfile = {
  ...DEFAULT_PROFILE,
  objective: 'strength',
};

const addDaysIso = (iso: string, days: number): string => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

const daysBetween = (fromIso: string, toIso: string): number =>
  Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / DAY_MS);

const makeReport = (controlledPhi: number): FlawReport => {
  const patterns = {} as Record<MovementPattern, PatternFlaw>;
  const controlledClass: FlawClass =
    controlledPhi > 0 ? 'capacity_deficit' : 'latent_headroom';

  for (const pattern of MOVEMENT_PATTERNS) {
    const isControlled = pattern === PATTERN;
    patterns[pattern] = {
      pattern,
      phi: isControlled ? controlledPhi : 0,
      flawClass: isControlled ? controlledClass : 'neutral',
      observations: 21,
      maxJointSev: 0,
    };
  }

  return {
    patterns,
    windowSummary: {
      dominantFlaw: controlledClass,
      maxAbsPhi: Math.abs(controlledPhi),
      criticalPattern: PATTERN,
    },
    globalGuardrail: null,
  };
};

const planInput = {
  profile,
  movements,
  startDate: START_DATE,
  schemaType: 'LINEAR' as const,
  // Block 3 is the first hypertrophy macro phase. For the strength objective,
  // its first squat slot is the C1-audit canonical 4 sets @ RPE 7.5.
  macroBlockIndex: 3,
};

const baselinePlan = generateBlock(planInput);
const cutPlan = generateBlock({ ...planInput, flawReport: makeReport(0.2) });
const raisePlan = generateBlock({ ...planInput, flawReport: makeReport(-0.2) });

const planPoints = (plan: BlockPlan): readonly PlanPoint[] =>
  plan.sessions.flatMap((session) =>
    session.slots
      .filter((slot) => slot.movement_id === 1)
      .map((slot): PlanPoint => ({
        day: daysBetween(START_DATE, session.session_date),
        date: session.session_date,
        sets: slot.sets,
        rpe: slot.target_rpe,
        dose:
          (slot.sets / PLANT_SCALE.REFERENCE_SETS_PER_SLOT) *
          (slot.target_rpe / PLANT_SCALE.RPE_SCALE_MAX),
      })),
  );

const baselinePoints = planPoints(baselinePlan);
const cutPoints = planPoints(cutPlan);
const raisePoints = planPoints(raisePlan);

const pointByDay = (points: readonly PlanPoint[]): ReadonlyMap<number, PlanPoint> =>
  new Map(points.map((point) => [point.day, point]));

const baselineByDay = pointByDay(baselinePoints);

const deriveResponse = (correctedPoints: readonly PlanPoint[]): readonly ResponsePoint[] => {
  const correctedByDay = pointByDay(correctedPoints);
  const fitDecay = Math.exp(-1 / BANISTER_BASELINE.TAU_FIT);
  const fatigueDecay = Math.exp(-1 / BANISTER_BASELINE.TAU_FAT);
  let deltaFitness = 0;
  let deltaFatigue = 0;
  const response: ResponsePoint[] = [];

  for (let day = 0; day < 28; day += 1) {
    const baseline = baselineByDay.get(day);
    const corrected = correctedByDay.get(day);
    const baselineDose = baseline?.dose ?? 0;
    const correctedDose = corrected?.dose ?? 0;
    const deltaDose = correctedDose - baselineDose;

    deltaFitness =
      fitDecay * deltaFitness + BANISTER_BASELINE.K_FIT * deltaDose;
    deltaFatigue =
      fatigueDecay * deltaFatigue + BANISTER_BASELINE.K_FAT * deltaDose;
    const deltaCapacity = deltaFitness - deltaFatigue;

    if (day >= OBSERVER_START_DAY && baseline !== undefined && corrected !== undefined) {
      const deltaRpeTarget = corrected.rpe - baseline.rpe;
      response.push({
        day,
        observerIndex: day - OBSERVER_START_DAY,
        deltaRpeTarget,
        deltaDose,
        deltaFitness,
        deltaFatigue,
        deltaCapacity,
        deltaErrorPerGain: deltaRpeTarget - deltaCapacity,
      });
    }
  }

  return response;
};

const cutResponse = deriveResponse(cutPoints);
const raiseResponse = deriveResponse(raisePoints);

const signedClip = (value: number, magnitude: number): number =>
  Math.max(-magnitude, Math.min(magnitude, value));

const mean = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const round4 = (value: number): number => Math.round(value * 10_000) / 10_000;

const independentObserver = (
  response: readonly ResponsePoint[],
  rpeGain: number,
): ObserverResult => {
  const {
    LAMBDA,
    E_MAX,
    DELTA,
    W_BASE,
    W_TREND,
    T_SCALE,
  } = FLAW_DETECTION_CONSTANTS;
  const errorByIndex = new Map(
    response.map((point) => [
      point.observerIndex,
      rpeGain * point.deltaErrorPerGain,
    ]),
  );
  const sMax = (1 - Math.pow(LAMBDA, OBSERVER_LENGTH)) / (1 - LAMBDA);
  let signedAccumulator = 0;

  for (let index = 0; index < OBSERVER_LENGTH; index += 1) {
    const error = errorByIndex.get(index);
    if (error === undefined) continue;
    signedAccumulator +=
      Math.pow(LAMBDA, OBSERVER_LENGTH - 1 - index) *
      signedClip(error, E_MAX);
  }

  const dNorm = signedAccumulator / (E_MAX * sMax);
  const phiBase = Math.abs(dNorm) < DELTA ? 0 : dNorm;
  const oldErrors = response
    .filter((point) => point.observerIndex <= 6)
    .map((point) => rpeGain * point.deltaErrorPerGain);
  const recentErrors = response
    .filter((point) => point.observerIndex >= 14)
    .map((point) => rpeGain * point.deltaErrorPerGain);
  const eOld = mean(oldErrors);
  const eRecent = mean(recentErrors);
  const trendArgument = (eRecent - eOld) / T_SCALE;
  const trend = Math.tanh(trendArgument);
  const phiRaw = W_BASE * phiBase + W_TREND * trend;

  return {
    dNorm,
    phiBase,
    eOld,
    eRecent,
    trendArgument,
    trend,
    phiRaw,
    phiRound4: round4(phiRaw),
  };
};

const stateVectors: readonly StateVectorRow[] = Array.from(
  { length: OBSERVER_LENGTH },
  (_, index): StateVectorRow => ({
    date: addDaysIso(START_DATE, OBSERVER_START_DAY + index),
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
    computed_at_ms: 0,
  }),
);

const shippedObserverPhi = (
  response: readonly ResponsePoint[],
  rpeGain: number,
): number => {
  const setRows: readonly WindowSetRow[] = response.map(
    (point): WindowSetRow => ({
      date: addDaysIso(START_DATE, point.day),
      pattern: PATTERN,
      setCount: 1,
      sumDeltaRpe: rpeGain * point.deltaErrorPerGain,
      deltaCount: 1,
      sumAttenuation: 1,
    }),
  );
  const projected = buildPatternWindow(
    stateVectors.map((row) => row.date),
    setRows,
    [],
  );
  return detectFlaws(
    stateVectors,
    projected,
    profile.training_age,
    null,
  ).patterns[PATTERN].phi;
};

const trendOnlyActivationGain = (
  response: readonly ResponsePoint[],
): number => {
  const oldPerGain = mean(
    response
      .filter((point) => point.observerIndex <= 6)
      .map((point) => point.deltaErrorPerGain),
  );
  const recentPerGain = mean(
    response
      .filter((point) => point.observerIndex >= 14)
      .map((point) => point.deltaErrorPerGain),
  );
  const trendSlopeMagnitude = Math.abs(recentPerGain - oldPerGain);
  const relayRatio =
    CONTROL_AUTHORITY.DEADBAND / FLAW_DETECTION_CONSTANTS.W_TREND;
  return (
    Math.atanh(relayRatio) *
    FLAW_DETECTION_CONSTANTS.T_SCALE /
    trendSlopeMagnitude
  );
};

const observationIndices = cutResponse.map((point) => point.observerIndex);
const sMax =
  (1 - Math.pow(FLAW_DETECTION_CONSTANTS.LAMBDA, OBSERVER_LENGTH)) /
  (1 - FLAW_DETECTION_CONSTANTS.LAMBDA);
const observedWeightSum = observationIndices.reduce(
  (sum, index) =>
    sum +
    Math.pow(
      FLAW_DETECTION_CONSTANTS.LAMBDA,
      OBSERVER_LENGTH - 1 - index,
    ),
  0,
);
const saturatedBaseMagnitude = observedWeightSum / sMax;
const saturatedCutPhiLimit =
  -FLAW_DETECTION_CONSTANTS.W_BASE * saturatedBaseMagnitude +
  FLAW_DETECTION_CONSTANTS.W_TREND;
const saturatedRaisePhiLimit =
  FLAW_DETECTION_CONSTANTS.W_BASE * saturatedBaseMagnitude -
  FLAW_DETECTION_CONSTANTS.W_TREND;

const gains = [
  0.25,
  trendOnlyActivationGain(cutResponse),
  trendOnlyActivationGain(raiseResponse),
  BANISTER_BASELINE.RPE_GAIN,
  6,
];

const comparison = gains.map((gain) => {
  const cutIndependent = independentObserver(cutResponse, gain);
  const raiseIndependent = independentObserver(raiseResponse, gain);
  const cutShipped = shippedObserverPhi(cutResponse, gain);
  const raiseShipped = shippedObserverPhi(raiseResponse, gain);
  return {
    gain,
    cut: {
      independent: cutIndependent,
      shippedPhi: cutShipped,
      agrees: cutIndependent.phiRound4 === cutShipped,
    },
    raise: {
      independent: raiseIndependent,
      shippedPhi: raiseShipped,
      agrees: raiseIndependent.phiRound4 === raiseShipped,
    },
  };
});

if (
  comparison.some(
    (entry) => !entry.cut.agrees || !entry.raise.agrees,
  )
) {
  throw new Error('Independent observer evaluation disagrees with shipped detectFlaws');
}

console.log(
  JSON.stringify(
    {
      commandPurpose:
        'C2 two-channel analytic response; no closed-loop parameter sweep',
      controller: {
        lambda: FLAW_DETECTION_CONSTANTS.LAMBDA,
        observerDeadband: FLAW_DETECTION_CONSTANTS.DELTA,
        relayDeadband: CONTROL_AUTHORITY.DEADBAND,
        wBase: FLAW_DETECTION_CONSTANTS.W_BASE,
        wTrend: FLAW_DETECTION_CONSTANTS.W_TREND,
        tScale: FLAW_DETECTION_CONSTANTS.T_SCALE,
        eMax: FLAW_DETECTION_CONSTANTS.E_MAX,
        sMax,
      },
      plant: BANISTER_BASELINE,
      template: {
        profile: {
          objective: profile.objective,
          weeklyFrequency: profile.weekly_frequency,
          trainingAge: profile.training_age,
        },
        schemaType: planInput.schemaType,
        macroBlockIndex: planInput.macroBlockIndex,
        pattern: PATTERN,
        baseline: baselinePoints,
        cut: cutPoints,
        raise: raisePoints,
      },
      twoChannelResponse: {
        cut: cutResponse,
        raise: raiseResponse,
      },
      relayActivation: {
        atanhDeadbandRatio: Math.atanh(
          CONTROL_AUTHORITY.DEADBAND /
            FLAW_DETECTION_CONSTANTS.W_TREND,
        ),
        cutGain: trendOnlyActivationGain(cutResponse),
        raiseGain: trendOnlyActivationGain(raiseResponse),
      },
      independentVsShipped: comparison,
      oneStepReversal: {
        requiredCutResponse: -2 * CONTROL_AUTHORITY.DEADBAND,
        requiredRaiseResponse: 2 * CONTROL_AUTHORITY.DEADBAND,
        observedAtBaselineGain: {
          cut: independentObserver(
            cutResponse,
            BANISTER_BASELINE.RPE_GAIN,
          ).phiRound4,
          raise: independentObserver(
            raiseResponse,
            BANISTER_BASELINE.RPE_GAIN,
          ).phiRound4,
        },
      },
      saturatedObserverLimit: {
        observationIndices,
        observedWeightSum,
        normalizedObservedWeight: saturatedBaseMagnitude,
        cutPhi: saturatedCutPhiLimit,
        raisePhi: saturatedRaisePhiLimit,
      },
    },
    null,
    2,
  ),
);
