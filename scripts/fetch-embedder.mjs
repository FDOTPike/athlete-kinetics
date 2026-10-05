/**
 * fetch-embedder.mjs — the only network-enabled model materializer.
 *
 * It populates both:
 *   - the exact revision-scoped @xenova/transformers v2 cache consumed by
 *     offline verification/build scripts, and
 *   - packages/inference/assets/minilm/ for the device embedder.
 *
 * Every cache, output, legacy-cache, and download candidate passes the same
 * ratified byte verifier before installation. Downloads use only the immutable
 * revision URL. All stages live beside their destination and verified files
 * replace their destination without a delete-before-replace window.
 *
 * Run: node scripts/fetch-embedder.mjs
 * QA seams: AK_EMBEDDER_CACHE, AK_EMBEDDER_OUT, AK_EMBEDDER_REVISION.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import {
  MODEL_ID,
  PINNED_REVISION,
  REMOTE_ARTIFACTS,
  TOKENIZER_MIN_SHA256,
  assertExpectedModelId,
  assertPinnedRevision,
  buildTokenizerMin,
  installVerified,
  installVerifiedAgainst,
  transformersCacheRoot,
  transformersModelCachePath,
  transformersRevisionArtifactPath,
  transformersRevisionCachePath,
  verifyExistingOutput,
} from './embedder-integrity.mjs';

const ROOT = join(import.meta.dirname, '..');
const ASSETS = join(ROOT, 'packages', 'inference', 'assets');
const OUT = process.env.AK_EMBEDDER_OUT
  ? join(process.env.AK_EMBEDDER_OUT)
  : join(ASSETS, 'minilm');
const codebase = JSON.parse(readFileSync(join(ASSETS, 'phrase-codebase.json'), 'utf-8'));
assertExpectedModelId(codebase.embeddingModel);

// The override exists only for adversarial QA. It may name another immutable
// commit, but the ratified byte hashes remain mandatory and cannot be bypassed.
const MODEL_REVISION = assertPinnedRevision(
  process.env.AK_EMBEDDER_REVISION ?? PINNED_REVISION,
);
const CACHE_ROOT = transformersCacheRoot(process.env.AK_EMBEDDER_CACHE);
const REVISION_CACHE = transformersRevisionCachePath(CACHE_ROOT, MODEL_REVISION);
const LEGACY_MODEL_CACHE = transformersModelCachePath(CACHE_ROOT);

mkdirSync(OUT, { recursive: true });
mkdirSync(REVISION_CACHE, { recursive: true });

let stageSequence = 0;
function stagePathFor(dest) {
  mkdirSync(dirname(dest), { recursive: true });
  stageSequence += 1;
  return join(dirname(dest), `.${basename(dest)}.stage-${process.pid}-${stageSequence}`);
}

function removeStage(staged) {
  try {
    rmSync(staged, { force: true });
  } catch {
    // Best-effort cleanup must never mask the materialization result.
  }
}

/** Copy a local candidate into a same-directory stage, then verify and replace
 * through the shared install seam. No ambient cache bytes are trusted unseen. */
function installLocalCandidate(rel, candidate, dest, source) {
  if (!existsSync(candidate)) return false;
  const staged = stagePathFor(dest);
  try {
    copyFileSync(candidate, staged);
    const sha = installVerified(rel, staged, dest, source);
    console.log(`from ${source} (pinned, verified): ${rel}  sha256=${sha}`);
    return true;
  } catch (error) {
    console.error(`${source} artifact rejected for ${rel}: ${error.message}`);
    return false;
  } finally {
    removeStage(staged);
  }
}

async function downloadPinned(rel, dest) {
  const staged = stagePathFor(dest);
  try {
    const url = `https://huggingface.co/${MODEL_ID}/resolve/${MODEL_REVISION}/${rel}`;
    console.log(`downloading (pinned ${MODEL_REVISION}): ${url}`);
    const response = await fetch(url);
    if (!response.ok || response.body === null) {
      throw new Error(`${response.status} ${url}`);
    }
    await writeFile(staged, Readable.fromWeb(response.body));
    const sha = installVerified(rel, staged, dest, 'download');
    console.log(`downloaded into revision cache (pinned, verified): ${rel}  sha256=${sha}`);
  } finally {
    removeStage(staged);
  }
}

const DEVICE_OUTPUTS = Object.freeze({
  'onnx/model_quantized.onnx': join(OUT, 'model_quantized.onnx'),
  'tokenizer.json': join(OUT, 'tokenizer.full.json'),
});

/** Populate exactly <cache-root>/<model>/<revision>/<artifact>. A legacy
 * unrevisioned cache entry or device output may seed it only after hash proof;
 * otherwise the immutable URL is the sole fallback. */
async function ensureRevisionArtifact(rel) {
  const dest = transformersRevisionArtifactPath(rel, CACHE_ROOT, MODEL_REVISION);
  if (existsSync(dest)) {
    try {
      const sha = verifyExistingOutput(rel, dest);
      console.log(`revision cache present and verified: ${rel}  sha256=${sha}`);
      return dest;
    } catch (error) {
      console.error(`revision cache FAILED verification for ${rel}: ${error.message}`);
    }
  }

  const outputCandidate = DEVICE_OUTPUTS[rel];
  if (outputCandidate && installLocalCandidate(rel, outputCandidate, dest, 'existing output')) {
    return dest;
  }

  const legacyCandidate = join(LEGACY_MODEL_CACHE, ...rel.split('/'));
  if (installLocalCandidate(rel, legacyCandidate, dest, 'legacy cache')) {
    return dest;
  }

  await downloadPinned(rel, dest);
  return dest;
}

const revisionArtifacts = new Map();
for (const rel of REMOTE_ARTIFACTS) {
  revisionArtifacts.set(rel, await ensureRevisionArtifact(rel));
}

// Device files are installed only from the verified revision cache. Correct
// existing files are retained after explicit verification.
for (const [rel, dest] of Object.entries(DEVICE_OUTPUTS)) {
  if (existsSync(dest)) {
    try {
      const sha = verifyExistingOutput(rel, dest);
      console.log(`device output present and verified: ${basename(dest)}  sha256=${sha}`);
      continue;
    } catch (error) {
      console.error(`device output FAILED verification for ${rel}: ${error.message}`);
    }
  }

  const installed = installLocalCandidate(
    rel,
    revisionArtifacts.get(rel),
    dest,
    'revision cache',
  );
  if (!installed) {
    throw new Error(`Unable to install verified ${rel} into device output ${dest}.`);
  }
}

// Distill and stage the device tokenizer. A mismatching regeneration is
// rejected before the previous trusted tokenizer.min.json is touched.
const tokJsonPath = DEVICE_OUTPUTS['tokenizer.json'];
const tok = JSON.parse(readFileSync(tokJsonPath, 'utf-8'));
const min = buildTokenizerMin(tok, MODEL_ID);
for (const token of ['[CLS]', '[SEP]', '[UNK]', '[PAD]']) {
  if (min.vocab[token] === undefined) {
    throw new Error(`special token missing from vocab: ${token}`);
  }
}

const minPath = join(OUT, 'tokenizer.min.json');
const minStage = stagePathFor(minPath);
let minSha;
try {
  await writeFile(minStage, JSON.stringify(min));
  minSha = installVerifiedAgainst(
    TOKENIZER_MIN_SHA256,
    minStage,
    minPath,
    'tokenizer.min.json',
    'regenerated',
  );
} finally {
  removeStage(minStage);
}

console.log(
  `installed tokenizer.min.json (${Object.keys(min.vocab).length} vocab entries, sha256=${minSha}, ratified/byte-identical)`,
);
