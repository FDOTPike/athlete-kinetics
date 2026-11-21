/**
 * safetyReader.ts — Runtime-agnostic ONNX safety reader & `r15/denial-floor`
 * combiner for Stream 2 (`M10 R15 s3`).
 *
 * Provenance (independently audited by `sol` v3 `00128588...`, `findings=0`,
 * and sealed-holdout verified on `n = 555` notes, `sealed_exit=0`,
 * `meetsCriteria: true`, `sol_post_holdout_audit.txt` `d2071d04...`):
 *   - Model: `m10-r15-reader-seed3` (`reader_quantized.onnx`)
 *   - Exact bytes: 22,881,187
 *   - Exact SHA-256: `a0fa76e40e10246a9caf9d1be463b72b34f03174c68b017d6673fe9f165cb5cf`
 *   - Gate lock SHA-256: `cffb0dfbb8608cf83b8c04bbcde3e24f198dfa5a030ab45fcb74a1b8d4b8da47`
 *   - Policy: `r15/denial-floor`
 *
 * SAFETY INVARIANTS:
 *   - Never invents user-facing copy or severity coefficients: maps predictions
 *     strictly onto existing non-no-op PhraseEntry records from phrase-codebase.json.
 *   - Preserves 100% of shipped halts and keyword halts.
 *   - Fails closed on missing, malformed, wrong-shape, or non-finite output tensors.
 *   - Shares a `SerializedOrtScheduler` with the embedder so two native ONNX
 *     sessions never coexist in mobile RAM.
 */
import { isNoOpGuardrail, type PhraseEntry } from './codebase';
import { isHarmlessDenial } from './denialGrammar';
import {
  createSerializedOrtScheduler,
  disposeOrtSession,
  type EmbedderLifecyclePhase,
  type EmbedderLifecycleSink,
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
  maxTokens?: number;
  /** Shared ONNX scheduler so embedder and reader sessions never overlap. */
  scheduler?: SerializedOrtScheduler;
  onEvent?: EmbedderLifecycleSink;
}

function firstArgmaxIndex(values: Float32Array | readonly number[], length: number): number {
  let bestIdx = 0;
  let bestVal = Number(values[0]);
  for (let i = 1; i < length; i += 1) {
    const v = Number(values[i]);
    if (v > bestVal) {
      bestVal = v;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function assertDims(actual: readonly number[] | undefined, expected: readonly number[], name: string): void {
  if (
    !Array.isArray(actual)
    || actual.length !== expected.length
    || actual.some((d, i) => d !== expected[i])
  ) {
    throw new Error(
      `safety reader output '${name}' dims ${JSON.stringify(actual)} != expected ${JSON.stringify(expected)}`,
    );
  }
}

/**
 * Runs a single unpadded (`batch_size = 1`, `L <= 64`) ONNX safety-reader pass.
 * Fails closed on any missing output, unexpected shape, or non-finite logit.
 */
export async function runSafetyReaderInference(
  session: OrtSessionLike,
  Tensor: OrtTensorCtor,
  tokenizer: WordPieceTokenizer,
  text: string,
  maxTokens = SAFETY_READER_MAX_TOKENS,
): Promise<SafetyReaderPrediction> {
  const ids = tokenizer.encode(text, maxTokens);
  const n = ids.length;
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
  if (caution.data.length !== 1) {
    throw new Error(`safety reader 'caution_logit' length ${caution.data.length} != 1`);
  }
  if (routing.data.length !== SAFETY_READER_CLASSES.length) {
    throw new Error(
      `safety reader 'routing_logits' length ${routing.data.length} != ${SAFETY_READER_CLASSES.length}`,
    );
  }

  const cautionLogit = Number(caution.data[0]);
  if (!Number.isFinite(cautionLogit)) {
    throw new Error(`safety reader 'caution_logit' is non-finite: ${cautionLogit}`);
  }
  for (let i = 0; i < SAFETY_READER_CLASSES.length; i += 1) {
    const v = Number(routing.data[i]);
    if (!Number.isFinite(v)) {
      throw new Error(`safety reader 'routing_logits'[${i}] is non-finite: ${v}`);
    }
  }

  const active = cautionLogit > 0;
  if (!active) {
    return {
      cautionLogit,
      active: false,
      standaloneRouteId: null,
      actionableRouteId: null,
    };
  }

  const standaloneIdx = firstArgmaxIndex(routing.data, SAFETY_READER_CLASSES.length);
  const actionableCount = SAFETY_READER_CLASSES.length - 1; // exclude trailing 'benign'
  const actionableIdx = firstArgmaxIndex(routing.data, actionableCount);
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
 * ownership. Uses a shared `SerializedOrtScheduler` when supplied so native
 * embedder and reader sessions never overlap in memory.
 */
export function createLazySingleFlightSafetyReader(opts: LazySafetyReaderOptions): SafetyReader {
  const { tokenizer: spec, createSession, Tensor } = opts;
  const disposeSession = opts.disposeSession ?? disposeOrtSession;
  const maxTokens = opts.maxTokens ?? SAFETY_READER_MAX_TOKENS;
  const tokenizer = new WordPieceTokenizer(spec);
  const scheduler = opts.scheduler ?? createSerializedOrtScheduler();
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
    if (!onEvent) return;
    onEvent({ phase, stage, requestId, ok, createdTotal, disposedTotal, atMs: Date.now() });
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
        try {
          await disposeSession(s);
          disposedTotal += 1;
          emit('disposal', 'settled', requestId, true);
        } catch (error) {
          disposedTotal += 1;
          disposalError = { error };
          emit('disposal', 'settled', requestId, false);
        }
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
  /** Safety reader prediction, or null when the reader is absent/unavailable (degrades to floor). */
  readonly readerPrediction: SafetyReaderPrediction | null;
  /** Curated phrase codebase entries; reader outputs map strictly onto non-no-op entries here. */
  readonly codebaseEntries: readonly PhraseEntry[];
}

/**
 * Pure deterministic combiner implementing the locked `r15/denial-floor` rule:
 *   1. Normalize keyword and shipped entries (no-op guardrails -> null).
 *   2. Compute conservative `floor` = more conservative of keyword vs shipped.
 *   3. Preserve any halt (`level(floor) === 2`) unconditionally.
 *   4. Suppress non-halt outputs on exact whole-sentence harmless denials.
 *   5. Otherwise compare `floor` against the reader's actionable non-benign
 *      route: escalate if reader level > floor level; retain inherited `floor`
 *      on tied active levels; use reader when `floor` is null.
 */
export function combineDenialFloor(input: DenialFloorInput): PhraseEntry | null {
  const kw = normalizeActionable(input.keywordEntry);
  const shipped = normalizeActionable(input.shippedEntry);
  const floor =
    kw !== null && (shipped === null || moreConservative(kw.guardrail, shipped.guardrail))
      ? kw
      : shipped;

  if (actionLevel(floor) === 2) return floor;
  if (isHarmlessDenial(input.text)) return null;

  let readerEntry: PhraseEntry | null = null;
  if (input.readerPrediction !== null && input.readerPrediction.active && input.readerPrediction.actionableRouteId !== null) {
    const matched = input.codebaseEntries.find(
      (e) => e.id === input.readerPrediction?.actionableRouteId,
    );
    readerEntry = normalizeActionable(matched);
  }

  return actionLevel(readerEntry) > actionLevel(floor) ? readerEntry : (floor ?? readerEntry);
}
