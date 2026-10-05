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
  // Through 066_focus_and_goals — adds muscle groups, the movement muscle
  // mapping, the athlete's focus and SMART goals.
  {
    userVersion: 65,
    migrationSlot: 66,
    tableCount: 114,
    objectCount: 198,
    fingerprint: '491c8ac536b220bacb3c61ef2979ced7b4a5515a0dad7c9f9adb72e68ddeb189',
  },
  // Through 067_sport_and_emphasis — adds the sport profile, the goal exercise
  // link and the frozen per-block emphasis explanation.
  {
    userVersion: 66,
    migrationSlot: 67,
    tableCount: 117,
    objectCount: 203,
    fingerprint: 'b2c6deabb8165cd6a2ebca99aa2744c3f10d7f20dd5f6680dcbcc24ae46ab500',
  },
  // Through 068_movement_content_correction_v2 — coaching text only. No schema
  // object changes, so the counts and the fingerprint equal the v66 entry's;
  // the entry exists because a backup is identified by its version and slot.
  {
    userVersion: 67,
    migrationSlot: 68,
    tableCount: 117,
    objectCount: 203,
    fingerprint: 'b2c6deabb8165cd6a2ebca99aa2744c3f10d7f20dd5f6680dcbcc24ae46ab500',
  },
  // Through 069_resting_heart_rate — adds resting_hr_daily, resting heart rate
  // stored independently of HRV (one table, no index or trigger).
  {
    userVersion: 68,
    migrationSlot: 69,
    tableCount: 118,
    objectCount: 204,
    fingerprint: '33f76480826a0b81b0cd57ceb74294a441c1ffac71884dda95f90dd24fde5861',
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

/**
 * Known-lineage schema text equivalences.
 *
 * SQLite stores a table's CREATE statement verbatim, comments included, and
 * `CREATE TABLE IF NOT EXISTS` never rewrites it. Migration 058 shipped on two
 * lineages with the SAME table definition but different inline comments:
 *
 *   master  1da218d  058_suspension_episode.sql  sha256 4452ae33971ccc8deb1acdc36a2d5cc68141b86eb8d2dcf5ca051398e00d2200 (no inline comments)
 *   feature 12a1fb1  058_suspension_episode.sql  (the file in src/schema; inline comments)
 *
 * A master install upgraded by the unified chain therefore keeps master's text
 * for `suspension_episode`, and its exact fingerprint differs from a fresh
 * install's even though columns, CHECKs, indexes and triggers are identical.
 *
 * This table maps that ONE exact stored text to the canonical (feature) text
 * before fingerprinting. It is an exact string match — not comment stripping,
 * not whitespace folding, not a relaxed comparison — so any other text,
 * including a one-byte change to either variant, still fails the contract.
 * Columns are compared unchanged. Adding an entry here requires the same
 * review as adding a migration: verify:backup pins both texts against the
 * real chains (fixtures under packages/core-db/test/fixtures/lineage/).
 */
export const MASTER_058_SUSPENSION_EPISODE_SQL = 'CREATE TABLE suspension_episode (\n'
  + '  episode_id         INTEGER PRIMARY KEY,\n'
  + '  started_at_ms      INTEGER NOT NULL CHECK (started_at_ms > 0),\n'
  + '  ended_at_ms        INTEGER CHECK (ended_at_ms IS NULL OR ended_at_ms >= started_at_ms),\n'
  + "  reason             TEXT NOT NULL CHECK (reason IN ('injury', 'illness', 'life')),\n"
  + '  frozen_macro_index INTEGER NOT NULL CHECK (frozen_macro_index BETWEEN 1 AND 8)\n'
  + ') STRICT';

export const FEATURE_058_SUSPENSION_EPISODE_SQL = 'CREATE TABLE suspension_episode (\n'
  + '  episode_id         INTEGER PRIMARY KEY,\n'
  + '  started_at_ms      INTEGER NOT NULL CHECK (started_at_ms > 0),\n'
  + '  -- NULL = currently suspended. Set once, by the athlete, on resume.\n'
  + '  ended_at_ms        INTEGER CHECK (ended_at_ms IS NULL OR ended_at_ms >= started_at_ms),\n'
  + '  -- Closed domain: free text cannot be reasoned about and will not stay clean.\n'
  + "  -- 'life' is deliberate --- travel, work, bereavement. Restricting suspension\n"
  + '  -- to injury would leave the commonest cause of a training gap still burning\n'
  + "  -- the athlete's progression track, which is the bug this table exists to fix.\n"
  + "  reason             TEXT NOT NULL CHECK (reason IN ('injury', 'illness', 'life')),\n"
  + '  -- The macro position frozen at entry, mirroring the 009 block_meta domain.\n'
  + '  frozen_macro_index INTEGER NOT NULL CHECK (frozen_macro_index BETWEEN 1 AND 8)\n'
  + ') STRICT';

export const KNOWN_LINEAGE_SQL_EQUIVALENTS: readonly {
  readonly type: 'table';
  readonly name: string;
  readonly lineage: string;
  readonly variantSql: string;
  readonly canonicalSql: string;
}[] = [
  {
    type: 'table',
    name: 'suspension_episode',
    lineage: 'master 1da218d migration 058',
    variantSql: MASTER_058_SUSPENSION_EPISODE_SQL,
    canonicalSql: FEATURE_058_SUSPENSION_EPISODE_SQL,
  },
];

/** Replace an exact known-lineage variant text with its canonical text. Every
 *  other object, and every non-identical text, passes through unchanged. */
export function canonicalizeKnownLineageSchema(objects: readonly BackupSchemaObject[]): BackupSchemaObject[] {
  return objects.map((object) => {
    const equivalent = KNOWN_LINEAGE_SQL_EQUIVALENTS.find((entry) =>
      entry.type === object[0] && entry.name === object[1] && entry.name === object[2]
      && entry.variantSql === object[3]);
    return equivalent === undefined
      ? object
      : [object[0], object[1], object[2], equivalent.canonicalSql, object[4]] as const;
  });
}

/** The fingerprint covers every user table/column/index/trigger definition,
 * rather than accepting any database that happens to contain the right
 * number of tables. Known-lineage text variants (above) are canonicalized
 * first; nothing else is normalized. */
export function calculateBackupSchemaFingerprint(
  objects: readonly BackupSchemaObject[],
  crypto: Pick<BackupCryptoProvider, 'sha256Hex' | 'utf8Encode'>,
): string {
  return crypto.sha256Hex(crypto.utf8Encode(JSON.stringify(canonicalizeKnownLineageSchema(objects))));
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
