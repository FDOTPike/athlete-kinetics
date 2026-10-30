import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

let mockRoot;
let mockDocumentDir;
let mockCacheDir;
let mockLibraryDir;
let mockSelectedBackupPath;
let mockSelectedSize;

const mockKeepLocalCopy = jest.fn(async () => {
  const localPath = `${mockCacheDir}/selected-local.pmbak`;
  require('node:fs').copyFileSync(mockSelectedBackupPath, localPath);
  return [{ status: 'success', localUri: localPath }];
});

const mockHashFile = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const mockFs = {
  dirs: { DocumentDir: '', CacheDir: '', LibraryDir: '' },
  async exists(path) { return existsSync(path); },
  async readFile(path, encoding) {
    return encoding === 'base64' ? readFileSync(path).toString('base64') : readFileSync(path, 'utf8');
  },
  async writeFile(path, data, encoding) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, encoding === 'base64' ? Buffer.from(data, 'base64') : data);
  },
  async unlink(path) { rmSync(path, { recursive: true, force: true }); },
  async mkdir(path) { mkdirSync(path, { recursive: true }); },
  async ls(path) { return existsSync(path) ? readdirSync(path) : []; },
  async cp(path, destination) { copyFileSync(path, destination); return undefined; },
  async mv(path, destination) { renameSync(path, destination); return undefined; },
  async stat(path) { return { size: statSync(path).size }; },
  async hash(path) { return mockHashFile(path); },
  async df() { return { internal_free: 1024 * 1024 * 1024 }; },
};

const mockCryptoProvider = {
  randomBytes(length) { return new Uint8Array(randomBytes(length)); },
  async deriveScryptKey(password, salt) {
    return new Uint8Array(createHash('sha256').update(password).update(salt).digest());
  },
  async encryptAes256Gcm(key, nonce, plaintext, aad) {
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(aad);
    return new Uint8Array(Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]));
  },
  async decryptAes256Gcm(key, nonce, encrypted, aad) {
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAAD(aad);
    decipher.setAuthTag(encrypted.subarray(encrypted.length - 16));
    return new Uint8Array(Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]));
  },
  sha256Hex(bytes) { return createHash('sha256').update(bytes).digest('hex'); },
  utf8Encode(text) { return new Uint8Array(Buffer.from(text, 'utf8')); },
  utf8Decode(bytes) { return Buffer.from(bytes).toString('utf8'); },
};

const mockCloseStore = jest.fn();
const mockRestartStore = jest.fn();

function mockOpenDatabase(options) {
  const path = `${options.location ?? mockLibraryDir}/${options.name}`;
  const raw = new DatabaseSync(path);
  raw.function('restore_probe', () => 1);
  return {
    executeSync(sql) {
      const statement = sql.trim();
      if (/^(?:SELECT|PRAGMA\s+(?![^;=]+\s*=))/i.test(statement)) return { rows: raw.prepare(statement).all() };
      raw.exec(statement);
      return { rows: [] };
    },
    close() { raw.close(); },
  };
}

jest.mock('react-native-blob-util', () => ({ default: { fs: mockFs } }));
jest.mock('@op-engineering/op-sqlite', () => ({ open: (options) => mockOpenDatabase(options) }));
jest.mock('../../src/state/backupCrypto', () => ({
  mobileBackupCrypto: {
    randomBytes: (...args) => mockCryptoProvider.randomBytes(...args),
    deriveScryptKey: (...args) => mockCryptoProvider.deriveScryptKey(...args),
    encryptAes256Gcm: (...args) => mockCryptoProvider.encryptAes256Gcm(...args),
    decryptAes256Gcm: (...args) => mockCryptoProvider.decryptAes256Gcm(...args),
    sha256Hex: (...args) => mockCryptoProvider.sha256Hex(...args),
    utf8Encode: (...args) => mockCryptoProvider.utf8Encode(...args),
    utf8Decode: (...args) => mockCryptoProvider.utf8Decode(...args),
  },
}));
jest.mock('../../src/state/useStore', () => ({
  closeStoreDatabaseForRestore: (...args) => mockCloseStore(...args),
  restartStoreAfterRestore: (...args) => mockRestartStore(...args),
}));
jest.mock('@react-native-documents/picker', () => ({
  types: { allFiles: 'public.item' },
  pick: async () => [{ uri: mockSelectedBackupPath, name: 'selected.pmbak', size: mockSelectedSize }],
  keepLocalCopy: (...args) => mockKeepLocalCopy(...args),
  saveDocuments: async () => [{ error: null, uri: 'content://saved/backup' }],
  isErrorWithCode: () => false,
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
}));

import {
  BACKUP_SCHEMA_MIGRATION_SLOT,
  BACKUP_SCHEMA_TABLE_COUNT,
  BACKUP_SCHEMA_USER_VERSION,
  bytesToBase64,
  sealBackup,
} from '@ak/core-db';
import BackupTransferPanel from '../../src/components/BackupTransferPanel';
import { serializeRegistry } from '../../src/state/athleteRegistryCore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import { useBackupStore } from '../../src/state/backupStore';

const schemaDirectory = join(__dirname, '..', '..', '..', '..', 'packages', 'core-db', 'src', 'schema');

function makeDatabase(path, applicationId) {
  const db = new DatabaseSync(path);
  for (const name of readdirSync(schemaDirectory).filter((item) => /^0\d\d_.*\.sql$/.test(item) && !item.startsWith('004_')).sort()) {
    db.exec(readFileSync(join(schemaDirectory, name), 'utf8'));
  }
  db.exec(`PRAGMA user_version=${BACKUP_SCHEMA_USER_VERSION}; PRAGMA application_id=${applicationId};`);
  assert.equal(db.prepare('PRAGMA quick_check').get().quick_check, 'ok');
  db.close();
  return new Uint8Array(readFileSync(path));
}

function snapshot(athleteId, dbName, bytes) {
  return {
    athleteId,
    dbName,
    byteLength: bytes.length,
    sha256Hex: mockCryptoProvider.sha256Hex(bytes),
    userVersion: BACKUP_SCHEMA_USER_VERSION,
    tableCount: BACKUP_SCHEMA_TABLE_COUNT,
    databaseBase64: bytesToBase64(bytes),
  };
}

describe('BackupTransferPanel restore preview password retention', () => {
  beforeEach(async () => {
    resetDataMaintenanceLockForTests();
    authorizeAthleteDataBoot();
    mockCloseStore.mockClear();
    mockRestartStore.mockClear();
    mockKeepLocalCopy.mockClear();
    mockRoot = mkdtempSync(join(tmpdir(), 'ak-backup-preview-pwd-'));
    mockDocumentDir = join(mockRoot, 'Documents').replaceAll('\\', '/');
    mockCacheDir = join(mockRoot, 'Cache').replaceAll('\\', '/');
    mockLibraryDir = join(mockRoot, 'Library').replaceAll('\\', '/');
    for (const path of [mockDocumentDir, mockCacheDir, mockLibraryDir]) mkdirSync(path, { recursive: true });
    Object.assign(mockFs.dirs, { DocumentDir: mockDocumentDir, CacheDir: mockCacheDir, LibraryDir: mockLibraryDir });

    const currentRegistry = {
      version: 1,
      activeId: 'default',
      advancedToolsUnlocked: false,
      athletes: [{ id: 'default', name: 'Current Athlete', dbName: 'athlete_kinetics.db', createdAtMs: 0 }],
    };
    const incomingRegistry = {
      version: 1,
      activeId: 'default',
      advancedToolsUnlocked: false,
      athletes: [{ id: 'default', name: 'Restored Athlete', dbName: 'athlete_kinetics.db', createdAtMs: 0 }],
    };
    writeFileSync(join(mockDocumentDir, 'coach_athletes.json'), serializeRegistry(currentRegistry));
    makeDatabase(join(mockLibraryDir, 'athlete_kinetics.db'), 101);

    const incomingDirectory = join(mockRoot, 'Incoming');
    mkdirSync(incomingDirectory);
    const incomingDefault = makeDatabase(join(incomingDirectory, 'athlete_kinetics.db'), 201);
    const archive = {
      archiveVersion: 1,
      backupId: '00112233445566778899aabbccddeeff',
      createdAt: '2026-09-13T05:00:00.000Z',
      sourceAppVersion: '0.1.0',
      sourceSchemaVersion: BACKUP_SCHEMA_USER_VERSION,
      sourceMigrationSlot: BACKUP_SCHEMA_MIGRATION_SLOT,
      scope: 'all-athletes',
      restorePolicy: 'replace',
      registry: incomingRegistry,
      databases: [snapshot('default', 'athlete_kinetics.db', incomingDefault)],
      previousSuccessfulBackupAt: null,
    };
    mockSelectedBackupPath = join(mockRoot, 'selected.pmbak');
    writeFileSync(mockSelectedBackupPath, await sealBackup(archive, 'restore-password', mockCryptoProvider));
    mockSelectedSize = statSync(mockSelectedBackupPath).size;
    useBackupStore.getState().cancelRestore();
    useBackupStore.setState({ status: 'idle', startupSafe: true, message: null, preview: null, lastSuccessfulBackupAt: null, recoveryAvailable: false });
  });

  afterEach(() => rmSync(mockRoot, { recursive: true, force: true }));

  test('editing the password input while BACKUP PREVIEW is open does not seal the retained recovery backup under a different password than the one that unlocked the restore', async () => {
    const tree = render(<BackupTransferPanel />);
    const passwordInput = tree.getByLabelText('Backup password, at least 12 characters');

    fireEvent.changeText(passwordInput, 'restore-password');
    await act(async () => {
      fireEvent.press(tree.getByTestId('choose-restore-button'));
    });
    expect(useBackupStore.getState().status).toBe('preview');

    // While viewing the preview card, the user accidentally edits the password input before confirming.
    fireEvent.changeText(tree.getByLabelText('Backup password, at least 12 characters'), 'different-password-999');
    await act(async () => {
      fireEvent.press(tree.getByTestId('confirm-restore-button'));
    });

    expect(useBackupStore.getState().recoveryAvailable).toBe(true);
    expect(
      tree.getByText(/Review it using the password from that restore\./),
    ).toBeTruthy();

    // Now the athlete tries to review the retained recovery backup using the password that opened the restore ('restore-password').
    fireEvent.changeText(tree.getByLabelText('Backup password, at least 12 characters'), 'restore-password');
    await act(async () => {
      fireEvent.press(tree.getByTestId('review-recovery-button'));
    });

    expect({
      status: useBackupStore.getState().status,
      message: useBackupStore.getState().message,
    }).toEqual({
      status: 'preview',
      message: 'Review the previous data recovery before replacing current data.',
    });
  });
});
