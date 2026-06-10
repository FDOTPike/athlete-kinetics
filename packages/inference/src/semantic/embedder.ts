/**
 * embedder.ts — the only seam that touches an ML runtime.
 *
 * Device implementation: onnxruntime-react-native + a quantized MiniLM-class
 * sentence encoder (~23 MB int8 ONNX + ~230 KB WordPiece vocab bundled as
 * assets; ~40-60 MB resident during a single embed call, released after).
 * Node/test implementation: scripts use @xenova/transformers with the SAME
 * model id, so build-time codebase vectors and device-time query vectors
 * live in one space.
 *
 * The pipeline only ever embeds ONE short user string at a time; the phrase
 * codebase ships pre-embedded.
 */
export interface Embedder {
  readonly modelId: string;
  readonly dim: number;
  /** Returns an L2-normalized sentence vector. */
  embed(text: string): Promise<Float32Array>;
}
