/**
 * #173: a backup holds at most MAX_AGGREGATE_DATABASE_BYTES of athlete data in
 * this version (about five athletes: an empty athlete database is ~1.4 MB).
 * This module only says so. The cap, the archive format and restore are
 * unchanged; a larger format is later work.
 */
import { MAX_AGGREGATE_DATABASE_BYTES } from '@ak/core-db';

export interface BackupSizeEstimate {
  readonly athleteCount: number;
  /** Sum of the athlete database files a backup would read. */
  readonly totalBytes: number;
  /** What one more athlete is expected to add: the smallest existing
   *  database, since a new athlete starts empty. */
  readonly newAthleteBytes: number;
  readonly capBytes: number;
}

/** The count used when the database sizes cannot be read. */
const ABOUT_FIVE_ATHLETES = 5;

export const ADD_ATHLETE_BACKUP_WARNING =
  'Backups cover up to about five athletes in this version. You can still add this athlete, '
  + 'but a backup will not be possible until a later version.';

const megabytes = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export function estimateFromSizes(sizes: readonly unknown[]): BackupSizeEstimate | null {
  const bytes = sizes.map((size) => (typeof size === 'number' ? size : Number(size)));
  if (bytes.some((size) => !Number.isSafeInteger(size) || size < 0)) return null;
  const totalBytes = bytes.reduce((sum, size) => sum + size, 0);
  return {
    athleteCount: bytes.length,
    totalBytes,
    newAthleteBytes: bytes.length === 0 ? 0 : Math.min(...bytes),
    capBytes: MAX_AGGREGATE_DATABASE_BYTES,
  };
}

/** True when adding one more athlete would take the backup over the cap. With
 *  no readable sizes, the count decides: from the sixth athlete. */
export function addingAthleteExceedsBackupCap(
  estimate: BackupSizeEstimate | null,
  athleteCount: number,
): boolean {
  if (estimate === null) return athleteCount >= ABOUT_FIVE_ATHLETES;
  return estimate.totalBytes + estimate.newAthleteBytes > estimate.capBytes;
}

/** The backup screen's statement of the limit, with the current total when known. */
export function backupLimitText(estimate: BackupSizeEstimate | null): string {
  const limit = `Backups cover up to about five athletes in this version (${megabytes(MAX_AGGREGATE_DATABASE_BYTES)} of athlete data in all).`;
  if (estimate === null) return limit;
  const held = ` This phone holds ${estimate.athleteCount} ${estimate.athleteCount === 1 ? 'athlete' : 'athletes'}, ${megabytes(estimate.totalBytes)}.`;
  const over = estimate.totalBytes > estimate.capBytes
    ? ' That is over the limit, so a backup is not possible until a later version.'
    : '';
  return `${limit}${held}${over}`;
}

/** Reads the athlete database sizes. Never throws: any failure is "unknown". */
export async function measureBackupSize(): Promise<BackupSizeEstimate | null> {
  try {
    // Loaded lazily: the backup store pulls in native modules.
    const { measureAthleteDatabaseBytes } = require('./backupStore') as typeof import('./backupStore');
    return estimateFromSizes(await measureAthleteDatabaseBytes());
  } catch {
    return null;
  }
}
