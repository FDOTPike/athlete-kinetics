/**
 * previewManifest.js — the merged preview data, for component tests.
 *
 * R2 Part C split the single `movementPreviewManifest.json` into an index plus
 * one compact file per motion family. This helper reads those files FROM DISK,
 * then asks the app's own module (src/components/movementPreview/manifest.ts)
 * for the same data and asserts the two agree: a suite that saw only the module
 * could not notice a split whose files have drifted from what the app loads, and
 * in this design the FILES are the data.
 */
import fs from 'fs';
import path from 'path';

import {
  PREVIEW_BOX,
  PREVIEW_CHARACTER,
  PREVIEW_FRAME_INTERVAL_MS,
  PREVIEW_SHARED_RIG,
  PREVIEW_TECHNIQUE_REVIEW,
  rawPreviewEntries,
} from '../../src/components/movementPreview/manifest';

const previewDir = path.join(__dirname, '..', '..', 'src', 'components', 'movementPreview');
const familiesDir = path.join(previewDir, 'families');

// The compact family file (R2 Part C, owner-approved 2026-09-28) carries the
// drawn data; the authoring metadata (instructions, cues, coachingIntent) lives
// in movementPreviewManifest.json, the source of truth. The tests speak about
// the manifest's entries - the F-1 caption-support and R5 completeness laws are
// laws about that content, wherever it is stored - while the module-vs-files
// agreement below is checked on the raw shipped bytes.
const sourceManifest = JSON.parse(
  fs.readFileSync(path.join(previewDir, 'movementPreviewManifest.json'), 'utf8'),
);
const sourceById = new Map(sourceManifest.entries.map((entry) => [entry.movementId, entry]));

const index = JSON.parse(fs.readFileSync(path.join(previewDir, 'previewIndex.json'), 'utf8'));
const familyBySlug = new Map(
  fs.readdirSync(familiesDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => [
      name.replace(/\.json$/, ''),
      JSON.parse(fs.readFileSync(path.join(familiesDir, name), 'utf8')),
    ]),
);

const diskEntries = index.movementOrder.map((movementId) => {
  const slug = index.movementFamily[String(movementId)];
  const family = familyBySlug.get(slug);
  if (family === undefined) {
    throw new Error(`previewManifest: no family file for '${slug}' (movement ${movementId})`);
  }
  const entry = family.entries.find((candidate) => candidate.movementId === movementId);
  if (entry === undefined) {
    throw new Error(`previewManifest: movement ${movementId} is missing from ${slug}.json`);
  }
  return entry;
});

export const previewManifest = {
  schemaVersion: index.schemaVersion,
  box: index.box,
  character: index.character,
  frameIntervalMs: index.frameIntervalMs,
  sharedRig: index.sharedRig,
  techniqueReview: index.techniqueReview,
  entries: diskEntries.map((entry) => sourceById.get(entry.movementId) ?? entry),
};

// The module must agree with the files it loads: the same entries in the same
// order, and the same shared blocks. A drift means the app would draw something
// the shipped files do not say.
const moduleEntries = rawPreviewEntries();
if (JSON.stringify(moduleEntries) !== JSON.stringify(diskEntries)) {
  throw new Error('previewManifest: manifest.ts disagrees with the family files');
}
for (const [name, fromModule, fromFile] of [
  ['box', PREVIEW_BOX, index.box],
  ['character', PREVIEW_CHARACTER, index.character],
  ['frameIntervalMs', PREVIEW_FRAME_INTERVAL_MS, index.frameIntervalMs],
  ['sharedRig', PREVIEW_SHARED_RIG, index.sharedRig],
  ['techniqueReview', PREVIEW_TECHNIQUE_REVIEW, index.techniqueReview],
]) {
  if (JSON.stringify(fromModule) !== JSON.stringify(fromFile)) {
    throw new Error(`previewManifest: manifest.ts disagrees with previewIndex.json on ${name}`);
  }
}

/** The raw entries alone, in the manifest's own order. */
export const rawEntries = previewManifest.entries;

/** The entries as the shipped family files carry them (the compact projection). */
export const shippedEntries = diskEntries;