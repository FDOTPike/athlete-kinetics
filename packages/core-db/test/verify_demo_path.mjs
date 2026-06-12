/**
 * verify_demo_path.mjs â€” simulates the app's first-run path EXACTLY as
 * useStore executes it (same statements, same order, same adapter shape):
 *   migrate -> boot catch-up materialize -> guard check -> loadDemoAthlete
 *   (generate + fold + trim + materialize-all in one transaction) -> reload.
 * Then asserts the UI's queries would have data, the guard refuses a second
 * load, and the boot catch-up is idempotent.
 *
 * Run AFTER tsc emits demoData to test/.build (npm run verify:demo).
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);
const demo = require('./.build/demoData.js');

const SCHEMA_DIR = join(import.meta.dirname, '..', 'src', 'schema');
const stripComments = (sql) => sql.replace(/^--.*$/gm, '');
const MATERIALIZE = stripComments(
  readFileSync(join(SCHEMA_DIR, '004_state_vector_materialize.sql'), 'utf-8'));

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

const raw = new DatabaseSync(':memory:');
raw.exec('PRAGMA foreign_keys = ON;');
try { raw.prepare('SELECT ln(2.0), sqrt(2.0)').get(); } catch {
  raw.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
  raw.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
}
const adapter = {
  run: (sql, params = []) => { raw.prepare(sql).run(...params); },
  one: (sql, params = []) => raw.prepare(sql).get(...params),
};
const today = new Date().toISOString().slice(0, 10);

console.log('[1] boot path on an EMPTY database');
for (const f of ['001_mechanical_input.sql', '002_telemetry.sql', '003_state_vector.sql',
  '005_subjective_report.sql', '006_user_profile.sql', '007_program_engine.sql',
  '008_taxonomy.sql', '009_periodization.sql']) {
  raw.exec(readFileSync(join(SCHEMA_DIR, f), 'utf-8'));
}
for (const date of demo.demoDates(today, 7)) adapter.run(MATERIALIZE, [date]);
check('catch-up materialize on empty DB is a clean no-op',
  Number(raw.prepare('SELECT count(*) c FROM state_vector').get().c) === 0);

console.log('[2] loadDemoAthlete path');
const guard = raw.prepare('SELECT count(*) AS c FROM session').get();
check('guard sees empty session table', Number(guard.c) === 0);
raw.exec('BEGIN');
const report = demo.generateDemoHistory(adapter, today, demo.DEMO_DAYS);
raw.exec(demo.SPO2_FOLD_SQL);
adapter.run(demo.SPO2_TRIM_SQL, [Date.now() - 14 * 86_400_000]);
for (const date of demo.demoDates(today, demo.DEMO_DAYS)) adapter.run(MATERIALIZE, [date]);
raw.exec('COMMIT');
check(`demo generated (${report.sessions} sessions, ${report.sets} sets)`,
  report.sessions > 100 && report.sets > 1000);
check('state_vector fully materialized',
  Number(raw.prepare('SELECT count(*) c FROM state_vector').get().c) === demo.DEMO_DAYS);

console.log('[3] the UI queries the store actually runs');
const sv = raw.prepare('SELECT * FROM state_vector WHERE date = ?').get(today);
check("today's row exists (ReadinessScreen point lookup)", sv !== undefined,
  sv ? `R=${sv.readiness_score.toFixed(1)}` : 'missing');
const trend = raw.prepare(
  "SELECT date, readiness_score FROM state_vector WHERE date >= date(?, '-13 days') ORDER BY date",
).all(today);
check('14-day trend query returns 14 rows', trend.length === 14, String(trend.length));
const movements = raw.prepare(
  'SELECT movement_id, name, pattern FROM movement ORDER BY movement_id').all();
check('movement library populated for SessionScreen (007 seed = 30)',
  movements.length === 30, String(movements.length));
// 007 and the demo loader both write movements 1..7 (OR IGNORE) â€” prove the
// coexistence holds: ids 1..7 carry the demo names, not duplicates.
check('demo ids 1..7 identical to 007 seed (no duplicate library)',
  movements[0].name === 'Competition Squat' &&
  movements[6].name === 'BJJ Sparring Round' &&
  movements.filter((m) => m.name === 'Competition Squat').length === 1);

console.log('[4] guards and idempotency');
check('guard now refuses a second demo load',
  Number(raw.prepare('SELECT count(*) AS c FROM session').get().c) > 0);
const before = raw.prepare(
  'SELECT readiness_score r FROM state_vector WHERE date = ?').get(today).r;
for (const date of demo.demoDates(today, 7)) adapter.run(MATERIALIZE, [date]);
const after = raw.prepare(
  'SELECT readiness_score r FROM state_vector WHERE date = ?').get(today).r;
check('boot catch-up re-run is idempotent', before === after, `${before} == ${after}`);
check('row count unchanged after catch-up',
  Number(raw.prepare('SELECT count(*) c FROM state_vector').get().c) === demo.DEMO_DAYS);

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
