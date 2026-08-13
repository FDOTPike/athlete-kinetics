/**
 * fetch-embedder.mjs — materializes the device embedder assets into
 * packages/inference/assets/minilm/:
 *   model_quantized.onnx  (~23 MB, gitignored — fetched/cached, never committed)
 *   tokenizer.full.json   (gitignored — verification-only staging artifact)
 *   tokenizer.min.json    (committed: WordPiece vocab + specials, ~500 KB)
 *
 * Supply chain is fully pinned (see scripts/embedder-integrity.mjs):
 *   - the immutable HF revision 751bff37182d3f1213fa05d7196b954e230abad9 is
 *     the ONLY default; AK_EMBEDDER_REVISION may override it but must itself
 *     be a full 40-char commit SHA and can never bypass the pinned byte hashes,
 *   - both onnx/model_quantized.onnx and tokenizer.json must verify against
 *     their ratified SHA-256 before any output is touched,
 *   - every artifact (cache, download, OR an already-present output file) goes
 *     through the SAME verifier; nothing unverified is ever installed.
 *
 * Run:  node scripts/fetch-embedder.mjs
 * QA seams (never used by production/CI): set AK_EMBEDDER_CACHE and/or
 * AK_EMBEDDER_OUT to redirect cache/output to temporary paths for a cold
 * pinned download proof.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import {
  MODEL_ID,
  PINNED_REVISION,
  TOKENIZER_MIN_SHA256,
  assertPinnedRevision,
  buildTokenizerMin,
  installVerified,
  sha256File,
  verifyExistingOutput,
} from './embedder-integrity.mjs';

const ROOT = join(import.meta.dirname, '..');
const ASSETS = join(ROOT, 'packages', 'inference', 'assets');
const OUT = process.env.AK_EMBEDDER_OUT
  ? join(process.env.AK_EMBEDDER_OUT)
  : join(ASSETS, 'minilm');
const cb = JSON.parse(readFileSync(join(ASSETS, 'phrase-codebase.json'), 'utf-8'));
if (cb.embeddingModel !== MODEL_ID) {
  throw new Error(
    `codebase embeddingModel ${JSON.stringify(cb.embeddingModel)} does not match the ratified ${JSON.stringify(MODEL_ID)}.`,
  );
}

// The immutable revision is the default. AK_EMBEDDER_REVISION may point at a
// different revision but must be a full 40-hex commit SHA and the artifact
// bytes below must still verify — so it can never bypass the pin.
const MODEL_REVISION = assertPinnedRevision(
  process.env.AK_EMBEDDER_REVISION ?? PINNED_REVISION,
);

// @xenova/transformers v2 local cache. A cache entry that fails verification
// is rejected and replaced only through the pinned download path.
const CACHE = process.env.AK_EMBEDDER_CACHE
  ? join(process.env.AK_EMBEDDER_CACHE, ...MODEL_ID.split('/'))
  : join(ROOT, 'node_modules', '@xenova', 'transformers', '.cache', ...MODEL_ID.split('/'));

mkdirSync(OUT, { recursive: true });

/** Materialize rel into dest via cache or the pinned download. Every source is
 *  staged to a temp path, verified, and only then installed in place of dest;
 *  a failed verification leaves the previous trusted destination untouched. */
async function materialize(rel, dest) {
  const staged = join(dirname(dest), `.${basename(dest)}.stage-${process.pid}`);
  try {
    const cached = join(CACHE, rel);
    if (existsSync(cached)) {
      copyFileSync(cached, staged);
      try {
        const sha = installVerified(rel, staged, dest, 'cache');
        console.log(`from cache (pinned, verified): ${rel}  sha256=${sha}`);
        return;
      } catch (error) {
        console.error(`cache artifact rejected for ${rel}: ${error.message}`);
        try { rmSync(staged, { force: true }); } catch { /* best effort */ }
      }
    }
    const url = `https://huggingface.co/${MODEL_ID}/resolve/${MODEL_REVISION}/${rel}`;
    console.log(`downloading (pinned ${MODEL_REVISION}): ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    await writeFile(staged, Readable.fromWeb(res.body));
    const sha = installVerified(rel, staged, dest, 'download');
    console.log(`downloaded (pinned, verified): ${rel}  sha256=${sha}`);
  } catch (error) {
    try { rmSync(staged, { force: true }); } catch { /* already gone */ }
    throw error;
  }
}

// ONNX: an already-present output file is ONLY accepted when it verifies.
// A stale or corrupted output is refused and replaced through the pinned
// cache/download path — "already present" can never bypass verification.
const onnxDest = join(OUT, 'model_quantized.onnx');
if (existsSync(onnxDest)) {
  try {
    const sha = verifyExistingOutput('onnx/model_quantized.onnx', onnxDest);
    console.log(`already present and verified: model_quantized.onnx  sha256=${sha}`);
  } catch (error) {
    console.error(`existing model_quantized.onnx FAILED verification: ${error.message}`);
    await materialize('onnx/model_quantized.onnx', onnxDest);
  }
} else {
  await materialize('onnx/model_quantized.onnx', onnxDest);
}

// tokenizer.json is always re-obtained (cache or pinned download) and verified
// into tokenizer.full.json.
const tokJsonPath = join(OUT, 'tokenizer.full.json');
await materialize('tokenizer.json', tokJsonPath);

// Distill into the minimal device structure. The DISTILLED bytes are
// ratified: regeneration must reproduce TOKENIZER_MIN_SHA256 exactly or the
// script fails closed (a behavior-changing distiller or vocab drift is
// refused rather than shipped silently).
const tok = JSON.parse(readFileSync(tokJsonPath, 'utf-8'));
const min = buildTokenizerMin(tok, MODEL_ID);
for (const t of ['[CLS]', '[SEP]', '[UNK]', '[PAD]']) {
  if (min.vocab[t] === undefined) throw new Error(`special token missing from vocab: ${t}`);
}
const minPath = join(OUT, 'tokenizer.min.json');
writeFileSync(minPath, JSON.stringify(min));
const minSha = sha256File(minPath);
if (minSha !== TOKENIZER_MIN_SHA256) {
  throw new Error(
    `CHECKSUM MISMATCH for tokenizer.min.json (regenerated): got ${minSha}, ` +
      `pinned ${TOKENIZER_MIN_SHA256} — refusing the artifact.`,
  );
}
console.log(
  `wrote tokenizer.min.json (${Object.keys(min.vocab).length} vocab entries, sha256=${minSha}, ratified/byte-identical)`,
);