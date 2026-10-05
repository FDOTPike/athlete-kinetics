export const RESTORE_JOURNAL_FILE = '.ak_restore_journal.json';
export const LEGACY_APPLY_MARKER_FILE = '.ak_restore_applying';
export const LEGACY_COMMIT_MARKER_FILE = '.ak_restore_committed';
export const LEGACY_ROLLBACK_MARKER_FILE = '.ak_restore_rolled_back';
export const RECOVERY_BACKUP_FILE = 'pikeMethods-recovery-current.pmbak';
export const RECOVERY_BACKUP_NEW_FILE = `${RECOVERY_BACKUP_FILE}.new`;
export const RECOVERY_BACKUP_PREVIOUS_FILE = `${RECOVERY_BACKUP_FILE}.previous`;
/** A complete recovery container that startup reconciliation could not select
 * without a password, preserved under its SHA-256 until a newer verified
 * recovery supersedes it. Never swept by name. */
export const RECOVERY_BACKUP_ALTERNATE_FILE_PATTERN = /^pikeMethods-recovery-current\.pmbak\.alternate-[a-f0-9]{64}$/;
export function recoveryBackupAlternateFile(sha256Hex: string): string {
  if (!/^[a-f0-9]{64}$/.test(sha256Hex)) throw new Error('A preserved recovery candidate needs a SHA-256 digest.');
  return `${RECOVERY_BACKUP_FILE}.alternate-${sha256Hex}`;
}

export type RestoreMarkerKind = 'applying' | 'committed' | 'rolled_back';

const OPERATION_ID = '[a-f0-9]{32}';
const JOURNAL_TEMP = new RegExp(`^\\.ak_restore_journal-${OPERATION_ID}\\.new$`);
const OPERATION_MARKER = new RegExp(`^\\.ak_restore_(?:applying|committed|rolled_back)-${OPERATION_ID}$`);
const OPERATION_MARKER_TEMP = new RegExp(`^\\.ak_restore_(?:applying|committed|rolled_back)-${OPERATION_ID}\\.new$`);
const LEGACY_MARKERS = new Set([
  LEGACY_APPLY_MARKER_FILE,
  LEGACY_COMMIT_MARKER_FILE,
  LEGACY_ROLLBACK_MARKER_FILE,
]);

export function restoreJournalTempFile(operationId: string): string {
  return `.ak_restore_journal-${operationId}.new`;
}

export function restoreMarkerFile(kind: RestoreMarkerKind, operationId: string): string {
  return `.ak_restore_${kind}-${operationId}`;
}

export function restoreMarkerTempFile(kind: RestoreMarkerKind, operationId: string): string {
  return `${restoreMarkerFile(kind, operationId)}.new`;
}

export interface AtomicMetadataIo {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, value: string): Promise<void>;
  move(source: string, destination: string): Promise<void>;
  remove(path: string): Promise<void>;
}

/** Publish tiny recovery metadata without ever exposing partially written
 * contents at the authoritative path. The caller supplies a same-directory
 * temporary path and validates the exact bytes before and after rename. */
export async function publishAtomicMetadata(
  io: AtomicMetadataIo,
  destination: string,
  temporary: string,
  value: string,
  validate: (value: string) => boolean,
): Promise<void> {
  if (await io.exists(destination)) {
    const existing = await io.read(destination);
    if (validate(existing)) return;
    throw new Error('Existing restore metadata is invalid. Recovery remains blocked.');
  }
  if (await io.exists(temporary)) await io.remove(temporary);
  await io.write(temporary, value);
  if (!validate(await io.read(temporary))) {
    throw new Error('Restore metadata temporary write could not be verified. Existing data is unchanged.');
  }
  await io.move(temporary, destination);
  if (await io.exists(temporary) || !(await io.exists(destination))) {
    throw new Error('Restore metadata could not be published. Existing data is unchanged.');
  }
  if (!validate(await io.read(destination))) {
    throw new Error('Restore metadata could not be confirmed. Existing data is unchanged.');
  }
}

/** Exact-name sweep used only while no restore operation is running. With no
 * journal, operation-bound marker files cannot authorize or suppress any
 * replacement; they are standalone cleanup debris. Recovery rotation files
 * (.new and .previous) are never swept by name: only
 * reconcileRecoveryPublication decides which recovery candidate survives. */
export async function sweepStandaloneRestoreMetadata(
  documentDirectory: string,
  names: readonly string[],
  journalPresent: boolean,
  remove: (path: string) => Promise<void>,
): Promise<readonly string[]> {
  const removed: string[] = [];
  for (const name of names) {
    const alwaysOrphan = JOURNAL_TEMP.test(name) || OPERATION_MARKER_TEMP.test(name);
    const standalone = !journalPresent && (OPERATION_MARKER.test(name) || LEGACY_MARKERS.has(name));
    if (!alwaysOrphan && !standalone) continue;
    await remove(`${documentDirectory}/${name}`);
    removed.push(name);
  }
  return removed;
}

/** Retire a published operation without creating an unrecoverable marker
 * combination. Terminal markers go first while applying and rollback copies
 * still authorize a safe rollback. Applying goes next; only then may recovery
 * files be removed. The journal remains until every earlier step completes. */
export async function cleanupRestorePublication(
  terminalMarkerPaths: readonly string[],
  applyingMarkerPaths: readonly string[],
  cleanupRecoveryFiles: () => Promise<void>,
  journalPath: string,
  removeConfirmed: (path: string) => Promise<void>,
): Promise<void> {
  for (const path of terminalMarkerPaths) await removeConfirmed(path);
  for (const path of applyingMarkerPaths) await removeConfirmed(path);
  await cleanupRecoveryFiles();
  await removeConfirmed(journalPath);
}
