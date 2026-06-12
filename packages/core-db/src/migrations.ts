/**
 * migrations.ts — binds the bundled schema files to the runner.
 *
 * Schema files are bundled as raw strings (babel-plugin-inline-import for
 * `.sql`). 004 is intentionally NOT a migration — it is the parameterized
 * daily upsert executed by the DAO. The runner itself lives in
 * migrationRunner.ts (pure, node-verifiable: npm run verify:migrations).
 */
import { type DB } from '@op-engineering/op-sqlite';
import { runMigrations } from './migrationRunner';

import m001 from './schema/001_mechanical_input.sql';
import m002 from './schema/002_telemetry.sql';
import m003 from './schema/003_state_vector.sql';
import m005 from './schema/005_subjective_report.sql';
import m006 from './schema/006_user_profile.sql';
import m007 from './schema/007_program_engine.sql';
import m008 from './schema/008_taxonomy.sql';
import m009 from './schema/009_periodization.sql';

/** Ordered, append-only, and IDEMPOTENT by contract (IF NOT EXISTS /
 *  DROP+CREATE) — the self-heal path re-applies all of them. Never edit a
 *  shipped entry — add a new one. */
const MIGRATIONS: readonly string[] = [m001, m002, m003, m005, m006, m007, m008, m009];

export function migrate(db: DB): void {
  runMigrations(db, MIGRATIONS);
}
