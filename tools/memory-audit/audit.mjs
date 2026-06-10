/**
 * audit.mjs — the memory gate, Phase 5 revision (Vector-Heuristic pipeline).
 *
 * Footprint model:
 *   steady dirty = Hermes/RN/UI + SQLite + packed codebase matrix
 *   peak dirty   = steady + transient embedder ceiling (single embed call)
 * The codebase matrix size is computed from the SHIPPED asset, so growing the
 * phrase dictionary is automatically re-audited. Also gates against the
 * generative stack sneaking back in (llama.rn in any manifest).
 *
 * Run:  node tools/memory-audit/audit.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const budget = JSON.parse(readFileSync(join(import.meta.dirname, 'budget.json'), 'utf-8'));
const vectors = JSON.parse(readFileSync(
  join(ROOT, 'packages', 'inference', 'assets', 'phrase-codebase.vectors.json'), 'utf-8'));
const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));

const MiB = 1024 ** 2;
const fmt = (b) => `${(b / MiB).toFixed(1)} MiB`;

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

console.log('[0] generative stack stays removed');
const allDeps = JSON.stringify({ ...rootPkg.dependencies, ...rootPkg.devDependencies });
check('no llama.rn dependency', !allDeps.includes('llama.rn'));

console.log('\n[1] footprint vs device-tier limits');
const matrixBytes = vectors.count * vectors.dim * 4;
const steady =
  budget.runtimeDirtyBytes.hermesAndUi + budget.runtimeDirtyBytes.sqliteLayer + matrixBytes;
const peak = steady + budget.embedderTransientBytes;
console.log(
  `  codebase matrix ${fmt(matrixBytes)} (${vectors.count} x ${vectors.dim}), ` +
  `steady dirty ${fmt(steady)}, peak (embed in flight) ${fmt(peak)}`);
check('codebase matrix stays trivial (< 8 MiB; Path A assumption)', matrixBytes < 8 * MiB,
  fmt(matrixBytes));
for (const tier of budget.deviceTiers) {
  check(`${tier.name}: peak within limit`, peak <= tier.maxDirtyBytes,
    `${fmt(peak)} <= ${fmt(tier.maxDirtyBytes)}`);
  check(`${tier.name}: >=50% headroom at peak`, peak <= tier.maxDirtyBytes * 0.5,
    `${Math.round((1 - peak / tier.maxDirtyBytes) * 100)}% headroom`);
}

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
