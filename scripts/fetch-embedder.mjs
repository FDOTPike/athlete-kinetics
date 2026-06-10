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
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { writeFile } from 'node:fs/promises';

const ROOT = join(import.meta.dirname, '..');
const ASSETS = join(ROOT, 'packages', 'inference', 'assets');
const OUT = join(ASSETS, 'minilm');
const cb = JSON.parse(readFileSync(join(ASSETS, 'phrase-codebase.json'), 'utf-8'));
const MODEL_ID = cb.embeddingModel; // e.g. "Xenova/all-MiniLM-L6-v2"
const CACHE = join(ROOT, 'node_modules', '@xenova', 'transformers', '.cache', ...MODEL_ID.split('/'));

mkdirSync(OUT, { recursive: true });

async function materialize(rel, dest) {
  const cached = join(CACHE, rel);
  if (existsSync(cached)) {
    copyFileSync(cached, dest);
    console.log(`from cache: ${rel}`);
    return;
  }
  const url = `https://huggingface.co/${MODEL_ID}/resolve/main/${rel}`;
  console.log(`downloading: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await writeFile(dest, Readable.fromWeb(res.body));
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
