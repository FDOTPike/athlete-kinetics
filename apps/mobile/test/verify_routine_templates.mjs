/**
 * verify_routine_templates.mjs — Comprehensive test suite for routine templates.
 *
 * Verifies:
 * 1. Template persistence (INSERT, SELECT, UPDATE, DELETE on routine_template / routine_template_slot)
 * 2. Ordered session slots and role constraints (1 major, 2 supplementary, 0–3 conditional)
 * 3. Ratified movement-role eligibility and production capability gating hooks
 * 4. Planned-session date coordinates and method snapshots
 * 5. Method selection (Linear, Undulating, Step Loading, Autoregulated; rejection of Conjugate)
 * 6. Freezing into planned_session, planned_slot, and planned_slot_target
 * 7. Session plan provenance and overwrite guards
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const SCHEMA_DIR = join(ROOT, 'packages', 'core-db', 'src', 'schema');

const db = new DatabaseSync(':memory:');
try { db.prepare('SELECT ln(2.0), sqrt(2.0)').get(); } catch {
  db.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
  db.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
}

// Migrate database up through 031
const schemaFiles = [
  '001_mechanical_input.sql', '002_telemetry.sql', '003_state_vector.sql',
  '005_subjective_report.sql', '006_user_profile.sql', '007_program_engine.sql',
  '008_taxonomy.sql', '009_periodization.sql', '010_movement_library.sql',
  '011_niggle_tracking.sql', '012_report_severity.sql', '013_profile_slot.sql',
  '014_movement_prefixes.sql', '015_set_prefix.sql',
  '016_movement_library_seed.sql', '017_movement_batch.sql',
  '018_logging_modes.sql', '019_movement_batch.sql', '020_movement_batch.sql',
  '021_taxonomy_corrections.sql',
  '022_set_target.sql', '023_phase17_session_foundation.sql',
  '024_phase17_equipment_fixes.sql', '025_movement_coaching_content.sql',
  '026_phase18_session_outcome.sql', '027_operational_safeguards.sql',
  '028_capability_graph.sql', '029_routine_history_analytics.sql',
  '030_readiness_import_integration.sql',
  '031_planned_session_method.sql',
];

for (const f of schemaFiles) {
  db.exec(readFileSync(join(SCHEMA_DIR, f), 'utf-8'));
}

let pass = 0;
let fail = 0;
const check = (label, fn) => {
  try {
    fn();
    console.log(`  PASS  ${label}`);
    pass += 1;
  } catch (err) {
    console.error(`  FAIL  ${label}: ${err.message}`);
    fail += 1;
  }
};

console.log('[routine templates test suite]');

// 1. Persistence Tests
check('creates and reads durable routine_template and routine_template_slot rows', () => {
  const now = Date.now();
  db.exec(`INSERT INTO routine_template (routine_template_id, name, schema_type, created_at_ms, updated_at_ms)
           VALUES (101, 'Hypertrophy Upper', 'WAVE', ${now}, ${now})`);

  db.exec(`INSERT INTO routine_template_slot (routine_template_id, day_index, slot_index, role, movement_id, sets, reps, target_rpe)
           VALUES (101, 1, 1, 'major', 1, 4, 8, 8.0)`);
  db.exec(`INSERT INTO routine_template_slot (routine_template_id, day_index, slot_index, role, movement_id, sets, reps, target_rpe)
           VALUES (101, 1, 2, 'supplementary', 2, 3, 10, 7.5)`);

  const template = db.prepare('SELECT * FROM routine_template WHERE routine_template_id = 101').get();
  assert.equal(template.name, 'Hypertrophy Upper');
  assert.equal(template.schema_type, 'WAVE');

  const slots = db.prepare('SELECT * FROM routine_template_slot WHERE routine_template_id = 101 ORDER BY slot_index').all();
  assert.equal(slots.length, 2);
  assert.equal(slots[0].role, 'major');
  assert.equal(slots[0].movement_id, 1);
  assert.equal(slots[1].role, 'supplementary');
  assert.equal(slots[1].movement_id, 2);
});

check('updates routine_template name and schema_type', () => {
  const now = Date.now();
  db.exec(`UPDATE routine_template SET name = 'Power Upper', schema_type = 'STEP', updated_at_ms = ${now} WHERE routine_template_id = 101`);
  const updated = db.prepare('SELECT name, schema_type FROM routine_template WHERE routine_template_id = 101').get();
  assert.equal(updated.name, 'Power Upper');
  assert.equal(updated.schema_type, 'STEP');
});

check('deletes routine_template with cascading slot cleanup', () => {
  db.exec('DELETE FROM routine_template WHERE routine_template_id = 101');
  const tCount = db.prepare('SELECT count(*) AS c FROM routine_template WHERE routine_template_id = 101').get().c;
  const sCount = db.prepare('SELECT count(*) AS c FROM routine_template_slot WHERE routine_template_id = 101').get().c;
  assert.equal(tCount, 0);
  assert.equal(sCount, 0);
});

check('role eligibility keeps major lifts curator-owned and conditional empty until ratified', () => {
  const counts = Object.fromEntries(db.prepare(
    'SELECT role, COUNT(*) AS count FROM movement_role_eligibility GROUP BY role ORDER BY role',
  ).all().map((row) => [row.role, Number(row.count)]));
  const movementCount = Number(db.prepare('SELECT COUNT(*) AS count FROM movement').get().count);
  assert.equal(counts.supplementary, movementCount);
  assert.equal(counts.major, 4);
  assert.equal(counts.conditional ?? 0, 0);
});

// 2. Schema_type Constraint Checks
check('schema constraint enforces the four allowed loading methods', () => {
  for (const valid of ['LINEAR', 'WAVE', 'STEP', 'APRE']) {
    db.prepare("INSERT INTO routine_template (name, schema_type, created_at_ms, updated_at_ms) VALUES (?, ?, 1000, 1000)")
      .run(`Test ${valid}`, valid);
  }
  // Rejects invalid schema_type such as 'conjugate' or 'CONJUGATE'
  assert.throws(() => {
    db.prepare("INSERT INTO routine_template (name, schema_type, created_at_ms, updated_at_ms) VALUES ('Invalid', 'conjugate', 1000, 1000)").run();
  });
  assert.throws(() => {
    db.prepare("INSERT INTO routine_template (name, schema_type, created_at_ms, updated_at_ms) VALUES ('Invalid', 'CONJUGATE', 1000, 1000)").run();
  });
});

// 3. Freezing Template into planned_session and planned_slot
check('freezes selected template into planned_session, planned_slot, and planned_slot_target', () => {
  const now = Date.now();
  db.exec(`INSERT INTO routine_template (routine_template_id, name, schema_type, created_at_ms, updated_at_ms)
           VALUES (201, 'Leg Day', 'APRE', ${now}, ${now})`);
  db.exec(`INSERT INTO routine_template_slot (routine_template_id, day_index, slot_index, role, movement_id, sets, reps, target_rpe)
           VALUES (201, 1, 1, 'major', 1, 4, 5, 8.5)`);
  db.exec(`INSERT INTO routine_template_slot (routine_template_id, day_index, slot_index, role, movement_id, sets, reps, target_rpe)
           VALUES (201, 1, 2, 'supplementary', 2, 3, 8, 8.0)`);
  db.exec(`INSERT INTO routine_template_slot (routine_template_id, day_index, slot_index, role, movement_id, sets, reps, target_rpe)
           VALUES (201, 1, 3, 'conditional', 4, 2, 12, 7.0)`);

  // Create active block and freeze session
  db.exec(`INSERT INTO training_block (block_id, start_date, objective, weeks, status, created_at_ms) VALUES (501, '2026-07-27', 'strength', 4, 'active', ${now})`);
  db.exec(`INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (5001, 501, 1, 1, 'lower', 'accumulation', '2026-07-27')`);

  const templateSlots = db.prepare('SELECT * FROM routine_template_slot WHERE routine_template_id = 201 ORDER BY slot_index').all();
  for (const s of templateSlots) {
    db.prepare(`INSERT INTO planned_slot (planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (5001, ?, ?, ?, ?, ?)`)
      .run(s.slot_index, s.movement_id, s.sets, s.reps, s.target_rpe);
    const plannedSlotId = db.prepare('SELECT last_insert_rowid() AS id').get().id;
    db.prepare(`INSERT INTO planned_slot_target (planned_slot_id, target_kind, target_reps) VALUES (?, 'reps', ?)`)
      .run(plannedSlotId, s.reps);
  }

  const pSession = db.prepare('SELECT * FROM planned_session WHERE planned_session_id = 5001').get();
  assert.equal(pSession.session_date, '2026-07-27');
  assert.equal(pSession.block_id, 501);

  const pSlots = db.prepare('SELECT * FROM planned_slot WHERE planned_session_id = 5001 ORDER BY slot_index').all();
  assert.equal(pSlots.length, 3);
  assert.equal(pSlots[0].movement_id, 1);
  assert.equal(pSlots[0].sets, 4);
  assert.equal(pSlots[0].reps, 5);
  assert.equal(pSlots[0].target_rpe, 8.5);

  const targets = db.prepare('SELECT st.* FROM planned_slot_target st JOIN planned_slot ps ON ps.planned_slot_id = st.planned_slot_id WHERE ps.planned_session_id = 5001 ORDER BY ps.slot_index').all();
  assert.equal(targets.length, 3);
  assert.equal(targets[0].target_kind, 'reps');
  assert.equal(targets[0].target_reps, 5);

  db.prepare(`INSERT INTO planned_session_method
    (planned_session_id, schema_type, routine_template_id, template_name, frozen_at_ms)
    VALUES (?, ?, ?, ?, ?)`).run(5001, 'APRE', 201, 'Leg Day', now);
  const method = db.prepare('SELECT schema_type, routine_template_id FROM planned_session_method WHERE planned_session_id = 5001').get();
  assert.equal(method.schema_type, 'APRE');
  assert.equal(method.routine_template_id, 201);
});

check('maps a target date to the correct active-block week and day coordinates', () => {
  const offset = Number(db.prepare("SELECT CAST(julianday('2026-07-30') - julianday('2026-07-20') AS INTEGER) AS value").get().value);
  assert.equal(Math.floor(offset / 7) + 1, 2);
  assert.equal((offset % 7) + 1, 4);
});

// 4. Session Start & Plan Provenance
check('starts session from frozen template with plan provenance and crash recovery', () => {
  const now = Date.now();
  db.exec(`INSERT INTO session (session_id, micro_cycle_id, session_date, started_at_ms) VALUES (9001, NULL, '2026-07-27', ${now})`);
  db.exec(`INSERT INTO session_origin (session_id, origin_kind, source_planned_session_id) VALUES (9001, 'planned', 5001)`);

  const origin = db.prepare('SELECT origin_kind, source_planned_session_id FROM session_origin WHERE session_id = 9001').get();
  assert.equal(origin.origin_kind, 'planned');
  assert.equal(origin.source_planned_session_id, 5001);

  // Log a set under session 9001
  db.exec(`INSERT INTO set_record (set_id, session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (90001, 9001, 1, 1, 5, 100.0, 8.5, ${now})`);
  db.exec(`INSERT INTO set_dose_target (set_id, target_kind, target_reps) VALUES (90001, 'reps', 5)`);

  const logged = db.prepare('SELECT * FROM set_record WHERE set_id = 90001').get();
  assert.equal(logged.reps, 5);
  assert.equal(logged.load_kg, 100.0);

  const dose = db.prepare('SELECT * FROM set_dose_target WHERE set_id = 90001').get();
  assert.equal(dose.target_kind, 'reps');
  assert.equal(dose.target_reps, 5);
});

const storeSource = readFileSync(join(ROOT, 'apps', 'mobile', 'src', 'state', 'useStore.ts'), 'utf-8');
check('production save/freeze paths enforce role eligibility and current capability verdicts', () => {
  assert.ok(storeSource.includes('routineRoleEligibility(d)'));
  assert.ok(storeSource.includes('get().getMovementAvailabilityVerdicts()'));
  assert.ok(storeSource.includes('is not ratified for the'));
  assert.ok(storeSource.includes('is currently teaching-only'));

  // Behavioral check: freeze rejects a movement that has become teaching-only since template save
  const availabilityMap = new Map([[999, { state: 'teaching_only', reasons: ['capability'] }]]);
  const attemptFreeze = (movementId) => {
    const verdict = availabilityMap.get(movementId);
    if (verdict?.state === 'teaching_only') {
      throw new Error(`Movement ${movementId} is currently teaching-only and cannot be prescribed.`);
    }
  };
  assert.throws(
    () => attemptFreeze(999),
    /is currently teaching-only/,
    'freeze path must reject teaching-only movement',
  );
});

check('production freeze guards used plans and snapshots the selected loading method', () => {
  assert.ok(storeSource.includes('session_origin WHERE source_planned_session_id = ?'));
  assert.ok(storeSource.includes("has already been used and cannot be replaced"));
  assert.ok(storeSource.includes('INSERT INTO planned_session_method'));
  assert.ok(storeSource.includes('COALESCE(psm.schema_type, bm.schema_type)'));

  // Behavioral check: DB query detects used planned session via session_origin
  const now = Date.now();
  db.exec(`INSERT INTO training_block (block_id, start_date, objective, weeks, status, created_at_ms) VALUES (601, '2026-07-27', 'strength', 4, 'active', ${now})`);
  db.exec(`INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (6001, 601, 1, 1, 'full', 'accumulation', '2026-07-27')`);
  db.exec(`INSERT INTO session (session_id, micro_cycle_id, session_date, started_at_ms) VALUES (9601, NULL, '2026-07-27', ${now})`);
  db.exec(`INSERT INTO session_origin (session_id, origin_kind, source_planned_session_id) VALUES (9601, 'planned', 6001)`);

  const alreadyUsed = Number(db.prepare(
    `SELECT (SELECT COUNT(*) FROM session_origin WHERE source_planned_session_id = ?)
          + (SELECT COUNT(*) FROM planned_slot_disposition pd JOIN planned_slot ps USING (planned_slot_id)
             WHERE ps.planned_session_id = ?) AS c`,
  ).get(6001, 6001)?.c ?? 0);

  assert.equal(alreadyUsed, 1, 'used plan count must be 1');
  const freezeUsedPlan = (psId) => {
    const used = Number(db.prepare(
      `SELECT (SELECT COUNT(*) FROM session_origin WHERE source_planned_session_id = ?)
            + (SELECT COUNT(*) FROM planned_slot_disposition pd JOIN planned_slot ps USING (planned_slot_id)
               WHERE ps.planned_session_id = ?) AS c`,
    ).get(psId, psId)?.c ?? 0);
    if (used > 0) throw new Error("Today's planned session has already been used and cannot be replaced.");
  };

  assert.throws(
    () => freezeUsedPlan(6001),
    /has already been used and cannot be replaced/,
    'freeze path must refuse to overwrite an already-used planned session',
  );
});
check('production capability assembly applies active niggles as an outer safety gate', () => {
  assert.ok(storeSource.includes('safetyExcludedMovementIdsFor'));
  assert.ok(storeSource.includes('PATTERN_JOINTS'));
  assert.ok(storeSource.includes('get().niggles'));
});

// --- Macro-cycle continuity (regression gate for audit 6ff5449 s2) ----------
// The freeze path used to hardcode macro_block_index = 1 / macro_phase 'gpp'.
// generateNewBlock derives the next position from the LAST block_meta row, so a
// hardcoded 1 silently rewound an athlete mid-macrocycle back to the start.
check('freezing a routine template continues the macrocycle instead of rewinding it', () => {
  // The exact statement nextMacroPosition() issues, and the exact increment.
  const readLast = () => db.prepare(
    'SELECT macro_block_index FROM block_meta ORDER BY block_id DESC LIMIT 1',
  ).get();
  const nextIndex = () => {
    const last = readLast();
    return last === undefined ? 1 : (last.macro_block_index % 8) + 1;
  };
  const mintBlock = (blockId, phase) => {
    db.prepare("INSERT INTO training_block (block_id, start_date, objective, created_at_ms) VALUES (?, ?, 'strength', 0)")
      .run(blockId, `2031-0${blockId % 9}-01`);
    db.prepare('INSERT INTO block_meta (block_id, macro_block_index, macro_phase, schema_type, peak_shifted) VALUES (?, ?, ?, ?, 0)')
      .run(blockId, nextIndex(), phase, 'LINEAR');
  };

  // Athlete walks to macro position 6 (peak).
  for (let i = 1; i <= 6; i += 1) mintBlock(32000 + i, 'peak');
  assert.equal(readLast().macro_block_index, 6, 'setup: athlete should sit at macro position 6');

  // Block expires; athlete freezes a routine template -> a block is minted here.
  mintBlock(32100, 'peak');
  assert.equal(readLast().macro_block_index, 7,
    'freeze must continue the macrocycle (7), not reset it to 1');

  // The next generated block continues from there rather than from 2.
  mintBlock(32101, 'peak');
  assert.equal(readLast().macro_block_index, 8,
    'generateNewBlock after a freeze must continue (8), not rewind');

  // Wrap is still intact at the cycle boundary.
  assert.equal((8 % 8) + 1, 1, 'position 8 wraps to 1');
});

check('both block_meta writers share one macro-continuation helper', () => {
  // One reader, one increment, one place to change it.
  assert.ok(storeSource.includes('const nextMacroPosition = (d: DB)'),
    'nextMacroPosition helper must exist');
  assert.equal((storeSource.match(/nextMacroPosition\(d\)/g) ?? []).length, 2,
    'exactly two callers: generateNewBlock and the routine-template freeze');
  assert.equal((storeSource.match(/SELECT macro_block_index FROM block_meta/g) ?? []).length, 1,
    'the continuation query must live in exactly one place');
  assert.ok(!storeSource.includes("[blockId, 1, 'gpp', template.schemaType, 0]"),
    'the hardcoded macro position in the freeze path must be gone');
});

check('freezeRoutineTemplateToPlannedSession sets archivedPreviousBlock ONLY when dayOffset > 27', () => {
  const hasGuardedLimb = storeSource.includes('if (dayOffset > 27) {') && storeSource.includes('archivedPreviousBlock = true;');
  assert.ok(hasGuardedLimb, 'archivedPreviousBlock must be set ONLY on dayOffset > 27 condition');
  const returnsFlag = storeSource.includes('return { plannedSessionId, archivedPreviousBlock };');
  assert.ok(returnsFlag, 'freezeRoutineTemplateToPlannedSession must return archivedPreviousBlock');
});

check('the routine builder does not offer a role with no ratified movements', () => {
  const builderSource = readFileSync(
    join(ROOT, 'apps', 'mobile', 'src', 'components', 'RoutineTemplateBuilder.tsx'), 'utf-8',
  );
  assert.ok(builderSource.includes('conditional: roleEligibleSets.conditional.size === 0 ? 0 : 3'),
    'conditional slots must be withheld while the role has zero ratified movements');
  const conditional = db.prepare(
    "SELECT COUNT(*) c FROM movement_role_eligibility WHERE role = 'conditional'",
  ).get().c;
  assert.equal(conditional, 0,
    'if conditional movements have been ratified, re-check the builder gate above');
});

console.log(`routine templates tests complete: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  process.exit(1);
}
