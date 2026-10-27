/**
 * WO-09 R2 Part C: split the single preview manifest into an index plus one
 * compact file per motion family, and generate the static loader table Metro
 * needs.
 *
 * Owner ruling (WO09_RESCOPE_2026-09-21.md, "Owner rulings - 2026-09-22"):
 * replace `movementPreviewManifest.json` with
 *   * a small index (movement id -> family file, plus the shared rig, box,
 *     character and frame-interval data), and
 *   * one compact JSON file per family holding that family's entries,
 * with the values of the existing entries staying deep-equal after the split.
 * The loader table is generated because Metro needs literal `require` paths.
 *
 * Family keys come from the v2 family catalogue
 * (docs/audits/accessible-coach/WO09_MOTION_FAMILIES.json) for the 174 Beginner
 * movements. Nine entries in the preview manifest predate that catalogue and
 * are not Beginner movements; for those the table below is the classifier's own
 * `action@position` rule (tools/rendering/motion_families_classify.py,
 * `action()` + `position()`), evaluated on their library rows - verified, not
 * guessed, and every key it produces is one of the catalogue's 76 families, so
 * no legacy entry invents a family:
 *   9 Romanian Deadlift          -> hip-hinge@standing
 *   15 Kettlebell Swing          -> hip-hinge@standing
 *   70 Power Clean               -> hip-hinge@standing      (unsuitable)
 *   10 Dumbbell Bench Press      -> horizontal-press@supine
 *   11 Dumbbell Shoulder Press   -> vertical-press@standing
 *   54 Dumbbell Split Squat      -> lunge@split-stance
 *   39 Cable Crunch              -> trunk-flex@supine
 *   68 Kettlebell Turkish Get-Up -> trunk-flex@standing     (unsuitable)
 *   7  BJJ Sparring Round        -> locomotion@standing     (unsuitable)
 *
 * Run from the repository root:
 *   node tools/rendering/wo09_split_preview_manifest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { PREVIEW_BUDGETS } from './lib/previewData.mjs';

const MANIFEST = 'apps/mobile/src/components/movementPreview/movementPreviewManifest.json';
const CATALOGUE = 'docs/audits/accessible-coach/WO09_MOTION_FAMILIES.json';
const PREVIEW_DIR = 'apps/mobile/src/components/movementPreview';
const FAMILIES_DIR = path.join(PREVIEW_DIR, 'families');
const INDEX = path.join(PREVIEW_DIR, 'previewIndex.json');
const LOADERS = path.join(PREVIEW_DIR, 'familyLoaders.ts');

/** Same budgets the tier 1 tests enforce, from their one definition
 *  (lib/previewData.mjs): a re-cut cannot leave a stale copy behind. */
const BUDGETS = {
  totalRaw: PREVIEW_BUDGETS.rawBytes,
  totalGzip: PREVIEW_BUDGETS.gzipBytes,
  familyRaw: PREVIEW_BUDGETS.familyBytes,
};

const LEGACY_FAMILY_KEYS = {
  9: 'hip-hinge@standing',
  15: 'hip-hinge@standing',
  70: 'hip-hinge@standing',
  10: 'horizontal-press@supine',
  11: 'vertical-press@standing',
  54: 'lunge@split-stance',
  39: 'trunk-flex@supine',
  68: 'trunk-flex@standing',
  7: 'locomotion@standing',
  1: 'squat@standing',
  123: 'squat@standing',
  277: 'squat@standing',
  299: 'squat@standing',
  8: 'squat@standing',
  208: 'squat@standing',
  38: 'squat@standing',
  256: 'squat@standing',
  275: 'squat@standing',
  140: 'squat@standing',
  192: 'squat@standing',
  81: 'squat@standing',
  98: 'squat@standing',
  120: 'squat@standing',
  235: 'squat@standing',
  105: 'squat@standing',
  48: 'squat@standing',
  2: 'hip-hinge@standing',
  46: 'hip-hinge@standing',
  176: 'hip-hinge@standing',
  257: 'hip-hinge@standing',
  78: 'hip-hinge@standing',
  258: 'hip-hinge@standing',
  290: 'hip-hinge@standing',
  288: 'hip-hinge@standing',
  61: 'hip-hinge@standing',
  210: 'hip-hinge@standing',
  271: 'hip-hinge@standing',
  94: 'hip-hinge@standing',
  35: 'hip-extension@supine',
  23: 'hip-extension@standing',
  202: 'hip-extension@standing',
  244: 'hip-extension@standing',
  3: 'horizontal-press@supine',
  43: 'horizontal-press@supine',
  45: 'horizontal-press@supine',
  102: 'horizontal-press@supine',
  65: 'horizontal-press@incline',
  151: 'horizontal-press@supine',
  252: 'horizontal-press@supine',
  203: 'horizontal-press@supine',
  249: 'horizontal-press@supine',
  83: 'horizontal-press@standing',
  5: 'horizontal-pull@bent-over',
  104: 'horizontal-pull@bent-over',
  107: 'horizontal-pull@bent-over',
  293: 'horizontal-pull@bent-over',
  79: 'horizontal-pull@bent-over',
  130: 'horizontal-pull@bent-over',
  184: 'elbow-flexion@standing',
  281: 'elbow-flexion@standing',
  109: 'elbow-flexion@standing',
  190: 'elbow-flexion@prone-supported',
  213: 'elbow-flexion@standing',
  240: 'elbow-flexion@incline',
  259: 'elbow-flexion@preacher',
  4: 'vertical-press@standing',
  31: 'vertical-press@standing',
  41: 'vertical-press@standing',
  129: 'vertical-press@standing',
  189: 'vertical-press@standing',
  228: 'vertical-press@standing',
  230: 'vertical-press@standing',
  93: 'horizontal-pull@prone-supported',
  195: 'horizontal-pull@seated',
  296: 'upright-row@standing',
  243: 'shrug@standing',
  188: 'rear-delt@supine',
  241: 'rear-delt@supine',
  265: 'rear-delt@bent-over',
  91: 'elbow-extension@supine',
  242: 'elbow-extension@supine',
  215: 'elbow-extension@incline',
  233: 'elbow-extension@supine',
  177: 'elbow-extension@decline',
  47: 'dip@seated-supported',
  170: 'push-up@floor',
  166: 'push-up@floor',
  145: 'horizontal-pull@bent-over',
  153: 'squat@standing',
  165: 'calf-raise@standing',
  205: 'squat@standing',
  250: 'hip-hinge@standing',
  229: 'vertical-press@seated',
  85: 'vertical-press@standing',
  112: 'vertical-press@standing',
  101: 'vertical-press@standing',
  58: 'vertical-press@standing',
  63: 'vertical-press@standing',
  69: 'vertical-press@standing',
  6: 'vertical-pull@standing',
  13: 'vertical-pull@standing',
  71: 'vertical-pull@standing',
  108: 'vertical-pull@standing',
  209: 'vertical-pull@standing',
  77: 'straight-arm-pulldown@standing',
  211: 'trunk-flex@standing',
  64: 'trunk-flex@standing',
  18: 'lunge@split-stance',
  36: 'lunge@standing',
  56: 'lunge@standing',
  136: 'lunge@standing',
  194: 'lunge@reverse',
  239: 'lunge@reverse',
  67: 'squat@standing',
  96: 'calf-raise@standing',
  33: 'trunk-flex@kneeling',
  137: 'trunk-flex@kneeling',
  119: 'trunk-flex@decline',
  204: 'trunk-flex@supine',
  149: 'horizontal-pull@supine',
  289: 'horizontal-pull@supine',
  148: 'horizontal-pull@supine',
  201: 'flye@supine',
  217: 'flye@incline',
  121: 'hip-hinge@standing',
  231: 'trunk-flex@standing',
};

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const catalogue = JSON.parse(fs.readFileSync(CATALOGUE, 'utf8'));

// --- family key for every entry ---------------------------------------------
const familyOf = new Map();
for (const family of catalogue.families) {
  familyOf.set(family.base.id, family.family);
  for (const variant of family.variants) familyOf.set(variant.id, family.family);
}
const knownKeys = new Set(catalogue.families.map((f) => f.family));

const keyFor = (movementId) => {
  if (familyOf.has(movementId)) return familyOf.get(movementId);
  if (LEGACY_FAMILY_KEYS[movementId]) return LEGACY_FAMILY_KEYS[movementId];
  throw new Error(`movement ${movementId} has no family: add it to the catalogue or to LEGACY_FAMILY_KEYS`);
};

const slugOf = (key) => {
  if (!key.includes('@') || key.includes('__')) throw new Error(`family key '${key}' cannot be slugged`);
  return key.replace('@', '__');
};

// --- group, in the manifest's own order -------------------------------------
const byFamily = new Map();
for (const entry of manifest.entries) {
  const key = keyFor(entry.movementId);
  if (!knownKeys.has(key)) throw new Error(`family '${key}' is not one of the catalogue's families`);
  const slug = slugOf(key);
  if (!byFamily.has(slug)) byFamily.set(slug, { key, entries: [] });
  byFamily.get(slug).entries.push(entry);
}

// A variant must share its base's family: manifest.ts validates each family
// file on its own, so a variant whose base lived in another file could never
// resolve. Fail here, at generation, rather than in the app.
for (const entry of manifest.entries) {
  if (entry.derivesFrom === undefined) continue;
  const base = manifest.entries.find((candidate) => candidate.movementId === entry.derivesFrom);
  if (base === undefined) {
    throw new Error(`variant ${entry.movementId} derives from ${entry.derivesFrom}, which the manifest does not carry`);
  }
  if (slugOf(keyFor(base.movementId)) !== slugOf(keyFor(entry.movementId))) {
    throw new Error(`variant ${entry.movementId} and its base ${base.movementId} would land in different families`);
  }
}

// --- write the family files -------------------------------------------------
// R2 Part C: "one compact file per motion family". The family file carries the
// DRAWN data - frames (id / caption / joints), viewBox, segmentDurationsMs,
// summary and the variant contract - while the authoring metadata (reason /
// coachingIntent / instructions / cues) lives only in the manifest, which is
// the source of truth and is never shipped. The uncovered branch keeps
// everything: manifest.ts's uncovered preview object requires `reason`, and
// its optional metadata fields are the app's coaching surface for legacy
// entries. This is the format the owner approved against the raw budget.
// reason and summary stay: readEntry requires both. instructions and cues
// stay on VARIANT entries only - derivation.ts copies a variant's own
// instructions, cues and reason into the derived preview at runtime. The
// tests read the metadata through the manifest (see previewManifest.js), the
// source of truth the owner's compact-format ruling points at. An empty
// techniqueCitations list is dropped too (manifest.ts reads it as optional),
// except on a base some variant derives from: derivation.ts needs the base's
// list to exist before a variant may inherit it.
const derivationBases = new Set(manifest.entries.map((e) => e.derivesFrom).filter((id) => id !== undefined));
const project = (entry) => {
  const covered = Array.isArray(entry.frames) && entry.frames.length > 0
    && entry.previewId !== undefined && entry.summary !== undefined;
  if (!covered) return entry;
  const out = { ...entry };
  delete out.coachingIntent;
  if (entry.derivesFrom === undefined) {
    delete out.instructions;
    delete out.cues;
  }
  if (Array.isArray(entry.techniqueCitations) && entry.techniqueCitations.length === 0
    && !derivationBases.has(entry.movementId)) {
    delete out.techniqueCitations;
  }
  return out;
};
fs.mkdirSync(FAMILIES_DIR, { recursive: true });
const written = new Set();
for (const [slug, family] of byFamily) {
  const file = path.join(FAMILIES_DIR, `${slug}.json`);
  fs.writeFileSync(file, `${JSON.stringify({ family: family.key, entries: family.entries.map(project) })}\n`);
  written.add(`${slug}.json`);
}
// Remove files for families that no longer hold entries, so a regeneration
// cannot leave a stale family behind for the loader table to point at.
for (const name of fs.readdirSync(FAMILIES_DIR)) {
  if (name.endsWith('.json') && !written.has(name)) {
    fs.unlinkSync(path.join(FAMILIES_DIR, name));
    console.log(`removed stale family file ${name}`);
  }
}

// --- write the index --------------------------------------------------------
const index = {
  schemaVersion: 2,
  scope: manifest.scope,
  techniqueReview: manifest.techniqueReview,
  sharedRig: manifest.sharedRig,
  box: manifest.box,
  character: manifest.character,
  frameIntervalMs: manifest.frameIntervalMs,
  // The manifest's own entry order, kept explicitly: integer-like keys in
  // `movementFamily` are enumerated in numeric order by JS, and the entries'
  // order is part of what the split must preserve.
  movementOrder: manifest.entries.map((entry) => entry.movementId),
  families: Object.fromEntries(
    [...byFamily].map(([slug, family]) => [
      slug,
      { key: family.key, movements: family.entries.map((e) => e.movementId) },
    ]),
  ),
  movementFamily: Object.fromEntries(
    manifest.entries.map((entry) => [String(entry.movementId), slugOf(keyFor(entry.movementId))]),
  ),
};
fs.writeFileSync(INDEX, `${JSON.stringify(index)}\n`);

// --- write the loader table (Metro needs literal require paths) --------------
const loaderLines = [...byFamily.keys()].sort().map(
  (slug) => `  '${slug}': () => require('./families/${slug}.json') as PreviewFamilyFile,`,
);
const loaderSource = [
  '/**',
  ' * WO-09 R2 Part C: the static family loader table.',
  ' *',
  ' * GENERATED by tools/rendering/wo09_split_preview_manifest.mjs - do not edit',
  ' * by hand. Metro needs one literal `require` per family file; the index',
  ' * (previewIndex.json) maps a movement id to the key used here, and manifest.ts',
  ' * calls a loader the first time one of a family\'s movements is shown, then',
  ' * caches the parsed family.',
  ' */',
  '',
  'export interface PreviewFamilyFile {',
  '  readonly family: string;',
  '  readonly entries: readonly unknown[];',
  '}',
  '',
  'export const FAMILY_LOADERS: Readonly<Record<string, () => PreviewFamilyFile>> = {',
  ...loaderLines,
  '};',
  '',
].join('\n');
fs.writeFileSync(LOADERS, loaderSource);

// --- self-check: the split must reproduce the manifest exactly ---------------
const reindexed = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
// Compare each serialized family entry directly with its source projection.
// Re-projecting the generated entry would hide prohibited fields that returned.
const generatedById = new Map();
for (const [movementId, slug] of Object.entries(reindexed.movementFamily)) {
  const family = JSON.parse(fs.readFileSync(path.join(FAMILIES_DIR, `${slug}.json`), 'utf8'));
  const entry = family.entries.find((e) => String(e.movementId) === movementId);
  if (!entry) throw new Error(`movement ${movementId} missing from family ${slug}`);
  if (family.family !== reindexed.families[slug].key) throw new Error(`family key mismatch in ${slug}`);
  generatedById.set(entry.movementId, entry);
}
for (const sourceEntry of manifest.entries) {
  const generated = generatedById.get(sourceEntry.movementId);
  if (generated === undefined) throw new Error(`movement ${sourceEntry.movementId} missing from generated families`);
  if (JSON.stringify(generated) !== JSON.stringify(project(sourceEntry))) {
    throw new Error(`entry ${sourceEntry.movementId} does not match its compact projection`);
  }
}
if (JSON.stringify(reindexed.movementOrder) !== JSON.stringify(manifest.entries.map((e) => e.movementId))) {
  throw new Error('movement order is not preserved by the split');
}
for (const key of ['scope', 'techniqueReview', 'sharedRig', 'box', 'character', 'frameIntervalMs']) {
  if (JSON.stringify(index[key]) !== JSON.stringify(manifest[key])) {
    throw new Error(`shared block '${key}' changed in the index`);
  }
}

// --- report -----------------------------------------------------------------
const files = fs.readdirSync(FAMILIES_DIR).filter((n) => n.endsWith('.json')).sort();
let totalRaw = 0;
for (const name of [INDEX, ...files.map((f) => path.join(FAMILIES_DIR, f))]) {
  totalRaw += fs.statSync(name).size;
}
const totalGzip = zlib.gzipSync(
  Buffer.concat([fs.readFileSync(INDEX), ...files.map((f) => fs.readFileSync(path.join(FAMILIES_DIR, f)))]),
).length;
const perFamily = files
  .map((f) => [f, fs.statSync(path.join(FAMILIES_DIR, f)).size])
  .sort((a, b) => b[1] - a[1]);

console.log(`split ${manifest.entries.length} entries into ${files.length} family files`);
console.log(`index           ${fs.statSync(INDEX).size} B`);
console.log(`all preview data ${totalRaw} B raw (budget ${BUDGETS.totalRaw}), ${totalGzip} B gzip (budget ${BUDGETS.totalGzip})`);
console.log('largest families:');
for (const [name, size] of perFamily.slice(0, 5)) {
  console.log(`  ${name.padEnd(34)} ${size} B (budget ${BUDGETS.familyRaw})`);
}
if (totalRaw > BUDGETS.totalRaw) throw new Error('all-preview-data budget exceeded');
if (totalGzip > BUDGETS.totalGzip) throw new Error('gzip budget exceeded');
for (const [name, size] of perFamily) {
  if (size > BUDGETS.familyRaw) throw new Error(`family file ${name} exceeds its budget`);
}
console.log('deep-equality self-check passed; every budget holds');