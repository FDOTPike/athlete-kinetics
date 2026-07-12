/**
 * verify_coach.mjs — Coach Mode athlete-registry gate.
 *
 * Executes the compiled pure core (athleteRegistryCore) and machine-checks its
 * documented invariants I1-I5, plus the cross-source constant pin between
 * LEGACY_DB_NAME and core-db's DB_NAME (no import edge — the registry core is
 * dependency-free by design, so the pin is checked against the pragmas SOURCE).
 *
 * Run:  npm run verify:coach
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = join(import.meta.dirname, '..', '..', '..');
const core = require(join(import.meta.dirname, '.build', 'athleteRegistryCore.js'));

const {
  DEFAULT_ATHLETE_ID, LEGACY_DB_NAME,
  defaultRegistry, parseRegistry, serializeRegistry, sanitizeName,
  addAthlete, renameAthlete, removeAthlete, setActiveAthlete, activeEntry,
} = core;

let n = 0;
const check = (name, fn) => {
  n++;
  try {
    fn();
    console.log(`  [${n}] PASS ${name}`);
  } catch (e) {
    console.error(`  [${n}] FAIL ${name}\n      ${e.message}`);
    process.exitCode = 1;
  }
};

console.log('verify:coach — athlete registry core');

// --- I5: total parse -------------------------------------------------------
check('parse: garbage input yields the default registry', () => {
  for (const bad of ['', 'not json', '[]', '{"version":9}', '{"athletes":42}', 'null']) {
    const reg = parseRegistry(bad);
    assert.equal(reg.version, 1);
    assert.equal(reg.activeId, DEFAULT_ATHLETE_ID);
    assert.equal(reg.athletes.length, 1);
    assert.equal(reg.athletes[0].dbName, LEGACY_DB_NAME);
  }
});

check('parse: invalid entries are skipped, valid ones kept', () => {
  const reg = parseRegistry(JSON.stringify({
    version: 1,
    activeId: 'abc',
    athletes: [
      { id: 'default', name: 'Me', dbName: LEGACY_DB_NAME, createdAtMs: 5 },
      { id: 'abc', name: 'Alex', dbName: 'ak_athlete_abc.db', createdAtMs: 9 },
      { id: 'evil', name: 'X', dbName: '../../../etc/passwd' },        // path escape
      { id: 'mismatch', name: 'Y', dbName: 'ak_athlete_other.db' },    // id/db mismatch
      { id: 'UPPER', name: 'Z', dbName: 'ak_athlete_UPPER.db' },       // charset
      { id: 'abc', name: 'Dup', dbName: 'ak_athlete_abc.db' },         // duplicate
    ],
  }));
  assert.deepEqual(reg.athletes.map((e) => e.id), ['default', 'abc']);
  assert.equal(reg.activeId, 'abc');
});

// --- I1 + I2: default present, activeId repaired ---------------------------
check('parse: missing default is re-inserted; dangling activeId repaired', () => {
  const reg = parseRegistry(JSON.stringify({
    version: 1, activeId: 'ghost',
    athletes: [{ id: 'abc', name: 'Alex', dbName: 'ak_athlete_abc.db', createdAtMs: 1 }],
  }));
  assert.equal(reg.athletes[0].id, DEFAULT_ATHLETE_ID);
  assert.equal(reg.athletes[0].dbName, LEGACY_DB_NAME);
  assert.equal(reg.activeId, DEFAULT_ATHLETE_ID);
});

check("parse: a 'default' entry pointing at a non-legacy file is rejected", () => {
  const reg = parseRegistry(JSON.stringify({
    version: 1, activeId: 'default',
    athletes: [{ id: 'default', name: 'Hijack', dbName: 'ak_athlete_default.db', createdAtMs: 1 }],
  }));
  assert.equal(reg.athletes[0].dbName, LEGACY_DB_NAME); // re-inserted clean
});

// --- I3: id/db generation --------------------------------------------------
check('add: generated names/ids/dbs are unique and well-formed', () => {
  let reg = defaultRegistry();
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    const out = addAthlete(reg, 'Alex', 1700000000000); // same ms every time
    reg = out.reg;
    assert.match(out.entry.dbName, /^ak_athlete_[a-z0-9]+\.db$/);
    assert.equal(out.entry.dbName, `ak_athlete_${out.entry.id}.db`);
    assert.notEqual(out.entry.dbName, LEGACY_DB_NAME);
    assert.ok(!seen.has(out.entry.id), 'id collision');
    seen.add(out.entry.id);
  }
  const names = reg.athletes.map((e) => e.name);
  assert.equal(new Set(names).size, names.length, 'display-name collision');
});

check('add: round-trips through serialize/parse unchanged', () => {
  const { reg } = addAthlete(defaultRegistry(), 'Test Athlete B', 1712);
  const back = parseRegistry(serializeRegistry(reg));
  assert.deepEqual(back, reg);
});

// --- I4: removal guards ----------------------------------------------------
check('remove: active, default, and last entries are protected', () => {
  let { reg } = addAthlete(defaultRegistry(), 'Alex', 1);
  const alexId = reg.athletes[1].id;
  assert.equal(removeAthlete(reg, DEFAULT_ATHLETE_ID).removed, null); // default
  reg = setActiveAthlete(reg, alexId);
  assert.equal(removeAthlete(reg, alexId).removed, null);             // active
  reg = setActiveAthlete(reg, DEFAULT_ATHLETE_ID);
  const out = removeAthlete(reg, alexId);                             // legal
  assert.equal(out.removed.id, alexId);
  assert.equal(out.reg.athletes.length, 1);
  assert.equal(removeAthlete(out.reg, DEFAULT_ATHLETE_ID).removed, null); // last
});

check('setActive: unknown id is a no-op', () => {
  const reg = defaultRegistry();
  assert.equal(setActiveAthlete(reg, 'nope').activeId, DEFAULT_ATHLETE_ID);
  assert.equal(activeEntry(reg).id, DEFAULT_ATHLETE_ID);
});

// --- name hygiene ----------------------------------------------------------
check('sanitizeName: trims, collapses, caps, never empty', () => {
  assert.equal(sanitizeName('  Big   Mike  ', 'x'), 'Big Mike');
  assert.equal(sanitizeName('', 'Fallback'), 'Fallback');
  assert.equal(sanitizeName('   ', 'Fallback'), 'Fallback');
  assert.ok(sanitizeName('A'.repeat(99), 'x').length <= 24);
});

// --- cross-source constant pin --------------------------------------------
check('LEGACY_DB_NAME matches core-db DB_NAME (source pin)', () => {
  const pragmas = readFileSync(
    join(ROOT, 'packages', 'core-db', 'src', 'pragmas.ts'), 'utf-8');
  const m = pragmas.match(/export const DB_NAME = '([^']+)'/);
  assert.ok(m, 'DB_NAME not found in pragmas.ts');
  assert.equal(LEGACY_DB_NAME, m[1]);
});

// --- registry file name is used by the IO shell (source pin) ---------------
check('IO shell reads/writes REGISTRY_FILE in the document dir', () => {
  const shell = readFileSync(
    join(ROOT, 'apps', 'mobile', 'src', 'state', 'athleteRegistry.ts'), 'utf-8');
  assert.ok(shell.includes('REGISTRY_FILE'), 'shell must use the shared constant');
  assert.ok(shell.includes('DocumentDir'), 'registry must live in the document dir');
  assert.ok(!shell.match(/from 'react-native-blob-util'/), 'blob-util must be deferred-required, not imported');
});

if (process.exitCode !== 1) console.log(`verify:coach — all ${n} checks green`);
