/**
 * SafetyReaderWiring.test.js — Stream 2 PR 3 mobile runtime integration tests:
 *   - Shared process-wide SerializedOrtScheduler across deviceEmbedder + deviceSafetyReader
 *     (maxConcurrent === 1, fail-closed cross-wrapper disposal latch);
 *   - Concurrent QA manifest readback race-safety ([embedder-lifecycle] + [safety-reader-lifecycle]);
 *   - Android DocumentDir working-copy isolation vs iOS MainBundleDir in-place loading;
 *   - End-to-end useStore.reportSubjective wiring (subtle safety halt, harmless denial
 *     suppression, uncontested positive-strong preservation, fail-safe fallback on reader
 *     error, async athlete-ownership lease retention while safetyReader.classify awaits,
 *     classify short-circuit when the keyword/semantic baseline already halts, and
 *     codebase-read failure isolation when only the safety reader is present).
 *
 * Native modules are mocked ONCE at module scope (no jest.resetModules): the
 * device wrappers require react-native-blob-util / onnxruntime-react-native
 * lazily inside their async factories and read Platform.OS at call time, so
 * every test mutates the SAME Platform object those wrappers imported.
 */
import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useStore, closeStoreDatabaseForRestore } from '../../src/state/useStore';
import { SubjectiveReportPanel } from '../../src/components/SubjectiveReportPanel';
import BlockScreen from '../../src/screens/BlockScreen';
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

// One-shot codebase read failure: when armed, the NEXT read of
// `getCodebase().entries` inside useStore throws. Everything else delegates to
// the real loaded codebase.
const mockCodebaseFault = { armed: false };
jest.mock('@ak/inference', () => {
  const actual = jest.requireActual('@ak/inference');
  return {
    ...actual,
    loadCodebase: (...args) => {
      const real = actual.loadCodebase(...args);
      return new Proxy(real, {
        get(target, prop, receiver) {
          if (prop === 'entries' && mockCodebaseFault.armed) {
            mockCodebaseFault.armed = false;
            throw new Error('simulated codebase read failure');
          }
          return Reflect.get(target, prop, receiver);
        },
      });
    },
  };
});

// Per-test mutable native harness backing the module-scope native mocks.
const mockOrtHarness = {
  files: new Map(),
  createdModelPaths: [],
  activeNativeSessions: 0,
  maxConcurrentSessions: 0,
  failNextDispose: false,
};
const resetOrtHarness = (entries) => {
  mockOrtHarness.files = new Map(entries);
  mockOrtHarness.createdModelPaths = [];
  mockOrtHarness.activeNativeSessions = 0;
  mockOrtHarness.maxConcurrentSessions = 0;
  mockOrtHarness.failNextDispose = false;
};
const mockDelay = (ms) => new Promise((done) => setTimeout(done, ms));

jest.mock(
  'react-native-blob-util',
  () => ({
    default: {
      fs: {
        dirs: { DocumentDir: '/docs', MainBundleDir: '/bundle' },
        asset: (name) => `asset:${name}`,
        exists: async (p) => mockOrtHarness.files.has(p),
        ls: async (dir) =>
          [...mockOrtHarness.files.keys()]
            .filter((k) => k.startsWith(`${dir}/`))
            .map((k) => k.slice(dir.length + 1)),
        cp: async (src, dst) => {
          await mockDelay(5);
          if (!mockOrtHarness.files.has(src)) throw new Error(`missing ${src}`);
          mockOrtHarness.files.set(dst, mockOrtHarness.files.get(src));
        },
        mv: async (src, dst) => {
          if (!mockOrtHarness.files.has(src)) return false;
          mockOrtHarness.files.set(dst, mockOrtHarness.files.get(src));
          mockOrtHarness.files.delete(src);
          return true;
        },
        readFile: async (p) => {
          await mockDelay(5);
          if (!mockOrtHarness.files.has(p)) throw new Error(`ENOENT ${p}`);
          return mockOrtHarness.files.get(p);
        },
        unlink: async (p) => {
          mockOrtHarness.files.delete(p);
        },
        hash: async (p, alg) => {
          await mockDelay(2);
          if (!mockOrtHarness.files.has(p)) throw new Error(`ENOENT ${p}`);
          const val = mockOrtHarness.files.get(p);
          if (alg === 'sha256') {
            if (val === 'reader-bytes') {
              return 'a0fa76e40e10246a9caf9d1be463b72b34f03174c68b017d6673fe9f165cb5cf';
            }
            if (val === 'minilm-bytes') {
              return 'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1';
            }
          }
          const crypto = require('node:crypto');
          return crypto.createHash(alg).update(String(val)).digest('hex');
        },
      },
    },
  }),
);

jest.mock(
  'onnxruntime-react-native',
  () => {
    class MockTensor {
      constructor(type, data, dims) {
        this.type = type;
        this.data = data;
        this.dims = dims;
      }
    }
    return {
      Tensor: MockTensor,
      InferenceSession: {
        create: async (modelPath) => {
          if (!mockOrtHarness.files.has(modelPath)) throw new Error(`ENOENT ${modelPath}`);
          mockOrtHarness.createdModelPaths.push(modelPath);
          mockOrtHarness.activeNativeSessions += 1;
          mockOrtHarness.maxConcurrentSessions = Math.max(
            mockOrtHarness.maxConcurrentSessions,
            mockOrtHarness.activeNativeSessions,
          );
          const isReader = modelPath.includes('safety-reader') || modelPath.includes('safety_reader');
          return {
            inputNames: ['input_ids', 'attention_mask'],
            outputNames: isReader ? ['caution_logit', 'routing_logits'] : ['last_hidden_state'],
            async run(feeds) {
              await mockDelay(15);
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
                await mockDelay(5);
                mockOrtHarness.activeNativeSessions -= 1;
                if (mockOrtHarness.failNextDispose) {
                  mockOrtHarness.failNextDispose = false;
                  throw new Error('simulated native release failure');
                }
              },
            },
          };
        },
      },
    };
  },
  { virtual: true },
);

const A = 'athlete_kinetics.db';
const B = 'athlete_b.db';
const getStoreState = () => useStore.getState();
const rows = (file, sql, ...params) => mockDrivers.get(file).raw.prepare(sql).all(...params);
const settle = async () => {
  for (let n = 0; n < 8; n += 1) await new Promise((done) => setImmediate(done));
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
const codebaseVectorFor = (entryId) => {
  const codebaseJson = require('../../../../packages/inference/assets/phrase-codebase.json');
  const vectorsAsset = require('../../../../packages/inference/assets/phrase-codebase.vectors.json');
  let offset = 0;
  for (const entry of codebaseJson.entries) {
    if (entry.id === entryId) return Float32Array.from(vectorsAsset.vectors[offset]);
    offset += 1 + entry.aliases.length;
  }
  throw new Error(`no codebase entry ${entryId}`);
};
const QA_MANIFEST = JSON.stringify({
  schema: 'ak.candidate-manifest/1',
  label: 'NON_PRODUCTION_QA_DEBUG_SIGNED',
  qaLifecycleTelemetry: true,
});

beforeEach(async () => {
  mockCodebaseFault.armed = false;
  await getStoreState().connectBiometrics(null);
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
  getStoreState().setEmbedder(null);
  getStoreState().setSafetyReader(null);
  getStoreState().boot();
  await settle();
  expect(getStoreState().status).toBe('ready');
  expect(getStoreState().loadDemoAthlete()).toBe('loaded');
  expect(activeDataMutationLeaseCount()).toBe(0);
});

describe('Stream 2 PR 3 — mobile safety reader + shared scheduler + useStore wiring', () => {
  test('reportSubjective escalates subtle neurological symptoms missed by MiniLM & keywords to dizzy halt', async () => {
    // Low-magnitude non-matching vector -> semantic triage rejects
    getStoreState().setEmbedder({ embed: async () => new Float32Array(384) });
    getStoreState().setSafetyReader({
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
      getStoreState().createTrainingProgram({
        horizon: { kind: 'weeks', blockCount: 1 },
        schemaType: 'LINEAR',
        dayIndices: [1, 3, 5],
      }),
    ).toBe(true);
    const nextPlanned = getStoreState().blockSessions.find((s) => !s.completed);
    expect(nextPlanned).toBeDefined();
    getStoreState().startSession(false, nextPlanned.plannedSessionId);
    expect(getStoreState().session).not.toBeNull();
    expect(getStoreState().runner?.phase).toBe('working');

    const before = rows(A, 'SELECT * FROM subjective_report').length;
    const saved = await getStoreState().reportSubjective('vision went dim for a second after standing', 8);
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
    expect(getStoreState().lastTriage?.kind).toBe('matched');
    expect(getStoreState().lastTriage?.directive?.halt).toBe(true);
    expect(getStoreState().runner?.phase).toBe('halted');
    expect(getStoreState().runner?.haltReason).toBe('safety');
  });

  test.each([
    ['with readiness inputs', true],
    ['without readiness inputs', false],
  ])('a reader halt settling after midnight %s governs the new day and stops the open session', async (_case, hasInputs) => {
    expect(getStoreState().createTrainingProgram({
      horizon: { kind: 'weeks', blockCount: 1 },
      schemaType: 'LINEAR',
      dayIndices: [1, 3, 5],
    })).toBe(true);
    const nextPlanned = getStoreState().blockSessions.find((s) => !s.completed);
    getStoreState().startSession(false, nextPlanned.plannedSessionId);
    const sessionId = getStoreState().session.sessionId;
    expect(getStoreState().runner.phase).toBe('working');

    const initialDay = getStoreState().today;
    const beforeMidnight = new Date(`${initialDay}T23:59:59`);
    const afterMidnight = new Date(beforeMidnight.getTime() + 1000);
    const commitDay = [afterMidnight.getFullYear(), afterMidnight.getMonth() + 1, afterMidnight.getDate()]
      .map((part) => String(part).padStart(2, '0')).join('-');
    if (hasInputs) {
      mockDrivers.get(A).raw.prepare('INSERT INTO sleep_daily (date, in_bed_min, asleep_min) VALUES (?, ?, ?)')
        .run(commitDay, 480, 420);
    }
    const pendingReader = deferred();
    const classify = jest.fn(() => pendingReader.promise);
    getStoreState().setSafetyReader({ modelId: 'm10-r15-reader-seed3', policyId: 'r15/denial-floor', classify });

    jest.useFakeTimers({ now: beforeMidnight });
    try {
      const raw = 'vision went dim for a second after standing';
      const pendingReport = getStoreState().reportSubjective(raw, 8);
      expect(classify).toHaveBeenCalledWith(raw);
      jest.setSystemTime(afterMidnight);
      pendingReader.resolve({ cautionLogit: 5.4, active: true, standaloneRouteId: 'dizzy', actionableRouteId: 'dizzy' });
      expect(await pendingReport).toBe(true);

      expect(rows(A, 'SELECT date, matched_entry_id, halt FROM subjective_report')).toEqual([
        { date: commitDay, matched_entry_id: 'dizzy', halt: 1 },
      ]);
      expect(getStoreState().today).toBe(commitDay);
      if (hasInputs) {
        expect(getStoreState().vector?.date).toBe(commitDay);
        expect(getStoreState().prescription?.forDate).toBe(commitDay);
      } else {
        expect(getStoreState().vector).toBeNull();
        expect(getStoreState().prescription).toBeNull();
        expect(mockDrivers.get(A).raw.prepare('SELECT date FROM state_vector WHERE date = ?').get(commitDay))
          .toBeUndefined();
      }
      expect(getStoreState().lastTriage?.directive?.halt).toBe(true);
      expect(getStoreState().session?.sessionId).toBe(sessionId);
      expect(getStoreState().runner).toMatchObject({ phase: 'halted', haltReason: 'safety' });
      expect(rows(A, 'SELECT session_id, phase FROM session_runner_checkpoint')).toEqual([
        { session_id: sessionId, phase: 'halted' },
      ]);
      // Re-read persisted reports without relying on the immediately published UI state.
      useStore.setState({ lastTriage: null });
      getStoreState().computePrescription([]);
      expect(getStoreState().lastTriage).toMatchObject({ kind: 'matched', directive: { halt: true } });
    } finally {
      jest.useRealTimers();
    }
  });

  test('a committed halt is visible when training support refuses prescription generation', async () => {
    const state = getStoreState();
    const requireTrainingSupport = jest.fn(() => false);
    useStore.setState({ requireTrainingSupport });
    try {
      expect(await getStoreState().reportSubjective('feeling dizzy', 8)).toBe(true);
      expect(rows(A, 'SELECT matched_entry_id, halt FROM subjective_report')).toEqual([
        { matched_entry_id: 'red-flag-systemic', halt: 1 },
      ]);
      expect(requireTrainingSupport).toHaveBeenCalledWith('daily-prescription', undefined, `session-date:${state.today}`);
      expect(getStoreState().prescription).toBe(state.prescription);
      expect(getStoreState().lastTriage).toMatchObject({ kind: 'matched', directive: { halt: true } });
    } finally {
      useStore.setState({ requireTrainingSupport: state.requireTrainingSupport });
    }
  });

  test('switchProfile refuses a closed database through store error state', () => {
    closeStoreDatabaseForRestore();
    expect(() => getStoreState().switchProfile(1)).not.toThrow();
    expect(getStoreState().error).toBe('Athlete data is temporarily locked for backup or restore.');
  });

  test('reportSubjective suppresses harmless denial misfires from MiniLM without modifying prescription', async () => {
    // Force MiniLM to return exact canonical vector for pain-mild
    const vectorsAsset = require('../../../../packages/inference/assets/phrase-codebase.vectors.json');
    const painMildVec = Float32Array.from(vectorsAsset.vectors[0]);
    getStoreState().setEmbedder({ embed: async () => painMildVec });
    getStoreState().setSafetyReader({
      modelId: 'm10-r15-reader-seed3',
      policyId: 'r15/denial-floor',
      classify: async () => ({
        cautionLogit: 0.9,
        active: true,
        standaloneRouteId: 'pain-mild',
        actionableRouteId: 'pain-mild',
      }),
    });

    const baselinePrescription = getStoreState().prescription?.vector;
    const before = rows(A, 'SELECT * FROM subjective_report').length;
    const saved = await getStoreState().reportSubjective('no pain today', 2);
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
    expect(getStoreState().lastTriage).toEqual({ kind: 'rejected' });
    expect(getStoreState().prescription?.vector).toEqual(baselinePrescription);
  });

  test('reportSubjective preserves positive-strong acknowledgment when reader sees no caution, and degrades fail-safe when reader throws', async () => {
    const vectorsAsset = require('../../../../packages/inference/assets/phrase-codebase.vectors.json');
    const positiveVec = codebaseVectorFor('positive-strong');
    getStoreState().setEmbedder({ embed: async () => positiveVec });
    getStoreState().setSafetyReader({
      modelId: 'm10-r15-reader-seed3',
      policyId: 'r15/denial-floor',
      classify: async () => ({
        cautionLogit: -5.1,
        active: false,
        standaloneRouteId: null,
        actionableRouteId: null,
      }),
    });

    const okPos = await getStoreState().reportSubjective('feeling strong and fresh today, weights are moving fast', 1);
    expect(okPos).toBe(true);
    expect(getStoreState().lastTriage?.kind).toBe('positive');
    expect(getStoreState().lastTriage?.entryId).toBe('positive-strong');

    // Now simulate safetyReader throwing -> must degrade cleanly to shipped pain-mild match
    const painMildVec = Float32Array.from(vectorsAsset.vectors[0]);
    getStoreState().setEmbedder({ embed: async () => painMildVec });
    getStoreState().setSafetyReader({
      modelId: 'm10-r15-reader-seed3',
      policyId: 'r15/denial-floor',
      classify: async () => {
        throw new Error('simulated native reader failure');
      },
    });
    const okFallback = await getStoreState().reportSubjective('knee is a little tender today', 6);
    expect(okFallback).toBe(true);
    expect(getStoreState().lastTriage?.kind).toBe('matched');
    expect(getStoreState().error).toBeNull();
  });

  test('async athlete-ownership lease stays held while safetyReader.classify is pending', async () => {
    const holdReader = deferred();
    getStoreState().setEmbedder({ embed: async () => new Float32Array(384) });
    getStoreState().setSafetyReader({
      modelId: 'm10-r15-reader-seed3',
      policyId: 'r15/denial-floor',
      classify: () => holdReader.promise,
    });

    const before = rows(A, 'SELECT * FROM subjective_report').length;
    const pending = getStoreState().reportSubjective('vision went spotty after the set', 9);
    await settle();

    // Embedder already settled, safetyReader is still awaiting -> lease MUST still be held!
    expect(activeDataMutationLeaseCount()).toBe(1);
    getStoreState().switchAthlete('athlete-b');
    expect(getStoreState().activeAthleteId).toBe('default');
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

  test('keyword halt with no embedder never calls safetyReader.classify', async () => {
    const classifySpy = jest.fn(async () => ({
      cautionLogit: -5.1,
      active: false,
      standaloneRouteId: null,
      actionableRouteId: null,
    }));
    getStoreState().setSafetyReader({
      modelId: 'm10-r15-reader-seed3',
      policyId: 'r15/denial-floor',
      classify: classifySpy,
    });

    const before = rows(A, 'SELECT * FROM subjective_report').length;
    const saved = await getStoreState().reportSubjective('feeling dizzy and faint', 7);
    expect(saved).toBe(true);
    expect(classifySpy).not.toHaveBeenCalled();
    expect(rows(A, 'SELECT matched_entry_id, halt FROM subjective_report').slice(before)).toEqual([
      { matched_entry_id: 'red-flag-systemic', halt: 1 },
    ]);
    expect(getStoreState().lastTriage?.directive?.halt).toBe(true);
    expect(activeDataMutationLeaseCount()).toBe(0);
  });

  test('semantic halt never calls safetyReader.classify', async () => {
    const dizzyVec = codebaseVectorFor('dizzy');
    getStoreState().setEmbedder({ embed: async () => dizzyVec });
    const classifySpy = jest.fn(async () => ({
      cautionLogit: -5.1,
      active: false,
      standaloneRouteId: null,
      actionableRouteId: null,
    }));
    getStoreState().setSafetyReader({
      modelId: 'm10-r15-reader-seed3',
      policyId: 'r15/denial-floor',
      classify: classifySpy,
    });

    const before = rows(A, 'SELECT * FROM subjective_report').length;
    const saved = await getStoreState().reportSubjective('vision went dim for a second after standing', 7);
    expect(saved).toBe(true);
    expect(classifySpy).not.toHaveBeenCalled();
    expect(rows(A, 'SELECT matched_entry_id, halt FROM subjective_report').slice(before)).toEqual([
      { matched_entry_id: 'dizzy', halt: 1 },
    ]);
    expect(activeDataMutationLeaseCount()).toBe(0);
  });

  test('a never-resolving safetyReader.classify cannot delay a keyword halt or hold the lease', async () => {
    const never = new Promise(() => {});
    const classifySpy = jest.fn(() => never);
    getStoreState().setSafetyReader({
      modelId: 'm10-r15-reader-seed3',
      policyId: 'r15/denial-floor',
      classify: classifySpy,
    });

    const before = rows(A, 'SELECT * FROM subjective_report').length;
    const pending = getStoreState().reportSubjective('feeling dizzy and faint', 7);
    const outcome = await Promise.race([
      pending.then((saved) => ({ saved })),
      new Promise((done) => setTimeout(() => done({ saved: 'still pending' }), 1000)),
    ]);
    expect(outcome).toEqual({ saved: true });
    expect(classifySpy).not.toHaveBeenCalled();
    expect(activeDataMutationLeaseCount()).toBe(0);
    expect(rows(A, 'SELECT matched_entry_id, halt FROM subjective_report').slice(before)).toEqual([
      { matched_entry_id: 'red-flag-systemic', halt: 1 },
    ]);
  });

  test('codebase read failure with no embedder degrades to the keyword baseline without losing the report or the lease', async () => {
    const classifySpy = jest.fn(async () => ({
      cautionLogit: 6.1,
      active: true,
      standaloneRouteId: 'dizzy',
      actionableRouteId: 'dizzy',
    }));
    getStoreState().setSafetyReader({
      modelId: 'm10-r15-reader-seed3',
      policyId: 'r15/denial-floor',
      classify: classifySpy,
    });

    const before = rows(A, 'SELECT * FROM subjective_report').length;
    mockCodebaseFault.armed = true;
    let saved;
    let thrown = null;
    try {
      saved = await getStoreState().reportSubjective('knee is a little tender today', 4);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeNull();
    expect(saved).toBe(true);
    // The armed fault was consumed by the codebase read, not left pending.
    expect(mockCodebaseFault.armed).toBe(false);
    // Baseline is resolveReport(raw, null): no keyword, no semantic -> logged, unmatched.
    expect(
      rows(A, 'SELECT raw_text, matched_entry_id, halt FROM subjective_report').slice(before),
    ).toEqual([{ raw_text: 'knee is a little tender today', matched_entry_id: null, halt: 0 }]);
    expect(activeDataMutationLeaseCount()).toBe(0);
    expect(getStoreState().triaging).toBe(false);
  });

  test('safetyReader.classify throwing with no embedder degrades to the keyword baseline', async () => {
    const classify = jest.fn(async () => {
      throw new Error('simulated native reader failure');
    });
    getStoreState().setSafetyReader({
      modelId: 'm10-r15-reader-seed3',
      policyId: 'r15/denial-floor',
      classify,
    });

    const before = rows(A, 'SELECT * FROM subjective_report').length;
    const saved = await getStoreState().reportSubjective('knee is a little tender today', 4);
    expect(classify).toHaveBeenCalledTimes(1);
    expect(saved).toBe(true);
    expect(
      rows(A, 'SELECT raw_text, matched_entry_id, halt FROM subjective_report').slice(before),
    ).toEqual([{ raw_text: 'knee is a little tender today', matched_entry_id: null, halt: 0 }]);
    expect(activeDataMutationLeaseCount()).toBe(0);
    expect(getStoreState().error).toBeNull();
  });

  test('deviceEmbedder and deviceSafetyReader share one SerializedOrtScheduler, isolate Android working copies, and avoid QA manifest race', async () => {
    const origOS = Platform.OS;
    const origDev = global.__DEV__;
    const logs = [];
    const spyLog = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    resetOrtHarness([
      ['asset:minilm.onnx', 'minilm-bytes'],
      ['asset:safety_reader.onnx', 'reader-bytes'],
      ['asset:candidate_manifest.json', QA_MANIFEST],
      ['/docs/minilm-0000000000000000.onnx', 'stale-minilm'],
      ['/docs/safety-reader-1111111111111111.onnx', 'stale-reader'],
    ]);

    Platform.OS = 'android';
    global.__DEV__ = false;
    try {
      resetQaTelemetryCacheForTests();
      createFreshDeviceOrtSchedulerForTests();

      // Concurrent startup creation (mirrors App.tsx) -> must NOT race on .qa_manifest scratch file
      const [emb, rdr] = await Promise.all([tryCreateDeviceEmbedder(), tryCreateDeviceSafetyReader()]);
      expect(emb).not.toBeNull();
      expect(rdr).not.toBeNull();

      // Interleave embedder + safetyReader calls concurrently -> shared scheduler enforces maxConcurrent === 1
      const [vec, pred] = await Promise.all([
        emb.embed('what is a deload week'),
        rdr.classify('vision went spotty'),
      ]);
      expect(vec.length).toBe(384);
      expect(pred.actionableRouteId).toBe('dizzy');
      expect(mockOrtHarness.maxConcurrentSessions).toBe(1);
      expect(mockOrtHarness.activeNativeSessions).toBe(0);

      // Android sessions open the DocumentDir working copies, never the bundle.
      expect([...mockOrtHarness.createdModelPaths].sort()).toEqual([
        '/docs/minilm-afdb6f1a0e45b715.onnx',
        '/docs/safety-reader-a0fa76e40e10246a.onnx',
      ]);

      // Verify stale working copies were cleaned up WITHOUT deleting the other model's active copy
      expect(mockOrtHarness.files.has('/docs/minilm-afdb6f1a0e45b715.onnx')).toBe(true);
      expect(mockOrtHarness.files.has('/docs/safety-reader-a0fa76e40e10246a.onnx')).toBe(true);
      expect(mockOrtHarness.files.has('/docs/minilm-0000000000000000.onnx')).toBe(false);
      expect(mockOrtHarness.files.has('/docs/safety-reader-1111111111111111.onnx')).toBe(false);

      // Verify BOTH lifecycle tags emitted without scratch-file race loss
      expect(logs.some((l) => l.includes('[embedder-lifecycle] request=1 ok=1'))).toBe(true);
      expect(logs.some((l) => l.includes('[safety-reader-lifecycle] request=1 ok=1'))).toBe(true);

      // Verify cross-wrapper fail-closed disposal latch: if safetyReader release() throws, embedder is ALSO blocked!
      mockOrtHarness.failNextDispose = true;
      await expect(rdr.classify('trigger release failure')).rejects.toThrow(/simulated native release failure/);
      await expect(emb.embed('must be blocked by shared latch')).rejects.toThrow(/latched fail-closed/);
    } finally {
      Platform.OS = origOS;
      global.__DEV__ = origDev;
      spyLog.mockRestore();
    }
  });

  test('iOS loads both bundled models in place without writing working copies to DocumentDir', async () => {
    const origOS = Platform.OS;
    const origDev = global.__DEV__;
    const spyLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    resetOrtHarness([
      ['/bundle/minilm.onnx', 'minilm-bytes'],
      ['/bundle/safety_reader.onnx', 'reader-bytes'],
      ['asset:candidate_manifest.json', QA_MANIFEST],
    ]);

    Platform.OS = 'ios';
    global.__DEV__ = false;
    try {
      resetQaTelemetryCacheForTests();
      createFreshDeviceOrtSchedulerForTests();

      const [emb, rdr] = await Promise.all([tryCreateDeviceEmbedder(), tryCreateDeviceSafetyReader()]);
      expect(emb).not.toBeNull();
      expect(rdr).not.toBeNull();

      const [vec, pred] = await Promise.all([
        emb.embed('what is a deload week'),
        rdr.classify('vision went spotty'),
      ]);
      expect(vec.length).toBe(384);
      expect(pred.actionableRouteId).toBe('dizzy');
      expect(mockOrtHarness.maxConcurrentSessions).toBe(1);

      expect([...mockOrtHarness.createdModelPaths].sort()).toEqual([
        '/bundle/minilm.onnx',
        '/bundle/safety_reader.onnx',
      ]);
      const docsModelCopies = [...mockOrtHarness.files.keys()].filter(
        (k) => k.startsWith('/docs/') && k.endsWith('.onnx'),
      );
      expect(docsModelCopies).toEqual([]);
      expect(mockOrtHarness.files.get('/bundle/minilm.onnx')).toBe('minilm-bytes');
      expect(mockOrtHarness.files.get('/bundle/safety_reader.onnx')).toBe('reader-bytes');
    } finally {
      Platform.OS = origOS;
      global.__DEV__ = origDev;
      spyLog.mockRestore();
    }
  });

  test('WO02-SOL-02: a hung non-halting report and hung embedder cannot block or overwrite a subsequent keyword safety halt', async () => {
    const holdReader = deferred();
    const neverEmbed = jest.fn(() => new Promise(() => {}));
    let firstCall = true;
    getStoreState().setEmbedder({
      embed: (...args) => {
        if (firstCall) {
          firstCall = false;
          return Promise.resolve(new Float32Array(384));
        }
        return neverEmbed(...args);
      },
    });
    const classifySpy = jest.fn(() => holdReader.promise);
    getStoreState().setSafetyReader({
      modelId: 'm10-r15-reader-seed3',
      policyId: 'r15/denial-floor',
      classify: classifySpy,
    });

    const before = rows(A, 'SELECT * FROM subjective_report').length;
    const pendingFirst = getStoreState().reportSubjective('knee is a little tender today', 4);
    await settle();

    // First report is hung inside safetyReader.classify; triaging is true and lease count is 1.
    expect(getStoreState().triaging).toBe(true);
    expect(activeDataMutationLeaseCount()).toBe(1);
    expect(classifySpy).toHaveBeenCalledTimes(1);

    // Athlete now reports a deterministic red-flag halt while first report + ORT queue are hung.
    const haltOutcome = await Promise.race([
      getStoreState().reportSubjective('feeling dizzy and faint', 7).then((saved) => ({ saved })),
      new Promise((done) => setTimeout(() => done({ saved: 'timed-out' }), 300)),
    ]);
    expect(haltOutcome).toEqual({ saved: true });
    expect(neverEmbed).not.toHaveBeenCalled();
    expect(classifySpy).toHaveBeenCalledTimes(1);
    expect(getStoreState().lastTriage?.directive?.halt).toBe(true);
    expect(rows(A, 'SELECT matched_entry_id, halt FROM subjective_report').slice(before)).toEqual([
      { matched_entry_id: 'red-flag-systemic', halt: 1 },
    ]);

    // Now let the earlier non-halting report finish: it must NOT clobber the halt directive!
    holdReader.resolve({
      cautionLogit: -5.0,
      active: false,
      standaloneRouteId: null,
      actionableRouteId: null,
    });
    expect(await pendingFirst).toBe(true);
    expect(getStoreState().lastTriage?.directive?.halt).toBe(true);
    expect(getStoreState().triaging).toBe(false);
    expect(activeDataMutationLeaseCount()).toBe(0);
  });

  test('WO02-SOL-06: switchProfile is refused while safetyReader.classify holds a mutation lease', async () => {
    const rawDb = mockDrivers.get(A).raw;
    const existingSlots = rawDb.prepare('SELECT slot_id, is_active, profile_json FROM profile_slot ORDER BY slot_id').all();
    expect(existingSlots.length).toBeGreaterThanOrEqual(1);
    const activeSlot = existingSlots.find((s) => s.is_active === 1) ?? existingSlots[0];
    let secondSlotId = existingSlots.find((s) => s.slot_id !== activeSlot.slot_id)?.slot_id;
    if (secondSlotId === undefined) {
      secondSlotId = activeSlot.slot_id + 1;
      rawDb
        .prepare('INSERT INTO profile_slot (slot_id, name, is_active, profile_json, updated_at_ms) VALUES (?, ?, 0, ?, ?)')
        .run(secondSlotId, 'Secondary Slot', activeSlot.profile_json, Date.now());
      getStoreState().refreshProfileSlots();
    }

    const holdReader = deferred();
    getStoreState().setEmbedder({ embed: async () => new Float32Array(384) });
    getStoreState().setSafetyReader({
      modelId: 'm10-r15-reader-seed3',
      policyId: 'r15/denial-floor',
      classify: () => holdReader.promise,
    });

    const before = rows(A, 'SELECT * FROM subjective_report').length;
    const pending = getStoreState().reportSubjective('vision went spotty after the set', 8);
    await settle();
    expect(activeDataMutationLeaseCount()).toBe(1);

    // Attempt profile-slot switch within the same athlete while classify is awaiting -> MUST refuse!
    getStoreState().switchProfile(secondSlotId);
    expect(getStoreState().error).toMatch(/still being saved/i);
    const activeAfterAttempt = rawDb.prepare('SELECT slot_id FROM profile_slot WHERE is_active = 1').get();
    expect(activeAfterAttempt.slot_id).toBe(activeSlot.slot_id);

    holdReader.resolve({
      cautionLogit: 6.1,
      active: true,
      standaloneRouteId: 'dizzy',
      actionableRouteId: 'dizzy',
    });
    expect(await pending).toBe(true);
    expect(activeDataMutationLeaseCount()).toBe(0);
    expect(rows(A, 'SELECT matched_entry_id, halt FROM subjective_report').slice(before)).toEqual([
      { matched_entry_id: 'dizzy', halt: 1 },
    ]);
  });

  test('WO02-SOL-09: Android deviceSafetyReader verifies SHA-256 of pre-existing DocumentDir cache and staged copy before opening ORT', async () => {
    const origOS = Platform.OS;
    const origDev = global.__DEV__;
    const spyLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    Platform.OS = 'android';
    global.__DEV__ = false;
    try {
      // Case A: pre-existing corrupt/zero-byte file at the exact pin-named DocumentDir path is replaced from verified APK asset
      resetOrtHarness([
        ['asset:safety_reader.onnx', 'reader-bytes'],
        ['asset:candidate_manifest.json', QA_MANIFEST],
        ['/docs/safety-reader-a0fa76e40e10246a.onnx', ''],
      ]);
      resetQaTelemetryCacheForTests();
      createFreshDeviceOrtSchedulerForTests();

      const rdrRecovered = await tryCreateDeviceSafetyReader();
      expect(rdrRecovered).not.toBeNull();
      const pred = await rdrRecovered.classify('vision went spotty');
      expect(pred.actionableRouteId).toBe('dizzy');
      expect(mockOrtHarness.files.get('/docs/safety-reader-a0fa76e40e10246a.onnx')).toBe('reader-bytes');
      expect(mockOrtHarness.createdModelPaths).toEqual(['/docs/safety-reader-a0fa76e40e10246a.onnx']);

      // Case B: tampered asset whose SHA-256 does not match ratified pin is NEVER handed to InferenceSession.create
      resetOrtHarness([
        ['asset:safety_reader.onnx', 'tampered-wrong-model-bytes'],
        ['asset:candidate_manifest.json', QA_MANIFEST],
      ]);
      resetQaTelemetryCacheForTests();
      createFreshDeviceOrtSchedulerForTests();

      const rdrTampered = await tryCreateDeviceSafetyReader();
      expect(rdrTampered).not.toBeNull();
      await expect(rdrTampered.classify('vision went spotty')).rejects.toThrow(/integrity|sha-?256|mismatch/i);
      expect(mockOrtHarness.createdModelPaths).toEqual([]);
      expect(mockOrtHarness.files.has('/docs/safety-reader-a0fa76e40e10246a.onnx')).toBe(false);
    } finally {
      Platform.OS = origOS;
      global.__DEV__ = origDev;
      spyLog.mockRestore();
    }
  });

  test('WO02-SOL-02 Round-2 UI forms: SubjectiveReportPanel and BlockScreen allow submitting a keyword safety halt while an earlier non-halting report is still pending', async () => {
    // Part A: SubjectiveReportPanel wired to live useStore
    const holdReaderA = deferred();
    getStoreState().setEmbedder({ embed: async () => new Float32Array(384) });
    getStoreState().setSafetyReader({
      modelId: 'm10-r15-reader-seed3',
      policyId: 'r15/denial-floor',
      classify: () => holdReaderA.promise,
    });

    function LivePanelHarness() {
      const triaging = useStore((s) => s.triaging);
      const lastTriage = useStore((s) => s.lastTriage);
      const triageReady = useStore((s) => s.triageReady);
      const reportSubjective = useStore((s) => s.reportSubjective);
      return React.createElement(SubjectiveReportPanel, {
        hasVector: true,
        lastTriage,
        triaging,
        triageReady,
        onApply: reportSubjective,
        onClose: () => {},
      });
    }

    const beforeA = rows(A, 'SELECT * FROM subjective_report').length;
    const panelView = render(React.createElement(LivePanelHarness));

    // Submit non-halting report #1 -> hangs inside safetyReader.classify
    fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), 'knee is a little tender today');
    fireEvent.press(screen.getByLabelText('Severity 4 of 10'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('completion-report-apply'));
    });
    await settle();
    expect(getStoreState().triaging).toBe(true);

    // Type keyword-halt report #2 while #1 is still pending -> Apply button MUST enable and persist halt=1!
    fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), 'feeling dizzy and faint');
    fireEvent.press(screen.getByLabelText('Severity 7 of 10'));
    const applyBtn = screen.getByTestId('completion-report-apply');
    expect(applyBtn.props.accessibilityState?.disabled).not.toBe(true);
    await act(async () => {
      fireEvent.press(applyBtn);
    });
    await settle();

    expect(rows(A, 'SELECT matched_entry_id, halt FROM subjective_report').slice(beforeA)).toEqual([
      { matched_entry_id: 'red-flag-systemic', halt: 1 },
    ]);
    expect(getStoreState().lastTriage?.directive?.halt).toBe(true);

    await act(async () => {
      holdReaderA.resolve({ cautionLogit: -5.0, active: false, standaloneRouteId: null, actionableRouteId: null });
      await settle();
    });
    panelView.unmount();

    // Part B: BlockScreen "Something feels off" form wired to live useStore
    // Reset today's halt so BlockScreen opens the normal form for a fresh sequence
    mockDrivers.get(A).raw.prepare('DELETE FROM subjective_report').run();
    getStoreState().computePrescription([]);
    expect(getStoreState().lastTriage).toBeNull();

    const holdReaderB = deferred();
    getStoreState().setSafetyReader({
      modelId: 'm10-r15-reader-seed3',
      policyId: 'r15/denial-floor',
      classify: () => holdReaderB.promise,
    });

    const blockView = render(React.createElement(BlockScreen));
    fireEvent.press(screen.getByText('Something feels off'));
    fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), 'knee is a little tender today');
    fireEvent.press(screen.getByLabelText('Severity 4 of 10'));
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Apply report'));
    });
    await settle();
    expect(getStoreState().triaging).toBe(true);

    // Now type keyword halt while triaging === true -> button flips back to 'Apply report' and saves halt=1!
    fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), 'feeling dizzy and faint');
    fireEvent.press(screen.getByLabelText('Severity 8 of 10'));
    const planApplyBtn = screen.getByLabelText('Apply report');
    expect(planApplyBtn.props.accessibilityState?.disabled).not.toBe(true);
    await act(async () => {
      fireEvent.press(planApplyBtn);
    });
    await settle();

    expect(rows(A, 'SELECT matched_entry_id, halt FROM subjective_report')).toEqual([
      { matched_entry_id: 'red-flag-systemic', halt: 1 },
    ]);
    await act(async () => {
      holdReaderB.resolve({ cautionLogit: -5.0, active: false, standaloneRouteId: null, actionableRouteId: null });
      await settle();
    });
    blockView.unmount();
  });

  test('WO02-SOL-02 Round-4: retrying a keyword safety halt after a transient store failure succeeds on both SubjectiveReportPanel and BlockScreen while an earlier ordinary report remains pending', async () => {
    // 1. Direct double-tap vs post-failure retry check on SubjectiveReportPanel while triaging=true
    const deferredApply = deferred();
    const onApplySpy = jest.fn(() => deferredApply.promise);
    const isolatedPanel = render(
      React.createElement(SubjectiveReportPanel, {
        hasVector: true,
        lastTriage: null,
        triaging: true,
        triageReady: true,
        onApply: onApplySpy,
        onClose: () => {},
      }),
    );
    fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), 'feeling dizzy and faint');
    fireEvent.press(screen.getByLabelText('Severity 7 of 10'));
    await act(async () => {
      const btn = screen.getByTestId('completion-report-apply');
      // Synchronous double-tap while in-flight must only invoke onApply once
      fireEvent.press(btn);
      fireEvent.press(btn);
    });
    expect(onApplySpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('completion-report-apply').props.accessibilityState?.disabled).toBe(true);

    // Settle the attempt as not stored (false) while triaging remains true -> retry MUST immediately re-enable!
    await act(async () => {
      deferredApply.resolve(false);
      await settle();
    });
    expect(screen.getByTestId('completion-report-not-sent')).toBeTruthy();
    expect(screen.getByTestId('completion-report-apply').props.accessibilityState?.disabled).not.toBe(true);
    isolatedPanel.unmount();

    // 2. Full store-backed replay on SubjectiveReportPanel: hung ordinary report + SQLite write failure + UI retry
    const holdReaderA = deferred();
    getStoreState().setEmbedder({ embed: async () => new Float32Array(384) });
    getStoreState().setSafetyReader({
      modelId: 'm10-r15-reader-seed3',
      policyId: 'r15/denial-floor',
      classify: () => holdReaderA.promise,
    });

    function LivePanelHarness() {
      const triaging = useStore((s) => s.triaging);
      const lastTriage = useStore((s) => s.lastTriage);
      const triageReady = useStore((s) => s.triageReady);
      const reportSubjective = useStore((s) => s.reportSubjective);
      return React.createElement(SubjectiveReportPanel, {
        hasVector: true,
        lastTriage,
        triaging,
        triageReady,
        onApply: reportSubjective,
        onClose: () => {},
      });
    }

    const beforeA = rows(A, 'SELECT * FROM subjective_report').length;
    const panelView = render(React.createElement(LivePanelHarness));

    fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), 'knee sore');
    fireEvent.press(screen.getByLabelText('Severity 4 of 10'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('completion-report-apply'));
    });
    await settle();
    expect(getStoreState().triaging).toBe(true);

    // Arm a 1-shot SQLite write failure on INSERT INTO subjective_report
    const driverA = mockDrivers.get(A);
    const origExecA = driverA.executeSync.bind(driverA);
    let failInsertOnceA = true;
    const execSpyA = jest.spyOn(driverA, 'executeSync').mockImplementation((sql, params) => {
      if (failInsertOnceA && String(sql).includes('INSERT INTO subjective_report')) {
        failInsertOnceA = false;
        throw new Error('simulated transient SQLite write error');
      }
      return origExecA(sql, params);
    });

    try {
      fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), 'feeling dizzy and faint');
      fireEvent.press(screen.getByLabelText('Severity 7 of 10'));
      await act(async () => {
        fireEvent.press(screen.getByTestId('completion-report-apply'));
      });
      await settle();

      expect(screen.getByTestId('completion-report-not-sent')).toBeTruthy();
      expect(rows(A, 'SELECT * FROM subjective_report').slice(beforeA)).toEqual([]);
      expect(getStoreState().triaging).toBe(true);

      // Identical retry MUST be enabled immediately while 'knee sore' is still pending!
      const retryPanelBtn = screen.getByTestId('completion-report-apply');
      expect(retryPanelBtn.props.accessibilityState?.disabled).not.toBe(true);
      expect(retryPanelBtn.props.accessibilityLabel).toBe('Apply report');

      await act(async () => {
        fireEvent.press(retryPanelBtn);
      });
      await settle();

      expect(rows(A, 'SELECT matched_entry_id, halt FROM subjective_report').slice(beforeA)).toEqual([
        { matched_entry_id: 'red-flag-systemic', halt: 1 },
      ]);
      expect(getStoreState().lastTriage?.directive?.halt).toBe(true);
    } finally {
      execSpyA.mockRestore();
      await act(async () => {
        holdReaderA.resolve({ cautionLogit: -5.0, active: false, standaloneRouteId: null, actionableRouteId: null });
        await settle();
      });
      panelView.unmount();
    }

    // 3. Full store-backed replay on BlockScreen: hung ordinary report + SQLite write failure + UI retry
    mockDrivers.get(A).raw.prepare('DELETE FROM subjective_report').run();
    getStoreState().computePrescription([]);
    expect(getStoreState().lastTriage).toBeNull();

    const holdReaderB = deferred();
    getStoreState().setSafetyReader({
      modelId: 'm10-r15-reader-seed3',
      policyId: 'r15/denial-floor',
      classify: () => holdReaderB.promise,
    });

    const blockView = render(React.createElement(BlockScreen));
    fireEvent.press(screen.getByText('Something feels off'));
    fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), 'knee sore');
    fireEvent.press(screen.getByLabelText('Severity 4 of 10'));
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Apply report'));
    });
    await settle();
    expect(getStoreState().triaging).toBe(true);

    let failInsertOnceB = true;
    const execSpyB = jest.spyOn(driverA, 'executeSync').mockImplementation((sql, params) => {
      if (failInsertOnceB && String(sql).includes('INSERT INTO subjective_report')) {
        failInsertOnceB = false;
        throw new Error('simulated transient SQLite write error');
      }
      return origExecA(sql, params);
    });

    try {
      fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), 'feeling dizzy and faint');
      fireEvent.press(screen.getByLabelText('Severity 8 of 10'));
      await act(async () => {
        fireEvent.press(screen.getByLabelText('Apply report'));
      });
      await settle();

      expect(screen.getByTestId('plan-report-not-sent')).toBeTruthy();
      expect(rows(A, 'SELECT * FROM subjective_report')).toEqual([]);
      expect(getStoreState().triaging).toBe(true);

      // Identical retry on BlockScreen MUST be enabled as 'Apply report', never stuck as 'Checking report'!
      const retryBlockBtn = screen.getByLabelText('Apply report');
      expect(retryBlockBtn.props.accessibilityState?.disabled).not.toBe(true);

      await act(async () => {
        fireEvent.press(retryBlockBtn);
      });
      await settle();

      expect(rows(A, 'SELECT matched_entry_id, halt FROM subjective_report')).toEqual([
        { matched_entry_id: 'red-flag-systemic', halt: 1 },
      ]);
      expect(getStoreState().lastTriage?.directive?.halt).toBe(true);
    } finally {
      execSpyB.mockRestore();
      await act(async () => {
        holdReaderB.resolve({ cautionLogit: -5.0, active: false, standaloneRouteId: null, actionableRouteId: null });
        await settle();
      });
      blockView.unmount();
    }
  });
});
