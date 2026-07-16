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
import m010 from './schema/010_movement_library.sql';
import m011 from './schema/011_niggle_tracking.sql';
import m012 from './schema/012_report_severity.sql';
import m013 from './schema/013_profile_slot.sql';
import m014 from './schema/014_movement_prefixes.sql';
import m015 from './schema/015_set_prefix.sql';
import m016 from './schema/016_movement_library_seed.sql';
import m017 from './schema/017_movement_batch.sql';
import m018 from './schema/018_logging_modes.sql';
import m019 from './schema/019_movement_batch.sql';
import m020 from './schema/020_movement_batch.sql';
import m021 from './schema/021_taxonomy_corrections.sql';
import m022 from './schema/022_set_target.sql';
import m023 from './schema/023_phase17_session_foundation.sql';
import m024 from './schema/024_phase17_equipment_fixes.sql';

/** Ordered, append-only, and IDEMPOTENT by contract (IF NOT EXISTS /
 *  DROP+CREATE) — the self-heal path re-applies all of them. Never edit a
 *  shipped entry — add a new one. */
const MIGRATIONS: readonly string[] = [m001, m002, m003, m005, m006, m007, m008, m009, m010, m011, m012, m013, m014, m015, m016, m017, m018, m019, m020, m021, m022, m023, m024];

export function migrate(db: DB): void {
  runMigrations(db, MIGRATIONS);
}
