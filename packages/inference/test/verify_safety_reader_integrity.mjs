/**
 * verify_safety_reader_integrity.mjs — deterministic supply-chain, native-staging,
 * CI-provenance, and live ONNX Runtime execution gate for the Stream 2 safety
 * reader (`m10-r15-reader-seed3`, `reader_quantized.onnx`).
 *
 * Verifies:
 *   [1] Supply-chain pins in `scripts/safety-reader-integrity.mjs` are immutable
 *       and match `packages/inference/src/semantic/safetyReader.ts` byte-for-byte.
 *   [2] Stage-verify-replace helpers reject byte-length drift, 1-byte corruption,
 *       oversized files, and replacement failures while preserving trusted
 *       destinations and leaving zero stage remnants.
 *   [3] `scripts/stage-native-safety-reader.mjs` stages a verified copy, rejects
 *       corrupt sources, honors `--required` vs optional Debug cleanup, and rejects
 *       unknown CLI flags.
 *   [4] `.gitignore` and `.github/workflows/ci.yml` bind caching and pre-verify
 *       materialization to `scripts/safety-reader-integrity.mjs` with no broad
 *       restore-keys fallback.
 *   [5] Live `onnxruntime-node` inference on the materialized `reader_quantized.onnx`
 *       co-scheduled with real MiniLM (`model_quantized.onnx`) through one shared
 *       `SerializedOrtScheduler` (`maxConcurrent === 1`) and `combineDenialFloor`.
 */
import { execFileSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  ftruncateSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import {
  DEFAULT_SAFETY_READER_CACHE_ROOT,
  DEFAULT_SAFETY_READER_OUT_DIR,
  KNOWN_BYTES,
  KNOWN_SHA256,
  PINNED_ASSET_API_URL,
  PINNED_ASSET_ID,
  PINNED_DOWNLOAD_URL,
  PINNED_RELEASE_COMMIT,
  PINNED_RELEASE_ID,
  PINNED_RELEASE_REPO,
  PINNED_RELEASE_TAG,
  SAFETY_READER_ARTIFACT,
  SAFETY_READER_MODEL_ID,
  SAFETY_READER_POLICY_ID,
  assertExpectedSafetyReaderModelId,
  assertPinnedReleaseCommit,
  expectedSafetyReaderBytes,
  expectedSafetyReaderSha256,
  installVerifiedSafetyReader,
  safetyReaderCacheArtifactPath,
  sha256File,
  verifySafetyReaderAgainst,
  verifySafetyReaderFile,
} from '../../../scripts/safety-reader-integrity.mjs';

const require = createRequire(import.meta.url);
const ort = require('onnxruntime-node');
const readerMod = require('./.build/semantic/safetyReader.js');
const onnxMod = require('./.build/semantic/onnxEmbedder.js');
const codebaseMod = require('./.build/semantic/codebase.js');
const triageMod = require('./.build/semantic/triage.js');
const redFlagMod = require('./.build/semantic/redFlag.js');

const ROOT = join(import.meta.dirname, '..', '..', '..');
const ASSETS = join(ROOT, 'packages', 'inference', 'assets');
const STAGE_SCRIPT = join(ROOT, 'scripts', 'stage-native-safety-reader.mjs');
const CI_YML = join(ROOT, '.github', 'workflows', 'ci.yml');
const GITIGNORE = join(ROOT, '.gitignore');

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

const throws = (fn, pattern) => {
  try {
    fn();
    return false;
  } catch (e) {
    return pattern ? e instanceof Error && pattern.test(e.message) : true;
  }
};

const listFiles = (dir) => {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
};

console.log('=== [1] Safety Reader Supply-Chain Pins & Cross-Module Lockstep ===');
check(
  'PINNED_RELEASE_COMMIT is a full 40-char immutable SHA',
  /^[0-9a-f]{40}$/.test(PINNED_RELEASE_COMMIT)
    && assertPinnedReleaseCommit(PINNED_RELEASE_COMMIT) === PINNED_RELEASE_COMMIT,
  PINNED_RELEASE_COMMIT,
);
{
  const badCommits = ['main', 'claude/release-integration', 'ml-reader-m10-r15-s3', 'b6ceee70', '', null, 42];
  const rejected = badCommits.filter((c) => throws(() => assertPinnedReleaseCommit(c), /40-character commit SHA/));
  check('mutable/short/non-string release commits are rejected', rejected.length === badCommits.length, `${rejected.length}/${badCommits.length}`);
}
check(
  'PINNED_RELEASE_REPO, TAG, RELEASE_ID, ASSET_ID, and URLs are consistent',
  PINNED_RELEASE_REPO === 'FDOTPike/athlete-kinetics'
    && PINNED_RELEASE_TAG === 'ml-reader-m10-r15-s3'
    && Number.isInteger(PINNED_RELEASE_ID) && PINNED_RELEASE_ID > 0
    && Number.isInteger(PINNED_ASSET_ID) && PINNED_ASSET_ID > 0
    && PINNED_DOWNLOAD_URL === `https://github.com/${PINNED_RELEASE_REPO}/releases/download/${PINNED_RELEASE_TAG}/${SAFETY_READER_ARTIFACT}`
    && PINNED_ASSET_API_URL === `https://api.github.com/repos/${PINNED_RELEASE_REPO}/releases/assets/${PINNED_ASSET_ID}`,
  `assetId=${PINNED_ASSET_ID}`,
);
check(
  'integrity constants match compiled safetyReader.ts constants byte-for-byte',
  SAFETY_READER_MODEL_ID === readerMod.SAFETY_READER_MODEL_ID
    && SAFETY_READER_POLICY_ID === readerMod.SAFETY_READER_POLICY_ID
    && KNOWN_SHA256[SAFETY_READER_ARTIFACT] === readerMod.SAFETY_READER_SHA256
    && KNOWN_BYTES[SAFETY_READER_ARTIFACT] === readerMod.SAFETY_READER_BYTES,
  `${SAFETY_READER_MODEL_ID} (${KNOWN_BYTES[SAFETY_READER_ARTIFACT]} B)`,
);
check(
  'model-id drift and undeclared artifact names fail closed',
  assertExpectedSafetyReaderModelId(SAFETY_READER_MODEL_ID) === SAFETY_READER_MODEL_ID
    && throws(() => assertExpectedSafetyReaderModelId('wrong-model'), /does not match/)
    && throws(() => expectedSafetyReaderSha256('other.onnx'), /No declared expected SHA-256/)
    && throws(() => expectedSafetyReaderBytes('other.onnx'), /No declared expected byte size/),
);

console.log('\n=== [2] Materialized Cache/Output Verification & Corruption Falsifiers ===');
const cacheFile = safetyReaderCacheArtifactPath(
  SAFETY_READER_ARTIFACT,
  DEFAULT_SAFETY_READER_CACHE_ROOT,
  PINNED_RELEASE_COMMIT,
);
const outFile = join(DEFAULT_SAFETY_READER_OUT_DIR, SAFETY_READER_ARTIFACT);
check('pinned cache file exists and verifies size + sha256',
  existsSync(cacheFile)
    && verifySafetyReaderFile(SAFETY_READER_ARTIFACT, cacheFile, 'cache') === readerMod.SAFETY_READER_SHA256,
  cacheFile);
check('materialized device-asset output exists and verifies size + sha256',
  existsSync(outFile)
    && statSync(outFile).size === readerMod.SAFETY_READER_BYTES
    && verifySafetyReaderFile(SAFETY_READER_ARTIFACT, outFile, 'device output') === readerMod.SAFETY_READER_SHA256,
  outFile);

{
  const sandbox = mkdtempSync(join(tmpdir(), 'ak-reader-integrity-'));
  try {
    const sample = Buffer.from('deterministic-reader-test-payload');
    const trustedDest = join(sandbox, 'trusted.onnx');
    writeFileSync(trustedDest, sample);
    const exactSha = sha256File(trustedDest);
    check('explicit size+hash verifier accepts matching bytes',
      verifySafetyReaderAgainst(exactSha, sample.length, sample, 'sample.onnx', 'unit') === exactSha);
    check('explicit verifier rejects 1-byte length mismatch before/at check',
      throws(() => verifySafetyReaderAgainst(exactSha, sample.length + 1, sample, 'sample.onnx', 'unit'), /SIZE MISMATCH/));
    const flipped = Buffer.from(sample);
    flipped[0] ^= 0xff;
    check('explicit verifier rejects 1-byte content corruption',
      throws(() => verifySafetyReaderAgainst(exactSha, flipped.length, flipped, 'sample.onnx', 'unit'), /CHECKSUM MISMATCH/));

    // Oversized sparse file rejected by stat size BEFORE reading bytes
    const huge = join(sandbox, 'huge.onnx');
    const fd = openSync(huge, 'w');
    try { ftruncateSync(fd, readerMod.SAFETY_READER_BYTES + 1024); } finally { closeSync(fd); }
    check('file verifier rejects wrong-size file via stat before full read',
      throws(() => verifySafetyReaderFile(SAFETY_READER_ARTIFACT, huge, 'oversize'), /SIZE MISMATCH/));

    // Stage-and-replace preserves trusted destination on corrupt stage or replacement error
    const realDest = join(sandbox, 'reader_quantized.onnx');
    writeFileSync(realDest, Buffer.from('prior-sentinel-bytes'));
    const badStage = join(sandbox, '.reader.stage-corrupt');
    writeFileSync(badStage, Buffer.from('corrupt-short'));
    check('corrupt stage aborts installVerifiedSafetyReader and leaves destination untouched',
      throws(() => installVerifiedSafetyReader(SAFETY_READER_ARTIFACT, badStage, realDest, 'download'), /SIZE MISMATCH/)
        && readFileSync(realDest, 'utf8') === 'prior-sentinel-bytes');

    // Real verified bytes in stage with injected replacement throw
    const goodStage = join(sandbox, '.reader.stage-good');
    writeFileSync(goodStage, readFileSync(outFile));
    check('replacement failure propagates and preserves prior destination',
      throws(() => installVerifiedSafetyReader(
        SAFETY_READER_ARTIFACT,
        goodStage,
        realDest,
        'download',
        () => { throw new Error('simulated rename failure'); },
      ), /simulated rename failure/)
        && readFileSync(realDest, 'utf8') === 'prior-sentinel-bytes');

    // Successful atomic replacement over existing file
    check('verified atomic replacement installs exact pinned bytes',
      installVerifiedSafetyReader(SAFETY_READER_ARTIFACT, goodStage, realDest, 'cache') === readerMod.SAFETY_READER_SHA256
        && statSync(realDest).size === readerMod.SAFETY_READER_BYTES);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

{
  const remnants = [
    ...listFiles(DEFAULT_SAFETY_READER_CACHE_ROOT),
    ...listFiles(DEFAULT_SAFETY_READER_OUT_DIR),
  ].filter((p) => /\.stage-|\.backup-/.test(p));
  check('normal fetch leaves zero stage or backup remnants', remnants.length === 0, remnants.join(', '));
}

console.log('\n=== [3] stage-native-safety-reader.mjs CLI Contract ===');
{
  const sandbox = mkdtempSync(join(tmpdir(), 'ak-stage-reader-'));
  try {
    const stagedTarget = join(sandbox, 'bundle', 'safety_reader.onnx');
    execFileSync(process.execPath, [STAGE_SCRIPT, stagedTarget, '--required'], { stdio: 'pipe' });
    check('valid source stages exact bytes and SHA-256 with --required',
      existsSync(stagedTarget)
        && statSync(stagedTarget).size === readerMod.SAFETY_READER_BYTES
        && sha256File(stagedTarget) === readerMod.SAFETY_READER_SHA256);

    const missingSource = join(sandbox, 'missing.onnx');
    let missingReqFailed = false;
    try {
      execFileSync(process.execPath, [STAGE_SCRIPT, join(sandbox, 'req.onnx'), '--required'], {
        env: { ...process.env, AK_SAFETY_READER_SOURCE: missingSource },
        stdio: 'pipe',
      });
    } catch (e) {
      missingReqFailed = e.status === 1;
    }
    check('missing source with --required exits 1', missingReqFailed);

    // Optional (no --required) removes stale staged copy and exits 0
    writeFileSync(stagedTarget, Buffer.from('stale'));
    execFileSync(process.execPath, [STAGE_SCRIPT, stagedTarget], {
      env: { ...process.env, AK_SAFETY_READER_SOURCE: missingSource },
      stdio: 'pipe',
    });
    check('missing source without --required removes stale destination and exits 0', !existsSync(stagedTarget));

    // Corrupt source always exits 1 even without --required and preserves/removes bad output
    const corruptSource = join(sandbox, 'corrupt.onnx');
    const raw = readFileSync(outFile);
    raw[42] ^= 0xff;
    writeFileSync(corruptSource, raw);
    let corruptFailed = false;
    const corruptDest = join(sandbox, 'corrupt-dest.onnx');
    try {
      execFileSync(process.execPath, [STAGE_SCRIPT, corruptDest], {
        env: { ...process.env, AK_SAFETY_READER_SOURCE: corruptSource },
        stdio: 'pipe',
      });
    } catch (e) {
      corruptFailed = e.status === 1;
    }
    check('1-byte corrupt source exits 1 and never stages corrupt destination',
      corruptFailed && !existsSync(corruptDest));

    let badFlagExit = 0;
    try {
      execFileSync(process.execPath, [STAGE_SCRIPT, corruptDest, '--bogus'], { stdio: 'pipe' });
    } catch (e) {
      badFlagExit = e.status;
    }
    check('unknown CLI flag exits 2', badFlagExit === 2, `exit=${badFlagExit}`);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

console.log('\n=== [4] .gitignore & CI Workflow Provenance ===');
{
  const gitignore = readFileSync(GITIGNORE, 'utf8');
  check('.gitignore excludes safety-reader ONNX device/Android staging paths',
    gitignore.includes('packages/inference/assets/safety-reader/*.onnx')
      && gitignore.includes('apps/mobile/android/app/src/main/assets/safety_reader.onnx'));
  const ciYml = readFileSync(CI_YML, 'utf8');
  const readerCacheKeys = (ciYml.match(/hashFiles\('scripts\/safety-reader-integrity\.mjs'\)/g) ?? []).length;
  check('CI binds safety-reader cache key to scripts/safety-reader-integrity.mjs',
    readerCacheKeys >= 1, `${readerCacheKeys} reference(s)`);
  check('CI has no broad restore-keys fallback', !ciYml.includes('restore-keys:'));
  check('CI materializes safety reader before running verify:ci',
    ciYml.indexOf('npm run fetch:safety-reader') >= 0
      && ciYml.indexOf('npm run verify:ci') >= 0
      && ciYml.indexOf('npm run fetch:safety-reader') < ciYml.indexOf('npm run verify:ci'));
}

console.log('\n=== [5] Live onnxruntime-node Co-Scheduled Execution on Real reader_quantized.onnx ===');
{
  const tokSpec = JSON.parse(readFileSync(join(ASSETS, 'minilm', 'tokenizer.min.json'), 'utf8'));
  const minilmPath = join(ASSETS, 'minilm', 'model_quantized.onnx');
  const codebaseRaw = JSON.parse(readFileSync(join(ASSETS, 'phrase-codebase.json'), 'utf8'));
  const vectorsRaw = JSON.parse(readFileSync(join(ASSETS, 'phrase-codebase.vectors.json'), 'utf8'));
  const loaded = codebaseMod.loadCodebase(codebaseRaw, vectorsRaw.vectors);

  const sharedScheduler = onnxMod.createSerializedOrtScheduler();
  let activeSessions = 0;
  let maxConcurrent = 0;
  let embedCreated = 0;
  let readerCreated = 0;

  const embedder = onnxMod.createLazySingleFlightEmbedder({
    tokenizer: tokSpec,
    Tensor: ort.Tensor,
    scheduler: sharedScheduler,
    createSession: async () => {
      activeSessions += 1;
      embedCreated += 1;
      maxConcurrent = Math.max(maxConcurrent, activeSessions);
      return ort.InferenceSession.create(minilmPath);
    },
    disposeSession: async (s) => {
      try {
        await onnxMod.disposeOrtSession(s);
      } finally {
        activeSessions -= 1;
      }
    },
  });

  const reader = readerMod.createLazySingleFlightSafetyReader({
    tokenizer: tokSpec,
    Tensor: ort.Tensor,
    scheduler: sharedScheduler,
    createSession: async () => {
      activeSessions += 1;
      readerCreated += 1;
      maxConcurrent = Math.max(maxConcurrent, activeSessions);
      return ort.InferenceSession.create(outFile);
    },
    disposeSession: async (s) => {
      try {
        await onnxMod.disposeOrtSession(s);
      } finally {
        activeSessions -= 1;
      }
    },
  });

  async function evaluateLive(text) {
    const [vec, readerPred] = await Promise.all([
      embedder.embed(text),
      reader.classify(text),
    ]);
    const semantic = triageMod.triage(vec, loaded);
    const shipped = redFlagMod.resolveReport(text, semantic).entry;
    const keyword = redFlagMod.resolveReport(text, null).entry;
    const finalEntry = readerMod.combineDenialFloor({
      text,
      keywordEntry: keyword,
      shippedEntry: shipped,
      readerPrediction: readerPred,
      codebaseEntries: codebaseRaw.entries,
    });
    return { readerPred, shipped, keyword, finalEntry };
  }

  // Run representative end-to-end cases concurrently across shared scheduler
  const [sharpKnee, chestBreath, subtleReaderCatch, cleanDenial, dangerCleared, dizzyAfterDenial, strongPositive] =
    await Promise.all([
      evaluateLive('felt a sharp pop in my knee mid set'),
      evaluateLive('pressure in my chest and short of breath'),
      evaluateLive('vision went blurry and tunnelled standing up after deadlifts'),
      evaluateLive('no knee pain today'),
      evaluateLive('chest pain has cleared up'),
      evaluateLive('no pain today but felt dizzy'),
      evaluateLive('feeling amazing, weights are flying up'),
    ]);

  check('real ORT co-scheduled execution kept maxConcurrent === 1 and activeSessions === 0',
    maxConcurrent === 1 && activeSessions === 0 && embedCreated === 7 && readerCreated === 7 && !sharedScheduler.isDisposalLatched(),
    `maxConcurrent=${maxConcurrent}, active=${activeSessions}, embed=${embedCreated}, reader=${readerCreated}`);
  check('live sharp knee pop halts',
    sharpKnee.finalEntry?.guardrail?.halt === true,
    `entry=${sharpKnee.finalEntry?.id}, caution=${sharpKnee.readerPred.cautionLogit.toFixed(3)}`);
  check('live chest + short of breath halts',
    chestBreath.finalEntry?.guardrail?.halt === true,
    `entry=${chestBreath.finalEntry?.id}, caution=${chestBreath.readerPred.cautionLogit.toFixed(3)}`);
  check('live subtle non-keyword neurological symptom caught and escalated to halt by reader',
    subtleReaderCatch.readerPred.active === true
      && subtleReaderCatch.finalEntry?.guardrail?.halt === true,
    `shipped=${subtleReaderCatch.shipped?.id ?? 'null'}, final=${subtleReaderCatch.finalEntry?.id ?? 'null'}, caution=${subtleReaderCatch.readerPred.cautionLogit.toFixed(3)}`);
  check('live harmless denial ("no knee pain today") yields null',
    cleanDenial.finalEntry === null,
    `entry=${cleanDenial.finalEntry?.id ?? 'null'}, caution=${cleanDenial.readerPred.cautionLogit.toFixed(3)}`);
  check('live danger-part cleared-up ("chest pain has cleared up") is NOT suppressed as harmless denial',
    dangerCleared.finalEntry !== null,
    `entry=${dangerCleared.finalEntry?.id ?? 'null'}, route=${dangerCleared.readerPred.actionableRouteId}`);
  check('live mixed denial + dizzy ("no pain today but felt dizzy") halts',
    dizzyAfterDenial.finalEntry?.guardrail?.halt === true,
    `entry=${dizzyAfterDenial.finalEntry?.id ?? 'null'}`);
  check('live clean positive report ("feeling amazing, weights are flying up") normalizes no-op to null with inactive reader',
    strongPositive.readerPred.active === false && strongPositive.finalEntry === null,
    `shipped=${strongPositive.shipped?.id ?? 'null'}, final=${strongPositive.finalEntry?.id ?? 'null'}, caution=${strongPositive.readerPred.cautionLogit.toFixed(3)}`);
}

console.log(`\n${fail === 0 ? 'ALL SAFETY READER INTEGRITY CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
