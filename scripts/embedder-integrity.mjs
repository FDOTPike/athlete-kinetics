/**
 * embedder-integrity.mjs — the single, pure source of truth for the embedder
 * supply chain pin, shared by:
 *   - scripts/fetch-embedder.mjs   (materialization + verification),
 *   - packages/inference/test/verify_embedder_integrity.mjs (deterministic gate),
 *   - .github/workflows/ci.yml     (cache keys hash this file),
 *   - packages/inference/test/verify_embedder.mjs (reference pipeline revision).
 *
 * The revision and every byte hash here are owner-ratified. No network access
 * and no ambient I/O happen at import time; the only I/O helpers are explicit
 * functions acting on paths the caller supplies. Changing ANY constant in this
 * file busts the CI cache, which is exactly what "pin-bearing source" means.
 */
import { createHash } from 'node:crypto';
import { readFileSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

export const PINNED_REVISION = '751bff37182d3f1213fa05d7196b954e230abad9';
export const REVISION_URL =
  'https://huggingface.co/Xenova/all-MiniLM-L6-v2/commit/751bff37182d3f1213fa05d7196b954e230abad9';

/** Ratified byte hashes for every remote artifact required by the offline
 *  Transformers feature-extraction pipeline. An artifact without an entry
 *  here is REJECTED (fail closed). */
export const KNOWN_SHA256 = Object.freeze({
  'config.json':
    '7135149f7cffa1a573466c6e4d8423ed73b62fd2332c575bf738a0d033f70df7',
  'onnx/model_quantized.onnx':
    'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1',
  'tokenizer.json':
    'da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0',
  'tokenizer_config.json':
    '9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3',
});

export const REMOTE_ARTIFACTS = Object.freeze(Object.keys(KNOWN_SHA256));

/** Ratified sha256 of the DISTILLED tokenizer.min.json (regenerated output). */
export const TOKENIZER_MIN_SHA256 =
  'ed2e443c24f234f62dd05a039ca0c489d8d1a7039f1f42fc876aaae9cb32cff6';

const FULL_SHA_RE = /^[0-9a-f]{40}$/;

/** Default filesystem cache root used by @xenova/transformers v2. Specific
 *  revisions are stored below <cache>/<model>/<revision>/<artifact>. */
export const DEFAULT_TRANSFORMERS_CACHE_ROOT = join(
  import.meta.dirname,
  '..',
  'node_modules',
  '@xenova',
  'transformers',
  '.cache',
);

/** A revision is acceptable ONLY as a full 40-char commit SHA. Mutable names
 *  ('main', branches, tags, short SHAs) are rejected so nothing can ride a
 *  moving target through the pinned byte check. */
export function assertPinnedRevision(revision) {
  if (typeof revision !== 'string' || !FULL_SHA_RE.test(revision)) {
    throw new Error(
      `Embedder revision must be a full 40-character commit SHA; got ${JSON.stringify(revision)}. ` +
        'Mutable revisions such as main, branch names, and tags are rejected.',
    );
  }
  return revision;
}

/** Refuse a codebase/configuration that names a different model. */
export function assertExpectedModelId(modelId) {
  if (modelId !== MODEL_ID) {
    throw new Error(
      `Embedder model ${JSON.stringify(modelId)} does not match the ratified ${JSON.stringify(MODEL_ID)}.`,
    );
  }
  return modelId;
}

/** Resolve the shared Transformers cache root without reading ambient state.
 *  Callers explicitly pass the QA override when one is configured. */
export function transformersCacheRoot(override) {
  return override ? resolve(override) : DEFAULT_TRANSFORMERS_CACHE_ROOT;
}

export function transformersModelCachePath(cacheRoot = DEFAULT_TRANSFORMERS_CACHE_ROOT) {
  return join(cacheRoot, ...MODEL_ID.split('/'));
}

export function transformersRevisionCachePath(
  cacheRoot = DEFAULT_TRANSFORMERS_CACHE_ROOT,
  revision = PINNED_REVISION,
) {
  return join(transformersModelCachePath(cacheRoot), assertPinnedRevision(revision));
}

export function transformersRevisionArtifactPath(
  rel,
  cacheRoot = DEFAULT_TRANSFORMERS_CACHE_ROOT,
  revision = PINNED_REVISION,
) {
  expectedSha256(rel);
  return join(transformersRevisionCachePath(cacheRoot, revision), ...rel.split('/'));
}

/** The only supported options for model consumers: exact immutable revision,
 *  exact shared cache root, and an explicit network prohibition. */
export function offlineTransformersOptions(cacheRoot = DEFAULT_TRANSFORMERS_CACHE_ROOT) {
  return {
    revision: PINNED_REVISION,
    cache_dir: cacheRoot,
    local_files_only: true,
  };
}

/** Couple model validation to the offline options so callers cannot silently
 * drift either half of the contract. */
export function offlineTransformersLoad(modelId, cacheOverride) {
  return {
    modelId: assertExpectedModelId(modelId),
    options: offlineTransformersOptions(transformersCacheRoot(cacheOverride)),
  };
}

/** Fail closed: an artifact with no declared expected hash is refused. */
export function expectedSha256(rel) {
  const expected = KNOWN_SHA256[rel];
  if (expected === undefined) {
    throw new Error(
      `No declared expected SHA-256 for embedder artifact ${JSON.stringify(rel)} — refusing it. ` +
        'Add a ratified hash to KNOWN_SHA256 before this artifact may be installed.',
    );
  }
  return expected;
}

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sha256File(path) {
  return sha256Bytes(readFileSync(path));
}

/** Pure check: throw on expected/actual mismatch with artifact name, actual
 *  hash, expected hash, and source; return the verified hex on success. */
export function verifyAgainst(expected, bytes, rel, source) {
  const actual = sha256Bytes(bytes);
  if (actual !== expected) {
    throw new Error(
      `CHECKSUM MISMATCH for ${rel} (${source}): got ${actual}, pinned ${expected} — refusing the artifact.`,
    );
  }
  return actual;
}

/** Verify bytes against the ratified pin for its artifact path. */
export function verifyIntegrity(rel, bytes, source) {
  return verifyAgainst(expectedSha256(rel), bytes, rel, source);
}

/** Verify an on-disk file against the ratified pin. */
export function verifyFileIntegrity(rel, path, source) {
  return verifyIntegrity(rel, readFileSync(path), source);
}

/** Existing-output entry point: an already-present destination file is only
 *  acceptable when it matches the pin. Used by fetch-embedder so "already
 *  present" can never bypass verification. */
export function verifyExistingOutput(rel, path) {
  return verifyFileIntegrity(rel, path, 'existing output');
}

/** Stage-then-install against an explicit hash. The staged file MUST verify
 *  before the destination is touched. rename-over-file keeps the replacement
 *  a single same-directory filesystem operation; there is deliberately no
 *  delete-before-replace window. `replaceFile` is injectable solely so the
 *  integrity gate can prove replacement failures preserve the destination. */
export function installVerifiedAgainst(
  expected,
  stagedPath,
  dest,
  rel,
  source,
  replaceFile = renameSync,
) {
  verifyAgainst(expected, readFileSync(stagedPath), rel, source); // throws; dest untouched
  replaceFile(stagedPath, dest);
  return verifyAgainst(expected, readFileSync(dest), rel, 'installed output');
}

/** Stage-then-install a declared remote artifact. */
export function installVerified(rel, stagedPath, dest, source, replaceFile = renameSync) {
  return installVerifiedAgainst(
    expectedSha256(rel),
    stagedPath,
    dest,
    rel,
    source,
    replaceFile,
  );
}

/** Distill HF tokenizers JSON into the minimal structure the device WordPiece
 *  tokenizer consumes. Object key order is load-bearing: it is part of the
 *  ratified tokenizer.min.json bytes, so it must never be reordered. */
export function buildTokenizerMin(tok, modelId) {
  if (tok.model?.type !== 'WordPiece') {
    throw new Error(`expected WordPiece, got ${tok.model?.type}`);
  }
  return {
    modelId,
    lowercase: tok.normalizer?.lowercase !== false,
    unkToken: tok.model.unk_token,
    continuingPrefix: tok.model.continuing_subword_prefix ?? '##',
    maxInputCharsPerWord: tok.model.max_input_chars_per_word ?? 100,
    vocab: tok.model.vocab,
  };
}
