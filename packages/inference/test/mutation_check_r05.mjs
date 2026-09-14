// Run after verify:blocks and verify:pipeline have built test/.build.
// Each mutation affects only disposable compiler output. Every mutated file is
// restored to its pristine SHA-256, and the tracked worktree fingerprint must be
// unchanged when the run ends.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const build = fileURLToPath(new URL('./.build/', import.meta.url));
const testRoot = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const git = (...args) => {
  const run = spawnSync('git', args, { cwd: repoRoot, encoding: 'buffer', maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
  assert.equal(run.status, 0, `git ${args.join(' ')}`);
  return run.stdout;
};
const fingerprint = () => sha256(Buffer.concat([
  git('rev-parse', 'HEAD'), git('status', '--porcelain=v1', '--untracked-files=all'), git('diff', 'HEAD', '--binary'),
]));
const runNode = (args) => spawnSync(process.execPath, args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const blocksOnly = ['--input-type=module', '-e',
  "import { verifyR05Blocks } from './packages/inference/test/verify_r05.mjs'; verifyR05Blocks();"];

const cases = [
  { name: 'elite block +1 set', file: 'blockGenerator.js',
    from: 'baseSets = clamp(baseSets, 2, 6);',
    to: "if (profile.training_age === 'elite') baseSets += 1; baseSets = clamp(baseSets, 2, 6);",
    verifier: 'verify_blocks.mjs', expected: 'R05 block tier-only dose' },
  { name: 'advanced/elite routine +1 set', file: 'routineMicrocycle.js',
    from: 'beginner: -1, intermediate: 0, advanced: 0, elite: 0,',
    to: 'beginner: -1, intermediate: 0, advanced: 1, elite: 1,',
    verifier: 'verify_pipeline.mjs', expected: 'R05 routine tier-only dose' },
  { name: 'advanced family budget uplift', file: 'routineMicrocycle.js',
    from: 'advanced: { session: 32, week: 60 },',
    to: 'advanced: { session: 40, week: 80 },',
    verifier: 'verify_pipeline.mjs', expected: 'R05 routine tier-only dose' },
  { name: 'elite family budget uplift', file: 'routineMicrocycle.js',
    from: 'elite: { session: 32, week: 60 },',
    to: 'elite: { session: 48, week: 100 },',
    verifier: 'verify_pipeline.mjs', expected: 'R05 routine tier-only dose' },
  { name: 'compatibility-composer advanced/elite +1 set', file: 'routineComposer.js',
    from: 'beginner: -1, intermediate: 0, advanced: 0, elite: 0',
    to: 'beginner: -1, intermediate: 0, advanced: 1, elite: 1',
    verifier: 'verify_pipeline.mjs', expected: 'R05 legacy tier-only dose' },
  { name: 'empty block output cannot pass vacuously', file: 'blockGenerator.js',
    append: '\nexports.generateBlock = () => ({ sessions: [] });\n',
    args: blocksOnly, expected: 'R05 non-vacuity' },
  { name: 'empty routine output cannot pass vacuously', file: 'routineMicrocycle.js',
    append: '\nexports.composeRoutineMicrocycle = () => ({ prescriptions: [], familyDecisions: [], warnings: [], recommendations: [], adaptations: [], blockers: [] });\n',
    verifier: 'verify_pipeline.mjs', expected: 'R05 non-vacuity: every routine prescription executes' },
  { name: 'empty compatibility-composer output cannot pass vacuously', file: 'routineComposer.js',
    append: '\nexports.composeRoutine = () => ({ slots: [], warnings: [], blockers: [] });\n',
    verifier: 'verify_pipeline.mjs', expected: 'R05 legacy non-vacuity' },
  { name: 'beginner block set reduction removed', file: 'blockGenerator.js',
    from: "if (profile.training_age === 'beginner')",
    to: "if (profile.training_age === 'beginner' && false)",
    args: blocksOnly, expected: 'R05 preserve beginner reduction' },
  { name: 'beginner eligibility widened', file: 'tierPolicy.js',
    from: "if (trainingAge === 'beginner') {",
    to: "if (trainingAge === 'beginner') { return true;",
    verifier: 'verify_blocks.mjs', expected: 'R05 eligibility' },
  { name: 'beginner standalone-routine lock removed', file: 'routineMicrocycle.js',
    from: "if (input.trainingAge === 'beginner') {",
    to: "if (input.trainingAge === 'beginner' && false) {",
    verifier: 'verify_pipeline.mjs', expected: 'R05 beginner standalone eligibility stays closed' },
];

const files = [...new Set(cases.map((test) => test.file))];
for (const file of files) assert.ok(existsSync(build + file), `built file exists: ${file} (run verify:blocks and verify:pipeline first)`);
const pristine = new Map(files.map((file) => [file, sha256(readFileSync(build + file))]));
const worktreeBefore = fingerprint();

// Control: unmutated R05 entry points must pass, so a mutant failure is caused by the mutant.
for (const args of [blocksOnly, [testRoot + 'verify_pipeline.mjs']]) {
  const control = runNode(args);
  assert.equal(control.status, 0, `unmutated control must pass: ${args.at(-1)}\n${control.stdout}${control.stderr}`);
}
console.log('PASS control: unmutated R05 block and pipeline entry points pass');

let detected = 0;
for (const test of cases) {
  const filename = build + test.file;
  const original = readFileSync(filename, 'utf8');
  assert.equal(sha256(original), pristine.get(test.file), `pristine before mutation: ${test.name}`);
  if (test.from !== undefined) assert.equal(original.split(test.from).length - 1, 1, `mutation site exists exactly once: ${test.name}`);
  const mutated = (test.from === undefined ? original : original.replace(test.from, test.to)) + (test.append ?? '');
  assert.notEqual(mutated, original, `mutation changes the file: ${test.name}`);
  try {
    writeFileSync(filename, mutated);
    const run = runNode(test.args ?? [testRoot + test.verifier]);
    assert.notEqual(run.status, 0, `mutant must be rejected: ${test.name}`);
    assert.ok((run.stdout + run.stderr).includes(test.expected), `R05 must detect intended cause: ${test.name}`);
  } finally {
    writeFileSync(filename, original);
  }
  assert.equal(sha256(readFileSync(filename)), pristine.get(test.file), `restored by SHA-256: ${test.name}`);
  detected += 1;
  console.log(`PASS mutation rejected and restored: ${test.name} (${test.expected})`);
}
assert.equal(fingerprint(), worktreeBefore, 'tracked worktree fingerprint unchanged');
console.log(`MUTATION SUMMARY: ${detected}/${cases.length} detected; every file restored to its pristine SHA-256; worktree fingerprint ${worktreeBefore.slice(0, 16)} unchanged`);
