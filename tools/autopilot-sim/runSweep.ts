import {
  DEFAULT_PROFILE,
  type MovementPattern,
  type UserProfile,
} from '../../packages/inference/src';
import {
  BANISTER_ARCHETYPES,
  BANISTER_BASELINE,
  INITIAL_STATE_OFFSETS,
  PRIMARY_SWEEP_ENVELOPE,
  type BanisterInitialStateOffset,
  type BanisterPlantParams,
} from './plantConstants';
import {
  type ClosedLoopConfig,
  type ClosedLoopResult,
  runClosedLoop,
} from './closedLoop';

const GAIN_GRID = [
  0.25, 0.5, 0.75, 0.9, 0.95, 1, 1.05, 1.1,
  1.25, 1.5, 2, 2.5, 3, 4.5, 6,
] as const;

const NOISE_GRID = [0, 0.5, 1] as const;

const INITIAL_STATES: readonly {
  name: string;
  value: BanisterInitialStateOffset;
}[] = [
  { name: 'neutral', value: INITIAL_STATE_OFFSETS.neutral },
  { name: 'mid_deficit', value: INITIAL_STATE_OFFSETS.mid_deficit },
  {
    name: 'mid_supercompensation',
    value: INITIAL_STATE_OFFSETS.mid_supercompensation,
  },
];

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

const gainLabel = (gain: number): string => gain.toFixed(2);
const noiseLabel = (noise: number): string => noise.toFixed(2);

const makeConfig = (
  family: string,
  plant: BanisterPlantParams,
  initialName: string,
  initialState: BanisterInitialStateOffset,
  targetPattern: MovementPattern = 'squat',
): ClosedLoopConfig => {
  const id = [
    family,
    `g${gainLabel(plant.RPE_GAIN)}`,
    `s${noiseLabel(plant.SIGMA_RPE)}`,
    initialName,
    targetPattern,
  ].join('|');
  return {
    id,
    plant,
    initialState,
    targetPattern,
    profile: strengthProfile,
    seed: hashSeed(id),
  };
};

const cornerValues = <T>(min: T, max: T): readonly [T, T] => [min, max];

const primaryConfigs: ClosedLoopConfig[] = [];
let cornerIndex = 0;
for (const tauFat of cornerValues(
  PRIMARY_SWEEP_ENVELOPE.TAU_FAT.min,
  PRIMARY_SWEEP_ENVELOPE.TAU_FAT.max,
)) {
  for (const tauFit of cornerValues(
    PRIMARY_SWEEP_ENVELOPE.TAU_FIT.min,
    PRIMARY_SWEEP_ENVELOPE.TAU_FIT.max,
  )) {
    for (const kFat of cornerValues(
      PRIMARY_SWEEP_ENVELOPE.K_FAT.min,
      PRIMARY_SWEEP_ENVELOPE.K_FAT.max,
    )) {
      for (const kFit of cornerValues(
        PRIMARY_SWEEP_ENVELOPE.K_FIT.min,
        PRIMARY_SWEEP_ENVELOPE.K_FIT.max,
      )) {
        const family = `corner_${String(cornerIndex).padStart(2, '0')}`;
        cornerIndex += 1;
        for (const gain of GAIN_GRID) {
          for (const sigma of NOISE_GRID) {
            for (const initial of INITIAL_STATES) {
              primaryConfigs.push(
                makeConfig(
                  family,
                  {
                    ...BANISTER_BASELINE,
                    TAU_FAT: tauFat,
                    TAU_FIT: tauFit,
                    K_FAT: kFat,
                    K_FIT: kFit,
                    RPE_GAIN: gain,
                    SIGMA_RPE: sigma,
                  },
                  initial.name,
                  initial.value,
                ),
              );
            }
          }
        }
      }
    }
  }
}

for (const gain of GAIN_GRID) {
  for (const sigma of NOISE_GRID) {
    for (const initial of INITIAL_STATES) {
      primaryConfigs.push(
        makeConfig(
          'stable',
          { ...BANISTER_BASELINE, RPE_GAIN: gain, SIGMA_RPE: sigma },
          initial.name,
          initial.value,
        ),
      );
    }
  }
}

for (const archetypeName of ['overreach', 'adapting'] as const) {
  const archetype = BANISTER_ARCHETYPES[archetypeName];
  for (const gain of GAIN_GRID) {
    for (const initial of INITIAL_STATES) {
      primaryConfigs.push(
        makeConfig(
          archetypeName,
          { ...archetype, RPE_GAIN: gain },
          initial.name,
          initial.value,
        ),
      );
    }
  }
}

const runAll = (configs: readonly ClosedLoopConfig[]): readonly ClosedLoopResult[] =>
  configs.map((config) => runClosedLoop(config));

const firstResults = runAll(primaryConfigs);
const secondResults = runAll(primaryConfigs);
if (JSON.stringify(firstResults) !== JSON.stringify(secondResults)) {
  throw new Error('Seeded primary sweep is not deep-equal across two runs');
}

const resultById = new Map(firstResults.map((result) => [result.id, result]));
const configById = new Map(primaryConfigs.map((config) => [config.id, config]));

const findResult = (
  family: string,
  gain: number,
  sigma: number,
  initial: string,
  pattern: MovementPattern = 'squat',
): ClosedLoopResult => {
  const id = [
    family,
    `g${gainLabel(gain)}`,
    `s${noiseLabel(sigma)}`,
    initial,
    pattern,
  ].join('|');
  const result = resultById.get(id);
  if (result === undefined) throw new Error(`Missing sweep result ${id}`);
  return result;
};

const sentinel = firstResults.find(
  (result) =>
    result.blocks.some((block) => block.phi !== 0) &&
    result.nonNeutralActionBlocks > 0,
);
if (sentinel === undefined) {
  throw new Error(
    'R2 sentinel found no observer signal with a control response; sweep would measure nothing',
  );
}

const actionSymbol = (value: number): string =>
  value < 0 ? 'cut' : value > 0 ? 'raise' : 'neutral';

const compactTable = (result: ClosedLoopResult): object => ({
  id: result.id,
  trajectory: result.trajectory,
  phi: result.blocks.map((block) => block.phi),
  actionForNext: result.blocks.map((block) =>
    actionSymbol(block.actionForNext.dRpe_p),
  ),
  blockAddedRpeForNext: result.blocks.map((block) => block.blockAddedRpeForNext),
  observations: result.blocks.map((block) => block.observations),
  appliedSetDelta: result.blocks.map(
    (block) => block.appliedPlanDelta.setDeltaTotal,
  ),
  appliedRpeDelta: result.blocks.map(
    (block) => block.appliedPlanDelta.rpeDeltaTotal,
  ),
  eMaxBindings: result.blocks.map((block) => block.eMaxBindings),
  actualRpeClampBindings: result.blocks.map(
    (block) => block.actualRpeClampBindings,
  ),
  rpeCapBindings: result.blocks.map(
    (block) => block.appliedPlanDelta.rpeCapBindings,
  ),
  antiWindupBound: result.blocks.map((block) => block.antiWindupBound),
  rpeBudgetBlockedRaise: result.blocks.map(
    (block) => block.rpeBudgetBlockedRaise,
  ),
  macroScheduleBlockedRaise: result.blocks.map(
    (block) => block.macroScheduleBlockedRaise,
  ),
  perBlockRpeSelectionBlockedRaise: result.blocks.map(
    (block) => block.perBlockRpeSelectionBlockedRaise,
  ),
  firstThreePhiPeakToPeak: result.firstThreePhiPeakToPeak,
  lastThreePhiPeakToPeak: result.lastThreePhiPeakToPeak,
});

const classificationCounts: Record<string, number> = {};
const appliedClassificationCounts: Record<string, number> = {};
for (const result of firstResults) {
  classificationCounts[result.trajectory] =
    (classificationCounts[result.trajectory] ?? 0) + 1;
  appliedClassificationCounts[result.appliedTrajectory] =
    (appliedClassificationCounts[result.appliedTrajectory] ?? 0) + 1;
}

const resultEvidence = (result: ClosedLoopResult): object => {
  const config = configById.get(result.id);
  if (config === undefined) throw new Error('Missing evidence config ' + result.id);
  return {
    plant: config.plant,
    initialState: config.initialState,
    table: compactTable(result),
  };
};

const countLabels = (labels: readonly string[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const label of labels) counts[label] = (counts[label] ?? 0) + 1;
  return Object.fromEntries(
    Object.entries(counts).sort(
      ([leftLabel, leftCount], [rightLabel, rightCount]) =>
        rightCount - leftCount || leftLabel.localeCompare(rightLabel),
    ),
  );
};

const actionComposition = (result: ClosedLoopResult): string => {
  const directions = result.blocks.map((block) =>
    Math.sign(block.actionForNext.dRpe_p),
  );
  const hasRaise = directions.some((direction) => direction > 0);
  const hasCut = directions.some((direction) => direction < 0);
  if (hasRaise && hasCut) return 'raise_and_cut';
  if (hasRaise) return 'raise_only';
  if (hasCut) return 'cut_only';
  return 'neutral_only';
};

const summarizePopulation = (
  results: readonly ClosedLoopResult[],
  evidenceLimit: number,
): object => ({
  cases: results.length,
  byFamily: countLabels(
    results.map((result) => result.id.split('|')[0] ?? 'unknown'),
  ),
  byGain: countLabels(
    results.map((result) => {
      const config = configById.get(result.id);
      if (config === undefined) throw new Error('Missing population config ' + result.id);
      return gainLabel(config.plant.RPE_GAIN);
    }),
  ),
  byNoise: countLabels(
    results.map((result) => {
      const config = configById.get(result.id);
      if (config === undefined) throw new Error('Missing population config ' + result.id);
      return noiseLabel(config.plant.SIGMA_RPE);
    }),
  ),
  byInitialState: countLabels(
    results.map((result) => result.id.split('|')[3] ?? 'unknown'),
  ),
  byActionComposition: countLabels(results.map(actionComposition)),
  byLastThreeActions: countLabels(
    results.map((result) =>
      result.blocks
        .slice(-3)
        .map((block) => actionSymbol(block.actionForNext.dRpe_p))
        .join(','),
    ),
  ),
  byDirectionChanges: countLabels(
    results.map((result) => String(result.directionChanges)),
  ),
  casesWithRpeBudgetBinding: results.filter(
    (result) => result.rpeBudgetBindingBlocks > 0,
  ).length,
  casesWithMacroScheduleBinding: results.filter(
    (result) => result.macroScheduleBindingBlocks > 0,
  ).length,
  casesWithPerBlockRpeSelectionBinding: results.filter(
    (result) => result.perBlockRpeSelectionBindingBlocks > 0,
  ).length,
  casesWithEMaxBinding: results.filter(
    (result) => result.totalEMaxBindings > 0,
  ).length,
  casesWithActualRpeClamp: results.filter(
    (result) => result.totalActualRpeClampBindings > 0,
  ).length,
  casesWithAntiWindupBinding: results.filter(
    (result) => result.antiWindupBindingBlocks > 0,
  ).length,
  evidence: results.slice(0, evidenceLimit).map(resultEvidence),
});

const saturatedDownResults = firstResults.filter(
  (result) => result.trajectory === 'saturated_down',
);
const mixedResults = firstResults.filter(
  (result) => result.trajectory === 'mixed',
);
const limitCycleResults = firstResults.filter(
  (result) => result.trajectory === 'limit_cycle',
);
const limitCycleEvidence = limitCycleResults.map(resultEvidence);

const stationaryCycleConfigs: ClosedLoopConfig[] = limitCycleResults.flatMap(
  (result) => {
    const source = configById.get(result.id);
    if (source === undefined) throw new Error('Missing cycle source ' + result.id);
    return [
      {
        ...source,
        id: source.id + '|stationary_hypertrophy',
        fixedMacroBlockIndex: 3,
        recentAcwr: null,
      },
      {
        ...source,
        id: source.id + '|stationary_peak',
        fixedMacroBlockIndex: 8,
        recentAcwr: null,
      },
    ];
  },
);
const stationaryCycleFirst = runAll(stationaryCycleConfigs);
const stationaryCycleSecond = runAll(stationaryCycleConfigs);
if (JSON.stringify(stationaryCycleFirst) !== JSON.stringify(stationaryCycleSecond)) {
  throw new Error('Stationary cycle probes are not deterministic');
}
const stationaryLimitCycles = stationaryCycleFirst.filter(
  (result) => result.trajectory === 'limit_cycle',
);
const appliedStationaryLimitCycles = stationaryCycleFirst.filter(
  (result) => result.appliedTrajectory === 'limit_cycle',
);
const stationaryLimitCycleEvidence = stationaryLimitCycles.map((result) => {
  const config = stationaryCycleConfigs.find((candidate) => candidate.id === result.id);
  if (config === undefined) throw new Error('Missing stationary config ' + result.id);
  return {
    plant: config.plant,
    initialState: config.initialState,
    fixedMacroBlockIndex: config.fixedMacroBlockIndex,
    table: compactTable(result),
  };
});

const downwardResult = firstResults.find(
  (result) =>
    result.trajectory === 'saturated_down' ||
    result.trajectory === 'ratchet_down',
);
if (downwardResult === undefined) {
  throw new Error('Sweep did not produce a downward-action evidence case');
}

const byGain = GAIN_GRID.map((gain) => {
  const matching = firstResults.filter(
    (result) => configById.get(result.id)?.plant.RPE_GAIN === gain,
  );
  const counts: Record<string, number> = {};
  for (const result of matching) {
    counts[result.trajectory] = (counts[result.trajectory] ?? 0) + 1;
  }
  return {
    gain,
    cases: matching.length,
    casesWithAnyAction: matching.filter(
      (result) => result.nonNeutralActionBlocks > 0,
    ).length,
    casesWithDirectionChange: matching.filter(
      (result) => result.directionChanges > 0,
    ).length,
    casesWithEMaxBinding: matching.filter(
      (result) => result.totalEMaxBindings > 0,
    ).length,
    casesWithActualRpeClamp: matching.filter(
      (result) => result.totalActualRpeClampBindings > 0,
    ).length,
    trajectories: counts,
  };
});

const canonicalGainTables = GAIN_GRID.map((gain) =>
  compactTable(findResult('stable', gain, 0, 'neutral')),
);

const representativeTables = [
  compactTable(findResult('stable', 3, 0, 'neutral')),
  compactTable(findResult('stable', 3, 0.5, 'neutral')),
  compactTable(
    findResult(
      'overreach',
      BANISTER_ARCHETYPES.overreach.RPE_GAIN,
      BANISTER_ARCHETYPES.overreach.SIGMA_RPE,
      'neutral',
    ),
  ),
  compactTable(
    findResult(
      'adapting',
      BANISTER_ARCHETYPES.adapting.RPE_GAIN,
      BANISTER_ARCHETYPES.adapting.SIGMA_RPE,
      'neutral',
    ),
  ),
  compactTable(findResult('stable', 3, 0, 'mid_supercompensation')),
];

const alignmentConfigs: ClosedLoopConfig[] = [
  {
    id: 'alignment|normal_deload_week4|offset0',
    plant: { ...BANISTER_BASELINE, SIGMA_RPE: 0 },
    initialState: INITIAL_STATE_OFFSETS.neutral,
    seed: hashSeed('alignment|normal_deload_week4|offset0'),
    profile: strengthProfile,
    targetPattern: 'squat',
    fixedMacroBlockIndex: 3,
    recentAcwr: null,
    observerEndOffsetDays: 0,
  },
  {
    id: 'alignment|normal_deload_week4|offset-3',
    plant: { ...BANISTER_BASELINE, SIGMA_RPE: 0 },
    initialState: INITIAL_STATE_OFFSETS.neutral,
    seed: hashSeed('alignment|normal_deload_week4|offset-3'),
    profile: strengthProfile,
    targetPattern: 'squat',
    fixedMacroBlockIndex: 3,
    recentAcwr: null,
    observerEndOffsetDays: -3,
  },
  {
    id: 'alignment|normal_deload_week4|offset-7',
    plant: { ...BANISTER_BASELINE, SIGMA_RPE: 0 },
    initialState: INITIAL_STATE_OFFSETS.neutral,
    seed: hashSeed('alignment|normal_deload_week4|offset-7'),
    profile: strengthProfile,
    targetPattern: 'squat',
    fixedMacroBlockIndex: 3,
    recentAcwr: null,
    observerEndOffsetDays: -7,
  },
  {
    id: 'alignment|peak_normal_deload_week4|offset0',
    plant: { ...BANISTER_BASELINE, SIGMA_RPE: 0 },
    initialState: INITIAL_STATE_OFFSETS.neutral,
    seed: hashSeed('alignment|peak_normal_deload_week4|offset0'),
    profile: strengthProfile,
    targetPattern: 'squat',
    fixedMacroBlockIndex: 8,
    recentAcwr: null,
    observerEndOffsetDays: 0,
  },
  {
    id: 'alignment|peak_shifted_deload_week1|offset0',
    plant: { ...BANISTER_BASELINE, SIGMA_RPE: 0 },
    initialState: INITIAL_STATE_OFFSETS.neutral,
    seed: hashSeed('alignment|peak_shifted_deload_week1|offset0'),
    profile: strengthProfile,
    targetPattern: 'squat',
    fixedMacroBlockIndex: 8,
    recentAcwr: 2,
    observerEndOffsetDays: 0,
  },
];

const alignmentFirst = runAll(alignmentConfigs);
const alignmentSecond = runAll(alignmentConfigs);
if (JSON.stringify(alignmentFirst) !== JSON.stringify(alignmentSecond)) {
  throw new Error('Alignment probes are not deterministic');
}

const lowFrequencyConfigs: ClosedLoopConfig[] = [
  {
    id: 'low_frequency|gpp4|carry',
    plant: { ...BANISTER_BASELINE, SIGMA_RPE: 0 },
    initialState: INITIAL_STATE_OFFSETS.neutral,
    seed: hashSeed('low_frequency|gpp4|carry'),
    profile: gppProfile,
    targetPattern: 'carry',
    fixedMacroBlockIndex: 3,
  },
  {
    id: 'low_frequency|gpp4|rotation',
    plant: { ...BANISTER_BASELINE, SIGMA_RPE: 0 },
    initialState: INITIAL_STATE_OFFSETS.neutral,
    seed: hashSeed('low_frequency|gpp4|rotation'),
    profile: gppProfile,
    targetPattern: 'rotation',
    fixedMacroBlockIndex: 3,
  },
];

const lowFrequencyFirst = runAll(lowFrequencyConfigs);
const lowFrequencySecond = runAll(lowFrequencyConfigs);
if (JSON.stringify(lowFrequencyFirst) !== JSON.stringify(lowFrequencySecond)) {
  throw new Error('Low-frequency probes are not deterministic');
}

const positiveActionCount = (result: ClosedLoopResult): number =>
  result.blocks.filter((block) => block.actionForNext.dRpe_p > 0).length;

const ratifiedHeadroomCandidates = firstResults
  .filter((result) => {
    const config = configById.get(result.id);
    return config !== undefined && config.initialState.fitness > 0;
  })
  .sort(
    (left, right) =>
      positiveActionCount(right) - positiveActionCount(left) ||
      left.id.localeCompare(right.id),
  );

const bestRatifiedHeadroom = ratifiedHeadroomCandidates[0];
if (bestRatifiedHeadroom === undefined) {
  throw new Error('Missing ratified supercompensation cases');
}

const bestHeadroomConfig = configById.get(bestRatifiedHeadroom.id);
if (bestHeadroomConfig === undefined) {
  throw new Error('Missing selected headroom configuration');
}

const overrideBaseConfig: ClosedLoopConfig =
  positiveActionCount(bestRatifiedHeadroom) > 0
    ? bestHeadroomConfig
    : {
        id: 'override_stress|healthy',
        plant: { ...BANISTER_BASELINE, SIGMA_RPE: 0 },
        initialState: { fitness: 3, fatigue: 0 },
        seed: hashSeed('override_stress|paired'),
        profile: strengthProfile,
        targetPattern: 'squat',
        fixedMacroBlockIndex: 3,
      };

const healthyOverrideProbe = runClosedLoop({
  ...overrideBaseConfig,
  id: `${overrideBaseConfig.id}|healthy_override_probe`,
});
const niggleOverrideProbe = runClosedLoop({
  ...overrideBaseConfig,
  id: `${overrideBaseConfig.id}|knee_niggle_override_probe`,
  niggle: { region: 'knee', severity: 4 },
});
const healthyOverrideRepeat = runClosedLoop({
  ...overrideBaseConfig,
  id: `${overrideBaseConfig.id}|healthy_override_probe`,
});
const niggleOverrideRepeat = runClosedLoop({
  ...overrideBaseConfig,
  id: `${overrideBaseConfig.id}|knee_niggle_override_probe`,
  niggle: { region: 'knee', severity: 4 },
});
if (
  JSON.stringify(healthyOverrideProbe) !== JSON.stringify(healthyOverrideRepeat) ||
  JSON.stringify(niggleOverrideProbe) !== JSON.stringify(niggleOverrideRepeat)
) {
  throw new Error('Monotone-conservative override probes are not deterministic');
}

const canonicalAt = (gain: number): ClosedLoopResult =>
  findResult('stable', gain, 0, 'neutral');
const firstCanonicalActionGain =
  GAIN_GRID.find((gain) => canonicalAt(gain).nonNeutralActionBlocks > 0) ?? null;
const bracketTransition =
  canonicalAt(0.9).nonNeutralActionBlocks !==
  canonicalAt(1.1).nonNeutralActionBlocks;

const firstImmediateReversal = (result: ClosedLoopResult): boolean => {
  const directions = result.blocks.map((block) =>
    Math.sign(block.actionForNext.dRpe_p),
  );
  const first = directions.findIndex((direction) => direction !== 0);
  return (
    first >= 0 &&
    first + 1 < directions.length &&
    directions[first + 1] === -directions[first]
  );
};

const summary = {
  commandPurpose:
    'C6 R2 window-segment real-engine deterministic 8-block closed-loop plant-family sweep',
  engines: [
    'detectFlaws',
    'deriveControlAction',
    'generateBlock',
    'buildPatternWindow',
  ],
  controllerConstantsChanged: false,
  design: {
    blocks: 8,
    weeksPerBlock: 4,
    gainGrid: GAIN_GRID,
    noiseGrid: NOISE_GRID,
    initialStates: INITIAL_STATES.map((initial) => ({
      name: initial.name,
      ...initial.value,
    })),
    plantCorners: cornerIndex,
    primaryCases: primaryConfigs.length,
    fullFactorDimensions: [
      'TAU_FAT',
      'TAU_FIT',
      'K_FAT',
      'K_FIT',
      'RPE_GAIN',
      'SIGMA_RPE',
    ],
  },
  determinism: {
    primaryDoubleRunDeepEqual: true,
    alignmentDoubleRunDeepEqual: true,
    lowFrequencyDoubleRunDeepEqual: true,
    overrideDoubleRunDeepEqual: true,
    stationaryCycleDoubleRunDeepEqual: true,
    nonzeroNoiseIncluded: firstResults.some(
      (result) => configById.get(result.id)?.plant.SIGMA_RPE === 0.5,
    ),
  },
  failLoudSentinel: {
    id: sentinel.id,
    block1AllPhiZero: sentinel.block1AllPhiZero,
    block1AllCorrectionsNeutral: sentinel.block1AllCorrectionsNeutral,
    block1Observations: sentinel.blocks[0].observations,
    block1Phi: sentinel.blocks[0].phi,
    totalTargetBearingSets: sentinel.totalTargetBearingSets,
  },
  primarySweep: {
    classificationCounts,
    appliedClassificationCounts,
    appliedClassificationAssignmentFingerprint: hashSeed(
      firstResults
        .map((result) => `${result.id}:${result.appliedTrajectory}`)
        .join('\\n'),
    ).toString(16).padStart(8, '0'),
    classificationAssignmentFingerprint: hashSeed(
      firstResults
        .map((result) => `${result.id}:${result.trajectory}`)
        .join('\\n'),
    ).toString(16).padStart(8, '0'),
    blockAuthorityByIndex: Array.from({ length: 8 }, (_, index) => ({
      decisionAfterSimulationBlock: index + 1,
      targetMacroBlockIndex: Math.min(8, index + 2),
      raiseActions: firstResults.filter(
        (result) => (result.blocks[index]?.actionForNext.dRpe_p ?? 0) > 0,
      ).length,
      positiveGrants: firstResults.filter(
        (result) => (result.blocks[index]?.blockAddedRpeForNext ?? 0) > 0,
      ).length,
      macroScheduleBindings: firstResults.filter(
        (result) => result.blocks[index]?.macroScheduleBlockedRaise === true,
      ).length,
      perBlockSelectionBindings: firstResults.filter(
        (result) =>
          result.blocks[index]?.perBlockRpeSelectionBlockedRaise === true,
      ).length,
    })),
    limitCycleCases: firstResults.filter(
      (result) => result.trajectory === 'limit_cycle',
    ).length,
    saturationCases: firstResults.filter(
      (result) =>
        result.trajectory === 'saturated_down' ||
        result.trajectory === 'saturated_up',
    ).length,
    ratchetCases: firstResults.filter(
      (result) =>
        result.trajectory === 'ratchet_down' ||
        result.trajectory === 'ratchet_up',
    ).length,
    convergedNeutralCases: firstResults.filter(
      (result) => result.trajectory === 'converged_neutral',
    ).length,
    casesWithMacroScheduleBinding: firstResults.filter(
      (result) => result.macroScheduleBindingBlocks > 0,
    ).length,
    totalMacroScheduleBindingBlocks: firstResults.reduce(
      (sum, result) => sum + result.macroScheduleBindingBlocks,
      0,
    ),
    casesWithPerBlockRpeSelectionBinding: firstResults.filter(
      (result) => result.perBlockRpeSelectionBindingBlocks > 0,
    ).length,
    totalPerBlockRpeSelectionBindingBlocks: firstResults.reduce(
      (sum, result) => sum + result.perBlockRpeSelectionBindingBlocks,
      0,
    ),
    casesWithRpeAuthorityBinding: firstResults.filter(
      (result) => result.rpeBudgetBindingBlocks > 0,
    ).length,
    totalRpeAuthorityBindingBlocks: firstResults.reduce(
      (sum, result) => sum + result.rpeBudgetBindingBlocks,
      0,
    ),
    casesWithPositiveRpeGrant: firstResults.filter((result) =>
      result.blocks.some((block) => block.blockAddedRpeForNext > 0),
    ).length,
    totalPositiveRpeGrantBlocks: firstResults.reduce(
      (sum, result) =>
        sum +
        result.blocks.filter((block) => block.blockAddedRpeForNext > 0).length,
      0,
    ),
    limitCycleEvidence,
    stationaryTemplateProbeCases: stationaryCycleFirst.length,
    stationaryTemplateLimitCycleCases: stationaryLimitCycles.length,
    appliedStationaryTemplateLimitCycleCases:
      appliedStationaryLimitCycles.length,
    stationaryLimitCycleEvidence,
    downwardActionEvidence: resultEvidence(downwardResult),
    residualPopulations: {
      saturatedDown: summarizePopulation(
        saturatedDownResults,
        saturatedDownResults.length,
      ),
      mixed: summarizePopulation(mixedResults, 6),
    },
    byGain,
  },
  c2Falsifiers: {
    canonicalFirstActionGain: firstCanonicalActionGain,
    qualitativeTransitionAcrossPoint9To1Point1: bracketTransition,
    firstActionInsidePoint75To1Point25:
      firstCanonicalActionGain !== null &&
      firstCanonicalActionGain >= 0.75 &&
      firstCanonicalActionGain <= 1.25,
    gain3ImmediateReversal: firstImmediateReversal(canonicalAt(3)),
  },
  canonicalGainTables,
  representativeTables,
  phaseAlignmentTables: alignmentFirst.map(compactTable),
  lowFrequencyTables: lowFrequencyFirst.map(compactTable),
  safetyAsymmetry: {
    ratifiedFamilyBestHealthyHeadroom: compactTable(bestRatifiedHeadroom),
    ratifiedFamilyPositiveActionBlocks:
      positiveActionCount(bestRatifiedHeadroom),
    overrideProbeUsesRatifiedInitialState:
      positiveActionCount(bestRatifiedHeadroom) > 0,
    healthy: compactTable(healthyOverrideProbe),
    kneeNiggleSeverity4: compactTable(niggleOverrideProbe),
    healthyRaiseBlocks: positiveActionCount(healthyOverrideProbe),
    niggleRaiseBlocks: positiveActionCount(niggleOverrideProbe),
    niggleOverrideBindingBlocks:
      niggleOverrideProbe.monotoneOverrideBindingBlocks,
  },
  nonlinearBinding: {
    casesWithEMaxBinding: firstResults.filter(
      (result) => result.totalEMaxBindings > 0,
    ).length,
    casesWithActualRpeClamp: firstResults.filter(
      (result) => result.totalActualRpeClampBindings > 0,
    ).length,
    casesWithRpeCapBinding: firstResults.filter(
      (result) => result.totalRpeCapBindings > 0,
    ).length,
    casesWithSetFloorBinding: firstResults.filter(
      (result) => result.totalSetFloorBindings > 0,
    ).length,
    casesWithAntiWindupBinding: firstResults.filter(
      (result) => result.antiWindupBindingBlocks > 0,
    ).length,
  },
};

console.log(JSON.stringify(summary, null, 2));
