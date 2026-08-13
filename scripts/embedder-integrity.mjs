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
import { readFileSync, rmSync, renameSync } from 'node:fs';

export const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

export const PINNED_REVISION = '751bff37182d3f1213fa05d7196b954e230abad9';
export const REVISION_URL =
  'https://huggingface.co/Xenova/all-MiniLM-L6-v2/commit/751bff37182d3f1213fa05d7196b954e230abad9';

/** Ratified byte hashes for the two artifacts fetched from the pinned
 *  revision. An artifact without an entry here is REJECTED (fail closed). */
export const KNOWN_SHA256 = Object.freeze({
  'onnx/model_quantized.onnx':
    'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1',
  'tokenizer.json':
    'da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0',
});

/** Ratified sha256 of the DISTILLED tokenizer.min.json (regenerated output). */
export const TOKENIZER_MIN_SHA256 =
  'ed2e443c24f234f62dd05a039ca0c489d8d1a7039f1f42fc876aaae9cb32cff6';

const FULL_SHA_RE = /^[0-9a-f]{40}$/;

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

/** Stage-then-install: the staged file MUST verify before the previous
 *  destination is touched. On any mismatch the destination is left exactly as
 *  it was (a failed verification can never replace a trusted file). */
export function installVerified(rel, stagedPath, dest, source) {
  verifyFileIntegrity(rel, stagedPath, source); // throws; dest untouched
  rmSync(dest, { force: true });
  renameSync(stagedPath, dest);
  return sha256File(dest);
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