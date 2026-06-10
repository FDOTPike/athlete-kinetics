/**
 * deviceEmbedder.ts — onnxruntime-react-native binding for the verified
 * embedding pipeline (packages/inference/src/semantic/onnxEmbedder.ts).
 *
 * Everything numeric here is already machine-verified on the workstation
 * against the same int8 ONNX file (verify:embedder: 70/70 exact tokenizer
 * parity, cosine 1.000000, identical routing). The ONE seam that can only
 * be validated on hardware is MODEL_PATH: how the ~23 MB model file reaches
 * the device filesystem. Options, in preference order:
 *   (a) ship in android/app/src/main/assets + copy to DocumentDirectory on
 *       first launch (react-native-fs), pass that absolute path here;
 *   (b) download on first launch from a GitHub Release (keeps APK small).
 * Until the Phase 6 on-device smoke test wires one of these, MODEL_PATH is
 * null and the app runs in policy-only mode — triage UI shows its
 * unavailable state, nothing crashes, nothing degrades silently.
 */
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import {
  createMiniLmEmbedder,
  type Embedder,
  type OrtSessionLike,
  type OrtTensorCtor,
} from '@ak/inference';
import type { TokenizerSpec } from '@ak/inference';
// Relative import (not aliased): metro resolves it via workspace watchFolders,
// tsc via the include list. ~450 KB of vocab, inlined into the JS bundle.
import tokenizerJson from '../../../../packages/inference/assets/minilm/tokenizer.min.json';

/** Set by the device-integration step (see header). */
const MODEL_PATH: string | null = null;

export async function tryCreateDeviceEmbedder(): Promise<Embedder | null> {
  if (MODEL_PATH === null) return null;
  try {
    const session = await InferenceSession.create(MODEL_PATH);
    return createMiniLmEmbedder({
      session: session as unknown as OrtSessionLike,
      Tensor: Tensor as unknown as OrtTensorCtor,
      tokenizer: tokenizerJson as TokenizerSpec,
    });
  } catch {
    return null; // missing/corrupt model -> policy-only mode, never a crash
  }
}
