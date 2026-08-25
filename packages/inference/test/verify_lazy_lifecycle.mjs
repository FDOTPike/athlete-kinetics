/**
 * verify_lazy_lifecycle.mjs — proves the bounded ONNX lifecycle:
 *   1. Wrapper instantiation creates zero native sessions.
 *   2. One request creates one session and disposes exactly once after run() settles.
 *   3. Ten sequential requests create and dispose ten sessions.
 *   4. Concurrent requests are serialized through a single-flight queue and never overlap.
 *   5. ONE embedder instance, ONE production queue: two concurrent distinct
 *      inputs each execute their OWN token IDs and receive their own distinct
 *      embeddings; max active session concurrency stays one; both sessions
 *      dispose exactly once. Includes a mutation check proving these
 *      assertions fail when inference ignores input IDs (returns one shared
 *      vector for both requests).
 *   6. Session creation failure fails closed and does not invoke disposal.
 *   7. Inference run() failure disposes exactly once and fails closed.
 *   8. Disposal failure propagates without double-disposal.
 *   9. NODE-BACKEND SEAM CHECK ONLY: real onnxruntime-node session disposal
 *      works through the adapter seam on this workstation runtime. This is NOT
 *      React Native disposal parity — device/QA evidence (WO Track D3/E3)
 *      closes that boundary.
 *  10. Structural runtime guard fails closed on invalid/unsupported session objects.
 */
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const {
  createLazySingleFlightEmbedder,
  disposeOrtSession,
  runMiniLmInference,
} = require('./.build/semantic/onnxEmbedder.js');
const { WordPieceTokenizer } = require('./.build/semantic/wordpiece.js');

const ASSETS = join(import.meta.dirname, '..', 'assets');
const TOK = join(ASSETS, 'minilm', 'tokenizer.min.json');
const MODEL = join(ASSETS, 'minilm', 'model_quantized.onnx');

const tokenizerSpec = JSON.parse(readFileSync(TOK, 'utf-8'));

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

function makeFakeSession(opts = {}) {
  const { runDelayMs = 5, failRun = false, textOut = null } = opts;
  let disposed = 0;
  let active = false;

  const session = {
    inputNames: ['input_ids', 'attention_mask'],
    outputNames: ['last_hidden_state'],
    get disposedCount() { return disposed; },
    get isDisposed() { return disposed > 0; },
    get isActive() { return active; },
    handler: {
      async dispose() {
        disposed += 1;
      },
    },
    async run(feeds) {
      if (disposed > 0) throw new Error('Cannot run on disposed session');
      active = true;
      if (runDelayMs > 0) {
        await new Promise((r) => setTimeout(r, runDelayMs));
      }
      active = false;
      if (failRun) throw new Error('Inference failure in native engine');

      const n = feeds.input_ids.dims[1];
      const dim = 384;
      const data = new Float32Array(n * dim);
      // Fill with dummy deterministic numbers based on seed
      const seed = textOut ? textOut.charCodeAt(0) : 1;
      for (let i = 0; i < data.length; i++) {
        data[i] = ((i % 17) + seed) * 0.05;
      }
      return {
        last_hidden_state: {
          data,
          dims: [1, n, dim],
        },
      };
    },
  };
  return session;
}

console.log('=== [Phase 2] ONNX Bounded Lifecycle Verification ===');

// 1. Wrapper instantiation creates zero sessions
{
  let createdCount = 0;
  const embedder = createLazySingleFlightEmbedder({
    tokenizer: tokenizerSpec,
    Tensor: FakeTensor,
    createSession: async () => {
      createdCount++;
      return makeFakeSession();
    },
  });
  check('1. Wrapper creation allocates zero sessions', createdCount === 0 && embedder.dim === 384);
}

// 2. Single request creates 1 session, disposes exactly once
{
  let createdCount = 0;
  let lastSession = null;
  const embedder = createLazySingleFlightEmbedder({
    tokenizer: tokenizerSpec,
    Tensor: FakeTensor,
    createSession: async () => {
      createdCount++;
      lastSession = makeFakeSession();
      return lastSession;
    },
  });

  const vec = await embedder.embed('knee pain');
  check('2. Single request creates exactly 1 session and disposes 1 time',
    createdCount === 1 && lastSession?.disposedCount === 1 && vec instanceof Float32Array && vec.length === 384);
}

// 3. Ten sequential requests create and dispose 10 sessions
{
  let createdCount = 0;
  const sessions = [];
  const embedder = createLazySingleFlightEmbedder({
    tokenizer: tokenizerSpec,
    Tensor: FakeTensor,
    createSession: async () => {
      createdCount++;
      const s = makeFakeSession();
      sessions.push(s);
      return s;
    },
  });

  for (let i = 0; i < 10; i++) {
    await embedder.embed(`report number ${i}`);
  }

  const allDisposedOnce = sessions.every((s) => s.disposedCount === 1);
  check('3. Ten sequential requests create and dispose ten sessions',
    createdCount === 10 && sessions.length === 10 && allDisposedOnce);
}

// 4. Concurrent requests are serialized through single-flight queue (never overlap)
{
  let activeSessions = 0;
  let maxConcurrentSessions = 0;
  let totalCreated = 0;
  const sessions = [];

  const embedder = createLazySingleFlightEmbedder({
    tokenizer: tokenizerSpec,
    Tensor: FakeTensor,
    createSession: async () => {
      totalCreated++;
      activeSessions++;
      if (activeSessions > maxConcurrentSessions) maxConcurrentSessions = activeSessions;
      const s = makeFakeSession({ runDelayMs: 20 });
      sessions.push(s);
      return s;
    },
    disposeSession: async (session) => {
      activeSessions--;
      await disposeOrtSession(session);
    },
  });

  const [resA, resB] = await Promise.all([
    embedder.embed('chest pain'),
    embedder.embed('quad soreness'),
  ]);

  const allDisposed = sessions.every((s) => s.disposedCount === 1);
  check('4. Concurrent requests are serialized (max concurrency == 1)',
    maxConcurrentSessions === 1 && totalCreated === 2 && allDisposed);
}

// 5. ONE embedder instance, ONE production queue: two distinct concurrent
//    inputs each execute their OWN token IDs and receive their own distinct
//    embeddings (WO remediation D1). The fake derives its output purely from
//    the ACTUAL feeds — never from per-embedder factory seeds.
{
  const DIM = 384;

  /** Session fake whose inference output is a pure function of the token IDs
   *  in feeds. ignoreInputIds models the mutation case: inference that ignores
   *  input identity entirely (returns the same vector for every request). */
  const makeFeedDerivedSession = ({ ignoreInputIds = false, runDelayMs = 15 } = {}) => {
    let disposed = 0;
    const runs = [];
    return {
      inputNames: ['input_ids', 'attention_mask'],
      outputNames: ['last_hidden_state'],
      get disposedCount() { return disposed; },
      runs,
      handler: { async dispose() { disposed += 1; } },
      async run(feeds) {
        if (disposed > 0) throw new Error('Cannot run on disposed session');
        const ids = Array.from(feeds.input_ids.data, Number);
        runs.push(ids);
        if (runDelayMs > 0) await new Promise((r) => setTimeout(r, runDelayMs));
        const n = ids.length;
        const data = new Float32Array(n * DIM);
        for (let t = 0; t < n; t += 1) {
          const tok = ignoreInputIds ? 42 : ids[t];
          for (let j = 0; j < DIM; j += 1) data[t * DIM + j] = ((tok * (j + 7)) % 97) * 0.01;
        }
        return { last_hidden_state: { data, dims: [1, n, DIM] } };
      },
    };
  };

  /** Mirror of the production post-processing (mean-pool over tokens + L2
   *  normalize) applied to the fake's row function — used only for
   *  correspondence assertions, never as a second resolution path. */
  const expectedVector = (ids) => {
    const n = ids.length;
    const pooled = new Float32Array(DIM);
    for (let t = 0; t < n; t += 1) {
      const tok = ids[t];
      for (let j = 0; j < DIM; j += 1) pooled[j] += ((tok * (j + 7)) % 97) * 0.01;
    }
    for (let j = 0; j < DIM; j += 1) pooled[j] /= n;
    let norm = 0;
    for (let j = 0; j < DIM; j += 1) norm += pooled[j] * pooled[j];
    norm = Math.sqrt(norm);
    const out = new Float32Array(DIM);
    for (let j = 0; j < DIM; j += 1) out[j] = pooled[j] / norm;
    return out;
  };

  const maxAbsDiff = (a, b) => {
    let m = 0;
    for (let i = 0; i < a.length; i += 1) m = Math.max(m, Math.abs(a[i] - b[i]));
    return m;
  };

  const tokenizer = new WordPieceTokenizer(tokenizerSpec);
  const TEXT_A = 'knee collapses inward during squat';
  const TEXT_B = 'shoulder pinch when pressing overhead';
  const idsA = tokenizer.encode(TEXT_A);
  const idsB = tokenizer.encode(TEXT_B);
  check('5 precondition: the two inputs tokenize differently', maxAbsDiff(
    Float32Array.from(idsA), Float32Array.from(idsB),
  ) > 0 || idsA.join(',') !== idsB.join(','));

  const runScenario = async (sessionOpts) => {
    let active = 0;
    let maxActive = 0;
    const sessions = [];
    const embedder = createLazySingleFlightEmbedder({
      tokenizer: tokenizerSpec,
      Tensor: FakeTensor,
      createSession: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        const s = makeFeedDerivedSession(sessionOpts);
        sessions.push(s);
        return s;
      },
      disposeSession: async (s) => {
        active -= 1;
        await disposeOrtSession(s);
      },
    });
    const [vecA, vecB] = await Promise.all([
      embedder.embed(TEXT_A),
      embedder.embed(TEXT_B),
    ]);
    return { vecA, vecB, sessions, maxActive };
  };

  const { vecA, vecB, sessions, maxActive } = await runScenario();

  // Single-flight contract: submission order == execution order on the
  // wrapper's one production queue, so sessions[0] served TEXT_A.
  const ownA = sessions.length === 2
    && sessions[0].runs.length === 1
    && sessions[0].runs[0].length === idsA.length
    && sessions[0].runs[0].every((v, i) => v === idsA[i]);
  const ownB = sessions.length === 2
    && sessions[1].runs.length === 1
    && sessions[1].runs[0].every((v, i) => v === idsB[i]);
  // Unit-normalized 384-dim vectors: any real input difference shows up as a
  // max component gap orders of magnitude above float noise (~1e-7). The
  // mutation case (5b) produces an exact 0 gap, so 1e-3 cleanly separates them.
  const distinct = maxAbsDiff(vecA, vecB) > 1e-3;
  const corrA = maxAbsDiff(vecA, expectedVector(idsA)) < 1e-6;
  const corrB = maxAbsDiff(vecB, expectedVector(idsB)) < 1e-6;
  const bothDisposedOnce = sessions.every((s) => s.disposedCount === 1);

  check('5. one embedder instance: each concurrent input executed its own token IDs',
    ownA && ownB, `ownA=${ownA} ownB=${ownB}`);
  check('5. returned vectors differ AND each corresponds to its own request',
    distinct && corrA && corrB,
    `diff=${maxAbsDiff(vecA, vecB).toExponential(2)} corrA=${corrA} corrB=${corrB}`);
  check('5. max active session concurrency stays 1; both sessions dispose exactly once',
    maxActive === 1 && bothDisposedOnce && sessions.length === 2,
    `maxActive=${maxActive} disposed=${sessions.map((s) => s.disposedCount).join('/')}`);

  // Mutation/negative check (WO D1): when inference ignores input IDs, both
  // requests receive the SAME vector — every distinctness assertion above
  // would fail. This proves the assertions detect the defect they target.
  {
    const mutated = await runScenario({ ignoreInputIds: true });
    const mutatedIdentical = maxAbsDiff(mutated.vecA, mutated.vecB) <= 1e-9;
    check('5b. mutation: ID-ignoring inference makes distinctness FAIL (test sensitivity proof)',
      mutatedIdentical && mutated.sessions.every((s) => s.disposedCount === 1),
      `diff=${maxAbsDiff(mutated.vecA, mutated.vecB).toExponential(2)}`);
  }
}

// 6. Session initialization failure fails closed and does not call dispose
{
  let disposeCalled = false;
  const embedder = createLazySingleFlightEmbedder({
    tokenizer: tokenizerSpec,
    Tensor: FakeTensor,
    createSession: async () => {
      throw new Error('Model file not found');
    },
    disposeSession: async () => {
      disposeCalled = true;
    },
  });

  let threw = false;
  try {
    await embedder.embed('test');
  } catch (err) {
    threw = true;
  }
  check('6. Session creation failure fails closed without disposal call', threw && !disposeCalled);
}

// 7. Inference failure disposes exactly once in finally and fails closed
{
  let session = null;
  const embedder = createLazySingleFlightEmbedder({
    tokenizer: tokenizerSpec,
    Tensor: FakeTensor,
    createSession: async () => {
      session = makeFakeSession({ failRun: true });
      return session;
    },
  });

  let threw = false;
  try {
    await embedder.embed('test');
  } catch (err) {
    threw = true;
  }
  check('7. Inference run() failure disposes exactly once and propagates error',
    threw && session?.disposedCount === 1);
}

// 8. Disposal failure propagates without secondary disposal attempt
{
  let disposeAttempts = 0;
  const fakeSession = {
    inputNames: ['input_ids', 'attention_mask'],
    outputNames: ['last_hidden_state'],
    handler: {
      async dispose() {
        disposeAttempts++;
        throw new Error('Native C++ dispose segfault simulation');
      },
    },
    async run() {
      return {
        last_hidden_state: {
          data: new Float32Array(384),
          dims: [1, 1, 384],
        },
      };
    },
  };

  const embedder = createLazySingleFlightEmbedder({
    tokenizer: tokenizerSpec,
    Tensor: FakeTensor,
    createSession: async () => fakeSession,
  });

  let threw = false;
  try {
    await embedder.embed('test');
  } catch (err) {
    threw = true;
  }
  check('8. Disposal failure propagates and avoids secondary disposal attempt',
    threw && disposeAttempts === 1);
}

// 9. NODE-BACKEND SEAM CHECK ONLY — real onnxruntime-node session lifecycle
//    (create -> run -> dispose) through the adapter seam on this workstation.
//    This does NOT prove React Native disposal parity: the shipped device path
//    runs onnxruntime-react-native and is closed by QA/device evidence
//    (WO Track D3 instrumentation + E3 authorized device matrix).
//    Also reports cold vs repeated per-request latency on this Node backend
//    (informational for the device matrix; device numbers govern usability).
{
  let realOrtOk = false;
  try {
    const ort = await import('onnxruntime-node');
    const realTokenizer = new WordPieceTokenizer(tokenizerSpec);
    const TensorCtor = ort.Tensor;

    const t0 = performance.now();
    const realSession = await ort.InferenceSession.create(MODEL);
    const createMs = performance.now() - t0;

    const cold0 = performance.now();
    await runMiniLmInference(realSession, TensorCtor, realTokenizer, 'knee pain when squatting');
    const coldMs = performance.now() - cold0;

    const warm0 = performance.now();
    for (let i = 0; i < 5; i += 1) {
      await runMiniLmInference(realSession, TensorCtor, realTokenizer, `warm request number ${i}`);
    }
    const warmAvgMs = (performance.now() - warm0) / 5;

    const d0 = performance.now();
    await disposeOrtSession(realSession);
    const disposeMs = performance.now() - d0;

    console.log(
      '  [latency/node-backend seam, informational] '
      + `session.create=${createMs.toFixed(1)}ms  first inference(cold)=${coldMs.toFixed(1)}ms  `
      + `repeated avg=${warmAvgMs.toFixed(1)}ms  dispose=${disposeMs.toFixed(1)}ms`,
    );
    realOrtOk = true;
  } catch (e) {
    console.error('onnxruntime-node disposal/latency check failed:', e);
  }
  check('9. NODE-BACKEND SEAM ONLY: onnxruntime-node create/run/dispose via adapter (NOT RN parity)',
    realOrtOk);
}

// 10. Structural runtime guard rejects invalid session objects
{
  let guardOk = 0;
  try { await disposeOrtSession(null); } catch { guardOk++; }
  try { await disposeOrtSession(undefined); } catch { guardOk++; }
  try { await disposeOrtSession({}); } catch { guardOk++; }
  try { await disposeOrtSession({ handler: {} }); } catch { guardOk++; }
  check('10. Structural runtime guard fails closed on invalid objects', guardOk === 4);
}

console.log(`\n${fail === 0 ? 'ALL LIFECYCLE CHECKS PASSED' : `${fail} LIFECYCLE CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
