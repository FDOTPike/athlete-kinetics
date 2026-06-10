/**
 * embed-codebase.mjs — build-time embedding of the Phrase Codebase.
 *
 * Uses @xenova/transformers (pure JS, free, local cache) with the model id
 * declared in the codebase JSON, so build-time codebase vectors and
 * device-time query vectors (onnxruntime-react-native, same ONNX weights)
 * share one embedding space. Output is a checked-in asset: the device NEVER
 * embeds the codebase, only single user queries.
 *
 * Run:  node scripts/embed-codebase.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const ASSETS = join(ROOT, 'packages', 'inference', 'assets');
const cb = JSON.parse(readFileSync(join(ASSETS, 'phrase-codebase.json'), 'utf-8'));

// Mirror of codebase.ts flattenTexts(): entry text, then aliases, per entry.
const rows = [];
cb.entries.forEach((e, entryIndex) => {
  rows.push({ text: e.text, entryIndex });
  for (const a of e.aliases) rows.push({ text: a, entryIndex });
});

console.log(`embedding ${rows.length} phrases with ${cb.embeddingModel} ...`);
const { pipeline } = await import('@xenova/transformers');
const embed = await pipeline('feature-extraction', cb.embeddingModel, { quantized: true });

const vectors = [];
for (const r of rows) {
  const out = await embed(r.text, { pooling: 'mean', normalize: true });
  const v = Array.from(out.data, (x) => Number(x.toFixed(6)));
  if (v.length !== cb.dim) {
    console.error(`dim mismatch: got ${v.length}, expected ${cb.dim}`);
    process.exit(1);
  }
  vectors.push(v);
}

const outPath = join(ASSETS, 'phrase-codebase.vectors.json');
writeFileSync(
  outPath,
  JSON.stringify({ embeddingModel: cb.embeddingModel, dim: cb.dim, count: vectors.length, vectors }),
);
console.log(`wrote ${vectors.length} x ${cb.dim} vectors -> ${outPath}`);
