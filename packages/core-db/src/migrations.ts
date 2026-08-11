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
import m025 from './schema/025_movement_coaching_content.sql';
import m026 from './schema/026_phase18_session_outcome.sql';
import m027 from './schema/027_operational_safeguards.sql';
import m028 from './schema/028_capability_graph.sql';
import m029 from './schema/029_routine_history_analytics.sql';
import m030 from './schema/030_readiness_import_integration.sql';
import m031 from './schema/031_planned_session_method.sql';
import m032 from './schema/032_capability_content.sql';
import m033 from './schema/033_goal_program.sql';
import m034 from './schema/034_autopilot_attribution.sql';
import m035 from './schema/035_profile_load_preference.sql';
import m036 from './schema/036_movement_media.sql';
import m037 from './schema/037_movement_library_v2_batch.sql';
import m038 from './schema/038_movement_library_v2_batch.sql';
import m039 from './schema/039_movement_library_v2_batch.sql';
import m040 from './schema/040_movement_library_v2_batch.sql';
import m041 from './schema/041_movement_library_v2_batch.sql';
import m042 from './schema/042_movement_library_v2_batch.sql';
import m043 from './schema/043_movement_library_v2_batch.sql';
import m044 from './schema/044_movement_library_v2_batch.sql';
import m045 from './schema/045_movement_library_v2_batch.sql';
import m046 from './schema/046_movement_library_v2_batch.sql';
import m047 from './schema/047_movement_library_v2_batch.sql';
import m048 from './schema/048_movement_library_v2_batch.sql';
import m049 from './schema/049_movement_content_correction_v1.sql';

/** Ordered, append-only, and IDEMPOTENT by contract (IF NOT EXISTS /
 *  DROP+CREATE) — the self-heal path re-applies all of them. Never edit a
 *  shipped entry — add a new one. */
const MIGRATIONS: readonly string[] = [m001, m002, m003, m005, m006, m007, m008, m009, m010, m011, m012, m013, m014, m015, m016, m017, m018, m019, m020, m021, m022, m023, m024, m025, m026, m027, m028, m029, m030, m031, m032, m033, m034, m035, m036, m037, m038, m039, m040, m041, m042, m043, m044, m045, m046, m047, m048, m049];

export function migrate(db: DB): void {
  runMigrations(db, MIGRATIONS);
}
