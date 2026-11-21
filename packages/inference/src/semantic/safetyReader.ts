/**
 * safetyReader.ts — Runtime-agnostic ONNX safety reader & `r15/denial-floor`
 * combiner for Stream 2 (`M10 R15 s3`).
 *
 * Provenance (recorded in DEVIATION_LOG.md 2026-11-21; unwired library core in
 * PR 1/3 — mobile runtime enablement stays gated on PR 2 packaging and PR 3
 * device/memory verification):
 *   - Model: `m10-r15-reader-seed3` (`reader_quantized.onnx`)
 *   - Exact bytes: 22,881,187
 *   - Exact SHA-256: `a0fa76e40e10246a9caf9d1be463b72b34f03174c68b017d6673fe9f165cb5cf`
 *   - Gate lock SHA-256: `cffb0dfbb8608cf83b8c04bbcde3e24f198dfa5a030ab45fcb74a1b8d4b8da47`
 *   - Pre-holdout lock audit artifact: `sol_independent_lock_audit_v3.txt` (`00128588...`, `findings=0`)
 *   - Sealed holdout aggregate (`n = 555`, `meetsCriteria: true`): `sealed_result.json` (`de5fcec4...`)
 *   - Independent post-holdout aggregate verification: `sol_post_holdout_audit.txt` (`d2071d04...`)
 *   - Operator aggregate-only exit capture (`sealed_exit=0`): `sealed_run_exit_capture.txt` (`699ee09a...`)
 *   - Policy: `r15/denial-floor`
 *
 * SAFETY INVARIANTS:
 *   - Never invents user-facing copy or severity coefficients: maps predictions
 *     strictly onto existing non-no-op PhraseEntry records from phrase-codebase.json.
 *   - Preserves 100% of shipped halts and keyword halts.
 *   - Preserves exact shipped behavior unchanged when the reader is unavailable (`null`).
 *   - Fails closed on missing, non-floating, wrong-shape, wrong-length, or non-finite
 *     output tensors, and enforces the locked 64-token input cap.
 *   - Requires a shared `SerializedOrtScheduler` so two native ONNX sessions never
 *     coexist in mobile RAM, and latches fail-closed on any disposal rejection.
 */
import { isNoOpGuardrail, type PhraseEntry } from './codebase';
import { isHarmlessDenial } from './denialGrammar';
import {
  disposeOrtSession,
  emitLifecycleEvent,
  type EmbedderLifecyclePhase,
  type EmbedderLifecycleSink,
  type OrtOutputTensor,
  type OrtSessionLike,
  type OrtTensorCtor,
  type SerializedOrtScheduler,
} from './onnxEmbedder';
import { moreConservative } from './triage';
import { WordPieceTokenizer, type TokenizerSpec } from './wordpiece';

export { createSerializedOrtScheduler, type SerializedOrtScheduler } from './onnxEmbedder';

export const SAFETY_READER_MODEL_ID = 'm10-r15-reader-seed3';
export const SAFETY_READER_POLICY_ID = 'r15/denial-floor';
export const SAFETY_READER_SHA256 =
  'a0fa76e40e10246a9caf9d1be463b72b34f03174c68b017d6673fe9f165cb5cf';
export const SAFETY_READER_BYTES = 22_881_187;
export const SAFETY_READER_LOCK_SHA256 =
  'cffb0dfbb8608cf83b8c04bbcde3e24f198dfa5a030ab45fcb74a1b8d4b8da47';
/** Minimum encoded sequence length (`[CLS]` + `[SEP]`). */
export const SAFETY_READER_MIN_TOKENS = 2;
export const SAFETY_READER_MAX_TOKENS = 64;

/** Exact 13-class output order pinned to `reader_quantized.onnx` (`benign` last). */
export const SAFETY_READER_CLASSES = Object.freeze([
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
] as const);

export type SafetyReaderClassId = (typeof SAFETY_READER_CLASSES)[number];

export interface SafetyReaderPrediction {
  readonly cautionLogit: number;
  /** Strictly positive caution (`cautionLogit > 0`). */
  readonly active: boolean;
  /** Best class across all 13 heads when active; null otherwise. */
  readonly standaloneRouteId: SafetyReaderClassId | null;
  /** Best non-benign class (`0..11`, first argmax on ties) when active; null otherwise. */
  readonly actionableRouteId: Exclude<SafetyReaderClassId, 'benign'> | null;
}

export interface SafetyReader {
  readonly modelId: string;
  readonly policyId: string;
  classify(text: string): Promise<SafetyReaderPrediction>;
}

export interface LazySafetyReaderOptions {
  tokenizer: TokenizerSpec;
  createSession: () => Promise<OrtSessionLike>;
  disposeSession?: (session: OrtSessionLike) => Promise<void>;
  Tensor: OrtTensorCtor;
  /** Token cap per query; must be an integer in [SAFETY_READER_MIN_TOKENS (2), SAFETY_READER_MAX_TOKENS (64)]. */
  maxTokens?: number;
  /** Required shared ONNX scheduler so embedder and reader sessions never overlap. */
  scheduler: SerializedOrtScheduler;
  onEvent?: EmbedderLifecycleSink;
}

function assertLockedMaxTokens(maxTokens: number): number {
  if (
    !Number.isInteger(maxTokens)
    || maxTokens < SAFETY_READER_MIN_TOKENS
    || maxTokens > SAFETY_READER_MAX_TOKENS
  ) {
    throw new RangeError(
      `safety reader maxTokens ${String(maxTokens)} must be an integer in [${SAFETY_READER_MIN_TOKENS}, ${SAFETY_READER_MAX_TOKENS}]`,
    );
  }
  return maxTokens;
}

function assertDims(
  actual: readonly number[] | undefined,
  expected: readonly number[],
  name: string,
): void {
  if (!Array.isArray(actual) || actual.length !== expected.length) {
    throw new Error(
      `safety reader output '${name}' dims ${JSON.stringify(actual)} != expected ${JSON.stringify(expected)}`,
    );
  }
  for (let i = 0; i < expected.length; i += 1) {
    if (!(i in actual) || typeof actual[i] !== 'number' || actual[i] !== expected[i]) {
      throw new Error(
        `safety reader output '${name}' dims ${JSON.stringify(actual)} != expected ${JSON.stringify(expected)}`,
      );
    }
  }
}

function assertFloatTensorValues(
  tensor: OrtOutputTensor,
  name: string,
  expectedLength: number,
): readonly number[] {
  if (tensor.type !== undefined && tensor.type !== 'float32' && tensor.type !== 'float64') {
    throw new Error(
      `safety reader output '${name}' tensor type '${tensor.type}' must be floating-point (float32/float64)`,
    );
  }
  const raw = tensor.data;
  const isFloatStorage =
    raw instanceof Float32Array || raw instanceof Float64Array || Array.isArray(raw);
  if (!isFloatStorage) {
    throw new Error(
      `safety reader output '${name}' data must be Float32Array, Float64Array, or number[]`,
    );
  }
  if (raw.length !== expectedLength) {
    throw new Error(`safety reader '${name}' length ${raw.length} != ${expectedLength}`);
  }
  const values: number[] = new Array<number>(expectedLength);
  for (let i = 0; i < expectedLength; i += 1) {
    const v: unknown = raw[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`safety reader '${name}'[${i}] is non-finite or non-numeric: ${String(v)}`);
    }
    values[i] = v;
  }
  return values;
}

function firstArgmaxIndex(values: readonly number[], length: number): number {
  let bestIdx = 0;
  let bestVal = values[0];
  for (let i = 1; i < length; i += 1) {
    const v = values[i];
    if (v > bestVal) {
      bestVal = v;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Runs a single unpadded (`batch_size = 1`, `L <= 64`) ONNX safety-reader pass.
 * Fails closed on any invalid token cap, missing output, non-floating tensor,
 * unexpected shape/length, or non-finite logit.
 */
export async function runSafetyReaderInference(
  session: OrtSessionLike,
  Tensor: OrtTensorCtor,
  tokenizer: WordPieceTokenizer,
  text: string,
  maxTokens = SAFETY_READER_MAX_TOKENS,
): Promise<SafetyReaderPrediction> {
  const cappedTokens = assertLockedMaxTokens(maxTokens);
  const ids = tokenizer.encode(text, cappedTokens);
  const n = ids.length;
  if (n < SAFETY_READER_MIN_TOKENS || n > cappedTokens) {
    throw new RangeError(
      `safety reader encoded token length ${n} outside [${SAFETY_READER_MIN_TOKENS}, ${cappedTokens}]`,
    );
  }
  const dims = [1, n] as const;
  const feeds: Record<string, unknown> = {
    input_ids: new Tensor('int64', BigInt64Array.from(ids, (x) => BigInt(x)), dims),
    attention_mask: new Tensor('int64', new BigInt64Array(n).fill(1n), dims),
  };

  const results = await session.run(feeds);
  const caution = results.caution_logit;
  const routing = results.routing_logits;
  if (!caution) {
    throw new Error("safety reader output 'caution_logit' missing from results");
  }
  if (!routing) {
    throw new Error("safety reader output 'routing_logits' missing from results");
  }
  assertDims(caution.dims, [1], 'caution_logit');
  assertDims(routing.dims, [1, SAFETY_READER_CLASSES.length], 'routing_logits');
  const cautionValues = assertFloatTensorValues(caution, 'caution_logit', 1);
  const routingValues = assertFloatTensorValues(
    routing,
    'routing_logits',
    SAFETY_READER_CLASSES.length,
  );

  const cautionLogit = cautionValues[0];
  const active = cautionLogit > 0;
  if (!active) {
    return {
      cautionLogit,
      active: false,
      standaloneRouteId: null,
      actionableRouteId: null,
    };
  }

  const standaloneIdx = firstArgmaxIndex(routingValues, SAFETY_READER_CLASSES.length);
  const actionableCount = SAFETY_READER_CLASSES.length - 1; // exclude trailing 'benign'
  const actionableIdx = firstArgmaxIndex(routingValues, actionableCount);
  const standaloneRouteId = SAFETY_READER_CLASSES[standaloneIdx];
  const actionableRouteId = SAFETY_READER_CLASSES[actionableIdx] as Exclude<
    SafetyReaderClassId,
    'benign'
  >;

  return {
    cautionLogit,
    active: true,
    standaloneRouteId,
    actionableRouteId,
  };
}

/**
 * Lazy single-flight ONNX safety reader wrapper with zero resident session
 * ownership. Requires a shared `SerializedOrtScheduler` so native embedder and
 * reader sessions never overlap in memory. Any native disposal rejection latches
 * the shared scheduler fail-closed while preserving the caller's original error.
 */
export function createLazySingleFlightSafetyReader(opts: LazySafetyReaderOptions): SafetyReader {
  if (
    !opts.scheduler
    || typeof opts.scheduler.schedule !== 'function'
    || typeof opts.scheduler.markDisposalFailed !== 'function'
  ) {
    throw new Error('safety reader requires a shared SerializedOrtScheduler');
  }
  const { tokenizer: spec, createSession, Tensor, scheduler } = opts;
  const disposeSession = opts.disposeSession ?? disposeOrtSession;
  const maxTokens = assertLockedMaxTokens(opts.maxTokens ?? SAFETY_READER_MAX_TOKENS);
  const tokenizer = new WordPieceTokenizer(spec);
  const onEvent = opts.onEvent;

  let requestCounter = 0;
  let createdTotal = 0;
  let disposedTotal = 0;

  const emit = (
    phase: EmbedderLifecyclePhase,
    stage: 'start' | 'settled',
    requestId: number,
    ok: boolean,
  ): void => {
    emitLifecycleEvent(onEvent, {
      phase,
      stage,
      requestId,
      ok,
      createdTotal,
      disposedTotal,
      atMs: Date.now(),
    });
  };

  emit('wrapper', 'settled', 0, true);

  const runSingle = async (text: string): Promise<SafetyReaderPrediction> => {
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
      const prediction = await runSafetyReaderInference(session, Tensor, tokenizer, text, maxTokens);
      emit('inference', 'settled', requestId, true);
      return prediction;
    } catch (error) {
      requestOk = false;
      const failedInference = session !== null;
      emit(failedInference ? 'inference' : 'session', 'settled', requestId, false);
      throw error;
    } finally {
      let disposalError: { error: unknown } | null = null;
      if (session !== null) {
        const s = session;
        session = null;
        emit('disposal', 'start', requestId, true);
        let disposedOk = false;
        try {
          await disposeSession(s);
          disposedOk = true;
        } catch (error) {
          disposalError = { error };
          scheduler.markDisposalFailed(error);
        }
        disposedTotal += 1;
        emit('disposal', 'settled', requestId, disposedOk);
      }
      emit('request', 'settled', requestId, requestOk && disposalError === null);
      if (disposalError !== null && requestOk) throw disposalError.error;
    }
  };

  return {
    modelId: SAFETY_READER_MODEL_ID,
    policyId: SAFETY_READER_POLICY_ID,
    classify(text: string): Promise<SafetyReaderPrediction> {
      return scheduler.schedule(() => runSingle(text));
    },
  };
}

const normalizeActionable = (entry: PhraseEntry | null | undefined): PhraseEntry | null =>
  entry !== null && entry !== undefined && !isNoOpGuardrail(entry.guardrail) ? entry : null;

const actionLevel = (entry: PhraseEntry | null): 0 | 1 | 2 =>
  entry === null ? 0 : entry.guardrail.halt ? 2 : 1;

export interface DenialFloorInput {
  readonly text: string;
  /** Output entry of the keyword-only `resolveReport(text, null)` path (or null). */
  readonly keywordEntry: PhraseEntry | null;
  /** Output entry of the shipped semantic+keyword `resolveReport(text, semantic)` path (or null). */
  readonly shippedEntry: PhraseEntry | null;
  /**
   * Safety reader prediction when the reader is available (active or inactive),
   * or `null` when the reader is unavailable/failed (preserves shipped behavior unchanged).
   */
  readonly readerPrediction: SafetyReaderPrediction | null;
  /** Curated phrase codebase entries; reader outputs map strictly onto non-no-op entries here. */
  readonly codebaseEntries: readonly PhraseEntry[];
}

/**
 * Pure deterministic combiner implementing the locked `r15/denial-floor` rule:
 *   0. If `readerPrediction === null` (reader missing/corrupt/failed), preserve
 *      the exact shipped behavior unchanged (`normalizeActionable(shippedEntry)`).
 *   1. Normalize keyword and shipped entries (no-op guardrails -> null).
 *   2. Compute conservative `floor` = more conservative of keyword vs shipped.
 *   3. Preserve any halt (`level(floor) === 2`) unconditionally.
 *   4. Suppress non-halt outputs on exact whole-sentence harmless denials.
 *   5. Otherwise compare `floor` against the reader's actionable non-benign
 *      route: escalate if reader level > floor level; retain inherited `floor`
 *      on tied active levels; use reader when `floor` is null.
 */
export function combineDenialFloor(input: DenialFloorInput): PhraseEntry | null {
  if (input.readerPrediction === null) {
    return normalizeActionable(input.shippedEntry);
  }

  const kw = normalizeActionable(input.keywordEntry);
  const shipped = normalizeActionable(input.shippedEntry);
  const floor =
    kw !== null && (shipped === null || moreConservative(kw.guardrail, shipped.guardrail))
      ? kw
      : shipped;

  if (actionLevel(floor) === 2) return floor;
  if (isHarmlessDenial(input.text)) return null;

  let readerEntry: PhraseEntry | null = null;
  if (input.readerPrediction.active && input.readerPrediction.actionableRouteId !== null) {
    const matched = input.codebaseEntries.find(
      (e) => e.id === input.readerPrediction?.actionableRouteId,
    );
    readerEntry = normalizeActionable(matched);
  }

  return actionLevel(readerEntry) > actionLevel(floor) ? readerEntry : (floor ?? readerEntry);
}
