import { gcm } from '@noble/ciphers/aes.js';
import { bytesToHex, utf8ToBytes } from '@noble/ciphers/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';
import {
  BACKUP_CIPHER,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_KDF,
  BACKUP_KDF_KEY_BYTES,
  BACKUP_KDF_N,
  BACKUP_KDF_P,
  BACKUP_KDF_R,
  BACKUP_RESTORE_POLICY,
  BACKUP_TAG_BYTES,
  base64ToBytes,
  bytesToBase64,
  canonicalJson,
  openBackup,
  sealBackup,
} from '@ak/core-db';
import { strictUtf8Decode } from '../../src/state/backupCrypto';

const fixedKey = new Uint8Array(32).fill(0x5a);
const testCrypto = {
  randomBytes: (length) => new Uint8Array(length).fill(length),
  deriveScryptKey: async () => fixedKey.slice(),
  encryptAes256Gcm: async (key, nonce, plaintext, aad) => gcm(key, nonce, aad).encrypt(plaintext),
  decryptAes256Gcm: async (key, nonce, ciphertext, aad) => gcm(key, nonce, aad).decrypt(ciphertext),
  sha256Hex: (bytes) => bytesToHex(sha256(bytes)),
  utf8Encode: utf8ToBytes,
  utf8Decode: strictUtf8Decode,
};

function databaseBytes(byteLength) {
  const bytes = new Uint8Array(byteLength);
  const header = 'SQLite format 3\0';
  for (let index = 0; index < header.length; index += 1) bytes[index] = header.charCodeAt(index);
  return bytes;
}

test('opens an exact-scale all-athlete archive without a global TextDecoder', async () => {
  // 1,347,584 database bytes produce the same ~1.8 MiB authenticated
  // plaintext scale as the Android backup that exposed Hermes' missing
  // TextDecoder. Include astral Unicode so surrogate handling is exercised.
  const bytes = databaseBytes(1_347_584);
  const databaseBase64 = bytesToBase64(bytes);
  const archive = {
    archiveVersion: 1,
    backupId: '0123456789abcdef0123456789abcdef',
    createdAt: '2026-09-13T10:00:47.390Z',
    sourceAppVersion: '0.1.0',
    sourceSchemaVersion: 63,
    sourceMigrationSlot: 64,
    scope: 'all-athletes',
    restorePolicy: BACKUP_RESTORE_POLICY,
    registry: {
      version: 1,
      activeId: 'default',
      advancedToolsUnlocked: false,
      athletes: [{ id: 'default', name: 'Ava 🏋️', dbName: 'athlete_kinetics.db', createdAtMs: 0 }],
    },
    databases: [{
      athleteId: 'default',
      dbName: 'athlete_kinetics.db',
      byteLength: bytes.length,
      sha256Hex: bytesToHex(sha256(bytes)),
      userVersion: 63,
      tableCount: 104,
      databaseBase64,
    }],
    previousSuccessfulBackupAt: null,
  };
  expect(databaseBase64.length).toBeGreaterThan(1_790_000);
  const sealed = await sealBackup(archive, 'hermes-test-password', testCrypto);

  const originalTextDecoder = global.TextDecoder;
  Object.defineProperty(global, 'TextDecoder', { configurable: true, writable: true, value: undefined });
  try {
    const opened = await openBackup(sealed, 'hermes-test-password', testCrypto);
    expect(opened.ok).toBe(true);
    expect(opened.archive.registry.athletes[0].name).toBe('Ava 🏋️');
    expect(base64ToBytes(opened.archive.databases[0].databaseBase64)).toEqual(bytes);
  } finally {
    Object.defineProperty(global, 'TextDecoder', { configurable: true, writable: true, value: originalTextDecoder });
  }
});

test.each([
  [0x80],                         // stray continuation
  [0xc0, 0xaf],                   // overlong ASCII
  [0xe0, 0x80, 0x80],             // overlong NUL
  [0xed, 0xa0, 0x80],             // encoded surrogate
  [0xf4, 0x90, 0x80, 0x80],       // above U+10FFFF
  [0xf0, 0x9f, 0x92],             // truncated sequence
])('strict decoder rejects malformed UTF-8 %#', (...values) => {
  expect(() => strictUtf8Decode(Uint8Array.from(values))).toThrow('Backup plaintext is not valid UTF-8.');
});

test('malformed authenticated plaintext is classified as an invalid archive', async () => {
  const metadata = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    kdf: {
      algorithm: BACKUP_KDF,
      N: BACKUP_KDF_N,
      r: BACKUP_KDF_R,
      p: BACKUP_KDF_P,
      keyBytes: BACKUP_KDF_KEY_BYTES,
      saltBase64: bytesToBase64(new Uint8Array(16)),
    },
    cipher: {
      algorithm: BACKUP_CIPHER,
      nonceBase64: bytesToBase64(new Uint8Array(12)),
      tagBytes: BACKUP_TAG_BYTES,
    },
    ciphertextBase64: 'AA==',
  };
  const malformedProvider = {
    ...testCrypto,
    decryptAes256Gcm: async () => Uint8Array.from([0xc0, 0xaf]),
  };
  const result = await openBackup(canonicalJson(metadata), 'hermes-test-password', malformedProvider);
  expect(result).toEqual({
    ok: false,
    code: 'invalid_archive',
    message: 'Authenticated backup contents are invalid.',
  });
});
