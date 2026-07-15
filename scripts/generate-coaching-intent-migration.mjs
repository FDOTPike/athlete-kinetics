/**
 * generate-coaching-intent-migration.mjs — Phase 17 reviewed guided-content
 * codegen. It owns additive coaching migrations so curation never hand-edits
 * SQL or silently targets an unseeded movement.
 *
 * Staging entry contract:
 *   { name, coachingIntent, setupSteps, cues, videoUrl, videoVerified: true }
 *
 * `videoVerified` is a curator attestation: the generator can enforce a
 * canonical YouTube URL shape, but cannot truthfully verify a video remotely.
 *
 * Usage:
 *   node scripts/generate-coaching-intent-migration.mjs
 *   node scripts/generate-coaching-intent-migration.mjs --check
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(import.meta.dirname, '..');
const STAGING = join(ROOT, 'packages', 'core-db', 'staging', 'movement_coaching_intent.json');
const MANIFEST = join(ROOT, 'packages', 'core-db', 'staging', 'movement_coaching_intent_manifest.json');
const SEEDED = join(ROOT, 'packages', 'core-db', 'staging', 'seeded_manifest.json');
const SCHEMA_DIR = join(ROOT, 'packages', 'core-db', 'src', 'schema');

// The 30 rows that predate staged curation. Later seedable rows come from the
// manifest that the movement-batch generator maintains.
const SHIPPED_MOVEMENTS = [
  'Competition Squat', 'Deadlift', 'Competition Bench', 'Overhead Press',
  'Barbell Row', 'Weighted Pull-up', 'BJJ Sparring Round', 'Front Squat',
  'Romanian Deadlift', 'Dumbbell Bench Press', 'Dumbbell Shoulder Press',
  'Single-Arm Dumbbell Row', 'Chin-up', 'Goblet Squat', 'Kettlebell Swing',
  'Push-up', 'Walking Lunge', 'Bulgarian Split Squat', 'Farmer Carry',
  'Suitcase Carry', 'Lat Pulldown', 'Cable Row', 'Nordic Curl',
  'Band Pull-Apart', 'Pallof Press', 'Plank', 'Road Run', 'Bodyweight Squat',
  'Glute Bridge', 'Band Row',
];

export const CANONICAL_YOUTUBE_URL = /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/;
const NEGATIVE_CUE = /\b(?:don't|do not|never|avoid|stop|no)\b/i;
const BANNED_CLAIM = /\b(cure|heal(?:s|ing)?|guarantee|injury[- ]proof|prevent(?:s|ing)? injur|bulletproof|pain[- ]free|insurance|pays out|burn(?:s)? fat|melt|shred your|doctor|medical|prescription|diagnos|therap)\b/i;

const q = (value) => `'${String(value).replace(/'/g, "''")}'`;
const normalizeName = (name) => name.trim().toLocaleLowerCase('en-US');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const asText = (value) => typeof value === 'string' ? value.trim() : null;
const terminal = (text) => /[.!?]$/.test(text) ? text : `${text}.`;

function isSingleSentence(text) {
  const marks = [...text.matchAll(/[.!?]+/g)];
  return marks.length === 0 || (marks.length === 1 && marks[0].index + marks[0][0].length === text.length);
}

export function seededMovementIndex(seedManifest) {
  const known = new Map();
  for (const name of [...SHIPPED_MOVEMENTS, ...Object.values(seedManifest.slots).flat()]) {
    known.set(normalizeName(name), name);
  }
  return known;
}

/**
 * Validate reviewed content without touching the filesystem. `known` maps
 * normalized names to canonical names; `emitted` contains normalized names
 * already frozen into a prior generated migration.
 */
export function validateCoachingContent(entries, known, emitted = new Map()) {
  const errors = [];
  const fresh = [];
  if (!Array.isArray(entries)) return { errors: ['staging.movements must be an array'], fresh };

  const seen = new Set();
  for (const [index, entry] of entries.entries()) {
    const prefix = `entry ${index}`;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    const inputName = asText(entry.name);
    const coachingIntent = asText(entry.coachingIntent);
    const nameKey = inputName === null ? '' : normalizeName(inputName);
    if (nameKey === '') {
      errors.push(`${prefix} needs a non-empty name`);
      continue;
    }
    if (seen.has(nameKey)) {
      errors.push(`duplicate coaching-content entry: ${inputName}`);
      continue;
    }
    seen.add(nameKey);
    const canonicalName = known.get(nameKey);
    if (canonicalName === undefined) {
      errors.push(`not a currently seeded movement: ${inputName}`);
      continue;
    }

    if (coachingIntent === null || coachingIntent.length < 1 || coachingIntent.length > 160) {
      errors.push(`${prefix} coachingIntent must contain 1..160 characters`);
      continue;
    }
    if (!Array.isArray(entry.setupSteps) || entry.setupSteps.length < 2 || entry.setupSteps.length > 4) {
      errors.push(`${prefix} setupSteps must contain 2..4 steps`);
      continue;
    }
    if (!Array.isArray(entry.cues) || entry.cues.length < 1 || entry.cues.length > 3) {
      errors.push(`${prefix} cues must contain 1..3 positive cues`);
      continue;
    }
    const setupSteps = entry.setupSteps.map(asText);
    const cues = entry.cues.map(asText);
    if (setupSteps.some((step) => step === null || step.length === 0 || !isSingleSentence(step))) {
      errors.push(`${prefix} each setup step must be one non-empty sentence`);
      continue;
    }
    if (cues.some((cue) => cue === null || cue.length === 0 || !isSingleSentence(cue))) {
      errors.push(`${prefix} each cue must be one non-empty sentence`);
      continue;
    }
    if (cues.some((cue) => NEGATIVE_CUE.test(cue))) {
      errors.push(`${prefix} cues must be positive-intention commands (no prohibitions)`);
      continue;
    }
    const bodyText = [coachingIntent, ...setupSteps, ...cues].join(' ');
    if (BANNED_CLAIM.test(bodyText)) {
      errors.push(`${prefix} contains a prohibited medical or performance claim`);
      continue;
    }
    const videoUrl = asText(entry.videoUrl);
    if (videoUrl === null || !CANONICAL_YOUTUBE_URL.test(videoUrl)) {
      errors.push(`${prefix} videoUrl must be https://www.youtube.com/watch?v=<11 chars>`);
      continue;
    }
    if (entry.videoVerified !== true) {
      errors.push(`${prefix} requires videoVerified: true after curator review`);
      continue;
    }
    const row = {
      name: canonicalName,
      coachingIntent,
      instructions: setupSteps.map(terminal).join(' '),
      cues: cues.map(terminal).join(' '),
      videoUrl,
    };
    const emittedHash = emitted.get(nameKey);
    if (emittedHash !== undefined) {
      if (emittedHash !== contentFingerprint(row)) {
        errors.push(`coaching content changed after emission for ${canonicalName}; create a dedicated correction migration`);
      }
      continue;
    }
    fresh.push(row);
  }
  return { errors, fresh };
}

export function contentFingerprint(row) {
  return createHash('sha256').update(JSON.stringify({
    name: row.name,
    coachingIntent: row.coachingIntent,
    instructions: row.instructions,
    cues: row.cues,
    videoUrl: row.videoUrl,
  })).digest('hex');
}

function emittedContentIndex(manifest) {
  if (manifest.slots === null || typeof manifest.slots !== 'object' || Array.isArray(manifest.slots)) {
    throw new Error('manifest.slots must be an object');
  }
  const emitted = new Map();
  for (const records of Object.values(manifest.slots)) {
    if (!Array.isArray(records)) throw new Error('manifest slot values must be arrays');
    for (const record of records) {
      if (record === null || typeof record !== 'object' || Array.isArray(record)
        || typeof record.name !== 'string' || !/^[a-f0-9]{64}$/.test(record.content_sha256 ?? '')) {
        throw new Error('manifest records need name and lowercase content_sha256');
      }
      const key = normalizeName(record.name);
      if (emitted.has(key)) throw new Error(`duplicate emitted coaching-content record: ${record.name}`);
      emitted.set(key, record.content_sha256);
    }
  }
  return emitted;
}
function cte(rows) {
  return [
    'WITH reviewed_content (movement_name, coaching_intent, instructions, cues, video_uri) AS (',
    '  VALUES',
    rows.map((row) => `  (${q(row.name)}, ${q(row.coachingIntent)}, ${q(row.instructions)}, ${q(row.cues)}, ${q(row.videoUrl)})`).join(',\n'),
    ')',
  ];
}

export function renderMigration(slot, rows) {
  const contentCte = cte(rows);
  return [
    '-- =============================================================================',
    `-- ${slot}_movement_coaching_content.sql`,
    '-- Phase 17 reviewed movement coaching content (GENERATED).',
    '-- Source: packages/core-db/staging/movement_coaching_intent.json',
    '-- Additive + idempotent. Revisions require a new correction migration.',
    '-- =============================================================================',
    '',
    ...contentCte,
    'INSERT INTO movement_coaching_intent (movement_id, coaching_intent)',
    'SELECT m.movement_id, c.coaching_intent',
    'FROM reviewed_content AS c',
    'JOIN movement AS m ON m.name = c.movement_name',
    'WHERE 1',
    'ON CONFLICT(movement_id) DO UPDATE SET coaching_intent = excluded.coaching_intent;',
    '',
    ...contentCte,
    'UPDATE movement_detail AS d',
    'SET instructions = c.instructions,',
    '    cues = c.cues,',
    '    video_placeholder_uri = c.video_uri',
    'FROM reviewed_content AS c',
    'JOIN movement AS m ON m.name = c.movement_name',
    'WHERE d.movement_id = m.movement_id;',
    '',
  ].join('\n');
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const staged = readJson(STAGING);
  const manifest = readJson(MANIFEST);
  const seeded = readJson(SEEDED);
  const emitted = emittedContentIndex(manifest);
  const { errors, fresh } = validateCoachingContent(staged.movements, seededMovementIndex(seeded), emitted);
  if (errors.length > 0) {
    console.error(`ABORT:\n  ${errors.join('\n  ')}`);
    process.exit(1);
  }
  if (fresh.length === 0) {
    console.log('nothing to do: no newly reviewed coaching-content records');
    return;
  }
  if (checkOnly) {
    console.error(`ABORT: ${fresh.length} reviewed coaching-content record(s) are staged but not emitted; run the generator and wire its new migration.`);
    process.exit(1);
  }

  fresh.sort((a, b) => a.name.localeCompare(b.name));
  const onDisk = readdirSync(SCHEMA_DIR)
    .map((file) => Number(file.slice(0, 3)))
    .filter((slot) => Number.isFinite(slot));
  const slot = String(Math.max(...onDisk, ...Object.keys(manifest.slots).map(Number)) + 1).padStart(3, '0');
  const output = join(SCHEMA_DIR, `${slot}_movement_coaching_content.sql`);
  if (existsSync(output)) throw new Error(`Refusing to overwrite existing migration: ${output}`);

  writeFileSync(output, renderMigration(slot, fresh));
  manifest.slots[slot] = fresh.map((row) => ({ name: row.name, content_sha256: contentFingerprint(row) }));
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${output}: ${fresh.length} reviewed coaching-content records`);
  console.log(`manifest updated (slot ${slot}). NEXT: import m${slot} in packages/core-db/src/migrations.ts and extend the migration/library gates.`);
}

const invokedDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();