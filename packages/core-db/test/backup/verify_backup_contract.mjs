import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const backup = require('../.build/backup/index.js');

const digest = {
  sha256Hex(text) {
    return createHash('sha256').update(text, 'utf8').digest('hex');
  },
};

const input = {
  backupId: 'backup-fixture-001',
  createdAt: '2026-09-12T05:00:00.000Z',
  sourceAppVersion: '0.1.0',
  sourceSchemaVersion: 62,
  sourceMigrationSlot: 63,
  scope: 'single-athlete',
  dataSets: [
    {
      name: 'athlete.default.routine_template',
      identityFields: ['routine_template_id'],
      rows: [{ routine_template_id: 9, name: 'Friday strength', schema_type: 'standard' }],
    },
    {
      name: 'athlete.default.session',
      identityFields: ['session_id'],
      rows: [
        { session_id: 20, session_date: '2026-09-11', duration_min: 42, session_rpe: 7 },
        { session_id: 8, session_date: '2026-09-05', duration_min: 35, session_rpe: 6.5 },
      ],
    },
    {
      name: 'athlete.default.profile_ui_preference',
      identityFields: ['profile_slot_id'],
      rows: [{ profile_slot_id: 1, guided_detail_level: 'summary' }],
    },
    {
      name: 'athlete.default.athlete_profile',
      identityFields: ['profile_id'],
      rows: [{ profile_id: 1, objective: 'general', weekly_frequency: 3, equipment_inventory: ['bands', 'dumbbells'] }],
    },
    {
      name: 'athlete.default.history_import_session',
      identityFields: ['history_import_session_id'],
      rows: [{ history_import_session_id: 4, history_import_id: 2, session_date: '2025-12-01', duration_min: 30, session_rpe: 5 }],
    },
  ],
};

const serialized = backup.serializeBackup(input, digest);
const reordered = backup.serializeBackup({
  ...input,
  dataSets: [...input.dataSets].reverse().map((dataSet) => ({ ...dataSet, rows: [...dataSet.rows].reverse() })),
}, digest);
assert.equal(reordered, serialized, 'serialization must be deterministic across input ordering');

const parsed = backup.parseBackup(serialized, digest);
assert.equal(parsed.ok, true, 'representative profile/history/routine/preferences backup must parse');
assert.equal(backup.serializeBackup({
  backupId: parsed.envelope.manifest.backupId,
  createdAt: parsed.envelope.manifest.createdAt,
  sourceAppVersion: parsed.envelope.manifest.sourceAppVersion,
  sourceSchemaVersion: parsed.envelope.manifest.sourceSchemaVersion,
  sourceMigrationSlot: parsed.envelope.manifest.sourceMigrationSlot,
  scope: parsed.envelope.manifest.scope,
  dataSets: parsed.envelope.payload.dataSets,
}, digest), serialized, 'round trip must preserve bytes');

const tampered = serialized.replace('Friday strength', 'Friday maximal strength');
assert.deepEqual(backup.parseBackup(tampered, digest), {
  ok: false,
  code: 'checksum_mismatch',
  message: 'backup integrity checksum does not match its manifest and payload',
});

const canonical = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
};
const asObject = JSON.parse(serialized);
const schemaTampered = canonical({ ...asObject, manifest: { ...asObject.manifest, sourceSchemaVersion: 61 } });
const slotTampered = canonical({ ...asObject, manifest: { ...asObject.manifest, sourceMigrationSlot: 62 } });
assert.equal(backup.parseBackup(schemaTampered, digest).code, 'checksum_mismatch');
assert.equal(backup.parseBackup(slotTampered, digest).code, 'checksum_mismatch');
assert.equal(backup.parseBackup(canonical({ ...asObject, formatVersion: 2 }), digest).code, 'newer_version');
assert.equal(backup.parseBackup(canonical({ ...asObject, formatVersion: 0 }), digest).code, 'unsupported_version');
assert.equal(backup.parseBackup(canonical({ ...asObject, format: 'unknown-backup' }), digest).code, 'unknown_format');
assert.equal(backup.parseBackup(serialized.slice(0, -12), digest).code, 'invalid_json');
assert.equal(backup.parseBackup(`${serialized}\n`, digest).code, 'noncanonical_input');
assert.equal(backup.parseBackup(canonical({ ...asObject, unknownField: true }), digest).code, 'invalid_shape');
assert.equal(backup.parseBackup(canonical({ ...asObject, manifest: { ...asObject.manifest, createdAt: '2026-02-30T05:00:00.000Z' } }), digest).code, 'invalid_shape');
assert.throws(
  () => backup.serializeBackup({ ...input, createdAt: '2026-02-30T05:00:00.000Z' }, digest),
  (error) => error.code === 'invalid_shape',
  'impossible UTC dates must be rejected',
);

assert.throws(
  () => backup.serializeBackup({
    ...input,
    dataSets: [{ name: 'athlete.default.session', identityFields: ['session_id'], rows: [{ session_id: 1 }, { session_id: 1 }] }],
  }, digest),
  (error) => error.code === 'duplicate_identifier',
  'duplicate row identifiers must be refused',
);

const compatible = { readerSchemaVersion: 62, supportedSourceSchemaVersions: [62] };
assert.equal(backup.decideRestore('merge', parsed.envelope, compatible).code, 'merge_not_supported');
assert.equal(backup.decideRestore('replace', parsed.envelope, compatible).recoveryCopyRequired, true);
assert.equal(backup.decideRestore('replace', parsed.envelope, { readerSchemaVersion: 61, supportedSourceSchemaVersions: [62] }).code, 'newer_schema');
assert.equal(backup.decideRestore('replace', parsed.envelope, { readerSchemaVersion: 63, supportedSourceSchemaVersions: [63] }).code, 'schema_adapter_unavailable');

let state = backup.initialRestoreState();
state = backup.transitionRestore(state, { type: 'VALIDATE', backupId: 'backup-fixture-001' });
const cancelled = backup.transitionRestore(state, { type: 'CANCEL' });
assert.equal(cancelled.phase, 'cancelled');
const lowStorage = backup.transitionRestore(state, { type: 'LOW_STORAGE' });
assert.equal(lowStorage.phase, 'blocked_low_storage');
state = backup.transitionRestore(state, { type: 'RECOVERY_COPY_CONFIRMED' });
state = backup.transitionRestore(state, { type: 'BEGIN_REPLACE' });
state = backup.transitionRestore(state, { type: 'LOW_STORAGE' });
assert.equal(state.phase, 'rollback_required');
state = backup.transitionRestore(state, { type: 'ROLLBACK_CONFIRMED' });
assert.equal(state.phase, 'rolled_back');
assert.throws(
  () => backup.transitionRestore(backup.initialRestoreState(), { type: 'BEGIN_REPLACE' }),
  /invalid restore transition/,
  'replace cannot start before validation and a recovery copy',
);

// Mutation test: execute a compiled copy with the checksum comparison replaced
// by `false`. The known tamper survives that mutant, proving the real rejection
// above kills it. Production source/build bytes remain untouched.
const contractPath = join(import.meta.dirname, '..', '..', 'src', 'backup', 'contract.ts');
const sourceBefore = readFileSync(contractPath, 'utf8');
const buildDir = join(import.meta.dirname, '..', '.build', 'backup');
const builtContractPath = join(buildDir, 'contract.js');
const builtBefore = readFileSync(builtContractPath, 'utf8');
const mutantDir = mkdtempSync(join(tmpdir(), 'ak-backup-mutant-'));
try {
  cpSync(buildDir, mutantDir, { recursive: true });
  const mutantContractPath = join(mutantDir, 'contract.js');
  const mutantSource = readFileSync(mutantContractPath, 'utf8').replace(
    'checksumProvider.sha256Hex(integrityCanonical) !== manifest.integrityChecksum.digestHex',
    'false',
  );
  assert.notEqual(mutantSource, builtBefore, 'compiled checksum mutation anchor must remain live');
  writeFileSync(mutantContractPath, mutantSource, 'utf8');
  const mutant = require(join(mutantDir, 'index.js'));
  assert.equal(mutant.parseBackup(tampered, digest).ok, true, 'checksum mutant must demonstrate the tamper test is load-bearing');
} finally {
  rmSync(mutantDir, { recursive: true, force: true });
}
assert.equal(readFileSync(contractPath, 'utf8'), sourceBefore, 'mutation test must restore/retain source byte-identically');
assert.equal(readFileSync(builtContractPath, 'utf8'), builtBefore, 'mutation test must retain compiled contract byte-identically');

// Inventory gate: table sentinels cover every live durable table except the
// row-sentinel cutoff table. Ensure the audit lists the resulting 86 names.
const runnerSource = readFileSync(join(import.meta.dirname, '..', '..', 'src', 'migrationRunner.ts'), 'utf8');
const tableNames = [...runnerSource.matchAll(/type: 'table', name: '([^']+)'/g)].map((match) => match[1]);
assert.equal(new Set(tableNames).size, 85, 'live chain must have 85 unique table sentinels');
assert.match(runnerSource, /type: 'row',[\s\S]*?name: 'routine_template_contract_cutoff'/, 'cutoff must remain a row-level table sentinel');
const inventory = readFileSync(join(import.meta.dirname, '..', '..', '..', '..', 'docs', 'audits', 'accessible-coach', 'WO03_DURABLE_DATA_INVENTORY.md'), 'utf8');
for (const tableName of [...new Set(tableNames), 'routine_template_contract_cutoff']) {
  assert.ok(inventory.includes(`\`${tableName}\``), `inventory must list ${tableName}`);
}
assert.match(inventory, /Final live durable tables: 86/, 'inventory must state the complete live table count');

console.log('verify:backup PASS — deterministic round trip, manifest/payload integrity, compatibility, 86-table inventory, replace, cancel, low-storage, rollback');
