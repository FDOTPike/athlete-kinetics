# Independent simulator-harness re-audit — 89f6f589

Source: clean detached `89f6f5896e493ade8dd25c8b0e0ed77bc5b7524f` in the managed review checkout. The delta from `998b1d4d` changes only `tools/ios_simulator_smoke.sh` and `tools/ci_annotate_failure.mjs` (28 additions / 12 deletions). App, packages, SQL, native project and CI workflow are unchanged. The prior independent `998b1d4d` compilation and twelve built-app inspections remain valid evidence for those unchanged sources; native launch has not yet been passed.

All outputs here are external audit evidence. No application source was edited, no CI job created and no cloud task steered by this auditor.

## Source-phase verdict

**The supported-pair fix is confirmed on the real macOS runner: inventory acquisition, compatible pair creation, boot, install and app launch succeeded. Native app acceptance still fails because iOS requests the wrong JavaScript app key.** Both candidate runs completed host verification and Android successfully, but iOS failed at smoke. Captured run `37203040614` / job `111441005528` passed unsigned build and all twelve built-app inspections, then the launched app crashed with `"AthleteKinetics" has not been registered`. The six native checks and backup-resource readback did not complete.

The selector now takes the chosen iPhone from the selected available iOS runtime's own `supportedDeviceTypes`, instead of choosing an unrelated last global device. The latest available runtime is chosen with numeric version ordering. It prefers a plain/pro iPhone name but falls back to other supported iPhone names, including SE. No supported runtime/phone and malformed inventory fail closed. Full inventory and the selected identifiers are retained before creation; failed creation retains stderr and emits an explicit API-visible annotation. This closes the source mechanism behind the previous incompatible-device selection.

Mocked host checks alone do **not** establish Apple's inventory CLI behavior. In this completed run, the saved actual inventory independently confirms that the command returns runtime/device data and that the chosen iPhone is supported by the chosen available runtime.

## Bounded source review

- Setup inventory is saved before parsing; selection is saved before `simctl create`. A failed creation exits with failure, records `simctl-create.err` and does not emit a successful `simulator.json`.
- The newly selected runtime-local phone identifier is passed to the real create command. Fresh simulator creation, install, launch and cleanup remain intact.
- Console mode changes from `--console-pty` to `--console`, avoiding an unnecessary PTY in CI. It retains both the document result channel and console-marker fallback, timeout and failure on early exit/no report.
- All six in-app native checks and the Foundation readback of actual Documents/Library backup exclusion flags remain mandatory. No static pass substitutes for them.
- Failure reporting now annotates the failed shell command, retained create stderr, missing-result console tail and actual failed native check details.
- The compiler annotator now accepts diagnostic-shaped compiler/linker/tool errors and excludes numbered source excerpts; it no longer reports ordinary Objective-C `error:` parameters from successful build output as compiler failures.

No new product behavior was introduced by this two-file delta. The actual launch exposed a pre-existing product startup defect, detailed below. The new harness's real evidence makes this defect observable; it must not be mistaken for another simulator-pair failure.

## Independent focused proof

`check-harness-source.cjs` executes the exact embedded selector from the frozen shell source and the exact annotator; it also executes the exact shell setup prefix under Git Bash with controlled xcrun output. It does not change repository source. Eleven cases pass:

1. A supported runtime/device pair is chosen even when the global device inventory ends with an unsupported newer device.
2. Version `26.10` sorts above `26.9`, while unavailable and non-iOS runtimes are ignored.
3. A supported SE fallback is chosen and an iPad is excluded.
4. No available iOS runtime exits nonzero without identifiers.
5. No supported phone exits nonzero, even if global device inventory contains phones.
6. Missing supported-device data exits nonzero.
7. Malformed JSON exits nonzero.
8. Ordinary source excerpts from a successful build do not become compiler error annotations.
9. Actual compiler, linker and xcodebuild error shapes remain annotated.
10. Controlled create failure preserves inventory, selected pair and stderr, emits the failure annotation, and writes no successful simulator identity.
11. Controlled missing-runtime shell failure exits before creation, preserves inventory, emits an annotation and writes neither selection nor create evidence.

Evidence: exact harness copies, `source-file-hashes.json`, `harness-source-check-results.json`, `harness-source-check.log`, controlled inventory/output directories and `delta-from-998.patch`. These are explicitly labeled **host controlled source checks, not native runtime evidence**. Replaying the exact new annotator against the prior real successful 16MB Xcode log also produces no false source-excerpt compiler errors (`annotator-real-successful-build-replay.log`).

## Native completion evidence

Candidate runs [37203040149](https://github.com/FDOTPike/athlete-kinetics/actions/runs/37203040149) and [37203040614](https://github.com/FDOTPike/athlete-kinetics/actions/runs/37203040614) both completed with host verification / Android success and iOS failure. The fully captured second run's simulator smoke lasted `13:17:26`–`13:22:16 UTC` on 4 October 2026. Its unsigned Release build succeeded (`ios-job.log:47273`) and all twelve artifact inspections passed.

The downloaded actual inventory is 158,592 bytes: 12 runtimes, 124 global device types. Recorded selection is available iOS 26.5 (`com.apple.CoreSimulator.SimRuntime.iOS-26-5`) and iPhone 11 (`com.apple.CoreSimulator.SimDeviceType.iPhone-11`). Independent JSON inspection shows that exact phone in that runtime's own supported-device list, with `productFamily:iPhone` (`real-supported-pair-proof.json`). Fresh simulator `75F8FADE-B0D6-43CC-8BA6-997F4CB62F60` was created and booted, app installed and launched; create stderr is empty. This confirms the prior incompatible-device blocker is closed.

The console records an actual launched PID `90188`, followed by an uncaught `facebook::jsi::JSError` / AppRegistry invariant. Native smoke is an empty zero-byte file produced by the failed fallback capture; there is no valid six-check report and no `backup-exclusion.json`. **An empty report is failure, not native runtime evidence.**

Source identity: artifact `11304123815` records PR27 merge `04a977376f9424decf01f4d9594e35cffae8be97` / `refs/pull/27/merge`; its tree `3338b85e912f2958ef5827bb23a101f7577155cf` is independently identical to frozen `89f6f589`. Xcode 26.6 build 17F113, Node 24.20.0, SDK 26.5, minimum iOS 15.1 are recorded. Podfile.lock remains uncommitted and post-pod tracked tree is dirty, retaining the existing reproducibility limitation.

The nested actual app ZIP is 54,489,742 bytes. Independent streams confirm a real 120,615,824-byte universal executable (`ca4b0cb80b8b32874f2c082939aec32a417df2e80d1874ec4dd240a18697d26b`), JS bundle 6,116,530 bytes (`83c89026a286f1cd3986d0bb1893331fa0df02ddce6c724b6d85204383f81b0e`, identical to the prior unchanged product bundle), pinned model/font and actual Info.plist/privacy contents. Binary-plist decoding corroborates packaging. Native executable hashes may vary between builds; source identity is tied to the verified Git tree rather than an assumption of byte-for-byte deterministic native output.

Evidence: `completed-run.json`, `other-run-final.json`, `ios-job.log`, `native-smoke-stage-annotations.json`, `ci-source-tree-match.json`, `real-supported-pair-proof.json`, `89f6-independent-app-inventory.json`, `89f6-decoded-bundled-plists.json`, `native-artifact-file-hashes.json` and `native-artifact/*`.

## New P1 product blocker — native/JavaScript launch-name mismatch

`apps/mobile/app.json:2` declares React Native app name `pikeMethods`; `apps/mobile/index.js:3`–`:5` imports that name and registers the component under it. But `apps/mobile/ios/AthleteKinetics/AppDelegate.swift:27` starts the factory with module name `AthleteKinetics`. The app is therefore requesting an unregistered key. This exactly matches the captured console exception, without requiring an unproven earlier import-failure hypothesis.

Android is already aligned: `apps/mobile/android/app/src/main/java/com/athletekinetics/MainActivity.kt:32` returns `pikeMethods`. Native display name, bundle identifier and executable filename are separate identifiers and do not repair the React Native registration key.

Minimum remediation: change the iOS factory module name to the same `pikeMethods` key, then add a native-config gate comparing app.json's registration name against both platforms' launch names. Rebuild and rerun the actual simulator checks; do not bypass AppRegistry or smoke. No SQL/store/migration change is needed. Frozen source excerpts are retained as `app-json-at-89f6.json`, `entry-at-89f6.js`, `AppDelegate-at-89f6.swift` and `MainActivity-at-89f6.kt`. Installed RN's `AppRegistryImpl.js:170` checks `runnables[appKey]`, corroborating the exact-key invariant observed on the native runtime.

Prior acceptance limits remain: unsigned simulator proof does not establish signing, HealthKit authorization/data on a real iPhone, Files backup/restore and interruptions, complete workout/accessibility flows or motion smoothness. Owner Apple credentials and store acceptance are separate; the 4GB phone acceptance remains deferred.
