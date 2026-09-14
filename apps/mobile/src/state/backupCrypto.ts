import { gcm } from '@noble/ciphers/aes.js';
import { bytesToHex, utf8ToBytes } from '@noble/ciphers/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { base64ToBytes, type BackupCryptoProvider } from '@ak/core-db';
import { TurboModuleRegistry, type TurboModule } from 'react-native';

interface RandomValuesModule extends TurboModule {
  getRandomBase64(byteLength: number): string;
}

/** Direct native call deliberately bypasses react-native-get-random-values'
 * remote-debugger Math.random fallback. If the platform CSPRNG module is not
 * installed, backup creation fails closed. */
function secureRandomBytes(length: number): Uint8Array {
  if (!Number.isInteger(length) || length < 1 || length > 65_536) throw new Error('Invalid secure-random request.');
  const native = TurboModuleRegistry.getEnforcing<RandomValuesModule>('RNGetRandomValues');
  const result = base64ToBytes(native.getRandomBase64(length), length);
  if (result.length !== length) throw new Error('Platform secure-random provider failed.');
  return result;
}

const UTF8_OUTPUT_CHUNK_CODE_UNITS = 8_192;

/** Hermes does not expose TextDecoder. Decode authenticated plaintext with a
 * bounded code-unit buffer and reject every non-canonical UTF-8 sequence. */
export function strictUtf8Decode(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array)) throw new Error('Backup plaintext is not valid UTF-8.');
  const chunks: string[] = [];
  const codeUnits: number[] = [];
  const flush = (): void => {
    if (codeUnits.length === 0) return;
    chunks.push(String.fromCharCode(...codeUnits));
    codeUnits.length = 0;
  };
  const push = (value: number): void => {
    codeUnits.push(value);
    if (codeUnits.length >= UTF8_OUTPUT_CHUNK_CODE_UNITS) flush();
  };
  const continuation = (index: number): number => {
    const value = bytes[index];
    if (value === undefined || value < 0x80 || value > 0xbf) {
      throw new Error('Backup plaintext is not valid UTF-8.');
    }
    return value;
  };

  for (let index = 0; index < bytes.length;) {
    const first = bytes[index]!;
    if (first <= 0x7f) {
      push(first);
      index += 1;
      continue;
    }
    if (first >= 0xc2 && first <= 0xdf) {
      const second = continuation(index + 1);
      push(((first & 0x1f) << 6) | (second & 0x3f));
      index += 2;
      continue;
    }
    if (first >= 0xe0 && first <= 0xef) {
      const second = continuation(index + 1);
      const third = continuation(index + 2);
      if ((first === 0xe0 && second < 0xa0) || (first === 0xed && second > 0x9f)) {
        throw new Error('Backup plaintext is not valid UTF-8.');
      }
      push(((first & 0x0f) << 12) | ((second & 0x3f) << 6) | (third & 0x3f));
      index += 3;
      continue;
    }
    if (first >= 0xf0 && first <= 0xf4) {
      const second = continuation(index + 1);
      const third = continuation(index + 2);
      const fourth = continuation(index + 3);
      if ((first === 0xf0 && second < 0x90) || (first === 0xf4 && second > 0x8f)) {
        throw new Error('Backup plaintext is not valid UTF-8.');
      }
      const point = ((first & 0x07) << 18) | ((second & 0x3f) << 12)
        | ((third & 0x3f) << 6) | (fourth & 0x3f);
      const astral = point - 0x10000;
      push(0xd800 | (astral >>> 10));
      push(0xdc00 | (astral & 0x3ff));
      index += 4;
      continue;
    }
    throw new Error('Backup plaintext is not valid UTF-8.');
  }
  flush();
  return chunks.join('');
}

/** Audited primitive adapter. Entropy comes from the platform CSPRNG installed
 * by react-native-get-random-values; no fallback (especially Math.random)
 * exists. Noble supplies RFC 7914 scrypt and NIST AES-GCM. */
export const mobileBackupCrypto: BackupCryptoProvider = {
  randomBytes: secureRandomBytes,
  deriveScryptKey: (password, salt, parameters) => scryptAsync(password, salt, {
    ...parameters,
    maxmem: 80 * 1024 * 1024,
    asyncTick: 8,
  }),
  encryptAes256Gcm: async (key, nonce, plaintext, aad) => gcm(key, nonce, aad).encrypt(plaintext),
  decryptAes256Gcm: async (key, nonce, ciphertextAndTag, aad) => gcm(key, nonce, aad).decrypt(ciphertextAndTag),
  sha256Hex: (bytes) => bytesToHex(sha256(bytes)),
  utf8Encode: utf8ToBytes,
  utf8Decode: strictUtf8Decode,
};
