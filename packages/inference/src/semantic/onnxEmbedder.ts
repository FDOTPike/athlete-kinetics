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

export function createMiniLmEmbedder(opts: MiniLmEmbedderOptions): Embedder {
  const { session, Tensor, tokenizer: spec } = opts;
  const dim = opts.dim ?? 384;
  const maxTokens = opts.maxTokens ?? 128;
  const tokenizer = new WordPieceTokenizer(spec);

  return {
    modelId: spec.modelId,
    dim,
    async embed(text: string): Promise<Float32Array> {
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
    },
  };
}
