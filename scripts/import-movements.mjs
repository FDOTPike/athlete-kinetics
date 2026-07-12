/**
 * import-movements.mjs — P16 Step 2: bulk-import an open exercise dataset
 * into a STAGING file for curation. Writes NO database rows and NO migrations.
 *
 * Source: free-exercise-db (github.com/yuhonas/free-exercise-db), a public-
 * domain (Unlicense) dataset of ~870 exercises. The license text is vendored
 * next to the staging output on every run; verify it before the seed
 * migration ships (rev4 plan, P16 S1 + risk rule 3).
 *
 * Pipeline position (rev4 plan P16):
 *   S2 (this script)   dataset -> staging/movement_import.json + quarantine
 *   S3 (FORGE batches / curation) staging -> house-standard instructions,
 *      cues, tiers, YouTube links (~15 movements per ticket)
 *   S4 migration seeds movement/movement_detail/movement_taxonomy FROM the
 *      CURATED staging file (next free slot at implementation time)
 *
 * Usage:
 *   node scripts/import-movements.mjs                  # fetch from GitHub
 *   node scripts/import-movements.mjs --from-file=path # offline (pre-downloaded)
 *
 * Design rules (mirroring the plan):
 *   - Collisions with the shipped 30 movements resolve to KEEP OURS (they
 *     have FK dependents); the incoming duplicate is quarantined as such.
 *   - Anything unmappable to the 8-pattern taxonomy or the supported
 *     equipment-prefix tokens lands in quarantine WITH A REASON, never in
 *     the import file. Quarantine is a human worklist, not an error.
 *   - Deterministic output ordering (name-sorted) so re-runs diff cleanly.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const OUT_DIR = join(ROOT, 'packages', 'core-db', 'staging');
const SOURCE_REPO = 'https://github.com/yuhonas/free-exercise-db';
const DATA_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const LICENSE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/LICENSE';

// The 30 shipped movement names (010_movement_library.sql) — KEEP OURS.
const SHIPPED = new Set([
  'competition squat', 'deadlift', 'competition bench', 'overhead press',
  'barbell row', 'weighted pull-up', 'bjj sparring round', 'front squat',
  'romanian deadlift', 'dumbbell bench press', 'dumbbell shoulder press',
  'single-arm dumbbell row', 'chin-up', 'goblet squat', 'kettlebell swing',
  'push-up', 'walking lunge', 'bulgarian split squat', 'farmer carry',
  'suitcase carry', 'lat pulldown', 'cable row', 'nordic curl',
  'band pull-apart', 'pallof press', 'plank', 'road run', 'bodyweight squat',
  'glute bridge', 'band row',
].map((n) => n.toLowerCase()));

/** Dataset equipment -> MOVEMENT_PREFIXES token (014). Unmapped = quarantine. */
const EQUIPMENT_TO_PREFIX = {
  'barbell': 'BB',
  'e-z curl bar': 'BB',
  'dumbbell': 'DB',
  'kettlebells': 'KB',
  'body only': 'Bodyweight',
  'bands': 'Banded',
  'cable': 'Cable',
};

/** Dataset level -> movement_detail.difficulty_rating CHECK domain. */
const LEVEL_TO_TIER = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Advanced' };

/** 8-pattern ExRx-style taxonomy (008): push,row,hinge,squat,core,unilateral,accessory,cardio. */
function classifyPattern(ex) {
  const n = ex.name.toLowerCase();
  const cat = (ex.category ?? '').toLowerCase();
  if (cat === 'cardio') return 'cardio';
  // Order matters: unilateral cues beat the base-pattern cues.
  if (/single[- ](arm|leg)|one[- ](arm|leg)|split squat|lunge|step[- ]?up|pistol/.test(n)) return 'unilateral';
  if (/deadlift|hip thrust|swing|good morning|glute bridge|back extension|hyperextension|clean|snatch|pull[- ]?through/.test(n)) return 'hinge';
  if (/squat|leg press|hack squat|wall sit/.test(n)) return 'squat';
  if (/row|pulldown|pull[- ]?up|chin[- ]?up|face pull|shrug|pullover/.test(n)) return 'row';
  if (/bench|press|push[- ]?up|dip|fly|flye|pushdown|raise.*front|overhead/.test(n)) return 'push';
  if (/plank|crunch|sit[- ]?up|ab |abs|oblique|russian twist|dead bug|bird dog|hollow|rollout|woodchop|pallof|l[- ]sit|leg raise|knee raise/.test(n)) return 'core';
  if (/curl|extension|raise|calf|forearm|wrist|neck|pull[- ]apart|rotation|rotator/.test(n)) return 'accessory';
  return null; // unmappable -> quarantine
}

function mapExercise(ex) {
  const reasons = [];
  const cat = (ex.category ?? '').toLowerCase();
  if (['stretching', 'strongman', 'olympic weightlifting', 'plyometrics'].includes(cat)) {
    reasons.push(`category '${cat}' out of v1 scope (curate manually if wanted)`);
  }
  const equipment = (ex.equipment ?? 'body only').toLowerCase();
  const prefix = EQUIPMENT_TO_PREFIX[equipment];
  if (prefix === undefined) reasons.push(`equipment '${equipment}' has no prefix token (014)`);
  const pattern = classifyPattern(ex);
  if (pattern === null) reasons.push('no taxonomy pattern matched');
  if (SHIPPED.has(ex.name.toLowerCase())) reasons.push('collides with a shipped movement (KEEP OURS)');
  if (reasons.length > 0) return { quarantined: { name: ex.name, reasons } };
  return {
    staged: {
      name: ex.name,
      base_name: ex.name, // curation batches normalize variation families (S3)
      pattern,
      supported_prefixes: [prefix],
      difficulty_rating: LEVEL_TO_TIER[(ex.level ?? '').toLowerCase()] ?? 'Intermediate',
      target_muscles: [...(ex.primaryMuscles ?? [])],
      secondary_muscles: [...(ex.secondaryMuscles ?? [])],
      // Raw dataset text: the curation loop REWRITES these to house standard
      // (plain language, 2-4 steps, 1-3 blunt cues) — never shipped verbatim.
      instructions_raw: (ex.instructions ?? []).join(' '),
      cues: '',                    // authored in S3
      video_placeholder_uri: '',   // one YouTube link, authored in S3
      is_compound: (ex.mechanic ?? '').toLowerCase() === 'compound',
      source: 'free-exercise-db',
      curated: false,
      progression_group: null,   // chain id, assigned in curation (S3)
      progression_rank: null,    // ordinal within the chain, gaps legal
    },
  };
}

async function loadDataset() {
  const fromFile = process.argv.find((a) => a.startsWith('--from-file='));
  if (fromFile !== undefined) {
    return { data: JSON.parse(readFileSync(fromFile.slice('--from-file='.length), 'utf-8')), license: null };
  }
  const [dataRes, licRes] = await Promise.all([fetch(DATA_URL), fetch(LICENSE_URL)]);
  if (!dataRes.ok) throw new Error(`dataset fetch ${dataRes.status}`);
  return {
    data: await dataRes.json(),
    license: licRes.ok ? await licRes.text() : null,
  };
}

const { data, license } = await loadDataset();
if (!Array.isArray(data)) throw new Error('dataset root is not an array');

const staged = [];
const quarantine = [];
for (const ex of data) {
  if (typeof ex?.name !== 'string' || ex.name.trim() === '') continue;
  const out = mapExercise(ex);
  if (out.staged !== undefined) staged.push(out.staged);
  else quarantine.push(out.quarantined);
}
staged.sort((a, b) => a.name.localeCompare(b.name));
quarantine.sort((a, b) => a.name.localeCompare(b.name));

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'movement_import.json'), JSON.stringify({
  source: SOURCE_REPO,
  imported_at: new Date().toISOString(),
  count: staged.length,
  movements: staged,
}, null, 1));
writeFileSync(join(OUT_DIR, 'movement_quarantine.json'), JSON.stringify({
  count: quarantine.length,
  entries: quarantine,
}, null, 1));
if (license !== null) writeFileSync(join(OUT_DIR, 'DATASET_LICENSE.txt'), license);

const byPattern = {};
for (const m of staged) byPattern[m.pattern] = (byPattern[m.pattern] ?? 0) + 1;
const byTier = {};
for (const m of staged) byTier[m.difficulty_rating] = (byTier[m.difficulty_rating] ?? 0) + 1;
console.log(`staged ${staged.length}, quarantined ${quarantine.length}`);
console.log('by pattern:', JSON.stringify(byPattern));
console.log('by tier:', JSON.stringify(byTier));
console.log(`license ${license !== null ? 'vendored -> DATASET_LICENSE.txt (verify: expect Unlicense/public domain)' : 'NOT FETCHED — vendor manually before the seed migration ships'}`);
