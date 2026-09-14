# WO-03B PR #18 Review Remediation Handover

This is implementation work, not independent approval. The reviewer's verdict on PR #18 was REQUEST CHANGES; a fresh independent audit of this remediation is required before any merge decision. Earlier WO-03B handovers are preserved unchanged.

## 1. Freeze and Scope

- Worktree: the `ac-wo03-product-backup` Codex worktree of this repository.
- Branch: `codex/ac-wo03-product-backup`, level with `origin/codex/ac-wo03-product-backup` at the start.
- Starting commit: `9d8407f5496b55d24fe1717f4c2ad29493ec0693`, tree `0b85ed491b309aa812ebfe5f73e3dbb41112e5fd` (the audited PR #18 head).
- Ledger: Entry 0131 records the verdict verbatim as the first repository write.
- Unchanged: Migration 064 and every migration, schema, the backup container version, AES-GCM and scrypt parameters, password rules, size ceilings, clinician policy, progression/programming logic, and the offline architecture. No cloud backup, merge restore, password recovery, CSV restore, live monitoring or runtime networking was added.

## 2. Findings and Remediation

### 2.1 [P1] Mutation leases held across awaited I/O

- `dataMaintenanceLock.ts` adds `tryAcquireDataMutationLease()`. A lease is claimed synchronously, before the operation's first await, and released when the operation settles. No lease is granted while maintenance is held or athlete-data boot is not authorized.
- `acquireDataMaintenanceLock` is refused while any lease is active, so backup, restore and startup recovery cannot start inside a pending mutation.
- `saveRegistry` holds a lease until its write settles.
- In `useStore.ts`, switch athlete, create athlete, rename, delete (including the database file removal), the advanced-tools setting and the onboarding athlete name each hold one lease from their registry read through their write. A refused action reports that athlete data is locked.
- Store boot holds a lease from its registry read through database open and hydration, and rechecks athlete-data boot authorization after `loadRegistry()`, before opening any database.
- Startup recovery (`useBackupStore.initialize`) now takes the maintenance lock too, because it can roll back the registry and databases.
- Synchronous SQLite writes need no lease: they cannot interleave with an awaiting backup, and each maintenance path closes the store handle in the same synchronous step that takes the lock.

### 2.2 [P1] Strict recovery candidates, preserved rather than deleted

- `isWellFormedBackupContainer` now decodes the ciphertext with the strict bounded Base64 decoder and requires at least `MIN_WELL_FORMED_CIPHERTEXT_BYTES` (700): the 16-byte GCM tag plus the Base64 text of one minimum 512-byte SQLite page. `====`, non-alphabet text, interior padding and short ciphertext are rejected.
- `reconcileRecoveryPublication` keeps the same selection order (previous, then final, then fresh), but a well-formed candidate that is not selected is moved to `pikeMethods-recovery-current.pmbak.alternate-<sha256>`, never deleted. A byte-identical preserved copy makes the source redundant. Only structurally malformed rotation files are removed.
- Selection policy: "Review previous data recovery" tries the selected recovery and then every preserved candidate in a fixed order, using the first one the password authenticates. Review and confirmation never change a recovery file.
- A portable restore removes preserved candidates only after its new recovery is authenticated at the durable path, together with the older retained recovery and before replacement.

### 2.3 [P2] Retry from a persistent startup recovery failure

- The "RECOVERY NEEDED" gate in `App.tsx` offers "Retry protected recovery". It reruns `bootAfterSafeRecovery` with the same initialization, allows one attempt at a time (a ref plus disabled state), and authorizes athlete data and boots the store only when recovery succeeds. It never bypasses `startupSafe`.

### 2.4 [P2] Concurrent-WAL evidence

- The worker in `verify_backup_contract.mjs` commits whole 20-row transactions, signals readiness only after its first commit, reports any error other than a transient busy lock, and is terminated in `finally` even if `VACUUM INTO` or an assertion fails.
- The snapshot must contain every baseline row, at least one concurrent transaction, and only whole transactions.

### 2.5 [P3] Test mock contract

- `NavigationShell.test.js` mocks `initialize` as resolving `true`, and a new test asserts that startup calls initialize once and boots once.

## 3. Evidence

Evidence files live in the ignored `scratch/wo03-integration/` directory of this worktree and are not tracked.

### 3.1 Failing first, against the unfixed code

- Lease: all 7 store-level cases in `BackupMutationLease.test.js` failed (maintenance could start inside a paused registry action or boot; a registry action ran while maintenance was held), and the new `saveRegistry` case failed (maintenance started during an in-flight write).
- Retry: both gate cases failed; no retry action existed.
- Strict container: `verify:backup` failed at the new assertions.
- Preserved candidates: 23 of 70 `BackupRecoveryPublication` tests failed, and all 4 new store-level tests failed.
- Concurrent WAL: a copy of the previous contract whose worker inserted nothing still printed `verify:backup PASS`, confirming the false green.
- NavigationShell: the new startup test fails with the old `undefined` mock (mutation N12 below).

### 3.2 After the remediation

- `npm run typecheck`: exit 0. `git diff --check`: clean.
- 14 suites, 171 tests passed: the nine named backup suites, BackupRecoveryIo, BackupMutationLease, BackupRecoveryRetryGate, NavigationShell and AthleteSwapProfileRender. `BackupRecoveryRetryGate` later gained a third test (below) and passes 3/3.
- `npm run verify:backup`: PASS, including the strict container cases and the new concurrent-WAL contract.
- `npm run verify:ci`, the exact-tip QA APK, `verify:qa-candidate` and the emulator journeys are bound to the final commit and reported in PROMPT_LEDGER Entry 0131, the pull request and the handback.

### 3.3 Mutation checks

Twelve mutations, each breaking one new protection, each file restored to its pre-mutation SHA-256, with the worktree fingerprint compared before and after:

| Mutation | Protection broken | Result |
|---|---|---|
| N01 | `saveRegistry` releases its lease before the write | detected |
| N02 | boot takes no lease | detected |
| N03 | boot skips the authorization recheck after `loadRegistry()` | detected |
| N04 | switch athlete takes no lease | detected |
| N05 | maintenance ignores active leases | detected by both runs |
| N06 | container check reverted to length-only | detected (`padding-only ciphertext`) |
| N07 | reconciliation deletes unselected well-formed candidates | detected by both runs |
| N08 | review uses the first candidate even when it fails authentication | detected |
| N09 | preserved candidates removed before the new recovery is durable | detected |
| N10 | retry in-flight ref removed | undetected in run 1; detected after the test fix |
| N11 | concurrent writer commits nothing | detected (`snapshot must contain the concurrent WAL commit`) |
| N12 | NavigationShell mock resolves `undefined` | detected |

N10 was not detected in the first run. Each `fireEvent.press` runs in its own `act`, so the disabled state re-rendered between two presses and hid the missing ref. A new test invokes the action twice inside one `act`, as two taps can on a device; with the ref removed it fails (re-run output `review_mutation_N10_rerun.log`).

## 4. Judgment Calls Flagged for Review

- Minimum sealed size is a structural bound derived from the archive format (one SQLite page), not a cryptographic claim.
- Preserved candidates are superseded by the next portable restore rather than kept indefinitely, matching the single-undo-point retention policy.
- A preserved-candidate removal that fails during publication aborts the restore before replacement, leaving the newly verified recovery retained and data unchanged.
- A preserved candidate whose content-addressed name already holds different bytes fails closed (unresolved). This needs a SHA-256 collision or external tampering; no protocol path produces it.
- Startup recovery now fails closed if a mutation lease is still active. No such lease can exist at startup or during a retry, because both run with athlete-data boot revoked.
- The retry gate offers only retry. It does not add a restore workflow to the gate.
- "Review previous data recovery" with a wrong password costs one scrypt run per candidate.

## 5. Not Verified

- iOS and physical-device behavior: untested.
- Power-loss durability (no fsync): untested.
- C6 physical memory qualification: not claimed.
- The historical WO-03B handovers still contain absolute workstation paths; the reviewer ruled this documentation-only and not a merge blocker, and they were left unchanged.
- Independent audit: required.

MERGE / RELEASE / C6: NOT PERFORMED.
