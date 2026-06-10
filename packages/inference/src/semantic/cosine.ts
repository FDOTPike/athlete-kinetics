/**
 * cosine.ts — Path A vector math: brute-force cosine over a flat-packed
 * Float32Array, chosen over sqlite-vec by measurement (scripts/bench-cosine.mjs):
 * at phrase-codebase scale (100-1000 vectors, 384-dim) a full scan is
 * 0.8-8 ms even under Hermes' no-JIT 20x penalty, and the packed matrix is
 * ~1.5 MiB — irrelevant to Jetsam. Escalation path: if the codebase ever
 * exceeds ~50k vectors, enable op-sqlite's `sqliteVec` build flag and swap
 * the scan behind this same interface.
 *
 * All vectors MUST be L2-normalized (normalize() below); cosine then reduces
 * to a dot product.
 */

export function normalize(v: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return v;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
}

/** Pack row vectors into one cache-friendly matrix (normalizing each row). */
export function packVectors(rows: readonly (readonly number[])[], dim: number): Float32Array {
  const matrix = new Float32Array(rows.length * dim);
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].length !== dim) {
      throw new Error(`vector ${i} has dim ${rows[i].length}, expected ${dim}`);
    }
    matrix.set(normalize(Float32Array.from(rows[i])), i * dim);
  }
  return matrix;
}

export interface Match {
  index: number;
  score: number;
}

/** Top-k by cosine (dot product over normalized vectors). k is tiny (1-3),
 *  so a simple insertion pass beats heap bookkeeping. */
export function topK(
  matrix: Float32Array,
  count: number,
  dim: number,
  query: Float32Array,
  k: number,
): Match[] {
  if (query.length !== dim) throw new Error(`query dim ${query.length}, expected ${dim}`);
  const best: Match[] = [];
  for (let i = 0; i < count; i++) {
    const off = i * dim;
    let dot = 0;
    for (let j = 0; j < dim; j++) dot += matrix[off + j] * query[j];
    if (best.length < k || dot > best[best.length - 1].score) {
      let pos = best.length;
      while (pos > 0 && best[pos - 1].score < dot) pos--;
      best.splice(pos, 0, { index: i, score: dot });
      if (best.length > k) best.pop();
    }
  }
  return best;
}
