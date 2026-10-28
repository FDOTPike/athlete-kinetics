import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { extractEntryToBuffer, validateNewFiles } from './verify_qa_artifact.mjs';

const sha256 = 'a'.repeat(64);
for (const path of ['./file', 'dir//file', 'dir/./file', 'dir/file/']) {
  assert.equal(validateNewFiles([{ path, sha256 }]).ok, false, path);
}
const scratch = mkdtempSync(join(tmpdir(), 'qa-security-'));
try {
  const path = join(scratch, 'deflate');
  const compressed = deflateRawSync(Buffer.alloc(2 * 1024 * 1024));
  writeFileSync(path, compressed);
  // A forged small central-directory size must not bypass the inflate budget.
  assert.throws(() => extractEntryToBuffer(path, {
    method: 8, compSize: compressed.length, uncompSize: 1, dataOffset: 0,
  }, 1024 * 1024));
  assert.throws(() => extractEntryToBuffer(path, {
    method: 0, compSize: compressed.length, uncompSize: compressed.length, dataOffset: 0,
  }, 8));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
console.log('QA security tests: 6 checks passed.');
