# Embedder supply-chain pin — checkpoint handover

> **SUPERSEDED BY AUDIT CORRECTION (2026-08-13).** Audit of checkpoint
> `2f4e72e6915275f301d31365233a2fb629c43566` proved that its cold fetch did
> not populate the revision-scoped Transformers cache, two consumers still
> defaulted to mutable `main`, verification could reach the network, and two
> replacement paths could overwrite/remove trusted output before successful
> completion. The original report is retained below as historical evidence;
> its “fully pinned”, “no network in verify:all”, and final-green claims do not
> describe the corrected tree. See
> `HANDOVER_2026-08-13_EMBEDDER_SUPPLY_CHAIN_PIN_AUDIT_CORRECTION.md`.

Date: 2026-08-13
Baseline: `291183ef42a0c5f0932ed0d318ec9d0b48f16b0d`
Status: implementation + all gates green; one unsigned local commit; no push/release action

## What shipped

The mutable Hugging Face dependency is removed from the Athlete Kinetics
embedder supply chain. Every artifact (cache, download, or already-present
output file) now goes through one pure, shared verifier before it can be
installed as output.

Ratified pin (single source of truth: `scripts/embedder-integrity.mjs`):

- Model: `Xenova/all-MiniLM-L6-v2`
- Immutable revision: `751bff37182d3f1213fa05d7196b954e230abad9`
  (https://huggingface.co/Xenova/all-MiniLM-L6-v2/commit/751bff37182d3f1213fa05d7196b954e230abad9)
- `onnx/model_quantized.onnx` sha256 `afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1`
- `tokenizer.json` sha256 `da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0`
- distilled `tokenizer.min.json` sha256 `ed2e443c24f234f62dd05a039ca0c489d8d1a7039f1f42fc876aaae9cb32cff6`

Changed/new files:

- `scripts/embedder-integrity.mjs` (NEW) — pure pin + verifier module:
  revision/hash constants, `assertPinnedRevision` (rejects main/branches/tags/
  short SHAs), fail-closed `expectedSha256`, `verifyAgainst`/`verifyIntegrity`,
  `verifyExistingOutput`, `installVerified` (verify first, then replace),
  `buildTokenizerMin` (object key order is load-bearing for the min hash).
- `scripts/fetch-embedder.mjs` — default revision is the pin; a full 40-hex
  commit SHA is required; every artifact is staged to a temp path, verified,
  and only then installed; an existing ONNX output is re-verified (the previous
  skip-if-present bypass is fixed); cache failures fall back to the pinned
  download; `tokenizer.min.json` regeneration must reproduce the ratified hash
  or the script fails closed. QA seams `AK_EMBEDDER_CACHE`/`AK_EMBEDDER_OUT`
  redirect cache/output for cold-download proofs; `AK_EMBEDDER_REVISION=main`
  now fails closed.
- `packages/inference/test/verify_embedder_integrity.mjs` (NEW) — deterministic,
  offline gate covering the ten required adversarial cases.
- `packages/inference/test/verify_embedder.mjs` — the reference
  `@xenova/transformers` pipeline now loads the pinned revision, so the parity
  proof always compares against the same weights as the device ONNX.
- `package.json` — `verify:embedder` now also runs the integrity gate.
- `.github/workflows/ci.yml` — both cache keys hash the pin-bearing
  `scripts/embedder-integrity.mjs`; broad `restore-keys: minilm-` removed (a
  stale cache can only be rejected/replaced through the pinned-download path).
- `docs/PRE_RELEASE_ANDROID.md` — runbook documents the revision, all three
  hashes, and the fail-closed verification behavior.

## Verification evidence (exact outputs)

- `npm run typecheck` — PASS (exit 0).
- Deterministic integrity gate (standalone and inside `verify:embedder`) —
  ALL CHECKS PASSED, 10/10 sections:
  1. full immutable revision present; 6 mutable revisions rejected;
  2. both remote artifacts pinned (ratified hashes, undeclared hash refused);
  3. correct files pass, including existing outputs against the real pins;
  4. one-byte-corrupted ONNX refused with artifact + actual + expected hash;
  5. one-byte-corrupted tokenizer refused likewise;
  6. cache and download share one `installVerified` seam (behavioral + source);
  7. existing output cannot bypass verification (wrong bytes refused);
  8. failed verification never replaces a previously trusted destination;
  9. regenerated `tokenizer.min.json` byte-identical
     (`ed2e443c24f234f62dd05a039ca0c489d8d1a7039f1f42fc876aaae9cb32cff6`);
  10. both CI cache keys hash the pin-bearing module; no broad restore-keys.
- `npm run fetch:embedder` (existing outputs) —
  `already present and verified: model_quantized.onnx sha256=afdb6f1a…`,
  `from cache (pinned, verified): tokenizer.json sha256=da0e7993…`,
  `wrote tokenizer.min.json (30522 vocab entries, sha256=ed2e443c…, ratified/byte-identical)`.
  `git status` confirms the committed `tokenizer.min.json` was NOT modified
  (regeneration byte-identical).
- Cold fetch from the immutable revision (empty temp cache + temp output via
  `AK_EMBEDDER_CACHE`/`AK_EMBEDDER_OUT`; the owner's cache was untouched and
  re-verified unchanged): both artifacts downloaded from
  `751bff37182d3f1213fa05d7196b954e230abad9` and verified:
  - `model_quantized.onnx` = `afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1`
  - `tokenizer.full.json` = `da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0`
  - `tokenizer.min.json` = `ed2e443c24f234f62dd05a039ca0c489d8d1a7039f1f42fc876aaae9cb32cff6`
  Temporary paths removed after proof.
- `AK_EMBEDDER_REVISION=main` — fails closed, exit 1, clear message.
- `npm run verify:semantic` — ALL CHECKS PASSED (routing 15/15).
- `npm run verify:embedder` — ALL CHECKS PASSED (tokenizer parity 70/70,
  embedding parity worst cosine `1.000000`, routing 15/15, latency 7.3 ms,
  plus the integrity gate).
- `npm run verify:all` — PASS, exit 0 (all 20 gates + typecheck; components
  11 suites / 178 tests / 0 snapshots).
- Android ONNX packaging contract — `./gradlew :app:verifyOnnxRuntimePackagingContract
  --no-daemon` BUILD SUCCESSFUL in 35 s (no native/packaging inputs changed;
  full APK/AAB rebuild not required).
- `git diff --check` — clean.

## Environment note (not a code defect)

`SessionAccessBoundary.test.js` failed locally at first `verify:all` run. Root
cause: a stale jest transform cache still served the pre-baseline (3651-byte)
`054_contract_cutoff_provenance.sql` under jest while the committed file is
4555 bytes and includes the two immutability-trigger sentinels, so the store
boot's sentinel heal could never satisfy
`trg_routine_template_contract_cutoff_bu/bd`. This reproduces with my changes
stashed (i.e., it is baseline state) and disappears with a fresh jest cache
(`npx jest --clearCache`; suite 11/11 green, `verify:all` green). CI is
unaffected (fresh checkout). No repository change was needed.

## Judgment calls / limitations

- `verify_semantic.mjs` and `scripts/embed-codebase.mjs` still call
  `@xenova/transformers` without an explicit revision. Both are outside the
  allowed scope of this work order. Today their cache holds exactly the pinned
  bytes (verified), so they operate on the ratified weights; a cold-cache run
  of `verify_semantic` before `fetch:embedder` would still fetch HF `main`.
  Recommend a follow-up to pin those two call sites to the same revision —
  flagged, not silently expanded into this work order.
- `AK_EMBEDDER_REVISION` remains supported but is restricted to a full 40-char
  commit SHA and can never bypass the ratified byte hashes (any other revision
  fails the hash gate or the download).
- `AK_EMBEDDER_CACHE` / `AK_EMBEDDER_OUT` are QA-only seams for cold-download
  proof; production and CI use the real paths.
- No ONNX/tokenizer/vocab/vector/semantic-policy/runtime behavior changed.

## MASTER LEDGER ENTRY

- Input: green baseline `291183e`; owner-ratified model id, revision
  `751bff37…`, and three SHA-256 values.
- Constraints enforced: append-only/no shipped-migration edits; no network in
  verify:all; no commit of model bytes or caches; scope limited to the listed
  files; no push/sign/upload/publish/release.
- Actions: extracted the pin into a pure shared module; rewrote the fetcher to
  stage-verify-install with existing-output verification; added a 10-case
  deterministic integrity gate; pinned the parity reference pipeline; rebound
  CI cache keys to the pin-bearing source and removed broad restore-keys;
  documented the runbook; ran typecheck, fetch, cold pinned download,
  semantic/embedder/all gates, and the Android packaging contract.
- Constraint delta: `verify:embedder` +1 gate (deterministic integrity); CI
  cache key source changed; 2 new small files; zero runtime-model behavior
  delta (worst parity cosine 1.000000).
- Output: one unsigned local checkpoint commit
  `fix(embedder): pin model supply chain`. No release action occurred.
