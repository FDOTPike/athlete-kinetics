/**
 * generate-batch-migration.mjs — P16+ additive curation migrations (017, 018, …).
 *
 * The 016 seed shipped and the chain is append-only, so each curation wave
 * lands as its OWN migration containing ONLY newly curated records.
 *
 * Usage: node scripts/generate-batch-migration.mjs
 *   - slot number = next free (max manifest slot + 1)
 *   - seeds curated staging records NOT present in staging/seeded_manifest.json
 *   - every new record MUST have PATTERN_11 + EQUIPMENT entries below (abort otherwise)
 *   - on success appends the slot to the manifest (the generator is then a no-op
 *     until new curation lands)
 *
 * Maps cover ONLY records new since 016 — grow them with each batch.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const STAGING = join(ROOT, 'packages', 'core-db', 'staging', 'movement_import.json');
const MANIFEST = join(ROOT, 'packages', 'core-db', 'staging', 'seeded_manifest.json');
const SCHEMA_DIR = join(ROOT, 'packages', 'core-db', 'src', 'schema');

/** staged name -> movement.pattern (001 CHECK domain) for post-016 records. */
const PATTERN_11 = {
  'Dumbbell Floor Press': 'push_h',
  'Cable Chest Press': 'push_h',
  'Incline Push-Up': 'push_h',
  'Barbell Shrug': 'isolation',
  'Renegade Row': 'pull_h',
  'Dumbbell Romanian Deadlift': 'hinge',
  'Single-Leg Romanian Deadlift': 'hinge',
  'Floor Back Extension': 'hinge',
  'Sit-Up': 'rotation',
  'Preacher Curl': 'isolation',
  'Dumbbell Front Raise': 'isolation',
  'Standing Barbell Calf Raise': 'isolation',
  'Lying Dumbbell Triceps Extension': 'isolation',
  'Cable Glute Kickback': 'isolation',
  'Double Kettlebell Push Press': 'push_v',
  'Band Good Morning': 'hinge',
  'Barbell Hack Squat': 'squat',
  'Cable Reverse Crunch': 'rotation',
  'Close-Grip Dumbbell Press': 'push_h',
  'Cuban Press': 'push_v',
  'Decline Dumbbell Bench Press': 'push_h',
  'One Arm Lat Pulldown': 'pull_v',
  'One-Arm Kettlebell Row': 'pull_h',
  'One-Arm Overhead Kettlebell Squat': 'squat',
  'Reverse Barbell Curl': 'isolation',
  'Reverse Grip Bent-Over Rows': 'pull_h',
  'V-Bar Pulldown': 'pull_v',
  'Zottman Curl': 'isolation',
  'Barbell Seated Calf Raise': 'isolation',
  'Calf Raises - With Bands': 'isolation',
  'Cable Hammer Curls - Rope Attachment': 'isolation',
  'Cable Internal Rotation': 'isolation',
  'Tuck Crunch': 'rotation',
  'Decline Crunch': 'rotation',
  'Cable Deadlifts': 'hinge',
  'Kettlebell Dead Clean': 'hinge',
  'Bent Press': 'push_v',
  'Cable Rope Overhead Triceps Extension': 'isolation',
  'Cable Rope Rear-Delt Rows': 'pull_h',
  'Barbell Rear Delt Row': 'pull_h',
  'Jefferson Squats': 'squat',
  'Narrow Stance Squats': 'squat',
  'Kneeling Single-Arm High Pulley Row': 'pull_h',
};

/** movement_equipment rows (007 vocabulary) for post-016 records. */
const EQUIPMENT = {
  'Dumbbell Floor Press': ['dumbbells'],
  'Cable Chest Press': ['cable_machine'],
  'Incline Push-Up': ['bench'],
  'Barbell Shrug': ['barbell'],
  'Renegade Row': ['dumbbells'],
  'Dumbbell Romanian Deadlift': ['dumbbells'],
  'Single-Leg Romanian Deadlift': ['kettlebell'],
  'Floor Back Extension': [],
  'Sit-Up': [],
  'Preacher Curl': ['barbell', 'bench'],
  'Dumbbell Front Raise': ['dumbbells'],
  'Standing Barbell Calf Raise': ['barbell', 'squat_rack'],
  'Lying Dumbbell Triceps Extension': ['dumbbells', 'bench'],
  'Cable Glute Kickback': ['cable_machine'],
  'Double Kettlebell Push Press': ['kettlebell'],
  'Band Good Morning': ['bands'],
  'Barbell Hack Squat': ['barbell'],
  'Cable Reverse Crunch': ['cable_machine'],
  'Close-Grip Dumbbell Press': ['dumbbells', 'bench'],
  'Cuban Press': ['dumbbells'],
  'Decline Dumbbell Bench Press': ['dumbbells', 'bench'],
  'One Arm Lat Pulldown': ['cable_machine'],
  'One-Arm Kettlebell Row': ['kettlebell'],
  'One-Arm Overhead Kettlebell Squat': ['kettlebell'],
  'Reverse Barbell Curl': ['barbell'],
  'Reverse Grip Bent-Over Rows': ['barbell'],
  'V-Bar Pulldown': ['cable_machine'],
  'Zottman Curl': ['dumbbells'],
  'Barbell Seated Calf Raise': ['barbell', 'bench'],
  'Calf Raises - With Bands': ['bands'],
  'Cable Hammer Curls - Rope Attachment': ['cable_machine'],
  'Cable Internal Rotation': ['cable_machine'],
  'Tuck Crunch': [],
  'Decline Crunch': ['bench'],
  'Cable Deadlifts': ['cable_machine'],
  'Kettlebell Dead Clean': ['kettlebell'],
  'Bent Press': ['kettlebell'],
  'Cable Rope Overhead Triceps Extension': ['cable_machine'],
  'Cable Rope Rear-Delt Rows': ['cable_machine'],
  'Barbell Rear Delt Row': ['barbell'],
  'Jefferson Squats': ['barbell'],
  'Narrow Stance Squats': ['barbell', 'squat_rack'],
  'Kneeling Single-Arm High Pulley Row': ['cable_machine'],
};

const IMPLEMENT = {
  BB: 'barbell', DB: 'dumbbell', KB: 'kettlebell',
  Bodyweight: 'bodyweight', Banded: 'band', Cable: 'cable',
};

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const doc = JSON.parse(readFileSync(STAGING, 'utf-8'));
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8'));
const already = new Set([
  ...manifest.prefix_encoded,
  ...(manifest.do_not_seed ?? []),   // true duplicates of shipped movements —
                                     // curated text is inert draft, never seeds
  ...Object.values(manifest.slots).flat(),
]);
const fresh = doc.movements
  .filter((m) => m.curated && !already.has(m.name))
  .sort((a, b) => a.name.localeCompare(b.name));

if (fresh.length === 0) {
  console.log('nothing to do: every curated record is already seeded');
  process.exit(0);
}

// Next free slot must clear the manifest AND every migration on disk —
// non-batch migrations (e.g. 018 logging modes) occupy slots too (audit P2).
const onDisk = readdirSync(SCHEMA_DIR)
  .map((f) => Number(f.slice(0, 3)))
  .filter((n) => Number.isFinite(n));
const slot = String(Math.max(...Object.keys(manifest.slots).map(Number), ...onDisk) + 1).padStart(3, '0');
const OUT = join(SCHEMA_DIR, `${slot}_movement_batch.sql`);
if (existsSync(OUT)) {
  console.error(`ABORT: ${OUT} already exists — shipped migrations are frozen.`);
  process.exit(1);
}

const errors = [];
for (const m of fresh) {
  if (PATTERN_11[m.name] === undefined) errors.push(`no PATTERN_11 entry: ${m.name}`);
  if (EQUIPMENT[m.name] === undefined) errors.push(`no EQUIPMENT entry: ${m.name}`);
  if (m.supported_prefixes.some((p) => IMPLEMENT[p] === undefined)) errors.push(`unmapped prefix on ${m.name}`);
  if (m.instructions_raw.trim() === '' || m.cues.trim() === '' || m.video_placeholder_uri.trim() === '') {
    errors.push(`incomplete curation: ${m.name}`);
  }
}
if (errors.length > 0) {
  console.error('ABORT:\n  ' + errors.join('\n  '));
  process.exit(1);
}

const L = [];
L.push('-- =============================================================================');
L.push(`-- ${slot}_movement_batch.sql`);
L.push(`-- Curation batch: ${fresh.length} movements from staging (GENERATED — regenerate`);
L.push('-- only before this migration ships; scripts/generate-batch-migration.mjs).');
L.push('-- Additive + idempotent (INSERT OR IGNORE), append-only chain, STRICT.');
L.push('-- =============================================================================');
L.push('');
L.push('INSERT OR IGNORE INTO movement (name, pattern, primary_muscle, is_compound) VALUES');
L.push(fresh.map((m) => {
  const primary = m.target_muscles[0] ?? null;
  return `  (${q(m.name)}, ${q(PATTERN_11[m.name])}, ${primary === null ? 'NULL' : q(primary)}, ${m.is_compound ? 1 : 0})`;
}).join(',\n') + ';');
L.push('');
L.push('INSERT OR IGNORE INTO movement_detail');
L.push('  (movement_id, base_name, supported_prefixes, difficulty_rating, target_muscles,');
L.push('   instructions, cues, video_placeholder_uri)');
L.push('SELECT m.movement_id, e.column2, e.column3, e.column4, e.column5, e.column6, e.column7, e.column8');
L.push('FROM (VALUES');
L.push(fresh.map((m) => {
  const muscles = JSON.stringify([...new Set([...m.target_muscles, ...m.secondary_muscles])]);
  return `  (${q(m.name)}, ${q(m.base_name)}, ${q(JSON.stringify(m.supported_prefixes))}, ${q(m.difficulty_rating)}, ${q(muscles)}, ${q(m.instructions_raw)}, ${q(m.cues)}, ${q(m.video_placeholder_uri)})`;
}).join(',\n') + ') AS e');
L.push('JOIN movement m ON m.name = e.column1;');
L.push('');
L.push('INSERT OR IGNORE INTO movement_taxonomy (movement_id, category, implement, family)');
L.push('SELECT m.movement_id, e.column2, e.column3, e.column4');
L.push('FROM (VALUES');
L.push(fresh.map((m) => `  (${q(m.name)}, ${q(m.pattern)}, ${q(IMPLEMENT[m.supported_prefixes[0]])}, ${q(slug(m.base_name))})`).join(',\n') + ') AS e');
L.push('JOIN movement m ON m.name = e.column1;');
L.push('');
const eqRows = fresh.flatMap((m) => EQUIPMENT[m.name].map((item) => ({ name: m.name, item })));
if (eqRows.length > 0) {
  L.push('INSERT OR IGNORE INTO movement_equipment (movement_id, item)');
  L.push('SELECT m.movement_id, e.column2');
  L.push('FROM (VALUES');
  L.push(eqRows.map((r) => `  (${q(r.name)}, ${q(r.item)})`).join(',\n') + ') AS e');
  L.push('JOIN movement m ON m.name = e.column1;');
  L.push('');
}
const chainRows = fresh
  .filter((m) => m.progression_group !== null)
  .map((m) => ({ name: m.name, group: m.progression_group, rank: m.progression_rank }));
if (chainRows.length > 0) {
  L.push('INSERT OR IGNORE INTO movement_progression (movement_id, progression_group, progression_rank)');
  L.push('SELECT m.movement_id, e.column2, e.column3');
  L.push('FROM (VALUES');
  L.push(chainRows.map((r) => `  (${q(r.name)}, ${q(r.group)}, ${r.rank})`).join(',\n') + ') AS e');
  L.push('JOIN movement m ON m.name = e.column1;');
  L.push('');
}

writeFileSync(OUT, L.join('\n'));
manifest.slots[slot] = fresh.map((m) => m.name);
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
console.log(`wrote ${OUT}: ${fresh.length} movements, ${eqRows.length} equipment rows, ${chainRows.length} progression rows`);
console.log(`manifest updated (slot ${slot}). NEXT: import m${slot} in packages/core-db/src/migrations.ts and update gate counts.`);
