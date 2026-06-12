/**
 * aggregate.ts — PURE daily compaction of raw Health Connect records.
 *
 * The memory guardrail lives here: wearables emit minute-by-minute tick
 * arrays, the database stores ONE row per day per table. Everything in this
 * file is pure TypeScript with an injectable local-date function, so the
 * verify:biometrics gate exercises the EXACT production aggregation in Node
 * (the repo contract: every layer ships a runnable verifier).
 *
 * Native I/O (permissions, SDK availability, readRecords) lives in
 * healthConnect.ts and is deliberately thin.
 */

// Minimal shapes of the Health Connect records we consume — structural
// subsets of react-native-health-connect's record types, declared locally so
// this package typechecks with zero native dependencies.
export interface HrvRecordLike {
  time: string; // ISO timestamp
  heartRateVariabilityMillis: number;
}
export interface RhrRecordLike {
  time: string;
  beatsPerMinute: number;
}
export interface SleepStageLike {
  startTime: string;
  endTime: string;
  /** androidx.health SleepStageType constant. */
  stage: number;
}
export interface SleepRecordLike {
  startTime: string;
  endTime: string;
  stages?: readonly SleepStageLike[];
}

/** One compacted day — maps 1:1 onto hrv_daily / sleep_daily columns. */
export interface DailyBiometrics {
  date: string;
  rmssdMs: number | null;
  restingHrBpm: number | null;
  inBedMin: number | null;
  asleepMin: number | null;
  deepMin: number | null;
  remMin: number | null;
  lightMin: number | null;
}

// androidx.health SleepStageType values that count as NOT asleep.
const AWAKE_STAGES: ReadonlySet<number> = new Set([
  1, // AWAKE
  3, // OUT_OF_BED
  7, // AWAKE_IN_BED
]);
const STAGE_LIGHT = 4;
const STAGE_DEEP = 5;
const STAGE_REM = 6;

/** When a sleep session arrives with NO stage data, asleep time is estimated
 *  at the population-median efficiency rather than a flattering 100%. */
export const UNSTAGED_SLEEP_EFFICIENCY = 0.92;

const round1 = (x: number): number => Math.round(x * 10) / 10;
const minutesBetween = (aIso: string, bIso: string): number => {
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return (b - a) / 60_000;
};

interface DayAccumulator {
  hrvSum: number; hrvN: number;
  rhrSum: number; rhrN: number;
  inBed: number; asleep: number; deep: number; rem: number; light: number;
  hasSleep: boolean;
}
const freshDay = (): DayAccumulator => ({
  hrvSum: 0, hrvN: 0, rhrSum: 0, rhrN: 0,
  inBed: 0, asleep: 0, deep: 0, rem: 0, light: 0, hasSleep: false,
});

/**
 * Compact raw records into one row per local date. Never throws: malformed
 * or out-of-range records are skipped, not propagated.
 *
 * Bucketing: point samples (HRV/RHR) land on the local date of their
 * timestamp; a sleep session lands on the local date its END falls on (the
 * wake morning — matching sleep_daily's documented semantics).
 */
export function aggregateDaily(
  hrv: readonly HrvRecordLike[],
  rhr: readonly RhrRecordLike[],
  sleep: readonly SleepRecordLike[],
  localDateOf: (iso: string) => string,
): DailyBiometrics[] {
  const days = new Map<string, DayAccumulator>();
  const dayOf = (iso: string): DayAccumulator | null => {
    let date: string;
    try {
      date = localDateOf(iso);
    } catch {
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    let acc = days.get(date);
    if (acc === undefined) {
      acc = freshDay();
      days.set(date, acc);
    }
    return acc;
  };

  for (const r of hrv ?? []) {
    if (typeof r?.heartRateVariabilityMillis !== 'number') continue;
    const v = r.heartRateVariabilityMillis;
    if (!Number.isFinite(v) || v <= 0 || v > 500) continue; // physiology bounds
    const acc = dayOf(r.time);
    if (acc === null) continue;
    acc.hrvSum += v;
    acc.hrvN += 1;
  }

  for (const r of rhr ?? []) {
    if (typeof r?.beatsPerMinute !== 'number') continue;
    const v = r.beatsPerMinute;
    if (!Number.isFinite(v) || v < 20 || v > 150) continue; // hrv_daily CHECK domain
    const acc = dayOf(r.time);
    if (acc === null) continue;
    acc.rhrSum += v;
    acc.rhrN += 1;
  }

  for (const s of sleep ?? []) {
    if (typeof s?.startTime !== 'string' || typeof s?.endTime !== 'string') continue;
    const duration = minutesBetween(s.startTime, s.endTime);
    if (duration <= 0 || duration > 24 * 60) continue;
    const acc = dayOf(s.endTime); // wake-morning bucketing
    if (acc === null) continue;
    acc.hasSleep = true;
    acc.inBed += duration;
    const stages = s.stages ?? [];
    if (stages.length > 0) {
      for (const st of stages) {
        const stMin = minutesBetween(st.startTime, st.endTime);
        if (stMin <= 0) continue;
        if (AWAKE_STAGES.has(st.stage)) continue;
        acc.asleep += stMin;
        if (st.stage === STAGE_DEEP) acc.deep += stMin;
        else if (st.stage === STAGE_REM) acc.rem += stMin;
        else if (st.stage === STAGE_LIGHT) acc.light += stMin;
      }
    } else {
      acc.asleep += duration * UNSTAGED_SLEEP_EFFICIENCY;
    }
  }

  const out: DailyBiometrics[] = [];
  for (const [date, acc] of [...days.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const rmssd = acc.hrvN > 0 ? round1(acc.hrvSum / acc.hrvN) : null;
    const restingHr = acc.rhrN > 0 ? round1(acc.rhrSum / acc.rhrN) : null;
    const inBed = acc.hasSleep && acc.inBed > 0 ? round1(acc.inBed) : null;
    // sleep_daily's generated efficiency CHECKs <= 100: clamp asleep to inBed.
    const asleep = inBed !== null ? round1(Math.min(acc.asleep, acc.inBed)) : null;
    if (rmssd === null && restingHr === null && inBed === null) continue;
    out.push({
      date,
      rmssdMs: rmssd,
      restingHrBpm: restingHr,
      inBedMin: inBed,
      asleepMin: asleep,
      deepMin: inBed !== null && acc.deep > 0 ? round1(acc.deep) : null,
      remMin: inBed !== null && acc.rem > 0 ? round1(acc.rem) : null,
      lightMin: inBed !== null && acc.light > 0 ? round1(acc.light) : null,
    });
  }
  return out;
}
