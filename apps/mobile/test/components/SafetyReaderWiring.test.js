/**
 * SafetyReaderWiring.test.js — Stream 2 PR 3 mobile runtime integration tests:
 *   - Shared process-wide SerializedOrtScheduler across deviceEmbedder + deviceSafetyReader
 *     (maxConcurrent === 1, fail-closed cross-wrapper disposal latch);
 *   - Concurrent QA manifest readback race-safety ([embedder-lifecycle] + [safety-reader-lifecycle]);
 *   - Android DocumentDir working-copy isolation vs iOS MainBundleDir in-place loading;
 *   - End-to-end useStore.reportSubjective wiring (subtle safety halt, harmless denial
 *     suppression, uncontested positive-strong preservation, fail-safe fallback on reader
 *     error, and async athlete-ownership lease retention while safetyReader.classify awaits).
 */
import { Platform } from 'react-native';
import { useStore, closeStoreDatabaseForRestore } from '../../src/state/useStore';
import {
  acquireDataMaintenanceLock,
  activeDataMutationLeaseCount,
  authorizeAthleteDataBoot,
  resetDataMaintenanceLockForTests,
} from '../../src/state/dataMaintenanceLock';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';
import { tryCreateDeviceEmbedder } from '../../src/inference/deviceEmbedder';
import { tryCreateDeviceSafetyReader } from '../../src/inference/deviceSafetyReader';
import {
  createFreshDeviceOrtSchedulerForTests,
  resetQaTelemetryCacheForTests,
} from '../../src/inference/deviceOrtScheduler';

let mockDrivers;
let mockRegistry;
function mockDriverFor(name) {
  if (!mockDrivers.has(name)) {
    mockDrivers.set(name, { ...makeNodeSqliteDriver(), close: jest.fn() });
  }
  return mockDrivers.get(name);
}
jest.mock('@op-engineering/op-sqlite', () => ({ open: ({ name }) => mockDriverFor(name) }));
jest.mock('../../src/state/athleteRegistry', () => ({
  loadRegistry: async () => mockRegistry,
  saveRegistry: async (next) => {
    mockRegistry = next;
    return true;
  },
}));

const A = 'athlete_kinetics.db';
const B = 'athlete_b.db';
const state = () => useStore.getState();
const rows = (file, sql, ...params) => mockDrivers.get(file).raw.prepare(sql).all(...params);
const settle = async () => {
  for (let n = 0; n < 8; n += 1) await new Promise((r) => setImmediate(r));
};
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

beforeEach(async () => {
  await state().connectBiometrics(null);
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  closeStoreDatabaseForRestore();
  mockDrivers = new Map();
  mockRegistry = {
    version: 1,
    activeId: 'default',
    advancedToolsUnlocked: true,
    athletes: [
      { id: 'default', name: 'Synthetic A', dbName: A, createdAtMs: 0 },
      { id: 'athlete-b', name: 'Synthetic B', dbName: B, createdAtMs: 1 },
    ],
  };
  useStore.setState({
    status: 'booting',
    error: null,
    activeAthleteId: 'default',
    session: null,
    runner: null,
    triaging: false,
    biometricsStatus: 'off',
    lastTriage: null,
  });
  state().setEmbedder(null);
  state().setSafetyReader(null);
  state().boot();
  await settle();
  expect(state().status).toBe('ready');
  expect(state().loadDemoAthlete()).toBe('loaded');
  expect(activeDataMutationLeaseCount()).toBe(0);
});

describe('Stream 2 PR 3 — mobile safety reader + shared scheduler + useStore wiring', () => {
  test('reportSubjective escalates subtle neurological symptoms missed by MiniLM & keywords to dizzy halt', async () => {
    // Low-magnitude non-matching vector -> semantic triage rejects
    state().setEmbedder({ embed: async () => new Float32Array(384) });
    state().setSafetyReader({
      modelId: 'm10-r15-reader-seed3',
      policyId: 'r15/denial-floor',
      classify: async () => ({
        cautionLogit: 5.4,
        active: true,
        standaloneRouteId: 'dizzy',
        actionableRouteId: 'dizzy',
      }),
    });

    expect(
      state().createTrainingProgram({
        horizon: { kind: 'weeks', blockCount: 1 },
        schemaType: 'LINEAR',
        dayIndices: [1, 3, 5],
      }),
    ).toBe(true);
    const nextPlanned = state().blockSessions.find((s) => !s.completed);
    expect(nextPlanned).toBeDefined();
    state().startSession(false, nextPlanned.plannedSessionId);
    expect(state().session).not.toBeNull();
    expect(state().runner?.phase).toBe('working');

    const before = rows(A, 'SELECT * FROM subjective_report').length;
    const saved = await state().reportSubjective('vision went dim for a second after standing', 8);
    expect(saved).toBe(true);

    const inserted = rows(
      A,
      'SELECT raw_text, matched_entry_id, halt, load_modifier, rpe_cap FROM subjective_report',
    ).slice(before);
    expect(inserted).toEqual([
      {
        raw_text: 'vision went dim for a second after standing',
        matched_entry_id: 'dizzy',
        halt: 1,
        load_modifier: 0,
        rpe_cap: 0,
      },
    ]);
    expect(state().lastTriage?.kind).toBe('matched');
    expect(state().lastTriage?.directive?.halt).toBe(true);
    expect(state().runner?.phase).toBe('halted');
    expect(state().runner?.haltReason).toBe('safety');
  });

  test('reportSubjective suppresses harmless denial misfires from MiniLM without modifying prescription', async () => {
    // Force MiniLM to return exact canonical vector for pain-mild
    const vectorsAsset = require('../../../../packages/inference/assets/phrase-codebase.vectors.json');
    const painMildVec = Float32Array.from(vectorsAsset.vectors[0]);
    state().setEmbedder({ embed: async () => painMildVec });
    state().setSafetyReader({
      modelId: 'm10-r15-reader-seed3',
      policyId: 'r15/denial-floor',
      classify: async () => ({
        cautionLogit: 0.9,
        active: true,
        standaloneRouteId: 'pain-mild',
        actionableRouteId: 'pain-mild',
      }),
    });

    const baselinePrescription = state().prescription?.vector;
    const before = rows(A, 'SELECT * FROM subjective_report').length;
    const saved = await state().reportSubjective('no pain today', 2);
    expect(saved).toBe(true);

    const inserted = rows(
      A,
      'SELECT raw_text, matched_entry_id, halt, load_modifier FROM subjective_report',
    ).slice(before);
    expect(inserted).toEqual([
      {
        raw_text: 'no pain today',
        matched_entry_id: null,
        halt: 0,
        load_modifier: null,
      },
    ]);
    expect(state().lastTriage).toEqual({ kind: 'rejected' });
    expect(state().prescription?.vector).toEqual(baselinePrescription);
  });

  test('reportSubjective preserves positive-strong acknowledgment when reader sees no caution, and degrades fail-safe when reader throws', async () => {
    const codebaseJson = require('../../../../packages/inference/assets/phrase-codebase.json');
    const vectorsAsset = require('../../../../packages/inference/assets/phrase-codebase.vectors.json');
    // Find vector index for positive-strong primary text
    let offset = 0;
    for (const entry of codebaseJson.entries) {
      if (entry.id === 'positive-strong') break;
      offset += 1 + entry.aliases.length;
    }
    const positiveVec = Float32Array.from(vectorsAsset.vectors[offset]);
    state().setEmbedder({ embed: async () => positiveVec });
    state().setSafetyReader({
      modelId: 'm10-r15-reader-seed3',
      policyId: 'r15/denial-floor',
      classify: async () => ({
        cautionLogit: -5.1,
        active: false,
        standaloneRouteId: null,
        actionableRouteId: null,
      }),
    });

    const okPos = await state().reportSubjective('feeling strong and fresh today, weights are moving fast', 1);
    expect(okPos).toBe(true);
    expect(state().lastTriage?.kind).toBe('positive');
    expect(state().lastTriage?.entryId).toBe('positive-strong');

    // Now simulate safetyReader throwing -> must degrade cleanly to shipped pain-mild match
    const painMildVec = Float32Array.from(vectorsAsset.vectors[0]);
    state().setEmbedder({ embed: async () => painMildVec });
    state().setSafetyReader({
      modelId: 'm10-r15-reader-seed3',
      policyId: 'r15/denial-floor',
      classify: async () => {
        throw new Error('simulated native reader failure');
      },
    });
    const okFallback = await state().reportSubjective('knee is a little tender today', 6);
    expect(okFallback).toBe(true);
    expect(state().lastTriage?.kind).toBe('matched');
    expect(state().error).toBeNull();
  });

  test('async athlete-ownership lease stays held while safetyReader.classify is pending', async () => {
    const holdReader = deferred();
    state().setEmbedder({ embed: async () => new Float32Array(384) });
    state().setSafetyReader({
      modelId: 'm10-r15-reader-seed3',
      policyId: 'r15/denial-floor',
      classify: () => holdReader.promise,
    });

    const before = rows(A, 'SELECT * FROM subjective_report').length;
    const pending = state().reportSubjective('vision went spotty after the set', 9);
    await settle();

    // Embedder already settled, safetyReader is still awaiting -> lease MUST still be held!
    expect(activeDataMutationLeaseCount()).toBe(1);
    state().switchAthlete('athlete-b');
    expect(state().activeAthleteId).toBe('default');
    expect(() => acquireDataMaintenanceLock('test-restore')).toThrow(/still being saved/i);

    holdReader.resolve({
      cautionLogit: 6.1,
      active: true,
      standaloneRouteId: 'dizzy',
      actionableRouteId: 'dizzy',
    });
    await pending;

    expect(activeDataMutationLeaseCount()).toBe(0);
    expect(mockDrivers.has(B) ? rows(B, 'SELECT * FROM subjective_report') : []).toEqual([]);
    expect(rows(A, 'SELECT matched_entry_id, halt FROM subjective_report').slice(before)).toEqual([
      { matched_entry_id: 'dizzy', halt: 1 },
    ]);
  });

  test('deviceEmbedder and deviceSafetyReader share one SerializedOrtScheduler, isolate Android working copies, and avoid QA manifest race', async () => {
    const origOS = Platform.OS;
    const origDev = global.__DEV__;
    const logs = [];
    const spyLog = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    let activeNativeSessions = 0;
    let maxConcurrentSessions = 0;
    let failNextDispose = false;
    const files = new Map([
      ['asset:minilm.onnx', 'minilm-bytes'],
      ['asset:safety_reader.onnx', 'reader-bytes'],
      [
        'asset:candidate_manifest.json',
        JSON.stringify({
          schema: 'ak.candidate-manifest/1',
          label: 'NON_PRODUCTION_QA_DEBUG_SIGNED',
          qaLifecycleTelemetry: true,
        }),
      ],
      ['/docs/minilm-0000000000000000.onnx', 'stale-minilm'],
      ['/docs/safety-reader-1111111111111111.onnx', 'stale-reader'],
    ]);

    jest.resetModules();
    Platform.OS = 'android';
    global.__DEV__ = false;

    jest.doMock(
      'react-native-blob-util',
      () => ({
        default: {
          fs: {
            dirs: { DocumentDir: '/docs', MainBundleDir: '/bundle' },
            asset: (name) => `asset:${name}`,
            exists: async (p) => files.has(p),
            ls: async (dir) =>
              [...files.keys()]
                .filter((k) => k.startsWith(`${dir}/`))
                .map((k) => k.slice(dir.length + 1)),
            cp: async (src, dst) => {
              await new Promise((r) => setTimeout(r, 5));
              if (!files.has(src)) throw new Error(`missing ${src}`);
              files.set(dst, files.get(src));
            },
            mv: async (src, dst) => {
              if (!files.has(src)) return false;
              files.set(dst, files.get(src));
              files.delete(src);
              return true;
            },
            readFile: async (p) => {
              await new Promise((r) => setTimeout(r, 5));
              if (!files.has(p)) throw new Error(`ENOENT ${p}`);
              return files.get(p);
            },
            unlink: async (p) => {
              files.delete(p);
            },
          },
        },
      }),
      { virtual: true },
    );

    class MockTensor {
      constructor(type, data, dims) {
        this.type = type;
        this.data = data;
        this.dims = dims;
      }
    }

    jest.doMock(
      'onnxruntime-react-native',
      () => ({
        Tensor: MockTensor,
        InferenceSession: {
          create: async (modelPath) => {
            activeNativeSessions += 1;
            maxConcurrentSessions = Math.max(maxConcurrentSessions, activeNativeSessions);
            const isReader = modelPath.includes('safety-reader') || modelPath.includes('safety_reader');
            return {
              inputNames: ['input_ids', 'attention_mask'],
              outputNames: isReader ? ['caution_logit', 'routing_logits'] : ['last_hidden_state'],
              async run(feeds) {
                await new Promise((r) => setTimeout(r, 15));
                const n = feeds.input_ids.dims[1];
                if (isReader) {
                  const routing = new Float32Array(13).fill(-1);
                  routing[0] = 3.5; // dizzy
                  return {
                    caution_logit: { data: Float32Array.from([4.2]), dims: [1], type: 'float32' },
                    routing_logits: { data: routing, dims: [1, 13], type: 'float32' },
                  };
                }
                return {
                  last_hidden_state: { data: new Float32Array(n * 384).fill(0.1), dims: [1, n, 384] },
                };
              },
              handler: {
                async dispose() {
                  await new Promise((r) => setTimeout(r, 5));
                  activeNativeSessions -= 1;
                  if (failNextDispose) {
                    failNextDispose = false;
                    throw new Error('simulated native release failure');
                  }
                },
              },
            };
          },
        },
      }),
      { virtual: true },
    );

    try {
      const freshEmbMod = require('../../src/inference/deviceEmbedder');
      const freshRdrMod = require('../../src/inference/deviceSafetyReader');
      const freshSchedMod = require('../../src/inference/deviceOrtScheduler');
      freshSchedMod.resetQaTelemetryCacheForTests();
      freshSchedMod.createFreshDeviceOrtSchedulerForTests();

      // Concurrent startup creation (mirrors App.tsx) -> must NOT race on .qa_manifest scratch file
      const [emb, rdr] = await Promise.all([
        freshEmbMod.tryCreateDeviceEmbedder(),
        freshRdrMod.tryCreateDeviceSafetyReader(),
      ]);
      expect(emb).not.toBeNull();
      expect(rdr).not.toBeNull();

      // Interleave embedder + safetyReader calls concurrently -> shared scheduler enforces maxConcurrent === 1
      const [vec, pred] = await Promise.all([
        emb.embed('what is a deload week'),
        rdr.classify('vision went spotty'),
      ]);
      expect(vec.length).toBe(384);
      expect(pred.actionableRouteId).toBe('dizzy');
      expect(maxConcurrentSessions).toBe(1);
      expect(activeNativeSessions).toBe(0);

      // Verify stale working copies were cleaned up WITHOUT deleting the other model's active copy
      expect(files.has('/docs/minilm-afdb6f1a0e45b715.onnx')).toBe(true);
      expect(files.has('/docs/safety-reader-a0fa76e40e10246a.onnx')).toBe(true);
      expect(files.has('/docs/minilm-0000000000000000.onnx')).toBe(false);
      expect(files.has('/docs/safety-reader-1111111111111111.onnx')).toBe(false);

      // Verify BOTH lifecycle tags emitted without scratch-file race loss
      expect(logs.some((l) => l.includes('[embedder-lifecycle] request=1 ok=1'))).toBe(true);
      expect(logs.some((l) => l.includes('[safety-reader-lifecycle] request=1 ok=1'))).toBe(true);

      // Verify cross-wrapper fail-closed disposal latch: if safetyReader release() throws, embedder is ALSO blocked!
      failNextDispose = true;
      await expect(rdr.classify('trigger release failure')).rejects.toThrow(/simulated native release failure/);
      await expect(emb.embed('must be blocked by shared latch')).rejects.toThrow(/latched fail-closed/);
    } finally {
      Platform.OS = origOS;
      global.__DEV__ = origDev;
      spyLog.mockRestore();
      jest.dontMock('react-native-blob-util');
      jest.dontMock('onnxruntime-react-native');
    }
  });
});
