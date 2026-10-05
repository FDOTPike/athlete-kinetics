/**
 * Phase 2a movement-library codegen.
 *
 * `--write` bootstraps the frozen target, v2 coaching/media manifests, staging
 * curation, migration 036, and twelve additive curation migrations. A write
 * refuses to touch any migration already present in HEAD. `--check` renders
 * every owned artifact in memory and fails on drift.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGET_GROUPS, TARGET_NAMES } from './library-target-v1.mjs';

const ROOT = join(import.meta.dirname, '..');
const STAGING_DIR = join(ROOT, 'packages', 'core-db', 'staging');
const SCHEMA_DIR = join(ROOT, 'packages', 'core-db', 'src', 'schema');
const IMPORT_PATH = join(STAGING_DIR, 'movement_import.json');
const QUARANTINE_PATH = join(STAGING_DIR, 'movement_quarantine.json');
const SEEDED_PATH = join(STAGING_DIR, 'seeded_manifest.json');
const LEGACY_CONTENT_MANIFEST_PATH = join(STAGING_DIR, 'movement_coaching_intent_manifest.json');
const TARGET_PATH = join(STAGING_DIR, 'library_target_v1.json');
const CONTENT_PATH = join(STAGING_DIR, 'movement_coaching_intent_v2.json');
const CONTENT_MANIFEST_PATH = join(STAGING_DIR, 'movement_coaching_intent_v2_manifest.json');
const MEDIA_PATH = join(STAGING_DIR, 'movement_media_manifest.json');
const FIRST_BATCH_SLOT = 37;
const BATCH_SIZES = [...Array(11).fill(15), 11];
const ORIGINAL_STAGING_SHA256 = 'aa8de27530f8b08a6c341b8a37b4659ceeab164183b50e6f16f4461a39d3c859';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const jsonText = (value, indent = 2) => `${JSON.stringify(value, null, indent)}\n`;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const q = (value) => `'${String(value).replace(/'/g, "''")}'`;
const terminal = (value) => /[.!?]$/.test(value) ? value : `${value}.`;
const slug = (value) => value
  .normalize('NFKD')
  .toLocaleLowerCase('en-US')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');
const familySlug = (value) => slug(value).replace(/-/g, '_');

export const contentFingerprintV2 = (record) => sha256(JSON.stringify({
  name: record.name,
  coachingIntent: record.coachingIntent,
  instructions: record.setupSteps.map(terminal).join(' '),
  cues: record.cues.map(terminal).join(' '),
}));

export const assetKeyForName = (name, collidingSlugs = new Set()) => {
  const base = slug(name);
  const stable = collidingSlugs.has(base) ? `${base}-${sha256(name).slice(0, 8)}` : base;
  return `movement/${stable}/demo/v1`;
};

const prefixEquipment = {
  BB: 'barbell',
  DB: 'dumbbells',
  KB: 'kettlebell',
  Banded: 'bands',
  Cable: 'cable_machine',
  Bodyweight: null,
};

const prefixImplement = {
  BB: 'barbell',
  DB: 'dumbbell',
  KB: 'kettlebell',
  Banded: 'band',
  Cable: 'cable',
  Bodyweight: 'bodyweight',
};

export function inferPattern(record) {
  const name = record.name;
  if (record.pattern === 'cardio') return 'locomotion';
  if (record.pattern === 'core') return 'rotation';
  if (record.pattern === 'squat') return 'squat';
  if (record.pattern === 'hinge') return 'hinge';
  if (record.pattern === 'accessory') {
    if (/Bent-Knee Hip Raise/i.test(name)) return 'rotation';
    if (/Glute.Ham|Hip Extension/i.test(name)) return 'hinge';
    return 'isolation';
  }
  if (record.pattern === 'row') {
    if (/Shrug/i.test(name)) return 'isolation';
    if (/Pulldown|Pullup|Pullover|Straight-Arm|Incline Pushdown|Upright/i.test(name)) return 'pull_v';
    return 'pull_h';
  }
  if (record.pattern === 'push') {
    if (/Pallof|Side Plank/i.test(name)) return 'rotation';
    if (/Shoulder Press|Military Press|Arnold Press|Seesaw Press|Kettlebell Press/i.test(name)) return 'push_v';
    return 'push_h';
  }
  if (record.pattern === 'unilateral') {
    if (/Lunge|Split Squat|Step-up/i.test(name)) return 'lunge';
    if (/Turkish Get-Up/i.test(name)) return 'rotation';
    if (/Swing|Clean/i.test(name)) return 'hinge';
    if (/Row/i.test(name)) return 'pull_h';
    if (/Shoulder Press/i.test(name)) return 'push_v';
    if (/Bench Press|Floor Press/i.test(name)) return 'push_h';
    return 'isolation';
  }
  throw new Error(`No 11-pattern mapping for ${record.name}`);
}

export function inferEquipment(record) {
  const equipment = new Set();
  for (const prefix of record.supported_prefixes) {
    if (!(prefix in prefixEquipment)) throw new Error(`Unsupported prefix ${prefix} on ${record.name}`);
    const item = prefixEquipment[prefix];
    if (item !== null) equipment.add(item);
  }
  const evidence = `${record.name} ${record.instructions_raw}`;
  if (/\bbarbell\b|\bEZ[- ]?bar\b/i.test(evidence)) equipment.add('barbell');
  if (/\bdumbbell/i.test(evidence)) equipment.add('dumbbells');
  if (/\bkettlebell/i.test(evidence)) equipment.add('kettlebell');
  if (/\bband(?:s|ed)?\b/i.test(evidence)) equipment.add('bands');
  if (/\bcable\b|pulley/i.test(evidence)) equipment.add('cable_machine');
  if (/\bbench\b/i.test(evidence) && !/Floor Press/i.test(record.name)) equipment.add('bench');
  if (/\brack\b|off Pins|Pin Press/i.test(evidence)) equipment.add('squat_rack');
  if (/pull.?up bar|chin.?up bar|\bPullup\b/i.test(evidence)) equipment.add('pullup_bar');
  return [...equipment].sort();
}

const cueTemplate = (record, pattern) => {
  const name = record.name;
  if (/Shrug/i.test(name)) {
    return ['Stand tall before the shrug.', 'Drive the shoulders up and back behind the ears.', 'Own the pause before lowering.'];
  }
  if (/Calf Raise/i.test(name)) {
    return ['Keep pressure through the ball of the foot.', 'Rise as tall as the ankle allows.', 'Lower through a controlled stretch.'];
  }
  if (/Wrist|Finger Curl/i.test(name)) {
    return ['Support the forearms before the rep.', 'Move through the wrists with a relaxed grip.', 'Own the full return.'];
  }
  if (/External Rotation|Internal Rotation/i.test(name)) {
    return ['Pin the elbow in place.', 'Rotate through an owned range.', 'Keep the torso quiet on the return.'];
  }
  if (/Curl/i.test(name)) {
    return ['Keep the upper arms quiet.', 'Curl through the forearms.', 'Own the lowering phase.'];
  }
  if (/Tricep|Triceps|Skull Crusher/i.test(name)) {
    return ['Aim the elbows through one steady line.', 'Extend through the forearms.', 'Control the return into the stretch.'];
  }
  if (/Raise|Flye|Flyes|Crossover/i.test(name)) {
    return ['Set the shoulder blades before moving.', 'Lead the rep through the elbows.', 'Lower with the same smooth path.'];
  }
  if (pattern === 'pull_h') {
    return ['Set the torso before the pull.', 'Lead with the elbows.', 'Pause with the upper back engaged.'];
  }
  if (pattern === 'pull_v') {
    return ['Set the shoulders before bending the elbows.', 'Pull through the elbows, not the hands.', 'Reach long under control.'];
  }
  if (pattern === 'push_h') {
    return ['Keep the chest open and shoulder blades set.', 'Stack the wrists over the press line.', 'Finish every rep through the same path.'];
  }
  if (pattern === 'push_v') {
    return ['Stay tall through the torso.', 'Stack the wrists over the elbows.', 'Finish overhead with a quiet ribcage.'];
  }
  if (pattern === 'squat') {
    return ['Brace before the descent.', 'Keep pressure through the whole foot.', 'Drive the floor away to stand.'];
  }
  if (pattern === 'hinge') {
    return ['Set the ribs down and brace first.', 'Send the hips back into the load.', 'Finish tall through the glutes.'];
  }
  if (pattern === 'lunge') {
    return ['Build a stable split stance.', 'Track the knee over the working foot.', 'Drive through the whole foot to finish.'];
  }
  if (pattern === 'rotation') {
    return ['Set the pelvis before the rep.', 'Move through a braced trunk.', 'Own the return without momentum.'];
  }
  return ['Set a repeatable starting position.', 'Keep every stride smooth and quiet.', 'Finish with the same posture you started with.'];
};

const actionTemplate = (record, pattern) => {
  const name = record.name;
  if (/Shrug/i.test(name)) return 'Raise the shoulders up and back, pause behind the ears, and lower through the same path.';
  if (/Calf Raise/i.test(name)) return 'Rise through the ball of the working foot, pause at the top, and lower the heel under control.';
  if (/Wrist|Finger Curl/i.test(name)) return 'Support the forearms and move the load through the available wrist or finger range without shifting the elbows.';
  if (/External Rotation|Internal Rotation/i.test(name)) return 'Keep the elbow anchored and rotate the forearm through the range the shoulder can own.';
  if (/Curl/i.test(name)) return 'Hold the upper arms still, curl the load through the forearms, and squeeze without lifting the shoulders.';
  if (/Tricep|Triceps|Skull Crusher/i.test(name)) return 'Keep the elbows organised while the forearms extend, then return into a controlled stretch.';
  if (/Raise|Flye|Flyes|Crossover/i.test(name)) return 'Move the arms through the intended arc with soft elbows and a shoulder position that stays set.';
  if (pattern === 'pull_h') return 'Reach into the start, then drive the elbows back until the upper back finishes the pull.';
  if (pattern === 'pull_v') return 'Set the shoulders before bending the elbows, then pull through the full available range.';
  if (pattern === 'push_h') return 'Lower into the working range with the shoulders supported, then press through the intended line.';
  if (pattern === 'push_v') return 'Organise the load at shoulder height, then press overhead while staying tall through the trunk.';
  if (pattern === 'squat') return 'Sit between the hips under control, keep pressure through the whole foot, and stand through the same path.';
  if (pattern === 'hinge') return 'Soften the knees, send the hips back until the posterior chain loads, and stand by driving the hips through.';
  if (pattern === 'lunge') return 'Move into a stable split stance, lower under control, and drive through the working foot to finish.';
  if (pattern === 'rotation') return 'Brace before moving, then complete the trunk action through a range you can own without momentum.';
  return 'Move at a sustainable pace while keeping each stride and change of direction deliberate.';
};

const faultTemplate = (record, pattern) => {
  const name = record.name;
  if (/Curl/i.test(name)) return 'When the shoulders roll forward or the elbows travel, the load is ahead of the curl; reset lighter.';
  if (/Tricep|Triceps/i.test(name)) return 'When the elbows chase the load, the extension has lost its line; shorten the range or load.';
  if (/Raise|Flye|Flyes|Crossover/i.test(name)) return 'When the torso swings, the load is stealing the rep; reset with less weight.';
  if (pattern === 'pull_h' || pattern === 'pull_v') return 'When the hands finish before the elbows, the load is too ambitious; reset and own the pull.';
  if (pattern === 'push_h' || pattern === 'push_v') return 'When the press path shifts or the setup lifts, the set is finished; reset before continuing.';
  if (pattern === 'squat' || pattern === 'lunge') return 'When foot pressure rolls away from the working base, shorten the range and rebuild the next rep.';
  if (pattern === 'hinge') return 'When the load leaves the hips and moves into the back, reduce the range or weight before the next rep.';
  if (pattern === 'rotation') return 'When momentum starts the rep, shorten the range and rebuild the brace.';
  return 'When posture or foot strike changes, slow the pace before continuing.';
};

export function curateRecord(record) {
  const pattern11 = inferPattern(record);
  const equipment = inferEquipment(record);
  const equipmentText = equipment.length === 0
    ? 'a stable bodyweight start position'
    : equipment.map((item) => item.replace(/_/g, ' ')).join(', ');
  const primary = (record.target_muscles[0] ?? 'working muscles').replace(/_/g, ' ');
  const setupSteps = [
    `Set up ${record.name} with ${equipmentText} and choose a load or range you can control.`,
    actionTemplate(record, pattern11),
    faultTemplate(record, pattern11),
  ];
  const coachingIntent = pattern11 === 'locomotion'
    ? `Build sustainable locomotion capacity with ${record.name} while keeping posture and foot strike repeatable across the interval.`
    : `Train ${primary} with the specific loading and range of ${record.name} while keeping each rep technically honest.`;
  const result = {
    name: record.name,
    coachingIntent,
    setupSteps,
    cues: cueTemplate(record, pattern11),
  };
  result.contentSha256 = contentFingerprintV2(result);
  return result;
}

const sourceFingerprint = (movementImport) => sha256(JSON.stringify({
  source: movementImport.source,
  imported_at: movementImport.imported_at,
  count: movementImport.count,
  movements: movementImport.movements.map((movement) => ({
    name: movement.name,
    base_name: movement.base_name,
    pattern: movement.pattern,
    supported_prefixes: movement.supported_prefixes,
    difficulty_rating: movement.difficulty_rating,
    target_muscles: movement.target_muscles,
    secondary_muscles: movement.secondary_muscles,
    is_compound: movement.is_compound,
    source: movement.source,
  })),
}));

const countBy = (records, pick) => Object.fromEntries([...records.reduce((map, record) => {
  const key = pick(record);
  map.set(key, (map.get(key) ?? 0) + 1);
  return map;
}, new Map()).entries()].sort(([a], [b]) => a.localeCompare(b)));

const batchDefinitions = (names) => {
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  let offset = 0;
  return BATCH_SIZES.map((size, index) => {
    const batch = { slot: String(FIRST_BATCH_SLOT + index).padStart(3, '0'), names: sorted.slice(offset, offset + size) };
    offset += size;
    return batch;
  });
};

function validateInputs(movementImport, quarantine, seeded, legacyNames) {
  const errors = [];
  const targetSet = new Set(TARGET_NAMES);
  if (TARGET_NAMES.length !== 176 || targetSet.size !== 176) errors.push('target must contain exactly 176 unique names');
  const byName = new Map(movementImport.movements.map((record) => [record.name, record]));
  const priorSeededNames = Object.entries(seeded.slots)
    .filter(([slot]) => Number(slot) < FIRST_BATCH_SLOT)
    .flatMap(([, names]) => names);
  const already = new Set([...seeded.prefix_encoded, ...(seeded.do_not_seed ?? []), ...priorSeededNames]);
  const quarantineRecords = quarantine.entries ?? quarantine.movements ?? quarantine.records ?? quarantine;
  const quarantined = new Set(quarantineRecords.map?.((record) => record.name) ?? []);
  for (const name of TARGET_NAMES) {
    const record = byName.get(name);
    if (record === undefined) errors.push(`target is absent from mapped staging: ${name}`);
    if (already.has(name) || legacyNames.has(name)) errors.push(`target is already shipped or blocked: ${name}`);
    if (quarantined.has(name)) errors.push(`target leaks from quarantine: ${name}`);
    if (record?.curated === true && record.curation_version !== 2) errors.push(`target has conflicting prior curation: ${name}`);
    if (record !== undefined) {
      const firstPrefix = record.supported_prefixes[0];
      if (!(firstPrefix in prefixImplement)) errors.push(`unsupported first prefix on ${name}`);
      const equipment = inferEquipment(record);
      const required = prefixEquipment[firstPrefix];
      if (required !== null && !equipment.includes(required)) errors.push(`prefix/equipment mismatch on ${name}`);
      if (/\bchains?\b|exercise ball|smith machine/i.test(record.name)) {
        errors.push(`unsupported equipment evidence on ${name}`);
      }
    }
  }
  if (errors.length > 0) throw new Error(errors.join('\n'));
  return byName;
}

function renderTargetManifest(movementImport, records) {
  const existing = existsSync(TARGET_PATH) ? readJson(TARGET_PATH) : null;
  const batches = batchDefinitions(TARGET_NAMES);
  return {
    schemaVersion: 1,
    targetCount: 176,
    finalLibraryCount: 300,
    source: {
      url: movementImport.source,
      importedAt: movementImport.imported_at,
      stagingFileSha256AtSelection: existing?.source?.stagingFileSha256AtSelection ?? ORIGINAL_STAGING_SHA256,
      canonicalSourceSha256: sourceFingerprint(movementImport),
      upstreamRevision: 'unknown-preexisting-import',
    },
    selection: {
      scope: ['strength', 'bjj'],
      excluded: ['quarantine', 'do_not_seed', 'stretching', 'plyometric', 'olympic', 'strongman', 'unsupported_equipment', 'semantic_duplicates'],
      equipmentVocabularyExtended: false,
      beginnerWhitelistChanged: false,
      progressionGraphChanged: false,
    },
    balance: {
      sourceCategory: countBy(records, (record) => record.pattern),
      movementPattern: countBy(records, inferPattern),
      difficulty: countBy(records, (record) => record.difficulty_rating),
      primaryPrefix: countBy(records, (record) => record.supported_prefixes[0]),
      targetGroup: Object.fromEntries(Object.entries(TARGET_GROUPS).map(([group, names]) => [group, names.length])),
    },
    batches,
  };
}

const cteValues = (rows) => rows.join(',\n');

function renderMediaFoundation(legacyNames, mediaByName) {
  const rows = [...legacyNames].sort((a, b) => a.localeCompare(b)).map((name) =>
    `  (${q(name)}, ${q(mediaByName.get(name).assetKey)})`);
  return [
    '-- Phase 2a: stable media identity, separate from coaching copy and URI storage.',
    '-- Existing fallback URLs remain frozen in movement_detail.video_placeholder_uri.',
    'CREATE TABLE IF NOT EXISTS movement_media (',
    '  movement_id INTEGER PRIMARY KEY REFERENCES movement ON DELETE CASCADE,',
    '  asset_key   TEXT NOT NULL UNIQUE,',
    "  status      TEXT NOT NULL CHECK (status IN ('planned', 'external_fallback', 'ready')),",
    '  revision    INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1)',
    ') STRICT;',
    '',
    'INSERT INTO movement_media (movement_id, asset_key, status, revision)',
    "SELECT m.movement_id, e.column2, 'external_fallback', 1",
    'FROM (VALUES',
    cteValues(rows),
    ') AS e',
    'JOIN movement AS m ON m.name = e.column1',
    'ON CONFLICT(movement_id) DO UPDATE SET',
    '  asset_key = excluded.asset_key,',
    "  status = 'external_fallback',",
    '  revision = 1;',
    '',
  ].join('\n');
}

function renderBatch(slot, records, contentByName, mediaByName) {
  const movementRows = records.map((record) =>
    `  (${q(record.name)}, ${q(inferPattern(record))}, ${q(record.target_muscles[0] ?? 'full_body')}, ${record.is_compound ? 1 : 0})`);
  const detailRows = records.map((record) => {
    const content = contentByName.get(record.name);
    const muscles = [...new Set([...record.target_muscles, ...record.secondary_muscles])];
    return `  ((SELECT movement_id FROM movement WHERE name = ${q(record.name)}), ${q(record.base_name)}, ${q(JSON.stringify(record.supported_prefixes))}, ${q(record.difficulty_rating)}, ${q(JSON.stringify(muscles))}, ${q(content.setupSteps.map(terminal).join(' '))}, ${q(content.cues.map(terminal).join(' '))}, '')`;
  });
  const intentRows = records.map((record) => {
    const content = contentByName.get(record.name);
    return `  ((SELECT movement_id FROM movement WHERE name = ${q(record.name)}), ${q(content.coachingIntent)})`;
  });
  const taxonomyRows = records.map((record) =>
    `  ((SELECT movement_id FROM movement WHERE name = ${q(record.name)}), ${q(record.pattern)}, ${q(prefixImplement[record.supported_prefixes[0]])}, ${q(familySlug(record.base_name))})`);
  const equipmentRows = records.flatMap((record) => inferEquipment(record).map((item) =>
    `  ((SELECT movement_id FROM movement WHERE name = ${q(record.name)}), ${q(item)})`));
  const mediaRows = records.map((record) =>
    `  ((SELECT movement_id FROM movement WHERE name = ${q(record.name)}), ${q(mediaByName.get(record.name).assetKey)}, 'planned', 1)`);
  const timeRows = records.filter((record) => record.name === 'Trail Running/Walking');
  const lines = [
    '-- =============================================================================',
    `-- ${slot}_movement_library_v2_batch.sql`,
    `-- Phase 2a curated batch: ${records.length} movements (generated, additive, idempotent).`,
    '-- Coaching fingerprints deliberately exclude movement media.',
    '-- =============================================================================',
    '',
    'INSERT OR IGNORE INTO movement (name, pattern, primary_muscle, is_compound) VALUES',
    `${cteValues(movementRows)};`,
    '',
    'INSERT INTO movement_detail',
    '  (movement_id, base_name, supported_prefixes, difficulty_rating, target_muscles, instructions, cues, video_placeholder_uri)',
    'VALUES',
    cteValues(detailRows),
    'ON CONFLICT(movement_id) DO UPDATE SET',
    '  base_name = excluded.base_name,',
    '  supported_prefixes = excluded.supported_prefixes,',
    '  difficulty_rating = excluded.difficulty_rating,',
    '  target_muscles = excluded.target_muscles,',
    '  instructions = excluded.instructions,',
    '  cues = excluded.cues,',
    "  video_placeholder_uri = '';",
    '',
    'INSERT INTO movement_coaching_intent (movement_id, coaching_intent) VALUES',
    cteValues(intentRows),
    'ON CONFLICT(movement_id) DO UPDATE SET coaching_intent = excluded.coaching_intent;',
    '',
    'INSERT INTO movement_taxonomy (movement_id, category, implement, family) VALUES',
    cteValues(taxonomyRows),
    'ON CONFLICT(movement_id) DO UPDATE SET',
    '  category = excluded.category, implement = excluded.implement, family = excluded.family;',
    '',
  ];
  if (equipmentRows.length > 0) {
    lines.push(
      'INSERT OR IGNORE INTO movement_equipment (movement_id, item) VALUES',
      `${cteValues(equipmentRows)};`,
      '',
    );
  }
  lines.push(
    'INSERT INTO movement_media (movement_id, asset_key, status, revision) VALUES',
    cteValues(mediaRows),
    'ON CONFLICT(movement_id) DO UPDATE SET',
    "  asset_key = excluded.asset_key, status = 'planned', revision = 1;",
    '',
  );
  if (timeRows.length > 0) {
    const name = timeRows[0].name;
    lines.push(
      'INSERT INTO movement_logging_mode (movement_id, mode)',
      `VALUES ((SELECT movement_id FROM movement WHERE name = ${q(name)}), 'time')`,
      "ON CONFLICT(movement_id) DO UPDATE SET mode = 'time';",
      '',
      'INSERT INTO movement_time_policy (movement_id, default_sets, target_seconds)',
      `VALUES ((SELECT movement_id FROM movement WHERE name = ${q(name)}), 1, 1200)`,
      'ON CONFLICT(movement_id) DO UPDATE SET default_sets = 1, target_seconds = 1200;',
      '',
    );
  }
  return lines.join('\n');
}

const pathAtHead = (path) => {
  const rel = relative(ROOT, path).replaceAll('\\', '/');
  try {
    execFileSync('git', ['cat-file', '-e', `HEAD:${rel}`], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const compareOrWrite = (path, expected, write, migration = false) => {
  if (write) {
    if (migration && pathAtHead(path)) throw new Error(`Refusing to overwrite shipped migration: ${relative(ROOT, path)}`);
    writeFileSync(path, expected);
    return;
  }
  if (!existsSync(path)) throw new Error(`Missing generated artifact: ${relative(ROOT, path)}`);
  if (readFileSync(path, 'utf8') !== expected) throw new Error(`Generated artifact drift: ${relative(ROOT, path)}`);
};

export function generate({ write = false } = {}) {
  const movementImport = readJson(IMPORT_PATH);
  const quarantine = readJson(QUARANTINE_PATH);
  const seeded = readJson(SEEDED_PATH);
  const legacyManifest = readJson(LEGACY_CONTENT_MANIFEST_PATH);
  const legacyNames = new Set(Object.values(legacyManifest.slots).flat().map((record) => record.name));
  if (legacyNames.size !== 124) throw new Error(`Expected 124 legacy coaching rows, found ${legacyNames.size}`);
  const byName = validateInputs(movementImport, quarantine, seeded, legacyNames);
  const targetRecords = TARGET_NAMES.map((name) => byName.get(name));
  const targetManifest = renderTargetManifest(movementImport, targetRecords);
  const contentRecords = targetRecords.map(curateRecord).sort((a, b) => a.name.localeCompare(b.name));
  const contentByName = new Map(contentRecords.map((record) => [record.name, record]));

  const allNames = [...legacyNames, ...TARGET_NAMES];
  const slugCounts = countBy(allNames.map((name) => ({ name })), (record) => slug(record.name));
  const collidingSlugs = new Set(Object.entries(slugCounts).filter(([, count]) => count > 1).map(([key]) => key));
  const mediaRecords = allNames.sort((a, b) => a.localeCompare(b)).map((name) => ({
    name,
    assetKey: assetKeyForName(name, collidingSlugs),
    status: legacyNames.has(name) ? 'external_fallback' : 'planned',
    revision: 1,
    fallbackState: legacyNames.has(name) ? 'legacy_reviewed_url' : 'none',
  }));
  const mediaByName = new Map(mediaRecords.map((record) => [record.name, record]));
  if (new Set(mediaRecords.map((record) => record.assetKey)).size !== 300) throw new Error('Media asset keys are not unique');

  const batches = targetManifest.batches;
  const contentManifest = {
    schemaVersion: 2,
    fingerprintFields: ['name', 'coachingIntent', 'instructions', 'cues'],
    mediaExcluded: true,
    slots: Object.fromEntries(batches.map((batch) => [batch.slot, batch.names.map((name) => ({
      name,
      content_sha256: contentByName.get(name).contentSha256,
    }))])),
  };
  const mediaManifest = {
    schemaVersion: 1,
    keyFormat: 'movement/<canonical-kebab-name>/demo/v1',
    records: mediaRecords,
  };

  const curatedImport = structuredClone(movementImport);
  const curatedByName = new Map(curatedImport.movements.map((record) => [record.name, record]));
  for (const content of contentRecords) {
    const record = curatedByName.get(content.name);
    record.curated = true;
    record.curation_version = 2;
    record.instructions_raw = content.setupSteps.map(terminal).join(' ');
    record.cues = content.cues.map(terminal).join(' ');
    record.video_placeholder_uri = '';
  }

  const seededNext = structuredClone(seeded);
  for (const batch of batches) seededNext.slots[batch.slot] = batch.names;

  compareOrWrite(TARGET_PATH, jsonText(targetManifest), write);
  compareOrWrite(CONTENT_PATH, jsonText({ schemaVersion: 2, movements: contentRecords }), write);
  compareOrWrite(CONTENT_MANIFEST_PATH, jsonText(contentManifest), write);
  compareOrWrite(MEDIA_PATH, jsonText(mediaManifest), write);
  compareOrWrite(IMPORT_PATH, jsonText(curatedImport, 1), write);
  compareOrWrite(SEEDED_PATH, jsonText(seededNext, 1), write);
  compareOrWrite(join(SCHEMA_DIR, '036_movement_media.sql'), renderMediaFoundation(legacyNames, mediaByName), write, true);
  for (const batch of batches) {
    const records = batch.names.map((name) => byName.get(name));
    const path = join(SCHEMA_DIR, `${batch.slot}_movement_library_v2_batch.sql`);
    compareOrWrite(path, renderBatch(batch.slot, records, contentByName, mediaByName), write, true);
  }

  return { targetCount: TARGET_NAMES.length, finalCount: legacyNames.size + TARGET_NAMES.length, batchCount: batches.length };
}

const invokedDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const write = process.argv.includes('--write');
  const result = generate({ write });
  console.log(`${write ? 'wrote' : 'verified'} Phase 2a library artifacts: ${result.targetCount} targets, ${result.batchCount} batches, ${result.finalCount} total`);
}
