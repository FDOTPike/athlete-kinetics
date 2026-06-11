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
import { Platform } from 'react-native';
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

/**
 * Everything native is deferred-required INSIDE the try/catch, never imported
 * at module level: onnxruntime-react-native runs `Module.install()` as an
 * import side effect (and its Android install path uses the legacy-arch
 * `getCatalystInstance()`, which cannot succeed under RN 0.81 bridgeless),
 * and react-native-blob-util touches its native module on import too. A
 * module-eval throw = instant crash on app open; a throw in here = null ->
 * policy-only mode with the triage UI showing its inactive state.
 */
export async function tryCreateDeviceEmbedder(): Promise<Embedder | null> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  try {
    const ReactNativeBlobUtil =
      (require('react-native-blob-util') as typeof import('react-native-blob-util')).default;
    const { InferenceSession, Tensor } =
      require('onnxruntime-react-native') as typeof import('onnxruntime-react-native');

    // Copy the bundled model out of the APK once ('bundle-assets://' is the
    // Android assets dir; on iOS the model must be a main-bundle resource).
    const dest = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${MODEL_ASSET}`;
    if (!(await ReactNativeBlobUtil.fs.exists(dest))) {
      await ReactNativeBlobUtil.fs.cp(ReactNativeBlobUtil.fs.asset(MODEL_ASSET), dest);
    }

    const session = await InferenceSession.create(dest);
    return createMiniLmEmbedder({
      session: session as unknown as OrtSessionLike,
      Tensor: Tensor as unknown as OrtTensorCtor,
      tokenizer: tokenizerJson as TokenizerSpec,
    });
  } catch {
    return null; // missing module/model, JSI install failure -> policy-only
  }
}
