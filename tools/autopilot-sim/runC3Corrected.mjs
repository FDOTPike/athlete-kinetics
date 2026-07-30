/**
 * C6B follow-up: replay the pre-R1/pre-R2 C3 controller through both the
 * historical decision-boundary classifier and the corrected applied-block
 * classifier.
 *
 * The production tree is never edited. The exact C3 source files are read from
 * the commit that preceded the remediation work, installed in a fresh OS-temp
 * source tree, adapted only for the simulator's later reporting fields, strict
 * compiled, run twice by runSweep.ts, summarized, and removed.
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
const TEMP_PREFIX = 'athlete-c3-corrected-';
const C3_SOURCE_COMMIT = '84f3e7e496449aaa4cfc11db724a1dc6819bbf59';
const KINEMATIC_PATH = join(
  WORKSPACE_ROOT,
  'packages',
  'inference',
  'src',
  'kinematicAutopilot.ts',
);
const GENERATOR_PATH = join(
  WORKSPACE_ROOT,
  'packages',
  'inference',
  'src',
  'blockGenerator.ts',
);
const TSC_PATH = join(
  WORKSPACE_ROOT,
  'node_modules',
  'typescript',
  'bin',
  'tsc',
);

const replaceOnce = (text, search, replacement, label) => {
  const first = text.indexOf(search);
  if (first < 0 || text.indexOf(search, first + search.length) >= 0) {
    throw new Error(`Expected exactly one ${label} anchor`);
  }
  return text.slice(0, first) + replacement + text.slice(first + search.length);
};

const replacePatternOnce = (text, pattern, replacement, label) => {
  const matches = [...text.matchAll(pattern)];
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${label} pattern, found ${matches.length}`);
  }
  return text.replace(pattern, replacement);
};

const gitFile = (relativePath) =>
  execFileSync(
    'git',
    ['show', `${C3_SOURCE_COMMIT}:${relativePath.replaceAll('\\', '/')}`],
    {
      cwd: WORKSPACE_ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

const copySources = (tempRoot) => {
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
  writeFileSync(
    join(inferenceDestination, 'kinematicAutopilot.ts'),
    gitFile('packages/inference/src/kinematicAutopilot.ts'),
    'utf8',
  );
  writeFileSync(
    join(inferenceDestination, 'blockGenerator.ts'),
    gitFile('packages/inference/src/blockGenerator.ts'),
    'utf8',
  );
};

const adaptReportingHarnessToC3Api = (tempRoot) => {
  const harnessPath = join(tempRoot, 'tools', 'autopilot-sim', 'closedLoop.ts');
  let harness = readFileSync(harnessPath, 'utf8');

  harness = replaceOnce(
    harness,
    `const antiWindupWouldBind = (report: FlawReport): boolean => {
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
`,
    `const antiWindupWouldBind = (report: FlawReport): boolean => {
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

const positiveRpeGrant = (action: ControlAction | null): number =>
  action === null
    ? 0
    : MOVEMENT_PATTERNS.reduce(
        (sum, pattern) =>
          sum + Math.max(0, action.corrections[pattern].dRpe_p),
        0,
      );
`,
    'positive-RPE reporting helper',
  );

  harness = replaceOnce(
    harness,
    `    const actionForNext = deriveControlAction(
      report,
      profile,
      macroPhaseOf(nextMacroIndex),
      nextMacroIndex,
    );`,
    `    const actionForNext = deriveControlAction(
      report,
      profile,
      macroPhaseOf(nextMacroIndex),
    );`,
    'C3 deriveControlAction call',
  );

  harness = replacePatternOnce(
    harness,
    /    const macroGrantSlots = Math\.floor\([\s\S]*?    const rpeBudgetBlockedRaise =\r?\n      macroScheduleBlockedRaise \|\| perBlockRpeSelectionBlockedRaise;\r?\n/g,
    `    const macroScheduleBlockedRaise = false;
    const perBlockRpeSelectionBlockedRaise = false;
    const rpeBudgetBlockedRaise = false;
`,
    'post-R1 authority diagnostics',
  );

  harness = replaceOnce(
    harness,
    '      blockAddedRpeForNext: actionForNext.blockAddedRpe,',
    '      blockAddedRpeForNext: positiveRpeGrant(actionForNext),',
    'next-block RPE grant field',
  );
  harness = replaceOnce(
    harness,
    '      blockAddedRpeApplied: previousAction?.blockAddedRpe ?? 0,',
    '      blockAddedRpeApplied: positiveRpeGrant(previousAction),',
    'applied RPE grant field',
  );

  writeFileSync(harnessPath, harness, 'utf8');
};

const summarize = (sweep) => ({
  sourceCommit: C3_SOURCE_COMMIT,
  sourcePolicy: 'pre-R1 cumulative authority and pre-R2 observer',
  primaryCases: sweep.design.primaryCases,
  deterministic: Object.values(sweep.determinism).every(Boolean),
  historicalDecisionBoundary: {
    classifications: sweep.primarySweep.classificationCounts,
    assignmentFingerprint:
      sweep.primarySweep.classificationAssignmentFingerprint,
  },
  correctedAppliedBlocks: {
    classifications: sweep.primarySweep.appliedClassificationCounts,
    assignmentFingerprint:
      sweep.primarySweep.appliedClassificationAssignmentFingerprint,
  },
  historicalStationaryLimitCycles:
    sweep.primarySweep.stationaryTemplateLimitCycleCases,
  correctedAppliedStationaryLimitCycles:
    sweep.primarySweep.appliedStationaryTemplateLimitCycleCases,
});

if (!existsSync(TSC_PATH)) {
  throw new Error(`TypeScript compiler not found: ${TSC_PATH}`);
}

const shippedKinematic = readFileSync(KINEMATIC_PATH, 'utf8');
const shippedGenerator = readFileSync(GENERATOR_PATH, 'utf8');
const tempRoot = mkdtempSync(join(tmpdir(), TEMP_PREFIX));
if (!basename(tempRoot).startsWith(TEMP_PREFIX)) {
  throw new Error(`Refusing unsafe temp path: ${tempRoot}`);
}

try {
  copySources(tempRoot);
  adaptReportingHarnessToC3Api(tempRoot);
  const outputRoot = join(tempRoot, '.build');
  const sweepEntry = join(
    tempRoot,
    'tools',
    'autopilot-sim',
    'runSweep.ts',
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
  console.log(
    JSON.stringify(
      {
        commandPurpose:
          'C6B follow-up: corrected applied-block classification of the C3 baseline',
        productionSourcesMutated: false,
        strictCompile: true,
        fullFamilyDoubleRunDeepEqual: true,
        ...summarize(sweep),
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  if (existsSync(tempRoot)) {
    throw new Error(`Temp cleanup failed: ${tempRoot}`);
  }
  if (
    readFileSync(KINEMATIC_PATH, 'utf8') !== shippedKinematic ||
    readFileSync(GENERATOR_PATH, 'utf8') !== shippedGenerator
  ) {
    throw new Error('Production sources changed during corrected C3 replay');
  }
}
