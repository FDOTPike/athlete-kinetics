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

/** Objects whose absence proves the schema is incomplete regardless of
 *  what user_version claims. One per migration that creates core state. */
export const SENTINELS: readonly { type: string; name: string }[] = [
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
  return SENTINELS.filter(
    (s) =>
      db.executeSync(
        `SELECT 1 AS ok FROM sqlite_master WHERE type = '${s.type}' AND name = '${s.name}'`,
      ).rows.length === 0,
  ).map((s) => s.name);
}

export function runMigrations(db: MigrationDb, migrations: readonly string[]): void {
  applyFrom(db, migrations, userVersion(db));
  if (sentinelsMissing(db).length > 0) {
    // user_version lied (poisoned field DB) — re-apply everything; all
    // migrations are idempotent by contract.
    db.executeSync('PRAGMA user_version = 0;');
    applyFrom(db, migrations, 0);
    const still = sentinelsMissing(db);
    if (still.length > 0) {
      throw new Error(`schema incomplete after full re-apply: missing ${still.join(', ')}`);
    }
  }
}
