/** BackupPickerBoundary.test.js — the Files import boundary, end to end in
 *  JavaScript: the production backup store calls the INSTALLED
 *  @react-native-documents/picker JavaScript (not a mock of it), and only the
 *  native TurboModule underneath is a recording stub. What the stub receives is
 *  exactly what the native bridge gets.
 *
 *  On iOS that bridge resolves every `type` entry with `UTType(identifier)`
 *  (ios/swift/PickerOptions.swift, `types.compactMap { UTType($0) }`): a MIME
 *  string resolves to nil and is silently dropped, leaving the picker with no
 *  selectable type. So every iOS entry must be a type identifier the library
 *  itself declares, never a MIME string. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Platform } from 'react-native';

const mockNative = { pick: jest.fn(), keepLocalCopy: jest.fn() };
jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => {
  const real = jest.requireActual('react-native/Libraries/TurboModule/TurboModuleRegistry');
  return {
    ...real,
    getEnforcing: (name) => (name === 'RNDocumentPicker' ? mockNative : real.getEnforcing(name)),
    get: (name) => (name === 'RNDocumentPicker' ? mockNative : real.get(name)),
  };
});

const mockFiles = new Map();
const mockUnlinked = [];
jest.mock('react-native-blob-util', () => ({ default: { fs: {
  dirs: { DocumentDir: '/sandbox/Documents', CacheDir: '/sandbox/Caches', LibraryDir: '/sandbox/Library' },
  async exists(path) { return mockFiles.has(path); },
  async stat(path) { return { size: mockFiles.get(path)?.length ?? 0 }; },
  async readFile(path) { return mockFiles.get(path); },
  async unlink(path) { mockUnlinked.push(path); mockFiles.delete(path); },
  async ls() { return []; },
  async mkdir() {},
} } }));
jest.mock('@op-engineering/op-sqlite', () => ({ open: () => { throw new Error('no database may open on this path'); } }));
jest.mock('../../src/state/useStore', () => ({ closeStoreDatabaseForRestore: jest.fn(), restartStoreAfterRestore: jest.fn() }));

const cancelled = () => Object.assign(new Error('user canceled the document picker'), { code: 'OPERATION_CANCELED' });

let os;
beforeEach(() => {
  os = Platform.OS;
  mockNative.pick.mockReset();
  mockNative.keepLocalCopy.mockReset();
  mockFiles.clear();
  mockUnlinked.length = 0;
});
afterEach(() => { Platform.OS = os; });

/** A fresh module graph for one platform: the library picks its type table
 *  from Platform.OS when it loads, exactly as on a device. */
function load(platform) {
  Platform.OS = platform;
  let modules;
  jest.isolateModules(() => {
    const lock = require('../../src/state/dataMaintenanceLock');
    lock.resetDataMaintenanceLockForTests();
    lock.authorizeAthleteDataBoot();
    const store = require('../../src/state/backupStore');
    store.useBackupStore.setState({ startupSafe: true, status: 'idle', message: null, preview: null });
    modules = { store, picker: require('@react-native-documents/picker') };
  });
  return modules;
}

test('the iOS library source this contract relies on still maps types with UTType(identifier)', () => {
  const root = join(__dirname, '..', '..', '..', '..', 'node_modules', '@react-native-documents', 'picker');
  const options = readFileSync(join(root, 'ios', 'swift', 'PickerOptions.swift'), 'utf8');
  expect(options).toContain('types.compactMap { UTType($0) }');
  expect(options).not.toContain('UTType(mimeType:');
  expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version).toBe('12.0.2');
});

test('iOS: the Files sheet gets the library\'s all-files type identifier, never a MIME string', async () => {
  const { store, picker } = load('ios');
  mockNative.pick.mockRejectedValue(cancelled());
  await store.useBackupStore.getState().chooseRestore('restore-password');

  expect(mockNative.pick).toHaveBeenCalledTimes(1);
  const sent = mockNative.pick.mock.calls[0][0];
  expect(sent.type).toEqual(['public.item']);
  expect(picker.types.allFiles).toBe('public.item');
  for (const entry of sent.type) {
    expect(entry).not.toContain('/'); // a MIME string would resolve to nil
    expect(Object.values(picker.types)).toContain(entry); // declared by the installed library for iOS
  }
  expect(sent).toMatchObject({ mode: 'import', allowMultiSelection: false, allowVirtualFiles: false });
  // Cancelling is a clean no-op.
  expect(store.useBackupStore.getState()).toMatchObject({ status: 'idle', message: 'Restore cancelled. Your data is unchanged.', preview: null });
  expect(mockNative.keepLocalCopy).not.toHaveBeenCalled();
});

test('iOS: a selected file is copied privately, then refused by encrypted validation and removed', async () => {
  const { store } = load('ios');
  mockNative.pick.mockResolvedValue([{ uri: 'file:///provider/pikeMethods-2026-10-04.pmbak', name: 'pikeMethods-2026-10-04.pmbak', size: 64,
    type: 'public.data', nativeType: 'public.data', error: null, isVirtual: false, convertibleToMimeTypes: null }]);
  mockNative.keepLocalCopy.mockImplementation(async ({ files }) => {
    mockFiles.set('/sandbox/Caches/pikeMethods-2026-10-04.pmbak', '{"not":"an encrypted backup"}');
    return [{ status: 'success', sourceUri: files[0].uri, localUri: 'file:///sandbox/Caches/pikeMethods-2026-10-04.pmbak' }];
  });
  await store.useBackupStore.getState().chooseRestore('restore-password');

  expect(mockNative.keepLocalCopy).toHaveBeenCalledWith({
    files: [{ uri: 'file:///provider/pikeMethods-2026-10-04.pmbak', fileName: 'pikeMethods-2026-10-04.pmbak' }], destination: 'cachesDirectory',
  });
  const state = store.useBackupStore.getState();
  expect(state.status).toBe('error');
  expect(state.message).not.toMatch(/Data recovery|Recovery cleanup/);
  expect(state.preview).toBeNull();
  expect(mockUnlinked).toContain('/sandbox/Caches/pikeMethods-2026-10-04.pmbak');
});

test('iOS: an oversized provider file is refused before any private copy', async () => {
  const { store } = load('ios');
  mockNative.pick.mockResolvedValue([{ uri: 'file:///provider/huge.pmbak', name: 'huge.pmbak', size: 1024 ** 4,
    type: 'public.data', nativeType: 'public.data', error: null, isVirtual: false, convertibleToMimeTypes: null }]);
  await store.useBackupStore.getState().chooseRestore('restore-password');
  expect(mockNative.pick).toHaveBeenCalledTimes(1);
  expect(mockNative.keepLocalCopy).not.toHaveBeenCalled();
  expect(store.useBackupStore.getState()).toMatchObject({ status: 'error', preview: null });
  expect(store.useBackupStore.getState().message).not.toMatch(/Data recovery|Recovery cleanup/);
});

test('Android keeps its MIME filter (the Android bridge filters by MIME type)', async () => {
  const { store } = load('android');
  mockNative.pick.mockRejectedValue(cancelled());
  await store.useBackupStore.getState().chooseRestore('restore-password');
  expect(mockNative.pick.mock.calls[0][0].type).toEqual(['application/octet-stream']);
});
