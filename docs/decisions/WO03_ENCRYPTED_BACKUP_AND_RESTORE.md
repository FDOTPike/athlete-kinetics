# WO-03B encrypted backup and replace-only restore decision

Date: 2026-09-13; recovery-retention remediation 2026-09-14; PR #18 review remediation 2026-09-15

Status: implementation candidate after the 2026-09-15 PR #18 review remediation; a fresh independent audit of that remediation is required; exact-tip Android emulator qualification is reported in the remediation handback and pull request, not in this decision; physical-device and iOS behavior untested; C6 not claimed

Frozen implementation base: `2d4325f59452ec875142d696a15b97cd97d76900`

Recovery-retention remediation base: `b92b382c488806bf41951545a894659d714d0289`

PR #18 review remediation base: `9d8407f5496b55d24fe1717f4c2ad29493ec0693`

## Decision

Use established platform and library facilities to produce a password-protected, authenticated, all-athlete portable backup. Restore is replace-only and is guarded by a durable, operation-bound replacement journal. A portable restore is additionally guarded by a newly verified encrypted recovery backup of the data it replaces; a restore from the retained previous-data recovery uses that recovery as the undo point and creates no other. There is no plaintext fallback, logical merge restore, cloud runtime, or CSV restore path.

The portable format is `pikeMethods-encrypted-backup`, version 1. Its encrypted payload contains `coach_athletes.json` semantics and a consistent physical SQLite snapshot for every athlete named by that registry. Container format/version, exact KDF parameters, salt, cipher name, nonce, and tag length are canonicalized as AES-GCM additional authenticated data. Only an authenticated archive can produce a restore preview.

## Selected facilities

### Encryption and authentication

- `@noble/ciphers` supplies AES-256-GCM with a 96-bit nonce and 128-bit authentication tag. A new nonce and salt are drawn for every seal operation.
- Entropy comes directly from the native `RNGetRandomValues` TurboModule installed by `react-native-get-random-values`. The adapter deliberately does not call the package's JavaScript compatibility shim, so its remote-debug `Math.random` fallback cannot be used. Missing or malformed native entropy fails backup creation.
- `@noble/hashes` supplies SHA-256 for snapshot and file verification.
- Noble's UTF-8 encoder is used for sealing. React Native's Hermes runtime does not provide the `TextDecoder` global expected by Noble's decoder, so authenticated plaintext is decoded by a bounded 8,192-code-unit mobile adapter that strictly rejects truncated, overlong, surrogate, and out-of-range UTF-8 sequences.
- Base64 uses a bounded linear grammar/decoder. It calculates and rejects decoded size before allocation or full scanning, accepts ASCII alphabet characters only, and permits padding only in the final quantum. It does not use a backtracking regular expression.
- Password bytes, derived keys, and decrypted container plaintext are zeroed on reachable exit paths. Passwords, keys, health-support prose, and decrypted archive data are not logged or intentionally persisted.

This composes established primitives; it does not introduce a custom cipher, authentication construction, or random-number generator.

### Password KDF

`@noble/hashes` supplies RFC 7914 scrypt with a fixed, authenticated profile: `N=65536`, `r=8`, `p=1`, 32-byte output, a fresh 16-byte salt, and an 80 MiB implementation memory ceiling. Imported KDF names and parameters must match exactly and are checked before invoking scrypt. Password input is capped at 1,024 characters. The UI requires at least 12 characters and makes clear that the password cannot be recovered.

### OS-directed document operations

`@react-native-documents/picker` supplies `saveDocuments` for OS-directed create/share storage and `pick` plus `keepLocalCopy` for OS-directed open/import. A picker handoff alone is not recorded as success: `backup_preferences.json` advances only when the completed save result has no error and returns a usable URI. Cancellation is non-destructive and does not update the timestamp.

The picker result itself must report a known, finite size no greater than 16 MiB before the native private-copy request. The copied file is stat-checked again before any whole-file read or KDF work. Unsupported, newer, malformed, truncated, or tampered containers fail before preview or replacement.

### SQLite snapshots and schema proof

`@op-engineering/op-sqlite` opens existing databases and SQLite `VACUUM INTO` creates transactionally consistent snapshots in app-private cache storage. Each output receives `PRAGMA quick_check`, SHA-256, header, byte-length, `user_version`, and real schema-contract verification before it is encoded. Source existence is checked immediately before open to prevent silent creation.

The schema contract is derived from the real 001–064 migration chain: `user_version=63`, migration slot 64, 104 tables, and 174 table/index/trigger objects. The fingerprint covers normalized ordered `sqlite_master` definitions and every `table_info` column record. This rejects a structurally fake database that merely reports the right table count, and includes representative Migration 064 activity and health-support rows. Migration 064 itself is unchanged.

The implementation caps aggregate decoded database bytes at 8 MiB. It first preflights live file sizes, then checks a running total of actual `VACUUM INTO` output sizes before reading each snapshot, covering WAL-backed growth. The portable JSON text is capped at 16 MiB. Larger streaming backups are deferred.

The host contract proves the concurrent-WAL snapshot claim directly: a worker thread commits whole 20-row transactions while `VACUUM INTO` runs. It signals readiness only after its first transaction has committed, reports any failure other than a transient busy lock, and is terminated on every exit path. The snapshot must pass `quick_check`, contain every baseline row, contain at least one concurrent transaction, and contain only whole concurrent transactions.

### Recovery journal and boot exclusion

`react-native-blob-util` supplies app-private file stat/copy/move/hash operations. A resolved native call is never treated as success on its own; each is followed by a postcondition check. After a move, the source must be absent and the destination present. After a copy, the destination must exist and its SHA-256 must equal the source. Storage preflight requires three times the replacement bytes with a 32 MiB minimum; unknown or insufficient capacity fails closed.

The restore journal is written and revalidated before plaintext staging or rollback copies. It accepts only exact normalized children of the trusted document/database roots, exact target database basenames, unique and disjoint paths, registry-entry consistency, and staged/rollback names derived from the 128-bit operation id. Rollback copies must satisfy the copy postcondition before any target is replaced. Incoming staged databases are authenticated, schema-checked, and hash-verified, then installed by same-filesystem moves under the move postcondition; each installed database is hash-verified against the authenticated backup and the installed registry is re-validated. The durable journal and operation-bound markers govern interruption recovery.

The journal and operation-id-bound applying, committed, and rollback-complete markers are published by a verified same-directory temporary write followed by a postcondition-verified rename. Orphan temporary publications and standalone stale markers are swept. Cleanup removes markers first and the journal last, so the journal remains the durable recovery declaration through cleanup. These markers make cold-start behavior deterministic:

- a matching committed marker permits cleanup;
- an applying marker without a matching commit requires rollback;
- a matching rollback-complete marker permits cleanup after verified rollback;
- stale, mismatched, missing, malformed, or unreadable state preserves recovery material and blocks athlete-data boot.

The app-wide maintenance lock spans registry access and every athlete snapshot or replacement. Registry writes require both a free lock and explicit athlete-data boot authorization. A recovery-required exception immediately revokes boot, latches the backup UI unsafe, and blocks create/open/review/confirm/cancel retries until startup initialization resolves the journal. The central store boot routine also checks recovery authorization, so screens cannot bypass a failed startup recovery or reopen SQLite while maintenance is held. Plaintext snapshots are deleted and their absence confirmed immediately after sealing, before the OS save dialog or retained encrypted recovery write.

#### Mutation leases (PR #18 review)

A momentary lock check is not sufficient: an operation can pass it, pause at an `await`, and then write or reopen athlete data after a snapshot has begun. Every normal athlete-data operation that awaits I/O therefore holds a mutation lease for its whole duration:

- the lease is claimed synchronously, before the operation's first `await`, and released only when the operation settles;
- it covers the registry write itself, and each registry action from its registry read through its write: athlete switch, athlete creation, rename, deletion (including the database file removal), the advanced-tools setting, and the onboarding athlete name;
- store boot holds a lease from its registry read through database open and hydration, and it rechecks athlete-data boot authorization after the registry read, before opening any database;
- no lease is granted while maintenance is held or athlete-data boot has not been authorized, and the refused action reports that athlete data is locked;
- backup, restore, and startup recovery acquire the maintenance lock, which is refused while any lease is still active.

Synchronous SQLite writes need no lease: they cannot interleave with an awaiting backup, and every maintenance path closes the store's database handle in the same synchronous step that takes the lock.

Before recovery and boot, startup inspects only the app cache directory. It removes exactly two generated name patterns: abandoned plaintext snapshot directories `ak-backup-[a-f0-9]{32}` and encrypted portable files `ak-portable-[a-f0-9]{32}.pmbak`. Each removal is confirmed. If a removal cannot be confirmed, the failure is reported as a temporary-file cleanup failure and athlete data stays closed. Unrelated `.pmbak` files, lookalike names, and other cache files are retained. Restore-metadata temporary files are swept by exact name. Recovery rotation files and preserved recovery candidates are never swept by name.

If startup recovery fails, the gate shows "RECOVERY NEEDED" with a single "Retry protected recovery" action. It reruns the same startup recovery authority, allows one attempt at a time, and authorizes athlete data and boots the store only if that recovery succeeds. It never bypasses `startupSafe`.

Every backup and restore action (create backup, choose portable restore, review previous recovery, confirm restore) claims one in-flight state synchronously, before its first await. A second invocation while one is in flight returns without starting a KDF, picker, or replacement and without changing the first operation's status, message, or disabled controls. Cancellation is ignored while an action is in flight.

### Crash-safe recovery publication

A portable restore publishes the recovery of the data it will replace through three exact same-directory names:

- `pikeMethods-recovery-current.pmbak`, the retained recovery;
- `pikeMethods-recovery-current.pmbak.new`, the fresh recovery;
- `pikeMethods-recovery-current.pmbak.previous`, the older retained recovery while promotion is in flight.

The sequence is fixed:

1. Write the fresh file and authenticate it with the restore password.
2. Rename the retained recovery to the previous name.
3. Rename the fresh file to the retained name and authenticate it again at that durable path.
4. Only then remove the previous file.
5. Then remove any preserved recovery candidates (see below).

Replacement starts only after those removals are confirmed. Publication never deletes the retained recovery in place, and no step relies on a move replacing an existing destination.

Invariant: if a retained recovery existed before publication, every process-death boundary leaves at least one recoverable copy of either the older retained archive or the newly verified current-data archive. The older archive survives until the new one has been authenticated at its durable path. Because replacement starts only after the previous file is removed, a surviving previous file proves that replacement did not begin, and that file is the only copy of its content.

Startup reconciles an interrupted publication deterministically, before restore-journal recovery. No password is available at startup, so no file name is treated as proof of validity, and no structural check is treated as proof of authenticity. A file is well-formed only if it is a complete, supported container envelope whose ciphertext decodes as strict Base64 (alphabet, whole quanta, final-quantum padding only) to at least 700 decoded ciphertext bytes. The bound is stated in decoded ciphertext bytes: AES-GCM ciphertext is the archive plaintext plus the 16-byte tag. The plaintext is JSON that carries every athlete database as Base64 text, and every archive carries at least one database. One minimum 512-byte SQLite page is 684 Base64 characters, each one plaintext byte, so the plaintext is at least 684 bytes and the ciphertext at least 684 + 16 = 700 bytes.

1. A well-formed previous file is selected and restored to the retained name.
2. Otherwise an existing retained file stays selected.
3. Otherwise a well-formed fresh file is promoted, so a sole recovery candidate is never discarded by name.
4. A well-formed file that is not selected is preserved, never deleted: it is moved to `pikeMethods-recovery-current.pmbak.alternate-<sha256>`, named by the SHA-256 of its bytes. A byte-identical copy already preserved under that name makes the source redundant.
5. Only a rotation file that is not well-formed is removed, by exact name.

Re-running reconciliation resolves every intermediate state the same way. Rotation files found beside a restore journal are outside the protocol: every file is preserved and athlete-data boot stays closed. An in-process publication failure restores the exact pre-publication recovery state until the older recovery has been superseded; if that cannot be confirmed, athlete data stays closed until startup reconciliation.

Recovery selection policy. Because startup cannot establish authenticity, "Review previous data recovery" tries the retained recovery first and then each preserved candidate in a fixed order, and uses the first one the password authenticates. Reviewing and confirming never writes, moves, or removes any recovery file. A wrong password tries every candidate and changes nothing. Preserved candidates are superseded only by the next portable restore, after its new recovery has been authenticated at the durable path and before replacement begins.

## Restore contract

The authenticated preview shows backup time, athlete names/count, and size. It contains no unauthenticated fields or private health-support prose. Confirmation replaces the complete local registry/database set; duplicate athlete/database identities, missing schema adapters, unsupported versions, low storage, invalid journal paths, and any verification failure stop the operation. In-process failure attempts deterministic rollback, and unresolved recovery blocks subsequent boot.

Exact equality for athlete durable data is defined as the restored registry plus every referenced physical database snapshot. Registry validation compares strict parsed shapes and values independent of object-key and athlete-array insertion order; it does not route incoming authenticated data through the forgiving startup parser or silently sanitize it. `backup_preferences.json` and private recovery artifacts are operational device state and are not portable athlete data.

Every preview records its provenance at the moment the archive is authenticated: a portable backup chosen through the OS picker, or the retained previous-data recovery. Confirmation acts on that recorded source. Provenance is never inferred from archive contents or backup IDs. The pending restore is one bounded record of the authenticated archive and its source, cleared on success, cancellation, and every error.

The retained encrypted `pikeMethods-recovery-current.pmbak` is usable through a bounded user-facing “Review previous data recovery” action. It requires the password supplied for the previous restore, produces the same authenticated replace-only preview, and runs the same confirmed replace transaction under the durable journal and rollback files. It follows the recovery selection policy above. The UI does not reveal its internal path or private metadata. Absence, corruption, and a wrong password fail closed.

A previous-recovery restore does not create another undo point:

- confirming it does not create or promote a replacement recovery file;
- the retained recovery is not overwritten or superseded before replacement;
- its encrypted bytes stay unchanged through ordinary failures and process death;
- the same file is kept after a successful replacement.

Its preview states: “This replaces current data with the previous recovery. It will not create another undo point.”

A portable restore may supersede the older retained recovery only after the new current-data recovery has been sealed, authenticated, and durably retained, as described under crash-safe recovery publication.

### Dispositions

- Interrupted cleanup may roll back a restore that had not yet reached externally reported success. This is accepted transactional behavior; no product change.
- Storage providers without reliable size metadata remain rejected fail-closed before any native copy.
- Emulator KDF latency is a performance observation, not authority to weaken cryptography. The scrypt profile is unchanged.
- Recovery publication and replacement confirm renames and read-backs but do not call fsync. The guarantees above cover process death; power-loss durability is untested.

## Verification obligations and deferred work

The candidate tests real-chain all-athlete activity/support round trips, byte-exact restored SQLite content, order-independent strict registry identity, concurrent WAL writes, running snapshot caps, wrong passwords, tampering, truncation, hostile KDF values, duplicate identities, unsupported formats, low/unknown storage, failed copies, interrupted replacement, stale markers, failed rollback, recovery-action preview/replace, atomic metadata publication, partial cleanup, hostile paths, abandoned cache cleanup, and fail-closed boot integration. A mobile regression imports the production provider and opens authenticated plaintext with `TextDecoder` absent, exercises astral Unicode, and rejects non-canonical or malformed UTF-8. The host contract also performs a real 3 MiB AES-GCM seal/open round trip through the bounded Base64 decoder.

The recovery-retention remediation adds coverage for each of its rulings:

- Retained-recovery low-storage and staged-hash regressions, using a two-athlete retained recovery and three-athlete current data.
- A reconciliation table covering every retained/fresh/previous recovery-file combination, with an enumeration proving which combinations publication, abandonment, and reconciliation can produce.
- Process-death and failure injection at every publication write, move, verification, removal, and reconciliation boundary.
- Store-level process-death matrices for retained-recovery and portable confirmations.
- Concurrent-invocation tests for all four actions.
- Exact cache-cleanup matching and startup tests.

The PR #18 review remediation adds, each observed failing against the prior code first:

- Real-store lease tests for every registry action and for boot: maintenance cannot start while a registry read, registry write, or boot is paused, and a boot whose authorization is withdrawn during its registry read opens no database.
- Strict container cases (`====`, non-alphabet, interior padding, below the minimum sealed size) and the exact minimum boundary.
- The reconciliation table extended with the preserved candidates for every combination, an assertion that no well-formed candidate is ever lost at any reconciliation death, and supersession of preserved candidates only after durable publication.
- Store tests for preserved-candidate startup, review fallback to a preserved candidate without changing any recovery file, a wrong password across every candidate, and supersession before replacement.
- A gate test for the bounded "Retry protected recovery" action.
- A concurrent-WAL contract that fails when the concurrent writer commits nothing, which the prior contract did not.

Android OS picker create/open must be smoke-tested in the QA candidate when a device or emulator is available. iOS remains explicitly untested. Physical-device behavior is untested, and C6 physical memory qualification is not claimed. Streaming backups above the v1 caps, merge restore, cloud backup, medical interpretation, recommendation changes, monitoring, movement animation, and CSV/history export are outside this decision.
