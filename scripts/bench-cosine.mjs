/**
 * bench-cosine.mjs — settles Path A (JS-memory cosine) vs Path B (sqlite-vec).
 *
 * Measures brute-force top-1 cosine over normalized Float32Array codebases at
 * realistic and absurd scales, 384-dim (MiniLM-class). Vectors are unit-norm,
 * so cosine == dot product. Numbers below are V8; Hermes has no JIT, so apply
 * a conservative 20x penalty when reading the verdict.
 *
 * Run:  node scripts/bench-cosine.mjs
 */
const DIM = 384;
const SCALES = [100, 1_000, 5_000, 50_000];
const HERMES_PENALTY = 20;

function randUnit(dim) {
  const v = new Float32Array(dim);
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    v[i] = Math.random() * 2 - 1;
    norm += v[i] * v[i];
  }
  norm = Math.sqrt(norm);
  for (let i = 0; i < dim; i++) v[i] /= norm;
  return v;
}

// Flat-packed matrix: the layout the production scorer uses (cache-friendly,
// one allocation, no per-entry object overhead).
function pack(n) {
  const m = new Float32Array(n * DIM);
  for (let i = 0; i < n; i++) m.set(randUnit(DIM), i * DIM);
  return m;
}

function top1(matrix, n, query) {
  let best = -2;
  let bestIdx = -1;
  for (let i = 0; i < n; i++) {
    const off = i * DIM;
    let dot = 0;
    for (let j = 0; j < DIM; j++) dot += matrix[off + j] * query[j];
    if (dot > best) {
      best = dot;
      bestIdx = i;
    }
  }
  return bestIdx;
}

console.log(`brute-force top-1 cosine, ${DIM}-dim unit vectors (V8)\n`);
console.log('  codebase   V8 median   Hermes est. (x20)   verdict');
for (const n of SCALES) {
  const matrix = pack(n);
  const queries = Array.from({ length: 32 }, () => randUnit(DIM));
  // warmup
  for (const q of queries) top1(matrix, n, q);
  const times = [];
  for (const q of queries) {
    const t0 = process.hrtime.bigint();
    top1(matrix, n, q);
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  times.sort((a, b) => a - b);
  const med = times[Math.floor(times.length / 2)];
  const hermes = med * HERMES_PENALTY;
  const ramMiB = ((n * DIM * 4) / 1024 ** 2).toFixed(1);
  const verdict = hermes < 16 ? 'imperceptible (<1 frame)' : hermes < 100 ? 'fine for on-submit' : 'needs sqlite-vec';
  console.log(
    `  ${String(n).padStart(7)}   ${med.toFixed(3).padStart(8)} ms   ${hermes.toFixed(1).padStart(8)} ms          ${verdict}   (matrix ${ramMiB} MiB)`,
  );
}
