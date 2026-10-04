# Independent iOS recheck — cf4c221e

**Result: PASS for unsigned native simulator smoke and this narrow fix.** The real CI artifact contains all six successful native checks and both independently read Foundation backup flags. The previous iOS launch-name blocker is closed on this revision. No new blocker was found in this delta. This is not whole-app release approval.

Audited source: `cf4c221ef3993341f903a1d228e94d4893002081`, frozen from the clean review checkout. Source tree: `4283c3acfad16d70e456c15645949dfdaa9ac7c7`. Copies of changed native sources and entry-point identities are retained in this directory and match the checkout byte-for-byte. Audit writes were restricted to this external directory; app sources were not edited. The source hold is released.

## Exact fixes and independent host checks

- `apps/mobile/ios/AthleteKinetics/AppDelegate.swift:27` now launches `pikeMethods`, matching `apps/mobile/app.json:2`, the JS registration in `apps/mobile/index.js:5`, and Android `MainActivity.kt:32`. `tools/verify_native_config.mjs:132` pins all three names. The exact gate passes current source and rejects the previous iOS template name, a different Android name, a different registered name, and each missing name.
- `apps/mobile/src/diagnostics/nativeSmoke.ts:58` races each check against a 90-second timer, records a named failure and continues later checks. `nativeSmoke.ts:76` writes a start marker; `nativeSmoke.ts:164` emits an error when the final report write rejects. Host reproductions proved timeout failure/continuation, marker-write rejection recovery and final-write diagnostics.
- `tools/ios_simulator_smoke.sh:13` allows 600 seconds for collection. Its missing-report branch at line 66 records start/process state, system logs, crash evidence and console diagnostics. The exact shell block failed closed in two controlled cases: never started/no process, and started/no report/process running. Logs were retained in both cases.
- `140912c7` adds least-privilege CI token permissions and disables persisted checkout credentials. It does not change product behavior. The complete delta from `89f6f589` is six files, 63 additions and eight removals. SQL, migrations, store, backup provider, biometrics and policy source are unchanged.

**Commands/results:** `npm run verify:native-config` passed all 40 assertions; `node check-source-failures.cjs <frozen-repo> <results>` passed 19 cases; `node check-report-diagnostics.cjs` passed two cases. These are host checks, not iOS runtime evidence. Controlled source tests used the exact smoke/backup provider/base64 decoder, mocked other native seams, and accelerated only the requested 90-second timers. Timers bound asynchronous settlement; they do not cancel native work or interrupt synchronous JS/native blocking. A hung marker/report write or blocked JS thread remains a host-timeout failure, not a guarantee that the in-app report is always written.

## Real native run and source identity

[CI run 37205238908](https://github.com/FDOTPike/athlete-kinetics/actions/runs/37205238908) and [iOS job 111446498259](https://github.com/FDOTPike/athlete-kinetics/actions/runs/37205238908/job/111446498259) completed successfully. Host 24 gates/typecheck/Metro and Android QA jobs also succeeded. Build finished at 13:48:20 UTC, app inspection at 13:48:21, simulator smoke at 13:53:41 and iOS job at 13:54:10 on 2026-10-04. No additional workflow was dispatched by this auditor.

Downloaded artifact: **11305725730**, `athlete-kinetics-ios-simulator-unsigned`. Its `identity.json` records PR 26 merge commit `88f72f33a18cce6059c47891be639528843afe2d`. GitHub's merge tree exactly equals the audited source tree; `ci-source-tree-match.json` retains this proof. This result is not attributed to the older PR 27 head `a5fa5114`, whose build lacks the launch-name fix.

The saved real inventory contains an available iOS 26.5 runtime with iPhone 11 in that runtime's supported-device list. The fresh simulator was **2789B1FB-753E-4978-8ED8-C6D4154FDADC**. Creation stderr is empty. Job logs prove boot, installation and launch; this is not a static configuration check. The saved console contains the launched PID and no prior registration exception.

`native-artifact/native-smoke.json` is a nonempty 667-byte report with platform `ios`, schema `ak.native-smoke/1`, `ok:true`, exactly six expected checks and elapsed time **668 ms**:

| Actual runtime check | Observed result |
| --- | --- |
| SQLite math functions | `ln(1)=0 sqrt(4)=2` |
| Fresh production migrations | `user_version=68 movements=300`; readiness view queried |
| Native embedding inference and routing | 384 dimensions; norm 1.000000; `pain-mild`; similarity 0.996697 |
| Production backup CSPRNG | `RNGetRandomValues` via `mobileBackupCrypto.randomBytes`; two distinct 32-byte draws |
| App startup backup exclusion | Documents and Library reported excluded |
| Normal store boot | `status=ready` |

The host then read **actual Foundation resource values**, separately from the app's reported outcome: `Documents.isExcludedFromBackup=true`, `Library.isExcludedFromBackup=true`. Raw extended attributes name `com.apple.MobileBackup`. Both JSON and raw attributes are retained. `verify-native-evidence.py` independently asserts the exact source tree, supported simulator pair, six required results, two flags and artifact contents; it passed.

## Actual built-app inspection

The 12 CI artifact inspections passed. Independent ZIP reads confirm a real universal Mach-O executable (two slices; **120,615,824 bytes**), Release JS bundle (**6,117,495 bytes**), pinned MiniLM model (**22,972,370 bytes**), pinned Archivo font, privacy manifests and binary Info.plist. Info.plist has bundle ID `com.pikemethods.training`, display name `pikeMethods`, minimum OS 15.1, SDK `iphonesimulator26.5`, meaningful read-only Health text and the font registration. The bundled privacy manifest has tracking false. Toolchain: Xcode 26.6 build 17F113, Node 24.20.0.

| Evidence | SHA-256 |
| --- | --- |
| App ZIP, 54,490,111 bytes | `47EB5936783C8433BCF7D41DCCD31CB5273EFE5F1E28C921E6925DF787BC0145` |
| Universal executable | `7320FCF60CEDA12E9C8789F32969F6A93849ED687C9A733A1B6E91D1EA1E7703` |
| Release JS bundle | `FF4AC88CBA3826CF15F3374D09A9C000964DE6D4B4A8DB396A6BD6AE5355E013` |
| Model | `AFDB6F1A0E45B715D0BB9B11772F032C399BABD23BFC31FED1C170AFC848BDB1` |
| Native smoke report | `D3656893420F3EF7744F3C5800CBE1976DBF451B78F64123CCDDFE958F7F32A1` |
| Foundation flag report | `5A7CDD31A9E60EC71C6E3431ED99EC83192FEF10B481E8AEAF914D9254D90DEE` |
| Full native job log | `CF064A85B50476BEF8B06405B333E599A55AE3B457AADE304F57657B5F264AE4` |

## Outstanding acceptance and scope limits

- Apple Developer signing, registered application/team, signed physical-device build and TestFlight/App Store delivery remain owner-credential steps. This artifact is an unsigned simulator app.
- Real HealthKit permission denial/revocation and real sleep/resting-HR ingestion, Files export/import and interrupted encrypted-restore recovery, accessibility/VoiceOver, complete workout/coaching user flows, foreground/background behavior and offline user-flow checks remain outside this six-check smoke. Passing entropy alone does not approve the encrypted-backup workflow. Native module compilation and store boot do not approve those flows.
- No movement technique, motion smoothness or final animation acceptance is inferred. Root's independent motion lanes own those checks.
- `identity.json` still reports `trackedTreeClean:false` and `podfileLockCommitted:false` after pod installation. The resolved 74,448-byte lock has SHA-256 `7F8467D97EC7D58923B9448D677E753E89624D20AD0E3F3914CCB15D0FA9FD22`, unchanged from prior native builds. Retain/review and commit the lock, then exercise the existing `pod install --deployment` CI branch; account for any tracked privacy aggregation changes before claiming reproducible release-source cleanliness. This does not invalidate the separately proven reviewed/CI Git-tree match or the observed native runtime pass.
- The user's 4GB phone acceptance is deferred to their download/device verification and is not an audit blocker or a claimed pass.

The prior broader iOS reports retain other release/product-scope debts. This report accepts only the exact source-name fix, native configuration, diagnostics logic and observed unsigned simulator smoke. Previous failed 89f6/998 evidence is preserved in its own directories; their runtime outcomes are not relabeled as passes. `EVIDENCE_SHA256.json` hashes this completed packet for subsequent comparison.
