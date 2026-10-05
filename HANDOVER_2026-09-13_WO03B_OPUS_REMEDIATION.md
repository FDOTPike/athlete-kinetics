# WO-03B Opus Audit Remediation Handover

## 1. Freeze and Scope

- Worktree: `C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\ac-wo03-product-backup`
- Branch: `codex/ac-wo03-product-backup`
- Starting commit: `8cabb765e67bb9c34f2b392b76f09de9379573d9`
- Starting tree: `48a90342989ba5c73a56aee7270ff32737949c25`
- Migration 064 remains byte-identical to the starting commit.
- No network, cloud, medical, progression, migration, schema, merge, tag, release, or C6 change is included.

## 2. Remediation Disposition

### 2.1 Registry Authentication

- Staged registries are compared with the authenticated registry by exact parsed values and exact object keys.
- Registry and athlete object key insertion order, and athlete array order, are non-semantic.
- Unknown, missing, or sanitized values are rejected rather than normalized.
- A real store test exercises `chooseRestore` through `confirmRestore`, including exact database hashes, registry identities, obsolete database removal, retained recovery backup, and cleanup.

### 2.2 Bounded Base64 and Hermes UTF-8

- The backup decoder now uses a bounded linear grammar rather than a backtracking regular expression.
- It enforces ASCII alphabet, four-character quanta, final-quantum padding, and decoded-size bounds before allocating the decoded buffer.
- Tests include large valid and malformed inputs, padding cases, over-cap input, and a real three-MiB AES-GCM seal/open round trip.
- The Hermes regression suite imports the production `mobileBackupCrypto.utf8Decode` provider with global `TextDecoder` absent and exercises malformed four-byte, overlong, and truncated sequences.

### 2.3 Restore Recovery Safety

- A recovery-required error immediately revokes athlete-data boot and latches `startupSafe` false.
- Backup create, restore selection, confirmation, cancellation, registry writes, and previous-recovery review all fail closed while boot is revoked or a restore journal remains.
- Only a successful `initialize` recovery may return the store to a safe state; athlete-data boot remains an explicit authorization step.
- Tests inject replacement and rollback failures, prove retry actions make no database or registry changes, retain the journal/recovery copy, and prove healed initialization restores before authorization.

### 2.4 Crash-Safe Metadata

- Restore journal and operation-bound markers are published by verified same-directory temporary write and rename.
- Initialization narrowly sweeps operation metadata temporaries, stale standalone markers, and the exact recovery `.new` file.
- Cleanup removes terminal markers before the applying marker, recovery material next, and the journal last.
- Failure injection covers every unlink boundary for both committed and rolled-back terminal states. No tested boundary becomes `preserve_invalid`; rollback retains the recovery copy.
- Preparation torn writes and stale legacy-marker/new-journal combinations fail closed without deleting athlete data.

### 2.5 Native Picker and Plaintext Lifetime

- Unknown or over-limit picker sizes are rejected before native copying; copied files are checked again afterward.
- Plaintext database and registry snapshots are deleted and verified absent after sealing and before the operating-system save dialog opens.
- Failure to confirm cleanup aborts the operation.

### 2.6 Previous Data Recovery

- A bounded user-facing action reviews the retained encrypted recovery backup using the password supplied for the previous restore.
- It uses the same replace-only preview and confirmation path as ordinary restore.
- The UI does not expose an internal path or private metadata.
- Missing, corrupt, or wrong-password cases fail closed with generic athlete-facing copy.
- The retained backup is not deleted automatically unless superseded by a newly verified recovery backup.

## 3. Verification at the Uncommitted Freeze

- Independent narrow code review: `APPROVE` after one cleanup-order correction and expanded terminal-state failure injection.
- `npm run typecheck`: PASS.
- `npm run verify:backup`: PASS.
- Focused backup/recovery set: 7 suites, 32 tests, PASS.
- Cleanup/atomic-publication subset: 2 suites, 14 tests, PASS.
- `npm run verify:ci`: PASS, including 40 mobile component suites / 574 tests and 675 / 675 store checks.
- `git diff --check`: PASS.
- Migration 064 blob identity: PASS.

## 4. Remaining Qualification

- An exact-tip QA APK build and `verify:qa-candidate` remain required after commit.
- Disposable Android-emulator journeys remain required for small confirmed replacement, retained-recovery review, and a greater-than-three-MiB backup open/preview.
- iOS behavior is not evaluated by this work order.
- Push is permitted only after the exact-tip build and emulator qualification pass. Merge, tag, release, and C6 remain unauthorized.
