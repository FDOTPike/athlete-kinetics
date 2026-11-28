/**
 * warmupPresetStore.ts — the SQL boundary for personalised warm-up presets (083).
 *
 * Every function runs synchronously INSIDE the caller's transaction; none of
 * them opens, commits, or rolls back one. The zustand store owns transaction
 * scope.
 */
import {
  isPrehabTargetId,
  isWarmupPurpose,
  isWarmupSessionType,
  isWarmupWeaknessTarget,
  validateWarmupPresetDraft,
  type WarmupDoseKind,
  type WarmupItemSourceKind,
  type WarmupPreset,
  type WarmupPresetDraft,
  type WarmupPresetItem,
  type WarmupSessionOverride,
  type WarmupSessionType,
} from '@ak/inference';
import type { PreparationDb } from './preparationStore';

const rowsOf = <T>(result: unknown): T[] => {
  const rows = (result as { rows?: unknown }).rows;
  if (Array.isArray(rows)) return rows as T[];
  const nested = (rows as { _array?: unknown } | undefined)?._array;
  return Array.isArray(nested) ? (nested as T[]) : [];
};

interface WarmupPresetRow {
  preset_id: number;
  name: string;
  purpose: string;
  weakness_target: string | null;
  include_ramp_sets: number;
  created_at_ms: number;
  updated_at_ms: number;
}

interface WarmupPresetItemRow {
  preset_id: number;
  item_order: number;
  source_kind: string;
  catalog_drill_id: string | null;
  prehab_target_id: string | null;
  movement_id: number | null;
  title: string;
  sets: number;
  dose_kind: string;
  dose_amount: number;
  per_side: number;
  cue_note: string | null;
}

function mapPresetItemRow(row: WarmupPresetItemRow): WarmupPresetItem {
  return {
    itemOrder: row.item_order,
    sourceKind: row.source_kind as WarmupItemSourceKind,
    catalogDrillId: row.catalog_drill_id,
    prehabTargetId: isPrehabTargetId(row.prehab_target_id) ? row.prehab_target_id : null,
    movementId: row.movement_id,
    title: row.title,
    sets: row.sets,
    doseKind: row.dose_kind as WarmupDoseKind,
    doseAmount: row.dose_amount,
    perSide: row.per_side === 1,
    cueNote: row.cue_note,
  };
}

export function readWarmupPresets(db: PreparationDb): WarmupPreset[] {
  const presetRows = rowsOf<WarmupPresetRow>(db.executeSync(
    `SELECT preset_id, name, purpose, weakness_target, include_ramp_sets, created_at_ms, updated_at_ms
       FROM warmup_preset
      ORDER BY preset_id ASC`,
  ));
  if (presetRows.length === 0) return [];
  const itemRows = rowsOf<WarmupPresetItemRow>(db.executeSync(
    `SELECT preset_id, item_order, source_kind, catalog_drill_id, prehab_target_id, movement_id,
            title, sets, dose_kind, dose_amount, per_side, cue_note
       FROM warmup_preset_item
      ORDER BY preset_id ASC, item_order ASC`,
  ));
  const itemsByPreset = new Map<number, WarmupPresetItem[]>();
  for (const row of itemRows) {
    const list = itemsByPreset.get(row.preset_id) ?? [];
    list.push(mapPresetItemRow(row));
    itemsByPreset.set(row.preset_id, list);
  }
  return presetRows.map((row) => ({
    presetId: row.preset_id,
    name: row.name,
    purpose: isWarmupPurpose(row.purpose) ? row.purpose : 'gpp',
    weaknessTarget: isWarmupWeaknessTarget(row.weakness_target) ? row.weakness_target : null,
    includeRampSets: row.include_ramp_sets === 1,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
    items: itemsByPreset.get(row.preset_id) ?? [],
  }));
}

export function saveWarmupPreset(
  db: PreparationDb,
  input: {
    readonly presetId: number | null;
    readonly draft: WarmupPresetDraft;
    readonly nowMs: number;
  },
): { readonly ok: true; readonly preset: WarmupPreset } | { readonly ok: false; readonly error: string } {
  const existingCount = Number(
    rowsOf<{ c: number }>(db.executeSync('SELECT count(*) AS c FROM warmup_preset'))[0]?.c ?? 0,
  );
  const isUpdate = input.presetId !== null;
  let existingCreatedAtMs: number | null = null;
  if (isUpdate) {
    const existingRow = rowsOf<{ preset_id: number; created_at_ms: number }>(db.executeSync(
      'SELECT preset_id, created_at_ms FROM warmup_preset WHERE preset_id = ?',
      [input.presetId],
    ))[0];
    if (existingRow === undefined) {
      return { ok: false, error: 'Warm-up preset not found.' };
    }
    existingCreatedAtMs = existingRow.created_at_ms;
  }

  const validation = validateWarmupPresetDraft(input.draft, existingCount, isUpdate);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }
  const clean = validation.value;

  let savedPresetId: number;
  if (input.presetId === null) {
    db.executeSync(
      `INSERT INTO warmup_preset
         (name, purpose, weakness_target, include_ramp_sets, created_at_ms, updated_at_ms)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        clean.name,
        clean.purpose,
        clean.weaknessTarget,
        clean.includeRampSets ? 1 : 0,
        input.nowMs,
        input.nowMs,
      ],
    );
    savedPresetId = Number(
      rowsOf<{ id: number }>(db.executeSync('SELECT last_insert_rowid() AS id'))[0]!.id,
    );
  } else {
    savedPresetId = input.presetId;
    const safeUpdatedAtMs = Math.max(input.nowMs, existingCreatedAtMs ?? input.nowMs);
    db.executeSync(
      `UPDATE warmup_preset
          SET name = ?, purpose = ?, weakness_target = ?, include_ramp_sets = ?, updated_at_ms = ?
        WHERE preset_id = ?`,
      [
        clean.name,
        clean.purpose,
        clean.weaknessTarget,
        clean.includeRampSets ? 1 : 0,
        safeUpdatedAtMs,
        savedPresetId,
      ],
    );
    db.executeSync('DELETE FROM warmup_preset_item WHERE preset_id = ?', [savedPresetId]);
  }

  for (let index = 0; index < clean.items.length; index += 1) {
    const item = clean.items[index]!;
    db.executeSync(
      `INSERT INTO warmup_preset_item
         (preset_id, item_order, source_kind, catalog_drill_id, prehab_target_id, movement_id,
          title, sets, dose_kind, dose_amount, per_side, cue_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        savedPresetId,
        index,
        item.sourceKind,
        item.catalogDrillId,
        item.prehabTargetId,
        item.movementId,
        item.title,
        item.sets,
        item.doseKind,
        item.doseAmount,
        item.perSide ? 1 : 0,
        item.cueNote,
      ],
    );
  }

  const saved = readWarmupPresets(db).find((preset) => preset.presetId === savedPresetId);
  if (saved === undefined) {
    return { ok: false, error: 'Warm-up preset could not be read after saving.' };
  }
  return { ok: true, preset: saved };
}

/** Delete child rows explicitly before the parent so deletion works identically
 *  even when PRAGMA foreign_keys is off in test or recovery connections. */
export function deleteWarmupPreset(db: PreparationDb, presetId: number): void {
  db.executeSync('DELETE FROM planned_session_warmup_override WHERE preset_id = ?', [presetId]);
  db.executeSync('DELETE FROM warmup_session_type_assignment WHERE preset_id = ?', [presetId]);
  db.executeSync('DELETE FROM warmup_preset_item WHERE preset_id = ?', [presetId]);
  db.executeSync('DELETE FROM warmup_preset WHERE preset_id = ?', [presetId]);
}

export function readWarmupSessionTypeAssignments(
  db: PreparationDb,
): Partial<Record<WarmupSessionType, number>> {
  const rows = rowsOf<{ session_type: string; preset_id: number }>(db.executeSync(
    'SELECT session_type, preset_id FROM warmup_session_type_assignment ORDER BY session_type ASC',
  ));
  const result: Partial<Record<WarmupSessionType, number>> = {};
  for (const row of rows) {
    if (isWarmupSessionType(row.session_type)) {
      result[row.session_type] = row.preset_id;
    }
  }
  return result;
}

export function setWarmupSessionTypeAssignment(
  db: PreparationDb,
  sessionType: WarmupSessionType,
  presetId: number | null,
  nowMs: number,
): void {
  if (presetId === null) {
    db.executeSync('DELETE FROM warmup_session_type_assignment WHERE session_type = ?', [sessionType]);
    return;
  }
  db.executeSync(
    `INSERT INTO warmup_session_type_assignment (session_type, preset_id, updated_at_ms)
     VALUES (?, ?, ?)
     ON CONFLICT(session_type) DO UPDATE SET
       preset_id = excluded.preset_id,
       updated_at_ms = excluded.updated_at_ms`,
    [sessionType, presetId, nowMs],
  );
}

export function readPlannedSessionWarmupOverrides(
  db: PreparationDb,
): Record<number, WarmupSessionOverride> {
  const rows = rowsOf<{ planned_session_id: number; mode: string; preset_id: number | null }>(db.executeSync(
    'SELECT planned_session_id, mode, preset_id FROM planned_session_warmup_override ORDER BY planned_session_id ASC',
  ));
  const result: Record<number, WarmupSessionOverride> = {};
  for (const row of rows) {
    if (row.mode === 'preset' && row.preset_id !== null) {
      result[row.planned_session_id] = { mode: 'preset', presetId: row.preset_id };
    } else if (row.mode === 'standard_auto' && row.preset_id === null) {
      result[row.planned_session_id] = { mode: 'standard_auto', presetId: null };
    }
  }
  return result;
}

export function setPlannedSessionWarmupOverride(
  db: PreparationDb,
  plannedSessionId: number,
  override: WarmupSessionOverride | null,
  nowMs: number,
): void {
  if (override === null) {
    db.executeSync('DELETE FROM planned_session_warmup_override WHERE planned_session_id = ?', [plannedSessionId]);
    return;
  }
  db.executeSync(
    `INSERT INTO planned_session_warmup_override (planned_session_id, mode, preset_id, updated_at_ms)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(planned_session_id) DO UPDATE SET
       mode = excluded.mode,
       preset_id = excluded.preset_id,
       updated_at_ms = excluded.updated_at_ms`,
    [plannedSessionId, override.mode, override.presetId, nowMs],
  );
}
