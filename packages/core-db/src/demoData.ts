/**
 * demoData.ts — the demo-athlete generator, shared between the Node seeder
 * (scripts/seed-db.ts) and the in-app "LOAD DEMO ATHLETE" first-run path.
 *
 * Bundle-safe: pure TypeScript, no Node imports. The caller supplies a
 * minimal SQL adapter and owns transaction boundaries. Every random draw
 * comes from one mulberry32 PRNG (fixed seed), so the dataset is identical
 * on device and in CI — the Node seeder additionally hashes and asserts the
 * physiology (ACWR camp spikes, inverse HRV coupling); this module is the
 * single source of truth for the generation logic it verifies.
 */

// ---------------------------------------------------------------------------
// Minimal SQL adapter (op-sqlite executeSync on device, node:sqlite in CLI)
// ---------------------------------------------------------------------------
export type SqlParam = string | number | null;
export interface DemoSql {
  run(sql: string, params?: readonly SqlParam[]): void;
  one<T>(sql: string, params?: readonly SqlParam[]): T | undefined;
}

export const DEMO_SEED = 0x5eed_a71e;
export const DEMO_DAYS = 180;

// ---------------------------------------------------------------------------
// Deterministic PRNG + helpers
// ---------------------------------------------------------------------------
type Rng = () => number;
function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rng: Rng, mean = 0, sd = 1): number => {
  const u = 1 - rng();
  const v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const roundTo = (x: number, step: number): number => Math.round(x / step) * step;

/** Dates of the demo window, ascending, ending at endDate (UTC-anchored). */
export function demoDates(endDate: string, days: number = DEMO_DAYS): string[] {
  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) =>
    new Date(endMs - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

// ---------------------------------------------------------------------------
// Macro-cycle plan: two 13-week blocks. `vol` scales sets/rounds, `intensity`
// is %1RM. Overreach camps sit straight after a deload so the depressed
// chronic load amplifies the ACWR spike (worst realistic case).
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

interface DemoMovement { id: number; name: string; pattern: string; base1rm: number }
const LIFTS: DemoMovement[] = [
  { id: 1, name: 'Competition Squat', pattern: 'squat',  base1rm: 150 },
  { id: 2, name: 'Deadlift',          pattern: 'hinge',  base1rm: 185 },
  { id: 3, name: 'Competition Bench', pattern: 'push_h', base1rm: 107.5 },
  { id: 4, name: 'Overhead Press',    pattern: 'push_v', base1rm: 62.5 },
  { id: 5, name: 'Barbell Row',       pattern: 'pull_h', base1rm: 92.5 },
  { id: 6, name: 'Weighted Pull-up',  pattern: 'pull_v', base1rm: 102.5 },
];
const BJJ: DemoMovement = { id: 7, name: 'BJJ Sparring Round', pattern: 'locomotion', base1rm: 0 };
// UTC weekday -> session plan (0=Sun). Sundays are always rest.
const WEEKDAY_LIFTS: Record<number, number[]> = { 1: [1, 3], 3: [2, 5], 5: [1, 4, 6] };
const WEEKDAY_BJJ = new Set([2, 4, 6]);
const REPS_BY_PHASE: Record<Phase, number> = {
  accumulation: 8, intensification: 5, realization: 5, deload: 6,
};

// ---------------------------------------------------------------------------
// 002 compaction statements (UTC variant used by both seeder and demo loader;
// the future wearable-sync job will use the localtime variant from 002).
// ---------------------------------------------------------------------------
export const SPO2_FOLD_SQL = `
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
    sample_count = excluded.sample_count;`;

export const SPO2_TRIM_SQL = 'DELETE FROM spo2_sample WHERE epoch_ms < ?';

// ---------------------------------------------------------------------------
// Generator (caller owns BEGIN/COMMIT; schema must already exist)
// ---------------------------------------------------------------------------
export interface DemoReport {
  restDays: number;
  sessions: number;
  sets: number;
  overreachDates: string[];
}

export function generateDemoHistory(
  db: DemoSql,
  endDate: string,
  days: number = DEMO_DAYS,
): DemoReport {
  const rng = mulberry32(DEMO_SEED);
  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  const dateOf = (i: number): string =>
    new Date(endMs - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
  const weekOf = (i: number): number => Math.min(WEEK_PLAN.length - 1, Math.floor(i / 7));
  const lastId = (): number =>
    Number(db.one<{ id: number }>('SELECT last_insert_rowid() AS id')!.id);

  db.run('INSERT INTO macro_cycle (macro_cycle_id, name, goal, start_date) VALUES (?,?,?,?)',
    [1, 'Block A: Base + Comp Camp', 'strength', dateOf(0)]);
  db.run('INSERT INTO macro_cycle (macro_cycle_id, name, goal, start_date) VALUES (?,?,?,?)',
    [2, 'Block B: Rebuild + Second Camp', 'strength', dateOf(13 * 7)]);
  WEEK_PLAN.forEach((w, gw) =>
    db.run('INSERT INTO micro_cycle (micro_cycle_id, macro_cycle_id, week_index, phase) VALUES (?,?,?,?)',
      [gw + 1, gw < 13 ? 1 : 2, (gw % 13) + 1, w.phase]));
  // OR IGNORE: migration 007 seeds the movement library with ids 1..7
  // byte-identical to this list, so both paths coexist on any install.
  for (const m of [...LIFTS, BJJ]) {
    db.run('INSERT OR IGNORE INTO movement (movement_id, name, pattern) VALUES (?,?,?)',
      [m.id, m.name, m.pattern]);
  }

  // EWMA of normalized daily load, time constant ~4 days so a 2-week camp
  // reaches its fatigue plateau by mid-week-1. Steady accumulation sits near
  // fatigue 0.9, deloads recover to ~0.4, overreach camps plateau ~1.6.
  let fatigue = 0.8;
  let sessions = 0;
  let sets = 0;
  let restDays = 0;
  const overreachDates: string[] = [];

  for (let i = 0; i < days; i++) {
    const date = dateOf(i);
    const dayMs = endMs - (days - 1 - i) * 86_400_000;
    const week = WEEK_PLAN[weekOf(i)];
    const dow = new Date(dayMs).getUTCDay();
    if (week.overreach) overreachDates.push(date);

    // --- morning biometrics reflect ACCUMULATED fatigue (inverse coupling).
    // Parasympathetic withdrawal accelerates past fatigue ~1.1 (functional
    // overreaching): linear suppression + quadratic excess term.
    const hrvDrive = 0.40 * fatigue + 0.35 * Math.max(0, fatigue - 1.1) ** 2;
    const rmssd = clamp(95 * Math.exp(-hrvDrive) * Math.exp(gauss(rng, 0, 0.05)), 25, 140);
    db.run('INSERT INTO hrv_daily (date, rmssd_ms, sdnn_ms, resting_hr) VALUES (?,?,?,?)', [
      date,
      roundTo(rmssd, 0.1),
      roundTo(clamp(rmssd * 1.35 + gauss(rng, 0, 4), 30, 190), 0.1),
      roundTo(clamp(50 + 7 * fatigue + gauss(rng, 0, 1.5), 40, 90), 1),
    ]);

    const inBed = roundTo(clamp(465 + gauss(rng, 0, 25), 390, 555), 1);
    // Sleep disturbance accelerates in functional overreaching, mirroring the
    // HRV term: linear fatigue cost + steeper excess past the 1.1 threshold.
    const eff = clamp(93 - 6 * fatigue - 5.0 * Math.max(0, fatigue - 1.1) + gauss(rng, 0, 2), 60, 98);
    const asleep = roundTo(inBed * eff / 100, 1);
    db.run(
      'INSERT INTO sleep_daily (date, in_bed_min, asleep_min, deep_min, rem_min, light_min, latency_min, interruptions) VALUES (?,?,?,?,?,?,?,?)',
      [
        date, inBed, asleep,
        roundTo(asleep * clamp(0.21 - 0.02 * fatigue + gauss(rng, 0, 0.015), 0.10, 0.26), 1),
        roundTo(asleep * clamp(0.23 - 0.015 * fatigue + gauss(rng, 0, 0.015), 0.12, 0.28), 1),
        roundTo(asleep * 0.50, 1),
        roundTo(clamp(8 + 6 * fatigue + gauss(rng, 0, 3), 2, 75), 1),
        Math.round(clamp(1 + 1.6 * fatigue + gauss(rng, 0, 0.8), 0, 9)),
      ],
    );

    const spo2Mean = clamp(96.8 - 0.5 * fatigue + gauss(rng, 0, 0.3), 90, 99.4);
    db.run('INSERT INTO spo2_daily (date, mean_pct, min_pct, pct_time_below_90, sample_count) VALUES (?,?,?,?,?)', [
      date,
      roundTo(spo2Mean, 0.1),
      roundTo(clamp(spo2Mean - 2.5 - rng() * 2, 85, spo2Mean), 0.1),
      roundTo(fatigue > 1.6 ? clamp((fatigue - 1.6) * 2.5 + rng(), 0, 9) : rng() * 0.4, 0.1),
      420,
    ]);
    // Raw high-frequency stream for the trailing 3 days (exercises the 002
    // ring buffer + fold; epochs kept inside the UTC date for determinism).
    if (i >= days - 3) {
      for (let s = 0; s < 420; s++) {
        db.run('INSERT INTO spo2_sample (epoch_ms, source, spo2_pct) VALUES (?,?,?)', [
          dayMs + (60 + s) * 60_000, 'wearable',
          roundTo(clamp(spo2Mean + gauss(rng, 0, 0.8), 88, 100), 0.1),
        ]);
      }
    }

    // --- mechanical load -----------------------------------------------------
    let dayTonnage = 0;
    const missProb = week.overreach ? 0.03 : week.phase === 'deload' ? 0.30 : 0.13;
    const lifts = WEEKDAY_LIFTS[dow];
    const trainsToday =
      (lifts !== undefined || WEEKDAY_BJJ.has(dow)) && dow !== 0 && rng() >= missProb;

    if (!trainsToday) {
      restDays += 1;
    } else if (lifts !== undefined) {
      db.run(
        'INSERT INTO session (micro_cycle_id, session_date, started_at_ms, duration_min, session_rpe) VALUES (?,?,?,?,?)',
        [weekOf(i) + 1, date, dayMs + 17 * 3_600_000,
          roundTo(clamp(55 + 30 * week.vol + gauss(rng, 0, 8), 30, 150), 1), null],
      );
      const sessionId = lastId();
      sessions += 1;
      let rpeSum = 0;
      let rpeN = 0;
      for (const movementId of lifts) {
        const mv = LIFTS[movementId - 1];
        const nSets = Math.round(clamp((lifts.length === 3 ? 3.2 : 4.2) * week.vol + gauss(rng, 0, 0.4), 2, 9));
        const reps = Math.round(clamp(REPS_BY_PHASE[week.phase] + Math.round(gauss(rng, 0, 0.7)), 2, 10));
        const load = roundTo(mv.base1rm * week.intensity * (1 + gauss(rng, 0, 0.015)), 2.5);
        for (let s = 1; s <= nSets; s++) {
          const rpe = roundTo(clamp(5.0 + (week.intensity - 0.6) * 14 + 0.5 * fatigue
            + 0.25 * s + gauss(rng, 0, 0.3), 5, 10), 0.5);
          db.run(
            'INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (?,?,?,?,?,?,?)',
            [sessionId, mv.id, s, reps, load, rpe, dayMs + 17 * 3_600_000 + sets],
          );
          dayTonnage += reps * load;
          rpeSum += rpe;
          rpeN += 1;
          sets += 1;
        }
      }
      db.run('UPDATE session SET session_rpe = ? WHERE session_id = ?',
        [roundTo(clamp(rpeSum / rpeN + gauss(rng, 0, 0.2), 1, 10), 0.5), sessionId]);
    } else {
      const rounds = Math.round(clamp((week.overreach ? 8.5 : 6) * week.vol + gauss(rng, 0, 0.7), 2, 16));
      db.run(
        'INSERT INTO session (micro_cycle_id, session_date, started_at_ms, duration_min, session_rpe) VALUES (?,?,?,?,?)',
        [weekOf(i) + 1, date, dayMs + 19 * 3_600_000,
          roundTo(rounds * 7 + 15, 1), roundTo(clamp(5.5 + week.vol + 0.4 * fatigue, 3, 10), 0.5)],
      );
      const sessionId = lastId();
      sessions += 1;
      for (let r = 1; r <= rounds; r++) {
        // One sparring round modeled as reps x partner-mass moved.
        db.run(
          'INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (?,?,?,?,?,?,?)',
          [sessionId, BJJ.id, r, 6, roundTo(75 + gauss(rng, 0, 5), 0.5),
            roundTo(clamp(6 + week.vol + 0.3 * fatigue + gauss(rng, 0, 0.4), 4, 10), 0.5),
            dayMs + 19 * 3_600_000 + r],
        );
        dayTonnage += 6 * 75;
        sets += 1;
      }
    }

    // --- evening fatigue update (drives tomorrow's biometrics) ----------------
    fatigue = clamp(fatigue * 0.78 + (dayTonnage / 5000) * 0.26, 0, 3);
  }

  return { restDays, sessions, sets, overreachDates };
}
