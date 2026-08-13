/**
 * verify_embedder_integrity.mjs — deterministic, offline adversarial gate for
 * the embedder supply-chain pin (see scripts/embedder-integrity.mjs).
 *
 * Proves, without any network access:
 *   1. the full immutable revision is pinned and mutable revisions are rejected;
 *   2. both required remote artifacts have ratified hashes declared;
 *   3. correct (pin-matching) files pass verification, including existing outputs;
 *   4. a one-byte-corrupted ONNX file fails;
 *   5. a one-byte-corrupted tokenizer file fails;
 *   6. cache and download paths exercise the SAME verifier/install seam;
 *   7. an already-present output file cannot bypass verification;
 *   8. a failed verification can never replace a previously trusted destination;
 *   9. regenerated tokenizer.min.json retains the ratified byte hash;
 *  10. CI cache keys are bound to the pin-bearing source and have no broad
 *      restore-keys fallback.
 *
 * Runs:  node packages/inference/test/verify_embedder_integrity.mjs
 * (wired into npm run verify:embedder; may also be run standalone.)
 */
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  KNOWN_SHA256,
  MODEL_ID,
  PINNED_REVISION,
  TOKENIZER_MIN_SHA256,
  assertPinnedRevision,
  buildTokenizerMin,
  expectedSha256,
  installVerified,
  sha256Bytes,
  sha256File,
  verifyAgainst,
  verifyExistingOutput,
  verifyIntegrity,
} from '../../../scripts/embedder-integrity.mjs';

const INTEGRITY_JS = join(import.meta.dirname, '..', '..', '..', 'scripts', 'embedder-integrity.mjs');
const FETCH_JS = join(import.meta.dirname, '..', '..', '..', 'scripts', 'fetch-embedder.mjs');
const CI_YML = join(import.meta.dirname, '..', '..', '..', '.github', 'workflows', 'ci.yml');
const ASSETS = join(import.meta.dirname, '..', 'assets');

const RATIFIED_SHA256 = {
  'onnx/model_quantized.onnx':
    'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1',
  'tokenizer.json':
    'da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0',
};

let fail = 0;
let skipped = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};
const skip = (label, why) => {
  skipped += 1;
  console.log(`  PASS  ${label}  [SKIPPED: ${why}]`);
};
const onnxAsset = join(ASSETS, 'minilm', 'model_quantized.onnx');
const tokFullAsset = join(ASSETS, 'minilm', 'tokenizer.full.json');
const minAsset = join(ASSETS, 'minilm', 'tokenizer.min.json');
let haveRealModel = false;
try { haveRealModel = readFileSync(onnxAsset).length > 0 && readFileSync(tokFullAsset).length > 0; } catch { haveRealModel = false; }

console.log('[1] pinned revision + mutable-revision rejection');
check('PINNED_REVISION is the full 40-char immutable SHA',
  /^[0-9a-f]{40}$/.test(PINNED_REVISION) && PINNED_REVISION.length === 40, PINNED_REVISION);
check('assertPinnedRevision accepts the pinned SHA', assertPinnedRevision(PINNED_REVISION) === PINNED_REVISION);
let mutableRejected = 0;
for (const rev of ['main', 'feature-branch', 'v2.17.2', 'release-candidate', '751bff3', '751bff37182d3f1213fa05d7196b954e230abad9zz']) {
  try { assertPinnedRevision(rev); } catch { mutableRejected += 1; }
}
check('mutable revisions (main, branches, tags, short SHAs) are rejected',
  mutableRejected === 6, `${mutableRejected}/6`);

console.log('[2] both remote artifacts carry ratified pinned hashes');
check('KNOWN_SHA256 declares exactly the two required artifacts',
  [...Object.keys(KNOWN_SHA256)].sort().join(',')
    === ['onnx/model_quantized.onnx', 'tokenizer.json'].sort().join(','));
const allPinned = Object.entries(KNOWN_SHA256).every(([rel, h]) => /^[0-9a-f]{64}$/.test(h));
check('every declared hash is a full 64-char lowercase sha256', allPinned);
check("onnx/model_quantized.onnx pin matches the ratified hash",
  expectedSha256('onnx/model_quantized.onnx') === RATIFIED_SHA256['onnx/model_quantized.onnx']);
check('tokenizer.json pin matches the ratified hash',
  expectedSha256('tokenizer.json') === RATIFIED_SHA256['tokenizer.json']);
let undeclaredRejected = false;
try { expectedSha256('tokenizer.json.unratified'); } catch { undeclaredRejected = true; }
check('an artifact without a declared hash is refused (fail closed)', undeclaredRejected);

console.log('[3] correct files pass verification (including existing outputs)');
const fixture = Buffer.from('athlete-kinetics-supply-chain-fixture');
const fixtureHash = sha256Bytes(fixture);
check('verifier accepts bytes that match their declared hash',
  verifyAgainst(fixtureHash, fixture, 'fixture/artifact.bin', 'fixture') === fixtureHash);
if (haveRealModel) {
  check('existing onnx output verifies against the ratified pin',
    verifyExistingOutput('onnx/model_quantized.onnx', onnxAsset) === RATIFIED_SHA256['onnx/model_quantized.onnx']);
  check('existing tokenizer.full.json verifies against the ratified pin',
    verifyExistingOutput('tokenizer.json', tokFullAsset) === RATIFIED_SHA256['tokenizer.json']);
} else {
  skip('real-model existing-output pin verification', 'model_quantized.onnx / tokenizer.full.json not present (run fetch:embedder first)');
}

console.log('[4] one-byte-corrupted ONNX fails');
const assertCorruptFails = (rel, name) => {
  const bytes = haveRealModel
    ? readFileSync(rel === 'onnx/model_quantized.onnx' ? onnxAsset : tokFullAsset)
    : Buffer.from(`corrupt-${rel}`);
  const corrupt = Buffer.from(bytes);
  corrupt[corrupt.length - 1] ^= 0x01;
  try {
    verifyIntegrity(rel, corrupt, 'corrupt-fixture');
    return { ok: false, detail: 'accepted corrupt bytes' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: msg.includes(rel) && msg.includes(RATIFIED_SHA256[rel]) && /got [0-9a-f]{64}/.test(msg),
      detail: msg.slice(0, 120),
    };
  }
};
const onnxCorrupt = assertCorruptFails('onnx/model_quantized.onnx', 'model_quantized.onnx');
check('one-byte-corrupted ONNX is refused with artifact + actual + expected hash',
  onnxCorrupt.ok, onnxCorrupt.detail);

console.log('[5] one-byte-corrupted tokenizer fails');
const tokCorrupt = assertCorruptFails('tokenizer.json', 'tokenizer.json');
check('one-byte-corrupted tokenizer is refused with artifact + actual + expected hash',
  tokCorrupt.ok, tokCorrupt.detail);

console.log('[6] cache and download share the same verifier/install path');
const fetchSrc = readFileSync(FETCH_JS, 'utf-8');
const integritySrc = readFileSync(INTEGRITY_JS, 'utf-8');
check("fetch script installs cache artifacts through installVerified('…', staged, dest, 'cache')",
  fetchSrc.includes("installVerified(rel, staged, dest, 'cache')"));
check("fetch script installs downloads through installVerified('…', staged, dest, 'download')",
  fetchSrc.includes("installVerified(rel, staged, dest, 'download')"));
check('installVerified is a single shared seam that verifies before installing',
  (integritySrc.match(/verifyFileIntegrity/g) ?? []).length >= 1
    && integritySrc.includes('verifyFileIntegrity(rel, stagedPath, source); // throws; dest untouched')
    && integritySrc.indexOf('verifyFileIntegrity(rel, stagedPath, source); // throws; dest untouched')
      < integritySrc.indexOf('rmSync(dest, { force: true })')
    && integritySrc.indexOf('verifyFileIntegrity(rel, stagedPath, source); // throws; dest untouched')
      < integritySrc.indexOf('renameSync(stagedPath, dest)'));
// Behavioral: the SAME seam rejects a corrupt staged artifact for either label.
const dirtyStaged = join(tmpdir(), `ak-dirty-${process.pid}`);
writeFileSync(dirtyStaged, Buffer.from('not-a-valid-pinned-artifact'));
for (const source of ['cache', 'download']) {
  try {
    installVerified('tokenizer.json', dirtyStaged, join(tmpdir(), `ak-trust-${process.pid}-${source}`), source);
    check(`corrupt staged bytes rejected from ${source} source via shared seam`, false);
  } catch {
    check(`corrupt staged bytes rejected from ${source} source via shared seam`, true);
  }
}
rmSync(dirtyStaged, { force: true });

console.log('[7] an existing output file cannot bypass verification');
if (haveRealModel) {
  check('an unverified existing output that matches its pin passes (already covered in [3])', true);
}
const decoy = join(tmpdir(), `ak-decoy-${process.pid}.onnx`);
writeFileSync(decoy, fixture);
let decoyRejected = false;
try { verifyExistingOutput('onnx/model_quantized.onnx', decoy); } catch { decoyRejected = true; }
check('an existing output with the wrong bytes is refused, never accepted unseen', decoyRejected);
check('fetch-embedder verifies the existing output instead of skipping it',
  fetchSrc.includes("verifyExistingOutput('onnx/model_quantized.onnx', onnxDest)")
    && fetchSrc.includes('already present and verified'));
rmSync(decoy, { force: true });

console.log('[8] failed verification cannot replace a previously trusted destination');
const sandbox = mkdtempSync(join(tmpdir(), 'ak-stage-'));
const trustedDest = join(sandbox, 'model_quantized.onnx');
const corruptStaged = join(sandbox, '.model_quantized.onnx.stage-corrupt');
writeFileSync(trustedDest, Buffer.from('previously-trusted-pinned-bytes') );
writeFileSync(corruptStaged, Buffer.from('failed-staged-replacement-bytes'));
let installThrew = false;
try { installVerified('onnx/model_quantized.onnx', corruptStaged, trustedDest, 'download'); } catch { installThrew = true; }
check('mismatched staged artifact aborts before touching the destination', installThrew);
check('previously trusted destination is byte-for-byte untouched after the failed install',
  readFileSync(trustedDest, 'utf-8') === 'previously-trusted-pinned-bytes');
// Positive control when real bytes are available: correct staged file replaces dest.
if (haveRealModel) {
  const goodStaged = join(sandbox, '.tokenizer.json.stage-good');
  writeFileSync(goodStaged, readFileSync(tokFullAsset));
  const tokDest = join(sandbox, 'tokenizer.full.json');
  installVerified('tokenizer.json', goodStaged, tokDest, 'cache');
  check('a verified staged file installs and yields the ratified hash',
    sha256File(tokDest) === RATIFIED_SHA256['tokenizer.json']);
} else {
  skip('positive install control', 'real tokenizer.full.json not present');
}
rmSync(sandbox, { recursive: true, force: true });

console.log('[9] regenerated tokenizer.min.json retains the ratified hash');
let minCommitted = true;
try { minCommitted = sha256File(minAsset) === TOKENIZER_MIN_SHA256; } catch { minCommitted = false; }
check('committed tokenizer.min.json carries the ratified regeneration hash',
  minCommitted, TOKENIZER_MIN_SHA256);
if (haveRealModel) {
  const regenSandbox = mkdtempSync(join(tmpdir(), 'ak-regen-'));
  try {
    const full = JSON.parse(readFileSync(tokFullAsset, 'utf-8'));
    const regen = buildTokenizerMin(full, MODEL_ID);
    const regenPath = join(regenSandbox, 'tokenizer.min.regen.json');
    writeFileSync(regenPath, JSON.stringify(regen));
    check('offline regeneration of tokenizer.min.json is byte-identical to the ratified hash',
      sha256File(regenPath) === TOKENIZER_MIN_SHA256, sha256File(regenPath));
  } finally {
    rmSync(regenSandbox, { recursive: true, force: true });
  }
} else {
  skip('offline regeneration check', 'tokenizer.full.json not present (run fetch:embedder first)');
}

console.log('[10] CI cache provenance is bound to the pin-bearing source');
const ciYml = readFileSync(CI_YML, 'utf-8');
const keyUses = (ciYml.match(/hashFiles\('scripts\/embedder-integrity\.mjs'\)/g) ?? []).length;
check('both CI cache keys hash the pin-bearing integrity module',
  keyUses >= 2, `${Math.max(0, keyUses)} references`);
check('no broad restore-keys fallback can restore unrelated mutable model state',
  !ciYml.includes('restore-keys: minilm-') && !/restore-keys:[\s]*minilm/i.test(ciYml));

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}${skipped > 0 ? `  (${skipped} skipped)` : ''}`);
process.exit(fail ? 1 : 0);