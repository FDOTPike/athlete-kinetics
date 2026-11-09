// Node crypto adapter for the backup contract. The primitives are the same as
// packages/core-db/test/backup/verify_backup_contract.mjs:15-36 (scrypt with the
// contract's parameters, AES-256-GCM with the outer metadata as AAD, SHA-256).
// It supplies primitives only: openBackup and sealBackup do all parsing,
// authentication and validation. Nothing here decrypts on its own.
import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt } from 'node:crypto';

export const nodeCryptoProvider = {
  randomBytes(length) { return new Uint8Array(randomBytes(length)); },
  deriveScryptKey(password, salt, parameters) {
    return new Promise((resolve, reject) => scrypt(password, salt, parameters.dkLen, {
      N: parameters.N, r: parameters.r, p: parameters.p, maxmem: 80 * 1024 * 1024,
    }, (error, key) => error ? reject(error) : resolve(new Uint8Array(key))));
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
