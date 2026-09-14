import type { BackupArchiveV1 } from './contract';

export type RestorePhase =
  | 'idle' | 'validated' | 'recovery_verified' | 'prepared' | 'applying'
  | 'committed' | 'rollback_required' | 'rolled_back' | 'cancelled' | 'blocked_low_storage';

export interface RestoreState { readonly phase: RestorePhase; readonly backupId: string | null }

export type RestoreEvent =
  | { readonly type: 'VALIDATE'; readonly backupId: string }
  | { readonly type: 'RECOVERY_VERIFIED' }
  | { readonly type: 'PREPARE' }
  | { readonly type: 'BEGIN_REPLACE' }
  | { readonly type: 'COMMIT' }
  | { readonly type: 'FAIL' }
  | { readonly type: 'CANCEL' }
  | { readonly type: 'LOW_STORAGE' }
  | { readonly type: 'ROLLBACK_CONFIRMED' };

export const initialRestoreState = (): RestoreState => ({ phase: 'idle', backupId: null });

export function transitionRestore(state: RestoreState, event: RestoreEvent): RestoreState {
  switch (state.phase) {
    case 'idle':
      if (event.type === 'VALIDATE' && event.backupId.trim().length > 0) return { phase: 'validated', backupId: event.backupId };
      break;
    case 'validated':
      if (event.type === 'RECOVERY_VERIFIED') return { ...state, phase: 'recovery_verified' };
      if (event.type === 'CANCEL') return { ...state, phase: 'cancelled' };
      if (event.type === 'LOW_STORAGE') return { ...state, phase: 'blocked_low_storage' };
      break;
    case 'recovery_verified':
      if (event.type === 'PREPARE') return { ...state, phase: 'prepared' };
      if (event.type === 'CANCEL') return { ...state, phase: 'cancelled' };
      if (event.type === 'LOW_STORAGE') return { ...state, phase: 'blocked_low_storage' };
      break;
    case 'prepared':
      if (event.type === 'BEGIN_REPLACE') return { ...state, phase: 'applying' };
      if (event.type === 'FAIL' || event.type === 'CANCEL' || event.type === 'LOW_STORAGE') return { ...state, phase: 'rollback_required' };
      break;
    case 'applying':
      if (event.type === 'COMMIT') return { ...state, phase: 'committed' };
      if (event.type === 'FAIL' || event.type === 'CANCEL' || event.type === 'LOW_STORAGE') return { ...state, phase: 'rollback_required' };
      break;
    case 'rollback_required':
      if (event.type === 'ROLLBACK_CONFIRMED') return { ...state, phase: 'rolled_back' };
      break;
    case 'committed':
    case 'rolled_back':
    case 'cancelled':
    case 'blocked_low_storage':
      break;
  }
  throw new Error(`invalid restore transition: ${state.phase} + ${event.type}`);
}

export type RestoreDecision =
  | { readonly ok: true; readonly mode: 'replace'; readonly recoveryCopyRequired: true; readonly incoming: BackupArchiveV1 }
  | { readonly ok: false; readonly code: 'merge_not_supported' | 'newer_schema' | 'schema_adapter_unavailable'; readonly message: string };

export function decideRestore(
  mode: 'replace' | 'merge', incoming: BackupArchiveV1,
  compatibility: {
    readonly readerSchemaVersion: number; readonly supportedSourceSchemaVersions: readonly number[];
    readonly readerMigrationSlot: number; readonly supportedSourceMigrationSlots: readonly number[];
  },
): RestoreDecision {
  if (mode === 'merge') return { ok: false, code: 'merge_not_supported', message: 'Backups replace all existing athlete data; merge is not supported.' };
  if (incoming.sourceSchemaVersion > compatibility.readerSchemaVersion) {
    return { ok: false, code: 'newer_schema', message: 'Backup database schema is newer than this app supports.' };
  }
  if (incoming.sourceMigrationSlot > compatibility.readerMigrationSlot) {
    return { ok: false, code: 'newer_schema', message: 'Backup migration set is newer than this app supports.' };
  }
  if (!compatibility.supportedSourceSchemaVersions.includes(incoming.sourceSchemaVersion)
    || !compatibility.supportedSourceMigrationSlots.includes(incoming.sourceMigrationSlot)) {
    return { ok: false, code: 'schema_adapter_unavailable', message: 'No verified restore adapter is registered for this backup schema.' };
  }
  return { ok: true, mode: 'replace', recoveryCopyRequired: true, incoming };
}

/** Private recovery journal. It intentionally contains paths and existence
 * facts only: never athlete names, passwords, keys, or database contents. */
export interface RestoreJournalEntry {
  readonly targetPath: string;
  readonly stagedPath: string | null;
  readonly rollbackPath: string | null;
  readonly existedBefore: boolean;
}

export interface RestoreJournalV1 {
  readonly version: 1;
  readonly operationId: string;
  readonly entries: readonly RestoreJournalEntry[];
  readonly registryTargetPath: string;
  readonly registryStagedPath: string;
  readonly registryRollbackPath: string | null;
  readonly registryExistedBefore: boolean;
}

export interface JournalPathBoundary {
  readonly documentDirectory: string;
  readonly databaseDirectory: string;
}

const fileName = (path: string): string => path.slice(path.lastIndexOf('/') + 1);
const exactChild = (path: string, root: string, expectedName: string): boolean => {
  const normalizedRoot = root.endsWith('/') ? root.slice(0, -1) : root;
  return path.length <= 1_024 && !path.includes('\\') && !normalizedRoot.includes('\\')
    && path === `${normalizedRoot}/${expectedName}`;
};

export function validateRestoreJournal(value: unknown, boundary: JournalPathBoundary): RestoreJournalV1 | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const journal = value as Record<string, unknown>;
  const keys = Object.keys(journal).sort().join('|');
  if (keys !== ['entries', 'operationId', 'registryExistedBefore', 'registryRollbackPath', 'registryStagedPath', 'registryTargetPath', 'version'].sort().join('|')
    || journal.version !== 1 || typeof journal.operationId !== 'string' || !/^[a-f0-9]{32}$/.test(journal.operationId)
    || !Array.isArray(journal.entries) || journal.entries.length > 200
    || typeof journal.registryTargetPath !== 'string' || !exactChild(journal.registryTargetPath, boundary.documentDirectory, 'coach_athletes.json')
    || typeof journal.registryStagedPath !== 'string' || !exactChild(journal.registryStagedPath, boundary.documentDirectory, `.ak-registry-${journal.operationId}.new`)
    || (journal.registryRollbackPath !== null && (typeof journal.registryRollbackPath !== 'string'
      || !exactChild(journal.registryRollbackPath, boundary.documentDirectory, `.ak-registry-${journal.operationId}.old`)))
    || typeof journal.registryExistedBefore !== 'boolean'
    || (journal.registryExistedBefore !== (journal.registryRollbackPath !== null))) return null;
  const targets = new Set<string>();
  for (let index = 0; index < journal.entries.length; index += 1) {
    const raw = journal.entries[index];
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    const entry = raw as Record<string, unknown>;
    if (Object.keys(entry).sort().join('|') !== ['existedBefore', 'rollbackPath', 'stagedPath', 'targetPath'].sort().join('|')
      || typeof entry.targetPath !== 'string'
      || !/^(?:athlete_kinetics|ak_athlete_[a-z0-9]+)\.db$/.test(fileName(entry.targetPath))
      || !exactChild(entry.targetPath, boundary.databaseDirectory, fileName(entry.targetPath))
      || (entry.stagedPath !== null && (typeof entry.stagedPath !== 'string'
        || !exactChild(entry.stagedPath, boundary.databaseDirectory, `.ak-incoming-${journal.operationId}-${index}.db`)))
      || (entry.rollbackPath !== null && (typeof entry.rollbackPath !== 'string'
        || !exactChild(entry.rollbackPath, boundary.databaseDirectory, `.ak-rollback-${journal.operationId}-${index}.db`)))
      || typeof entry.existedBefore !== 'boolean'
      || (entry.existedBefore !== (entry.rollbackPath !== null))
      || targets.has(entry.targetPath)) return null;
    targets.add(entry.targetPath);
  }
  return value as RestoreJournalV1;
}
