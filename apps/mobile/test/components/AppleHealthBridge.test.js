/**
 * AppleHealthBridge.test.js — the read-only Apple Health adapter.
 *
 * Host evidence only (no HealthKit here): the pure sleep and resting-HR
 * normalization, the bridge contract against a stand-in for
 * @kingstinct/react-native-healthkit, the platform factory, the store writing
 * iOS sleep and resting HR (069 resting_hr_daily: provenance, unit, date and
 * replacement) without ever writing HRV, and the wording never claiming access
 * was granted or that resting HR feeds readiness. Real-device Health data and
 * authorization remain owner/device acceptance items.
 */
import { Platform } from 'react-native';
import { appleHealthDaily, appleRestingHrToRecords, appleSleepDaily, appleSleepToRecords, APPLE_RESTING_HR_UNIT, APPLE_SLEEP_VALUE, tryCreateAppleHealthBridge, tryCreateBiometricsBridge, UNSTAGED_SLEEP_EFFICIENCY } from '@ak/biometrics';
import { biometricsCopy, providerForPlatform } from '../../src/state/biometricsCopy';
import { biometricsProviderFor } from '@ak/biometrics';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests, tryAcquireDataMutationLease } from '../../src/state/dataMaintenanceLock';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

const mockHealthKit = {
  available: true,
  requestStatus: 1,
  requestResult: true,
  samples: [],
  restingHr: [],
  requests: [],
  queries: [],
  fail: false,
  failSleep: false,
  failRestingHr: false,
};
jest.mock('@kingstinct/react-native-healthkit', () => ({
  isHealthDataAvailable: () => mockHealthKit.available,
  getRequestStatusForAuthorization: async (request) => {
    mockHealthKit.requests.push(['status', request]);
    if (mockHealthKit.fail) throw new Error('synthetic native failure');
    return mockHealthKit.requestStatus;
  },
  requestAuthorization: async (request) => {
    mockHealthKit.requests.push(['request', request]);
    if (mockHealthKit.fail) throw new Error('synthetic native failure');
    return mockHealthKit.requestResult;
  },
  queryCategorySamples: async (identifier, options) => {
    mockHealthKit.queries.push([identifier, options]);
    if (mockHealthKit.fail || mockHealthKit.failSleep) throw new Error('synthetic native failure');
    return mockHealthKit.samples;
  },
  queryQuantitySamples: async (identifier, options) => {
    mockHealthKit.queries.push([identifier, options]);
    if (mockHealthKit.fail || mockHealthKit.failRestingHr) throw new Error('synthetic native failure');
    return mockHealthKit.restingHr;
  },
}));

let mockDrivers;
let mockRegistry;
function mockDriverFor(name) {
  if (!mockDrivers.has(name)) mockDrivers.set(name, makeNodeSqliteDriver());
  return mockDrivers.get(name);
}
jest.mock('@op-engineering/op-sqlite', () => ({ open: ({ name }) => mockDriverFor(name) }));
jest.mock('../../src/state/athleteRegistry', () => ({
  loadRegistry: async () => mockRegistry,
  saveRegistry: async (next) => { mockRegistry = next; return true; },
}));

const at = (iso) => new Date(iso);
const sample = (start, end, value, sourceId = 'com.apple.health.watch') => ({ startDate: at(start), endDate: at(end), value, sourceId });
const minutesOf = (stages, code) => stages.filter((s) => s.stage === code)
  .reduce((sum, s) => sum + (Date.parse(s.endTime) - Date.parse(s.startTime)) / 60000, 0);

let originalOs;
beforeEach(() => {
  originalOs = Platform.OS;
  Object.assign(mockHealthKit, {
    available: true, requestStatus: 1, requestResult: true, samples: [], restingHr: [], requests: [], queries: [],
    fail: false, failSleep: false, failRestingHr: false,
  });
});
afterEach(() => { Platform.OS = originalOs; });

describe('sleep normalization (pure)', () => {
  const night = [
    sample('2026-09-30T13:00:00Z', '2026-09-30T14:00:00Z', APPLE_SLEEP_VALUE.asleepCore),
    sample('2026-09-30T14:00:00Z', '2026-09-30T15:00:00Z', APPLE_SLEEP_VALUE.asleepDeep),
    sample('2026-09-30T15:00:00Z', '2026-09-30T15:30:00Z', APPLE_SLEEP_VALUE.awake),
    sample('2026-09-30T15:30:00Z', '2026-09-30T17:00:00Z', APPLE_SLEEP_VALUE.asleepREM),
    sample('2026-09-30T17:00:00Z', '2026-09-30T20:00:00Z', APPLE_SLEEP_VALUE.asleepCore),
  ];

  test('stages map onto the aggregator codes and minutes are exact', () => {
    const [record] = appleSleepToRecords(night);
    expect(record.startTime).toBe('2026-09-30T13:00:00.000Z');
    expect(record.endTime).toBe('2026-09-30T20:00:00.000Z');
    expect(minutesOf(record.stages, 4)).toBe(240); // core -> light
    expect(minutesOf(record.stages, 5)).toBe(60); // deep
    expect(minutesOf(record.stages, 6)).toBe(90); // REM
    expect(minutesOf(record.stages, 1)).toBe(30); // awake
  });

  test('a second source for the same night is not added on top (no double count)', () => {
    const phone = [sample('2026-09-30T12:30:00Z', '2026-09-30T20:30:00Z', APPLE_SLEEP_VALUE.inBed, 'com.apple.health.iphone')];
    const daily = appleSleepDaily([...night, ...phone]);
    expect(daily).toHaveLength(1);
    // The staged Watch record wins: in bed = its 7 h span, asleep = staged minutes.
    expect(daily[0]).toMatchObject({ inBedMin: 420, asleepMin: 390, deepMin: 60, remMin: 90, lightMin: 240 });
  });

  test('overlapping duplicates from one source are unioned, and higher stages win overlaps', () => {
    const duplicated = [...night,
      sample('2026-09-30T13:30:00Z', '2026-09-30T14:30:00Z', APPLE_SLEEP_VALUE.asleepCore),
      sample('2026-09-30T14:30:00Z', '2026-09-30T15:00:00Z', APPLE_SLEEP_VALUE.asleepUnspecified)];
    const [record] = appleSleepToRecords(duplicated);
    expect(minutesOf(record.stages, 5)).toBe(60);
    expect(minutesOf(record.stages, 4)).toBe(240);
    expect(minutesOf(record.stages, 2)).toBe(0);
  });

  test('a nap is its own episode and both are bucketed by wake date', () => {
    const nap = [sample('2026-10-01T04:00:00Z', '2026-10-01T05:00:00Z', APPLE_SLEEP_VALUE.asleepUnspecified)];
    expect(appleSleepToRecords([...night, ...nap])).toHaveLength(2);
  });

  test('in-bed-only nights use the conservative unstaged estimate; HRV and RHR stay unknown', () => {
    const daily = appleSleepDaily([sample('2026-09-30T13:00:00Z', '2026-09-30T21:00:00Z', APPLE_SLEEP_VALUE.inBed, 'com.example.app')]);
    expect(daily).toHaveLength(1);
    expect(daily[0].inBedMin).toBe(480);
    expect(daily[0].asleepMin).toBe(Math.round(480 * UNSTAGED_SLEEP_EFFICIENCY * 10) / 10);
    expect(daily[0].rmssdMs).toBeNull();
    expect(daily[0].restingHrBpm).toBeNull();
  });

  test('known awake time is never turned into estimated sleep (awake only, with and without in bed)', () => {
    const awake = sample('2026-09-30T13:00:00Z', '2026-09-30T21:00:00Z', APPLE_SLEEP_VALUE.awake);
    const inBed = sample('2026-09-30T13:00:00Z', '2026-09-30T21:00:00Z', APPLE_SLEEP_VALUE.inBed);
    for (const samples of [[awake], [inBed, awake]]) {
      const daily = appleSleepDaily(samples);
      expect(daily).toHaveLength(1);
      expect(daily[0]).toMatchObject({ inBedMin: 480, asleepMin: 0, deepMin: null, remMin: null, lightMin: null, rmssdMs: null, restingHrBpm: null });
    }
    // Partly awake, partly unstaged in bed: only the known stages count.
    const partial = appleSleepDaily([inBed, sample('2026-09-30T13:00:00Z', '2026-09-30T14:00:00Z', APPLE_SLEEP_VALUE.awake)]);
    expect(partial[0]).toMatchObject({ inBedMin: 480, asleepMin: 0 });
  });

  test('malformed, inverted, zero-length, over-24h and unknown-value samples are dropped', () => {
    expect(appleSleepToRecords([
      sample('2026-09-30T13:00:00Z', '2026-09-30T13:00:00Z', APPLE_SLEEP_VALUE.asleepCore),
      sample('2026-09-30T14:00:00Z', '2026-09-30T13:00:00Z', APPLE_SLEEP_VALUE.asleepCore),
      sample('2026-09-28T00:00:00Z', '2026-09-30T00:00:00Z', APPLE_SLEEP_VALUE.asleepCore),
      { startDate: 'not a date', endDate: at('2026-09-30T13:00:00Z'), value: 3, sourceId: 'x' },
      sample('2026-09-30T13:00:00Z', '2026-09-30T14:00:00Z', 99),
    ])).toEqual([]);
  });
});

// Local-noon timestamps, so the expected local date holds in any test timezone.
const localNoon = (date) => new Date(`${date}T12:00:00`);
const rhr = (date, quantity, sourceId = 'com.apple.health.watch', unit = APPLE_RESTING_HR_UNIT) =>
  ({ startDate: localNoon(date), endDate: localNoon(date), quantity, unit, sourceId });

describe('resting heart rate normalization (pure)', () => {
  test('one value per local date, in beats per minute, never an HRV value', () => {
    const daily = appleHealthDaily([], [rhr('2026-09-29', 52), rhr('2026-09-30', 54.5)]);
    expect(daily).toEqual([
      expect.objectContaining({ date: '2026-09-29', restingHrBpm: 52, rmssdMs: null, inBedMin: null }),
      expect.objectContaining({ date: '2026-09-30', restingHrBpm: 54.5, rmssdMs: null, inBedMin: null }),
    ]);
  });

  test('a second source for the same day is not mixed in: the source with most samples wins, ties by source id', () => {
    const records = appleRestingHrToRecords([
      rhr('2026-09-30', 50, 'com.apple.health.watch'), rhr('2026-09-30', 52, 'com.apple.health.watch'),
      rhr('2026-09-30', 70, 'com.example.ring'),
      rhr('2026-10-01', 60, 'com.b'), rhr('2026-10-01', 40, 'com.a'),
    ]);
    const daily = appleHealthDaily([], [
      rhr('2026-09-30', 50, 'com.apple.health.watch'), rhr('2026-09-30', 52, 'com.apple.health.watch'),
      rhr('2026-09-30', 70, 'com.example.ring'),
      rhr('2026-10-01', 60, 'com.b'), rhr('2026-10-01', 40, 'com.a'),
    ]);
    expect(records.map((r) => r.beatsPerMinute).sort()).toEqual([40, 50, 52]);
    expect(daily.map((d) => [d.date, d.restingHrBpm])).toEqual([['2026-09-30', 51], ['2026-10-01', 40]]);
  });

  test('another unit, a non-finite value, a value outside 20..150 or an unreadable date is dropped, not converted', () => {
    expect(appleRestingHrToRecords([
      rhr('2026-09-30', 0.9, 'w', 'count/s'),
      rhr('2026-09-30', Number.NaN),
      rhr('2026-09-30', 19.9),
      rhr('2026-09-30', 150.1),
      { startDate: 'not a date', endDate: 'not a date', quantity: 55, unit: APPLE_RESTING_HR_UNIT, sourceId: 'w' },
    ])).toEqual([]);
    // A sample with no unit field is the requested unit (the query names count/min).
    expect(appleRestingHrToRecords([{ ...rhr('2026-09-30', 55), unit: undefined }])).toHaveLength(1);
  });

  test('sleep and resting HR for the same morning share one day row', () => {
    const daily = appleHealthDaily(
      [sample('2026-09-30T13:00:00Z', '2026-09-30T20:00:00Z', APPLE_SLEEP_VALUE.asleepCore)],
      [{ ...rhr('2026-10-01', 48), startDate: new Date('2026-09-30T20:00:00Z'), endDate: new Date('2026-09-30T20:00:00Z') }],
    );
    const wake = appleSleepDaily([sample('2026-09-30T13:00:00Z', '2026-09-30T20:00:00Z', APPLE_SLEEP_VALUE.asleepCore)])[0].date;
    expect(daily.find((d) => d.date === wake)).toMatchObject({ inBedMin: 420, restingHrBpm: 48, rmssdMs: null });
  });
});

describe('bridge contract', () => {
  test('off iOS, and on iOS without Health data, there is no bridge', async () => {
    Platform.OS = 'android';
    expect(await tryCreateAppleHealthBridge()).toBeNull();
    Platform.OS = 'ios';
    mockHealthKit.available = false;
    expect(await tryCreateAppleHealthBridge()).toBeNull();
  });

  test('only sleep and resting HR are requested, nothing is shared, and "answered" is not reported as granted', async () => {
    Platform.OS = 'ios';
    const bridge = await tryCreateAppleHealthBridge();
    expect(bridge.provider).toBe('apple_health');
    expect(await bridge.hasGrantedPermissions()).toBe(false); // shouldRequest
    mockHealthKit.requestStatus = 2; // unnecessary: already answered
    expect(await bridge.hasGrantedPermissions()).toBe(true);
    expect(await bridge.requestPermissions()).toBe(true);
    for (const [, request] of mockHealthKit.requests) {
      expect(request).toEqual({ toRead: ['HKCategoryTypeIdentifierSleepAnalysis', 'HKQuantityTypeIdentifierRestingHeartRate'] });
      expect(request.toShare).toBeUndefined();
    }
  });

  test('reads a bounded window, maps sources, and fails soft', async () => {
    Platform.OS = 'ios';
    const bridge = await tryCreateAppleHealthBridge();
    mockHealthKit.samples = [{ startDate: at('2026-09-30T13:00:00Z'), endDate: at('2026-09-30T20:00:00Z'), value: 3,
      sourceRevision: { source: { bundleIdentifier: 'com.apple.health.watch', name: 'Watch' } } }];
    const daily = await bridge.readDaily(7);
    expect(daily).toHaveLength(1);
    const byType = Object.fromEntries(mockHealthKit.queries);
    expect(Object.keys(byType).sort()).toEqual(['HKCategoryTypeIdentifierSleepAnalysis', 'HKQuantityTypeIdentifierRestingHeartRate']);
    for (const options of Object.values(byType)) {
      expect(options.limit).toBeGreaterThan(0);
      expect(options.filter.date.endDate.getTime() - options.filter.date.startDate.getTime()).toBe(8 * 86400000);
    }
    expect(byType.HKQuantityTypeIdentifierRestingHeartRate.unit).toBe('count/min');
    mockHealthKit.fail = true;
    expect(await bridge.readDaily(7)).toEqual([]);
    expect(await bridge.hasGrantedPermissions()).toBe(false);
    expect(await bridge.requestPermissions()).toBe(false);
  });

  test('the production adapter reports an 8 h awake-only night as 0 asleep minutes (no fabricated sleep or HRV)', async () => {
    Platform.OS = 'ios';
    const bridge = await tryCreateAppleHealthBridge();
    for (const values of [[APPLE_SLEEP_VALUE.awake], [APPLE_SLEEP_VALUE.inBed, APPLE_SLEEP_VALUE.awake]]) {
      mockHealthKit.samples = values.map((value) => ({ startDate: at('2026-09-30T13:00:00Z'), endDate: at('2026-09-30T21:00:00Z'), value,
        sourceRevision: { source: { bundleIdentifier: 'com.apple.health.watch' } } }));
      const daily = await bridge.readDaily(7);
      expect(daily).toEqual([expect.objectContaining({ inBedMin: 480, asleepMin: 0, rmssdMs: null, restingHrBpm: null })]);
    }
  });

  test('one type failing (or empty) never sinks the other', async () => {
    Platform.OS = 'ios';
    const bridge = await tryCreateAppleHealthBridge();
    mockHealthKit.samples = [{ startDate: at('2026-09-30T13:00:00Z'), endDate: at('2026-09-30T20:00:00Z'), value: 3,
      sourceRevision: { source: { bundleIdentifier: 'w' } } }];
    mockHealthKit.restingHr = [{ startDate: localNoon('2026-09-28'), endDate: localNoon('2026-09-28'), quantity: 53, unit: 'count/min',
      sourceRevision: { source: { bundleIdentifier: 'w' } } }];
    mockHealthKit.failRestingHr = true;
    expect((await bridge.readDaily(7)).map((d) => d.restingHrBpm)).toEqual([null]);
    mockHealthKit.failRestingHr = false;
    mockHealthKit.failSleep = true;
    expect(await bridge.readDaily(7)).toEqual([expect.objectContaining({ date: '2026-09-28', restingHrBpm: 53, inBedMin: null })]);
  });

  test('the platform factory picks Apple Health on iOS and nothing on unsupported platforms', async () => {
    Platform.OS = 'ios';
    expect(await tryCreateBiometricsBridge()).not.toBeNull();
    Platform.OS = 'web';
    expect(await tryCreateBiometricsBridge()).toBeNull();
  });
});

async function bootFreshStore() {
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  mockDrivers = new Map();
  mockRegistry = { version: 1, activeId: 'default', advancedToolsUnlocked: false,
    athletes: [{ id: 'default', name: 'Synthetic', dbName: 'athlete_kinetics.db', createdAtMs: 0 }] };
  useStore.setState({ status: 'booting', error: null, activeAthleteId: 'default', session: null, biometricsStatus: 'off' });
  useStore.getState().boot();
  for (let n = 0; n < 8; n += 1) await new Promise((resolve) => setImmediate(resolve));
  expect(useStore.getState().status).toBe('ready');
  return mockDrivers.get('athlete_kinetics.db').raw;
}
const localDate = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const restingRows = (db) => db.prepare('SELECT date, bpm, source FROM resting_hr_daily ORDER BY date').all();

test('the store writes iOS sleep and never writes HRV', async () => {
  Platform.OS = 'ios';
  await bootFreshStore();
  const yesterday = new Date(Date.now() - 86400000);
  const start = new Date(yesterday.getTime() - 8 * 3600000);
  mockHealthKit.requestStatus = 2;
  mockHealthKit.samples = [{ startDate: start, endDate: yesterday, value: 4, sourceRevision: { source: { bundleIdentifier: 'w' } } }];
  await useStore.getState().connectBiometrics(await tryCreateAppleHealthBridge());
  expect(useStore.getState().biometricsStatus).toBe('ready');
  const db = mockDrivers.get('athlete_kinetics.db').raw;
  expect(db.prepare('SELECT in_bed_min, deep_min FROM sleep_daily').all()).toEqual([{ in_bed_min: 480, deep_min: 480 }]);
  expect(db.prepare('SELECT COUNT(*) AS c FROM hrv_daily').get().c).toBe(0);
  // No resting HR was shared, so none is stored.
  expect(restingRows(db)).toEqual([]);
  await useStore.getState().connectBiometrics(null);
});

test('the store keeps iOS resting HR on its own (069): provenance, unit, date, replacement, no deletion on an empty read', async () => {
  Platform.OS = 'ios';
  const db = await bootFreshStore();
  const twoDaysAgo = Date.now() - 2 * 86400000;
  const yesterday = Date.now() - 86400000;
  const quantity = (ms, value, unit = 'count/min') => ({ startDate: new Date(ms), endDate: new Date(ms), quantity: value, unit,
    sourceRevision: { source: { bundleIdentifier: 'com.apple.health.watch' } } });
  mockHealthKit.requestStatus = 2;
  mockHealthKit.restingHr = [quantity(twoDaysAgo, 55), quantity(yesterday, 53.5)];
  const bridge = await tryCreateAppleHealthBridge();
  await useStore.getState().connectBiometrics(bridge);
  expect(useStore.getState().biometricsStatus).toBe('ready');
  expect(restingRows(db)).toEqual([
    { date: localDate(twoDaysAgo), bpm: 55, source: 'apple_health' },
    { date: localDate(yesterday), bpm: 53.5, source: 'apple_health' },
  ]);
  // Never written as, or beside, an HRV value.
  expect(db.prepare('SELECT COUNT(*) AS c FROM hrv_daily').get().c).toBe(0);
  const firstSync = db.prepare('SELECT synced_at_ms FROM resting_hr_daily ORDER BY date').all();
  expect(firstSync.every((row) => row.synced_at_ms > 0)).toBe(true);

  // Health revised yesterday's value: a later read of the same date replaces it.
  mockHealthKit.restingHr = [quantity(yesterday, 51)];
  await useStore.getState().syncBiometrics();
  expect(restingRows(db)).toEqual([
    { date: localDate(twoDaysAgo), bpm: 55, source: 'apple_health' },
    { date: localDate(yesterday), bpm: 51, source: 'apple_health' },
  ]);

  // An empty read (no data, or access turned off — HealthKit does not say
  // which) and a failing read both leave the stored days untouched.
  mockHealthKit.restingHr = [];
  await useStore.getState().syncBiometrics();
  mockHealthKit.failRestingHr = true;
  await useStore.getState().syncBiometrics();
  expect(restingRows(db)).toHaveLength(2);
  // A sample in the wrong unit is not stored.
  mockHealthKit.failRestingHr = false;
  mockHealthKit.restingHr = [quantity(yesterday, 0.9, 'count/s')];
  await useStore.getState().syncBiometrics();
  expect(restingRows(db)[1]).toEqual({ date: localDate(yesterday), bpm: 51, source: 'apple_health' });

  // The measured days the athlete sees carry it.
  const measured = useStore.getState().loadMeasuredHistory(14);
  expect(measured.find((row) => row.date === localDate(yesterday))).toMatchObject({ restingHr: 51, hrvRmssdMs: null });
  await useStore.getState().connectBiometrics(null);
});

test('Health Connect resting HR on a day without HRV is kept too, and an undeclared source stores none', async () => {
  Platform.OS = 'android';
  const db = await bootFreshStore();
  const yesterday = localDate(Date.now() - 86400000);
  const twoDaysAgo = localDate(Date.now() - 2 * 86400000);
  const day = (date, rmssdMs, restingHrBpm) => ({ date, rmssdMs, restingHrBpm, inBedMin: null, asleepMin: null, deepMin: null, remMin: null, lightMin: null });
  const bridgeOf = (provider, days) => ({
    provider, hasGrantedPermissions: async () => true, requestPermissions: async () => true, readDaily: async () => days,
  });
  // Before 069 this RHR-only day was dropped (hrv_daily needs an RMSSD value).
  await useStore.getState().connectBiometrics(bridgeOf('health_connect', [day(twoDaysAgo, 60, 50), day(yesterday, null, 49)]));
  expect(useStore.getState().biometricsStatus).toBe('ready');
  expect(restingRows(db)).toEqual([
    { date: twoDaysAgo, bpm: 50, source: 'health_connect' },
    { date: yesterday, bpm: 49, source: 'health_connect' },
  ]);
  // hrv_daily is written exactly as before.
  expect(db.prepare('SELECT date, rmssd_ms, resting_hr FROM hrv_daily').all()).toEqual([{ date: twoDaysAgo, rmssd_ms: 60, resting_hr: 50 }]);
  await useStore.getState().connectBiometrics(null);

  db.exec('DELETE FROM resting_hr_daily');
  // History written before 069 (resting_hr beside RMSSD in hrv_daily) still reads.
  expect(useStore.getState().loadMeasuredHistory(14).find((row) => row.date === twoDaysAgo))
    .toMatchObject({ restingHr: 50, hrvRmssdMs: 60 });
  await useStore.getState().connectBiometrics(bridgeOf(undefined, [day(yesterday, null, 47)]));
  expect(restingRows(db)).toEqual([]);
  await useStore.getState().connectBiometrics(null);
});

test('iOS resting HR never rewrites a Health Connect hrv_daily row, and only the trailing week is written', async () => {
  Platform.OS = 'ios';
  const db = await bootFreshStore();
  const yesterday = localDate(Date.now() - 86400000);
  const tenDaysAgo = localDate(Date.now() - 10 * 86400000);
  // History restored from an Android backup.
  db.prepare("INSERT INTO hrv_daily (date, rmssd_ms, resting_hr, source) VALUES (?, 60, 50, 'health_connect')").run(yesterday);
  const day = (date, restingHrBpm) => ({ date, rmssdMs: null, restingHrBpm, inBedMin: 400, asleepMin: 360, deepMin: null, remMin: null, lightMin: null });
  await useStore.getState().connectBiometrics({
    provider: 'apple_health', hasGrantedPermissions: async () => true, requestPermissions: async () => true,
    // The oldest day stands for a night truncated at the read window's edge.
    readDaily: async () => [day(tenDaysAgo, 58), day(yesterday, 53)],
  });
  expect(db.prepare('SELECT resting_hr, source FROM hrv_daily WHERE date = ?').get(yesterday)).toEqual({ resting_hr: 50, source: 'health_connect' });
  expect(restingRows(db)).toEqual([{ date: yesterday, bpm: 53, source: 'apple_health' }]);
  expect(db.prepare('SELECT date FROM sleep_daily').all()).toEqual([{ date: yesterday }]);
  // Reads prefer the provenance-carrying table.
  expect(useStore.getState().loadMeasuredHistory(14).find((row) => row.date === yesterday)).toMatchObject({ restingHr: 53 });
  await useStore.getState().connectBiometrics(null);
});

test('a native Health read that never settles releases the data lease and writes nothing', async () => {
  Platform.OS = 'ios';
  const db = await bootFreshStore();
  let reads = 0;
  const hanging = {
    provider: 'apple_health', hasGrantedPermissions: async () => true, requestPermissions: async () => true,
    readDaily: () => { reads += 1; return reads === 1 ? Promise.resolve([]) : new Promise(() => {}); },
  };
  await useStore.getState().connectBiometrics(hanging);
  expect(useStore.getState().biometricsStatus).toBe('ready');
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
  try {
    const sync = useStore.getState().syncBiometrics();
    await Promise.resolve();
    // While the read is outstanding the lease is held: exclusive actions wait.
    expect(tryAcquireDataMutationLease(true)).toBeNull();
    jest.advanceTimersByTime(30_000);
    await sync;
  } finally {
    jest.useRealTimers();
  }
  const release = tryAcquireDataMutationLease(true);
  expect(release).not.toBeNull();
  release();
  expect(restingRows(db)).toEqual([]);
  await useStore.getState().connectBiometrics(null);
});

test('iOS wording never claims access was granted and names where to change it', () => {
  for (const status of ['off', 'unavailable', 'idle', 'denied', 'ready']) {
    const copy = biometricsCopy('apple_health', status);
    expect(copy.title).toContain('APPLE HEALTH');
    expect(copy.hint).not.toMatch(/\bconnected\b|\bgranted\b|Health Connect/i);
    expect(copy.showHrvTip).toBe(false);
  }
  expect(biometricsCopy('apple_health', 'ready').hint).toMatch(/requested[\s\S]*resting heart rate[\s\S]*Settings › Health[\s\S]*SDNN/);
  expect(biometricsCopy('apple_health', 'idle').hint).toMatch(/sleep and resting heart rate/);
  expect(biometricsCopy('health_connect', 'ready').hint).toMatch(/^Connected\./);
  // Resting HR does not feed readiness on either platform, and no copy says it does.
  for (const provider of ['apple_health', 'health_connect']) {
    for (const status of ['idle', 'ready']) {
      expect(biometricsCopy(provider, status).hint).not.toMatch(/resting heart rate[^.;]*feeds?\b/i);
      expect(biometricsCopy(provider, status).hint).not.toMatch(/resting heart rate, and sleep feed/i);
    }
  }
  for (const os of ['ios', 'android', 'web']) expect(providerForPlatform(os)).toBe(biometricsProviderFor(os));
});
