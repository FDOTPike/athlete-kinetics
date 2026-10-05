/**
 * Deterministic, offline adversarial gate for the embedder supply chain.
 * Normal contract: run fetch:embedder first. Missing artifacts are failures,
 * never passing skips.
 */
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import {
  DEFAULT_TRANSFORMERS_CACHE_ROOT,
  KNOWN_SHA256,
  MODEL_ID,
  PINNED_REVISION,
  REMOTE_ARTIFACTS,
  TOKENIZER_MIN_SHA256,
  assertExpectedModelId,
  assertPinnedRevision,
  buildTokenizerMin,
  expectedSha256,
  installVerified,
  installVerifiedAgainst,
  offlineTransformersLoad,
  sha256Bytes,
  sha256File,
  transformersModelCachePath,
  transformersRevisionArtifactPath,
  transformersRevisionCachePath,
  verifyAgainst,
  verifyExistingOutput,
  verifyIntegrity,
} from '../../../scripts/embedder-integrity.mjs';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const ASSETS = join(import.meta.dirname, '..', 'assets');
const CI_YML = join(ROOT, '.github', 'workflows', 'ci.yml');
const MIN_DIR = join(ASSETS, 'minilm');
const MODEL_OUTPUT = join(MIN_DIR, 'model_quantized.onnx');
const FULL_TOKENIZER_OUTPUT = join(MIN_DIR, 'tokenizer.full.json');
const MIN_TOKENIZER_OUTPUT = join(MIN_DIR, 'tokenizer.min.json');

const RATIFIED_SHA256 = Object.freeze({
  'config.json': '7135149f7cffa1a573466c6e4d8423ed73b62fd2332c575bf738a0d033f70df7',
  'onnx/model_quantized.onnx': 'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1',
  'tokenizer.json': 'da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0',
  'tokenizer_config.json': '9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3',
});

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) failures += 1;
};

const throws = (fn) => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};

const ignoredSourceDirs = new Set(['node_modules', '.build', 'build', 'dist', '.gradle']);
const listFiles = (dir) => {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredSourceDirs.has(entry.name)) files.push(...listFiles(path));
    }
    else files.push(path);
  }
  return files;
};

console.log('[1] immutable revision and model identity');
check('PINNED_REVISION is a full immutable commit SHA',
  /^[0-9a-f]{40}$/.test(PINNED_REVISION), PINNED_REVISION);
check('pinned revision is accepted', assertPinnedRevision(PINNED_REVISION) === PINNED_REVISION);
const mutable = ['main', 'feature', 'v2.17.2', '751bff3', '', null];
check('mutable/short/non-string revisions are rejected',
  mutable.every((revision) => throws(() => assertPinnedRevision(revision))), `${mutable.length}/${mutable.length}`);
check('ratified model id is accepted', assertExpectedModelId(MODEL_ID) === MODEL_ID);
check('model-id drift is rejected', throws(() => assertExpectedModelId('Xenova/other-model')));

console.log('[2] all remote pipeline artifacts have independent ratified hashes');
const expectedArtifacts = Object.keys(RATIFIED_SHA256).sort();
check('declared artifact set is exactly config/model/tokenizer/tokenizer-config',
  [...REMOTE_ARTIFACTS].sort().join('|') === expectedArtifacts.join('|'));
check('KNOWN_SHA256 has no undeclared or missing entries',
  Object.keys(KNOWN_SHA256).sort().join('|') === expectedArtifacts.join('|'));
for (const rel of expectedArtifacts) {
  check(`${rel} pin matches the independently ratified hash`,
    expectedSha256(rel) === RATIFIED_SHA256[rel], RATIFIED_SHA256[rel]);
}
check('undeclared remote artifact fails closed', throws(() => expectedSha256('special_tokens_map.json')));

console.log('[3] exact revision-scoped Transformers cache contract');
const revisionDir = transformersRevisionCachePath();
check('revision cache is nested under cache-root/model/full-revision',
  revisionDir === join(DEFAULT_TRANSFORMERS_CACHE_ROOT, ...MODEL_ID.split('/'), PINNED_REVISION), revisionDir);
check('legacy unrevisioned cache is not the revision cache',
  transformersModelCachePath() !== revisionDir);
let allRevisionArtifactsPresent = true;
for (const rel of expectedArtifacts) {
  const path = transformersRevisionArtifactPath(rel);
  const exact = path === join(revisionDir, ...rel.split('/'));
  const present = existsSync(path) && statSync(path).isFile();
  let verified = false;
  if (present) {
    try {
      verified = verifyExistingOutput(rel, path) === RATIFIED_SHA256[rel];
    } catch {
      verified = false;
    }
  }
  allRevisionArtifactsPresent &&= present && verified;
  check(`${rel} exists at its exact revision key and verifies`, exact && present && verified, path);
}
check('normal post-fetch contract has all four required artifacts (no skips)', allRevisionArtifactsPresent);

console.log('[4] shared Transformers load contract is pinned and offline');
const sharedLoad = offlineTransformersLoad(MODEL_ID);
check('shared loader fixes the ratified model id', sharedLoad.modelId === MODEL_ID);
check('shared loader fixes the immutable revision', sharedLoad.options.revision === PINNED_REVISION);
check('shared loader fixes the exact cache root',
  sharedLoad.options.cache_dir === DEFAULT_TRANSFORMERS_CACHE_ROOT);
check('shared loader explicitly prohibits remote fallback',
  sharedLoad.options.local_files_only === true);

const transformerCallers = [
  ...listFiles(join(ROOT, 'apps')),
  ...listFiles(join(ROOT, 'packages')),
  ...listFiles(join(ROOT, 'scripts')),
]
  .filter((path) => {
    return /\.(?:[cm]?js|tsx?)$/.test(path);
  })
  .filter((path) => {
    const source = readFileSync(path, 'utf-8');
    return /import\s*\(\s*['"]@xenova\/transformers['"]\s*\)/.test(source)
      || /from\s*['"]@xenova\/transformers['"]/.test(source)
      || /require\s*\(\s*['"]@xenova\/transformers['"]\s*\)/.test(source);
  })
  .map((path) => relative(ROOT, path).replaceAll('\\', '/'))
  .sort();
const productionTransformersCallers = [
  'packages/inference/test/verify_embedder.mjs',
  'packages/inference/test/verify_semantic.mjs',
  'scripts/embed-codebase.mjs',
];
const expectedCallers = [
  ...productionTransformersCallers,
  'packages/inference/test/verify_embedder_integrity.mjs',
].sort();
check('every direct Transformers caller is known and audited',
  transformerCallers.join('|') === expectedCallers.join('|'), transformerCallers.join(', '));
for (const rel of productionTransformersCallers) {
  const source = readFileSync(join(ROOT, ...rel.split('/')), 'utf-8');
  check(`${rel} uses the shared model/pin/cache/offline seam`,
    source.includes('offlineTransformersLoad(') && source.includes('transformerLoad.options'));
}

// Behavioral proof: an empty cache fails locally and the populated cache loads
// successfully while global fetch is blocked. This exercises the shared seam,
// not a source-string approximation of local_files_only.
const emptyCache = mkdtempSync(join(tmpdir(), 'ak-empty-transformers-cache-'));
const originalFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = async () => {
  fetchCalls += 1;
  throw new Error('NETWORK FORBIDDEN BY INTEGRITY GATE');
};
try {
  const { pipeline } = await import('@xenova/transformers');
  let emptyFailedLocally = false;
  try {
    const emptyLoad = offlineTransformersLoad(MODEL_ID, emptyCache);
    await pipeline('feature-extraction', emptyLoad.modelId, {
      quantized: true,
      ...emptyLoad.options,
    });
  } catch {
    emptyFailedLocally = true;
  }
  check('empty cache fails locally when offline', emptyFailedLocally);
  check('empty-cache failure attempts zero fetches', fetchCalls === 0, `${fetchCalls} fetch calls`);

  let populatedLoaded = false;
  let populatedPipeline;
  try {
    populatedPipeline = await pipeline('feature-extraction', sharedLoad.modelId, {
      quantized: true,
      ...sharedLoad.options,
    });
    const result = await populatedPipeline('supply chain proof', {
      pooling: 'mean',
      normalize: true,
    });
    populatedLoaded = result?.data?.length === 384;
  } catch {
    populatedLoaded = false;
  } finally {
    if (typeof populatedPipeline?.dispose === 'function') {
      await populatedPipeline.dispose();
    }
  }
  check('populated revision cache runs feature extraction offline', populatedLoaded);
  check('populated-cache execution attempts zero fetches', fetchCalls === 0, `${fetchCalls} fetch calls`);
} finally {
  globalThis.fetch = originalFetch;
  rmSync(emptyCache, { recursive: true, force: true });
}

console.log('[5] all installed bytes verify and corruption is rejected');
const outputMap = new Map([
  ['onnx/model_quantized.onnx', MODEL_OUTPUT],
  ['tokenizer.json', FULL_TOKENIZER_OUTPUT],
]);
for (const [rel, path] of outputMap) {
  let verified = false;
  if (existsSync(path)) {
    try {
      verified = verifyExistingOutput(rel, path) === RATIFIED_SHA256[rel];
    } catch {
      verified = false;
    }
  }
  check(`${rel} device output exists and verifies`, verified, path);
}
for (const rel of expectedArtifacts) {
  const bytes = readFileSync(transformersRevisionArtifactPath(rel));
  const corrupt = Buffer.from(bytes);
  corrupt[corrupt.length - 1] ^= 0x01;
  check(`one-byte corruption is rejected for ${rel}`,
    throws(() => verifyIntegrity(rel, corrupt, 'one-byte-corruption')));
}

console.log('[6] one verifier covers cache/download/output candidates');
const fixture = Buffer.from('athlete-kinetics-integrity-fixture');
const fixtureHash = sha256Bytes(fixture);
check('explicit-hash verifier accepts matching bytes',
  verifyAgainst(fixtureHash, fixture, 'fixture.bin', 'fixture') === fixtureHash);
for (const source of ['revision cache', 'legacy cache', 'existing output', 'download']) {
  check(`${source} label cannot bypass the byte verifier`,
    throws(() => verifyIntegrity('tokenizer_config.json', fixture, source)));
}

console.log('[7] verification and replacement failures preserve destinations');
const installSandbox = mkdtempSync(join(tmpdir(), 'ak-install-integrity-'));
try {
  const trustedBytes = readFileSync(transformersRevisionArtifactPath('tokenizer_config.json'));
  const trustedDest = join(installSandbox, 'tokenizer_config.json');
  writeFileSync(trustedDest, trustedBytes);

  const corruptStage = join(installSandbox, '.tokenizer_config.stage-corrupt');
  writeFileSync(corruptStage, Buffer.from('corrupt'));
  check('staged checksum mismatch aborts',
    throws(() => installVerified('tokenizer_config.json', corruptStage, trustedDest, 'download')));
  check('checksum mismatch leaves trusted destination byte-identical',
    sha256File(trustedDest) === RATIFIED_SHA256['tokenizer_config.json']);

  const goodStage = join(installSandbox, '.tokenizer_config.stage-good');
  writeFileSync(goodStage, trustedBytes);
  const injectedFailure = () => { throw new Error('injected replacement failure'); };
  check('injected replacement failure propagates',
    throws(() => installVerified(
      'tokenizer_config.json',
      goodStage,
      trustedDest,
      'download',
      injectedFailure,
    )));
  check('replacement failure preserves prior destination byte-identical',
    sha256File(trustedDest) === RATIFIED_SHA256['tokenizer_config.json']);

  writeFileSync(goodStage, trustedBytes);
  check('verified same-directory rename-over-file succeeds without pre-delete',
    installVerified('tokenizer_config.json', goodStage, trustedDest, 'cache')
      === RATIFIED_SHA256['tokenizer_config.json']);
} finally {
  rmSync(installSandbox, { recursive: true, force: true });
}

console.log('[8] tokenizer.min regeneration is staged and fail-closed');
let minOutputVerified = false;
if (existsSync(MIN_TOKENIZER_OUTPUT)) {
  minOutputVerified = sha256File(MIN_TOKENIZER_OUTPUT) === TOKENIZER_MIN_SHA256;
}
check('installed tokenizer.min.json has the ratified hash',
  minOutputVerified, TOKENIZER_MIN_SHA256);
const minSandbox = mkdtempSync(join(tmpdir(), 'ak-min-integrity-'));
try {
  const full = JSON.parse(readFileSync(FULL_TOKENIZER_OUTPUT, 'utf-8'));
  const regenerated = Buffer.from(JSON.stringify(buildTokenizerMin(full, MODEL_ID)));
  check('regenerated tokenizer.min bytes match the ratified hash',
    sha256Bytes(regenerated) === TOKENIZER_MIN_SHA256);

  const minDest = join(minSandbox, 'tokenizer.min.json');
  writeFileSync(minDest, readFileSync(MIN_TOKENIZER_OUTPUT));
  const badMinStage = join(minSandbox, '.tokenizer.min.stage-bad');
  writeFileSync(badMinStage, Buffer.concat([regenerated, Buffer.from('\n')]));
  check('tokenizer.min regeneration mismatch aborts',
    throws(() => installVerifiedAgainst(
      TOKENIZER_MIN_SHA256,
      badMinStage,
      minDest,
      'tokenizer.min.json',
      'regenerated',
    )));
  check('tokenizer.min mismatch preserves the trusted destination',
    sha256File(minDest) === TOKENIZER_MIN_SHA256);
} finally {
  rmSync(minSandbox, { recursive: true, force: true });
}

console.log('[9] materializer cleanup and CI provenance/order');
const stageRemnants = [
  ...listFiles(revisionDir),
  ...listFiles(MIN_DIR),
].filter((path) => /\.stage-|\.backup-/.test(path));
check('normal fetch leaves no stage or backup remnants',
  stageRemnants.length === 0, stageRemnants.join(', '));
const ciYml = readFileSync(CI_YML, 'utf-8');
const keyUses = (ciYml.match(/hashFiles\('scripts\/embedder-integrity\.mjs'\)/g) ?? []).length;
check('both CI model-cache keys are bound to the pin-bearing module', keyUses >= 2, `${keyUses} references`);
check('CI has no broad model-cache restore key', !ciYml.includes('restore-keys:'));
check('CI materializes before running the offline verification suite',
  ciYml.indexOf('npm run fetch:embedder') >= 0
    && ciYml.indexOf('npm run verify:ci') >= 0
    && ciYml.indexOf('npm run fetch:embedder') < ciYml.indexOf('npm run verify:ci'));

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} (0 skipped)`);
process.exit(failures ? 1 : 0);
