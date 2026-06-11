/**
 * seed-db.ts — deterministic 180-day synthetic athlete history (CLI).
 *
 * The generation logic lives in packages/core-db/src/demoData.ts and is
 * SHARED with the in-app "LOAD DEMO ATHLETE" first-run path — this script is
 * the verification harness around it: it runs the real schema through
 * node:sqlite, generates twice, hashes the materialized state_vector, and
 * asserts the dataset exhibits the physiology it claims to model (ACWR camp
 * spikes, inverse load<->HRV coupling, gap tolerance).
 *
 * Run (Node >= 24, no build step):
 *   node scripts/seed-db.ts [--end=YYYY-MM-DD] [--db=path/to/out.db]
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  DEMO_DAYS,
  DEMO_SEED,
  SPO2_FOLD_SQL,
  SPO2_TRIM_SQL,
  demoDates,
  generateDemoHistory,
  type DemoReport,
  type DemoSql,
  type SqlParam,
} from '../packages/core-db/src/demoData.ts';

const SCHEMA_DIR = join(import.meta.dirname, '..', 'packages', 'core-db', 'src', 'schema');
const DAYS = DEMO_DAYS;

// ---------------------------------------------------------------------------
// node:sqlite adapter implementing the shared DemoSql interface
// ---------------------------------------------------------------------------
interface Db extends DemoSql {
  raw: DatabaseSync;
}
function openDb(path: string): Db {
  const raw = new DatabaseSync(path);
  raw.exec('PRAGMA foreign_keys = ON;');
  // Math fns (ln/sqrt) need SQLITE_ENABLE_MATH_FUNCTIONS: the app build gets
  // it via the op-sqlite sqliteFlags config; node:sqlite may lack it -> shim.
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
    run(sql, params = []) {
      raw.prepare(sql).run(...(params as SqlParam[]));
    },
    one<T>(sql: string, params: readonly SqlParam[] = []) {
      return raw.prepare(sql).get(...(params as SqlParam[])) as T | undefined;
    },
  };
}
const stripLineComments = (sql: string): string => sql.replace(/^--.*$/gm, '');

// ---------------------------------------------------------------------------
// Seed = shared generator + fold/trim + 004 materialization + hash
// ---------------------------------------------------------------------------
function seedInto(db: Db, endDate: string): DemoReport & { hash: string } {
  for (const f of ['001_mechanical_input.sql', '002_telemetry.sql', '003_state_vector.sql']) {
    db.raw.exec(readFileSync(join(SCHEMA_DIR, f), 'utf-8'));
  }

  db.raw.exec('BEGIN');
  const report = generateDemoHistory(db, endDate, DAYS);
  db.raw.exec('COMMIT');

  db.raw.exec('BEGIN');
  db.raw.exec(SPO2_FOLD_SQL);
  db.run(SPO2_TRIM_SQL, [Date.parse(`${endDate}T00:00:00Z`) - 14 * 86_400_000]);
  db.raw.exec('COMMIT');

  const upsert = db.raw.prepare(
    stripLineComments(readFileSync(join(SCHEMA_DIR, '004_state_vector_materialize.sql'), 'utf-8')));
  db.raw.exec('BEGIN');
  for (const date of demoDates(endDate, DAYS)) upsert.run(date);
  db.raw.exec('COMMIT');

  const h = createHash('sha256');
  for (const r of db.raw.prepare('SELECT * FROM state_vector ORDER BY date').all() as Record<string, unknown>[]) {
    h.update(Object.entries(r)
      .filter(([k]) => k !== 'computed_at_ms')   // wall-clock, excluded
      .map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(5) : String(v)}`)
      .join('|') + '\n');
  }
  return { ...report, hash: h.digest('hex') };
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

  console.log(`Seeding ${DAYS} days ending ${endDate} (seed 0x${DEMO_SEED.toString(16)})\n`);

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
  // Thresholds calibrated across all 7 weekday alignments (min observed
  // contrasts: readiness ~11, HRV ~7.8ms): demand a large effect, with
  // margin so a calendar shift can't flake the suite.
  check('readiness: camp << accumulation', camp.r < acc.r - 10,
    `camp=${camp.r.toFixed(1)} acc=${acc.r.toFixed(1)}`);
  check('HRV rMSSD: camp << accumulation', camp.hrv < acc.hrv - 6.5,
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
