/** DeviceBackupPolicy.test.js — iOS keeps app data out of automatic device
 *  backup by excluding the two app-data DIRECTORIES (new and replaced files
 *  inherit it); Android relies on allowBackup="false"; failures never throw. */
import { Platform } from 'react-native';
import { excludeAppDataFromDeviceBackup, startDeviceBackupExclusion, startupDeviceBackupExclusion } from '../../src/state/deviceBackupPolicy';

const mockExcluded = [];
let mockFail = false;
jest.mock('react-native-blob-util', () => ({ default: {
  fs: { dirs: { DocumentDir: '/sandbox/Documents/', LibraryDir: '/sandbox/Library' } },
  ios: { excludeFromBackupKey: async (path) => { if (mockFail) throw new Error('synthetic'); mockExcluded.push(path); } },
} }));

let os;
beforeEach(() => { os = Platform.OS; mockExcluded.length = 0; mockFail = false; });
afterEach(() => { Platform.OS = os; });

test('iOS excludes the Documents and Library directories', async () => {
  Platform.OS = 'ios';
  expect(await excludeAppDataFromDeviceBackup()).toBe('excluded');
  expect(mockExcluded).toEqual(['/sandbox/Documents', '/sandbox/Library']);
});

test('Android is governed by allowBackup="false" and touches nothing', async () => {
  Platform.OS = 'android';
  expect(await excludeAppDataFromDeviceBackup()).toBe('not_applicable');
  expect(mockExcluded).toEqual([]);
});

test('a native failure is reported, never thrown', async () => {
  Platform.OS = 'ios';
  mockFail = true;
  await expect(excludeAppDataFromDeviceBackup()).resolves.toBe('failed');
});

test('the startup run keeps its outcome for the native smoke and logs a failure loudly', async () => {
  Platform.OS = 'ios';
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    expect(await startDeviceBackupExclusion()).toBe('excluded');
    expect(await startupDeviceBackupExclusion()).toBe('excluded');
    expect(warn).not.toHaveBeenCalled();
    mockFail = true;
    expect(await startDeviceBackupExclusion()).toBe('failed');
    expect(await startupDeviceBackupExclusion()).toBe('failed');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[ak-device-backup] failed'));
  } finally {
    warn.mockRestore();
  }
});
