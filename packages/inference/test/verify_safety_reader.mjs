/**
 * verify_safety_reader.mjs — deterministic unit, poisoning, negative-invariant,
 * and cross-model serialization verification for Stream 2 (`M10 R15 s3` +
 * `r15/denial-floor`).
 *
 * Covers:
 *   1. Exact pinned provenance constants (class order, SHA-256, bytes, lock, token limit).
 *   2. Whole-sentence denial grammar (`isHarmlessDenial`) positive & adversarial cases.
 *   3. `combineDenialFloor` truth table across all 8 decision branches, no-op
 *      normalization, and graceful degradation when reader output is null.
 *   4. `runSafetyReaderInference` fail-closed guards on poisoned tensors (bad dims,
 *      NaN/Infinity, missing outputs, zero caution boundary, tie-breaking, benign exclusion).
 *   5. Shared `createSerializedOrtScheduler` cross-model concurrency invariant
 *      (embedder + safety reader bombarded concurrently -> maxConcurrent === 1,
 *      disposal settles strictly before next create, error isolation, plus a
 *      self-falsifier proving unshared schedulers DO overlap to concurrency === 2).
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const denialMod = require('./.build/semantic/denialGrammar.js');
const readerMod = require('./.build/semantic/safetyReader.js');
const onnxMod = require('./.build/semantic/onnxEmbedder.js');
const redFlagMod = require('./.build/semantic/redFlag.js');
const { WordPieceTokenizer } = require('./.build/semantic/wordpiece.js');

const ASSETS = join(import.meta.dirname, '..', 'assets');
const codebase = JSON.parse(readFileSync(join(ASSETS, 'phrase-codebase.json'), 'utf-8'));
const tokenizerSpec = JSON.parse(readFileSync(join(ASSETS, 'minilm', 'tokenizer.min.json'), 'utf-8'));

const entryById = new Map(codebase.entries.map((e) => [e.id, e]));

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

class FakeTensor {
  constructor(type, data, dims) {
    this.type = type;
    this.data = data;
    this.dims = dims;
  }
}

console.log('=== [1] Pinned Stream 2 Constants & Surface ===');
const EXPECTED_CLASSES = [
  'dizzy',
  'equipment-improvised',
  'fatigue-heavy',
  'fatigue-sleep',
  'illness-systemic',
  'pain-chest',
  'pain-mild',
  'pain-moderate',
  'pain-sharp',
  'positive-strong',
  'soreness-doms',
  'technique-breakdown',
  'benign',
];
check(
  'SAFETY_READER_CLASSES matches exact 13-class order ending with benign',
  Array.isArray(readerMod.SAFETY_READER_CLASSES)
    && readerMod.SAFETY_READER_CLASSES.length === EXPECTED_CLASSES.length
    && readerMod.SAFETY_READER_CLASSES.every((c, i) => c === EXPECTED_CLASSES[i]),
);
check('SAFETY_READER_MODEL_ID pinned', readerMod.SAFETY_READER_MODEL_ID === 'm10-r15-reader-seed3');
check('SAFETY_READER_POLICY_ID pinned', readerMod.SAFETY_READER_POLICY_ID === 'r15/denial-floor');
check(
  'SAFETY_READER_SHA256 pinned',
  readerMod.SAFETY_READER_SHA256 === 'a0fa76e40e10246a9caf9d1be463b72b34f03174c68b017d6673fe9f165cb5cf',
);
check('SAFETY_READER_BYTES pinned', readerMod.SAFETY_READER_BYTES === 22881187);
check(
  'SAFETY_READER_LOCK_SHA256 pinned',
  readerMod.SAFETY_READER_LOCK_SHA256 === 'cffb0dfbb8608cf83b8c04bbcde3e24f198dfa5a030ab45fcb74a1b8d4b8da47',
);
check('SAFETY_READER_MAX_TOKENS is 64', readerMod.SAFETY_READER_MAX_TOKENS === 64);

console.log('\n=== [2] Whole-Sentence Denial Grammar (Positive & Adversarial) ===');
for (const [text, expected] of [
  ['no knee pain today', true],
  ['not dizzy', true],
  ['my knee does not hurt anymore', true],
  ["i'm not feeling sick or dizzy today, feeling good", true],
  ['pain free after my workout', true],
  ['the soreness has cleared up', true],
  ['my left shoulder stiffness is completely gone now', true],
  ['the traffic is a pain in the neck', true],
  ['my knee isn\u2019t sore today ✅', true],
  // Adversarial negative invariants — MUST return false
  ['not feeling right chest tight', false],
  ['the commute with chest pain is a pain', false],
  ['chest pain has cleared up', false],
  ['headache is gone', false],
  ['rib pain has cleared up', false],
  ['no knee pain and shoulder hurts', false],
  ['no pain today but felt dizzy', false],
  ['feeling good', false], // plain remark without denial evidence
  ['my knee pain has settled', false], // "settled" deliberately excluded
  ['no knee pain today?'.repeat(15), false], // > 200 chars & unsupported '?'
  ['no knee pain today?', false], // '?' outside allowed character set
  ['', false],
]) {
  const actual = denialMod.isHarmlessDenial(text);
  check(`denial(${JSON.stringify(text.slice(0, 48))}) === ${expected}`, actual === expected, `got ${actual}`);
}

console.log('\n=== [3] combineDenialFloor Truth Table (r15/denial-floor) ===');
const sharp = entryById.get('pain-sharp');
const mild = entryById.get('pain-mild');
const fatigue = entryById.get('fatigue-heavy');
const positive = entryById.get('positive-strong');
const dizzy = entryById.get('dizzy');

// 3a. Keyword halt always preserved even if text were denied or reader silent
{
  const out = readerMod.combineDenialFloor({
    text: 'no dizziness today',
    keywordEntry: redFlagMod.RED_FLAG_SYSTEMIC,
    shippedEntry: null,
    readerPrediction: null,
    codebaseEntries: codebase.entries,
  });
  check('3a. Keyword halt preserved regardless of denial/null reader', out?.id === 'red-flag-systemic');
}
// 3b. Shipped halt always preserved
{
  const out = readerMod.combineDenialFloor({
    text: 'no knee pain today',
    keywordEntry: null,
    shippedEntry: sharp,
    readerPrediction: { cautionLogit: -2, active: false, standaloneRouteId: null, actionableRouteId: null },
    codebaseEntries: codebase.entries,
  });
  check('3b. Shipped halt preserved over denial', out?.id === 'pain-sharp');
}
// 3c. Harmless denial suppresses non-halt restriction floor & reader escalation
{
  const out = readerMod.combineDenialFloor({
    text: 'no knee pain today',
    keywordEntry: null,
    shippedEntry: mild,
    readerPrediction: { cautionLogit: 3.5, active: true, standaloneRouteId: 'pain-sharp', actionableRouteId: 'pain-sharp' },
    codebaseEntries: codebase.entries,
  });
  check('3c. Harmless denial suppresses non-halt floor and reader alert', out === null);
}
// 3d. Reader escalates restriction floor (level 1) to halt (level 2)
{
  const out = readerMod.combineDenialFloor({
    text: 'chest feels weird and heavy while benching',
    keywordEntry: null,
    shippedEntry: mild,
    readerPrediction: { cautionLogit: 2.1, active: true, standaloneRouteId: 'pain-chest', actionableRouteId: 'pain-chest' },
    codebaseEntries: codebase.entries,
  });
  check('3d. Reader escalates level-1 floor to level-2 halt', out?.id === 'pain-chest');
}
// 3e. Tied active level (level 1 vs level 1) retains inherited floor guardrail
{
  const out = readerMod.combineDenialFloor({
    text: 'legs feel heavy and mild ache',
    keywordEntry: null,
    shippedEntry: mild,
    readerPrediction: { cautionLogit: 1.4, active: true, standaloneRouteId: 'fatigue-heavy', actionableRouteId: 'fatigue-heavy' },
    codebaseEntries: codebase.entries,
  });
  check('3e. Tied active level retains inherited floor guardrail', out?.id === 'pain-mild');
}
// 3f. More conservative keyword vs shipped floor chosen before reader comparison
{
  const out = readerMod.combineDenialFloor({
    text: 'back hurts a bit',
    keywordEntry: redFlagMod.RED_FLAG_PAIN, // load 0.6, rpe 6.0
    shippedEntry: fatigue,                  // load 0.85, rpe 7.5
    readerPrediction: { cautionLogit: 1.0, active: true, standaloneRouteId: 'soreness-doms', actionableRouteId: 'soreness-doms' },
    codebaseEntries: codebase.entries,
  });
  check('3f. Floor picks more conservative of keyword vs shipped', out?.id === 'red-flag-pain');
}
// 3g. Reader catches missed safety note when shipped & keyword are null (or no-op)
{
  const out = readerMod.combineDenialFloor({
    text: 'room started spinning between sets',
    keywordEntry: null,
    shippedEntry: positive, // no-op must normalize to null
    readerPrediction: { cautionLogit: 1.9, active: true, standaloneRouteId: 'dizzy', actionableRouteId: 'dizzy' },
    codebaseEntries: codebase.entries,
  });
  check('3g. No-op shipped entry normalized to null and reader catches safety note', out?.id === dizzy.id);
}
// 3h. Reader predicting no-op entry (positive-strong) yields no action (null)
{
  const out = readerMod.combineDenialFloor({
    text: 'felt strong today',
    keywordEntry: null,
    shippedEntry: null,
    readerPrediction: { cautionLogit: 0.8, active: true, standaloneRouteId: 'positive-strong', actionableRouteId: 'positive-strong' },
    codebaseEntries: codebase.entries,
  });
  check('3h. Reader predicting no-op guardrail yields null', out === null);
}
// 3i. Graceful degradation when readerPrediction is null (reader missing/failed)
{
  const out = readerMod.combineDenialFloor({
    text: 'elbow feels sore',
    keywordEntry: null,
    shippedEntry: mild,
    readerPrediction: null,
    codebaseEntries: codebase.entries,
  });
  check('3i. Null reader prediction degrades cleanly to shipped floor', out?.id === 'pain-mild');
}

console.log('\n=== [4] runSafetyReaderInference Contract & Poisoned-Tensor Guards ===');
const tokenizer = new WordPieceTokenizer(tokenizerSpec);

function makeReaderSession(outputFactory, opts = {}) {
  let disposed = 0;
  return {
    inputNames: ['input_ids', 'attention_mask'],
    outputNames: ['caution_logit', 'routing_logits'],
    get disposedCount() { return disposed; },
    handler: {
      async dispose() {
        if (opts.disposeDelayMs) await new Promise((r) => setTimeout(r, opts.disposeDelayMs));
        disposed += 1;
        if (opts.failDispose) throw new Error('Simulated reader disposal failure');
      },
    },
    async run(feeds) {
      if (opts.onFeeds) opts.onFeeds(feeds);
      if (opts.runDelayMs) await new Promise((r) => setTimeout(r, opts.runDelayMs));
      if (opts.failRun) throw new Error('Simulated reader inference failure');
      return outputFactory(feeds);
    },
  };
}

// 4a. Valid inference: token cap 64, all-ones mask, benign excluded from actionable, first-argmax tie break
{
  let seenFeeds = null;
  const routing = new Float32Array(13).fill(-5);
  routing[12] = 10.0; // benign is highest overall
  routing[2] = 3.0;   // fatigue-heavy (index 2) ties with pain-mild (index 6)
  routing[6] = 3.0;
  const session = makeReaderSession(
    () => ({
      caution_logit: { data: Float32Array.from([0.42]), dims: [1] },
      routing_logits: { data: routing, dims: [1, 13] },
    }),
    { onFeeds: (f) => { seenFeeds = f; } },
  );
  const longText = 'word '.repeat(100);
  const res = await readerMod.runSafetyReaderInference(session, FakeTensor, tokenizer, longText);
  check(
    '4a. Token cap <= 64 and all-ones int64 attention_mask',
    seenFeeds.input_ids.dims[0] === 1
      && seenFeeds.input_ids.dims[1] === 64
      && seenFeeds.attention_mask.dims[1] === 64
      && Array.from(seenFeeds.attention_mask.data).every((v) => v === 1n),
    `dims=${JSON.stringify(seenFeeds.input_ids.dims)}`,
  );
  check(
    '4b. Standalone picks benign (index 12) while actionable excludes benign and first-argmax breaks ties (index 2)',
    res.active === true && res.standaloneRouteId === 'benign' && res.actionableRouteId === 'fatigue-heavy',
    JSON.stringify(res),
  );
}

// 4c. Strictly positive caution boundary: caution_logit === 0.0 -> inactive (null routes)
{
  const routing = new Float32Array(13).fill(-1);
  routing[8] = 5.0; // pain-sharp
  const session = makeReaderSession(() => ({
    caution_logit: { data: Float32Array.from([0.0]), dims: [1] },
    routing_logits: { data: routing, dims: [1, 13] },
  }));
  const res = await readerMod.runSafetyReaderInference(session, FakeTensor, tokenizer, 'sharp pain');
  check(
    '4c. caution_logit === 0 is strictly inactive (null routes)',
    res.active === false && res.standaloneRouteId === null && res.actionableRouteId === null,
  );
}

// 4d. Poisoned tensors MUST throw (fail closed)
const poisonedCases = [
  ['missing caution_logit', () => ({ routing_logits: { data: new Float32Array(13), dims: [1, 13] } })],
  ['missing routing_logits', () => ({ caution_logit: { data: Float32Array.from([1]), dims: [1] } })],
  ['bad caution dims [1,2]', () => ({ caution_logit: { data: Float32Array.from([1, 2]), dims: [1, 2] }, routing_logits: { data: new Float32Array(13), dims: [1, 13] } })],
  ['bad routing dims [1,12]', () => ({ caution_logit: { data: Float32Array.from([1]), dims: [1] }, routing_logits: { data: new Float32Array(12), dims: [1, 12] } })],
  ['NaN caution_logit', () => ({ caution_logit: { data: Float32Array.from([Number.NaN]), dims: [1] }, routing_logits: { data: new Float32Array(13), dims: [1, 13] } })],
  ['Infinity routing_logits', () => {
    const r = new Float32Array(13);
    r[4] = Number.POSITIVE_INFINITY;
    return { caution_logit: { data: Float32Array.from([1]), dims: [1] }, routing_logits: { data: r, dims: [1, 13] } };
  }],
];
for (const [name, factory] of poisonedCases) {
  let threw = false;
  try {
    await readerMod.runSafetyReaderInference(makeReaderSession(factory), FakeTensor, tokenizer, 'test');
  } catch {
    threw = true;
  }
  check(`4d. Poisoned tensor rejected (${name})`, threw);
}

console.log('\n=== [5] Shared SerializedOrtScheduler Cross-Model Mutual Exclusion ===');
async function exerciseCrossModelConcurrency(useSharedScheduler) {
  const scheduler = useSharedScheduler ? readerMod.createSerializedOrtScheduler() : undefined;
  let activeSessions = 0;
  let maxConcurrent = 0;
  const order = [];

  const embedder = onnxMod.createLazySingleFlightEmbedder({
    tokenizer: tokenizerSpec,
    Tensor: FakeTensor,
    scheduler,
    createSession: async () => {
      activeSessions += 1;
      maxConcurrent = Math.max(maxConcurrent, activeSessions);
      order.push('embed:create');
      return {
        inputNames: ['input_ids', 'attention_mask'],
        outputNames: ['last_hidden_state'],
        handler: {
          async dispose() {
            await new Promise((r) => setTimeout(r, 8));
            activeSessions -= 1;
            order.push('embed:dispose');
          },
        },
        async run(feeds) {
          await new Promise((r) => setTimeout(r, 15));
          const n = feeds.input_ids.dims[1];
          const data = new Float32Array(n * 384).fill(0.1);
          return { last_hidden_state: { data, dims: [1, n, 384] } };
        },
      };
    },
  });

  const reader = readerMod.createLazySingleFlightSafetyReader({
    tokenizer: tokenizerSpec,
    Tensor: FakeTensor,
    scheduler,
    createSession: async () => {
      activeSessions += 1;
      maxConcurrent = Math.max(maxConcurrent, activeSessions);
      order.push('reader:create');
      const routing = new Float32Array(13).fill(-1);
      routing[6] = 2.0;
      const base = makeReaderSession(
        () => ({
          caution_logit: { data: Float32Array.from([1.5]), dims: [1] },
          routing_logits: { data: routing, dims: [1, 13] },
        }),
        { runDelayMs: 15, disposeDelayMs: 8 },
      );
      const origDispose = base.handler.dispose;
      base.handler.dispose = async () => {
        await origDispose();
        activeSessions -= 1;
        order.push('reader:dispose');
      };
      return base;
    },
  });

  await Promise.all([
    embedder.embed('question box query'),
    reader.classify('sore knee'),
    embedder.embed('triage query'),
    reader.classify('dizzy'),
  ]);
  return { maxConcurrent, activeSessions, order };
}

{
  const shared = await exerciseCrossModelConcurrency(true);
  const interleaved = shared.order.some((ev, idx) =>
    ev.endsWith(':create') && idx > 0 && !shared.order[idx - 1].endsWith(':dispose'),
  );
  check(
    '5a. Shared scheduler enforces maxConcurrent === 1 across embedder + reader',
    shared.maxConcurrent === 1 && shared.activeSessions === 0 && !interleaved,
    `maxConcurrent=${shared.maxConcurrent}, remaining=${shared.activeSessions}, events=${shared.order.length}`,
  );

  // Self-falsifier: WITHOUT a shared scheduler, concurrent embedder + reader DO overlap to 2!
  const unshared = await exerciseCrossModelConcurrency(false);
  check(
    '5b. Self-falsifier: unshared schedulers overlap to maxConcurrent === 2',
    unshared.maxConcurrent === 2 && unshared.activeSessions === 0,
    `maxConcurrent=${unshared.maxConcurrent}`,
  );
}

// 5c. Reader lifecycle: zero sessions on creation, failure in run still disposes once & queue recovers
{
  let created = 0;
  let disposed = 0;
  let attempt = 0;
  const reader = readerMod.createLazySingleFlightSafetyReader({
    tokenizer: tokenizerSpec,
    Tensor: FakeTensor,
    createSession: async () => {
      created += 1;
      attempt += 1;
      const shouldFail = attempt === 1;
      const routing = new Float32Array(13).fill(-1);
      routing[8] = 4.0;
      const s = makeReaderSession(
        () => ({
          caution_logit: { data: Float32Array.from([2.0]), dims: [1] },
          routing_logits: { data: routing, dims: [1, 13] },
        }),
        { failRun: shouldFail },
      );
      const origDispose = s.handler.dispose;
      s.handler.dispose = async () => {
        await origDispose();
        disposed += 1;
      };
      return s;
    },
  });
  check('5c. Reader wrapper allocates zero sessions on creation', created === 0);
  let firstThrew = false;
  try {
    await reader.classify('first failing call');
  } catch {
    firstThrew = true;
  }
  const second = await reader.classify('second succeeding call');
  check(
    '5d. Run failure disposes session once and does not wedge subsequent calls',
    firstThrew && second.actionableRouteId === 'pain-sharp' && created === 2 && disposed === 2,
    `created=${created}, disposed=${disposed}`,
  );
}

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
