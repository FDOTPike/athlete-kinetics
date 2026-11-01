import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractEntryToBuffer, readZipEntries } from './verify_qa_artifact.mjs';

const ENTRY_LIMIT = 128 * 1024 * 1024;
const TOTAL_LIMIT = 512 * 1024 * 1024;

export function extractAlignmentInputs(apk, out) {
  if (statSync(apk).size > TOTAL_LIMIT) throw new Error('APK exceeds extraction byte budget');
  const { entries } = readZipEntries(apk);
  const selected = [...entries.values()].filter(({ name }) =>
    /^lib\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.+-]+\.so$/.test(name)
    || name === 'assets/minilm.onnx' || name === 'base/assets/minilm.onnx');
  let declaredTotal = 0;
  for (const entry of selected) {
    declaredTotal += entry.uncompSize;
    if (selected.length > 4096 || entry.uncompSize > ENTRY_LIMIT || declaredTotal > TOTAL_LIMIT) {
      throw new Error('APK inputs exceed extraction byte budget');
    }
  }
  let written = 0;
  for (const entry of selected) {
    // Bound actual inflation even when the central directory lies about size.
    const bytes = extractEntryToBuffer(apk, entry, Math.min(ENTRY_LIMIT, TOTAL_LIMIT - written));
    if (bytes.length !== entry.uncompSize) throw new Error(`ZIP expansion size mismatch: ${entry.name}`);
    written += bytes.length;
    const path = join(out, ...entry.name.split('/'));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    extractAlignmentInputs(process.argv[2], process.argv[3]);
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exitCode = 2;
  }
}
