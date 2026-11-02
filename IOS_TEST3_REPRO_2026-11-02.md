# iOS test3 reproduction — 2 November 2026

- Tested commit: `14323d873581dcc899d84971d903c8e8155330f5`
- Reproduction branch: `codex/ios-test3-repro`
- Xcode: 27.2 (27B52); macOS 26.6.2
- Simulator: iPhone 17 Pro, iOS 26.5 (23F77), arm64
- Node 24.16.0, npm 11.16.0, Ruby 3.3.12
- Build: `build-for-testing` succeeded using the Release simulator settings and ad-hoc signing from `.github/workflows/ci.yml` after `npm ci`, the workflow's verified embedder fetch, and `bundle exec pod install --deployment`. The tracked source tree was unchanged at test time.
- Result: **10 iterations: 1 passed, 9 failed**. Xcode exited 65. The `.xcresult` device/configuration summary confirms these repetition counts.

The single selected test was run serially, without resetting the simulator between repetitions:

```sh
xcodebuild test-without-building \
  -xctestrun build/Build/Products/AthleteKinetics_iphonesimulator27.2-arm64-x86_64.xctestrun \
  -destination 'id=0DEE2A4A-2683-4A15-86AC-1F677FF8DDC7' \
  -resultBundlePath /Users/sarahsmith/Documents/AthleteX/ios-test3-repro.xcresult \
  -only-testing:AthleteKineticsUITests/AthleteKineticsUITests/test3_healthDenialAndAthleteSwitching \
  -test-iterations 10 -parallel-testing-enabled NO
```

| Iteration | Outcome | Duration (seconds) |
| --- | --- | ---: |
| 1 | Passed | 427.696 |
| 2 | Failed | 66.275 |
| 3 | Failed | 65.876 |
| 4 | Failed | 65.992 |
| 5 | Failed | 66.003 |
| 6 | Failed | 65.862 |
| 7 | Failed | 65.941 |
| 8 | Failed | 65.859 |
| 9 | Failed | 65.831 |
| 10 | Failed | 65.878 |

Each failure, iterations 2–10, emitted the same error line (the absolute checkout prefix is omitted here):

```text
apps/mobile/ios/AthleteKineticsUITests/AthleteKineticsUITests.swift:203: error: -[AthleteKineticsUITests.AthleteKineticsUITests test3_healthDenialAndAthleteSwitching] : failed - onboarding (athlete A) did not appear within 60 s
```

These failures occurred at initial onboarding, before the Health denial checks. The test log's final failure tree shows the app on a “BUILD YOUR PROGRAM” screen. This observation does not establish the cause. No fix was attempted.

The result bundle and full test log are retained locally at `/Users/sarahsmith/Documents/AthleteX/ios-test3-repro.xcresult` and `/Users/sarahsmith/Documents/AthleteX/ios-test3-repro.log`; they are not included in this commit. The build log is at `/private/tmp/athlete-kinetics-build-for-testing.log` and is temporary. CocoaPods generated untracked local workspace files, which are excluded from this report commit.
