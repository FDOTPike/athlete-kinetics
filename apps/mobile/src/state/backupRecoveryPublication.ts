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
 * the previous file is the only copy of its own content.
 *
 * Preserved candidates (PR #18 review). Startup has no password, so it cannot
 * tell which of two complete containers is authentic. A well-formed rotation
 * file that reconciliation does not select is therefore never deleted: it is
 * moved to an exact name derived from its SHA-256 (`alternateFor`). "Review
 * previous data recovery" tries the selected recovery first and then preserved
 * candidates, deciding authenticity with the password. Preserved candidates are
 * superseded only by the next portable restore, after its newly verified
 * recovery has been authenticated at the durable final path. */

export interface RecoveryPublicationPaths {
  readonly final: string;
  readonly fresh: string;
  readonly previous: string;
  /** The exact preserved-candidate path for an archive with this SHA-256. */
  alternateFor(sha256Hex: string): string;
}

export interface RecoveryPublicationIo {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, value: string): Promise<void>;
  /** Must resolve only once the source is absent and the destination present. */
  move(source: string, destination: string): Promise<void>;
  /** Must resolve only once the path is confirmed absent. */
  remove(path: string): Promise<void>;
  /** Lowercase SHA-256 hex of the file's bytes. */
  hash(path: string): Promise<string>;
  /** Existing preserved-candidate paths, in a fixed order. */
  alternates(): Promise<readonly string[]>;
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

/** Move a well-formed candidate that was not selected to its content-addressed
 * name. A byte-identical copy already preserved there makes the source redundant. */
async function preserveCandidate(
  io: RecoveryPublicationIo,
  paths: RecoveryPublicationPaths,
  path: string,
): Promise<void> {
  const digest = await io.hash(path);
  const destination = paths.alternateFor(digest);
  if (await io.exists(destination)) {
    if (await io.hash(destination) !== digest) throw new RecoveryPublicationUnresolvedError(UNRESOLVED_MESSAGE);
    await io.remove(path);
    return;
  }
  await io.move(path, destination);
}

/** Startup reconciliation. Without a password nothing here can prove
 * authenticity, so a name never makes a file valid: candidates are ranked by
 * role, and only a structurally complete container may be selected.
 * 1. A well-formed previous file is selected; it is the only copy of its content.
 * 2. Otherwise an existing final file stays selected.
 * 3. Otherwise a well-formed fresh file is promoted; it may be the sole copy.
 * A well-formed candidate that is not selected is preserved, never deleted. Only
 * a structurally malformed file is removed. Every intermediate state is resolved
 * the same way by re-running this. */
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
  const previousWellFormed = previousPresent && isWellFormed(await io.read(paths.previous));
  const freshWellFormed = freshPresent && isWellFormed(await io.read(paths.fresh));
  const settle = async (present: boolean, wellFormed: boolean, path: string): Promise<void> => {
    if (!present) return;
    if (wellFormed) await preserveCandidate(io, paths, path);
    else await io.remove(path);
  };

  if (previousWellFormed) {
    await settle(freshPresent, freshWellFormed, paths.fresh);
    if (await io.exists(paths.final)) {
      await settle(true, isWellFormed(await io.read(paths.final)), paths.final);
    }
    await io.move(paths.previous, paths.final);
    return 'restored_previous';
  }
  if (await io.exists(paths.final)) {
    await settle(freshPresent, freshWellFormed, paths.fresh);
    await settle(previousPresent, false, paths.previous);
    return 'kept_final';
  }
  if (freshWellFormed) {
    await io.move(paths.fresh, paths.final);
    await settle(previousPresent, false, paths.previous);
    return 'promoted_fresh';
  }
  await settle(freshPresent, false, paths.fresh);
  await settle(previousPresent, false, paths.previous);
  return 'discarded_malformed';
}

/** Publish a newly sealed current-data recovery before a portable restore.
 * authenticate returns the archive identity only when the password opens the
 * exact text. The fresh file is authenticated before promotion and again at
 * the final path; only then is the older retained recovery superseded, followed
 * by any preserved candidates. */
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
    for (const alternate of await io.alternates()) await io.remove(alternate);
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
 * existed, so it restores the exact pre-publication recovery state whenever the
 * older recovery has not yet been superseded. Preserved candidates are never
 * touched here. */
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
