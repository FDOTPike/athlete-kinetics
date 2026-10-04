/**
 * stage-native-embedder.mjs — copy the pinned, byte-verified MiniLM model into
 * a native app package as `minilm.onnx`.
 *
 *   node scripts/stage-native-embedder.mjs <destination> [--required]
 *
 * Used by the iOS "Stage embedder model" Xcode build phase (destination inside
 * the .app bundle) and by CI for Android assets. The source is the file
 * `npm run fetch:embedder` materialized; this script never downloads.
 *
 * - The source's SHA-256 must equal the ratified pin in embedder-integrity.mjs
 *   (KNOWN_SHA256['onnx/model_quantized.onnx']); a mismatch ALWAYS fails, so a
 *   wrong model can never be packaged.
 * - The copied destination is re-hashed and must match too.
 * - A missing source fails with --required (Release/CI candidates). Without it
 *   (local Debug builds) the build continues policy-only: any stale staged
 *   model is removed and the app's triage UI shows its inactive state, exactly
 *   as deviceEmbedder.ts already handles a missing model.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { KNOWN_SHA256 } from './embedder-integrity.mjs';

const ROOT = join(import.meta.dirname, '..');
const SOURCE = join(ROOT, 'packages', 'inference', 'assets', 'minilm', 'model_quantized.onnx');
const PINNED = KNOWN_SHA256['onnx/model_quantized.onnx'];

const [destination, ...flags] = process.argv.slice(2);
const required = flags.includes('--required');
if (!destination || flags.some((flag) => flag !== '--required')) {
  console.error('usage: node scripts/stage-native-embedder.mjs <destination> [--required]');
  process.exit(2);
}
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

if (!existsSync(SOURCE)) {
  if (required) {
    console.error(`error: embedder model missing at ${SOURCE}. Run "npm run fetch:embedder" (pinned, byte-verified) before building this candidate.`);
    process.exit(1);
  }
  rmSync(destination, { force: true });
  console.warn('warning: embedder model not fetched; this build is policy-only (semantic triage inactive). Run "npm run fetch:embedder" to include it.');
  process.exit(0);
}
const sourceSha = sha256(SOURCE);
if (sourceSha !== PINNED) {
  console.error(`error: embedder model SHA-256 ${sourceSha} does not match the ratified pin ${PINNED}. Refusing to package it.`);
  process.exit(1);
}
mkdirSync(dirname(destination), { recursive: true });
copyFileSync(SOURCE, destination);
const stagedSha = sha256(destination);
if (stagedSha !== PINNED) {
  rmSync(destination, { force: true });
  console.error(`error: staged copy hash ${stagedSha} differs from the pin; removed.`);
  process.exit(1);
}
console.log(`staged minilm.onnx (sha256 ${PINNED}) -> ${destination}`);
