# WO-03B Recovery-Retention Remediation Handover

This is implementation work, not independent approval. An independent audit is required before any push, PR, merge or release decision. The historical handover `HANDOVER_2026-09-13_WO03B_OPUS_REMEDIATION.md` is preserved unchanged.

## 1. Freeze and Scope

- Worktree: `C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\ac-wo03-product-backup`
- Branch: `codex/ac-wo03-product-backup`, upstream `origin/codex/ac-wo03-product-backup`, 0 behind / 0 ahead at start.
- Starting commit: `b92b382c488806bf41951545a894659d714d0289`
- Starting tree: `8a57f3186e960201c344d8b0ab5136fec5329afc`
- Migration 064 blob `69090f214516fe2b3d0e31c082f7969b8889dc86` is unchanged, and the schema directory has no diff.
- No schema, migration, progression, programming, clinician policy, encryption format, scrypt parameter, size limit or network architecture change.
- No push, PR, merge, rebase, tag, release, production signing, master/main change or C6 claim.

Evidence files named below live in the ignored `scratch/wo03b/` directory of this worktree. They are not tracked.

## 2. Reproduction Before Production Changes

The W1 P1 was reproduced against the unmodified store before any production file changed. The test-only reproduction diff is `scratch/wo03b/01_w1_reproduction_tests.patch` (SHA-256 `5a5023825d632e01f66c269a437867731b44e9964ada7c78cbba0a025b36abf2`). Its output is `scratch/wo03b/01_w1_reproduction_pre_fix.txt`: 5 failed and 10 passed. The 10 passes were the existing store tests.

The fixtures were distinct: retained recovery A with two athletes (Recovery A1, Recovery A2) and current data B with three athletes (Current B1, Current B2, Current B3).

- **Low storage at replacement:** current data B stayed byte-identical. The retained recovery's SHA-256 changed, and the file now decrypted to Current B1, B2 and B3, so recovery A was destroyed.
- **Staged database hash mismatch:** same result. B was unchanged; the retained recovery was replaced by a recovery of B.
- **Successful confirmation:** it silently replaced recovery A with a new recovery of B, an automatic "redo" point.
- **Blocked confirmation:** it left the pending archive set. A later confirmation used that stale archive for a full replacement. Its file-operation log also showed the retained recovery being unlinked before the `.new` file was moved onto it.

## 3. Remediation

### 3.1 W1: Source-Aware Retained Recovery

- The untyped global `pendingArchive` is replaced by one bounded pending-restore record: the authenticated archive plus explicit provenance, `portable_backup` or `retained_recovery`.
- Provenance is recorded by the action that authenticated the archive and is carried on the preview. A copy of the recovery file chosen through the picker is still a portable backup.
- Confirming a retained recovery skips creation and promotion of any recovery file. It runs the normal journal-protected replacement and never touches the retained file.
- Pending state is cleared on success, cancellation and every error, including a confirmation blocked before it starts.
- The preview for a retained recovery shows the owner-ruled copy: "This replaces current data with the previous recovery. It will not create another undo point."

### 3.2 W2: Crash-Safe Recovery Publication

- The new pure module `apps/mobile/src/state/backupRecoveryPublication.ts` publishes a portable restore's recovery through three exact names: the retained name, `.new` and `.previous`. The sequence is: write fresh; authenticate it; rename retained to previous; rename fresh to retained; authenticate at the durable path; remove previous. Replacement starts only after that removal is confirmed.
- Startup reconciles interrupted publication before journal recovery, without a password:
  1. A well-formed previous file wins.
  2. Otherwise an existing retained file is kept.
  3. Otherwise a well-formed fresh file is promoted, so the sole candidate is never discarded by name.
  4. Malformed or redundant rotation files are removed by exact name.

  Rotation files beside a restore journal are preserved and athlete data stays closed.
- `isWellFormedBackupContainer` was added to the core-db contract. It is a password-free structural check that reuses the existing container parser; authenticity still requires `openBackup`.
- The exact-name metadata sweep no longer removes `.new` by name. The existing metadata test was updated to assert the new, intended behavior, and `.previous` was added.
- `actionCanProceed` treats a present `.new` or `.previous` file like a restore journal: athlete data stays closed until startup reconciliation.

### 3.3 W3: Synchronous Action Guard

- Create backup, choose portable restore, review previous recovery and confirm restore each claim one in-flight flag and set `status: working` synchronously before their first await. The flag is released in an outer `finally` that runs even if cleanup throws.
- A second call returns without starting a KDF, picker or replacement, and without changing status, message or disabled controls.
- Cancellation is ignored while an action is in flight.

### 3.4 W4: Encrypted Cache Cleanup

- Startup inspects only the cache directory and removes the exact names `ak-backup-[a-f0-9]{32}` and `ak-portable-[a-f0-9]{32}.pmbak`. The matcher is the exported core-db predicate `isAbandonedBackupCacheEntry`, and `cleanupAbandonedBackupDirectories` is renamed `cleanupAbandonedBackupCacheEntries`.
- Each removal is confirmed. An unconfirmed removal fails initialization with its own message, "Temporary backup files could not be removed safely. Athlete data stays closed.", instead of the generic restore-recovery message.

### 3.5 W5: Documentation

`docs/decisions/WO03_ENCRYPTED_BACKUP_AND_RESTORE.md` was corrected as follows:

- The stale "independent re-review approved" status is removed.
- The native move and copy claims are now postcondition-verified; the separate "must return success" claim for copies was also stale and is corrected.
- The source-aware retained-recovery ruling, the crash-safe publication invariant and the no-undo statement are documented.
- The three dispositions below are recorded.
- iOS, physical-device and C6 disclosures are explicit.

## 4. Judgment Calls Flagged for Review

- The retained-recovery confirmation shows the working message "Replacing all athlete data…". It is taken from the existing "Recovery backup verified. Replacing all athlete data…", because "Creating and verifying a recovery backup…" would be untrue for that source. The success message is unchanged.
- The cache-cleanup failure message is new copy. Keeping athlete data closed on an unconfirmed ciphertext removal matches the existing fail-closed cleanup behavior; a non-blocking warning is the alternative if preferred.
- Because the in-flight claim now precedes `actionCanProceed`, an unexpected filesystem exception inside that check latches the backup UI unsafe with the existing "Recovery cleanup could not be verified" message. Previously it rejected with the status left unchanged.
- Cancellation being ignored while an action is in flight is outside the W3 list. Without it, cancel could relabel an in-flight replacement as cancelled.
- At startup, a sole well-formed `.new` file is promoted rather than deleted. This also preserves the last candidate left by the prior build's delete-before-move window.
- All remediation store regressions live in the new `BackupRecoveryRetention.test.js` with its own harness. The existing `BackupRestoreStore.test.js` is unchanged and passes. The harness duplication is deliberate, to avoid restructuring a file outside the requested scope.

## 5. Dispositions

- Interrupted cleanup may roll back a restore that had not yet reached externally reported success. This is accepted transactional behavior; no product change.
- Providers without reliable size metadata remain rejected fail-closed.
- Emulator KDF latency is a performance observation, not authority to weaken cryptography. The scrypt profile is unchanged.

## 6. Repository Verification

| Check | Result | Evidence in `scratch/wo03b/` (SHA-256 prefix) |
|---|---|---|
| All component suites at the start commit | 40 suites, 577 tests passed | `00_baseline_focused_jest.txt` (`e3cd4300`) |
| W1 reproduction before production changes | 5 new tests failed on the defect; 10 existing tests passed | `01_w1_reproduction_pre_fix.txt` (`090b54b4`) |
| Focused backup suites after remediation | 10 suites, 125 tests passed | `06_focused_after_fix.txt` (`cfe94abc`) |
| Strengthened portable death matrix, unmutated | passed | `11_w2_strengthened_matrix_baseline.txt` (`0acb878b`) |
| Mutation run 1 | Invalid for 8 runs whose name filters selected no test; disclosed, not used as evidence | `09_mutation_run1-name-filter-defect.txt` (`2c3dd33c`) |
| Mutation run 2 | 17 of 17 mutations detected by every run; every target file restored to its pre-mutation SHA-256 | `12_mutation_run2.txt` (`7d53ac0b`), `mutations/summary.json` (`e8982c3c`) |
| `npm run verify:ci` | Exit 0: 23 gate headers including preflight and typecheck; components 42 suites, 665 tests; store SQL 675/675; pipeline 51 checks; `verify:backup` PASS. FAIL lines in the log are the qa-artifact gate's deliberate negative-fixture self-tests | `14_verify_ci.txt` (`bab4ed8a`) |
| `npm run typecheck` before commit | Exit 0 | `15_typecheck_precommit.txt` |
| `git diff --check` | Exit 0, including the four new files | command output |
| Migration 064 blob identity | `69090f214516fe2b3d0e31c082f7969b8889dc86` at HEAD and in the worktree; schema directory has no diff | command output |

Mutation run 1 had two defects, both corrected before run 2:

- Jest matches `-t` against the full "describe test" name. Eight filters omitted the describe text, so those runs skipped every test and proved nothing. The runner now rejects any run that selects no test, or a gate failure that is not an assertion.
- Under delete-before-move, the store-level portable death matrix still passed, because it accepted any undo point. It now requires recovery A to survive every death up to supersession, and requires supersession to precede the replacement journal.

In run 2, each mutation broke exactly one protection. The tests that failed under it are named in brackets:

- M01: a retained-recovery confirmation creates and promotes a recovery. [W1 regressions, retained death matrix]
- M02: previous-recovery review is labelled as a portable backup. [W1 regressions]
- M03: the pending restore survives a blocked confirmation. [pending-state test]
- M04: the in-process unsafe latch and its journal re-check are both removed. [unresolved-replacement test]
- M05: publication deletes the retained recovery before the move. [publication matrices; store rotation-order test and portable death matrix]
- M06: the older recovery is superseded before durable-path authentication. [publication matrices; store durable-authentication test]
- M07: startup discards a sole well-formed candidate. [reconciliation table; store startup test]
- M08: startup lets a fresh file displace the older recovery. [reconciliation table and death matrix]
- M09: the metadata sweep removes `.new` by name. [metadata sweep test]
- M10: all four in-flight claims move after the first await. [four double-invocation tests]
- M11: cancellation ignores the in-flight flag. [cancel-in-flight test]
- M12: the portable ciphertext pattern is dropped. [store cleanup test; `verify:backup`]
- M13: the portable pattern is broadened to `/\.pmbak$/`. [store cleanup test; `verify:backup`]
- M14: cache removal is unconfirmed. [unconfirmed-removal test]
- M15: the panel ignores provenance. [panel copy test]
- M16: a torn container counts as well-formed. [`verify:backup`]
- M17: startup initialization swallows an unresolved rollback. [unresolved-replacement test]

## 7. Exact-Tip Android Qualification

The QA APK, `verify:qa-candidate` output and emulator journeys are bound to the final committed HEAD. They are reported in the handback, outside tracked files, so no later tracked edit invalidates the candidate's provenance.

Emulator setup disclosure: the disposable AVD `wo03b_disposable_qa` (API 35 google_apis x86_64, no Play Store) was created with `avdmanager` from the locally installed system image. `avdmanager` printed "Fetch remote repository" while creating it. No package was downloaded or installed, and this is SDK tooling, not app runtime.

## 8. Not Verified

- iOS behavior: untested.
- Physical-device behavior: untested.
- C6 physical memory qualification: not claimed.
- Independent audit: required.
- Push, PR, merge, tag and release: not performed.
