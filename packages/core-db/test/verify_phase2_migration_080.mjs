import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);

// Parse packages/core-db/src/migrations.ts directly to load ordered SQL strings without .sql bundler imports.
const migrationsTsPath = path.resolve('packages/core-db/src/migrations.ts');
const migrationsTs = fs.readFileSync(migrationsTsPath, 'utf8');
const importMap = new Map();
for (const m of migrationsTs.matchAll(/^import\s+(\w+)\s+from\s+'(\.\/schema\/[^']+\.sql)';/gm)) {
  importMap.set(m[1], path.resolve('packages/core-db/src', m[2]));
}
const arrayMatch = migrationsTs.match(/const\s+MIGRATIONS\s*:\s*readonly\s+string\[\]\s*=\s*\[([^\]]+)\]/s);
if (!arrayMatch) {
  throw new Error('Could not parse MIGRATIONS array from packages/core-db/src/migrations.ts');
}
const MIGRATIONS = arrayMatch[1]
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((ident) => {
    const filePath = importMap.get(ident);
    if (!filePath) throw new Error(`Missing SQL import for migration identifier ${ident}`);
    return fs.readFileSync(filePath, 'utf8');
  });

const runnerMod = require('./.build/migrationRunner.js');
const contractPath = fs.existsSync(path.resolve('packages/core-db/test/.build/backup/schemaContract.js'))
  ? './.build/backup/schemaContract.js'
  : './.build/lineage/schemaContract.js';
const contractMod = require(contractPath);

const { runMigrations, sentinelsMissing } = runnerMod;
const {
  BACKUP_SCHEMA_USER_VERSION,
  BACKUP_SCHEMA_MIGRATION_SLOT,
  backupSchemaContractFor,
} = contractMod;

const freshDb = () => {
  const raw = new DatabaseSync(':memory:');
  return {
    raw,
    executeSync(sql, params) {
      const stmt = raw.prepare(sql);
      if (stmt.columns().length > 0) return { rows: stmt.all(...(params ?? [])) };
      stmt.run(...(params ?? []));
      return { rows: [] };
    },
  };
};

let passed = 0;
let failed = 0;
const check = (name, cond, detail = '') => {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail ? ` (${detail})` : ''}`);
  }
};

const schemaFile = path.resolve('packages/core-db/src/schema/080_sport_peaking_and_lifting_taxonomy.sql');
check('080_sport_peaking_and_lifting_taxonomy.sql exists', fs.existsSync(schemaFile), schemaFile);
check('the 81-entry migration chain still registers slots 080 and 081',
  MIGRATIONS.length === 81 && importMap.get('m080') === schemaFile && importMap.has('m081'), `length=${MIGRATIONS.length}`);
check('historical 080 and 081 backup contracts coexist with current slot 082',
  BACKUP_SCHEMA_USER_VERSION === 81 && BACKUP_SCHEMA_MIGRATION_SLOT === 82
    && backupSchemaContractFor(79, 80) !== null && backupSchemaContractFor(80, 81) !== null,
  `uv=${BACKUP_SCHEMA_USER_VERSION} slot=${BACKUP_SCHEMA_MIGRATION_SLOT}`);

const db = freshDb();
runMigrations(db, MIGRATIONS);

check('user_version reaches 81 with zero missing sentinels',
  db.executeSync('PRAGMA user_version').rows[0].user_version === 81 && sentinelsMissing(db).length === 0,
  `uv=${db.executeSync('PRAGMA user_version').rows[0].user_version} missing=${sentinelsMissing(db).join(',')}`);

// Widened 24-sport CHECK & matches_per_week 0..52 on both sport tables
const acceptsLiftingPrimary = (() => {
  try {
    db.executeSync(
      `INSERT INTO athlete_sport_profile (sport_profile_id, sport_id, other_sport_name, outcome_id, experience_id, practice_sessions_per_week, matches_per_week, typical_session_min, competition_date, revision, updated_at_ms)
       VALUES (1, 'olympic_weightlifting', NULL, 'general_support', 'over_5_years', 0, 52, NULL, '2026-10-01', 1, 100)`,
    );
    return true;
  } catch {
    return false;
  }
})();
const acceptsLiftingSecondary = (() => {
  try {
    db.executeSync(
      `INSERT INTO athlete_secondary_sport_profile (priority_rank, sport_profile_id, sport_id, other_sport_name, outcome_id, experience_id, practice_sessions_per_week, matches_per_week, typical_session_min, competition_date, revision, updated_at_ms)
       VALUES (2, 1, 'strongman', NULL, 'general_support', '2_to_5_years', 0, 24, NULL, NULL, 1, 100)`,
    );
    return true;
  } catch {
    return false;
  }
})();
check('080 widens primary & secondary sport tables to olympic_weightlifting/strongman and matches_per_week 0..52',
  acceptsLiftingPrimary && acceptsLiftingSecondary);

// Static seed table sport_peaking_movement
const basketballSeeds = (() => {
  try {
    return db.executeSync(
      `SELECT category, name FROM sport_peaking_movement WHERE sport_id = 'basketball' ORDER BY sort_order`,
    ).rows;
  } catch {
    return [];
  }
})();
check('080 seeds sport_peaking_movement with 3 basketball entries',
  basketballSeeds.length === 3
    && basketballSeeds[0].name === 'Mock basketball game'
    && basketballSeeds[1].name === 'Specific basketball movement drills'
    && basketballSeeds[2].name === 'High-intensity cardio',
  JSON.stringify(basketballSeeds));

// Side-car tables for backOff & meet countdown
const tables = new Set(
  db.executeSync(`SELECT name FROM sqlite_master WHERE type = 'table'`).rows.map((r) => r.name),
);
check('080 adds planned_slot_backoff, session_slot_backoff, training_program_meet_countdown, training_block_meet_meta',
  tables.has('planned_slot_backoff')
    && tables.has('session_slot_backoff')
    && tables.has('training_program_meet_countdown')
    && tables.has('training_block_meet_meta'));

// Replay & self-heal parity
if (tables.has('sport_peaking_movement')) {
  db.executeSync('DROP TABLE sport_peaking_movement');
  check('missing sport_peaking_movement detected by sentinelsMissing',
    sentinelsMissing(db).includes('sport_peaking_movement'));
  runMigrations(db, MIGRATIONS);
  const reseeded = db.executeSync(`SELECT COUNT(*) AS c FROM sport_peaking_movement WHERE sport_id = 'basketball'`).rows[0].c;
  const keptPrimary = db.executeSync(`SELECT sport_id, matches_per_week FROM athlete_sport_profile WHERE sport_profile_id = 1`).rows[0];
  check('self-heal restores sport_peaking_movement basketball seeds and preserves 080 lifting profile cleanly',
    Number(reseeded) === 3 && keptPrimary?.sport_id === 'olympic_weightlifting' && keptPrimary?.matches_per_week === 52);
}

console.log(`\nPhase 2 Migration 080 Summary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
