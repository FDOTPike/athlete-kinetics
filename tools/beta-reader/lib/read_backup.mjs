// Off-phone reader for an encrypted pikeMethods beta backup (.pmbak).
// Local tool. Not shipped in the app, not in CI.
//
// Steps: validate the consent manifest and the output folder (before any
// password is asked for); compile the backup contract from this repository;
// check the container; ask for the password; open with the repository's
// openBackup; decode only the consenting athletes' databases; verify each
// declared size and digest; open each copy read-only; check integrity and the
// declared schema; run the reading plan's queries; write the outputs; delete
// every disposable copy.
//
// Nothing here writes to the backup file or to any app database. Athletes not
// in the manifest are never decoded.
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { compileContract } from './compile_contract.mjs';
import { nodeCryptoProvider } from './node_crypto.mjs';
import { addCountsInto, QUERIES, QUERY_SET_VERSION, sqlSha256 } from './reading_queries.mjs';

export const TOOL_VERSION = 'beta-reader/1';
const libDir = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPO_ROOT = resolve(libDir, '..', '..', '..');
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SQLITE_HEADER = 'SQLite format 3\u0000';
const MAX_BACKUP_BYTES = 16 * 1024 * 1024;

export class ReaderError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ReaderError';
    this.code = code;
  }
}

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const sha256Of = (bytes) => createHash('sha256').update(bytes).digest('hex');
const isInside = (folder, candidate) => {
  const offset = relative(resolve(folder), resolve(candidate));
  return offset === '' || (offset.split(sep)[0] !== '..' && !isAbsolute(offset));
};

export function readManifest(manifestPath) {
  let document;
  try {
    document = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    throw new ReaderError('manifest_invalid', 'The consent manifest is not readable JSON.');
  }
  if (!isRecord(document) || document.manifestVersion !== 1 || !Array.isArray(document.entries)) {
    throw new ReaderError('manifest_invalid', 'The consent manifest needs manifestVersion 1 and an entries array.');
  }
  if (document.entries.length === 0) throw new ReaderError('no_consenting_athletes', 'The consent manifest lists no consenting athletes.');
  const codes = new Set();
  const ids = new Set();
  return document.entries.map((entry, index) => {
    const fail = (field) => new ReaderError('manifest_invalid', `Manifest entry ${index + 1}: ${field} is missing or invalid.`);
    if (!isRecord(entry)) throw fail('the entry');
    if (entry.consented !== true) {
      throw new ReaderError('manifest_invalid', `Manifest entry ${index + 1}: only consenting athletes may be listed (consented must be true). Others are never opened.`);
    }
    if (typeof entry.athleteId !== 'string' || !/^[a-z0-9]{1,40}$/.test(entry.athleteId)) throw fail('athleteId');
    if (typeof entry.participantCode !== 'string' || !/^[A-Za-z0-9-]{1,24}$/.test(entry.participantCode)) throw fail('participantCode');
    if (typeof entry.consentVersion !== 'string' || entry.consentVersion.trim() === '') throw fail('consentVersion');
    if (typeof entry.startDate !== 'string' || !DATE.test(entry.startDate)) throw fail('startDate');
    if (typeof entry.endDate !== 'string' || !DATE.test(entry.endDate) || entry.endDate < entry.startDate) throw fail('endDate');
    if (codes.has(entry.participantCode) || ids.has(entry.athleteId)) {
      throw new ReaderError('manifest_invalid', 'Each athlete and participant code may appear once in the manifest.');
    }
    codes.add(entry.participantCode);
    ids.add(entry.athleteId);
    const hasBounds = entry.startMs !== undefined || entry.endMs !== undefined || entry.timezoneId !== undefined;
    if (hasBounds) {
      if (!Number.isSafeInteger(entry.startMs) || entry.startMs < 0) throw fail('startMs');
      if (!Number.isSafeInteger(entry.endMs) || entry.endMs <= entry.startMs) throw fail('endMs');
      if (typeof entry.timezoneId !== 'string' || entry.timezoneId.trim() === '') throw fail('timezoneId');
    }
    return {
      athleteId: entry.athleteId,
      participantCode: entry.participantCode,
      consentVersion: entry.consentVersion,
      startDate: entry.startDate,
      endDate: entry.endDate,
      startMs: hasBounds ? entry.startMs : null,
      endMs: hasBounds ? entry.endMs : null,
      timezoneId: hasBounds ? entry.timezoneId : null,
    };
  });
}

// The same schema read as the backup contract test uses
// (packages/core-db/test/backup/verify_backup_contract.mjs:79-84).
function schemaObjectsOf(db) {
  return db.prepare("SELECT type,name,tbl_name,coalesce(sql,'') AS sql FROM sqlite_master WHERE type IN ('table','index','trigger') AND name NOT GLOB 'sqlite_*' ORDER BY type,name").all()
    .map((object) => [object.type, object.name, object.tbl_name, object.sql, object.type === 'table'
      ? db.prepare(`PRAGMA table_info("${object.name.replaceAll('"', '""')}")`).all()
        .map((column) => [column.cid, column.name, column.type, column.notnull, column.dflt_value, column.pk]) : []]);
}

function tableNamesOf(db) {
  return new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
}

function wipe(folder) {
  let entries = [];
  try { entries = readdirSync(folder, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const path = join(folder, entry.name);
    if (entry.isFile()) { try { chmodSync(path, 0o666); } catch { /* removed below */ } }
  }
  rmSync(folder, { recursive: true, force: true });
}

function writeNew(path, document) {
  try {
    writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if (error && error.code === 'EEXIST') throw new ReaderError('output_exists', 'An output file with this label already exists in that folder. Choose another label or folder.');
    throw error;
  }
}

export async function readBackup(options) {
  const {
    backupPath, manifestPath, outDir, label = 'reading', includeFreeText = false,
    promptPassword, workBase = tmpdir(), repoRoot = DEFAULT_REPO_ROOT,
  } = options;
  if (typeof promptPassword !== 'function') {
    throw new ReaderError('interactive_required', 'The backup password is asked for on an interactive terminal only.');
  }
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(label)) throw new ReaderError('label_invalid', 'The label may use letters, digits, dot, underscore and dash (up to 40).');
  if (isInside(repoRoot, outDir)) throw new ReaderError('output_inside_repository', 'The output folder is inside the repository. Choose a folder outside it, so private outputs cannot be committed.');
  if (isInside(repoRoot, workBase)) throw new ReaderError('output_inside_repository', 'The working folder is inside the repository. Choose a folder outside it.');
  const names = {
    aggregate: join(outDir, `READING_AGGREGATE_${label}.json`),
    private: join(outDir, `PRIVATE_PER_ATHLETE_${label}.json`),
    freeText: join(outDir, `PRIVATE_FREE_TEXT_${label}.json`),
  };
  for (const path of includeFreeText ? Object.values(names) : [names.aggregate, names.private]) {
    if (statSafe(path)) throw new ReaderError('output_exists', 'An output file with this label already exists in that folder. Choose another label or folder.');
  }
  const entries = readManifest(manifestPath);

  let backupBytes;
  try {
    const size = statSync(backupPath).size;
    if (size > MAX_BACKUP_BYTES) throw new ReaderError('backup_too_large', 'The backup file is larger than this version can read.');
    backupBytes = readFileSync(backupPath);
  } catch (error) {
    if (error instanceof ReaderError) throw error;
    throw new ReaderError('backup_unreadable', 'The backup file could not be read.');
  }
  const backupSha256 = sha256Of(backupBytes);
  const text = backupBytes.toString('utf8');

  mkdirSync(workBase, { recursive: true });
  const workDir = mkdtempSync(join(workBase, 'ak-beta-reader-'));
  const openDatabases = [];
  try {
    let backup;
    try {
      backup = compileContract({ repoRoot, outDir: join(workDir, 'contract-build') });
    } catch {
      throw new ReaderError('contract_compile_failed', 'The backup contract did not compile from this checkout.');
    }
    if (!backup.isWellFormedBackupContainer(text)) {
      throw new ReaderError('backup_container', 'The file is not a complete encrypted pikeMethods backup.');
    }
    const password = await promptPassword();
    if (typeof password !== 'string' || password.length === 0) throw new ReaderError('password_missing', 'No password was entered.');
    const opened = await backup.openBackup(text, password, nodeCryptoProvider);
    if (!opened.ok) throw new ReaderError(opened.code, opened.message);
    const archive = opened.archive;

    const registry = new Map(archive.registry.athletes.map((athlete) => [athlete.id, athlete]));
    const contract = backup.backupSchemaContractFor(archive.sourceSchemaVersion, archive.sourceMigrationSlot);
    if (!contract) throw new ReaderError('schema_mismatch', 'The backup declares a schema this reader does not know.');
    for (const entry of entries) {
      if (!registry.has(entry.athleteId)) throw new ReaderError('athlete_not_in_backup', 'A manifest athlete is not in this backup. Check the consent manifest.');
    }

    // Decode and verify every consenting database before any analysis.
    const athletes = [];
    for (const entry of entries) {
      const snapshot = archive.databases.find((candidate) => candidate.athleteId === entry.athleteId);
      if (!snapshot) throw new ReaderError('athlete_not_in_backup', 'A manifest athlete has no database in this backup.');
      const bytes = backup.base64ToBytes(snapshot.databaseBase64, backup.MAX_DATABASE_BYTES);
      const header = String.fromCharCode(...bytes.subarray(0, SQLITE_HEADER.length));
      if (bytes.length !== snapshot.byteLength || header !== SQLITE_HEADER || sha256Of(bytes) !== snapshot.sha256Hex) {
        throw new ReaderError('database_corrupt', 'A database copy did not match its declared size or digest.');
      }
      const copyPath = join(workDir, `${entry.participantCode}.db`);
      writeFileSync(copyPath, bytes);
      chmodSync(copyPath, 0o444);
      const db = new DatabaseSync(copyPath, { readOnly: true });
      openDatabases.push(db);
      const integrity = db.prepare('PRAGMA integrity_check').all();
      if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
        throw new ReaderError('integrity_failed', 'A database copy failed PRAGMA integrity_check. No results were written.');
      }
      const foreignKeyRows = db.prepare('PRAGMA foreign_key_check').all().length;
      const userVersion = db.prepare('PRAGMA user_version').get().user_version;
      const schemaMatches = userVersion === archive.sourceSchemaVersion
        && backup.matchesBackupSchemaContract(schemaObjectsOf(db), contract, nodeCryptoProvider);
      if (!schemaMatches) {
        throw new ReaderError('schema_mismatch', 'A database copy does not match the schema the backup declares. No results were written.');
      }
      athletes.push({ entry, db, tables: tableNamesOf(db), foreignKeyRows });
    }

    // Run the reading plan's queries. A query that cannot run is reported with
    // its reason; it never becomes a zero.
    const perAthlete = athletes.map(({ entry, db, tables, foreignKeyRows }) => {
      const queries = {};
      const freeRows = {};
      for (const query of QUERIES) {
        const missingTable = query.tables.find((table) => !tables.has(table));
        if (query.bind === 'ms' && entry.startMs === null) {
          queries[query.name] = { status: 'not_run', reason: 'no_timestamp_bounds' };
        } else if (missingTable) {
          queries[query.name] = { status: 'not_run', reason: `missing_table:${missingTable}` };
        } else {
          try {
            const binds = query.bind === 'ms'
              ? { start_ms: entry.startMs, end_ms: entry.endMs }
              : { start_date: entry.startDate, end_date: entry.endDate };
            const rows = db.prepare(query.sql).all(binds);
            queries[query.name] = { status: 'ok', counts: query.analyse(rows) };
            if (includeFreeText && query.freeText) freeRows[query.name] = query.freeText(rows);
          } catch (error) {
            queries[query.name] = { status: 'error', reason: 'sql_error', message: String(error && error.message) };
          }
        }
      }
      return { entry, queries, freeRows, foreignKeyRows };
    });

    const aggregateQueries = {};
    for (const query of QUERIES) {
      const results = perAthlete.map((athlete) => athlete.queries[query.name]);
      const statuses = [...new Set(results.map((result) => result.status))].sort();
      const base = { sqlSha256: sqlSha256(query.name) };
      if (results.every((result) => result.status === 'ok')) {
        aggregateQueries[query.name] = { status: 'ok', ...base, counts: results.reduce((sum, result) => addCountsInto(sum, result.counts), {}) };
      } else {
        const reasons = [...new Set(results.filter((result) => result.status !== 'ok').map((result) => result.reason))].sort();
        aggregateQueries[query.name] = {
          status: statuses.includes('error') ? 'error' : 'incomplete', ...base,
          athletesNotOk: results.filter((result) => result.status !== 'ok').length, statuses, reasons,
        };
      }
    }

    const generatedAt = new Date().toISOString();
    const aggregate = {
      kind: 'de-identified-aggregate',
      label,
      tool: TOOL_VERSION,
      queryText: QUERY_SET_VERSION,
      generatedAt,
      input: {
        backupSha256, backupBytes: backupBytes.length, formatVersion: 1,
        sourceAppVersion: archive.sourceAppVersion, sourceSchemaVersion: archive.sourceSchemaVersion, sourceMigrationSlot: archive.sourceMigrationSlot,
      },
      athletes: { consented: entries.length, quarantined: archive.registry.athletes.length - entries.length, totalInBackup: archive.registry.athletes.length },
      integrity: {
        athletesChecked: athletes.length, integrityOk: athletes.length, foreignKeyViolationRows: perAthlete.reduce((sum, athlete) => sum + athlete.foreignKeyRows, 0),
        schemaMatchesDeclaredContract: athletes.length,
      },
      queries: aggregateQueries,
      notes: [
        'Counts only. Sums across consenting athletes. A query marked incomplete did not run for every athlete; no zero was substituted.',
        'Quarantined athletes (in the backup, not in the consent manifest) were never decoded.',
        'Effort counts are RPE pairs under the RPE 6 floor. No estimate is computed.',
      ],
    };
    const privateDocument = {
      kind: 'PRIVATE',
      warning: 'PRIVATE - owner only. Per-athlete counts keyed by participant code. Do not attach, paste or send this file to any adviser or reader; send them READING_AGGREGATE only.',
      label, tool: TOOL_VERSION, generatedAt,
      input: { backupSha256, backupId: archive.backupId, backupCreatedAt: archive.createdAt, sourceSchemaVersion: archive.sourceSchemaVersion, sourceMigrationSlot: archive.sourceMigrationSlot },
      athletes: perAthlete.map(({ entry, queries }) => ({
        participantCode: entry.participantCode,
        consentVersion: entry.consentVersion,
        window: { startDate: entry.startDate, endDate: entry.endDate, startMs: entry.startMs, endMs: entry.endMs, timezoneId: entry.timezoneId },
        queries,
      })),
    };

    mkdirSync(outDir, { recursive: true });
    writeNew(names.aggregate, aggregate);
    writeNew(names.private, privateDocument);
    let freeTextPath = null;
    if (includeFreeText) {
      const freeDocument = {
        kind: 'PRIVATE_FREE_TEXT',
        warning: 'PRIVATE - owner only. Free text as the athletes wrote it. Review locally; never send this file to an adviser or reader.',
        label, tool: TOOL_VERSION, generatedAt,
        athletes: perAthlete.map(({ entry, freeRows }) => ({
          participantCode: entry.participantCode,
          rows: Object.entries(freeRows).flatMap(([name, rows]) => rows.map((row) => ({ source: name, ...row }))),
        })),
      };
      writeNew(names.freeText, freeDocument);
      freeTextPath = names.freeText;
    }
    return { aggregatePath: names.aggregate, privatePath: names.private, freeTextPath, backupSha256 };
  } finally {
    for (const db of openDatabases) { try { db.close(); } catch { /* already closed */ } }
    wipe(workDir);
  }
}

function statSafe(path) {
  try { statSync(path); return true; } catch { return false; }
}
