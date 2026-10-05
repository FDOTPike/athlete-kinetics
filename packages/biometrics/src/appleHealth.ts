/**
 * appleHealth.ts — read-only Apple Health adapter behind the same
 * BiometricsBridge contract as Health Connect.
 *
 * SIGNAL CONTRACT (what iOS does and does not feed the engine)
 *   - Sleep: read (HKCategoryTypeIdentifierSleepAnalysis), normalized below
 *     into the SAME SleepRecordLike shape aggregateDaily already consumes, so
 *     sleep_daily means the same thing on both platforms.
 *   - HRV: NOT read. HealthKit exposes HRV only as SDNN; the readiness model,
 *     hrv_daily.rmssd_ms and every stored baseline are RMSSD. SDNN is a
 *     different statistic, so storing it under rmssd_ms or normalizing it
 *     against RMSSD history would be wrong. iOS HRV stays unknown.
 *   - Resting HR: read (HKQuantityTypeIdentifierRestingHeartRate, unit
 *     count/min = beats per minute), one value per local date, and stored in
 *     resting_hr_daily (069) — its own table, so it needs no RMSSD beside it.
 *     It is kept in the athlete's measured days; it does not feed readiness
 *     (readiness never read resting HR on either platform).
 *   Only the two types actually used are requested.
 *
 * AUTHORIZATION SEMANTICS (HealthKit hides read decisions by design)
 *   HealthKit never reveals whether READ access was granted or denied: a
 *   completed request means "the person has answered", and an empty query can
 *   mean no data OR no access. So on iOS:
 *   - hasGrantedPermissions() is true only when the system says no request is
 *     needed any more (the person has already answered). It is NOT "granted".
 *   - requestPermissions() is true when the request completed (answered), never
 *     because access is assumed. It opens the system sheet only from the
 *     explicit user action the store routes here.
 *   - readDaily() returns [] for no data, no access or any error, per type:
 *     sleep can arrive without resting HR and the reverse. Neither absence is
 *     reported as a denial, and the store never deletes a stored day because
 *     a read came back empty.
 *   The ATHLETE screen words "ready" on iOS as "access requested; sleep and
 *   resting heart rate appear when Health shares them" — never "connected" or
 *   "granted".
 *
 * GRACEFUL DEGRADATION: the native module is required inside the factory, the
 * factory returns null off iOS or when Health data is unavailable (e.g. iPad
 * without Health), and every method swallows native errors.
 */
import { aggregateDaily, type DailyBiometrics, type RhrRecordLike, type SleepRecordLike, type SleepStageLike } from './aggregate';
import type { BiometricsBridge } from './healthConnect';

const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis';
const RESTING_HR = 'HKQuantityTypeIdentifierRestingHeartRate';
/** HealthKit's unit string for beats per minute. Requested explicitly, and any
 *  sample reporting another unit is dropped rather than converted. */
export const APPLE_RESTING_HR_UNIT = 'count/min';

/** HKCategoryValueSleepAnalysis raw values (asleepUnspecified == legacy asleep). */
export const APPLE_SLEEP_VALUE = {
  inBed: 0,
  asleepUnspecified: 1,
  awake: 2,
  asleepCore: 3,
  asleepDeep: 4,
  asleepREM: 5,
} as const;

/** androidx.health SleepStageType codes aggregateDaily understands. */
const STAGE_AWAKE = 1;
const STAGE_SLEEPING = 2; // asleep, stage unknown
const STAGE_LIGHT = 4;
const STAGE_DEEP = 5;
const STAGE_REM = 6;

const STAGE_FOR_VALUE: Readonly<Record<number, number>> = {
  [APPLE_SLEEP_VALUE.asleepUnspecified]: STAGE_SLEEPING,
  [APPLE_SLEEP_VALUE.awake]: STAGE_AWAKE,
  [APPLE_SLEEP_VALUE.asleepCore]: STAGE_LIGHT,
  [APPLE_SLEEP_VALUE.asleepDeep]: STAGE_DEEP,
  [APPLE_SLEEP_VALUE.asleepREM]: STAGE_REM,
};

/** The fields of a HealthKit category sample this adapter reads. */
export interface AppleSleepSampleLike {
  readonly startDate: Date | string;
  readonly endDate: Date | string;
  readonly value: number;
  /** Bundle identifier of the writing source (Watch, iPhone, a third-party app). */
  readonly sourceId: string;
}

/** Samples further apart than this belong to different sleep episodes (a nap
 *  is its own episode; aggregateDaily buckets each by its wake date). */
export const SLEEP_EPISODE_GAP_MS = 2 * 60 * 60 * 1000;

interface Interval { start: number; end: number }

const toMs = (value: Date | string): number => (value instanceof Date ? value.getTime() : Date.parse(value));

/** Union of possibly-overlapping intervals, sorted. */
function union(intervals: readonly Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.end - b.end);
  const out: Interval[] = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last !== undefined && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else out.push({ ...iv });
  }
  return out;
}

/** Remove from `a` everything covered by `cover` (both unions). */
function subtract(a: readonly Interval[], cover: readonly Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const iv of a) {
    let pieces: Interval[] = [{ ...iv }];
    for (const c of cover) {
      pieces = pieces.flatMap((p) => {
        if (c.end <= p.start || c.start >= p.end) return [p];
        const kept: Interval[] = [];
        if (c.start > p.start) kept.push({ start: p.start, end: c.start });
        if (c.end < p.end) kept.push({ start: c.end, end: p.end });
        return kept;
      });
    }
    out.push(...pieces);
  }
  return out;
}

const minutes = (ivs: readonly Interval[]): number => ivs.reduce((sum, iv) => sum + (iv.end - iv.start), 0) / 60_000;

/**
 * Normalize raw HealthKit sleep samples into SleepRecordLike episodes.
 *
 * - Several apps and devices can record the same night; summing them would
 *   double-count. Per episode, ONE source is used: the one with the most
 *   staged asleep time (typically the Watch), ties broken by total recorded
 *   time and then source id, so the choice is deterministic.
 * - Within that source, overlapping samples are unioned per class, and stages
 *   are resolved by precedence (deep > REM > core > unspecified asleep >
 *   awake) so no minute is counted twice.
 * - An episode with only "in bed" samples carries no stages, so aggregateDaily
 *   applies its conservative unstaged-efficiency estimate. An episode with
 *   known stages keeps them all, so an awake-only night is 0 asleep minutes,
 *   never an estimate.
 * - Malformed, zero-length, inverted or > 24 h samples are dropped.
 */
export function appleSleepToRecords(samples: readonly AppleSleepSampleLike[]): SleepRecordLike[] {
  const clean = samples
    .map((s) => ({ start: toMs(s.startDate), end: toMs(s.endDate), value: s.value, sourceId: String(s.sourceId ?? '') }))
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start
      && s.end - s.start <= 24 * 60 * 60 * 1000
      && (s.value === APPLE_SLEEP_VALUE.inBed || STAGE_FOR_VALUE[s.value] !== undefined))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  // Episodes across ALL sources, so the source choice is per night.
  const episodes: (typeof clean)[] = [];
  let episodeEnd = -Infinity;
  for (const s of clean) {
    if (episodes.length === 0 || s.start - episodeEnd > SLEEP_EPISODE_GAP_MS) episodes.push([]);
    episodes[episodes.length - 1]!.push(s);
    episodeEnd = Math.max(episodeEnd, s.end);
  }

  const records: SleepRecordLike[] = [];
  for (const episode of episodes) {
    const bySource = new Map<string, typeof clean>();
    for (const s of episode) bySource.set(s.sourceId, [...(bySource.get(s.sourceId) ?? []), s]);
    const ranked = [...bySource.entries()].map(([sourceId, list]) => {
      const staged = union(list.filter((s) => s.value >= APPLE_SLEEP_VALUE.asleepCore).map(({ start, end }) => ({ start, end })));
      const all = union(list.map(({ start, end }) => ({ start, end })));
      return { sourceId, list, stagedMin: minutes(staged), totalMin: minutes(all) };
    }).sort((a, b) => b.stagedMin - a.stagedMin || b.totalMin - a.totalMin || (a.sourceId < b.sourceId ? -1 : 1));
    const chosen = ranked[0]!.list;

    const intervalsFor = (value: number) => union(chosen.filter((s) => s.value === value).map(({ start, end }) => ({ start, end })));
    let covered: Interval[] = [];
    const stages: SleepStageLike[] = [];
    for (const value of [APPLE_SLEEP_VALUE.asleepDeep, APPLE_SLEEP_VALUE.asleepREM, APPLE_SLEEP_VALUE.asleepCore,
      APPLE_SLEEP_VALUE.asleepUnspecified, APPLE_SLEEP_VALUE.awake]) {
      const own = union(subtract(intervalsFor(value), covered));
      for (const iv of own) {
        stages.push({ startTime: new Date(iv.start).toISOString(), endTime: new Date(iv.end).toISOString(), stage: STAGE_FOR_VALUE[value]! });
      }
      covered = union([...covered, ...own]);
    }
    const start = Math.min(...chosen.map((s) => s.start));
    const end = Math.max(...chosen.map((s) => s.end));
    stages.sort((a, b) => (a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0));
    records.push({
      startTime: new Date(start).toISOString(),
      endTime: new Date(end).toISOString(),
      // Any known stage — awake included — is real information and is kept:
      // an awake-only night counts 0 asleep minutes, never an estimate. Only
      // an episode with no stage at all (in-bed samples only) is unstaged.
      ...(stages.length > 0 ? { stages } : {}),
    });
  }
  return records;
}

const pad = (n: number): string => String(n).padStart(2, '0');
const localDateOf = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** The fields of a HealthKit quantity sample this adapter reads. */
export interface AppleQuantitySampleLike {
  readonly startDate: Date | string;
  readonly endDate: Date | string;
  readonly quantity: number;
  /** The unit the quantity is expressed in; must be count/min when present. */
  readonly unit?: string;
  readonly sourceId: string;
}

/**
 * Normalize raw HealthKit resting-heart-rate samples into one record per local
 * date (the date the sample STARTS on — HealthKit's daily resting HR spans the
 * day it describes).
 *
 * - Several sources can write resting HR for the same day (a Watch and another
 *   app); their values are not mixed. Per date ONE source is used: the one
 *   with the most samples that day, ties broken by source id, so the choice is
 *   deterministic. Its samples for that date are averaged by aggregateDaily.
 * - A sample in any unit other than count/min, a non-finite value, a value
 *   outside the stored 20..150 bpm domain, or an unreadable date is dropped.
 */
export function appleRestingHrToRecords(samples: readonly AppleQuantitySampleLike[]): RhrRecordLike[] {
  const clean = samples
    .map((s) => ({ start: toMs(s.startDate), quantity: s.quantity, unit: s.unit, sourceId: String(s.sourceId ?? '') }))
    .filter((s) => Number.isFinite(s.start) && typeof s.quantity === 'number' && Number.isFinite(s.quantity)
      && s.quantity >= 20 && s.quantity <= 150
      && (s.unit === undefined || s.unit === APPLE_RESTING_HR_UNIT));
  const byDate = new Map<string, Map<string, typeof clean>>();
  for (const s of clean) {
    const date = localDateOf(new Date(s.start).toISOString());
    const sources = byDate.get(date) ?? new Map<string, typeof clean>();
    sources.set(s.sourceId, [...(sources.get(s.sourceId) ?? []), s]);
    byDate.set(date, sources);
  }
  const records: RhrRecordLike[] = [];
  for (const sources of byDate.values()) {
    const [, chosen] = [...sources.entries()]
      .sort(([a, la], [b, lb]) => lb.length - la.length || (a < b ? -1 : a > b ? 1 : 0))[0]!;
    for (const s of chosen) records.push({ time: new Date(s.start).toISOString(), beatsPerMinute: s.quantity });
  }
  return records;
}

/** Pure: Apple sleep and resting-HR samples -> the same DailyBiometrics rows
 *  Android yields. rmssdMs is always null on iOS (see the signal contract). */
export function appleHealthDaily(
  sleepSamples: readonly AppleSleepSampleLike[],
  restingHrSamples: readonly AppleQuantitySampleLike[],
): DailyBiometrics[] {
  return aggregateDaily([], appleRestingHrToRecords(restingHrSamples), appleSleepToRecords(sleepSamples), localDateOf);
}

/** Pure: sleep samples only (restingHrBpm null). */
export function appleSleepDaily(samples: readonly AppleSleepSampleLike[]): DailyBiometrics[] {
  return appleHealthDaily(samples, []);
}

type AppleSourceRevisionLike = { sourceRevision?: { source?: { bundleIdentifier?: string } } };
const sourceIdOf = (s: AppleSourceRevisionLike): string => s.sourceRevision?.source?.bundleIdentifier ?? 'unknown';

/** Minimal structural view of @kingstinct/react-native-healthkit (v16). */
interface HealthKitModuleLike {
  isHealthDataAvailable(): boolean;
  getRequestStatusForAuthorization(request: { toRead: readonly string[] }): Promise<number>;
  requestAuthorization(request: { toRead: readonly string[] }): Promise<boolean>;
  queryCategorySamples(
    identifier: string,
    options: { limit: number; ascending?: boolean; filter?: { date?: { startDate?: Date; endDate?: Date } } },
  ): Promise<readonly ({ startDate: Date; endDate: Date; value: number } & AppleSourceRevisionLike)[]>;
  queryQuantitySamples(
    identifier: string,
    options: { limit: number; ascending?: boolean; unit?: string; filter?: { date?: { startDate?: Date; endDate?: Date } } },
  ): Promise<readonly ({ startDate: Date; endDate: Date; quantity: number; unit?: string } & AppleSourceRevisionLike)[]>;
}

/** HKAuthorizationRequestStatus.unnecessary: the person has already answered. */
const REQUEST_UNNECESSARY = 2;
const READ_TYPES = [SLEEP, RESTING_HR] as const;
/** Upper bound on samples per read; a week of multi-device sleep or resting HR is far below it. */
const SAMPLE_LIMIT = 5000;

export async function tryCreateAppleHealthBridge(): Promise<BiometricsBridge | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rn = require('react-native') as { Platform: { OS: string } };
    if (rn.Platform.OS !== 'ios') return null;
    const hk = require('@kingstinct/react-native-healthkit') as HealthKitModuleLike;
    if (!hk.isHealthDataAvailable()) return null; // e.g. iPad without Health
    return {
      provider: 'apple_health',
      hasGrantedPermissions: async (): Promise<boolean> => {
        try {
          return (await hk.getRequestStatusForAuthorization({ toRead: READ_TYPES })) === REQUEST_UNNECESSARY;
        } catch {
          return false;
        }
      },
      requestPermissions: async (): Promise<boolean> => {
        try {
          // true = the request completed (answered). HealthKit does not say
          // whether reading was allowed; see AUTHORIZATION SEMANTICS.
          return await hk.requestAuthorization({ toRead: READ_TYPES });
        } catch {
          return false;
        }
      },
      readDaily: async (days: number): Promise<DailyBiometrics[]> => {
        try {
          const endDate = new Date();
          // One extra day so a night that started before the window but ends
          // inside it is read whole.
          const startDate = new Date(endDate.getTime() - (Math.max(1, days) + 1) * 86_400_000);
          const filter = { date: { startDate, endDate } };
          // Each type is read on its own: a failure (or no data, or no access —
          // HealthKit does not say which) for one never sinks the other.
          const [sleep, restingHr] = await Promise.all([
            hk.queryCategorySamples(SLEEP, { limit: SAMPLE_LIMIT, ascending: true, filter }).catch(() => []),
            hk.queryQuantitySamples(RESTING_HR, { limit: SAMPLE_LIMIT, ascending: true, unit: APPLE_RESTING_HR_UNIT, filter })
              .catch(() => []),
          ]);
          return appleHealthDaily(
            sleep.map((s) => ({ startDate: s.startDate, endDate: s.endDate, value: s.value, sourceId: sourceIdOf(s) })),
            restingHr.map((s) => ({ startDate: s.startDate, endDate: s.endDate, quantity: s.quantity, unit: s.unit, sourceId: sourceIdOf(s) })),
          );
        } catch {
          return [];
        }
      },
    };
  } catch {
    return null; // native module absent or failed to install: subjective-only mode
  }
}
