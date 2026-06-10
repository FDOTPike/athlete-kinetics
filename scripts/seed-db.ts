/**
 * seed-db.ts — deterministic 180-day synthetic athlete history.
 *
 * Simulates a powerlifting + Jiu-Jitsu athlete across two 13-week macro
 * cycles (accumulation -> intensification -> overreaching comp camp ->
 * deload), with biometrics driven by an EWMA fatigue state so HRV, sleep
 * efficiency, and SpO2 INVERSELY track mechanical load instead of being
 * independent noise. Rest days are stochastic (seeded) to exercise the
 * calendar-RANGE gap tolerance of the ACWR windows in v_readiness_inputs.
 *
 * Runs the REAL schema: 001-003 migrations, live triggers, the 002 SpO2
 * raw->daily fold, and the 004 state_vector upsert for every day. The engine
 * is node:sqlite behind an adapter with op-sqlite's executeSync() shape, so
 * the DAO calls below port 1:1 to the device build.
 *
 * Determinism: every random draw comes from one mulberry32 PRNG (fixed seed).
 * Same --end date + same Node major => byte-identical state_vector (verified
 * below by seeding twice and comparing SHA-256).
 *
 * Run (Node >= 24, no build step):
 *   node scripts/seed-db.ts [--end=YYYY-MM-DD] [--db=path/to/out.db]
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const SCHEMA_DIR = join(import.meta.dirname, '..', 'packages', 'core-db', 'src', 'schema');
const SEED = 0x5eed_a71e;
const DAYS = 180;

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) + helpers
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
const gauss = (rng: Rng, mean = 0, sd = 1): number => {
  const u = 1 - rng();
  const v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const roundTo = (x: number, step: number): number => Math.round(x / step) * step;

// ---------------------------------------------------------------------------
// op-sqlite-shaped adapter over node:sqlite (CLI stand-in for the device DB)
// ---------------------------------------------------------------------------
type SqlParam = string | number | null;
interface Db {
  executeSync(sql: string, params?: SqlParam[]): { rows: Record<string, unknown>[] };
  raw: DatabaseSync;
}
function openDb(path: string): Db {
  const raw = new DatabaseSync(path);
  raw.exec('PRAGMA foreign_keys = ON;');
  // op-sqlite builds carry SQLITE_ENABLE_MATH_FUNCTIONS; node:sqlite may not.
  try {
    raw.prepare('SELECT ln(2.0), sqrt(2.0)').get();
  } catch {
    raw.function('ln', { deterministic: true }, (x: number | null) =>
      x !== null && x > 0 ? Math.log(x) : null);
    raw.function('sqrt', { deterministic: true }, (x: number | null) =>
      x !== null && x >= 0 ? Math.sqrt(x) : null);
  }
  return {
    raw,
    executeSync(sql, params = []) {
      const stmt = raw.prepare(sql);
      if (/^\s*(SELECT|WITH(?![\s\S]*INSERT))/i.test(sql)) {
        return { rows: stmt.all(...params) as Record<string, unknown>[] };
      }
      stmt.run(...params);
      return { rows: [] };
    },
  };
}
const stripLineComments = (sql: string): string => sql.replace(/^--.*$/gm, '');

// ---------------------------------------------------------------------------
// Macro-cycle plan: two 13-week blocks. `vol` scales sets/rounds, `intensity`
// is %1RM for the lifts. Overreach weeks sit straight after a deload so the
// depressed chronic load amplifies the ACWR spike (worst realistic case).
// ---------------------------------------------------------------------------
type Phase = 'accumulation' | 'intensification' | 'realization' | 'deload';
interface WeekSpec { phase: Phase; vol: number; intensity: number; overreach?: boolean }
const WEEK_PLAN: WeekSpec[] = [
  // Block A — "Base + Comp Camp"
  { phase: 'accumulation',    vol: 1.00, intensity: 0.70 },
  { phase: 'accumulation',    vol: 1.10, intensity: 0.71 },
  { phase: 'accumulation',    vol: 1.20, intensity: 0.72 },
  { phase: 'accumulation',    vol: 1.30, intensity: 0.73 },
  { phase: 'deload',          vol: 0.50, intensity: 0.60 },
  { phase: 'intensification', vol: 1.05, intensity: 0.78 },
  { phase: 'intensification', vol: 1.10, intensity: 0.80 },
  { phase: 'intensification', vol: 1.15, intensity: 0.82 },
  { phase: 'intensification', vol: 1.20, intensity: 0.84 },
  { phase: 'deload',          vol: 0.45, intensity: 0.62 },
  { phase: 'realization',     vol: 1.80, intensity: 0.86, overreach: true },
  { phase: 'realization',     vol: 1.95, intensity: 0.87, overreach: true },
  { phase: 'deload',          vol: 0.40, intensity: 0.60 },
  // Block B — "Rebuild + Second Camp"
  { phase: 'accumulation',    vol: 1.00, intensity: 0.71 },
  { phase: 'accumulation',    vol: 1.12, intensity: 0.72 },
  { phase: 'accumulation',    vol: 1.25, intensity: 0.73 },
  { phase: 'accumulation',    vol: 1.35, intensity: 0.74 },
  { phase: 'deload',          vol: 0.50, intensity: 0.62 },
  { phase: 'intensification', vol: 1.10, intensity: 0.79 },
  { phase: 'intensification', vol: 1.18, intensity: 0.81 },
  { phase: 'intensification', vol: 1.25, intensity: 0.83 },
  { phase: 'deload',          vol: 0.45, intensity: 0.62 },
  { phase: 'realization',     vol: 1.85, intensity: 0.86, overreach: true },
  { phase: 'realization',     vol: 1.95, intensity: 0.88, overreach: true },
  { phase: 'deload',          vol: 0.45, intensity: 0.60 },
  { phase: 'realization',     vol: 0.70, intensity: 0.85 },   // taper into today
];

interface Movement { id: number; name: string; pattern: string; base1rm: number }
const LIFTS: Movement[] = [
  { id: 1, name: 'Competition Squat', pattern: 'squat',  base1rm: 150 },
  { id: 2, name: 'Deadlift',          pattern: 'hinge',  base1rm: 185 },
  { id: 3, name: 'Competition Bench', pattern: 'push_h', base1rm: 107.5 },
  { id: 4, name: 'Overhead Press',    pattern: 'push_v', base1rm: 62.5 },
  { id: 5, name: 'Barbell Row',       pattern: 'pull_h', base1rm: 92.5 },
  { id: 6, name: 'Weighted Pull-up',  pattern: 'pull_v', base1rm: 102.5 },
];
const BJJ: Movement = { id: 7, name: 'BJJ Sparring Round', pattern: 'locomotion', base1rm: 0 };
// UTC weekday -> session plan (0=Sun). Sundays are always rest.
const WEEKDAY_LIFTS: Record<number, number[]> = { 1: [1, 3], 3: [2, 5], 5: [1, 4, 6] };
const WEEKDAY_BJJ = new Set([2, 4, 6]);

const REPS_BY_PHASE: Record<Phase, number> = {
  accumulation: 8, intensification: 5, realization: 5, deload: 6,
};

// ---------------------------------------------------------------------------
// Seeder (pure given SEED + endDate; safe to run repeatedly for hashing)
// ---------------------------------------------------------------------------
interface SeedReport {
  hash: string;
  restDays: number;
  sessions: number;
  sets: number;
  overreachDates: string[];
}

function seedInto(db: Db, endDate: string): SeedReport {
  const rng = mulberry32(SEED);
  for (const f of ['001_mechanical_input.sql', '002_telemetry.sql', '003_state_vector.sql']) {
    db.raw.exec(readFileSync(join(SCHEMA_DIR, f), 'utf-8'));
  }

  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  const dateOf = (i: number): string =>
    new Date(endMs - (DAYS - 1 - i) * 86_400_000).toISOString().slice(0, 10);
  const weekOf = (i: number): number => Math.min(WEEK_PLAN.length - 1, Math.floor(i / 7));

  // --- DAO statements (1:1 with the op-sqlite DAOs on device) ---------------
  const ins = {
    macro: db.raw.prepare('INSERT INTO macro_cycle (macro_cycle_id, name, goal, start_date) VALUES (?,?,?,?)'),
    micro: db.raw.prepare('INSERT INTO micro_cycle (micro_cycle_id, macro_cycle_id, week_index, phase) VALUES (?,?,?,?)'),
    movement: db.raw.prepare('INSERT INTO movement (movement_id, name, pattern) VALUES (?,?,?)'),
    session: db.raw.prepare('INSERT INTO session (micro_cycle_id, session_date, started_at_ms, duration_min, session_rpe) VALUES (?,?,?,?,?)'),
    set: db.raw.prepare('INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (?,?,?,?,?,?,?)'),
    hrv: db.raw.prepare('INSERT INTO hrv_daily (date, rmssd_ms, sdnn_ms, resting_hr) VALUES (?,?,?,?)'),
    sleep: db.raw.prepare('INSERT INTO sleep_daily (date, in_bed_min, asleep_min, deep_min, rem_min, light_min, latency_min, interruptions) VALUES (?,?,?,?,?,?,?,?)'),
    spo2Daily: db.raw.prepare('INSERT INTO spo2_daily (date, mean_pct, min_pct, pct_time_below_90, sample_count) VALUES (?,?,?,?,?)'),
    spo2Raw: db.raw.prepare('INSERT INTO spo2_sample (epoch_ms, source, spo2_pct) VALUES (?,?,?)'),
  };

  db.raw.exec('BEGIN');

  ins.macro.run(1, 'Block A: Base + Comp Camp', 'strength', dateOf(0));
  ins.macro.run(2, 'Block B: Rebuild + Second Camp', 'strength', dateOf(13 * 7));
  WEEK_PLAN.forEach((w, gw) =>
    ins.micro.run(gw + 1, gw < 13 ? 1 : 2, (gw % 13) + 1, w.phase));
  for (const m of [...LIFTS, BJJ]) ins.movement.run(m.id, m.name, m.pattern);

  // EWMA of normalized daily load, time constant ~4 days so a 2-week camp
  // reaches its fatigue plateau by mid-week-1. Steady accumulation sits near
  // fatigue 0.9, deloads recover to ~0.4, overreach camps plateau ~1.6
  // (steady state = 1.18 x dailyTonnage/5000).
  let fatigue = 0.8;
  let sessions = 0;
  let sets = 0;
  let restDays = 0;
  const overreachDates: string[] = [];

  for (let i = 0; i < DAYS; i++) {
    const date = dateOf(i);
    const dayMs = endMs - (DAYS - 1 - i) * 86_400_000;
    const week = WEEK_PLAN[weekOf(i)];
    const dow = new Date(dayMs).getUTCDay();
    if (week.overreach) overreachDates.push(date);

    // --- morning biometrics reflect ACCUMULATED fatigue (inverse coupling) --
    // Parasympathetic withdrawal accelerates once fatigue crosses ~1.1
    // (functional overreaching): linear suppression + quadratic excess term.
    const hrvDrive = 0.40 * fatigue + 0.35 * Math.max(0, fatigue - 1.1) ** 2;
    const rmssd = clamp(95 * Math.exp(-hrvDrive) * Math.exp(gauss(rng, 0, 0.05)), 25, 140);
    ins.hrv.run(date,
      roundTo(rmssd, 0.1),
      roundTo(clamp(rmssd * 1.35 + gauss(rng, 0, 4), 30, 190), 0.1),
      roundTo(clamp(50 + 7 * fatigue + gauss(rng, 0, 1.5), 40, 90), 1));

    const inBed = roundTo(clamp(465 + gauss(rng, 0, 25), 390, 555), 1);
    const eff = clamp(93 - 6 * fatigue - 2.5 * Math.max(0, fatigue - 1.1) + gauss(rng, 0, 2), 60, 98);
    const asleep = roundTo(inBed * eff / 100, 1);
    ins.sleep.run(date, inBed, asleep,
      roundTo(asleep * clamp(0.21 - 0.02 * fatigue + gauss(rng, 0, 0.015), 0.10, 0.26), 1),
      roundTo(asleep * clamp(0.23 - 0.015 * fatigue + gauss(rng, 0, 0.015), 0.12, 0.28), 1),
      roundTo(asleep * 0.50, 1),
      roundTo(clamp(8 + 6 * fatigue + gauss(rng, 0, 3), 2, 75), 1),
      Math.round(clamp(1 + 1.6 * fatigue + gauss(rng, 0, 0.8), 0, 9)));

    const spo2Mean = clamp(96.8 - 0.5 * fatigue + gauss(rng, 0, 0.3), 90, 99.4);
    ins.spo2Daily.run(date,
      roundTo(spo2Mean, 0.1),
      roundTo(clamp(spo2Mean - 2.5 - rng() * 2, 85, spo2Mean), 0.1),
      roundTo(fatigue > 1.6 ? clamp((fatigue - 1.6) * 2.5 + rng(), 0, 9) : rng() * 0.4, 0.1),
      420);
    // Raw high-frequency stream for the trailing 3 days (exercises the 002
    // ring buffer + fold; epochs kept inside the UTC date for determinism).
    if (i >= DAYS - 3) {
      for (let s = 0; s < 420; s++) {
        ins.spo2Raw.run(dayMs + (60 + s) * 60_000, 'wearable',
          roundTo(clamp(spo2Mean + gauss(rng, 0, 0.8), 88, 100), 0.1));
      }
    }

    // --- mechanical load ----------------------------------------------------
    let dayTonnage = 0;
    const missProb = week.overreach ? 0.03 : week.phase === 'deload' ? 0.30 : 0.13;
    const lifts = WEEKDAY_LIFTS[dow];
    const trainsToday =
      (lifts !== undefined || WEEKDAY_BJJ.has(dow)) && dow !== 0 && rng() >= missProb;

    if (!trainsToday) {
      restDays += 1;
    } else if (lifts !== undefined) {
      const info = ins.session.run(weekOf(i) + 1, date, dayMs + 17 * 3_600_000,
        roundTo(clamp(55 + 30 * week.vol + gauss(rng, 0, 8), 30, 150), 1), null);
      const sessionId = Number(info.lastInsertRowid);
      sessions += 1;
      let rpeSum = 0; let rpeN = 0;
      for (const movementId of lifts) {
        const mv = LIFTS[movementId - 1];
        const nSets = Math.round(clamp((lifts.length === 3 ? 3.2 : 4.2) * week.vol + gauss(rng, 0, 0.4), 2, 9));
        const reps = Math.round(clamp(REPS_BY_PHASE[week.phase] + Math.round(gauss(rng, 0, 0.7)), 2, 10));
        const load = roundTo(mv.base1rm * week.intensity * (1 + gauss(rng, 0, 0.015)), 2.5);
        for (let s = 1; s <= nSets; s++) {
          const rpe = roundTo(clamp(5.0 + (week.intensity - 0.6) * 14 + 0.5 * fatigue
            + 0.25 * s + gauss(rng, 0, 0.3), 5, 10), 0.5);
          ins.set.run(sessionId, mv.id, s, reps, load, rpe, dayMs + 17 * 3_600_000 + sets);
          dayTonnage += reps * load;
          rpeSum += rpe; rpeN += 1;
          sets += 1;
        }
      }
      db.executeSync('UPDATE session SET session_rpe = ? WHERE session_id = ?',
        [roundTo(clamp(rpeSum / rpeN + gauss(rng, 0, 0.2), 1, 10), 0.5), sessionId]);
    } else {
      const rounds = Math.round(clamp((week.overreach ? 8.5 : 6) * week.vol + gauss(rng, 0, 0.7), 2, 16));
      const info = ins.session.run(weekOf(i) + 1, date, dayMs + 19 * 3_600_000,
        roundTo(rounds * 7 + 15, 1), roundTo(clamp(5.5 + week.vol + 0.4 * fatigue, 3, 10), 0.5));
      const sessionId = Number(info.lastInsertRowid);
      sessions += 1;
      for (let r = 1; r <= rounds; r++) {
        // One sparring round modeled as reps x partner-mass moved.
        ins.set.run(sessionId, BJJ.id, r, 6, roundTo(75 + gauss(rng, 0, 5), 0.5),
          roundTo(clamp(6 + week.vol + 0.3 * fatigue + gauss(rng, 0, 0.4), 4, 10), 0.5),
          dayMs + 19 * 3_600_000 + r);
        dayTonnage += 6 * 75;
        sets += 1;
      }
    }

    // --- evening fatigue update (drives tomorrow's biometrics) --------------
    fatigue = clamp(fatigue * 0.78 + (dayTonnage / 5000) * 0.26, 0, 3);
  }
  db.raw.exec('COMMIT');

  // --- 002 compaction: fold raw SpO2 into the daily rollup (UTC variant; the
  // on-device job uses localtime). Then run retention trim to exercise it.
  db.raw.exec('BEGIN');
  db.raw.exec(`
    INSERT INTO spo2_daily (date, mean_pct, min_pct, pct_time_below_90, sample_count)
    SELECT date(epoch_ms / 1000, 'unixepoch') AS d,
           avg(spo2_pct), min(spo2_pct),
           100.0 * sum(spo2_pct < 90.0) / count(*), count(*)
    FROM spo2_sample
    WHERE epoch_ms > 0
    GROUP BY d
    ON CONFLICT (date) DO UPDATE SET
      mean_pct = excluded.mean_pct, min_pct = excluded.min_pct,
      pct_time_below_90 = excluded.pct_time_below_90,
      sample_count = excluded.sample_count;`);
  db.executeSync('DELETE FROM spo2_sample WHERE epoch_ms < ?',
    [Date.parse(`${endDate}T00:00:00Z`) - 14 * 86_400_000]);
  db.raw.exec('COMMIT');

  // --- 004: materialize the State Vector for every day ----------------------
  const upsert = db.raw.prepare(
    stripLineComments(readFileSync(join(SCHEMA_DIR, '004_state_vector_materialize.sql'), 'utf-8')));
  db.raw.exec('BEGIN');
  for (let i = 0; i < DAYS; i++) upsert.run(dateOf(i));
  db.raw.exec('COMMIT');

  // --- canonical hash over the materialized table ---------------------------
  const h = createHash('sha256');
  for (const r of db.raw.prepare('SELECT * FROM state_vector ORDER BY date').all() as Record<string, unknown>[]) {
    h.update(Object.entries(r)
      .filter(([k]) => k !== 'computed_at_ms')   // wall-clock, excluded
      .map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(5) : String(v)}`)
      .join('|') + '\n');
  }
  return { hash: h.digest('hex'), restDays, sessions, sets, overreachDates };
}

// ---------------------------------------------------------------------------
// Verification: the dataset must EXHIBIT the physiology it claims to model.
// ---------------------------------------------------------------------------
let fail = 0;
function check(label: string, ok: boolean, detail = ''): void {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
}
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b) / n;
  const my = ys.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

function main(): void {
  const args = new Map(process.argv.slice(2)
    .map((a) => a.replace(/^--/, '').split('=') as [string, string]));
  const now = new Date();
  const endDate = args.get('end') ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const dbPath = args.get('db') ?? join(import.meta.dirname, '..', 'athlete_kinetics.seed.db');

  console.log(`Seeding ${DAYS} days ending ${endDate} (seed 0x${SEED.toString(16)})\n`);

  console.log('[1] determinism: two independent in-memory runs');
  const runA = seedInto(openDb(':memory:'), endDate);
  const runB = seedInto(openDb(':memory:'), endDate);
  check('SHA-256(state_vector) identical across runs', runA.hash === runB.hash,
    runA.hash.slice(0, 16));

  console.log('[2] persist to file DB');
  rmSync(dbPath, { force: true });
  const db = openDb(dbPath);
  const rep = seedInto(db, endDate);
  check('file run matches in-memory hash', rep.hash === runA.hash);
  check(`sessions=${rep.sessions} sets=${rep.sets}`, rep.sessions > 100 && rep.sets > 1000);

  console.log('[3] coverage and gap tolerance');
  const svCount = Number(db.raw.prepare('SELECT count(*) c FROM state_vector').get()!.c);
  check(`state_vector has all ${DAYS} days`, svCount === DAYS, String(svCount));
  const gapDays = DAYS - Number(db.raw.prepare(
    'SELECT count(*) c FROM mech_daily WHERE set_count > 0').get()!.c);
  check('rest/missing days present (ACWR gap test)', gapDays >= 35 && gapDays <= 80,
    `${gapDays} zero-load days`);
  const acwrOnGaps = db.raw.prepare(`
    SELECT count(*) c FROM state_vector sv
    WHERE sv.acwr IS NULL AND sv.date > date(?, '-${DAYS - 35} days')`).get(endDate)!.c;
  check('ACWR defined on every post-baseline day despite gaps', Number(acwrOnGaps) === 0);

  console.log('[4] overreaching physiology');
  const orSet = `('${rep.overreachDates.join("','")}')`;
  const maxAcwr = db.raw.prepare(
    `SELECT max(acwr) m FROM state_vector WHERE date IN ${orSet}`).get()!.m as number;
  check('ACWR spikes above 1.5 in camp weeks', maxAcwr > 1.5, `max=${maxAcwr.toFixed(2)}`);
  const minReady = db.raw.prepare(
    `SELECT min(readiness_score) m FROM state_vector WHERE date IN ${orSet}`).get()!.m as number;
  check('readiness plummets during camp', minReady < 45, `min=${minReady.toFixed(1)}`);
  // Camp = the actual overreach dates (the realization PHASE also contains
  // tapers, which would dilute the contrast being asserted here).
  const aggSql = (where: string) => `
    SELECT avg(sv.readiness_score) r, avg(h.rmssd_ms) hrv, avg(sl.efficiency_pct) eff
    FROM state_vector sv
    JOIN hrv_daily h USING (date) JOIN sleep_daily sl USING (date)
    WHERE ${where}`;
  type Agg = { r: number; hrv: number; eff: number };
  const camp = db.raw.prepare(aggSql(`sv.date IN ${orSet}`)).get() as Agg;
  const acc = db.raw.prepare(aggSql(`sv.date IN (
    SELECT s.session_date FROM session s JOIN micro_cycle mc USING (micro_cycle_id)
    WHERE mc.phase = 'accumulation')`)).get() as Agg;
  check('readiness: camp << accumulation', camp.r < acc.r - 12,
    `camp=${camp.r.toFixed(1)} acc=${acc.r.toFixed(1)}`);
  check('HRV rMSSD: camp << accumulation', camp.hrv < acc.hrv - 8,
    `camp=${camp.hrv.toFixed(1)}ms acc=${acc.hrv.toFixed(1)}ms`);
  check('sleep efficiency: camp < accumulation', camp.eff < acc.eff - 2,
    `camp=${camp.eff.toFixed(1)}% acc=${acc.eff.toFixed(1)}%`);

  console.log('[5] inverse load<->biometric coupling across all 180 days');
  const series = db.raw.prepare(`
    SELECT sv.acute_load_kg a, h.rmssd_ms m FROM state_vector sv
    JOIN hrv_daily h USING (date) WHERE sv.acute_load_kg IS NOT NULL`)
    .all() as { a: number; m: number }[];
  const r = pearson(series.map((s) => s.a), series.map((s) => s.m));
  check('pearson r(acute_load, rMSSD) strongly negative', r < -0.5, `r=${r.toFixed(3)}`);

  console.log('\n  last 14 days (frontend smoke data):');
  for (const row of db.raw.prepare(
    `SELECT date, readiness_score, acwr, hrv_z FROM state_vector
     ORDER BY date DESC LIMIT 14`).all().reverse() as Record<string, number | string | null>[]) {
    console.log(`    ${row.date}  R=${(row.readiness_score as number).toFixed(1).padStart(5)}` +
      `  ACWR=${row.acwr === null ? '  NA' : (row.acwr as number).toFixed(2)}` +
      `  HRVZ=${row.hrv_z === null ? 'NA' : (row.hrv_z as number).toFixed(2)}`);
  }

  console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}  ->  ${dbPath}`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
