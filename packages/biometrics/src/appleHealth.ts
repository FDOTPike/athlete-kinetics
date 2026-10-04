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
 *   - Resting HR: NOT requested. hrv_daily can only hold resting HR beside an
 *     RMSSD value (the existing store contract), so on iOS it could never be
 *     persisted; asking for it would request data the app does not use.
 *   Only the one type actually used is requested.
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
 *   - readDaily() returns [] for no data, no access or any error.
 *   The ATHLETE screen words "ready" on iOS as "access requested; sleep appears
 *   when Health shares it" — never "connected" or "granted".
 *
 * GRACEFUL DEGRADATION: the native module is required inside the factory, the
 * factory returns null off iOS or when Health data is unavailable (e.g. iPad
 * without Health), and every method swallows native errors.
 */
import { aggregateDaily, type DailyBiometrics, type SleepRecordLike, type SleepStageLike } from './aggregate';
import type { BiometricsBridge } from './healthConnect';

const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis';

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
 *   applies its conservative unstaged-efficiency estimate.
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
    const hasAsleepStage = stages.some((st) => st.stage !== STAGE_AWAKE);
    records.push({
      startTime: new Date(start).toISOString(),
      endTime: new Date(end).toISOString(),
      // Only awake samples and no asleep stage: treat as unstaged in-bed time.
      ...(hasAsleepStage ? { stages } : {}),
    });
  }
  return records;
}

const pad = (n: number): string => String(n).padStart(2, '0');
const localDateOf = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Pure: Apple sleep samples -> the same DailyBiometrics rows Android yields
 *  (rmssdMs and restingHrBpm always null on iOS; see the signal contract). */
export function appleSleepDaily(samples: readonly AppleSleepSampleLike[]): DailyBiometrics[] {
  return aggregateDaily([], [], appleSleepToRecords(samples), localDateOf);
}

/** Minimal structural view of @kingstinct/react-native-healthkit (v16). */
interface HealthKitModuleLike {
  isHealthDataAvailable(): boolean;
  getRequestStatusForAuthorization(request: { toRead: readonly string[] }): Promise<number>;
  requestAuthorization(request: { toRead: readonly string[] }): Promise<boolean>;
  queryCategorySamples(
    identifier: string,
    options: { limit: number; ascending?: boolean; filter?: { date?: { startDate?: Date; endDate?: Date } } },
  ): Promise<readonly { startDate: Date; endDate: Date; value: number; sourceRevision?: { source?: { bundleIdentifier?: string } } }[]>;
}

/** HKAuthorizationRequestStatus.unnecessary: the person has already answered. */
const REQUEST_UNNECESSARY = 2;
const READ_TYPES = [SLEEP] as const;
/** Upper bound on samples per read; a week of multi-device sleep is far below it. */
const SAMPLE_LIMIT = 5000;

export async function tryCreateAppleHealthBridge(): Promise<BiometricsBridge | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rn = require('react-native') as { Platform: { OS: string } };
    if (rn.Platform.OS !== 'ios') return null;
    const hk = require('@kingstinct/react-native-healthkit') as HealthKitModuleLike;
    if (!hk.isHealthDataAvailable()) return null; // e.g. iPad without Health
    return {
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
          const samples = await hk.queryCategorySamples(SLEEP, {
            limit: SAMPLE_LIMIT, ascending: true, filter: { date: { startDate, endDate } },
          });
          return appleSleepDaily(samples.map((s) => ({
            startDate: s.startDate,
            endDate: s.endDate,
            value: s.value,
            sourceId: s.sourceRevision?.source?.bundleIdentifier ?? 'unknown',
          })));
        } catch {
          return [];
        }
      },
    };
  } catch {
    return null; // native module absent or failed to install: subjective-only mode
  }
}
