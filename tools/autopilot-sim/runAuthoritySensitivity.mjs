/**
 * C6 post-audit sensitivity for the R1 macro-cycle RPE authority envelope.
 *
 * The shipped source is never edited. Each variant is copied into an isolated
 * OS temp tree, the single authority literal is replaced there, and the real
 * strict-compiled runSweep engine is executed. The temp tree is then removed.
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
import { execFileSync } from 'node:child_process';

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
const AUTHORITY_ANCHOR = 'MAX_MACROCYCLE_RPE_RAISE: 1.0,';
const TEMP_PREFIX = 'athlete-rpe-sensitivity-';

const variants = [
  { label: 'shipped_1.0', literal: '1.0', numericBudget: 1 },
  { label: 'candidate_1.5', literal: '1.5', numericBudget: 1.5 },
  { label: 'candidate_2.0', literal: '2.0', numericBudget: 2 },
  {
    label: 'unbounded_8_block_horizon',
    literal: 'Number.POSITIVE_INFINITY',
    numericBudget: null,
  },
];

const ensureSingleAnchor = (text) => {
  const count = text.split(AUTHORITY_ANCHOR).length - 1;
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
  mkdirSync(dirname(inferenceDestination), { recursive: true });
  mkdirSync(simulatorDestination, { recursive: true });
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
};

const summarize = (variant, sweep) => {
  const classifications = sweep.primarySweep.classificationCounts;
  return {
    label: variant.label,
    maxMacrocycleRpeRaise:
      variant.numericBudget === null ? 'unbounded' : variant.numericBudget,
    grantSchedule: grantSchedule(variant.numericBudget),
    primaryCases: sweep.design.primaryCases,
    deterministic: Object.values(sweep.determinism).every(Boolean),
    classifications,
    limitCycles: sweep.primarySweep.limitCycleCases,
    limitCycleEvidence: sweep.primarySweep.limitCycleEvidence,
    saturatedUp: classifications.saturated_up ?? 0,
    saturatedDown: classifications.saturated_down ?? 0,
    ratchetUp: classifications.ratchet_up ?? 0,
    ratchetDown: classifications.ratchet_down ?? 0,
    authorityLimitedNeutral:
      classifications.authority_limited_neutral ?? 0,
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
    mixed: classifications.mixed ?? 0,
    convergedNeutral: classifications.converged_neutral ?? 0,
    nonlinearBinding: sweep.nonlinearBinding,
    residualPopulations: sweep.primarySweep.residualPopulations,
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
    const replacement =
      `MAX_MACROCYCLE_RPE_RAISE: ${variant.literal},`;
    writeFileSync(
      variantSourcePath,
      variantSource.replace(AUTHORITY_ANCHOR, replacement),
      'utf8',
    );

    const outputRoot = join(tempRoot, '.build');
    const entry = join(tempRoot, 'tools', 'autopilot-sim', 'runSweep.ts');
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
        entry,
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
    const raw = execFileSync(process.execPath, [compiledSweep], {
      cwd: WORKSPACE_ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const sweep = JSON.parse(raw);
    return summarize(variant, sweep);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    if (existsSync(tempRoot)) {
      throw new Error(`Temp cleanup failed: ${tempRoot}`);
    }
    const currentSource = readFileSync(SOURCE_PATH, 'utf8');
    if (currentSource !== shippedSource) {
      throw new Error('Shipped authority source changed during sensitivity run');
    }
  }
};

if (!existsSync(TSC_PATH)) {
  throw new Error(`TypeScript compiler not found: ${TSC_PATH}`);
}
const shippedSource = readFileSync(SOURCE_PATH, 'utf8');
ensureSingleAnchor(shippedSource);

const requestedVariant = process.argv[2] ?? null;
const selectedVariants =
  requestedVariant === null
    ? variants
    : variants.filter((variant) => variant.label === requestedVariant);
if (selectedVariants.length === 0) {
  throw new Error(`Unknown sensitivity variant: ${requestedVariant}`);
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
        'C6 post-audit R1 authority sensitivity over the real R2 full family',
      shippedSourceMutated: false,
      strictCompilePerVariant: true,
      unboundedMeaning:
        'Infinity in the authority constant; one +0.5 grant per block still caps the 8-block simulated horizon at +4.0.',
      results,
    },
    null,
    2,
  ),
);
