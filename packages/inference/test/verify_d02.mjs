// Focused D02 verifier: runs the three gates that carry R05 and requires every
// R05 result line with its exact matrix size. Output equality is a
// product-policy and deterministic-software check, not medical validation.
// Run: node packages/inference/test/verify_d02.mjs
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const gates = [
  { script: 'verify:blocks', required: [
    'PASS  R05 block counterfactual: 3072 tier comparisons, plus beginner safety',
    'PASS  R05 eligibility: 192 tier-law rows, beginner whitelist and drop, advanced/elite identity',
  ] },
  { script: 'verify:pipeline', required: [
    'PASS  R05 legacy counterfactual: 256 comparisons across all four roles, plus beginner safety and availability',
    'PASS R05 legacy routine experience-only workload',
    'PASS  R05 routine counterfactual: 3584 tier comparisons across seven families, builder/save and freeze',
    'PASS R05 experience-only routine workload',
  ] },
  { script: 'verify:autopilot', required: [
    'PASS  R05 block counterfactual: 12288 tier comparisons, plus beginner safety',
  ] },
];
let failures = 0;
for (const gate of gates) {
  const run = spawnSync('npm', ['run', gate.script], { cwd: repoRoot, encoding: 'utf8', shell: true,
    maxBuffer: 64 * 1024 * 1024 });
  const output = `${run.stdout}\n${run.stderr}`;
  const missing = gate.required.filter((line) => !output.includes(line));
  const r05Failures = output.split(/\r?\n/).filter((line) => /FAIL/.test(line) && /R05/.test(line));
  const ok = run.status === 0 && missing.length === 0 && r05Failures.length === 0;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${gate.script}: exit ${run.status}, ${gate.required.length - missing.length}/${gate.required.length} R05 results`);
  for (const line of missing) console.log(`        missing: ${line}`);
  for (const line of r05Failures) console.log(`        ${line.trim()}`);
}
console.log(failures === 0 ? 'D02 FOCUSED VERIFY PASSED' : `D02 FOCUSED VERIFY FAILED (${failures} gate(s))`);
process.exit(failures === 0 ? 0 : 1);
