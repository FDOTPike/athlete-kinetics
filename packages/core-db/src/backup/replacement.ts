import type { RestoreJournalV1 } from './restoreModel';
import { validateAggregateDatabaseBytes } from './contract';

export interface RestoreFileOps {
  exists(path: string): Promise<boolean>;
  remove(path: string): Promise<void>;
  copy(source: string, destination: string): Promise<void>;
}

export function replacementStorageRequirement(payloadBytes: number): number {
  if (!Number.isSafeInteger(payloadBytes) || payloadBytes < 0) throw new Error('invalid replacement payload size');
  const required = payloadBytes * 3;
  if (!Number.isSafeInteger(required)) throw new Error('replacement payload size overflow');
  return Math.max(32 * 1024 * 1024, required);
}

export function hasRequiredStorage(availableBytes: number | null, requiredBytes: number): boolean {
  if (!Number.isSafeInteger(requiredBytes) || requiredBytes < 0) return false;
  return availableBytes !== null && Number.isSafeInteger(availableBytes) && availableBytes >= requiredBytes;
}

export async function copyFileConfirmed(
  copy: (source: string, destination: string) => Promise<boolean>,
  source: string,
  destination: string,
): Promise<void> {
  if (!(await copy(source, destination))) throw new Error('recovery copy was not confirmed');
}

export type InterruptedRestoreAction = 'cleanup_preparation' | 'rollback' | 'cleanup_committed' | 'cleanup_rolled_back' | 'preserve_invalid';

/** Markers are meaningful only for the exact operation named by the journal.
 * A stale/corrupt commit marker can therefore never suppress rollback. */
export function interruptedRestoreAction(
  operationId: string,
  applyingMarker: string | null,
  committedMarker: string | null,
  rolledBackMarker: string | null = null,
): InterruptedRestoreAction {
  const applyingMatches = applyingMarker === operationId;
  const committedMatches = committedMarker === operationId;
  const rolledBackMatches = rolledBackMarker === operationId;
  if (applyingMatches && rolledBackMatches && !committedMatches) return 'cleanup_rolled_back';
  if (applyingMatches && committedMatches) return 'cleanup_committed';
  if (applyingMatches) return 'rollback';
  if (applyingMarker === null && committedMarker === null && rolledBackMarker === null) return 'cleanup_preparation';
  return 'preserve_invalid';
}

export async function executeInterruptedRestoreRecovery(
  journal: RestoreJournalV1,
  applyingMarker: string | null,
  committedMarker: string | null,
  rolledBackMarker: string | null,
  rollback: (journal: RestoreJournalV1) => Promise<void>,
  cleanup: (journal: RestoreJournalV1) => Promise<void>,
): Promise<boolean> {
  const action = interruptedRestoreAction(journal.operationId, applyingMarker, committedMarker, rolledBackMarker);
  if (action === 'preserve_invalid') throw new Error('restore recovery markers are invalid');
  if (action === 'rollback') await rollback(journal);
  await cleanup(journal);
  return action === 'rollback';
}

export async function cleanupAbandonedBackupDirectories(
  names: readonly string[],
  remove: (name: string) => Promise<void>,
): Promise<readonly string[]> {
  const removed: string[] = [];
  for (const name of names) {
    if (!/^ak-backup-[a-f0-9]{32}$/.test(name)) continue;
    await remove(name);
    removed.push(name);
  }
  return removed;
}

export async function collectBoundedSnapshots<TSource, TPrepared extends { readonly byteLength: number }, TResult>(
  sources: readonly TSource[],
  liveSize: (source: TSource, index: number) => Promise<unknown>,
  prepare: (source: TSource, index: number) => Promise<TPrepared>,
  read: (prepared: TPrepared, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  const liveSizes: unknown[] = [];
  for (let index = 0; index < sources.length; index += 1) liveSizes.push(await liveSize(sources[index]!, index));
  validateAggregateDatabaseBytes(liveSizes);

  const results: TResult[] = [];
  let preparedBytes = 0;
  for (let index = 0; index < sources.length; index += 1) {
    const pending = await prepare(sources[index]!, index);
    preparedBytes = validateAggregateDatabaseBytes([preparedBytes, pending.byteLength]);
    // No snapshot contents are read or retained until the running VACUUM
    // output total has passed the stricter decoded-payload cap.
    results.push(await read(pending, index));
  }
  return results;
}

/** Idempotent rollback used both in-process and after a cold-start journal
 * recovery. Rollback copies are intentionally retained until every target and
 * the registry have been restored successfully. */
export async function rollbackRestoreFiles(journal: RestoreJournalV1, io: RestoreFileOps): Promise<void> {
  for (const entry of journal.entries) {
    const rollbackPath = entry.rollbackPath;
    if (entry.existedBefore) {
      if (rollbackPath === null || !(await io.exists(rollbackPath))) {
        throw new Error('required database rollback copy is missing');
      }
    }
    if (await io.exists(entry.targetPath)) await io.remove(entry.targetPath);
    if (entry.existedBefore && rollbackPath !== null) {
      await io.copy(rollbackPath, entry.targetPath);
    }
  }
  const registryRollbackPath = journal.registryRollbackPath;
  if (journal.registryExistedBefore) {
    if (registryRollbackPath === null || !(await io.exists(registryRollbackPath))) {
      throw new Error('required registry rollback copy is missing');
    }
  }
  if (await io.exists(journal.registryTargetPath)) await io.remove(journal.registryTargetPath);
  if (journal.registryExistedBefore && registryRollbackPath !== null) {
    await io.copy(registryRollbackPath, journal.registryTargetPath);
  }
}

/** Cleanup is separate from rollback so no caller can erase its only recovery
 * copy after an incomplete rollback. */
export async function cleanupRestoreFiles(journal: RestoreJournalV1, io: RestoreFileOps): Promise<void> {
  for (const entry of journal.entries) {
    if (entry.stagedPath !== null && await io.exists(entry.stagedPath)) await io.remove(entry.stagedPath);
    if (entry.rollbackPath !== null && await io.exists(entry.rollbackPath)) await io.remove(entry.rollbackPath);
  }
  if (await io.exists(journal.registryStagedPath)) await io.remove(journal.registryStagedPath);
  if (journal.registryRollbackPath !== null && await io.exists(journal.registryRollbackPath)) await io.remove(journal.registryRollbackPath);
}
