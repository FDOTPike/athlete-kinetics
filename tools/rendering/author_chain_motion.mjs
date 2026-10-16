// Authoring script for chain movements: figures posed by the direction of each
// body segment (see CHAIN_MOVEMENTS in canonicalFigure.ts). One phase number
// per keyframe (`ph`) drives the whole figure; the stored joints are that
// geometry's drawn projection at the keyframe. Each movement is bound to its
// own catalogue text.
//
// Run from the repository root, then re-cut the family files:
//   node tools/rendering/author_chain_motion.mjs
//   node tools/rendering/wo09_split_preview_manifest.mjs
import fs from 'node:fs';
import path from 'node:path';
import { loadCanonicalFigure } from './lib/canonicalSvg.mjs';
import { CHAIN_SPECS } from './chain_motion_specs.mjs';

const layout = await loadCanonicalFigure();
const file = 'apps/mobile/src/components/movementPreview/movementPreviewManifest.json';
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const catalogue = JSON.parse(fs.readFileSync('docs/audits/accessible-coach/movement-completion/ALL_300_MOTION_MAP.json', 'utf8'));
const BODY = layout.CANONICAL_BODY_PARAMETERS;

/** A caption ending on one of these is a fragment (the same list the caption-integrity test uses). */
const DANGLING_TAIL = /\b(and|the|with|while|of|to|a|an|from|over|into|for|then|but|or|that|as|at|in|on|by|its|their|your|is|are|be|been)\.$/i;

/** Two decimals, as every stored joint in the manifest is. */
const round = (p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];

/**
 * The stored joints for one keyframe: the drawn projection of the figure, plus
 * the phase that drives it and, for a movement that turns, the turn.
 */
function pose(slug, ph, tw) {
  const j = layout.chainGeometry(slug, ph, BODY, tw ?? 0).joints;
  const out = {};
  for (const key of ['hd', 'nk', 'hp', 'el', 'wr', 'ef', 'wf', 'kn', 'an', 'kf', 'af']) out[key] = round(j[key]);
  return tw === undefined ? { ...out, ph } : { ...out, ph, tw };
}

/** The painted extent of one primitive, in box units. */
function extent(p) {
  if (p.kind === 'circle') return [p.cx - p.r, p.cy - p.r, p.cx + p.r, p.cy + p.r];
  if (p.kind === 'rect') return [p.x, p.y, p.x + p.w, p.y + p.h];
  const h = p.w / 2;
  return [Math.min(p.x1, p.x2) - h, Math.min(p.y1, p.y2) - h, Math.max(p.x1, p.x2) + h, Math.max(p.y1, p.y2) + h];
}

/**
 * The frame for a movement: everything painted on any tick of the cycle, with
 * a margin, and always down to the bottom of the box so the floor line shows.
 */
function viewBoxOf(entry) {
  const total = entry.segmentDurationsMs.reduce((a, b) => a + b, 0);
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (let t = 0; t <= total; t += 33) {
    const p = layout.poseAtTime(entry.frames.map((f) => f.joints), t, entry.segmentDurationsMs);
    for (const prim of layout.layoutCanonicalFigure(p, { ...entry, body: BODY })) {
      const e = extent(prim);
      box[0] = Math.min(box[0], e[0]); box[1] = Math.min(box[1], e[1]);
      box[2] = Math.max(box[2], e[2]); box[3] = Math.max(box[3], e[3]);
    }
  }
  const MARGIN = 3;
  const left = Math.floor(box[0] - MARGIN), top = Math.floor(box[1] - MARGIN);
  const right = Math.ceil(box[2] + MARGIN), bottom = Math.max(100, Math.ceil(box[3] + MARGIN));
  return [left, top, right - left, bottom - top];
}

for (const spec of CHAIN_SPECS) {
  const row = catalogue.movements.find((entry) => entry.id === spec.id);
  if (!row) throw Error(`Movement ${spec.id} is not in the catalogue`);
  // A movement whose catalogue text is on a source hold can only be authored from a text that says where it came from.
  if (row.motion.source_hold_reason && !(spec.text && spec.text.basis)) throw Error(`Movement ${spec.id} is on a source hold`);
  if (row.source.asset_key !== `movement/${spec.slug}/demo/v1`) throw Error(`Movement ${spec.id} asset key ${row.source.asset_key} does not match slug ${spec.slug}`);
  const movement = layout.CHAIN_MOVEMENTS[spec.slug];
  if (!movement) throw Error(`Movement ${spec.id} has no chain movement for ${spec.slug}`);
  if (spec.phases.length < 5 || spec.captions.length !== spec.phases.length || spec.segments.length !== spec.phases.length - 1) {
    throw Error(`Movement ${spec.id} needs at least five keyframes, one caption each and one duration per gap`);
  }
  // A movement whose poses form a loop closes by running on to the first pose again.
  const closes = movement.cycle === true
    ? (spec.phases.at(-1) - spec.phases[0]) % movement.poses.length === 0
    : spec.phases[0] === spec.phases.at(-1);
  if (!closes) throw Error(`Movement ${spec.id} does not close its loop`);
  if (spec.turns && (spec.turns.length !== spec.phases.length || spec.turns[0] !== spec.turns.at(-1))) {
    throw Error(`Movement ${spec.id} needs one turn per keyframe, closing its loop`);
  }
  for (const caption of spec.captions) {
    // The caption-integrity rules, applied here so a fragment never reaches the manifest.
    if (caption.trim().length < 10 || !/[.!?]$/.test(caption) || DANGLING_TAIL.test(caption)) throw Error(`Movement ${spec.id} caption is not a finished sentence: ${caption}`);
  }
  const entry = {
    movementId: spec.id,
    name: row.name,
    assetKey: row.source.asset_key,
    // A redraw of an older draft keeps that draft's id, so nothing that refers to it has to change.
    previewId: spec.previewId ?? `${spec.slug.replaceAll('-', '_')}_${spec.id}_draft`,
    pattern: row.source.pattern,
    status: 'pending',
    view: movement.view ?? 'side',
    techniqueCitations: [],
    viewBox: [0, 0, 100, 100],
    equipment: spec.equipment,
    instructions: spec.text?.instructions ?? row.source.instructions,
    cues: spec.text?.cues ?? row.source.cues,
    coachingIntent: spec.text?.coachingIntent ?? row.source.coaching_intent,
    reason: spec.reason,
    summary: spec.summary,
    frames: spec.phases.map((ph, i) => ({ id: `p${i + 1}`, caption: spec.captions[i], joints: pose(spec.slug, ph, spec.turns?.[i]) })),
    segmentDurationsMs: spec.segments,
  };
  entry.viewBox = viewBoxOf(entry);
  const at = manifest.entries.findIndex((existing) => existing.movementId === spec.id);
  // A redraw of an older draft keeps the technique citations that draft carried.
  if (at >= 0 && spec.previewId !== undefined) entry.techniqueCitations = manifest.entries[at].techniqueCitations ?? [];
  if (at >= 0 && manifest.entries[at].previewId !== entry.previewId) throw Error(`Movement ${spec.id} is already owned by another author`);
  if (at < 0) manifest.entries.push(entry); else manifest.entries[at] = entry;
  console.log(`Authored ${spec.id} ${row.name}: view ${entry.view}, box ${JSON.stringify(entry.viewBox)}`);
}

fs.writeFileSync(file, `${JSON.stringify(manifest)}\n`);

// Re-cut the split family files and index from the updated manifest.
const FAMILIES_CATALOGUE = JSON.parse(fs.readFileSync('docs/audits/accessible-coach/WO09_MOTION_FAMILIES.json', 'utf8'));
const PREVIEW_DIR = 'apps/mobile/src/components/movementPreview';
const FAMILIES_DIR = path.join(PREVIEW_DIR, 'families');
const INDEX_FILE = path.join(PREVIEW_DIR, 'previewIndex.json');
const LOADERS_FILE = path.join(PREVIEW_DIR, 'familyLoaders.ts');

const EXTRA_FAMILY_KEYS = {
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
};

const familyOf = new Map();
for (const family of FAMILIES_CATALOGUE.families) {
  familyOf.set(family.base.id, family.family);
  for (const variant of family.variants) familyOf.set(variant.id, family.family);
}
const keyFor = (movementId) => familyOf.get(movementId) ?? EXTRA_FAMILY_KEYS[movementId];
const slugOfFamily = (key) => key.replace('@', '__');

const byFamily = new Map();
for (const entry of manifest.entries) {
  const key = keyFor(entry.movementId);
  if (!key) throw Error(`Movement ${entry.movementId} has no family key`);
  const slug = slugOfFamily(key);
  if (!byFamily.has(slug)) byFamily.set(slug, { key, entries: [] });
  byFamily.get(slug).entries.push(entry);
}

const projectCompact = (entry) => {
  const covered = Array.isArray(entry.frames) && entry.frames.length > 0
    && entry.previewId !== undefined && entry.summary !== undefined;
  if (!covered) return entry;
  const out = { ...entry };
  delete out.coachingIntent;
  if (entry.derivesFrom === undefined) {
    delete out.instructions;
    delete out.cues;
  }
  return out;
};

fs.mkdirSync(FAMILIES_DIR, { recursive: true });
for (const [slug, family] of byFamily) {
  fs.writeFileSync(
    path.join(FAMILIES_DIR, `${slug}.json`),
    `${JSON.stringify({ family: family.key, entries: family.entries.map(projectCompact) })}\n`,
  );
}

const index = {
  schemaVersion: 2,
  scope: manifest.scope,
  techniqueReview: manifest.techniqueReview,
  sharedRig: manifest.sharedRig,
  box: manifest.box,
  character: manifest.character,
  frameIntervalMs: manifest.frameIntervalMs,
  movementOrder: manifest.entries.map((entry) => entry.movementId),
  families: Object.fromEntries(
    [...byFamily].map(([slug, family]) => [
      slug,
      { key: family.key, movements: family.entries.map((e) => e.movementId) },
    ]),
  ),
  movementFamily: Object.fromEntries(
    manifest.entries.map((entry) => [String(entry.movementId), slugOfFamily(keyFor(entry.movementId))]),
  ),
};
fs.writeFileSync(INDEX_FILE, `${JSON.stringify(index)}\n`);

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
fs.writeFileSync(LOADERS_FILE, loaderSource);

