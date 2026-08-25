/**
 * test_verify_ci_structure.mjs — falsifiers for the CI workflow-structure gate.
 *
 * Hermes r5 H-2: the inline gate proved the gate command APPEARED and RAN, not
 * that its failure stopped anything. `continue-on-error: true` and a job-level
 * `if:` each removed the gate's effect while leaving every string in place, and
 * both went undetected — because the gate had no fixtures. Each bypass below is
 * now a permanent falsifier. If any of them starts passing, the gate has gone
 * soft again.
 *
 * Run: node tools/test_verify_ci_structure.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CANDIDATE_ARTIFACT,
  GATE_COMMAND,
  checkWorkflowStructure,
  splitJobs,
  splitSteps,
  stripYamlComments,
} from './verify_ci_structure.mjs';

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** A minimal but STRUCTURALLY HONEST workflow: build -> gate -> publish. */
const SOUND = `name: CI

on:
  push:
    branches: [master]

jobs:
  verify:
    name: Verification suite (21 gates + typecheck)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - name: verify:ci (21 gates + typecheck)
        run: npm run verify:ci

  android-apk:
    name: Android QA + debug APKs
    runs-on: ubuntu-latest
    needs: verify
    steps:
      - uses: actions/checkout@v6
      - name: Build QA candidate APK
        working-directory: apps/mobile/android
        run: ./gradlew assembleQa --no-daemon
      - name: verify:qa-candidate (real artifact, fails closed)
        run: ${GATE_COMMAND}
      - uses: actions/upload-artifact@v6
        with:
          name: athlete-kinetics-qa-candidate-apk
          path: apps/mobile/android/app/build/outputs/${CANDIDATE_ARTIFACT}
          if-no-files-found: error
`;

// =============================================================================
console.log('[1] the positive control — a sound workflow passes');

{
  const r = checkWorkflowStructure(SOUND, { gateCount: 21 });
  check('a structurally honest workflow is accepted', r.ok === true, r.problems.join('; ').slice(0, 120));
  check('  ...and the prerequisite job is identified', r.observed.prereq === 'verify', r.observed.prereq ?? '');
}

// =============================================================================
console.log('\n[2] HERMES H-2 — neutralisers that leave every string in place');

{
  // CI3, reproduced by Hermes: the command runs, fails, and the job is green.
  const y = SOUND.replace(`      - name: verify:qa-candidate (real artifact, fails closed)
        run: ${GATE_COMMAND}`,
  `      - name: verify:qa-candidate (real artifact, fails closed)
        continue-on-error: true
        run: ${GATE_COMMAND}`);
  const r = checkWorkflowStructure(y, { gateCount: 21 });
  check('H-2 CI3: `continue-on-error` on the gate step is REJECTED',
    r.ok === false && r.problems.some((p) => p.includes('continue-on-error')),
    r.problems.join('; ').slice(0, 100));
}

{
  // CI4, reproduced by Hermes: the job never runs at all.
  const y = SOUND.replace('    needs: verify\n', '    needs: verify\n    if: ${{ false }}\n');
  const r = checkWorkflowStructure(y, { gateCount: 21 });
  check('H-2 CI4: a job-level `if:` on android-apk is REJECTED',
    r.ok === false && r.problems.some((p) => p.includes('job-level')),
    r.problems.join('; ').slice(0, 100));
}

{
  // Not reproduced by Hermes, but the same class: skip only the gate step.
  const y = SOUND.replace(`      - name: verify:qa-candidate (real artifact, fails closed)
        run: ${GATE_COMMAND}`,
  `      - name: verify:qa-candidate (real artifact, fails closed)
        if: \${{ false }}
        run: ${GATE_COMMAND}`);
  const r = checkWorkflowStructure(y, { gateCount: 21 });
  check('H-2: a step-level `if:` on the gate step is REJECTED',
    r.ok === false && r.problems.some((p) => p.includes('gate step carries')),
    r.problems.join('; ').slice(0, 100));
}

{
  // Job-level continue-on-error: the job fails and the workflow is green.
  const y = SOUND.replace('    needs: verify\n', '    needs: verify\n    continue-on-error: true\n');
  const r = checkWorkflowStructure(y, { gateCount: 21 });
  check('H-2: job-level `continue-on-error` on android-apk is REJECTED', r.ok === false);
}

{
  // The prerequisite job neutralised: it cannot gate anything.
  const y = SOUND.replace(`  verify:
    name: Verification suite (21 gates + typecheck)
    runs-on: ubuntu-latest`,
  `  verify:
    name: Verification suite (21 gates + typecheck)
    runs-on: ubuntu-latest
    continue-on-error: true`);
  const r = checkWorkflowStructure(y, { gateCount: 21 });
  check('H-2: a neutralised PREREQUISITE job is REJECTED',
    r.ok === false && r.problems.some((p) => p.includes('prerequisite job')),
    r.problems.join('; ').slice(0, 100));
}

// =============================================================================
console.log('\n[3] the round-4 bypasses stay closed');

{
  const y = SOUND.replace(`        run: ${GATE_COMMAND}`, `        run: echo '${GATE_COMMAND}'`);
  const r = checkWorkflowStructure(y, { gateCount: 21 });
  check('echoing the gate command instead of running it is REJECTED',
    r.ok === false && r.problems.some((p) => p.includes('whole run body')),
    r.problems.join('; ').slice(0, 100));
}
{
  const y = SOUND.replace(`        run: ${GATE_COMMAND}`, `        run: ${GATE_COMMAND} || true`);
  const r = checkWorkflowStructure(y, { gateCount: 21 });
  check('discarding the gate exit code with `|| true` is REJECTED', r.ok === false);
}
{
  // A comment that MENTIONS the command is not the command.
  const y = SOUND.replace(`      - name: verify:qa-candidate (real artifact, fails closed)
        run: ${GATE_COMMAND}\n`, `      # always run ${GATE_COMMAND} to gate the artifact\n`);
  const r = checkWorkflowStructure(y, { gateCount: 21 });
  check('a comment claiming the gate runs is REJECTED',
    r.ok === false && r.problems.some((p) => p.includes('ungated')),
    r.problems.join('; ').slice(0, 100));
}

// =============================================================================
console.log('\n[4] build / gate / publish integrity');

{
  const y = SOUND.replace('        run: ./gradlew assembleQa --no-daemon\n', '');
  check('a workflow that never builds the candidate is REJECTED',
    checkWorkflowStructure(y, { gateCount: 21 }).ok === false);
}
{
  const y = SOUND.replace(`          path: apps/mobile/android/app/build/outputs/${CANDIDATE_ARTIFACT}`,
    '          path: apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk');
  check('a workflow that never uploads the candidate is REJECTED',
    checkWorkflowStructure(y, { gateCount: 21 }).ok === false);
}
{
  const y = SOUND.replace('          if-no-files-found: error\n', '');
  const r = checkWorkflowStructure(y, { gateCount: 21 });
  check('an upload that tolerates a missing artifact is REJECTED',
    r.ok === false && r.problems.some((p) => p.includes('if-no-files-found')),
    r.problems.join('; ').slice(0, 90));
}
{
  const y = SOUND.replace('    needs: verify\n', '');
  check('android-apk with no prerequisite is REJECTED',
    checkWorkflowStructure(y, { gateCount: 21 }).ok === false);
}
{
  const y = SOUND.replace('        run: npm run verify:ci', '        run: npm run verify:release');
  const r = checkWorkflowStructure(y, { gateCount: 21 });
  check('a prerequisite running verify:release (unsatisfiable on a runner) is REJECTED',
    r.ok === false && r.problems.some((p) => p.includes('verify:release')),
    r.problems.join('; ').slice(0, 90));
}
{
  const r = checkWorkflowStructure(SOUND, { gateCount: 22 });
  check('a drifted documented gate count is REJECTED',
    r.ok === false && r.problems.some((p) => p.includes('gate count')),
    r.problems.join('; ').slice(0, 90));
}

// =============================================================================
console.log('\n[5] helpers behave');

{
  check('comments are stripped, not matched',
    !stripYamlComments('  # run: npm run x\n  run: npm run y').includes('npm run x'));
  check('jobs split by two-space keys', splitJobs(SOUND).size === 2,
    [...splitJobs(SOUND).keys()].join(','));
  check('steps split by six-space list items',
    splitSteps(splitJobs(SOUND).get('android-apk')).length === 4,
    String(splitSteps(splitJobs(SOUND).get('android-apk')).length));
}

// =============================================================================
console.log('\n[6] the REAL workflow in this repository');

{
  const real = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf-8');
  const r = checkWorkflowStructure(real, { gateCount: 21 });
  check('the shipped ci.yml passes every structural assertion',
    r.ok === true, r.problems.join('; ').slice(0, 160));
  check('  ...and its prerequisite job is the verify suite',
    r.observed.prereq === 'verify', r.observed.prereq ?? '(none)');
}

console.log(`\n${fail === 0 ? 'ALL CI STRUCTURE FIXTURES PASSED' : `${fail} CI STRUCTURE FIXTURE(S) FAILED`}`);
process.exit(fail ? 1 : 0);
