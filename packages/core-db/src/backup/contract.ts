import { canonicalJson, type JsonValue } from './canonicalJson';

export const BACKUP_FORMAT = 'pikeMethods-encrypted-backup' as const;
export const BACKUP_FORMAT_VERSION = 1 as const;
export const BACKUP_RESTORE_POLICY = 'replace' as const;
export const BACKUP_CIPHER = 'AES-256-GCM' as const;
export const BACKUP_KDF = 'scrypt' as const;
export const BACKUP_KDF_N = 65_536 as const;
export const BACKUP_KDF_R = 8 as const;
export const BACKUP_KDF_P = 1 as const;
export const BACKUP_KDF_KEY_BYTES = 32 as const;
export const BACKUP_SALT_BYTES = 16 as const;
export const BACKUP_NONCE_BYTES = 12 as const;
export const BACKUP_TAG_BYTES = 16 as const;
export const MAX_BACKUP_TEXT_BYTES = 16 * 1024 * 1024;
export const MAX_ATHLETES_PER_BACKUP = 100;
export const MAX_AGGREGATE_DATABASE_BYTES = 8 * 1024 * 1024;
export const MAX_DATABASE_BYTES = MAX_AGGREGATE_DATABASE_BYTES;
export const MAX_BACKUP_PASSWORD_CHARACTERS = 1_024;

const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const DB_NAME = /^(?:athlete_kinetics|ak_athlete_[a-z0-9]+)\.db$/;
const ATHLETE_ID = /^(?:default|[a-z0-9]+)$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SQLITE_HEADER = 'SQLite format 3\u0000';

export interface BackupCryptoProvider {
  randomBytes(length: number): Uint8Array;
  deriveScryptKey(passwordUtf8: Uint8Array, salt: Uint8Array, parameters: {
    readonly N: number; readonly r: number; readonly p: number; readonly dkLen: number;
  }): Promise<Uint8Array>;
  encryptAes256Gcm(key: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array, aad: Uint8Array): Promise<Uint8Array>;
  decryptAes256Gcm(key: Uint8Array, nonce: Uint8Array, ciphertextAndTag: Uint8Array, aad: Uint8Array): Promise<Uint8Array>;
  sha256Hex(bytes: Uint8Array): string;
  utf8Encode(text: string): Uint8Array;
  utf8Decode(bytes: Uint8Array): string;
}

export interface BackupAthleteEntry {
  readonly id: string;
  readonly name: string;
  readonly dbName: string;
  readonly createdAtMs: number;
}

export interface BackupRegistry {
  readonly version: 1;
  readonly activeId: string;
  readonly advancedToolsUnlocked: boolean;
  readonly athletes: readonly BackupAthleteEntry[];
}

export interface BackupDatabaseSnapshot {
  readonly athleteId: string;
  readonly dbName: string;
  readonly byteLength: number;
  readonly sha256Hex: string;
  readonly userVersion: number;
  readonly tableCount: number;
  readonly databaseBase64: string;
}

export interface BackupArchiveV1 {
  readonly archiveVersion: 1;
  readonly backupId: string;
  readonly createdAt: string;
  readonly sourceAppVersion: string;
  readonly sourceSchemaVersion: number;
  readonly sourceMigrationSlot: number;
  readonly scope: 'all-athletes';
  readonly restorePolicy: typeof BACKUP_RESTORE_POLICY;
  readonly registry: BackupRegistry;
  readonly databases: readonly BackupDatabaseSnapshot[];
  readonly previousSuccessfulBackupAt: string | null;
}

export interface EncryptedBackupContainerV1 {
  readonly format: typeof BACKUP_FORMAT;
  readonly formatVersion: typeof BACKUP_FORMAT_VERSION;
  readonly kdf: {
    readonly algorithm: typeof BACKUP_KDF;
    readonly N: typeof BACKUP_KDF_N;
    readonly r: typeof BACKUP_KDF_R;
    readonly p: typeof BACKUP_KDF_P;
    readonly keyBytes: typeof BACKUP_KDF_KEY_BYTES;
    readonly saltBase64: string;
  };
  readonly cipher: {
    readonly algorithm: typeof BACKUP_CIPHER;
    readonly nonceBase64: string;
    readonly tagBytes: typeof BACKUP_TAG_BYTES;
  };
  readonly ciphertextBase64: string;
}

export type BackupOpenErrorCode =
  | 'invalid_container'
  | 'unknown_format'
  | 'unsupported_version'
  | 'newer_version'
  | 'resource_limit'
  | 'authentication_failed'
  | 'invalid_archive'
  | 'duplicate_identity'
  | 'database_corrupt';

export type BackupOpenResult =
  | { readonly ok: true; readonly archive: BackupArchiveV1 }
  | { readonly ok: false; readonly code: BackupOpenErrorCode; readonly message: string };

export class BackupContractError extends Error {
  constructor(readonly code: BackupOpenErrorCode, message: string) {
    super(message);
    this.name = 'BackupContractError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

function isUtcTimestamp(value: unknown): value is string {
  return typeof value === 'string' && ISO_UTC.test(value) && new Date(value).toISOString() === value;
}

export function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const a = bytes[offset] ?? 0;
    const b = bytes[offset + 1] ?? 0;
    const c = bytes[offset + 2] ?? 0;
    const packed = (a << 16) | (b << 8) | c;
    result += alphabet[(packed >>> 18) & 63];
    result += alphabet[(packed >>> 12) & 63];
    result += offset + 1 < bytes.length ? alphabet[(packed >>> 6) & 63] : '=';
    result += offset + 2 < bytes.length ? alphabet[packed & 63] : '=';
  }
  return result;
}

export function base64ToBytes(text: string, maximumBytes = MAX_DATABASE_BYTES): Uint8Array {
  if (!BASE64.test(text)) throw new BackupContractError('invalid_container', 'Backup encoding is invalid.');
  const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
  const length = (text.length / 4) * 3 - padding;
  if (!Number.isSafeInteger(length) || length < 0 || length > maximumBytes) {
    throw new BackupContractError('resource_limit', 'Backup is too large for this version.');
  }
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Int16Array(128).fill(-1);
  for (let index = 0; index < alphabet.length; index += 1) lookup[alphabet.charCodeAt(index)] = index;
  const result = new Uint8Array(length);
  let output = 0;
  for (let offset = 0; offset < text.length; offset += 4) {
    const a = lookup[text.charCodeAt(offset)]!;
    const b = lookup[text.charCodeAt(offset + 1)]!;
    const cChar = text.charCodeAt(offset + 2);
    const dChar = text.charCodeAt(offset + 3);
    const c = cChar === 61 ? 0 : lookup[cChar]!;
    const d = dChar === 61 ? 0 : lookup[dChar]!;
    const packed = (a << 18) | (b << 12) | (c << 6) | d;
    if (output < length) result[output++] = (packed >>> 16) & 255;
    if (output < length) result[output++] = (packed >>> 8) & 255;
    if (output < length) result[output++] = packed & 255;
  }
  return result;
}

/** Validate provider-reported size before reading a selected portable backup
 * into JavaScript memory. Unknown, fractional, empty, and oversized files are
 * rejected rather than relying on an eventual allocation failure. */
export function validatePortableBackupFileSize(value: unknown): number {
  const size = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(size) || size < 1) {
    throw new BackupContractError('resource_limit', 'The selected backup size could not be verified safely.');
  }
  if (size > MAX_BACKUP_TEXT_BYTES) {
    throw new BackupContractError('resource_limit', 'The selected backup is too large for this version.');
  }
  return size;
}

export function validateAggregateDatabaseBytes(values: readonly unknown[]): number {
  let total = 0;
  for (const value of values) {
    const size = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new BackupContractError('resource_limit', 'Backup database sizes could not be verified safely.');
    }
    total += size;
    if (!Number.isSafeInteger(total) || total > MAX_AGGREGATE_DATABASE_BYTES) {
      throw new BackupContractError('resource_limit', 'Backup is too large for this version.');
    }
  }
  return total;
}

function outerMetadata(container: Omit<EncryptedBackupContainerV1, 'ciphertextBase64'>): string {
  return canonicalJson(container as unknown as JsonValue);
}

function validateArchive(value: unknown, crypto: BackupCryptoProvider): BackupArchiveV1 {
  if (!isRecord(value) || !hasExactKeys(value, [
    'archiveVersion', 'backupId', 'createdAt', 'sourceAppVersion', 'sourceSchemaVersion',
    'sourceMigrationSlot', 'scope', 'restorePolicy', 'registry', 'databases', 'previousSuccessfulBackupAt',
  ])) throw new BackupContractError('invalid_archive', 'Authenticated backup contents are invalid.');
  if (
    value.archiveVersion !== 1 || typeof value.backupId !== 'string' || value.backupId.length < 8
    || !isUtcTimestamp(value.createdAt) || typeof value.sourceAppVersion !== 'string' || value.sourceAppVersion.length === 0
    || !Number.isInteger(value.sourceSchemaVersion) || (value.sourceSchemaVersion as number) < 0
    || !Number.isInteger(value.sourceMigrationSlot) || (value.sourceMigrationSlot as number) < 0
    || value.scope !== 'all-athletes' || value.restorePolicy !== BACKUP_RESTORE_POLICY
    || (value.previousSuccessfulBackupAt !== null && !isUtcTimestamp(value.previousSuccessfulBackupAt))
    || !isRecord(value.registry) || !Array.isArray(value.databases)
  ) throw new BackupContractError('invalid_archive', 'Authenticated backup contents are invalid.');
  const registry = value.registry;
  if (!hasExactKeys(registry, ['version', 'activeId', 'advancedToolsUnlocked', 'athletes'])
    || registry.version !== 1 || typeof registry.activeId !== 'string'
    || typeof registry.advancedToolsUnlocked !== 'boolean' || !Array.isArray(registry.athletes)
    || registry.athletes.length < 1 || registry.athletes.length > MAX_ATHLETES_PER_BACKUP
    || value.databases.length !== registry.athletes.length) {
    throw new BackupContractError('invalid_archive', 'Authenticated backup registry is invalid.');
  }
  const ids = new Set<string>();
  const dbNames = new Set<string>();
  const athletes: BackupAthleteEntry[] = registry.athletes.map((entry): BackupAthleteEntry => {
    if (!isRecord(entry) || !hasExactKeys(entry, ['id', 'name', 'dbName', 'createdAtMs'])
      || typeof entry.id !== 'string' || !ATHLETE_ID.test(entry.id)
      || typeof entry.name !== 'string' || entry.name.trim().length === 0 || entry.name.length > 24
      || typeof entry.dbName !== 'string' || !DB_NAME.test(entry.dbName)
      || (entry.id === 'default' ? entry.dbName !== 'athlete_kinetics.db' : entry.dbName !== `ak_athlete_${entry.id}.db`)
      || typeof entry.createdAtMs !== 'number' || !Number.isSafeInteger(entry.createdAtMs) || entry.createdAtMs < 0
      || ids.has(entry.id) || dbNames.has(entry.dbName)) {
      throw new BackupContractError('duplicate_identity', 'Backup contains invalid or duplicate athlete identities.');
    }
    ids.add(entry.id);
    dbNames.add(entry.dbName);
    return entry as unknown as BackupAthleteEntry;
  });
  if (!ids.has(registry.activeId)) throw new BackupContractError('invalid_archive', 'Backup active athlete is missing.');
  const declaredDatabaseSizes: number[] = [];
  for (const snapshot of value.databases) {
    if (!isRecord(snapshot) || typeof snapshot.byteLength !== 'number' || !Number.isSafeInteger(snapshot.byteLength)) {
      throw new BackupContractError('invalid_archive', 'Authenticated database inventory is invalid.');
    }
    declaredDatabaseSizes.push(snapshot.byteLength);
  }
  validateAggregateDatabaseBytes(declaredDatabaseSizes);
  const snapshots = new Map<string, BackupDatabaseSnapshot>();
  for (const snapshot of value.databases) {
    if (!isRecord(snapshot) || !hasExactKeys(snapshot, [
      'athleteId', 'dbName', 'byteLength', 'sha256Hex', 'userVersion', 'tableCount', 'databaseBase64',
    ]) || typeof snapshot.athleteId !== 'string' || !ids.has(snapshot.athleteId)
      || typeof snapshot.dbName !== 'string' || snapshot.dbName !== athletes.find((a) => a.id === snapshot.athleteId)?.dbName
      || typeof snapshot.byteLength !== 'number' || !Number.isSafeInteger(snapshot.byteLength)
      || snapshot.byteLength < 100 || snapshot.byteLength > MAX_DATABASE_BYTES
      || typeof snapshot.sha256Hex !== 'string' || !SHA256_HEX.test(snapshot.sha256Hex)
      || typeof snapshot.userVersion !== 'number' || !Number.isInteger(snapshot.userVersion) || snapshot.userVersion !== value.sourceSchemaVersion
      || typeof snapshot.tableCount !== 'number' || !Number.isInteger(snapshot.tableCount) || snapshot.tableCount !== 104
      || typeof snapshot.databaseBase64 !== 'string' || snapshots.has(snapshot.athleteId)) {
      throw new BackupContractError('invalid_archive', 'Authenticated database inventory is invalid.');
    }
    const bytes = base64ToBytes(snapshot.databaseBase64, MAX_DATABASE_BYTES);
    const magic = String.fromCharCode(...bytes.subarray(0, SQLITE_HEADER.length));
    if (bytes.length !== snapshot.byteLength || magic !== SQLITE_HEADER || crypto.sha256Hex(bytes) !== snapshot.sha256Hex) {
      throw new BackupContractError('database_corrupt', 'A database snapshot did not pass integrity validation.');
    }
    snapshots.set(snapshot.athleteId, snapshot as unknown as BackupDatabaseSnapshot);
  }
  if (snapshots.size !== athletes.length) throw new BackupContractError('invalid_archive', 'Backup is missing an athlete database.');
  return value as unknown as BackupArchiveV1;
}

export async function sealBackup(archiveInput: BackupArchiveV1, password: string, crypto: BackupCryptoProvider): Promise<string> {
  if (password.length < 12) throw new BackupContractError('invalid_archive', 'Use a backup password with at least 12 characters.');
  if (password.length > MAX_BACKUP_PASSWORD_CHARACTERS) throw new BackupContractError('resource_limit', 'Backup password is too long.');
  const archive = validateArchive(archiveInput, crypto);
  const salt = crypto.randomBytes(BACKUP_SALT_BYTES);
  const nonce = crypto.randomBytes(BACKUP_NONCE_BYTES);
  if (salt.length !== BACKUP_SALT_BYTES || nonce.length !== BACKUP_NONCE_BYTES) {
    throw new BackupContractError('invalid_container', 'Secure random-byte provider failed.');
  }
  const metadata = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    kdf: { algorithm: BACKUP_KDF, N: BACKUP_KDF_N, r: BACKUP_KDF_R, p: BACKUP_KDF_P, keyBytes: BACKUP_KDF_KEY_BYTES, saltBase64: bytesToBase64(salt) },
    cipher: { algorithm: BACKUP_CIPHER, nonceBase64: bytesToBase64(nonce), tagBytes: BACKUP_TAG_BYTES },
  } as const;
  const passwordBytes = crypto.utf8Encode(password);
  const plaintext = crypto.utf8Encode(canonicalJson(archive as unknown as JsonValue));
  let key: Uint8Array | null = null;
  try {
    key = await crypto.deriveScryptKey(passwordBytes, salt, {
      N: BACKUP_KDF_N, r: BACKUP_KDF_R, p: BACKUP_KDF_P, dkLen: BACKUP_KDF_KEY_BYTES,
    });
    if (key.length !== BACKUP_KDF_KEY_BYTES) throw new BackupContractError('invalid_container', 'Password KDF failed.');
    const ciphertext = await crypto.encryptAes256Gcm(
      key, nonce, plaintext, crypto.utf8Encode(outerMetadata(metadata)),
    );
    const container: EncryptedBackupContainerV1 = { ...metadata, ciphertextBase64: bytesToBase64(ciphertext) };
    const result = canonicalJson(container as unknown as JsonValue);
    if (result.length > MAX_BACKUP_TEXT_BYTES) throw new BackupContractError('resource_limit', 'Backup is too large for this version.');
    return result;
  } finally {
    passwordBytes.fill(0);
    plaintext.fill(0);
    key?.fill(0);
  }
}

function parseContainer(text: string): EncryptedBackupContainerV1 | BackupOpenResult {
  if (text.length > MAX_BACKUP_TEXT_BYTES) return { ok: false, code: 'resource_limit', message: 'Backup is too large for this version.' };
  let value: unknown;
  try { value = JSON.parse(text) as unknown; } catch { return { ok: false, code: 'invalid_container', message: 'Backup file is incomplete or invalid.' }; }
  if (!isRecord(value)) return { ok: false, code: 'invalid_container', message: 'Backup file is invalid.' };
  if (value.format !== BACKUP_FORMAT) return { ok: false, code: 'unknown_format', message: 'This is not an encrypted pikeMethods backup.' };
  if (typeof value.formatVersion !== 'number' || !Number.isInteger(value.formatVersion)) return { ok: false, code: 'unsupported_version', message: 'Backup version is invalid.' };
  if (value.formatVersion > BACKUP_FORMAT_VERSION) return { ok: false, code: 'newer_version', message: 'This backup needs a newer version of pikeMethods.' };
  if (value.formatVersion !== BACKUP_FORMAT_VERSION) return { ok: false, code: 'unsupported_version', message: 'This backup version is not supported.' };
  if (!hasExactKeys(value, ['format', 'formatVersion', 'kdf', 'cipher', 'ciphertextBase64'])
    || !isRecord(value.kdf) || !isRecord(value.cipher)
    || !hasExactKeys(value.kdf, ['algorithm', 'N', 'r', 'p', 'keyBytes', 'saltBase64'])
    || !hasExactKeys(value.cipher, ['algorithm', 'nonceBase64', 'tagBytes'])
    || value.kdf.algorithm !== BACKUP_KDF || value.kdf.N !== BACKUP_KDF_N || value.kdf.r !== BACKUP_KDF_R
    || value.kdf.p !== BACKUP_KDF_P || value.kdf.keyBytes !== BACKUP_KDF_KEY_BYTES
    || value.cipher.algorithm !== BACKUP_CIPHER || value.cipher.tagBytes !== BACKUP_TAG_BYTES
    || typeof value.kdf.saltBase64 !== 'string' || typeof value.cipher.nonceBase64 !== 'string'
    || typeof value.ciphertextBase64 !== 'string') {
    return { ok: false, code: 'resource_limit', message: 'Backup security parameters are unsupported.' };
  }
  try {
    if (base64ToBytes(value.kdf.saltBase64, BACKUP_SALT_BYTES).length !== BACKUP_SALT_BYTES
      || base64ToBytes(value.cipher.nonceBase64, BACKUP_NONCE_BYTES).length !== BACKUP_NONCE_BYTES) {
      return { ok: false, code: 'invalid_container', message: 'Backup security metadata is invalid.' };
    }
  } catch (error) {
    return error instanceof BackupContractError
      ? { ok: false, code: error.code, message: error.message }
      : { ok: false, code: 'invalid_container', message: 'Backup security metadata is invalid.' };
  }
  return value as unknown as EncryptedBackupContainerV1;
}

export async function openBackup(text: string, password: string, crypto: BackupCryptoProvider): Promise<BackupOpenResult> {
  const parsed = parseContainer(text);
  if ('ok' in parsed) return parsed;
  if (password.length > MAX_BACKUP_PASSWORD_CHARACTERS) {
    return { ok: false, code: 'resource_limit', message: 'Backup password is too long.' };
  }
  let salt: Uint8Array;
  let nonce: Uint8Array;
  let ciphertext: Uint8Array;
  try {
    salt = base64ToBytes(parsed.kdf.saltBase64, BACKUP_SALT_BYTES);
    nonce = base64ToBytes(parsed.cipher.nonceBase64, BACKUP_NONCE_BYTES);
    ciphertext = base64ToBytes(parsed.ciphertextBase64, MAX_BACKUP_TEXT_BYTES);
  } catch (error) {
    return error instanceof BackupContractError
      ? { ok: false, code: error.code, message: error.message }
      : { ok: false, code: 'invalid_container', message: 'Backup encoding is invalid.' };
  }
  const metadata = { format: parsed.format, formatVersion: parsed.formatVersion, kdf: parsed.kdf, cipher: parsed.cipher };
  const passwordBytes = crypto.utf8Encode(password);
  let key: Uint8Array | null = null;
  try {
    key = await crypto.deriveScryptKey(passwordBytes, salt, {
      N: BACKUP_KDF_N, r: BACKUP_KDF_R, p: BACKUP_KDF_P, dkLen: BACKUP_KDF_KEY_BYTES,
    });
  } catch {
    return { ok: false, code: 'authentication_failed', message: 'Backup password is wrong or the file was damaged.' };
  } finally {
    passwordBytes.fill(0);
  }
  let plaintext: Uint8Array;
  try {
    plaintext = await crypto.decryptAes256Gcm(key, nonce, ciphertext, crypto.utf8Encode(outerMetadata(metadata)));
  } catch {
    key.fill(0);
    return { ok: false, code: 'authentication_failed', message: 'Backup password is wrong or the file was damaged.' };
  }
  key.fill(0);
  let archiveValue: unknown;
  try { archiveValue = JSON.parse(crypto.utf8Decode(plaintext)) as unknown; }
  catch { return { ok: false, code: 'invalid_archive', message: 'Authenticated backup contents are invalid.' }; }
  finally { plaintext.fill(0); }
  try {
    return { ok: true, archive: validateArchive(archiveValue, crypto) };
  } catch (error) {
    if (error instanceof BackupContractError) return { ok: false, code: error.code, message: error.message };
    return { ok: false, code: 'invalid_archive', message: 'Authenticated backup contents are invalid.' };
  }
}
