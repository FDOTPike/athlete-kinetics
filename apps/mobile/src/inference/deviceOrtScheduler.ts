/**
 * deviceOrtScheduler.ts — Shared process-wide SerializedOrtScheduler and
 * content-free QA lifecycle telemetry helpers for native ONNX Runtime wrappers
 * (deviceEmbedder + deviceSafetyReader).
 *
 * Sharing one scheduler across readiness triage, Glossary Question Box, and
 * the Stream 2 safety reader guarantees at most one native C++ InferenceSession
 * exists in mobile RAM at any instant, and latches fail-closed across all ONNX
 * wrappers if any native session disposal ever rejects.
 */
import {
  createSerializedOrtScheduler,
  type EmbedderLifecycleEvent,
  type SerializedOrtScheduler,
} from '@ak/inference';

declare const __DEV__: boolean;

export type DeviceLifecycleTag = '[embedder-lifecycle]' | '[safety-reader-lifecycle]';

const MANIFEST_ASSET = 'candidate_manifest.json';
const QA_MANIFEST_SCHEMA = 'ak.candidate-manifest/1';
const QA_MANIFEST_LABEL = 'NON_PRODUCTION_QA_DEBUG_SIGNED';

interface QaManifestView {
  schema?: string;
  label?: string;
  qaLifecycleTelemetry?: boolean;
}

let sharedScheduler: SerializedOrtScheduler = createSerializedOrtScheduler();
let telemetryDecisionPromise: Promise<boolean> | null = null;
let manifestReadbackSeq = 0;

export function getDeviceOrtScheduler(): SerializedOrtScheduler {
  return sharedScheduler;
}

/** Test-only reset for isolated unit tests exercising disposal latching. */
export function createFreshDeviceOrtSchedulerForTests(): SerializedOrtScheduler {
  sharedScheduler = createSerializedOrtScheduler();
  return sharedScheduler;
}

/** Test-only reset for isolated unit tests exercising QA manifest readback. */
export function resetQaTelemetryCacheForTests(): void {
  telemetryDecisionPromise = null;
}

async function computeQaLifecycleTelemetryEnabled(): Promise<boolean> {
  if (__DEV__) return true;
  let scratch: string | null = null;
  let unlinkFn: ((path: string) => Promise<unknown>) | null = null;
  try {
    const ReactNativeBlobUtil = (
      require('react-native-blob-util') as typeof import('react-native-blob-util')
    ).default;
    manifestReadbackSeq += 1;
    scratch = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/.qa_manifest.${manifestReadbackSeq}.readback.json`;
    unlinkFn = (p: string) => ReactNativeBlobUtil.fs.unlink(p);
    await ReactNativeBlobUtil.fs.cp(ReactNativeBlobUtil.fs.asset(MANIFEST_ASSET), scratch);
    const text = await ReactNativeBlobUtil.fs.readFile(scratch, 'utf8');
    const manifest = JSON.parse(text) as QaManifestView;
    return (
      manifest.schema === QA_MANIFEST_SCHEMA
      && manifest.label === QA_MANIFEST_LABEL
      && manifest.qaLifecycleTelemetry === true
    );
  } catch {
    return false;
  } finally {
    if (scratch !== null && unlinkFn !== null) {
      try {
        await unlinkFn(scratch);
      } catch {
        // Scratch cleanup is best-effort inside an isolated telemetry failure domain.
      }
    }
  }
}

/** Memoized QA telemetry opt-in check so concurrent startup wrappers never
 *  race on a shared scratch path. */
export function qaLifecycleTelemetryEnabled(): Promise<boolean> {
  if (telemetryDecisionPromise === null) {
    telemetryDecisionPromise = computeQaLifecycleTelemetryEnabled();
  }
  return telemetryDecisionPromise;
}

/** Content-free QA lifecycle sink: counters, request ids, and durations only. */
export function makeLifecycleLogger(
  tag: DeviceLifecycleTag,
): (event: EmbedderLifecycleEvent) => void {
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
      console.log(`${tag} request=${event.requestId} ok=${event.ok ? 1 : 0} totalMs=${totalMs}`);
      return;
    }
    console.log(
      `${tag} ${event.phase}:${event.stage}`
      + ` req=${event.requestId} ok=${event.ok ? 1 : 0}`
      + ` created=${event.createdTotal} disposed=${event.disposedTotal}`,
    );
  };
}
