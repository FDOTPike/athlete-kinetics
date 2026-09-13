// Run after build:inference-test and verify:pipeline. Mutations affect only
// disposable compiler output; always restore it, even after a failed check.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const build = fileURLToPath(new URL('./.build/', import.meta.url));
const testRoot = fileURLToPath(new URL('.', import.meta.url));
const cases = [
  { name: 'elite block bonus', file: 'blockGenerator.js',
    from: 'baseSets = clamp(baseSets, 2, 6);',
    to: "if (profile.training_age === 'elite') baseSets += 1; baseSets = clamp(baseSets, 2, 6);",
    verifier: 'verify_blocks.mjs', expected: 'R05 block tier-only dose' },
  { name: 'advanced/elite routine default bonus', file: 'routineMicrocycle.js',
    from: 'beginner: -1, intermediate: 0, advanced: 0, elite: 0,',
    to: 'beginner: -1, intermediate: 0, advanced: 1, elite: 1,',
    verifier: 'verify_pipeline.mjs', expected: 'R05 routine tier-only dose' },
  { name: 'advanced/elite family budget bonus', file: 'routineMicrocycle.js',
    from: 'advanced: { session: 32, week: 60 },',
    to: 'advanced: { session: 40, week: 80 },',
    verifier: 'verify_pipeline.mjs', expected: 'R05 routine tier-only dose' },
  { name: 'legacy advanced/elite default bonus', file: 'routineComposer.js',
    from: 'beginner: -1, intermediate: 0, advanced: 0, elite: 0',
    to: 'beginner: -1, intermediate: 0, advanced: 1, elite: 1',
    verifier: 'verify_pipeline.mjs', expected: 'R05 legacy tier-only dose' },
  { name: 'empty block cannot pass vacuously', file: 'blockGenerator.js',
    from: 'function generateBlock(', to: 'function generateBlock(',
    append: '\nexports.generateBlock = () => ({ sessions: [] });\n',
    verifier: 'verify_blocks.mjs', expected: 'R05 non-vacuity' },
];
for (const test of cases) {
  const filename = build + test.file;
  const original = readFileSync(filename, 'utf8');
  assert.ok(original.includes(test.from), `mutation site exists: ${test.name}`);
  try {
    writeFileSync(filename, original.replace(test.from, test.to) + (test.append ?? ''));
    const args = test.append
      ? ['--input-type=module', '-e', `import { verifyR05Blocks } from './packages/inference/test/verify_r05.mjs'; verifyR05Blocks();`]
      : [testRoot + test.verifier];
    const run = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    assert.equal(run.status, 1, `mutant must be rejected: ${test.name}`);
    assert.ok((run.stdout + run.stderr).includes(test.expected), `R05 must detect intended cause: ${test.name}`);
    console.log(`PASS mutation rejected: ${test.name} (${test.expected})`);
  } finally {
    writeFileSync(filename, original);
  }
}
