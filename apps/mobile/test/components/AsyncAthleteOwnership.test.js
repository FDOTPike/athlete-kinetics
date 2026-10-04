// Real store and complete migrations, with deferred native IO and per-athlete SQLite.
import { useStore, closeStoreDatabaseForRestore, restartStoreAfterRestore } from '../../src/state/useStore';
import { acquireDataMaintenanceLock, activeDataMutationLeaseCount, authorizeAthleteDataBoot, resetDataMaintenanceLockForTests, revokeAthleteDataBoot } from '../../src/state/dataMaintenanceLock';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

let mockDrivers;
let mockRegistry;
let mockLoadGate;
function mockDriverFor(name) {
  if (!mockDrivers.has(name)) mockDrivers.set(name, { ...makeNodeSqliteDriver(), close: jest.fn() });
  return mockDrivers.get(name);
}
jest.mock('@op-engineering/op-sqlite', () => ({ open: ({ name }) => mockDriverFor(name) }));
jest.mock('../../src/state/athleteRegistry', () => ({
  loadRegistry: async () => { if (mockLoadGate) await mockLoadGate.promise; return mockRegistry; },
  saveRegistry: async next => { mockRegistry = next; return true; },
}));
const state = () => useStore.getState();
const A = 'athlete_kinetics.db';
const B = 'athlete_b.db';
const rows = (file, sql, ...params) => mockDrivers.get(file).raw.prepare(sql).all(...params);
const settle = async () => { for (let n = 0; n < 8; n++) await new Promise(resolve => setImmediate(resolve)); };
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
// A date inside the trailing week syncBiometrics writes (older days are the
// read window's edge and are deliberately not written).
const recentDate = (() => { const d = new Date(Date.now() - 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
const day = { date: recentDate, rmssdMs: 73.125, restingHrBpm: 57, inBedMin: null, asleepMin: null, deepMin: null, remMin: null, lightMin: null };
const configureHealth = async readDaily => {
  await state().connectBiometrics({ hasGrantedPermissions: async () => false, requestPermissions: async () => true, readDaily });
  useStore.setState({ biometricsStatus: 'ready' });
};
const prepareColdBoot = (authorized = true) => {
  closeStoreDatabaseForRestore();
  mockDrivers = new Map();
  useStore.setState({ status: 'booting', biometricsStatus: 'off' });
  if (!authorized) revokeAthleteDataBoot();
};
beforeEach(async () => {
  await state().connectBiometrics(null);
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  mockDrivers = new Map();
  mockLoadGate = null;
  mockRegistry = { version: 1, activeId: 'default', advancedToolsUnlocked: true, athletes: [
    { id: 'default', name: 'Synthetic A', dbName: A, createdAtMs: 0 },
    { id: 'athlete-b', name: 'Synthetic B', dbName: B, createdAtMs: 1 },
  ] };
  useStore.setState({ status: 'booting', error: null, activeAthleteId: 'default', session: null, runner: null, triaging: false, biometricsStatus: 'off' });
  state().setEmbedder(null);
  state().boot();
  await settle();
  expect(state().status).toBe('ready');
  expect(state().loadDemoAthlete()).toBe('loaded');
  expect(activeDataMutationLeaseCount()).toBe(0);
});

test.each(['report', 'sync'])('%s end-to-end ownership when switching during native IO', async operation => {
  const hold = deferred();
  const before = rows(A, 'SELECT * FROM subjective_report').length;
  let pending;
  if (operation === 'report') {
    state().setEmbedder({ embed: () => hold.promise });
    pending = state().reportSubjective('chest pain', 10);
  } else {
    await configureHealth(() => hold.promise);
    pending = state().syncBiometrics();
  }
  state().switchAthlete('athlete-b');
  await settle();
  if (operation === 'report') hold.reject(new Error('synthetic inference unavailable'));
  else hold.resolve([day]);
  await pending;
  if (operation === 'report') {
    expect(mockDrivers.has(B) ? rows(B, 'SELECT raw_text,halt FROM subjective_report') : []).toEqual([]);
    expect(rows(A, 'SELECT raw_text,halt FROM subjective_report').slice(before)).toEqual([{ raw_text: 'chest pain', halt: 1 }]);
  } else {
    expect(mockDrivers.has(B) ? rows(B, 'SELECT date FROM hrv_daily WHERE date=?', day.date) : []).toEqual([]);
    expect(rows(A, 'SELECT rmssd_ms,source FROM hrv_daily WHERE date=?', day.date)).toEqual([{ rmssd_ms: day.rmssdMs, source: 'health_connect' }]);
  }
});

test.each(['report', 'sync'].flatMap(operation => ['success', 'failure'].flatMap(outcome =>
  ['none', 'switch', 'create', 'restore'].map(attempt => [operation, outcome, attempt]))))(
  '%s delayed %s retains ownership during %s', async (operation, outcome, attempt) => {
    const hold = deferred();
    const started = jest.fn(() => hold.promise);
    const before = rows(A, 'SELECT * FROM subjective_report').length;
    const beforeHrv = rows(A, 'SELECT date,rmssd_ms,source FROM hrv_daily WHERE date=?', day.date);
    let pending;
    if (operation === 'report') {
      state().setEmbedder({ embed: started });
      pending = state().reportSubjective('chest pain', 10);
    } else {
      await configureHealth(started);
      pending = state().syncBiometrics();
    }
    expect(started).toHaveBeenCalledTimes(1);
    expect(activeDataMutationLeaseCount()).toBe(1);
    if (attempt === 'switch') state().switchAthlete('athlete-b');
    if (attempt === 'create') state().createAthlete('Synthetic C');
    if (attempt === 'restore') expect(() => acquireDataMaintenanceLock('test-restore')).toThrow(/still being saved/i);
    expect(state().activeAthleteId).toBe('default');
    expect(state().status).toBe('ready');
    expect(mockRegistry.athletes).toHaveLength(2);
    if (attempt === 'switch' || attempt === 'create') expect(state().error).toMatch(/still being saved/i);
    if (outcome === 'failure') hold.reject(new Error('synthetic native failure'));
    else hold.resolve(operation === 'report' ? new Float32Array(384) : [day]);
    await pending;
    expect(activeDataMutationLeaseCount()).toBe(0);
    if (operation === 'report') {
      expect(rows(A, 'SELECT raw_text,halt FROM subjective_report').slice(before)).toEqual([{ raw_text: 'chest pain', halt: 1 }]);
      expect(state().triaging).toBe(false);
    } else {
      expect(rows(A, 'SELECT date,rmssd_ms,source FROM hrv_daily WHERE date=?', day.date)).toEqual(
        outcome === 'success' ? [{ date: day.date, rmssd_ms: day.rmssdMs, source: 'health_connect' }] : beforeHrv);
    }
    // Restore is available after settlement, and a subsequent A -> B -> A is safe.
    acquireDataMaintenanceLock('settled-probe')();
    state().switchAthlete('athlete-b');
    await settle();
    expect(state().activeAthleteId).toBe('athlete-b');
    expect(rows(B, 'SELECT raw_text FROM subjective_report')).toEqual([]);
    expect(rows(B, 'SELECT date FROM hrv_daily WHERE date=?', day.date)).toEqual([]);
    expect(state().lastTriage).toBeNull();
    expect(state().runner).toBeNull();
    expect(state().triaging).toBe(false);
    state().switchAthlete('default');
    await settle();
    expect(state().activeAthleteId).toBe('default');
  });

test('overlapping reads keep switching blocked until every lease settles, including an empty result', async () => {
  const first = deferred();
  const second = deferred();
  await configureHealth(jest.fn().mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise));
  const p1 = state().syncBiometrics();
  const p2 = state().syncBiometrics();
  expect(activeDataMutationLeaseCount()).toBe(2);
  first.resolve([]);
  await p1;
  expect(activeDataMutationLeaseCount()).toBe(1);
  state().switchAthlete('athlete-b');
  expect(state().activeAthleteId).toBe('default');
  second.reject(new Error('synthetic failure'));
  await p2;
  expect(activeDataMutationLeaseCount()).toBe(0);
  state().switchAthlete('athlete-b');
  await settle();
  expect(state().activeAthleteId).toBe('athlete-b');
});

test('reports and reads cannot begin while a switch or maintenance is pending', async () => {
  const embed = jest.fn();
  const readDaily = jest.fn();
  state().setEmbedder({ embed });
  await configureHealth(readDaily);
  mockLoadGate = deferred();
  state().switchAthlete('athlete-b');
  await state().reportSubjective('chest pain', 10);
  await state().syncBiometrics();
  expect(embed).not.toHaveBeenCalled();
  expect(readDaily).not.toHaveBeenCalled();
  mockLoadGate.resolve();
  await settle();
  mockLoadGate = null;
  expect(activeDataMutationLeaseCount()).toBe(0);
  const release = acquireDataMaintenanceLock('backup-test');
  try {
    useStore.setState({ vector: { ...state().vector }, biometricsStatus: 'ready' });
    await state().reportSubjective('chest pain', 10);
    await state().syncBiometrics();
    expect(embed).not.toHaveBeenCalled();
    expect(readDaily).not.toHaveBeenCalled();
    expect(state().error).toMatch(/backup or restore/i);
  } finally { release(); }
});

test.each(['connect', 'request'].flatMap(operation => ['success', 'failure'].flatMap(outcome =>
  ['switch', 'aba', 'create', 'restore', 'replace'].map(change => [operation, outcome, change]))))(
  '%s permission %s cannot change a later context after %s', async (operation, outcome, change) => {
    const hold = deferred();
    const readDaily = jest.fn(async () => [day]);
    const bridge = { hasGrantedPermissions: () => hold.promise, requestPermissions: () => hold.promise, readDaily };
    let pending;
    if (operation === 'connect') pending = state().connectBiometrics(bridge);
    else {
      await state().connectBiometrics({ ...bridge, hasGrantedPermissions: async () => false });
      pending = state().requestBiometricsAccess();
    }
    if (change === 'switch' || change === 'aba') {
      state().switchAthlete('athlete-b'); await settle();
      if (change === 'aba') { state().switchAthlete('default'); await settle(); }
    } else if (change === 'create') { state().createAthlete('Synthetic C'); await settle(); }
    else if (change === 'restore') {
      const release = acquireDataMaintenanceLock('test-restore');
      closeStoreDatabaseForRestore();
      release(); restartStoreAfterRestore(); await settle();
    } else { await state().connectBiometrics(null); }
    const expected = state().biometricsStatus;
    if (outcome === 'success') hold.resolve(true); else hold.reject(new Error('synthetic permission failure'));
    await pending;
    expect(state().biometricsStatus).toBe(expected);
    expect(readDaily).not.toHaveBeenCalled();
    expect(activeDataMutationLeaseCount()).toBe(0);
  });

test('current permission success still syncs and initial boot context remains usable', async () => {
  const readDaily = jest.fn(async () => [day]);
  await state().connectBiometrics({ hasGrantedPermissions: async () => true, requestPermissions: async () => true, readDaily });
  expect(readDaily).toHaveBeenCalledTimes(1);
  expect(rows(A, 'SELECT rmssd_ms FROM hrv_daily WHERE date=?', day.date)).toEqual([{ rmssd_ms: day.rmssdMs }]);
  await state().requestBiometricsAccess();
  expect(readDaily).toHaveBeenCalledTimes(2);
  expect(activeDataMutationLeaseCount()).toBe(0);
});

test.each([
  ['delete target', () => state().deleteAthlete('athlete-b')],
  ['rename target', () => state().renameAthleteEntry('athlete-b', 'Changed B')],
  ['create', () => state().createAthlete('Synthetic C')],
  ['settings', () => state().setAdvancedToolsUnlocked(false)],
  ['profile/name', () => state().completeOnboarding({ weekly_frequency: 7 }, 'Changed A')],
])('pending switch refuses the peer registry action: %s', async (_label, peer) => {
  const beforeProfile = rows(A, 'SELECT weekly_frequency FROM athlete_profile');
  mockLoadGate = deferred();
  state().switchAthlete('athlete-b');
  peer();
  expect(state().error).toMatch(/saved or opened|finish opening/i);
  expect(activeDataMutationLeaseCount()).toBe(1);
  expect(rows(A, 'SELECT weekly_frequency FROM athlete_profile')).toEqual(beforeProfile);
  mockLoadGate.resolve();
  await settle();
  mockLoadGate = null;
  expect(state().activeAthleteId).toBe('athlete-b');
  expect(mockRegistry.athletes.map(a => a.name)).toEqual(['Synthetic A', 'Synthetic B']);
  expect(mockRegistry.advancedToolsUnlocked).toBe(true);
  expect(activeDataMutationLeaseCount()).toBe(0);
});

test('pending onboarding name stays with its original athlete and blocks a switch', async () => {
  mockLoadGate = deferred();
  state().completeOnboarding({}, 'Renamed A');
  expect(activeDataMutationLeaseCount()).toBe(1);
  state().switchAthlete('athlete-b');
  expect(state().activeAthleteId).toBe('default');
  expect(state().error).toMatch(/still being saved/i);
  mockLoadGate.resolve();
  await settle();
  mockLoadGate = null;
  expect(mockRegistry.athletes.map(a => a.name)).toEqual(['Renamed A', 'Synthetic B']);
  expect(activeDataMutationLeaseCount()).toBe(0);
  state().switchAthlete('athlete-b');
  await settle();
  expect(state().activeAthleteId).toBe('athlete-b');
});

test.each(['disconnect', 'reconnect', 'deny'].flatMap(change => ['success', 'failure'].map(outcome => [change, outcome])))(
  'pending biometric read preserves later %s status on %s', async (change, outcome) => {
    const hold = deferred();
    const readDaily = jest.fn(() => hold.promise);
    const before = rows(A, 'SELECT rmssd_ms,source FROM hrv_daily WHERE date=?', day.date);
    await state().connectBiometrics({ hasGrantedPermissions: async () => false, requestPermissions: async () => false, readDaily });
    useStore.setState({ biometricsStatus: 'ready' });
    const pending = state().syncBiometrics();
    const replacementRead = jest.fn();
    if (change === 'disconnect') await state().connectBiometrics(null);
    if (change === 'reconnect') await state().connectBiometrics({ hasGrantedPermissions: async () => false, readDaily: replacementRead });
    if (change === 'deny') await state().requestBiometricsAccess();
    const expected = { disconnect: 'unavailable', reconnect: 'idle', deny: 'denied' }[change];
    expect(state().biometricsStatus).toBe(expected);
    if (outcome === 'success') hold.resolve([day]); else hold.reject(new Error('synthetic read failure'));
    await pending;
    expect(state().biometricsStatus).toBe(expected);
    expect(rows(A, 'SELECT rmssd_ms,source FROM hrv_daily WHERE date=?', day.date)).toEqual(before);
    expect(replacementRead).not.toHaveBeenCalled();
    expect(activeDataMutationLeaseCount()).toBe(0);
  });

test('a startup grant discarded before recovery is rechecked after safe boot, then manual sync still reads', async () => {
  prepareColdBoot(false);
  const readDaily = jest.fn(async () => [day]);
  const requestPermissions = jest.fn(async () => true);
  await state().connectBiometrics({ hasGrantedPermissions: async () => true, requestPermissions, readDaily });
  expect(state().biometricsStatus).toBe('off');
  expect(readDaily).not.toHaveBeenCalled();
  expect(mockDrivers.size).toBe(0);

  authorizeAthleteDataBoot();
  state().boot();
  await settle();
  expect(state().status).toBe('ready');
  expect(state().biometricsStatus).toBe('ready');
  expect(readDaily).toHaveBeenCalledTimes(1);
  expect(rows(A, 'SELECT rmssd_ms FROM hrv_daily WHERE date=?', day.date)).toEqual([{ rmssd_ms: day.rmssdMs }]);
  expect(requestPermissions).not.toHaveBeenCalled();

  await state().syncBiometrics();
  expect(readDaily).toHaveBeenCalledTimes(2);
});

test.each(['before', 'after'])('startup permission grant resolving %s delayed registry hydration syncs once', async timing => {
  prepareColdBoot();
  const registry = deferred();
  mockLoadGate = registry;
  state().boot();
  await settle();
  const first = deferred();
  const second = deferred();
  const hasGrantedPermissions = jest.fn().mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
  const readDaily = jest.fn(async () => [day]);
  const requestPermissions = jest.fn();
  const pending = state().connectBiometrics({ hasGrantedPermissions, requestPermissions, readDaily });

  if (timing === 'before') {
    first.resolve(true);
    await pending;
    expect(state().status).toBe('booting');
    expect(mockDrivers.size).toBe(0);
    expect(readDaily).not.toHaveBeenCalled();
    registry.resolve();
    await settle();
  } else {
    registry.resolve();
    await settle();
    expect(state().status).toBe('ready');
    expect(hasGrantedPermissions).toHaveBeenCalledTimes(2);
    expect(readDaily).not.toHaveBeenCalled();
    second.resolve(true);
    await settle();
    first.resolve(true);
    await pending;
  }
  mockLoadGate = null;
  expect(state().status).toBe('ready');
  expect(readDaily).toHaveBeenCalledTimes(1);
  expect(rows(A, 'SELECT rmssd_ms FROM hrv_daily WHERE date=?', day.date)).toEqual([{ rmssd_ms: day.rmssdMs }]);
  expect(requestPermissions).not.toHaveBeenCalled();
});

test.each(['before', 'after'])('a startup grant resolving %s registry selection is rechecked for the saved non-default athlete', async timing => {
  prepareColdBoot();
  mockRegistry.activeId = 'athlete-b';
  const registry = deferred();
  mockLoadGate = registry;
  state().boot();
  await settle();
  const first = deferred();
  const hasGrantedPermissions = jest.fn().mockImplementationOnce(() => first.promise).mockResolvedValue(true);
  const readDaily = jest.fn(async () => [day]);
  const pending = state().connectBiometrics({ hasGrantedPermissions, requestPermissions: jest.fn(), readDaily });
  if (timing === 'before') {
    first.resolve(true);
    await pending;
    expect(state().status).toBe('booting');
    expect(readDaily).not.toHaveBeenCalled();
    registry.resolve();
    await settle();
  } else {
    registry.resolve();
    await settle();
    first.resolve(true);
    await pending;
  }
  mockLoadGate = null;
  expect(state().activeAthleteId).toBe('athlete-b');
  expect(hasGrantedPermissions).toHaveBeenCalledTimes(2);
  expect(rows(B, 'SELECT rmssd_ms FROM hrv_daily WHERE date=?', day.date)).toEqual([{ rmssd_ms: day.rmssdMs }]);
  expect(mockDrivers.has(A) ? rows(A, 'SELECT rmssd_ms FROM hrv_daily WHERE date=?', day.date) : []).toEqual([]);
  first.resolve(true);
  await pending;
  expect(readDaily).toHaveBeenCalledTimes(1);
});

test('a safe-boot grant recheck can deny access without opening a permission sheet', async () => {
  prepareColdBoot(false);
  const hasGrantedPermissions = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  const readDaily = jest.fn();
  const requestPermissions = jest.fn();
  await state().connectBiometrics({ hasGrantedPermissions, requestPermissions, readDaily });
  expect(state().biometricsStatus).toBe('off');
  expect(mockDrivers.size).toBe(0);
  authorizeAthleteDataBoot();
  state().boot();
  await settle();
  expect(state().status).toBe('ready');
  expect(state().biometricsStatus).toBe('idle');
  expect(hasGrantedPermissions).toHaveBeenCalledTimes(2);
  expect(requestPermissions).not.toHaveBeenCalled();
  expect(readDaily).not.toHaveBeenCalled();
});

test('an unavailable bridge stays unavailable through safe boot and never reads data', async () => {
  prepareColdBoot(false);
  await state().connectBiometrics(null);
  expect(state().biometricsStatus).toBe('unavailable');
  expect(mockDrivers.size).toBe(0);
  authorizeAthleteDataBoot();
  state().boot();
  await settle();
  expect(state().status).toBe('ready');
  expect(state().biometricsStatus).toBe('unavailable');
  expect(mockDrivers.size).toBe(1);
});

test('safe boot does not supersede a newer pending explicit permission request', async () => {
  prepareColdBoot();
  const registry = deferred();
  mockLoadGate = registry;
  state().boot();
  await settle();
  const oldCheck = deferred();
  const explicitRequest = deferred();
  const hasGrantedPermissions = jest.fn(() => oldCheck.promise);
  const readDaily = jest.fn(async () => [day]);
  const bridge = { hasGrantedPermissions, requestPermissions: () => explicitRequest.promise, readDaily };
  const oldConnect = state().connectBiometrics(bridge);
  const pendingRequest = state().requestBiometricsAccess();
  registry.resolve();
  await settle();
  mockLoadGate = null;
  expect(state().status).toBe('ready');
  expect(hasGrantedPermissions).toHaveBeenCalledTimes(1);
  expect(readDaily).not.toHaveBeenCalled();
  explicitRequest.resolve(false);
  await pendingRequest;
  oldCheck.resolve(true);
  await oldConnect;
  expect(state().biometricsStatus).toBe('denied');
  expect(readDaily).not.toHaveBeenCalled();
});

test('an explicit request against the initial athlete placeholder is discarded after registry selection and can be retried', async () => {
  prepareColdBoot();
  mockRegistry.activeId = 'athlete-b';
  const registry = deferred();
  mockLoadGate = registry;
  state().boot();
  await settle();
  const explicitRequest = deferred();
  const hasGrantedPermissions = jest.fn().mockResolvedValue(false);
  const requestPermissions = jest.fn().mockImplementationOnce(() => explicitRequest.promise).mockResolvedValueOnce(true);
  const readDaily = jest.fn(async () => [day]);
  const bridge = { hasGrantedPermissions, requestPermissions, readDaily };
  await state().connectBiometrics(bridge);
  const staleRequest = state().requestBiometricsAccess();
  registry.resolve();
  await settle();
  mockLoadGate = null;
  expect(state().activeAthleteId).toBe('athlete-b');
  expect(hasGrantedPermissions).toHaveBeenCalledTimes(1);
  expect(readDaily).not.toHaveBeenCalled();
  explicitRequest.resolve(true);
  await staleRequest;
  expect(state().biometricsStatus).toBe('idle');
  expect(readDaily).not.toHaveBeenCalled();

  await state().requestBiometricsAccess();
  expect(state().biometricsStatus).toBe('ready');
  expect(readDaily).toHaveBeenCalledTimes(1);
  expect(rows(B, 'SELECT rmssd_ms FROM hrv_daily WHERE date=?', day.date)).toEqual([{ rmssd_ms: day.rmssdMs }]);
  expect(mockDrivers.has(A) ? rows(A, 'SELECT rmssd_ms FROM hrv_daily WHERE date=?', day.date) : []).toEqual([]);
});

test.each(['denial', 'disconnect'])('safe boot preserves a completed explicit %s', async outcome => {
  prepareColdBoot();
  const registry = deferred();
  mockLoadGate = registry;
  state().boot();
  await settle();
  const oldCheck = deferred();
  const hasGrantedPermissions = jest.fn(() => oldCheck.promise);
  const readDaily = jest.fn();
  const bridge = { hasGrantedPermissions, requestPermissions: async () => false, readDaily };
  const oldConnect = state().connectBiometrics(bridge);
  if (outcome === 'denial') await state().requestBiometricsAccess();
  else await state().connectBiometrics(null);
  const expected = outcome === 'denial' ? 'denied' : 'unavailable';
  registry.resolve();
  await settle();
  mockLoadGate = null;
  expect(hasGrantedPermissions).toHaveBeenCalledTimes(1);
  oldCheck.resolve(true);
  await oldConnect;
  expect(state().biometricsStatus).toBe(expected);
  expect(readDaily).not.toHaveBeenCalled();
});

test.each([
  ['connect', 'denial'], ['connect', 'error'], ['request', 'denial'], ['request', 'error'],
])('older %s %s cannot overwrite a newer grant on the same bridge', async (olderOperation, outcome) => {
  const old = deferred();
  const hasGrantedPermissions = olderOperation === 'connect'
    ? jest.fn(() => old.promise)
    : jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const requestPermissions = olderOperation === 'connect'
    ? jest.fn(async () => true)
    : jest.fn(() => old.promise);
  const readDaily = jest.fn(async () => []);
  const bridge = { hasGrantedPermissions, requestPermissions, readDaily };
  let older;
  if (olderOperation === 'connect') older = state().connectBiometrics(bridge);
  else {
    await state().connectBiometrics(bridge);
    older = state().requestBiometricsAccess();
  }
  if (olderOperation === 'connect') await state().requestBiometricsAccess();
  else await state().connectBiometrics(bridge);
  expect(state().biometricsStatus).toBe('ready');
  expect(readDaily).toHaveBeenCalledTimes(1);
  if (outcome === 'denial') old.resolve(false);
  else old.reject(new Error('synthetic permission failure'));
  await older;
  expect(state().biometricsStatus).toBe('ready');
  expect(readDaily).toHaveBeenCalledTimes(1);
});

test('an older granted check cannot overwrite a newer explicit denial', async () => {
  const oldCheck = deferred();
  const readDaily = jest.fn(async () => [day]);
  const pending = state().connectBiometrics({
    hasGrantedPermissions: () => oldCheck.promise,
    requestPermissions: async () => false,
    readDaily,
  });
  await state().requestBiometricsAccess();
  expect(state().biometricsStatus).toBe('denied');
  oldCheck.resolve(true);
  await pending;
  expect(state().biometricsStatus).toBe('denied');
  expect(readDaily).not.toHaveBeenCalled();
});

test('same-bridge reconnects and disconnects invalidate older permission results', async () => {
  const first = deferred();
  const second = deferred();
  const third = deferred();
  const readDaily = jest.fn(async () => [day]);
  const bridge = {
    hasGrantedPermissions: jest.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(third.promise),
    requestPermissions: jest.fn(),
    readDaily,
  };
  const olderConnect = state().connectBiometrics(bridge);
  const newerConnect = state().connectBiometrics(bridge);
  second.resolve(false);
  await newerConnect;
  first.resolve(true);
  await olderConnect;
  expect(state().biometricsStatus).toBe('idle');
  expect(readDaily).not.toHaveBeenCalled();

  const disconnectedConnect = state().connectBiometrics(bridge);
  await state().connectBiometrics(null);
  third.resolve(true);
  await disconnectedConnect;
  expect(state().biometricsStatus).toBe('unavailable');
  expect(readDaily).not.toHaveBeenCalled();
});

test('a daily read stays stale across denial then grant even when status returns to ready', async () => {
  const pendingRead = deferred();
  const readDaily = jest.fn().mockReturnValueOnce(pendingRead.promise).mockResolvedValueOnce([]);
  const requestPermissions = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  await state().connectBiometrics({ hasGrantedPermissions: async () => false, requestPermissions, readDaily });
  const before = rows(A, 'SELECT rmssd_ms FROM hrv_daily WHERE date=?', day.date);
  useStore.setState({ biometricsStatus: 'ready' });
  const pending = state().syncBiometrics();
  await state().requestBiometricsAccess();
  expect(state().biometricsStatus).toBe('denied');
  await state().requestBiometricsAccess();
  expect(state().biometricsStatus).toBe('ready');
  expect(readDaily).toHaveBeenCalledTimes(2);
  pendingRead.resolve([day]);
  await pending;
  expect(rows(A, 'SELECT rmssd_ms FROM hrv_daily WHERE date=?', day.date)).toEqual(before);
  expect(activeDataMutationLeaseCount()).toBe(0);
});
