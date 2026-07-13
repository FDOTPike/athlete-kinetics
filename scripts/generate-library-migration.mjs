/**
 * generate-library-migration.mjs — P16 S4: deterministic codegen for
 * schema/016_movement_library_seed.sql from the CURATED staging file.
 *
 * Usage: node scripts/generate-library-migration.mjs
 *
 * Rules (all decisions are data in this file, reviewable in one diff):
 *   - Seeds ONLY records with curated:true. Quarantine and uncurated staging
 *     rows never reach the DB.
 *   - Implement variants seed as their OWN rows with their own equipment
 *     (audit F3 — see the note below; deviation from 010 documented).
 *   - movement.pattern uses the 001 11-value biomechanical domain via the
 *     explicit PATTERN_11 map below (the staging 8-pattern taxonomy goes to
 *     movement_taxonomy.category instead).
 *   - movement_equipment is seeded for every implement-demanding row ("no
 *     rows = bodyweight" is load-bearing in the generator).
 *   - movement_progression is a new STRICT side-car (movement cannot gain
 *     columns idempotently); shipped rung-0/4 assignments live here too.
 *   - Ordering is name-sorted; output is byte-stable for a given staging file.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const STAGING = join(ROOT, 'packages', 'core-db', 'staging', 'movement_import.json');
const OUT = join(ROOT, 'packages', 'core-db', 'src', 'schema', '016_movement_library_seed.sql');

// AUDIT F3/F4 (2026-07-13): implement variants were previously represented as
// prefix widenings on shipped rows. That model cannot carry per-implement
// equipment (a cable-only athlete could never receive 'Cable' Overhead Press
// while the base row demands a barbell) and it silently discarded the
// variants' curated text. Variants are therefore seeded as their OWN rows
// with their own equipment — a documented deviation from the 010 prepend
// rationale, which predates equipment-aware variants. The shipped prefix
// arrays are left untouched (trimming them is an open decision for Francis).

/** staged name -> movement.pattern (001 CHECK domain). Explicit per record:
 *  push/row split into vertical/horizontal, core -> rotation, accessory ->
 *  isolation, unilateral -> lunge except single-leg squat/hinge patterns. */
const PATTERN_11 = {
  'Arnold Press': 'push_v',
  'Barbell Ab Rollout': 'rotation',
  'Barbell Curl': 'isolation',
  'Barbell Glute Bridge': 'hinge',
  'Barbell Walking Lunge': 'lunge',
  'Cable Shoulder Press': 'push_v',
  'Dumbbell Squat': 'squat',
  'Barbell Hip Thrust': 'hinge',
  'Barbell Step-Up': 'lunge',
  'Band External Rotation': 'isolation',
  'Bench Dip': 'push_h',
  'Box Squat': 'squat',
  'Cable Crunch': 'rotation',
  'Cable Pull-Through': 'hinge',
  'Chest-Supported Dumbbell Row': 'pull_h',
  'Close-Grip Bench Press': 'push_h',
  'Dead Bug': 'rotation',
  'Decline Bench Press': 'push_h',
  'Deficit Deadlift': 'hinge',
  'Dip': 'push_h',
  'Double Kettlebell Front Squat': 'squat',
  'Dumbbell Flye': 'push_h',
  'Dumbbell Lateral Raise': 'isolation',
  'Dumbbell Lunge': 'lunge',
  'Dumbbell Reverse Lunge': 'lunge',
  'Dumbbell Shrug': 'isolation',
  'Dumbbell Split Squat': 'lunge',
  'Dumbbell Step-Up': 'lunge',
  'Dumbbell Sumo Squat': 'squat',
  'Eccentric Wall Handstand Push-Up': 'push_v',
  'Face Pull': 'pull_h',
  'Feet-Elevated Push-Up': 'push_h',
  'Good Morning': 'hinge',
  'Hammer Curl': 'isolation',
  'Handstand Push-Up': 'push_v',
  'Hanging Leg Raise': 'rotation',
  'Incline Dumbbell Press': 'push_h',
  'Inverted Row': 'pull_h',
  'Kettlebell Pistol Squat': 'squat',
  'Kettlebell Turkish Get-Up': 'rotation',
  'Pike Push-Up': 'push_v',
  'Power Clean': 'hinge',
  'Pull-Up': 'pull_v',
  'Reverse Crunch': 'rotation',
  'Russian Twist': 'rotation',
  'Scapular Pull-Up': 'pull_v',
  'Single-Leg Glute Bridge': 'hinge',
  'Standing Dumbbell Calf Raise': 'isolation',
  'Straight-Arm Pulldown': 'pull_v',
  'Sumo Deadlift': 'hinge',
  'T-Bar Row': 'pull_h',
  'Triceps Pushdown': 'isolation',
  'Zercher Squat': 'squat',
};

/** MOVEMENT_PREFIXES token -> movement_taxonomy.implement CHECK member. */
const IMPLEMENT = {
  BB: 'barbell', DB: 'dumbbell', KB: 'kettlebell',
  Bodyweight: 'bodyweight', Banded: 'band', Cable: 'cable',
};

/** movement_equipment rows per seeded movement (007 item CHECK vocabulary).
 *  "No rows = bodyweight" is load-bearing in the generator, so every seeded
 *  movement MUST be mapped here — a missing entry aborts codegen. Proxies:
 *  'bench' stands in for box/step platforms, 'pullup_bar' for the dip
 *  station (the vocabulary has no dedicated tokens; flagged in the ledger). */
const EQUIPMENT = {
  'Arnold Press': ['dumbbells'],
  'Barbell Ab Rollout': ['barbell'],
  'Barbell Curl': ['barbell'],
  'Barbell Glute Bridge': ['barbell'],
  'Barbell Walking Lunge': ['barbell'],
  'Cable Shoulder Press': ['cable_machine'],
  'Dumbbell Squat': ['dumbbells'],
  'Barbell Hip Thrust': ['barbell', 'bench'],
  'Barbell Step-Up': ['barbell', 'squat_rack', 'bench'],
  'Band External Rotation': ['bands'],
  'Bench Dip': ['bench'],
  'Box Squat': ['barbell', 'squat_rack', 'bench'],
  'Cable Crunch': ['cable_machine'],
  'Cable Pull-Through': ['cable_machine'],
  'Chest-Supported Dumbbell Row': ['dumbbells', 'bench'],
  'Close-Grip Bench Press': ['barbell', 'bench'],
  'Dead Bug': [],
  'Decline Bench Press': ['barbell', 'bench'],
  'Deficit Deadlift': ['barbell'],
  'Dip': ['pullup_bar'],
  'Double Kettlebell Front Squat': ['kettlebell'],
  'Dumbbell Flye': ['dumbbells', 'bench'],
  'Dumbbell Lateral Raise': ['dumbbells'],
  'Dumbbell Lunge': ['dumbbells'],
  'Dumbbell Reverse Lunge': ['dumbbells'],
  'Dumbbell Shrug': ['dumbbells'],
  'Dumbbell Split Squat': ['dumbbells'],
  'Dumbbell Step-Up': ['dumbbells', 'bench'],
  'Dumbbell Sumo Squat': ['dumbbells'],
  'Eccentric Wall Handstand Push-Up': [],
  'Face Pull': ['cable_machine'],
  'Feet-Elevated Push-Up': ['bench'],
  'Good Morning': ['barbell', 'squat_rack'],
  'Hammer Curl': ['dumbbells'],
  'Handstand Push-Up': [],
  'Hanging Leg Raise': ['pullup_bar'],
  'Incline Dumbbell Press': ['dumbbells', 'bench'],
  'Inverted Row': ['barbell', 'squat_rack'],
  'Kettlebell Pistol Squat': ['kettlebell'],
  'Kettlebell Turkish Get-Up': ['kettlebell'],
  'Pike Push-Up': [],
  'Power Clean': ['barbell'],
  'Pull-Up': ['pullup_bar'],
  'Reverse Crunch': [],
  'Russian Twist': [],
  'Scapular Pull-Up': ['pullup_bar'],
  'Single-Leg Glute Bridge': [],
  'Standing Dumbbell Calf Raise': ['dumbbells'],
  'Straight-Arm Pulldown': ['cable_machine'],
  'Sumo Deadlift': ['barbell'],
  'T-Bar Row': ['barbell'],
  'Triceps Pushdown': ['cable_machine'],
  'Zercher Squat': ['barbell', 'squat_rack'],
};

/** Shipped rung assignments (rows live in the 007 seed, not staging). */
const SHIPPED_PROGRESSION = [
  { name: 'Push-up', group: 'handstand-push-up', rank: 0 },
  { name: 'Lat Pulldown', group: 'pull-up', rank: 0 },
  { name: 'Weighted Pull-up', group: 'pull-up', rank: 4 },
];

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// F4 DECISION (Francis, 2026-07-13): BB Glute Bridge / BB Walking Lunge stay
// PREFIX-ENCODED on the shipped rows (their BB tokens already exist) — no
// duplicate identity. Their barbell demand is invisible to the equipment
// filter; that hole is pre-existing to the prefix model and recorded in
// DEVIATION_LOG.md. The equipment-distinct variants (Cable Shoulder Press,
// Dumbbell Squat) remain rows.
const PREFIX_ENCODED = {
  'Barbell Glute Bridge': 'Glute Bridge',
  'Barbell Walking Lunge': 'Walking Lunge',
};

/** Plan P16 S4: "Beginner sees Beginner + whitelisted Intermediate staples."
 *  Ratified by Francis 2026-07-13 (no barbell lifts for beginners). */
const BEGINNER_WHITELIST = [
  // NOTE: Romanian Deadlift was proposed but DROPPED by the ratified rule
  // itself — it is a barbell lift (007 equipment: barbell), and the rule is
  // "beginners touch no barbell" (dumbbell/cable only). Caught by verify:library.
  'Dumbbell Bench Press',     // shipped
  'Dumbbell Shoulder Press',  // shipped
  'Incline Dumbbell Press',
  'Dumbbell Step-Up',
  'Dumbbell Split Squat',
  'Cable Shoulder Press',
  'Straight-Arm Pulldown',
  'Cable Crunch',
];
const SHIPPED_30 = new Set(['Dumbbell Bench Press', 'Dumbbell Shoulder Press']);

const doc = JSON.parse(readFileSync(STAGING, 'utf-8'));
const curated = doc.movements.filter((m) => m.curated);
const seeded = curated
  .filter((m) => PREFIX_ENCODED[m.name] === undefined)
  .sort((a, b) => a.name.localeCompare(b.name));

// -- validation before a single line is emitted ------------------------------
const errors = [];
for (const m of seeded) {
  if (PATTERN_11[m.name] === undefined) errors.push(`no PATTERN_11 entry: ${m.name}`);
  if (m.supported_prefixes.some((p) => IMPLEMENT[p] === undefined)) {
    errors.push(`unmapped implement token on ${m.name}`);
  }
  if (m.instructions_raw.trim() === '' || m.cues.trim() === '' || m.video_placeholder_uri.trim() === '') {
    errors.push(`incomplete curation reached codegen: ${m.name}`);
  }
  if (EQUIPMENT[m.name] === undefined) errors.push(`no EQUIPMENT entry: ${m.name}`);
}
for (const name of Object.keys(PREFIX_ENCODED)) {
  if (!curated.some((m) => m.name === name)) errors.push(`PREFIX_ENCODED not in staging: ${name}`);
}
for (const name of BEGINNER_WHITELIST) {
  if (SHIPPED_30.has(name)) continue;
  const rec = curated.find((m) => m.name === name && PREFIX_ENCODED[name] === undefined);
  if (rec === undefined) errors.push(`whitelist name not seeded: ${name}`);
  else if (rec.difficulty_rating !== 'Intermediate') errors.push(`whitelist is for Intermediate staples only: ${name} is ${rec.difficulty_rating}`);
}
if (errors.length > 0) {
  console.error('ABORT:\n  ' + errors.join('\n  '));
  process.exit(1);
}

// -- emit ---------------------------------------------------------------------
const L = [];
L.push('-- =============================================================================');
L.push('-- 016_movement_library_seed.sql');
L.push('-- Phase 16 S4: seeds the curated movement library from staging');
L.push('-- (packages/core-db/staging/movement_import.json).');
L.push('--');
L.push('-- GENERATED FILE — do not hand-edit. Regenerate with:');
L.push('--   node scripts/generate-library-migration.mjs');
L.push('--');
L.push(`-- ${seeded.length} curated movements seeded as rows (implement variants included`);
L.push('-- as rows with their own equipment — audit F3: the prefix model cannot');
L.push('-- carry per-implement equipment requirements).');
L.push('-- Idempotent (IF NOT EXISTS / INSERT OR IGNORE / constant UPDATE),');
L.push('-- append-only chain, STRICT.');
L.push('-- =============================================================================');
L.push('');
L.push('-- (1) movement rows (auto ids; name is UNIQUE COLLATE NOCASE).');
L.push('INSERT OR IGNORE INTO movement (name, pattern, primary_muscle, is_compound) VALUES');
L.push(seeded.map((m) => {
  const primary = m.target_muscles[0] ?? null;
  return `  (${q(m.name)}, ${q(PATTERN_11[m.name])}, ${primary === null ? 'NULL' : q(primary)}, ${m.is_compound ? 1 : 0})`;
}).join(',\n') + ';');
L.push('');
L.push('-- (2) movement_detail side-car (name-join, mirrors the 010 seed shape).');
L.push('INSERT OR IGNORE INTO movement_detail');
L.push('  (movement_id, base_name, supported_prefixes, difficulty_rating, target_muscles,');
L.push('   instructions, cues, video_placeholder_uri)');
L.push('SELECT m.movement_id, e.column2, e.column3, e.column4, e.column5, e.column6, e.column7, e.column8');
L.push('FROM (VALUES');
L.push(seeded.map((m) => {
  const muscles = JSON.stringify([...new Set([...m.target_muscles, ...m.secondary_muscles])]);
  return `  (${q(m.name)}, ${q(m.base_name)}, ${q(JSON.stringify(m.supported_prefixes))}, ${q(m.difficulty_rating)}, ${q(muscles)}, ${q(m.instructions_raw)}, ${q(m.cues)}, ${q(m.video_placeholder_uri)})`;
}).join(',\n') + ') AS e');
L.push('JOIN movement m ON m.name = e.column1;');
L.push('');
L.push('-- (3) movement_taxonomy side-car (8-pattern category + implement + family).');
L.push('INSERT OR IGNORE INTO movement_taxonomy (movement_id, category, implement, family)');
L.push('SELECT m.movement_id, e.column2, e.column3, e.column4');
L.push('FROM (VALUES');
L.push(seeded.map((m) => `  (${q(m.name)}, ${q(m.pattern)}, ${q(IMPLEMENT[m.supported_prefixes[0]])}, ${q(slug(m.base_name))})`).join(',\n') + ') AS e');
L.push('JOIN movement m ON m.name = e.column1;');
L.push('');
L.push('-- (5) movement_equipment (007 vocabulary; no rows = bodyweight — which is');
L.push('-- load-bearing in the generator, so every non-bodyweight row is mapped).');
const eqRows = seeded.flatMap((m) => EQUIPMENT[m.name].map((item) => ({ name: m.name, item })));
L.push('INSERT OR IGNORE INTO movement_equipment (movement_id, item)');
L.push('SELECT m.movement_id, e.column2');
L.push('FROM (VALUES');
L.push(eqRows.map((r) => `  (${q(r.name)}, ${q(r.item)})`).join(',\n') + ') AS e');
L.push('JOIN movement m ON m.name = e.column1;');
L.push('');
L.push('-- (6) movement_beginner_whitelist — plan P16 S4: beginners see Beginner');
L.push('-- difficulty plus exactly these Intermediate staples (ratified 2026-07-13,');
L.push('-- no barbell lifts). Presence of a row = whitelisted.');
L.push('CREATE TABLE IF NOT EXISTS movement_beginner_whitelist (');
L.push('  movement_id INTEGER PRIMARY KEY REFERENCES movement ON DELETE CASCADE');
L.push(') STRICT;');
L.push('INSERT OR IGNORE INTO movement_beginner_whitelist (movement_id)');
L.push('SELECT m.movement_id FROM movement m WHERE m.name IN (');
L.push(BEGINNER_WHITELIST.map((n) => `  ${q(n)}`).join(',\n') + ');');
L.push('');
L.push('-- (7) movement_progression — goal-movement ladders (progressionEngine.ts).');
L.push('-- Side-car (001 movement cannot gain columns idempotently). Rank is an');
L.push('-- ordinal within a group; gaps legal; (group, rank) unique.');
L.push('CREATE TABLE IF NOT EXISTS movement_progression (');
L.push('  movement_id      INTEGER PRIMARY KEY REFERENCES movement ON DELETE CASCADE,');
L.push('  progression_group TEXT NOT NULL,');
L.push('  progression_rank  INTEGER NOT NULL CHECK (progression_rank >= 0),');
L.push('  UNIQUE (progression_group, progression_rank)');
L.push(') STRICT;');
L.push('');
const chainRows = [
  ...SHIPPED_PROGRESSION.map((s) => ({ name: s.name, group: s.group, rank: s.rank })),
  ...curated
    .filter((m) => m.progression_group !== null)
    .map((m) => ({ name: m.name, group: m.progression_group, rank: m.progression_rank })),
].sort((a, b) => a.group.localeCompare(b.group) || a.rank - b.rank);
L.push('INSERT OR IGNORE INTO movement_progression (movement_id, progression_group, progression_rank)');
L.push('SELECT m.movement_id, e.column2, e.column3');
L.push('FROM (VALUES');
L.push(chainRows.map((r) => `  (${q(r.name)}, ${q(r.group)}, ${r.rank})`).join(',\n') + ') AS e');
L.push('JOIN movement m ON m.name = e.column1;');
L.push('');

// AUDIT F6: 016 is append-only once shipped. Regeneration is only legal
// before the migration is committed/released; after that, new curation goes
// into a NEW slot (017+). The guard forces an explicit acknowledgement.
import { existsSync } from 'node:fs';
const next = L.join('\n');
if (existsSync(OUT) && readFileSync(OUT, 'utf-8') !== next && process.env.AK_REGEN_016 !== '1') {
  console.error('ABORT: 016 exists with different content. If 016 has NOT shipped yet,');
  console.error('re-run with AK_REGEN_016=1. If it HAS shipped, write migration 017+ instead.');
  process.exit(1);
}
writeFileSync(OUT, next);
console.log(`wrote ${OUT}`);
console.log(`seeded rows: ${seeded.length}; equipment rows: ${eqRows.length}; progression rows: ${chainRows.length}`);
