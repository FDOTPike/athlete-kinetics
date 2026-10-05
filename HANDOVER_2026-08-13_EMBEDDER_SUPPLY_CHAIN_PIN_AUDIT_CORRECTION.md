# Embedder supply-chain pin — audit correction handover

Date: 2026-08-13
Audited checkpoint: `2f4e72e6915275f301d31365233a2fb629c43566`
Correction status: implementation and all required gates green; the correction
checkpoint is the commit containing this file (exact SHA reported at handoff)

## Audit findings corrected

- Cold `fetch:embedder` now populates the exact Transformers v2 key:
  `<cache-root>/Xenova/all-MiniLM-L6-v2/751bff…/<artifact>`.
- `config.json`, `onnx/model_quantized.onnx`, `tokenizer.json`, and
  `tokenizer_config.json` are independently hash-pinned. Existing outputs,
  legacy cache candidates, revision-cache candidates, and downloads all use
  the same byte verifier.
- `fetch:embedder` is the only network-enabled model materializer. Every
  Transformers caller validates `MODEL_ID`, uses the shared immutable revision
  and exact cache root, and sets `local_files_only=true`. An empty cache fails
  locally with zero fetch calls.
- `tokenizer.min.json` is generated into a same-directory stage and verified
  before replacement. A mismatch preserves the previous trusted file.
- Verified replacements use same-directory rename-over-file with no
  delete-before-replace window. The injectable failure test proves a failed
  replacement preserves the previous destination.

## Ratified remote bytes

- `config.json` — `7135149f7cffa1a573466c6e4d8423ed73b62fd2332c575bf738a0d033f70df7`
- `onnx/model_quantized.onnx` — `afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1`
- `tokenizer.json` — `da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0`
- `tokenizer_config.json` — `9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3`
- distilled `tokenizer.min.json` — `ed2e443c24f234f62dd05a039ca0c489d8d1a7039f1f42fc876aaae9cb32cff6`

## Targeted evidence

- `npm run fetch:embedder` — PASS; four revision-cache artifacts and three
  device outputs verified; no tokenizer/model/vector byte drift.
- `node packages/inference/test/verify_embedder_integrity.mjs` — ALL CHECKS
  PASSED, 0 skipped; includes empty/populated-cache network-blocked behavior,
  four hash pins, exact layout, caller contract, mismatch preservation, and
  injected replacement failure preservation.
- `npm run verify:semantic` — ALL CHECKS PASSED, routing 15/15, offline.
- `npm run verify:embedder` — ALL CHECKS PASSED, tokenizer 70/70, worst cosine
  1.000000, routing 15/15; integrity gate also green, 0 skipped.
- `npm run typecheck` — PASS (exit 0).
- Isolated cold fetch — PASS: four downloads used only the full immutable
  revision URLs and produced the exact revision-cache layout; semantic routing
  15/15 and reference parity 70/70 / cosine 1.000000 then passed from that
  isolated cache. The temporary output/cache was outside the repository.
- `AK_EMBEDDER_REVISION=main npm run fetch:embedder` — expected fail closed
  (underlying command exit 1) before materialization; zero files created.
- `npm run verify:all` — PASS (exit 0): all 20 gates plus typecheck;
  migrations reached `user_version=53` with 72 sentinels; components passed
  11/11 suites and 178/178 tests with zero snapshots.
- Metro Android production bundle — PASS; 2,921,277 bytes, sha256
  `d5959608f07b8e3b9d37132ca7c945ef3d3848194d1de563a9bbd71c24367f21`.
- `:app:verifyOnnxRuntimePackagingContract assembleDebug bundleDebug
  --no-daemon` — BUILD SUCCESSFUL in 1m41s (218 actionable tasks: 80 executed,
  138 up-to-date). The malformed APK/AAB rejection contract passed and both
  real producers passed their post-package ONNX pairing checks.
- Debug APK — 244,935,262 bytes, sha256
  `d381ea378aa60838227109f7a9f143cc2c8e154bd018d741c82bc335dee025c4`.
- Debug AAB — 99,247,364 bytes, sha256
  `65db8902f4466f262d8c0fae1f8db10f0d24a99de589005576506a4bd1f73aca`.
  Both contain model sha256 `afdb6f1a…` and paired
  `libonnxruntime.so`/`libonnxruntimejsi.so` for arm64-v8a, armeabi-v7a,
  x86, and x86_64.
- Pixel 9 Pro device smoke — debug APK replacement install succeeded; a
  Metro-backed cold launch completed in 480 ms, logged
  `Running "AthleteKinetics"`, and had zero fatal-process matches. The temporary
  port reverse and this worktree’s Metro helper were removed afterward.
- `git diff --check` — PASS before checkpoint creation.

## Scope and limitations

- No shipped migration or runtime inference policy was changed.
- No ONNX, tokenizer, vocabulary, or phrase-vector bytes changed.
- Native evidence is debug/Metro QA, not a release-variant acceptance matrix.
  Standard debug signing was used only to build/install the QA artifacts; no
  release key, release signing, upload, publish, push, or release action was
  used or authorized.
