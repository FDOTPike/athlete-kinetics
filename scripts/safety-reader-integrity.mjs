/**
 * safety-reader-integrity.mjs — pure source of truth for the Stream 2 safety
 * reader (`m10-r15-reader-seed3`) supply-chain pin, shared by:
 *   - scripts/fetch-safety-reader.mjs          (cache + asset materializer),
 *   - scripts/stage-native-safety-reader.mjs   (native bundle staging),
 *   - scripts/verify-preflight.mjs             (offline verification preflight),
 *   - packages/inference/test/verify_safety_reader_integrity.mjs (gate),
 *   - .github/workflows/ci.yml                 (cache key hashes this file).
 *
 * No network access and no ambient filesystem I/O occur at import time. Changing
 * any constant in this file invalidates the CI model cache key.
 */
import { createHash } from 'node:crypto';
import { readFileSync, renameSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const SAFETY_READER_MODEL_ID = 'm10-r15-reader-seed3';
export const SAFETY_READER_POLICY_ID = 'r15/denial-floor';
export const SAFETY_READER_ARTIFACT = 'reader_quantized.onnx';

export const PINNED_RELEASE_REPO = 'FDOTPike/athlete-kinetics';
export const PINNED_RELEASE_TAG = 'ml-reader-m10-r15-s3';
export const PINNED_RELEASE_ID = 453586297;
export const PINNED_RELEASE_COMMIT = 'b6ceee70c7b7a9afd793968e8ca15ba17704b572';
export const PINNED_ASSET_ID = 775095775;
export const PINNED_ASSET_API_URL =
  `https://api.github.com/repos/${PINNED_RELEASE_REPO}/releases/assets/${PINNED_ASSET_ID}`;
export const PINNED_DOWNLOAD_URL =
  `https://github.com/${PINNED_RELEASE_REPO}/releases/download/${PINNED_RELEASE_TAG}/${SAFETY_READER_ARTIFACT}`;

/** Ratified SHA-256 digest(s) for declared remote safety-reader artifacts. */
export const KNOWN_SHA256 = Object.freeze({
  [SAFETY_READER_ARTIFACT]:
    'a0fa76e40e10246a9caf9d1be463b72b34f03174c68b017d6673fe9f165cb5cf',
});

/** Ratified exact byte count(s) for declared remote safety-reader artifacts. */
export const KNOWN_BYTES = Object.freeze({
  [SAFETY_READER_ARTIFACT]: 22881187,
});

export const REMOTE_SAFETY_READER_ARTIFACTS = Object.freeze(Object.keys(KNOWN_SHA256));

const FULL_SHA_RE = /^[0-9a-f]{40}$/;

export const DEFAULT_SAFETY_READER_CACHE_ROOT = join(
  import.meta.dirname,
  '..',
  'node_modules',
  '.cache',
  'ak-safety-reader',
);

export const DEFAULT_SAFETY_READER_OUT_DIR = join(
  import.meta.dirname,
  '..',
  'packages',
  'inference',
  'assets',
  'safety-reader',
);

export function assertPinnedReleaseCommit(commit) {
  if (typeof commit !== 'string' || !FULL_SHA_RE.test(commit)) {
    throw new Error(
      `Safety reader release commit must be a full 40-character commit SHA; got ${JSON.stringify(commit)}. `
      + 'Mutable revisions such as main, branch names, and tags are rejected.',
    );
  }
  return commit;
}

export function assertExpectedSafetyReaderModelId(modelId) {
  if (modelId !== SAFETY_READER_MODEL_ID) {
    throw new Error(
      `Safety reader model ${JSON.stringify(modelId)} does not match ratified ${JSON.stringify(SAFETY_READER_MODEL_ID)}.`,
    );
  }
  return modelId;
}

export function safetyReaderCacheRoot(override) {
  return override ? resolve(override) : DEFAULT_SAFETY_READER_CACHE_ROOT;
}

export function safetyReaderCommitCachePath(
  cacheRoot = DEFAULT_SAFETY_READER_CACHE_ROOT,
  commit = PINNED_RELEASE_COMMIT,
) {
  return join(cacheRoot, assertPinnedReleaseCommit(commit));
}

export function safetyReaderCacheArtifactPath(
  rel,
  cacheRoot = DEFAULT_SAFETY_READER_CACHE_ROOT,
  commit = PINNED_RELEASE_COMMIT,
) {
  expectedSafetyReaderSha256(rel);
  expectedSafetyReaderBytes(rel);
  return join(safetyReaderCommitCachePath(cacheRoot, commit), ...rel.split('/'));
}

export function expectedSafetyReaderSha256(rel) {
  if (typeof rel !== 'string' || !Object.hasOwn(KNOWN_SHA256, rel)) {
    throw new Error(
      `No declared expected SHA-256 for safety reader artifact ${JSON.stringify(rel)} — refusing it.`,
    );
  }
  return KNOWN_SHA256[rel];
}

export function expectedSafetyReaderBytes(rel) {
  if (typeof rel !== 'string' || !Object.hasOwn(KNOWN_BYTES, rel)) {
    throw new Error(
      `No declared expected byte size for safety reader artifact ${JSON.stringify(rel)} — refusing it.`,
    );
  }
  return KNOWN_BYTES[rel];
}

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sha256File(path) {
  return sha256Bytes(readFileSync(path));
}

export function verifySafetyReaderAgainst(expectedSha, expectedBytes, bytes, rel, source) {
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) {
    throw new Error(`Invalid byte buffer for ${rel} (${source}).`);
  }
  if (bytes.byteLength !== expectedBytes) {
    throw new Error(
      `SIZE MISMATCH for ${rel} (${source}): got ${bytes.byteLength} B, pinned ${expectedBytes} B — refusing the artifact.`,
    );
  }
  const actual = sha256Bytes(bytes);
  if (actual !== expectedSha) {
    throw new Error(
      `CHECKSUM MISMATCH for ${rel} (${source}): got ${actual}, pinned ${expectedSha} — refusing the artifact.`,
    );
  }
  return actual;
}

export function verifySafetyReaderIntegrity(rel, bytes, source) {
  return verifySafetyReaderAgainst(
    expectedSafetyReaderSha256(rel),
    expectedSafetyReaderBytes(rel),
    bytes,
    rel,
    source,
  );
}

/**
 * Stat-check regular-file identity and exact ratified byte count BEFORE reading
 * file contents into memory so oversized or non-regular files fail closed cleanly.
 */
export function verifySafetyReaderFile(rel, path, source) {
  const expectedSha = expectedSafetyReaderSha256(rel);
  const expectedBytes = expectedSafetyReaderBytes(rel);
  const st = statSync(path);
  if (!st.isFile()) {
    throw new Error(`NON-REGULAR FILE for ${rel} (${source}): ${path}`);
  }
  if (st.size !== expectedBytes) {
    throw new Error(
      `SIZE MISMATCH for ${rel} (${source}): got ${st.size} B, pinned ${expectedBytes} B — refusing the artifact.`,
    );
  }
  return verifySafetyReaderAgainst(expectedSha, expectedBytes, readFileSync(path), rel, source);
}

export function installVerifiedSafetyReaderAgainst(
  expectedSha,
  expectedBytes,
  stagedPath,
  dest,
  rel,
  source,
  replaceFile = renameSync,
) {
  const st = statSync(stagedPath);
  if (!st.isFile()) {
    throw new Error(`NON-REGULAR FILE for ${rel} (${source}): ${stagedPath}`);
  }
  if (st.size !== expectedBytes) {
    throw new Error(
      `SIZE MISMATCH for ${rel} (${source}): got ${st.size} B, pinned ${expectedBytes} B — refusing the artifact.`,
    );
  }
  verifySafetyReaderAgainst(expectedSha, expectedBytes, readFileSync(stagedPath), rel, source);
  replaceFile(stagedPath, dest);
  const destStat = statSync(dest);
  if (!destStat.isFile() || destStat.size !== expectedBytes) {
    throw new Error(
      `SIZE MISMATCH for ${rel} (installed output): got ${destStat.size} B, pinned ${expectedBytes} B.`,
    );
  }
  return verifySafetyReaderAgainst(
    expectedSha,
    expectedBytes,
    readFileSync(dest),
    rel,
    'installed output',
  );
}

export function installVerifiedSafetyReader(
  rel,
  stagedPath,
  dest,
  source,
  replaceFile = renameSync,
) {
  return installVerifiedSafetyReaderAgainst(
    expectedSafetyReaderSha256(rel),
    expectedSafetyReaderBytes(rel),
    stagedPath,
    dest,
    rel,
    source,
    replaceFile,
  );
}
