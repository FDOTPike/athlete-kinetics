import type { BackupCryptoProvider } from './contract';

/** One exact database schema this build knows how to back up or restore. */
export interface BackupSchemaContract {
  /** PRAGMA user_version — the number of applied migration ENTRIES. */
  readonly userVersion: number;
  /** Filename suffix of the last applied migration (004 is not a migration). */
  readonly migrationSlot: number;
  readonly tableCount: number;
  readonly objectCount: number;
  readonly fingerprint: string;
}

/**
 * Every schema this build can restore, oldest first. The LAST entry is the
 * current schema: it is the only one a new backup may be created from.
 *
 * An earlier entry is a SUPPORTED PRE-UPGRADE schema. A backup or retained
 * recovery copy made at that schema is still restorable: it is validated
 * against ITS OWN fingerprint here (never a relaxed or "close enough" check),
 * staged as an isolated copy, forward-migrated on that copy by the production
 * migration runner, and required to match the current fingerprint exactly
 * before any live database is touched (backupStore.replaceAllData).
 *
 * Anything not listed — an unknown, future or partly-migrated schema — has no
 * entry and therefore fails closed.
 *
 * Adding a migration appends an entry; an existing entry is never edited,
 * because its fingerprint is what authenticates backups already in the field.
 */
export const SUPPORTED_BACKUP_SCHEMA_CONTRACTS: readonly BackupSchemaContract[] = [
  // Through 064_accessible_coach_support — the schema at which encrypted
  // backup first shipped.
  {
    userVersion: 63,
    migrationSlot: 64,
    tableCount: 104,
    objectCount: 174,
    fingerprint: 'f829bcba999b7f125d70c6f2a4053f11bdfe3bbda42781f6ef8ee8e3449590f6',
  },
  // Through 065_session_preparation — adds the preparation side-car tables.
  {
    userVersion: 64,
    migrationSlot: 65,
    tableCount: 106,
    objectCount: 181,
    fingerprint: '3785bb0a5557dc3d488b5863e40602e17d0713575adb14c35fd6efeb54280198',
  },
];

export const CURRENT_BACKUP_SCHEMA_CONTRACT: BackupSchemaContract =
  SUPPORTED_BACKUP_SCHEMA_CONTRACTS[SUPPORTED_BACKUP_SCHEMA_CONTRACTS.length - 1]!;

export const BACKUP_SCHEMA_USER_VERSION = CURRENT_BACKUP_SCHEMA_CONTRACT.userVersion;
export const BACKUP_SCHEMA_MIGRATION_SLOT = CURRENT_BACKUP_SCHEMA_CONTRACT.migrationSlot;
export const BACKUP_SCHEMA_TABLE_COUNT = CURRENT_BACKUP_SCHEMA_CONTRACT.tableCount;
export const BACKUP_SCHEMA_OBJECT_COUNT = CURRENT_BACKUP_SCHEMA_CONTRACT.objectCount;
export const BACKUP_SCHEMA_FINGERPRINT = CURRENT_BACKUP_SCHEMA_CONTRACT.fingerprint;

export type BackupSchemaColumn = readonly [
  cid: number,
  name: string,
  type: string,
  notNull: number,
  defaultValue: string | null,
  primaryKey: number,
];

export type BackupSchemaObject = readonly [
  type: string,
  name: string,
  tableName: string,
  sql: string,
  columns: readonly BackupSchemaColumn[],
];

/** The contract registered for an exact (user_version, migration slot) pair,
 * or null. A version and a slot that do not belong together are not a schema
 * this build knows, so they resolve to null rather than to either neighbour. */
export function backupSchemaContractFor(userVersion: number, migrationSlot: number): BackupSchemaContract | null {
  return SUPPORTED_BACKUP_SCHEMA_CONTRACTS.find((contract) =>
    contract.userVersion === userVersion && contract.migrationSlot === migrationSlot) ?? null;
}

/** The fingerprint covers every user table/column/index/trigger definition,
 * rather than accepting any database that happens to contain the right
 * number of tables. */
export function calculateBackupSchemaFingerprint(
  objects: readonly BackupSchemaObject[],
  crypto: Pick<BackupCryptoProvider, 'sha256Hex' | 'utf8Encode'>,
): string {
  return crypto.sha256Hex(crypto.utf8Encode(JSON.stringify(objects)));
}

/** Exact match against one registered contract. */
export function matchesBackupSchemaContract(
  objects: readonly BackupSchemaObject[],
  contract: BackupSchemaContract,
  crypto: Pick<BackupCryptoProvider, 'sha256Hex' | 'utf8Encode'>,
): boolean {
  return objects.length === contract.objectCount
    && objects.filter((object) => object[0] === 'table').length === contract.tableCount
    && calculateBackupSchemaFingerprint(objects, crypto) === contract.fingerprint;
}

export function isCurrentBackupSchema(
  objects: readonly BackupSchemaObject[],
  crypto: Pick<BackupCryptoProvider, 'sha256Hex' | 'utf8Encode'>,
): boolean {
  return matchesBackupSchemaContract(objects, CURRENT_BACKUP_SCHEMA_CONTRACT, crypto);
}
