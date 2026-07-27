import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  buildSchemaContext,
  validateCapabilityContent,
  renderCapabilityMigration,
} from './generate-capability-migration.mjs';

let checks = 0;
const check = (label, fn) => {
  checks += 1;
  fn();
  console.log(`  [${checks}] PASS ${label}`);
};

console.log('[test-capability-migration-generator]');

const ctx = buildSchemaContext();
const tplSql = readFileSync(join(import.meta.dirname, '..', 'packages', 'core-db', 'src', 'schema', '_chain_projection.sql.tpl'), 'utf-8');

check('accepts valid capability content fixture and generates expected SQL with projection template', () => {
  const validFixture = {
    roles: [
      { movementName: 'Push-up', role: 'supplementary' },
    ],
    families: [
      { movementName: 'Push-up', family: 'test-push-chain', isAnchor: false },
      { movementName: 'Chin-up', family: 'test-push-chain', isAnchor: true },
    ],
    edges: [
      {
        prerequisiteMovementName: 'Push-up',
        movementName: 'Chin-up',
        relationship: 'prerequisite',
        minSessions: 2,
        minSetsPerSession: 3,
        minValue: 10,
        valueKind: 'reps',
        maxRpe: 8.5,
        requiresAttestation: false,
      },
    ],
  };

  const { errors, validData } = validateCapabilityContent(validFixture, ctx);
  assert.deepEqual(errors, []);
  assert.ok(validData !== null);

  const sql = renderCapabilityMigration('032', validData, tplSql);
  assert.match(sql, /INSERT OR IGNORE INTO movement_role_eligibility/);
  assert.match(sql, /INSERT OR IGNORE INTO movement_capability_family/);
  assert.match(sql, /INSERT OR IGNORE INTO movement_capability_edge/);
  assert.match(sql, /ASSERTION_FAILED_movement_role_eligibility_row_count_mismatch/);
  assert.match(sql, /DELETE FROM movement_progression;/);
  assert.match(sql, /WITH RECURSIVE/);

  // Execute generated SQL against an in-memory DB copy to prove validity
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  try { db.prepare('SELECT ln(2.0), sqrt(2.0)').get(); } catch {
    db.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
    db.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
  }
  const files = ['001_mechanical_input.sql', '002_telemetry.sql', '003_state_vector.sql',
    '005_subjective_report.sql', '006_user_profile.sql', '007_program_engine.sql',
    '008_taxonomy.sql', '009_periodization.sql', '010_movement_library.sql',
    '011_niggle_tracking.sql', '012_report_severity.sql', '013_profile_slot.sql',
    '014_movement_prefixes.sql', '015_set_prefix.sql', '016_movement_library_seed.sql',
    '017_movement_batch.sql', '018_logging_modes.sql', '019_movement_batch.sql',
    '020_movement_batch.sql', '021_taxonomy_corrections.sql', '022_set_target.sql',
    '023_phase17_session_foundation.sql', '024_phase17_equipment_fixes.sql',
    '025_movement_coaching_content.sql', '026_phase18_session_outcome.sql',
    '027_operational_safeguards.sql', '028_capability_graph.sql', '029_routine_history_analytics.sql',
    '030_readiness_import_integration.sql', '031_planned_session_method.sql'];
  const schemaDir = join(import.meta.dirname, '..', 'packages', 'core-db', 'src', 'schema');
  for (const f of files) {
    db.exec(readFileSync(join(schemaDir, f), 'utf-8'));
  }

  // Execute the generated migration SQL
  assert.doesNotThrow(() => db.exec(sql));
});

check('rejects unknown movement names', () => {
  const fixture = {
    roles: [{ movementName: 'Nonexistent Imaginary Exercise', role: 'major' }],
  };
  const { errors } = validateCapabilityContent(fixture, ctx);
  assert.match(errors.join('\n'), /unknown movement "Nonexistent Imaginary Exercise"/);
});

check('rejects self-edges', () => {
  const fixture = {
    edges: [
      { prerequisiteMovementName: 'Push-up', movementName: 'Push-up', relationship: 'prerequisite' },
    ],
  };
  const { errors } = validateCapabilityContent(fixture, ctx);
  assert.match(errors.join('\n'), /self-edge detected/);
});

check('rejects duplicate edges', () => {
  const fixture = {
    edges: [
      { prerequisiteMovementName: 'Push-up', movementName: 'Chin-up', relationship: 'prerequisite' },
      { prerequisiteMovementName: 'Push-up', movementName: 'Chin-up', relationship: 'prerequisite' },
    ],
  };
  const { errors } = validateCapabilityContent(fixture, ctx);
  assert.match(errors.join('\n'), /duplicate edge/);
});

check('rejects out-of-domain threshold values', () => {
  const fixture1 = {
    edges: [{ prerequisiteMovementName: 'Push-up', movementName: 'Chin-up', minSessions: 0 }],
  };
  const res1 = validateCapabilityContent(fixture1, ctx);
  assert.match(res1.errors.join('\n'), /minSessions must be an integer between 1 and 100/);

  const fixture2 = {
    edges: [{ prerequisiteMovementName: 'Push-up', movementName: 'Chin-up', maxRpe: 11.5 }],
  };
  const res2 = validateCapabilityContent(fixture2, ctx);
  assert.match(res2.errors.join('\n'), /maxRpe must be between 5\.0 and 10\.0/);
});

check('rejects branching ambiguity within same-family prerequisite edges', () => {
  const fixture = {
    families: [
      { movementName: 'Push-up', family: 'pull-up' },
      { movementName: 'Chin-up', family: 'pull-up' },
      { movementName: 'Dumbbell Bench Press', family: 'pull-up' },
    ],
    edges: [
      { prerequisiteMovementName: 'Push-up', movementName: 'Chin-up', relationship: 'prerequisite' },
      { prerequisiteMovementName: 'Push-up', movementName: 'Dumbbell Bench Press', relationship: 'prerequisite' },
    ],
  };
  const { errors } = validateCapabilityContent(fixture, ctx);
  assert.match(errors.join('\n'), /Branching ambiguity in family "pull-up"/);
});

check('rejects cycle in prerequisite edges', () => {
  const fixture = {
    families: [
      { movementName: 'Push-up', family: 'cycle-fam' },
      { movementName: 'Chin-up', family: 'cycle-fam' },
    ],
    edges: [
      { prerequisiteMovementName: 'Push-up', movementName: 'Chin-up', relationship: 'prerequisite' },
      { prerequisiteMovementName: 'Chin-up', movementName: 'Push-up', relationship: 'prerequisite' },
    ],
  };
  const { errors } = validateCapabilityContent(fixture, ctx);
  assert.match(errors.join('\n'), /Cycle detected in family "cycle-fam"/);
});

console.log(`Capability content generator tests complete: ${checks} checks passed.`);
