/**
 * migrationRunner.ts — synchronous, fail-fast, self-healing migration runner.
 *
 * History (on-device, 2026-06-11): the first runner used op-sqlite's async
 * `db.transaction()` WITHOUT awaiting it, so boot continued while migrations
 * were still queued — the post-migration materialize raced ahead ("no such
 * table: state_vector" / "no such function: ln" depending on timing), and a
 * failed middle migration could be skipped forever because later migrations
 * still advanced user_version. This runner:
 *   1. is fully synchronous (executeSync BEGIN/COMMIT/ROLLBACK) — when it
 *      returns, the schema IS the declared schema, no async tail;
 *   2. fails fast — the first failed migration rolls back, rethrows, and
 *      leaves user_version pointing at itself for the next attempt;
 *   3. self-heals — every migration is idempotent (IF NOT EXISTS /
 *      DROP+CREATE), so if sentinel objects are missing while user_version
 *      claims completion (field DBs poisoned by the old bug), everything is
 *      re-applied from zero.
 *
 * Pure with respect to its inputs (SQL strings + minimal db surface), so the
 * verify:migrations gate runs this EXACT code against node:sqlite.
 */

export interface MigrationDb {
  executeSync(sql: string): { rows: Record<string, unknown>[] };
}

interface MigrationSentinel {
  readonly type: string;
  readonly name: string;
  /** A durable-row invariant can be stronger than sqlite_master presence. */
  readonly presenceSql?: string;
  /** Applied before a full replay when lost provenance must fail closed. */
  readonly failClosedRepairSql?: string;
}

const ROUTINE_CONTRACT_CUTOFF_FAIL_CLOSED_SQL = `
  CREATE TABLE IF NOT EXISTS routine_template_contract_cutoff (
    cutoff_template_id INTEGER NOT NULL CHECK (cutoff_template_id >= 0),
    capture_epoch       INTEGER PRIMARY KEY CHECK (capture_epoch = 1)
  ) STRICT, WITHOUT ROWID;
  DROP TRIGGER IF EXISTS trg_routine_template_contract_cutoff_bu;
  DROP TRIGGER IF EXISTS trg_routine_template_contract_cutoff_bd;
  UPDATE routine_template_contract_cutoff
    SET cutoff_template_id = 0 WHERE capture_epoch = 1;
  INSERT OR IGNORE INTO routine_template_contract_cutoff
    (cutoff_template_id, capture_epoch) VALUES (0, 1);`;

/** Objects or durable rows whose absence proves the schema is incomplete
 *  regardless of what user_version claims. */
export const SENTINELS: readonly MigrationSentinel[] = [
  { type: 'table', name: 'set_record' },          // 001
  { type: 'table', name: 'hrv_daily' },           // 002
  { type: 'table', name: 'state_vector' },        // 003
  { type: 'view', name: 'v_readiness_inputs' },   // 003
  { type: 'table', name: 'subjective_report' },   // 005
  // 006's user_profile is intentionally NOT a sentinel: 007 supersedes it
  // (drops it after copying into athlete_profile).
  { type: 'table', name: 'athlete_profile' },     // 007
  { type: 'table', name: 'training_block' },      // 007
  { type: 'table', name: 'movement_taxonomy' },   // 008
  { type: 'table', name: 'one_rep_max' },         // 009
  { type: 'table', name: 'block_meta' },          // 009
  { type: 'table', name: 'movement_detail' },     // 010
  { type: 'table', name: 'movement_preference' }, // 010
  { type: 'table', name: 'niggle' },              // 011
  { type: 'table', name: 'report_severity' },     // 012
  { type: 'table', name: 'profile_slot' },        // 013
  { type: 'table', name: 'movement_prefix' },     // 014
  { type: 'table', name: 'set_prefix' },          // 015
  { type: 'table', name: 'movement_progression' },       // 016
  { type: 'table', name: 'movement_beginner_whitelist' }, // 016
  { type: 'table', name: 'set_metric' },                  // 018
  { type: 'table', name: 'movement_logging_mode' },       // 018
  { type: 'table', name: 'band_ladder' },                 // 018
  { type: 'table', name: 'progression_policy' },          // 018
  { type: 'table', name: 'set_target' },                  // 022
  { type: 'table', name: 'session_origin' },              // 022
  { type: 'table', name: 'session_plan_slot' },           // 022
  { type: 'table', name: 'planned_slot_disposition' },    // 022
  { type: 'table', name: 'movement_coaching_intent' },    // 023
  { type: 'table', name: 'movement_time_policy' },        // 023
  { type: 'table', name: 'planned_slot_target' },         // 023
  { type: 'table', name: 'session_slot_target' },         // 023
  { type: 'table', name: 'profile_ui_preference' },       // 023
  { type: 'table', name: 'session_runner_checkpoint' },   // 023
  { type: 'table', name: 'set_dose_target' },             // 026
  { type: 'table', name: 'session_outcome' },             // 026
  { type: 'trigger', name: 'trg_set_dose_target_bi' },    // 026
  { type: 'trigger', name: 'trg_set_dose_target_bu' },    // 026
  { type: 'trigger', name: 'trg_set_dose_target_bd' },    // 026
  { type: 'trigger', name: 'trg_session_outcome_bi' },    // 026
  { type: 'trigger', name: 'trg_session_outcome_bu' },    // 026
  { type: 'trigger', name: 'trg_session_outcome_bd' },    // 026
  { type: 'trigger', name: 'trg_session_date_guard_bu' }, // 027
  { type: 'table', name: 'movement_role_eligibility' }, // 028
  { type: 'table', name: 'movement_capability_edge' },  // 028
  { type: 'table', name: 'capability_session_evidence' }, // 028
  { type: 'table', name: 'routine_template' },          // 029
  { type: 'table', name: 'history_import' },            // 029
  { type: 'table', name: 'bodyweight_daily' },          // 029
  { type: 'view', name: 'v_training_daily_all' },       // 029
  { type: 'table', name: 'import_readiness_daily' },     // 029
  { type: 'view', name: 'v_readiness_inputs' },          // 030
  { type: 'table', name: 'planned_session_method' },     // 031
  { type: 'table', name: 'training_program' },          // 033
  { type: 'table', name: 'training_program_day' },      // 033
  { type: 'table', name: 'training_program_movement_preference' }, // 033
  { type: 'table', name: 'training_block_program' },    // 033
  { type: 'table', name: 'planned_slot_autopilot' },     // 034
  { type: 'table', name: 'profile_load_preference' },    // 035
  { type: 'table', name: 'movement_media' },             // 036
  { type: 'table', name: 'movement_scope' },             // 049
  { type: 'table', name: 'movement_content_correction' }, // 049
  { type: 'table', name: 'movement_prior_experience' },       // 051
  { type: 'table', name: 'movement_sport_tracking' },         // 051
  { type: 'table', name: 'movement_lift_family' },             // 052
  { type: 'table', name: 'movement_assistance_relationship' }, // 052
  { type: 'table', name: 'planned_session_routine_context' },  // 052
  { type: 'table', name: 'planned_slot_routine_decision' },    // 052
  { type: 'table', name: 'routine_template_legacy_role_allowance' }, // 053
  { type: 'table', name: 'planned_slot_legacy_role_allowance' },     // 053
  {
    type: 'row',
    name: 'routine_template_contract_cutoff',                         // 054
    presenceSql: `SELECT 1 AS ok
      FROM routine_template_contract_cutoff
      WHERE capture_epoch = 1`,
    // If the cutoff table or singleton row is lost after 054 has applied, its
    // original value cannot be reconstructed safely. Persist zero BEFORE the
    // full-chain replay so 053 cannot grandfather any current template and so
    // a failure in an earlier replayed migration cannot later recapture MAX(id).
    failClosedRepairSql: ROUTINE_CONTRACT_CUTOFF_FAIL_CLOSED_SQL,
  },
  {
    type: 'trigger',
    name: 'trg_routine_template_contract_cutoff_bu',                 // 054
    failClosedRepairSql: ROUTINE_CONTRACT_CUTOFF_FAIL_CLOSED_SQL,
  },
  {
    type: 'trigger',
    name: 'trg_routine_template_contract_cutoff_bd',                 // 054
    failClosedRepairSql: ROUTINE_CONTRACT_CUTOFF_FAIL_CLOSED_SQL,
  },
  { type: 'table', name: 'return_checkin_ack' },                      // 055
];

function userVersion(db: MigrationDb): number {
  return Number(db.executeSync('PRAGMA user_version;').rows[0]?.user_version ?? 0);
}

function applyFrom(db: MigrationDb, migrations: readonly string[], start: number): void {
  for (let v = start; v < migrations.length; v++) {
    db.executeSync('BEGIN');
    try {
      db.executeSync(migrations[v]);
      db.executeSync(`PRAGMA user_version = ${v + 1};`);
      db.executeSync('COMMIT');
    } catch (e) {
      try {
        db.executeSync('ROLLBACK');
      } catch {
        /* connection-level failure; nothing left to roll back */
      }
      throw e; // fail fast: user_version still points at this migration
    }
  }
}

export function sentinelsMissing(db: MigrationDb): string[] {
  return SENTINELS.filter((sentinel) => {
    try {
      const sql = sentinel.presenceSql
        ?? `SELECT 1 AS ok FROM sqlite_master WHERE type = '${sentinel.type}' AND name = '${sentinel.name}'`;
      return db.executeSync(sql).rows.length === 0;
    } catch {
      return true;
    }
  }).map((sentinel) => sentinel.name);
}

function applyFailClosedRepairs(db: MigrationDb, missing: readonly string[]): void {
  const repairs = [...new Set(SENTINELS
    .filter((sentinel) => missing.includes(sentinel.name))
    .map((sentinel) => sentinel.failClosedRepairSql)
    .filter((sql): sql is string => sql !== undefined))];
  if (repairs.length === 0) return;

  db.executeSync('BEGIN');
  try {
    for (const repairSql of repairs) db.executeSync(repairSql);
    db.executeSync('COMMIT');
  } catch (error) {
    try {
      db.executeSync('ROLLBACK');
    } catch {
      /* connection-level failure; nothing left to roll back */
    }
    throw error;
  }
}

export function runMigrations(db: MigrationDb, migrations: readonly string[]): void {
  applyFrom(db, migrations, userVersion(db));
  const missing = sentinelsMissing(db);
  if (missing.length > 0) {
    // user_version lied (poisoned field DB) — re-apply everything; all
    // migrations are idempotent by contract. Any irrecoverable provenance is
    // first persisted in its conservative state so replay can never widen it.
    applyFailClosedRepairs(db, missing);
    db.executeSync('PRAGMA user_version = 0;');
    applyFrom(db, migrations, 0);
    const still = sentinelsMissing(db);
    if (still.length > 0) {
      throw new Error(`schema incomplete after full re-apply: missing ${still.join(', ')}`);
    }
  }
}
