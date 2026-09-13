import type { BackupEnvelopeV1 } from './contract';

export type RestoreMode = 'replace' | 'merge';
export type RestorePhase =
  | 'idle'
  | 'validated'
  | 'recovery_copied'
  | 'applying'
  | 'committed'
  | 'rollback_required'
  | 'rolled_back'
  | 'cancelled'
  | 'blocked_low_storage';

export interface RestoreState {
  readonly phase: RestorePhase;
  readonly backupId: string | null;
}

export type RestoreEvent =
  | { readonly type: 'VALIDATE'; readonly backupId: string }
  | { readonly type: 'RECOVERY_COPY_CONFIRMED' }
  | { readonly type: 'BEGIN_REPLACE' }
  | { readonly type: 'COMMIT' }
  | { readonly type: 'FAIL' }
  | { readonly type: 'CANCEL' }
  | { readonly type: 'LOW_STORAGE' }
  | { readonly type: 'ROLLBACK_CONFIRMED' };

export type RestoreDecision =
  | { readonly ok: true; readonly mode: 'replace'; readonly recoveryCopyRequired: true; readonly incoming: BackupEnvelopeV1 }
  | { readonly ok: false; readonly code: 'merge_not_supported' | 'newer_schema' | 'schema_adapter_unavailable'; readonly message: string };

export interface RestoreCompatibility {
  readonly readerSchemaVersion: number;
  readonly supportedSourceSchemaVersions: readonly number[];
}

export const initialRestoreState = (): RestoreState => ({ phase: 'idle', backupId: null });

/** V1 deliberately refuses merge. Identifiers and histories cross-reference
 * each other, so a silent row-wise merge cannot be made deterministic or safe. */
export function decideRestore(
  mode: RestoreMode,
  incoming: BackupEnvelopeV1,
  compatibility: RestoreCompatibility,
): RestoreDecision {
  if (mode === 'merge') {
    return { ok: false, code: 'merge_not_supported', message: 'Version 1 restores replace existing data only.' };
  }
  if (incoming.manifest.sourceSchemaVersion > compatibility.readerSchemaVersion) {
    return { ok: false, code: 'newer_schema', message: 'Backup database schema is newer than this app supports.' };
  }
  if (!compatibility.supportedSourceSchemaVersions.includes(incoming.manifest.sourceSchemaVersion)) {
    return { ok: false, code: 'schema_adapter_unavailable', message: 'No verified restore adapter is registered for this backup schema.' };
  }
  return { ok: true, mode: 'replace', recoveryCopyRequired: true, incoming };
}

/** Pure model of the native/database boundary. It does not copy files or run a
 * transaction; integration must confirm each event only after the operation. */
export function transitionRestore(state: RestoreState, event: RestoreEvent): RestoreState {
  switch (state.phase) {
    case 'idle':
      if (event.type === 'VALIDATE' && event.backupId.trim().length > 0) {
        return { phase: 'validated', backupId: event.backupId };
      }
      break;
    case 'validated':
      if (event.type === 'RECOVERY_COPY_CONFIRMED') return { ...state, phase: 'recovery_copied' };
      if (event.type === 'CANCEL') return { ...state, phase: 'cancelled' };
      if (event.type === 'LOW_STORAGE') return { ...state, phase: 'blocked_low_storage' };
      break;
    case 'recovery_copied':
      if (event.type === 'BEGIN_REPLACE') return { ...state, phase: 'applying' };
      if (event.type === 'CANCEL') return { ...state, phase: 'cancelled' };
      if (event.type === 'LOW_STORAGE') return { ...state, phase: 'blocked_low_storage' };
      break;
    case 'applying':
      if (event.type === 'COMMIT') return { ...state, phase: 'committed' };
      if (event.type === 'FAIL' || event.type === 'CANCEL' || event.type === 'LOW_STORAGE') {
        return { ...state, phase: 'rollback_required' };
      }
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
