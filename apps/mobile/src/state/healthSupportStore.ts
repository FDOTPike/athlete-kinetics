import type { DB } from '@op-engineering/op-sqlite';
import {
  evaluateTrainingSupport,
  type HealthSupportHold, type HealthSupportScope, type HealthSupportReviewState,
  type HealthSupportPreferenceKind, type HealthSupportNoteKind,
  type PersonalizedAdviceTarget, type TrainingSupportDecision,
} from '@ak/inference';

export const SUPPORT_DISCLOSURE = 'Clinician instruction, entered by you — not independently verified.';
export const SUPPORT_HELD_MESSAGE = 'Health and training support: coach suggestions are on hold. You can rest, stop, end the session, and keep your history and notes.';
export const SUPPORT_UNAVAILABLE_MESSAGE = 'Health and training support is unavailable. Coach suggestions are on hold until the saved support data can be read.';
export const SUPPORT_DELETION_NOTICE = 'Deleting an instruction removes its text and revisions. A content-free review hold remains for the affected guidance; deleting the text does not release coach suggestions. Earlier exported backups are unchanged.';

export interface SupportBinding { readonly athleteId: string; readonly db: DB }
export interface SupportScopeInput {
  readonly targetKind: HealthSupportScope['targetKind'];
  readonly activityId?: string; readonly seriesId?: string; readonly occurrenceId?: string;
  readonly movementId?: number; readonly reportedScopeText?: string;
}
export interface SupportInstructionInput {
  readonly instructionId?: string;
  readonly instructionText: string; readonly issuerText?: string;
  readonly instructionDate?: string; readonly effectiveDate?: string;
  readonly reviewDate?: string; readonly expiryDate?: string; readonly dateZoneId?: string;
  readonly scopes: readonly SupportScopeInput[];
}
export interface SupportDetails {
  readonly athleteId: string; readonly revision: number; readonly reviewState: HealthSupportReviewState;
  readonly preferences: readonly { preferenceKind: HealthSupportPreferenceKind; reportedValue: string; detailText: string | null }[];
  readonly notes: readonly { noteId: string; noteKind: HealthSupportNoteKind; bodyText: string; revision: number }[];
  readonly instructions: readonly { instructionId: string; revision: number; instructionText: string; issuerText: string | null;
    transcriptionState: 'draft' | 'user_confirmed'; instructionDate: string | null; effectiveDate: string | null;
    reviewDate: string | null; expiryDate: string | null; dateZoneId: string | null; scopes: readonly SupportScopeInput[] }[];
}
export interface SupportFacts {
  readonly athleteId: string; readonly contractAvailable: boolean; readonly revision: number;
  readonly reviewState: HealthSupportReviewState; readonly holds: readonly Omit<HealthSupportHold, 'scopes'>[];
}

const rows = <T>(result: unknown): T[] => {
  const value = (result as { rows?: unknown }).rows;
  if (Array.isArray(value)) return value as T[];
  const array = (value as { _array?: unknown } | undefined)?._array;
  if (!Array.isArray(array)) throw new Error(SUPPORT_UNAVAILABLE_MESSAGE);
  return array as T[];
};
const bounded = (value: string, maximum: number, optional = false): string => {
  if ((!optional && value.trim().length === 0) || [...value].length > maximum || value.includes('\0')) {
    throw new Error(`Support text must ${optional ? '' : 'contain text and '}fit within ${maximum} characters.`);
  }
  return value;
};
const date = (value: string | undefined): string | null => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Use YYYY-MM-DD for a reported date.');
  const at = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(at.getTime()) || at.toISOString().slice(0, 10) !== value) throw new Error('Enter a real reported calendar date.');
  return value;
};
const tables = ['health_support_profile', 'health_support_preference', 'health_support_note',
  'clinician_instruction', 'clinician_instruction_revision', 'health_support_hold', 'health_support_scope',
  'recommendation_support_record', 'recommendation_hold_basis', 'recommendation_activity_basis'] as const;

/** All methods verify the registry's active athlete AND the exact open handle.
 * No note, issuer, preference, or transcription is read by facts()/evaluate().
 * Callers supply time; savepoints compose with the owning store transaction.
 */
export function createHealthSupportStore(binding: SupportBinding, current: () => SupportBinding | null) {
  const db = binding.db;
  const check = (): void => {
    const active = current();
    if (active === null || active.athleteId !== binding.athleteId || active.db !== db) throw new Error(SUPPORT_UNAVAILABLE_MESSAGE);
  };
  const query = <T>(sql: string, values: (string | number | null)[] = []): T[] => rows<T>(db.executeSync(sql, values));
  const requireContract = (): void => {
    check();
    const present = query<{ name: string }>(`SELECT name FROM sqlite_master WHERE type='table' AND name IN (${tables.map(() => '?').join(',')})`, [...tables]);
    if (present.length !== tables.length) throw new Error(SUPPORT_UNAVAILABLE_MESSAGE);
  };
  const profile = () => query<{ revision: number; reviewState: HealthSupportReviewState }>(
    'SELECT revision,review_state AS reviewState FROM health_support_profile WHERE singleton_id=1')[0]
    ?? { revision: 0, reviewState: 'not_assessed' as const };
  const unavailable = (): SupportFacts => ({ athleteId: binding.athleteId, contractAvailable: false,
    revision: 0, reviewState: 'not_assessed', holds: [] });
  const facts = (): SupportFacts => {
    try {
      requireContract();
      const p = profile();
      const holds = query<Omit<HealthSupportHold, 'scopes'>>(`SELECT hold_id AS holdId,revision,
        instruction_id AS instructionId,instruction_revision AS instructionRevision,origin,state,
        reason_code AS reasonCode,created_at_ms AS createdAtMs,updated_at_ms AS updatedAtMs
        FROM health_support_hold ORDER BY hold_id`);
      // A damaged/partial contract cannot make an instruction disappear from evaluation.
      const missing = query<{ n: number }>(`SELECT count(*) AS n FROM clinician_instruction i
        LEFT JOIN clinician_instruction_revision r ON r.instruction_id=i.instruction_id AND r.revision=i.current_revision
        WHERE r.instruction_id IS NULL OR (r.lifecycle <> 'withdrawn' AND NOT EXISTS
          (SELECT 1 FROM health_support_hold h WHERE h.instruction_id=i.instruction_id AND h.instruction_revision=i.current_revision))`)[0];
      if (missing === undefined || missing.n > 0) return unavailable();
      if (p.reviewState !== 'not_assessed' && holds.length === 0) return unavailable();
      return { athleteId: binding.athleteId, contractAvailable: true, ...p, holds };
    } catch { return unavailable(); }
  };
  const evaluate = (targets: readonly PersonalizedAdviceTarget[]): TrainingSupportDecision => {
    const snapshot = facts();
    if (!snapshot.contractAvailable) return evaluateTrainingSupport({ contractAvailable: false, holds: [], target: { targetKind: 'all_prescription' } });
    const holdIds: string[] = [];
    const reasonCodes = new Set<string>();
    try {
      // At most one hold's scopes in memory (256 rows per owner in frozen 064).
      // Do not hydrate all historical revision scopes or any prose for a collapsed screen.
      for (const h of snapshot.holds) {
        if (h.state === 'withdrawn') continue;
        const scopes = query<HealthSupportScope>(`SELECT scope_id AS scopeId,instruction_id AS instructionId,
          instruction_revision AS instructionRevision,hold_id AS holdId,target_kind AS targetKind,
          activity_id AS activityId,series_id AS seriesId,occurrence_id AS occurrenceId,movement_id AS movementId,
          NULL AS reportedScopeText FROM health_support_scope WHERE hold_id=?
          OR (instruction_id=? AND instruction_revision=?) ORDER BY scope_id`, [h.holdId, h.instructionId, h.instructionRevision]);
        const matches = (targets.length ? targets : [{ targetKind: 'all_prescription' as const }]).some((target) =>
          evaluateTrainingSupport({ contractAvailable: true, holds: [{ ...h, scopes }], target }).status === 'held');
        if (matches) { holdIds.push(h.holdId); reasonCodes.add(h.reasonCode); }
      }
      check();
      return holdIds.length ? { status: 'held', holdIds: holdIds.sort(), reasonCodes: [...reasonCodes].sort() }
        : { status: 'available', holdIds: [] };
    } catch { return { status: 'support_unavailable', holdIds: [] }; }
  };
  const transaction = <T>(work: () => T): T => {
    check();
    db.executeSync('SAVEPOINT health_support_write');
    try { const result = work(); check(); db.executeSync('RELEASE health_support_write'); return result; }
    catch (error) {
      try { db.executeSync('ROLLBACK TO health_support_write'); db.executeSync('RELEASE health_support_write'); } catch { /* preserve original */ }
      throw error;
    }
  };
  const write = <T>(expectedRevision: number, atMs: number, work: () => T): T => transaction(() => {
    requireContract();
    if (!Number.isSafeInteger(atMs) || atMs < 0) throw new Error('Support timestamp is invalid.');
    if (profile().revision !== expectedRevision) throw new Error('Support changed. Reopen the details before saving.');
    const result = work();
    db.executeSync(`INSERT INTO health_support_profile (singleton_id,revision,review_state,details_visibility,updated_at_ms)
      VALUES (1,1,'not_assessed','collapsed',?) ON CONFLICT(singleton_id) DO UPDATE
      SET revision=revision+1,details_visibility='collapsed',updated_at_ms=excluded.updated_at_ms`, [atMs]);
    return result;
  });
  const allocate = (prefix: string, atMs: number, table: string, column: string): string => {
    // table/column are internal constants; user data is always bound.
    for (let n = 0; n < 10000; n++) {
      const id = `${prefix}-${atMs}-${n}`;
      if (!query(`SELECT 1 FROM ${table} WHERE ${column}=?`, [id]).length) return id;
    }
    throw new Error('Support identifier capacity reached.');
  };
  const scopeRows = (input: readonly SupportScopeInput[], owner: { holdId?: string; instructionId?: string; revision?: number }, atMs: number) => {
    if (input.length > 256) throw new Error('An instruction supports at most 256 scopes.');
    for (const scope of input) {
      const id = allocate('scope', atMs, 'health_support_scope', 'scope_id');
      db.executeSync(`INSERT INTO health_support_scope (scope_id,instruction_id,instruction_revision,hold_id,
        target_kind,activity_id,series_id,occurrence_id,movement_id,reported_scope_text) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, owner.instructionId ?? null, owner.revision ?? null, owner.holdId ?? null, scope.targetKind,
        scope.activityId ?? null, scope.seriesId ?? null, scope.occurrenceId ?? null, scope.movementId ?? null,
        scope.reportedScopeText == null ? null : bounded(scope.reportedScopeText, 4000, true)]);
    }
  };
  const details = (): SupportDetails => {
    requireContract();
    const preferences = query<SupportDetails['preferences'][number]>(`SELECT preference_kind AS preferenceKind,
      reported_value AS reportedValue,detail_text AS detailText FROM health_support_preference ORDER BY preference_kind`);
    const notes = query<SupportDetails['notes'][number]>(`SELECT note_id AS noteId,note_kind AS noteKind,
      body_text AS bodyText,revision FROM health_support_note ORDER BY note_id`);
    const instructions = query<Omit<SupportDetails['instructions'][number], 'scopes'>>(`SELECT i.instruction_id AS instructionId,
      r.revision,r.instruction_text AS instructionText,r.issuer_text AS issuerText,r.transcription_state AS transcriptionState,
      r.instruction_date AS instructionDate,r.effective_date AS effectiveDate,r.review_date AS reviewDate,
      r.expiry_date AS expiryDate,r.date_zone_id AS dateZoneId FROM clinician_instruction i
      JOIN clinician_instruction_revision r ON r.instruction_id=i.instruction_id AND r.revision=i.current_revision ORDER BY i.instruction_id`)
      .map((i) => ({ ...i, scopes: query<SupportScopeInput>(`SELECT target_kind AS targetKind,activity_id AS activityId,
        series_id AS seriesId,occurrence_id AS occurrenceId,movement_id AS movementId,reported_scope_text AS reportedScopeText
        FROM health_support_scope WHERE instruction_id=? AND instruction_revision=? ORDER BY scope_id`, [i.instructionId, i.revision]) }));
    return { athleteId: binding.athleteId, ...profile(), preferences, notes, instructions };
  };
  return {
    facts, evaluate, details,
    savePreference: (kind: HealthSupportPreferenceKind, value: string, detail: string, revision: number, atMs: number) => write(revision, atMs, () => {
      db.executeSync(`INSERT INTO health_support_preference (preference_id,revision,preference_kind,reported_value,
        detail_text,provenance,recorded_at_ms,updated_at_ms) VALUES (?,1,?,?,?,'user_reported',?,?)
        ON CONFLICT(preference_kind) DO UPDATE SET revision=revision+1,reported_value=excluded.reported_value,
        detail_text=excluded.detail_text,updated_at_ms=excluded.updated_at_ms`,
      [`preference-${kind}`, kind, value, bounded(detail, 4000, true), atMs, atMs]);
    }),
    saveNote: (kind: HealthSupportNoteKind, body: string, noteId: string | undefined, revision: number, atMs: number) => write(revision, atMs, () => {
      bounded(body, 4000);
      if (noteId !== undefined && !query('SELECT 1 FROM health_support_note WHERE note_id=?', [noteId]).length) throw new Error('Support note was not found.');
      const id = noteId ?? allocate('note', atMs, 'health_support_note', 'note_id');
      if (noteId === undefined) db.executeSync(`INSERT INTO health_support_note
        (note_id,revision,note_kind,body_text,provenance,recorded_at_ms,updated_at_ms) VALUES (?,1,?,?,'user_reported',?,?)`, [id, kind, body, atMs, atMs]);
      else db.executeSync('UPDATE health_support_note SET revision=revision+1,note_kind=?,body_text=?,updated_at_ms=? WHERE note_id=?', [kind, body, atMs, id]);
      return id;
    }),
    deleteNote: (id: string, revision: number, atMs: number) => write(revision, atMs, () => {
      db.executeSync('DELETE FROM health_support_note WHERE note_id=?', [id]);
    }),
    setReviewState: (value: HealthSupportReviewState, revision: number, atMs: number) => write(revision, atMs, () => {
      db.executeSync(`INSERT INTO health_support_profile VALUES (1,?,?,'collapsed',?)
        ON CONFLICT(singleton_id) DO UPDATE SET review_state=excluded.review_state`, [Math.max(1, revision), value, atMs]);
      if (value !== 'not_assessed' && !query("SELECT 1 FROM health_support_hold WHERE origin='user_requested' AND state='held' LIMIT 1").length) {
        const id = allocate('pause', atMs, 'health_support_hold', 'hold_id');
        db.executeSync(`INSERT INTO health_support_hold (hold_id,revision,origin,state,reason_code,created_at_ms,updated_at_ms)
          VALUES (?,1,'user_requested','held','review_requested',?,?)`, [id, atMs, atMs]);
      } else if (value === 'not_assessed') {
        // Explicit withdrawal concerns self-requested pauses only. Clinical review holds remain.
        db.executeSync(`UPDATE health_support_hold SET state='withdrawn',revision=revision+1,updated_at_ms=?
          WHERE origin='user_requested' AND state='held'`, [atMs]);
        if (query("SELECT 1 FROM health_support_hold WHERE state='held' LIMIT 1").length) {
          db.executeSync("UPDATE health_support_profile SET review_state='review_required' WHERE singleton_id=1");
        }
      }
    }),
    saveInstruction: (input: SupportInstructionInput, revision: number, atMs: number) => write(revision, atMs, () => {
      bounded(input.instructionText, 16000);
      const prior = input.instructionId === undefined ? undefined : query<{ revision: number }>(
        'SELECT current_revision AS revision FROM clinician_instruction WHERE instruction_id=?', [input.instructionId])[0];
      if (input.instructionId !== undefined && prior === undefined) throw new Error('Support instruction was not found.');
      const id = input.instructionId ?? allocate('instruction', atMs, 'clinician_instruction', 'instruction_id');
      const next = (prior?.revision ?? 0) + 1;
      if (prior === undefined) db.executeSync('INSERT INTO clinician_instruction VALUES (?,?,?)', [id, next, atMs]);
      else {
        db.executeSync("UPDATE clinician_instruction_revision SET lifecycle='superseded' WHERE instruction_id=? AND revision=?", [id, prior.revision]);
        db.executeSync('UPDATE clinician_instruction SET current_revision=? WHERE instruction_id=?', [next, id]);
      }
      db.executeSync(`INSERT INTO clinician_instruction_revision (instruction_id,revision,instruction_text,issuer_text,
        source_class,provenance,verification_state,recorded_at_ms,instruction_date,effective_date,review_date,expiry_date,
        date_zone_id,date_status,transcription_state,confirmed_at_ms,supersedes_revision,lifecycle)
        VALUES (?,?,?,?,'clinician_guidance_as_reported','user_reported','not_verified',?,?,?,?,?,?,'unknown','draft',NULL,?,'current')`,
      [id, next, input.instructionText, input.issuerText ? bounded(input.issuerText, 160, true) : null, atMs,
        date(input.instructionDate), date(input.effectiveDate), date(input.reviewDate), date(input.expiryDate),
        input.dateZoneId ? bounded(input.dateZoneId, 128) : null, prior?.revision ?? null]);
      const holdId = allocate('instruction-review', atMs, 'health_support_hold', 'hold_id');
      db.executeSync(`INSERT INTO health_support_hold (hold_id,revision,instruction_id,instruction_revision,origin,state,
        reason_code,created_at_ms,updated_at_ms) VALUES (?,1,?,?,'instruction_review','held',?,?,?)`,
      [holdId, id, next, prior ? 'source_changed' : 'instruction_unreviewed', atMs, atMs]);
      scopeRows(input.scopes, { instructionId: id, revision: next }, atMs);
      // Duplicate only content-free identity scope for the deletion marker.
      scopeRows(input.scopes.map((s) => ({ ...s, reportedScopeText: undefined })), { holdId }, atMs);
      db.executeSync(`INSERT INTO health_support_profile VALUES (1,?,'review_required','collapsed',?)
        ON CONFLICT(singleton_id) DO UPDATE SET review_state='review_required'`, [Math.max(1, revision), atMs]);
      return id;
    }),
    confirmInstruction: (id: string, instructionRevision: number, revision: number, atMs: number) => write(revision, atMs, () => {
      const envelope = query<{ revision: number }>('SELECT current_revision AS revision FROM clinician_instruction WHERE instruction_id=?', [id])[0];
      if (envelope?.revision !== instructionRevision) throw new Error('Support instruction changed. Review its current revision before confirming.');
      db.executeSync(`UPDATE clinician_instruction_revision SET transcription_state='user_confirmed',confirmed_at_ms=?
        WHERE instruction_id=? AND revision=? AND lifecycle='current'`, [atMs, id, instructionRevision]);
    }),
    deleteInstruction: (id: string, revision: number, atMs: number) => write(revision, atMs, () => {
      // 064 preserves hold identities/revisions; scrub independently stored scope prose too.
      db.executeSync(`UPDATE health_support_scope SET reported_scope_text=NULL WHERE hold_id IN
        (SELECT hold_id FROM health_support_hold WHERE instruction_id=?)`, [id]);
      db.executeSync('UPDATE health_support_hold SET updated_at_ms=? WHERE instruction_id=?', [atMs, id]);
      db.executeSync('DELETE FROM clinician_instruction WHERE instruction_id=?', [id]);
    }),
    recordDecision: (targets: readonly PersonalizedAdviceTarget[], kind: 'program' | 'block' | 'session' | 'slot' | 'movement_substitution', identity: string, atMs: number): TrainingSupportDecision => {
      // Re-read decisive revisions inside the caller's transaction. No UI snapshot is authority.
      try {
        return transaction(() => {
          const decision = evaluate(targets);
          if (decision.status === 'support_unavailable') return decision;
          const snapshot = facts();
          const id = allocate('support-decision', atMs, 'recommendation_support_record', 'decision_id');
          db.executeSync(`INSERT INTO recommendation_support_record VALUES (?,?,?,?,?,?)`,
            [id, kind, bounded(`${identity}:${id}`, 160), decision.status, 'wo06-capture-1', atMs]);
          for (const holdId of decision.holdIds) {
            const h = snapshot.holds.find((candidate) => candidate.holdId === holdId);
            if (!h) throw new Error(SUPPORT_UNAVAILABLE_MESSAGE);
            db.executeSync('INSERT INTO recommendation_hold_basis VALUES (?,?,?,?)', [id, h.holdId, h.revision, h.reasonCode]);
          }
          return decision;
        });
      } catch { return { status: 'support_unavailable', holdIds: [] }; }
    },
  };
}
