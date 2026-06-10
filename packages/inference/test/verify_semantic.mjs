/**
 * verify_semantic.mjs — proves the Vector-Heuristic pipeline end to end:
 *   1. cosine math correctness on known vectors,
 *   2. codebase/vectors asset alignment + safety invariants (a subjective
 *      report can only make a session more conservative; halts are halts),
 *   3. LIVE routing: embeds real user phrasings with the production embedding
 *      model (@xenova/transformers, same weights as the device ONNX) and
 *      asserts they route to the right entries, off-topic text is rejected
 *      by the confidence gate, and guardrail application is monotone.
 *
 * Run AFTER tsc emits to test/.build (npm run verify:semantic does both).
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const cosine = require('./.build/semantic/cosine.js');
const cbMod = require('./.build/semantic/codebase.js');
const triageMod = require('./.build/semantic/triage.js');

const ASSETS = join(import.meta.dirname, '..', 'assets');
const codebase = JSON.parse(readFileSync(join(ASSETS, 'phrase-codebase.json'), 'utf-8'));
const vecFile = JSON.parse(readFileSync(join(ASSETS, 'phrase-codebase.vectors.json'), 'utf-8'));

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

// --- 1. cosine math -----------------------------------------------------------
console.log('[1] cosine math');
const m = cosine.packVectors([[1, 0, 0], [0, 1, 0], [0.6, 0.8, 0]], 3);
const hits = cosine.topK(m, 3, 3, cosine.normalize(Float32Array.from([1, 0.1, 0])), 2);
check('top-1 is the aligned vector', hits[0].index === 0 && hits[0].score > 0.99,
  `idx=${hits[0].index} score=${hits[0].score.toFixed(4)}`);
check('top-2 ordered descending', hits[1].score <= hits[0].score && hits[1].index === 2);
check('packVectors rejects dim mismatch', (() => {
  try { cosine.packVectors([[1, 2]], 3); return false; } catch { return true; }
})());

// --- 2. asset alignment + safety invariants -------------------------------------
console.log('[2] codebase asset + safety invariants');
const texts = cbMod.flattenTexts(codebase);
check('vectors file aligned with flattenTexts order',
  vecFile.count === texts.length && vecFile.dim === codebase.dim,
  `${vecFile.count} vectors for ${texts.length} texts`);
check('embedding model ids match', vecFile.embeddingModel === codebase.embeddingModel);
let conservative = true;
let haltsConsistent = true;
for (const e of codebase.entries) {
  const g = e.guardrail;
  if (g.load_multiplier > 1.0 || g.set_delta > 0 || g.rpe_cap_max > 10) conservative = false;
  if (g.halt && (g.load_multiplier !== 0 || g.rpe_cap_max !== 0)) haltsConsistent = false;
}
check('every guardrail is conservative (mult<=1, delta<=0, cap<=10)', conservative);
check('halt entries carry zero load and zero RPE cap', haltsConsistent);
const loaded = cbMod.loadCodebase(codebase, vecFile.vectors);
check('loadCodebase packs without error', loaded.rowCount === texts.length);
check('loadCodebase rejects misaligned vectors', (() => {
  try { cbMod.loadCodebase(codebase, vecFile.vectors.slice(1)); return false; } catch { return true; }
})());

// --- 3. live routing with the production embedding model ------------------------
console.log('[3] live routing (embedding real queries with MiniLM)');
const { pipeline } = await import('@xenova/transformers');
const embed = await pipeline('feature-extraction', codebase.embeddingModel, { quantized: true });
const embedOne = async (text) => {
  const o = await embed(text, { pooling: 'mean', normalize: true });
  return Float32Array.from(o.data);
};

const CASES = [
  // [query, expected entry id or null for "must not be confident"]
  ['injury feels 3/10 pain', 'pain-mild'],
  ['my elbow is a bit sore but trainable', 'pain-mild'],
  ['felt a sharp pop in my knee mid set', 'pain-sharp'],
  ['stabbing 8/10 pain in my back', 'pain-sharp'],
  ['I feel dizzy and lightheaded after that set', 'dizzy'],
  ['pressure in my chest and short of breath', 'pain-chest'],
  ['I have a fever and my whole body aches', 'illness-systemic'],
  ['only got four hours of sleep, completely wrecked', 'fatigue-sleep'],
  ['bar speed is super slow, everything feels heavy', 'fatigue-heavy'],
  ['quads still destroyed from the last squat day', 'soreness-doms'],
  ['my lower back keeps rounding on deadlifts', 'technique-breakdown'],
  ['feeling amazing, weights are flying up', 'positive-strong'],
  ['stuck in a hotel with just dumbbells', 'equipment-improvised'],
  ['what is the capital of France', null],
  ['the bus was late this morning', null],
];

let routedOk = 0;
for (const [query, expected] of CASES) {
  const v = await embedOne(query);
  const result = triageMod.triage(v, loaded);
  const got = result.confident ? result.entry.id : null;
  const ok = got === expected;
  if (ok) routedOk += 1;
  check(`"${query.slice(0, 44)}" -> ${expected ?? 'REJECT'}`, ok,
    `got ${got ?? 'REJECT'} @ ${result.similarity.toFixed(3)}`);
}

// --- 4. guardrail application is monotone conservative ---------------------------
console.log('[4] guardrail application');
const base = { load_modifier: 1.05, set_modifier: 1, rpe_cap: 9.5, coaching_cue: 'hold planned loads today.' };
const mild = codebase.entries.find((e) => e.id === 'pain-mild');
const d1 = triageMod.applyGuardrail(base, mild, 0.8);
check('pain-mild on a boost day: load 1.05 -> 0.74, cap 9.5 -> 7.0',
  Math.abs(d1.vector.load_modifier - 0.74) < 0.005 && d1.vector.rpe_cap === 7.0 && !d1.halt,
  `${d1.vector.load_modifier}/${d1.vector.set_modifier}/${d1.vector.rpe_cap}`);
check('follow-up question surfaces', d1.followUp === 'Does the pain worsen as the set progresses?');
const sharp = codebase.entries.find((e) => e.id === 'pain-sharp');
const d2 = triageMod.applyGuardrail(base, sharp, 0.9);
check('pain-sharp: halt with zero load regardless of policy',
  d2.halt && d2.vector.load_modifier === 0 && d2.vector.rpe_cap === 0);
const positive = codebase.entries.find((e) => e.id === 'positive-strong');
const d3 = triageMod.applyGuardrail(base, positive, 0.9);
check('positive report never raises anything above policy',
  d3.vector.load_modifier <= base.load_modifier &&
  d3.vector.set_modifier <= base.set_modifier &&
  d3.vector.rpe_cap <= base.rpe_cap);

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}  (routing ${routedOk}/${CASES.length})`);
process.exit(fail ? 1 : 0);
