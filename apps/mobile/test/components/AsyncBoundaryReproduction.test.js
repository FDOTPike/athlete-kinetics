/** AsyncBoundaryReproduction.test.js — the independent release audit's seven-case
 * real-store diagnostic (docs/release-audit/2026-10-04, feature-async-boundary),
 * adapted to repository paths. Real zustand store + real migration chain per
 * athlete; native inference, health reads and registry reads are deferred
 * promises. Two no-switch controls and five ownership/ordering invariants.
 *
 * ADAPTED to the reviewed repair's semantics (2026-10-04): a switch or a
 * second registry edit attempted while athlete work is in flight is REFUSED
 * with a visible "still being saved" message instead of racing it. The
 * audit's invariants are unchanged and asserted in full: nothing crosses
 * athletes, no accepted edit is lost, a stale grant never overrides a newer
 * denial, and the refused action succeeds once the work settles. Before the
 * repair, this file failed 5 of 7 (switch=true x2, denial ordering, renames,
 * onboarding name) on both master 1da218d and feature 12a1fb1.
 */
import { useStore } from '../../src/state/useStore';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
let mockDrivers;
let mockRegistry;
let mockRegistryLoadDelay;
function mockDriverFor(name) {
  if (!mockDrivers.has(name)) mockDrivers.set(name, makeNodeSqliteDriver());
  return mockDrivers.get(name);
}
jest.mock('@op-engineering/op-sqlite', () => ({ open: ({ name }) => mockDriverFor(name) }));
jest.mock('../../src/state/athleteRegistry', () => ({
  loadRegistry: async () => { const captured=mockRegistry; const hold=mockRegistryLoadDelay; mockRegistryLoadDelay=null; if(hold) await hold.promise; return captured; },
  saveRegistry: async next => { mockRegistry = next; return true; },
}));
const state = () => useStore.getState();
const rows = (file, sql, ...params) => mockDrivers.get(file).raw.prepare(sql).all(...params);
const A = 'athlete_kinetics.db';
const B = 'athlete_b.db';
const settle = async () => { for (let n = 0; n < 4; n++) await new Promise(resolve => setImmediate(resolve)); };
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
beforeEach(async () => {
  // Disconnect any bridge a previous case granted: after the repair, a boot
  // with a granted bridge legitimately runs its one post-grant sync (the
  // reference suite resets the same way).
  await useStore.getState().connectBiometrics(null);
  useStore.setState({ biometricsStatus: 'off' });
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  mockDrivers = new Map();
  mockRegistryLoadDelay = null;
  mockRegistry = { version: 1, activeId: 'default', advancedToolsUnlocked: true, athletes: [
    { id: 'default', name: 'Synthetic athlete A', dbName: A, createdAtMs: 0 },
    { id: 'athlete-b', name: 'Synthetic athlete B', dbName: B, createdAtMs: 1 },
  ] };
  useStore.setState({ status: 'booting', error: null, activeAthleteId: 'default', session: null, runner: null, triaging: false });
  state().setEmbedder(null);
  state().boot();
  await settle();
  expect(state().status).toBe('ready');
  state().loadDemoAthlete();
  expect(state().vector).not.toBeNull();
});

test.each([false, true])('subjective report ownership survives deferred inference; switch=%s', async switchAthlete => {
  const hold = deferred();
  const started = jest.fn(() => hold.promise);
  state().setEmbedder({ embed: started });
  const beforeA = rows(A, 'SELECT * FROM subjective_report').length;
  const pending = state().reportSubjective('chest pain', 10);
  expect(started).toHaveBeenCalledTimes(1);
  if (switchAthlete) {
    state().switchAthlete('athlete-b');
    await settle();
    // The in-flight safety report keeps A bound: the switch is refused, visibly.
    expect(state().activeAthleteId).toBe('default');
    expect(state().error).toMatch(/still being saved/i);
  }
  // Native inference failure is a supported path: the keyword safety layer still runs.
  hold.reject(new Error('synthetic native inference unavailable'));
  await pending;
  const aReports = rows(A, 'SELECT raw_text,halt FROM subjective_report').slice(beforeA);
  if (switchAthlete) {
    state().switchAthlete('athlete-b');
    await settle();
    expect(state().activeAthleteId).toBe('athlete-b');
  }
  const bReports = switchAthlete ? rows(B, 'SELECT raw_text,halt FROM subjective_report') : [];
  console.log(JSON.stringify({ observation: 'subjective ownership', switchAthlete, activeAthlete: state().activeAthleteId, aReports, bReports, lastTriage: state().lastTriage?.kind }));
  expect(bReports).toEqual([]);
  expect(aReports).toEqual([{ raw_text: 'chest pain', halt: 1 }]);
});

test.each([false, true])('biometric sync ownership survives deferred read; switch=%s', async switchAthlete => {
  const hold = deferred();
  const readDaily = jest.fn(() => hold.promise);
  // Connect without auto-sync, then explicitly mark the permission/status fixture ready.
  await state().connectBiometrics({ hasGrantedPermissions: async () => false, readDaily });
  useStore.setState({ biometricsStatus: 'ready' });
  const pending = state().syncBiometrics();
  expect(readDaily).toHaveBeenCalledTimes(1);
  if (switchAthlete) {
    state().switchAthlete('athlete-b');
    await settle();
    expect(state().activeAthleteId).toBe('default');
    expect(state().error).toMatch(/still being saved/i);
  }
  const date = '2026-09-01';
  hold.resolve([{ date, rmssdMs: 73.125, restingHrBpm: 57, inBedMin: null, asleepMin: null, deepMin: null, remMin: null, lightMin: null }]);
  await pending;
  if (switchAthlete) {
    state().switchAthlete('athlete-b');
    await settle();
    expect(state().activeAthleteId).toBe('athlete-b');
  }
  const aRows = rows(A, 'SELECT date,rmssd_ms,source FROM hrv_daily WHERE date=?', date);
  const bRows = switchAthlete ? rows(B, 'SELECT date,rmssd_ms,source FROM hrv_daily WHERE date=?', date) : [];
  console.log(JSON.stringify({ observation: 'biometric ownership', switchAthlete, activeAthlete: state().activeAthleteId, aRows, bRows }));
  expect(bRows).toEqual([]);
  expect(aRows).toEqual([{ date, rmssd_ms: 73.125, source: 'health_connect' }]);
});

 test('older granted check cannot overwrite a newer explicit denial', async () => {
 const hold=deferred(); const readDaily=jest.fn(async()=>[]);
 const pending=state().connectBiometrics({hasGrantedPermissions:()=>hold.promise,requestPermissions:async()=>false,readDaily});
 await state().requestBiometricsAccess(); expect(state().biometricsStatus).toBe('denied');
 hold.resolve(true); await pending;
 console.log(JSON.stringify({observation:'permission completion ordering',finalStatus:state().biometricsStatus,reads:readDaily.mock.calls.length}));
 expect(state().biometricsStatus).toBe('denied'); expect(readDaily).not.toHaveBeenCalled();
 });

test('concurrent athlete renames never lose an accepted change', async()=>{
 state().renameAthleteEntry('default','Renamed A'); state().renameAthleteEntry('athlete-b','Renamed B');
 // The overlapping edit is refused visibly rather than accepted and then lost.
 expect(state().error).toMatch(/still being saved/i);
 await settle();
 console.log(JSON.stringify({observation:'concurrent registry writes',names:mockRegistry.athletes.map(a=>[a.id,a.name])}));
 expect(mockRegistry.athletes.find(a=>a.id==='default').name).toBe('Renamed A');
 expect(mockRegistry.athletes.find(a=>a.id==='athlete-b').name).toBe('Synthetic athlete B');
 // Retried once the first settles, both changes are present.
 state().renameAthleteEntry('athlete-b','Renamed B'); await settle();
 expect(mockRegistry.athletes.map(a=>a.name)).toEqual(['Renamed A','Renamed B']);
});
test('pending onboarding name remains assigned to its original athlete', async()=>{
 const hold=deferred(); mockRegistryLoadDelay=hold; state().completeOnboarding({},'Onboarded A');
 state().switchAthlete('athlete-b'); await settle();
 expect(state().activeAthleteId).toBe('default'); expect(state().error).toMatch(/still being saved/i);
 hold.resolve(); await settle();
 console.log(JSON.stringify({observation:'onboarding name ownership',active:state().activeAthleteId,registryActive:mockRegistry.activeId,names:mockRegistry.athletes.map(a=>[a.id,a.name])}));
 expect(mockRegistry.athletes.find(a=>a.id==='athlete-b').name).toBe('Synthetic athlete B');
 expect(mockRegistry.athletes.find(a=>a.id==='default').name).toBe('Onboarded A');
 // The stale snapshot can no longer reset the persisted active athlete.
 expect(mockRegistry.activeId).toBe('default');
 state().switchAthlete('athlete-b'); await settle();
 expect(state().activeAthleteId).toBe('athlete-b'); expect(mockRegistry.activeId).toBe('athlete-b');
});
