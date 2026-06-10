/**
 * verify_embedder.mjs — proves the DEVICE embedding pipeline (pure-TS
 * WordPiece + ONNX session + mean-pool/normalize) is interchangeable with
 * the build-time pipeline (@xenova/transformers) that produced the codebase
 * vectors:
 *   1. tokenizer parity: EXACT input_ids equality per phrase,
 *   2. embedding parity: cosine >= 0.999 per phrase against transformers.js,
 *   3. end-to-end: the 15 routing cases produce identical triage decisions
 *      through the device pipeline.
 * Runs the same ONNX file the phone will ship (onnxruntime-node here,
 * onnxruntime-react-native there — same API surface, injected).
 *
 * Run:  npm run verify:embedder   (fetch-embedder.mjs must have run once)
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const cosineMod = require('./.build/semantic/cosine.js');
const cbMod = require('./.build/semantic/codebase.js');
const triageMod = require('./.build/semantic/triage.js');
const { createMiniLmEmbedder } = require('./.build/semantic/onnxEmbedder.js');

const ASSETS = join(import.meta.dirname, '..', 'assets');
const MODEL = join(ASSETS, 'minilm', 'model_quantized.onnx');
const TOK = join(ASSETS, 'minilm', 'tokenizer.min.json');
if (!existsSync(MODEL) || !existsSync(TOK)) {
  console.error('embedder assets missing — run: node scripts/fetch-embedder.mjs');
  process.exit(1);
}
const codebase = JSON.parse(readFileSync(join(ASSETS, 'phrase-codebase.json'), 'utf-8'));
const vecFile = JSON.parse(readFileSync(join(ASSETS, 'phrase-codebase.vectors.json'), 'utf-8'));
const tokenizerSpec = JSON.parse(readFileSync(TOK, 'utf-8'));

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};
const cosine = (a, b) => {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
};

// --- device-pipeline embedder (the code the phone runs) ----------------------
const ort = await import('onnxruntime-node');
const session = await ort.InferenceSession.create(MODEL);
const device = createMiniLmEmbedder({ session, Tensor: ort.Tensor, tokenizer: tokenizerSpec });

// --- reference pipeline (built the codebase vectors) --------------------------
const { AutoTokenizer, pipeline } = await import('@xenova/transformers');
const refTokenizer = await AutoTokenizer.from_pretrained(codebase.embeddingModel);
const refPipe = await pipeline('feature-extraction', codebase.embeddingModel, { quantized: true });
const refEmbed = async (t) => {
  const o = await refPipe(t, { pooling: 'mean', normalize: true });
  return Float32Array.from(o.data);
};

const PHRASES = cbMod.flattenTexts(codebase).map((r) => r.text);
const QUERIES = [
  'injury feels 3/10 pain',
  'my elbow is a bit sore but trainable',
  'felt a sharp pop in my knee mid set',
  'stabbing 8/10 pain in my back',
  'I feel dizzy and lightheaded after that set',
  'pressure in my chest and short of breath',
  'I have a fever and my whole body aches',
  'only got four hours of sleep, completely wrecked',
  'bar speed is super slow, everything feels heavy',
  'quads still destroyed from the last squat day',
  'my lower back keeps rounding on deadlifts',
  'feeling amazing, weights are flying up',
  'stuck in a hotel with just dumbbells',
  'what is the capital of France',
  'the bus was late this morning',
];
const TRICKY = [
  "Knee's @ 3/10 -- REALLY sore!!",
  '5x5 @ 140kg RPE 8.5, last rep slow',
  'cafe legs after yesterday, tres fatigue',
  'OK',
  'shoulder pain (left side), 6/10... sharp-ish?',
];
const CORPUS = [...PHRASES, ...QUERIES, ...TRICKY];

// --- 1. tokenizer parity -------------------------------------------------------
console.log(`[1] tokenizer parity over ${CORPUS.length} strings`);
const { WordPieceTokenizer } = require('./.build/semantic/wordpiece.js');
const wp = new WordPieceTokenizer(tokenizerSpec);
let tokMismatch = null;
for (const text of CORPUS) {
  const mine = wp.encode(text, 128);
  const ref = Array.from((await refTokenizer(text)).input_ids.data, Number);
  if (mine.length !== ref.length || mine.some((x, i) => x !== ref[i])) {
    tokMismatch = { text, mine: mine.slice(0, 12), ref: ref.slice(0, 12) };
    break;
  }
}
check('exact input_ids equality for every string', tokMismatch === null,
  tokMismatch === null ? `${CORPUS.length}/${CORPUS.length}` : JSON.stringify(tokMismatch).slice(0, 140));

// --- 2. embedding parity ---------------------------------------------------------
console.log('[2] embedding parity (device ONNX vs transformers.js)');
let worst = 1;
let worstText = '';
for (const text of CORPUS) {
  const a = await device.embed(text);
  const b = await refEmbed(text);
  const c = cosine(a, b);
  if (c < worst) {
    worst = c;
    worstText = text;
  }
}
check('cosine >= 0.999 for every string', worst >= 0.999,
  `worst ${worst.toFixed(6)} ("${worstText.slice(0, 36)}")`);

// --- 3. identical triage decisions through the device pipeline -------------------
console.log('[3] routing equivalence end-to-end');
const loaded = cbMod.loadCodebase(codebase, vecFile.vectors);
const EXPECT = ['pain-mild', 'pain-mild', 'pain-sharp', 'pain-sharp', 'dizzy', 'pain-chest',
  'illness-systemic', 'fatigue-sleep', 'fatigue-heavy', 'soreness-doms',
  'technique-breakdown', 'positive-strong', 'equipment-improvised', null, null];
let routed = 0;
for (let i = 0; i < QUERIES.length; i++) {
  const v = await device.embed(QUERIES[i]);
  const r = triageMod.triage(v, loaded);
  const got = r.confident ? r.entry.id : null;
  if (got === EXPECT[i]) routed += 1;
  else console.log(`        mismatch: "${QUERIES[i]}" -> ${got} (want ${EXPECT[i]}) @ ${r.similarity.toFixed(3)}`);
}
check(`all ${QUERIES.length} routing decisions identical`, routed === QUERIES.length,
  `${routed}/${QUERIES.length}`);

// --- 4. embed latency sanity ------------------------------------------------------
const t0 = performance.now();
for (let i = 0; i < 10; i++) await device.embed('my knee hurts a little today');
const ms = (performance.now() - t0) / 10;
console.log(`[4] embed latency (workstation, int8 CPU): ${ms.toFixed(1)} ms/query`);
check('single-query embed under 250 ms on workstation', ms < 250, `${ms.toFixed(1)} ms`);

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
