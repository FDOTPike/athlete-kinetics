import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  contentFingerprint,
  renderMigration,
  seededMovementIndex,
  validateCoachingContent,
} from './generate-coaching-intent-migration.mjs';

let checks = 0;
const check = (label, fn) => {
  checks += 1;
  fn();
  console.log(`  [${checks}] PASS ${label}`);
};

const known = seededMovementIndex({ slots: { '016': ['Plank'] } });
const valid = {
  name: 'Plank',
  coachingIntent: 'Build a stable trunk for controlled, repeatable effort.',
  setupSteps: ['Set your elbows beneath your shoulders', 'Press the floor away and brace your trunk'],
  cues: ['Keep a long line from head to heel'],
  videoUrl: 'https://www.youtube.com/watch?v=AbCdEfGhI_J',
  videoVerified: true,
};

check('accepts complete curator-attested coaching content and normalizes sentence endings', () => {
  const result = validateCoachingContent([valid], known);
  assert.deepEqual(result.errors, []);
  assert.equal(result.fresh.length, 1);
  assert.equal(result.fresh[0].instructions, 'Set your elbows beneath your shoulders. Press the floor away and brace your trunk.');
  assert.equal(result.fresh[0].cues, 'Keep a long line from head to heel.');
});

check('rejects fewer than two setup steps', () => {
  const result = validateCoachingContent([{ ...valid, setupSteps: [valid.setupSteps[0]] }], known);
  assert.match(result.errors.join('\n'), /setupSteps must contain 2\.\.4/);
});

check('rejects prohibitive rather than positive cue language', () => {
  const result = validateCoachingContent([{ ...valid, cues: ["Don't let your hips sag"] }], known);
  assert.match(result.errors.join('\n'), /positive-intention/);
});

check('rejects non-canonical or unattested video URLs', () => {
  const wrongShape = validateCoachingContent([{ ...valid, videoUrl: 'https://youtu.be/AbCdEfGhI_J' }], known);
  assert.match(wrongShape.errors.join('\n'), /videoUrl must be/);
  const unattested = validateCoachingContent([{ ...valid, videoVerified: false }], known);
  assert.match(unattested.errors.join('\n'), /videoVerified: true/);
});

check('accepts unchanged emitted records but rejects silent revisions', () => {
  const { fresh, errors } = validateCoachingContent([valid], known);
  assert.deepEqual(errors, []);
  const emitted = new Map([['plank', contentFingerprint(fresh[0])]]);
  const unchanged = validateCoachingContent([valid], known, emitted);
  assert.deepEqual(unchanged.errors, []);
  assert.deepEqual(unchanged.fresh, []);
  const revised = validateCoachingContent([{ ...valid, coachingIntent: 'A deliberately revised intent.' }], known, emitted);
  assert.match(revised.errors.join('\n'), /changed after emission/);
});

check('rejects unknown movement names', () => {
  const unknown = validateCoachingContent([{ ...valid, name: 'Unknown Movement' }], known);
  assert.match(unknown.errors.join('\n'), /not a currently seeded movement/);
});

check('renders one additive migration that writes intents and movement detail', () => {
  const { fresh, errors } = validateCoachingContent([valid], known);
  assert.deepEqual(errors, []);
  const sql = renderMigration('024', fresh);
  assert.match(sql, /INSERT INTO movement_coaching_intent/);
  assert.match(sql, /UPDATE movement_detail AS d/);
  assert.match(sql, /video_placeholder_uri = c\.video_uri/);
  assert.match(sql, /ON CONFLICT\(movement_id\) DO UPDATE/);
});

check('generated SQL executes twice and atomically updates intent plus movement detail', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  try { db.prepare('SELECT ln(2.0), sqrt(2.0)').get(); } catch {
    db.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
    db.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
  }
  const schemaDir = join(import.meta.dirname, '..', 'packages', 'core-db', 'src', 'schema');
  for (const file of readdirSync(schemaDir).filter((name) => /^\d{3}_.*\.sql$/.test(name) && !name.startsWith('004_')).sort()) {
    db.exec(readFileSync(join(schemaDir, file), 'utf8'));
  }
  const { fresh, errors } = validateCoachingContent([valid], known);
  assert.deepEqual(errors, []);
  const sql = renderMigration('024', fresh);
  db.exec(sql);
  db.exec(sql);
  const row = db.prepare(`
    SELECT i.coaching_intent, d.instructions, d.cues, d.video_placeholder_uri
    FROM movement m
    JOIN movement_coaching_intent i USING(movement_id)
    JOIN movement_detail d USING(movement_id)
    WHERE m.name = 'Plank'
  `).get();
  assert.equal(row.coaching_intent, valid.coachingIntent);
  assert.equal(row.instructions, 'Set your elbows beneath your shoulders. Press the floor away and brace your trunk.');
  assert.equal(row.cues, 'Keep a long line from head to heel.');
  assert.equal(row.video_placeholder_uri, valid.videoUrl);
});
console.log(`coaching-content generator — all ${checks} checks green`);