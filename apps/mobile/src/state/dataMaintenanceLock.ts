let activeOwner: string | null = null;
let bootAuthorized = false;
/** Normal athlete-data operations currently between their first and last await. */
let activeMutationLeases = 0;

/** One process-wide lock covers the registry and every athlete database.
 * Callers hold it across all snapshot/restore awaits; normal mutations fail
 * closed until the owner releases it. */
export function acquireDataMaintenanceLock(owner: string): () => void {
  if (owner.trim() === '' || activeOwner !== null) throw new Error('Athlete data maintenance is already in progress.');
  // A check-only lock is not enough: an operation that passed a momentary check
  // can still be paused at an await. Maintenance waits for every lease to settle.
  if (activeMutationLeases > 0) throw new Error('Athlete data is still being saved or opened. Try again in a moment.');
  activeOwner = owner;
  let released = false;
  return () => {
    if (!released && activeOwner === owner) activeOwner = null;
    released = true;
  };
}

export function dataMutationAllowed(): boolean {
  return activeOwner === null;
}

/** Claim a mutation lease synchronously, before the first await of a normal
 * athlete-data operation (registry read/write, athlete switch/create/delete,
 * store boot), and release it only when that operation has settled. No lease
 * is granted while maintenance holds the data or athlete-data boot has not been
 * authorized; backup, restore and startup recovery cannot start while any
 * lease is held. Returns null when the operation must not start. */
export function tryAcquireDataMutationLease(): (() => void) | null {
  if (activeOwner !== null || !bootAuthorized) return null;
  activeMutationLeases += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeMutationLeases -= 1;
  };
}

export function activeDataMutationLeaseCount(): number {
  return activeMutationLeases;
}

export function authorizeAthleteDataBoot(): void {
  bootAuthorized = true;
}

export function revokeAthleteDataBoot(): void {
  bootAuthorized = false;
}

export function athleteDataBootAllowed(): boolean {
  return bootAuthorized && activeOwner === null;
}

export function requireDataMutationAllowed(): void {
  if (!dataMutationAllowed()) throw new Error('Athlete data is temporarily locked for backup or restore.');
}

export function resetDataMaintenanceLockForTests(): void {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    activeOwner = null;
    bootAuthorized = false;
    activeMutationLeases = 0;
  }
}
