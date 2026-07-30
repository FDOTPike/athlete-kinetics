/**
 * C4/R1/R2 counterexample gate for the Kinematic Autopilot stability defect.
 *
 * C4 introduced seven XFAIL rows as evidence of a known open defect. R1 bounded
 * upward RPE consequence; R2 deliberately recomputes the observer expectations
 * under a phase-local trend and converts the same cases to exact expected PASS.
 * This gate asserts the ratified remediation targets, not universal stability.
 * Evidence: tools/autopilot-sim/REMEDIATION_R2_C6.md
 */

import {
  DEFAULT_PROFILE,
  type MovementPattern,
  type UserProfile,
} from '../src';
import {

  BANISTER_BASELINE,
  INITIAL_STATE_OFFSETS,
  type BanisterInitialStateOffset,
  type BanisterPlantParams,
} from '../../../tools/autopilot-sim/plantConstants';
import {
  type ClosedLoopConfig,
  type ClosedLoopResult,
  runClosedLoop,
} from '../../../tools/autopilot-sim/closedLoop';

type ActionName = 'neutral' | 'cut' | 'raise';

interface StationaryExpectedFailure {
  name: string;
  fixedMacroBlockIndex: number;
  plant: BanisterPlantParams;
  initialName: string;
  initialState: BanisterInitialStateOffset;
  phi: readonly number[];
  actions: readonly ActionName[];
}

const strengthProfile: UserProfile = {
  ...DEFAULT_PROFILE,
  objective: 'strength',
  base_rpe_cap: 9,
};

const gppProfile: UserProfile = {
  ...DEFAULT_PROFILE,
  objective: 'gpp',
  weekly_frequency: 4,
  base_rpe_cap: 9,
};

const hashSeed = (text: string): number => {
  let hash = 2_166_136_261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
};

const actionName = (value: number): ActionName =>
  value < 0 ? 'cut' : value > 0 ? 'raise' : 'neutral';

const phi4 = (result: ClosedLoopResult): readonly number[] =>
  result.blocks.map((block) => Math.round(block.phi * 10_000) / 10_000);

const actions = (result: ClosedLoopResult): readonly ActionName[] =>
  result.blocks.map((block) => actionName(block.actionForNext.dRpe_p));

const observations = (result: ClosedLoopResult): readonly number[] =>
  result.blocks.map((block) => block.observations);

const rpeCapBindings = (result: ClosedLoopResult): readonly number[] =>
  result.blocks.map((block) => block.appliedPlanDelta.rpeCapBindings);

const appliedRpeDelta = (result: ClosedLoopResult): readonly number[] =>
  result.blocks.map((block) => block.appliedPlanDelta.rpeDeltaTotal);

const same = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

let failed = 0;
let passes = 0;
let r2Conversions = 0;

const expectR2Conversion = (
  label: string,
  condition: boolean,
): void => {
  if (!condition) {
    failed += 1;
    console.error(`FAIL  R2 conversion: ${label}`);
    return;
  }
  r2Conversions += 1;
  passes += 1;
  console.log(`PASS  R2 conversion: ${label}`);
};

const expectPass = (label: string, condition: boolean): void => {
  if (!condition) {
    failed += 1;
    console.error(`FAIL  ${label}`);
    return;
  }
  passes += 1;
  console.log(`PASS  ${label}`);
};

const stationaryFailures: readonly StationaryExpectedFailure[] = [
  {
    name: 'stationary hypertrophy: plant 7/30/.3/.2 gain .25 sigma 1 neutral',
    fixedMacroBlockIndex: 3,
    plant: {
      ...BANISTER_BASELINE,
      TAU_FAT: 7,
      TAU_FIT: 30,
      K_FAT: 0.3,
      K_FIT: 0.2,
      RPE_GAIN: 0.25,
      SIGMA_RPE: 1,
    },
    initialName: 'neutral',
    initialState: INITIAL_STATE_OFFSETS.neutral,
    phi: [0.1224, 0.2707, -0.2988, -0.0359, -0.2852, 0.1708, -0.2871, 0.1911],
    actions: ['neutral', 'cut', 'raise', 'neutral', 'raise', 'cut', 'raise', 'cut'],
  },
  {
    name: 'stationary peak: plant 21/30/1/.05 gain .5 sigma .5 supercompensated',
    fixedMacroBlockIndex: 8,
    plant: {
      ...BANISTER_BASELINE,
      TAU_FAT: 21,
      TAU_FIT: 30,
      K_FAT: 1,
      K_FIT: 0.05,
      RPE_GAIN: 0.5,
      SIGMA_RPE: 0.5,
    },
    initialName: 'mid_supercompensation',
    initialState: INITIAL_STATE_OFFSETS.mid_supercompensation,
    phi: [0.103, 0.0208, 0.086, 0.1101, 0.1682, -0.2273, 0.1631, -0.2338],
    actions: ['neutral', 'neutral', 'neutral', 'neutral', 'cut', 'raise', 'cut', 'raise'],
  },
  {
    name: 'stationary peak: plant 21/30/1/.05 gain .75 sigma 1 neutral',
    fixedMacroBlockIndex: 8,
    plant: {
      ...BANISTER_BASELINE,
      TAU_FAT: 21,
      TAU_FIT: 30,
      K_FAT: 1,
      K_FIT: 0.05,
      RPE_GAIN: 0.75,
      SIGMA_RPE: 1,
    },
    initialName: 'neutral',
    initialState: INITIAL_STATE_OFFSETS.neutral,
    phi: [-0.1105, 0.4021, 0.4008, -0.0362, 0.3593, -0.2332, 0.2255, -0.1906],
    actions: ['neutral', 'cut', 'cut', 'neutral', 'cut', 'raise', 'cut', 'raise'],
  },
  {
    name: 'stationary peak: plant 21/30/1/.2 gain 1.25 sigma 1 supercompensated',
    fixedMacroBlockIndex: 8,
    plant: {
      ...BANISTER_BASELINE,
      TAU_FAT: 21,
      TAU_FIT: 30,
      K_FAT: 1,
      K_FIT: 0.2,
      RPE_GAIN: 1.25,
      SIGMA_RPE: 1,
    },
    initialName: 'mid_supercompensation',
    initialState: INITIAL_STATE_OFFSETS.mid_supercompensation,
    phi: [-0.206, 0.2665, -0.0153, 0.0299, 0.1806, -0.2612, 0.2511, -0.2571],
    actions: ['raise', 'cut', 'neutral', 'neutral', 'cut', 'raise', 'cut', 'raise'],
  },
  {
    name: 'stationary zero-noise peak: plant 21/60/1/.2 gain 1.5 neutral',
    fixedMacroBlockIndex: 8,
    plant: {
      ...BANISTER_BASELINE,
      TAU_FAT: 21,
      TAU_FIT: 60,
      K_FAT: 1,
      K_FIT: 0.2,
      RPE_GAIN: 1.5,
      SIGMA_RPE: 0,
    },
    initialName: 'neutral',
    initialState: INITIAL_STATE_OFFSETS.neutral,
    phi: [0.1337, 0.3264, -0.1649, 0.2336, -0.2289, 0.1812, -0.249, 0.1729],
    actions: ['neutral', 'cut', 'raise', 'cut', 'raise', 'cut', 'raise', 'cut'],
  },
  {
    name: 'stationary zero-noise peak: plant 21/60/1/.2 gain 1.5 deficit',
    fixedMacroBlockIndex: 8,
    plant: {
      ...BANISTER_BASELINE,
      TAU_FAT: 21,
      TAU_FIT: 60,
      K_FAT: 1,
      K_FIT: 0.2,
      RPE_GAIN: 1.5,
      SIGMA_RPE: 0,
    },
    initialName: 'mid_deficit',
    initialState: INITIAL_STATE_OFFSETS.mid_deficit,
    phi: [0.207, -0.0927, 0.1755, -0.2009, 0.2172, -0.2384, 0.1711, -0.2519],
    actions: ['cut', 'neutral', 'cut', 'raise', 'cut', 'raise', 'cut', 'raise'],
  },
];

const r2StationaryExpectations: readonly {
  trajectory: ClosedLoopResult['trajectory'];
  phi: readonly number[];
  actions: readonly ActionName[];
}[] = [
  {
    trajectory: 'authority_limited_neutral',
    phi: [0.2174, -0.0109, -0.2597, -0.1257, 0.2282, 0.0385, -0.2294, -0.2632],
    actions: ['cut', 'neutral', 'neutral', 'neutral', 'cut', 'neutral', 'neutral', 'neutral'],
  },
  {
    trajectory: 'converged_neutral',
    phi: [0.0764, -0.01, 0.005, -0.0061, -0.0018, -0.0953, -0.0541, 0.1183],
    actions: Array<ActionName>(8).fill('neutral'),
  },
  {
    trajectory: 'authority_limited_neutral',
    phi: [-0.0326, 0.1222, 0.126, 0.1046, 0.2397, -0.1542, 0.022, 0.0802],
    actions: ['neutral', 'neutral', 'neutral', 'neutral', 'cut', 'neutral', 'neutral', 'neutral'],
  },
  {
    trajectory: 'converged_neutral',
    phi: [0.1897, 0.0062, -0.1142, -0.0722, -0.0961, 0.0561, -0.1152, 0.1493],
    actions: ['cut', 'neutral', 'neutral', 'neutral', 'neutral', 'neutral', 'neutral', 'neutral'],
  },
  {
    trajectory: 'converged_neutral',
    phi: [-0.02, 0.0709, -0.037, -0.0366, -0.0359, -0.0353, -0.0349, -0.0346],
    actions: Array<ActionName>(8).fill('neutral'),
  },
  {
    trajectory: 'converged_neutral',
    phi: [-0.0252, 0.0728, -0.0373, -0.0367, -0.0359, -0.0353, -0.0349, -0.0346],
    actions: Array<ActionName>(8).fill('neutral'),
  },
];
const sourceFamily = (failure: StationaryExpectedFailure): string => {
  const plant = failure.plant;
  const cornerIndex =
    (plant.TAU_FAT === 21 ? 8 : 0) +
    (plant.TAU_FIT === 60 ? 4 : 0) +
    (plant.K_FAT === 1 ? 2 : 0) +
    (plant.K_FIT === 0.2 ? 1 : 0);
  return `corner_${String(cornerIndex).padStart(2, '0')}`;
};

const stationaryConfig = (
  failure: StationaryExpectedFailure,
  index: number,
): ClosedLoopConfig => {
  const sourceId = [
    sourceFamily(failure),
    `g${failure.plant.RPE_GAIN.toFixed(2)}`,
    `s${failure.plant.SIGMA_RPE.toFixed(2)}`,
    failure.initialName,
    'squat',
  ].join('|');
  return {
    id: `${sourceId}|c4_stationary_${index + 1}`,
    plant: failure.plant,
    initialState: failure.initialState,
    seed: hashSeed(sourceId),
    profile: strengthProfile,
    targetPattern: 'squat',
    fixedMacroBlockIndex: failure.fixedMacroBlockIndex,
    recentAcwr: null,
  };
};

const nominalSourceId = 'stable|g3.00|s0.00|neutral|squat';
const nominalConfig: ClosedLoopConfig = {
  id: `${nominalSourceId}|c4_nominal_saturation`,
  plant: { ...BANISTER_BASELINE, RPE_GAIN: 3, SIGMA_RPE: 0 },
  initialState: INITIAL_STATE_OFFSETS.neutral,
  seed: hashSeed(nominalSourceId),
  profile: strengthProfile,
  targetPattern: 'squat',
};

const overrideSourceId =
  'corner_00|g1.05|s1.00|mid_supercompensation|squat';
const overrideBase: ClosedLoopConfig = {
  id: overrideSourceId,
  plant: {
    ...BANISTER_BASELINE,
    TAU_FAT: 7,
    TAU_FIT: 30,
    K_FAT: 0.3,
    K_FIT: 0.05,
    RPE_GAIN: 1.05,
    SIGMA_RPE: 1,
  },
  initialState: INITIAL_STATE_OFFSETS.mid_supercompensation,
  seed: hashSeed(overrideSourceId),
  profile: strengthProfile,
  targetPattern: 'squat',
};

const healthyConfig: ClosedLoopConfig = {
  ...overrideBase,
  id: `${overrideSourceId}|c4_healthy`,
};

const niggleConfig: ClosedLoopConfig = {
  ...overrideBase,
  id: `${overrideSourceId}|c4_knee_niggle`,
  niggle: { region: 'knee', severity: 4 },
};

const lowFrequencyConfig = (
  targetPattern: MovementPattern,
): ClosedLoopConfig => {
  const id = `low_frequency|gpp4|${targetPattern}`;
  return {
    id,
    plant: { ...BANISTER_BASELINE, SIGMA_RPE: 0 },
    initialState: INITIAL_STATE_OFFSETS.neutral,
    seed: hashSeed(id),
    profile: gppProfile,
    targetPattern,
    fixedMacroBlockIndex: 3,
  };
};

const normalPeakAlignment: ClosedLoopConfig = {
  id: 'r2|alignment|peak_normal_deload_week4',
  plant: { ...BANISTER_BASELINE, SIGMA_RPE: 0 },
  initialState: INITIAL_STATE_OFFSETS.neutral,
  seed: hashSeed('r2|alignment|peak_normal_deload_week4'),
  profile: strengthProfile,
  targetPattern: 'squat',
  fixedMacroBlockIndex: 8,
  recentAcwr: null,
};

const shiftedPeakAlignment: ClosedLoopConfig = {
  ...normalPeakAlignment,
  id: 'r2|alignment|peak_shifted_deload_week1',
  seed: hashSeed('r2|alignment|peak_shifted_deload_week1'),
  recentAcwr: 2,
};
const configs: readonly ClosedLoopConfig[] = [
  ...stationaryFailures.map(stationaryConfig),
  nominalConfig,
  healthyConfig,
  niggleConfig,
  lowFrequencyConfig('carry'),
  lowFrequencyConfig('rotation'),
  normalPeakAlignment,
  shiftedPeakAlignment,
];

const firstRun = configs.map(runClosedLoop);
const secondRun = configs.map(runClosedLoop);

expectPass(
  'all C4 cases are deterministic across two complete runs',
  same(firstRun, secondRun),
);

for (let index = 0; index < stationaryFailures.length; index += 1) {
  const expected = stationaryFailures[index];
  const result = firstRun[index];
  if (expected === undefined || result === undefined) {
    throw new Error(`Missing stationary case ${index + 1}`);
  }
  const r2Expected = r2StationaryExpectations[index];
  if (r2Expected === undefined) throw new Error(`Missing R2 expectation ${index + 1}`);
  const resultActions = actions(result);
  expectR2Conversion(
    `${expected.name} -> ${result.trajectory} actions=[${resultActions.join(',')}]`,
    result.trajectory === r2Expected.trajectory &&
      same(phi4(result), r2Expected.phi) &&
      same(resultActions, r2Expected.actions) &&
      !resultActions.includes('raise') &&
      result.totalRpeCapBindings === 0 &&
      !same(phi4(result), expected.phi) &&
      !same(resultActions, expected.actions),
  );
}

const nominal = firstRun[stationaryFailures.length];
if (nominal === undefined) throw new Error('Missing nominal saturation case');
expectR2Conversion(
  `nominal gain-3 zero-noise saturation -> ${nominal.trajectory}`,
  nominal.trajectory === 'converged_neutral' &&
    same(phi4(nominal), [
      0.0179, -0.0104, -0.0307, -0.0296,
      -0.0283, -0.0298, -0.033, -0.0307,
    ]) &&
    same(actions(nominal), Array<ActionName>(8).fill('neutral')) &&
    same(rpeCapBindings(nominal), Array<number>(8).fill(0)) &&
    same(appliedRpeDelta(nominal), Array<number>(8).fill(0)) &&
    nominal.rpeBudgetBindingBlocks === 0,
);

const healthy = firstRun[stationaryFailures.length + 1];
const niggle = firstRun[stationaryFailures.length + 2];
if (healthy === undefined || niggle === undefined) {
  throw new Error('Missing paired safety-override cases');
}
expectPass(
  `R2 healthy/niggle pair exercises monotone override (healthy=${actions(healthy).join(',')})`,
  same(actions(healthy), [
    'raise', 'neutral', 'neutral', 'neutral',
    'neutral', 'neutral', 'cut', 'neutral',
  ]) &&
    same(actions(niggle), [
      'neutral', 'neutral', 'neutral', 'neutral',
      'neutral', 'neutral', 'cut', 'neutral',
    ]) &&
    healthy.rpeBudgetBindingBlocks === 4 &&
    niggle.monotoneOverrideBindingBlocks === 5 &&
    niggle.rpeBudgetBindingBlocks === 0,
);

for (let index = 0; index < 2; index += 1) {
  const result = firstRun[stationaryFailures.length + 3 + index];
  if (result === undefined) throw new Error(`Missing low-frequency case ${index}`);
  expectPass(
    `${result.targetPattern} obs=3 remains thin_data_neutral`,
    result.trajectory === 'thin_data_neutral' &&
      same(observations(result), Array<number>(8).fill(3)) &&
      same(actions(result), Array<ActionName>(8).fill('neutral')) &&
      same(phi4(result), Array<number>(8).fill(0)),
  );
}

const normalAlignment = firstRun[stationaryFailures.length + 5];
const shiftedAlignment = firstRun[stationaryFailures.length + 6];
if (normalAlignment === undefined || shiftedAlignment === undefined) {
  throw new Error('Missing R2 real-template alignment cases');
}
expectPass(
  'R2 normal peak week-4 deload settles inside deadband',
  normalAlignment.trajectory === 'converged_neutral' &&
    normalAlignment.blocks.every((block) => !block.peakShifted) &&
    same(phi4(normalAlignment), [
      -0.0296, -0.0357, -0.0343, -0.0329,
      -0.032, -0.0316, -0.0313, -0.0312,
    ]) &&
    same(actions(normalAlignment), Array<ActionName>(8).fill('neutral')),
);
expectPass(
  'R2 shifted peak week-1 deload settles neutral',
  shiftedAlignment.trajectory === 'converged_neutral' &&
    shiftedAlignment.blocks.every((block) => block.peakShifted) &&
    same(phi4(shiftedAlignment), Array<number>(8).fill(0)) &&
    same(actions(shiftedAlignment), Array<ActionName>(8).fill('neutral')),
);
if (failed > 0) {
  throw new Error(
    `C4 counterexample gate failed: ${failed} failed, ` +
      `${r2Conversions} R2 conversions, ${passes} passes`,
  );
}

console.log(
  `ALL CHECKS PASSED (${r2Conversions} R2 conversions, ${passes} expected PASS)`,
);
