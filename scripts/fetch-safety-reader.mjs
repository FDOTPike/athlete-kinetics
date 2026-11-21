/**
 * fetch-safety-reader.mjs — pinned, byte-verified materializer for the Stream 2
 * safety reader (`m10-r15-reader-seed3`, `reader_quantized.onnx`).
 *
 * Populates both:
 *   - the commit-scoped cache (`node_modules/.cache/ak-safety-reader/<commit>/`), and
 *   - `packages/inference/assets/safety-reader/reader_quantized.onnx`.
 *
 * Downloads strictly from the pinned GitHub Release asset URL when neither cache
 * nor existing output verifies, bounds incoming stream bytes to the exact
 * ratified byte count before disk completion, and installs via same-directory
 * atomic rename-over-file replacement.
 *
 * Run: node scripts/fetch-safety-reader.mjs
 * QA seams: AK_SAFETY_READER_CACHE, AK_SAFETY_READER_OUT, AK_SAFETY_READER_COMMIT.
 */
import { once } from 'node:events';
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  rmSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import {
  DEFAULT_SAFETY_READER_OUT_DIR,
  PINNED_DOWNLOAD_URL,
  PINNED_RELEASE_COMMIT,
  PINNED_RELEASE_TAG,
  REMOTE_SAFETY_READER_ARTIFACTS,
  SAFETY_READER_ARTIFACT,
  assertPinnedReleaseCommit,
  expectedSafetyReaderBytes,
  installVerifiedSafetyReader,
  safetyReaderCacheArtifactPath,
  safetyReaderCacheRoot,
  safetyReaderCommitCachePath,
  verifySafetyReaderFile,
} from './safety-reader-integrity.mjs';

const OUT = process.env.AK_SAFETY_READER_OUT
  ? resolve(process.env.AK_SAFETY_READER_OUT)
  : DEFAULT_SAFETY_READER_OUT_DIR;
const RELEASE_COMMIT = assertPinnedReleaseCommit(
  process.env.AK_SAFETY_READER_COMMIT ?? PINNED_RELEASE_COMMIT,
);
const CACHE_ROOT = safetyReaderCacheRoot(process.env.AK_SAFETY_READER_CACHE);
const COMMIT_CACHE = safetyReaderCommitCachePath(CACHE_ROOT, RELEASE_COMMIT);

mkdirSync(OUT, { recursive: true });
mkdirSync(COMMIT_CACHE, { recursive: true });

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
    // Best-effort stage cleanup must never mask the materialization outcome.
  }
}

function installLocalCandidate(rel, candidate, dest, source) {
  if (!existsSync(candidate)) return false;
  const staged = stagePathFor(dest);
  try {
    copyFileSync(candidate, staged);
    const sha = installVerifiedSafetyReader(rel, staged, dest, source);
    console.log(`from ${source} (pinned, verified): ${rel}  sha256=${sha}`);
    return true;
  } catch (error) {
    console.error(`${source} artifact rejected for ${rel}: ${error.message}`);
    return false;
  } finally {
    removeStage(staged);
  }
}

async function streamBoundedToFile(webBody, stagedPath, maxBytes, rel) {
  const nodeStream = Readable.fromWeb(webBody);
  const out = createWriteStream(stagedPath);
  let received = 0;
  try {
    for await (const chunk of nodeStream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      received += buf.byteLength;
      if (received > maxBytes) {
        nodeStream.destroy();
        throw new Error(
          `SIZE MISMATCH for ${rel} (download stream): exceeded pinned ${maxBytes} B — aborting download.`,
        );
      }
      if (!out.write(buf)) {
        await once(out, 'drain');
      }
    }
    out.end();
    await once(out, 'finish');
  } catch (err) {
    out.destroy();
    throw err;
  }
}

async function downloadPinned(rel, dest) {
  if (rel !== SAFETY_READER_ARTIFACT) {
    throw new Error(`Unsupported remote safety reader artifact: ${rel}`);
  }
  const maxBytes = expectedSafetyReaderBytes(rel);
  const staged = stagePathFor(dest);
  try {
    console.log(`downloading (pinned ${PINNED_RELEASE_TAG} @ ${RELEASE_COMMIT}): ${PINNED_DOWNLOAD_URL}`);
    const response = await fetch(PINNED_DOWNLOAD_URL, { redirect: 'follow' });
    if (!response.ok || response.body === null) {
      throw new Error(`HTTP ${response.status} fetching ${PINNED_DOWNLOAD_URL}`);
    }
    await streamBoundedToFile(response.body, staged, maxBytes, rel);
    const sha = installVerifiedSafetyReader(rel, staged, dest, 'download');
    console.log(`downloaded into safety-reader cache (pinned, verified): ${rel}  sha256=${sha}`);
  } finally {
    removeStage(staged);
  }
}

const DEVICE_OUTPUTS = Object.freeze({
  [SAFETY_READER_ARTIFACT]: join(OUT, SAFETY_READER_ARTIFACT),
});

async function ensureCachedArtifact(rel) {
  const dest = safetyReaderCacheArtifactPath(rel, CACHE_ROOT, RELEASE_COMMIT);
  if (existsSync(dest)) {
    try {
      const sha = verifySafetyReaderFile(rel, dest, 'existing cache');
      console.log(`safety-reader cache present and verified: ${rel}  sha256=${sha}`);
      return dest;
    } catch (error) {
      console.error(`safety-reader cache FAILED verification for ${rel}: ${error.message}`);
    }
  }

  const outputCandidate = DEVICE_OUTPUTS[rel];
  if (outputCandidate && installLocalCandidate(rel, outputCandidate, dest, 'existing output')) {
    return dest;
  }

  await downloadPinned(rel, dest);
  return dest;
}

const cachedArtifacts = new Map();
for (const rel of REMOTE_SAFETY_READER_ARTIFACTS) {
  cachedArtifacts.set(rel, await ensureCachedArtifact(rel));
}

for (const [rel, dest] of Object.entries(DEVICE_OUTPUTS)) {
  if (existsSync(dest)) {
    try {
      const sha = verifySafetyReaderFile(rel, dest, 'existing output');
      console.log(`safety-reader output present and verified: ${basename(dest)}  sha256=${sha}`);
      continue;
    } catch (error) {
      console.error(`safety-reader output FAILED verification for ${rel}: ${error.message}`);
    }
  }

  const installed = installLocalCandidate(rel, cachedArtifacts.get(rel), dest, 'cache');
  if (!installed) {
    throw new Error(`Unable to install verified ${rel} into ${dest}.`);
  }
}
