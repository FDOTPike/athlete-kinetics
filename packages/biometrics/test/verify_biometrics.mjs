/**
 * verify_biometrics.mjs — boundary invariants of the biometric ingestion
 * layer (runs the EXACT production aggregation, compiled to test/.build):
 *   [1] Compaction bound — minute-tick arrays collapse to ONE row per day.
 *   [2] Sleep stage math — awake/out-of-bed time never counts as sleep;
 *       deep/rem/light split preserved; unstaged sessions use the documented
 *       population-median efficiency, never a flattering 100%.
 *   [3] Bucketing — sleep lands on its wake morning; point samples on their
 *       own local date.
 *   [4] Garbage tolerance — malformed/out-of-physiology records are skipped,
 *       aggregation never throws (graceful degradation starts here).
 *   [5] SQL round-trip — the store's upsert literals carry aggregated rows
 *       through the real 002 CHECKs (incl. the generated efficiency <= 100),
 *       and re-ingestion is idempotent.
 *
 * Run:  npm run verify:biometrics
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);
const { aggregateDaily, UNSTAGED_SLEEP_EFFICIENCY } = require('./.build/aggregate.js');

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

// Deterministic local-date function for tests: UTC calendar date.
const utcDate = (iso) => iso.slice(0, 10);

// --- [1] compaction bound -------------------------------------------------------
console.log('[1] compaction bound (ticks -> one row per day)');
const hrvTicks = [];
for (let i = 0; i < 240; i++) { // 4 hours of minute ticks across two nights
  const day = i < 120 ? '11' : '12';
  const min = i % 120;
  hrvTicks.push({
    time: `2026-06-${day}T0${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}:00Z`,
    heartRateVariabilityMillis: i < 120 ? 80 : 60,
  });
}
const compacted = aggregateDaily(hrvTicks, [], [], utcDate);
check('240 HRV ticks compact to exactly 2 rows', compacted.length === 2,
  String(compacted.length));
check('overnight averages preserved (80 / 60 ms)',
  compacted[0].date === '2026-06-11' && compacted[0].rmssdMs === 80 &&
  compacted[1].date === '2026-06-12' && compacted[1].rmssdMs === 60);
const rhrRows = aggregateDaily([], [
  { time: '2026-06-12T06:00:00Z', beatsPerMinute: 52 },
  { time: '2026-06-12T06:05:00Z', beatsPerMinute: 48 },
], [], utcDate);
check('RHR samples average into one daily value', rhrRows.length === 1 &&
  rhrRows[0].restingHrBpm === 50, String(rhrRows[0]?.restingHrBpm));

// --- [2] sleep stage math ---------------------------------------------------------
console.log('[2] sleep stage math');
const staged = aggregateDaily([], [], [{
  startTime: '2026-06-11T22:00:00Z',
  endTime: '2026-06-12T06:00:00Z', // 480 min in bed
  stages: [
    { startTime: '2026-06-11T22:00:00Z', endTime: '2026-06-11T22:30:00Z', stage: 1 }, // awake
    { startTime: '2026-06-11T22:30:00Z', endTime: '2026-06-12T01:30:00Z', stage: 4 }, // light 180
    { startTime: '2026-06-12T01:30:00Z', endTime: '2026-06-12T03:00:00Z', stage: 5 }, // deep 90
    { startTime: '2026-06-12T03:00:00Z', endTime: '2026-06-12T04:30:00Z', stage: 6 }, // rem 90
    { startTime: '2026-06-12T04:30:00Z', endTime: '2026-06-12T05:30:00Z', stage: 4 }, // light 60
    { startTime: '2026-06-12T05:30:00Z', endTime: '2026-06-12T06:00:00Z', stage: 7 }, // awake-in-bed
  ],
}], utcDate);
check('awake stages excluded from asleep (480 in bed, 420 asleep)',
  staged[0].inBedMin === 480 && staged[0].asleepMin === 420,
  `${staged[0].inBedMin}/${staged[0].asleepMin}`);
check('deep/rem/light split preserved (90/90/240)',
  staged[0].deepMin === 90 && staged[0].remMin === 90 && staged[0].lightMin === 240);
const unstaged = aggregateDaily([], [], [{
  startTime: '2026-06-11T23:00:00Z', endTime: '2026-06-12T07:00:00Z',
}], utcDate);
check(`unstaged session estimated at ${UNSTAGED_SLEEP_EFFICIENCY} efficiency, not 100%`,
  unstaged[0].inBedMin === 480 &&
  unstaged[0].asleepMin === Math.round(480 * UNSTAGED_SLEEP_EFFICIENCY * 10) / 10 &&
  unstaged[0].asleepMin < unstaged[0].inBedMin,
  `${unstaged[0].asleepMin}/${unstaged[0].inBedMin}`);

// --- [3] bucketing ----------------------------------------------------------------
console.log('[3] bucketing');
check('a sleep session lands on its WAKE morning (end date)',
  unstaged[0].date === '2026-06-12');
const crossMidnight = aggregateDaily([
  { time: '2026-06-11T23:50:00Z', heartRateVariabilityMillis: 70 },
  { time: '2026-06-12T00:10:00Z', heartRateVariabilityMillis: 90 },
], [], [], utcDate);
check('point samples land on their own local date (no merging across midnight)',
  crossMidnight.length === 2 && crossMidnight[0].rmssdMs === 70 && crossMidnight[1].rmssdMs === 90);

// --- [4] garbage tolerance --------------------------------------------------------
console.log('[4] garbage tolerance (never throws, never propagates)');
let threw = false;
let garbageOut = [];
try {
  garbageOut = aggregateDaily(
    [
      { time: 'not-a-date', heartRateVariabilityMillis: 80 },
      { time: '2026-06-12T01:00:00Z', heartRateVariabilityMillis: -5 },
      { time: '2026-06-12T01:00:00Z', heartRateVariabilityMillis: 9999 },
      { time: '2026-06-12T01:00:00Z', heartRateVariabilityMillis: Number.NaN },
      null,
      { time: '2026-06-12T02:00:00Z', heartRateVariabilityMillis: 75 }, // the one good row
    ],
    [
      { time: '2026-06-12T06:00:00Z', beatsPerMinute: 500 }, // outside CHECK domain
      { time: '2026-06-12T06:00:00Z', beatsPerMinute: 10 },
    ],
    [
      { startTime: '2026-06-12T06:00:00Z', endTime: '2026-06-12T05:00:00Z' }, // ends before start
      { startTime: 'garbage', endTime: 'garbage' },
      null,
    ],
    utcDate,
  );
} catch {
  threw = true;
}
check('malformed records never throw', !threw);
check('only the physiologically valid row survives',
  garbageOut.length === 1 && garbageOut[0].rmssdMs === 75 && garbageOut[0].restingHrBpm === null &&
  garbageOut[0].inBedMin === null);

// --- [5] SQL round-trip (the store's literal upserts vs real 002 CHECKs) ----------
console.log('[5] SQL round-trip into hrv_daily / sleep_daily');
const SCHEMA_DIR = join(import.meta.dirname, '..', '..', 'core-db', 'src', 'schema');
const db = new DatabaseSync(':memory:');
try { db.prepare('SELECT ln(2.0), sqrt(2.0)').get(); } catch {
  db.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
  db.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
}
for (const f of ['001_mechanical_input.sql', '002_telemetry.sql', '003_state_vector.sql',
  '005_subjective_report.sql', '006_user_profile.sql', '007_program_engine.sql',
  '008_taxonomy.sql', '009_periodization.sql']) {
  db.exec(readFileSync(join(SCHEMA_DIR, f), 'utf-8'));
}
// EXACTLY the literals useStore.syncBiometrics executes:
const upsertHrv = db.prepare(
  "INSERT INTO hrv_daily (date, rmssd_ms, resting_hr, source) VALUES (?, ?, ?, 'health_connect') ON CONFLICT(date) DO UPDATE SET rmssd_ms = excluded.rmssd_ms, resting_hr = COALESCE(excluded.resting_hr, resting_hr), source = excluded.source");
const updateRhrOnly = db.prepare(
  'UPDATE hrv_daily SET resting_hr = ? WHERE date = ?');
const upsertSleep = db.prepare(
  'INSERT INTO sleep_daily (date, in_bed_min, asleep_min, deep_min, rem_min, light_min) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(date) DO UPDATE SET in_bed_min = excluded.in_bed_min, asleep_min = excluded.asleep_min, deep_min = excluded.deep_min, rem_min = excluded.rem_min, light_min = excluded.light_min');
const ingest = (rows) => {
  for (const r of rows) {
    if (r.rmssdMs !== null) upsertHrv.run(r.date, r.rmssdMs, r.restingHrBpm);
    else if (r.restingHrBpm !== null) updateRhrOnly.run(r.restingHrBpm, r.date);
    if (r.inBedMin !== null && r.inBedMin > 0) {
      upsertSleep.run(r.date, r.inBedMin, r.asleepMin ?? 0, r.deepMin, r.remMin, r.lightMin);
    }
  }
};
const night = aggregateDaily(hrvTicks, [
  { time: '2026-06-12T06:00:00Z', beatsPerMinute: 50 },
], [
  {
    startTime: '2026-06-11T22:00:00Z',
    endTime: '2026-06-12T06:00:00Z',
    stages: [
      { startTime: '2026-06-11T22:00:00Z', endTime: '2026-06-12T06:00:00Z', stage: 4 },
    ],
  },
], utcDate);
ingest(night);
ingest(night); // idempotency: same window re-synced on next foreground
const hrvRow = db.prepare("SELECT * FROM hrv_daily WHERE date = '2026-06-12'").get();
const sleepRow = db.prepare("SELECT * FROM sleep_daily WHERE date = '2026-06-12'").get();
check('hrv_daily row carries the compacted average + RHR + source',
  hrvRow !== undefined && Number(hrvRow.rmssd_ms) === 60 &&
  Number(hrvRow.resting_hr) === 50 && hrvRow.source === 'health_connect');
check('sleep_daily row passes the generated efficiency CHECK',
  sleepRow !== undefined && Number(sleepRow.in_bed_min) === 480 &&
  Number(sleepRow.efficiency_pct) <= 100);
check('re-ingestion is idempotent (one row per table per day)',
  Number(db.prepare('SELECT count(*) c FROM hrv_daily').get().c) === 2 &&
  Number(db.prepare('SELECT count(*) c FROM sleep_daily').get().c) === 1);
// The state vector can actually consume what we wrote:
const MATERIALIZE = readFileSync(join(SCHEMA_DIR, '004_state_vector_materialize.sql'), 'utf-8')
  .replace(/^--.*$/gm, '');
db.prepare(MATERIALIZE).run('2026-06-12');
check('materializer accepts Health Connect-fed rows (state_vector row exists)',
  db.prepare("SELECT 1 ok FROM state_vector WHERE date = '2026-06-12'").get() !== undefined);

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
