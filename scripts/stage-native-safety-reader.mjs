/**
 * stage-native-safety-reader.mjs — copy the pinned, byte-verified Stream 2
 * safety reader model into a native app package as `safety_reader.onnx`.
 *
 *   node scripts/stage-native-safety-reader.mjs <destination> [--required]
 *
 * Mirrors `scripts/stage-native-embedder.mjs`:
 *   - Source is the materialized `packages/inference/assets/safety-reader/reader_quantized.onnx`
 *     (or `AK_SAFETY_READER_SOURCE` QA seam); this script NEVER downloads.
 *   - Source exact byte size (`22,881,187` B) and SHA-256 (`a0fa76e4...`) must
 *     match `scripts/safety-reader-integrity.mjs` before staging, and the
 *     installed destination is atomically replaced from a same-directory stage
 *     and re-verified.
 *   - Missing source fails with `--required` (Release/CI reader builds). Without
 *     `--required` (local Debug builds), any stale staged copy is removed and the
 *     build continues with shipped baseline behavior (`readerPrediction = null`).
 */
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import {
  DEFAULT_SAFETY_READER_OUT_DIR,
  SAFETY_READER_ARTIFACT,
  installVerifiedSafetyReader,
  verifySafetyReaderFile,
} from './safety-reader-integrity.mjs';

const SOURCE = process.env.AK_SAFETY_READER_SOURCE
  ? resolve(process.env.AK_SAFETY_READER_SOURCE)
  : join(DEFAULT_SAFETY_READER_OUT_DIR, SAFETY_READER_ARTIFACT);

const [destinationArg, ...flags] = process.argv.slice(2);
const required = flags.includes('--required');
if (!destinationArg || flags.some((flag) => flag !== '--required')) {
  console.error('usage: node scripts/stage-native-safety-reader.mjs <destination> [--required]');
  process.exit(2);
}
const destination = resolve(destinationArg);

if (!existsSync(SOURCE)) {
  if (required) {
    console.error(
      `error: safety reader model missing at ${SOURCE}. Run "npm run fetch:safety-reader" (pinned, byte-verified) before building this candidate.`,
    );
    process.exit(1);
  }
  rmSync(destination, { force: true });
  console.warn(
    'warning: safety reader model not fetched; staged destination cleared (shipped baseline fallback remains active). Run "npm run fetch:safety-reader" to materialize it.',
  );
  process.exit(0);
}

try {
  verifySafetyReaderFile(SAFETY_READER_ARTIFACT, SOURCE, 'source');
} catch (error) {
  console.error(`error: safety reader source rejected (${error.message}). Refusing to package it.`);
  process.exit(1);
}

mkdirSync(dirname(destination), { recursive: true });
const staged = join(dirname(destination), `.${basename(destination)}.stage-${process.pid}`);
try {
  copyFileSync(SOURCE, staged);
  const sha = installVerifiedSafetyReader(SAFETY_READER_ARTIFACT, staged, destination, 'staged copy');
  console.log(`staged ${basename(destination)} (sha256 ${sha}) -> ${destination}`);
} catch (error) {
  console.error(`error: failed to stage verified safety reader (${error.message}).`);
  process.exit(1);
} finally {
  try {
    rmSync(staged, { force: true });
  } catch {
    // Best-effort cleanup.
  }
}
