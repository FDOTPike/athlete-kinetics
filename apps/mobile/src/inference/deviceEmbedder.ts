/**
 * deviceEmbedder.ts — onnxruntime-react-native binding for the verified
 * embedding pipeline (packages/inference/src/semantic/onnxEmbedder.ts).
 *
 * Everything numeric is machine-verified on the workstation against the SAME
 * int8 ONNX file the APK ships (verify:embedder: exact tokenizer parity,
 * cosine 1.000000, identical routing).
 *
 * Model delivery: scripts/stage-native-embedder.mjs places the pinned,
 * byte-verified model_quantized.onnx in each native package as minilm.onnx.
 *   - Android: assets live inside the APK zip and ORT needs a real file path,
 *     so first use copies it once to the document directory (~23 MB). The copy
 *     is named after the pinned SHA-256, so an app update that ships a
 *     different model can never keep running a stale copy.
 *   - iOS: the "Stage embedder model" Xcode build phase puts it in the app
 *     bundle, which is already a real, read-only file path. ORT opens it in
 *     place: no 23 MB duplicate in Documents (which iCloud would back up).
 * Any failure -> null -> policy-only mode with the triage UI showing its
 * inactive state; never a crash, never silent.
 *
 * Shares the process-wide SerializedOrtScheduler (deviceOrtScheduler.ts) with
 * deviceSafetyReader.ts so MiniLM and the safety reader never coexist in RAM.
 */
import { Platform } from 'react-native';
import {
  createLazySingleFlightEmbedder,
  disposeOrtSession,
  type Embedder,
  type LazyEmbedderOptions,
  type OrtSessionLike,
  type OrtTensorCtor,
  type TokenizerSpec,
} from '@ak/inference';
import tokenizerJson from '../../../../packages/inference/assets/minilm/tokenizer.min.json';
import {
  getDeviceOrtScheduler,
  makeLifecycleLogger,
  qaLifecycleTelemetryEnabled,
} from './deviceOrtScheduler';

const MODEL_ASSET = 'minilm.onnx';
/** First 16 hex of the ratified model SHA-256 (scripts/embedder-integrity.mjs,
 *  KNOWN_SHA256['onnx/model_quantized.onnx']); verify:native-config pins the
 *  two together. Names the Android working copy so a model change re-copies. */
const MODEL_PIN_PREFIX = 'afdb6f1a0e45b715';

/**
 * Everything native is deferred-required INSIDE the try/catch, never imported
 * at module level: onnxruntime-react-native runs `Module.install()` as an
 * import side effect, and react-native-blob-util touches its native module on
 * import too. A module-eval throw = instant crash on app open; a throw in here
 * = null -> policy-only mode with the triage UI showing its inactive state.
 */
export async function tryCreateDeviceEmbedder(): Promise<Embedder | null> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  try {
    const ReactNativeBlobUtil =
      (require('react-native-blob-util') as typeof import('react-native-blob-util')).default;
    const { InferenceSession, Tensor } =
      require('onnxruntime-react-native') as typeof import('onnxruntime-react-native');

    const dest = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/minilm-${MODEL_PIN_PREFIX}.onnx`;

    const ensureModelCopied = async (): Promise<string> => {
      if (Platform.OS === 'ios') {
        const bundled = `${ReactNativeBlobUtil.fs.dirs.MainBundleDir}/${MODEL_ASSET}`;
        if (!(await ReactNativeBlobUtil.fs.exists(bundled))) {
          throw new Error('embedder model is not in this build');
        }
        return bundled;
      }
      if (!(await ReactNativeBlobUtil.fs.exists(dest))) {
        const dir = ReactNativeBlobUtil.fs.dirs.DocumentDir;
        for (const name of await ReactNativeBlobUtil.fs.ls(dir)) {
          if (name === MODEL_ASSET || /^minilm-[a-f0-9]{16}\.onnx(?:\.partial)?$/.test(name)) {
            await ReactNativeBlobUtil.fs.unlink(`${dir}/${name}`);
          }
        }
        const partial = `${dest}.partial`;
        await ReactNativeBlobUtil.fs.cp(ReactNativeBlobUtil.fs.asset(MODEL_ASSET), partial);
        if ((await ReactNativeBlobUtil.fs.mv(partial, dest)) === false) {
          throw new Error('embedder model copy could not be finalized');
        }
      }
      return dest;
    };

    const embedderOptions: LazyEmbedderOptions = {
      tokenizer: tokenizerJson as TokenizerSpec,
      Tensor: Tensor as unknown as OrtTensorCtor,
      scheduler: getDeviceOrtScheduler(),
      createSession: async () => {
        const modelPath = await ensureModelCopied();
        return (await InferenceSession.create(modelPath)) as unknown as OrtSessionLike;
      },
      disposeSession: async (session) => {
        await disposeOrtSession(session);
      },
    };

    if (await qaLifecycleTelemetryEnabled()) {
      embedderOptions.onEvent = makeLifecycleLogger('[embedder-lifecycle]');
    }

    return createLazySingleFlightEmbedder(embedderOptions);
  } catch {
    return null;
  }
}
