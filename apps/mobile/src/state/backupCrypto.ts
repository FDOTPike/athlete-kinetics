import { gcm } from '@noble/ciphers/aes.js';
import { bytesToHex, bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils.js';
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
  utf8Decode: bytesToUtf8,
};
