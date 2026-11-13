import { isSportId, type SportId } from './sportProfile';
import { TRAINING_AGES, type TrainingAge } from './types';
import { SESSION_FEEL_REASONS, type SessionFeelReason } from './sessionFeel';

const BRIDGE_REASONS = [
  'soreness',
  'pain',
  'poor_sleep',
  'low_fuel',
  'stress',
  'great_recovery',
  'high_drive',
  'other',
] as const;
type BridgeReason = (typeof BRIDGE_REASONS)[number];

const FALL_STATES = [
  'IDLE',
  'IMPACT_ARMED',
  'TILT_UNLOADED',
  'FALL_WARNING',
  'RECOVERED',
  'FAULT_RESET',
] as const;

export type KineStrikeFoot = 'L' | 'R' | 'BOTH' | 'UNKNOWN';
export type KineStrikeFallState = (typeof FALL_STATES)[number];
type FallState = KineStrikeFallState;

export type SessionFeelReasonCode = SessionFeelReason | 'soreness';
export type KineStrikeSubChipCode = 'medial_shift' | 'lateral_guard' | 'gct_drift';

/** Owner-ratified bridge thresholds (WO-KS-BRIDGE-01 / WO-KS-BRIDGE-02, 2026-11-10). */
export const KINESTRIKE_BRIDGE_DEFAULTS = {
  gctDeltaPctWarn: 6.0,
  zHrvFatigueMax: -0.50,
  copXMedialShiftWarn: 0.45,
  copXLateralGuardWarn: -0.35,
  peakLoadCvWarn: 0.18,
} as const;

/** Owner-ratified sub-chip copy (WO-KS-BRIDGE-01 / WO-KS-BRIDGE-02, 2026-11-10). */
export const KINESTRIKE_SUBCHIP_LABEL: Record<KineStrikeSubChipCode, string> = {
  medial_shift: 'Forefoot medial shift (Big-Toe bias)',
  lateral_guard: 'Forefoot lateral shift (Small-Toe guarding)',
  gct_drift: 'Ground contact time drift',
};

export interface KineStrikeTelemetrySummary {
  ks_foot: KineStrikeFoot;
  ks_strike_count: number;
  ks_gct_mean_ms: number | null;
  /** Null when no valid comparable reference is supplied. */
  ks_gct_delta_pct: number | null;
  /** Synthetic firmware indices, not calibrated force or pressure. */
  ks_peak_load_mean: number | null;
  ks_peak_load_cv: number | null;
  ks_heel_share_mean: number | null;
  ks_medial_share_mean: number | null;
  ks_lateral_share_mean: number | null;
  ks_toe_share_mean: number | null;
  /** Dimensionless firmware forefoot balance proxy, not spatial CoP. */
  ks_cop_x_mean: number | null;
  ks_impact_peak_g_max: number | null;
  ks_cod_count: number;
  ks_fall_warning_count: number;
  /** IDLE on an empty stream means no observed transition, not verified safety. */
  ks_fall_last_state: FallState;
}

/** Caller supplies provenance, foot, profile and baseline; no database or UI effects.
 * The requested seven-day HRV field is not the database's 28-day hrv_z.
 */
export interface KineStrikeLegacyBridgeV1 extends KineStrikeTelemetrySummary {
  training_age: TrainingAge;
  sport_id: SportId;
  ks_foot: KineStrikeFoot;
  z_hrv_7d: number | null;
  rhr_delta_bpm: number | null;
  sleep_hours: number | null;
  sleep_Midpoint_dev_min: number | null;
  acwr_4w: number | null;
  days_since_high_cns: number | null;
}

/** The flat 1D bridge contract; legacy fields remain separately supported. */
export interface KineStrikeBiometricBridgeV1 extends KineStrikeTelemetrySummary {
  schema_version: 1;
  athlete_id: string;
  captured_at_iso: string;
  experience_prefix: TrainingAge;
  primary_sport_id: SportId;
  secondary_sport_id: SportId | null;
  tertiary_sport_id: SportId | null;
  session_sport_tag: SportId;
  ks_foot: KineStrikeFoot;
  z_hrv_7d: number | null;
  rhr_delta_bpm: number | null;
  sleep_hours: number | null;
  sleep_Midpoint_dev_min: number | null;
  acwr_4w: number | null;
  days_since_high_cns: number | null;
  readiness_score: number | null;
  readiness_band: string | null;
  suggested_feel_score: number | null;
  suggested_reason_code_1: BridgeReason | null;
  suggested_reason_code_2: BridgeReason | null;
  suggested_kinestrike_subchip_code: KineStrikeSubChipCode | null;
}

// Domain constraints, not readiness thresholds. Signed deviations remain signed.
const NUMBER_BOUNDS = {
  z_hrv_7d: [-Infinity, Infinity],
  rhr_delta_bpm: [-Infinity, Infinity],
  sleep_hours: [0, Infinity],
  sleep_Midpoint_dev_min: [-Infinity, Infinity],
  acwr_4w: [0, Infinity],
  days_since_high_cns: [0, Infinity],
  ks_gct_mean_ms: [0, Infinity],
  ks_gct_delta_pct: [-Infinity, Infinity],
  ks_peak_load_mean: [0, Infinity],
  ks_peak_load_cv: [0, Infinity],
  ks_heel_share_mean: [0, 1.001],
  ks_medial_share_mean: [0, 1.001],
  ks_lateral_share_mean: [0, 1.001],
  ks_toe_share_mean: [0, 1.001],
  ks_cop_x_mean: [-1.001, 1.001],
  ks_impact_peak_g_max: [0, Infinity],
} as const;

const COUNT_FIELDS = ['ks_strike_count', 'ks_cod_count', 'ks_fall_warning_count'] as const;
type NumericField = keyof typeof NUMBER_BOUNDS | (typeof COUNT_FIELDS)[number];

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const uint = (v: number): boolean => Number.isSafeInteger(v) && v >= 0;
const between = (v: number, lo: number, hi: number): boolean => v >= lo && v <= hi;
const member = (values: readonly string[], v: unknown): v is string =>
  typeof v === 'string' && values.includes(v);

export function isKineStrikeBiometricBridgeV1(
  value: unknown,
): value is KineStrikeBiometricBridgeV1 | KineStrikeLegacyBridgeV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const common = [...Object.keys(NUMBER_BOUNDS), ...COUNT_FIELDS, 'ks_foot', 'ks_fall_last_state'];
  const legacy = Object.prototype.hasOwnProperty.call(v, 'training_age');
  const modern = [
    'schema_version',
    'athlete_id',
    'captured_at_iso',
    'experience_prefix',
    'primary_sport_id',
    'secondary_sport_id',
    'tertiary_sport_id',
    'session_sport_tag',
    'readiness_score',
    'readiness_band',
    'suggested_feel_score',
    'suggested_reason_code_1',
    'suggested_reason_code_2',
    'suggested_kinestrike_subchip_code',
  ];
  const keys = [...common, ...(legacy ? ['training_age', 'sport_id'] : modern)];
  if (
    Object.keys(v).length !== keys.length ||
    keys.some((k) => !Object.prototype.hasOwnProperty.call(v, k))
  ) {
    return false;
  }
  if (!member(['L', 'R', 'BOTH', 'UNKNOWN'], v.ks_foot) || !member(FALL_STATES, v.ks_fall_last_state)) {
    return false;
  }
  if (legacy) {
    if (!isSportId(v.sport_id) || !member(TRAINING_AGES, v.training_age)) return false;
  } else {
    if (
      v.schema_version !== 1 ||
      typeof v.athlete_id !== 'string' ||
      !v.athlete_id ||
      typeof v.captured_at_iso !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v.captured_at_iso) ||
      !Number.isFinite(Date.parse(v.captured_at_iso)) ||
      !member(TRAINING_AGES, v.experience_prefix) ||
      !isSportId(v.primary_sport_id) ||
      !isSportId(v.session_sport_tag) ||
      (v.secondary_sport_id !== null && !isSportId(v.secondary_sport_id)) ||
      (v.tertiary_sport_id !== null && !isSportId(v.tertiary_sport_id))
    ) {
      return false;
    }
    if (
      ['readiness_score', 'suggested_feel_score'].some((k) => v[k] !== null && !finite(v[k])) ||
      (v.readiness_band !== null && typeof v.readiness_band !== 'string') ||
      (v.suggested_kinestrike_subchip_code !== null &&
        !member(Object.keys(KINESTRIKE_SUBCHIP_LABEL), v.suggested_kinestrike_subchip_code)) ||
      ['suggested_reason_code_1', 'suggested_reason_code_2'].some(
        (k) => v[k] !== null && !member(BRIDGE_REASONS, v[k]),
      )
    ) {
      return false;
    }
  }
  for (const [key, [lo, hi]] of Object.entries(NUMBER_BOUNDS)) {
    if (v[key] !== null && (!finite(v[key]) || !between(v[key] as number, lo, hi))) return false;
  }
  return COUNT_FIELDS.every((k) => finite(v[k]) && uint(v[k] as number));
}

export function verifyNmeaChecksum(raw: string): { valid: boolean; payload: string } {
  const match = /^([\x20-\x29\x2B-\x7E]+)\*([0-9A-Fa-f]{2})$/.exec(raw.replace(/[\r\n]+$/, ''));
  if (!match) return { valid: false, payload: '' };
  let checksum = 0;
  for (const c of match[1]) checksum ^= c.charCodeAt(0);
  return { valid: checksum === parseInt(match[2], 16), payload: match[1] };
}

function fields(raw: string): string[] | null {
  const result = verifyNmeaChecksum(raw);
  return result.valid ? result.payload.split(',') : null;
}

function numbers(parts: string[], indices: number[]): number[] | null {
  const result: number[] = [];
  for (const i of indices) {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(parts[i])) return null;
    const v = Number(parts[i]);
    if (!Number.isFinite(v)) return null;
    result.push(v);
  }
  return result;
}

// Weighted form avoids overflowing a finite positive sum.
function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((m, v, i) => m * (i / (i + 1)) + v / (i + 1), 0);
}

/** One boot/session per call. E/B join on sequence and timestamps; duplicate records
 * are ignored. Unmatched B lines cannot create strikes. Invalid lines never mutate
 * accepted records. Caller must separate feet/boots and retain acquisition metadata.
 */
export function parseKineStrikeSessionLog(
  nmeaLines: readonly string[],
  options?: { defaultFoot?: 'L' | 'R' | 'UNKNOWN'; baselineGctMs?: number },
): KineStrikeTelemetrySummary {
  if (options?.defaultFoot !== undefined && !member(['L', 'R', 'UNKNOWN'], options.defaultFoot)) {
    throw new Error('Invalid default foot');
  }
  const feet = new Set<'L' | 'R'>();
  const events = new Map<string, number[]>();
  const balances = new Map<string, number[]>();
  const seen = new Set<string>();
  let impact: number | null = null;
  let turns = 0;
  let warnings = 0;
  let lastState: FallState = 'IDLE';
  let lastWarningTime = -1;

  for (const raw of nmeaLines) {
    const p = fields(raw);
    if (!p) continue;
    const identity = p.join(',');
    if (seen.has(identity)) continue;

    if (p[0] === 'H' && p.length >= 2) {
      for (const token of p.slice(1)) {
        if (token === 'foot=L') feet.add('L');
        if (token === 'foot=R') feet.add('R');
      }
    } else if (p[0] === 'M' && p.length === 11) {
      const v = numbers(p, [1, 3, 4, 5, 6, 7, 8, 9]);
      if (!v || !uint(v[0]) || !member(['L', 'R', 'W'], p[2]) || (p[10] !== '' && !numbers(p, [10]))) {
        continue;
      }
    } else if (p[0] === 'E' && p.length === 10) {
      const v = numbers(p, [1, 3, 4, 5, 6, 7, 8, 9]);
      if (!v || !member(['L', 'R'], p[2])) continue;
      const [seq, start, end, duration, peak, total, heel, ratio] = v;
      if (
        !uint(seq) ||
        seq === 0 ||
        !uint(start) ||
        !uint(end) ||
        end < start ||
        !uint(duration) ||
        peak < 0 ||
        total < 0 ||
        heel < 0 ||
        heel > total ||
        !between(ratio, 0, 1)
      ) {
        continue;
      }
      const key = `${seq},${start},${end}`;
      if (!events.has(key)) events.set(key, [seq, start, end, duration, peak, ratio]);
    } else if (p[0] === 'E' && p.length === 7) {
      const v = numbers(p, [1, 2, 3, 4, 5, 6]);
      if (!v) continue;
      const [seq, start, end, duration, peak, heel] = v;
      if (
        !uint(seq) ||
        seq === 0 ||
        !uint(start) ||
        !uint(end) ||
        end < start ||
        !uint(duration) ||
        peak < 0 ||
        !between(heel, 0, 1)
      ) {
        continue;
      }
      const key = `${seq},${start},${end}`;
      if (!events.has(key)) events.set(key, [seq, start, end, end - start, peak, heel]);
    } else if (p[0] === 'B' && p.length === 9) {
      const v = numbers(p, [1, 2, 3, 4, 5, 6, 7, 8]);
      if (!v) continue;
      const [seq, start, end, ...shares] = v;
      if (
        !uint(seq) ||
        seq === 0 ||
        !uint(start) ||
        !uint(end) ||
        end < start ||
        !shares.slice(0, 4).every((x) => between(x, 0, 1.001)) ||
        !between(shares[4], -1.001, 1.001) ||
        (shares.slice(0, 4).some((x) => x !== 0) &&
          !between(
            shares.slice(0, 4).reduce((a, b) => a + b, 0),
            0.95,
            1.05,
          ))
      ) {
        continue;
      }
      const key = `${seq},${start},${end}`;
      if (!balances.has(key)) balances.set(key, shares);
    } else if (p[0] === 'K' && p.length === 6 && p[3] === 'COD') {
      const v = numbers(p, [1, 4, 5]);
      if (!v || !uint(v[0]) || !member(['L', 'R'], p[2]) || v[2] < 0) continue;
      turns++;
    } else if (p[0] === 'K' && p.length === 5) {
      const v = numbers(p, [1, 3, 4]);
      if (!v || !uint(v[0]) || !member(['L', 'R', 'W'], p[2]) || v[1] < 0 || !uint(v[2])) continue;
      impact = impact === null ? v[1] : Math.max(impact, v[1]);
    } else if (p[0] === 'C' && p.length === 5) {
      const v = numbers(p, [1, 2, 4]);
      if (!v || !uint(v[0]) || !member(['L', 'R'], p[3]) || v[2] < 0) continue;
      turns++;
    } else if (p[0] === 'W' && p.length === 6) {
      const v = numbers(p, [1, 4, 5]);
      if (
        !v ||
        !uint(v[0]) ||
        !member(['L', 'R', 'W'], p[2]) ||
        !member(FALL_STATES, p[3]) ||
        v[1] < 0 ||
        !between(v[2], 0, 180)
      ) {
        continue;
      }
      impact = impact === null ? v[1] : Math.max(impact, v[1]);
      if (p[3] === 'FALL_WARNING') warnings++;
      if (v[0] >= lastWarningTime) {
        lastWarningTime = v[0];
        lastState = p[3] as FallState;
      }
    } else {
      continue;
    }

    if (
      (p[0] === 'W' || p[0] === 'K' || p[0] === 'M' || (p[0] === 'E' && p.length === 10)) &&
      (p[2] === 'L' || p[2] === 'R')
    ) {
      feet.add(p[2]);
    }
    seen.add(identity);
  }

  const strikes = [...events.values()];
  const matched = [...balances.entries()]
    .filter(([key]) => events.has(key))
    .map(([, v]) => v);
  const peaks = strikes.map((v) => v[4]);
  const peakMean = mean(peaks);
  let cv: number | null = null;
  if (peakMean !== null && peakMean > 0) {
    cv = Math.sqrt(mean(peaks.map((v) => (v / peakMean - 1) ** 2))!);
  }
  const gctMean = mean(strikes.map((v) => v[3]));
  const baseline = options?.baselineGctMs;
  const delta =
    gctMean !== null && finite(baseline) && baseline > 0
      ? ((gctMean - baseline) / baseline) * 100
      : null;

  return {
    ks_foot:
      feet.size === 2
        ? 'BOTH'
        : feet.has('L')
          ? 'L'
          : feet.has('R')
            ? 'R'
            : (options?.defaultFoot ?? 'UNKNOWN'),
    ks_strike_count: strikes.length,
    ks_gct_mean_ms: gctMean,
    ks_gct_delta_pct: delta !== null && Number.isFinite(delta) ? delta : null,
    ks_peak_load_mean: peakMean,
    ks_peak_load_cv: cv,
    ks_heel_share_mean: mean(matched.map((v) => v[0])),
    ks_medial_share_mean: mean(matched.map((v) => v[1])),
    ks_lateral_share_mean: mean(matched.map((v) => v[2])),
    ks_toe_share_mean: mean(matched.map((v) => v[3])),
    ks_cop_x_mean: mean(matched.map((v) => v[4])),
    ks_impact_peak_g_max: impact,
    ks_cod_count: turns,
    ks_fall_warning_count: warnings,
    ks_fall_last_state: lastState,
  };
}

/** Explicit caller policy only. Strict comparisons; missing measurements do not
 * match. Returns reason IDs for review, never records an athlete's answer.
 */
export type KineStrikeReasonRule = {
  field: NumericField;
  reason: SessionFeelReason;
} & ({ below: number; above?: never } | { above: number; below?: never });

export function mapKineStrikeSessionFeelReasons(
  value: KineStrikeLegacyBridgeV1,
  rules: readonly KineStrikeReasonRule[],
): SessionFeelReason[] {
  if (!isKineStrikeBiometricBridgeV1(value)) throw new Error('Invalid KineStrike bridge');
  const result = new Set<SessionFeelReason>();
  for (const rule of rules) {
    const below = Object.prototype.hasOwnProperty.call(rule, 'below');
    const above = Object.prototype.hasOwnProperty.call(rule, 'above');
    const threshold = below ? rule.below : rule.above;
    if (
      below === above ||
      !finite(threshold) ||
      !member(SESSION_FEEL_REASONS, rule.reason) ||
      !member([...Object.keys(NUMBER_BOUNDS), ...COUNT_FIELDS], rule.field)
    ) {
      throw new Error('Invalid KineStrike reason rule');
    }
    const measurement = value[rule.field];
    if (measurement !== null && (below ? measurement < threshold : measurement > threshold)) {
      result.add(rule.reason);
    }
  }
  return [...result];
}

/** Advisory reason IDs use caller-supplied thresholds and never record an answer. */
export function evaluateKineStrikeFeelSuggestions(
  summary: KineStrikeTelemetrySummary,
  readiness: { z_hrv_7d: number | null },
  thresholds: {
    maxGctDeltaPct: number;
    maxHrvZForSoreness: number;
    minCopXLateralGuard: number;
    maxCopXMedialShift: number;
  },
): readonly ('soreness' | 'pain')[] {
  if (
    !Object.values(thresholds).every(finite) ||
    ![
      thresholds.maxGctDeltaPct,
      thresholds.maxHrvZForSoreness,
      thresholds.minCopXLateralGuard,
      thresholds.maxCopXMedialShift,
    ].every(finite)
  ) {
    throw new Error('Invalid KineStrike thresholds');
  }
  const result: ('soreness' | 'pain')[] = [];
  if (
    finite(summary.ks_gct_delta_pct) &&
    finite(readiness.z_hrv_7d) &&
    summary.ks_gct_delta_pct >= thresholds.maxGctDeltaPct &&
    readiness.z_hrv_7d <= thresholds.maxHrvZForSoreness
  ) {
    result.push('soreness');
  }
  if (
    finite(summary.ks_cop_x_mean) &&
    (summary.ks_cop_x_mean <= thresholds.minCopXLateralGuard ||
      summary.ks_cop_x_mean >= thresholds.maxCopXMedialShift)
  ) {
    result.push('pain');
  }
  return result;
}

/** Derives ratified informational sub-chip codes from plantar summary metrics. */
export function deriveKineStrikeSubChips(
  summary: KineStrikeTelemetrySummary,
  thresholds: {
    copXMedialShiftWarn: number;
    copXLateralGuardWarn: number;
    gctDeltaPctWarn: number;
  } = KINESTRIKE_BRIDGE_DEFAULTS,
): readonly KineStrikeSubChipCode[] {
  if (
    ![
      thresholds.copXMedialShiftWarn,
      thresholds.copXLateralGuardWarn,
      thresholds.gctDeltaPctWarn,
    ].every(finite)
  ) {
    throw new Error('Invalid KineStrike sub-chip thresholds');
  }
  const out: KineStrikeSubChipCode[] = [];
  if (finite(summary.ks_cop_x_mean)) {
    if (summary.ks_cop_x_mean >= thresholds.copXMedialShiftWarn) {
      out.push('medial_shift');
    } else if (summary.ks_cop_x_mean <= thresholds.copXLateralGuardWarn) {
      out.push('lateral_guard');
    }
  }
  if (finite(summary.ks_gct_delta_pct) && summary.ks_gct_delta_pct >= thresholds.gctDeltaPctWarn) {
    out.push('gct_drift');
  }
  return out;
}
