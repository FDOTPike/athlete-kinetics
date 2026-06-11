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
const redFlag = require('./.build/semantic/redFlag.js');

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

// --- 5. red-flag lexical override -------------------------------------------------
console.log('[5] red-flag override (scan + arbitration with live embeddings)');

// 5a. scanner precision: gym vocabulary must NOT trigger
const noFlag = [
  'working on shoulder stability drills',
  'did chest press today, felt strong',
  'feeling sharp and fast today',
  'popped my headphones in and trained',
  'snapped the bar off the floor fast',  // 'snap' negation-free but... see 5b
];
// 'snapped' IS a tier-1 token — that line SHOULD flag (documented conservative
// false positive). Keep it out of the no-flag set:
noFlag.pop();
for (const text of noFlag) {
  const s = redFlag.scanRedFlags(text);
  check(`no flag: "${text.slice(0, 40)}"`, !s.pain && !s.systemic,
    s.matched.join(','));
}
check('negation suppresses: "feeling strong, no pain at all"',
  !redFlag.scanRedFlags('feeling strong, no pain at all').pain);
check('flags: "my back hurts"', redFlag.scanRedFlags('my back hurts').pain);
check('flags via tier2+region: "sharp twinge in my knee"',
  redFlag.scanRedFlags('sharp twinge in my knee').pain);
check('systemic bigram: "chest pressure on the last set"',
  redFlag.scanRedFlags('chest pressure on the last set').systemic);
check('documented conservative FP: "snapped the bar off the floor"',
  redFlag.scanRedFlags('snapped the bar off the floor').pain);

// 5b. keyword-only path (embedder absent)
const koPain = redFlag.resolveReport('my knee hurts', null);
check('embedder-null + pain language -> red-flag-pain, confident',
  koPain.confident && koPain.entry.id === 'red-flag-pain' && koPain.similarity === null &&
  koPain.overrideApplied);
const koClean = redFlag.resolveReport('solid session, all moving well', null);
check('embedder-null + clean language -> not confident, no override',
  !koClean.confident && koClean.entry === null && !koClean.overrideApplied);
check('halt override carries zero load and zero cap (invariant)',
  redFlag.RED_FLAG_SYSTEMIC.guardrail.halt &&
  redFlag.RED_FLAG_SYSTEMIC.guardrail.load_multiplier === 0 &&
  redFlag.RED_FLAG_SYSTEMIC.guardrail.rpe_cap_max === 0);
check('pain override is conservative (mult<=1, delta<=0)',
  redFlag.RED_FLAG_PAIN.guardrail.load_multiplier <= 1 &&
  redFlag.RED_FLAG_PAIN.guardrail.set_delta <= 0);

// 5c. arbitration with live semantic triage
const resolveLive = async (text) =>
  redFlag.resolveReport(text, triageMod.triage(await embedOne(text), loaded));
let r5 = await resolveLive('my back hurts');
check('"my back hurts" -> confident conservative outcome (floor or curated pain)',
  r5.confident && r5.entry !== null &&
  (r5.entry.category === 'pain') && r5.entry.guardrail.rpe_cap_max <= 7.0,
  `${r5.entry?.id} override=${r5.overrideApplied}`);
r5 = await resolveLive('felt a sharp pop in my knee mid set');
check('curated halt keeps supremacy over the floor',
  r5.entry?.id === 'pain-sharp' && !r5.overrideApplied);
r5 = await resolveLive('quads still hurt from the last squat day');
check('confident body-state match NOT degraded to the floor',
  r5.confident && !r5.overrideApplied &&
  ['soreness-doms', 'pain-mild', 'pain-moderate', 'fatigue-heavy'].includes(r5.entry?.id),
  r5.entry?.id);
r5 = await resolveLive('weights are flying up but my elbow hurts');
check('mixed report misrouted to positive gets overridden',
  r5.confident && r5.entry.guardrail.rpe_cap_max <= 7.0,
  `${r5.entry?.id} override=${r5.overrideApplied}`);
r5 = await resolveLive('bit woozy and lightheaded after that set');
check('systemic language ends in a halt (curated or override)',
  r5.confident && r5.entry.guardrail.halt === true, r5.entry?.id);
r5 = await resolveLive('feeling amazing, weights are flying up');
check('clean positive report untouched by the override layer',
  !r5.overrideApplied && r5.entry?.id === 'positive-strong');

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}  (routing ${routedOk}/${CASES.length})`);
process.exit(fail ? 1 : 0);
