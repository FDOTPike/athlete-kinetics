import { canonicalJson, isJsonValue, type JsonObject, type JsonValue } from './canonicalJson';

export const BACKUP_FORMAT = 'pikeMethods-backup' as const;
export const BACKUP_FORMAT_VERSION = 1 as const;
export const BACKUP_CANONICALIZATION = 'ak-canonical-json-v1' as const;
export const BACKUP_RESTORE_POLICY = 'replace' as const;

export type BackupScope = 'single-athlete' | 'all-athletes';

export interface BackupChecksumProvider {
  /** Lower-case, 64-character SHA-256 hex digest of UTF-8 text. */
  sha256Hex(text: string): string;
}

export interface BackupDataSetInput {
  readonly name: string;
  readonly identityFields: readonly string[];
  readonly rows: readonly JsonObject[];
}

export interface CreateBackupInput {
  readonly backupId: string;
  readonly createdAt: string;
  readonly sourceAppVersion: string;
  /** SQLite PRAGMA user_version (chain length), not the numbered SQL filename. */
  readonly sourceSchemaVersion: number;
  /** Highest numbered migration slot bundled by the source app. */
  readonly sourceMigrationSlot: number;
  readonly scope: BackupScope;
  readonly dataSets: readonly BackupDataSetInput[];
}

export interface BackupDataSet {
  readonly name: string;
  readonly identityFields: readonly string[];
  readonly rows: readonly JsonObject[];
}

export interface BackupEnvelopeV1 {
  readonly format: typeof BACKUP_FORMAT;
  readonly formatVersion: typeof BACKUP_FORMAT_VERSION;
  readonly manifest: {
    readonly backupId: string;
    readonly createdAt: string;
    readonly sourceAppVersion: string;
    readonly sourceSchemaVersion: number;
    readonly sourceMigrationSlot: number;
    readonly scope: BackupScope;
    readonly restorePolicy: typeof BACKUP_RESTORE_POLICY;
    readonly protection: { readonly mode: 'plaintext' };
    readonly dataSetCounts: readonly { readonly name: string; readonly rowCount: number }[];
    readonly integrityChecksum: {
      readonly algorithm: 'SHA-256';
      readonly canonicalization: typeof BACKUP_CANONICALIZATION;
      readonly scope: 'manifest-and-payload-excluding-digest';
      readonly digestHex: string;
    };
  };
  readonly payload: { readonly dataSets: readonly BackupDataSet[] };
}

export type BackupParseErrorCode =
  | 'invalid_json'
  | 'invalid_shape'
  | 'unknown_format'
  | 'unsupported_version'
  | 'newer_version'
  | 'checksum_mismatch'
  | 'duplicate_identifier'
  | 'noncanonical_input';

export type BackupParseResult =
  | { readonly ok: true; readonly envelope: BackupEnvelopeV1 }
  | { readonly ok: false; readonly code: BackupParseErrorCode; readonly message: string };

export class BackupContractError extends Error {
  constructor(
    readonly code: Exclude<BackupParseErrorCode, 'invalid_json' | 'unknown_format' | 'unsupported_version' | 'newer_version' | 'checksum_mismatch' | 'noncanonical_input'>,
    message: string,
  ) {
    super(message);
    this.name = 'BackupContractError';
  }
}

const DATA_SET_NAME = /^[a-z][a-z0-9_.-]{0,127}$/;
const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function isUtcIsoTimestamp(value: string): boolean {
  if (!ISO_UTC.test(value)) return false;
  const epochMs = Date.parse(value);
  if (!Number.isFinite(epochMs)) return false;
  const normalizedInput = value.includes('.') ? value : value.replace('Z', '.000Z');
  return new Date(epochMs).toISOString() === normalizedInput;
}

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

function identityKey(row: JsonObject, fields: readonly string[]): string {
  return fields.map((field) => canonicalJson(row[field])).join('\u001f');
}

function normalizeDataSets(dataSets: readonly BackupDataSetInput[]): BackupDataSet[] {
  const names = new Set<string>();
  const normalized = dataSets.map((dataSet): BackupDataSet => {
    if (!DATA_SET_NAME.test(dataSet.name)) {
      throw new BackupContractError('invalid_shape', `invalid data-set name: ${dataSet.name}`);
    }
    if (names.has(dataSet.name)) {
      throw new BackupContractError('duplicate_identifier', `duplicate data-set name: ${dataSet.name}`);
    }
    names.add(dataSet.name);
    const identityFields = [...dataSet.identityFields].sort();
    if (
      identityFields.length === 0
      || new Set(identityFields).size !== identityFields.length
      || identityFields.some((field) => !FIELD_NAME.test(field))
    ) {
      throw new BackupContractError('invalid_shape', `invalid identity fields for ${dataSet.name}`);
    }
    const keyedRows = dataSet.rows.map((row) => {
      if (!isJsonValue(row) || Array.isArray(row)) {
        throw new BackupContractError('invalid_shape', `${dataSet.name} contains a non-JSON row`);
      }
      for (const field of identityFields) {
        if (!(field in row) || row[field] === null) {
          throw new BackupContractError('invalid_shape', `${dataSet.name} row lacks identity field ${field}`);
        }
      }
      return { key: identityKey(row, identityFields), row };
    });
    keyedRows.sort((left, right) => compareCodeUnits(left.key, right.key));
    for (let index = 1; index < keyedRows.length; index += 1) {
      if (keyedRows[index - 1].key === keyedRows[index].key) {
        throw new BackupContractError('duplicate_identifier', `duplicate row identifier in ${dataSet.name}`);
      }
    }
    return { name: dataSet.name, identityFields, rows: keyedRows.map(({ row }) => row) };
  });
  normalized.sort((left, right) => compareCodeUnits(left.name, right.name));
  return normalized;
}

function envelopeAsJson(envelope: BackupEnvelopeV1): JsonValue {
  return envelope as unknown as JsonValue;
}

export function serializeBackup(
  input: CreateBackupInput,
  checksumProvider: BackupChecksumProvider,
): string {
  if (input.backupId.trim().length === 0 || input.sourceAppVersion.trim().length === 0) {
    throw new BackupContractError('invalid_shape', 'backup and app versions must be non-empty');
  }
  if (
    !isUtcIsoTimestamp(input.createdAt)
    || !Number.isInteger(input.sourceSchemaVersion) || input.sourceSchemaVersion < 0
    || !Number.isInteger(input.sourceMigrationSlot) || input.sourceMigrationSlot < 0
  ) {
    throw new BackupContractError('invalid_shape', 'createdAt or source schema identity is invalid');
  }
  if (input.scope !== 'single-athlete' && input.scope !== 'all-athletes') {
    throw new BackupContractError('invalid_shape', 'backup scope is invalid');
  }
  const dataSets = normalizeDataSets(input.dataSets);
  const payload = { dataSets } as const;
  const manifestWithoutDigest = {
    backupId: input.backupId,
    createdAt: input.createdAt,
    sourceAppVersion: input.sourceAppVersion,
    sourceSchemaVersion: input.sourceSchemaVersion,
    sourceMigrationSlot: input.sourceMigrationSlot,
    scope: input.scope,
    restorePolicy: BACKUP_RESTORE_POLICY,
    protection: { mode: 'plaintext' as const },
    dataSetCounts: dataSets.map(({ name, rows }) => ({ name, rowCount: rows.length })),
  };
  const integrityContent = { manifest: manifestWithoutDigest, payload };
  const digestHex = checksumProvider.sha256Hex(canonicalJson(integrityContent as unknown as JsonValue));
  if (!SHA256_HEX.test(digestHex)) {
    throw new BackupContractError('invalid_shape', 'checksum provider returned invalid SHA-256 hex');
  }
  const envelope: BackupEnvelopeV1 = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    manifest: {
      ...manifestWithoutDigest,
      integrityChecksum: {
        algorithm: 'SHA-256',
        canonicalization: BACKUP_CANONICALIZATION,
        scope: 'manifest-and-payload-excluding-digest',
        digestHex,
      },
    },
    payload,
  };
  return canonicalJson(envelopeAsJson(envelope));
}

function failure(code: BackupParseErrorCode, message: string): BackupParseResult {
  return { ok: false, code, message };
}

function validateEnvelopeShape(value: unknown): value is BackupEnvelopeV1 {
  if (!isRecord(value) || !hasExactKeys(value, ['format', 'formatVersion', 'manifest', 'payload'])) return false;
  if (!isRecord(value.manifest) || !isRecord(value.payload)) return false;
  if (!hasExactKeys(value.payload, ['dataSets']) || !Array.isArray(value.payload.dataSets)) return false;
  if (!hasExactKeys(value.manifest, [
    'backupId', 'createdAt', 'sourceAppVersion', 'sourceSchemaVersion', 'sourceMigrationSlot', 'scope', 'restorePolicy',
    'protection', 'dataSetCounts', 'integrityChecksum',
  ])) return false;
  if (!isRecord(value.manifest.protection) || !hasExactKeys(value.manifest.protection, ['mode'])) return false;
  if (!isRecord(value.manifest.integrityChecksum) || !hasExactKeys(value.manifest.integrityChecksum, ['algorithm', 'canonicalization', 'scope', 'digestHex'])) return false;
  return true;
}

export function parseBackup(text: string, checksumProvider: BackupChecksumProvider): BackupParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return failure('invalid_json', 'backup is not complete JSON');
  }
  if (!isRecord(parsed)) return failure('invalid_shape', 'backup root must be an object');
  if (parsed.format !== BACKUP_FORMAT) return failure('unknown_format', 'file is not a pikeMethods backup');
  if (typeof parsed.formatVersion !== 'number' || !Number.isInteger(parsed.formatVersion)) {
    return failure('unsupported_version', 'backup format version is invalid');
  }
  if (parsed.formatVersion > BACKUP_FORMAT_VERSION) {
    return failure('newer_version', 'backup was created by a newer incompatible app version');
  }
  if (parsed.formatVersion !== BACKUP_FORMAT_VERSION) {
    return failure('unsupported_version', 'backup format version is unsupported');
  }
  if (!validateEnvelopeShape(parsed)) return failure('invalid_shape', 'backup fields are missing or unknown');
  const manifest = parsed.manifest;
  if (
    typeof manifest.backupId !== 'string' || manifest.backupId.trim().length === 0
    || typeof manifest.createdAt !== 'string' || !isUtcIsoTimestamp(manifest.createdAt)
    || typeof manifest.sourceAppVersion !== 'string' || manifest.sourceAppVersion.trim().length === 0
    || typeof manifest.sourceSchemaVersion !== 'number' || !Number.isInteger(manifest.sourceSchemaVersion) || manifest.sourceSchemaVersion < 0
    || typeof manifest.sourceMigrationSlot !== 'number' || !Number.isInteger(manifest.sourceMigrationSlot) || manifest.sourceMigrationSlot < 0
    || (manifest.scope !== 'single-athlete' && manifest.scope !== 'all-athletes')
    || manifest.restorePolicy !== BACKUP_RESTORE_POLICY
    || manifest.protection.mode !== 'plaintext'
    || manifest.integrityChecksum.algorithm !== 'SHA-256'
    || manifest.integrityChecksum.canonicalization !== BACKUP_CANONICALIZATION
    || manifest.integrityChecksum.scope !== 'manifest-and-payload-excluding-digest'
    || typeof manifest.integrityChecksum.digestHex !== 'string' || !SHA256_HEX.test(manifest.integrityChecksum.digestHex)
    || !Array.isArray(manifest.dataSetCounts)
  ) return failure('invalid_shape', 'backup manifest is invalid');

  let dataSets: BackupDataSet[];
  try {
    if (!parsed.payload.dataSets.every(isRecord)) throw new BackupContractError('invalid_shape', 'data set must be an object');
    dataSets = normalizeDataSets(parsed.payload.dataSets.map((value): BackupDataSetInput => {
      if (!hasExactKeys(value as unknown as Record<string, unknown>, ['name', 'identityFields', 'rows'])) {
        throw new BackupContractError('invalid_shape', 'data-set fields are missing or unknown');
      }
      if (typeof value.name !== 'string' || !Array.isArray(value.identityFields) || !value.identityFields.every((field) => typeof field === 'string') || !Array.isArray(value.rows) || !value.rows.every(isRecord)) {
        throw new BackupContractError('invalid_shape', 'data-set shape is invalid');
      }
      return { name: value.name, identityFields: value.identityFields, rows: value.rows as JsonObject[] };
    }));
  } catch (error) {
    if (error instanceof BackupContractError) return failure(error.code, error.message);
    return failure('invalid_shape', 'data-set payload is invalid');
  }

  const counts = manifest.dataSetCounts;
  if (!counts.every((value) => isRecord(value)
    && hasExactKeys(value, ['name', 'rowCount'])
    && typeof value.name === 'string'
    && typeof value.rowCount === 'number'
    && Number.isInteger(value.rowCount)
    && value.rowCount >= 0)) {
    return failure('invalid_shape', 'data-set counts are invalid');
  }
  const expectedCounts = dataSets.map(({ name, rows }) => ({ name, rowCount: rows.length }));
  if (canonicalJson(counts as unknown as JsonValue) !== canonicalJson(expectedCounts as unknown as JsonValue)) {
    return failure('invalid_shape', 'manifest counts do not match the payload');
  }
  const {
    integrityChecksum: _integrityChecksum,
    ...manifestWithoutDigest
  } = manifest;
  const integrityCanonical = canonicalJson({ manifest: manifestWithoutDigest, payload: parsed.payload } as unknown as JsonValue);
  if (checksumProvider.sha256Hex(integrityCanonical) !== manifest.integrityChecksum.digestHex) {
    return failure('checksum_mismatch', 'backup integrity checksum does not match its manifest and payload');
  }
  const normalizedEnvelope: BackupEnvelopeV1 = { ...parsed, payload: { dataSets } };
  if (canonicalJson(envelopeAsJson(normalizedEnvelope)) !== text) {
    return failure('noncanonical_input', 'backup bytes are not in canonical form');
  }
  return { ok: true, envelope: normalizedEnvelope };
}
