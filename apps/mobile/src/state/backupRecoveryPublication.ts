/** Crash-safe publication of the encrypted current-data recovery that a
 * portable restore creates before it replaces athlete data.
 *
 * Three exact same-directory names take part:
 * - final: the retained recovery offered by "Review previous data recovery";
 * - fresh: the newly sealed recovery before promotion;
 * - previous: the older retained recovery while promotion is in flight.
 *
 * The older retained recovery is renamed, never deleted, until the fresh
 * archive has been authenticated at the final path, and replacement starts
 * only after that superseded copy is gone. A surviving previous file therefore
 * proves no replacement began: live data still matches the fresh archive, and
 * the previous file is the only copy of its own content. */

export interface RecoveryPublicationPaths {
  readonly final: string;
  readonly fresh: string;
  readonly previous: string;
}

export interface RecoveryPublicationIo {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, value: string): Promise<void>;
  /** Must resolve only once the source is absent and the destination present. */
  move(source: string, destination: string): Promise<void>;
  /** Must resolve only once the path is confirmed absent. */
  remove(path: string): Promise<void>;
}

export type RecoveryReconciliation =
  | 'unchanged'
  | 'restored_previous'
  | 'kept_final'
  | 'promoted_fresh'
  | 'discarded_malformed';

/** Recovery rotation files could not be brought back to one retained candidate.
 * Every remaining file is preserved for deterministic startup reconciliation. */
export class RecoveryPublicationUnresolvedError extends Error {}

const UNRESOLVED_MESSAGE = 'Recovery cleanup could not be verified. Athlete data stays closed.';

/** Startup reconciliation. Without a password nothing here can prove
 * authenticity, so a name never makes a file valid: candidates are ranked by
 * role, and only a complete container envelope may displace another file.
 * 1. A well-formed previous file wins; it is the only copy of its content.
 * 2. Otherwise an existing final file stays; it is never validated or removed.
 * 3. Otherwise a well-formed fresh file is promoted; it may be the sole copy.
 * Rotation files that did not win are malformed or redundant and are removed.
 * Every intermediate state is resolved the same way by re-running this. */
export async function reconcileRecoveryPublication(
  io: RecoveryPublicationIo,
  paths: RecoveryPublicationPaths,
  isWellFormed: (text: string) => boolean,
  restoreJournalPresent: boolean,
): Promise<RecoveryReconciliation> {
  const previousPresent = await io.exists(paths.previous);
  const freshPresent = await io.exists(paths.fresh);
  if (!previousPresent && !freshPresent) return 'unchanged';
  if (restoreJournalPresent) {
    // Replacement starts only after publication finishes, so rotation files
    // beside a restore journal are outside the protocol. Preserve everything.
    throw new RecoveryPublicationUnresolvedError(UNRESOLVED_MESSAGE);
  }
  if (previousPresent && isWellFormed(await io.read(paths.previous))) {
    if (freshPresent) await io.remove(paths.fresh);
    if (await io.exists(paths.final)) await io.remove(paths.final);
    await io.move(paths.previous, paths.final);
    return 'restored_previous';
  }
  if (await io.exists(paths.final)) {
    if (freshPresent) await io.remove(paths.fresh);
    if (previousPresent) await io.remove(paths.previous);
    return 'kept_final';
  }
  if (freshPresent && isWellFormed(await io.read(paths.fresh))) {
    await io.move(paths.fresh, paths.final);
    if (previousPresent) await io.remove(paths.previous);
    return 'promoted_fresh';
  }
  if (freshPresent) await io.remove(paths.fresh);
  if (previousPresent) await io.remove(paths.previous);
  return 'discarded_malformed';
}

/** Publish a newly sealed current-data recovery before a portable restore.
 * authenticate returns the archive identity only when the password opens the
 * exact text. The fresh file is authenticated before promotion and again at
 * the final path; only then is the older retained recovery superseded. */
export async function publishRecoveryBackup(
  io: RecoveryPublicationIo,
  paths: RecoveryPublicationPaths,
  sealedText: string,
  authenticate: (text: string) => Promise<string | null>,
): Promise<void> {
  if (await io.exists(paths.fresh) || await io.exists(paths.previous)) {
    throw new RecoveryPublicationUnresolvedError(UNRESOLVED_MESSAGE);
  }
  const retainedBefore = await io.exists(paths.final);
  try {
    await io.write(paths.fresh, sealedText);
    const sealedIdentity = await authenticate(await io.read(paths.fresh));
    if (sealedIdentity === null) throw new Error('The recovery backup could not be verified. Existing data is unchanged.');
    if (retainedBefore) await io.move(paths.final, paths.previous);
    await io.move(paths.fresh, paths.final);
    if (await authenticate(await io.read(paths.final)) !== sealedIdentity) {
      throw new Error('The retained recovery backup could not be verified. Existing data is unchanged.');
    }
    if (retainedBefore) await io.remove(paths.previous);
  } catch (error) {
    try {
      await abandonRecoveryPublication(io, paths, retainedBefore);
    } catch {
      throw new RecoveryPublicationUnresolvedError(UNRESOLVED_MESSAGE);
    }
    throw error;
  }
}

/** In-process failure: the process still knows whether a retained recovery
 * existed, so it restores the exact pre-publication recovery state. */
async function abandonRecoveryPublication(
  io: RecoveryPublicationIo,
  paths: RecoveryPublicationPaths,
  retainedBefore: boolean,
): Promise<void> {
  if (await io.exists(paths.previous)) {
    if (await io.exists(paths.fresh)) await io.remove(paths.fresh);
    if (await io.exists(paths.final)) await io.remove(paths.final);
    await io.move(paths.previous, paths.final);
    return;
  }
  if (await io.exists(paths.fresh)) await io.remove(paths.fresh);
  if (!retainedBefore && await io.exists(paths.final)) await io.remove(paths.final);
}
