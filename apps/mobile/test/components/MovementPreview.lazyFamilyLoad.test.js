/**
 * R2 Part C: the app loads ONE family, the first time one of its movements is
 * shown, and caches it. Every other preview suite reads the merged data or the
 * files themselves, so without this test an eager-loading regression would pass
 * every suite and both size gates.
 *
 * The loader table is wrapped here (never in the app) so that every call the app
 * makes is counted: one require for the shown movement's family, none on a
 * re-show (the family stays cached), and a movement in another family loads only
 * that other file.
 */
import fs from 'fs';
import path from 'path';

const mockLoads = {};

jest.mock('../../src/components/movementPreview/familyLoaders', () => {
  const actual = jest.requireActual('../../src/components/movementPreview/familyLoaders');
  const wrapped = {};
  for (const slug of Object.keys(actual.FAMILY_LOADERS)) {
    wrapped[slug] = () => {
      mockLoads[slug] = (mockLoads[slug] ?? 0) + 1;
      return actual.FAMILY_LOADERS[slug]();
    };
  }
  return { ...actual, FAMILY_LOADERS: wrapped };
});

const REVIEW = { status: 'complete' };

/**
 * The subject the resolver needs: the movement id plus the media row it must
 * match (assetKey equal to the entry's, status 'ready'). The asset key is read
 * from the family FILE on disk, never through the loaders, so reading it cannot
 * disturb the load counts this suite measures.
 */
const subjectFor = (movementId, slug) => {
  const file = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'components', 'movementPreview', 'families', `${slug}.json`),
    'utf8',
  ));
  const entry = file.entries.find((candidate) => candidate.movementId === movementId);
  if (entry === undefined) throw new Error(`movement ${movementId} is not in ${slug}.json`);
  return { movement_id: movementId, media: { assetKey: entry.assetKey, status: 'ready' } };
};

const resetCounts = () => {
  for (const slug of Object.keys(mockLoads)) delete mockLoads[slug];
};

const loadManifestFresh = () => {
  // A fresh module registry per call: the loader cache lives in the module.
  let manifest;
  jest.isolateModules(() => {
    manifest = require('../../src/components/movementPreview/manifest');
  });
  return manifest;
};

test('showing a movement requires its own family file once, and no other', () => {
  resetCounts();
  const manifest = loadManifestFresh();
  expect(manifest.resolveMovementPreview(subjectFor(28, 'squat__standing'), REVIEW)).not.toBeNull();
  expect(mockLoads).toEqual({ squat__standing: 1 });
});

test('the second show of the same movement does not require the file again', () => {
  resetCounts();
  const manifest = loadManifestFresh();
  expect(manifest.resolveMovementPreview(subjectFor(28, 'squat__standing'), REVIEW)).not.toBeNull();
  expect(manifest.resolveMovementPreview(subjectFor(28, 'squat__standing'), REVIEW)).not.toBeNull();
  expect(mockLoads).toEqual({ squat__standing: 1 });
});

test('a movement in another family loads only that other file', () => {
  resetCounts();
  const manifest = loadManifestFresh();
  expect(manifest.resolveMovementPreview(subjectFor(28, 'squat__standing'), REVIEW)).not.toBeNull();
  expect(mockLoads).toEqual({ squat__standing: 1 });
  expect(manifest.resolveMovementPreview(subjectFor(88, 'hip-hinge__standing'), REVIEW)).not.toBeNull();
  expect(mockLoads).toEqual({ squat__standing: 1, 'hip-hinge__standing': 1 });
  expect(manifest.resolveMovementPreview(subjectFor(16, 'push-up__floor'), REVIEW)).not.toBeNull();
  expect(mockLoads).toEqual({ squat__standing: 1, 'hip-hinge__standing': 1, 'push-up__floor': 1 });
});