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
 * QA lifecycle telemetry (WO remediation D3): in dev builds, or in a build
 * carrying the generated QA candidate manifest that explicitly opts in, the
 * lazy single-flight wrapper reports content-free lifecycle counters (phase,
 * stage, request id, outcome, cumulative created/disposed totals, timestamps)
 * plus per-request end-to-end latency. Events NEVER contain report text,
 * embeddings, database contents, or any other user data, and they are absent
 * entirely in production release behavior: release builds ship neither
 * __DEV__ nor a QA manifest, so the sink is never constructed there.
 */
import { Platform } from 'react-native';
import {
  createLazySingleFlightEmbedder,
  disposeOrtSession,
  type Embedder,
  type EmbedderLifecycleEvent,
  type LazyEmbedderOptions,
  type OrtSessionLike,
  type OrtTensorCtor,
  type TokenizerSpec,
} from '@ak/inference';
// Relative import (not aliased): metro resolves it via workspace watchFolders,
// tsc via the include list. ~450 KB of vocab, inlined into the JS bundle.
import tokenizerJson from '../../../../packages/inference/assets/minilm/tokenizer.min.json';

const MODEL_ASSET = 'minilm.onnx';
/** First 16 hex of the ratified model SHA-256 (scripts/embedder-integrity.mjs,
 *  KNOWN_SHA256['onnx/model_quantized.onnx']); verify:native-config pins the
 *  two together. Names the Android working copy so a model change re-copies. */
const MODEL_PIN_PREFIX = 'afdb6f1a0e45b715';
const MANIFEST_ASSET = 'candidate_manifest.json';

declare const __DEV__: boolean;

/** The subset of the generated candidate manifest this module may consult.
 *  Telemetry is enabled only when a well-formed NON_PRODUCTION QA manifest
 *  explicitly opts in — a malformed or absent manifest means OFF. */
interface QaManifestView {
  schema?: string;
  label?: string;
  qaLifecycleTelemetry?: boolean;
}

const QA_MANIFEST_SCHEMA = 'ak.candidate-manifest/1';
const QA_MANIFEST_LABEL = 'NON_PRODUCTION_QA_DEBUG_SIGNED';

/** Read the opt-in flag from the packaged QA manifest. Isolated failure domain:
 *  any problem here yields false (telemetry off) and must never affect
 *  embedder availability. */
async function qaLifecycleTelemetryEnabled(): Promise<boolean> {
  if (__DEV__) return true;
  try {
    const ReactNativeBlobUtil = (
      require('react-native-blob-util') as typeof import('react-native-blob-util')
    ).default;
    const scratch = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/.qa_manifest.readback.json`;
    // Asset entries live inside the APK zip; copy out before parsing.
    await ReactNativeBlobUtil.fs.cp(ReactNativeBlobUtil.fs.asset(MANIFEST_ASSET), scratch);
    const text = await ReactNativeBlobUtil.fs.readFile(scratch, 'utf8');
    await ReactNativeBlobUtil.fs.unlink(scratch);
    const manifest = JSON.parse(text) as QaManifestView;
    return (
      manifest.schema === QA_MANIFEST_SCHEMA
      && manifest.label === QA_MANIFEST_LABEL
      && manifest.qaLifecycleTelemetry === true
    );
  } catch {
    return false; // no manifest / unreadable / wrong identity -> telemetry stays off
  }
}

/** Content-free QA sink: counters and outcomes only. Per-request total latency
 *  is derived from the wrapper's own start/settled timestamps. */
function makeLifecycleLogger(): (event: EmbedderLifecycleEvent) => void {
  const requestStarts = new Map<number, number>();
  return (event: EmbedderLifecycleEvent) => {
    if (event.phase === 'request' && event.stage === 'start') {
      requestStarts.set(event.requestId, event.atMs);
      return;
    }
    if (event.phase === 'request' && event.stage === 'settled') {
      const startedAt = requestStarts.get(event.requestId);
      requestStarts.delete(event.requestId);
      const totalMs = startedAt === undefined ? -1 : event.atMs - startedAt;
      console.log(
        `[embedder-lifecycle] request=${event.requestId} ok=${event.ok ? 1 : 0} totalMs=${totalMs}`,
      );
      return;
    }
    console.log(
      `[embedder-lifecycle] ${event.phase}:${event.stage}`
      + ` req=${event.requestId} ok=${event.ok ? 1 : 0}`
      + ` created=${event.createdTotal} disposed=${event.disposedTotal}`,
    );
  };
}

/**
 * Everything native is deferred-required INSIDE the try/catch, never imported
 * at module level: onnxruntime-react-native runs `Module.install()` as an
 * import side effect (and its Android install path uses the legacy-arch
 * `getCatalystInstance()`, which cannot succeed under RN 0.81 bridgeless),
 * and react-native-blob-util touches its native module on import too. A
 * module-eval throw = instant crash on app open; a throw in here = null ->
 * policy-only mode with the triage UI showing its inactive state.
 *
 * The returned Embedder is a lightweight wrapper that creates an InferenceSession
 * lazily per semantic inference request, serializes concurrent calls, awaits
 * native C++ disposal in finally, and clears all session references.
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
        // Remove working copies that are never read again: the unkeyed copy of
        // an earlier build, copies keyed to an older pin, and an interrupted
        // partial copy (~23 MB each).
        const dir = ReactNativeBlobUtil.fs.dirs.DocumentDir;
        for (const name of await ReactNativeBlobUtil.fs.ls(dir)) {
          if (name === MODEL_ASSET || /^minilm-[a-f0-9]{16}\.onnx(?:\.partial)?$/.test(name)) {
            await ReactNativeBlobUtil.fs.unlink(`${dir}/${name}`);
          }
        }
        // Copy beside the final name, then move: a copy cut short by process
        // death or a full disk is never mistaken for the model on next launch.
        const partial = `${dest}.partial`;
        await ReactNativeBlobUtil.fs.cp(ReactNativeBlobUtil.fs.asset(MODEL_ASSET), partial);
        if ((await ReactNativeBlobUtil.fs.mv(partial, dest)) === false) throw new Error('embedder model copy could not be finalized');
      }
      return dest;
    };

    const embedderOptions: LazyEmbedderOptions = {
      tokenizer: tokenizerJson as TokenizerSpec,
      Tensor: Tensor as unknown as OrtTensorCtor,
      createSession: async () => {
        const modelPath = await ensureModelCopied();
        return (await InferenceSession.create(modelPath)) as unknown as OrtSessionLike;
      },
      disposeSession: async (session) => {
        await disposeOrtSession(session);
      },
    };

    // Telemetry decision happens before wrapper creation so even the wrapper
    // event (zero sessions at creation) is observable in QA/dev.
    if (await qaLifecycleTelemetryEnabled()) {
      embedderOptions.onEvent = makeLifecycleLogger();
    }

    return createLazySingleFlightEmbedder(embedderOptions);
  } catch {
    return null; // missing module/model, JSI install failure -> policy-only
  }
}
