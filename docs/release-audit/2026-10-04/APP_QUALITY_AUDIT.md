# App quality audit — 2026-10-04

**Verdict: neither current GitHub master nor the latest committed coaching feature branch is ready for an autonomous release claim.** Both reproduce two athlete-isolation defects and three other async correctness defects. The feature branch implements preparation, focus/goals, sport emphasis and backup features missing from master, but the local async repair has not shipped into either. A populated master-to-feature upgrade also produces a database rejected by the feature branch's exact backup-schema contract.

## Audited source and boundaries

Primary source: `C:/Users/fpike/.codex/worktrees/release-cloud-audit-2026-10-04/Athlete App`, clean HEAD `1da218d8b1886040dcf89e0d630581f7b33824d9` (current `origin/master`). The initial main checkout at `3358be64` was stale and is not the defect baseline.

Latest committed feature source: `C:/Users/fpike/.codex/worktrees/release-feature-audit-2026-10-04/Athlete App`, clean HEAD `12a1fb15aff5611b771348a53e2e04f4079e0e34`, branch `claude/coaching-wo4-coaching-content`. Coaching PRs 22–25 merged through side-branch bases rather than into master. This is a second actual GitHub baseline, not an inferred local overlay. Its source snapshots are in `app-quality-snapshot.json`.

Secondary comparison only: `C:/Users/fpike/.codex/worktrees/wo09-health-connect-ordering/Athlete App`, HEAD `01023cf04eeb85b73004b92de11f64efa7350a1c`, 22 tracked modifications and 6 untracked status entries. Its accepted overlay is not a clean commit. Passing checks on that overlay do not certify GitHub master.

Read-only audit of correctness, data ownership, migration/release-gate completeness and existing backup repairs. No candidate source changed, no dependency installation in the overlay, no generators, no publication, no disabled Athlete skills. Root owns the full current-master verification and platform/cloud reports. The owner's 4GB phone acceptance is deferred; this report does not use it as a blocker and does not claim measured memory compliance.

Master source SHA-256:

| File | SHA-256 |
|---|---|
| `apps/mobile/src/state/useStore.ts` | `7777e16d12a2662c5cfa403b958de1f8dc947460d9d9ed97356bb32dd646982c` |
| `apps/mobile/src/state/athleteRegistry.ts` | `e40c64433f00dd7f8abfea635bd368d57b17f27a58d407cc7dec883f808ee2cd` |
| `packages/core-db/src/migrations.ts` | `e930e424d4484d02003512ea691de22f5fa749d86f675abb45e2e4f49c3575e5` |
| `package.json` | `e90acd6103e86d706fe95021901f19bada8765c7b6cb0c095a929a49cf5be7ab` |
| `.github/workflows/ci.yml` | `9e7bae6f6c19c5bb06c34371636bb8b87864377e321c0619d5ff0e736992e975` |

## Reproduced current-master defects

The retained test uses the **real Zustand store, full current-master SQL migration chain and a separate node:sqlite database for each athlete**. Native database and file IO are test seams; embedding, health reads and registry reads are delayed by explicit promises. It creates synthetic demo data. It is host scheduling evidence, not a device observation or medical validation.

Command from the clean master worktree:

```
node node_modules/jest/bin/jest.js --config C:/Users/fpike/.codex/visualizations/2026/10/04/01a10600-ce62-7120-b660-90110f93f889/audit/jest.quality.config.cjs --runInBand --no-cache
```

Final run: **7 tests, 2 controls pass, 5 defect assertions fail, exit 1**. Full raw output: `master-async-boundary-expanded.log`. Tests/config/helper are retained beside this report. A previous five-case run is also retained as `master-async-boundary.log`; the expanded run is authoritative.

| Priority | Defect and evidence | Responsible source |
|---|---|---|
| **P1** | A's delayed safety report is written to B after switching athletes. No-switch control inserts A's report correctly. With a switch, A receives no new report and B receives `{raw_text:"chest pain",halt:1}`. A's captured state vector and current B profile/database are combined. | `useStore.ts:4755` captures report/vector; `:4772` awaits embedding; `:4779` resolves the current global database. `switchAthlete` at `:2242` only blocks an active workout, not an in-flight report. |
| **P1** | A's delayed biometric sync writes its result to B after switching athletes. No-switch control writes A correctly. Switched case writes `{date:"2026-09-01",rmssd_ms:73.125,source:"health_connect"}` into B. | `useStore.ts:3264`, native read at `:3271`, current database resolution at `:3273`; switch closes/reopens the shared database at `:2260–2265`. |
| **P2** | A stale already-granted check overwrites a newer explicit permission denial. The test first observes `denied`, then resolves the older check and observes final status `ready` and one `readDaily` call. | `useStore.ts:3227–3262`; `connectBiometrics` and `requestBiometricsAccess` have no operation generation, bridge ownership or permission-intent ordering. |
| **P2** | Two overlapping registry mutations lose an accepted edit. Concurrent A and B renames both read the same snapshot; only B's rename survives. This is the same read-modify-write boundary used by create/delete/switch, so their interleavings need coverage as part of the repair. | `useStore.ts:2303–2311`; other async registry mutations at `:2242`, `:2272`, `:2314`; `athleteRegistry.ts:54–57` writes the whole registry. |
| **P2** | A delayed onboarding name save renames B after A→B. Observed B name becomes `Onboarded A`; A retains its original name. The stale registry snapshot also resets persisted `activeId` to `default` while UI remains on B, so a later restart can select a different athlete. | `useStore.ts:2339–2352`; `:2345` reads `get().activeAthleteId` after awaiting the registry instead of owning the original athlete throughout. |

The minimum repair should reuse the local async-ownership fix rather than create a task framework: lease or otherwise serialize relevant registry changes; hold the originating report/read context through native awaits; generation-check permission results and all completion/finally status updates. Include overlapping reads, delayed failures, switch/create/restore, A→B→A and cold startup. Do not silence all report results just to make an isolation test pass.

## Latest feature branch: same five async defects remain

The same seven-case real-store diagnostic ran against fresh feature HEAD12a with its own full production chain and explicit safe-boot authority: **2 controls pass, 5 defect assertions fail, exit1**. Retained `feature-async-boundary.log`, `feature-async-boundary.test.js` and `jest.feature-quality.config.cjs`. This is a new observed run, not reuse of master output.

Feature responsible source locations:

| Finding | Feature source |
|---|---|
| P1 report crosses athletes | `useStore.ts:7356`, embedding await `:7374`, current database `:7380` |
| P1 HRV crosses athletes | `useStore.ts:5326`, read await `:5333`, current database `:5335` |
| P2 stale grant overrides denial | `useStore.ts:5289` / `:5311` |
| P2 overlapping registry mutations lose edit | `useStore.ts:3640–3655` |
| P2 onboarding name goes to wrong athlete | `useStore.ts:4023–4030` |

Feature SHA-256: `useStore.ts=f463f924abe50ba5961d6be27bcfe61d264ef30962ea886d7c327be1456a0b28`; `backupStore.ts=c6a0b71e247b94ea907340c5e858664e177bc8dc64efc78c5965bf095a71e08a`; `migrations.ts=b27ab6ac33178875ab3802d3c212863161aea54cc72806466679b8034f5a6bbb`.

## Integration migration order and confirmed P2 backup incompatibility

Master has a 34-entry migration array with `m058` at zero-based index33. The latest feature branch has67 entries with `m035` at index33, `m036` at index34 and `m058` much later. The persisted `PRAGMA user_version` is the array index count, not the filename number. Master explicitly documents the append-only prefix contract at `migrations.ts:54–65`.

**The sampled upgrade does not fail boot or lose the selected rows.** A new executable diagnostic transpiled and ran both real production migration runners against their real SQL bytes, with correct SQLite PRAGMA reads. Fresh master reaches34; fresh feature reaches67. A populated master34 database upgraded through the feature chain reaches67 and preserves the sampled profile, session, program and suspension rows. The feature runner executes100 migration entries because the initially skipped035 sentinel triggers a full replay;035 is eventually applied. This disproves any blanket claim that ordinal mismatch automatically causes a failing upgrade in this sample. It still changes the shipped prefix and relies on recovery behavior, requiring an explicit integration transition and broader preservation proof.

**A concrete whole-app backup gap follows that successful upgrade.** The same production backup-schema comparison returns:

| Database | user_version | Production current-schema match | Fingerprint |
|---|---:|---|---|
| Fresh feature install |67|true|`b2c6deabb8165cd6a2ebca99aa2744c3f10d7f20dd5f6680dcbcc24ae46ab500`|
| Upgraded master install |67|false|`f27ba0ba94857b1c0d6fac87ae89feb8e6f745944665a32ab967b0b23cd944fa`|

The sole `sqlite_master` difference is the `suspension_episode` table's recorded CREATE SQL. Master058 and feature058 have different inline comments inside that definition; `CREATE TABLE IF NOT EXISTS` preserves the already-installed master text. The feature backup fingerprint includes that text. In `backupStore.ts:502–506`, version67 selects the fresh67 contract and rejects the upgraded database's schema. This means the integrated app's backup path refuses an existing master installation even though the sampled upgrade and data preservation succeed. The fingerprint mismatch is reproduced using `matchesBackupSchemaContract` itself; native picker/crypto IO was not invoked for this diagnostic.

Retained proof: rerunnable `migration-upgrade-diagnostic.cjs`, `migration-upgrade-diagnostic-expanded.json` (full schema difference and preserved rows) and `migration-upgrade-diagnostic-expanded.log`. Earlier `migration-upgrade-diagnostic.json/log` record the initial success/preservation check only; expanded output is authoritative.

Resolve origin compatibility deliberately: preserve shipped migration ordinals or implement a reviewed transition with exact old/current schema identities; make backup/restore recognize the proved supported upgrade shape while still refusing arbitrary drift/future schemas. Do not relax all fingerprints or regenerate existing migrations to force a green fresh-install check. Prove populated master34 and feature63–67 installs, repeated upgrades, data preservation and actual backup/restore round trips. The broad prefix hazard and this concrete fingerprint rejection are separate findings.

## Local work available for reconciliation

The newer local candidate already contains `dataMaintenanceLock`, backup/restore/startup recovery and async ownership/permission handoff repairs. A focused read-only check on its current overlay completed:

```
node node_modules/jest/bin/jest.js --config apps/mobile/jest.config.js --runInBand --no-cache --runTestsByPath apps/mobile/test/components/AsyncAthleteOwnership.test.js apps/mobile/test/components/BackupMutationLease.test.js apps/mobile/test/components/BackupBootIntegration.test.js apps/mobile/test/components/BackupRestoreStore.test.js apps/mobile/test/components/BackupRecoveryIo.test.js apps/mobile/test/components/BackupCryptoHermes.test.js apps/mobile/test/components/BackupSafetyBoundaries.test.js
```

**7 suites / 102 tests pass, exit 0**, retained `quality-focused-tests.log`. Babel emitted path-resolution warnings; the suites still ran and passed. This validates the sampled local repair behavior only. It is not a master release gate or a full device-backed restore proof.

Current master has goal-program schema/preview/create/review UI and history import; these are not blanket “unimplemented” items. There are **zero source matches** for warm-up behavior, the portable encrypted-backup store/UI, or the mutation-lease coordinator in the searched current-master app/inference sources. The raw searches and exit statuses are retained in `master-feature-absence.json`. These absence results apply to **master only**. The later-discovered feature branch has preparation/warm-up, focus/SMART goals, sport emphasis and portable backup/restore wired into the app; these are not missing features on12a. It still lacks the local async-ownership repair and local animation preview implementation. Do not mistake current `AK_HISTORY_V1` import for an encrypted whole-app backup/restore feature.

## Latest feature backup/lifecycle review and product inventory

Source reviewed: `preparationStore.ts`, `focusGoalStore.ts`, `sportStore.ts`, the store boot/switch/report/health paths, backup staging/recovery/replacement, and the schema contract. Feature `ProfileScreen.tsx:421/424/986` wires focus/goals, sport and backup panels; `SessionScreen.tsx:295` uses preparation actions. Preparation records remain separate from training volume, use session instance/revision ownership and durable restart state. Goal observations/revisions and sport explanations persist in dedicated sidecars. This confirms implementation presence, not full clinical/device acceptance.

The feature backup code validates an authenticated archive against its exact historical schema before forward-migrating an isolated staged copy, then checks the current schema before replacement (`backupStore.ts:616–630`, `:367–399`). Contracts explicitly support feature versions63–67 (slots64–68). Native restore replacement uses a retained recovery backup, operation-specific journal/markers, rollback copies and confirmed publication/cleanup. Existing `BackupForwardRestore.test.js` contains version63–67 and preparation/focus/goal/sport preservation cases; the root's full feature verification owns their run. No additional restore defect is asserted from a hypothetical failure. The concrete existing-master fingerprint rejection above remains unresolved.

Feature root scripts correctly provide `verify:ci`, `verify:release`, QA candidate provenance and backup tests. CI builds and gates the Android QA candidate. **There is no movement-evidence gate and no iOS CI job on12a.** The historical master gaps below must not be conflated with feature-branch verification.

## Release verification/security gaps

- Master `package.json:31` and `.github/workflows/ci.yml:42` run `verify:all`; there is no `verify:ci` / `verify:release` split, candidate-provenance gate or movement-evidence gate in this baseline. Autonomous instructions copied from the newer local branch would call nonexistent scripts.
- Master `tools/memory-audit/audit.mjs:36–52` checks a static footprint model, not a captured process/device packet. Since the owner deferred the 4GB phone check, record this as deferred external acceptance. A green model is not measurement.
- Android `app/build.gradle:100–103` signs the `release` build with the committed **debug signing configuration**. `.github/workflows/ci.yml:90–98` deliberately builds/uploads that convenience APK. It can be a sideload build, not evidence of production store signing or a gated candidate bound to the complete integrated app.
- The root's retained `npm-audit.json` reports **66 vulnerable package entries: 1 critical, 58 high, 6 moderate, 1 low**. This count is advisory metadata, not proof of a mobile exploit. The critical entry is transitive `protobufjs`, routed through the Node/web inference toolchain. Direct affected packages include React Native/build tools, Jest, `@xenova/transformers`, `onnxruntime-node` and Health Connect config tooling. Classify build-time versus bundled/runtime reachability and apply bounded compatible updates; several “fixAvailable” suggestions are major upgrades or downgrades. Do not run `npm audit fix --force` as an autonomous release shortcut.
- Full native iOS build/signing/HealthKit, current store metadata/privacy and physical-device smoothness are covered by the separate platform/runtime lanes. Host test success does not certify those surfaces. No native iOS result is asserted by this report.

## Autonomous execution order and stop condition

1. Freeze the current master and the accepted local deltas by commit/tree/file hashes. Make a GitHub-accessible integration branch containing only reviewed changes; do not let Opus infer local files it cannot access.
2. Resolve migration-prefix compatibility before importing the newer app/data features. Retain master upgrade fixtures and proof.
3. Port the existing ownership/permission repair and its real-store tests, extend tests for the registry/onboarding reproductions, and verify backup/recovery coexistence.
4. Run the appropriate complete gate for the final branch and add explicit platform/native candidate verification; audit dependency reachability and signing.
5. Let the separate technique auditor and runtime auditor inspect the **same frozen animation/app candidate** after fixes. Any changed evidence invalidates the relevant prior verdict.
6. A release-ready claim requires no unresolved P1/P2 app defects, the agreed complete feature set, independent audit passes, reproducible native builds and external account/signing/store acceptance. Record the owner-deferred 4GB phone verification openly; do not auto-generate passing device evidence.

Machine-readable source/dirty-state record: `app-quality-snapshot.json`. Both fresh master and fresh feature worktrees remained clean after this lane's work.
