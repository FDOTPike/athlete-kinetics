/**
 * AppleHealthBridge.test.js — the read-only Apple Health adapter.
 *
 * Host evidence only (no HealthKit here): the pure sleep normalization, the
 * bridge contract against a stand-in for @kingstinct/react-native-healthkit,
 * the platform factory, the store writing iOS sleep without ever writing HRV,
 * and the iOS wording never claiming access was granted. Real-device Health
 * data and authorization remain owner/device acceptance items.
 */
import { Platform } from 'react-native';
import { appleSleepDaily, appleSleepToRecords, APPLE_SLEEP_VALUE, tryCreateAppleHealthBridge, tryCreateBiometricsBridge, UNSTAGED_SLEEP_EFFICIENCY } from '@ak/biometrics';
import { biometricsCopy, providerForPlatform } from '../../src/state/biometricsCopy';
import { biometricsProviderFor } from '@ak/biometrics';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

const mockHealthKit = {
  available: true,
  requestStatus: 1,
  requestResult: true,
  samples: [],
  requests: [],
  queries: [],
  fail: false,
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
    if (mockHealthKit.fail) throw new Error('synthetic native failure');
    return mockHealthKit.samples;
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
  Object.assign(mockHealthKit, { available: true, requestStatus: 1, requestResult: true, samples: [], requests: [], queries: [], fail: false });
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

describe('bridge contract', () => {
  test('off iOS, and on iOS without Health data, there is no bridge', async () => {
    Platform.OS = 'android';
    expect(await tryCreateAppleHealthBridge()).toBeNull();
    Platform.OS = 'ios';
    mockHealthKit.available = false;
    expect(await tryCreateAppleHealthBridge()).toBeNull();
  });

  test('only sleep is requested; "answered" is not reported as granted', async () => {
    Platform.OS = 'ios';
    const bridge = await tryCreateAppleHealthBridge();
    expect(await bridge.hasGrantedPermissions()).toBe(false); // shouldRequest
    mockHealthKit.requestStatus = 2; // unnecessary: already answered
    expect(await bridge.hasGrantedPermissions()).toBe(true);
    expect(await bridge.requestPermissions()).toBe(true);
    for (const [, request] of mockHealthKit.requests) {
      expect(request).toEqual({ toRead: ['HKCategoryTypeIdentifierSleepAnalysis'] });
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
    const [identifier, options] = mockHealthKit.queries[0];
    expect(identifier).toBe('HKCategoryTypeIdentifierSleepAnalysis');
    expect(options.limit).toBeGreaterThan(0);
    expect(options.filter.date.endDate.getTime() - options.filter.date.startDate.getTime()).toBe(8 * 86400000);
    mockHealthKit.fail = true;
    expect(await bridge.readDaily(7)).toEqual([]);
    expect(await bridge.hasGrantedPermissions()).toBe(false);
    expect(await bridge.requestPermissions()).toBe(false);
  });

  test('the platform factory picks Apple Health on iOS and nothing on unsupported platforms', async () => {
    Platform.OS = 'ios';
    expect(await tryCreateBiometricsBridge()).not.toBeNull();
    Platform.OS = 'web';
    expect(await tryCreateBiometricsBridge()).toBeNull();
  });
});

test('the store writes iOS sleep and never writes HRV', async () => {
  Platform.OS = 'ios';
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  mockDrivers = new Map();
  mockRegistry = { version: 1, activeId: 'default', advancedToolsUnlocked: false,
    athletes: [{ id: 'default', name: 'Synthetic', dbName: 'athlete_kinetics.db', createdAtMs: 0 }] };
  useStore.setState({ status: 'booting', error: null, activeAthleteId: 'default', session: null, biometricsStatus: 'off' });
  useStore.getState().boot();
  for (let n = 0; n < 8; n += 1) await new Promise((resolve) => setImmediate(resolve));
  expect(useStore.getState().status).toBe('ready');
  const yesterday = new Date(Date.now() - 86400000);
  const start = new Date(yesterday.getTime() - 8 * 3600000);
  mockHealthKit.requestStatus = 2;
  mockHealthKit.samples = [{ startDate: start, endDate: yesterday, value: 4, sourceRevision: { source: { bundleIdentifier: 'w' } } }];
  await useStore.getState().connectBiometrics(await tryCreateAppleHealthBridge());
  expect(useStore.getState().biometricsStatus).toBe('ready');
  const db = mockDrivers.get('athlete_kinetics.db').raw;
  expect(db.prepare('SELECT in_bed_min, deep_min FROM sleep_daily').all()).toEqual([{ in_bed_min: 480, deep_min: 480 }]);
  expect(db.prepare('SELECT COUNT(*) AS c FROM hrv_daily').get().c).toBe(0);
  await useStore.getState().connectBiometrics(null);
});

test('iOS wording never claims access was granted and names where to change it', () => {
  for (const status of ['off', 'unavailable', 'idle', 'denied', 'ready']) {
    const copy = biometricsCopy('apple_health', status);
    expect(copy.title).toContain('APPLE HEALTH');
    expect(copy.hint).not.toMatch(/\bconnected\b|\bgranted\b|Health Connect/i);
    expect(copy.showHrvTip).toBe(false);
  }
  expect(biometricsCopy('apple_health', 'ready').hint).toMatch(/requested[\s\S]*Settings › Health[\s\S]*SDNN/);
  expect(biometricsCopy('health_connect', 'ready').hint).toMatch(/^Connected\./);
  for (const os of ['ios', 'android', 'web']) expect(providerForPlatform(os)).toBe(biometricsProviderFor(os));
});
