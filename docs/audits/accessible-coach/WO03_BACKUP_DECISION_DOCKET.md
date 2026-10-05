# WO-03 backup decision docket

Status: core contract implemented and tested; capture, UI, encryption wrapper, OS file flow, and database restore remain gated.

## Recommendation

Use one versioned, canonical inner backup envelope for data identity and integrity. Restore uses **replace**, never silent merge. Before applying, create a verified recovery copy. Apply to staged database files, validate, then swap; preserve the recovery set until the app reopens successfully. Keep CSV history export separate and non-restorable.

The new pure TypeScript contract is intentionally below the native/database boundary. It does not claim that a backup file can yet be created on a phone or restored.

## Canonical format v1

The inner JSON envelope uses:

- `format`: exact discriminator `pikeMethods-backup`.
- `formatVersion`: integer `1`.
- `manifest.backupId`: caller-supplied non-empty identifier. The pure contract reads no clock or RNG.
- `manifest.createdAt`: caller-supplied UTC ISO timestamp.
- `manifest.sourceAppVersion`: source app build/version identity.
- `manifest.sourceSchemaVersion`: SQLite `PRAGMA user_version`. At slot 063 this is 62 because 004 is not a migration.
- `manifest.sourceMigrationSlot`: highest numbered bundled migration, currently 63. This prevents confusing filename slot with chain index.
- `manifest.scope`: `single-athlete` or `all-athletes`.
- `manifest.restorePolicy`: fixed to `replace`.
- `manifest.protection.mode`: fixed to `plaintext` for this inner envelope. This is a truthful marker, not an assertion that exported health data is adequately protected.
- `manifest.dataSetCounts`: sorted data-set names and row counts for preview/cross-check.
- `manifest.integrityChecksum`: `SHA-256`, canonicalization/scope ids, and lower-case digest over canonical manifest metadata plus payload, excluding only the digest field itself. This detects accidental corruption of the schema/version/scope/count/protection metadata and payload. Because the digest is unkeyed, anyone who alters a backup can recompute it, so it neither detects deliberate alteration nor establishes authenticity.
- `payload.dataSets`: extensible named logical data sets. Each declares identity fields and JSON rows. Data sets, identity fields, object keys, and row identities serialize deterministically.

Canonicalization is the project-defined `ak-canonical-json-v1`: lexicographically sorted object keys, significant array order, JSON number rendering, and rejection of non-finite numbers. It is not claimed to implement an external canonical-JSON standard.

The SHA-256 implementation is injected. Tests use Node’s established crypto implementation; mobile integration must supply an established native crypto provider. The contract does not ship a home-grown cryptographic primitive. SHA-256 here detects accidental corruption only. Because it is unkeyed it provides no tamper resistance, authenticity, or encryption; only the proposed authenticated-encryption wrapper can provide those properties.

## Extensibility and compatibility

- New data classes may be added as new named data sets without changing format v1 when existing semantics remain intact.
- A breaking representation or checksum/canonicalization change requires a new `formatVersion` and a dedicated parser/adapter.
- The v1 parser rejects unknown format discriminators, older/unknown versions, newer versions, unknown structural fields, malformed JSON, noncanonical bytes, duplicate data-set names, duplicate row identities, mismatched counts, and checksum mismatch.
- Restore separately checks database compatibility. A source `user_version` newer than the reader is rejected before mutation. An equal or older version is accepted only when that exact source version has a registered and tested restore adapter; “older” does not imply compatible.
- Post-064: register only after representative fixtures include every WO-05/WO-06 field and pass a fresh-install round trip.

## Replace versus merge

Recommend **replace** for v1.

Routine/program/session graphs use local integer identifiers and cross-table provenance. Multi-athlete registry/database relationships add another identity layer. A generic merge can collide identifiers, duplicate sessions, detach sidecars, or combine incompatible program histories. There is no stable global-id and conflict-resolution contract today. The pure decision function rejects `merge` explicitly.

A later import/merge feature would need per-class stable IDs, source provenance, duplicate preview, conflict choices, and domain-specific reconciliation. It should be a separate work order and format capability.

## Snapshot, recovery copy, and atomicity boundary

Required capture sequence:

1. Quiesce app writes and close/flush any in-progress write transaction.
2. Produce a consistent snapshot for each athlete database using SQLite’s established online backup API (`sqlite3_backup`) or a verified `VACUUM INTO` path into app-private temporary storage. The installed `@op-engineering/op-sqlite` TypeScript surface inspected here exposes no dedicated backup method; current-repository support is unverified.
3. Snapshot `coach_athletes.json` and all referenced athlete databases under one frozen registry view.
4. Build/checksum the envelope (or stream into the eventual encrypted container), validate it locally, then resume writes.
5. Let the user choose a destination. Mark “backup file created” only after the app has completely written and closed the destination. A share-sheet callback does not prove that another app retained the file, so it must not be presented as “stored safely off this phone.”

Required restore sequence:

1. Read/decrypt to app-private staging; parse and validate format, compatibility, checksum, identifiers, counts, and available storage before current data changes.
2. Show preview: backup time, source version, athlete count/scope, data-set counts, and explicit “replace current data” language.
3. Create and validate an app-private recovery copy of current registry plus every affected database.
4. Restore into new temporary database files, never into the live file. Run migrations/registered adapter, `PRAGMA integrity_check`, `PRAGMA foreign_key_check`, and application invariants.
5. Close live handles and swap staged files into place. A single filesystem rename can be atomic; a registry plus multiple database files cannot be assumed globally atomic. Use a durable restore journal and recovery set so startup can finish the swap or roll back the whole set.
6. Reopen and validate before deleting the recovery set.

The pure restore state machine enforces validation → confirmed recovery copy → begin replace → commit, or failure/cancel/low-storage during apply → rollback required. It does not perform any file or SQLite operation.

## Failure behavior

- Invalid, unknown, tampered, duplicate, noncanonical, or truncated input: reject during staging; preserve current data; offer a plain-language error and reselect action.
- Newer format or database schema: reject before recovery/apply; tell the user to update the app. Never guess or downgrade.
- Older schema with no registered adapter: reject safely; do not claim the backup is corrupt.
- Cancel before apply: discard staging; current data unchanged.
- Cancel after apply begins: treat as failure requiring rollback; do not abandon a partial swap.
- Low storage before apply: block before recovery/apply and report required free space. Budget for encrypted input, decrypted staging, recovery copies, new databases, journals/WAL, and safety margin.
- Low storage or IO failure during apply: enter rollback-required; retain recovery data and restore the previous set on the next startup if immediate rollback cannot complete.
- Unexpected app termination: durable restore journal determines whether to complete an already committed swap or restore recovery copies. Never infer success from absence of an error.

## Health-information encryption

The v1 inner envelope is plaintext by design and says so. It must not be exposed as the default shareable health backup without a reviewed protection layer.

Recommended two-purpose design:

- Portable transfer: password-based authenticated encryption using the established libsodium facility (`crypto_pwhash` with Argon2id and `crypto_aead_xchacha20poly1305_ietf`) through a maintained, pinned, reviewed native binding or a small audited native bridge. Store algorithm/version, KDF parameters, random salt, nonce, and ciphertext authentication data in a minimal outer header. Do not store the password or derived key. A forgotten password means the portable backup cannot be recovered; the UI must say this before creation and ask for confirmation.
- On-device recovery copy: device-bound key protected by iOS Keychain/CryptoKit or Android Keystore/AES-GCM. This protects staging/recovery at rest but cannot be used for phone-to-phone recovery after device/key loss.

Do not substitute an unkeyed checksum for encryption, do not invent custom ciphers/KDFs, and do not imply that choosing iCloud Drive, Google Drive, email, or another provider guarantees end-to-end encryption. Package/native selection and threat-model review remain prerequisites; no crypto dependency was added today.

## Missing platform facilities

- Save/open document: iOS `UIDocumentPickerViewController`; Android Storage Access Framework `ACTION_CREATE_DOCUMENT` and `ACTION_OPEN_DOCUMENT`. No bridge exists in this repository.
- Share: iOS `UIActivityViewController`; Android `ACTION_SEND`. React Native `Share` can share diagnostic text today, but binary/file URI handling and completion semantics are not implemented or verified for backup.
- Consistent database capture: SQLite online backup API or verified `VACUUM INTO`; not wired or device-tested.
- Multi-file atomic restore: app-private staging, close/reopen coordination, durable swap journal, recovery-copy lifecycle, and startup recovery; absent.
- Cryptographic wrapper and secure password entry/key lifecycle; absent.
- Capacity preflight that accounts for staging + recovery + WAL/safety margin; absent.

Recommended facility is a narrowly scoped first-party native bridge over the named OS document/share APIs plus SQLite’s backup facility, keeping runtime offline. If a third-party React Native document/crypto binding is considered, pin it and review maintenance, URI permissions, streaming, platform parity, and native memory before adoption. No dependency should be selected solely because `react-native-blob-util` can read a known path.

## Verification completed for the foundation

- Deterministic serialization across input ordering using explicit code-unit comparison, with impossible calendar timestamps rejected.
- Representative profile/history/routine/preferences round trip with byte-identical reserialization.
- SHA-256 payload and compatibility-manifest tamper rejection; a compiled integrity-guard mutant is executed and killed by the tamper expectation while production source/build bytes remain identical.
- Unknown/newer format, unknown format discriminator, truncation, counts, and duplicate identities.
- Replace accepted only with recovery-copy requirement; merge rejected.
- Newer database schema and missing adapter rejected.
- Cancel, pre-apply low storage, apply-time low storage, rollback, and invalid transition model.

Not verified: extraction from real SQLite, safe consistent mobile snapshot, encryption, OS picker/share, fresh-install phone transfer, database swap/rollback, low-storage device behavior, or WO-05/WO-06 fields.
