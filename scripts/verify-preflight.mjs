/**
 * verify-preflight.mjs — deterministic prerequisites gate (WO remediation A2).
 *
 * Runs at the head of `npm run verify:ci` and fails within seconds with a
 * precise remediation message when the checkout is not prepared for OFFLINE
 * verification, instead of failing later and less clearly inside sharp,
 * @xenova/transformers, or tokenizer code.
 *
 * Contract it enforces:
 *   npm ci                 -> dependencies installed (native loader loadable)
 *   npm run fetch:embedder -> pinned revision cache + device outputs present,
 *                             every byte matching scripts/embedder-integrity.mjs
 *   verification itself    -> local_files_only; never downloads implicitly
 *
 * This gate NEVER downloads. The sole network-capable materializer is
 * scripts/fetch-embedder.mjs. An unprepared checkout is an operator error,
 * not a candidate failure.
 *
 * Run: node scripts/verify-preflight.mjs
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = join(import.meta.dirname, '..');

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};
const remediation = (msg) => {
  console.error(`\nREMEDIATION: ${msg}`);
};

console.log('=== [preflight] offline verification prerequisites ===');

// --- [1] node_modules present -------------------------------------------------
check('dependencies installed (node_modules present)', existsSync(join(ROOT, 'node_modules')));

// --- [2] required native dependency loads (sharp as used by transformers) -----
// @xenova/transformers v2 lazily requires sharp for image models. A broken or
// missing native binding surfaces only deep inside a later gate unless proven
// here, up front.
try {
  require('sharp');
  check('sharp native binding loads', true);
} catch (e) {
  check('sharp native binding loads', false, String(e.message).slice(0, 120));
  remediation(
    'native image dependency unavailable — run "npm ci" in this checkout '
    + '(do NOT substitute a global install); if sharp failed to download its '
    + 'prebuilt binary, fix the npm environment and re-run "npm ci".',
  );
}

// --- [3] pinned revision-cache artifacts exist and match committed hashes ----
import {
  DEFAULT_TRANSFORMERS_CACHE_ROOT,
  KNOWN_SHA256,
  PINNED_REVISION,
  REMOTE_ARTIFACTS,
  TOKENIZER_MIN_SHA256,
  sha256File,
  transformersRevisionArtifactPath,
} from './embedder-integrity.mjs';

for (const rel of REMOTE_ARTIFACTS) {
  const p = transformersRevisionArtifactPath(rel, DEFAULT_TRANSFORMERS_CACHE_ROOT, PINNED_REVISION);
  if (!existsSync(p)) {
    check(`revision cache artifact present: ${rel}`, false, p);
    continue;
  }
  try {
    const actual = sha256File(p);
    check(`revision cache artifact verified: ${rel}`, actual === KNOWN_SHA256[rel],
      actual === KNOWN_SHA256[rel] ? 'sha256 ok' : `sha256 ${actual} != pin`);
  } catch (e) {
    check(`revision cache artifact verified: ${rel}`, false, String(e.message).slice(0, 120));
  }
}
if (fail > 0 || REMOTE_ARTIFACTS.some((rel) => !existsSync(
  transformersRevisionArtifactPath(rel, DEFAULT_TRANSFORMERS_CACHE_ROOT, PINNED_REVISION),
))) {
  remediation(
    'pinned embedder artifacts are missing or corrupt — run "npm run fetch:embedder" '
    + '(the only network-capable materializer; it byte-verifies everything it installs).',
  );
}

// --- [4] device outputs where current consumers require them ------------------
const DEVICE_OUT = join(ROOT, 'packages', 'inference', 'assets', 'minilm');
for (const name of ['model_quantized.onnx', 'tokenizer.full.json']) {
  const p = join(DEVICE_OUT, name);
  check(`device output present: packages/inference/assets/minilm/${name}`, existsSync(p));
}
const minPath = join(DEVICE_OUT, 'tokenizer.min.json');
if (!existsSync(minPath)) {
  check('device output present: tokenizer.min.json', false, minPath);
} else {
  try {
    const actual = sha256File(minPath);
    check('distilled tokenizer.min.json matches the committed pin',
      actual === TOKENIZER_MIN_SHA256,
      actual === TOKENIZER_MIN_SHA256 ? 'sha256 ok' : `sha256 ${actual} != pin`);
  } catch (e) {
    check('distilled tokenizer.min.json matches the committed pin', false,
      String(e.message).slice(0, 120));
  }
}

// --- [5] invoked lifecycle verifier exists -------------------------------------
const LAZY_VERIFIER = join(ROOT, 'packages', 'inference', 'test', 'verify_lazy_lifecycle.mjs');
check('lifecycle verifier present (verify_lazy_lifecycle.mjs)', existsSync(LAZY_VERIFIER));

// --- [6] verification cannot silently download ---------------------------------
const EMBEDDER_SRC = readFileSync(
  join(ROOT, 'packages', 'inference', 'src', 'semantic', 'onnxEmbedder.ts'), 'utf-8',
);
check('verification pipeline is constructed from local assets only',
  !EMBEDDER_SRC.includes('@xenova/transformers'),
  'onnxEmbedder consumes injected sessions from packages/inference/assets/minilm');
const integritySrc = readFileSync(join(ROOT, 'scripts', 'embedder-integrity.mjs'), 'utf-8');
check('offline options enforce local_files_only', integritySrc.includes('local_files_only: true'));
check('fetch-embedder remains the sole downloader',
  readFileSync(join(ROOT, 'scripts', 'fetch-embedder.mjs'), 'utf-8').includes('huggingface.co'));

console.log(`\n${fail === 0 ? 'PREFLIGHT OK' : `${fail} PREFLIGHT CHECK(S) FAILED`}`);
if (fail > 0) {
  console.error('\nThis checkout is NOT prepared for offline verification. Required sequence:');
  console.error('  npm ci\n  npm run fetch:embedder\n  npm run verify:ci');
  process.exit(1);
}
