/**
 * C6B decision sweep for the R1 macro-cycle RPE authority envelope.
 *
 * Production source is never edited. Each authority variant is installed in a
 * fresh OS-temp source tree, strict-compiled with the real simulation and
 * counterexample gates, executed, summarized, and then removed.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(SCRIPT_DIR, '..', '..');
const SOURCE_PATH = join(
  WORKSPACE_ROOT,
  'packages',
  'inference',
  'src',
  'kinematicAutopilot.ts',
);
const TSC_PATH = join(
  WORKSPACE_ROOT,
  'node_modules',
  'typescript',
  'bin',
  'tsc',
);
const AUTHORITY_ANCHOR_PATTERN =
  /MAX_MACROCYCLE_RPE_RAISE:\s*(?:\d+(?:\.\d+)?|Number\.POSITIVE_INFINITY),/g;
const TEMP_PREFIX = 'athlete-c6b-authority-';

const variants = [
  { label: 'baseline_1.0', literal: '1.0', numericBudget: 1 },
  { label: 'bracket_2.5', literal: '2.5', numericBudget: 2.5 },
  { label: 'preferred_3.0', literal: '3.0', numericBudget: 3 },
  {
    label: 'unbounded_8_block_control',
    literal: 'Number.POSITIVE_INFINITY',
    numericBudget: null,
  },
];

const ensureSingleAnchor = (text) => {
  const count = [...text.matchAll(AUTHORITY_ANCHOR_PATTERN)].length;
  if (count !== 1) {
    throw new Error(`Expected one authority anchor, found ${count}`);
  }
};

const grantSchedule = (numericBudget) => {
  const slots =
    numericBudget === null ? 8 : Math.floor(numericBudget / 0.5);
  return Array.from({ length: 8 }, (_, index) =>
    index < slots ? 0.5 : 0,
  );
};

const copyVariantSources = (tempRoot) => {
  const inferenceDestination = join(
    tempRoot,
    'packages',
    'inference',
    'src',
  );
  const simulatorDestination = join(tempRoot, 'tools', 'autopilot-sim');
  const testDestination = join(tempRoot, 'packages', 'inference', 'test');
  mkdirSync(dirname(inferenceDestination), { recursive: true });
  mkdirSync(simulatorDestination, { recursive: true });
  mkdirSync(testDestination, { recursive: true });
  cpSync(
    join(WORKSPACE_ROOT, 'packages', 'inference', 'src'),
    inferenceDestination,
    { recursive: true },
  );
  for (const file of ['closedLoop.ts', 'plantConstants.ts', 'runSweep.ts']) {
    cpSync(
      join(WORKSPACE_ROOT, 'tools', 'autopilot-sim', file),
      join(simulatorDestination, file),
    );
  }
  cpSync(
    join(
      WORKSPACE_ROOT,
      'packages',
      'inference',
      'test',
      'verify_autopilot_counterexamples.ts',
    ),
    join(testDestination, 'verify_autopilot_counterexamples.ts'),
  );
};

const counterexampleSummary = (run) => {
  if (run.error !== undefined) {
    throw run.error;
  }
  const output = [run.stdout, run.stderr]
    .join('\n')
    .split(/\r?\n/)
    .filter(
      (line) =>
        line.startsWith('PASS  ') ||
        line.startsWith('FAIL  ') ||
        line.startsWith('ALL CHECKS PASSED') ||
        line.includes('C4 counterexample gate failed'),
    );
  return {
    exitCode: run.status,
    passed: run.status === 0,
    output,
  };
};

const summarize = (variant, sweep, counterexampleGate) => {
  const classifications = sweep.primarySweep.classificationCounts;
  const nominalGain3ZeroNoiseProbe = sweep.canonicalGainTables.find(
    (table) => table.id === 'stable|g3.00|s0.00|neutral|squat',
  );
  if (nominalGain3ZeroNoiseProbe === undefined) {
    throw new Error('Missing nominal gain-3 zero-noise probe');
  }
  return {
    label: variant.label,
    maxMacrocycleRpeRaise:
      variant.numericBudget === null ? 'unbounded' : variant.numericBudget,
    grantSchedule: grantSchedule(variant.numericBudget),
    primaryCases: sweep.design.primaryCases,
    deterministic: Object.values(sweep.determinism).every(Boolean),
    classifications,
    appliedClassifications: sweep.primarySweep.appliedClassificationCounts,
    appliedClassificationAssignmentFingerprint:
      sweep.primarySweep.appliedClassificationAssignmentFingerprint,
    classificationAssignmentFingerprint:
      sweep.primarySweep.classificationAssignmentFingerprint,
    blockAuthorityByIndex: sweep.primarySweep.blockAuthorityByIndex,
    limitCycles: sweep.primarySweep.limitCycleCases,
    limitCycleEvidence: sweep.primarySweep.limitCycleEvidence,
    saturatedUp: classifications.saturated_up ?? 0,
    saturatedDown: classifications.saturated_down ?? 0,
    ratchetUp: classifications.ratchet_up ?? 0,
    ratchetDown: classifications.ratchet_down ?? 0,
    authorityLimitedNeutral:
      classifications.authority_limited_neutral ?? 0,
    mixed: classifications.mixed ?? 0,
    convergedNeutral: classifications.converged_neutral ?? 0,
    casesWithMacroScheduleBinding:
      sweep.primarySweep.casesWithMacroScheduleBinding,
    totalMacroScheduleBindingBlocks:
      sweep.primarySweep.totalMacroScheduleBindingBlocks,
    casesWithPerBlockRpeSelectionBinding:
      sweep.primarySweep.casesWithPerBlockRpeSelectionBinding,
    totalPerBlockRpeSelectionBindingBlocks:
      sweep.primarySweep.totalPerBlockRpeSelectionBindingBlocks,
    casesWithRpeAuthorityBinding:
      sweep.primarySweep.casesWithRpeAuthorityBinding,
    totalRpeAuthorityBindingBlocks:
      sweep.primarySweep.totalRpeAuthorityBindingBlocks,
    casesWithPositiveRpeGrant:
      sweep.primarySweep.casesWithPositiveRpeGrant,
    totalPositiveRpeGrantBlocks:
      sweep.primarySweep.totalPositiveRpeGrantBlocks,
    nominalGain3ZeroNoiseProbe,
    safetyOverrideProbe: {
      healthy: sweep.safetyAsymmetry.healthy,
      kneeNiggleSeverity4: sweep.safetyAsymmetry.kneeNiggleSeverity4,
      healthyRaiseBlocks: sweep.safetyAsymmetry.healthyRaiseBlocks,
      niggleRaiseBlocks: sweep.safetyAsymmetry.niggleRaiseBlocks,
      niggleBlockedEveryRaise:
        sweep.safetyAsymmetry.niggleRaiseBlocks === 0,
      niggleOverrideBindingBlocks:
        sweep.safetyAsymmetry.niggleOverrideBindingBlocks,
    },
    counterexampleGate,
  };
};

const runVariant = (variant, shippedSource) => {
  const tempRoot = mkdtempSync(join(tmpdir(), TEMP_PREFIX));
  if (!basename(tempRoot).startsWith(TEMP_PREFIX)) {
    throw new Error(`Refusing unsafe temp path: ${tempRoot}`);
  }
  try {
    copyVariantSources(tempRoot);
    const variantSourcePath = join(
      tempRoot,
      'packages',
      'inference',
      'src',
      'kinematicAutopilot.ts',
    );
    const variantSource = readFileSync(variantSourcePath, 'utf8');
    ensureSingleAnchor(variantSource);
    writeFileSync(
      variantSourcePath,
      variantSource.replace(
        AUTHORITY_ANCHOR_PATTERN,
        `MAX_MACROCYCLE_RPE_RAISE: ${variant.literal},`,
      ),
      'utf8',
    );

    const outputRoot = join(tempRoot, '.build');
    const sweepEntry = join(
      tempRoot,
      'tools',
      'autopilot-sim',
      'runSweep.ts',
    );
    const counterexampleEntry = join(
      tempRoot,
      'packages',
      'inference',
      'test',
      'verify_autopilot_counterexamples.ts',
    );
    execFileSync(
      process.execPath,
      [
        TSC_PATH,
        '--strict',
        '--target',
        'es2020',
        '--module',
        'commonjs',
        '--lib',
        'es2020,dom',
        '--rootDir',
        tempRoot,
        '--outDir',
        outputRoot,
        sweepEntry,
        counterexampleEntry,
      ],
      {
        cwd: WORKSPACE_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    const compiledSweep = join(
      outputRoot,
      'tools',
      'autopilot-sim',
      'runSweep.js',
    );
    const rawSweep = execFileSync(process.execPath, [compiledSweep], {
      cwd: WORKSPACE_ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const sweep = JSON.parse(rawSweep);

    const compiledCounterexampleGate = join(
      outputRoot,
      'packages',
      'inference',
      'test',
      'verify_autopilot_counterexamples.js',
    );
    const counterexampleRun = spawnSync(
      process.execPath,
      [compiledCounterexampleGate],
      {
        cwd: WORKSPACE_ROOT,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    return summarize(
      variant,
      sweep,
      counterexampleSummary(counterexampleRun),
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    if (existsSync(tempRoot)) {
      throw new Error(`Temp cleanup failed: ${tempRoot}`);
    }
    const currentSource = readFileSync(SOURCE_PATH, 'utf8');
    if (currentSource !== shippedSource) {
      throw new Error('Shipped authority source changed during C6B run');
    }
  }
};

if (!existsSync(TSC_PATH)) {
  throw new Error(`TypeScript compiler not found: ${TSC_PATH}`);
}
const shippedSource = readFileSync(SOURCE_PATH, 'utf8');
ensureSingleAnchor(shippedSource);
const productionAuthorityLiteral = [
  ...shippedSource.matchAll(AUTHORITY_ANCHOR_PATTERN),
][0]?.[0];

const requestedVariant = process.argv[2] ?? null;
const selectedVariants =
  requestedVariant === null
    ? variants
    : variants.filter((variant) => variant.label === requestedVariant);
if (selectedVariants.length === 0) {
  throw new Error(`Unknown C6B authority variant: ${requestedVariant}`);
}

const results = [];
for (const variant of selectedVariants) {
  console.error(`RUN ${variant.label}`);
  results.push(runVariant(variant, shippedSource));
}

console.log(
  JSON.stringify(
    {
      commandPurpose:
        'C6B authority-3.0 decision sweep over the real R2 full family',
      productionAuthorityLiteral,
      shippedSourceMutated: false,
      strictCompilePerVariant: true,
      fullFamilyDoubleRunDeepEqualPerVariant: true,
      unboundedMeaning:
        'Infinity in the authority constant; one +0.5 grant per block caps the 8-block simulated horizon at +4.0.',
      results,
    },
    null,
    2,
  ),
);
