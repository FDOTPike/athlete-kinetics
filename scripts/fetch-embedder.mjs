/**
 * fetch-embedder.mjs — materializes the device embedder assets into
 * packages/inference/assets/minilm/:
 *   model_quantized.onnx  (~23 MB, gitignored — fetched/cached, never committed)
 *   tokenizer.min.json    (committed: WordPiece vocab + specials, ~500 KB)
 *
 * Source of truth is the SAME model id the codebase vectors were built with
 * (phrase-codebase.json embeddingModel). Reuses the @xenova/transformers
 * local cache when present; downloads from Hugging Face otherwise (free).
 *
 * Run:  node scripts/fetch-embedder.mjs
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { writeFile } from 'node:fs/promises';

const ROOT = join(import.meta.dirname, '..');
const ASSETS = join(ROOT, 'packages', 'inference', 'assets');
const OUT = join(ASSETS, 'minilm');
const cb = JSON.parse(readFileSync(join(ASSETS, 'phrase-codebase.json'), 'utf-8'));
const MODEL_ID = cb.embeddingModel; // e.g. "Xenova/all-MiniLM-L6-v2"
// Supply-chain pinning (audit A5): resolve against a FIXED revision, never the
// mutable 'main', and verify the artifact hash. After the first trusted fetch
// the script prints the sha256 — paste it (and the HF commit hash) here.
const MODEL_REVISION = process.env.AK_EMBEDDER_REVISION ?? 'main'; // TODO(Francis): pin HF commit hash
const KNOWN_SHA256 = {
  // 'onnx/model_quantized.onnx': '<paste sha256 after first trusted fetch>',
};
const CACHE = join(ROOT, 'node_modules', '@xenova', 'transformers', '.cache', ...MODEL_ID.split('/'));

mkdirSync(OUT, { recursive: true });

function verifyArtifact(rel, dest, source) {
  const sha = createHash('sha256').update(readFileSync(dest)).digest('hex');
  const expected = KNOWN_SHA256[rel];
  if (expected !== undefined && sha !== expected) {
    throw new Error(`CHECKSUM MISMATCH for ${rel} (${source}): got ${sha}, pinned ${expected} — refusing the artifact.`);
  }
  console.log(`sha256(${rel}) = ${sha}${expected === undefined ? '  <- unpinned: add to KNOWN_SHA256' : '  (pinned, verified)'}`);
}

async function materialize(rel, dest) {
  const cached = join(CACHE, rel);
  if (existsSync(cached)) {
    copyFileSync(cached, dest);
    console.log(`from cache: ${rel}`);
    // Audit B7: the cache is NOT trusted implicitly — same verification path.
    verifyArtifact(rel, dest, 'cache');
    return;
  }
  const url = `https://huggingface.co/${MODEL_ID}/resolve/${MODEL_REVISION}/${rel}`;
  console.log(`downloading: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await writeFile(dest, Readable.fromWeb(res.body));
  verifyArtifact(rel, dest, 'download');
  if (MODEL_REVISION === 'main') {
    console.warn('WARNING: fetched from mutable main — pin AK_EMBEDDER_REVISION / MODEL_REVISION before release (audit A5).');
  }
}

const onnxDest = join(OUT, 'model_quantized.onnx');
if (!existsSync(onnxDest)) await materialize('onnx/model_quantized.onnx', onnxDest);
else console.log('already present: model_quantized.onnx');

// Distill tokenizer.json (HF tokenizers format) into the minimal structure
// the pure-TS WordPiece implementation consumes on device.
const tokJsonPath = join(OUT, 'tokenizer.full.json');
await materialize('tokenizer.json', tokJsonPath);
const tok = JSON.parse(readFileSync(tokJsonPath, 'utf-8'));
if (tok.model?.type !== 'WordPiece') throw new Error(`expected WordPiece, got ${tok.model?.type}`);
const min = {
  modelId: MODEL_ID,
  lowercase: tok.normalizer?.lowercase !== false,
  unkToken: tok.model.unk_token,
  continuingPrefix: tok.model.continuing_subword_prefix ?? '##',
  maxInputCharsPerWord: tok.model.max_input_chars_per_word ?? 100,
  vocab: tok.model.vocab,
};
for (const t of ['[CLS]', '[SEP]', '[UNK]', '[PAD]']) {
  if (min.vocab[t] === undefined) throw new Error(`special token missing from vocab: ${t}`);
}
writeFileSync(join(OUT, 'tokenizer.min.json'), JSON.stringify(min));
console.log(`wrote tokenizer.min.json (${Object.keys(min.vocab).length} vocab entries)`);
