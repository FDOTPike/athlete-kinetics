// Builds SYNTHETIC encrypted backups for the reader's verifier. Every name,
// note, report and question below is invented. Each athlete database is built
// from the real migration files (user_version 76, migration slot 77), seeded
// with a few rows in the tables the reading plan queries, and sealed with the
// package's own sealBackup (packages/core-db/src/backup/contract.ts).
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nodeCryptoProvider } from '../lib/node_crypto.mjs';

export const SYNTHETIC_PASSWORD = 'synthetic-beta-reader-password';

const insert = (db, table, row) => {
  const keys = Object.keys(row);
  db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`)
    .run(...keys.map((key) => row[key] ?? null));
};

const movementPair = (db) => {
  const [first, second] = db.prepare('SELECT movement_id FROM movement ORDER BY movement_id LIMIT 2').all()
    .map((row) => row.movement_id);
  return { mvA: first, mvB: second };
};

// Athlete A: four sessions in the window. 1001 adapted (one skipped slot),
// 1002 followed the plan, 1003 unfinished (a runner checkpoint, no outcome),
// 1004 stopped safely. Set 103 is below the RPE 6 floor, 401 is unrated.
function seedAthleteA(db) {
  const { mvA, mvB } = movementPair(db);
  for (const [session_id, session_date] of [[1001, '2026-09-02'], [1002, '2026-09-09'], [1003, '2026-09-16'], [1004, '2026-09-23']]) {
    insert(db, 'session', { session_id, session_date, started_at_ms: 1000 });
  }
  const slots = [
    [1, 1001, 0, mvA, 3, 5, 'planned', 7, 9001],
    [2, 1001, 1, mvB, 2, 5, 'planned', 7, 9002],
    [3, 1002, 0, mvA, 2, 5, 'planned', 7, 9003],
    [4, 1003, 0, mvA, 3, 5, 'planned', 7, 9004],
    [5, 1004, 0, mvB, 3, 5, 'planned', 7, 9005],
  ];
  for (const [session_plan_slot_id, session_id, slot_index, movement_id, planned_sets, planned_reps, provenance_kind, target_rpe, source_planned_slot_id] of slots) {
    insert(db, 'session_plan_slot', { session_plan_slot_id, session_id, slot_index, movement_id, planned_sets, planned_reps, provenance_kind, target_rpe, source_planned_slot_id });
  }
  insert(db, 'session_slot_target', { session_plan_slot_id: 1, target_kind: 'reps', target_reps: 5 });
  insert(db, 'session_slot_target', { session_plan_slot_id: 2, target_kind: 'reps', target_reps: 5 });
  insert(db, 'session_slot_target', { session_plan_slot_id: 3, target_kind: 'reps', target_reps: 5 });
  insert(db, 'session_slot_target', { session_plan_slot_id: 4, target_kind: 'reps', target_reps: 5 });
  insert(db, 'session_slot_target', { session_plan_slot_id: 5, target_kind: 'time', target_seconds: 30 });
  insert(db, 'session_skipped_slot', { session_plan_slot_id: 2 });

  const sets = [
    [101, 1001, mvA, 1, 5, 100, 7, 1000],
    [102, 1001, mvA, 2, 5, 100, 8, 2000],
    [103, 1001, mvA, 3, 5, 100, 5, 3000],
    [201, 1002, mvA, 1, 5, 80, 6, 1000],
    [202, 1002, mvA, 2, 5, 80, 6, 2000],
    [401, 1004, mvB, 1, 0, 60, null, 7000],
  ];
  for (const [set_id, session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms] of sets) {
    insert(db, 'set_record', { set_id, session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms });
  }
  const targets = [[101, 1, 9001, 1000], [102, 1, 9001, 2000], [103, 1, 9001, 3000], [201, 3, 9003, 1000], [202, 3, 9003, 2000], [401, 5, 9005, 7000]];
  for (const [set_id, session_plan_slot_id, source_planned_slot_id, created_at_ms] of targets) {
    insert(db, 'set_target', { set_id, session_plan_slot_id, provenance_kind: 'planned', target_rpe: 7, source_planned_slot_id, created_at_ms });
  }
  for (const set_id of [101, 102, 103, 201, 202]) insert(db, 'set_dose_target', { set_id, target_kind: 'reps', target_reps: 5 });
  insert(db, 'set_dose_target', { set_id: 401, target_kind: 'time', target_seconds: 30 });
  insert(db, 'set_load_shown', { set_id: 101, load_source: 'seeded', shown_load_kg: 100, advisory_kg: 105, advisory_kind: 'onerm' });
  insert(db, 'set_load_shown', { set_id: 102, load_source: 'manual' });
  insert(db, 'set_load_shown', { set_id: 103, load_source: 'history', shown_load_kg: 95 });

  insert(db, 'session_outcome', {
    session_id: 1001, outcome_kind: 'adapted_session', terminal_phase: 'complete', origin_kind: 'planned', session_mode: 'guided',
    training_age: 'intermediate', slot_count: 2, planned_set_count: 5, logged_set_count: 3, exact_dose_count: 3, under_dose_count: 0,
    over_dose_count: 0, unknown_dose_count: 0, unmapped_set_count: 0, missing_set_count: 2, missing_unskipped_set_count: 0,
    extra_set_count: 0, adapted_slot_count: 1, skipped_slot_count: 1, off_plan_slot_count: 0, finalized_at_ms: 4000, engine_version: 1,
  });
  insert(db, 'session_outcome', {
    session_id: 1002, outcome_kind: 'followed_plan', terminal_phase: 'complete', origin_kind: 'planned', session_mode: 'guided',
    training_age: 'intermediate', slot_count: 1, planned_set_count: 2, logged_set_count: 2, exact_dose_count: 2, under_dose_count: 0,
    over_dose_count: 0, unknown_dose_count: 0, unmapped_set_count: 0, missing_set_count: 0, missing_unskipped_set_count: 0,
    extra_set_count: 0, adapted_slot_count: 0, skipped_slot_count: 0, off_plan_slot_count: 0, finalized_at_ms: 4000, engine_version: 1,
  });
  insert(db, 'session_outcome', {
    session_id: 1004, outcome_kind: 'stopped_safely', terminal_phase: 'halted', halt_reason: 'pain', origin_kind: 'planned', session_mode: 'guided',
    training_age: 'intermediate', slot_count: 1, planned_set_count: 3, logged_set_count: 1, exact_dose_count: 0, under_dose_count: 0,
    over_dose_count: 0, unknown_dose_count: 1, unmapped_set_count: 0, missing_set_count: 2, missing_unskipped_set_count: 2,
    extra_set_count: 0, adapted_slot_count: 0, skipped_slot_count: 0, off_plan_slot_count: 0, finalized_at_ms: 8000, engine_version: 1,
  });
  insert(db, 'session_runner_checkpoint', {
    session_id: 1003, session_mode: 'guided', phase: 'working', current_session_plan_slot_id: 4, current_set_index: 1,
    rest_target_seconds: 0, runner_state_json: '{}', updated_at_ms: 6000,
  });

  insert(db, 'session_feel', { session_id: 1001, feel: 'harder', reason_tired: 1, recorded_at_ms: 5000 });
  insert(db, 'session_feel', { session_id: 1002, feel: 'as_planned', recorded_at_ms: 4000 });
  insert(db, 'session_feel', { session_id: 1004, feel: 'stopped_early', reason_pain: 1, recorded_at_ms: 8000 });
  insert(db, 'session_note', { session_id: 1001, note: 'private-note-A-1001', created_at_ms: 5000 });
  insert(db, 'session_note', { session_id: 1004, note: 'private-note-A-1004', created_at_ms: 8000 });

  insert(db, 'subjective_report', { date: '2026-09-09', reported_at_ms: 1500000, raw_text: 'private-report-A-1', matched_entry_id: 'entry-chest', similarity: 0.8, halt: 0, load_modifier: 0.9 });
  insert(db, 'subjective_report', { date: '2026-09-16', reported_at_ms: 2500000, raw_text: 'private-report-A-2', halt: 0 });
  insert(db, 'subjective_report', { date: '2026-09-23', reported_at_ms: 3500000, raw_text: 'private-report-A-3', matched_entry_id: 'entry-injury', similarity: 0.9, halt: 1, set_modifier: -1, rpe_cap: 6 });

  insert(db, 'question_log', { asked_at: 1000000, question_text: 'private-question-A-1', outcome_kind: 'card', glossary_term_id: 'RPE' });
  insert(db, 'question_log', { asked_at: 2000000, question_text: 'private-question-A-2', outcome_kind: 'none' });
  insert(db, 'question_log', { asked_at: 3000000, question_text: 'private-question-A-3', outcome_kind: 'refer' });
  insert(db, 'question_log', { asked_at: 20000000, question_text: 'private-question-A-outside', outcome_kind: 'none' });
}

// Athlete B: one finished session with one unmapped set (no set_target row).
function seedAthleteB(db) {
  const { mvA, mvB } = movementPair(db);
  insert(db, 'session', { session_id: 2001, session_date: '2026-09-03', started_at_ms: 1000 });
  insert(db, 'session_plan_slot', { session_plan_slot_id: 6, session_id: 2001, slot_index: 0, movement_id: mvA, planned_sets: 2, planned_reps: 5, provenance_kind: 'planned', target_rpe: 7, source_planned_slot_id: 9101 });
  insert(db, 'session_slot_target', { session_plan_slot_id: 6, target_kind: 'reps', target_reps: 5 });
  insert(db, 'set_record', { set_id: 301, session_id: 2001, movement_id: mvA, set_index: 1, reps: 5, load_kg: 70, rpe: 6, logged_at_ms: 1000 });
  insert(db, 'set_record', { set_id: 302, session_id: 2001, movement_id: mvA, set_index: 2, reps: 5, load_kg: 70, rpe: 9, logged_at_ms: 2000 });
  insert(db, 'set_record', { set_id: 303, session_id: 2001, movement_id: mvB, set_index: 3, reps: 5, load_kg: 70, rpe: 8, logged_at_ms: 3000 });
  insert(db, 'set_target', { set_id: 301, session_plan_slot_id: 6, provenance_kind: 'planned', target_rpe: 7, source_planned_slot_id: 9101, created_at_ms: 1000 });
  insert(db, 'set_target', { set_id: 302, session_plan_slot_id: 6, provenance_kind: 'planned', target_rpe: 7, source_planned_slot_id: 9101, created_at_ms: 2000 });
  insert(db, 'set_dose_target', { set_id: 301, target_kind: 'reps', target_reps: 5 });
  insert(db, 'set_dose_target', { set_id: 302, target_kind: 'reps', target_reps: 5 });
  insert(db, 'session_outcome', {
    session_id: 2001, outcome_kind: 'session_recorded', terminal_phase: 'complete', origin_kind: 'planned', session_mode: 'guided',
    training_age: 'intermediate', slot_count: 1, planned_set_count: 2, logged_set_count: 3, exact_dose_count: 2, under_dose_count: 0,
    over_dose_count: 0, unknown_dose_count: 0, unmapped_set_count: 1, missing_set_count: 0, missing_unskipped_set_count: 0,
    extra_set_count: 0, adapted_slot_count: 0, skipped_slot_count: 0, off_plan_slot_count: 0, finalized_at_ms: 4000, engine_version: 1,
  });
  insert(db, 'session_feel', { session_id: 2001, feel: 'easier', reason_felt_good: 1, recorded_at_ms: 4000 });
  insert(db, 'subjective_report', { date: '2026-09-03', reported_at_ms: 1600000, raw_text: 'private-report-B-1', halt: 0 });
  insert(db, 'question_log', { asked_at: 1100000, question_text: 'private-question-B-1', outcome_kind: 'none' });
}

// Athlete C is never listed in the manifest. The reader must never open it.
function seedAthleteC(db) {
  const { mvA } = movementPair(db);
  insert(db, 'session', { session_id: 3001, session_date: '2026-09-04', started_at_ms: 1000 });
  insert(db, 'session_plan_slot', { session_plan_slot_id: 7, session_id: 3001, slot_index: 0, movement_id: mvA, planned_sets: 1, provenance_kind: 'free_form' });
  insert(db, 'session_note', { session_id: 3001, note: 'private-note-C-3001', created_at_ms: 1 });
  insert(db, 'subjective_report', { date: '2026-09-04', reported_at_ms: 1300000, raw_text: 'private-report-C-1', halt: 0 });
  insert(db, 'question_log', { asked_at: 1200000, question_text: 'private-question-C-1', outcome_kind: 'none' });
}

export const SYNTHETIC_MANIFEST = {
  manifestVersion: 1,
  entries: [
    { athleteId: 'default', participantCode: 'SYN-01', consentVersion: 'synthetic-v1', consented: true, startDate: '2026-09-01', endDate: '2026-09-30', startMs: 1, endMs: 10000000, timezoneId: 'Australia/Sydney' },
    { athleteId: 'a123', participantCode: 'SYN-02', consentVersion: 'synthetic-v1', consented: true, startDate: '2026-09-01', endDate: '2026-09-30', startMs: 1, endMs: 10000000, timezoneId: 'Australia/Sydney' },
  ],
};

export async function makeSyntheticBackup({ repoRoot, work, backup }) {
  const schemaDirectory = join(repoRoot, 'packages', 'core-db', 'src', 'schema');
  const migrations = readdirSync(schemaDirectory).filter((name) => /^0\d\d_.*\.sql$/.test(name) && !name.startsWith('004_')).sort();
  const buildDatabase = (name, seed, damage = null) => {
    const file = join(work, name);
    const db = new DatabaseSync(file);
    try {
      db.exec('PRAGMA foreign_keys = ON;');
      for (const migration of migrations) db.exec(readFileSync(join(schemaDirectory, migration), 'utf8'));
      seed(db);
      if (damage) damage(db);
      db.exec(`PRAGMA user_version = ${backup.BACKUP_SCHEMA_USER_VERSION};`);
      if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('synthetic database failed quick_check');
    } finally {
      db.close();
    }
    return new Uint8Array(readFileSync(file));
  };
  const snapshot = (athleteId, dbName, bytes) => ({
    athleteId, dbName, byteLength: bytes.length, sha256Hex: nodeCryptoProvider.sha256Hex(bytes),
    userVersion: backup.BACKUP_SCHEMA_USER_VERSION, tableCount: backup.BACKUP_SCHEMA_TABLE_COUNT,
    databaseBase64: backup.bytesToBase64(bytes),
  });
  const databases = {
    a: buildDatabase('synthetic-a.db', seedAthleteA),
    b: buildDatabase('synthetic-b.db', seedAthleteB),
    c: buildDatabase('synthetic-c.db', seedAthleteC),
    // Athlete B with its session_note table dropped: a schema the contract refuses.
    bDamaged: buildDatabase('synthetic-b-damaged.db', seedAthleteB, (db) => db.exec('DROP TABLE session_note;')),
  };
  const archiveFor = (bBytes) => ({
    archiveVersion: 1,
    backupId: '0f1e2d3c4b5a69788796a5b4c3d2e1f0',
    createdAt: '2026-09-30T05:00:00.000Z',
    sourceAppVersion: '0.0.0-synthetic',
    sourceSchemaVersion: backup.BACKUP_SCHEMA_USER_VERSION,
    sourceMigrationSlot: backup.BACKUP_SCHEMA_MIGRATION_SLOT,
    scope: 'all-athletes',
    restorePolicy: 'replace',
    registry: {
      version: 1, activeId: 'default', advancedToolsUnlocked: false,
      athletes: [
        { id: 'default', name: 'Synthetic Athlete A', dbName: 'athlete_kinetics.db', createdAtMs: 0 },
        { id: 'a123', name: 'Synthetic Athlete B', dbName: 'ak_athlete_a123.db', createdAtMs: 123 },
        { id: 'c789', name: 'Synthetic Athlete C', dbName: 'ak_athlete_c789.db', createdAtMs: 789 },
      ],
    },
    databases: [
      snapshot('default', 'athlete_kinetics.db', databases.a),
      snapshot('a123', 'ak_athlete_a123.db', bBytes),
      snapshot('c789', 'ak_athlete_c789.db', databases.c),
    ],
    previousSuccessfulBackupAt: null,
  });
  const pmbakPath = join(work, 'synthetic.pmbak');
  writeFileSync(pmbakPath, await backup.sealBackup(archiveFor(databases.b), SYNTHETIC_PASSWORD, nodeCryptoProvider), 'utf8');
  const damagedPmbakPath = join(work, 'synthetic-damaged.pmbak');
  writeFileSync(damagedPmbakPath, await backup.sealBackup(archiveFor(databases.bDamaged), SYNTHETIC_PASSWORD, nodeCryptoProvider), 'utf8');
  const manifestPath = join(work, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(SYNTHETIC_MANIFEST, null, 2), 'utf8');
  const noTimestampManifestPath = join(work, 'manifest-no-timestamps.json');
  writeFileSync(noTimestampManifestPath, JSON.stringify({
    manifestVersion: 1,
    entries: SYNTHETIC_MANIFEST.entries.map(({ startMs, endMs, timezoneId, ...rest }) => rest),
  }, null, 2), 'utf8');
  return { pmbakPath, damagedPmbakPath, manifestPath, noTimestampManifestPath };
}
