/**
 * #173: the backup-size estimate reads the athlete registry and the database
 * file sizes. A registry that cannot be read must give "unknown" (so the
 * count decides), not the default one-athlete registry that boot falls back to.
 */
const mockFiles = new Map();
const mockFs = {
  dirs: { DocumentDir: '/private/Documents', CacheDir: '/private/Cache', LibraryDir: '/private/Library' },
  exists: jest.fn(async (path) => mockFiles.has(path)),
  readFile: jest.fn(async (path) => {
    const value = mockFiles.get(path);
    if (value instanceof Error) throw value;
    return value;
  }),
  stat: jest.fn(async () => ({ size: 1_400_832 })),
};

jest.mock('react-native-blob-util', () => ({ default: { fs: mockFs } }));
jest.mock('@op-engineering/op-sqlite', () => ({ open: jest.fn() }));
jest.mock('../../src/state/backupCrypto', () => ({ mobileBackupCrypto: {} }));
jest.mock('../../src/state/useStore', () => ({
  closeStoreDatabaseForRestore: jest.fn(), restartStoreAfterRestore: jest.fn(),
}));

import { loadRegistry } from '../../src/state/athleteRegistry';
import { REGISTRY_FILE } from '../../src/state/athleteRegistryCore';
import { measureBackupSize } from '../../src/state/backupCapacity';

const registryPath = `/private/Documents/${REGISTRY_FILE}`;
const twoAthletes = JSON.stringify({
  version: 1,
  activeId: 'default',
  advancedToolsUnlocked: true,
  athletes: [
    { id: 'default', name: 'Athlete 1', dbName: 'athlete_kinetics.db', createdAtMs: 0 },
    { id: 'a1b2c3d4', name: 'Alex', dbName: 'ak_athlete_a1b2c3d4.db', createdAtMs: 1 },
  ],
});

beforeEach(() => {
  mockFiles.clear();
  mockFs.stat.mockClear();
});

test('a readable registry gives one size per registered athlete', async () => {
  mockFiles.set(registryPath, twoAthletes);
  const estimate = await measureBackupSize();
  expect(estimate).toEqual(expect.objectContaining({ athleteCount: 2, totalBytes: 2 * 1_400_832 }));
});

test('a registry read failure gives no estimate, while boot still falls back to the default registry', async () => {
  mockFiles.set(registryPath, new Error('EIO: registry read failed'));
  await expect(measureBackupSize()).resolves.toBeNull();
  expect(mockFs.stat).not.toHaveBeenCalled();
  // Boot behaviour is unchanged: the same failure still yields the default registry.
  const fallback = await loadRegistry();
  expect(fallback.athletes.map((athlete) => athlete.id)).toEqual(['default']);
});

test('no registry file yet is a fresh install: one default athlete is measured', async () => {
  const estimate = await measureBackupSize();
  expect(estimate).toEqual(expect.objectContaining({ athleteCount: 1 }));
});
