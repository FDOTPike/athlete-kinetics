/**
 * BackupMutationLease.test.js — normal athlete-data mutations hold a lease
 * across every await, and backup/restore maintenance cannot start while one is
 * held (PR #18 review, P1).
 *
 * The maintenance lock alone was a momentary check: a registry action or boot
 * could pass it, pause at `await loadRegistry()`, and then write the registry
 * or reopen a database after a backup snapshot had begun. Each case holds that
 * await open and probes whether maintenance can start inside it.
 */
import {
  acquireDataMaintenanceLock,
  authorizeAthleteDataBoot,
  resetDataMaintenanceLockForTests,
  revokeAthleteDataBoot,
} from '../../src/state/dataMaintenanceLock';
import { useStore } from '../../src/state/useStore';

const mockOpen = jest.fn();
const mockSaveRegistry = jest.fn(async () => true);
let mockLoadGate = null;

function mockDeferred() {
  let release;
  const promise = new Promise((resolve) => { release = resolve; });
  return { promise, release };
}

function mockRegistry() {
  return {
    version: 1,
    activeId: 'default',
    advancedToolsUnlocked: false,
    athletes: [
      { id: 'default', name: 'Athlete A', dbName: 'athlete_kinetics.db', createdAtMs: 0 },
      { id: 'athlete-b', name: 'Athlete B', dbName: 'ak_athlete_b.db', createdAtMs: 1 },
    ],
  };
}

jest.mock('@op-engineering/op-sqlite', () => ({ open: (...args) => mockOpen(...args) }));
jest.mock('../../src/state/athleteRegistry', () => ({
  loadRegistry: async () => {
    if (mockLoadGate !== null) await mockLoadGate.promise;
    return mockRegistry();
  },
  saveRegistry: (...args) => mockSaveRegistry(...args),
}));

const flush = async () => {
  for (let i = 0; i < 8; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

/** True when backup/restore maintenance cannot start right now. */
const maintenanceRefused = () => {
  try {
    acquireDataMaintenanceLock('lease-probe')();
    return false;
  } catch {
    return true;
  }
};

const releaseLoad = async () => {
  const gate = mockLoadGate;
  mockLoadGate = null;
  gate.release();
  await flush();
};

beforeEach(() => {
  resetDataMaintenanceLockForTests();
  mockOpen.mockReset();
  mockOpen.mockImplementation(() => { throw new Error('database open probe'); });
  mockSaveRegistry.mockClear();
  mockLoadGate = null;
  useStore.setState({ status: 'ready', error: null, session: null, activeAthleteId: 'default' });
});

afterEach(async () => {
  if (mockLoadGate !== null) await releaseLoad();
});

test.each([
  ['switchAthlete', () => useStore.getState().switchAthlete('athlete-b')],
  ['createAthlete', () => useStore.getState().createAthlete('Athlete C')],
  ['renameAthleteEntry', () => useStore.getState().renameAthleteEntry('athlete-b', 'Renamed B')],
  ['deleteAthlete', () => useStore.getState().deleteAthlete('athlete-b')],
  ['setAdvancedToolsUnlocked', () => useStore.getState().setAdvancedToolsUnlocked(true)],
])('%s holds a mutation lease from its registry read through its registry write', async (_name, run) => {
  authorizeAthleteDataBoot();
  mockLoadGate = mockDeferred();
  run();
  await flush();

  // Paused inside the registry read: a backup snapshot must not be able to start.
  expect(maintenanceRefused()).toBe(true);

  await releaseLoad();
  expect(mockSaveRegistry).toHaveBeenCalled();
  // Once the action (and any boot it started) settles, maintenance can start again.
  expect(maintenanceRefused()).toBe(false);
});

test('boot holds a lease across its registry read and rechecks authorization before opening a database', async () => {
  authorizeAthleteDataBoot();
  useStore.setState({ status: 'booting' });
  mockLoadGate = mockDeferred();
  useStore.getState().boot();
  await flush();

  expect(maintenanceRefused()).toBe(true);

  // Authority is withdrawn while the registry read is pending.
  revokeAthleteDataBoot();
  await releaseLoad();
  expect(mockOpen).not.toHaveBeenCalled();
  expect(maintenanceRefused()).toBe(false);

  // The abandoned boot left nothing in flight: a later authorized boot proceeds.
  authorizeAthleteDataBoot();
  useStore.getState().boot();
  await flush();
  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(maintenanceRefused()).toBe(false);
});

test('an active maintenance lock refuses a registry action before it reads or writes', async () => {
  authorizeAthleteDataBoot();
  const release = acquireDataMaintenanceLock('snapshot-in-progress');
  try {
    useStore.getState().renameAthleteEntry('athlete-b', 'Renamed B');
    await flush();
    expect(mockSaveRegistry).not.toHaveBeenCalled();
    expect(useStore.getState().error).toMatch(/backup or restore/i);
  } finally {
    release();
  }
});
