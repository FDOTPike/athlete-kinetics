/**
 * render-correction-v2-review-sheet.mjs — a reading aid for the owner's
 * review of movement content correction v2 (migration 068, 115 movements,
 * ratification state pending_owner_review).
 *
 * It writes one Markdown sheet and nothing else. It never writes a staging
 * file, a migration, a manifest or a ratification field: approving a record
 * is the owner's, and an approval ships in a new migration slot (see
 * generate-content-correction-v2.mjs).
 *
 * Every row is checked before the sheet is written:
 *   - the record's correction_sha256 reproduces and equals the manifest's;
 *   - its supersedes_v2_sha256 is the fingerprint of the staged v2 row shown
 *     as "before", and that staged text is what the database holds after
 *     migration 067;
 *   - the "after" text is what the database holds after migration 068;
 *   - its number and name match the migration's own section header;
 *   - movements 135 and 187 (the animation lane) are not in the set.
 * The database is built in memory with node:sqlite from the migrations
 * listed in packages/core-db/src/migrations.ts, in that order; nothing on
 * disk is opened for writing except the sheet.
 *
 * Usage:
 *   node scripts/render-correction-v2-review-sheet.mjs --write
 *   node scripts/render-correction-v2-review-sheet.mjs --check
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ANIMATION_LANE_NAMES, correctionHash, loadContext, stagedFingerprint } from './generate-content-correction-v2.mjs';

const ROOT = join(import.meta.dirname, '..');
const STAGING_DIR = join(ROOT, 'packages', 'core-db', 'staging');
const SCHEMA_DIR = join(ROOT, 'packages', 'core-db', 'src', 'schema');
const OVERLAY = join(STAGING_DIR, 'movement_content_correction_v2.json');
const MANIFEST = join(STAGING_DIR, 'movement_content_correction_v2_manifest.json');
const MIGRATIONS_TS = join(ROOT, 'packages', 'core-db', 'src', 'migrations.ts');
const MIGRATION_068 = '068_movement_content_correction_v2.sql';
const SHEET = join(ROOT, 'docs', 'audits', 'coaching-goals', 'CORRECTION_V2_OWNER_REVIEW_SHEET.md');
const EXPECTED_RECORDS = 115;
const HELD_IDS = [135, 187];

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const terminal = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);
const joined = (lines) => lines.map((line) => terminal(line.trim())).join(' ');
/** Plain code-point order, the order generate-content-correction-v2.mjs numbers the migration in. */
const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
const cell = (text) => String(text).replace(/\|/g, '\\|');

/** The runtime's migration files, in the order migrations.ts applies them. */
function migrationFiles() {
  const source = readFileSync(MIGRATIONS_TS, 'utf8');
  const fileOf = new Map([...source.matchAll(/^import (m\d{3}) from '\.\/schema\/([^']+\.sql)';$/gm)].map((m) => [m[1], m[2]]));
  const list = source.match(/const MIGRATIONS: readonly string\[\] = \[([^\]]+)\]/);
  if (list === null) throw new Error('MIGRATIONS list not found in migrations.ts');
  return list[1].split(',').map((name) => {
    const file = fileOf.get(name.trim());
    if (file === undefined) throw new Error(`no import for ${name.trim()} in migrations.ts`);
    return file;
  });
}

/** Coaching text per movement name in a database migrated through `lastFile` (inclusive). */
function coachingTextThrough(lastFile) {
  const files = migrationFiles();
  if (!files.includes(lastFile)) throw new Error(`not a migration: ${lastFile}`);
  const db = new DatabaseSync(':memory:');
  for (const file of files) {
    db.exec(readFileSync(join(SCHEMA_DIR, file), 'utf8'));
    if (file === lastFile) break;
  }
  const rows = db.prepare(`
    SELECT m.movement_id AS id, m.name AS name, d.instructions AS instructions, d.cues AS cues,
           ci.coaching_intent AS intent
    FROM movement m
    JOIN movement_detail d ON d.movement_id = m.movement_id
    LEFT JOIN movement_coaching_intent ci ON ci.movement_id = m.movement_id`).all();
  db.close();
  return new Map(rows.map((row) => [row.name, row]));
}

function build() {
  const errors = [];
  const overlay = readJson(OVERLAY);
  const manifest = readJson(MANIFEST);
  const context = loadContext();
  const records = [...overlay.records].sort(byName);
  const manifestHash = new Map(manifest.records.map((r) => [r.name, r.correction_sha256]));
  const migrationText = readFileSync(join(SCHEMA_DIR, MIGRATION_068), 'utf8');
  const before = coachingTextThrough('067_sport_and_emphasis.sql');
  const after = coachingTextThrough(MIGRATION_068);

  if (records.length !== EXPECTED_RECORDS) errors.push(`expected ${EXPECTED_RECORDS} records, found ${records.length}`);
  if (overlay.ratification?.state !== 'pending_owner_review') errors.push(`ratification.state is ${overlay.ratification?.state}, not pending_owner_review`);

  const rows = records.map((record, index) => {
    const at = `${String(index + 1).padStart(3, '0')} ${record.name}`;
    const staged = context.staged.get(record.name);
    const was = before.get(record.name);
    const now = after.get(record.name);
    const { coaching_intent: intent, setup_steps: steps, cues } = record.changes.coaching;
    if (ANIMATION_LANE_NAMES.includes(record.name)) errors.push(`${at}: an animation-lane movement is in the set`);
    if (record.ratification !== null) errors.push(`${at}: carries a ratification field`);
    if (correctionHash(record) !== record.correction_sha256) errors.push(`${at}: correction_sha256 does not reproduce`);
    if (manifestHash.get(record.name) !== record.correction_sha256) errors.push(`${at}: correction_sha256 differs from the manifest`);
    if (staged === undefined) { errors.push(`${at}: no staged v2 row`); return null; }
    if (record.supersedes_v2_sha256 !== stagedFingerprint(staged)) errors.push(`${at}: supersedes_v2_sha256 is not the staged row's fingerprint`);
    if (was === undefined || now === undefined) { errors.push(`${at}: not in the migrated database`); return null; }
    if (HELD_IDS.includes(was.id)) errors.push(`${at}: movement ${was.id} is held`);
    if (was.instructions !== joined(staged.setupSteps) || was.cues !== joined(staged.cues) || was.intent !== staged.coachingIntent) {
      errors.push(`${at}: the database after 067 does not hold the staged text shown as "before"`);
    }
    if (now.instructions !== joined(steps) || now.cues !== joined(cues) || now.intent !== intent.trim()) {
      errors.push(`${at}: the database after 068 does not hold the correction shown as "after"`);
    }
    if (!migrationText.includes(`-- ${String(index + 1).padStart(3, '0')} · ${record.name}\n`)) errors.push(`${at}: number and name do not match the migration's section header`);
    return { number: String(index + 1).padStart(3, '0'), id: was.id, record, staged };
  });
  for (const id of HELD_IDS) {
    const held = [...before.values()].find((row) => row.id === id);
    if (held !== undefined && records.some((r) => r.name === held.name)) errors.push(`movement ${id} (${held.name}) is in the set`);
  }
  if (errors.length > 0) return { errors };
  return { errors, text: render(rows.filter(Boolean)) };
}

function render(rows) {
  const out = [];
  out.push('# Correction v2: owner review sheet');
  out.push('');
  out.push('Generated by `node scripts/render-correction-v2-review-sheet.mjs --write`. Do not edit by hand.');
  out.push('');
  out.push(`Migration 068 replaces the shared "Set up <name> with ..." coaching text on ${rows.length} movements. It is already on \`master\`, so a build from \`master\` shows the **After** text. Every record is still \`pending_owner_review\`: none carries an owner approval, and the set is a release blocker until each record is approved or corrected (\`packages/core-db/staging/movement_content_correction_v2.json\`, \`ratification.note\`). This sheet is a reading aid. It records nothing, and marking it changes nothing in the app. An approval or correction ships in a new migration slot; 068 itself is never edited.`);
  out.push('');
  out.push('Checked for every row before this sheet was written:');
  out.push('');
  out.push('- the correction hash reproduces and equals the manifest;');
  out.push('- **Before** is the staged text the record supersedes (fingerprint match), and the database built through migration 067 holds exactly that text;');
  out.push('- **After** is exactly what the database holds after migration 068;');
  out.push('- the number and name match the migration\'s own section header;');
  out.push('- movements 135 and 187 (Barbell and Dumbbell Incline Shoulder Raise, held by the animation lane) are not in the set.');
  out.push('');
  out.push('Scope of each correction: the coaching intent, the setup steps and the cues. No name, id, pattern, difficulty, equipment, media or preview changes.');
  out.push('');
  out.push('## Decisions');
  out.push('');
  out.push('| No. | Id | Movement | correction_sha256 | Decision |');
  out.push('| ---: | ---: | --- | --- | --- |');
  for (const row of rows) out.push(`| ${row.number} | ${row.id} | [${cell(row.record.name)}](#${row.number}) | \`${row.record.correction_sha256.slice(0, 12)}\` |  |`);
  out.push('');
  out.push('## The text, movement by movement');
  for (const row of rows) {
    const { coaching_intent: intent, setup_steps: steps, cues } = row.record.changes.coaching;
    out.push('');
    out.push(`<a id="${row.number}"></a>`);
    out.push(`### ${row.number} · ${row.record.name} (movement ${row.id})`);
    out.push('');
    out.push(`\`correction_sha256 ${row.record.correction_sha256}\``);
    out.push('');
    out.push('**Before** (the shared template, as the migrations up to 067 leave it)');
    out.push('');
    out.push(`- Intent: ${row.staged.coachingIntent}`);
    out.push('- Steps:');
    row.staged.setupSteps.forEach((step, i) => out.push(`  ${i + 1}. ${step}`));
    out.push(`- Cues: ${row.staged.cues.join(' · ')}`);
    out.push('');
    out.push('**After** (written by migration 068)');
    out.push('');
    out.push(`- Intent: ${intent}`);
    out.push('- Steps:');
    steps.forEach((step, i) => out.push(`  ${i + 1}. ${step}`));
    out.push(`- Cues: ${cues.join(' · ')}`);
    out.push('');
    out.push('Decision:');
  }
  out.push('');
  return out.join('\n');
}

function main() {
  const mode = process.argv[2];
  if (mode !== '--write' && mode !== '--check') {
    console.error('usage: node scripts/render-correction-v2-review-sheet.mjs --write|--check');
    process.exit(2);
  }
  const { errors, text } = build();
  if (errors.length > 0) {
    for (const error of errors) console.error(`FAIL  ${error}`);
    console.error(`correction v2 review sheet: ${errors.length} check(s) failed; sheet not written`);
    process.exit(1);
  }
  if (mode === '--write') {
    writeFileSync(SHEET, text);
    console.log(`correction v2 review sheet: wrote ${EXPECTED_RECORDS} rows, every check passed`);
    return;
  }
  if (!existsSync(SHEET) || readFileSync(SHEET, 'utf8') !== text) {
    console.error('correction v2 review sheet: the sheet is stale or missing. Run --write.');
    process.exit(1);
  }
  console.log(`correction v2 review sheet: ${EXPECTED_RECORDS} rows, every check passed, sheet current`);
}

main();
