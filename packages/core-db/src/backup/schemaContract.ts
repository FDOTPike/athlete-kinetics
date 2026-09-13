import type { BackupCryptoProvider } from './contract';

export const BACKUP_SCHEMA_USER_VERSION = 63;
export const BACKUP_SCHEMA_MIGRATION_SLOT = 64;
export const BACKUP_SCHEMA_TABLE_COUNT = 104;
export const BACKUP_SCHEMA_OBJECT_COUNT = 174;
export const BACKUP_SCHEMA_FINGERPRINT = 'f829bcba999b7f125d70c6f2a4053f11bdfe3bbda42781f6ef8ee8e3449590f6';

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

/** The fingerprint covers every user table/column/index/trigger definition,
 * rather than accepting any database that happens to contain 104 tables. */
export function calculateBackupSchemaFingerprint(
  objects: readonly BackupSchemaObject[],
  crypto: Pick<BackupCryptoProvider, 'sha256Hex' | 'utf8Encode'>,
): string {
  return crypto.sha256Hex(crypto.utf8Encode(JSON.stringify(objects)));
}

export function isCurrentBackupSchema(
  objects: readonly BackupSchemaObject[],
  crypto: Pick<BackupCryptoProvider, 'sha256Hex' | 'utf8Encode'>,
): boolean {
  return objects.length === BACKUP_SCHEMA_OBJECT_COUNT
    && calculateBackupSchemaFingerprint(objects, crypto) === BACKUP_SCHEMA_FINGERPRINT;
}
