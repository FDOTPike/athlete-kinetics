/**
 * verify_store_sql.mjs — extracts every SQL literal from useStore.ts and
 * PREPARES it against the real migrated schema. sqlite3_prepare validates
 * tables, columns, and syntax, so a typo'd column in the store's DAO layer
 * fails here instead of at runtime on a device.
 *
 * Run:  node apps/mobile/test/verify_store_sql.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const SCHEMA_DIR = join(ROOT, 'packages', 'core-db', 'src', 'schema');

const db = new DatabaseSync(':memory:');
try { db.prepare('SELECT ln(2.0), sqrt(2.0)').get(); } catch {
  db.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
  db.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
}
for (const f of ['001_mechanical_input.sql', '002_telemetry.sql', '003_state_vector.sql',
  '005_subjective_report.sql', '006_user_profile.sql', '007_program_engine.sql',
  '008_taxonomy.sql']) {
  db.exec(readFileSync(join(SCHEMA_DIR, f), 'utf-8'));
}

const src = readFileSync(join(ROOT, 'apps', 'mobile', 'src', 'state', 'useStore.ts'), 'utf-8');
const statements = [...src.matchAll(/executeSync\(\s*(?:'([^']+)'|`([^`]+)`|"([^"]+)")/g)]
  .map((m) => m[1] ?? m[2] ?? m[3]);
// The store also executes MATERIALIZE_STATE_VECTOR_SQL from @ak/core-db.
statements.push(
  readFileSync(join(SCHEMA_DIR, '004_state_vector_materialize.sql'), 'utf-8')
    .replace(/^--.*$/gm, ''),
);

let fail = 0;
console.log(`[store DAO SQL] preparing ${statements.length} statements against live schema`);
for (const sql of statements) {
  const head = sql.replace(/\s+/g, ' ').trim().slice(0, 72);
  try {
    db.prepare(sql);
    console.log(`  PASS  ${head}`);
  } catch (e) {
    console.log(`  FAIL  ${head}\n        ${e instanceof Error ? e.message : e}`);
    fail += 1;
  }
}
// Wiring tripwires: mutation testing (2026-06-12) proved the layer-3 chain
// could be silently unwired with every gate green. The pure derivation is
// verified in verify:policy [6]; these assert the store actually routes
// through it and guards date rollover.
console.log('[store wiring]');
for (const needle of ['derivePrescription(', 'rolloverDay', 'localToday()']) {
  const ok = src.includes(needle);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  store references ${needle}`);
  if (!ok) fail += 1;
}

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} STATEMENT(S) FAILED`}`);
process.exit(fail ? 1 : 0);
