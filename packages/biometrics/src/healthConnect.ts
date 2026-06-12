/**
 * healthConnect.ts — thin native adapter over react-native-health-connect.
 *
 * GRACEFUL DEGRADATION IS THE CONTRACT (machine-verified at the aggregate
 * layer; enforced by construction here):
 *   - the native module is require()d INSIDE tryCreate, never at module
 *     scope — a missing/failed native lib returns null instead of crashing
 *     bundle init (the exact failure mode that produced the Phase 7 device
 *     crash via an import side effect);
 *   - Health Connect APK absent, SDK unavailable, permission denied, or any
 *     read error → null / false / [] — the app falls back to subjective-
 *     triage-only routing without a single uncaught throw.
 *
 * All numeric work is delegated to the pure aggregateDaily (aggregate.ts).
 */
import {
  aggregateDaily,
  type DailyBiometrics,
  type HrvRecordLike,
  type RhrRecordLike,
  type SleepRecordLike,
} from './aggregate';

/** Minimal structural view of react-native-health-connect (local interface:
 *  typechecking must not depend on the native package's types). */
interface HealthConnectModuleLike {
  initialize(): Promise<boolean>;
  getSdkStatus(): Promise<number>;
  requestPermission(perms: { accessType: 'read'; recordType: string }[]): Promise<unknown[]>;
  getGrantedPermissions(): Promise<{ recordType?: string }[]>;
  readRecords(
    recordType: string,
    options: {
      timeRangeFilter: { operator: 'between'; startTime: string; endTime: string };
    },
  ): Promise<{ records: unknown[] }>;
}

/** androidx SdkAvailabilityStatus.SDK_AVAILABLE */
const SDK_AVAILABLE = 3;

const READ_PERMISSIONS: { accessType: 'read'; recordType: string }[] = [
  { accessType: 'read', recordType: 'HeartRateVariabilityRmssd' },
  { accessType: 'read', recordType: 'RestingHeartRate' },
  { accessType: 'read', recordType: 'SleepSession' },
];

export interface BiometricsBridge {
  /** Ask for read permissions; true when at least one was granted. */
  requestPermissions(): Promise<boolean>;
  /** Compacted one-row-per-day biometrics for the trailing window.
   *  Empty array on ANY failure — never throws. */
  readDaily(days: number): Promise<DailyBiometrics[]>;
}

const pad = (n: number): string => String(n).padStart(2, '0');
/** Device-local calendar date of an ISO timestamp. */
const localDateOf = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Build the bridge, or null when Health Connect cannot serve this device.
 * Callers treat null as "biometrics unavailable" — nothing else changes.
 */
export async function tryCreateHealthConnectBridge(): Promise<BiometricsBridge | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rn = require('react-native') as { Platform: { OS: string } };
    if (rn.Platform.OS !== 'android') return null;
    const hc = require('react-native-health-connect') as HealthConnectModuleLike;
    if ((await hc.getSdkStatus()) !== SDK_AVAILABLE) return null; // APK missing/old
    if (!(await hc.initialize())) return null;

    return {
      requestPermissions: async (): Promise<boolean> => {
        try {
          await hc.requestPermission(READ_PERMISSIONS);
          const granted = await hc.getGrantedPermissions();
          return granted.length > 0;
        } catch {
          return false;
        }
      },
      readDaily: async (days: number): Promise<DailyBiometrics[]> => {
        try {
          const end = new Date();
          const start = new Date(end.getTime() - Math.max(1, days) * 86_400_000);
          const filter = {
            timeRangeFilter: {
              operator: 'between' as const,
              startTime: start.toISOString(),
              endTime: end.toISOString(),
            },
          };
          const read = async (type: string): Promise<unknown[]> => {
            try {
              return (await hc.readRecords(type, filter)).records;
            } catch {
              return []; // a missing record type must not sink the others
            }
          };
          const [hrv, rhr, sleep] = await Promise.all([
            read('HeartRateVariabilityRmssd'),
            read('RestingHeartRate'),
            read('SleepSession'),
          ]);
          return aggregateDaily(
            hrv as HrvRecordLike[],
            rhr as RhrRecordLike[],
            sleep as SleepRecordLike[],
            localDateOf,
          );
        } catch {
          return [];
        }
      },
    };
  } catch {
    return null; // native module absent or init exploded: subjective-only mode
  }
}
