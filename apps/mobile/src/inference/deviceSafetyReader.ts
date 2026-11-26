/**
 * deviceSafetyReader.ts — onnxruntime-react-native binding for the Stream 2
 * safety reader (`m10-r15-reader-seed3`, `r15/denial-floor`).
 *
 * Model delivery: scripts/stage-native-safety-reader.mjs places the pinned,
 * byte-verified reader_quantized.onnx (22,881,187 B) in each native package as
 * safety_reader.onnx.
 *   - Android: first use copies it once to DocumentDir (~22.9 MB), keyed by the
 *     pinned SHA-256 prefix so stale copies are purged on model updates and
 *     never collide with minilm-<pin>.onnx.
 *   - iOS: the "Stage safety reader model" Xcode build phase puts it in the app
 *     bundle; ORT opens it in place with zero Documents copy.
 * Any failure -> null -> exact shipped semantic + keyword behavior preserved.
 *
 * Shares the process-wide SerializedOrtScheduler (deviceOrtScheduler.ts) with
 * deviceEmbedder.ts so native MiniLM and safety-reader sessions never overlap.
 */
import { Platform } from 'react-native';
import {
  createLazySingleFlightSafetyReader,
  disposeOrtSession,
  type LazySafetyReaderOptions,
  type OrtSessionLike,
  type OrtTensorCtor,
  type SafetyReader,
  type TokenizerSpec,
} from '@ak/inference';
import tokenizerJson from '../../../../packages/inference/assets/minilm/tokenizer.min.json';
import {
  getDeviceOrtScheduler,
  makeLifecycleLogger,
  qaLifecycleTelemetryEnabled,
} from './deviceOrtScheduler';

const READER_MODEL_ASSET = 'safety_reader.onnx';
const READER_SHA256 =
  'a0fa76e40e10246a9caf9d1be463b72b34f03174c68b017d6673fe9f165cb5cf';
/** First 16 hex of the ratified safety-reader SHA-256
 *  (scripts/safety-reader-integrity.mjs, KNOWN_SHA256['reader_quantized.onnx']);
 *  verify:native-config pins the two together. */
const READER_PIN_PREFIX = 'a0fa76e40e10246a';

export async function tryCreateDeviceSafetyReader(): Promise<SafetyReader | null> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  try {
    const ReactNativeBlobUtil =
      (require('react-native-blob-util') as typeof import('react-native-blob-util')).default;
    const { InferenceSession, Tensor } =
      require('onnxruntime-react-native') as typeof import('onnxruntime-react-native');

    const dest = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/safety-reader-${READER_PIN_PREFIX}.onnx`;

    const hasVerifiedWorkingCopy = async (path: string): Promise<boolean> => {
      try {
        if (!(await ReactNativeBlobUtil.fs.exists(path))) return false;
        const digest = await ReactNativeBlobUtil.fs.hash(path, 'sha256');
        return typeof digest === 'string' && digest.toLowerCase() === READER_SHA256;
      } catch {
        return false;
      }
    };

    const ensureModelCopied = async (): Promise<string> => {
      if (Platform.OS === 'ios') {
        const bundled = `${ReactNativeBlobUtil.fs.dirs.MainBundleDir}/${READER_MODEL_ASSET}`;
        if (!(await ReactNativeBlobUtil.fs.exists(bundled))) {
          throw new Error('safety reader model is not in this build');
        }
        return bundled;
      }
      if (!(await hasVerifiedWorkingCopy(dest))) {
        const dir = ReactNativeBlobUtil.fs.dirs.DocumentDir;
        for (const name of await ReactNativeBlobUtil.fs.ls(dir)) {
          if (
            name === READER_MODEL_ASSET
            || /^safety-reader-[a-f0-9]{16}\.onnx(?:\.partial)?$/.test(name)
          ) {
            await ReactNativeBlobUtil.fs.unlink(`${dir}/${name}`);
          }
        }
        const partial = `${dest}.partial`;
        await ReactNativeBlobUtil.fs.cp(
          ReactNativeBlobUtil.fs.asset(READER_MODEL_ASSET),
          partial,
        );
        const partialDigest = (await ReactNativeBlobUtil.fs.hash(partial, 'sha256')).toLowerCase();
        if (partialDigest !== READER_SHA256) {
          await ReactNativeBlobUtil.fs.unlink(partial);
          throw new Error('safety reader model SHA-256 integrity mismatch');
        }
        if ((await ReactNativeBlobUtil.fs.mv(partial, dest)) === false) {
          throw new Error('safety reader model copy could not be finalized');
        }
      }
      return dest;
    };

    const readerOptions: LazySafetyReaderOptions = {
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
      readerOptions.onEvent = makeLifecycleLogger('[safety-reader-lifecycle]');
    }

    return createLazySingleFlightSafetyReader(readerOptions);
  } catch {
    return null;
  }
}
