const mockWriteFile = jest.fn(async () => {});
jest.mock('react-native-blob-util', () => ({
  default: { fs: { dirs: { DocumentDir: '/doc' }, writeFile: mockWriteFile } },
}));

import { saveRegistry } from '../../src/state/athleteRegistry';
import {
  acquireDataMaintenanceLock,
  authorizeAthleteDataBoot,
  resetDataMaintenanceLockForTests,
  revokeAthleteDataBoot,
} from '../../src/state/dataMaintenanceLock';

const registry = {
  version: 1,
  activeId: 'default',
  athletes: [{ id: 'default', name: 'Athlete 1', dbName: 'athlete_kinetics.db', createdAtMs: 0 }],
  advancedToolsUnlocked: false,
};

beforeEach(() => {
  resetDataMaintenanceLockForTests();
  mockWriteFile.mockClear();
});

test('registry writes require both startup boot authority and a free maintenance lock', async () => {
  await expect(saveRegistry(registry)).resolves.toBe(false);
  expect(mockWriteFile).not.toHaveBeenCalled();

  authorizeAthleteDataBoot();
  await expect(saveRegistry(registry)).resolves.toBe(true);
  expect(mockWriteFile).toHaveBeenCalledTimes(1);

  revokeAthleteDataBoot();
  await expect(saveRegistry(registry)).resolves.toBe(false);
  expect(mockWriteFile).toHaveBeenCalledTimes(1);

  authorizeAthleteDataBoot();
  const release = acquireDataMaintenanceLock('registry-gate-test');
  try {
    await expect(saveRegistry(registry)).resolves.toBe(false);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  } finally {
    release();
  }
});

test('a registry write holds a mutation lease until the write settles, so maintenance cannot start inside it', async () => {
  authorizeAthleteDataBoot();
  let finishWrite;
  mockWriteFile.mockImplementationOnce(() => new Promise((resolve) => { finishWrite = resolve; }));
  const saving = saveRegistry(registry);
  await Promise.resolve();
  expect(mockWriteFile).toHaveBeenCalledTimes(1);

  expect(() => acquireDataMaintenanceLock('snapshot-during-registry-write')).toThrow();

  finishWrite();
  await expect(saving).resolves.toBe(true);
  const release = acquireDataMaintenanceLock('snapshot-after-registry-write');
  release();
});
