/**
 * R2 Part C: the split itself — the index, the family files, the loader table
 * and the app's own family loader must describe one and the same set of
 * movements, and every check here runs in both directions, so an orphan in
 * either direction fails. Nothing here trusts a single source: the folder, the
 * index, the loader table and manifest.ts are compared against each other.
 */
import fs from 'fs';
import path from 'path';

import * as manifest from '../../src/components/movementPreview/manifest';
import { FAMILY_LOADERS } from '../../src/components/movementPreview/familyLoaders';

const previewDir = path.join(__dirname, '..', '..', 'src', 'components', 'movementPreview');
const familiesDir = path.join(previewDir, 'families');
const index = JSON.parse(fs.readFileSync(path.join(previewDir, 'previewIndex.json'), 'utf8'));

const slugOfFile = (name) => name.replace(/\.json$/, '');
const familyFiles = fs.readdirSync(familiesDir).filter((name) => name.endsWith('.json')).sort();
const loaded = new Map(familyFiles.map((name) => [
  slugOfFile(name),
  JSON.parse(fs.readFileSync(path.join(familiesDir, name), 'utf8')),
]));
const indexSlugs = Object.keys(index.families).sort();

test('the families/ folder and the index describe the same families', () => {
  expect(familyFiles.map(slugOfFile)).toEqual(indexSlugs);
});

test('every family file carries its index key and exactly its listed movements', () => {
  for (const slug of indexSlugs) {
    const family = loaded.get(slug);
    expect(family.family).toBe(index.families[slug].key);
    const ids = family.entries.map((entry) => entry.movementId);
    expect(ids).toEqual(index.families[slug].movements);
    expect(new Set(ids).size).toBe(ids.length);
  }
});

test('movementFamily routes every movement to the family that carries it, both ways', () => {
  const routed = {};
  for (const slug of indexSlugs) {
    for (const movementId of index.families[slug].movements) {
      expect(index.movementFamily[String(movementId)]).toBe(slug);
      routed[String(movementId)] = slug;
    }
  }
  expect(Object.keys(index.movementFamily).sort()).toEqual(Object.keys(routed).sort());
});

test('movementOrder lists every carried movement exactly once', () => {
  const carried = indexSlugs.flatMap((slug) => index.families[slug].movements);
  expect(new Set(index.movementOrder).size).toBe(index.movementOrder.length);
  expect([...index.movementOrder].sort((a, b) => a - b)).toEqual([...carried].sort((a, b) => a - b));
});

test('FAMILY_LOADERS covers exactly the index families, both ways', () => {
  expect(Object.keys(FAMILY_LOADERS).sort()).toEqual(indexSlugs);
});

test('every FAMILY_LOADERS entry loads through loadPreviewFamily', () => {
  const slugs = Object.keys(FAMILY_LOADERS).sort();
  expect(slugs.length).toBeGreaterThan(0);
  for (const slug of slugs) {
    const family = manifest.loadPreviewFamily(slug);
    const file = loaded.get(slug);
    expect(family.rawEntries.map((entry) => entry.movementId)).toEqual(
      file.entries.map((entry) => entry.movementId),
    );
    expect(family.rawEntries.length).toBeGreaterThan(0);
    expect(family.entries.length).toBe(family.rawEntries.length);
  }
  expect(slugs).toEqual(familyFiles.map(slugOfFile));
});

test('the app reads every carried movement, and refuses one it does not carry', () => {
  expect(manifest.rawPreviewEntries().map((entry) => entry.movementId)).toEqual(index.movementOrder);
  expect(manifest.previewEntries().length).toBe(index.movementOrder.length);
  expect(manifest.resolveMovementPreview({ movement_id: 999999 }, { status: 'complete' })).toBeNull();
});