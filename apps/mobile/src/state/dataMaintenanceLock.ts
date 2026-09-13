let activeOwner: string | null = null;
let bootAuthorized = false;

/** One process-wide lock covers the registry and every athlete database.
 * Callers hold it across all snapshot/restore awaits; normal mutations fail
 * closed until the owner releases it. */
export function acquireDataMaintenanceLock(owner: string): () => void {
  if (owner.trim() === '' || activeOwner !== null) throw new Error('Athlete data maintenance is already in progress.');
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
  }
}
