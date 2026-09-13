# HANDOVER — WO-03 backup foundation

Date: 2026-09-12
Branch: `codex/ac-wo03-backup`
Frozen input: `87624d9e43189ddd87db317e24d4379ef5a13fae`

## Implemented

- Deterministic, versioned inner backup envelope under `packages/core-db/src/backup/`.
- Strict parser/validator for shape, format/version, canonical bytes, real UTC timestamps, manifest counts, duplicate identifiers, and an injected SHA-256 integrity checksum binding manifest metadata plus payload.
- Explicit v1 replacement policy and database-schema adapter gate.
- Pure restore state machine requiring validation and confirmed recovery copy before apply; cancel/low-storage/failure after apply require rollback.
- Focused verification gate and representative round-trip fixtures.
- Full 86-table durable-data inventory, including external `coach_athletes.json`, two views, and superseded migration intermediates.
- Decision docket covering compatibility, atomicity boundary, failure behavior, native gaps, CSV separation, and health-data encryption/recovery implications.

## Deliberately not implemented

- Profile/settings UI, onboarding copy, last-backup state, store/schema wiring, or migration 064.
- SQLite extraction, safe database snapshot, recovery file, atomic swap, restore journal, or fresh-install transfer.
- OS file picker, shareable file URI, encryption wrapper, password/key handling, or storage preflight.
- CSV export.
- WO-05 existing-activity and WO-06 health/clinician schema. The generic format is extensible but does not invent it.

This branch is a backup **foundation**, not an end-to-end backup feature. No product surface should claim otherwise.

## Policy decisions for review

1. Ratify v1 replace-only behavior. Merge remains unsupported.
2. Ratify dual protection: password-encrypted portable container; device-bound encryption for local recovery copy.
3. Ratify all-athletes as the default complete backup scope so `coach_athletes.json` and every database stay coherent; a single-athlete option must be labelled as scoped.
4. Ratify the registered-adapter compatibility policy rather than accepting every older schema implicitly.
5. Select and review the native implementation facility: first-party bridge over OS document/share APIs plus SQLite backup, or pinned third-party bindings after security/memory review.

## Re-test gates for integration

- After migration 064 and the shared WO-05/WO-06 contract: regenerate the inventory, add every new field/table to a representative fixture, and restore onto a fresh installation.
- Exercise all-athletes registry/database cohesion.
- Verify SQLite snapshot consistency during attempted writes and an in-progress runner checkpoint.
- Verify encrypted container wrong-password/tamper behavior and lost-password copy.
- Verify Android/iOS create/open/share cancellation and URI lifetime on real devices.
- Inject failure before swap, during each file swap, and after swap before reopen; prove recovery returns all current data.
- Inject low storage at capture, staging, recovery-copy, and apply boundaries.
- Compare all durable athlete-owned data and required provenance after restore.

## Gate evidence

- `npm run typecheck` — PASS.
- `npm run verify:backup` — PASS: deterministic round trip, manifest/payload integrity, compatibility, duplicate, replace, cancel, low-storage, rollback.
- `npm run verify:migrations` — PASS: current `user_version = 62`, all 112 sentinels present, full chain checks passed.
- `npm run verify:db` — PASS: schema and synthetic database checks passed on SQLite 3.50.4.
- `git diff --check` — required immediately before commit.
- `npm run verify:store` — PASS: 673/673 store checks plus routine-template suites; includes the exact 22-gate/doc/workflow drift assertions.
- `node tools/test_verify_ci_structure.mjs` — PASS: all CI structure fixtures, including the real 22-gate workflow.
- `npm run verify:ci` — BLOCKED at preflight before typecheck/gates: this isolated worktree has no local `node_modules` directory and lacks all four pinned MiniLM revision-cache artifacts plus `packages/inference/assets/minilm/model_quantized.onnx` and `tokenizer.full.json`. Required bootstrap is `npm ci` then network-capable `npm run fetch:embedder`; no dependency/network mutation was authorized for this pure task. The focused/typecheck/schema/migration/store gates above passed independently.

## Known debt/blockers

- The contract’s `protection.mode` is truthfully `plaintext`; it is an inner envelope and not suitable as the default exported health file until wrapped by reviewed authenticated encryption.
- The database adapter that maps all 86 tables and future post-064 data sets does not exist.
- A globally atomic registry-plus-multiple-database swap is not provided by a single rename; integration needs a durable journal and recovery set.
- `@op-engineering/op-sqlite` exposes no dedicated backup method in the installed TypeScript surface inspected here. `VACUUM INTO` or a native `sqlite3_backup` bridge needs device verification.
- OS save/open and share completion semantics remain unverified.

## Francis checklist

- [ ] Ratify replace-only v1 and all-athletes default.
- [ ] Ratify encryption/recovery choices and password-loss copy.
- [ ] Assign native picker/share/snapshot/restore implementation and security review.
- [ ] Keep migration 064 with the integration owner.
- [ ] Require post-064 round trip before any release-ready backup claim.

## MASTER LEDGER ENTRY

```text
INPUT STATE
- Frozen base 87624d9; live migration files through 063; no restorable backup/restore found.
- 86 final durable SQLite tables plus coach_athletes.json outside SQLite.

CONSTRAINTS ENFORCED
- Zero-cloud, deterministic pure TypeScript, strict typing, append-only migrations, 450,000,000 B preferred target / 536,870,912 B hard-ceiling awareness.
- No migration/schema/store/UI/native/dependency/package-lock changes; migration 064 untouched.
- Restorable backup kept distinct from AK_HISTORY_V1 import and optional CSV history export.

ACTIONS
- Added canonical v1 envelope/parser/validator, SHA-256 provider contract, replace-only compatibility decision, rollback state model, fixtures, focused gate, inventory, and decision docket.
- Explicitly recorded native, encryption, atomicity, storage, integration, and post-064 blockers.

RAM / LATENCY / CONSTRAINT DELTAS
- Runtime delta: none; foundation is not imported by the app.
- Package/dependency delta: none. Verification build artifacts only under ignored test output.
- Peak mobile RAM/latency: unmeasured and unchanged; future implementation must stream/chunk, target 450,000,000 B, and remain below the 536,870,912 B hard ceiling before release.
- Schema/migration delta: none.
```

WO-03 BACKUP FOUNDATION COMPLETE — INTEGRATION/UI/RESTORE STILL GATED
