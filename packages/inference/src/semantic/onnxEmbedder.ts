/**
 * onnxEmbedder.ts — runtime-agnostic MiniLM sentence embedder.
 *
 * Works against the common API surface of onnxruntime-node (verification on
 * a workstation/CI) and onnxruntime-react-native (device): both expose
 * `new Tensor('int64', BigInt64Array, dims)` and `session.run(feeds)`.
 * The caller constructs the session from packages/inference/assets/minilm/
 * (model fetched by scripts/fetch-embedder.mjs) and injects it here, so this
 * module stays free of any native import.
 *
 * Pipeline parity with the build-time codebase embeddings (@xenova/
 * transformers, same weights) is machine-verified in test/verify_embedder.mjs:
 * exact tokenizer ids per phrase, cosine >= 0.999 per embedding.
 */
import type { Embedder } from './embedder';
import { normalize } from './cosine';
import { WordPieceTokenizer, type TokenizerSpec } from './wordpiece';

export interface OrtTensorCtor {
  new (type: 'int64', data: BigInt64Array, dims: readonly number[]): unknown;
}
export interface OrtOutputTensor {
  data: Float32Array | number[];
  dims: readonly number[];
}
export interface OrtSessionLike {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, OrtOutputTensor>>;
}

export interface MiniLmEmbedderOptions {
  session: OrtSessionLike;
  Tensor: OrtTensorCtor;
  tokenizer: TokenizerSpec;
  /** Embedding width; must match the codebase asset (384 for MiniLM-L6). */
  dim?: number;
  /** Token cap per query (athlete reports are short). */
  maxTokens?: number;
}

export interface OrtHandlerWithDispose {
  dispose(): Promise<void>;
}

export interface OrtSessionWithHandler {
  handler?: unknown;
  dispose?(): Promise<void> | void;
}

/**
 * Pinned private compatibility seam for ONNX session disposal.
 *
 * onnxruntime-common's public InferenceSession interface does not declare a
 * public dispose() method, but the underlying backend handler (OnnxruntimeSessionHandler
 * in onnxruntime-react-native and onnxruntime-node) implements an async dispose()
 * that invokes native C++ session deallocation.
 *
 * This adapter uses a structural runtime guard, awaits the promise, and fails
 * closed if no supported disposal seam is present.
 */
export async function disposeOrtSession(session: unknown): Promise<void> {
  if (typeof session !== 'object' || session === null) {
    throw new Error('Invalid session object for disposal');
  }
  const s = session as OrtSessionWithHandler;
  if (typeof s.dispose === 'function') {
    await s.dispose();
    return;
  }
  if (typeof s.handler === 'object' && s.handler !== null) {
    const h = s.handler as OrtHandlerWithDispose;
    if (typeof h.dispose === 'function') {
      await h.dispose();
      return;
    }
  }
  throw new Error('No supported disposal seam found on ONNX session');
}

/**
 * Runs a single MiniLM inference pass over the provided text and returns an
 * L2-normalized Float32Array vector.
 */
export async function runMiniLmInference(
  session: OrtSessionLike,
  Tensor: OrtTensorCtor,
  tokenizer: WordPieceTokenizer,
  text: string,
  dim = 384,
  maxTokens = 128,
): Promise<Float32Array> {
  const ids = tokenizer.encode(text, maxTokens);
  const n = ids.length;
  const big = BigInt64Array.from(ids, (x) => BigInt(x));
  const ones = new BigInt64Array(n).fill(1n);
  const zeros = new BigInt64Array(n); // token_type_ids: all zeros
  const feeds: Record<string, unknown> = {
    input_ids: new Tensor('int64', big, [1, n]),
    attention_mask: new Tensor('int64', ones, [1, n]),
  };
  if (session.inputNames.includes('token_type_ids')) {
    feeds.token_type_ids = new Tensor('int64', zeros, [1, n]);
  }
  const results = await session.run(feeds);
  const outName = session.outputNames.includes('last_hidden_state')
    ? 'last_hidden_state'
    : session.outputNames[0];
  const out = results[outName];
  if (!out) {
    throw new Error(`model output '${outName}' missing from results`);
  }
  const hidden = out.dims[out.dims.length - 1];
  if (hidden !== dim) {
    throw new Error(`model hidden size ${hidden} != expected dim ${dim}`);
  }
  // Mean pooling over the (all-ones) attention mask, then L2 normalize —
  // identical post-processing to the build-time codebase embeddings.
  const data = out.data;
  const pooled = new Float32Array(dim);
  for (let t = 0; t < n; t++) {
    const off = t * dim;
    for (let j = 0; j < dim; j++) pooled[j] += Number(data[off + j]);
  }
  for (let j = 0; j < dim; j++) pooled[j] /= n;
  return normalize(pooled);
}

export function createMiniLmEmbedder(opts: MiniLmEmbedderOptions): Embedder {
  const { session, Tensor, tokenizer: spec } = opts;
  const dim = opts.dim ?? 384;
  const maxTokens = opts.maxTokens ?? 128;
  const tokenizer = new WordPieceTokenizer(spec);

  return {
    modelId: spec.modelId,
    dim,
    async embed(text: string): Promise<Float32Array> {
      return runMiniLmInference(session, Tensor, tokenizer, text, dim, maxTokens);
    },
  };
}

export interface LazyEmbedderOptions {
  tokenizer: TokenizerSpec;
  dim?: number;
  maxTokens?: number;
  createSession: () => Promise<OrtSessionLike>;
  disposeSession?: (session: OrtSessionLike) => Promise<void>;
  Tensor: OrtTensorCtor;
  /**
   * Optional QA-only lifecycle telemetry (WO remediation D3). When omitted the
   * wrapper behaves exactly as before — production releases carry no sink and
   * pay nothing. Events carry counters and outcomes ONLY: never input text,
   * embeddings, database contents, or any other user data.
   */
  onEvent?: EmbedderLifecycleSink;
}

/** Coarse lifecycle phases emitted by the lazy single-flight wrapper. */
export type EmbedderLifecyclePhase =
  | 'wrapper'
  | 'request'
  | 'session'
  | 'inference'
  | 'disposal';

export interface EmbedderLifecycleEvent {
  phase: EmbedderLifecyclePhase;
  stage: 'start' | 'settled';
  /** 1-based per-wrapper request counter; 0 for the wrapper event itself. */
  requestId: number;
  /** false only on the settled event of the stage that threw. */
  ok: boolean;
  /** Cumulative sessions created by this wrapper. */
  createdTotal: number;
  /** Cumulative sessions whose disposal settled (ok or not). */
  disposedTotal: number;
  atMs: number;
}

export type EmbedderLifecycleSink = (event: EmbedderLifecycleEvent) => void;

/**
 * Creates a lightweight Embedder wrapper that maintains ZERO resident session
 * ownership. For each embed() call, requests are serialized through a single-flight
 * queue, an isolated session is created, inference is executed, the session is
 * disposed in finally, and all references are cleared.
 */
export function createLazySingleFlightEmbedder(opts: LazyEmbedderOptions): Embedder {
  const { tokenizer: spec, createSession, Tensor } = opts;
  const disposeSession = opts.disposeSession ?? disposeOrtSession;
  const dim = opts.dim ?? 384;
  const maxTokens = opts.maxTokens ?? 128;
  const tokenizer = new WordPieceTokenizer(spec);
  const onEvent = opts.onEvent;

  let queue: Promise<unknown> = Promise.resolve();
  let requestCounter = 0;
  let createdTotal = 0;
  let disposedTotal = 0;

  const emit = (
    phase: EmbedderLifecyclePhase,
    stage: 'start' | 'settled',
    requestId: number,
    ok: boolean,
  ): void => {
    if (!onEvent) return;
    onEvent({ phase, stage, requestId, ok, createdTotal, disposedTotal, atMs: Date.now() });
  };

  emit('wrapper', 'settled', 0, true); // wrapper exists; zero sessions created

  const runSingle = async (text: string): Promise<Float32Array> => {
    const requestId = requestCounter + 1;
    requestCounter = requestId;
    emit('request', 'start', requestId, true);
    let session: OrtSessionLike | null = null;
    let requestOk = true;
    try {
      emit('session', 'start', requestId, true);
      session = await createSession();
      createdTotal += 1;
      emit('session', 'settled', requestId, true);
      emit('inference', 'start', requestId, true);
      const vector = await runMiniLmInference(session, Tensor, tokenizer, text, dim, maxTokens);
      emit('inference', 'settled', requestId, true);
      return new Float32Array(vector);
    } catch (error) {
      requestOk = false;
      // Attribute the failure to the stage still open; the finally block below
      // owns disposal reporting either way.
      const failedInference = session !== null;
      emit(failedInference ? 'inference' : 'session', 'settled', requestId, false);
      throw error;
    } finally {
      let disposalFailed = false;
      if (session !== null) {
        const s = session;
        session = null;
        emit('disposal', 'start', requestId, true);
        try {
          await disposeSession(s);
          disposedTotal += 1;
          emit('disposal', 'settled', requestId, true);
        } catch (error) {
          disposedTotal += 1;
          disposalFailed = true;
          emit('disposal', 'settled', requestId, false);
          throw error;
        }
      }
      // A failed disposal is reported on its own stage event; the request-level
      // settled event stays truthful about the request outcome itself.
      emit('request', 'settled', requestId, requestOk && !disposalFailed);
    }
  };

  return {
    modelId: spec.modelId,
    dim,
    embed(text: string): Promise<Float32Array> {
      const next = queue.then(() => runSingle(text), () => runSingle(text));
      queue = next.catch(() => {});
      return next;
    },
  };
}
