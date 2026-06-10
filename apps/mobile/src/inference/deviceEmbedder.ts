/**
 * deviceEmbedder.ts — onnxruntime-react-native binding for the verified
 * embedding pipeline (packages/inference/src/semantic/onnxEmbedder.ts).
 *
 * Everything numeric is machine-verified on the workstation against the SAME
 * int8 ONNX file the APK ships (verify:embedder: 70/70 exact tokenizer
 * parity, cosine 1.000000, identical routing, 9.2 ms/query).
 *
 * Model delivery: CI places model_quantized.onnx into the Android assets dir
 * as minilm.onnx (see .github/workflows/ci.yml; the path is gitignored).
 * Assets live inside the APK zip, and ORT needs a real file path, so first
 * launch copies it once to the app's document directory (~23 MB) via
 * react-native-blob-util. Any failure -> null -> policy-only mode with the
 * triage UI showing its inactive state; never a crash, never silent.
 */
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Platform } from 'react-native';
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import {
  createMiniLmEmbedder,
  type Embedder,
  type OrtSessionLike,
  type OrtTensorCtor,
  type TokenizerSpec,
} from '@ak/inference';
// Relative import (not aliased): metro resolves it via workspace watchFolders,
// tsc via the include list. ~450 KB of vocab, inlined into the JS bundle.
import tokenizerJson from '../../../../packages/inference/assets/minilm/tokenizer.min.json';

const MODEL_ASSET = 'minilm.onnx';

/** Copy the bundled model out of the APK once; return its filesystem path. */
async function ensureModelFile(): Promise<string> {
  const dest = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${MODEL_ASSET}`;
  if (await ReactNativeBlobUtil.fs.exists(dest)) return dest;
  // 'bundle-assets://' resolves to android/app/src/main/assets on Android
  // and the main bundle on iOS (where the model must be added as a resource).
  await ReactNativeBlobUtil.fs.cp(ReactNativeBlobUtil.fs.asset(MODEL_ASSET), dest);
  return dest;
}

export async function tryCreateDeviceEmbedder(): Promise<Embedder | null> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  try {
    const modelPath = await ensureModelFile();
    const session = await InferenceSession.create(modelPath);
    return createMiniLmEmbedder({
      session: session as unknown as OrtSessionLike,
      Tensor: Tensor as unknown as OrtTensorCtor,
      tokenizer: tokenizerJson as TokenizerSpec,
    });
  } catch {
    return null; // missing/corrupt model -> policy-only mode, never a crash
  }
}
