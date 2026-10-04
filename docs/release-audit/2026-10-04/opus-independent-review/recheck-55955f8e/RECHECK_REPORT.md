# Independent recheck — Opus tip 55955f8e

Exact source: **55955f8e0dfd93df88824a192b53832b6adc4479**, detached checkout `C:/Users/fpike/.codex/worktrees/opus-integration-review-2026-10-04/Athlete App`. Compared with the independently audited **d9574bf949b2dd3a9fd805d02cf28553a9b74fa9**. Checked on 2026-10-04 with Node24.11.1. Clean tracked state before and after. No product source edits, merges, PR posts, publishing, or cloud task messages were made. All evidence belongs to this external `recheck-55955f8e` directory.

**Recheck verdict: all three previously confirmed findings are closed on this exact tip. No additional product defect was confirmed in the reviewed delta.** This is acceptance of these source and host contracts; it does not certify native build, signing, device behavior, movement animation smoothness, or complete release readiness.

## Closed findings and independent evidence

| Previously confirmed issue | Exact new result |
| --- | --- |
| Awake-only Apple samples become estimated sleep | Both original production-adapter counterexamples now return **0 asleep minutes**, including matching in-bed-plus-awake samples. Known asleep-core retains480 minutes; genuinely unstaged in-bed retains441.6. Native stage information is kept whenever any known stage exists. `sleep-counterexample.json` and `sleep-and-contract-probe.log` record actual outputs; probe exits0. |
| Pending startup grant across A→B leaves health permanentlyoff | The original independent real-store counterexample now completes with Bready, two read-only grant checks, and a working manual sync. An independent counterexample where A's stale answer istrue and B's own answer isfalse ends Bidle with no read or permission sheet. `independent-ownership.log` records the production store behavior. |
| Windows migration lineage gate leaves master34.db open during directory deletion | The **unmodified repository** `npm run verify:migrations` now exits0 on Windows, prints `ALL CHECKS PASSED` and `ALL LINEAGE CHECKS PASSED`, and completes cleanup. No audit-only closure patch was needed. The new connection set closes all test handles before removing the temporary directory. `migrations.log` is the raw evidence. |

## Additional independent boundary checks

The externally owned original harness was retained and expanded; **20/20 cases pass**, exit0. The prior historical telemetry fixture was moved from September to the current trailing week because this tip intentionally protects older read-window-edge days. Program horizon fixture dates remain unchanged. No product assertion was waived.

The passing cases include:

- Original report/sync athlete ownership, explicit switch refusal and successful retry, stale-grant/new-denial ordering, concurrent registry refusal/retry, and onboarding name ownership.
- Apple RHR-only persistence, later replacement, empty-read retention, and no invented RMSSD.
- B's newer denial, disconnect, or pending explicit request survives BOTH stale A completion and a pending B startup check. No unauthorized health read or automatic permission sheet occurs.
- An explicit A permission request remains pending across Bboot. For grant, denial and native error outcomes, B receives its own read-only check only AFTER the explicit request settles. A's answer is not used as B's answer.
- A hung native health read times out at30000ms under controlled timers, releases the mutation lease, allows a switch to B, and discards late data without writing to either athlete.
- Trailing-week filtering preserves an older complete stored night. Apple RHR writes to `resting_hr_daily` without overwriting resting HR under a legacy Health Connect HRV provenance label.
- The real-store stable program horizon preview and save still retain2026-11-24 for the existing2026-09-01 anchor across weeks/date edits.

Evidence: `independent-ownership.test.js`, `jest.independent.config.cjs`, `independent-ownership.log`.

## Focused host verification

| Check | Actual outcome |
| --- | --- |
| Fresh isolated `npm ci` on changed lockfile | Exit0;793 packages installed. |
| `npm run typecheck` | Exit0. |
| Original `npm run verify:migrations` | Exit0, production SQL/migration tests and41 lineage assertions completed, including populated/interrupted master upgrades, feature states, fail-closed unknown34, fingerprint strictness and self-heal. |
| Focused repository AsyncAthleteOwnership + AppleHealthBridge | **2 suites /98 tests pass**, exit0;36.65s. Existing Windows Babel alias warnings do not prevent completion. |
| `npm run verify:native-config` | Exit0. This is a static native contract check, not a native compilation or launch. |
| Independently owned awake/frozen-contract probe | Exit0; both negative sleep cases repaired, controls preserved, old backup entries63–67 unchanged. |
| Independently checked historical SQL | All34 master entries and67 feature entries remain byte-identical against actual historical git objects; the feature ordinal prefix remains unchanged and only069 is appended. `independent-frozen-lineage.json`. |

Slow unchanged archive retention/forward-restore suites were not rerun. They passed in the original exact-d9574bf audit; backup implementation, schema contracts and production migration runner bytes are unchanged in this delta. The current original migration gate rechecks the compatibility surface.

## Changed-code review and remaining confidence limits

**Permission handoff:** the boot handoff rechecks a replaced startup context read-only; a pending explicit request remains in control until it settles. Stale completion still requires ownership of the current permission revision before it can schedule a current-context check. Newer denial/disconnect/request revisions win in the independent cases. The timeout releases the lease in `finally`; the raced late native result has no path to the SQLite writes after timeout. The new historical-day filter prevents the wider native query window overwriting a complete older night.

**iOS fmt patch:** the Podfile patch is limited to fmt11.0.2 and one exact header condition, is idempotent when already patched, and refuses unexpected header text. The installed React Native pin matches11.0.2. It matches the workaround described in the primary [fmt issue4740](https://github.com/fmtlib/fmt/issues/4740). The issue describes a workaround; this audit does not treat that as proof of native compiler success. Root owns the exact-tip macOS CI/native artifact result.

**Dependency update:** independent lockfile comparison found19 existing-package version changes and **no direct runtime/native dependency version changes**. `npm ci`, typing and the affected native-bridge/store tests pass. A fresh `npm audit --json` still reports **57 advisories:1 critical,52 high,4 moderate**; the critical package isprotobufjs. Raw advisory data is in `npm-audit.json`; version/reachability summary in `lockfile-review.json`. The repository records Metro-source-map-based build-tool reachability triage. Those bundle/source-map artifacts were not independently regenerated in this recheck, so this audit does not convert that documentation into a blanket security approval or an independently proven absence of all shipped vulnerabilities. Advisories remain a tracked dependency risk; this recheck confirms the compatible lockfile changes did not alter direct native dependencies and pass the changed source contracts.

**Native/device scope:** no native app was built or launched by this lane. Root separately owns Android/iOS CI results, Apple signing/account inputs, physical HealthKit/Health Connect authorization and reads, and full app acceptance. Movement animation audit belongs to the separate lane. Owner4GB-device acceptance is explicitly deferred and is excluded from these source blockers; no memory or device evidence was invented.

## Exact source hashes

`source-before.json` and `source-after.json` record the same clean55955f8e tip. SHA256:

| Source | SHA256 |
| --- | --- |
| apps/mobile/src/state/useStore.ts | `0bdbea5a175e7ec2c228585a0b5f9a71e766d110b420daf5614530c12bb364ae` |
| packages/biometrics/src/appleHealth.ts | `ea8bce22ba4e0c684c0070528fbc1808eda8aaac9a0cdac06037e413bd8bb4ba` |
| packages/core-db/src/migrationRunner.ts | `fef9851098b8c8ff9bcb446acb9ed77b5fd99f8c3b1054996240d7998568af58` (unchanged) |
| packages/core-db/src/backup/schemaContract.ts | `b343259a388699476cd9196f08d15d5d7818299d8d3959510ce25fef65b4e04a` (unchanged) |
| packages/core-db/test/verify_migration_lineage.mjs | `ccf9e7aaa6408d7ad008b5dae32d3d5f0deef2035929067b28102c3f3a7a440d` |
| apps/mobile/ios/Podfile | `4f273790b190f00fbe466fbe4169a29190e4f5a39a261c5cb8317498ed4f4d04` |
| package-lock.json | `9e02ca7f8c0f95ccbf0860d8ebeadaac64d016bcda3f978d7f39ff56d507f5cf` |
