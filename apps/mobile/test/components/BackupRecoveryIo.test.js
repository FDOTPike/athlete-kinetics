const mockOpen = jest.fn();
const mockWriteFile = jest.fn();
const mockMkdir = jest.fn();
const mockFs = {
  dirs: { DocumentDir: '/private/Documents', CacheDir: '/private/Cache', LibraryDir: '/private/Library' },
  exists: jest.fn(async (path) => path.endsWith('.ak_restore_journal.json')),
  readFile: jest.fn(async () => '{}'),
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
};

jest.mock('react-native-blob-util', () => ({ default: { fs: mockFs } }));
jest.mock('@op-engineering/op-sqlite', () => ({ open: (...args) => mockOpen(...args) }));
jest.mock('../../src/state/backupCrypto', () => ({ mobileBackupCrypto: {} }));
jest.mock('../../src/state/useStore', () => ({
  closeStoreDatabaseForRestore: jest.fn(), restartStoreAfterRestore: jest.fn(),
}));
jest.mock('../../src/state/athleteRegistry', () => ({ loadRegistry: jest.fn() }));

import { recoverInterruptedRestore } from '../../src/state/backupStore';

test('missing active database plus invalid journal never opens or creates SQLite', async () => {
  await expect(recoverInterruptedRestore()).rejects.toThrow(/journal is invalid/);
  expect(mockOpen).not.toHaveBeenCalled();
  expect(mockWriteFile).not.toHaveBeenCalled();
  expect(mockMkdir).not.toHaveBeenCalled();
});
