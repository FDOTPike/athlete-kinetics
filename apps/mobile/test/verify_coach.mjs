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
  addAthlete, renameAthlete, removeAthlete, setActiveAthlete,
  setAdvancedToolsUnlocked, activeEntry,
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
    assert.equal(reg.advancedToolsUnlocked, false);
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
  const unlocked = setAdvancedToolsUnlocked(defaultRegistry(), true);
  const { reg } = addAthlete(unlocked, 'Test Athlete B', 1712);
  const back = parseRegistry(serializeRegistry(reg));
  assert.deepEqual(back, reg);
});

check('advanced tools: strict boolean persists device-wide and explicit relock clears it', () => {
  const unlocked = setAdvancedToolsUnlocked(defaultRegistry(), true);
  assert.equal(parseRegistry(serializeRegistry(unlocked)).advancedToolsUnlocked, true);
  const switched = setActiveAthlete(addAthlete(unlocked, 'Alex', 7).reg, 'default');
  assert.equal(switched.advancedToolsUnlocked, true);
  assert.equal(setAdvancedToolsUnlocked(switched, false).advancedToolsUnlocked, false);
  assert.equal(parseRegistry('{"advancedToolsUnlocked":"true"}').advancedToolsUnlocked, false);
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

/**
 * The Coach Verification Lab's no-write boundary (P2-5).
 *
 * This used to be a DENYLIST of mutator names. A denylist can only refuse the
 * mutators someone already thought of: adding `saveRoutineTemplate` — or any
 * future write action — to the Lab screen would have passed silently. It is
 * now a CLOSED ALLOWLIST. Every store access in the screen must be a single
 * read selector, and the complete sorted selector set must equal the approved
 * set below. A new selector fails this gate until it is reviewed and listed.
 */
const APPROVED_LAB_SELECTORS = [
  'getMovementAvailabilityVerdicts',
  'loadCoachDiagnosticContext',
  'loadCoachMovementAccessContext',
  'loadMeasuredHistory',
  'movements',
  'profile',
  'today',
  'vector',
];

check('verification Lab core is pure and the UI is a CLOSED read-only selector allowlist', () => {
  const labCore = readFileSync(
    join(ROOT, 'apps', 'mobile', 'src', 'diagnostics', 'coachVerificationLab.ts'), 'utf-8');
  const labScreen = readFileSync(
    join(ROOT, 'apps', 'mobile', 'src', 'screens', 'CoachVerificationLabScreen.tsx'), 'utf-8');
  for (const forbidden of ['useStore', 'executeSync', 'Date.now', 'saveRegistry', "from 'react-native'"]) {
    assert.ok(!labCore.includes(forbidden), `pure Lab core must not contain ${forbidden}`);
  }

  // Structural extraction: every line touching the store must be either the
  // import or one canonical `const x = useStore((s) => s.name);` binding.
  // Destructuring, nested property reads, getState/setState and inline
  // selector expressions are all rejected before the name comparison runs.
  const importLine = /^import \{ useStore \} from '\.\.\/state\/useStore';$/;
  const selectorLine = /^\s*const \w+ = useStore\(\((\w+)\) => \1\.(\w+)\);$/;
  const selectors = [];
  for (const raw of labScreen.split(/\r?\n/)) {
    if (!/\buseStore\b/.test(raw)) continue;
    const line = raw.trimEnd();
    if (importLine.test(line.trim())) continue;
    const match = selectorLine.exec(line);
    assert.ok(match, `Lab store access must be one read selector per line, got: ${line.trim()}`);
    selectors.push(match[2]);
  }
  assert.ok(!/useStore\s*\.\s*(getState|setState)/.test(labScreen),
    'the Lab must never reach the store outside a subscribed read selector');
  assert.equal(selectors.length, new Set(selectors).size, 'each Lab selector must be bound once');
  assert.deepEqual(
    [...selectors].sort(),
    APPROVED_LAB_SELECTORS,
    'the Lab screen selector set changed. Review the new selector for write access, '
      + 'then add it to APPROVED_LAB_SELECTORS in this file.',
  );

  // The Lab shares only through the redacting serializer, never the raw report.
  assert.ok(labScreen.includes('serializeRedactedCoachReport(report)'),
    'the share sheet must carry the redacted serialization');
  assert.ok(!/JSON\.stringify\(\s*report/.test(labScreen),
    'the Lab must never share a raw report object');
});

check('loadCoachMovementAccessContext is a read-only projection of the access sidecars', () => {
  const storeSource = readFileSync(
    join(ROOT, 'apps', 'mobile', 'src', 'state', 'useStore.ts'), 'utf-8');
  const start = storeSource.indexOf('  loadCoachMovementAccessContext: () => {');
  assert.ok(start >= 0, 'loadCoachMovementAccessContext not found in useStore.ts');
  const end = storeSource.indexOf('\n  },', start);
  assert.ok(end > start, 'could not bound loadCoachMovementAccessContext');
  const body = storeSource.slice(start, end);
  for (const forbidden of ['INSERT', 'UPDATE', 'DELETE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'DROP', 'set(']) {
    assert.ok(!body.includes(forbidden), `the Lab access-context reader must not contain ${forbidden}`);
  }
  assert.ok(body.includes('loadCapabilityFacts(getDb())'),
    'the reader must project the compact access sidecars');
  assert.ok(body.includes('safetyExcludedMovementIdsFor('),
    'the reader must reuse the shared niggle-to-safety projection');
});

if (process.exitCode !== 1) console.log(`verify:coach — all ${n} checks green`);
