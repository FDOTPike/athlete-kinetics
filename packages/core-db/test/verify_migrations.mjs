/**
 * verify_migrations.mjs â€” runs the PRODUCTION migration runner
 * (migrationRunner.ts, compiled) against real SQLite in the three scenarios
 * that exist in the field:
 *   1. fresh install: all migrations apply synchronously, user_version
 *      correct, every sentinel object present, runner is idempotent on
 *      re-boot;
 *   2. poisoned DB (the 2026-06-11 device state): user_version=4 but
 *      migration 003's objects missing -> self-heal re-applies everything;
 *   3. failing migration: first failure rolls back, throws, user_version
 *      still points at the failed migration; fixing the migration and
 *      re-running completes the chain (the device "ln" scenario).
 *
 * Run:  npm run verify:migrations
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);
const { runMigrations, sentinelsMissing, SENTINELS } = require('./.build/migrationRunner.js');

const SCHEMA_DIR = join(import.meta.dirname, '..', 'src', 'schema');
const FILES = ['001_mechanical_input.sql', '002_telemetry.sql', '003_state_vector.sql',
  '005_subjective_report.sql', '006_user_profile.sql', '007_program_engine.sql',
  '008_taxonomy.sql', '009_periodization.sql'];
const MIGRATIONS = FILES.map((f) => readFileSync(join(SCHEMA_DIR, f), 'utf-8'));

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

// op-sqlite-shaped sync adapter; registers the math shims the device build
// now gets via SQLITE_ENABLE_MATH_FUNCTIONS.
function freshDb() {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON;');
  try { raw.prepare('SELECT ln(2.0), sqrt(2.0)').get(); } catch {
    raw.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
    raw.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
  }
  return {
    raw,
    executeSync(sql) {
      const isRead = /^\s*(SELECT|PRAGMA\s+user_version\s*;?\s*$)/i.test(sql);
      if (isRead) return { rows: raw.prepare(sql).all() };
      raw.exec(sql);
      return { rows: [] };
    },
  };
}
const uv = (db) => Number(db.raw.prepare('PRAGMA user_version').get().user_version);

// --- 1. fresh install ---------------------------------------------------------
console.log('[1] fresh install');
const a = freshDb();
runMigrations(a, MIGRATIONS);
check(`user_version = ${MIGRATIONS.length}`, uv(a) === MIGRATIONS.length, String(uv(a)));
check('all sentinels present', sentinelsMissing(a).length === 0,
  `${SENTINELS.length} checked`);
runMigrations(a, MIGRATIONS); // second boot
check('re-boot is a no-op (idempotent)', uv(a) === MIGRATIONS.length);

// --- 2. poisoned field DB (user_version lies) ----------------------------------
console.log('[2] poisoned DB: user_version=4 but 003 never applied');
const b = freshDb();
b.executeSync(MIGRATIONS[0]);
b.executeSync(MIGRATIONS[1]);
b.executeSync(MIGRATIONS[3]); // skip 003, like the async-race field state
b.executeSync(`PRAGMA user_version = ${MIGRATIONS.length};`);
check('precondition: state_vector missing', sentinelsMissing(b).includes('state_vector'));
runMigrations(b, MIGRATIONS);
check('self-heal restored every sentinel', sentinelsMissing(b).length === 0);
check('materialize prepares against healed schema', (() => {
  const sql = readFileSync(join(SCHEMA_DIR, '004_state_vector_materialize.sql'), 'utf-8')
    .replace(/^--.*$/gm, '');
  try { b.raw.prepare(sql); return true; } catch { return false; }
})());

// --- 3. failing migration: fail fast, recover on retry --------------------------
console.log('[3] failing migration mid-chain (the device "ln" scenario)');
const c = freshDb();
const broken = [...MIGRATIONS];
broken[2] = 'CREATE TABLE will_fail (x INTEGER); SELECT no_such_fn(1);';
let threw = false;
try { runMigrations(c, broken); } catch { threw = true; }
check('failure is thrown to the caller (boot shows it)', threw);
check('user_version stopped AT the failed migration', uv(c) === 2, String(uv(c)));
check('failed migration rolled back atomically', (() => {
  return c.raw.prepare("SELECT 1 FROM sqlite_master WHERE name='will_fail'").get() === undefined;
})());
runMigrations(c, MIGRATIONS); // "next app update ships the fixed migration"
check('retry with fixed migration completes the chain',
  uv(c) === MIGRATIONS.length && sentinelsMissing(c).length === 0);

// --- 4. 006 -> 007 upgrade: data lands in athlete_profile and SURVIVES self-heal -
console.log('[4] upgrade path: user_profile data -> athlete_profile (007)');
const d = freshDb();
// A device on the 006 build (raw exec: the current runner's SENTINELS already
// expect 007's tables, so the historical state must be staged without it).
for (let i = 0; i < 5; i++) d.executeSync(MIGRATIONS[i]);
d.executeSync('PRAGMA user_version = 5;');
d.executeSync(`UPDATE user_profile SET objective = 'strength', base_rpe_cap = 8.0,
  equipment_access = 'home_basic',
  injury_flags = '[{"region":"knee","note":"old MCL"}]' WHERE profile_id = 1`);
runMigrations(d, MIGRATIONS); // the app update ships 007
const migrated = d.raw.prepare('SELECT * FROM athlete_profile WHERE profile_id = 1').get();
check('customized row copied into athlete_profile',
  migrated.objective === 'strength' && migrated.base_rpe_cap === 8.0 &&
  migrated.injury_flags.includes('MCL'));
check('legacy equipment_access mapped to home inventory bundle',
  migrated.equipment_inventory === '["dumbbells","kettlebell","pullup_bar","bands","mats"]',
  migrated.equipment_inventory);
check('legacy user_profile dropped',
  d.raw.prepare("SELECT 1 FROM sqlite_master WHERE name='user_profile'").get() === undefined);
// Now the athlete sets 'hybrid' + a custom inventory, then the DB self-heals
// (sentinel missing) â€” the re-applied 006+007 must NOT reset either field.
d.executeSync(`UPDATE athlete_profile SET objective = 'hybrid',
  equipment_inventory = '["barbell","mats"]' WHERE profile_id = 1`);
d.executeSync('DROP VIEW v_readiness_inputs;'); // poison: forces full re-apply
runMigrations(d, MIGRATIONS);
const healed = d.raw.prepare('SELECT * FROM athlete_profile WHERE profile_id = 1').get();
check('self-heal re-apply preserves hybrid objective + custom inventory',
  healed.objective === 'hybrid' && healed.equipment_inventory === '["barbell","mats"]',
  `${healed.objective} / ${healed.equipment_inventory}`);
check('self-heal restored the dropped view',
  sentinelsMissing(d).length === 0 && uv(d) === MIGRATIONS.length);

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
