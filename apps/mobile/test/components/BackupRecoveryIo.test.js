const mockOpen = jest.fn();
const mockWriteFile = jest.fn();
const mockMkdir = jest.fn();
const files = new Set(['/private/Documents/.ak_restore_journal.json']);
const mockUnlink = jest.fn(async (path) => { files.delete(path); });
const mockFs = {
  dirs: { DocumentDir: '/private/Documents', CacheDir: '/private/Cache', LibraryDir: '/private/Library' },
  exists: jest.fn(async (path) => files.has(path)),
  readFile: jest.fn(async () => '{}'),
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
  unlink: mockUnlink,
  ls: jest.fn(async () => []),
};

jest.mock('react-native-blob-util', () => ({ default: { fs: mockFs } }));
jest.mock('@op-engineering/op-sqlite', () => ({ open: (...args) => mockOpen(...args) }));
jest.mock('../../src/state/backupCrypto', () => ({ mobileBackupCrypto: {} }));
jest.mock('../../src/state/useStore', () => ({
  closeStoreDatabaseForRestore: jest.fn(), restartStoreAfterRestore: jest.fn(),
}));
jest.mock('../../src/state/athleteRegistry', () => ({ loadRegistry: jest.fn() }));

import { recoverInterruptedRestore } from '../../src/state/backupStore';

test('invalid preparation-only journal is removed without opening or creating SQLite', async () => {
  await expect(recoverInterruptedRestore()).resolves.toBe(false);
  expect(mockOpen).not.toHaveBeenCalled();
  expect(mockWriteFile).not.toHaveBeenCalled();
  expect(mockMkdir).not.toHaveBeenCalled();
  expect(mockUnlink).toHaveBeenCalledWith('/private/Documents/.ak_restore_journal.json');
});
