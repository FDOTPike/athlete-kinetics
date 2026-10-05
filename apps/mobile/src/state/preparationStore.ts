/**
 * preparationStore.ts — the SQL boundary for movement preparation (065).
 *
 * Every function takes the open database handle and runs synchronously INSIDE
 * the caller's transaction; none of them opens, commits or rolls back one. The
 * zustand store owns transaction scope so a preparation write always lands
 * with the session, checkpoint or outcome write it belongs to.
 *
 * Identity. A protocol is addressed by (session_id, instance_id, revision) AND
 * must still be bound to its session's own start time:
 *   - `revision` makes a duplicate tap or a stale screen a no-op;
 *   - `instance_id` + the start-time binding stop a NEW session that reuses an
 *     old session id (ids are reused after a reset) from inheriting the old
 *     session's preparation, which a revision check alone cannot do.
 *
 * Nothing here writes set_record. Preparation is not training volume.
 */
import {
  PREPARATION_PROTOCOL_VERSION,
  isExtraPreparationWork,
  isTerminalPreparationStatus,
  parsePreparationProtocol,
  prescribedAmount,
  type PreparationItemStatus,
  type PreparationProtocol,
  type PreparationStatus,
} from '@ak/inference';

export interface PreparationDb {
  executeSync(sql: string, params?: unknown[]): unknown;
}

export type PreparationItemReason = 'athlete_choice' | 'discomfort' | 'restricted_at_execution' | 'no_time';

export interface PreparationItemRecord {
  readonly index: number;
  readonly itemId: string;
  readonly movementId: number | null;
  readonly status: PreparationItemStatus;
  readonly performedAmount: number | null;
  readonly performedLoadKg: number | null;
  readonly substitutionText: string | null;
  readonly reasonCode: PreparationItemReason | null;
  /** Performed well beyond the prescribed dose: shown as work, not warm-up. */
  readonly extraWork: boolean;
}

export interface ActivePreparation {
  readonly sessionId: number;
  readonly instanceId: string;
  readonly revision: number;
  readonly status: PreparationStatus;
  /** Null when the frozen protocol cannot be read by this build. The athlete
   *  can still record an honest outcome; nothing is guessed in its place. */
  readonly protocol: PreparationProtocol | null;
  readonly items: readonly PreparationItemRecord[];
  readonly finishedAtMs: number | null;
}

const rowsOf = <T>(result: unknown): T[] => {
  const rows = (result as { rows?: unknown }).rows;
  if (Array.isArray(rows)) return rows as T[];
  const nested = (rows as { _array?: unknown } | undefined)?._array;
  return Array.isArray(nested) ? (nested as T[]) : [];
};

const changes = (db: PreparationDb): number =>
  Number(rowsOf<{ c: number }>(db.executeSync('SELECT changes() AS c'))[0]?.c ?? 0);

/** Remove any preparation rows carrying this session id. Run before an insert
 * and after a session delete: with foreign keys off (recovery and test
 * connections) the cascade does not fire, and a surviving row would sit under
 * an id the next session is about to reuse. Children first. */
export function deleteSessionPreparation(db: PreparationDb, sessionId: number): void {
  db.executeSync('DELETE FROM session_preparation_item WHERE session_id = ?', [sessionId]);
  db.executeSync('DELETE FROM session_preparation WHERE session_id = ?', [sessionId]);
}

/** Training-data reset: every preparation record goes with the sessions. */
export function deleteAllSessionPreparation(db: PreparationDb): void {
  db.executeSync('DELETE FROM session_preparation_item');
  db.executeSync('DELETE FROM session_preparation');
}

/** Freeze a protocol for a session that was just inserted in this transaction. */
export function insertSessionPreparation(db: PreparationDb, input: {
  readonly sessionId: number;
  readonly startedAtMs: number;
  readonly instanceId: string;
  readonly protocol: PreparationProtocol;
}): ActivePreparation {
  const { sessionId, startedAtMs, instanceId, protocol } = input;
  deleteSessionPreparation(db, sessionId);
  db.executeSync(
    `INSERT INTO session_preparation
       (session_id, instance_id, session_started_at_ms, policy_id, policy_revision, protocol_version,
        protocol_json, item_count, estimate_low_seconds, estimate_high_seconds, status, revision,
        created_at_ms, updated_at_ms, finished_at_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1, ?, ?, NULL)`,
    [
      sessionId, instanceId, startedAtMs, protocol.policyId, protocol.policyRevision,
      PREPARATION_PROTOCOL_VERSION, JSON.stringify(protocol), protocol.items.length,
      protocol.estimateSeconds.low, protocol.estimateSeconds.high, startedAtMs, startedAtMs,
    ],
  );
  protocol.items.forEach((item, index) => {
    db.executeSync(
      `INSERT INTO session_preparation_item
         (session_id, item_index, item_id, item_revision, movement_id, prescribed_kind,
          prescribed_amount, per_side, status, updated_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        sessionId, index, item.itemId, item.itemRevision, item.movementId, item.dose.kind,
        prescribedAmount(item.dose), item.dose.kind === 'ramp' ? 0 : item.dose.perSide ? 1 : 0,
        startedAtMs,
      ],
    );
  });
  return {
    sessionId,
    instanceId,
    revision: 1,
    status: 'pending',
    protocol,
    items: protocol.items.map((item, index) => ({
      index, itemId: item.itemId, movementId: item.movementId, status: 'pending',
      performedAmount: null, performedLoadKg: null, substitutionText: null, reasonCode: null, extraWork: false,
    })),
    finishedAtMs: null,
  };
}

interface PreparationRow {
  session_id: number; instance_id: string; protocol_json: string; status: string;
  revision: number; finished_at_ms: number | null;
}
interface PreparationItemRow {
  item_index: number; item_id: string; movement_id: number | null; status: string;
  performed_amount: number | null; performed_load_kg: number | null;
  substitution_text: string | null; reason_code: string | null; extra_work: number;
}

/**
 * Read the protocol that belongs to THIS session: the row must carry the
 * session's own start time. A row left behind by an earlier session with the
 * same id does not match and reads as "no preparation recorded".
 */
export function readSessionPreparation(db: PreparationDb, sessionId: number): ActivePreparation | null {
  const row = rowsOf<PreparationRow>(db.executeSync(
    `SELECT p.session_id, p.instance_id, p.protocol_json, p.status, p.revision, p.finished_at_ms
       FROM session_preparation p
       JOIN session s ON s.session_id = p.session_id AND s.started_at_ms = p.session_started_at_ms
      WHERE p.session_id = ?`,
    [sessionId],
  ))[0];
  if (row === undefined) return null;
  let protocol: PreparationProtocol | null;
  try { protocol = parsePreparationProtocol(row.protocol_json); } catch { protocol = null; }
  const items = rowsOf<PreparationItemRow>(db.executeSync(
    `SELECT item_index, item_id, movement_id, status, performed_amount, performed_load_kg,
            substitution_text, reason_code, extra_work
       FROM session_preparation_item WHERE session_id = ? ORDER BY item_index`,
    [sessionId],
  ));
  return {
    sessionId: row.session_id,
    instanceId: row.instance_id,
    revision: row.revision,
    status: row.status as PreparationStatus,
    protocol,
    items: items.map((item) => ({
      index: item.item_index,
      itemId: item.item_id,
      movementId: item.movement_id,
      status: item.status as PreparationItemStatus,
      performedAmount: item.performed_amount,
      performedLoadKg: item.performed_load_kg,
      substitutionText: item.substitution_text,
      reasonCode: item.reason_code as PreparationItemReason | null,
      extraWork: item.extra_work === 1,
    })),
    finishedAtMs: row.finished_at_ms,
  };
}

/** True while this session has a preparation protocol with no outcome yet.
 * The store refuses main-work sets while this holds. */
export function preparationOpenForSession(db: PreparationDb, sessionId: number): boolean {
  return rowsOf<{ ok: number }>(db.executeSync(
    `SELECT 1 AS ok FROM session_preparation p
       JOIN session s ON s.session_id = p.session_id AND s.started_at_ms = p.session_started_at_ms
      WHERE p.session_id = ? AND p.status IN ('pending','in_progress')`,
    [sessionId],
  )).length > 0;
}

/**
 * Compare-and-set the protocol header. Returns false — and writes nothing —
 * when the caller's (instance, revision) is not the row's current one or the
 * row is no longer bound to its session: a duplicate tap, a stale screen, or
 * a different session under a reused id.
 */
function advancePreparation(
  db: PreparationDb,
  identity: { readonly sessionId: number; readonly instanceId: string },
  expectedRevision: number,
  status: PreparationStatus,
  nowMs: number,
): boolean {
  db.executeSync(
    `UPDATE session_preparation
        SET status = ?, revision = revision + 1,
            updated_at_ms = MAX(?, created_at_ms),
            finished_at_ms = CASE WHEN ? = 1 THEN MAX(?, created_at_ms) ELSE NULL END
      WHERE session_id = ? AND instance_id = ? AND revision = ?
        AND status IN ('pending','in_progress')
        AND session_started_at_ms = (SELECT started_at_ms FROM session WHERE session_id = ?)`,
    [
      status, nowMs, isTerminalPreparationStatus(status) ? 1 : 0, nowMs,
      identity.sessionId, identity.instanceId, expectedRevision, identity.sessionId,
    ],
  );
  return changes(db) === 1;
}

/** pending -> in_progress. */
export function beginSessionPreparation(
  db: PreparationDb, preparation: ActivePreparation, expectedRevision: number, nowMs: number,
): boolean {
  if (preparation.status !== 'pending') return false;
  return advancePreparation(db, preparation, expectedRevision, 'in_progress', nowMs);
}

/** True when (instance, revision) is still the open, session-bound row. */
function preparationIsCurrent(
  db: PreparationDb,
  identity: { readonly sessionId: number; readonly instanceId: string },
  expectedRevision: number,
): boolean {
  return rowsOf<{ ok: number }>(db.executeSync(
    `SELECT 1 AS ok FROM session_preparation p
       JOIN session s ON s.session_id = p.session_id AND s.started_at_ms = p.session_started_at_ms
      WHERE p.session_id = ? AND p.instance_id = ? AND p.revision = ?
        AND p.status IN ('pending','in_progress')`,
    [identity.sessionId, identity.instanceId, expectedRevision],
  )).length > 0;
}

/**
 * Record the protocol's outcome. Final: a later call writes nothing.
 *
 * `closeUnrecordedItems` marks every item the athlete never recorded as
 * skipped by their own choice, so the item list says what happened instead of
 * leaving "pending" rows under a finished protocol. It is used for the
 * outcomes the athlete reaches by working through the list (completed,
 * modified, skipped); "already warm" and "stopped" leave unrecorded items as
 * they are, because nothing is known about them.
 */
export function finishSessionPreparation(
  db: PreparationDb,
  preparation: ActivePreparation,
  expectedRevision: number,
  outcome: 'completed' | 'modified' | 'already_warm' | 'skipped' | 'stopped',
  nowMs: number,
  closeUnrecordedItems = false,
): boolean {
  if (isTerminalPreparationStatus(preparation.status)) return false;
  // Checked first so a stale or duplicate call changes no item row either.
  if (!preparationIsCurrent(db, preparation, expectedRevision)) return false;
  if (closeUnrecordedItems) {
    db.executeSync(
      `UPDATE session_preparation_item
          SET status = 'skipped', reason_code = 'athlete_choice', updated_at_ms = ?
        WHERE session_id = ? AND status = 'pending'`,
      [nowMs, preparation.sessionId],
    );
  }
  if (!advancePreparation(db, preparation, expectedRevision, outcome, nowMs)) {
    throw new Error('Preparation outcome could not be recorded.');
  }
  return true;
}

/**
 * A halt or session finish closes an open protocol as "stopped". It does not
 * depend on in-memory state: whatever protocol is bound to the live session
 * and still open is closed, exactly once.
 */
export function stopOpenSessionPreparation(db: PreparationDb, sessionId: number, nowMs: number): boolean {
  db.executeSync(
    `UPDATE session_preparation
        SET status = 'stopped', revision = revision + 1,
            updated_at_ms = MAX(?, created_at_ms), finished_at_ms = MAX(?, created_at_ms)
      WHERE session_id = ? AND status IN ('pending','in_progress')
        AND session_started_at_ms = (SELECT started_at_ms FROM session WHERE session_id = ?)`,
    [nowMs, nowMs, sessionId, sessionId],
  );
  return changes(db) === 1;
}

export interface PreparationItemWrite {
  readonly status: Exclude<PreparationItemStatus, 'pending'>;
  /** Seconds or repetitions actually performed (per side where the item is per side). */
  readonly performedAmount?: number | null;
  readonly performedLoadKg?: number | null;
  readonly substitutionText?: string | null;
  readonly reasonCode?: PreparationItemReason | null;
}

/**
 * Record what happened for one item and advance the protocol revision in the
 * same statement pair. Returns false and writes nothing when the write is
 * stale, the item is already recorded, or the input cannot be stored
 * truthfully (for example "done" with an amount that is not the prescribed one).
 */
export function recordSessionPreparationItem(
  db: PreparationDb,
  preparation: ActivePreparation,
  expectedRevision: number,
  itemIndex: number,
  write: PreparationItemWrite,
  nowMs: number,
): boolean {
  if (isTerminalPreparationStatus(preparation.status)) return false;
  const record = preparation.items.find((item) => item.index === itemIndex);
  const item = preparation.protocol?.items[itemIndex];
  if (record === undefined || record.status !== 'pending') return false;
  const row = rowsOf<{ prescribed_amount: number }>(db.executeSync(
    'SELECT prescribed_amount FROM session_preparation_item WHERE session_id = ? AND item_index = ?',
    [preparation.sessionId, itemIndex],
  ))[0];
  if (row === undefined) return false;
  const prescribed = row.prescribed_amount;

  const amount = write.performedAmount === undefined || write.performedAmount === null
    ? null
    : Math.round(Math.min(3600, Math.max(0, write.performedAmount)));
  const loadKg = write.performedLoadKg === undefined || write.performedLoadKg === null
    || !Number.isFinite(write.performedLoadKg)
    ? null
    : Math.min(500, Math.max(0, write.performedLoadKg));
  const substitution = write.substitutionText === undefined || write.substitutionText === null
    ? null
    : write.substitutionText.trim().slice(0, 200);

  let status = write.status;
  let performedAmount: number | null = null;
  let performedLoadKg: number | null = null;
  let substitutionText: string | null = null;
  let reasonCode: PreparationItemReason | null = write.reasonCode ?? null;
  switch (write.status) {
    case 'done':
      performedAmount = prescribed;
      performedLoadKg = loadKg;
      reasonCode = null;
      break;
    case 'modified':
      if (amount === null) return false;
      // The same amount as prescribed is "done", whatever the caller called it.
      if (amount === prescribed) { status = 'done'; reasonCode = null; }
      performedAmount = amount;
      performedLoadKg = loadKg;
      break;
    case 'substituted':
      if (substitution === null || substitution.length === 0) return false;
      substitutionText = substitution;
      performedAmount = amount;
      performedLoadKg = loadKg;
      break;
    case 'skipped':
    case 'withheld':
      reasonCode = reasonCode ?? (write.status === 'withheld' ? 'restricted_at_execution' : 'athlete_choice');
      break;
  }
  const extraWork = item !== undefined && (status === 'modified' || status === 'substituted')
    && isExtraPreparationWork(item.dose, performedAmount) ? 1 : 0;

  const nextStatus: PreparationStatus = 'in_progress';
  if (!advancePreparation(db, preparation, expectedRevision, nextStatus, nowMs)) return false;
  db.executeSync(
    `UPDATE session_preparation_item
        SET status = ?, performed_amount = ?, performed_load_kg = ?, substitution_text = ?,
            reason_code = ?, extra_work = ?, updated_at_ms = ?
      WHERE session_id = ? AND item_index = ? AND status = 'pending'`,
    [status, performedAmount, performedLoadKg, substitutionText, reasonCode, extraWork, nowMs,
      preparation.sessionId, itemIndex],
  );
  if (changes(db) !== 1) throw new Error('Preparation item could not be recorded.');
  return true;
}

export interface PreparationSummary {
  readonly status: PreparationStatus;
  readonly protocol: PreparationProtocol | null;
  readonly items: readonly PreparationItemRecord[];
  readonly extraWorkCount: number;
}

/** What was recorded for a session's preparation, or null when nothing was
 * (every session that predates 065, and every imported or demo session). */
export function readPreparationSummary(db: PreparationDb, sessionId: number): PreparationSummary | null {
  const preparation = readSessionPreparation(db, sessionId);
  if (preparation === null) return null;
  return {
    status: preparation.status,
    protocol: preparation.protocol,
    items: preparation.items,
    extraWorkCount: preparation.items.filter((item) => item.extraWork).length,
  };
}
