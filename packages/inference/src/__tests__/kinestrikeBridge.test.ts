import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as bridge from '../kinestrikeBridge';
import { TRAINING_AGES } from '../types';

const line = (body: string): string =>
  `${body}*${Array.from(body)
    .reduce((xor, c) => xor ^ c.charCodeAt(0), 0)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()}`;

const clean = [
  'E,1,100,300,200,10,0.5',
  'B,1,100,300,0.5,0.3,0.2,0,0.2',
  'E,2,500,900,400,30,0.25',
  'B,2,500,900,0.25,0.25,0.5,0,-0.3333',
  'K,120,L,3.5,20',
  'K,520,R,4.5,25',
  'C,550,-45,R,90',
  'W,130,L,IMPACT_ARMED,3.5,0',
  'W,800,L,FALL_WARNING,3.5,70',
  'W,1000,L,RECOVERED,3.5,10',
].map(line);

const baseline = {
  z_hrv_7d: null,
  rhr_delta_bpm: null,
  sleep_hours: null,
  sleep_Midpoint_dev_min: null,
  acwr_4w: null,
  days_since_high_cns: null,
};

const payload = () => ({
  training_age: 'beginner' as const,
  sport_id: 'powerlifting' as const,
  ...baseline,
  ...bridge.parseKineStrikeSessionLog(clean),
  ks_foot: 'L' as const,
});

test('exact runtime surface and no IO, database writes, draft UI copy, or model identifiers', () => {
  expect(Object.keys(bridge).sort()).toEqual([
    'KINESTRIKE_BRIDGE_DEFAULTS',
    'KINESTRIKE_SUBCHIP_LABEL',
    'deriveKineStrikeSubChips',
    'evaluateKineStrikeFeelSuggestions',
    'isKineStrikeBiometricBridgeV1',
    'mapKineStrikeSessionFeelReasons',
    'parseKineStrikeSessionLog',
    'verifyNmeaChecksum',
  ]);
  const source = readFileSync(join(__dirname, '../kinestrikeBridge.ts'), 'utf8');
  expect(source).not.toMatch(
    /DRAFT_|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|fetch\(|writeFile|node:fs/i,
  );
  expect(bridge.KINESTRIKE_BRIDGE_DEFAULTS).toEqual({
    gctDeltaPctWarn: 6.0,
    zHrvFatigueMax: -0.50,
    copXMedialShiftWarn: 0.45,
    copXLateralGuardWarn: -0.35,
    peakLoadCvWarn: 0.18,
  });
  expect(bridge.KINESTRIKE_SUBCHIP_LABEL).toEqual({
    medial_shift: 'Forefoot medial shift (Big-Toe bias)',
    lateral_guard: 'Forefoot lateral shift (Small-Toe guarding)',
    gct_drift: 'Ground contact time drift',
  });
});

test('verifies NMEA XOR checksum strictly', () => {
  expect(bridge.verifyNmeaChecksum(clean[0])).toEqual({
    valid: true,
    payload: 'E,1,100,300,200,10,0.5',
  });
  expect(bridge.verifyNmeaChecksum('E,1,100,300,200,10,0.5*00').valid).toBe(false);
  expect(bridge.verifyNmeaChecksum('E,1,100,300').valid).toBe(false);
  expect(bridge.verifyNmeaChecksum('').valid).toBe(false);
});

test('aggregates strikes, population CV, 3-zone balances, impacts, turns and fall warnings', () => {
  expect(bridge.parseKineStrikeSessionLog(clean)).toEqual({
    ks_foot: 'BOTH',
    ks_strike_count: 2,
    ks_gct_mean_ms: 300,
    ks_gct_delta_pct: null,
    ks_peak_load_mean: 20,
    ks_peak_load_cv: 0.5,
    ks_heel_share_mean: 0.375,
    ks_medial_share_mean: 0.275,
    ks_lateral_share_mean: 0.35,
    ks_toe_share_mean: 0,
    ks_cop_x_mean: (0.2 - 0.3333) / 2,
    ks_impact_peak_g_max: 4.5,
    ks_cod_count: 1,
    ks_fall_warning_count: 1,
    ks_fall_last_state: 'RECOVERED',
  });
});

test('missing measurements stay null, and no reference GCT is fabricated', () => {
  const empty = bridge.parseKineStrikeSessionLog([]);
  expect(empty.ks_foot).toBe('UNKNOWN');
  expect(empty.ks_strike_count).toBe(0);
  expect(empty.ks_gct_mean_ms).toBeNull();
  expect(empty.ks_gct_delta_pct).toBeNull();
  expect(empty.ks_peak_load_cv).toBeNull();
  expect(empty.ks_heel_share_mean).toBeNull();
  expect(empty.ks_cop_x_mean).toBeNull();
  expect(empty.ks_impact_peak_g_max).toBeNull();
  expect(bridge.parseKineStrikeSessionLog([line('E,1,0,1,1,0,0')]).ks_peak_load_cv).toBeNull();

  const single = [line('E,1,100,300,999,10,0.5')];
  expect(bridge.parseKineStrikeSessionLog(single, { baselineGctMs: 100 })).toMatchObject({
    ks_gct_mean_ms: 200,
    ks_gct_delta_pct: 100,
  });
  expect(bridge.parseKineStrikeSessionLog(single, { baselineGctMs: 0 }).ks_gct_delta_pct).toBeNull();
});

test('resolves feet from valid header, extended strike, COD and IMU records', () => {
  expect(bridge.parseKineStrikeSessionLog([], { defaultFoot: 'R' }).ks_foot).toBe('R');
  expect(bridge.parseKineStrikeSessionLog([line('H,fw=ks,foot=L')]).ks_foot).toBe('L');
  expect(
    bridge.parseKineStrikeSessionLog([
      line('H,fw=ks,foot=L'),
      line('M,1,R,0,0,1,0,0,0,1,'),
    ]).ks_foot,
  ).toBe('BOTH');
  expect(
    bridge.parseKineStrikeSessionLog([
      line('H,fw=ks,foot=L'),
      line('M,1,R,NaN,0,1,0,0,0,1,'),
    ]).ks_foot,
  ).toBe('L');
  expect(bridge.parseKineStrikeSessionLog([line('E,1,R,100,300,200,10,60,30,0.5')]).ks_foot).toBe('R');
  expect(bridge.parseKineStrikeSessionLog([line('K,400,L,COD,45,10')]).ks_cod_count).toBe(1);
});

const poisonedBodies = [
  'E,3,1000,1200,200,NaN,0.5',
  'E,3,1000,1200,200,Inf,0.5',
  'E,3,1000,1200,200,-1,0.5',
  'E,3,1000,1200,-1,10,0.5',
  'E,0,1000,1200,200,10,0.5',
  'E,3,1000,1200,200,10,1.1',
  'E,3,1000,1200,200,,0.5',
  'E,3,1000,1200,200,0x10,0.5',
  'B,1,100,300,-0.1,0.3,0.2,0,0.2',
  'B,1,100,300,1.002,0.3,0.2,0,0.2',
  'B,1,100,300,0.8,0.8,0,0,0.2',
  'B,1,100,300,0.5,0.3,0.2,0,1.01',
  'B,1,100,300,0.5,0.3,0.2,0,-1.01',
  'B,1,100,300,NaN,0.3,0.2,0,0.2',
  'B,1,100,300,0.5,0.3,0.2,0,Infinity',
  'K,1000,L,Infinity,10',
  'K,1000,X,9,10',
  'K,1000,L,-1,10',
  'C,1000,NaN,L,50',
  'C,1000,45,X,50',
  'C,-1,45,L,50',
  'C,1000,45,L,-1',
  'W,2000,L,FALL_WARNING,NaN,70',
  'W,2000,X,FALL_WARNING,3,70',
  'W,2000,L,UNKNOWN,3,70',
  'W,2000,L,FALL_WARNING,3,181',
];

describe('poisoning never changes any summary field (byte-identical JSON)', () => {
  test.each(poisonedBodies)('%s', (body) => {
    const expected = JSON.stringify(bridge.parseKineStrikeSessionLog(clean));
    expect(JSON.stringify(bridge.parseKineStrikeSessionLog([line(body), ...clean, line(body)]))).toBe(
      expected,
    );
  });

  test.each([
    'E,3,1000,1200,200,999,0.5*00',
    'B,1,100,300*00',
    line('K,2000,L,99,10').slice(0, -1),
    `${line('C,2000,45,L,90')},extra`,
  ])('malformed %s', (bad) => {
    expect(JSON.stringify(bridge.parseKineStrikeSessionLog([...clean, bad]))).toBe(
      JSON.stringify(bridge.parseKineStrikeSessionLog(clean)),
    );
  });
});

test('only balances matching an accepted strike contribute; retransmissions do not double-count', () => {
  expect(
    bridge.parseKineStrikeSessionLog([...clean, ...clean, line('B,99,100,300,0,1,0,0,1')]),
  ).toEqual(bridge.parseKineStrikeSessionLog(clean));
  expect(
    bridge.parseKineStrikeSessionLog([line('B,1,100,301,0,1,0,0,1'), clean[0]])
      .ks_medial_share_mean,
  ).toBeNull();
});

describe.each(['powerlifting', 'grappling_bjj', 'running_endurance'] as const)('%s', (sport_id) => {
  test.each(TRAINING_AGES)('flat legacy and v1 contracts for %s', (training_age) => {
    const legacyValue = { ...payload(), sport_id, training_age };
    expect(bridge.isKineStrikeBiometricBridgeV1(legacyValue)).toBe(true);
    expect(Object.values(legacyValue).every((v) => v === null || typeof v !== 'object')).toBe(true);

    const modernValue: bridge.KineStrikeBiometricBridgeV1 = {
      schema_version: 1,
      athlete_id: 'ath_01',
      captured_at_iso: '2026-11-10T08:30:00+11:00',
      experience_prefix: training_age,
      primary_sport_id: sport_id,
      secondary_sport_id: 'grappling_bjj',
      tertiary_sport_id: null,
      session_sport_tag: sport_id,
      ...baseline,
      ...bridge.parseKineStrikeSessionLog(clean),
      ks_foot: 'R',
      readiness_score: 72.5,
      readiness_band: 'green',
      suggested_feel_score: 3,
      suggested_reason_code_1: 'soreness',
      suggested_reason_code_2: 'pain',
      suggested_kinestrike_subchip_code: 'medial_shift',
    };
    expect(bridge.isKineStrikeBiometricBridgeV1(modernValue)).toBe(true);
    expect(Object.values(modernValue).every((v) => v === null || typeof v !== 'object')).toBe(true);
  });
});

test.each([
  { sport_id: 'general_strength' },
  { training_age: 'novice' },
  { ks_foot: 'W' },
  { ks_strike_count: -1 },
  { ks_cod_count: 0.5 },
  { ks_gct_mean_ms: NaN },
  { ks_peak_load_cv: Infinity },
  { ks_medial_share_mean: 1.002 },
  { ks_cop_x_mean: -1.1 },
  { ks_fall_last_state: 'SAFE' },
  { sleep_hours: -1 },
  { acwr_4w: -1 },
  { days_since_high_cns: -1 },
  { z_hrv_7d: undefined },
  { nested: {} },
])('rejects invalid contract %j', (invalid) => {
  expect(bridge.isKineStrikeBiometricBridgeV1({ ...payload(), ...invalid })).toBe(false);
});

test('maps caller rules to approved SessionFeelReason IDs and derives ratified sub-chips', () => {
  const value = { ...payload(), sleep_hours: 4 };
  const before = JSON.stringify(value);
  const rules: bridge.KineStrikeReasonRule[] = [
    { field: 'sleep_hours', below: 5, reason: 'tired' },
    { field: 'ks_gct_mean_ms', above: 250, reason: 'tired' },
    { field: 'ks_fall_warning_count', above: 0, reason: 'other' },
    { field: 'z_hrv_7d', below: 0, reason: 'pain' },
  ];
  expect(bridge.mapKineStrikeSessionFeelReasons(value, rules)).toEqual(['tired', 'other']);
  expect(bridge.mapKineStrikeSessionFeelReasons(value, [])).toEqual([]);
  expect(JSON.stringify(value)).toBe(before);

  const summary = {
    ...bridge.parseKineStrikeSessionLog(clean),
    ks_gct_delta_pct: 6.5,
    ks_cop_x_mean: 0.48,
  };
  expect(
    bridge.evaluateKineStrikeFeelSuggestions(
      summary,
      { z_hrv_7d: -0.55 },
      {
        maxGctDeltaPct: bridge.KINESTRIKE_BRIDGE_DEFAULTS.gctDeltaPctWarn,
        maxHrvZForSoreness: bridge.KINESTRIKE_BRIDGE_DEFAULTS.zHrvFatigueMax,
        minCopXLateralGuard: bridge.KINESTRIKE_BRIDGE_DEFAULTS.copXLateralGuardWarn,
        maxCopXMedialShift: bridge.KINESTRIKE_BRIDGE_DEFAULTS.copXMedialShiftWarn,
      },
    ),
  ).toEqual(['soreness', 'pain']);

  expect(bridge.deriveKineStrikeSubChips(summary)).toEqual(['medial_shift', 'gct_drift']);
  expect(
    bridge.deriveKineStrikeSubChips({
      ...summary,
      ks_cop_x_mean: -0.40,
      ks_gct_delta_pct: 2.0,
    }),
  ).toEqual(['lateral_guard']);
});

test('invalid configuration cannot suggest an unapproved reason', () => {
  const invalid = [
    { field: 'sleep_hours', below: 5, reason: 'poor_sleep' },
    { field: 'sleep_hours', below: NaN, reason: 'tired' },
    { field: 'sleep_hours', below: 5, above: 0, reason: 'tired' },
    { field: 'ks_foot', above: 0, reason: 'tired' },
  ];
  for (const rule of invalid) {
    expect(() =>
      bridge.mapKineStrikeSessionFeelReasons(
        payload(),
        [rule] as unknown as bridge.KineStrikeReasonRule[],
      ),
    ).toThrow();
  }
});
