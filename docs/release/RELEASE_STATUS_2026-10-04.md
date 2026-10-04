# Release status — 4 October 2026 (integration branch `claude/release-integration`)

This is the R4 completion report for the autonomous release work order of
4 October 2026. It separates what is **implemented and host-verified**, what
has **unsigned native proof** from CI, what needs a **signed beta**, what needs
**store publication**, and the **deferred device memory test**. Nothing here
claims a device pass, a signed build or a store submission.

- Source: feature `claude/coaching-wo4-coaching-content` @ `12a1fb1`, integrated
  with master @ `1da218d` (master was not modified or merged into).
- Pull request: FDOTPike/athlete-kinetics#26 (draft, do not merge).
- Animation/motion: not touched; owned by the motion branch.

## 1. Implemented and verified on the host (Linux, Node 24)

| Item | What changed | Evidence |
| --- | --- | --- |
| R0 migration lineage | Master v34 installs (ordinal 34 = `058`) are recognised from their schema and rewound by one ordinal in a transaction, so `035`…`069` apply as ordinary steps. A feature or interrupted install continues; an install with neither lineage object fails closed before any write. No shipped SQL byte or ordinal changed (`MIGRATION_LINEAGE.json`). | `verify:migrations` incl. `verify_migration_lineage.mjs` [L1]–[L7]; `BackupLineageCompat` |
| Backup fingerprint (P2) | Master-upgraded databases differ only in the stored text of `suspension_episode`. Exactly the two known texts are canonicalized before fingerprinting; any other drift still fails. | `verify:backup`, lineage [L7], `BackupLineageCompat` |
| R1 athlete ownership | Exclusive mutation leases for switch/create/rename/delete/onboarding name; ordered biometrics permission operations; `syncBiometrics` and `reportSubjective` re-check the athlete before writing. | `AsyncAthleteOwnership` (71), `AsyncBoundaryReproduction` (7) |
| R2 iOS source | op-sqlite math flags at the root; read-only Apple Health adapter; pinned MiniLM staged into the app bundle; HealthKit entitlement; display name, font, launch screen; iOS backup exclusion of app data; CI-only native smoke. | `verify:native-config` (24th gate), `AppleHealthBridge`, `DeviceBackupPolicy` |
| Apple resting heart rate | `069_resting_heart_rate` (append-only): `resting_hr_daily` keeps resting HR per local date with its unit (bpm), source (`apple_health`/`health_connect`) and sync time, independent of RMSSD. A later read of a date replaces it; an empty or failed read deletes nothing. Backup contract v68. | `verify:migrations` [069], `verify:backup`, `verify:store`, `AppleHealthBridge`, `BackupForwardRestore` |
| Identity | One app identity on both platforms: `com.pikemethods.training` (QA: `.qa`). The memory harness now defaults to the real QA package. | `verify:native-config` [N5] |
| iOS Files restore type (P2, independent recheck of `cf4c221`) | Restore handed the Files sheet `application/octet-stream`; the installed picker (12.0.2) maps iOS types with `UTType(identifier)`, so it resolved to nothing. iOS now gets the library's own all-files identifier `public.item` (`.pmbak` has no system type); Android keeps its MIME filter; encrypted validation, size refusal before copy and restore isolation are unchanged. | `BackupPickerBoundary` (real library JS, native stub only; fails on the old code), native smoke "Files import types resolve natively", [N8] |

### iOS signal parity — what iOS does and does not have
- **Sleep:** read and used for readiness, same meaning as Android.
- **Resting heart rate:** read and kept in the measured days on both platforms.
  It does not feed readiness on either platform (it never did).
- **HRV:** not read on iOS. HealthKit exposes SDNN, not the RMSSD the readiness
  model and every stored baseline use; it is never stored as RMSSD. iOS
  readiness therefore runs on training load, sleep and subjective reports.
  **This is not full parity** with Android, which also reads RMSSD.
- **Spoken cues:** the spoken-cue feature (PR #21, open, not on this branch)
  has an Android engine only. On iOS its control hides itself; an
  AVSpeechSynthesizer module is needed for parity. Owner decision.

## 2. Unsigned native proof (CI, no signing)

The `ios-simulator` job (macOS 26, Xcode 26) builds an unsigned Release app for
the simulator, inspects the built artifact (executable present, bundle, pinned
model hash, font, privacy manifest, Info.plist, op-sqlite math flags) and
launches it on an iPhone the newest runtime itself supports, with
`-AKNativeSmoke 1`. The in-app smoke checks SQLite math, the full migration
chain, embedder inference and routing, the production backup CSPRNG
(`mobileBackupCrypto.randomBytes`), this launch's device-backup exclusion and
a clean boot; the script then reads the REAL `isExcludedFromBackup` resource
values of the app's Documents and Library directories from the host. Every
step fails closed. The Android job builds the debug-key QA and debug APKs.

Getting there on Xcode 26 took five real fixes, each found from CI evidence:
fmt 11.0.2 consteval (fmtlib/fmt#4740), glog's namespace-included headers for
NitroModules' Swift/C++ interop, a runtime-supported simulator pair, the smoke
checking the production CSPRNG instead of an absent global, and the iOS app
launching the component the JS bundle registers (`pikeMethods`; it launched the
template name `AthleteKinetics` and never mounted).

**User-interaction tests (XCUITest, same job, after the smoke).** A UI-test
target drives the shipped Release bundle on a fresh simulator, one freshly
installed app per test: (1) onboarding and every primary/header destination
with Apple's accessibility audit; (2) Dynamic Type — text and a text field
measured at the largest accessibility size; (3) Apple Health — Don't Allow on
HealthKit's real sheet, honest wording, a second athlete and switching never
reopening the sheet; (4) an encrypted backup saved to Files, a cancelled Files
sheet, then a restore of the saved `.pmbak` with preview and replace; (5) a
workout set logged, background and return, then a cold relaunch that resumes
the same session. Throughout, the app process's internet sockets are sampled
once a second (offline evidence: the simulator shares the host network, so
this observes rather than enforces isolation). The tests are built ad-hoc for
the simulator (identity "-", no team); the job checks the HealthKit entitlement
in the binary's `__TEXT,__entitlements` section.

**Native reproducibility.** `Podfile.lock` (byte-identical to the lock the
audited `cf4c221` build resolved, SHA-256 `7f8467d9…`) and the exact results
of React Native's post-install (aggregated privacy manifest, `RCTNewArchEnabled`,
project settings — blob hashes equal to CI's post-install output) are
committed; CI runs `pod install --deployment` and fails if any tracked file
changes.

Status on this branch: see §6 (filled from CI, never assumed).

## 3. Signed beta — owner inputs required
- **Apple:** Developer Program membership, a team, the App ID
  `com.pikemethods.training` with HealthKit, signing certificate and
  provisioning profile, then an archive and TestFlight upload. No team or
  certificate exists yet; none is invented here.
- **Android:** the upload key (`AK_UPLOAD_STORE_FILE`, `AK_UPLOAD_STORE_PASSWORD`,
  `AK_UPLOAD_KEY_ALIAS`, `AK_UPLOAD_KEY_PASSWORD`) and `AK_VERSION_CODE` /
  `AK_VERSION_NAME`. A release build refuses to run without the four signing
  values (fail-closed in `android/app/build.gradle`). targetSdk 36; NDK r28
  aligns native libraries to 16 KB pages.
- **App icons:** only placeholder icons exist on both platforms.
- **Physical-device acceptance:** Apple Health authorization and data on a real
  iPhone, Health Connect on a real Android device, a full workout session,
  backgrounding and cold-start resume.

## 4. Store publication — owner actions
App Store Connect record, privacy nutrition label (health data read locally,
not collected or linked), export compliance (the app uses standard AES-GCM for
encrypted backups), screenshots and metadata; Play Console listing, Data
safety form and the Health Connect permissions declaration.

## 5. Deferred — 4 GB device memory test
The 512 MiB dirty-RAM ceiling on a 4 GB device is deferred to the owner's own
download test and has **not** been measured or passed. Use
`tools/memory-audit/meminfo_harness.mjs` (default package now the real QA id,
`com.pikemethods.training.qa`).

## 6. Results on the branch tip

First fully green head: `cf4c221` (CI run on PR #26):

| Job | Result |
| --- | --- |
| Verification suite (24 gates + typecheck) | success |
| Android QA + debug APKs | success |
| iOS unsigned Release simulator build | success (≈18 min) |
| iOS built-app inspection | success |
| iOS simulator native smoke + backup-exclusion readback | success (≈5 min) |

The smoke step passes only when the report is `ak.native-smoke/1` with
`ok: true` and every check passing, and both directories read back excluded,
so a green step implies all of those held. The detailed report, the
resource-value JSON and the simulator inventory are in the run's artifact
(binding them to the exact head is the independent auditor's step); later
runs also publish each passed check as an API-visible notice.

Host (Linux, Node 24) on `55955f8`: full component suite 60/60 suites, 995
tests; every gate green. Independent external recheck at `55955f8`: no open
product defect.

User-interaction tests: first native run (`4add9de`) — Dynamic Type passed
(text 14 → 100 pt at AX XXXL) and 311 socket samples saw no internet socket;
the audit reported Dynamic Type on the Library search field (an RN text field;
now measured in test 2 and classified only for that pairing), the HealthKit
sheet and the Files location were not found, and the workout result was lost
to the annotation limit. Diagnostics, annotations and those findings were
addressed; **the UI tests are not yet green and are not claimed.**

**Not claimed:** this is simulator evidence only — no signed build, no
physical device, no real Health data, no VoiceOver session, no TestFlight, no
motion acceptance, and not the 4 GB memory test (§5).

## 7. Dependency audit (npm audit)
66 findings → 57 after semver-compatible build-tool updates; never
`npm audit fix --force`. Release Metro bundles (both platforms, source-mapped)
contain no package with an advisory of its own: every finding is build, test
or developer tooling. Deferred items and their reasons:
[DEPENDENCY_AUDIT_2026-10-04.md](DEPENDENCY_AUDIT_2026-10-04.md).
